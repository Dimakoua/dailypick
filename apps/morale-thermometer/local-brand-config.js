/**
 * Team Morale Thermometer - Local Brand Studio Configuration
 *
 * Allows customizing thermometer and UI colors.
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
        description: 'Page background color',
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

      // Thermometer-specific
      mercuryColor: {
        label: 'Mercury Color',
        type: 'color',
        description: 'Color of the rising mercury in the thermometer',
        default: 'inherited',
      },
      thermometerStemColor: {
        label: 'Thermometer Stem',
        type: 'color',
        description: 'Background color of the thermometer tube',
        default: 'inherited',
      },
    },
    cssVarMap: {
      mercuryColor: '--mercury-color',
      thermometerStemColor: '--thermometer-stem-bg',
    },
  };
})();
