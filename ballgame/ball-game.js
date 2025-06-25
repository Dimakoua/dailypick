// --- Collaborative Ball Game Module ---

// Game constants
const GAME_CANVAS_WIDTH = 800;
const GAME_CANVAS_HEIGHT = 600;
const BALL_RADIUS = 20;
const BALL_FRICTION = 0.98; // Reduces velocity over time
const FORCE_MULTIPLIER = 0.5; // How much a click affects velocity
const SERVER_TICK_RATE = 1000 / 60; // 60 updates per second

// Initial ball state (authoritative on the server)
let ballState = { x: GAME_CANVAS_WIDTH / 2, y: GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0 };

/**
 * Initializes the server-side logic for the Collaborative Ball Game.
 * @param {import('socket.io').Server} io - The main Socket.IO server instance.
 */
function initializeBallGame(io) {
    // --- Server-side Game Loop for Ball Physics ---
    setInterval(() => {
        // Apply friction
        ballState.vx *= BALL_FRICTION;
        ballState.vy *= BALL_FRICTION;

        // Update position
        ballState.x += ballState.vx;
        ballState.y += ballState.vy;

        // Handle collisions with canvas edges
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

        // Broadcast the updated ball state to all connected clients
        io.emit('ball-state-update', ballState);
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
    };
}

module.exports = initializeBallGame;