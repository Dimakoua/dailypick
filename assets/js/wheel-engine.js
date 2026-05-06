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

  function drawWheel(canvas, items, rotationAngle, options) {
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

    var foodItems = normalizeItems(options.defaultItems || []);
    var isSpinning = false;
    var hasSpun = false;
    var idleRotation = 0;
    var idleAnimationFrame = null;
    var idleRotationSpeed = typeof options.idleRotationSpeed === 'number' ? options.idleRotationSpeed : 0.0035;
    var enableIdleRotation = options.enableIdleRotation !== false;

    function renderWheel(rotation) {
      drawWheel(canvas, foodItems, rotation, options);
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

    function spinWheel() {
      if (isSpinning || foodItems.length === 0) return;
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
          isSpinning = false;
          startIdleRotation();
        }
      }

      animate();
    }

    spinButton.addEventListener('click', spinWheel);

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
