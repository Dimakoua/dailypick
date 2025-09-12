// Game constants (these must match the server's constants)
const GAME_CANVAS_WIDTH = 800;
const GAME_CANVAS_HEIGHT = 600;
const BALL_RADIUS = 15; // Client uses 15, server uses 10. Consider making this 10 as well for consistency.
const TRAP_RADIUS = 25;

// UI Elements (selectors must match your HTML IDs)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winnerList = document.getElementById('winner-list');
const capturedList = document.getElementById('captured-list');
const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const configArea = document.getElementById("config-area");
const namesInput = document.getElementById("namesInput"); // Assuming this is now a <textarea> or multi-line input
const updateNamesBtn = document.getElementById("updateNamesBtn");
const restartGameBtn = document.getElementById('restartGameBtn');
const startGameBtn = document.getElementById('startGameBtn');
const sessionInfoDiv = document.getElementById('sessionInfo');
const currentSessionIdDisplay = document.getElementById('currentSessionIdDisplay');
const copySessionUrlBtn = document.getElementById('copySessionUrlBtn');
const gameContainer = document.getElementById('game-container');
const requestResultInPIPBtn = document.getElementById('requestResultInPIP');

// WebSocket instance
let ws = null;

// Client-side game state (these will be updated by server messages)
let ball = { x: canvas.width / 2, y: canvas.height / 2, radius: BALL_RADIUS, color: '#e74c3c' };
let traps = [];
let activeEffects = { speedBoost: false, sizeChange: 1, trapFrenzy: false };

// For visual effects
let particles = [];
let popAnimations = [];

// Name management constants and variables
const DEFAULT_NAMES = ['Kate', 'Andre', 'Juan', 'Dmytro', 'Vetura', 'Zachary', 'Lindsay'];
const LOCAL_STORAGE_KEY = 'namesList';
let playerNames = [...DEFAULT_NAMES]; // Initialized here, will be loaded from storage

// Session Management Variable
let currentSessionId = null;

// --- Helper Functions ---

function getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    console.log('[Client Debug] getSessionIdFromUrl found:', sessionId);
    return sessionId;
}

