(function () {
  const STORAGE_KEYS = {
    names: 'namesList',
    assignments: 'integrationAssignments',
    client: 'integrationClientId',
    notes: 'standupNotes',
  };

  const SERVICE_LABELS = {
    jira: 'Jira',
    trello: 'Trello',
    github: 'GitHub',
  };

  const DEFAULT_STATE = {
    loading: false,
    error: null,
    lastSyncedAt: null,
  };

  const subscribers = new Set();

  let loading = false;
  let error = null;
  let lastSyncedAt = null;
  let notesStore = loadNotes();
  let playerDirectory = new Map();
  let playerOrder = [];
  let assignmentsByPlayer = new Map();
  let unassignedItems = [];
  let servicesSummary = [];
  let pendingRefresh = null;

  function normalizeName(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.notes);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.warn('[StandupData] Unable to read notes from storage', err);
      return {};
    }
  }

  function persistNotes() {
    try {
      localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notesStore));
    } catch (err) {
      console.warn('[StandupData] Unable to persist notes', err);
    }
  }

  function loadNamesList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.names);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string' && name.trim()) : [];
    } catch (err) {
      console.warn('[StandupData] Failed to parse saved names', err);
      return [];
    }
  }

  function loadAssignmentSnapshots() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.assignments);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.warn('[StandupData] Failed to parse assignment snapshots', err);
      return {};
    }
  }

  function loadClientId() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.client);
      return raw && raw.trim().length ? raw.trim() : '';
    } catch (err) {
      console.warn('[StandupData] Unable to read integration client id', err);
      return '';
    }
  }

  function addPlayer(name) {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const key = normalizeName(trimmed);
    if (!key) return null;
    if (!playerDirectory.has(key)) {
      playerDirectory.set(key, trimmed);
      playerOrder.push(trimmed);
    }
    return playerDirectory.get(key);
  }

  function ensureAssignmentEntry(key, displayName) {
    if (!assignmentsByPlayer.has(key)) {
      assignmentsByPlayer.set(key, {
        player: displayName || playerDirectory.get(key) || key,
        items: [],
      });
    } else if (displayName && assignmentsByPlayer.get(key).player !== displayName) {
      const entry = assignmentsByPlayer.get(key);
      entry.player = displayName;
    }
    return assignmentsByPlayer.get(key);
  }

  function formatServiceLabel(service) {
    return SERVICE_LABELS[service] || service.charAt(0).toUpperCase() + service.slice(1);
  }

  function normalizeAssignmentItem(service, item) {
    if (!item || typeof item !== 'object') return null;
    const title = item.summary || item.title || item.name || item.key || (item.number != null ? `#${item.number}` : '') || 'Untitled';
    const status = item.status || item.state || '';
    const url = item.url || item.html_url || '';
    const rawId = item.key || item.id || item.number || item.name || item.title || title;
    const shortId = item.key || (item.number != null ? `#${item.number}` : null);

    return {
      id: rawId ? `${service}:${String(rawId)}` : undefined,
      title: String(title).slice(0, 160),
      status: status ? String(status).slice(0, 80) : '',
      url: url || '',
      shortId: shortId ? String(shortId).slice(0, 40) : null,
      service,
      type: service === 'trello' ? 'Card' : 'Issue',
      listId: item.listId || null,
      updated: item.updated || item.updated_at || null,
    };
  }

  function normalizeUnassignedItem(service, item) {
    const normalized = normalizeAssignmentItem(service, item);
    if (!normalized) return null;
    normalized.assignee = null;
    normalized.unassigned = true;
    return normalized;
  }

  function deriveUnassigned(service, payload) {
    const result = [];
    if (!payload || typeof payload !== 'object') {
      return result;
    }

    if (Array.isArray(payload.issues)) {
      payload.issues.forEach((issue) => {
        if (!issue || typeof issue !== 'object') return;
        if (issue.assignee) return;
        const normalized = normalizeUnassignedItem(service, issue);
        if (normalized) {
          result.push(normalized);
        }
      });
    }

    if (Array.isArray(payload.cards)) {
      payload.cards.forEach((card) => {
        if (!card || typeof card !== 'object') return;
        const memberIds = Array.isArray(card.memberIds) ? card.memberIds : card.idMembers;
        if (Array.isArray(memberIds) && memberIds.length) return;
        const normalized = normalizeUnassignedItem(service, card);
        if (normalized) {
          result.push(normalized);
        }
      });
    }

    return result;
  }

  function integrateServiceData(service, payload, source = 'snapshot', summarySeed = {}) {
    const players = Array.isArray(payload?.players) ? payload.players : [];
    players.forEach(addPlayer);

    let assignmentCount = 0;
    if (Array.isArray(payload?.assignments)) {
      payload.assignments.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const playerName = typeof entry.player === 'string' ? entry.player : '';
        const key = normalizeName(playerName);
        if (!key) return;
        const canonical = addPlayer(playerName) || playerName || key;
        const target = ensureAssignmentEntry(key, canonical);
        const items = Array.isArray(entry.items) ? entry.items : [];
        items.forEach((item) => {
          const normalizedItem = normalizeAssignmentItem(service, item);
          if (!normalizedItem) return;
          assignmentCount += 1;
          target.items.push(normalizedItem);
        });
      });
    }

    const unassigned = deriveUnassigned(service, payload);
    if (unassigned.length) {
      unassignedItems.push(...unassigned);
    }

    const summary = {
      service,
      label: summarySeed.label || formatServiceLabel(service),
      assignments: assignmentCount,
      unassigned: unassigned.length,
      source,
      error: summarySeed.error || null,
      lastUpdated: payload?.fetchedAt || payload?.lastUpdated || summarySeed.lastUpdated || null,
      includeAssignments: summarySeed.includeAssignments !== undefined ? summarySeed.includeAssignments : true,
      enabled: summarySeed.enabled !== undefined ? summarySeed.enabled : true,
    };

    servicesSummary.push(summary);
  }

  function resetAggregates() {
    playerDirectory = new Map();
    playerOrder = [];
    assignmentsByPlayer = new Map();
    unassignedItems = [];
    servicesSummary = [];
  }

  function buildSnapshot() {
    const assignments = {};
    assignmentsByPlayer.forEach((entry, key) => {
      assignments[key] = {
        player: entry.player,
        items: entry.items.slice(0, 50),
      };
    });

    const playerMap = {};
    playerDirectory.forEach((value, key) => {
      playerMap[key] = value;
    });

    return {
      ...DEFAULT_STATE,
      loading,
      error,
      lastSyncedAt,
      players: playerOrder.slice(0, 200),
      playerDirectory: playerMap,
      assignments,
      unassigned: unassignedItems.slice(0, 50),
      services: servicesSummary.slice(0, 10),
      notes: { ...notesStore },
    };
  }

  function notify() {
    const snapshot = buildSnapshot();
    subscribers.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[StandupData] Subscriber error', err);
      }
    });
    window.dispatchEvent(new CustomEvent('standup:data', { detail: snapshot }));
  }

  function rebuildFromSources(sources) {
    resetAggregates();
    const savedNames = loadNamesList();
    savedNames.forEach(addPlayer);

    const snapshots = loadAssignmentSnapshots();
    Object.entries(snapshots).forEach(([service, payload]) => {
      if (sources.has(service)) return;
      sources.set(service, {
        data: payload,
        source: 'snapshot',
        summary: { label: formatServiceLabel(service) },
      });
    });

    sources.forEach((entry, service) => {
      if (!entry || !entry.data) {
        const summarySeed = entry?.summary || { label: formatServiceLabel(service) };
        servicesSummary.push({
          service,
          label: summarySeed.label,
          assignments: 0,
          unassigned: 0,
          source: entry?.source || 'unknown',
          error: entry?.error || summarySeed.error || null,
          lastUpdated: summarySeed.lastUpdated || null,
          includeAssignments: summarySeed.includeAssignments !== undefined ? summarySeed.includeAssignments : true,
          enabled: summarySeed.enabled !== undefined ? summarySeed.enabled : true,
        });
        return;
      }
      integrateServiceData(service, entry.data, entry.source, {
        ...entry.summary,
        error: entry.error,
      });
    });

    notify();
  }

  function initialize() {
    const snapshots = loadAssignmentSnapshots();
    const sources = new Map();
    Object.entries(snapshots).forEach(([service, payload]) => {
      sources.set(service, {
        data: payload,
        source: 'snapshot',
        summary: { label: formatServiceLabel(service) },
      });
    });
    rebuildFromSources(sources);
  }

  async function refresh(force = false) {
    if (loading && !force && pendingRefresh) {
      return pendingRefresh;
    }
    const clientId = loadClientId();
    if (!clientId) {
      error = null;
      lastSyncedAt = null;
      rebuildFromSources(new Map());
      return buildSnapshot();
    }

    loading = true;
    error = null;
    notify();

    const controller = new AbortController();
    const fetchServices = async () => {
      const sources = new Map();
      try {
        const response = await fetch('/api/integrations/config', {
          headers: { 'X-Integration-Client': clientId },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Unable to load integration configuration.');
        }
        const body = await response.json();
        const services = body?.services && typeof body.services === 'object' ? body.services : {};
        const fetchPromises = Object.entries(services).map(async ([service, config]) => {
          const summarySeed = {
            label: formatServiceLabel(service),
            includeAssignments: Boolean(config?.includeAssignments),
            enabled: Boolean(config?.enabled),
            lastUpdated: config?.lastUpdated || null,
          };

          if (!config?.enabled) {
            sources.set(service, {
              data: null,
              source: 'disabled',
              summary: summarySeed,
              error: 'Integration disabled',
            });
            return;
          }

          if (!config?.includeAssignments) {
            sources.set(service, {
              data: null,
              source: 'disabled',
              summary: summarySeed,
              error: 'Assignments disabled in settings',
            });
            return;
          }

          try {
            const pullResponse = await fetch(`/api/integrations/${service}/pull`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Integration-Client': clientId,
              },
              body: JSON.stringify({ includeAssignments: true }),
            });
            if (!pullResponse.ok) {
              const text = await pullResponse.text();
              throw new Error(text || 'Failed to fetch assignments.');
            }
            const payload = await pullResponse.json();
            const data = payload?.data || {};
            sources.set(service, {
              data,
              source: 'live',
              summary: summarySeed,
            });
          } catch (serviceError) {
            console.warn(`[StandupData] ${service} refresh failed`, serviceError);
            sources.set(service, {
              data: null,
              source: 'error',
              summary: summarySeed,
              error: serviceError?.message || 'Unable to refresh.',
            });
          }
        });
        await Promise.all(fetchPromises);
      } catch (configError) {
        console.error('[StandupData] Refresh failed', configError);
        error = configError?.message || 'Unable to refresh assignments right now.';
      }

      const snapshots = loadAssignmentSnapshots();
      Object.entries(snapshots).forEach(([service, payload]) => {
        if (sources.has(service) && sources.get(service).data) {
          return;
        }
        const existing = sources.get(service);
        sources.set(service, {
          data: payload,
          source: existing?.source === 'live' ? 'live' : 'snapshot',
          summary: existing?.summary || { label: formatServiceLabel(service) },
          error: existing?.error || null,
        });
      });

      rebuildFromSources(sources);
      loading = false;
      lastSyncedAt = error ? lastSyncedAt : new Date().toISOString();
      notify();
      return buildSnapshot();
    };

    pendingRefresh = fetchServices().finally(() => {
      loading = false;
      pendingRefresh = null;
    });

    return pendingRefresh;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    subscribers.add(listener);
    try {
      listener(buildSnapshot());
    } catch (err) {
      console.error('[StandupData] Subscriber execution failed', err);
    }
    return () => {
      subscribers.delete(listener);
    };
  }

  function getNote(name) {
    const key = normalizeName(name);
    return key && notesStore[key] ? notesStore[key] : '';
  }

  function setNote(name, value) {
    const key = normalizeName(name);
    if (!key) return;
    if (!value || !String(value).trim()) {
      if (key in notesStore) {
        delete notesStore[key];
        persistNotes();
        notify();
      }
      return;
    }
    notesStore[key] = String(value).slice(0, 2000);
    persistNotes();
    notify();
  }

  function clearNotes() {
    notesStore = {};
    persistNotes();
    notify();
  }

  initialize();

  window.dailyPickStandup = {
    subscribe,
    refresh,
    getSnapshot: buildSnapshot,
    getNote,
    setNote,
    clearNotes,
  };
})();
