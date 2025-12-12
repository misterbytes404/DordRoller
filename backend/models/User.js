import pool, { generateHexId } from '../config/database.js';
import bcrypt from 'bcrypt';
import validator from 'validator';
import crypto from 'crypto';

// Security constants
const BCRYPT_ROUNDS = 12; // OWASP recommends 10+, we use 12 for extra security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Generate a dummy hash at startup for timing attack prevention
// This ensures failed lookups take the same time as real password checks
let TIMING_SAFE_DUMMY_HASH = null;
(async () => {
  // Generate a random dummy hash at module load
  const dummyPassword = crypto.randomBytes(32).toString('hex');
  TIMING_SAFE_DUMMY_HASH = await bcrypt.hash(dummyPassword, BCRYPT_ROUNDS);
})();

class User {
  // ==================== INPUT VALIDATION ====================
  
  /**
   * Validate and sanitize username
   * @param {string} username 
   * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
   */
  static validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required' };
    }
    
    // Trim and convert to lowercase
    const sanitized = validator.trim(username).toLowerCase();
    
    // Length check
    if (sanitized.length < 3 || sanitized.length > 30) {
      return { valid: false, error: 'Username must be between 3 and 30 characters' };
    }
    
    // Alphanumeric with underscores only (prevents injection)
    if (!validator.matches(sanitized, /^[a-z0-9_]+$/)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    
    // No consecutive underscores
    if (sanitized.includes('__')) {
      return { valid: false, error: 'Username cannot contain consecutive underscores' };
    }
    
    return { valid: true, sanitized };
  }

  /**
   * Validate password strength (OWASP guidelines)
   * @param {string} password 
   * @returns {Object} { valid: boolean, error?: string }
   */
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }
    
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    
    if (password.length > MAX_PASSWORD_LENGTH) {
      return { valid: false, error: `Password must be less than ${MAX_PASSWORD_LENGTH} characters` };
    }
    
    // Check for password strength (at least 3 of 4 categories)
    let strength = 0;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength < 3) {
      return { 
        valid: false, 
        error: 'Password must contain at least 3 of: lowercase, uppercase, numbers, special characters' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate email format
   * @param {string} email 
   * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
   */
  static validateEmail(email) {
    if (!email) {
      return { valid: true, sanitized: null }; // Email is optional
    }
    
    if (typeof email !== 'string') {
      return { valid: false, error: 'Invalid email format' };
    }
    
    const sanitized = validator.normalizeEmail(validator.trim(email));
    
    if (!validator.isEmail(sanitized)) {
      return { valid: false, error: 'Invalid email format' };
    }
    
    return { valid: true, sanitized };
  }

  /**
   * Validate display name
   * @param {string} displayName 
   * @returns {Object} { valid: boolean, error?: string, sanitized?: string }
   */
  static validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') {
      return { valid: false, error: 'Display name is required' };
    }
    
    // Sanitize: trim, escape HTML entities
    const sanitized = validator.escape(validator.trim(displayName));
    
    if (sanitized.length < 2 || sanitized.length > 50) {
      return { valid: false, error: 'Display name must be between 2 and 50 characters' };
    }
    
    return { valid: true, sanitized };
  }

  // ==================== LOCAL AUTHENTICATION ====================

  /**
   * Create a new local user account
   * @param {Object} userData - { username, password, displayName, email? }
   * @returns {Object} User record (without password hash)
   */
  static async createLocalUser({ username, password, displayName, email }) {
    // Validate all inputs
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) {
      throw new Error(usernameCheck.error);
    }
    
    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.error);
    }
    
    const displayNameCheck = this.validateDisplayName(displayName);
    if (!displayNameCheck.valid) {
      throw new Error(displayNameCheck.error);
    }
    
    const emailCheck = this.validateEmail(email);
    if (!emailCheck.valid) {
      throw new Error(emailCheck.error);
    }
    
    // Check if username already exists
    const existingUser = await this.findByUsername(usernameCheck.sanitized);
    if (existingUser) {
      throw new Error('Username already taken');
    }
    
    // Hash password with bcrypt (OWASP recommended)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    // Create user
    const id = generateHexId(16);
    const result = await pool.query(
      `INSERT INTO users (id, auth_type, username, password_hash, display_name, email)
       VALUES ($1, 'local', $2, $3, $4, $5)
       RETURNING id, auth_type, username, display_name, email, avatar_url, created_at`,
      [id, usernameCheck.sanitized, passwordHash, displayNameCheck.sanitized, emailCheck.sanitized]
    );
    
    return result.rows[0];
  }

  /**
   * Authenticate a local user
   * @param {string} username 
   * @param {string} password 
   * @returns {Object} User record or null if invalid
   */
  static async authenticateLocal(username, password) {
    // Validate username format first (prevents injection)
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) {
      return null;
    }
    
    // Find user by username
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND auth_type = 'local'`,
      [usernameCheck.sanitized]
    );
    
    const user = result.rows[0];
    if (!user) {
      // Timing attack prevention: still do a hash comparison with dummy hash
      if (TIMING_SAFE_DUMMY_HASH) {
        await bcrypt.compare(password, TIMING_SAFE_DUMMY_HASH);
      }
      return null;
    }
    
    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new Error(`Account locked. Try again in ${remainingMinutes} minutes.`);
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      // Increment failed attempts
      await this.recordFailedLogin(user.id);
      return null;
    }
    
    // Reset failed attempts and update last login
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = $1`,
      [user.id]
    );
    
    // Return user without sensitive data
    return {
      id: user.id,
      auth_type: user.auth_type,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    };
  }

  /**
   * Record failed login attempt and lock account if necessary
   */
  static async recordFailedLogin(userId) {
    const result = await pool.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId]
    );
    
    const attempts = result.rows[0]?.failed_login_attempts || 0;
    
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock account
      await pool.query(
        `UPDATE users 
         SET locked_until = NOW() + INTERVAL '${LOCKOUT_DURATION_MINUTES} minutes'
         WHERE id = $1`,
        [userId]
      );
    }
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) {
      return null;
    }
    
    const result = await pool.query(
      `SELECT id, auth_type, username, display_name, email, avatar_url, created_at 
       FROM users WHERE username = $1`,
      [usernameCheck.sanitized]
    );
    return result.rows[0] || null;
  }

  /**
   * Change password for local user
   */
  static async changePassword(userId, currentPassword, newPassword) {
    // Get user with password hash
    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND auth_type = 'local'`,
      [userId]
    );
    
    const user = result.rows[0];
    if (!user) {
      throw new Error('User not found or not a local account');
    }
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Validate new password
    const passwordCheck = this.validatePassword(newPassword);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.error);
    }
    
    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [userId, newHash]
    );
    
    return true;
  }

  // ==================== TWITCH AUTHENTICATION ====================

  /**
   * Find or create a user from Twitch OAuth data
   * @param {Object} twitchData - Twitch user data from OAuth
   * @returns {Object} User record
   */
  static async findOrCreateFromTwitch(twitchData) {
    const { id: twitchId, login: twitchUsername, display_name: displayName, profile_image_url: avatarUrl } = twitchData;
    
    // First try to find existing user
    const existingUser = await this.findByTwitchId(twitchId);
    if (existingUser) {
      // Update last login and any changed profile data
      return await this.updateFromTwitch(existingUser.id, twitchData);
    }
    
    // Create new user
    const id = generateHexId(16);
    const result = await pool.query(
      `INSERT INTO users (id, auth_type, twitch_id, display_name, avatar_url)
       VALUES ($1, 'twitch', $2, $3, $4)
       RETURNING id, auth_type, twitch_id, display_name, avatar_url, created_at`,
      [id, twitchId, displayName || twitchUsername, avatarUrl]
    );
    
    return result.rows[0];
  }

  /**
   * Find user by Twitch ID
   */
  static async findByTwitchId(twitchId) {
    const result = await pool.query(
      `SELECT id, auth_type, twitch_id, display_name, avatar_url, created_at 
       FROM users WHERE twitch_id = $1`,
      [twitchId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by internal ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT id, auth_type, username, twitch_id, display_name, avatar_url, created_at 
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update user from Twitch data (on each login)
   */
  static async updateFromTwitch(userId, twitchData) {
    const { display_name: displayName, profile_image_url: avatarUrl } = twitchData;
    
    const result = await pool.query(
      `UPDATE users 
       SET display_name = $2, avatar_url = $3, last_login = NOW()
       WHERE id = $1
       RETURNING id, auth_type, twitch_id, display_name, avatar_url, created_at`,
      [userId, displayName, avatarUrl]
    );
    
    return result.rows[0];
  }

  // ==================== ROOM QUERIES ====================
  static async getRooms(userId) {
    const result = await pool.query(
      `SELECT r.*, rm.role, rm.joined_at as member_since,
              u.display_name as owner_name, u.avatar_url as owner_avatar
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE rm.user_id = $1
       ORDER BY rm.last_active DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get rooms where user is GM
   */
  static async getGMRooms(userId) {
    const result = await pool.query(
      `SELECT r.*, rm.joined_at as member_since,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id AND role = 'player') as player_count
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1 AND rm.role = 'gm'
       ORDER BY r.last_active DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get rooms where user is a player
   */
  static async getPlayerRooms(userId) {
    const result = await pool.query(
      `SELECT r.*, rm.joined_at as member_since,
              u.display_name as gm_name, u.avatar_url as gm_avatar
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       LEFT JOIN room_members gm_rm ON r.id = gm_rm.room_id AND gm_rm.role = 'gm'
       LEFT JOIN users u ON gm_rm.user_id = u.id
       WHERE rm.user_id = $1 AND rm.role = 'player'
       ORDER BY r.last_active DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Update user's display name
   */
  static async updateDisplayName(userId, displayName) {
    const displayNameCheck = this.validateDisplayName(displayName);
    if (!displayNameCheck.valid) {
      throw new Error(displayNameCheck.error);
    }

    const result = await pool.query(
      `UPDATE users 
       SET display_name = $2
       WHERE id = $1
       RETURNING id, auth_type, username, twitch_id, display_name, email, avatar_url, created_at`,
      [userId, displayNameCheck.sanitized]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Delete user account and associated data
   */
  static async deleteAccount(userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete room memberships first
      await client.query('DELETE FROM room_members WHERE user_id = $1', [userId]);
      
      // Delete rooms owned by user (where user was GM)
      // First get the room IDs
      const ownedRooms = await client.query(
        `SELECT r.id FROM rooms r
         JOIN room_members rm ON r.id = rm.room_id
         WHERE rm.user_id = $1 AND rm.role = 'gm'`,
        [userId]
      );
      
      // Delete room members for owned rooms
      for (const room of ownedRooms.rows) {
        await client.query('DELETE FROM room_members WHERE room_id = $1', [room.id]);
        await client.query('DELETE FROM rooms WHERE id = $1', [room.id]);
      }
      
      // Delete the user
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
      
      await client.query('COMMIT');
      
      return result.rowCount > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export default User;
