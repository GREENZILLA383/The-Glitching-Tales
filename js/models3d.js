// Procedural character model definitions. No external image assets — everything here
// is built from smooth primitives (spheres, capsules, cones...) via VoxelBuilder (see voxel.js).

const PI = Math.PI;

// Shared human body: rounded head with hair and eyes, tapered torso, capsule limbs.
// Feet sit at y = 0 and the top of the head is around y = 4.8.
function buildHumanParts({ skin, outfit, pants, hair, shoes = '#3a2a1e', belt = '#4a3520', legs = true }) {
    const parts = [];
    if (legs) {
        [-1, 1].forEach(side => {
            parts.push({ shape: 'sphere', size: [0.5, 0.32, 0.75], pos: [side * 0.32, 0.16, 0.1], color: shoes });
            parts.push({ shape: 'capsule', size: [0.46, 1.8, 0.46], pos: [side * 0.32, 1.05, 0], color: pants, name: side < 0 ? 'leg_l' : 'leg_r' });
        });
        parts.push({ shape: 'sphere', size: [1.2, 0.6, 0.75], pos: [0, 1.95, 0], color: pants });
    }
    parts.push(
        { shape: 'cylinder', size: [1.2, 1.5, 0.75], taper: 1.15, pos: [0, 2.7, 0], color: outfit, name: 'torso' },
        { shape: 'cylinder', size: [1.24, 0.22, 0.78], pos: [0, 2.0, 0], color: belt },
        { shape: 'sphere', size: [0.55, 0.55, 0.55], pos: [-0.72, 3.3, 0], color: outfit },
        { shape: 'sphere', size: [0.55, 0.55, 0.55], pos: [0.72, 3.3, 0], color: outfit },
        { shape: 'capsule', size: [0.36, 1.6, 0.36], pos: [-0.82, 2.55, 0], rot: [0, 0, -0.12], color: outfit, name: 'arm_l' },
        { shape: 'capsule', size: [0.36, 1.6, 0.36], pos: [0.82, 2.55, 0], rot: [0, 0, 0.12], color: outfit, name: 'arm_r' },
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [-0.93, 1.72, 0], color: skin },
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [0.93, 1.72, 0], color: skin },
        { shape: 'cylinder', size: [0.4, 0.35, 0.4], pos: [0, 3.55, 0], color: skin },
        { shape: 'sphere', size: [1.15, 1.2, 1.1], pos: [0, 4.2, 0], color: skin, name: 'head' },
        { shape: 'sphere', size: [1.22, 0.8, 1.2], pos: [0, 4.5, -0.06], color: hair, name: 'hair' },
        { shape: 'sphere', size: [0.17, 0.22, 0.1], pos: [-0.22, 4.25, 0.5], color: '#1d1d24' },
        { shape: 'sphere', size: [0.17, 0.22, 0.1], pos: [0.22, 4.25, 0.5], color: '#1d1d24' },
        { shape: 'sphere', size: [0.16, 0.16, 0.16], pos: [0, 4.05, 0.56], color: skin }
    );
    return parts;
}

function darken(hex, amount) {
    return '#' + new THREE.Color(hex).multiplyScalar(1 - amount).getHexString();
}

function buildPlayerParts(appearance) {
    const skin = (appearance && appearance.bodyColor) || '#e8b98a';
    const outfit = (appearance && appearance.outfitColor) || '#3b6ea5';
    const hair = (appearance && appearance.hairColor) || '#4a2f1d';
    return buildHumanParts({ skin, outfit, pants: darken(outfit, 0.45), hair });
}

