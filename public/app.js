// Free STUN Configuration for WebRTC P2P
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const socket = io();
let localStream = null;
let localScreenStream = null;
let currentUsername = '';
let myId = '';
const peers = new Map(); // socketId -> RTCPeerConnection
const remoteStreams = new Map(); // socketId -> MediaStream
const participants = new Map(); // socketId -> userInfo

// DOM Elements
const joinModal = document.getElementById('join-modal');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const participantsContainer = document.getElementById('participants-container');
const userCountBadge = document.getElementById('user-count-badge');
const selfAvatar = document.getElementById('self-avatar');
const selfUsername = document.getElementById('self-username');
const videoGrid = document.getElementById('video-grid');
const chatSidebar = document.getElementById('chat-sidebar');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

// Controls
const btnMic = document.getElementById('btn-mic');
const btnCam = document.getElementById('btn-cam');
const btnScreen = document.getElementById('btn-screen');
const btnKrisp = document.getElementById('btn-krisp');
const btnChatToggle = document.getElementById('btn-chat-toggle');
const btnQualityMenu = document.getElementById('btn-quality-menu');
const qualityPopover = document.getElementById('quality-popover');
const qualityBadgeText = document.querySelector('.quality-badge-text');

let isMuted = false;
let isCamOff = false;
let isScreenSharing = false;

// Noise Suppression & Anti-Chiado State (Krisp DSP)
let isNoiseSuppressionActive = true;
let audioCtx = null;
let micSourceNode = null;
let noiseGateGain = null;
let noiseAnalyser = null;
let gateCheckInterval = null;
let lastVoiceTime = 0;
const GATE_THRESHOLD = 0.024; // Noise/keyboard threshold
const GATE_HANGOVER_MS = 320; // Keep gate open 320ms after speaking to avoid clipping ends of words

function showToast(text) {
  let toast = document.getElementById('call-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'call-toast';
    toast.className = 'call-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2800);
}

function setupAudioDSP(rawStream) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return rawStream;

    audioCtx = new AudioContextClass();
    micSourceNode = audioCtx.createMediaStreamSource(rawStream);

    // 1. High-pass filter: Cuts desk rumble & mechanical keyboard bottom-out bass (< 90Hz)
    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 90;
    highPass.Q.value = 0.7;

    // 2. Low-pass filter: Cuts high-frequency white noise & electronic hiss (> 7200Hz)
    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 7200;
    lowPass.Q.value = 0.7;

    // 3. Peaking notch filter: Softens harsh mechanical keyboard switch clatter (~3200Hz)
    const keyFilter = audioCtx.createBiquadFilter();
    keyFilter.type = 'peaking';
    keyFilter.frequency.value = 3200;
    keyFilter.Q.value = 1.3;
    keyFilter.gain.value = -6.0;

    // 4. Dynamics compressor: Normalizes voice and stops quiet ambient noise amplification
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 25;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // 5. Smart Noise Gate (VAD) Gain Node
    noiseGateGain = audioCtx.createGain();
    noiseGateGain.gain.setValueAtTime(1, audioCtx.currentTime);

    // 6. Analyser to measure RMS speech volume
    noiseAnalyser = audioCtx.createAnalyser();
    noiseAnalyser.fftSize = 512;

    // Connect DSP Chain:
    // mic -> highPass -> lowPass -> keyFilter -> compressor -> noiseGateGain -> destination
    micSourceNode.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(keyFilter);
    keyFilter.connect(compressor);
    compressor.connect(noiseGateGain);
    compressor.connect(noiseAnalyser); // Read pre-gate volume for VAD calculation

    const dest = audioCtx.createMediaStreamDestination();
    noiseGateGain.connect(dest);

    startNoiseGateLoop();

    return dest.stream;
  } catch (err) {
    console.warn('Audio DSP setup failed, using raw mic:', err);
    return rawStream;
  }
}

