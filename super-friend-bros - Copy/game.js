// Game Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const characterCards = document.querySelectorAll('.character-card');
const scoreDisplay = document.getElementById('score-display');

// Overlays
const winOverlay = document.getElementById('win-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const playAgainBtn = document.getElementById('play-again-btn');
const tryAgainBtn = document.getElementById('try-again-btn');

// Game State
let selectedCharImage = null;
let selectedCharId = null;
let animationId;
let isGameOver = false;
let isGameWon = false;
let cameraX = 0;
let coinsCollected = 0;

// Time tracking
let lastTime = 0;
const fixedTimeStep = 1000 / 60; // 60 FPS
let timeAccumulator = 0;

// Inputs
const keys = {
    right: false,
    left: false,
    up: false
};

// Physics Constants
const GRAVITY = 0.5;
const FRICTION = 0.85;
const MAX_SPEED = 6;
const JUMP_FORCE = -11;

// --- Audio Synthesizer ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'stomp') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'hurt') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.3);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(500, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.2);
        osc.frequency.setValueAtTime(800, now + 0.3);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
    }
}

// --- Particle Engine ---
class Particle {
    constructor(x, y, color, type) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type; // 'dust', 'sparkle', 'explosion'
        this.life = 1.0;

        if (type === 'dust') {
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = Math.random() * -2;
            this.size = Math.random() * 4 + 2;
            this.decay = 0.05;
        } else if (type === 'sparkle') {
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            this.size = Math.random() * 3 + 2;
            this.decay = 0.03;
        } else if (type === 'explosion') {
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = (Math.random() - 0.5) * 6;
            this.size = Math.random() * 6 + 4;
            this.decay = 0.04;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.type === 'dust') this.size += 0.2;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;

        if (this.type === 'sparkle') {
            // draw star
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.restore();
    }
}

let particles = [];
function spawnParticles(x, y, count, color, type) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, type));
    }
}


// --- Character Setup ---
characterCards.forEach(card => {
    card.addEventListener('click', () => {
        characterCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedCharId = card.getAttribute('data-character');
        selectedCharImage = document.getElementById(`img-char-${selectedCharId}`);
        startBtn.disabled = false;
        initAudio(); // Initialize audio context on first user interaction
    });
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);
tryAgainBtn.addEventListener('click', resetGame);

// Event Listeners for movement
window.addEventListener('keydown', (e) => {
    if (isGameOver || isGameWon) return;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        if (!keys.up && player.state !== 'fall' && player.state !== 'jump') { // More robust grounded check
            player.dy = JUMP_FORCE;
            player.state = 'jump';
            playSound('jump');
            spawnParticles(player.x + player.width / 2, player.y + player.height, 5, '#fff', 'dust');
        }
        keys.up = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        keys.up = false;
        // Variable jump height limit
        if (player.dy < JUMP_FORCE / 2) {
            player.dy = JUMP_FORCE / 2;
        }
    }
});


// Entities
class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.dx = 0;
        this.dy = 0;
        this.state = 'idle';
        this.facingRight = true;
        this.dead = false;
        this.invulnerable = 0;
    }
}

class Player extends Entity {
    constructor() {
        super(100, 100, 36, 36);
        this.speed = 0.8;
        this.maxSpeed = MAX_SPEED;
        this.rotation = 0;
    }

    update() {
        if (this.invulnerable > 0) this.invulnerable--;

        // Horizontal movement & states
        if (keys.right) {
            this.dx += this.speed;
            this.facingRight = true;
            if (this.state === 'idle') this.state = 'run';
        } else if (keys.left) {
            this.dx -= this.speed;
            this.facingRight = false;
            if (this.state === 'idle') this.state = 'run';
        } else {
            if (this.state === 'run') this.state = 'idle';
        }

        // Apply friction
        this.dx *= FRICTION;

        // Apply gravity
        this.dy += GRAVITY;

        // Vertical states
        if (this.dy > 1) {
            this.state = 'fall';
        }

        // Limit speed
        if (this.dx > this.maxSpeed) this.dx = this.maxSpeed;
        if (this.dx < -this.maxSpeed) this.dx = -this.maxSpeed;

        // Apply X velocity
        this.x += this.dx;
        checkCollisionsX(this);

        // Apply Y velocity
        this.y += this.dy;
        checkCollisionsY(this);

        // Animation logic based on state
        if (this.state === 'run') {
            this.rotation = Math.sin(Date.now() / 100) * 0.15;
            if (Math.random() < 0.1) spawnParticles(this.x + this.width / 2, this.y + this.height, 1, '#fff', 'dust');
        } else if (this.state === 'jump') {
            this.rotation = -0.1;
        } else if (this.state === 'fall') {
            this.rotation = 0.1;
        } else {
            this.rotation = 0;
        }

        // Death by falling
        if (this.y > canvas.height + 100) {
            triggerGameOver();
        }

        // Smooth Camera Follow (Lerping)
        const targetCameraX = this.x - canvas.width / 2.5;
        cameraX += (targetCameraX - cameraX) * 0.1;

        // Don't let camera go completely left
        if (cameraX < 0) cameraX = 0;

        // Hard constraint: Push player if they try to walk off the left edge of screen
        if (this.x < cameraX) {
            this.x = cameraX;
            this.dx = 0;
        }
    }