// Round-headed octopus with eight curling tentacles. `s` scales the whole figure.
function buildOctopusParts({ s = 1, body, tentacle }) {
    const parts = [
        { shape: 'sphere', size: [1.7 * s, 1.9 * s, 1.6 * s], pos: [0, 1.7 * s, 0], color: body, name: 'head' }
    ];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        const sx = Math.sin(a), cz = Math.cos(a);
        parts.push({ shape: 'capsule', size: [0.32 * s, 1.3 * s, 0.32 * s], pos: [sx * 0.55 * s, 0.55 * s, cz * 0.55 * s],
            rot: [-cz * 0.5, 0, sx * 0.5], color: tentacle });
        parts.push({ shape: 'sphere', size: [0.34 * s, 0.26 * s, 0.34 * s], pos: [sx * 0.95 * s, 0.12 * s, cz * 0.95 * s], color: tentacle });
    }
    [-1, 1].forEach(side => {
        parts.push({ shape: 'sphere', size: [0.45 * s, 0.5 * s, 0.3 * s], pos: [side * 0.35 * s, 1.85 * s, 0.7 * s], color: '#ffffff' });
        parts.push({ shape: 'sphere', size: [0.2 * s, 0.26 * s, 0.12 * s], pos: [side * 0.35 * s, 1.83 * s, 0.84 * s], color: '#1d1d24' });
    });
    return parts;
}

function buildOctaParts() {
    return buildOctopusParts({ s: 1, body: '#7c5cff', tentacle: '#5a3fd6' });
}

// Barnico: an older, larger octopus with a gold headband, bushy brows and a mustache.
function buildBarnicoParts() {
    const s = 1.35;
    const parts = buildOctopusParts({ s, body: '#4a7a6b', tentacle: '#355a4f' });
    parts.push(
        { shape: 'cylinder', size: [1.6 * s, 0.28 * s, 1.52 * s], pos: [0, 2.15 * s, 0], color: '#d9c26a', name: 'band' },
        { shape: 'capsule', size: [0.14 * s, 0.5 * s, 0.14 * s], pos: [-0.35 * s, 2.13 * s, 0.76 * s], rot: [0, 0, PI / 2 - 0.25], color: '#e8e8e0' },
        { shape: 'capsule', size: [0.14 * s, 0.5 * s, 0.14 * s], pos: [0.35 * s, 2.13 * s, 0.76 * s], rot: [0, 0, PI / 2 + 0.25], color: '#e8e8e0' },
        { shape: 'sphere', size: [0.45 * s, 0.22 * s, 0.25 * s], pos: [-0.2 * s, 1.5 * s, 0.78 * s], color: '#e8e8e0' },
        { shape: 'sphere', size: [0.45 * s, 0.22 * s, 0.25 * s], pos: [0.2 * s, 1.5 * s, 0.78 * s], color: '#e8e8e0' }
    );
    return parts;
}

// Rounded crab: domed shell, eye stalks, pincer claws, three legs per side.
function buildCrabParts({ s = 1, shell, dark, belly }) {
    const parts = [
        { shape: 'sphere', size: [1.7 * s, 0.8 * s, 1.35 * s], pos: [0, 0.95 * s, 0], color: shell, name: 'carapace' },
        { shape: 'sphere', size: [1.4 * s, 0.4 * s, 1.1 * s], pos: [0, 0.72 * s, 0], color: belly }
    ];
    [-1, 1].forEach(side => {
        const tag = side < 0 ? '_l' : '_r';
        parts.push(
            { shape: 'cylinder', size: [0.1 * s, 0.4 * s, 0.1 * s], pos: [side * 0.3 * s, 1.35 * s, 0.45 * s], color: dark },
            { shape: 'sphere', size: [0.24 * s, 0.24 * s, 0.24 * s], pos: [side * 0.3 * s, 1.6 * s, 0.45 * s], color: '#ffffff' },
            { shape: 'sphere', size: [0.11 * s, 0.11 * s, 0.08 * s], pos: [side * 0.3 * s, 1.62 * s, 0.56 * s], color: '#1d1d24' },
            { shape: 'capsule', size: [0.28 * s, 0.9 * s, 0.28 * s], pos: [side * 0.95 * s, 0.95 * s, 0.5 * s], rot: [PI / 2.3, 0, 0], color: shell, name: 'claw_arm' + tag },
            { shape: 'sphere', size: [0.55 * s, 0.45 * s, 0.6 * s], pos: [side * 1.05 * s, 1.0 * s, 1.0 * s], color: dark, name: 'claw' + tag },
            { shape: 'cone', size: [0.2 * s, 0.45 * s, 0.2 * s], pos: [side * 1.05 * s, 1.1 * s, 1.35 * s], rot: [PI / 2, 0, 0], color: dark }
        );
        [-0.35, 0, 0.35].forEach(z => {
            parts.push({ shape: 'capsule', size: [0.14 * s, 0.8 * s, 0.14 * s], pos: [side * 0.85 * s, 0.45 * s, z * s], rot: [0, 0, side * 0.7], color: dark });
        });
    });
    return parts;
}

