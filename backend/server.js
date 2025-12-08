import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { setupSocketHandlers } from './sockets/socketHandler.js';
import { initializeDatabase } from './config/database.js';
import sheetsRouter from './routes/sheets.js';
import roomsRouter from './routes/rooms.js';
import monstersRouter from './routes/monsters.js';
import authRouter from './routes/auth.js';

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

// Serve static files for each client
app.use('/landing', express.static(path.join(process.cwd(), '../landing')));
app.use('/gm-client', express.static(path.join(process.cwd(), '../gm-client')));
app.use('/player-client', express.static(path.join(process.cwd(), '../player-client')));
app.use('/obs-client', express.static(path.join(process.cwd(), '../obs-client')));

// Redirect root to landing page
app.get('/', (req, res) => {
  res.redirect('/landing');
});

// API Routes
app.use('/auth', authRouter);
app.use('/api', sheetsRouter);
app.use('/api', roomsRouter);
app.use('/api', monstersRouter);

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

// Initialize database and start server
const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});