(() => {
  // DOM Elements
  const playerNameInput = document.getElementById('playerNameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const startRoomBtn = document.getElementById('startRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const startGameBtn = document.getElementById('startGameBtn');
  const resetGameBtn = document.getElementById('resetGameBtn');
  const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');
  const sessionStatus = document.getElementById('sessionStatus');
  const hostControls = document.getElementById('hostControls');
  const waitingMessage = document.getElementById('waitingMessage');
  const playersList = document.getElementById('playersList');
  const deathOrderList = document.getElementById('deathOrderList');
  const activePlayersList = document.getElementById('activePlayersList');
  
  const lobbySection = document.getElementById('lobbySection');
  const gameSection = document.getElementById('gameSection');
  const victorySection = document.getElementById('victorySection');
  const backToLobbyBtn = document.getElementById('backToLobbyBtn');
  
  const gameCanvas = document.getElementById('gameCanvas');
  const ctx = gameCanvas.getContext('2d');
  const healthDisplay = document.getElementById('healthDisplay');
  const killsDisplay = document.getElementById('killsDisplay');
  const gameMessage = document.getElementById('gameMessage');
  const victoryMessage = document.getElementById('victoryMessage');
  const finalResultsList = document.getElementById('finalResultsList');

  const STANDUP_SOURCE = 'snowball-fight';
  const LOCAL_NAME_KEY = 'snowballFightPlayerName';

  // Random name generator constants (must be defined before use)
  const ADJECTIVES = ['Frosty', 'Icy', 'Snowy', 'Chilly', 'Arctic', 'Frozen', 'Cool', 'Winter', 'Blizzard', 'Crystal'];
  const NOUNS = ['Warrior', 'Champion', 'Fighter', 'Hero', 'Ninja', 'Master', 'Legend', 'Storm', 'Knight', 'Beast'];

  function generateRandomName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
  }

  // Game State
  let ws = null;
  let sessionId = null;
  let userId = null;
  let playerName = localStorage.getItem(LOCAL_NAME_KEY) || generateRandomName();
  let isHost = false;
  let gameState = 'lobby'; // lobby, playing, finished
  
  // Player state
  let myPlayer = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    health: 5,
    kills: 0,
    isAlive: true,
    color: '#3498db'
  };

  let players = new Map(); // Other players
  let snowballs = [];
  let particles = [];
  let hitEffects = []; // Visual hit effects on players
  let screenShake = { intensity: 0, duration: 0 };
  let keys = {};
  let mousePos = { x: 0, y: 0 };
  let lastThrowTime = 0;
  const THROW_COOLDOWN = 500; // ms
  let lastPositionSendTime = 0;
  const POSITION_SEND_INTERVAL = 100; // Send position every 100ms max

  // Constants
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 900;
  const PLAYER_SIZE = 40;
  const SNOWBALL_SIZE = 6;
  const PLAYER_SPEED = 3;
  const SNOWBALL_SPEED = 8;

  // Snow forts (obstacles)
  const snowForts = [
    { x: 600, y: 450, width: 120, height: 60 },
    { x: 300, y: 300, width: 90, height: 45 },
    { x: 900, y: 600, width: 90, height: 45 },
    { x: 225, y: 675, width: 75, height: 38 },
    { x: 975, y: 225, width: 75, height: 38 },
  ];

  // Check if position overlaps with any obstacle
  function isPositionValid(x, y, playerSize = PLAYER_SIZE) {
    const padding = playerSize / 2;
    for (const fort of snowForts) {
      if (x + padding > fort.x - fort.width / 2 &&
          x - padding < fort.x + fort.width / 2 &&
          y + padding > fort.y - fort.height / 2 &&
          y - padding < fort.y + fort.height / 2) {
        return false;
      }
    }
    return true;
  }

  // Get a valid spawn position
  function getValidSpawnPosition() {
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      x = Math.random() * (CANVAS_WIDTH - 100) + 50;
      y = Math.random() * (CANVAS_HEIGHT - 100) + 50;
      attempts++;
    } while (!isPositionValid(x, y) && attempts < maxAttempts);
    
    return { x, y };
  }

  // Team colors for classic look
  const TEAM_COLORS = {
    green: { body: '#2ecc71', dark: '#27ae60', pants: '#3498db' },
    red: { body: '#e74c3c', dark: '#c0392b', pants: '#3498db' },
    blue: { body: '#3498db', dark: '#2980b9', pants: '#2c3e50' },
    yellow: { body: '#f1c40f', dark: '#f39c12', pants: '#3498db' },
    purple: { body: '#9b59b6', dark: '#8e44ad', pants: '#3498db' },
    orange: { body: '#e67e22', dark: '#d35400', pants: '#3498db' },
  };

  // Initialize
  playerNameInput.value = playerName;

  // Standup roster emission
  function emitStandupRoster(entries) {
    const participants = [];
    const seen = new Set();
    if (Array.isArray(entries)) {
      entries.forEach((entry, index) => {
        let candidate = '';
        if (entry && typeof entry.name === 'string') {
          candidate = entry.name.trim();
        }
        if (!candidate) {
          candidate = `Player ${index + 1}`;
        }
        const key = candidate.toLowerCase();
        if (!key || seen.has(key)) {
          return;
        }
        seen.add(key);
        participants.push(candidate);
      });
    }
    window.dispatchEvent(
      new CustomEvent('standup:queue-reset', {
        detail: { source: STANDUP_SOURCE, participants },
      })
    );
    window.dispatchEvent(
      new CustomEvent('standup:queue', {
        detail: {
          source: STANDUP_SOURCE,
          mode: 'manual',
          participants,
        },
      })
    );
  }

  // Event Listeners
  saveNameBtn.addEventListener('click', () => {
    playerName = playerNameInput.value.trim() || generateRandomName();
    playerNameInput.value = playerName;
    localStorage.setItem(LOCAL_NAME_KEY, playerName);
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendPlayerName();
    }
    showMessage('Name saved!');
  });

  startRoomBtn.addEventListener('click', () => {
    const newSessionId = generateSessionId();
    updateUrlWithSession(newSessionId);
    connectToRoom(newSessionId, true);
  });

  joinRoomBtn.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const existingSessionId = urlParams.get('session_id');
    if (existingSessionId) {
      connectToRoom(existingSessionId, false);
    } else {
      showMessage('No session ID in URL. Create a new room or use an invite link.');
    }
  });

  copyLinkBtn.addEventListener('click', copyInviteLink);

  startGameBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'start-game' }));
    }
  });

  resetGameBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reset-game' }));
    }
  });

  clearLeaderboardBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN && confirm('Clear all leaderboard data?')) {
      ws.send(JSON.stringify({ type: 'clear-leaderboard' }));
    }
  });

  backToLobbyBtn.addEventListener('click', () => {
    showSection('lobby');
  });

  // Input handlers
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (gameState === 'playing' && myPlayer.isAlive) {
      if (e.key === ' ') {
        e.preventDefault();
        throwSnowball();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  gameCanvas.addEventListener('mousemove', (e) => {
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    mousePos.x = (e.clientX - rect.left) * scaleX;
    mousePos.y = (e.clientY - rect.top) * scaleY;
  });

  gameCanvas.addEventListener('click', () => {
    if (gameState === 'playing' && myPlayer.isAlive) {
      throwSnowball();
    }
  });

  // Auto-join on page load if session_id present
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = urlParams.get('session_id');
    if (sessionIdFromUrl) {
      // Check if this is the host
      const isHostStored = sessionStorage.getItem(`snowball-fight-host-${sessionIdFromUrl}`) === 'true';
      setTimeout(() => connectToRoom(sessionIdFromUrl, isHostStored), 500);
    }
  });

  // Utility Functions
  function generateSessionId() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function updateUrlWithSession(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', id);
    window.history.replaceState({}, '', url.toString());
  }

  function copyInviteLink() {
    if (!sessionId) return;
    const url = `${window.location.origin}/apps/snowball-fight/?session_id=${sessionId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => showMessage('Invite link copied!'))
      .catch(() => showMessage('Failed to copy link.'));
  }

  function showMessage(text) {
    sessionStatus.textContent = text;
  }

  function showSection(section) {
    lobbySection.style.display = section === 'lobby' ? 'grid' : 'none';
    gameSection.style.display = section === 'game' ? 'grid' : 'none';
    victorySection.style.display = section === 'victory' ? 'block' : 'none';
  }

  // WebSocket Functions
  function connectToRoom(targetSessionId, isHostPlayer = false) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    
    sessionId = targetSessionId;
    isHost = isHostPlayer;
    
    if (isHost) {
      sessionStorage.setItem(`snowball-fight-host-${sessionId}`, 'true');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = new URL(`/api/snowball-fight/websocket?session_id=${sessionId}`, window.location.href);
    wsUrl.protocol = protocol;
    ws = new WebSocket(wsUrl.href);

    ws.onopen = () => {
      showMessage(`Connected to room ${sessionId}`);
      copyLinkBtn.disabled = false;
      
      if (isHost) {
        hostControls.style.display = 'block';
        waitingMessage.style.display = 'none';
        startGameBtn.disabled = false;
      } else {
        hostControls.style.display = 'none';
        waitingMessage.style.display = 'block';
      }
      
      sendPlayerName();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (err) {
        console.error('Invalid WS message', err);
      }
    };

    ws.onclose = () => {
      showMessage('Disconnected from room.');
      copyLinkBtn.disabled = true;
      startGameBtn.disabled = true;
    };

    ws.onerror = () => {
      showMessage('Connection error.');
    };
  }

  function sendPlayerName() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set-name', name: playerName }));
    }
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case 'user-id':
        userId = data.id;
        myPlayer.color = generatePlayerColor(userId);
        break;

      case 'game-state':
        gameState = data.state;
        // Show correct section based on game state
        if (gameState === 'playing') {
          showSection('game');
          // Initialize player for mid-game join
          if (myPlayer.x === 400 && myPlayer.y === 300) {
            const spawnPos = getValidSpawnPosition();
            myPlayer.x = spawnPos.x;
            myPlayer.y = spawnPos.y;
          }
          updateHealthDisplay();
          updateKillsDisplay();
          // Start game loop if joining mid-game
          requestAnimationFrame(gameLoop);
        } else if (gameState === 'finished') {
          showSection('victory');
        } else {
          showSection('lobby');
        }
        break;

      case 'player-list':
        updatePlayersList(data.players);
        break;

      case 'death-order-leaderboard':
        updateDeathOrderLeaderboard(data.entries);
        break;

      case 'host-status':
        isHost = data.hostId === userId;
        if (isHost) {
          hostControls.style.display = 'block';
          waitingMessage.style.display = 'none';
          startGameBtn.disabled = gameState !== 'lobby';
        } else {
          hostControls.style.display = 'none';
          waitingMessage.style.display = gameState === 'lobby' ? 'block' : 'none';
        }
        break;

      case 'game-start':
        startGame();
        break;

      case 'player-position':
        updateOtherPlayerPosition(data.playerId, data.position);
        break;

      case 'projectile-created':
        addSnowball(data.projectile);
        break;

      case 'player-damaged':
        if (data.playerId === userId) {
          myPlayer.health = data.health;
          updateHealthDisplay();
          gameMessage.textContent = '💥 Hit!';
          setTimeout(() => gameMessage.textContent = '', 1000);
          // Screen shake when hit
          screenShake = { intensity: 12, duration: 15 };
          // Flash effect on self
          addHitEffect(myPlayer.x, myPlayer.y, userId);
        } else {
          // Update other player's health
          const hitPlayer = players.get(data.playerId);
          if (hitPlayer) {
            hitPlayer.health = data.health;
            // Flash effect on other player
            addHitEffect(hitPlayer.x, hitPlayer.y, data.playerId);
          }
        }
        break;

      case 'player-died':
        if (data.playerId === userId) {
          myPlayer.isAlive = false;
          myPlayer.health = 0;
          updateHealthDisplay();
          gameMessage.textContent = '☠️ You died!';
          // Big screen shake on death
          screenShake = { intensity: 20, duration: 30 };
          // Death explosion effect
          createDeathExplosion(myPlayer.x, myPlayer.y);
        } else {
          const player = players.get(data.playerId);
          if (player) {
            player.isAlive = false;
            player.health = 0;
            // Death explosion for other player
            createDeathExplosion(player.x, player.y);
          }
        }
        if (data.attackerId === userId) {
          myPlayer.kills++;
          updateKillsDisplay();
        }
        break;

      case 'game-end':
        endGame(data.winner, data.deathOrder, data.finalStandings);
        break;

      case 'game-reset':
        resetToLobby();
        break;

      default:
        break;
    }
  }

  function updatePlayersList(playerData) {
    playersList.innerHTML = '';
    if (!playerData || playerData.length === 0) {
      playersList.innerHTML = '<li>No players yet.</li>';
      return;
    }

    playerData.forEach(player => {
      const li = document.createElement('li');
      const isMe = player.id === userId;
      const name = player.name + (isMe ? ' (You)' : '');
      const status = player.isAlive ? '💚' : '💀';
      const health = player.isAlive ? ` (HP: ${player.health})` : '';
      li.innerHTML = `<strong>${name}</strong> ${status}${health}`;
      if (!player.isAlive) {
        li.classList.add('player-dead');
      }
      playersList.appendChild(li);

      // Update players map
      if (!isMe) {
        if (!players.has(player.id)) {
          players.set(player.id, {
            id: player.id,
            name: player.name,
            x: player.position?.x || 400,
            y: player.position?.y || 300,
            isAlive: player.isAlive,
            health: player.health,
            color: generatePlayerColor(player.id)
          });
        } else {
          const p = players.get(player.id);
          p.name = player.name;
          p.isAlive = player.isAlive;
          p.health = player.health;
        }
      }
    });

    // Update active players list (in-game)
    if (activePlayersList) {
      activePlayersList.innerHTML = '';
      playerData.forEach(player => {
        const li = document.createElement('li');
        const isMe = player.id === userId;
        const name = player.name + (isMe ? ' (You)' : '');
        const status = player.isAlive ? '💚' : '💀';
        li.innerHTML = `<span>${name}</span> <span>${status}</span>`;
        if (!player.isAlive) {
          li.classList.add('player-dead');
        }
        activePlayersList.appendChild(li);
      });
    }

    emitStandupRoster(playerData);
  }

  function updateDeathOrderLeaderboard(entries) {
    deathOrderList.innerHTML = '';
    if (!entries || entries.length === 0) {
      deathOrderList.innerHTML = '<li>No deaths recorded yet.</li>';
      return;
    }

    entries.forEach((entry, index) => {
      const li = document.createElement('li');
      const time = formatTime(entry.deathTime);
      li.innerHTML = `${index + 1}. <strong>${entry.name}</strong> (died at ${time}, killed by ${entry.killedBy})`;
      deathOrderList.appendChild(li);
    });
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function generatePlayerColor(id) {
    const colorKeys = Object.keys(TEAM_COLORS);
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colorKeys[hash % colorKeys.length];
  }

  function updateOtherPlayerPosition(playerId, position) {
    if (playerId === userId) return;
    const player = players.get(playerId);
    if (player) {
      player.x = position.x;
      player.y = position.y;
    }
  }

  // Game Logic
  function startGame() {
    gameState = 'playing';
    showSection('game');
    
    // Reset player state
    const spawnPos = getValidSpawnPosition();
    myPlayer.x = spawnPos.x;
    myPlayer.y = spawnPos.y;
    myPlayer.health = 5;
    myPlayer.kills = 0;
    myPlayer.isAlive = true;
    myPlayer.vx = 0;
    myPlayer.vy = 0;
    
    snowballs = [];
    particles = [];
    hitEffects = [];
    screenShake = { intensity: 0, duration: 0 };
    
    updateHealthDisplay();
    updateKillsDisplay();
    gameMessage.textContent = '⛄ Fight!';
    setTimeout(() => gameMessage.textContent = '', 2000);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
  }

  function resetToLobby() {
    gameState = 'lobby';
    showSection('lobby');
    snowballs = [];
    particles = [];
    hitEffects = [];
    screenShake = { intensity: 0, duration: 0 };
    players.clear();
  }

  function endGame(winner, deathOrder, finalStandings) {
    gameState = 'finished';
    showSection('victory');
    
    if (winner && winner.id === userId) {
      victoryMessage.innerHTML = `🏆 <strong>You Won!</strong><br>Kills: ${winner.kills}`;
    } else if (winner) {
      victoryMessage.innerHTML = `🏆 <strong>${winner.name}</strong> won!<br>Kills: ${winner.kills}`;
    } else {
      victoryMessage.innerHTML = 'Game Over!';
    }
    
    // Show final results - all players ranked
    finalResultsList.innerHTML = '';
    if (finalStandings && finalStandings.length > 0) {
      finalStandings.forEach((entry, index) => {
        const li = document.createElement('li');
        const position = index + 1;
        if (entry.status === 'winner') {
          li.innerHTML = `${position}. 🏆 <strong>${entry.name}</strong> (Winner - ${entry.kills} kills)`;
          li.style.color = 'var(--accent-color, #4caf50)';
        } else {
          li.innerHTML = `${position}. <strong>${entry.name}</strong> (eliminated by ${entry.killedBy})`;
        }
        finalResultsList.appendChild(li);
      });
    } else if (deathOrder && deathOrder.length > 0) {
      // Fallback to old format
      deathOrder.forEach((entry, index) => {
        const li = document.createElement('li');
        li.innerHTML = `${index + 1}. <strong>${entry.name}</strong> (killed by ${entry.killedBy})`;
        finalResultsList.appendChild(li);
      });
    }
  }

  function updateHealthDisplay() {
    const hearts = '❤️'.repeat(Math.max(0, myPlayer.health));
    healthDisplay.textContent = `${hearts} Health: ${myPlayer.health}`;
  }

  function updateKillsDisplay() {
    killsDisplay.textContent = `⚔️ Kills: ${myPlayer.kills}`;
  }

  function throwSnowball() {
    const now = Date.now();
    if (now - lastThrowTime < THROW_COOLDOWN) return;
    lastThrowTime = now;
    
    const dx = mousePos.x - myPlayer.x;
    const dy = mousePos.y - myPlayer.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return;
    
    const direction = { x: dx / dist, y: dy / dist };
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'throw-snowball',
        direction,
        position: { x: myPlayer.x, y: myPlayer.y }
      }));
    }
  }

  function addSnowball(projectile) {
    snowballs.push({
      id: projectile.id,
      ownerId: projectile.ownerId,
      x: projectile.position.x,
      y: projectile.position.y,
      vx: projectile.velocity.x,
      vy: projectile.velocity.y,
      createdAt: projectile.createdAt
    });
  }

  // Game Loop
  function gameLoop() {
    if (gameState !== 'playing') return;
    
    update();
    render();
    
    requestAnimationFrame(gameLoop);
  }

  function update() {
    // Update player movement
    if (myPlayer.isAlive) {
      myPlayer.vx = 0;
      myPlayer.vy = 0;
      
      if (keys['w'] || keys['arrowup']) myPlayer.vy = -PLAYER_SPEED;
      if (keys['s'] || keys['arrowdown']) myPlayer.vy = PLAYER_SPEED;
      if (keys['a'] || keys['arrowleft']) myPlayer.vx = -PLAYER_SPEED;
      if (keys['d'] || keys['arrowright']) myPlayer.vx = PLAYER_SPEED;
      
      // Diagonal movement normalization
      if (myPlayer.vx !== 0 && myPlayer.vy !== 0) {
        myPlayer.vx *= 0.707;
        myPlayer.vy *= 0.707;
      }
      
      const newX = myPlayer.x + myPlayer.vx;
      const newY = myPlayer.y + myPlayer.vy;
      
      // Check collision with snow forts
      let canMove = true;
      for (const fort of snowForts) {
        if (checkFortCollision(newX, newY, fort)) {
          canMove = false;
          break;
        }
      }
      
      if (canMove) {
        myPlayer.x = newX;
        myPlayer.y = newY;
      }
      
      // Boundaries
      myPlayer.x = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_WIDTH - PLAYER_SIZE / 2, myPlayer.x));
      myPlayer.y = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_HEIGHT - PLAYER_SIZE / 2, myPlayer.y));
      
      // Send position to server with throttling (every 100ms max)
      const now = Date.now();
      if (now - lastPositionSendTime >= POSITION_SEND_INTERVAL && ws && ws.readyState === WebSocket.OPEN) {
        lastPositionSendTime = now;
        ws.send(JSON.stringify({
          type: 'player-move',
          position: { x: myPlayer.x, y: myPlayer.y }
        }));
      }
    }
    
    // Update snowballs
    for (let i = snowballs.length - 1; i >= 0; i--) {
      const ball = snowballs[i];
      ball.x += ball.vx;
      ball.y += ball.vy;
      
      // Check collision with snow forts (snowballs break on forts)
      let hitFort = false;
      for (const fort of snowForts) {
        if (checkFortCollision(ball.x, ball.y, fort, SNOWBALL_SIZE)) {
          createHitParticles(ball.x, ball.y);
          snowballs.splice(i, 1);
          hitFort = true;
          break;
        }
      }
      if (hitFort) continue;
      
      // Check collision with players
      if (ball.ownerId !== userId && myPlayer.isAlive) {
        const dx = ball.x - myPlayer.x;
        const dy = ball.y - myPlayer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < PLAYER_SIZE / 2 + SNOWBALL_SIZE) {
          // Hit!
          createHitParticles(ball.x, ball.y);
          snowballs.splice(i, 1);
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'player-hit',
              victimId: userId,
              attackerId: ball.ownerId
            }));
          }
          continue;
        }
      }
      
      // Remove if out of bounds or old
      if (ball.x < 0 || ball.x > CANVAS_WIDTH || ball.y < 0 || ball.y > CANVAS_HEIGHT ||
          Date.now() - ball.createdAt > 5000) {
        snowballs.splice(i, 1);
      }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.1; // Add gravity to particles
      p.life -= 1;
      
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
    
    // Update hit effects
    for (let i = hitEffects.length - 1; i >= 0; i--) {
      const effect = hitEffects[i];
      effect.life -= 1;
      if (effect.life <= 0) {
        hitEffects.splice(i, 1);
      }
    }
    
    // Update screen shake
    if (screenShake.duration > 0) {
      screenShake.duration -= 1;
      screenShake.intensity *= 0.9; // Decay
    }
  }

  function render() {
    // Apply screen shake
    ctx.save();
    if (screenShake.duration > 0 && screenShake.intensity > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake.intensity;
      const shakeY = (Math.random() - 0.5) * screenShake.intensity;
      ctx.translate(shakeX, shakeY);
    }
    
    // Clear canvas
    ctx.clearRect(-20, -20, CANVAS_WIDTH + 40, CANVAS_HEIGHT + 40);
    
    // Draw snowy background with subtle texture
    drawSnowBackground();
    
    // Draw snow forts (sorted by Y for depth)
    snowForts.forEach(fort => drawSnowFort(fort));
    
    // Collect all drawable entities for depth sorting
    const entities = [];
    
    // Add other players
    players.forEach(player => {
      entities.push({
        type: player.isAlive ? 'player' : 'dead',
        x: player.x,
        y: player.y,
        color: player.color,
        name: player.name,
        health: player.health,
        isMe: false
      });
    });
    
    // Add my player
    entities.push({
      type: myPlayer.isAlive ? 'player' : 'dead',
      x: myPlayer.x,
      y: myPlayer.y,
      color: myPlayer.color,
      name: playerName,
      health: myPlayer.health,
      isMe: true
    });
    
    // Sort by Y position for proper depth
    entities.sort((a, b) => a.y - b.y);
    
    // Draw entities
    entities.forEach(entity => {
      if (entity.type === 'player') {
        drawChibiPlayer(entity.x, entity.y, entity.color, entity.name, entity.isMe, entity.health);
      } else {
        drawDeadPlayer(entity.x, entity.y, entity.name);
      }
    });
    
    // Draw snowballs with shadows
    snowballs.forEach(ball => {
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(ball.x + 3, ball.y + 8, SNOWBALL_SIZE, SNOWBALL_SIZE * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Snowball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, SNOWBALL_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, SNOWBALL_SIZE * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw particles with color support
    particles.forEach(p => {
      const alpha = Math.min(1, p.life / 30);
      if (p.color) {
        ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw hit effects (flashing rings)
    hitEffects.forEach(effect => {
      const progress = 1 - (effect.life / effect.maxLife);
      const radius = 20 + progress * 40;
      const alpha = (1 - progress) * 0.7;
      
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner flash
      if (effect.life > effect.maxLife * 0.5) {
        const innerAlpha = (effect.life / effect.maxLife - 0.5) * 1.5;
        ctx.fillStyle = `rgba(255, 200, 200, ${innerAlpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 25, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw aim indicator (subtle)
    if (myPlayer.isAlive) {
      const dx = mousePos.x - myPlayer.x;
      const dy = mousePos.y - myPlayer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(myPlayer.x + nx * 25, myPlayer.y + ny * 25);
        ctx.lineTo(myPlayer.x + nx * 60, myPlayer.y + ny * 60);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Restore canvas state (for screen shake)
    ctx.restore();
  }

  function drawSnowBackground() {
    // Base snow color with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#e8f4f8');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#d4e8ed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Add subtle snow texture dots
    ctx.fillStyle = 'rgba(200, 220, 230, 0.3)';
    for (let i = 0; i < 100; i++) {
      const x = (i * 73) % CANVAS_WIDTH;
      const y = (i * 97) % CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnowFort(fort) {
    const { x, y, width, height } = fort;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(x, y + height + 5, width * 0.6, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Main fort body (curved snow pile)
    ctx.fillStyle = '#e0f0f5';
    ctx.beginPath();
    ctx.ellipse(x, y + height * 0.3, width * 0.5, height, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Lighter top
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.45, height * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Snow pile highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x - width * 0.15, y - height * 0.2, width * 0.15, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHeart(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const topY = y - size * 0.3;
    ctx.moveTo(x, y + size * 0.4);
    ctx.bezierCurveTo(x - size * 0.5, y, x - size * 0.5, topY, x, topY + size * 0.2);
    ctx.bezierCurveTo(x + size * 0.5, topY, x + size * 0.5, y, x, y + size * 0.4);
    ctx.fill();
  }

  function drawChibiPlayer(x, y, colorKey, name, isMe, health = 5) {
    const colors = TEAM_COLORS[colorKey] || TEAM_COLORS.green;
    
    // Shadow (ellipse on ground)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs/pants
    ctx.fillStyle = colors.pants;
    // Left leg
    ctx.beginPath();
    ctx.ellipse(x - 6, y + 12, 5, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 12, 5, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Body (round puffy jacket)
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body shading
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 2, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms (holding snowball pose)
    ctx.fillStyle = colors.body;
    // Left arm
    ctx.beginPath();
    ctx.ellipse(x - 18, y - 4, 7, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Right arm (raised with snowball)
    ctx.beginPath();
    ctx.ellipse(x + 16, y - 10, 7, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Snowball in hand
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 20, y - 14, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#fce4d6';
    ctx.beginPath();
    ctx.arc(x, y - 18, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Hood/hat
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(x, y - 20, 13, Math.PI, Math.PI * 2, false);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - 20, 14, 8, 0, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.fill();
    
    // Face opening in hood
    ctx.fillStyle = '#fce4d6';
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 17, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 4, y - 17, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 4.5, y - 18, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3.5, y - 18, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Rosy cheeks
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 14, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - 14, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Smile
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 13, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    
    // Name label with background
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    const nameWidth = ctx.measureText(name).width;
    
    // Health hearts above name
    const heartsY = y - 54;
    const heartSize = 8;
    const maxHealth = 5;
    const heartSpacing = 12;
    const heartsWidth = maxHealth * heartSpacing;
    const heartsStartX = x - heartsWidth / 2 + heartSize / 2;
    
    for (let i = 0; i < maxHealth; i++) {
      const heartX = heartsStartX + i * heartSpacing;
      if (i < health) {
        // Full heart
        drawHeart(heartX, heartsY, heartSize, '#e74c3c');
      } else {
        // Empty heart
        drawHeart(heartX, heartsY, heartSize, 'rgba(100, 100, 100, 0.5)');
      }
    }
    
    // Name background
    ctx.fillStyle = isMe ? 'rgba(46, 204, 113, 0.8)' : 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x - nameWidth / 2 - 4, y - 42, nameWidth + 8, 14, 4);
    ctx.fill();
    
    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, x, y - 32);
  }

  function drawDeadPlayer(x, y, name) {
    // Fallen player - lying down
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body fallen
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // X eyes
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 4);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 4, y - 4);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x + 8, y - 4);
    ctx.lineTo(x + 4, y);
    ctx.stroke();
    
    // Name label
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const nameWidth = ctx.measureText(name).width;
    ctx.beginPath();
    ctx.roundRect(x - nameWidth / 2 - 4, y - 30, nameWidth + 8, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, x, y - 20);
  }

  function createHitParticles(x, y) {
    // Snow burst particles
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 6 - 3,
        life: 30 + Math.random() * 20,
        size: 2 + Math.random() * 3,
        gravity: 0.15
      });
    }
    // Add some sparkle particles
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 2,
        life: 20 + Math.random() * 15,
        size: 1 + Math.random() * 2,
        color: 'rgb(200, 230, 255)',
        gravity: 0.05
      });
    }
  }
  
  function addHitEffect(x, y, playerId) {
    hitEffects.push({
      x: x,
      y: y,
      playerId: playerId,
      life: 20,
      maxLife: 20
    });
  }
  
  function createDeathExplosion(x, y) {
    // Big snow explosion
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = 3 + Math.random() * 5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 40 + Math.random() * 30,
        size: 3 + Math.random() * 4,
        gravity: 0.12
      });
    }
    // Red damage particles
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 6 - 2,
        life: 25 + Math.random() * 20,
        size: 2 + Math.random() * 3,
        color: 'rgb(255, 100, 100)',
        gravity: 0.1
      });
    }
    // Add skull emoji particles (as colored dots representing impact)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2 - 3,
        life: 35,
        size: 5,
        color: 'rgb(255, 200, 100)',
        gravity: 0.08
      });
    }
  }

  function checkFortCollision(x, y, fort, radius = PLAYER_SIZE / 2) {
    // Ellipse-based collision for snow forts
    const dx = x - fort.x;
    const dy = y - fort.y;
    const rx = fort.width * 0.5 + radius;
    const ry = fort.height + radius;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1;
  }
})();
