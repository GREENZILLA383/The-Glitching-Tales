class BossManager {
    constructor() {
        this.bosses = [
            { id: 'mario', name: 'The Plumber', hp: 50, maxHp: 50, image: 'mario', behavior: this.marioBehavior.bind(this) },
            { id: 'gw', name: 'The Flat Terror', hp: 60, maxHp: 60, image: 'gw', behavior: this.gwBehavior.bind(this) },
            { id: 'steve', name: 'The Block Builder', hp: 70, maxHp: 70, image: 'steve', behavior: this.steveBehavior.bind(this) },
            { id: 'dk', name: 'The Ape Titan', hp: 90, maxHp: 90, image: 'dk', behavior: this.dkBehavior.bind(this) },
            { id: 'kirby', name: 'The Pink Devourer', hp: 100, maxHp: 100, image: 'kirby', behavior: this.kirbyBehavior.bind(this) }
        ];
        this.currentBossIndex = 0;
        this.currentBoss = null;
        
        this.x = 600;
        this.y = 200;
        this.width = 120;
        this.height = 150;
        this.vy = 0;
        this.vx = 0;
        
        this.stateTimer = 0;
        this.state = 0;
        
        // Visual hit feedback
        this.flashTimer = 0;
    }
    
    startNextBoss() {
        if (this.currentBossIndex < this.bosses.length) {
            this.currentBoss = this.bosses[this.currentBossIndex];
            this.x = 600;
            this.y = 350;
            this.state = 0;
            this.stateTimer = 0;
            document.getElementById('health-bar-container').style.display = 'block';
            this.updateHealthBar();
            return true;
        }
        return false; // all bosses defeated
    }
    
    takeDamage() {
        if (!this.currentBoss) return;
        this.currentBoss.hp--;
        this.flashTimer = 0.1;
        this.updateHealthBar();
        
        if (this.currentBoss.hp <= 0) {
            this.currentBossIndex++;
            this.currentBoss = null;
            document.getElementById('health-bar-container').style.display = 'none';
        }
    }
    
    updateHealthBar() {
        if (this.currentBoss) {
            let pct = (this.currentBoss.hp / this.currentBoss.maxHp) * 100;
            document.getElementById('health-bar').style.width = pct + '%';
        }
    }
    
    update(dt, player, projectiles) {
        if (!this.currentBoss) return;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        
        this.stateTimer += dt;
        
        // Execute boss-specific behavior
        this.currentBoss.behavior(dt, player, projectiles);
        
        // Apply physics to boss
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Keep in bounds
        if (this.x < 50) this.x = 50;
        if (this.x > 800 - this.width) this.x = 800 - this.width;
        if (this.y < 50) this.y = 50;
        if (this.y > 500 - this.height) this.y = 500 - this.height;
    }
    
    draw(ctx, assets) {
        if (!this.currentBoss) return;
        
        ctx.save();
        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5; // simple flash effect
        }
        
        let img = assets.images[this.currentBoss.image];
        if (img) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
    
    // ======== BOSS BEHAVIORS ========
    
    marioBehavior(dt, player, projectiles) {
        // Jump and throw fireballs
        if (this.stateTimer > 2) {
            this.stateTimer = 0;
            // shoot fireball
            projectiles.spawn(this.x, this.y + this.height/2, -300, 200, '#ff4400', 10, false);
            // jump
            this.vy = -600;
        }
        this.vy += 1500 * dt; // gravity
        if (this.y > 500 - this.height) this.y = 500 - this.height;
    }
    
    gwBehavior(dt, player, projectiles) {
        // Teleporting and throwing multiple items
        if (this.stateTimer > 1.5) {
            this.stateTimer = 0;
            this.x = 400 + Math.random() * 300;
            this.y = 100 + Math.random() * 250;
            
            projectiles.spawn(this.x, this.y + 50, -250, 0, '#111', 12, false);
            projectiles.spawn(this.x, this.y + 50, -250, -100, '#111', 12, false);
        }
    }
    
    steveBehavior(dt, player, projectiles) {
        // Slowly advance and drop blocks from sky
        this.vx = -30;
        if (this.stateTimer > 1) {
            this.stateTimer = 0;
            let dropX = player.x + (Math.random() * 200 - 100);
            projectiles.spawn(dropX, 0, 0, 400, '#8b5a2b', 20, false); // falling block
        }
    }
    
    dkBehavior(dt, player, projectiles) {
        // Throws fast barrels
        if (this.stateTimer > 1.2) {
            this.stateTimer = 0;
            // jump slightly
            this.vy = -400;
            projectiles.spawn(this.x, 500 - 20, -400, 0, '#654321', 20, false); // barrel
        }
        this.vy += 1500 * dt;
        if (this.y > 500 - this.height) {
            this.y = 500 - this.height;
            this.vy = 0;
        }
    }
    
    kirbyBehavior(dt, player, projectiles) {
        // Floats around, sucks player, shoots stars
        this.y = 100 + Math.sin(Date.now() / 500) * 100;
        
        if (this.stateTimer > 3) {
            this.stateTimer = 0;
            // shoot spread stars
            for(let i=0; i<5; i++){
                projectiles.spawn(this.x, this.y + this.height/2, -300, -200 + i*100, '#ffff00', 15, false);
            }
        } else if (this.stateTimer > 1 && this.stateTimer < 2) {
            // Sucking wind - pull player
            player.x += 100 * dt;
        }
    }
}
