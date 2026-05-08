const ROOM_STORAGE_KEY = 'dailypick_two_truths_and_a_lie_room';
const NAME_STORAGE_KEY = 'dailypick_two_truths_and_a_lie_name';

// Screen Elements
const setupScreen = document.getElementById('setupScreen');
const gameScreen = document.getElementById('gameScreen');

// Setup Form Elements
const displayNameInput = document.getElementById('displayNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const setupStatus = document.getElementById('setupStatus');

// Game Screen Elements
const sessionBadge = document.getElementById('sessionBadge');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const phaseIndicator = document.getElementById('phaseIndicator');
const roundLabel = document.getElementById('roundLabel');
const hostNotice = document.getElementById('hostNotice');
const hostControlsSection = document.getElementById('hostControls');

// Statement Elements
const statementInputs = [
  document.getElementById('statement1'),
  document.getElementById('statement2'),
  document.getElementById('statement3'),
];
const lieInputs = Array.from(document.querySelectorAll('input[name="lieChoice"]'));
const statementCards = document.getElementById('statementCards');

// Host Control Buttons
const prepareBtn = document.getElementById('prepareBtn');
const revealBtn = document.getElementById('revealBtn');
const resetBtn = document.getElementById('resetBtn');

// Vote and Participants
const voteButtons = document.getElementById('voteButtons');
const voteSummary = document.getElementById('voteSummary');
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const statusLine = document.getElementById('statusLine');

// Application State
let ws = null;
let sessionId = null;
let userId = null;
let isHost = false;
let currentState = {
  hostId: null,
  roundIndex: 1,
  statements: ['', '', ''],
  lieIndex: null,
  isPrepared: false,
  isRevealed: false,
  participants: [],
  ownVoteIndex: null,
};

function sanitizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function getSavedName() {
  return localStorage.getItem(NAME_STORAGE_KEY) || '';
}

function saveName() {
  const name = displayNameInput.value.trim();
  if (!name) {
    setStatus('Please enter a name', 'error', true);
    return;
  }
  localStorage.setItem(NAME_STORAGE_KEY, name);
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage({ type: 'set-name', name });
  }
}

function saveRoomCode(value) {
  localStorage.setItem(ROOM_STORAGE_KEY, value);
}

function loadPreferences() {
  displayNameInput.value = getSavedName();
  const lastRoom = localStorage.getItem(ROOM_STORAGE_KEY) || '';
  roomCodeInput.value = lastRoom;
  if (lastRoom) {
    connectToRoom(lastRoom);
  }
}

function showSetupScreen() {
  setupScreen.hidden = false;
  gameScreen.hidden = true;
}

function showGameScreen() {
  setupScreen.hidden = true;
  gameScreen.hidden = false;
}

function updateSessionBadge() {
  if (sessionId) {
    sessionBadge.textContent = `Room ${sessionId}`;
    sessionBadge.dataset.active = 'true';
  } else {
    sessionBadge.textContent = 'Offline';
    delete sessionBadge.dataset.active;
  }
}

function updatePhaseIndicator() {
  if (!phaseIndicator) return;
  
  let phase = 'Setup';
  if (currentState.isPrepared && !currentState.isRevealed) {
    phase = 'Voting';
  } else if (currentState.isRevealed) {
    phase = 'Revealed';
  }
  
  const phaseLabel = phaseIndicator.querySelector('.phase-label');
  if (phaseLabel) {
    phaseLabel.textContent = phase;
  }
}

function setStatus(message, type = 'info', isSetupScreen = false) {
  const target = isSetupScreen ? setupStatus : statusLine;
  if (target) {
    target.textContent = message;
    target.dataset.type = type;
  }
}

function enableControls() {
  copyInviteBtn.disabled = !sessionId;
  prepareBtn.disabled = !isHost || !currentState.hostId || currentState.isRevealed;
  revealBtn.disabled = !isHost || !currentState.isPrepared || currentState.isRevealed;
  resetBtn.disabled = !isHost || !sessionId;
  
  voteButtons.querySelectorAll('button').forEach((button) => {
    button.disabled = !sessionId || !currentState.isPrepared || currentState.isRevealed;
  });

  if (hostControlsSection) {
    hostControlsSection.hidden = !isHost;
  }
  if (hostNotice) {
    hostNotice.hidden = !isHost;
  }
}

function updateRoundLabel() {
  if (roundLabel) {
    roundLabel.textContent = String(currentState.roundIndex);
  }
}

