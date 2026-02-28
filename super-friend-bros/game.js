// ============================================================
// SUPER FRIEND BROS - THE SHADOW TYCOON
// Production-Ready Build
// ============================================================

// --- DOM References ---
const startScreen = document.getElementById('start-screen');
const gameScreen  = document.getElementById('game-screen');
const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const startBtn    = document.getElementById('start-btn');
const restartBtn  = document.getElementById('restart-btn');
const characterCards = document.querySelectorAll('.character-card');

// Mobile Buttons
const btnLeft   = document.getElementById('btn-left');
const btnRight  = document.getElementById('btn-right');
const btnJump   = document.getElementById('btn-jump');
const btnShoot  = document.getElementById('btn-shoot');

// Overlays
const winOverlay      = document.getElementById('win-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const playAgainBtn    = document.getElementById('play-again-btn');
const tryAgainBtn     = document.getElementById('try-again-btn');
const nextLevelBtn    = document.getElementById('next-level-btn');
const winTitle        = winOverlay ? winOverlay.querySelector('h2') : null;

// HUD
const scoreDisplay = document.getElementById('score-display');
const timeDisplay  = document.getElementById('time-display');
const coresDisplay = document.getElementById('cores-display');
const ammoDisplay  = document.getElementById('ammo-display');
const timerHud     = document.getElementById('timer-hud');
const coresHud     = document.getElementById('cores-hud');

// --- Constants ---
const GRAVITY       = 0.5;
const FRICTION      = 0.85;
const MAX_SPEED     = 6;
const JUMP_FORCE    = -11;
const FIXED_STEP    = 1000 / 60;
const MAX_LEVELS    = 3;
const FIRE_RATE_MS  = 500;

// --- Game State ---
let selectedCharImage = null;
let selectedCharId    = null;
let animationId;
let isGameOver  = false;
let isGameWon   = false;
let cameraX     = 0;
let lastTime    = 0;
let accumulator = 0;
let currentLevel = 1;
let score = 0;

// Level 2 survival timer
let timeRemaining = 30;
let lastSecondAt  = 0; // DOMHighResTimeStamp from rAF

// Level 3 weapon
let coresCollected   = 0;
let isWeaponUnlocked = false;
let currentAmmo      = 0;
const MAX_AMMO       = 10;
let lastFireTime     = 0;

// Input state
const keys = { right: false, left: false, up: false, shoot: false };

// Entity lists (reset each level)
let player, boss, flagPole;
let platforms = [];
let enemies   = [];
let bullets   = [];
let items     = [];
let particles = [];

// ============================================================
// AUDIO ENGINE
// ============================================================
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtxClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;

        switch(type) {
            case 'jump':
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t); osc.stop(t + 0.1);
                break;
            case 'shoot':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'hurt':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'boss_hurt':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(280, t);
                osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
                gain.gain.setValueAtTime(0.35, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'deflect':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, t);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.1);
                osc.start(t); osc.stop(t + 0.1);
                break;
            case 'collect':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, t);
                osc.frequency.setValueAtTime(1200, t + 0.08);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'teleport':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(2000, t + 0.15);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'win':
                osc.type = 'square';
                [400,500,600,800].forEach((f, i) => osc.frequency.setValueAtTime(f, t + i*0.1));
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.9);
                osc.start(t); osc.stop(t + 0.9);
                break;
        }
    } catch(e) { /* audio errors are non-fatal */ }
}

// ============================================================
// PARTICLE ENGINE
// ============================================================
class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y; this.color = color; this.type = type;
        this.life = 1.0;
        if (type === 'dust' || type === 'smoke') {
            this.vx = (Math.random() - 0.5) * 2.5;
            this.vy = -Math.random() * 2;
            this.size = Math.random() * 4 + 2;
            this.decay = type === 'smoke' ? 0.018 : 0.055;
        } else if (type === 'sparkle') {
            this.vx = (Math.random() - 0.5) * 5;
            this.vy = (Math.random() - 0.5) * 5;
            this.size = Math.random() * 3 + 1;
            this.decay = 0.03;
        } else { // explosion
            this.vx = (Math.random() - 0.5) * 9;
            this.vy = (Math.random() - 0.5) * 9;
            this.size = Math.random() * 7 + 3;
            this.decay = 0.035;
        }
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.type === 'dust' || this.type === 'smoke') this.size += 0.15;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        if (this.type === 'sparkle') {
            ctx.beginPath();
            ctx.arc(this.x - cameraX, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x - cameraX, this.y, this.size, this.size);
        }
        ctx.restore();
    }
}

