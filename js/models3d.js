// Procedural character model definitions. No external image assets — everything here
// is built from smooth primitives (spheres, capsules, cones...) via VoxelBuilder (see voxel.js).

const PI = Math.PI;

// Shared human body: rounded head with hair and eyes, tapered torso, capsule limbs.
// Feet sit at y = 0 and the top of the head is around y = 4.8.
function buildHumanParts({ skin, outfit, pants, hair, shoes = '#3a2a1e', belt = '#4a3520', legs = true }) {
    const parts = [];
    // Limbs hang from pivots (hip / shoulder / neck) so the animation system can swing them naturally.
    if (legs) {
        [-1, 1].forEach(side => {
            const tag = side < 0 ? '_l' : '_r';
            parts.push({ shape: 'sphere', size: [0.5, 0.32, 0.75], pos: [side * 0.32, 0.16, 0.1], color: shoes, follow: 'leg' + tag });
            parts.push({ shape: 'capsule', size: [0.46, 1.8, 0.46], pos: [side * 0.32, 1.05, 0], color: pants, name: 'leg' + tag, pivot: [side * 0.32, 1.9, 0] });
        });
        parts.push({ shape: 'sphere', size: [1.2, 0.6, 0.75], pos: [0, 1.95, 0], color: pants });
    }
    parts.push(
        { shape: 'cylinder', size: [1.2, 1.5, 0.75], taper: 1.15, pos: [0, 2.7, 0], color: outfit, name: 'torso' },
        { shape: 'cylinder', size: [1.24, 0.22, 0.78], pos: [0, 2.0, 0], color: belt },
        { shape: 'sphere', size: [0.55, 0.55, 0.55], pos: [-0.72, 3.3, 0], color: outfit },
        { shape: 'sphere', size: [0.55, 0.55, 0.55], pos: [0.72, 3.3, 0], color: outfit },
        { shape: 'capsule', size: [0.36, 1.6, 0.36], pos: [-0.82, 2.55, 0], rot: [0, 0, -0.12], color: outfit, name: 'arm_l', pivot: [-0.78, 3.25, 0] },
        { shape: 'capsule', size: [0.36, 1.6, 0.36], pos: [0.82, 2.55, 0], rot: [0, 0, 0.12], color: outfit, name: 'arm_r', pivot: [0.78, 3.25, 0] },
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [-0.93, 1.72, 0], color: skin, follow: 'arm_l' },
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [0.93, 1.72, 0], color: skin, follow: 'arm_r' },
        { shape: 'cylinder', size: [0.4, 0.35, 0.4], pos: [0, 3.55, 0], color: skin },
        { shape: 'sphere', size: [1.15, 1.2, 1.1], pos: [0, 4.2, 0], color: skin, name: 'head', pivot: [0, 3.7, 0] },
        { shape: 'sphere', size: [1.22, 0.8, 1.2], pos: [0, 4.5, -0.06], color: hair, name: 'hair', follow: 'head' },
        { shape: 'sphere', size: [0.17, 0.22, 0.1], pos: [-0.22, 4.25, 0.5], color: '#1d1d24', follow: 'head' },
        { shape: 'sphere', size: [0.17, 0.22, 0.1], pos: [0.22, 4.25, 0.5], color: '#1d1d24', follow: 'head' },
        { shape: 'sphere', size: [0.16, 0.16, 0.16], pos: [0, 4.05, 0.56], color: skin, follow: 'head' }
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
        // Each tentacle hangs from the underside of the body so it can ripple on its own.
        parts.push({ shape: 'capsule', size: [0.32 * s, 1.3 * s, 0.32 * s], pos: [sx * 0.55 * s, 0.55 * s, cz * 0.55 * s],
            rot: [-cz * 0.5, 0, sx * 0.5], color: tentacle, name: 'tent_' + i, pivot: [sx * 0.42 * s, 1.1 * s, cz * 0.42 * s] });
        parts.push({ shape: 'sphere', size: [0.34 * s, 0.26 * s, 0.34 * s], pos: [sx * 0.95 * s, 0.12 * s, cz * 0.95 * s], color: tentacle, follow: 'tent_' + i });
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
            // The whole claw (arm + pincer + tip) swings from the shoulder as one 'pinch' group.
            { shape: 'capsule', size: [0.28 * s, 0.9 * s, 0.28 * s], pos: [side * 0.95 * s, 0.95 * s, 0.5 * s], rot: [PI / 2.3, 0, 0], color: shell, name: 'pinch' + tag, pivot: [side * 0.8 * s, 1.0 * s, 0.25 * s] },
            { shape: 'sphere', size: [0.55 * s, 0.45 * s, 0.6 * s], pos: [side * 1.05 * s, 1.0 * s, 1.0 * s], color: dark, name: 'claw' + tag, follow: 'pinch' + tag },
            { shape: 'cone', size: [0.2 * s, 0.45 * s, 0.2 * s], pos: [side * 1.05 * s, 1.1 * s, 1.35 * s], rot: [PI / 2, 0, 0], color: dark, follow: 'pinch' + tag }
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
        { shape: 'capsule', size: [0.35, 1.8, 0.35], pos: [-1.1, 4.0, 0.2], rot: [0, 0, -0.3], color: robe, opacity: OP, name: 'arm_l', pivot: [-0.95, 4.85, 0.2] },
        { shape: 'capsule', size: [0.35, 1.8, 0.35], pos: [1.1, 4.0, 0.2], rot: [0, 0, 0.3], color: robe, opacity: OP, name: 'arm_r', pivot: [0.95, 4.85, 0.2] },
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

