// Test character sheet creation
import pool, { generateHexId } from '../config/database.js';
import { CharacterSheet } from '../models/CharacterSheet.js';

async function test() {
  try {
    // Get a valid room ID first
    const rooms = await pool.query('SELECT id, code, name FROM rooms LIMIT 1');
    if (rooms.rows.length === 0) {
      console.log('No rooms found! Create a room first.');
      pool.end();
      return;
    }
    
    const room = rooms.rows[0];
    console.log('Using room:', room);
    
    // Try to create a character sheet
    console.log('Creating character sheet...');
    const sheet = await CharacterSheet.create(room.id, {
      name: 'Test Character',
      class: 'Fighter',
      level: 5,
      race: 'Human',
      hp: 45,
      maxHp: 50
    });
    
    console.log('Sheet created successfully!', sheet);
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Full error:', e);
  } finally {
    pool.end();
  }
}

test();
