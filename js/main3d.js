class GameSystem3D {
    constructor() {
        this.state = 'menu'; // menu, overworld, combat, dialogue
        this.isCutscene = false;
        
        this.tutorialStep = 0; // 0: not started, 1: wait for move, 2: wait for look, 3: wait for jump, 4: done
        this.tutorialCompleted = false;
        this.party = [
            JSON.parse(JSON.stringify(CHARACTERS.glitch))
        ];
        
        // Re-attach build3D functions which are lost in JSON serialization
        this.party[0].build3D = CHARACTERS.glitch.build3D;
        
        this.worldProgression = ['mario', 'minecraft', 'pokemon', 'lost', 'cuphead', 'magic', 'sonic', 'amongus', 'animation'];
        this.currentWorldIndex = 0;
        this.beatBoss = false;
        this.coins = 0;
        this.collectedKeys = [];

        // DOM Elements
        this.mainMenu = document.getElementById('main-menu');
        this.dialogueBox = document.getElementById('dialogue-box');
        this.keyTracker = document.getElementById('key-tracker');
        
        this.bindEvents();
        this.gameLoop();
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => {
            if(window.loadingSystem) {
                window.loadingSystem.show(2000).then(() => this.startGame(false));
            } else {
                this.startGame(false);
            }
        });
        document.getElementById('tutorial-btn').addEventListener('click', () => {
            if(window.loadingSystem) {
                window.loadingSystem.show(2000).then(() => this.startGame(true));
            } else {
                this.startGame(true);
            }
        });
        document.getElementById('menu-settings-btn').addEventListener('click', () => {
            if(window.settingsSystem) window.settingsSystem.openSettings();
        });
        
        const diffBtn = document.getElementById('difficulty-btn');
        const diffLevels = ['EASY', 'NORMAL', 'HARD'];
        const diffMultipliers = { 'EASY': 0.25, 'NORMAL': 0.5, 'HARD': 1.0 };
        this.difficultyStr = 'HARD'; // Default since I just made it hard
        this.difficultyMultiplier = 1.0;
        
        diffBtn.addEventListener('click', () => {
            let idx = diffLevels.indexOf(this.difficultyStr);
            idx = (idx + 1) % diffLevels.length;
            this.difficultyStr = diffLevels[idx];
            this.difficultyMultiplier = diffMultipliers[this.difficultyStr];
            
            diffBtn.innerText = `🔥 DIFFICULTY: ${this.difficultyStr}`;
            
            // Visuals
            if (this.difficultyStr === 'HARD') diffBtn.style.color = '#ff4757', diffBtn.style.borderColor = '#ff4757';
            if (this.difficultyStr === 'NORMAL') diffBtn.style.color = '#ffa502', diffBtn.style.borderColor = '#ffa502';
            if (this.difficultyStr === 'EASY') diffBtn.style.color = '#2ed573', diffBtn.style.borderColor = '#2ed573';
        });
    }

    startGame(isTutorial = false) {
        this.mainMenu.classList.add('hidden');
        this.state = 'overworld';
        
        if (isTutorial) {
            this.loadWorld('tutorial');
            overworld3d.start(this.party);
            this.showDialogue('System', 'Welcome to the Tutorial! Move forward to fight the Hologoomba!');
        } else {
            this.tutorialCompleted = true;
            const initialWorld = this.worldProgression[this.currentWorldIndex];
            this.loadWorld(initialWorld);
            overworld3d.start(this.party);
            this.playCutscene(initialWorld);
        }
    }

    loadWorld(worldName) {
        this.beatBoss = false;
        overworld3d.buildProceduralMap(worldName);
        if (overworld3d.playerObj) {
            overworld3d.playerObj.position.set(0, 1, 0);
        }
    }

    collectCoin() {
        this.coins += 5; // Overworld coins give 5 coins
        this.showDialogue('System', 'Collected 5 Coins!');
        if (window.bountySystem) {
            window.bountySystem.trackProgress('collect_coins', 5);
        }
    }

    triggerEncounter(isBoss = false, enemyData = null) {
        this.state = 'combat';
        overworld3d.hide();
        
        if (overworld3d.controls) {
            overworld3d.controls.unlock();
        }
        
        let encounterEnemies = [];
        
        if (isBoss) {
            this.showDialogue('Boss', 'You dare challenge me?!');
            const boss = JSON.parse(JSON.stringify(enemyData || BOSSES.mario_boss));
            
            // Restore build3D based on ID
            const bossDict = Object.values(BOSSES);
            const foundBoss = bossDict.find(b => b.id === boss.id);
            boss.build3D = foundBoss ? foundBoss.build3D : BOSSES.mario_boss.build3D;
            
            encounterEnemies.push(boss);
        } else {
            const numEnemies = Math.floor(Math.random() * 2) + 1;
            const baseEnemy = enemyData || ENEMIES.goomba;
            
            for (let i=0; i<numEnemies; i++) {
                const enemy = JSON.parse(JSON.stringify(baseEnemy));
                
                // Restore build3D based on ID
                const enemyDict = [...Object.values(ENEMIES), CHARACTERS.steve];
                const foundEnemy = enemyDict.find(e => e.id === enemy.id);
                enemy.build3D = foundEnemy ? foundEnemy.build3D : ENEMIES.goomba.build3D;
                
                encounterEnemies.push(enemy);
            }
        }

        // Apply difficulty multiplier
        encounterEnemies.forEach(e => {
            if (!e.isHologram) {
                e.maxHp = Math.max(1, Math.floor(e.maxHp * this.difficultyMultiplier));
                e.hp = e.maxHp;
                e.attack = Math.max(1, Math.floor(e.attack * this.difficultyMultiplier));
                e.defense = Math.max(0, Math.floor(e.defense * this.difficultyMultiplier));
                e.xpReward = Math.max(1, Math.floor((e.xpReward || 10) * this.difficultyMultiplier));
            }
        });

        setTimeout(() => {
            const currentWorld = this.worldProgression[this.currentWorldIndex] || 'mario';
            combat3d.startCombat(this.party, encounterEnemies, isBoss, currentWorld);
        }, isBoss ? 2000 : 500);
    }

    endCombat(won, wasBoss) {
        if (!won) return; // Handled by combat3d
        
        this.state = 'overworld';
        if (wasBoss) {
            this.beatBoss = true;
            
            const currentWorld = this.worldProgression[this.currentWorldIndex] || 'mario';
            this.grantIcon(currentWorld);
            
            // Wait 2 seconds before playing the victory cutscene
            setTimeout(() => {
                this.playVictoryCutscene(currentWorld);
            }, 2000);
        }
    }

    grantIcon(world) {
        if (!this.collectedKeys.includes(world) && world !== 'lost' && world !== 'animation') {
            this.collectedKeys.push(world);
            
            const iconMap = {
                'mario': '🍄',
                'minecraft': '🥚',
                'pokemon': '🔴',
                'sonic': '💍',
                'amongus': '🚀'
            };
            
            this.keyTracker.classList.remove('hidden');
            const iconEl = document.createElement('div');
            iconEl.style.fontSize = '24px';
            iconEl.innerText = iconMap[world] || '🔑';
            this.keyTracker.appendChild(iconEl);
        }
    }

    changeWorld() {
        const completedWorld = this.worldProgression[this.currentWorldIndex];
        this.grantAbility(completedWorld);
        
        if (completedWorld === 'mario') {
            this.unlockCharacter('mario');
        } else if (completedWorld === 'minecraft') {
            this.unlockCharacter('blong');
        } else if (completedWorld === 'pokemon') {
            this.unlockCharacter('ash');
        } else if (completedWorld === 'cuphead') {
            this.unlockCharacter('mugman');
        } else if (completedWorld === 'magic') {
            this.unlockCharacter('harry_potter');
        } else if (completedWorld === 'sonic') {
            this.unlockCharacter('sonic_char');
        } else if (completedWorld === 'amongus') {
            this.unlockCharacter('imposter_char');
        }
        
        this.currentWorldIndex++;
        if (this.currentWorldIndex >= this.worldProgression.length) {
            this.showDialogue('System', 'You have traversed all dimensions and defeated the Dark Lord! YOU WIN!');
            setTimeout(() => location.reload(), 5000);
            return;
        }
        
        const nextWorld = this.worldProgression[this.currentWorldIndex];
        this.loadWorld(nextWorld);
        this.playCutscene(nextWorld);
    }

    enterBonusLevel() {
        if (this.state === 'dialogue') return; // Prevent spamming
        this.savedWorld = this.worldProgression[this.currentWorldIndex];
        this.showDialogue('System', 'You found a secret Warp Pipe! Entering Bonus Level...');
        
        setTimeout(() => {
            this.loadWorld('bonus');
        }, 2000);
    }

    exitBonusLevel() {
        if (this.state === 'dialogue') return;
        this.showDialogue('System', 'Exiting Bonus Level...');
        setTimeout(() => {
            this.loadWorld(this.savedWorld || 'mario');
        }, 2000);
    }

    collectCoin() {
        // Play simple coin logic, add 50 XP
        this.party.forEach(hero => {
            if (hero.level) {
                hero.exp += 50;
                while (hero.exp >= hero.expToNext) {
                    hero.exp -= hero.expToNext;
                    hero.level++;
                    hero.expToNext = Math.floor(hero.expToNext * 1.5);
                    hero.maxHp += 20;
                    hero.maxMp += 10;
                    hero.attack += 5;
                    hero.defense += 5;
                    hero.hp = hero.maxHp;
                    hero.mp = hero.maxMp;
                    // Note: We don't display all the level up abilities here to avoid spamming dialogue,
                    // but they get the stats!
                }
            }
        });
        
        // Show a brief dialogue but do not interrupt significantly
        this.showDialogue('System', 'Collected a Gold Coin! Party gained 50 EXP!');
    }

    grantAbility(worldName) {
        const ability = UNLOCKABLE_ABILITIES[worldName];
        if (ability) {
            const glitch = this.party[0];
            if (!glitch.abilities.find(a => a.name === ability.name)) {
                glitch.abilities.push(ability);
                this.showDialogue('System', `Glitch learned a new ability: ${ability.name}!`);
            }
        }
    }

    unlockCharacter(charId) {
        if (!this.party.find(p => p.id === charId)) {
            const char = JSON.parse(JSON.stringify(CHARACTERS[charId]));
            char.build3D = CHARACTERS[charId].build3D;
            this.party.push(char);
            this.showDialogue('System', `${char.name} has joined the party!`);
        }
    }

    showDialogue(speaker, text) {
        if (!this.dialogueQueue) this.dialogueQueue = [];
        
        // If a dialogue is currently playing, queue this one and return
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
                    
                    // Process next in queue
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

    playCutscene(worldName) {
        this.isCutscene = true;
        
        // Using a free open-source placeholder video for now (Big Buck Bunny)
        // You can replace this URL later when you have your own mp4 files!
        const videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";
        
        if (typeof videoManager !== 'undefined') {
            videoManager.playVideo(videoUrl, () => {
                this.startInGameCutscene(worldName);
            });
        } else {
            this.startInGameCutscene(worldName);
        }
    }

    playVictoryCutscene(worldName) {
        document.body.classList.add('cutscene-active');
        this.isCutscene = true;
        this.pendingWorldChange = true;
        
        let script = [];
        if (worldName === 'mario') {
            script = [
                { speaker: 'System', text: 'Glitch and Mario managed to defeat the enemies!' },
                { speaker: 'System', text: 'The portal to the Minecraft dimension is now open!' }
            ];
        } else if (worldName === 'minecraft') {
            script = [
                { speaker: 'System', text: 'The Ender Dragon has been defeated!' },
                { speaker: 'Glitch', text: 'Look! The Minecraft icon is inside the Dragon Egg!' },
                { speaker: 'System', text: 'The portal to the Pokemon dimension is now open!' }
            ];
        } else if (worldName === 'pokemon') {
            script = [
                { speaker: 'System', text: 'Mewtwo has been defeated! The Pokemon icon is yours!' },
                { speaker: 'Dark Figure', text: 'HAHAHA! Did you think it would be that easy?!' },
                { speaker: 'System', text: 'WARNING: The Dark Figure has hacked the portal! Transporting to the Lost Dimension!' }
            ];
        } else if (worldName === 'lost') {
            script = [
                { speaker: 'System', text: 'The Giant Shovel Knight has been defeated!' },
                { speaker: 'System', text: 'Transporting to the Cuphead dimension...' }
            ];
        } else if (worldName === 'cuphead') {
            script = [
                { speaker: 'System', text: 'Corrupted Cuphead has been defeated!' },
                { speaker: 'Mugman', text: 'Oh golly, thanks for saving him! I will join your team!' },
                { speaker: 'System', text: 'Transporting to the Magic dimension...' }
            ];
        } else if (worldName === 'magic') {
            script = [
                { speaker: 'System', text: 'Voldemort has been defeated!' },
                { speaker: 'Harry', text: 'Brilliant! I will join you to defeat the Dark Lord!' },
                { speaker: 'System', text: 'Transporting to the Sonic dimension...' }
            ];
        } else if (worldName === 'sonic') {
            script = [
                { speaker: 'System', text: 'Dr. Eggman has been defeated! You obtained the Sonic icon!' },
                { speaker: 'Dark Figure Clone', text: 'Wait! I am a clone of the Dark Figure, but I broke out of his control. I have goodness in my heart!' },
                { speaker: 'Dark Figure Clone', text: 'You have a choice. You can use the icons to turn back into Steve...' },
                { speaker: 'Dark Figure Clone', text: 'OR you can use the icons to create a portal to the Animation Dimension, where you can defeat the Dark Figure once and for all!' },
                { speaker: 'Glitch', text: 'We have to stop him! But we still need the Among Us icon from the Corrupted Imposter!' }
            ];
        } else if (worldName === 'amongus') {
            script = [
                { speaker: 'System', text: 'The corruption has been deleted!' },
                { speaker: 'Imposter', text: 'Thank you for saving me! I will give you the icon and join you as an ally!' },
                { speaker: 'System', text: 'All icons have been collected! Opening portal to the Animation Dimension!' }
            ];
        } else if (worldName === 'animation') {
            script = [
                { speaker: 'System', text: 'After hours and hours of battling... Glitch and his whole team won!' },
                { speaker: 'System', text: 'Glitch was not his normal self anymore... but he saved the video game universe!' }
            ];
        }
        
        if (script.length > 0) {
            this.dialogueQueue = script;
            overworld3d.startCinematicFlyin(() => {
                const nextMsg = this.dialogueQueue.shift();
                this.showDialogue(nextMsg.speaker, nextMsg.text);
            });
        } else {
            this.endCutscene();
        }
    }

    startInGameCutscene(worldName) {
        document.body.classList.add('cutscene-active');
        
        let script = [];
        if (worldName === 'mario') {
            script = [
                { speaker: 'System', text: 'WARNING: Multiverse integrity failing. Virus detected.' },
                { speaker: 'Dark Figure', text: 'Get all keys from video games. The keys shall be video game icons if you want to not be a \'][ljnfpo0497 forever.' },
                { speaker: 'Glitch', text: 'That\'s why I\'m like this! I have turned from an ordinary person into a glitch!' },
                { speaker: 'Glitch', text: 'I feel evil in me... But no! I have to stay good! But now that I am Glitch and not Steve... what should I name myself?' },
                { speaker: '???', text: 'Glitch! Let\'s-a go!' },
                { speaker: 'Glitch', text: 'What the? What was that?' },
                { speaker: '???', text: 'It\'s-a me, Mario!' },
                { speaker: 'Glitch', text: 'Mario? I think I heard that before.' },
                { speaker: 'System', text: 'Suddenly, a flash happened! Glitch remembered the conversation with the dark figure...' },
                { speaker: 'Glitch', text: 'The icons shall be Mario, Minecraft, Sonic, Among Us, and mine!' },
                { speaker: '???', text: 'I want to go speedrunning!' },
                { speaker: 'Glitch', text: 'Wait, look! A banana!' },
                { speaker: '???', text: 'BANANA!' },
                { speaker: 'System', text: 'Mario could not resist the banana, and immediately joined the team!' },
                { speaker: 'System', text: 'Corrupted Bowser holds the first key. Defeat him!' }
            ];
        } else if (worldName === 'minecraft') {
            script = [
                { speaker: 'System', text: 'Entering the Minecraft dimension...' },
                { speaker: 'Glitch', text: 'Wait, who is that up ahead?' },
                { speaker: '???', text: 'Glitch! It\'s me, Oblongplot! But I prefer Blong.' },
                { speaker: 'Blong', text: 'We were friends before you turned into a glitch!' },
                { speaker: 'Glitch', text: 'Blong! We need your help to defeat the Ender Dragon!' }
            ];
        } else if (worldName === 'pokemon') {
            script = [
                { speaker: 'System', text: 'Entering the Pokemon dimension...' },
                { speaker: '???', text: 'Pikachu and I are ready to battle! I\'m Ash!' },
                { speaker: 'Glitch', text: 'Ash! We need to defeat Mewtwo to get the Pokemon icon!' }
            ];
        } else if (worldName === 'lost') {
            script = [
                { speaker: 'Glitch', text: 'Where are we? There are barely any games here...' },
                { speaker: 'System', text: 'This is the Lost Dimension. The Giant Shovel Knight is guarding the portal back!' }
            ];
        } else if (worldName === 'cuphead') {
            script = [
                { speaker: 'System', text: 'Entering the Cuphead dimension...' },
                { speaker: 'Glitch', text: 'Wow, everything looks so vintage! Like an old cartoon.' },
                { speaker: 'Mugman', text: 'Golly! You fellas gotta help! My brother Cuphead got corrupted!' }
            ];
        } else if (worldName === 'magic') {
            script = [
                { speaker: 'System', text: 'Entering the Magic dimension...' },
                { speaker: 'Glitch', text: 'Is this Hogwarts? It looks so dark and mystical.' },
                { speaker: 'Harry', text: 'Watch out! Voldemort is trying to steal the icons!' }
            ];
        } else if (worldName === 'sonic') {
            script = [
                { speaker: '???', text: 'Gotta go fast! I\'m Sonic!' },
                { speaker: 'Glitch', text: 'Sonic! We need to defeat Dr. Eggman to get the Sonic icon!' }
            ];
        } else if (worldName === 'amongus') {
            script = [
                { speaker: 'System', text: 'Entering the Among Us dimension...' },
                { speaker: 'Glitch', text: 'There he is! The Corrupted Imposter is terrorizing everything! We have to delete the corruption!' }
            ];
        } else if (worldName === 'animation') {
            script = [
                { speaker: 'System', text: 'Entering the Animation Dimension...' },
                { speaker: 'Glitch', text: 'So this is the cause of all the chaos...' },
                { speaker: 'Dark Lord', text: 'MUAHAHAHA! You actually made it? Let the final battle begin!' }
            ];
        }

        if (script.length > 0) {
            this.dialogueQueue = script;
            overworld3d.startCinematicFlyin(() => {
                const nextMsg = this.dialogueQueue.shift();
                this.showDialogue(nextMsg.speaker, nextMsg.text);
            });
        } else {
            this.endCutscene();
        }
    }

    endCutscene() {
        this.isCutscene = false;
        document.body.classList.remove('cutscene-active');
        
        if (this.pendingWorldChange) {
            this.pendingWorldChange = false;
            this.changeWorld();
            return;
        }
        
        // Start tutorial if first world and tutorial not done
        if (this.currentWorldIndex === 0 && !this.tutorialCompleted && this.tutorialStep === 0) {
            this.startTutorial();
        }
    }

    startTutorial() {
        this.tutorialStep = 1;
        this.showDialogue('System', 'Welcome to the Multiverse. Use W, A, S, D or Arrow Keys to move your character.');
    }
    
    advanceTutorial(action) {
        if (this.tutorialCompleted || this.state === 'dialogue') return;
        
        if (this.tutorialStep === 1 && action === 'move') {
            this.tutorialStep = 2;
            this.showDialogue('System', 'Great! Now use your Mouse to look around the world.');
        } else if (this.tutorialStep === 2 && action === 'look') {
            this.tutorialStep = 3;
            this.showDialogue('System', 'Press SPACEBAR to jump.');
        } else if (this.tutorialStep === 3 && action === 'jump') {
            this.tutorialStep = 4;
            this.tutorialCompleted = true; // mark done
            this.showDialogue('System', 'I have generated a Holographic Goomba for you. Walk into it to begin combat training!');
            overworld3d.spawnHoloGoomba();
        }
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        
        // Let the combat scene render if active
        if (this.state === 'combat') {
            combat3d.render();
        }
    }
}

class ShopSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.shopUI = document.getElementById('shop-ui');
        this.shopTitle = document.getElementById('shop-title');
        this.coinCount = document.getElementById('coin-count');
        this.shopkeeperImg = document.getElementById('shopkeeper-img');
        this.shopkeeperDialogue = document.getElementById('shopkeeper-dialogue');
        this.shopItemsGrid = document.getElementById('shop-items-grid');
        this.closeBtn = document.getElementById('close-shop-btn');
        
        this.closeBtn.addEventListener('click', () => this.closeShop());
        
        // Define Shop Inventories
        this.shopInventories = {
            mario: {
                armor: [
                    { id: 'mario_armor_1', name: 'Mushroom Vest', desc: '+10 Defense', price: 40, stat: 'defense', val: 10 },
                    { id: 'mario_armor_2', name: 'Star Shield', desc: '+25 Defense', price: 100, stat: 'defense', val: 25 }
                ],
                wizard: [
                    { id: 'mario_wiz_1', name: 'Fire Flower', desc: 'Teaches Fireball (Magic)', price: 60, unlock: 'Fireball' },
                    { id: 'mario_wiz_2', name: '1-Up Shroom', desc: 'Revive & Full Heal', price: 200, item: 'revive' }
                ],
                sword: [
                    { id: 'mario_sword_1', name: 'Plumber Wrench', desc: '+15 Attack', price: 50, stat: 'attack', val: 15 },
                    { id: 'mario_sword_2', name: 'Golden Mallet', desc: '+30 Attack', price: 120, stat: 'attack', val: 30 }
                ]
            },
            minecraft: {
                armor: [
                    { id: 'mc_armor_1', name: 'Iron Chestplate', desc: '+20 Defense', price: 60, stat: 'defense', val: 20 },
                    { id: 'mc_armor_2', name: 'Diamond Armor', desc: '+40 Defense', price: 160, stat: 'defense', val: 40 }
                ],
                wizard: [
                    { id: 'mc_wiz_1', name: 'Enchanted Apple', desc: 'Massive Regen (+100 HP)', price: 100, item: 'heal_100' },
                    { id: 'mc_wiz_2', name: 'Potion of Strength', desc: '+10 Attack permanently', price: 80, stat: 'attack', val: 10 }
                ],
                sword: [
                    { id: 'mc_sword_1', name: 'Cactus Hammer', desc: '+25 Attack', price: 80, stat: 'attack', val: 25 },
                    { id: 'mc_sword_2', name: 'Netherite Sword', desc: '+50 Attack', price: 200, stat: 'attack', val: 50 }
                ]
            },
            pokemon: {
                armor: [
                    { id: 'poke_armor_1', name: 'Exp. Share', desc: 'Boosts XP gain (Fake +15 Def)', price: 80, stat: 'defense', val: 15 },
                    { id: 'poke_armor_2', name: 'Assault Vest', desc: '+35 Defense', price: 150, stat: 'defense', val: 35 }
                ],
                wizard: [
                    { id: 'poke_wiz_1', name: 'Full Restore', desc: 'Fully Heals Party', price: 120, item: 'heal_all' },
                    { id: 'poke_wiz_2', name: 'TM - Flamethrower', desc: 'Learn Charizard Breath', price: 160, unlock: 'Charizard Breath' }
                ],
                sword: [
                    { id: 'poke_sword_1', name: 'Thunder Stone', desc: '+20 Attack', price: 70, stat: 'attack', val: 20 },
                    { id: 'poke_sword_2', name: 'Choice Band', desc: '+45 Attack', price: 180, stat: 'attack', val: 45 }
                ]
            },
            amongus: {
                armor: [
                    { id: 'sus_armor_1', name: 'Thick Spacesuit', desc: '+30 Defense', price: 100, stat: 'defense', val: 30 },
                    { id: 'sus_armor_2', name: 'Titanium Visor', desc: '+50 Defense', price: 200, stat: 'defense', val: 50 }
                ],
                wizard: [
                    { id: 'sus_wiz_1', name: 'MedBay Scanner', desc: 'Full Heal', price: 80, item: 'heal_all' },
                    { id: 'sus_wiz_2', name: 'Admin Card', desc: 'Unlock Shapeshifter Skill', price: 180, unlock: 'Shapeshifter' }
                ],
                sword: [
                    { id: 'sus_sword_1', name: 'Sharp Tongue', desc: '+35 Attack', price: 110, stat: 'attack', val: 35 },
                    { id: 'sus_sword_2', name: 'Imposter Blade', desc: '+60 Attack', price: 240, stat: 'attack', val: 60 }
                ]
            },
            animation: {
                armor: [
                    { id: 'anim_armor_1', name: 'Vector Shield', desc: '+40 Defense', price: 120, stat: 'defense', val: 40 },
                    { id: 'anim_armor_2', name: 'Firewall', desc: '+70 Defense', price: 300, stat: 'defense', val: 70 }
                ],
                wizard: [
                    { id: 'anim_wiz_1', name: 'Ctrl+Z (Undo)', desc: 'Revive & Full Heal', price: 200, item: 'revive' },
                    { id: 'anim_wiz_2', name: 'Code Injector', desc: '+20 All Stats', price: 400, stat: 'all', val: 20 }
                ],
                sword: [
                    { id: 'anim_sword_1', name: 'Cursor Spear', desc: '+50 Attack', price: 160, stat: 'attack', val: 50 },
                    { id: 'anim_sword_2', name: 'The Delete Key', desc: '+100 Attack', price: 500, stat: 'attack', val: 100 }
                ]
            },
            sonic: {
                armor: [
                    { id: 'sonic_armor_1', name: 'Speed Shoes', desc: '+30 Speed, +10 Def', price: 140, stat: 'speed', val: 30 },
                    { id: 'sonic_armor_2', name: 'Chaos Shield', desc: '+60 Defense', price: 280, stat: 'defense', val: 60 }
                ],
                wizard: [
                    { id: 'sonic_wiz_1', name: 'Ring Box', desc: 'Full Heal', price: 100, item: 'heal_all' },
                    { id: 'sonic_wiz_2', name: 'Chaos Emerald Shard', desc: 'Learn Spin Dash', price: 300, unlock: 'Spin Dash' }
                ],
                sword: [
                    { id: 'sonic_sword_1', name: 'Piko Piko Hammer', desc: '+45 Attack', price: 150, stat: 'attack', val: 45 },
                    { id: 'sonic_sword_2', name: 'Caliburn', desc: '+90 Attack', price: 440, stat: 'attack', val: 90 }
                ]
            }
        };

        this.shopkeepers = {
            wizard_shop: { img: window.MAGICIAN_TOAD_IMG, name: 'Magician Toad', greeting: 'Welcome to the Magic Shop!' },
            sword_shop: { img: window.BLACKSMITH_VILLAGER_IMG, name: 'Blacksmith Villager', greeting: 'Need a sharp blade? Hmmm.' },
            armor_shop: { img: window.ARMOR_NURSE_JOY_IMG, name: 'Armor Nurse Joy', greeting: 'Protect your party with my armor!' }
        };
    }

    openShop(shopType) { 
        this.currentWorld = window.gameSystem.worldProgression[window.gameSystem.currentWorldIndex];
        this.currentShopType = shopType.replace('_shop', ''); // wizard, sword, armor
        
        let img = ASSETS.shopkeeper_toad; // fallback
        if (window.SHOPKEEPER_ART && window.SHOPKEEPER_ART[this.currentWorld] && window.SHOPKEEPER_ART[this.currentWorld][this.currentShopType]) {
            img = window.SHOPKEEPER_ART[this.currentWorld][this.currentShopType];
        }
        
        let greeting = 'Welcome!';
        if (this.currentShopType === 'wizard') greeting = 'Need some magic items?';
        if (this.currentShopType === 'sword') greeting = 'Need a sharp blade?';
        if (this.currentShopType === 'armor') greeting = 'Protect your party with my gear!';

        this.shopkeeperImg.src = img;
        this.shopkeeperDialogue.innerText = `"${greeting}"`;
        this.shopTitle.innerText = `${this.currentShopType.toUpperCase()} SHOP`;
        
        this.updateCoinDisplay();
        this.renderItems(this.currentWorld, this.currentShopType);
        
        this.shopUI.classList.remove('hidden');
        if (overworld3d) overworld3d.controls.unlock();
        this.game.state = 'shop';
    }

    closeShop() {
        this.shopUI.classList.add('hidden');
        if (overworld3d) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }

    updateCoinDisplay() {
        this.coinCount.innerText = this.game.coins || 0;
    }

    renderItems(worldName, shopType) {
        this.shopItemsGrid.innerHTML = '';
        
        const worldItems = this.shopInventories[worldName];
        if (!worldItems || !worldItems[shopType]) return;
        
        const items = worldItems[shopType];
        
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            
            const finalPrice = Math.max(1, Math.floor(item.price * (this.game.difficultyMultiplier || 1.0)));
            const canAfford = (this.game.coins || 0) >= finalPrice;
            
            el.innerHTML = `
                <div class="item-name">${item.name}</div>
                <div class="item-desc">${item.desc}</div>
                <div class="item-price">💰 ${finalPrice}</div>
                <button class="buy-btn" ${canAfford ? '' : 'disabled'}>Buy</button>
            `;
            
            el.querySelector('.buy-btn').addEventListener('click', () => this.buyItem(item));
            
            this.shopItemsGrid.appendChild(el);
        });
    }

    buyItem(item) {
        const finalPrice = Math.max(1, Math.floor(item.price * (this.game.difficultyMultiplier || 1.0)));
        if ((this.game.coins || 0) >= finalPrice) {
            this.game.coins -= finalPrice;
            this.updateCoinDisplay();
            
            // Apply effect
            if (item.stat) {
                this.game.party.forEach(hero => {
                    if (item.stat === 'all') {
                        hero.maxHp += item.val;
                        hero.attack += item.val;
                        hero.defense += item.val;
                    } else if (hero[item.stat] !== undefined) {
                        hero[item.stat] += item.val;
                    }
                });
                this.game.showDialogue('System', `Bought ${item.name}! Stats increased!`);
            } else if (item.item === 'heal_all' || item.item === 'heal_100' || item.item === 'revive') {
                this.game.party.forEach(hero => { hero.hp = hero.maxHp; });
                this.game.showDialogue('System', `Bought ${item.name}! Party healed!`);
            } else if (item.unlock) {
                const ability = Object.values(UNLOCKABLE_ABILITIES).find(a => a.name === item.unlock);
                if (ability) {
                    this.game.party[0].abilities.push(ability);
                    this.game.showDialogue('System', `Learned ${item.unlock}!`);
                }
            }
            
            this.renderItems(this.currentWorld, this.currentShopType);
        }
    }
}

class BountySystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.bountyUI = document.getElementById('bounty-ui');
        this.closeBtn = document.getElementById('close-bounty-btn');
        this.acceptBtn = document.getElementById('accept-quest-btn');
        this.claimBtn = document.getElementById('claim-quest-btn');
        
        this.questTitle = document.getElementById('current-quest-title');
        this.questDesc = document.getElementById('current-quest-desc');
        this.questProgress = document.getElementById('quest-progress');
        
        this.activeQuest = null;
        
        this.quests = [
            { id: 'q1', type: 'kill_enemy', targetCount: 3, rewardCoins: 100, rewardXp: 200, title: 'Monster Hunter', desc: 'Defeat 3 regular enemies in any dimension.' },
            { id: 'q2', type: 'kill_boss', targetCount: 1, rewardCoins: 300, rewardXp: 1000, title: 'Boss Slayer', desc: 'Defeat 1 Boss.' },
            { id: 'q3', type: 'collect_coins', targetCount: 50, rewardCoins: 0, rewardXp: 500, title: 'Coin Collector', desc: 'Collect 50 coins from the overworld or combat.' }
        ];

        this.closeBtn.addEventListener('click', () => this.closeBountyBoard());
        this.acceptBtn.addEventListener('click', () => this.assignRandomQuest());
        this.claimBtn.addEventListener('click', () => this.claimReward());
    }
    
    openBountyBoard() {
        this.updateUI();
        this.bountyUI.classList.remove('hidden');
        if (overworld3d) overworld3d.controls.unlock();
        this.game.state = 'bounty';
    }
    
    closeBountyBoard() {
        this.bountyUI.classList.add('hidden');
        if (overworld3d) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }
    
    assignRandomQuest() {
        const q = this.quests[Math.floor(Math.random() * this.quests.length)];
        this.activeQuest = { ...q, currentCount: 0 };
        this.updateUI();
    }
    
    updateUI() {
        if (!this.activeQuest) {
            this.questTitle.innerText = 'No Active Quest';
            this.questDesc.innerText = 'Talk to the Quest Master to receive a new bounty.';
            this.questProgress.innerText = '0 / 0';
            this.acceptBtn.classList.remove('hidden');
            this.claimBtn.classList.add('hidden');
        } else {
            this.questTitle.innerText = this.activeQuest.title;
            this.questDesc.innerText = this.activeQuest.desc;
            this.questProgress.innerText = `${this.activeQuest.currentCount} / ${this.activeQuest.targetCount}`;
            
            this.acceptBtn.classList.add('hidden');
            
            if (this.activeQuest.currentCount >= this.activeQuest.targetCount) {
                this.claimBtn.classList.remove('hidden');
                this.questProgress.style.color = '#fbbf24'; // Gold when done
            } else {
                this.claimBtn.classList.add('hidden');
                this.questProgress.style.color = '#4ade80';
            }
        }
    }
    
    claimReward() {
        if (this.activeQuest && this.activeQuest.currentCount >= this.activeQuest.targetCount) {
            this.game.coins += this.activeQuest.rewardCoins;
            this.game.party[0].exp += this.activeQuest.rewardXp; // give to main char
            this.game.showDialogue('Quest Master', `Bounty claimed! Earned ${this.activeQuest.rewardCoins} Coins & ${this.activeQuest.rewardXp} XP!`);
            this.activeQuest = null;
            this.updateUI();
        }
    }
    
    trackProgress(type, amount = 1) {
        if (this.activeQuest && this.activeQuest.type === type) {
            this.activeQuest.currentCount += amount;
            if (this.activeQuest.currentCount > this.activeQuest.targetCount) {
                this.activeQuest.currentCount = this.activeQuest.targetCount;
            }
            if (this.game.state === 'overworld') {
                // optional visual update if needed, but usually players check board
            }
        }
    }
}


class SettingsSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.settingsUI = document.getElementById('settings-ui');
        this.pauseUI = document.getElementById('pause-ui');
        
        // Settings elements
        this.volSlider = document.getElementById('volume-slider');
        this.invincToggle = document.getElementById('invincible-toggle');
        this.mirrorToggle = document.getElementById('mirror-toggle');
        this.colorPicker = document.getElementById('theme-color-picker');
        
        // Pause elements
        this.pauseVolSlider = document.getElementById('pause-volume-slider');
        this.pauseInvincToggle = document.getElementById('pause-invincible-toggle');
        this.pauseMirrorToggle = document.getElementById('pause-mirror-toggle');
        this.pauseColorPicker = document.getElementById('pause-theme-color-picker');
        
        // State
        this.godMode = false;
        this.mirrorMode = false;
        this.volume = 50;
        this.themeColor = '#fbbf24';
        
        this.bindEvents();
    }
    
    bindEvents() {
        // Main Settings Close
        document.getElementById('close-settings-btn').addEventListener('click', () => this.closeSettings());
        
        // Pause Menu Close/Resume
        document.getElementById('resume-btn').addEventListener('click', () => this.closePauseMenu());
        document.getElementById('resume-main-btn').addEventListener('click', () => this.closePauseMenu());
        
        // Sync Main Settings -> State
        this.volSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.invincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.mirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.colorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));
        
        // Sync Pause Settings -> State
        this.pauseVolSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.pauseInvincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.pauseMirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.pauseColorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));
        
        // Moveset Guide
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
            html += `<ul style="list-style-type:none; padding-left:10px;">`;
            hero.abilities.forEach(ab => {
                let costStr = ab.mpCost ? `<span style="color:#60a5fa;">${ab.mpCost} MP</span>` : '0 MP';
                html += `<li style="margin-bottom:8px;">
                    <strong>${ab.name}</strong> - Cost: ${costStr} <br>
                    <span style="font-size:0.9em; color:#ccc;">Power multiplier: x${ab.power || 1}. ${ab.type === 'heal' ? 'Heals target.' : 'Damages enemy.'} ${ab.type === 'aoe' ? 'Hits all enemies.' : ''}</span>
                </li>`;
            });
            html += `</ul>`;
        });
        
        content.innerHTML = html;
        modal.classList.remove('hidden');
    }
    
    setVolume(val) {
        this.volume = val;
        this.volSlider.value = val;
        this.pauseVolSlider.value = val;
        // Apply volume logic here later
    }
    
    setGodMode(val) {
        this.godMode = val;
        this.invincToggle.checked = val;
        this.pauseInvincToggle.checked = val;
        this.game.godMode = val; // Set on game system for easy access
    }
    
    setMirrorMode(val) {
        this.mirrorMode = val;
        this.mirrorToggle.checked = val;
        this.pauseMirrorToggle.checked = val;
        if (val) {
            document.body.classList.add('mirror-mode');
        } else {
            document.body.classList.remove('mirror-mode');
        }
    }
    
    setThemeColor(val) {
        this.themeColor = val;
        this.colorPicker.value = val;
        this.pauseColorPicker.value = val;
        document.documentElement.style.setProperty('--primary-color', val);
    }
    
    openSettings() {
        this.settingsUI.classList.remove('hidden');
        if (overworld3d) overworld3d.controls.unlock();
        this.game.state = 'settings';
    }
    
    closeSettings() {
        this.settingsUI.classList.add('hidden');
        if (overworld3d) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }
    
    openPauseMenu() {
        this.pauseUI.classList.remove('hidden');
        if (overworld3d) overworld3d.controls.unlock();
        this.game.state = 'paused';
    }
    
    closePauseMenu() {
        this.pauseUI.classList.add('hidden');
        if (overworld3d) overworld3d.controls.lock();
        this.game.state = 'overworld';
    }
}

