class ProjectileManager {
    constructor() {
        this.projectiles = [];
    }
    
    spawn(x, y, vx, vy, color, size, isPlayer) {
        this.projectiles.push({
            x: x, y: y, vx: vx, vy: vy,
            color: color, size: size,
            isPlayer: isPlayer,
            active: true
        });
    }
    
    update(dt) {
        for (let p of this.projectiles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            // Off-screen check
            if (p.x < -100 || p.x > 900 || p.y < -100 || p.y > 700) {
                p.active = false;
            }
        }
        this.projectiles = this.projectiles.filter(p => p.active);
    }
    
    draw(ctx) {
        for (let p of this.projectiles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
