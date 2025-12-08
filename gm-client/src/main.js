import { io } from 'socket.io-client';
import { DiceRoller } from './modules/diceRoller.js';
import { MonsterTracker } from './modules/monsterTracker.js';
import { PlayerTracker } from './modules/playerTracker.js';
import { RollLog } from './modules/rollLog.js';

// Initialize socket connection
const socket = io('http://localhost:3000');


// State
let currentRoom = null;

// Connection status
socket.on('connect', () => {
  console.log('Connected to server');
  document.getElementById('connection-status').textContent = 'Connected';
  document.getElementById('connection-status').style.color = '#00ff00';
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connection-status').textContent = 'Disconnected';
  document.getElementById('connection-status').style.color = '#ff0000';
});

// Room state
let currentRoomId = null; // Database ID for persistence

// Room management
document.getElementById('create-room-btn').addEventListener('click', async () => {
  try {
    const response = await fetch('http://localhost:3000/create-room', { method: 'POST' });
    const data = await response.json();
    socket.emit('gm_join_room', { roomCode: data.code, gmName: 'DarkLord' });
    currentRoom = data.code;
    showRoomInfo(data.code);
  } catch (error) {
    alert('Error creating room');
  }
});

document.getElementById('join-room-btn').addEventListener('click', async () => {
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/join-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: roomCode })
    });
    if (response.ok) {
      socket.emit('gm_join_room', { roomCode, gmName: 'DarkLord' });
      currentRoom = roomCode;
    } else {
      alert('Invalid room code');
    }
  } catch (error) {
    alert('Error joining room');
  }
});

function showRoomInfo(code, roomId = null) {
  document.getElementById('room-setup').style.display = 'none';
  document.getElementById('room-info').style.display = 'block';
  document.getElementById('current-room-code').textContent = code;
  
  // Show room ID if available
  const roomIdDisplay = document.getElementById('room-id-display');
  if (roomIdDisplay && roomId) {
    roomIdDisplay.textContent = `Room ID: #${roomId}`;
    roomIdDisplay.style.display = 'block';
  }
  
  const obsUrl = `http://localhost:3000/obs-client/index.html?room=${code}`;
  document.getElementById('obs-link').href = obsUrl;
  document.getElementById('obs-link').textContent = obsUrl;
}

socket.on('room_joined', (data) => {
  console.log('Joined room:', data.roomCode, 'DB ID:', data.roomId);
  currentRoomId = data.roomId || null;
  showRoomInfo(data.roomCode, data.roomId);
  
  // Set room ID for monster tracker persistence
  if (currentRoomId) {
    monsterTracker.setRoomId(currentRoomId);
  }
});

socket.on('error', (data) => {
  alert(`Error: ${data.message}`);
});

// Initialize modules
const diceRoller = new DiceRoller(socket, () => currentRoom);
const monsterTracker = new MonsterTracker();
const playerTracker = new PlayerTracker(socket);
const rollLog = new RollLog(socket);
