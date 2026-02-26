document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const mainPanel = document.getElementById('mainPanel');
    const recordingPanel = document.getElementById('recordingPanel');
    const tabs = document.querySelectorAll('.tab');
    const screenSelect = document.getElementById('screenSelect');

    let currentMode = 'screen-cam'; // 'screen-cam', 'screen-only', 'cam-only'
    let timerInterval;
    let seconds = 0;

    // --- 1. Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            // Add to click
            tab.classList.add('active');
            currentMode = tab.dataset.mode;

            // Adjust UI based on mode
            if (currentMode === 'cam-only') {
                screenSelect.disabled = true;
            } else {
                screenSelect.disabled = false;
            }
        });
    });

    // --- 2. Check Existing Recording State ---
    chrome.runtime.sendMessage({ type: 'checkState' }, (response) => {
        if (response && response.isRecording) {
            showRecordingState();
        }
    });

    // --- 3. Start Recording ---
    startBtn.addEventListener('click', () => {
        // If Camera Only, we might need different logic (userMedia only),
        // but for now, let's stick to desktopCapture for simplicity 
        // as "Camera Only" usually implies a PIP or full cam view which we don't have a viewer for yet.
        // We will default to desktopCapture for all modes to ensure success, 
        // but passing the 'mode' to background could help later.

        chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab', 'audio'], (streamId) => {
            if (!streamId) {
                status.textContent = 'Selection cancelled';
                return;
            }

            chrome.runtime.sendMessage({
                type: 'start',
                streamId: streamId,
                mode: currentMode
            }, (response) => {
                if (response && response.success) {
                    showRecordingState();
                    // Optional: Close popup functionality removed to show status
                    // window.close(); 
                } else {
                    status.textContent = 'Error starting recording';
                }
            });
        });
    });

    // --- 4. Stop Recording ---
    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'stop' }, (response) => {
            resetUI();
            status.textContent = 'Recording saved!';
            setTimeout(() => {
                status.textContent = 'Ready to capture';
            }, 3000);
        });
    });

    // --- 5. Screenshot ---
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            // Hide the popup temporarily? (Not really possible without closing it, 
            // but we can capture the visible tab instantly)

            // Note: captureVisibleTab requires <all_urls> or activeTab permission
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    status.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    return;
                }

                // Download the screenshot
                const link = document.createElement('a');
                link.download = `screenshot-${new Date().toISOString().replace(/:/g, '-')}.png`;
                link.href = dataUrl;
                link.click();

                status.textContent = 'Screenshot saved!';
                setTimeout(() => {
                    status.textContent = 'Ready to capture';
                }, 2000);
            });
        });
    }

    // --- Helpers ---
    function showRecordingState() {
        mainPanel.style.display = 'none';
        recordingPanel.style.display = 'flex';
        recordingPanel.style.flexDirection = 'column'; // Ensure column layout
        startTimer();
    }

    function resetUI() {
        mainPanel.style.display = 'flex';
        recordingPanel.style.display = 'none';
        stopTimer();
    }

    function startTimer() {
        seconds = 0;
        document.querySelector('.timer').innerText = "00:00";
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            document.querySelector('.timer').innerText = `${mins}:${secs}`;
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
    }
});
