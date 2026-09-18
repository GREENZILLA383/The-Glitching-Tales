class GameSystem3D {
    constructor() {
        this.state = 'menu'; // menu, overworld, gauntlet, dialogue, shop, settings, paused, gameover
        this.isCutscene = false;
        this.party = []; // filled in by beginAdventure() once character creation confirms
        this.coins = 0;

        this.mainMenu = document.getElementById('main-menu');
        this.dialogueBox = document.getElementById('dialogue-box');

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('menu-settings-btn').addEventListener('click', () => {
            if (window.settingsSystem) window.settingsSystem.openSettings();
        });

        const diffBtn = document.getElementById('difficulty-btn');
        const diffLevels = ['EASY', 'NORMAL', 'HARD'];
        const diffMultipliers = { 'EASY': 0.5, 'NORMAL': 0.75, 'HARD': 1.0 };
        this.difficultyStr = 'HARD';
        this.difficultyMultiplier = 1.0;

        diffBtn.addEventListener('click', () => {
            let idx = diffLevels.indexOf(this.difficultyStr);
            idx = (idx + 1) % diffLevels.length;
            this.difficultyStr = diffLevels[idx];
            this.difficultyMultiplier = diffMultipliers[this.difficultyStr];
            diffBtn.innerText = `🔥 DIFFICULTY: ${this.difficultyStr}`;
            if (this.difficultyStr === 'HARD') { diffBtn.style.color = '#ff4757'; diffBtn.style.borderColor = '#ff4757'; }
            if (this.difficultyStr === 'NORMAL') { diffBtn.style.color = '#ffa502'; diffBtn.style.borderColor = '#ffa502'; }
            if (this.difficultyStr === 'EASY') { diffBtn.style.color = '#2ed573'; diffBtn.style.borderColor = '#2ed573'; }
        });
    }

    beginAdventure(playerChar) {
        this.party = [playerChar];
        this.mainMenu.classList.add('hidden');
        this.state = 'overworld';
        overworld3d.start(this.party);
        this.updateHUD();
        setTimeout(() => {
            this.showDialogue('System', `${playerChar.name} washes up on the shore of the Emerald Coast, with no memory of how they got there.`);
        }, 300);
    }

    collectCoin() {
        this.coins += 5;
        this.showDialogue('System', 'Found 5 Coins!');
        this.updateHUD();
    }

    triggerStoryNPC(storyId) {
        if (storyId === 'barnico') {
            const player = this.party[0];
            if (!player.hasGlider) {
                player.hasGlider = true;
                this.showDialogue('Elder Barnico', "So. You're the one the tides dragged in. Good, we could use someone like you. Take this before you go - it'll help you get down from high places without breaking your neck.");
            } else if (this.party.length < 2) {
                this.showDialogue('Elder Barnico', "There's a crab out past the temple ruins who calls himself a king. Croton. Octa's going with you - don't argue.");
            } else {
                this.showDialogue('Elder Barnico', "Go on, then. The tide won't wait for you.");
            }
        } else if (storyId === 'octa_join') {
            this.showDialogue('Octa', "Me! Me! I'm coming too!");
            const octa = JSON.parse(JSON.stringify(CHARACTERS.octa));
            octa.build3D = CHARACTERS.octa.build3D;
            this.party.push(octa);
            overworld3d.spawnCompanion(octa);
        }
    }

    triggerHandWaveEvent() {
        this.isCutscene = true;
        this.pendingGauntletStart = true;
        document.body.classList.add('cutscene-active');
        this.dialogueQueue = [
            { speaker: 'System', text: 'A wave rises ahead of you - and for one unnerving moment, it looks exactly like a closing hand.' },
            { speaker: 'System', text: 'It slams down. The ocean swallows you whole, and you sink a long way before you hit bottom.' }
        ];
        overworld3d.startCinematicFlyin(() => {
            const nextMsg = this.dialogueQueue.shift();
            this.showDialogue(nextMsg.speaker, nextMsg.text);
        });
    }

    onCrotonDefeated() {
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        this.dialogueQueue = [
            { speaker: 'Croton', text: "Worthy. Huh. It's been a while." },
            { speaker: 'Croton', text: "Whatever's waiting for you next is out there. Ruined Ocean's not kind to visitors. Try not to drown." }
        ];
        overworld3d.startCinematicFlyin(() => {
            const nextMsg = this.dialogueQueue.shift();
            this.showDialogue(nextMsg.speaker, nextMsg.text);
        });
    }

    onOblongtaloSurvived() {
        this.isCutscene = true;
        this.pendingChapterEnd = true;
        document.body.classList.add('cutscene-active');
        this.showDialogue('Oblongtalo', 'You are worthy.');
    }

    onPlayerDefeated() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        this.showDialogue('System', 'You have fallen... the adventure resets.');
        setTimeout(() => location.reload(), 2500);
    }

    showChapterThreeComingSoon() {
        document.getElementById('chapter-end-ui').classList.remove('hidden');
    }

    updateHUD() {
        const player = this.party[0];
        if (!player) return;
        const setBar = (fillId, val, max) => {
            const el = document.getElementById(fillId);
            if (el) el.style.width = `${Math.max(0, Math.min(100, (val / max) * 100))}%`;
        };
        setBar('hud-hp-fill', player.hp, player.maxHp);
        setBar('hud-mp-fill', player.mp, player.maxMp);
        setBar('hud-stamina-fill', player.stamina, player.maxStamina);

        const weaponEl = document.getElementById('hud-weapon-name');
        if (weaponEl) {
            const w = player.equippedWeapon;
            const durText = (w.durability === null || w.durability === undefined) ? '∞' : `${w.durability}/${w.maxDurability}`;
            weaponEl.innerText = `${w.name} (${durText})`;
        }
        const coinEl = document.getElementById('hud-coins');
        if (coinEl) coinEl.innerText = this.coins;
        const levelEl = document.getElementById('hud-level');
        if (levelEl) levelEl.innerText = `Lv.${player.level}`;
    }

    showDialogue(speaker, text) {
        if (!this.dialogueQueue) this.dialogueQueue = [];

        if (this.state === 'dialogue') {
            this.dialogueQueue.push({ speaker, text });
            return;
        }

        const prevState = this.state;
        this.state = 'dialogue';

        this.dialogueBox.classList.remove('hidden');
        this.dialogueBox.querySelector('.speaker-name').innerText = speaker;

        const textContainer = this.dialogueBox.querySelector('.dialogue-text');
        textContainer.textContent = '';
        let i = 0;

        const typeWriter = setInterval(() => {
            textContainer.textContent = text.substring(0, i + 1);
            i++;
            if (i >= text.length) {
                clearInterval(typeWriter);
                const closeHandler = () => {
                    this.dialogueBox.classList.add('hidden');
                    this.state = prevState;
                    document.removeEventListener('click', closeHandler);

                    if (this.dialogueQueue && this.dialogueQueue.length > 0) {
                        const nextMsg = this.dialogueQueue.shift();
                        setTimeout(() => this.showDialogue(nextMsg.speaker, nextMsg.text), 100);
                    } else if (this.isCutscene) {
                        this.endCutscene();
                    }
                };
                setTimeout(() => document.addEventListener('click', closeHandler), 500);
            }
        }, 30);
    }

    endCutscene() {
        this.isCutscene = false;
        document.body.classList.remove('cutscene-active');

        if (this.pendingGauntletStart) {
            this.pendingGauntletStart = false;
            window.combatSystem.startOblongtaloGauntlet();
        } else if (this.pendingChapterEnd) {
            this.pendingChapterEnd = false;
            this.showChapterThreeComingSoon();
        }
    }
}

class ShopSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.shopUI = document.getElementById('shop-ui');
        this.shopTitle = document.getElementById('shop-title');
        this.coinCount = document.getElementById('coin-count');
        this.shopkeeperDialogue = document.getElementById('shopkeeper-dialogue');
        this.shopItemsGrid = document.getElementById('shop-items-grid');
        this.closeBtn = document.getElementById('close-shop-btn');

        this.closeBtn.addEventListener('click', () => this.closeShop());

        this.inventory = [
            { id: 'spell_time', name: 'Time Spell', desc: 'A Magick bolt that slows on hit (twice as long if you are Magick).', price: 60, category: 'Spell',
              weaponData: { name: 'Time Spell', playStyle: 'magick', power: 8, skillType: 'magick', durability: null, maxDurability: null, mpCost: 10 } },
            { id: 'spell_spark', name: 'Greater Spark', desc: 'A stronger Magick bolt.', price: 120, category: 'Spell',
              weaponData: { name: 'Greater Spark', playStyle: 'magick', power: 22, skillType: 'magick', durability: null, maxDurability: null, mpCost: 12 } },
            { id: 'weapon_cutlass', name: 'Coral Cutlass', desc: 'A sturdy melee blade. Wears out with use.', price: 80, category: 'Weapon',
              weaponData: { name: 'Coral Cutlass', playStyle: 'melee', power: 20, skillType: 'melee', durability: 40, maxDurability: 40 } },
            { id: 'weapon_bow', name: 'Driftwood Bow', desc: 'A reliable hunting bow. Wears out with use.', price: 80, category: 'Weapon',
              weaponData: { name: 'Driftwood Bow', playStyle: 'range', power: 18, skillType: 'range', durability: 40, maxDurability: 40 } },
            { id: 'charm_vigor', name: 'Vigor Charm', desc: '+15 Max HP.', price: 70, category: 'Charm', stat: 'maxHp', val: 15 },
            { id: 'charm_focus', name: 'Focus Charm', desc: '+15 Max MP.', price: 70, category: 'Charm', stat: 'maxMp', val: 15 },
            { id: 'charm_wind', name: 'Wind Charm', desc: '+15 Max Stamina.', price: 70, category: 'Charm', stat: 'maxStamina', val: 15 }
        ];
    }

    openShop() {
        this.shopkeeperDialogue.innerText = '"Wandering the coasts, buying and selling. Have a look around!"';
        this.shopTitle.innerText = 'SHOP';
        this.updateCoinDisplay();
        this.renderItems();
        this.shopUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'shop';
    }

    closeShop() {
        this.shopUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }

    updateCoinDisplay() {
        this.coinCount.innerText = this.game.coins || 0;
    }

    renderItems() {
        this.shopItemsGrid.innerHTML = '';
        const player = this.game.party[0];
        this.inventory.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            const finalPrice = Math.max(1, Math.floor(item.price));
            const canAfford = (this.game.coins || 0) >= finalPrice;
            const matched = item.weaponData && item.weaponData.skillType === player.skillType;
            el.innerHTML = `
                <div class="item-name">${item.name} ${matched ? '⭐' : ''}</div>
                <div class="item-desc">[${item.category}] ${item.desc}</div>
                <div class="item-price">💰 ${finalPrice}</div>
                <button class="buy-btn" ${canAfford ? '' : 'disabled'}>Buy</button>
            `;
            el.querySelector('.buy-btn').addEventListener('click', () => this.buyItem(item));
            this.shopItemsGrid.appendChild(el);
        });
    }

    buyItem(item) {
        const finalPrice = Math.max(1, Math.floor(item.price));
        if ((this.game.coins || 0) < finalPrice) return;
        this.game.coins -= finalPrice;
        const player = this.game.party[0];

        if (item.weaponData) {
            player.equippedWeapon = { ...item.weaponData };
            this.game.showDialogue('System', `Equipped ${item.name}!`);
        } else if (item.stat) {
            player[item.stat] += item.val;
            if (item.stat === 'maxHp') player.hp += item.val;
            if (item.stat === 'maxMp') player.mp += item.val;
            if (item.stat === 'maxStamina') player.stamina += item.val;
            this.game.showDialogue('System', `Bought ${item.name}!`);
        }

        this.updateCoinDisplay();
        this.game.updateHUD();
        this.renderItems();
    }
}

class SettingsSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.settingsUI = document.getElementById('settings-ui');
        this.pauseUI = document.getElementById('pause-ui');

        this.volSlider = document.getElementById('volume-slider');
        this.invincToggle = document.getElementById('invincible-toggle');
        this.mirrorToggle = document.getElementById('mirror-toggle');
        this.colorPicker = document.getElementById('theme-color-picker');

        this.pauseVolSlider = document.getElementById('pause-volume-slider');
        this.pauseInvincToggle = document.getElementById('pause-invincible-toggle');
        this.pauseMirrorToggle = document.getElementById('pause-mirror-toggle');
        this.pauseColorPicker = document.getElementById('pause-theme-color-picker');

        this.godMode = false;
        this.mirrorMode = false;
        this.volume = 50;
        this.themeColor = '#fbbf24';

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('close-settings-btn').addEventListener('click', () => this.closeSettings());
        document.getElementById('resume-btn').addEventListener('click', () => this.closePauseMenu());
        document.getElementById('resume-main-btn').addEventListener('click', () => this.closePauseMenu());

        this.volSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.invincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.mirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.colorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));

        this.pauseVolSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.pauseInvincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.pauseMirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.pauseColorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));

        document.getElementById('moveset-guide-btn').addEventListener('click', () => this.openMovesetGuide());
        document.getElementById('close-moveset-btn').addEventListener('click', () => {
            document.getElementById('moveset-modal').classList.add('hidden');
        });
    }

    openMovesetGuide() {
        const modal = document.getElementById('moveset-modal');
        const content = document.getElementById('moveset-content');
        let html = '';
        this.game.party.forEach(hero => {
            html += `<h3 style="color:var(--primary-color); margin-top:15px; border-bottom:1px solid #555;">${hero.name}</h3>`;
            if (hero.equippedWeapon) {
                const w = hero.equippedWeapon;
                html += `<p style="font-size:0.9em; color:#ccc;">Equipped: <strong>${w.name}</strong> (${w.playStyle}) - Power ${w.power}${w.skillType ? `, matches ${w.skillType}` : ''}</p>`;
            }
            if (hero.abilities) {
                html += `<ul style="list-style-type:none; padding-left:10px;">`;
                hero.abilities.forEach(ab => {
                    html += `<li style="margin-bottom:8px;"><strong>${ab.name}</strong> - ${ab.description || ''}</li>`;
                });
                html += `</ul>`;
            }
        });
        content.innerHTML = html;
        modal.classList.remove('hidden');
    }

    setVolume(val) {
        this.volume = val;
        this.volSlider.value = val;
        this.pauseVolSlider.value = val;
    }

    setGodMode(val) {
        this.godMode = val;
        this.invincToggle.checked = val;
        this.pauseInvincToggle.checked = val;
        this.game.godMode = val;
    }

    setMirrorMode(val) {
        this.mirrorMode = val;
        this.mirrorToggle.checked = val;
        this.pauseMirrorToggle.checked = val;
        document.body.classList.toggle('mirror-mode', val);
    }

    setThemeColor(val) {
        this.themeColor = val;
        this.colorPicker.value = val;
        this.pauseColorPicker.value = val;
        document.documentElement.style.setProperty('--primary-color', val);
    }

    openSettings() {
        this.settingsUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'settings';
    }

    closeSettings() {
        this.settingsUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }

    openPauseMenu() {
        this.pauseUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'paused';
    }

    closePauseMenu() {
        this.pauseUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }
}

window.onload = () => {
    window.gameSystem = new GameSystem3D();
    window.shopSystem = new ShopSystem(window.gameSystem);
    window.settingsSystem = new SettingsSystem(window.gameSystem);

    document.getElementById('chapter-end-menu-btn').addEventListener('click', () => location.reload());

    const controlsUI = document.getElementById('ui-layer');
    if (controlsUI) {
        const pauseBtn = document.createElement('button');
        pauseBtn.innerText = '⏸️ Pause';
        pauseBtn.style.position = 'absolute';
        pauseBtn.style.top = '20px';
        pauseBtn.style.right = '20px';
        pauseBtn.style.padding = '10px 20px';
        pauseBtn.style.background = 'rgba(0,0,0,0.7)';
        pauseBtn.style.color = 'white';
        pauseBtn.style.border = '2px solid var(--primary-color)';
        pauseBtn.style.borderRadius = '8px';
        pauseBtn.style.fontWeight = 'bold';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.pointerEvents = 'auto';
        pauseBtn.addEventListener('click', () => {
            window.settingsSystem.openPauseMenu();
        });
        controlsUI.appendChild(pauseBtn);
    }
};
