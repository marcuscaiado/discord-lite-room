// ==========================================================================
// DISCORD FULL WEB EDITION - CLIENT ENGINE
// High-Fidelity Multi-Server, WebRTC Voice & 1080p Screen Streaming, Rich Chat
// ==========================================================================

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

const socket = io();

// --------------------------------------------------------------------------
// Core State
// --------------------------------------------------------------------------
let myUserInfo = null;
let currentServerId = 's-doscria';
let currentTextChannelId = 'c-general';
let currentVoiceChannelId = null; // Stays active in background even when switching servers/channels
let currentDmRecipientId = null;
let activeView = 'chat'; // 'chat' | 'stage' | 'friends'
let replyingToMessage = null;

let servers = [];
const channelMessages = {}; // channelId -> [messages]
const directMessages = {};  // convId -> [messages]
const allUsers = new Map(); // socketId -> userInfo
const voiceMembers = new Map(); // channelId -> [socketIds]

// WebRTC & Media State
let localAudioStream = null;
let localVideoStream = null;
let localScreenStream = null;
const peers = new Map(); // socketId -> RTCPeerConnection
const remoteStreams = new Map(); // socketId -> MediaStream
const userAudioElements = new Map(); // socketId -> audio/video element

let isMuted = false;
let isDeafened = false;
let isCameraOn = false;
let isScreenSharing = false;
let isKrispActive = true;
let streamResolution = '1080';
let streamFps = '30';
let soundVolume = 0.8;

// Audio DSP & Synthesis
let audioCtx = null;
let micSourceNode = null;
let noiseGateGain = null;
let noiseAnalyser = null;
let gateInterval = null;
const GATE_THRESHOLD = 0.022;
const GATE_HANGOVER_MS = 300;
let lastVoiceTime = 0;

// --------------------------------------------------------------------------
// DOM Selectors
// --------------------------------------------------------------------------
const joinModal = document.getElementById('join-modal');
const usernameInput = document.getElementById('username-input');
const customStatusInput = document.getElementById('custom-status-input');
const joinBtn = document.getElementById('join-btn');
const avatarChoices = document.querySelectorAll('.avatar-opt');

const guildList = document.getElementById('guild-list');
const btnGuildHome = document.getElementById('btn-guild-home');
const btnAddServer = document.getElementById('btn-add-server');
const btnExploreServers = document.getElementById('btn-explore-servers');

const serverHeader = document.getElementById('server-header');
const serverTitleText = document.getElementById('server-title-text');
const serverDropdownMenu = document.getElementById('server-dropdown-menu');
const channelsContainer = document.getElementById('channels-container');
const dmHeader = document.getElementById('dm-header');
const dmNavContainer = document.getElementById('dm-nav-container');
const dmConversationsList = document.getElementById('dm-conversations-list');
const btnFriendsTab = document.getElementById('btn-friends-tab');
const onlineFriendsCount = document.getElementById('online-friends-count');

const voiceStatusDock = document.getElementById('voice-status-dock');
const connectedVoiceName = document.getElementById('connected-voice-name');
const btnVoiceDisconnect = document.getElementById('btn-voice-disconnect');

const selfAvatar = document.getElementById('self-avatar');
const selfUsername = document.getElementById('self-username');
const selfTag = document.getElementById('self-tag');
const selfStatusIndicator = document.getElementById('self-status-indicator');
const dockBtnMic = document.getElementById('dock-btn-mic');
const dockBtnDeafen = document.getElementById('dock-btn-deafen');
const dockBtnSettings = document.getElementById('dock-btn-settings');
const dockAvatarBtn = document.getElementById('dock-avatar-btn');

const topBarIcon = document.getElementById('top-bar-icon');
const topBarTitle = document.getElementById('top-bar-title');
const topBarTopic = document.getElementById('top-bar-topic');
const btnCopyInvite = document.getElementById('btn-copy-invite');
const btnToggleVoiceStage = document.getElementById('btn-toggle-voice-stage');
const btnToggleMembers = document.getElementById('btn-toggle-members');
const membersSidebar = document.getElementById('members-sidebar');
const membersContainer = document.getElementById('members-container');
const channelSearchInput = document.getElementById('channel-search-input');

const viewChat = document.getElementById('view-chat');
const viewStage = document.getElementById('view-stage');
const viewFriends = document.getElementById('view-friends');

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const fileUploadInput = document.getElementById('file-upload-input');
const replyBanner = document.getElementById('reply-banner');
const replyTargetUser = document.getElementById('reply-target-user');
const btnCancelReply = document.getElementById('btn-cancel-reply');
const typingIndicator = document.getElementById('typing-indicator');

const btnOpenSoundboard = document.getElementById('btn-open-soundboard');
const soundboardPopover = document.getElementById('soundboard-popover');
const btnCloseSoundboard = document.getElementById('btn-close-soundboard');
const btnOpenEmojis = document.getElementById('btn-open-emojis');
const emojiPopover = document.getElementById('emoji-popover');
const emojiGrid = document.getElementById('emoji-grid');
const emojiSearch = document.getElementById('emoji-search');

const videoGrid = document.getElementById('video-grid');
const layoutModeSelect = document.getElementById('layout-mode-select');
const btnMic = document.getElementById('btn-mic');
const btnKrisp = document.getElementById('btn-krisp');
const btnCam = document.getElementById('btn-cam');
const btnScreen = document.getElementById('btn-screen');
const btnQualityMenu = document.getElementById('btn-quality-menu');
const qualityPopover = document.getElementById('quality-popover');
const btnLeaveStage = document.getElementById('btn-leave-stage');
const qualityBadgeText = document.querySelector('.quality-badge-text');

// Settings Modal
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
const settingsPanels = document.querySelectorAll('.settings-panel');
const settingsNameInput = document.getElementById('settings-name-input');
const settingsStatusInput = document.getElementById('settings-status-input');
const btnSaveAccount = document.getElementById('btn-save-account');
const settingsAvatarDisp = document.getElementById('settings-avatar-disp');
const settingsUsernameDisp = document.getElementById('settings-username-disp');
const settingsTagDisp = document.getElementById('settings-tag-disp');
const themeCards = document.querySelectorAll('.theme-card');
const vuFill = document.getElementById('vu-fill');
const settingsKrispToggle = document.getElementById('settings-krisp-toggle');
const soundVolSlider = document.getElementById('sound-vol-slider');

// Create Channel & Server Modals
const createChannelModal = document.getElementById('create-channel-modal');
const closeCreateChannel = document.getElementById('close-create-channel');
const cancelCreateChannel = document.getElementById('cancel-create-channel');
const confirmCreateChannel = document.getElementById('confirm-create-channel');
const newChannelName = document.getElementById('new-channel-name');

const createServerModal = document.getElementById('create-server-modal');
const closeCreateServer = document.getElementById('close-create-server');
const cancelCreateServer = document.getElementById('cancel-create-server');
const confirmCreateServer = document.getElementById('confirm-create-server');
const newServerName = document.getElementById('new-server-name');

// User Profile Popout Card
const profilePopout = document.getElementById('profile-popout');
const popoutAvatarChar = document.getElementById('popout-avatar-char');
const popoutStatusDot = document.getElementById('popout-status-dot');
const popoutUsernameText = document.getElementById('popout-username-text');
const popoutTagText = document.getElementById('popout-tag-text');
const popoutCustomStatusText = document.getElementById('popout-custom-status-text');
const popoutRolesList = document.getElementById('popout-roles-list');
const popoutDmBtn = document.getElementById('popout-dm-btn');

let selectedAvatarEmoji = '👑';
let selectedServerIconEmoji = '⚡';
let currentPopoutUser = null;

