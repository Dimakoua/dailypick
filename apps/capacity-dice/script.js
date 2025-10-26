(() => {
  const BASE_FACTORS = [
    { title: 'PTO Wave', description: 'Two teammates off for a few days.', impact: -12, category: 'Availability' },
    { title: 'Meeting Tsunami', description: 'Quarterly reviews, demos, and syncs everywhere.', impact: -18, category: 'Meetings' },
    { title: 'Focus Bubble', description: 'Mostly async this sprint. Fewer interrupts.', impact: 8, category: 'Focus' },
    { title: 'Support Rotation', description: 'Half the team is on-call for incidents.', impact: -15, category: 'Operations' },
    { title: 'New Hire Shadowing', description: 'Pairing time eats into velocity.', impact: -10, category: 'Coaching' },
    { title: 'Tech Debt Clinic', description: 'Team blocked out time for refactors.', impact: -5, category: 'Improvement' },
    { title: 'Documentation Push', description: 'Product asked for a doc sprint.', impact: -7, category: 'Docs' },
    { title: 'Nothing Wild', description: 'Business as usual week.', impact: 0, category: 'Steady' }
  ];

  const POSITIVE_BOOSTS = [
    { title: 'Hackathon Halo', description: 'Hackathon cleaned up blockers.', impact: 6, category: 'Boost' },
    { title: 'Automation Win', description: 'New tooling shaved time off builds.', impact: 4, category: 'Automation' },
    { title: 'Clear Backlog', description: 'Stories are refined and ready.', impact: 5, category: 'Readiness' }
  ];

  const WILDCARDS = [
    { title: 'Production Fire', description: 'Surprise outage demands attention.', impact: -20, category: 'Wildcard' },
    { title: 'Exec Roadshow', description: 'Leadership needs prep + presentations.', impact: -10, category: 'Wildcard' },
    { title: 'Product Pivot', description: 'Scope shift mid-sprint.', impact: -15, category: 'Wildcard' },
    { title: 'Team Recharge', description: 'Morale day / half-day off.', impact: -6, category: 'Wildcard' },
    { title: 'Lucky Break', description: 'External dependency finished early.', impact: 5, category: 'Wildcard' }
  ];

  const DICE_CONFIG = [
    { id: 'availability', label: 'Capacity Die', pool: BASE_FACTORS },
    { id: 'boost', label: 'Momentum Die', pool: POSITIVE_BOOSTS },
    { id: 'wildcard', label: 'Wildcard Die', pool: WILDCARDS }
  ];

  const diceGrid = document.getElementById('diceGrid');
  const rollBtn = document.getElementById('rollDiceBtn');
  const statusEl = document.getElementById('status');
  const adjustmentLabel = document.getElementById('adjustmentLabel');
  const adjustedCapacityLabel = document.getElementById('adjustedCapacityLabel');
  const baseCapacityInput = document.getElementById('baseCapacityInput');
  const includePositiveInput = document.getElementById('includePositive');
  const includeWildcardsInput = document.getElementById('includeWildcards');
  const summaryOutput = document.getElementById('summaryOutput');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const teamNameInput = document.getElementById('teamNameInput');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  let currentRoll = [];
  const history = [];

  function pickRandom(pool) {
    if (!pool.length) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  function rollDice() {
    const results = [];

    DICE_CONFIG.forEach((die) => {
      if (die.id === 'boost' && !includePositiveInput.checked) {
        results.push({ ...die, skipped: true });
        return;
      }
      if (die.id === 'wildcard' && !includeWildcardsInput.checked) {
        results.push({ ...die, skipped: true });
        return;
      }
      const choice = pickRandom(die.pool);
      if (choice) {
        results.push({ ...choice, die: die.label });
      }
    });

    currentRoll = results.filter((item) => !item.skipped);
    renderDice(results);
    updateTotals();
    updateSummary();
    addToHistory();
    if (statusEl) statusEl.textContent = 'New capacity roll ready.';
  }

  function renderDice(results) {
    diceGrid.innerHTML = '';
    results.forEach((result) => {
      const card = document.createElement('div');
      card.className = 'die-card';
      if (result.skipped) {
        card.dataset.impact = '—';
        card.innerHTML = `<h3>${result.label || result.die}</h3><p>Die disabled for this roll.</p>`;
      } else {
        const impactPrefix = result.impact > 0 ? '+' : '';
        card.dataset.impact = `${impactPrefix}${result.impact}%`;
        card.innerHTML = `
          <h3>${result.title}</h3>
          <p>${result.description}</p>
          <div class="die-meta">${result.die || result.category}</div>
        `;
      }
      diceGrid.appendChild(card);
    });
  }

  function getAdjustment() {
    return currentRoll.reduce((sum, die) => sum + (die.impact || 0), 0);
  }

  function getAdjustedCapacity() {
    const base = Number(baseCapacityInput.value) || 0;
    const adjustment = getAdjustment();
    const adjusted = Math.round(base * (1 + adjustment / 100));
    return Math.max(adjusted, 0);
  }

  function updateTotals() {
    const adjustment = getAdjustment();
    const prefix = adjustment > 0 ? '+' : '';
    adjustmentLabel.textContent = `${prefix}${adjustment}%`;
    adjustedCapacityLabel.textContent = getAdjustedCapacity().toString();
  }

  function buildSummaryText() {
    if (!currentRoll.length) return 'Roll the dice to generate a summary.';
    const base = Number(baseCapacityInput.value) || 0;
    const adjusted = getAdjustedCapacity();
    const adjustment = getAdjustment();
    const teamLabel = teamNameInput.value.trim() || 'Sprint Capacity';

    const lines = [
      `${teamLabel} · Planned capacity: ${base}`,
      `Dice adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}%`,
      `Adjusted capacity: ${adjusted}`,
      '',
      'Highlights:'
    ];

    currentRoll.forEach((die) => {
      const prefix = die.impact > 0 ? '+' : '';
      lines.push(`- ${die.title}: ${prefix}${die.impact}% — ${die.description}`);
    });

    lines.push('', 'Copied from Capacity Planner Dice (Daily Pick)');
    return lines.join('\n');
  }

  function updateSummary() {
    summaryOutput.textContent = buildSummaryText();
  }

  function addToHistory() {
    const adjustment = getAdjustment();
    const adjusted = getAdjustedCapacity();
    const entry = {
      timestamp: new Date(),
      adjustment,
      adjusted
    };
    history.unshift(entry);
    if (history.length > 6) history.pop();
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    history.forEach((entry) => {
      const li = document.createElement('li');
      const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const prefix = entry.adjustment > 0 ? '+' : '';
      li.textContent = `${time} · ${prefix}${entry.adjustment}% · ${entry.adjusted}`;
      historyList.appendChild(li);
    });
  }

  function copySummary() {
    const text = buildSummaryText();
    navigator.clipboard?.writeText(text).then(() => {
      if (statusEl) statusEl.textContent = 'Summary copied to clipboard.';
      setTimeout(() => (statusEl.textContent = ''), 1500);
    });
  }

  function clearHistory() {
    history.length = 0;
    renderHistory();
  }

  rollBtn.addEventListener('click', rollDice);
  baseCapacityInput.addEventListener('input', () => {
    updateTotals();
    updateSummary();
  });
  includePositiveInput.addEventListener('change', rollDice);
  includeWildcardsInput.addEventListener('change', rollDice);
  copySummaryBtn.addEventListener('click', copySummary);
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Initial render
  renderDice(DICE_CONFIG.map((die) => ({ ...die, label: die.label, skipped: true })));
  renderHistory();
})();
