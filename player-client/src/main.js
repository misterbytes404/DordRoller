import { io } from 'socket.io-client';

// Initialize socket connection
const socket = io('http://localhost:3000');

// API base URL
const API_URL = 'http://localhost:3000/api';
const AUTH_URL = 'http://localhost:3000/auth';

// State
let playerName = '';
let currentRoom = null;
let currentRoomId = null; // Database hex ID for the room
let currentRollMode = 'normal'; // 'normal', 'advantage', 'disadvantage'
let currentPlayerId = null;
let currentSheetId = null;
let currentUser = null; // Logged in user from auth

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

// Initialize auth on page load
async function initAuth() {
  console.log('initAuth: Starting...');
  
  currentUser = await getCurrentUser();
  console.log('initAuth: currentUser:', currentUser);
  
  if (currentUser) {
    console.log('Logged in as:', currentUser.displayName);
    
    // Pre-fill and lock player name with display name
    const playerNameInput = document.getElementById('player-name');
    console.log('initAuth: playerNameInput found:', playerNameInput ? 'yes' : 'no');
    if (playerNameInput) {
      playerNameInput.value = currentUser.displayName;
      playerName = currentUser.displayName;
      playerNameInput.readOnly = true;
      playerNameInput.title = 'Logged in as ' + currentUser.displayName;
      playerNameInput.style.backgroundColor = '#2a2a3e';
      playerNameInput.style.cursor = 'not-allowed';
      console.log('initAuth: Set and locked player name to:', currentUser.displayName);
    }
    
    // Also set the character sheet player name (locked)
    const charPlayerName = document.getElementById('char-player-name');
    if (charPlayerName) {
      charPlayerName.value = currentUser.displayName;
      charPlayerName.readOnly = true;
    }
    
    // Show user profile link
    showUserProfileLink();
  } else {
    // Not logged in - redirect to landing page
    window.location.href = 'http://localhost:3000/landing';
  }
}

