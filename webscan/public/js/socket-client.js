import { logInfo, logError } from './app.js';

export class SocketClient {
    constructor() {
        this.socket = null;
        this.type = null;
        this.callbacks = new Map();
    }

    init(type) {
        this.type = type;
        this.socket = io();

        this.socket.on('connect', () => {
            logInfo(`[Socket] Connected as ${this.type}`);
            this.socket.emit('identify', { type: this.type });
        });

        // Register standard event listeners that forward to callbacks
        const events = ['session:mobile_connected', 'photo:captured', 'capture:confirm', 'session:done'];

        events.forEach(event => {
            this.socket.on(event, (data) => {
                const callback = this.callbacks.get(event);
                if (callback) {
                    callback(data);
                }
            });
        });
    }

    on(event, callback) {
        this.callbacks.set(event, callback);
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            logError(`[Socket] Cannot emit ${event}, socket not connected`);
        }
    }
}

// Export a singleton instance
export const socketClient = new SocketClient();
