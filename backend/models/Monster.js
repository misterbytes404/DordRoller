import pool, { generateHexId } from '../config/database.js';

export const Monster = {
  // Create a new monster (belongs to a room)
  async create(roomId, monsterData = {}) {
    const id = generateHexId(16); // 16-char hex ID
    const query = `
      INSERT INTO monsters (
        id, room_id, name, source, type, ac, hp, hp_max, hit_dice, speed,
        abilities, skills, senses, languages, cr, actions, reactions, display_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `;
    
    const values = [
      id,
      roomId,
      monsterData.name || 'Unknown Monster',
      monsterData.source || '',
      monsterData.type || '',
      monsterData.ac || 10,
      monsterData.hp || 1,
      monsterData.hpMax || monsterData.hp || 1,
      monsterData.hitDice || '',
      monsterData.speed || '',
      JSON.stringify(monsterData.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
      monsterData.skills || '',
      monsterData.senses || '',
      monsterData.languages || '',
      monsterData.cr || '',
      monsterData.actions || '',
      monsterData.reactions || '',
      monsterData.displayOrder || 0
    ];
    
    const result = await pool.query(query, values);
    return this.formatMonster(result.rows[0]);
  },

  // Get monster by ID
  async findById(id) {
    const query = 'SELECT * FROM monsters WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  // Get all monsters for a room
  async findByRoomId(roomId) {
    const query = 'SELECT * FROM monsters WHERE room_id = $1 ORDER BY display_order ASC, created_at ASC';
    const result = await pool.query(query, [roomId]);
    return result.rows.map(row => this.formatMonster(row));
  },

  // Update monster
  async update(id, monsterData) {
    const query = `
      UPDATE monsters SET
        name = $2, source = $3, type = $4, ac = $5, hp = $6, hp_max = $7,
        hit_dice = $8, speed = $9, abilities = $10, skills = $11, senses = $12,
        languages = $13, cr = $14, actions = $15, reactions = $16, display_order = $17,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [
      id,
      monsterData.name || 'Unknown Monster',
      monsterData.source || '',
      monsterData.type || '',
      monsterData.ac || 10,
      monsterData.hp || 1,
      monsterData.hpMax || monsterData.hp || 1,
      monsterData.hitDice || '',
      monsterData.speed || '',
      JSON.stringify(monsterData.abilities || {}),
      monsterData.skills || '',
      monsterData.senses || '',
      monsterData.languages || '',
      monsterData.cr || '',
      monsterData.actions || '',
      monsterData.reactions || '',
      monsterData.displayOrder || 0
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  // Update just HP (for quick combat updates)
  async updateHp(id, hp) {
    const query = `
      UPDATE monsters SET hp = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, hp]);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  // Update display order (for initiative reordering)
  async updateOrder(id, displayOrder) {
    const query = `
      UPDATE monsters SET display_order = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, displayOrder]);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  // Bulk update display orders for a room
  async updateAllOrders(roomId, orderMap) {
    // orderMap is an object { monsterId: displayOrder, ... }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const [monsterId, order] of Object.entries(orderMap)) {
        await client.query(
          'UPDATE monsters SET display_order = $1, updated_at = NOW() WHERE id = $2 AND room_id = $3',
          [order, monsterId, roomId]
        );
      }
      
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Delete monster
  async delete(id) {
    const query = 'DELETE FROM monsters WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  },

  // Delete all monsters in a room
  async deleteAllInRoom(roomId) {
    const query = 'DELETE FROM monsters WHERE room_id = $1 RETURNING id';
    const result = await pool.query(query, [roomId]);
    return result.rows.length;
  },

  // Format database row to camelCase for frontend
  formatMonster(row) {
    if (!row) return null;
    return {
      id: row.id,
      roomId: row.room_id,
      name: row.name,
      source: row.source,
      type: row.type,
      ac: row.ac,
      hp: row.hp,
      hpMax: row.hp_max,
      hitDice: row.hit_dice,
      speed: row.speed,
      abilities: row.abilities,
      skills: row.skills,
      senses: row.senses,
      languages: row.languages,
      cr: row.cr,
      actions: row.actions,
      reactions: row.reactions,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default Monster;
