(() => {
  const THEME_SCHEMA_VERSION = 1;

  const BASE_BRAND = Object.freeze({
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
  });

  const RANGE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const DAYS = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };

  function toLocalDate(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 12, 0, 0);
  }

  function toISODateString(date) {
    const iso = new Date(date.getTime());
    iso.setHours(0, 0, 0, 0);
    return iso.toISOString().slice(0, 10);
  }

  function formatRange(start, end) {
    const startLabel = RANGE_FORMATTER.format(start);
    const endLabel = RANGE_FORMATTER.format(end);
    if (startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }

  function normalizeHex(hex) {
    if (typeof hex !== 'string') return null;
    const cleaned = hex.trim().replace(/^#/, '');
    if (cleaned.length === 3) {
      return cleaned
        .split('')
        .map((char) => `${char}${char}`)
        .join('');
    }
    if (cleaned.length === 6) {
      return cleaned;
    }
    return null;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const bigint = Number.parseInt(normalized, 16);
    if (Number.isNaN(bigint)) return null;
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  function rgbStringToRgb(color) {
    if (typeof color !== 'string') return null;
    const match = color
      .trim()
      .match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1]
      .split(',')
      .map((value) => Number.parseFloat(value.trim()))
      .filter((value, index) => index < 3 && Number.isFinite(value));
    if (parts.length !== 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function parseColorToRgb(color) {
    return hexToRgb(color) || rgbStringToRgb(color) || null;
  }

  function toRgbaString(rgb, alpha) {
    if (!rgb) return null;
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
  }

  function relativeLuminance(rgb) {
    if (!rgb) return 0;
    const transform = (value) => {
      const channel = value / 255;
      if (channel <= 0.03928) {
        return channel / 12.92;
      }
      return Math.pow((channel + 0.055) / 1.055, 2.4);
    };
    const r = transform(rgb.r);
    const g = transform(rgb.g);
    const b = transform(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getAccentContrast(rgb) {
    if (!rgb) return BASE_BRAND.accentContrastText;
    const luminance = relativeLuminance(rgb);
    const contrastWhite = (1.05) / (luminance + 0.05);
    const contrastDark = (luminance + 0.05) / 0.05;
    return contrastWhite >= contrastDark ? '#ffffff' : '#0f172a';
  }

  function computeAccentTokens(accentColor, overrides = {}) {
    const parsed = parseColorToRgb(accentColor);
    const accentMuted =
      overrides.accentMuted || toRgbaString(parsed, 0.16) || BASE_BRAND.accentMuted;
    const accentContrastText =
      overrides.accentContrastText || getAccentContrast(parsed);
    const focusRing =
      overrides.focusRing || `0 0 0 3px ${toRgbaString(parsed, 0.35) || 'rgba(52, 152, 219, 0.35)'}`;
    const hoverShadow =
      overrides.hoverShadow || `0 12px 30px ${toRgbaString(parsed, 0.22) || 'rgba(52, 152, 219, 0.22)'}`;

    return {
      accentMuted,
      accentContrastText,
      focusRing,
      hoverShadow,
    };
  }

  function nthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
    const firstDay = toLocalDate(year, monthIndex, 1);
    const firstDayOfWeek = firstDay.getDay();
    const offset = (weekday - firstDayOfWeek + 7) % 7;
    const day = 1 + offset + (occurrence - 1) * 7;
    return toLocalDate(year, monthIndex, day);
  }

  function easterSunday(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return toLocalDate(year, month - 1, day);
  }

  function shiftDate(date, days) {
    const shifted = new Date(date.getTime());
    shifted.setDate(shifted.getDate() + days);
    return shifted;
  }

  function instantiateTheme(template, year) {
    const { start, end } = template.getDateRange(year);
    const startDate = toLocalDate(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = toLocalDate(end.getFullYear(), end.getMonth(), end.getDate());
    const rangeLabel = template.metadata?.rangeLabel
      ? template.metadata.rangeLabel
      : formatRange(startDate, endDate);

    return {
      id: template.id,
      name: template.name,
      startDate: toISODateString(startDate),
      endDate: toISODateString(endDate),
      palette: { ...template.palette },
      assets: { ...template.assets },
      metadata: {
        countries: template.metadata?.countries || ['CA', 'US'],
        description: template.metadata?.description || '',
        rangeLabel,
        slug: template.id,
      },
    };
  }

  const THEME_TEMPLATES = [
    {
      id: 'newYears',
      name: 'New Year Glow',
      getDateRange: (year) => {
        const start = toLocalDate(year, 0, 1);
        const end = toLocalDate(year, 0, 5);
        return { start, end };
      },
      palette: {
        accentColor: '#5b8fff',
        accentStrong: '#2d5bff',
        backgroundColor: '#0f1633',
        surfaceColor: '#1a224a',
        textColor: '#e7ecf8',
        headingColor: '#ffffff',
        subtleTextColor: '#a8b4e8',
        borderColor: 'rgba(119, 140, 255, 0.42)',
      },
      assets: {
        icon: '🎆',
        background: 'linear-gradient(135deg, rgba(33, 71, 155, 0.92) 0%, rgba(8, 14, 42, 0.94) 100%)',
        accentGlow: '0 0 32px rgba(91, 143, 255, 0.45)',
      },
      metadata: {
        description: 'City lights, midnight fireworks, and a bold navy palette to ring in the new year.',
      },
    },
    {
      id: 'valentines',
      name: "Valentine's Day",
      getDateRange: (year) => {
        const start = toLocalDate(year, 1, 10);
        const end = toLocalDate(year, 1, 15);
        return { start, end };
      },
      palette: {
        accentColor: '#ff5d8f',
        accentStrong: '#c73a6f',
        backgroundColor: '#fff4f7',
        surfaceColor: '#ffe0ec',
        textColor: '#5c1c3a',
        headingColor: '#8f2453',
        subtleTextColor: '#b85a7b',
        borderColor: 'rgba(199, 58, 111, 0.35)',
      },
      assets: {
        icon: '💘',
        background: 'radial-gradient(circle at top, rgba(255, 93, 143, 0.45), rgba(255, 241, 246, 0.9))',
        accentGlow: '0 0 24px rgba(255, 93, 143, 0.35)',
      },
      metadata: {
        description: 'Playful hearts and punchy berry hues keep February stand-ups feeling warm and personal.',
      },
    },
    {
      id: 'stPatricks',
      name: "St. Patrick's Day",
      getDateRange: (year) => {
        const start = toLocalDate(year, 2, 14);
        const end = toLocalDate(year, 2, 18);
        return { start, end };
      },
      palette: {
        accentColor: '#2ecc71',
        accentStrong: '#1b8f4d',
        backgroundColor: '#062d1b',
        surfaceColor: '#0c3d26',
        textColor: '#d8f5e5',
        headingColor: '#e7ffe3',
        subtleTextColor: '#9edbb7',
        borderColor: 'rgba(46, 204, 113, 0.35)',
      },
      assets: {
        icon: '🍀',
        background: 'linear-gradient(160deg, rgba(12, 61, 38, 0.95) 0%, rgba(9, 44, 27, 0.92) 100%)',
        accentGlow: '0 0 28px rgba(46, 204, 113, 0.32)',
      },
      metadata: {
        description: 'Emerald greens and clover sparkles nod to parades across both Canada and the U.S.',
      },
    },
    {
      id: 'easter',
      name: 'Easter Weekend',
      getDateRange: (year) => {
        const easter = easterSunday(year);
        const start = shiftDate(easter, -2); // Good Friday
        const end = shiftDate(easter, 1); // Easter Monday
        return { start, end };
      },
      palette: {
        accentColor: '#8c6ae6',
        accentStrong: '#6844c9',
        backgroundColor: '#f3edff',
        surfaceColor: '#ffffff',
        textColor: '#433268',
        headingColor: '#5b3fa3',
        subtleTextColor: '#8d7fc1',
        borderColor: 'rgba(140, 106, 230, 0.32)',
      },
      assets: {
        icon: '🐣',
        background: 'linear-gradient(180deg, rgba(243, 237, 255, 0.96) 0%, rgba(230, 223, 255, 0.9) 100%)',
        accentGlow: '0 0 26px rgba(140, 106, 230, 0.28)',
      },
      metadata: {
        description: 'Soft lavender pastels and a playful chick icon capture the energy of spring celebrations.',
      },
    },
    {
      id: 'canadaDay',
      name: 'Canada Day',
      getDateRange: (year) => {
        const start = toLocalDate(year, 6, 1);
        const end = toLocalDate(year, 6, 5);
        return { start, end };
      },
      palette: {
        accentColor: '#ff4d4f',
        accentStrong: '#c62828',
        backgroundColor: '#fff5f5',
        surfaceColor: '#ffffff',
        textColor: '#712024',
        headingColor: '#9e1c24',
        subtleTextColor: '#c26060',
        borderColor: 'rgba(198, 40, 40, 0.35)',
      },
      assets: {
        icon: '🍁',
        background: 'linear-gradient(135deg, rgba(255, 77, 79, 0.12) 0%, rgba(255, 255, 255, 0.95) 65%)',
        accentGlow: '0 0 24px rgba(198, 40, 40, 0.35)',
      },
      metadata: {
        description: 'A confident maple leaf palette for long-weekend retros and coast-to-coast celebrations.',
        countries: ['CA'],
      },
    },
    {
      id: 'independenceDay',
      name: 'Independence Day',
      getDateRange: (year) => {
        const start = toLocalDate(year, 6, 3);
        const end = toLocalDate(year, 6, 6);
        return { start, end };
      },
      palette: {
        accentColor: '#2d6bff',
        accentStrong: '#163d96',
        backgroundColor: '#f0f4ff',
        surfaceColor: '#ffffff',
        textColor: '#10285a',
        headingColor: '#183b88',
        subtleTextColor: '#6176b7',
        borderColor: 'rgba(45, 107, 255, 0.28)',
      },
      assets: {
        icon: '🗽',
        background: 'linear-gradient(160deg, rgba(45, 107, 255, 0.14) 0%, rgba(255, 255, 255, 0.95) 72%)',
        accentGlow: '0 0 24px rgba(45, 107, 255, 0.28)',
      },
      metadata: {
        description: 'Stars, stripes, and a modern navy palette for stateside summer ceremonies.',
        countries: ['US'],
      },
    },
    {
      id: 'labourDay',
      name: 'Labour Day',
      getDateRange: (year) => {
        const start = shiftDate(nthWeekdayOfMonth(year, 8, DAYS.MONDAY, 1), -2);
        const end = nthWeekdayOfMonth(year, 8, DAYS.MONDAY, 1);
        return { start, end };
      },
      palette: {
        accentColor: '#ff9248',
        accentStrong: '#c65c18',
        backgroundColor: '#fff5eb',
        surfaceColor: '#ffffff',
        textColor: '#5b351a',
        headingColor: '#78451f',
        subtleTextColor: '#b67a52',
        borderColor: 'rgba(255, 146, 72, 0.32)',
      },
      assets: {
        icon: '🛠️',
        background: 'linear-gradient(180deg, rgba(255, 229, 208, 0.9) 0%, rgba(255, 245, 235, 0.92) 100%)',
        accentGlow: '0 0 22px rgba(255, 146, 72, 0.28)',
      },
      metadata: {
        description: 'Sunset oranges and workshop neutrals salute crews wrapping up summer projects.',
      },
    },
    {
      id: 'canadianThanksgiving',
      name: 'Canadian Thanksgiving',
      getDateRange: (year) => {
        const holiday = nthWeekdayOfMonth(year, 9, DAYS.MONDAY, 2);
        const start = shiftDate(holiday, -3);
        const end = shiftDate(holiday, 1);
        return { start, end };
      },
      palette: {
        accentColor: '#f08c2b',
        accentStrong: '#b26016',
        backgroundColor: '#fff5e8',
        surfaceColor: '#ffffff',
        textColor: '#583616',
        headingColor: '#7c4618',
        subtleTextColor: '#a76f49',
        borderColor: 'rgba(240, 140, 43, 0.32)',
      },
      assets: {
        icon: '🥧',
        background: 'radial-gradient(circle at 20% 20%, rgba(240, 140, 43, 0.16), transparent 55%)',
        accentGlow: '0 0 26px rgba(240, 140, 43, 0.28)',
      },
      metadata: {
        description: 'Warm harvest tones for long-weekend gratitude sessions north of the border.',
        countries: ['CA'],
      },
    },
    {
      id: 'halloween',
      name: 'Halloween',
      getDateRange: (year) => {
        const start = toLocalDate(year, 9, 24);
        const end = toLocalDate(year, 9, 31);
        return { start, end };
      },
      palette: {
        accentColor: '#ff7a1a',
        accentStrong: '#c34d05',
        backgroundColor: '#0b0d16',
        surfaceColor: '#161824',
        textColor: '#f7f1e8',
        headingColor: '#ffe2c4',
        subtleTextColor: '#d0b89c',
        borderColor: 'rgba(255, 122, 26, 0.38)',
      },
      assets: {
        icon: '🎃',
        background: 'linear-gradient(200deg, rgba(13, 15, 28, 0.96) 0%, rgba(28, 18, 32, 0.92) 100%)',
        accentGlow: '0 0 30px rgba(255, 122, 26, 0.35)',
      },
      metadata: {
        description: 'Moody indigos and pumpkin oranges with just enough mischief for spooky stand-ups.',
      },
    },
    {
      id: 'usThanksgiving',
      name: 'U.S. Thanksgiving',
      getDateRange: (year) => {
        const holiday = nthWeekdayOfMonth(year, 10, DAYS.THURSDAY, 4);
        const start = shiftDate(holiday, -1);
        const end = shiftDate(holiday, 3);
        return { start, end };
      },
      palette: {
        accentColor: '#d97828',
        accentStrong: '#9b4f15',
        backgroundColor: '#fbeee0',
        surfaceColor: '#fff8f0',
        textColor: '#4e2f16',
        headingColor: '#744421',
        subtleTextColor: '#a2704b',
        borderColor: 'rgba(217, 120, 40, 0.32)',
      },
      assets: {
        icon: '🦃',
        background: 'radial-gradient(circle at 80% 20%, rgba(217, 120, 40, 0.18), transparent 55%)',
        accentGlow: '0 0 24px rgba(217, 120, 40, 0.28)',
      },
      metadata: {
        description: 'Golden spice notes inspired by Thanksgiving tables across the United States.',
        countries: ['US'],
      },
    },
    {
      id: 'christmas',
      name: 'Christmas & Festive Break',
      getDateRange: (year) => {
        const start = toLocalDate(year, 11, 1);
        const end = toLocalDate(year + 1, 0, 5);
        return { start, end };
      },
      palette: {
        accentColor: '#e74c3c',
        accentStrong: '#a93226',
        backgroundColor: '#0a1c1b',
        surfaceColor: '#112b2b',
        textColor: '#f3f9f7',
        headingColor: '#ffffff',
        subtleTextColor: '#c2d7d1',
        borderColor: 'rgba(231, 76, 60, 0.35)',
      },
      assets: {
        icon: '🎄',
        background: 'linear-gradient(160deg, rgba(10, 28, 27, 0.96) 0%, rgba(16, 45, 36, 0.92) 100%)',
        accentGlow: '0 0 32px rgba(231, 76, 60, 0.28)',
      },
      metadata: {
        description: 'Evergreen gradients, twinkle lights, and a festive mark for year-end celebrations.',
      },
    },
  ];

  function buildHolidayThemes(now = new Date()) {
    const year = now.getFullYear();
    const themes = {};
    THEME_TEMPLATES.forEach((template) => {
      themes[template.id] = instantiateTheme(template, year);
    });
    return themes;
  }

  function upgradeBrandConfig(rawConfig = {}, now = new Date()) {
    const defaults = { ...BASE_BRAND, themeMode: 'auto', activeThemeId: null, holidayThemes: buildHolidayThemes(now), themeSchemaVersion: THEME_SCHEMA_VERSION };
    const merged = { ...defaults, ...rawConfig };
    merged.themeMode = rawConfig?.themeMode === 'manual' ? 'manual' : 'auto';
    merged.activeThemeId = rawConfig?.activeThemeId || null;
    merged.holidayThemes = defaults.holidayThemes;
    merged.themeSchemaVersion = THEME_SCHEMA_VERSION;
    if (typeof merged.activeThemeId === 'string' && !merged.activeThemeId.trim()) {
      merged.activeThemeId = null;
    }
    return merged;
  }

  function parseDateFromISO(iso, fallbackYear) {
    if (!iso || typeof iso !== 'string') return null;
    const [yearStr, monthStr, dayStr] = iso.split('-');
    const year = Number(yearStr) || fallbackYear;
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);
    if (Number.isNaN(month) || Number.isNaN(day)) {
      return null;
    }
    return new Date(year, month, day, 12, 0, 0);
  }

  function isWithinRange(date, start, end) {
    if (!start || !end) return false;
    const startTime = start.getTime();
    const endTime = end.getTime();
    if (startTime <= endTime) {
      return date >= start && date <= end;
    }
    // Handles ranges that cross calendar years.
    return date >= start || date <= end;
  }

  function resolveActiveTheme(config = {}, now = new Date()) {
    const themes = config.holidayThemes || {};
    if (!themes || typeof themes !== 'object') {
      return null;
    }

    const manualId = config.activeThemeId;
    const themeEntries = Object.values(themes);

    if (config.themeMode === 'manual') {
      if (!manualId) {
        return null;
      }
      return themeEntries.find((theme) => theme.id === manualId) || null;
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    for (let index = 0; index < themeEntries.length; index += 1) {
      const theme = themeEntries[index];
      const start = parseDateFromISO(theme.startDate, today.getFullYear());
      const end = parseDateFromISO(theme.endDate, today.getFullYear());
      if (isWithinRange(today, start, end)) {
        return theme;
      }
    }
    return null;
  }

  function composeBrandStyles(rawConfig = {}, now = new Date()) {
    const upgraded = upgradeBrandConfig(rawConfig, now);
    const activeTheme = resolveActiveTheme(upgraded, now);
    const palette = activeTheme?.palette || {};
    const assets = activeTheme?.assets || {};

    const themedStyles = {
      ...upgraded,
      ...palette,
      themeIcon: assets.icon || '',
      themeBackground: assets.background || 'none',
      themeAccentGlow: assets.accentGlow || 'none',
    };

    const accentTokens = computeAccentTokens(themedStyles.accentColor || BASE_BRAND.accentColor, {
      accentMuted: themedStyles.accentMuted,
      accentContrastText: themedStyles.accentContrastText,
      focusRing: themedStyles.focusRing,
      hoverShadow: themedStyles.hoverShadow,
    });

    const stylesWithDerived = {
      ...themedStyles,
      ...accentTokens,
    };

    return {
      config: upgraded,
      styles: stylesWithDerived,
      activeTheme,
    };
  }

  function createDefaultBrandConfig(now = new Date()) {
    return upgradeBrandConfig({}, now);
  }

  window.BrandThemeEngine = {
    themeSchemaVersion: THEME_SCHEMA_VERSION,
    buildHolidayThemes,
    createDefaultBrandConfig,
    upgradeBrandConfig,
    resolveActiveTheme,
    composeBrandStyles,
    baseBrandTokens: { ...BASE_BRAND },
  };
})();
