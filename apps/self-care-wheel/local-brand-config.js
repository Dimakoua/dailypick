/**
 * Self-Care Wheel - Local Brand Studio Configuration
 *
 * Allows customizing wheel segment colors and UI colors specific to the
 * Self-Care Wheel. Include this script BEFORE local-brand-studio.js loads.
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
        description: 'First segment color (soft mint)',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Segment 2',
        type: 'color',
        description: 'Second segment color (warm cream)',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Segment 3',
        type: 'color',
        description: 'Third segment color (lavender haze)',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Segment 4',
        type: 'color',
        description: 'Fourth segment color (blush pink)',
        default: 'inherited',
      },
      wheelSegmentColor5: {
        label: 'Wheel Segment 5',
        type: 'color',
        description: 'Fifth segment color (sky blue)',
        default: 'inherited',
      },
      wheelSegmentColor6: {
        label: 'Wheel Segment 6',
        type: 'color',
        description: 'Sixth segment color (sage green)',
        default: 'inherited',
      },
      wheelSegmentColor7: {
        label: 'Wheel Segment 7',
        type: 'color',
        description: 'Seventh segment color (soft gold)',
        default: 'inherited',
      },
      wheelSegmentColor8: {
        label: 'Wheel Segment 8',
        type: 'color',
        description: 'Eighth segment color (pale blue)',
        default: 'inherited',
      },
      resultTextColor: {
        label: 'Result Text',
        type: 'color',
        description: 'Color for the winner display',
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
      resultTextColor: '--self-care-accent',
    },
  };
})();
