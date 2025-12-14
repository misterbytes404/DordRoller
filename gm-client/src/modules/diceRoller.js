// MVP 1: Dice rolling functionality

export class DiceRoller {
  constructor(socket, getRoomCode) {
    this.socket = socket;
    this.getRoomCode = getRoomCode;
    this.currentRollMode = 'normal'; // 'normal', 'advantage', 'disadvantage'
    this.init();
  }

  init() {
    // Roll Mode Toggle Buttons
    document.querySelectorAll('.roll-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setRollMode(btn.dataset.mode));
    });

    // Single Roll Button
    const rollBtn = document.getElementById('roll-btn');
    rollBtn.addEventListener('click', () => this.handleRoll());

    // Action dropdown - show/hide custom action field
    const rollLabel = document.getElementById('roll-label');
    rollLabel.addEventListener('change', () => this.handleActionChange());
  }

  handleActionChange() {
    const rollLabel = document.getElementById('roll-label');
    const customActionGroup = document.getElementById('custom-action-group');
    const customActionInput = document.getElementById('custom-action');
    
    if (rollLabel.value === 'Other') {
      customActionGroup.style.display = 'flex';
      customActionInput.focus();
    } else {
      customActionGroup.style.display = 'none';
      customActionInput.value = ''; // Clear when switching away
    }
  }

  setRollMode(mode) {
    this.currentRollMode = mode;
    
    // Update button states
    document.querySelectorAll('.roll-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update description
    const descEl = document.getElementById('roll-mode-description');
    const descriptions = {
      'normal': 'Rolling normally',
      'advantage': 'Rolling with ADVANTAGE (2d20, keep highest)',
      'disadvantage': 'Rolling with DISADVANTAGE (2d20, keep lowest)'
    };
    descEl.textContent = descriptions[mode];
    
    // Update roll button appearance based on mode
    const rollBtn = document.getElementById('roll-btn');
    rollBtn.className = ''; // Reset classes
    if (mode === 'advantage') {
      rollBtn.style.background = '#22c55e';
      rollBtn.style.color = '#1a1a1a';
    } else if (mode === 'disadvantage') {
      rollBtn.style.background = '#c41e3a';
      rollBtn.style.color = '#fff';
    } else {
      rollBtn.style.background = '';
      rollBtn.style.color = '';
    }
  }

  handleRoll() {
    const rollType = this.currentRollMode;
    const isAdvDisadv = rollType === 'advantage' || rollType === 'disadvantage';
    
    // For adv/disadv on d20, force 2d20; otherwise use selected dice
    const diceType = document.getElementById('dice-type').value;
    const isD20Roll = diceType === 'd20';
    const useAdvDisadv = isAdvDisadv && isD20Roll;
    
    const quantity = useAdvDisadv ? 1 : (Number(document.getElementById('dice-quantity').value) || 1);
    const selectedAction = document.getElementById('roll-label').value;
    const customAction = document.getElementById('custom-action').value.trim();
    const label = (selectedAction === 'Other' && customAction) ? customAction : (selectedAction || 'GM Roll');
    const roomCode = this.getRoomCode();
    const modifier = Number(document.getElementById('roll-modifier').value) || 0;

    if (!roomCode) {
      alert('Please join a room first!');
      return;
    }

    let individualRolls = [];
    let totalRaw = 0;

    if (useAdvDisadv) {
      // Roll 2d20 for advantage/disadvantage
      const roll1 = this.rollDice('d20');
      const roll2 = this.rollDice('d20');
      totalRaw = rollType === 'advantage' ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
      individualRolls = [roll1, roll2];
    } else {
      // Normal roll (or non-d20 with adv/disadv selected - just roll normally)
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
      rollType: useAdvDisadv ? rollType : 'normal',
      rollMode: rollType,
      timestamp: Date.now()
    };

    this.socket.emit('gm_roll', rollData);
    console.log('Roll sent:', rollData);

    // UI Feedback
    this.showFeedback(rollData, useAdvDisadv, diceType, quantity);
  }

  showFeedback(rollData, useAdvDisadv, diceType, quantity) {
    const feedback = document.getElementById('feedback');
    const { individualRolls, modifier, result, label, rollType } = rollData;
    
    if (useAdvDisadv) {
      const [roll1, roll2] = individualRolls;
      const kept = rollType === 'advantage' ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
      const dropped = rollType === 'advantage' ? Math.min(roll1, roll2) : Math.max(roll1, roll2);
      const modeLabel = rollType === 'advantage' ? 'ADVANTAGE' : 'DISADVANTAGE';
      const arrow = rollType === 'advantage' ? '↑' : '↓';
      
      feedback.innerHTML = `
        <span style="color: ${rollType === 'advantage' ? '#22c55e' : '#c41e3a'}; font-weight: bold;">
          ${arrow} ${modeLabel}
        </span>: 
        [<strong>${kept}</strong> / <span style="text-decoration: line-through; opacity: 0.5;">${dropped}</span>] 
        + ${modifier} = <strong>${result}</strong> 
        <span style="color: #888;">(${label})</span>
      `;
    } else {
      feedback.innerHTML = `
        Rolled ${quantity}x ${diceType}: [${individualRolls.join(', ')}] + ${modifier} = <strong>${result}</strong> 
        <span style="color: #888;">(${label})</span>
      `;
    }
  }

  rollDice(diceType) {
    const sides = parseInt(diceType.substring(1));
    return Math.floor(Math.random() * sides) + 1;
  }
}