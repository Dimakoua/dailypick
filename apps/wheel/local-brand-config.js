/**
 * Shared Wheel - Local Brand Studio Configuration
 *
 * Used by all wheel-based apps to customize wheel and result UI behavior.
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
      accentStrong: {
        label: 'Strong Accent',
        type: 'color',
        description: 'Darker accent for emphasis and borders',
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
        description: 'Card and panel background color',
        default: 'inherited',
      },
      textColor: {
        label: 'Text Color',
        type: 'color',
        description: 'Default page text color',
        default: 'inherited',
      },

      // Wheel segment properties
      wheelSegmentColor1: {
        label: 'Wheel Segment 1',
        type: 'color',
        description: 'First segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Segment 2',
        type: 'color',
        description: 'Second segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Segment 3',
        type: 'color',
        description: 'Third segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Segment 4',
        type: 'color',
        description: 'Fourth segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor5: {
        label: 'Wheel Segment 5',
        type: 'color',
        description: 'Fifth segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor6: {
        label: 'Wheel Segment 6',
        type: 'color',
        description: 'Sixth segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor7: {
        label: 'Wheel Segment 7',
        type: 'color',
        description: 'Seventh segment color on the wheel',
        default: 'inherited',
      },
      wheelSegmentColor8: {
        label: 'Wheel Segment 8',
        type: 'color',
        description: 'Eighth segment color on the wheel',
        default: 'inherited',
      },
      wheelBorderColor: {
        label: 'Wheel Border',
        type: 'color',
        description: 'Border color around wheel segments',
        default: 'inherited',
      },
      spinButtonColor: {
        label: 'Spin Button',
        type: 'color',
        description: 'Color used on the spin button',
        default: 'inherited',
      },
      resultTextColor: {
        label: 'Result Text',
        type: 'color',
        description: 'Color for the winner/result display',
        default: 'inherited',
      },

      // Wheel behavior properties
      spinSpeed: {
        label: 'Spin Speed',
        type: 'number',
        description: 'How fast the wheel animation runs',
        default: 1,
        min: 0.25,
        max: 5,
        step: 0.25,
      },
      spinRounds: {
        label: 'Spin Rounds',
        type: 'number',
        description: 'How many full revolutions the wheel makes before landing',
        default: 5,
        min: 1,
        max: 12,
        step: 1,
      },
      showPopupResult: {
        label: 'Result Popup',
        type: 'boolean',
        description: 'Show the winning result in a popup after spinning',
        default: false,
      },
      enableConfetti: {
        label: 'Enable Confetti',
        type: 'boolean',
        description: 'Display confetti when the wheel stops',
        default: false,
      },
    },
    cssVarMap: {
      accentColor: '--brand-accent',
      accentStrong: '--brand-accent-strong',
      backgroundColor: '--brand-background',
      surfaceColor: '--brand-surface',
      textColor: '--brand-text',
      wheelSegmentColor1: '--wheel-segment-1',
      wheelSegmentColor2: '--wheel-segment-2',
      wheelSegmentColor3: '--wheel-segment-3',
      wheelSegmentColor4: '--wheel-segment-4',
      wheelSegmentColor5: '--wheel-segment-5',
      wheelSegmentColor6: '--wheel-segment-6',
      wheelSegmentColor7: '--wheel-segment-7',
      wheelSegmentColor8: '--wheel-segment-8',
      wheelBorderColor: '--wheel-border',
      spinButtonColor: '--wheel-spin-btn',
      resultTextColor: '--wheel-result-text',
    },
  };
})();
