// Shared socket event names and data structures

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Room Management
  JOIN_ROOM: 'join_room',
  ROOM_JOINED: 'room_joined',
  LEAVE_ROOM: 'leave_room',
  
  // Dice Rolling (MVP 1)
  GM_ROLL: 'gm_roll',
  BROADCAST_ROLL: 'broadcast_roll',
  
  // Player Roll Assignment (MVP 3)
  ASSIGN_ROLL: 'assign_roll',
  PLAYER_ROLL_RESULT: 'player_roll_result',
  
  // Stat Updates (Future)
  UPDATE_MONSTER: 'update_monster',
  UPDATE_PLAYER: 'update_player',
  DELETE_ENTITY: 'delete_entity'
};

// Data structure templates
export const RollData = {
  roomCode: '',
  roller: '', // 'GM' or player name
  diceType: '', // 'd20', 'd6', etc.
  result: 0,
  label: '', // Description of the roll
  timestamp: 0
};

export const EntityData = {
  id: null,
  name: '',
  hp: 0,
  maxHp: 0,
  ac: 0,
  initiative: 0,
  roomCode: '',
  notes: ''
};
