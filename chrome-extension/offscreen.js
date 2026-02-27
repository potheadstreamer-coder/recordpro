let recorder;
let data = [];

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'start') {
        const streamId = message.data.streamId;
        const micEnabled = message.data.micEnabled;

        try {
            let desktopMedia;
            let capturedAudio = false;

            try {
                // First try: The user might have checked "Share system audio". 
                // We MUST request audio: true here if they did, otherwise it fails.
                desktopMedia = await navigator.mediaDevices.getUserMedia({
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
                capturedAudio = true;
            } catch (err) {
                // Second try: User did NOT check "Share system audio".
                // If we request audio now, it fails with AbortError/DOMException.
                // So we request video ONLY.
                console.warn("Could not capture system audio (probably unchecked). Capturing video only.", err);
                desktopMedia = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    }
                });
            }

            const tracks = [...desktopMedia.getVideoTracks()];
            if (capturedAudio) {
                tracks.push(...desktopMedia.getAudioTracks());
            }

            // 2. Optionally capture Microphone Audio separately (only if we didn't get system audio, or wanted to mix them - keeping it simple)
            // If they granted system audio, we usually don't need mic too unless mixing. Let's add mic anyway if requested.
            if (micEnabled) {
                try {
                    const micMedia = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    tracks.push(...micMedia.getAudioTracks());
                } catch (micErr) {
                    console.warn("Could not capture microphone audio.", micErr);
                }
            }
            const combinedMedia = new MediaStream(tracks);

            // Create recorder
            recorder = new MediaRecorder(combinedMedia, { mimeType: 'video/webm' });

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
            console.error("Critical error starting recording. Name:", err.name, "Message:", err.message, err);
        }

    } else if (message.type === 'stop') {
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            if (recorder.stream) {
                recorder.stream.getTracks().forEach(t => t.stop());
            }
        }
        window.location.hash = '';
    } else if (message.type === 'pause') {
        if (recorder && recorder.state === 'recording') {
            recorder.pause();
        }
    } else if (message.type === 'resume') {
        if (recorder && recorder.state === 'paused') {
            recorder.resume();
        }
    }
});
