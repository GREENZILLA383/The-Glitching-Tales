class Player {
    constructor() {
        this.width = 60;
        this.height = 80;
        this.x = 100;
        this.y = 500 - this.height;
        this.vx = 0;
        this.vy = 0;
        this.speed = 300;
        this.jumpForce = -700;
        this.gravity = 1800;
        this.groundY = 500;
        
        this.hp = 3;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashSpeed = 800;
        this.facingRight = true;
        
        this.shootTimer = 0;
        this.invulnerableTimer = 0;
    }
    
    update(dt, input, projectiles) {
        // Timers
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.shootTimer > 0) this.shootTimer -= dt;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
        
        if (this.isDashing) {
            this.dashTimer -= dt;
            this.vx = this.facingRight ? this.dashSpeed : -this.dashSpeed;
            this.vy = 0;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            // Horizontal Movement
            this.vx = 0;
            if (input.left) { this.vx = -this.speed; this.facingRight = false; }
            if (input.right) { this.vx = this.speed; this.facingRight = true; }
            
            // Jump
            if (input.jump && this.y >= this.groundY - this.height) {
                this.vy = this.jumpForce;
            }
            
            // Gravity
            this.vy += this.gravity * dt;
        }
        
        // Dash Initiation
        if (input.dash && this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = 0.2;
            this.dashCooldown = 1.0;
        }
        
        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Boundaries
        if (this.y > this.groundY - this.height) {
            this.y = this.groundY - this.height;
            this.vy = 0;
        }
        if (this.x < 0) this.x = 0;
        if (this.x > 800 - this.width) this.x = 800 - this.width;
        
        // Shooting
        if (input.shoot && this.shootTimer <= 0 && !this.isDashing) {
            this.shootTimer = 0.15;
            let pvx = this.facingRight ? 800 : -800;
            projectiles.spawn(
                this.facingRight ? this.x + this.width : this.x,
                this.y + this.height/2,
                pvx, 0, '#00ffff', 6, true
            );
        }
    }
    
    takeDamage() {
        if (this.invulnerableTimer > 0 || this.isDashing) return false;
        this.hp -= 1;
        this.invulnerableTimer = 1.5;
        document.getElementById('player-health').innerText = 'HP: ' + this.hp;
        return true;
    }
    
    draw(ctx, assets) {
        if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 10) % 2 === 0) {
            return; // flicker
        }
        
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        if (!this.facingRight) ctx.scale(-1, 1);
        
        // Draw image keeping aspect ratio within width/height bounds
        // the generated images might be square, so we draw a slice or scale it
        ctx.drawImage(assets.images.player, -this.width/2 - 20, -this.height/2 - 10, this.width + 40, this.height + 20);
        ctx.restore();
    }
}
