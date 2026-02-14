import sys
import cv2
import numpy as np
import mss
import sounddevice as sd
import soundfile as sf
import threading
import time
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QComboBox, 
                             QSystemTrayIcon, QMenu, QFileDialog, QMessageBox)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QObject
from PyQt6.QtGui import QIcon, QAction, QFont, QPalette, QColor

# --- Recorder Class ---
class ScreenRecorder(QObject):
    finished = pyqtSignal()
    
    def __init__(self):
        super().__init__()
        self.is_recording = False
        self.filename = "recording.mp4"
        self.fps = 30.0
        self.resolution = (1920, 1080)
        self.monitor_idx = 1 # Primary

    def start_recording(self, filename, resolution_idx, monitor_idx=1, region=None):
        self.filename = filename 
        self.is_recording = True
        self.monitor_idx = monitor_idx
        self.region = region
        
        self.thread = threading.Thread(target=self._record)
        self.thread.start()

    def _record(self):
        with mss.mss() as sct:
            # Check if monitor exists, else default to 1
            if self.monitor_idx > len(sct.monitors) - 1:
                self.monitor_idx = 1
            
            monitor = sct.monitors[self.monitor_idx]
            
            # Define capture area
            if self.region:
                # region is (x, y, w, h)
                capture_area = {"top": self.region[1], "left": self.region[0], "width": self.region[2], "height": self.region[3]}
                width = self.region[2]
                height = self.region[3]
            else:
                capture_area = monitor
                width = monitor["width"]
                height = monitor["height"]
            
            # Codec setup
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(self.filename, fourcc, self.fps, (width, height))
            
            start_time = time.time()
            
            # Ensure even dimensions for compatibility (some codecs dislike odd numbers)
            # Not strictly enforcing here but good to know.
            
            while self.is_recording:
                img = sct.grab(capture_area)
                frame = np.array(img)
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                out.write(frame)
                
                # Cap FPS
                elapsed = time.time() - start_time
                scap = 1.0/self.fps
                if elapsed < scap:
                    time.sleep(scap - elapsed)
                start_time = time.time()

            out.release()
            self.finished.emit()

    def stop_recording(self):
        self.is_recording = False
        if hasattr(self, 'thread'):
            self.thread.join()

