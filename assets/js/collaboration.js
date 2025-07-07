document.addEventListener('DOMContentLoaded', () => {
    // --- Universal Real-time Collaboration Module ---

    // 1. Inject the cursor container into the body
    const cursorsContainer = document.createElement('div');
    cursorsContainer.id = 'remote-cursors-container';
    document.body.appendChild(cursorsContainer);

    // 2. Define a pool of colors for cursors
    const CURSOR_COLORS = [
        '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
        '#e67e22', '#1abc9c', '#d35400', '#27ae60', '#c0392b'
    ];

    // 3. Connect to the WebSocket server
    const url = new URL(window.location.href);
    let sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        url.searchParams.set('session_id', sessionId);
        window.history.pushState({ path: url.href }, '', url.href);
    }

    const ws = new WebSocket(`ws://${window.location.host}/api/collaboration/websocket?session_id=${sessionId}`);

    ws.onopen = () => {
        console.log('Connected to real-time server');
    };

    // 4. Listen for local mouse movements and emit them
    document.addEventListener('mousemove', (event) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'mouse-move', x: event.clientX, y: event.clientY }));
        }
    });

    // 5. Listen for activity from other users and display their cursors
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'user-activity') {
            let cursor = document.getElementById(`cursor-${data.id}`);
            if (!cursor) {
                cursor = document.createElement('div');
                cursor.id = `cursor-${data.id}`;
                cursor.className = 'remote-cursor';
                
                const color = CURSOR_COLORS[Math.abs(data.id.charCodeAt(0) + data.id.charCodeAt(1)) % CURSOR_COLORS.length];
                const cursorIconSvg = `<svg class="cursor-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.64,21.97C13.14,22.21 12.54,22 12.31,21.5L10.13,16.76L7.62,18.78C7.45,18.92 7.24,19 7,19A1,1 0 0,1 6,18V3A1,1 0 0,1 7,2C7.24,2 7.45,2.08 7.62,2.22L16.38,8.78L18.87,6.87C19.36,6.53 19.96,6.69 20.29,7.18L23.13,11.63C23.47,12.12 23.31,12.73 22.82,13.06L13.64,21.97Z"/></svg>`;
                cursor.innerHTML = `${cursorIconSvg}<span class="cursor-name">${data.name}</span>`;
                
                cursor.querySelector('.cursor-icon').style.color = color;
                cursor.querySelector('.cursor-name').style.backgroundColor = color;

                cursorsContainer.appendChild(cursor);
            }
            cursor.style.left = `${data.x}px`;
            cursor.style.top = `${data.y}px`;
        } else if (data.type === 'user-left') {
            const cursor = document.getElementById(`cursor-${data.id}`);
            if (cursor) {
                cursor.remove();
            }
        } else if (data.type === 'user-list') {
            const allRemoteCursorIds = Array.from(document.querySelectorAll('.remote-cursor')).map(c => c.id);
            const activeUserIds = data.users.map(u => `cursor-${u.id}`);

            for (const cursorId of allRemoteCursorIds) {
                if (!activeUserIds.includes(cursorId)) {
                    const cursor = document.getElementById(cursorId);
                    if (cursor) {
                        cursor.remove();
                    }
                }
            }
        }
    };


    // 6. Handle user disconnection to remove their cursor
    ws.onclose = () => {
        console.log('Disconnected from real-time server');
    };
});