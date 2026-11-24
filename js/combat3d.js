// Real-time action combat. No turn menus - the player attacks directly in the open
// world, enemies act on their own timers, and Oblongtalo's fight is a dedicated
// two-phase dodge gauntlet (see runOblongtaloGauntlet).

const SKILL_MATCH_MULTIPLIER = 1.5;
const MELEE_RANGE = 4.5;
const PROJECTILE_RANGE = 40;
const PROJECTILE_SPEED = 26;
const ATTACK_COOLDOWN = 0.5;
const PLAYER_HIT_INVINCIBILITY = 1.0;
// Aim help for spells/arrows: snap toward an enemy roughly in front, gently curve toward it,
// and use a forgiving hit radius so near-misses still connect.
const AIM_ASSIST_HALF_ANGLE = 0.6;   // ~34 degrees cone in front of the player
const PROJECTILE_HIT_RADIUS = 3;
const HOMING_RATE = 4;

class CombatSystem {
    constructor() {
        this.projectiles = []; // {mesh, dir, traveled, skillType, power}
        this.gauntlet = null;  // active Oblongtalo gauntlet state, or null
        this.attackCooldownUntil = 0;
        this.fx = [];      // short-lived visual effects (telegraphs, shockwaves, poofs)
        this.timers = [];  // { t, fn } - things that happen a moment from now (so they respect pausing)
        this.sparks = [];  // fire-fish sparks flying toward the player
    }

    // Run `fn` after `sec` seconds of game time.
    later(sec, fn) { this.timers.push({ t: sec, fn }); }

    // --- Player attacking ------------------------------------------------

    performPlayerAttack() {
        const player = window.gameSystem.party[0];
        if (!player || player.hp <= 0) return;
        const inCore = window.GravityCore && GravityCore.active;
        if ((window.gameSystem.state !== 'overworld' && !(inCore && window.gameSystem.state === 'core')) || window.gameSystem.isCutscene) return;
        const now = performance.now() / 1000;
        if (now < this.attackCooldownUntil) return;
        this.attackCooldownUntil = now + ATTACK_COOLDOWN;

        const weapon = player.equippedWeapon;
        if (!weapon) return;

        if (weapon.mpCost) {
            if (player.mp < weapon.mpCost) {
                window.gameSystem.showDialogue('System', 'Not enough MP!');
                this.attackCooldownUntil = now; // don't waste the cooldown on a failed cast
                return;
            }
            player.mp -= weapon.mpCost;
        }

        if (weapon.durability !== null && weapon.durability !== undefined) {
            weapon.durability -= 1;
            if (weapon.durability <= 0) {
                window.gameSystem.showDialogue('System', `Your ${weapon.name} broke!`);
                player.equippedWeapon = player.defaultWeapon;
            }
        }

        const forward = new THREE.Vector3();
        overworld3d.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();

        // Turn to face where you're attacking and play the matching swing / draw / cast animation.
        const style = (weapon.playStyle === 'range' || weapon.playStyle === 'magick') ? weapon.playStyle : 'melee';
        overworld3d.faceYawTarget = Math.atan2(forward.x, forward.z);
        overworld3d.faceHoldUntil = now + 0.5;
        Animations.attack(overworld3d.playerObj, style);
        Sound.play(style === 'melee' ? 'swing' : style === 'range' ? 'bow' : 'spell');
        if (inCore) GravityCore.playerAttackStarted();

        // The blow / shot lands at the moment the animation reaches its strike point.
        this.later(Animations.ATTACKS[style].strike, () => {
            if (inCore) { GravityCore.strike(style, weapon); return; }   // (on the Gravity Core the planet's own code aims it)
            if (style === 'melee') {
                this.meleeSwing(forward, weapon);
            } else {
                const origin = overworld3d.playerObj.position.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(forward, 1.2);
                const aim = this.acquireAimTarget(overworld3d.playerObj.position, forward);
                this.spawnProjectile(origin, aim ? aim.dir : forward, weapon, aim ? aim.ent : null);
            }
        });
        window.gameSystem.updateHUD();
    }

    // If an enemy is roughly in front, return a heading straight at it (aim assist).
    acquireAimTarget(fromPos, forward) {
        const t = this.findNearestTargetInCone(fromPos, forward, PROJECTILE_RANGE, AIM_ASSIST_HALF_ANGLE);
        if (!t) return null;
        const dir = new THREE.Vector3(t.ent.mesh.position.x - fromPos.x, 0, t.ent.mesh.position.z - fromPos.z).normalize();
        return { ent: t.ent, dir };
    }

