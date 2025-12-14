# Changelog

All notable changes to Dord Roller will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Dev Branch & Branch Protection** — Set up development workflow for experimental features
  - Created `dev` branch for testing experimental features (e.g., custom assets)
  - Configured GitHub branch protection rules on `main`:
    - Require pull request before merging
    - Restrict updates to repository admin only
    - Block force pushes and deletions
  - Production (Railway) remains isolated — only deploys from `main`

---

## [1.1.0] - 2025-12-13

### Added

- **Custom Action Field** — When selecting "Other" from the Action dropdown in the dice roller, a text input appears allowing GMs to enter a custom action label (e.g., "Counterspell Check", "Wild Magic Surge") that displays on the OBS overlay
- **Dev/Prod Environment Setup** — Improved local development workflow
  - Vite proxy configuration forwards `/auth`, `/api`, and `/socket.io` requests to backend
  - Conditional base paths (`/` in dev, `/gm/` or `/player/` in production)
  - New `pnpm dev` command starts backend and GM client together
  - New `pnpm dev:all` command starts all three (backend, GM, and Player clients)
  - Hot module reloading works seamlessly with backend authentication

---

## [1.0.0] - 2025-12-12

🚀 **First Production Deployment on Railway**

### Added

- **Railway Deployment** — First production deployment on Railway platform
  - PostgreSQL database for persistent storage
  - Twitch OAuth authentication
  - Auto-deploy from GitHub main branch
- **Production URL Handling** — Dynamic base URLs work in both dev and production
  - Socket.io connections use `window.location.origin`
  - API calls use relative paths
  - Vite base paths configured for `/gm/` and `/player/`
- **Privacy Enhancement** — Removed email collection from Twitch OAuth
  - No longer requests `user:read:email` scope
  - Email not stored in database for Twitch users
- **Room Name Display (Player Client)** — Shows room name and code in a header bar after joining
- **URL Auto-Join (Player Client)** — Players can join rooms via `?room=CODE` parameter (matches GM client behavior)
- **Account Page Room Links** — Clicking a room from the account dropdown auto-joins with URL parameter

- **Docker Support** — Containerized deployment for easy self-hosting
  - Multi-stage Dockerfile builds all clients and bundles with backend
  - Single container serves everything (backend + GM/Player/OBS clients)
  - Docker Compose configuration with PostgreSQL included
  - Health check endpoint (`/api/health`) for container orchestration
  - Works on local, VPS, Railway, Render, Fly.io
- **Deployment Documentation** — Comprehensive guides for all platforms
  - Docker Compose (one-command deployment)
  - Railway (cloud PaaS with auto-deploy)
  - VPS deployment (with and without Docker)
  - Local development setup
  - Incompatible platform warnings (shared hosting)
- **Shorter Client URLs** — Cleaner paths for production
  - `/gm` instead of `/gm-client`
  - `/player` instead of `/player-client`
  - `/obs` instead of `/obs-client`
  - Legacy paths redirect automatically
- **User Authentication System** — Secure login with multiple providers
  - **Local accounts**: Username/password with OWASP-compliant requirements
  - **Twitch OAuth**: SSO login via Twitch account
  - Password hashing with bcrypt (12 salt rounds)
  - Account lockout after 5 failed attempts (15-minute cooldown)
  - Rate limiting on auth endpoints (10 attempts per 15 minutes)
  - JWT-based session management (7-day expiry)
  - Feature flag (`AUTH_ENABLED`) to enable/disable auth
- **User Accounts & Rooms** — Database-backed user and room management
  - Users table with Twitch ID, username, display name, avatar
  - Room naming with custom names (GM can update)
  - Room membership tracking with roles (GM vs Player)
  - Join/leave rooms by code
- **Landing Page** — Client selection portal
  - Choose between GM Client and Player Client
  - DarkLord color theme (amber/gold aesthetic)
  - Credits page with contributor sections
- **Monster Database Persistence** — Monsters saved to PostgreSQL
  - Monsters tied to rooms (deleted when room is deleted)
  - Full CRUD operations via REST API
  - Debounced HP saving (500ms) for combat efficiency
  - Quick Add button for rapid bestiary monster addition
- **GM Roll Log Widget** — Real-time feed of player rolls in GM client
  - Scrollable log showing player name, roll type, result, and timestamp
  - XSS-safe DOM rendering (Snyk security compliant)
  - Clear log button
  - Side-by-side layout with dice roller
- **HP Slider/Progress Bar** — Visual HP tracking in player client
  - Gradient color bar (green → yellow → red based on HP %)
  - Interactive slider for quick HP adjustment
  - Syncs with HP input fields
- **Magic Weapon Bonus** — "+X" bonus field in weapons table
  - Supports +1/+2/+3 magic weapons
  - Auto-adds to attack rolls
- **Live HP/AC Sync** — Automatic server sync on HP/AC changes
  - 300ms debounced sync to prevent spam
- **Character Sheet Export/Import** (Partial)
  - Export button with confirmation modal
  - Import from JSON file
  - Warning message before export
- **localStorage Persistence** — Character sheet saves locally
  - Auto-loads on page refresh
  - `populateFormFromCharacterSheet()` restores form state
- **Player Quick Roll Buttons** — d20 icons in character sheet for one-click rolls
  - Roll buttons for all 6 ability checks
  - Roll buttons for all 6 saving throws
  - Roll buttons for all 18 skills
  - Auto-calculates modifier from character sheet
  - Broadcasts to room (GM + OBS overlay)
  - Visual feedback with nat 20/nat 1 highlighting
