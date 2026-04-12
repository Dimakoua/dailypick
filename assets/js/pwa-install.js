(function () {
  'use strict';

  var DISMISS_KEY = 'pwa-dismissed-at';
  var DISMISS_DAYS = 14;

  // Don't show if already running as installed PWA
  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);
  if (isStandalone) return;

  // Don't show if dismissed recently
  var dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_DAYS * 86400000) return;

  var banner = document.getElementById('pwa-install-banner');
  var installBtn = document.getElementById('pwa-btn-install');
  var dismissBtn = document.getElementById('pwa-btn-dismiss');
  var subtitle = document.getElementById('pwa-banner-subtitle');
  if (!banner || !dismissBtn) return;

  function showBanner() {
    banner.removeAttribute('aria-hidden');
    banner.classList.add('pwa-visible');
  }

  function hideBanner() {
    banner.classList.remove('pwa-visible');
    banner.setAttribute('aria-hidden', 'true');
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  dismissBtn.addEventListener('click', hideBanner);

  // ── iOS: no native prompt, show manual share instructions ──────────────────
  var isIos =
    /iphone|ipod/i.test(navigator.userAgent) ||
    (/ipad/i.test(navigator.userAgent)) ||
    // iPadOS 13+ reports as Macintosh
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

  // Only show on Safari (iOS Chrome/Firefox can't install PWAs)
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isIos && isSafari) {
    subtitle.innerHTML =
      'Tap&nbsp;' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Share icon" style="display:inline;vertical-align:-2px">' +
        '<path d="M12 2v13M8 6l4-4 4 4M4 13v8h16v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '&nbsp;then &ldquo;<strong>Add to Home Screen</strong>&rdquo;';
    setTimeout(showBanner, 2500);
    return;
  }

  // ── Android / Chrome desktop: use native beforeinstallprompt ───────────────
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
    setTimeout(showBanner, 1500);
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (result) {
        deferredPrompt = null;
        if (result.outcome === 'accepted') hideBanner();
      });
    });
  }

  window.addEventListener('appinstalled', function () {
    hideBanner();
    deferredPrompt = null;
  });

  // ── Register service worker ────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Silently ignore SW registration failures
    });
  }
})();
