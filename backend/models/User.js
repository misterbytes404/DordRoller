import pool, { generateHexId } from '../config/database.js';

class User {
  /**
   * Find or create a user from Twitch OAuth data
   * @param {Object} twitchData - Twitch user data from OAuth
   * @returns {Object} User record
   */
  static async findOrCreateFromTwitch(twitchData) {
    const { id: twitchId, login: twitchUsername, display_name: displayName, profile_image_url: avatarUrl, email } = twitchData;
    
    // First try to find existing user
    const existingUser = await this.findByTwitchId(twitchId);
    if (existingUser) {
      // Update last login and any changed profile data
      return await this.updateFromTwitch(existingUser.id, twitchData);
    }
    
    // Create new user
    const id = generateHexId(16);
    const result = await pool.query(
      `INSERT INTO users (id, twitch_id, twitch_username, display_name, avatar_url, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, twitchId, twitchUsername, displayName || twitchUsername, avatarUrl, email]
    );
    
    return result.rows[0];
  }

  /**
   * Find user by Twitch ID
   */
  static async findByTwitchId(twitchId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE twitch_id = $1',
      [twitchId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by internal ID
   */
  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update user from Twitch data (on each login)
   */
  static async updateFromTwitch(userId, twitchData) {
    const { login: twitchUsername, display_name: displayName, profile_image_url: avatarUrl, email } = twitchData;
    
    const result = await pool.query(
      `UPDATE users 
       SET twitch_username = $2, display_name = $3, avatar_url = $4, email = $5, last_login = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId, twitchUsername, displayName || twitchUsername, avatarUrl, email]
    );
    
    return result.rows[0];
  }

  /**
   * Get all rooms a user is a member of (with role)
   */
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
}

export default User;
