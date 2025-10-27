(() => {
  const QUICK_DEFAULT_MINUTES = 5;
  const QUICK_STORAGE_KEY = 'timerQuickPreset';
  const PRESET_STORAGE_KEY = 'timerCadencePresetsV1';
  const FILE_EXTENSION = '.dailypick-timer';

  const quickMinutesInput = document.getElementById('quickMinutes');
  const quickSecondsInput = document.getElementById('quickSeconds');
  const quickStartBtn = document.getElementById('quickStartBtn');
  const quickPauseBtn = document.getElementById('quickPauseBtn');
  const quickResetBtn = document.getElementById('quickResetBtn');
  const quickDisplay = document.getElementById('quickDisplay');
  const quickStatus = document.getElementById('quickStatus');

  const premiumCard = document.querySelector('[data-license-region="premium-timer"]');
  const presetListEl = document.getElementById('presetList');
  const createPresetBtn = document.getElementById('createPresetBtn');
  const importPresetBtn = document.getElementById('importPresetBtn');
  const importPresetInput = document.getElementById('importPresetInput');
  const presetNameInput = document.getElementById('presetNameInput');
  const presetDescriptionInput = document.getElementById('presetDescriptionInput');
  const addStageBtn = document.getElementById('addStageBtn');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const deletePresetBtn = document.getElementById('deletePresetBtn');
  const duplicatePresetBtn = document.getElementById('duplicatePresetBtn');
  const sharePresetBtn = document.getElementById('sharePresetBtn');
  const downloadPresetBtn = document.getElementById('downloadPresetBtn');
  const stageListEl = document.getElementById('stageList');
  const timelineEl = document.getElementById('stageTimeline');
  const runnerTitle = document.getElementById('runnerTitle');
  const runnerCountdown = document.getElementById('runnerCountdown');
  const runnerStatus = document.getElementById('runnerStatus');
  const startCadenceBtn = document.getElementById('startCadenceBtn');
  const pauseCadenceBtn = document.getElementById('pauseCadenceBtn');
  const nextStageBtn = document.getElementById('nextStageBtn');
  const resetCadenceBtn = document.getElementById('resetCadenceBtn');

  const DEFAULT_PRESETS = [
    {
      slug: 'standup-rhythm',
      name: 'Daily Stand-up Rhythm',
      description: 'Check-in, blockers, and parking lot in under 25 minutes.',
      stages: [
        { label: 'Warm-up', seconds: 180, color: '#2ecc71', tone: 'soft' },
        { label: 'Updates', seconds: 900, color: '#3498db', tone: 'medium' },
        { label: 'Parking Lot', seconds: 240, color: '#9b59b6', tone: 'bold' },
      ],
    },
    {
      slug: 'planning-push',
      name: 'Sprint Planning Burst',
      description: 'Prime the backlog, estimate, then lock commitments.',
      stages: [
        { label: 'Backlog prep', seconds: 420, color: '#f39c12', tone: 'soft' },
        { label: 'Estimation loop', seconds: 1500, color: '#e67e22', tone: 'medium' },
        { label: 'Commitment review', seconds: 600, color: '#16a085', tone: 'bold' },
      ],
    },
  ];

  const VALID_TONES = new Set(['none', 'soft', 'medium', 'bold']);

  let quickTimerInterval = null;
  let quickRemainingSeconds = 0;
  let quickRunning = false;

  let premiumEnabled = false;
  let presets = [];
  let selectedPresetId = null;
  let pendingImportPreset = null;

  let cadenceTimer = null;
  let cadenceStartedAt = null;
  let cadenceRemaining = 0;
  let cadenceStageIndex = 0;
  let cadencePaused = false;

  function uuid() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatTime(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const seconds = String(safe % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function showQuickStatus(message) {
    if (!quickStatus) return;
    quickStatus.textContent = message || '';
  }

  function updateQuickDisplay() {
    if (!quickDisplay) return;
    quickDisplay.textContent = formatTime(quickRemainingSeconds);
  }

  function syncQuickInputs() {
    if (!quickMinutesInput || !quickSecondsInput) return;
    const minutes = clamp(parseInt(quickMinutesInput.value, 10) || 0, 0, 999);
    const seconds = clamp(parseInt(quickSecondsInput.value, 10) || 0, 0, 59);
    quickRemainingSeconds = minutes * 60 + seconds;
    updateQuickDisplay();
    localStorage.setItem(QUICK_STORAGE_KEY, JSON.stringify({ minutes, seconds }));
  }

  function loadQuickPreset() {
    if (!quickMinutesInput || !quickSecondsInput) return;
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(QUICK_STORAGE_KEY) || 'null');
    } catch (err) {
      stored = null;
    }
    const minutes = clamp(stored?.minutes ?? QUICK_DEFAULT_MINUTES, 0, 999);
    const seconds = clamp(stored?.seconds ?? 0, 0, 59);
    quickMinutesInput.value = minutes;
    quickSecondsInput.value = seconds;
    quickRemainingSeconds = minutes * 60 + seconds;
    updateQuickDisplay();
  }

  function startQuickTimer() {
    if (quickRunning) return;
    if (quickRemainingSeconds <= 0) {
      syncQuickInputs();
    }
    if (quickRemainingSeconds <= 0) {
      showQuickStatus('Set a duration first.');
      return;
    }
    quickRunning = true;
    quickStartBtn?.setAttribute('disabled', 'disabled');
    quickPauseBtn?.removeAttribute('disabled');
    quickResetBtn?.removeAttribute('disabled');
    showQuickStatus('Running…');
    quickTimerInterval = window.setInterval(() => {
      quickRemainingSeconds -= 1;
      updateQuickDisplay();
      if (quickRemainingSeconds <= 0) {
        stopQuickTimer(true);
        playTone('bold');
        showQuickStatus('Complete!');
      }
    }, 1000);
  }

  function stopQuickTimer(completed = false) {
    if (quickTimerInterval) {
      clearInterval(quickTimerInterval);
      quickTimerInterval = null;
    }
    quickRunning = false;
    quickStartBtn?.removeAttribute('disabled');
    quickPauseBtn?.setAttribute('disabled', 'disabled');
    if (!completed) {
      showQuickStatus('Paused.');
    }
  }

  function resetQuickTimer() {
    stopQuickTimer();
    syncQuickInputs();
    quickResetBtn?.setAttribute('disabled', 'disabled');
    showQuickStatus('Ready.');
  }

  function playTone(intensity) {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const freq = intensity === 'bold' ? 1040 : intensity === 'medium' ? 880 : intensity === 'soft' ? 720 : 0;
    if (!freq) {
      ctx.close();
      return;
    }
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(intensity === 'bold' ? 0.35 : intensity === 'medium' ? 0.25 : 0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 1.25);
    oscillator.addEventListener('ended', () => ctx.close());
  }

  function persistPresets() {
    const payload = presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      builtIn: Boolean(preset.builtIn),
      slug: preset.slug || null,
      stages: preset.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        seconds: stage.seconds,
        color: stage.color,
        tone: stage.tone,
      })),
    }));
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(payload));
  }

  function createStageFromData(stage, index, fallback = {}) {
    const base = stage && typeof stage === 'object' ? stage : {};
    const defaultLabel = fallback.label || `Stage ${index + 1}`;
    const parsedSeconds = Number(base.seconds);
    const seconds = Number.isFinite(parsedSeconds)
      ? clamp(Math.floor(parsedSeconds), 0, 86400)
      : clamp(Number(fallback.seconds) || 300, 0, 86400);
    const tone = typeof base.tone === 'string' && VALID_TONES.has(base.tone) ? base.tone : fallback.tone || 'none';
    return {
      id: typeof base.id === 'string' ? base.id : uuid(),
      label: typeof base.label === 'string' && base.label.trim() ? base.label.trim() : defaultLabel,
      seconds,
      color: typeof base.color === 'string' && base.color ? base.color : fallback.color || '#3498db',
      tone,
    };
  }

  function createBuiltInPreset(definition) {
    return {
      id: uuid(),
      name: definition.name,
      description: definition.description,
      builtIn: true,
      slug: definition.slug,
      stages: definition.stages.map((stage, index) => createStageFromData(stage, index, stage)),
    };
  }

  function loadPresets() {
    let stored = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || 'null');
      if (Array.isArray(parsed)) {
        stored = parsed;
      }
    } catch (err) {
      stored = [];
    }

    const builtInBySlug = new Map();
    const customPresets = [];

    stored.forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const match = DEFAULT_PRESETS.find(
        (preset) => preset.slug === raw.slug || (!raw.slug && preset.name === raw.name),
      );
      const preset = {
        id: typeof raw.id === 'string' ? raw.id : uuid(),
        name:
          typeof raw.name === 'string' && raw.name.trim()
            ? raw.name.trim()
            : match?.name || 'Untitled cadence',
        description: typeof raw.description === 'string' ? raw.description.trim() : '',
        builtIn: Boolean(raw.builtIn),
        slug: typeof raw.slug === 'string' ? raw.slug : match?.slug || null,
        stages: Array.isArray(raw.stages) && raw.stages.length
          ? raw.stages.map((stage, index) => createStageFromData(stage, index, match?.stages?.[index] || {}))
          : (match?.stages || []).map((stage, index) => createStageFromData(stage, index, stage)),
      };

      if (!preset.builtIn && match && !builtInBySlug.has(match.slug)) {
        preset.builtIn = true;
        preset.slug = match.slug;
      }

      if (preset.builtIn && preset.slug) {
        builtInBySlug.set(preset.slug, preset);
      } else {
        preset.builtIn = false;
        preset.slug = null;
        customPresets.push(preset);
      }
    });

    const builtIns = DEFAULT_PRESETS.map((definition) => {
      const existing = builtInBySlug.get(definition.slug);
      if (existing) {
        existing.builtIn = true;
        existing.slug = definition.slug;
        existing.stages = existing.stages.map((stage, index) =>
          createStageFromData(stage, index, definition.stages[index] || stage),
        );
        return existing;
      }
      return createBuiltInPreset(definition);
    });

    presets = [
      ...builtIns,
      ...customPresets.map((preset) => ({
        ...preset,
        builtIn: false,
        slug: null,
        stages: preset.stages.map((stage, index) => createStageFromData(stage, index, stage)),
      })),
    ];

    if (!selectedPresetId && presets.length) {
      selectedPresetId = presets[0].id;
    }
  }

  function findPreset(id) {
    return presets.find((preset) => preset.id === id) || null;
  }

  function updatePresetList() {
    if (!presetListEl) return;
    presetListEl.innerHTML = '';
    presets.forEach((preset) => {
      const li = document.createElement('li');
      li.className = 'preset-item';
      li.dataset.id = preset.id;
      li.dataset.selected = preset.id === selectedPresetId ? 'true' : 'false';

      const header = document.createElement('div');
      header.className = 'preset-item__header';

      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'preset-select';
      title.textContent = preset.name;
      title.addEventListener('click', () => selectPreset(preset.id));

      const meta = document.createElement('p');
      meta.textContent = preset.description || '—';

      header.appendChild(title);

      if (!preset.builtIn) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'preset-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.setAttribute('aria-label', `Remove ${preset.name}`);
        removeBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          deletePreset(preset.id);
        });
        header.appendChild(removeBtn);
      }

      li.appendChild(header);
      li.appendChild(meta);
      presetListEl.appendChild(li);
    });
  }

  function updateEditorState() {
    if (!deletePresetBtn) return;
    const preset = findPreset(selectedPresetId);
    if (!preset || preset.builtIn) {
      deletePresetBtn.setAttribute('disabled', 'disabled');
    } else {
      deletePresetBtn.removeAttribute('disabled');
    }
  }

  function renderStageRow(stage, index) {
    const row = document.createElement('div');
    row.className = 'stage-row';
    row.dataset.id = stage.id;

    function createField(labelText, control, options = {}) {
      const field = document.createElement('label');
      field.className = 'stage-field';
      if (options.className) {
        field.classList.add(options.className);
      }
      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = labelText;
      field.append(label, control);
      return field;
    }

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = stage.label;
    labelInput.placeholder = `Stage ${index + 1}`;
    labelInput.addEventListener('input', () => {
      stage.label = labelInput.value;
      renderTimeline();
      updateRunnerDisplay();
    });
    const labelField = createField('Stage name', labelInput, { className: 'stage-field--title' });

    const minutesInput = document.createElement('input');
    minutesInput.type = 'number';
    minutesInput.min = '0';
    minutesInput.max = '999';
    minutesInput.value = Math.floor(stage.seconds / 60);
    minutesInput.addEventListener('change', () => {
      const minutes = clamp(parseInt(minutesInput.value, 10) || 0, 0, 999);
      minutesInput.value = minutes;
      stage.seconds = minutes * 60 + (stage.seconds % 60);
      renderTimeline();
      updateRunnerDisplay();
    });

    const secondsInput = document.createElement('input');
    secondsInput.type = 'number';
    secondsInput.min = '0';
    secondsInput.max = '59';
    secondsInput.value = stage.seconds % 60;
    secondsInput.addEventListener('change', () => {
      const seconds = clamp(parseInt(secondsInput.value, 10) || 0, 0, 59);
      secondsInput.value = seconds;
      stage.seconds = Math.floor(stage.seconds / 60) * 60 + seconds;
      renderTimeline();
      updateRunnerDisplay();
    });

    const durationGroup = document.createElement('div');
    durationGroup.className = 'duration-group';
    const minLabel = document.createElement('span');
    minLabel.className = 'duration-unit';
    minLabel.textContent = 'm';
    const secLabel = document.createElement('span');
    secLabel.className = 'duration-unit';
    secLabel.textContent = 's';
    durationGroup.append(minutesInput, minLabel, secondsInput, secLabel);

    const durationField = document.createElement('div');
    durationField.className = 'stage-field stage-field--duration';
    const durationLabel = document.createElement('span');
    durationLabel.className = 'field-label';
    durationLabel.textContent = 'Duration';
    durationField.append(durationLabel, durationGroup);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = stage.color || '#3498db';
    colorInput.title = 'Accent color';
    colorInput.addEventListener('input', () => {
      stage.color = colorInput.value;
      renderTimeline();
    });
    const colorField = createField('Accent color', colorInput, { className: 'stage-field--color' });

    const toneSelect = document.createElement('select');
    toneSelect.innerHTML = `
      <option value="none">No cue</option>
      <option value="soft">Soft chime</option>
      <option value="medium">Focus bell</option>
      <option value="bold">Momentum siren</option>
    `;
    toneSelect.value = stage.tone || 'none';
    toneSelect.addEventListener('change', () => {
      stage.tone = toneSelect.value;
    });
    const toneField = createField('Audio cue', toneSelect);

    const controlsField = document.createElement('div');
    controlsField.className = 'stage-field stage-field--controls';
    const controlsLabel = document.createElement('span');
    controlsLabel.className = 'field-label';
    controlsLabel.textContent = 'Arrange';
    const controls = document.createElement('div');
    controls.className = 'row-controls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.title = 'Move up';
    upBtn.setAttribute('aria-label', 'Move stage up');
    upBtn.textContent = '↑';
    upBtn.addEventListener('click', () => moveStage(stage.id, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.title = 'Move down';
    downBtn.setAttribute('aria-label', 'Move stage down');
    downBtn.textContent = '↓';
    downBtn.addEventListener('click', () => moveStage(stage.id, 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Remove stage';
    deleteBtn.setAttribute('aria-label', 'Remove stage');
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => removeStage(stage.id));

    controls.append(upBtn, downBtn, deleteBtn);
    controlsField.append(controlsLabel, controls);

    row.append(labelField, durationField, colorField, toneField, controlsField);
    return row;
  }

  function renderStages() {
    if (!stageListEl) return;
    stageListEl.innerHTML = '';
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    preset.stages.forEach((stage, index) => {
      const row = renderStageRow(stage, index);
      stageListEl.appendChild(row);
    });
  }

  function renderTimeline() {
    if (!timelineEl) return;
    timelineEl.innerHTML = '';
    const preset = findPreset(selectedPresetId);
    if (!preset || !preset.stages.length) {
      const empty = document.createElement('li');
      empty.className = 'timeline-empty';
      empty.textContent = 'Add a stage to build your cadence.';
      timelineEl.appendChild(empty);
      return;
    }
    preset.stages.forEach((stage, index) => {
      const li = document.createElement('li');
      li.dataset.index = String(index);
      li.style.setProperty('--stage-color', stage.color || '#3498db');
      li.innerHTML = `
        <div class="timeline-label">${stage.label || `Stage ${index + 1}`}</div>
        <div class="timeline-duration">${formatTime(stage.seconds)}</div>
      `;
      timelineEl.appendChild(li);
    });
    updateRunnerHighlight();
  }

  function selectPreset(id) {
    const preset = findPreset(id);
    if (!preset) return;
    selectedPresetId = id;
    presetNameInput.value = preset.name;
    presetDescriptionInput.value = preset.description || '';
    cadenceStageIndex = 0;
    cadenceRemaining = preset.stages[0]?.seconds || 0;
    cadencePaused = false;
    runnerTitle.textContent = preset.name;
    updatePresetList();
    renderStages();
    renderTimeline();
    updateRunnerDisplay();
    updateEditorState();
    persistPresets();
  }

  function addStage() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    preset.stages.push({
      id: uuid(),
      label: `Stage ${preset.stages.length + 1}`,
      seconds: 300,
      color: '#3498db',
      tone: 'none',
    });
    renderStages();
    renderTimeline();
    updateRunnerDisplay();
    persistPresets();
  }

  function moveStage(stageId, delta) {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const index = preset.stages.findIndex((stage) => stage.id === stageId);
    if (index < 0) return;
    const newIndex = clamp(index + delta, 0, preset.stages.length - 1);
    if (index === newIndex) return;
    const [stage] = preset.stages.splice(index, 1);
    preset.stages.splice(newIndex, 0, stage);
    renderStages();
    renderTimeline();
    updateRunnerDisplay();
    persistPresets();
  }

  function removeStage(stageId) {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    preset.stages = preset.stages.filter((stage) => stage.id !== stageId);
    renderStages();
    renderTimeline();
    updateRunnerDisplay();
    persistPresets();
  }

  function savePreset() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    preset.name = presetNameInput.value.trim() || 'Untitled cadence';
    preset.description = presetDescriptionInput.value.trim();
    updatePresetList();
    renderTimeline();
    runnerTitle.textContent = preset.name;
    updateRunnerDisplay();
    updateEditorState();
    persistPresets();
  }

  function deletePreset(presetId = selectedPresetId) {
    const preset = findPreset(presetId);
    if (!preset || preset.builtIn) return;
    if (!window.confirm('Delete this preset? This cannot be undone.')) return;
    presets = presets.filter((item) => item.id !== presetId);
    if (!presets.length) {
      const placeholder = {
        id: uuid(),
        name: 'New cadence',
        description: '',
        stages: [],
        builtIn: false,
        slug: null,
      };
      presets.push(placeholder);
      selectedPresetId = placeholder.id;
    } else if (presetId === selectedPresetId) {
      selectedPresetId = presets[0].id;
    }
    if (presets.length) {
      selectPreset(selectedPresetId || presets[0].id);
    } else {
      persistPresets();
      updatePresetList();
      renderStages();
      renderTimeline();
      updateRunnerDisplay();
      updateEditorState();
    }
  }

  function duplicatePreset() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const clone = {
      ...JSON.parse(JSON.stringify(preset)),
      id: uuid(),
      name: `${preset.name} (copy)`,
      builtIn: false,
      slug: null,
      stages: preset.stages.map((stage) => ({ ...stage, id: uuid() })),
    };
    presets.push(clone);
    selectPreset(clone.id);
  }

  function createPreset() {
    const preset = {
      id: uuid(),
      name: 'New cadence',
      description: '',
      stages: [],
      builtIn: false,
      slug: null,
    };
    presets.unshift(preset);
    selectPreset(preset.id);
  }

  function totalDuration(preset) {
    return preset?.stages?.reduce((acc, stage) => acc + (stage.seconds || 0), 0) || 0;
  }

  function updateRunnerDisplay() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const stage = preset.stages[cadenceStageIndex];
    if (stage) {
      runnerTitle.textContent = `${preset.name} · ${stage.label}`;
      runnerCountdown.textContent = formatTime(cadenceRemaining || stage.seconds);
      runnerStatus.textContent = `${cadenceStageIndex + 1} of ${preset.stages.length} · Total ${formatTime(totalDuration(preset))}`;
    } else {
      runnerTitle.textContent = `${preset.name} · Complete`;
      runnerCountdown.textContent = formatTime(0);
      runnerStatus.textContent = `${preset.stages.length} stages`;
    }
    startCadenceBtn?.removeAttribute('disabled');
    pauseCadenceBtn?.setAttribute('disabled', 'disabled');
    nextStageBtn?.setAttribute('disabled', 'disabled');
  }

  function updateRunnerHighlight() {
    if (!timelineEl) return;
    timelineEl.querySelectorAll('li').forEach((li) => {
      const index = Number(li.dataset.index);
      if (index < cadenceStageIndex) {
        li.dataset.state = 'complete';
      } else if (index === cadenceStageIndex) {
        li.dataset.state = cadencePaused ? 'paused' : 'active';
      } else {
        li.dataset.state = 'upcoming';
      }
    });
  }

  function clearCadenceTimer() {
    if (cadenceTimer) {
      cancelAnimationFrame(cadenceTimer);
      cadenceTimer = null;
    }
  }

  function tickCadence() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const stage = preset.stages[cadenceStageIndex];
    if (!stage) {
      clearCadenceTimer();
      runnerCountdown.textContent = formatTime(0);
      startCadenceBtn?.removeAttribute('disabled');
      pauseCadenceBtn?.setAttribute('disabled', 'disabled');
      nextStageBtn?.setAttribute('disabled', 'disabled');
      runnerStatus.textContent = 'Cadence complete.';
      updateRunnerHighlight();
      return;
    }
    const now = performance.now();
    const elapsed = Math.max(0, now - cadenceStartedAt) / 1000;
    const remaining = Math.max(0, cadenceRemaining - elapsed);
    runnerCountdown.textContent = formatTime(remaining);
    if (remaining <= 0.1) {
      playTone(stage.tone || 'none');
      cadenceStageIndex += 1;
      cadenceRemaining = preset.stages[cadenceStageIndex]?.seconds || 0;
      cadenceStartedAt = performance.now();
      if (cadenceStageIndex >= preset.stages.length) {
        runnerCountdown.textContent = formatTime(0);
        runnerStatus.textContent = 'Cadence complete.';
        updateRunnerHighlight();
        clearCadenceTimer();
        startCadenceBtn?.removeAttribute('disabled');
        pauseCadenceBtn?.setAttribute('disabled', 'disabled');
        nextStageBtn?.setAttribute('disabled', 'disabled');
        return;
      }
      runnerStatus.textContent = `${cadenceStageIndex + 1} of ${preset.stages.length} · Total ${formatTime(totalDuration(preset))}`;
      updateRunnerHighlight();
    }
    cadenceTimer = requestAnimationFrame(tickCadence);
  }

  function startCadence() {
    const preset = findPreset(selectedPresetId);
    if (!preset || !preset.stages.length) return;
    cadencePaused = false;
    cadenceRemaining = preset.stages[cadenceStageIndex]?.seconds || 0;
    cadenceStartedAt = performance.now();
    startCadenceBtn?.setAttribute('disabled', 'disabled');
    pauseCadenceBtn?.removeAttribute('disabled');
    nextStageBtn?.removeAttribute('disabled');
    updateRunnerHighlight();
    tickCadence();
  }

  function pauseCadence() {
    if (cadencePaused) return;
    cadencePaused = true;
    clearCadenceTimer();
    const now = performance.now();
    const elapsed = Math.max(0, now - cadenceStartedAt) / 1000;
    cadenceRemaining = Math.max(0, cadenceRemaining - elapsed);
    pauseCadenceBtn?.setAttribute('disabled', 'disabled');
    startCadenceBtn?.removeAttribute('disabled');
    updateRunnerHighlight();
  }

  function resumeCadence() {
    if (!cadencePaused) return;
    cadencePaused = false;
    cadenceStartedAt = performance.now();
    pauseCadenceBtn?.removeAttribute('disabled');
    startCadenceBtn?.setAttribute('disabled', 'disabled');
    tickCadence();
    updateRunnerHighlight();
  }

  function nextStage() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    cadenceStageIndex = clamp(cadenceStageIndex + 1, 0, preset.stages.length);
    cadenceRemaining = preset.stages[cadenceStageIndex]?.seconds || 0;
    cadenceStartedAt = performance.now();
    cadencePaused = false;
    startCadenceBtn?.setAttribute('disabled', 'disabled');
    pauseCadenceBtn?.removeAttribute('disabled');
    updateRunnerHighlight();
  }

  function resetCadence() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    clearCadenceTimer();
    cadencePaused = false;
    cadenceStageIndex = 0;
    cadenceRemaining = preset.stages[0]?.seconds || 0;
    cadenceStartedAt = performance.now();
    startCadenceBtn?.removeAttribute('disabled');
    pauseCadenceBtn?.setAttribute('disabled', 'disabled');
    nextStageBtn?.setAttribute('disabled', 'disabled');
    renderTimeline();
    updateRunnerDisplay();
  }

  function sharePreset() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const payload = {
      name: preset.name,
      description: preset.description,
      stages: preset.stages.map((stage) => ({
        label: stage.label,
        seconds: stage.seconds,
        color: stage.color,
        tone: stage.tone,
      })),
    };
    const encoder = new TextEncoder();
    const bytes = encoder.encode(JSON.stringify(payload));
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const encoded = btoa(binary);
    const url = new URL(window.location.href);
    url.searchParams.set('preset', encoded);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url.toString());
      sharePresetBtn?.setAttribute('data-shared', 'true');
      window.setTimeout(() => sharePresetBtn?.removeAttribute('data-shared'), 2000);
    } else {
      window.prompt('Copy this cadence URL', url.toString());
    }
  }

  function downloadPreset() {
    const preset = findPreset(selectedPresetId);
    if (!preset) return;
    const payload = {
      name: preset.name,
      description: preset.description,
      stages: preset.stages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}${FILE_EXTENSION}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importPresetFromData(data) {
    if (!data?.stages?.length) return;
    const preset = {
      id: uuid(),
      name: data.name || 'Imported cadence',
      description: data.description || '',
      stages: data.stages.map((stage, index) => createStageFromData(stage, index, {})),
      builtIn: false,
      slug: null,
    };
    presets.push(preset);
    selectPreset(preset.id);
  }

  function parsePresetParam() {
    const encoded = new URLSearchParams(window.location.search).get('preset');
    if (!encoded) return;
    try {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      const json = decoder.decode(bytes);
      const payload = JSON.parse(json);
      if (premiumEnabled) {
        importPresetFromData(payload);
      } else {
        pendingImportPreset = payload;
      }
    } catch (err) {
      console.warn('Failed to import preset from URL', err);
    }
  }

  function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        importPresetFromData(payload);
      } catch (err) {
        console.error('Invalid preset file', err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function updatePremiumState(enabled) {
    premiumEnabled = enabled;
    if (!premiumCard) return;
    premiumCard.dataset.state = enabled ? 'unlocked' : 'locked';
    if (enabled) {
      if (!presets.length) {
        loadPresets();
      }
      updatePresetList();
      renderStages();
      renderTimeline();
      selectPreset(selectedPresetId || presets[0]?.id);
      if (pendingImportPreset) {
        importPresetFromData(pendingImportPreset);
        pendingImportPreset = null;
      }
    }
  }

  quickMinutesInput?.addEventListener('change', syncQuickInputs);
  quickSecondsInput?.addEventListener('change', syncQuickInputs);
  quickStartBtn?.addEventListener('click', () => {
    if (quickRunning) {
      resumeQuickTimer();
    } else {
      startQuickTimer();
    }
  });
  quickPauseBtn?.addEventListener('click', () => stopQuickTimer());
  quickResetBtn?.addEventListener('click', resetQuickTimer);

  function resumeQuickTimer() {
    startQuickTimer();
  }

  updateEditorState();

  if (createPresetBtn) createPresetBtn.addEventListener('click', createPreset);
  if (importPresetBtn) importPresetBtn.addEventListener('click', () => importPresetInput?.click());
  if (importPresetInput) importPresetInput.addEventListener('change', handleFileImport);
  addStageBtn?.addEventListener('click', addStage);
  savePresetBtn?.addEventListener('click', savePreset);
  deletePresetBtn?.addEventListener('click', deletePreset);
  duplicatePresetBtn?.addEventListener('click', duplicatePreset);
  sharePresetBtn?.addEventListener('click', sharePreset);
  downloadPresetBtn?.addEventListener('click', downloadPreset);
  startCadenceBtn?.addEventListener('click', () => {
    if (cadencePaused) {
      resumeCadence();
    } else {
      startCadence();
    }
  });
  pauseCadenceBtn?.addEventListener('click', pauseCadence);
  nextStageBtn?.addEventListener('click', nextStage);
  resetCadenceBtn?.addEventListener('click', resetCadence);

  loadQuickPreset();
  showQuickStatus('Ready.');

  if (window.DailyPickLicense) {
    window.DailyPickLicense.subscribe(() => {
      updatePremiumState(window.DailyPickLicense.isFeatureEnabled('timer'));
    });
  } else {
    updatePremiumState(false);
  }

  parsePresetParam();
})();
