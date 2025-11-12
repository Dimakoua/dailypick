import { BaseEphemeralDO } from '../../packages/shared/base-ephemeral-do.js';

export class PollSession extends BaseEphemeralDO {
  constructor(state, env) {
    super(state, env);
    this.sessions = new Map();
  }

  async fetch(request) {
    await this.markActive();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return new Response('Missing session_id', { status: 400 });
    }

    if (url.pathname.endsWith('/websocket')) {
      const { 0: client, 1: server } = new WebSocketPair();
      await this.handleSession(server, sessionId);
      return new Response(null, { status: 101, webSocket: client });
    } else {
      return new Response('Not found', { status: 404 });
    }
  }

  async handleSession(server, sessionId) {
    server.accept();

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        users: new Map(),
        votes: new Map(),
      });
    }
    const session = this.sessions.get(sessionId);
    const userId = crypto.randomUUID();
    session.users.set(userId, { ws: server });
    this.markActive().catch((error) => console.error('[PollSession] markActive failed', error));

    server.send(JSON.stringify(this.calculateState(session)));

    server.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'vote') {
        session.votes.set(userId, data.value);
        this.broadcast(sessionId);
        await this.markActive();
      }
    });

    server.addEventListener('close', () => {
      session.users.delete(userId);
      session.votes.delete(userId);
      if (session.users.size === 0) {
        this.sessions.delete(sessionId);
        this.markInactive().catch((error) => console.error('[PollSession] markInactive failed', error));
      } else {
        this.broadcast(sessionId);
        this.markActive().catch((error) => console.error('[PollSession] markActive failed', error));
      }
    });
  }

  calculateState(session) {
    const totalVotes = Array.from(session.votes.values());
    const average = totalVotes.length > 0 ? totalVotes.reduce((a, b) => a + b, 0) / totalVotes.length : 0;
    return {
      participants: session.votes.size,
      average: average,
    };
  }

  broadcast(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message = JSON.stringify(this.calculateState(session));
    for (const user of session.users.values()) {
      user.ws.send(message);
    }
  }

  async onBeforeCleanup() {
    this.sessions.clear();
  }
}
