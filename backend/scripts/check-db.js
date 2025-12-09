// Check database tables
import pool from '../config/database.js';

async function check() {
  try {
    const r = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', r.rows.map(r => r.table_name));
    
    // Check if character_sheets table has the right columns
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'character_sheets'
    `);
    console.log('\nCharacter_sheets columns:', cols.rows);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}

check();
