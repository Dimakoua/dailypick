(function (window, document) {
  'use strict';

var defaultSegmentColors = [
    '#FF3F81', // Vibrant Pink
    '#FF9100', // Bright Orange
    '#FFEA00', // Sunny Yellow
    '#00E676', // Spring Green
    '#00B0FF', // Sky Blue
    '#D500F9', // Electric Purple
    '#3D5AFE', // Royal Indigo
    '#FF1744'  // Energetic Red
  ];

  function getSegmentColor(index) {
    var style = getComputedStyle(document.documentElement);
    var value = style.getPropertyValue('--wheel-segment-' + (index + 1)).trim();
    return value || defaultSegmentColors[index % defaultSegmentColors.length];
  }

  function getDefaultSegmentColors() {
    return defaultSegmentColors.map(function (_, index) {
      return getSegmentColor(index);
    });
  }

  function getSegmentColors() {
    return getDefaultSegmentColors();
  }

  function resolveSegmentColors(items, options) {
    options = options || {};
    if (typeof options.segmentColorResolver === 'function') {
      return items.map(function (item, index) {
        return options.segmentColorResolver(index, item, items) || getSegmentColor(index);
      });
    }

    if (Array.isArray(options.segmentColors) && options.segmentColors.length > 0) {
      return items.map(function (_, index) {
        return options.segmentColors[index % options.segmentColors.length];
      });
    }

    return getDefaultSegmentColors();
  }

  function drawWheel(canvas, items, rotationAngle, options, showCenterPlayIcon) {
    if (!canvas || !items || !items.length) return;
    rotationAngle = rotationAngle || 0;
    options = options || {};
    var ctx = canvas.getContext('2d');
    var radius = canvas.width / 2;
    var angleStep = (2 * Math.PI) / items.length;
    var segmentColors = resolveSegmentColors(items, options);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(rotationAngle);
    ctx.translate(-radius, -radius);

    items.forEach(function (item, index) {
      var angle = index * angleStep;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, angle, angle + angleStep);
      ctx.fillStyle = segmentColors[index % segmentColors.length];
      ctx.fill();

      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(angle + angleStep / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Nunito, Arial';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(item, radius - 16, 6);
      ctx.restore();
    });

    ctx.restore();

    if (showCenterPlayIcon) {
      var centerRadius = radius * 0.13;
      var cx = radius;
      var cy = radius;

      ctx.save();

      // Circle
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, centerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Triangle — centered within the circle
      var s = centerRadius * 0.38;
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s);
      ctx.lineTo(-s * 0.5, s);
      ctx.lineTo(s * 0.9, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,30,30,0.85)';
      ctx.fill();

      ctx.restore();
    }
  }

  function launchConfetti(canvas) {
    var overlay = document.createElement('canvas');
    var rect = canvas.getBoundingClientRect();
    overlay.width = Math.round(rect.width * window.devicePixelRatio);
    overlay.height = Math.round(rect.height * window.devicePixelRatio);
    overlay.style.cssText = [
      'position:fixed',
      'top:' + rect.top + 'px',
      'left:' + rect.left + 'px',
      'width:' + rect.width + 'px',
      'height:' + rect.height + 'px',
      'pointer-events:none',
      'background:transparent',
      'border-width:0',
      'border-radius:0',
      'z-index:10001'
    ].join(';');
    document.body.appendChild(overlay);

    var ctx = overlay.getContext('2d');
    var cx = overlay.width / 2;
    var cy = overlay.height / 2;
    var colors = ['#da291c', '#f2b705', '#008c95', '#4f7942', '#6b2e77', '#003a6b', '#8a1538', '#73503c'];
    var particles = [];

    for (var i = 0; i < 160; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * 10 + 3;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        w: Math.random() * 12 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.35,
        gravity: 0.28,
        opacity: 1
      });
    }

    var duration = 3200;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var elapsed = timestamp - start;
      var progress = elapsed / duration;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      particles.forEach(function (p) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = progress > 0.55 ? Math.max(0, 1 - (progress - 0.55) / 0.45) : 1;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
    }

    requestAnimationFrame(step);
  }

  function normalizeItems(items) {
    if (!items) return [];
    return items.map(function (item) {
      return String(item).trim();
    }).filter(function (item) {
      return item.length > 0;
    });
  }

  function parseNumber(value, fallback) {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      var parsed = parseFloat(value);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  }

  function parseBoolean(value, fallback) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      var normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  function getLocalBrandStudioConfig() {
    if (window.LocalBrandStudio?.getConfig && typeof window.LocalBrandStudio.getConfig === 'function') {
      return window.LocalBrandStudio.getConfig();
    }
    return {};
  }

  function getEffectiveOption(options, studioConfig, key, fallback, type) {
    var value = options[key];
    if (value === undefined) {
      value = studioConfig[key];
    }

    if (type === 'number') {
      return parseNumber(value, fallback);
    }

    if (type === 'boolean') {
      return parseBoolean(value, fallback);
    }

    return value !== undefined ? value : fallback;
  }

  function init(options) {
    options = options || {};
    var canvas = document.querySelector(options.canvasSelector || '#wheel');
    var spinButton = document.querySelector(options.spinButtonSelector || '#spinBtn');
    var winnerElement = document.querySelector(options.winnerSelector || '#winner');
    var presetButtons = document.querySelectorAll(options.presetButtonSelector || '.preset-btn');
    var resultFormatter = options.resultFormatter || function (selectedItem) {
      return selectedItem;
    };
    var redrawOnBrandUpdate = options.redrawOnBrandUpdate !== false;

    if (!canvas || !spinButton || !winnerElement) {
      return null;
    }

    var originalItems = normalizeItems(options.defaultItems || []);
    var foodItems = normalizeItems(options.defaultItems || []);
    var isSpinning = false;
    var hasSpun = false;
    var idleRotation = 0;
    var idleAnimationFrame = null;
    var idleRotationSpeed = typeof options.idleRotationSpeed === 'number' ? options.idleRotationSpeed : 0.0035;
    var enableIdleRotation = options.enableIdleRotation !== false;
    var enableCanvasClick = options.enableCanvasClick !== false;
    var removeAfterSelection = options.removeAfterSelection === true;
    var pendingRemovalItem = null;

    function renderWheel(rotation) {
      drawWheel(canvas, foodItems, rotation, options, enableCanvasClick && !isSpinning && foodItems.length > 0);
    }

    function startIdleRotation() {
      if (!enableIdleRotation || hasSpun || isSpinning || idleAnimationFrame) {
        return;
      }

      function step() {
        if (isSpinning || hasSpun) {
          idleAnimationFrame = null;
          return;
        }

        idleRotation += idleRotationSpeed;
        renderWheel(idleRotation);
        idleAnimationFrame = requestAnimationFrame(step);
      }

      idleAnimationFrame = requestAnimationFrame(step);
    }

    function stopIdleRotation() {
      if (idleAnimationFrame) {
        cancelAnimationFrame(idleAnimationFrame);
        idleAnimationFrame = null;
      }
    }

    function setItems(items) {
      foodItems = normalizeItems(items);
      winnerElement.innerText = '';
      if (!isSpinning) {
        renderWheel(idleRotation);
      }
    }

    function removePendingItem() {
      if (!removeAfterSelection || pendingRemovalItem === null) {
        return;
      }

      var index = foodItems.indexOf(pendingRemovalItem);
      if (index !== -1) {
        foodItems.splice(index, 1);
      }
      pendingRemovalItem = null;
    }

    function removeResultPopup() {
      var overlay = document.querySelector('.wheel-popup-overlay');
      if (overlay) {
        overlay.remove();
      }
    }

    function showResultPopup(content) {
      removeResultPopup();

      var overlay = document.createElement('div');
      overlay.className = 'wheel-popup-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:20px;z-index:10000;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);';

      var card = document.createElement('div');
      card.style.cssText = 'max-width:90vw;min-width:280px;padding:24px 24px 20px 24px;border-radius:24px;background:rgba(255,255,255,0.98);box-shadow:0 24px 80px rgba(0,0,0,0.18);text-align:center;position:relative;';

      var contentContainer = document.createElement('div');
      contentContainer.className = 'wheel-popup-content';
      contentContainer.style.cssText = 'font-size:1.05rem;color:#111;line-height:1.4;';
      contentContainer.innerHTML = content;

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = 'margin-top:20px;padding:12px 20px;border:none;border-radius:999px;background:#222;color:#fff;cursor:pointer;font-size:1rem;';
      closeBtn.addEventListener('click', removeResultPopup);

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) {
          removeResultPopup();
        }
      });

      card.appendChild(contentContainer);
      card.appendChild(closeBtn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    function isElementVisible(el) {
      if (!el || typeof el.getBoundingClientRect !== 'function') return false;
      var rect = el.getBoundingClientRect();
      var viewHeight = window.innerHeight || document.documentElement.clientHeight;
      return rect.top >= 0 && rect.bottom <= viewHeight;
    }

    function scrollResultIfNeeded() {
      if (isElementVisible(winnerElement)) return;
      var container = canvas.closest('#wheel-container') || canvas.parentElement || canvas;
      var rect = container.getBoundingClientRect();
      var offset = Math.min(80, Math.max(16, window.innerHeight * 0.08));
      var target = window.scrollY + rect.top - offset;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }

    function spinWheel() {
      if (isSpinning) return;
      removeResultPopup();
      if (removeAfterSelection) {
        removePendingItem();
      }
      if (foodItems.length === 0) return;

      var studioConfig = getLocalBrandStudioConfig();
      var spinRounds = Math.max(1, Math.round(getEffectiveOption(options, studioConfig, 'spinRounds', 5, 'number')));
      var spinSpeedFactor = Math.max(0.25, getEffectiveOption(options, studioConfig, 'spinSpeed', 1, 'number'));
      var showPopupResult = getEffectiveOption(options, studioConfig, 'showPopupResult', false, 'boolean');
      var enableConfetti = getEffectiveOption(options, studioConfig, 'enableConfetti', false, 'boolean');

      isSpinning = true;
      hasSpun = true;
      stopIdleRotation();
      winnerElement.innerText = '';

      var angleStep = (2 * Math.PI) / foodItems.length;
      var selectedIndex = Math.floor(Math.random() * foodItems.length);
      var selectedItem = foodItems[selectedIndex];
      var targetRotation = spinRounds * 2 * Math.PI + (3 * Math.PI / 2) - (selectedIndex * angleStep + angleStep / 2);
      var currentRotation = 0;

      function animate() {
        var progress = currentRotation / targetRotation;
        var easeOutSpeed = Math.max(0.01, (1 - progress) * 0.8);
        var step = easeOutSpeed * spinSpeedFactor;
        currentRotation = Math.min(currentRotation + step, targetRotation);
        renderWheel(currentRotation);

        if (currentRotation < targetRotation) {
          requestAnimationFrame(animate);
        } else {
          var resultHtml = resultFormatter(selectedItem);
          winnerElement.innerHTML = resultHtml;
          if (showPopupResult) {
            showResultPopup(resultHtml);
          } else {
            scrollResultIfNeeded();
          }
          if (removeAfterSelection) {
            pendingRemovalItem = selectedItem;
          }
          if (enableConfetti) {
            launchConfetti(canvas);
          }

          isSpinning = false;
          renderWheel(currentRotation);
          startIdleRotation();
          if (foodItems.length === 1) {
            setTimeout(function () {
              foodItems = normalizeItems(originalItems);
              pendingRemovalItem = null;
              hasSpun = false;
              idleRotation = 0;
              winnerElement.innerText = '';
              removeResultPopup();
              renderWheel(0);
              startIdleRotation();
            }, 3200);
          }
        }
      }

      animate();
    }

    spinButton.addEventListener('click', spinWheel);

    if (enableCanvasClick) {
      canvas.addEventListener('click', spinWheel);
      canvas.style.cursor = 'pointer';
    }

    presetButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var items = (button.dataset.items || '').split(',');
        setItems(items);
      });
    });

    if (redrawOnBrandUpdate) {
      window.addEventListener('localBrandConfigUpdated', function () {
        if (!isSpinning) {
          renderWheel(hasSpun ? 0 : idleRotation);
        }
      });
    }

    renderWheel(0);
    startIdleRotation();

    return {
      spinWheel: spinWheel,
      setItems: setItems,
      drawWheel: renderWheel,
      getSegmentColors: getSegmentColors
    };
  }

  window.FoodWheelEngine = {
    init: init,
    getSegmentColors: getSegmentColors,
    drawWheel: drawWheel
  };
})(window, document);
