(() => {
  const STORAGE_KEY = 'dp_countdown_events';
  const DEFAULT_COLOR = '#3498db';
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

  // DOM refs
  const createForm = document.getElementById('createForm');
  const eventNameInput = document.getElementById('eventName');
  const eventDateInput = document.getElementById('eventDate');
  const eventTimeInput = document.getElementById('eventTime');
  const colorSwatches = document.getElementById('colorSwatches');
  const activeEmpty = document.getElementById('activeEmpty');
  const activeCountdown = document.getElementById('activeCountdown');
  const activeName = document.getElementById('activeName');
  const activeTarget = document.getElementById('activeTarget');
  const activePast = document.getElementById('activePast');
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMinutes = document.getElementById('cdMinutes');
  const cdSeconds = document.getElementById('cdSeconds');
  const shareBtn = document.getElementById('shareBtn');
  const shareToast = document.getElementById('shareToast');
  const eventsGrid = document.getElementById('eventsGrid');
  const eventsEmpty = document.getElementById('eventsEmpty');

  // State
  let events = [];
  let activeEventId = null;
  let selectedColor = DEFAULT_COLOR;
  let tickerInterval = null;

  // Helpers
  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id-${Math.random().toString(36).slice(2, 10)}`;
  }

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      events = raw ? JSON.parse(raw) : [];
    } catch (e) {
      events = [];
    }
    if (!Array.isArray(events)) events = [];
  }

  function saveEvents() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function parseEventsDate(str) {
    return new Date(str);
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });
  }

  function computeRemaining(targetDate) {
    const now = Date.now();
    const diff = targetDate.getTime() - now;
    const isPast = diff < 0;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const seconds = Math.floor((abs % 60000) / 1000);
    return { days, hours, minutes, seconds, isPast, diff };
  }

  function formatRemainingShort(remaining) {
    const { days, hours, minutes, isPast } = remaining;
    const prefix = isPast ? '-' : '';
    if (days > 0) return `${prefix}${days}d ${hours}h ${minutes}m`;
    const secs = remaining.seconds;
    return `${prefix}${hours}h ${minutes}m ${secs}s`;
  }

  // Color swatches
  function initColorSwatches() {
    if (!colorSwatches) return;
    const swatches = colorSwatches.querySelectorAll('.color-swatch');
    swatches.forEach((s) => {
      s.addEventListener('click', () => {
        swatches.forEach((el) => el.dataset.selected = 'false');
        s.dataset.selected = 'true';
        selectedColor = s.dataset.color || DEFAULT_COLOR;
      });
    });
    if (swatches.length) {
      swatches[0].dataset.selected = 'true';
      selectedColor = swatches[0].dataset.color || DEFAULT_COLOR;
    }
  }

  // Create event
  function createEvent(name, dateStr, timeStr, color) {
    const dateTime = `${dateStr}T${timeStr}`;
    const event = {
      id: uuid(),
      name: name.trim(),
      date: dateTime,
      color: color || DEFAULT_COLOR,
      createdAt: Date.now(),
    };
    events.unshift(event);
    saveEvents();
    setActiveEvent(event.id);
    renderEvents();
  }

  // Delete event
  function deleteEvent(id) {
    events = events.filter((e) => e.id !== id);
    saveEvents();
    if (activeEventId === id) {
      activeEventId = events.length ? events[0].id : null;
      if (activeEventId) {
        setActiveEvent(activeEventId);
      } else {
        showEmptyState();
      }
    }
    renderEvents();
  }

  // Set active event
  function setActiveEvent(id) {
    activeEventId = id;
    const event = events.find((e) => e.id === id);
    if (!event) return;

    if (activeEmpty) activeEmpty.hidden = true;
    if (activeCountdown) activeCountdown.hidden = false;
    if (activeName) activeName.textContent = event.name;

    const targetDate = parseEventsDate(event.date);
    if (activeTarget) {
      activeTarget.textContent = `${formatDate(targetDate)} at ${formatTime(targetDate)}`;
    }

    if (activeCountdown) {
      activeCountdown.style.setProperty('--event-color', event.color);
    }

    startTicker();
  }

  function showEmptyState() {
    activeEventId = null;
    if (activeEmpty) activeEmpty.hidden = false;
    if (activeCountdown) activeCountdown.hidden = true;
    stopTicker();
  }

  // Ticker
  function startTicker() {
    stopTicker();
    updateCountdownDisplay();
    tickerInterval = setInterval(updateCountdownDisplay, 1000);
  }

  function stopTicker() {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
  }

  function updateCountdownDisplay() {
    const event = events.find((e) => e.id === activeEventId);
    if (!event) {
      showEmptyState();
      return;
    }

    const targetDate = parseEventsDate(event.date);
    const remaining = computeRemaining(targetDate);

    if (cdDays) cdDays.textContent = String(remaining.days).padStart(2, '0');
    if (cdHours) cdHours.textContent = String(remaining.hours).padStart(2, '0');
    if (cdMinutes) cdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
    if (cdSeconds) cdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

    // Pulse animation on seconds
    if (cdSeconds) {
      cdSeconds.classList.remove('pulse');
      void cdSeconds.offsetWidth;
      cdSeconds.classList.add('pulse');
    }

    if (activePast) {
      activePast.hidden = !remaining.isPast;
    }
  }

  // Share — points to view.html
  function getShareUrl(event) {
    const params = new URLSearchParams({
      name: event.name,
      date: event.date,
      color: event.color,
    });
    // Share links go to the clean view page (view.html renders to /view/ via Eleventy)
    const basePath = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const base = location.origin + basePath + '/view/';
    return `${base}?${params.toString()}`;
  }

  async function copyShareLink(event) {
    const url = getShareUrl(event);
    try {
      await navigator.clipboard.writeText(url);
      if (shareToast) {
        shareToast.hidden = false;
        setTimeout(() => { shareToast.hidden = true; }, 2000);
      }
    } catch (e) {
      window.prompt('Copy this link:', url);
    }
  }

  // Render events list
  function renderEvents() {
    if (!eventsGrid) return;
    eventsGrid.innerHTML = '';
    if (!events.length) {
      if (eventsEmpty) eventsEmpty.hidden = false;
      eventsGrid.appendChild(eventsEmpty);
      return;
    }
    if (eventsEmpty) eventsEmpty.hidden = true;

    events.forEach((event) => {
      const targetDate = parseEventsDate(event.date);
      const remaining = computeRemaining(targetDate);

      const card = document.createElement('div');
      card.className = 'event-card';
      card.style.setProperty('--event-color', event.color);

      const name = document.createElement('h3');
      name.className = 'event-card__name';
      name.textContent = event.name;

      const time = document.createElement('p');
      time.className = 'event-card__time';
      time.textContent = `${formatDate(targetDate)} at ${formatTime(targetDate)}`;

      const countdown = document.createElement('p');
      countdown.className = `event-card__countdown${remaining.isPast ? ' past' : ''}`;
      countdown.textContent = remaining.isPast
        ? `${formatRemainingShort(remaining)} ago`
        : formatRemainingShort(remaining);

      const actions = document.createElement('div');
      actions.className = 'event-card__actions';

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn-view';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => setActiveEvent(event.id));

      const shareBtnCard = document.createElement('button');
      shareBtnCard.type = 'button';
      shareBtnCard.className = 'btn-share';
      shareBtnCard.textContent = 'Share';
      shareBtnCard.addEventListener('click', () => copyShareLink(event));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete';
      deleteBtn.textContent = 'Delete';
      let confirmPending = false;
      let confirmTimer = null;
      deleteBtn.addEventListener('click', () => {
        if (confirmPending) {
          clearTimeout(confirmTimer);
          confirmPending = false;
          deleteEvent(event.id);
          return;
        }
        confirmPending = true;
        deleteBtn.textContent = 'Confirm?';
        deleteBtn.classList.add('btn-delete-confirm');
        confirmTimer = setTimeout(() => {
          confirmPending = false;
          deleteBtn.textContent = 'Delete';
          deleteBtn.classList.remove('btn-delete-confirm');
        }, 3000);
      });

      actions.append(viewBtn, shareBtnCard, deleteBtn);
      card.append(name, time, countdown, actions);
      eventsGrid.appendChild(card);
    });
  }

  // Init
  function init() {
    loadEvents();
    initColorSwatches();

    // Set default date/time to now + 1 hour
    if (eventDateInput || eventTimeInput) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      if (eventDateInput) eventDateInput.value = `${yyyy}-${mm}-${dd}`;
      if (eventTimeInput) eventTimeInput.value = `${hh}:${min}`;
    }

    if (events.length) {
      setActiveEvent(events[0].id);
    } else {
      showEmptyState();
    }

    renderEvents();

    // Form submit
    if (createForm) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = eventNameInput.value.trim();
        const date = eventDateInput.value;
        const time = eventTimeInput.value;
        if (!name || !date || !time) return;
        createEvent(name, date, time, selectedColor);
        eventNameInput.value = '';
      });
    }

    // Share button in active countdown
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const event = events.find((e) => e.id === activeEventId);
        if (event) copyShareLink(event);
      });
    }
  }

  init();
})();
