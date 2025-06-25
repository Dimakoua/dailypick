// --- Collaborative Ball Game Module ---

// Game constants
const GAME_CANVAS_WIDTH = 800;
const GAME_CANVAS_HEIGHT = 600;
const BALL_RADIUS = 15; // Made ball slightly smaller
const TRAP_RADIUS = 25; // Constant for traps
const BALL_FRICTION = 0.98; // Reduces velocity over time
const FORCE_MULTIPLIER = 0.5; // How much a click affects velocity
const SERVER_TICK_RATE = 1000 / 60; // 60 updates per second

// Game state (authoritative on the server)
let ballState = { x: GAME_CANVAS_WIDTH / 2, y: GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0 };
let traps = []; // Store traps as an array of objects
let capturedUserNames = []; // List of users whose traps were hit
let gameActive = true; // To control game state

/**
 * Creates a new set of traps based on a list of names.
 * This function is called when a client wants to set up or reset the game.
 * @param {string[]} names - An array of player names.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 */
function setupNewGame(names, io) {
    console.log("Setting up new game with names:", names);
    traps = names.map((name, index) => ({
        id: `${Date.now()}-${index}`, // Unique ID for the trap
        userName: name,
        active: true,
        // The rest will be set by resetGame
        x: 0, y: 0, vx: 0, vy: 0,
    }));
    resetGame(io); // Reset ball, set trap positions, and broadcast
}

/**
 * Resets the game to its initial state.
 */
function resetGame(io) {
    console.log("Resetting game...");
    ballState = { x: GAME_CANVAS_WIDTH / 2, y: GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0 };
    capturedUserNames = [];
    // Reset all existing traps to be active and give them new random positions/velocities
    traps.forEach(trap => {
        trap.active = true;
        trap.x = TRAP_RADIUS + Math.random() * (GAME_CANVAS_WIDTH - TRAP_RADIUS * 2);
        trap.y = TRAP_RADIUS + Math.random() * (GAME_CANVAS_HEIGHT - TRAP_RADIUS * 2);
        trap.vx = (Math.random() - 0.5) * 1.5;
        trap.vy = (Math.random() - 0.5) * 1.5;
    });
    gameActive = true;
    // A specific event clients can listen to for clearing lists
    io.emit('game-reset');
}

/**
 * Initializes the server-side logic for the Collaborative Ball Game.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 */
function initializeBallGame(io) {
    // --- Server-side Game Loop for Physics and Logic ---
    setInterval(() => {
        if (!gameActive) return; // Don't run physics if game is over

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

                if (distance < BALL_RADIUS + TRAP_RADIUS) {
                    trap.active = false;
                    capturedUserNames.push(trap.userName);
                    io.emit('trap-captured', { trapId: trap.id, userName: trap.userName });
                    capturedThisTick = true;
                }
            }
        }

        // --- Game Over Check ---
        if (capturedThisTick && gameActive) {
            const allTrapsHit = traps.length > 0 && traps.every(trap => !trap.active);
            if (allTrapsHit) {
                console.log("Game Over!");
                gameActive = false;
                io.emit('game-over', capturedUserNames);
                // Reset the game with the same players after a delay
                setTimeout(() => resetGame(io), 5000);
            }
        }

        // Broadcast the updated game state to all connected clients
        io.emit('game-state-update', { ball: ballState, traps });
    }, SERVER_TICK_RATE);

    // This function will be called for each new client connection
    return function handleConnection(socket) {
        // Listen for force application from this specific client
        socket.on('apply-force', (data) => {
            const dx = data.clickX - ballState.x;
            const dy = data.clickY - ballState.y;
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

        // Listen for a client's request to set up the game on initial load.
        // This will only run if the game hasn't started yet.
        socket.on('request-initial-setup', (names) => {
            if (traps.length === 0 && Array.isArray(names) && names.length > 0 && names.every(n => typeof n === 'string')) {
                console.log('Initial game setup by first client.');
                setupNewGame(names, io);
            }
        });

        // Listen for a client explicitly resetting the game with a new list of names.
        // This will reset the game for everyone.
        socket.on('reset-game-with-names', (names) => {
            // Basic validation
            if (Array.isArray(names) && names.length > 0 && names.every(n => typeof n === 'string')) {
                console.log('Game reset requested by a client.');
                setupNewGame(names, io);
            }
        });
    };
}

module.exports = initializeBallGame;