// Electric eel: a long, wriggling body made of linked segments (seg_0 is the head end) with glowing
// spark-spikes along its back. The animation system ripples the segments to make it swim.
function buildEelParts() {
    const body = '#27358f', body2 = '#3a55d0', belly = '#ffd23f', spark = '#9ff6ff';
    const N = 8, gap = 0.95, y = 1.0;
    const parts = [];
    for (let i = 0; i < N; i++) {
        const r = 0.7 * (1 - i / (N * 1.35));
        const z = -i * gap;
        parts.push({ shape: 'sphere', size: [r * 2, r * 2.05, 1.25], pos: [0, y, z], color: i % 2 ? body : body2, name: 'seg_' + i, pivot: [0, y, z] });
        parts.push({ shape: 'sphere', size: [r * 1.35, r * 0.9, 1.05], pos: [0, y - r * 0.55, z], color: belly, follow: 'seg_' + i });
        if (i % 2 === 0) parts.push({ shape: 'cone', size: [0.2, 0.6, 0.2], pos: [0, y + r * 1.05, z], color: spark, emissive: '#2fc8ff', name: 'spk_' + i, follow: 'seg_' + i });
    }
    // head: bigger, with a jaw, eyes and glowing whisker-sparks
    parts.push(
        { shape: 'sphere', size: [1.5, 1.35, 1.7], pos: [0, y, 0.55], color: body2, follow: 'seg_0' },
        { shape: 'sphere', size: [1.1, 0.5, 1.2], pos: [0, y - 0.45, 0.85], color: '#141c52', follow: 'seg_0' },
        { shape: 'sphere', size: [0.38, 0.38, 0.3], pos: [-0.5, y + 0.35, 1.2], color: '#fffbe0', emissive: '#ffe96b', follow: 'seg_0' },
        { shape: 'sphere', size: [0.38, 0.38, 0.3], pos: [0.5, y + 0.35, 1.2], color: '#fffbe0', emissive: '#ffe96b', follow: 'seg_0' },
        { shape: 'sphere', size: [0.15, 0.2, 0.1], pos: [-0.5, y + 0.35, 1.38], color: '#1d1d24', follow: 'seg_0' },
        { shape: 'sphere', size: [0.15, 0.2, 0.1], pos: [0.5, y + 0.35, 1.38], color: '#1d1d24', follow: 'seg_0' },
        { shape: 'cone', size: [0.14, 0.9, 0.14], pos: [-0.85, y + 0.1, 0.9], rot: [0, 0, 1.2], color: spark, emissive: '#2fc8ff', follow: 'seg_0' },
        { shape: 'cone', size: [0.14, 0.9, 0.14], pos: [0.85, y + 0.1, 0.9], rot: [0, 0, -1.2], color: spark, emissive: '#2fc8ff', follow: 'seg_0' }
    );
    // tail fin
    parts.push({ shape: 'cone', size: [0.55, 2.2, 0.9], pos: [0, y, -(N - 1) * gap - 1.3], rot: [-PI / 2, 0, 0], color: body, follow: 'seg_' + (N - 1) });
    return parts;
}

