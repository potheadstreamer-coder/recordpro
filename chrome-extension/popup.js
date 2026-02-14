document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');

    // Load state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({ type: 'checkInternalState' }, (response) => {
            if (response && response.isRecording) {
                updateUI(true);
            }
        });
    });

    startBtn.addEventListener('click', () => {
        const quality = document.getElementById('quality').value;
        const format = document.getElementById('format').value;
        const mic = document.getElementById('mic').checked;
        const systemAudio = document.getElementById('systemAudio').checked;

        chrome.runtime.sendMessage({
            type: 'startRecording',
            settings: { quality, format, mic, systemAudio }
        }, (response) => {
            if (response.success) {
                updateUI(true);
            } else {
                status.textContent = 'Error starting: ' + response.error;
            }
        });
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'stopRecording' }, (response) => {
            updateUI(false);
        });
    });

    function updateUI(isRecording) {
        if (isRecording) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            status.textContent = 'Recording active...';
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            status.textContent = 'Ready to capture';
        }
    }
});
