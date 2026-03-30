// Overlay Settings — GM controls for OBS health bar overlay

const API_URL = `${window.location.origin}/api`;

const DEFAULTS = {
  enabled: false,
  showNames: true,
  showHpNumbers: true,
  partyPosition: 'top-left',
  enemyPosition: 'top-right',
  opacity: 100,
  fontFamily: 'Segoe UI',
  fontSize: 16,
  primaryColor: '#f0a500',
  lowHpColor: '#c41e3a',
  ghostBarColor: '#f0c760',
  headerColor: '#f0a500',
  headerFont: 'Segoe UI',
  headerFontSize: 18,
  monsterNameColor: '#ffffff',
  playerNameColor: '#ffffff',
  playerTagFont: 'Segoe UI',
  playerTagFontSize: 12,
  playerTagColor: '#aaaaaa',
  rollSoundEnabled: true,
  rollSoundVolume: 50,
  hiddenEntities: []
};

const FONT_OPTIONS = [
  { value: 'Segoe UI', label: 'Segoe UI', style: "font-family: 'Segoe UI', sans-serif" },
  { value: 'Press Start 2P', label: 'Press Start 2P', style: "font-family: 'Press Start 2P', cursive; font-size: 0.7em" },
  { value: 'Rajdhani', label: 'Rajdhani', style: "font-family: 'Rajdhani', sans-serif" },
  { value: 'Oswald', label: 'Oswald', style: "font-family: 'Oswald', sans-serif" },
  { value: 'Bebas Neue', label: 'Bebas Neue', style: "font-family: 'Bebas Neue', cursive" },
  { value: 'Cinzel', label: 'Cinzel', style: "font-family: 'Cinzel', serif" }
];

export class OverlaySettings {
  constructor(socket, getRoomCode, getMonsters) {
    this.socket = socket;
    this.getRoomCode = getRoomCode;
    this.getMonsters = getMonsters || (() => []);
    this.roomId = null;
    this.settings = { ...DEFAULTS, hiddenEntities: [...DEFAULTS.hiddenEntities] };
    this.saveTimer = null;
    this.entities = [];
    this.init();
  }

  init() {
    this.buildPanel();
    this.setupToolbarToggle();
    this.setupEntityListListener();
  }

  setRoomId(roomId) {
    this.roomId = roomId;
    if (roomId) {
      this.loadFromDatabase();
    } else {
      this.settings = { ...DEFAULTS, hiddenEntities: [...DEFAULTS.hiddenEntities] };
      this.entities = [];
      this.updateControls();
      this.renderEntityList();
    }
  }

