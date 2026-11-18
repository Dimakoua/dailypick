const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const namesPanel = document.getElementById('namesList');
const restartButton = document.getElementById('restartButton');
const appContainer = document.getElementById('appContainer');
const namesInputElement = document.getElementById('namesInput'); // For user input of names
const updateNamesButton = document.getElementById('updateNamesBtn'); // Button to update names

const CANVAS_WIDTH = 450;
const CANVAS_HEIGHT = 675;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = CANVAS_WIDTH * DPR;
canvas.height = CANVAS_HEIGHT * DPR;
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const DEFAULT_NAMES = ['Kate', 'Andre', 'Juan', 'Dmytro', 'Vetura', 'Zachary', 'Lindsay'];
const LOCAL_STORAGE_KEY = 'namesList';
let originalNames = [...DEFAULT_NAMES]; // This will hold the master list of names
let availableNames = [...originalNames]; // Names currently available in the game
let fallingLetters = [];
let matchedNamesInOrder = []; // To store names in the order they are matched
const STANDUP_SOURCE = 'letters';

function normalizeStandupKey(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function uniqueNameList(names) {
    const seen = new Set();
    const result = [];
    names.forEach((name) => {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        const key = normalizeStandupKey(trimmed);
        if (!key || seen.has(key)) {
            return;
        }
        seen.add(key);
        result.push(trimmed);
    });
    return result;
}

function standupParticipants() {
    return uniqueNameList(originalNames);
}

function emitStandupReset() {
    const participants = standupParticipants();
    window.dispatchEvent(new CustomEvent('standup:queue-reset', {
        detail: {
            source: STANDUP_SOURCE,
            participants,
        },
    }));
    emitStandupUpdate();
}

function emitStandupUpdate(currentNameOverride) {
    const participants = standupParticipants();
    const completed = uniqueNameList(matchedNamesInOrder);
    const remainingList = uniqueNameList(availableNames);

    let current = null;
    if (typeof currentNameOverride === 'string') {
        const trimmed = currentNameOverride.trim();
        if (normalizeStandupKey(trimmed)) {
            current = trimmed;
        }
    }

    if (!current) {
        if (remainingList.length > 0) {
            current = remainingList[0];
        } else if (completed.length > 0) {
            current = completed[completed.length - 1];
        }
    }

    const currentKey = normalizeStandupKey(current);
    const upcoming = currentKey
        ? remainingList.filter((name) => normalizeStandupKey(name) !== currentKey)
        : remainingList;

    // Build full speaking order: completed so far, then current, then remaining
    var orderList = completed.slice();
    if (currentKey && !completed.some(function (n) { return normalizeStandupKey(n) === currentKey; })) {
        orderList.push(current);
    }
    orderList = orderList.concat(upcoming);

    const detail = {
        source: STANDUP_SOURCE,
        mode: 'auto',
        participants,
        order: orderList,
        completed,
        remaining: upcoming,
    };
    if (currentKey) {
        detail.current = current;
    }

    window.dispatchEvent(new CustomEvent('standup:queue', { detail }));
}

let obstacles = [];
let sparks = [];
let drawerFlashFrames = 0;
let lastMatchedBanner = '';
let lastMatchedBannerFrames = 0;
let currentWordBuffer = "";
let gameLoopId = null;
let gameIsOver = false;

const GRAVITY = 0.08;
const LETTER_SPAWN_INTERVAL = 500; // milliseconds
let lastSpawnTime = 0;
const LETTER_SIZE = 24;

// Original dimensions for scaling logic
const ORIGINAL_APP_WIDTH = 760; // Approx. width of h1 + gameContainer
const ORIGINAL_APP_HEIGHT = 780; // Approx. height of h1 + gameContainer + button

const DRAWER_HEIGHT = 60;
const DRAWER_Y = CANVAS_HEIGHT - DRAWER_HEIGHT;
const SHOOTER_LANE_WIDTH = 42;
const SHOOTER_LANE_X = CANVAS_WIDTH - SHOOTER_LANE_WIDTH;
const DOME_CENTER_X = CANVAS_WIDTH / 2;
const DOME_CENTER_Y = 125;
const DOME_RADIUS = CANVAS_WIDTH / 2 - 8;
let plungerCompression = 0; // 0 = resting, 1 = compressed spring

const PINBALL_LIGHT_COLORS = ['#FF3333', '#33FF33', '#33CCFF', '#FFFF33', '#FF33FF', '#FF9933', '#FFFFFF']; // Vibrant, light-like colors

// Theme helper to get CSS variables for canvas rendering
function getThemeColor(varName, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
}

function spawnSparks(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2.8;
        sparks.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.6,
            life: 16 + Math.floor(Math.random() * 12),
            maxLife: 28,
            size: 1.8 + Math.random() * 2.2,
            color: color || '#FFFFFF'
        });
    }
}