// Show user profile link when logged in
function showUserProfileLink() {
  // Remove existing profile link if any
  const existingLink = document.getElementById('user-profile-link');
  if (existingLink) existingLink.remove();
  
  // Create user dropdown in header
  const header = document.querySelector('header');
  if (header && currentUser) {
    const userDropdown = document.createElement('div');
    userDropdown.id = 'user-profile-link';
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
        <button class="dropdown-item" id="dropdown-logout-btn">
          <i class="fa-solid fa-sign-out-alt"></i> Logout
        </button>
      </div>
    `;
    
    // Add styles for dropdown
    if (!document.getElementById('user-dropdown-styles')) {
      const style = document.createElement('style');
      style.id = 'user-dropdown-styles';
      style.textContent = `
        .user-dropdown {
          position: relative;
          margin-left: auto;
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
    
    header.appendChild(userDropdown);
    
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
    document.getElementById('dropdown-logout-btn').addEventListener('click', logoutUser);
  }
}

// Show user profile modal
async function showUserProfileModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('user-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'user-profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <button type="button" class="modal-close" id="profile-modal-close">&times;</button>
        <h3><i class="fa-solid fa-user"></i> Your Profile</h3>
        <div id="profile-content">
          <p>Loading...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('profile-modal-close').onclick = () => {
      modal.style.display = 'none';
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = 'none';
    };
  }
  
  modal.style.display = 'flex';
  
  // Fetch user's rooms
  const token = getAuthToken();
  try {
    const response = await fetch(`${AUTH_URL}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    const profileContent = document.getElementById('profile-content');
    profileContent.innerHTML = `
      <div style="margin-bottom: 15px;">
        ${data.user.avatarUrl ? `<img src="${data.user.avatarUrl}" alt="Avatar" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 10px; vertical-align: middle;">` : ''}
        <strong style="font-size: 1.2rem;">${data.user.displayName}</strong>
        <span style="color: #888; font-size: 0.85rem; display: block; margin-top: 5px;">
          ${data.user.authType === 'twitch' ? '<i class="fa-brands fa-twitch"></i> Twitch Account' : '<i class="fa-solid fa-key"></i> Local Account'}
        </span>
      </div>
      
      <h4 style="margin-top: 20px; border-bottom: 1px solid #444; padding-bottom: 5px;">
        <i class="fa-solid fa-crown"></i> Rooms You GM
      </h4>
      <div id="gm-rooms-list" style="margin: 10px 0;">
        ${data.rooms?.gmRooms?.length ? 
          data.rooms.gmRooms.map(r => `
            <div style="background: #2a2a3e; padding: 8px 12px; border-radius: 6px; margin: 5px 0;">
              <strong>${r.name}</strong> <span style="color: #888; font-size: 0.85rem;">Code: ${r.code}</span>
            </div>
          `).join('') : 
          '<p style="color: #888; font-style: italic;">No rooms yet</p>'
        }
      </div>
      
      <h4 style="margin-top: 20px; border-bottom: 1px solid #444; padding-bottom: 5px;">
        <i class="fa-solid fa-users"></i> Rooms You've Joined
      </h4>
      <div id="player-rooms-list" style="margin: 10px 0;">
        ${data.rooms?.playerRooms?.length ? 
          data.rooms.playerRooms.map(r => `
            <div style="background: #2a2a3e; padding: 8px 12px; border-radius: 6px; margin: 5px 0;">
              <strong>${r.name}</strong> <span style="color: #888; font-size: 0.85rem;">Code: ${r.code}</span>
            </div>
          `).join('') : 
          '<p style="color: #888; font-style: italic;">No rooms joined yet</p>'
        }
      </div>
      
      <button onclick="logoutUser()" style="margin-top: 20px; background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
        <i class="fa-solid fa-sign-out-alt"></i> Logout
      </button>
      <a href="http://localhost:3000/account?token=${encodeURIComponent(getAuthToken())}" style="display: block; margin-top: 10px; color: #9d4edd; text-decoration: none;">
        <i class="fa-solid fa-gear"></i> Account Settings
      </a>
    `;
  } catch (error) {
    console.error('Error fetching profile:', error);
    document.getElementById('profile-content').innerHTML = '<p style="color: #dc3545;">Error loading profile</p>';
  }
}

// Logout function
async function logoutUser() {
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
}

// Make logout available globally for inline onclick
window.logoutUser = logoutUser;

// Check for room code in URL and auto-join
function checkUrlForRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode && currentUser) {
    console.log('Found room code in URL:', roomCode);
    // Auto-fill the room code and join
    const roomCodeInput = document.getElementById('room-code');
    if (roomCodeInput) {
      roomCodeInput.value = roomCode.toUpperCase();
    }
    // Wait a bit for socket connection to be ready, then auto-join
    setTimeout(() => {
      joinRoomByCode(roomCode.toUpperCase());
    }, 500);
  }
}

// Join room by code (used for URL auto-join)
function joinRoomByCode(roomCode) {
  const name = playerName || currentUser?.displayName;
  if (roomCode && name) {
    playerName = name;
    currentRoom = roomCode;
    socket.emit('player_join_room', { 
      roomCode, 
      playerName: name,
      playerId: currentUser?.id || null
    });
  } else {
    console.warn('Cannot auto-join: missing room code or player name');
  }
}

// Call init on page load - wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    checkUrlForRoom();
  });
} else {
  (async () => {
    await initAuth();
    checkUrlForRoom();
  })();
}

// ===== API FUNCTIONS =====

// Note: Player tracking now uses authenticated user IDs from the auth system
// The separate /api/players endpoint is deprecated

// Get all character sheets for a room (shared pool - Roll20 style)
async function getRoomSheets(roomId) {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/sheets`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to get room sheets');
    return await response.json();
  } catch (error) {
    console.error('API Error (getRoomSheets):', error);
    return [];
  }
}

// Create a new character sheet (belongs to room, not player)
async function createSheet(roomId, sheetData) {
  try {
    console.log('Creating sheet for room:', roomId);
    const response = await fetch(`${API_URL}/sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ roomId, ...sheetData })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create sheet failed:', response.status, errorText);
      throw new Error(`Failed to create sheet: ${response.status}`);
    }
    const result = await response.json();
    console.log('Sheet created successfully:', result.id);
    return result;
  } catch (error) {
    console.error('API Error (createSheet):', error);
    return null;
  }
}

// Update an existing character sheet
async function updateSheet(sheetId, sheetData) {
  try {
    console.log('Updating sheet:', sheetId);
    const response = await fetch(`${API_URL}/sheets/${sheetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(sheetData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Update sheet failed:', response.status, errorText);
      throw new Error(`Failed to update sheet: ${response.status}`);
    }
    const result = await response.json();
    console.log('Sheet updated successfully:', result.id);
    return result;
  } catch (error) {
    console.error('API Error (updateSheet):', error);
    return null;
  }
}

// Get a specific character sheet
async function getSheet(sheetId) {
  try {
    const response = await fetch(`${API_URL}/sheets/${sheetId}`);
    if (!response.ok) throw new Error('Failed to get sheet');
    return await response.json();
  } catch (error) {
    console.error('API Error (getSheet):', error);
    return null;
  }
}

// ===== SAVE TOAST NOTIFICATION =====
function showSaveToast(message, type = 'success') {
  // Remove any existing save toast
  const existingToast = document.getElementById('save-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'save-toast';
  toast.className = `save-toast ${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : 
               type === 'error' ? 'fa-exclamation-circle' : 
               'fa-info-circle';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
    <button class="save-toast-close" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== UNIFIED SAVE FUNCTION =====
async function saveToDatabase() {
  console.log('saveToDatabase called - currentRoomId:', currentRoomId, 'currentSheetId:', currentSheetId);
  
  // Save to localStorage first (always as backup)
  saveCharacterSheet();
  
  // If not connected to a room, just use localStorage
  if (!currentRoomId) {
    console.log('No room ID - saved to localStorage only');
    return { success: true, location: 'local' };
  }
  
  try {
    if (currentSheetId) {
      // Update existing sheet
      console.log('Updating existing sheet:', currentSheetId);
      const result = await updateSheet(currentSheetId, characterSheet);
      if (!result) throw new Error('Failed to update sheet');
      console.log('Character sheet updated in database:', result);
      return { success: true, location: 'database', data: result };
    } else {
      // Create new sheet (belongs to the room)
      console.log('Creating new sheet for room:', currentRoomId);
      const result = await createSheet(currentRoomId, characterSheet);
      if (!result) throw new Error('Failed to create sheet');
      currentSheetId = result.id;
      localStorage.setItem('dordroller_sheet_id', currentSheetId);
      updateCharacterIdDisplay(); // Update the ID display
      // Don't await this - it's not critical for save success
      updateCharacterDropdown().catch(e => console.error('Dropdown update failed:', e));
      console.log('New character sheet created in database:', result);
      return { success: true, location: 'database', data: result };
    }
  } catch (error) {
    console.error('Database save error:', error);
    return { success: false, location: 'local', error: error.message };
  }
}

// ===== CHARACTER ID DISPLAY =====
function updateCharacterIdDisplay() {
  const idElement = document.getElementById('character-id-value');
  if (!idElement) return;
  
  if (currentSheetId) {
    idElement.textContent = `#${currentSheetId}`;
    idElement.classList.remove('not-saved');
  } else {
    idElement.textContent = 'Not saved';
    idElement.classList.add('not-saved');
  }
}

// Default character sheet structure
const defaultCharacterSheet = {
  name: '',
  class: '',
  level: 1,
  background: '',
  race: '',
  alignment: '',
  xp: 0,
  playerName: '',
  hp: 0,
  maxHp: 0,
  hitDice: '',
  ac: 0,
  speed: '',
  abilities: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  },
  manualMods: {
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0
  },
  savingThrows: {
    str: false,
    dex: false,
    con: false,
    int: false,
    wis: false,
    cha: false
  },
  skills: {
    acrobatics: { prof: false, exp: false },
    'animal-handling': { prof: false, exp: false },
    arcana: { prof: false, exp: false },
    athletics: { prof: false, exp: false },
    deception: { prof: false, exp: false },
    history: { prof: false, exp: false },
    insight: { prof: false, exp: false },
    intimidation: { prof: false, exp: false },
    investigation: { prof: false, exp: false },
    medicine: { prof: false, exp: false },
    nature: { prof: false, exp: false },
    perception: { prof: false, exp: false },
    performance: { prof: false, exp: false },
    persuasion: { prof: false, exp: false },
    religion: { prof: false, exp: false },
    'sleight-of-hand': { prof: false, exp: false },
    stealth: { prof: false, exp: false },
    survival: { prof: false, exp: false }
  },
  armor: {
    name: '',
    ac: 0
  },
  weapons: [
    { name: '', damage: '', properties: '', ability: 'str', bonus: 0 },
    { name: '', damage: '', properties: '', ability: 'str', bonus: 0 },
    { name: '', damage: '', properties: '', ability: 'str', bonus: 0 }
  ],
  equipment: '',
  features: '',
  spells: '',
  spellcastingClass: '',
  spellcastingAbility: '',
  spellSaveDC: 0,
  spellAttackBonus: 0,
  cantrips: ['', '', '', '', '', '', '', ''],
  preparedSpells: {
    1: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    2: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    3: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    4: ['', '', '', '', '', '', ''],
    5: ['', '', '', '', '', '', ''],
    6: ['', '', '', '', ''],
    7: ['', '', '', '', ''],
    8: ['', '', '', ''],
    9: ['', '', '']
  },
  spellSlots: [
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 }
  ]
};

// Load character sheet from localStorage or use defaults
let characterSheet;
try {
  const saved = localStorage.getItem('dordroller_character');
  if (saved) {
    characterSheet = { ...defaultCharacterSheet, ...JSON.parse(saved) };
    console.log('Loaded character from localStorage:', characterSheet.name);
  } else {
    characterSheet = { ...defaultCharacterSheet };
  }
} catch (e) {
  console.error('Failed to load character from localStorage:', e);
  characterSheet = { ...defaultCharacterSheet };
}

// Populate form fields from characterSheet object
function populateFormFromCharacterSheet() {
  try {
    // Helper to safely set input value
    const setInputValue = (id, value, fallback = '') => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? fallback;
    };
    
    // Helper to safely set checkbox
    const setCheckbox = (id, checked) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked ?? false;
    };
    
    // Basic info
    setInputValue('char-name', characterSheet.name, '');
    setInputValue('char-class', characterSheet.class, '');
    setInputValue('char-level', characterSheet.level, 1);
    setInputValue('char-background', characterSheet.background, '');
    setInputValue('char-race', characterSheet.race, '');
    setInputValue('char-alignment', characterSheet.alignment, '');
    setInputValue('char-xp', characterSheet.xp, 0);
    setInputValue('char-player-name', characterSheet.playerName, '');
    
    // HP and combat stats
    setInputValue('char-hp', characterSheet.hp, 0);
    setInputValue('char-max-hp', characterSheet.maxHp, 0);
    setInputValue('char-hit-dice', characterSheet.hitDice, '');
    setInputValue('char-ac', characterSheet.ac, 10);
    setInputValue('char-speed', characterSheet.speed, '');
    
    // Abilities
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    abilities.forEach(ability => {
      setInputValue(`${ability}-score`, characterSheet.abilities?.[ability], 10);
      setInputValue(`${ability}-manual-mod`, characterSheet.manualMods?.[ability], 0);
    });
    
    // Saving throw proficiencies
    abilities.forEach(ability => {
      setCheckbox(`${ability}-save-prof`, characterSheet.savingThrows?.[ability]);
    });
    
    // Skills
    const skillNames = ['acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 
                        'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
                        'performance', 'persuasion', 'religion', 'sleight-of-hand', 'stealth', 'survival'];
    skillNames.forEach(skill => {
      setCheckbox(`${skill}-prof`, characterSheet.skills?.[skill]?.prof);
      setCheckbox(`${skill}-exp`, characterSheet.skills?.[skill]?.expertise);
    });
    
    // Weapons
    if (characterSheet.weapons) {
      for (let i = 0; i < characterSheet.weapons.length && i < 3; i++) {
        const weapon = characterSheet.weapons[i] || {};
        setInputValue(`weapon-${i + 1}-name`, weapon.name, '');
        setInputValue(`weapon-${i + 1}-damage`, weapon.damage, '');
        setInputValue(`weapon-${i + 1}-properties`, weapon.properties, '');
        setInputValue(`weapon-${i + 1}-ability`, weapon.ability, 'str');
        setInputValue(`weapon-${i + 1}-bonus`, weapon.bonus, 0);
      }
    }
    
    // Equipment and features
    setInputValue('char-equipment', characterSheet.equipment, '');
    setInputValue('char-features', characterSheet.features, '');
    setInputValue('char-spells', characterSheet.spells, '');
    
    // Spellcasting
    setInputValue('spellcasting-ability', characterSheet.spellcastingAbility, '');
    setInputValue('spell-save-dc', characterSheet.spellSaveDC, 0);
    setInputValue('spell-attack-bonus', characterSheet.spellAttackBonus, 0);
    
    // Spell slots
    if (characterSheet.spellSlots) {
      for (let i = 0; i < characterSheet.spellSlots.length; i++) {
        const slot = characterSheet.spellSlots[i] || {};
        setInputValue(`spell-slot-${i + 1}-total`, slot.total, 0);
        setInputValue(`spell-slot-${i + 1}-expended`, slot.expended, 0);
      }
    }
    
    console.log('Form populated from character sheet');
  } catch (e) {
    console.error('Error populating form from character sheet:', e);
  }
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

// Join room
document.getElementById('join-btn').addEventListener('click', () => {
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  const name = document.getElementById('player-name').value.trim();

  if (roomCode && name) {
    playerName = name;
    currentRoom = roomCode;
    // Join directly via socket - no HTTP validation needed
    // Include playerId if logged in so the player is persisted to the room
    socket.emit('player_join_room', { 
      roomCode, 
      playerName: name,
      playerId: currentUser?.id || null
    });
  } else {
    alert('Please enter both room code and your name!');
  }
});

// Note: room_joined handler is at the end of the file with sync logic

