import { io } from 'socket.io-client';

// Initialize socket connection
const socket = io('http://localhost:3000');

// State
let playerName = '';
let currentRoom = null;
let currentRollRequest = null;
let characterSheet = {
  name: '',
  class: '',
  level: 1,
  background: '',
  race: '',
  alignment: '',
  xp: 0,
  playerName: '',
  hp: 0,
  maxHp: 0,
  hitDice: '',
  ac: 0,
  speed: '',
  abilities: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  },
  manualMods: {
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0
  },
  savingThrows: {
    str: false,
    dex: false,
    con: false,
    int: false,
    wis: false,
    cha: false
  },
  skills: {
    acrobatics: { prof: false, exp: false },
    'animal-handling': { prof: false, exp: false },
    arcana: { prof: false, exp: false },
    athletics: { prof: false, exp: false },
    deception: { prof: false, exp: false },
    history: { prof: false, exp: false },
    insight: { prof: false, exp: false },
    intimidation: { prof: false, exp: false },
    investigation: { prof: false, exp: false },
    medicine: { prof: false, exp: false },
    nature: { prof: false, exp: false },
    perception: { prof: false, exp: false },
    performance: { prof: false, exp: false },
    persuasion: { prof: false, exp: false },
    religion: { prof: false, exp: false },
    'sleight-of-hand': { prof: false, exp: false },
    stealth: { prof: false, exp: false },
    survival: { prof: false, exp: false }
  },
  armor: {
    name: '',
    ac: 0
  },
  weapons: [
    { name: '', damage: '', properties: '' },
    { name: '', damage: '', properties: '' },
    { name: '', damage: '', properties: '' }
  ],
  equipment: '',
  features: '',
  spells: '',
  spellcastingClass: '',
  spellcastingAbility: '',
  spellSaveDC: 0,
  spellAttackBonus: 0,
  cantrips: ['', '', '', '', '', '', '', ''],
  preparedSpells: {
    1: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    2: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    3: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    4: ['', '', '', '', '', '', ''],
    5: ['', '', '', '', '', '', ''],
    6: ['', '', '', '', ''],
    7: ['', '', '', '', ''],
    8: ['', '', '', ''],
    9: ['', '', '']
  },
  spellSlots: [
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 },
    { total: 0, expended: 0 }
  ]
};

// Connection status
socket.on('connect', () => {
  console.log('Connected to server');
  document.getElementById('connection-status').textContent = 'Connected';
  document.getElementById('connection-status').style.color = '#00ff00';
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connection-status').textContent = 'Disconnected';
  document.getElementById('connection-status').style.color = '#ff0000';
});

// Join room
document.getElementById('join-btn').addEventListener('click', async () => {
  const roomCode = document.getElementById('room-code').value.trim();
  const name = document.getElementById('player-name').value.trim();

  if (roomCode && name) {
    try {
      const response = await fetch('http://localhost:3000/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode })
      });
      if (response.ok) {
        playerName = name;
        currentRoom = roomCode;
        socket.emit('join_room', roomCode);
      } else {
        alert('Invalid room code');
      }
    } catch (error) {
      alert('Error joining room');
    }
  } else {
    alert('Please enter both room code and your name!');
  }
});

socket.on('joined_room', (data) => {
  console.log('Joined room:', data.roomCode);
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('roll-section').style.display = 'block';
  document.getElementById('character-sheet').style.display = 'block';
  loadCharacterSheet();
  alert(`Welcome, ${playerName}!`);
});

// Listen for roll assignments (MVP 3)
socket.on('assign_roll', (rollRequest) => {
  console.log('Roll request received:', rollRequest);
  currentRollRequest = rollRequest;
  
  document.getElementById('request-text').textContent = 
    `GM requests: ${rollRequest.label} (${rollRequest.diceType})`;
  document.getElementById('execute-roll-btn').style.display = 'block';
});

// Execute the assigned roll
document.getElementById('execute-roll-btn').addEventListener('click', () => {
  if (!currentRollRequest) return;

  const sides = parseInt(currentRollRequest.diceType.substring(1));
  const result = Math.floor(Math.random() * sides) + 1;

  const rollResult = {
    roomCode: currentRoom,
    playerName,
    diceType: currentRollRequest.diceType,
    result,
    label: currentRollRequest.label,
    timestamp: Date.now()
  };

  socket.emit('player_roll_result', rollResult);
  
  document.getElementById('result-display').textContent = 
    `You rolled: ${result}`;
  document.getElementById('execute-roll-btn').style.display = 'none';
  
  console.log('Roll result sent:', rollResult);
});

