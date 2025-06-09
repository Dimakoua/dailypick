const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const namesPanel = document.getElementById('namesList');
const restartButton = document.getElementById('restartButton');

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 650;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let initialNames = ["Sophia", "Jackson", "Olivia", "Liam", "Emma", "Noah", "Ava", "Aiden", "Isabella", "Lucas", "Mia", "Caden", "Riley", "Grayson", "Zoe", "Elijah", "Chloe", "Benjamin", "Lily", "Carter"];
let availableNames = [...initialNames];
let fallingLetters = [];
let obstacles = [];
let currentWordBuffer = "";
let gameLoopId = null;
let gameIsOver = false;

const GRAVITY = 0.08;
const LETTER_SPAWN_INTERVAL = 500; // milliseconds
let lastSpawnTime = 0;
const LETTER_SIZE = 24;
const DRAWER_HEIGHT = 60;
const DRAWER_Y = CANVAS_HEIGHT - DRAWER_HEIGHT;

class Letter {
    constructor(char, x, y) {
        this.char = char.toUpperCase();
        this.x = x;
        this.y = y;
        this.vy = 0; // vertical velocity
        this.vx = (Math.random() - 0.5) * 1.5; // slight initial horizontal movement
        this.radius = LETTER_SIZE / 2;
        this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
        this.rotation = 0;
        this.angularVelocity = 0;
        this.hasBouncedThisFrame = {}; // Tracks bounces per obstacle per frame/short time
    }

