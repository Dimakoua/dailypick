(function () {
  'use strict';

  var DISMISS_KEY = 'pwa-dismissed-at';
  var DISMISS_DAYS = 14;

  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true) ||
    new URLSearchParams(window.location.search).has('pwa');

  // Always register the service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  // ── Standalone app UI ──────────────────────────────────────────────────────
  if (isStandalone) {
    setupAppNav();
    setupAppBar();
    setupSearchBtn();
    setupSearch();
    return;
  }

  // Ensure bottom nav shows active state on mobile even when not in PWA mode
  setupAppNav();

  // Don't show if dismissed recently
  var dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_DAYS * 86400000) return;

  var banner = document.getElementById('pwa-install-banner');
  var installBtn = document.getElementById('pwa-btn-install');
  var dismissBtn = document.getElementById('pwa-btn-dismiss');
  var subtitle = document.getElementById('pwa-banner-subtitle');
  if (!banner || !dismissBtn) return;

  function showBanner() {
    var nav = document.getElementById('pwa-bottom-nav');
    if (nav) {
      var navHeight = nav.getBoundingClientRect().height;
      if (navHeight > 0) banner.style.bottom = navHeight + 'px';
    }
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
    setTimeout(showBanner, 30000);
    return;
  }

  // ── Android / Chrome desktop: use native beforeinstallprompt ───────────────
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
    setTimeout(showBanner, 30000);
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

  function setupSearchBtn() {
    var headerContent = document.querySelector('.header-content');
    if (!headerContent) return;

    // Inject search button on the right
    var searchBtn = document.createElement('button');
    searchBtn.className = 'pwa-search-btn';
    searchBtn.setAttribute('aria-label', 'Search');
    searchBtn.setAttribute('aria-expanded', 'false');
    searchBtn.setAttribute('aria-controls', 'pwa-search-overlay');
    searchBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7" stroke-width="2"/>' +
      '<path d="M16.5 16.5L21 21" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
    searchBtn.addEventListener('click', openSearch);
    headerContent.appendChild(searchBtn);
  }

  // ── Search overlay ──────────────────────────────────────────────────────────

  var searchDB = [];
  var searchLoaded = false;

  function loadSearchDB() {
    if (searchLoaded) return Promise.resolve();
    return fetch('/assets/js/apps-data.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        searchDB = data;
        searchLoaded = true;
      })
      .catch(function () {});
  }

  function fuzzySearch(query, items) {
    var q = query.toLowerCase().trim();
    if (!q) return [];
    return items
      .map(function (item) {
        var name = item.name.toLowerCase();
        var score = 0;
        if (name === q) return { item: item, score: 1000 };
        if (name.startsWith(q)) score = 500;
        var qi = 0;
        for (var i = 0; i < name.length && qi < q.length; i++) {
          if (name[i] === q[qi]) { score += 100 - i; qi++; }
        }
        return qi === q.length ? { item: item, score: score } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 10)
      .map(function (r) { return r.item; });
  }

  function setupSearch() {
    var overlay = document.getElementById('pwa-search-overlay');
    var input = document.getElementById('pwa-search-input');
    var results = document.getElementById('pwa-search-results');
    var cancel = document.getElementById('pwa-search-cancel');
    if (!overlay || !input || !results || !cancel) return;

    cancel.addEventListener('click', closeSearch);

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearch();
    });

    input.addEventListener('input', function () {
      renderResults(input.value);
    });

    renderPrompt(results);
  }

  function openSearch() {
    var overlay = document.getElementById('pwa-search-overlay');
    var input = document.getElementById('pwa-search-input');
    var searchBtn = document.querySelector('.pwa-search-btn');
    if (!overlay) return;
    overlay.removeAttribute('aria-hidden');
    overlay.classList.add('pwa-search-open');
    if (searchBtn) searchBtn.setAttribute('aria-expanded', 'true');
    loadSearchDB().then(function () {
      if (input) { input.value = ''; input.focus(); }
      renderPrompt(document.getElementById('pwa-search-results'));
    });
  }

  function closeSearch() {
    var overlay = document.getElementById('pwa-search-overlay');
    var searchBtn = document.querySelector('.pwa-search-btn');
    if (!overlay) return;
    overlay.classList.remove('pwa-search-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
  }

  function renderPrompt(container) {
    if (!container) return;
    container.innerHTML =
      '<div class="pwa-search-prompt">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" stroke-width="1.5"/><path d="M16.5 16.5L21 21" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '<p>Search games &amp; tools</p>' +
      '</div>';
  }

  function renderResults(query) {
    var container = document.getElementById('pwa-search-results');
    if (!container) return;
    if (!query.trim()) { renderPrompt(container); return; }
    var hits = fuzzySearch(query, searchDB);
    if (!hits.length) {
      container.innerHTML = '<p class="pwa-search-empty">No results for &ldquo;' + escHtml(query) + '&rdquo;</p>';
      return;
    }
    container.innerHTML = hits.map(function (item) {
      return '<a class="pwa-search-result" href="' + escHtml(item.path) + '">' +
        '<span class="pwa-search-result__emoji" aria-hidden="true">' + escHtml(item.emoji || '🎯') + '</span>' +
        '<span class="pwa-search-result__text">' +
          '<span class="pwa-search-result__name">' + escHtml(item.name) + '</span>' +
          '<span class="pwa-search-result__cat">' + escHtml(item.category || '') + '</span>' +
        '</span>' +
        '</a>';
    }).join('');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
