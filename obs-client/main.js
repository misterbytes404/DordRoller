// OBS Client — Roll Display + Persona-style Health Bars

// --- Roll Sound ---
let rollSound = null;
let rollSoundEnabled = true;
let rollSoundVolume = 0.5;

const soundSrc = 'sounds/DieRoll.mp3';
try {
  const audio = new Audio(soundSrc);
  audio.addEventListener('canplaythrough', () => { rollSound = audio; }, { once: true });
  audio.addEventListener('error', () => { rollSound = null; });
  audio.load();
} catch { /* no-op if Audio unavailable */ }

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
let ROOM_CODE = 'game1';
if (roomFromUrl) {
  ROOM_CODE = roomFromUrl;
  console.log('Room code set from URL:', ROOM_CODE);
}

const socket = io(window.location.origin);

socket.on('connect', () => {
  console.log('OBS Client connected');
  socket.emit('join_room', ROOM_CODE);
  socket.emit('request_entity_list');
});

socket.on('joined_room', (data) => {
  console.log('OBS Client joined room:', data.roomCode);
});

// ===================== ROLL DISPLAY =====================

socket.on('broadcast_roll', (rollData) => {
  console.log('Roll received:', rollData);
  displayRoll(rollData);
});

function playRollSound() {
  if (!rollSoundEnabled || !rollSound) return;
  const clone = rollSound.cloneNode();
  clone.volume = rollSoundVolume;
  clone.play().catch(() => {});
}

function displayRoll(rollData) {
  playRollSound();

  const display = document.getElementById('roll-display');
  const label = display.querySelector('.roll-label');
  const largeResult = document.getElementById('large-result');
  const rollDetails = document.getElementById('roll-details');

  clearTimeout(window.rollHideTimeout);
  clearTimeout(window.rollFadeTimeout);

  label.textContent = rollData.label;
  largeResult.textContent = rollData.result;
  const modifierText = rollData.modifier !== 0 ? ` + ${rollData.modifier}` : '';
  rollDetails.textContent = `Rolled ${rollData.quantity}x ${rollData.diceType}: [${rollData.individualRolls.join(', ')}]${modifierText}`;

  display.classList.remove('hidden', 'hide');
  display.classList.add('show');

  window.rollHideTimeout = setTimeout(() => {
    display.classList.remove('show');
    display.classList.add('hide');
    window.rollFadeTimeout = setTimeout(() => {
      display.classList.add('hidden');
      display.classList.remove('hide');
    }, 500);
  }, 8000);
}

// ===================== HEALTH BAR SYSTEM =====================

const entities = {};
let overlaySettings = null;

// --- Socket Listeners ---

socket.on('broadcast_entity_list', (entityList) => {
  const currentIds = new Set(Object.keys(entities));
  const newIds = new Set();

  entityList.forEach(e => {
    newIds.add(e.id);
    if (entities[e.id]) {
      entities[e.id].name = e.name;
      entities[e.id].hpMax = e.hpMax;
      if (entities[e.id].hp !== e.hp) {
        entities[e.id].previousHp = entities[e.id].hp;
        entities[e.id].hp = e.hp;
      }
      entities[e.id].type = e.type;
      if (e.playerName) entities[e.id].playerName = e.playerName;
      if (e.authProvider) entities[e.id].authProvider = e.authProvider;
    } else {
      entities[e.id] = {
        name: e.name,
        hp: e.hp,
        hpMax: e.hpMax,
        previousHp: e.hp,
        type: e.type,
        playerName: e.playerName || null,
        authProvider: e.authProvider || null
      };
    }
  });

  currentIds.forEach(id => {
    if (!newIds.has(id)) {
      removeEntityBar(id);
      delete entities[id];
    }
  });

  renderAllBars();
});

socket.on('broadcast_hp_update', (data) => {
  const { id, name, hp, hpMax, type, playerName, authProvider } = data;
  if (entities[id]) {
    entities[id].previousHp = entities[id].hp;
    entities[id].name = name;
    entities[id].hp = hp;
    entities[id].hpMax = hpMax;
    if (playerName) entities[id].playerName = playerName;
    if (authProvider) entities[id].authProvider = authProvider;
  } else {
    entities[id] = { name, hp, hpMax, previousHp: hp, type, playerName: playerName || null, authProvider: authProvider || null };
  }
  renderAllBars();
  animateBar(id);
});

socket.on('overlay_settings_update', (data) => {
  overlaySettings = data.settings || data;
  applySettings();
  renderAllBars();
});

// --- Rendering ---

