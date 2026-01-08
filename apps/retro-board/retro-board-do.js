import { BaseEphemeralDO } from '../../packages/shared/base-ephemeral-do.js';

export class RetroBoardSession extends BaseEphemeralDO {
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
        state: this.getInitialState(),
      });
    }

    const session = this.sessions.get(sessionId);
    const userId = crypto.randomUUID();
    session.users.set(userId, { ws: server });
    this.markActive().catch((error) => console.error('[RetroBoardSession] markActive failed', error));

    // Send initial state to new user
    server.send(JSON.stringify(session.state));

    server.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'add-card':
          this.handleAddCard(session, data.columnId, data.content);
          break;
        case 'update-card':
          this.handleUpdateCard(session, data.cardId, data.content);
          break;
        case 'delete-card':
          this.handleDeleteCard(session, data.cardId);
          break;
        case 'vote-card':
          this.handleVoteCard(session, data.cardId);
          break;
        case 'move-card':
          this.handleMoveCard(session, data.cardId, data.sourceColumnId, data.targetColumnId, data.newIndex);
          break;
        case 'update-column-title':
          this.handleUpdateColumnTitle(session, data.columnId, data.title);
          break;
      }

      await this.markActive();
    });

    server.addEventListener('close', () => {
      session.users.delete(userId);
      if (session.users.size === 0) {
        this.sessions.delete(sessionId);
        this.markInactive().catch((error) => console.error('[RetroBoardSession] markInactive failed', error));
      } else {
        this.markActive().catch((error) => console.error('[RetroBoardSession] markActive failed', error));
      }
    });
  }

  getInitialState() {
    return {
      columns: {
        'col-1': {
          id: 'col-1',
          title: 'Went Well',
          color: 'went-well',
          cardIds: [],
        },
        'col-2': {
          id: 'col-2',
          title: 'To Improve',
          color: 'to-improve',
          cardIds: [],
        },
        'col-3': {
          id: 'col-3',
          title: 'Action Items',
          color: 'action-items',
          cardIds: [],
        },
      },
      cards: {},
      columnOrder: ['col-1', 'col-2', 'col-3'],
    };
  }

  handleAddCard(session, columnId, content) {
    const cardId = 'card-' + crypto.randomUUID();
    
    session.state.cards[cardId] = {
      id: cardId,
      content: content,
      votes: 0,
    };

    if (session.state.columns[columnId]) {
      session.state.columns[columnId].cardIds.push(cardId);
    }

    this.broadcast(session);
  }

  handleUpdateCard(session, cardId, content) {
    if (session.state.cards[cardId]) {
      session.state.cards[cardId].content = content;
      this.broadcast(session);
    }
  }

  handleDeleteCard(session, cardId) {
    // Remove from columns
    for (const columnId in session.state.columns) {
      const column = session.state.columns[columnId];
      const index = column.cardIds.indexOf(cardId);
      if (index > -1) {
        column.cardIds.splice(index, 1);
      }
    }

    // Remove card
    delete session.state.cards[cardId];

    this.broadcast(session);
  }

  handleVoteCard(session, cardId) {
    if (session.state.cards[cardId]) {
      session.state.cards[cardId].votes = (session.state.cards[cardId].votes || 0) + 1;
      this.broadcast(session);
    }
  }

  handleMoveCard(session, cardId, sourceColumnId, targetColumnId, newIndex) {
    const sourceColumn = session.state.columns[sourceColumnId];
    const targetColumn = session.state.columns[targetColumnId];

    if (!sourceColumn || !targetColumn) {
      return;
    }

    // Remove from source
    const sourceIndex = sourceColumn.cardIds.indexOf(cardId);
    if (sourceIndex > -1) {
      sourceColumn.cardIds.splice(sourceIndex, 1);
    }

    // Add to target at new index
    targetColumn.cardIds.splice(newIndex, 0, cardId);

    this.broadcast(session);
  }

  handleUpdateColumnTitle(session, columnId, title) {
    if (session.state.columns[columnId]) {
      session.state.columns[columnId].title = title;
      this.broadcast(session);
    }
  }

  broadcast(session) {
    const message = JSON.stringify(session.state);
    for (const user of session.users.values()) {
      user.ws.send(message);
    }
  }

  async onBeforeCleanup() {
    this.sessions.clear();
  }
}