  async loadFromDatabase() {
    if (!this.roomId) return;
    try {
      const response = await fetch(`${API_URL}/rooms/${this.roomId}/overlay-settings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const dbSettings = await response.json();
        this.settings = {
          ...DEFAULTS,
          ...dbSettings,
          hiddenEntities: Array.isArray(dbSettings.hiddenEntities) ? [...dbSettings.hiddenEntities] : []
        };
      }
    } catch (error) {
      console.error('Failed to load overlay settings:', error);
    }
    this.updateControls();
    this.emitSettings();
  }

  async saveToDatabase() {
    if (!this.roomId) return;
    try {
      await fetch(`${API_URL}/rooms/${this.roomId}/overlay-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(this.settings)
      });
    } catch (error) {
      console.error('Failed to save overlay settings:', error);
    }
  }

  emitSettings() {
    if (this.socket && this.getRoomCode) {
      const roomCode = this.getRoomCode();
      if (roomCode) {
        this.socket.emit('overlay_settings_update', {
          roomCode,
          settings: this.settings
        });
      }
    }
  }

  onSettingChanged() {
    this.emitSettings();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDatabase(), 500);
  }

  setupEntityListListener() {
    if (!this.socket) return;
    this.socket.on('broadcast_entity_list', (entities) => {
      this.entities = entities || [];
      this.renderEntityList();
    });
    this.socket.on('broadcast_hp_update', (entity) => {
      const idx = this.entities.findIndex(e => e.id === entity.id);
      if (idx >= 0) {
        this.entities[idx] = { ...this.entities[idx], ...entity };
      } else {
        this.entities.push(entity);
      }
      this.renderEntityList();
    });
  }

  setupToolbarToggle() {
    const btn = document.getElementById('overlay-settings-btn');
    const dropdown = document.getElementById('overlay-settings-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      document.querySelectorAll('.toolbar-dropdown.open').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('.toolbar-btn.active').forEach(b => b.classList.remove('active'));
      if (!isOpen) {
        dropdown.classList.add('open');
        btn.classList.add('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#overlay-settings-toolbar-item')) {
        dropdown.classList.remove('open');
        btn.classList.remove('active');
      }
    });
  }

  buildPanel() {
    const panel = document.getElementById('overlay-settings-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="overlay-settings-grid">
        <!-- Toggles -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-toggle-on"></i> Display</h4>
          <div class="setting-row">
            <label for="overlay-enabled">Enable Health Bars</label>
            <label class="toggle-switch">
              <input type="checkbox" id="overlay-enabled">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <label for="overlay-show-names">Show Names</label>
            <label class="toggle-switch">
              <input type="checkbox" id="overlay-show-names" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <label for="overlay-show-hp">Show HP Numbers</label>
            <label class="toggle-switch">
              <input type="checkbox" id="overlay-show-hp" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Layout — Position Pickers -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-arrows-up-down-left-right"></i> Layout</h4>
          <div class="setting-row">
            <label>Party Position</label>
            <div class="position-picker" id="party-position-picker">
              <div class="position-rect">
                <button type="button" class="position-dot" data-value="top-left" title="Top Left"></button>
                <button type="button" class="position-dot" data-value="top-right" title="Top Right"></button>
                <button type="button" class="position-dot" data-value="bottom-left" title="Bottom Left"></button>
                <button type="button" class="position-dot" data-value="bottom-right" title="Bottom Right"></button>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <label>Enemy Position</label>
            <div class="position-picker" id="enemy-position-picker">
              <div class="position-rect">
                <button type="button" class="position-dot" data-value="top-left" title="Top Left"></button>
                <button type="button" class="position-dot" data-value="top-right" title="Top Right"></button>
                <button type="button" class="position-dot" data-value="bottom-left" title="Bottom Left"></button>
                <button type="button" class="position-dot" data-value="bottom-right" title="Bottom Right"></button>
              </div>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-opacity">Opacity: <span id="overlay-opacity-value">100%</span></label>
            <input type="range" id="overlay-opacity" min="10" max="100" value="100" step="5">
          </div>
        </div>

        <!-- Typography -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-font"></i> Typography</h4>
          <div class="setting-row setting-row-stacked">
            <label for="overlay-font-family">Bar Font</label>
            <select id="overlay-font-family">
              ${FONT_OPTIONS.map(f =>
                `<option value="${f.value}" style="${f.style}">${f.label}</option>`
              ).join('')}
            </select>
            <div class="font-preview" id="overlay-font-preview">
              <span>Goblin King — HP 45/120</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-font-size">Bar Size: <span id="overlay-font-size-value">16px</span></label>
            <input type="range" id="overlay-font-size" min="12" max="32" value="16" step="1">
          </div>
          <div class="setting-row setting-row-stacked">
            <label for="overlay-header-font">Header Font</label>
            <select id="overlay-header-font">
              ${FONT_OPTIONS.map(f =>
                `<option value="${f.value}" style="${f.style}">${f.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="setting-row">
            <label for="overlay-header-font-size">Header Size: <span id="overlay-header-font-size-label">18px</span></label>
            <input type="range" id="overlay-header-font-size" min="10" max="48" step="1" value="18">
          </div>
          <div class="setting-row setting-row-stacked">
            <label for="overlay-player-tag-font">Player Tag Font</label>
            <select id="overlay-player-tag-font">
              ${FONT_OPTIONS.map(f =>
                `<option value="${f.value}" style="${f.style}">${f.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="setting-row">
            <label for="overlay-player-tag-font-size">Player Tag Size: <span id="overlay-player-tag-font-size-label">12px</span></label>
            <input type="range" id="overlay-player-tag-font-size" min="8" max="24" step="1" value="12">
          </div>
        </div>

        <!-- Colors -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-palette"></i> Colors</h4>
          <div class="setting-row">
            <label for="overlay-primary-color">Primary Bar</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-primary-color" value="#f0a500">
              <span class="color-hex" id="overlay-primary-color-hex">#f0a500</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-low-hp-color">Low HP</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-low-hp-color" value="#c41e3a">
              <span class="color-hex" id="overlay-low-hp-color-hex">#c41e3a</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-ghost-color">Ghost Bar</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-ghost-color" value="#f0c760">
              <span class="color-hex" id="overlay-ghost-color-hex">#f0c760</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-header-color">Header Text</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-header-color" value="#f0a500">
              <span class="color-hex" id="overlay-header-color-hex">#f0a500</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-monster-name-color">Monster Names</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-monster-name-color" value="#ffffff">
              <span class="color-hex" id="overlay-monster-name-color-hex">#ffffff</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-player-name-color">Player Names</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-player-name-color" value="#ffffff">
              <span class="color-hex" id="overlay-player-name-color-hex">#ffffff</span>
            </div>
          </div>
          <div class="setting-row">
            <label for="overlay-player-tag-color">Player Tag</label>
            <div class="color-picker-wrapper">
              <input type="color" id="overlay-player-tag-color" value="#aaaaaa">
              <span class="color-hex" id="overlay-player-tag-color-hex">#aaaaaa</span>
            </div>
          </div>
        </div>

        <!-- Roll Sound -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-volume-high"></i> Roll Sound</h4>
          <div class="setting-row">
            <label for="overlay-roll-sound">Enable Roll Sound</label>
            <label class="toggle-switch">
              <input type="checkbox" id="overlay-roll-sound" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <label for="overlay-roll-volume">Volume: <span id="overlay-roll-volume-value">50%</span></label>
            <input type="range" id="overlay-roll-volume" min="0" max="100" value="50" step="5">
          </div>
        </div>

        <!-- Visible Entities -->
        <div class="settings-group">
          <h4><i class="fa-solid fa-eye"></i> Visible Entities</h4>
          <div id="entity-list-container" class="entity-list-container">
            <p class="entity-list-empty">No entities in room yet</p>
          </div>
        </div>

        <!-- Save / Load / Sync -->
        <div class="settings-group">
          <div class="settings-button-row">
            <button id="overlay-save-defaults-btn" class="overlay-action-btn" type="button" title="Save current settings as your account default">
              <i class="fa-solid fa-floppy-disk"></i> Save as Default
            </button>
            <button id="overlay-load-defaults-btn" class="overlay-action-btn" type="button" title="Load your saved default settings into this room">
              <i class="fa-solid fa-download"></i> Load Saved Settings
            </button>
          </div>
          <button id="overlay-sync-btn" class="overlay-sync-btn" type="button">
            <i class="fa-solid fa-arrows-rotate"></i> Sync Overlay
          </button>
        </div>
      </div>
    `;

    this.bindControls();
  }

  bindControls() {
    this.bindToggle('overlay-enabled', 'enabled');
    this.bindToggle('overlay-show-names', 'showNames');
    this.bindToggle('overlay-show-hp', 'showHpNumbers');

    this.bindPositionPicker('party-position-picker', 'partyPosition');
    this.bindPositionPicker('enemy-position-picker', 'enemyPosition');

    this.bindRange('overlay-opacity', 'opacity', (v) => {
      document.getElementById('overlay-opacity-value').textContent = `${v}%`;
    });

    const fontSelect = document.getElementById('overlay-font-family');
    if (fontSelect) {
      fontSelect.addEventListener('change', () => {
        this.settings.fontFamily = fontSelect.value;
        this.updateFontPreview();
        this.onSettingChanged();
      });
    }

    this.bindRange('overlay-font-size', 'fontSize', (v) => {
      document.getElementById('overlay-font-size-value').textContent = `${v}px`;
      this.updateFontPreview();
    });

    this.bindColor('overlay-primary-color', 'primaryColor', 'overlay-primary-color-hex');
    this.bindColor('overlay-low-hp-color', 'lowHpColor', 'overlay-low-hp-color-hex');
    this.bindColor('overlay-ghost-color', 'ghostBarColor', 'overlay-ghost-color-hex');
    this.bindColor('overlay-header-color', 'headerColor', 'overlay-header-color-hex');
    this.bindColor('overlay-monster-name-color', 'monsterNameColor', 'overlay-monster-name-color-hex');
    this.bindColor('overlay-player-name-color', 'playerNameColor', 'overlay-player-name-color-hex');
    this.bindColor('overlay-player-tag-color', 'playerTagColor', 'overlay-player-tag-color-hex');

    const headerFontSelect = document.getElementById('overlay-header-font');
    if (headerFontSelect) {
      headerFontSelect.addEventListener('change', () => {
        this.settings.headerFont = headerFontSelect.value;
        this.onSettingChanged();
      });
    }

    this.bindRange('overlay-header-font-size', 'headerFontSize', (v) => {
      document.getElementById('overlay-header-font-size-label').textContent = `${v}px`;
    });

    const playerTagFontSelect = document.getElementById('overlay-player-tag-font');
    if (playerTagFontSelect) {
      playerTagFontSelect.addEventListener('change', () => {
        this.settings.playerTagFont = playerTagFontSelect.value;
        this.onSettingChanged();
      });
    }

    this.bindRange('overlay-player-tag-font-size', 'playerTagFontSize', (v) => {
      document.getElementById('overlay-player-tag-font-size-label').textContent = `${v}px`;
    });

    this.bindToggle('overlay-roll-sound', 'rollSoundEnabled');
    this.bindRange('overlay-roll-volume', 'rollSoundVolume', (v) => {
      document.getElementById('overlay-roll-volume-value').textContent = `${v}%`;
    });

    const syncBtn = document.getElementById('overlay-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncOverlay());
    }

    const saveDefaultsBtn = document.getElementById('overlay-save-defaults-btn');
    if (saveDefaultsBtn) {
      saveDefaultsBtn.addEventListener('click', () => this.saveDefaults());
    }

    const loadDefaultsBtn = document.getElementById('overlay-load-defaults-btn');
    if (loadDefaultsBtn) {
      loadDefaultsBtn.addEventListener('click', () => this.loadDefaults());
    }
  }

  async saveDefaults() {
    const btn = document.getElementById('overlay-save-defaults-btn');
    try {
      if (btn) btn.disabled = true;
      const { hiddenEntities, ...settingsToSave } = this.settings;
      const response = await fetch(`${API_URL}/users/me/overlay-defaults`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settingsToSave)
      });
      if (response.ok) {
        if (btn) {
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
          setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save as Default'; }, 2000);
        }
      } else if (response.status === 401) {
        alert('You must be logged in to save defaults.');
      } else {
        alert('Failed to save defaults.');
      }
    } catch (error) {
      console.error('Error saving overlay defaults:', error);
      alert('Failed to save defaults.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async loadDefaults() {
    const btn = document.getElementById('overlay-load-defaults-btn');
    try {
      if (btn) btn.disabled = true;
      const response = await fetch(`${API_URL}/users/me/overlay-defaults`, {
        credentials: 'include'
      });
      if (response.ok) {
        const defaults = await response.json();
        this.settings = {
          ...DEFAULTS,
          ...defaults,
          hiddenEntities: [...(this.settings.hiddenEntities || [])]
        };
        this.updateControls();
        this.onSettingChanged();
        if (btn) {
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Loaded!';
          setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-download"></i> Load Saved Settings'; }, 2000);
        }
      } else if (response.status === 404) {
        alert('No saved defaults found. Save your current settings first.');
      } else if (response.status === 401) {
        alert('You must be logged in to load defaults.');
      } else {
        alert('Failed to load defaults.');
      }
    } catch (error) {
      console.error('Error loading overlay defaults:', error);
      alert('Failed to load defaults.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  syncOverlay() {
    const roomCode = this.getRoomCode();
    if (!this.socket || !roomCode) return;

    const monsters = this.getMonsters().map(m => ({
      id: m.id,
      name: m.name,
      hp: m.hp,
      hpMax: m.hpMax
    }));

    this.socket.emit('sync_entity_list', { roomCode, monsters });
    this.emitSettings();
  }

  bindPositionPicker(pickerId, settingsKey) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    picker.querySelectorAll('.position-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        picker.querySelectorAll('.position-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.settings[settingsKey] = dot.dataset.value;
        this.onSettingChanged();
      });
    });
  }

  bindToggle(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      this.settings[key] = el.checked;
      this.onSettingChanged();
    });
  }

  bindRange(id, key, onInput) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      this.settings[key] = Number(el.value);
      if (onInput) onInput(el.value);
      this.onSettingChanged();
    });
  }

  bindColor(id, key, hexId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      this.settings[key] = el.value;
      const hexEl = document.getElementById(hexId);
      if (hexEl) hexEl.textContent = el.value;
      this.onSettingChanged();
    });
  }

  renderEntityList() {
    const container = document.getElementById('entity-list-container');
    if (!container) return;

    if (this.entities.length === 0) {
      container.innerHTML = '<p class="entity-list-empty">No entities in room yet</p>';
      return;
    }

    const players = this.entities.filter(e => e.type === 'player');
    const monsters = this.entities.filter(e => e.type === 'monster');
    const hiddenSet = new Set(this.settings.hiddenEntities || []);

    let html = '';
    if (players.length > 0) {
      html += '<div class="entity-group-label">Party</div>';
      players.forEach(e => {
        const isVisible = !hiddenSet.has(e.id);
        html += `
          <div class="entity-toggle-row">
            <span class="entity-toggle-name">${this.escapeHtml(e.name)}</span>
            <span class="entity-toggle-hp">${e.hp}/${e.hpMax}</span>
            <button type="button" class="entity-visibility-btn ${isVisible ? 'visible' : 'hidden'}"
              data-entity-id="${this.escapeAttr(e.id)}" title="${isVisible ? 'Hide' : 'Show'}">
              <i class="fa-solid ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
            </button>
          </div>`;
      });
    }
    if (monsters.length > 0) {
      html += '<div class="entity-group-label">Enemies</div>';
      monsters.forEach(e => {
        const isVisible = !hiddenSet.has(e.id);
        html += `
          <div class="entity-toggle-row">
            <span class="entity-toggle-name">${this.escapeHtml(e.name)}</span>
            <span class="entity-toggle-hp">${e.hp}/${e.hpMax}</span>
            <button type="button" class="entity-visibility-btn ${isVisible ? 'visible' : 'hidden'}"
              data-entity-id="${this.escapeAttr(e.id)}" title="${isVisible ? 'Hide' : 'Show'}">
              <i class="fa-solid ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
            </button>
          </div>`;
      });
    }

    container.innerHTML = html;

    container.querySelectorAll('.entity-visibility-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const entityId = btn.dataset.entityId;
        const idx = this.settings.hiddenEntities.indexOf(entityId);
        if (idx >= 0) {
          this.settings.hiddenEntities.splice(idx, 1);
        } else {
          this.settings.hiddenEntities.push(entityId);
        }
        this.renderEntityList();
        this.onSettingChanged();
      });
    });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  updateFontPreview() {
    const preview = document.getElementById('overlay-font-preview');
    if (preview) {
      preview.style.fontFamily = `'${this.settings.fontFamily}', sans-serif`;
      preview.style.fontSize = `${this.settings.fontSize}px`;
    }
  }

  updateControls() {
    const s = this.settings;

    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

    setChecked('overlay-enabled', s.enabled);
    setChecked('overlay-show-names', s.showNames);
    setChecked('overlay-show-hp', s.showHpNumbers);
    setVal('overlay-opacity', s.opacity);
    setVal('overlay-font-family', s.fontFamily);
    setVal('overlay-font-size', s.fontSize);
    setVal('overlay-primary-color', s.primaryColor);
    setVal('overlay-low-hp-color', s.lowHpColor);
    setVal('overlay-ghost-color', s.ghostBarColor);
    setVal('overlay-header-color', s.headerColor);
    setVal('overlay-monster-name-color', s.monsterNameColor);
    setVal('overlay-player-name-color', s.playerNameColor);
    setVal('overlay-header-font', s.headerFont);
    setVal('overlay-header-font-size', s.headerFontSize);
    setVal('overlay-player-tag-font', s.playerTagFont);
    setVal('overlay-player-tag-font-size', s.playerTagFontSize);
    setVal('overlay-player-tag-color', s.playerTagColor);
    setChecked('overlay-roll-sound', s.rollSoundEnabled);
    setVal('overlay-roll-volume', s.rollSoundVolume);
    const rollVolLabel = document.getElementById('overlay-roll-volume-value');
    if (rollVolLabel) rollVolLabel.textContent = `${s.rollSoundVolume}%`;

    const headerSizeLabel = document.getElementById('overlay-header-font-size-label');
    if (headerSizeLabel) headerSizeLabel.textContent = `${s.headerFontSize}px`;

    this.updatePositionPicker('party-position-picker', s.partyPosition);
    this.updatePositionPicker('enemy-position-picker', s.enemyPosition);

    const opacityLabel = document.getElementById('overlay-opacity-value');
    if (opacityLabel) opacityLabel.textContent = `${s.opacity}%`;
    const fontSizeLabel = document.getElementById('overlay-font-size-value');
    if (fontSizeLabel) fontSizeLabel.textContent = `${s.fontSize}px`;
    const primaryHex = document.getElementById('overlay-primary-color-hex');
    if (primaryHex) primaryHex.textContent = s.primaryColor;
    const lowHpHex = document.getElementById('overlay-low-hp-color-hex');
    if (lowHpHex) lowHpHex.textContent = s.lowHpColor;
    const ghostHex = document.getElementById('overlay-ghost-color-hex');
    if (ghostHex) ghostHex.textContent = s.ghostBarColor;
    const headerHex = document.getElementById('overlay-header-color-hex');
    if (headerHex) headerHex.textContent = s.headerColor;
    const monsterNameHex = document.getElementById('overlay-monster-name-color-hex');
    if (monsterNameHex) monsterNameHex.textContent = s.monsterNameColor;
    const playerNameHex = document.getElementById('overlay-player-name-color-hex');
    if (playerNameHex) playerNameHex.textContent = s.playerNameColor;
    const playerTagHex = document.getElementById('overlay-player-tag-color-hex');
    if (playerTagHex) playerTagHex.textContent = s.playerTagColor;
    const playerTagSizeLabel = document.getElementById('overlay-player-tag-font-size-label');
    if (playerTagSizeLabel) playerTagSizeLabel.textContent = `${s.playerTagFontSize}px`;

    this.updateFontPreview();
    this.renderEntityList();
  }

  updatePositionPicker(pickerId, value) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    picker.querySelectorAll('.position-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.value === value);
    });
  }
}
