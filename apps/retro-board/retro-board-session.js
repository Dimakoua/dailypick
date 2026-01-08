class RetroBoardSession {
  constructor(sessionId, onStateChange) {
    this.sessionId = sessionId;
    this.onStateChange = onStateChange;
    this.ws = null;
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/retro-board/websocket?session_id=${this.sessionId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      console.log('Connected to retro board session.');
    });

    this.ws.addEventListener('message', (event) => {
      const state = JSON.parse(event.data);
      this.onStateChange(state);
    });

    this.ws.addEventListener('close', () => {
      console.log('Disconnected. Reconnecting...');
      setTimeout(() => this.connect(), 1000);
    });

    this.ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.ws.close();
    });
  }

  addCard(columnId, content) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'add-card', 
        columnId, 
        content 
      }));
    }
  }

  updateCard(cardId, content) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'update-card', 
        cardId, 
        content 
      }));
    }
  }

  deleteCard(cardId) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'delete-card', 
        cardId 
      }));
    }
  }

  voteCard(cardId) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'vote-card', 
        cardId 
      }));
    }
  }

  moveCard(cardId, sourceColumnId, targetColumnId, newIndex) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'move-card', 
        cardId, 
        sourceColumnId, 
        targetColumnId, 
        newIndex 
      }));
    }
  }

  updateColumnTitle(columnId, title) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ 
        type: 'update-column-title', 
        columnId, 
        title 
      }));
    }
  }
}
