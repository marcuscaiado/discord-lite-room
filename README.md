# Call ⚡ - Lightweight WebRTC Voice, Video & Screen Rooms

**Call** (formerly Discord Lite) is a fast, lightweight Discord-like web application designed for real-time voice, 1080p 30fps screen transmission, video, dynamic private room isolation, and instant chat.

## Key Features
- **Instant Private Rooms**: Anyone can create an isolated room on the fly by appending `?room=roomname` (e.g., `?room=cs2`, `?room=vip`)
- **1080p @ 30 FPS Screen Transmission**: WebRTC mesh with bitrate optimization and live stream auto-focus
- **Zero-Reload Dynamic Streaming**: Incoming screen shares and camera toggles display instantly without requiring page refreshes
- **Auto-Reconnection**: Reconnects to the room seamlessly after network blips or server restarts
- **Window Modes**: OS Fullscreen, In-Window Borderless Maximize, and Dynamic Stream Pinning
- **Individual Audio Controls**: Per-user volume sliders and mute controls
- **Real-Time Text Chat**: Synchronized via Socket.io

## Tech Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5, Vanilla CSS3 (Discord Dark Theme), JavaScript (ES6+)
- **Media**: WebRTC (Google Public STUN)

## Quick Start (Local / LAN Only)

```bash
# Install dependencies
npm install

# Start server
node server.js
```
The server will run locally at `http://localhost:3000`.

> **⚠️ Note for Localhost:** `http://localhost:3000` only works on your own computer or devices on the same home Wi-Fi/LAN. Web browsers will also block microphone/screen sharing over HTTP across different networks. To share with friends over the internet, follow the steps below.

---

## 🌐 How to Make It Public Online for Friends (100% Free)

Choose one of the two options below:

### Option A: Free 24/7 Cloud Hosting (Recommended — Permanent Link)
Deploy directly to the cloud so the link stays online 24/7 even when your PC is turned off:

1. Create a free account on **[Render.com](https://render.com)**.
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository (`discord-lite-room`).
4. Set the following:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
5. Click **Deploy**. Render gives you a permanent, secure HTTPS link (e.g. `https://doscria-room.onrender.com`).
6. Send the link to your friends!

---

### Option B: Instant Public Link from Your PC (No Signups)
If you are running the server on your computer and want an instant public HTTPS link for your friends:

1. Start the server:
   ```bash
   node server.js
   ```
2. In a second terminal window, run:
   ```bash
   npx --yes cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare will output a public `https://...trycloudflare.com` link.
4. Send that link to your friends. *(Keeps running as long as your terminal remains open).*

