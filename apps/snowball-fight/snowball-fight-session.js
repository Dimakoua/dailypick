import { BaseEphemeralDO } from '../../packages/shared/base-ephemeral-do.js';

export class SnowballFightSession extends BaseEphemeralDO {
  constructor(state, env) {
    super(state, env, { deleteAllOnCleanup: false }); // Keep leaderboard persistent
    this.clients = new Map(); // { clientId -> { ws, name, isAlive, position, health } }
    this.deathOrder = []; // Players who died, ordered by death time
    this.hostId = null;
    this.gameState = 'lobby'; // lobby, playing, finished
    this.gameStartTime = null;
    this.projectiles = []; // Shared snowballs in flight
    this.nextProjectileId = 0;
    this.lastMarkActiveTime = 0; // Throttle markActive calls
    this.lastGameWinner = null; // Winner of last finished game
    this.lastGameStandings = []; // Final standings of last finished game

    // Load persisted death order leaderboard
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('deathOrder');
      if (Array.isArray(stored)) {
        this.deathOrder = stored;
      }
    });
  }

  // Throttled markActive - only call every 30 seconds
  async throttledMarkActive() {
    const now = Date.now();
    if (now - this.lastMarkActiveTime > 30000) {
      this.lastMarkActiveTime = now;
      await this.markActive();
    }
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
    this.clients.set(clientId, {
      ws: server,
      name: null,
      isAlive: true,
      position: { x: 0, y: 0 },
      health: 5,
      kills: 0
    });
    this.throttledMarkActive().catch((error) => console.error('[SnowballFightSession] markActive failed', error));

    // First client becomes host
    if (this.hostId === null) {
      this.hostId = clientId;
    }

    server.send(JSON.stringify({ type: 'user-id', id: clientId }));
    server.send(JSON.stringify({ type: 'game-state', state: this.gameState }));
    this.sendDeathOrderLeaderboard(server);
    
    // Send final results if reconnecting to finished game
    if (this.gameState === 'finished' && this.lastGameStandings.length > 0) {
      server.send(JSON.stringify({
        type: 'game-end',
        winner: this.lastGameWinner,
        finalStandings: this.lastGameStandings,
        deathOrder: this.deathOrder.slice(0, 10)
      }));
    }
    
    this.broadcastPlayerList();
    this.broadcastHostStatus();

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleClientMessage(clientId, data);
        this.throttledMarkActive().catch((error) => console.error('[SnowballFightSession] markActive failed', error));
      } catch (err) {
        console.error('[SnowballFightSession] Failed to parse message', err);
      }
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      
      // Transfer host if needed
      if (this.hostId === clientId) {
        this.hostId = null;
        if (this.clients.size > 0) {
          this.hostId = this.clients.keys().next().value;
        }
        this.broadcastHostStatus();
      }

      this.broadcastPlayerList();
      
      if (this.clients.size === 0) {
        this.markInactive().catch((error) => console.error('[SnowballFightSession] markInactive failed', error));
      } else {
        this.markActive().catch((error) => console.error('[SnowballFightSession] markActive failed', error));
      }
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

      case 'start-game':
        if (clientId === this.hostId && this.gameState === 'lobby') {
          this.startGame();
        }
        break;

      case 'player-move':
        this.updatePlayerPosition(clientId, data.position);
        break;

      case 'throw-snowball':
        this.createProjectile(clientId, data.direction, data.position);
        break;

      case 'player-hit':
        this.handlePlayerHit(data.victimId, data.attackerId);
        break;

      case 'reset-game':
        if (clientId === this.hostId) {
          this.resetGame();
        }
        break;

      case 'clear-leaderboard':
        if (clientId === this.hostId) {
          this.clearLeaderboard();
        }
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
    this.broadcastPlayerList();
  }

  startGame() {
    this.gameState = 'playing';
    this.gameStartTime = Date.now();
    this.currentGameDeaths = []; // Track deaths for this game only
    
    // Reset all players
    for (const [id, client] of this.clients.entries()) {
      client.isAlive = true;
      client.health = 5;
      client.kills = 0;
    }

    this.broadcast({ type: 'game-start', timestamp: this.gameStartTime });
    this.broadcastPlayerList();
  }

  updatePlayerPosition(clientId, position) {
    const client = this.clients.get(clientId);
    if (!client || !client.isAlive) return;

    client.position = {
      x: Math.max(0, Math.min(800, position.x)),
      y: Math.max(0, Math.min(600, position.y))
    };

    this.broadcast({
      type: 'player-position',
      playerId: clientId,
      position: client.position
    });
  }

  createProjectile(clientId, direction, position) {
    const client = this.clients.get(clientId);
    if (!client || !client.isAlive) return;

    const projectile = {
      id: this.nextProjectileId++,
      ownerId: clientId,
      position: { ...position },
      velocity: {
        x: direction.x * 8,
        y: direction.y * 8
      },
      createdAt: Date.now()
    };

    this.projectiles.push(projectile);

    this.broadcast({
      type: 'projectile-created',
      projectile
    });

    // Auto-remove old projectiles after 5 seconds
    setTimeout(() => {
      const index = this.projectiles.findIndex(p => p.id === projectile.id);
      if (index !== -1) {
        this.projectiles.splice(index, 1);
      }
    }, 5000);
  }

  handlePlayerHit(victimId, attackerId) {
    const victim = this.clients.get(victimId);
    const attacker = this.clients.get(attackerId);
    
    if (!victim || !victim.isAlive) return;

    victim.health -= 1;

    if (victim.health <= 0) {
      victim.isAlive = false;
      
      // Record death order
      const deathEntry = {
        name: victim.name || 'Player',
        playerId: victimId,
        killedBy: attacker?.name || 'Unknown',
        deathTime: Date.now() - this.gameStartTime,
        timestamp: Date.now()
      };

      // Add to current game deaths (for final standings)
      if (!this.currentGameDeaths) {
        this.currentGameDeaths = [];
      }
      this.currentGameDeaths.push(deathEntry);

      // Add to persistent leaderboard
      this.deathOrder.unshift(deathEntry);

      // Track kills
      if (attacker) {
        attacker.kills = (attacker.kills || 0) + 1;
      }

      // Persist leaderboard
      this.state.storage.put('deathOrder', this.deathOrder.slice(0, 100)).catch((err) => {
        console.error('[SnowballFightSession] Failed to persist deathOrder', err);
      });

      this.broadcast({
        type: 'player-died',
        playerId: victimId,
        killedBy: attackerId,
        deathEntry
      });

      this.broadcastDeathOrderLeaderboard();

      // Check if game is over (only 1 or 0 players alive)
      const alivePlayers = Array.from(this.clients.values()).filter(c => c.isAlive);
      if (alivePlayers.length <= 1 && this.clients.size > 1) {
        setTimeout(() => this.endGame(), 2000);
      }
    } else {
      this.broadcast({
        type: 'player-damaged',
        playerId: victimId,
        health: victim.health,
        attackerId
      });
    }

    this.broadcastPlayerList();
  }

  endGame() {
    this.gameState = 'finished';
    
    // Find winner (last player alive)
    const alivePlayers = Array.from(this.clients.entries())
      .filter(([_, client]) => client.isAlive)
      .map(([id, client]) => ({
        id,
        name: client.name || 'Player',
        kills: client.kills || 0
      }));

    const winner = alivePlayers.length > 0 ? alivePlayers[0] : null;

    // Build complete final standings from current game deaths
    const gameDeaths = this.currentGameDeaths || [];
    
    // Final standings: deaths in order (first to die = position 1), then winner at end
    const finalStandings = gameDeaths.map(d => ({
      name: d.name,
      status: 'eliminated',
      killedBy: d.killedBy,
      deathTime: d.deathTime
    }));
    
    // Add winner at the end (last position = survived longest)
    if (winner) {
      finalStandings.push({
        name: winner.name,
        status: 'winner',
        kills: winner.kills
      });
    }

    // Store for reconnecting clients
    this.lastGameWinner = winner;
    this.lastGameStandings = finalStandings;
    
    this.broadcast({
      type: 'game-end',
      winner,
      finalStandings,
      deathOrder: this.deathOrder.slice(0, 10)
    });
  }

  resetGame() {
    this.gameState = 'lobby';
    this.gameStartTime = null;
    this.projectiles = [];
    this.lastGameWinner = null;
    this.lastGameStandings = [];
    
    for (const [_, client] of this.clients.entries()) {
      client.isAlive = true;
      client.health = 5;
      client.kills = 0;
    }

    this.broadcast({ type: 'game-reset' });
    this.broadcastPlayerList();
  }

  clearLeaderboard() {
    this.deathOrder = [];
    this.state.storage.put('deathOrder', []).catch((err) => {
      console.error('[SnowballFightSession] Failed to clear deathOrder', err);
    });
    this.broadcastDeathOrderLeaderboard();
  }

  sendDeathOrderLeaderboard(target) {
    const payload = JSON.stringify({
      type: 'death-order-leaderboard',
      entries: this.deathOrder.slice(0, 50)
    });
    try {
      target.send(payload);
    } catch (err) {
      console.error('[SnowballFightSession] Failed to send leaderboard', err);
    }
  }

  broadcastDeathOrderLeaderboard() {
    this.broadcast({
      type: 'death-order-leaderboard',
      entries: this.deathOrder.slice(0, 50)
    });
  }

  broadcastPlayerList() {
    const players = Array.from(this.clients.entries()).map(([id, data]) => ({
      id,
      name: data.name || 'Player',
      isAlive: data.isAlive,
      health: data.health,
      kills: data.kills || 0,
      position: data.position
    }));
    this.broadcast({ type: 'player-list', players });
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
        console.error('[SnowballFightSession] Broadcast failed', err);
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
    this.projectiles = [];
    this.hostId = null;
    this.gameState = 'lobby';
  }
}
