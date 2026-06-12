const express = require('express');
const http = require('http');
const https = require('https');
const os = require('os');
const { Server } = require('socket.io');
const selfsigned = require('selfsigned');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Detect local IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIP = getLocalIP();
let server;
let protocol = 'http';

// Provide configuration to the client
app.get('/api/config', (req, res) => {
    res.json({
        localUrl: `${protocol}://${localIP}:${PORT}`
    });
});

if (USE_HTTPS) {
    protocol = 'https';
    console.log('🔒 Generating self-signed certificate...');
    const pems = selfsigned.generate([{ name: 'commonName', value: localIP }], { days: 365 });

    server = https.createServer({
        key: pems.private,
        cert: pems.cert
    }, app);

    console.warn('\n⚠️  WARNING: Using self-signed certificate.');
    console.warn('When connecting from your phone, your browser will warn you that the connection is not private.');
    console.warn('You must proceed past the warning (e.g., tap "Advanced" -> "Proceed") to allow camera access.\n');
} else {
    server = http.createServer(app);
}

const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB max payload for large images
});

io.on('connection', (socket) => {
    socket.on('identify', (data) => {
        socket.join('main-session');

        if (data.type === 'mobile') {
            // Notify desktop that mobile has connected
            io.to('main-session').emit('session:mobile_connected', { socketId: socket.id });
        }
    });

    socket.on('photo:captured', (data) => {
        // Forward photo from mobile to all clients in room (which desktops will process)
        socket.to('main-session').emit('photo:captured', data);
    });

    socket.on('capture:confirm', (data) => {
        // Forward confirmation from desktop to mobiles
        socket.to('main-session').emit('capture:confirm', data);
    });

    socket.on('session:done', (data) => {
        // Forward session done from mobile to desktops
        socket.to('main-session').emit('session:done', data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 WebScan Server is running!\n`);
    console.log(`✅  Desktop: ${protocol}://localhost:${PORT}`);
    console.log(`📱  Mobile:  ${protocol}://${localIP}:${PORT}\n`);
});