function buildCrotonParts() {
    const s = 2;
    const gold = '#e8c14d';
    const parts = buildCrabParts({ s, shell: '#c94b3f', dark: '#a53a2f', belly: '#e38b6b' });
    parts.push({ shape: 'cylinder', size: [0.9, 0.35, 0.9], pos: [0, 2.75, 0], color: gold, name: 'crown' });
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2;
        parts.push({ shape: 'cone', size: [0.22, 0.5, 0.22], pos: [Math.sin(a) * 0.36, 3.15, Math.cos(a) * 0.36], color: gold });
    }
    parts.push(
        { shape: 'cylinder', size: [0.15, 2.6, 0.15], pos: [2.6, 1.8, -0.8], color: '#7a5a3a', name: 'staff' },
        { shape: 'sphere', size: [0.55, 0.55, 0.55], pos: [2.6, 3.2, -0.8], color: '#5fd0ff', emissive: '#1a7fb0', opacity: 0.9, name: 'staff_orb' }
    );
    return parts;
}

function buildCrabMinionParts() {
    return buildCrabParts({ s: 1, shell: '#d9694f', dark: '#b8523c', belly: '#f0a080' });
}

// Tall, jagged-crowned ghost king in a tattered, tapering robe, per creator's concept sketch.
function buildOblongtaloGhostParts() {
    const robe = '#3f6b7a';
    const robeDark = '#2c4d58';
    const glow = '#a5d8ff';
    const OP = 0.55; // ghostly transparency
    const parts = [
        // Tapering robe (narrow shoulders -> wide hem) with a torn, spiky hem
        { shape: 'cylinder', size: [3.2, 3.6, 2.0], taper: 0.42, pos: [0, 1.9, 0], color: robeDark, opacity: OP, name: 'hem' },
        { shape: 'cylinder', size: [1.5, 1.4, 1.1], taper: 0.7, pos: [0, 4.3, 0], color: robe, opacity: OP },
        { shape: 'sphere', size: [2.0, 0.7, 1.2], pos: [0, 4.9, 0], color: robe, opacity: OP },
        // Head with glowing eyes
        { shape: 'sphere', size: [1.1, 1.2, 1.05], pos: [0, 5.7, 0], color: robe, opacity: OP, name: 'head' },
        { shape: 'sphere', size: [0.2, 0.28, 0.1], pos: [-0.22, 5.75, 0.5], color: '#cfffff', emissive: '#99ffff', opacity: 0.9 },
        { shape: 'sphere', size: [0.2, 0.28, 0.1], pos: [0.22, 5.75, 0.5], color: '#cfffff', emissive: '#99ffff', opacity: 0.9 },
        // Jagged crown
        { shape: 'cylinder', size: [1.0, 0.25, 1.0], pos: [0, 6.25, 0], color: robeDark, opacity: OP },
        // Arms
        { shape: 'capsule', size: [0.35, 1.8, 0.35], pos: [-1.1, 4.0, 0.2], rot: [0, 0, -0.3], color: robe, opacity: OP },
        { shape: 'capsule', size: [0.35, 1.8, 0.35], pos: [1.1, 4.0, 0.2], rot: [0, 0, 0.3], color: robe, opacity: OP },
        // Staff with a looped top
        { shape: 'cylinder', size: [0.16, 3.4, 0.16], pos: [1.8, 3.0, 0.4], color: '#5a4a66', opacity: 0.9, name: 'staff' },
        { shape: 'torus', size: [0.9, 0.9, 0.14], pos: [1.8, 5.1, 0.4], color: glow, emissive: '#4a90c0', opacity: 0.8, name: 'staff_loop' }
    ];
    [[0, 0.9], [-0.3, 0.7], [0.3, 0.7], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, h]) => {
        parts.push({ shape: 'cone', size: [0.22, h, 0.22], pos: [x, 6.35 + h / 2, 0.1], rot: [0, 0, -x * 0.6], color: robeDark, opacity: OP });
    });
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        parts.push({ shape: 'cone', size: [0.55, 0.7, 0.55], pos: [Math.sin(a) * 1.35, 0.2, Math.cos(a) * 0.85], rot: [PI, 0, 0], color: robeDark, opacity: OP });
    }
    return parts;
}