function renderAllBars() {
  const partyContainer = document.querySelector('#party-group .group-bars');
  const enemyContainer = document.querySelector('#enemy-group .group-bars');
  const overlay = document.getElementById('health-bar-overlay');

  if (!partyContainer || !enemyContainer || !overlay) return;

  if (!overlaySettings || !overlaySettings.enabled) {
    overlay.classList.remove('visible');
    return;
  }
  overlay.classList.add('visible');

  const hidden = new Set(overlaySettings.hiddenEntities || []);

  const allPlayers = Object.entries(entities)
    .filter(([id, e]) => e.type === 'player' && !hidden.has(id));
  const allMonsters = Object.entries(entities)
    .filter(([id, e]) => e.type === 'monster' && !hidden.has(id));

  // Each group can display up to 10 bars independently
  const maxPerGroup = 10;
  const visiblePlayers = allPlayers.slice(0, maxPerGroup);
  const visibleMonsters = allMonsters.slice(0, maxPerGroup);

  document.getElementById('party-group').classList.toggle('has-entities', visiblePlayers.length > 0);
  document.getElementById('enemy-group').classList.toggle('has-entities', visibleMonsters.length > 0);

  syncBars(partyContainer, visiblePlayers);
  syncBars(enemyContainer, visibleMonsters);
}

function syncBars(container, entityEntries) {
  const existingMap = {};
  container.querySelectorAll('.health-bar-entity').forEach(bar => {
    existingMap[bar.dataset.entityId] = bar;
  });

  const newIds = new Set(entityEntries.map(([id]) => id));

  // Remove bars no longer visible
  Object.keys(existingMap).forEach(id => {
    if (!newIds.has(id)) {
      const bar = existingMap[id];
      bar.classList.add('removing');
      setTimeout(() => bar.remove(), 400);
    }
  });

  // Create or update
  entityEntries.forEach(([id, entity]) => {
    let bar = existingMap[id];
    if (!bar) {
      bar = createBarElement(id);
      container.appendChild(bar);
      requestAnimationFrame(() => bar.classList.add('entered'));
    }
    updateBarElement(bar, entity);
  });
}

function createBarElement(id) {
  const bar = document.createElement('div');
  bar.className = 'health-bar-entity';
  bar.dataset.entityId = id;
  bar.innerHTML = `
    <div class="health-bar-name"></div>
    <div class="health-bar-track">
      <div class="health-bar-ghost"></div>
      <div class="health-bar-fill"></div>
      <div class="health-bar-numbers"></div>
    </div>
    <div class="health-bar-player-tag"></div>
  `;
  return bar;
}

function updateBarElement(bar, entity) {
  const hpPct = entity.hpMax > 0 ? Math.max(0, Math.min(100, (entity.hp / entity.hpMax) * 100)) : 0;
  const prevPct = entity.hpMax > 0 ? Math.max(0, Math.min(100, ((entity.previousHp ?? entity.hp) / entity.hpMax) * 100)) : 0;

  const nameEl = bar.querySelector('.health-bar-name');
  const fillEl = bar.querySelector('.health-bar-fill');
  const ghostEl = bar.querySelector('.health-bar-ghost');
  const numbersEl = bar.querySelector('.health-bar-numbers');

  nameEl.textContent = entity.name;
  nameEl.style.display = overlaySettings?.showNames !== false ? '' : 'none';
  nameEl.style.color = entity.type === 'player'
    ? (overlaySettings?.playerNameColor || '#ffffff')
    : (overlaySettings?.monsterNameColor || '#ffffff');

  numbersEl.textContent = `${entity.hp} / ${entity.hpMax}`;
  numbersEl.style.display = overlaySettings?.showHpNumbers !== false ? '' : 'none';

  const color = interpolateColor(hpPct);
  fillEl.style.width = `${hpPct}%`;
  fillEl.style.background = color;
  fillEl.style.boxShadow = `0 0 8px ${color}55`;

  ghostEl.style.width = `${prevPct}%`;
  ghostEl.style.background = overlaySettings?.ghostBarColor || '#f0c760';

  const playerTagEl = bar.querySelector('.health-bar-player-tag');
  if (entity.type === 'player' && entity.playerName) {
    const iconClass = getAuthProviderIcon(entity.authProvider);
    const iconHtml = iconClass ? `<i class="${iconClass} player-tag-icon"></i> ` : '';
    playerTagEl.innerHTML = `${iconHtml}Player: ${escapeHtmlObs(entity.playerName)}`;
    playerTagEl.style.display = overlaySettings?.showNames !== false ? 'block' : 'none';
  } else {
    playerTagEl.style.display = 'none';
  }

  bar.classList.toggle('dead', entity.hp <= 0);
}