// Character Sheet Functions
function getProficiencyBonus(level) {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

function loadCharacterSheet() {
  // Helper to safely set input value
  const setVal = (id, value, fallback = '') => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? fallback;
  };
  
  // Helper to safely set checkbox
  const setCheck = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked ?? false;
  };

  setVal('char-name', characterSheet.name);
  setVal('char-class', characterSheet.class);
  setVal('char-level', characterSheet.level, 1);
  setVal('char-background', characterSheet.background);
  setVal('char-race', characterSheet.race);
  setVal('char-alignment', characterSheet.alignment);
  setVal('char-xp', characterSheet.xp, 0);
  setVal('char-player-name', characterSheet.playerName);
  setVal('char-hp', characterSheet.hp, 0);
  setVal('char-max-hp', characterSheet.maxHp, 0);
  setVal('char-hit-dice', characterSheet.hitDice);
  setVal('char-ac', characterSheet.ac, 10);
  setVal('char-speed', characterSheet.speed);
  setVal('str-score', characterSheet.abilities?.str, 10);
  setVal('dex-score', characterSheet.abilities?.dex, 10);
  setVal('con-score', characterSheet.abilities?.con, 10);
  setVal('int-score', characterSheet.abilities?.int, 10);
  setVal('wis-score', characterSheet.abilities?.wis, 10);
  setVal('cha-score', characterSheet.abilities?.cha, 10);
  setVal('str-manual-mod', characterSheet.manualMods?.str, 0);
  setVal('dex-manual-mod', characterSheet.manualMods?.dex, 0);
  setVal('con-manual-mod', characterSheet.manualMods?.con, 0);
  setVal('int-manual-mod', characterSheet.manualMods?.int, 0);
  setVal('wis-manual-mod', characterSheet.manualMods?.wis, 0);
  setVal('cha-manual-mod', characterSheet.manualMods?.cha, 0);

  // Saving throws
  if (characterSheet.savingThrows) {
    Object.keys(characterSheet.savingThrows).forEach(ability => {
      setCheck(`${ability}-save-prof`, characterSheet.savingThrows[ability]);
    });
  }

  // Skills
  if (characterSheet.skills) {
    Object.keys(characterSheet.skills).forEach(skill => {
      const id = skill.replace('-', '-');
      setCheck(`${id}-prof`, characterSheet.skills[skill]?.prof);
      setCheck(`${id}-exp`, characterSheet.skills[skill]?.exp);
    });
  }

  // Armor
  if (characterSheet.armor) {
    setVal('char-armor-name', characterSheet.armor.name);
    setVal('char-armor-ac', characterSheet.armor.ac, 0);
  }

  // Weapons
  if (characterSheet.weapons) {
    characterSheet.weapons.forEach((weapon, index) => {
      setVal(`weapon-${index + 1}-name`, weapon.name);
      setVal(`weapon-${index + 1}-damage`, weapon.damage);
      setVal(`weapon-${index + 1}-properties`, weapon.properties);
      setVal(`weapon-${index + 1}-ability`, weapon.ability, 'str');
    });
  }

  // Equipment
  setVal('char-equipment', characterSheet.equipment);

  // Features
  setVal('char-features', characterSheet.features);

  // Spells
  setVal('char-spells', characterSheet.spells);

  // Spellcasting Class
  setVal('spellcasting-class', characterSheet.spellcastingClass);

  // Cantrips
  if (characterSheet.cantrips) {
    characterSheet.cantrips.forEach((cantrip, index) => {
      setVal(`cantrip-${index + 1}`, cantrip);
    });
  }

  // Prepared Spells
  if (characterSheet.preparedSpells) {
    Object.keys(characterSheet.preparedSpells).forEach(level => {
      characterSheet.preparedSpells[level].forEach((spell, index) => {
        setVal(`spell-${level}-${index + 1}`, spell);
      });
    });
  }

  // Spellcasting
  setVal('spellcasting-ability', characterSheet.spellcastingAbility);
  setVal('spell-save-dc', characterSheet.spellSaveDC, 0);
  setVal('spell-attack-bonus', characterSheet.spellAttackBonus, 0);

  // Spell Slots
  if (characterSheet.spellSlots) {
    characterSheet.spellSlots.forEach((slot, index) => {
      setVal(`spell-slot-${index + 1}-total`, slot?.total, 0);
      setVal(`spell-slot-${index + 1}-expended`, slot?.expended, 0);
    });
  }

  updateAllCalculations();
}

function updateAllCalculations() {
  updateAbilities();
  updateSavingThrows();
  updateSkills();
  updateInitiative();
  updateProfBonus();
  updateSpellcastingAbility();
  updateSpellSlotDisplays();
  updateHpBar();
}

// Update HP progress bar and slider
function updateHpBar() {
  const currentHp = parseInt(document.getElementById('char-hp').value) || 0;
  const maxHp = parseInt(document.getElementById('char-max-hp').value) || 1;
  
  const hpBar = document.getElementById('hp-bar');
  const hpSlider = document.getElementById('hp-slider');
  const hpDisplay = document.getElementById('hp-display');
  
  if (hpBar) {
    hpBar.max = maxHp;
    hpBar.value = currentHp;
  }
  
  if (hpSlider) {
    hpSlider.max = maxHp;
    hpSlider.value = currentHp;
  }
  
  if (hpDisplay) {
    hpDisplay.textContent = `${currentHp} / ${maxHp}`;
  }
}

