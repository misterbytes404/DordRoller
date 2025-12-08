import pool, { generateHexId } from '../config/database.js';

// Generate a short hex code for room sharing (8 chars)
function generateRoomCode() {
  return generateHexId(8);
}

export const Room = {
  /**
   * Create a new room
   * @param {string} name - Room name
   * @param {string} ownerId - User ID of the GM/owner
   * @param {string} code - Optional custom room code
   */
  async create(name, ownerId, code = null) {
    const roomId = generateHexId(16);
    const roomCode = code || generateRoomCode();
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create the room
      const roomResult = await client.query(
        `INSERT INTO rooms (id, code, name, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [roomId, roomCode, name || 'Unnamed Room', ownerId]
      );
      const room = roomResult.rows[0];
      
      // Add owner as GM member
      if (ownerId) {
        const memberId = generateHexId(16);
        await client.query(
          `INSERT INTO room_members (id, room_id, user_id, role)
           VALUES ($1, $2, $3, 'gm')`,
          [memberId, roomId, ownerId]
        );
      }
      
      await client.query('COMMIT');
      return room;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Find room by code
   */
  async findByCode(code) {
    const result = await pool.query(
      `SELECT r.*, u.display_name as owner_name, u.avatar_url as owner_avatar
       FROM rooms r
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.code = $1`,
      [code]
    );
    return result.rows[0] || null;
  },

  /**
   * Find room by ID
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT r.*, u.display_name as owner_name, u.avatar_url as owner_avatar
       FROM rooms r
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update room name
   */
  async updateName(id, name) {
    const result = await pool.query(
      `UPDATE rooms SET name = $2, last_active = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name]
    );
    return result.rows[0] || null;
  },

  /**
   * Update room code
   */
  async updateCode(id, newCode) {
    const result = await pool.query(
      `UPDATE rooms SET code = $2, last_active = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, newCode]
    );
    return result.rows[0] || null;
  },

  /**
   * Update last active timestamp
   */
  async touch(id) {
    const result = await pool.query(
      `UPDATE rooms SET last_active = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Add user to room as member
   * @param {string} roomId 
   * @param {string} userId 
   * @param {string} role - 'gm' or 'player'
   */
  async addMember(roomId, userId, role = 'player') {
    const memberId = generateHexId(16);
    const result = await pool.query(
      `INSERT INTO room_members (id, room_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         last_active = NOW()
       RETURNING *`,
      [memberId, roomId, userId, role]
    );
    return result.rows[0];
  },

  /**
   * Remove user from room
   */
  async removeMember(roomId, userId) {
    await pool.query(
      'DELETE FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
  },

  /**
   * Get user's membership in a room
   */
  async getMembership(roomId, userId) {
    const result = await pool.query(
      `SELECT rm.*, u.display_name, u.avatar_url, u.twitch_username
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = $1 AND rm.user_id = $2`,
      [roomId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if user is member of room
   */
  async isMember(roomId, userId) {
    const result = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    return result.rows.length > 0;
  },

  /**
   * Check if user is GM of room
   */
  async isGM(roomId, userId) {
    const result = await pool.query(
      `SELECT 1 FROM room_members 
       WHERE room_id = $1 AND user_id = $2 AND role = 'gm'`,
      [roomId, userId]
    );
    return result.rows.length > 0;
  },

  /**
   * Get all members of a room
   */
  async getMembers(roomId) {
    const result = await pool.query(
      `SELECT rm.*, u.display_name, u.avatar_url, u.twitch_username,
              cs.id as sheet_id, cs.name as character_name, cs.class, cs.level
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       LEFT JOIN character_sheets cs ON cs.assigned_user_id = rm.user_id AND cs.room_id = rm.room_id
       WHERE rm.room_id = $1
       ORDER BY rm.role DESC, rm.joined_at`,
      [roomId]
    );
    return result.rows;
  },

  /**
   * Get GMs of a room
   */
  async getGMs(roomId) {
    const result = await pool.query(
      `SELECT rm.*, u.display_name, u.avatar_url, u.twitch_username
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = $1 AND rm.role = 'gm'
       ORDER BY rm.joined_at`,
      [roomId]
    );
    return result.rows;
  },

  /**
   * Get players of a room
   */
  async getPlayers(roomId) {
    const result = await pool.query(
      `SELECT rm.*, u.display_name, u.avatar_url, u.twitch_username,
              cs.id as sheet_id, cs.name as character_name, cs.class, cs.level, cs.hp, cs.max_hp, cs.ac
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       LEFT JOIN character_sheets cs ON cs.assigned_user_id = rm.user_id AND cs.room_id = rm.room_id
       WHERE rm.room_id = $1 AND rm.role = 'player'
       ORDER BY rm.joined_at`,
      [roomId]
    );
    return result.rows;
  },

  /**
   * Update member's last active time
   */
  async touchMember(roomId, userId) {
    await pool.query(
      `UPDATE room_members SET last_active = NOW()
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  },

  /**
   * Join room by code (for players)
   * @param {string} code - Room code
   * @param {string} userId - User joining
   * @param {string} role - 'gm' or 'player'
   */
  async joinByCode(code, userId, role = 'player') {
    const room = await this.findByCode(code);
    if (!room) {
      throw new Error('Room not found');
    }
    
    await this.addMember(room.id, userId, role);
    await this.touch(room.id);
    
    return room;
  },

  /**
   * Delete room
   */
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM rooms WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Clean up old inactive rooms
   */
  async cleanupInactive(daysOld = 30) {
    const result = await pool.query(
      `DELETE FROM rooms 
       WHERE last_active < NOW() - INTERVAL '${daysOld} days'
       RETURNING *`
    );
    return result.rows;
  }
};

export default Room;