function animateBar(id) {
  const bar = document.querySelector(`.health-bar-entity[data-entity-id="${CSS.escape(id)}"]`);
  if (!bar) return;

  const entity = entities[id];
  if (!entity) return;

  const ghostEl = bar.querySelector('.health-bar-ghost');
  const prevPct = entity.hpMax > 0 ? Math.max(0, Math.min(100, ((entity.previousHp ?? entity.hp) / entity.hpMax) * 100)) : 0;
  const hpPct = entity.hpMax > 0 ? Math.max(0, Math.min(100, (entity.hp / entity.hpMax) * 100)) : 0;

  if (entity.previousHp > entity.hp) {
    // Damage: ghost bar holds, then drains
    ghostEl.style.transition = 'none';
    ghostEl.style.width = `${prevPct}%`;
    setTimeout(() => {
      ghostEl.style.transition = 'width 0.8s ease-out';
      ghostEl.style.width = `${hpPct}%`;
      setTimeout(() => { entity.previousHp = entity.hp; }, 900);
    }, 500);
  } else {
    // Healing: sync immediately
    entity.previousHp = entity.hp;
    ghostEl.style.transition = 'width 0.3s ease';
    ghostEl.style.width = `${hpPct}%`;
  }

  bar.classList.add('hp-changed');
  setTimeout(() => bar.classList.remove('hp-changed'), 600);
}

function removeEntityBar(id) {
  const bar = document.querySelector(`.health-bar-entity[data-entity-id="${CSS.escape(id)}"]`);
  if (bar) {
    bar.classList.add('removing');
    setTimeout(() => bar.remove(), 400);
  }
}

// --- Auth Provider Icon Mapping ---

const AUTH_PROVIDER_ICONS = {
  twitch: 'fa-brands fa-twitch',
  discord: 'fa-brands fa-discord',
  google: 'fa-brands fa-google',
  youtube: 'fa-brands fa-youtube'
};

function getAuthProviderIcon(provider) {
  return AUTH_PROVIDER_ICONS[provider] || 'fa-solid fa-user';
}

function escapeHtmlObs(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Color Interpolation ---

function interpolateColor(percent) {
  const primary = overlaySettings?.primaryColor || '#f0a500';
  const low = overlaySettings?.lowHpColor || '#c41e3a';

  if (percent > 50) return primary;
  if (percent > 25) return blendColors(primary, low, (50 - percent) / 25);
  return low;
}

function blendColors(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// --- Apply Settings ---

function applySettings() {
  if (!overlaySettings) return;

  const overlay = document.getElementById('health-bar-overlay');
  if (!overlay) return;

  overlay.style.opacity = (overlaySettings.opacity ?? 100) / 100;

  const font = overlaySettings.fontFamily || 'Segoe UI';
  const size = overlaySettings.fontSize || 16;
  overlay.style.fontFamily = `'${font}', sans-serif`;
  overlay.style.setProperty('--hb-font-size', `${size}px`);

  // Position classes for each group
  const partyGroup = document.getElementById('party-group');
  const enemyGroup = document.getElementById('enemy-group');

  if (partyGroup) {
    const hadEntities = partyGroup.classList.contains('has-entities');
    partyGroup.className = `health-group pos-${overlaySettings.partyPosition || 'top-left'}`;
    partyGroup.id = 'party-group';
    if (hadEntities) partyGroup.classList.add('has-entities');
  }
  if (enemyGroup) {
    const hadEntities = enemyGroup.classList.contains('has-entities');
    enemyGroup.className = `health-group pos-${overlaySettings.enemyPosition || 'top-right'}`;
    enemyGroup.id = 'enemy-group';
    if (hadEntities) enemyGroup.classList.add('has-entities');
  }

  // Header styling
  const headerColor = overlaySettings.headerColor || '#f0a500';
  const headerFont = overlaySettings.headerFont || 'Segoe UI';
  const headerFontSize = overlaySettings.headerFontSize || 18;
  overlay.style.setProperty('--hb-header-color', headerColor);
  overlay.style.setProperty('--hb-header-font-size', `${headerFontSize}px`);
  document.querySelectorAll('.group-label').forEach(label => {
    label.style.fontFamily = `'${headerFont}', sans-serif`;
  });

  // Roll sound settings
  rollSoundEnabled = overlaySettings.rollSoundEnabled !== false;
  rollSoundVolume = (overlaySettings.rollSoundVolume ?? 50) / 100;

  // Player tag styling
  const playerTagFont = overlaySettings.playerTagFont || 'Segoe UI';
  const playerTagFontSize = overlaySettings.playerTagFontSize || 12;
  const playerTagColor = overlaySettings.playerTagColor || '#aaaaaa';
  overlay.style.setProperty('--hb-player-tag-font-size', `${playerTagFontSize}px`);
  overlay.style.setProperty('--hb-player-tag-color', playerTagColor);
  document.querySelectorAll('.health-bar-player-tag').forEach(tag => {
    tag.style.fontFamily = `'${playerTagFont}', sans-serif`;
  });
}