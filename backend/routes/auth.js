import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';

const router = express.Router();

// Cookie configuration
const COOKIE_NAME = 'dordroller_session';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
};

// Twitch OAuth configuration
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'e79og8hlkoxlbykrd9w8b7cvfkuy4o';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback';

// Authentication middleware - validates session cookie
export const authenticateToken = async (req, res, next) => {
    try {
        const sessionToken = req.cookies?.[COOKIE_NAME];
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const sessionData = await Session.validate(sessionToken);
        if (!sessionData) {
            res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        req.user = sessionData.user;
        req.sessionToken = sessionToken;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Optional auth - doesn't fail if no session, just sets req.user if valid
export const optionalAuth = async (req, res, next) => {
    try {
        const sessionToken = req.cookies?.[COOKIE_NAME];
        
        if (sessionToken) {
            const sessionData = await Session.validate(sessionToken);
            if (sessionData) {
                req.user = sessionData.user;
                req.sessionToken = sessionToken;
            }
        }
        next();
    } catch (error) {
        // Continue without auth
        next();
    }
};

// Helper to create session and set cookie
async function createSessionAndSetCookie(res, userId, req) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
    
    const { sessionToken } = await Session.create(userId, userAgent, ipAddress);
    res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
    
    return sessionToken;
}

// ==================== Twitch OAuth Routes ====================

// Initiate Twitch OAuth
router.get('/twitch', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state in a short-lived cookie for CSRF protection
    res.cookie('twitch_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
    });

    const params = new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        redirect_uri: TWITCH_REDIRECT_URI,
        response_type: 'code',
        scope: 'user:read:email',
        state: state
    });

    res.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
});

// Twitch OAuth callback
router.get('/twitch/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const storedState = req.cookies?.twitch_oauth_state;

    // Clear the state cookie
    res.clearCookie('twitch_oauth_state');

    if (error) {
        console.error('Twitch OAuth error:', error);
        return res.redirect('/landing/?error=oauth_denied');
    }

    if (!state || state !== storedState) {
        console.error('State mismatch - possible CSRF attack');
        return res.redirect('/landing/?error=invalid_state');
    }

    if (!code) {
        return res.redirect('/landing/?error=no_code');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: TWITCH_REDIRECT_URI
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', errorData);
            return res.redirect('/landing/?error=token_exchange_failed');
        }

        const tokenData = await tokenResponse.json();

        // Get user info from Twitch
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Client-Id': TWITCH_CLIENT_ID
            }
        });

        if (!userResponse.ok) {
            console.error('Failed to get Twitch user info');
            return res.redirect('/landing/?error=user_fetch_failed');
        }

        const userData = await userResponse.json();
        const twitchUser = userData.data[0];

        // Find or create user using existing model method
        // Pass the raw Twitch data in the format the model expects
        const user = await User.findOrCreateFromTwitch({
            id: twitchUser.id,
            login: twitchUser.login,
            display_name: twitchUser.display_name,
            profile_image_url: twitchUser.profile_image_url,
            email: twitchUser.email
        });

        // Create session and set cookie
        await createSessionAndSetCookie(res, user.id, req);

        // Redirect to landing page
        res.redirect('/landing/');
    } catch (error) {
        console.error('Twitch OAuth callback error:', error);
        res.redirect('/landing/?error=server_error');
    }
});

// ==================== Standard Auth Routes ====================

// Register new user (non-Twitch)
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, displayName } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        // Create user using existing model method
        const user = await User.createLocalUser({
            username,
            email,
            password,
            displayName: displayName || username
        });

        // Create session and set cookie
        await createSessionAndSetCookie(res, user.id, req);

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await User.authenticateLocal(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Create session and set cookie
        await createSessionAndSetCookie(res, user.id, req);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                avatarUrl: user.avatar_url
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        // Don't expose account lockout details to prevent enumeration
        res.status(401).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Delete the session from database
        await Session.delete(req.sessionToken);
        
        // Clear the cookie
        res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        // Still clear the cookie even if DB delete fails
        res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
        res.json({ message: 'Logged out' });
    }
});

// Logout all sessions (from all devices)
router.post('/logout-all', authenticateToken, async (req, res) => {
    try {
        await Session.deleteAllForUser(req.user.id);
        res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
        res.json({ message: 'Logged out from all devices' });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
});

// ==================== User Info Routes ====================

// Get current user with their rooms
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Fetch user's rooms
        const [gmRooms, playerRooms] = await Promise.all([
            User.getGMRooms(req.user.id),
            User.getPlayerRooms(req.user.id)
        ]);

        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                displayName: req.user.displayName,
                email: req.user.email,
                avatarUrl: req.user.avatarUrl,
                twitchId: req.user.twitchId
            },
            rooms: {
                gmRooms: gmRooms || [],
                playerRooms: playerRooms || []
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Check auth status (doesn't require auth, just reports status)
router.get('/status', optionalAuth, (req, res) => {
    if (req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                displayName: req.user.displayName,
                avatarUrl: req.user.avatarUrl
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { displayName } = req.body;
        
        // Type validation
        if (typeof displayName !== 'string') {
            return res.status(400).json({ error: 'Display name must be a string' });
        }
        
        const trimmedName = displayName.trim();
        
        if (trimmedName.length === 0) {
            return res.status(400).json({ error: 'Display name is required' });
        }

        if (trimmedName.length > 50) {
            return res.status(400).json({ error: 'Display name must be 50 characters or less' });
        }

        const updatedUser = await User.updateDisplayName(req.user.id, trimmedName);
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                displayName: updatedUser.display_name,
                email: updatedUser.email,
                avatarUrl: updatedUser.avatar_url
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Delete account
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        // Delete all sessions first
        await Session.deleteAllForUser(req.user.id);
        
        // Delete the user (cascades to related data)
        await User.deleteAccount(req.user.id);
        
        // Clear the cookie
        res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
        
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ==================== Active Sessions Routes ====================

// Get active sessions for current user
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await Session.getActiveForUser(req.user.id);
        res.json({ sessions });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Revoke a specific session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        await Session.deleteById(sessionId, req.user.id);
        res.json({ message: 'Session revoked' });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});

export default router;