function drawRoundedRectPath(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

class Letter {
    constructor(char, x, y) {
        this.char = char.toUpperCase();
        this.x = x;
        this.y = y;
        this.vy = 0; // vertical velocity
        this.vx = (Math.random() - 0.5) * 1.5; // slight initial horizontal movement
        this.radius = LETTER_SIZE / 2;
        // Use a predefined palette for a more pinball-like feel
        this.color = PINBALL_LIGHT_COLORS[Math.floor(Math.random() * PINBALL_LIGHT_COLORS.length)];
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
        if (this.x - this.radius < 6) {
            this.x = 6 + this.radius;
            this.vx = Math.abs(this.vx) * 0.75;
        } else if (this.x + this.radius > CANVAS_WIDTH - 6) {
            this.x = CANVAS_WIDTH - 6 - this.radius;
            this.vx = -Math.abs(this.vx) * 0.75;
        }

        // Top curved pinball dome arch (curves plunger-launched letters into the playfield)
        if (this.y < DOME_CENTER_Y) {
            const dx = this.x - DOME_CENTER_X;
            const dy = this.y - DOME_CENTER_Y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = DOME_RADIUS - this.radius;
            if (dist > maxDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                this.x = DOME_CENTER_X + nx * maxDist;
                this.y = DOME_CENTER_Y + ny * maxDist;
                const dot = this.vx * nx + this.vy * ny;
                if (dot > 0) {
                    this.vx -= 1.82 * dot * nx;
                    this.vy -= 1.82 * dot * ny;
                    this.vx *= 0.96;
                    this.vy *= 0.96;
                }
            }
        }
        // Note: hasBouncedThisFrame is managed by checkCollisions and its timeouts
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Pinball token orb backing
        const tokenRadius = this.radius + 3;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;

        const orbGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, tokenRadius);
        orbGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
        orbGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.72)');
        orbGrad.addColorStop(1, this.color);

        ctx.beginPath();
        ctx.arc(0, 0, tokenRadius, 0, Math.PI * 2);
        ctx.fillStyle = orbGrad;
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = this.color;
        ctx.stroke();

        // Crisp letter inside token
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${LETTER_SIZE - 4}px 'Nunito', 'Arial Black', sans-serif`;
        ctx.fillText(this.char, 0, 1);

        ctx.restore();
    }
}

class Obstacle {
    constructor(id, x, y, width, height, type = 'rect', color = "#777", extra = {}) {
        this.id = id; // Unique ID for bounce tracking
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'rect', 'circle', or 'segment'
        this.radius = type === 'circle' ? width / 2 : 0;
        this.x1 = extra.x1 ?? x;
        this.y1 = extra.y1 ?? y;
        this.x2 = extra.x2 ?? width;
        this.y2 = extra.y2 ?? height;
        this.thickness = extra.thickness ?? 10;
        this.boost = extra.boost ?? 1.0;
        this.originalColor = color;
        this.color = this.originalColor; // Current color
        this.hitColor = '#FFFFFF'; // Color to flash to on hit (e.g., white)

        // Hit animation properties
        this.isAnimatingHit = false;
        this.hitAnimationDuration = 8; // Short flash (in frames)
        this.hitAnimationProgress = 0;
    }

    update() {
        if (this.isAnimatingHit) {
            this.hitAnimationProgress--;
            if (this.hitAnimationProgress <= 0) {
                this.isAnimatingHit = false;
                this.color = this.originalColor; // Reset to original color
            } else {
                // Could add more complex logic here, like fading back
                // For now, it just stays hitColor until duration ends
            }
        }
    }

    draw() {
        ctx.save();
        const activeColor = this.isAnimatingHit ? this.hitColor : this.color;

        if (this.type === 'rect') {
            drawRoundedRectPath(this.x, this.y, this.width, this.height, 6);
            const railGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            railGrad.addColorStop(0, this.isAnimatingHit ? '#ffffff' : 'rgba(255,255,255,0.22)');
            railGrad.addColorStop(0.25, activeColor);
            railGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
            ctx.fillStyle = railGrad;
            if (this.isAnimatingHit) {
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
            }
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = this.isAnimatingHit ? '#ffffff' : 'rgba(255, 255, 255, 0.28)';
            ctx.stroke();
        } else if (this.type === 'circle') {
            const cx = this.x + this.radius;
            const cy = this.y + this.radius;

            // Expanding hit halo
            if (this.isAnimatingHit) {
                const progress = 1 - (this.hitAnimationProgress / this.hitAnimationDuration);
                ctx.beginPath();
                ctx.arc(cx, cy, this.radius + 4 + progress * 10, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * (1 - progress)})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }

            // Outer bumper glow
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = this.isAnimatingHit ? 18 : 10;

            const bumperGrad = ctx.createRadialGradient(
                cx - this.radius * 0.3,
                cy - this.radius * 0.3,
                this.radius * 0.15,
                cx,
                cy,
                this.radius
            );
            bumperGrad.addColorStop(0, '#ffffff');
            bumperGrad.addColorStop(0.45, activeColor);
            bumperGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');

            ctx.beginPath();
            ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = bumperGrad;
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = this.isAnimatingHit ? '#ffffff' : 'rgba(255, 255, 255, 0.55)';
            ctx.stroke();

            // Inner bumper cap ring
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(cx, cy, this.radius * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (this.type === 'segment') {
            ctx.lineCap = 'round';
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = this.isAnimatingHit ? 14 : 6;
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = this.thickness;
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();

            // Specular highlight core along rail/flipper
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = Math.max(2, this.thickness * 0.28);
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function getNeededLettersToSpawn() {
    if (availableNames.length === 0) {
        return [];
    }
    const needed = new Set();
    const bufferLength = currentWordBuffer.length;

    if (bufferLength === 0) { // No current prefix, need starting letters
        availableNames.forEach(name => {
            if (name.length > 0) {
                needed.add(name[0].toUpperCase());
            }
        });
    } else { // We have a prefix in currentWordBuffer, need the next letter
        availableNames.forEach(name => {
            const nameUpper = name.toUpperCase();
            if (nameUpper.startsWith(currentWordBuffer) && nameUpper.length > bufferLength) {
                needed.add(nameUpper[bufferLength]); // The character after the currentWordBuffer
            }
        });
        // Fallback: If currentWordBuffer cannot be extended by any available name,
        // revert to spawning any valid starting letter to break a potential deadlock.
        if (needed.size === 0 && availableNames.length > 0) {
             availableNames.forEach(name => {
                if (name.length > 0) {
                    needed.add(name[0].toUpperCase());
                }
            });
        }
    }
    return Array.from(needed);
}

function spawnLetter() {
    const neededChars = getNeededLettersToSpawn();
    let char;
    if (neededChars.length > 0) {
        char = neededChars[Math.floor(Math.random() * neededChars.length)];
    } else {
        // This should not happen if availableNames.length > 0 and spawnLetter is called.
        return; // Don't spawn if no specifically needed starting letter is found.
    }

    const launchX = SHOOTER_LANE_X + SHOOTER_LANE_WIDTH / 2;
    const launchY = DRAWER_Y - 78;
    const letter = new Letter(char, launchX, launchY);
    letter.vx = (Math.random() - 0.5) * 0.35;
    letter.vy = -(13.0 + Math.random() * 1.6); // Fired up the shooter lane by the spring plunger!
    plungerCompression = 1;
    spawnSparks(launchX, launchY + 10, '#38bdf8', 7);
    fallingLetters.push(letter);
}

function updateNamesDisplay() {
    namesPanel.innerHTML = '';

    // Display matched names in the order they were matched
    matchedNamesInOrder.forEach(name => {
        const nameEl = document.createElement('div');
        nameEl.classList.add('name-item', 'matched');
        nameEl.textContent = name;
        nameEl.id = `name-${name.toLowerCase().replace(/\s+/g, '-')}`;
        namesPanel.appendChild(nameEl);
    });
    
    // Display available (unmatched) names, sorted alphabetically
    const sortedAvailableNames = [...availableNames].sort();
    sortedAvailableNames.forEach(name => {
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

                    // Nudge letters off horizontal shoulder steps if they land on top
                    // normalY points from the obstacle surface towards the letter's center.
                    // If normalY is strongly negative (e.g., < -0.85), it means the letter hit the top surface.
                    if (normalY < -0.85) { 
                        const nudgeSpeed = 0.45; // Small horizontal speed to prevent sticking
                        if (obstacle.id.startsWith("funnel_L_shoulder_step") || obstacle.id.startsWith("slant_L")) {
                            letter.vx += nudgeSpeed; // Nudge right
                        } else if (obstacle.id.startsWith("funnel_R_shoulder_step") || obstacle.id.startsWith("slant_R")) {
                            letter.vx -= nudgeSpeed; // Nudge left
                        }
                    }
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
            } else if (obstacle.type === 'segment') {
                const segDx = obstacle.x2 - obstacle.x1;
                const segDy = obstacle.y2 - obstacle.y1;
                const lenSq = segDx * segDx + segDy * segDy;
                const t = lenSq > 0
                    ? Math.max(0, Math.min(1, ((letter.x - obstacle.x1) * segDx + (letter.y - obstacle.y1) * segDy) / lenSq))
                    : 0;
                const closestX = obstacle.x1 + t * segDx;
                const closestY = obstacle.y1 + t * segDy;
                const dx = letter.x - closestX;
                const dy = letter.y - closestY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = letter.radius + obstacle.thickness / 2;

                if (distance < minDist && distance > 0.0001) {
                    collided = true;
                    const overlap = minDist - distance;
                    const normalX = dx / distance;
                    const normalY = dy / distance;

                    letter.x += normalX * overlap;
                    letter.y += normalY * overlap;

                    const dot = letter.vx * normalX + letter.vy * normalY;
                    if (dot < 0) {
                        const bounce = restitution * (obstacle.boost || 1.0);
                        letter.vx -= (1 + bounce) * dot * normalX;
                        letter.vy -= (1 + bounce) * dot * normalY;
                    }
                }
            }

            if (collided) {
                letter.hasBouncedThisFrame[obstacle.id] = true;

                // Trigger obstacle hit animation + sparks
                if (!obstacle.isAnimatingHit) {
                    obstacle.isAnimatingHit = true;
                    obstacle.hitAnimationProgress = obstacle.hitAnimationDuration;
                    obstacle.color = obstacle.hitColor; // Immediately change to hit color
                    spawnSparks(letter.x, letter.y, obstacle.originalColor || letter.color, 5);
                }
                letter.angularVelocity += (Math.random() - 0.5) * 0.3; // Adjust spin intensity

                setTimeout(() => { delete letter.hasBouncedThisFrame[obstacle.id]; }, 100); // Cooldown for this specific obstacle
                const spinFactor = 0.15 * (Math.random() - 0.5); // Keep existing pinball spin
                letter.vx += -letter.vy * spinFactor * 0.1; // A bit of tangential velocity
                letter.vy += letter.vx * spinFactor * 0.1;
            }
        });
    });
}

// Helper function for completing a match
function completeMatch(matchedName) {
    animateMatchedName(matchedName);
    matchedNamesInOrder.push(matchedName);
    availableNames = availableNames.filter(n => n !== matchedName);
    updateNamesDisplay();
    currentWordBuffer = ""; // Reset buffer after a successful match
    drawerFlashFrames = 20;
    lastMatchedBanner = matchedName;
    lastMatchedBannerFrames = 75;
    spawnSparks(CANVAS_WIDTH / 2, DRAWER_Y + 10, '#00E676', 18);
    emitStandupUpdate();
}

function processLetterInDrawer(char) {
    const incomingCharUpper = char.toUpperCase();

    // Scenario 1: Try extending the current buffer
    const currentAttempt = (currentWordBuffer + incomingCharUpper).toUpperCase();
    let potentialMatchesForAttempt = availableNames.filter(name =>
        name.toUpperCase().startsWith(currentAttempt)
    );

    if (potentialMatchesForAttempt.length === 1) {
        completeMatch(potentialMatchesForAttempt[0]);
        return;
    }

    if (potentialMatchesForAttempt.length > 1) {
        currentWordBuffer = currentAttempt; // Extend buffer, still ambiguous
        return;
    }

    // Scenario 2: currentAttempt matched 0 names.
    // This means incomingCharUpper did not successfully extend currentWordBuffer.
    // If currentWordBuffer itself was a valid prefix for multiple names,
    // we want to keep it and discard incomingCharUpper for matching.
    if (currentWordBuffer.length > 0) {
        const potentialMatchesForExistingBuffer = availableNames.filter(name =>
            name.toUpperCase().startsWith(currentWordBuffer)
        );
        if (potentialMatchesForExistingBuffer.length > 1) {
            // currentWordBuffer was a valid multi-match prefix (e.g., "A" for Aiden, Ava).
            // The incomingCharUpper (e.g., "X") was not helpful.
            // Keep currentWordBuffer as is and wait for a better letter.
            return; // currentWordBuffer remains unchanged.
        }
    }

    // Scenario 3: currentAttempt matched 0, AND currentWordBuffer was not a multi-match prefix (or was empty).
    // Try matching incomingCharUpper by itself as a new sequence start.
    let potentialMatchesForSingleChar = availableNames.filter(name =>
        name.toUpperCase().startsWith(incomingCharUpper)
    );

    if (potentialMatchesForSingleChar.length === 1) {
        completeMatch(potentialMatchesForSingleChar[0]);
    } else if (potentialMatchesForSingleChar.length > 1) {
        currentWordBuffer = incomingCharUpper; // Start new buffer with this char
    } else {
        currentWordBuffer = ""; // No match at all, reset buffer
    }
}

function loadNamesFromStorage() {
    const storedNamesJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedNamesJson) {
        try {
            const storedNames = JSON.parse(storedNamesJson);
            if (Array.isArray(storedNames) && storedNames.length > 0) {
                originalNames = [...storedNames];
            } else {
                originalNames = [...DEFAULT_NAMES]; // Fallback if stored array is empty
            }
        } catch (e) {
            console.error("Error parsing names from localStorage:", e);
            originalNames = [...DEFAULT_NAMES]; // Fallback on error
        }
    } else {
        originalNames = [...DEFAULT_NAMES];
    }
    if (namesInputElement) {
        namesInputElement.value = originalNames.join('\n');
    }
    // availableNames will be set in resetAndStartGame based on originalNames
}

function saveNamesToStorage() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(originalNames));
}

function updateNamesFromInput() {
    if (!namesInputElement) return;
    const inputText = namesInputElement.value.trim();
    const newNames = inputText ? inputText.split(/[\n,]+/).map(name => name.trim()).filter(name => name.length > 0) : [];
    originalNames = newNames.length > 0 ? [...newNames] : [...DEFAULT_NAMES];
    
    if (namesInputElement) { // Update textarea to reflect the processed list (e.g. if default was used)
        namesInputElement.value = originalNames.join('\n');
    }
    saveNamesToStorage();
    resetAndStartGame(); // This will re-initialize availableNames from the new originalNames
}
function drawPinballTableDetails(accent) {
    ctx.save();

    // Top curved dome arch border
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS, Math.PI, 0);
    ctx.stroke();

    // Right-side Shooter Lane track
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(30, 64, 175, 0.42)';
    ctx.fillRect(SHOOTER_LANE_X, DOME_CENTER_Y, SHOOTER_LANE_WIDTH - 6, DRAWER_Y - DOME_CENTER_Y);

    // Shooter lane upward chevrons
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    const laneCenterX = SHOOTER_LANE_X + SHOOTER_LANE_WIDTH / 2;
    for (let cy = DRAWER_Y - 120; cy > DOME_CENTER_Y + 25; cy -= 42) {
        ctx.beginPath();
        ctx.moveTo(laneCenterX - 6, cy + 5);
        ctx.lineTo(laneCenterX, cy - 3);
        ctx.lineTo(laneCenterX + 6, cy + 5);
        ctx.stroke();
    }

    // Spring Plunger (Пружина) in bottom-right corner
    if (plungerCompression > 0.01) {
        plungerCompression *= 0.84;
    } else {
        plungerCompression = 0;
    }
    const plungerBaseY = DRAWER_Y - 8;
    const restHeight = 56;
    const currentHeight = restHeight * (1 - 0.55 * plungerCompression);
    const plungerTopY = plungerBaseY - currentHeight;

    // Spring housing base
    ctx.fillStyle = '#334155';
    ctx.fillRect(laneCenterX - 11, plungerBaseY - 4, 22, 8);

    // Metallic zig-zag spring coils
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const coils = 7;
    for (let i = 0; i <= coils; i++) {
        const y = plungerBaseY - 4 - (i / coils) * (currentHeight - 10);
        const x = i === 0 || i === coils ? laneCenterX : laneCenterX + (i % 2 === 0 ? -9 : 9);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plunger striker cap (glowing neon tip)
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 10;
    drawRoundedRectPath(laneCenterX - 12, plungerTopY - 8, 24, 10, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle glowing triangle fill for left & right slingshots
    ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
    ctx.beginPath();
    ctx.moveTo(52, 410);
    ctx.lineTo(52, 480);
    ctx.lineTo(106, 480);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(SHOOTER_LANE_X - 52, 410);
    ctx.lineTo(SHOOTER_LANE_X - 52, 480);
    ctx.lineTo(SHOOTER_LANE_X - 106, 480);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function gameLoop(timestamp) {
    const accent = getThemeColor('--brand-accent', '#38bdf8');
    const textColor = getThemeColor('--brand-text', '#f8fafc');

    // Bright royal-blue arcade radial playfield backdrop
    const bgGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.35, 30,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.78
    );
    bgGrad.addColorStop(0, '#2563eb');
    bgGrad.addColorStop(0.55, '#1e3a8a');
    bgGrad.addColorStop(1, '#172554');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle playfield dot matrix & center guide arc
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let gx = 25; gx < CANVAS_WIDTH; gx += 36) {
        for (let gy = 30; gy < DRAWER_Y - 20; gy += 36) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 165, 130, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.restore();

    drawPinballTableDetails(accent);

    // Sleek Target Zone (Bottom Collector - spans main playfield)
    ctx.save();
    const drawerMargin = 8;
    const drawerX = drawerMargin;
    const drawerW = SHOOTER_LANE_X - drawerMargin * 2;
    const drawerTop = DRAWER_Y + 4;
    const drawerH = DRAWER_HEIGHT - 10;

    drawRoundedRectPath(drawerX, drawerTop, drawerW, drawerH, 12);
    const wellGrad = ctx.createLinearGradient(0, drawerTop, 0, drawerTop + drawerH);
    if (drawerFlashFrames > 0) {
        wellGrad.addColorStop(0, 'rgba(0, 230, 118, 0.38)');
        wellGrad.addColorStop(1, 'rgba(6, 78, 59, 0.85)');
        drawerFlashFrames--;
    } else {
        wellGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
        wellGrad.addColorStop(1, 'rgba(30, 41, 59, 0.95)');
    }
    ctx.fillStyle = wellGrad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.shadowColor = drawerFlashFrames > 0 ? '#00E676' : accent;
    ctx.shadowBlur = drawerFlashFrames > 0 ? 16 : 8;
    ctx.strokeStyle = drawerFlashFrames > 0 ? '#00E676' : accent;
    ctx.stroke();

    // Target Zone text
    ctx.shadowBlur = 0;
    ctx.fillStyle = currentWordBuffer ? '#ffffff' : 'rgba(248, 250, 252, 0.78)';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${LETTER_SIZE - 5}px 'Nunito', sans-serif`;
    const zoneLabel = currentWordBuffer ? `MATCHING: ${currentWordBuffer}` : "TARGET ZONE";
    ctx.fillText(zoneLabel, drawerX + drawerW / 2, drawerTop + drawerH / 2 + 1);
    ctx.restore();

    // Spawn new letters
    if (!gameIsOver && timestamp - lastSpawnTime > LETTER_SPAWN_INTERVAL) {
        if (availableNames.length > 0) {
            spawnLetter();
        }
        lastSpawnTime = timestamp;
    }

    obstacles.forEach(obstacle => {
        obstacle.update();
        obstacle.draw();
    });

    for (let i = fallingLetters.length - 1; i >= 0; i--) {
        const letter = fallingLetters[i];
        letter.update();

        // Keep letters inside shooter lane bouncing off the spring plunger until launched over the top arch
        if (letter.x > SHOOTER_LANE_X && letter.y + letter.radius > DRAWER_Y - 70) {
            letter.y = DRAWER_Y - 70 - letter.radius;
            letter.vy = -(13.0 + Math.random() * 1.4);
            plungerCompression = 1;
            spawnSparks(letter.x, letter.y + letter.radius, '#f43f5e', 5);
        } else if (letter.x <= SHOOTER_LANE_X && letter.y + letter.radius > DRAWER_Y) {
            spawnSparks(letter.x, DRAWER_Y, letter.color, 4);
            processLetterInDrawer(letter.char);
            fallingLetters.splice(i, 1);
        } else if (letter.y - letter.radius > CANVAS_HEIGHT) {
            fallingLetters.splice(i, 1);
        }
    }

    checkCollisions();

    // Update & render sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.06;
        s.life--;
        if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    fallingLetters.forEach(letter => letter.draw());

    // Brief floating banner when a name matches
    if (lastMatchedBannerFrames > 0) {
        lastMatchedBannerFrames--;
        ctx.save();
        ctx.globalAlpha = Math.min(1, lastMatchedBannerFrames / 15);
        drawRoundedRectPath(CANVAS_WIDTH / 2 - 135, DRAWER_Y - 46, 270, 32, 16);
        ctx.fillStyle = 'rgba(0, 230, 118, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = "800 14px 'Nunito', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`✨ Picked: ${lastMatchedBanner}`, CANVAS_WIDTH / 2, DRAWER_Y - 30);
        ctx.restore();
    }

    if (availableNames.length === 0 && fallingLetters.length === 0) {
        ctx.save();
        const cardW = 310;
        const cardH = 140;
        const cardX = (CANVAS_WIDTH - cardW) / 2;
        const cardY = (CANVAS_HEIGHT - cardH) / 2 - 20;

        drawRoundedRectPath(cardX, cardY, cardW, cardH, 18);
        ctx.fillStyle = 'rgba(9, 19, 42, 0.92)';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = accent;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = textColor;
        ctx.font = "800 24px 'Nunito', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎉 All Names Matched!", CANVAS_WIDTH / 2, cardY + 52);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
        ctx.font = "600 15px 'Nunito', sans-serif";
        ctx.fillText("Click Restart below to play again.", CANVAS_WIDTH / 2, cardY + 92);
        ctx.restore();

        if (!gameIsOver) {
            if (restartButton) restartButton.style.display = 'block';
            gameIsOver = true;
        }
        return;
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

function setupObstacles() {
    obstacles = [];
    const accent = getThemeColor('--brand-accent', '#fbbf24');
    const bumperColor = '#ec4899';
    const pinBlue = '#38bdf8';
    const railSilver = '#94a3b8';
    const flipperColor = '#22d3ee';

    // Right-side shooter lane divider rail
    obstacles.push(new Obstacle('shooter_divider', 0, 0, 0, 0, 'segment', railSilver, {
        x1: SHOOTER_LANE_X,
        y1: DOME_CENTER_Y + 8,
        x2: SHOOTER_LANE_X,
        y2: DRAWER_Y - 6,
        thickness: 8
    }));

    // Top 3 classic pop bumpers
    obstacles.push(new Obstacle('top_bump1', SHOOTER_LANE_X / 2 - 21, 108, 42, 42, 'circle', accent));
    obstacles.push(new Obstacle('top_bump2', 95, 162, 34, 34, 'circle', bumperColor));
    obstacles.push(new Obstacle('top_bump3', SHOOTER_LANE_X - 129, 162, 34, 34, 'circle', bumperColor));

    // Mid-field diamond pins
    obstacles.push(new Obstacle('mid_pin1', SHOOTER_LANE_X / 2 - 72, 260, 26, 26, 'circle', pinBlue));
    obstacles.push(new Obstacle('mid_pin2', SHOOTER_LANE_X / 2 + 46, 260, 26, 26, 'circle', pinBlue));
    obstacles.push(new Obstacle('mid_pin3', SHOOTER_LANE_X / 2 - 14, 326, 28, 28, 'circle', accent));

    // Side angled guide rails
    obstacles.push(new Obstacle('guide_L', 0, 0, 0, 0, 'segment', railSilver, {
        x1: 22,
        y1: 230,
        x2: 52,
        y2: 340,
        thickness: 8
    }));
    obstacles.push(new Obstacle('guide_R', 0, 0, 0, 0, 'segment', railSilver, {
        x1: SHOOTER_LANE_X - 22,
        y1: 230,
        x2: SHOOTER_LANE_X - 52,
        y2: 340,
        thickness: 8
    }));

    // Left & Right Slingshot kickers
    obstacles.push(new Obstacle('sling_L', 0, 0, 0, 0, 'segment', bumperColor, {
        x1: 52,
        y1: 410,
        x2: 106,
        y2: 480,
        thickness: 10,
        boost: 1.25
    }));
    obstacles.push(new Obstacle('sling_R', 0, 0, 0, 0, 'segment', bumperColor, {
        x1: SHOOTER_LANE_X - 52,
        y1: 410,
        x2: SHOOTER_LANE_X - 106,
        y2: 480,
        thickness: 10,
        boost: 1.25
    }));

    // Left & Right Flippers funneling letters into the Target Zone
    obstacles.push(new Obstacle('flipper_L', 0, 0, 0, 0, 'segment', flipperColor, {
        x1: 34,
        y1: 520,
        x2: 154,
        y2: 568,
        thickness: 14,
        boost: 1.05
    }));
    obstacles.push(new Obstacle('flipper_R', 0, 0, 0, 0, 'segment', flipperColor, {
        x1: SHOOTER_LANE_X - 34,
        y1: 520,
        x2: SHOOTER_LANE_X - 154,
        y2: 568,
        thickness: 14,
        boost: 1.05
    }));
}

function fitAppToScreen() {
    if (!appContainer) return;

    const isEmbedded = window.self !== window.top ||
        new URLSearchParams(window.location.search).get('embed');

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // In embedded/iframe mode use a smaller portion so the game feels compact
    const marginPct = isEmbedded ? 0.7 : 0.95;
    const availableWidth = viewportWidth * marginPct;
    const availableHeight = viewportHeight * marginPct;

    const scaleX = availableWidth / ORIGINAL_APP_WIDTH;
    const scaleY = availableHeight / ORIGINAL_APP_HEIGHT;

    let scale = Math.min(scaleX, scaleY);

    // Prevent upscaling beyond 1x if the original size fits comfortably
    if (ORIGINAL_APP_WIDTH <= availableWidth && ORIGINAL_APP_HEIGHT <= availableHeight) {
        scale = Math.min(scale, 1);
    }

    // In embedded mode, cap the scale so it doesn't fill the entire iframe
    if (isEmbedded) {
        scale = Math.min(scale, 0.85);
    }

    appContainer.style.transform = `scale(${scale})`;
    appContainer.style.transformOrigin = 'top center';
}

function resetAndStartGame() {
    availableNames = [...originalNames]; // Use the potentially updated originalNames
    matchedNamesInOrder = []; // Reset the ordered list of matched names
    fallingLetters = [];
    sparks = [];
    drawerFlashFrames = 0;
    lastMatchedBannerFrames = 0;
    currentWordBuffer = "";
    lastSpawnTime = performance.now();
    gameIsOver = false;
    emitStandupReset();

    updateNamesDisplay();
    if(restartButton) restartButton.style.display = 'none';
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Clear canvas

    if (gameLoopId) cancelAnimationFrame(gameLoopId); // Clear previous loop if any
    gameLoopId = requestAnimationFrame(gameLoop);
}

function initGame() {
    loadNamesFromStorage(); // Load names from localStorage or use defaults
    setupObstacles(); // Define obstacles

    if (restartButton) {
        restartButton.addEventListener('click', resetAndStartGame);
    }
    if (updateNamesButton) {
        updateNamesButton.addEventListener('click', updateNamesFromInput);
    }
    resetAndStartGame(); // Initial start of the game

    // Add screen fitting logic
    fitAppToScreen(); // Initial fit
    window.addEventListener('resize', fitAppToScreen); // Fit on resize
}

initGame();