# --- Snipping Widget ---
class SnippingWidget(QWidget):
    finished = pyqtSignal(object) # Emit with rect (x, y, w, h) or None

    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setWindowState(Qt.WindowState.WindowFullScreen)
        self.setCursor(Qt.CursorShape.CrossCursor)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        self.start_point = None
        self.end_point = None
        self.is_snipping = False
        
        # Overlay color (semi-transparent black)
        self.overlay_color = QColor(0, 0, 0, 100) 
        self.pen_color = QColor(255, 255, 255)

    def paintEvent(self, event):
        from PyQt6.QtGui import QPainter, QPen, QBrush
        
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw full screen overlay
        painter.setBrush(QBrush(self.overlay_color))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRect(self.rect())
        
        if self.start_point and self.end_point:
            # clear the selected rectangle (make it transparent)
            rect = self._get_rect()
            painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_Clear)
            painter.setBrush(QBrush(Qt.GlobalColor.transparent))
            painter.drawRect(rect)
            
            # Draw border
            painter.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
            pen = QPen(self.pen_color, 2, Qt.PenStyle.DashLine)
            painter.setPen(pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawRect(rect)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.start_point = event.pos()
            self.end_point = self.start_point
            self.is_snipping = True
            self.update()

    def mouseMoveEvent(self, event):
        if self.is_snipping:
            self.end_point = event.pos()
            self.update()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.is_snipping = False
            rect = self._get_rect()
            self.close()
            # Convert to global coordinates not needed since widget is fullscreen
            if rect.width() > 0 and rect.height() > 0:
                 # Helper to get global screen geometry to offset if needed
                 # For now assuming primary monitor full screen 0,0
                self.finished.emit((rect.x(), rect.y(), rect.width(), rect.height()))
            else:
                self.finished.emit(None)

    def _get_rect(self):
        from PyQt6.QtCore import QRect
        if not self.start_point or not self.end_point:
            return QRect()
            
        x1 = min(self.start_point.x(), self.end_point.x())
        y1 = min(self.start_point.y(), self.end_point.y())
        x2 = max(self.start_point.x(), self.end_point.x())
        y2 = max(self.start_point.y(), self.end_point.y())
        return QRect(x1, y1, x2 - x1, y2 - y1)

    def keyPressEvent(self, event):
        # Cancel on Escape
        if event.key() == Qt.Key.Key_Escape:
            self.close()
            self.finished.emit(None)
    def __init__(self):
        super().__init__()
        self.setWindowTitle("RecordPro")
        self.setGeometry(100, 100, 400, 300)
        self.setFixedSize(400, 350)
        
        # Initialize recorder
        self.recorder = ScreenRecorder()
        self.recorder.finished.connect(self.on_recording_finished)
        self.is_recording = False

        # UI Setup
        self.init_ui()
        self.apply_styles()
        self.setup_tray()

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setSpacing(20)
        layout.setContentsMargins(30, 30, 30, 30)

        # Header
        title = QLabel("RecordPro")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setObjectName("title")
        layout.addWidget(title)

        # Settings
        settings_layout = QVBoxLayout()
        
        # Resolution
        res_layout = QHBoxLayout()
        res_label = QLabel("Resolution:")
        self.res_combo = QComboBox()
        self.res_combo.addItems(["Screen Native", "Select Region", "1080p (FHD)", "720p (HD)", "4K (UHD)"])
        res_layout.addWidget(res_label)
        res_layout.addWidget(self.res_combo)
        settings_layout.addLayout(res_layout)

        # Format
        fmt_layout = QHBoxLayout()
        fmt_label = QLabel("Format:")
        self.fmt_combo = QComboBox()
        self.fmt_combo.addItems(["MP4", "AVI", "MKV", "MOV"])
        fmt_layout.addWidget(fmt_label)
        fmt_layout.addWidget(self.fmt_combo)
        settings_layout.addLayout(fmt_layout)

        layout.addLayout(settings_layout)

        # Spacer
        layout.addStretch()

        button_layout = QHBoxLayout()
        
        # Record Button
        self.record_btn = QPushButton("Start Recording")
        self.record_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.record_btn.clicked.connect(self.toggle_recording)
        self.record_btn.setObjectName("recordBtn")
        button_layout.addWidget(self.record_btn)
        
        # Screenshot Button
        self.screenshot_btn = QPushButton("📷")
        self.screenshot_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.screenshot_btn.clicked.connect(self.take_screenshot)
        self.screenshot_btn.setObjectName("screenshotBtn")
        self.screenshot_btn.setFixedWidth(50)
        button_layout.addWidget(self.screenshot_btn)
        
        layout.addLayout(button_layout)
        
        # Status
        self.status_label = QLabel("Ready")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_label.setObjectName("status")
        layout.addWidget(self.status_label)

    def apply_styles(self):
        # Apple-inspired Dark Mode Palette
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1c1c1e;
            }
            QLabel {
                color: #f5f5f7;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
            }
            QLabel#title {
                font-size: 24px;
                font-weight: bold;
                color: #ffffff;
                margin-bottom: 10px;
            }
            QLabel#status {
                color: #86868b;
                font-size: 12px;
            }
            QComboBox {
                background-color: #2c2c2e;
                color: white;
                border: 1px solid #3a3a3c;
                border-radius: 8px;
                padding: 5px 10px;
                font-size: 13px;
            }
            QComboBox::drop-down {
                border: none;
            }
            QPushButton#recordBtn {
                background-color: #0071e3;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 12px;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton#recordBtn:hover {
                background-color: #0077ed;
            }
            QPushButton#recordBtn:checked {
                background-color: #ff3b30;
            }
            QPushButton#screenshotBtn {
                background-color: #3a3a3c;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 12px;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton#screenshotBtn:hover {
                background-color: #48484a;
            }
        """)

    def setup_tray(self):
        self.tray_icon = QSystemTrayIcon(self)
        # self.tray_icon.setIcon(QIcon("icon.png")) # Add icon later
        
        tray_menu = QMenu()
        show_action = QAction("Show", self)
        show_action.triggered.connect(self.show)
        quit_action = QAction("Quit", self)
        quit_action.triggered.connect(QApplication.instance().quit)
        
        tray_menu.addAction(show_action)
        tray_menu.addAction(quit_action)
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.show()

    def take_screenshot(self):
        self.hide()
        # Launch snipping tool
        self.snipper = SnippingWidget()
        self.snipper.finished.connect(self._on_snip_finished)
        self.snipper.show()

    def _on_snip_finished(self, rect):
        if rect:
            # rect is (x, y, w, h)
            self._capture_screen(rect)
        else:
            # Canceled
            self.show()

    def _capture_screen(self, rect):
        try:
            filename, _ = QFileDialog.getSaveFileName(self, "Save Screenshot", "screenshot.png", "Images (*.png *.jpg)")
            if filename:
                with mss.mss() as sct:
                    # We need to map the rect to the monitor coordinates.
                    # Since SnippingWidget was fullscreen on (likely) primary monitor or all monitors?
                    # PyQt fullscreen usually covers the screen where it opened.
                    # For simplicity, we assume we want to capture the area defined by rect 
                    # relative to the whole virtual screen if possible, or just primary.
                    
                    # mss can handle 'top', 'left', 'width', 'height'
                    capture_chk = {'top': rect[1], 'left': rect[0], 'width': rect[2], 'height': rect[3]}
                    
                    sct_img = sct.grab(capture_chk)
                    mss.tools.to_png(sct_img.rgb, sct_img.size, output=filename)
                
                self.status_label.setText("Screenshot Saved")
                QTimer.singleShot(2000, lambda: self.status_label.setText("Ready"))
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to take screenshot: {str(e)}")
        finally:
            self.show()

    def toggle_recording(self):
        if not self.is_recording:
            # Check if "Select Region" is chosen
            if self.res_combo.currentText() == "Select Region":
                self.hide()
                self.recorder_snipper = SnippingWidget()
                self.recorder_snipper.finished.connect(self._on_record_snip_finished)
                self.recorder_snipper.show()
                return

            # Start Normal Recording (Full Screen)
            self._start_recording_process()
        else:
            # Stop
            self.stop_recording()

    def _on_record_snip_finished(self, rect):
        if rect:
            self._start_recording_process(region=rect)
        else:
            self.show()

    def _start_recording_process(self, region=None):
        filename, _ = QFileDialog.getSaveFileName(self, "Save Video", "", "Video Files (*.mp4 *.avi *.mkv *.mov)")
        if filename:
            self.is_recording = True
            self.record_btn.setText("Stop Recording")
            self.record_btn.setStyleSheet("background-color: #ff3b30; color: white; border-radius: 20px; padding: 12px; font-weight: bold;")
            self.status_label.setText("Recording...")
            self.screenshot_btn.setEnabled(False) 
            self.hide() 
            
            # Start recording logic
            self.recorder.start_recording(filename, self.res_combo.currentIndex(), region=region) 
        else:
             self.show()

    def stop_recording(self):
        if self.is_recording:
            self.is_recording = False
            self.recorder.stop_recording()
            self.record_btn.setText("Start Recording")
            self.record_btn.setStyleSheet("""
                background-color: #0071e3;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 12px;
                font-size: 16px;
                font-weight: bold;
            """)
            self.screenshot_btn.setEnabled(True)
            self.status_label.setText("Saved")
            self.show()

    def on_recording_finished(self):
        self.status_label.setText("Ready")
        # QMessageBox.information(self, "RecordPro", "Recording saved successfully!")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = RecordProApp()
    window.show()
    sys.exit(app.exec())
