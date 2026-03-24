// MVP 2: Monster tracking functionality (UI-focused with database persistence)

// Dynamic API base URL - works in both dev and production
const API_URL = `${window.location.origin}/api`;

// ===== ATTACK PARSING UTILITIES =====
// Parses 5etools action format to extract structured attack data

/**
 * Parse a single action entry to extract attack data
 * @param {Object} action - 5etools action object with name and entries
 * @returns {Object|null} Parsed attack data or null if not an attack
 */
function parseAction(action) {
  if (!action || !action.entries || !action.entries.length) return null;
  
  const entry = action.entries.join(' ');
  const attack = {
    name: action.name,
    type: null,        // 'mw', 'rw', 'ms', 'rs' (melee/ranged weapon/spell)
    attackBonus: null,
    damage: [],        // Array of {dice, type}
    reach: null,
    range: null,
    saveDC: null,
    saveType: null,
    description: entry
  };

  // Detect attack type
  if (/{@atk mw}/.test(entry)) attack.type = 'mw';
  else if (/{@atk rw}/.test(entry)) attack.type = 'rw';
  else if (/{@atk ms}/.test(entry)) attack.type = 'ms';
  else if (/{@atk rs}/.test(entry)) attack.type = 'rs';
  else if (/{@atk mw,rw}/.test(entry)) attack.type = 'mw/rw';

  // Extract attack bonus: {@hit 9} -> +9
  const hitMatch = entry.match(/{@hit ([+-]?\d+)}/);
  if (hitMatch) {
    attack.attackBonus = parseInt(hitMatch[1], 10);
  }

  // Extract damage: {@damage 2d6 + 5} or {@damage 1d8}
  const damageMatches = entry.matchAll(/{@damage ([^}]+)}/g);
  for (const match of damageMatches) {
    const damageStr = match[1].trim();
    // Try to find damage type after the damage dice
    const afterDamage = entry.slice(entry.indexOf(match[0]) + match[0].length, entry.indexOf(match[0]) + match[0].length + 50);
    const typeMatch = afterDamage.match(/^\s*\)?\s*(\w+)\s+damage/i);
    attack.damage.push({
      dice: damageStr,
      type: typeMatch ? typeMatch[1].toLowerCase() : 'untyped'
    });
  }

  // Extract reach: "reach 10 ft."
  const reachMatch = entry.match(/reach\s+(\d+)\s*ft/i);
  if (reachMatch) {
    attack.reach = parseInt(reachMatch[1], 10);
  }

  // Extract range: "range 30/120 ft." or "range 60 ft."
  const rangeMatch = entry.match(/range\s+(\d+)(?:\/(\d+))?\s*ft/i);
  if (rangeMatch) {
    attack.range = {
      normal: parseInt(rangeMatch[1], 10),
      long: rangeMatch[2] ? parseInt(rangeMatch[2], 10) : null
    };
  }

  // Extract save DC: {@dc 14} with save type
  const dcMatch = entry.match(/{@dc (\d+)}/);
  if (dcMatch) {
    attack.saveDC = parseInt(dcMatch[1], 10);
    // Try to find save type
    const saveTypeMatch = entry.match(/({@dc \d+})\s*(\w+)\s+saving throw/i);
    if (saveTypeMatch) {
      attack.saveType = saveTypeMatch[2].toLowerCase().slice(0, 3); // 'str', 'dex', etc.
    }
  }

  // Only return if this looks like an attack (has attack bonus or damage or save)
  if (attack.attackBonus !== null || attack.damage.length > 0 || attack.saveDC !== null) {
    return attack;
  }
  return null;
}

/**
 * Parse all actions from a monster to extract attacks
 * @param {Array} actions - Array of 5etools action objects
 * @returns {Array} Array of parsed attack objects
 */
function parseActionsToAttacks(actions) {
  if (!actions || !Array.isArray(actions)) return [];
  
  const attacks = [];
  for (const action of actions) {
    const parsed = parseAction(action);
    if (parsed) {
      attacks.push(parsed);
    }
  }
  return attacks;
}

/**
 * Extract save proficiencies from monster data
 * @param {Object} monster - 5etools monster object
 * @returns {Object} Map of ability -> bonus string
 */
function extractSaveProficiencies(monster) {
  if (!monster.save) return {};
  return { ...monster.save };
}

/**
 * Parse formatted actions text (from database) to extract attack data
 * Handles text like: "Scimitar: Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit:5 (1d6 + 2) slashing damage."
 * @param {string} actionsText - Formatted actions text with newlines between actions
 * @returns {Array} Array of parsed attack objects
 */
function parseFormattedActionsText(actionsText) {
  if (!actionsText || typeof actionsText !== 'string') return [];
  
  const attacks = [];
  // Split by newlines to get individual actions
  const actionLines = actionsText.split('\n').filter(line => line.trim());
  
  for (const line of actionLines) {
    // Parse action name (before the colon)
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    
    const name = line.slice(0, colonIdx).trim();
    const description = line.slice(colonIdx + 1).trim();
    
    const attack = {
      name: name,
      type: null,
      attackBonus: null,
      damage: [],
      reach: null,
      range: null,
      saveDC: null,
      saveType: null,
      description: description
    };
    
    // Detect attack type from formatted text
    if (/Melee Weapon Attack/i.test(description)) attack.type = 'mw';
    else if (/Ranged Weapon Attack/i.test(description)) attack.type = 'rw';
    else if (/Melee Spell Attack/i.test(description)) attack.type = 'ms';
    else if (/Ranged Spell Attack/i.test(description)) attack.type = 'rs';
    
    // Extract attack bonus: "+4 to hit" or "+9 to hit"
    const hitMatch = description.match(/([+-]\d+)\s+to hit/i);
    if (hitMatch) {
      attack.attackBonus = parseInt(hitMatch[1], 10);
    }
    
    // Extract damage: "(1d6 + 2)" or "(2d6+5)" followed by damage type
    // Pattern matches: (dice expression) followed by damage type word
    const damageMatches = description.matchAll(/\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(\w+)\s+damage/gi);
    for (const match of damageMatches) {
      attack.damage.push({
        dice: match[1].replace(/\s/g, ''), // Remove spaces: "1d6 + 2" -> "1d6+2"
        type: match[2].toLowerCase()
      });
    }
    
    // Extract reach: "reach 5 ft." or "reach 10 ft."
    const reachMatch = description.match(/reach\s+(\d+)\s*ft/i);
    if (reachMatch) {
      attack.reach = parseInt(reachMatch[1], 10);
    }
    
    // Extract range: "range 80/320 ft." or "range 60 ft."
    const rangeMatch = description.match(/range\s+(\d+)(?:\/(\d+))?\s*ft/i);
    if (rangeMatch) {
      attack.range = {
        normal: parseInt(rangeMatch[1], 10),
        long: rangeMatch[2] ? parseInt(rangeMatch[2], 10) : null
      };
    }
    
    // Extract save DC: "DC 14" with optional save type
    const dcMatch = description.match(/DC\s+(\d+)/i);
    if (dcMatch) {
      attack.saveDC = parseInt(dcMatch[1], 10);
      const saveTypeMatch = description.match(/DC\s+\d+\s+(\w+)\s+saving throw/i);
      if (saveTypeMatch) {
        attack.saveType = saveTypeMatch[1].toLowerCase().slice(0, 3);
      }
    }
    
    // Only add if this looks like an attack
    if (attack.attackBonus !== null || attack.damage.length > 0 || attack.saveDC !== null) {
      attacks.push(attack);
    }
  }
  
  return attacks;
}

