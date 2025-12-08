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
      twitchId: user.twitch_id,
      username: user.twitch_username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
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
        twitchId: user.twitch_id,
        username: user.twitch_username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
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
