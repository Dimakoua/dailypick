/**
 * Stream Wheel - Local Brand Studio Configuration
 */
(() => {
  window.LocalBrandStudioConfig = {
    customizableProperties: {
      accentColor: {
        label: 'Accent Color',
        type: 'color',
        description: 'Primary color for buttons and active states',
        default: 'inherited',
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'color',
        description: 'Page background color',
        default: 'inherited',
      },
      wheelSegmentColor1: {
        label: 'Wheel Color 1',
        type: 'color',
        description: 'First segment color in the palette',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Color 2',
        type: 'color',
        description: 'Second segment color',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Color 3',
        type: 'color',
        description: 'Third segment color',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Color 4',
        type: 'color',
        description: 'Fourth segment color',
        default: 'inherited',
      },
      wheelSegmentColor5: {
        label: 'Wheel Color 5',
        type: 'color',
        description: 'Fifth segment color',
        default: 'inherited',
      },
      wheelSegmentColor6: {
        label: 'Wheel Color 6',
        type: 'color',
        description: 'Sixth segment color',
        default: 'inherited',
      },
      wheelSegmentColor7: {
        label: 'Wheel Color 7',
        type: 'color',
        description: 'Seventh segment color',
        default: 'inherited',
      },
      wheelSegmentColor8: {
        label: 'Wheel Color 8',
        type: 'color',
        description: 'Eighth segment color',
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
      wheelSegmentColor5: '--wheel-segment-5',
      wheelSegmentColor6: '--wheel-segment-6',
      wheelSegmentColor7: '--wheel-segment-7',
      wheelSegmentColor8: '--wheel-segment-8',
      wheelBorderColor: '--wheel-border',
    },
  };
})();