    meleeSwing(forward, weapon) {
        const playerPos = overworld3d.playerObj.position;
        const target = this.findNearestTargetInCone(playerPos, forward, MELEE_RANGE, Math.PI / 2.5);
        if (target) {
            const power = this.computePower(weapon, target.ent);
            this.damageEntity(target.ent, power);
        }
    }

    spawnProjectile(origin, dir, weapon, homingTarget = null) {
        const geo = new THREE.SphereGeometry(0.4, 8, 8);
        const color = weapon.projColor || (weapon.playStyle === 'magick' ? 0x8fd6ff : 0xffe066);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(origin);
        overworld3d.scene.add(mesh);
        this.projectiles.push({ mesh, dir: dir.clone(), traveled: 0, weapon, homingTarget });
    }

    findNearestTargetInCone(fromPos, forward, range, halfAngle) {
        let best = null, bestDist = Infinity;
        for (const ent of overworld3d.entities) {
            if (ent.type !== 'enemy' && ent.type !== 'boss') continue;
            if (ent.data.hp <= 0) continue;
            const toEnt = new THREE.Vector3(ent.mesh.position.x - fromPos.x, 0, ent.mesh.position.z - fromPos.z);
            const dist = toEnt.length();
            if (dist > range) continue;
            toEnt.normalize();
            const angle = Math.acos(THREE.MathUtils.clamp(forward.dot(toEnt), -1, 1));
            if (angle > halfAngle) continue;
            if (dist < bestDist) { bestDist = dist; best = { ent, dist }; }
        }
        return best;
    }

