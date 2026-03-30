import express from 'express';
import { Monster } from '../models/Monster.js';
import { CustomMonster } from '../models/CustomMonster.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// ===================== CUSTOM MONSTER LIBRARY =====================

// Get all custom monsters for the logged-in user
router.get('/custom-monsters', authenticateToken, async (req, res) => {
  try {
    const monsters = await CustomMonster.findByUserId(req.user.id);
    res.json(monsters);
  } catch (err) {
    console.error('Error fetching custom monsters:', err);
    res.status(500).json({ error: 'Failed to fetch custom monsters' });
  }
});

// Save a new custom monster
router.post('/custom-monsters', authenticateToken, async (req, res) => {
  try {
    const monster = await CustomMonster.create(req.user.id, req.body);
    res.status(201).json(monster);
  } catch (err) {
    console.error('Error saving custom monster:', err);
    res.status(500).json({ error: 'Failed to save custom monster' });
  }
});

// Update a custom monster (ownership enforced in query)
router.put('/custom-monsters/:id', authenticateToken, async (req, res) => {
  try {
    const monster = await CustomMonster.update(req.params.id, req.user.id, req.body);
    if (!monster) {
      return res.status(404).json({ error: 'Custom monster not found' });
    }
    res.json(monster);
  } catch (err) {
    console.error('Error updating custom monster:', err);
    res.status(500).json({ error: 'Failed to update custom monster' });
  }
});

// Delete a custom monster (ownership enforced in query)
router.delete('/custom-monsters/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await CustomMonster.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Custom monster not found' });
    }
    res.json({ success: true, message: 'Custom monster deleted' });
  } catch (err) {
    console.error('Error deleting custom monster:', err);
    res.status(500).json({ error: 'Failed to delete custom monster' });
  }
});

// ===================== ROOM MONSTER ROUTES =====================

// Get all monsters for a room
router.get('/rooms/:roomId/monsters', async (req, res) => {
  try {
    const monsters = await Monster.findByRoomId(req.params.roomId);
    res.json(monsters);
  } catch (err) {
    console.error('Error fetching monsters:', err);
    res.status(500).json({ error: 'Failed to fetch monsters' });
  }
});

// Get a specific monster by ID
router.get('/monsters/:id', async (req, res) => {
  try {
    const monster = await Monster.findById(req.params.id);
    if (!monster) {
      return res.status(404).json({ error: 'Monster not found' });
    }
    res.json(monster);
  } catch (err) {
    console.error('Error fetching monster:', err);
    res.status(500).json({ error: 'Failed to fetch monster' });
  }
});

// Create a new monster for a room
router.post('/monsters', async (req, res) => {
  try {
    const { roomId, ...monsterData } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }
    const monster = await Monster.create(roomId, monsterData);
    res.status(201).json(monster);
  } catch (err) {
    console.error('Error creating monster:', err);
    res.status(500).json({ error: 'Failed to create monster' });
  }
});

// Update a monster
router.put('/monsters/:id', async (req, res) => {
  try {
    const monster = await Monster.update(req.params.id, req.body);
    if (!monster) {
      return res.status(404).json({ error: 'Monster not found' });
    }
    res.json(monster);
  } catch (err) {
    console.error('Error updating monster:', err);
    res.status(500).json({ error: 'Failed to update monster' });
  }
});

// Quick HP update (for combat)
router.patch('/monsters/:id/hp', async (req, res) => {
  try {
    const { hp } = req.body;
    if (hp === undefined) {
      return res.status(400).json({ error: 'HP value is required' });
    }
    const monster = await Monster.updateHp(req.params.id, hp);
    if (!monster) {
      return res.status(404).json({ error: 'Monster not found' });
    }
    res.json(monster);
  } catch (err) {
    console.error('Error updating monster HP:', err);
    res.status(500).json({ error: 'Failed to update monster HP' });
  }
});

// Update display order for a monster
router.patch('/monsters/:id/order', async (req, res) => {
  try {
    const { displayOrder } = req.body;
    if (displayOrder === undefined) {
      return res.status(400).json({ error: 'Display order is required' });
    }
    const monster = await Monster.updateOrder(req.params.id, displayOrder);
    if (!monster) {
      return res.status(404).json({ error: 'Monster not found' });
    }
    res.json(monster);
  } catch (err) {
    console.error('Error updating monster order:', err);
    res.status(500).json({ error: 'Failed to update monster order' });
  }
});

// Bulk update display orders for a room
router.patch('/rooms/:roomId/monsters/order', async (req, res) => {
  try {
    const { orderMap } = req.body;
    if (!orderMap || typeof orderMap !== 'object') {
      return res.status(400).json({ error: 'Order map is required' });
    }
    await Monster.updateAllOrders(req.params.roomId, orderMap);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating monster orders:', err);
    res.status(500).json({ error: 'Failed to update monster orders' });
  }
});

// Delete a monster
router.delete('/monsters/:id', async (req, res) => {
  try {
    const deleted = await Monster.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Monster not found' });
    }
    res.json({ success: true, message: 'Monster deleted' });
  } catch (err) {
    console.error('Error deleting monster:', err);
    res.status(500).json({ error: 'Failed to delete monster' });
  }
});

// Delete all monsters in a room (clear encounter)
router.delete('/rooms/:roomId/monsters', async (req, res) => {
  try {
    const count = await Monster.deleteAllInRoom(req.params.roomId);
    res.json({ success: true, message: `Deleted ${count} monsters` });
  } catch (err) {
    console.error('Error clearing monsters:', err);
    res.status(500).json({ error: 'Failed to clear monsters' });
  }
});

export default router;
