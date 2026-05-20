/**
 * Standup Stats Engine
 * Tracks and derives insights from standup session data stored in localStorage
 */

(function() {
  const STORAGE_KEY = 'dp_standup_stats';
  const RETENTION_DAYS = 90;

  /**
   * Prune sessions older than retention period
   */
  function pruneOlderThan(days = RETENTION_DAYS) {
    const sessions = loadSessions();
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    const filtered = sessions.filter(s => s.ts > cutoffMs);
    if (filtered.length !== sessions.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  }

  /**
   * Load all sessions from localStorage
   */
  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to load standup stats:', err);
      return [];
    }
  }

  /**
   * Save a new session and auto-prune old ones
   * @param {Object} session - { ts, game, order, duration? }
   * @param {number} session.ts - Timestamp when session started
   * @param {string} session.game - Game/app source
   * @param {Array} session.order - Speaker order
   * @param {number} session.duration - Session duration in milliseconds (optional)
   */
  function saveSession({ ts, game, order, duration }) {
    if (!ts || !game || !Array.isArray(order) || order.length === 0) {
      console.warn('Invalid session data:', { ts, game, order });
      return;
    }
    
    const sessions = loadSessions();
    const sessionData = { ts, game, order };
    if (typeof duration === 'number' && duration > 0) {
      sessionData.duration = duration;
    }
    sessions.unshift(sessionData); // Prepend
    
    // Auto-prune during save
    const cutoffMs = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const pruned = sessions.filter(s => s.ts > cutoffMs);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  }

  /**
   * Manually prune sessions and save
   */
  function manualPrune(days) {
    const sessions = loadSessions();
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    const filtered = sessions.filter(s => s.ts > cutoffMs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  }

  /**
   * Clear all stats
   */
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get storage info
   */
  function getStorageInfo() {
    const sessions = loadSessions();
    const jsonStr = JSON.stringify(sessions);
    const bytes = new Blob([jsonStr]).size;
    return { count: sessions.length, bytes };
  }

  /**
   * Compute per-person stats
   * Returns: [{ name, sessions, first, last, avgPos, lastSeen }, ...]
   */
  function computePersonStats(sessions = null) {
    if (!sessions) sessions = loadSessions();
    
    const personMap = {}; // name -> { sessions: count, first: count, last: count, positions: [], lastTs: number }

    sessions.forEach(session => {
      const { order, ts } = session;
      order.forEach((name, index) => {
        if (!personMap[name]) {
          personMap[name] = { sessions: 0, first: 0, last: 0, positions: [], lastTs: 0 };
        }
        personMap[name].sessions++;
        personMap[name].positions.push(index + 1); // 1-indexed
        personMap[name].lastTs = Math.max(personMap[name].lastTs, ts);
        
        if (index === 0) personMap[name].first++;
        if (index === order.length - 1) personMap[name].last++;
      });
    });

    // Convert to array and compute averages
    const result = Object.keys(personMap).map(name => {
      const stats = personMap[name];
      const avgPos = stats.positions.length > 0
        ? (stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length).toFixed(1)
        : 0;
      return {
        name,
        sessions: stats.sessions,
        first: stats.first,
        last: stats.last,
        avgPos: parseFloat(avgPos),
        lastSeen: stats.lastTs
      };
    });

    // Sort by sessions (descending)
    result.sort((a, b) => b.sessions - a.sessions);
    return result;
  }

  /**
   * Compute per-game stats
   * Returns: [{ game, count, avgDuration }, ...] sorted by count descending
   */
  function computeGameStats(sessions = null) {
    if (!sessions) sessions = loadSessions();
    
    const gameMap = {};
    sessions.forEach(session => {
      const { game, duration } = session;
      if (!gameMap[game]) {
        gameMap[game] = { count: 0, totalDuration: 0, durationCount: 0 };
      }
      gameMap[game].count++;
      if (typeof duration === 'number' && duration > 0) {
        gameMap[game].totalDuration += duration;
        gameMap[game].durationCount++;
      }
    });

    const result = Object.keys(gameMap).map(game => {
      const stats = gameMap[game];
      const avgDuration = stats.durationCount > 0
        ? Math.round(stats.totalDuration / stats.durationCount)
        : null;
      return {
        game,
        count: stats.count,
        avgDuration
      };
    });

    result.sort((a, b) => b.count - a.count);
    return result;
  }

  /**
   * Compute consecutive calendar day streak
   * Returns: number of consecutive days from today backwards with at least one session
   */
  function computeStreak(sessions = null) {
    if (!sessions) sessions = loadSessions();
    if (sessions.length === 0) return 0;

    // Group sessions by calendar day (UTC)
    const daySet = new Set();
    sessions.forEach(session => {
      const date = new Date(session.ts);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      daySet.add(dayKey);
    });

    const days = Array.from(daySet).sort().reverse(); // Newest first
    
    let streak = 0;
    let checkDate = new Date();
    checkDate.setUTCHours(0, 0, 0, 0);

    while (true) {
      const dayKey = checkDate.toISOString().split('T')[0];
      if (daySet.has(dayKey)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get sessions from this month (last 30 days)
   */
  function getThisMonth(sessions = null) {
    if (!sessions) sessions = loadSessions();
    const cutoffMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return sessions.filter(s => s.ts > cutoffMs);
  }

  /**
   * Get most frequent first speaker
   */
  function getMostFirstSpeaker(sessions = null) {
    if (!sessions) sessions = loadSessions();
    const firstMap = {};
    sessions.forEach(session => {
      const { order } = session;
      if (order.length > 0) {
        const firstName = order[0];
        firstMap[firstName] = (firstMap[firstName] || 0) + 1;
      }
    });

    let topName = null;
    let topCount = 0;
    Object.keys(firstMap).forEach(name => {
      if (firstMap[name] > topCount) {
        topCount = firstMap[name];
        topName = name;
      }
    });

    return topName ? { name: topName, count: topCount } : null;
  }

  /**
   * Format a timestamp as a readable date
   */
  function formatDate(ts) {
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Compute average session duration across all sessions
   * Returns: { avgDuration: ms, count: number } or null if no data
   */
  function computeAverageSessionDuration(sessions = null) {
    if (!sessions) sessions = loadSessions();
    
    const withDuration = sessions.filter(s => typeof s.duration === 'number' && s.duration > 0);
    if (withDuration.length === 0) return null;
    
    const totalDuration = withDuration.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = Math.round(totalDuration / withDuration.length);
    
    return {
      avgDuration,
      count: withDuration.length,
      formattedAvg: formatDuration(avgDuration)
    };
  }

  /**
   * Compute average session duration per game
   * Returns: { game, avgDuration, count } for games with duration data
   */
  function computeAverageDurationPerGame(sessions = null) {
    if (!sessions) sessions = loadSessions();
    
    const gameMap = {};
    sessions.forEach(session => {
      const { game, duration } = session;
      if (typeof duration === 'number' && duration > 0) {
        if (!gameMap[game]) {
          gameMap[game] = { total: 0, count: 0 };
        }
        gameMap[game].total += duration;
        gameMap[game].count++;
      }
    });

    const result = Object.keys(gameMap).map(game => {
      const stats = gameMap[game];
      const avgDuration = Math.round(stats.total / stats.count);
      return {
        game,
        avgDuration,
        formattedAvg: formatDuration(avgDuration),
        count: stats.count
      };
    });

    result.sort((a, b) => b.count - a.count);
    return result;
  }

  /**
   * Format duration in milliseconds to readable string
   * Returns: "1m 23s" or "45s"
   */
  function formatDuration(ms) {
    if (typeof ms !== 'number' || ms < 0) return '0s';
    
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes === 0) {
      return secs + 's';
    }
    return minutes + 'm ' + (secs < 10 ? '0' : '') + secs + 's';
  }

  /**
   * Get recent sessions (last N)
   */
  function getRecentSessions(limit = 10, sessions = null) {
    if (!sessions) sessions = loadSessions();
    return sessions.slice(0, limit);
  }

  /**
   * Auto-collection of standup stats
   * Listens to standup:queue events and saves completed sessions automatically
   */
  function initAutoCollection() {
    let currentSession = {
      participants: [],
      completed: [],
      source: null,
      startTime: null
    };

    /**
     * Check if a session is complete (all participants have been selected)
     */
    function isSessionComplete() {
      if (!currentSession.participants || currentSession.participants.length === 0) {
        return false;
      }
      if (!currentSession.completed || currentSession.completed.length === 0) {
        return false;
      }
      // Session is complete when all participants have been selected
      return currentSession.completed.length >= currentSession.participants.length;
    }

    /**
     * Normalize name for comparison
     */
    function normalizeName(name) {
      return typeof name === 'string' ? name.trim().toLowerCase() : '';
    }

    /**
     * Check if two name lists are equal (case-insensitive, order-sensitive)
     */
    function namesEqual(list1, list2) {
      if (!Array.isArray(list1) || !Array.isArray(list2)) return false;
      if (list1.length !== list2.length) return false;
      return list1.every((name, idx) => normalizeName(name) === normalizeName(list2[idx]));
    }

    /**
     * Auto-save session when complete
     */
    function autoSaveIfComplete() {
      if (isSessionComplete() && currentSession.source && currentSession.startTime) {
        // Create the final order from completed participants
        const finalOrder = Array.from(currentSession.completed);
        const duration = Date.now() - currentSession.startTime;
        
        saveSession({
          ts: currentSession.startTime,
          game: currentSession.source,
          order: finalOrder,
          duration: duration
        });

        const formattedTime = formatDuration(duration);
        console.log(`[StandupStats] Auto-saved ${currentSession.source} session with ${finalOrder.length} participants (${formattedTime})`);

        // Reset for next session
        currentSession = {
          participants: [],
          completed: [],
          source: null,
          startTime: null
        };
      }
    }

    // Listen for queue updates
    window.addEventListener('standup:queue', (event) => {
      const detail = event.detail || {};
      const { source, participants, completed } = detail;

      if (!source || !participants) return;

      // Initialize or update session
      if (!currentSession.source || currentSession.source !== source) {
        currentSession = {
          participants: Array.from(participants || []),
          completed: Array.from(completed || []),
          source: source,
          startTime: currentSession.startTime || Date.now()
        };
      } else {
        // Update completed list
        if (completed && Array.isArray(completed)) {
          currentSession.completed = Array.from(completed);
        }
      }

      // Auto-save if complete
      autoSaveIfComplete();
    });

    // Reset tracking on queue reset
    window.addEventListener('standup:queue-reset', (event) => {
      const detail = event.detail || {};
      const { source, participants } = detail;

      if (source) {
        currentSession = {
          participants: Array.from(participants || []),
          completed: [],
          source: source,
          startTime: Date.now()
        };
      }
    });
  }

  // Initialize auto-collection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoCollection);
  } else {
    initAutoCollection();
  }

  // Expose public API
  window.standupStats = {
    saveSession,
    loadSessions,
    pruneOlderThan: manualPrune,
    clearAll,
    getStorageInfo,
    computePersonStats,
    computeGameStats,
    computeStreak,
    computeAverageSessionDuration,
    computeAverageDurationPerGame,
    getThisMonth,
    getMostFirstSpeaker,
    formatDate,
    formatDuration,
    getRecentSessions
  };
})();
