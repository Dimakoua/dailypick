/**
 * Stand-up Embed Helper
 *
 * Included by standalone games when loaded inside an iframe (?embed=1).
 * 1. Injects a <style> block immediately (before paint) to hide all chrome.
 * 2. Intercepts CustomEvents (standup:queue / standup:queue-reset) and
 *    forwards them to the parent via postMessage.
 * 3. Listens for postMessage from parent to receive roster updates.
 * 4. Notifies parent when ready.
 */
(function () {
  'use strict';

  // ---- Detect embed mode ----
  if (window.location.search.indexOf('embed=1') === -1) return;

  // ---- 1. Inject embed CSS immediately (synchronously, before paint) ----
  var css =
    'html { height: auto !important; min-height: unset !important; scroll-padding-top: 0 !important; }\n' +
    'body { margin: 0 !important; padding: 0 !important; background: transparent !important; min-height: unset !important; height: auto !important; display: block !important; overflow: visible !important; }\n' +
    '.seo-content-area, .settings-hint, .pip-trigger, .game-pip-trigger, [data-game-pip-trigger], [data-pip-trigger] { display: none !important; }\n' +
    'main { padding: 0 !important; margin: 0 !important; min-height: unset !important; height: auto !important; max-width: unset !important; width: 100% !important; }\n' +
    'main > h1:first-child { display: none !important; }\n' +
    '.similar-apps-section { display: none !important; }\n';

  // Game-specific hiding + layout reset (matched by URL path)
  var path = window.location.pathname;

  if (path.indexOf('/apps/speedway') === 0) {
    css += [
      /* Hide title, subtitle, SEO */
      '.app-card > h1 { display: none !important; }',
      '.app-card > .app-subheading { display: none !important; }',
      /* Strip card chrome */
      '.app-shell { padding: 0 !important; min-height: unset !important; }',
      '.app-card { padding: 8px !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: transparent !important; max-width: unset !important; width: 100% !important; }',
      /* Tighten controls */
      '.controls-container { margin-top: 4px !important; }',
      '.speedway-controls { gap: 8px !important; }',
      '.action-buttons { margin-top: 4px !important; }',
      /* Make track use available width */
      '#track-container { max-width: 100% !important; }',
    ].join('\n');
  }

  if (path.indexOf('/apps/trap') === 0) {
    css += [
      /* Hide title, hint, game info */
      'main > h1 { display: none !important; }',
      '#info { display: none !important; }',
      /* Strip game container margins */
      '.game-container { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: unset !important; }',
      '#gameCanvas { max-width: 100% !important; }',
      '#trapBtn { margin: 4px auto !important; }',
    ].join('\n');
  }

  if (path.indexOf('/apps/letters') === 0) {
    css += [
      /* Hide title, hint */
      'main > h1 { display: none !important; }',
      /* Strip app container */
      '#appContainer { padding: 0 !important; margin: 0 !important; align-items: stretch !important; width: 100% !important; max-width: unset !important; }',
      '#appContainer > .game-pip-trigger { display: none !important; }',
      '#gameContainer { max-width: unset !important; }',
      '#restartButton { margin-top: 8px !important; }',
    ].join('\n');
  }

  if (path.indexOf('/apps/gravity-drift') === 0) {
    css += [
      /* Hide hint, leaderboard (it has fixed positioning) */
      '#leaderboard { display: none !important; }',
      /* Strip game container */
      '.game-container { margin: 0 !important; padding: 4px !important; width: 100% !important; max-width: unset !important; align-items: stretch !important; }',
      '#gameCanvas { max-width: 100% !important; width: 100% !important; }',
      '#controls { margin-top: 4px !important; }',
    ].join('\n');
  }

  if (path.indexOf('/apps/patchinko-machine') === 0) {
    css += [
      /* Hide hero/header */
      '.page-hero { display: none !important; }',
      '.page-header { display: none !important; }',
      /* Strip page and container chrome */
      '.patchinko-page { width: 100% !important; max-width: unset !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; }',
      '.patchinko-container { padding: 4px !important; margin: 0 !important; max-width: unset !important; gap: 8px !important; }',
      '.patchinko-main { gap: 8px !important; justify-content: flex-start !important; }',
      /* Scale board and controls to fit inside narrow embed frames */
      '.patchinko-board-container { max-width: 100% !important; width: 100% !important; }',
      '.patchinko-controls { width: 100% !important; max-width: 100% !important; }',
      '.patchinko-main { flex-direction: column !important; }',
      '.patchinko-controls { order: 2 !important; }',
      '.patchinko-board-container { order: 1 !important; }',
      '#patchinko-canvas { max-width: 100% !important; width: 100% !important; }',
      '.pattern-selector { grid-template-columns: 1fr 1fr !important; }',
      '.control-group { padding: 12px !important; }',
    ].join('\n');
  }

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  var head = document.head;
  if (head) head.insertBefore(styleEl, head.firstChild);

  // ---- 2. Forward CustomEvents to parent via postMessage ----
  var isFramed = window.parent && window.parent !== window;
  function forwardEvent(type, detail) {
    if (!isFramed) return;
    try {
      window.parent.postMessage({ type: type, detail: detail, source: 'standup-embed' }, '*');
    } catch (e) { /* ignore */ }
  }

  window.addEventListener('standup:queue', function (e) {
    forwardEvent('standup:queue', e.detail);
  });
  window.addEventListener('standup:queue-reset', function (e) {
    forwardEvent('standup:queue-reset', e.detail);
  });

  // ---- 3. Listen for roster updates from parent ----
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'standup:set-roster') return;
    var roster = e.data.roster;
    if (!Array.isArray(roster)) return;
    try { localStorage.setItem('namesList', JSON.stringify(roster)); } catch (err) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('standup:roster-update', { detail: { roster: roster } }));

    // Auto-start games that need it (e.g. patchinko-machine)
    if (path.indexOf('/apps/patchinko-machine') === 0) {
      // Wait for the game to apply the roster and finish re-initializing, then auto-drop
      setTimeout(function () {
        var dropBtn = document.getElementById('drop-balls-btn');
        if (dropBtn && !dropBtn.disabled) {
          dropBtn.click();
        }
      }, 1200);
    }
  });

  // ---- 4. Notify parent when ready ----
  function notifyReady() {
    if (!isFramed) return;
    try {
      window.parent.postMessage({ type: 'standup:embed-ready', source: 'standup-embed' }, '*');
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyReady);
  } else {
    notifyReady();
  }
  window.addEventListener('load', notifyReady);

})();
