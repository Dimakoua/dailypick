// ballGameSession.js

export class BallGameSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    console.log(`[DO Debug] BallGameSession constructor called for Durable Object ID: ${this.state.id}`);

    this.users = new Map();

    // Game constants (ensure consistency with client)
    this.GAME_CANVAS_WIDTH = 800;
    this.GAME_CANVAS_HEIGHT = 600;
    this.BALL_RADIUS = 15; // Client uses 15, but server might send 10. Let's make it consistent.
    this.SERVER_BALL_RADIUS = 10; // Server's internal ball radius for calculations
    this.TRAP_RADIUS = 25;
    this.BALL_FRICTION = 0.98;
    this.FORCE_MULTIPLIER = 0.5;
    this.SERVER_TICK_RATE = 1000 / 60; // 60 ticks per second
    this.SPECIAL_EFFECT_DURATION = 3000;

    this.gameState = null; // Will be loaded or initialized
    this.gameLoopInterval = null; // Controls the setInterval for the game loop

    // Use blockConcurrencyWhile to ensure state is loaded/initialized before any messages are processed.
    this.state.blockConcurrencyWhile(async () => {
        let storedGameState = await this.state.storage.get('gameState');

        if (storedGameState) {
            this.gameState = storedGameState;
            console.log(`[DO Debug] Loaded existing game state for DO ID: ${this.state.id}. GameActive: ${this.gameState.gameActive}, Ball X: ${this.gameState.ballState.x?.toFixed(2)}, Y: ${this.gameState.ballState.y?.toFixed(2)}`);

            // Ensure gameActive is true if it was persisted as such.
            // If the game ended previously, it might be false.
            // Decide if you want a reloaded DO to resume a 'game over' state or reset it.
            // For now, let's assume if it loads, it resumes its active status.
            console.log('this.gameState');
            console.log(this.gameState);
            if (this.gameState.gameActive) {
                this.startGameLoop(); // Attempt to start the loop
            }else if (!this.gameState.gameActive || this.gameState.gameStatus === 'game-over') {
                this.broadcast(JSON.stringify({ type: 'game-over', capturedUserNames: this.gameState.capturedUserNames, sessionId: this.state.id }));
            } else {
                console.log(`[DO Debug] Game state loaded but game is not active for DO ID ${this.state.id}.`);
                // If game is not active, clients will only see the final state unless reset.
            }

        } else {
            console.log(`[DO Debug] No existing game state found for DO ID ${this.state.id}. Initializing new game state.`);
            // Initialize with default names for a brand new DO instance
            await this.initializeGameState(['Player1', 'Player2', 'Player3']);
            console.log(`[DO Debug] BallGameSession initialized (new) for DO ID: ${this.state.id}`);
        }
    });
  }

  // Helper to manage the game loop interval
  startGameLoop() {
    if (!this.gameLoopInterval) {
        this.gameLoopInterval = setInterval(() => this.gameLoop(), this.SERVER_TICK_RATE);
        console.log(`[DO Debug] Game loop started for DO ID ${this.state.id}.`);
    } else {
        console.log(`[DO Debug] Game loop already running for DO ID ${this.state.id}.`);
    }
  }

  stopGameLoop() {
    if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval);
        this.gameLoopInterval = null;
        console.log(`[DO Debug] Game loop stopped for DO ID ${this.state.id}.`);
    }
  }

  // Durable Object's instance fetch method
  async fetch(request) {
    console.log(`[DO Debug] Durable Object ${this.state.id} received fetch request: ${request.url}`);
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader === 'websocket') {
      const { 0: client, 1: server } = new WebSocketPair();
      this.handleSession(server); // This is not awaited as it sets up event listeners
      console.log(`[DO Debug] DO ${this.state.id}: Upgrading to WebSocket.`);
      return new Response(null, { status: 101, webSocket: client });
    } else {
      console.warn(`[DO Debug] DO ${this.state.id}: Non-WebSocket request received.`);
      return new Response('Not a WebSocket upgrade request', { status: 400 });
    }
  }

  async initializeGameState(names) {
    console.log(`[DO Debug] Initializing NEW game state for DO ID ${this.state.id} with names:`, names);
    this.gameState = {
      // Use SERVER_BALL_RADIUS for server-side state
      ballState: { x: this.GAME_CANVAS_WIDTH / 2, y: this.GAME_CANVAS_HEIGHT / 2, vx: 0, vy: 0, radius: this.SERVER_BALL_RADIUS, color: "#E32636" },
      traps: [],
      capturedUserNames: [],
      gameStatus: 'countdown',
      startTime: Date.now() + 30000,
      gameActive: false,
      activeEffects: {
        speedBoost: false,
        sizeChange: 1,
        trapFrenzy: false
      },
    };

    // Initialize traps with random positions and initial velocities
    this.gameState.traps = names.map((name, index) => ({
      id: `${Date.now()}-${index}`,
      userName: name,
      active: true,
      x: this.TRAP_RADIUS + Math.random() * (this.GAME_CANVAS_WIDTH - this.TRAP_RADIUS * 2),
      y: this.TRAP_RADIUS + Math.random() * (this.GAME_CANVAS_HEIGHT - this.TRAP_RADIUS * 2),
      vx: (Math.random() - 0.5) * 1.5, // Initial random velocity
      vy: (Math.random() - 0.5) * 1.5, // Initial random velocity
    }));

    await this.state.storage.put('gameState', this.gameState);
    console.log(`[DO Debug] NEW game state persisted for DO ID ${this.state.id}. Ball Initial:`, this.gameState.ballState);

    // Always start the game loop when a new game state is initialized and set to active
    this.startGameLoop(); // Use the helper function

    // Broadcast a game-reset to all currently connected clients
    if (this.users.size > 0) {
      this.broadcast(JSON.stringify({ type: 'game-reset', sessionId: this.state.id }));
      console.log(`[DO Debug] Broadcasted game-reset for DO ID ${this.state.id}.`);
    }
  }

  async resetGameWithNames(names) {
    console.log(`[DO Debug] Resetting game for DO ID ${this.state.id} with new names.`);
    this.stopGameLoop(); // Stop current loop before re-initializing
    await this.initializeGameState(names); // Re-initialize game state with new names
    // The initializeGameState will handle starting the loop and broadcasting reset.
  }

  handleSession(server) {
    server.accept();

    const userId = crypto.randomUUID();
    this.users.set(userId, server);
    console.log(`[DO Debug] Socket ${userId} connected to DO ID ${this.state.id}. Total users in session: ${this.users.size}`);

    // Immediately send the current game state to the newly joined client
    if (this.gameState) {
        if (this.gameState.gameActive && !this.gameLoopInterval) {
            console.log(`[DO Debug] User ${userId} connected to active game in DO ID ${this.state.id}. Restarting game loop.`);
            this.startGameLoop();
        }

        server.send(JSON.stringify({
            type: 'game-state-update',
            ball: this.gameState.ballState,
            traps: this.gameState.traps,
            activeEffects: this.gameState.activeEffects,
            sessionId: this.state.id
        }));
    } else {
        // This case should ideally not happen if blockConcurrencyWhile ensures state is ready
        console.warn(`[DO Debug] gameState is not ready when new user ${userId} connected to DO ID ${this.state.id}.`);
    }
    server.send(JSON.stringify({ type: 'join-session-success', sessionId: this.state.id }));

    server.addEventListener('message', async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'reset-game-with-names') {
        if (Array.isArray(data.names) && data.names.length > 0 && data.names.every(n => typeof n === 'string')) {
          await this.resetGameWithNames(data.names);
        } else {
          console.warn(`[DO Debug] Invalid 'reset-game-with-names' request for DO ID ${this.state.id}:`, data.names);
        }
      } else if (data.type === 'apply-force') {
        this.applyForce(data.clickX, data.clickY);
      }
    });

    server.addEventListener('close', async () => {
      this.users.delete(userId);
      console.log(`[DO Debug] Socket ${userId} disconnected from DO ID ${this.state.id}. Remaining users: ${this.users.size}`);

      // Stop the game loop if no users are connected to save resources.
      if (this.users.size === 0) {
        console.log(`[DO Debug] No users left in DO ID ${this.state.id}. Stopping game loop.`);
        this.stopGameLoop();
        // You could also set a Durable Object Alarm here to delete state after prolonged inactivity
        // if you want to completely clean up DO instances not just stop the game loop.
      }
    });
  }

  applyForce(clickX, clickY) {
    if (!this.gameState || !this.gameState.gameActive) return;

    const { ballState } = this.gameState;
    const dx = clickX - ballState.x;
    const dy = clickY - ballState.y;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude > 0) {
      const normalizedDx = dx / magnitude;
      const normalizedDy = dy / magnitude;

      // Ensure that applying force doesn't introduce NaN or Infinity
      ballState.vx = (ballState.vx + normalizedDx * this.FORCE_MULTIPLIER);
      ballState.vy = (ballState.vy + normalizedDy * this.FORCE_MULTIPLIER);

      // Add a check to reset velocity if it becomes NaN/Infinity
      if (isNaN(ballState.vx) || isNaN(ballState.vy)) {
          console.error(`[DO Debug] Ball velocity became NaN/Infinity during force application for DO ID ${this.state.id}. Resetting velocity.`);
          ballState.vx = 0;
          ballState.vy = 0;
      }

      const maxSpeed = 10;
      const currentSpeed = Math.sqrt(ballState.vx * ballState.vx + ballState.vy * ballState.vy);
      if (currentSpeed > maxSpeed) {
        ballState.vx = (ballState.vx / currentSpeed) * maxSpeed;
        ballState.vy = (ballState.vy / currentSpeed) * maxSpeed;
      }
    }
  }

  async gameLoop() {
    if (!this.gameState) return;

    if (this.gameState.gameStatus === 'countdown') {
      if (Date.now() >= this.gameState.startTime) {
        this.gameState.gameStatus = 'running';
        this.gameState.gameActive = true;
      } else {
        // broadcast countdown time
        this.broadcast(JSON.stringify({ 
          type: 'countdown', 
          startTime: this.gameState.startTime,
          sessionId: this.state.id
        }));
        return;
      }
    }

    if (!this.gameState.gameActive) {
        // If the game is not active, stop the loop if it's somehow still running
        if (this.gameLoopInterval) {
            console.warn(`[DO Debug] Game loop found active but gameActive is false for DO ID ${this.state.id}. Stopping loop.`);
            this.stopGameLoop();
        }
        return;
    }

    const { ballState, traps, capturedUserNames, activeEffects } = this.gameState;

    // Apply friction to ball
    ballState.vx *= this.BALL_FRICTION;
    ballState.vy *= this.BALL_FRICTION;

    // Update ball position
    ballState.x += ballState.vx;
    ballState.y += ballState.vy;

    // Ensure ball position doesn't become NaN/Infinity after movement
    if (isNaN(ballState.x) || isNaN(ballState.y)) {
        console.error(`[DO Debug] Ball position became NaN/Infinity after movement for DO ID ${this.state.id}. Resetting position.`);
        ballState.x = this.GAME_CANVAS_WIDTH / 2;
        ballState.y = this.GAME_CANVAS_HEIGHT / 2;
        ballState.vx = 0;
        ballState.vy = 0;
    }

    // Handle ball collisions with canvas edges
    // Use SERVER_BALL_RADIUS for server-side collision checks
    if (ballState.x - this.SERVER_BALL_RADIUS < 0) {
      ballState.x = this.SERVER_BALL_RADIUS;
      ballState.vx *= -1;
    } else if (ballState.x + this.SERVER_BALL_RADIUS > this.GAME_CANVAS_WIDTH) {
      ballState.x = this.GAME_CANVAS_WIDTH - this.SERVER_BALL_RADIUS;
      ballState.vx *= -1;
    }
    if (ballState.y - this.SERVER_BALL_RADIUS < 0) {
      ballState.y = this.SERVER_BALL_RADIUS;
      ballState.vy *= -1;
    } else if (ballState.y + this.SERVER_BALL_RADIUS > this.GAME_CANVAS_HEIGHT) {
      ballState.y = this.GAME_CANVAS_HEIGHT - this.SERVER_BALL_RADIUS;
      ballState.vy *= -1;
    }

    // Update Trap Positions (make them move)
    for (const trap of traps) {
      if (trap.active) { // Only move active traps
          trap.x += trap.vx;
          trap.y += trap.vy;

          // Ensure trap position doesn't become NaN/Infinity
          if (isNaN(trap.x) || isNaN(trap.y)) {
              console.error(`[DO Debug] Trap ${trap.userName} position became NaN/Infinity for DO ID ${this.state.id}. Resetting position.`);
              trap.x = this.TRAP_RADIUS + Math.random() * (this.GAME_CANVAS_WIDTH - this.TRAP_RADIUS * 2);
              trap.y = this.TRAP_RADIUS + Math.random() * (this.GAME_CANVAS_HEIGHT - this.TRAP_RADIUS * 2);
              trap.vx = (Math.random() - 0.5) * 1.5;
              trap.vy = (Math.random() - 0.5) * 1.5;
          }

          // Handle trap collisions with canvas edges
          if (trap.x - this.TRAP_RADIUS < 0) {
            trap.x = this.TRAP_RADIUS;
            trap.vx *= -1;
          } else if (trap.x + this.TRAP_RADIUS > this.GAME_CANVAS_WIDTH) {
            trap.x = this.GAME_CANVAS_WIDTH - this.TRAP_RADIUS;
            trap.vx *= -1;
          }
          if (trap.y - this.TRAP_RADIUS < 0) {
            trap.y = this.TRAP_RADIUS;
            trap.vy *= -1;
          } else if (trap.y + this.TRAP_RADIUS > this.GAME_CANVAS_HEIGHT) {
            trap.y = this.GAME_CANVAS_HEIGHT - this.TRAP_RADIUS;
            trap.vy *= -1;
          }
      }
    }

    // Trap Collision Detection
    let capturedThisTick = false;
    for (const trap of traps) {
      if (trap.active) {
        const dx = ballState.x - trap.x;
        const dy = ballState.y - trap.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Collision check based on current ball size effect
        if (distance < (this.SERVER_BALL_RADIUS * activeEffects.sizeChange) + this.TRAP_RADIUS) {
          trap.active = false;
          capturedUserNames.push(trap.userName);
          const effect = this.triggerRandomEffect();
          this.broadcast(JSON.stringify({ type: 'trap-captured', trapId: trap.id, userName: trap.userName, effect: effect, sessionId: this.state.id }));
          capturedThisTick = true;
        }
      }
    }

    // Game Over Check
    if (this.gameState.gameActive && traps.length > 0) { // Check if there are traps to begin with
      const allTrapsHit = traps.every(trap => !trap.active);
      if (allTrapsHit) {
        console.log(`[DO Debug] DO ID ${this.state.id}: Game Over! All traps captured.`);
        this.gameState.gameActive = false; // Set game to inactive
        this.gameState.gameStatus = 'game-over';
        this.stopGameLoop(); // Stop the game loop on game over
        this.broadcast(JSON.stringify({ type: 'game-over', capturedUserNames, sessionId: this.state.id }));
      }
    }


    // Persist game state changes every tick
    await this.state.storage.put('gameState', this.gameState);

    // Broadcast the updated game state to all connected clients in this session
    // Only broadcast if there are connected users and game is active
    if (this.users.size > 0 && this.gameState.gameActive) { // Only broadcast if active and users
        const messageToSend = {
            type: 'game-state-update',
            ball: ballState,
            traps, // Ensure traps are included
            activeEffects,
            sessionId: this.state.id
        };
        console.log(`[DO Debug] Broadcasting game-state-update for DO ID ${this.state.id}. Ball Pos: (${ballState.x.toFixed(2)}, ${ballState.y.toFixed(2)}), Traps Active: ${traps.filter(t => t.active).length}`);
        this.broadcast(JSON.stringify(messageToSend));
    } else if (this.users.size === 0) {
        // No users, so loop should be stopped by handleSession close event.
        // If it's still running here, it's a bug.
        console.warn(`[DO Debug] Game loop still running with no users for DO ID ${this.state.id}.`);
    } else if (!this.gameState.gameActive) {
        console.log(`[DO Debug] Game not active, not broadcasting game-state-update for DO ID ${this.state.id}.`);
    }
  }

  triggerRandomEffect() {
    const { ballState, activeEffects, traps } = this.gameState;
    const effects = ['speedBoost', 'sizeChange', 'trapFrenzy', 'none', 'none', 'none']; // More 'none' to make effects rarer
    const chosenEffect = effects[Math.floor(Math.random() * effects.length)];

    console.log(`[DO Debug] DO ID ${this.state.id}: Triggering effect: ${chosenEffect}`);

    switch (chosenEffect) {
      case 'speedBoost':
        if (!activeEffects.speedBoost) {
          activeEffects.speedBoost = true;
          ballState.vx *= 2.5;
          ballState.vy *= 2.5;
          setTimeout(() => {
            activeEffects.speedBoost = false;
            // Optionally, revert velocity or just let friction take over
          }, this.SPECIAL_EFFECT_DURATION);
        }
        break;
      case 'sizeChange':
        // Only apply if not already changed from default (1)
        if (activeEffects.sizeChange === 1) {
          const newSize = Math.random() > 0.5 ? 2 : 0.5; // Double or half size
          activeEffects.sizeChange = newSize;
          setTimeout(() => { activeEffects.sizeChange = 1; }, this.SPECIAL_EFFECT_DURATION);
        }
        break;
      case 'trapFrenzy':
        if (!activeEffects.trapFrenzy) {
          activeEffects.trapFrenzy = true;
          traps.forEach(t => {
            if (t.active) {
                t.vx *= 2; // Double trap speed
                t.vy *= 2;
            }
          });
          setTimeout(() => {
            activeEffects.trapFrenzy = false;
            // Reset trap speeds after frenzy
            traps.forEach(t => {
                if (t.active) {
                    t.vx = (Math.random() - 0.5) * 1.5;
                    t.vy = (Math.random() - 0.5) * 1.5;
                }
            });
          }, this.SPECIAL_EFFECT_DURATION);
        }
        break;
    }
    return chosenEffect;
  }

  broadcast(message) {
    for (const user of this.users.values()) {
      try {
        user.send(message);
      } catch (e) {
        console.error(`[DO Debug] Error sending message to user in DO ID ${this.state.id}:`, e);
      }
    }
  }
}