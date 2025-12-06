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
    { name: '', damage: '', properties: '', ability: 'str' },
    { name: '', damage: '', properties: '', ability: 'str' },
    { name: '', damage: '', properties: '', ability: 'str' }
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
    if (document.getElementById(`weapon-${index + 1}-ability`)) {
      document.getElementById(`weapon-${index + 1}-ability`).value = weapon.ability || 'str';
    }
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
      properties: document.getElementById(`weapon-${i}-properties`).value,
      ability: document.getElementById(`weapon-${i}-ability`) ? document.getElementById(`weapon-${i}-ability`).value : 'str'
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

// ===== PLAYER DICE ROLLER (Phase 1: Quick Roll Buttons) =====

const abilityNames = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

const skillNames = {
  'acrobatics': 'Acrobatics',
  'animal-handling': 'Animal Handling',
  'arcana': 'Arcana',
  'athletics': 'Athletics',
  'deception': 'Deception',
  'history': 'History',
  'insight': 'Insight',
  'intimidation': 'Intimidation',
  'investigation': 'Investigation',
  'medicine': 'Medicine',
  'nature': 'Nature',
  'perception': 'Perception',
  'performance': 'Performance',
  'persuasion': 'Persuasion',
  'religion': 'Religion',
  'sleight-of-hand': 'Sleight of Hand',
  'stealth': 'Stealth',
  'survival': 'Survival'
};

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function getModifierFromElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return 0;
  const text = element.textContent;
  return parseInt(text) || 0;
}

function handleQuickRoll(rollType, key) {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }

  let modifier = 0;
  let label = '';
  let characterName = document.getElementById('char-name').value || 'Unknown';

  if (rollType === 'ability') {
    modifier = getModifierFromElement(`${key}-total`);
    label = `${abilityNames[key]} Check`;
  } else if (rollType === 'save') {
    modifier = getModifierFromElement(`${key}-save-total`);
    label = `${abilityNames[key]} Save`;
  } else if (rollType === 'skill') {
    modifier = getModifierFromElement(`${key}-total`);
    label = `${skillNames[key]} Check`;
  }

  const d20Result = rollD20();
  const total = d20Result + modifier;

  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: 1,
    result: total,
    label: label,
    modifier: modifier,
    rawResult: d20Result,
    individualRolls: [d20Result],
    rollType: 'normal',
    timestamp: Date.now()
  };

  // Emit the roll to the server
  socket.emit('player_roll', rollData);
  console.log('Player roll sent:', rollData);

  // Show feedback to the player
  showRollFeedback(d20Result, modifier, total, label);
}

function showRollFeedback(roll, modifier, total, label) {
  const toast = document.getElementById('roll-toast');
  const modSign = modifier >= 0 ? '+' : '';
  
  // Remove any existing classes
  toast.classList.remove('show', 'nat-20', 'nat-1');
  
  // Add nat 20/1 class if applicable
  if (roll === 20) toast.classList.add('nat-20');
  else if (roll === 1) toast.classList.add('nat-1');
  
  toast.innerHTML = `
    <button class="roll-toast-close" onclick="closeRollToast()">&times;</button>
    <div class="roll-toast-content">
      <div class="roll-toast-header">${label}</div>
      <div class="roll-toast-body">
        <span class="roll-toast-dice">
          <i class="fa-solid fa-dice-d20"></i>
          <span class="roll-value">${roll}</span>
        </span>
        <span class="roll-toast-modifier">${modSign}${modifier}</span>
        <span>=</span>
        <span class="roll-toast-total">${total}</span>
      </div>
    </div>
  `;
  
  // Trigger reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');
  
  // Auto-hide after 5 seconds
  clearTimeout(window.rollToastTimeout);
  window.rollToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// Global function to close toast
window.closeRollToast = function() {
  const toast = document.getElementById('roll-toast');
  toast.classList.remove('show');
  clearTimeout(window.rollToastTimeout);
};

// Attach event listeners to ability/save/skill roll buttons ONLY (not attack/damage/combat buttons)
document.querySelectorAll('.roll-btn[data-roll-type="ability"], .roll-btn[data-roll-type="save"], .roll-btn[data-roll-type="skill"]').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const rollType = button.dataset.rollType;
    const key = button.dataset.ability || button.dataset.skill;
    handleQuickRoll(rollType, key);
  });
});

