import express from 'express';
import { Player } from '../models/Player.js';
import { CharacterSheet } from '../models/CharacterSheet.js';

const router = express.Router();

// ===== PLAYER ROUTES =====

// Get or create player by name
router.post('/players', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const player = await Player.findOrCreate(name);
    res.json(player);
  } catch (err) {
    console.error('Error creating player:', err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Get player by ID
router.get('/players/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (err) {
    console.error('Error fetching player:', err);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// ===== CHARACTER SHEET ROUTES =====

// Create new character sheet (belongs to a room)
router.post('/sheets', async (req, res) => {
  try {
    const { roomId, ...sheetData } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }
    const sheet = await CharacterSheet.create(roomId, sheetData);
    res.status(201).json(sheet);
  } catch (err) {
    console.error('Error creating character sheet:', err);
    res.status(500).json({ error: 'Failed to create character sheet' });
  }
});

// Get character sheet by ID
router.get('/sheets/:id', async (req, res) => {
  try {
    const sheet = await CharacterSheet.findById(req.params.id);
    if (!sheet) {
      return res.status(404).json({ error: 'Character sheet not found' });
    }
    res.json(sheet);
  } catch (err) {
    console.error('Error fetching character sheet:', err);
    res.status(500).json({ error: 'Failed to fetch character sheet' });
  }
});

// Get all character sheets for a room (shared pool)
router.get('/rooms/:roomId/sheets', async (req, res) => {
  try {
    const sheets = await CharacterSheet.findByRoomId(req.params.roomId);
    res.json(sheets);
  } catch (err) {
    console.error('Error fetching character sheets:', err);
    res.status(500).json({ error: 'Failed to fetch character sheets' });
  }
});

// Update character sheet (Save & Sync)
router.put('/sheets/:id', async (req, res) => {
  try {
    const sheet = await CharacterSheet.update(req.params.id, req.body);
    if (!sheet) {
      return res.status(404).json({ error: 'Character sheet not found' });
    }
    res.json(sheet);
  } catch (err) {
    console.error('Error updating character sheet:', err);
    res.status(500).json({ error: 'Failed to update character sheet' });
  }
});

// Delete character sheet
router.delete('/sheets/:id', async (req, res) => {
  try {
    const deleted = await CharacterSheet.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Character sheet not found' });
    }
    res.json({ success: true, message: 'Character sheet deleted' });
  } catch (err) {
    console.error('Error deleting character sheet:', err);
    res.status(500).json({ error: 'Failed to delete character sheet' });
  }
});

export default router;