function updateSavingThrows() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilities.forEach(ability => {
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const baseMod = mod + manual;
    const prof = document.getElementById(`${ability}-save-prof`).checked;
    const total = baseMod + (prof ? profBonus : 0);
    document.getElementById(`${ability}-save-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateSkills() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  const skillMap = {
    acrobatics: 'dex',
    'animal-handling': 'wis',
    arcana: 'int',
    athletics: 'str',
    deception: 'cha',
    history: 'int',
    insight: 'wis',
    intimidation: 'cha',
    investigation: 'int',
    medicine: 'wis',
    nature: 'int',
    perception: 'wis',
    performance: 'cha',
    persuasion: 'cha',
    religion: 'int',
    'sleight-of-hand': 'dex',
    stealth: 'dex',
    survival: 'wis'
  };
  Object.keys(skillMap).forEach(skill => {
    const ability = skillMap[skill];
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const baseMod = mod + manual;
    const prof = document.getElementById(`${skill.replace('-', '-')}-prof`).checked;
    const exp = document.getElementById(`${skill.replace('-', '-')}-exp`).checked;
    const bonus = (prof ? profBonus : 0) + (exp ? profBonus : 0);
    const total = baseMod + bonus;
    document.getElementById(`${skill.replace('-', '-')}-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateInitiative() {
  const dexScore = parseInt(document.getElementById('dex-score').value) || 10;
  const dexMod = Math.floor((dexScore - 10) / 2);
  const manual = parseInt(document.getElementById('dex-manual-mod').value) || 0;
  const total = dexMod + manual;
  document.getElementById('char-initiative').textContent = total >= 0 ? `+${total}` : total;
}

function updateProfBonus() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const bonus = getProficiencyBonus(level);
  document.getElementById('prof-bonus').textContent = `+${bonus}`;
}

function updateAbilities() {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilities.forEach(ability => {
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    document.getElementById(`${ability}-mod-calc`).textContent = mod >= 0 ? `+${mod}` : mod;
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const total = mod + manual;
    document.getElementById(`${ability}-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateSpellcastingAbility() {
  const ability = document.getElementById('spellcasting-ability').value;
  const display = ability ? ability.charAt(0).toUpperCase() + ability.slice(1) : 'None';
  document.getElementById('spellcasting-ability-display').textContent = display;
}

function updateSpellSlotDisplays() {
  for (let i = 1; i <= 9; i++) {
    const total = parseInt(document.getElementById(`spell-slot-${i}-total`).value) || 0;
    document.getElementById(`spell-slot-${i}-display`).textContent = total;
  }
}

function validateCharacterSheet() {
  const hp = parseInt(document.getElementById('char-hp').value);
  const maxHp = parseInt(document.getElementById('char-max-hp').value);
  if (hp < 0) {
    alert('HP cannot be negative');
    return false;
  }
  if (hp > maxHp) {
    alert('Current HP cannot exceed Max HP');
    return false;
  }
  return true;
}

// Form submit - uses the same save logic as Save & Sync
document.getElementById('char-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateCharacterSheet()) return;

  // Use the null-safe saveCharacterSheet function to update characterSheet object
  saveCharacterSheet();
  
  // Save to database with confirmation
  const saveBtn = document.querySelector('#char-form button[type="submit"]');
  if (saveBtn) {
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
      // Add timeout to prevent infinite spinner
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save timed out')), 10000)
      );
      
      const result = await Promise.race([saveToDatabase(), timeoutPromise]);
      
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
      
      if (result.success) {
        if (result.location === 'database') {
          showSaveToast('Character saved to server! ✓', 'success');
        } else {
          showSaveToast('Character saved locally (not connected to server)', 'info');
        }
        // Sync to GM if in a room
        if (currentRoom) {
          syncPlayerSummary();
        }
      } else {
        showSaveToast('Save failed - saved locally as backup', 'error');
      }
    } catch (error) {
      console.error('Save error or timeout:', error);
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
      showSaveToast('Save timed out - saved locally as backup', 'error');
    }
  }
});

// Save character sheet to localStorage
function saveCharacterSheet() {
  // Helper to safely get input value
  const getVal = (id, fallback = '') => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };
  
  // Helper to safely get checkbox state
  const getChecked = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };
  
  // Helper to safely get numeric value
  const getNum = (id, fallback = 0) => {
    const el = document.getElementById(id);
    return el ? (parseInt(el.value) || fallback) : fallback;
  };

  // First update the characterSheet object from the form
  characterSheet.name = getVal('char-name');
  characterSheet.class = getVal('char-class');
  characterSheet.level = getNum('char-level', 1);
  characterSheet.background = getVal('char-background');
  characterSheet.race = getVal('char-race');
  characterSheet.alignment = getVal('char-alignment');
  characterSheet.xp = getNum('char-xp', 0);
  characterSheet.playerName = getVal('char-player-name');
  characterSheet.hp = getNum('char-hp', 0);
  characterSheet.maxHp = getNum('char-max-hp', 0);
  characterSheet.hitDice = getVal('char-hit-dice');
  characterSheet.ac = getNum('char-ac', 10);
  characterSheet.speed = getVal('char-speed');
  
  // Abilities
  characterSheet.abilities = {
    str: getNum('str-score', 10),
    dex: getNum('dex-score', 10),
    con: getNum('con-score', 10),
    int: getNum('int-score', 10),
    wis: getNum('wis-score', 10),
    cha: getNum('cha-score', 10)
  };
  
  // Manual mods
  characterSheet.manualMods = {
    str: getNum('str-manual-mod', 0),
    dex: getNum('dex-manual-mod', 0),
    con: getNum('con-manual-mod', 0),
    int: getNum('int-manual-mod', 0),
    wis: getNum('wis-manual-mod', 0),
    cha: getNum('cha-manual-mod', 0)
  };
  
  // Saving throws proficiencies
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilities.forEach(ability => {
    characterSheet.savingThrows[ability] = getChecked(`${ability}-save-prof`);
  });
  
  // Skills
  const skillNames = ['acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception', 'history', 
                      'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
                      'performance', 'persuasion', 'religion', 'sleight-of-hand', 'stealth', 'survival'];
  skillNames.forEach(skill => {
    characterSheet.skills[skill] = {
      prof: getChecked(`${skill}-prof`),
      expertise: getChecked(`${skill}-exp`)
    };
  });
  
  // Weapons
  characterSheet.weapons = [];
  for (let i = 1; i <= 3; i++) {
    characterSheet.weapons.push({
      name: getVal(`weapon-${i}-name`),
      damage: getVal(`weapon-${i}-damage`),
      properties: getVal(`weapon-${i}-properties`),
      ability: getVal(`weapon-${i}-ability`, 'str'),
      bonus: getNum(`weapon-${i}-bonus`, 0)
    });
  }
  
  // Equipment and features
  characterSheet.equipment = getVal('char-equipment');
  characterSheet.features = getVal('char-features');
  characterSheet.spells = getVal('char-spells');
  
  // Spellcasting
  characterSheet.spellcastingAbility = getVal('spellcasting-ability');
  characterSheet.spellSaveDC = getNum('spell-save-dc', 0);
  characterSheet.spellAttackBonus = getNum('spell-attack-bonus', 0);
  
  // Save to localStorage
  try {
    localStorage.setItem('dordroller_character', JSON.stringify(characterSheet));
    console.log('Character sheet saved to localStorage');
  } catch (e) {
    console.error('Failed to save character sheet:', e);
  }
}

// Update calculations on changes
document.querySelectorAll('input[id="char-level"]').forEach(input => {
  input.addEventListener('input', updateAllCalculations);
});

document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', updateAllCalculations);
});

document.querySelectorAll('input[id$="-score"], input[id$="-manual-mod"]').forEach(input => {
  input.addEventListener('input', updateAllCalculations);
});

document.querySelectorAll('input[id^="spell-slot-"][id$="-total"]').forEach(input => {
  input.addEventListener('input', updateSpellSlotDisplays);
});

document.getElementById('spellcasting-ability').addEventListener('change', updateSpellcastingAbility);

// HP slider and input synchronization with live sync to GM
document.getElementById('char-hp').addEventListener('input', () => {
  updateHpBar();
  debouncedSync();
});
document.getElementById('char-max-hp').addEventListener('input', () => {
  updateHpBar();
  debouncedSync();
});
document.getElementById('hp-slider').addEventListener('input', (e) => {
  const value = parseInt(e.target.value) || 0;
  document.getElementById('char-hp').value = value;
  updateHpBar();
  debouncedSync();
});

// AC change triggers live sync
document.getElementById('char-ac').addEventListener('input', debouncedSync);

// Debounced sync to avoid flooding the server
let syncTimeout = null;
function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncPlayerSummary();
  }, 300); // Wait 300ms after last change before syncing
}

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab + '-tab').classList.add('active');
  });
});

// Combat tab switching
document.querySelectorAll('.combat-tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.combat-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.combat-tab-pane').forEach(pane => pane.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab + '-tab').classList.add('active');
  });
});

// ===== PLAYER DICE ROLLER (Phase 1: Quick Roll Buttons) =====

const abilityNames = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

const skillNames = {
  'acrobatics': 'Acrobatics',
  'animal-handling': 'Animal Handling',
  'arcana': 'Arcana',
  'athletics': 'Athletics',
  'deception': 'Deception',
  'history': 'History',
  'insight': 'Insight',
  'intimidation': 'Intimidation',
  'investigation': 'Investigation',
  'medicine': 'Medicine',
  'nature': 'Nature',
  'perception': 'Perception',
  'performance': 'Performance',
  'persuasion': 'Persuasion',
  'religion': 'Religion',
  'sleight-of-hand': 'Sleight of Hand',
  'stealth': 'Stealth',
  'survival': 'Survival'
};

// Simple d20 roll
function rollD20Single() {
  return Math.floor(Math.random() * 20) + 1;
}

// Roll d20 with advantage/disadvantage support
// Returns { result: number, rolls: number[], mode: string }
function rollD20WithMode() {
  const mode = currentRollMode;
  
  if (mode === 'normal') {
    const roll = rollD20Single();
    return { result: roll, rolls: [roll], mode: 'normal' };
  }
  
  // Roll 2d20 for advantage or disadvantage
  const roll1 = rollD20Single();
  const roll2 = rollD20Single();
  
  if (mode === 'advantage') {
    return { result: Math.max(roll1, roll2), rolls: [roll1, roll2], mode: 'advantage' };
  } else {
    return { result: Math.min(roll1, roll2), rolls: [roll1, roll2], mode: 'disadvantage' };
  }
}

// Legacy function for compatibility
function rollD20() {
  return rollD20WithMode().result;
}

function getModifierFromElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return 0;
  const text = element.textContent;
  return parseInt(text) || 0;
}

function handleQuickRoll(rollType, key) {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }

  let modifier = 0;
  let label = '';
  let characterName = document.getElementById('char-name').value || 'Unknown';

  if (rollType === 'ability') {
    modifier = getModifierFromElement(`${key}-total`);
    label = `${abilityNames[key]} Check`;
  } else if (rollType === 'save') {
    modifier = getModifierFromElement(`${key}-save-total`);
    label = `${abilityNames[key]} Save`;
  } else if (rollType === 'skill') {
    modifier = getModifierFromElement(`${key}-total`);
    label = `${skillNames[key]} Check`;
  }

  const rollResult = rollD20WithMode();
  const total = rollResult.result + modifier;

  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: rollResult.rolls.length,
    result: total,
    label: `${characterName}: ${label}`,
    modifier: modifier,
    rawResult: rollResult.result,
    individualRolls: rollResult.rolls,
    rollType: rollType,
    rollMode: rollResult.mode,
    timestamp: Date.now()
  };

  // Emit the roll to the server
  socket.emit('player_roll', rollData);
  console.log('Player roll sent:', rollData);

  // Show feedback to the player
  showRollFeedback(rollResult, modifier, total, label);
}

function showRollFeedback(rollResult, modifier, total, label) {
  const toast = document.getElementById('roll-toast');
  const modSign = modifier >= 0 ? '+' : '';
  
  // Handle both old format (number) and new format (object)
  const isAdvDisadv = typeof rollResult === 'object' && rollResult.mode !== 'normal';
  const usedRoll = typeof rollResult === 'object' ? rollResult.result : rollResult;
  const rolls = typeof rollResult === 'object' ? rollResult.rolls : [rollResult];
  const mode = typeof rollResult === 'object' ? rollResult.mode : 'normal';
  
  // Remove any existing classes
  toast.classList.remove('show', 'nat-20', 'nat-1', 'advantage', 'disadvantage');
  
  // Add nat 20/1 class if applicable (based on the used roll)
  if (usedRoll === 20) toast.classList.add('nat-20');
  else if (usedRoll === 1) toast.classList.add('nat-1');
  
  // Add advantage/disadvantage class
  if (mode === 'advantage') toast.classList.add('advantage');
  else if (mode === 'disadvantage') toast.classList.add('disadvantage');
  
  // Build the dice display
  let diceDisplay;
  if (isAdvDisadv) {
    const [roll1, roll2] = rolls;
    const usedIndex = mode === 'advantage' ? (roll1 >= roll2 ? 0 : 1) : (roll1 <= roll2 ? 0 : 1);
    const modeIcon = mode === 'advantage' ? 'fa-arrow-up' : 'fa-arrow-down';
    const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
    
    diceDisplay = `
      <span class="roll-toast-dice adv-disadv-roll">
        <span class="roll-mode-indicator ${mode}">
          <i class="fa-solid ${modeIcon}"></i> ${modeLabel}
        </span>
        <span class="roll-pair">
          <span class="roll-value ${usedIndex === 0 ? 'used' : 'dropped'}">${roll1}</span>
          <span class="roll-separator">/</span>
          <span class="roll-value ${usedIndex === 1 ? 'used' : 'dropped'}">${roll2}</span>
        </span>
      </span>
    `;
  } else {
    diceDisplay = `
      <span class="roll-toast-dice">
        <i class="fa-solid fa-dice-d20"></i>
        <span class="roll-value">${usedRoll}</span>
      </span>
    `;
  }
  
  toast.innerHTML = `
    <button class="roll-toast-close" onclick="closeRollToast()">&times;</button>
    <div class="roll-toast-content">
      <div class="roll-toast-header">${label}</div>
      <div class="roll-toast-body">
        ${diceDisplay}
        <span class="roll-toast-modifier">${modSign}${modifier}</span>
        <span>=</span>
        <span class="roll-toast-total">${total}</span>
      </div>
    </div>
  `;
  
  // Trigger reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');
  
  // Auto-hide after 5 seconds
  clearTimeout(window.rollToastTimeout);
  window.rollToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// Global function to close toast
window.closeRollToast = function() {
  const toast = document.getElementById('roll-toast');
  toast.classList.remove('show');
  clearTimeout(window.rollToastTimeout);
};

// Death save specific feedback
function showDeathSaveFeedback(rollResult, outcome, outcomeType) {
  const toast = document.getElementById('roll-toast');
  const roll = rollResult.result;
  const rolls = rollResult.rolls;
  const mode = rollResult.mode;
  const isAdvDisadv = mode !== 'normal';
  
  // Remove any existing classes
  toast.classList.remove('show', 'nat-20', 'nat-1', 'advantage', 'disadvantage');
  
  // Add outcome class
  if (outcomeType === 'crit') toast.classList.add('nat-20');
  else if (outcomeType === 'critfail') toast.classList.add('nat-1');
  
  // Add advantage/disadvantage class
  if (mode === 'advantage') toast.classList.add('advantage');
  else if (mode === 'disadvantage') toast.classList.add('disadvantage');
  
  // Build the dice display
  let diceDisplay;
  if (isAdvDisadv) {
    const [roll1, roll2] = rolls;
    const usedIndex = mode === 'advantage' ? (roll1 >= roll2 ? 0 : 1) : (roll1 <= roll2 ? 0 : 1);
    const modeIcon = mode === 'advantage' ? 'fa-arrow-up' : 'fa-arrow-down';
    const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
    
    diceDisplay = `
      <span class="roll-toast-dice adv-disadv-roll">
        <span class="roll-mode-indicator ${mode}">
          <i class="fa-solid ${modeIcon}"></i> ${modeLabel}
        </span>
        <span class="roll-pair">
          <span class="roll-value ${usedIndex === 0 ? 'used' : 'dropped'}">${roll1}</span>
          <span class="roll-separator">/</span>
          <span class="roll-value ${usedIndex === 1 ? 'used' : 'dropped'}">${roll2}</span>
        </span>
      </span>
    `;
  } else {
    diceDisplay = `
      <span class="roll-toast-dice">
        <i class="fa-solid fa-dice-d20"></i>
        <span class="roll-value">${roll}</span>
      </span>
    `;
  }
  
  toast.innerHTML = `
    <button class="roll-toast-close" onclick="closeRollToast()">&times;</button>
    <div class="roll-toast-content">
      <div class="roll-toast-header">Death Save</div>
      <div class="roll-toast-body">
        ${diceDisplay}
        <span class="roll-toast-total">${outcome}</span>
      </div>
    </div>
  `;
  
  // Trigger reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');
  
  // Auto-hide after 5 seconds
  clearTimeout(window.rollToastTimeout);
  window.rollToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// Attach event listeners to ability/save/skill roll buttons ONLY (not attack/damage/combat buttons)
document.querySelectorAll('.roll-btn[data-roll-type="ability"], .roll-btn[data-roll-type="save"], .roll-btn[data-roll-type="skill"]').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const rollType = button.dataset.rollType;
    const key = button.dataset.ability || button.dataset.skill;
    handleQuickRoll(rollType, key);
  });
});

// ===== COMBAT DICE ROLLER (Phase 2: Attack, Damage, Initiative, Spell Attack) =====

// Roll any dice
function rollDice(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Roll multiple dice
function rollMultipleDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDice(sides));
  }
  return rolls;
}

// Parse dice notation (e.g., "2d6+3", "1d8", "4d6+2")
function parseDiceNotation(notation) {
  if (!notation) return null;
  
  // Clean the notation
  const clean = notation.toLowerCase().replace(/\s/g, '');
  
  // Match patterns like 2d6+3, 1d8, 2d6-1, etc.
  const match = clean.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
  
  if (!match) return null;
  
  return {
    count: parseInt(match[1]) || 1,
    sides: parseInt(match[2]),
    modifier: parseInt(match[3]) || 0
  };
}

// Get attack modifier for a weapon (includes magic bonus)
function getWeaponAttackModifier(weaponIndex) {
  const abilitySelect = document.getElementById(`weapon-${weaponIndex}-ability`);
  const ability = abilitySelect ? abilitySelect.value : 'str';
  const abilityMod = getModifierFromElement(`${ability}-total`);
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  const magicBonus = parseInt(document.getElementById(`weapon-${weaponIndex}-bonus`)?.value) || 0;
  
  return abilityMod + profBonus + magicBonus;
}

// Handle initiative roll
function handleInitiativeRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const modifier = getModifierFromElement('char-initiative');
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const rollResult = rollD20WithMode();
  const total = rollResult.result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: rollResult.rolls.length,
    result: total,
    label: `${characterName}: Initiative`,
    modifier: modifier,
    rawResult: rollResult.result,
    individualRolls: rollResult.rolls,
    rollType: 'initiative',
    rollMode: rollResult.mode,
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(rollResult, modifier, total, 'Initiative');
}

// Handle spell attack roll
function handleSpellAttackRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const modifier = parseInt(document.getElementById('spell-attack-bonus').value) || 0;
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const rollResult = rollD20WithMode();
  const total = rollResult.result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: rollResult.rolls.length,
    result: total,
    label: `${characterName}: Spell Attack`,
    modifier: modifier,
    rawResult: rollResult.result,
    individualRolls: rollResult.rolls,
    rollType: 'spell-attack',
    rollMode: rollResult.mode,
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(rollResult, modifier, total, 'Spell Attack');
}

// Handle weapon attack roll
function handleWeaponAttackRoll(weaponIndex) {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const weaponName = document.getElementById(`weapon-${weaponIndex}-name`).value || `Weapon ${weaponIndex}`;
  const modifier = getWeaponAttackModifier(weaponIndex);
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const rollResult = rollD20WithMode();
  const total = rollResult.result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: rollResult.rolls.length,
    result: total,
    label: `${characterName}: ${weaponName} Attack`,
    modifier: modifier,
    rawResult: rollResult.result,
    individualRolls: rollResult.rolls,
    rollType: 'weapon-attack',
    rollMode: rollResult.mode,
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(rollResult, modifier, total, `${weaponName} Attack`);
}

// ===== DAMAGE MODAL =====
let currentDamageContext = {
  weaponIndex: null,
  weaponName: '',
  isSpell: false,
  abilityMod: 0,
  abilityName: 'STR'
};

// Get the ability modifier for weapon damage
function getWeaponDamageModifier(weaponIndex) {
  const abilitySelect = document.getElementById(`weapon-${weaponIndex}-ability`);
  const ability = abilitySelect ? abilitySelect.value : 'str';
  const abilityMod = getModifierFromElement(`${ability}-total`);
  return {
    modifier: abilityMod,
    abilityName: ability.toUpperCase()
  };
}

function openDamageModal(weaponIndex = null, isSpell = false) {
  const modal = document.getElementById('damage-modal');
  const title = document.getElementById('damage-modal-title');
  
  currentDamageContext.weaponIndex = weaponIndex;
  currentDamageContext.isSpell = isSpell;
  
  if (isSpell) {
    title.textContent = 'Roll Spell Damage';
    currentDamageContext.weaponName = 'Spell';
    currentDamageContext.abilityMod = 0;
    currentDamageContext.abilityName = 'N/A';
    
    // Hide ability mod section for spells (spells don't add ability mod to damage by default)
    document.querySelector('.ability-mod-section').style.display = 'none';
    
    // Parse spell damage dice
    const spellDamage = document.getElementById('spell-damage-dice').value;
    const parsed = parseDiceNotation(spellDamage);
    
    if (parsed) {
      document.getElementById('damage-dice-count').value = parsed.count;
      document.getElementById('damage-dice-type').value = parsed.sides;
      document.getElementById('damage-bonus').value = parsed.modifier || 0;
    } else {
      // Default spell damage
      document.getElementById('damage-dice-count').value = 1;
      document.getElementById('damage-dice-type').value = 6;
      document.getElementById('damage-bonus').value = 0;
    }
  } else {
    const weaponName = document.getElementById(`weapon-${weaponIndex}-name`).value || `Weapon ${weaponIndex}`;
    title.textContent = `Roll ${weaponName} Damage`;
    currentDamageContext.weaponName = weaponName;
    
    // Get ability modifier for this weapon
    const abilityInfo = getWeaponDamageModifier(weaponIndex);
    currentDamageContext.abilityMod = abilityInfo.modifier;
    currentDamageContext.abilityName = abilityInfo.abilityName;
    
    // Show ability mod section and update display
    document.querySelector('.ability-mod-section').style.display = 'block';
    document.getElementById('damage-ability-name').textContent = abilityInfo.abilityName;
    const modSign = abilityInfo.modifier >= 0 ? '+' : '';
    document.getElementById('damage-ability-mod').textContent = `${modSign}${abilityInfo.modifier}`;
    
    // Parse weapon damage (just the dice, not the modifier - that comes from ability)
    const weaponDamage = document.getElementById(`weapon-${weaponIndex}-damage`).value;
    const parsed = parseDiceNotation(weaponDamage);
    
    if (parsed) {
      document.getElementById('damage-dice-count').value = parsed.count;
      document.getElementById('damage-dice-type').value = parsed.sides;
      // Any modifier in the damage field goes to bonus (e.g., magic weapon +1)
      document.getElementById('damage-bonus').value = parsed.modifier || 0;
    } else {
      // Default weapon damage
      document.getElementById('damage-dice-count').value = 1;
      document.getElementById('damage-dice-type').value = 8;
      document.getElementById('damage-bonus').value = 0;
    }
  }
  
  // Reset extra dice and crit
  document.getElementById('extra-dice-count').value = 0;
  document.getElementById('damage-crit-toggle').checked = false;
  
  updateDamagePreview();
  modal.classList.add('show');
}

function closeDamageModal() {
  const modal = document.getElementById('damage-modal');
  modal.classList.remove('show');
}

function updateDamagePreview() {
  const baseCount = parseInt(document.getElementById('damage-dice-count').value) || 1;
  const baseSides = document.getElementById('damage-dice-type').value;
  const bonusMod = parseInt(document.getElementById('damage-bonus').value) || 0;
  const extraCount = parseInt(document.getElementById('extra-dice-count').value) || 0;
  const extraSides = document.getElementById('extra-dice-type').value;
  const isCrit = document.getElementById('damage-crit-toggle').checked;
  
  // Total modifier = ability mod + bonus
  const totalModifier = currentDamageContext.abilityMod + bonusMod;
  
  let preview = '';
  const critMultiplier = isCrit ? 2 : 1;
  const effectiveBaseCount = baseCount * critMultiplier;
  const effectiveExtraCount = extraCount * critMultiplier;
  
  preview += `${effectiveBaseCount}d${baseSides}`;
  
  if (effectiveExtraCount > 0) {
    preview += ` + ${effectiveExtraCount}d${extraSides}`;
  }
  
  if (totalModifier !== 0) {
    preview += totalModifier >= 0 ? ` + ${totalModifier}` : ` - ${Math.abs(totalModifier)}`;
  }
  
  if (isCrit) {
    preview += ' (CRIT!)';
  }
  
  document.getElementById('damage-preview-text').textContent = preview;
}

function executeDamageRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    closeDamageModal();
    return;
  }
  
  const baseCount = parseInt(document.getElementById('damage-dice-count').value) || 1;
  const baseSides = parseInt(document.getElementById('damage-dice-type').value);
  const bonusMod = parseInt(document.getElementById('damage-bonus').value) || 0;
  const extraCount = parseInt(document.getElementById('extra-dice-count').value) || 0;
  const extraSides = parseInt(document.getElementById('extra-dice-type').value);
  const isCrit = document.getElementById('damage-crit-toggle').checked;
  
  // Total modifier = ability mod + bonus
  const totalModifier = currentDamageContext.abilityMod + bonusMod;
  
  const critMultiplier = isCrit ? 2 : 1;
  const effectiveBaseCount = baseCount * critMultiplier;
  const effectiveExtraCount = extraCount * critMultiplier;
  
  // Roll base damage
  const baseRolls = rollMultipleDice(effectiveBaseCount, baseSides);
  const baseTotal = baseRolls.reduce((a, b) => a + b, 0);
  
  // Roll extra damage
  let extraRolls = [];
  let extraTotal = 0;
  if (effectiveExtraCount > 0) {
    extraRolls = rollMultipleDice(effectiveExtraCount, extraSides);
    extraTotal = extraRolls.reduce((a, b) => a + b, 0);
  }
  
  const total = baseTotal + extraTotal + totalModifier;
  const characterName = document.getElementById('char-name').value || 'Unknown';
  
  // Build description
  let diceDescription = `${effectiveBaseCount}d${baseSides}`;
  if (effectiveExtraCount > 0) {
    diceDescription += ` + ${effectiveExtraCount}d${extraSides}`;
  }
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'damage',
    quantity: effectiveBaseCount + effectiveExtraCount,
    result: total,
    label: `${characterName}: ${currentDamageContext.weaponName} Damage${isCrit ? ' (CRITICAL!)' : ''}`,
    modifier: totalModifier,
    abilityMod: currentDamageContext.abilityMod,
    abilityName: currentDamageContext.abilityName,
    bonusMod: bonusMod,
    rawResult: baseTotal + extraTotal,
    individualRolls: [...baseRolls, ...extraRolls],
    rollType: currentDamageContext.isSpell ? 'spell-damage' : 'weapon-damage',
    isCritical: isCrit,
    diceDescription: diceDescription,
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  
  // Show damage feedback
  showDamageFeedback(rollData);
  
  closeDamageModal();
}

function showDamageFeedback(rollData) {
  const toast = document.getElementById('roll-toast');
  
  // Remove any existing classes
  toast.classList.remove('show', 'nat-20', 'nat-1');
  
  // Add crit styling if applicable
  if (rollData.isCritical) {
    toast.classList.add('nat-20');
  }
  
  // Format the rolls display
  const rollsDisplay = rollData.individualRolls.map(r => r).join(' + ');
  const modSign = rollData.modifier >= 0 ? '+' : '';
  
  toast.innerHTML = `
    <button class="roll-toast-close" onclick="closeRollToast()">&times;</button>
    <div class="roll-toast-content">
      <div class="roll-toast-header">${rollData.label}</div>
      <div class="roll-toast-body damage-toast-body">
        <div class="damage-dice-display">
          <i class="fa-solid fa-burst"></i>
          <span class="damage-rolls">[${rollsDisplay}]</span>
        </div>
        <span class="roll-toast-modifier">${modSign}${rollData.modifier}</span>
        <span>=</span>
        <span class="roll-toast-total">${rollData.result}</span>
      </div>
      <div class="damage-dice-notation">${rollData.diceDescription}${rollData.modifier !== 0 ? (modSign + rollData.modifier) : ''}</div>
    </div>
  `;
  
  // Trigger reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');
  
  // Auto-hide after 6 seconds (longer for damage)
  clearTimeout(window.rollToastTimeout);
  window.rollToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

// Event Listeners for Combat Rolls
document.querySelectorAll('.combat-roll-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const rollType = button.dataset.rollType;
    
    if (rollType === 'initiative') {
      handleInitiativeRoll();
    } else if (rollType === 'spell-attack') {
      handleSpellAttackRoll();
    }
  });
});

document.querySelectorAll('.attack-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const weaponIndex = button.dataset.weapon;
    handleWeaponAttackRoll(weaponIndex);
  });
});

document.querySelectorAll('.damage-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const weaponIndex = button.dataset.weapon;
    const isSpellDamage = button.dataset.rollType === 'spell-damage';
    openDamageModal(weaponIndex, isSpellDamage);
  });
});

// Modal event listeners
document.getElementById('damage-modal-close').addEventListener('click', closeDamageModal);
document.getElementById('damage-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeDamageModal();
  }
});
document.getElementById('damage-roll-btn').addEventListener('click', executeDamageRoll);

// ===== ADVANTAGE/DISADVANTAGE TOGGLE =====
const rollModeDescriptions = {
  'normal': 'Rolling normally (1d20)',
  'advantage': 'Rolling with ADVANTAGE (2d20, take highest)',
  'disadvantage': 'Rolling with DISADVANTAGE (2d20, take lowest)'
};

document.querySelectorAll('.roll-mode-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Remove active class from all buttons
    document.querySelectorAll('.roll-mode-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    button.classList.add('active');
    
    // Update the roll mode
    currentRollMode = button.dataset.mode;
    
    // Update description text
    const description = document.getElementById('roll-mode-description');
    if (description) {
      description.textContent = rollModeDescriptions[currentRollMode];
    }
    
    console.log('Roll mode changed to:', currentRollMode);
  });
});

// Update preview when modal inputs change
['damage-dice-count', 'damage-dice-type', 'damage-bonus', 'extra-dice-count', 'extra-dice-type', 'damage-crit-toggle'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateDamagePreview);
  document.getElementById(id).addEventListener('change', updateDamagePreview);
});

// ===== DEATH SAVES TRACKER =====
const deathSaves = {
  successes: 0,
  failures: 0
};

function updateDeathSaveCheckboxes() {
  // Update success checkboxes
  for (let i = 1; i <= 3; i++) {
    const checkbox = document.getElementById(`death-success-${i}`);
    if (checkbox) {
      checkbox.checked = i <= deathSaves.successes;
    }
  }
  
  // Update failure checkboxes
  for (let i = 1; i <= 3; i++) {
    const checkbox = document.getElementById(`death-failure-${i}`);
    if (checkbox) {
      checkbox.checked = i <= deathSaves.failures;
    }
  }
  
  // Check for stabilize or death
  if (deathSaves.successes >= 3) {
    showRollFeedback('Stabilized! 💚', 'success');
  } else if (deathSaves.failures >= 3) {
    showRollFeedback('Character has died... 💀', 'failure');
  }
}

function addDeathSaveSuccess(count = 1) {
  deathSaves.successes = Math.min(3, deathSaves.successes + count);
  updateDeathSaveCheckboxes();
}

function addDeathSaveFailure(count = 1) {
  deathSaves.failures = Math.min(3, deathSaves.failures + count);
  updateDeathSaveCheckboxes();
}

function resetDeathSaves() {
  deathSaves.successes = 0;
  deathSaves.failures = 0;
  updateDeathSaveCheckboxes();
}

function rollDeathSave() {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const rollResult = rollD20WithMode();
  const roll = rollResult.result;
  const characterName = document.getElementById('char-name').value || 'Unknown';
  
  let outcome = '';
  let outcomeType = '';
  
  // Check for natural 20 (using first roll for nat 20/1 check in adv/disadv)
  const isNat20 = rollResult.rolls.includes(20) && (rollResult.mode === 'normal' || (rollResult.mode === 'advantage' && roll === 20));
  const isNat1 = rollResult.rolls.includes(1) && (rollResult.mode === 'normal' || (rollResult.mode === 'disadvantage' && roll === 1));
  
  if (isNat20) {
    // Natural 20: regain 1 HP, stabilize with 2 successes worth
    addDeathSaveSuccess(2);
    outcome = 'NAT 20! Regain 1 HP and stabilize! 🎉';
    outcomeType = 'crit';
  } else if (isNat1) {
    // Natural 1: 2 failures
    addDeathSaveFailure(2);
    outcome = 'NAT 1! Two death save failures! 💀';
    outcomeType = 'critfail';
  } else if (roll >= 10) {
    // Success
    addDeathSaveSuccess(1);
    outcome = `Success! (${deathSaves.successes}/3)`;
    outcomeType = 'success';
  } else {
    // Failure
    addDeathSaveFailure(1);
    outcome = `Failure! (${deathSaves.failures}/3)`;
    outcomeType = 'failure';
  }
  
  // Build roll description for feedback
  let rollDescription = `Death Save: ${roll}`;
  if (rollResult.mode !== 'normal') {
    rollDescription = `Death Save (${rollResult.mode}): [${rollResult.rolls.join(', ')}] → ${roll}`;
  }
  
  // Show feedback
  showDeathSaveFeedback(rollResult, outcome, outcomeType);
  
  // Emit to server (matching standard roll format for OBS)
  socket.emit('player_roll', {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: rollResult.rolls.length,
    result: roll,
    label: `${characterName}: Death Save - ${outcome}`,
    modifier: 0,
    rawResult: roll,
    individualRolls: rollResult.rolls,
    rollType: 'Death Save',
    rollMode: rollResult.mode,
    timestamp: Date.now()
  });
}

// Death save roll button listener
document.getElementById('roll-death-save')?.addEventListener('click', rollDeathSave);

// Reset death saves button listener
document.getElementById('reset-death-saves')?.addEventListener('click', resetDeathSaves);

// Manual checkbox clicks for death saves
document.querySelectorAll('.death-save-checkbox').forEach(checkbox => {
  checkbox.addEventListener('click', (e) => {
    const type = checkbox.dataset.type;
    const index = parseInt(checkbox.dataset.index);
    
    if (type === 'success') {
      // Clicking sets successes to that index if checked, or index-1 if unchecked
      deathSaves.successes = checkbox.checked ? index : index - 1;
    } else {
      deathSaves.failures = checkbox.checked ? index : index - 1;
    }
    
    updateDeathSaveCheckboxes();
  });
});

// ===== PLAYER SYNC FOR GM TRACKING =====

// Collect summary data for GM player list
function collectSummaryData() {
  return {
    characterName: document.getElementById('char-name')?.value || 'Unknown',
    ac: document.getElementById('char-ac')?.value || '—',
    currentHp: document.getElementById('char-hp')?.value || '—',
    maxHp: document.getElementById('char-max-hp')?.value || '—',
    level: document.getElementById('char-level')?.value || '—',
    race: document.getElementById('char-race')?.value || '—',
    class: document.getElementById('char-class')?.value || '—'
  };
}

// Collect full character sheet data for GM view
function collectFullSheetData() {
  const getValue = (id) => document.getElementById(id)?.value || '';
  const getText = (id) => document.getElementById(id)?.textContent || '';
  const getChecked = (id) => document.getElementById(id)?.checked || false;
  const getNumber = (id) => parseInt(document.getElementById(id)?.value) || 0;
  
  return {
    // Basic Info
    characterName: getValue('char-name'),
    playerName: playerName,
    race: getValue('char-race'),
    class: getValue('char-class'),
    level: getValue('char-level'),
    background: getValue('char-background'),
    
    // Ability Scores (use getText for calculated totals)
    abilities: {
      str: { score: getNumber('str-score'), modifier: getText('str-total') },
      dex: { score: getNumber('dex-score'), modifier: getText('dex-total') },
      con: { score: getNumber('con-score'), modifier: getText('con-total') },
      int: { score: getNumber('int-score'), modifier: getText('int-total') },
      wis: { score: getNumber('wis-score'), modifier: getText('wis-total') },
      cha: { score: getNumber('cha-score'), modifier: getText('cha-total') }
    },
    
    // Combat Stats (use correct IDs from HTML)
    combat: {
      ac: getValue('char-ac'),
      currentHp: getValue('char-hp'),
      maxHp: getValue('char-max-hp'),
      tempHp: '0', // No temp HP field in current HTML
      speed: getValue('char-speed'),
      initiative: getText('char-initiative'),
      proficiencyBonus: getText('prof-bonus'),
      hitDice: getValue('char-hit-dice')
    },
    
    // Saving Throws (use getText for calculated totals)
    savingThrows: {
      str: { total: getText('str-save-total'), proficient: getChecked('str-save-prof') },
      dex: { total: getText('dex-save-total'), proficient: getChecked('dex-save-prof') },
      con: { total: getText('con-save-total'), proficient: getChecked('con-save-prof') },
      int: { total: getText('int-save-total'), proficient: getChecked('int-save-prof') },
      wis: { total: getText('wis-save-total'), proficient: getChecked('wis-save-prof') },
      cha: { total: getText('cha-save-total'), proficient: getChecked('cha-save-prof') }
    },
    
    // Death Saves
    deathSaves: {
      successes: deathSaves.successes,
      failures: deathSaves.failures
    },
    
    // Skills (use getText for calculated totals, correct expertise ID suffix)
    skills: {
      acrobatics: { total: getText('acrobatics-total'), proficient: getChecked('acrobatics-prof'), expertise: getChecked('acrobatics-exp') },
      animalHandling: { total: getText('animal-handling-total'), proficient: getChecked('animal-handling-prof'), expertise: getChecked('animal-handling-exp') },
      arcana: { total: getText('arcana-total'), proficient: getChecked('arcana-prof'), expertise: getChecked('arcana-exp') },
      athletics: { total: getText('athletics-total'), proficient: getChecked('athletics-prof'), expertise: getChecked('athletics-exp') },
      deception: { total: getText('deception-total'), proficient: getChecked('deception-prof'), expertise: getChecked('deception-exp') },
      history: { total: getText('history-total'), proficient: getChecked('history-prof'), expertise: getChecked('history-exp') },
      insight: { total: getText('insight-total'), proficient: getChecked('insight-prof'), expertise: getChecked('insight-exp') },
      intimidation: { total: getText('intimidation-total'), proficient: getChecked('intimidation-prof'), expertise: getChecked('intimidation-exp') },
      investigation: { total: getText('investigation-total'), proficient: getChecked('investigation-prof'), expertise: getChecked('investigation-exp') },
      medicine: { total: getText('medicine-total'), proficient: getChecked('medicine-prof'), expertise: getChecked('medicine-exp') },
      nature: { total: getText('nature-total'), proficient: getChecked('nature-prof'), expertise: getChecked('nature-exp') },
      perception: { total: getText('perception-total'), proficient: getChecked('perception-prof'), expertise: getChecked('perception-exp') },
      performance: { total: getText('performance-total'), proficient: getChecked('performance-prof'), expertise: getChecked('performance-exp') },
      persuasion: { total: getText('persuasion-total'), proficient: getChecked('persuasion-prof'), expertise: getChecked('persuasion-exp') },
      religion: { total: getText('religion-total'), proficient: getChecked('religion-prof'), expertise: getChecked('religion-exp') },
      sleightOfHand: { total: getText('sleight-of-hand-total'), proficient: getChecked('sleight-of-hand-prof'), expertise: getChecked('sleight-of-hand-exp') },
      stealth: { total: getText('stealth-total'), proficient: getChecked('stealth-prof'), expertise: getChecked('stealth-exp') },
      survival: { total: getText('survival-total'), proficient: getChecked('survival-prof'), expertise: getChecked('survival-exp') }
    },
    
    // Weapons
    weapons: [
      { name: getValue('weapon-1-name'), damage: getValue('weapon-1-damage'), properties: getValue('weapon-1-properties') },
      { name: getValue('weapon-2-name'), damage: getValue('weapon-2-damage'), properties: getValue('weapon-2-properties') },
      { name: getValue('weapon-3-name'), damage: getValue('weapon-3-damage'), properties: getValue('weapon-3-properties') }
    ],
    
    // Spellcasting
    spellcasting: {
      attackBonus: getText('spell-attack-bonus'),
      saveDC: getText('spell-save-dc')
    }
  };
}

// Send summary sync to server (called every 30 seconds or on save)
function syncPlayerSummary() {
  if (!currentRoom) return;
  
  const summary = collectSummaryData();
  socket.emit('player_sync', summary);
  console.log('Player summary synced:', summary);
}

// Character dropdown - select character from room pool
document.getElementById('character-dropdown')?.addEventListener('change', async (e) => {
  const selectedId = e.target.value;
  await handleCharacterSelect(selectedId);
});

// Save button - immediate sync
document.getElementById('save-sheet-btn')?.addEventListener('click', async () => {
  if (!currentRoom) {
    alert('You must join a room first!');
    return;
  }
  
  const btn = document.getElementById('save-sheet-btn');
  const originalText = btn.innerHTML;
  
  // Show saving state
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  btn.disabled = true;
  
  try {
    // Add timeout to prevent infinite spinner
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Save timed out')), 10000)
    );
    
    const result = await Promise.race([saveToDatabase(), timeoutPromise]);
    
    // Sync to server for GM display
    syncPlayerSummary();
    
    if (result.success) {
      if (result.location === 'database') {
        showSaveToast('Character synced to server! ✓', 'success');
      } else {
        showSaveToast('Saved locally (join a room to sync to server)', 'info');
      }
      
      // Visual feedback - success
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Synced!';
      btn.classList.add('saved');
    } else {
      showSaveToast('Server save failed - saved locally as backup', 'error');
      
      // Visual feedback - error
      btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Local Only';
      btn.classList.add('error');
    }
  } catch (error) {
    console.error('Save error or timeout:', error);
    showSaveToast('Save timed out - saved locally as backup', 'error');
    btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Timeout';
    btn.classList.add('error');
  }
  
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.remove('saved', 'error');
    btn.disabled = false;
  }, 2000);
});

// ===== EXPORT/IMPORT CHARACTER SHEET =====

// Export button - show confirmation modal
document.getElementById('export-sheet-btn')?.addEventListener('click', () => {
  document.getElementById('export-modal').classList.add('show');
});

// Close export modal
document.getElementById('export-modal-close')?.addEventListener('click', () => {
  document.getElementById('export-modal').classList.remove('show');
});

document.getElementById('cancel-export-btn')?.addEventListener('click', () => {
  document.getElementById('export-modal').classList.remove('show');
});

// Close modal on overlay click
document.getElementById('export-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'export-modal') {
    document.getElementById('export-modal').classList.remove('show');
  }
});

// Confirm export - download JSON file
document.getElementById('confirm-export-btn')?.addEventListener('click', () => {
  // Save current sheet state first
  saveCharacterSheet();
  
  // Create export data with metadata
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    characterName: characterSheet.name || 'Unknown',
    data: characterSheet
  };
  
  // Create and download file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `${(characterSheet.name || 'character').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Close modal
  document.getElementById('export-modal').classList.remove('show');
  
  // Show success feedback
  alert(`Character sheet exported as "${filename}"`);
});

// Import button - trigger file input
document.getElementById('import-sheet-btn')?.addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});

// Handle file selection for import
document.getElementById('import-file-input')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      
      // Validate the file has character data
      if (!importedData.data || typeof importedData.data !== 'object') {
        alert('Invalid character file. Please select a valid exported character sheet.');
        return;
      }
      
      // Confirm import (will overwrite current data)
      const characterName = importedData.characterName || importedData.data.name || 'Unknown';
      const exportDate = importedData.exportDate ? new Date(importedData.exportDate).toLocaleDateString() : 'Unknown';
      
      if (!confirm(`Import "${characterName}" (exported ${exportDate})?\n\nThis will replace your current character sheet. Make sure you've exported your current sheet if you want to keep it.`)) {
        return;
      }
      
      // Import the character data
      characterSheet = { ...characterSheet, ...importedData.data };
      
      // Save to localStorage
      saveCharacterSheet();
      
      // Reload the UI
      loadCharacterSheet();
      
      // Sync if in a room
      if (currentRoom) {
        syncPlayerSummary();
      }
      
      alert(`Successfully imported "${characterName}"!`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import character sheet. The file may be corrupted or in an invalid format.');
    }
  };
  
  reader.readAsText(file);
  
  // Reset file input so the same file can be selected again
  e.target.value = '';
});