export class MonsterTracker {
  constructor(socket = null, getRoomCode = null) {
    this.monsters = [];  // In-memory cache
    this.roomId = null;  // Database room ID for persistence
    this.editingId = null;  // Track which monster is being edited
    this.bestiary = new Map();  // Map of name -> bestiary monster data
    this.debounceTimer = null;  // For debouncing search input
    this.socket = socket;  // Socket.io connection for roll broadcasting
    this.getRoomCode = getRoomCode;  // Function to get current room code
    this.expandedPanels = new Set();  // Track which monster roll panels are expanded
    this.init();
  }

  // Set the room ID (called when GM joins room)
  setRoomId(roomId) {
    this.roomId = roomId;
    console.log('MonsterTracker: Room ID set to', roomId);
    if (roomId) {
      this.loadFromDatabase();
    }
  }

  // Load monsters from database
  async loadFromDatabase() {
    if (!this.roomId) return;
    
    try {
      const response = await fetch(`${API_URL}/rooms/${this.roomId}/monsters`);
      if (response.ok) {
        this.monsters = await response.json();
        console.log(`Loaded ${this.monsters.length} monsters from database`);
        this.renderMonsters();
      }
    } catch (error) {
      console.error('Failed to load monsters from database:', error);
    }
  }

  // Save monster to database
  async saveMonsterToDb(monster) {
    if (!this.roomId) {
      console.warn('No room ID - monster not persisted');
      return monster;
    }
    
    try {
      if (monster.id && typeof monster.id === 'string' && monster.id.length === 16) {
        // Update existing monster (has hex ID)
        const response = await fetch(`${API_URL}/monsters/${monster.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(monster)
        });
        if (response.ok) {
          return await response.json();
        }
      } else {
        // Create new monster
        const response = await fetch(`${API_URL}/monsters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: this.roomId, ...monster })
        });
        if (response.ok) {
          return await response.json();
        }
      }
    } catch (error) {
      console.error('Failed to save monster to database:', error);
    }
    return monster;
  }

  // Delete monster from database
  async deleteMonsterFromDb(monsterId) {
    if (!this.roomId) return;
    
    try {
      await fetch(`${API_URL}/monsters/${monsterId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete monster from database:', error);
    }
  }

  // Quick HP save (for combat slider)
  async saveHpToDb(monsterId, hp) {
    if (!this.roomId) return;
    
    try {
      await fetch(`${API_URL}/monsters/${monsterId}/hp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hp })
      });
      console.log(`Monster ${monsterId} HP updated to ${hp}`);
    } catch (error) {
      console.error('Failed to save monster HP:', error);
    }
  }

  async init() {
    await this.loadBestiary();
    const addBtn = document.getElementById('add-monster-btn');
    addBtn.addEventListener('click', () => this.addMonster());

    // Add search functionality with debouncing
    const searchInput = document.getElementById('monster-search');
    searchInput.addEventListener('input', (e) => this.debouncedSearch(e.target.value));
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      const searchResults = document.getElementById('search-results');
      const searchContainer = document.querySelector('.search-container') || searchInput.parentElement;
      if (searchResults && !searchContainer?.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
  }

  debouncedSearch(query) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.searchMonsters(query), 300);  // 300ms delay
  }

  async loadBestiary() {
    // List of bestiary files (hardcoded from directory listing; ~100 files) from 5e.tools
    const files = [
      'bestiary-mm.json', 'bestiary-dmg.json', 'bestiary-vgm.json', 'bestiary-mtf.json',
      'bestiary-wdh.json', 'bestiary-cos.json', 'bestiary-pota.json', 'bestiary-skt.json',
      'bestiary-toa.json', 'bestiary-egw.json', 'bestiary-idrotf.json', 'bestiary-crcotn.json',
      'bestiary-lox.json', 'bestiary-qftis.json', 'bestiary-xmm.json', 'bestiary-tce.json',
      'bestiary-ftd.json', 'bestiary-scc.json', 'bestiary-ggr.json', 'bestiary-aag.json',
      'bestiary-bgg.json', 'bestiary-dab.json', 'bestiary-dodk.json', 'bestiary-erlw.json',
      'bestiary-ghloe.json', 'bestiary-gos.json', 'bestiary-hf.json', 'bestiary-imr.json',
      'bestiary-jttrc.json', 'bestiary-kkw.json', 'bestiary-lmop.json', 'bestiary-mpp.json',
      'bestiary-oce.json', 'bestiary-oow.json', 'bestiary-oota.json', 'bestiary-phb.json',
      'bestiary-rot.json', 'bestiary-sads.json', 'bestiary-slw.json', 'bestiary-tftyp.json',
      'bestiary-tg.json', 'bestiary-ths.json', 'bestiary-tlr.json', 'bestiary-to.json',
      'bestiary-tro.json', 'bestiary-ua-ar.json', 'bestiary-ua-mm.json', 'bestiary-ua-tobm.json',
      'bestiary-ua-wmo.json', 'bestiary-ua-wo.json', 'bestiary-ua-2022-01-24.json',
      'bestiary-ua-2022-05-02.json', 'bestiary-ua-2022-06-13.json', 'bestiary-ua-2022-11-07.json',
      'bestiary-ua-2023-01-16.json', 'bestiary-ua-2023-03-14.json', 'bestiary-ua-2023-04-24.json',
      'bestiary-ua-2023-05-08.json', 'bestiary-ua-2023-06-12.json', 'bestiary-ua-2023-07-10.json',
      'bestiary-ua-2023-08-14.json', 'bestiary-ua-2023-09-11.json', 'bestiary-ua-2023-10-09.json',
      'bestiary-ua-2023-11-13.json', 'bestiary-ua-2023-12-11.json', 'bestiary-ua-2024-01-08.json',
      'bestiary-ua-2024-02-12.json', 'bestiary-ua-2024-03-11.json', 'bestiary-ua-2024-04-08.json',
      'bestiary-ua-2024-05-13.json', 'bestiary-ua-2024-06-10.json', 'bestiary-ua-2024-07-08.json',
      'bestiary-ua-2024-08-12.json', 'bestiary-ua-2024-09-09.json', 'bestiary-ua-2024-10-14.json',
      'bestiary-ua-2024-11-11.json', 'bestiary-ua-2024-12-09.json', 'bestiary-ua-2025-01-13.json',
      'bestiary-ua-2025-02-10.json', 'bestiary-ua-2025-03-10.json', 'bestiary-ua-2025-04-14.json',
      'bestiary-ua-2025-05-12.json', 'bestiary-ua-2025-06-09.json', 'bestiary-ua-2025-07-14.json',
      'bestiary-ua-2025-08-11.json', 'bestiary-ua-2025-09-08.json', 'bestiary-ua-2025-10-13.json',
      'bestiary-ua-2025-11-10.json', 'bestiary-ua-2025-12-08.json', 'bestiary-ua-2026-01-12.json',
      'bestiary-ua-2026-02-09.json', 'bestiary-ua-2026-03-09.json', 'bestiary-ua-2026-04-13.json',
      'bestiary-ua-2026-05-11.json', 'bestiary-ua-2026-06-08.json', 'bestiary-ua-2026-07-13.json',
      'bestiary-ua-2026-08-10.json', 'bestiary-ua-2026-09-07.json', 'bestiary-ua-2026-10-12.json',
      'bestiary-ua-2026-11-09.json', 'bestiary-ua-2026-12-07.json', 'bestiary-ua-2027-01-11.json',
      'bestiary-ua-2027-02-08.json', 'bestiary-ua-2027-03-08.json', 'bestiary-ua-2027-04-12.json',
      'bestiary-ua-2027-05-10.json', 'bestiary-ua-2027-06-07.json', 'bestiary-ua-2027-07-12.json',
      'bestiary-ua-2027-08-09.json', 'bestiary-ua-2027-09-06.json', 'bestiary-ua-2027-10-11.json',
      'bestiary-ua-2027-11-08.json', 'bestiary-ua-2027-12-06.json', 'bestiary-ua-2028-01-10.json',
      'bestiary-ua-2028-02-07.json', 'bestiary-ua-2028-03-07.json', 'bestiary-ua-2028-04-11.json',
      'bestiary-ua-2028-05-09.json', 'bestiary-ua-2028-06-06.json', 'bestiary-ua-2028-07-11.json',
      'bestiary-ua-2028-08-08.json', 'bestiary-ua-2028-09-05.json', 'bestiary-ua-2028-10-10.json',
      'bestiary-ua-2028-11-07.json', 'bestiary-ua-2028-12-05.json', 'bestiary-ua-2029-01-09.json',
      'bestiary-ua-2029-02-06.json', 'bestiary-ua-2029-03-06.json', 'bestiary-ua-2029-04-10.json',
      'bestiary-ua-2029-05-08.json', 'bestiary-ua-2029-06-05.json', 'bestiary-ua-2029-07-10.json',
      'bestiary-ua-2029-08-07.json', 'bestiary-ua-2029-09-04.json', 'bestiary-ua-2029-10-09.json',
      'bestiary-ua-2029-11-06.json', 'bestiary-ua-2029-12-04.json', 'bestiary-ua-2030-01-08.json',
      'bestiary-ua-2030-02-05.json', 'bestiary-ua-2030-03-05.json', 'bestiary-ua-2030-04-09.json',
      'bestiary-ua-2030-05-07.json', 'bestiary-ua-2030-06-04.json', 'bestiary-ua-2030-07-09.json',
      'bestiary-ua-2030-08-06.json', 'bestiary-ua-2030-09-03.json', 'bestiary-ua-2030-10-08.json',
      'bestiary-ua-2030-11-05.json', 'bestiary-ua-2030-12-03.json'
    ];

    const promises = files.map(file => fetch(`${import.meta.env.BASE_URL}data/bestiary/${file}`).then(r => r.json()).catch(() => null));
    const data = await Promise.all(promises);
    data.forEach(fileData => {
      if (fileData && fileData.monster) {
        fileData.monster.forEach(monster => {
          this.bestiary.set(monster.name, monster);
        });
      }
    });
    console.log('Bestiary loaded with', this.bestiary.size, 'monsters');
  }

  searchMonsters(query) {
    const resultsList = document.getElementById('search-results');
    resultsList.innerHTML = '';
    if (!query.trim()) {
      resultsList.style.display = 'none';
      return;
    }

    const matches = Array.from(this.bestiary.keys())
      .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);  // Limit to 10 results

    if (matches.length === 0) {
      resultsList.style.display = 'none';
      return;
    }

    matches.forEach(name => {
      const li = document.createElement('li');
      const monster = this.bestiary.get(name);
      
      // Create monster info span
      const infoSpan = document.createElement('span');
      infoSpan.className = 'monster-search-info';
      infoSpan.textContent = `${name} (${monster.source})`;
      
      // Make the whole li clickable to select monster
      li.addEventListener('click', (e) => { 
        // Don't trigger if clicking the quick-add button
        if (e.target.closest('.quick-add-btn')) return;
        e.preventDefault(); 
        e.stopPropagation();
        this.hideSearchResults();
        this.selectMonster(name); 
      });
      
      // Create quick-add button
      const quickAddBtn = document.createElement('button');
      quickAddBtn.className = 'quick-add-btn';
      quickAddBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      quickAddBtn.title = 'Quick add to encounter';
      quickAddBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.quickAddFromBestiary(name);
      });
      
      li.appendChild(infoSpan);
      li.appendChild(quickAddBtn);
      resultsList.appendChild(li);
    });
    resultsList.style.display = 'block';
  }

  // Helper to hide search results and clear input
  hideSearchResults() {
    const searchResults = document.getElementById('search-results');
    const searchInput = document.getElementById('monster-search');
    if (searchResults) searchResults.style.display = 'none';
    if (searchInput) searchInput.value = '';
  }

  // Quick add monster directly from bestiary search results
  async quickAddFromBestiary(name) {
    const monster = this.bestiary.get(name);
    if (!monster) return;
    
    // Parse monster data from 5etools format
    let typeStr = '';
    if (typeof monster.type === 'string') {
      typeStr = monster.type;
    } else if (monster.type && monster.type.type) {
      typeStr = monster.type.type;
      if (monster.type.tags && monster.type.tags.length > 0) {
        typeStr += ` (${monster.type.tags.join(', ')})`;
      }
    }
    
    const size = Array.isArray(monster.size) ? monster.size[0] : (monster.size || 'M');
    
    let ac = 10;
    if (monster.ac) {
      if (Array.isArray(monster.ac)) {
        ac = typeof monster.ac[0] === 'object' ? monster.ac[0].ac : monster.ac[0];
      } else if (typeof monster.ac === 'object') {
        ac = monster.ac.ac || 10;
      } else {
        ac = monster.ac;
      }
    }
    
    const hp = monster.hp ? monster.hp.average : 1;
    
    // Parse attacks and save proficiencies from bestiary data
    const attacks = parseActionsToAttacks(monster.action);
    const saveProficiencies = extractSaveProficiencies(monster);
    
    const monsterData = {
      name: monster.name,
      source: monster.source,
      type: `${size} ${typeStr}`,
      ac: ac,
      hp: hp,
      hpMax: hp,
      hitDice: monster.hp ? monster.hp.formula : '',
      speed: this.formatSpeed(monster.speed),
      abilities: {
        str: monster.str || 10,
        dex: monster.dex || 10,
        con: monster.con || 10,
        int: monster.int || 10,
        wis: monster.wis || 10,
        cha: monster.cha || 10
      },
      skills: this.formatSkills(monster.skill),
      senses: this.formatSenses(monster),
      languages: monster.languages ? monster.languages.join(', ') : '',
      cr: this.formatCR(monster.cr),
      actions: this.formatActions(monster.action),
      reactions: this.formatActions(monster.reaction),
      attacks: attacks,                    // Parsed attack data for roll buttons
      saveProficiencies: saveProficiencies, // Save bonuses from bestiary
      displayOrder: this.monsters.length
    };
    
    // Save to database and add to list
    const savedMonster = await this.saveMonsterToDb(monsterData);
    this.monsters.push(savedMonster);
    this.renderMonsters();
    
    // Keep search open for adding more monsters
    console.log(`Quick added: ${monster.name}`);
  }

  selectMonster(name) {
    const monster = this.bestiary.get(name);
    if (!monster) return;

    // Handle type - can be string or object with type/tags
    let typeStr = '';
    if (typeof monster.type === 'string') {
      typeStr = monster.type;
    } else if (monster.type && monster.type.type) {
      typeStr = monster.type.type;
      if (monster.type.tags && monster.type.tags.length > 0) {
        typeStr += ` (${monster.type.tags.join(', ')})`;
      }
    }
    
    // Handle size - can be string or array
    const size = Array.isArray(monster.size) ? monster.size[0] : (monster.size || 'M');
    
    // Handle AC - can be number, object, or array
    let ac = 10;
    if (monster.ac) {
      if (Array.isArray(monster.ac)) {
        ac = typeof monster.ac[0] === 'object' ? monster.ac[0].ac : monster.ac[0];
      } else if (typeof monster.ac === 'object') {
        ac = monster.ac.ac || 10;
      } else {
        ac = monster.ac;
      }
    }

    // Populate form fields
    document.getElementById('monster-name').value = monster.name;
    document.getElementById('monster-source').value = monster.source;
    document.getElementById('monster-type').value = `${size} ${typeStr}`;
    document.getElementById('monster-ac').value = ac;
    document.getElementById('monster-hp').value = monster.hp ? monster.hp.average : 1;
    document.getElementById('monster-hp-max').value = monster.hp ? monster.hp.average : 1;
    document.getElementById('monster-hit-dice').value = monster.hp ? monster.hp.formula : '';
    document.getElementById('monster-speed').value = this.formatSpeed(monster.speed);
    document.getElementById('monster-str').value = monster.str || 10;
    document.getElementById('monster-dex').value = monster.dex || 10;
    document.getElementById('monster-con').value = monster.con || 10;
    document.getElementById('monster-int').value = monster.int || 10;
    document.getElementById('monster-wis').value = monster.wis || 10;
    document.getElementById('monster-cha').value = monster.cha || 10;
    document.getElementById('monster-skills').value = this.formatSkills(monster.skill);
    document.getElementById('monster-senses').value = this.formatSenses(monster);
    document.getElementById('monster-languages').value = monster.languages ? monster.languages.join(', ') : '';
    document.getElementById('monster-cr').value = this.formatCR(monster.cr);
    document.getElementById('monster-actions').value = this.formatActions(monster.action);
    document.getElementById('monster-reactions').value = this.formatActions(monster.reaction);

    // Hide search results and clear search input
    this.hideSearchResults();
  }

  // Format senses from 5etools format
  formatSenses(monster) {
    const parts = [];
    if (monster.senses) {
      parts.push(...monster.senses);
    }
    parts.push(`passive Perception ${monster.passive || 10}`);
    return parts.join(', ');
  }

  // Format CR (can be string, number, or object)
  formatCR(cr) {
    if (!cr) return '';
    if (typeof cr === 'object') {
      return cr.cr || '';
    }
    return String(cr);
  }

  formatSpeed(speed) {
    if (!speed) return '';
    const parts = [];
    if (speed.walk) parts.push(`${speed.walk} ft.`);
    if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
    if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
    if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
    return parts.join(', ');
  }

  formatSkills(skill) {
    if (!skill) return '';
    return Object.entries(skill).map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${value}`).join(', ');
  }

  formatActions(actions) {
    if (!actions || !Array.isArray(actions)) return '';
    // Parsing logic for 5etools templated text inspired by 5etools (https://github.com/5etools-mirror-3/5etools-src), licensed under MIT.
    return actions.map(action => `${action.name}: ${action.entries ? action.entries.map(entry => entry.replace(/{@atk mw}/g, 'Melee Weapon Attack:').replace(/{@atk rw}/g, 'Ranged Weapon Attack:').replace(/{@atk ms}/g, 'Melee Spell Attack:').replace(/{@atk rs}/g, 'Ranged Spell Attack:').replace(/{@hit ([+-]?\d+)}/g, '+$1 to hit').replace(/{@h}/g, 'Hit:').replace(/{@m}/g, 'Miss:').replace(/{@hom}/g, 'Hit or Miss:').replace(/{@damage ([^}]+)}/g, '$1').replace(/{@dc (\d+)(?:\|([^}]+))?}/g, (match, dc, display) => 'DC ' + (display || dc)).replace(/{@condition ([^}]+)}/g, '$1').replace(/{@skill ([^}]+)}/g, '$1').replace(/{@spell ([^}]+)}/g, '$1').replace(/{@recharge (\d+)}/g, '(recharge $1)').replace(/{@[^}]+}/g, '')).join(' ') : ''}`).join('\n');
  }

  async addMonster() {
    const name = document.getElementById('monster-name').value.trim();
    const source = document.getElementById('monster-source').value.trim();
    const type = document.getElementById('monster-type').value.trim();
    const ac = Number(document.getElementById('monster-ac').value);
    const hp = Number(document.getElementById('monster-hp').value);
    const hpMax = Number(document.getElementById('monster-hp-max').value) || hp;
    const hitDice = document.getElementById('monster-hit-dice').value.trim();
    const speed = document.getElementById('monster-speed').value.trim();
    const str = Number(document.getElementById('monster-str').value) || 10;
    const dex = Number(document.getElementById('monster-dex').value) || 10;
    const con = Number(document.getElementById('monster-con').value) || 10;
    const int = Number(document.getElementById('monster-int').value) || 10;
    const wis = Number(document.getElementById('monster-wis').value) || 10;
    const cha = Number(document.getElementById('monster-cha').value) || 10;
    const skills = document.getElementById('monster-skills').value.trim();
    const senses = document.getElementById('monster-senses').value.trim();
    const languages = document.getElementById('monster-languages').value.trim();
    const cr = document.getElementById('monster-cr').value.trim();
    const actions = document.getElementById('monster-actions').value.trim();
    const reactions = document.getElementById('monster-reactions').value.trim();

    const monsterData = {
      name,
      source,
      type,
      ac,
      hp,
      hpMax,
      hitDice,
      speed,
      abilities: { str, dex, con, int, wis, cha },
      skills,
      senses,
      languages,
      cr,
      actions,
      reactions,
      attacks: [],           // Manual entry doesn't have parsed attacks
      saveProficiencies: {}, // Manual entry doesn't have save proficiencies
      displayOrder: this.monsters.length
    };
    
    // Save to database and get back the monster with hex ID
    const savedMonster = await this.saveMonsterToDb(monsterData);
    this.monsters.push(savedMonster);
    this.renderMonsters();
    this.clearForm();
  }

  renderMonsters() {
    const list = document.getElementById('monster-list');
    list.innerHTML = '';
    this.monsters.forEach(monster => {
      if (!monster.hpMax) monster.hpMax = monster.hp;
      const card = document.createElement('div');
      card.className = 'monster-card';
      if (this.editingId === monster.id) {
        // Edit mode: Show all inputs with labels (escape values for input attributes)
        card.innerHTML = `
          <label for="edit-name-${monster.id}">Name:</label><br>
          <input type="text" id="edit-name-${monster.id}" value="${this.escapeHtml(monster.name)}"><br>
          <label for="edit-source-${monster.id}">Source:</label><br>
          <input type="text" id="edit-source-${monster.id}" value="${this.escapeHtml(monster.source || '')}"><br>
          <label for="edit-type-${monster.id}">Type:</label><br>
          <input type="text" id="edit-type-${monster.id}" value="${this.escapeHtml(monster.type)}"><br>
          <label for="edit-ac-${monster.id}">AC:</label><br>
          <input type="number" id="edit-ac-${monster.id}" value="${this.escapeHtml(monster.ac)}"><br>
          <label for="edit-hp-${monster.id}">HP:</label><br>
          <input type="number" id="edit-hp-${monster.id}" value="${this.escapeHtml(monster.hp)}"><br>
          <label for="edit-hp-max-${monster.id}">HP Max:</label><br>
          <input type="number" id="edit-hp-max-${monster.id}" value="${this.escapeHtml(monster.hpMax)}"><br>
          <label for="edit-hit-dice-${monster.id}">Hit Dice:</label><br>
          <input type="text" id="edit-hit-dice-${monster.id}" value="${this.escapeHtml(monster.hitDice || '')}"><br>
          <label for="edit-speed-${monster.id}">Speed:</label><br>
          <input type="text" id="edit-speed-${monster.id}" value="${this.escapeHtml(monster.speed)}"><br>
          <label for="edit-str-${monster.id}">STR:</label><br>
          <input type="number" id="edit-str-${monster.id}" value="${this.escapeHtml(monster.abilities.str)}" min="1" max="30"><br>
          <label for="edit-dex-${monster.id}">DEX:</label><br>
          <input type="number" id="edit-dex-${monster.id}" value="${this.escapeHtml(monster.abilities.dex)}" min="1" max="30"><br>
          <label for="edit-con-${monster.id}">CON:</label><br>
          <input type="number" id="edit-con-${monster.id}" value="${this.escapeHtml(monster.abilities.con)}" min="1" max="30"><br>
          <label for="edit-int-${monster.id}">INT:</label><br>
          <input type="number" id="edit-int-${monster.id}" value="${this.escapeHtml(monster.abilities.int)}" min="1" max="30"><br>
          <label for="edit-wis-${monster.id}">WIS:</label><br>
          <input type="number" id="edit-wis-${monster.id}" value="${this.escapeHtml(monster.abilities.wis)}" min="1" max="30"><br>
          <label for="edit-cha-${monster.id}">CHA:</label><br>
          <input type="number" id="edit-cha-${monster.id}" value="${this.escapeHtml(monster.abilities.cha)}" min="1" max="30"><br>
          <label for="edit-skills-${monster.id}">Skills:</label><br>
          <input type="text" id="edit-skills-${monster.id}" value="${this.escapeHtml(monster.skills || '')}"><br>
          <label for="edit-senses-${monster.id}">Senses:</label><br>
          <input type="text" id="edit-senses-${monster.id}" value="${this.escapeHtml(monster.senses || '')}"><br>
          <label for="edit-languages-${monster.id}">Languages:</label><br>
          <input type="text" id="edit-languages-${monster.id}" value="${this.escapeHtml(monster.languages || '')}"><br>
          <label for="edit-cr-${monster.id}">CR:</label><br>
          <input type="text" id="edit-cr-${monster.id}" value="${this.escapeHtml(monster.cr || '')}"><br>
          <label for="edit-actions-${monster.id}">Actions:</label><br>
          <textarea id="edit-actions-${monster.id}">${this.escapeHtml(monster.actions || '')}</textarea><br>
          <label for="edit-reactions-${monster.id}">Reactions:</label><br>
          <textarea id="edit-reactions-${monster.id}">${this.escapeHtml(monster.reactions || '')}</textarea><br>
          <button class="save-btn" data-id="${monster.id}">Save</button>
          <button class="cancel-btn" data-id="${monster.id}">Cancel</button>
        `;
      } else {
        // Display mode: Specified format (escape all monster data)
        const modDex = this.getModifier(monster.abilities.dex);  // For Initiative
        const modStr = this.getModifier(monster.abilities.str);
        const saveStr = this.getSave(monster.abilities.str, monster.saveProficiencies?.str);
        const modDexAttr = this.getModifier(monster.abilities.dex);
        const saveDex = this.getSave(monster.abilities.dex, monster.saveProficiencies?.dex);
        const modCon = this.getModifier(monster.abilities.con);
        const saveCon = this.getSave(monster.abilities.con, monster.saveProficiencies?.con);
        const modInt = this.getModifier(monster.abilities.int);
        const saveInt = this.getSave(monster.abilities.int, monster.saveProficiencies?.int);
        const modWis = this.getModifier(monster.abilities.wis);
        const saveWis = this.getSave(monster.abilities.wis, monster.saveProficiencies?.wis);
        const modCha = this.getModifier(monster.abilities.cha);
        const saveCha = this.getSave(monster.abilities.cha, monster.saveProficiencies?.cha);

        // Check if roll panel is expanded
        const isExpanded = this.expandedPanels.has(monster.id);
        
        // Build attack buttons HTML
        const attackButtonsHtml = this.buildAttackButtonsHtml(monster);

        card.innerHTML = `
          <p><strong>Name:</strong> ${this.escapeHtml(monster.name)}</p>
          <p><strong>Source:</strong> ${this.escapeHtml(monster.source || 'Unknown')}</p>
          <p><strong>Type:</strong> ${this.escapeHtml(monster.type)}</p>
          <hr>
          <p><strong>AC:</strong> ${this.escapeHtml(monster.ac || (10 + Math.floor(((monster.abilities.dex || 10) - 10) / 2)))}</p>
          <p><strong>Initiative:</strong> ${this.escapeHtml(modDex)}</p>
          <p><strong>HP:</strong> <span id="hp-text-${monster.id}">${this.escapeHtml(monster.hp)}</span> / ${this.escapeHtml(monster.hpMax)}</p>
          <progress id="hp-bar-${monster.id}" value="${monster.hp}" max="${monster.hpMax}"></progress><br>
          <input type="range" id="hp-slider-${monster.id}" min="0" max="${monster.hpMax}" step="1" value="${monster.hp}"><br>
          <p><strong>Hit Dice:</strong> ${this.escapeHtml(monster.hitDice || 'N/A')}</p>
          <p><strong>Speed:</strong> ${this.escapeHtml(monster.speed)}</p>
          <hr>
          <table class="abilities-table">
            <tr><th>Attribute</th><th>Score</th><th>Mod</th><th>Save</th></tr>
            <tr><td>Str</td><td>${this.escapeHtml(monster.abilities.str)}</td><td>${this.escapeHtml(modStr)}</td><td>${this.escapeHtml(saveStr)}</td></tr>
            <tr><td>Dex</td><td>${this.escapeHtml(monster.abilities.dex)}</td><td>${this.escapeHtml(modDexAttr)}</td><td>${this.escapeHtml(saveDex)}</td></tr>
            <tr><td>Con</td><td>${this.escapeHtml(monster.abilities.con)}</td><td>${this.escapeHtml(modCon)}</td><td>${this.escapeHtml(saveCon)}</td></tr>
            <tr><td>Int</td><td>${this.escapeHtml(monster.abilities.int)}</td><td>${this.escapeHtml(modInt)}</td><td>${this.escapeHtml(saveInt)}</td></tr>
            <tr><td>Wis</td><td>${this.escapeHtml(monster.abilities.wis)}</td><td>${this.escapeHtml(modWis)}</td><td>${this.escapeHtml(saveWis)}</td></tr>
            <tr><td>Cha</td><td>${this.escapeHtml(monster.abilities.cha)}</td><td>${this.escapeHtml(modCha)}</td><td>${this.escapeHtml(saveCha)}</td></tr>
          </table>
          <hr>
          <p><strong>Skills:</strong> ${this.escapeHtml(monster.skills || 'None')}</p>
          <p><strong>Senses:</strong> ${this.escapeHtml(monster.senses || 'None')}</p>
          <p><strong>Languages:</strong> ${this.escapeHtml(monster.languages || 'None')}</p>
          <p><strong>CR:</strong> ${this.escapeHtml(monster.cr || 'N/A')}</p>
          <hr>
          
          <!-- Roll Panel -->
          <div class="roll-panel-container">
            <button class="roll-panel-toggle" data-id="${monster.id}">
              <i class="fa-solid fa-dice-d20"></i> Rolls
              <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} toggle-icon"></i>
            </button>
            <div class="roll-panel ${isExpanded ? 'expanded' : ''}" id="roll-panel-${monster.id}">
              <!-- Initiative -->
              <div class="roll-section">
                <label>Initiative:</label>
                <div class="roll-row">
                  <input type="number" class="roll-modifier" id="init-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.dex)}" title="Initiative modifier">
                  <button class="roll-btn initiative-roll" data-id="${monster.id}" data-type="initiative" title="Roll Initiative">
                    <i class="fa-solid fa-dice-d20"></i> Roll
                  </button>
                </div>
              </div>
              
              <!-- Ability Checks -->
              <div class="roll-section">
                <label>Ability Checks:</label>
                <div class="roll-grid ability-grid">
                  <div class="roll-row">
                    <span class="ability-label">STR</span>
                    <input type="number" class="roll-modifier" id="str-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.str)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="str" title="Roll STR Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row">
                    <span class="ability-label">DEX</span>
                    <input type="number" class="roll-modifier" id="dex-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.dex)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="dex" title="Roll DEX Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row">
                    <span class="ability-label">CON</span>
                    <input type="number" class="roll-modifier" id="con-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.con)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="con" title="Roll CON Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row">
                    <span class="ability-label">INT</span>
                    <input type="number" class="roll-modifier" id="int-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.int)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="int" title="Roll INT Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row">
                    <span class="ability-label">WIS</span>
                    <input type="number" class="roll-modifier" id="wis-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.wis)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="wis" title="Roll WIS Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row">
                    <span class="ability-label">CHA</span>
                    <input type="number" class="roll-modifier" id="cha-check-mod-${monster.id}" value="${this.getModifierValue(monster.abilities.cha)}">
                    <button class="roll-btn ability-roll" data-id="${monster.id}" data-ability="cha" title="Roll CHA Check">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Saving Throws -->
              <div class="roll-section">
                <label>Saving Throws:</label>
                <div class="roll-grid save-grid">
                  <div class="roll-row ${monster.saveProficiencies?.str ? 'proficient' : ''}">
                    <span class="ability-label">STR</span>
                    <input type="number" class="roll-modifier" id="str-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.str, monster.saveProficiencies?.str)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="str" title="Roll STR Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row ${monster.saveProficiencies?.dex ? 'proficient' : ''}">
                    <span class="ability-label">DEX</span>
                    <input type="number" class="roll-modifier" id="dex-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.dex, monster.saveProficiencies?.dex)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="dex" title="Roll DEX Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row ${monster.saveProficiencies?.con ? 'proficient' : ''}">
                    <span class="ability-label">CON</span>
                    <input type="number" class="roll-modifier" id="con-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.con, monster.saveProficiencies?.con)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="con" title="Roll CON Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row ${monster.saveProficiencies?.int ? 'proficient' : ''}">
                    <span class="ability-label">INT</span>
                    <input type="number" class="roll-modifier" id="int-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.int, monster.saveProficiencies?.int)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="int" title="Roll INT Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row ${monster.saveProficiencies?.wis ? 'proficient' : ''}">
                    <span class="ability-label">WIS</span>
                    <input type="number" class="roll-modifier" id="wis-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.wis, monster.saveProficiencies?.wis)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="wis" title="Roll WIS Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                  <div class="roll-row ${monster.saveProficiencies?.cha ? 'proficient' : ''}">
                    <span class="ability-label">CHA</span>
                    <input type="number" class="roll-modifier" id="cha-save-mod-${monster.id}" value="${this.getSaveValue(monster.abilities.cha, monster.saveProficiencies?.cha)}">
                    <button class="roll-btn save-roll" data-id="${monster.id}" data-save="cha" title="Roll CHA Save">
                      <i class="fa-solid fa-dice-d20"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Attacks -->
              ${attackButtonsHtml}
            </div>
          </div>
          
          <hr>
          <p><strong>Actions:</strong><br>${this.escapeHtmlWithBreaks(monster.actions)}</p>
          <p><strong>Reactions:</strong><br>${this.escapeHtmlWithBreaks(monster.reactions)}</p>
          <div class="monster-card-actions">
            <button class="duplicate-btn" data-id="${monster.id}" title="Create a copy of this monster">
              <i class="fa-solid fa-clone"></i> Duplicate
            </button>
            <button class="edit-btn" data-id="${monster.id}">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button class="delete-btn" data-id="${monster.id}">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        `;
      }
      list.appendChild(card);

      if (this.editingId !== monster.id) {
        const slider = card.querySelector(`#hp-slider-${monster.id}`);
        const bar = card.querySelector(`#hp-bar-${monster.id}`);
        const hpText = card.querySelector(`#hp-text-${monster.id}`);
        
        // Debounce timer for HP saves
        let hpSaveTimer = null;
        
        slider.addEventListener('input', () => {
          monster.hp = Math.max(0, Math.min(monster.hpMax, Number(slider.value)));
          bar.value = monster.hp;
          hpText.textContent = monster.hp;
          
          // Debounce HP save to database (500ms after last change)
          clearTimeout(hpSaveTimer);
          hpSaveTimer = setTimeout(() => {
            this.saveHpToDb(monster.id, monster.hp);
          }, 500);
        });
      }
    });

    // Add event listeners (same as before)
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.closest('.edit-btn').dataset.id;
        this.startEdit(id);
      });
    });
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.closest('.save-btn').dataset.id;
        this.saveEdit(id);
      });
    });
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.cancelEdit();
      });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.closest('.delete-btn').dataset.id;
        this.deleteMonster(id);
      });
    });
    
    // Duplicate button event listeners
    document.querySelectorAll('.duplicate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.closest('.duplicate-btn').dataset.id;
        this.duplicateMonster(id);
      });
    });
    
    // Roll panel event listeners
    document.querySelectorAll('.roll-panel-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        this.toggleRollPanel(id);
      });
    });
    
    // Initiative roll buttons
    document.querySelectorAll('.initiative-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const modifier = parseInt(document.getElementById(`init-mod-${id}`).value) || 0;
        this.rollInitiative(id, modifier);
      });
    });
    
    // Ability check buttons
    document.querySelectorAll('.ability-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const ability = btn.dataset.ability;
        const modifier = parseInt(document.getElementById(`${ability}-check-mod-${id}`).value) || 0;
        this.rollAbilityCheck(id, ability, modifier);
      });
    });
    
    // Saving throw buttons
    document.querySelectorAll('.save-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const save = btn.dataset.save;
        const modifier = parseInt(document.getElementById(`${save}-save-mod-${id}`).value) || 0;
        this.rollSavingThrow(id, save, modifier);
      });
    });
    
    // Attack roll buttons
    document.querySelectorAll('.attack-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const attackIdx = parseInt(btn.dataset.attackIdx);
        const modifier = parseInt(document.getElementById(`attack-mod-${id}-${attackIdx}`).value) || 0;
        this.rollAttack(id, attackIdx, modifier);
      });
    });
    
    // Damage roll buttons
    document.querySelectorAll('.damage-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const attackIdx = parseInt(btn.dataset.attackIdx);
        const damageIdx = parseInt(btn.dataset.damageIdx);
        this.rollDamage(id, attackIdx, damageIdx);
      });
    });
  }

  getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  }

  // Get raw modifier value (number, not string)
  getModifierValue(score) {
    return Math.floor((score - 10) / 2);
  }

  getSave(score, proficiencyBonus = null) {
    // If proficiency bonus is provided (from bestiary), use it
    if (proficiencyBonus !== null && proficiencyBonus !== undefined) {
      // proficiency bonus from bestiary is like "+6" or "+8"
      const bonus = typeof proficiencyBonus === 'string' 
        ? parseInt(proficiencyBonus.replace('+', ''), 10) 
        : proficiencyBonus;
      return bonus >= 0 ? `+${bonus}` : bonus;
    }
    // Otherwise use base modifier
    return this.getModifier(score);
  }

  // Get raw save value (number) for input fields
  getSaveValue(score, proficiencyBonus = null) {
    if (proficiencyBonus !== null && proficiencyBonus !== undefined) {
      const bonus = typeof proficiencyBonus === 'string' 
        ? parseInt(proficiencyBonus.replace('+', ''), 10) 
        : proficiencyBonus;
      return bonus;
    }
    return this.getModifierValue(score);
  }

  // Toggle roll panel visibility
  toggleRollPanel(id) {
    if (this.expandedPanels.has(id)) {
      this.expandedPanels.delete(id);
    } else {
      this.expandedPanels.add(id);
    }
    
    // Toggle the panel visibility without full re-render
    const panel = document.getElementById(`roll-panel-${id}`);
    const toggleBtn = document.querySelector(`.roll-panel-toggle[data-id="${id}"]`);
    if (panel && toggleBtn) {
      panel.classList.toggle('expanded');
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (icon) {
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
      }
    }
  }

  // Build HTML for attack buttons
  buildAttackButtonsHtml(monster) {
    // Try to use pre-parsed attacks, otherwise parse from formatted actions text
    let attacks = monster.attacks;
    if (!attacks || attacks.length === 0) {
      // Parse from formatted actions text (for monsters loaded from database)
      attacks = parseFormattedActionsText(monster.actions);
      // Cache the parsed attacks on the monster object
      monster.attacks = attacks;
    }
    
    if (attacks.length === 0) {
      return '<div class="roll-section"><p class="no-attacks">No parsed attacks available</p></div>';
    }

    let html = '<div class="roll-section"><label>Attacks:</label><div class="attacks-container">';
    
    attacks.forEach((attack, idx) => {
      const attackTypeIcon = this.getAttackTypeIcon(attack.type);
      const hasToHit = attack.attackBonus !== null;
      const hasDamage = attack.damage && attack.damage.length > 0;
      
      html += `<div class="attack-row" data-attack-idx="${this.escapeHtml(idx)}">`;
      html += `<span class="attack-name">${attackTypeIcon} ${this.escapeHtml(attack.name)}</span>`;
      
      if (hasToHit) {
        html += `
          <div class="attack-to-hit">
            <input type="number" class="roll-modifier" id="attack-mod-${this.escapeHtml(monster.id)}-${idx}" value="${this.escapeHtml(attack.attackBonus)}" title="Attack bonus">
            <button class="roll-btn attack-roll" data-id="${this.escapeHtml(monster.id)}" data-attack-idx="${idx}" title="Roll to Hit">
              <i class="fa-solid fa-dice-d20"></i> Hit
            </button>
          </div>`;
      }
      
      if (hasDamage) {
        html += '<div class="attack-damages">';
        attack.damage.forEach((dmg, dmgIdx) => {
          html += `
            <button class="roll-btn damage-roll" data-id="${this.escapeHtml(monster.id)}" data-attack-idx="${idx}" data-damage-idx="${dmgIdx}" title="Roll ${this.escapeHtml(dmg.dice)} ${this.escapeHtml(dmg.type)} damage">
              <i class="fa-solid fa-burst"></i> ${this.escapeHtml(dmg.dice)}
            </button>`;
        });
        html += '</div>';
      }
      
      html += '</div>';
    });
    
    html += '</div></div>';
    return html;
  }

  // Get icon for attack type
  getAttackTypeIcon(type) {
    switch (type) {
      case 'mw': return '<i class="fa-solid fa-sword" title="Melee Weapon"></i>';
      case 'rw': return '<i class="fa-solid fa-bow-arrow" title="Ranged Weapon"></i>';
      case 'ms': return '<i class="fa-solid fa-wand-sparkles" title="Melee Spell"></i>';
      case 'rs': return '<i class="fa-solid fa-bolt" title="Ranged Spell"></i>';
      case 'mw/rw': return '<i class="fa-solid fa-hand-fist" title="Melee/Ranged"></i>';
      default: return '<i class="fa-solid fa-crosshairs"></i>';
    }
  }

  // ===== ROLL METHODS =====

  rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  // Emit roll data to socket
  emitRoll(rollData) {
    if (!this.socket || !this.getRoomCode) {
      console.warn('Socket not available for roll broadcast');
      return;
    }
    
    const roomCode = this.getRoomCode();
    if (!roomCode) {
      console.warn('No room code - roll not broadcast');
      return;
    }

    const fullRollData = {
      roomCode,
      ...rollData,
      timestamp: Date.now()
    };

    this.socket.emit('gm_roll', fullRollData);
    console.log('Monster roll sent:', fullRollData);
  }

  rollInitiative(monsterId, modifier) {
    const monster = this.monsters.find(m => m.id == monsterId);
    if (!monster) return;

    const roll = this.rollDice(20);
    const total = roll + modifier;

    this.emitRoll({
      roller: monster.name,
      diceType: 'd20',
      quantity: 1,
      result: total,
      rawResult: roll,
      individualRolls: [roll],
      modifier: modifier,
      label: 'Initiative',
      rollType: 'normal',
      rollMode: 'normal'
    });
  }

  rollAbilityCheck(monsterId, ability, modifier) {
    const monster = this.monsters.find(m => m.id == monsterId);
    if (!monster) return;

    const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    const roll = this.rollDice(20);
    const total = roll + modifier;

    this.emitRoll({
      roller: monster.name,
      diceType: 'd20',
      quantity: 1,
      result: total,
      rawResult: roll,
      individualRolls: [roll],
      modifier: modifier,
      label: `${abilityNames[ability]} Check`,
      rollType: 'normal',
      rollMode: 'normal'
    });
  }

  rollSavingThrow(monsterId, save, modifier) {
    const monster = this.monsters.find(m => m.id == monsterId);
    if (!monster) return;

    const saveNames = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
    const roll = this.rollDice(20);
    const total = roll + modifier;

    this.emitRoll({
      roller: monster.name,
      diceType: 'd20',
      quantity: 1,
      result: total,
      rawResult: roll,
      individualRolls: [roll],
      modifier: modifier,
      label: `${saveNames[save]} Save`,
      rollType: 'normal',
      rollMode: 'normal'
    });
  }

  rollAttack(monsterId, attackIdx, modifier) {
    const monster = this.monsters.find(m => m.id == monsterId);
    if (!monster || !monster.attacks || !monster.attacks[attackIdx]) return;

    const attack = monster.attacks[attackIdx];
    const roll = this.rollDice(20);
    const total = roll + modifier;

    this.emitRoll({
      roller: monster.name,
      diceType: 'd20',
      quantity: 1,
      result: total,
      rawResult: roll,
      individualRolls: [roll],
      modifier: modifier,
      label: `${attack.name} Attack`,
      rollType: 'normal',
      rollMode: 'normal'
    });
  }

  rollDamage(monsterId, attackIdx, damageIdx) {
    const monster = this.monsters.find(m => m.id == monsterId);
    if (!monster || !monster.attacks || !monster.attacks[attackIdx]) return;

    const attack = monster.attacks[attackIdx];
    const damage = attack.damage[damageIdx];
    if (!damage) return;

    // Parse dice formula: "2d6 + 5" or "1d8" etc.
    const { rolls, total, formula, modifier } = this.parseDiceFormula(damage.dice);

    this.emitRoll({
      roller: monster.name,
      diceType: formula,
      quantity: rolls.length,
      result: total,
      rawResult: total - (modifier || 0),
      individualRolls: rolls,
      modifier: modifier || 0,
      label: `${attack.name} (${damage.type} damage)`,
      rollType: 'damage',
      rollMode: 'normal'
    });
  }

  // Parse dice formula like "2d6 + 5" or "1d8"
  parseDiceFormula(formula) {
    // Match patterns like "2d6", "1d8 + 3", "3d6+5", "1d10 - 1"
    const match = formula.match(/(\d+)?d(\d+)\s*([+-]\s*\d+)?/i);
    if (!match) {
      console.warn('Could not parse dice formula:', formula);
      return { rolls: [0], total: 0, formula: formula, modifier: 0 };
    }

    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modifierStr = match[3] ? match[3].replace(/\s/g, '') : '0';
    const modifier = parseInt(modifierStr, 10) || 0;

    const rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const roll = this.rollDice(sides);
      rolls.push(roll);
      sum += roll;
    }

    return {
      rolls,
      total: sum + modifier,
      formula: `${count}d${sides}`,
      modifier
    };
  }

  startEdit(id) {
    this.editingId = id; // Keep as string - monster IDs are hex strings
    this.renderMonsters();
  }

  async saveEdit(id) {
    const monster = this.monsters.find(m => m.id == id);
    if (!monster) return;

    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newSource = document.getElementById(`edit-source-${id}`).value.trim();
    const newType = document.getElementById(`edit-type-${id}`).value.trim();
    const newAc = Number(document.getElementById(`edit-ac-${id}`).value);
    const newHp = Number(document.getElementById(`edit-hp-${id}`).value);
    const newHpMax = Number(document.getElementById(`edit-hp-max-${id}`).value) || newHp;
    const newHitDice = document.getElementById(`edit-hit-dice-${id}`).value.trim();
    const newSpeed = document.getElementById(`edit-speed-${id}`).value.trim();
    const newStr = Number(document.getElementById(`edit-str-${id}`).value) || 10;
    const newDex = Number(document.getElementById(`edit-dex-${id}`).value) || 10;
    const newCon = Number(document.getElementById(`edit-con-${id}`).value) || 10;
    const newInt = Number(document.getElementById(`edit-int-${id}`).value) || 10;
    const newWis = Number(document.getElementById(`edit-wis-${id}`).value) || 10;
    const newCha = Number(document.getElementById(`edit-cha-${id}`).value) || 10;
    const newSkills = document.getElementById(`edit-skills-${id}`).value.trim();
    const newSenses = document.getElementById(`edit-senses-${id}`).value.trim();
    const newLanguages = document.getElementById(`edit-languages-${id}`).value.trim();
    const newCr = document.getElementById(`edit-cr-${id}`).value.trim();
    const newActions = document.getElementById(`edit-actions-${id}`).value.trim();
    const newReactions = document.getElementById(`edit-reactions-${id}`).value.trim();

    monster.name = newName;
    monster.source = newSource;
    monster.type = newType;
    monster.ac = newAc;
    monster.hp = newHp;
    monster.hpMax = newHpMax;
    monster.hitDice = newHitDice;
    monster.speed = newSpeed;
    monster.abilities = { str: newStr, dex: newDex, con: newCon, int: newInt, wis: newWis, cha: newCha };
    monster.skills = newSkills;
    monster.senses = newSenses;
    monster.languages = newLanguages;
    monster.cr = newCr;
    monster.actions = newActions;
    monster.reactions = newReactions;

    // Save to database
    await this.saveMonsterToDb(monster);

    this.editingId = null;
    this.renderMonsters();
  }

  cancelEdit() {
    this.editingId = null;
    this.renderMonsters();
  }

  async deleteMonster(id) {
    // Delete from database first
    await this.deleteMonsterFromDb(id);
    this.monsters = this.monsters.filter(m => m.id != id);
    this.renderMonsters();
  }

  async duplicateMonster(id) {
    // Find the original monster
    const original = this.monsters.find(m => m.id == id);
    if (!original) {
      console.error('Monster not found for duplication:', id);
      return;
    }

    // Count existing copies to determine name suffix
    const baseName = original.name.replace(/\s*#\d+$/, ''); // Remove existing # suffix
    const existingCopies = this.monsters.filter(m => 
      m.name === baseName || m.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*#\\d+$`))
    ).length;

    // Create a copy without the id (so database creates a new one)
    const duplicate = {
      ...original,
      id: undefined, // New monster gets new ID
      name: `${baseName} #${existingCopies + 1}`,
      hp: original.hpMax || original.hp, // Reset HP to max
      displayOrder: this.monsters.length + 1
    };

    // Remove the id property entirely
    delete duplicate.id;

    // Save to database
    const savedMonster = await this.saveMonsterToDb(duplicate);
    
    // Add to list and re-render
    this.monsters.push(savedMonster);
    this.renderMonsters();

    // Broadcast update
    if (this.socket && this.getRoomCode) {
      this.socket.emit('monsterUpdate', {
        roomCode: this.getRoomCode(),
        monsters: this.monsters
      });
    }
  }

  clearForm() {
    // Clear all fields, including new ones
    document.getElementById('monster-name').value = '';
    document.getElementById('monster-source').value = '';
    document.getElementById('monster-type').value = '';
    document.getElementById('monster-ac').value = '';
    document.getElementById('monster-hp').value = '';
    document.getElementById('monster-hp-max').value = '';
    document.getElementById('monster-hit-dice').value = '';
    document.getElementById('monster-speed').value = '';
    document.getElementById('monster-str').value = '10';
    document.getElementById('monster-dex').value = '10';
    document.getElementById('monster-con').value = '10';
    document.getElementById('monster-int').value = '10';
    document.getElementById('monster-wis').value = '10';
    document.getElementById('monster-cha').value = '10';
    document.getElementById('monster-skills').value = '';
    document.getElementById('monster-senses').value = '';
    document.getElementById('monster-languages').value = '';
    document.getElementById('monster-cr').value = '';
    document.getElementById('monster-actions').value = '';
    document.getElementById('monster-reactions').value = '';
  }

  // Sanitize text to prevent XSS attacks
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Sanitize text and convert newlines to <br> safely
  escapeHtmlWithBreaks(text) {
    if (text === null || text === undefined) return 'None';
    const escaped = this.escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
  }
}