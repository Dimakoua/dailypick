/**
 * Choices Spinner - Local Brand Studio Configuration
 *
 * Allows customizing wheel segment colors for the Choices Spinner.
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

      // Wheel segment colors
      wheelSegmentColor1: {
        label: 'Wheel Segment 1',
        type: 'color',
        description: 'First segment color in the palette',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Segment 2',
        type: 'color',
        description: 'Second segment color in the palette',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Segment 3',
        type: 'color',
        description: 'Third segment color in the palette',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Segment 4',
        type: 'color',
        description: 'Fourth segment color in the palette',
        default: 'inherited',
      },
      wheelBorderColor: {
        label: 'Segment Border',
        type: 'color',
        description: 'Border color between wheel segments',
        default: 'inherited',
      },
    },
    cssVarMap: {
      wheelSegmentColor1: '--wheel-segment-1',
      wheelSegmentColor2: '--wheel-segment-2',
      wheelSegmentColor3: '--wheel-segment-3',
      wheelSegmentColor4: '--wheel-segment-4',
      wheelBorderColor: '--wheel-border',
    },
  };
})();