    draw(ctx) {
        ctx.save();

        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Translate for camera and center
        ctx.translate(this.x - cameraX + this.width / 2, this.y + this.height / 2);

        if (!this.facingRight) {
            ctx.scale(-1, 1);
        }

        ctx.rotate(this.rotation);

        if (selectedCharImage) {
            ctx.drawImage(selectedCharImage, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, imageId) {
        super(x, y, 36, 36);
        this.dx = -1.5;
        this.image = document.getElementById(imageId);
        this.state = 'run';
    }

    update() {
        if (this.dead) return;

        this.dy += GRAVITY;

        // Move X and resolve
        this.x += this.dx;
        checkCollisionsX(this, true); // True = enemies turn around

        // Move Y and resolve
        this.y += this.dy;
        checkCollisionsY(this);

        if (this.y > canvas.height + 100) this.dead = true;
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(-cameraX, 0);

        if (this.image) {
            if (this.dx > 0) {
                ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
                ctx.scale(-1, 1);
                // Slight bounce
                const bounce = Math.abs(Math.sin(Date.now() / 150)) * 4;
                ctx.drawImage(this.image, -this.width / 2, -this.height / 2 - bounce, this.width, this.height);
            } else {
                const bounce = Math.abs(Math.sin(Date.now() / 150)) * 4;
                ctx.drawImage(this.image, this.x, this.y - bounce, this.width, this.height);
            }
        }
        ctx.restore();
    }
}

class Boss extends Entity {
    constructor(x, y) {
        super(x, y, 90, 90); // Larger size
        this.dx = -2;
        this.hp = 3;
        this.image = document.getElementById('img-boss');
    }

    update() {
        if (this.dead) return;
        if (this.invulnerable > 0) this.invulnerable--;

        this.dy += GRAVITY;

        // Random boss jumps when on ground
        if (Math.random() < 0.02 && this.state !== 'fall' && this.state !== 'jump') {
            this.dy = JUMP_FORCE;
            this.state = 'jump';
        }

        this.x += this.dx;
        checkCollisionsX(this, true);

        this.y += this.dy;
        checkCollisionsY(this);

        // Boss arena boundaries
        if (this.x > 2300) { this.x = 2300; this.dx *= -1; }
        if (this.x < 1900) { this.x = 1900; this.dx *= -1; }

        if (this.y > canvas.height + 100) this.dead = true;
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(-cameraX, 0);

        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        if (this.image) {
            // Face player roughly
            if (player.x > this.x) {
                ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            } else {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }

        // Draw Health Bar
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x, this.y - 15, this.width, 10);
        ctx.fillStyle = 'lime';
        ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / 3), 10);

        ctx.restore();
    }
}

class Platform {
    constructor(x, y, width, height, type = 'ground') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(-cameraX, 0);

        if (this.type === 'ground') {
            ctx.fillStyle = '#c84c0c';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#43b047';
            ctx.fillRect(this.x, this.y, this.width, 10);
        } else if (this.type === 'brick') {
            ctx.fillStyle = '#cc5500';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Simple brick detail
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width, this.y + this.height / 2);
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.collected = false;
        this.bobTime = Math.random() * Math.PI * 2;
    }

    update() {
        this.bobTime += 0.05;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(-cameraX, 0);

        const bob = Math.sin(this.bobTime) * 6;

        ctx.beginPath();
        ctx.arc(this.x, this.y + bob, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fbd000';
        ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - 3, this.y + bob - 6, 4, 12);

        ctx.restore();
    }
}

class FlagPole {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 12;
        this.height = 300;
        this.flagY = y + 10;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(-cameraX, 0);

        // Pole base
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x - 10, this.y + this.height, this.width + 20, 20);

        // Pole
        ctx.fillStyle = '#ccc';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Ball
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 8, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#fbd000';
        ctx.fill();

        // Flag
        ctx.fillStyle = '#43b047';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.flagY);
        ctx.lineTo(this.x - 60, this.flagY + 25);
        ctx.lineTo(this.x + this.width / 2, this.flagY + 50);
        ctx.fill();

        ctx.restore();
    }
}