// ===== COMBAT DICE ROLLER (Phase 2: Attack, Damage, Initiative, Spell Attack) =====

// Roll any dice
function rollDice(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Roll multiple dice
function rollMultipleDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDice(sides));
  }
  return rolls;
}

// Parse dice notation (e.g., "2d6+3", "1d8", "4d6+2")
function parseDiceNotation(notation) {
  if (!notation) return null;
  
  // Clean the notation
  const clean = notation.toLowerCase().replace(/\s/g, '');
  
  // Match patterns like 2d6+3, 1d8, 2d6-1, etc.
  const match = clean.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
  
  if (!match) return null;
  
  return {
    count: parseInt(match[1]) || 1,
    sides: parseInt(match[2]),
    modifier: parseInt(match[3]) || 0
  };
}

// Get attack modifier for a weapon
function getWeaponAttackModifier(weaponIndex) {
  const abilitySelect = document.getElementById(`weapon-${weaponIndex}-ability`);
  const ability = abilitySelect ? abilitySelect.value : 'str';
  const abilityMod = getModifierFromElement(`${ability}-total`);
  const level = parseInt(document.getElementById('char-level').value) || 1;
  const profBonus = getProficiencyBonus(level);
  
  return abilityMod + profBonus;
}

// Handle initiative roll
function handleInitiativeRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const modifier = getModifierFromElement('char-initiative');
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const d20Result = rollD20();
  const total = d20Result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: 1,
    result: total,
    label: 'Initiative',
    modifier: modifier,
    rawResult: d20Result,
    individualRolls: [d20Result],
    rollType: 'initiative',
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(d20Result, modifier, total, 'Initiative');
}

// Handle spell attack roll
function handleSpellAttackRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const modifier = parseInt(document.getElementById('spell-attack-bonus').value) || 0;
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const d20Result = rollD20();
  const total = d20Result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: 1,
    result: total,
    label: 'Spell Attack',
    modifier: modifier,
    rawResult: d20Result,
    individualRolls: [d20Result],
    rollType: 'spell-attack',
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(d20Result, modifier, total, 'Spell Attack');
}

// Handle weapon attack roll
function handleWeaponAttackRoll(weaponIndex) {
  if (!currentRoom) {
    alert('Please join a room first!');
    return;
  }
  
  const weaponName = document.getElementById(`weapon-${weaponIndex}-name`).value || `Weapon ${weaponIndex}`;
  const modifier = getWeaponAttackModifier(weaponIndex);
  const characterName = document.getElementById('char-name').value || 'Unknown';
  const d20Result = rollD20();
  const total = d20Result + modifier;
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'd20',
    quantity: 1,
    result: total,
    label: `${weaponName} Attack`,
    modifier: modifier,
    rawResult: d20Result,
    individualRolls: [d20Result],
    rollType: 'weapon-attack',
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  showRollFeedback(d20Result, modifier, total, `${weaponName} Attack`);
}

// ===== DAMAGE MODAL =====
let currentDamageContext = {
  weaponIndex: null,
  weaponName: '',
  isSpell: false
};

