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

  function wrapCanvasText(ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [];
    var currentLine = '';

    words.forEach(function (word) {
      var testLine = currentLine ? currentLine + ' ' + word : word;
      var testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
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

  var audioCtx = null;
  var isSoundMuted = false;
  try {
    isSoundMuted = localStorage.getItem('wheelSoundMuted') === 'true';
  } catch (e) {}

  function initAudio() {
    if (audioCtx) return;
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch (e) {}
  }

  function playRatchetTick(progress) {
    if (isSoundMuted) return;
    if (!audioCtx) initAudio();
    if (!audioCtx) return;

    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      var baseFreq = 540 - Math.min(progress || 0, 1) * 240;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.022);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch (e) {}
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

      // Clean divider between segments
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.lineTo(radius + Math.cos(angle) * radius, radius + Math.sin(angle) * radius);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(angle + angleStep / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;

      var maxTextWidth = radius * 0.55;
      ctx.font = 'bold 16px Nunito, Arial';
      var lines = wrapCanvasText(ctx, item, maxTextWidth);
      if (lines.length > 2) {
        ctx.font = 'bold 14px Nunito, Arial';
        lines = wrapCanvasText(ctx, item, maxTextWidth);
      }
      var lineHeight = 18;
      var startY = -((lines.length - 1) * lineHeight) / 2;

      lines.forEach(function (line) {
        ctx.fillText(line, radius - 18, startY);
        startY += lineHeight;
      });
      ctx.restore();
    });

    // Metallic rim pegs (pins) at each segment boundary
    items.forEach(function (_, index) {
      var pegAngle = index * angleStep;
      var px = radius + Math.cos(pegAngle) * (radius - 9);
      var py = radius + Math.sin(pegAngle) * (radius - 9);

      // Subtle drop shadow
      ctx.beginPath();
      ctx.arc(px, py + 1.2, 3.8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Shiny chrome peg body
      var pegGrad = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, 3.6);
      pegGrad.addColorStop(0, '#ffffff');
      pegGrad.addColorStop(0.35, '#f1f5f9');
      pegGrad.addColorStop(1, '#94a3b8');

      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, 2 * Math.PI);
      ctx.fillStyle = pegGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    ctx.restore();

    // Central axle hub
    var centerRadius = radius * 0.14;
    var cx = radius;
    var cy = radius;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, 2 * Math.PI);
    var hubGrad = ctx.createLinearGradient(cx - centerRadius, cy - centerRadius, cx + centerRadius, cy + centerRadius);
    hubGrad.addColorStop(0, '#ffffff');
    hubGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = hubGrad;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (showCenterPlayIcon) {
      var s = centerRadius * 0.42;
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.85);
      ctx.lineTo(-s * 0.45, s * 0.85);
      ctx.lineTo(s * 0.95, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, centerRadius * 0.38, 0, 2 * Math.PI);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
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

    // Check URL query parameters for custom choices (e.g. ?choices=Pizza,Sushi,Tacos)
    var urlParams = new URLSearchParams(window.location.search);
    var queryChoices = urlParams.get('choices') || urlParams.get('items');
    var initialItems = queryChoices ? queryChoices.split(',').map(decodeURIComponent) : (options.defaultItems || []);

    var originalItems = normalizeItems(initialItems);
    var foodItems = normalizeItems(initialItems);
    var isSpinning = false;
    var hasSpun = false;
    var idleRotation = 0;
    var idleAnimationFrame = null;
    var idleRotationSpeed = typeof options.idleRotationSpeed === 'number' ? options.idleRotationSpeed : 0.0035;
    var enableIdleRotation = options.enableIdleRotation !== false;
    var enableCanvasClick = options.enableCanvasClick !== false;
    var removeAfterSelection = options.removeAfterSelection === true;
    var pendingRemovalItem = null;

    function updateShareUrl() {
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('choices', foodItems.join(','));
        window.history.replaceState({}, '', url.toString());
      }
    }

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
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;overflow-y:auto;z-index:10000;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);';

      var card = document.createElement('div');
      card.style.cssText = 'max-width:90vw;min-width:280px;padding:24px 24px 20px 24px;border-radius:24px;background:rgba(255,255,255,0.98);box-shadow:0 24px 80px rgba(0,0,0,0.18);text-align:center;position:relative;max-height:calc(100vh - 40px);overflow-y:auto;box-sizing:border-box;';

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
      initAudio();
      removeResultPopup();
      if (removeAfterSelection) {
        removePendingItem();
      }
      if (foodItems.length === 0) return;

      var studioConfig = getLocalBrandStudioConfig();
      var baseRounds = Math.max(1, Math.round(getEffectiveOption(options, studioConfig, 'spinRounds', 5, 'number')));
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

      // Realistic dramatic ending types:
      // Type 0 (38%): "Peg Hop" - hangs on previous name until last moment, then pops over peg into winner
      // Type 1 (38%): "Near-Miss Rollback" - drives near exit peg, flapper resists, gently rolls back into winner
      // Type 2 (24%): "Sustained Coast" - drifts smoothly into mid-slice
      var outcomeRoll = Math.random();
      var outcomeType = outcomeRoll < 0.38 ? 0 : (outcomeRoll < 0.76 ? 1 : 2);
      var sliceOffset;
      var rollbackAngle = 0; // in radians

      if (outcomeType === 0) {
        sliceOffset = 0.12 + Math.random() * 0.16;
      } else if (outcomeType === 1) {
        sliceOffset = 0.72 + Math.random() * 0.10;
        rollbackAngle = (1.8 + Math.random() * 1.5) * (Math.PI / 180);
      } else {
        sliceOffset = 0.35 + Math.random() * 0.30;
      }

      var totalRounds = baseRounds + (Math.random() < 0.5 ? 1 : 0);
      var startRotation = idleRotation;
      var indAngle = 3 * Math.PI / 2;
      var desiredModulo = indAngle - (selectedIndex + sliceOffset) * angleStep;
      var currentMod = ((startRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      var deltaToTarget = desiredModulo - currentMod;
      while (deltaToTarget < 0) {
        deltaToTarget += 2 * Math.PI;
      }
      var totalDeltaRotation = totalRounds * 2 * Math.PI + deltaToTarget;
      var targetRotation = startRotation + totalDeltaRotation;

      var baseDuration = 6400;
      var totalDuration = baseDuration / spinSpeedFactor;
      var rollbackDuration = outcomeType === 1 ? (750 / spinSpeedFactor) : 0;
      var forwardDuration = totalDuration - rollbackDuration;
      var startTime = performance.now();

      var indicatorEl = document.querySelector(options.indicatorSelector || '#indicator, .wheel-indicator, .sup-wheel-indicator, .owo-indicator, .sw-indicator');
      if (indicatorEl) {
        indicatorEl.style.transformOrigin = '50% 0%';
      }

      var wasContacting = false;
      var lastSnapTime = 0;

      function animate(now) {
        now = now || performance.now();
        var elapsed = now - startTime;
        var currentRotation;
        var isSpinComplete = false;

        if (outcomeType === 1) {
          if (elapsed < forwardDuration) {
            var p = elapsed / forwardDuration;
            var eased = 1 - Math.pow(1 - p, 2.25);
            currentRotation = startRotation + (totalDeltaRotation + rollbackAngle) * eased;
          } else if (elapsed < totalDuration) {
            var s = (elapsed - forwardDuration) / rollbackDuration;
            var rollEase = 0.5 * (1 - Math.cos(s * Math.PI));
            currentRotation = (targetRotation + rollbackAngle) - rollbackAngle * rollEase;
          } else {
            currentRotation = targetRotation;
            isSpinComplete = true;
          }
        } else {
          if (elapsed < totalDuration) {
            var p = elapsed / totalDuration;
            var eased = 1 - Math.pow(1 - p, 2.25);
            currentRotation = startRotation + totalDeltaRotation * eased;
          } else {
            currentRotation = targetRotation;
            isSpinComplete = true;
          }
        }

        // Indicator peg deflection & snap physics
        var modAngle = ((currentRotation - indAngle) % angleStep + angleStep) % angleStep;
        if (Math.abs(modAngle - angleStep) < 1e-5) modAngle = 0;

        var contactWindow = Math.min(angleStep * 0.38, 0.12);
        var deflection = 0;

        if (modAngle > angleStep - contactWindow && !isSpinComplete) {
          var contactProgress = (modAngle - (angleStep - contactWindow)) / contactWindow;
          deflection = contactProgress * 15;
          wasContacting = true;
        } else {
          if (wasContacting) {
            wasContacting = false;
            if (modAngle < angleStep * 0.5) {
              lastSnapTime = now;
              playRatchetTick(elapsed / totalDuration);
            }
          }
          if (now - lastSnapTime < 140) {
            var dt = (now - lastSnapTime) / 1000;
            deflection = -7 * Math.exp(-22 * dt) * Math.sin(45 * dt);
          } else {
            deflection = 0;
          }
        }

        if (indicatorEl) {
          indicatorEl.style.transform = 'translateX(-50%) rotate(' + deflection.toFixed(2) + 'deg)';
        }

        renderWheel(currentRotation);

        if (!isSpinComplete) {
          requestAnimationFrame(animate);
        } else {
          if (indicatorEl) {
            indicatorEl.style.transform = 'translateX(-50%) rotate(0deg)';
          }
          idleRotation = currentRotation;

          var resultHtml = resultFormatter(selectedItem);
          winnerElement.innerHTML = resultHtml;
          if (typeof options.onResult === 'function') {
            options.onResult(selectedItem, selectedIndex, winnerElement);
          }
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

      requestAnimationFrame(animate);
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
        updateShareUrl();
      });
    });

    // --- Dynamic "Edit Choices", "Share Wheel" & "Sound" Controls ---
    (function setupCustomControls() {
      var spinBtn = document.querySelector(options.spinButtonSelector || '#spinBtn');
      if (!spinBtn || !spinBtn.parentNode) return;

      var controlsWrap = document.createElement('div');
      controlsWrap.className = 'custom-wheel-toolbar';
      controlsWrap.style.cssText = 'display:flex;gap:12px;justify-content:center;align-items:center;margin:12px auto 16px;width:100%;max-width:500px;';

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'custom-wheel-tool-btn';
      editBtn.innerHTML = '<span style="margin-right:6px;">✏️</span><span>Edit Choices</span>';
      editBtn.title = 'Add or customize wheel items';
      editBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:7px 18px;border-radius:999px;border:1.5px solid var(--wheel-result-text, #4f46e5);background:rgba(255,255,255,0.85);color:var(--brand-heading,#222);font-weight:600;font-size:0.88rem;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);box-shadow:0 2px 8px rgba(0,0,0,0.04);';

      var shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'custom-wheel-tool-btn';
      shareBtn.innerHTML = '<span style="margin-right:6px;">🔗</span><span>Share Wheel</span>';
      shareBtn.title = 'Copy a link with your custom wheel choices';
      shareBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:7px 18px;border-radius:999px;border:1.5px solid var(--wheel-result-text, #4f46e5);background:rgba(255,255,255,0.85);color:var(--brand-heading,#222);font-weight:600;font-size:0.88rem;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);box-shadow:0 2px 8px rgba(0,0,0,0.04);';

      var soundBtn = document.createElement('button');
      soundBtn.type = 'button';
      soundBtn.className = 'custom-wheel-tool-btn';
      soundBtn.title = 'Toggle wheel sound effects';
      soundBtn.innerHTML = isSoundMuted ? '<span style="margin-right:6px;">🔇</span><span>Muted</span>' : '<span style="margin-right:6px;">🔊</span><span>Sound</span>';
      soundBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:7px 18px;border-radius:999px;border:1.5px solid var(--wheel-result-text, #4f46e5);background:rgba(255,255,255,0.85);color:var(--brand-heading,#222);font-weight:600;font-size:0.88rem;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);box-shadow:0 2px 8px rgba(0,0,0,0.04);';

      function applyHover(btn) {
        btn.addEventListener('mouseenter', function() {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          btn.style.background = '#ffffff';
        });
        btn.addEventListener('mouseleave', function() {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          btn.style.background = 'rgba(255,255,255,0.85)';
        });
      }
      applyHover(editBtn);
      applyHover(shareBtn);
      applyHover(soundBtn);

      soundBtn.addEventListener('click', function() {
        initAudio();
        isSoundMuted = !isSoundMuted;
        try {
          localStorage.setItem('wheelSoundMuted', isSoundMuted ? 'true' : 'false');
        } catch (e) {}
        soundBtn.innerHTML = isSoundMuted ? '<span style="margin-right:6px;">🔇</span><span>Muted</span>' : '<span style="margin-right:6px;">🔊</span><span>Sound</span>';
        if (!isSoundMuted) {
          playRatchetTick(0.5);
        }
      });

      editBtn.addEventListener('click', function () {
        var currentText = foodItems.join('\n');
        var modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(8px);padding:18px;box-sizing:border-box;animation:fadeIn 0.2s ease;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#ffffff;color:#1e293b;border-radius:20px;padding:26px;width:100%;max-width:440px;box-shadow:0 24px 70px rgba(0,0,0,0.28);box-sizing:border-box;border:1px solid rgba(255,255,255,0.2);';
        modal.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
          '<h3 style="margin:0;font-size:1.25rem;font-weight:700;">✏️ Edit Wheel Choices</h3>' +
          '<button id="closeModalX" type="button" style="background:none;border:none;font-size:1.4rem;line-height:1;cursor:pointer;color:#94a3b8;padding:4px;">&times;</button>' +
        '</div>' +
        '<p style="margin:0 0 12px 0;font-size:0.88rem;color:#64748b;line-height:1.4;">Add or edit choices (one per line, or comma-separated):</p>' +
        '<textarea id="customChoicesInput" rows="7" style="width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid #cbd5e1;font-size:0.95rem;box-sizing:border-box;font-family:inherit;line-height:1.5;resize:vertical;outline:none;">' + currentText + '</textarea>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
          '<button id="cancelChoicesBtn" type="button" style="padding:10px 18px;border-radius:999px;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;font-weight:600;font-size:0.9rem;cursor:pointer;">Cancel</button>' +
          '<button id="saveChoicesBtn" type="button" style="padding:10px 22px;border-radius:999px;border:none;background:var(--wheel-result-text, #ff3f81);color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);">Save & Spin</button>' +
        '</div>';

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        var textarea = modal.querySelector('#customChoicesInput');
        textarea.focus();

        function closeModal() {
          modalOverlay.remove();
        }

        modal.querySelector('#closeModalX').addEventListener('click', closeModal);
        modal.querySelector('#cancelChoicesBtn').addEventListener('click', closeModal);

        modal.querySelector('#saveChoicesBtn').addEventListener('click', function () {
          var text = textarea.value;
          var newItems = text.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (newItems.length > 0) {
            setItems(newItems);
            updateShareUrl();
          }
          closeModal();
        });

        modalOverlay.addEventListener('click', function (e) {
          if (e.target === modalOverlay) closeModal();
        });
      });

      shareBtn.addEventListener('click', function () {
        updateShareUrl();
        var fullUrl = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullUrl).then(function () {
            shareBtn.innerHTML = '<span style="margin-right:6px;">✅</span><span>Link Copied!</span>';
            setTimeout(function () {
              shareBtn.innerHTML = '<span style="margin-right:6px;">🔗</span><span>Share Wheel</span>';
            }, 2200);
          });
        } else {
          prompt('Copy this shareable link:', fullUrl);
        }
      });

      controlsWrap.appendChild(editBtn);
      controlsWrap.appendChild(shareBtn);
      controlsWrap.appendChild(soundBtn);
      // Place neatly between the preset buttons and the Spin Button
      spinBtn.parentNode.insertBefore(controlsWrap, spinBtn);
    })();

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
