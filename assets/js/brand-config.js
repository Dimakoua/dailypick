(() => {
  const BRAND_CONFIG_KEY = 'brandConfig';
  const themeEngine = window.BrandThemeEngine;
  const FALLBACK_DEFAULT = {
    brandName: 'Daily Pick',
    brandMark: '🎯',
    accentColor: '#3498db',
    accentStrong: '#2980b9',
    accentMuted: 'rgba(52, 152, 219, 0.16)',
    accentContrastText: '#ffffff',
    backgroundColor: '#f4f7f6',
    surfaceColor: '#ffffff',
    textColor: '#34495e',
    headingColor: '#2d3e50',
    subtleTextColor: '#7f8c8d',
    borderColor: '#dde4eb',
    radius: '18px',
    shadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
    focusRing: '0 0 0 3px rgba(52, 152, 219, 0.35)',
    hoverShadow: '0 12px 30px rgba(52, 152, 219, 0.22)',
    fontFamily: "'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    logoUrl: '',
    themeIcon: '',
    themeBackground: 'none',
    themeAccentGlow: 'none',
    themeMode: 'auto',
    activeThemeId: null,
    holidayThemes: {},
    themeSchemaVersion: 1,
  };
  const DEFAULT_BRAND = themeEngine
    ? themeEngine.createDefaultBrandConfig()
    : { ...FALLBACK_DEFAULT };

  const cssVarMap = {
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
    fontFamily: '--brand-font-family',
    logoUrl: '--brand-logo',
    themeBackground: '--brand-theme-background',
    themeAccentGlow: '--brand-theme-accent-glow',
    themeIcon: '--brand-theme-icon',
    accentMuted: '--brand-accent-muted',
    accentContrastText: '--brand-accent-contrast-text',
  };

  const cssTransformers = {
    logoUrl: (value) => (value ? `url("${value}")` : 'none'),
    themeIcon: (value) => (value ? `'${value}'` : "''"),
  };

  let lastAppliedTheme = null;

  function composeBrandStyles(config) {
    if (!themeEngine) {
      const fallbackConfig = { ...DEFAULT_BRAND, ...config };
      return { config: fallbackConfig, styles: fallbackConfig, activeTheme: null };
    }
    return themeEngine.composeBrandStyles(config);
  }

  function safeParseBrandConfig(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch (err) {
      console.warn('[BrandConfig] Failed to parse stored config', err);
      return null;
    }
  }

  function applyBrandConfig(config) {
    const { config: hydratedConfig, styles, activeTheme } = composeBrandStyles(
      config || DEFAULT_BRAND,
    );
    const root = document.documentElement;

    Object.entries(cssVarMap).forEach(([key, cssVar]) => {
      if (styles[key] !== undefined && styles[key] !== null) {
        const transformer = cssTransformers[key];
        const value = transformer ? transformer(styles[key]) : styles[key];
        root.style.setProperty(cssVar, value);
      }
    });

    const brandNameEl = document.querySelector('.brand-name');
    if (brandNameEl && styles.brandName) {
      brandNameEl.textContent = styles.brandName;
    }

    const brandMarkEl = document.querySelector('.brand-mark');
    if (brandMarkEl && styles.brandMark) {
      brandMarkEl.textContent = styles.brandMark;
    }

    const themeId = activeTheme?.id || 'default';
    root.dataset.brandTheme = themeId;
    root.dataset.brandThemeName = activeTheme?.name || '';
    root.dataset.brandThemeRange = activeTheme?.metadata?.rangeLabel || '';

    window.currentBrandConfig = hydratedConfig;
    window.currentBrandTheme = activeTheme;

    if (themeId !== lastAppliedTheme) {
      window.dispatchEvent(
        new CustomEvent('brandThemeChanged', {
          detail: {
            theme: activeTheme,
            config: hydratedConfig,
          },
        }),
      );
      lastAppliedTheme = themeId;
    }
  }

  function getStoredConfig() {
    const raw = window.localStorage
      ? localStorage.getItem(BRAND_CONFIG_KEY)
      : null;
    return safeParseBrandConfig(raw);
  }

  function handleStorageChange(event) {
    if (event.key === BRAND_CONFIG_KEY) {
      applyBrandConfig(safeParseBrandConfig(event.newValue));
    }
  }

  const storedConfig = getStoredConfig();
  applyBrandConfig(storedConfig || DEFAULT_BRAND);

  window.addEventListener('brandConfigUpdated', (event) => {
    applyBrandConfig(event.detail);
  });
  window.addEventListener('storage', handleStorageChange);
})();
