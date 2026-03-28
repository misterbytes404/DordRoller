# Full Plan: BG3-Inspired Dice Animation & Sound Effects (OBS Overlay)

## TL;DR
Add CSS 3D tumbling die animations and sound effects to the OBS overlay roll display. Each die type (d4, d6, d8, d10, d12, d20) gets a distinct stylized 3D shape that tumbles for ~2s before the result appears beneath it. Four sound slots (roll, reveal, nat20 fanfare, nat1 dread) stored in PostgreSQL BYTEA, tied to user's Twitch account for cross-room persistence. GM uploads custom sounds via overlay settings panel. Animation position configurable. Separate GM toggles for animation and sound.

## Design Notes
- **OBS overlay only** — GM hears via stream audio
- **Configurable position** via overlay settings (center / corners)
- **~2 second** tumble animation before result reveal
- **4 sound slots**: roll, reveal, nat20, nat1
- **PostgreSQL BYTEA** storage — Railway-compatible, no ephemeral filesystem dependency
- **User-scoped sounds** — tied to Twitch account, usable across all rooms
- **Separate toggles** in GM panel for animation on/off and sound on/off
- **No numbers on die faces** — result shown underneath the die
- **Stylized smooth CSS 3D** — not photorealistic, not Three.js
- **Graceful fallback** — no uploads = no sound, no errors

## Phases

### Phase 1: Database Schema & Sound Upload API
**Goal:** `user_sounds` table + multer-based upload/download/delete endpoints.

1. Add `user_sounds` table in `backend/config/database.js` initializeDatabase():
   ```
   user_sounds
   ├── id VARCHAR(16) PK
   ├── user_id VARCHAR(16) FK → users.id ON DELETE CASCADE
   ├── slot VARCHAR(10) CHECK (slot IN ('roll','reveal','nat20','nat1'))
   ├── data BYTEA NOT NULL
   ├── mime_type VARCHAR(50) NOT NULL
   ├── original_filename VARCHAR(255) NOT NULL
   ├── size_bytes INTEGER NOT NULL
   ├── created_at TIMESTAMP DEFAULT NOW()
   └── UNIQUE(user_id, slot)
   ```
2. Create `backend/models/UserSound.js` model:
   - `static async upsert(userId, slot, data, mimeType, filename, sizeBytes)` — INSERT … ON CONFLICT(user_id, slot) DO UPDATE
   - `static async getByUserAndSlot(userId, slot)` — returns row with BYTEA data
   - `static async delete(userId, slot)` — removes one sound
   - `static async listByUser(userId)` — returns [{slot, mime_type, original_filename, size_bytes}] (no data column for listing)
3. Create `backend/routes/sounds.js` route file:
   - `POST /api/sounds/:slot` (authenticateToken) — upload/replace sound
     - multer memoryStorage, single file, 1MB limit
     - Validate MIME: audio/mpeg, audio/ogg, audio/wav only
     - Validate slot param against enum
     - Call UserSound.upsert with req.file.buffer
   - `GET /api/sounds/:userId/:slot` — stream audio (public, no auth — OBS needs access)
     - Fetch from UserSound.getByUserAndSlot
     - Set Content-Type from mime_type, stream data
     - 404 if not found
   - `DELETE /api/sounds/:slot` (authenticateToken) — remove custom sound
   - `GET /api/sounds/me` (authenticateToken) — list current user's uploaded slots
4. Register route in `backend/server.js`: `app.use('/api', soundsRouter)`
5. Install `multer` in backend: add to package.json dependencies

**Files modified:**
- `backend/config/database.js` — add user_sounds CREATE TABLE
- `backend/models/UserSound.js` — NEW model
- `backend/routes/sounds.js` — NEW route file
- `backend/server.js` — register sounds route
- `backend/package.json` — add multer dependency

### Phase 2: Sound System in OBS Client
**Goal:** RollAudioPlayer class that loads sounds from API and plays during rolls.