function startNoiseGateLoop() {
  if (gateCheckInterval) clearInterval(gateCheckInterval);
  const dataArray = new Uint8Array(noiseAnalyser.frequencyBinCount);

  gateCheckInterval = setInterval(() => {
    if (!isNoiseSuppressionActive || !noiseGateGain || !noiseAnalyser || !audioCtx) {
      if (noiseGateGain && audioCtx) {
        noiseGateGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.02);
      }
      return;
    }

    noiseAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const now = performance.now();

    if (rms > GATE_THRESHOLD) {
      lastVoiceTime = now;
      // User is speaking: Open gate smoothly in 15ms
      noiseGateGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.015);
      highlightSelfSpeaking(true);
    } else {
      // User not speaking: Silence keyboards, fan, and hiss after handover
      if (now - lastVoiceTime > GATE_HANGOVER_MS) {
        noiseGateGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.035);
        highlightSelfSpeaking(false);
      }
    }
  }, 25);
}

function highlightSelfSpeaking(isSpeaking) {
  const avatarEl = document.getElementById('self-avatar');
  if (avatarEl) {
    if (isSpeaking && !isMuted) {
      avatarEl.classList.add('speaking');
    } else {
      avatarEl.classList.remove('speaking');
    }
  }
}

// Stream Quality Presets (Default: 1080p @ 30 FPS)
let selectedResolution = '1080'; // '720', '1080', 'source'
let selectedFps = 30; // 30 or 60

// Extract room ID from URL (e.g. ?room=gaming or #gaming or default to 'main-room')
const urlParams = new URLSearchParams(window.location.search);
const currentRoomId = urlParams.get('room') || window.location.hash.replace('#', '') || 'main-room';

// Auto re-join room if socket reconnects after network drop or server restart
socket.on('connect', () => {
  console.log('[Socket] Connected/Reconnected:', socket.id);
  if (currentUsername) {
    socket.emit('join-room', { username: currentUsername, room: currentRoomId });
  }
});

// 1. Join Room Flow
joinBtn.addEventListener('click', joinRoom);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});

if (btnKrisp) {
  btnKrisp.addEventListener('click', () => {
    isNoiseSuppressionActive = !isNoiseSuppressionActive;
    btnKrisp.classList.toggle('active', isNoiseSuppressionActive);
    if (isNoiseSuppressionActive) {
      showToast('✨ Anti-Chiado ATIVADO: Teclados, ruídos e chiados bloqueados');
    } else {
      showToast('⚠️ Anti-Chiado DESATIVADO: Microfone bruto transmitido');
    }
  });
}

async function joinRoom() {
  const name = usernameInput.value.trim();
  if (!name) return;
  currentUsername = name;
  joinModal.style.display = 'none';

  // Update Footer UI & Header
  selfUsername.textContent = currentUsername;
  selfAvatar.textContent = currentUsername.charAt(0).toUpperCase();
  const roomTitleEl = document.querySelector('.guild-title h3');
  if (roomTitleEl) roomTitleEl.textContent = `Call: ${currentRoomId.toUpperCase()}`;
  const brandTagEl = document.querySelector('.brand-tag');
  if (brandTagEl) brandTagEl.textContent = `⚡ CALL (${currentRoomId.toUpperCase()})`;

  try {
    // Acquire local mic with echo cancellation and noise suppression
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    localStream = setupAudioDSP(rawStream);
  } catch (err) {
    console.warn('Microphone access denied or unavailable:', err);
    localStream = new MediaStream();
  }

  isCamOff = true;
  btnCam.classList.add('active');
  btnCam.querySelector('.btn-label').textContent = 'Start Cam';

  addLocalVideoTile();

  // Connect socket room with isolated room ID!
  socket.emit('join-room', { username: currentUsername, room: currentRoomId });
}

let pinnedTileId = null; // Currently focused/pinned stream
const userAudioElements = new Map(); // socketId -> <video> element for volume control
const userMuteStates = new Map(); // socketId -> boolean

// 2. Local Video Tile
function addLocalVideoTile() {
  const existing = document.getElementById('tile-self');
  if (existing) existing.remove();

  const tile = createVideoTile('tile-self', currentUsername + ' (You)', localStream, true, false, 'self');
  videoGrid.appendChild(tile);
  updateGridLayout();
}

