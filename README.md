# DosCria Room - Lightweight Discord WebRTC Clone

A lightweight Discord-like web application designed for up to 10 participants with real-time voice, 1080p 30fps screen transmission, video, dynamic room isolation, and text chat.

## Features
- **1080p @ 30 FPS Screen Transmission** (WebRTC Mesh with bitrate optimization)
- **Multi-Screen Support**: Multiple users can stream screens at the exact same time
- **Multi-Room Isolation**: Simply append `?room=roomname` to create isolated hangout lounges
- **Window Modes**: OS Fullscreen, In-Window Borderless Maximize, and Dynamic Pinning
- **Universal Layout**: Automatically centers and fits horizontal, portrait, and ultrawide monitors
- **Individual Audio Controls**: Per-user volume sliders and mute controls
- **Real-Time Text Chat**: Synchronized via Socket.io

## Tech Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5, Vanilla CSS3 (Discord Dark Theme), JavaScript (ES6+)
- **Media**: WebRTC (Google Public STUN)

## Quick Start
```bash
# Install dependencies
npm install

# Start server
node server.js
```
The server will run at `http://localhost:3000`.
