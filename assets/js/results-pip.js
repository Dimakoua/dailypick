(function () {
    const activeSessions = new Map();
    let currentSessionId = 0;

    const DEFAULT_WIDTH = 360;
    const DEFAULT_HEIGHT = 480;

    function cleanupSession(session) {
        if (!session) return;
        session.observer?.disconnect();
        if (session.renderLoop) {
            cancelAnimationFrame(session.renderLoop);
        }
        if (session.pipWindow && session.usesDocumentPiP) {
            try {
                session.pipWindow.close();
            } catch (err) {
                console.warn('[ResultsPiP] Failed to close PiP window', err);
            }
        }
    }

    function withAlpha(color, alpha) {
        if (!color) return '';
        const trimmed = String(color).trim();
        const normalizedAlpha = Math.min(Math.max(Number(alpha) || 0, 0), 1);

        if (!trimmed) return '';

        const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }
            if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
            }
        }

        if (trimmed.startsWith('rgba')) {
            const parts = trimmed
                .replace(/rgba\(([^)]+)\)/, '$1')
                .split(',')
                .map(part => part.trim())
                .slice(0, 3);
            if (parts.length === 3) {
                return `rgba(${parts.join(', ')}, ${normalizedAlpha})`;
            }
        }

        if (trimmed.startsWith('rgb')) {
            const parts = trimmed
                .replace(/rgb\(([^)]+)\)/, '$1')
                .split(',')
                .map(part => part.trim())
                .slice(0, 3);
            if (parts.length === 3) {
                return `rgba(${parts.join(', ')}, ${normalizedAlpha})`;
            }
        }

        return trimmed;
    }

    function copyStylesToPiP(pipDoc, sourceDoc) {
        const style = pipDoc.createElement('style');
        const computed = getComputedStyle(sourceDoc.body);
        const rootComputed = getComputedStyle(sourceDoc.documentElement);
        const getVar = (name, fallback) => {
            const value = rootComputed.getPropertyValue(name);
            return value && value.trim() ? value.trim() : fallback;
        };

        const fontFamily = computed.fontFamily || getVar('--brand-font-family', 'system-ui, sans-serif');
        const background = getVar('--brand-background', 'linear-gradient(180deg, #0d162c 0%, #070d1b 100%)');
        const surface = getVar('--brand-surface', 'rgba(11, 17, 34, 0.92)');
        const textColor = computed.color || getVar('--brand-text', '#e7ecf8');
        const headingColor = getVar('--brand-heading', '#ffffff');
        const subtleColor = getVar('--brand-subtle-text', withAlpha(headingColor, 0.65));
        const borderColor = getVar('--brand-border', 'rgba(255, 255, 255, 0.18)');
        const accent = getVar('--brand-accent', '#3a8fd8');
        const accentStrong = getVar('--brand-accent-strong', accent);
        const accentMuted = getVar('--brand-accent-muted', withAlpha(accent, 0.18));
        const radius = getVar('--brand-radius', '18px');
        const shadow = getVar('--brand-shadow', '0 18px 42px rgba(8, 12, 24, 0.42)');
        const rowBorder = withAlpha(accent, 0.26);
        const rowBorderStrong = withAlpha(accentStrong, 0.38);
        const rowBackground = accentMuted || withAlpha(accent, 0.16);
        const rowBackgroundTop = withAlpha(accentStrong, 0.22);
        const scrollbarThumb = withAlpha(accentStrong, 0.42);
        const subtleDivider = withAlpha(borderColor, 0.55);

        style.textContent = `
            :root {
                color-scheme: light dark;
            }
            *, *::before, *::after {
                box-sizing: border-box;
            }
            body {
                margin: 0;
                font-family: ${fontFamily};
                background: ${background};
                color: ${textColor};
                display: flex;
                align-items: stretch;
                justify-content: center;
                min-height: 100vh;
                padding: clamp(12px, 4vh, 28px);
            }
            .pip-results-wrapper {
                box-sizing: border-box;
                width: min(100%, 420px);
                margin: auto;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: clamp(12px, 2.4vh, 18px);
                overflow: visible;
            }
            .pip-results-wrapper #leaderboard {
                background: ${surface};
                color: ${textColor};
                border-radius: calc(${radius} - 4px);
                border: 1px solid ${borderColor};
                box-shadow: ${shadow};
                padding: clamp(18px, 4vh, 24px);
                display: flex;
                flex-direction: column;
                gap: clamp(12px, 2.2vh, 18px);
            }
            .pip-results-wrapper #leaderboard h1,
            .pip-results-wrapper #leaderboard h2,
            .pip-results-wrapper #leaderboard h3 {
                margin: 0;
                font-size: clamp(1.1rem, 2.6vw, 1.35rem);
                letter-spacing: 0.01em;
                color: ${headingColor};
            }
            .pip-results-wrapper #leaderboard p {
                margin: 0;
                color: ${subtleColor};
                font-size: clamp(0.8rem, 2.2vw, 0.92rem);
                line-height: 1.45;
            }
            .pip-results-wrapper #leaderboard .pip-trigger {
                display: none !important;
            }
            .pip-results-wrapper #leaderboard ol,
            .pip-results-wrapper #leaderboard ul {
                margin: 0;
                padding: 0;
                list-style: none;
                max-height: min(60vh, 360px);
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-right: 4px;
            }
            .pip-results-wrapper #leaderboard li {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                border-radius: calc(${radius} - 10px);
                background: ${rowBackground};
                border: 1px solid ${rowBorder};
                color: ${textColor};
                font-size: clamp(0.85rem, 2.2vw, 0.98rem);
                line-height: 1.45;
                box-shadow: inset 0 1px 0 ${withAlpha('#ffffff', 0.06)};
            }
            .pip-results-wrapper #leaderboard li:nth-child(1) {
                background: ${rowBackgroundTop};
                border-color: ${rowBorderStrong};
                box-shadow: inset 0 1px 0 ${withAlpha('#ffffff', 0.12)};
            }
            .pip-results-wrapper #leaderboard li + li {
                border-top: 1px solid ${subtleDivider};
            }
            .pip-results-wrapper #leaderboard li b,
            .pip-results-wrapper #leaderboard li strong {
                color: ${headingColor};
                font-weight: 700;
                flex: 1;
                min-width: 0;
            }
            .pip-results-wrapper #leaderboard li span,
            .pip-results-wrapper #leaderboard li small,
            .pip-results-wrapper #leaderboard li em {
                color: ${subtleColor};
                font-weight: 600;
                font-style: normal;
            }
            .pip-results-wrapper #leaderboard ul::-webkit-scrollbar,
            .pip-results-wrapper #leaderboard ol::-webkit-scrollbar {
                width: 8px;
            }
            .pip-results-wrapper #leaderboard ul::-webkit-scrollbar-thumb,
            .pip-results-wrapper #leaderboard ol::-webkit-scrollbar-thumb {
                background: ${scrollbarThumb};
                border-radius: 999px;
            }
            @media (max-width: 420px) {
                body {
                    padding: clamp(12px, 4vw, 18px);
                }
                .pip-results-wrapper #leaderboard {
                    padding: clamp(16px, 5vw, 20px);
                }
                .pip-results-wrapper #leaderboard li {
                    padding: 8px 10px;
                }
            }
            @media (max-height: 420px) {
                .pip-results-wrapper #leaderboard ol,
                .pip-results-wrapper #leaderboard ul {
                    max-height: min(50vh, 220px);
                }
            }
        `;
        pipDoc.head.appendChild(style);
    }

    function pruneClone(clone, excludeSelector) {
        if (!excludeSelector) return clone;
        const selectors = excludeSelector.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(selector => {
            clone.querySelectorAll(selector).forEach(node => node.remove());
        });
        return clone;
    }

    function renderIntoContainer(sourceElement, container, excludeSelector) {
        container.innerHTML = '';
        if (!sourceElement) return;
        const clone = pruneClone(sourceElement.cloneNode(true), excludeSelector);
        container.appendChild(clone);
    }

    function scheduleRender(session) {
        if (!session) return;
        if (session.renderQueued) return;
        session.renderQueued = true;
        session.renderLoop = requestAnimationFrame(() => {
            session.renderQueued = false;
            renderIntoContainer(session.sourceElement, session.container, session.excludeSelector);
        });
    }

    async function openResultsPiP(trigger) {
        const { pipTarget, pipTitle, pipWidth, pipHeight, pipExclude } = trigger.dataset;
        const targetSelector = pipTarget;
        if (!targetSelector) {
            console.warn('[ResultsPiP] Missing data-pip-target on trigger', trigger);
            return;
        }
        const sourceElement = document.querySelector(targetSelector);
        if (!sourceElement) {
            console.warn('[ResultsPiP] Unable to find target element for selector:', targetSelector);
            alert('Results area not found for Picture-in-Picture.');
            return;
        }

        const width = Number(pipWidth) || DEFAULT_WIDTH;
        const height = Number(pipHeight) || DEFAULT_HEIGHT;
        const title = pipTitle || 'Game Results';

        // Close existing sessions
        activeSessions.forEach(session => cleanupSession(session));
        activeSessions.clear();

        const usesDocumentPiP = 'documentPictureInPicture' in window;
        let pipWindow;
        if (usesDocumentPiP) {
            try {
                pipWindow = await documentPictureInPicture.requestWindow({ width, height });
            } catch (error) {
                console.error('[ResultsPiP] Failed to open Document Picture-in-Picture window', error);
                alert('Unable to open Picture-in-Picture window.');
                return;
            }
        } else {
            const fallbackWindow = window.open('', '', `width=${width},height=${height},noopener=yes`);
            if (!fallbackWindow) {
                alert('Picture-in-Picture not available and pop-up was blocked.');
                return;
            }
            pipWindow = fallbackWindow;
        }

        const pipDoc = pipWindow.document;
        pipDoc.documentElement.innerHTML = '<head><meta charset="utf-8"></head><body></body>';
        pipDoc.title = title;
        copyStylesToPiP(pipDoc, document);

        const wrapper = pipDoc.createElement('div');
        wrapper.className = 'pip-results-wrapper';
        pipDoc.body.appendChild(wrapper);

        const sessionId = ++currentSessionId;
        const session = {
            id: sessionId,
            trigger,
            sourceElement,
            pipWindow,
            pipDocument: pipDoc,
            usesDocumentPiP,
            container: wrapper,
            excludeSelector: pipExclude,
            observer: null,
            renderLoop: null,
            renderQueued: false,
        };

        renderIntoContainer(sourceElement, wrapper, pipExclude);

        session.observer = new MutationObserver(() => scheduleRender(session));
        session.observer.observe(sourceElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
        });

        const finalize = () => {
            if (!activeSessions.has(sessionId)) return;
            cleanupSession(session);
            activeSessions.delete(sessionId);
        };

        if (usesDocumentPiP) {
            pipWindow.addEventListener('pagehide', finalize, { once: true });
        } else {
            pipWindow.addEventListener('beforeunload', finalize, { once: true });
        }

        activeSessions.set(sessionId, session);
    }

    function attachTrigger(trigger) {
        if (!trigger || trigger.dataset.pipAttached === 'true') return;
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            openResultsPiP(trigger);
        });
        trigger.dataset.pipAttached = 'true';
    }

    function enableResultsPiP(options) {
        if (!options) return;
        const trigger = options.trigger || document.querySelector(options.triggerSelector || options.triggerId);
        if (!trigger) {
            console.warn('[ResultsPiP] Unable to find trigger element', options);
            return;
        }
        if (options.targetSelector) {
            trigger.dataset.pipTarget = options.targetSelector;
        }
        if (options.title) {
            trigger.dataset.pipTitle = options.title;
        }
        if (options.excludeSelector) {
            trigger.dataset.pipExclude = options.excludeSelector;
        }
        if (options.width) {
            trigger.dataset.pipWidth = String(options.width);
        }
        if (options.height) {
            trigger.dataset.pipHeight = String(options.height);
        }
        attachTrigger(trigger);
    }

    window.enableResultsPiP = enableResultsPiP;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-pip-target]').forEach(attachTrigger);
    });
})();