function connectToRoom(rawCode) {
  const code = sanitizeRoomCode(rawCode);
  if (!code) {
    setStatus('Enter a room code before joining.', 'error', true);
    return;
  }

  const name = displayNameInput.value.trim();
  if (!name) {
    setStatus('Please enter your name first.', 'error', true);
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Switching rooms');
  }

  sessionId = code;
  saveRoomCode(sessionId);
  updateSessionBadge();
  showGameScreen();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = new URL(`/api/two-truths-and-a-lie/websocket?session_id=${sessionId}`, window.location.href);
  wsUrl.protocol = protocol;

  ws = new WebSocket(wsUrl.href);

  ws.addEventListener('open', () => {
    setStatus(`Connected to Room ${sessionId}`, 'success');
    roomCodeInput.value = sessionId;
    saveName();
  });

  ws.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleServerMessage(payload);
    } catch (err) {
      console.error('[Two Truths] Invalid server message', err);
    }
  });

  ws.addEventListener('close', () => {
    setStatus('Disconnected. Reconnect to continue playing.', 'error');
    sessionId = null;
    isHost = false;
    updateSessionBadge();
    enableControls();
  });

  ws.addEventListener('error', () => {
    setStatus('Connection error. Check your internet and try again.', 'error');
  });
}

function handleServerMessage(payload) {
  if (!payload || typeof payload !== 'object') return;

  if (payload.type === 'user-id') {
    userId = payload.id;
    return;
  }

  if (payload.type === 'state') {
    currentState = {
      hostId: payload.hostId,
      roundIndex: payload.roundIndex,
      statements: payload.statements || ['', '', ''],
      lieIndex: payload.lieIndex,
      isPrepared: payload.isPrepared,
      isRevealed: payload.isRevealed,
      participants: payload.participants || [],
      ownVoteIndex: payload.ownVoteIndex,
    };
    isHost = userId && payload.hostId === userId;
    renderState();
  }
}

function renderState() {
  updateRoundLabel();
  updatePhaseIndicator();
  renderStatementCards();
  renderVoteButtons();
  renderParticipants();
  renderVoteSummary();
  updateFormFields();
  enableControls();
}

function renderStatementCards() {
  statementCards.innerHTML = '';
  const cards = currentState.statements.map((text, index) => {
    const card = document.createElement('article');
    card.className = 'statement-card';

    if (currentState.isRevealed && currentState.lieIndex === index) {
      card.classList.add('statement-card--lie');
    }
    if (currentState.isRevealed && currentState.ownVoteIndex === index && currentState.lieIndex !== index) {
      card.classList.add('statement-card--wrong-pick');
    }

    const badge = document.createElement('span');
    badge.className = 'statement-card__label';
    badge.textContent = `Statement ${index + 1}`;

    const content = document.createElement('p');
    content.className = 'statement-card__text';
    content.textContent = text || 'Waiting for the host to set this statement.';

    card.appendChild(badge);
    card.appendChild(content);

    if (currentState.isRevealed && currentState.lieIndex === index) {
      const lieNote = document.createElement('div');
      lieNote.className = 'statement-card__note';
      lieNote.textContent = 'This was the lie! ✓';
      card.appendChild(lieNote);
    }

    return card;
  });

  statementCards.append(...cards);
}

function renderVoteButtons() {
  voteButtons.innerHTML = '';

  currentState.statements.forEach((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--vote';
    button.textContent = `Statement ${index + 1}`;
    button.dataset.index = String(index);
    button.disabled = !sessionId || !currentState.isPrepared || currentState.isRevealed;

    if (currentState.ownVoteIndex === index) {
      button.dataset.selected = 'true';
      const isRevealed = currentState.isRevealed;
      const isCorrect = isRevealed && currentState.lieIndex === index;
      const isWrong = isRevealed && currentState.lieIndex !== index;
      if (isCorrect) {
        button.dataset.result = 'correct';
        button.textContent = `✓ Correct! Statement ${index + 1}`;
      } else if (isWrong) {
        button.dataset.result = 'wrong';
        button.textContent = `✗ Wrong — Statement ${index + 1}`;
      } else {
        button.textContent = `✓ You picked Statement ${index + 1}`;
      }
    }

    button.addEventListener('click', () => {
      const selectedIndex = Number(button.dataset.index);
      const sameChoice = currentState.ownVoteIndex === selectedIndex;
      sendMessage({ type: 'cast-vote', voteIndex: sameChoice ? null : selectedIndex });
    });

    voteButtons.appendChild(button);
  });
}

function renderParticipants() {
  participantsList.innerHTML = '';
  const list = currentState.participants.slice();
  participantCount.textContent = String(list.length);

  list.forEach((participant) => {
    const row = document.createElement('div');
    row.className = 'participant-card';

    const left = document.createElement('div');
    left.className = 'participant-meta';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    nameSpan.textContent = participant.name;
    left.appendChild(nameSpan);
    
    if (participant.isHost) {
      const badge = document.createElement('span');
      badge.className = 'participant-badge';
      badge.textContent = 'Host';
      left.appendChild(badge);
    }

    const right = document.createElement('div');
    right.className = 'participant-status';
    if (currentState.isRevealed) {
      right.textContent = participant.voteIndex !== null ? `Chose ${participant.voteIndex + 1}` : 'No vote';
    } else {
      right.textContent = participant.hasVoted ? '✓ Voted' : 'Waiting...';
    }

    row.appendChild(left);
    row.appendChild(right);
    participantsList.appendChild(row);
  });
}

