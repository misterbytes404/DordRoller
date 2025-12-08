import pool, { generateHexId } from '../config/database.js';

export const CharacterSheet = {
  // Create a new character sheet (belongs to a ROOM, not a player)
  async create(roomId, sheetData = {}) {
    const id = generateHexId(16); // Generate 16-char hex ID
    const query = `
      INSERT INTO character_sheets (
        id, room_id, name, class, level, race, alignment, background, xp,
        hp, max_hp, ac, speed, hit_dice, player_name,
        abilities, manual_mods, saving_throws, skills, weapons,
        spellcasting, spell_slots, equipment, features, spells
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      ) RETURNING *
    `;
    
    const values = [
      id,
      roomId,
      sheetData.name || '',
      sheetData.class || '',
      sheetData.level || 1,
      sheetData.race || '',
      sheetData.alignment || '',
      sheetData.background || '',
      sheetData.xp || 0,
      sheetData.hp || 0,
      sheetData.maxHp || 0,
      sheetData.ac || 10,
      sheetData.speed || '',
      sheetData.hitDice || '',
      sheetData.playerName || '',
      JSON.stringify(sheetData.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
      JSON.stringify(sheetData.manualMods || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }),
      JSON.stringify(sheetData.savingThrows || {}),
      JSON.stringify(sheetData.skills || {}),
      JSON.stringify(sheetData.weapons || []),
      JSON.stringify(sheetData.spellcasting || {}),
      JSON.stringify(sheetData.spellSlots || []),
      sheetData.equipment || '',
      sheetData.features || '',
      sheetData.spells || ''
    ];
    
    const result = await pool.query(query, values);
    return this.formatSheet(result.rows[0]);
  },

  // Get character sheet by ID
  async findById(id) {
    const query = 'SELECT * FROM character_sheets WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this.formatSheet(result.rows[0]) : null;
  },

  // Get all character sheets for a room (shared pool)
  async findByRoomId(roomId) {
    const query = 'SELECT * FROM character_sheets WHERE room_id = $1 ORDER BY name ASC, updated_at DESC';
    const result = await pool.query(query, [roomId]);
    return result.rows.map(row => this.formatSheet(row));
  },

  // Update character sheet
  async update(id, sheetData) {
    const query = `
      UPDATE character_sheets SET
        name = $2, class = $3, level = $4, race = $5, alignment = $6,
        background = $7, xp = $8, hp = $9, max_hp = $10, ac = $11,
        speed = $12, hit_dice = $13, player_name = $14,
        abilities = $15, manual_mods = $16, saving_throws = $17,
        skills = $18, weapons = $19, spellcasting = $20, spell_slots = $21,
        equipment = $22, features = $23, spells = $24,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [
      id,
      sheetData.name || '',
      sheetData.class || '',
      sheetData.level || 1,
      sheetData.race || '',
      sheetData.alignment || '',
      sheetData.background || '',
      sheetData.xp || 0,
      sheetData.hp || 0,
      sheetData.maxHp || 0,
      sheetData.ac || 10,
      sheetData.speed || '',
      sheetData.hitDice || '',
      sheetData.playerName || '',
      JSON.stringify(sheetData.abilities || {}),
      JSON.stringify(sheetData.manualMods || {}),
      JSON.stringify(sheetData.savingThrows || {}),
      JSON.stringify(sheetData.skills || {}),
      JSON.stringify(sheetData.weapons || []),
      JSON.stringify(sheetData.spellcasting || {}),
      JSON.stringify(sheetData.spellSlots || []),
      sheetData.equipment || '',
      sheetData.features || '',
      sheetData.spells || ''
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0] ? this.formatSheet(result.rows[0]) : null;
  },

  // Delete character sheet
  async delete(id) {
    const query = 'DELETE FROM character_sheets WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  },

  // Format database row to camelCase for frontend
  formatSheet(row) {
    if (!row) return null;
    return {
      id: row.id,
      roomId: row.room_id,
      name: row.name,
      class: row.class,
      level: row.level,
      race: row.race,
      alignment: row.alignment,
      background: row.background,
      xp: row.xp,
      hp: row.hp,
      maxHp: row.max_hp,
      ac: row.ac,
      speed: row.speed,
      hitDice: row.hit_dice,
      playerName: row.player_name,
      abilities: row.abilities,
      manualMods: row.manual_mods,
      savingThrows: row.saving_throws,
      skills: row.skills,
      weapons: row.weapons,
      spellcasting: row.spellcasting,
      spellSlots: row.spell_slots,
      equipment: row.equipment,
      features: row.features,
      spells: row.spells,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default CharacterSheet;
