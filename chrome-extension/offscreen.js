let recorder;
let data = [];

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'start') {
        const streamId = message.data.streamId;
        const micEnabled = message.data.micEnabled;

        try {
            // 1. Capture Desktop Video (ALWAYS succeeds if streamId is valid, because we don't ask for system audio which might be missing)
            const desktopMedia = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: streamId
                    }
                }
            });

            const tracks = [...desktopMedia.getVideoTracks()];

            // 2. Optionally capture Microphone Audio
            if (micEnabled) {
                try {
                    const micMedia = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    tracks.push(...micMedia.getAudioTracks());
                } catch (micErr) {
                    console.warn("Could not capture microphone (maybe permissions?), proceeding without audio.", micErr);
                }
            }

            // 3. Combine tracks
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
