
export class CollaborationSession {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
    this.animalNames = [
      'Alligator', 'Bear', 'Cheetah', 'Dolphin', 'Eagle', 'Fox', 'Gorilla', 'Hedgehog',
      'Iguana', 'Jaguar', 'Koala', 'Lemur', 'Meerkat', 'Narwhal', 'Octopus', 'Panda',
      'Quokka', 'Rabbit', 'Sloth', 'Tiger', 'Urial', 'Vulture', 'Walrus', 'Xerus',
      'Yak', 'Zebra'
    ];
  }

  async fetch(request) {
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
      this.sessions.set(sessionId, new Map());
    }
    const sessionUsers = this.sessions.get(sessionId);

    const userId = crypto.randomUUID();
    const userName = this.getAvailableAnimalName(sessionUsers);
    sessionUsers.set(userId, { ws: server, name: userName });

    // Send the user their own ID
    server.send(JSON.stringify({ type: 'user-id', id: userId }));

    // Send the current user list to the new user
    const userList = Array.from(sessionUsers.entries()).map(([id, u]) => ({ id, name: u.name }));
    server.send(JSON.stringify({ type: 'user-list', users: userList }));

    server.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'mouse-move') {
        const broadcastData = {
          type: 'user-activity',
          id: userId,
          name: userName,
          x: data.x,
          y: data.y,
        };
        this.broadcast(sessionId, JSON.stringify(broadcastData));
      }
    });

    server.addEventListener('close', () => {
      sessionUsers.delete(userId);
      if (sessionUsers.size === 0) {
        this.sessions.delete(sessionId);
      }
      this.broadcast(sessionId, JSON.stringify({ type: 'user-left', id: userId, name: userName }));
    });
  }

  broadcast(sessionId, message) {
    const sessionUsers = this.sessions.get(sessionId);
    if (sessionUsers) {
      for (const user of sessionUsers.values()) {
        user.ws.send(message);
      }
    }
  }

  getAvailableAnimalName(users) {
    const usedNames = new Set(Array.from(users.values()).map(u => u.name));
    const availableNames = this.animalNames.filter(name => !usedNames.has(name));

    if (availableNames.length > 0) {
      return availableNames[Math.floor(Math.random() * availableNames.length)];
    } else {
      return `User${Math.floor(Math.random() * 100)}`;
    }
  }
}
