# Changelog

All notable changes to Dord Roller will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
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

### Changed
- Weapons section converted from simple inputs to full table
- Roll buttons use light text color (#e0e0e0) matching dark theme

### In Progress
- GM client roll feed display

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

