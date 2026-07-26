const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../characters.js');
let content = fs.readFileSync(targetPath, 'utf8');

// Insert Characters
const newChars = `
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
`;

content = content.replace(/161:\s*\]\n\s*}\n};/, "        ]\n    },\n" + newChars + "\n};");
// simpler: just find the index
let charEnd = content.indexOf('};\n\nconst ENEMIES');
content = content.substring(0, charEnd) + ',\n' + newChars + content.substring(charEnd);


// Insert Enemies
const newEnemies = `
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
`;

let enemyEnd = content.indexOf('};\n\nconst BOSSES');
content = content.substring(0, enemyEnd) + ',\n' + newEnemies + content.substring(enemyEnd);

// Insert Bosses
const newBosses = `
    minecraft_boss: { id: 'ender_dragon', name: 'Ender Dragon', maxHp: 300, hp: 300, attack: 35, defense: 25, speed: 20, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 200 },
    pokemon_boss: { id: 'mewtwo', name: 'Mewtwo', maxHp: 400, hp: 400, attack: 50, defense: 20, speed: 40, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 300 },
    lost_boss: { id: 'shovel_knight', name: 'Giant Shovel Knight', maxHp: 450, hp: 450, attack: 40, defense: 45, speed: 15, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 350 },
    cuphead_boss: { id: 'corrupted_cuphead', name: 'Corrupted Cuphead', maxHp: 500, hp: 500, attack: 55, defense: 20, speed: 30, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 400 },
    magic_boss: { id: 'voldemort', name: 'Voldemort', maxHp: 550, hp: 550, attack: 65, defense: 35, speed: 25, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 450 },
    sonic_boss: { id: 'eggman', name: 'Dr. Eggman', maxHp: 600, hp: 600, attack: 60, defense: 50, speed: 10, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 500 },
    amongus_boss: { id: 'corrupted_imposter', name: 'Corrupted Imposter', maxHp: 750, hp: 750, attack: 70, defense: 40, speed: 30, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 600 },
    animation_boss: { id: 'dark_lord', name: 'The Dark Lord', maxHp: 1500, hp: 1500, attack: 100, defense: 60, speed: 40, sprite: SVGS.boss_bowser || '<svg></svg>', isBoss: true, xpReward: 1000 }
`;

let bossEnd = content.indexOf('};\n\n// Abilities');
content = content.substring(0, bossEnd) + ',\n' + newBosses + content.substring(bossEnd);

fs.writeFileSync(targetPath, content);
console.log('Characters updated successfully with correct parsing!');
