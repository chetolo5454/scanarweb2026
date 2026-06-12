import { socketClient } from './socket-client.js';

// Simple device detection
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Dynamically load CSS
function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

export function logInfo(...args) {
    console.info(`[${new Date().toISOString()}]`, ...args);
}

export function logError(...args) {
    console.error(`[${new Date().toISOString()}]`, ...args);
}

// Main initialization
async function init() {
    const isMobile = isMobileDevice();

    // UI Elements
    const desktopUI = document.getElementById('desktop-ui');
    const mobileUI = document.getElementById('mobile-ui');

    if (isMobile) {
        // Setup Mobile Environment
        logInfo('[App] Initialising Mobile View');
        loadCSS('/css/mobile.css');
        mobileUI.classList.remove('hidden');
        desktopUI.classList.add('hidden');

        // Initialize socket as mobile
        socketClient.init('mobile');

        // Dynamically load mobile logic
        try {
            const module = await import('./mobile.js');
            module.initMobile();
        } catch (error) {
            logError('[App] Failed to load mobile.js:', error);
        }

    } else {
        // Setup Desktop Environment
        logInfo('[App] Initialising Desktop View');
        loadCSS('/css/desktop.css');
        desktopUI.classList.remove('hidden');
        mobileUI.classList.add('hidden');

        // Initialize socket as desktop
        socketClient.init('desktop');

        // Dynamically load desktop logic
        try {
            const module = await import('./desktop.js');
            module.initDesktop();
        } catch (error) {
            logError('[App] Failed to load desktop.js:', error);
        }
    }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
