(() => {
  const STORAGE_KEY = 'dp_feedback_popup';
  const MIN_VISITS = 3;          // show after this many page views
  const DELAY_MS   = 25_000;     // wait 25 s after page load before showing
  const SNOOZE_DAYS = 60;        // re-show after this many days once dismissed / submitted

  // ── helpers ────────────────────────────────────────────────────────────────

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function setState(patch) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getState(), ...patch }));
    } catch { /* storage blocked */ }
  }

  function daysSince(ts) {
    return ts ? (Date.now() - ts) / 86_400_000 : Infinity;
  }

  // ── eligibility check ──────────────────────────────────────────────────────

  function shouldShow() {
    const state = getState();

    // Never show on the dedicated feedback page itself
    if (window.location.pathname.startsWith('/feedback')) return false;

    // Count this visit
    const visits = (state.visits || 0) + 1;
    setState({ visits });
    if (visits < MIN_VISITS) return false;

    // Respect snooze after dismiss or submission
    if (state.snoozedAt && daysSince(state.snoozedAt) < SNOOZE_DAYS) return false;

    return true;
  }

  // ── DOM refs ───────────────────────────────────────────────────────────────

  const popup       = document.getElementById('feedback-popup');
  const backdrop    = popup?.querySelector('.feedback-popup__backdrop');
  const closeBtn    = document.getElementById('feedback-popup-close');
  const stepStars   = document.getElementById('feedback-popup-step-stars');
  const stepMessage = document.getElementById('feedback-popup-step-message');
  const stepThanks  = document.getElementById('feedback-popup-step-thanks');
  const stars       = popup?.querySelectorAll('.feedback-popup__star');
  const form        = document.getElementById('feedback-popup-form');
  const ratingInput = document.getElementById('feedback-popup-rating-input');
  const pageInput   = document.getElementById('feedback-popup-page-input');
  const skipBtn     = document.getElementById('feedback-popup-skip');
  const submitBtn   = form?.querySelector('.feedback-popup__submit');
  const errorEl     = document.getElementById('feedback-popup-error');

  if (!popup) return;

  // ── open / close ───────────────────────────────────────────────────────────

  function openPopup() {
    if (pageInput) pageInput.value = window.location.pathname;
    popup.hidden = false;
    // rAF so the hidden→visible transition fires
    requestAnimationFrame(() => {
      requestAnimationFrame(() => popup.setAttribute('aria-hidden', 'false'));
    });
    closeBtn?.focus();
  }

  function closePopup() {
    popup.setAttribute('aria-hidden', 'true');
    popup.addEventListener('transitionend', () => {
      popup.hidden = true;
      // Reset to star step for next time
      showStep(stepStars);
      stars?.forEach(s => s.classList.remove('is-active'));
      form?.reset();
    }, { once: true });
    setState({ snoozedAt: Date.now() });
  }

  function showStep(step) {
    [stepStars, stepMessage, stepThanks].forEach(s => {
      if (s) s.hidden = s !== step;
    });
  }

  // ── star interaction ───────────────────────────────────────────────────────

  stars?.forEach(star => {
    star.addEventListener('click', () => {
      const value = star.dataset.value;
      if (ratingInput) ratingInput.value = value;

      // Highlight up to selected star
      stars.forEach(s => {
        s.classList.toggle('is-active', Number(s.dataset.value) <= Number(value));
      });

      // Brief pause then advance to message step
      setTimeout(() => showStep(stepMessage), 350);
    });
  });

  // ── form submit ────────────────────────────────────────────────────────────

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorEl) errorEl.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    const data = new FormData(form);

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data,
      });
      if (!res.ok) throw new Error('Network error');

      showStep(stepThanks);
      setState({ snoozedAt: Date.now(), submitted: true });

      // Auto-close after 3 s
      setTimeout(closePopup, 3000);
    } catch {
      if (errorEl) {
        errorEl.textContent = 'Could not send — please try again.';
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send feedback';
      }
    }
  });

  // ── skip (no message, but rating already sent via star click implied) ──────
  // We do a fire-and-forget silent submit with just the rating when skipping

  skipBtn?.addEventListener('click', async () => {
    if (ratingInput?.value) {
      const data = new FormData();
      data.append('access_key', '48c0d957-b209-4654-8efd-8adfa87e3651');
      data.append('subject', 'Daily Pick — quick feedback popup');
      data.append('rating', ratingInput.value);
      data.append('page', pageInput?.value || window.location.pathname);
      data.append('message', '(no comment)');
      fetch('https://api.web3forms.com/submit', { method: 'POST', body: data }).catch(() => {});
    }
    showStep(stepThanks);
    setState({ snoozedAt: Date.now() });
    setTimeout(closePopup, 2500);
  });

  // ── close triggers ─────────────────────────────────────────────────────────

  closeBtn?.addEventListener('click', closePopup);

  backdrop?.addEventListener('click', closePopup);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup.getAttribute('aria-hidden') === 'false') {
      closePopup();
    }
  });

  // ── trigger ────────────────────────────────────────────────────────────────

  if (shouldShow()) {
    setTimeout(openPopup, DELAY_MS);
  }
})();
