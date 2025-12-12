import pool from '../config/database.js';
import crypto from 'crypto';

// Session configuration
const SESSION_DURATION_DAYS = 7;
const SESSION_ID_LENGTH = 64; // 32 bytes = 256 bits of randomness

class Session {
  /**
   * Generate a cryptographically secure session ID
   */
  static generateSessionId() {
    return crypto.randomBytes(SESSION_ID_LENGTH / 2).toString('hex');
  }

  /**
   * Create a new session for a user
   * @param {string} userId - User ID
   * @param {string} userAgent - User agent string
   * @param {string} ipAddress - IP address
   * @returns {Object} Session data including sessionToken
   */
  static async create(userId, userAgent = null, ipAddress = null) {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    const result = await pool.query(
      `INSERT INTO sessions (id, user_id, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, created_at, expires_at`,
      [sessionId, userId, userAgent, ipAddress, expiresAt]
    );

    return {
      sessionToken: sessionId,
      ...result.rows[0]
    };
  }

  /**
   * Validate a session and get associated user
   * @param {string} sessionId - Session ID to validate
   * @returns {Object|null} User data if valid, null if invalid/expired
   */
  static async validate(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    const result = await pool.query(
      `SELECT s.*, u.id as user_id, u.auth_type, u.twitch_id, u.username, 
              u.display_name, u.avatar_url, u.created_at as user_created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];

    // Update last_active timestamp
    await pool.query(
      `UPDATE sessions SET last_active = NOW() WHERE id = $1`,
      [sessionId]
    );

    return {
      sessionId: session.id,
      user: {
        id: session.user_id,
        authType: session.auth_type,
        twitchId: session.twitch_id,
        username: session.username,
        displayName: session.display_name,
        avatarUrl: session.avatar_url,
        createdAt: session.user_created_at
      }
    };
  }

  /**
   * Delete a specific session (logout)
   * @param {string} sessionId - Session ID to delete
   * @returns {boolean} True if session was deleted
   */
  static async delete(sessionId) {
    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 RETURNING id`,
      [sessionId]
    );
    return result.rowCount > 0;
  }

  /**
   * Delete all sessions for a user (logout everywhere)
   * @param {string} userId - User ID
   * @returns {number} Number of sessions deleted
   */
  static async deleteAllForUser(userId) {
    const result = await pool.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount;
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} List of active sessions
   */
  static async getActiveSessions(userId) {
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, last_active, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_active DESC`,
      [userId]
    );
    return result.rows;
  }

  // Alias for getActiveSessions (used by auth.js)
  static async getActiveForUser(userId) {
    return this.getActiveSessions(userId);
  }

  /**
   * Delete a specific session by ID (for session management)
   * Only allows deletion if session belongs to the specified user
   * @param {string} sessionId - Session ID to delete
   * @param {string} userId - User ID (for ownership verification)
   * @returns {boolean} True if session was deleted
   */
  static async deleteById(sessionId, userId) {
    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [sessionId, userId]
    );
    return result.rowCount > 0;
  }

  /**
   * Clean up expired sessions (call periodically)
   * @returns {number} Number of sessions deleted
   */
  static async cleanupExpired() {
    const result = await pool.query(
      `DELETE FROM sessions WHERE expires_at < NOW()`
    );
    return result.rowCount;
  }

  /**
   * Extend session expiration
   * @param {string} sessionId - Session ID to extend
   * @returns {Object|null} Updated session or null if not found
   */
  static async extend(sessionId) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    const result = await pool.query(
      `UPDATE sessions 
       SET expires_at = $2, last_active = NOW()
       WHERE id = $1 AND expires_at > NOW()
       RETURNING id, expires_at`,
      [sessionId, expiresAt]
    );

    return result.rows[0] || null;
  }
}

export default Session;
