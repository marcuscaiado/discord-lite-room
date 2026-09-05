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
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
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

// Web Audio Master Mixer & DSP
let audioCtx = null;
let masterMixDestination = null;
let masterAudioTrack = null;
let micSourceNode = null;
let micGainNode = null;
let screenAudioSourceNode = null;
let screenGainNode = null;
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
const btnDockVoiceInfo = document.getElementById('btn-dock-voice-info');
const dockBtnCam = document.getElementById('dock-btn-cam');
const dockBtnScreen = document.getElementById('dock-btn-screen');
const dockBtnStage = document.getElementById('dock-btn-stage');
const dockBtnSoundboard = document.getElementById('dock-btn-soundboard');
const btnStageChat = document.getElementById('btn-stage-chat');

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
const topBtnScreen = document.getElementById('top-btn-screen');
const topBtnCam = document.getElementById('top-btn-cam');
const btnChatScreen = document.getElementById('btn-chat-screen');
const liveStreamBar = document.getElementById('live-stream-bar');
const liveStreamText = document.getElementById('live-stream-text');
const btnWatchStream = document.getElementById('btn-watch-stream');
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
  document.querySelectorAll('video').forEach(v => {
    if (v.paused && v.srcObject) {
      v.play().catch(() => {});
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

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
    } catch (e) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function initMasterAudioMixer() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (!masterMixDestination) {
    masterMixDestination = ctx.createMediaStreamDestination();
    const tracks = masterMixDestination.stream.getAudioTracks();
    if (tracks.length > 0) {
      masterAudioTrack = tracks[0];
      masterAudioTrack.enabled = true;
    }
  }
  return masterMixDestination;
}

function getMasterAudioTrack() {
  if (masterAudioTrack && masterAudioTrack.readyState === 'live') {
    return masterAudioTrack;
  }
  initMasterAudioMixer();
  if (masterAudioTrack && masterAudioTrack.readyState === 'live') {
    return masterAudioTrack;
  }
  return localAudioStream ? localAudioStream.getAudioTracks()[0] : null;
}

function attachScreenAudioToMixer(screenStream) {
  const audioTracks = screenStream ? screenStream.getAudioTracks() : [];
  if (!audioTracks || audioTracks.length === 0) {
    console.log('[Audio Mixer] Screen share has no audio track.');
    return false;
  }

  const screenAudioTrack = audioTracks[0];
  console.log(`[Audio Mixer] 🔊 Attaching screen audio track (${screenAudioTrack.id}) to Master Mixer`);

  const ctx = getAudioContext();
  if (!ctx) return false;

  initMasterAudioMixer();

  if (screenGainNode) {
    try { screenGainNode.disconnect(); } catch (e) {}
    screenGainNode = null;
  }
  if (screenAudioSourceNode) {
    try { screenAudioSourceNode.disconnect(); } catch (e) {}
    screenAudioSourceNode = null;
  }

  try {
    screenAudioSourceNode = ctx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
    screenGainNode = ctx.createGain();
    screenGainNode.gain.value = 1.0;
    screenAudioSourceNode.connect(screenGainNode);
    screenGainNode.connect(masterMixDestination);
    console.log('[Audio Mixer] ✅ Screen audio mixed into Master Audio stream!');
    return true;
  } catch (err) {
    console.warn('[Audio Mixer] Error mixing screen audio track:', err);
    return false;
  }
}

function detachScreenAudioFromMixer() {
  if (screenGainNode) {
    try { screenGainNode.disconnect(); } catch (e) {}
    screenGainNode = null;
  }
  if (screenAudioSourceNode) {
    try { screenAudioSourceNode.disconnect(); } catch (e) {}
    screenAudioSourceNode = null;
  }
  console.log('[Audio Mixer] Screen audio detached from Master Mixer.');
}

function ensureMasterAudioOnPeer(pc) {
  const track = getMasterAudioTrack();
  if (!track) return;
  const senders = pc.getSenders();
  const audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
                      senders.find(s => !s.track);
  if (audioSender) {
    audioSender.replaceTrack(track).catch(e => console.warn('replaceTrack audio error:', e));
  } else {
    try {
      const streamToSend = masterMixDestination ? masterMixDestination.stream : localAudioStream;
      pc.addTrack(track, streamToSend);
    } catch (e) {
      console.warn('addTrack master audio error:', e);
    }
  }
}

async function ensureLocalMic() {
  if (localAudioStream && localAudioStream.getAudioTracks().length > 0 && localAudioStream.getAudioTracks()[0].readyState === 'live') {
    const track = localAudioStream.getAudioTracks()[0];
    track.enabled = !isMuted;
    if (micGainNode) micGainNode.gain.value = isMuted ? 0 : 1;
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
      audioTrack.enabled = true;
    }

    setupAudioDSP(rawStream);

    // Update tracks on any active WebRTC peer connections
    peers.forEach((pc) => {
      ensureMasterAudioOnPeer(pc);
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
    const ctx = getAudioContext();
    if (!ctx) return rawStream;

    initMasterAudioMixer();

    if (micGainNode) {
      try { micGainNode.disconnect(); } catch (e) {}
      micGainNode = null;
    }
    if (micSourceNode) {
      try { micSourceNode.disconnect(); } catch (e) {}
      micSourceNode = null;
    }

    micSourceNode = ctx.createMediaStreamSource(rawStream);
    micGainNode = ctx.createGain();
    micGainNode.gain.value = isMuted ? 0 : 1;

    micSourceNode.connect(micGainNode);
    micGainNode.connect(masterMixDestination);

    // RMS Analyser for settings VU meter & speaking ring (does NOT mute outgoing audio!)
    noiseAnalyser = ctx.createAnalyser();
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
      showToast('🔊 Click anywhere on Caller to enable audio playback!');
    });
  }
}