// Fire fish: a plump, flame-finned fish that hovers above the seabed and spits sparks of burning air.
function buildFireFishParts() {
    const orange = '#ff7a2b', red = '#e63e2a', yellow = '#ffd23f', ember = '#ff9a1a';
    const y = 1.1;
    return [
        { shape: 'sphere', size: [2.1, 1.8, 3.0], pos: [0, y, 0], color: orange, name: 'body' },
        { shape: 'sphere', size: [1.7, 0.9, 2.5], pos: [0, y - 0.55, 0.15], color: yellow },
        // stripes
        { shape: 'sphere', size: [2.18, 1.5, 0.3], pos: [0, y + 0.05, -0.5], color: red },
        { shape: 'sphere', size: [2.14, 1.6, 0.3], pos: [0, y + 0.05, 0.4], color: red },
        // tail + fins (they wag and flap)
        { shape: 'sphere', size: [0.3, 1.8, 1.9], pos: [0, y, -2.6], color: red, emissive: '#ff4d1a', name: 'tail', pivot: [0, y, -1.5] },
        { shape: 'cone', size: [0.3, 1.2, 1.3], pos: [0, y + 1.25, -0.2], rot: [0.5, 0, 0], color: red, emissive: '#ff4d1a', name: 'fin_top' },
        { shape: 'sphere', size: [0.25, 0.9, 1.5], pos: [-1.25, y - 0.1, 0.3], rot: [0, 0, 0.5], color: red, emissive: '#ff4d1a', name: 'fin_l', pivot: [-1.0, y, 0.4] },
        { shape: 'sphere', size: [0.25, 0.9, 1.5], pos: [1.25, y - 0.1, 0.3], rot: [0, 0, -0.5], color: red, emissive: '#ff4d1a', name: 'fin_r', pivot: [1.0, y, 0.4] },
        // flame crest on the head
        { shape: 'cone', size: [0.5, 1.3, 0.5], pos: [0, y + 1.25, 0.9], color: yellow, emissive: ember, name: 'crest_0' },
        { shape: 'cone', size: [0.4, 1.0, 0.4], pos: [-0.5, y + 1.1, 0.5], rot: [0, 0, 0.35], color: ember, emissive: '#ff6a00', name: 'crest_1' },
        { shape: 'cone', size: [0.4, 1.0, 0.4], pos: [0.5, y + 1.1, 0.5], rot: [0, 0, -0.35], color: ember, emissive: '#ff6a00', name: 'crest_2' },
        // face
        { shape: 'sphere', size: [0.65, 0.65, 0.45], pos: [-0.72, y + 0.35, 1.2], color: '#ffffff' },
        { shape: 'sphere', size: [0.65, 0.65, 0.45], pos: [0.72, y + 0.35, 1.2], color: '#ffffff' },
        { shape: 'sphere', size: [0.3, 0.34, 0.2], pos: [-0.72, y + 0.33, 1.42], color: '#2a0a05' },
        { shape: 'sphere', size: [0.3, 0.34, 0.2], pos: [0.72, y + 0.33, 1.42], color: '#2a0a05' },
        { shape: 'sphere', size: [0.8, 0.5, 0.4], pos: [0, y - 0.35, 1.55], color: '#4a0f06', emissive: '#ff3a00', name: 'mouth' }
    ];
}

