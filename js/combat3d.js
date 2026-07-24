class Combat3D {
    constructor() {
        this.scene = new THREE.Scene();
        
        // Setup Skybox for combat (different reflection or tone)
        const textureLoader = new THREE.TextureLoader();
        const skyTexture = textureLoader.load(ASSETS.mario_world_bg_1783460841676);
        skyTexture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = skyTexture;
        this.scene.environment = skyTexture;
        // Darken the skybox slightly for combat focus
        this.scene.backgroundIntensity = 0.5;

        // Setup Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 40);
        this.camera.lookAt(0, 0, 0);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(10, 30, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Grand Colosseum Floor
        const floorGeo = new THREE.CylinderGeometry(25, 25, 2, 32);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -1;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Colosseum Walls (Low outer ring)
        const wallGeo = new THREE.TorusGeometry(25, 1, 16, 64);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.rotation.x = Math.PI / 2;
        wall.position.y = 0;
        this.scene.add(wall);

        this.party = [];
        this.enemies = [];
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        
        // UI Elements
        this.uiLayer = document.getElementById('combat-ui-layer');
        this.partyStatus = document.getElementById('party-status');
        this.actionMenu = document.getElementById('action-menu');
        this.messageBox = document.getElementById('combat-message');
        this.bossHealthContainer = document.getElementById('boss-health-container');
        this.bossHealthFill = document.getElementById('boss-health-fill');
        this.bossNameText = document.getElementById('boss-name');
    }

    startCombat(party, enemies, isBoss = false, worldName = 'mario') {
        this.isBossFight = isBoss;
        this.totalXpEarned = 0; // Initialize XP for this encounter
        
        // Update Combat Skybox based on world
        let skyAsset = ASSETS.mario_world_bg_1783460841676;
        if (worldName === 'minecraft') {
            skyAsset = ASSETS.minecraft_village_bg_1783475064320;
        } else if (worldName === 'amongus') {
            skyAsset = ASSETS.amongus_combat_bg;
        } else if (worldName === 'pokemon') {
            skyAsset = ASSETS.pokemon_combat_bg;
        } else if (worldName === 'animation') {
            skyAsset = ASSETS.animation_dimension_bg;
        }
        
        if (skyAsset) {
            const textureLoader = new THREE.TextureLoader();
            const skyTexture = textureLoader.load(skyAsset);
            skyTexture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = skyTexture;
            this.scene.environment = skyTexture;
        } else {
            this.scene.environment = null; // Fallback
        }
        
        // Add Combat Fog for atmosphere
        let fogColor = 0x1e293b;
        if (worldName === 'minecraft') fogColor = 0x27272a;
        if (worldName === 'pokemon') fogColor = 0x1e3a8a;
        if (worldName === 'amongus') fogColor = 0x000000;
        if (worldName === 'animation') fogColor = 0x0ea5e9;
        this.scene.fog = new THREE.Fog(fogColor, 40, 150); // Pushed back so characters don't look black
        
        // Clone state
        this.party = party.map(p => ({ ...p, isPlayer: true }));
        this.enemies = enemies.map(e => ({ ...e, isPlayer: false }));
        
        this.uiLayer.classList.remove('hidden');
        
        if (this.isBossFight) {
            const boss = this.enemies.find(e => e.isBoss);
            if (boss) {
                this.bossHealthContainer.classList.remove('hidden');
                this.bossNameText.innerText = boss.name;
                this.bossHealthFill.style.width = '100%';
            }
        } else {
            this.bossHealthContainer.classList.add('hidden');
        }

        this.spawnCombatants();
        this.renderStatus();
        this.calculateTurnOrder();
        
        this.active = true;
        this.processTurn();
        this.animate();
    }

    animate() {
        if (!this.active) return;
        requestAnimationFrame(() => this.animate());
        this.render();
    }

    spawnCombatants() {
        // Clear old meshes
        this.party.forEach(p => { if(p.mesh) this.scene.remove(p.mesh); });
        this.enemies.forEach(e => { if(e.mesh) this.scene.remove(e.mesh); });

        // Spawn Party on the left arc
        this.party.forEach((hero, index) => {
            const mesh = hero.build3D();
            mesh.position.set(-15, 0, -10 + index * 10);
            this.scene.add(mesh);
            hero.mesh = mesh;
            hero.originalPos = mesh.position.clone();
        });

        // Spawn Enemies on the right arc
        this.enemies.forEach((enemy, index) => {
            const mesh = enemy.build3D();
            
            // Bosses are bigger
            if (enemy.isBoss) {
                mesh.scale.set(3, 3, 3);
            }
            
            mesh.position.set(15, 0, -10 + index * 10);
            this.scene.add(mesh);
            enemy.mesh = mesh;
            enemy.originalPos = mesh.position.clone();
        });
    }

    renderStatus() {
        this.partyStatus.innerHTML = '';
        this.party.forEach((hero, index) => {
            const hpPercent = (hero.hp / hero.maxHp) * 100;
            const mpPercent = (hero.mp / hero.maxMp) * 100;
            
            const el = document.createElement('div');
            el.className = 'status-row';
            el.id = `status-hero-${index}`;
            el.innerHTML = `
                <div class="char-name">${hero.name}</div>
                <div class="stats-bars">
                    <div class="bar-container">
                        <div class="bar-fill hp" style="width: ${hpPercent}%"></div>
                        <div class="bar-text">${hero.hp}/${hero.maxHp}</div>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill mp" style="width: ${mpPercent}%"></div>
                        <div class="bar-text">${hero.mp}/${hero.maxMp}</div>
                    </div>
                </div>
            `;
            this.partyStatus.appendChild(el);
        });
    }

    calculateTurnOrder() {
        const allCombatants = [...this.party, ...this.enemies];
        this.turnOrder = allCombatants.sort((a, b) => b.speed - a.speed);
        this.currentTurnIndex = 0;
    }

    processTurn() {
        if (!this.active) return;

        const aliveHeroes = this.party.filter(h => h.hp > 0);
        const aliveEnemies = this.enemies.filter(e => e.hp > 0);
        
        if (aliveHeroes.length === 0) return this.endCombat(false);
        if (aliveEnemies.length === 0) return this.endCombat(true);

        const currentCombatant = this.turnOrder[this.currentTurnIndex];
        
        if (currentCombatant.hp <= 0) {
            this.nextTurn();
            return;
        }

        // Clear status effects on start of turn
        if (currentCombatant.status === 'invincible') {
            currentCombatant.status = null;
        }

        this.highlightActive(currentCombatant);

        if (currentCombatant.isPlayer) {
            this.showPlayerMenu(currentCombatant);
        } else {
            this.takeEnemyTurn(currentCombatant);
        }
    }

    highlightActive(combatant) {
        document.querySelectorAll('.status-row').forEach(el => el.classList.remove('active'));
        if (combatant.isPlayer) {
            const index = this.party.indexOf(combatant);
            document.getElementById(`status-hero-${index}`).classList.add('active');
        }
        
        // Bounce animation for active character
        const jump = () => {
            if(!this.active || this.turnOrder[this.currentTurnIndex] !== combatant) return;
            combatant.mesh.position.y = 2;
            setTimeout(() => {
                if(combatant.mesh) combatant.mesh.position.y = 0;
            }, 300);
            setTimeout(jump, 1200);
        };
        jump();
    }

    showPlayerMenu(hero) {
        this.actionMenu.innerHTML = `
            <button class="action-btn" id="btn-attack">Attack</button>
            <button class="action-btn" id="btn-ability">Abilities</button>
            <button class="action-btn" id="btn-defend">Defend</button>
        `;

        const isTutorial = this.enemies[0] && this.enemies[0].id === 'hologoomba';
        
        if (isTutorial) {
            if (!this.combatTutorialStep) this.combatTutorialStep = 1;
            
            if (this.combatTutorialStep === 1) {
                this.showMessage("Welcome to Combat! Click 'Attack' to strike the Hologoomba!", 0);
                document.getElementById('btn-ability').disabled = true;
                document.getElementById('btn-defend').disabled = true;
            } else if (this.combatTutorialStep === 2) {
                this.showMessage("Great job! Now click 'Abilities' to try a special move!", 0);
                document.getElementById('btn-attack').disabled = true;
                document.getElementById('btn-defend').disabled = true;
            } else {
                this.showMessage("Defeat the Hologoomba to finish the tutorial!", 0);
            }
        }

        document.getElementById('btn-attack').onclick = () => {
            if (isTutorial && this.combatTutorialStep === 1) this.combatTutorialStep = 2;
            const aliveEnemies = this.enemies.filter(e => e.hp > 0);
            const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            this.executeAttack(hero, target);
        };
        
        document.getElementById('btn-ability').onclick = () => {
            if (isTutorial && this.combatTutorialStep === 2) this.combatTutorialStep = 3;
            this.showAbilityMenu(hero);
        };
        
        document.getElementById('btn-defend').onclick = () => {
            this.showMessage(`${hero.name} defends!`);
            hero.isDefending = true;
            setTimeout(() => this.nextTurn(), 1000);
        };
    }

    showAbilityMenu(hero) {
        this.actionMenu.innerHTML = '';
        
        const grid = document.createElement('div');
        grid.className = 'ability-grid';
        this.actionMenu.appendChild(grid);
        
        if (hero.abilities) {
            hero.abilities.forEach(ability => {
                const btn = document.createElement('div');
                
                let themeClass = 'theme-default';
                if (ability.name.includes('Fireball') || ability.name.includes('Charizard')) themeClass = 'theme-fire';
                else if (ability.name.includes('Sword')) themeClass = 'theme-diamond';
                else if (ability.name === 'BLJ' || ability.name === 'Frame Perfect') themeClass = 'theme-speed';
                else if (ability.type === 'heal' || ability.type === 'buff' || ability.name === 'Eat Steak') themeClass = 'theme-heal';
                else if (ability.name.includes('Draw Weapon') || ability.name.includes('Hollow')) themeClass = 'theme-stickman';
                
                btn.className = `ability-card ${themeClass}`;
                if (hero.mp < ability.cost) {
                    btn.classList.add('disabled');
                }
                
                btn.innerHTML = `
                    <div class="ability-title">${ability.name}</div>
                    <div class="ability-desc">${ability.description || 'Deals damage to an enemy.'}</div>
                    <div class="ability-cost">Cost: ${ability.cost} MP</div>
                `;
                
                btn.onclick = () => {
                    if (hero.mp >= ability.cost) {
                        this.useAbility(hero, ability);
                    } else {
                        this.showMessage("Not enough MP!");
                    }
                };
                grid.appendChild(btn);
            });
        }

        const backBtn = document.createElement('button');
        backBtn.className = 'action-btn back-btn';
        backBtn.innerText = 'Back';
        backBtn.onclick = () => this.showPlayerMenu(hero);
        this.actionMenu.appendChild(backBtn);
    }

    useAbility(hero, ability) {
        this.actionMenu.innerHTML = '';
        hero.mp -= ability.cost;
        this.renderStatus();
        this.showMessage(`${hero.name} uses ${ability.name}!`);
        
        if (ability.type === 'heal') {
            setTimeout(() => {
                hero.hp = Math.min(hero.maxHp, hero.hp + ability.power);
                this.showDamage(`+${ability.power}`, hero); // we'll update showDamage to take position or hero later
                this.renderStatus();
                setTimeout(() => this.nextTurn(), 1000);
            }, 1000);
        } else if (ability.type === 'buff') {
            setTimeout(() => {
                hero[ability.stat] += ability.amount;
                this.showMessage(`${hero.name}'s ${ability.stat} rose!`);
                setTimeout(() => this.nextTurn(), 1000);
            }, 1000);
        } else if (ability.type === 'debuff') {
            setTimeout(() => {
                const aliveEnemies = this.enemies.filter(e => e.hp > 0);
                const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                target[ability.stat] = Math.max(1, target[ability.stat] - ability.amount);
                this.showMessage(`${target.name}'s ${ability.stat} fell!`);
                setTimeout(() => this.nextTurn(), 1000);
            }, 1000);
        } else if (ability.type === 'status') {
            setTimeout(() => {
                hero.status = ability.status;
                this.showMessage(`${hero.name} used ${ability.name}!`);
                setTimeout(() => this.nextTurn(), 1000);
            }, 1000);
        } else {
            setTimeout(() => {
                const aliveEnemies = this.enemies.filter(e => e.hp > 0);
                if (ability.target === 'all') {
                    this.executeAoEAttack(hero, aliveEnemies, ability);
                } else {
                    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                    this.executeAttack(hero, target, ability);
                }
            }, 500);
        }
    }

    takeEnemyTurn(enemy) {
        this.actionMenu.innerHTML = '';
        const isTutorial = this.enemies[0] && this.enemies[0].id === 'hologoomba';
        
        if (isTutorial) {
            this.showMessage(`The Hologoomba strikes back! Notice how you take damage!`);
        } else {
            this.showMessage(`${enemy.name}'s turn...`);
        }
        
        setTimeout(() => {
            const aliveHeroes = this.party.filter(h => h.hp > 0);
            const target = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
            this.executeAttack(enemy, target);
        }, 1500);
    }

    shakeScreen(intensity) {
        let shakes = 0;
        const originalCamPos = this.camera.position.clone();
        
        const shakeAnim = setInterval(() => {
            shakes++;
            this.camera.position.x = originalCamPos.x + (Math.random() - 0.5) * intensity;
            this.camera.position.y = originalCamPos.y + (Math.random() - 0.5) * intensity;
            if (shakes > 10) {
                clearInterval(shakeAnim);
                this.camera.position.copy(originalCamPos);
            }
        }, 16);
    }

    executeAttack(attacker, target, ability = null) {
        this.actionMenu.innerHTML = '';
        if (!ability) {
            this.showMessage(`${attacker.name} attacks ${target.name}!`);
        }
        
        const startPos = attacker.originalPos.clone();
        const offset = target.isBoss ? 5 : 3;
        const targetPos = target.mesh.position.clone();
        targetPos.x += attacker.isPlayer ? -offset : offset; // Stand next to target

        const finishAttack = () => {
            if (target.status === 'invincible' && !attacker.isPlayer) {
                this.showMessage(`${target.name} avoids the attack completely!`);
            } else {
                this.applyHit(attacker, target, ability);
            }
            
            setTimeout(() => {
                attacker.mesh.position.copy(startPos);
                attacker.mesh.rotation.z = 0; // reset rotation
                setTimeout(() => this.nextTurn(), 500);
            }, 400);
        };

        if (ability) {
            // Ability Animation (Projectile)
            const projGeo = new THREE.SphereGeometry(1, 16, 16);
            let projColor = 0xffa500; // default orange (fireball-ish)
            if (ability.name === 'BLJ') projColor = 0x0000ff; // blue blur
            if (ability.name.includes('Sword')) projColor = 0x00ffff; // diamond sword color
            
            const projMat = new THREE.MeshBasicMaterial({ color: projColor });
            const projectile = new THREE.Mesh(projGeo, projMat);
            projectile.position.copy(startPos);
            projectile.position.y += 2;
            this.scene.add(projectile);
            
            let pProgress = 0;
            const projAnim = setInterval(() => {
                pProgress += 0.05;
                projectile.position.lerpVectors(startPos, targetPos, pProgress);
                projectile.position.y += Math.sin(pProgress * Math.PI) * 2;
                if (pProgress >= 1) {
                    clearInterval(projAnim);
                    this.scene.remove(projectile);
                    finishAttack();
                }
            }, 16);
            return; // Skip physical attack animation
        }

        let progress = 0;
        
        if (attacker.id === 'mario') {
            // Speedrunner vibrate and teleport
            let vibrations = 0;
            const vibAnim = setInterval(() => {
                vibrations++;
                attacker.mesh.position.x = startPos.x + (Math.random() - 0.5) * 2;
                attacker.mesh.position.y = startPos.y + (Math.random() - 0.5) * 2;
                if (vibrations > 20) {
                    clearInterval(vibAnim);
                    attacker.mesh.position.copy(targetPos);
                    finishAttack();
                }
            }, 30);
        } else if (attacker.id === 'steve') {
            // Rigid blocky chop
            attacker.mesh.position.copy(targetPos);
            const chopAnim = setInterval(() => {
                progress += 0.2;
                attacker.mesh.rotation.z = Math.sin(progress * Math.PI) * -0.5;
                if (progress >= 1) {
                    clearInterval(chopAnim);
                    finishAttack();
                }
            }, 30);
        } else if (attacker.id === 'second_coming') {
            // Acrobatic flip
            const flipAnim = setInterval(() => {
                progress += 0.05;
                attacker.mesh.position.lerpVectors(startPos, targetPos, progress);
                attacker.mesh.position.y = Math.sin(progress * Math.PI) * 5;
                attacker.mesh.rotation.z = progress * Math.PI * 4; // Flip twice
                if (progress >= 1) {
                    clearInterval(flipAnim);
                    finishAttack();
                }
            }, 16);
        } else if (attacker.id === 'glitch') {
            // Teleport striking
            let teleports = 0;
            const glitchAnim = setInterval(() => {
                teleports++;
                attacker.mesh.position.lerpVectors(startPos, targetPos, teleports / 5);
                attacker.mesh.position.x += (Math.random() - 0.5) * 4; // glitch horizontal
                if (teleports >= 5) {
                    clearInterval(glitchAnim);
                    attacker.mesh.position.copy(targetPos);
                    finishAttack();
                }
            }, 100);
        } else {
            // Generic leap
            const leapAnim = setInterval(() => {
                progress += 0.05;
                attacker.mesh.position.lerpVectors(startPos, targetPos, progress);
                attacker.mesh.position.y = Math.sin(progress * Math.PI) * 10;
                if (progress >= 1) {
                    clearInterval(leapAnim);
                    finishAttack();
                }
            }, 16);
        }
    }

    executeAoEAttack(attacker, targets, ability) {
        this.actionMenu.innerHTML = '';
        this.showMessage(`${attacker.name} uses ${ability.name} on everyone!`);
        
        const startPos = attacker.originalPos.clone();
        
        let hitsLanded = 0;
        
        targets.forEach(target => {
            const targetPos = target.mesh.position.clone();
            
            const projGeo = new THREE.SphereGeometry(1.5, 16, 16);
            let projColor = 0xff4500; // orange-red for Fire Aglore
            const projMat = new THREE.MeshBasicMaterial({ color: projColor });
            const projectile = new THREE.Mesh(projGeo, projMat);
            projectile.position.copy(startPos);
            projectile.position.y += 2;
            this.scene.add(projectile);
            
            let pProgress = 0;
            const projAnim = setInterval(() => {
                pProgress += 0.05;
                projectile.position.lerpVectors(startPos, targetPos, pProgress);
                projectile.position.y += Math.sin(pProgress * Math.PI) * 2;
                if (pProgress >= 1) {
                    clearInterval(projAnim);
                    this.scene.remove(projectile);
                    this.applyHit(attacker, target, ability);
                    
                    hitsLanded++;
                    if (hitsLanded === targets.length) {
                        setTimeout(() => this.nextTurn(), 1000);
                    }
                }
            }, 16);
        });
    }

    applyHit(attacker, target, ability) {
        target.mesh.rotation.z = attacker.isPlayer ? 0.3 : -0.3; // tilt back
        
        this.shakeScreen(target.isBoss ? 0.8 : 0.4);

        let powerMultiplier = ability ? ability.power : 1;
        let damage = Math.max(1, Math.floor((attacker.attack * powerMultiplier) * (Math.random() * 0.4 + 0.8) - target.defense * 0.5));
        
        if (target.isDefending) {
            damage = Math.floor(damage / 2);
            target.isDefending = false;
        }
        
        // Invincible Mode
        if (target.isPlayer && window.gameSystem && window.gameSystem.godMode) {
            damage = 0;
            this.showMessage(`Invincible Mode Blocked ${attacker.name}'s attack!`);
        }

        target.hp = Math.max(0, target.hp - damage);
        
        this.showDamage(damage, target);
        this.renderStatus();
        
        if (target.isBoss) {
            const hpPercent = (target.hp / target.maxHp) * 100;
            this.bossHealthFill.style.width = `${hpPercent}%`;
        }

        setTimeout(() => {
            target.mesh.rotation.z = 0; // reset tilt
            if (target.hp === 0) {
                target.mesh.userData.isDead = true; 
                target.mesh.rotation.x = -Math.PI / 2;
                target.mesh.position.y = -0.5;
                if (!target.isPlayer && target.xpReward) {
                    this.totalXpEarned += target.xpReward;
                }
            }
        }, 300);
    }

    showDamage(amount, targetHero = null) {
        const dmgEl = document.createElement('div');
        dmgEl.className = 'damage-number';
        dmgEl.innerText = amount;
        
        // Default to center if target isn't specified
        dmgEl.style.left = '50%';
        dmgEl.style.top = '30%';
        
        if (targetHero && typeof amount === 'string' && amount.startsWith('+')) {
            dmgEl.style.color = '#4ade80'; // Green for healing
        }
        
        dmgEl.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(dmgEl);
        setTimeout(() => dmgEl.remove(), 1000);
    }

    showMessage(text) {
        this.messageBox.innerText = text;
        this.messageBox.classList.remove('hidden');
    }

    nextTurn() {
        this.currentTurnIndex++;
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.calculateTurnOrder();
        }
        this.processTurn();
    }

    endCombat(won) {
        this.active = false;
        if (won) {
            let levelUpMessages = [];
            // Distribute XP
            window.gameSystem.party.forEach(hero => {
                if (hero.level) {
                    hero.exp += this.totalXpEarned;
                    while (hero.exp >= hero.expToNext) {
                        hero.exp -= hero.expToNext;
                        hero.level++;
                        hero.expToNext = Math.floor(hero.expToNext * 1.5); // scale up
                        
                        // Stat Boosts
                        hero.maxHp += 20;
                        hero.maxMp += 10;
                        hero.attack += 5;
                        hero.defense += 5;
                        hero.hp = hero.maxHp;
                        hero.mp = hero.maxMp;
                        
                        let msg = `${hero.name} grew to Level ${hero.level}!`;
                        
                        // Check for new abilities
                        if (hero.id !== 'glitch' && LEVEL_ABILITIES[hero.id] && LEVEL_ABILITIES[hero.id][hero.level]) {
                            const newAbility = LEVEL_ABILITIES[hero.id][hero.level];
                            hero.abilities.push(newAbility);
                            msg += ` Learned ${newAbility.name}!`;
                        }
                        levelUpMessages.push(msg);
                    }
                }
            });

            const coinsEarned = this.isBossEncounter ? 50 : 10;
            if (window.gameSystem) {
                if (!window.gameSystem.coins) window.gameSystem.coins = 0;
                window.gameSystem.coins += coinsEarned;
                
                if (window.bountySystem) {
                    window.bountySystem.trackProgress('collect_coins', coinsEarned);
                    if (this.isBossEncounter) {
                        window.bountySystem.trackProgress('kill_boss', 1);
                    } else {
                        window.bountySystem.trackProgress('kill_enemy', 1);
                    }
                }
            }

            const victoryMsg = levelUpMessages.length > 0 
                ? `Victory! Earned ${this.totalXpEarned} EXP and ${coinsEarned} Coins!\n` + levelUpMessages.join('\n')
                : `Victory! Earned ${this.totalXpEarned} EXP and ${coinsEarned} Coins!`;

            this.showMessage(victoryMsg);
            
            setTimeout(() => {
                this.uiLayer.classList.add('hidden');
                this.messageBox.classList.add('hidden');
                this.bossHealthContainer.classList.add('hidden');
                // Cleanup scene
                while(this.scene.children.length > 0) this.scene.remove(this.scene.children[0]);
                if (window.gameSystem) window.gameSystem.endCombat(true, this.isBossFight);
            }, Math.max(2000, levelUpMessages.length * 1000 + 1000));
        } else {
            this.showMessage("Game Over!");
            setTimeout(() => location.reload(), 2000);
        }
    }

    render() {
        if (this.active) {
            // Billboarding logic for combat scene
            this.scene.traverse((object) => {
                if (object.name === "billboard") {
                    // Check if parent group is marked dead
                    if (object.parent && object.parent.userData.isDead) return;
                    
                    const targetPos = new THREE.Vector3(this.camera.position.x, object.position.y, this.camera.position.z);
                    object.lookAt(targetPos);
                }
            });

            overworld3d.renderer.render(this.scene, this.camera);
        }
    }
}

const combat3d = new Combat3D();