// --------------------------------------------------------------------------
// Web Audio Synthesizer: Authentic Discord Sound FX
// --------------------------------------------------------------------------
function playDiscordSound(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = soundVolume;
    gain.connect(ctx.destination);

    if (type === 'discord-join') {
      // Ascending two-tone chime (F#4 -> B4)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(370, now);
      osc2.frequency.setValueAtTime(493.88, now + 0.12);

      const toneGain1 = ctx.createGain();
      toneGain1.gain.setValueAtTime(0.3, now);
      toneGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      const toneGain2 = ctx.createGain();
      toneGain2.gain.setValueAtTime(0.35, now + 0.12);
      toneGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(toneGain1); toneGain1.connect(gain);
      osc2.connect(toneGain2); toneGain2.connect(gain);

      osc1.start(now); osc1.stop(now + 0.18);
      osc2.start(now + 0.12); osc2.stop(now + 0.35);
    } else if (type === 'discord-leave') {
      // Descending two-tone chime (B4 -> F#4)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(493.88, now);
      osc2.frequency.setValueAtTime(370, now + 0.12);

      const toneGain1 = ctx.createGain();
      toneGain1.gain.setValueAtTime(0.35, now);
      toneGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      const toneGain2 = ctx.createGain();
      toneGain2.gain.setValueAtTime(0.3, now + 0.12);
      toneGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(toneGain1); toneGain1.connect(gain);
      osc2.connect(toneGain2); toneGain2.connect(gain);

      osc1.start(now); osc1.stop(now + 0.18);
      osc2.start(now + 0.12); osc2.stop(now + 0.35);
    } else if (type === 'mute') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
      const mGain = ctx.createGain();
      mGain.gain.setValueAtTime(0.2, now);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(mGain); mGain.connect(gain);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'unmute') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
      const mGain = ctx.createGain();
      mGain.gain.setValueAtTime(0.25, now);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(mGain); mGain.connect(gain);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'message') {
      // Discord message ping
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      const mGain = ctx.createGain();
      mGain.gain.setValueAtTime(0.22, now);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(mGain); mGain.connect(gain);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'airhorn') {
      // Classic synth airhorn sound
      [277, 311, 415].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.setValueAtTime(freq * 1.02, now + 0.1);
        const aGain = ctx.createGain();
        aGain.gain.setValueAtTime(0.2, now);
        aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(aGain); aGain.connect(gain);
        osc.start(now); osc.stop(now + 0.5);
      });
    } else if (type === 'quack') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      const qGain = ctx.createGain();
      qGain.gain.setValueAtTime(0.3, now);
      qGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(qGain); qGain.connect(gain);
      osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'badumtss') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      const bGain = ctx.createGain();
      bGain.gain.setValueAtTime(0.4, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(bGain); bGain.connect(gain);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'tada') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        const tGain = ctx.createGain();
        tGain.gain.setValueAtTime(0.25, now + i * 0.08);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(tGain); tGain.connect(gain);
        osc.start(now + i * 0.08); osc.stop(now + 0.6);
      });
    } else if (type === 'ringtone') {
      [659, 587, 523, 587, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        const rGain = ctx.createGain();
        rGain.gain.setValueAtTime(0.2, now + i * 0.12);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.18);
        osc.connect(rGain); rGain.connect(gain);
        osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.18);
      });
    } else if (type === 'gg') {
      [392, 440, 523.25, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        const gGain = ctx.createGain();
        gGain.gain.setValueAtTime(0.15, now + i * 0.07);
        gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gGain); gGain.connect(gain);
        osc.start(now + i * 0.07); osc.stop(now + 0.4);
      });
    }
  } catch (err) {
    console.warn('Audio synthesis error:', err);
  }
}

// --------------------------------------------------------------------------
// Toast Notification
// --------------------------------------------------------------------------
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
  toast._timeout = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// --------------------------------------------------------------------------
// Audio Engine (AEC, AGC, VU Meter, Dedicated Audio Playback & Unlocking)
// --------------------------------------------------------------------------
function unlockAllAudio() {
  document.querySelectorAll('audio[data-peer-audio]').forEach(el => {
    if (el.paused) {
      el.play().then(() => {
        console.log('[Audio Playback] Unlocked peer audio:', el.id);
      }).catch(err => {
        console.warn('[Audio Playback] Play pending gesture:', err);
      });
    }
  });
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// Ensure every single page interaction unlocks Web Audio & peer playback
['click', 'touchstart', 'keydown'].forEach(evt => {
  window.addEventListener(evt, unlockAllAudio, { passive: true });
});

async function ensureLocalMic() {
  if (localAudioStream && localAudioStream.getAudioTracks().length > 0 && localAudioStream.getAudioTracks()[0].readyState === 'live') {
    const track = localAudioStream.getAudioTracks()[0];
    track.enabled = !isMuted;
    return localAudioStream;
  }

  try {
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });
    localAudioStream = rawStream;
    const audioTrack = rawStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMuted;
    }

    setupAudioDSP(rawStream);

    // Update tracks on any active WebRTC peer connections
    peers.forEach(async (pc, targetId) => {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
                          senders.find(s => !s.track);
      if (audioSender && audioTrack) {
        try {
          await audioSender.replaceTrack(audioTrack);
        } catch (e) {
          console.warn('replaceTrack audio error:', e);
        }
      } else if (audioTrack) {
        try {
          pc.addTrack(audioTrack, rawStream);
        } catch (e) {
          console.warn('addTrack audio error:', e);
        }
      }
    });

    return localAudioStream;
  } catch (err) {
    console.warn('Microphone permission or hardware error:', err);
    showToast('⚠️ Could not access mic. Please grant mic permission in browser!');
    if (!localAudioStream) localAudioStream = new MediaStream();
    return null;
  }
}

function setupAudioDSP(rawStream) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return rawStream;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (micSourceNode) {
      try { micSourceNode.disconnect(); } catch (e) {}
    }
    micSourceNode = audioCtx.createMediaStreamSource(rawStream);

    // RMS Analyser for settings VU meter & speaking ring (does NOT mute outgoing audio!)
    noiseAnalyser = audioCtx.createAnalyser();
    noiseAnalyser.fftSize = 512;
    micSourceNode.connect(noiseAnalyser);

    const sampleBuffer = new Float32Array(noiseAnalyser.fftSize);
    let wasSpeaking = false;

    if (gateInterval) clearInterval(gateInterval);
    gateInterval = setInterval(() => {
      if (!noiseAnalyser) return;

      noiseAnalyser.getFloatTimeDomainData(sampleBuffer);
      let sumSquares = 0;
      for (let i = 0; i < sampleBuffer.length; i++) {
        sumSquares += sampleBuffer[i] * sampleBuffer[i];
      }
      const rms = Math.sqrt(sumSquares / sampleBuffer.length);

      // Update VU meter fill in Settings
      if (vuFill) {
        const percent = Math.min(100, Math.round(rms * 600));
        vuFill.style.width = percent + '%';
      }

      const now = Date.now();
      const isVoiceDetected = rms >= 0.007;

      if (isVoiceDetected) {
        lastVoiceTime = now;
      }

      const isSpeakingNow = isVoiceDetected || (now - lastVoiceTime <= GATE_HANGOVER_MS);
      if (isSpeakingNow !== wasSpeaking) {
        wasSpeaking = isSpeakingNow;
        handleSpeakingState(isSpeakingNow);
      }
    }, 45);

    return rawStream;
  } catch (e) {
    console.error('Audio DSP initialization error:', e);
    return rawStream;
  }
}

function handleSpeakingState(isSpeaking) {
  // Update self tile speaking ring
  const selfTile = document.getElementById('tile-self');
  if (selfTile) selfTile.classList.toggle('speaking', isSpeaking);

  // Update nested voice user in sidebar
  const nestedSelf = document.querySelector(`.nested-user-row[data-uid="${socket.id}"] .nested-avatar`);
  if (nestedSelf) nestedSelf.classList.toggle('speaking', isSpeaking);

  // Broadcast to peers
  socket.emit('user-speaking', { isSpeaking });
}

// Dedicated Remote Audio Playback Engine (Independent element per audio track: Voice & Stream)
function playRemoteAudioTrack(targetId, track, isScreen = false) {
  if (!track || track.readyState === 'ended') return;

  const audioId = `audio-track-${track.id}`;
  let audioEl = document.getElementById(audioId);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = audioId;
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.setAttribute('data-peer-audio', targetId);
    audioEl.style.position = 'fixed';
    audioEl.style.left = '-9999px';
    audioEl.style.top = '-9999px';
    document.body.appendChild(audioEl);
  }

  audioEl.muted = isDeafened;
  audioEl.volume = soundVolume;

  // Crucial: Bind ONLY this specific audio track into its own MediaStream
  if (!audioEl.srcObject || !audioEl.srcObject.getTracks().includes(track)) {
    audioEl.srcObject = new MediaStream([track]);
  }

  userAudioElements.set(track.id, audioEl);

  const playPromise = audioEl.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log(`[Audio Engine] 🔊 Playing ${isScreen ? 'Stream Audio' : 'Voice Audio'} [${track.id}] from ${targetId}`);
    }).catch(err => {
      console.warn(`[Audio Engine] Autoplay gesture required for track ${track.id}:`, err);
      showToast('🔊 Click anywhere on Discord to enable audio playback!');
    });
  }
}

// --------------------------------------------------------------------------
// Join Flow
// --------------------------------------------------------------------------
const savedName = localStorage.getItem('discord-username');
const urlName = new URLSearchParams(window.location.search).get('name');
if (urlName) {
  usernameInput.value = urlName;
} else if (savedName) {
  usernameInput.value = savedName;
}