// --------------------------------------------------------------------------
// Join Flow
// --------------------------------------------------------------------------
const savedName = localStorage.getItem('caller-username') || localStorage.getItem('discord-username');
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
  localStorage.setItem('caller-username', name);
  localStorage.setItem('discord-username', name);
  joinModal.classList.add('hidden');

  unlockAllAudio();

  // Acquire local microphone stream with high quality AEC/AGC
  await ensureLocalMic();

  // Connect user to server
  socket.emit('join-caller', {
    username: name,
    customStatus,
    avatar: selectedAvatarEmoji
  });
  socket.emit('join-discord', {
    username: name,
    customStatus,
    avatar: selectedAvatarEmoji
  });
}
window.joinCaller = joinDiscord;

// --------------------------------------------------------------------------
// Socket Events
// --------------------------------------------------------------------------
function handleInitData(data) {
  if (myUserInfo) return; // already initialized
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
  showToast(`⚡ Connected to Caller Live as ${myUserInfo.username}! Connecting to room...`);

  // Auto-connect to voice & stage immediately so you and your friend speak with zero extra clicks
  const urlParams = new URLSearchParams(window.location.search);
  const requestedRoom = urlParams.get('room');
  if (requestedRoom) {
    connectVoiceChannel(requestedRoom);
  } else {
    connectVoiceChannel('v-lounge');
  }
}

socket.on('caller-init', handleInitData);
socket.on('discord-init', handleInitData);

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
  const discordLayout = document.querySelector('.discord-layout');
  if (discordLayout) discordLayout.classList.remove('mobile-drawer-open');
}

// --------------------------------------------------------------------------
// View Switcher (Chat vs Stage vs Friends)
// --------------------------------------------------------------------------
function switchView(viewName) {
  activeView = viewName;
  viewChat.classList.remove('active', 'hidden');
  viewStage.classList.remove('active', 'hidden');
  viewFriends.classList.remove('active', 'hidden');

  if (viewName === 'chat') {
    viewChat.classList.add('active');
  } else if (viewName === 'stage') {
    viewStage.classList.add('active');
  } else if (viewName === 'friends') {
    viewFriends.classList.add('active');
  }

  btnToggleVoiceStage.classList.toggle('active', viewName === 'stage');
  if (dockBtnStage) dockBtnStage.classList.toggle('active', viewName === 'stage');

  // Auto-close any mobile drawers when switching views (e.g. entering stage view)
  const layout = document.querySelector('.discord-layout');
  if (layout) {
    layout.classList.remove('mobile-drawer-open');
    layout.classList.remove('mobile-members-open');
  }
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }
}

// --------------------------------------------------------------------------
// WebRTC Voice & Video Connection
// --------------------------------------------------------------------------
btnToggleVoiceStage.addEventListener('click', () => {
  if (activeView === 'stage') {
    switchView('chat');
  } else {
    switchView('stage');
  }
});

if (dockBtnStage) {
  dockBtnStage.addEventListener('click', () => {
    if (activeView === 'stage') {
      switchView('chat');
    } else {
      switchView('stage');
    }
  });
}

if (btnDockVoiceInfo) {
  btnDockVoiceInfo.addEventListener('click', () => switchView('stage'));
}

if (topBtnScreen) {
  topBtnScreen.addEventListener('click', () => startOrStopScreenShare());
}
if (btnChatScreen) {
  btnChatScreen.addEventListener('click', () => startOrStopScreenShare());
}
if (dockBtnScreen) {
  dockBtnScreen.addEventListener('click', () => startOrStopScreenShare());
}

async function ensureVoiceAndCam() {
  if (!currentVoiceChannelId) {
    const srv = servers.find(s => s.id === currentServerId) || servers[0];
    const defaultVoice = srv?.categories?.flatMap(c => c.channels)?.find(ch => ch.type === 'voice');
    const targetChannelId = defaultVoice ? defaultVoice.id : 'v-lounge';
    await connectVoiceChannel(targetChannelId);
  }
  toggleCamera();
}

