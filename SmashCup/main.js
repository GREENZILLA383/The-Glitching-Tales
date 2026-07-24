const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let lastTime = 0;
let gameState = 'START'; // START, PLAY, GAMEOVER, VICTORY, TRANSITION

const input = { left: false, right: false, jump: false, shoot: false, dash: false };

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'KeyZ') input.jump = true;
    if (e.code === 'KeyX') input.shoot = true;
    if (e.code === 'KeyC') input.dash = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'KeyZ') input.jump = false;
    if (e.code === 'KeyX') input.shoot = false;
    if (e.code === 'KeyC') input.dash = false;
});

const player = new Player();
const projectiles = new ProjectileManager();
const bossManager = new BossManager();

// Simple AABB Collision
function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function resetGame() {
    player.hp = 3;
    player.x = 100;
    player.y = 400;
    document.getElementById('player-health').innerText = 'HP: 3';
    projectiles.projectiles = [];
    bossManager.currentBossIndex = 0;
    bossManager.startNextBoss();
    gameState = 'PLAY';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
}

function handleCollisions() {
    // Projectiles vs Player & Boss
    for (let p of projectiles.projectiles) {
        if (p.active) {
            if (p.isPlayer) {
                // Player bullet vs Boss
                if (bossManager.currentBoss && rectIntersect(p.x - p.size, p.y - p.size, p.size*2, p.size*2, bossManager.x, bossManager.y, bossManager.width, bossManager.height)) {
                    bossManager.takeDamage();
                    p.active = false;
                }
            } else {
                // Boss bullet vs Player
                if (rectIntersect(p.x - p.size, p.y - p.size, p.size*2, p.size*2, player.x, player.y, player.width, player.height)) {
                    if (player.takeDamage()) {
                        p.active = false;
                    }
                }
            }
        }
    }
    
    // Boss body vs Player
    if (bossManager.currentBoss && rectIntersect(player.x, player.y, player.width, player.height, bossManager.x, bossManager.y, bossManager.width, bossManager.height)) {
        player.takeDamage();
    }
}

function update(dt) {
    if (gameState !== 'PLAY') return;
    
    player.update(dt, input, projectiles);
    bossManager.update(dt, player, projectiles);
    projectiles.update(dt);
    handleCollisions();
    
    if (player.hp <= 0) {
        gameState = 'GAMEOVER';
        document.getElementById('game-over-screen').classList.remove('hidden');
    }
    
    if (!bossManager.currentBoss) {
        gameState = 'TRANSITION';
        document.getElementById('victory-screen').classList.remove('hidden');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw BG
    if (Assets.images.bg) {
        ctx.drawImage(Assets.images.bg, 0, 0, canvas.width, canvas.height);
    }
    
    // Ground Line
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 500, 800, 100);
    
    if (gameState === 'PLAY' || gameState === 'TRANSITION' || gameState === 'GAMEOVER') {
        player.draw(ctx, Assets);
        bossManager.draw(ctx, Assets);
        projectiles.draw(ctx);
    }
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap dt to avoid large physics steps
    lastTime = timestamp;
    
    if (gameState === 'START') {
        if (input.jump) resetGame();
    } else if (gameState === 'GAMEOVER') {
        if (input.jump) resetGame();
    } else if (gameState === 'TRANSITION') {
        if (input.jump) {
            let hasNext = bossManager.startNextBoss();
            if (hasNext) {
                gameState = 'PLAY';
                document.getElementById('victory-screen').classList.add('hidden');
                projectiles.projectiles = []; // clear old bullets
            } else {
                document.getElementById('victory-screen').innerHTML = '<h1>YOU DEFEATED EVERYONE!</h1><p>Refresh to play again</p>';
            }
        }
    }
    
    update(dt);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Start loading assets
Assets.init(() => {
    requestAnimationFrame(gameLoop);
});
