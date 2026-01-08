document.addEventListener('DOMContentLoaded', () => {
  const retroBoard = document.getElementById('retroBoard');
  const shareSessionBtn = document.getElementById('shareSessionBtn');
  const sessionBadge = document.getElementById('sessionBadge');

  let session;
  let currentState = null;
  let draggedCard = null;
  let draggedCardId = null;

  // Initialize session
  function initializeSession() {
    const url = new URL(window.location);
    let sessionId = url.searchParams.get('session_id');
    if (!sessionId) {
      sessionId = 'retro-' + Math.random().toString(36).substring(2, 11);
      url.searchParams.set('session_id', sessionId);
      window.history.replaceState({}, '', url);
    }

    sessionBadge.textContent = `Session: ${sessionId}`;

    session = new RetroBoardSession(sessionId, (state) => {
      currentState = state;
      renderBoard(state);
    });
  }

  // Share session functionality
  shareSessionBtn.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const originalText = shareSessionBtn.innerHTML;
      shareSessionBtn.innerHTML = '<span>✓</span> Copied!';
      setTimeout(() => {
        shareSessionBtn.innerHTML = originalText;
      }, 2000);
    });
  });

  // Render the board
  function renderBoard(state) {
    if (!state || !state.columns || !state.columnOrder) {
      return;
    }

    retroBoard.innerHTML = '';

    state.columnOrder.forEach(columnId => {
      const column = state.columns[columnId];
      if (!column) return;

      const columnEl = createColumnElement(column, state.cards);
      retroBoard.appendChild(columnEl);
    });
  }

  // Create column element
  function createColumnElement(column, cards) {
    const columnEl = document.createElement('div');
    columnEl.className = `retro-column ${column.color}`;
    columnEl.dataset.columnId = column.id;

    // Column header
    const header = document.createElement('div');
    header.className = 'column-header';

    const title = document.createElement('h2');
    title.className = 'column-title';
    title.contentEditable = 'true';
    title.textContent = column.title;
    title.dataset.columnId = column.id;

    title.addEventListener('blur', (e) => {
      const newTitle = e.target.textContent.trim();
      if (newTitle && newTitle !== column.title) {
        session.updateColumnTitle(column.id, newTitle);
      }
      title.classList.remove('editing');
    });

    title.addEventListener('focus', () => {
      title.classList.add('editing');
    });

    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        title.blur();
      }
    });

    const cardCount = document.createElement('span');
    cardCount.className = 'card-count';
    cardCount.textContent = `${column.cardIds.length} cards`;

    header.appendChild(title);
    header.appendChild(cardCount);

    // Add card form
    const form = document.createElement('form');
    form.className = 'add-card-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-card-input';
    input.placeholder = 'Add a card...';
    input.setAttribute('aria-label', `Add card to ${column.title}`);

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'add-card-btn';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', 'Add card');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (content) {
        session.addCard(column.id, content);
        input.value = '';
      }
    });

    form.appendChild(input);
    form.appendChild(addBtn);

    // Cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cardsContainer.dataset.columnId = column.id;

    // Add drag and drop event listeners
    cardsContainer.addEventListener('dragover', handleDragOver);
    cardsContainer.addEventListener('drop', handleDrop);
    cardsContainer.addEventListener('dragleave', handleDragLeave);

    // Render cards
    column.cardIds.forEach(cardId => {
      const card = cards[cardId];
      if (card) {
        const cardEl = createCardElement(card);
        cardsContainer.appendChild(cardEl);
      }
    });

    columnEl.appendChild(header);
    columnEl.appendChild(form);
    columnEl.appendChild(cardsContainer);

    return columnEl;
  }

  // Create card element
  function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'retro-card';
    cardEl.draggable = true;
    cardEl.dataset.cardId = card.id;

    // Add drag event listeners
    cardEl.addEventListener('dragstart', handleDragStart);
    cardEl.addEventListener('dragend', handleDragEnd);

    // Card content
    const content = document.createElement('div');
    content.className = 'card-content';
    content.contentEditable = 'true';
    content.innerHTML = formatContent(card.content);
    content.dataset.cardId = card.id;

    content.addEventListener('blur', (e) => {
      const newContent = e.target.textContent.trim();
      if (newContent && newContent !== card.content) {
        session.updateCard(card.id, newContent);
      }
      content.classList.remove('editing');
    });

    content.addEventListener('focus', () => {
      content.classList.add('editing');
      // Store plain text for editing
      content.dataset.originalContent = card.content;
      content.textContent = card.content;
    });

    content.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        content.blur();
      }
    });

    // Card actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Vote section
    const voteSection = document.createElement('div');
    voteSection.className = 'vote-section';

    const voteBtn = document.createElement('button');
    voteBtn.className = 'vote-btn';
    voteBtn.innerHTML = '👍';
    voteBtn.setAttribute('aria-label', 'Vote for this card');

    const voteCount = document.createElement('span');
    voteCount.className = 'vote-count';
    voteCount.textContent = card.votes || 0;

    voteBtn.addEventListener('click', () => {
      session.voteCard(card.id);
    });

    voteSection.appendChild(voteBtn);
    voteSection.appendChild(voteCount);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', 'Delete card');

    deleteBtn.addEventListener('click', () => {
      if (confirm('Delete this card?')) {
        session.deleteCard(card.id);
      }
    });

    actions.appendChild(voteSection);
    actions.appendChild(deleteBtn);

    cardEl.appendChild(content);
    cardEl.appendChild(actions);

    return cardEl;
  }

  // Format content with basic markdown support
  function formatContent(content) {
    if (!content) return '';
    
    // Escape HTML
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert backticks to code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  // Drag and drop handlers
  function handleDragStart(e) {
    draggedCard = e.target;
    draggedCardId = e.target.dataset.cardId;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // Remove drag-over class from all containers
    document.querySelectorAll('.cards-container').forEach(container => {
      container.classList.remove('drag-over');
    });
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
    return false;
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    e.currentTarget.classList.remove('drag-over');

    if (!draggedCard || !draggedCardId) {
      return false;
    }

    const targetContainer = e.currentTarget;
    const targetColumnId = targetContainer.dataset.columnId;
    
    // Find source column
    let sourceColumnId = null;
    for (const columnId in currentState.columns) {
      if (currentState.columns[columnId].cardIds.includes(draggedCardId)) {
        sourceColumnId = columnId;
        break;
      }
    }

    if (!sourceColumnId) {
      return false;
    }

    // Calculate new index based on drop position
    const cards = Array.from(targetContainer.querySelectorAll('.retro-card:not(.dragging)'));
    let newIndex = cards.length;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      if (e.clientY < midY) {
        newIndex = i;
        break;
      }
    }

    // Send move command
    session.moveCard(draggedCardId, sourceColumnId, targetColumnId, newIndex);

    draggedCard = null;
    draggedCardId = null;

    return false;
  }

  // Initialize the session
  initializeSession();
});
