const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e7 // 10MB for image attachments
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// Default Initial Servers & Channels
const defaultServers = [
  {
    id: 's-doscria',
    name: '⚡ DosCria Hub',
    icon: '⚡',
    ownerId: 'system',
    categories: [
      {
        id: 'cat-text-doscria',
        name: 'TEXT CHANNELS',
        channels: [
          { id: 'c-welcome', name: 'welcome-rules', type: 'text', topic: 'Welcome to the official DosCria server! Read the rules.' },
          { id: 'c-general', name: 'general-chat', type: 'text', topic: 'Main hangout for everyone in the server.' },
          { id: 'c-clips', name: 'clips-and-media', type: 'text', topic: 'Share gameplay clips, setup photos, and memes.' },
          { id: 'c-bot', name: 'bot-commands', type: 'text', topic: 'Commands and bot spam area.' }
        ]
      },
      {
        id: 'cat-voice-doscria',
        name: 'VOICE & STREAMS',
        channels: [
          { id: 'v-lounge', name: 'Lounge (1080p)', type: 'voice', userLimit: 0 },
          { id: 'v-squad1', name: 'Squad 1', type: 'voice', userLimit: 15 },
          { id: 'v-radio', name: 'Late Night Radio', type: 'voice', userLimit: 25 }
        ]
      }
    ]
  },
  {
    id: 's-gaming',
    name: '🎮 Gaming HQ',
    icon: '🎮',
    ownerId: 'system',
    categories: [
      {
        id: 'cat-text-gaming',
        name: 'COMMUNITY',
        channels: [
          { id: 'c-announcements', name: 'announcements', type: 'text', topic: 'Tournament and community announcements.' },
          { id: 'c-lfg', name: 'lfg-party', type: 'text', topic: 'Looking for group: CS2, Valorant, GTA, Rocket League.' },
          { id: 'c-highlights', name: 'highlights', type: 'text', topic: 'Best plays of the week.' }
        ]
      },
      {
        id: 'cat-voice-gaming',
        name: 'VOICE CHANNELS',
        channels: [
          { id: 'v-cs2', name: 'CS2 Competitive', type: 'voice', userLimit: 15 },
          { id: 'v-val', name: 'Valorant Ranked', type: 'voice', userLimit: 15 },
          { id: 'v-chill', name: 'Chill Duo', type: 'voice', userLimit: 15 }
        ]
      }
    ]
  },
  {
    id: 's-dev',
    name: '💻 Dev & Tech',
    icon: '💻',
    ownerId: 'system',
    categories: [
      {
        id: 'cat-text-dev',
        name: 'DEVELOPMENT',
        channels: [
          { id: 'c-dev-general', name: 'general-dev', type: 'text', topic: 'Talk about code, architecture, full-stack, and WebRTC.' },
          { id: 'c-showcase', name: 'showcase', type: 'text', topic: 'Show off your apps, games, and side projects.' }
        ]
      },
      {
        id: 'cat-voice-dev',
        name: 'VOICE ROOMS',
        channels: [
          { id: 'v-pair', name: 'Pair Programming', type: 'voice', userLimit: 15 },
          { id: 'v-techtalk', name: 'Tech Talk & Demo', type: 'voice', userLimit: 0 }
        ]
      }
    ]
  },
  {
    id: 's-music',
    name: '🎵 Music & Chill',
    icon: '🎵',
    ownerId: 'system',
    categories: [
      {
        id: 'cat-text-music',
        name: 'LOUNGE CHAT',
        channels: [
          { id: 'c-music-chat', name: 'music-recommendations', type: 'text', topic: 'Drop your favorite tracks, playlists, and beats.' }
        ]
      },
      {
        id: 'cat-voice-music',
        name: 'VOICE CHANNELS',
        channels: [
          { id: 'v-lofi', name: 'Lofi 24/7 Lounge', type: 'voice', userLimit: 0 }
        ]
      }
    ]
  }
];

let servers = [...defaultServers];

