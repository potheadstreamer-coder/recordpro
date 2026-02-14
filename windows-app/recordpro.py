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

    def start_recording(self, filename, resolution_idx, monitor_idx=1):
        self.filename = filename 
        self.is_recording = True
        self.monitor_idx = monitor_idx
        
        # Determine specific resolution or full screen
        # For simplicity, we'll just record the full screen of the monitor
        
        self.thread = threading.Thread(target=self._record)
        self.thread.start()

    def _record(self):
        with mss.mss() as sct:
            # Check if monitor exists, else default to 1
            if self.monitor_idx > len(sct.monitors) - 1:
                self.monitor_idx = 1
            
            monitor = sct.monitors[self.monitor_idx]
            width = monitor["width"]
            height = monitor["height"]
            
            # Codec setup
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(self.filename, fourcc, self.fps, (width, height))
            
            start_time = time.time()
            
            while self.is_recording:
                img = sct.grab(monitor)
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

# --- Main UI Class ---
class RecordProApp(QMainWindow):
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
        self.res_combo.addItems(["1080p (FHD)", "720p (HD)", "4K (UHD)", "Screen Native"])
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
        QTimer.singleShot(500, self._capture_screen) # Delay to let window hide

    def _capture_screen(self):
        try:
            filename, _ = QFileDialog.getSaveFileName(self, "Save Screenshot", "screenshot.png", "Images (*.png *.jpg)")
            if filename:
                with mss.mss() as sct:
                    # Capture primary monitor for now
                    monitor = sct.monitors[1] 
                    sct_img = sct.grab(monitor)
                    mss.tools.to_png(sct_img.rgb, sct_img.size, output=filename)
                
                self.status_label.setText("Screenshot Saved")
                QTimer.singleShot(2000, lambda: self.status_label.setText("Ready"))
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to take screenshot: {str(e)}")
        finally:
            self.show()

    def toggle_recording(self):
        if not self.is_recording:
            # Start
            filename, _ = QFileDialog.getSaveFileName(self, "Save Video", "", "Video Files (*.mp4 *.avi *.mkv *.mov)")
            if filename:
                self.is_recording = True
                self.record_btn.setText("Stop Recording")
                self.record_btn.setStyleSheet("background-color: #ff3b30; color: white; border-radius: 20px; padding: 12px; font-weight: bold;")
                self.status_label.setText("Recording...")
                self.screenshot_btn.setEnabled(False) # Disable screenshot while recording for now to simplify
                self.hide() # Hide window when recording
                
                # Start recording logic
                self.recorder.start_recording(filename, 0) # 0 is dummy for resolution idx
        else:
            # Stop
            self.stop_recording()

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