// Start sync interval when player joins
let syncInterval = null;

// Load character sheet from database
// ===== CHARACTER DROPDOWN (Roll20 style - room shared pool) =====
async function updateCharacterDropdown() {
  const dropdown = document.getElementById('character-dropdown');
  if (!dropdown || !currentRoomId) return;
  
  try {
    const sheets = await getRoomSheets(currentRoomId);
    
    // Clear existing options (except first one which is "Select or create...")
    dropdown.innerHTML = '<option value="">-- Select Character --</option>';
    dropdown.innerHTML += '<option value="new">+ Create New Character</option>';
    
    // Add all room characters
    if (sheets && sheets.length > 0) {
      sheets.forEach(sheet => {
        const option = document.createElement('option');
        option.value = sheet.id;
        option.textContent = `${sheet.name || 'Unnamed'} (${sheet.class || 'No class'} Lv.${sheet.level || 1})`;
        if (sheet.id === currentSheetId) {
          option.selected = true;
        }
        dropdown.appendChild(option);
      });
    }
    
    dropdown.style.display = 'block';
    console.log(`Updated character dropdown with ${sheets.length} characters`);
  } catch (error) {
    console.error('Failed to update character dropdown:', error);
  }
}

// Handle character selection from dropdown
async function handleCharacterSelect(sheetId) {
  if (!sheetId) return;
  
  if (sheetId === 'new') {
    // Create new character - reset form and clear current sheet ID
    currentSheetId = null;
    characterSheet = { ...defaultCharacterSheet };
    populateFormFromCharacterSheet();
    updateAllCalculations();
    updateHpBar();
    updateCharacterIdDisplay();
    showSaveToast('New character started - fill in details and save!', 'info');
    return;
  }
  
  // Load existing character
  try {
    const sheet = await getSheet(sheetId);
    if (sheet) {
      currentSheetId = sheet.id;
      localStorage.setItem('dordroller_sheet_id', currentSheetId);
      characterSheet = { ...defaultCharacterSheet, ...sheet };
      populateFormFromCharacterSheet();
      updateAllCalculations();
      updateHpBar();
      updateCharacterIdDisplay();
      showSaveToast(`Loaded: ${characterSheet.name || 'Unnamed Character'}`, 'info');
      
      // Sync with GM
      syncPlayerSummary();
    }
  } catch (error) {
    console.error('Failed to load character:', error);
    showSaveToast('Failed to load character', 'error');
  }
}

