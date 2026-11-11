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
  } catch (e) { }

  function initAudio() {
    if (audioCtx) return;
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch (e) { }
  }

  // Velocity-aware dual-layer ratchet sound (wood/plastic body thud + crisp pin snap)
  function playRatchetTick(normSpeed) {
    if (isSoundMuted) return;
    if (!audioCtx) initAudio();
    if (!audioCtx) return;

    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      var s = Math.max(0, Math.min(1, normSpeed === undefined ? 0.5 : normSpeed));
      var now = audioCtx.currentTime;

      // Primary transient snap
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      var baseFreq = 310 + s * 340;
      var duration = 0.042 - s * 0.020;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + duration);

      var clickVol = 0.09 + s * 0.08;
      gain.gain.setValueAtTime(clickVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.005);

      // High-harmonic flapper click for slow, heavy final ticks
      if (s < 0.35) {
        var snapOsc = audioCtx.createOscillator();
        var snapGain = audioCtx.createGain();
        snapOsc.type = 'sine';
        snapOsc.frequency.setValueAtTime(1150, now);
        snapOsc.frequency.exponentialRampToValueAtTime(220, now + 0.015);

        snapGain.gain.setValueAtTime(0.06 * (1 - s * 2), now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        snapOsc.connect(snapGain);
        snapGain.connect(audioCtx.destination);
        snapOsc.start(now);
        snapOsc.stop(now + 0.018);
      }
    } catch (e) { }
  }

  // Synthesized celebratory chord arpeggio when winner locks in
  function playWinFanfare() {
    if (isSoundMuted) return;
    if (!audioCtx) initAudio();
    if (!audioCtx) return;

    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      var now = audioCtx.currentTime;
      // C5, E5, G5, B5, C6 (bright major 7th/9th shimmer)
      var notes = [523.25, 659.25, 783.99, 987.77, 1046.50];

      notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        var start = now + i * 0.055;
        var dur = i === notes.length - 1 ? 0.65 : 0.28;

        osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.085, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch (e) { }
  }

  function getActiveSliceIndex(rotationAngle, itemCount) {
    if (!itemCount) return -1;
    var angleStep = (2 * Math.PI) / itemCount;
    var indAngle = 1.5 * Math.PI; // Top 12 o'clock needle
    var relAngle = ((indAngle - rotationAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return Math.floor(relAngle / angleStep) % itemCount;
  }

  function drawWheel(canvas, items, rotationAngle, options, showCenterPlayIcon, renderState) {
    if (!canvas || !items || !items.length) return;
    rotationAngle = rotationAngle || 0;
    options = options || {};
    renderState = renderState || {};

    var ctx = canvas.getContext('2d');
    var radius = canvas.width / 2;
    var angleStep = (2 * Math.PI) / items.length;
    var segmentColors = resolveSegmentColors(items, options);
    var activeIndex = renderState.activeIndex !== undefined ? renderState.activeIndex : -1;
    var winnerIndex = renderState.winnerIndex !== undefined ? renderState.winnerIndex : -1;
    var winnerPulse = renderState.winnerPulse || 0; // 0..1

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(rotationAngle);
    ctx.translate(-radius, -radius);

    items.forEach(function (item, index) {
      var angle = index * angleStep;
      var isWinner = index === winnerIndex;
      var isActiveCrawl = index === activeIndex && winnerIndex === -1;

      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, angle, angle + angleStep);
      ctx.closePath();
      ctx.fillStyle = segmentColors[index % segmentColors.length];
      ctx.fill();

      // Subtle inner rim vignette for depth
      var sliceGrad = ctx.createRadialGradient(radius, radius, radius * 0.15, radius, radius, radius);
      sliceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      sliceGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
      sliceGrad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
      ctx.fillStyle = sliceGrad;
      ctx.fill();

      // Live crawl highlight (lights up slice currently under needle during slow crawl)
      if (isActiveCrawl) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fill();
      }

      // Winner spotlight glow
      if (isWinner) {
        var glowAlpha = 0.22 + 0.18 * Math.sin(winnerPulse * Math.PI * 4);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + glowAlpha.toFixed(3) + ')';
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius - 2, angle, angle + angleStep);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      }

      // Clean divider between segments
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.lineTo(radius + Math.cos(angle) * radius, radius + Math.sin(angle) * radius);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(angle + angleStep / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = isWinner ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = isWinner ? 8 : 4;

      var maxTextWidth = radius * 0.55;
      var fontScale = isWinner ? 1 + 0.06 * Math.sin(winnerPulse * Math.PI * 2) : 1;
      var baseSize = Math.round(16 * fontScale);
      ctx.font = 'bold ' + baseSize + 'px Nunito, Arial';
      var lines = wrapCanvasText(ctx, item, maxTextWidth);
      if (lines.length > 2) {
        ctx.font = 'bold ' + Math.round(14 * fontScale) + 'px Nunito, Arial';
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
      ctx.arc(px, py + 1.2, 4.0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.fill();

      // Shiny chrome peg body
      var pegGrad = ctx.createRadialGradient(px - 1.2, py - 1.2, 0.5, px, py, 3.8);
      pegGrad.addColorStop(0, '#ffffff');
      pegGrad.addColorStop(0.35, '#f1f5f9');
      pegGrad.addColorStop(1, '#64748b');

      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, 2 * Math.PI);
      ctx.fillStyle = pegGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
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
    var dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(rect.width * dpr);
    overlay.height = Math.round(rect.height * dpr);
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
    var colors = ['#FF3F81', '#FF9100', '#FFEA00', '#00E676', '#00B0FF', '#D500F9', '#ffffff', '#FFD700'];
    var particles = [];

    function spawnWave(count, speedMult, yOffset) {
      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = (Math.random() * 11 + 3.5) * speedMult * dpr;
        particles.push({
          x: cx,
          y: cy + (yOffset || 0),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6 * dpr,
          w: (Math.random() * 12 + 5) * dpr,
          h: (Math.random() * 6 + 3) * dpr,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.38,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.08 + Math.random() * 0.08,
          gravity: 0.25 * dpr,
          drag: 0.985,
          opacity: 1
        });
      }
    }

    spawnWave(140, 1.0, 0);
    setTimeout(function () {
      spawnWave(80, 0.85, -overlay.height * 0.15);
    }, 220);

    var duration = 3500;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var elapsed = timestamp - start;
      var progress = elapsed / duration;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      particles.forEach(function (p) {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 1.2 * dpr;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = progress > 0.58 ? Math.max(0, 1 - (progress - 0.58) / 0.42) : 1;

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

    function renderWheel(rotation, renderState) {
      drawWheel(
        canvas,
        foodItems,
        rotation,
        options,
        enableCanvasClick && !isSpinning && foodItems.length > 0,
        renderState
      );
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
      var baseRounds = Math.max(1, Math.round(getEffectiveOption(options, studioConfig, 'spinRounds', 7, 'number')));
      var spinSpeedFactor = Math.max(0.25, getEffectiveOption(options, studioConfig, 'spinSpeed', 1, 'number'));
      var showPopupResult = getEffectiveOption(options, studioConfig, 'showPopupResult', false, 'boolean');
      var enableConfetti = getEffectiveOption(options, studioConfig, 'enableConfetti', false, 'boolean');

      isSpinning = true;
      hasSpun = true;
      stopIdleRotation();
      winnerElement.innerText = '';

      var itemCount = foodItems.length;
      var angleStep = (2 * Math.PI) / itemCount;
      var selectedIndex = Math.floor(Math.random() * itemCount);
      var selectedItem = foodItems[selectedIndex];

      // 4 High-Suspense Endgame Archetypes:
      // Type 0 (40%): "Late Cliffhanger Hop" - stalls against the entry peg of winner, barely pops over at the end
      // Type 1 (35%): "Elastic Peg Rejection" - pushes to the exit peg of winner, fails to pass, and rocks back
      // Type 2 (15%): "Double-Tease Crawl" - clears entry peg by a razor margin and stops just inside the border
      // Type 3 (10%): "Deep Glide" - ultra-long slow coast into the center of the winning slice
      var outcomeRoll = Math.random();
      var outcomeType = outcomeRoll < 0.40 ? 0 : (outcomeRoll < 0.75 ? 1 : (outcomeRoll < 0.90 ? 2 : 3));
      var sliceOffset;
      var rollbackAngle = 0;

      if (outcomeType === 0) {
        sliceOffset = 0.08 + Math.random() * 0.11;
      } else if (outcomeType === 1) {
        sliceOffset = 0.78 + Math.random() * 0.12;
        // Push right up into the exit peg, then spring back
        var distToExitPeg = (1.0 - sliceOffset) * angleStep;
        rollbackAngle = distToExitPeg * (0.78 + Math.random() * 0.14);
      } else if (outcomeType === 2) {
        sliceOffset = 0.04 + Math.random() * 0.05;
      } else {
        sliceOffset = 0.35 + Math.random() * 0.30;
      }

      var totalRounds = baseRounds + Math.floor(Math.random() * 3);
      var startRotation = idleRotation;
      var windupAngle = 0.19; // ~11 deg counter-rotation wind-up
      var launchRotation = startRotation - windupAngle;

      var indAngle = 1.5 * Math.PI;
      var desiredModulo = indAngle - (selectedIndex + sliceOffset) * angleStep;
      var currentMod = ((launchRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      var deltaToTarget = desiredModulo - currentMod;
      while (deltaToTarget < 0) {
        deltaToTarget += 2 * Math.PI;
      }
      var totalDeltaRotation = totalRounds * 2 * Math.PI + deltaToTarget;
      var targetRotation = launchRotation + totalDeltaRotation;

      // Extended duration for a suspenseful multi-second crawl
      var windupDuration = 260 / spinSpeedFactor;
      var mainSpinDuration = (8400 + Math.random() * 900) / spinSpeedFactor;
      var rollbackDuration = outcomeType === 1 ? (1050 / spinSpeedFactor) : 0;
      var totalDuration = windupDuration + mainSpinDuration + rollbackDuration;
      var startTime = performance.now();

      var indicatorEl = document.querySelector(
        options.indicatorSelector || '#indicator, .wheel-indicator, .sup-wheel-indicator, .owo-indicator, .sw-indicator'
      );
      if (indicatorEl) {
        indicatorEl.style.transformOrigin = '50% 12%';
      }

      // Track discrete peg crossings so no tick is ever missed at high or low speed
      var lastPegIndex = Math.floor((launchRotation - indAngle) / angleStep);
      var lastSnapTime = 0;
      var prevRotation = startRotation;

      // Steeper power-4.35 deceleration with a tiny late-crawl shelf
      function computeMainEase(p) {
        var base = 1 - Math.pow(1 - p, 4.35);
        return base;
      }

      function animate(now) {
        now = now || performance.now();
        var elapsed = now - startTime;
        var currentRotation;
        var isSpinComplete = false;
        var inCrawlPhase = false;

        if (elapsed < windupDuration) {
          // Phase 1: Quick anticipation pull-back
          var wp = elapsed / windupDuration;
          var windEase = 0.5 * (1 - Math.cos(wp * Math.PI));
          currentRotation = startRotation - windupAngle * windEase;
        } else if (elapsed < windupDuration + mainSpinDuration) {
          // Phase 2: Main launch + long suspenseful deceleration
          var p = (elapsed - windupDuration) / mainSpinDuration;
          var eased = computeMainEase(p);
          var rawRotation = launchRotation + (totalDeltaRotation + rollbackAngle) * eased;

          // Physical peg resistance during the slow crawl phase (last 42% of time)
          if (p > 0.58) {
            inCrawlPhase = true;
            var crawlIntensity = (p - 0.58) / 0.42; // 0..1
            var phaseInSlice = (((rawRotation - indAngle) % angleStep) + angleStep) % angleStep / angleStep;

            // As a peg approaches the flapper (phaseInSlice -> 1.0), the flapper pushes back,
            // creating realistic hesitation right on the pins.
            if (phaseInSlice > 0.65) {
              var u = (phaseInSlice - 0.65) / 0.35; // 0..1 approaching pin
              // Smooth bell-shaped resistance that peaks just before the peg snaps through
              var stallCurve = Math.sin(u * Math.PI) * Math.pow(u, 0.7);
              var fadeNearEnd = outcomeType === 1 ? 1 : Math.max(0, 1 - Math.pow(p, 8));
              var maxHoldBack = angleStep * 0.16 * crawlIntensity * fadeNearEnd;
              rawRotation -= stallCurve * maxHoldBack;
            }
          }

          currentRotation = rawRotation;
        } else if (elapsed < totalDuration && outcomeType === 1) {
          // Phase 3: Elastic peg rejection (rolls backward off the pin and settles)
          inCrawlPhase = true;
          var s = (elapsed - windupDuration - mainSpinDuration) / rollbackDuration;
          // Damped spring settle
          var springEase = 1 - Math.exp(-4.2 * s) * Math.cos(1.35 * Math.PI * s);
          currentRotation = (targetRotation + rollbackAngle) - rollbackAngle * Math.min(1.04, springEase);
        } else {
          currentRotation = targetRotation;
          isSpinComplete = true;
        }

        // Instantaneous angular speed for realistic sound pitch & needle physics
        var angularDelta = Math.abs(currentRotation - prevRotation);
        prevRotation = currentRotation;
        var normSpeed = Math.min(1, angularDelta / 0.22);

        // Accurate peg-crossing detector
        var currentPegIndex = Math.floor((currentRotation - indAngle) / angleStep);
        if (currentPegIndex !== lastPegIndex && elapsed > windupDuration * 0.5) {
          lastPegIndex = currentPegIndex;
          lastSnapTime = now;
          playRatchetTick(normSpeed);
        }

        // Indicator peg deflection & spring-back vibration
        var modAngle = (((currentRotation - indAngle) % angleStep) + angleStep) % angleStep;
        var contactWindow = Math.min(angleStep * 0.36, 0.16);
        var deflection = 0;
        var maxDeflection = 16; // Stronger bend on slow peg climbs

        if (modAngle > angleStep - contactWindow && !isSpinComplete && elapsed >= windupDuration) {
          var contactProgress = (modAngle - (angleStep - contactWindow)) / contactWindow;
          var contactSmooth = contactProgress * contactProgress * (3 - 2 * contactProgress);
          // Bend deeper when crawling slowly against a peg
          var slowBoost = 1 + (1 - normSpeed) * 0.45;
          deflection = -contactSmooth * maxDeflection * slowBoost;
        } else if (now - lastSnapTime < 150) {
          var dt = (now - lastSnapTime) / 1000;
          var snapAmp = 7.5 + normSpeed * 5.0;
          deflection = snapAmp * Math.exp(-22 * dt) * Math.sin(52 * dt);
        }

        if (elapsed > totalDuration * 0.95) {
          var settleFade = Math.max(0, (totalDuration - elapsed) / (totalDuration * 0.05));
          deflection *= settleFade;
        }

        if (indicatorEl) {
          indicatorEl.style.transform = 'translateX(-50%) rotate(' + deflection.toFixed(2) + 'deg)';
        }

        var activeIdx = inCrawlPhase ? getActiveSliceIndex(currentRotation, itemCount) : -1;
        renderWheel(currentRotation, {
          activeIndex: activeIdx,
          winnerIndex: isSpinComplete ? selectedIndex : -1,
          winnerPulse: 0
        });

        if (!isSpinComplete) {
          requestAnimationFrame(animate);
        } else {
          if (indicatorEl) {
            indicatorEl.style.transform = 'translateX(-50%) rotate(0deg)';
          }
          idleRotation = currentRotation;

          playWinFanfare();

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

          // Animate a 950ms spotlight pulse on the winning slice before unlocking
          var pulseStart = performance.now();
          var pulseDuration = 950;

          function animateWinnerPulse(tNow) {
            var pElapsed = tNow - pulseStart;
            if (pElapsed < pulseDuration) {
              renderWheel(currentRotation, {
                activeIndex: -1,
                winnerIndex: selectedIndex,
                winnerPulse: pElapsed / pulseDuration
              });
              requestAnimationFrame(animateWinnerPulse);
            } else {
              isSpinning = false;
              renderWheel(currentRotation, {
                activeIndex: -1,
                winnerIndex: selectedIndex,
                winnerPulse: 0
              });
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

          requestAnimationFrame(animateWinnerPulse);
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
        btn.addEventListener('mouseenter', function () {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          btn.style.background = '#ffffff';
        });
        btn.addEventListener('mouseleave', function () {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          btn.style.background = 'rgba(255,255,255,0.85)';
        });
      }
      applyHover(editBtn);
      applyHover(shareBtn);
      applyHover(soundBtn);

      soundBtn.addEventListener('click', function () {
        initAudio();
        isSoundMuted = !isSoundMuted;
        try {
          localStorage.setItem('wheelSoundMuted', isSoundMuted ? 'true' : 'false');
        } catch (e) { }
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