import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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
    socket.join(roomCode);
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});