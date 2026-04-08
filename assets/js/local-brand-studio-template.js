/**
 * Game Local Brand Studio Configuration Template
 * 
 * Place this file in your game directory and include it BEFORE the CSS/JS that loads local-brand-studio.js
 * 
 * Usage:
 * 1. Copy this template to your game folder
 * 2. Update the customizableProperties object with your game-specific properties
 * 3. Reference it in the game's index.html via <script> tag
 * 
 * Example for planning-poker:
 * - In _includes/base_app.njk, add:
 *   <script>if (page.url.includes('/planning-poker/')) {
 *     document.write('<script src="./local-brand-config.js"><\/script>');
 *   }</script>
 * 
 * OR: Include in the game's index.html YAML frontmatter if it's specific to that game
 */

(() => {
  /**
   * Define customizable properties for this specific game
   * 
   * Property structure:
   * {
   *   propertyKey: {
   *     label: 'UI Label',
   *     type: 'color' | 'text',
   *     description: 'Help text shown below the control',
   *     default: 'inherited' (to use global brand value)
   *   }
   * }
   */

  // Global defaults (inherited from local-brand-studio.js)
  const GLOBAL_DEFAULTS = {
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

  // GAME-SPECIFIC CUSTOMIZATIONS
  // Example for Planning Poker: customize card deck colors
  const GAME_SPECIFIC_PROPERTIES = {
    // Example: Custom deck background color
    deckBackgroundColor: {
      label: 'Deck Background',
      type: 'color',
      description: 'Background color for card deck area',
      default: 'inherited',
    },
    // Example: Custom card border color
    cardBorderColor: {
      label: 'Card Borders',
      type: 'color',
      description: 'Color for planning poker card borders',
      default: 'inherited',
    },
  };

  // Combine defaults with game-specific customizations
  window.LocalBrandStudioConfig = {
    customizableProperties: {
      ...GLOBAL_DEFAULTS,
      ...GAME_SPECIFIC_PROPERTIES,
    },
  };
})();

/**
 * To apply game-specific CSS variable mappings:
 * 
 * In your game's style.css:
 * :root {
 *   --deck-background: var(--brand-surface, #fff);
 *   --card-border: var(--brand-border, #ddd);
 * }
 * 
 * Or if using custom CSS variables:
 * .deck {
 *   background-color: var(--deck-background, var(--brand-surface));
 *   border-color: var(--card-border, var(--brand-border));
 * }
 * 
 * Then in local-brand-studio.js, extend the cssVarMap with:
 * cssVarMap: {
 *   ...existing mappings,
 *   deckBackgroundColor: '--deck-background',
 *   cardBorderColor: '--card-border',
 * }
 */
