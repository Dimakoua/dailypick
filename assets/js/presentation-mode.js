(function() {
    const STORAGE_KEY = 'dpPresentationMode';
    const TOGGLE_CLASS = 'presentation-mode';

    function init() {
        const isEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
        if (isEnabled) {
            document.documentElement.classList.add(TOGGLE_CLASS);
            createExitButton();
        }

        // Add toggle buttons where needed
        addToggleToHeader();

        // Add hotkey listener
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                togglePresentationMode();
            }
            // Escape key also exits presentation mode
            if (e.key === 'Escape' && document.documentElement.classList.contains(TOGGLE_CLASS)) {
                togglePresentationMode();
            }
        });
    }

    function togglePresentationMode() {
        const isActive = document.documentElement.classList.toggle(TOGGLE_CLASS);
        localStorage.setItem(STORAGE_KEY, isActive);

        updateToggleButtonLabel(isActive);

        if (isActive) {
            createExitButton();
        } else {
            removeExitButton();
        }

        // Dispatch event for games that might need to resize canvases
        window.dispatchEvent(new CustomEvent('dp:presentation-mode', { detail: { enabled: isActive } }));
    }

    function createExitButton() {
        if (document.getElementById('presentationExitBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'presentationExitBtn';
        btn.type = 'button';
        btn.title = 'Exit Presentation Mode (Esc)';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Exit Presentation</span>
        `;
        btn.onclick = togglePresentationMode;
        document.body.appendChild(btn);
    }

    function removeExitButton() {
        const btn = document.getElementById('presentationExitBtn');
        if (btn) btn.remove();
    }

    function updateToggleButtonLabel(isActive) {
        const button = document.getElementById('presentationModeToggle');
        if (!button) return;

        button.title = isActive ? 'Exit Presentation Mode (Esc)' : 'Presentation Mode (Alt+P)';

        if (isActive) {
            button.classList.add('is-active');
        } else {
            button.classList.remove('is-active');
        }
    }

    function addToggleToHeader() {
        const brandingControls = document.querySelector('.branding-controls');
        if (!brandingControls) return;

        if (document.getElementById('presentationModeToggle')) {
            updateToggleButtonLabel(document.documentElement.classList.contains(TOGGLE_CLASS));
            return;
        }

        const button = document.createElement('button');
        button.id = 'presentationModeToggle';
        button.type = 'button';
        button.className = 'presentation-toggle';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h6v6"></path>
                <path d="M9 21H3v-6"></path>
                <path d="M21 3l-7 7"></path>
                <path d="M3 21l7-7"></path>
            </svg>
        `;
        button.onclick = togglePresentationMode;

        brandingControls.insertBefore(button, brandingControls.firstChild);
        updateToggleButtonLabel(document.documentElement.classList.contains(TOGGLE_CLASS));
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Watch for header changes (e.g. mobile nav opening) to ensure button exists
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const brandingControls = document.querySelector('.branding-controls');
                if (brandingControls && !document.getElementById('presentationModeToggle')) {
                    addToggleToHeader();
                    break;
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    // Expose globally if needed
    window.dailyPickPresentationMode = {
        toggle: togglePresentationMode,
        isEnabled: () => document.documentElement.classList.contains(TOGGLE_CLASS)
    };
})();
