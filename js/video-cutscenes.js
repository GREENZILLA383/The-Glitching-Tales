// Video Cutscenes Manager
class VideoManager {
    constructor() {
        this.videoLayer = document.getElementById('video-layer');
        this.videoElement = document.getElementById('cutscene-video');
        this.skipBtn = document.getElementById('skip-video-btn');
        this.onCompleteCallback = null;

        this.skipBtn.addEventListener('click', () => this.skipVideo());
        this.videoElement.addEventListener('ended', () => this.endVideo());
    }

    playVideo(videoUrl, onComplete) {
        this.onCompleteCallback = onComplete;
        
        // Load and play
        this.videoElement.src = videoUrl;
        this.videoLayer.classList.remove('hidden');
        
        this.videoElement.play().catch(e => {
            console.error("Auto-play prevented or video failed to load:", e);
            // If it fails (like due to browser autoplay policies), just skip
            this.endVideo();
        });
    }

    skipVideo() {
        this.videoElement.pause();
        this.endVideo();
    }

    endVideo() {
        this.videoElement.currentTime = 0;
        this.videoLayer.classList.add('hidden');
        if (this.onCompleteCallback) {
            const callback = this.onCompleteCallback;
            this.onCompleteCallback = null; // Clear to prevent double calls
            callback();
        }
    }
}

// Global instance
const videoManager = new VideoManager();
