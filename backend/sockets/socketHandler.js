// Central socket event handler
import { Room } from '../models/Room.js';

// In-memory storage for rooms and players (for real-time state)
// Database stores persistent data; this stores ephemeral socket connections
const rooms = {};

// Helper to get or create a room
function getRoom(roomCode) {
  // Sanitize room code to prevent prototype pollution
  if (typeof roomCode !== 'string' || roomCode === '__proto__' || roomCode === 'constructor' || roomCode === 'prototype') {
    return null;
  }
  
  if (!Object.prototype.hasOwnProperty.call(rooms, roomCode)) {
    rooms[roomCode] = {
      gm: null,
      players: {},
      monsters: {},
      overlaySettings: {}
    };
  }
  return rooms[roomCode];
}

// Helper to broadcast player list to GM
function broadcastPlayerList(io, roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.gm) return;
  
  const playerList = Object.entries(room.players).map(([socketId, data]) => ({
    socketId,
    playerName: data.playerName,
    playerId: data.playerId || null,
    characterSheetId: data.characterSheetId || null,
    characterName: data.summary?.characterName || 'Unknown',
    ac: data.summary?.ac || '—',
    currentHp: data.summary?.currentHp || '—',
    maxHp: data.summary?.maxHp || '—',
    level: data.summary?.level || '—',
    race: data.summary?.race || '—',
    class: data.summary?.class || '—',
    online: data.online
  }));
  
  io.to(room.gm).emit('player_list_update', playerList);
}

// Helper to find existing player entry by playerId (for reconnect dedup)
function findExistingPlayer(room, playerId) {
  if (!playerId) return null;
  for (const [socketId, data] of Object.entries(room.players)) {
    if (data.playerId === playerId) return socketId;
  }
  return null;
}

// Stable entity ID for a player (prefers playerId, falls back to socketId)
function getPlayerEntityId(socketId, data) {
  return data.playerId || socketId;
}

