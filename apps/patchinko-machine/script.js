document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Setup
  const canvas = document.getElementById('patchinko-canvas');
  const ctx = canvas.getContext('2d');
  const bucketsContainer = document.getElementById('buckets-container');
  const queueList = document.getElementById('standup-queue');
  const dropBallsBtn = document.getElementById('drop-balls-btn');
  const resetBtn = document.getElementById('reset-btn');
  const patternButtons = document.querySelectorAll('.pattern-button');

  // 2. Constants & State
  const BUCKET_HEIGHT = 60;
  const GRAVITY = 0.6;
  const FRICTION = 0.98;
  const BOUNCE = 0.85; 
  const PEG_RADIUS = 5;
  const PEG_COLOR = 'rgba(255, 255, 255, 0.7)';
  const PEG_SHADOW = 'rgba(255, 255, 255, 0.5)';
  const MIN_PEG_SPACING = 30;

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function tryAddPeg(targetList, x, y) {
    if (targetList.some((peg) => distance(peg.x, peg.y, x, y) < MIN_PEG_SPACING)) {
      return false;
    }
    targetList.push({ x, y });
    return true;
  }
  
  let balls = [];
  let pegs = [];
  let teamMembers = [];
  let scores = {};
  let activePattern = 'grid';
  let animationFrameId;

  // 3. Team & Bucket Management
  function setupBuckets() {
    bucketsContainer.innerHTML = '';
    if (teamMembers.length === 0) {
        // No players, show a message
        const placeholder = document.createElement('div');
        placeholder.className = 'bucket-placeholder';
        placeholder.textContent = 'Add participants in settings to play.';
        bucketsContainer.appendChild(placeholder);
        updateQueue();
        return;
    }

    teamMembers.forEach((name, index) => {
      scores[name] = 0;
      const bucket = document.createElement('div');
      bucket.className = 'bucket';
      bucket.dataset.team = name;

      const label = document.createElement('div');
      label.className = 'bucket-label';
      label.innerHTML = `<span class="bucket-name">${name}</span><span class="bucket-score" id="score-${index}">0</span>`;
      
      bucket.appendChild(label);
      bucketsContainer.appendChild(bucket);
    });
    updateQueue();
  }
  
  // 4. Peg Pattern Generation
  const holidayPatterns = {
    newYears: 'firework',
    valentines: 'heart',
    stPatricks: 'shamrock',
    canadaDay: 'mapleLeaf',
    independenceDay: 'star',
    halloween: 'pumpkin',
    christmas: 'xmasTree',
  };

  const patterns = {
    firework: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 150;
        const rays = 12;
        const rayLength = 200;
        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2;
            for (let j = 1; j <= 10; j++) {
                const r = (j / 10) * rayLength * (0.8 + Math.random() * 0.4);
                tryAddPeg(pegs, centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r);
            }
        }
        return pegs;
    },
    shamrock: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = 300;
        const leafRadius = 80;
        const angles = [Math.PI / 2, -Math.PI / 6, -5 * Math.PI / 6];
        angles.forEach(angle => {
            const cx = centerX + Math.cos(angle) * leafRadius * 0.6;
            const cy = centerY - Math.sin(angle) * leafRadius * 0.6;
            for(let i=0; i<50; i++) {
                const r = Math.random() * leafRadius;
                const a = Math.random() * Math.PI * 2;
                tryAddPeg(pegs, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
        });
         for(let i=0; i< 20; i++) {
            tryAddPeg(pegs, centerX + (Math.random() - 0.5) * 20, centerY + 50 + i * 5);
        }
        return pegs;
    },
    mapleLeaf: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = 350;
        const points = [
            {x: 0, y: -15}, {x: 3, y: -10}, {x: 15, y: -12}, {x: 10, y: -5},
            {x: 18, y: 0}, {x: 12, y: 5}, {x: 8, y: 15}, {x: 2, y: 8},
            {x: 0, y: 10}
        ];
        const fullPoints = [...points];
        points.reverse().forEach(p => {
            if(p.x !== 0) fullPoints.push({x: -p.x, y: p.y});
        });
        fullPoints.forEach(p => {
             for(let i=0; i<15; i++) {
                tryAddPeg(pegs, centerX + p.x * 15 + (Math.random()-0.5) * 20, centerY + p.y * 15 + (Math.random()-0.5) * 20);
             }
        });
        return pegs;
    },
    star: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = 300;
        const spikes = 5;
        const outerRadius = 200;
        const innerRadius = 80;
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
            for(let j=0; j<20; j++) {
                const r = Math.random() * radius;
                 tryAddPeg(pegs, centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r);
            }
        }
        return pegs;
    },
    heart: () => {
        const pegs = [];
        const scale = 18;
        for (let t = 0; t < Math.PI * 2; t+= 0.1) {
            const x = canvas.width / 2 + scale * 16 * Math.pow(Math.sin(t), 3);
            const y = 250 - scale * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
            tryAddPeg(pegs, x, y);
        }
        return pegs;
    },
    pumpkin: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 100;
        const radius = 200;
        tryAddPeg(pegs, centerX, centerY - radius - 20);
        tryAddPeg(pegs, centerX - 10, centerY - radius - 30);
        tryAddPeg(pegs, centerX + 10, centerY - radius - 30);
        for(let i=0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            for(let j=0; j<15; j++){
                const r = radius * (1 + Math.sin(angle * 4) * 0.1) * (j/15);
                tryAddPeg(pegs, centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r);
            }
        }
        return pegs;
    },
    xmasTree: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const topY = 120;
        const treeHeight = 500;
        const maxRows = 15;

        // Star on top
        tryAddPeg(pegs, centerX, topY - 20);
        tryAddPeg(pegs, centerX + 15, topY - 15);
        tryAddPeg(pegs, centerX - 15, topY - 15);

        // Tree body
        for (let row = 0; row < maxRows; row++) {
            const y = topY + (row / maxRows) * treeHeight;
            const rowWidth = 30 + row * 25;
            const numPegsInRow = 2 + row;
            
            for (let i = 0; i < numPegsInRow; i++) {
                const x = centerX - rowWidth / 2 + (i / (numPegsInRow - 1)) * rowWidth;
                if (numPegsInRow > 1) {
                   tryAddPeg(pegs, x, y);
                } else {
                   tryAddPeg(pegs, centerX, y);
                }
            }
        }
        
        // Trunk
        const trunkY = topY + treeHeight;
        for (let i = 0; i < 4; i++) {
            tryAddPeg(pegs, centerX - 25, trunkY + i * 20);
            tryAddPeg(pegs, centerX + 25, trunkY + i * 20);
        }
        
        return pegs;
    },
    grid: () => {
      const pegs = [];
      const rows = 12;
      const cols = 10;
      const xSpacing = canvas.width / (cols + 1);
      const ySpacing = (canvas.height - BUCKET_HEIGHT * 2) / (rows + 1);
      for (let row = 1; row <= rows; row++) {
        for (let col = 1; col <= cols; col++) {
          tryAddPeg(
            pegs,
            col * xSpacing + (row % 2 === 0 ? xSpacing / 2 : 0),
            row * ySpacing + 40
          );
        }
      }
      return pegs;
    },
    tree: () => {
      const pegs = [];
      const maxRows = 12;
      const centerX = canvas.width / 2;
      for (let row = 0; row < maxRows; row++) {
        for (let i = 0; i <= row; i++) {
          const x = centerX + (i - row / 2) * 45;
          const y = row * 50 + 80;
          if (y < canvas.height - BUCKET_HEIGHT - 50) {
            tryAddPeg(pegs, x, y);
          }
        }
      }
      return pegs;
    },
    orb: () => {
        const pegs = [];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 50;
        const radius = 250;
        const numPegs = 60;
        for (let i = 0; i < numPegs; i++) {
            const angle = (i / numPegs) * Math.PI * 2;
            const r = radius * (1 - (i / numPegs) * 0.5);
            tryAddPeg(pegs,
                centerX + Math.cos(angle) * r,
                centerY + Math.sin(angle) * r
            );
        }
        return pegs;
    },
    triangles: () => {
      const pegs = [];
      const triangle = (cx, cy, size, rows) => {
        for (let row = 0; row < rows; row++) {
          for (let i = 0; i <= row; i++) {
            const x = cx + (i - row / 2) * size;
            const y = cy + row * size * 0.866;
            tryAddPeg(pegs, x, y);
          }
        }
      };
      triangle(canvas.width / 2, 100, 50, 6);
      triangle(canvas.width * 0.25, 400, 40, 5);
      triangle(canvas.width * 0.75, 400, 40, 5);
      return pegs;
    },
    random: () => {
      const pegs = [];
      const numPegs = 100;
      for (let i = 0; i < numPegs; i++) {
        tryAddPeg(pegs,
          Math.random() * (canvas.width - 40) + 20,
          Math.random() * (canvas.height - BUCKET_HEIGHT - 100) + 80
        );
      }
      return pegs;
    }
  };

  function setPattern(patternName) {
    activePattern = patternName;
    const generatedPegs = patterns[patternName] ? patterns[patternName]() : patterns.grid();
    
    const bumperPegs = [];
    // Top-left bumper
    for(let i=0; i<5; i++) {
        tryAddPeg(bumperPegs, 40 + i * 15, 60 + i * 25);
    }
    // Top-right bumper
    for(let i=0; i<5; i++) {
        tryAddPeg(bumperPegs, (canvas.width - 40) - i * 15, 60 + i * 25);
    }

    pegs = [...bumperPegs];
    generatedPegs.forEach(p => tryAddPeg(pegs, p.x, p.y));

    patternButtons.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.pattern === patternName);
    });
  }

  // 5. Drawing
  function drawPegs() {
    ctx.fillStyle = PEG_COLOR;
    ctx.shadowColor = PEG_SHADOW;
    ctx.shadowBlur = 8;
    pegs.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function drawBall(ball) {
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Simple Physics Engine
  const holidayBallPalettes = {
    newYears: ['#f1c40f', '#ecf0f1', '#3498db', '#e74c3c'],
    valentines: ['#e74c3c', '#f8c5c5', '#ecf0f1', '#c0392b'],
    stPatricks: ['#2ecc71', '#f1c40f', '#27ae60', '#ecf0f1'],
    canadaDay: ['#e74c3c', '#ecf0f1'],
    independenceDay: ['#e74c3c', '#ecf0f1', '#3498db'],
    halloween: ['#f39c12', '#8e44ad', '#2c3e50', '#d35400'],
    christmas: ['#e74c3c', '#27ae60', '#f1c40f', '#ecf0f1'],
  };

  function getBallColor(themeId) {
    const palette = holidayBallPalettes[themeId];
    if (palette) {
      return palette[Math.floor(Math.random() * palette.length)];
    }
    return `hsl(${Math.random() * 360}, 90%, 70%)`;
  }

  function createBall() {
    const radius = Math.random() * 4 + 8; // 8-12px
    const mass = radius;
    const { activeTheme } = window.BrandThemeEngine ? window.BrandThemeEngine.composeBrandStyles() : { activeTheme: null };
    const color = getBallColor(activeTheme?.id);

    return {
      x: Math.random() * (canvas.width * 0.9) + (canvas.width * 0.05),
      y: -radius - Math.random() * 20,
      vx: Math.random() * 4 - 2,
      vy: 0,
      radius,
      mass,
      color,
      stuckFrames: 0,
    };
  }

  function updatePhysics(ball) {
    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collisions
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
      ball.vx *= -BOUNCE;
      ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
    }

    // Peg collisions
    pegs.forEach(peg => {
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = ball.radius + PEG_RADIUS;
      if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;
        
        ball.x += Math.cos(angle) * overlap * 0.5;
        ball.y += Math.sin(angle) * overlap * 0.5;

        const totalMass = ball.mass + 10; // Peg mass is high
        const newVx = (ball.vx * (ball.mass - 10) + (2 * 10 * 0)) / totalMass;
        const newVy = (ball.vy * (ball.mass - 10) + (2 * 10 * 0)) / totalMass;

        ball.vx = (newVx + Math.cos(angle)) * BOUNCE;
        ball.vy = (newVy + Math.sin(angle)) * BOUNCE;
      }
    });

    // Anti-stuck mechanism
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < 0.1) {
      ball.stuckFrames++;
    } else {
      ball.stuckFrames = 0;
    }

    if (ball.stuckFrames > 10) { // Nudge faster
      ball.vx = (Math.random() - 0.5) * 4; // Increased horizontal nudge
      ball.vy = -2; // Strong vertical lift
      ball.stuckFrames = 0;
    }
  }

  // 7. Game Loop
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs();

    let scoredThisFrame = false;

    // Iterate backwards to safely remove items from the array
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      updatePhysics(ball);
      drawBall(ball);
      
      if (ball.y + ball.radius > canvas.height - BUCKET_HEIGHT && teamMembers.length > 0) {
        const bucketWidth = canvas.width / teamMembers.length;
        const bucketIndex = Math.floor(ball.x / bucketWidth);
        const teamName = teamMembers[bucketIndex];
        
        if (teamName) {
            scores[teamName]++;
            updateScoreDisplay(bucketIndex, scores[teamName]);
            highlightBucket(bucketIndex);
            scoredThisFrame = true;
        }
        
        balls.splice(i, 1);
      }
    }
    
    if (scoredThisFrame) {
      updateQueue();
    }

    if (balls.length === 0) {
      stopGame();
      return;
    }
    
    animationFrameId = requestAnimationFrame(loop);
  }

  // 8. Scoring & Queue Logic
  function updateScoreDisplay(bucketIndex, score) {
    const scoreEl = document.getElementById(`score-${bucketIndex}`);
    if (scoreEl) {
      scoreEl.textContent = score;
    }
  }

  function highlightBucket(bucketIndex) {
    const buckets = bucketsContainer.children;
    if (buckets[bucketIndex]) {
      buckets[bucketIndex].classList.add('highlight');
      setTimeout(() => {
        buckets[bucketIndex].classList.remove('highlight');
      }, 400);
    }
  }

  function updateQueue() {
    const sortedTeam = [...teamMembers].sort((a, b) => scores[b] - scores[a]);
    
    queueList.innerHTML = '';
    let currentSpeakerFound = false;

    if (teamMembers.length === 0) {
        queueList.innerHTML = '<li class="queue-placeholder">No participants found. Add some in settings!</li>';
        return;
    }

    sortedTeam.forEach((name, index) => {
        const li = document.createElement('li');
        const isCompleted = scores[name] > 0;
        
        let nameClass = 'queue-name';
        if (isCompleted && !currentSpeakerFound) {
            nameClass += ' current';
            currentSpeakerFound = true;
        } else if (isCompleted) {
            nameClass += ' completed';
        }

        li.innerHTML = `<span class="queue-position">${index + 1}</span> <span class="${nameClass}">${name}</span>`;
        queueList.appendChild(li);
    });

    if (queueList.children.length === 0) {
        queueList.innerHTML = '<li class="queue-placeholder">Drop balls to generate the queue...</li>';
    }
    
    // Dispatch events
    const eventData = {
        queue: sortedTeam,
        scores: scores,
        completed: sortedTeam.filter(name => scores[name] > 0),
        remaining: sortedTeam.filter(name => scores[name] === 0),
        current: currentSpeakerFound ? sortedTeam.find(name => scores[name] > 0) : null
    };
    canvas.dispatchEvent(new CustomEvent('standup:queue', { detail: eventData, bubbles: true }));
  }


  // 9. Event Handlers & Game Control
  function startGame() {
    if (animationFrameId || teamMembers.length === 0) {
        if(teamMembers.length === 0){
            alert("Please add team members in the settings to start the game.");
        }
        return; 
    }
    
    balls = []; // Clear any previous balls
    dropBallsBtn.disabled = true;
    
    const ballCount = teamMembers.length * 8;
    for (let i = 0; i < ballCount; i++) {
        setTimeout(() => {
            balls.push(createBall());
            // If the loop isn't running yet, start it.
            if (!animationFrameId) {
                loop();
            }
        }, i * 100);
    }
  }

  function stopGame() {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    dropBallsBtn.disabled = false;
  }
  
  function resetGame() {
    stopGame();
    balls = [];
    setupBuckets();
    setPattern(activePattern);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs();
    canvas.dispatchEvent(new CustomEvent('standup:queue-reset', { bubbles: true }));
  }

  dropBallsBtn.addEventListener('click', startGame);
  resetBtn.addEventListener('click', resetGame);

  patternButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.pattern !== activePattern) {
        setPattern(button.dataset.pattern);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPegs();
      }
    });
  });

  // 10. Initialization
  function init() {
    // Check for active holiday theme and set pattern accordingly
    if (window.BrandThemeEngine) {
      const { activeTheme } = window.BrandThemeEngine.composeBrandStyles();
      if (activeTheme && holidayPatterns[activeTheme.id]) {
        activePattern = holidayPatterns[activeTheme.id];
      }
    }

    if (window.dailyPickStandup) {
        window.dailyPickStandup.subscribe(snapshot => {
            const newTeam = snapshot.players || [];
            if (JSON.stringify(newTeam) !== JSON.stringify(teamMembers)) {
                teamMembers = newTeam;
                resetGame();
            }
        });
    } else {
        console.warn("dailyPickStandup data store not found. Using default empty list.");
        teamMembers = [];
        resetGame();
    }

    setPattern(activePattern);
    drawPegs();
  }

  init();
});