function openDamageModal(weaponIndex = null, isSpell = false) {
  const modal = document.getElementById('damage-modal');
  const title = document.getElementById('damage-modal-title');
  
  currentDamageContext.weaponIndex = weaponIndex;
  currentDamageContext.isSpell = isSpell;
  
  if (isSpell) {
    title.textContent = 'Roll Spell Damage';
    currentDamageContext.weaponName = 'Spell';
    
    // Parse spell damage dice
    const spellDamage = document.getElementById('spell-damage-dice').value;
    const parsed = parseDiceNotation(spellDamage);
    
    if (parsed) {
      document.getElementById('damage-dice-count').value = parsed.count;
      document.getElementById('damage-dice-type').value = parsed.sides;
      document.getElementById('damage-modifier').value = parsed.modifier;
    } else {
      // Default spell damage
      document.getElementById('damage-dice-count').value = 1;
      document.getElementById('damage-dice-type').value = 6;
      document.getElementById('damage-modifier').value = 0;
    }
  } else {
    const weaponName = document.getElementById(`weapon-${weaponIndex}-name`).value || `Weapon ${weaponIndex}`;
    title.textContent = `Roll ${weaponName} Damage`;
    currentDamageContext.weaponName = weaponName;
    
    // Parse weapon damage
    const weaponDamage = document.getElementById(`weapon-${weaponIndex}-damage`).value;
    const parsed = parseDiceNotation(weaponDamage);
    
    if (parsed) {
      document.getElementById('damage-dice-count').value = parsed.count;
      document.getElementById('damage-dice-type').value = parsed.sides;
      document.getElementById('damage-modifier').value = parsed.modifier;
    } else {
      // Default weapon damage
      document.getElementById('damage-dice-count').value = 1;
      document.getElementById('damage-dice-type').value = 8;
      document.getElementById('damage-modifier').value = 0;
    }
  }
  
  // Reset extra dice and crit
  document.getElementById('extra-dice-count').value = 0;
  document.getElementById('damage-crit-toggle').checked = false;
  
  updateDamagePreview();
  modal.classList.add('show');
}

function closeDamageModal() {
  const modal = document.getElementById('damage-modal');
  modal.classList.remove('show');
}

function updateDamagePreview() {
  const baseCount = parseInt(document.getElementById('damage-dice-count').value) || 1;
  const baseSides = document.getElementById('damage-dice-type').value;
  const modifier = parseInt(document.getElementById('damage-modifier').value) || 0;
  const extraCount = parseInt(document.getElementById('extra-dice-count').value) || 0;
  const extraSides = document.getElementById('extra-dice-type').value;
  const isCrit = document.getElementById('damage-crit-toggle').checked;
  
  let preview = '';
  const critMultiplier = isCrit ? 2 : 1;
  const effectiveBaseCount = baseCount * critMultiplier;
  const effectiveExtraCount = extraCount * critMultiplier;
  
  preview += `${effectiveBaseCount}d${baseSides}`;
  
  if (effectiveExtraCount > 0) {
    preview += ` + ${effectiveExtraCount}d${extraSides}`;
  }
  
  if (modifier !== 0) {
    preview += modifier >= 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  }
  
  if (isCrit) {
    preview += ' (CRIT!)';
  }
  
  document.getElementById('damage-preview-text').textContent = preview;
}

