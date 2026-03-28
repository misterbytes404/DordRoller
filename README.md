<div align="center">

# Dord Roller

### *A Twitch D&D Stream Management Suite*

![D20](https://img.shields.io/badge/d20-🎲-red?style=for-the-badge)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/socket.io-4.x-black)](https://socket.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/misterbytes404/DordRoller/badge.svg)](https://snyk.io/test/github/misterbytes404/DordRoller)
[![Live](https://img.shields.io/badge/status-live-success?style=flat-square)](https://dordroller-production.up.railway.app)

*Roll dice, track monsters, manage characters — all in real-time for your stream.*

**🚀 Live:** [dordroller-production.up.railway.app](https://dordroller-production.up.railway.app)

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
| **Monster Tracker** | Search D&D 5e bestiary, track HP with visual health bars, roll attacks/saves/checks directly from cards |
| **Monster Roll Buttons** | Expandable panel per monster with initiative, ability checks, saves, attacks & damage — all with editable modifiers |
| **Action Builder** | Guided form to compose actions & reactions in the correct format so the roll panel auto-generates attack and damage buttons |
| **Custom Monster Library** | Save any monster to your account and pull it into future rooms — appears in search with a ⭐ Custom tag |
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

### 📺 OBS Client

- **Stream-Ready Overlay** — Drop into OBS as a browser source (designed for **1920×1080** resolution)
- **Real-Time Updates** — Dice rolls and game state broadcast instantly
- **Health Bar Overlay** — Persona-inspired JRPG health bars for party and enemies
  - Grouped display: Party (top-left) and Enemies (top-right) with configurable positions
  - Smooth animations: sliding fills, ghost bar trail on damage, heal effects
  - Death state: greyed-out bars for downed entities
  - Max 10 bars per group (players and monsters independently)
  - Player tags: shows "Player: {Name}" under each player's bar with auth service icon (Twitch, etc.)
- **GM Overlay Controls** — Full customization from the GM settings panel
  - Toggle overlay, names, and HP numbers on/off
  - Independent bar font/size, header font/size, and player tag font/size
  - Color pickers: primary bar, low HP, ghost bar, header text, monster names, player names, player tag
  - Visual position picker for each group (4 corners)
  - Per-entity visibility toggles
  - Manual sync button to refresh overlay state
  - All settings persist to database

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | Node.js, Express.js, Socket.io, JWT |
| **Frontend** | Vite, ES6+ JavaScript, CSS3 |
| **Real-time** | WebSocket (Socket.io) |
| **Database** | PostgreSQL (with JSONB for character sheets) |
| **Authentication** | Twitch OAuth 2.0 |
| **Security** | bcrypt, validator, rate limiting, OWASP compliance |
| **Deployment** | Docker, Docker Compose, Railway, VPS |
| **Data** | D&D 5e Bestiary JSON ([5etools](https://github.com/5etools-mirror-3/5etools-src) format) |

---

## 🚀 Deployment

### 🚂 Railway (Recommended)

The easiest and most secure way to deploy. No server management, automatic HTTPS, no port forwarding required.

> ⚠️ **Important:** You must fork this repository to your own GitHub account. Deploying directly from the original repo means you won't be able to customize settings, update your instance, or control your data. **Fork first = you own your installation.**

1. **Fork this repository** to your GitHub account (click "Fork" button top-right)
2. Go to [Railway](https://railway.app/) and create an account (GitHub login recommended)
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select **your forked repository** (not the original) and click **Deploy**
5. Railway auto-detects the Dockerfile and starts building
6. **Add PostgreSQL:** Click **"+ New"** in your project → **"Database"** → **"Add PostgreSQL"**
7. **Link the database:** Click on your app service → **Variables** → **"Add Variable Reference"** → Select `DATABASE_URL` from the PostgreSQL service
8. **Set environment variables** in Railway (see table below)
9. **Redeploy:** After adding variables, Railway will automatically redeploy
10. **Get your URL:** Once deployed, click on your service → **Settings** → Copy your `*.railway.app` URL

Railway automatically creates database tables on first startup. No manual SQL required.

> 💡 **Tip:** Your Railway URL will look like `https://your-app-name.up.railway.app`. You'll need this for the Twitch OAuth redirect URI.

#### Environment Variables

| Variable | Required | Value / Description |
|----------|----------|---------------------|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}` (use Railway's variable reference) |
| `AUTH_ENABLED` | Yes | `true` to require login, `false` for anonymous |
| `JWT_SECRET` | If auth enabled | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SESSION_SECRET` | If auth enabled | Generate another random string (same command as above) |
| `TWITCH_CLIENT_ID` | For Twitch login | From [Twitch Developer Console](https://dev.twitch.tv/console) |
| `TWITCH_CLIENT_SECRET` | For Twitch login | From Twitch Developer Console |
| `TWITCH_REDIRECT_URI` | For Twitch login | `https://your-app.railway.app/auth/twitch/callback` |
| `CORS_ORIGIN` | Yes | `https://your-app.railway.app` (your Railway URL, no trailing slash) |

#### 🎮 Setting Up Twitch Login for Railway

1. **Get your Railway URL first** — Deploy the app (steps above) and copy your URL from Settings
2. **Create a Twitch App:**
   - Go to [Twitch Developer Console](https://dev.twitch.tv/console) → "Register Your Application"
   - **Name:** Whatever you want (e.g., "My DordRoller")
   - **OAuth Redirect URLs:** `https://your-app.railway.app/auth/twitch/callback` (use YOUR Railway URL)
   - **Category:** Website Integration
   - **Client Type:** Confidential
   - Click **Create**
3. **Get credentials:** Click **Manage** on your app → Copy **Client ID** → Click **New Secret** (save it immediately, you can't see it again!)
4. **Add to Railway Variables:**
   - `TWITCH_CLIENT_ID` = your Client ID
   - `TWITCH_CLIENT_SECRET` = your secret
   - `TWITCH_REDIRECT_URI` = `https://your-app.railway.app/auth/twitch/callback`
   - `AUTH_ENABLED` = `true`
   - `JWT_SECRET` = generate a random string (use the command in the table above)
5. **Redeploy** — Railway auto-redeploys after variable changes

> 📝 **Without Twitch:** Set `AUTH_ENABLED=false` to skip login entirely (anyone can access).

**Alternatives:** [Render](https://render.com/), [Fly.io](https://fly.io/) — all have free tiers.

---

## 🔧 Development Setup

For contributing or testing features locally.

**Prerequisites:** Node.js >= 18, pnpm, PostgreSQL 14+

```bash
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller

# Install dependencies
cd backend && pnpm install
cd ../gm-client && pnpm install
cd ../player-client && pnpm install
cd ..

# Configure environment
cp backend/.env.example backend/.env
# Edit with your local PostgreSQL credentials

# Start services (separate terminals)
cd backend && pnpm dev        # Terminal 1
cd gm-client && pnpm dev      # Terminal 2
cd player-client && pnpm dev  # Terminal 3
```

**Access:** http://localhost:3000 (backend), http://localhost:5173 (GM), http://localhost:5175 (Player)

---

## 🐳 Self-Hosting (Advanced)

> ⚠️ **Warning:** Self-hosting requires exposing your server to the public internet. This involves port forwarding, firewall configuration, and security hardening. Only recommended for experienced users.

<details>
<summary>Docker Compose (VPS or Local)</summary>

```bash
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller
cp backend/.env.example .env
# Edit .env with your settings

docker-compose up -d
```

Access: http://localhost:3000 (or your server IP)

</details>

<details>
<summary>Manual VPS Setup</summary>

```bash
# Install Node.js 20, PostgreSQL, pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib
npm install -g pnpm

# Clone and build
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller
cd backend && pnpm install
cd ../gm-client && pnpm install && pnpm build
cd ../player-client && pnpm install && pnpm build

# Configure and run with PM2
cp backend/.env.example backend/.env
npm install -g pm2
cd backend && pm2 start server.js --name dordroller
```

**Required:** Reverse proxy (Caddy/Nginx) for HTTPS.

</details>

### ⚠️ Incompatible Platforms

Traditional shared hosting (GoDaddy, Bluehost, cPanel) is **not supported** — no Node.js, WebSocket, or PostgreSQL.

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

To enable Twitch login:

1. **Create App** — Go to [Twitch Developer Console](https://dev.twitch.tv/console) → Register Your Application
   - **OAuth Redirect URLs**: `http://localhost:3000/auth/twitch/callback` (dev) or your production URL
   - **Category**: Website Integration
   - **Client Type**: Confidential

2. **Get Credentials** — Click Manage → Copy Client ID → Generate New Secret (save immediately!)

3. **Configure** — Add to `backend/.env`:
   ```env
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
   AUTH_ENABLED=true
   JWT_SECRET=your_random_string  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

> **Note**: Set `AUTH_ENABLED=false` to use without authentication (useful for local testing).

---

## 🔑 Local Account Authentication (NOT ENABLED YET)

As an alternative to Twitch OAuth, users can create local accounts with username and password.

**Password Requirements (OWASP Compliant):** 8+ characters with uppercase, lowercase, number, and special character.

**Security:** bcrypt hashing (12 rounds), account lockout (5 attempts), rate limiting (10/15min), input validation.

```bash
# Register
POST /auth/register { "username", "email", "password", "confirmPassword" }

# Login  
POST /auth/login { "usernameOrEmail", "password" }
```

Both endpoints return a JWT token identical to Twitch OAuth tokens.

---

## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **MVP 1** | ✅ Complete | GM-to-OBS Dice Roller |
| **MVP 2** | ✅ Complete | GM Stat Tracker |
| **MVP 3** | ✅ Complete | Player Client Integration |
| **MVP 4** | ✅ Complete | Database & Authentication |
| **v1.0.0** | ✅ Deployed | Production deployment on Railway |

### 📋 To Do

- [ ] Local account authentication (username/password)
- [ ] OBS Monster Display (show monster name & HP on stream)
- [ ] UI polish across all clients
- [ ] Room dashboard after login

### ✅ Completed

- [x] **v1.0.0 Production Deployment** on Railway (Dec 12, 2025)
- [x] Privacy: Removed email collection from Twitch OAuth
- [x] Dynamic URL handling for production/development
- [x] Twitch OAuth authentication
- [x] PostgreSQL database with character sheet persistence
- [x] GM dice roller with room broadcasting
- [x] Monster tracker with HP bars
- [x] Action Builder for monster actions & reactions
- [x] Custom Monster Library (account-scoped)
- [x] Player character sheet (D&D 5e)
- [x] Quick roll buttons & combat dice system
- [x] GM Roll Log widget
- [x] Room-based session management
- [x] Character sheet import/export
- [x] Twitch OAuth login flow tested
- [x] Player room auto-join via URL
- [x] Room name display in player client
- [x] Removed redundant roll request feature from player client

---

## � Using the Action Builder

The **Action Builder** lets you compose monster actions and reactions so the roll panel generates clickable attack and damage buttons automatically.

1. **Open the builder** — Click the "Action Builder" button below the Actions or Reactions textarea (available on both the Add Monster form and inline Edit form).
2. **Pick a type** — Select the attack type from the dropdown:
   - **Melee/Ranged Weapon** or **Melee/Ranged Spell** — shows To Hit, Reach/Range fields
   - **Saving Throw** — shows DC and ability selector
   - **Other** — free-form (no attack/save fields)
3. **Add damage** — Enter a dice expression (e.g. `2d6+4`) and choose a damage type. Click **+** to add additional damage entries (e.g. extra fire damage).
4. **Extra text** — Optionally add flavor text or conditions.
5. **Click "Add Action to List"** — The builder appends a properly formatted line to the textarea, e.g.:
   ```
   Longsword: Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d8+4) slashing damage.
   ```
6. **Save the monster** — When you add or save the monster, the roll panel will parse the actions text and generate **Roll to Hit** and **Damage** buttons for each attack.

> **Tip:** You can also type actions directly into the textarea using the same format. Each action should be on its own line, starting with `Name: ...`.

---

## �🐛 Known Issues

- **Monster Type Parsing** — Some bestiary entries don't parse correctly

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

