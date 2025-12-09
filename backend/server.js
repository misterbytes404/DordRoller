import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
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
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN 
    : ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Determine if running in Docker (production) or development
const isDocker = process.env.NODE_ENV === 'production';

// Static file paths differ between Docker (bundled) and development (separate dirs)
const staticBasePath = isDocker 
  ? path.join(process.cwd(), 'public')  // Docker: files in /app/public
  : path.join(process.cwd(), '..');      // Dev: files in parent directory

// Serve static files for each client
app.use('/landing', express.static(path.join(staticBasePath, isDocker ? 'landing' : 'landing')));
app.use('/gm', express.static(path.join(staticBasePath, isDocker ? 'gm' : 'gm-client')));
app.use('/player', express.static(path.join(staticBasePath, isDocker ? 'player' : 'player-client')));
app.use('/obs', express.static(path.join(staticBasePath, isDocker ? 'obs' : 'obs-client')));
app.use('/account', express.static(path.join(staticBasePath, isDocker ? 'account' : 'account')));

// Legacy routes (redirect to new shorter paths)
app.use('/gm-client', (req, res) => res.redirect('/gm' + req.url));
app.use('/player-client', (req, res) => res.redirect('/player' + req.url));
app.use('/obs-client', (req, res) => res.redirect('/obs' + req.url));

// Redirect root to landing page
app.get('/', (req, res) => {
  res.redirect('/landing');
});

// API Routes
app.use('/auth', authRouter);
app.use('/api', sheetsRouter);
app.use('/api', roomsRouter);
app.use('/api', monstersRouter);

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check endpoint for Docker/Kubernetes (also at /api/health)
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const { default: pool } = await import('./config/database.js');
    await pool.query('SELECT 1');
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        server: 'running'
      },
      error: err.message
    });
  }
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