- **Combat Dice Roller** — Full attack and damage roll system
  - Initiative roll button with auto Dex modifier
  - Weapon attack rolls (d20 + ability mod + proficiency)
  - Weapon ability selector (STR/DEX) for finesse weapons
  - **Damage Roll Modal** with advanced options:
    - Configurable base dice (count, type d4-d12, modifier)
    - Additional dice for sneak attack, divine smite, etc.
    - Critical hit toggle (doubles all dice)
    - Live roll preview showing full dice notation
    - Auto-parses damage notation from weapon field (e.g., "2d6+3")
- **Spell Combat Rolls** — Spell attack and damage system
  - Spell attack roll button (d20 + spell attack bonus)
  - Spell damage dice field with roll button
  - Uses same damage modal for flexibility
- **Floating Roll Toast** — Pop-up notification for roll results
  - Fixed position (top-right) visible without scrolling
  - Slide-in animation with auto-dismiss after 5-6 seconds
  - Nat 20/nat 1 visual highlighting (green/red glow)
  - Shows individual dice rolls for damage
  - Manual close button
- Font Awesome 6.5.1 integration for dice icons
- New `player_roll` socket event for player-initiated rolls
- **PostgreSQL Database Integration** — Server-side character persistence
  - PostgreSQL connection pool with SSL for production
  - Schema: `players`, `character_sheets` (JSONB), `rooms`, `room_players`
  - REST API endpoints:
    - `POST /api/players` - Create/get player
    - `GET /api/players/:id/sheets` - Get player's sheets
    - `POST /api/sheets` - Create character sheet
    - `GET /api/sheets/:id` - Get sheet by ID
    - `PUT /api/sheets/:id` - Update sheet
    - `DELETE /api/sheets/:id` - Delete sheet
  - Packages added: `pg`, `dotenv`
  - Environment configuration with `.env` file
  - Auto-creates database schema on startup

### Changed

- Weapons section converted from simple inputs to full table
- Roll buttons use light text color (#e0e0e0) matching dark theme
- GM client layout redesigned — dice roller and roll log side-by-side
- Backend migrated from SQLite to PostgreSQL for Railway deployment

### Fixed

- **Save & Sync button** — Now saves to PostgreSQL with visual feedback
- **Character sheet persistence** — Works across sessions via database
- **Player room persistence** — Fixed `Room.addPlayer()` → `Room.addMember()` method call
- **Character sheet save errors** — Added null-safe DOM element access throughout:
  - `loadCharacterSheet()` — No longer crashes on missing elements
  - `saveCharacterSheet()` — Uses helper functions for safe value retrieval
  - Form submit handler — Reuses null-safe save logic
- **Player tracking** — Now uses authenticated user ID instead of separate players table
- **Character sheet export/import** — Both features now fully functional
- **10-second save timeout** — Prevents infinite spinner on save operations
- **XSS Security Vulnerabilities** — Fixed multiple DOM-based XSS issues identified by Snyk:
  - Added `escapeHtml()` sanitization to monster tracker card rendering
  - Added `escapeHtml()` and `sanitizeAvatarUrl()` helpers to player client
  - Avatar URLs now whitelist-validated (Twitch, Gravatar, GitHub, Discord only)
  - Room names/codes escaped in profile modal
  - Socket IDs escaped in data attributes

### Removed

- **Roll Request Feature** — Removed from player client (GM client no longer has this capability)
  - Removed `#roll-section` UI with "Waiting for roll request..." display
  - Removed `assign_roll` socket handler and execute button
  - Removed `RollRequest` export from shared/events.js
  - Room info bar moved to character sheet section
- Deprecated `/api/players` endpoint (player tracking now uses auth system)

---

## [0.3.0] - 2025-12-06

### Added

- **Player Character Sheet** — Full D&D 5e interactive character sheet
  - Basic info section (name, class, level, race, alignment, XP)
  - Ability scores with automatic modifier calculations
  - Saving throws with proficiency tracking
  - All 18 skills with proficiency and expertise support
  - Combat stats (AC, HP, initiative, speed, hit dice)
  - Armor and weapons tracking (3 weapon slots)
  - Spellcasting section with:
    - Spellcasting class and ability display
    - Cantrips (8 slots)
    - Prepared spells organized by level (1st-9th)
    - Spell slots tracking (total/expended)
  - Equipment, features, and feats tabs
- Proficiency bonus auto-calculation based on level
- Initiative auto-calculation from Dexterity modifier

### Changed

- Player client UI restructured with two-column layout
- Saving throws repositioned to right column (between Abilities and Skills)

---

## [0.2.0] - 2025-11-20

### Added

- **GM Monster Tracker** — Search and track D&D 5e monsters
  - Bestiary search with monster data from 5etools JSON
  - HP bars with damage/heal controls
  - Monster stat display (AC, HP, speed, abilities)
- Room-based session management
  - Unique 6-character room codes
  - Players join via room codes
  - Auto-cleanup of empty rooms

### Fixed

- Monster type parsing for some bestiary entries (partial)

---

## [0.1.0] - 2025-11-15

### Added

- **GM Dice Roller** — Core dice rolling functionality
  - Roll d4, d6, d8, d10, d12, d20 with quantity (1-20)
  - Advantage and Disadvantage roll modes
  - Custom labels/actions for rolls
  - Modifier support
- **OBS Client** — Stream overlay browser source
  - Real-time dice roll display
  - WebSocket connection to backend
- **Backend Server** — Node.js/Express/Socket.io
  - Room creation and joining
  - Real-time roll broadcasting
  - Health check endpoint
- Basic project structure with shared utilities

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.4.0 | TBD | User Auth & Docker Deployment |
| 0.3.0 | 2025-12-06 | Player Character Sheet |
| 0.2.0 | 2025-11-20 | GM Monster Tracker |
| 0.1.0 | 2025-11-15 | Initial Release — GM Dice Roller |

