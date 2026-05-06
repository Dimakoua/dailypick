(function (window, document) {
  'use strict';

  var defaultSegmentColors = [
    '#da291c',
    '#003a6b',
    '#f2b705',
    '#8a1538',
    '#008c95',
    '#4f7942',
    '#6b2e77',
    '#73503c'
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
      'z-index:9999'
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

    function spinWheel() {
      if (isSpinning) return;
      if (removeAfterSelection) {
        removePendingItem();
      }
      if (foodItems.length === 0) return;
      isSpinning = true;
      hasSpun = true;
      stopIdleRotation();
      winnerElement.innerText = '';

      var angleStep = (2 * Math.PI) / foodItems.length;
      var selectedIndex = Math.floor(Math.random() * foodItems.length);
      var selectedItem = foodItems[selectedIndex];
      var fullSpins = 5;
      var targetRotation = fullSpins * 2 * Math.PI + (3 * Math.PI / 2) - (selectedIndex * angleStep + angleStep / 2);
      var currentRotation = 0;

      function animate() {
        var progress = currentRotation / targetRotation;
        var easeOutSpeed = Math.max(0.01, (1 - progress) * 0.8);
        currentRotation += easeOutSpeed;
        renderWheel(currentRotation);

        if (currentRotation < targetRotation) {
          requestAnimationFrame(animate);
        } else {
          winnerElement.innerHTML = resultFormatter(selectedItem);
          if (removeAfterSelection) {
            pendingRemovalItem = selectedItem;
          }
          isSpinning = false;
          renderWheel(currentRotation);
          startIdleRotation();
          if (foodItems.length === 1) {
            launchConfetti(canvas);
            setTimeout(function () {
              foodItems = normalizeItems(originalItems);
              pendingRemovalItem = null;
              hasSpun = false;
              idleRotation = 0;
              winnerElement.innerText = '';
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