function updateUrlWithSessionId(sessionId) {
    const newUrl = `${window.location.origin}/ballgame?session_id=${sessionId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    if (currentSessionIdDisplay) currentSessionIdDisplay.textContent = sessionId;
    if (sessionInfoDiv) sessionInfoDiv.style.display = 'block';
    if (startGameBtn) startGameBtn.style.display = 'none'; // Hide Start Game button once a session is active
    if (restartGameBtn) restartGameBtn.style.display = 'block'; // Show Restart Game button
    console.log('[Client Debug] URL updated to:', newUrl);
}

function generateClientSessionId() {
    const id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    console.log('[Client Debug] Generated new client-side session ID:', id);
    return id;
}

function connectWebSocket(sessionIdToJoin = null, namesForInitialization = null) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.warn('[Client Debug] Closing existing WebSocket connection before establishing a new one.');
        ws.close(); // Close existing connection cleanly
        // Do not immediately nullify ws here, let onclose handle it.
    }

    let idToUse = sessionIdToJoin;
    if (!idToUse) {
        idToUse = generateClientSessionId();
        console.log('[Client Debug] No session ID provided, generating new one:', idToUse);
    } else {
        console.log('[Client Debug] Using provided session ID:', idToUse);
    }
    currentSessionId = idToUse; // Update the global session ID

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/api/ballgame/websocket?session_id=${currentSessionId}`;

    console.log('[Client Debug] Attempting to connect WebSocket to:', wsUrl);

    ws = new WebSocket(wsUrl); // Assign new WebSocket instance

    ws.onopen = () => {
        console.log(`[Client Debug] Connected to ball game server for session: ${currentSessionId}`);
        // If names were passed for initialization (i.e., new game or explicit reset)
        if (namesForInitialization && namesForInitialization.length > 0) {
             console.log(`[Client Debug] Sending reset-game-with-names with:`, namesForInitialization);
             ws.send(JSON.stringify({ type: 'reset-game-with-names', names: namesForInitialization }));
        }
        updateUrlWithSessionId(currentSessionId);
        startCursorsCollaboration();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onclose = (event) => {
        console.log('[Client Debug] WebSocket disconnected:', event.code, event.reason);
        // Reset client-side game state on disconnect
        ball = { x: canvas.width / 2, y: canvas.height / 2, radius: BALL_RADIUS, color: '#e74c3c' };
        traps = [];
        activeEffects = { speedBoost: false, sizeChange: 1, trapFrenzy: false };
        particles = [];
        popAnimations = [];
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        if (capturedList) capturedList.innerHTML = '';
        
        // Decide button visibility based on whether a session ID was present
        if (!getSessionIdFromUrl() || event.code === 1000) { // If no session ID or clean close, show start game
            if (startGameBtn) startGameBtn.style.display = 'block';
            if (sessionInfoDiv) sessionInfoDiv.style.display = 'none';
            if (restartGameBtn) restartGameBtn.style.display = 'none';
        } else { // If a session ID was present, but disconnect occurred (might try to reconnect)
            if (startGameBtn) startGameBtn.style.display = 'none'; // Keep start hidden
            if (sessionInfoDiv) sessionInfoDiv.style.display = 'block'; // Keep session info visible
        // alert('Disconnected from game. Please refresh or try again.'); // Consider if this alert is always desired
        ws = null; // Clear the WebSocket instance
    };

    ws.onerror = (error) => {
        console.error('[Client Debug] WebSocket error:', error);
        alert('WebSocket error occurred. Check console for details.');
        ws = null; // Clear the WebSocket instance on error
    };
}

// --- START: Your provided Name Management and UI Functions ---

function loadNamesFromStorage() {
    const storedNamesJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedNamesJson) {
        try {
            const storedNames = JSON.parse(storedNamesJson);
            if (Array.isArray(storedNames) && storedNames.length > 0) {
                playerNames = [...storedNames];
            } else { // Handle empty array after parsing
                playerNames = [...DEFAULT_NAMES];
                console.warn("[Client Debug] Stored names array was empty, using defaults.");
            }
        } catch (e) {
            console.error("[Client Debug] Error parsing names from localStorage:", e);
            playerNames = [...DEFAULT_NAMES]; // Fallback on error
        }
    } else {
        playerNames = [...DEFAULT_NAMES];
        console.log("[Client Debug] No names found in localStorage, using defaults.");
    }
    if (namesInput) { // Ensure namesInput exists before setting its value
        namesInput.value = playerNames.join('\n');
    }
    console.log("[Client Debug] Names loaded:", playerNames);
}

function saveNamesToStorage() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(playerNames));
    console.log("[Client Debug] Names saved to localStorage:", playerNames);
}

function updateNamesFromInput() {
    console.log("[Client Debug] Updating names from input...");
    const inputText = namesInput.value.trim();
    // Split by newline or comma, then trim and filter out empty strings
    const newNames = inputText ? inputText.split(/[\n,]+/).map(name => name.trim()).filter(name => name.length > 0) : [];
    
    // Use newNames if valid, otherwise fallback to DEFAULT_NAMES
    playerNames = newNames.length > 0 ? [...newNames] : [...DEFAULT_NAMES];
    
    // Update the input field with the cleaned names (joined by newline for readability)
    namesInput.value = playerNames.join('\n');
    saveNamesToStorage();
    
    console.log("[Client Debug] Player names updated to:", playerNames);

    if (currentSessionId && ws && ws.readyState === WebSocket.OPEN) {
        // Adapt from Socket.IO's 'emit' to raw WebSocket 'send'
        console.log('[Client Debug] Sending reset-game-with-names to current session:', currentSessionId, 'Names:', playerNames);
        ws.send(JSON.stringify({ type: 'reset-game-with-names', names: playerNames }));
        // Hide game over overlay if present
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        if (capturedList) capturedList.innerHTML = '';
    } else {
        // If no session active or WS not open, just log and wait for next connection
        console.warn('[Client Debug] No active session or WebSocket not open. Names will apply to next connection.');
        // If there's no current session, and they update names, you might want to immediately start a new session
        // This behavior depends on your desired UX flow. For now, it will just update localStorage.
    }
    toggleConfigArea(false); // Hide config after updating
}

