class MoraleThermometerSession {
    constructor(sessionId, onStateChange) {
        this.sessionId = sessionId;
        this.onStateChange = onStateChange;
        this.ws = null;
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/morale-thermometer/websocket?session_id=${this.sessionId}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.addEventListener('open', () => {
            console.log('Connected to morale thermometer session.');
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

    sendVote(value) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'vote', value: value }));
        }
    }
}