avatarChoices.forEach(btn => {
  btn.addEventListener('click', () => {
    avatarChoices.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAvatarEmoji = btn.dataset.av;
  });
});

joinBtn.addEventListener('click', joinDiscord);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinDiscord();
});

async function joinDiscord() {
  const name = usernameInput.value.trim();
  if (!name) return;

  const customStatus = customStatusInput.value.trim();
  localStorage.setItem('discord-username', name);
  joinModal.classList.add('hidden');

  unlockAllAudio();

  // Acquire local microphone stream with high quality AEC/AGC
  await ensureLocalMic();

  // Connect user to server
  socket.emit('join-discord', {
    username: name,
    customStatus,
    avatar: selectedAvatarEmoji
  });
}

// --------------------------------------------------------------------------
// Socket Events
// --------------------------------------------------------------------------
socket.on('discord-init', (data) => {
  myUserInfo = data.self;
  servers = data.servers;
  Object.assign(channelMessages, data.channelMessages);

  // Populate all users map
  data.allUsers.forEach(u => allUsers.set(u.id, u));

  // Populate voice channel members
  data.voiceChannelMembers.forEach(([cid, members]) => {
    voiceMembers.set(cid, new Set(members));
  });

  // Update Footer UI
  selfUsername.textContent = myUserInfo.username;
  selfTag.textContent = myUserInfo.tag;
  selfAvatar.textContent = myUserInfo.avatar;
  settingsAvatarDisp.textContent = myUserInfo.avatar;
  settingsUsernameDisp.textContent = myUserInfo.username;
  settingsTagDisp.textContent = myUserInfo.tag;
  settingsNameInput.value = myUserInfo.username;
  settingsStatusInput.value = myUserInfo.customStatus || '';

  renderGuildSidebar();
  renderChannelsSidebar();
  renderMembersList();
  renderChatMessages();

  playDiscordSound('discord-join');
  showToast(`⚡ Connected to Discord Live as ${myUserInfo.username}! Connecting to room...`);

  // Auto-connect to voice & stage immediately so you and your friend speak with zero extra clicks
  const urlParams = new URLSearchParams(window.location.search);
  const requestedRoom = urlParams.get('room');
  if (requestedRoom) {
    connectVoiceChannel(requestedRoom);
  } else {
    connectVoiceChannel('v-lounge');
  }
});

socket.on('user-presence-update', (user) => {
  allUsers.set(user.id, user);
  renderMembersList();
  renderVoiceNestedMembers();
});

socket.on('user-disconnected', ({ id, username }) => {
  allUsers.delete(id);
  closePeer(id);
  renderMembersList();
  renderVoiceNestedMembers();
});

socket.on('new-channel-message', ({ channelId, message }) => {
  if (!channelMessages[channelId]) channelMessages[channelId] = [];
  channelMessages[channelId].push(message);

  if (activeView === 'chat' && currentTextChannelId === channelId) {
    appendMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (message.senderId !== socket.id) {
    playDiscordSound('message');
  }
});

socket.on('new-dm-message', ({ conversationId, message }) => {
  if (!directMessages[conversationId]) directMessages[conversationId] = [];
  directMessages[conversationId].push(message);

  if (activeView === 'chat' && currentDmRecipientId === message.senderId) {
    appendMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (message.senderId !== socket.id) {
    playDiscordSound('message');
  }
});

socket.on('reaction-updated', ({ channelId, messageId, reactions }) => {
  if (!channelMessages[channelId]) return;
  const msg = channelMessages[channelId].find(m => m.id === messageId);
  if (msg) {
    msg.reactions = reactions;
    const msgEl = document.querySelector(`.message-row[data-mid="${messageId}"]`);
    if (msgEl) {
      const reactionsContainer = msgEl.querySelector('.msg-reactions');
      if (reactionsContainer) {
        reactionsContainer.innerHTML = renderReactionsHTML(reactions, messageId);
      }
    }
  }
});

socket.on('user-typing', ({ channelId, username, userId }) => {
  if (currentTextChannelId === channelId && userId !== socket.id) {
    typingIndicator.textContent = `${username} is typing...`;
  }
});

socket.on('user-stop-typing', ({ channelId, userId }) => {
  if (currentTextChannelId === channelId) {
    typingIndicator.textContent = '';
  }
});

socket.on('soundboard-broadcast', ({ soundId, username }) => {
  playDiscordSound(soundId);
  showToast(`🔊 ${username} played a sound: ${soundId}`);
});

socket.on('channel-created', ({ serverId, categoryId, channel }) => {
  const targetServer = servers.find(s => s.id === serverId);
  if (targetServer) {
    const cat = targetServer.categories.find(c => c.id === categoryId);
    if (cat) cat.channels.push(channel);
  }
  if (currentServerId === serverId) {
    renderChannelsSidebar();
  }
  showToast(`✨ Channel #${channel.name} created!`);
});

socket.on('server-created', ({ server }) => {
  servers.push(server);
  renderGuildSidebar();
  showToast(`🚀 Server ${server.name} created!`);
});

// --------------------------------------------------------------------------
// Guild / Server Navigation
// --------------------------------------------------------------------------
function renderGuildSidebar() {
  guildList.innerHTML = '';

  servers.forEach(srv => {
    const item = document.createElement('div');
    item.className = `guild-item ${srv.id === currentServerId && activeView !== 'friends' ? 'active' : ''}`;
    item.dataset.sid = srv.id;
    item.title = srv.name;

    item.innerHTML = `
      <div class="guild-pill"></div>
      <div class="guild-icon">${srv.icon}</div>
    `;

    item.addEventListener('click', () => switchServer(srv.id));
    guildList.appendChild(item);
  });
}

btnGuildHome.addEventListener('click', () => {
  activeView = 'friends';
  document.querySelectorAll('.guild-item').forEach(i => i.classList.remove('active'));
  btnGuildHome.classList.add('active');

  closeServerDropdown();
  serverHeader.classList.add('hidden');
  channelsContainer.classList.add('hidden');
  dmHeader.classList.remove('hidden');
  dmNavContainer.classList.remove('hidden');

  switchView('friends');
  renderDirectMessagesList();
  renderFriendsList();
});

function switchServer(serverId) {
  closeServerDropdown();
  currentServerId = serverId;
  activeView = 'chat';

  document.querySelectorAll('.guild-item').forEach(i => i.classList.remove('active'));
  const activeGuildEl = document.querySelector(`.guild-item[data-sid="${serverId}"]`);
  if (activeGuildEl) activeGuildEl.classList.add('active');

  serverHeader.classList.remove('hidden');
  channelsContainer.classList.remove('hidden');
  dmHeader.classList.add('hidden');
  dmNavContainer.classList.add('hidden');

  const srv = servers.find(s => s.id === serverId);
  if (srv) {
    serverTitleText.textContent = srv.name;
    // Switch to first text channel of server
    const firstTextChan = srv.categories.flatMap(c => c.channels).find(ch => ch.type === 'text');
    if (firstTextChan) {
      switchTextChannel(firstTextChan.id);
    }
  }

  renderChannelsSidebar();
  renderMembersList();
}

// --------------------------------------------------------------------------
// Channels Sidebar
// --------------------------------------------------------------------------
function renderChannelsSidebar() {
  const srv = servers.find(s => s.id === currentServerId);
  if (!srv) return;

  channelsContainer.innerHTML = '';

  srv.categories.forEach(cat => {
    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';
    catHeader.innerHTML = `
      <span class="category-name">${cat.name}</span>
      <span class="category-plus" title="Create Channel" data-catid="${cat.id}">+</span>
    `;

    catHeader.querySelector('.category-plus').addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateChannelModal(cat.id);
    });

    channelsContainer.appendChild(catHeader);

    cat.channels.forEach(ch => {
      const chItem = document.createElement('div');
      chItem.className = `channel-item ${ch.id === currentTextChannelId ? 'active' : ''}`;
      chItem.dataset.cid = ch.id;

      const icon = ch.type === 'text' ? '#' : '🔊';
      chItem.innerHTML = `
        <span class="channel-icon">${icon}</span>
        <span class="channel-name">${ch.name}</span>
      `;

      if (ch.type === 'text') {
        chItem.addEventListener('click', () => switchTextChannel(ch.id));
      } else {
        chItem.addEventListener('click', () => connectVoiceChannel(ch.id));
      }

      channelsContainer.appendChild(chItem);

      // If voice channel, append nested participants list container
      if (ch.type === 'voice') {
        const nestedContainer = document.createElement('div');
        nestedContainer.className = 'nested-voice-users';
        nestedContainer.id = `nested-voice-${ch.id}`;
        channelsContainer.appendChild(nestedContainer);
      }
    });
  });

  renderVoiceNestedMembers();
}

