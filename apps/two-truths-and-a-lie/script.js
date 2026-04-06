const ROOM_STORAGE_KEY = 'dailypick_two_truths_and_a_lie_room';
const NAME_STORAGE_KEY = 'dailypick_two_truths_and_a_lie_name';

const displayNameInput = document.getElementById('displayNameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const sessionBadge = document.getElementById('sessionBadge');
const statusLine = document.getElementById('statusLine');
const hostNotice = document.getElementById('hostNotice');
const hostControls = document.getElementById('hostControls');
const statementInputs = [
  document.getElementById('statement1'),
  document.getElementById('statement2'),
  document.getElementById('statement3'),
];
const lieInputs = Array.from(document.querySelectorAll('input[name="lieChoice"]'));
const prepareBtn = document.getElementById('prepareBtn');
const revealBtn = document.getElementById('revealBtn');
const resetBtn = document.getElementById('resetBtn');
const statementCards = document.getElementById('statementCards');
const voteButtons = document.getElementById('voteButtons');
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const voteSummary = document.getElementById('voteSummary');
const roundLabel = document.getElementById('roundLabel');

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
  localStorage.setItem(NAME_STORAGE_KEY, name);
  setStatus('Name saved', 'success');
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

function updateSessionBadge() {
  if (sessionId) {
    sessionBadge.textContent = `Room ${sessionId}`;
    sessionBadge.dataset.active = 'true';
  } else {
    sessionBadge.textContent = 'Offline';
    delete sessionBadge.dataset.active;
  }
}

function setStatus(message, type = 'info') {
  statusLine.textContent = message;
  statusLine.dataset.type = type;
}

function enableControls() {
  copyInviteBtn.disabled = !sessionId;
  prepareBtn.disabled = !isHost || !currentState.hostId || currentState.isRevealed;
  revealBtn.disabled = !isHost || !currentState.isPrepared || currentState.isRevealed;
  resetBtn.disabled = !isHost || !sessionId;
  voteButtons.querySelectorAll('button').forEach((button) => {
    button.disabled = !sessionId || !currentState.isPrepared || currentState.isRevealed;
  });

  if (hostControls) {
    hostControls.hidden = !isHost;
  }
  if (hostNotice) {
    hostNotice.hidden = !isHost;
  }
}

function updateRoundLabel() {
  if (roundLabel) {
    roundLabel.textContent = `Round ${currentState.roundIndex}`;
  }
}

function connectToRoom(rawCode) {
  const code = sanitizeRoomCode(rawCode);
  if (!code) {
    setStatus('Enter a room code before joining.', 'error');
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Switching rooms');
  }

  sessionId = code;
  saveRoomCode(sessionId);
  updateSessionBadge();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = new URL(`/api/two-truths-and-a-lie/websocket?session_id=${sessionId}`, window.location.href);
  wsUrl.protocol = protocol;

  ws = new WebSocket(wsUrl.href);

  ws.addEventListener('open', () => {
    setStatus(`Connected to room ${sessionId}`, 'success');
    copyInviteBtn.disabled = false;
    roomCodeInput.value = sessionId;
    if (displayNameInput.value.trim()) {
      sendMessage({ type: 'set-name', name: displayNameInput.value.trim() });
    }
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
    setStatus('Disconnected from the room.', 'error');
    sessionId = null;
    isHost = false;
    updateSessionBadge();
    enableControls();
  });

  ws.addEventListener('error', () => {
    setStatus('Unable to connect to the room.', 'error');
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
      lieNote.textContent = '✔️ Lie revealed';
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
    button.textContent = `Vote Statement ${index + 1}`;
    button.dataset.index = String(index);
    button.disabled = !sessionId || !currentState.isPrepared || currentState.isRevealed;

    if (currentState.ownVoteIndex === index) {
      button.dataset.selected = 'true';
      button.textContent = `Your pick: Statement ${index + 1}`;
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
    left.innerHTML = `
      <span class="participant-name">${participant.name}</span>
      ${participant.isHost ? '<span class="participant-badge">Host</span>' : ''}
    `;

    const right = document.createElement('div');
    right.className = 'participant-status';
    if (currentState.isRevealed) {
      right.textContent = participant.voteIndex !== null ? `Chose ${participant.voteIndex + 1}` : 'No vote';
    } else {
      right.textContent = participant.hasVoted ? 'Voted' : 'Waiting';
    }

    row.appendChild(left);
    row.appendChild(right);
    participantsList.appendChild(row);
  });
}

function renderVoteSummary() {
  if (!voteSummary) return;
  const currentVotes = currentState.participants.reduce((summary, participant) => {
    if (participant.voteIndex === null || participant.voteIndex === undefined) return summary;
    summary[participant.voteIndex] = (summary[participant.voteIndex] || 0) + 1;
    return summary;
  }, {});

  voteSummary.innerHTML = '';

  currentState.statements.forEach((_, index) => {
    const item = document.createElement('div');
    item.className = 'vote-summary-item';
    item.innerHTML = `
      <span>Statement ${index + 1}</span>
      <span>${currentVotes[index] || 0} votes</span>
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
    if (currentState.isRevealed || !isHost) {
      input.checked = false;
      input.closest('.radio-field')?.classList.remove('radio-field--checked');
    } else if (Number(input.value) === currentState.lieIndex) {
      input.checked = true;
      input.closest('.radio-field')?.classList.add('radio-field--checked');
    } else {
      input.checked = false;
      input.closest('.radio-field')?.classList.remove('radio-field--checked');
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
    return 'All three statements must be entered before preparing the round.';
  }
  if (lieIndex === null || Number.isNaN(lieIndex)) {
    return 'Select which statement is the lie before preparing the round.';
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
  setStatus('Round prepared. Teammates can now vote for the lie.', 'success');
}

function revealAnswer() {
  if (!isHost) {
    setStatus('Only the host can reveal the lie.', 'error');
    return;
  }
  sendMessage({ type: 'reveal-answer' });
}

function resetRound() {
  if (!isHost) {
    setStatus('Only the host can reset the room.', 'error');
    return;
  }
  sendMessage({ type: 'reset-round' });
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

createRoomBtn.addEventListener('click', () => {
  const newRoom = Math.random().toString(36).slice(2, 8).toUpperCase();
  roomCodeInput.value = newRoom;
  connectToRoom(newRoom);
});

joinRoomBtn.addEventListener('click', () => {
  connectToRoom(roomCodeInput.value);
});

saveNameBtn.addEventListener('click', saveName);
copyInviteBtn.addEventListener('click', copyInviteLink);
prepareBtn.addEventListener('click', prepareRound);
revealBtn.addEventListener('click', revealAnswer);
resetBtn.addEventListener('click', resetRound);

document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('session_id')) {
    const sessionIdFromUrl = sanitizeRoomCode(urlParams.get('session_id'));
    if (sessionIdFromUrl) {
      roomCodeInput.value = sessionIdFromUrl;
      connectToRoom(sessionIdFromUrl);
    }
  }
});