    findNearestTargetInRadius(fromPos, radius) {
        let best = null, bestDist = Infinity;
        for (const ent of overworld3d.entities) {
            if (ent.type !== 'enemy' && ent.type !== 'boss') continue;
            if (ent.data.hp <= 0) continue;
            const dist = fromPos.distanceTo(new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z));
            if (dist < radius && dist < bestDist) { bestDist = dist; best = ent; }
        }
        return best;
    }

    computePower(weapon, targetEnt) {
        let power = weapon.power || 10;
        if (weapon.skillType && weapon.skillType === window.gameSystem.party[0].skillType) {
            power *= SKILL_MATCH_MULTIPLIER;
        }
        return power;
    }

    damageEntity(ent, amount) {
        ent.data.hp = Math.max(0, ent.data.hp - amount);
        this.flashHit(ent.mesh);
        if (ent.data.hp <= 0) {
            this.killEntity(ent);
        } else {
            Sound.play('hit');
            Animations.hurt(ent.mesh);
            if (ent.aiState) ent.aiState.revealUntil = performance.now() / 1000 + 3;   // a hit snake gives up its camouflage
            // Knockback: regular enemies get shoved away from the player (the boss is too heavy)
            if (ent.type === 'enemy' && overworld3d.playerObj) {
                const p = overworld3d.playerObj.position, m = ent.mesh.position;
                const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz) || 1;
                const nx = m.x + (dx / d) * 1.3, nz = m.z + (dz / d) * 1.3;
                if (!overworld3d.isBlocked(nx, nz, 1.2)) { m.x = nx; m.z = nz; }
            }
        }
    }

    flashHit(mesh, color = 0xff3333) {
        mesh.traverse(c => {
            if (c.isMesh && c.material && c.material.emissive) {
                const orig = c.material.emissive.getHex();
                c.material.emissive.setHex(color);
                setTimeout(() => { if (c.material) c.material.emissive.setHex(orig); }, 120);
            }
        });
    }

    killEntity(ent) {
        // The creature topples over and fades out (see Overworld3D.updateCorpses) instead of vanishing.
        overworld3d.addCorpse(ent.mesh, ent.type === 'boss');
        Sound.play('kill');
        if (ent.type === 'boss') Sound.play('fanfare');
        const idx = overworld3d.entities.indexOf(ent);
        if (idx >= 0) overworld3d.entities.splice(idx, 1);

        const player = window.gameSystem.party[0];
        player.exp += ent.data.xpReward || 0;
        while (player.exp >= player.expToNext) {
            player.exp -= player.expToNext;
            player.level += 1;
            player.expToNext = Math.round(player.expToNext * 1.3);
            player.maxHp += 10;
            player.hp = player.maxHp;
            Sound.play('levelup');
            window.gameSystem.showDialogue('System', `Level up! You are now level ${player.level}.`);
        }

        if (ent.type === 'boss' && ent.bossId === 'croton') {
            window.gameSystem.onCrotonDefeated();
        }
        if (overworld3d.tryOpenGates) overworld3d.tryOpenGates(); // open temple gates when a room clears
        window.gameSystem.updateHUD();
    }

    // --- Player taking damage --------------------------------------------

    // `kind` 'fire' also sets the player alight (a few small burn ticks after the hit).
    damagePlayer(amount, kind = null) {
        if (window.gameSystem.godMode) return;          // the Settings "Invincible" switch (and the Test Bot's safety net)
        const player = window.gameSystem.party[0];
        const now = performance.now() / 1000;
        if (now < (player.invincibleUntil || 0)) return;
        player.invincibleUntil = now + PLAYER_HIT_INVINCIBILITY;
        player.hp = Math.max(0, player.hp - amount);
        window.gameSystem.updateHUD();
        this.flashHit(overworld3d.playerObj, kind === 'fire' ? 0xff8a1a : kind === 'poison' ? 0x6bff2a : 0xff3333);
        if ((kind === 'fire' || kind === 'poison') && player.hp > 0) this.applyAilment(kind, amount);
        this.checkPlayerDown(player);
    }

    checkPlayerDown(player) {
        if (player.hp <= 0) {
            player.burn = null; this.setAilmentHud(null);
            Sound.play('die');
            Animations.die(overworld3d.playerObj);
            window.gameSystem.onPlayerDefeated();
        } else {
            Sound.play('hurt');
            Animations.hurt(overworld3d.playerObj);
        }
    }

    // --- Status ailments: burning (fire fish) and poison (dune vipers) ------------------------------
    // Both tick a little damage after the hit. Poison lasts a tick longer and hurts more per tick.
    applyAilment(kind, hitAmount) {
        const player = window.gameSystem.party[0];
        const cfg = kind === 'poison' ? { ticks: 4, frac: 0.3, gap: 0.9 } : { ticks: 3, frac: 0.22, gap: 0.8 };
        player.burn = { kind, ticks: cfg.ticks, gap: cfg.gap, next: performance.now() / 1000 + cfg.gap, dmg: Math.max(1, Math.round(hitAmount * cfg.frac)) };
        this.setAilmentHud(kind);
    }

    setAilmentHud(kind) {
        const hud = document.getElementById('player-hud');
        if (!hud) return;
        hud.classList.toggle('burning', kind === 'fire');
        hud.classList.toggle('poisoned', kind === 'poison');
    }
    setBurnHud(on) { this.setAilmentHud(on ? 'fire' : null); }

    updateBurn() {
        const player = window.gameSystem.party[0];
        if (!player || !player.burn) return;
        const now = performance.now() / 1000, b = player.burn;
        if (now < b.next) return;
        b.next = now + b.gap; b.ticks--;
        player.hp = Math.max(0, player.hp - b.dmg);   // ailment ticks ignore the invincibility window
        window.gameSystem.updateHUD();
        this.flashHit(overworld3d.playerObj, b.kind === 'poison' ? 0x6bff2a : 0xff8a1a);
        Sound.play('hurt');
        if (b.ticks <= 0) { player.burn = null; this.setAilmentHud(null); }
        if (player.hp <= 0) this.checkPlayerDown(player);
    }

    // --- Things enemies throw or shoot at you -------------------------------------------------------
    // type 'fire'   : fire fish sparks, fly straight, set you on fire
    // type 'poison' : viper venom, arcs through the air under gravity, splashes where it lands, poisons you
    // type 'needle' : Scortus' cactus needle, flies straight and fast
    spawnShot(type, origin, vel, damage) {
        const g = new THREE.Group();
        let shell = null;
        if (type === 'fire') {
            g.add(shell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })));
        } else if (type === 'poison') {
            g.add(shell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 9), new THREE.MeshBasicMaterial({ color: 0x57d61a, transparent: true, opacity: 0.6, depthWrite: false })));
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc8ff7a })));
        } else {
            const needle = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.6, 7), new THREE.MeshBasicMaterial({ color: 0xf6efc4 }));
            needle.rotation.x = Math.PI / 2;          // point along +z, then aim the whole group
            g.add(needle);
        }
        g.position.copy(origin);
        overworld3d.scene.add(g);
        this.sparks.push({ type, mesh: g, shell, vel: vel.clone(), life: type === 'needle' ? 1.4 : 3.2, damage });
    }

    // Fire fish sparks (kept for the fish AI)
    spawnSpark(origin, dir, damage) { this.spawnShot('fire', origin, dir.clone().multiplyScalar(22), damage); }

    // Lob venom from `from` so that it comes down on `to` (a simple ballistic arc).
    lobPoison(from, to, damage) {
        const G = 28, dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
        const horiz = Math.hypot(dx, dz), T = THREE.MathUtils.clamp(horiz / 24, 0.55, 1.5);
        this.spawnShot('poison', from, new THREE.Vector3(dx / T, (dy + 0.5 * G * T * T) / T, dz / T), damage);
    }

    updateSparks(delta) {
        const player = window.gameSystem.party[0], pp = overworld3d.playerObj ? overworld3d.playerObj.position : null;
        const GRAV = 28;
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.life -= delta;
            if (s.type === 'poison') s.vel.y -= GRAV * delta;                // venom falls like a thrown thing
            s.mesh.position.addScaledVector(s.vel, delta);
            if (s.type === 'needle') s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
            else if (s.shell) s.shell.scale.setScalar(1 + Math.sin(performance.now() * 0.03 + i) * 0.18);
            const kind = s.type === 'poison' ? 'poison' : s.type === 'fire' ? 'fire' : null;
            let hit = false, landed = false;
            if (pp && player && player.hp > 0) {
                const dx = s.mesh.position.x - pp.x, dz = s.mesh.position.z - pp.z, dy = s.mesh.position.y - (pp.y + 2.4);
                const r = s.type === 'needle' ? 2.0 : 2.6;
                if (dx * dx + dz * dz + dy * dy < r * r) { this.damagePlayer(s.damage, kind); hit = true; }
            }
            const gh = overworld3d.groundHeight(s.mesh.position.x, s.mesh.position.z);
            if (!hit && s.mesh.position.y < gh + 0.3 && s.type !== 'needle') {   // came down on the ground
                landed = true;
                if (s.type === 'poison' && pp && player && player.hp > 0 && Math.hypot(s.mesh.position.x - pp.x, s.mesh.position.z - pp.z) < 3.4 && pp.y < gh + 2.5) { this.damagePlayer(s.damage, 'poison'); hit = true; } // splash
            }
            const done = hit || landed || s.life <= 0 || (s.type === 'needle' && s.mesh.position.y < gh + 0.1);
            if (done) {
                if (s.type === 'poison') { this.spawnPuddle(s.mesh.position.x, s.mesh.position.z, gh); Sound.play('splat'); }
                else if (hit || s.life > 0) this.spawnPoof(s.mesh.position.x, Math.max(0.5, s.mesh.position.y), s.mesh.position.z, 0.5);
                overworld3d.scene.remove(s.mesh);
                s.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
                this.sparks.splice(i, 1);
            }
        }
    }

    // A glistening green splash on the sand that fades away.
    spawnPuddle(x, z, gy = 0) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x57d61a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, gy + 0.25, z); mesh.scale.set(0.6, 0.6, 1);
        overworld3d.scene.add(mesh);
        this.fx.push({ kind: 'puddle', mesh, mat, t: 0, dur: 2.2, radius: 3.4 });
    }

    // --- Per-frame update --------------------------------------------------

    update(delta) {
        // Delayed actions (a sword blow landing mid-swing, an enemy's strike after its wind-up)
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const tm = this.timers[i];
            tm.t -= delta;
            if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
        }
        this.updateFx(delta);
        this.updateProjectiles(delta);
        this.updateSparks(delta);
        this.updateBurn();
        if (window.gameSystem.state === 'overworld') {
            this.updateEnemyAI(delta);
        }
        if (this.gauntlet && window.gameSystem.state === 'gauntlet') {
            this.updateGauntlet(delta);
        }
        this.updateBossHUD();
    }

    // --- Visual effects: ground warnings, shockwaves, death poofs ----------------

    // A red danger zone on the ground that fills in while an enemy winds up, so you can step out of it.
    spawnTelegraph(x, z, radius, dur, color = 0xff3b2a) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 44), mat);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.3, z); mesh.scale.set(radius, radius, 1);
        overworld3d.scene.add(mesh);
        this.fx.push({ kind: 'tele', mesh, mat, t: 0, dur, radius });
    }

    spawnShock(x, z, radius, color = 0x8fe0ff, silent = false) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), mat);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.35, z); mesh.scale.set(0.2, 0.2, 1);
        overworld3d.scene.add(mesh);
        if (!silent) Sound.play('slam');
        this.fx.push({ kind: 'shock', mesh, mat, t: 0, dur: 0.5, radius });
    }

    // A little cloud of puffs when a creature disappears.
    spawnPoof(x, y, z, size = 1) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.85, depthWrite: false });
        const g = new THREE.Group();
        const puffs = [];
        for (let i = 0; i < 9; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.35 * size, 8, 6), mat);
            const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, up = Math.random();
            puffs.push({ m, dx: Math.cos(a) * (1.2 + Math.random()) * size, dz: Math.sin(a) * (1.2 + Math.random()) * size, dy: (0.4 + up * 1.6) * size });
            g.add(m);
        }
        g.position.set(x, y, z);
        overworld3d.scene.add(g);
        this.fx.push({ kind: 'poof', mesh: g, mat, puffs, t: 0, dur: 0.55 });
    }

    updateFx(delta) {
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.t += delta;
            const p = Math.min(1, f.t / f.dur);
            if (f.kind === 'tele') {
                f.mat.opacity = 0.1 + 0.3 * p + Math.sin(f.t * 16) * 0.05;       // fills in and flickers as the blow nears
                const s = f.radius * (0.55 + 0.45 * p); f.mesh.scale.set(s, s, 1);
            } else if (f.kind === 'puddle') {
                const s = f.radius * (0.4 + 0.6 * Math.min(1, p * 4)); f.mesh.scale.set(s, s, 1); f.mat.opacity = 0.6 * (1 - p * p);
            } else if (f.kind === 'shock') {
                const s = f.radius * (0.2 + 0.8 * p); f.mesh.scale.set(s, s, 1); f.mat.opacity = 0.9 * (1 - p);
            } else if (f.kind === 'poof') {
                f.puffs.forEach(q => { q.m.position.set(q.dx * p, q.dy * p, q.dz * p); q.m.scale.setScalar(1 + p * 1.2); });
                f.mat.opacity = 0.85 * (1 - p);
            }
            if (f.t >= f.dur) {
                overworld3d.scene.remove(f.mesh);
                f.mat.dispose();
                f.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
                this.fx.splice(i, 1);
            }
        }
    }

    updateBossHUD() {
        const container = document.getElementById('boss-health-container');
        if (!container) return;
        if (window.GravityCore && GravityCore.active) return;   // the Gravity Core shows its own boss bar
        const croton = overworld3d.entities.find(e => e.bossId === 'croton');
        if (!croton) { container.classList.add('hidden'); return; }
        const playerPos = overworld3d.playerObj ? overworld3d.playerObj.position : null;
        const dist = playerPos ? playerPos.distanceTo(croton.mesh.position) : Infinity;
        if (dist > 60) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');
        const fill = document.getElementById('boss-health-fill');
        if (fill) fill.style.width = `${Math.max(0, (croton.data.hp / croton.data.maxHp) * 100)}%`;
    }

    updateProjectiles(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            // Gently curve toward the locked-on enemy so near-misses still land.
            if (p.homingTarget && p.homingTarget.data.hp > 0) {
                const desired = new THREE.Vector3(
                    p.homingTarget.mesh.position.x - p.mesh.position.x, 0,
                    p.homingTarget.mesh.position.z - p.mesh.position.z);
                if (desired.lengthSq() > 0.0001) {
                    desired.normalize();
                    p.dir.lerp(desired, Math.min(1, HOMING_RATE * delta)).normalize();
                }
            }

            const step = PROJECTILE_SPEED * delta;
            p.mesh.position.addScaledVector(p.dir, step);
            p.traveled += step;

            const hitEnt = this.findNearestTargetInRadius(p.mesh.position, PROJECTILE_HIT_RADIUS);
            if (hitEnt) {
                this.damageEntity(hitEnt, this.computePower(p.weapon, hitEnt));
                if (p.weapon.playStyle === 'magick' && hitEnt.data.hp > 0) {
                    const base = 1, boosted = 2;
                    const matched = p.weapon.skillType === window.gameSystem.party[0].skillType;
                    hitEnt.aiState = hitEnt.aiState || {};
                    hitEnt.aiState.slowedUntil = (performance.now() / 1000) + (matched ? boosted : base);
                }
                overworld3d.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }
            if (p.traveled > PROJECTILE_RANGE) {
                overworld3d.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    updateEnemyAI(delta) {
        const player = window.gameSystem.party[0];
        if (!player || player.hp <= 0 || !overworld3d.playerObj) return;
        const playerPos = new THREE.Vector3(overworld3d.playerObj.position.x, 0, overworld3d.playerObj.position.z);

        for (const ent of overworld3d.entities) {
            if (ent.type !== 'enemy' && ent.type !== 'boss') continue;
            const isCroton = ent.bossId === 'croton';
            const entPos = new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z);
            const dist = playerPos.distanceTo(entPos);
            const now = performance.now() / 1000;
            const slowed = ent.aiState && ent.aiState.slowedUntil && now < ent.aiState.slowedUntil;

            const kind = ent.data.ai || (isCroton ? 'croton' : 'crab');
            const aggroDist = ent.data.aggroDist || (isCroton ? 45 : 22);
            const meleeRange = kind === 'eel' ? 7 : kind === 'scortus' ? 6.5 : isCroton ? 6 : 2.5;
            const nowS = performance.now() / 1000;
            const ai = ent.aiState;
            ai.cooldown = (ai.cooldown || 0) - delta;
            const mp = ent.mesh.position;

            // Mid-attack: stand still through the wind-up, then land the blow at the strike moment.
            // Because the hit comes a beat after the warning, a quick player can step out of the way.
            if (ai.windup) {
                const w = ai.windup, k = Animations.ATTACKS[w.kind];
                w.t += delta;
                if (!w.hit && w.t >= k.strike) {
                    w.hit = true;
                    if (w.kind === 'spit') {
                        // three sparks in a small fan, aimed at where the player is right now
                        const from = new THREE.Vector3(mp.x, mp.y + 1.6, mp.z);
                        const to = new THREE.Vector3(overworld3d.playerObj.position.x, overworld3d.playerObj.position.y + 2.2, overworld3d.playerObj.position.z);
                        const base = to.sub(from).normalize();
                        const fwd = new THREE.Vector3(Math.sin(ent.mesh.rotation.y), 0, Math.cos(ent.mesh.rotation.y));
                        from.addScaledVector(fwd, 2.0);
                        [-0.2, 0, 0.2].forEach(a => {
                            const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
                            this.spawnSpark(from, d, ent.data.attack * 0.7);
                        });
                        Sound.play('flame');
                    } else if (w.kind === 'venom') {
                        // a glob of poison, lobbed in an arc to where the player is standing right now
                        const fwd = new THREE.Vector3(Math.sin(ent.mesh.rotation.y), 0, Math.cos(ent.mesh.rotation.y));
                        const from = new THREE.Vector3(mp.x, mp.y + 1.5, mp.z).addScaledVector(fwd, 1.6);
                        const pp2 = overworld3d.playerObj.position;
                        this.lobPoison(from, new THREE.Vector3(pp2.x, pp2.y + 1.2, pp2.z), ent.data.attack * 0.75);
                        Sound.play('venom');
                    } else if (w.kind === 'needle') {
                        // two long needles from the tail tip, a beat apart
                        const shoot = () => {
                            if (!overworld3d.playerObj || ent.data.hp <= 0) return;
                            const f2 = new THREE.Vector3(Math.sin(ent.mesh.rotation.y), 0, Math.cos(ent.mesh.rotation.y));
                            const from = new THREE.Vector3(mp.x, mp.y + 5.0, mp.z).addScaledVector(f2, 1.2);
                            const pp2 = overworld3d.playerObj.position;
                            const dir = new THREE.Vector3(pp2.x, pp2.y + 2.2, pp2.z).sub(from).normalize();
                            this.spawnShot('needle', from, dir.multiplyScalar(40), ent.data.attack * 0.85);
                            Sound.play('needle');
                        };
                        shoot(); this.later(0.22, shoot);
                    } else {
                        const reach = w.kind === 'wave' ? 16 : w.kind === 'zap' ? 8.5 : meleeRange + (isCroton ? 3 : 1.4);
                        if (w.kind === 'wave') this.spawnShock(mp.x, mp.z, 16);
                        if (w.kind === 'zap') { this.spawnShock(mp.x, mp.z, 8.5, 0xfff07a, true); Sound.play('zap'); }
                        if (dist < reach) this.damagePlayer(ent.data.attack * (w.kind === 'pinch' ? 0.6 : w.kind === 'wave' ? 0.6 : w.kind === 'zap' ? 0.9 : 0.8));
                    }
                }
                if (w.t >= k.dur) ai.windup = null;
                continue;
            }

            // Walk toward the player, but never through walls/gates: try the full move, else slide along one axis.
            const step = (nx, nz, half) => {
                if (!overworld3d.isBlocked(nx, nz, half)) { mp.x = nx; mp.z = nz; }
                else if (!overworld3d.isBlocked(nx, mp.z, half)) mp.x = nx;
                else if (!overworld3d.isBlocked(mp.x, nz, half)) mp.z = nz;
            };
            if (dist < aggroDist && !slowed) {
                const dir = new THREE.Vector3().subVectors(playerPos, entPos).normalize();
                if (kind === 'firefish') {
                    // Fire fish keep their distance: close in if you're far, back off if you're near, drift sideways in between.
                    ai.strafeT = (ai.strafeT || 0) - delta;
                    if (ai.strafeT <= 0 || !ai.strafe) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 2 + Math.random() * 2.5; }
                    const sp = (ent.data.speed || 12) * delta;
                    if (dist > 22) step(mp.x + dir.x * sp, mp.z + dir.z * sp, 1.3);
                    else if (dist < 12) step(mp.x - dir.x * sp, mp.z - dir.z * sp, 1.3);
                    else step(mp.x - dir.z * ai.strafe * sp * 0.55, mp.z + dir.x * ai.strafe * sp * 0.55, 1.3);
                } else if (kind === 'snake') {
                    // Vipers lie in ambush (camouflaged), then back away to keep their distance while they spit.
                    if (dist < 10) ai.revealUntil = nowS + 1.0;
                    ai.strafeT = (ai.strafeT || 0) - delta;
                    if (ai.strafeT <= 0 || !ai.strafe) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 1.5 + Math.random() * 2; }
                    const sp = (ent.data.speed || 9) * delta;
                    if (dist > 24) step(mp.x + dir.x * sp * 0.5, mp.z + dir.z * sp * 0.5, 1.3);
                    else if (dist < 11) step(mp.x - dir.x * sp, mp.z - dir.z * sp, 1.3);
                    else step(mp.x - dir.z * ai.strafe * sp * 0.4, mp.z + dir.x * ai.strafe * sp * 0.4, 1.3);
                } else if (kind === 'scortus') {
                    // Scortus marches in to needle range, then holds there (and swings its claws if you get close)
                    const sp = (ent.data.speed || 10) * delta;
                    if (dist > 15) step(mp.x + dir.x * sp, mp.z + dir.z * sp, 2.2);
                    else if (dist > meleeRange + 1) step(mp.x + dir.x * sp * 0.35, mp.z + dir.z * sp * 0.35, 2.2);
                } else if (dist > meleeRange) {
                    const speed = (isCroton ? 3 : ent.data.speed || 3) * delta;
                    step(entPos.x + dir.x * speed, entPos.z + dir.z * speed, kind === 'eel' ? 1.6 : isCroton ? 4 : 1.2);
                }
            }

            if (ai.cooldown > 0) continue;

            // Start an attack: play the wind-up animation now, and the damage lands later.
            const begin = (atk, rest) => {
                ai.windup = { kind: atk, t: 0, hit: false };
                Animations.attack(ent.mesh, atk);
                Sound.play(isCroton ? 'roar' : atk === 'zap' ? 'zapup' : atk === 'venom' ? 'hiss' : 'windup');
                ai.cooldown = Animations.ATTACKS[atk].dur + rest;
                if (atk === 'venom') ai.revealUntil = nowS + Animations.ATTACKS.venom.dur + 1.6;   // a spitting viper can't stay hidden
            };
            if (isCroton) {
                if (dist < meleeRange) begin('claw', 1.1);
                else if (dist < 16) {
                    begin('wave', 1.6);
                    this.spawnTelegraph(mp.x, mp.z, 16, Animations.ATTACKS.wave.strike); // danger zone on the floor
                }
            } else if (kind === 'eel') {
                if (dist < meleeRange) {
                    begin('zap', 1.0);
                    this.spawnTelegraph(mp.x, mp.z, 8.5, Animations.ATTACKS.zap.strike, 0xffe45a); // yellow danger zone
                }
            } else if (kind === 'firefish') {
                if (dist < 34 && dist > 5) begin('spit', 1.5);
            } else if (kind === 'snake') {
                if (dist < 26 && dist > 6) begin('venom', 1.7);
            } else if (kind === 'scortus') {
                if (dist < meleeRange) begin('pinch', 0.9);
                else if (dist < 26) begin('needle', 1.5);
            } else if (dist < meleeRange) {
                begin('pinch', 0.9);
            }
        }
    }

    // --- Oblongtalo's survival gauntlet -------------------------------------

    startOblongtaloGauntlet() {
        const cfg = BOSSES.oblongtalo_ghost.gauntlet;
        this.gauntlet = {
            cfg,
            phase: 1,
            waveIndex: 0,
            chargeIndex: 0,
            state: 'waiting',
            timer: 1.0,
            activeCharges: [],
            arenaCenter: overworld3d.arenaCenter.clone(),
            arenaRadius: 20
        };
        window.gameSystem.state = 'gauntlet';
        overworld3d.spawnOblongtalo();
        window.gameSystem.showDialogue('Oblongtalo', "Let's see if you're strong enough to survive what my kingdom could not.");
    }

    updateGauntlet(delta) {
        const g = this.gauntlet;
        if (!g) return;
        const player = window.gameSystem.party[0];

        // Keep the player roughly inside the arena.
        if (overworld3d.playerObj) {
            const p = overworld3d.playerObj.position;
            const toCenter = new THREE.Vector3(p.x - g.arenaCenter.x, 0, p.z - g.arenaCenter.z);
            if (toCenter.length() > g.arenaRadius) {
                toCenter.setLength(g.arenaRadius);
                p.x = g.arenaCenter.x + toCenter.x;
                p.z = g.arenaCenter.z + toCenter.z;
            }
        }

        g.timer -= delta;
        if (g.state === 'waiting') {
            if (g.timer <= 0) this.spawnGauntletWave();
        } else if (g.state === 'charging') {
            this.advanceCharges(delta);
        }
    }

    spawnGauntletWave() {
        const g = this.gauntlet;
        const cfg = g.cfg;
        const horizontal = Math.random() > 0.5;
        const count = g.phase === 1 ? 2 : 1;
        g.activeCharges = [];

        for (let i = 0; i < count; i++) {
            const parts = g.phase === 1 ? buildChargeGhostParts() : buildOblongtaloGhostParts();
            const mesh = VoxelBuilder.buildCharacter(parts);
            const offset = horizontal ? (i - (count - 1) / 2) * 6 : 0;
            let startPos, dir;
            const R = g.arenaRadius + 5;
            if (horizontal) {
                startPos = new THREE.Vector3(g.arenaCenter.x - R, 0, g.arenaCenter.z + offset);
                dir = new THREE.Vector3(1, 0, 0);
            } else {
                startPos = new THREE.Vector3(g.arenaCenter.x + offset, 0, g.arenaCenter.z - R);
                dir = new THREE.Vector3(0, 0, 1);
            }
            mesh.position.copy(startPos);
            overworld3d.scene.add(mesh);
            g.activeCharges.push({
                mesh, dir,
                speed: g.phase === 1 ? cfg.phase1GhostSpeed : cfg.phase2ChargeSpeed,
                hitRadius: g.phase === 1 ? 2.2 : 4
            });
        }

        g.state = 'charging';
        // In phase 2 Oblongtalo himself is the one charging, so the standing copy leaves the arena (no double).
        if (g.phase === 2 && overworld3d.oblongtaloMesh) overworld3d.oblongtaloMesh.visible = false;
        Sound.play('charge');
        window.gameSystem.updateHUD();
    }

    advanceCharges(delta) {
        const g = this.gauntlet;
        const cfg = g.cfg;
        let anyStillActive = false;
        const playerPos = overworld3d.playerObj ? new THREE.Vector3(overworld3d.playerObj.position.x, 0, overworld3d.playerObj.position.z) : null;

        for (const charge of g.activeCharges) {
            charge.mesh.position.addScaledVector(charge.dir, charge.speed * delta);
            charge.mesh.rotation.y = Math.atan2(charge.dir.x, charge.dir.z); // face the way it's charging
            Animations.update(charge.mesh, delta, { charging: true, baseY: 0 });
            const distFromCenter = charge.mesh.position.distanceTo(g.arenaCenter);
            if (distFromCenter < g.arenaRadius + 8) anyStillActive = true; else continue;

            if (playerPos) {
                const d = new THREE.Vector3(charge.mesh.position.x, 0, charge.mesh.position.z).distanceTo(playerPos);
                if (d < charge.hitRadius) {
                    this.damagePlayer(cfg.hitDamage);
                }
            }
        }

        if (!anyStillActive) {
            g.activeCharges.forEach(c => overworld3d.scene.remove(c.mesh));
            g.activeCharges = [];
            if (g.phase === 1) {
                g.waveIndex++;
                if (g.waveIndex >= cfg.phase1WaveCount) {
                    g.phase = 2;
                    window.gameSystem.showDialogue('System', 'Oblongtalo himself surges forward!');
                }
            } else {
                g.chargeIndex++;
                if (g.chargeIndex >= cfg.phase2ChargeCount) {
                    this.finishGauntlet();
                    return;
                }
            }
            g.state = 'waiting';
            g.timer = 1.4;
        }
    }

    finishGauntlet() {
        this.gauntlet = null;
        if (overworld3d.oblongtaloMesh) {
            overworld3d.scene.remove(overworld3d.oblongtaloMesh);
            overworld3d.oblongtaloMesh = null;
        }
        window.gameSystem.state = 'overworld';
        window.gameSystem.onOblongtaloSurvived();
    }
}

const combatSystem = new CombatSystem();
window.combatSystem = combatSystem;
