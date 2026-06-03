(() => {
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
  const DEFAULT_COLOR = '#3498db';

  const viewEmpty = document.getElementById('viewEmpty');
  const viewCountdown = document.getElementById('viewCountdown');
  const viewError = document.getElementById('viewError');
  const viewName = document.getElementById('viewName');
  const viewTarget = document.getElementById('viewTarget');
  const viewPast = document.getElementById('viewPast');
  const viewContainer = document.getElementById('viewContainer');
  const vdDays = document.getElementById('vdDays');
  const vdHours = document.getElementById('vdHours');
  const vdMinutes = document.getElementById('vdMinutes');
  const vdSeconds = document.getElementById('vdSeconds');

  let tickerInterval = null;

  function parseDate(str) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
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
    return { days, hours, minutes, seconds, isPast };
  }

  function updateDisplay(targetDate) {
    const remaining = computeRemaining(targetDate);

    vdDays.textContent = String(remaining.days).padStart(2, '0');
    vdHours.textContent = String(remaining.hours).padStart(2, '0');
    vdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
    vdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

    // Pulse on seconds tick
    vdSeconds.classList.remove('pulse');
    void vdSeconds.offsetWidth;
    vdSeconds.classList.add('pulse');

    viewPast.hidden = !remaining.isPast;
  }

  function showError() {
    viewEmpty.hidden = true;
    viewCountdown.hidden = true;
    viewError.hidden = false;
  }

  function enterPresentationMode() {
    document.documentElement.classList.add('presentation-mode');
    // Persist so the global presentation-mode.js keeps it active
    try { localStorage.setItem('dpPresentationMode', 'true'); } catch (e) {}
  }

  // If user exits presentation mode via Escape or the exit button, let the
  // global handler manage the class — we just listen to keep our state in sync.
  window.addEventListener('dp:presentation-mode', (e) => {
    // If presentation mode was exited, we could show extra UI here.
    // For now the default behaviour (header/footer reappear) is fine.
  });

  function init() {
    const params = new URLSearchParams(location.search);
    const name = params.get('name');
    const dateStr = params.get('date');
    const color = params.get('color');

    // Validate
    if (!name || !dateStr) {
      showError();
      return;
    }

    const targetDate = parseDate(dateStr);
    if (!targetDate) {
      showError();
      return;
    }

    // Valid — show countdown
    viewEmpty.hidden = true;
    viewCountdown.hidden = false;

    const decodedName = decodeURIComponent(name);
    viewName.textContent = decodedName;
    viewTarget.textContent = `${formatDate(targetDate)} at ${formatTime(targetDate)}`;

    // Apply color theme
    const themeColor = color && COLORS.includes(color) ? color : DEFAULT_COLOR;
    viewContainer.style.setProperty('--brand-accent', themeColor);

    // Update page title
    document.title = `${decodedName} – Countdown | Daily Pick`;

    // Auto-enter presentation mode for a clean, immersive countdown
    enterPresentationMode();

    // Start ticker
    updateDisplay(targetDate);
    tickerInterval = setInterval(() => updateDisplay(targetDate), 1000);
  }

  init();
})();
