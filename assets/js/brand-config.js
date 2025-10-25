(() => {
  const BRAND_CONFIG_KEY = 'brandConfig';
  const DEFAULT_BRAND = {
    brandName: 'Daily Pick',
    brandMark: '🎯',
    accentColor: '#3498db',
    accentStrong: '#2980b9',
    backgroundColor: '#f4f7f6',
    surfaceColor: '#ffffff',
    textColor: '#34495e',
    headingColor: '#2d3e50',
    subtleTextColor: '#7f8c8d',
    borderColor: '#dde4eb',
    radius: '18px',
    shadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
    fontFamily: "'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    logoUrl: ''
  };

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
    fontFamily: '--brand-font-family',
    logoUrl: '--brand-logo'
  };

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
    if (!config) return;

    const merged = { ...DEFAULT_BRAND, ...config };
    const root = document.documentElement;

    Object.entries(cssVarMap).forEach(([key, cssVar]) => {
      if (merged[key] !== undefined && merged[key] !== null) {
        const value =
          key === 'logoUrl' && merged[key]
            ? `url("${merged[key]}")`
            : merged[key];
        root.style.setProperty(cssVar, value);
      }
    });

    const brandNameEl = document.querySelector('.brand-name');
    if (brandNameEl && merged.brandName) {
      brandNameEl.textContent = merged.brandName;
    }

    const brandMarkEl = document.querySelector('.brand-mark');
    if (brandMarkEl && merged.brandMark) {
      brandMarkEl.textContent = merged.brandMark;
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
  if (storedConfig) {
    applyBrandConfig(storedConfig);
  }

  window.addEventListener('brandConfigUpdated', (event) => {
    applyBrandConfig(event.detail);
  });
  window.addEventListener('storage', handleStorageChange);
})();
