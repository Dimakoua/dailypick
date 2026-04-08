/**
 * Planning Poker - Local Brand Studio Configuration
 * 
 * Allows customizing deck and card visual properties specific to Planning Poker.
 * Include this script BEFORE local-brand-studio.js loads.
 */

(() => {
  window.LocalBrandStudioConfig = {
    customizableProperties: {
      // Global brand properties
      accentColor: {
        label: 'Primary Color',
        type: 'color',
        description: 'Main accent color for buttons and interactive elements',
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

      // Planning Poker specific properties
      cardBackgroundColor: {
        label: 'Card Background',
        type: 'color',
        description: 'Background color for Fibonacci estimate cards',
        default: 'inherited',
      },
      cardTextColor: {
        label: 'Card Text',
        type: 'color',
        description: 'Text color for card numbers',
        default: 'inherited',
      },
      cardBorderColor: {
        label: 'Card Borders',
        type: 'color',
        description: 'Border color for estimate cards',
        default: 'inherited',
      },
      deckTableColor: {
        label: 'Table Color',
        type: 'color',
        description: 'Background color of the poker table area',
        default: 'inherited',
      },
      participantAvatarColor: {
        label: 'Avatar Color',
        type: 'color',
        description: 'Background color for participant avatars',
        default: 'inherited',
      },
    },
    cssVarMap: {
      cardBackgroundColor: '--poker-card-bg',
      cardTextColor: '--poker-card-text',
      cardBorderColor: '--poker-card-border',
      deckTableColor: '--poker-table-bg',
      participantAvatarColor: '--poker-avatar-bg',
    },
  };
})();

/**
 * CSS Integration Guide:
 * 
 * In apps/planning-poker/style.css, create CSS custom properties that map to these:
 * 
 * :root {
 *   --poker-card-bg: var(--brand-surface);
 *   --poker-card-text: var(--brand-text);
 *   --poker-card-border: var(--brand-border);
 *   --poker-table-bg: var(--brand-background);
 *   --poker-avatar-bg: var(--brand-accent);
 * }
 * 
 * Then use these variables in your styles:
 * .poker-card {
 *   background-color: var(--poker-card-bg);
 *   color: var(--poker-card-text);
 *   border-color: var(--poker-card-border);
 * }
 * 
 * Users can then customize these colors via the Local Brand Studio panel! 🎨
 */
