import pool from '../config/database.js';

// Player data model - PostgreSQL version

export const Player = {
  // Create a new player
  async create(name) {
    const query = 'INSERT INTO players (name) VALUES ($1) RETURNING *';
    const result = await pool.query(query, [name]);
    return result.rows[0];
  },

  // Find player by ID
  async findById(id) {
    const query = 'SELECT * FROM players WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  // Find player by name
  async findByName(name) {
    const query = 'SELECT * FROM players WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0] || null;
  },

  // Find or create player by name
  async findOrCreate(name) {
    let player = await this.findByName(name);
    if (!player) {
      player = await this.create(name);
    }
    return player;
  },

  // Get all players
  async findAll() {
    const query = 'SELECT * FROM players ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  },

  // Delete player
  async delete(id) {
    const query = 'DELETE FROM players WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  }
};

export default Player;
