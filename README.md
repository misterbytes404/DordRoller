<div align="center">

# 🎲 Dord Roller

### *A Twitch D&D Stream Management Suite*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/socket.io-4.x-black)](https://socket.io/)

*Roll dice, track monsters, manage characters — all in real-time for your stream.*

</div>

---

## 📖 About

**Dord Roller** is a modular, real-time web application suite designed for Twitch streamers who run D&D campaigns. It connects Game Masters, Players, and your stream overlay seamlessly through WebSocket technology.

## 🗂️ Project Structure

```text
DordRoller/
├── 🖥️  backend/        → Node.js server (Express + Socket.io)
├── 🎮  gm-client/      → GM control panel
├── 👤  player-client/  → Player character sheets & rolling
├── 📺  obs-client/     → OBS browser source overlay
└── 🔗  shared/         → Shared utilities & event definitions
```

---

## ✨ Features

### 🎮 GM Client

| Feature | Description |
|---------|-------------|
| **Dice Roller** | Roll d4, d6, d8, d10, d12, d20, d100 with custom labels |
| **Monster Tracker** | Search D&D 5e bestiary, track HP with visual health bars |
| **Room Management** | Generate unique room codes for player sessions |
| **Live Broadcasting** | Instant sync to OBS overlay and connected players |

### 👤 Player Client

Full **D&D 5e character sheet** with automatic calculations:

- 📝 Basic Info — Name, class, level, race, alignment, XP
- 💪 Ability Scores — Auto-calculated modifiers & totals
- 🛡️ Saving Throws — Proficiency tracking per ability
- 🎯 Skills — All 18 skills with proficiency & expertise
- ⚔️ Combat — AC, HP, initiative, speed, weapons, armor
- ✨ Spellcasting — Cantrips, prepared spells (1st-9th), slot tracking
- 🎒 Inventory — Equipment, features, and feats tabs

*Plus:* Receive roll requests from GM and execute them in real-time!

### 📺 OBS Client

- **Stream-Ready Overlay** — Drop into OBS as a browser source
- **Real-Time Updates** — Dice rolls and game state broadcast instantly

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | Node.js, Express.js, Socket.io |
| **Frontend** | Vite, ES6+ JavaScript, CSS3 |
| **Real-time** | WebSocket (Socket.io) |
| **Data** | D&D 5e Bestiary JSON ([5etools](https://github.com/5etools-mirror-3/5etools-src) format) |

---

## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **MVP 1** | ✅ Complete | GM-to-OBS Dice Roller |
| **MVP 2** | ✅ Complete | GM Stat Tracker |
| **MVP 3** | 🔄 In Progress | Player Client Integration |

### 📋 To Do

- [ ] 🐘 **PostgreSQL Database** — Character sheet persistence (Railway-ready)
  - Players table, character_sheets table with JSONB for complex data
  - Rooms & room_players tables for session management
  - REST API endpoints (CRUD for sheets)
  - Save & Sync button integration
- [ ] 📺 OBS Monster Display — Show monster name & HP bar on stream
- [ ] 🔐 Twitch OAuth — Authentication for GMs and players
- [ ] 🎲 Player Dice Rolling — Full integration with GM panel & OBS
- [ ] 🎨 UI Overhaul — Visual polish across all clients

### ✅ Completed

- [x] HP bars on monster cards with damage controls
- [x] GM dice roller with room broadcasting
- [x] Player character sheet (D&D 5e PDF-style)
- [x] Ability score calculations (modifiers, totals)
- [x] Saving throw & skill calculations with proficiency
- [x] Spellcasting section with cantrips & prepared spells
- [x] Room-based session management

---

## 🐛 Known Issues

| Issue | Status | Description |
|-------|--------|-------------|
| **Save & Sync Button** | 🔴 Broken | Button click handler not functioning — character sheet doesn't save on click |
| **Export Download** | 🔴 Broken | Export modal opens but download button doesn't trigger file save |
| **Import Character** | ⚠️ Untested | Import functionality implemented but not fully tested |
| Monster Type Parsing | 🟡 Partial | Some bestiary entries don't parse monster types correctly |

---

## 🙏 Attributions

This project incorporates parsing logic inspired by the [5etools project](https://github.com/5etools-mirror-3/5etools-src), licensed under MIT. Thanks to the 5etools community for their comprehensive D&D data!

---

## 👥 Contributors

<a href="https://github.com/misterbytes404/dordroller/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=misterbytes404/dordroller" alt="Contributors" />
</a>

---

<div align="center">


</div>

