document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const recordTabBtn = document.getElementById('recordTabBtn');
    const recordWindowBtn = document.getElementById('recordWindowBtn');
    const recordScreenBtn = document.getElementById('recordScreenBtn');

    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const mainPanel = document.getElementById('mainPanel');
    const recordingPanel = document.getElementById('recordingPanel');

    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const recordingStatusText = document.getElementById('recordingStatusText');
    const micToggle = document.getElementById('micToggle');

    let timerInterval;
    let seconds = 0;
    let isPaused = false;

    // --- 2. Check Existing Recording State ---
    chrome.runtime.sendMessage({ type: 'checkState' }, (response) => {
        if (response && response.isRecording) {
            showRecordingState(response.isPaused, response.timeInSeconds || 0);
        }
    });

    // --- 3. Start Recording ---
    function startRecording(sources) {
        chrome.desktopCapture.chooseDesktopMedia(sources, (streamId) => {
            if (!streamId) {
                status.textContent = 'Selection cancelled';
                return;
            }

            chrome.runtime.sendMessage({
                type: 'start',
                streamId: streamId,
                micEnabled: micToggle ? micToggle.checked : true
            }, (response) => {
                if (response && response.success) {
                    showRecordingState();
                } else {
                    status.textContent = 'Error starting recording';
                }
            });
        });
    }

    if (recordTabBtn) recordTabBtn.addEventListener('click', () => startRecording(['tab']));
    if (recordWindowBtn) recordWindowBtn.addEventListener('click', () => startRecording(['window']));
    if (recordScreenBtn) recordScreenBtn.addEventListener('click', () => startRecording(['screen']));

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

    // --- 4.5 Pause/Resume Recording ---
    if (pauseResumeBtn) {
        pauseResumeBtn.addEventListener('click', () => {
            const isPausing = pauseResumeBtn.innerText === 'Pause';
            const action = isPausing ? 'pause' : 'resume';

            chrome.runtime.sendMessage({ type: action }, (response) => {
                if (response && response.success) {
                    setPausedUI(isPausing);
                }
            });
        });
    }

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
    function showRecordingState(paused = false, initialSeconds = 0) {
        mainPanel.style.display = 'none';
        recordingPanel.style.display = 'flex';
        recordingPanel.style.flexDirection = 'column'; // Ensure column layout
        seconds = initialSeconds;
        setPausedUI(paused);
    }

    function setPausedUI(paused) {
        isPaused = paused;
        if (paused) {
            pauseResumeBtn.innerText = 'Resume';
            pauseResumeBtn.style.background = '#27ae60';
            pauseResumeBtn.style.color = 'white';
            recordingStatusText.innerText = 'Recording Paused';
            stopTimer();
        } else {
            pauseResumeBtn.innerText = 'Pause';
            pauseResumeBtn.style.background = '#f2c94c';
            pauseResumeBtn.style.color = '#333';
            recordingStatusText.innerText = 'Recording in progress...';
            startTimer();
        }
    }

    function resetUI() {
        mainPanel.style.display = 'flex';
        recordingPanel.style.display = 'none';
        stopTimer();
        seconds = 0;
    }

    function updateTimerDisplay() {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        document.querySelector('.timer').innerText = `${mins}:${secs}`;
    }

    function startTimer() {
        updateTimerDisplay(); // Initial display
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            seconds++;
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
    }
});
