const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Store users: socketId -> { id, username, room, isMuted, isCameraOn, isScreenSharing }
const users = new Map();

io.on('connection', (socket) => {
  console.log(`[Connect] Socket: ${socket.id}`);

  socket.on('join-room', ({ username, room = 'main-room' }) => {
    socket.join(room);
    const userInfo = {
      id: socket.id,
      username: username || `User_${socket.id.substring(0, 4)}`,
      room,
      isMuted: false,
      isCameraOn: true,
      isScreenSharing: false
    };
    users.set(socket.id, userInfo);

    // Get list of other users in this room
    const otherUsers = Array.from(users.values()).filter(
      (u) => u.room === room && u.id !== socket.id
    );

    // Send existing users list to joining user
    socket.emit('room-joined', {
      self: userInfo,
      participants: otherUsers
    });

    // Notify others that a new user joined
    socket.to(room).emit('user-connected', userInfo);
    console.log(`[Join] ${userInfo.username} (${socket.id}) entered ${room}`);
  });

  // WebRTC Signaling relays
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

  // User state updates (screen share, mic, camera)
  socket.on('media-state-change', (data) => {
    const user = users.get(socket.id);
    if (user) {
      Object.assign(user, data);
      socket.to(user.room).emit('user-state-updated', {
        id: socket.id,
        ...data
      });
    }
  });

  // Chat message relay
  socket.on('send-message', ({ message }) => {
    const user = users.get(socket.id);
    if (user && message.trim()) {
      const msgData = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        sender: user.username,
        senderId: socket.id,
        text: message.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      io.to(user.room).emit('new-message', msgData);
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('user-disconnected', { id: socket.id, username: user.username });
      users.delete(socket.id);
      console.log(`[Leave] ${user.username} left.`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Discord Lite Server running on http://localhost:${PORT}`);
});
