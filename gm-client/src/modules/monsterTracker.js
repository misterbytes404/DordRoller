// MVP 2: Monster tracking functionality (UI-focused, in-memory with bestiary integration)

export class MonsterTracker {
  constructor() {
    this.monsters = [];  // In-memory storage (replace with DB later)
    this.editingId = null;  // Track which monster is being edited
    this.bestiary = new Map();  // Map of name -> bestiary monster data
    this.debounceTimer = null;  // For debouncing search input
    this.init();
  }

  async init() {
    await this.loadBestiary();
    const addBtn = document.getElementById('add-monster-btn');
    addBtn.addEventListener('click', () => this.addMonster());

    // Add search functionality with debouncing
    const searchInput = document.getElementById('monster-search');
    searchInput.addEventListener('input', (e) => this.debouncedSearch(e.target.value));
  }

  debouncedSearch(query) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.searchMonsters(query), 300);  // 300ms delay
  }

  async loadBestiary() {
    // List of bestiary files (hardcoded from directory listing; ~100 files)
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
      li.textContent = `${name} (${this.bestiary.get(name).source})`;
      li.addEventListener('click', () => this.selectMonster(name));
      resultsList.appendChild(li);
    });
    resultsList.style.display = 'block';
  }

  selectMonster(name) {
    const monster = this.bestiary.get(name);
    if (!monster) return;

    // Populate form fields
    document.getElementById('monster-name').value = monster.name;
    document.getElementById('monster-source').value = monster.source;
    document.getElementById('monster-type').value = `${monster.size ? monster.size[0] : 'M'} ${monster.type.type} (${monster.type.tags ? monster.type.tags.join(', ') : ''})`;
    document.getElementById('monster-ac').value = monster.ac ? monster.ac[0] : 10 + Math.floor(((monster.dex || 10) - 10) / 2);
    document.getElementById('monster-hp').value = monster.hp ? monster.hp.average : 1;
    document.getElementById('monster-hit-dice').value = monster.hp ? monster.hp.formula : '';
    document.getElementById('monster-speed').value = this.formatSpeed(monster.speed);
    document.getElementById('monster-str').value = monster.str || 10;
    document.getElementById('monster-dex').value = monster.dex || 10;
    document.getElementById('monster-con').value = monster.con || 10;
    document.getElementById('monster-int').value = monster.int || 10;
    document.getElementById('monster-wis').value = monster.wis || 10;
    document.getElementById('monster-cha').value = monster.cha || 10;
    document.getElementById('monster-skills').value = this.formatSkills(monster.skill);
    document.getElementById('monster-senses').value = `passive Perception ${monster.passive || 10}`;
    document.getElementById('monster-languages').value = monster.languages ? monster.languages.join(', ') : '';
    document.getElementById('monster-cr').value = monster.cr || '';
    document.getElementById('monster-actions').value = this.formatActions(monster.action);
    document.getElementById('monster-reactions').value = this.formatActions(monster.reaction);

    // Hide search results
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('monster-search').value = '';
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

  addMonster() {
    const name = document.getElementById('monster-name').value.trim();
    const source = document.getElementById('monster-source').value.trim();
    const type = document.getElementById('monster-type').value.trim();
    const ac = Number(document.getElementById('monster-ac').value);
    const hp = Number(document.getElementById('monster-hp').value);
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

    const monster = {
      id: Date.now(),
      name,
      source,
      type,
      ac,
      hp,
      hitDice,
      speed,
      abilities: { str, dex, con, int, wis, cha },
      skills,
      senses,
      languages,
      cr,
      actions,
      reactions
    };
    this.monsters.push(monster);
    this.renderMonsters();
    this.clearForm();
  }

  renderMonsters() {
    const list = document.getElementById('monster-list');
    list.innerHTML = '';
    this.monsters.forEach(monster => {
      const card = document.createElement('div');
      card.className = 'monster-card';
      if (this.editingId === monster.id) {
        // Edit mode: Show all inputs with labels
        card.innerHTML = `
          <label for="edit-name-${monster.id}">Name:</label><br>
          <input type="text" id="edit-name-${monster.id}" value="${monster.name}"><br>
          <label for="edit-source-${monster.id}">Source:</label><br>
          <input type="text" id="edit-source-${monster.id}" value="${monster.source || ''}"><br>
          <label for="edit-type-${monster.id}">Type:</label><br>
          <input type="text" id="edit-type-${monster.id}" value="${monster.type}"><br>
          <label for="edit-ac-${monster.id}">AC:</label><br>
          <input type="number" id="edit-ac-${monster.id}" value="${monster.ac}"><br>
          <label for="edit-hp-${monster.id}">HP:</label><br>
          <input type="number" id="edit-hp-${monster.id}" value="${monster.hp}"><br>
          <label for="edit-hit-dice-${monster.id}">Hit Dice:</label><br>
          <input type="text" id="edit-hit-dice-${monster.id}" value="${monster.hitDice || ''}"><br>
          <label for="edit-speed-${monster.id}">Speed:</label><br>
          <input type="text" id="edit-speed-${monster.id}" value="${monster.speed}"><br>
          <label for="edit-str-${monster.id}">STR:</label><br>
          <input type="number" id="edit-str-${monster.id}" value="${monster.abilities.str}" min="1" max="30"><br>
          <label for="edit-dex-${monster.id}">DEX:</label><br>
          <input type="number" id="edit-dex-${monster.id}" value="${monster.abilities.dex}" min="1" max="30"><br>
          <label for="edit-con-${monster.id}">CON:</label><br>
          <input type="number" id="edit-con-${monster.id}" value="${monster.abilities.con}" min="1" max="30"><br>
          <label for="edit-int-${monster.id}">INT:</label><br>
          <input type="number" id="edit-int-${monster.id}" value="${monster.abilities.int}" min="1" max="30"><br>
          <label for="edit-wis-${monster.id}">WIS:</label><br>
          <input type="number" id="edit-wis-${monster.id}" value="${monster.abilities.wis}" min="1" max="30"><br>
          <label for="edit-cha-${monster.id}">CHA:</label><br>
          <input type="number" id="edit-cha-${monster.id}" value="${monster.abilities.cha}" min="1" max="30"><br>
          <label for="edit-skills-${monster.id}">Skills:</label><br>
          <input type="text" id="edit-skills-${monster.id}" value="${monster.skills || ''}"><br>
          <label for="edit-senses-${monster.id}">Senses:</label><br>
          <input type="text" id="edit-senses-${monster.id}" value="${monster.senses || ''}"><br>
          <label for="edit-languages-${monster.id}">Languages:</label><br>
          <input type="text" id="edit-languages-${monster.id}" value="${monster.languages || ''}"><br>
          <label for="edit-cr-${monster.id}">CR:</label><br>
          <input type="text" id="edit-cr-${monster.id}" value="${monster.cr || ''}"><br>
          <label for="edit-actions-${monster.id}">Actions:</label><br>
          <textarea id="edit-actions-${monster.id}">${monster.actions || ''}</textarea><br>
          <label for="edit-reactions-${monster.id}">Reactions:</label><br>
          <textarea id="edit-reactions-${monster.id}">${monster.reactions || ''}</textarea><br>
          <button class="save-btn" data-id="${monster.id}">Save</button>
          <button class="cancel-btn" data-id="${monster.id}">Cancel</button>
        `;
      } else {
        // Display mode: Specified format
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
          <p><strong>Name:</strong> ${monster.name}</p>
          <p><strong>Source:</strong> ${monster.source || 'Unknown'}</p>
          <p><strong>Type:</strong> ${monster.type}</p>
          <hr>
          <p><strong>AC:</strong> ${monster.ac || (10 + Math.floor(((monster.abilities.dex || 10) - 10) / 2))}</p>
          <p><strong>Initiative:</strong> ${modDex}</p>
          <p><strong>HP:</strong> ${monster.hp}</p>
          <p><strong>Hit Dice:</strong> ${monster.hitDice || 'N/A'}</p>
          <p><strong>Speed:</strong> ${monster.speed}</p>
          <hr>
          <table class="abilities-table">
            <tr><th>Attribute</th><th>Score</th><th>Mod</th><th>Save</th></tr>
            <tr><td>Str</td><td>${monster.abilities.str}</td><td>${modStr}</td><td>${saveStr}</td></tr>
            <tr><td>Dex</td><td>${monster.abilities.dex}</td><td>${modDexAttr}</td><td>${saveDex}</td></tr>
            <tr><td>Con</td><td>${monster.abilities.con}</td><td>${modCon}</td><td>${saveCon}</td></tr>
            <tr><td>Int</td><td>${monster.abilities.int}</td><td>${modInt}</td><td>${saveInt}</td></tr>
            <tr><td>Wis</td><td>${monster.abilities.wis}</td><td>${modWis}</td><td>${saveWis}</td></tr>
            <tr><td>Cha</td><td>${monster.abilities.cha}</td><td>${modCha}</td><td>${saveCha}</td></tr>
          </table>
          <hr>
          <p><strong>Skills:</strong> ${monster.skills || 'None'}</p>
          <p><strong>Senses:</strong> ${monster.senses || 'None'}</p>
          <p><strong>Languages:</strong> ${monster.languages || 'None'}</p>
          <p><strong>CR:</strong> ${monster.cr || 'N/A'}</p>
          <hr>
          <p><strong>Actions:</strong><br>${monster.actions ? monster.actions.replace(/\n/g, '<br>') : 'None'}</p>
          <p><strong>Reactions:</strong><br>${monster.reactions ? monster.reactions.replace(/\n/g, '<br>') : 'None'}</p>
          <button class="edit-btn" data-id="${monster.id}">Edit</button>
          <button class="delete-btn" data-id="${monster.id}">Delete</button>
        `;
      }
      list.appendChild(card);
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

  saveEdit(id) {
    const monster = this.monsters.find(m => m.id == id);
    if (!monster) return;

    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newSource = document.getElementById(`edit-source-${id}`).value.trim();
    const newType = document.getElementById(`edit-type-${id}`).value.trim();
    const newAc = Number(document.getElementById(`edit-ac-${id}`).value);
    const newHp = Number(document.getElementById(`edit-hp-${id}`).value);
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
    monster.hitDice = newHitDice;
    monster.speed = newSpeed;
    monster.abilities = { str: newStr, dex: newDex, con: newCon, int: newInt, wis: newWis, cha: newCha };
    monster.skills = newSkills;
    monster.senses = newSenses;
    monster.languages = newLanguages;
    monster.cr = newCr;
    monster.actions = newActions;
    monster.reactions = newReactions;

    this.editingId = null;
    this.renderMonsters();
  }

  cancelEdit() {
    this.editingId = null;
    this.renderMonsters();
  }

  deleteMonster(id) {
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
}