function renderVoiceNestedMembers() {
  voiceMembers.forEach((memberIds, chanId) => {
    const nestedEl = document.getElementById(`nested-voice-${chanId}`);
    if (!nestedEl) return;
    nestedEl.innerHTML = '';

    memberIds.forEach(uid => {
      const u = allUsers.get(uid) || (uid === socket.id ? myUserInfo : null);
      if (!u) return;

      const userRow = document.createElement('div');
      userRow.className = 'nested-user-row';
      userRow.dataset.uid = uid;
      userRow.innerHTML = `
        <div class="nested-avatar">${u.avatar}</div>
        <span class="nested-name">${u.username}</span>
      `;
      nestedEl.appendChild(userRow);
    });
  });
}

function switchTextChannel(channelId) {
  currentTextChannelId = channelId;
  activeView = 'chat';

  // Highlight channel item
  document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
  const activeChEl = document.querySelector(`.channel-item[data-cid="${channelId}"]`);
  if (activeChEl) activeChEl.classList.add('active');

  const srv = servers.find(s => s.id === currentServerId);
  const chan = srv?.categories.flatMap(c => c.channels).find(ch => ch.id === channelId);

  if (chan) {
    topBarIcon.textContent = '#';
    topBarTitle.textContent = chan.name;
    topBarTopic.textContent = chan.topic || `Channel #${chan.name}`;
    chatInput.placeholder = `Message #${chan.name}`;
  }

  switchView('chat');
  renderChatMessages();
}

// --------------------------------------------------------------------------
// View Switcher (Chat vs Stage vs Friends)
// --------------------------------------------------------------------------
function switchView(viewName) {
  activeView = viewName;
  viewChat.classList.remove('active');
  viewStage.classList.remove('active');
  viewFriends.classList.remove('active');

  if (viewName === 'chat') {
    viewChat.classList.add('active');
  } else if (viewName === 'stage') {
    viewStage.classList.add('active');
  } else if (viewName === 'friends') {
    viewFriends.classList.add('active');
  }
}

// --------------------------------------------------------------------------
// WebRTC Voice & Video Connection
// --------------------------------------------------------------------------
btnToggleVoiceStage.addEventListener('click', () => {
  if (activeView === 'stage') {
    switchView('chat');
    btnToggleVoiceStage.classList.remove('active');
  } else {
    switchView('stage');
    btnToggleVoiceStage.classList.add('active');
  }
});

async function connectVoiceChannel(channelId) {
  if (currentVoiceChannelId === channelId) {
    // If already connected, simply toggle stage view
    switchView('stage');
    btnToggleVoiceStage.classList.add('active');
    return;
  }

  unlockAllAudio();
  await ensureLocalMic();

  currentVoiceChannelId = channelId;
  const srv = servers.find(s => s.id === currentServerId);
  const vChan = srv?.categories.flatMap(c => c.channels).find(ch => ch.id === channelId);

  // Update Voice Status Dock
  voiceStatusDock.classList.remove('hidden');
  connectedVoiceName.textContent = `${vChan ? vChan.name : 'Voice'} / ${srv ? srv.name : 'Server'}`;
  btnToggleVoiceStage.classList.remove('hidden');

  playDiscordSound('discord-join');
  showToast(`🔊 Connected to voice: ${vChan ? vChan.name : 'Voice Room'}`);

  // Emit socket join
  socket.emit('join-voice-channel', {
    channelId,
    serverId: currentServerId
  });

  // Add local video tile
  addLocalVideoTile();
  switchView('stage');
  btnToggleVoiceStage.classList.add('active');
}

btnVoiceDisconnect.addEventListener('click', disconnectVoice);
btnLeaveStage.addEventListener('click', disconnectVoice);

function disconnectVoice() {
  if (!currentVoiceChannelId) return;

  socket.emit('leave-voice-channel');
  currentVoiceChannelId = null;

  // Close all WebRTC peers
  peers.forEach((peer, id) => {
    peer.close();
  });
  peers.clear();
  remoteStreams.clear();
  userAudioElements.clear();

  document.querySelectorAll('audio[data-peer-audio]').forEach(el => el.remove());

  // Reset video grid
  videoGrid.innerHTML = '';
  voiceStatusDock.classList.add('hidden');
  btnToggleVoiceStage.classList.add('hidden');

  playDiscordSound('discord-leave');
  showToast('🔇 Disconnected from voice channel.');

  switchView('chat');
}

// --------------------------------------------------------------------------
// WebRTC Zero-Reload Dynamic Engine & Signaling
// --------------------------------------------------------------------------
const pendingCandidates = new Map(); // targetId -> [candidate]

async function flushPendingCandidates(targetId) {
  const pc = peers.get(targetId);
  const list = pendingCandidates.get(targetId);
  if (pc && pc.remoteDescription && list && list.length > 0) {
    for (const cand of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Flush ICE candidate error:', e);
      }
    }
    pendingCandidates.delete(targetId);
  }
}

// Live Dynamic Remote Stream Tile Updater (Zero-Reload without page refresh)
function refreshRemoteStreamTile(socketId) {
  const stream = remoteStreams.get(socketId);
  const user = allUsers.get(socketId);
  const userName = user ? user.username : 'Friend';
  const isScreen = user ? (user.isScreenSharing || false) : false;

  let tile = document.getElementById(`tile-${socketId}`);
  if (!tile) {
    tile = createVideoTile(`tile-${socketId}`, userName, stream, true, isScreen, socketId);
    videoGrid.appendChild(tile);
  }

  const video = tile.querySelector('video');
  if (video && stream) {
    video.muted = true; // Video element in grid is strictly muted; audio plays via dedicated <audio>!
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].enabled) {
      if (!video.srcObject || !video.srcObject.getVideoTracks().includes(videoTracks[0])) {
        video.srcObject = new MediaStream([videoTracks[0]]);
      }
      tile.classList.add('has-video');
      video.play().catch(e => console.warn('Autoplay video note:', e));
    } else {
      video.srcObject = null;
      tile.classList.remove('has-video');
    }
  }

  // Ensure ALL audio tracks (microphone AND stream audio) are playing in their own elements
  if (stream) {
    stream.getAudioTracks().forEach(track => {
      playRemoteAudioTrack(socketId, track, isScreen);
    });
  }

  tile.classList.toggle('screen-tile', isScreen);
  const overlaySpan = tile.querySelector('.tile-overlay span');
  if (overlaySpan) {
    overlaySpan.textContent = isScreen ? `📺 ${userName} (Stream)` : userName;
  }
}

// Socket Voice Handlers
socket.on('voice-channel-joined', async ({ channelId, participants }) => {
  await ensureLocalMic();
  // Initiate peer connections to all existing participants in room
  for (const p of participants) {
    await createPeerConnection(p.id, true);
    if (p.isScreenSharing) {
      refreshRemoteStreamTile(p.id);
    }
  }
});

socket.on('voice-user-joined', async ({ channelId, user }) => {
  allUsers.set(user.id, user);
  playDiscordSound('discord-join');
  showToast(`👤 ${user.username} joined voice.`);

  await ensureLocalMic();
  if (!peers.has(user.id)) {
    await createPeerConnection(user.id, false);
  }
  refreshRemoteStreamTile(user.id);
});

socket.on('voice-user-left', ({ userId, username }) => {
  playDiscordSound('discord-leave');
  showToast(`👤 ${username} left voice.`);
  closePeer(userId);
});

socket.on('voice-membership-updated', ({ channelId, members }) => {
  voiceMembers.set(channelId, new Set(members));
  renderVoiceNestedMembers();
});