function toggleConfigArea(show) {
    if (!configArea || !settingsToggleBtn) return; // Ensure elements exist

    if (show === undefined) { // Toggle behavior
        configArea.classList.toggle("config-hidden");
    } else if (show) { // Explicitly show
        configArea.classList.remove("config-hidden");
    } else { // Explicitly hide
        configArea.classList.add("config-hidden");
    }
    settingsToggleBtn.textContent = configArea.classList.contains("config-hidden") ? "⚙️ Show Settings" : "⚙️ Hide Settings";
    console.log(`[Client Debug] Config area toggled to hidden: ${configArea.classList.contains("config-hidden")}`);
}

// --- END: Your provided Name Management and UI Functions ---


function requestNewSession() {
    console.log('[Client Debug] Requesting new session...');
    // When requesting a new session, we initiate a connection and pass the current playerNames
    connectWebSocket(null, playerNames);
}


    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    if (capturedList) capturedList.innerHTML = '';
    
    if (currentSessionId) {
        // When restarting an existing session, we connect to the same ID but also
        // tell the server to reset the game with the current playerNames.
    } else {
        alert('No active session to restart. Please start a new game.');
        if (startGameBtn) startGameBtn.style.display = 'block'; // Show start game button if no session
    }
}

// --- NEW/MODIFIED: Visual Effects & Notifications ---
function createPopAnimation(x, y) {
    popAnimations.push({ x: x, y: y, frame: 0 });
}

function showEffectNotification(effectName) {
    const notification = document.createElement('div');
    notification.className = 'effect-notification';
    let text = '';
    switch (effectName) {
        case 'speedBoost': text = 'SPEED BOOST!'; break;
        case 'sizeChange': text = 'SIZE CHANGE!'; break;
        case 'trapFrenzy': text = 'TRAP FRENZY!'; break;
    }
    notification.textContent = text;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 2500);
}


function handleServerMessage(data) {
    const countdownOverlay = document.getElementById('countdown-overlay');
    switch (data.type) {
        case 'countdown':
            const remaining = Math.max(0, data.startTime - Date.now());
            const countdownEl = document.getElementById('countdown');

            if (remaining > 500) {
                countdownOverlay.style.display = 'flex';
                countdownEl.innerText = Math.ceil(remaining / 1000);
            } else {
                countdownOverlay.style.display = 'none';
            }
            break;
        case 'game-state-update':
            // CRITICAL LOG: Check the incoming ball data
            // console.log('[Client Debug] Received game-state-update. Data.ball:', data.ball); // Too verbose for continuous
            if (data.ball && typeof data.ball.x === 'number' && typeof data.ball.y === 'number') {
                ball = data.ball; // Update the client's ball object
            } else {
                console.error('[Client Debug] Invalid ball data received from server:', data.ball);
            }
            traps = data.traps;
            // For now, `showEffectNotification` is called on 'trap-captured' as before.
        case 'trap-captured':
            const capturedTrap = traps.find(t => t.id === data.trapId);
            if (capturedTrap) {
                createPopAnimation(capturedTrap.x, capturedTrap.y);
            }
            updateCapturedList(data.userName);
            // This is where the server indicates an effect was triggered
            if (data.effect && data.effect !== 'none') {
                showEffectNotification(data.effect);
            }
            break;
        case 'game-over':
            showGameOver(data.capturedUserNames);
            break;
        case 'game-reset':
            console.log(data)
            console.log(`[Client Debug] Game reset for session: ${data.sessionId}`);
            // Reset client-side state for a fresh start based on server's reset
            ball = { x: canvas.width / 2, y: canvas.height / 2, radius: BALL_RADIUS, color: '#e74c3c' }; // Default client ball for immediate draw
            traps = []; // Will be populated by the next game-state-update from server
            activeEffects = { speedBoost: false, sizeChange: 1, trapFrenzy: false };
            if (capturedList) capturedList.innerHTML = '';
            if (gameOverOverlay) gameOverOverlay.style.display = 'none';
            if (countdownOverlay) countdownOverlay.style.display = 'none';
            break;
        case 'join-session-success':
            console.log(`[Client Debug] Successfully joined session:`, data);
            break;
        default:
            console.warn('[Client Debug] Unknown message type:', data.type);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentBallRadius = ball.radius * (activeEffects.sizeChange || 1);
    if (!ball || isNaN(ball.x) || isNaN(ball.y) || isNaN(currentBallRadius) || !ball.color || currentBallRadius <= 0) {
        // console.error('[Client Debug] Ball state invalid for drawing. Current Ball:', ball, 'Calculated Radius:', currentBallRadius);
        // Avoid repeated errors if the state is temporarily bad
    } else {
        // console.log(`[Client Debug] Drawing ball at (${ball.x.toFixed(2)}, ${ball.y.toFixed(2)}) with radius ${currentBallRadius.toFixed(2)}`); // Too verbose
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, currentBallRadius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.closePath();
    }

    // Draw traps
    traps.forEach(trap => {
        if (trap.active) {
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, TRAP_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#3498db';
            ctx.fill();
            ctx.closePath();

            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(trap.userName, trap.x, trap.y);
        }
    });

    // Draw particles
    particles.forEach((p, index) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.closePath();
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.size *= 0.98;
        if (p.alpha <= 0.1 || p.size <= 1) {
            particles.splice(index, 1);
        }
    });

    // Draw pop animations
    popAnimations.forEach((anim, index) => {
        const maxFrames = 10;
        const radius = TRAP_RADIUS * (1 + anim.frame / maxFrames * 0.5);
        ctx.beginPath();
        ctx.arc(anim.x, anim.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 0, ${1 - anim.frame / maxFrames})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.closePath();
        anim.frame++;
        if (anim.frame > maxFrames) {
            popAnimations.splice(index, 1);
        }
    });

    requestAnimationFrame(draw);
}

