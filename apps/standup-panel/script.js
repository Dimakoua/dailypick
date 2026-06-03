/**
 * Daily Stand-up Panel
 * Integrates: Wheel (wheel-engine.js) + Timer + Queue (standup-data events) + Stats (standup-stats.js)
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  var DEFAULT_NAMES = ['Avery', 'Mira', 'Noah', 'Priya', 'Sofia', 'Leo', 'Jamal', 'Lena', 'Mason', 'Riya', 'Carlos', 'Zoe', 'Ibrahim', 'Nina', 'Elena', 'Theo'];
  var STORAGE_KEY = 'namesList';

  var roster = [];
  var completedOrder = [];
  var sessionStartTime = null;

  // Timer state
  var timerInterval = null;
  var timerRemaining = 300;
  var timerRunning = false;
  var timerTotal = 300;

  /* ------------------------------------------------------------------ */
  /*  DOM refs                                                           */
  /* ------------------------------------------------------------------ */
  var $spinBtn = document.getElementById('supSpinBtn');
  var $winner = document.getElementById('supWinner');
  var $resetBtn = document.getElementById('supResetBtn');

  var $timerDisplay = document.getElementById('supTimerDisplay');
  var $timerMin = document.getElementById('supTimerMin');
  var $timerSec = document.getElementById('supTimerSec');
  var $timerStartBtn = document.getElementById('supTimerStartBtn');
  var $timerPauseBtn = document.getElementById('supTimerPauseBtn');
  var $timerResetBtn = document.getElementById('supTimerResetBtn');
  var $timerStatus = document.getElementById('supTimerStatus');
  var $presetBtns = document.querySelectorAll('.sup-preset-btn');

  var $currentSpeaker = document.getElementById('supCurrentSpeaker');
  var $upcomingList = document.getElementById('supUpcomingList');
  var $completedList = document.getElementById('supCompletedList');
  var $completedCount = document.getElementById('supCompletedCount');

  var $statStreak = document.getElementById('supStatStreak');
  var $statSessions = document.getElementById('supStatSessions');
  var $statAvgDuration = document.getElementById('supStatAvgDuration');
  var $statThisMonth = document.getElementById('supStatThisMonth');
  var $recentSpeakers = document.getElementById('supRecentSpeakers');
  var $clearStatsBtn = document.getElementById('supClearStatsBtn');

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  function loadRoster() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_NAMES.slice();
  }

  function formatTime(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var m = String(Math.floor(s / 60)).padStart(2, '0');
    var sec = String(s % 60).padStart(2, '0');
    return m + ':' + sec;
  }

  function normalizeName(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  /* ------------------------------------------------------------------ */
  /*  Queue logic                                                        */
  /* ------------------------------------------------------------------ */
  function remainingSpeakers() {
    var completedKeys = completedOrder.map(function (n) { return normalizeName(n); });
    return roster.filter(function (name) {
      return completedKeys.indexOf(normalizeName(name)) === -1;
    });
  }

  function renderQueue() {
    var remaining = remainingSpeakers();
    var current = remaining.length > 0 ? null : null;
    // Current is the last picked (most recent spin winner that hasn't been completed)
    // For simplicity: the first remaining is "current" after a spin
    if (remaining.length > 0 && completedOrder.length > 0) {
      // The most recently spun person is the one at the front of remaining
      // Actually, let's track current separately
    }

    // Re-derive: current is the last person picked by the wheel (if not completed)
    var currentName = null;
    if (window.__supCurrentSpeaker && remaining.indexOf(window.__supCurrentSpeaker) !== -1) {
      currentName = window.__supCurrentSpeaker;
    }

    if (currentName) {
      $currentSpeaker.textContent = currentName;
      $currentSpeaker.dataset.empty = 'false';
    } else if (completedOrder.length === 0) {
      $currentSpeaker.textContent = 'Spin the wheel to pick the first speaker';
      $currentSpeaker.dataset.empty = 'true';
    } else if (remaining.length === 0) {
      $currentSpeaker.textContent = '✅ Everyone has spoken!';
      $currentSpeaker.dataset.empty = 'false';
    } else {
      $currentSpeaker.textContent = 'Spin again for the next speaker';
      $currentSpeaker.dataset.empty = 'true';
    }

    // Upcoming list
    $upcomingList.innerHTML = '';
    var upcoming = currentName ? remaining.filter(function (n) { return n !== currentName; }) : remaining;
    upcoming.forEach(function (name) {
      var li = document.createElement('li');
      li.textContent = name;
      $upcomingList.appendChild(li);
    });

    // Completed list
    $completedList.innerHTML = '';
    completedOrder.forEach(function (name) {
      var li = document.createElement('li');
      li.textContent = name;
      $completedList.appendChild(li);
    });
    $completedCount.textContent = '(' + completedOrder.length + ')';
  }

  function emitQueueEvents() {
    var detail = {
      source: 'standup-panel',
      participants: roster,
      completed: completedOrder
    };
    window.dispatchEvent(new CustomEvent('standup:queue', { detail: detail }));
  }

  function emitQueueReset() {
    window.dispatchEvent(new CustomEvent('standup:queue-reset', {
      detail: { source: 'standup-panel', participants: roster }
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  Timer                                                              */
  /* ------------------------------------------------------------------ */
  function updateTimerDisplay() {
    $timerDisplay.textContent = formatTime(timerRemaining);
  }

  function setTimerDuration(seconds) {
    if (timerRunning) return;
    timerTotal = Math.max(1, seconds);
    timerRemaining = timerTotal;
    $timerMin.value = Math.floor(timerRemaining / 60);
    $timerSec.value = timerRemaining % 60;
    updateTimerDisplay();
    $timerStatus.textContent = '';

    // Update preset buttons
    $presetBtns.forEach(function (btn) {
      btn.classList.toggle('sup-preset-btn--active', parseInt(btn.dataset.seconds, 10) === seconds);
    });
  }

  function startTimer() {
    if (timerRunning) return;
    if (timerRemaining <= 0) {
      syncTimerFromInputs();
    }
    if (timerRemaining <= 0) {
      $timerStatus.textContent = 'Set a duration first.';
      return;
    }
    timerRunning = true;
    $timerStartBtn.disabled = true;
    $timerPauseBtn.disabled = false;
    $timerResetBtn.disabled = false;
    $timerStatus.textContent = 'Running…';
    $timerDisplay.style.color = 'var(--brand-accent)';

    timerInterval = window.setInterval(function () {
      timerRemaining -= 1;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        stopTimer(true);
        playTimerTone();
        $timerStatus.textContent = '⏰ Time\'s up!';
        $timerDisplay.style.color = '#e74c3c';
      }
    }, 1000);
  }

  function stopTimer(completed) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerRunning = false;
    $timerStartBtn.disabled = false;
    $timerPauseBtn.disabled = true;
    if (!completed) {
      $timerStatus.textContent = 'Paused.';
    }
  }

  function resetTimer() {
    stopTimer(false);
    timerRemaining = timerTotal;
    $timerResetBtn.disabled = true;
    updateTimerDisplay();
    $timerStatus.textContent = 'Ready.';
    $timerDisplay.style.color = 'var(--brand-accent)';
  }

  function syncTimerFromInputs() {
    var m = Math.max(0, parseInt($timerMin.value, 10) || 0);
    var s = Math.max(0, Math.min(59, parseInt($timerSec.value, 10) || 0));
    timerTotal = m * 60 + s;
    timerRemaining = timerTotal;
    updateTimerDisplay();
  }

  function playTimerTone() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1040, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
      osc.addEventListener('ended', function () { ctx.close(); });
    } catch (e) { /* ignore audio errors */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Stats                                                              */
  /* ------------------------------------------------------------------ */
  function renderStats() {
    if (!window.standupStats) return;

    var stats = window.standupStats;

    // Streak
    var streak = stats.computeStreak();
    $statStreak.textContent = streak;

    // Total sessions
    var sessions = stats.loadSessions();
    $statSessions.textContent = sessions.length;

    // Avg duration
    var avgDur = stats.computeAverageSessionDuration();
    $statAvgDuration.textContent = avgDur ? avgDur.formattedAvg : '—';

    // This month
    var thisMonth = stats.getThisMonth();
    $statThisMonth.textContent = thisMonth.length;

    // Recent speakers (person stats)
    var personStats = stats.computePersonStats();
    $recentSpeakers.innerHTML = '';
    personStats.slice(0, 6).forEach(function (person) {
      var row = document.createElement('div');
      row.className = 'sup-recent-item';
      row.innerHTML = '<span class="sup-recent-item__name">' + person.name + '</span>' +
        '<span class="sup-recent-item__count">' + person.sessions + ' session' + (person.sessions === 1 ? '' : 's') + '</span>';
      $recentSpeakers.appendChild(row);
    });
    if (personStats.length === 0) {
      $recentSpeakers.innerHTML = '<div class="sup-recent-item"><span class="sup-recent-item__count">No data yet</span></div>';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Wheel integration (wheel-engine.js)                                */
  /* ------------------------------------------------------------------ */
  function initWheel() {
    if (!window.FoodWheelEngine) {
      console.warn('[StandupPanel] FoodWheelEngine not loaded');
      return;
    }

    roster = loadRoster();
    sessionStartTime = Date.now();

    // Emit initial queue reset for stats tracking
    emitQueueReset();

    window.FoodWheelEngine.init({
      canvasSelector: '#supWheel',
      spinButtonSelector: '#supSpinBtn',
      winnerSelector: '#supWinner',
      defaultItems: roster,
      resultFormatter: function (selectedItem) {
        return '🎉 ' + selectedItem + ' is next to speak!';
      },
      enableCanvasClick: true,
      removeAfterSelection: false,
      onResult: function (selectedItem) {
        // Track current speaker
        window.__supCurrentSpeaker = selectedItem;

        // Add to completed (mark previous as done)
        if (completedOrder.indexOf(selectedItem) === -1) {
          completedOrder.push(selectedItem);
        }

        renderQueue();
        emitQueueEvents();

        // Auto-save session when everyone has spoken
        var remaining = remainingSpeakers();
        if (remaining.length === 0 && window.standupStats) {
          window.standupStats.saveSession({
            ts: sessionStartTime || Date.now(),
            game: 'standup-panel',
            order: completedOrder.slice(),
            duration: Date.now() - (sessionStartTime || Date.now())
          });
          renderStats();
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  New Round                                                          */
  /* ------------------------------------------------------------------ */
  function newRound() {
    completedOrder = [];
    window.__supCurrentSpeaker = null;
    sessionStartTime = Date.now();
    $winner.textContent = '';
    renderQueue();
    emitQueueReset();

    // Re-init wheel with full roster
    if (window.FoodWheelEngine) {
      window.FoodWheelEngine.init({
        canvasSelector: '#supWheel',
        spinButtonSelector: '#supSpinBtn',
        winnerSelector: '#supWinner',
        defaultItems: roster,
        resultFormatter: function (selectedItem) {
          return '🎉 ' + selectedItem + ' is next to speak!';
        },
        enableCanvasClick: true,
        removeAfterSelection: false,
        onResult: function (selectedItem) {
          window.__supCurrentSpeaker = selectedItem;
          if (completedOrder.indexOf(selectedItem) === -1) {
            completedOrder.push(selectedItem);
          }
          renderQueue();
          emitQueueEvents();

          var remaining = remainingSpeakers();
          if (remaining.length === 0 && window.standupStats) {
            window.standupStats.saveSession({
              ts: sessionStartTime || Date.now(),
              game: 'standup-panel',
              order: completedOrder.slice(),
              duration: Date.now() - (sessionStartTime || Date.now())
            });
            renderStats();
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Event bindings                                                     */
  /* ------------------------------------------------------------------ */
  function bindEvents() {
    // Timer presets
    $presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTimerDuration(parseInt(btn.dataset.seconds, 10));
      });
    });

    // Timer controls
    $timerStartBtn.addEventListener('click', startTimer);
    $timerPauseBtn.addEventListener('click', function () { stopTimer(false); });
    $timerResetBtn.addEventListener('click', resetTimer);

    // Custom timer inputs
    $timerMin.addEventListener('change', syncTimerFromInputs);
    $timerSec.addEventListener('change', syncTimerFromInputs);

    // New Round
    $resetBtn.addEventListener('click', newRound);

    // Clear stats
    if ($clearStatsBtn) {
      $clearStatsBtn.addEventListener('click', function () {
        if (confirm('Clear all standup stats? This cannot be undone.')) {
          if (window.standupStats) {
            window.standupStats.clearAll();
            renderStats();
          }
        }
      });
    }

    // Listen for roster changes from other pages
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) {
        roster = loadRoster();
        renderQueue();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    roster = loadRoster();
    renderQueue();
    renderStats();
    bindEvents();
    initWheel();
    updateTimerDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
