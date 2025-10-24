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
  const links = document.querySelectorAll('.game-grid .game-card');

  if (!btn || links.length === 0) return;

  btn.addEventListener('click', () => {
    try {
      const link = pickRandomLink(links);
      const name = link.dataset.game || link.querySelector('.game-card__title')?.textContent || 'game';
      if (announceEl) {
        announceEl.textContent = `Opening ${name}.`;
      }
      // Defer slightly to let the live region announce
      setTimeout(() => {
        window.location.href = link.href;
      }, 50);
    } catch (err) {
      if (announceEl) {
        announceEl.textContent = 'Unable to pick a game right now.';
      }
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  applyBackdropClass();
  initRandomGameButton();
});