// WebRTC Peer Connection Factory with sendrecv Transceiver Fallback
async function createPeerConnection(targetId, isInitiator) {
  if (peers.has(targetId)) return peers.get(targetId);

  const pc = new RTCPeerConnection(rtcConfig);
  peers.set(targetId, pc);

  // 1. Add local audio track or audio transceiver
  if (localAudioStream && localAudioStream.getAudioTracks()[0]) {
    const track = localAudioStream.getAudioTracks()[0];
    track.enabled = !isMuted;
    pc.addTrack(track, localAudioStream);
  } else {
    pc.addTransceiver('audio', { direction: 'sendrecv' });
  }

  // 2. Add local video track or video transceiver (Ensures incoming video displays without refresh!)
  const currentVideoTrack = (localScreenStream && localScreenStream.getVideoTracks()[0]) ||
                            (localVideoStream && localVideoStream.getVideoTracks()[0]);
  if (currentVideoTrack) {
    pc.addTrack(currentVideoTrack, localScreenStream || localVideoStream);
  } else {
    pc.addTransceiver('video', { direction: 'sendrecv' });
  }

  // 3. Add screen audio track if already sharing screen
  if (localScreenStream && localScreenStream.getAudioTracks()[0]) {
    pc.addTrack(localScreenStream.getAudioTracks()[0], localScreenStream);
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { targetId, candidate: event.candidate });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Peer ${targetId} connection state:`, pc.connectionState);
    if (pc.connectionState === 'connected') {
      const u = allUsers.get(targetId);
      showToast(`🟢 Voice connected with ${u ? u.username : 'friend'}`);
      unlockAllAudio();
    } else if (pc.connectionState === 'failed') {
      console.warn(`[WebRTC] Connection failed with ${targetId}, attempting ICE restart`);
      if (pc.restartIce) pc.restartIce();
    }
  };

  pc.ontrack = (event) => {
    const track = event.track;
    console.log(`[WebRTC] Received remote ${track.kind} track (${track.id}) from ${targetId}`);

    let stream = remoteStreams.get(targetId);
    if (!stream) {
      stream = new MediaStream();
      remoteStreams.set(targetId, stream);
    }

    if (!stream.getTracks().includes(track)) {
      stream.addTrack(track);
    }

    if (track.kind === 'audio') {
      const isScreenAudio = event.streams[0] && (event.streams[0].id.includes('screen') || allUsers.get(targetId)?.isScreenSharing);
      playRemoteAudioTrack(targetId, track, isScreenAudio);

      track.onunmute = () => {
        console.log(`[WebRTC] Audio track onunmute (${track.id}) from ${targetId}`);
        playRemoteAudioTrack(targetId, track, isScreenAudio);
      };

      track.onended = () => {
        console.log(`[WebRTC] Audio track onended (${track.id}) from ${targetId}`);
        const el = document.getElementById(`audio-track-${track.id}`);
        if (el) el.remove();
        userAudioElements.delete(track.id);
        stream.removeTrack(track);
      };
    } else if (track.kind === 'video') {
      refreshRemoteStreamTile(targetId);

      track.onunmute = () => refreshRemoteStreamTile(targetId);
      track.onended = () => {
        stream.removeTrack(track);
        refreshRemoteStreamTile(targetId);
      };
    }

    refreshRemoteStreamTile(targetId);
  };

  if (isInitiator) {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
    } catch (e) {
      console.warn('Initiator offer error:', e);
    }
  }

  return pc;
}

function closePeer(userId) {
  const pc = peers.get(userId);
  if (pc) {
    pc.close();
    peers.delete(userId);
  }
  remoteStreams.delete(userId);
  pendingCandidates.delete(userId);

  // Remove all audio elements belonging to this peer
  document.querySelectorAll(`audio[data-peer-audio="${userId}"]`).forEach(el => el.remove());

  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.remove();
}

// WebRTC Signaling Handlers (with pending ICE queue & dynamic tile refresh)
socket.on('signal-offer', async ({ callerId, sdp }) => {
  await ensureLocalMic();
  const pc = await createPeerConnection(callerId, false);
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushPendingCandidates(callerId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal-answer', { targetId: callerId, sdp: pc.localDescription });
    refreshRemoteStreamTile(callerId);
  } catch (e) {
    console.error('Error handling offer:', e);
  }
});

socket.on('signal-answer', async ({ callerId, sdp }) => {
  const pc = peers.get(callerId);
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(callerId);
      refreshRemoteStreamTile(callerId);
    } catch (e) {
      console.error('Error handling answer:', e);
    }
  }
});

socket.on('ice-candidate', async ({ senderId, candidate }) => {
  const pc = peers.get(senderId);
  if (!pc || !pc.remoteDescription) {
    if (!pendingCandidates.has(senderId)) pendingCandidates.set(senderId, []);
    pendingCandidates.get(senderId).push(candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error adding ICE candidate:', e);
  }
});

// Dynamic stream state handlers that refresh UI instantly without refresh
socket.on('stream-started', ({ id, username }) => {
  const u = allUsers.get(id);
  if (u) u.isScreenSharing = true;
  if (!peers.has(id)) {
    createPeerConnection(id, false);
  }
  refreshRemoteStreamTile(id);
  showToast(`📺 ${username} is sharing their screen!`);
});

socket.on('stream-stopped', ({ id, username }) => {
  const u = allUsers.get(id);
  if (u) u.isScreenSharing = false;
  refreshRemoteStreamTile(id);
  showToast(`📺 ${username} stopped screen share.`);
});

socket.on('voice-user-state-updated', (data) => {
  const u = allUsers.get(data.id);
  if (u) {
    Object.assign(u, data);
    refreshRemoteStreamTile(data.id);
  }
});

socket.on('user-speaking-change', ({ userId, isSpeaking }) => {
  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.classList.toggle('speaking', isSpeaking);

  const nested = document.querySelector(`.nested-user-row[data-uid="${userId}"] .nested-avatar`);
  if (nested) nested.classList.toggle('speaking', isSpeaking);
});

// Auto-reconnect on socket disconnect
socket.on('connect', () => {
  console.log('[Socket] Connected/Reconnected:', socket.id);
  if (myUserInfo && myUserInfo.username) {
    socket.emit('join-discord', {
      username: myUserInfo.username,
      customStatus: myUserInfo.customStatus,
      avatar: myUserInfo.avatar
    });
    if (currentVoiceChannelId) {
      socket.emit('join-voice-channel', {
        channelId: currentVoiceChannelId,
        serverId: currentServerId
      });
    }
  }
});

// --------------------------------------------------------------------------
// Video Tiles Management
// --------------------------------------------------------------------------
function addLocalVideoTile() {
  const existing = document.getElementById('tile-self');
  if (existing) existing.remove();

  const tile = createVideoTile('tile-self', (myUserInfo ? myUserInfo.username : 'You') + ' (You)', localAudioStream, true, false, 'self');
  videoGrid.appendChild(tile);
}

function addRemoteVideoTile(socketId, label, stream) {
  let tile = document.getElementById(`tile-${socketId}`);
  if (!tile) {
    tile = createVideoTile(`tile-${socketId}`, label, stream, true, false, socketId);
    videoGrid.appendChild(tile);
  } else {
    const video = tile.querySelector('video');
    if (video) video.srcObject = stream;
  }
}

function createVideoTile(id, label, stream, isMutedAudio = true, isScreen = false, socketId = null) {
  const tile = document.createElement('div');
  tile.className = `video-tile ${isScreen ? 'screen-tile' : ''}`;
  tile.id = id;

  const user = socketId === 'self' ? myUserInfo : allUsers.get(socketId);
  const avatarChar = user ? (user.avatar || '👑') : '👑';

  tile.innerHTML = `
    <div class="tile-avatar-center">
      <div class="tile-avatar-circle">${avatarChar}</div>
    </div>
    <video autoplay playsinline muted></video>
    <div class="tile-overlay"><span>${label}</span></div>
    <div class="tile-top-actions">
      <button class="tile-action-btn btn-max" title="Maximize">🗖 Maximize</button>
      <button class="tile-action-btn btn-fs" title="Fullscreen">⛶ Fullscreen</button>
    </div>
  `;

  const video = tile.querySelector('video');
  video.muted = true; // Video element in grid is muted to prevent audio collision with dedicated player!
  if (stream) {
    video.srcObject = stream;
    const hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
    tile.classList.toggle('has-video', hasVideo);
  }

  const maxBtn = tile.querySelector('.btn-max');
  maxBtn.onclick = (e) => {
    e.stopPropagation();
    tile.classList.toggle('borderless-maximized');
    maxBtn.innerHTML = tile.classList.contains('borderless-maximized') ? '🗕 Restore' : '🗖 Maximize';
  };

  const fsBtn = tile.querySelector('.btn-fs');
  fsBtn.onclick = (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      tile.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return tile;
}

// --------------------------------------------------------------------------
// Controls: Mic, Krisp, Camera, Screen Share
// --------------------------------------------------------------------------
dockBtnMic.addEventListener('click', toggleMic);
btnMic.addEventListener('click', toggleMic);

function toggleMic() {
  isMuted = !isMuted;
  if (localAudioStream) {
    localAudioStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  }

  dockBtnMic.classList.toggle('active', isMuted);
  btnMic.classList.toggle('danger', isMuted);
  btnMic.querySelector('.btn-text').textContent = isMuted ? 'Unmute' : 'Mute';

  playDiscordSound(isMuted ? 'mute' : 'unmute');
  showToast(isMuted ? '🔇 Microphone Muted' : '🎙️ Microphone Unmuted');

  socket.emit('media-state-change', { isMuted });
}

dockBtnDeafen.addEventListener('click', () => {
  isDeafened = !isDeafened;
  document.querySelectorAll('audio[data-peer-audio]').forEach(audioEl => {
    audioEl.muted = isDeafened;
  });

  dockBtnDeafen.classList.toggle('active', isDeafened);
  playDiscordSound(isDeafened ? 'mute' : 'unmute');
  showToast(isDeafened ? '🔇 Sound Deafened' : '🔊 Sound Undeafened');
});

btnKrisp.addEventListener('click', () => {
  isKrispActive = !isKrispActive;
  btnKrisp.classList.toggle('active', isKrispActive);
  settingsKrispToggle.checked = isKrispActive;

  if (isKrispActive) {
    showToast('✨ Krisp AI Anti-Chiado ATIVADO');
  } else {
    showToast('⚠️ Krisp Anti-Chiado DESATIVADO');
  }
});

btnCam.addEventListener('click', async () => {
  if (!isCameraOn) {
    try {
      localVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const videoTrack = localVideoStream.getVideoTracks()[0];

      // Replace track on existing video senders or add, then renegotiate
      peers.forEach(async (pc, targetId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                            senders.find(s => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, localVideoStream);
        }

        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
        } catch (e) {
          console.warn('Cam renegotiation error:', e);
        }
      });

      // Update local tile
      const selfVideo = document.querySelector('#tile-self video');
      if (selfVideo) selfVideo.srcObject = localVideoStream;

      isCameraOn = true;
      btnCam.classList.add('highlight');
      btnCam.querySelector('.btn-text').textContent = 'Stop Cam';
      socket.emit('media-state-change', { isCameraOn: true });
      showToast('📹 Camera Turned On');
    } catch (e) {
      showToast('⚠️ Camera access denied');
    }
  } else {
    if (localVideoStream) {
      localVideoStream.getTracks().forEach(t => t.stop());
      localVideoStream = null;
    }
    peers.forEach(async (pc, targetId) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(null);
      }
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
      } catch (e) {}
    });

    const selfVideo = document.querySelector('#tile-self video');
    if (selfVideo && localAudioStream) selfVideo.srcObject = localAudioStream;

    isCameraOn = false;
    btnCam.classList.remove('highlight');
    btnCam.querySelector('.btn-text').textContent = 'Camera';
    socket.emit('media-state-change', { isCameraOn: false });
    showToast('📹 Camera Turned Off');
  }
});

btnScreen.addEventListener('click', async () => {
  if (!isScreenSharing) {
    try {
      const fps = parseInt(streamFps, 10) || 30;
      localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: fps, max: 60 },
          width: streamResolution === '720' ? 1280 : 1920,
          height: streamResolution === '720' ? 720 : 1080
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const screenVideoTrack = localScreenStream.getVideoTracks()[0];
      const screenAudioTrack = localScreenStream.getAudioTracks()[0] || null;

      screenVideoTrack.onended = stopScreenShare;

      // Attach both screen video AND screen audio to all peer connections
      peers.forEach(async (pc, targetId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                            senders.find(s => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(screenVideoTrack);
        } else {
          pc.addTrack(screenVideoTrack, localScreenStream);
        }

        // Transmit screen audio track if tab / system audio was shared
        if (screenAudioTrack) {
          pc.addTrack(screenAudioTrack, localScreenStream);
        }

        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
        } catch (e) {
          console.warn('Screen share offer error:', e);
        }
      });

      // Show local screen tile
      const screenTile = createVideoTile('tile-screen-self', 'Your Stream (1080p)', new MediaStream([screenVideoTrack]), true, true, 'self');
      videoGrid.prepend(screenTile);

      isScreenSharing = true;
      btnScreen.classList.add('danger');
      btnScreen.querySelector('.btn-text').textContent = 'Stop Sharing';
      socket.emit('stream-started', { resolution: streamResolution, fps: streamFps, hasAudio: !!screenAudioTrack });
      socket.emit('media-state-change', { isScreenSharing: true });
      showToast(screenAudioTrack ? '📺 1080p Stream Started (with Tab Audio 🔊)' : '📺 1080p Stream Started');
    } catch (e) {
      console.warn('Screen share canceled or denied:', e);
    }
  } else {
    stopScreenShare();
  }
});

function stopScreenShare() {
  if (localScreenStream) {
    localScreenStream.getTracks().forEach(t => t.stop());
    localScreenStream = null;
  }
  const screenTile = document.getElementById('tile-screen-self');
  if (screenTile) screenTile.remove();

  peers.forEach(async (pc, targetId) => {
    const senders = pc.getSenders();
    // Remove stopped screen audio senders
    senders.forEach(s => {
      if (s.track && s.track.readyState === 'ended' && s.track.kind === 'audio') {
        try { pc.removeTrack(s); } catch (e) {}
      }
    });

    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    if (videoSender) {
      const fallbackTrack = (localVideoStream && localVideoStream.getVideoTracks()[0]) || null;
      await videoSender.replaceTrack(fallbackTrack);
    }
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
    } catch (e) {}
  });

  isScreenSharing = false;
  btnScreen.classList.remove('danger');
  btnScreen.querySelector('.btn-text').textContent = 'Share Screen';
  socket.emit('stream-stopped');
  socket.emit('media-state-change', { isScreenSharing: false });
  showToast('📺 Screen sharing stopped.');
}

// Stream Quality Settings Popover
btnQualityMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  qualityPopover.classList.toggle('hidden');
});

document.querySelectorAll('#res-options .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#res-options .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    streamResolution = btn.dataset.res;
    updateQualityBadge();
  });
});

document.querySelectorAll('#fps-options .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#fps-options .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    streamFps = btn.dataset.fps;
    updateQualityBadge();
  });
});

function updateQualityBadge() {
  qualityBadgeText.textContent = `${streamResolution}p ${streamFps}fps`;
  showToast(`⚡ Stream preset: ${streamResolution}p @ ${streamFps} FPS`);
}

// --------------------------------------------------------------------------
// Rich Text Chat & Markdown Parser
// --------------------------------------------------------------------------
function parseDiscordMarkdown(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code block: ```code```
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code: `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold: **text**
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italics: *text*
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  escaped = escaped.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Quote: &gt; quote
  escaped = escaped.replace(/^&gt;\s(.*)$/gm, '<blockquote>$1</blockquote>');

  // Mentions: @Marcus
  escaped = escaped.replace(/@([a-zA-Z0-9_-]+)/g, '<span class="role-badge admin">@$1</span>');

  return escaped;
}

