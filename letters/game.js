const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const namesPanel = document.getElementById('namesList');
const restartButton = document.getElementById('restartButton');
const appContainer = document.getElementById('appContainer');
const namesInputElement = document.getElementById('namesInput'); // For user input of names
const updateNamesButton = document.getElementById('updateNamesBtn'); // Button to update names
const settingsToggleBtn = document.getElementById('settingsToggleBtn'); // Button to show/hide settings
const configArea = document.getElementById('config-area'); // The div containing settings

const CANVAS_WIDTH = 450;
const CANVAS_HEIGHT = 650;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const DEFAULT_NAMES = ['Kate', 'Andre', 'Juan', 'Dmytro', 'Vetura', 'Zachary', 'Lindsay'];
const LOCAL_STORAGE_KEY = 'namesList';
let originalNames = [...DEFAULT_NAMES]; // This will hold the master list of names
let availableNames = [...originalNames]; // Names currently available in the game
let fallingLetters = [];
let matchedNamesInOrder = []; // To store names in the order they are matched
let obstacles = [];
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

const PINBALL_LIGHT_COLORS = ['#FF3333', '#33FF33', '#33CCFF', '#FFFF33', '#FF33FF', '#FF9933', '#FFFFFF']; // Vibrant, light-like colors

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
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -0.7;
        } else if (this.x + this.radius > CANVAS_WIDTH) {
            this.x = CANVAS_WIDTH - this.radius;
            this.vx *= -0.7;
        }
        // Note: hasBouncedThisFrame is managed by checkCollisions and its timeouts
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
 
        // Add a shadow for a "glow" effect, common in pinball
        ctx.shadowColor = this.color; 
        ctx.shadowBlur = 8;
 
        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Use a chunkier font for letters
        ctx.font = `bold ${LETTER_SIZE}px 'Arial Black', Gadget, sans-serif`;
        ctx.fillText(this.char, 0, 0);

        ctx.shadowBlur = 0; // Reset shadowBlur so it doesn't affect other elements
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
        ctx.fillStyle = this.isAnimatingHit ? this.hitColor : this.color;
        if (this.type === 'rect') {
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
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

    const x = Math.random() * (CANVAS_WIDTH - LETTER_SIZE * 2) + LETTER_SIZE;
    fallingLetters.push(new Letter(char, x, -LETTER_SIZE)); // Start off-screen
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
            }

            if (collided) {
                letter.hasBouncedThisFrame[obstacle.id] = true;

                // Trigger obstacle hit animation
                if (!obstacle.isAnimatingHit) {
                    obstacle.isAnimatingHit = true;
                    obstacle.hitAnimationProgress = obstacle.hitAnimationDuration;
                    obstacle.color = obstacle.hitColor; // Immediately change to hit color
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
    // Optionally hide config area after update
    // toggleConfigArea(false); 
}
function gameLoop(timestamp) {
    // Clear canvas with a dark pinball-themed background
    ctx.fillStyle = '#0d001a'; // Very dark purple/blue, classic for pinball
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Drawer (Target Zone) with a more pinball-like style
    // Base of the drawer
    ctx.fillStyle = "#2c3e50"; // Dark slate gray, somewhat metallic
    ctx.fillRect(0, DRAWER_Y, CANVAS_WIDTH, DRAWER_HEIGHT);

    // Inner "well" or highlight for depth
    const drawerPadding = 4;
    ctx.fillStyle = "#34495e"; // Slightly lighter slate gray
    ctx.fillRect(drawerPadding, DRAWER_Y + drawerPadding, CANVAS_WIDTH - 2 * drawerPadding, DRAWER_HEIGHT - 2 * drawerPadding);

    // Text in the drawer
    ctx.fillStyle = "#ecf0f1"; // Light silver/white for text
    ctx.textAlign = "center";
    // Using a more thematic font. Ensure 'Orbitron' is linked via CSS or use a common fallback.
    // For 'Orbitron' or similar fonts, you might need to add: <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap" rel="stylesheet"> to your HTML.
    ctx.font = `bold ${LETTER_SIZE - 4}px 'Orbitron', sans-serif`;
    ctx.fillText(currentWordBuffer || "TARGET ZONE", CANVAS_WIDTH / 2, DRAWER_Y + DRAWER_HEIGHT / 2 + (LETTER_SIZE - 4)/2 - 2); // Adjusted Y for vertical centering

    // Spawn new letters
    if (!gameIsOver && timestamp - lastSpawnTime > LETTER_SPAWN_INTERVAL) {
        if (availableNames.length > 0) { // Only spawn if names are left
            spawnLetter();
        }
        lastSpawnTime = timestamp;
    }
    
    obstacles.forEach(obstacle => {
        obstacle.update(); // Update animation state
        obstacle.draw();
    });

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
        // Game Over message styling
        ctx.fillStyle = "rgba(0, 50, 100, 0.85)"; // Darker, more thematic overlay
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
    // Updated color palette for a more classic pinball feel
    const bumperColor = '#E91E63'; // Vibrant Pink/Red (like classic bumpers)
    const pinColor1 = '#FFEB3B';   // Bright Yellow (like lights or pins)
    const pinColor2 = '#03A9F4';   // Bright Blue (another light/pin color)
    const guideColor = '#757575';  // Medium Grey (for metallic guides)
    const funnelColor = '#424242'; // Dark Grey (for funnel parts, more depth)

    // Top bumpers to spread letters
    obstacles.push(new Obstacle("top_bump1", CANVAS_WIDTH / 2 - 20, 80, 40, 40, 'circle', pinColor1)); // Yellow
    obstacles.push(new Obstacle("top_bump2", CANVAS_WIDTH / 4, 130, 30, 30, 'circle', bumperColor)); // Pink/Red
    obstacles.push(new Obstacle("top_bump3", CANVAS_WIDTH * 3 / 4 - 30, 130, 30, 30, 'circle', bumperColor)); // Pink/Red

    // Side guides / walls
    obstacles.push(new Obstacle("side_guide_L1", 40, 180, 20, 150, 'rect', guideColor));
    obstacles.push(new Obstacle("side_guide_R1", CANVAS_WIDTH - 60, 180, 20, 150, 'rect', guideColor));

    // Mid-field pins
    obstacles.push(new Obstacle("mid_pin1", CANVAS_WIDTH / 2 - 60, 250, 25, 25, 'circle', pinColor2)); // Blue
    obstacles.push(new Obstacle("mid_pin2", CANVAS_WIDTH / 2 + 35, 250, 25, 25, 'circle', pinColor2)); // Blue
    obstacles.push(new Obstacle("mid_pin3", CANVAS_WIDTH / 2 - 12, 320, 25, 25, 'circle', pinColor1)); // Central Yellow

    // Slanted deflectors
    // For true slanted collision, polygon physics would be needed. These are rectangular approximations.
    // We can simulate slants by making them thin and long, or by rotating them (which adds draw complexity if not using a library)
    // For simplicity, using axis-aligned rectangles that guide.
    obstacles.push(new Obstacle("slant_L", 80, 380, 100, 15, 'rect', funnelColor)); // Darker for contrast
    obstacles.push(new Obstacle("slant_R", CANVAS_WIDTH - 180, 380, 100, 15, 'rect', funnelColor)); // Darker for contrast

    // Lower funnel - creating a narrower passage
    const funnelTopY = DRAWER_Y - 120;
    const funnelOpeningWidth = 80; // How wide the opening to the drawer is

    const shoulderTotalWidth = (CANVAS_WIDTH / 2 - 50 - funnelOpeningWidth / 2);
    const totalShoulderDrop = Math.floor(shoulderTotalWidth * 0.10); // 10% drop over the shoulder width

    const shoulderStepWidth = shoulderTotalWidth / 2;
    const shoulderStepDrop = totalShoulderDrop / 2; // Each step contributes half the drop

    // Left funnel shoulder (2 steps)
    obstacles.push(new Obstacle(
        "funnel_L_shoulder_step1",
        0, // x
        funnelTopY, // y
        shoulderStepWidth, // width of this step
        shoulderStepDrop,  // height of this step (also its vertical drop)
        'rect',
        funnelColor
    ));
    obstacles.push(new Obstacle(
        "funnel_L_shoulder_step2",
        50 + shoulderStepWidth, // x (starts after step1)
        funnelTopY + shoulderStepDrop, // y (starts at bottom of step1)
        shoulderStepWidth, // width of this step
        shoulderStepDrop,  // height of this step
        'rect',
        funnelColor
    ));

    // Right funnel shoulder (2 steps)
    const R_shoulder_X_start = CANVAS_WIDTH / 2 + funnelOpeningWidth / 2;
    obstacles.push(new Obstacle(
        "funnel_R_shoulder_step1",
        CANVAS_WIDTH - shoulderStepWidth, // x
        funnelTopY, // y
        shoulderStepWidth,
        shoulderStepDrop,
        'rect',
        funnelColor
    ));
    obstacles.push(new Obstacle(
        "funnel_R_shoulder_step2",
        R_shoulder_X_start,
        funnelTopY + shoulderStepDrop, // y
        shoulderStepWidth,
        shoulderStepDrop,
        'rect',
        funnelColor
    ));

    // Adjust the vertical funnel passage walls to connect below the total drop of the shoulders
    const funnelPassageStartY = funnelTopY + totalShoulderDrop;
    const funnelPassageHeight = 100 - totalShoulderDrop; // Original passage depth was 100

    obstacles.push(new Obstacle("funnel_L_passage", CANVAS_WIDTH / 2 - funnelOpeningWidth / 2 - 20, funnelPassageStartY, 20, funnelPassageHeight, 'rect', funnelColor));
    obstacles.push(new Obstacle("funnel_R_passage", CANVAS_WIDTH / 2 + funnelOpeningWidth / 2, funnelPassageStartY, 20, funnelPassageHeight, 'rect', funnelColor));
}

function fitAppToScreen() {
    if (!appContainer) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use a percentage of the viewport to leave some margin
    const availableWidth = viewportWidth * 0.95;
    const availableHeight = viewportHeight * 0.95;

    const scaleX = availableWidth / ORIGINAL_APP_WIDTH;
    const scaleY = availableHeight / ORIGINAL_APP_HEIGHT;

    let scale = Math.min(scaleX, scaleY);

    // Optional: Prevent upscaling beyond 1x if the original size fits comfortably
    // if (ORIGINAL_APP_WIDTH <= availableWidth && ORIGINAL_APP_HEIGHT <= availableHeight) {
    //     scale = Math.min(scale, 1);
    // }

    appContainer.style.transform = `scale(${scale})`;
}

function resetAndStartGame() {
    availableNames = [...originalNames]; // Use the potentially updated originalNames
    matchedNamesInOrder = []; // Reset the ordered list of matched names
    fallingLetters = [];
    currentWordBuffer = "";
    lastSpawnTime = performance.now(); 
    gameIsOver = false;

    updateNamesDisplay();
    if(restartButton) restartButton.style.display = 'none';
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Clear canvas

    if (gameLoopId) cancelAnimationFrame(gameLoopId); // Clear previous loop if any
    gameLoopId = requestAnimationFrame(gameLoop);
}

function toggleConfigArea(show) {
    if (!configArea || !settingsToggleBtn) return;
    if (show === undefined) {
        configArea.classList.toggle("config-hidden");
    } else if (show) {
        configArea.classList.remove("config-hidden");
    } else {
        configArea.classList.add("config-hidden");
    }
    settingsToggleBtn.textContent = configArea.classList.contains("config-hidden") ? "⚙️ Show Settings" : "⚙️ Hide Settings";
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
    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', () => toggleConfigArea());
    }
    resetAndStartGame(); // Initial start of the game

    // Add screen fitting logic
    fitAppToScreen(); // Initial fit
    window.addEventListener('resize', fitAppToScreen); // Fit on resize
}

toggleConfigArea(false); // Hide settings by default on load, called after initGame ensures elements exist
initGame();