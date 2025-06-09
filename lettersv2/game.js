const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const nameList = ["Sophia", "Jackson", "Olivia", "Liam", "Emma", "Noah", "Ava", "Aiden", "Isabella", "Lucas", "Mia", "Caden", "Riley", "Grayson", "Zoe", "Elijah", "Chloe", "Benjamin", "Lily", "Carter"];
// const nameList = ['Liam', 'Emma', 'Olivia', 'Noah', 'Sophia'];
const matchedNames = new Set();
const nameQueue = [];

const nameListEl = document.getElementById('name-list');
nameList.forEach(name => {
  const div = document.createElement('div');
  div.className = 'name';
  div.innerText = name;
  nameListEl.appendChild(div);
});

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const balls = [];

// Pinball table walls (line segments)
const walls = [
  // left vertical
  {x1: 50, y1: 50, x2: 50, y2: 550},
  // right vertical
  {x1: 750, y1: 50, x2: 750, y2: 550},
  // top horizontal
  {x1: 50, y1: 50, x2: 750, y2: 50},
  // angled left funnel
  {x1: 50, y1: 550, x2: 250, y2: 590},
  // angled right funnel
  {x1: 750, y1: 550, x2: 550, y2: 590},
];

// Bumpers (circles)
const bumpers = [
  {x: 200, y: 200, radius: 30},
  {x: 600, y: 220, radius: 30},
  {x: 400, y: 350, radius: 25},
  {x: 300, y: 450, radius: 20},
  {x: 500, y: 480, radius: 20},
];

// Drop zone box
const dropZone = {x: 250, y: 550, width: 300, height: 40};

function getNeededNextLetters() {
  const prefix = nameQueue.join('').toUpperCase();
  const neededLetters = new Set();

  // Check all unmatched names
  nameList.forEach(name => {
    if (matchedNames.has(name)) return;

    const upperName = name.toUpperCase();
    // Does this name start with the current prefix?
    if (upperName.startsWith(prefix)) {
      // Next needed letter is at position prefix.length
      if (prefix.length < upperName.length) {
        neededLetters.add(upperName[prefix.length]);
      }
    }
  });

  return Array.from(neededLetters);
}

function spawnLetter() {
  const neededLetters = getNeededNextLetters();

  let letter;

  if (neededLetters.length > 0) {
    // 70% chance to pick a needed letter
    if (Math.random() < 0.7) {
      letter = neededLetters[Math.floor(Math.random() * neededLetters.length)];
    } else {
      letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random A-Z
    }
  } else {
    letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }

  // Create new ball object for the letter dropping
  const ball = {
    letter: letter,
    x: 150 + Math.random() * 500, // spawn horizontally between walls roughly
    y: 60, // just below top wall start
    radius: 18,
    vx: (Math.random() - 0.5) * 4, // random horizontal velocity
    vy: 0,
    color: '#0f0',
  };

  balls.push(ball);
}


function drawWalls() {
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 3;
  walls.forEach(w => {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  });
  ctx.lineWidth = 1;
}

function drawBumpers() {
  bumpers.forEach(b => {
    ctx.beginPath();
    ctx.fillStyle = '#08f';
    ctx.shadowColor = '#08f';
    ctx.shadowBlur = 20;
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('O', b.x, b.y + 8);
  });
}

function drawDropZone() {
  ctx.fillStyle = '#222';
  ctx.fillRect(dropZone.x, dropZone.y, dropZone.width, dropZone.height);
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 3;
  ctx.strokeRect(dropZone.x, dropZone.y, dropZone.width, dropZone.height);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#0f0';
  ctx.font = '18px sans-serif';
  ctx.fillText('DROP ZONE', dropZone.x + dropZone.width / 2, dropZone.y + 27);
}

function drawBall(ball) {
  ctx.beginPath();
  ctx.fillStyle = ball.color;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ball.letter, ball.x, ball.y + 6);
}

function reflectVelocity(ball, normalX, normalY) {
  // Reflect velocity vector along the normal
  const dot = ball.vx * normalX + ball.vy * normalY;
  ball.vx = ball.vx - 2 * dot * normalX;
  ball.vy = ball.vy - 2 * dot * normalY;

  // Dampen velocity a bit
  ball.vx *= 0.8;
  ball.vy *= 0.8;
}

