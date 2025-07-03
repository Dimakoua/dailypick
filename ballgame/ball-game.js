// Game constants
const GAME_CANVAS_WIDTH = 800;
const GAME_CANVAS_HEIGHT = 600;
const BALL_RADIUS = 15; // Made ball slightly smaller
const TRAP_RADIUS = 25; // Constant for traps
const BALL_FRICTION = 0.98; // Reduces velocity over time
const FORCE_MULTIPLIER = 0.5; // How much a click affects velocity
const SERVER_TICK_RATE = 1000 / 60; // 60 updates per second
const SPECIAL_EFFECT_DURATION = 3000; // 3 seconds for effects

// Central storage for all active game sessions
// Each key is a sessionId, and each value is an object containing the game state for that session.
const gameSessions = new Map();

/**
 * Generates a unique session ID.
 * @returns {string} A unique ID for a game session.
 */
function generateSessionId() {
    // A simple way to generate a unique ID, could use a more robust UUID library in production.
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Creates a new game session or initializes an existing one.
 * @param {string} sessionId - The ID of the session to create or update.
 * @param {string[]} names - An array of player names for the traps.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 * @returns {object} The newly created or updated game session object.
 */
function createOrUpdateGameSession(sessionId, names, io) {
    console.log(`Creating/Updating game session: ${sessionId} with names:`, names);

    // Initialize the session state if it doesn't exist
    if (!gameSessions.has(sessionId)) {
        gameSessions.set(sessionId, {
            ballState: { x: GAME_CANVAS_WIDTH / 2, y: GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
            traps: [],
            capturedUserNames: [],
            gameActive: true,
            activeEffects: {
                speedBoost: false,
                sizeChange: 1,
                trapFrenzy: false
            },
            // Store the IO instance or emit to the specific room later
            ioRoom: io.to(sessionId) // Store a reference to the specific Socket.IO room
        });
    }

    const session = gameSessions.get(sessionId);

    // Create traps based on names for this session
    session.traps = names.map((name, index) => ({
        id: `${Date.now()}-${index}`, // Unique ID for the trap
        userName: name,
        active: true,
        x: 0, y: 0, vx: 0, vy: 0, // Will be set by resetGame
    }));

    resetGame(sessionId, io); // Reset ball, set trap positions, and broadcast to this session
    return session;
}

/**
 * Resets a specific game session to its initial state.
 * @param {string} sessionId - The ID of the session to reset.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 */
function resetGame(sessionId, io) {
    const session = gameSessions.get(sessionId);
    if (!session) {
        console.warn(`Attempted to reset non-existent session: ${sessionId}`);
        return;
    }

    console.log(`Resetting game for session: ${sessionId}`);
    session.ballState = { x: GAME_CANVAS_WIDTH / 2, y: GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0 };
    session.capturedUserNames = [];
    session.activeEffects = { speedBoost: false, sizeChange: 1, trapFrenzy: false }; // Reset effects

    // Reset all existing traps to be active and give them new random positions/velocities
    session.traps.forEach(trap => {
        trap.active = true;
        trap.x = TRAP_RADIUS + Math.random() * (GAME_CANVAS_WIDTH - TRAP_RADIUS * 2);
        trap.y = TRAP_RADIUS + Math.random() * (GAME_CANVAS_HEIGHT - TRAP_RADIUS * 2);
        trap.vx = (Math.random() - 0.5) * 1.5;
        trap.vy = (Math.random() - 0.5) * 1.5;
    });
    session.gameActive = true;

    // Emit to the specific room for this session
    io.to(sessionId).emit('game-reset');
}

/**
 * Triggers a random special effect for a specific session and notifies clients in that session.
 * @param {string} sessionId - The ID of the session.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 * @returns {string} The name of the chosen effect.
 */
function triggerRandomEffect(sessionId, io) {
    const session = gameSessions.get(sessionId);
    if (!session) {
        console.warn(`Attempted to trigger effect for non-existent session: ${sessionId}`);
        return 'none';
    }

    const { ballState, activeEffects, traps } = session;

    // 'none' is included to make effects less frequent and more special.
    const effects = ['speedBoost', 'sizeChange', 'trapFrenzy', 'none', 'none', 'none'];
    const chosenEffect = effects[Math.floor(Math.random() * effects.length)];

    console.log(`Session ${sessionId}: Triggering effect: ${chosenEffect}`);

    switch (chosenEffect) {
        case 'speedBoost':
            if (!activeEffects.speedBoost) {
                activeEffects.speedBoost = true;
                ballState.vx *= 2.5;
                ballState.vy *= 2.5;
                setTimeout(() => { activeEffects.speedBoost = false; }, SPECIAL_EFFECT_DURATION);
            }
            break;
        case 'sizeChange':
            if (activeEffects.sizeChange === 1) {
                const newSize = Math.random() > 0.5 ? 2 : 0.5; // Double or half size
                activeEffects.sizeChange = newSize;
                setTimeout(() => { activeEffects.sizeChange = 1; }, SPECIAL_EFFECT_DURATION);
            }
            break;
        case 'trapFrenzy':
            if (!activeEffects.trapFrenzy) {
                activeEffects.trapFrenzy = true;
                traps.forEach(t => {
                    if (t.active) { t.vx *= 2; t.vy *= 2; }
                });
                setTimeout(() => {
                    activeEffects.trapFrenzy = false;
                    // Reset speeds to normal random values
                    traps.forEach(t => { if (t.active) { t.vx = (Math.random() - 0.5) * 1.5; t.vy = (Math.random() - 0.5) * 1.5; } });
                }, SPECIAL_EFFECT_DURATION);
            }
            break;
    }
    return chosenEffect;
}

/**
 * Initializes the server-side logic for the Collaborative Ball Game.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 */
function initializeBallGame(io) {
    // --- Server-side Game Loop for Physics and Logic ---
    setInterval(() => {
        // Iterate over all active game sessions
        for (const [sessionId, session] of gameSessions.entries()) {
            if (!session.gameActive) continue; // Don't run physics if game is over for this session

            const { ballState, traps, capturedUserNames, activeEffects } = session;

            // Apply friction to ball
            ballState.vx *= BALL_FRICTION;
            ballState.vy *= BALL_FRICTION;

            // Update position
            ballState.x += ballState.vx;
            ballState.y += ballState.vy;

            // Handle ball collisions with canvas edges
            if (ballState.x - BALL_RADIUS < 0) {
                ballState.x = BALL_RADIUS;
                ballState.vx *= -1; // Reverse velocity
            } else if (ballState.x + BALL_RADIUS > GAME_CANVAS_WIDTH) {
                ballState.x = GAME_CANVAS_WIDTH - BALL_RADIUS;
                ballState.vx *= -1;
            }
            if (ballState.y - BALL_RADIUS < 0) {
                ballState.y = BALL_RADIUS;
                ballState.vy *= -1;
            } else if (ballState.y + BALL_RADIUS > GAME_CANVAS_HEIGHT) {
                ballState.y = GAME_CANVAS_HEIGHT - BALL_RADIUS;
                ballState.vy *= -1;
            }

            // --- Update Trap Positions (make them move) ---
            for (const trap of traps) {
                // Only move active traps
                trap.x += trap.vx;
                trap.y += trap.vy;

                // Handle trap collisions with canvas edges
                if (trap.x - TRAP_RADIUS < 0) {
                    trap.x = TRAP_RADIUS;
                    trap.vx *= -1;
                } else if (trap.x + TRAP_RADIUS > GAME_CANVAS_WIDTH) {
                    trap.x = GAME_CANVAS_WIDTH - TRAP_RADIUS;
                    trap.vx *= -1;
                }
                if (trap.y - TRAP_RADIUS < 0) {
                    trap.y = TRAP_RADIUS;
                    trap.vy *= -1;
                } else if (trap.y + TRAP_RADIUS > GAME_CANVAS_HEIGHT) {
                    trap.y = GAME_CANVAS_HEIGHT - TRAP_RADIUS;
                    trap.vy *= -1;
                }
            }

            // --- Trap Collision Detection ---
            let capturedThisTick = false;
            for (const trap of traps) {
                if (trap.active) {
                    const dx = ballState.x - trap.x;
                    const dy = ballState.y - trap.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < (BALL_RADIUS * activeEffects.sizeChange) + TRAP_RADIUS) {
                        trap.active = false;
                        capturedUserNames.push(trap.userName);
                        const effect = triggerRandomEffect(sessionId, io); // Pass sessionId
                        io.to(sessionId).emit('trap-captured', { trapId: trap.id, userName: trap.userName, effect: effect });
                        capturedThisTick = true;
                    }
                }
            }

            // --- Game Over Check ---
            if (capturedThisTick && session.gameActive) {
                const allTrapsHit = traps.length > 0 && traps.every(trap => !trap.active);
                if (allTrapsHit) {
                    console.log(`Session ${sessionId}: Game Over!`);
                    session.gameActive = false;
                    io.to(sessionId).emit('game-over', capturedUserNames);
                    // Optionally, remove session after a delay or on explicit client request
                    // setTimeout(() => gameSessions.delete(sessionId), 300000); // Remove after 5 minutes of inactivity
                }
            }

            // Broadcast the updated game state to all connected clients in this session's room
            io.to(sessionId).emit('game-state-update', { ball: ballState, traps, activeEffects });
        }
    }, SERVER_TICK_RATE);

    // This function will be called for each new client connection
    return function handleConnection(socket) {
        // Event for a client to request creating a new session
        socket.on('create-session', (data) => {
            const newSessionId = generateSessionId();
            // Create the session with default names or names provided by the client
            const names = (data && Array.isArray(data.names) && data.names.length > 0) ? data.names : ['Player1', 'Player2', 'Player3'];
            createOrUpdateGameSession(newSessionId, names, io);
            socket.join(newSessionId); // Join the new session's room
            console.log(`Socket ${socket.id} created and joined new session: ${newSessionId}`);
            socket.emit('session-created', { sessionId: newSessionId });
        });

        // Event for a client to join an existing session
        socket.on('join-session', (data) => {
            const { sessionId, names } = data;
            if (!sessionId || typeof sessionId !== 'string') {
                console.warn(`Socket ${socket.id} attempted to join with invalid sessionId: ${sessionId}`);
                socket.emit('join-session-failed', { message: 'Invalid session ID.' });
                return;
            }

            // If session doesn't exist, create it (e.g., if first user to visit URL)
            if (!gameSessions.has(sessionId)) {
                console.log(`Socket ${socket.id} joining and creating new session: ${sessionId}`);
                // Use provided names, or default if none
                const initialNames = (Array.isArray(names) && names.length > 0) ? names : ['Player1', 'Player2', 'Player3'];
                createOrUpdateGameSession(sessionId, initialNames, io);
            } else {
                console.log(`Socket ${socket.id} joined existing session: ${sessionId}`);
            }

            socket.join(sessionId); // Join the specific room for this session
            const session = gameSessions.get(sessionId);
            // Send initial state to the newly joined client
            socket.emit('game-state-update', { ball: session.ballState, traps: session.traps, activeEffects: session.activeEffects });
            socket.emit('join-session-success', { sessionId: sessionId });
        });

        // Listen for force application from this specific client within a session
        socket.on('apply-force', (data) => {
            const { sessionId, clickX, clickY } = data;
            const session = gameSessions.get(sessionId);
            if (!session || !session.gameActive) {
                console.warn(`Apply force to non-existent or inactive session: ${sessionId}`);
                return;
            }

            const { ballState } = session;
            const dx = clickX - ballState.x;
            const dy = clickY - ballState.y;
            const magnitude = Math.sqrt(dx * dx + dy * dy);

            if (magnitude > 0) {
                const normalizedDx = dx / magnitude;
                const normalizedDy = dy / magnitude;

                ballState.vx += normalizedDx * FORCE_MULTIPLIER;
                ballState.vy += normalizedDy * FORCE_MULTIPLIER;

                // Optional: Limit max velocity
                const maxSpeed = 10;
                const currentSpeed = Math.sqrt(ballState.vx * ballState.vx + ballState.vy * ballState.vy);
                if (currentSpeed > maxSpeed) {
                    ballState.vx = (ballState.vx / currentSpeed) * maxSpeed;
                    ballState.vy = (ballState.vy / currentSpeed) * maxSpeed;
                }
            }
        });

        // Listen for a client explicitly resetting the game with a new list of names for a specific session.
        socket.on('reset-game-with-names', (data) => {
            const { sessionId, names } = data;
            // Basic validation
            if (!sessionId || typeof sessionId !== 'string' || !Array.isArray(names) || names.length === 0 || !names.every(n => typeof n === 'string')) {
                console.warn(`Invalid reset-game-with-names request for session: ${sessionId}`);
                return;
            }
            console.log(`Session ${sessionId}: Game reset requested by a client.`);
            createOrUpdateGameSession(sessionId, names, io); // This will reset and update traps
        });

        // Handle client disconnection
        socket.on('disconnect', () => {
            // In a real application, you might want to track which sessions a socket was in
            // and potentially clean up sessions if they become empty.
            console.log(`Socket ${socket.id} disconnected.`);
        });
    };
}

module.exports = initializeBallGame;