1. In `obs-client/main.js`, add `RollAudioPlayer` class:
   - Constructor takes base URL and room owner userId
   - `loadSounds(userId)` — for each slot, try fetch `/api/sounds/{userId}/{slot}`
     - On success (200): create Audio object from blob URL (`URL.createObjectURL`)
     - On 404/error: set slot to null (silent no-op)
   - `play(slot)` — if slot loaded and enabled, clone audio node and play (allows overlapping)
   - `setEnabled(bool)` — master toggle
   - `setVolume(0-100)` — sets volume on all loaded Audio objects
   - `dispose()` — revoke blob URLs to prevent memory leaks
2. Determine room owner userId:
   - Backend already sends room data on join — include `owner_id` in room join response
   - OR: OBS client reads it from overlay settings payload (add owner_id there)
3. Integrate into displayRoll() flow:
   - On roll received: play 'roll' sound
   - After tumble completes (~2s): play 'reveal' sound
   - If nat 20: play 'nat20' instead of 'reveal'
   - If nat 1: play 'nat1' instead of 'reveal'
4. Reload sounds when overlay settings change (in case GM re-uploads)

**Files modified:**
- `obs-client/main.js` — add RollAudioPlayer, integrate into displayRoll, load on room join

### Phase 3: CSS 3D Die Shapes
**Goal:** Build CSS 3D die models for each die type.

1. Define die shapes in `obs-client/styles.css`:
   - **d4** (tetrahedron): 3-face CSS pyramid using triangular clip-paths
   - **d6** (cube): Classic CSS 3D cube, 6 faces with translateZ
   - **d8** (octahedron): Two 4-sided pyramids using rotated squares
   - **d10** (trapezohedron): Stylized pentagonal prism approximation
   - **d12** (dodecahedron): Stylized multi-face pentagonal approximation
   - **d20** (icosahedron): Stylized multi-face triangular approximation
2. Each die type gets `.die-3d.die-{type}` class
3. Faces: solid-colored with subtle gradient, golden edge highlights (--color-primary theme), no numbers
4. Common `.die-3d` base: width/height, transform-style: preserve-3d, perspective on container

**Files modified:**
- `obs-client/styles.css` — add .die-3d base + per-type shape definitions

### Phase 4: Tumble Animation Keyframes
**Goal:** Smooth multi-axis tumble (~2s), landing settle, result reveal.

1. Keyframe animations in `obs-client/styles.css`:
   - `@keyframes dieTumble` — multi-axis rotation, decelerating (2s)
   - `@keyframes dieSettle` — small bounce on landing (0.3s)
   - `@keyframes resultReveal` — fade in + slide up for result number (0.3s)
   - Enhanced `@keyframes resultNat20` — golden glow pulse + scale pop
   - Enhanced `@keyframes resultNat1` — red shake + glow
2. Timeline: 0-2s tumble → 2-2.3s settle → 2.3-2.6s result reveal → hold → 8s fade out

**Files modified:**
- `obs-client/styles.css` — add keyframes + animation classes

### Phase 5: Refactor displayRoll() with Animation Sequence
**Goal:** Orchestrate die creation, tumble, result reveal, and sound.

1. Restructure `displayRoll(rollData)` in `obs-client/main.js`:
   - Extract diceType from rollData
   - If animation enabled:
     a. Create die 3D element (based on diceType), insert into #die-animation-container
     b. Apply dieTumble animation
     c. Play 'roll' sound
     d. After 2s: apply dieSettle, play reveal/nat20/nat1 sound
     e. After settle: reveal result text below die
   - If animation disabled: show result immediately (preserve current behavior)
