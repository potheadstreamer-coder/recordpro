let recorder;
let data = [];

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'start') {
        const streamId = message.data.streamId;
        const micEnabled = message.data.micEnabled;

        try {
            // CRITICAL FIX: To prevent "AbortError", we must never request audio and video together 
            // if we aren't 100% sure the user granted system audio. If it fails, the streamId is destroyed.
            // Therefore, we ALWAYS request video FIRST, entirely on its own.

            let desktopMedia;
            try {
                desktopMedia = await navigator.mediaDevices.getUserMedia({
                    audio: false,  // Absolutely NO audio here
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    }
                });
            } catch (videoErr) {
                console.error("Failed to capture video:", videoErr);
                throw videoErr; // If video fails, we can't record.
            }

            const tracks = [...desktopMedia.getVideoTracks()];

            // Now we try to get audio using the same streamId (Chrome sometimes allows this as a separate call)
            // Or we just rely on microphone. Since the user asked for system audio by default, we try it.
            try {
                const systemAudioMedia = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId
                        }
                    },
                    video: false // Absolutely NO video here
                });
                tracks.push(...systemAudioMedia.getAudioTracks());
            } catch (audioErr) {
                console.warn("User did not share system audio or it is unavailable.", audioErr.name);
            }

            // Finally, add microphone if enabled
            if (micEnabled) {
                try {
                    const micMedia = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    tracks.push(...micMedia.getAudioTracks());
                } catch (micErr) {
                    console.warn("Could not capture microphone audio.", micErr.name);
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
