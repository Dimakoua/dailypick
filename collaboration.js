
export class CollaborationSession {
  constructor(state, env) {
    this.state = state;
    this.users = new Map();
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

    if (url.pathname.endsWith('/websocket')) {
      const { 0: client, 1: server } = new WebSocketPair();

      await this.handleSession(server);

      return new Response(null, { status: 101, webSocket: client });
    } else {
      return new Response('Not found', { status: 404 });
    }
  }

  async handleSession(server) {
    server.accept();

    const userId = crypto.randomUUID();
    const userName = this.getAvailableAnimalName();
    this.users.set(userId, { ws: server, name: userName });

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

        this.broadcast(JSON.stringify(broadcastData));
      }
    });

    server.addEventListener('close', () => {
      this.users.delete(userId);
      this.broadcast(JSON.stringify({ type: 'user-left', id: userId, name: userName }));
    });
  }

  broadcast(message) {
    for (const user of this.users.values()) {
      user.ws.send(message);
    }
  }

  getAvailableAnimalName() {
    const usedNames = new Set(Array.from(this.users.values()).map(u => u.name));
    const availableNames = this.animalNames.filter(name => !usedNames.has(name));

    if (availableNames.length > 0) {
      return availableNames[Math.floor(Math.random() * availableNames.length)];
    } else {
      return `User${Math.floor(Math.random() * 100)}`;
    }
  }
}