function createVideoTile(id, label, stream, isMutedAudio = false, isScreen = false, socketId = null) {
  const tile = document.createElement('div');
  tile.className = `video-tile ${isScreen ? 'screen-tile' : ''} ${pinnedTileId === id ? 'pinned-focus' : ''}`;
  tile.id = id;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isMutedAudio; // Always mute self to avoid echo
  if (stream) video.srcObject = stream;
  if (socketId && socketId !== 'self') {
    userAudioElements.set(socketId, video);
  }

  // Top Actions: Maximize (Borderless In-Window) & Fullscreen & Pin
  const topActions = document.createElement('div');
  topActions.className = 'tile-top-actions';

  // Maximize (Borderless in-window)
  const maxBtn = document.createElement('button');
  maxBtn.className = 'tile-action-btn';
  maxBtn.innerHTML = `🗖 <span>Maximize</span>`;
  maxBtn.title = 'Maximize inside browser window (borderless)';
  maxBtn.onclick = (e) => {
    e.stopPropagation();
    tile.classList.toggle('borderless-maximized');
    maxBtn.innerHTML = tile.classList.contains('borderless-maximized') ? `🗕 <span>Restore</span>` : `🗖 <span>Maximize</span>`;
  };
  topActions.appendChild(maxBtn);

  // Fullscreen (OS Monitor Fullscreen)
  const fullBtn = document.createElement('button');
  fullBtn.className = 'tile-action-btn';
  fullBtn.innerHTML = `⛶ <span>Fullscreen</span>`;
  fullBtn.title = 'Full screen on your monitor (Press ESC to exit)';
  fullBtn.onclick = (e) => {
    e.stopPropagation();
    if (tile.requestFullscreen) {
      tile.requestFullscreen();
    } else if (tile.webkitRequestFullscreen) {
      tile.webkitRequestFullscreen();
    }
  };
  topActions.appendChild(fullBtn);

  const pinBtn = document.createElement('button');
  pinBtn.className = `tile-action-btn ${pinnedTileId === id ? 'pinned' : ''}`;
  pinBtn.innerHTML = `📌 <span>${pinnedTileId === id ? 'Unpin' : 'Pin'}</span>`;
  pinBtn.onclick = () => togglePinStream(id);
  topActions.appendChild(pinBtn);

  // Bottom Overlay Info & Controls
  const overlay = document.createElement('div');
  overlay.className = 'tile-overlay';
  
  const userInfo = document.createElement('div');
  userInfo.className = 'tile-user-info';
  const qualityBadge = isScreen ? `<span class="stream-hd-badge">✨ 1080p 30fps HD</span>` : '';
  userInfo.innerHTML = `<span>${label}</span> ${qualityBadge}`;
  overlay.appendChild(userInfo);

  // If this tile is a remote user, add individual Volume Slider & Mute button
  if (socketId && socketId !== 'self' && !isScreen) {
    const volCtrl = document.createElement('div');
    volCtrl.className = 'tile-volume-control';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'mute-user-btn';
    muteBtn.title = 'Mute this user for you';
    muteBtn.textContent = userMuteStates.get(socketId) ? '🔇' : '🔊';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = userMuteStates.get(socketId) ? '0' : '100';
    slider.className = 'volume-slider';
    slider.title = 'Adjust user volume';

    muteBtn.onclick = () => {
      const isMuted = !userMuteStates.get(socketId);
      userMuteStates.set(socketId, isMuted);
      video.muted = isMuted;
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
      slider.value = isMuted ? '0' : (video.volume * 100).toString();
      renderParticipants();
    };

    slider.oninput = (e) => {
      const val = parseFloat(e.target.value) / 100;
      video.volume = val;
      if (val === 0) {
        userMuteStates.set(socketId, true);
        video.muted = true;
        muteBtn.textContent = '🔇';
      } else {
        userMuteStates.set(socketId, false);
        video.muted = false;
        muteBtn.textContent = '🔊';
      }
      renderParticipants();
    };

    volCtrl.appendChild(muteBtn);
    volCtrl.appendChild(slider);
    overlay.appendChild(volCtrl);
  }

  tile.appendChild(video);
  tile.appendChild(topActions);
  tile.appendChild(overlay);

  const avatar = document.createElement('div');
  avatar.className = 'avatar-placeholder';
  avatar.textContent = label.charAt(0).toUpperCase();
  tile.appendChild(avatar);

  // If no video track or disabled, show avatar circle and mark no-camera
  const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  if (!hasVideo && !isScreen) {
    tile.classList.add('no-camera');
    avatar.style.display = 'flex';
    video.style.display = 'none';
  } else {
    tile.classList.remove('no-camera');
    avatar.style.display = 'none';
    video.style.display = 'block';
  }

  return tile;
}

