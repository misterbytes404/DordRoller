// Player Tracker - Real-time player list and character sheet viewing

export class PlayerTracker {
  constructor(socket) {
    this.socket = socket;
    this.players = [];
    this.init();
  }

  init() {
    // Listen for player list updates from server
    this.socket.on('player_list_update', (playerList) => {
      console.log('Player list updated:', playerList);
      this.players = playerList;
      this.renderPlayers();
    });

    // Listen for character sheet data from players
    this.socket.on('player_sheet_data', ({ socketId, sheetData }) => {
      console.log('Received character sheet from:', socketId, sheetData);
      this.showCharacterSheetModal(sheetData);
    });

    // Modal close button
    document.getElementById('sheet-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Close modal when clicking outside
    document.getElementById('character-sheet-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'character-sheet-modal') {
        this.closeModal();
      }
    });

    // Refresh All button
    document.getElementById('refresh-players-btn')?.addEventListener('click', () => {
      this.refreshAllPlayers();
    });
  }

  refreshAllPlayers() {
    console.log('Requesting refresh from all players');
    this.socket.emit('request_all_sync');
    
    // Visual feedback
    const btn = document.getElementById('refresh-players-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
  }

  renderPlayers() {
    const tbody = document.getElementById('player-list-body');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    if (this.players.length === 0) {
      tbody.innerHTML = `
        <tr id="no-players-row">
          <td colspan="7" class="no-players">No players connected. Share your room code!</td>
        </tr>
      `;
      return;
    }

    this.players.forEach(player => {
      const row = document.createElement('tr');
      row.className = player.online ? 'player-row online' : 'player-row offline';
      row.dataset.socketId = player.socketId;

      const statusIcon = player.online 
        ? '<i class="fa-solid fa-circle status-online"></i>' 
        : '<i class="fa-solid fa-circle status-offline"></i>';

      // Show HP in format currentHp/maxHp, handle missing values gracefully
      const hasCurrentHp = player.currentHp && player.currentHp !== '—';
      const hasMaxHp = player.maxHp && player.maxHp !== '—';
      let hpDisplay = '—';
      if (hasCurrentHp || hasMaxHp) {
        hpDisplay = `${hasCurrentHp ? player.currentHp : '?'}/${hasMaxHp ? player.maxHp : '?'}`;
      }

      const summaryText = player.level !== '—' && player.race !== '—' && player.class !== '—'
        ? `Lvl ${player.level} ${player.race} ${player.class}`
        : '—';

      row.innerHTML = `
        <td class="status-cell">${statusIcon}</td>
        <td class="character-name">${this.escapeHtml(player.characterName)}</td>
        <td class="player-name">${this.escapeHtml(player.playerName)}</td>
        <td class="ac-cell">${this.escapeHtml(player.ac)}</td>
        <td class="hp-cell">${this.escapeHtml(hpDisplay)}</td>
        <td class="summary-cell">${this.escapeHtml(summaryText)}</td>
        <td class="action-cell">
          <button class="view-sheet-btn" data-socket-id="${this.escapeHtml(player.socketId)}" ${!player.online ? 'disabled' : ''}>
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    // Attach click handlers to view buttons
    tbody.querySelectorAll('.view-sheet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const socketId = btn.dataset.socketId;
        this.requestPlayerSheet(socketId);
      });
    });
  }

  requestPlayerSheet(socketId) {
    console.log('Requesting sheet for player:', socketId);
    this.socket.emit('request_player_sheet', socketId);
  }

  showCharacterSheetModal(sheetData) {
    const modal = document.getElementById('character-sheet-modal');
    const modalTitle = document.getElementById('modal-character-name');
    const modalBody = document.getElementById('sheet-modal-body');

    if (!modal || !modalBody) return;

    // Set title
    modalTitle.textContent = `${sheetData.characterName || 'Unknown'}'s Character Sheet`;

    // Build the condensed sheet view
    modalBody.innerHTML = this.buildCondensedSheetHTML(sheetData);

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('show');
  }

  buildCondensedSheetHTML(data) {
    const abilities = data.abilities || {};
    const combat = data.combat || {};
    const saves = data.savingThrows || {};
    const skills = data.skills || {};
    const weapons = data.weapons || [];
    const spellcasting = data.spellcasting || {};
    const deathSaves = data.deathSaves || { successes: 0, failures: 0 };

    return `
      <!-- Header Info -->
      <div class="sheet-section sheet-header-info">
        <div class="sheet-stat-row">
          <span class="stat-label">Race:</span> <span class="stat-value">${this.escapeHtml(data.race || '—')}</span>
          <span class="stat-label">Class:</span> <span class="stat-value">${this.escapeHtml(data.class || '—')}</span>
          <span class="stat-label">Level:</span> <span class="stat-value">${this.escapeHtml(data.level || '—')}</span>
          <span class="stat-label">Background:</span> <span class="stat-value">${this.escapeHtml(data.background || '—')}</span>
        </div>
      </div>

      <!-- Combat Stats -->
      <div class="sheet-section">
        <h4><i class="fa-solid fa-shield-halved"></i> Combat Stats</h4>
        <div class="sheet-combat-grid">
          <div class="combat-stat">
            <span class="combat-label">AC</span>
            <span class="combat-value">${this.escapeHtml(combat.ac || '—')}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-label">HP</span>
            <span class="combat-value">${this.escapeHtml(combat.currentHp || '—')}/${this.escapeHtml(combat.maxHp || '—')}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-label">Temp HP</span>
            <span class="combat-value">${this.escapeHtml(combat.tempHp || '0')}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-label">Speed</span>
            <span class="combat-value">${this.escapeHtml(combat.speed || '—')}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-label">Initiative</span>
            <span class="combat-value">${this.escapeHtml(combat.initiative || '—')}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-label">Prof Bonus</span>
            <span class="combat-value">${this.escapeHtml(combat.proficiencyBonus || '—')}</span>
          </div>
        </div>
      </div>

      <!-- Death Saves -->
      <div class="sheet-section death-saves-display">
        <h4><i class="fa-solid fa-skull"></i> Death Saves</h4>
        <div class="death-saves-row">
          <span>Successes: ${this.renderDeathSaveCircles(deathSaves.successes, 'success')}</span>
          <span>Failures: ${this.renderDeathSaveCircles(deathSaves.failures, 'failure')}</span>
        </div>
      </div>

      <!-- Ability Scores -->
      <div class="sheet-section">
        <h4><i class="fa-solid fa-dumbbell"></i> Abilities</h4>
        <div class="sheet-abilities-grid">
          ${this.renderAbilityScore('STR', abilities.str)}
          ${this.renderAbilityScore('DEX', abilities.dex)}
          ${this.renderAbilityScore('CON', abilities.con)}
          ${this.renderAbilityScore('INT', abilities.int)}
          ${this.renderAbilityScore('WIS', abilities.wis)}
          ${this.renderAbilityScore('CHA', abilities.cha)}
        </div>
      </div>

      <!-- Saving Throws -->
      <div class="sheet-section">
        <h4><i class="fa-solid fa-heart-pulse"></i> Saving Throws</h4>
        <div class="sheet-saves-grid">
          ${this.renderSave('STR', saves.str)}
          ${this.renderSave('DEX', saves.dex)}
          ${this.renderSave('CON', saves.con)}
          ${this.renderSave('INT', saves.int)}
          ${this.renderSave('WIS', saves.wis)}
          ${this.renderSave('CHA', saves.cha)}
        </div>
      </div>

      <!-- Skills -->
      <div class="sheet-section">
        <h4><i class="fa-solid fa-list-check"></i> Skills</h4>
        <div class="sheet-skills-grid">
          ${this.renderSkillsColumn(skills, 'left')}
          ${this.renderSkillsColumn(skills, 'right')}
        </div>
      </div>

      <!-- Weapons -->
      <div class="sheet-section">
        <h4><i class="fa-solid fa-sword"></i> Weapons</h4>
        <div class="sheet-weapons">
          ${weapons.filter(w => w.name).map(w => `
            <div class="weapon-entry">
              <span class="weapon-name">${this.escapeHtml(w.name)}</span>
              <span class="weapon-damage">${this.escapeHtml(w.damage || '—')}</span>
              <span class="weapon-props">${this.escapeHtml(w.properties || '')}</span>
            </div>
          `).join('') || '<div class="no-weapons">No weapons equipped</div>'}
        </div>
      </div>

      <!-- Spellcasting -->
      ${spellcasting.attackBonus || spellcasting.saveDC ? `
        <div class="sheet-section">
          <h4><i class="fa-solid fa-wand-sparkles"></i> Spellcasting</h4>
          <div class="sheet-spellcasting">
            <span>Spell Attack: <strong>${this.escapeHtml(spellcasting.attackBonus || '—')}</strong></span>
            <span>Spell Save DC: <strong>${this.escapeHtml(spellcasting.saveDC || '—')}</strong></span>
          </div>
        </div>
      ` : ''}
    `;
  }

  renderDeathSaveCircles(count, type) {
    const filled = type === 'success' ? '●' : '●';
    const empty = '○';
    let html = '';
    for (let i = 0; i < 3; i++) {
      const isFilled = i < count;
      html += `<span class="death-circle ${type} ${isFilled ? 'filled' : ''}">${isFilled ? filled : empty}</span>`;
    }
    return html;
  }

  renderAbilityScore(name, ability) {
    const score = ability?.score || '—';
    const mod = ability?.modifier || '+0';
    return `
      <div class="ability-box">
        <span class="ability-name">${name}</span>
        <span class="ability-score">${score}</span>
        <span class="ability-mod">${mod}</span>
      </div>
    `;
  }

  renderSave(name, save) {
    const total = save?.total || '+0';
    const prof = save?.proficient ? '●' : '○';
    return `
      <div class="save-entry ${save?.proficient ? 'proficient' : ''}">
        <span class="save-prof-indicator">${prof}</span>
        <span class="save-total">${total}</span>
        <span class="save-name">${name}</span>
      </div>
    `;
  }

  renderSkillsColumn(skills, side) {
    const skillList = {
      left: [
        { key: 'acrobatics', name: 'Acrobatics', ability: 'DEX' },
        { key: 'animalHandling', name: 'Animal Handling', ability: 'WIS' },
        { key: 'arcana', name: 'Arcana', ability: 'INT' },
        { key: 'athletics', name: 'Athletics', ability: 'STR' },
        { key: 'deception', name: 'Deception', ability: 'CHA' },
        { key: 'history', name: 'History', ability: 'INT' },
        { key: 'insight', name: 'Insight', ability: 'WIS' },
        { key: 'intimidation', name: 'Intimidation', ability: 'CHA' },
        { key: 'investigation', name: 'Investigation', ability: 'INT' }
      ],
      right: [
        { key: 'medicine', name: 'Medicine', ability: 'WIS' },
        { key: 'nature', name: 'Nature', ability: 'INT' },
        { key: 'perception', name: 'Perception', ability: 'WIS' },
        { key: 'performance', name: 'Performance', ability: 'CHA' },
        { key: 'persuasion', name: 'Persuasion', ability: 'CHA' },
        { key: 'religion', name: 'Religion', ability: 'INT' },
        { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'DEX' },
        { key: 'stealth', name: 'Stealth', ability: 'DEX' },
        { key: 'survival', name: 'Survival', ability: 'WIS' }
      ]
    };

    return `
      <div class="skills-column">
        ${skillList[side].map(skill => {
          const s = skills[skill.key] || {};
          const isProficient = s.proficient;
          const isExpertise = s.expertise;
          // Build proficiency indicator
          let profIndicator = '○'; // not proficient
          if (isExpertise) {
            profIndicator = '★'; // expertise (double proficiency)
          } else if (isProficient) {
            profIndicator = '●'; // proficient
          }
          
          return `
            <div class="skill-entry ${isProficient ? 'proficient' : ''} ${isExpertise ? 'expertise' : ''}">
              <span class="skill-prof-indicator" title="${isExpertise ? 'Expertise' : isProficient ? 'Proficient' : 'Not Proficient'}">${profIndicator}</span>
              <span class="skill-total">${s.total || '+0'}</span>
              <span class="skill-name">${skill.name}</span>
              <span class="skill-ability">(${skill.ability})</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  closeModal() {
    const modal = document.getElementById('character-sheet-modal');
    if (modal) {
      modal.classList.remove('show');
      modal.classList.add('hidden');
    }
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '—';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}