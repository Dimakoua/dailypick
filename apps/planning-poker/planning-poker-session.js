export class PlanningPokerSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map(); // id -> { ws, name, choice, selectedAt }
    this.hostId = null;
    this.storyLabel = '';
    this.isRevealed = false;
    this.roundIndex = 1;
    this.lastSummaryText = '';
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
    this.clients.set(clientId, { ws: server, name: null, choice: null, selectedAt: null });

    if (!this.hostId) {
      this.hostId = clientId;
    }

    server.send(JSON.stringify({ type: 'user-id', id: clientId }));
    this.broadcastState();

    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleClientMessage(clientId, data);
      } catch (err) {
        console.error('[PlanningPokerSession] Failed to parse message', err);
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
    });
  }

  handleClientMessage(clientId, data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'set-name':
        this.updateClientName(clientId, data.name);
        break;
      case 'select-card':
        this.updateClientCard(clientId, data.value);
        break;
      case 'clear-card':
        this.clearClientCard(clientId);
        break;
      case 'request-reveal':
        if (clientId === this.hostId) this.revealVotes();
        break;
      case 'reset-round':
        if (clientId === this.hostId) this.resetRound();
        break;
      case 'set-story':
        if (clientId === this.hostId) this.updateStoryLabel(data.story);
        break;
      default:
        break;
    }
  }

  updateClientName(clientId, rawName) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.name = this.sanitizeText(rawName, 48);
    this.broadcastState();
  }

  updateClientCard(clientId, rawValue) {
    const client = this.clients.get(clientId);
    if (!client) return;
    const value = this.sanitizeCardValue(rawValue);
    if (!value) return;
    client.choice = value;
    client.selectedAt = Date.now();
    if (this.isRevealed) {
      // Once revealed we keep previous summary until next reset.
      this.lastSummaryText = this.generateSummaryText();
    }
    this.broadcastState();
  }

  clearClientCard(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.choice = null;
    client.selectedAt = null;
    this.broadcastState();
  }

  updateStoryLabel(rawStory) {
    this.storyLabel = this.sanitizeText(rawStory, 120);
    this.broadcastState();
  }

  revealVotes() {
    if (this.isRevealed) return;
    this.isRevealed = true;
    this.lastSummaryText = this.generateSummaryText();
    this.broadcastState();
  }

  resetRound() {
    this.isRevealed = false;
    this.roundIndex += 1;
    this.lastSummaryText = '';
    for (const client of this.clients.values()) {
      client.choice = null;
      client.selectedAt = null;
    }
    this.broadcastState();
  }

  generateSummary() {
    const participants = Array.from(this.clients.entries()).map(([id, data]) => ({
      id,
      name: data.name || 'Player',
      choice: data.choice,
    }));

    const order = ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];
    const counts = new Map();
    const numericVotes = [];

    for (const p of participants) {
      if (!p.choice) continue;
      const current = counts.get(p.choice) || 0;
      counts.set(p.choice, current + 1);

      const parsed = parseFloat(p.choice.replace(',', '.'));
      if (!Number.isNaN(parsed)) {
        numericVotes.push(parsed);
      }
    }

    numericVotes.sort((a, b) => a - b);
    const numericCount = numericVotes.length;
    const numericSum = numericVotes.reduce((acc, value) => acc + value, 0);
    const average = numericCount ? numericSum / numericCount : null;
    const median =
      numericCount === 0
        ? null
        : numericCount % 2 === 1
          ? numericVotes[(numericCount - 1) / 2]
          : (numericVotes[numericCount / 2 - 1] + numericVotes[numericCount / 2]) / 2;

    const sortedCounts = order
      .filter((value) => counts.has(value))
      .map((value) => ({ value, count: counts.get(value) }));

    return {
      votes: sortedCounts,
      totalVotes: participants.filter((p) => Boolean(p.choice)).length,
      average: average !== null ? Number(average.toFixed(1)) : null,
      median: median !== null ? Number(median.toFixed(1)) : null,
      numericVotes,
      story: this.storyLabel || '',
    };
  }

  generateSummaryText() {
    const summary = this.generateSummary();
    if (!summary.totalVotes) {
      return 'Planning Poker: No votes submitted.';
    }

    const lines = [];
    const storyLine = summary.story ? `Story: ${summary.story}` : null;
    if (storyLine) lines.push(storyLine);
    lines.push(`Votes: ${summary.totalVotes}`);

    if (summary.average !== null || summary.median !== null) {
      const stats = [
        summary.average !== null ? `avg ${summary.average}` : null,
        summary.median !== null ? `median ${summary.median}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      if (stats) lines.push(stats);
    }

    const voteLines = summary.votes.map(
      (entry) => `${entry.value}: ${entry.count}`
    );
    if (voteLines.length) {
      lines.push(voteLines.join(' | '));
    }

    const participantLines = Array.from(this.clients.values())
      .map((client) => {
        if (!client.choice) return null;
        const name = client.name || 'Player';
        return `${name}: ${client.choice}`;
      })
      .filter(Boolean);

    if (participantLines.length) {
      lines.push(participantLines.join(', '));
    }

    return lines.join('\n');
  }

  broadcastState() {
    const summary = this.isRevealed ? this.generateSummary() : null;
    if (this.isRevealed && !this.lastSummaryText) {
      this.lastSummaryText = this.generateSummaryText();
    }

    const participantsArray = Array.from(this.clients.entries());

    for (const [targetId, targetClient] of participantsArray) {
      const payload = {
        type: 'state',
        hostId: this.hostId,
        isRevealed: this.isRevealed,
        story: this.storyLabel || '',
        round: this.roundIndex,
        summary,
        summaryText: this.isRevealed ? this.lastSummaryText : '',
        participants: participantsArray.map(([id, data]) => ({
          id,
          name: data.name || 'Player',
          hasSelected: Boolean(data.choice),
          cardValue: this.isRevealed || id === targetId ? data.choice : null,
          selectedAt: data.selectedAt || null,
        })),
      };

      try {
        targetClient.ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error('[PlanningPokerSession] Failed to broadcast state', err);
      }
    }
  }

  sanitizeText(value, maxLength = 64) {
    if (!value) return '';
    return String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  sanitizeCardValue(value) {
    if (!value) return '';
    const allowed = ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];
    const trimmed = String(value).trim();
    return allowed.includes(trimmed) ? trimmed : '';
  }
}