// Layout Mode Switcher logic
const layoutModeSelect = document.getElementById('layout-mode-select');
if (layoutModeSelect) {
  layoutModeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    videoGrid.classList.remove('mode-stream-only', 'mode-stream-cams-only', 'mode-hide-no-cam');
    if (mode === 'stream-only') {
      videoGrid.classList.add('mode-stream-only');
    } else if (mode === 'stream-cams-only') {
      videoGrid.classList.add('mode-stream-cams-only');
    } else if (mode === 'hide-no-cam') {
      videoGrid.classList.add('mode-hide-no-cam');
    }
  });
}

function togglePinStream(tileId) {
  if (pinnedTileId === tileId) {
    pinnedTileId = null;
  } else {
    pinnedTileId = tileId;
  }
  
  document.querySelectorAll('.video-tile').forEach(t => {
    if (t.id === pinnedTileId) {
      t.classList.add('pinned-focus');
      const btn = t.querySelector('.tile-action-btn');
      if (btn) btn.innerHTML = `📌 <span>Unpin</span>`;
    } else {
      t.classList.remove('pinned-focus');
      const btn = t.querySelector('.tile-action-btn');
      if (btn) btn.innerHTML = `📌 <span>Pin Stream</span>`;
    }
  });

  updateGridLayout();
}

