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

  let ws = null;
  let sessionId = null;
  let userId = null;
  let isHost = false;
  let currentState = { participants: [] };
  let storyDebounce = null;
  let currentDeck = DECKS[0];
  const savedDeckId = localStorage.getItem(DECK_STORAGE_KEY);

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
})();
