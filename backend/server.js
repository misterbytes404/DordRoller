import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from'path';
import crypto from 'crypto';
import { setupSocketHandlers } from './sockets/socketHandler.js';

const app = express();

// Security: Disable X-Powered-By header to prevent information disclosure
app.disable('x-powered-by');

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

// Generate unique room code
function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 characters
}

// Routes
app.post('/create-room', (req, res) => {
  const code = generateRoomCode();
  res.json({ code });
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup socket handlers from the centralized handler module
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});