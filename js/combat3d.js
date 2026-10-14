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
    }

    // --- Player attacking ------------------------------------------------

    performPlayerAttack() {
        const player = window.gameSystem.party[0];
        if (!player || player.hp <= 0) return;
        if (window.gameSystem.state !== 'overworld') return;
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

        if (weapon.playStyle === 'range' || weapon.playStyle === 'magick') {
            const origin = overworld3d.playerObj.position.clone().add(new THREE.Vector3(0, 2, 0));
            const aim = this.acquireAimTarget(overworld3d.playerObj.position, forward);
            this.spawnProjectile(origin, aim ? aim.dir : forward, weapon, aim ? aim.ent : null);
        } else {
            this.meleeSwing(forward, weapon);
        }
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
        const color = weapon.playStyle === 'magick' ? 0x8fd6ff : 0xffe066;
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
        }
    }

    flashHit(mesh) {
        mesh.traverse(c => {
            if (c.isMesh && c.material && c.material.emissive) {
                const orig = c.material.emissive.getHex();
                c.material.emissive.setHex(0xff3333);
                setTimeout(() => { if (c.material) c.material.emissive.setHex(orig); }, 120);
            }
        });
    }

    killEntity(ent) {
        overworld3d.scene.remove(ent.mesh);
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
            window.gameSystem.showDialogue('System', `Level up! You are now level ${player.level}.`);
        }

        if (ent.type === 'boss' && ent.bossId === 'croton') {
            window.gameSystem.onCrotonDefeated();
        }
        if (overworld3d.tryOpenGates) overworld3d.tryOpenGates(); // open temple gates when a room clears
        window.gameSystem.updateHUD();
    }

    // --- Player taking damage --------------------------------------------

    damagePlayer(amount) {
        const player = window.gameSystem.party[0];
        const now = performance.now() / 1000;
        if (now < (player.invincibleUntil || 0)) return;
        player.invincibleUntil = now + PLAYER_HIT_INVINCIBILITY;
        player.hp = Math.max(0, player.hp - amount);
        window.gameSystem.updateHUD();
        if (player.hp <= 0) {
            window.gameSystem.onPlayerDefeated();
        }
    }

    // --- Per-frame update --------------------------------------------------

    update(delta) {
        this.updateProjectiles(delta);
        if (window.gameSystem.state === 'overworld') {
            this.updateEnemyAI(delta);
        }
        if (this.gauntlet && window.gameSystem.state === 'gauntlet') {
            this.updateGauntlet(delta);
        }
        this.updateBossHUD();
    }

    updateBossHUD() {
        const container = document.getElementById('boss-health-container');
        if (!container) return;
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

            const aggroDist = isCroton ? 45 : 22;
            const meleeRange = isCroton ? 6 : 2.5;

            if (dist < aggroDist && !slowed) {
                const speed = (isCroton ? 3 : ent.data.speed || 3) * delta;
                if (dist > meleeRange) {
                    const dir = new THREE.Vector3().subVectors(playerPos, entPos).normalize();
                    const half = isCroton ? 4 : 1.2; // enemy footprint for wall collision
                    const nx = entPos.x + dir.x * speed, nz = entPos.z + dir.z * speed;
                    // Move, but don't walk through walls/gates: try full move, else slide along one axis.
                    if (!overworld3d.isBlocked(nx, nz, half)) {
                        ent.mesh.position.x = nx; ent.mesh.position.z = nz;
                    } else if (!overworld3d.isBlocked(nx, entPos.z, half)) {
                        ent.mesh.position.x = nx;
                    } else if (!overworld3d.isBlocked(entPos.x, nz, half)) {
                        ent.mesh.position.z = nz;
                    }
                }
            }

            ent.aiState.cooldown = (ent.aiState.cooldown || 0) - delta;
            if (ent.aiState.cooldown > 0) continue;

            if (isCroton) {
                if (dist < meleeRange) {
                    this.damagePlayer(ent.data.attack * 0.8);
                    ent.aiState.cooldown = 2.2;
                } else if (dist < 16) {
                    // Wave Summon - AoE push/damage
                    this.damagePlayer(ent.data.attack * 0.6);
                    ent.aiState.cooldown = 3.4;
                }
            } else if (dist < meleeRange) {
                this.damagePlayer(ent.data.attack * 0.6);
                ent.aiState.cooldown = 1.6;
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
        window.gameSystem.updateHUD();
    }

    advanceCharges(delta) {
        const g = this.gauntlet;
        const cfg = g.cfg;
        let anyStillActive = false;
        const playerPos = overworld3d.playerObj ? new THREE.Vector3(overworld3d.playerObj.position.x, 0, overworld3d.playerObj.position.z) : null;

        for (const charge of g.activeCharges) {
            charge.mesh.position.addScaledVector(charge.dir, charge.speed * delta);
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
