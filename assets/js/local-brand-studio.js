/**
 * Local Brand Studio
 * 
 * Manages game-specific branding customization with hierarchy:
 * 1. Auto holiday theme (lowest)
 * 2. Global brand config (middle)
 * 3. Local brand config (highest - per-game)
 * 
 * Games can define custom properties via `window.LocalBrandStudioConfig`
 * before this script loads.
 */

(() => {
  const LOCAL_BRAND_CONFIG_PREFIX = 'localBrandConfig-';
  const STORAGE_KEY_SUFFIX = () => {
    // Get game name from page path or data attribute
    const page = document.querySelector('[data-page-game]');
    return page?.dataset.pageGame || 
           window.location.pathname.split('/').filter(Boolean)[1] || 
           'default';
  };

  /**
   * Default customizable properties for all games
   * Games can extend/override via LocalBrandStudioConfig.customizableProperties
   */
  const DEFAULT_CUSTOMIZABLE_PROPERTIES = {
    accentColor: {
      label: 'Primary Color',
      type: 'color',
      description: 'Main accent color for interactive elements',
      default: 'inherited',
    },
    accentStrong: {
      label: 'Strong Accent',
      type: 'color',
      description: 'Darker variant for emphasis',
      default: 'inherited',
    },
    backgroundColor: {
      label: 'Background Color',
      type: 'color',
      description: 'Page background',
      default: 'inherited',
    },
    surfaceColor: {
      label: 'Surface Color',
      type: 'color',
      description: 'Card and panel backgrounds',
      default: 'inherited',
    },
    textColor: {
      label: 'Text Color',
      type: 'color',
      description: 'Default text color',
      default: 'inherited',
    },
  };

  const DEFAULT_CSS_VAR_MAP = {
    accentColor: '--brand-accent',
    accentStrong: '--brand-accent-strong',
    backgroundColor: '--brand-background',
    surfaceColor: '--brand-surface',
    textColor: '--brand-text',
    headingColor: '--brand-heading',
    subtleTextColor: '--brand-subtle-text',
    borderColor: '--brand-border',
    radius: '--brand-radius',
    shadow: '--brand-shadow',
    focusRing: '--brand-focus-ring',
    hoverShadow: '--brand-hover-shadow',
    accentMuted: '--brand-accent-muted',
    accentContrastText: '--brand-accent-contrast-text',
  };

  let customizableProperties = DEFAULT_CUSTOMIZABLE_PROPERTIES;
  let cssVarMap = DEFAULT_CSS_VAR_MAP;
  let localBrandConfig = null;
  let isUIShown = false;
  let gameName = '';
  // Tracks which CSS vars local-brand-studio has actively overridden,
  // so we never blindly remove vars set by brand-config.js (holiday themes).
  let appliedLocalVars = new Set();

  /**
   * Initialize local brand studio with game-specific config
   */
  function init() {
    gameName = STORAGE_KEY_SUFFIX();
    
    // Allow games to provide custom properties and CSS variable mappings
    if (window.LocalBrandStudioConfig?.customizableProperties) {
      customizableProperties = {
        ...DEFAULT_CUSTOMIZABLE_PROPERTIES,
        ...window.LocalBrandStudioConfig.customizableProperties,
      };
    }

    if (window.LocalBrandStudioConfig?.cssVarMap) {
      cssVarMap = {
        ...DEFAULT_CSS_VAR_MAP,
        ...window.LocalBrandStudioConfig.cssVarMap,
      };
    }

    loadLocalBrandConfig();
    createUI();
    applyLocalBrandConfig();
  }

  /**
   * Load saved local brand config from localStorage
   */
  function loadLocalBrandConfig() {
    const storageKey = `${LOCAL_BRAND_CONFIG_PREFIX}${gameName}`;
    const raw = window.localStorage?.getItem(storageKey);
    
    if (raw) {
      try {
        localBrandConfig = JSON.parse(raw);
      } catch (err) {
        console.warn('[LocalBrandStudio] Failed to parse saved config', err);
        localBrandConfig = {};
      }
    } else {
      localBrandConfig = {};
    }
  }

  /**
   * Save local brand config to localStorage
   */
  function saveLocalBrandConfig() {
    const storageKey = `${LOCAL_BRAND_CONFIG_PREFIX}${gameName}`;
    
    if (Object.keys(localBrandConfig).length === 0) {
      window.localStorage?.removeItem(storageKey);
    } else {
      window.localStorage?.setItem(storageKey, JSON.stringify(localBrandConfig));
    }
  }

  /**
   * Apply local brand config to CSS variables (overrides global config).
   * Only touches vars that local-brand-studio itself manages — never wipes
   * inline styles set by brand-config.js (holiday/seasonal themes).
   */
  function applyLocalBrandConfig() {
    const root = document.documentElement;
    const prevApplied = new Set(appliedLocalVars);
    const newApplied = new Set();

    Object.keys(cssVarMap).forEach((key) => {
      const cssVar = cssVarMap[key];
      const localValue = localBrandConfig[key];

      if (localValue && localValue !== 'inherited') {
        // Apply local override on top of whatever brand-config set
        root.style.setProperty(cssVar, localValue);
        newApplied.add(cssVar);
      }
    });

    // Restore vars that were previously overridden but are no longer in local config
    prevApplied.forEach((cssVar) => {
      if (!newApplied.has(cssVar)) {
        // Look up the matching config key to restore the brand-config value
        const configKey = Object.keys(cssVarMap).find((k) => cssVarMap[k] === cssVar);
        const brandValue = configKey != null ? window.currentBrandConfig?.[configKey] : undefined;
        if (brandValue !== undefined && brandValue !== null && brandValue !== '') {
          root.style.setProperty(cssVar, brandValue);
        } else {
          root.style.removeProperty(cssVar);
        }
      }
    });

    appliedLocalVars = newApplied;

    // Dispatch event so other systems know about the change
    window.dispatchEvent(
      new CustomEvent('localBrandConfigUpdated', {
        detail: { config: localBrandConfig, gameName },
      }),
    );
  }

  /**
   * Get current value from either local config or CSS variable
   */
  function getCurrentValue(propertyKey) {
    if (localBrandConfig[propertyKey]) {
      return localBrandConfig[propertyKey];
    }
    // Fall back to current CSS variable value
    const cssVar = cssVarMap[propertyKey];
    if (cssVar) {
      return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || 'inherited';
    }
    return 'inherited';
  }

  /**
   * Create and inject the local brand studio UI
   */
  function createUI() {
    // Create container
    const container = document.createElement('div');
    container.id = 'local-brand-studio-container';
    container.className = 'local-brand-studio-container';

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'local-brand-studio-toggle';
    toggleBtn.className = 'local-brand-studio-toggle';
    toggleBtn.setAttribute('aria-label', 'Open local brand customization');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.setAttribute('title', 'Customize this page\'s colors');
    toggleBtn.innerHTML = '🎨';
    toggleBtn.addEventListener('click', toggleUI);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'local-brand-studio-panel';
    panel.className = 'local-brand-studio-panel glass-card';
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', 'local-brand-studio-title');

    // Create panel header
    const header = document.createElement('div');
    header.className = 'local-brand-studio-header';
    
    const title = document.createElement('h3');
    title.id = 'local-brand-studio-title';
    title.className = 'local-brand-studio-title';
    title.textContent = 'Local Branding';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'local-brand-studio-close';
    closeBtn.setAttribute('aria-label', 'Close customization panel');
    closeBtn.setAttribute('type', 'button');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', closeUI);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create customization controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'local-brand-studio-controls';

    const description = document.createElement('p');
    description.className = 'local-brand-studio-description';
    description.textContent = 'Customize colors for this page. Resets when you leave. ';
    const brandLink = document.createElement('a');
    brandLink.href = '/apps/brand/';
    brandLink.textContent = 'More options in Brand Studio →';
    brandLink.className = 'local-brand-studio-brand-link';
    description.appendChild(brandLink);
    controlsContainer.appendChild(description);

    // Create controls for each customizable property
    Object.entries(customizableProperties).forEach(([key, config]) => {
      const control = createPropertyControl(key, config);
      controlsContainer.appendChild(control);
    });

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'local-brand-studio-actions';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'local-brand-studio-btn local-brand-studio-btn--secondary';
    resetBtn.setAttribute('type', 'button');
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', handleReset);

    const doneBtn = document.createElement('button');
    doneBtn.className = 'local-brand-studio-btn local-brand-studio-btn--primary';
    doneBtn.setAttribute('type', 'button');
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', closeUI);

    actions.appendChild(resetBtn);
    actions.appendChild(doneBtn);

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(controlsContainer);
    panel.appendChild(actions);

    // Assemble container
    container.appendChild(toggleBtn);
    container.appendChild(panel);

    // Inject into page
    document.body.appendChild(container);
  }

  /**
   * Create a single property control (e.g., color picker)
   */
  function createPropertyControl(propertyKey, config) {
    const control = document.createElement('div');
    control.className = 'local-brand-studio-control';

    const label = document.createElement('label');
    label.className = 'local-brand-studio-label';
    label.setAttribute('for', `local-brand-${propertyKey}`);
    label.textContent = config.label;
    label.setAttribute('title', config.description || config.label);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'local-brand-studio-input-wrapper';

    let input;
    if (config.type === 'color') {
      input = document.createElement('input');
      input.id = `local-brand-${propertyKey}`;
      input.className = 'local-brand-studio-color-input';
      input.type = 'color';
      input.value = normalizeColorToHex(getCurrentValue(propertyKey));
      input.setAttribute('title', config.description || config.label);
      input.addEventListener('input', (e) => handlePropertyChange(propertyKey, e.target.value));
    } else {
      input = document.createElement('input');
      input.id = `local-brand-${propertyKey}`;
      input.className = 'local-brand-studio-text-input';
      input.type = 'text';
      input.value = getCurrentValue(propertyKey);
      input.setAttribute('title', config.description || config.label);
      input.addEventListener('change', (e) => handlePropertyChange(propertyKey, e.target.value));
    }

    control.appendChild(label);
    inputWrapper.appendChild(input);
    control.appendChild(inputWrapper);

    return control;
  }

  /**
   * Convert any color format to hex for color input
   */
  function normalizeColorToHex(color) {
    if (!color || color === 'inherited') return '#3498db';
    
    // If already hex, return
    if (/^#[0-9A-F]{6}$/i.test(color)) return color;
    
    // Convert rgb/rgba to hex
    const rgb = color.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const hex = ((parseInt(rgb[0]) << 16) | (parseInt(rgb[1]) << 8) | parseInt(rgb[2]))
        .toString(16)
        .padStart(6, '0');
      return `#${hex}`;
    }
    
    return '#3498db';
  }

  /**
   * Handle property value change
   */
  function handlePropertyChange(propertyKey, value) {
    if (value === 'inherited' || value === '') {
      delete localBrandConfig[propertyKey];
    } else {
      localBrandConfig[propertyKey] = value;
    }
    
    saveLocalBrandConfig();
    applyLocalBrandConfig();
  }

  /**
   * Reset all local brand customizations
   */
  function handleReset() {
    const storageKey = `${LOCAL_BRAND_CONFIG_PREFIX}${gameName}`;
    window.localStorage?.removeItem(storageKey);

    localBrandConfig = {};
    applyLocalBrandConfig();

    // Refresh the UI to inherited/default values
    document.querySelectorAll('.local-brand-studio-color-input, .local-brand-studio-text-input')
      .forEach((input) => {
        input.value = normalizeColorToHex(getCurrentValue(
          input.id.replace('local-brand-', ''),
        ));
      });
  }

  /**
   * Toggle UI visibility
   */
  function toggleUI() {
    if (isUIShown) {
      closeUI();
    } else {
      showUI();
    }
  }

  /**
   * Show the local brand studio panel
   */
  function showUI() {
    const panel = document.getElementById('local-brand-studio-panel');
    if (panel) {
      panel.hidden = false;
      isUIShown = true;
      panel.focus();
    }
  }

  /**
   * Close the local brand studio panel
   */
  function closeUI() {
    const panel = document.getElementById('local-brand-studio-panel');
    if (panel) {
      panel.hidden = true;
      isUIShown = false;
    }
  }

  /**
   * Listen for global brand config changes and reapply local overrides
   */
  function setupEventListeners() {
    window.addEventListener('brandThemeChanged', () => {
      // Reapply local config to ensure it stays on top
      applyLocalBrandConfig();
    });

    window.addEventListener('brandConfigUpdated', () => {
      // Reapply local config to ensure it stays on top
      applyLocalBrandConfig();
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('local-brand-studio-panel');
      const toggle = document.getElementById('local-brand-studio-toggle');
      
      if (panel && !panel.hidden && 
          !panel.contains(e.target) && 
          !toggle.contains(e.target)) {
        closeUI();
      }
    });
  }

  /**
   * Expose API for games to access local brand config
   */
  window.LocalBrandStudio = {
    getConfig: () => ({ ...localBrandConfig }),
    updateConfig: (updates) => {
      Object.entries(updates).forEach(([key, value]) => {
        handlePropertyChange(key, value);
      });
    },
    reset: handleReset,
    show: showUI,
    hide: closeUI,
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      setupEventListeners();
    });
  } else {
    init();
    setupEventListeners();
  }
})();
