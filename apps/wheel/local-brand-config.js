/**
 * Wheel - Local Brand Studio Configuration
 * 
 * Allows customizing wheel colors and segments specific to the Wheel game.
 * Include this script BEFORE local-brand-studio.js loads.
 */

(() => {
  window.LocalBrandStudioConfig = {
    customizableProperties: {
      // Global brand properties
      accentColor: {
        label: 'Primary Color',
        type: 'color',
        description: 'Main accent color for buttons and spinner',
        default: 'inherited',
      },
      accentStrong: {
        label: 'Strong Accent',
        type: 'color',
        description: 'Darker variant for emphasis and borders',
        default: 'inherited',
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'color',
        description: 'Page background color',
        default: 'inherited',
      },
      textColor: {
        label: 'Text Color',
        type: 'color',
        description: 'Default text color',
        default: 'inherited',
      },

      // Wheel specific properties
      wheelSegmentColor1: {
        label: 'Wheel Segment 1',
        type: 'color',
        description: 'First segment color on the spinner',
        default: 'inherited',
      },
      wheelSegmentColor2: {
        label: 'Wheel Segment 2',
        type: 'color',
        description: 'Second segment color on the spinner',
        default: 'inherited',
      },
      wheelSegmentColor3: {
        label: 'Wheel Segment 3',
        type: 'color',
        description: 'Third segment color on the spinner',
        default: 'inherited',
      },
      wheelSegmentColor4: {
        label: 'Wheel Segment 4',
        type: 'color',
        description: 'Fourth segment color on the spinner',
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
        description: 'Background color for the spin button',
        default: 'inherited',
      },
      resultTextColor: {
        label: 'Result Text',
        type: 'color',
        description: 'Color for the result/winner display',
        default: 'inherited',
      },
    },
    cssVarMap: {
      wheelSegmentColor1: '--wheel-segment-1',
      wheelSegmentColor2: '--wheel-segment-2',
      wheelSegmentColor3: '--wheel-segment-3',
      wheelSegmentColor4: '--wheel-segment-4',
      wheelBorderColor: '--wheel-border',
      spinButtonColor: '--wheel-spin-btn',
      resultTextColor: '--wheel-result-text',
    },
  };
})();

/**
 * CSS Integration Guide:
 * 
 * In apps/wheel/style.css (or wherever wheel colors are defined), use CSS variables:
 * 
 * :root {
 *   --wheel-segment-1: #ff6b6b;
 *   --wheel-segment-2: #4ecdc4;
 *   --wheel-segment-3: #45b7d1;
 *   --wheel-segment-4: #ffa502;
 *   --wheel-border: var(--brand-border);
 *   --wheel-spin-btn: var(--brand-accent);
 *   --wheel-result-text: var(--brand-heading);
 * }
 * 
 * Then in your wheel canvas drawing or SVG:
 * - Use getComputedStyle(document.documentElement).getPropertyValue('--wheel-segment-1')
 * - Or apply these as CSS to SVG/canvas-related elements
 * 
 * Users can now customize wheel colors with the Local Brand Studio! 🎡
 */
