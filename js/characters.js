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
};

// Abilities that Glitch learns
const UNLOCKABLE_ABILITIES = {
    mario: { name: 'Fireball', type: 'attack', power: 1.5, cost: 10, description: 'Throw a bouncing fireball.' },
    pokemon: { name: 'Charizard Breath', type: 'attack', power: 2.5, cost: 20, description: 'Breathe massive fire.' },
    minecraft: { name: 'Place Blocks', type: 'defense', power: 0, cost: 15, description: 'Increases defense by placing a wall.' },
    amongus: { name: 'Shapeshifter', type: 'special', cost: 25, description: 'Copy an enemy attack.' }
};