2. Fix existing bug: Apply .nat-20 / .nat-1 classes to #large-result (CSS exists, JS never applies them). Detect from individualRolls when diceType === 'd20' and quantity === 1.
3. Add `#die-animation-container` div in `obs-client/index.html` inside .roll-container (above #large-result)
4. Clean up die element on dismiss; cancel previous on rapid re-rolls

**Files modified:**
- `obs-client/main.js` — refactor displayRoll, die creation/cleanup, nat detection
- `obs-client/index.html` — add #die-animation-container div

### Phase 6: GM Overlay Settings — Toggles, Position, Upload UI
**Goal:** Roll Effects section with toggles + sound upload/manage UI.

1. In `overlaySettings.js` DEFAULTS add:
   - `rollAnimationEnabled: true`
   - `rollSoundEnabled: true`
   - `rollSoundVolume: 50`
   - `rollAnimationPosition: 'center'`
2. Add "Roll Effects" section to buildPanel():
   - Toggle: Roll Animation (on/off)
   - Toggle: Roll Sound (on/off)
   - Range: Volume (0-100)
   - Select: Position (center / top-left / top-right / bottom-left / bottom-right)
   - **Sound Upload sub-section** (4 rows, one per slot):
     - Label: "Roll Sound" / "Reveal Sound" / "Nat 20 Sound" / "Nat 1 Sound"
     - File input (accept="audio/*")
     - Status indicator: "No file" / filename
     - Upload button (sends to POST /api/sounds/:slot)
     - Clear button (sends DELETE /api/sounds/:slot)
   - Fetch current uploads on panel load via GET /api/sounds/me
3. Wire up bindControls() and updateControls()
4. In `backend/routes/rooms.js`: Add rollAnimationEnabled, rollSoundEnabled, rollSoundVolume, rollAnimationPosition to allowedKeys
5. In `obs-client/main.js` applySettings():
   - Update RollAudioPlayer enabled/volume
   - Apply position via CSS class on #roll-display
6. In `obs-client/styles.css`: Add position variant classes

**Files modified:**
- `gm-client/src/modules/overlaySettings.js` — DEFAULTS, buildPanel (Roll Effects + upload UI), bindControls, updateControls
- `backend/routes/rooms.js` — allowedKeys
- `obs-client/main.js` — applySettings integration
- `obs-client/styles.css` — position variant classes

### Phase 7: Polish & Verification
1. Test all 6 die types animate with distinct shapes
2. Test sound upload: upload .mp3, verify playback on next roll in OBS
3. Test sound graceful fallback: no uploads = no errors
4. Test clear sound: remove upload, confirm silent
5. Test cross-room persistence: upload in room A, create room B, sounds still available
6. Test nat 20 / nat 1 special effects (sound + visual)
7. Test GM toggles: animation off = instant result, sound off = silent
8. Test position settings: center, corners
9. Rapid-fire 5 rolls: each new roll cancels previous animation + sound
10. Test in OBS Browser Source at 1920x1080
11. Run snyk_code_scan on all modified/new files, fix issues, rescan until clean

## Relevant Files

**New files:**
- `backend/models/UserSound.js` — sound BYTEA storage model
- `backend/routes/sounds.js` — upload/download/delete/list endpoints

**Modified files:**
- `backend/config/database.js` — user_sounds table creation
- `backend/server.js` — register sounds route
- `backend/package.json` — add multer dependency
- `backend/routes/rooms.js` — allowedKeys additions
- `obs-client/main.js` — RollAudioPlayer class, displayRoll refactor, applySettings
- `obs-client/index.html` — add #die-animation-container div
- `obs-client/styles.css` — 3D die shapes, keyframes, position variants
- `gm-client/src/modules/overlaySettings.js` — DEFAULTS + Roll Effects section + upload UI

## Security Considerations
- multer memoryStorage with 1MB fileFilter (no temp files on disk)
- MIME type whitelist: audio/mpeg, audio/ogg, audio/wav only
- Slot param validated against enum — no path traversal
- authenticateToken required for upload/delete (session cookie auth)
- GET stream endpoint is public (OBS needs unauthenticated access) but only serves by userId+slot — no directory listing
- userId from authenticated session, never from request body (prevent IDOR)
- File size enforced at multer level AND validated before DB insert
