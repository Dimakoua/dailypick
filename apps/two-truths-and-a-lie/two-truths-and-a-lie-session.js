import { BaseEphemeralDO } from '../../packages/shared/base-ephemeral-do.js';

export class TwoTruthsAndALieSession extends BaseEphemeralDO {
  constructor(state, env) {
    super(state, env);
    this.clients = new Map();
    this.hostId = null;
    this.statements = ['', '', ''];
    this.lieIndex = null;
    this.isRevealed = false;
    this.roundIndex = 1;
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
    this.clients.set(clientId, { ws: server, name: null, voteIndex: null, selectedAt: null });
    if (!this.hostId) {
      this.hostId = clientId;
    }

    server.send(JSON.stringify({ type: 'user-id', id: clientId }));
    this.broadcastState();
    this.markActive().catch((error) => console.error('[TwoTruths] markActive failed', error));

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleClientMessage(clientId, data);
        this.markActive().catch((error) => console.error('[TwoTruths] markActive failed', error));
      } catch (err) {
        console.error('[TwoTruths] Failed to parse message', err);
      }
    });

    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      if (this.hostId === clientId) {
        this.hostId = null;
        if (this.clients.size > 0) {
          this.hostId = this.clients.keys().next().value;
        }
      }
      this.broadcastState();
      if (this.clients.size === 0) {
        this.markInactive().catch((error) => console.error('[TwoTruths] markInactive failed', error));
      } else {
        this.markActive().catch((error) => console.error('[TwoTruths] markActive failed', error));
      }
    });
  }

  handleClientMessage(clientId, data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'set-name':
        this.updateClientName(clientId, data.name);
        break;
      case 'prepare-round':
        if (clientId === this.hostId) {
          this.prepareRound(data.statements, data.lieIndex);
        }
        break;
      case 'cast-vote':
        this.castVote(clientId, data.voteIndex);
        break;
      case 'reveal-answer':
        if (clientId === this.hostId) {
          this.revealAnswer();
        }
        break;
      case 'reset-round':
        if (clientId === this.hostId) {
          this.resetRound();
        }
        break;
      default:
        break;
    }
  }

  updateClientName(clientId, rawName) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.name = this.sanitizeText(rawName, 32) || 'Player';
    this.broadcastState();
  }

  prepareRound(statements, lieIndex) {
    const sanitizedStatements = Array.isArray(statements)
      ? statements.map((text) => this.sanitizeText(text, 140))
      : ['', '', ''];
    const sanitizedLieIndex = Number.isInteger(lieIndex) ? lieIndex : null;

    if (sanitizedStatements.some((text) => !text) || sanitizedLieIndex === null) {
      return;
    }

    this.statements = sanitizedStatements;
    this.lieIndex = sanitizedLieIndex;
    this.isRevealed = false;
    this.roundIndex += 1;

    for (const client of this.clients.values()) {
      client.voteIndex = null;
      client.selectedAt = null;
    }

    this.broadcastState();
  }

  castVote(clientId, rawVoteIndex) {
    const client = this.clients.get(clientId);
    if (!client || !this.isPrepared()) return;
    const voteIndex = Number.isInteger(rawVoteIndex) ? rawVoteIndex : null;
    if (voteIndex !== null && ![0, 1, 2].includes(voteIndex)) return;

    client.voteIndex = voteIndex;
    client.selectedAt = voteIndex === null ? null : Date.now();
    this.broadcastState();
  }

  revealAnswer() {
    if (!this.isPrepared()) return;
    this.isRevealed = true;
    this.broadcastState();
  }

  resetRound() {
    this.statements = ['', '', ''];
    this.lieIndex = null;
    this.isRevealed = false;
    this.roundIndex += 1;

    for (const client of this.clients.values()) {
      client.voteIndex = null;
      client.selectedAt = null;
    }

    this.broadcastState();
  }

  isPrepared() {
    return this.statements.every(Boolean) && Number.isInteger(this.lieIndex);
  }

  broadcastState() {
    const participantsArray = Array.from(this.clients.entries());

    for (const [targetId, targetClient] of participantsArray) {
      const payload = {
        type: 'state',
        hostId: this.hostId,
        roundIndex: this.roundIndex,
        isPrepared: this.isPrepared(),
        isRevealed: this.isRevealed,
        statements: this.statements,
        lieIndex: this.isRevealed ? this.lieIndex : null,
        participants: participantsArray.map(([id, data]) => ({
          id,
          name: data.name || 'Player',
          hasVoted: data.voteIndex !== null && data.voteIndex !== undefined,
          voteIndex: this.isRevealed || id === targetId ? data.voteIndex : null,
          isHost: id === this.hostId,
        })),
        ownVoteIndex: targetClient.voteIndex,
      };

      try {
        targetClient.ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error('[TwoTruths] Failed to broadcast state', err);
      }
    }
  }

  sanitizeText(value, maxLength = 140) {
    if (!value) return '';
    return String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  async onBeforeCleanup() {
    this.clients.clear();
    this.hostId = null;
    this.statements = ['', '', ''];
    this.lieIndex = null;
    this.isRevealed = false;
    this.roundIndex = 1;
  }
}