// --- Level & Game Setup ---
let player;
let platforms = [];
let coins = [];
let enemies = [];
let boss = null;
let flagPole;

function initLevel() {
    player = new Player();
    cameraX = 0;
    coinsCollected = 0;
    scoreDisplay.innerText = coinsCollected;
    particles = [];

    // Level Design
    platforms = [
        new Platform(0, 400, 800, 50, 'ground'),
        new Platform(900, 400, 600, 50, 'ground'),
        new Platform(1600, 400, 1000, 50, 'ground'),

        new Platform(400, 300, 100, 30, 'brick'),
        new Platform(500, 300, 100, 30, 'brick'), // connected
        new Platform(700, 200, 100, 30, 'brick'),
        new Platform(1100, 250, 150, 30, 'brick'),
        new Platform(1300, 150, 100, 30, 'brick'),
        new Platform(1400, 150, 50, 30, 'brick'),
        new Platform(1800, 300, 50, 30, 'brick'),
        new Platform(1850, 250, 50, 30, 'brick'),
        new Platform(1900, 200, 50, 30, 'brick'),

        new Platform(1900, 400, 800, 50, 'ground'), // Arena
    ];

    coins = [
        new Coin(450, 250),
        new Coin(750, 150),
        new Coin(1175, 200),
        new Coin(1350, 100),
        new Coin(2000, 250)
    ];

    const allIds = ['1', '2', '3', '4'];
    const enemyIds = allIds.filter(id => id !== selectedCharId);

    enemies = [];
    if (enemyIds.length > 0) enemies.push(new Enemy(600, 360, `img-char-${enemyIds[0]}`));
    if (enemyIds.length > 1) enemies.push(new Enemy(1200, 360, `img-char-${enemyIds[1]}`));
    if (enemyIds.length > 2) enemies.push(new Enemy(1700, 360, `img-char-${enemyIds[2]}`));

    boss = new Boss(2200, 310);
    flagPole = new FlagPole(2550, 100);
}

// --- Robust Collision Engine ---
function isColliding(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function checkCollisionsX(entity, turnAround = false) {
    for (let platform of platforms) {
        if (isColliding(entity, platform)) {
            // Predict if it was going right or left
            if (entity.dx > 0) {
                entity.x = platform.x - entity.width;
            } else if (entity.dx < 0) {
                entity.x = platform.x + platform.width;
            }
            if (turnAround) {
                entity.dx *= -1;
            } else {
                entity.dx = 0;
            }
        }
    }
}

function checkCollisionsY(entity) {
    let wasFalling = entity.dy > 0;
    let groundedThisFrame = false;

    for (let platform of platforms) {
        if (isColliding(entity, platform)) {
            if (entity.dy > 0) {
                // Landing on platform
                entity.y = platform.y - entity.height;
                entity.dy = 0;
                groundedThisFrame = true;
            } else if (entity.dy < 0) {
                // Hitting head
                entity.y = platform.y + platform.height;
                entity.dy = 0;
                // Add minor bump effect
                spawnParticles(entity.x + entity.width / 2, platform.y + platform.height, 3, '#cc5500', 'dust');
            }
        }
    }

    if (entity === player) {
        if (groundedThisFrame) {
            if (wasFalling) {
                player.state = 'idle'; // Reset state on landing
                spawnParticles(player.x + player.width / 2, player.y + player.height, 5, '#fff', 'dust');
            }
        } else if (player.dy > 1 && player.state !== 'jump') {
            player.state = 'fall';
        }
    } else {
        // Enemy edge detection (so they don't fall blindly occasionally)
        if (groundedThisFrame && entity.dx !== 0) {
            let overEdge = true;
            for (let p of platforms) {
                if (
                    entity.x + entity.dx + entity.width / 2 > p.x &&
                    entity.x + entity.dx + entity.width / 2 < p.x + p.width &&
                    entity.y + entity.height >= p.y - 5 &&
                    entity.y + entity.height <= p.y + 5
                ) {
                    overEdge = false;
                }
            }
            if (overEdge && (entity instanceof Enemy || entity instanceof Boss)) {
                entity.dx *= -1; // turnaround safely
            }
        }

        if (entity.state !== undefined) {
            if (!groundedThisFrame && entity.dy > 0) {
                entity.state = 'fall';
            } else {
                entity.state = 'run';
            }
        }
    }
}

function checkInteractions() {
    // Entities
    enemies.forEach(enemy => {
        if (enemy.dead || player.invulnerable > 0) return;

        if (isColliding(player, enemy)) {
            // Player stomps enemy
            if (player.dy > 0 && player.y + player.height - player.dy <= enemy.y + 15) {
                enemy.dead = true;
                player.dy = JUMP_FORCE / 1.5; // bounce up
                coinsCollected += 5;
                scoreDisplay.innerText = coinsCollected;
                playSound('stomp');
                spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, '#fff', 'explosion');
            } else {
                playSound('hurt');
                triggerGameOver();
            }
        }
    });

    // Boss
    if (boss && !boss.dead && player.invulnerable === 0) {
        if (isColliding(player, boss)) {
            // Player stomps Boss
            if (player.dy > 0 && player.y + player.height - player.dy <= boss.y + 25) {
                if (boss.invulnerable === 0) {
                    boss.hp -= 1;
                    boss.invulnerable = 60; // 1 second roughly
                    player.dy = JUMP_FORCE * 1.2; // Huge bounce off boss
                    playSound('stomp');
                    spawnParticles(boss.x + boss.width / 2, boss.y, 20, '#ff4757', 'explosion');

                    if (boss.hp <= 0) {
                        boss.dead = true;
                        coinsCollected += 50;
                        scoreDisplay.innerText = coinsCollected;
                    }
                }
            } else {
                playSound('hurt');
                triggerGameOver();
            }
        }
    }

    // Coins
    coins.forEach(coin => {
        if (!coin.collected) {
            const distX = (player.x + player.width / 2) - coin.x;
            const distY = (player.y + player.height / 2) - coin.y;
            const distance = Math.sqrt(distX * distX + distY * distY);

            if (distance < player.width / 2 + coin.radius + 5) {
                coin.collected = true;
                coinsCollected++;
                scoreDisplay.innerText = coinsCollected;
                playSound('coin');
                spawnParticles(coin.x, coin.y, 8, '#fbd000', 'sparkle');
            }
        }
    });

    // Flag Pole collision (Win condition)
    if (
        boss && boss.dead &&
        player.x + player.width > flagPole.x &&
        player.x < flagPole.x + flagPole.width &&
        player.y + player.height > flagPole.y
    ) {
        triggerWin();
    }
}


