// Procedural voxel-box model definitions. No external image assets — everything here
// is built from colored THREE.BoxGeometry parts via VoxelBuilder (see voxel.js).

function buildPlayerParts(appearance) {
    const bodyColor = (appearance && appearance.bodyColor) || '#e8b98a';
    const outfitColor = (appearance && appearance.outfitColor) || '#3b6ea5';
    return [
        { size: [1, 1, 1], pos: [0, 4, 0], color: bodyColor, name: 'head' },
        { size: [1.4, 1.8, 0.8], pos: [0, 2.6, 0], color: outfitColor, name: 'torso' },
        { size: [0.5, 1.6, 0.5], pos: [-1.0, 2.6, 0], color: bodyColor, name: 'arm_l' },
        { size: [0.5, 1.6, 0.5], pos: [1.0, 2.6, 0], color: bodyColor, name: 'arm_r' },
        { size: [0.6, 1.6, 0.6], pos: [-0.4, 0.8, 0], color: outfitColor, name: 'leg_l' },
        { size: [0.6, 1.6, 0.6], pos: [0.4, 0.8, 0], color: outfitColor, name: 'leg_r' }
    ];
}

function buildOctaParts() {
    const body = '#7c5cff';
    const tentacle = '#5a3fd6';
    return [
        { size: [1.6, 1.6, 1.6], pos: [0, 1.6, 0], color: body, name: 'head' },
        { size: [0.25, 0.9, 0.25], pos: [-0.6, 0.5, 0.3], color: tentacle },
        { size: [0.25, 0.9, 0.25], pos: [0.6, 0.5, 0.3], color: tentacle },
        { size: [0.25, 0.9, 0.25], pos: [-0.6, 0.5, -0.3], color: tentacle },
        { size: [0.25, 0.9, 0.25], pos: [0.6, 0.5, -0.3], color: tentacle },
        { size: [0.25, 0.8, 0.25], pos: [0, 0.5, 0.6], color: tentacle },
        { size: [0.25, 0.8, 0.25], pos: [0, 0.5, -0.6], color: tentacle },
        { size: [0.22, 0.22, 0.1], pos: [-0.4, 1.9, 0.8], color: '#ffffff' },
        { size: [0.22, 0.22, 0.1], pos: [0.4, 1.9, 0.8], color: '#ffffff' }
    ];
}

function buildBarnicoParts() {
    const body = '#4a7a6b';
    const band = '#d9c26a';
    const tentacle = '#355a4f';
    return [
        { size: [2.2, 2.2, 2.2], pos: [0, 2.4, 0], color: body, name: 'head' },
        { size: [2.3, 0.3, 2.3], pos: [0, 3.1, 0], color: band, name: 'band' },
        { size: [0.35, 1.2, 0.35], pos: [-0.9, 0.9, 0.5], color: tentacle },
        { size: [0.35, 1.2, 0.35], pos: [0.9, 0.9, 0.5], color: tentacle },
        { size: [0.35, 1.2, 0.35], pos: [-0.9, 0.9, -0.5], color: tentacle },
        { size: [0.35, 1.2, 0.35], pos: [0.9, 0.9, -0.5], color: tentacle },
        { size: [0.3, 1.0, 0.3], pos: [0, 0.9, 1.0], color: tentacle },
        { size: [0.3, 1.0, 0.3], pos: [0, 0.9, -1.0], color: tentacle },
        { size: [0.3, 0.3, 0.1], pos: [-0.55, 2.6, 1.1], color: '#ffffff' },
        { size: [0.3, 0.3, 0.1], pos: [0.55, 2.6, 1.1], color: '#ffffff' }
    ];
}

function buildCrotonParts() {
    const shell = '#c94b3f';
    const shellDark = '#a53a2f';
    const gold = '#e8c14d';
    return [
        { size: [3.2, 1.4, 2.6], pos: [0, 2, 0], color: shell, name: 'carapace' },
        { size: [1.2, 0.5, 1.2], pos: [0, 3.0, 0], color: gold, name: 'crown' },
        { size: [0.6, 0.6, 1.6], pos: [-2.0, 1.8, 0.6], color: shell, name: 'claw_arm_l' },
        { size: [0.9, 0.9, 0.5], pos: [-2.5, 1.8, 1.3], color: shellDark, name: 'claw_l' },
        { size: [0.6, 0.6, 1.6], pos: [2.0, 1.8, 0.6], color: shell, name: 'claw_arm_r' },
        { size: [0.9, 0.9, 0.5], pos: [2.5, 1.8, 1.3], color: shellDark, name: 'claw_r' },
        { size: [0.3, 1.0, 0.3], pos: [-1.3, 1.0, 1.0], color: shellDark },
        { size: [0.3, 1.0, 0.3], pos: [1.3, 1.0, 1.0], color: shellDark },
        { size: [0.3, 1.0, 0.3], pos: [-1.3, 1.0, -1.0], color: shellDark },
        { size: [0.3, 1.0, 0.3], pos: [1.3, 1.0, -1.0], color: shellDark },
        { size: [0.2, 2.2, 0.2], pos: [2.6, 1.6, -0.8], color: '#7a5a3a', name: 'staff' },
        { size: [0.5, 0.5, 0.5], pos: [2.6, 2.8, -0.8], color: '#5fd0ff', opacity: 0.85, name: 'staff_orb' }
    ];
}

