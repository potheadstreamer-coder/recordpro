document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Hero interaction
    const recordBtn = document.querySelector('.record-btn');
    const timeDisplay = document.querySelector('.time');
    const preview = document.getElementById('preview');
    let isRecording = false;
    let timerInterval;
    let seconds = 0;
    let stream = null;

    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: false
                    });

                    preview.srcObject = stream;
                    isRecording = true;

                    recordBtn.style.borderRadius = '8px';
                    recordBtn.style.transform = 'scale(0.8)';
                    startTimer();

                    // Handle stream stop (user clicks "Stop Sharing" in browser UI)
                    stream.getVideoTracks()[0].onended = () => {
                        stopRecording();
                    };

                } catch (err) {
                    console.error("Error: " + err);
                }
            } else {
                stopRecording();
            }
        });
    }

    function stopRecording() {
        if (stream) {
            let tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            preview.srcObject = null;
            stream = null;
        }
        isRecording = false;
        recordBtn.style.borderRadius = '50%';
        recordBtn.style.transform = 'scale(1)';
        stopTimer();
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            seconds++;
            const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            timeDisplay.textContent = `${h}:${m}:${s}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        seconds = 0;
        timeDisplay.textContent = '00:00:00';
    }

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .download-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
});
