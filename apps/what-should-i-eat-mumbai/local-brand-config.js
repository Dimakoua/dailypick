/**
 * Mumbai Food Wheel - Local Brand Studio Configuration
 *
 * Allows customizing wheel segment colors and UI colors specific to the
 * Mumbai Food Wheel. Include this script BEFORE local-brand-studio.js loads.
 */

(() => {
  window.LocalBrandStudioConfig = {
    customizableProperties: {
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
      wheelSegmentColor1: {
        label: 'Wheel Segment 1',
        type: 'color',
        description: 'First segment color (spice orange)',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Segment 2',
        type: 'color',
        description: 'Second segment color (pepper red)',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Segment 3',
        type: 'color',
        description: 'Third segment color (mumbai sea blue)',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Segment 4',
        type: 'color',
        description: 'Fourth segment color (golden sand)',
        default: 'inherited',
      },
      wheelSegmentColor5: {
        label: 'Wheel Segment 5',
        type: 'color',
        description: 'Fifth segment color (saffron yellow)',
        default: 'inherited',
      },
      wheelSegmentColor6: {
        label: 'Wheel Segment 6',
        type: 'color',
        description: 'Sixth segment color (night blue)',
        default: 'inherited',
      },
      wheelSegmentColor7: {
        label: 'Wheel Segment 7',
        type: 'color',
        description: 'Seventh segment color (cream)',
        default: 'inherited',
      },
      wheelSegmentColor8: {
        label: 'Wheel Segment 8',
        type: 'color',
        description: 'Eighth segment color (claustrophobic copper)',
        default: 'inherited',
      },
      resultTextColor: {
        label: 'Result Text',
        type: 'color',
        description: 'Color for the winner dish display',
        default: 'inherited',
      },
    },
    cssVarMap: {
      wheelSegmentColor1: '--wheel-segment-1',
      wheelSegmentColor2: '--wheel-segment-2',
      wheelSegmentColor3: '--wheel-segment-3',
      wheelSegmentColor4: '--wheel-segment-4',
      wheelSegmentColor5: '--wheel-segment-5',
      wheelSegmentColor6: '--wheel-segment-6',
      wheelSegmentColor7: '--wheel-segment-7',
      wheelSegmentColor8: '--wheel-segment-8',
      resultTextColor: '--wheel-result-text',
    },
  };
})();