function executeDamageRoll() {
  if (!currentRoom) {
    alert('Please join a room first!');
    closeDamageModal();
    return;
  }
  
  const baseCount = parseInt(document.getElementById('damage-dice-count').value) || 1;
  const baseSides = parseInt(document.getElementById('damage-dice-type').value);
  const modifier = parseInt(document.getElementById('damage-modifier').value) || 0;
  const extraCount = parseInt(document.getElementById('extra-dice-count').value) || 0;
  const extraSides = parseInt(document.getElementById('extra-dice-type').value);
  const isCrit = document.getElementById('damage-crit-toggle').checked;
  
  const critMultiplier = isCrit ? 2 : 1;
  const effectiveBaseCount = baseCount * critMultiplier;
  const effectiveExtraCount = extraCount * critMultiplier;
  
  // Roll base damage
  const baseRolls = rollMultipleDice(effectiveBaseCount, baseSides);
  const baseTotal = baseRolls.reduce((a, b) => a + b, 0);
  
  // Roll extra damage
  let extraRolls = [];
  let extraTotal = 0;
  if (effectiveExtraCount > 0) {
    extraRolls = rollMultipleDice(effectiveExtraCount, extraSides);
    extraTotal = extraRolls.reduce((a, b) => a + b, 0);
  }
  
  const total = baseTotal + extraTotal + modifier;
  const characterName = document.getElementById('char-name').value || 'Unknown';
  
  // Build description
  let diceDescription = `${effectiveBaseCount}d${baseSides}`;
  if (effectiveExtraCount > 0) {
    diceDescription += ` + ${effectiveExtraCount}d${extraSides}`;
  }
  
  const rollData = {
    roomCode: currentRoom,
    roller: playerName,
    characterName: characterName,
    diceType: 'damage',
    quantity: effectiveBaseCount + effectiveExtraCount,
    result: total,
    label: `${currentDamageContext.weaponName} Damage${isCrit ? ' (CRITICAL!)' : ''}`,
    modifier: modifier,
    rawResult: baseTotal + extraTotal,
    individualRolls: [...baseRolls, ...extraRolls],
    rollType: currentDamageContext.isSpell ? 'spell-damage' : 'weapon-damage',
    isCritical: isCrit,
    diceDescription: diceDescription,
    timestamp: Date.now()
  };
  
  socket.emit('player_roll', rollData);
  
  // Show damage feedback
  showDamageFeedback(rollData);
  
  closeDamageModal();
}

function showDamageFeedback(rollData) {
  const toast = document.getElementById('roll-toast');
  
  // Remove any existing classes
  toast.classList.remove('show', 'nat-20', 'nat-1');
  
  // Add crit styling if applicable
  if (rollData.isCritical) {
    toast.classList.add('nat-20');
  }
  
  // Format the rolls display
  const rollsDisplay = rollData.individualRolls.map(r => r).join(' + ');
  const modSign = rollData.modifier >= 0 ? '+' : '';
  
  toast.innerHTML = `
    <button class="roll-toast-close" onclick="closeRollToast()">&times;</button>
    <div class="roll-toast-content">
      <div class="roll-toast-header">${rollData.label}</div>
      <div class="roll-toast-body damage-toast-body">
        <div class="damage-dice-display">
          <i class="fa-solid fa-burst"></i>
          <span class="damage-rolls">[${rollsDisplay}]</span>
        </div>
        <span class="roll-toast-modifier">${modSign}${rollData.modifier}</span>
        <span>=</span>
        <span class="roll-toast-total">${rollData.result}</span>
      </div>
      <div class="damage-dice-notation">${rollData.diceDescription}${rollData.modifier !== 0 ? (modSign + rollData.modifier) : ''}</div>
    </div>
  `;
  
  // Trigger reflow and show
  void toast.offsetWidth;
  toast.classList.add('show');
  
  // Auto-hide after 6 seconds (longer for damage)
  clearTimeout(window.rollToastTimeout);
  window.rollToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

// Event Listeners for Combat Rolls
document.querySelectorAll('.combat-roll-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const rollType = button.dataset.rollType;
    
    if (rollType === 'initiative') {
      handleInitiativeRoll();
    } else if (rollType === 'spell-attack') {
      handleSpellAttackRoll();
    }
  });
});

document.querySelectorAll('.attack-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const weaponIndex = button.dataset.weapon;
    handleWeaponAttackRoll(weaponIndex);
  });
});

document.querySelectorAll('.damage-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const weaponIndex = button.dataset.weapon;
    const isSpellDamage = button.dataset.rollType === 'spell-damage';
    openDamageModal(weaponIndex, isSpellDamage);
  });
});

// Modal event listeners
document.getElementById('damage-modal-close').addEventListener('click', closeDamageModal);
document.getElementById('damage-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeDamageModal();
  }
});
document.getElementById('damage-roll-btn').addEventListener('click', executeDamageRoll);

// Update preview when modal inputs change
['damage-dice-count', 'damage-dice-type', 'damage-modifier', 'extra-dice-count', 'extra-dice-type', 'damage-crit-toggle'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateDamagePreview);
  document.getElementById(id).addEventListener('change', updateDamagePreview);
});