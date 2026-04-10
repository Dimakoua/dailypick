/**
 * Yes or No Wheel - Local Brand Studio Configuration
 *
 * Allows customizing yes/no/maybe slice colors specific to this wheel.
 * Include this script BEFORE local-brand-studio.js loads.
 */

(() => {
  window.LocalBrandStudioConfig = {
    customizableProperties: {
      // Global brand properties
      accentColor: {
        label: 'Primary Color',
        type: 'color',
        description: 'Main accent color for buttons',
        default: 'inherited',
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'color',
        description: 'Page background color',
        default: 'inherited',
      },

      // Yes/No/Maybe wheel colors
      yesColor: {
        label: 'YES Color',
        type: 'color',
        description: 'Color of the YES slices on the wheel',
        default: 'inherited',
      },
      noColor: {
        label: 'NO Color',
        type: 'color',
        description: 'Color of the NO slices on the wheel',
        default: 'inherited',
      },
      maybeColor: {
        label: 'MAYBE Color',
        type: 'color',
        description: 'Color of the MAYBE slices (three-option mode)',
        default: 'inherited',
      },
    },
    cssVarMap: {
      yesColor: '--yes-color',
      noColor: '--no-color',
      maybeColor: '--maybe-color',
    },
  };
})();