// 3. Dynamic Remote Stream UI Manager
function refreshRemoteStreamTile(targetSocketId) {
  const user = participants.get(targetSocketId);
  const userName = user ? user.username : 'Friend';
  const isScreen = user ? (user.isScreenSharing || false) : false;
  const remoteStream = remoteStreams.get(targetSocketId);

  let tile = document.getElementById(`tile-${targetSocketId}`);
  if (!tile) {
    tile = createVideoTile(`tile-${targetSocketId}`, userName, remoteStream, false, isScreen, targetSocketId);
    videoGrid.appendChild(tile);
  }

  const video = tile.querySelector('video');
  const avatar = tile.querySelector('.avatar-placeholder');
  const hasVideoTrack = remoteStream && remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  if (isScreen || hasVideoTrack) {
    tile.classList.remove('no-camera');
    if (isScreen) {
      tile.classList.add('screen-tile');
      pinnedTileId = `tile-${targetSocketId}`;
    }
    if (avatar) avatar.style.display = 'none';
    if (video) {
      video.style.display = 'block';
      if (remoteStream && video.srcObject !== remoteStream) {
        video.srcObject = remoteStream;
      }
      video.muted = false;
      video.play().catch(() => {
        // Fallback: If browser blocks audio autoplay, mute video so visual stream renders immediately!
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  } else {
    tile.classList.remove('screen-tile');
    tile.classList.add('no-camera');
    if (pinnedTileId === `tile-${targetSocketId}`) pinnedTileId = null;
    if (avatar) avatar.style.display = 'flex';
    if (video) video.style.display = 'none';
  }

  // Update header and Live Stream badge
  const infoEl = tile.querySelector('.tile-user-info');
  if (infoEl) {
    const qualityBadge = isScreen ? `<span class="stream-hd-badge">✨ LIVE STREAM</span>` : '';
    infoEl.innerHTML = `<span>${userName}</span> ${qualityBadge}`;
  }

  updateGridLayout();
}

// 4. Socket & Signaling Handlers
socket.on('room-joined', async ({ self, participants: existingList }) => {
  myId = self.id;
  updateParticipantList(existingList);

  // Connect to every existing room member
  for (const p of existingList) {
    await createPeerConnection(p.id, true);
    if (p.isScreenSharing) {
      refreshRemoteStreamTile(p.id);
    }
  }
});

socket.on('user-connected', async (user) => {
  participants.set(user.id, user);
  renderParticipants();
  appendSystemMessage(`${user.username} entered the room.`);

  if (!peers.has(user.id)) {
    await createPeerConnection(user.id, false);
  }
  if (user.isScreenSharing) {
    refreshRemoteStreamTile(user.id);
  }
});

socket.on('signal-offer', async ({ callerId, sdp }) => {
  let pc = peers.get(callerId);
  if (!pc) {
    pc = await createPeerConnection(callerId, false);
  }
  try {
    if (pc.signalingState !== 'stable') {
      await Promise.all([
        pc.setLocalDescription({ type: 'rollback' }),
        pc.setRemoteDescription(new RTCSessionDescription(sdp))
      ]);
    } else {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal-answer', { targetId: callerId, sdp: answer });

    // Live update tile with incoming stream
    refreshRemoteStreamTile(callerId);
  } catch (err) {
    console.error('Error handling signal-offer:', err);
  }
});

socket.on('signal-answer', async ({ callerId, sdp }) => {
  const pc = peers.get(callerId);
  if (pc && pc.signalingState === 'have-local-offer') {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      refreshRemoteStreamTile(callerId);
    } catch (err) {
      console.error('Error setting remote description from answer:', err);
    }
  }
});

socket.on('ice-candidate', async ({ senderId, candidate }) => {
  const pc = peers.get(senderId);
  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  }
});

socket.on('user-state-updated', (data) => {
  const p = participants.get(data.id);
  if (p) {
    Object.assign(p, data);
    renderParticipants();
    refreshRemoteStreamTile(data.id);
  }
});

socket.on('stream-started', async ({ id, username }) => {
  const p = participants.get(id);
  if (p) p.isScreenSharing = true;
  renderParticipants();

  if (!peers.has(id)) {
    await createPeerConnection(id, false);
  }
  refreshRemoteStreamTile(id);
  appendSystemMessage(`📺 ${username} started sharing screen.`);
});

socket.on('stream-stopped', ({ id, username }) => {
  const p = participants.get(id);
  if (p) p.isScreenSharing = false;
  renderParticipants();
  refreshRemoteStreamTile(id);
  appendSystemMessage(`📺 ${username} stopped sharing screen.`);
});

socket.on('user-disconnected', ({ id, username }) => {
  if (peers.has(id)) {
    peers.get(id).close();
    peers.delete(id);
  }
  remoteStreams.delete(id);
  participants.delete(id);
  userMuteStates.delete(id);
  userAudioElements.delete(id);
  
  const tile = document.getElementById(`tile-${id}`);
  if (tile) tile.remove();
  const screenTile = document.getElementById(`screen-tile-${id}`);
  if (screenTile) screenTile.remove();
  if (pinnedTileId === `tile-${id}` || pinnedTileId === `screen-tile-${id}`) {
    pinnedTileId = null;
  }

  renderParticipants();
  updateGridLayout();
  appendSystemMessage(`${username} left.`);
});

// 5. Peer Connection Management
async function createPeerConnection(targetSocketId, isInitiator) {
  if (peers.has(targetSocketId)) return peers.get(targetSocketId);

  const pc = new RTCPeerConnection(rtcConfig);
  peers.set(targetSocketId, pc);

  // Attach local microphone audio track directly to the peer connection
  if (localStream) {
    const micTrack = localStream.getAudioTracks()[0];
    if (micTrack) {
      pc.addTrack(micTrack, localStream);
    }
  }

  // Attach active video track (screen or camera)
  const currentVideoTrack = (localScreenStream && localScreenStream.getVideoTracks()[0]) || 
                            (localStream && !isCamOff && localStream.getVideoTracks()[0]);
  if (currentVideoTrack) {
    pc.addTrack(currentVideoTrack, localScreenStream || localStream);
  } else {
    // Ensure video transceiver is ready to receive incoming remote stream
    pc.addTransceiver('video', { direction: 'sendrecv' });
  }

  // ICE Candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        targetId: targetSocketId,
        candidate: event.candidate
      });
    }
  };

  // Remote Stream Received
  pc.ontrack = (event) => {
    let remoteStream = remoteStreams.get(targetSocketId);
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteStreams.set(targetSocketId, remoteStream);
    }
    
    // Replace track of same kind if already exists
    const existing = remoteStream.getTracks().find(t => t.kind === event.track.kind);
    if (existing) remoteStream.removeTrack(existing);
    remoteStream.addTrack(event.track);

    event.track.onunmute = () => {
      refreshRemoteStreamTile(targetSocketId);
    };
    event.track.onended = () => {
      refreshRemoteStreamTile(targetSocketId);
    };

    refreshRemoteStreamTile(targetSocketId);
  };

  if (isInitiator) {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal-offer', { targetId: targetSocketId, sdp: offer });
    } catch (e) {
      console.warn('Initiator offer error:', e);
    }
  }

  return pc;
}

