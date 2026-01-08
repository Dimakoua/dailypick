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
    this.markActive().catch((error) => console.error('[RetroBoardSession] Failed to mark session active after user connection:', error));

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
        this.markInactive().catch((error) => console.error('[RetroBoardSession] Failed to mark session inactive after last user disconnected:', error));
      } else {
        this.markActive().catch((error) => console.error('[RetroBoardSession] Failed to mark session active after user disconnection:', error));
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
    // Validate content
    if (!content || typeof content !== 'string') {
      return;
    }
    
    // Limit card content length to prevent abuse
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 5000) {
      return;
    }

    const cardId = 'card-' + crypto.randomUUID();
    
    session.state.cards[cardId] = {
      id: cardId,
      content: trimmedContent,
      votes: 0,
    };

    if (session.state.columns[columnId]) {
      session.state.columns[columnId].cardIds.push(cardId);
    }

    this.broadcast(session);
  }

  handleUpdateCard(session, cardId, content) {
    // Validate content
    if (!content || typeof content !== 'string') {
      return;
    }
    
    // Limit card content length to prevent abuse
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 5000) {
      return;
    }

    if (session.state.cards[cardId]) {
      session.state.cards[cardId].content = trimmedContent;
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

    // Validate newIndex
    if (typeof newIndex !== 'number' || newIndex < 0) {
      return;
    }

    // Remove from source
    const sourceIndex = sourceColumn.cardIds.indexOf(cardId);
    if (sourceIndex > -1) {
      sourceColumn.cardIds.splice(sourceIndex, 1);
    }

    // Ensure newIndex is within bounds
    const validIndex = Math.min(newIndex, targetColumn.cardIds.length);
    
    // Add to target at new index
    targetColumn.cardIds.splice(validIndex, 0, cardId);

    this.broadcast(session);
  }

  handleUpdateColumnTitle(session, columnId, title) {
    // Validate title
    if (!title || typeof title !== 'string') {
      return;
    }
    
    // Limit title length to prevent abuse
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0 || trimmedTitle.length > 100) {
      return;
    }

    if (session.state.columns[columnId]) {
      session.state.columns[columnId].title = trimmedTitle;
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