async function loadFromDatabase() {
  if (!currentRoomId) return false;
  
  try {
    // Update the dropdown with all room characters
    await updateCharacterDropdown();
    
    // Check for saved sheet ID first
    const savedSheetId = localStorage.getItem('dordroller_sheet_id');
    
    if (savedSheetId) {
      // Try to load the specific sheet
      const sheet = await getSheet(savedSheetId);
      if (sheet && sheet.roomId === currentRoomId) {
        currentSheetId = sheet.id;
        // Merge with defaults to ensure all fields exist
        characterSheet = { ...defaultCharacterSheet, ...sheet };
        updateCharacterIdDisplay(); // Update the ID display
        console.log('Loaded character sheet from database:', characterSheet.name);
        return true;
      }
    }
    
    // Otherwise, get all sheets for this room and let user pick
    const sheets = await getRoomSheets(currentRoomId);
    if (sheets && sheets.length > 0) {
      // Don't auto-select, let user pick from dropdown
      console.log(`Found ${sheets.length} characters in room`);
      return false; // No auto-load, user will pick
    }
    
    return false; // No sheets found, will use localStorage or defaults
  } catch (error) {
    console.error('Failed to load from database:', error);
    return false;
  }
}

socket.on('room_joined', async (data) => {
  console.log('Joined room:', data.roomCode, 'Room ID:', data.roomId, 'Room Name:', data.roomName);
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('character-sheet').style.display = 'block';
  
  // Display room info
  const roomNameEl = document.getElementById('room-name-display');
  const roomCodeEl = document.getElementById('room-code-display');
  if (roomNameEl) roomNameEl.textContent = data.roomName || 'Unnamed Room';
  if (roomCodeEl) roomCodeEl.textContent = `Code: ${data.roomCode}`;
  
  // Store room ID (hex ID from database)
  currentRoomId = data.roomId || null;
  currentRoom = data.roomCode;
  
  // Use authenticated user's ID if available, otherwise try to get/create player
  if (currentUser && currentUser.id) {
    currentPlayerId = currentUser.id;
    localStorage.setItem('dordroller_player_id', currentPlayerId);
    console.log('Using authenticated user ID:', currentPlayerId);
    
    // Send player ID to server for room persistence
    socket.emit('player_update_ids', {
      playerId: currentPlayerId,
      characterSheetId: currentSheetId
    });
  } else {
    // Fallback for non-authenticated sessions (if auth is disabled)
    const savedPlayerId = localStorage.getItem('dordroller_player_id');
    if (savedPlayerId) {
      currentPlayerId = savedPlayerId;
      console.log('Using saved player ID:', currentPlayerId);
    } else {
      console.log('No player ID available - some features may be limited');
    }
  }
  
  // Load character dropdown and try to restore last used character
  if (currentRoomId) {
    const loadedFromDb = await loadFromDatabase();
    if (loadedFromDb) {
      // Update the form with database data
      populateFormFromCharacterSheet();
      updateAllCalculations();
      updateHpBar();
    }
  } else {
    console.warn('No room ID received - database features unavailable');
  }
  
  loadCharacterSheet();
  alert(`Welcome, ${playerName}!`);
  
  // Start syncing summary data every 30 seconds
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(syncPlayerSummary, 30000);
  
  // Send initial sync after a short delay to let character sheet load
  setTimeout(syncPlayerSummary, 1000);
});

// Handle GM request for full character sheet
socket.on('request_sheet_data', ({ requesterId }) => {
  console.log('GM requested full character sheet');
  const sheetData = collectFullSheetData();
  socket.emit('player_sheet_response', { requesterId, sheetData });
});

// Handle GM request for all players to sync
socket.on('request_sync', () => {
  console.log('GM requested sync - sending summary data');
  syncPlayerSummary();
});

// Clean up on disconnect
socket.on('disconnect', () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
});

// ===== INITIALIZATION =====
// Populate form from saved character sheet on page load
populateFormFromCharacterSheet();
updateAllCalculations();
updateHpBar();

// Check for saved sheet ID and update display
const savedSheetId = localStorage.getItem('dordroller_sheet_id');
if (savedSheetId) {
  currentSheetId = savedSheetId; // Hex string, not integer
  updateCharacterIdDisplay();
}