function drawBackground() {
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Clouds (parallax)
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(-(cameraX * 0.3), 0); // slower 

    // Beautiful layered clouds
    function renderCloud(x, y, w, h) {
        ctx.beginPath();
        ctx.arc(x, y, h / 2, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(x + w, y - h / 4, h / 1.5, Math.PI, Math.PI * 2);
        ctx.arc(x + w + w, y, h / 2, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fill();
    }

    renderCloud(100, 80, 40, 40);
    renderCloud(500, 100, 60, 50);
    renderCloud(900, 70, 50, 45);
    renderCloud(1400, 120, 80, 60);
    renderCloud(2000, 90, 40, 40);

    ctx.restore();
}

// --- Main Engine Loop (Fixed Timestep) ---
function gameLoop(timestamp) {
    if (isGameOver || isGameWon) return;

    // Delta time calculation
    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Cap delta time to avoid large jumps if tab is inactive
    if (deltaTime > 100) deltaTime = fixedTimeStep;

    timeAccumulator += deltaTime;

    // Update logic at fixed timestep
    while (timeAccumulator >= fixedTimeStep) {
        // Updates
        player.update();
        enemies.forEach(e => e.update());
        if (boss) boss.update();
        coins.forEach(c => c.update());

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        checkInteractions();

        timeAccumulator -= fixedTimeStep;
    }

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    flagPole.draw(ctx);
    platforms.forEach(p => p.draw(ctx));
    coins.forEach(c => c.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    if (boss) boss.draw(ctx);
    particles.forEach(p => p.draw(ctx));
    player.draw(ctx);

    animationId = requestAnimationFrame(gameLoop);
}


function startGame() {
    if (!selectedCharImage) return;
    initAudio(); // Initialize audio context on play button just to be safe
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');

    resetGame();
}

function resetGame() {
    cancelAnimationFrame(animationId);
    isGameOver = false;
    isGameWon = false;
    keys.up = false;
    keys.left = false;
    keys.right = false;
    lastTime = 0;
    timeAccumulator = 0;

    winOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    initLevel();
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
    player.x = flagPole.x - player.width / 2;
    player.state = 'idle';

    // Slide down flagpole animation
    function winSlide() {
        if (player.y < 360) {
            player.y += 4;
            flagPole.flagY = player.y + 10;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBackground();
            flagPole.draw(ctx);
            platforms.forEach(p => p.draw(ctx));
            coins.forEach(c => c.draw(ctx));
            if (boss) boss.draw(ctx);
            player.draw(ctx);

            setTimeout(winSlide, fixedTimeStep);
        } else {
            winOverlay.classList.remove('hidden');
        }
    }
    winSlide();
}