// Dune viper: a sand-colored snake that blends into the desert (the animation system fades it almost
// invisible until it attacks). The two glowing cheek-sacs hold its venom.
function buildSnakeParts() {
    const sand = '#d9b872', band = '#b4843f', belly = '#f3e4b4';
    const N = 9, gap = 0.82, y = 0.62;
    const parts = [];
    for (let i = 0; i < N; i++) {
        const r = 0.6 * (1 - i / (N * 1.5));
        const z = -i * gap;
        parts.push({ shape: 'sphere', size: [r * 2, r * 2.0, 1.15], pos: [0, y, z], color: i % 2 ? band : sand, name: 'sseg_' + i, pivot: [0, y, z] });
        parts.push({ shape: 'sphere', size: [r * 1.3, r * 0.8, 1.0], pos: [0, y - r * 0.6, z], color: belly, follow: 'sseg_' + i });
    }
    parts.push(
        // wedge-shaped head
        { shape: 'sphere', size: [1.25, 0.85, 1.6], pos: [0, y + 0.05, 0.7], color: sand, follow: 'sseg_0' },
        { shape: 'sphere', size: [0.95, 0.4, 1.1], pos: [0, y - 0.3, 0.95], color: belly, follow: 'sseg_0' },
        { shape: 'sphere', size: [0.26, 0.3, 0.2], pos: [-0.42, y + 0.28, 1.25], color: '#ffe36b', emissive: '#c9a300', follow: 'sseg_0' },
        { shape: 'sphere', size: [0.26, 0.3, 0.2], pos: [0.42, y + 0.28, 1.25], color: '#ffe36b', emissive: '#c9a300', follow: 'sseg_0' },
        { shape: 'sphere', size: [0.08, 0.24, 0.1], pos: [-0.42, y + 0.28, 1.38], color: '#1a1208', follow: 'sseg_0' },
        { shape: 'sphere', size: [0.08, 0.24, 0.1], pos: [0.42, y + 0.28, 1.38], color: '#1a1208', follow: 'sseg_0' },
        // forked tongue
        { shape: 'capsule', size: [0.07, 0.8, 0.07], pos: [0, y - 0.15, 1.9], rot: [PI / 2, 0, 0], color: '#d63a3a', follow: 'sseg_0' },
        // venom sacs (they glow when it's about to spit)
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [-0.62, y + 0.0, 0.5], color: '#9bff4a', emissive: '#5fd400', name: 'venom_l', follow: 'sseg_0' },
        { shape: 'sphere', size: [0.38, 0.38, 0.38], pos: [0.62, y + 0.0, 0.5], color: '#9bff4a', emissive: '#5fd400', name: 'venom_r', follow: 'sseg_0' },
        // tail tip
        { shape: 'cone', size: [0.35, 1.3, 0.35], pos: [0, y, -(N - 1) * gap - 0.9], rot: [-PI / 2, 0, 0], color: band, follow: 'sseg_' + (N - 1) }
    );
    return parts;
}