function spawnParticles(x, y, count, color, type) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color, type));
}

// ============================================================
// INPUT HANDLERS
// ============================================================
function handleJump() {
    if (!player) return;
    if (!keys.up && player.state !== 'fall' && player.state !== 'jump') {
        player.dy = JUMP_FORCE;
        player.state = 'jump';
        playSound('jump');
        spawnParticles(player.x + player.width / 2, player.y + player.height, 5, '#aaaaff', 'dust');
    }
    keys.up = true;
}

function handleJumpRelease() {
    keys.up = false;
    if (player && player.dy < JUMP_FORCE / 2) player.dy = JUMP_FORCE / 2;
}

function handleShoot() {
    if (!isWeaponUnlocked || currentAmmo <= 0 || isGameOver || isGameWon || !player) return;
    if (Date.now() - lastFireTime < FIRE_RATE_MS) return;
    lastFireTime = Date.now();
    currentAmmo--;
    updateHUD();
    playSound('shoot');
    const bx = player.facingRight ? player.x + player.width + 2 : player.x - 17;
    bullets.push(new Bullet(bx, player.y + player.height / 2 - 3, player.facingRight));
}

// Keyboard
window.addEventListener('keydown', (e) => {
    if (isGameOver || isGameWon) return;
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; }
    if (e.key === 'ArrowLeft'  || e.key === 'a') { keys.left  = true; }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { e.preventDefault(); handleJump(); }
    if (e.key === 'Enter' || e.key === 'e' || e.key === 'Shift') { e.preventDefault(); handleShoot(); }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') handleJumpRelease();
});

// ============================================================
// ENTITIES
// ============================================================
class Entity {
    constructor(x, y, w, h) {
        this.x = x; this.y = y;
        this.width = w; this.height = h;
        this.dx = 0; this.dy = 0;
        this.state = 'idle';
        this.facingRight = true;
        this.dead = false;
        this.invulnerable = 0;
    }
}

// ------ PLAYER ------
class Player extends Entity {
    constructor() {
        super(80, 300, 36, 36);
        this.speed    = 0.8;
        this.maxSpeed = MAX_SPEED;
        this.rotation = 0;
    }

