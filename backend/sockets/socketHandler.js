// Central socket event handler

// In-memory storage for rooms and players
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
      players: {}
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

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Room management - basic join (for OBS client)
    socket.on('join_room', (roomCode) => {
      socket.join(roomCode);
      console.log(`Socket ${socket.id} joined room: ${roomCode}`);
      socket.emit('room_joined', { roomCode });
    });

    // GM joins room
    socket.on('gm_join_room', (roomCode) => {
      socket.join(roomCode);
      const room = getRoom(roomCode);
      room.gm = socket.id;
      socket.roomCode = roomCode;
      socket.isGM = true;
      console.log(`GM ${socket.id} joined room: ${roomCode}`);
      socket.emit('room_joined', { roomCode, role: 'gm' });
      
      // Send current player list to GM
      broadcastPlayerList(io, roomCode);
    });

    // Player joins room
    socket.on('player_join_room', ({ roomCode, playerName }) => {
      socket.join(roomCode);
      const room = getRoom(roomCode);
      
      // Add player to room
      room.players[socket.id] = {
        playerName: playerName || 'Anonymous',
        summary: {},
        online: true,
        lastSync: Date.now()
      };
      
      socket.roomCode = roomCode;
      socket.isPlayer = true;
      
      console.log(`Player ${playerName} (${socket.id}) joined room: ${roomCode}`);
      socket.emit('room_joined', { roomCode, role: 'player' });
      
      // Notify GM of new player
      broadcastPlayerList(io, roomCode);
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
          
          // Notify GM
          broadcastPlayerList(io, roomCode);
          
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
