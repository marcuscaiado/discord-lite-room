# Caller ⚡

A comprehensive, production-ready **Caller Web Application** built with Node.js, Express, Socket.io, and WebRTC. Features multi-server navigation, categorized text & voice channels, Direct Messages (DMs) & Friends list, rich markdown chat with reactions and file attachments, soundboard & synthesized audio chimes, Krisp-style Web Audio DSP noise cancellation, and high-fidelity 1080p 30/60 FPS screen transmission.

---

## 🌟 Key Features

### 🏰 Multi-Server & Community Spaces (72px)
- **Caller Home Button**: Instant switch between servers and Direct Messages / Friends list.
- **Preloaded & Custom Servers**:
  - *⚡ DosCria Hub* (Community, Clips, Rules, 1080p Lounge, Late Night Radio)
  - *🎮 Gaming HQ* (LFG Party, CS2 Comp, Valorant Ranked, Chill Duo)
  - *💻 Dev & Tech* (Pair Programming, Showcase, Tech Talk)
  - *🎵 Music & Chill* (Lofi 24/7, Track Recommendations)
- **Create Server Modal**: Add custom servers on the fly with custom names and icons.
- **Server Discovery**: Explore discoverable communities.

### 📁 Channel Categories & Nested Voice Navigation (240px)
- **Categorized Channels**: Collapsible `TEXT CHANNELS` and `VOICE & STREAMS`.
- **Nested Voice Participants**: Displays connected users, avatars, and speaking status directly nested inside each voice channel item, matching Discord Desktop.
- **Docked Voice Status Card**: Real-time `RTC Connected`, ping indicator (18ms), connected room name, and one-click Disconnect button with authentic Discord leave chime.
- **User Footer Dock**: Live status indicator (Online, Idle, DND, Offline), username, tag (`#0001`), mute mic, deafen sound, and user settings gear.

### 💬 Direct Messages (DMs) & Friends System
- **Friends Hub**: Filter friends by *Online*, *All*, *Pending*, *Blocked*, plus *Add Friend*.
- **1-on-1 Direct Chat & Calls**: Send private messages or start direct 1-on-1 audio/video calls with custom ringtone.
- **Active Now Panel**: See what friends and bots are playing or listening to.

### 📝 Rich Text Chat, Markdown & Reactions
- **Full Markdown Support**: `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, ```` ```code blocks``` ````, `> quotes`, `@mentions`.
- **Reactions System**: Add reactions (👍, ❤️, 🔥, 😂, 🚀, 🎮, ⚡, 🎉) with real-time synchronized user counters.
- **File & Image Attachments**: Drag-and-drop or upload images with instant inline previews.
- **Typing Indicator**: Synchronized real-time "*User is typing...*" bar.
- **Message Quoting / Replying**: Click reply on any message to reference it with an active reply banner.

### 🔊 Discord Soundboard & Synthesized Audio FX
- **Synthesized Web Audio API FX** (zero external assets needed):
  - Voice Connect chime (ascending two-tone chime)
  - Voice Leave chime (descending two-tone chime)
  - Mute & Unmute clicks
  - Deafen & Undeafen tones
  - Incoming Call Ringtone
  - Discord Message Ping
- **Interactive Soundboard**: Broadcasts Airhorn, Quack, Ba-dum-tss, GG, and Tada sounds to all server participants.

### 🎥 WebRTC 1080p 30/60 FPS Screen & Voice Streaming
- **Krisp-Style Web Audio DSP**:
  - High-pass filter (90Hz) cuts desk rumble & mechanical keyboard bass.
  - Low-pass filter (7200Hz) cuts electronic hiss and white noise.
  - Peaking notch filter (3200Hz) dampens keyboard click clatter.
  - Dynamics compressor normalizes speech.
  - Smart Noise Gate (VAD) opens only when speaking.
- **High-Bitrate Screen Sharing**: Presets for 720p, 1080p, and Source at 30 FPS or 60 FPS.
- **Window Modes**: OS Fullscreen, In-Window Borderless Maximize, and Dynamic Stream Pinning.

### ⚙️ Full Discord Settings Modal & Themes
- **My Account**: Customize display name, avatar emoji, and custom status text.
- **Theme Switcher**:
  - 🌙 **Dark (Default)**: Classic Discord dark palette (`#313338`, `#2b2d31`, `#1e1f22`).
  - 🖤 **Midnight (AMOLED Black)**: Pure black `#000000` for OLED displays.
  - ☀️ **Light**: Clean Discord light theme.
- **Voice & Video Settings**: Live microphone VU meter for testing voice sensitivity and Krisp noise cancellation toggle.

---

## 🚀 Quick Start (Running Live)

```bash
# Install dependencies
npm install

# Start live server
node server.js
```

The server runs live at:
- **Local:** `http://localhost:3000`
- **Network (LAN):** `http://0.0.0.0:3000` (accessible across your Wi-Fi by replacing `0.0.0.0` with your machine's local IP address, e.g. `http://192.168.1.50:3000`).

---

## 🌐 Free 24/7 Cloud Deployment (Render / Railway)

1. Fork or push to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: 🚀 Full Discord Web Edition with multi-servers, DMs, 1080p screen share, and Krisp DSP"
   git push origin master
   ```
2. Go to **[Render.com](https://render.com)** and create a new **Web Service**.
3. Select your repository `discord-lite-room`.
4. Configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
5. Click **Deploy Web Service**. You will receive a permanent HTTPS link (e.g., `https://discord-full.onrender.com`) that works anywhere in the world!
