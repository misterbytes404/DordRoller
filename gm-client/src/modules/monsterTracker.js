// MVP 2: Monster tracking functionality (UI-focused with database persistence)

// API base URL
const API_URL = 'http://localhost:3000/api';

export class MonsterTracker {
  constructor() {
    this.monsters = [];  // In-memory cache
    this.roomId = null;  // Database room ID for persistence
    this.editingId = null;  // Track which monster is being edited
    this.bestiary = new Map();  // Map of name -> bestiary monster data
    this.debounceTimer = null;  // For debouncing search input
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

    const promises = files.map(file => fetch(`/data/bestiary/${file}`).then(r => r.json()).catch(() => null));
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
        const saveStr = this.getSave(monster.abilities.str);
        const modDexAttr = this.getModifier(monster.abilities.dex);
        const saveDex = this.getSave(monster.abilities.dex);
        const modCon = this.getModifier(monster.abilities.con);
        const saveCon = this.getSave(monster.abilities.con);
        const modInt = this.getModifier(monster.abilities.int);
        const saveInt = this.getSave(monster.abilities.int);
        const modWis = this.getModifier(monster.abilities.wis);
        const saveWis = this.getSave(monster.abilities.wis);
        const modCha = this.getModifier(monster.abilities.cha);
        const saveCha = this.getSave(monster.abilities.cha);

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
          <p><strong>Actions:</strong><br>${this.escapeHtmlWithBreaks(monster.actions)}</p>
          <p><strong>Reactions:</strong><br>${this.escapeHtmlWithBreaks(monster.reactions)}</p>
          <button class="edit-btn" data-id="${monster.id}">Edit</button>
          <button class="delete-btn" data-id="${monster.id}">Delete</button>
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
      btn.addEventListener('click', (e) => this.startEdit(e.target.dataset.id));
    });
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.saveEdit(e.target.dataset.id));
    });
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.cancelEdit());
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.deleteMonster(e.target.dataset.id));
    });
  }

  getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  }

  getSave(score) {
    // Assuming base save is modifier; adjust if proficiencies are added later
    return this.getModifier(score);
  }

  startEdit(id) {
    this.editingId = Number(id);
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