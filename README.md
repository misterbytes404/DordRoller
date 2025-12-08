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
| **Authentication** | Twitch OAuth 2.0, Local accounts (bcrypt) |
| **Security** | bcrypt, validator, rate limiting, OWASP compliance |
| **Deployment** | Docker, Docker Compose, Railway, VPS |
| **Data** | D&D 5e Bestiary JSON ([5etools](https://github.com/5etools-mirror-3/5etools-src) format) |

---

## 🚀 Deployment Options

Dord Roller supports multiple deployment methods. Choose the one that fits your needs:

| Method | Difficulty | Best For |
|--------|------------|----------|
| **Docker Compose** | ⭐ Easy | Local, VPS, self-hosting |
| **Railway** | ⭐ Easiest | Cloud hosting, zero DevOps |
| **VPS (Manual)** | ⭐⭐ Medium | Full control, learning |
| **Local Development** | ⭐⭐ Medium | Contributing, testing |

### 🐳 Option 1: Docker Compose (Recommended)

The simplest way to run Dord Roller. One command starts everything.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine

```bash
# Clone the repository
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller

# Configure environment
cp backend/.env.example .env
# Edit .env with your settings (see Environment Configuration below)

# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Access the app:** http://localhost:3000

**Included services:**
- Dord Roller application (backend + all clients)
- PostgreSQL 16 database (data persisted in Docker volume)

### 🚂 Option 2: Railway (Cloud PaaS)

Deploy to the cloud with zero configuration.

1. Fork this repository to your GitHub account
2. Go to [Railway](https://railway.app/) and create an account
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your forked repository
5. Railway auto-detects the Dockerfile and builds
6. Add a **PostgreSQL** plugin from the Railway dashboard
7. Set environment variables in Railway:
   - `AUTH_ENABLED` = `true` or `false`
   - `JWT_SECRET` = (generate a random string)
   - `TWITCH_CLIENT_ID` = (if using Twitch login)
   - `TWITCH_CLIENT_SECRET` = (if using Twitch login)
   - `TWITCH_REDIRECT_URI` = `https://your-app.railway.app/auth/twitch/callback`

Railway automatically provides `DATABASE_URL` when you add PostgreSQL.

### 🖥️ Option 3: VPS Deployment

For full control on your own server (DigitalOcean, Linode, Vultr, etc.).

#### With Docker (Recommended)

```bash
# SSH into your VPS
ssh user@your-server

# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone and configure
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller
cp backend/.env.example .env
nano .env  # Configure your settings

# Start with Docker Compose
docker-compose up -d
```

#### Without Docker

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createdb dordroller

# Install pnpm
npm install -g pnpm

# Clone and setup
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller

# Install dependencies
cd backend && pnpm install
cd ../gm-client && pnpm install && pnpm build
cd ../player-client && pnpm install && pnpm build
cd ..

# Configure environment
cp backend/.env.example backend/.env
nano backend/.env

# Install PM2 for process management
npm install -g pm2

# Start the backend
cd backend
pm2 start server.js --name dordroller
pm2 save
pm2 startup
```

**Recommended:** Use [Caddy](https://caddyserver.com/) or Nginx as a reverse proxy for HTTPS.

### 💻 Option 4: Local Development

For contributing or testing features.

**Prerequisites:**
- Node.js >= 18.0.0
- pnpm (`npm install -g pnpm`)
- PostgreSQL 14+

```bash
# Clone the repository
git clone https://github.com/misterbytes404/DordRoller.git
cd DordRoller

# Install dependencies
cd backend && pnpm install
cd ../gm-client && pnpm install
cd ../player-client && pnpm install
cd ..

# Set up PostgreSQL
# Create a database named 'dordroller'

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Start all services (in separate terminals)
cd backend && pnpm dev        # Terminal 1
cd gm-client && pnpm dev      # Terminal 2
cd player-client && pnpm dev  # Terminal 3
```

**Access:**
- Landing Page: http://localhost:3000
- GM Client: http://localhost:5173 (Vite dev server)
- Player Client: http://localhost:5175 (Vite dev server)

### ⚠️ Incompatible Platforms

Traditional shared hosting (GoDaddy, Bluehost, HostGator, cPanel) is **not supported** because:
- No Node.js runtime (or very limited)
- No WebSocket support (Socket.io requires persistent connections)
- No PostgreSQL (usually MySQL only)
- No Docker support

**Budget-friendly alternatives:**
- [Railway](https://railway.app/) - Free tier available
- [Render](https://render.com/) - Free tier available
- [Fly.io](https://fly.io/) - Free tier available
- Oracle Cloud Free Tier - Free VPS forever

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

## 🔑 Local Account Authentication

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
| **MVP 4** | 🧪 Testing | Database & Authentication |

### 📋 To Do

- [ ] Test Twitch OAuth & Local Auth flows end-to-end
- [ ] Deploy to Railway with PostgreSQL
- [ ] OBS Monster Display (show monster name & HP on stream)
- [ ] UI polish across all clients
- [ ] Room dashboard after login

### ✅ Completed

- [x] Twitch OAuth & Local Authentication
- [x] PostgreSQL database with character sheet persistence
- [x] GM dice roller with room broadcasting
- [x] Monster tracker with HP bars
- [x] Player character sheet (D&D 5e)
- [x] Quick roll buttons & combat dice system
- [x] GM Roll Log widget
- [x] Room-based session management

---

## 🐛 Known Issues

- **Export Download** — Modal opens but download doesn't trigger
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

