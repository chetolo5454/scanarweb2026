# WebScan — Local Document Scanner Web App

WebScan is a complete, production-ready local web application that turns your phone into a wireless document scanner. It runs locally on your desktop, securely streams camera captures from your phone via WebRTC/Socket.io, and provides perspective correction, filtering, and PDF export without needing any mobile app installation.

## Prerequisites

- Node.js v18+

## Installation

```bash
git clone <repo-url>
cd webscan
npm install
```

## Running (HTTP)

```bash
npm start
```

Use HTTP when running on your local network and when testing with devices/browsers that do not enforce strict secure contexts for camera access (like some versions of Android Chrome when testing locally).

## Running (HTTPS)

```bash
npm run start:https
```

Use HTTPS when required by the browser to access `getUserMedia` (the camera API). This is strictly required for iOS Safari and many modern Android browsers.
Since it generates a self-signed certificate on the fly:
1. Open the URL on your phone.
2. The browser will warn you that the connection is not private.
3. On iOS Safari: Tap "Show Details" -> "visit this website" -> "Visit Website".
4. On Android Chrome: Tap "Advanced" -> "Proceed to [IP] (unsafe)".

## Usage Walkthrough

1. Run the application (using HTTP or HTTPS) on your desktop.
2. Open the desktop browser and go to `http://localhost:3000` (or the IP provided in the terminal).
3. Connect your phone to the same Wi-Fi network and scan the QR code on the desktop screen or manually type the URL.
4. On your phone, tap "Tap to Activate Camera" and grant camera permissions.
5. Aim your phone at a document and tap the capture button. The image will stream to the desktop.
6. Take as many photos as needed, then tap "Done" on the phone or "Done Scanning" on the desktop.
7. On the desktop, select each page to apply Perspective Crop to adjust the document boundaries.
8. Apply filters (Magic, B&W, Print, Photo) to enhance the document.
9. Click "Download All as PDF" to generate and save your final document.

## Troubleshooting

- **Camera Permission Denied:** Ensure you have granted camera permissions. On iOS, check Settings > Safari > Camera. On Android, check Chrome Settings > Site Settings > Camera. If using iOS, ensure you are running the app with HTTPS.
- **Phone Can't Reach the Server:** Ensure your phone and desktop are on the same Wi-Fi network. Check if your desktop firewall is blocking the Node.js process (port 3000). You may need to temporarily disable your firewall or add a rule to allow incoming connections on port 3000.
- **QR Code Not Appearing:** Ensure your desktop has a valid local IP address and is connected to a network.
