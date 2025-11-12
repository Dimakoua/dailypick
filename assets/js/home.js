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
  const links = document.querySelectorAll('.game-grid .game-card[data-category="standup"]');

  if (!btn || links.length === 0) return;

  const dieIcon = btn.querySelector('.die-icon');

  btn.addEventListener('click', () => {
    try {
      if (dieIcon) {
        dieIcon.classList.add('is-spinning');
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
      }, 400); // 600ms matches the CSS animation duration
    } catch (err) {
      if (announceEl) {
        announceEl.textContent = 'Unable to pick a game right now.';
      }
    }
  });
}

/**
 * Adds a fade-out animation to all game cards before navigating.
 */
function initPageTransitions() {
  const gameCards = document.querySelectorAll('.game-card');
  if (gameCards.length === 0) return;

  gameCards.forEach(card => {
    card.addEventListener('click', (event) => {
      // Only run for primary clicks, allowing middle-click/ctrl-click to open in new tabs.
      if (event.button !== 0 || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      const destination = card.href;

      document.body.classList.add('is-navigating');

      setTimeout(() => {
        window.location.href = destination;
      }, 600); // Matches the fade-out animation duration
    });
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  applyBackdropClass();
  initRandomGameButton();
  initPageTransitions();
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