class LoadingSystem {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.blockStack = document.querySelector('.block-stack');
        this.blocks = Array.from(this.blockStack.children);
    }
    
    show(duration = 2000) {
        return new Promise(resolve => {
            this.loadingScreen.classList.remove('hidden');
            
            // Reset blocks
            this.blocks.forEach(b => b.classList.add('hidden-block'));
            
            // Animate blocks appearing
            let delay = 0;
            this.blocks.forEach((b, index) => {
                setTimeout(() => {
                    b.classList.remove('hidden-block');
                }, delay);
                delay += 400; // block placed every 400ms
            });
            
            setTimeout(() => {
                this.loadingScreen.classList.add('hidden');
                resolve();
            }, duration);
        });
    }
}

window.onload = () => {
    window.loadingSystem = new LoadingSystem();
    // Initialize immediately without loading screen (shows Main Menu)
    window.gameSystem = new GameSystem3D();
    window.shopSystem = new ShopSystem(window.gameSystem);
    window.bountySystem = new BountySystem(window.gameSystem);
    window.settingsSystem = new SettingsSystem(window.gameSystem);
    
    // Add Settings and Pause buttons to overworld UI
    const controlsUI = document.getElementById('ui-layer');
    if (controlsUI) {
        // Physical Bounty Board replaces the floating button.
        
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
    
    // Also trigger loading screen on portal transitions
    const originalNextWorld = window.gameSystem.nextWorld.bind(window.gameSystem);
    window.gameSystem.nextWorld = function() {
        window.loadingSystem.show(2000).then(() => {
            originalNextWorld();
        });
    };
};