// Scortus: a scorpion made of cactus. Ribbed green body, big spiny claws, a pink bloom on its head
// and a curled tail tipped with a long needle. (tail_1 hangs off tail_0 so the tail bends like a real one.)
function buildScortusParts() {
    const green = '#3f9a4a', dark = '#2a7338', cream = '#f6efc4', pink = '#ff6fa8';
    const s = 1.25;
    const parts = [
        { shape: 'sphere', size: [2.4 * s, 1.55 * s, 3.3 * s], pos: [0, 1.3 * s, 0], color: green, name: 'body' },
        { shape: 'sphere', size: [2.0 * s, 1.0 * s, 2.7 * s], pos: [0, 0.95 * s, 0], color: dark }
    ];
    // cactus ribs
    [-1.1, -0.35, 0.4, 1.15].forEach(z => parts.push({ shape: 'sphere', size: [2.46 * s, 1.45 * s, 0.22 * s], pos: [0, 1.3 * s, z * s], color: dark }));
    // spines
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2, zz = ((i * 7) % 5 - 2) * 0.55;
        parts.push({ shape: 'cone', size: [0.1 * s, 0.5 * s, 0.1 * s], pos: [Math.sin(a) * 0.95 * s, (1.35 + Math.cos(a) * 0.5) * s, zz * s], rot: [0, 0, -Math.sin(a) * 1.1], color: cream });
    }
    // face + flower
    parts.push(
        { shape: 'sphere', size: [0.32 * s, 0.32 * s, 0.25 * s], pos: [-0.5 * s, 1.55 * s, 1.55 * s], color: '#ffffff' },
        { shape: 'sphere', size: [0.32 * s, 0.32 * s, 0.25 * s], pos: [0.5 * s, 1.55 * s, 1.55 * s], color: '#ffffff' },
        { shape: 'sphere', size: [0.14 * s, 0.17 * s, 0.1 * s], pos: [-0.5 * s, 1.53 * s, 1.72 * s], color: '#1d1d24' },
        { shape: 'sphere', size: [0.14 * s, 0.17 * s, 0.1 * s], pos: [0.5 * s, 1.53 * s, 1.72 * s], color: '#1d1d24' },
        { shape: 'sphere', size: [0.75 * s, 0.4 * s, 0.75 * s], pos: [0, 2.1 * s, 0.9 * s], color: pink },
        { shape: 'sphere', size: [0.4 * s, 0.25 * s, 0.4 * s], pos: [0, 2.3 * s, 0.9 * s], color: '#ffd54a' }
    );
    // claws (same pivot layout as the crabs so they snap and slam the same way)
    [-1, 1].forEach(side => {
        const tag = side < 0 ? '_l' : '_r';
        parts.push(
            { shape: 'capsule', size: [0.34 * s, 1.1 * s, 0.34 * s], pos: [side * 1.15 * s, 1.0 * s, 0.7 * s], rot: [PI / 2.3, 0, 0], color: green, name: 'pinch' + tag, pivot: [side * 0.95 * s, 1.05 * s, 0.3 * s] },
            { shape: 'sphere', size: [0.8 * s, 0.55 * s, 0.9 * s], pos: [side * 1.25 * s, 1.0 * s, 1.35 * s], color: dark, follow: 'pinch' + tag },
            { shape: 'cone', size: [0.2 * s, 0.7 * s, 0.2 * s], pos: [side * 1.0 * s, 1.1 * s, 1.85 * s], rot: [PI / 2, 0, 0], color: cream, follow: 'pinch' + tag },
            { shape: 'cone', size: [0.2 * s, 0.7 * s, 0.2 * s], pos: [side * 1.5 * s, 1.1 * s, 1.85 * s], rot: [PI / 2, 0, 0], color: cream, follow: 'pinch' + tag }
        );
        [-0.5, 0, 0.5].forEach(z => parts.push({ shape: 'capsule', size: [0.18 * s, 0.9 * s, 0.18 * s], pos: [side * 1.1 * s, 0.45 * s, z * s], rot: [0, 0, side * 0.7], color: dark }));
    });
    // the tail: two joints, arching up and over the back like a scorpion's, ending in a long needle
    const T = [[1.65, -1.9, 0.95], [2.45, -2.55, 0.92], [3.3, -2.75, 0.88], [4.1, -2.4, 0.84], [4.65, -1.7, 0.8], [4.85, -0.85, 0.75], [4.7, -0.05, 0.7]];
    T.forEach(([y, z, d], i) => {
        const c = i % 2 ? dark : green;
        if (i < 4) parts.push(i === 0
            ? { shape: 'sphere', size: [d * s, d * s, d * 1.05 * s], pos: [0, y * s, z * s], color: c, name: 'tail_0', pivot: [0, 1.5 * s, -1.6 * s] }
            : { shape: 'sphere', size: [d * s, d * s, d * 1.05 * s], pos: [0, y * s, z * s], color: c, follow: 'tail_0' });
        else parts.push(i === 4
            ? { shape: 'sphere', size: [d * s, d * s, d * 1.05 * s], pos: [0, y * s, z * s], color: c, name: 'tail_1', pivot: [0, 4.1 * s, -2.2 * s] }
            : { shape: 'sphere', size: [d * s, d * s, d * 1.05 * s], pos: [0, y * s, z * s], color: c, follow: 'tail_1' });
    });
    parts.push({ shape: 'cone', size: [0.3 * s, 1.7 * s, 0.3 * s], pos: [0, 4.3 * s, 0.75 * s], rot: [PI / 2 + 0.6, 0, 0], color: cream, name: 'needle', follow: 'tail_1' });
    return parts;
}