// 5. Screen Sharing (Transmissão de Tela) & Stream Quality Controls
btnScreen.addEventListener('click', toggleScreenShare);

function getQualityConstraints() {
  let widthConstraint = { ideal: 1920, max: 1920 };
  let heightConstraint = { ideal: 1080, max: 1080 };
  let bitrate = 5000000; // 5.0 Mbps for crisp 1080p 30fps streaming

  if (selectedResolution === '720') {
    widthConstraint = { ideal: 1280, max: 1280 };
    heightConstraint = { ideal: 720, max: 720 };
    bitrate = selectedFps === 60 ? 4000000 : 2500000;
  } else if (selectedResolution === '1080') {
    widthConstraint = { ideal: 1920, max: 1920 };
    heightConstraint = { ideal: 1080, max: 1080 };
    bitrate = selectedFps === 60 ? 7000000 : 5000000;
  } else if (selectedResolution === 'source') {
    widthConstraint = { ideal: 2560, max: 3840 };
    heightConstraint = { ideal: 1440, max: 2160 };
    bitrate = selectedFps === 60 ? 8000000 : 6000000;
  }

  return {
    video: {
      cursor: 'always',
      width: widthConstraint,
      height: heightConstraint,
      frameRate: { ideal: selectedFps, max: selectedFps }
    },
    audio: true,
    bitrate: bitrate,
    fps: selectedFps
  };
}

async function toggleScreenShare() {
  if (isScreenSharing) {
    stopScreenShare();
  } else {
    try {
      const q = getQualityConstraints();
      localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: q.video,
        audio: q.audio
      });

      // Set content hint to 'detail' for ultra-crisp 1080p streaming
      const screenTrack = localScreenStream.getVideoTracks()[0];
      if (screenTrack && 'contentHint' in screenTrack) {
        screenTrack.contentHint = 'detail';
      }

      isScreenSharing = true;
      btnScreen.classList.add('sharing');
      btnScreen.querySelector('.btn-label').textContent = 'Stop Sharing';

      // Show local screen share tile in stage
      const selfScreenTile = createVideoTile('screen-tile-self', `${currentUsername}'s Screen`, localScreenStream, true, true, 'self-screen');
      videoGrid.prepend(selfScreenTile);
      pinnedTileId = 'screen-tile-self';
      updateGridLayout();

      // Ensure local preview video is playing
      const selfVideo = selfScreenTile.querySelector('video');
      if (selfVideo) {
        selfVideo.srcObject = localScreenStream;
        selfVideo.play().catch(() => {});
      }

      // Broadcast screen track to every peer connection with 1080p 30fps bitrate tuning
      peers.forEach(async (pc, targetId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
          tuneBitrate(videoSender, q.bitrate, q.fps);
        } else {
          const sender = pc.addTrack(screenTrack, localScreenStream);
          tuneBitrate(sender, q.bitrate, q.fps);
        }
        // Always renegotiate offer so the target user receives the video stream immediately
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('signal-offer', { targetId, sdp: offer });
        } catch (e) {
          console.warn('Renegotiation error:', e);
        }
      });

      // Handle user stopping screen share via browser popup
      screenTrack.onended = () => stopScreenShare();

      socket.emit('media-state-change', { isScreenSharing: true });
      socket.emit('stream-started', { isScreenSharing: true });
    } catch (err) {
      console.warn('Screen share cancelled/denied:', err);
    }
  }
}

