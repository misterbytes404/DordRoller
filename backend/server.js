import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from'path';
import crypto from 'crypto';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/obs-client', express.static(path.join(process.cwd(), '../obs-client')))

// Room storage
const rooms = new Map(); // code -> { players: Set<socketId> }

// Generate unique room code
function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 characters
}

// Routes
app.post('/create-room', (req, res) => {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));
  rooms.set(code, { players: new Set() });
  res.json({ code });
});

app.post('/join-room', (req, res) => {
  const { code } = req.body;
  if (!rooms.has(code)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ success: true });
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Room joining handler
  socket.on('join_room', (roomCode) => {
    if (!roomCode || typeof roomCode !== 'string') {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }
    if (!rooms.has(roomCode)) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    socket.join(roomCode);
    rooms.get(roomCode).players.add(socket.id);
    console.log(`Client ${socket.id} joined room: ${roomCode}`);
    socket.emit('joined_room', { roomCode });
  });

  // GM Roll Handler
  socket.on('gm_roll', (data) => {
    // Data Validation: { roomCode: string, diceType: string, label: string, result: number } expected
    if (!data.roomCode || !data.diceType || !data.label || typeof data.result !== 'number') {
      socket.emit('error', { message: 'Invalid roll data' });
      return;
    }
    console.log(`GM Roll in Room ${data.roomCode}: ${data.label} - ${data.result}`);
    // Broadcast
    io.to(data.roomCode).emit('broadcast_roll', data);
  });

  // Player Roll Handler
  socket.on('player_roll', (data) => {
    // Data Validation
    if (!data.roomCode || !data.diceType || !data.label || typeof data.result !== 'number') {
      socket.emit('error', { message: 'Invalid roll data' });
      return;
    }
    console.log(`Player Roll in Room ${data.roomCode}: ${data.roller} - ${data.label} - ${data.result}`);
    // Broadcast to room (GM, OBS, and other players)
    io.to(data.roomCode).emit('broadcast_roll', {
      ...data,
      isPlayerRoll: true
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Remove from rooms
    for (const [code, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(code); // Clean up empty rooms
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});