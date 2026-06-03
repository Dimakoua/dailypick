/**
 * Daily Stand-up Panel
 * Pluggable game architecture: 6 speaker-selection games
 * Inline: Wheel (FoodWheelEngine canvas)
 *Embedded iframes: Speedway, Trap!, Falling Letters, Gravity Drift, Patchinko
 *   — each original game loads with ?embed=1, forwards events via postMessage
 * Integrates: Game Engine + Timer + Queue + Stats
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */
  var DEFAULT_NAMES = ['Avery', 'Mira', 'Noah', 'Priya', 'Sofia', 'Leo', 'Jamal', 'Lena', 'Mason', 'Riya', 'Carlos', 'Zoe', 'Ibrahim', 'Nina', 'Elena', 'Theo'];
  var STORAGE_KEY = 'namesList';
  var GAME_STORAGE_KEY = 'sup_game_mode';

  var GAMES = {
    wheel: {
      id: 'wheel',
      label: '🎡 Wheel',
      description: 'Spin the wheel to pick speakers one at a time',
      inline: true,
      url: null
    },
    speedway: {
      id: 'speedway',
      label: '🐢 Speedway',
      description: 'Turtle race — the original Speedway game',
      inline: false,
      url: '/apps/speedway/?embed=1'
    },
    trap: {
      id: 'trap',
      label: '🎯 Trap!',
      description: 'A strategy game — catch the next speaker',
      inline: false,
      url: '/apps/trap/?embed=1'
    },
    letters: {
      id: 'letters',
      label: '🕹️ Falling Letters',
      description: 'Pinball letter-matching name picker',
      inline: false,
      url: '/apps/letters/?embed=1'
    },
    gravity: {
      id: 'gravity',
      label: '🚀 Gravity Drift',
      description: 'Space trajectory challenge',
      inline: false,
      url: '/apps/gravity-drift/?embed=1'
    },
    patchinko: {
      id: 'patchinko',
      label: '🎳 Patchinko',
      description: 'Pachinko drop board for stand-up order',
      inline: false,
      url: '/apps/patchinko-machine/?embed=1'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  var roster = [];
  var completedOrder = [];
  var sessionStartTime = null;
  var currentGameId = 'wheel';
  var wheelEngine = null;
  var iframeReady = false;
  var wheelInitRetryCount = 0;

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
  var $gameBtns = document.querySelectorAll('.sup-game-btn');
  var $wheelCard = document.querySelector('.sup-wheel-card');
  var $wheelSection = document.getElementById('supWheelSection');
  var $iframeSection = document.getElementById('supIframeSection');
  var $gameFrame = document.getElementById('supGameFrame');

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

  var $statStreak = document.getElementById('supStatStreak');
  var $statSessions = document.getElementById('supStatSessions');
  var $statAvgDuration = document.getElementById('supStatAvgDuration');
  var $statThisMonth = document.getElementById('supStatThisMonth');
  var $recentSpeakers = document.getElementById('supRecentSpeakers');
  var $clearStatsBtn = document.getElementById('supClearStatsBtn');
  var $nextBtn = document.getElementById('supNextBtn');

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

  function loadSavedGame() {
    try {
      var saved = localStorage.getItem(GAME_STORAGE_KEY);
      if (saved && GAMES[saved]) return saved;
    } catch (e) { /* ignore */ }
    return 'wheel';
  }

  function saveGameMode(mode) {
    try {
      localStorage.setItem(GAME_STORAGE_KEY, mode);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Queue logic                                                        */
  /* ------------------------------------------------------------------ */
  function renderQueue() {
    var currentName = window.__supCurrentSpeaker || null;
    var gameQueue = window.__supGameQueue || null; // full ordered list from the game

    // Upcoming = remaining entries from the game's order after the current speaker
    var upcoming;
    if (gameQueue && gameQueue.length) {
      var idx = gameQueue.indexOf(currentName);
      if (idx >= 0) {
        upcoming = gameQueue.slice(idx + 1);
      } else {
        // current speaker not in game queue — show full queue as upcoming
        upcoming = gameQueue.slice();
      }
    } else {
      // No game queue (e.g. wheel mode) — show roster minus current
      upcoming = roster.filter(function (n) { return n !== currentName; });
    }

    if (currentName) {
      $currentSpeaker.textContent = currentName;
      $currentSpeaker.dataset.empty = 'false';
    } else {
      $currentSpeaker.textContent = 'Select the next speaker';
      $currentSpeaker.dataset.empty = 'true';
    }

    $upcomingList.innerHTML = '';
    upcoming.forEach(function (name, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + name;
      $upcomingList.appendChild(li);
    });

    // Enable Next button only when there is a current speaker and upcoming entries
    var hasNext = !!(currentName && upcoming && upcoming.length);
    $nextBtn.disabled = !hasNext;
  }

  function advanceQueue() {
    var gameQueue = window.__supGameQueue;
    var currentName = window.__supCurrentSpeaker;
    if (!gameQueue || !gameQueue.length || !currentName) return;

    var idx = gameQueue.indexOf(currentName);
    if (idx < 0 || idx + 1 >= gameQueue.length) return;

    window.__supCurrentSpeaker = gameQueue[idx + 1];
    renderQueue();
    emitQueueEvents();
  }

  function emitQueueEvents() {
    window.dispatchEvent(new CustomEvent('standup:queue', {
      detail: {
        source: 'standup-panel',
        participants: roster,
        current: window.__supCurrentSpeaker
      }
    }));
  }

  function emitQueueReset() {
    window.dispatchEvent(new CustomEvent('standup:queue-reset', {
      detail: { source: 'standup-panel', participants: roster }
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  Process incoming game events (from wheel or iframe postMessage)    */
  /* ------------------------------------------------------------------ */
  function handleGameResult(name) {
    window.__supCurrentSpeaker = name;
    // Wheel picks one at a time — no full order, so clear any prior game queue
    window.__supGameQueue = null;
    renderQueue();
    emitQueueEvents();
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

    $presetBtns.forEach(function (btn) {
      btn.classList.toggle('sup-preset-btn--active', parseInt(btn.dataset.seconds, 10) === seconds);
    });
  }

  function startTimer() {
    if (timerRunning) return;
    if (timerRemaining <= 0) syncTimerFromInputs();
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
    if (!completed) $timerStatus.textContent = 'Paused.';
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

    $statStreak.textContent = stats.computeStreak();

    var sessions = stats.loadSessions();
    $statSessions.textContent = sessions.length;

    var avgDur = stats.computeAverageSessionDuration();
    $statAvgDuration.textContent = avgDur ? avgDur.formattedAvg : '—';

    $statThisMonth.textContent = stats.getThisMonth().length;

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
  /*  Game: Wheel (wraps FoodWheelEngine)                                */
  /* ------------------------------------------------------------------ */
  function initWheelGame() {
    if (!window.FoodWheelEngine) {
      console.warn('[StandupPanel] FoodWheelEngine not loaded');
      return;
    }
    wheelEngine = window.FoodWheelEngine.init({
      canvasSelector: '#supWheel',
      spinButtonSelector: '#supSpinBtn',
      winnerSelector: '#supWinner',
      defaultItems: roster,
      resultFormatter: function (selectedItem) {
        return '🎉 ' + selectedItem + ' is next to speak!';
      },
      enableCanvasClick: true,
      removeAfterSelection: false,
      onResult: handleGameResult
    });
    if (wheelEngine && typeof wheelEngine.drawWheel === 'function') {
      wheelEngine.drawWheel(0);
    }
  }

  function ensureWheelInitialized() {
    if (wheelEngine) return;
    initWheelGame();
    if (wheelEngine && typeof wheelEngine.drawWheel === 'function') {
      window.requestAnimationFrame(function () {
        wheelEngine.drawWheel(0);
      });
      wheelInitRetryCount = 0;
      return;
    }

    if (wheelInitRetryCount < 6) {
      wheelInitRetryCount += 1;
      setTimeout(ensureWheelInitialized, 100);
    } else {
      wheelInitRetryCount = 0;
    }
  }

  function resetWheelGame() {
    window.__supCurrentSpeaker = null;
    window.__supGameQueue = null;
    $winner.textContent = '';
    if (wheelEngine) {
      wheelEngine.setItems(roster);
      if (typeof wheelEngine.drawWheel === 'function') {
        wheelEngine.drawWheel(0);
      }
    } else {
      ensureWheelInitialized();
    }
    renderQueue();
  }

  /* ------------------------------------------------------------------ */
  /*  Game: Embedded iframe                                               */
  /* ------------------------------------------------------------------ */
  function initIframeGame(gameId) {
    var game = GAMES[gameId];
    if (!game || !game.url) return;

    iframeReady = false;
    $gameFrame.src = game.url;

    // When iframe roster sync is needed, send via postMessage
    // (the embed helper in the game listens for this)
  }

  function sendRosterToIframe() {
    if (!$gameFrame || !$gameFrame.contentWindow) return;
    try {
      $gameFrame.contentWindow.postMessage({
        type: 'standup:set-roster',
        roster: roster
      }, '*');
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Game switching                                                     */
  /* ------------------------------------------------------------------ */
  var pendingGameId = null; // tracks which game the loading iframe is for

  function switchGame(gameId) {
    if (!GAMES[gameId]) return;

    // Allow re-clicking the same game to reload it (useful for iframe games)
    var sameGame = currentGameId === gameId;

    // For wheel (inline), skip if already active and engine exists — no reload needed
    if (sameGame && GAMES[gameId].inline && wheelEngine) return;

    currentGameId = gameId;
    saveGameMode(gameId);

    // Update picker UI
    $gameBtns.forEach(function (btn) {
      btn.classList.toggle('sup-game-btn--active', btn.dataset.game === gameId);
      btn.setAttribute('aria-pressed', btn.dataset.game === gameId ? 'true' : 'false');
    });

    // Reset shared state
    window.__supCurrentSpeaker = null;
    window.__supGameQueue = null;
    sessionStartTime = Date.now();

    // Hide Next button for games that don't produce a full order (wheel, trap)
    if ($nextBtn) {
      $nextBtn.style.display = (gameId === 'wheel' || gameId === 'trap') ? 'none' : '';
    }

    if (GAMES[gameId].inline) {
      // Show wheel, hide iframe
      $wheelSection.style.display = '';
      $iframeSection.style.display = 'none';
      $gameFrame.src = ''; // unload any previous iframe
      pendingGameId = null;
      $wheelCard.classList.remove('sup-iframe-active');

      if (!wheelEngine) {
        initWheelGame();
      }
      resetWheelGame();
    } else {
      // Show iframe, hide wheel
      $wheelSection.style.display = 'none';
      $iframeSection.style.display = '';
      $wheelCard.classList.add('sup-iframe-active');

      // If same iframe game, force a full reload by clearing src first
      if (sameGame) {
        $gameFrame.src = '';
        pendingGameId = gameId;
        // Small delay to let the browser clear the old iframe content
        setTimeout(function () {
          if (pendingGameId === gameId) {
            iframeReady = false;
            initIframeGame(gameId);
          }
        }, 30);
      } else {
        iframeReady = false;
        pendingGameId = gameId;
        initIframeGame(gameId);
      }
      renderQueue();
    }

    emitQueueReset();
  }

  /* ------------------------------------------------------------------ */
  /*  New Round                                                          */
  /* ------------------------------------------------------------------ */
  function newRound() {
    sessionStartTime = Date.now();
    window.__supGameQueue = null;

    if (GAMES[currentGameId].inline) {
      resetWheelGame();
    } else {
      // For iframe games — force a full reload of the current iframe
      window.__supCurrentSpeaker = null;
      iframeReady = false;
      pendingGameId = currentGameId;

      var game = GAMES[currentGameId];
      if (game) {
        $gameFrame.src = '';
        setTimeout(function () {
          if (pendingGameId === currentGameId) {
            $gameFrame.src = game.url;
          }
        }, 50);
      }

      renderQueue();
    }

    emitQueueReset();
  }

  /* ------------------------------------------------------------------ */
  /*  postMessage listener (from embedded iframes)                       */
  /* ------------------------------------------------------------------ */
  function handleIframeMessage(event) {
    var data = event.data;
    if (!data || data.source !== 'standup-embed') return;

    // If we're in inline (wheel) mode, ignore all iframe messages
    if (GAMES[currentGameId].inline) return;

    // If a game switch is in progress, only accept messages for the pending game
    if (pendingGameId !== null && pendingGameId !== currentGameId) return;

    switch (data.type) {
      case 'standup:queue': {
        var detail = data.detail || {};
        // Reconstruct the full ordered list from whatever shape the game sends.
        // Games may send: order[], queue[], or completed[] + remaining[].
        var gameOrder = null;
        if (detail.order && detail.order.length) {
          gameOrder = detail.order;
        } else if (detail.queue && detail.queue.length) {
          gameOrder = detail.queue;
        } else if (detail.completed && detail.completed.length) {
          // completed first, then remaining — that's the speaking order
          gameOrder = detail.completed.concat(detail.remaining || []);
        }
        if (gameOrder) {
          window.__supGameQueue = gameOrder;
        }
        // Set current speaker from the game's event
        if (detail.current) {
          window.__supCurrentSpeaker = detail.current;
        } else if (gameOrder && gameOrder.length) {
          window.__supCurrentSpeaker = gameOrder[0];
        }
        renderQueue();
        emitQueueEvents();
        break;
      }
      case 'standup:queue-reset': {
        window.__supCurrentSpeaker = null;
        window.__supGameQueue = null;
        renderQueue();
        emitQueueReset();
        break;
      }
      case 'standup:embed-ready': {
        iframeReady = true;
        pendingGameId = null; // loading is complete
        // Send the current roster to the newly loaded iframe
        sendRosterToIframe();
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Event bindings                                                     */
  /* ------------------------------------------------------------------ */
  function bindEvents() {
    // Game picker buttons
    $gameBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchGame(btn.dataset.game);
      });
    });

    // Timer presets
    $presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTimerDuration(parseInt(btn.dataset.seconds, 10));
      });
    });

    $timerStartBtn.addEventListener('click', startTimer);
    $timerPauseBtn.addEventListener('click', function () { stopTimer(false); });
    $timerResetBtn.addEventListener('click', resetTimer);
    $timerMin.addEventListener('change', syncTimerFromInputs);
    $timerSec.addEventListener('change', syncTimerFromInputs);
    $resetBtn.addEventListener('click', newRound);

    // Next button
    if ($nextBtn) {
      $nextBtn.addEventListener('click', advanceQueue);
    }

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

    // Roster changes from other tabs
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) {
        roster = loadRoster();
        if (GAMES[currentGameId].inline) {
          if (wheelEngine) wheelEngine.setItems(roster);
        } else {
          sendRosterToIframe();
        }
        renderQueue();
      }
    });

    // postMessage from iframes
    window.addEventListener('message', handleIframeMessage);
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    roster = loadRoster();
    currentGameId = loadSavedGame();

    renderStats();
    bindEvents();
    switchGame(currentGameId);
    ensureWheelInitialized();
    updateTimerDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
