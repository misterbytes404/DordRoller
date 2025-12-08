# Changelog

All notable changes to Dord Roller will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Local Account Authentication** — Username/password registration
  - OWASP-compliant password requirements (8+ chars, upper, lower, number, special)
  - Secure password hashing with bcrypt (12 salt rounds)
  - Account lockout after 5 failed login attempts (15-minute lockout)
  - Rate limiting on auth endpoints (10 attempts per 15 minutes)
  - Input validation with `validator` library (XSS/SQL injection prevention)
  - Timing-safe password comparison to prevent enumeration attacks
  - Generic error messages to prevent user enumeration
- **Dual Authentication** — Users can choose Twitch SSO or local account
  - Same JWT-based session management for both auth types
  - Unified `/auth/me` endpoint returns user data regardless of auth type
  - `/auth/register` for new local accounts
  - `/auth/login` for local account authentication
- **Twitch OAuth Authentication** — SSO login via Twitch
  - Users sign in with Twitch account
  - Automatic account creation on first login
  - Twitch username becomes player name
  - JWT-based session management (7-day expiry)
  - Feature flag (`AUTH_ENABLED`) to enable/disable
  - Secure token handling (no hardcoded secrets)
- **User Accounts System** — Database-backed user management
  - Users table with Twitch ID, username, display name, avatar
  - User-to-room membership tracking
  - Role-based access (GM vs Player per room)
- **Room Naming** — Rooms now have names for easier identification
  - Create rooms with custom names
  - Update room names (GM only)
  - Room dropdown for users showing their joined rooms
- **Room Membership** — Track who's in each room
  - `room_members` table with user ID, room ID, role
  - Join rooms by code
  - Leave rooms
  - View room member list with roles
- **Landing Page** — Client selection portal
  - Choose between GM Client and Player Client
  - DarkLord color theme (amber/gold aesthetic)
  - Credits page with contributor sections
  - "Made for DarkLord_VT by Mister Bytes and the Shacolyte Community"
- **Credits Page** — Attribution for contributors
  - Sections for Project Lead, Artists, Audio, Community
  - Third-party resources list (Font Awesome, 5etools, Socket.IO)
  - Easy-to-update template for adding contributors
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
- **Save & Sync to Database** — Fixed Save & Sync button
  - Saves to PostgreSQL database (primary)
  - Keeps localStorage as backup
  - Loading spinner during save
  - Error handling with user feedback
  - Loads most recent sheet when joining room

### Changed
- Weapons section converted from simple inputs to full table
- Roll buttons use light text color (#e0e0e0) matching dark theme
- GM client layout redesigned — dice roller and roll log side-by-side
- Backend migrated from SQLite to PostgreSQL for Railway deployment

### Fixed
- **Save & Sync button now functional** — Saves to database with visual feedback
- Character sheet persistence now works across sessions

### Known Issues
- **Export download button not functional** — Modal shows but download doesn't trigger
- Event listeners for export button need debugging

### Planned
- Railway deployment with PostgreSQL addon
- Room persistence in database

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
| 0.3.0 | 2025-12-06 | Player Character Sheet |
| 0.2.0 | 2025-11-20 | GM Monster Tracker |
| 0.1.0 | 2025-11-15 | Initial Release — GM Dice Roller |

