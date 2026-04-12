(function () {
  'use strict';

  var DISMISS_KEY = 'pwa-dismissed-at';
  var DISMISS_DAYS = 14;

  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);

  // Always register the service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  // ── Standalone app UI ──────────────────────────────────────────────────────
  if (isStandalone) {
    setupAppNav();
    setupAppBar();
    return;
  }

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

  // ── Standalone helper functions ──────────────────────────────────────────

  function setupAppNav() {
    var nav = document.getElementById('pwa-bottom-nav');
    if (!nav) return;
    var pathname = window.location.pathname;
    var items = nav.querySelectorAll('.pwa-nav-item');
    items.forEach(function (item) {
      var href = item.getAttribute('href');
      var active = href === '/'
        ? pathname === '/'
        : (pathname === href || pathname.startsWith(href));
      if (active) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'page');
      }
    });
  }

  function setupAppBar() {
    var pathname = window.location.pathname;
    var headerContent = document.querySelector('.header-content');
    if (!headerContent || pathname === '/') return;

    // Inject back button
    var backBtn = document.createElement('button');
    backBtn.className = 'pwa-back-btn';
    backBtn.setAttribute('aria-label', 'Go back');
    backBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>' +
      '</svg><span>Back</span>';
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) window.history.back();
      else window.location.href = '/';
    });
    headerContent.insertBefore(backBtn, headerContent.firstChild);

    // Extract page title from first h1, stripping leading emoji/symbols
    var h1 = document.querySelector('main h1, h1');
    var rawTitle = (h1 ? h1.textContent : document.title.split('|')[0]).trim();
    rawTitle = rawTitle.replace(/^[^\w\d(]+/, '').trim();

    var titleEl = document.createElement('span');
    titleEl.className = 'pwa-app-title';
    titleEl.textContent = rawTitle || 'Daily Pick';
    headerContent.appendChild(titleEl);

    // Hide logo on non-home pages
    var siteTitle = headerContent.querySelector('.site-title');
    if (siteTitle) siteTitle.classList.add('pwa-hidden-logo');
  }
})();
