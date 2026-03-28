import pool, { generateHexId } from '../config/database.js';

export const CustomMonster = {
  async create(userId, monsterData = {}) {
    const id = generateHexId(16);
    const query = `
      INSERT INTO custom_monsters (
        id, user_id, name, source, type, ac, hp, hp_max, hit_dice, speed,
        abilities, skills, senses, languages, cr, actions, reactions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      id,
      userId,
      monsterData.name || 'Custom Monster',
      monsterData.source || 'Custom',
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
      monsterData.reactions || ''
    ];

    const result = await pool.query(query, values);
    return this.formatMonster(result.rows[0]);
  },

  async findByUserId(userId) {
    const query = 'SELECT * FROM custom_monsters WHERE user_id = $1 ORDER BY name ASC';
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => this.formatMonster(row));
  },

  async findById(id) {
    const query = 'SELECT * FROM custom_monsters WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  async update(id, userId, monsterData) {
    const query = `
      UPDATE custom_monsters SET
        name = $3, source = $4, type = $5, ac = $6, hp = $7, hp_max = $8,
        hit_dice = $9, speed = $10, abilities = $11, skills = $12, senses = $13,
        languages = $14, cr = $15, actions = $16, reactions = $17,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      monsterData.name || 'Custom Monster',
      monsterData.source || 'Custom',
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
      monsterData.reactions || ''
    ];

    const result = await pool.query(query, values);
    return result.rows[0] ? this.formatMonster(result.rows[0]) : null;
  },

  async delete(id, userId) {
    const query = 'DELETE FROM custom_monsters WHERE id = $1 AND user_id = $2 RETURNING id';
    const result = await pool.query(query, [id, userId]);
    return result.rows.length > 0;
  },

  formatMonster(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
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
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default CustomMonster;
