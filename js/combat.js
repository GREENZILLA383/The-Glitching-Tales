class CombatSystem {
    constructor() {
        this.party = [];
        this.enemies = [];
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.inCombat = false;
        
        // DOM Elements
        this.layer = document.getElementById('combat-layer');
        this.heroesContainer = document.getElementById('heroes-container');
        this.enemiesContainer = document.getElementById('enemies-container');
        this.partyStatus = document.getElementById('party-status');
        this.actionMenu = document.getElementById('action-menu');
    }

    startCombat(party, enemies, isBoss = false) {
        this.isBossFight = isBoss;
        this.party = party.map(p => ({ ...p, isPlayer: true }));
        this.enemies = enemies.map(e => ({ ...e, isPlayer: false }));
        this.inCombat = true;
        this.layer.classList.remove('hidden');
        
        this.renderCombatants();
        this.renderStatus();
        this.calculateTurnOrder();
        this.processTurn();
    }

    renderCombatants() {
        this.heroesContainer.innerHTML = '';
        this.enemiesContainer.innerHTML = '';

        this.party.forEach((hero, index) => {
            const el = document.createElement('div');
            el.className = 'combat-entity hero';
            el.id = `combat-hero-${index}`;
            el.innerHTML = `
                <div class="entity-name">${hero.name}</div>
                ${hero.sprite}
            `;
            this.heroesContainer.appendChild(el);
            hero.element = el;
        });

        this.enemies.forEach((enemy, index) => {
            const el = document.createElement('div');
            el.className = 'combat-entity enemy';
            el.id = `combat-enemy-${index}`;
            el.innerHTML = `
                <div class="entity-name">${enemy.name}</div>
                ${enemy.sprite}
            `;
            // Simple click to target
            el.onclick = () => {
                if(this.waitingForTarget) {
                    this.executeAttack(this.turnOrder[this.currentTurnIndex], enemy);
                }
            };
            this.enemiesContainer.appendChild(el);
            enemy.element = el;
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
        // Sort by speed descending
        this.turnOrder = allCombatants.sort((a, b) => b.speed - a.speed);
        this.currentTurnIndex = 0;
    }

    processTurn() {
        if (!this.inCombat) return;

        // Check win/loss conditions
        const aliveHeroes = this.party.filter(h => h.hp > 0);
        const aliveEnemies = this.enemies.filter(e => e.hp > 0);
        
        if (aliveHeroes.length === 0) {
            this.endCombat(false);
            return;
        }
        if (aliveEnemies.length === 0) {
            this.endCombat(true);
            return;
        }

        const currentCombatant = this.turnOrder[this.currentTurnIndex];
        
        // Skip if dead
        if (currentCombatant.hp <= 0) {
            this.nextTurn();
            return;
        }

        this.highlightActive(currentCombatant);

        if (currentCombatant.isPlayer) {
            this.showPlayerMenu(currentCombatant);
        } else {
            this.takeEnemyTurn(currentCombatant);
        }
    }

    highlightActive(combatant) {
        // Remove active class from all
        document.querySelectorAll('.status-row').forEach(el => el.classList.remove('active'));
        if (combatant.isPlayer) {
            const index = this.party.indexOf(combatant);
            document.getElementById(`status-hero-${index}`).classList.add('active');
        }
    }

    showPlayerMenu(hero) {
        this.waitingForTarget = false;
        this.actionMenu.innerHTML = `
            <button class="action-btn" id="btn-attack">Attack</button>
            <button class="action-btn" id="btn-ability">Abilities</button>
            <button class="action-btn" id="btn-defend">Defend</button>
        `;

        document.getElementById('btn-attack').onclick = () => {
            this.showMessage("Select a target");
            this.waitingForTarget = true;
        };
        
        document.getElementById('btn-ability').onclick = () => {
            this.showAbilities(hero);
        };
        
        document.getElementById('btn-defend').onclick = () => {
            this.showMessage(`${hero.name} defends!`);
            hero.isDefending = true;
            setTimeout(() => this.nextTurn(), 1000);
        };
    }

    showAbilities(hero) {
        let html = '';
        hero.abilities.forEach((ability, i) => {
            html += `<button class="action-btn" onclick="combatSystem.useAbility(${i})">${ability.name} (${ability.cost} MP)</button>`;
        });
        html += `<button class="action-btn" onclick="combatSystem.showPlayerMenu(combatSystem.turnOrder[combatSystem.currentTurnIndex])">Back</button>`;
        this.actionMenu.innerHTML = html;
    }

    useAbility(abilityIndex) {
        const hero = this.turnOrder[this.currentTurnIndex];
        const ability = hero.abilities[abilityIndex];
        
        if (hero.mp < ability.cost) {
            this.showMessage("Not enough MP!");
            return;
        }
        
        this.waitingForTarget = true;
        this.pendingAbility = ability;
        this.showMessage(`Select a target for ${ability.name}`);
    }

    takeEnemyTurn(enemy) {
        this.actionMenu.innerHTML = ''; // Hide menu
        this.showMessage(`${enemy.name}'s turn...`);
        
        setTimeout(() => {
            const aliveHeroes = this.party.filter(h => h.hp > 0);
            const target = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
            this.executeAttack(enemy, target);
        }, 1000);
    }

    executeAttack(attacker, target) {
        this.waitingForTarget = false;
        let power = attacker.attack;
        let type = 'Attack';
        let cost = 0;

        if (this.pendingAbility) {
            power = attacker.attack * this.pendingAbility.power;
            type = this.pendingAbility.name;
            cost = this.pendingAbility.cost;
            this.pendingAbility = null;
        }

        // Action animation
        attacker.element.classList.add('attacking');
        this.showMessage(`${attacker.name} uses ${type}!`);
        
        setTimeout(() => {
            attacker.element.classList.remove('attacking');
            attacker.mp -= cost;
            
            // Calculate Damage
            let damage = Math.max(1, Math.floor(power * (Math.random() * 0.4 + 0.8) - target.defense * 0.5));
            if (target.isDefending) {
                damage = Math.floor(damage / 2);
                target.isDefending = false;
            }

            target.hp = Math.max(0, target.hp - damage);
            this.showDamage(target, damage);
            this.renderStatus();

            if (target.hp === 0) {
                target.element.style.opacity = '0.3';
                target.element.style.filter = 'grayscale(100%)';
            }

            setTimeout(() => this.nextTurn(), 1000);
        }, 500);
    }

    showDamage(target, amount) {
        target.element.classList.add('hurt');
        setTimeout(() => target.element.classList.remove('hurt'), 400);

        const dmgEl = document.createElement('div');
        dmgEl.className = 'damage-number';
        dmgEl.innerText = amount;
        
        // Position relative to target
        const rect = target.element.getBoundingClientRect();
        dmgEl.style.left = `${rect.left + rect.width / 2}px`;
        dmgEl.style.top = `${rect.top}px`;
        
        document.body.appendChild(dmgEl);
        setTimeout(() => dmgEl.remove(), 1000);
    }

    showMessage(text) {
        let msgEl = document.getElementById('combat-message');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'combat-message';
            this.layer.appendChild(msgEl);
        }
        msgEl.innerText = text;
    }

    nextTurn() {
        this.currentTurnIndex++;
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.calculateTurnOrder(); // Recalculate in case speeds changed
        }
        this.processTurn();
    }

    endCombat(won) {
        this.inCombat = false;
        if (won) {
            this.showMessage("Victory!");
            setTimeout(() => {
                this.layer.classList.add('hidden');
                document.getElementById('combat-message')?.remove();
                if (window.gameSystem) window.gameSystem.endCombat(true, this.isBossFight);
            }, 2000);
        } else {
            this.showMessage("Game Over!");
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
    }
}

const combatSystem = new CombatSystem();
