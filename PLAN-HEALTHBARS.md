# Plan: JRPG Health Bars on OBS Overlay

## TL;DR
Add Persona-inspired health bars to the OBS overlay that display real-time HP for both players and monsters. Requires new socket events for HP broadcasting (current architecture only saves monster HP to DB, no socket broadcast), a new GM control panel section for overlay settings, and a full CSS/JS health bar component in the OBS client with trailing ghost-bar damage animation.

## Architecture Gap (Critical)
- **Monster HP**: GM slider → REST PATCH `/api/monsters/:id/hp` → database only. **No socket event emitted.** OBS cannot receive monster HP changes.
- **Player HP**: Player client → `player_sync` socket event → server stores in memory → broadcasts `player_list_update` to **GM only** (not room-wide). OBS cannot receive player HP changes.
- **OBS client**: Currently only listens for `broadcast_roll` events. Has no concept of entities, HP, or persistent state.

---

## Steps

### Phase 1: Socket Infrastructure (Backend + Shared)
*Establishes the real-time data pipeline for HP changes to reach the OBS client.*

1. **Add new socket events to `shared/events.js`**
   - `BROADCAST_HP_UPDATE` — server → all room clients (HP change for a single entity)
   - `BROADCAST_ENTITY_LIST` — server → all room clients (full list of tracked entities with HP)
   - `OVERLAY_SETTINGS_UPDATE` — server → OBS clients (GM overlay config: colors, toggles, position)
   - `REQUEST_ENTITY_LIST` — OBS client → server (request current state on connect)

2. **Update `backend/sockets/socketHandler.js`** — *depends on step 1*
   - Add listener for `monster_hp_update` from GM client: receives `{ roomCode, monsterId, name, hp, hpMax }`, broadcasts `BROADCAST_HP_UPDATE` to room
   - Add listener for `overlay_settings_update` from GM client: receives overlay config, stores in room state, broadcasts `OVERLAY_SETTINGS_UPDATE` to room
   - Modify existing `player_sync` handler: after updating player data AND calling `broadcastPlayerList()`, also emit `BROADCAST_HP_UPDATE` to room with player HP data
   - Add listener for `request_entity_list`: sends current full entity list (all monsters + players with HP) back to requesting socket
   - Store overlay settings in room object: `rooms[roomCode].overlaySettings = { ... }`

3. **Update `backend/routes/monsters.js` PATCH endpoint** — *parallel with step 2*
   - After DB update succeeds, emit socket event to the room (requires passing `io` instance to route or using a shared event emitter). Alternative: skip this and have the GM client emit the socket event directly after REST call succeeds (simpler, preferred).

### Phase 2: GM Client — HP Socket Emission
*Makes the GM client broadcast HP changes over sockets.*

4. **Update `gm-client/src/modules/monsterTracker.js`** — *depends on step 1*
   - In the HP slider `input` event handler: after updating local state and debouncing DB save, also emit `monster_hp_update` socket event to server with `{ roomCode, monsterId, name, hp, hpMax }`
   - Debounce socket emission separately from DB save (100ms for socket vs 500ms for DB) — socket should be faster for real-time feel
   - On monster add/delete, emit `monster_list_changed` so OBS can add/remove bars

5. **Player client HP emission already works** via `player_sync` — backend changes in step 2 handle broadcasting to OBS. No player-client changes needed.

### Phase 3: GM Client — Overlay Controls UI
*Adds the GM control panel for OBS overlay settings.*

6. **Add overlay settings section to GM client** — *parallel with Phase 2*
   - New module: `gm-client/src/modules/overlaySettings.js`
   - UI section in GM client (collapsible panel like monster tracker) with:
     - **Toggle**: Show/hide health bars on OBS overlay
     - **Toggle**: Show/hide entity names
     - **Toggle**: Show/hide HP numbers
     - **Color picker**: Primary bar color (default: theme gold `#f0a500`)
     - **Color picker**: Low HP color (default: red `#c41e3a`)
     - **Color picker**: Ghost bar color (default: slightly lighter than primary)
   - On any setting change, emit `overlay_settings_update` socket event to server
   - Settings stored in localStorage for persistence across page reloads

