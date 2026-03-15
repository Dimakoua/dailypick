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
    session.users.set(userId, { ws: server, reactions: new Map() });
    this.markActive().catch((error) => console.error('[RetroBoardSession] Failed to mark session active after user connection:', error));

    // Send initial state to new user
    server.send(JSON.stringify(session.state));
    // Send the new user's id back so the client can know which cards they own
    server.send(JSON.stringify({ type: 'me', userId }));

    server.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'add-card':
          this.handleAddCard(session, userId, data.columnId, data.content);
          break;
        case 'update-card':
          this.handleUpdateCard(session, data.cardId, data.content);
          break;
        case 'delete-card':
          this.handleDeleteCard(session, userId, data.cardId);
          break;
        case 'vote-card':
          // Backwards compatibility: thumbs-up
          this.handleReact(session, userId, data.cardId, 'thumbs');
          break;
        case 'react':
          this.handleReact(session, userId, data.cardId, data.reaction);
          break;
        case 'sort-column':
          this.handleSortColumn(session, data.columnId);
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

  handleAddCard(session, userId, columnId, content) {
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
      owner: userId,
      reactions: {
        thumbs: 0,
        heart: 0,
        tada: 0,
        thinking: 0,
      },
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

  handleDeleteCard(session, userId, cardId) {
    const card = session.state.cards[cardId];
    if (!card || card.owner !== userId) {
      return; // only the owner can delete their card
    }

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

  handleReact(session, userId, cardId, reaction) {
    const card = session.state.cards[cardId];
    const user = session.users.get(userId);

    if (!card || !user) {
      return;
    }

    if (!card.reactions) {
      card.reactions = {
        thumbs: 0,
        heart: 0,
        tada: 0,
        thinking: 0,
      };
    }

    if (!user.reactions) {
      user.reactions = new Map();
    }

    const reactions = user.reactions.get(cardId) || new Set();
    const hasReacted = reactions.has(reaction);

    if (hasReacted) {
      card.reactions[reaction] = Math.max(0, (card.reactions[reaction] || 0) - 1);
      reactions.delete(reaction);
    } else {
      card.reactions[reaction] = (card.reactions[reaction] || 0) + 1;
      reactions.add(reaction);
    }

    if (reactions.size > 0) {
      user.reactions.set(cardId, reactions);
    } else {
      user.reactions.delete(cardId);
    }

    this.broadcast(session);
  }

  handleSortColumn(session, columnId) {
    const column = session.state.columns[columnId];
    if (!column) {
      return;
    }

    // Stable sort: keep existing order for ties
    const originalOrder = Object.fromEntries(
      column.cardIds.map((id, index) => [id, index])
    );

    column.cardIds.sort((a, b) => {
      const aThumbs = session.state.cards[a]?.reactions?.thumbs || 0;
      const bThumbs = session.state.cards[b]?.reactions?.thumbs || 0;
      if (bThumbs !== aThumbs) {
        return bThumbs - aThumbs;
      }
      return (originalOrder[a] || 0) - (originalOrder[b] || 0);
    });

    this.broadcast(session);
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
