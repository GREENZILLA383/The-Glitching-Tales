class GameSystem {
    constructor() {
        this.state = 'menu'; // menu, overworld, combat, dialogue
        this.party = [
            JSON.parse(JSON.stringify(CHARACTERS.glitch)),
            JSON.parse(JSON.stringify(CHARACTERS.mario)),
            JSON.parse(JSON.stringify(CHARACTERS.steve))
        ];
        
        this.worldProgression = ['mario', 'minecraft', 'pokemon', 'amongus'];
        this.currentWorldIndex = 0;
        this.beatBoss = false;

        // DOM Elements
        this.mainMenu = document.getElementById('main-menu');
        this.dialogueBox = document.getElementById('dialogue-box');
        
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    startGame() {
        this.mainMenu.classList.add('hidden');
        this.state = 'overworld';
        this.loadWorld(this.worldProgression[this.currentWorldIndex]);
        overworld.start();
        
        this.showDialogue('Glitch', 'Whoa, where are we? This looks like a 3D platformer!');
    }

    loadWorld(worldName) {
        this.beatBoss = false;
        overworld.setWorld(worldName);
    }

    triggerEncounter(isBoss = false) {
        this.state = 'combat';
        
        let encounterEnemies = [];
        
        if (isBoss) {
            this.showDialogue('Boss', 'You dare challenge me?!');
            // Assuming mario world boss for now
            encounterEnemies.push(JSON.parse(JSON.stringify(BOSSES.mario_boss)));
        } else {
            let enemyTypes = [ENEMIES.goomba]; // Default
            
            if (this.worldProgression[this.currentWorldIndex] === 'minecraft') {
                enemyTypes = [ENEMIES.creeper];
            }
            
            const numEnemies = Math.floor(Math.random() * 2) + 1;
            for (let i=0; i<numEnemies; i++) {
                const template = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                encounterEnemies.push(JSON.parse(JSON.stringify(template)));
            }
        }

        setTimeout(() => {
            combatSystem.startCombat(this.party, encounterEnemies, isBoss);
        }, isBoss ? 2000 : 500); // Delay for dialogue if boss
    }

    endCombat(won, wasBoss) {
        if (!won) {
            // If they died, reload
            return;
        }
        
        this.state = 'overworld';
        if (wasBoss) {
            this.beatBoss = true;
            this.showDialogue('System', 'Boss defeated! The portal is now open!');
            this.changeWorld();
        }
    }

    changeWorld() {
        const completedWorld = this.worldProgression[this.currentWorldIndex];
        this.grantAbility(completedWorld);
        
        this.currentWorldIndex++;
        if (this.currentWorldIndex >= this.worldProgression.length) {
            this.showDialogue('System', 'You have traversed all dimensions! YOU WIN!');
            setTimeout(() => location.reload(), 5000);
            return;
        }

        const nextWorld = this.worldProgression[this.currentWorldIndex];
        setTimeout(() => {
            this.showDialogue('Glitch', `Entering ${nextWorld} dimension!`);
            this.loadWorld(nextWorld);
        }, 2000);
    }

    grantAbility(worldName) {
        const ability = UNLOCKABLE_ABILITIES[worldName];
        if (ability) {
            const glitch = this.party[0]; // Glitch is always first
            // Check if already has it
            if (!glitch.abilities.find(a => a.name === ability.name)) {
                glitch.abilities.push(ability);
                this.showDialogue('System', `Glitch learned a new ability: ${ability.name}!`);
            }
        }
    }

    showDialogue(speaker, text) {
        const prevState = this.state;
        this.state = 'dialogue';
        
        this.dialogueBox.classList.remove('hidden');
        this.dialogueBox.querySelector('.speaker-name').innerText = speaker;
        
        // Typewriter effect
        const textContainer = this.dialogueBox.querySelector('.dialogue-text');
        textContainer.innerText = '';
        let i = 0;
        
        const typeWriter = setInterval(() => {
            textContainer.innerText += text.charAt(i);
            i++;
            if (i >= text.length) {
                clearInterval(typeWriter);
                
                // Wait for click to close
                const closeHandler = () => {
                    this.dialogueBox.classList.add('hidden');
                    this.state = prevState;
                    document.removeEventListener('click', closeHandler);
                };
                
                setTimeout(() => {
                    document.addEventListener('click', closeHandler);
                }, 500);
            }
        }, 30);
    }
}

window.onload = () => {
    window.gameSystem = new GameSystem();
};
