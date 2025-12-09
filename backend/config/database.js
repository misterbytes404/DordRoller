import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Create connection pool - support both DATABASE_URL and individual vars
const poolConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dordroller',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

// Generate hex ID (8 characters = 4 bytes = 32 bits of randomness)
export function generateHexId(length = 8) {
  return crypto.randomBytes(length / 2).toString('hex').toUpperCase();
}

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL at', res.rows[0].now);
  }
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // UNCOMMENT BELOW TO RESET DATABASE SCHEMA (destroys all data!)
    // Only use when you need to change the schema structure
    /*
    if (process.env.NODE_ENV !== 'production') {
      await client.query(`
        DROP TABLE IF EXISTS room_players CASCADE;
        DROP TABLE IF EXISTS character_sheets CASCADE;
        DROP TABLE IF EXISTS monsters CASCADE;
        DROP TABLE IF EXISTS rooms CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS players CASCADE;
      `);
      console.log('🗑️ Dropped old tables for schema update');
    }
    */

    await client.query(`
      -- Users table (supports both Twitch SSO and local accounts)
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(16) PRIMARY KEY,
        
        -- Auth type: 'twitch' or 'local'
        auth_type VARCHAR(20) NOT NULL DEFAULT 'local' CHECK (auth_type IN ('twitch', 'local')),
        
        -- Twitch OAuth fields (null for local accounts)
        twitch_id VARCHAR(50) UNIQUE,
        
        -- Local auth fields (null for Twitch accounts)
        username VARCHAR(50) UNIQUE,
        password_hash VARCHAR(255),
        
        -- Common fields
        display_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        avatar_url TEXT,
        
        -- Security fields
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        password_reset_token VARCHAR(64),
        password_reset_expires TIMESTAMP,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW(),
        
        -- Ensure either twitch_id OR username is set based on auth_type
        CONSTRAINT valid_auth_fields CHECK (
          (auth_type = 'twitch' AND twitch_id IS NOT NULL) OR
          (auth_type = 'local' AND username IS NOT NULL AND password_hash IS NOT NULL)
        )
      );

      -- Rooms table with hex IDs and naming
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(16) PRIMARY KEY,
        code VARCHAR(8) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Unnamed Room',
        owner_id VARCHAR(16) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW()
      );

      -- User-Room membership (tracks who's in each room and their role)
      CREATE TABLE IF NOT EXISTS room_members (
        id VARCHAR(16) PRIMARY KEY,
        room_id VARCHAR(16) REFERENCES rooms(id) ON DELETE CASCADE,
        user_id VARCHAR(16) REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('gm', 'player')),
        joined_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        UNIQUE(room_id, user_id)
      );

      -- Character sheets belong to ROOMS (not users)
      -- Any player in the room can select/edit any character
      CREATE TABLE IF NOT EXISTS character_sheets (
        id VARCHAR(16) PRIMARY KEY,
        room_id VARCHAR(16) REFERENCES rooms(id) ON DELETE CASCADE,
        name VARCHAR(100),
        class VARCHAR(50),
        level INTEGER DEFAULT 1,
        race VARCHAR(50),
        alignment VARCHAR(50),
        background VARCHAR(100),
        xp INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 0,
        max_hp INTEGER DEFAULT 0,
        ac INTEGER DEFAULT 10,
        speed VARCHAR(20),
        hit_dice VARCHAR(20),
        player_name VARCHAR(100),
        assigned_user_id VARCHAR(16) REFERENCES users(id) ON DELETE SET NULL,
        
        -- Complex data as JSONB
        abilities JSONB DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
        manual_mods JSONB DEFAULT '{"str":0,"dex":0,"con":0,"int":0,"wis":0,"cha":0}',
        saving_throws JSONB DEFAULT '{"str":false,"dex":false,"con":false,"int":false,"wis":false,"cha":false}',
        skills JSONB DEFAULT '{}',
        weapons JSONB DEFAULT '[]',
        spellcasting JSONB DEFAULT '{}',
        spell_slots JSONB DEFAULT '[]',
        equipment TEXT DEFAULT '',
        features TEXT DEFAULT '',
        spells TEXT DEFAULT '',
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Monsters belong to ROOMS (tracked by GM)
      CREATE TABLE IF NOT EXISTS monsters (
        id VARCHAR(16) PRIMARY KEY,
        room_id VARCHAR(16) REFERENCES rooms(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        source VARCHAR(50),
        type VARCHAR(100),
        ac INTEGER DEFAULT 10,
        hp INTEGER DEFAULT 1,
        hp_max INTEGER DEFAULT 1,
        hit_dice VARCHAR(50),
        speed VARCHAR(100),
        
        -- Ability scores as JSONB
        abilities JSONB DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
        
        -- Other monster data
        skills TEXT,
        senses TEXT,
        languages TEXT,
        cr VARCHAR(10),
        actions TEXT,
        reactions TEXT,
        
        -- Display order for initiative tracking
        display_order INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes for faster lookups
      CREATE INDEX IF NOT EXISTS idx_users_twitch_id ON users(twitch_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
      CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_character_sheets_room_id ON character_sheets(room_id);
      CREATE INDEX IF NOT EXISTS idx_character_sheets_assigned_user ON character_sheets(assigned_user_id);
      CREATE INDEX IF NOT EXISTS idx_monsters_room_id ON monsters(room_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);

      -- Sessions table for server-side session management
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(16) REFERENCES users(id) ON DELETE CASCADE,
        user_agent TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        last_active TIMESTAMP DEFAULT NOW()
      );

      -- Index for session lookups and cleanup
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    console.log('✅ Database schema initialized (Twitch SSO, room membership, sessions)');
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err.message);
  } finally {
    client.release();
  }
}

export { pool };
export default pool;