// Character Sheet Functions
function getProficiencyBonus(level) {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

function loadCharacterSheet() {
  document.getElementById('char-name').value = characterSheet.name;
  document.getElementById('char-class').value = characterSheet.class;
  document.getElementById('char-level').value = characterSheet.level;
  document.getElementById('char-background').value = characterSheet.background;
  document.getElementById('char-race').value = characterSheet.race;
  document.getElementById('char-alignment').value = characterSheet.alignment;
  document.getElementById('char-xp').value = characterSheet.xp;
  document.getElementById('char-player-name').value = characterSheet.playerName;
  document.getElementById('char-hp').value = characterSheet.hp;
  document.getElementById('char-max-hp').value = characterSheet.maxHp;
  document.getElementById('char-hit-dice').value = characterSheet.hitDice;
  document.getElementById('char-ac').value = characterSheet.ac;
  document.getElementById('char-speed').value = characterSheet.speed;
  document.getElementById('str-score').value = characterSheet.abilities.str;
  document.getElementById('dex-score').value = characterSheet.abilities.dex;
  document.getElementById('con-score').value = characterSheet.abilities.con;
  document.getElementById('int-score').value = characterSheet.abilities.int;
  document.getElementById('wis-score').value = characterSheet.abilities.wis;
  document.getElementById('cha-score').value = characterSheet.abilities.cha;
  document.getElementById('str-manual-mod').value = characterSheet.manualMods.str || 0;
  document.getElementById('dex-manual-mod').value = characterSheet.manualMods.dex || 0;
  document.getElementById('con-manual-mod').value = characterSheet.manualMods.con || 0;
  document.getElementById('int-manual-mod').value = characterSheet.manualMods.int || 0;
  document.getElementById('wis-manual-mod').value = characterSheet.manualMods.wis || 0;
  document.getElementById('cha-manual-mod').value = characterSheet.manualMods.cha || 0;

  // Saving throws
  Object.keys(characterSheet.savingThrows).forEach(ability => {
    document.getElementById(`${ability}-save-prof`).checked = characterSheet.savingThrows[ability];
  });

  // Skills
  Object.keys(characterSheet.skills).forEach(skill => {
    const id = skill.replace('-', '-');
    document.getElementById(`${id}-prof`).checked = characterSheet.skills[skill].prof;
    document.getElementById(`${id}-exp`).checked = characterSheet.skills[skill].exp;
  });

  // Armor
  document.getElementById('char-armor-name').value = characterSheet.armor.name;
  document.getElementById('char-armor-ac').value = characterSheet.armor.ac;

  // Weapons
  characterSheet.weapons.forEach((weapon, index) => {
    document.getElementById(`weapon-${index + 1}-name`).value = weapon.name;
    document.getElementById(`weapon-${index + 1}-damage`).value = weapon.damage;
    document.getElementById(`weapon-${index + 1}-properties`).value = weapon.properties;
  });

  // Equipment
  document.getElementById('char-equipment').value = characterSheet.equipment;

  // Features
  document.getElementById('char-features').value = characterSheet.features;

  // Spells
  document.getElementById('char-spells').value = characterSheet.spells;

  // Spellcasting Class
  document.getElementById('spellcasting-class').value = characterSheet.spellcastingClass;

  // Cantrips
  characterSheet.cantrips.forEach((cantrip, index) => {
    document.getElementById(`cantrip-${index + 1}`).value = cantrip;
  });

  // Prepared Spells
  Object.keys(characterSheet.preparedSpells).forEach(level => {
    characterSheet.preparedSpells[level].forEach((spell, index) => {
      document.getElementById(`spell-${level}-${index + 1}`).value = spell;
    });
  });

  // Spell Rules
  // Removed - now using structured fields

  // Spellcasting
  document.getElementById('spellcasting-ability').value = characterSheet.spellcastingAbility;
  document.getElementById('spell-save-dc').value = characterSheet.spellSaveDC;
  document.getElementById('spell-attack-bonus').value = characterSheet.spellAttackBonus;

  // Spell Slots
  characterSheet.spellSlots.forEach((slot, index) => {
    document.getElementById(`spell-slot-${index + 1}-total`).value = slot.total;
    document.getElementById(`spell-slot-${index + 1}-expended`).value = slot.expended;
  });

  updateAllCalculations();
}

function updateAllCalculations() {
  updateAbilities();
  updateSavingThrows();
  updateSkills();
  updateInitiative();
  updateProfBonus();
  updateSpellcastingAbility();
  updateSpellSlotDisplays();
}

function updateSavingThrows() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilities.forEach(ability => {
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const baseMod = mod + manual;
    const prof = document.getElementById(`${ability}-save-prof`).checked;
    const total = baseMod + (prof ? profBonus : 0);
    document.getElementById(`${ability}-save-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateSkills() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  const skillMap = {
    acrobatics: 'dex',
    'animal-handling': 'wis',
    arcana: 'int',
    athletics: 'str',
    deception: 'cha',
    history: 'int',
    insight: 'wis',
    intimidation: 'cha',
    investigation: 'int',
    medicine: 'wis',
    nature: 'int',
    perception: 'wis',
    performance: 'cha',
    persuasion: 'cha',
    religion: 'int',
    'sleight-of-hand': 'dex',
    stealth: 'dex',
    survival: 'wis'
  };
  Object.keys(skillMap).forEach(skill => {
    const ability = skillMap[skill];
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const baseMod = mod + manual;
    const prof = document.getElementById(`${skill.replace('-', '-')}-prof`).checked;
    const exp = document.getElementById(`${skill.replace('-', '-')}-exp`).checked;
    const bonus = (prof ? profBonus : 0) + (exp ? profBonus : 0);
    const total = baseMod + bonus;
    document.getElementById(`${skill.replace('-', '-')}-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateInitiative() {
  const dexScore = parseInt(document.getElementById('dex-score').value) || 10;
  const dexMod = Math.floor((dexScore - 10) / 2);
  const manual = parseInt(document.getElementById('dex-manual-mod').value) || 0;
  const total = dexMod + manual;
  document.getElementById('char-initiative').textContent = total >= 0 ? `+${total}` : total;
}

function updateProfBonus() {
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const bonus = getProficiencyBonus(level);
  document.getElementById('prof-bonus').textContent = `+${bonus}`;
}

function updateAbilities() {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilities.forEach(ability => {
    const score = parseInt(document.getElementById(`${ability}-score`).value) || 10;
    const mod = Math.floor((score - 10) / 2);
    document.getElementById(`${ability}-mod-calc`).textContent = mod >= 0 ? `+${mod}` : mod;
    const manual = parseInt(document.getElementById(`${ability}-manual-mod`).value) || 0;
    const total = mod + manual;
    document.getElementById(`${ability}-total`).textContent = total >= 0 ? `+${total}` : total;
  });
}

function updateSpellcastingAbility() {
  const ability = document.getElementById('spellcasting-ability').value;
  const display = ability ? ability.charAt(0).toUpperCase() + ability.slice(1) : 'None';
  document.getElementById('spellcasting-ability-display').textContent = display;
}

function updateSpellSlotDisplays() {
  for (let i = 1; i <= 9; i++) {
    const total = parseInt(document.getElementById(`spell-slot-${i}-total`).value) || 0;
    document.getElementById(`spell-slot-${i}-display`).textContent = total;
  }
}

function validateCharacterSheet() {
  const hp = parseInt(document.getElementById('char-hp').value);
  const maxHp = parseInt(document.getElementById('char-max-hp').value);
  if (hp < 0) {
    alert('HP cannot be negative');
    return false;
  }
  if (hp > maxHp) {
    alert('Current HP cannot exceed Max HP');
    return false;
  }
  return true;
}

// Form submit
document.getElementById('char-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateCharacterSheet()) return;

  characterSheet.name = document.getElementById('char-name').value;
  characterSheet.class = document.getElementById('char-class').value;
  characterSheet.level = parseInt(document.getElementById('char-level').value);
  characterSheet.background = document.getElementById('char-background').value;
  characterSheet.race = document.getElementById('char-race').value;
  characterSheet.alignment = document.getElementById('char-alignment').value;
  characterSheet.xp = parseInt(document.getElementById('char-xp').value) || 0;
  characterSheet.playerName = document.getElementById('char-player-name').value;
  characterSheet.hp = parseInt(document.getElementById('char-hp').value);
  characterSheet.maxHp = parseInt(document.getElementById('char-max-hp').value);
  characterSheet.hitDice = document.getElementById('char-hit-dice').value;
  characterSheet.ac = parseInt(document.getElementById('char-ac').value) || 0;
  characterSheet.speed = document.getElementById('char-speed').value;
  characterSheet.abilities.str = parseInt(document.getElementById('str-score').value);
  characterSheet.abilities.dex = parseInt(document.getElementById('dex-score').value);
  characterSheet.abilities.con = parseInt(document.getElementById('con-score').value);
  characterSheet.abilities.int = parseInt(document.getElementById('int-score').value);
  characterSheet.abilities.wis = parseInt(document.getElementById('wis-score').value);
  characterSheet.abilities.cha = parseInt(document.getElementById('cha-score').value);
  characterSheet.manualMods.str = parseInt(document.getElementById('str-manual-mod').value) || 0;
  characterSheet.manualMods.dex = parseInt(document.getElementById('dex-manual-mod').value) || 0;
  characterSheet.manualMods.con = parseInt(document.getElementById('con-manual-mod').value) || 0;
  characterSheet.manualMods.int = parseInt(document.getElementById('int-manual-mod').value) || 0;
  characterSheet.manualMods.wis = parseInt(document.getElementById('wis-manual-mod').value) || 0;
  characterSheet.manualMods.cha = parseInt(document.getElementById('cha-manual-mod').value) || 0;

  // Saving throws
  Object.keys(characterSheet.savingThrows).forEach(ability => {
    characterSheet.savingThrows[ability] = document.getElementById(`${ability}-save-prof`).checked;
  });

  // Skills
  Object.keys(characterSheet.skills).forEach(skill => {
    const id = skill.replace('-', '-');
    characterSheet.skills[skill].prof = document.getElementById(`${id}-prof`).checked;
    characterSheet.skills[skill].exp = document.getElementById(`${id}-exp`).checked;
  });

  // Armor
  characterSheet.armor.name = document.getElementById('char-armor-name').value;
  characterSheet.armor.ac = parseInt(document.getElementById('char-armor-ac').value) || 0;

  // Weapons
  characterSheet.weapons = [];
  for (let i = 1; i <= 3; i++) {
    characterSheet.weapons.push({
      name: document.getElementById(`weapon-${i}-name`).value,
      damage: document.getElementById(`weapon-${i}-damage`).value,
      properties: document.getElementById(`weapon-${i}-properties`).value
    });
  }

  // Equipment
  characterSheet.equipment = document.getElementById('char-equipment').value;

  // Features
  characterSheet.features = document.getElementById('char-features').value;

  // Spells
  characterSheet.spells = document.getElementById('char-spells').value;

  // Spellcasting Class
  characterSheet.spellcastingClass = document.getElementById('spellcasting-class').value;

  // Cantrips
  characterSheet.cantrips = [];
  for (let i = 1; i <= 8; i++) {
    characterSheet.cantrips.push(document.getElementById(`cantrip-${i}`).value);
  }

  // Prepared Spells
  characterSheet.preparedSpells = {};
  for (let level = 1; level <= 9; level++) {
    characterSheet.preparedSpells[level] = [];
    const maxSpells = level === 1 ? 15 : level === 2 || level === 3 ? 13 : level === 4 || level === 5 ? 7 : level === 6 || level === 7 ? 5 : level === 8 ? 4 : 3;
    for (let i = 1; i <= maxSpells; i++) {
      characterSheet.preparedSpells[level].push(document.getElementById(`spell-${level}-${i}`).value);
    }
  }

  // Spell Rules
  // Removed - now using structured fields

  // Spellcasting
  characterSheet.spellcastingAbility = document.getElementById('spellcasting-ability').value;
  characterSheet.spellSaveDC = parseInt(document.getElementById('spell-save-dc').value) || 0;
  characterSheet.spellAttackBonus = parseInt(document.getElementById('spell-attack-bonus').value) || 0;

  // Spell Slots
  characterSheet.spellSlots = [];
  for (let i = 1; i <= 9; i++) {
    characterSheet.spellSlots.push({
      total: parseInt(document.getElementById(`spell-slot-${i}-total`).value) || 0,
      expended: parseInt(document.getElementById(`spell-slot-${i}-expended`).value) || 0
    });
  }
});

// Update calculations on changes
document.querySelectorAll('input[id="char-level"]').forEach(input => {
  input.addEventListener('input', updateAllCalculations);
});

document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', updateAllCalculations);
});

document.querySelectorAll('input[id$="-score"], input[id$="-manual-mod"]').forEach(input => {
  input.addEventListener('input', updateAllCalculations);
});

document.querySelectorAll('input[id^="spell-slot-"][id$="-total"]').forEach(input => {
  input.addEventListener('input', updateSpellSlotDisplays);
});

document.getElementById('spellcasting-ability').addEventListener('change', updateSpellcastingAbility);

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab + '-tab').classList.add('active');
  });
});

// Combat tab switching
document.querySelectorAll('.combat-tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.combat-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.combat-tab-pane').forEach(pane => pane.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab + '-tab').classList.add('active');
  });
});
