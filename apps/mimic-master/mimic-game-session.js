import { BaseEphemeralDO } from '../../packages/shared/base-ephemeral-do.js';

export class MimicGameSession extends BaseEphemeralDO {
  constructor(state, env) {
    super(state, env, { deleteAllOnCleanup: false }); // Keep leaderboard persistent
    this.clients = new Map();
    this.leaderboard = [];
    this.playersWhoPlayed = new Set(); // Track who has played in current session
    this.hostId = null;

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('leaderboard');
      if (Array.isArray(stored)) {
        this.leaderboard = stored;
      }
    });
  }

  async fetch(request) {
    await this.markActive();
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade.', { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(server) {
    server.accept();

    const clientId = crypto.randomUUID();
    this.clients.set(clientId, { ws: server, name: null });
    this.markActive().catch((error) => console.error('[MimicGameSession] markActive failed', error));

    if (this.hostId === null) {
      this.hostId = clientId;
    }

    server.send(JSON.stringify({ type: 'user-id', id: clientId }));
    this.sendLeaderboard(server);
    this.broadcastUserList();
    this.broadcastHostStatus();

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleClientMessage(clientId, data);
        this.markActive().catch((error) => console.error('[MimicGameSession] markActive failed', error));
      } catch (err) {
        console.error('[MimicGameSession] Failed to parse message', err);
      }
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      if (this.hostId === clientId) {
        this.hostId = null;
        if (this.clients.size > 0) {
          this.hostId = this.clients.keys().next().value;
        }
        this.broadcastHostStatus();
      }
      this.broadcastUserList();
      if (this.clients.size === 0) {
        this.markInactive().catch((error) => console.error('[MimicGameSession] markInactive failed', error));
      } else {
        this.markActive().catch((error) => console.error('[MimicGameSession] markActive failed', error));
      }
    });
  }

  handleClientMessage(clientId, data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'set-name':
        this.updateClientName(clientId, data.name, data.isHost);
        break;
      case 'report-score':
        this.recordScore(clientId, data);
        break;
      case 'game-start':
        if (clientId === this.hostId) {
          // If targetPlayers is specified, only start for those players
          // Otherwise, start for all players who haven't played yet
          const targetPlayers = data.targetPlayers || this.getPlayersWhoHaventPlayed();
          this.broadcast({ type: 'game-start', targetPlayers });
        }
        break;
      case 'reset-session':
        // Allow host to reset who has played (for new round with everyone)
        if (clientId === this.hostId) {
          this.playersWhoPlayed.clear();
          this.broadcast({ type: 'session-reset' });
        }
        break;
      case 'clear-leaderboard':
        // Allow host to clear leaderboard if needed
        if (clientId === this.hostId) {
          this.leaderboard = [];
          this.playersWhoPlayed.clear();
          this.broadcast({ type: 'leaderboard', entries: [] });
          this.state.storage.put('leaderboard', []).catch((err) => {
            console.error('[MimicGameSession] Failed to clear leaderboard', err);
          });
        }
        break;
      default:
        break;
    }
  }

  getPlayersWhoHaventPlayed() {
    const allPlayers = Array.from(this.clients.keys());
    return allPlayers.filter(id => !this.playersWhoPlayed.has(id));
  }

  updateClientName(clientId, rawName, isHost = false) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const name = this.sanitizeName(rawName);
    client.name = name;
    if (isHost) {
      this.hostId = clientId;
      this.broadcastHostStatus();
    }
    this.broadcastUserList();
  }

  recordScore(clientId, payload) {
    if (!payload || typeof payload.reactionTime !== 'number' || payload.reactionTime <= 0) {
      return;
    }

    // Mark this player as having played
    this.playersWhoPlayed.add(clientId);

    const client = this.clients.get(clientId);
    const fallbackName = client?.name || this.sanitizeName(payload.name) || 'Player';
    const name = this.sanitizeName(fallbackName);
    if (!name) return;

    const reactionTime = Math.round(payload.reactionTime);
    const promptLabel = typeof payload.promptLabel === 'string' ? payload.promptLabel.slice(0, 16) : '';

    let entry = this.leaderboard.find((item) => item.name === name);
    if (!entry) {
      entry = {
        name,
        bestTime: reactionTime,
        attempts: 1,
        lastPrompt: promptLabel,
        updatedAt: Date.now()
      };
      this.leaderboard.push(entry);
    } else {
      entry.bestTime = Math.min(entry.bestTime, reactionTime);
      entry.attempts = (entry.attempts || 0) + 1;
      entry.lastPrompt = promptLabel;
      entry.updatedAt = Date.now();
    }

    this.leaderboard.sort((a, b) => {
      const timeDiff = (a.bestTime ?? Number.MAX_SAFE_INTEGER) - (b.bestTime ?? Number.MAX_SAFE_INTEGER);
      if (timeDiff !== 0) return timeDiff;
      return a.updatedAt - b.updatedAt;
    });

    if (this.leaderboard.length > 50) {
      this.leaderboard = this.leaderboard.slice(0, 50);
    }

    this.broadcast({ type: 'leaderboard', entries: this.leaderboard });
    this.state.storage.put('leaderboard', this.leaderboard).catch((err) => {
      console.error('[MimicGameSession] Failed to persist leaderboard', err);
    });
  }

  sendLeaderboard(target) {
    const payload = JSON.stringify({ type: 'leaderboard', entries: this.leaderboard });
    try {
      target.send(payload);
    } catch (err) {
      console.error('[MimicGameSession] Failed to send leaderboard', err);
    }
  }

  broadcastUserList() {
    const users = Array.from(this.clients.entries()).map(([id, data]) => ({ 
      id, 
      name: data.name || 'Player',
      hasPlayed: this.playersWhoPlayed.has(id)
    }));
    this.broadcast({ type: 'user-list', users });
  }

  broadcastHostStatus() {
    this.broadcast({ type: 'host-status', hostId: this.hostId });
  }

  broadcast(message) {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of this.clients.values()) {
      try {
        client.ws.send(text);
      } catch (err) {
        console.error('[MimicGameSession] Broadcast failed', err);
      }
    }
  }

  sanitizeName(value) {
    if (!value) return '';
    return String(value)
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32);
  }

  async onBeforeCleanup() {
    this.clients.clear();
    // Keep leaderboard persistent - don't clear it
    this.playersWhoPlayed.clear();
    this.hostId = null;
  }
}
