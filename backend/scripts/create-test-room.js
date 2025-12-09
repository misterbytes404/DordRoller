// Script to create a test room owned by a different user
import pool, { generateHexId } from '../config/database.js';

async function createTestRoom() {
  try {
    const roomId = generateHexId(16);
    const roomCode = generateHexId(8).toUpperCase();
    const ownerId = '159D6C52CD5CC274'; // testuser3
    const name = 'Test Room (Not Your GM)';
    
    await pool.query('BEGIN');
    
    const r = await pool.query(
      'INSERT INTO rooms (id, code, name, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [roomId, roomCode, name, ownerId]
    );
    
    const memberId = generateHexId(16);
    await pool.query(
      'INSERT INTO room_members (id, room_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [memberId, roomId, ownerId, 'gm']
    );
    
    await pool.query('COMMIT');
    
    console.log('✅ Created test room!');
    console.log('Room Code:', roomCode);
    console.log('Room Name:', name);
    console.log('Owner: testuser3 (NOT you)');
    console.log('\nYou can join this room as a player using code:', roomCode);
    
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

createTestRoom();