function renderChatMessages() {
  chatMessages.innerHTML = '';

  const srv = servers.find(s => s.id === currentServerId);
  const chan = srv?.categories.flatMap(c => c.channels).find(ch => ch.id === currentTextChannelId);

  // Channel Welcome Banner
  const welcome = document.createElement('div');
  welcome.className = 'channel-welcome-card';
  welcome.innerHTML = `
    <div class="welcome-hash">#</div>
    <h1 class="welcome-title">Welcome to #${chan ? chan.name : 'channel'}!</h1>
    <p class="welcome-desc">This is the start of the #${chan ? chan.name : 'channel'} channel.</p>
  `;
  chatMessages.appendChild(welcome);

  const msgs = channelMessages[currentTextChannelId] || [];
  msgs.forEach(msg => appendMessage(msg));
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(msg) {
  const row = document.createElement('div');
  row.className = 'message-row';
  row.dataset.mid = msg.id;

  const roleBadgeHTML = msg.role ? `<span class="role-badge ${msg.role.toLowerCase()}">${msg.role}</span>` : '';
  const parsedText = parseDiscordMarkdown(msg.text);

  let attachmentHTML = '';
  if (msg.attachment && msg.attachment.type === 'image') {
    attachmentHTML = `<img src="${msg.attachment.dataUrl}" class="msg-attachment-img" alt="attachment" />`;
  }

  let replyHTML = '';
  if (msg.replyTo) {
    replyHTML = `<div class="msg-reply-snippet" style="font-size:12px; color:var(--text-muted); margin-bottom:2px;">┌ Replying to <strong>@${msg.replyTo.sender}</strong>: <em>${msg.replyTo.text.substring(0, 40)}...</em></div>`;
  }

  row.innerHTML = `
    <div class="msg-avatar">${msg.avatar || '👑'}</div>
    <div class="msg-content">
      ${replyHTML}
      <div class="msg-header">
        <span class="msg-sender">${msg.sender}</span>
        ${roleBadgeHTML}
        <span class="msg-time">${msg.timestamp}</span>
      </div>
      <div class="msg-text">${parsedText}</div>
      ${attachmentHTML}
      <div class="msg-reactions">
        ${renderReactionsHTML(msg.reactions, msg.id)}
      </div>
    </div>
    <div class="msg-hover-actions">
      <button class="msg-act-btn react-act" title="Add Reaction">😃</button>
      <button class="msg-act-btn reply-act" title="Reply">↩️</button>
    </div>
  `;

  // Action buttons
  row.querySelector('.reply-act').addEventListener('click', () => {
    replyingToMessage = msg;
    replyTargetUser.textContent = `@${msg.sender}`;
    replyBanner.classList.remove('hidden');
    chatInput.focus();
  });

  row.querySelector('.react-act').addEventListener('click', () => {
    socket.emit('toggle-reaction', {
      channelId: currentTextChannelId,
      messageId: msg.id,
      emoji: '👍'
    });
  });

  // Avatar click opens popout
  row.querySelector('.msg-avatar').addEventListener('click', (e) => {
    const sender = allUsers.get(msg.senderId) || {
      username: msg.sender,
      avatar: msg.avatar,
      tag: '#0001',
      customStatus: 'Discord Member',
      status: 'online'
    };
    openProfilePopout(sender, e.clientX, e.clientY);
  });

  chatMessages.appendChild(row);
}

function renderReactionsHTML(reactions, messageId) {
  if (!reactions) return '';
  let html = '';
  Object.entries(reactions).forEach(([emoji, userIds]) => {
    const hasReacted = userIds.includes(socket.id);
    html += `
      <div class="reaction-pill ${hasReacted ? 'reacted' : ''}" onclick="toggleMsgReaction('${messageId}', '${emoji}')">
        <span>${emoji}</span>
        <span>${userIds.length}</span>
      </div>
    `;
  });
  return html;
}

window.toggleMsgReaction = function(messageId, emoji) {
  socket.emit('toggle-reaction', {
    channelId: currentTextChannelId,
    messageId,
    emoji
  });
};

btnCancelReply.addEventListener('click', () => {
  replyingToMessage = null;
  replyBanner.classList.add('hidden');
});

// Chat Form Submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit('send-channel-message', {
    channelId: currentTextChannelId,
    text,
    replyTo: replyingToMessage ? {
      id: replyingToMessage.id,
      sender: replyingToMessage.sender,
      text: replyingToMessage.text
    } : null
  });

  chatInput.value = '';
  replyingToMessage = null;
  replyBanner.classList.add('hidden');
  socket.emit('typing-stop', { channelId: currentTextChannelId });
});

