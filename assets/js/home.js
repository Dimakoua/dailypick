/**
 * Daily Pick — Home interactions (ESM)
 * - Exported pure functions allow unit testing without DOM.
 */

/**
 * Returns a random integer in [0, maxExclusive) using the provided RNG.
 * @param {number} maxExclusive - Upper bound (non-inclusive).
 * @param {() => number} [rng=Math.random] - RNG returning [0,1).
 * @returns {number}
 */
export function getRandomIndex(maxExclusive, rng = Math.random) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer');
  }
  const r = rng();
  if (typeof r !== 'number' || r < 0 || r >= 1) {
    throw new Error('rng() must return a number in [0, 1)');
  }
  return Math.floor(r * maxExclusive);
}

/**
 * Given a NodeList/Array of anchor elements, returns one at a random index.
 * @param {ArrayLike<HTMLAnchorElement>} links
 * @param {() => number} [rng=Math.random]
 * @returns {HTMLAnchorElement}
 */
export function pickRandomLink(links, rng = Math.random) {
  const len = (links && typeof links.length === 'number') ? links.length : 0;
  if (len === 0) throw new Error('No links provided');
  const idx = getRandomIndex(len, rng);
  return links[idx];
}

/**
 * Returns true if the browser supports CSS backdrop-filter (or webkit prefixed).
 * @param {{CSS?: {supports?: Function}}} [env=window]
 * @returns {boolean}
 */
export function hasBackdropSupport(env = window) {
  try {
    const css = env.CSS;
    if (!css || typeof css.supports !== 'function') return false;
    return css.supports('backdrop-filter', 'blur(1px)') ||
           css.supports('-webkit-backdrop-filter', 'blur(1px)');
  } catch {
    return false;
  }
}

/**
 * Adds support class to <html> depending on backdrop-filter availability.
 */
function applyBackdropClass() {
  if (hasBackdropSupport()) {
    document.documentElement.classList.add('has-backdrop');
  } else {
    document.documentElement.classList.add('no-backdrop');
  }
}

/**
 * Wires up the "Pick a Random Game!" button.
 * - Navigates to a randomly selected game.
 * - Announces selection for screen readers.
 */
function initRandomGameButton() {
  const btn = document.getElementById('randomGameBtn');
  const announceEl = document.getElementById('announce');
  let links = document.querySelectorAll('.game-grid .game-card[data-category="standup"]');

  // Fallback to any game card if no standup ones are found (e.g. on the home page)
  if (links.length === 0) {
    links = document.querySelectorAll('.game-grid .game-card');
  }

  if (!btn || links.length === 0) return;

  const dieIcon = btn.querySelector('.die-icon');

  btn.addEventListener('click', () => {
    try {
      if (dieIcon) {
        dieIcon.classList.add('is-spinning');
      }
      
      // Trigger theme-specific pixel art effect (skip default/disabled themes)
      const activeTheme = document.documentElement.getAttribute('data-brand-theme');
      if (activeTheme && activeTheme !== 'default' && activeTheme !== 'disabled') {
        triggerPixelEffect(activeTheme, btn);
      }

      document.body.classList.add('is-navigating');

      const link = pickRandomLink(links);
      const name = link.dataset.game || link.querySelector('.game-card__title')?.textContent || 'game';
      if (announceEl) {
        announceEl.textContent = `Opening ${name}.`;
      }
      // Defer to let the animation play and the live region announce
      setTimeout(() => {
        window.location.href = link.href;
      }, 1200); // Increased to allow pixel effect to be seen
    } catch (err) {
      if (announceEl) {
        announceEl.textContent = 'Unable to pick a game right now.';
      }
    }
  });
}

/**
 * Creates a pixel-art explosion effect based on the current theme.
 * @param {string} theme - The ID of the active theme (e.g., 'stPatricks')
 * @param {HTMLElement} origin - The element to explode from
 */
function triggerPixelEffect(theme, origin) {
  // For this effect we create a short-lived rain of themed pixel bits.
  // It can be re-triggered each click and is safe to run multiple times.

  const rainContainer = document.createElement('div');
  rainContainer.className = `pixel-rain theme-${theme}`;
  rainContainer.style.position = 'fixed';
  rainContainer.style.inset = '0';
  rainContainer.style.pointerEvents = 'none';
  rainContainer.style.zIndex = '9999';

  const computed = getComputedStyle(document.documentElement);
  const rawIcon = computed.getPropertyValue('--brand-theme-icon').trim();
  const themeIcon = rawIcon.replace(/^['"]|['"]$/g, ''); // strip quotes if present

  const pixelCount = 40;
  for (let i = 0; i < pixelCount; i++) {
    const pixel = document.createElement('div');
    pixel.className = 'rain-bit';

    // Pass the theme icon per pixel (CSS uses attr to render it)
    if (themeIcon) {
      pixel.dataset.themeIcon = themeIcon;
    }

    // Random x position within viewport
    const x = Math.random() * 100;
    pixel.style.left = `${x}vw`;

    // Random delay so not all fall together
    const delay = Math.random() * 0.6;
    pixel.style.animationDelay = `${delay}s`;

    // Random size for variation
    const size = 10 + Math.random() * 8;
    pixel.style.width = `${size}px`;
    pixel.style.height = `${size}px`;

    rainContainer.appendChild(pixel);
  }

  document.body.appendChild(rainContainer);

  // Cleanup after animation completes
  setTimeout(() => {
    rainContainer.remove();
  }, 2200); // allow full duration + delay
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  applyBackdropClass();
  initRandomGameButton();
});

/**
 * Reset page transition state when navigating back.
 * This ensures the content is visible if the page is restored from bfcache.
 */
window.addEventListener('pageshow', (event) => {
  // event.persisted is true if the page is from the back/forward cache.
  document.body.classList.remove('is-navigating');

  // Also reset the die animation so it can spin again.
  const dieIcon = document.querySelector('#randomGameBtn .die-icon');
  if (dieIcon) {
    dieIcon.classList.remove('is-spinning');
  }
});