function buildCrabMinionParts() {
    const shell = '#d9694f';
    const shellDark = '#b8523c';
    return [
        { size: [1.6, 0.7, 1.3], pos: [0, 0.9, 0], color: shell, name: 'carapace' },
        { size: [0.35, 0.35, 0.9], pos: [-1.0, 0.85, 0.3], color: shell },
        { size: [0.5, 0.5, 0.3], pos: [-1.25, 0.85, 0.7], color: shellDark },
        { size: [0.35, 0.35, 0.9], pos: [1.0, 0.85, 0.3], color: shell },
        { size: [0.5, 0.5, 0.3], pos: [1.25, 0.85, 0.7], color: shellDark },
        { size: [0.18, 0.6, 0.18], pos: [-0.6, 0.4, 0.5], color: shellDark },
        { size: [0.18, 0.6, 0.18], pos: [0.6, 0.4, 0.5], color: shellDark },
        { size: [0.18, 0.6, 0.18], pos: [-0.6, 0.4, -0.5], color: shellDark },
        { size: [0.18, 0.6, 0.18], pos: [0.6, 0.4, -0.5], color: shellDark }
    ];
}

// Tall, jagged-crowned ghost king in a tattered, tapering robe, per creator's concept sketch.
function buildOblongtaloGhostParts() {
    const robe = '#3f6b7a';
    const robeDark = '#2c4d58';
    const OP = 0.55; // ghostly transparency
    return [
        // Jagged crown spikes
        { size: [0.15, 0.9, 0.15], pos: [0, 6.6, 0], color: robeDark, opacity: OP },
        { size: [0.15, 0.7, 0.15], pos: [-0.3, 6.4, 0.1], color: robeDark, opacity: OP },
        { size: [0.15, 0.7, 0.15], pos: [0.3, 6.4, 0.1], color: robeDark, opacity: OP },
        { size: [0.15, 0.5, 0.15], pos: [-0.55, 6.1, 0.15], color: robeDark, opacity: OP },
        { size: [0.15, 0.5, 0.15], pos: [0.55, 6.1, 0.15], color: robeDark, opacity: OP },
        // Head
        { size: [0.9, 0.9, 0.9], pos: [0, 5.7, 0], color: robe, opacity: OP, name: 'head' },
        // Tapering, tattered robe (narrow shoulders -> wide hem)
        { size: [1.6, 1.1, 1.0], pos: [0, 4.6, 0], color: robe, opacity: OP },
        { size: [2.0, 1.1, 1.2], pos: [0, 3.5, 0], color: robeDark, opacity: OP },
        { size: [2.6, 1.2, 1.4], pos: [0, 2.4, 0], color: robe, opacity: OP },
        { size: [3.2, 1.4, 1.6], pos: [0, 1.1, 0], color: robeDark, opacity: OP, name: 'hem' },
        // Staff with a looped top
        { size: [0.18, 3.2, 0.18], pos: [1.8, 3.0, 0.4], color: '#5a4a66', opacity: 0.9, name: 'staff' },
        { size: [0.7, 0.15, 0.15], pos: [1.8, 4.6, 0.4], color: '#a5d8ff', opacity: 0.8, name: 'staff_loop_top' },
        { size: [0.15, 0.7, 0.15], pos: [1.45, 4.25, 0.4], color: '#a5d8ff', opacity: 0.8, name: 'staff_loop_l' },
        { size: [0.15, 0.7, 0.15], pos: [2.15, 4.25, 0.4], color: '#a5d8ff', opacity: 0.8, name: 'staff_loop_r' }
    ];
}

// Small ghostly sea-wraith enemy that wanders the Ruined Ocean.
function buildSeaWraithParts() {
    const c = '#4a8a8a';
    const OP = 0.6;
    return [
        { size: [1.0, 1.0, 1.0], pos: [0, 1.6, 0], color: c, opacity: OP, name: 'head' },
        { size: [0.2, 1.0, 0.2], pos: [-0.35, 0.7, 0], color: c, opacity: OP },
        { size: [0.2, 1.0, 0.2], pos: [0.35, 0.7, 0], color: c, opacity: OP },
        { size: [0.2, 0.8, 0.2], pos: [0, 0.6, 0.35], color: c, opacity: OP },
        { size: [0.2, 0.8, 0.2], pos: [0, 0.6, -0.35], color: c, opacity: OP }
    ];
}

