(function () {
  const standup = window.dailyPickStandup || null;
  const queueState = {
    participants: [],
    current: null,
    upcoming: [],
    completed: [],
  };

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
    if (!upcoming.length && !queueState.current) {
      const fallback = queueState.participants.length
        ? queueState.participants
        : Array.isArray(latestSnapshot?.players)
          ? latestSnapshot.players
          : [];
      fallback.slice(0, 8).forEach((name) => upcoming.push(name));
    }
    upcoming.slice(0, 8).forEach((name) => {
      const li = document.createElement('li');
      li.textContent = getDisplayName(name);
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
  }

  function handleQueueUpdate(detail = {}) {
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
    queueState.participants = sanitizeList(detail.participants || []);
    queueState.current = null;
    queueState.completed = sanitizeList(detail.completed || []);
    queueState.upcoming = queueState.participants.slice();
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
      <p class="standup-panel__status-text"></p>
      <div class="standup-panel__services"></div>
      <section class="standup-section standup-section--queue">
        <h3>Speaker Queue</h3>
        <div class="standup-current" data-empty="true">Choose the next speaker.</div>
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
    elements.assignmentsList = panel.querySelector('.standup-assignments-list');
    elements.assignmentsEmpty = panel.querySelector('.standup-assignments-empty');
    elements.unassignedList = panel.querySelector('.standup-unassigned-list');
    elements.unassignedEmpty = panel.querySelector('.standup-unassigned-empty');
    elements.notes = notesArea;
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