if (topBtnCam) {
  topBtnCam.addEventListener('click', ensureVoiceAndCam);
}
if (dockBtnCam) {
  dockBtnCam.addEventListener('click', ensureVoiceAndCam);
}

// Mobile Drawer Listeners
const btnMobileDrawer = document.getElementById('btn-mobile-drawer');
const mobileDrawerBackdrop = document.getElementById('mobile-drawer-backdrop');

if (btnMobileDrawer) {
  btnMobileDrawer.addEventListener('click', () => {
    const layout = document.querySelector('.discord-layout');
    if (layout) {
      layout.classList.remove('mobile-members-open');
      layout.classList.toggle('mobile-drawer-open');
    }
  });
}
if (mobileDrawerBackdrop) {
  mobileDrawerBackdrop.addEventListener('click', () => {
    const layout = document.querySelector('.discord-layout');
    if (layout) {
      layout.classList.remove('mobile-drawer-open');
      layout.classList.remove('mobile-members-open');
    }
  });
}

if (btnWatchStream) {
  btnWatchStream.addEventListener('click', () => switchView('stage'));
}

if (dockBtnSoundboard) {
  dockBtnSoundboard.addEventListener('click', (e) => {
    e.stopPropagation();
    soundboardPopover.classList.toggle('hidden');
  });
}

if (btnStageChat) {
  btnStageChat.addEventListener('click', () => switchView('chat'));
}

async function connectVoiceChannel(channelId) {
  if (currentVoiceChannelId === channelId) {
    // If already connected, simply toggle stage view
    switchView('stage');
    return;
  }

  unlockAllAudio();
  await ensureLocalMic();

  currentVoiceChannelId = channelId;
  const srv = servers.find(s => s.id === currentServerId);
  const vChan = srv?.categories.flatMap(c => c.channels).find(ch => ch.id === channelId);

  // Update Voice Status Dock
  if (voiceStatusDock) {
    voiceStatusDock.classList.remove('hidden');
    voiceStatusDock.classList.add('connected');
  }
  if (connectedVoiceName) {
    connectedVoiceName.textContent = `${vChan ? vChan.name : 'Voice'} / ${srv ? srv.name : 'Server'}`;
  }
  if (btnToggleVoiceStage) btnToggleVoiceStage.classList.remove('hidden');

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
  const layout = document.querySelector('.discord-layout');
  if (layout) layout.classList.remove('mobile-drawer-open');
}

btnVoiceDisconnect.addEventListener('click', disconnectVoice);
btnLeaveStage.addEventListener('click', disconnectVoice);

function disconnectVoice() {
  if (isScreenSharing) {
    stopScreenShare();
  }
  if (isCameraOn) {
    btnCam.click();
  }
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
  // Keep the voice dock permanently visible so buttons are ALWAYS available!
  if (connectedVoiceName) connectedVoiceName.textContent = 'Not in Voice (Click Stream to Start)';
  if (voiceStatusDock) voiceStatusDock.classList.remove('connected');
  if (dockBtnScreen) dockBtnScreen.classList.remove('streaming');
  if (topBtnScreen) {
    topBtnScreen.classList.remove('streaming');
    const t = topBtnScreen.querySelector('.btn-text');
    if (t) t.textContent = 'Share Screen';
  }
  if (btnChatScreen) btnChatScreen.classList.remove('active');
  if (dockBtnCam) dockBtnCam.classList.remove('active');
  if (topBtnCam) topBtnCam.classList.remove('active');
  if (dockBtnStage) dockBtnStage.classList.remove('active');
  if (liveStreamBar) liveStreamBar.classList.add('hidden');

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

// Ensure universal mobile & desktop video decoding compatibility (H.264 > VP8 > others)
function setPreferredVideoCodecs(transceiver) {
  if (!transceiver || !transceiver.setCodecPreferences) return;
  if (!window.RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
  try {
    const caps = RTCRtpReceiver.getCapabilities('video');
    if (!caps || !caps.codecs) return;

    const h264Codecs = caps.codecs.filter(c => c.mimeType && c.mimeType.toLowerCase() === 'video/h264');
    const vp8Codecs = caps.codecs.filter(c => c.mimeType && c.mimeType.toLowerCase() === 'video/vp8');
    const otherCodecs = caps.codecs.filter(c => c.mimeType && c.mimeType.toLowerCase() !== 'video/h264' && c.mimeType.toLowerCase() !== 'video/vp8');

    const ordered = [...h264Codecs, ...vp8Codecs, ...otherCodecs];
    transceiver.setCodecPreferences(ordered);
  } catch (err) {
    console.warn('[WebRTC] setCodecPreferences note:', err);
  }
}

// SDP Munger: Forces H264 payload types to the beginning of m=video line so mobile devices hardware-decode
function prioritizeH264InSdp(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;
  try {
    const lines = sdp.split('\r\n');
    const mVideoIndex = lines.findIndex(l => l.startsWith('m=video '));
    if (mVideoIndex === -1) return sdp;

    const h264Payloads = [];
    lines.forEach(l => {
      const match = l.match(/^a=rtpmap:(\d+)\s+H264\/90000/i);
      if (match) h264Payloads.push(match[1]);
    });

    if (h264Payloads.length === 0) return sdp;

    const parts = lines[mVideoIndex].split(' ');
    const header = parts.slice(0, 3);
    const currentPayloads = parts.slice(3);
    const nonH264 = currentPayloads.filter(pt => !h264Payloads.includes(pt));
    lines[mVideoIndex] = [...header, ...h264Payloads, ...nonH264].join(' ');
    return lines.join('\r\n');
  } catch (err) {
    console.warn('[WebRTC] Error prioritizing H264 in SDP:', err);
    return sdp;
  }
}

async function sendOfferToPeer(pc, targetId, options = {}) {
  try {
    pc.getTransceivers().forEach(tr => setPreferredVideoCodecs(tr));
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true, ...options });
    const mungedSdp = prioritizeH264InSdp(offer.sdp);
    await pc.setLocalDescription({ type: offer.type, sdp: mungedSdp });
    socket.emit('signal-offer', { targetId, sdp: pc.localDescription });
    return true;
  } catch (err) {
    console.warn(`[WebRTC] sendOfferToPeer error for ${targetId}:`, err);
    return false;
  }
}