function updateCapturedList(userName) {
    if (capturedList) {
        const listItem = document.createElement('li');
        listItem.textContent = userName;
        capturedList.appendChild(listItem);
    }
}

function showGameOver(winners) {
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';
    if (winnerList) {
        winnerList.innerHTML = '';
        winners.forEach(winner => {
            const listItem = document.createElement('li');
            listItem.textContent = winner;
            winnerList.appendChild(listItem);
        });
    }
}


// Event Listeners
if (canvas) { // Ensure canvas element exists
    canvas.addEventListener('click', (event) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const clickX = (event.clientX - rect.left) * scaleX;
            const clickY = (event.clientY - rect.top) * scaleY;
            ws.send(JSON.stringify({ type: 'apply-force', clickX, clickY }));
        }
    });
}


if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => toggleConfigArea(undefined)); // Pass undefined to toggle
}
if (updateNamesBtn) {
    updateNamesBtn.addEventListener('click', updateNamesFromInput); // Use your function
}
if (startGameBtn) {
    startGameBtn.addEventListener('click', requestNewSession);
}

if (requestResultInPIPBtn) {
    requestResultInPIPBtn.addEventListener('click', requestResultInPIP);
}
if (restartGameBtn) {
    restartGameBtn.addEventListener('click', restartCurrentGame);
}
if (copySessionUrlBtn) {
    copySessionUrlBtn.addEventListener('click', () => {
        if (currentSessionId) {
            const sessionUrl = `${window.location.origin}/ballgame?session_id=${currentSessionId}`;
            navigator.clipboard.writeText(sessionUrl).then(() => {
                alert('Session URL copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy URL:', err);
            });
        }
    });
}

// How to Play Modal Logic
const howToPlayModal = document.getElementById('how-to-play-modal');
const howToPlayBtn = document.getElementById('howToPlayBtn');
const closeBtn = document.querySelector('.close-btn');

howToPlayBtn.addEventListener('click', () => {
    console.log('How to Play button clicked');
    howToPlayModal.classList.add('modal');
    howToPlayModal.classList.remove('hidden');
});

closeBtn.addEventListener('click', () => {
    howToPlayModal.classList.add('hidden');
});

// --- Initial Setup ---
function initializeSession() {
    loadNamesFromStorage(); // Load names first
    toggleConfigArea(false); // Hide config area by default

    const urlSessionId = getSessionIdFromUrl();
    if (urlSessionId) {
        console.log('[Client Debug] Initializing with URL session ID:', urlSessionId);
        // When reconnecting to an existing session from URL, don't force a reset with names.
        // The server will load its existing state.
        connectWebSocket(urlSessionId, null); // Pass null for namesForInitialization
    } else {
        console.log('[Client Debug] No session ID in URL, showing start game button.');
        if (startGameBtn) startGameBtn.style.display = 'block';
        if (restartGameBtn) restartGameBtn.style.display = 'none';
        if (sessionInfoDiv) sessionInfoDiv.style.display = 'none';
    }
    draw(); // Start the rendering loop
}

initializeSession();