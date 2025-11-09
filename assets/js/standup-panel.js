(function () {
  const standup = window.dailyPickStandup || null;
  const queueState = {
    participants: [],
    current: null,
    upcoming: [],
    completed: [],
    order: [],
    orderMode: false,
    detailCompleted: [],
    detailCurrent: null,
    hasQueueSession: false,
    lastSource: null,
  };

  const orderedManualState = {
    completed: [],
    current: null,
  };

  const ORDERED_LIST_SOURCES = new Set(['speedway', 'letters', 'gravity-drift']);
  const UPCOMING_DISPLAY_LIMIT = 8;

  let latestSnapshot = standup && typeof standup.getSnapshot === 'function' ? standup.getSnapshot() : null;
  let noteDebounce = null;

  const elements = {
    dock: null,
    toggle: null,
    panel: null,
    statusText: null,
    services: null,
    current: null,
    nextList: null,
    completedList: null,
    queueControls: null,
    queueNextButton: null,
    queueRandomButton: null,
    queueHint: null,
    assignmentsList: null,
    assignmentsEmpty: null,
    unassignedList: null,
    unassignedEmpty: null,
    notes: null,
  };

  function normalizeName(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function namesMatch(a, b) {
    return normalizeName(a) === normalizeName(b);
  }

  function resetManualOrderState() {
    orderedManualState.completed = [];
    orderedManualState.current = null;
  }

  function syncManualStateWithOrder(order) {
    if (!Array.isArray(order) || !order.length) {
      resetManualOrderState();
      return;
    }
    const allowedKeys = new Set(order.map((name) => normalizeName(name)).filter(Boolean));
    orderedManualState.completed = orderedManualState.completed.filter((name) => allowedKeys.has(normalizeName(name)));
    if (orderedManualState.current && !allowedKeys.has(normalizeName(orderedManualState.current))) {
      orderedManualState.current = null;
    }
  }

  function addManualCompletion(name) {
    const key = normalizeName(name);
    if (!key) return;
    const detailCompletedKeys = new Set(queueState.detailCompleted.map((entry) => normalizeName(entry)));
    if (detailCompletedKeys.has(key)) return;
    if (orderedManualState.completed.some((entry) => namesMatch(entry, name))) return;
    orderedManualState.completed.push(name);
  }

  function buildCompletedList() {
    const seen = new Set();
    const combined = [];
    queueState.detailCompleted.forEach((name) => {
      const key = normalizeName(name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      combined.push(name);
    });
    orderedManualState.completed.forEach((name) => {
      const key = normalizeName(name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      combined.push(name);
    });
    return { list: combined, seen };
  }

  function applyOrderedQueueState() {
    const order = Array.isArray(queueState.order) ? queueState.order : [];
    if (!order.length) {
      queueState.current = null;
      queueState.upcoming = [];
      queueState.completed = [];
      queueState.orderMode = false;
      return;
    }

    queueState.orderMode = true;
    syncManualStateWithOrder(order);

    const { list: completedList, seen } = buildCompletedList();
    queueState.completed = completedList;

    let current = null;
    if (queueState.detailCurrent && !seen.has(normalizeName(queueState.detailCurrent))) {
      current = queueState.detailCurrent;
      orderedManualState.current = null;
    } else if (orderedManualState.current && !seen.has(normalizeName(orderedManualState.current))) {
      current = orderedManualState.current;
    } else {
      current = order.find((name) => {
        const key = normalizeName(name);
        return key && !seen.has(key);
      }) || null;
      orderedManualState.current = current || null;
    }

    queueState.current = current;
    const currentKey = normalizeName(current);
    queueState.upcoming = order.filter((name) => {
      const key = normalizeName(name);
      if (!key) return false;
      if (seen.has(key)) return false;
      if (key === currentKey) return false;
      return true;
    });
  }

  function advanceOrderedQueue(forcedNextName = null) {
    if (!queueState.orderMode) return;
    if (queueState.current) {
      addManualCompletion(queueState.current);
    }
    queueState.detailCurrent = null;

    let manualTarget = null;
    const forcedKey = normalizeName(forcedNextName);
    if (forcedKey) {
      const { seen } = buildCompletedList();
      if (!seen.has(forcedKey)) {
        manualTarget = queueState.order.find((name) => normalizeName(name) === forcedKey) || null;
      }
    }
    orderedManualState.current = manualTarget;

    applyOrderedQueueState();
    renderQueue();
  }

  function selectRandomOrderedSpeaker() {
    if (!queueState.orderMode) return;
    const pool = [];
    if (queueState.current) {
      pool.push(queueState.current);
    }
    queueState.upcoming.forEach((name) => pool.push(name));
    const eligible = pool.filter((name) => name && !queueState.completed.some((entry) => namesMatch(entry, name)));
    if (!eligible.length) return;
    const choice = eligible[Math.floor(Math.random() * eligible.length)];
    if (queueState.current && namesMatch(queueState.current, choice)) {
      return;
    }
    advanceOrderedQueue(choice);
  }

  function selectManualSpeaker(name) {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return;

    if (queueState.current && !namesMatch(queueState.current, name)) {
      const alreadyLogged = queueState.completed.some((entry) => namesMatch(entry, queueState.current));
      if (!alreadyLogged) {
        queueState.completed.push(queueState.current);
      }
    }

    queueState.current = name;
    queueState.completed = queueState.completed.filter((entry) => !namesMatch(entry, name));
    queueState.upcoming = queueState.upcoming.filter((entry) => !namesMatch(entry, name));
    if (!queueState.participants.some((entry) => namesMatch(entry, name))) {
      queueState.participants.push(name);
    }

    renderQueue();
  }

  function updateQueueControls() {
    if (!elements.queueControls || !elements.queueNextButton || !elements.queueRandomButton) return;
    const hasQueueSession = queueState.hasQueueSession;
    const active = queueState.orderMode && queueState.order.length > 0;

    if (!hasQueueSession) {
      elements.queueControls.hidden = false;
      elements.queueNextButton.disabled = true;
      elements.queueRandomButton.disabled = true;
      if (elements.queueHint) {
        elements.queueHint.textContent = 'Run a game to send the speaker order here first.';
      }
      return;
    }

    elements.queueControls.hidden = !active;
    if (!active) {
      if (elements.queueHint) {
        elements.queueHint.textContent = 'Click any name to jump ahead.';
      }
      return;
    }

    if (elements.queueHint) {
      elements.queueHint.textContent = 'Click any name to jump ahead.';
    }
    const hasNext = Boolean(queueState.current) || queueState.upcoming.length > 0;
    elements.queueNextButton.disabled = !hasNext;
    const randomPool = [];
    if (queueState.current) randomPool.push(queueState.current);
    queueState.upcoming.forEach((name) => randomPool.push(name));
    elements.queueRandomButton.disabled = randomPool.length === 0;
  }

  function sanitizeList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    list.forEach((item) => {
      if (typeof item !== 'string') return;
      const trimmed = item.trim();
      if (!trimmed) return;
      const key = normalizeName(trimmed);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(trimmed);
    });
    return result;
  }

  function buildOrderedListFromCompleted(detail = {}) {
    const combined = [];
    const seen = new Set();
    const append = (list) => {
      sanitizeList(list).forEach((name) => {
        const key = normalizeName(name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        combined.push(name);
      });
    };
    append(detail.completed || []);
    append(detail.remaining || []);
    return combined;
  }

  function getDisplayName(name) {
    if (!name) return '';
    const key = normalizeName(name);
    if (latestSnapshot?.playerDirectory && latestSnapshot.playerDirectory[key]) {
      return latestSnapshot.playerDirectory[key];
    }
    return name;
  }

  function ensureUpcomingFallback() {
    if (queueState.upcoming.length) return;
    if (queueState.orderMode) return;
    const known = queueState.participants.length
      ? queueState.participants
      : Array.isArray(latestSnapshot?.players)
        ? latestSnapshot.players
        : [];
    if (!known.length) return;
    const completedKeys = new Set(queueState.completed.map((name) => normalizeName(name)));
    const currentKey = normalizeName(queueState.current);
    queueState.upcoming = known.filter((name) => {
      const key = normalizeName(name);
      if (!key) return false;
      if (key === currentKey) return false;
      return !completedKeys.has(key);
    });
  }

  function renderServices(snapshot) {
    if (!elements.services) return;
    elements.services.innerHTML = '';
    const services = Array.isArray(snapshot?.services) ? snapshot.services : [];
    if (!services.length) {
      if (snapshot?.loading) {
        elements.services.innerHTML = '<div class="standup-panel__service">Loading integration data…</div>';
      } else {
        elements.services.innerHTML = '<div class="standup-panel__service">Connect Jira, Trello, or GitHub in Settings to sync work here.</div>';
      }
      return;
    }

    services.forEach((service) => {
      const row = document.createElement('div');
      row.className = 'standup-panel__service';
      if (service.error) {
        row.dataset.error = 'true';
      }
      const badge = document.createElement('span');
      badge.className = 'standup-panel__service-badge';
      badge.textContent = service.label || service.service;

      const meta = document.createElement('p');
      meta.className = 'standup-panel__service-meta';
      const parts = [];
      if (typeof service.assignments === 'number') {
        parts.push(`${service.assignments} task${service.assignments === 1 ? '' : 's'}`);
      }
      if (typeof service.unassigned === 'number' && service.unassigned > 0) {
        parts.push(`${service.unassigned} unassigned`);
      }
      if (service.error) {
        parts.push(service.error);
      } else if (service.source === 'snapshot') {
        parts.push('Saved snapshot');
      } else if (service.source === 'live') {
        parts.push('Live');
      }
      meta.textContent = parts.join(' • ');

      row.appendChild(badge);
      row.appendChild(meta);
      elements.services.appendChild(row);
    });
  }

  function renderStatus(snapshot) {
    if (!elements.statusText) return;
    if (snapshot?.loading) {
      elements.statusText.textContent = 'Refreshing assignments…';
      return;
    }
    if (snapshot?.error) {
      elements.statusText.textContent = snapshot.error;
      return;
    }
    if (snapshot?.lastSyncedAt) {
      try {
        const date = new Date(snapshot.lastSyncedAt);
        const formatter = new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        elements.statusText.textContent = `Last synced ${formatter.format(date)}.`;
        return;
      } catch (error) {
        // ignore formatting errors
      }
    }
    elements.statusText.textContent = 'Ready for your next stand-up.';
  }

  function renderAssignments() {
    if (!elements.assignmentsList || !elements.assignmentsEmpty) return;
    const currentName = queueState.current;
    const key = normalizeName(currentName);
    const assignmentsEntry = key && latestSnapshot?.assignments ? latestSnapshot.assignments[key] : null;
    const items = Array.isArray(assignmentsEntry?.items) ? assignmentsEntry.items : [];

    elements.assignmentsList.innerHTML = '';
    if (!currentName) {
      elements.assignmentsEmpty.textContent = 'Spin or race to pick who is up next.';
      elements.assignmentsEmpty.hidden = false;
    } else if (!items.length) {
      elements.assignmentsEmpty.textContent = `${getDisplayName(currentName)} has no saved assignments.`;
      elements.assignmentsEmpty.hidden = false;
    } else {
      elements.assignmentsEmpty.hidden = true;
      items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'standup-item';
        const titleRow = document.createElement('div');
        titleRow.className = 'standup-item__title';
        if (item.shortId) {
          const badge = document.createElement('span');
          badge.className = 'standup-item__badge';
          badge.textContent = item.shortId;
          titleRow.appendChild(badge);
        }
        const title = document.createElement('span');
        title.textContent = item.title || 'Untitled';
        titleRow.appendChild(title);

        const metaRow = document.createElement('div');
        metaRow.className = 'standup-item__meta';
        const status = document.createElement('span');
        status.textContent = item.status ? item.status : item.type || '';
        metaRow.appendChild(status);
        if (item.url) {
          const link = document.createElement('a');
          link.href = item.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'standup-item__link';
          link.textContent = 'Open';
          metaRow.appendChild(link);
        }

        li.appendChild(titleRow);
        li.appendChild(metaRow);
        elements.assignmentsList.appendChild(li);
      });
    }
  }

  function renderNotes() {
    if (!elements.notes) return;
    const textarea = elements.notes;
    const currentName = queueState.current;
    if (!currentName) {
      textarea.value = '';
      textarea.disabled = true;
      textarea.placeholder = 'Select a speaker to take notes.';
      return;
    }
    textarea.disabled = false;
    const note = standup && typeof standup.getNote === 'function' ? standup.getNote(currentName) : '';
    textarea.value = note;
  }

  function renderUnassigned(snapshot) {
    if (!elements.unassignedList || !elements.unassignedEmpty) return;
    const items = Array.isArray(snapshot?.unassigned) ? snapshot.unassigned : [];
    elements.unassignedList.innerHTML = '';
    if (!items.length) {
      elements.unassignedEmpty.textContent = 'All caught up! No unassigned items right now.';
      elements.unassignedEmpty.hidden = false;
      return;
    }
    elements.unassignedEmpty.hidden = true;
    items.slice(0, 15).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'standup-item';
      const titleRow = document.createElement('div');
      titleRow.className = 'standup-item__title';
      if (item.shortId) {
        const badge = document.createElement('span');
        badge.className = 'standup-item__badge';
        badge.textContent = item.shortId;
        titleRow.appendChild(badge);
      }
      const title = document.createElement('span');
      title.textContent = item.title || 'Untitled';
      titleRow.appendChild(title);

      const metaRow = document.createElement('div');
      metaRow.className = 'standup-item__meta';
      const source = document.createElement('span');
      source.textContent = item.service ? item.service.toUpperCase() : '';
      metaRow.appendChild(source);
      if (item.url) {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'standup-item__link';
        link.textContent = 'Open';
        metaRow.appendChild(link);
      }

      li.appendChild(titleRow);
      li.appendChild(metaRow);
      elements.unassignedList.appendChild(li);
    });
  }

  function renderQueue() {
    if (!elements.current || !elements.nextList || !elements.completedList) return;
    ensureUpcomingFallback();

    const currentName = queueState.current ? getDisplayName(queueState.current) : '';
    if (currentName) {
      elements.current.dataset.empty = 'false';
      elements.current.textContent = currentName;
    } else {
      elements.current.dataset.empty = 'true';
      elements.current.textContent = 'Choose the next speaker.';
    }

    elements.nextList.innerHTML = '';
    const upcoming = sanitizeList(queueState.upcoming);
    const shouldLimitUpcoming = queueState.hasQueueSession;
    if (!upcoming.length && !queueState.current) {
      const fallback = queueState.participants.length
        ? queueState.participants
        : Array.isArray(latestSnapshot?.players)
          ? latestSnapshot.players
          : [];
      const fallbackLimit = shouldLimitUpcoming ? UPCOMING_DISPLAY_LIMIT : fallback.length;
      fallback.slice(0, fallbackLimit).forEach((name) => upcoming.push(name));
    }
    const upcomingToRender = shouldLimitUpcoming ? upcoming.slice(0, UPCOMING_DISPLAY_LIMIT) : upcoming;
    upcomingToRender.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = getDisplayName(name);
      li.dataset.player = name;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.classList.add('standup-next-item--selectable');
      elements.nextList.appendChild(li);
    });

    elements.completedList.innerHTML = '';
    queueState.completed.slice(-12).forEach((name) => {
      const li = document.createElement('li');
      li.textContent = getDisplayName(name);
      elements.completedList.appendChild(li);
    });

    renderAssignments();
    renderNotes();
    updateQueueControls();
  }

  function handleQueueUpdate(detail = {}) {
    const source = typeof detail.source === 'string' ? detail.source : '';
    queueState.hasQueueSession = true;
    queueState.lastSource = source || null;
    const providedOrder = Array.isArray(detail.order) ? sanitizeList(detail.order) : [];
    let derivedOrder = providedOrder;
    if (!derivedOrder.length && ORDERED_LIST_SOURCES.has(source)) {
      const orderedList = buildOrderedListFromCompleted(detail);
      if (orderedList.length) {
        derivedOrder = orderedList;
      }
    }

    if (derivedOrder.length) {
      const previousOrder = queueState.order || [];
      queueState.order = derivedOrder;
      if (Array.isArray(detail.participants) && detail.participants.length) {
        queueState.participants = sanitizeList(detail.participants);
      } else {
        queueState.participants = derivedOrder.slice();
      }
      queueState.detailCompleted = [];
      queueState.detailCurrent = null;

      const hasPreviousOrder = Array.isArray(previousOrder) && previousOrder.length > 0;
      const orderChanged =
        !hasPreviousOrder ||
        previousOrder.length > derivedOrder.length ||
        previousOrder.some((name, index) => !namesMatch(name, derivedOrder[index]));
      if (orderChanged) {
        resetManualOrderState();
      } else {
        syncManualStateWithOrder(derivedOrder);
      }

      applyOrderedQueueState();
      renderQueue();
      return;
    }

    queueState.orderMode = false;
    queueState.order = [];
    queueState.detailCompleted = [];
    queueState.detailCurrent = null;
    resetManualOrderState();

    if (Array.isArray(detail.participants)) {
      queueState.participants = sanitizeList(detail.participants);
    }
    if (Array.isArray(detail.order)) {
      const order = sanitizeList(detail.order);
      queueState.current = order[0] || null;
      queueState.upcoming = order.slice(1);
      queueState.completed = Array.isArray(detail.completed) ? sanitizeList(detail.completed) : [];
    } else {
      if ('current' in detail) {
        queueState.current = typeof detail.current === 'string' ? detail.current : null;
      }
      if (Array.isArray(detail.remaining)) {
        queueState.upcoming = sanitizeList(detail.remaining);
      } else if (Array.isArray(detail.queue)) {
        queueState.upcoming = sanitizeList(detail.queue);
      }
      if (Array.isArray(detail.completed)) {
        queueState.completed = sanitizeList(detail.completed);
      }
    }
    renderQueue();
  }

  function handleQueueReset(detail = {}) {
    queueState.hasQueueSession = true;
    queueState.lastSource = typeof detail.source === 'string' ? detail.source : queueState.lastSource;
    queueState.participants = sanitizeList(detail.participants || []);
    queueState.current = null;
    queueState.completed = sanitizeList(detail.completed || []);
    queueState.upcoming = queueState.participants.slice();
    queueState.order = [];
    queueState.orderMode = false;
    queueState.detailCurrent = null;
    queueState.detailCompleted = [];
    resetManualOrderState();
    renderQueue();
  }

  function attachEvents() {
    window.addEventListener('standup:queue', (event) => {
      handleQueueUpdate(event.detail || {});
    });

    window.addEventListener('standup:queue-reset', (event) => {
      handleQueueReset(event.detail || {});
    });
  }

  function createDock() {
    if (elements.dock) return;
    const dock = document.createElement('div');
    dock.className = 'standup-dock';
    dock.dataset.open = 'false';

    const panelId = 'standup-panel-' + Math.random().toString(36).slice(2, 8);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'standup-dock-toggle';
    toggle.innerHTML = '<span class="standup-dock-toggle-icon">🧭</span><span>Stand-up Dock</span>';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', panelId);
    toggle.addEventListener('click', () => {
      const isOpen = dock.dataset.open === 'true';
      dock.dataset.open = isOpen ? 'false' : 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen && standup && typeof standup.refresh === 'function') {
        standup.refresh();
      }
    });

    const panel = document.createElement('div');
    panel.className = 'standup-panel';
    panel.id = panelId;
    panel.innerHTML = `
      <header class="standup-panel__header">
        <div class="standup-panel__titles">
          <h2>Stand-up Dock</h2>
          <p class="standup-panel__subtitle">Keep the queue, notes, and assignments together.</p>
        </div>
        <div class="standup-panel__header-actions">
          <button type="button" class="standup-panel__refresh">Refresh</button>
        </div>
      </header>
      <div class="standup-panel__scroll" role="presentation">
        <p class="standup-panel__status-text"></p>
        <div class="standup-panel__services"></div>
        <section class="standup-section standup-section--queue">
          <h3>Speaker Queue</h3>
          <div class="standup-current" data-empty="true">Choose the next speaker.</div>
          <div class="standup-queue-controls" hidden>
            <div class="standup-queue-controls__actions">
              <button type="button" class="standup-queue-control standup-queue-control--next">Next speaker</button>
              <button type="button" class="standup-queue-control standup-queue-control--random">Pick random</button>
            </div>
            <p class="standup-queue-controls__hint">Click any name to jump ahead.</p>
          </div>
          <div class="standup-next">
            <span class="standup-next-label">Next up</span>
            <ul class="standup-next-list"></ul>
          </div>
          <details class="standup-completed">
            <summary>Completed</summary>
            <ul class="standup-completed-list"></ul>
          </details>
        </section>
        <section class="standup-section standup-section--assignments">
          <h3>Assigned work</h3>
          <div class="standup-assignments-empty">Spin or race to pick who is up next.</div>
          <ul class="standup-assignments-list"></ul>
          <label class="standup-notes">
            <span>Quick note</span>
            <textarea placeholder="Capture blockers or follow-ups…" disabled></textarea>
          </label>
        </section>
        <section class="standup-section standup-section--unassigned">
          <h3>Unassigned backlog</h3>
          <div class="standup-unassigned-empty">All caught up! No unassigned items right now.</div>
          <ul class="standup-unassigned-list"></ul>
        </section>
      </div>
    `;

    const refreshButton = panel.querySelector('.standup-panel__refresh');
    refreshButton?.addEventListener('click', () => {
      if (standup && typeof standup.refresh === 'function') {
        standup.refresh(true);
      }
    });

    const notesArea = panel.querySelector('.standup-notes textarea');
    if (notesArea) {
      notesArea.addEventListener('input', () => {
        const currentName = queueState.current;
        if (!currentName || !standup || typeof standup.setNote !== 'function') {
          return;
        }
        const value = notesArea.value;
        if (noteDebounce) {
          clearTimeout(noteDebounce);
        }
        noteDebounce = setTimeout(() => {
          standup.setNote(currentName, value);
        }, 250);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dock.dataset.open === 'true') {
        dock.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    dock.appendChild(toggle);
    dock.appendChild(panel);
    document.body.appendChild(dock);

    elements.dock = dock;
    elements.toggle = toggle;
    elements.panel = panel;
    elements.statusText = panel.querySelector('.standup-panel__status-text');
    elements.services = panel.querySelector('.standup-panel__services');
    elements.current = panel.querySelector('.standup-current');
    elements.nextList = panel.querySelector('.standup-next-list');
    elements.completedList = panel.querySelector('.standup-completed-list');
    elements.queueControls = panel.querySelector('.standup-queue-controls');
    elements.queueNextButton = panel.querySelector('.standup-queue-control--next');
    elements.queueRandomButton = panel.querySelector('.standup-queue-control--random');
    elements.queueHint = panel.querySelector('.standup-queue-controls__hint');
    elements.assignmentsList = panel.querySelector('.standup-assignments-list');
    elements.assignmentsEmpty = panel.querySelector('.standup-assignments-empty');
    elements.unassignedList = panel.querySelector('.standup-unassigned-list');
    elements.unassignedEmpty = panel.querySelector('.standup-unassigned-empty');
    elements.notes = notesArea;

    if (elements.queueNextButton) {
      elements.queueNextButton.addEventListener('click', () => {
        advanceOrderedQueue();
      });
    }
    if (elements.queueRandomButton) {
      elements.queueRandomButton.addEventListener('click', () => {
        selectRandomOrderedSpeaker();
      });
    }
    if (elements.nextList) {
      elements.nextList.addEventListener('click', (event) => {
        const target = event.target.closest('li[data-player]');
        if (!target) return;
        const name = target.dataset.player || target.textContent;
        if (queueState.orderMode) {
          advanceOrderedQueue(name);
        } else {
          selectManualSpeaker(name);
        }
      });
      elements.nextList.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target.closest('li[data-player]');
        if (!target) return;
        event.preventDefault();
        const name = target.dataset.player || target.textContent;
        if (queueState.orderMode) {
          advanceOrderedQueue(name);
        } else {
          selectManualSpeaker(name);
        }
      });
    }
  }

  function handleDataUpdate(snapshot) {
    latestSnapshot = snapshot;
    renderStatus(snapshot);
    renderServices(snapshot);
    renderUnassigned(snapshot);
    renderQueue();
  }

  function init() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    createDock();
    attachEvents();

    if (standup && typeof standup.subscribe === 'function') {
      standup.subscribe(handleDataUpdate);
      if (!latestSnapshot || (!latestSnapshot.services?.length && !latestSnapshot.players?.length)) {
        standup.refresh();
      } else {
        handleDataUpdate(latestSnapshot);
      }
    } else {
      handleDataUpdate(latestSnapshot || {});
    }

    renderQueue();
  }

  init();
})();