function renderVoteSummary() {
  if (!voteSummary) return;
  
  if (!currentState.isPrepared) {
    voteSummary.hidden = true;
    return;
  }
  
  voteSummary.hidden = false;
  const currentVotes = currentState.participants.reduce((summary, participant) => {
    if (participant.voteIndex === null || participant.voteIndex === undefined) return summary;
    summary[participant.voteIndex] = (summary[participant.voteIndex] || 0) + 1;
    return summary;
  }, {});

  voteSummary.innerHTML = '';

  currentState.statements.forEach((_, index) => {
    const item = document.createElement('div');
    item.className = 'vote-summary-item';
    const votes = currentVotes[index] || 0;
    item.innerHTML = `
      <span>Statement ${index + 1}</span>
      <span>${votes} ${votes === 1 ? 'vote' : 'votes'}</span>
    `;
    voteSummary.appendChild(item);
  });
}

function updateFormFields() {
  const activeStatements = currentState.statements || ['', '', ''];
  statementInputs.forEach((textarea, index) => {
    textarea.value = activeStatements[index] || '';
    textarea.disabled = !isHost;
  });

  lieInputs.forEach((input) => {
    input.disabled = !isHost;
    if (Number(input.value) === currentState.lieIndex) {
      input.checked = true;
    } else {
      input.checked = false;
    }
  });
}

function getFormState() {
  return {
    statements: statementInputs.map((el) => el.value.trim()),
    lieIndex: lieInputs.find((input) => input.checked) ? Number(lieInputs.find((input) => input.checked).value) : null,
  };
}

function validateHostForm(statements, lieIndex) {
  if (statements.some((text) => !text)) {
    return 'Write all three statements.';
  }
  if (lieIndex === null || Number.isNaN(lieIndex)) {
    return 'Mark which statement is the lie.';
  }
  return '';
}

function prepareRound() {
  if (!isHost) {
    setStatus('Only the host can prepare the round.', 'error');
    return;
  }

  const formState = getFormState();
  const validationMessage = validateHostForm(formState.statements, formState.lieIndex);
  if (validationMessage) {
    setStatus(validationMessage, 'error');
    return;
  }

  sendMessage({
    type: 'prepare-round',
    statements: formState.statements,
    lieIndex: formState.lieIndex,
  });
  setStatus('Round prepared. Team can now vote.', 'success');
}

function revealAnswer() {
  if (!isHost) {
    setStatus('Only the host can reveal.', 'error');
    return;
  }
  sendMessage({ type: 'reveal-answer' });
  setStatus('The lie has been revealed!', 'success');
}

function resetRound() {
  if (!isHost) {
    setStatus('Only the host can reset.', 'error');
    return;
  }
  sendMessage({ type: 'reset-round' });
  setStatus('Round reset. Ready for next round!', 'success');
}

function sendMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

function copyInviteLink() {
  if (!sessionId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('session_id', sessionId);
  const inviteLink = url.toString();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setStatus('Invite link copied!', 'success');
    }).catch(() => {
      window.prompt('Copy this link:', inviteLink);
    });
  } else {
    window.prompt('Copy this link:', inviteLink);
  }
}

// Event Listeners
createRoomBtn.addEventListener('click', () => {
  const newRoom = Math.random().toString(36).slice(2, 8).toUpperCase();
  roomCodeInput.value = newRoom;
  connectToRoom(newRoom);
});

joinRoomBtn.addEventListener('click', () => {
  connectToRoom(roomCodeInput.value);
});

// Allow Enter key in room code
roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectToRoom(roomCodeInput.value);
  }
});

// Allow Enter key in name field
displayNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectToRoom(roomCodeInput.value);
  }
});

copyInviteBtn.addEventListener('click', copyInviteLink);
prepareBtn.addEventListener('click', prepareRound);
revealBtn.addEventListener('click', revealAnswer);
resetBtn.addEventListener('click', resetRound);

document.addEventListener('DOMContentLoaded', () => {
  showSetupScreen();
  loadPreferences();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('session_id')) {
    const sessionIdFromUrl = sanitizeRoomCode(urlParams.get('session_id'));
    if (sessionIdFromUrl) {
      roomCodeInput.value = sessionIdFromUrl;
      if (displayNameInput.value.trim()) {
        connectToRoom(sessionIdFromUrl);
      }
    }
  }
});
