let recorder;
let data = [];

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'start') {
        const streamId = message.data;

        try {
            // Try with audio first
            let media;
            try {
                media = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    }
                });
            } catch (err) {
                console.warn("Audio capture failed, trying video only:", err);
                // Fallback to video only
                media = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    }
                });
            }

            // Create recorder
            recorder = new MediaRecorder(media, { mimeType: 'video/webm' });

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    data.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(data, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);

                // Generate filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `recording-${timestamp}.webm`;

                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                }, () => {
                    // window.close() can be called here if we want to reset strict state
                });

                // Reset
                data = [];
            };

            recorder.start();
            window.location.hash = 'recording';

        } catch (err) {
            console.error("Critical error starting recording:", err);
        }

    } else if (message.type === 'stop') {
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            // Stop streams to release "sharing" UI
            if (recorder.stream) {
                recorder.stream.getTracks().forEach(t => t.stop());
            }
        }
        window.location.hash = '';
    }
});
