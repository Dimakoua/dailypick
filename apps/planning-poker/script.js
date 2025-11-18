(() => {
  const DECK_STORAGE_KEY = 'planningPokerDeckSelection';
  const BASE_CARD_VALUES = [
    { value: '0', label: '0 points' },
    { value: '0.5', label: '0.5 points' },
    { value: '1', label: '1 point' },
    { value: '2', label: '2 points' },
    { value: '3', label: '3 points' },
    { value: '5', label: '5 points' },
    { value: '8', label: '8 points' },
    { value: '13', label: '13 points' },
    { value: '20', label: '20 points' },
    { value: '40', label: '40 points' },
    { value: '100', label: '100 points' },
    { value: '?', label: 'Needs discussion' },
    { value: '☕', label: 'Coffee break' },
  ];

  const NEBULA_SYMBOLS = ['🪐', '🌠', '☄️', '🛰️', '🚀', '🌌', '🛸', '💫', '🔭', '🌙', '⭐', '✨', '☕'];
  const ARCADE_SYMBOLS = ['🎮', '🕹️', '💾', '🎯', '📟', '💥', '⚡', '🏎️', '🏁', '🚨', '💣', '❓', '🍕'];

  const DECKS = [
    {
      id: 'classic',
      name: 'Classic Fibonacci',
      description: 'Standard Fibonacci cards with a coffee break.',
      theme: null,
      cards: BASE_CARD_VALUES.map((card) => ({ ...card, display: card.value })),
    },
    {
      id: 'nebula',
      name: 'Nebula Glyphs',
      description: 'Cosmic emoji overlays with gradient card faces.',
      theme: 'nebula',
      cards: BASE_CARD_VALUES.map((card, index) => {
        const symbol = NEBULA_SYMBOLS[index] || '✨';
        const display = card.value === '?' ? `${symbol} ?` : card.value === '☕' ? `${symbol} Break` : `${symbol} ${card.value}`;
        return {
          ...card,
          display,
          aria: card.value === '?' ? 'Needs discussion' : card.value === '☕' ? 'Coffee break' : `${card.value} points`,
        };
      }),
    },
    {
      id: 'arcade',
      name: 'Arcade Neon',
      description: 'Retro arcade icons with punchy neon gradients.',
      theme: 'arcade',
      cards: BASE_CARD_VALUES.map((card, index) => {
        const symbol = ARCADE_SYMBOLS[index] || '🎮';
        const display = card.value === '?' ? `${symbol} ?` : card.value === '☕' ? `${symbol} Break` : `${symbol} ${card.value}`;
        return {
          ...card,
          display,
          aria: card.value === '?' ? 'Needs discussion' : card.value === '☕' ? 'Coffee break' : `${card.value} points`,
        };
      }),
    },
  ];
  const LOCAL_NAME_KEY = 'planningPokerDisplayName';
  const LOCAL_ROOM_KEY = 'planningPokerLastRoom';

  const displayNameInput = document.getElementById('displayNameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const clearCardBtn = document.getElementById('clearCardBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const cardDeck = document.getElementById('cardDeck');
  const revealBtn = document.getElementById('revealBtn');
  const resetBtn = document.getElementById('resetBtn');
  const participantsList = document.getElementById('participantsList');
  const participantCount = document.getElementById('participantCount');
  const summaryOutput = document.getElementById('summaryOutput');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const copyInviteBtn = document.getElementById('copyInviteBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  const storyInput = document.getElementById('storyInput');
  const sessionBadge = document.getElementById('sessionBadge');
  const deckSelect = document.getElementById('deckSelect');
  const deckDescriptionEl = document.getElementById('deckDescription');
  const integrationStatusLine = document.getElementById('integrationStatus');
  const integrationServices = document.getElementById('integrationServices');
  const integrationTasksContainer = document.getElementById('integrationTasks');
  const integrationHistoryList = document.getElementById('integrationHistoryList');
  const integrationHistoryCount = document.getElementById('integrationHistoryCount');
  const refreshIntegrationBtn = document.getElementById('refreshIntegrationBtn');
  const integrationServiceFilter = document.getElementById('integrationServiceFilter');
  const integrationSortSelect = document.getElementById('integrationSort');
  const integrationSearchInput = document.getElementById('integrationSearch');

  let ws = null;
  let sessionId = null;
  let userId = null;
  let isHost = false;
  let currentState = { participants: [] };
  let storyDebounce = null;
  let currentDeck = DECKS[0];
  const savedDeckId = localStorage.getItem(DECK_STORAGE_KEY);

  const SERVICE_LABELS = {
    jira: 'Jira',
    trello: 'Trello',
    github: 'GitHub',
  };
  const INTEGRATION_HISTORY_KEY = 'planningPokerTaskHistory';
  const HISTORY_LIMIT = 6;

  let integrationSnapshot = null;
  let integrationRenderedTasks = [];
  let selectedIntegrationTaskId = '';
  let selectedIntegrationTask = null;
  let integrationHistory = [];
  let integrationStandup = window.dailyPickStandup || null;
  let integrationRefreshPending = false;
  let integrationFilterService = '';
  let integrationSortMode = 'updated-desc';
  let integrationSearchTerm = '';
  let lastRecordedRound = null;
  let lastRecordedTaskId = '';

  const savedName = localStorage.getItem(LOCAL_NAME_KEY) || '';
  displayNameInput.value = savedName;

  const savedRoom = localStorage.getItem(LOCAL_ROOM_KEY);
  if (savedRoom) {
    roomCodeInput.value = savedRoom;
  }

  function generateRoomCode() {
    return Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
  }

  function setStatus(text) {
    connectionStatus.textContent = text;
  }

  function updateSessionBadge() {
    if (sessionId) {
      sessionBadge.textContent = `Room ${sessionId}`;
      sessionBadge.dataset.active = 'true';
    } else {
      sessionBadge.textContent = 'Not connected';
      delete sessionBadge.dataset.active;
    }
  }

  function sendMessage(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  function connectToRoom(targetId) {
    if (!targetId) return setStatus('Enter a room code to join.');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Switching rooms');
    }

    sessionId = targetId.toUpperCase();
    localStorage.setItem(LOCAL_ROOM_KEY, sessionId);
    updateSessionBadge();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = new URL(`/api/planning-poker/websocket?session_id=${sessionId}`, window.location.href);
    wsUrl.protocol = protocol;
    ws = new WebSocket(wsUrl.href);

    ws.onopen = () => {
      setStatus(`Connected to room ${sessionId}`);
      copyInviteBtn.disabled = false;
      clearCardBtn.disabled = false;
      roomCodeInput.value = sessionId;
      const url = new URL(window.location.href);
      url.searchParams.set('session_id', sessionId);
      window.history.replaceState({}, '', url);
      const name = displayNameInput.value.trim();
      if (name) {
        sendMessage({ type: 'set-name', name });
      }
      if (isHost && storyInput.value.trim()) {
        sendMessage({ type: 'set-story', story: storyInput.value.trim() });
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (err) {
        console.error('[PlanningPoker] Invalid message', err);
      }
    };

    ws.onclose = () => {
      setStatus('Disconnected');
      copyInviteBtn.disabled = true;
      clearCardBtn.disabled = true;
      revealBtn.disabled = true;
      resetBtn.disabled = true;
      isHost = false;
      updateDeckSelection();
    };

    ws.onerror = () => setStatus('WebSocket error');
  }

  function handleServerMessage(message) {
    switch (message.type) {
      case 'user-id':
        userId = message.id;
        break;
      case 'state':
        currentState = message;
        isHost = userId && message.hostId === userId;
        updateControls();
        renderParticipants();
        renderSummary();
        updateDeckSelection();
        maybeRecordRoundSummary();
        if (!isHost && storyInput.value !== message.story) {
          storyInput.value = message.story || '';
        }
        break;
      default:
        break;
    }
  }

  function updateControls() {
    const hasPicks = currentState.participants?.some((p) => p.hasSelected);
    revealBtn.disabled = !isHost || !sessionId || currentState.isRevealed || !hasPicks;
    resetBtn.disabled = !isHost || !sessionId;
    storyInput.disabled = !isHost;
    if (!currentState.isRevealed) {
      summaryOutput.textContent = 'Votes will appear here after you reveal.';
    }
  }

  function populateDeckSelect() {
    if (!deckSelect) return;
    deckSelect.innerHTML = '';
    DECKS.forEach((deck) => {
      const option = document.createElement('option');
      option.value = deck.id;
      option.textContent = deck.name;
      deckSelect.appendChild(option);
    });
  }

  function updateDeckUI() {
    if (deckSelect) {
      deckSelect.value = currentDeck.id;
    }
    if (deckDescriptionEl) {
      if (deckDescriptionEl.dataset.notice) delete deckDescriptionEl.dataset.notice;
      deckDescriptionEl.textContent = currentDeck.description;
    }
  }

  function setDeckById(deckId, { fromSelect = false } = {}) {
    const deck = DECKS.find((d) => d.id === deckId) || DECKS[0];
    currentDeck = deck;
    localStorage.setItem(DECK_STORAGE_KEY, currentDeck.id);
    renderDeck();
    updateDeckUI();
  }

  function renderDeck() {
    if (!cardDeck) return;
    cardDeck.innerHTML = '';
    const deck = currentDeck || DECKS[0];
    cardDeck.setAttribute('aria-label', `${deck.name} cards`);
    if (deck.theme) {
      cardDeck.dataset.theme = deck.theme;
    } else {
      delete cardDeck.dataset.theme;
    }
    deck.cards.forEach((card) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = card.value;
      btn.textContent = card.display || card.value;
      if (card.aria) {
        btn.setAttribute('aria-label', card.aria);
      } else {
        btn.setAttribute('aria-label', `Vote ${card.label || card.value}`);
      }
      btn.addEventListener('click', () => handleCardSelection(card.value));
      cardDeck.appendChild(btn);
    });
    updateDeckSelection();
  }

  function handleCardSelection(value) {
    if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN) {
      return setStatus('Join a room before voting.');
    }
    sendMessage({ type: 'select-card', value });
  }

  function updateDeckSelection() {
    const myEntry = currentState.participants?.find((p) => p.id === userId);
    const selectedValue = myEntry?.cardValue || '';

    cardDeck.querySelectorAll('button').forEach((btn) => {
      btn.dataset.selected = selectedValue && btn.dataset.value === selectedValue ? 'true' : 'false';
    });
  }

  function renderParticipants() {
    participantsList.innerHTML = '';
    const list = currentState.participants || [];
    participantCount.textContent = list.length;

    list.forEach((participant) => {
      const card = document.createElement('div');
      card.className = 'participant-card';
      card.dataset.waiting = participant.hasSelected ? 'false' : 'true';
      card.dataset.host = participant.id === currentState.hostId ? 'true' : 'false';
      card.dataset.self = participant.id === userId ? 'true' : 'false';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'participant-name';
      nameSpan.textContent = participant.name;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'participant-value';
      if (currentState.isRevealed) {
        valueSpan.textContent = participant.cardValue || '—';
      } else if (participant.hasSelected) {
        valueSpan.textContent = '✅';
      } else {
        valueSpan.textContent = '…';
      }

      card.appendChild(nameSpan);
      card.appendChild(valueSpan);
      participantsList.appendChild(card);
    });
  }

  function renderSummary() {
    if (currentState.summaryText) {
      summaryOutput.textContent = currentState.summaryText;
      copySummaryBtn.disabled = false;
    } else {
      summaryOutput.textContent = 'Votes will appear here after you reveal.';
      copySummaryBtn.disabled = true;
    }
  }

  function copyText(value) {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(value).then(() => {
      setStatus('Copied!');
      setTimeout(() => setStatus(`Connected to room ${sessionId}`), 1500);
    });
  }

  function initEvents() {
    saveNameBtn.addEventListener('click', () => {
      const trimmed = displayNameInput.value.trim();
      if (!trimmed) return;
      localStorage.setItem(LOCAL_NAME_KEY, trimmed);
      sendMessage({ type: 'set-name', name: trimmed });
    });

    createRoomBtn.addEventListener('click', () => {
      const newCode = generateRoomCode();
      connectToRoom(newCode);
    });

    joinRoomBtn.addEventListener('click', () => {
      const code = roomCodeInput.value.trim();
      if (!code) return setStatus('Enter a room code.');
      connectToRoom(code);
    });

    roomCodeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        joinRoomBtn.click();
      }
    });

    clearCardBtn.addEventListener('click', () => {
      sendMessage({ type: 'clear-card' });
    });

    revealBtn.addEventListener('click', () => {
      sendMessage({ type: 'request-reveal' });
    });

    resetBtn.addEventListener('click', () => {
      sendMessage({ type: 'reset-round' });
    });

    copySummaryBtn.addEventListener('click', () => {
      if (!currentState.summaryText) return;
      copyText(currentState.summaryText);
    });

    copyInviteBtn.addEventListener('click', () => {
      if (!sessionId) return;
      const inviteUrl = `${window.location.origin}/apps/planning-poker/?session_id=${sessionId}`;
      copyText(inviteUrl);
    });

    storyInput.addEventListener('input', () => {
      if (!isHost) return;
      if (storyDebounce) clearTimeout(storyDebounce);
      storyDebounce = setTimeout(() => {
        sendMessage({ type: 'set-story', story: storyInput.value.trim() });
      }, 300);
    });

    deckSelect?.addEventListener('change', (event) => {
      setDeckById(event.target.value, { fromSelect: true });
    });

  }

  function autoJoinFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get('session_id');
    if (existing) {
      connectToRoom(existing);
    }
  }

  function loadIntegrationHistory() {
    try {
      const raw = localStorage.getItem(INTEGRATION_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[PlanningPoker] Unable to read task history', error);
      return [];
    }
  }

  function persistIntegrationHistory(entries) {
    try {
      localStorage.setItem(INTEGRATION_HISTORY_KEY, JSON.stringify(entries));
    } catch (error) {
      console.warn('[PlanningPoker] Unable to persist task history', error);
    }
  }

  function recordIntegrationHistory(entry) {
    if (!entry || !entry.taskId || !entry.summary) return;
    const normalized = {
      ...entry,
      recordedAt: entry.recordedAt || new Date().toISOString(),
    };
    integrationHistory = integrationHistory.filter(
      (existing) => !(existing.taskId === normalized.taskId && existing.round === normalized.round),
    );
    integrationHistory.unshift(normalized);
    if (integrationHistory.length > HISTORY_LIMIT) {
      integrationHistory = integrationHistory.slice(0, HISTORY_LIMIT);
    }
    persistIntegrationHistory(integrationHistory);
    renderIntegrationHistory();
  }

  function formatServiceLabel(service) {
    if (!service) return '';
    return SERVICE_LABELS[service] || `${service.charAt(0).toUpperCase()}${service.slice(1)}`;
  }

  function buildIntegrationStoryLabel(task) {
    if (!task) return '';
    const title = task.title || 'Backlog item';
    const idLabel =
      task.shortId ||
      (typeof task.id === 'string' ? task.id.split(':').pop() : '') ||
      '';
    return idLabel ? `${idLabel} · ${title}` : title;
  }

  function setIntegrationStatus(message, tone = 'info') {
    if (!integrationStatusLine) return;
    integrationStatusLine.textContent = message;
    integrationStatusLine.dataset.tone = tone;
  }

  function renderIntegrationHistory() {
    if (!integrationHistoryList) return;
    integrationHistoryList.innerHTML = '';
    if (integrationHistoryCount) {
      integrationHistoryCount.textContent = String(integrationHistory.length);
    }
    if (!integrationHistory.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'integration-panel__empty';
      placeholder.textContent = 'Reveal a round after choosing a backlog item to keep a quick record here.';
      integrationHistoryList.appendChild(placeholder);
      return;
    }
    integrationHistory.forEach((entry) => {
      const listItem = document.createElement('li');
      listItem.className = 'integration-panel__history-item';
      const title = document.createElement('strong');
      title.textContent = entry.story || entry.title || 'Estimate';
      const meta = document.createElement('small');
      const metaParts = [];
      if (entry.service) {
        metaParts.push(formatServiceLabel(entry.service));
      }
      if (entry.round != null) {
        metaParts.push(`Round ${entry.round}`);
      }
      if (entry.recordedAt) {
        const date = new Date(entry.recordedAt);
        if (!Number.isNaN(date.getTime())) {
          metaParts.push(date.toLocaleString());
        }
      }
      meta.textContent = metaParts.join(' · ');
      const summary = document.createElement('p');
      summary.className = 'integration-panel__history-summary';
      summary.textContent = entry.summary;
      listItem.appendChild(title);
      listItem.appendChild(meta);
      listItem.appendChild(summary);
      integrationHistoryList.appendChild(listItem);
    });
  }

  function formatTimestamp(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function updateServiceFilterOptions(services = []) {
    if (!integrationServiceFilter) return;
    const previous = integrationServiceFilter.value || '';
    const unique = Array.from(new Set((services || []).map((entry) => entry.service).filter(Boolean)));
    integrationServiceFilter.innerHTML = '<option value="">All services</option>';
    unique.forEach((service) => {
      const option = document.createElement('option');
      option.value = service;
      option.textContent = SERVICE_LABELS[service] || service;
      integrationServiceFilter.appendChild(option);
    });
    if (previous && Array.from(integrationServiceFilter.options).some((opt) => opt.value === previous)) {
      integrationServiceFilter.value = previous;
      integrationFilterService = previous;
    } else {
      integrationFilterService = '';
    }
  }

  function matchesIntegrationSearch(task) {
    if (!integrationSearchTerm) return true;
    const haystack = [
      task.title,
      task.shortId,
      task.status,
      task.description,
      task.type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(integrationSearchTerm);
  }

  function getTaskTimestamp(task) {
    if (!task?.updated) return 0;
    const parsed = Date.parse(task.updated);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function sortIntegrationTasks(tasks) {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      if (integrationSortMode === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      }
      const aTime = getTaskTimestamp(a);
      const bTime = getTaskTimestamp(b);
      if (aTime === bTime) {
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      }
      return integrationSortMode === 'updated-asc' ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }

  function gatherIntegrationTasks(snapshot) {
    const data = snapshot || {};
    const seen = new Set();
    const tasks = [];
    const addTask = (item) => {
      if (!item || typeof item !== 'object') return;
      const fallback = `${item.service || 'integration'}:${item.title || item.shortId || 'item'}:${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const id = item.id || fallback;
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      tasks.push({
        ...item,
        id,
        title: item.title || item.name || 'Backlog item',
        description: item.description || item.summary || '',
      });
    };

    const unassigned = Array.isArray(data.unassigned) ? data.unassigned : [];
    unassigned.forEach(addTask);

    const assignments = data.assignments && typeof data.assignments === 'object' ? data.assignments : {};
    Object.values(assignments).forEach((entry) => {
      const items = Array.isArray(entry?.items) ? entry.items : [];
      items.forEach(addTask);
    });

    return tasks;
  }

  function renderIntegrationServices(snapshot) {
    if (!integrationServices) return;
    integrationServices.innerHTML = '';
    const services = Array.isArray(snapshot?.services) ? snapshot.services : [];
    if (!services.length) {
      const placeholder = document.createElement('span');
      placeholder.className = 'integration-panel__empty';
      placeholder.textContent = 'No synced services yet.';
      integrationServices.appendChild(placeholder);
      return;
    }
    services.forEach((entry) => {
      const chip = document.createElement('span');
      chip.className = 'integration-panel__service-chip';
      const label = formatServiceLabel(entry.service);
      const parts = [];
      if (typeof entry.assignments === 'number') {
        parts.push(`${entry.assignments} assigned`);
      }
      if (typeof entry.unassigned === 'number') {
        parts.push(`${entry.unassigned} backlog`);
      }
      chip.textContent = `${label}${parts.length ? ` • ${parts.join(' · ')}` : ''}`;
      integrationServices.appendChild(chip);
    });
  }

  function renderIntegrationTasks(snapshot) {
    if (!integrationTasksContainer) return;
    integrationTasksContainer.innerHTML = '';
    const tasks = gatherIntegrationTasks(snapshot);
    if (!tasks.length) {
      const placeholder = document.createElement('div');
      placeholder.className = 'integration-panel__empty';
      placeholder.textContent =
        snapshot && snapshot.services?.length
          ? 'No tasks were returned from the synced services.'
          : 'Refresh to load backlog tasks after syncing integrations.';
      integrationTasksContainer.appendChild(placeholder);
      integrationRenderedTasks = [];
      return;
    }
    const filtered = tasks.filter((task) => {
      if (integrationFilterService && task.service !== integrationFilterService) {
        return false;
      }
      return matchesIntegrationSearch(task);
    });
    if (!filtered.length) {
      const placeholder = document.createElement('div');
      placeholder.className = 'integration-panel__empty';
      placeholder.textContent = 'No backlog items match the current filters.';
      integrationTasksContainer.appendChild(placeholder);
      integrationRenderedTasks = [];
      return;
    }
    const sorted = sortIntegrationTasks(filtered);
    const tasksToShow = sorted.slice(0, 30);
    integrationRenderedTasks = tasksToShow;
    tasksToShow.forEach((task) => {
      const card = document.createElement('div');
      card.className = 'integration-panel__task';
      if (task.id) {
        card.dataset.taskId = task.id;
      }
      if (selectedIntegrationTaskId && task.id === selectedIntegrationTaskId) {
        card.dataset.selected = 'true';
      }
      const title = document.createElement('div');
      title.className = 'integration-panel__task-title';
      title.textContent = task.title || 'Backlog item';
      const meta = document.createElement('div');
      meta.className = 'integration-panel__task-meta';
      const metaText = document.createElement('span');
      const metaParts = [];
      if (task.service) metaParts.push(formatServiceLabel(task.service));
      if (task.shortId) metaParts.push(task.shortId);
      if (task.status) metaParts.push(task.status);
      if (task.type) metaParts.push(task.type);
      metaText.textContent = metaParts.join(' · ');
      meta.appendChild(metaText);
      if (task.url) {
        const link = document.createElement('a');
        link.className = 'integration-panel__task-link';
        link.href = task.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'Open item';
        meta.appendChild(link);
      }
      const detailText = buildTaskDetailText(task);
      if (detailText) {
        const detail = document.createElement('p');
        detail.className = 'integration-panel__task-detail';
        detail.textContent = detailText;
        card.appendChild(detail);
      }
      const actions = document.createElement('div');
      actions.className = 'integration-panel__task-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost-btn';
      button.dataset.taskId = task.id || '';
      button.setAttribute('aria-label', `Set ${task.title || 'backlog item'} as story label`);
      button.textContent = 'Use story label';
      actions.appendChild(button);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(actions);
      integrationTasksContainer.appendChild(card);
    });
  }

  function updateIntegrationPanel(snapshot) {
    integrationSnapshot = snapshot || integrationSnapshot;
    updateServiceFilterOptions(integrationSnapshot?.services);
    renderIntegrationServices(integrationSnapshot);
    renderIntegrationTasks(integrationSnapshot);
    renderIntegrationHistory();
  }

  function applyIntegrationTaskSelection(task) {
    if (!task) return;
    selectedIntegrationTask = task;
    selectedIntegrationTaskId = task.id || '';
    const label = buildIntegrationStoryLabel(task);
    if (storyInput) {
      storyInput.value = label;
    }
    if (label && isHost) {
      sendMessage({ type: 'set-story', story: label });
      setIntegrationStatus(`Story label set to ${label}.`, 'success');
    } else if (label) {
      setIntegrationStatus(`Only the host can update the story. Copy “${label}” into the story field.`, 'info');
    }
    renderIntegrationTasks(integrationSnapshot);
  }

  function handleIntegrationTaskClick(event) {
    const button = event.target.closest('button[data-task-id]');
    const card = event.target.closest('[data-task-id]');
    const taskId = button?.dataset.taskId || card?.dataset.taskId;
    if (!taskId) return;
    const task = integrationRenderedTasks.find((entry) => entry.id === taskId);
    if (task) {
      applyIntegrationTaskSelection(task);
    }
  }

  async function handleIntegrationRefresh() {
    if (!integrationStandup || integrationRefreshPending) return;
    integrationRefreshPending = true;
    refreshIntegrationBtn?.setAttribute('disabled', 'true');
    setIntegrationStatus('Refreshing backlog tasks…', 'info');
    try {
      await integrationStandup.refresh(true);
      setIntegrationStatus('Backlog refreshed. Choose a task to set the story label.', 'success');
    } catch (error) {
      console.error('[PlanningPoker] Integration refresh failed', error);
      setIntegrationStatus(error?.message || 'Unable to refresh backlog right now.', 'error');
    } finally {
      integrationRefreshPending = false;
      refreshIntegrationBtn?.removeAttribute('disabled');
    }
  }

  function maybeRecordRoundSummary() {
    if (!selectedIntegrationTask || !selectedIntegrationTaskId) return;
    if (!currentState.isRevealed || !currentState.summaryText) return;
    const roundNumber = currentState.round;
    if (roundNumber === lastRecordedRound && selectedIntegrationTaskId === lastRecordedTaskId) {
      return;
    }
    recordIntegrationHistory({
      taskId: selectedIntegrationTaskId,
      service: selectedIntegrationTask.service || '',
      title: selectedIntegrationTask.title || '',
      summary: currentState.summaryText,
      round: roundNumber,
      story: storyInput?.value || '',
    });
    setIntegrationStatus(
      `Saved estimate for ${selectedIntegrationTask.title || 'current story'}.`,
      'success',
    );
    lastRecordedRound = roundNumber;
    lastRecordedTaskId = selectedIntegrationTaskId;
  }

  function initIntegrationPanel() {
    integrationHistory = loadIntegrationHistory();
    renderIntegrationHistory();
    if (integrationStandup?.subscribe) {
      integrationStandup.subscribe((snapshot) => {
        updateIntegrationPanel(snapshot);
      });
    }
    refreshIntegrationBtn?.addEventListener('click', handleIntegrationRefresh);
    integrationTasksContainer?.addEventListener('click', handleIntegrationTaskClick);
    integrationServiceFilter?.addEventListener('change', (event) => {
      integrationFilterService = event.target.value;
      renderIntegrationTasks(integrationSnapshot);
    });
    integrationSortSelect?.addEventListener('change', (event) => {
      integrationSortMode = event.target.value || 'updated-desc';
      renderIntegrationTasks(integrationSnapshot);
    });
    integrationSearchInput?.addEventListener('input', (event) => {
      integrationSearchTerm = (event.target.value || '').trim().toLowerCase();
      renderIntegrationTasks(integrationSnapshot);
    });
    const snapshot = integrationStandup?.getSnapshot ? integrationStandup.getSnapshot() : null;
    updateIntegrationPanel(snapshot);
  }

  renderDeck();
  populateDeckSelect();
  if (savedDeckId) {
    setDeckById(savedDeckId);
  } else {
    updateDeckUI();
  }

  initEvents();
  autoJoinFromQuery();
  updateSessionBadge();
  initIntegrationPanel();
})();
