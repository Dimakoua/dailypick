export class MimicGameSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
    this.leaderboard = [];

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('leaderboard');
      if (Array.isArray(stored)) {
        this.leaderboard = stored;
      }
    });
  }

  async fetch(request) {
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

    server.send(JSON.stringify({ type: 'user-id', id: clientId }));
    this.sendLeaderboard(server);
    this.broadcastUserList();

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleClientMessage(clientId, data);
      } catch (err) {
        console.error('[MimicGameSession] Failed to parse message', err);
      }
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      this.broadcastUserList();
    });
  }

  handleClientMessage(clientId, data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'set-name':
        this.updateClientName(clientId, data.name);
        break;
      case 'report-score':
        this.recordScore(clientId, data);
        break;
      default:
        break;
    }
  }

  updateClientName(clientId, rawName) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const name = this.sanitizeName(rawName);
    client.name = name;
    this.broadcastUserList();
  }

  recordScore(clientId, payload) {
    if (!payload || typeof payload.reactionTime !== 'number' || payload.reactionTime <= 0) {
      return;
    }

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
    const users = Array.from(this.clients.entries()).map(([id, data]) => ({ id, name: data.name || 'Player' }));
    this.broadcast({ type: 'user-list', users });
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
}