    update() {
        if (this.invulnerable > 0) this.invulnerable--;

        if (keys.right)      { this.dx += this.speed; this.facingRight = true; }
        else if (keys.left)  { this.dx -= this.speed; this.facingRight = false; }

        if (!keys.right && !keys.left) {
            if (this.state === 'run') this.state = 'idle';
        } else if (this.state === 'idle') {
            this.state = 'run';
        }

        this.dx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.dx * FRICTION));
        this.dy += GRAVITY;

        // Clamp fall speed
        if (this.dy > 15) this.dy = 15;

        this.x += this.dx;
        checkCollisionsX(this);
        this.y += this.dy;
        checkCollisionsY(this);

        // Animation states
        if (this.dy > 1 && this.state !== 'jump')        this.state = 'fall';
        if (this.state === 'run')                         this.rotation = Math.sin(Date.now() / 100) * 0.12;
        else if (this.state === 'jump')                   this.rotation = -0.12;
        else if (this.state === 'fall')                   this.rotation =  0.12;
        else                                              this.rotation = 0;

        if (Math.random() < 0.08 && this.state === 'run') {
            spawnParticles(this.x + this.width / 2, this.y + this.height, 1, '#888', 'dust');
        }

        // Death pit
        if (this.y > canvas.height + 150) triggerGameOver();

        // Camera
        if (currentLevel === 1) {
            const target = this.x - canvas.width / 2.5;
            cameraX = Math.max(0, cameraX + (target - cameraX) * 0.12);
            if (this.x < cameraX) { this.x = cameraX; this.dx = 0; }
        } else {
            // Arenas: lock camera, clamp player
            cameraX = 0;
            if (this.x < 0)                    { this.x = 0;                    this.dx = 0; }
            if (this.x > canvas.width - this.width) { this.x = canvas.width - this.width; this.dx = 0; }
        }
    }

    draw() {
        ctx.save();
        if (this.invulnerable > 0 && Math.floor(Date.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;

        const sx = this.x - cameraX + this.width  / 2;
        const sy = this.y             + this.height / 2;
        ctx.translate(sx, sy);
        if (!this.facingRight) ctx.scale(-1, 1);
        ctx.rotate(this.rotation);

        if (selectedCharImage && selectedCharImage.complete && selectedCharImage.naturalWidth > 0) {
            ctx.drawImage(selectedCharImage, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Fallback coloured rectangle
            ctx.fillStyle = '#e52521';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        // Gun barrel when weapon unlocked
        if (isWeaponUnlocked) {
            ctx.fillStyle = '#222';
            ctx.fillRect(this.width / 2 - 4, 2, 18, 7);
        }

        ctx.restore();
    }
}

// ------ ENEMY (drone / decoy) ------
class Enemy extends Entity {
    constructor(x, y, isDrone = true) {
        super(x, y, 34, 34);
        this.isDrone = isDrone;
        this.dx = isDrone ? -1.8 : (Math.random() > 0.5 ? 2.2 : -2.2);
    }
    update() {
        if (this.dead) return;
        this.dy += GRAVITY;
        this.x += this.dx; checkCollisionsX(this, true);
        this.y += this.dy; checkCollisionsY(this);
        if (this.y > canvas.height + 200) this.dead = true;
    }
    draw() {
        if (this.dead) return;
        ctx.save();
        const ex = this.x - cameraX;
        ctx.fillStyle = this.isDrone ? '#3a3a55' : '#6a006a';
        ctx.fillRect(ex, this.y, this.width, this.height);
        // Glowing eye
        ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? '#ff2200' : '#660000';
        const eyeX = this.dx > 0 ? ex + this.width - 12 : ex + 6;
        ctx.fillRect(eyeX, this.y + 10, 7, 7);
        ctx.restore();
    }
}

// ------ ENERGY WAVE (boss projectile) ------
class EnergyWave extends Entity {
    constructor(x, y, dx) {
        super(x, y, 22, 22);
        this.dx = dx;
    }
    update() {
        this.x += this.dx;
        spawnParticles(this.x + 11, this.y + 11, 1, '#ff2200', 'sparkle');
        // Mark dead when off-screen
        if (this.x < -100 || this.x > 2000) this.dead = true;
    }
    draw() {
        if (this.dead) return;
        ctx.save();
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#ff4400';
        ctx.fillStyle   = '#ff2200';
        ctx.beginPath();
        ctx.arc(this.x - cameraX + 11, this.y + 11, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ------ SMART BOSS ------
class SmartBoss extends Entity {
    constructor(x, y, imageId, hp) {
        super(x, y, 72, 72);
        this.hp       = hp;
        this.maxHp    = hp;
        this.image    = document.getElementById(imageId);
        this.cooldown = 80;          // start with a short peace period
        this.vulnerabilityTimer = 0;
        this.baseSpeed = currentLevel === 3 ? 3.5 : 2;
        this.dx = this.baseSpeed;    // Level 2 lateral movement
    }

    get speed() { return this.baseSpeed + (this.maxHp - this.hp) * 0.4; }

    update() {
        if (this.dead) return;
        if (this.cooldown           > 0) this.cooldown--;
        if (this.vulnerabilityTimer > 0) this.vulnerabilityTimer--;

        if (currentLevel === 1) {
            // Inactive – just bob on the balcony
            this.y = 80 + Math.sin(Date.now() / 600) * 6;
            return;
        }

        this.dy += GRAVITY;

        if (currentLevel === 2) {
            // Slowly pace, teleport if player gets close
            const dist = Math.abs(player.x - this.x);
            if (dist < 220 && this.cooldown <= 0) {
                playSound('teleport');
                spawnParticles(this.x + 36, this.y + 36, 25, '#555', 'smoke');
                // Jump to far side
                this.x = player.x < 400 ? 650 : 120;
                this.y = Math.min(370, this.y);
                this.dy = -6;
                this.cooldown = 140;
                // Spawn decoy at old spot
                enemies.push(new Enemy(player.x < 400 ? 650 : 120, 200, false));
            } else {
                // Patrol
                this.x += this.dx;
                if (this.x < 60 || this.x > canvas.width - this.width - 60) this.dx *= -1;
            }

        } else { // Level 3 – full fight
            if (this.cooldown <= 0) {
                const toPlayer = player.x - this.x;
                if (Math.random() < 0.55) {
                    // Fire energy wave
                    const wdx = toPlayer > 0 ? 5.5 : -5.5;
                    enemies.push(new EnergyWave(this.x + 36, this.y + 36, wdx));
                    this.cooldown = Math.max(60, 160 - (this.maxHp - this.hp) * 22);
                    this.vulnerabilityTimer = 48; // ~0.8s
                } else {
                    // Dash toward player
                    this.dx = toPlayer > 0 ? this.speed * 2.2 : -this.speed * 2.2;
                    this.dy = -7;
                    this.cooldown = Math.max(80, 200 - (this.maxHp - this.hp) * 25);
                    this.vulnerabilityTimer = 48;
                }
            } else {
                // Bullet-dodge logic
                let danger = false;
                for (const b of bullets) {
                    if (b.active &&
                        Math.abs(b.y - (this.y + this.height / 2)) < 60 &&
                        ((b.dx > 0 && b.x < this.x) || (b.dx < 0 && b.x > this.x + this.width))) {
                        danger = true; break;
                    }
                }
                if (danger && this.vulnerabilityTimer <= 0 && this.cooldown < 30) {
                    playSound('teleport');
                    spawnParticles(this.x + 36, this.y + 36, 10, '#0ff', 'sparkle');
                    this.dy    = JUMP_FORCE * 0.9;
                    this.dx    = (Math.random() > 0.5 ? 1 : -1) * this.speed * 3;
                }
            }

            // Arena bounds
            this.x += this.dx;
            if (this.x < 10)                           { this.x = 10;   this.dx *= -1; }
            if (this.x > canvas.width - this.width - 10) { this.x = canvas.width - this.width - 10; this.dx *= -1; }
        }

        checkCollisionsX(this, true);
        checkCollisionsY(this);
    }

    draw() {
        if (this.dead) return;
        ctx.save();
        const bx = this.x - cameraX;

        if (this.vulnerabilityTimer > 0) {
            ctx.shadowBlur  = 20;
            ctx.shadowColor = 'red';
            if (Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.55;
        }

        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            if (player.x > this.x) {
                ctx.translate(bx + this.width / 2, this.y + this.height / 2);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            } else {
                ctx.drawImage(this.image, bx, this.y, this.width, this.height);
            }
        } else {
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(bx, this.y, this.width, this.height);
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // HP bar (always visible)
        ctx.fillStyle = '#111';
        ctx.fillRect(bx, this.y - 14, this.width, 8);
        ctx.fillStyle = `hsl(${(this.hp / this.maxHp) * 120}, 90%, 45%)`;
        ctx.fillRect(bx, this.y - 14, this.width * (this.hp / this.maxHp), 8);

        ctx.restore();
    }
}

// ------ BULLET ------
class Bullet {
    constructor(x, y, facingRight) {
        this.x = x; this.y = y;
        this.width = 16; this.height = 5;
        this.dx = facingRight ? 13 : -13;
        this.active = true;
    }
    update() {
        this.x += this.dx;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 1, '#00eeff', 'sparkle');
        if (this.x < -100 || this.x > 2500) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#00eeff';
        ctx.fillStyle   = '#00eeff';
        ctx.fillRect(this.x - cameraX, this.y, this.width, this.height);
        ctx.restore();
    }
}

// ------ POWER CORE ------
class PowerCore {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 22; this.height = 22;
        this.collected = false;
        this.bob = Math.random() * Math.PI * 2;
    }
    update() { this.bob += 0.08; }
    draw() {
        if (this.collected) return;
        const by = this.y + Math.sin(this.bob) * 6;
        ctx.save();
        const cx = this.x - cameraX;
        ctx.shadowBlur  = 14; ctx.shadowColor = '#ff00ff';
        ctx.fillStyle   = '#cc00cc';
        ctx.fillRect(cx, by, this.width, this.height);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.strokeRect(cx, by, this.width, this.height);
        ctx.restore();
    }
}

// ------ AMMO DROP ------
class AmmoDrop {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 22; this.height = 22;
        this.collected = false;
        this.dy = 3;
    }
    update() {
        if (this.dy > 0) {
            this.y += this.dy;
            this.dy += GRAVITY;
            checkCollisionsY(this); // land on platforms
            if (this.dy === 0) this.dy = 0; // grounded
        }
    }
    draw() {
        if (this.collected) return;
        ctx.save();
        const ax = this.x - cameraX;
        ctx.shadowBlur  = 10; ctx.shadowColor = '#00ff00';
        ctx.fillStyle   = '#00bb00';
        ctx.fillRect(ax, this.y, this.width, this.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('A', ax + 6, this.y + 16);
        ctx.restore();
    }
}

// ------ PLATFORM ------
class Platform {
    constructor(x, y, w, h, type = 'ground') {
        this.x = x; this.y = y; this.width = w; this.height = h; this.type = type;
    }
    draw() {
        const px = this.x - cameraX;
        ctx.save();
        if (this.type === 'ground') {
            ctx.fillStyle = '#2a2a3a'; ctx.fillRect(px, this.y, this.width, this.height);
            ctx.fillStyle = '#44445a'; ctx.fillRect(px, this.y, this.width, 6);
        } else if (this.type === 'balcony') {
            ctx.fillStyle = '#3a3a5a'; ctx.fillRect(px, this.y, this.width, this.height);
            ctx.fillStyle = '#6666aa'; ctx.fillRect(px, this.y, this.width, 4);
        } else if (this.type === 'crate') {
            ctx.fillStyle   = '#8B5513'; ctx.fillRect(px, this.y, this.width, this.height);
            ctx.strokeStyle = '#5a2d00'; ctx.lineWidth = 2; ctx.strokeRect(px, this.y, this.width, this.height);
            ctx.beginPath();
            ctx.moveTo(px, this.y); ctx.lineTo(px + this.width, this.y + this.height);
            ctx.moveTo(px + this.width, this.y); ctx.lineTo(px, this.y + this.height);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// ------ FLAG / EXIT DOOR ------
class FlagPole {
    constructor(x, y) {
        this.x = x; this.y = y; this.width = 50; this.height = 80;
    }
    draw() {
        const fx = this.x - cameraX;
        ctx.save();
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(fx, this.y, this.width, this.height);
        ctx.fillStyle = '#00cc00';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('EXIT', fx + 6, this.y + this.height / 2 + 4);
        ctx.restore();
    }
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
    if (scoreDisplay) scoreDisplay.innerText = score;

    // Update the "1-1" level display
    document.querySelectorAll('.hud-item.center-hud .value').forEach(el => {
        el.innerText = `${currentLevel}-1`;
    });

    // Timer (Level 2)
    if (timerHud) timerHud.style.display = currentLevel === 2 ? 'block' : 'none';
    if (currentLevel === 2 && timeDisplay) timeDisplay.innerText = Math.max(0, timeRemaining);

    // Cores (Level 3)
    if (coresHud) coresHud.style.display = currentLevel === 3 ? 'block' : 'none';
    if (currentLevel === 3 && coresDisplay) coresDisplay.innerText = `${coresCollected} / 3`;

    // Ammo
    if (ammoDisplay) ammoDisplay.innerText = currentLevel === 3 ? `${currentAmmo}/${MAX_AMMO}` : '--';

    // Shoot button
    if (btnShoot) btnShoot.style.display = (currentLevel === 3 && isWeaponUnlocked) ? 'flex' : 'none';
}

// ============================================================
// LEVEL INITIALISATION
// ============================================================
function initLevel() {
    player    = new Player();
    cameraX   = 0;
    particles = []; bullets = []; enemies = []; items = [];
    platforms = []; boss = null; flagPole = null;

    isWeaponUnlocked = false;
    currentAmmo      = 0;
    coresCollected   = 0;
    timeRemaining    = 30;
    lastSecondAt     = 0; // will be set on first rAF tick

    if (currentLevel === 1) {
        // ------- LEVEL 1: Long corridor, boss on unreachable balcony -------
        platforms = [
            new Platform(0,   400, 2400, 60, 'ground'),
            new Platform(300, 180,  250, 20, 'balcony'), // Boss balcony
            new Platform(700, 300,  120, 20, 'balcony'),
            new Platform(950, 200,  100, 20, 'balcony'),
            new Platform(1250,300,  160, 20, 'balcony'),
            new Platform(1600,200,  120, 20, 'balcony'),
        ];
        boss     = new SmartBoss(320, 110, 'img-boss-1', 1);
        flagPole = new FlagPole(2300, 320);

        enemies.push(new Enemy(500,  360));
        enemies.push(new Enemy(900,  360));
        enemies.push(new Enemy(1300, 360));
        enemies.push(new Enemy(1750, 360));
        enemies.push(new Enemy(2100, 360));

    } else if (currentLevel === 2) {
        // ------- LEVEL 2: Survival Arena, 30-sec timer -------
        platforms = [
            new Platform(0,   400, canvas.width, 60, 'ground'),
            new Platform(100, 270, 150,           20, 'balcony'),
            new Platform(canvas.width-250, 270, 150, 20, 'balcony'),
        ];
        boss = new SmartBoss(canvas.width / 2 - 36, 330, 'img-boss-2', 2);

    } else if (currentLevel === 3) {
        // ------- LEVEL 3: Final Battle Arena -------
        platforms = [
            new Platform(0,   400, canvas.width, 60, 'ground'),
            new Platform(160, 350, 60, 55, 'crate'),
            new Platform(canvas.width-220, 350, 60, 55, 'crate'),
            new Platform(canvas.width/2-100, 240, 200, 20, 'balcony'),
        ];
        boss = new SmartBoss(canvas.width - 150, 328, 'img-boss-final', 5);

        items.push(new PowerCore(80,  375));
        items.push(new PowerCore(canvas.width / 2 - 11, 210));
        items.push(new PowerCore(canvas.width - 102,   375));
    }

    updateHUD();
}

// ============================================================
// COLLISION SYSTEM
// ============================================================
function isColliding(a, b) {
    return (
        a.x < b.x + b.width  &&
        a.x + a.width  > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function checkCollisionsX(entity, turnAround = false) {
    for (const p of platforms) {
        if (!isColliding(entity, p)) continue;
        if (entity.dx > 0) {
            entity.x = p.x - entity.width;
        } else if (entity.dx < 0) {
            entity.x = p.x + p.width;
        }
        if (turnAround) entity.dx *= -1;
        else            entity.dx  = 0;
    }
}

function checkCollisionsY(entity) {
    let wasFalling       = entity.dy > 0;
    let groundedThisFrame = false;

    for (const p of platforms) {
        if (!isColliding(entity, p)) continue;
        if (entity.dy > 0) {
            entity.y = p.y - entity.height;
            entity.dy = 0;
            groundedThisFrame = true;
        } else if (entity.dy < 0) {
            entity.y = p.y + p.height;
            entity.dy = 0;
        }
    }

    // State transitions for player
    if (entity === player) {
        if (groundedThisFrame && wasFalling) {
            player.state = 'idle';
            spawnParticles(player.x + player.width / 2, player.y + player.height, 4, '#888', 'dust');
        } else if (!groundedThisFrame && entity.dy > 1 && player.state !== 'jump') {
            player.state = 'fall';
        }
    }
}

// ============================================================
// INTERACTION CHECKS
// ============================================================
function checkInteractions() {
    // Enemies → player instant death
    for (const e of enemies) {
        if (e.dead || player.invulnerable > 0) continue;
        if ('active' in e && !e.active) continue; // EnergyWave that's dead
        if (isColliding(player, e)) {
            playSound('hurt');
            triggerGameOver();
            return;
        }
    }

    // Boss → player death (on touch)
    if (boss && !boss.dead && player.invulnerable === 0) {
        if (isColliding(player, boss)) {
            playSound('hurt');
            triggerGameOver();
            return;
        }
    }

    // Bullets
    for (const b of bullets) {
        if (!b.active) continue;

        // Hit platform → deactivate
        for (const p of platforms) {
            if (isColliding(b, p)) {
                b.active = false;
                spawnParticles(b.x, b.y, 4, '#666', 'dust');
                break;
            }
        }
        if (!b.active) continue;

        // Hit boss
        if (boss && !boss.dead && isColliding(b, boss)) {
            b.active = false;
            if (boss.vulnerabilityTimer > 0) {
                boss.hp--;
                score += 200;
                playSound('boss_hurt');
                spawnParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, 35, '#ff2200', 'explosion');
                boss.vulnerabilityTimer = 0;
                if (boss.hp <= 0) {
                    boss.dead = true;
                    spawnParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, 60, '#ffd700', 'explosion');
                    // Spawn exit after a short delay
                    setTimeout(() => { flagPole = new FlagPole(canvas.width / 2 - 25, 320); }, 1200);
                }
            } else {
                // Deflected
                playSound('deflect');
                spawnParticles(b.x, b.y, 8, '#aaa', 'sparkle');
            }
        }
    }

    // Items (cores, ammo)
    for (const item of items) {
        if (item.collected) continue;
        if (isColliding(player, item)) {
            item.collected = true;
            playSound('collect');

            if (item instanceof PowerCore) {
                coresCollected++;
                spawnParticles(item.x + 11, item.y + 11, 15, '#ff00ff', 'sparkle');
                if (coresCollected >= 3 && !isWeaponUnlocked) {
                    isWeaponUnlocked = true;
                    currentAmmo      = MAX_AMMO;
                }
            } else if (item instanceof AmmoDrop) {
                currentAmmo = MAX_AMMO;
                spawnParticles(item.x + 11, item.y + 11, 10, '#00ff00', 'sparkle');
            }
            updateHUD();
        }
    }

    // Flagpole / exit door
    if (flagPole && isColliding(player, flagPole)) {
        triggerWin();
    }
}

// ============================================================
// AMMO DROPS (Level 3 only)
// ============================================================
function maybeSpawnAmmo() {
    if (!isWeaponUnlocked) return;
    if (currentAmmo > 2)   return;
    // Small random chance per frame (~every 5–10 sec on avg)
    if (Math.random() < 0.003) {
        items.push(new AmmoDrop(Math.random() * (canvas.width - 80) + 40, -30));
    }
}

// ============================================================
// BACKGROUND
// ============================================================
function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (currentLevel === 1) {
        grad.addColorStop(0, '#060618');
        grad.addColorStop(1, '#1a0a30');
    } else if (currentLevel === 2) {
        grad.addColorStop(0, '#080820');
        grad.addColorStop(1, '#20100a');
    } else {
        grad.addColorStop(0, '#0a0000');
        grad.addColorStop(1, '#200010');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Moving grid lines for cyberpunk feel
    ctx.strokeStyle = 'rgba(80,80,160,0.08)';
    ctx.lineWidth = 1;
    const offset = (Date.now() / 40) % 60;
    for (let x = -60; x < canvas.width + 60; x += 60) {
        ctx.beginPath(); ctx.moveTo(x + offset, 0); ctx.lineTo(x + offset, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

// ============================================================
// GAME LOOP — FIXED TIME STEP
// ============================================================
function gameLoop(timestamp) {
    if (isGameOver || isGameWon) return;

    // First frame
    if (lastTime === 0) {
        lastTime     = timestamp;
        lastSecondAt = timestamp;
    }

    let delta = timestamp - lastTime;
    lastTime  = timestamp;

    // Guard against huge deltas (tab switch)
    if (delta > 200) delta = FIXED_STEP;

    accumulator += delta;

    while (accumulator >= FIXED_STEP) {
        // --- Update all entities ---
        player.update();
        enemies.forEach(e  => e.update());
        if (boss) boss.update();
        bullets.forEach(b  => b.update());
        items.forEach(i    => i.update());

        // Remove dead/inactive entries to prevent memory bloat
        enemies = enemies.filter(e => !e.dead);
        bullets = bullets.filter(b => b.active);

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }

        checkInteractions();
        if (currentLevel === 3) maybeSpawnAmmo();

        // Level 2 survival countdown (wall-clock seconds)
        if (currentLevel === 2 && !isGameWon) {
            if (timestamp - lastSecondAt >= 1000) {
                timeRemaining--;
                lastSecondAt = timestamp;
                updateHUD();
                if (timeRemaining <= 0) triggerWin();
            }
        }

        accumulator -= FIXED_STEP;
    }

    // --- Render ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    platforms.forEach(p => p.draw());
    if (flagPole) flagPole.draw();
    items.forEach(i    => i.draw());
    enemies.forEach(e  => e.draw());
    if (boss) boss.draw();
    bullets.forEach(b  => b.draw());
    particles.forEach(p => p.draw());
    player.draw();

    // Heads-up text helpers
    drawHUDExtras();

    animationId = requestAnimationFrame(gameLoop);
}

// Small on-canvas HUD helpers
function drawHUDExtras() {
    if (currentLevel === 2 && !isGameWon) {
        // Danger bar at top
        const pct = Math.max(0, timeRemaining / 30);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, 6);
        ctx.fillStyle = `hsl(${pct * 120}, 90%, 50%)`;
        ctx.fillRect(0, 0, canvas.width * pct, 6);
    }

    if (currentLevel === 3 && !isWeaponUnlocked) {
        // Core guide
        ctx.save();
        ctx.fillStyle = 'rgba(255,0,255,0.85)';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Collect Power Cores: ${coresCollected}/3`, 10, canvas.height - 10);
        ctx.restore();
    }

    if (currentLevel === 3 && isWeaponUnlocked && currentAmmo === 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,80,80,0.9)';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('OUT OF AMMO! Find the green drop!', 10, canvas.height - 10);
        ctx.restore();
    }
}

// ============================================================
// GAME FLOW
// ============================================================
function startGame() {
    if (!selectedCharImage) return;
    initAudio();
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    currentLevel = 1;
    resetGame();
}

function resetGame() {
    cancelAnimationFrame(animationId);

    isGameOver = false;
    isGameWon  = false;
    keys.up = false; keys.left = false; keys.right = false; keys.shoot = false;
    lastTime    = 0;
    accumulator = 0;
    score       = 0;

    winOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    // Configure overlay buttons for this level
    if (currentLevel >= MAX_LEVELS) {
        nextLevelBtn.style.display = 'none';
        playAgainBtn.style.display = 'block';
    } else {
        nextLevelBtn.style.display = 'inline-block';
        playAgainBtn.style.display = 'none';
    }

    initLevel();
    updateHUD();
    animationId = requestAnimationFrame(gameLoop);
}

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    playSound('hurt');
    gameOverOverlay.classList.remove('hidden');
}

function triggerWin() {
    if (isGameWon) return;
    isGameWon = true;
    playSound('win');
    if (winTitle) {
        winTitle.innerText = currentLevel >= MAX_LEVELS ? '🏆 BOSS DEFEATED!' : '✅ MISSION CLEARED!';
    }
    winOverlay.classList.remove('hidden');
}

// ============================================================
// CANVAS / VIEWPORT RESIZE
// ============================================================
function resizeCanvas() {
    const ratio = window.innerWidth / window.innerHeight;
    canvas.width  = Math.round(Math.max(360, Math.min(1200, 450 * ratio)));
    canvas.height = 450;
    updateButtonRects();
}

window.addEventListener('resize', resizeCanvas);

// ============================================================
// MOBILE TOUCH INPUT
// ============================================================
let btnRects = { left: null, right: null, jump: null, shoot: null };

function updateButtonRects() {
    if (!btnLeft || !btnLeft.offsetParent) return;
    const ex = 50; // generous hit-zone extension
    const lr = btnLeft.getBoundingClientRect();
    const rr = btnRight.getBoundingClientRect();
    const jr = btnJump.getBoundingClientRect();
    const sr = btnShoot ? btnShoot.getBoundingClientRect() : null;

    btnRects.left  = { x1: lr.left-ex, x2: lr.right+ex, y1: lr.top-ex, y2: lr.bottom+ex };
    btnRects.right = { x1: rr.left-ex, x2: rr.right+ex, y1: rr.top-ex, y2: rr.bottom+ex };
    btnRects.jump  = { x1: jr.left-ex, x2: jr.right+ex, y1: jr.top-ex, y2: jr.bottom+ex };
    btnRects.shoot = sr ? { x1: sr.left-ex, x2: sr.right+ex, y1: sr.top-ex, y2: sr.bottom+ex } : null;
}

function inZone(t, r) {
    return r && t.clientX > r.x1 && t.clientX < r.x2 && t.clientY > r.y1 && t.clientY < r.y2;
}

function handleGlobalTouches(e) {
    if (!btnLeft || !btnLeft.offsetParent) return;
    e.preventDefault();
    initAudio();

    let nl = false, nr = false, nj = false, ns = false;
    for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (inZone(t, btnRects.left))  nl = true;
        if (inZone(t, btnRects.right)) nr = true;
        if (inZone(t, btnRects.jump))  nj = true;
        if (inZone(t, btnRects.shoot)) ns = true;
    }

    keys.left  = nl;
    keys.right = nr;

    if (nj && !keys.up)  handleJump();
    if (!nj && keys.up)  handleJumpRelease();
    if (ns && !keys.shoot) { keys.shoot = true; handleShoot(); }
    if (!ns)               { keys.shoot = false; }

    btnLeft.classList.toggle('active',  nl);
    btnRight.classList.toggle('active', nr);
    btnJump.classList.toggle('active',  nj);
    if (btnShoot) btnShoot.classList.toggle('active', ns);
}

['touchstart','touchmove','touchend','touchcancel'].forEach(evt =>
    window.addEventListener(evt, handleGlobalTouches, { passive: false })
);

// ============================================================
// SETUP — CHARACTER SELECTION & BUTTON EVENTS
// ============================================================
characterCards.forEach(card => {
    card.addEventListener('click', () => {
        characterCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedCharId    = card.getAttribute('data-character');
        selectedCharImage = document.getElementById(`img-char-${selectedCharId}`);
        startBtn.disabled = false;
        initAudio();
    });
});

startBtn.addEventListener('click',    startGame);
restartBtn.addEventListener('click',  resetGame);
tryAgainBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', () => { currentLevel = 1; resetGame(); });
nextLevelBtn.addEventListener('click', () => { currentLevel++;   resetGame(); });

// ============================================================
// BOOT
// ============================================================
resizeCanvas();
setTimeout(resizeCanvas, 400); // after fonts load
