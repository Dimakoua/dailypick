document.addEventListener('DOMContentLoaded', () => {
  const retroBoard = document.getElementById('retroBoard');
  const shareSessionBtn = document.getElementById('shareSessionBtn');
  const sessionBadge = document.getElementById('sessionBadge');

  let session;
  let currentState = null;
  let draggedCard = null;
  let draggedCardId = null;
  let dropIndicator = null;

  // Track rendered DOM elements to minimize re-renders
  const columnElements = new Map();
  const cardElements = new Map();
  const cardRenderCache = new Map();

  let userReactions = new Map();
  let userReactionsStorageKey = null;

  // Keep in-progress input content stable across re-renders
  let pendingCardText = {};
  let focusedInput = null;

  function captureTransientState() {
    pendingCardText = {};
    document.querySelectorAll('.add-card-input').forEach((input) => {
      const columnId = input.dataset.columnId;
      if (!columnId) return;
      pendingCardText[columnId] = input.value;
    });

    const active = document.activeElement;
    if (active && active.classList.contains('add-card-input')) {
      focusedInput = {
        type: 'add-card',
        columnId: active.dataset.columnId,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
      };
    } else {
      focusedInput = null;
    }
  }

  function restoreTransientState() {
    if (!pendingCardText) return;

    Object.entries(pendingCardText).forEach(([columnId, value]) => {
      const input = document.querySelector(`.add-card-input[data-column-id="${columnId}"]`);
      if (input) {
        input.value = value;
        const addBtn = input.closest('.add-card-form')?.querySelector('.add-card-btn');
        if (addBtn) {
          addBtn.disabled = value.trim().length === 0;
        }
      }
    });

    if (focusedInput && focusedInput.type === 'add-card') {
      const input = document.querySelector(`.add-card-input[data-column-id="${focusedInput.columnId}"]`);
      if (input) {
        input.focus();
        if (typeof focusedInput.selectionStart === 'number' && typeof focusedInput.selectionEnd === 'number') {
          input.setSelectionRange(focusedInput.selectionStart, focusedInput.selectionEnd);
        }
      }
    }
  }

  function getUserReactionsStorageKey(sessionId) {
    return `retro-board-reactions-${sessionId}`;
  }

  function loadUserReactions() {
    if (!userReactionsStorageKey) return;
    try {
      const stored = localStorage.getItem(userReactionsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          userReactions = new Map(Object.entries(parsed).map(([cardId, reactions]) => [cardId, new Set(reactions)]));
        }
      }
    } catch (e) {
      // ignore invalid local storage values
    }
  }

  function saveUserReactions() {
    if (!userReactionsStorageKey) return;
    try {
      const plain = Object.fromEntries(Array.from(userReactions.entries()).map(([cardId, reactions]) => [cardId, Array.from(reactions)]));
      localStorage.setItem(userReactionsStorageKey, JSON.stringify(plain));
    } catch (e) {
      // ignore storage errors
    }
  }

  // Initialize session
  function initializeSession() {
    const url = new URL(window.location);
    let sessionId = url.searchParams.get('session_id');
    if (!sessionId) {
      sessionId = 'retro-' + Math.random().toString(36).substring(2, 11);
      url.searchParams.set('session_id', sessionId);
      window.history.replaceState({}, '', url);
    }

    userReactionsStorageKey = getUserReactionsStorageKey(sessionId);
    loadUserReactions();

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

  // Copy all session data (for pasting to Confluence)
  const copyAllBtn = document.getElementById('copyAllBtn');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      if (!currentState) {
        return;
      }

      const text = generateConfluenceText(currentState);

      // Try native clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          const original = copyAllBtn.innerHTML;
          copyAllBtn.innerHTML = '<span>✓</span> Copied!';
          setTimeout(() => { copyAllBtn.innerHTML = original; }, 2000);
        }).catch(() => {
          fallbackCopy(text, copyAllBtn);
        });
      } else {
        fallbackCopy(text, copyAllBtn);
      }
    });
  }

  function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      const original = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> Copied!';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch (e) {
      alert('Copy failed — please select and copy manually.');
    }
    document.body.removeChild(ta);
  }

  // Generate a simple Markdown-friendly export suitable for pasting into Confluence
  function generateConfluenceText(state) {
    const lines = [];
    try {
      // Add current date/time and session info
      lines.push(`Date: ${new Date().toLocaleString()}`);
      if (session && session.sessionId) {
        lines.push(`Session: ${session.sessionId}`);
      }
      lines.push('');

      state.columnOrder.forEach(colId => {
        const col = state.columns[colId];
        if (!col) return;
        lines.push(`## ${col.title}`);
        lines.push('');
        col.cardIds.forEach(cardId => {
          const card = state.cards[cardId];
          if (!card) return;
          const content = (card.content || '').replace(/\n+/g, ' ');
          lines.push(`- ${content} (votes: ${card.votes || 0})`);
        });
        lines.push('');
      });
    } catch (e) {
      console.error('Failed to generate export text', e);
    }
    return lines.join('\n');
  }

  // Render the board (incremental updates, no full re-render)
  function renderBoard(state) {
    if (!state || !state.columns || !state.columnOrder) {
      return;
    }

    captureTransientState();

    // Ensure columns exist and are in correct order
    const seenColumns = new Set();

    state.columnOrder.forEach((columnId, index) => {
      const column = state.columns[columnId];
      if (!column) return;

      seenColumns.add(columnId);

      let columnEl = columnElements.get(columnId);
      if (!columnEl) {
        columnEl = createColumnElement(column, state.cards);
        columnElements.set(columnId, columnEl);
        // Insert in order
        const existing = retroBoard.children[index];
        if (existing) {
          retroBoard.insertBefore(columnEl, existing);
        } else {
          retroBoard.appendChild(columnEl);
        }
      } else {
        updateColumnElement(columnEl, column, state.cards);
        // ensure correct order in DOM
        const expected = retroBoard.children[index];
        if (expected !== columnEl) {
          retroBoard.insertBefore(columnEl, expected);
        }
      }
    });

    // Remove columns that are no longer in state
    Array.from(columnElements.keys()).forEach((columnId) => {
      if (!seenColumns.has(columnId)) {
        const el = columnElements.get(columnId);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
        columnElements.delete(columnId);
      }
    });

    restoreTransientState();
  }

  // Update an existing column element based on new state
  function updateColumnElement(columnEl, column, cards) {
    const title = columnEl.querySelector('.column-title');
    if (title && title.textContent !== column.title) {
      title.textContent = column.title;
    }

    const cardCount = columnEl.querySelector('.card-count');
    if (cardCount) {
      cardCount.textContent = `${column.cardIds.length} cards`;
    }

    const cardsContainer = columnEl.querySelector('.cards-container');
    if (cardsContainer) {
      updateCardsInContainer(cardsContainer, column.cardIds, cards);
    }
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

    const sortBtn = document.createElement('button');
    sortBtn.className = 'sort-btn';
    sortBtn.type = 'button';
    sortBtn.textContent = '⇅ Sort';
    sortBtn.setAttribute('aria-label', 'Sort cards by votes');
    sortBtn.addEventListener('click', () => {
      session.sortColumn(column.id);
    });

    header.appendChild(title);
    header.appendChild(cardCount);
    header.appendChild(sortBtn);

    // Add card form
    const form = document.createElement('form');
    form.className = 'add-card-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-card-input';
    input.dataset.columnId = column.id;
    input.placeholder = 'Enter card text and press + or Enter';
    input.setAttribute('aria-label', `Add card to ${column.title}`);
    input.value = pendingCardText[column.id] || '';

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'add-card-btn';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', 'Add card');
    addBtn.disabled = true; // Initially disabled

    // Enable/disable button based on input content
    input.addEventListener('input', () => {
      pendingCardText[column.id] = input.value;
      addBtn.disabled = input.value.trim().length === 0;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const content = input.value.trim();
      if (content) {
        session.addCard(column.id, content);
        input.value = '';
        addBtn.disabled = true; // Disable after adding
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
    updateCardsInContainer(cardsContainer, column.cardIds, cards);

    columnEl.appendChild(header);
    columnEl.appendChild(form);
    columnEl.appendChild(cardsContainer);

    return columnEl;
  }

  function updateCardsInContainer(container, cardIds, cards) {
    const existingCards = Array.from(container.querySelectorAll('.retro-card'));
    const existingById = new Map(existingCards.map(el => [el.dataset.cardId, el]));

    // Insert / update cards in correct order
    cardIds.forEach((cardId, index) => {
      const card = cards[cardId];
      if (!card) return;

      let cardEl = existingById.get(cardId);
      if (!cardEl) {
        cardEl = createCardElement(card);
        cardElements.set(cardId, cardEl);
        cardRenderCache.set(cardId, { content: card.content, votes: card.votes });
      } else {
        updateCardElement(cardEl, card);
      }

      const existingAt = container.children[index];
      if (existingAt !== cardEl) {
        container.insertBefore(cardEl, existingAt || null);
      }

      existingById.delete(cardId);
    });

    // Remove any cards that are no longer in this column
    existingById.forEach((el, cardId) => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
      cardElements.delete(cardId);
      cardRenderCache.delete(cardId);
    });
  }

  function updateCardElement(cardEl, card) {
    const last = cardRenderCache.get(card.id) || {};

    // Update content if changed
    if (last.content !== card.content) {
      const content = cardEl.querySelector('.card-content');
      if (content) {
        content.innerHTML = formatContent(card.content);
      }
    }

    // Update reactions counts and buttons
    const reactions = card.reactions || {};
    const thumbs = reactions.thumbs || 0;

    reactionButtons.forEach(({ type }) => {
      const btn = cardEl.querySelector(`.reaction-btn[data-reaction="${type}"]`);
      if (!btn) return;

      const countEl = btn.querySelector('.reaction-count');
      if (countEl) {
        countEl.textContent = String(reactions[type] || 0);
      }

      const active = userReactions.get(card.id)?.has(type);
      btn.classList.toggle('active', !!active);
    });

    cardEl.classList.toggle('voted', thumbs > 0);
    cardEl.classList.toggle('high-votes', thumbs >= 3);

    // Show/hide delete button based on ownership
    const deleteBtn = cardEl.querySelector('.delete-btn');
    if (deleteBtn) {
      const isOwner = session.userId && card.owner === session.userId;
      deleteBtn.hidden = !isOwner;
    }

    cardRenderCache.set(card.id, {
      content: card.content,
      reactions,
    });
  }

  const reactionButtons = [
    { type: 'thumbs', emoji: '👍' },
    { type: 'heart', emoji: '❤️' },
    { type: 'tada', emoji: '🎉' },
    { type: 'thinking', emoji: '🤔' },
  ];

  // Create card element
  function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'retro-card';
    const reactions = card.reactions || {};
    const thumbs = reactions.thumbs || 0;
    const totalReactions = Object.values(reactions).reduce((sum, v) => sum + (v || 0), 0);

    if (thumbs > 0) {
      cardEl.classList.add('voted');
    }
    if (thumbs >= 3) {
      cardEl.classList.add('high-votes');
    }
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

    const reactionSection = buildReactionSection(card);

    // Delete button (only for the card owner)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', 'Delete card');

    const isOwner = session.userId && card.owner === session.userId;
    deleteBtn.hidden = !isOwner;

    deleteBtn.addEventListener('click', () => {
      if (!isOwner) return;
      if (confirm('Delete this card?')) {
        session.deleteCard(card.id);
      }
    });

    actions.appendChild(reactionSection);
    actions.appendChild(deleteBtn);

    cardEl.appendChild(content);
    cardEl.appendChild(actions);

    // Cache for rendering
    cardRenderCache.set(card.id, {
      content: card.content,
      reactions: card.reactions || {},
    });

    return cardEl;
  }

  // Build the reaction UI section for a card
  function buildReactionSection(card) {
    const reactionSection = document.createElement('div');
    reactionSection.className = 'reaction-section';

    reactionButtons.forEach(({ type, emoji }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-btn';
      btn.dataset.reaction = type;
      btn.setAttribute('aria-label', `React with ${emoji}`);
      btn.innerHTML = `${emoji} <span class="reaction-count">${(card.reactions && card.reactions[type]) || 0}</span>`;

      const isActive = userReactions.get(card.id)?.has(type);
      if (isActive) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        const reactions = userReactions.get(card.id) || new Set();
        const already = reactions.has(type);
        if (already) {
          reactions.delete(type);
        } else {
          reactions.add(type);
        }
        if (reactions.size > 0) {
          userReactions.set(card.id, reactions);
        } else {
          userReactions.delete(card.id);
        }
        saveUserReactions();

        // Optimistically update UI
        btn.classList.toggle('active', !already);
        const countEl = btn.querySelector('.reaction-count');
        if (countEl) {
          const current = parseInt(countEl.textContent || '0', 10) || 0;
          countEl.textContent = String(already ? current - 1 : current + 1);
        }

        session.reactCard(card.id, type);
      });

      reactionSection.appendChild(btn);
    });

    return reactionSection;
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

    // Create drop indicator
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    document.body.appendChild(dropIndicator);
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // Remove drag-over class from all containers
    document.querySelectorAll('.cards-container').forEach(container => {
      container.classList.remove('drag-over');
    });

    // Remove drop indicator
    if (dropIndicator && dropIndicator.parentNode) {
      dropIndicator.parentNode.removeChild(dropIndicator);
      dropIndicator = null;
    }
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');

    // Position drop indicator
    if (dropIndicator) {
      const targetContainer = e.currentTarget;
      const cards = Array.from(targetContainer.querySelectorAll('.retro-card:not(.dragging)'));
      let insertBefore = null;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          insertBefore = card;
          break;
        }
      }

      if (insertBefore) {
        const rect = insertBefore.getBoundingClientRect();
        dropIndicator.style.display = 'block';
        dropIndicator.style.left = rect.left + 'px';
        dropIndicator.style.top = (rect.top - 2) + 'px';
        dropIndicator.style.width = rect.width + 'px';
      } else if (cards.length > 0) {
        // Insert at the end
        const lastCard = cards[cards.length - 1];
        const rect = lastCard.getBoundingClientRect();
        dropIndicator.style.display = 'block';
        dropIndicator.style.left = rect.left + 'px';
        dropIndicator.style.top = (rect.bottom + 2) + 'px';
        dropIndicator.style.width = rect.width + 'px';
      } else {
        // Empty container
        const containerRect = targetContainer.getBoundingClientRect();
        dropIndicator.style.display = 'block';
        dropIndicator.style.left = containerRect.left + 8 + 'px';
        dropIndicator.style.top = containerRect.top + 8 + 'px';
        dropIndicator.style.width = (containerRect.width - 16) + 'px';
      }
    }

    return false;
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');

    // Hide drop indicator when leaving container
    if (dropIndicator) {
      dropIndicator.style.display = 'none';
    }
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
