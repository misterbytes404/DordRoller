import express from 'express';
import { Room } from '../models/Room.js';
import { authenticateToken, optionalAuth } from './auth.js';

const router = express.Router();

// Get room by code (public - for joining)
router.get('/rooms/code/:code', async (req, res) => {
  try {
    const room = await Room.findByCode(req.params.code.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Get room by ID
router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Create a new room (requires auth when enabled)
router.post('/rooms', optionalAuth, async (req, res) => {
  try {
    const { name, code } = req.body;
    const ownerId = req.user?.id || null;
    
    // If code provided, sanitize it
    const sanitizedCode = code 
      ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
      : null;
    
    const room = await Room.create(name || 'Unnamed Room', ownerId, sanitizedCode);
    res.status(201).json(room);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Room code already in use' });
    }
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room name
router.put('/rooms/:id/name', optionalAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Check if user is GM (when auth is enabled)
    if (req.user) {
      const isGM = await Room.isGM(req.params.id, req.user.id);
      if (!isGM) {
        return res.status(403).json({ error: 'Only the GM can rename the room' });
      }
    }
    
    const room = await Room.updateName(req.params.id, name);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Error updating room name:', error);
    res.status(500).json({ error: 'Failed to update room name' });
  }
});

// Update room code
router.put('/rooms/:id/code', optionalAuth, async (req, res) => {
  try {
    const { newCode } = req.body;
    if (!newCode) {
      return res.status(400).json({ error: 'New code is required' });
    }
    
    // Check if user is GM (when auth is enabled)
    if (req.user) {
      const isGM = await Room.isGM(req.params.id, req.user.id);
      if (!isGM) {
        return res.status(403).json({ error: 'Only the GM can change the room code' });
      }
    }
    
    const sanitizedCode = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    const room = await Room.updateCode(req.params.id, sanitizedCode);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Room code already in use' });
    }
    console.error('Error updating room code:', error);
    res.status(500).json({ error: 'Failed to update room code' });
  }
});

// Join a room by code
router.post('/rooms/join', optionalAuth, async (req, res) => {
  try {
    const { code, role } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Room code is required' });
    }
    
    const sanitizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const userId = req.user?.id || null;
    
    // Find room
    const room = await Room.findByCode(sanitizedCode);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Add user as member if authenticated
    if (userId) {
      await Room.addMember(room.id, userId, role || 'player');
    }
    
    res.json(room);
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get members of a room
router.get('/rooms/:id/members', async (req, res) => {
  try {
    const members = await Room.getMembers(req.params.id);
    res.json(members);
  } catch (error) {
    console.error('Error getting room members:', error);
    res.status(500).json({ error: 'Failed to get room members' });
  }
});

// Get players in a room
router.get('/rooms/:id/players', async (req, res) => {
  try {
    const players = await Room.getPlayers(req.params.id);
    res.json(players);
  } catch (error) {
    console.error('Error getting room players:', error);
    res.status(500).json({ error: 'Failed to get room players' });
  }
});

// Add member to room (GM only when auth enabled)
router.post('/rooms/:id/members', optionalAuth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = await Room.addMember(req.params.id, userId, role || 'player');
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding member to room:', error);
    res.status(500).json({ error: 'Failed to add member to room' });
  }
});

// Remove member from room
router.delete('/rooms/:id/members/:userId', optionalAuth, async (req, res) => {
  try {
    // Check if user can remove (self or GM)
    if (req.user && req.user.id !== req.params.userId) {
      const isGM = await Room.isGM(req.params.id, req.user.id);
      if (!isGM) {
        return res.status(403).json({ error: 'Only the GM can remove other members' });
      }
    }
    
    await Room.removeMember(req.params.id, req.params.userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing member from room:', error);
    res.status(500).json({ error: 'Failed to remove member from room' });
  }
});

// Delete room (owner/GM only)
router.delete('/rooms/:id', optionalAuth, async (req, res) => {
  try {
    // Check if user is GM (when auth is enabled)
    if (req.user) {
      const isGM = await Room.isGM(req.params.id, req.user.id);
      if (!isGM) {
        return res.status(403).json({ error: 'Only the GM can delete the room' });
      }
    }
    
    const room = await Room.delete(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ message: 'Room deleted', room });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
