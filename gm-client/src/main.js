import { io } from 'socket.io-client';
import { DiceRoller } from './modules/diceRoller.js';
import { MonsterTracker } from './modules/monsterTracker.js';
import { PlayerTracker } from './modules/playerTracker.js';
import { RollLog } from './modules/rollLog.js';

// Initialize socket connection
const socket = io('http://localhost:3000');

// Auth URLs
const AUTH_URL = 'http://localhost:3000/auth';

// State
let currentRoom = null;
let currentUser = null;

// ===== AUTH FUNCTIONS =====

// Get current user using cookie-based authentication
async function getCurrentUser() {
  try {
    const response = await fetch(`${AUTH_URL}/me`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Initialize auth
async function initAuth() {
  currentUser = await getCurrentUser();
  
  if (currentUser) {
    console.log('GM logged in as:', currentUser.displayName);
    showUserDropdown();
  } else {
    // Not logged in - redirect to landing page
    window.location.href = 'http://localhost:3000/landing';
  }
}

// Show user dropdown in header
function showUserDropdown() {
  const userArea = document.getElementById('user-area');
  if (!userArea || !currentUser) {
    console.log('showUserDropdown: userArea or currentUser missing', { userArea: !!userArea, currentUser: !!currentUser });
    return;
  }
  
  console.log('showUserDropdown: Creating dropdown for', currentUser.displayName);
  
  const userDropdown = document.createElement('div');
  userDropdown.id = 'user-dropdown';
  userDropdown.className = 'user-dropdown';
  userDropdown.innerHTML = `
    <button class="user-dropdown-btn" id="user-dropdown-toggle">
      ${currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" alt="Avatar" class="user-avatar-small">` : '<i class="fa-solid fa-user"></i>'}
      <span>${currentUser.displayName}</span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    <div class="user-dropdown-menu" id="user-dropdown-menu">
      <a href="http://localhost:3000/account/" class="dropdown-item">
        <i class="fa-solid fa-gear"></i> Account Settings
      </a>
      <button class="dropdown-item logout-btn" id="dropdown-logout-btn">
        <i class="fa-solid fa-sign-out-alt"></i> Logout
      </button>
    </div>
  `;
  
  // Add styles
  if (!document.getElementById('user-dropdown-styles')) {
    const style = document.createElement('style');
    style.id = 'user-dropdown-styles';
    style.textContent = `
      header {
        display: flex !important;
        justify-content: space-between;
        align-items: center;
      }
      .header-right {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .user-dropdown {
        position: relative;
      }
      .user-dropdown-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #2a2a3e;
        border: 1px solid #444;
        padding: 8px 12px;
        border-radius: 6px;
        color: #e0e0e0;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .user-dropdown-btn:hover {
        background: #3a3a4e;
        border-color: #9d4edd;
      }
      .user-avatar-small {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .user-dropdown-menu {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        background: #2a2a3e;
        border: 1px solid #444;
        border-radius: 6px;
        min-width: 180px;
        z-index: 1000;
        margin-top: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .user-dropdown-menu.show {
        display: block;
      }
      .user-dropdown-menu .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 15px;
        color: #e0e0e0;
        text-decoration: none;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .user-dropdown-menu .dropdown-item:hover {
        background: #3a3a4e;
      }
      .user-dropdown-menu .dropdown-item:first-child {
        border-radius: 6px 6px 0 0;
      }
      .user-dropdown-menu .dropdown-item:last-child {
        border-radius: 0 0 6px 6px;
        color: #dc3545;
      }
    `;
    document.head.appendChild(style);
  }
  
  userArea.appendChild(userDropdown);
  
  // Toggle dropdown
  document.getElementById('user-dropdown-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown-menu').classList.toggle('show');
  });
  
  // Close on outside click
  document.addEventListener('click', () => {
    document.getElementById('user-dropdown-menu')?.classList.remove('show');
  });
  
  // Logout button
  document.getElementById('dropdown-logout-btn').addEventListener('click', async () => {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    currentUser = null;
    window.location.href = 'http://localhost:3000/landing';
  });
}

// Initialize auth on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

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
    socket.emit('gm_join_room', { roomCode: data.code, gmName: currentUser?.displayName || 'DarkLord' });
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
      socket.emit('gm_join_room', { roomCode, gmName: currentUser?.displayName || 'DarkLord' });
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
