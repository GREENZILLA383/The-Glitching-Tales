// Custom SVG Sprites for Characters
const SVGS = {
    glitch: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Glow effect -->
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <circle cx="50" cy="50" r="45" fill="#1e3a8a" />
            <path d="M 30 40 Q 50 20 70 40 L 70 70 Q 50 90 30 70 Z" fill="#38bdf8" filter="url(#glow)"/>
            <!-- Friendly Eyes -->
            <rect x="40" y="45" width="6" height="12" rx="3" fill="white" />
            <rect x="54" y="45" width="6" height="12" rx="3" fill="white" />
            <!-- Smile -->
            <path d="M 40 65 Q 50 75 60 65" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>
    `,
    marioCrazy: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="45" fill="#ef4444" />
            <!-- Motion Blur Lines -->
            <path d="M 10 30 L 90 30 M 15 50 L 85 50 M 10 70 L 90 70" stroke="rgba(255,255,255,0.3)" stroke-width="4" stroke-dasharray="5,5"/>
            <!-- Face -->
            <circle cx="50" cy="55" r="30" fill="#fcd34d" />
            <!-- Red Hat -->
            <path d="M 15 45 Q 50 10 85 45 L 80 50 L 20 50 Z" fill="#b91c1c" />
            <ellipse cx="65" cy="45" rx="20" ry="10" fill="#b91c1c" />
            <!-- Crazy Eyes -->
            <circle cx="35" cy="55" r="8" fill="white" />
            <circle cx="35" cy="55" r="3" fill="red" />
            <circle cx="65" cy="55" r="12" fill="white" />
            <circle cx="65" cy="55" r="4" fill="red" />
            <!-- Mustache -->
            <path d="M 30 70 Q 50 60 70 70 Q 50 80 30 70 Z" fill="black" />
        </svg>
    `,
    steve: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="45" fill="#0ea5e9" />
            <!-- Blocky Head -->
            <rect x="25" y="25" width="50" height="50" fill="#d4a373" />
            <!-- Hair -->
            <rect x="25" y="25" width="50" height="15" fill="#4a3018" />
            <!-- Eyes -->
            <rect x="35" y="45" width="10" height="10" fill="white" />
            <rect x="40" y="45" width="5" height="10" fill="#43308a" />
            <rect x="55" y="45" width="10" height="10" fill="white" />
            <rect x="60" y="45" width="5" height="10" fill="#43308a" />
            <!-- Mouth/Beard -->
            <rect x="40" y="60" width="20" height="5" fill="#4a3018" />
        </svg>
    `,
    goomba: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="45" fill="#f59e0b" />
            <!-- Head -->
            <path d="M 20 60 Q 50 10 80 60 L 70 70 L 30 70 Z" fill="#92400e" />
            <!-- Angry Eyes -->
            <path d="M 30 45 L 45 55 L 45 60 L 30 50 Z" fill="black" />
            <path d="M 70 45 L 55 55 L 55 60 L 70 50 Z" fill="black" />
            <!-- Fangs -->
            <path d="M 40 70 L 45 65 L 50 70 Z" fill="white" />
            <path d="M 60 70 L 55 65 L 50 70 Z" fill="white" />
        </svg>
    `,
    creeper: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="45" fill="#22c55e" />
            <!-- Head -->
            <rect x="25" y="25" width="50" height="50" fill="#16a34a" />
            <rect x="30" y="30" width="10" height="10" fill="#86efac" />
            <rect x="60" y="25" width="10" height="10" fill="#14532d" />
            <!-- Face -->
            <rect x="35" y="45" width="10" height="10" fill="black" />
            <rect x="55" y="45" width="10" height="10" fill="black" />
            <rect x="45" y="55" width="10" height="15" fill="black" />
            <rect x="40" y="65" width="5" height="10" fill="black" />
            <rect x="55" y="65" width="5" height="10" fill="black" />
        </svg>
    `,
    boss_bowser: `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="45" fill="#991b1b" />
            <defs>
                <filter id="darkGlow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <!-- Shell/Body -->
            <circle cx="50" cy="60" r="30" fill="#14532d" filter="url(#darkGlow)"/>
            <path d="M 20 60 Q 50 30 80 60" fill="none" stroke="#fcd34d" stroke-width="5" />
            <!-- Spikes -->
            <path d="M 35 40 L 40 25 L 45 40 Z" fill="#94a3b8" />
            <path d="M 55 40 L 60 25 L 65 40 Z" fill="#94a3b8" />
            <path d="M 50 30 L 50 15 L 55 30 Z" fill="#94a3b8" />
            <!-- Corrupted Face -->
            <circle cx="50" cy="70" r="20" fill="#facc15" />
            <rect x="35" y="65" width="30" height="5" fill="black" />
            <circle cx="40" cy="65" r="4" fill="#dc2626" />
            <circle cx="60" cy="65" r="4" fill="#dc2626" />
        </svg>
    `
};

const CHARACTERS = {
    glitch: {
        id: 'glitch',
        name: 'Glitch',
        maxHp: 100,
        hp: 100,
        maxMp: 50,
        mp: 50,
        attack: 15,
        defense: 10,
        speed: 12,
        sprite: SVGS.glitch,
        abilities: [
            { name: 'Basic Attack', type: 'attack', power: 1, cost: 0 }
        ]
    },
    mario: {
        id: 'mario',
        name: 'Speedrunner Mario',
        maxHp: 80,
        hp: 80,
        maxMp: 30,
        mp: 30,
        attack: 12,
        defense: 8,
        speed: 25,
        sprite: SVGS.marioCrazy,
        abilities: [
            { name: 'BLJ', type: 'attack', power: 1.5, cost: 5, description: 'Backwards Long Jump. High damage.' },
            { name: 'Frame Perfect', type: 'buff', stat: 'speed', amount: 10, cost: 10 }
        ]
    },
    steve: {
        id: 'steve',
        name: 'Steve',
        maxHp: 120,
        hp: 120,
        maxMp: 20,
        mp: 20,
        attack: 18,
        defense: 15,
        speed: 8,
        sprite: SVGS.steve,
        abilities: [
            { name: 'Diamond Sword', type: 'attack', power: 1.8, cost: 0 },
            { name: 'Eat Steak', type: 'heal', power: 40, cost: 5 }
        ]
    }
,

    blong: {
        id: 'blong',
        name: 'Blong',
        maxHp: 150,
        hp: 150,
        maxMp: 20,
        mp: 20,
        attack: 16,
        defense: 20,
        speed: 10,
        sprite: SVGS.steve || '<svg></svg>',
        abilities: [
            { name: 'Diamond Sword', type: 'attack', power: 1.5, cost: 0 },
            { name: 'Block Shield', type: 'buff', stat: 'defense', amount: 15, cost: 10 }
        ]
    },
    ash: {
        id: 'ash',
        name: 'Ash',
        maxHp: 90,
        hp: 90,
        maxMp: 60,
        mp: 60,
        attack: 14,
        defense: 10,
        speed: 18,
        sprite: SVGS.marioCrazy || '<svg></svg>',
        abilities: [
            { name: 'Thunderbolt', type: 'attack', power: 2.0, cost: 15 },
            { name: 'Use Potion', type: 'heal', power: 50, cost: 5 }
        ]
    },
    sonic_char: {
        id: 'sonic_char',
        name: 'Sonic',
        maxHp: 80,
        hp: 80,
        maxMp: 40,
        mp: 40,
        attack: 18,
        defense: 8,
        speed: 35,
        sprite: SVGS.marioCrazy || '<svg></svg>',
        abilities: [
            { name: 'Spin Dash', type: 'attack', power: 2.0, cost: 10 },
            { name: 'Gotta Go Fast', type: 'buff', stat: 'speed', amount: 20, cost: 15 }
        ]
    },
    imposter_char: {
        id: 'imposter_char',
        name: 'Imposter',
        maxHp: 110,
        hp: 110,
        maxMp: 30,
        mp: 30,
        attack: 22,
        defense: 12,
        speed: 15,
        sprite: SVGS.steve || '<svg></svg>',
        abilities: [
            { name: 'Knife Slash', type: 'attack', power: 2.5, cost: 15 },
            { name: 'Vent', type: 'buff', stat: 'defense', amount: 30, cost: 10 }
        ]
    },
    mugman: {
        id: 'mugman',
        name: 'Mugman',
        maxHp: 95,
        hp: 95,
        maxMp: 40,
        mp: 40,
        attack: 16,
        defense: 14,
        speed: 12,
        sprite: SVGS.steve || '<svg></svg>', // Will update SVGs next
        abilities: [
            { name: 'Peashooter', type: 'attack', power: 1.5, cost: 0 },
            { name: 'Chaser', type: 'attack', power: 1.2, cost: 5 }
        ]
    },
    harry_potter: {
        id: 'harry_potter',
        name: 'Harry Potter',
        maxHp: 85,
        hp: 85,
        maxMp: 80,
        mp: 80,
        attack: 10,
        defense: 10,
        speed: 14,
        sprite: SVGS.steve || '<svg></svg>', // Will update SVGs next
        abilities: [
            { name: 'Expelliarmus', type: 'attack', power: 1.8, cost: 15 },
            { name: 'Expecto Patronum', type: 'buff', stat: 'defense', amount: 40, cost: 25 }
        ]
    }
};

const ENEMIES = {
    goomba: {
        id: 'goomba',
        name: 'Goomba',
        maxHp: 30,
        hp: 30,
        attack: 8,
        defense: 5,
        speed: 5,
        sprite: SVGS.goomba,
        xpReward: 10
    },
    creeper: {
        id: 'creeper',
        name: 'Creeper',
        maxHp: 50,
        hp: 50,
        attack: 25,
        defense: 8,
        speed: 15,
        sprite: SVGS.creeper,
        xpReward: 20
    }
,

    zombie: { id: 'zombie', name: 'Zombie', maxHp: 40, hp: 40, attack: 12, defense: 8, speed: 4, sprite: SVGS.goomba || '<svg></svg>', xpReward: 15 },
    rocket_grunt: { id: 'rocket_grunt', name: 'Rocket Grunt', maxHp: 45, hp: 45, attack: 15, defense: 5, speed: 10, sprite: SVGS.goomba || '<svg></svg>', xpReward: 20 },
    wild_pokemon: { id: 'wild_pokemon', name: 'Wild Pokemon', maxHp: 35, hp: 35, attack: 18, defense: 6, speed: 15, sprite: SVGS.creeper || '<svg></svg>', xpReward: 20 },
    lost_soul: { id: 'lost_soul', name: 'Lost Soul', maxHp: 60, hp: 60, attack: 20, defense: 10, speed: 8, sprite: SVGS.goomba || '<svg></svg>', xpReward: 25 },
    glitch_minion: { id: 'glitch_minion', name: 'Glitch Minion', maxHp: 50, hp: 50, attack: 25, defense: 5, speed: 12, sprite: SVGS.creeper || '<svg></svg>', xpReward: 25 },
    motobug: { id: 'motobug', name: 'Motobug', maxHp: 35, hp: 35, attack: 15, defense: 15, speed: 10, sprite: SVGS.goomba || '<svg></svg>', xpReward: 30 },
    buzzbomber: { id: 'buzzbomber', name: 'Buzz Bomber', maxHp: 30, hp: 30, attack: 20, defense: 5, speed: 20, sprite: SVGS.creeper || '<svg></svg>', xpReward: 30 },
    imposter_minion: { id: 'imposter_minion', name: 'Mini Imposter', maxHp: 70, hp: 70, attack: 25, defense: 15, speed: 12, sprite: SVGS.goomba || '<svg></svg>', xpReward: 40 },
    corrupted_crewmate: { id: 'corrupted_crewmate', name: 'Corrupted Crewmate', maxHp: 80, hp: 80, attack: 15, defense: 20, speed: 8, sprite: SVGS.creeper || '<svg></svg>', xpReward: 40 },
    dark_minion: { id: 'dark_minion', name: 'Dark Minion', maxHp: 100, hp: 100, attack: 30, defense: 20, speed: 15, sprite: SVGS.goomba || '<svg></svg>', xpReward: 50 },
    lag_monster: { id: 'lag_monster', name: 'Lag Monster', maxHp: 150, hp: 150, attack: 20, defense: 30, speed: 5, sprite: SVGS.creeper || '<svg></svg>', xpReward: 60 },
    cuphead_minion: { id: 'cuphead_minion', name: 'Casino Chip', maxHp: 50, hp: 50, attack: 22, defense: 10, speed: 15, sprite: SVGS.goomba || '<svg></svg>', xpReward: 35 },
    dice_minion: { id: 'dice_minion', name: 'King Dice Minion', maxHp: 65, hp: 65, attack: 25, defense: 12, speed: 18, sprite: SVGS.creeper || '<svg></svg>', xpReward: 40 },
    dementor: { id: 'dementor', name: 'Dementor', maxHp: 80, hp: 80, attack: 30, defense: 25, speed: 10, sprite: SVGS.creeper || '<svg></svg>', xpReward: 45 },
    death_eater: { id: 'death_eater', name: 'Death Eater', maxHp: 70, hp: 70, attack: 35, defense: 15, speed: 20, sprite: SVGS.goomba || '<svg></svg>', xpReward: 45 }
};

const BOSSES = {
    mario_boss: {
        id: 'corrupted_bowser',
        name: 'Corrupted Bowser',
        maxHp: 150,
        hp: 150,
        attack: 20,
        defense: 12,
        speed: 10,
        sprite: SVGS.boss_bowser,
        isBoss: true,
        xpReward: 100
    }
,

    minecraft_boss: { id: 'ender_dragon', name: 'Ender Dragon', maxHp: 300, hp: 300, attack: 35, defense: 25, speed: 20, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 200 },
    pokemon_boss: { id: 'mewtwo', name: 'Mewtwo', maxHp: 400, hp: 400, attack: 50, defense: 20, speed: 40, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 300 },
    lost_boss: { id: 'shovel_knight', name: 'Giant Shovel Knight', maxHp: 450, hp: 450, attack: 40, defense: 45, speed: 15, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 350 },
    cuphead_boss: { id: 'corrupted_cuphead', name: 'Corrupted Cuphead', maxHp: 500, hp: 500, attack: 55, defense: 20, speed: 30, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 400 },
    magic_boss: { id: 'voldemort', name: 'Voldemort', maxHp: 550, hp: 550, attack: 65, defense: 35, speed: 25, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 450 },
    sonic_boss: { id: 'eggman', name: 'Dr. Eggman', maxHp: 600, hp: 600, attack: 60, defense: 50, speed: 10, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 500 },
    amongus_boss: { id: 'corrupted_imposter', name: 'Corrupted Imposter', maxHp: 750, hp: 750, attack: 70, defense: 40, speed: 30, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 600 },
    animation_boss: { id: 'dark_lord', name: 'The Dark Lord', maxHp: 1500, hp: 1500, attack: 100, defense: 60, speed: 40, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 1000 }
};

// Abilities that Glitch learns
const UNLOCKABLE_ABILITIES = {
    mario: { name: 'Fireball', type: 'attack', power: 1.5, cost: 10, description: 'Throw a bouncing fireball.' },
    pokemon: { name: 'Charizard Breath', type: 'attack', power: 2.5, cost: 20, description: 'Breathe massive fire.' },
    minecraft: { name: 'Place Blocks', type: 'defense', power: 0, cost: 15, description: 'Increases defense by placing a wall.' },
    amongus: { name: 'Shapeshifter', type: 'special', cost: 25, description: 'Copy an enemy attack.' }
};
