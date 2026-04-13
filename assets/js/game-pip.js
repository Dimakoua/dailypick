/**
 * game-pip.js – Whole-game Document Picture-in-Picture
 *
 * Moves the target game element (not a clone) into a Document PiP window so the
 * full interactive game continues running. On restore the element is moved back to
 * its original position in the main document.
 *
 * Usage on a trigger button:
 *   data-game-pip-target      CSS selector of the element to move into PiP (required)
 *   data-game-pip-exclude     Comma-separated selectors to detach before moving
 *                             (e.g. ".seo-content-area, .pip-trigger, .game-pip-trigger")
 *   data-game-pip-title       PiP window title (defaults to page title)
 *   data-game-pip-width       PiP window width in px  (default: 960)
 *   data-game-pip-height      PiP window height in px (default: 720)
 */
(function () {
    'use strict';

    // ── Placeholder styles injected once into the main document ──────────────
    function injectMainStyles() {
        if (document.getElementById('game-pip-main-styles')) return;
        const s = document.createElement('style');
        s.id = 'game-pip-main-styles';
        s.textContent = `
            .game-pip-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 360px;
                background: var(--brand-surface, rgba(11, 17, 34, 0.5));
                border: 2px dashed var(--brand-border, rgba(255, 255, 255, 0.18));
                border-radius: var(--brand-radius, 18px);
                padding: 40px;
                box-sizing: border-box;
                width: 100%;
            }
            .game-pip-placeholder__inner {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }
            .game-pip-placeholder__icon { font-size: 3rem; line-height: 1; }
            .game-pip-placeholder__text {
                color: var(--brand-subtle-text, rgba(231, 236, 248, 0.7));
                font-size: 1rem;
                margin: 0;
            }
        `;
        document.head.appendChild(s);
    }

    // ── Copy all stylesheets from main doc into the PiP document ─────────────
    function transferStyles(pipDoc) {
        const base = document.baseURI;
        document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(function (el) {
            const clone = el.cloneNode(true);
            if (clone.tagName === 'LINK') {
                const href = clone.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('data:')) {
                    try { clone.setAttribute('href', new URL(href, base).href); } catch (_) {}
                }
            }
            pipDoc.head.appendChild(clone);
        });

        // PiP-specific chrome
        const s = pipDoc.createElement('style');
        s.textContent = `
            *, *::before, *::after { box-sizing: border-box; }
            html, body { margin: 0; overflow-x: hidden; }
            body { padding-bottom: 52px; }
            .game-pip-bar {
                position: fixed;
                bottom: 0; left: 0; right: 0;
                background: var(--brand-surface, rgba(11, 17, 34, 0.96));
                border-top: 1px solid var(--brand-border, rgba(255, 255, 255, 0.14));
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                padding: 8px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                z-index: 99999;
            }
            .game-pip-bar__label {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--brand-subtle-text, rgba(231, 236, 248, 0.6));
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .game-pip-return-btn {
                flex-shrink: 0;
                background: var(--brand-accent, #3a8fd8);
                color: var(--brand-accent-contrast-text, #fff);
                border: none;
                border-radius: var(--radius-md, 10px);
                padding: 7px 14px;
                font-size: 0.85rem;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                letter-spacing: 0.01em;
                transition: opacity 0.15s;
                font-family: inherit;
            }
            .game-pip-return-btn:hover,
            .game-pip-return-btn:focus-visible {
                opacity: 0.82;
                outline: none;
            }
        `;
        pipDoc.head.appendChild(s);
    }

    // ── Forward keyboard events from PiP window to main document/window ──────
    // Needed so games that listen on document/window still receive key events
    // when the PiP window has keyboard focus.
    function forwardKeyEvents(pipDoc, pipWin) {
        var mainDoc = document;
        var mainWin = window;

        function relay(type, e) {
            var init = {
                key: e.key,
                code: e.code,
                keyCode: e.keyCode || 0,
                charCode: e.charCode || 0,
                which: e.which || 0,
                altKey: e.altKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                shiftKey: e.shiftKey,
                repeat: e.repeat,
                bubbles: true,
                cancelable: true,
            };
            mainDoc.dispatchEvent(new KeyboardEvent(type, init));
            mainWin.dispatchEvent(new KeyboardEvent(type, init));
        }

        ['keydown', 'keyup', 'keypress'].forEach(function (type) {
            pipDoc.addEventListener(type, function (e) { relay(type, e); }, true);
        });
    }

    // ── Core: open the PiP window and move the game element into it ──────────
    async function openGamePiP(trigger) {
        if (trigger.dataset.gamePipActive === 'true') return;

        var targetSel = trigger.dataset.gamePipTarget;
        if (!targetSel) {
            console.warn('[GamePiP] Missing data-game-pip-target on trigger', trigger);
            return;
        }

        var gameEl = document.querySelector(targetSel);
        if (!gameEl) {
            console.warn('[GamePiP] Target element not found:', targetSel);
            return;
        }

        if (!('documentPictureInPicture' in window)) {
            alert('Game Picture-in-Picture requires Chrome\u00a0116+ on desktop. Try updating your browser.');
            return;
        }

        var width  = Number(trigger.dataset.gamePipWidth)  || 960;
        var height = Number(trigger.dataset.gamePipHeight) || 720;
        var title  = trigger.dataset.gamePipTitle || document.title;
        var excludeSel = trigger.dataset.gamePipExclude || '';

        trigger.dataset.gamePipActive = 'true';
        trigger.disabled = true;

        var pipWin;
        try {
            pipWin = await documentPictureInPicture.requestWindow({ width: width, height: height });
        } catch (err) {
            trigger.dataset.gamePipActive = 'false';
            trigger.disabled = false;
            if (err.name !== 'AbortError') {
                alert('Could not open Picture-in-Picture window.');
            }
            return;
        }

        var pipDoc = pipWin.document;
        pipDoc.title = title;
        transferStyles(pipDoc);
        forwardKeyEvents(pipDoc, pipWin);

        // Stash elements that should not appear inside the PiP window
        var stash = [];
        if (excludeSel) {
            gameEl.querySelectorAll(excludeSel).forEach(function (el) {
                stash.push({ el: el, parent: el.parentNode, next: el.nextSibling });
                el.remove();
            });
        }

        // Record where the game element lives in the main document
        var origParent = gameEl.parentNode;
        var origNext   = gameEl.nextSibling;

        // Insert a placeholder so the layout doesn't collapse
        var ph = document.createElement('div');
        ph.className = 'game-pip-placeholder';
        ph.innerHTML =
            '<div class="game-pip-placeholder__inner">' +
                '<span class="game-pip-placeholder__icon">🪟</span>' +
                '<p class="game-pip-placeholder__text">Game is running in Picture-in-Picture</p>' +
                '<button class="app-button game-pip-restore-btn" type="button">↩ Return to Tab</button>' +
            '</div>';
        origParent.insertBefore(ph, origNext);

        // Move the game into the PiP document
        pipDoc.body.appendChild(gameEl);

        // Floating bar at the bottom of the PiP window
        var bar = pipDoc.createElement('div');
        bar.className = 'game-pip-bar';
        bar.innerHTML =
            '<span class="game-pip-bar__label">🪟 Picture-in-Picture</span>' +
            '<button class="game-pip-return-btn" type="button">↩ Return to Tab</button>';
        pipDoc.body.appendChild(bar);

        function restore() {
            if (!ph.isConnected) return; // already restored
            // Move game back to its original position
            if (origNext && origNext.isConnected) {
                origParent.insertBefore(gameEl, origNext);
            } else {
                origParent.appendChild(gameEl);
            }
            // Re-insert the stashed elements
            stash.forEach(function (item) {
                if (item.next && item.next.isConnected) {
                    item.parent.insertBefore(item.el, item.next);
                } else if (item.parent && item.parent.isConnected) {
                    item.parent.appendChild(item.el);
                }
            });
            ph.remove();
            trigger.dataset.gamePipActive = 'false';
            trigger.disabled = false;
            try { pipWin.close(); } catch (_) {}
        }

        ph.querySelector('.game-pip-restore-btn').addEventListener('click', restore);
        bar.querySelector('.game-pip-return-btn').addEventListener('click', restore);

        // The user may close the PiP window via the browser UI
        pipWin.addEventListener('pagehide', function () {
            if (!ph.isConnected) return;
            if (origNext && origNext.isConnected) {
                origParent.insertBefore(gameEl, origNext);
            } else {
                origParent.appendChild(gameEl);
            }
            stash.forEach(function (item) {
                if (item.next && item.next.isConnected) {
                    item.parent.insertBefore(item.el, item.next);
                } else if (item.parent && item.parent.isConnected) {
                    item.parent.appendChild(item.el);
                }
            });
            ph.remove();
            trigger.dataset.gamePipActive = 'false';
            trigger.disabled = false;
        }, { once: true });
    }

    // ── Initialise ────────────────────────────────────────────────────────────
    function init() {
        injectMainStyles();
        document.querySelectorAll('[data-game-pip-target]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openGamePiP(btn);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
