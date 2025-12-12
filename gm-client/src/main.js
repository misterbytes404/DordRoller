import { io } from 'socket.io-client';
import { DiceRoller } from './modules/diceRoller.js';
import { MonsterTracker } from './modules/monsterTracker.js';
import { PlayerTracker } from './modules/playerTracker.js';
import { RollLog } from './modules/rollLog.js';

// Dynamic base URL - works in both dev and production
const BASE_URL = window.location.origin;

// Initialize socket connection
const socket = io(BASE_URL);

// Auth URLs
const AUTH_URL = `${BASE_URL}/auth`;

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
    window.location.href = `${BASE_URL}/landing`;
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
      <a href="/account/" class="dropdown-item">
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
    window.location.href = `${BASE_URL}/landing`;
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
    const roomNameInput = document.getElementById('room-name-input');
    const roomName = roomNameInput.value.trim() || `${currentUser?.displayName || 'GM'}'s Room`;
    
    // Use the proper API endpoint with credentials to associate room with logged-in user
    const response = await fetch(`${BASE_URL}/api/rooms`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: roomName })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create room');
    }
    
    const data = await response.json();
    socket.emit('gm_join_room', { roomCode: data.code, gmName: currentUser?.displayName || 'DarkLord' });
    currentRoom = data.code;
    showRoomInfo(data.code, data.id, data.name || roomName);
  } catch (error) {
    console.error('Error creating room:', error);
    alert('Error creating room');
  }
});

document.getElementById('join-room-btn').addEventListener('click', async () => {
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  await joinRoomByCode(roomCode);
});

// Leave room button
document.getElementById('leave-room-btn')?.addEventListener('click', () => {
  leaveCurrentRoom();
});

// Delete room button
document.getElementById('delete-room-btn')?.addEventListener('click', async () => {
  if (!currentRoomId) {
    alert('No room to delete');
    return;
  }
  
  const roomName = document.getElementById('current-room-name')?.textContent || 'this room';
  if (!confirm(`Are you sure you want to permanently delete "${roomName}"? This cannot be undone.`)) {
    return;
  }
  
  await deleteRoom(currentRoomId);
});

// Delete room function
async function deleteRoom(roomId) {
  try {
    const response = await fetch(`${BASE_URL}/api/rooms/${roomId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      alert('Room deleted successfully');
      leaveCurrentRoom();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete room');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    alert('Error deleting room');
  }
}

// Join room by code (reusable function)
async function joinRoomByCode(roomCode) {
  try {
    // Use API endpoint to verify room exists
    const response = await fetch(`${BASE_URL}/api/rooms/code/${roomCode}`, {
      credentials: 'include'
    });
    if (response.ok) {
      const room = await response.json();
      socket.emit('gm_join_room', { roomCode, gmName: currentUser?.displayName || 'DarkLord' });
      currentRoom = roomCode;
      showRoomInfo(roomCode, room.id, room.name);
    } else {
      alert('Invalid room code');
    }
  } catch (error) {
    console.error('Error joining room:', error);
    alert('Error joining room');
  }
}

// Leave current room
function leaveCurrentRoom() {
  if (currentRoom) {
    socket.emit('leave_room', { roomCode: currentRoom });
  }
  currentRoom = null;
  currentRoomId = null;
  
  // Clear monster tracker room ID
  monsterTracker.setRoomId(null);
  
  // Reset UI
  document.getElementById('room-setup').style.display = 'block';
  document.getElementById('room-info').style.display = 'none';
  document.getElementById('room-name-input').value = '';
  document.getElementById('room-code').value = '';
  
  // Clear URL parameter
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function showRoomInfo(code, roomId = null, roomName = null) {
  document.getElementById('room-setup').style.display = 'none';
  document.getElementById('room-info').style.display = 'block';
  document.getElementById('current-room-code').textContent = code;
  
  // Set room ID for persistence
  if (roomId) {
    currentRoomId = roomId;
    // Set room ID for monster tracker persistence
    monsterTracker.setRoomId(roomId);
    console.log('Room ID set for persistence:', roomId);
  }
  
  // Show room name
  const roomNameDisplay = document.getElementById('current-room-name');
  if (roomNameDisplay) {
    roomNameDisplay.textContent = roomName || 'Unnamed Room';
  }
  
  // Show room ID if available
  const roomIdDisplay = document.getElementById('room-id-display');
  if (roomIdDisplay && roomId) {
    roomIdDisplay.textContent = `Room ID: #${roomId}`;
    roomIdDisplay.style.display = 'block';
  }
  
  const obsUrl = `${BASE_URL}/obs?room=${code}`;
  document.getElementById('obs-link').href = obsUrl;
  document.getElementById('obs-link').textContent = obsUrl;
}

// Check for room code in URL on page load
function checkUrlForRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode) {
    console.log('Found room code in URL:', roomCode);
    // Wait a bit for socket connection and auth to initialize
    setTimeout(() => {
      joinRoomByCode(roomCode.toUpperCase());
    }, 500);
  }
}

// Call after auth initializes
const originalInitAuth = initAuth;
async function initAuthWithRoomCheck() {
  await originalInitAuth.call(this);
  checkUrlForRoom();
}

// Override init to check for room param
if (document.readyState === 'loading') {
  document.removeEventListener('DOMContentLoaded', initAuth);
  document.addEventListener('DOMContentLoaded', initAuthWithRoomCheck);
} else {
  // Already loaded, check now
  checkUrlForRoom();
}

socket.on('room_joined', (data) => {
  console.log('Joined room:', data.roomCode, 'DB ID:', data.roomId, 'Name:', data.roomName);
  currentRoomId = data.roomId || null;
  
  // Only update room info if we don't already have a name showing
  // (prevents overwriting when we already set it from API response)
  const currentName = document.getElementById('current-room-name')?.textContent;
  if (!currentName || currentName === '-' || currentName === 'Unnamed Room') {
    showRoomInfo(data.roomCode, data.roomId, data.roomName);
  }
  
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
