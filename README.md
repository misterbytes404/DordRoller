<div align="center">

# Dord Roller

### *A Twitch D&D Stream Management Suite*

![D20](https://img.shields.io/badge/d20-🎲-red?style=for-the-badge)
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
| **Backend** | Node.js, Express.js, Socket.io, JWT |
| **Frontend** | Vite, ES6+ JavaScript, CSS3 |
| **Real-time** | WebSocket (Socket.io) |
| **Database** | PostgreSQL (with JSONB for character sheets) |
| **Authentication** | Twitch OAuth 2.0 |
| **Data** | D&D 5e Bestiary JSON ([5etools](https://github.com/5etools-mirror-3/5etools-src) format) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- PostgreSQL 14+
- Twitch Developer Account (for OAuth)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/misterbytes404/DordRoller.git
   cd DordRoller
   ```

2. **Install dependencies**
   ```bash
   cd backend && pnpm install
   cd ../gm-client && pnpm install
   cd ../player-client && pnpm install
   ```

3. **Set up PostgreSQL**
   - Create a database named `dordroller`
   - The schema will be auto-created on first run

4. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` with your settings (see [Environment Configuration](#environment-configuration))

5. **Start the servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && pnpm dev

   # Terminal 2 - GM Client
   cd gm-client && pnpm dev

   # Terminal 3 - Player Client
   cd player-client && pnpm dev
   ```

6. **Access the app**
   - Landing Page: http://localhost:3000
   - GM Client: http://localhost:5173
   - Player Client: http://localhost:5175

---

## ⚙️ Environment Configuration

Create a `backend/.env` file with the following:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/dordroller

# Server
PORT=3000
NODE_ENV=development

# Twitch OAuth (see setup guide below)
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback

# Authentication
AUTH_ENABLED=false
JWT_SECRET=your-secure-random-string-here
```

---

## 🔐 Twitch OAuth Setup

Dord Roller uses Twitch for user authentication. Follow these steps to set up OAuth:

### Step 1: Create a Twitch Developer Application

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console)
2. Log in with your Twitch account
3. Click **"Register Your Application"**
4. Fill in the application details:
   - **Name**: `Dord Roller` (or your preferred name)
   - **OAuth Redirect URLs**:
     - Development: `http://localhost:3000/auth/twitch/callback`
     - Production: `https://your-domain.com/auth/twitch/callback`
   - **Category**: `Website Integration`
   - **Client Type**: `Confidential`
5. Click **"Create"**

### Step 2: Get Your Credentials

1. Click **"Manage"** on your newly created application
2. Copy the **Client ID**
3. Click **"New Secret"** to generate a **Client Secret**
   - ⚠️ Save this immediately — you won't be able to see it again!

### Step 3: Configure Environment Variables

Add your credentials to `backend/.env`:

```env
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
AUTH_ENABLED=true
```

### Step 4: Generate a JWT Secret

Generate a secure random string for JWT signing:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add it to your `.env`:

```env
JWT_SECRET=your_generated_secret_here
```

### Authentication Flow

When `AUTH_ENABLED=true`:
1. Users click "Login with Twitch" on the landing page
2. They're redirected to Twitch to authorize the app
3. After authorization, they return with their Twitch profile
4. A JWT token is created and stored in the browser
5. The user can access their rooms and character sheets

> **Note**: Set `AUTH_ENABLED=false` to use the app without authentication (useful for local testing).

---

## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **MVP 1** | ✅ Complete | GM-to-OBS Dice Roller |
| **MVP 2** | ✅ Complete | GM Stat Tracker |
| **MVP 3** | ✅ Complete | Player Client Integration |
| **MVP 4** | ✅ Complete | Database & Authentication |

### 📋 To Do

- [ ] 🚀 **Railway Deployment** — Deploy backend with PostgreSQL addon
- [ ] 📺 OBS Monster Display — Show monster name & HP bar on stream
- [ ] 🎲 Player Dice Rolling — Full integration with GM panel & OBS
- [ ] 🎨 UI Overhaul — Visual polish across all clients
- [ ] 🏠 Room Dashboard — User's room list after login

### ✅ Completed

- [x] 🔐 **Twitch OAuth** — SSO authentication for GMs and players
  - Twitch login integration
  - JWT session management
  - User accounts tied to Twitch IDs
  - Room membership tracking
- [x] 🏷️ **Room Naming** — Named rooms for easier management
- [x] 🐘 **PostgreSQL Database** — Character sheet persistence
  - Connection pool with SSL for production deployment
  - Players table, character_sheets table with JSONB
  - REST API endpoints (CRUD for sheets)
  - Save & Sync button with database integration
  - Auto-loads character sheet when joining room
- [x] HP bars on monster cards with damage controls
- [x] GM dice roller with room broadcasting
- [x] Player character sheet (D&D 5e PDF-style)
- [x] Ability score calculations (modifiers, totals)
- [x] Saving throw & skill calculations with proficiency
- [x] Spellcasting section with cantrips & prepared spells
- [x] Room-based session management
- [x] GM Roll Log widget — Real-time feed of player rolls
- [x] HP Slider with visual progress bar
- [x] Player quick roll buttons (abilities, saves, skills)
- [x] Combat dice roller with attack/damage system
- [x] Floating roll toast notifications

---

## 🐛 Known Issues

| Issue | Status | Description |
|-------|--------|-------------|
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