    update() {
        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        this.rotation += this.angularVelocity;
        this.angularVelocity *= 0.97; // Damping to slow down spin over time

        // Bounce off side walls
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -0.7;
        } else if (this.x + this.radius > CANVAS_WIDTH) {
            this.x = CANVAS_WIDTH - this.radius;
            this.vx *= -0.7;
        }
        // Reset bounce flags for next update cycle (or use timeouts within collision)
        this.hasBouncedThisFrame = {};
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${LETTER_SIZE}px Arial`; // Use LETTER_SIZE more directly for font
        ctx.fillText(this.char, 0, 0);

        ctx.restore();
    }
}

class Obstacle {
    constructor(id, x, y, width, height, type = 'rect', color = "#777") {
        this.id = id; // Unique ID for bounce tracking
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'rect' or 'circle'
        this.radius = type === 'circle' ? width / 2 : 0; // Assuming width is diameter for circle
        this.color = color;
    }

    draw() {
        ctx.fillStyle = this.color;
        if (this.type === 'rect') {
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function getNeededStartingLetters() {
    if (availableNames.length === 0) {
        return [];
    }
    const needed = new Set();
    availableNames.forEach(name => {
        if (name.length > 0) {
            needed.add(name[0].toUpperCase());
        }
    });
    return Array.from(needed);
}

function spawnLetter() {
    const neededChars = getNeededStartingLetters();
    let char;

    if (neededChars.length > 0) {
        char = neededChars[Math.floor(Math.random() * neededChars.length)];
    } else {
        // This should not happen if availableNames.length > 0 and spawnLetter is called.
        return; // Don't spawn if no specifically needed starting letter is found.
    }

    const x = Math.random() * (CANVAS_WIDTH - LETTER_SIZE * 2) + LETTER_SIZE;
    fallingLetters.push(new Letter(char, x, -LETTER_SIZE)); // Start off-screen
}

function updateNamesDisplay() {
    namesPanel.innerHTML = '';
    const sortedNames = [...availableNames].sort();
    const allMatchedNames = initialNames.filter(name => !availableNames.includes(name)).sort();

    allMatchedNames.forEach(name => {
        const nameEl = document.createElement('div');
        nameEl.classList.add('name-item', 'matched');
        nameEl.textContent = name;
        nameEl.id = `name-${name.toLowerCase().replace(/\s+/g, '-')}`;
        namesPanel.appendChild(nameEl);
    });

    sortedNames.forEach(name => {
        const nameEl = document.createElement('div');
        nameEl.classList.add('name-item');
        nameEl.textContent = name;
        nameEl.id = `name-${name.toLowerCase().replace(/\s+/g, '-')}`;
        namesPanel.appendChild(nameEl);
    });
}

function animateMatchedName(name) {
    const nameEl = document.getElementById(`name-${name.toLowerCase().replace(/\s+/g, '-')}`);
    if (nameEl) {
        nameEl.classList.add('matched'); // CSS animation and style will apply
        // The element will be re-rendered by updateNamesDisplay in the 'matched' section
    }
}

function checkCollisions() {
    fallingLetters.forEach(letter => {
        obstacles.forEach(obstacle => {
            if (letter.hasBouncedThisFrame[obstacle.id]) return; // Already bounced off this obstacle recently

            let collided = false;
            const restitution = 0.75; // Bounciness

            if (obstacle.type === 'rect') {
                const closestX = Math.max(obstacle.x, Math.min(letter.x, obstacle.x + obstacle.width));
                const closestY = Math.max(obstacle.y, Math.min(letter.y, obstacle.y + obstacle.height));
                const dx = letter.x - closestX;
                const dy = letter.y - closestY;

                if ((dx * dx + dy * dy) < (letter.radius * letter.radius)) {
                    collided = true;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const overlap = letter.radius - distance;

                    // Penetration resolution
                    if (distance > 0) {
                        letter.x += (dx / distance) * overlap;
                        letter.y += (dy / distance) * overlap;
                    } else { // Inside or on edge, push out (e.g. along a default axis or random)
                        letter.y -= overlap; // Simple push up
                    }

                    // Normal (from closest point to letter center)
                    const normalX = distance > 0 ? dx / distance : 0;
                    const normalY = distance > 0 ? dy / distance : (letter.y < obstacle.y + obstacle.height / 2 ? -1 : 1);

                    const dot = letter.vx * normalX + letter.vy * normalY;
                    letter.vx -= (1 + restitution) * dot * normalX;
                    letter.vy -= (1 + restitution) * dot * normalY;
                }
            } else if (obstacle.type === 'circle') {
                const obsCenterX = obstacle.x + obstacle.radius;
                const obsCenterY = obstacle.y + obstacle.radius;
                const dx = letter.x - obsCenterX;
                const dy = letter.y - obsCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < letter.radius + obstacle.radius) {
                    collided = true;
                    const overlap = letter.radius + obstacle.radius - distance;

                    // Normal vector
                    const normalX = dx / distance;
                    const normalY = dy / distance;

                    // Penetration resolution
                    letter.x += normalX * overlap;
                    letter.y += normalY * overlap;

                    const dot = letter.vx * normalX + letter.vy * normalY;
                    letter.vx -= (1 + restitution) * dot * normalX;
                    letter.vy -= (1 + restitution) * dot * normalY;
                }
            }

            if (collided) {
                letter.hasBouncedThisFrame[obstacle.id] = true;
                // Add angular velocity for rotation
                letter.angularVelocity += (Math.random() - 0.5) * 0.3; // Adjust spin intensity

                setTimeout(() => { delete letter.hasBouncedThisFrame[obstacle.id]; }, 100); // Cooldown for this specific obstacle
                const spinFactor = 0.15 * (Math.random() - 0.5); // Keep existing pinball spin
                letter.vx += -letter.vy * spinFactor * 0.1; // A bit of tangential velocity
                letter.vy += letter.vx * spinFactor * 0.1;
            }
        });
    });
}

function processLetterInDrawer(char) {
    const currentAttempt = (currentWordBuffer + char).toUpperCase();

    let potentialMatches = availableNames.filter(name =>
        name.toUpperCase().startsWith(currentAttempt)
    );

    if (potentialMatches.length === 1) {
        const matchedName = potentialMatches[0];
        animateMatchedName(matchedName);
        availableNames = availableNames.filter(n => n !== matchedName);
        updateNamesDisplay();
        currentWordBuffer = ""; // Reset buffer
    } else if (potentialMatches.length > 1) {
        currentWordBuffer = currentAttempt; // Extend buffer and wait
    } else { // No match with the extended buffer
        // Try with the current char alone
        const charUpper = char.toUpperCase();
        potentialMatches = availableNames.filter(name =>
            name.toUpperCase().startsWith(charUpper)
        );
        if (potentialMatches.length === 1) {
            const matchedName = potentialMatches[0];
            animateMatchedName(matchedName);
            availableNames = availableNames.filter(n => n !== matchedName);
            updateNamesDisplay();
            currentWordBuffer = "";
        } else if (potentialMatches.length > 1) {
            currentWordBuffer = charUpper; // Start new buffer with current char
        } else {
            currentWordBuffer = ""; // No match at all, reset buffer
        }
    }
}

function gameLoop(timestamp) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Drawer
    ctx.fillStyle = "#c5cae9"; // Light indigo
    ctx.fillRect(0, DRAWER_Y, CANVAS_WIDTH, DRAWER_HEIGHT);
    ctx.fillStyle = "#303f9f"; // Darker indigo
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    ctx.fillText(currentWordBuffer || "DROP ZONE", CANVAS_WIDTH / 2, DRAWER_Y + DRAWER_HEIGHT / 2 + 8);

    // Spawn new letters
    if (!gameIsOver && timestamp - lastSpawnTime > LETTER_SPAWN_INTERVAL) {
        if (availableNames.length > 0) { // Only spawn if names are left
            spawnLetter();
        }
        lastSpawnTime = timestamp;
    }
    
    obstacles.forEach(obstacle => obstacle.draw());

    for (let i = fallingLetters.length - 1; i >= 0; i--) {
        const letter = fallingLetters[i];
        letter.update();
        // Collision check is now separate and happens before drawing letter

        // Check if letter reached the drawer
        if (letter.y + letter.radius > DRAWER_Y) {
            processLetterInDrawer(letter.char);
            fallingLetters.splice(i, 1); // Remove letter once it enters drawer
        }
        // Remove letters that fall off bottom (e.g. if they glitch through drawer)
        else if (letter.y - letter.radius > CANVAS_HEIGHT) {
            fallingLetters.splice(i, 1);
        }
    }

    // Check collisions after all letters have updated their positions for this frame
    checkCollisions();

    // Draw letters after collision resolution
    fallingLetters.forEach(letter => letter.draw());

    if (availableNames.length === 0 && fallingLetters.length === 0) {
        ctx.fillStyle = "rgba(0, 100, 0, 0.8)";
        ctx.fillRect(CANVAS_WIDTH / 4, CANVAS_HEIGHT / 3, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);
        ctx.fillStyle = "white";
        ctx.font = "bold 30px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("All Names Matched!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);
        ctx.font = "16px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        ctx.fillText("Click Restart to play again.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

        if (!gameIsOver) { // Show button only once
            if(restartButton) restartButton.style.display = 'block';
            gameIsOver = true;
        }
        return; // Stop the game loop
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

function setupObstacles() {
    obstacles = []; // Clear existing obstacles
    const bumperColor = '#42a5f5'; // Blue
    const pinColor1 = '#ff7043'; // Orange
    const pinColor2 = '#66bb6a'; // Green
    const guideColor = '#78909c'; // Blue-grey
    const funnelColor = '#546e7a';   // Darker blue-grey

    // Top bumpers to spread letters
    obstacles.push(new Obstacle("top_bump1", CANVAS_WIDTH / 2 - 20, 80, 40, 40, 'circle', bumperColor));
    obstacles.push(new Obstacle("top_bump2", CANVAS_WIDTH / 4, 130, 30, 30, 'circle', pinColor1));
    obstacles.push(new Obstacle("top_bump3", CANVAS_WIDTH * 3 / 4 - 30, 130, 30, 30, 'circle', pinColor1));

    // Side guides / walls
    obstacles.push(new Obstacle("side_guide_L1", 20, 180, 20, 150, 'rect', guideColor));
    obstacles.push(new Obstacle("side_guide_R1", CANVAS_WIDTH - 40, 180, 20, 150, 'rect', guideColor));

    // Mid-field pins
    obstacles.push(new Obstacle("mid_pin1", CANVAS_WIDTH / 2 - 60, 250, 25, 25, 'circle', pinColor2));
    obstacles.push(new Obstacle("mid_pin2", CANVAS_WIDTH / 2 + 35, 250, 25, 25, 'circle', pinColor2));
    obstacles.push(new Obstacle("mid_pin3", CANVAS_WIDTH / 2 - 12, 320, 25, 25, 'circle', bumperColor)); // Central

    // Slanted deflectors
    // For true slanted collision, polygon physics would be needed. These are rectangular approximations.
    // We can simulate slants by making them thin and long, or by rotating them (which adds draw complexity if not using a library)
    // For simplicity, using axis-aligned rectangles that guide.
    obstacles.push(new Obstacle("slant_L", 80, 380, 100, 15, 'rect', guideColor));
    obstacles.push(new Obstacle("slant_R", CANVAS_WIDTH - 180, 380, 100, 15, 'rect', guideColor));

    // Lower funnel - creating a narrower passage
    const funnelTopY = DRAWER_Y - 120;
    const funnelOpeningWidth = 80; // How wide the opening to the drawer is
    obstacles.push(new Obstacle("funnel_L_wall", 50, funnelTopY, CANVAS_WIDTH / 2 - 50 - funnelOpeningWidth / 2, 20, 'rect', funnelColor));
    obstacles.push(new Obstacle("funnel_R_wall", CANVAS_WIDTH / 2 + funnelOpeningWidth / 2, funnelTopY, CANVAS_WIDTH / 2 - 50 - funnelOpeningWidth / 2, 20, 'rect', funnelColor));

    obstacles.push(new Obstacle("funnel_L_slant", CANVAS_WIDTH / 2 - funnelOpeningWidth / 2 - 20, funnelTopY, 20, 100, 'rect', funnelColor));
    obstacles.push(new Obstacle("funnel_R_slant", CANVAS_WIDTH / 2 + funnelOpeningWidth / 2, funnelTopY, 20, 100, 'rect', funnelColor));

    // Small peg above drawer center to prevent letters getting stuck on the very edge of the funnel
    obstacles.push(new Obstacle("bottom_peg", CANVAS_WIDTH / 2 - 7, DRAWER_Y - 30, 14, 14, 'circle', pinColor1));
}

function resetAndStartGame() {
    availableNames = [...initialNames];
    fallingLetters = [];
    currentWordBuffer = "";
    lastSpawnTime = performance.now(); 
    gameIsOver = false;

    // (id, x, y, width, height, type, color)
    updateNamesDisplay();
    if(restartButton) restartButton.style.display = 'none';
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Clear canvas

    if (gameLoopId) cancelAnimationFrame(gameLoopId); // Clear previous loop if any
    gameLoopId = requestAnimationFrame(gameLoop);
}

function initGame() {
    setupObstacles(); // Define obstacles
    if (restartButton) {
        restartButton.addEventListener('click', resetAndStartGame);
    }
    resetAndStartGame(); // Initial start of the game
}

initGame();