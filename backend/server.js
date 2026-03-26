const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all origins
    methods: ['GET', 'POST'],
  },
});

// Store rooms and their participants
// Format: { roomId: [socketId1, socketId2] }
const rooms = new Map();

// Generate a random 6-character room code
const generateRoomCode = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', (callback) => {
    let roomId = generateRoomCode();
    // Ensure uniqueness
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }
    
    rooms.set(roomId, [socket.id]);
    socket.join(roomId);
    
    console.log(`Room created: ${roomId} by ${socket.id}`);
    
    if (callback) {
      callback({ success: true, roomId });
    }
  });

  // Join an existing room
  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }
    
    // For Phase 1, we focus on 1-to-1 WebRTC connections
    if (room.length >= 2) {
      if (callback) callback({ success: false, error: 'Room is full' });
      return;
    }
    
    room.push(socket.id);
    socket.join(roomId);
    rooms.set(roomId, room);
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Notify specifically the other peer in the room that someone joined
    // `socket.to(roomId)` sends to everyone in the room EXCEPT the sender
    socket.to(roomId).emit('peer-joined', socket.id);
    
    // Send back the existing participants to the joiner
    const otherPeers = room.filter(id => id !== socket.id);
    
    // Acknowledge successful join
    if (callback) {
      callback({ success: true, roomId, peers: otherPeers });
    }
  });

  // Relay WebRTC signaling data
  socket.on('signal', ({ peerId, signal }) => {
    // Send the signal to the specific peer
    io.to(peerId).emit('signal', {
      senderId: socket.id,
      signal
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up rooms
    for (const [roomId, participants] of rooms.entries()) {
      if (participants.includes(socket.id)) {
        const remaining = participants.filter(id => id !== socket.id);
        
        if (remaining.length === 0) {
          // Room is empty, delete it
          rooms.delete(roomId);
          console.log(`Room deleted: ${roomId}`);
        } else {
          // Update room and notify remaining peers
          rooms.set(roomId, remaining);
          socket.to(roomId).emit('peer-disconnected', socket.id);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