// Typing indicator debounce
let typingTimeout = null;
chatInput.addEventListener('input', () => {
  socket.emit('typing-start', { channelId: currentTextChannelId });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing-stop', { channelId: currentTextChannelId });
  }, 2000);
});

// File Upload
fileUploadInput.addEventListener('change', () => {
  const file = fileUploadInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    socket.emit('send-channel-message', {
      channelId: currentTextChannelId,
      text: `Uploaded attachment: ${file.name}`,
      attachment: {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        dataUrl: e.target.result
      }
    });
    fileUploadInput.value = '';
  };
  reader.readAsDataURL(file);
});

// --------------------------------------------------------------------------
// Soundboard & Emoji Pickers
// --------------------------------------------------------------------------
btnOpenSoundboard.addEventListener('click', (e) => {
  e.stopPropagation();
  soundboardPopover.classList.toggle('hidden');
  emojiPopover.classList.add('hidden');
});

btnCloseSoundboard.addEventListener('click', () => {
  soundboardPopover.classList.add('hidden');
});

document.querySelectorAll('.soundboard-grid .sound-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const soundId = btn.dataset.sound;
    playDiscordSound(soundId);
    socket.emit('soundboard-play', { soundId, serverId: currentServerId });
    soundboardPopover.classList.add('hidden');
  });
});

const emojisList = ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🔥','⚡','🚀','👑','💎','🎉','🎮','🕹️','🏆','🎯','🎲','🎵','🎶','🎧','🎤','🎸','🎹','🥁','☕','🍺','🍕','🍔','🍟','🍿','✨','⭐','🌟','💥','💯'];

function renderEmojiGrid() {
  emojiGrid.innerHTML = '';
  emojisList.forEach(em => {
    const b = document.createElement('button');
    b.className = 'emoji-grid-btn';
    b.textContent = em;
    b.addEventListener('click', () => {
      chatInput.value += em;
      chatInput.focus();
      emojiPopover.classList.add('hidden');
    });
    emojiGrid.appendChild(b);
  });
}
renderEmojiGrid();

btnOpenEmojis.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPopover.classList.toggle('hidden');
  soundboardPopover.classList.add('hidden');
});

// Close popovers on outside click
document.addEventListener('click', (e) => {
  if (!qualityPopover.contains(e.target) && e.target !== btnQualityMenu) {
    qualityPopover.classList.add('hidden');
  }
  if (!soundboardPopover.contains(e.target) && e.target !== btnOpenSoundboard) {
    soundboardPopover.classList.add('hidden');
  }
  if (!emojiPopover.contains(e.target) && e.target !== btnOpenEmojis) {
    emojiPopover.classList.add('hidden');
  }
  if (!profilePopout.contains(e.target)) {
    profilePopout.classList.add('hidden');
  }
  if (!serverDropdownMenu.contains(e.target) && !serverHeader.contains(e.target)) {
    serverDropdownMenu.classList.add('hidden');
    serverHeader.classList.remove('menu-open');
  }
});

// --------------------------------------------------------------------------
// Members Sidebar & User Popout
// --------------------------------------------------------------------------
btnToggleMembers.addEventListener('click', () => {
  membersSidebar.classList.toggle('hidden');
  btnToggleMembers.classList.toggle('active', !membersSidebar.classList.contains('hidden'));
});