7. **Update `gm-client/src/main.js`** — *depends on step 6*
   - Import and initialize `OverlaySettings` module
   - Add HTML section for overlay controls in `gm-client/index.html` (or via JS DOM creation, matching existing pattern)

### Phase 4: OBS Client — Health Bar Rendering
*The visual implementation — Persona-style health bars on the overlay.*

8. **Update `obs-client/index.html`** — *depends on steps 1-2*
   - Add `#health-bar-container` div (positioned via CSS, separate from `#roll-overlay`)
   - Container holds dynamically created health bar elements

9. **Update `obs-client/main.js`** — *depends on steps 1-2, 8*
   - **URL params**: Parse `?position=bottom|left|right|top` (default: `bottom`)
   - **State management**: Maintain local entity map `{ [entityId]: { name, hp, hpMax, previousHp, type } }`
   - **Socket listeners**:
     - `BROADCAST_HP_UPDATE` → update single entity, trigger animation
     - `BROADCAST_ENTITY_LIST` → rebuild full entity list
     - `OVERLAY_SETTINGS_UPDATE` → apply GM settings (colors, visibility toggles)
   - **On connect**: emit `request_entity_list` to get current state
   - **`renderHealthBar(entity)` function**:
     - Creates/updates a bar element for the entity
     - Persona-style: sharp angled container, bold name text, HP numbers overlay
     - Two layered bars: ghost bar (previous HP) behind actual bar (current HP)
   - **Animation logic**:
     - On HP decrease: actual bar slides to new value immediately (CSS transition ~300ms), ghost bar holds for 500ms then drains smoothly (CSS transition ~800ms)
     - On HP increase (healing): actual bar slides up, no ghost bar effect
     - On entity death (HP=0): bar drains fully, greyed out with subtle pulse
   - **Color interpolation**: Calculate bar color based on HP% — green (#4ade80) at 100%, yellow (#facc15) at 50%, red (#ef4444) at 25%, matching theme glow
   - **Entity removal**: When monster deleted or player disconnects, bar fades out and removes from DOM

10. **Update `obs-client/styles.css`** — *parallel with step 9*
    - **Persona-inspired design language**:
      - Skewed/angled bar containers (CSS `transform: skewX(-5deg)`)
      - High contrast: dark background with vivid colored bars
      - Bold sans-serif font for names/numbers
      - Glow effects matching existing theme (`box-shadow` with color glow)
      - Sharp edges, not rounded corners
    - **Position variants**: CSS classes for `.position-bottom`, `.position-left`, `.position-right`, `.position-top`
      - Bottom: horizontal row along bottom edge
      - Left/Right: vertical stack along side
      - Top: horizontal row along top edge
    - **Bar structure CSS**:
      - `.health-bar-entity` — outer container per entity
      - `.health-bar-name` — entity name label
      - `.health-bar-track` — dark background track
      - `.health-bar-ghost` — ghost/trailing damage bar (absolute positioned behind main bar)
      - `.health-bar-fill` — actual HP bar (absolute positioned)
      - `.health-bar-numbers` — HP text overlay (centered on bar)
    - **Animations**:
      - `@keyframes ghostDrain` — delayed drain for ghost bar
      - `@keyframes barPulse` — subtle pulse on HP change
      - `@keyframes deathFade` — grey-out + fade for 0 HP
      - Smooth CSS transitions on `width` property for bar fill changes
    - **Responsive**: Bars scale based on entity count (fewer entities = larger bars)

### Phase 5: Integration & Polish

11. **Handle edge cases** — *depends on steps 4, 9*
    - OBS client joins mid-session: `request_entity_list` fetches current state
    - GM changes room: overlay clears and re-fetches
    - Player disconnects: bar shows "offline" state or fades
    - Monster deleted: bar animates out
    - Multiple rapid HP changes: debounce rendering, always use latest value

12. **Ensure roll display and health bars coexist** — *depends on step 9*
    - Roll display (`#roll-display`) remains center-screen
    - Health bars positioned around edges, never overlapping roll display
    - Z-index layering: health bars below, roll display above

---

## Relevant Files

### Must Modify
- `shared/events.js` — add new socket event constants
- `backend/sockets/socketHandler.js` — add HP broadcast listeners, overlay settings relay, entity list request handler
- `gm-client/src/modules/monsterTracker.js` — emit socket events on HP slider change and monster add/delete
- `gm-client/src/main.js` — initialize overlay settings module, add HTML section
- `obs-client/index.html` — add health bar container div
- `obs-client/main.js` — entity state, socket listeners, health bar rendering, URL param parsing
- `obs-client/styles.css` — full Persona-style health bar CSS with animations and position variants

### Must Create
- `gm-client/src/modules/overlaySettings.js` — new module for GM overlay control panel (color pickers, toggles)

### Reference Only
- `gm-client/src/modules/playerTracker.js` — reference for how GM tracks player state (uses `player_list_update` pattern)
- `gm-client/src/modules/diceRoller.js` — reference for existing socket emit pattern with `gm_roll`
- `gm-client/src/modules/rollLog.js` — reference for GM module pattern

---

## Verification

1. **Socket flow test**: GM moves monster HP slider → check browser console on OBS client for received `BROADCAST_HP_UPDATE` event with correct data
2. **Player HP flow test**: Player changes HP in character sheet → verify OBS client receives updated HP via `BROADCAST_HP_UPDATE`
3. **OBS visual test**: Open OBS client in browser with `?room=TESTROOM&position=bottom` → verify health bars render with correct Persona styling
4. **Ghost bar animation test**: Rapidly decrease a monster's HP → verify ghost bar holds then drains behind the actual bar
5. **Color test**: Use GM color picker to change bar colors → verify OBS overlay updates in real-time
6. **Toggle test**: GM toggles names off → verify OBS hides entity names; toggle HP numbers off → verify numbers hidden
7. **Position test**: Load OBS client with `?position=left`, `?position=right`, `?position=top` → verify correct placement
8. **Reconnect test**: Refresh OBS client mid-session → verify it receives full entity list and renders current state
9. **Coexistence test**: Trigger a dice roll while health bars are visible → verify roll popup appears above bars without conflicts
10. **Edge case test**: Delete a monster in GM client → verify bar animates out on OBS; player disconnects → verify bar shows offline/fades

---

## Decisions
- **Socket vs REST for HP broadcast**: GM client emits socket event directly (not piggybacked on REST response) — simpler, avoids coupling route layer to socket layer
- **Debounce strategy**: Socket emit at 100ms (fast for real-time), DB save at 500ms (existing) — separate timers
- **No database persistence for overlay settings**: Stored in GM client localStorage + relayed via socket. OBS requests on connect. This avoids schema changes.
- **Player HP source**: Reuse existing `player_sync` flow — backend modification broadcasts to room, not just GM
- **Persona style specifics**: Skewed containers, sharp angles, bold fonts, high contrast, glow effects — NOT rounded/soft UI
- **URL params for position only**: Color/toggle customization lives in GM UI, not URL params (per user choice)

## Further Considerations
1. **Monster visibility to players**: Currently monster HP is only visible to GM. Broadcasting to OBS means stream viewers see monster HP. This is likely intentional (stream feature), but worth confirming.
2. **Max entity count**: With many monsters + players, bars could get very small. Consider a max display count (e.g., 8-10) or scrolling/paging. Recommendation: cap at ~10 visible bars, newest entities take priority.
3. **Party vs Enemy grouping**: Should player bars and monster bars be visually separated (e.g., players on left, monsters on right in Persona style)?  Recommendation: Yes, group them with a subtle visual separator.