async function tuneBitrate(sender, maxBitrate = 5000000, maxFps = 30) {
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }
    parameters.encodings[0].maxBitrate = maxBitrate;
    parameters.encodings[0].maxFramerate = maxFps;
    parameters.encodings[0].scaleResolutionDownBy = 1.0;
    await sender.setParameters(parameters);
  } catch (e) {
    console.warn('Could not set bitrate parameters:', e);
  }
}

function stopScreenShare() {
  if (!isScreenSharing) return;
  isScreenSharing = false;
  btnScreen.classList.remove('sharing');
  btnScreen.querySelector('.btn-label').textContent = 'Share Screen';

  if (localScreenStream) {
    localScreenStream.getTracks().forEach(t => t.stop());
    localScreenStream = null;
  }

  const selfScreenTile = document.getElementById('screen-tile-self');
  if (selfScreenTile) selfScreenTile.remove();
  if (pinnedTileId === 'screen-tile-self') pinnedTileId = null;

  // Revert peers to camera track or null
  const camTrack = (localStream && !isCamOff) ? localStream.getVideoTracks()[0] : null;
  peers.forEach(async (pc, targetId) => {
    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    if (videoSender) {
      if (camTrack) {
        await videoSender.replaceTrack(camTrack);
      } else {
        await videoSender.replaceTrack(null);
      }
    }
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal-offer', { targetId, sdp: offer });
    } catch (e) {
      console.warn('Stop screen renegotiation error:', e);
    }
  });

  socket.emit('media-state-change', { isScreenSharing: false });
  socket.emit('stream-stopped', {});
  updateGridLayout();
}

// Stream Quality Selector Controls & Popover
if (btnQualityMenu && qualityPopover) {
  btnQualityMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    qualityPopover.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!qualityPopover.contains(e.target) && !btnQualityMenu.contains(e.target)) {
      qualityPopover.classList.add('hidden');
    }
  });

  // Resolution selection
  document.querySelectorAll('#res-options .opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#res-options .opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedResolution = btn.getAttribute('data-res');
      updateQualityBadge();
      if (isScreenSharing) {
        applyQualityConstraintsToActiveScreen();
      }
    });
  });

  // FPS selection
  document.querySelectorAll('#fps-options .opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fps-options .opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFps = parseInt(btn.getAttribute('data-fps'), 10);
      updateQualityBadge();
      if (isScreenSharing) {
        applyQualityConstraintsToActiveScreen();
      }
    });
  });
}

function updateQualityBadge() {
  const text = `${selectedResolution === 'source' ? 'Source' : selectedResolution + 'p'} ${selectedFps}fps`;
  if (qualityBadgeText) {
    qualityBadgeText.textContent = text;
  }
}

async function applyQualityConstraintsToActiveScreen() {
  if (!localScreenStream) return;
  const videoTrack = localScreenStream.getVideoTracks()[0];
  if (!videoTrack) return;

  const q = getQualityConstraints();
  try {
    await videoTrack.applyConstraints({
      width: q.video.width,
      height: q.video.height,
      frameRate: q.video.frameRate
    });
  } catch (err) {
    console.warn('Could not apply constraints directly to existing track:', err);
  }

  // Update sender bitrates & framerates
  peers.forEach(pc => {
    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    if (videoSender) {
      tuneBitrate(videoSender, q.bitrate, q.fps);
    }
  });
}

// 6. Mic / Camera Toggles
btnMic.addEventListener('click', () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    isMuted = !isMuted;
    audioTrack.enabled = !isMuted;
    btnMic.classList.toggle('active', isMuted);
    btnMic.querySelector('.btn-label').textContent = isMuted ? 'Unmute' : 'Mute';
    socket.emit('media-state-change', { isMuted });
  }
});