//Overlay Entity Helper (monsters + players)
function buildEntityList(roomCode) {
  const room = rooms[roomCode];
  if (!room) return [];

  const entities = [];

  //Add monsters
  for (const [id,monster] of Object.entries(room.monsters)) {
    entities.push({
      id,
      name: monster.name,
      hp: monster.hp,
      hpMax: monster.hpMax,
      type: 'monster'
      });
}

  //Add players (only online players with HP data)
  for (const [socketID, player] of Object.entries(room.players)) {
    if (!player.online) continue;
    if (player.summary?.currentHp && player.summary?.maxHp) {
      entities.push({
        id: getPlayerEntityId(socketID, player),
        name: player.summary.characterName || player.playerName,
        playerName: player.playerName || player.summary?.playerName || null,
        authProvider: player.authProvider || null,
        hp: Number(player.summary.currentHp),
        hpMax: Number(player.summary.maxHp),
        type: 'player'
      });
    }
  }

  return entities;
}

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Room management - basic join (for OBS client)
    socket.on('join_room', (roomCode) => {
      socket.join(roomCode);
      socket.roomCode = roomCode;
      console.log(`Socket ${socket.id} joined room: ${roomCode}`);
      socket.emit('room_joined', { roomCode });
    });

    // GM joins room
    socket.on('gm_join_room', async ({ roomCode, gmName }) => {
      socket.join(roomCode);
      const room = getRoom(roomCode);
      room.gm = socket.id;
      socket.roomCode = roomCode;
      socket.isGM = true;
      
      // Persist room to database (find or create)
      try {
        const dbRoom = await Room.findOrCreate(roomCode, gmName || 'GM');
        room.dbId = dbRoom.id; // Store database ID for later use
        console.log(`GM ${socket.id} joined room: ${roomCode} (DB ID: ${dbRoom.id})`);
        socket.emit('room_joined', { roomCode, role: 'gm', roomId: dbRoom.id, roomName: dbRoom.name });
      } catch (error) {
        console.error('Failed to persist room:', error);
        socket.emit('room_joined', { roomCode, role: 'gm' });
      }
      
      // Send current player list to GM
      broadcastPlayerList(io, roomCode);
    });

    // Player joins room
    socket.on('player_join_room', async ({ roomCode, playerName, playerId, characterSheetId, authProvider }) => {
      socket.join(roomCode);
      const room = getRoom(roomCode);
      
      // Check if this player already has an entry (reconnect dedup)
      const existingSocketId = findExistingPlayer(room, playerId);
      if (existingSocketId && existingSocketId !== socket.id) {
        // Transfer data from old entry to new socket ID
        const oldData = room.players[existingSocketId];
        delete room.players[existingSocketId];
        room.players[socket.id] = {
          ...oldData,
          playerName: playerName || oldData.playerName,
          playerId: playerId || oldData.playerId,
          characterSheetId: characterSheetId || oldData.characterSheetId || null,
          authProvider: authProvider || oldData.authProvider || null,
          online: true,
          lastSync: Date.now()
        };
        console.log(`Player ${playerName} reconnected: ${existingSocketId} -> ${socket.id}`);
      } else {
        // New player
        room.players[socket.id] = {
          playerName: playerName || 'Anonymous',
          playerId: playerId || null,
          characterSheetId: characterSheetId || null,
          authProvider: authProvider || null,
          summary: {},
          online: true,
          lastSync: Date.now()
        };
      }
      
      socket.roomCode = roomCode;
      socket.isPlayer = true;
      
      // Persist player-room association to database if we have IDs
      let dbRoomId = room.dbId;
      let dbRoomName = room.dbName;
      if (!dbRoomId) {
        try {
          const dbRoom = await Room.findByCode(roomCode);
          if (dbRoom) {
            dbRoomId = dbRoom.id;
            dbRoomName = dbRoom.name;
            room.dbId = dbRoomId;
            room.dbName = dbRoomName;
          }
        } catch (error) {
          console.error('Failed to find room in database:', error);
        }
      }
      
      if (dbRoomId && playerId) {
        try {
          await Room.addMember(dbRoomId, playerId, 'player');
          console.log(`Player ${playerName} (ID: ${playerId}) persisted to room ${roomCode}`);
        } catch (error) {
          console.error('Failed to persist player to room:', error);
        }
      }
      
      console.log(`Player ${playerName} (${socket.id}) joined room: ${roomCode}`);
      socket.emit('room_joined', { roomCode, role: 'player', roomId: dbRoomId, roomName: dbRoomName });
      
      // Notify GM of new player and update OBS entity list
      broadcastPlayerList(io, roomCode);
      io.to(roomCode).emit('broadcast_entity_list', buildEntityList(roomCode));
    });

    // Player sends their database IDs after getting them
    socket.on('player_update_ids', async ({ playerId, characterSheetId }) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      
      const room = rooms[roomCode];
      if (room.players[socket.id]) {
        room.players[socket.id].playerId = playerId;
        room.players[socket.id].characterSheetId = characterSheetId;
        
        // Re-broadcast entity list so OBS gets the stable ID
        io.to(roomCode).emit('broadcast_entity_list', buildEntityList(roomCode));
        
        // Persist to database
        if (room.dbId && playerId) {
          try {
            await Room.addMember(room.dbId, playerId, 'player');
            console.log(`Player ${socket.id} IDs persisted: playerId=${playerId}, sheetId=${characterSheetId}`);
          } catch (error) {
            console.error('Failed to persist player IDs:', error);
          }
        }
      }
    });

    // Player syncs summary data (every 30 seconds)
    socket.on('player_sync', (summaryData) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      
      const room = rooms[roomCode];
      if (room.players[socket.id]) {
        room.players[socket.id].summary = summaryData;
        room.players[socket.id].lastSync = Date.now();
        console.log(`Player sync from ${socket.id}:`, summaryData.characterName);
        
        // Update GM's player list
        broadcastPlayerList(io, roomCode);
        
        //Broadcast HP update to room (for OBS health bars)
        if (summaryData.currentHp && summaryData.maxHp) {
          const playerData = room.players[socket.id];
          io.to(roomCode).emit('broadcast_hp_update', {
            id: getPlayerEntityId(socket.id, playerData),
            name: summaryData.characterName || 'Unknown',
            playerName: playerData?.playerName || summaryData.playerName || null,
            authProvider: playerData?.authProvider || null,
            hp: Number(summaryData.currentHp),
            hpMax: Number(summaryData.maxHp),
            type: 'player'
          });
        }
      }
    });

    // GM requests full character sheet from a player
    socket.on('request_player_sheet', (targetSocketId) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM) return;
      
      console.log(`GM requesting sheet from player ${targetSocketId}`);
      
      // Ask the player to send their full sheet
      io.to(targetSocketId).emit('request_sheet_data', { requesterId: socket.id });
    });

    // GM requests all players to sync their summary data
    socket.on('request_all_sync', () => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM) return;
      
      console.log(`GM requesting sync from all players in room: ${roomCode}`);
      
      // Broadcast to all players in the room to sync
      socket.to(roomCode).emit('request_sync');
    });

    // Player responds with full character sheet
    socket.on('player_sheet_response', ({ requesterId, sheetData }) => {
      console.log(`Player ${socket.id} sending sheet to GM ${requesterId}`);
      
      // Send directly to the GM who requested it
      io.to(requesterId).emit('player_sheet_data', {
        socketId: socket.id,
        sheetData
      });
    });

    // Health Bar Events

    // GM updates monster health bar via slider
    socket.on('monster_hp_update', (data) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM || !rooms[roomCode]) return;

      const { monsterId, hp, hpMax } = data;
      const room = rooms[roomCode];

      // Merge into existing monster state (preserve name from add)
      const existing = room.monsters[monsterId] || {};
      room.monsters[monsterId] = { ...existing, hp, hpMax };

      // Broadcast updated monster health to all clients in the room
      io.to(roomCode).emit('broadcast_hp_update', {
        id: monsterId,
        name: existing.name || 'Unknown',
        hp,
        hpMax,
        type: 'monster'
      });
    });

    // GM adds or removes a monster
    socket.on('monster_list_changed', (data) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM || !rooms[roomCode]) return;

      const {action, monsterId, monster} = data;
      const room = rooms[roomCode];

      if (action === 'add' && monster) {
        const id = monster.id || monsterId;
        room.monsters[id] = {
          name: monster.name,
          hp: monster.hp,
          hpMax: monster.hpMax,
        };
      } else if (action === 'delete') {
        delete room.monsters[monsterId];
      }

      // Send full updated list to room
      io.to(roomCode).emit('broadcast_entity_list', buildEntityList(roomCode));
    });

    // GM bulk-syncs all monsters (e.g. after page reload)
    socket.on('sync_entity_list', (data) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM || !rooms[roomCode]) return;

      const room = rooms[roomCode];
      const monsters = data.monsters || [];

      // Replace in-memory monster state with what the GM currently has
      room.monsters = {};
      for (const m of monsters) {
        if (m.id != null) {
          room.monsters[m.id] = { name: m.name, hp: m.hp, hpMax: m.hpMax };
        }
      }

      io.to(roomCode).emit('broadcast_entity_list', buildEntityList(roomCode));
    });

    // OBS client request current entity list on connect
    socket.on('request_entity_list', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) return;

      socket.emit('broadcast_entity_list', buildEntityList(roomCode));

      // Send current overlay settings if they exist
      const room = rooms[roomCode];
      if (room?.overlaySettings) {
        socket.emit('overlay_settings_update', room.overlaySettings);
      }
    });

    // GM updates overlay settings (colors, toggles)
    socket.on('overlay_settings_update', (settings) => {
      const roomCode = socket.roomCode;
      if (!roomCode || !socket.isGM || !rooms[roomCode]) return;

      rooms[roomCode].overlaySettings = settings;

      // Broadcast to room
      io.to(roomCode).emit('overlay_settings_update', settings);
    });

    // GM roll events
    socket.on('gm_roll', (rollData) => {
      console.log('GM roll:', rollData);
      // Broadcast to room (especially OBS client)
      io.to(rollData.roomCode).emit('broadcast_roll', rollData);
    });

    // Player roll events
    socket.on('player_roll', (rollData) => {
      console.log('Player roll:', rollData);
      // Broadcast to room (especially OBS client)
      io.to(rollData.roomCode).emit('broadcast_roll', rollData);
    });

    // Player roll assignment (MVP 3)
    socket.on('assign_roll', (assignmentData) => {
      // Implementation pending
    });

    // Player roll response (MVP 3)
    socket.on('player_roll_result', (resultData) => {
      // Implementation pending
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      const roomCode = socket.roomCode;
      if (roomCode && rooms[roomCode]) {
        const room = rooms[roomCode];
        
        // If GM disconnected
        if (socket.isGM && room.gm === socket.id) {
          room.gm = null;
          console.log(`GM left room: ${roomCode}`);
        }
        
        // If player disconnected, mark as offline but keep data
        if (socket.isPlayer && room.players[socket.id]) {
          room.players[socket.id].online = false;
          console.log(`Player ${room.players[socket.id].playerName} went offline in room: ${roomCode}`);
          
          // Notify GM and immediately update OBS (removes offline player from overlay)
          broadcastPlayerList(io, roomCode);
          io.to(roomCode).emit('broadcast_entity_list', buildEntityList(roomCode));
          
          // Remove player data after 5 minutes of being offline
          setTimeout(() => {
            if (rooms[roomCode]?.players[socket.id]?.online === false) {
              delete rooms[roomCode].players[socket.id];
              console.log(`Removed offline player ${socket.id} from room: ${roomCode}`);
              broadcastPlayerList(io, roomCode);
            }
          }, 5 * 60 * 1000);
        }
      }
    });
  });
};

export default setupSocketHandlers;
