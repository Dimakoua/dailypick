document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('startButton');
    const gameContainer = document.querySelector('.game-container');
    const leaderboardDiv = document.getElementById('leaderboard');
    const namesInputElement = document.getElementById('namesInput');
    const updateNamesButton = document.getElementById('updateNamesBtn');
    const leaderboardList = document.getElementById('leaderboardList');

    canvas.width = 850;
    canvas.height = 650;

    const ORIGINAL_GAME_WIDTH = 824;
    const ORIGINAL_GAME_HEIGHT = 679;

    // --- PROCEDURAL AUDIO SYNTHESIZER ---
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playTone(freq, type, duration, gainVal = 0.1, slideTo = null) {
            if (!this.enabled || !this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                if (slideTo) {
                    osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
                }
                gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) { }
        }

        launch() {
            this.init();
            this.playTone(130, 'sawtooth', 0.6, 0.08, 420);
        }

        bounce() {
            this.playTone(220, 'sine', 0.12, 0.08, 120);
        }

        refuel() {
            this.playTone(520, 'sine', 0.15, 0.06, 900);
        }

        wormhole() {
            this.playTone(580, 'sine', 0.4, 0.1, 160);
        }

        land() {
            this.playTone(440, 'triangle', 0.16, 0.12);
            setTimeout(() => this.playTone(660, 'triangle', 0.22, 0.12), 110);
            setTimeout(() => this.playTone(880, 'sine', 0.4, 0.14), 220);
        }

        explode() {
            if (!this.enabled || !this.ctx) return;
            try {
                const bufferSize = this.ctx.sampleRate * 0.4;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(380, this.ctx.currentTime);
                filter.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.4);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                noise.start();
            } catch (e) { }
        }
    }
    const audio = new SoundEngine();

    // --- VECTOR2D ---
    class Vector2D {
        constructor(x = 0, y = 0) { this.x = x; this.y = y; }
        set(x, y) { this.x = x; this.y = y; return this; }
        add(vec) { this.x += vec.x; this.y += vec.y; return this; }
        sub(vec) { this.x -= vec.x; this.y -= vec.y; return this; }
        mult(s) { this.x *= s; this.y *= s; return this; }
        div(s) { if (s !== 0) { this.x /= s; this.y /= s; } else { this.x = 0; this.y = 0; } return this; }
        mag() { return Math.hypot(this.x, this.y); }
        magSq() { return this.x * this.x + this.y * this.y; }
        normalize() { const m = this.mag(); if (m > 0) this.div(m); return this; }
        clone() { return new Vector2D(this.x, this.y); }
        static add(v1, v2) { return new Vector2D(v1.x + v2.x, v1.y + v2.y); }
        static sub(v1, v2) { return new Vector2D(v1.x - v2.x, v1.y - v2.y); }
        static fromAngle(a, m = 1) { return new Vector2D(m * Math.cos(a), m * Math.sin(a)); }
    }

    // --- CONSTANTS ---
    const G = 0.52;
    const ROCKET_RADIUS = 9;
    const STAR_COUNT = 220;
    const HEAVY_STAR_BORDER_THICKNESS = 14;
    const FUEL_CONSUMPTION_RATE = 0.85;
    const MAX_TRAIL_LENGTH = 150;
    const SUN_POSITION = new Vector2D(canvas.width / 2, canvas.height / 2);
    const SUN_RADIUS = 26;
    const LAUNCH_SPREAD_ANGLE = Math.PI / 1.4;
    const SUN_MASS = 16000;
    const EARTH_NAME = "Earth";

    const NUM_ASTEROIDS = 16;
    const ASTEROID_MIN_RADIUS = 6;
    const ASTEROID_MAX_RADIUS = 16;
    const ASTEROID_BASE_MASS = 55;
    const ASTEROID_SUN_RESTITUTION = 0.35;
    const ASTEROID_FIXED_SUN_BOUNCE_SPEED = 32;
    const ROCKET_ASTEROID_RESTITUTION = 0.65;

    const NUM_BLACK_HOLES = 2;
    const BLACK_HOLE_RADIUS = 16;
    const BLACK_HOLE_MASS = 26000;
    const BLACK_HOLE_EVENT_HORIZON_RADIUS = BLACK_HOLE_RADIUS + 6;

    const NUM_STATIONS = 2;
    const STATION_RADIUS = 12;
    const STATION_REFUEL_RADIUS = 44;
    const STATION_REFUEL_RATE = 20;
    const STATION_ROTATION_SPEED = 0.6;
    const STATION_BOOST_DURATION = 3;
    const STATION_BOOST_MULTIPLIER = 1.45;
    const STATION_BOOST_COOLDOWN = 4.5;

    const GRAVITY_DRIFT_NAMES_KEY = 'namesList';
    const DEFAULT_ROCKET_NAMES = ["Kate", "Andre", "Juan", "Dmytro", "Vetura", "Zachary", "Lindsay"];
    let configurableRocketNames = [...DEFAULT_ROCKET_NAMES];
    const STANDUP_SOURCE = 'gravity-drift';
    let finishHistory = [];

    function normalizeStandupKey(name) {
        return typeof name === 'string' ? name.trim().toLowerCase() : '';
    }

    function standupParticipants() {
        const seen = new Set();
        return configurableRocketNames
            .map(n => (typeof n === 'string' ? n.trim() : ''))
            .filter(n => {
                const k = normalizeStandupKey(n);
                if (!k || seen.has(k)) return false;
                seen.add(k);
                return true;
            });
    }

    function emitStandupReset() {
        const participants = standupParticipants();
        window.dispatchEvent(new CustomEvent('standup:queue-reset', {
            detail: { source: STANDUP_SOURCE, participants }
        }));
        emitStandupUpdate();
    }

    function emitStandupUpdate(currentName) {
        const participants = standupParticipants();
        const completed = [];
        const seen = new Set();
        finishHistory.forEach(name => {
            const k = normalizeStandupKey(name);
            if (!k || seen.has(k)) return;
            seen.add(k);
            completed.push(name);
        });
        const remaining = participants.filter(n => !seen.has(normalizeStandupKey(n)));
        const detail = {
            source: STANDUP_SOURCE,
            mode: 'auto',
            participants,
            order: completed.concat(remaining),
            completed,
            remaining
        };
        if (typeof currentName === 'string') {
            const trimmed = currentName.trim();
            if (normalizeStandupKey(trimmed)) detail.current = trimmed;
        }
        window.dispatchEvent(new CustomEvent('standup:queue', { detail }));

        rockets.forEach(r => {
            r.isSpeaking = (typeof currentName === 'string' && normalizeStandupKey(r.name) === normalizeStandupKey(currentName));
        });
    }

    function registerRocketFinish(name) {
        if (typeof name !== 'string') return;
        const trimmed = name.trim();
        const key = normalizeStandupKey(trimmed);
        if (!key) return;
        if (!finishHistory.some(entry => normalizeStandupKey(entry) === key)) {
            finishHistory.push(trimmed);
        }
        emitStandupUpdate(trimmed);
    }

    // --- GAME ENGINE STATE ---
    let stars = [];
    let planets = [];
    let rockets = [];
    let asteroids = [];
    let blackHoles = [];
    let refuelingStations = [];
    let wormholes = [];
    let particles = [];
    let floatingTexts = [];
    let gameRunning = false;
    let nextFinishOrder = 1;
    let lastTime = 0;
    let earthPlanet = null;
    let screenShake = 0;

    // --- FLOATING TEXT ---
    class FloatingText {
        constructor(x, y, text, color = '#FFD700') {
            this.x = x;
            this.y = y;
            this.text = text;
            this.color = color;
            this.life = 1.0;
            this.maxLife = 1.0;
        }
        update(dt) {
            this.y -= 20 * dt;
            this.life -= dt;
        }
        draw(ctx) {
            ctx.save();
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = this.color;
            ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    // --- WORMHOLES ---
    class Wormhole {
        constructor(x, y, target, color) {
            this.position = new Vector2D(x, y);
            this.target = target;
            this.color = color;
            this.radius = 16;
            this.cooldowns = new Map();
            this.angle = 0;
        }
        update(dt) {
            this.angle += 3.5 * dt;
            for (let [rocket, time] of this.cooldowns.entries()) {
                if (time <= dt) this.cooldowns.delete(rocket);
                else this.cooldowns.set(rocket, time - dt);
            }
        }
        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.angle);
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * (0.35 + i * 0.22), 0, Math.PI * 1.3);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.rotate(Math.PI / 2);
            }
            ctx.restore();
        }
    }

    // --- REFUELING STATION ---
    class RefuelingStation {
        constructor(pos) {
            this.position = pos;
            this.radius = STATION_RADIUS;
            this.refuelRadius = STATION_REFUEL_RADIUS;
            this.angle = Math.random() * Math.PI * 2;
        }
        update(dt) {
            this.angle += STATION_ROTATION_SPEED * dt;
        }
        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);

            ctx.beginPath();
            ctx.arc(0, 0, this.refuelRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 170, 0.18)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.rotate(this.angle);
            ctx.strokeStyle = '#99ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();
        }
    }

    // --- HIGH-FIDELITY PROCEDURAL PLANETS ---
    class Planet {
        constructor(config) {
            this.name = config.name;
            this.type = config.type || 'generic';
            this.orbitalRadius = config.orbitalRadius;
            this.radius = config.radius;
            this.mass = config.mass;
            this.baseColor = config.baseColor;
            this.accentColor = config.accentColor;
            this.atmosphereColor = config.atmosphereColor || 'rgba(255,255,255,0.2)';
            this.orbitalAngularSpeed = config.orbitalAngularSpeed;
            this.isLaunchPlanet = config.isLaunchPlanet || false;
            this.hasRings = config.hasRings || false;
            this.rotationAngle = Math.random() * Math.PI * 2;
            this.currentAngle = Math.random() * Math.PI * 2;
            this.position = new Vector2D();
            this.velocity = new Vector2D();
            this.orbitalPathPoints = [];
            this.updatePosition(0, SUN_POSITION);
        }

        updatePosition(dt, sunPos) {
            this.currentAngle += this.orbitalAngularSpeed * dt;
            this.currentAngle %= (Math.PI * 2);
            this.rotationAngle += 0.25 * dt;

            const x = sunPos.x + this.orbitalRadius * Math.cos(this.currentAngle);
            const y = sunPos.y + this.orbitalRadius * Math.sin(this.currentAngle);
            const speed = Math.abs(this.orbitalAngularSpeed * this.orbitalRadius);
            const tangentAngle = this.currentAngle + (Math.sign(this.orbitalAngularSpeed) * Math.PI / 2);
            this.velocity.set(speed * Math.cos(tangentAngle), speed * Math.sin(tangentAngle));
            this.position.set(x, y);
        }

        calculateOrbitalPath(sunPos) {
            this.orbitalPathPoints = [];
            for (let i = 0; i <= 80; i++) {
                const a = (i / 80) * Math.PI * 2;
                this.orbitalPathPoints.push(new Vector2D(
                    sunPos.x + this.orbitalRadius * Math.cos(a),
                    sunPos.y + this.orbitalRadius * Math.sin(a)
                ));
            }
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);

            // Light angle toward Central Sun
            const toSun = Vector2D.sub(SUN_POSITION, this.position);
            const lightAngle = Math.atan2(toSun.y, toSun.x);

            // Back-layer ring segment for Saturn
            if (this.hasRings) {
                this.drawRings(ctx, true);
            }

            // Atmosphere Glow
            const atmosGrad = ctx.createRadialGradient(0, 0, this.radius * 0.9, 0, 0, this.radius * 1.35);
            atmosGrad.addColorStop(0, this.atmosphereColor);
            atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = atmosGrad;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.35, 0, Math.PI * 2);
            ctx.fill();

            // Planet Body Clipping for procedural features
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.clip();

            // Base Spherical Surface
            const surfaceGrad = ctx.createRadialGradient(-this.radius * 0.35 * Math.cos(lightAngle), -this.radius * 0.35 * Math.sin(lightAngle), this.radius * 0.1, 0, 0, this.radius);
            surfaceGrad.addColorStop(0, this.accentColor);
            surfaceGrad.addColorStop(0.7, this.baseColor);
            surfaceGrad.addColorStop(1, '#05070e');
            ctx.fillStyle = surfaceGrad;
            ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

            // Distinct Visual Types
            if (this.type === 'earth') {
                // Continents
                ctx.fillStyle = '#2e8b57';
                ctx.beginPath();
                ctx.arc(-this.radius * 0.2, -this.radius * 0.15, this.radius * 0.5, 0, Math.PI * 2);
                ctx.arc(this.radius * 0.35, this.radius * 0.25, this.radius * 0.45, 0, Math.PI * 2);
                ctx.fill();
                // Swirling White Clouds
                ctx.save();
                ctx.rotate(this.rotationAngle);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.7, 0.2, 2.2);
                ctx.arc(0, 0, this.radius * 0.4, 3.2, 5.2);
                ctx.stroke();
                ctx.restore();
            } else if (this.type === 'gas_giant') {
                // Multi-layered horizontal atmospheric bands
                ctx.save();
                ctx.rotate(0.2);
                for (let i = -this.radius; i < this.radius; i += 4) {
                    ctx.fillStyle = (Math.sin(i * 0.6) > 0) ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.22)';
                    ctx.fillRect(-this.radius, i, this.radius * 2, 2.5);
                }
                // Great Red Spot (Jupiter)
                if (this.name === "Jupiter") {
                    ctx.fillStyle = '#cc4422';
                    ctx.beginPath();
                    ctx.ellipse(this.radius * 0.35, this.radius * 0.25, 5.5, 3.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            } else if (this.type === 'rocky') {
                // Crater spots
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath();
                ctx.arc(-this.radius * 0.3, this.radius * 0.2, this.radius * 0.22, 0, Math.PI * 2);
                ctx.arc(this.radius * 0.35, -this.radius * 0.15, this.radius * 0.18, 0, Math.PI * 2);
                ctx.fill();
                // Polar Cap (Mars)
                if (this.name === "Mars") {
                    ctx.fillStyle = 'rgba(240, 248, 255, 0.8)';
                    ctx.beginPath();
                    ctx.ellipse(0, -this.radius * 0.85, this.radius * 0.45, this.radius * 0.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Day/Night Shadow Terminator
            const shadow = ctx.createRadialGradient(
                this.radius * 0.5 * Math.cos(lightAngle),
                this.radius * 0.5 * Math.sin(lightAngle),
                this.radius * 0.2,
                0,
                0,
                this.radius
            );
            shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
            shadow.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
            shadow.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
            ctx.fillStyle = shadow;
            ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

            ctx.restore(); // End clipping

            // Front-layer rings for Saturn
            if (this.hasRings) {
                this.drawRings(ctx, false);
            }

            ctx.restore();

            // Planet Label
            ctx.fillStyle = "rgba(225, 235, 255, 0.9)";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(this.name, this.position.x, this.position.y - this.radius - 8);
        }

        drawRings(ctx, isBack) {
            ctx.save();
            ctx.rotate(0.35);
            ctx.scale(2.2, 0.55);
            ctx.beginPath();
            const startAngle = isBack ? Math.PI : 0;
            const endAngle = isBack ? Math.PI * 2 : Math.PI;

            // Outer ring
            ctx.arc(0, 0, this.radius * 1.7, startAngle, endAngle);
            ctx.strokeStyle = 'rgba(215, 195, 140, 0.45)';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Inner bright ring
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.35, startAngle, endAngle);
            ctx.strokeStyle = 'rgba(235, 220, 170, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.restore();
        }

        drawOrbit(ctx) {
            if (this.orbitalPathPoints.length < 2) return;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.orbitalPathPoints[0].x, this.orbitalPathPoints[0].y);
            for (let i = 1; i < this.orbitalPathPoints.length; i++) {
                ctx.lineTo(this.orbitalPathPoints[i].x, this.orbitalPathPoints[i].y);
            }
            ctx.stroke();
        }
    }

    // --- BLACK HOLE ---
    class BlackHole {
        constructor(pos, radius, mass) {
            this.position = pos;
            this.radius = radius;
            this.mass = mass;
            this.vortexAngle = 0;
        }
        update(dt) {
            this.vortexAngle += 2.2 * dt;
        }
        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.vortexAngle);

            const glow = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, this.radius + 18);
            glow.addColorStop(0, 'rgba(0, 0, 0, 1)');
            glow.addColorStop(0.35, 'rgba(180, 50, 255, 0.65)');
            glow.addColorStop(0.7, 'rgba(0, 180, 255, 0.3)');
            glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 18, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#020205';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#e088ff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    }

    // --- PARTICLE ---
    class Particle {
        constructor(x, y, vx, vy, life, color, size = 2.5) {
            this.position = new Vector2D(x, y);
            this.velocity = new Vector2D(vx, vy);
            this.life = life;
            this.initialLife = life;
            this.color = color;
            this.size = size;
        }
        update(dt) {
            this.position.add(this.velocity.clone().mult(dt));
            this.life -= dt;
        }
        draw(ctx) {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
            ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
            ctx.restore();
        }
    }

    // --- ASTEROID ---
    class Asteroid {
        constructor(pos, radius, vel, mass) {
            this.position = pos;
            this.radius = radius;
            this.velocity = vel;
            this.mass = mass;
            this.acceleration = new Vector2D();
            const shade = Math.floor(Math.random() * 45) + 85;
            this.color = `rgb(${shade},${shade + 5},${shade + 10})`;
            this.spin = (Math.random() - 0.5) * 2;
            this.angle = Math.random() * Math.PI * 2;
        }

        applyForce(f) {
            this.acceleration.add(f.clone().div(this.mass));
        }

        update(dt, sunPos, sunMass, planetsList, cW, cH) {
            this.angle += this.spin * dt;

            const toSun = Vector2D.sub(sunPos, this.position);
            const distSqSun = toSun.magSq();
            if (distSqSun > 0) {
                const forceMag = (G * sunMass * this.mass) / distSqSun;
                this.applyForce(toSun.normalize().mult(forceMag));
            }

            const distVecSun = Vector2D.sub(this.position, sunPos);
            const distSun = distVecSun.mag();
            if (distSun < this.radius + SUN_RADIUS) {
                const normal = distVecSun.normalize();
                this.position.add(normal.clone().mult(this.radius + SUN_RADIUS - distSun));
                this.velocity = normal.clone().mult(ASTEROID_FIXED_SUN_BOUNCE_SPEED);
            }

            planetsList.forEach(p => {
                const toP = Vector2D.sub(p.position, this.position);
                const dSq = toP.magSq();
                if (dSq > 0) {
                    this.applyForce(toP.normalize().mult((G * p.mass * this.mass) / dSq));
                }
            });

            this.velocity.add(this.acceleration.clone().mult(dt));
            this.position.add(this.velocity.clone().mult(dt));
            this.acceleration.set(0, 0);

            if (this.position.x < -this.radius) this.position.x = cW + this.radius;
            if (this.position.x > cW + this.radius) this.position.x = -this.radius;
            if (this.position.y < -this.radius) this.position.y = cH + this.radius;
            if (this.position.y > cH + this.radius) this.position.y = -this.radius;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(this.radius * 0.3, -this.radius * 0.2, this.radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- ROCKET (REPRESENTS THE USER) ---
    class Rocket {
        constructor(id, name, startPos, startVel, initialFuel) {
            this.id = id;
            this.name = name;
            this.position = startPos.clone();
            this.velocity = startVel.clone();
            this.acceleration = new Vector2D();
            this.initialFuel = initialFuel;
            this.fuel = this.initialFuel;
            this.radius = ROCKET_RADIUS;
            this.hullColor = `hsl(${(id * 52 + 18) % 360}, 90%, 65%)`;
            this.accentColor = `hsl(${(id * 52 + 198) % 360}, 100%, 75%)`;
            this.trail = [];
            this.isLost = false;
            this.isLanded = false;
            this.landedOnPlanetName = null;
            this.distanceTraveled = 0;
            this.finishOrder = null;
            this.finishReason = "";
            this.landedPlanet = null;
            this.relativeLandingPosition = null;
            this.isSpeaking = false;
            this.boostTimer = 0;
            this.lastBoostTime = 0;
        }

        applyForce(f) {
            this.acceleration.add(f);
        }

        update(dt, planetList, cW, cH) {
            if (this.isLanded && this.landedPlanet) {
                this.position = Vector2D.add(this.landedPlanet.position, this.relativeLandingPosition);
                this.velocity.set(this.landedPlanet.velocity.x, this.landedPlanet.velocity.y);
                this.trail.push(this.position.clone());
                if (this.trail.length > MAX_TRAIL_LENGTH) this.trail.shift();
                return;
            }

            if (this.isLost) return;

            if (this.fuel > 0) {
                this.fuel -= FUEL_CONSUMPTION_RATE * dt;
                if (this.fuel < 0) this.fuel = 0;
            }

            if (this.boostTimer > 0) this.boostTimer -= dt;

            // Gravity from Sun
            const toSun = Vector2D.sub(SUN_POSITION, this.position);
            let distSqSun = toSun.magSq();
            if (distSqSun < SUN_RADIUS * SUN_RADIUS) distSqSun = SUN_RADIUS * SUN_RADIUS;
            this.applyForce(toSun.normalize().mult((G * SUN_MASS) / distSqSun));

            // Gravity from Planets
            planetList.forEach(planet => {
                const toP = Vector2D.sub(planet.position, this.position);
                let dSq = toP.magSq();
                if (dSq < planet.radius * planet.radius) dSq = planet.radius * planet.radius;
                this.applyForce(toP.normalize().mult((G * planet.mass) / dSq));
            });

            // Gravity from Asteroids
            asteroids.forEach(ast => {
                const toAst = Vector2D.sub(ast.position, this.position);
                const dSq = Math.max(ast.radius * ast.radius, toAst.magSq());
                this.applyForce(toAst.normalize().mult((G * ast.mass) / dSq));
            });

            // Gravity from Black Holes
            blackHoles.forEach(bh => {
                const toBh = Vector2D.sub(bh.position, this.position);
                const dSq = Math.max(bh.radius * bh.radius, toBh.magSq());
                this.applyForce(toBh.normalize().mult((G * bh.mass) / dSq));
            });

            // Refueling stations
            const now = performance.now();
            refuelingStations.forEach(st => {
                const d = Vector2D.sub(this.position, st.position).mag();
                if (d < st.refuelRadius && this.fuel < this.initialFuel) {
                    this.fuel = Math.min(this.initialFuel, this.fuel + STATION_REFUEL_RATE * dt);
                    if (Math.random() < 0.25) createRefuelEffect(this.position.x, this.position.y, st.position);

                    if (now - this.lastBoostTime > STATION_BOOST_COOLDOWN * 1000) {
                        this.boostTimer = STATION_BOOST_DURATION;
                        this.velocity.mult(STATION_BOOST_MULTIPLIER);
                        this.lastBoostTime = now;
                        audio.refuel();
                    }
                }
            });

            // Wormhole teleports
            wormholes.forEach(wh => {
                if (!wh.cooldowns.has(this)) {
                    const dist = Vector2D.sub(this.position, wh.position).mag();
                    if (dist < wh.radius + this.radius) {
                        audio.wormhole();
                        this.position.set(wh.target.position.x, wh.target.position.y);
                        this.velocity.mult(1.25);
                        wh.target.cooldowns.set(this, 3.5);
                        wh.cooldowns.set(this, 3.5);
                        createExplosion(wh.position.x, wh.position.y, wh.color, 25);
                        createExplosion(wh.target.position.x, wh.target.position.y, wh.target.color, 25);
                    }
                }
            });

            this.velocity.add(this.acceleration.clone().mult(dt));
            const disp = this.velocity.clone().mult(dt);
            this.position.add(disp);
            this.distanceTraveled += disp.mag();
            this.acceleration.set(0, 0);

            this.trail.push(this.position.clone());
            if (this.trail.length > MAX_TRAIL_LENGTH) this.trail.shift();

            // 1. Planet Landings
            for (const planet of planetList) {
                if (planet.isLaunchPlanet && planet.name === EARTH_NAME) continue;
                const distToCenter = Vector2D.sub(planet.position, this.position).mag();
                if (distToCenter < planet.radius + this.radius) {
                    this.isLanded = true;
                    this.landedOnPlanetName = planet.name;
                    this.landedPlanet = planet;
                    const dir = Vector2D.sub(this.position, planet.position).normalize();
                    this.relativeLandingPosition = dir.mult(planet.radius + this.radius * 0.8);
                    this.position = Vector2D.add(this.landedPlanet.position, this.relativeLandingPosition);
                    this.velocity.set(this.landedPlanet.velocity.x, this.landedPlanet.velocity.y);

                    if (this.finishOrder === null) {
                        this.finishOrder = nextFinishOrder++;
                        registerRocketFinish(this.name);
                        audio.land();
                        createExplosion(this.position.x, this.position.y, '#FFD700', 35);
                        floatingTexts.push(new FloatingText(this.position.x, this.position.y - 18, `#${this.finishOrder} ${this.name}`, '#FFD700'));
                    }
                    this.finishReason = `Landed on ${this.landedOnPlanetName}`;
                    return;
                }
            }

            // 2. Asteroid Bounce
            for (const ast of asteroids) {
                const distVec = Vector2D.sub(this.position, ast.position);
                const dist = distVec.mag();
                const combined = this.radius + ast.radius;
                if (dist < combined) {
                    createImpactEffect(this.position.x, this.position.y);
                    audio.bounce();
                    const normal = distVec.normalize();
                    this.position.add(normal.clone().mult(combined - dist));
                    const relVel = Vector2D.sub(this.velocity, ast.velocity);
                    const dot = relVel.x * normal.x + relVel.y * normal.y;
                    if (dot < 0) {
                        const impulse = -(1 + ROCKET_ASTEROID_RESTITUTION) * dot;
                        this.velocity.add(normal.clone().mult(impulse));
                    }
                }
            }

            // 3. Solar Incineration
            if (Vector2D.sub(this.position, SUN_POSITION).mag() < SUN_RADIUS + this.radius) {
                this.isLost = true;
                if (this.finishOrder === null) {
                    this.finishOrder = nextFinishOrder++;
                    audio.explode();
                    screenShake = 16;
                    createExplosion(this.position.x, this.position.y, '#FF5500', 70);
                    registerRocketFinish(this.name);
                }
                this.finishReason = "Burned by Sun";
                return;
            }

            // 4. Black Hole Devour
            for (const bh of blackHoles) {
                if (Vector2D.sub(this.position, bh.position).mag() < BLACK_HOLE_EVENT_HORIZON_RADIUS) {
                    this.isLost = true;
                    if (this.finishOrder === null) {
                        this.finishOrder = nextFinishOrder++;
                        audio.explode();
                        screenShake = 20;
                        createExplosion(this.position.x, this.position.y, '#BB33FF', 85);
                        registerRocketFinish(this.name);
                    }
                    this.finishReason = "Consumed by Black Hole";
                    return;
                }
            }

            // 5. Deep Space Loss
            if (this.position.x < 0 || this.position.x > cW || this.position.y < 0 || this.position.y > cH) {
                this.isLost = true;
                if (this.finishOrder === null) {
                    this.finishOrder = nextFinishOrder++;
                    audio.explode();
                    createExplosion(this.position.x, this.position.y, this.hullColor, 40);
                    registerRocketFinish(this.name);
                }
                this.finishReason = "Lost in Deep Space";
                return;
            }

            // 6. Fuel Depletion Drift
            if (this.fuel <= 0 && this.finishOrder === null) {
                this.finishOrder = nextFinishOrder++;
                registerRocketFinish(this.name);
                this.finishReason = "Drifting (Out of Fuel)";
            }
        }

        draw(ctx) {
            if (this.isLost) return;

            // Player Ion Trail
            if (this.trail.length > 1) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = this.hullColor;
                ctx.lineWidth = this.boostTimer > 0 ? 3.5 : 2;
                ctx.globalAlpha = 0.6;
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            const heading = this.velocity.magSq() > 0.001 ? Math.atan2(this.velocity.y, this.velocity.x) : 0;
            ctx.rotate(heading);

            // Dual Thrusters
            if (!this.isLanded && (this.fuel > 0 || this.boostTimer > 0)) {
                const flameLen = this.radius * (this.boostTimer > 0 ? 2.5 : 1.6) + Math.random() * 3;
                ctx.fillStyle = this.boostTimer > 0 ? '#00FFFF' : '#FFAA00';
                [-3.5, 3.5].forEach(offsetY => {
                    ctx.beginPath();
                    ctx.moveTo(-this.radius * 0.8, offsetY - 2);
                    ctx.lineTo(-this.radius * 0.8 - flameLen, offsetY);
                    ctx.lineTo(-this.radius * 0.8, offsetY + 2);
                    ctx.closePath();
                    ctx.fill();
                });
            }

            // User Rocket Ship Chassis
            ctx.fillStyle = this.hullColor;
            ctx.beginPath();
            ctx.moveTo(this.radius + 4, 0); // Nose cone
            ctx.lineTo(-this.radius * 0.6, -this.radius * 0.8); // Left wing
            ctx.lineTo(-this.radius * 0.3, -this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.8, -this.radius * 0.3); // Left thruster
            ctx.lineTo(-this.radius * 0.8, this.radius * 0.3);  // Right thruster
            ctx.lineTo(-this.radius * 0.3, this.radius * 0.3);
            ctx.lineTo(-this.radius * 0.6, this.radius * 0.8);  // Right wing
            ctx.closePath();
            ctx.fill();

            // Cockpit Canopy
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.ellipse(this.radius * 0.2, 0, 4, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Hull Accents
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.restore();

            // User Name Label (Clean, no emojis)
            ctx.save();
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#000000';
            ctx.fillText(this.name, this.position.x, this.position.y - this.radius - 9);

            // Radial Fuel Indicator
            if (!this.isLanded && this.fuel > 0) {
                const fuelPct = Math.max(0, this.fuel / this.initialFuel);
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * fuelPct));
                ctx.strokeStyle = fuelPct > 0.25 ? 'rgba(0, 255, 200, 0.7)' : 'rgba(255, 70, 70, 0.85)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Active Standup Speaker Aura
            if (this.isSpeaking) {
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y - this.radius - 13, ctx.measureText(this.name).width / 2 + 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#00FFFF';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00FFFF';
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // --- SCENE INITIALIZATION ---
    function initStars() {
        stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 1.3 + 0.3,
                alpha: Math.random() * 0.7 + 0.3
            });
        }
    }

    function initAsteroids() {
        asteroids = [];
        for (let i = 0; i < NUM_ASTEROIDS; i++) {
            let x, y, dSun, dEarth, attempts = 0;
            do {
                x = Math.random() * canvas.width;
                y = Math.random() * canvas.height;
                dSun = Vector2D.sub(new Vector2D(x, y), SUN_POSITION).mag();
                dEarth = earthPlanet ? Vector2D.sub(new Vector2D(x, y), earthPlanet.position).mag() : Infinity;
                attempts++;
            } while ((dSun < SUN_RADIUS + 65 || dEarth < 55) && attempts < 80);

            const r = Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS) + ASTEROID_MIN_RADIUS;
            const m = ASTEROID_BASE_MASS * (r / ASTEROID_MIN_RADIUS);
            const vel = Vector2D.fromAngle(Math.random() * Math.PI * 2, Math.random() * 22);
            asteroids.push(new Asteroid(new Vector2D(x, y), r, vel, m));
        }
    }

    function initPlanets() {
        planets = [];

        earthPlanet = new Planet({
            name: EARTH_NAME,
            type: 'earth',
            orbitalRadius: 150,
            radius: 14,
            mass: 1100,
            baseColor: '#1d5a8a',
            accentColor: '#3a95d0',
            atmosphereColor: 'rgba(90, 180, 255, 0.4)',
            orbitalAngularSpeed: 0.0055,
            isLaunchPlanet: true
        });
        planets.push(earthPlanet);

        planets.push(new Planet({
            name: "Mercury",
            type: 'rocky',
            orbitalRadius: 65,
            radius: 7,
            mass: 750,
            baseColor: '#5c5855',
            accentColor: '#a8a29e',
            atmosphereColor: 'rgba(180, 170, 160, 0.2)',
            orbitalAngularSpeed: 0.024
        }));

        planets.push(new Planet({
            name: "Venus",
            type: 'generic',
            orbitalRadius: 105,
            radius: 12,
            mass: 1300,
            baseColor: '#b46e28',
            accentColor: '#f5b553',
            atmosphereColor: 'rgba(255, 190, 90, 0.45)',
            orbitalAngularSpeed: 0.017
        }));

        planets.push(new Planet({
            name: "Ceres",
            type: 'rocky',
            orbitalRadius: 195,
            radius: 8,
            mass: 880,
            baseColor: '#6e6053',
            accentColor: '#b8a695',
            atmosphereColor: 'rgba(160, 150, 140, 0.2)',
            orbitalAngularSpeed: 0.011
        }));

        planets.push(new Planet({
            name: "Mars",
            type: 'rocky',
            orbitalRadius: 235,
            radius: 11,
            mass: 1050,
            baseColor: '#8a2b13',
            accentColor: '#d6522a',
            atmosphereColor: 'rgba(255, 110, 70, 0.3)',
            orbitalAngularSpeed: 0.0095
        }));

        planets.push(new Planet({
            name: "Jupiter",
            type: 'gas_giant',
            orbitalRadius: 325,
            radius: 25,
            mass: 3400,
            baseColor: '#9c6f44',
            accentColor: '#f1d6b8',
            atmosphereColor: 'rgba(240, 200, 160, 0.35)',
            orbitalAngularSpeed: 0.0062
        }));

        planets.push(new Planet({
            name: "Saturn",
            type: 'gas_giant',
            orbitalRadius: 395,
            radius: 20,
            mass: 2900,
            baseColor: '#a18b5c',
            accentColor: '#f3e5b8',
            atmosphereColor: 'rgba(240, 225, 170, 0.35)',
            orbitalAngularSpeed: 0.0048,
            hasRings: true
        }));

        planets.push(new Planet({
            name: "Neptune",
            type: 'generic',
            orbitalRadius: 450,
            radius: 17,
            mass: 2500,
            baseColor: '#1e3c87',
            accentColor: '#538bf5',
            atmosphereColor: 'rgba(80, 150, 255, 0.45)',
            orbitalAngularSpeed: 0.0036
        }));

        planets.forEach(p => {
            p.updatePosition(0, SUN_POSITION);
            p.calculateOrbitalPath(SUN_POSITION);
        });

        initAsteroids();
        initBlackHoles();
        initRefuelingStations();
        initWormholes();
    }

    function initWormholes() {
        const wh1 = new Wormhole(120, 120, null, '#00FFFF');
        const wh2 = new Wormhole(canvas.width - 120, canvas.height - 120, wh1, '#FF33AA');
        wh1.target = wh2;
        wormholes = [wh1, wh2];
    }

    function initBlackHoles() {
        blackHoles = [
            new BlackHole(new Vector2D(140, canvas.height - 150), BLACK_HOLE_RADIUS, BLACK_HOLE_MASS),
            new BlackHole(new Vector2D(canvas.width - 150, 150), BLACK_HOLE_RADIUS, BLACK_HOLE_MASS)
        ];
    }

    function initRefuelingStations() {
        refuelingStations = [
            new RefuelingStation(new Vector2D(canvas.width * 0.28, canvas.height * 0.72)),
            new RefuelingStation(new Vector2D(canvas.width * 0.74, canvas.height * 0.32))
        ];
    }

    function launchRockets() {
        rockets = [];
        if (!earthPlanet) return;
        audio.launch();

        configurableRocketNames.forEach((name, i) => {
            const targetable = planets.filter(p => p !== earthPlanet);
            const target = targetable[Math.floor(Math.random() * targetable.length)];
            const toTarget = Vector2D.sub(target.position, earthPlanet.position);
            const baseAngle = Math.atan2(toTarget.y, toTarget.x);
            const offset = (Math.random() - 0.5) * LAUNCH_SPREAD_ANGLE;
            const dir = Vector2D.fromAngle(baseAngle + offset);

            const startPos = Vector2D.add(earthPlanet.position, dir.clone().mult(earthPlanet.radius + ROCKET_RADIUS + 4));
            const launchSpeed = (Math.random() * 0.8 + 2.2) * 10;
            const initialVel = Vector2D.add(earthPlanet.velocity, dir.clone().mult(launchSpeed));
            const fuel = Math.random() * 10 + 24;

            rockets.push(new Rocket(i, name, startPos, initialVel, fuel));
        });
    }

    function createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 70 + 25;
            particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() * 1.2 + 0.4, color, Math.random() * 3 + 1));
        }
    }

    function createRefuelEffect(rx, ry, stationPos) {
        const dir = Vector2D.sub(new Vector2D(rx, ry), stationPos);
        const speed = 90;
        const vel = dir.normalize().mult(speed);
        particles.push(new Particle(stationPos.x, stationPos.y, vel.x, vel.y, 0.45, '#00FFAA', 2));
    }

    function createImpactEffect(x, y) {
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 35 + 15;
            particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35, '#FFFFFF', 1.8));
        }
    }

    // --- GAME LOOP ---
    function startGame() {
        if (gameRunning && rockets.length > 0 && !rockets.every(r => r.isLanded || r.isLost)) return;
        audio.init();
        gameRunning = true;
        leaderboardDiv.classList.add('hidden');
        leaderboardList.innerHTML = '';
        nextFinishOrder = 1;
        finishHistory = [];
        particles = [];
        floatingTexts = [];
        screenShake = 0;
        emitStandupReset();

        initStars();
        initPlanets();
        launchRockets();

        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
        startButton.textContent = "Restart Game";
    }

    function gameLoop(timestamp) {
        if (!gameRunning) return;

        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.1) dt = 0.1;

        planets.forEach(p => p.updatePosition(dt, SUN_POSITION));
        asteroids.forEach(a => a.update(dt, SUN_POSITION, SUN_MASS, planets, canvas.width, canvas.height));
        refuelingStations.forEach(s => s.update(dt));
        wormholes.forEach(w => w.update(dt));
        blackHoles.forEach(b => b.update(dt));

        particles.forEach((p, idx) => {
            p.update(dt);
            if (p.life <= 0) particles.splice(idx, 1);
        });

        floatingTexts.forEach((ft, idx) => {
            ft.update(dt);
            if (ft.life <= 0) floatingTexts.splice(idx, 1);
        });

        rockets.forEach(r => r.update(dt, planets, canvas.width, canvas.height));

        let shakeX = 0, shakeY = 0;
        if (screenShake > 0) {
            shakeX = (Math.random() - 0.5) * screenShake;
            shakeY = (Math.random() - 0.5) * screenShake;
            screenShake = Math.max(0, screenShake - dt * 30);
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Deep Space Background
        ctx.fillStyle = '#060714';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Stars
        stars.forEach(s => {
            ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Orbit paths
        planets.forEach(p => p.drawOrbit(ctx));

        // Central Sun
        const sunGlow = ctx.createRadialGradient(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS * 0.4, SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS * 3.5);
        sunGlow.addColorStop(0, '#FFFBE6');
        sunGlow.addColorStop(0.2, '#FFD000');
        sunGlow.addColorStop(0.55, 'rgba(255, 110, 0, 0.4)');
        sunGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS * 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFF2A8';
        ctx.beginPath();
        ctx.arc(SUN_POSITION.x, SUN_POSITION.y, SUN_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Celestial Bodies
        blackHoles.forEach(bh => bh.draw(ctx));
        wormholes.forEach(wh => wh.draw(ctx));
        refuelingStations.forEach(s => s.draw(ctx));
        planets.forEach(p => p.draw(ctx));
        asteroids.forEach(a => a.draw(ctx));

        particles.forEach(p => p.draw(ctx));
        rockets.forEach(r => r.draw(ctx));
        floatingTexts.forEach(ft => ft.draw(ctx));

        // Inset border
        ctx.strokeStyle = 'rgba(100, 130, 220, 0.25)';
        ctx.lineWidth = HEAVY_STAR_BORDER_THICKNESS;
        ctx.strokeRect(HEAVY_STAR_BORDER_THICKNESS / 2, HEAVY_STAR_BORDER_THICKNESS / 2, canvas.width - HEAVY_STAR_BORDER_THICKNESS, canvas.height - HEAVY_STAR_BORDER_THICKNESS);

        ctx.restore();

        const allFinished = rockets.length > 0 && rockets.every(r => r.finishOrder !== null);
        if (allFinished) {
            endGame();
        } else {
            requestAnimationFrame(gameLoop);
        }
    }

    function endGame() {
        gameRunning = false;
        displayLeaderboard();
        startButton.textContent = "Play Again";
    }

    function displayLeaderboard() {
        leaderboardList.innerHTML = '';
        const sorted = [...rockets].sort((a, b) => {
            if (a.finishOrder !== null && b.finishOrder !== null) return a.finishOrder - b.finishOrder;
            if (a.finishOrder !== null) return -1;
            if (b.finishOrder !== null) return 1;
            return b.distanceTraveled - a.distanceTraveled;
        });

        sorted.forEach(rocket => {
            const li = document.createElement('li');
            let statusText = '';

            if (rocket.isLanded) {
                statusText = `Landed on ${rocket.landedOnPlanetName}`;
            } else if (rocket.finishReason === "Burned by Sun") {
                statusText = "Burned by Solar Flare";
            } else if (rocket.finishReason === "Consumed by Black Hole") {
                statusText = "Lost to Black Hole";
            } else if (rocket.finishReason === "Lost in Deep Space") {
                statusText = "Lost in Deep Space";
            } else if (rocket.fuel <= 0) {
                statusText = "Drifting (Out of Fuel)";
            } else {
                statusText = "Active";
            }

            const orderDisplay = rocket.finishOrder !== null ? `<b>#${rocket.finishOrder}</b> ` : '';
            li.innerHTML = `${orderDisplay}<b>${rocket.name}</b> — ${statusText}`;
            leaderboardList.appendChild(li);
        });

        leaderboardDiv.classList.remove('hidden');
        finishHistory = [...rockets]
            .filter(r => r.finishOrder !== null)
            .sort((a, b) => (a.finishOrder ?? 0) - (b.finishOrder ?? 0))
            .map(r => (typeof r.name === 'string' ? r.name.trim() : ''))
            .filter(n => normalizeStandupKey(n));
        emitStandupUpdate();
    }

    function loadConfigurableRocketNames() {
        const stored = localStorage.getItem(GRAVITY_DRIFT_NAMES_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) configurableRocketNames = [...parsed];
            } catch (e) {
                configurableRocketNames = [...DEFAULT_ROCKET_NAMES];
            }
        }
        if (namesInputElement) namesInputElement.value = configurableRocketNames.join('\n');
        finishHistory = [];
        emitStandupReset();
    }

    function updateNamesFromInput() {
        if (!namesInputElement) return;
        const inputText = namesInputElement.value.trim();
        const newNames = inputText ? inputText.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0) : [];
        configurableRocketNames = newNames.length > 0 ? [...newNames] : [...DEFAULT_ROCKET_NAMES];
        if (namesInputElement) namesInputElement.value = configurableRocketNames.join('\n');
        localStorage.setItem(GRAVITY_DRIFT_NAMES_KEY, JSON.stringify(configurableRocketNames));
        finishHistory = [];
        emitStandupReset();
        startGame();
    }

    function fitGameToScreen() {
        if (!gameContainer) return;
        const isEmbedded = window.self !== window.top || new URLSearchParams(window.location.search).get('embed');
        const scaleX = (window.innerWidth * 0.98) / ORIGINAL_GAME_WIDTH;
        const scaleY = (window.innerHeight * (isEmbedded ? 0.95 : 0.90)) / ORIGINAL_GAME_HEIGHT;
        let scale = Math.min(scaleX, scaleY);
        if (ORIGINAL_GAME_WIDTH <= window.innerWidth * 0.98 && ORIGINAL_GAME_HEIGHT <= window.innerHeight * 0.90) {
            scale = Math.min(scale, 1);
        }
        gameContainer.style.transformOrigin = 'center top';
        gameContainer.style.transform = `scale(${scale})`;
    }

    startButton.addEventListener('click', startGame);
    if (updateNamesButton) updateNamesButton.addEventListener('click', updateNamesFromInput);
    window.addEventListener('resize', fitGameToScreen);

    loadConfigurableRocketNames();
    fitGameToScreen();

    // Initial render
    initStars();
    initPlanets();
    ctx.fillStyle = '#060714';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    planets.forEach(p => { p.drawOrbit(ctx); p.draw(ctx); });
    asteroids.forEach(a => a.draw(ctx));
    blackHoles.forEach(bh => bh.draw(ctx));
    wormholes.forEach(wh => wh.draw(ctx));
    refuelingStations.forEach(st => st.draw(ctx));
});