async function sendAnswerToPeer(pc, targetId) {
  try {
    pc.getTransceivers().forEach(tr => setPreferredVideoCodecs(tr));
    const answer = await pc.createAnswer();
    const mungedSdp = prioritizeH264InSdp(answer.sdp);
    await pc.setLocalDescription({ type: answer.type, sdp: mungedSdp });
    socket.emit('signal-answer', { targetId, sdp: pc.localDescription });
    return true;
  } catch (err) {
    console.warn(`[WebRTC] sendAnswerToPeer error for ${targetId}:`, err);
    return false;
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
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].enabled) {
      const activeVideoTrack = videoTracks[0];
      const currentTrack = video.srcObject && video.srcObject.getVideoTracks && video.srcObject.getVideoTracks()[0];
      if (currentTrack !== activeVideoTrack) {
        video.srcObject = new MediaStream([activeVideoTrack]);
      }
      tile.classList.add('has-video');
      video.play().catch(e => console.warn('Autoplay video note:', e));

      activeVideoTrack.onunmute = () => {
        tile.classList.add('has-video');
        video.play().catch(() => {});
      };
      activeVideoTrack.onended = () => {
        tile.classList.remove('has-video');
      };
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
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }
}

// Socket Voice Handlers
socket.on('voice-channel-joined', async ({ channelId, participants }) => {
  await ensureLocalMic();
  // Register and display all existing participants in room immediately
  for (const p of participants) {
    allUsers.set(p.id, p);
    refreshRemoteStreamTile(p.id);
    await createPeerConnection(p.id, true);

    // Zero-Refresh Stream Detection: If any existing member is streaming, show banner & stage
    if (p.isScreenSharing) {
      if (liveStreamBar) {
        liveStreamBar.classList.remove('hidden');
        if (liveStreamText) liveStreamText.textContent = `📺 ${p.username} is sharing their screen!`;
      }
      switchView('stage');
    }
  }
});