function renderMembersList() {
  membersContainer.innerHTML = '';

  const groups = {
    OWNER: [],
    ADMIN: [],
    ONLINE: [],
    OFFLINE: []
  };

  allUsers.forEach(u => {
    if (u.role === 'OWNER') groups.OWNER.push(u);
    else if (u.role === 'ADMIN' || u.role === 'BOT') groups.ADMIN.push(u);
    else if (u.status !== 'offline') groups.ONLINE.push(u);
    else groups.OFFLINE.push(u);
  });

  Object.entries(groups).forEach(([roleTitle, userList]) => {
    if (userList.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'member-role-group';
    groupEl.innerHTML = `<div class="member-role-title">${roleTitle} — ${userList.length}</div>`;

    userList.forEach(u => {
      const card = document.createElement('div');
      card.className = 'member-card';
      card.innerHTML = `
        <div class="member-avatar-wrap">
          <div class="member-avatar">${u.avatar}</div>
          <span class="status-indicator ${u.status || 'online'}"></span>
        </div>
        <div class="member-info">
          <div class="member-name">${u.username}</div>
          <div class="member-subtext">${u.customStatus || 'Active in server'}</div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        openProfilePopout(u, e.clientX, e.clientY);
      });

      groupEl.appendChild(card);
    });

    membersContainer.appendChild(groupEl);
  });
}

function openProfilePopout(user, x, y) {
  currentPopoutUser = user;
  popoutAvatarChar.textContent = user.avatar;
  popoutStatusDot.className = `popout-status-dot ${user.status || 'online'}`;
  popoutUsernameText.textContent = user.username;
  popoutTagText.textContent = user.tag || '#0001';
  popoutCustomStatusText.textContent = user.customStatus || 'Active in Discord';

  popoutRolesList.innerHTML = `
    <span class="role-tag owner">👑 ${user.role || 'Member'}</span>
    <span class="role-tag admin">⚡ Active Member</span>
  `;

  // Position popout nicely within viewport
  const left = Math.min(x, window.innerWidth - 320);
  const top = Math.min(y, window.innerHeight - 380);
  profilePopout.style.left = `${left}px`;
  profilePopout.style.top = `${top}px`;
  profilePopout.classList.remove('hidden');
}

popoutDmBtn.addEventListener('click', () => {
  profilePopout.classList.add('hidden');
  if (currentPopoutUser && currentPopoutUser.id !== socket.id) {
    startDirectMessage(currentPopoutUser.id);
  }
});

// --------------------------------------------------------------------------
// Friends & Direct Messages (Home View)
// --------------------------------------------------------------------------
function renderFriendsList() {
  const container = document.getElementById('friends-cards-container');
  if (!container) return;
  container.innerHTML = '';

  allUsers.forEach(u => {
    if (u.id === socket.id) return;
    const card = document.createElement('div');
    card.className = 'friend-row-card';
    card.innerHTML = `
      <div class="friend-left">
        <div class="member-avatar-wrap">
          <div class="member-avatar">${u.avatar}</div>
          <span class="status-indicator ${u.status || 'online'}"></span>
        </div>
        <div class="member-info">
          <strong class="member-name">${u.username}</strong>
          <span class="member-subtext">${u.customStatus || 'Online'}</span>
        </div>
      </div>
      <div class="friend-card-actions">
        <button class="action-circle-btn msg-btn" title="Message">💬</button>
        <button class="action-circle-btn call-btn" title="Voice Call">📞</button>
      </div>
    `;

    card.querySelector('.msg-btn').addEventListener('click', () => startDirectMessage(u.id));
    card.querySelector('.call-btn').addEventListener('click', () => {
      startDirectMessage(u.id);
      playDiscordSound('ringtone');
      showToast(`📞 Calling ${u.username}...`);
    });

    container.appendChild(card);
  });
}

function renderDirectMessagesList() {
  dmConversationsList.innerHTML = '';

  allUsers.forEach(u => {
    if (u.id === socket.id) return;
    const item = document.createElement('div');
    item.className = `channel-item ${u.id === currentDmRecipientId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="channel-icon">${u.avatar}</span>
      <span class="channel-name">${u.username}</span>
    `;

    item.addEventListener('click', () => startDirectMessage(u.id));
    dmConversationsList.appendChild(item);
  });
}

function startDirectMessage(recipientId) {
  currentDmRecipientId = recipientId;
  const targetUser = allUsers.get(recipientId);

  topBarIcon.textContent = '@';
  topBarTitle.textContent = targetUser ? targetUser.username : 'Friend';
  topBarTopic.textContent = `Direct Message conversation with ${targetUser ? targetUser.username : 'Friend'}`;
  chatInput.placeholder = `Message @${targetUser ? targetUser.username : 'Friend'}`;

  switchView('chat');

  // Pair conversation ID
  const pair = [socket.id, recipientId].sort();
  const convId = `dm-${pair[0]}_${pair[1]}`;
  const msgs = directMessages[convId] || [];

  chatMessages.innerHTML = '';
  const dmWelcome = document.createElement('div');
  dmWelcome.className = 'channel-welcome-card';
  dmWelcome.innerHTML = `
    <div class="welcome-hash">@</div>
    <h1 class="welcome-title">${targetUser ? targetUser.username : 'Friend'}</h1>
    <p class="welcome-desc">This is the beginning of your direct message history with <strong>${targetUser ? targetUser.username : 'Friend'}</strong>.</p>
  `;
  chatMessages.appendChild(dmWelcome);

  msgs.forEach(msg => appendMessage(msg));
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --------------------------------------------------------------------------
// Modals: Create Server, Create Channel, User Settings
// --------------------------------------------------------------------------
function closeServerDropdown() {
  serverDropdownMenu.classList.add('hidden');
  serverHeader.classList.remove('menu-open');
}

serverHeader.addEventListener('click', (e) => {
  if (serverDropdownMenu.contains(e.target)) return;
  const isOpening = serverDropdownMenu.classList.contains('hidden');
  serverDropdownMenu.classList.toggle('hidden', !isOpening);
  serverHeader.classList.toggle('menu-open', isOpening);
});

const menuCreateChannel = document.getElementById('menu-create-channel');
if (menuCreateChannel) {
  menuCreateChannel.addEventListener('click', (e) => {
    e.stopPropagation();
    closeServerDropdown();
    const srv = servers.find(s => s.id === currentServerId);
    openCreateChannelModal(srv ? srv.categories[0].id : null);
  });
}

const menuInvitePeople = document.getElementById('menu-invite-people');
if (menuInvitePeople) {
  menuInvitePeople.addEventListener('click', (e) => {
    e.stopPropagation();
    closeServerDropdown();
    navigator.clipboard.writeText(window.location.href);
    showToast('📋 Invite link copied to clipboard!');
  });
}

const menuServerSettings = document.getElementById('menu-server-settings');
if (menuServerSettings) {
  menuServerSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    closeServerDropdown();
    showToast('⚙️ Server Settings: 1080p WebRTC enabled, Public Access OK');
  });
}

const menuLeaveServer = document.getElementById('menu-leave-server');
if (menuLeaveServer) {
  menuLeaveServer.addEventListener('click', (e) => {
    e.stopPropagation();
    closeServerDropdown();
    showToast('Cannot leave default server');
  });
}

let currentTargetCategoryId = null;
function openCreateChannelModal(categoryId) {
  currentTargetCategoryId = categoryId;
  newChannelName.value = '';
  createChannelModal.classList.remove('hidden');
}

closeCreateChannel.addEventListener('click', () => createChannelModal.classList.add('hidden'));
cancelCreateChannel.addEventListener('click', () => createChannelModal.classList.add('hidden'));

document.querySelectorAll('.channel-type-selector .type-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.channel-type-selector .type-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

confirmCreateChannel.addEventListener('click', () => {
  const name = newChannelName.value.trim();
  if (!name) return;

  const type = document.querySelector('.type-option.active').dataset.type;
  socket.emit('create-channel', {
    serverId: currentServerId,
    categoryId: currentTargetCategoryId,
    name,
    type
  });

  createChannelModal.classList.add('hidden');
});

// Create Server
btnAddServer.addEventListener('click', () => {
  newServerName.value = '';
  createServerModal.classList.remove('hidden');
});

closeCreateServer.addEventListener('click', () => createServerModal.classList.add('hidden'));
cancelCreateServer.addEventListener('click', () => createServerModal.classList.add('hidden'));

document.querySelectorAll('#server-icon-choices .avatar-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#server-icon-choices .avatar-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedServerIconEmoji = btn.dataset.icon;
  });
});

confirmCreateServer.addEventListener('click', () => {
  const name = newServerName.value.trim();
  if (!name) return;

  socket.emit('create-server', {
    name,
    icon: selectedServerIconEmoji
  });

  createServerModal.classList.add('hidden');
});

btnExploreServers.addEventListener('click', () => {
  showToast('🧭 Public Servers: DosCria Hub, Gaming HQ, Dev & Tech, Music & Chill');
});

// User Settings Modal
dockBtnSettings.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
    settingsModal.classList.add('hidden');
  }
});

settingsTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (!tab) return;
    settingsTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    settingsPanels.forEach(p => p.classList.add('hidden'));
    const activePanel = document.getElementById(`panel-${tab}`);
    if (activePanel) activePanel.classList.remove('hidden');
  });
});

btnSaveAccount.addEventListener('click', () => {
  const newName = settingsNameInput.value.trim();
  const newStatus = settingsStatusInput.value.trim();

  if (newName) {
    myUserInfo.username = newName;
    selfUsername.textContent = newName;
    settingsUsernameDisp.textContent = newName;
  }
  myUserInfo.customStatus = newStatus;

  socket.emit('update-profile', {
    username: myUserInfo.username,
    customStatus: myUserInfo.customStatus
  });

  showToast('💾 Account settings saved!');
  settingsModal.classList.add('hidden');
});

// Theme Switcher
themeCards.forEach(card => {
  card.addEventListener('click', () => {
    themeCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const theme = card.dataset.theme;

    document.body.classList.remove('theme-dark', 'theme-midnight', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('discord-theme', theme);
    showToast(`🎨 Theme changed to ${theme.toUpperCase()}`);
  });
});

// Saved Theme bootstrap
const savedTheme = localStorage.getItem('discord-theme');
if (savedTheme) {
  document.body.classList.remove('theme-dark', 'theme-midnight', 'theme-light');
  document.body.classList.add(`theme-${savedTheme}`);
  const card = document.querySelector(`.theme-card[data-theme="${savedTheme}"]`);
  if (card) {
    themeCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  }
}

// Sound Settings
soundVolSlider.addEventListener('input', () => {
  soundVolume = parseFloat(soundVolSlider.value) / 100;
  document.querySelectorAll('audio[data-peer-audio]').forEach(a => {
    a.volume = soundVolume;
  });
});

document.getElementById('test-join-sound').addEventListener('click', () => playDiscordSound('discord-join'));
document.getElementById('test-msg-sound').addEventListener('click', () => playDiscordSound('message'));
document.getElementById('test-ring-sound').addEventListener('click', () => playDiscordSound('ringtone'));

document.getElementById('btn-settings-logout').addEventListener('click', () => {
  window.location.reload();
});

if (btnCopyInvite) {
  btnCopyInvite.addEventListener('click', () => {
    const inviteUrl = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast('📋 Link copied! Send this URL to your friend.');
      }).catch(() => {
        prompt('Copy your invite link:', inviteUrl);
      });
    } else {
      prompt('Copy your invite link:', inviteUrl);
    }
  });
}

console.log('⚡ Discord Full Web Engine loaded successfully.');
