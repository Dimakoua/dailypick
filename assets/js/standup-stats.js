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
   */
  function saveSession({ ts, game, order }) {
    if (!ts || !game || !Array.isArray(order) || order.length === 0) {
      console.warn('Invalid session data:', { ts, game, order });
      return;
    }
    
    const sessions = loadSessions();
    sessions.unshift({ ts, game, order }); // Prepend
    
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
   * Returns: [{ game, count }, ...] sorted by count descending
   */
  function computeGameStats(sessions = null) {
    if (!sessions) sessions = loadSessions();
    
    const gameMap = {};
    sessions.forEach(session => {
      const { game } = session;
      gameMap[game] = (gameMap[game] || 0) + 1;
    });

    const result = Object.keys(gameMap).map(game => ({
      game,
      count: gameMap[game]
    }));

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
        
        saveSession({
          ts: currentSession.startTime,
          game: currentSession.source,
          order: finalOrder
        });

        console.log(`[StandupStats] Auto-saved ${currentSession.source} session with ${finalOrder.length} participants`);

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
    getThisMonth,
    getMostFirstSpeaker,
    formatDate,
    getRecentSessions
  };
})();