// Seeded Initial Channel Messages
const channelMessages = {
  'c-welcome': [
    {
      id: 'm-w1',
      sender: 'Clyde [BOT]',
      senderId: 'bot-clyde',
      avatar: '🤖',
      role: 'BOT',
      text: '🎉 Welcome to **Discord Full Edition**! Enjoy high-fidelity 1080p 30/60fps screen transmission, Krisp audio noise cancellation, multi-server channels, direct messages, and rich markdown chat.',
      timestamp: 'Today at 12:00 PM',
      reactions: { '⚡': ['system'], '🔥': ['system', 'bot-clyde'] }
    },
    {
      id: 'm-w2',
      sender: 'Marcus',
      senderId: 'bot-marcus',
      avatar: '👑',
      role: 'OWNER',
      text: 'Server is officially live on port 3000! Check out `#clips-and-media`, join `🔊 Lounge (1080p)`, and feel free to invite your friends.',
      timestamp: 'Today at 12:05 PM',
      reactions: { '🚀': ['bot-marcus'] }
    }
  ],
  'c-general': [
    {
      id: 'm-g1',
      sender: 'Wumpus',
      senderId: 'bot-wumpus',
      avatar: '👾',
      role: 'ADMIN',
      text: 'Hey everyone! Full Discord Web is running with real WebRTC peer mesh, soundboard, and custom themes (Dark, Midnight AMOLED, Light). Try clicking the Settings gear ⚙️!',
      timestamp: 'Today at 12:10 PM',
      reactions: { '👍': ['system'], '❤️': ['bot-wumpus'] }
    }
  ]
};

// Direct Messages: conversationId -> [messages]
const directMessages = {};

// Track Connected Users: socketId -> userInfo
const users = new Map();

// Track Voice Channel memberships: channelId -> Set of socketIds
const voiceChannelMembers = new Map();

// Helper to get formatted time
function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --------------------------------------------------------------------------
// Real-Time High-Frequency State Synchronization (1000ms Global Heartbeat)
// --------------------------------------------------------------------------
function getGlobalSyncPayload() {
  return {
    timestamp: Date.now(),
    users: Array.from(users.values()),
    voiceMembers: Array.from(voiceChannelMembers.entries()).map(([cid, set]) => [cid, Array.from(set)]),
    activeStreams: Array.from(users.values())
      .filter(u => u.isScreenSharing && u.currentVoiceChannelId)
      .map(u => ({
        id: u.id,
        username: u.username,
        channelId: u.currentVoiceChannelId
      }))
  };
}

function broadcastGlobalSync() {
  io.emit('global-sync', getGlobalSyncPayload());
}

// Global 1000ms heartbeat ensuring all 10+ users are 100% in sync without refresh
setInterval(broadcastGlobalSync, 1000);

