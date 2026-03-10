(function() {
  'use strict';

  const STORAGE_KEY = 'standupWalkthroughSeen';
  const STEPS = [
    {
      title: 'Welcome to Stand-up Dock! 🧭',
      description: 'The dock keeps your team queue, tasks, and notes together across all games.',
      target: '.standup-dock-toggle',
      position: 'right'
    },
    {
      title: 'The Panel',
      description: 'The panel displays the current speaker, who is next, and any assigned work from Jira or Trello.',
      target: '.standup-dock-toggle',
      position: 'right',
      onBefore: (panel) => {
        // Ensure panel is open for this step
        if (panel && panel.closest('.standup-dock').dataset.open !== 'true') {
           const toggle = panel.closest('.standup-dock').querySelector('.standup-dock-toggle');
           if (toggle) toggle.click();
        }
      }
    },
    {
      title: 'Speaker Queue',
      description: 'Track who is talking and who is up next. Winners of games automatically move to the top!',
      target: '.standup-section--queue',
      position: 'left'
    },
    {
      title: 'Connect Your Tools 🔗',
      description: 'To see your tasks here, connect to **Jira**, **GitHub**, or **Trello** via the <a href="/apps/settings/" target="_blank">Settings</a>. Once connected, your assigned work filters in automatically!',
      target: '.standup-panel__services',
      position: 'left'
    },
    {
      title: 'Assigned Work',
      description: 'See the tasks from Jira or Trello assigned to the current speaker. You can also capture quick notes here.',
      target: '.standup-section--assignments',
      position: 'left'
    },
    {
      title: 'Customize Your View',
      description: 'Drag the panel to reposition it, or drag the edges to resize it. It remembers your preferences!',
      target: '.standup-panel__header',
      position: 'left'
    }
  ];

  class StandupOnboarding {
    constructor() {
      this.currentStep = 0;
      this.tooltip = null;
      this.overlay = null;

      window.addEventListener('standup:start-walkthrough', () => this.start());
      
      // Auto-start for new users after a short delay
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTimeout(() => {
          // Only auto-start if the dock is actually in the DOM
          if (document.querySelector('.standup-dock')) {
            this.start();
          }
        }, 2000);
      }
    }

    start() {
      if (this.tooltip) this.remove();
      this.currentStep = 0;
      this.createOverlay();
      this.showStep(0);
    }

    createOverlay() {
      this.overlay = document.createElement('div');
      this.overlay.className = 'standup-walkthrough-overlay';
      document.body.appendChild(this.overlay);
    }

    showStep(index) {
      this.removeTooltip();
      if (index >= STEPS.length) {
        this.complete();
        return;
      }

      this.currentStep = index;
      const step = STEPS[index];
      const target = document.querySelector(step.target);

      if (!target) {
        console.warn(`Target ${step.target} not found for walkthrough step ${index}`);
        this.showNext();
        return;
      }

      if (step.onBefore) step.onBefore(target);

      // Wait a frame for any visibility/layout changes from onBefore to settle
      requestAnimationFrame(() => {
        this.createTooltip(step, target);
      });
    }

    createTooltip(step, target) {
      const rect = target.getBoundingClientRect();
      const tooltip = document.createElement('div');
      tooltip.className = 'standup-walkthrough-tooltip glass-card';
      
      tooltip.innerHTML = `
        <div class="standup-walkthrough-content">
          <h4>${step.title}</h4>
          <p>${step.description}</p>
        </div>
        <div class="standup-walkthrough-actions">
          <button class="standup-walkthrough-skip">Skip</button>
          <div class="standup-walkthrough-steps">${this.currentStep + 1} / ${STEPS.length}</div>
          <button class="standup-walkthrough-next">${this.currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
      `;

      document.body.appendChild(tooltip);
      this.tooltip = tooltip;

      // Position logic
      this.positionTooltip(tooltip, rect, step.position);

      tooltip.querySelector('.standup-walkthrough-next').addEventListener('click', () => this.showNext());
      tooltip.querySelector('.standup-walkthrough-skip').addEventListener('click', () => this.complete());
      
      target.classList.add('standup-walkthrough-highlight');
      this.highlightedElement = target;
    }

    positionTooltip(tooltip, targetRect, position) {
      const tooltipRect = tooltip.getBoundingClientRect();
      const padding = 15;
      let top, left;

      if (position === 'right') {
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + padding;
      } else if (position === 'left') {
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - padding;
      } else if (position === 'top') {
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
      } else {
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
      }

      // Screen bounds check
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.opacity = '1';
    }

    showNext() {
      this.showStep(this.currentStep + 1);
    }

    removeTooltip() {
      if (this.tooltip) {
        this.tooltip.remove();
        this.tooltip = null;
      }
      if (this.highlightedElement) {
        this.highlightedElement.classList.remove('standup-walkthrough-highlight');
        this.highlightedElement = null;
      }
    }

    remove() {
      this.removeTooltip();
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
    }

    complete() {
      this.remove();
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new StandupOnboarding());
  } else {
    new StandupOnboarding();
  }
})();
