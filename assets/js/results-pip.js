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

    function copyStylesToPiP(pipDoc, sourceDoc) {
        const style = pipDoc.createElement('style');
        const computed = getComputedStyle(sourceDoc.body);
        style.textContent = `
            :root {
                color-scheme: light dark;
            }
            body {
                margin: 0;
                font-family: ${computed.fontFamily || 'system-ui, sans-serif'};
                background: rgba(20, 33, 61, 0.92);
                color: ${computed.color || '#f7f9fc'};
                display: flex;
                align-items: stretch;
                justify-content: stretch;
                min-height: 100vh;
            }
            .pip-results-wrapper {
                box-sizing: border-box;
                width: 100%;
                padding: 18px 22px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                overflow: auto;
            }
            .pip-results-wrapper h1,
            .pip-results-wrapper h2,
            .pip-results-wrapper h3 {
                margin: 0 0 8px 0;
            }
            .pip-results-wrapper ol,
            .pip-results-wrapper ul {
                margin: 0;
                padding-left: 20px;
            }
            .pip-results-wrapper li {
                margin-bottom: 4px;
                line-height: 1.4;
            }
            .pip-results-wrapper button {
                display: none !important;
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
