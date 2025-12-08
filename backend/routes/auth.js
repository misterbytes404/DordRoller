import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

// Check if auth is enabled
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
// Generate a random secret for development if not provided (won't persist across restarts)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d';

// Warn if using generated secret
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set in environment. Using randomly generated secret (sessions will not persist across restarts).');
}

// Twitch OAuth config
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback';

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(req, res, next) {
  // If auth is disabled, skip authentication
  if (!AUTH_ENABLED) {
    req.user = null;
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Optional auth middleware - doesn't require auth but attaches user if present
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    req.user = err ? null : decoded;
    next();
  });
}

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      authType: user.auth_type,
      twitchId: user.twitch_id || null,
      username: user.username || null,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ==================== RATE LIMITING ====================
// Simple in-memory rate limiter (use Redis in production for distributed systems)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 100; // General requests
const MAX_AUTH_ATTEMPTS_PER_WINDOW = 10; // Auth-specific (stricter)

function rateLimit(key, maxRequests = MAX_REQUESTS_PER_WINDOW) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry || entry.windowStart < windowStart) {
    entry = { windowStart: now, count: 0 };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.windowStart < windowStart) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  return entry.count <= maxRequests;
}

/**
 * Rate limiting middleware for auth endpoints
 */
function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `auth:${ip}`;
  
  if (!rateLimit(key, MAX_AUTH_ATTEMPTS_PER_WINDOW)) {
    return res.status(429).json({ 
      error: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    });
  }
  
  next();
}

/**
 * GET /auth/status
 * Check if auth is enabled and get current user
 */
router.get('/status', optionalAuth, (req, res) => {
  res.json({
    authEnabled: AUTH_ENABLED,
    user: req.user,
    twitchClientId: AUTH_ENABLED ? TWITCH_CLIENT_ID : null
  });
});

/**
 * GET /auth/twitch
 * Redirect to Twitch OAuth
 */
router.get('/twitch', (req, res) => {
  if (!AUTH_ENABLED) {
    return res.status(400).json({ error: 'Authentication is not enabled' });
  }

  if (!TWITCH_CLIENT_ID) {
    return res.status(500).json({ error: 'Twitch OAuth not configured' });
  }

  const scopes = ['user:read:email'];
  const state = jwt.sign({ timestamp: Date.now() }, JWT_SECRET, { expiresIn: '10m' });
  
  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

/**
 * GET /auth/twitch/callback
 * Handle Twitch OAuth callback
 */
router.get('/twitch/callback', async (req, res) => {
  if (!AUTH_ENABLED) {
    return res.status(400).json({ error: 'Authentication is not enabled' });
  }

  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('Twitch OAuth error:', error, error_description);
    return res.redirect(`/landing/?error=${encodeURIComponent(error_description || error)}`);
  }

  // Verify state
  try {
    jwt.verify(state, JWT_SECRET);
  } catch (err) {
    return res.redirect('/landing/?error=Invalid%20state%20parameter');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TWITCH_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json();
      console.error('Token exchange failed:', errData);
      return res.redirect('/landing/?error=Token%20exchange%20failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from Twitch
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': TWITCH_CLIENT_ID
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to get user info');
      return res.redirect('/landing/?error=Failed%20to%20get%20user%20info');
    }

    const userData = await userResponse.json();
    const twitchUser = userData.data[0];

    // Find or create user in our database
    const user = await User.findOrCreateFromTwitch(twitchUser);

    // Generate our JWT
    const token = generateToken(user);

    // Redirect to landing with token (frontend will store it)
    res.redirect(`/landing/?token=${token}`);

  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/landing/?error=Authentication%20failed');
  }
});

// ==================== LOCAL AUTHENTICATION ====================

/**
 * POST /auth/register
 * Register a new local account
 * 
 * Body: { username, email, password, confirmPassword }
 * 
 * Security measures:
 * - Rate limiting to prevent brute force
 * - Password strength validation (OWASP compliant)
 * - Email format validation
 * - Username format validation
 * - SQL injection prevention (parameterized queries in User model)
 * - XSS prevention (validator library sanitization)
 */
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        error: 'All fields are required: username, email, password, confirmPassword' 
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        error: 'Passwords do not match' 
      });
    }

    // Register user (User model handles all validation)
    const user = await User.register(username, email, password);

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        authType: user.auth_type
      },
      token
    });

  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle specific validation errors
    if (err.message.includes('already') || 
        err.message.includes('Invalid') || 
        err.message.includes('Password must') ||
        err.message.includes('Username must')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /auth/login
 * Login with local account
 * 
 * Body: { usernameOrEmail, password }
 * 
 * Security measures:
 * - Rate limiting to prevent brute force
 * - Generic error messages to prevent user enumeration
 * - Timing-safe password comparison (bcrypt)
 */
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    // Validate required fields
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ 
        error: 'Username/email and password are required' 
      });
    }

    // Attempt login (User model handles validation)
    const user = await User.login(usernameOrEmail, password);

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        authType: user.auth_type,
        avatarUrl: user.avatar_url
      },
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    
    // Always return generic error to prevent user enumeration
    res.status(401).json({ 
      error: 'Invalid credentials' 
    });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user's full profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's rooms
    const rooms = await User.getRooms(user.id);

    res.json({
      user: {
        id: user.id,
        authType: user.auth_type,
        twitchId: user.twitch_id || null,
        twitchUsername: user.twitch_username || null,
        username: user.username || null,
        email: user.email || null,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        createdAt: user.created_at
      },
      rooms
    });
  } catch (err) {
    console.error('Error getting user profile:', err);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

/**
 * POST /auth/logout
 * Client-side logout (just for API consistency, JWT is stateless)
 */
router.post('/logout', (req, res) => {
  // JWT is stateless, so logout is handled client-side by removing the token
  // This endpoint exists for potential future session blacklisting
  res.json({ success: true, message: 'Logged out' });
});

/**
 * GET /auth/rooms
 * Get all rooms for current user
 */
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await User.getRooms(req.user.id);
    const gmRooms = rooms.filter(r => r.role === 'gm');
    const playerRooms = rooms.filter(r => r.role === 'player');

    res.json({ gmRooms, playerRooms });
  } catch (err) {
    console.error('Error getting rooms:', err);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

export default router;