io.on('connection', (socket) => {
  console.log(`[Connect] Socket ID: ${socket.id}`);

  // User Join / Authenticate
  socket.on('join-discord', ({ username, status = 'online', customStatus = '', avatar = '' }) => {
    const finalUsername = username ? username.trim() : `User_${socket.id.substring(0, 4)}`;
    const userInfo = {
      id: socket.id,
      username: finalUsername,
      tag: `#${Math.floor(1000 + Math.random() * 9000)}`,
      status, // 'online' | 'idle' | 'dnd' | 'offline'
      customStatus: customStatus || 'Active in Discord',
      avatar: avatar || finalUsername.charAt(0).toUpperCase(),
      role: users.size === 0 ? 'OWNER' : 'MEMBER',
      currentServerId: 's-doscria',
      currentTextChannelId: 'c-general',
      currentVoiceChannelId: null,
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false
    };

    users.set(socket.id, userInfo);

    // Send initial bootstrap payload
    socket.emit('discord-init', {
      self: userInfo,
      servers,
      channelMessages,
      allUsers: Array.from(users.values()),
      voiceChannelMembers: Array.from(voiceChannelMembers.entries()).map(([cid, set]) => [cid, Array.from(set)])
    });

    // Broadcast user joined / updated
    io.emit('user-presence-update', userInfo);
    broadcastGlobalSync();
    console.log(`[Discord Join] ${userInfo.username}${userInfo.tag} (${socket.id}) connected.`);
  });

  // User Status & Profile Updates
  socket.on('update-profile', (data) => {
    const user = users.get(socket.id);
    if (user) {
      Object.assign(user, data);
      io.emit('user-presence-update', user);
      broadcastGlobalSync();
    }
  });

  // Send Text Message to Channel
  socket.on('send-channel-message', ({ channelId, text, attachment = null, replyTo = null }) => {
    const user = users.get(socket.id);
    if (!user || (!text?.trim() && !attachment)) return;

    if (!channelMessages[channelId]) {
      channelMessages[channelId] = [];
    }

    const message = {
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      channelId,
      sender: user.username,
      senderId: user.id,
      avatar: user.avatar,
      role: user.role,
      text: text?.trim() || '',
      attachment, // { type: 'image'|'file', dataUrl, name, size }
      replyTo,    // { id, sender, text }
      timestamp: getTimestamp(),
      reactions: {}
    };

    channelMessages[channelId].push(message);
    if (channelMessages[channelId].length > 150) {
      channelMessages[channelId].shift();
    }

    io.emit('new-channel-message', { channelId, message });
  });

  // Send Direct Message (DM)
  socket.on('send-dm-message', ({ recipientId, text, attachment = null }) => {
    const user = users.get(socket.id);
    if (!user || (!text?.trim() && !attachment)) return;

    // Standardized conversation ID: sorted user IDs
    const pair = [socket.id, recipientId].sort();
    const convId = `dm-${pair[0]}_${pair[1]}`;

    if (!directMessages[convId]) {
      directMessages[convId] = [];
    }

    const message = {
      id: 'dm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      conversationId: convId,
      sender: user.username,
      senderId: user.id,
      recipientId,
      avatar: user.avatar,
      text: text?.trim() || '',
      attachment,
      timestamp: getTimestamp()
    };

    directMessages[convId].push(message);

    // Relay to sender and recipient
    socket.emit('new-dm-message', { conversationId: convId, message });
    io.to(recipientId).emit('new-dm-message', { conversationId: convId, message });
  });

  // Toggle Message Reaction
  socket.on('toggle-reaction', ({ channelId, messageId, emoji }) => {
    const user = users.get(socket.id);
    if (!user || !channelMessages[channelId]) return;

    const msg = channelMessages[channelId].find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const existingIndex = msg.reactions[emoji].indexOf(socket.id);
    if (existingIndex >= 0) {
      msg.reactions[emoji].splice(existingIndex, 1);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji].push(socket.id);
    }

    io.emit('reaction-updated', {
      channelId,
      messageId,
      reactions: msg.reactions
    });
  });

  // Typing Indicators
  socket.on('typing-start', ({ channelId }) => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        channelId,
        username: user.username,
        userId: socket.id
      });
    }
  });

  socket.on('typing-stop', ({ channelId }) => {
    socket.broadcast.emit('user-stop-typing', {
      channelId,
      userId: socket.id
    });
  });

  // Soundboard Trigger
  socket.on('soundboard-play', ({ soundId, serverId }) => {
    const user = users.get(socket.id);
    if (user) {
      io.emit('soundboard-broadcast', {
        soundId,
        username: user.username,
        serverId
      });
    }
  });

  // Create Channel
  socket.on('create-channel', ({ serverId, categoryId, name, type }) => {
    const targetServer = servers.find(s => s.id === serverId);
    if (!targetServer) return;

    const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    const newChan = {
      id: `${type === 'voice' ? 'v' : 'c'}-${Date.now()}`,
      name: cleanName,
      type,
      topic: type === 'text' ? `Channel for ${cleanName}` : undefined,
      userLimit: type === 'voice' ? 0 : undefined
    };

    let cat = targetServer.categories.find(c => c.id === categoryId);
    if (!cat) {
      cat = targetServer.categories[0];
    }
    cat.channels.push(newChan);

    if (type === 'text') {
      channelMessages[newChan.id] = [
        {
          id: 'm-' + Date.now(),
          sender: 'Discord System',
          senderId: 'system',
          avatar: '⚡',
          role: 'SYSTEM',
          text: `Welcome to the start of the #${newChan.name} channel!`,
          timestamp: getTimestamp(),
          reactions: {}
        }
      ];
    }

    io.emit('channel-created', { serverId, categoryId: cat.id, channel: newChan });
  });

  // Create Server
  socket.on('create-server', ({ name, icon }) => {
    const user = users.get(socket.id);
    const newServer = {
      id: 's-' + Date.now(),
      name: name.trim() || 'New Discord Server',
      icon: icon || '🌟',
      ownerId: socket.id,
      categories: [
        {
          id: 'cat-text-' + Date.now(),
          name: 'TEXT CHANNELS',
          channels: [
            { id: 'c-' + Date.now(), name: 'general', type: 'text', topic: 'General conversation.' }
          ]
        },
        {
          id: 'cat-voice-' + Date.now(),
          name: 'VOICE CHANNELS',
          channels: [
            { id: 'v-' + Date.now(), name: 'General Voice', type: 'voice', userLimit: 0 }
          ]
        }
      ]
    };

    servers.push(newServer);
    const initialChanId = newServer.categories[0].channels[0].id;
    channelMessages[initialChanId] = [
      {
        id: 'm-' + Date.now(),
        sender: 'Discord System',
        senderId: 'system',
        avatar: '⚡',
        role: 'SYSTEM',
        text: `Welcome to **${newServer.name}**! This server was created by ${user ? user.username : 'User'}.`,
        timestamp: getTimestamp(),
        reactions: { '🎉': ['system'] }
      }
    ];

    io.emit('server-created', { server: newServer });
  });

  // ==========================================
  // WebRTC Voice, Video & Screen Sharing Logic
  // ==========================================

  socket.on('join-voice-channel', ({ channelId, serverId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    // If user was in another voice channel, leave it first
    if (user.currentVoiceChannelId && user.currentVoiceChannelId !== channelId) {
      leaveCurrentVoice(socket, user);
    }

    user.currentVoiceChannelId = channelId;
    socket.join(`voice:${channelId}`);

    if (!voiceChannelMembers.has(channelId)) {
      voiceChannelMembers.set(channelId, new Set());
    }
    voiceChannelMembers.get(channelId).add(socket.id);

    // List of existing participants in this voice channel
    const peersInRoom = Array.from(voiceChannelMembers.get(channelId))
      .filter(id => id !== socket.id)
      .map(id => users.get(id))
      .filter(Boolean);

    // Send back to the joining user
    socket.emit('voice-channel-joined', {
      channelId,
      serverId,
      self: user,
      participants: peersInRoom
    });

    // Notify other peers in this voice channel
    socket.to(`voice:${channelId}`).emit('voice-user-joined', {
      channelId,
      user
    });

    // Broadcast global voice state update for sidebar UI
    io.emit('voice-membership-updated', {
      channelId,
      members: Array.from(voiceChannelMembers.get(channelId))
    });

    // Zero-Refresh Stream Synchronization:
    // If any participant in this room is already sharing their screen, immediately trigger
    // the streamer to offer their screen to the new joiner, and notify the new joiner of the active stream!
    peersInRoom.forEach(peer => {
      if (peer.isScreenSharing) {
        console.log(`[Stream Sync] Triggering streamer ${peer.username} (${peer.id}) to push stream to joiner ${user.username} (${socket.id})`);
        io.to(peer.id).emit('peer-needs-stream', {
          peerId: socket.id,
          peerUsername: user.username
        });
        socket.emit('stream-started', {
          id: peer.id,
          username: peer.username,
          channelId
        });
      }
    });

    broadcastGlobalSync();
    console.log(`[Voice Join] ${user.username} entered voice channel ${channelId}`);
  });

  socket.on('leave-voice-channel', () => {
    const user = users.get(socket.id);
    if (user && user.currentVoiceChannelId) {
      leaveCurrentVoice(socket, user);
    }
  });

  function leaveCurrentVoice(socket, user) {
    const channelId = user.currentVoiceChannelId;
    if (!channelId) return;

    socket.leave(`voice:${channelId}`);
    user.currentVoiceChannelId = null;
    user.isScreenSharing = false;

    if (voiceChannelMembers.has(channelId)) {
      const set = voiceChannelMembers.get(channelId);
      set.delete(socket.id);
      if (set.size === 0) voiceChannelMembers.delete(channelId);
    }

    socket.to(`voice:${channelId}`).emit('voice-user-left', {
      channelId,
      userId: socket.id,
      username: user.username
    });

    io.emit('voice-membership-updated', {
      channelId,
      members: voiceChannelMembers.has(channelId) ? Array.from(voiceChannelMembers.get(channelId)) : []
    });

    broadcastGlobalSync();
    console.log(`[Voice Leave] ${user.username} left voice channel ${channelId}`);
  }

  // WebRTC Signaling Relay
  socket.on('signal-offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('signal-offer', {
      callerId: socket.id,
      sdp
    });
  });

  socket.on('signal-answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('signal-answer', {
      callerId: socket.id,
      sdp
    });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', {
      senderId: socket.id,
      candidate
    });
  });

  // Client requests a stream directly from a streamer (self-healing zero-refresh sync)
  socket.on('request-peer-stream', ({ streamerId }) => {
    const user = users.get(socket.id);
    console.log(`[Stream Request] ${user ? user.username : socket.id} requesting stream from ${streamerId}`);
    io.to(streamerId).emit('peer-needs-stream', {
      peerId: socket.id,
      peerUsername: user ? user.username : 'User'
    });
  });

  // Media state changes (Mute, Camera, Screen Share)
  socket.on('media-state-change', (data) => {
    const user = users.get(socket.id);
    if (user) {
      Object.assign(user, data);
      if (user.currentVoiceChannelId) {
        socket.to(`voice:${user.currentVoiceChannelId}`).emit('voice-user-state-updated', {
          id: socket.id,
          ...data
        });
      }
      io.emit('user-presence-update', user);
      broadcastGlobalSync();
    }
  });

  socket.on('stream-started', (data) => {
    const user = users.get(socket.id);
    if (user && user.currentVoiceChannelId) {
      user.isScreenSharing = true;
      socket.to(`voice:${user.currentVoiceChannelId}`).emit('stream-started', {
        id: socket.id,
        username: user.username,
        ...data
      });
      io.emit('user-presence-update', user);
      broadcastGlobalSync();
      console.log(`[Screen Stream] ${user.username} started sharing screen in ${user.currentVoiceChannelId}`);
    }
  });

  socket.on('stream-stopped', () => {
    const user = users.get(socket.id);
    if (user && user.currentVoiceChannelId) {
      user.isScreenSharing = false;
      socket.to(`voice:${user.currentVoiceChannelId}`).emit('stream-stopped', {
        id: socket.id,
        username: user.username
      });
      io.emit('user-presence-update', user);
      broadcastGlobalSync();
      console.log(`[Screen Stream] ${user.username} stopped sharing screen in ${user.currentVoiceChannelId}`);
    }
  });

  // Speaking indicator event
  socket.on('user-speaking', ({ isSpeaking }) => {
    const user = users.get(socket.id);
    if (user && user.currentVoiceChannelId) {
      socket.to(`voice:${user.currentVoiceChannelId}`).emit('user-speaking-change', {
        userId: socket.id,
        isSpeaking
      });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      if (user.currentVoiceChannelId) {
        leaveCurrentVoice(socket, user);
      }
      users.delete(socket.id);
      io.emit('user-disconnected', { id: socket.id, username: user.username });
      broadcastGlobalSync();
      console.log(`[Disconnect] ${user.username} disconnected.`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`⚡ FULL DISCORD SERVER RUNNING LIVE ON:`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://0.0.0.0:${PORT}`);
  console.log(`=======================================================`);
});