socket.on('voice-user-joined', async ({ channelId, user }) => {
  allUsers.set(user.id, user);
  playDiscordSound('discord-join');
  showToast(`👤 ${user.username} joined voice.`);

  await ensureLocalMic();
  refreshRemoteStreamTile(user.id);

  // If local user is currently sharing screen, immediately push stream tracks to this new user!
  if (isScreenSharing && localScreenStream) {
    const screenVideoTrack = localScreenStream.getVideoTracks()[0];
    if (screenVideoTrack) {
      console.log(`[Streamer] Directly pushing screen stream to newly joined peer ${user.username} (${user.id})`);
      const pc = await createPeerConnection(user.id, true);
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                          senders.find(s => !s.track);
      if (videoSender) {
        await videoSender.replaceTrack(screenVideoTrack);
      } else {
        pc.addTrack(screenVideoTrack, localScreenStream);
      }
      ensureMasterAudioOnPeer(pc);
      await sendOfferToPeer(pc, user.id);
    }
  }
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

// WebRTC Peer Connection Factory with Creation Mutex & sendrecv Transceiver Fallback
const peerCreationLocks = new Map(); // targetId -> Promise<RTCPeerConnection>

async function createPeerConnection(targetId, isInitiator) {
  if (peers.has(targetId)) return peers.get(targetId);
  if (peerCreationLocks.has(targetId)) {
    return peerCreationLocks.get(targetId);
  }

  const creationPromise = (async () => {
    const pc = new RTCPeerConnection(rtcConfig);
    peers.set(targetId, pc);

    // 1. Add local audio track from Master Mixer (crystal-clear voice + mixed stream audio)
    const masterTrack = getMasterAudioTrack();
    if (masterTrack) {
      pc.addTrack(masterTrack, masterMixDestination ? masterMixDestination.stream : localAudioStream);
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

    // Prioritize universal H264 hardware codecs on all transceivers
    pc.getTransceivers().forEach(tr => setPreferredVideoCodecs(tr));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { targetId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = async () => {
      console.log(`[WebRTC] Peer ${targetId} connection state:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        const u = allUsers.get(targetId);
        showToast(`🟢 Voice connected with ${u ? u.username : 'friend'}`);
        unlockAllAudio();
        refreshRemoteStreamTile(targetId);
      } else if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Connection failed with ${targetId}, attempting automated ICE restart`);
        try {
          if (pc.restartIce) pc.restartIce();
          await sendOfferToPeer(pc, targetId, { iceRestart: true });
        } catch (err) {
          console.warn('ICE restart error:', err);
        }
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC] Received remote ${track.kind} track (${track.id}) from ${targetId}`);

      let stream = remoteStreams.get(targetId);
      if (!stream) {
        stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream();
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

        track.onunmute = () => {
          console.log(`[WebRTC] Video track onunmute from ${targetId}`);
          refreshRemoteStreamTile(targetId);
        };
        track.onmute = () => refreshRemoteStreamTile(targetId);
        track.onended = () => {
          stream.removeTrack(track);
          refreshRemoteStreamTile(targetId);
        };
      }

      refreshRemoteStreamTile(targetId);
    };

    if (isInitiator) {
      await sendOfferToPeer(pc, targetId);
    }

    return pc;
  })();

  peerCreationLocks.set(targetId, creationPromise);
  try {
    const pc = await creationPromise;
    return pc;
  } finally {
    peerCreationLocks.delete(targetId);
  }
}

function closePeer(userId) {
  const pc = peers.get(userId);
  if (pc) {
    try { pc.close(); } catch (e) {}
    peers.delete(userId);
  }
  remoteStreams.delete(userId);
  pendingCandidates.delete(userId);
  peerCreationLocks.delete(userId);

  // Remove all audio elements belonging to this peer
  document.querySelectorAll(`audio[data-peer-audio="${userId}"]`).forEach(el => el.remove());

  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.remove();
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }
}

// WebRTC Signaling Handlers (with rollback support & pending ICE queue)
socket.on('signal-offer', async ({ callerId, sdp }) => {
  await ensureLocalMic();
  const pc = await createPeerConnection(callerId, false);
  try {
    const isPolite = socket.id < callerId;
    const offerCollision = pc.signalingState !== 'stable';
    if (offerCollision) {
      if (!isPolite) {
        console.log(`[WebRTC] Glare collision detected, impolite peer ignoring offer from ${callerId}`);
        return;
      }
      console.log(`[WebRTC] Glare collision detected, polite peer rolling back for ${callerId}`);
      try {
        await pc.setLocalDescription({ type: 'rollback' });
      } catch (rb) {
        console.warn('Rollback failed:', rb);
      }
    }
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushPendingCandidates(callerId);
    await sendAnswerToPeer(pc, callerId);
    refreshRemoteStreamTile(callerId);
  } catch (e) {
    console.error('Error handling offer:', e);
  }
});

socket.on('signal-answer', async ({ callerId, sdp }) => {
  const pc = peers.get(callerId);
  if (pc) {
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(callerId);
        refreshRemoteStreamTile(callerId);
      } else {
        console.warn(`[WebRTC] Ignored signal-answer from ${callerId} because state is ${pc.signalingState}`);
      }
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
  if (currentVoiceChannelId) {
    switchView('stage');
  }
  if (liveStreamBar) {
    liveStreamBar.classList.remove('hidden');
    if (liveStreamText) liveStreamText.textContent = `📺 ${username} is sharing their screen!`;
  }
  showToast(`📺 ${username} is sharing their screen!`);
});

socket.on('stream-stopped', ({ id, username }) => {
  const u = allUsers.get(id);
  if (u) u.isScreenSharing = false;
  refreshRemoteStreamTile(id);
  const anyoneSharing = Array.from(allUsers.values()).some(usr => usr.isScreenSharing) || isScreenSharing;
  if (!anyoneSharing && liveStreamBar) {
    liveStreamBar.classList.add('hidden');
  }
  showToast(`📺 ${username} stopped screen share.`);
});

// Streamer responds when a peer needs our screen stream (late joiners or auto-sync)
socket.on('peer-needs-stream', async ({ peerId, peerUsername }) => {
  console.log(`[Streamer] Peer ${peerUsername} (${peerId}) needs our stream!`);
  if (!isScreenSharing || !localScreenStream) return;

  const screenVideoTrack = localScreenStream.getVideoTracks()[0];
  if (!screenVideoTrack) return;

  try {
    const pc = await createPeerConnection(peerId, true);
    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                        senders.find(s => !s.track);
    if (videoSender) {
      await videoSender.replaceTrack(screenVideoTrack);
    } else {
      pc.addTrack(screenVideoTrack, localScreenStream);
    }

    ensureMasterAudioOnPeer(pc);
    await sendOfferToPeer(pc, peerId);
    console.log(`[Streamer] Successfully sent live stream offer to peer ${peerId}`);
  } catch (err) {
    console.warn('[Streamer] Error sending stream offer to peer:', err);
  }
});

// High-Frequency 1000ms Global Sync Heartbeat Reconciler (Guaranteed instant sync across 10+ users)
let lastStreamRequestTime = 0;

socket.on('global-sync', (data) => {
  if (!data) return;

  // 1. Reconcile allUsers map
  const activeIds = new Set();
  if (Array.isArray(data.users)) {
    data.users.forEach(u => {
      activeIds.add(u.id);
      const existing = allUsers.get(u.id);
      if (existing) {
        Object.assign(existing, u);
      } else {
        allUsers.set(u.id, u);
      }
    });

    // Remove users who have disconnected
    for (const [id] of allUsers) {
      if (!activeIds.has(id) && id !== socket.id) {
        allUsers.delete(id);
        closePeer(id);
      }
    }
  }

  // 2. Reconcile voice channel memberships
  if (Array.isArray(data.voiceMembers)) {
    data.voiceMembers.forEach(([cid, memberArr]) => {
      voiceMembers.set(cid, new Set(memberArr));
    });
    renderVoiceNestedMembers();
  }

  // 3. Reconcile active screen streams in current voice room
  if (currentVoiceChannelId && Array.isArray(data.activeStreams)) {
    const activeStreamer = data.activeStreams.find(s => s.channelId === currentVoiceChannelId && s.id !== socket.id);
    if (activeStreamer) {
      if (liveStreamBar) {
        liveStreamBar.classList.remove('hidden');
        if (liveStreamText) liveStreamText.textContent = `📺 ${activeStreamer.username} is sharing their screen!`;
      }
      const streamerUser = allUsers.get(activeStreamer.id);
      if (streamerUser) streamerUser.isScreenSharing = true;

      // Check if we already have an active video stream for this streamer
      const remoteStream = remoteStreams.get(activeStreamer.id);
      const hasLiveVideo = remoteStream && remoteStream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);

      if (!hasLiveVideo) {
        const now = Date.now();
        // Request stream from streamer if not received yet (throttled every 3s)
        if (now - lastStreamRequestTime > 3000) {
          lastStreamRequestTime = now;
          console.log(`[Global Sync] Auto-requesting screen stream from ${activeStreamer.username} (${activeStreamer.id})`);
          socket.emit('request-peer-stream', { streamerId: activeStreamer.id });
        }
      } else {
        refreshRemoteStreamTile(activeStreamer.id);
      }
    } else {
      if (!isScreenSharing && liveStreamBar) {
        liveStreamBar.classList.add('hidden');
      }
    }
  }

  renderMembersList();
  renderFriendsList();
  renderDirectMessagesList();
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }
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
    // Cleanly close any stale peer connections from previous session
    peers.forEach(p => { try { p.close(); } catch (e) {} });
    peers.clear();
    remoteStreams.clear();
    pendingCandidates.clear();
    peerCreationLocks.clear();
    document.querySelectorAll('audio[data-peer-audio]').forEach(el => el.remove());

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
function updateVideoGridStreamState() {
  if (!videoGrid) return;
  const hasScreenTile = !!videoGrid.querySelector('.screen-tile');
  const hasAnyScreen = hasScreenTile || isScreenSharing || Array.from(allUsers.values()).some(u => u.isScreenSharing);
  videoGrid.classList.toggle('has-active-stream', hasAnyScreen);
}

function addLocalVideoTile() {
  const existing = document.getElementById('tile-self');
  if (existing) existing.remove();

  const tile = createVideoTile('tile-self', (myUserInfo ? myUserInfo.username : 'You') + ' (You)', localAudioStream, true, false, 'self');
  videoGrid.appendChild(tile);
  updateVideoGridStreamState();
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
  updateVideoGridStreamState();
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
    <video autoplay playsinline webkit-playsinline muted defaultMuted></video>
    <div class="tile-overlay"><span>${label}</span></div>
    <div class="tile-top-actions">
      <button class="tile-action-btn btn-max" title="Maximize">🗖 Maximize</button>
      <button class="tile-action-btn btn-fs" title="Fullscreen">⛶ Fullscreen</button>
    </div>
  `;

  const video = tile.querySelector('video');
  video.muted = true; // Video element in grid is muted to prevent audio collision with dedicated player!
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');

  if (stream) {
    const vTracks = stream.getVideoTracks();
    const hasVideo = vTracks.length > 0 && vTracks[0].enabled;
    tile.classList.toggle('has-video', hasVideo);
    if (hasVideo) {
      video.srcObject = new MediaStream([vTracks[0]]);
      video.play().catch(e => console.warn('Autoplay video note:', e));
      vTracks[0].onunmute = () => { tile.classList.add('has-video'); video.play().catch(() => {}); };
      vTracks[0].onended = () => { tile.classList.remove('has-video'); };
    }
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
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (tile.requestFullscreen) {
        tile.requestFullscreen().catch(() => {
          if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        });
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  video.ondblclick = (e) => {
    e.stopPropagation();
    fsBtn.click();
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
  if (micGainNode) {
    micGainNode.gain.value = isMuted ? 0 : 1;
  }
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

async function toggleCamera() {
  if (!isCameraOn) {
    try {
      localVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const videoTrack = localVideoStream.getVideoTracks()[0];

      // Replace track on existing video senders or add, then renegotiate with H264
      peers.forEach(async (pc, targetId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                            senders.find(s => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, localVideoStream);
        }
        await sendOfferToPeer(pc, targetId);
      });

      // Update local tile
      const selfVideo = document.querySelector('#tile-self video');
      if (selfVideo) selfVideo.srcObject = localVideoStream;

      isCameraOn = true;
      btnCam.classList.add('highlight');
      btnCam.querySelector('.btn-text').textContent = 'Stop Cam';
      if (dockBtnCam) dockBtnCam.classList.add('active');
      if (topBtnCam) topBtnCam.classList.add('active');
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
      await sendOfferToPeer(pc, targetId);
    });

    const selfVideo = document.querySelector('#tile-self video');
    if (selfVideo && localAudioStream) selfVideo.srcObject = localAudioStream;

    isCameraOn = false;
    btnCam.classList.remove('highlight');
    btnCam.querySelector('.btn-text').textContent = 'Camera';
    if (dockBtnCam) dockBtnCam.classList.remove('active');
    if (topBtnCam) topBtnCam.classList.remove('active');
    socket.emit('media-state-change', { isCameraOn: false });
    showToast('📹 Camera Turned Off');
  }
}
btnCam.addEventListener('click', toggleCamera);

// Screen share UI state synchronizer
function updateScreenSharingUI(isSharing) {
  if (btnScreen) {
    btnScreen.classList.toggle('danger', isSharing);
    const t = btnScreen.querySelector('.btn-text');
    if (t) t.textContent = isSharing ? 'Stop Sharing' : 'Share Screen';
  }
  if (dockBtnScreen) dockBtnScreen.classList.toggle('streaming', isSharing);
  if (topBtnScreen) {
    topBtnScreen.classList.toggle('streaming', isSharing);
    const t = topBtnScreen.querySelector('.btn-text');
    if (t) t.textContent = isSharing ? 'Stop Stream' : 'Share Screen';
  }
  if (btnChatScreen) btnChatScreen.classList.toggle('active', isSharing);
  if (liveStreamBar) {
    if (isSharing) {
      liveStreamBar.classList.remove('hidden');
      if (liveStreamText) liveStreamText.textContent = '📺 You are sharing your screen!';
    }
  }
}

async function activateLocalScreenStream(stream, isMobileCam = false) {
  localScreenStream = stream;
  const screenVideoTrack = localScreenStream.getVideoTracks()[0];
  if (!screenVideoTrack) return;

  const hasAudioTrack = attachScreenAudioToMixer(localScreenStream);

  screenVideoTrack.onended = () => {
    stopScreenShare();
  };

  peers.forEach(async (pc, targetId) => {
    ensureMasterAudioOnPeer(pc);

    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
                        senders.find(s => !s.track);
    if (videoSender) {
      await videoSender.replaceTrack(screenVideoTrack);
    } else {
      pc.addTrack(screenVideoTrack, localScreenStream);
    }

    await sendOfferToPeer(pc, targetId);
  });

  const label = isMobileCam ? 'Your Mobile Stream (Live)' : 'Your Stream (1080p)';
  const screenTile = createVideoTile('tile-screen-self', label, new MediaStream([screenVideoTrack]), true, true, 'self');
  const existingTile = document.getElementById('tile-screen-self');
  if (existingTile) existingTile.remove();
  videoGrid.prepend(screenTile);
  switchView('stage');
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }

  isScreenSharing = true;
  updateScreenSharingUI(true);
  socket.emit('stream-started', { resolution: streamResolution, fps: streamFps, hasAudio: hasAudioTrack });
  socket.emit('media-state-change', { isScreenSharing: true });
  showToast(hasAudioTrack ? '📺 Stream Started (with Audio 🔊)' : '📺 Stream Started!');
}

async function startMobileCameraStream() {
  try {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    await activateLocalScreenStream(camStream, true);
    showToast('📱 Streaming Live Mobile Camera to Stage!');
  } catch (camErr) {
    console.warn('[MobileStream] Camera fallback error:', camErr);
    showToast('⚠️ Could not access screen or camera for streaming.');
  }
}

async function startOrStopScreenShare() {
  if (isScreenSharing) {
    stopScreenShare();
    return;
  }

  // Ensure user is in voice channel without breaking user gesture token
  if (!currentVoiceChannelId) {
    const srv = servers.find(s => s.id === currentServerId) || servers[0];
    const defaultVoice = srv?.categories?.flatMap(c => c.channels)?.find(ch => ch.type === 'voice');
    const targetChannelId = defaultVoice ? defaultVoice.id : 'v-lounge';
    connectVoiceChannel(targetChannelId);
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

  let stream = null;
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
    try {
      if (isMobile) {
        // Mobile-safe displayMedia constraints: only video, no system audio constraints (Safari compliance)
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        const fps = parseInt(streamFps, 10) || 30;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: fps, max: 60 },
              width: streamResolution === '720' ? 1280 : 1920,
              height: streamResolution === '720' ? 720 : 1080
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: 2,
              sampleRate: 48000
            },
            systemAudio: 'include',
            selfBrowserSurface: 'include'
          });
        } catch (desktopErr) {
          console.warn('[ScreenShare] Desktop advanced constraints failed, falling back to basic:', desktopErr);
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }
      }
    } catch (err) {
      console.warn('[ScreenShare] getDisplayMedia error/denied:', err);
      if (isMobile) {
        showToast('📱 Mobile screen capture blocked. Starting Live HD Camera Stream instead!');
        await startMobileCameraStream();
        return;
      } else {
        showToast('⚠️ Screen share canceled or not permitted.');
        return;
      }
    }
  } else {
    // getDisplayMedia not supported on this mobile browser
    if (isMobile) {
      showToast('📱 Screen capture not supported on this browser. Starting Live HD Camera Stream instead!');
      await startMobileCameraStream();
      return;
    } else {
      showToast('⚠️ Screen sharing is not supported on this browser.');
      return;
    }
  }

  if (stream) {
    await activateLocalScreenStream(stream, false);
  }
}

function stopScreenShare() {
  detachScreenAudioFromMixer();

  if (localScreenStream) {
    localScreenStream.getTracks().forEach(t => t.stop());
    localScreenStream = null;
  }
  const screenTile = document.getElementById('tile-screen-self');
  if (screenTile) screenTile.remove();
  if (typeof updateVideoGridStreamState === 'function') {
    updateVideoGridStreamState();
  }

  peers.forEach(async (pc, targetId) => {
    ensureMasterAudioOnPeer(pc);

    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    if (videoSender) {
      const fallbackTrack = (localVideoStream && localVideoStream.getVideoTracks()[0]) || null;
      await videoSender.replaceTrack(fallbackTrack);
    }
    await sendOfferToPeer(pc, targetId);
  });

  isScreenSharing = false;
  updateScreenSharingUI(false);
  const anyoneSharing = Array.from(allUsers.values()).some(usr => usr.isScreenSharing);
  if (!anyoneSharing && liveStreamBar) {
    liveStreamBar.classList.add('hidden');
  }
  socket.emit('stream-stopped');
  socket.emit('media-state-change', { isScreenSharing: false });
  showToast('📺 Screen sharing stopped.');
}

btnScreen.addEventListener('click', () => startOrStopScreenShare());

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
      customStatus: 'Caller Member',
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
  const isMobile = window.innerWidth <= 768;
  const layout = document.querySelector('.discord-layout');
  if (isMobile) {
    if (layout) {
      layout.classList.remove('mobile-drawer-open');
      const willOpen = !layout.classList.contains('mobile-members-open');
      layout.classList.toggle('mobile-members-open', willOpen);
      btnToggleMembers.classList.toggle('active', willOpen);
    }
  } else {
    membersSidebar.classList.toggle('hidden');
    btnToggleMembers.classList.toggle('active', !membersSidebar.classList.contains('hidden'));
  }
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
  popoutCustomStatusText.textContent = user.customStatus || 'Active on Caller';

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
    localStorage.setItem('caller-theme', theme);
    localStorage.setItem('discord-theme', theme);
    showToast(`🎨 Theme changed to ${theme.toUpperCase()}`);
  });
});

// Saved Theme bootstrap
const savedTheme = localStorage.getItem('caller-theme') || localStorage.getItem('discord-theme');
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

console.log('⚡ Caller Engine loaded successfully.');