btnCam.addEventListener('click', async () => {
  if (isCamOff) {
    // Turning camera ON (1080p 30fps)
    try {
      if (!localStream) localStream = new MediaStream();
      let videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          }
        });
        videoTrack = camStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);
        // Add to peer connections
        peers.forEach((pc) => {
          const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
            tuneBitrate(videoSender, 3500000, 30);
          } else {
            const sender = pc.addTrack(videoTrack, localStream);
            tuneBitrate(sender, 3500000, 30);
          }
        });
      }
      videoTrack.enabled = true;
      isCamOff = false;
      btnCam.classList.remove('active');
      btnCam.querySelector('.btn-label').textContent = 'Camera';
      addLocalVideoTile();
      socket.emit('media-state-change', { isCameraOn: true });
    } catch (err) {
      console.warn('Could not turn on camera:', err);
    }
  } else {
    // Turning camera OFF
    const videoTrack = localStream ? localStream.getVideoTracks()[0] : null;
    if (videoTrack) {
      videoTrack.enabled = false;
    }
    isCamOff = true;
    btnCam.classList.add('active');
    btnCam.querySelector('.btn-label').textContent = 'Start Cam';
    addLocalVideoTile();
    socket.emit('media-state-change', { isCameraOn: false });
  }
});

btnChatToggle.addEventListener('click', () => {
  chatSidebar.classList.toggle('hidden');
});

// 7. Dynamic Layout & Pinning
function updateGridLayout() {
  const hasScreen = document.querySelector('.screen-tile');
  if (hasScreen || pinnedTileId) {
    videoGrid.classList.add('spotlight-mode');
  } else {
    videoGrid.classList.remove('spotlight-mode');
  }
}

// 8. Participants UI
function updateParticipantList(list) {
  participants.clear();
  list.forEach(p => participants.set(p.id, p));
  renderParticipants();
}

function renderParticipants() {
  participantsContainer.innerHTML = '';
  const totalCount = participants.size + 1;
  userCountBadge.textContent = totalCount;

  // Render Self
  const selfDiv = createParticipantRow(currentUsername, isScreenSharing, isMuted, true, 'self');
  participantsContainer.appendChild(selfDiv);

  // Render Others
  participants.forEach((user) => {
    const isUserLocallyMuted = userMuteStates.get(user.id) || false;
    const row = createParticipantRow(user.username, user.isScreenSharing, user.isMuted, false, user.id, isUserLocallyMuted);
    participantsContainer.appendChild(row);
  });
}

function createParticipantRow(name, screenSharing, muted, isSelf, socketId, isLocallyMuted = false) {
  const div = document.createElement('div');
  div.className = 'participant-row';
  
  let actionsHtml = '';
  if (!isSelf && socketId) {
    actionsHtml = `
      <div class="participant-actions">
        <button class="mute-user-btn" title="${isLocallyMuted ? 'Unmute' : 'Mute'} user" onclick="toggleMuteUser('${socketId}')">
          ${isLocallyMuted ? '🔇' : '🔊'}
        </button>
        <button class="pin-user-btn ${pinnedTileId === 'tile-' + socketId ? 'active' : ''}" title="Focus user" onclick="togglePinStream('tile-${socketId}')">
          📌
        </button>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="participant-avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="participant-name">${name} ${isSelf ? '(You)' : ''}</div>
    <div class="participant-badges">
      ${screenSharing ? '<span class="screen-badge">SCREEN</span>' : ''}
      ${muted ? '<span>[Muted]</span>' : ''}
    </div>
    ${actionsHtml}
  `;
  return div;
}

window.toggleMuteUser = function(socketId) {
  const video = userAudioElements.get(socketId);
  const isMuted = !userMuteStates.get(socketId);
  userMuteStates.set(socketId, isMuted);
  if (video) {
    video.muted = isMuted;
  }
  // Also sync tile slider
  const tile = document.getElementById(`tile-${socketId}`);
  if (tile) {
    const muteBtn = tile.querySelector('.mute-user-btn');
    const slider = tile.querySelector('.volume-slider');
    if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';
    if (slider) slider.value = isMuted ? '0' : '100';
  }
  renderParticipants();
};

// 9. Real-time Chat
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('send-message', { message: text });
    chatInput.value = '';
  }
});

socket.on('new-message', ({ sender, text, timestamp }) => {
  const div = document.createElement('div');
  div.className = 'chat-item';
  div.innerHTML = `
    <div class="chat-meta">
      <span class="chat-author">${sender}</span>
      <span class="chat-time">${timestamp}</span>
    </div>
    <div class="chat-text">${escapeHtml(text)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(string) {
  const p = document.createElement('p');
  p.textContent = string;
  return p.innerHTML;
}
