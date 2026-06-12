import { socketClient } from './socket-client.js';
import { logInfo, logError } from './app.js';

let stream = null;

// DOM Elements
const step1 = document.getElementById('mobile-step-1');
const step2 = document.getElementById('mobile-step-2');
const doneScreen = document.getElementById('mobile-done-screen');

const btnActivate = document.getElementById('btn-activate-camera');
const errorMsg = document.getElementById('camera-error');
const video = document.getElementById('camera-video');
const canvas = document.getElementById('offscreen-canvas');
const btnShutter = document.getElementById('btn-shutter');
const btnDone = document.getElementById('btn-mobile-done');
const flashOverlay = document.getElementById('capture-flash');
const captureBadge = document.getElementById('capture-badge');

export function initMobile() {
    logInfo('[Mobile] Init');

    // Bind Event Listeners
    btnActivate.addEventListener('click', activateCamera);
    btnShutter.addEventListener('click', capturePhoto);
    btnDone.addEventListener('click', finishSession);

    // Socket Listeners
    socketClient.on('capture:confirm', handleCaptureConfirm);
}

async function activateCamera() {
    try {
        errorMsg.classList.add('hidden');

        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Request back camera
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        // Connect stream to video element
        video.srcObject = stream;

        // Wait for video metadata to load so we know dimensions
        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });

        // Switch to Step 2
        step1.classList.remove('active-step');
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        step2.classList.add('active-step');

    } catch (err) {
        logError('[Mobile] Camera access error:', err);
        errorMsg.textContent = 'Camera access denied or unavailable. Please ensure you have granted permission in your browser settings.';
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            errorMsg.textContent += ' Note: Camera requires an HTTPS connection.';
        }
        errorMsg.classList.remove('hidden');
    }
}

function capturePhoto() {
    if (!stream) return;

    // Set canvas dimensions to match actual video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
        // Compress to JPEG
        const base64String = canvas.toDataURL('image/jpeg', 0.85);

        // Emit via socket
        socketClient.emit('photo:captured', {
            imageData: base64String,
            timestamp: Date.now()
        });

        // Show local feedback immediately
        playCaptureAnimation();

    } catch (err) {
        logError('[Mobile] Capture error:', err);
        alert('Failed to capture image. Please try again.');
    }
}

function playCaptureAnimation() {
    // Flash
    flashOverlay.classList.remove('flashing');
    void flashOverlay.offsetWidth; // trigger reflow
    flashOverlay.classList.add('flashing');

    // Badge
    captureBadge.classList.remove('show');
    void captureBadge.offsetWidth;
    captureBadge.classList.add('show');
}

function handleCaptureConfirm(data) {
    // Highlight shutter green briefly
    btnShutter.classList.add('confirmed');
    setTimeout(() => {
        btnShutter.classList.remove('confirmed');
    }, 300);
}

function finishSession() {
    socketClient.emit('session:done', {});

    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    // Switch to done screen
    step2.classList.remove('active-step');
    step2.classList.add('hidden');
    doneScreen.classList.remove('hidden');
    doneScreen.classList.add('active-step');
}