// Small ghostly sea-wraith enemy that wanders the Ruined Ocean.
function buildSeaWraithParts() {
    const c = '#4a8a8a';
    const OP = 0.6;
    return [
        { shape: 'sphere', size: [1.0, 1.1, 1.0], pos: [0, 1.7, 0], color: c, opacity: OP, name: 'head' },
        { shape: 'cone', size: [1.0, 1.4, 1.0], pos: [0, 0.85, 0], rot: [PI, 0, 0], color: c, opacity: OP },
        { shape: 'capsule', size: [0.2, 0.9, 0.2], pos: [-0.55, 1.2, 0.2], rot: [0, 0, -0.5], color: c, opacity: OP },
        { shape: 'capsule', size: [0.2, 0.9, 0.2], pos: [0.55, 1.2, 0.2], rot: [0, 0, 0.5], color: c, opacity: OP },
        { shape: 'sphere', size: [0.16, 0.22, 0.1], pos: [-0.2, 1.75, 0.46], color: '#cfffff', emissive: '#66ffee', opacity: 0.9 },
        { shape: 'sphere', size: [0.16, 0.22, 0.1], pos: [0.2, 1.75, 0.46], color: '#cfffff', emissive: '#66ffee', opacity: 0.9 }
    ];
}

// The charging ghosts in Oblongtalo's Phase 1 gauntlet.
function buildChargeGhostParts() {
    const c = '#8fd6ff';
    const OP = 0.65;
    return [
        { shape: 'sphere', size: [0.9, 0.9, 0.9], pos: [0, 1.3, 0], color: c, opacity: OP, name: 'head' },
        { shape: 'cone', size: [0.9, 1.2, 0.8], pos: [0, 0.55, 0], rot: [PI, 0, 0], color: c, opacity: OP, name: 'tail' },
        { shape: 'sphere', size: [0.14, 0.2, 0.08], pos: [-0.17, 1.35, 0.42], color: '#1d3b4f' },
        { shape: 'sphere', size: [0.14, 0.2, 0.08], pos: [0.17, 1.35, 0.42], color: '#1d3b4f' }
    ];
}

// Wandering Shopkeeper: robed traveler with a wizard hat, white beard and a big pack.
function buildShopkeeperParts() {
    const robe = '#6b4f8a';
    const robeDark = '#4a3868';
    const parts = buildHumanParts({ skin: '#e8b98a', outfit: robe, pants: robeDark, hair: '#d8d8d8', belt: '#c9a24a', legs: false });
    parts.push(
        { shape: 'cylinder', size: [1.7, 2.1, 1.3], taper: 0.6, pos: [0, 1.05, 0], color: robeDark },
        { shape: 'sphere', size: [0.8, 0.9, 0.5], pos: [0, 3.75, 0.4], color: '#f2f2f2' },
        { shape: 'cylinder', size: [1.9, 0.12, 1.9], pos: [0, 4.65, 0], color: robeDark },
        { shape: 'cone', size: [1.2, 1.6, 1.2], pos: [0, 5.4, -0.05], rot: [-0.15, 0, 0], color: robeDark, name: 'hat' },
        { shape: 'capsule', size: [1.0, 1.4, 0.6], pos: [0, 2.8, -0.6], color: '#8b6b3f' }
    );
    return parts;
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
