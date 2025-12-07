// Roll Log Module - Displays player rolls for GM

export class RollLog {
  constructor(socket) {
    this.socket = socket;
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
    // Only show player rolls, not GM rolls
    if (rollData.isGM) return;
    
    const entry = {
      playerName: rollData.roller || 'Unknown',
      result: rollData.result,
      label: this.extractLabel(rollData),
      timestamp: rollData.timestamp || Date.now(),
      isCritical: rollData.individualRolls?.includes(20),
      isFumble: rollData.individualRolls?.includes(1)
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
    
    // Add special class for crits/fumbles
    if (entry.isCritical) entryEl.classList.add('critical');
    if (entry.isFumble) entryEl.classList.add('fumble');
    
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
    
    entryEl.appendChild(timeSpan);
    entryEl.appendChild(playerSpan);
    entryEl.appendChild(labelSpan);
    entryEl.appendChild(resultSpan);
    
    container.appendChild(entryEl);
  }
  
  scrollToBottom() {
    const container = document.getElementById('roll-log-entries');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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
