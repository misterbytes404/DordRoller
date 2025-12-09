// Account Page JavaScript
const API_URL = window.location.origin;

// Fetch current user data using cookie-based authentication
async function getCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                return null;
            }
            throw new Error('Failed to fetch user');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

// Update user display name
async function updateDisplayName(displayName) {
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ displayName })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to update profile' };
        }

        return { success: true, user: data.user };
    } catch (error) {
        console.error('Error updating display name:', error);
        return { success: false, error: 'Network error' };
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Logout function
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    window.location.href = '/landing';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create room card element
function createRoomCard(room, isGM = false) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.dataset.roomId = room.id;
    
    const roomName = room.name || room.room_code || room.code || 'Unnamed Room';
    const roomCode = room.room_code || room.code || '';
    
    card.innerHTML = `
        <div class="room-card-header">
            <h4 class="room-name">${escapeHtml(roomName)}</h4>
            <span class="room-code">${escapeHtml(roomCode)}</span>
        </div>
        <div class="room-card-body">
            ${isGM 
                ? `<span class="room-stat"><i class="fa-solid fa-users"></i> ${room.player_count || 0} players</span>`
                : `<span class="room-stat"><i class="fa-solid fa-crown"></i> GM: ${escapeHtml(room.gm_name || room.gmName || 'Unknown')}</span>`
            }
        </div>
        <div class="room-card-actions">
            <button class="btn btn-small btn-primary" onclick="joinRoom('${escapeHtml(roomCode)}', ${isGM})">
                <i class="fa-solid fa-sign-in-alt"></i> ${isGM ? 'Open' : 'Join'}
            </button>
            ${isGM ? `
            <button class="btn btn-small btn-danger" onclick="deleteRoom('${room.id}', '${escapeHtml(roomName).replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash"></i> Delete
            </button>
            ` : ''}
        </div>
    `;
    return card;
}

// Delete a room
async function deleteRoom(roomId, roomName) {
    if (!confirm(`Are you sure you want to permanently delete "${roomName}"? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Room deleted successfully', 'success');
            // Remove the card from the UI
            const card = document.querySelector(`.room-card[data-room-id="${roomId}"]`);
            if (card) {
                card.remove();
            }
            // Check if there are no more GM rooms
            const gmRoomsList = document.getElementById('gm-rooms-list');
            if (gmRoomsList && gmRoomsList.children.length === 0) {
                gmRoomsList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-door-closed"></i><p>You haven\'t created any rooms as GM yet.</p></div>';
            }
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete room', 'error');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        showToast('Error deleting room', 'error');
    }
}

// Join a room
function joinRoom(roomCode, asGM = false) {
    // Use dev ports in development, regular paths in production
    const isDev = window.location.port === '3000';
    let clientUrl;
    
    if (isDev) {
        clientUrl = asGM ? 'http://localhost:5173' : 'http://localhost:5175';
    } else {
        clientUrl = asGM ? '/gm' : '/player';
    }
    
    const url = `${clientUrl}?room=${encodeURIComponent(roomCode)}`;
    window.location.href = url;
}

// Initialize the page
async function init() {
    const userData = await getCurrentUser();

    if (!userData || !userData.user) {
        // Not logged in, redirect to landing
        window.location.href = '/landing';
        return;
    }

    const { user, rooms = {} } = userData;
    const gmRooms = rooms.gmRooms || [];
    const playerRooms = rooms.playerRooms || [];

    // Update header user info
    const headerAvatar = document.getElementById('header-avatar');
    const headerUsername = document.getElementById('header-username');
    
    if (user.avatarUrl || user.avatar_url) {
        headerAvatar.src = user.avatarUrl || user.avatar_url;
        headerAvatar.style.display = 'block';
    } else {
        headerAvatar.style.display = 'none';
    }
    headerUsername.textContent = user.displayName || user.display_name || user.username || 'User';

    // Update profile section
    const profileAvatar = document.getElementById('profile-avatar');
    const displayNameInput = document.getElementById('display-name');
    const accountType = document.getElementById('account-type');
    const memberSince = document.getElementById('member-since');

    if (user.avatarUrl || user.avatar_url) {
        profileAvatar.src = user.avatarUrl || user.avatar_url;
    } else {
        const initial = (user.displayName || user.display_name || 'U')[0].toUpperCase();
        profileAvatar.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%236441a5" width="100" height="100"/><text x="50" y="65" font-size="40" fill="white" text-anchor="middle">${initial}</text></svg>`;
    }
    
    displayNameInput.value = user.displayName || user.display_name || '';
    
    // Set account type
    if (user.authType === 'twitch' || user.auth_type === 'twitch') {
        accountType.innerHTML = '<i class="fa-brands fa-twitch"></i> Twitch Account';
        document.querySelector('.avatar-note').innerHTML = '<i class="fa-brands fa-twitch"></i> Avatar synced from Twitch';
    } else {
        accountType.innerHTML = '<i class="fa-solid fa-user"></i> Local Account';
        document.querySelector('.avatar-note').innerHTML = '<i class="fa-solid fa-user"></i> Local account';
    }
    
    memberSince.textContent = formatDate(user.createdAt || user.created_at);

    // Populate GM rooms
    const gmRoomsList = document.getElementById('gm-rooms-list');
    gmRoomsList.innerHTML = '';
    if (gmRooms.length === 0) {
        gmRoomsList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-door-closed"></i><p>You haven\'t created any rooms as GM yet.</p></div>';
    } else {
        gmRooms.forEach(room => {
            gmRoomsList.appendChild(createRoomCard(room, true));
        });
    }

    // Populate player rooms
    const playerRoomsList = document.getElementById('player-rooms-list');
    playerRoomsList.innerHTML = '';
    if (playerRooms.length === 0) {
        playerRoomsList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-door-closed"></i><p>You haven\'t joined any rooms as a player yet.</p></div>';
    } else {
        playerRooms.forEach(room => {
            playerRoomsList.appendChild(createRoomCard(room, false));
        });
    }

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // User dropdown toggle
    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
    });

    // Navigation tabs
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section + '-section';
            
            // Update active nav item
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Save display name
    document.getElementById('save-display-name').addEventListener('click', async () => {
        const displayNameInput = document.getElementById('display-name');
        const newName = displayNameInput.value.trim();
        
        if (!newName) {
            showToast('Display name cannot be empty', 'error');
            return;
        }

        const result = await updateDisplayName(newName);
        if (result.success) {
            showToast('Display name updated successfully', 'success');
            // Update header username
            document.getElementById('header-username').textContent = newName;
        } else {
            showToast(result.error || 'Failed to update display name', 'error');
        }
    });

    // Logout buttons
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('settings-logout-btn').addEventListener('click', logout);
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', init);