// The charging ghosts in Oblongtalo's Phase 1 gauntlet.
function buildChargeGhostParts() {
    const c = '#8fd6ff';
    const OP = 0.65;
    return [
        { size: [0.8, 0.8, 0.8], pos: [0, 1.2, 0], color: c, opacity: OP, name: 'head' },
        { size: [1.0, 0.9, 0.6], pos: [0, 0.5, 0], color: c, opacity: OP, name: 'tail' }
    ];
}

function buildShopkeeperParts() {
    const skin = '#e8b98a';
    const robe = '#6b4f8a';
    const robeDark = '#4a3868';
    return [
        { size: [1, 1, 1], pos: [0, 4, 0], color: skin, name: 'head' },
        { size: [0.7, 0.4, 0.7], pos: [0, 4.6, 0], color: robeDark, name: 'hat' },
        { size: [1.4, 1.8, 0.8], pos: [0, 2.6, 0], color: robe, name: 'torso' },
        { size: [0.5, 1.6, 0.5], pos: [-1.0, 2.6, 0], color: skin },
        { size: [0.5, 1.6, 0.5], pos: [1.0, 2.6, 0], color: skin },
        { size: [0.6, 1.6, 0.6], pos: [-0.4, 0.8, 0], color: robeDark },
        { size: [0.6, 1.6, 0.6], pos: [0.4, 0.8, 0], color: robeDark }
    ];
}

const CHARACTERS = {
    octa: {
        id: 'octa', name: 'Octa', level: 1, exp: 0, expToNext: 50,
        maxHp: 70, hp: 70, maxMp: 40, mp: 40, attack: 10, defense: 8, speed: 6,
        build3D: () => VoxelBuilder.buildCharacter(buildOctaParts()),
        abilities: [
            { name: 'Tentacle Slap', type: 'attack', power: 1.2, cost: 0, skillType: null, description: 'A quick physical hit.' },
            { name: 'Ink Cloud', type: 'debuff', stat: 'attack', amount: 5, cost: 8, skillType: null, description: 'Blinds a nearby enemy, lowering its attack.' }
        ]
    }
};

// Regular (non-boss) enemies.
const ENEMIES = {
    crab_minion: {
        id: 'crab_minion', name: 'Crab Minion', maxHp: 30, hp: 30, attack: 8, defense: 4, speed: 3.5, xpReward: 12,
        build3D: () => VoxelBuilder.buildCharacter(buildCrabMinionParts()),
        abilities: [
            { name: 'Pinch', type: 'attack', power: 1.0, cost: 0, skillType: null, description: 'A quick claw pinch.' }
        ]
    },
    sea_wraith: {
        id: 'sea_wraith', name: 'Sea Wraith', maxHp: 40, hp: 40, attack: 10, defense: 5, speed: 3, xpReward: 18,
        build3D: () => VoxelBuilder.buildCharacter(buildSeaWraithParts()),
        abilities: [
            { name: 'Cold Grasp', type: 'attack', power: 1.1, cost: 0, skillType: null, description: 'A chilling touch.' }
        ]
    }
};

const BOSSES = {
    croton: {
        id: 'croton', name: 'Croton, King of Crabs', maxHp: 400, hp: 400, attack: 25, defense: 12, speed: 3,
        isBoss: true, isGuardian: true, xpReward: 250, scale: 3,
        build3D: () => VoxelBuilder.buildCharacter(buildCrotonParts()),
        abilities: [
            { name: 'Wave Summon', type: 'aoe', target: 'all', power: 1.1, radius: 14, cost: 0, skillType: null,
              description: 'Summons waves that push and damage the whole party.' },
            { name: 'Claw Swipe', type: 'attack', power: 1.6, cost: 0, skillType: null,
              description: 'A heavy physical lunge attack.' }
        ]
    },
    // Oblongtalo is not fought like a normal boss: no HP bar, no player attacks.
    // Combat3d.js drives him as a dedicated two-phase real-time survival gauntlet
    // (see runOblongtaloGauntlet). This entry only supplies his look + tuning knobs.
    oblongtalo_ghost: {
        id: 'oblongtalo_ghost', name: 'The Ghost of King Oblongtalo', isBoss: true, isSurvivalGauntlet: true, scale: 1.6,
        build3D: () => VoxelBuilder.buildCharacter(buildOblongtaloGhostParts()),
        gauntlet: {
            phase1WaveCount: 3,       // number of ghost-charge waves to survive before Phase 2
            phase1GhostSpeed: 11,     // units/sec - "readable but brisk" charge speed
            phase2ChargeCount: 3,     // number of Oblongtalo's own big sweeps to survive
            phase2ChargeSpeed: 9,
            hitInvincibilitySec: 1.2,
            hitDamage: 15
        }
    }
};