function buildScortus3D() {
    const g = VoxelBuilder.buildCharacter(buildScortusParts());
    const t0 = g.getObjectByName('tail_0'), t1 = g.getObjectByName('tail_1');
    if (t0 && t1) { g.remove(t1); t1.position.sub(t0.position); t0.add(t1); } // the tip bends with the whole tail
    return g;
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
        { shape: 'sphere', size: [0.8, 0.9, 0.5], pos: [0, 3.75, 0.4], color: '#f2f2f2', follow: 'head' },
        { shape: 'cylinder', size: [1.9, 0.12, 1.9], pos: [0, 4.65, 0], color: robeDark, follow: 'head' },
        { shape: 'cone', size: [1.2, 1.6, 1.2], pos: [0, 5.4, -0.05], rot: [-0.15, 0, 0], color: robeDark, name: 'hat', follow: 'head' },
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
    },
    // Coral Reef creatures. `speed` is in world units per second; `ai` picks the behaviour in combat3d.js.
    electric_eel: {
        id: 'electric_eel', name: 'Electric Eel', ai: 'eel', aggroDist: 34, maxHp: 55, hp: 55, attack: 14, defense: 5, speed: 20, xpReward: 30,
        build3D: () => VoxelBuilder.buildCharacter(buildEelParts()),
        abilities: [
            { name: 'Zap', type: 'aoe', power: 0.9, cost: 0, skillType: null, description: 'Coils up, then shocks everything around it.' }
        ]
    },
    // Dunes of Force creatures
    dune_viper: {
        id: 'dune_viper', name: 'Dune Viper', ai: 'snake', aggroDist: 30, maxHp: 42, hp: 42, attack: 14, defense: 4, speed: 9, xpReward: 30,
        build3D: () => VoxelBuilder.buildCharacter(buildSnakeParts()),
        abilities: [
            { name: 'Venom Spit', type: 'ranged', power: 0.7, cost: 0, skillType: null, description: 'Lobs a glob of poison that arcs through the air and leaves you poisoned.' }
        ]
    },
    scortus: {
        id: 'scortus', name: 'Scortus', ai: 'scortus', aggroDist: 34, maxHp: 80, hp: 80, attack: 16, defense: 8, speed: 10, xpReward: 45,
        build3D: () => buildScortus3D(),
        abilities: [
            { name: 'Cactus Needle', type: 'ranged', power: 0.8, cost: 0, skillType: null, description: 'Fires a long needle from its tail.' },
            { name: 'Claw', type: 'attack', power: 0.8, cost: 0, skillType: null, description: 'A spiny claw snap.' }
        ]
    },
    fire_fish: {
        id: 'fire_fish', name: 'Fire Fish', ai: 'firefish', aggroDist: 40, maxHp: 38, hp: 38, attack: 12, defense: 3, speed: 12, xpReward: 26,
        build3D: () => VoxelBuilder.buildCharacter(buildFireFishParts()),
        abilities: [
            { name: 'Ember Spit', type: 'ranged', power: 0.7, cost: 0, skillType: null, description: 'Spits sparks of burning air that set you ablaze.' }
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
