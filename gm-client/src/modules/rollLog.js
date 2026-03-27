// Roll Log Module - Displays all rolls for GM with reroll capability

export class RollLog {
  constructor(socket, getRoomCode) {
    this.socket = socket;
    this.getRoomCode = getRoomCode || (() => null);
    this.maxEntries = 100; // Cap entries for performance
    this.rolls = [];
    
    this.init();
  }
  
  init() {
    // Listen for player rolls
    this.socket.on('broadcast_roll', (rollData) => {
      this.addRoll(rollData);
    });
    
    // Clear button
    const clearBtn = document.getElementById('clear-roll-log-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearLog());
    }
  }
  
  addRoll(rollData) {
    const entry = {
      playerName: rollData.roller || 'Unknown',
      result: rollData.result,
      label: this.extractLabel(rollData),
      timestamp: rollData.timestamp || Date.now(),
      isCritical: rollData.individualRolls?.includes(20),
      isFumble: rollData.individualRolls?.includes(1),
      isGM: !!rollData.isGM,
      isReroll: !!(rollData.label && rollData.label.startsWith('Reroll: ')),
      // Store params for reroll
      rollParams: {
        diceType: rollData.diceType || 'd20',
        quantity: rollData.quantity || 1,
        modifier: rollData.modifier || 0,
        rollMode: rollData.rollMode || 'normal',
        label: rollData.label || 'GM Roll',
        roomCode: rollData.roomCode || null
      }
    };
    
    this.rolls.push(entry);
    
    // Cap entries
    if (this.rolls.length > this.maxEntries) {
      this.rolls.shift();
    }
    
    this.renderEntry(entry);
    this.scrollToBottom();
  }
  
  extractLabel(rollData) {
    // Try to get a meaningful label from the roll data
    if (rollData.label) {
      // Remove character name prefix if present (e.g., "Thorin: Stealth" -> "Stealth")
      const parts = rollData.label.split(': ');
      return parts.length > 1 ? parts.slice(1).join(': ') : rollData.label;
    }
    
    if (rollData.rollType) {
      // Format roll type nicely
      return this.formatRollType(rollData.rollType);
    }
    
    // Fallback to dice notation
    const modifier = rollData.modifier ? (rollData.modifier >= 0 ? `+${rollData.modifier}` : rollData.modifier) : '';
    return `${rollData.quantity || 1}${rollData.diceType || 'd20'}${modifier}`;
  }
  
  formatRollType(rollType) {
    const typeMap = {
      'initiative': 'Initiative',
      'spell-attack': 'Spell Attack',
      'weapon-attack': 'Attack',
      'damage': 'Damage',
      'spell-damage': 'Spell Damage',
      'ability': 'Ability Check',
      'save': 'Saving Throw',
      'skill': 'Skill Check'
    };
    return typeMap[rollType] || rollType;
  }
  
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  renderEntry(entry) {
    const container = document.getElementById('roll-log-entries');
    if (!container) return;
    
    // Remove "no rolls" placeholder if present
    const placeholder = container.querySelector('.no-rolls');
    if (placeholder) {
      placeholder.remove();
    }
    
    const entryEl = document.createElement('div');
    entryEl.className = 'roll-log-entry';
    
    // Add special classes
    if (entry.isCritical) entryEl.classList.add('critical');
    if (entry.isFumble) entryEl.classList.add('fumble');
    if (entry.isGM) entryEl.classList.add('gm-roll');
    if (entry.isReroll) entryEl.classList.add('reroll');
    
    // Build entry using safe DOM methods instead of innerHTML
    const timeSpan = document.createElement('span');
    timeSpan.className = 'roll-time';
    timeSpan.textContent = `[${this.formatTime(entry.timestamp)}]`;
    
    const playerSpan = document.createElement('span');
    playerSpan.className = 'roll-player';
    playerSpan.textContent = entry.playerName;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'roll-label';
    labelSpan.textContent = `${entry.label}:`;
    
    const resultSpan = document.createElement('span');
    resultSpan.className = 'roll-result';
    resultSpan.textContent = entry.result;

    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'roll-log-reroll-btn';
    rerollBtn.title = 'Reroll';
    rerollBtn.type = 'button';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-dice-d20';
    rerollBtn.appendChild(icon);
    rerollBtn.addEventListener('click', () => this.reroll(entry));
    
    entryEl.appendChild(timeSpan);
    entryEl.appendChild(playerSpan);
    entryEl.appendChild(labelSpan);
    entryEl.appendChild(resultSpan);
    entryEl.appendChild(rerollBtn);
    
    container.appendChild(entryEl);
  }
  
  scrollToBottom() {
    const container = document.getElementById('roll-log-entries');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
  
  reroll(entry) {
    const roomCode = this.getRoomCode();
    if (!roomCode) return;

    const { diceType, quantity, modifier, rollMode } = entry.rollParams;
    // Strip any existing "Reroll: " prefix to avoid stacking
    const baseLabel = entry.rollParams.label.replace(/^Reroll: /, '');
    const label = `Reroll: ${baseLabel}`;

    const isAdvDisadv = rollMode === 'advantage' || rollMode === 'disadvantage';
    const isD20Roll = diceType === 'd20';
    const useAdvDisadv = isAdvDisadv && isD20Roll;

    let individualRolls = [];
    let totalRaw = 0;

    if (useAdvDisadv) {
      const roll1 = this.rollDice('d20');
      const roll2 = this.rollDice('d20');
      totalRaw = rollMode === 'advantage' ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
      individualRolls = [roll1, roll2];
    } else {
      for (let i = 0; i < quantity; i++) {
        const roll = this.rollDice(diceType);
        individualRolls.push(roll);
        totalRaw += roll;
      }
    }

    const finalResult = totalRaw + modifier;

    const rollData = {
      roomCode,
      roller: 'GM',
      diceType: useAdvDisadv ? 'd20' : diceType,
      quantity: useAdvDisadv ? 2 : quantity,
      result: finalResult,
      label,
      modifier,
      rawResult: totalRaw,
      individualRolls,
      rollType: useAdvDisadv ? rollMode : 'normal',
      rollMode,
      timestamp: Date.now(),
      isGM: true
    };

    this.socket.emit('gm_roll', rollData);
  }

  rollDice(diceType) {
    const sides = parseInt(diceType.replace('d', ''), 10);
    return Math.floor(Math.random() * sides) + 1;
  }

  clearLog() {
    this.rolls = [];
    const container = document.getElementById('roll-log-entries');
    if (container) {
      // Use safe DOM method
      container.textContent = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'no-rolls';
      placeholder.textContent = 'No rolls yet...';
      container.appendChild(placeholder);
    }
  }
}
