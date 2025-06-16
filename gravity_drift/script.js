document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('startButton');
    const leaderboardDiv = document.getElementById('leaderboard');
    const leaderboardList = document.getElementById('leaderboardList');

    // Game settings & Constants
    canvas.width = 800;
    canvas.height = 600;

    class Vector2D {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        set(x, y) { this.x = x; this.y = y; return this; }
        add(vec) { this.x += vec.x; this.y += vec.y; return this; }
        sub(vec) { this.x -= vec.x; this.y -= vec.y; return this; }
        mult(scalar) { this.x *= scalar; this.y *= scalar; return this; }
        div(scalar) { if (scalar !== 0) { this.x /= scalar; this.y /= scalar; } else { this.x = 0; this.y = 0; } return this; }
        mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
        magSq() { return this.x * this.x + this.y * this.y; }
        normalize() { const m = this.mag(); if (m > 0) { this.div(m); } return this; }
        clone() { return new Vector2D(this.x, this.y); }
        static add(v1, v2) { return new Vector2D(v1.x + v2.x, v1.y + v2.y); }
        static sub(v1, v2) { return new Vector2D(v1.x - v2.x, v1.y - v2.y); }
        static fromAngle(angle, magnitude = 1) { return new Vector2D(magnitude * Math.cos(angle), magnitude * Math.sin(angle)); }
    }

    const G = 0.5; // Gravitational constant (tweak for gameplay)
    const NUM_ROCKETS_PER_LAUNCH = 5;
    const ROCKET_RADIUS = 4; // Visual size
    const STAR_COUNT = 250;
    const HEAVY_STAR_BORDER_THICKNESS = 15; // Visual thickness of the boundary
    const FUEL_CONSUMPTION_RATE = 0.2; // Fuel units per second
    const MAX_TRAIL_LENGTH = 200;
    const SUN_POSITION = new Vector2D(canvas.width / 2, canvas.height / 2);
    const SUN_RADIUS = 20;
    const LAUNCH_SPREAD_ANGLE = Math.PI / 1.5; // Approx 120 degrees total spread ( +/- 60 deg from target)
    const SUN_MASS = 15000; // Significantly more massive than planets
    const EARTH_NAME = "Earth";

    let stars = [];
    let planets = [];
    let rockets = [];
    let gameRunning = false;
    let lastTime = 0;
    let earthPlanet = null;


    class Planet {
        constructor(name, orbitalRadius, radius, mass, color, orbitalAngularSpeed, isLaunchPlanet = false) {
            this.name = name;
            this.orbitalRadius = orbitalRadius;
            this.radius = radius;
            this.mass = mass;
            this.color = color;
            this.orbitalAngularSpeed = orbitalAngularSpeed; // Radians per second
            this.isLaunchPlanet = isLaunchPlanet;
            this.currentAngle = Math.random() * Math.PI * 2;
            this.position = new Vector2D();
            this.velocity = new Vector2D();
            this.orbitalPathPoints = []; // To store points for drawing the orbit
            this.updatePosition(0, SUN_POSITION); // Initialize position and velocity
        }

        updatePosition(dt, sunPosition) {
            this.currentAngle += this.orbitalAngularSpeed * dt;
            this.currentAngle %= (Math.PI * 2);

            const newX = sunPosition.x + this.orbitalRadius * Math.cos(this.currentAngle);
            const newY = sunPosition.y + this.orbitalRadius * Math.sin(this.currentAngle);

            const speed = Math.abs(this.orbitalAngularSpeed * this.orbitalRadius);
            const tangentAngle = this.currentAngle + (Math.sign(this.orbitalAngularSpeed) * Math.PI / 2);
            this.velocity.set(speed * Math.cos(tangentAngle), speed * Math.sin(tangentAngle));
            
            this.position.set(newX, newY);
        }

        calculateOrbitalPath(sunPosition) {
            this.orbitalPathPoints = [];
            const points = 100; // Number of segments to draw the circle
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                this.orbitalPathPoints.push(
                    new Vector2D(
                        sunPosition.x + this.orbitalRadius * Math.cos(angle),
                        sunPosition.y + this.orbitalRadius * Math.sin(angle)
                    )
                );
            }
        }

        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(this.name, this.position.x, this.position.y - this.radius - 5);
        }

        drawOrbit(ctx) {
            if (this.orbitalPathPoints.length < 2) return;

            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; // Faint white for orbit lines
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.orbitalPathPoints[0].x, this.orbitalPathPoints[0].y);
            for (let i = 1; i < this.orbitalPathPoints.length; i++) {
                ctx.lineTo(this.orbitalPathPoints[i].x, this.orbitalPathPoints[i].y);
            }
            ctx.stroke();
        }
    }

    class Rocket {
        constructor(id, name, startPos, startVel, initialFuel) {
            this.id = id;
            this.name = name;
            this.position = startPos.clone();
            this.velocity = startVel.clone();
            this.acceleration = new Vector2D();
            this.initialFuel = initialFuel;
            this.fuel = initialFuel;
            this.radius = ROCKET_RADIUS;
            this.color = `hsl(${Math.random() * 360}, 100%, 70%)`;
            this.trail = [];
            this.isLost = false;
            this.isLanded = false;
            this.landedOnPlanetName = null;
            this.distanceTraveled = 0;
        }

        applyForce(force) {
            this.acceleration.add(force); // Assuming rocket mass is 1 for F=a
        }

        update(dt, planets, canvasWidth, canvasHeight, earthName) {
            if (this.isLanded || this.isLost) return;

            if (this.fuel > 0) {
                this.fuel -= FUEL_CONSUMPTION_RATE * dt;
                if (this.fuel < 0) this.fuel = 0;
            }

            // Apply Sun's gravity
            const directionToSun = Vector2D.sub(SUN_POSITION, this.position);
            let distSqToSun = directionToSun.magSq();
            // Prevent extreme forces if rocket somehow gets too close or inside the Sun's visual radius
            if (distSqToSun < (SUN_RADIUS * SUN_RADIUS)) distSqToSun = SUN_RADIUS * SUN_RADIUS; 
            if (distSqToSun > 0) { // Ensure not dividing by zero if at exact center (highly unlikely)
                const forceMagnitudeSun = (G * SUN_MASS) / distSqToSun;
                const forceVectorSun = directionToSun.normalize().mult(forceMagnitudeSun);
                this.applyForce(forceVectorSun);
            }

            planets.forEach(planet => {
                const direction = Vector2D.sub(planet.position, this.position);
                let distSq = direction.magSq();
                if (distSq < (planet.radius * planet.radius)) distSq = planet.radius * planet.radius; // Avoid division by zero or extreme force if inside
                if (distSq === 0) return;

                const forceMagnitude = (G * planet.mass) / distSq;
                const forceVector = direction.normalize().mult(forceMagnitude);
                this.applyForce(forceVector);
            });

            this.velocity.add(this.acceleration.clone().mult(dt));
            const displacement = this.velocity.clone().mult(dt);
            this.position.add(displacement);
            this.distanceTraveled += displacement.mag();
            this.acceleration.set(0, 0);

            this.trail.push(this.position.clone());
            if (this.trail.length > MAX_TRAIL_LENGTH) {
                this.trail.shift();
            }

            if (this.position.x < 0 || this.position.x > canvasWidth ||
                this.position.y < 0 || this.position.y > canvasHeight) {
                this.isLost = true;
                return;
            }

            for (const planet of planets) {
                if (planet.isLaunchPlanet && planet.name === earthName) continue;

                const distToPlanetCenter = Vector2D.sub(planet.position, this.position).mag();
                if (distToPlanetCenter < planet.radius + this.radius) {
                    this.isLanded = true;
                    this.landedOnPlanetName = planet.name;
                    this.velocity.set(0, 0);
                    // Snap to surface-ish
                    const landingDir = Vector2D.sub(this.position, planet.position).normalize();
                    this.position = Vector2D.add(planet.position, landingDir.mult(planet.radius));
                    return;
                }
            }
        }

        draw(ctx) {
            if (this.trail.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.5;
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            if (this.velocity.magSq() > 0.001) {
                const angle = Math.atan2(this.velocity.y, this.velocity.x);
                ctx.rotate(angle);
            }

            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.radius * 1.5, 0); // Nose
            ctx.lineTo(-this.radius * 0.75, -this.radius * 0.75); // Back left
            ctx.lineTo(-this.radius * 0.75, this.radius * 0.75);  // Back right
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 1.2,
                alpha: Math.random() * 0.6 + 0.2
            });
        }
    }

    function initPlanets() {
        planets = [];
        earthPlanet = new Planet(EARTH_NAME, 150, 12, 1000, '#3a7d9d', 0.005, true); // Blue-ish
        planets.push(earthPlanet);
        planets.push(new Planet("Mercury", 60, 6, 700, '#a5a5a5', 0.025));    // Greyish, mass was 500
        planets.push(new Planet("Venus", 100, 10, 1200, '#e4a853', 0.018));   // Yellowish-orange, mass was 900
        planets.push(new Planet("Ceres", 190, 7, 850, '#d2b48c', 0.012));   // Tan/Brownish, mass was 600
        planets.push(new Planet("Mars", 230, 9, 1000, '#c1440e', 0.010));    // Reddish, mass was 700
        planets.push(new Planet("Vesta", 270, 8, 900, '#8B4513', 0.009));    // SaddleBrown/Rocky, mass was 650
        planets.push(new Planet("Jupiter", 320, 22, 3200, '#d8ca9d', 0.0065)); // Pale yellow/brown, mass was 2500
        planets.push(new Planet("Saturn", 380, 18, 2700, '#f0e68c', 0.0050));  // Khaki/Pale Gold, mass was 2000
        planets.push(new Planet("Neptune", 430, 15, 2400, '#6495ED', 0.0038)); // CornflowerBlue/Icy, mass was 1800
        planets.forEach(p => {
            p.updatePosition(0, SUN_POSITION);
            p.calculateOrbitalPath(SUN_POSITION); // Calculate path points once
        });
    }

    function launchRockets() {
        rockets = [];
        if (!earthPlanet) {
            console.error("Earth not found for launching rockets!");
            return;
        }

        for (let i = 0; i < NUM_ROCKETS_PER_LAUNCH; i++) {
            const rocketName = `Drifter-${String.fromCharCode(65 + i)}`;
            
            let launchDirection;
            const targetablePlanets = planets.filter(p => p !== earthPlanet);

            if (targetablePlanets.length > 0) {
                // Pick a random target planet (not Earth)
                const targetPlanet = targetablePlanets[Math.floor(Math.random() * targetablePlanets.length)];
                
                // Calculate direction from Earth to the target planet
                const directionToTarget = Vector2D.sub(targetPlanet.position, earthPlanet.position);
                const baseAngleToTarget = Math.atan2(directionToTarget.y, directionToTarget.x);
                
                // Add random spread to the launch angle
                const randomOffsetAngle = (Math.random() - 0.5) * LAUNCH_SPREAD_ANGLE;
                launchDirection = Vector2D.fromAngle(baseAngleToTarget + randomOffsetAngle);
            } else {
                // Fallback to fully random launch if no other planets exist (shouldn't happen with current setup)
                launchDirection = Vector2D.fromAngle(Math.random() * Math.PI * 2);
            }
            // Start rockets from just outside Earth's surface in the launch direction
            const startPos = Vector2D.add(earthPlanet.position, launchDirection.clone().mult(earthPlanet.radius + ROCKET_RADIUS + 2)); // +2 for a small buffer

            // Increased initial speed relative to Earth: (e.g., 30-50 units/sec)
            const launchSpeedRelativeToEarth = (Math.random() * 1.0 + 1.5) * 20; // Was (Math.random() * 0.75 + 0.5) * 20;
            const launchVelocityRelativeToEarth = launchDirection.clone().mult(launchSpeedRelativeToEarth);

            const initialRocketVelocity = Vector2D.add(earthPlanet.velocity, launchVelocityRelativeToEarth);
            const initialFuel = Math.random() * 60 + 40; // Random fuel (40-100)
            rockets.push(new Rocket(i, rocketName, startPos, initialRocketVelocity, initialFuel));
        }
    }

    function startGame() {
        if (gameRunning && rockets.length > 0 && !rockets.every(r => r.isLanded || r.isLost)) {
            // If game is running and not all rockets finished, don't restart yet.
            // Or, implement a "force restart" if needed. For now, this prevents accidental quick restarts.
            return;
        }
        gameRunning = true;
        leaderboardDiv.classList.add('hidden');
        leaderboardList.innerHTML = '';
        
        initStars(); // Keep stars consistent or re-randomize
        initPlanets(); // This will re-randomize planet starting positions
        launchRockets();
        
        lastTime = performance.now(); // Use performance.now() for more accurate dt
        requestAnimationFrame(gameLoop);
        startButton.textContent = "Restart Game";
    }

    function gameLoop(timestamp) {
        if (!gameRunning) return;

        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // --- Update ---
        planets.forEach(planet => planet.updatePosition(dt, SUN_POSITION));
        rockets.forEach(rocket => rocket.update(dt, planets, canvas.width, canvas.height, EARTH_NAME));

        // --- Draw ---
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawStars();
        drawHeavyStarSkies();

        ctx.fillStyle = '#FFD700'; // Sun color
        ctx.beginPath();
        ctx.arc(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // Add a glow to the sun
        const sunGlow = ctx.createRadialGradient(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS * 0.5, SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS * 2);
        sunGlow.addColorStop(0, 'rgba(255, 223, 0, 0.8)');
        sunGlow.addColorStop(1, 'rgba(255, 165, 0, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0,0, canvas.width, canvas.height);


        planets.forEach(planet => planet.drawOrbit(ctx)); // Draw orbits first
        planets.forEach(planet => planet.draw(ctx));
        rockets.forEach(rocket => rocket.draw(ctx));

        // --- Check game end condition ---
        const allRocketsFinished = rockets.length > 0 && rockets.every(r => r.isLanded || r.isLost);
        if (allRocketsFinished) {
            endGame();
        } else {
            requestAnimationFrame(gameLoop);
        }
    }

    function drawStars() {
        stars.forEach(star => {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawHeavyStarSkies() {
        ctx.strokeStyle = 'rgba(120, 120, 180, 0.4)'; // A slightly more visible color
        ctx.lineWidth = HEAVY_STAR_BORDER_THICKNESS;
        // Draw border slightly inset so the line itself is visible
        const offset = HEAVY_STAR_BORDER_THICKNESS / 2;
        ctx.strokeRect(offset, offset, canvas.width - HEAVY_STAR_BORDER_THICKNESS, canvas.height - HEAVY_STAR_BORDER_THICKNESS);
        
        // Optional: Add a few denser "stars" near the border for effect
        ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
        for(let i=0; i<50; i++) { // Draw some "dense" stars in the border region
            if(Math.random() < 0.5) { // Top/Bottom border
                let x = Math.random() * canvas.width;
                let y = (Math.random() < 0.5) ? Math.random() * HEAVY_STAR_BORDER_THICKNESS : canvas.height - Math.random() * HEAVY_STAR_BORDER_THICKNESS;
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 2, 0, Math.PI*2);
                ctx.fill();
            } else { // Left/Right border
                let x = (Math.random() < 0.5) ? Math.random() * HEAVY_STAR_BORDER_THICKNESS : canvas.width - Math.random() * HEAVY_STAR_BORDER_THICKNESS;
                let y = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 2, 0, Math.PI*2);
                ctx.fill();
            }
        }
        ctx.lineWidth = 1; // Reset
    }
    
    function endGame() {
        gameRunning = false;
        displayLeaderboard();
        startButton.textContent = "Play Again";
    }

    function displayLeaderboard() {
        leaderboardList.innerHTML = '';
        const sortedRockets = [...rockets].sort((a, b) => b.distanceTraveled - a.distanceTraveled);

        sortedRockets.forEach(rocket => {
            const li = document.createElement('li');
            let statusText = rocket.isLost ? "Lost (Boundary)" : `Landed on ${rocket.landedOnPlanetName}`;
            if (!rocket.isLanded && !rocket.isLost) { // Should not happen if game ended, but as a fallback
                statusText = "Still Drifting...";
            }
            
            li.innerHTML = `<b>${rocket.name}</b>: ${statusText} <br> Fuel: ${rocket.initialFuel.toFixed(0)} | Dist: ${rocket.distanceTraveled.toFixed(0)}`;
            leaderboardList.appendChild(li);
        });
        leaderboardDiv.classList.remove('hidden');
    }

    // Initial setup
    startButton.addEventListener('click', startGame);
    
    function initialDraw() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        initStars(); // Initialize stars array
        drawStars();
        
        // Draw Sun placeholder
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        initPlanets(); // Initialize planets array and their positions
        planets.forEach(p => p.drawOrbit(ctx)); // Draw initial orbits
        planets.forEach(p => p.draw(ctx)); // Draw initial planet positions
        drawHeavyStarSkies();
    }

    initialDraw(); // Perform an initial draw of the static scene
});