function collideWithWalls(ball) {
  for (let wall of walls) {
    // Vector from wall start to ball center
    const wx = wall.x2 - wall.x1;
    const wy = wall.y2 - wall.y1;
    const length = Math.sqrt(wx*wx + wy*wy);
    const nx = -wy / length; // normal vector x
    const ny = wx / length;  // normal vector y

    // Project ball center to wall line segment
    const px = ball.x - wall.x1;
    const py = ball.y - wall.y1;

    // Distance from ball center to wall line
    const dist = Math.abs(px*nx + py*ny);

    // Check if ball is close enough to collide
    if (dist < ball.radius) {
      // Check if ball is within wall segment projection
      const proj = (px*wx + py*wy) / (length*length);
      if (proj >= 0 && proj <= 1) {
        // Push ball out of wall
        ball.x += nx * (ball.radius - dist);
        ball.y += ny * (ball.radius - dist);

        // Reflect velocity
        reflectVelocity(ball, nx, ny);
      }
    }
  }
}

function collideWithBumpers(ball) {
  bumpers.forEach(b => {
    const dx = ball.x - b.x;
    const dy = ball.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const minDist = ball.radius + b.radius;

    if (dist < minDist) {
      // Push ball out of bumper
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      // Reflect velocity
      reflectVelocity(ball, nx, ny);
    }
  });
}

function update() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawWalls();
  drawBumpers();
  drawDropZone();

  for (let i = balls.length -1; i >= 0; i--) {
    const ball = balls[i];

    ball.vy += 0.25; // gravity
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off canvas floor (with dampening)
    if (ball.y + ball.radius > HEIGHT) {
      ball.y = HEIGHT - ball.radius;
      ball.vy *= -0.6;
      ball.vx *= 0.8;

      if (Math.abs(ball.vy) < 0.5) {
        ball.vy = 0;
        ball.vx = 0;
      }
    }

    // Bounce off walls & bumpers
    collideWithWalls(ball);
    collideWithBumpers(ball);

    // Drop zone detection
    if (
      ball.x > dropZone.x &&
      ball.x < dropZone.x + dropZone.width &&
      ball.y + ball.radius > dropZone.y &&
      ball.y + ball.radius < dropZone.y + dropZone.height
    ) {
      nameQueue.push(ball.letter);
      checkNames();
      balls.splice(i, 1);
      continue;
    }

    drawBall(ball);
  }

  requestAnimationFrame(update);
}

// Improved name matching:
// - Check if the current collected letters form the start of any remaining names
// - If full match is found, mark matched
// - Otherwise, wait for more letters

function checkNames() {
  const currentStr = nameQueue.join('').toUpperCase();
  if (!currentStr) {
    updatePartialHighlights(); // clear highlights if no letters
    return;
  }

  const possibleNames = nameList.filter(name => !matchedNames.has(name))
                                .filter(name => name.toUpperCase().startsWith(currentStr));

  if (possibleNames.length === 1) {
    const matchedName = possibleNames[0];
    matchedNames.add(matchedName);
    nameQueue.length = 0;
    markName(matchedName);
    updatePartialHighlights(); // clear highlights on match

    if (matchedNames.size === nameList.length) {
      setTimeout(() => alert('🎉 All names matched! You win!'), 100);
    }
  } else if (possibleNames.length === 0) {
    nameQueue.length = 0;
    updatePartialHighlights(); // clear highlights on reset
  } else {
    // Multiple matches, update highlights
    updatePartialHighlights();
  }
}


function addMatchedName(name) {
  const list = document.getElementById('matched-names-list');
  const li = document.createElement('li');
  li.textContent = name;
  li.classList.add('matched-animate');

  // Append new matched name at the bottom (end) of the list
  list.appendChild(li);

  // Remove animation class after animation ends to allow re-triggering
  li.addEventListener('animationend', () => {
    li.classList.remove('matched-animate');
  });
}


function updatePartialHighlights() {
  const currentStr = nameQueue.join('').toUpperCase();

  const nameDivs = document.querySelectorAll('.name');
  nameDivs.forEach(div => {
    const originalName = div.getAttribute('data-original-name') || div.innerText;
    // Store original name once to avoid overwriting highlights repeatedly
    if (!div.getAttribute('data-original-name')) {
      div.setAttribute('data-original-name', originalName);
    }

    if (currentStr && originalName.toUpperCase().startsWith(currentStr)) {
      // Highlight the matched prefix
      const prefix = originalName.slice(0, currentStr.length);
      const suffix = originalName.slice(currentStr.length);
      div.innerHTML = `<span class="highlight">${prefix}</span>${suffix}`;
    } else {
      // No highlight, show full name normal
      div.textContent = originalName;
    }
  });
}


function markName(name) {
  const divs = document.querySelectorAll('.name');
  divs.forEach(div => {
    if (div.innerText === name) {
      div.classList.add('matched');
    }
  });
   addMatchedName(name);
}

setInterval(spawnLetter, 400);

update();
