// World layout constants (single seamless world, no scene-swap between chapters).
// The village sits near z = +20. The player then has a long journey south (three regions:
// Sunny Meadows -> Windy Highlands -> Crab Marsh) before reaching the Temple of Crabs, whose
// entrance is at z = -70 + TEMPLE_OFFSET. Past the temple lies the Ruined Ocean and Oblongtalo's Arena.
const WORLD_SEED = 20240611;  // same seed every run -> same world (needed so saved games line up)
const TEMPLE_OFFSET = -600;   // how much farther south the temple + ocean sit (bigger = longer journey)
const WORLD = {
    playerSpawn: { x: 0, z: 30 },
    barnicoPos: { x: 6, z: 14 },
    octaPos: { x: -6, z: 16 },
    shopkeeperPos: { x: 12, z: 24 },
    crotonTempleZ: -132 + TEMPLE_OFFSET,     // Croton's position, deep in the temple's boss arena
    oceanStartZ: -163 + TEMPLE_OFFSET,
    handWaveTriggerZ: -178 + TEMPLE_OFFSET,
    arenaZ: -210 + TEMPLE_OFFSET,
    oceanBlendStartZ: -40 + TEMPLE_OFFSET,   // sky/fog start shifting toward "underwater" here...
    oceanFogThresholdZ: -138 + TEMPLE_OFFSET // ...and are fully underwater by here (inside Croton's arena)
};
// Journey regions between the village and the Temple of Crabs (z ranges, north -> south)
const TEMPLE_FRONT_Z = -70 + TEMPLE_OFFSET;   // z of the temple's front door
const REGIONS = {
    meadowsEnd: -230,     // Sunny Meadows:   village edge .. z -230   (gentle, lakes + caves + a few crabs)
    highlandsEnd: -440    // Windy Highlands: z -230 .. -440           (rocky, ruins, camps); Crab Marsh after, up to the temple
};
// The Coral Reef: after the boat, the wave drops you at its start and you cross it to reach Oblongtalo.
// Its length equals the walk from Octo Village (z 18) to the Temple of Crabs door, as asked.
const REEF_START_Z = -900;
const REEF_LENGTH = 18 - TEMPLE_FRONT_Z;            // = 688 units
const REEF_END_Z = REEF_START_Z - REEF_LENGTH;      // = -1588: Oblongtalo's plaza begins right after
WORLD.arenaZ = REEF_END_Z - 36;                     // the arena now sits at the far end of the reef
// The Dunes of Force (Chapter 3): a long desert beyond Oblongtalo's plaza, the same length as the reef.
const DESERT_START_Z = WORLD.arenaZ - 150;
const DESERT_LENGTH = REEF_LENGTH;
const DESERT_END_Z = DESERT_START_Z - DESERT_LENGTH;
// Cacto Village (ruins) sits near the far end of the desert; the quicksand that leads to the Gravity Core is hidden in it.
const VILLAGE = { x: 0, z: DESERT_END_Z + 105 };
const QUICKSAND = { x: -38, z: VILLAGE.z - 30, r: 9 };
// Boat voyage: a small stretch of open sea, built far off to the side of the world (only used in the cutscene)
const SEA = { x: 1400, z: -760 };
// The Sky Kingdom (Chapter 4): a cloud city far off to the side, reached by riding a giant friendly cloud. (Its z is past the dunes so dune hills never reach it.)
const SKY = { x: -2200, z: DESERT_END_Z - 600 };
const SKY_RADIUS = 150;
// Makani Village (Chapter 4): a village of cloud roads and houses held up by clouds, a long cloud road north of the cloud city.
const MAKANI = { x: SKY.x, z: SKY.z - 340 };
// The Stairs of Foam (Chapter 4's end): a long cloud road north of Makani leads to the Sky Guards' arena at the foot of the stairs that climb to the Sun of Time.
const FOAM = { x: MAKANI.x, z: MAKANI.z - 235 };

class Overworld3D {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20);

        const LOW = !!window.LOW_GFX;   // phones and "Low Graphics" mode: no anti-aliasing, no shadows, smaller picture, shorter view
        this.cullScale = LOW ? 0.8 : 1;
        this.renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = !LOW;
        this.renderer.shadowMap.type = THREE.PCFShadowMap; // cheaper than PCFSoft; fine on integrated graphics
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.92; // a touch under 1 keeps the colors rich instead of bleached
        this.container.appendChild(this.renderer.domElement);

        this.controls = null;

        // Soft sky/ground bounce light + a warm sun with crisp shadows that follows the player.
        this.hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x6f8f4a, 0.62);
        this.scene.add(this.hemiLight);
        this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.15);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(1024, 1024);
        const sc = this.sunLight.shadow.camera;
        sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 320;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.4;
        this.sunOffset = new THREE.Vector3(70, 110, 45);
        this.sunLight.position.copy(this.sunOffset);
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        this.swayers = [];   // plants that sway in the wind: { obj, phase, amp, speed }
        // A small fixed pool of real lights shared by every lantern/torch-lit room in the world. The
        // light count never changes (so shaders never recompile); each light just moves to a nearby source.
        this.lightSources = [];
        this.lightPool = [0, 1].map(() => { const l = new THREE.PointLight(0xffc070, 0, 40); l.position.set(0, -50, 0); this.scene.add(l); return l; });
        this.buildSky();
        this.buildAmbientParticles();

        this.worldGroup = new THREE.Group();
        this.scene.add(this.worldGroup);

        this.entities = [];
        this.playerObj = null;
        this.keys = {};
        this.velocityY = 0;
        this.isJumping = false;
        this.grounded = true;

        this.isClimbing = false;
        this.isGliding = false;
        this.lastFrameTime = performance.now();

        this.cameraTarget = new THREE.Vector3(0, 5, 0);
        this.colliders = [];
        this.houses = [];

        this.isMobile = !!window.IS_MOBILE;   // decided in index.html (touch screen, or ?mobile=1)
        this.stick = { x: 0, y: 0, active: false };   // the on-screen joystick (see mobile.js)
        this.cameraYaw = 0;
        this.cameraPitch = 0;

        this.handWaveTriggered = false;   // the boat voyage has started (stepped through the Sea Gate)
        this.arenaTriggered = false;      // Oblongtalo's challenge has started
        this.reefReached = false;         // the wave has carried the player into the Coral Reef
        this.desertReached = false;       // Oblongtalo sent the player to the Dunes of Force (Chapter 3)
        this.metVillagers = new Set();    // Makani villagers you have talked to
        this.nearVillager = null; this.nearPick = null; this.talkingTo = null;
        this.desertEndTriggered = false;
        this.dunes = [];                  // the shifting dunes
        this.voyage = null;               // the boat cutscene, while it runs

        this.bindEvents();
    }

    // --- Atmosphere: sky gradient, sun, clouds, particles ---------------------------

    buildSky() {
        const uniforms = {
            topColor: { value: new THREE.Color(0x3f86d6) },
            horizonColor: { value: new THREE.Color(0xd3e8ea) },
            groundColor: { value: new THREE.Color(0xdff0e0) },
            sunDir: { value: this.sunOffset.clone().normalize() },
            sunGlow: { value: 1.0 }  // fades to 0 in the ocean
        };
        const mat = new THREE.ShaderMaterial({
            uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
            vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            // Three-stop sky: deep blue zenith -> mid sky blue -> pale haze horizon, plus a warm golden glow
            // around the sun and a soft peachy tint near the horizon so it never reads as one flat blue.
            fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor; uniform vec3 sunDir; uniform float sunGlow; varying vec3 vDir;' +
                'void main(){' +
                '  float h = vDir.y; vec3 c;' +
                '  if (h > 0.0) {' +
                '    vec3 mid = mix(topColor, vec3(0.45,0.72,0.93), 0.45);' +
                '    float k = clamp(h, 0.0, 1.0);' +
                '    c = k < 0.3 ? mix(horizonColor, mid, pow(k/0.3, 0.8)) : mix(mid, topColor, pow((k-0.3)/0.7, 0.7));' +
                '  } else { c = mix(horizonColor, groundColor, clamp(-h*4.0,0.0,1.0)); }' +
                '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);' +
                '  c += vec3(1.0,0.78,0.45) * pow(s, 6.0) * 0.30 * sunGlow;' +
                '  c += vec3(1.0,0.92,0.7) * pow(s, 60.0) * 0.5 * sunGlow;' +
                '  float haze = exp(-abs(h)*7.0);' +
                '  c = mix(c, vec3(1.0,0.86,0.72), haze * 0.18 * sunGlow);' +
                '  gl_FragColor = vec4(c, 1.0);' +
                '}'
        });
        this.skyUniforms = uniforms;
        this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), mat);
        this.skyDome.frustumCulled = false;
        this.skyDome.renderOrder = -10;
        this.scene.add(this.skyDome);

        // Sun disc + soft halo placed along the sun's direction
        const sunDir = this.sunOffset.clone().normalize();
        this.sunDir = sunDir;
        this.sunGroup = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CircleGeometry(24, 28), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, depthWrite: false }));
        const halo = new THREE.Mesh(new THREE.CircleGeometry(60, 28), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.28, fog: false, depthWrite: false }));
        halo.position.z = -0.5;
        this.sunGroup.add(halo); this.sunGroup.add(disc);
        this.sunGroup.renderOrder = -9;
        this.scene.add(this.sunGroup);

        // Low-poly clouds that drift slowly across the sky
        this.clouds = new THREE.Group();
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false, depthWrite: false });
        this.cloudMat = cloudMat;
        for (let i = 0; i < 16; i++) {
            const cloud = new THREE.Group();
            const puffs = 4 + Math.floor(Math.random() * 3);
            for (let p = 0; p < puffs; p++) {
                const puff = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 9, 10, 8), cloudMat);
                puff.position.set((p - puffs / 2) * 14 + Math.random() * 6, Math.random() * 5, (Math.random() - 0.5) * 12);
                puff.scale.y = 0.55;
                cloud.add(puff);
            }
            cloud.position.set((Math.random() - 0.5) * 900, 150 + Math.random() * 90, (Math.random() - 0.5) * 900);
            this.clouds.add(cloud);
        }
        this.clouds.renderOrder = -8;
        this.scene.add(this.clouds);
    }

    // Floating motes around the player: golden pollen/fireflies on land, pale "sea snow" underwater.
    buildAmbientParticles() {
        const N = 260;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(N * 3);
        this.motePhase = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 90;
            pos[i * 3 + 1] = 0.5 + Math.random() * 22;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
            this.motePhase[i] = Math.random() * Math.PI * 2;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        // Soft round glow sprite (otherwise points render as hard white squares)
        const sc = document.createElement('canvas'); sc.width = sc.height = 64;
        const sg = sc.getContext('2d');
        const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
        const mat = new THREE.PointsMaterial({ color: 0xffe9a0, size: 0.42, map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        this.motes = new THREE.Points(geo, mat);
        this.motes.frustumCulled = false;
        this.moteColorCoast = new THREE.Color(0xfff2a8);
        this.moteColorOcean = new THREE.Color(0x9fd8ff);
        this.scene.add(this.motes);
    }

    // Soft, repeating ripple texture for water surfaces (generated, no image assets).
    getWaterTexture() {
        if (this.waterTex) return this.waterTex;
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(120,180,230,0.55)'; g.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
            const y = 8 + i * 14 + (i % 2) * 4;
            g.beginPath();
            for (let x = 0; x <= 128; x += 4) {
                const yy = y + Math.sin((x / 128) * Math.PI * 2 + i) * 3;
                if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
            }
            g.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 6);
        this.waterTex = tex;
        return tex;
    }

    // Radial depth gradient for pond beds: sandy rim -> turquoise shallows -> deep blue centre.
    getPondDepthTexture() {
        if (this.pondTex) return this.pondTex;
        const S = 256;
        const c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grad.addColorStop(0.0, '#123f7a');   // deep centre
        grad.addColorStop(0.45, '#1f6fa8');
        grad.addColorStop(0.75, '#3fb5b8');  // turquoise shallows
        grad.addColorStop(0.92, '#a9d9c0');
        grad.addColorStop(1.0, '#d8cf9a');   // sandy rim
        g.fillStyle = grad; g.fillRect(0, 0, S, S);
        // faint mottling so the bed isn't a perfect gradient
        for (let i = 0; i < 160; i++) {
            g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,30,60,0.10)';
            g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 12, 0, Math.PI * 2); g.fill();
        }
        this.pondTex = new THREE.CanvasTexture(c);
        return this.pondTex;
    }

    // Procedural ground texture: speckled grass / sand / seabed (generated, no image assets).
    // opts: { base, patches:[colors], light, dark, blades }. Large soft color patches give the ground
    // natural variation (several greens, olive, bare earth) instead of one flat color.
    makeGroundTexture(opts) {
        const S = 512;
        const c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d');
        g.fillStyle = opts.base; g.fillRect(0, 0, S, S);
        // Big soft blotches, drawn wrapped around the edges so the tile repeats without seams
        const blotch = (x, y, r, col, a) => {
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, col); grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = a; g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        };
        for (let i = 0; i < 46; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 90;
            const col = opts.patches[Math.floor(Math.random() * opts.patches.length)];
            const a = 0.35 + Math.random() * 0.4;
            for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) blotch(x + ox, y + oy, r, col, a);
        }
        // Fine speckle + grass blades
        for (let i = 0; i < 1400; i++) {
            g.fillStyle = Math.random() > 0.5 ? opts.light : opts.dark;
            g.globalAlpha = 0.16 + Math.random() * 0.25;
            const s = 1.5 + Math.random() * 6;
            g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, s, s * 0.6, Math.random() * 3, 0, Math.PI * 2); g.fill();
        }
        if (opts.blades) {
            g.globalAlpha = 0.5; g.lineWidth = 1.2;
            for (let i = 0; i < 1100; i++) {
                g.strokeStyle = Math.random() > 0.5 ? opts.light : opts.dark;
                const x = Math.random() * S, y = Math.random() * S;
                g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 5, y - 3 - Math.random() * 7); g.stroke();
            }
        }
        if (opts.ripples) { // long, wavy wind ripples
            g.lineWidth = 2;
            for (let i = 0; i < 46; i++) {
                const y0 = Math.random() * S, ph = Math.random() * 6, amp = 2 + Math.random() * 5;
                g.strokeStyle = Math.random() > 0.5 ? opts.light : opts.dark; g.globalAlpha = 0.14 + Math.random() * 0.16;
                g.beginPath();
                for (let x = 0; x <= S; x += 8) { const yy = y0 + Math.sin(x / S * Math.PI * 4 + ph) * amp; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
                g.stroke();
            }
        }
        g.globalAlpha = 1;
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        return tex;
    }

    // Merge every mesh under `group` into ONE mesh (colors baked in as vertex colors) so a plant with
    // dozens of blades/petals/leaf-blobs costs a single draw call. The group keeps its own transform,
    // so wind sway (which rotates the group) still works.
    mergeGroup(group, opts = {}) {
        group.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
        const mtx = new THREE.Matrix4();
        const P = [], N = [], C = [];
        const dead = [];
        const excluded = (o) => { if (!opts.exclude) return false; for (let a = o; a; a = a.parent) if (opts.exclude.includes(a)) return true; return false; };
        group.traverse(o => {
            if (!o.isMesh || excluded(o)) return;
            const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
            mtx.multiplyMatrices(inv, o.matrixWorld);
            geo.applyMatrix4(mtx);
            const col = o.material.color;
            const pa = geo.attributes.position.array, na = geo.attributes.normal.array;
            for (let i = 0; i < pa.length; i += 3) { P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]); C.push(col.r, col.g, col.b); }
            geo.dispose();
            dead.push(o);
        });
        if (!dead.length) return null;
        dead.forEach(o => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); });
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        mg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        mg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        const key = opts.flat ? 'vcMatFlat' : 'vcMat';
        if (!this[key]) this[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: !!opts.flat });
        // `own` gives this mesh a private material, needed for things that flash on hit (creatures).
        const mesh = new THREE.Mesh(mg, opts.material || (opts.own ? this[key].clone() : this[key]));
        mesh.castShadow = opts.castShadow !== false;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    // Merge a crab into 3 draw calls: one body mesh plus one mesh per claw (the claws keep their pivot
    // groups so the animation system can still snap and raise them).
    mergeCrab(mesh) {
        const pinches = ['pinch_l', 'pinch_r'].map(n => mesh.getObjectByName(n)).filter(Boolean);
        pinches.forEach(p => this.mergeGroup(p, { own: true }));
        this.mergeGroup(mesh, { own: true, exclude: pinches });
    }

    // Register a plant so it sways gently in the wind.
    addSway(obj, amp = 0.05, speed = 1.4) {
        this.swayers.push({ obj, amp, speed, base: obj.rotation.z, phase: Math.random() * Math.PI * 2 });
    }

    // Per-frame atmosphere: wind, water ripples, sky/sun/cloud follow, drifting motes, sun shadows.
    updateAtmosphere(delta, ocean) {
        const t = performance.now() * 0.001;
        for (const s of this.swayers) {
            s.obj.rotation.z = s.base + Math.sin(t * s.speed + s.phase) * s.amp;
        }
        if (this.waterTex) { this.waterTex.offset.x += delta * 0.012; this.waterTex.offset.y += delta * 0.007; }

        const cam = this.camera.position;
        if (this.skyDome) this.skyDome.position.copy(cam);
        if (this.sunGroup) {
            this.sunGroup.position.copy(cam).addScaledVector(this.sunDir, 600);
            this.sunGroup.lookAt(cam);
            this.sunGroup.visible = ocean < 0.85;
        }
        if (this.clouds) {
            this.clouds.visible = ocean < 0.95;
            this.clouds.children.forEach(c => { c.position.x += delta * 2.2; if (c.position.x > 450) c.position.x = -450; });
            this.clouds.position.set(cam.x * 0.6, 0, cam.z * 0.6); // parallax: clouds move slower than the player
            this.cloudMat.opacity = 0.92 * (1 - ocean);
        }
        if (this.motes) {
            const p = this.playerObj ? this.playerObj.position : cam;
            this.motes.position.set(p.x, 0, p.z);
            const arr = this.motes.geometry.attributes.position.array;
            for (let i = 0; i < this.motePhase.length; i++) {
                arr[i * 3] += Math.sin(t * 0.6 + this.motePhase[i]) * delta * 1.4;
                arr[i * 3 + 1] += (0.4 + Math.sin(t * 0.9 + this.motePhase[i]) * 0.5) * delta;
                arr[i * 3 + 2] += Math.cos(t * 0.5 + this.motePhase[i]) * delta * 1.4;
                if (arr[i * 3 + 1] > 24) arr[i * 3 + 1] = 0.5;
                if (arr[i * 3] > 45) arr[i * 3] = -45; else if (arr[i * 3] < -45) arr[i * 3] = 45;
                if (arr[i * 3 + 2] > 45) arr[i * 3 + 2] = -45; else if (arr[i * 3 + 2] < -45) arr[i * 3 + 2] = 45;
            }
            this.motes.geometry.attributes.position.needsUpdate = true;
            this.motes.material.color.copy(this.moteColorCoast).lerp(this.moteColorOcean, ocean);
        }
        this.updateTalkPrompt();
        if (this.skyReached && this.makaniVanes) {                                          // windmills and pinwheels (the windmills spin crazy-fast until the Windmill Mystery is solved)
            const mul = this.windMul || 1;
            this.makaniVanes.forEach(v => { v.a = (v.a === undefined ? v.ph : v.a) + delta * v.sp * (v.kind === 'windmill' ? mul : 1); v.g.rotation.z = v.a; });
            if (window.SideQuests) SideQuests.update(delta);
            if (window.SkyGuards) SkyGuards.update(delta);
            if (this.sunOfTime) this.sunOfTime.ring.rotation.z += delta * 0.15;
        }
        if (this.skyReached && this.skyCloud && this.skyCloud.visible && !this.skyRide) {   // the parked cloud bobs gently
            this.skyCloud.position.y = 3.4 + Math.sin(t * 1.3) * 0.35;
            this.animateSkyCloud(this.skyCloud, t, 0.5);
        }
        if (this.desertReached) {
            this.updateDunes();
            const q = this.quicksand;
            if (q) { q.tex.rotation += delta * 0.45; const tt = performance.now() * 0.001; q.bubbles.forEach(b => { const s = 0.5 + Math.abs(Math.sin(tt * b.sp + b.ph)) * 1.1; b.m.scale.setScalar(s); b.m.position.y = 0.1 + s * 0.2; }); }
        }
        this._cullTick = (this._cullTick || 0) + 1;
        if (this._cullTick % 10 === 1) { this.updateCulling(); this.updateSound(); }
        Quest.update(delta);
        // Keep the sun's shadow box centred on the player so shadows stay crisp nearby.
        if (this.sunLight && this.playerObj) {
            const pp = this.playerObj.position;
            this.sunLight.position.set(pp.x + this.sunOffset.x, this.sunOffset.y, pp.z + this.sunOffset.z);
            this.sunLight.target.position.set(pp.x, 0, pp.z);
            this.sunLight.target.updateMatrixWorld();
        }
    }

    start(party) {
        if (this.isMobile) {
            if (window.Mobile) Mobile.show();
        } else {
            if (!this.controls && typeof THREE.PointerLockControls !== 'undefined') {
                this.controls = new THREE.PointerLockControls(this.camera, document.body);
                document.getElementById('canvas-container').addEventListener('click', () => {
                    if (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'gauntlet' || window.gameSystem.state === 'core') {
                        this.controls.lock();
                    }
                });
            }
        }

        this.playerObj = party[0].build3D();
        this.playerObj.position.set(WORLD.playerSpawn.x, 0, WORLD.playerSpawn.z);
        this.scene.add(this.playerObj);

        this.buildWorld();
        this.animate();
    }

    // --- World construction -------------------------------------------------

    // The world is generated with random scatter, but always from the same seed, so every run (and every
    // save file) sees the exact same lakes, camps, crabs and chests. Saves just remember what's gone.
    buildWorld() {
        const realRandom = Math.random;
        let s = WORLD_SEED >>> 0;
        Math.random = () => { // mulberry32
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        try { this._buildWorld(); } finally { Math.random = realRandom; }
        this.entities.forEach((e, i) => { e.uid = i; }); // stable ids, used by the save system
        this._entityTotal = this.entities.length;
    }

    _buildWorld() {
        this._coinCount = 0;
        this.collectedCoins = [];
        if (this.worldGroup) this.scene.remove(this.worldGroup);
        this.worldGroup = new THREE.Group();
        this.scene.add(this.worldGroup);

        this.entities.forEach(ent => { if (ent.mesh && ent.mesh.parent) ent.mesh.parent.remove(ent.mesh); });
        this.entities = [];
        this.colliders = [];
        this.houses = [];
        this.lakes = [];
        this.templeGates = [];
        this.swayers = [];
        this.lightSources = [];
        this.dunes = [];

        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0xd3e8ea, 100, 320); // long, soft haze so distant hills/huts melt into the sky
        this.coastFogColor = new THREE.Color(0xd3e8ea);
        this.oceanFogColor = new THREE.Color(0x0d2b3a);
        this.coastBgColor = new THREE.Color(0x87ceeb);
        this.oceanBgColor = new THREE.Color(0x081820);
        this.coastSkyTop = new THREE.Color(0x3f86d6);
        this.oceanSkyTop = new THREE.Color(0x050f1a);
        this.hemiSkyCoast = new THREE.Color(0xcfe8ff);   this.hemiSkyOcean = new THREE.Color(0x4a9fc0);
        this.hemiGroundCoast = new THREE.Color(0x6f8f4a); this.hemiGroundOcean = new THREE.Color(0x1d4a55);
        this.sunCoast = new THREE.Color(0xfff1d6);       this.sunOcean = new THREE.Color(0x6fc8e8);
        // The sunlit Coral Reef is a brighter, greener-blue underwater than the gloomy ocean by the temple.
        this.reefFogColor = new THREE.Color(0x1a7f95);   this.reefSkyTop = new THREE.Color(0x0e5a7a);
        this.hemiSkyReef = new THREE.Color(0x9ceeff);    this.hemiGroundReef = new THREE.Color(0x3a9a8c);
        this.sunReef = new THREE.Color(0xb8f4ff);
        // The Dunes of Force: hot, hazy and golden
        this.desertFogColor = new THREE.Color(0xf2dba8); this.desertSkyTop = new THREE.Color(0x6bb3ea);
        this.hemiSkyDesert = new THREE.Color(0xfff2d6);  this.hemiGroundDesert = new THREE.Color(0xd9ab62);
        this.sunDesert = new THREE.Color(0xffe2a0);
        // The Sky Kingdom: a bright, clean, airy blue day high above the clouds
        this.skyFogColor = new THREE.Color(0xeaf4ff);    this.skySkyTop = new THREE.Color(0x3d9cf2);
        this.hemiSkyAir = new THREE.Color(0xffffff);     this.hemiGroundAir = new THREE.Color(0xb9d4f2);
        this.sunAir = new THREE.Color(0xfff8e6);

        // ---- Clean ground in uniform bands: grass coast -> sandy beach -> ocean floor ----
        const makeGround = (zNorth, zSouth, tex) => {
            const w = 330, l = zNorth - zSouth;
            tex.repeat.set(w / 70, l / 70); // one texture tile per ~70 world units (big natural patches)
            const geo = new THREE.PlaneGeometry(w, l);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(0, 0, (zNorth + zSouth) / 2);
            mesh.receiveShadow = true;
            this.worldGroup.add(mesh);
        };
        // Region 1 - Sunny Meadows: emerald, meadow, yellow-green, olive, deep forest green, bare earth
        makeGround(110, REGIONS.meadowsEnd, this.makeGroundTexture({
            base: '#3f9a24', light: '#8fd13c', dark: '#26701c', blades: true,
            patches: ['#55b52e', '#1f7a2c', '#a8c93a', '#5f8f26', '#16692f', '#c9ae3c', '#8a6a33', '#2fae4f']
        }));
        // Region 2 - Windy Highlands: dry olive grass, tan earth, stony grey patches
        makeGround(REGIONS.meadowsEnd, REGIONS.highlandsEnd, this.makeGroundTexture({
            base: '#7d9a38', light: '#b7c45a', dark: '#566f2a', blades: true,
            patches: ['#9aa84a', '#a6925a', '#7a7a5a', '#8a8f62', '#b09c62', '#5f7a35', '#8c6f45', '#a3a080']
        }));
        // Region 3 - Crab Marsh: dark wet green, teal mud and rusty-red crab-shell soil
        makeGround(REGIONS.highlandsEnd, -52 + TEMPLE_OFFSET, this.makeGroundTexture({
            base: '#2f6f4a', light: '#58a077', dark: '#1d4a35', blades: true,
            patches: ['#25594a', '#3f7a5a', '#4d6a4a', '#6a5a3a', '#7a4a3a', '#2a6a68', '#4a8a6a', '#5a5a3a']
        }));
        // Beach in front of the temple: warm sand with pale shell-white and damp tan patches
        makeGround(-52 + TEMPLE_OFFSET, -66 + TEMPLE_OFFSET, this.makeGroundTexture({
            base: '#e0cf9a', light: '#f3e7c0', dark: '#bfa972', blades: false,
            patches: ['#ead9a6', '#d4bd86', '#f1e4c2', '#c9b07a', '#e6c99a']
        }));
        // Ocean floor: deep teal with sandy-silt and murky purple-blue patches
        makeGround(-66 + TEMPLE_OFFSET, REEF_START_Z, this.makeGroundTexture({
            base: '#1f4a4a', light: '#3d7a74', dark: '#143232', blades: false,
            patches: ['#2a5f5a', '#1b3d4a', '#355a6a', '#4a6a5a', '#2d4a5e', '#5a6a58']
        }));
        // Coral Reef floor: pale sand with coral-pink, sea-green and golden patches (the lighting will turn it teal)
        makeGround(REEF_START_Z, WORLD.arenaZ - 120, this.makeGroundTexture({
            base: '#8fc7b4', light: '#d4f0d8', dark: '#4f9a92', blades: false,
            patches: ['#e49ab0', '#f2c883', '#5fc7c0', '#9d8fd6', '#d6e8a8', '#6fb6d8', '#f0a58a', '#3f9aa0']
        }));

        this.buildEmeraldCoast();
        this.buildTransition();
        this.buildRuinedOcean();
        this.buildCoralReef();
        this.buildOblongtaloArena();
        this.buildDunesOfForce();
        // Desert sand (built last, so adding it never changes the random layout of everything before it):
        // warm gold with paler dune-crests, rusty patches and faint wind ripples
        makeGround(WORLD.arenaZ - 120, DESERT_END_Z - 140, this.makeGroundTexture({
            base: '#e3c079', light: '#f6e2ad', dark: '#c79a52', blades: false, ripples: true,
            patches: ['#efd18d', '#d9ae62', '#c99a52', '#f3dca4', '#b98a48', '#e8c77f']
        }));
        this.buildSkyKingdom();   // (Chapter 4 goes last, too)
        this.buildMakaniVillage();

        // Record every small top-level prop so we can hide the ones far beyond the fog each frame
        // (big things like the ground, temple and cliff walls are left alone).
        this.cullables = [];
        const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
        this.worldGroup.updateMatrixWorld(true);
        this.worldGroup.children.forEach(o => {
            box.setFromObject(o); if (box.isEmpty()) return;
            box.getSize(size);
            const footprint = Math.max(size.x, size.z);
            // Tiny things (grass, flowers, bushes, pickups) vanish sooner than big things (trees, towers).
            if (footprint < 60) { box.getCenter(ctr); this.cullables.push({ o, x: ctr.x, z: ctr.z, near: footprint < 5 }); }
        });
    }

    // Pick the background music for where the player is, and let the Flow Song creature call out when near.
    updateSound() {
        if (!this.playerObj || this.voyage || (window.GravityCore && GravityCore.active)) return;   // (the boat cutscene and the Gravity Core pick their own music)
        const p = this.playerObj.position, gs = window.gameSystem;
        const croton = this.entities.find(e => e.bossId === 'croton');
        let mood = 'wild';
        if (gs.state === 'gauntlet' || this.oblongtaloMesh) mood = 'gauntlet';
        else if (croton && Math.hypot(p.x - croton.mesh.position.x, p.z - croton.mesh.position.z) < 45) mood = 'boss';
        else if (window.SkyGuards && SkyGuards.active) mood = 'guards';           // EPIC: the Sky Guards
        else if (this.skyReached) mood = 'sky';
        else if (this.desertReached) mood = 'dunes';
        else if (this.reefReached && p.z < REEF_START_Z + 30 && p.z > REEF_END_Z - 6) mood = 'reef';
        else if (p.z < WORLD.oceanStartZ + 12) mood = 'ocean';
        else if (p.z < TEMPLE_FRONT_Z + 14) mood = 'temple';
        else if (p.z > -78) mood = 'village';
        Sound.setMood(mood);

        const song = this.entities.find(e => e.type === 'song');
        if (song) {
            const d = Math.hypot(p.x - song.mesh.position.x, p.z - song.mesh.position.z);
            Sound.setBeacon(1 - d / 90);
            if (d < 80 && !this._songHinted) { this._songHinted = true; gs.showToast('♪ A faint, friendly melody drifts on the wind...'); }
        } else Sound.setBeacon(0);
    }

    // Hide props and creatures beyond the fog distance (they're invisible in the haze anyway).
    updateCulling() {
        if (!this.cullables || !this.playerObj) return;
        const px = this.playerObj.position.x, pz = this.playerObj.position.z;

        // Point the pooled lights at the nearest lantern/torch sources (if any are close enough to matter).
        if (this.lightPool && this.lightSources) {
            const near = this.lightSources
                .map(s => ({ s, d: Math.hypot(s.x - px, s.z - pz) }))
                .filter(o => o.d < o.s.range + 30)
                .sort((a, b) => a.d - b.d);
            this.lightPool.forEach((light, i) => {
                const pick = near[i];
                if (pick) { light.position.set(pick.s.x, pick.s.y, pick.s.z); light.color.setHex(pick.s.color); light.distance = pick.s.range; light.intensity = pick.s.intensity; }
                else { light.intensity = 0; light.position.set(0, -50, 0); }
            });
        }
        const D = ((this.scene.fog ? this.scene.fog.far : 380) + 25) * (this.cullScale || 1), D2 = D * D;
        const SMALL = Math.min(D, 125), SMALL2 = SMALL * SMALL;       // tiny props
        const CREATURE = Math.min(D, 150), CREATURE2 = CREATURE * CREATURE; // crabs and chests
        for (const c of this.cullables) { const dx = c.x - px, dz = c.z - pz; c.o.visible = dx * dx + dz * dz < (c.near ? SMALL2 : D2); }
        if (this.arenaGroup) { const dx = this.arenaCenter.x - px, dz = this.arenaCenter.z - pz, R = D + 45; this.arenaGroup.visible = dx * dx + dz * dz < R * R; } // the plaza is big: hide it when far away
        for (const e of this.entities) {
            if (!e.mesh || e.type === 'story_npc' || e.type === 'shopkeeper' || e.type === 'cat' || e.type === 'clue' || e.type === 'bully') continue;
            const dx = e.mesh.position.x - px, dz = e.mesh.position.z - pz;
            e.mesh.visible = dx * dx + dz * dz < CREATURE2;
        }
    }

    addCollider(mesh, opts = {}) {
        const box = new THREE.Box3().setFromObject(mesh);
        if (opts.shrink) box.expandByScalar(-opts.shrink);
        box.meshGroup = mesh;
        if (opts.climbable) box.climbable = true;
        if (opts.isCoin) box.isCoin = true;
        this.colliders.push(box);
        return box;
    }

    addProp(group, x, z, colliderOpts) {
        group.position.set(x, 0, z);
        this.worldGroup.add(group);
        if (colliderOpts !== false) this.addCollider(group, colliderOpts || { shrink: 0.5 });
    }

    // True if a box of the given half-size at (x,z) overlaps a solid collider (walls, gates, props).
    // Used so enemies can't walk through walls. Ignores coins and story trigger volumes.
    isBlocked(x, z, half) {
        const b = new THREE.Box3(
            new THREE.Vector3(x - half, 0.5, z - half),
            new THREE.Vector3(x + half, 3, z + half)
        );
        for (const c of this.colliders) {
            if (c.isCoin || c.isTrigger) continue;
            if (b.intersectsBox(c)) return true;
        }
        return false;
    }

    // Walk-in round hut. The door faces doorAngle (0 = +z, PI/2 = +x). The wall collides as a
    // ring of small boxes with a gap at the door, so the player can walk inside.
    buildHut(x, z, doorAngle = 0, opts = {}) {
        const withLight = opts.light !== false; // real light-casting only for a few huts (perf)
        const R = 7, H = 7, doorH = 5.5, doorHalf = 0.32;
        const g = new THREE.Group();
        g.position.set(x, 0, z);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true, doorHalf, PI * 2 - doorHalf * 2), wallMat);
        wall.position.y = H / 2;
        wall.rotation.y = doorAngle;
        wall.castShadow = true;
        wall.receiveShadow = true;
        g.add(wall);
        const lintel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - doorH, 8, 1, true, -doorHalf, doorHalf * 2), wallMat);
        lintel.position.y = doorH + (H - doorH) / 2;
        lintel.rotation.y = doorAngle;
        g.add(lintel);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 1.5, 5, 40), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }));
        roof.position.y = H + 2.5;
        roof.castShadow = true;
        g.add(roof);

        // Interior: wooden floor, rug, bed, table with stools, and a warm lantern.
        // All the furniture goes into one group that is merged into a single mesh at the end (perf).
        const interior = new THREE.Group();
        g.add(interior);
        const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.8 });
        const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0xb08250, roughness: 0.9 }));
        floor.position.y = 0.05;
        floor.receiveShadow = true;
        interior.add(floor);
        const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0xb8433a, roughness: 1 }));
        rug.position.y = 0.12;
        interior.add(rug);

        // Furniture is placed in door-relative coordinates: +f toward the door, +s to its side.
        const fwd = new THREE.Vector3(Math.sin(doorAngle), 0, Math.cos(doorAngle));
        const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const local = (f, s) => new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(side, s);
        const furniture = [];

        const bed = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 5), wood);
        frame.position.y = 0.5;
        bed.add(frame);
        const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.3, 3.6), new THREE.MeshStandardMaterial({ color: 0x3b6ea5, roughness: 1 }));
        blanket.position.set(0, 1.15, 0.6);
        bed.add(blanket);
        const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), new THREE.MeshStandardMaterial({ color: 0xf2eee0 }));
        pillow.scale.set(2.2, 0.6, 1.2);
        pillow.position.set(0, 1.25, -1.8);
        bed.add(pillow);
        bed.position.copy(local(-3.2, 2.2));
        bed.rotation.y = doorAngle;
        furniture.push(bed);

        const table = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 24), wood);
        top.position.y = 2.2;
        table.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.2, 10), wood);
        leg.position.y = 1.1;
        table.add(leg);
        table.position.copy(local(-1, -3));
        furniture.push(table);
        [0.9, -2.9].forEach(f => {
            const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14), wood);
            stool.position.copy(local(f, -3)).setY(0.6);
            interior.add(stool);
        });

        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa640, emissiveIntensity: 1 }));
        lantern.position.set(0, H - 1, 0);
        g.add(lantern);
        // The lantern's glow comes from a shared light pool that lights only the nearest few huts
        // (a real light per hut makes every surface in the game more expensive to shade).
        this.lightSources.push({ x, y: H - 1.5, z, range: R * 2.2, intensity: 0.9, color: 0xffc070 });

        furniture.forEach(f => interior.add(f));
        this.worldGroup.add(g);
        g.updateMatrixWorld(true);
        furniture.forEach(f => this.addCollider(f, { shrink: 0.2 })); // colliders first, from the individual pieces...
        this.mergeGroup(interior, { castShadow: false });             // ...then merge them all into one mesh

        const segs = 40;
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * PI * 2;
            const diff = Math.atan2(Math.sin(a - doorAngle), Math.cos(a - doorAngle));
            if (Math.abs(diff) < doorHalf + 0.1) continue;
            const cx = x + Math.sin(a) * R, cz = z + Math.cos(a) * R;
            this.colliders.push(new THREE.Box3(new THREE.Vector3(cx - 0.7, -1, cz - 0.7), new THREE.Vector3(cx + 0.7, H, cz + 0.7)));
        }

        this.houses.push({ x, z, r: R - 0.8, roof, wallMat });
    }

    // Returns the hut the player is standing in, if any.
    houseAt(pos) {
        return this.houses.find(h => Math.hypot(pos.x - h.x, pos.z - h.z) < h.r) || null;
    }

    isNearHouse(x, z, margin) {
        return this.houses.some(h => Math.hypot(x - h.x, z - h.z) < h.r + margin);
    }

    buildPalmTree(x, z) {
        const g = new THREE.Group();
        const h = 6.5 + Math.random() * 2.5;
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7547, roughness: 1 });
        // Slightly curved trunk made of tapering segments
        const segs = 4;
        let ty = 0, tx = 0;
        for (let i = 0; i < segs; i++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.34 - i * 0.04, 0.42 - i * 0.04, h / segs + 0.05, 8), trunkMat);
            seg.position.set(tx, ty + h / segs / 2, 0);
            seg.rotation.z = -0.06 * (i + 1);
            seg.castShadow = true;
            g.add(seg);
            ty += h / segs; tx += 0.18;
        }
        this.mergeGroup(g); // trunk segments -> one mesh
        // Crown of drooping fronds
        const crown = new THREE.Group();
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x35a852, roughness: 0.9, side: THREE.DoubleSide });
        for (let f = 0; f < 7; f++) {
            const a = (f / 7) * Math.PI * 2;
            const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.4, 4), frondMat);
            frond.geometry.translate(0, 2.2, 0);
            frond.rotation.set(Math.PI / 2 - 0.5, a, 0, 'YXZ');
            frond.castShadow = true;
            crown.add(frond);
        }
        this.mergeGroup(crown); // all fronds -> one mesh
        crown.position.set(tx, h, 0);
        g.add(crown);
        this.addSway(crown, 0.06, 1.1);
        this.addProp(g, x, z, { shrink: 1.2 });
    }

    buildCrabRock(x, z) {
        const g = new THREE.Group();
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1 }));
        rock.position.y = 1.5;
        g.add(rock);
        this.addProp(g, x, z, { shrink: 0.8 });
    }

    // --- Greenery -----------------------------------------------------------

    buildLeafyTree(x, z) {
        const g = new THREE.Group();
        const big = 0.85 + Math.random() * 0.7; // size variety
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * big, 0.75 * big, 5.5 * big, 8), trunkMat);
        trunk.position.y = 2.75 * big; trunk.castShadow = true; g.add(trunk);
        // A couple of roots and a branch stub give the trunk character
        [0.9, -0.9].forEach(s => {
            const root = new THREE.Mesh(new THREE.ConeGeometry(0.35 * big, 1.1 * big, 5), trunkMat);
            root.position.set(s * 0.55 * big, 0.45, 0.2); root.rotation.z = -s * 0.7; g.add(root);
        });
        this.mergeGroup(g); // trunk + roots -> one mesh
        // Canopy: a cluster of overlapping blobs, darker underneath and lighter on top
        const tint = [0x2e8f40, 0x3aa84c, 0x2b8a45, 0x4cae4c][Math.floor(Math.random() * 4)];
        const canopy = new THREE.Group();
        const blobs = 6 + Math.floor(Math.random() * 3);
        for (let i = 0; i < blobs; i++) {
            const top = i / blobs;
            const col = new THREE.Color(tint).lerp(new THREE.Color(0x8fd45a), top * 0.45);
            const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((2.2 - top * 0.7) * big, 1),
                new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }));
            blob.position.set((Math.random() - 0.5) * 3.6 * big, (5.2 + top * 3.4) * big, (Math.random() - 0.5) * 3.6 * big);
            blob.castShadow = true; canopy.add(blob);
        }
        this.mergeGroup(canopy, { flat: true }); // all leaf blobs -> one faceted mesh
        g.add(canopy);
        this.addSway(canopy, 0.025, 0.9);
        this.addProp(g, x, z, { shrink: 1.2 });
    }

    buildBush(x, z) {
        const g = new THREE.Group();
        const tint = [0x2f8a3a, 0x3a9a44, 0x2a7d3a][Math.floor(Math.random() * 3)];
        const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 1, flatShading: true });
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.55, 1), mat);
            b.position.set((Math.random() - 0.5) * 1.8, 0.8, (Math.random() - 0.5) * 1.8);
            b.castShadow = true;
            g.add(b);
        }
        if (Math.random() > 0.5) { // some bushes carry berries
            const berryMat = new THREE.MeshStandardMaterial({ color: [0xd23c4e, 0xe0a030, 0x7a4fd0][Math.floor(Math.random() * 3)], roughness: 0.5 });
            for (let i = 0; i < 6; i++) {
                const berry = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), berryMat);
                berry.position.set((Math.random() - 0.5) * 2.2, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 2.2);
                g.add(berry);
            }
        }
        this.mergeGroup(g, { flat: true });
        this.addSway(g, 0.015, 1.2);
        this.addProp(g, x, z, { shrink: 0.6 });
    }

    buildGrassTuft(x, z) {
        const g = new THREE.Group();
        const tints = [0x4caf50, 0x5cbf4c, 0x3f9d46, 0x6ccc55];
        const blades = 9;
        for (let i = 0; i < blades; i++) {
            const mat = new THREE.MeshStandardMaterial({ color: tints[i % tints.length], roughness: 1, side: THREE.DoubleSide });
            const hh = 1.1 + Math.random() * 0.9;
            const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, hh, 4), mat);
            blade.geometry.translate(0, hh / 2, 0); // pivot at the base so it sways from the ground
            blade.position.set((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4);
            blade.rotation.z = (Math.random() - 0.5) * 0.5;
            g.add(blade);
        }
        this.mergeGroup(g, { castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g); // no collider: walk through grass
        this.addSway(g, 0.09, 2.0);
    }

    buildFlower(x, z) {
        const g = new THREE.Group();
        const colors = [0xff6b6b, 0xffd93d, 0xda77f2, 0x4dabf7, 0xffffff, 0xff9f43];
        const col = colors[Math.floor(Math.random() * colors.length)];
        const n = 3 + Math.floor(Math.random() * 3); // flowers grow in little clusters
        for (let k = 0; k < n; k++) {
            const f = new THREE.Group();
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1, 5),
                new THREE.MeshStandardMaterial({ color: 0x3c9a3c }));
            stem.position.y = 0.5; f.add(stem);
            const petalMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), petalMat);
                petal.scale.set(1, 0.4, 1); petal.position.set(Math.cos(a) * 0.22, 1.02, Math.sin(a) * 0.22);
                f.add(petal);
            }
            const centre = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
            centre.position.y = 1.06; f.add(centre);
            f.position.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6);
            f.scale.setScalar(0.8 + Math.random() * 0.6);
            g.add(f);
        }
        this.mergeGroup(g, { castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g); // no collider
        this.addSway(g, 0.07, 1.8);
    }

    // --- Lakes (swimmable) --------------------------------------------------

    lakeAt(pos) {
        if (!this.lakes) return null;
        return this.lakes.find(l => Math.hypot(pos.x - l.x, pos.z - l.z) < l.r - 1) || null;
    }

    buildLake(x, z, r) {
        if (!this.lakes) this.lakes = [];
        // A darker lakebed disc on the ground, with a translucent water surface rising above it
        // (the world's ground plane is solid, so lakes are shallow wading pools rather than pits).
        // The bed has a depth gradient: sandy rim -> turquoise shallows -> deep blue centre.
        const bed = new THREE.Mesh(new THREE.CircleGeometry(r, 36),
            new THREE.MeshStandardMaterial({ map: this.getPondDepthTexture(), roughness: 1 }));
        bed.rotation.x = -Math.PI / 2; bed.position.set(x, 0.08, z); this.worldGroup.add(bed);
        // Water surface sits just above the ground so the pond is flush with the grass (not a raised flood).
        // It is fairly see-through so the depth colors show, with soft ripples drifting across it.
        const water = new THREE.Mesh(new THREE.CircleGeometry(r, 36),
            new THREE.MeshStandardMaterial({ color: 0x5fb8d8, map: this.getWaterTexture(), transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.1 }));
        water.rotation.x = -Math.PI / 2; water.position.set(x, 0.18, z); this.worldGroup.add(water);
        // Pale foam ring where the water meets the grass
        const foam = new THREE.Mesh(new THREE.RingGeometry(r - 0.5, r + 0.9, 40),
            new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, depthWrite: false }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(x, 0.22, z); this.worldGroup.add(foam);
        foam.userData = { foam: true };
        // Reeds, bushes and rocks around the shore
        const ring = Math.round(r);
        for (let i = 0; i < ring; i++) {
            const a = (i / ring) * Math.PI * 2;
            const rx = x + Math.cos(a) * (r + 1.5), rz = z + Math.sin(a) * (r + 1.5);
            const k = Math.random();
            if (k < 0.5) this.buildGrassTuft(rx, rz);
            else if (k < 0.8) this.buildBush(rx, rz);
            else this.buildCrabRock(rx, rz);
        }
        this.lakes.push({ x, z, r });
    }

    // --- Caves (with a hidden treasure) ------------------------------------

    buildCave(x, z) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const rock = new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 1 });
        const R = 8, H = 6, doorHalf = 0.42;
        // Rock ring wall with an entrance gap (walk-in, like a hut but stone)
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.5, H, 28, 1, true, doorHalf, Math.PI * 2 - doorHalf * 2), rock);
        wall.position.y = H / 2; wall.castShadow = true; g.add(wall);
        // Dome roof
        const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), rock);
        dome.position.y = H; dome.castShadow = true; g.add(dome);
        // A few glowing crystals inside (emissive, no real light)
        [[-2, -2], [2.5, 1], [-1, 3]].forEach(([cx, cz], i) => {
            const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8 + i * 0.4, 6),
                new THREE.MeshStandardMaterial({ color: 0x7fe6ff, emissive: 0x2fb6ff, emissiveIntensity: 0.9 }));
            crystal.position.set(cx, 0.9, cz); g.add(crystal);
        });
        this.worldGroup.add(g);
        g.updateMatrixWorld(true);
        // Ring-wall collider as a gapped ring of boxes (so the entrance stays open)
        const segs = 28;
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            if (a < doorHalf || a > Math.PI * 2 - doorHalf) continue; // leave the doorway open
            const cx = x + Math.sin(a) * R, cz = z + Math.cos(a) * R;
            this.colliders.push(new THREE.Box3(new THREE.Vector3(cx - 0.8, 0, cz - 0.8), new THREE.Vector3(cx + 0.8, H, cz + 0.8)));
        }
        // Hidden treasure inside
        const chest = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.1), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
        base.position.y = 0.5; chest.add(base);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.5, roughness: 0.4 }));
        lid.position.y = 1.15; chest.add(lid);
        chest.position.set(x, 0, z - 2.5);
        this.scene.add(chest);
        this.entities.push({ type: 'treasure', mesh: chest, reward: 30 });
    }

    buildWell(x, z) {
        const g = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x8c8375, roughness: 1 });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.6, 20, 1, true), stone);
        ring.position.y = 0.8;
        g.add(ring);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.3, metalness: 0.2 }));
        water.position.y = 1.2;
        g.add(water);
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
        [-1.8, 1.8].forEach(px => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8), wood);
            post.position.set(px, 2.4, 0);
            g.add(post);
        });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a3a }));
        roof.position.y = 4.4;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        this.addProp(g, x, z, { shrink: 0.4 });
    }

    buildLampPost(x, z) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 5, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 }));
        pole.position.y = 2.5;
        g.add(pole);
        // Emissive bulb only (no real PointLight) to keep the scene's light count low.
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc24d, emissiveIntensity: 1 }));
        bulb.position.y = 5.1;
        g.add(bulb);
        this.addProp(g, x, z, { shrink: 0.2 });
    }

    // A large rectangular longhouse — the Elder's Hall, a village landmark (solid, not walk-in).
    buildHall(x, z, rot = 0) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.rotation.y = rot;
        const W = 15, D = 10, H = 7;
        const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
            new THREE.MeshStandardMaterial({ color: 0xcdb892, roughness: 0.9 }));
        body.position.y = H / 2;
        body.castShadow = true; body.receiveShadow = true;
        g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(D * 0.78, 4.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 1 }));
        roof.scale.x = W / D;
        roof.position.y = H + 2.25;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        g.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
        door.position.set(0, 2.25, D / 2 + 0.05);
        g.add(door);
        this.worldGroup.add(g);
        g.updateMatrixWorld(true);
        this.addCollider(body, { shrink: 0.3 });
    }

    // A market stall: four posts, a bright canopy, a table of goods.
    buildStall(x, z) {
        const g = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a6239, roughness: 1 });
        [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]].forEach(([px, pz]) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), wood);
            post.position.set(px, 1.5, pz);
            g.add(post);
        });
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3),
            new THREE.MeshStandardMaterial({ color: 0xc0504d, roughness: 1 }));
        canopy.position.y = 3.1;
        g.add(canopy);
        const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 1.4), wood);
        table.position.set(0, 1.4, 0.6);
        g.add(table);
        [0x6bbf59, 0xe0a84e, 0x9a5ad6].forEach((col, i) => {
            const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
                new THREE.MeshStandardMaterial({ color: col }));
            crate.position.set(-1 + i, 1.85, 0.6);
            g.add(crate);
        });
        this.addProp(g, x, z, { shrink: 0.3 });
    }

    // Village entrance gate spanning the path. Posts sit off-center so the middle stays walkable.
    buildGate(z) {
        const g = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 1 });
        const posts = [];
        [-9, 9].forEach(px => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9, 10), wood);
            post.position.set(px, 4.5, 0);
            post.castShadow = true;
            g.add(post);
            posts.push(post);
        });
        const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 1), wood);
        beam.position.set(0, 8.6, 0);
        g.add(beam);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xcdb892 }));
        sign.position.set(0, 7.2, 0.35);
        g.add(sign);
        g.position.set(0, 0, z);
        this.worldGroup.add(g);
        g.updateMatrixWorld(true);
        posts.forEach(p => this.addCollider(p, { shrink: 0.1 })); // only the posts block; center is open
    }

    // A flat dirt road segment (purely visual, no collider).
    buildPath(x, z, w, l) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
            new THREE.MeshStandardMaterial({ color: 0xcbb07a, roughness: 1 }));
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(x, 0.03, z);
        plane.receiveShadow = true;
        this.worldGroup.add(plane);
    }

    // A giant crab-claw statue (used to flank the temple entrance). `dir` is +1 / -1 for which way it opens.
    crabClawStatue(dir) {
        const g = new THREE.Group();
        const shell = new THREE.MeshStandardMaterial({ color: 0xb04030, roughness: 0.9 });
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), shell);
        arm.position.y = 3.5; arm.castShadow = true; g.add(arm);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 1.3), shell);
        upper.position.set(0, 7.6, dir * 0.9); upper.rotation.x = dir * 0.25; g.add(upper);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.1), shell);
        lower.position.set(0, 6.6, dir * 1.6); g.add(lower);
        return g;
    }

    // A portcullis gate that fills a doorway until the room is cleared.
    buildPortcullis(gapHalf, h) {
        const grp = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.5, metalness: 0.5 });
        const barCount = Math.max(5, Math.round(gapHalf * 1.1));
        for (let i = 0; i <= barCount; i++) {
            const x = -gapHalf + (i / barCount) * gapHalf * 2;
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, h, 8), mat);
            bar.position.set(x, h / 2, 0); bar.castShadow = true; grp.add(bar);
        }
        [h * 0.25, h * 0.6, h - 0.3].forEach(y => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(gapHalf * 2, 0.3, 0.3), mat);
            rail.position.set(0, y, 0); grp.add(rail);
        });
        for (let i = 0; i < barCount; i++) {
            const x = -gapHalf + (i + 0.5) / barCount * gapHalf * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), mat);
            spike.position.set(x, -0.2, 0); spike.rotation.x = Math.PI; grp.add(spike);
        }
        return grp;
    }

    // Open a temple gate: drop its bars into the floor and remove its blocking collider.
    openGate(gate, silent = false) {
        if (!gate || gate.opened) return;
        gate.opened = true;
        this.colliders = this.colliders.filter(c => c !== gate.box);
        if (silent) { gate.group.position.y = -16; gate.group.visible = false; return; } // already open when a save loads
        gate.opening = true;
        Sound.play('gate');
        if (window.gameSystem && window.gameSystem.showToast) {
            window.gameSystem.showToast('The gate rumbles open!');
        }
    }

    // Called whenever an enemy dies: open any gate whose room is now clear.
    tryOpenGates(silent = false) {
        if (!this.templeGates) return;
        const liveInRoom = (roomId) => this.entities.some(e => e.type === 'enemy' && e.roomId === roomId && e.data.hp > 0);
        const crotonAlive = this.entities.some(e => e.bossId === 'croton');
        this.templeGates.forEach(gate => {
            if (gate.opened) return;
            if (gate.req === 'boss') { if (!crotonAlive) this.openGate(gate, silent); }
            else if (!liveInRoom(gate.req)) this.openGate(gate, silent);
        });
    }

    // The Temple of Crabs: a multi-room temple you fight through. From the north you climb the
    // steps and pass the portico, then move south through the Entrance Hall and the Pillar Hall
    // (each guarded by crab minions, divided by walls with doorways) before emerging into Croton's
    // open-air boss Arena. Beyond the Arena, an emblem archway leads out toward the Ruined Ocean.
    // All coordinates are world-space Z: FRONT(-70) -> DIV1(-86) -> DIV2(-100) -> BACK(-116).
    buildCrabTemple() {
        const g = new THREE.Group();
        g.position.z = TEMPLE_OFFSET; // the temple is authored around z = -70..-148, then shifted far south
        this.worldGroup.add(g);
        this.templeGates = [];
        const stone = new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 1 });
        const darkStone = new THREE.MeshStandardMaterial({ color: 0x6f6454, roughness: 1 });
        const shell = new THREE.MeshStandardMaterial({ color: 0xc94b3f, roughness: 0.8 });
        const WH = 15;        // wall height
        const HW = 30;        // half-width (side walls at x = ±30)
        const FRONT = -70, DIV1 = -92, DIV2 = -116, BACK = -148;
        const solids = [];
        const box = (w, h, d, x, y, z, mat = stone, collide = true) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
            g.add(m); if (collide) solids.push({ mesh: m });
            return m;
        };
        const col = (x, z, h = WH) => {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, h, 14), stone);
            c.position.set(x, h / 2, z); c.castShadow = true; g.add(c); solids.push({ mesh: c });
            const cap = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 3.6), darkStone);
            cap.position.set(x, h + 0.45, z); g.add(cap);
        };
        const brazier = (x, z) => {
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 8), darkStone);
            stand.position.set(x, 1.5, z); g.add(stand); solids.push({ mesh: stand });
            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 1, 10), darkStone);
            bowl.position.set(x, 3, z); g.add(bowl);
            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 8),
                new THREE.MeshStandardMaterial({ color: 0xffb24d, emissive: 0xff7a1a, emissiveIntensity: 1 }));
            flame.position.set(x, 4.2, z); g.add(flame);
        };
        const wallWithDoor = (z, half) => {
            const segW = HW - half;
            box(segW, WH, 2, -(half + segW / 2), WH / 2, z);
            box(segW, WH, 2, (half + segW / 2), WH / 2, z);
            box(half * 2 + 2, 4, 2, 0, WH - 2, z, stone, false); // lintel over the gap (high, no collider)
        };
        // A locked portcullis gate in a doorway; opens when `req` room is cleared.
        const addGate = (z, gapHalf, h, req) => {
            const grp = this.buildPortcullis(gapHalf, h);
            grp.position.set(0, 0, z); g.add(grp);
            const gz = z + TEMPLE_OFFSET; // collider boxes are in world space, so apply the temple shift here
            const gbox = new THREE.Box3(new THREE.Vector3(-gapHalf, 0, gz - 0.6), new THREE.Vector3(gapHalf, h, gz + 0.6));
            this.colliders.push(gbox);
            this.templeGates.push({ group: grp, box: gbox, req, opened: false, opening: false });
        };

        // Stone floor spanning the whole temple (visual only)
        const floor = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2, 0.3, (FRONT - BACK) + 6), darkStone);
        floor.position.set(0, 0.15, (FRONT + BACK) / 2);
        floor.receiveShadow = true; g.add(floor);

        // Side walls running the whole length (non-climbable so the dungeon can't be climbed out of)
        box(2, WH, (FRONT - BACK), -HW, WH / 2, (FRONT + BACK) / 2);
        box(2, WH, (FRONT - BACK), HW, WH / 2, (FRONT + BACK) / 2);

        // --- Front facade: wall + doorway, portico columns, pediment, steps, claw statues ---
        wallWithDoor(FRONT, 9);
        [-24, -12, 12, 24].forEach(px => col(px, FRONT + 6));
        box(54, 2, 3.4, 0, WH + 1.5, FRONT + 6, stone, false); // architrave
        const ped = new THREE.Mesh(new THREE.ConeGeometry(8, 4.5, 3), darkStone);
        ped.scale.set(3.6, 1, 0.3); ped.position.set(0, WH + 4.4, FRONT + 6); ped.rotation.y = Math.PI / 2; g.add(ped);
        for (let i = 0; i < 3; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(50 - i * 5, 0.4, 2), stone);
            s.position.set(0, 0.2, FRONT + 8 + i * 1.6); g.add(s);
        }
        [-27, 27].forEach(clx => {
            const claw = this.crabClawStatue(clx > 0 ? 1 : -1);
            claw.position.set(clx, 0, FRONT + 10); g.add(claw); solids.push({ mesh: claw });
        });

        // Roof over the two enclosed halls (the Arena stays open-air)
        box(HW * 2 + 2, 0.6, (FRONT - DIV2), 0, WH + 0.3, (FRONT + DIV2) / 2, darkStone, false);

        // Interior lights for the roofed halls
        // (Registered with the shared light pool - positions are in world space, so apply the temple shift.)
        this.lightSources.push({ x: 0, y: 11, z: (FRONT + DIV1) / 2 + TEMPLE_OFFSET, range: 62, intensity: 0.85, color: 0xffd9a0 });
        this.lightSources.push({ x: 0, y: 11, z: (DIV1 + DIV2) / 2 + TEMPLE_OFFSET, range: 62, intensity: 0.85, color: 0xffd9a0 });

        // Dividing walls + locked gates between the rooms
        wallWithDoor(DIV1, 9);
        wallWithDoor(DIV2, 9);
        brazier(-11, DIV1 + 1.5); brazier(11, DIV1 + 1.5);
        brazier(-11, DIV2 + 1.5); brazier(11, DIV2 + 1.5);
        addGate(DIV1, 9, 11, 'room1'); // opens once the Entrance Hall is cleared
        addGate(DIV2, 9, 11, 'room2'); // opens once the Pillar Hall is cleared

        // Pillar Hall columns (Room 2: z -92..-116)
        [[-20, -100], [20, -100], [-20, -108], [20, -108], [-20, -114], [20, -114]].forEach(([x, z]) => col(x, z, WH - 1));

        // --- Croton's Arena: an open-air boss colosseum (z -116..-148) ---
        const arenaC = -132; // ring centre / Croton's spot
        // Inlaid battle rings on the floor
        [16, 12, 8].forEach((rr, i) => {
            const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.8, rr, 44),
                new THREE.MeshStandardMaterial({ color: i % 2 ? 0xb5443a : 0x7a2e26, roughness: 1, side: THREE.DoubleSide }));
            ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.34 + i * 0.01, arenaC); g.add(ring);
        });
        const ringCore = new THREE.Mesh(new THREE.CircleGeometry(4.5, 28),
            new THREE.MeshStandardMaterial({ color: 0x5c241e, roughness: 1 }));
        ringCore.rotation.x = -Math.PI / 2; ringCore.position.set(0, 0.33, arenaC); g.add(ringCore);

        // Corner tide pools (decorative, flush with the floor)
        [[-23, -122], [23, -122], [-23, -143], [23, -143]].forEach(([px, pz]) => {
            const bed = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), new THREE.MeshStandardMaterial({ color: 0x234a52, roughness: 1 }));
            bed.rotation.x = -Math.PI / 2; bed.position.set(px, 0.33, pz); g.add(bed);
            const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24),
                new THREE.MeshStandardMaterial({ color: 0x2f86c4, transparent: true, opacity: 0.72, roughness: 0.2, metalness: 0.35 }));
            pool.rotation.x = -Math.PI / 2; pool.position.set(px, 0.5, pz); g.add(pool);
        });

        // Broken columns of varied height around the ring
        [[-25, -124, 0], [25, -124, 1], [-25, -134, 1], [25, -134, 0], [-25, -144, 0], [25, -144, 1]]
            .forEach(([x, z, tall]) => col(x, z, tall ? WH : WH - 5));

        // Giant crab-claw statues guarding the corners
        [[-26, -120, 1], [26, -120, -1], [-26, -146, 1], [26, -146, -1]].forEach(([px, pz, dir]) => {
            const claw = this.crabClawStatue(dir); claw.scale.set(1.5, 1.5, 1.5);
            claw.position.set(px, 0, pz); g.add(claw); solids.push({ mesh: claw });
        });

        // Braziers ringing the arena
        [[-16, -124], [16, -124], [-16, -140], [16, -140]].forEach(([x, z]) => brazier(x, z));

        // The Crab King's throne (decorative) at the back-left, angled toward the ring
        const throne = new THREE.Group();
        const tbase = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 5), darkStone); tbase.position.y = 1; throne.add(tbase);
        const tseat = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 4), stone); tseat.position.y = 2.6; throne.add(tseat);
        const tback = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 1), stone); tback.position.set(0, 6, -1.8); throne.add(tback);
        const tcrest = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell);
        tcrest.position.set(0, 9, -1.8); throne.add(tcrest);
        throne.position.set(-19, 0, -144); throne.rotation.y = 0.6;
        throne.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.add(throne); solids.push({ mesh: throne });

        // Glowing crab emblems set into the side walls
        [[-HW + 1.3, 1], [HW - 1.3, -1]].forEach(([ex, face]) => {
            const em = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24),
                new THREE.MeshStandardMaterial({ color: 0xc94b3f, emissive: 0x7a1a12, emissiveIntensity: 0.55, roughness: 0.8 }));
            em.position.set(ex, 8, arenaC); em.rotation.y = face * Math.PI / 2; g.add(em);
        });

        // Arena backdrop: side segments + an emblem archway over the south exit (gated until Croton falls)
        box(20, WH, 2, -20, WH / 2, BACK);
        box(20, WH, 2, 20, WH / 2, BACK);
        box(22, 5, 2, 0, WH - 2.5, BACK, stone, false); // arch over the exit (no collider)
        const emblem = new THREE.Mesh(new THREE.CircleGeometry(4, 24), shell);
        emblem.position.set(0, WH - 2.5, BACK + 1.05); g.add(emblem);
        [-1, 1].forEach(s => {
            const cl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 0.4), darkStone);
            cl.position.set(s * 2, WH - 2.5, BACK + 1.1); cl.rotation.z = s * 0.4; g.add(cl);
        });
        const archOrb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10),
            new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x3fa8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
        archOrb.position.set(0, WH + 0.5, BACK + 0.6); g.add(archOrb);
        addGate(BACK, 10, 10, 'boss'); // the exit to the Ruined Ocean opens only after Croton is beaten

        g.updateMatrixWorld(true);
        solids.forEach(s => this.addCollider(s.mesh, { shrink: 0.3 }));

        // Wall off the whole coast at the temple's latitude so the temple is the only way south.
        this.buildCoastBarrier(FRONT + TEMPLE_OFFSET);
    }

    // Impassable cliff walls flanking the temple entrance (temple occupies x[-30,30]), so the
    // player can't simply walk around the temple to reach the ocean.
    buildCoastBarrier(z) {
        const rockColors = [0x6e6252, 0x7a6d58, 0x5c5446, 0x857660, 0x6a5e4c, 0x8a7d66];
        [[-95, 130], [95, 130]].forEach(([cx, w]) => {
            // Invisible collider box keeps the barrier solid; the visible wall is built from natural boulders.
            const blocker = new THREE.Mesh(new THREE.BoxGeometry(w, 20, 8), new THREE.MeshBasicMaterial());
            blocker.position.set(cx, 10, z);
            blocker.visible = false;
            this.worldGroup.add(blocker);
            this.addCollider(blocker, { shrink: 0.3 });

            const wall = new THREE.Group();
            const addRock = (x, y, zz, r, ci) => {
                const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
                    new THREE.MeshStandardMaterial({ color: rockColors[ci % rockColors.length], roughness: 1, flatShading: true }));
                m.scale.set(1 + Math.random() * 0.5, 0.8 + Math.random() * 0.6, 1 + Math.random() * 0.4);
                m.position.set(x, y, zz);
                m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
                wall.add(m);
            };
            // Three stacked ranks of overlapping boulders: wide base, mid, and a lower broken top
            for (let x = -w / 2; x < w / 2; x += 7) {
                addRock(x + (Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 4, 6.5 + Math.random() * 2.5, Math.floor(Math.random() * 6));
                addRock(x + 3 + (Math.random() - 0.5) * 3, 12, (Math.random() - 0.5) * 3, 5 + Math.random() * 2.5, Math.floor(Math.random() * 6));
                if (Math.random() > 0.35) addRock(x + (Math.random() - 0.5) * 4, 17.5, (Math.random() - 0.5) * 2, 3.5 + Math.random() * 2, Math.floor(Math.random() * 6));
            }
            // Mossy green caps + a few hanging-vine tufts to tie it into the greenery
            for (let x = -w / 2; x < w / 2; x += 11) {
                const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2 + Math.random() * 1.5, 1),
                    new THREE.MeshStandardMaterial({ color: [0x3f8a2e, 0x4fa23a, 0x2f7a30][Math.floor(Math.random() * 3)], roughness: 1, flatShading: true }));
                moss.scale.y = 0.55; moss.position.set(x + Math.random() * 4, 17 + Math.random() * 3, (Math.random() - 0.5) * 3);
                wall.add(moss);
            }
            this.mergeGroup(wall, { flat: true });
            wall.position.set(cx, 0, z);
            this.worldGroup.add(wall);
        });
    }

    buildCoralTower(x, z) {
        const g = new THREE.Group();
        const palette = [0x3f6b6a, 0x2c4d4c, 0x7a3b62, 0x4a6b8a, 0x6b4a7a];
        const base = palette[Math.floor(Math.random() * palette.length)];
        const segCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < segCount; i++) {
            const w = 3.8 - i * 0.6;
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.6, 2.6, 7),
                new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? base : 0x2c4d4c, roughness: 1 }));
            seg.position.y = 1.3 + i * 2.6;
            seg.rotation.y = Math.random() * Math.PI;
            g.add(seg);
        }
        // branching coral fans on top
        for (let b = 0; b < 3; b++) {
            const fan = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2 + Math.random() * 1.5, 5),
                new THREE.MeshStandardMaterial({ color: base, roughness: 1 }));
            fan.position.set((Math.random() - 0.5) * 2, segCount * 2.6, (Math.random() - 0.5) * 2);
            fan.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
            g.add(fan);
        }
        this.addProp(g, x, z, { shrink: 0.5 });
    }

    // Tall swaying kelp / seaweed.
    buildKelp(x, z) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 1 });
        const strands = 2 + Math.floor(Math.random() * 3);
        for (let s = 0; s < strands; s++) {
            const h = 5 + Math.random() * 6;
            const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), mat);
            blade.geometry.translate(0, h / 2, 0); // pivot at the base so it sways from the seabed
            blade.position.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6);
            blade.rotation.z = (Math.random() - 0.5) * 0.4;
            g.add(blade);
            this.addSway(blade, 0.16, 0.9);
        }
        g.position.set(x, 0, z); this.worldGroup.add(g); // no collider: swim/walk through
    }

    // A floating bioluminescent jellyfish (emissive, no real light).
    buildGlowJelly(x, z) {
        const g = new THREE.Group();
        const color = [0x5fd0ff, 0x8f6bff, 0x4dffd0][Math.floor(Math.random() * 3)];
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 }));
        g.add(dome);
        const tentMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 });
        for (let t = 0; t < 5; t++) {
            const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), tentMat);
            tent.position.set((Math.random() - 0.5) * 1.2, -0.9, (Math.random() - 0.5) * 1.2);
            g.add(tent);
        }
        g.position.set(x, 4 + Math.random() * 5, z);
        g.userData = { baseY: g.position.y, timeOffset: Math.random() * 10 }; // bobs via the animate loop
        this.worldGroup.add(g);
    }

    // A broken stone archway from the sunken Underriver kingdom.
    buildRuinArch(x, z) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x3f5a5a, roughness: 1 });
        [-2.5, 2.5].forEach(px => {
            const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7 + Math.random() * 2, 1.4), mat);
            pil.position.set(px, 3.5, 0); pil.rotation.z = (Math.random() - 0.5) * 0.1; pil.castShadow = true; g.add(pil);
        });
        if (Math.random() > 0.4) { // sometimes the top beam survives
            const top = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 1.4), mat);
            top.position.set(0, 7.4, 0); g.add(top);
        }
        this.addProp(g, x, z, { shrink: 0.4 });
    }

    // A toppled column lying on the ocean floor.
    buildFallenColumn(x, z) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x3f5a5a, roughness: 1 });
        const seg = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < seg; i++) {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 10), mat);
            drum.rotation.z = Math.PI / 2;
            drum.position.set(i * 2.5 - seg, 0.9, (Math.random() - 0.5) * 0.6);
            g.add(drum);
        }
        g.position.set(x, 0, z); g.rotation.y = Math.random() * Math.PI;
        this.worldGroup.add(g);
    }

    buildCoin(x, z) {
        const geo = new THREE.CylinderGeometry(0.8, 0.8, 0.25, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffa500, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.2 });
        const coin = new THREE.Mesh(geo, mat);
        coin.rotation.x = Math.PI / 2;
        coin.position.set(x, 1.2, z);
        this.worldGroup.add(coin);
        const box = this.addCollider(coin, { shrink: -0.3, isCoin: true });
        box.coinId = this._coinCount++; // stable id for the save system
    }

    // Flow Song: a friendly floating music note that lives in the Windy Highlands. Befriend it to
    // carry its song with you (it plays from the pause menu).
    buildFlowSong(x, z) {
        const g = new THREE.Group();
        const glow = new THREE.MeshStandardMaterial({ color: 0x9fefff, emissive: 0x2fb6d8, emissiveIntensity: 0.7, roughness: 0.35 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), glow);
        head.scale.set(1.25, 0.95, 1); head.rotation.z = 0.35; g.add(head);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 8), glow);
        stem.position.set(1.0, 1.7, 0); g.add(stem);
        const flag = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.15, 8, 16, Math.PI * 0.9), glow);
        flag.position.set(1.8, 3.1, 0); flag.rotation.z = -Math.PI * 0.45; g.add(flag);
        const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), dark = new THREE.MeshBasicMaterial({ color: 0x103040 });
        [-0.45, 0.35].forEach(ex => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), white); eye.position.set(ex - 0.1, 0.2, 0.88); g.add(eye);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), dark); pupil.position.set(ex - 0.1, 0.2, 1.08); g.add(pupil);
        });
        const cheek = new THREE.MeshBasicMaterial({ color: 0xff9ec0 });
        [-0.85, 0.7].forEach(cx => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), cheek); c.scale.z = 0.4; c.position.set(cx - 0.1, -0.2, 0.9); g.add(c); });
        // soft halo
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const cx = cv.getContext('2d'), grad = cx.createRadialGradient(32, 32, 2, 32, 32, 32);
        grad.addColorStop(0, 'rgba(150,240,255,0.85)'); grad.addColorStop(1, 'rgba(150,240,255,0)');
        cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(7, 7, 1); halo.position.set(0.8, 1.2, 0); g.add(halo);
        // little orbiting notes
        const orbs = [];
        for (let i = 0; i < 3; i++) {
            const o = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glow);
            g.add(o); orbs.push(o);
        }
        g.userData.flowParts = { halo, orbs, head, stem, flag };
        g.userData.baseY = 4.2; g.userData.timeOffset = 1.3;   // hovers (picked up by the shared bobbing loop)
        g.position.set(x, 4.2, z);
        g.scale.setScalar(1.15);
        this.scene.add(g);
        this.entities.push({ type: 'song', songId: 'flow', mesh: g, radius: 6 });
    }

    buildEmeraldCoast() {
        // --- Octo Village: a scattered town of walk-in huts around a central plaza ---
        const villageCenter = { x: 0, z: 18 };
        const doorToward = (x, z) => Math.atan2(villageCenter.x - x, villageCenter.z - z);
        const npcSpots = [WORLD.barnicoPos, WORLD.octaPos, WORLD.shopkeeperPos];
        const hallSpot = { x: -30, z: 16 };     // Elder's Hall landmark
        const marketSpot = { x: 26, z: 34 };     // market stall cluster
        const canPlaceHut = (x, z) => {
            if (this.isNearHouse(x, z, 12)) return false;                                         // don't overlap other huts
            if (Math.hypot(x - WORLD.playerSpawn.x, z - WORLD.playerSpawn.z) < 27) return false;  // keep spawn clear
            if (Math.abs(x) < 24 && z > 18) return false;                                         // keep the camera's first view down the road clear
            if (Math.hypot(x - villageCenter.x, z - villageCenter.z) < 15) return false;          // keep plaza (NPCs) clear
            if (npcSpots.some(p => Math.hypot(x - p.x, z - p.z) < 11)) return false;              // never box in an NPC
            if (Math.hypot(x - hallSpot.x, z - hallSpot.z) < 20) return false;                    // reserve the Elder's Hall
            if (Math.hypot(x - marketSpot.x, z - marketSpot.z) < 16) return false;                // reserve the market
            if (Math.abs(x) < 11 && z < 6) return false;                                          // keep the south corridor to the temple clear
            return true;
        };
        let hutCount = 0, attempts = 0;
        const TARGET_HUTS = 20;
        while (hutCount < TARGET_HUTS && attempts < 1400) {
            attempts++;
            const x = (Math.random() - 0.5) * 160;   // -80 .. 80
            const z = -16 + Math.random() * 90;        // -16 .. 74
            if (!canPlaceHut(x, z)) continue;
            this.buildHut(x, z, doorToward(x, z), { light: hutCount < 4 }); // only a few real lights (perf)
            hutCount++;
        }

        // Dirt roads: a main avenue running north-south through the village, and a cross street at the plaza.
        this.buildPath(0, -18, 8, 118);     // main avenue (spawn -> gate -> toward temple)
        this.buildPath(0, 18, 70, 8);       // plaza cross street
        this.buildPath(hallSpot.x + 9, hallSpot.z, 22, 6); // spur to the Elder's Hall

        // Elder's Hall (door faces the village center), market stalls, and an entrance gate.
        this.buildHall(hallSpot.x, hallSpot.z, PI / 2);
        this.buildStall(marketSpot.x - 5, marketSpot.z);
        this.buildStall(marketSpot.x + 1, marketSpot.z + 4);
        this.buildStall(marketSpot.x + 4, marketSpot.z - 3);
        this.buildGate(4);

        // Village well at the edge of the plaza
        this.buildWell(-16, 10);

        // A handful of lamp posts to line the village (kept off the central path south)
        [[-30, 22], [30, 20], [-18, 44], [20, 42], [-34, 6], [34, 8], [-14, 58], [16, 56]].forEach(([lx, lz]) => {
            if (!this.isNearHouse(lx, lz, 2)) this.buildLampPost(lx, lz);
        });

        // Barnico (story NPC, repeatable dialogue)
        const barnico = VoxelBuilder.buildCharacter(buildBarnicoParts());
        barnico.position.set(WORLD.barnicoPos.x, 0, WORLD.barnicoPos.z);
        this.scene.add(barnico);
        this.entities.push({ type: 'story_npc', storyId: 'barnico', mesh: barnico });

        // Octa (one-time recruit trigger)
        const octa = VoxelBuilder.buildCharacter(buildOctaParts());
        octa.position.set(WORLD.octaPos.x, 0, WORLD.octaPos.z);
        this.scene.add(octa);
        this.entities.push({ type: 'story_npc', storyId: 'octa_join', oneTime: true, mesh: octa });

        // Wandering Shopkeeper
        const shopkeeper = VoxelBuilder.buildCharacter(buildShopkeeperParts());
        shopkeeper.position.set(WORLD.shopkeeperPos.x, 0, WORLD.shopkeeperPos.z);
        this.scene.add(shopkeeper);
        this.entities.push({ type: 'shopkeeper', mesh: shopkeeper });

        // --- A lush, varied coast: lakes, caves, and dense greenery -------------
        this.caves = [];
        const inCorridor = (x, z) => Math.abs(x) < 12 && z < 8 && z > TEMPLE_FRONT_Z;   // keep the road to the temple clear
        const inTempleZone = (z) => false;                                    // (the temple now lies far to the south; this block only covers the village area)
        // Keep lakes & caves out of the village AND its surroundings: only the far coast sides
        // (|x| >= 95) or the approach south of the village (z <= -22) count as wilderness.
        const inVillage = (x, z) => Math.abs(x) < 95 && z > -22;
        const nearLake = (x, z, m = 0) => this.lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + m);
        const nearCave = (x, z, m = 0) => this.caves.some(c => Math.hypot(x - c.x, z - c.z) < 11 + m);

        // Lakes (swimmable) — out on the open coast or the approach to the temple, never in town.
        { let placed = 0, tries = 0;
          while (placed < 5 && tries < 700) {
            tries++;
            const r = 11 + Math.random() * 6;
            const x = (Math.random() - 0.5) * 270;   // -135 .. 135
            const z = 96 - Math.random() * 160;        // 96 .. -64
            if (inVillage(x, z) || inCorridor(x, z) || inTempleZone(z)) continue;
            if (Math.abs(x) < 12 + r + 4 && z < 10 && z > -72) continue; // lake body must not spill onto the temple path
            if (nearLake(x, z, 12)) continue;
            this.buildLake(x, z, r); placed++;
          }
        }

        // Caves (each hides a treasure) — tucked away in the wilderness to reward exploring.
        { let placed = 0, tries = 0;
          while (placed < 4 && tries < 700) {
            tries++;
            const x = (Math.random() - 0.5) * 270;
            const z = 96 - Math.random() * 160;
            if (inVillage(x, z) || inCorridor(x, z) || inTempleZone(z)) continue;
            if (nearLake(x, z, 12)) continue;
            if (nearCave(x, z, 14)) continue;
            this.buildCave(x, z); this.caves.push({ x, z }); placed++;
          }
        }

        // Dense greenery + rocks across the whole coast
        for (let i = 0; i < 170; i++) {
            const x = (Math.random() - 0.5) * 270;    // -135 .. 135
            const z = 90 - Math.random() * 164;         // 90 .. -74
            if (inCorridor(x, z)) continue;
            if (inTempleZone(z) && Math.abs(x) < 34) continue; // keep clear right around the temple
            if (this.isNearHouse(x, z, 2.5)) continue;
            if (nearLake(x, z, 1)) continue;   // greenery on the shore but not in the water
            if (nearCave(x, z, 2)) continue;
            const r = Math.random();
            if (r < 0.26) this.buildLeafyTree(x, z);
            else if (r < 0.42) this.buildPalmTree(x, z);
            else if (r < 0.60) this.buildBush(x, z);
            else if (r < 0.80) this.buildGrassTuft(x, z);
            else if (r < 0.92) this.buildFlower(x, z);
            else this.buildCrabRock(x, z);
        }

        // Coins to collect, spread across the coast (skip water)
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 150;
            const z = 70 - Math.random() * 160;
            if (this.isNearHouse(x, z, 2)) continue;
            if (nearLake(x, z, 1)) continue;
            this.buildCoin(x, z);
        }

        // The multi-room Temple of Crabs leading to Croton's arena.
        this.buildCrabTemple();

        const croton = BOSSES.croton.build3D();
        const s = BOSSES.croton.scale || 1;
        croton.scale.set(s, s, s);
        croton.position.set(0, 0, WORLD.crotonTempleZ); // deep in the arena (z = -108)
        this.scene.add(croton);
        this.entities.push({ type: 'boss', bossId: 'croton', mesh: croton, data: this.scaleByDifficulty(BOSSES.croton), aiState: { cooldown: 0 } });

        // Crab minions guarding each room. Clear a room to open its gate to the next.
        const minionSpots = [
            [-16, -78], [14, -84], [0, -89],                       // Entrance Hall (room1: z -70..-92)
            [-18, -100], [16, -106], [-12, -111], [14, -114]        // Pillar Hall  (room2: z -92..-116)
        ];
        minionSpots.forEach(([x, z]) => {
            const wz = z + TEMPLE_OFFSET; // spots are authored in the temple's original coordinates
            const minion = ENEMIES.crab_minion.build3D();
            this.mergeCrab(minion);
            minion.position.set(x, 0, wz);
            this.scene.add(minion);
            const roomId = z > -92 ? 'room1' : 'room2';
            this.entities.push({ type: 'enemy', roomId, mesh: minion, data: this.scaleByDifficulty(ENEMIES.crab_minion), aiState: { cooldown: 0, homeX: x, homeZ: wz } });
        });

        this.buildJourney();
    }

    // Spawn a wandering crab. `tier` 1 = minion, 2 = brute (bigger, tougher, hits harder).
    spawnCrab(x, z, tier = 1) {
        const mesh = ENEMIES.crab_minion.build3D();
        this.mergeCrab(mesh); // ~20 parts -> 3 draw calls (own materials so the hit-flash is per crab)
        const data = this.scaleByDifficulty(ENEMIES.crab_minion);
        if (tier >= 2) {
            mesh.scale.setScalar(1.55);
            data.name = 'Crab Brute';
            data.maxHp = Math.round(data.maxHp * 2.4); data.hp = data.maxHp;
            data.attack = Math.round(data.attack * 1.6);
            data.xpReward = Math.round((data.xpReward || 12) * 2.5);
            data.id = 'crab_brute';
        }
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        this.entities.push({ type: 'enemy', mesh, data, aiState: { cooldown: 0, homeX: x, homeZ: z } });
    }

    // --- The long road to the Temple of Crabs ------------------------------------------------

    spawnChest(x, y, z, reward, extra = {}) {
        const chest = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.1), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
        base.position.y = 0.5; chest.add(base);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.5, roughness: 0.4 }));
        lid.position.y = 1.15; chest.add(lid);
        chest.position.set(x, y, z);
        this.scene.add(chest);
        this.entities.push(Object.assign({ type: 'treasure', mesh: chest, reward }, extra));
    }

    // A wooden signpost with painted text, facing the road.
    buildSignpost(x, z, lines) {
        const g = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 1 });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 5, 8), wood);
        post.position.y = 2.5; post.castShadow = true; g.add(post);
        const c = document.createElement('canvas'); c.width = 256; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#cfae72'; ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 120);
        ctx.fillStyle = '#3a2412'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const startY = 64 - (lines.length - 1) * 20;
        lines.forEach((t, i) => {
            let size = lines.length > 1 ? 26 : 32;
            ctx.font = `bold ${size}px sans-serif`;
            while (ctx.measureText(t).width > 218 && size > 12) { size -= 1; ctx.font = `bold ${size}px sans-serif`; } // shrink to fit the board
            ctx.fillText(t, 128, startY + i * 40);
        });
        const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.7), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 1, side: THREE.DoubleSide }));
        board.position.set(0, 4.4, 0.2); g.add(board);
        const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.9, 0.15), wood);
        back.position.set(0, 4.4, 0.05); g.add(back);
        g.rotation.y = x > 0 ? -0.4 : 0.4; // angle toward the road
        this.addProp(g, x, z, { shrink: 1.2 });
    }

    // A pile of big weathered boulders.
    buildRockPile(x, z) {
        const g = new THREE.Group();
        const cols = [0x7a7060, 0x8a8070, 0x6a6050, 0x9a8e78];
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + Math.random() * 2.6, 1),
                new THREE.MeshStandardMaterial({ color: cols[Math.floor(Math.random() * cols.length)], roughness: 1, flatShading: true }));
            m.scale.y = 0.7 + Math.random() * 0.6;
            m.position.set((Math.random() - 0.5) * 7, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 7);
            m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            g.add(m);
        }
        this.mergeGroup(g, { flat: true });
        this.addProp(g, x, z, { shrink: 1.0 });
    }

    // A crumbling stone tower. Its walls are climbable, and a chest waits near the top.
    buildRuinTower(x, z) {
        const g = new THREE.Group();
        const H = 13;
        const stone = [0x7d7566, 0x8a8170, 0x6f685a];
        const body = new THREE.Mesh(new THREE.BoxGeometry(7, H, 7), new THREE.MeshStandardMaterial({ color: stone[0], roughness: 1, flatShading: true }));
        body.position.y = H / 2; body.castShadow = true; g.add(body);
        for (let i = 0; i < 8; i++) { // broken battlements
            if (Math.random() < 0.3) continue;
            const a = (i / 8) * Math.PI * 2;
            const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4 + Math.random(), 1.5),
                new THREE.MeshStandardMaterial({ color: stone[1 + (i % 2)], roughness: 1, flatShading: true }));
            m.position.set(Math.cos(a) * 3.1, H + 0.6, Math.sin(a) * 3.1); g.add(m);
        }
        for (let i = 0; i < 5; i++) { // rubble around the base
            const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + Math.random() * 0.9, 0),
                new THREE.MeshStandardMaterial({ color: stone[i % 3], roughness: 1, flatShading: true }));
            const a = Math.random() * Math.PI * 2;
            m.position.set(Math.cos(a) * 4.6, 0.6, Math.sin(a) * 4.6); g.add(m);
        }
        for (let i = 0; i < 4; i++) { // ivy creeping up the walls
            const ivy = new THREE.Mesh(new THREE.BoxGeometry(1.4 + Math.random(), 4 + Math.random() * 5, 0.25),
                new THREE.MeshStandardMaterial({ color: [0x3f8a2e, 0x2f7a30][i % 2], roughness: 1 }));
            const side = i % 4;
            ivy.position.set(side === 0 ? 3.6 : side === 1 ? -3.6 : (Math.random() - 0.5) * 4, 2.5 + Math.random() * 4, side === 2 ? 3.6 : side === 3 ? -3.6 : (Math.random() - 0.5) * 4);
            if (side < 2) ivy.rotation.y = Math.PI / 2;
            g.add(ivy);
        }
        this.mergeGroup(g, { flat: true });
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        this.addCollider(g, { shrink: 0.3, climbable: true });
        // Reward for the climb. It can only be taken from up high.
        this.spawnChest(x + 1.4, H + 0.3, z + 1.4, 70, { minY: H - 5, radius: 6 });
    }

    // A crab camp: tents, a campfire, crates, a few guards, and a chest for whoever clears it.
    buildCamp(x, z, tier, count) {
        const g = new THREE.Group();
        const cloth = [0x8a5a3a, 0xb04a3a, 0x6a7a4a, 0x4a6a8a];
        const tents = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < tents; i++) {
            const a = (i / tents) * Math.PI * 2 + Math.random() * 0.6;
            const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.6, 6),
                new THREE.MeshStandardMaterial({ color: cloth[Math.floor(Math.random() * cloth.length)], roughness: 1, flatShading: true }));
            tent.position.set(Math.cos(a) * 6.5, 1.8, Math.sin(a) * 6.5);
            tent.rotation.y = Math.random() * 3; g.add(tent);
        }
        for (let i = 0; i < 3; i++) {
            const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 }));
            crate.position.set(-3 + i * 1.5 + Math.random(), 0.65, 3 + Math.random()); crate.rotation.y = Math.random(); g.add(crate);
        }
        for (let i = 0; i < 6; i++) { // ring of stones around the fire
            const a = (i / 6) * Math.PI * 2;
            const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 1, flatShading: true }));
            st.position.set(Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4); g.add(st);
        }
        this.mergeGroup(g, { flat: true });
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.8, 7),
            new THREE.MeshStandardMaterial({ color: 0xffb24d, emissive: 0xff7a1a, emissiveIntensity: 1.1 }));
        fire.position.y = 0.9; g.add(fire);
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        // Guards (tier 2 camps get a brute)
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + 0.5;
            this.spawnCrab(x + Math.cos(a) * 5, z + Math.sin(a) * 5, (tier >= 2 && i === 0) ? 2 : 1);
        }
        this.spawnChest(x + 2.2, 0, z - 2.4, tier >= 2 ? 55 : 35);
    }

    buildJourney() {
        const rand = (a, b) => a + Math.random() * (b - a);
        const roadEnd = TEMPLE_FRONT_Z + 6;
        const roadStart = -78;

        // The road from the village gate down to the temple door
        this.buildPath(0, (roadStart + roadEnd) / 2, 8, roadStart - roadEnd);

        // Big "sites" (lakes, caves, towers, camps, boulder piles) share one list so nothing overlaps
        const sites = [];
        (this.lakes || []).forEach(l => sites.push({ x: l.x, z: l.z, r: l.r }));
        (this.caves || []).forEach(c => sites.push({ x: c.x, z: c.z, r: 11 }));
        const free = (x, z, r) => {
            if (Math.abs(x) < r + 10 && z > roadEnd - 10 && z < 10) return false;   // keep the road clear
            if (Math.abs(x) > 156 - r) return false;                                // stay inside the world
            return !sites.some(s => Math.hypot(x - s.x, z - s.z) < s.r + r + 4);
        };
        const placeSite = (r, zNorth, zSouth, builder, xMax = 150) => {
            for (let i = 0; i < 300; i++) {
                const x = rand(-xMax, xMax), z = rand(zSouth, zNorth);
                if (!free(x, z, r)) continue;
                builder(x, z); sites.push({ x, z, r }); return true;
            }
            return false;
        };
        const MEADOWS = [-92, REGIONS.meadowsEnd];
        const HIGHLANDS = [REGIONS.meadowsEnd, REGIONS.highlandsEnd];
        const MARSH = [REGIONS.highlandsEnd, roadEnd + 55];
        const lake = (n, region, rmin, rmax) => { for (let i = 0; i < n; i++) { const r = rand(rmin, rmax); placeSite(r + 2, region[0], region[1], (x, z) => this.buildLake(x, z, r)); } };
        const cave = (n, region) => { for (let i = 0; i < n; i++) placeSite(11, region[0], region[1], (x, z) => { this.buildCave(x, z); this.caves.push({ x, z }); }); };
        const tower = (n, region) => { for (let i = 0; i < n; i++) placeSite(6, region[0], region[1], (x, z) => this.buildRuinTower(x, z)); };
        const camp = (n, region, tier, count) => { for (let i = 0; i < n; i++) placeSite(10, region[0], region[1], (x, z) => this.buildCamp(x, z, tier, count)); };
        const rocks = (n, region) => { for (let i = 0; i < n; i++) placeSite(5, region[0], region[1], (x, z) => this.buildRockPile(x, z)); };

        // Region 1: Sunny Meadows - gentle, lots of water and flowers
        lake(3, MEADOWS, 11, 16); cave(2, MEADOWS); camp(1, MEADOWS, 1, 2); rocks(4, MEADOWS);
        // Region 2: Windy Highlands - rocky, ruined towers, bigger camps
        lake(2, HIGHLANDS, 11, 15); cave(3, HIGHLANDS); tower(3, HIGHLANDS); camp(3, HIGHLANDS, 1, 3); rocks(14, HIGHLANDS);
        // Region 3: Crab Marsh - big murky pools, brutes, the last ruin before the temple
        lake(4, MARSH, 13, 20); cave(1, MARSH); tower(1, MARSH); camp(4, MARSH, 2, 3); rocks(5, MARSH);
        // Flow Song, the floating music creature, hides somewhere in the Highlands (you can hear it before you see it)
        placeSite(7, HIGHLANDS[0] - 40, HIGHLANDS[1] + 40, (x, z) => this.buildFlowSong(x, z), 70);

        // Plants scattered across each region, with a different mix of species
        const scatter = (n, region, w) => {
            for (let i = 0; i < n; i++) {
                const x = rand(-155, 155), z = rand(region[1], region[0]);
                if (Math.abs(x) < 8 && z > roadEnd - 10 && z < 10) continue; // road
                if (sites.some(s => Math.hypot(x - s.x, z - s.z) < s.r * 0.92)) continue; // not on a lake / inside a site
                let r = Math.random(), acc = 0;
                const pick = (k) => { acc += w[k]; return r < acc; };
                if (pick('tree')) this.buildLeafyTree(x, z);
                else if (pick('palm')) this.buildPalmTree(x, z);
                else if (pick('bush')) this.buildBush(x, z);
                else if (pick('tuft')) this.buildGrassTuft(x, z);
                else if (pick('flower')) this.buildFlower(x, z);
                else this.buildCrabRock(x, z);
            }
        };
        scatter(150, MEADOWS,   { tree: 0.22, palm: 0.10, bush: 0.16, tuft: 0.22, flower: 0.24 });
        scatter(100, HIGHLANDS, { tree: 0.08, palm: 0.00, bush: 0.16, tuft: 0.28, flower: 0.06 });
        scatter(130, MARSH,     { tree: 0.10, palm: 0.14, bush: 0.28, tuft: 0.36, flower: 0.02 });

        // Roaming crab patrols
        const patrols = (n, region, size, brutes) => {
            for (let i = 0; i < n; i++) {
                const x = rand(-140, 140), z = rand(region[1], region[0]);
                if (!free(x, z, 3)) continue;
                for (let k = 0; k < size; k++) this.spawnCrab(x + rand(-4, 4), z + rand(-4, 4), (brutes && k === 0) ? 2 : 1);
            }
        };
        patrols(6, MEADOWS, 2, false); patrols(5, HIGHLANDS, 3, false); patrols(6, MARSH, 3, true);

        // Coins along the way
        for (let i = 0; i < 36; i++) {
            const x = rand(-130, 130), z = rand(roadEnd + 60, -95);
            if (!free(x, z, 1)) continue;
            this.buildCoin(x, z);
        }

        // Signposts so the player knows where they are
        this.buildSignpost(9, -102, ['Sunny Meadows', 'Temple of Crabs: south']);
        this.buildSignpost(-9, REGIONS.meadowsEnd - 6, ['Windy Highlands', 'Beware crab camps']);
        this.buildSignpost(9, REGIONS.highlandsEnd - 6, ['Crab Marsh', 'Temple ahead']);
        this.buildSignpost(-9, TEMPLE_FRONT_Z + 78, ['TEMPLE OF CRABS']);

        // Torch-lit approach to the temple door
        this.buildGate(TEMPLE_FRONT_Z + 62);
        for (let z = TEMPLE_FRONT_Z + 52; z > TEMPLE_FRONT_Z + 8; z -= 15) { this.buildLampPost(-9, z); this.buildLampPost(9, z); }
    }

    scaleByDifficulty(def) {
        const data = JSON.parse(JSON.stringify(def));
        const mult = (window.gameSystem && window.gameSystem.difficultyMultiplier) || 1;
        if (data.maxHp !== undefined) { data.maxHp = Math.max(1, Math.round(data.maxHp * mult)); data.hp = data.maxHp; }
        if (data.attack !== undefined) data.attack = Math.max(1, Math.round(data.attack * mult));
        return data;
    }

    buildTransition() {
        // A short descent connecting the coast to the ocean floor, plus the forced hand-wave trigger.
        const cliffGeo = new THREE.BoxGeometry(60, 6, 4);
        const cliff = new THREE.Mesh(cliffGeo, new THREE.MeshStandardMaterial({ color: 0x6b7a6a, roughness: 1 }));
        cliff.position.set(0, -3, WORLD.oceanStartZ + 8);
        this.worldGroup.add(cliff);

        // Invisible trigger across the whole width of the world at the sea's edge: stepping onto the dock
        // starts the boat voyage (and the hand-shaped wave). It spans everything so it can't be walked around.
        const triggerBox = new THREE.Box3(
            new THREE.Vector3(-170, -2, WORLD.handWaveTriggerZ - 4),
            new THREE.Vector3(170, 8, WORLD.handWaveTriggerZ + 4)
        );
        triggerBox.isHandWaveTrigger = true;
        triggerBox.isTrigger = true;
        this.colliders.push(triggerBox);

        // Invisible trigger where the reef ends: stepping through starts Oblongtalo's challenge.
        const arenaBox = new THREE.Box3(
            new THREE.Vector3(-170, -2, REEF_END_Z - 8),
            new THREE.Vector3(170, 14, REEF_END_Z - 2)
        );
        arenaBox.isArenaTrigger = true;
        arenaBox.isTrigger = true;
        this.colliders.push(arenaBox);
    }

    // The bit of ocean floor just past the temple, where the dock is. (The long Coral Reef comes after the boat.)
    buildRuinedOcean() {
        const oStart = WORLD.oceanStartZ, oEnd = WORLD.handWaveTriggerZ - 30;
        const rand = (a, b) => a + Math.random() * (b - a);
        const nearArena = () => false;

        // Dense, varied coral forests
        for (let i = 0; i < 34; i++) {
            const x = rand(-120, 120), z = rand(oEnd, oStart);
            if (nearArena(x, z)) continue;
            this.buildCoralTower(x, z);
        }
        // Kelp beds
        for (let i = 0; i < 26; i++) {
            const x = rand(-120, 120), z = rand(oEnd, oStart);
            if (nearArena(x, z)) continue;
            this.buildKelp(x, z);
        }
        // Bioluminescent jellyfish drifting in the dark water
        for (let i = 0; i < 22; i++) {
            const x = rand(-120, 120), z = rand(oEnd, oStart);
            this.buildGlowJelly(x, z);
        }
        // Ruins of the drowned Underriver kingdom: broken archways + toppled columns
        for (let i = 0; i < 12; i++) {
            const x = rand(-110, 110), z = rand(oEnd, oStart);
            if (nearArena(x, z)) continue;
            if (Math.random() > 0.5) this.buildRuinArch(x, z); else this.buildFallenColumn(x, z);
        }

        // The Sea Gate: a glowing rune archway at the water's edge. Walking through it takes you to the dock.
        this.buildSeaGate(0, WORLD.handWaveTriggerZ + 7);
    }

    buildSeaGate(x, z) {
        const g = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x4a6468, roughness: 0.9 });
        const glow = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa52a, emissiveIntensity: 0.9 });
        [-9, 9].forEach(px => {
            const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 15, 10), stone); pil.position.set(px, 7.5, 0); g.add(pil);
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), glow); lamp.position.set(px, 15.8, 0); g.add(lamp);
        });
        const top = new THREE.Mesh(new THREE.BoxGeometry(21, 2, 2.4), stone); top.position.set(0, 15.4, 0); g.add(top);
        // soft shimmering curtain of light between the pillars
        const cur = new THREE.Mesh(new THREE.PlaneGeometry(16, 14),
            new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        cur.position.set(0, 7.5, 0); g.add(cur);
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        this.buildSignpost(14, z + 6, ['Sea Gate', 'The boat awaits']);
    }

    // --- Oblongtalo's Arena: a sunken royal plaza at the far end of the reef (he is summoned later, see main3d) ---
    buildOblongtaloArena() {
        const A = new THREE.Group();
        A.position.set(0, 0, WORLD.arenaZ);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x45585f, roughness: 0.9 });
        const runeMat = new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x2fb6ff, emissiveIntensity: 0.8, roughness: 0.4 });

        // Tiered circular plaza floor
        [[26, 0x27413f, 0.1], [20, 0x2c4d4c, 0.22], [13, 0x35595a, 0.34]].forEach(([rr, c, y]) => {
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.4, 36),
                new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
            disc.position.y = y; A.add(disc);
        });
        // Glowing rune ring inlaid in the floor
        const runeRing = new THREE.Mesh(new THREE.RingGeometry(10.5, 12, 48), runeMat);
        runeRing.rotation.x = -Math.PI / 2; runeRing.position.y = 0.55; A.add(runeRing);

        // Ring of broken royal pillars (varied heights, some toppled-looking)
        const pc = 12;
        for (let i = 0; i < pc; i++) {
            const a = (i / pc) * Math.PI * 2;
            const px = Math.cos(a) * 24, pz = Math.sin(a) * 24;
            const h = (i % 3 === 0) ? 6 : 11 + Math.random() * 3; // every 3rd is broken short
            const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, h, 10), pillarMat);
            pil.position.set(px, h / 2, pz); pil.castShadow = true; A.add(pil);
            if (h > 8) { // surviving pillars keep a glowing rune cap
                const cap = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), runeMat);
                cap.position.set(px, h + 0.4, pz); A.add(cap);
            }
        }

        // The drowned king's throne at the back of the plaza
        const throne = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 6), pillarMat); base.position.y = 1; throne.add(base);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 4), pillarMat); seat.position.y = 2.7; throne.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 1), pillarMat); back.position.set(0, 7, -2); throne.add(back);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 5), runeMat); crown.position.set(0, 12.5, -2); throne.add(crown);
        throne.position.set(0, 0, -24); throne.traverse(o => { if (o.isMesh) o.castShadow = true; });
        A.add(throne);

        // Glowing jellyfish hovering over the arena for atmosphere
        this.worldGroup.add(A);
        this.arenaGroup = A; // hidden from far away (see updateCulling)
        for (let i = 0; i < 6; i++) this.buildGlowJelly((Math.random() - 0.5) * 36, WORLD.arenaZ + (Math.random() - 0.5) * 36);

        // Ceremonial road: glowing rune slabs leading from the reef into the plaza
        const runeMat2 = new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x2fb6ff, emissiveIntensity: 0.8, roughness: 0.4 });
        for (let z = REEF_END_Z + 30; z > WORLD.arenaZ + 26; z -= 5) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 3), runeMat2);
            slab.position.set(0, 0.12, z); this.worldGroup.add(slab);
        }

        this.arenaCenter = new THREE.Vector3(0, 0, WORLD.arenaZ);
    }

    // =====================================================================================
    //  THE CORAL REEF  (three zones, REEF_LENGTH units long, between the boat and Oblongtalo)
    // =====================================================================================

    reefMaterial() {
        // A little self-glow so the coral colors stay lively even in dim, deep water.
        if (!this.reefMat) this.reefMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, flatShading: true, emissive: 0x0e1a1e, emissiveIntensity: 1 });
        return this.reefMat;
    }

    // One coral cluster (1-3 kinds of coral) merged into a single draw call.
    buildReefCoral(x, z, palette, scale = 1, solid = false) {
        const g = new THREE.Group();
        const pickCol = () => palette[Math.floor(Math.random() * palette.length)];
        const mat = (c) => new THREE.MeshStandardMaterial({ color: c });
        const rnd = () => (Math.random() - 0.5);
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
            const kind = ['branch', 'brain', 'fan', 'tube'][Math.floor(Math.random() * 4)];
            const ox = rnd() * 4 * scale, oz = rnd() * 4 * scale, c = pickCol();
            const light = new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.35);
            if (kind === 'branch') {
                const b = 3 + Math.floor(Math.random() * 4);
                for (let i = 0; i < b; i++) {
                    const h = (2.2 + Math.random() * 3.4) * scale;
                    const arm = new THREE.Group();
                    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.34 * scale, h, 6), mat(c)); cyl.position.y = h / 2; arm.add(cyl);
                    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 6, 5), mat(light)); tip.position.y = h; arm.add(tip);
                    arm.position.set(ox + rnd() * 1.4, 0, oz + rnd() * 1.4);
                    arm.rotation.set(rnd() * 0.9, 0, rnd() * 0.9);
                    g.add(arm);
                }
            } else if (kind === 'brain') {
                const r = (1.1 + Math.random() * 0.9) * scale;
                const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat(c)); dome.scale.y = 0.62; dome.position.set(ox, r * 0.3, oz); g.add(dome);
                for (let i = 0; i < 4; i++) {
                    const bump = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 6, 5), mat(light));
                    bump.position.set(ox + rnd() * r * 1.2, r * 0.55 + Math.random() * r * 0.2, oz + rnd() * r * 1.2); g.add(bump);
                }
            } else if (kind === 'fan') {
                const r = (1.4 + Math.random() * 1.2) * scale;
                const fan = new THREE.Mesh(new THREE.CircleGeometry(r, 9), mat(c)); fan.scale.y = 1.25;
                fan.position.set(ox, r * 1.1, oz); fan.rotation.y = Math.random() * Math.PI; g.add(fan);
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, r * 0.9, 5), mat(light)); stem.position.set(ox, r * 0.4, oz); g.add(stem);
            } else {
                const t = 4 + Math.floor(Math.random() * 4);
                for (let i = 0; i < t; i++) {
                    const h = (1.4 + Math.random() * 2.6) * scale;
                    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.38 * scale, h, 7, 1, true), mat(i % 2 ? c : light));
                    tube.position.set(ox + rnd() * 1.6 * scale, h / 2, oz + rnd() * 1.6 * scale); tube.rotation.set(rnd() * 0.3, 0, rnd() * 0.3); g.add(tube);
                }
            }
        }
        this.mergeGroup(g, { flat: true, castShadow: false, material: this.reefMaterial() });
        g.position.set(x, 0, z); g.rotation.y = Math.random() * Math.PI * 2;
        this.worldGroup.add(g);
        if (solid) this.addCollider(g, { shrink: 0.9 });
        return g;
    }

    // A bed of tall swaying kelp (one draw call; the whole bed sways together).
    buildReefKelp(x, z, hMin, hMax, color) {
        const g = new THREE.Group();
        const base = new THREE.Color(color);
        const n = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
            const h = hMin + Math.random() * (hMax - hMin);
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, h, 5), new THREE.MeshStandardMaterial({ color: base.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.1) }));
            m.geometry.translate(0, h / 2, 0);
            m.position.set((Math.random() - 0.5) * 3.2, 0, (Math.random() - 0.5) * 3.2);
            m.rotation.z = (Math.random() - 0.5) * 0.35; m.rotation.x = (Math.random() - 0.5) * 0.35;
            g.add(m);
        }
        this.mergeGroup(g, { castShadow: false, material: this.reefMaterial() });
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        this.addSway(g, 0.06 + Math.random() * 0.05, 0.7 + Math.random() * 0.5);
    }

    buildReefRock(x, z, color) {
        const g = new THREE.Group();
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const r = 1.6 + Math.random() * 2.4;
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08) }));
            m.scale.y = 0.7 + Math.random() * 0.5; m.position.set((Math.random() - 0.5) * 4, r * 0.4, (Math.random() - 0.5) * 4);
            m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); g.add(m);
        }
        this.mergeGroup(g, { flat: true, castShadow: false, material: this.reefMaterial() });
        g.position.set(x, 0, z); this.worldGroup.add(g);
        this.addCollider(g, { shrink: 0.6 });
    }

    // A glowing seabed vent in the Fire Vents zone: dark rock cone with a hot, bubbling mouth.
    buildFireVent(x, z) {
        const g = new THREE.Group();
        const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 5.5, 7), new THREE.MeshStandardMaterial({ color: 0x3a2320, roughness: 1, flatShading: true }));
        rock.position.y = 2.7; g.add(rock);
        const mouth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 12), new THREE.MeshBasicMaterial({ color: 0xff7a22 }));
        mouth.position.y = 5.5; g.add(mouth);
        if (!this._ventHalo) {
            const cv = document.createElement('canvas'); cv.width = cv.height = 64;
            const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 32);
            gr.addColorStop(0, 'rgba(255,120,30,0.85)'); gr.addColorStop(0.5, 'rgba(255,70,10,0.4)'); gr.addColorStop(1, 'rgba(255,50,0,0)');
            cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
            this._ventHalo = new THREE.CanvasTexture(cv);
        }
        // normal (not additive) blending, so the glow stays orange instead of washing out to white against the teal water
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._ventHalo, transparent: true, depthWrite: false }));
        halo.scale.set(11, 11, 1); halo.position.y = 6.2; g.add(halo);
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        this.addCollider(rock, { shrink: 0.4 });
    }

    // A tall glowing "lantern coral": landmarks that light the way across the reef.
    buildReefLantern(x, z) {
        const g = new THREE.Group();
        const glow = new THREE.MeshStandardMaterial({ color: 0xffb3dc, emissive: 0xff6aa8, emissiveIntensity: 1 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 10, 8), glow); stem.position.y = 5; g.add(stem);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 9), glow); bulb.position.y = 11; g.add(bulb);
        g.position.set(x, 0, z); this.worldGroup.add(g);
    }

    spawnEel(x, z) {
        const mesh = ENEMIES.electric_eel.build3D();
        // merge each body segment into one mesh, but keep the glowing back-spikes separate so they can crackle
        for (let i = 0; i < 8; i++) {
            const seg = mesh.getObjectByName('seg_' + i); if (!seg) continue;
            const spk = seg.getObjectByName('spk_' + i);
            this.mergeGroup(seg, { own: true, castShadow: false, exclude: spk ? [spk] : [] });
        }
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.scale.setScalar(1.3);
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        this.entities.push({ type: 'enemy', mesh, data: this.scaleByDifficulty(ENEMIES.electric_eel), aiState: { cooldown: 1 + Math.random() * 2, homeX: x, homeZ: z }, hoverY: 0.4 });
    }

    spawnFireFish(x, z) {
        const mesh = ENEMIES.fire_fish.build3D();
        const animated = ['tail', 'fin_l', 'fin_r', 'fin_top', 'mouth', 'crest_0', 'crest_1', 'crest_2'].map(n => mesh.getObjectByName(n)).filter(Boolean);
        const body = this.mergeGroup(mesh, { own: true, castShadow: false, exclude: animated }); // the still parts become one mesh
        if (body) body.material.emissive.setHex(0x6a2408); // a warm inner glow, like hot coals
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.position.set(x, 3.4, z);
        this.scene.add(mesh);
        this.entities.push({ type: 'enemy', mesh, data: this.scaleByDifficulty(ENEMIES.fire_fish), aiState: { cooldown: 1.5 + Math.random() * 2, homeX: x, homeZ: z }, hoverY: 3.4 });
    }

    buildCoralReef() {
        const rand = (a, b) => a + Math.random() * (b - a);
        const L = REEF_LENGTH / 3;
        const zones = [
            { name: 'Coral Shallows', coral: 80, kelp: 40, kelpH: [3, 7], kelpCol: 0x3fc07a, rocks: 10, jelly: 10, eelG: 3, eelPair: 0.0, fishG: 3, fishSize: [2, 2], vents: 0, arches: 3,
              palette: ['#ff3d77', '#ff8a1f', '#ffd000', '#12d4f0', '#9b5cff', '#ff5fa8', '#10e08a', '#ff6a3d'], rock: 0x4a7080 },
            { name: 'Kelp Maze', coral: 60, kelp: 115, kelpH: [9, 19], kelpCol: 0x2fae6a, rocks: 12, jelly: 12, eelG: 9, eelPair: 0.45, fishG: 3, fishSize: [2, 2], vents: 0, arches: 3,
              palette: ['#00e0b8', '#1e90ff', '#7a5cff', '#1fd16a', '#ff4fb8', '#2fd0ff'], rock: 0x3f6070 },
            { name: 'Fire Vents', coral: 75, kelp: 30, kelpH: [4, 9], kelpCol: 0x9a4a2a, rocks: 8, jelly: 10, eelG: 4, eelPair: 0.5, fishG: 8, fishSize: [2, 3], vents: 16, arches: 3,
              palette: ['#ff3a1a', '#ff7a1a', '#ffc01a', '#e01f2f', '#ff2d6f', '#ffa01a'], rock: 0x5a3430 }
        ];
        const nearSpawn = (x, z) => Math.abs(x) < 16 && z > REEF_START_Z - 34;
        const nearEnd = (z) => z < REEF_END_Z + 16;

        zones.forEach((zn, zi) => {
            const zA = REEF_START_Z - zi * L, zB = zA - L;
            const zr = () => rand(zB, zA);
            for (let i = 0; i < zn.coral; i++) {
                const x = rand(-152, 152), z = zr(); if (nearSpawn(x, z) || nearEnd(z)) continue;
                const s = rand(0.8, 1.9);
                this.buildReefCoral(x, z, zn.palette, s, s > 1.5 && Math.random() < 0.6);
            }
            for (let i = 0; i < zn.kelp; i++) { const x = rand(-152, 152), z = zr(); if (nearSpawn(x, z) || nearEnd(z)) continue; this.buildReefKelp(x, z, zn.kelpH[0], zn.kelpH[1], zn.kelpCol); }
            for (let i = 0; i < zn.rocks; i++) { const x = rand(-150, 150), z = zr(); if (nearSpawn(x, z) || nearEnd(z)) continue; this.buildReefRock(x, z, zn.rock); }
            for (let i = 0; i < zn.jelly; i++) this.buildGlowJelly(rand(-150, 150), zr());
            for (let i = 0; i < zn.vents; i++) { const x = rand(-145, 145), z = zr(); if (nearSpawn(x, z) || nearEnd(z)) continue; this.buildFireVent(x, z); }
            for (let i = 0; i < zn.arches; i++) { const x = rand(-130, 130), z = zr(); if (nearSpawn(x, z) || nearEnd(z)) continue; this.buildRuinArch(x, z); }
            // treasure (off the middle so you have to wander for it) and a few coins
            for (let i = 0; i < 2; i++) { const side = Math.random() < 0.5 ? -1 : 1; this.spawnChest(side * rand(30, 120), 0, rand(zB + 10, zA - 10), 50 + zi * 30 + Math.floor(Math.random() * 30)); }
            for (let i = 0; i < 10; i++) this.buildCoin(rand(-40, 40), rand(zB + 5, zA - 5));
            // creatures
            const inRange = (z) => z < REEF_START_Z - 50 && !nearEnd(z + 8);
            for (let i = 0; i < zn.eelG; i++) {
                const x = rand(-135, 135), z = zr(); if (!inRange(z)) continue;
                const cnt = 1 + (Math.random() < zn.eelPair ? 1 : 0);
                for (let k = 0; k < cnt; k++) this.spawnEel(x + rand(-5, 5), z + rand(-5, 5));
            }
            for (let i = 0; i < zn.fishG; i++) {
                const x = rand(-135, 135), z = zr(); if (!inRange(z)) continue;
                const cnt = zn.fishSize[0] + Math.floor(Math.random() * (zn.fishSize[1] - zn.fishSize[0] + 1));
                for (let k = 0; k < cnt; k++) this.spawnFireFish(x + rand(-7, 7), z + rand(-7, 7));
            }
        });

        // Lantern corals mark the way down the middle of the reef
        for (let z = REEF_START_Z - 45; z > REEF_END_Z + 20; z -= 58) this.buildReefLantern(rand(-8, 8) + (Math.random() < 0.5 ? -14 : 14), z);

        // Signposts at the start of each zone
        this.buildSignpost(11, REEF_START_Z - 12, ['Coral Shallows', 'Oblongtalo: south']);
        this.buildSignpost(-11, REEF_START_Z - L - 6, ['Kelp Maze', 'Beware electric eels!']);
        this.buildSignpost(11, REEF_START_Z - 2 * L - 6, ['Fire Vents', 'Fire fish spit sparks!']);
        this.buildSignpost(-11, REEF_END_Z + 14, ["Oblongtalo's Plaza", 'No turning back']);
    }

    // =====================================================================================
    //  THE DUNES OF FORCE  (Chapter 3: a hot desert of shifting, climbable dunes)
    // =====================================================================================

    // The shape shared by every dune: a smooth bell (height 1 in the middle, flat where it meets the sand) so
    // you can walk right up it. profile(d) = (1 - d^2)^1.5, with d = distance from the centre (0..1).
    duneGeometry() {
        if (this._duneGeo) return this._duneGeo;
        const RINGS = 16, SEG = 36, P = [], C = [], I = [];
        P.push(0, 1, 0); C.push(1, 1, 1);
        for (let r = 1; r <= RINGS; r++) {
            const d = r / RINGS, y = Math.pow(Math.max(0, 1 - d * d), 1.5);
            for (let k = 0; k < SEG; k++) {
                const a = (k / SEG) * Math.PI * 2;
                P.push(Math.cos(a) * d, y, Math.sin(a) * d);
                const shade = 0.88 + 0.12 * y + 0.04 * Math.sin(a * 3 + d * 5);    // lighter crest, subtle ridges
                C.push(shade, shade * 0.99, shade * 0.95);
            }
        }
        for (let k = 0; k < SEG; k++) I.push(0, 1 + ((k + 1) % SEG), 1 + k);
        for (let r = 1; r < RINGS; r++) for (let k = 0; k < SEG; k++) {
            const a = 1 + (r - 1) * SEG + k, b = 1 + (r - 1) * SEG + ((k + 1) % SEG), c = 1 + r * SEG + k, d2 = 1 + r * SEG + ((k + 1) % SEG);
            I.push(a, b, c, b, d2, c);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I); g.computeVertexNormals();
        return (this._duneGeo = g);
    }

    // A big sand dune. Dunes slowly slide around, so the paths between them keep changing.
    // They are solid hills: the ground height under you rises as you walk up them (see groundHeight).
    buildDuneMound(x, z, rx, rz, h) {
        const tone = [0xe0b868, 0xd4a859, 0xe8c378, 0xcc9d4e][Math.floor(Math.random() * 4)];
        const mesh = new THREE.Mesh(this.duneGeometry(), new THREE.MeshStandardMaterial({ color: tone, roughness: 1, vertexColors: true }));
        mesh.scale.set(rx, h, rz);
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        this.worldGroup.add(mesh);
        this.dunes.push({ mesh, bx: x, bz: z, rx, rz, h, curH: h, rot: mesh.rotation.y, r: Math.max(rx, rz), ax: 6 + Math.random() * 14, az: 3 + Math.random() * 9, ph: Math.random() * 6.28, sp: 0.05 + Math.random() * 0.1, breathe: Math.random() * 6.28 });
    }

    // How high is the ground at (x, z)? Flat everywhere except on the dunes of the desert.
    groundHeight(x, z) {
        if (!this.dunes.length || z > DESERT_START_Z + 60 || z < DESERT_END_Z - 60) return 0;
        let best = 0;
        for (const d of this.dunes) {
            const dx = x - d.mesh.position.x, dz = z - d.mesh.position.z;
            if (dx > d.r || dx < -d.r || dz > d.r || dz < -d.r) continue;
            const c = Math.cos(d.rot), sn = Math.sin(d.rot);
            const lx = (dx * c - dz * sn) / d.rx, lz = (dx * sn + dz * c) / d.rz, q = lx * lx + lz * lz;
            if (q >= 1) continue;
            const y = d.curH * Math.pow(1 - q, 1.5);
            if (y > best) best = y;
        }
        return best;
    }

    // Slide the dunes that are near the player (the player and creatures simply ride up and down with the ground).
    updateDunes() {
        if (!this.playerObj || !this.dunes.length) return;
        const t = performance.now() * 0.001, pp = this.playerObj.position;
        for (const d of this.dunes) {
            const dxp = d.mesh.position.x - pp.x, dzp = d.mesh.position.z - pp.z;
            if (dxp * dxp + dzp * dzp > 190 * 190) continue;
            const nx = d.bx + Math.sin(t * d.sp + d.ph) * d.ax, nz = d.bz + Math.cos(t * d.sp * 0.8 + d.ph) * d.az;
            d.curH = d.h * (1 + Math.sin(t * 0.35 + d.breathe) * 0.06);
            d.mesh.position.set(nx, 0, nz);
            d.mesh.scale.y = d.curH;
        }
    }

    buildSaguaro(x, z, scale = 1) {
        const g = new THREE.Group();
        const c = [0x3f8a45, 0x4a9a4e, 0x357a3e][Math.floor(Math.random() * 3)];
        const mat = () => new THREE.MeshStandardMaterial({ color: c });
        const h = (6 + Math.random() * 5) * scale;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * scale, 1.0 * scale, h, 10), mat()); trunk.position.y = h / 2; g.add(trunk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 10, 8), mat()); cap.position.y = h; g.add(cap);
        const arms = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < arms; i++) {
            const side = i % 2 ? -1 : 1, ay = h * (0.35 + Math.random() * 0.25), ah = (2 + Math.random() * 2.2) * scale;
            const out = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 1.9 * scale, 8), mat()); out.rotation.z = Math.PI / 2; out.position.set(side * 1.5 * scale, ay, 0); g.add(out);
            const up = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.55 * scale, ah, 8), mat()); up.position.set(side * 2.4 * scale, ay + ah / 2, 0); g.add(up);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 8, 6), mat()); tip.position.set(side * 2.4 * scale, ay + ah, 0); g.add(tip);
        }
        if (Math.random() < 0.5) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 7, 6), new THREE.MeshStandardMaterial({ color: 0xff6fa8 })); fl.position.set(0.3 * scale, h + 0.7 * scale, 0); g.add(fl); }
        this.mergeGroup(g, { castShadow: false });
        g.position.set(x, 0, z); g.rotation.y = Math.random() * 6.28;
        this.worldGroup.add(g);
        if (scale > 1.05) this.addCollider(g, { shrink: 0.6 });
    }

    buildBarrelCactus(x, z) {
        const g = new THREE.Group();
        const r = 1 + Math.random() * 1.1;
        const body = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), new THREE.MeshStandardMaterial({ color: 0x3f9a4a })); body.scale.y = 0.85; body.position.y = r * 0.8; g.add(body);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const rib = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 6, 5), new THREE.MeshStandardMaterial({ color: 0x2d7a38 })); rib.position.set(Math.cos(a) * r * 0.85, r * 0.8, Math.sin(a) * r * 0.85); g.add(rib); }
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 6), new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0xff6fa8 : 0xffd54a })); bloom.position.y = r * 1.65; g.add(bloom);
        this.mergeGroup(g, { castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g);
    }

    // A flat-topped rock mesa with striped layers. Climb it!
    buildMesa(x, z) {
        const g = new THREE.Group();
        const layers = 3 + Math.floor(Math.random() * 3), r0 = 9 + Math.random() * 8, cols = [0xb5703a, 0xc98a52, 0x9c5a2e, 0xd49a62];
        let y = 0;
        for (let i = 0; i < layers; i++) {
            const lh = 2.2 + Math.random() * 1.6, r = r0 * (1 - i * 0.1);
            const l = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, lh, 12), new THREE.MeshStandardMaterial({ color: cols[i % cols.length] }));
            l.position.y = y + lh / 2; y += lh; l.rotation.y = Math.random(); g.add(l);
        }
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g);
        const box = this.addCollider(g, { shrink: r0 * 0.12 });
        box.climbable = true;
    }

    buildBones(x, z) {
        const g = new THREE.Group();
        const bone = () => new THREE.MeshStandardMaterial({ color: 0xefe6cf });
        for (let i = 0; i < 5; i++) { // a ribcage half-buried in the sand
            const rib = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.1, 0.22, 6, 14, Math.PI), bone());
            rib.position.set((i - 2) * 1.4, 0, 0); rib.rotation.y = Math.PI / 2; g.add(rib);
        }
        const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7.5, 6), bone()); spine.rotation.z = Math.PI / 2; spine.position.y = 0.1; g.add(spine);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), bone()); skull.scale.set(1.2, 0.8, 1); skull.position.set(4.6, 0.7, 0); g.add(skull);
        this.mergeGroup(g, { castShadow: false });
        g.position.set(x, 0, z); g.rotation.y = Math.random() * 6.28; this.worldGroup.add(g);
    }

    spawnSnake(x, z) {
        const mesh = ENEMIES.dune_viper.build3D();
        for (let i = 0; i < 9; i++) {
            const seg = mesh.getObjectByName('sseg_' + i); if (!seg) continue;
            const keep = i === 0 ? ['venom_l', 'venom_r'].map(n => seg.getObjectByName(n)).filter(Boolean) : [];
            this.mergeGroup(seg, { own: true, castShadow: false, exclude: keep });
        }
        // start out camouflaged: a faint shimmer of sand (the animation takes over when it's near)
        mesh.traverse(o => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = 0.1; o.material.depthWrite = false; } });
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.scale.setScalar(1.25);
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        this.entities.push({ type: 'enemy', mesh, data: this.scaleByDifficulty(ENEMIES.dune_viper), aiState: { cooldown: 1 + Math.random() * 2, homeX: x, homeZ: z, revealUntil: 0 } });
    }

    spawnScortus(x, z) {
        const mesh = ENEMIES.scortus.build3D();
        const t0 = mesh.getObjectByName('tail_0'), t1 = mesh.getObjectByName('tail_1');
        const pinches = ['pinch_l', 'pinch_r'].map(n => mesh.getObjectByName(n)).filter(Boolean);
        if (t1) this.mergeGroup(t1, { own: true, castShadow: false });
        if (t0) this.mergeGroup(t0, { own: true, castShadow: false, exclude: t1 ? [t1] : [] });
        pinches.forEach(p => this.mergeGroup(p, { own: true, castShadow: false }));
        this.mergeGroup(mesh, { own: true, castShadow: false, exclude: [...pinches, ...(t0 ? [t0] : [])] });
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        this.entities.push({ type: 'enemy', mesh, data: this.scaleByDifficulty(ENEMIES.scortus), aiState: { cooldown: 1.5 + Math.random() * 2, homeX: x, homeZ: z } });
    }

    buildDunesOfForce() {
        const rand = (a, b) => a + Math.random() * (b - a);
        const zTop = DESERT_START_Z - 30, zBot = DESERT_END_Z + 25;
        const nearStart = (x, z) => (Math.abs(x) < 24 && z > DESERT_START_Z - 50) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 115;   // (the village area stays clear)
        const placed = [];
        // dunes: spread out so there are always ways through (and over!)
        for (let tries = 0, n = 0; n < 62 && tries < 400; tries++) {
            const x = rand(-150, 150), z = rand(zBot, zTop), rx = rand(13, 26), rz = rand(11, 21);
            if (nearStart(x, z) || placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.r + Math.max(rx, rz)) * 0.9)) continue;
            placed.push({ x, z, r: Math.max(rx, rz) }); n++;
            this.buildDuneMound(x, z, rx, rz, rand(5, 9.5));
        }
        for (let i = 0; i < 110; i++) { const x = rand(-155, 155), z = rand(zBot, zTop); if (nearStart(x, z) || placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r * 0.7)) continue; this.buildSaguaro(x, z, rand(0.9, 1.5)); }
        for (let i = 0; i < 70; i++) { const x = rand(-155, 155), z = rand(zBot, zTop); if (nearStart(x, z)) continue; this.buildBarrelCactus(x, z); }
        for (let i = 0; i < 22; i++) { const x = rand(-140, 140), z = rand(zBot, zTop - 20); if (nearStart(x, z) || placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r)) continue; this.buildMesa(x, z); }
        for (let i = 0; i < 14; i++) this.buildBones(rand(-140, 140), rand(zBot, zTop));
        // treasure + coins
        for (let i = 0; i < 6; i++) this.spawnChest((Math.random() < 0.5 ? -1 : 1) * rand(30, 130), 0, rand(zBot + 20, zTop - 30), 60 + Math.floor(Math.random() * 60));
        for (let i = 0; i < 26; i++) this.buildCoin(rand(-50, 50), rand(zBot + 10, zTop - 20));
        // creatures
        const inRange = (z) => z < DESERT_START_Z - 55 && z > DESERT_END_Z + 30;
        for (let i = 0; i < 18; i++) { const x = rand(-140, 140), z = rand(zBot, zTop); if (!inRange(z) || Math.hypot(x - QUICKSAND.x, z - QUICKSAND.z) < 40) continue; const n = 1 + (Math.random() < 0.4 ? 1 : 0); for (let k = 0; k < n; k++) this.spawnSnake(x + rand(-6, 6), z + rand(-6, 6)); }
        for (let i = 0; i < 16; i++) { const x = rand(-140, 140), z = rand(zBot, zTop); if (!inRange(z) || Math.hypot(x - QUICKSAND.x, z - QUICKSAND.z) < 40) continue; const n = 1 + (Math.random() < 0.3 ? 1 : 0); for (let k = 0; k < n; k++) this.spawnScortus(x + rand(-6, 6), z + rand(-6, 6)); }
        // signposts
        this.buildSignpost(11, DESERT_START_Z - 14, ['Dunes of Force', 'Sands of Vanished Might']);
        this.buildSignpost(-11, DESERT_START_Z - DESERT_LENGTH / 2, ['Halfway', 'The dunes are shifting...']);
        this.buildCactoVillage();
    }

    // =====================================================================================
    //  CACTO VILLAGE (ruins) and the quicksand to the Gravity Core
    // =====================================================================================

    // One ruined cactus-folk house: a ring of cactus pillars (some fallen), low sand-brick wall, fallen roof slabs, scorch marks.
    buildCactoHut(x, z, rot, size = 1, ruin = 0.5) {
        const g = new THREE.Group(), rnd = Math.random;
        const mat = (c) => new THREE.MeshStandardMaterial({ color: c });
        const greens = [0x3f8a45, 0x4a9a4e, 0x357a3e], N = 10, R0 = 4.8 * size;
        for (let i = 0; i < N; i++) {
            if (i === 0 || (i !== 5 && rnd() < ruin * 0.5)) continue;                      // the doorway, and pillars the war knocked down
            const a = i / N * Math.PI * 2, h = (3.4 + rnd() * 2) * size * (rnd() < ruin ? 0.55 : 1);
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * size, 0.7 * size, h, 8), mat(greens[i % 3]));
            p.position.set(Math.sin(a) * R0, h / 2, Math.cos(a) * R0); p.rotation.set((rnd() - 0.5) * 0.2 * ruin, 0, (rnd() - 0.5) * 0.2 * ruin); g.add(p);
            const cap = new THREE.Mesh(new THREE.SphereGeometry(0.58 * size, 8, 6), mat(greens[i % 3])); cap.position.set(Math.sin(a) * R0, h, Math.cos(a) * R0); g.add(cap);
        }
        for (let k = 0; k < 5; k++) { const a = rnd() * 6.28; const w = new THREE.Mesh(new THREE.BoxGeometry((1.8 + rnd() * 1.6) * size, 0.9 + rnd() * 1.2, 0.7), mat(0xc9a46a)); w.position.set(Math.sin(a) * R0 * 0.97, 0.6, Math.cos(a) * R0 * 0.97); w.rotation.y = a + (rnd() - 0.5) * 0.3; g.add(w); }
        for (let k = 0; k < 3; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(3.6 * size, 0.35, 2.6 * size), mat(0xa77a45)); sl.position.set((rnd() - 0.5) * 5, 0.4 + rnd() * 0.6, (rnd() - 0.5) * 5); sl.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7); g.add(sl); }
        const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6 * size, 14), mat(0x3a2a1c)); scorch.rotation.x = -Math.PI / 2; scorch.position.set((rnd() - 0.5) * 2, 0.06, (rnd() - 0.5) * 2); g.add(scorch);
        for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + rnd() * 0.5, 0), mat(0x9a8566)); d.position.set((rnd() - 0.5) * 8, 0.3, (rnd() - 0.5) * 8); g.add(d); }
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); g.rotation.y = rot; this.worldGroup.add(g);
    }

    // The village hall: a broken colonnade round a dais, with a toppled statue of a cactus person.
    buildCactoHall(x, z) {
        const g = new THREE.Group(), rnd = Math.random, mat = (c) => new THREE.MeshStandardMaterial({ color: c });
        const stone = 0xbfa070;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.8, 0.7, 20), mat(stone)); base.position.y = 0.35; g.add(base);
        for (let i = 0; i < 14; i++) {
            if (rnd() < 0.2) continue;
            const a = i / 14 * Math.PI * 2, h = (rnd() < 0.4 ? 3.4 : 7.5 + rnd() * 2.5);
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, h, 9), mat(i % 2 ? 0x3f8a45 : 0x4a9a4e));
            p.position.set(Math.sin(a) * 10, h / 2, Math.cos(a) * 10); p.rotation.z = (rnd() - 0.5) * 0.1; g.add(p);
            if (h > 7) { const top = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), mat(0x4a9a4e)); top.position.set(Math.sin(a) * 10, h, Math.cos(a) * 10); g.add(top); }
            if (h > 7 && rnd() < 0.6) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 1.4), mat(stone)); b.position.set(Math.sin(a + 0.22) * 10, h + 0.4, Math.cos(a + 0.22) * 10); b.rotation.y = a + 0.22; g.add(b); }
        }
        // a toppled statue of a cactus person
        const st = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 10), mat(0xb8996a)); trunk.rotation.z = Math.PI / 2; trunk.position.y = 1.2; st.add(trunk);
        [-1, 1].forEach(sd => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.8, 8), mat(0xb8996a)); arm.position.set(0.5, 1.6, sd * 1.8); arm.rotation.x = sd * 1.1; st.add(arm); });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), mat(0xb8996a)); head.position.set(3.7, 1.3, 0); st.add(head);
        [-0.5, 0.5].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), mat(0x2a2018)); e.position.set(4.9, 1.6, sd * 0.55); st.add(e); });
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), mat(0xd9788f)); bloom.position.set(3.7, 2.7, 0); st.add(bloom);
        st.position.set(-2, 0, 1); st.rotation.y = 0.5; g.add(st);
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g);
    }

    // A few broken walls (these block the way; the gaps between them don't).
    buildRuinWall(x, z, len, alongX = true) {
        const g = new THREE.Group(), rnd = Math.random, mat = (c) => new THREE.MeshStandardMaterial({ color: c });
        for (let i = 0; i < len / 2.4; i++) {
            if (rnd() < 0.12) continue;
            const h = 2 + rnd() * 2.6, b = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 1.2), mat([0xc9a46a, 0xb8925a, 0xd4b27a][i % 3]));
            b.position.set(i * 2.4 - len / 2 + 1.2, h / 2, 0); b.rotation.z = (rnd() - 0.5) * 0.08; g.add(b);
        }
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); if (!alongX) g.rotation.y = Math.PI / 2; this.worldGroup.add(g);
        this.addCollider(g, { shrink: 0.3 });
    }

    // Leftovers of the war: spears stuck in the sand, half-buried shields, torn banners (two sides: red and blue), a wrecked catapult.
    buildWarDebris(x, z) {
        const g = new THREE.Group(), rnd = Math.random, mat = (c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) { const sp = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5), mat(0x6e4a2e)); shaft.position.y = 2.5; sp.add(shaft); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 5), mat(0xb0b4bc)); tip.position.y = 5.3; sp.add(tip); sp.position.set((rnd() - 0.5) * 9, 0, (rnd() - 0.5) * 9); sp.rotation.set((rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7); g.add(sp); }
        for (let i = 0; i < 3; i++) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 12), mat(i % 2 ? 0x9a2a2a : 0x2a4a9a)); sh.position.set((rnd() - 0.5) * 10, 0.3, (rnd() - 0.5) * 10); sh.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9); g.add(sh); }
        const red = rnd() < 0.5, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 5), mat(0x5a3a22)); pole.position.set(0, 3, 0); pole.rotation.z = 0.22; g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), mat(red ? 0xa83030 : 0x3050a8)); flag.position.set(1.7, 4.9, 0); flag.rotation.set(0.1, 0.2, -0.35); g.add(flag);
        if (rnd() < 0.5) { // catapult wreck
            const bx = (w, h, d, c, px, py, pz, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(px, py, pz); m.rotation.y = ry; g.add(m); };
            bx(4, 0.5, 2.4, 0x6e4a2e, 6, 0.4, 3); bx(0.4, 3, 0.4, 0x6e4a2e, 5, 1.6, 3.9); bx(0.4, 3, 0.4, 0x6e4a2e, 5, 1.6, 2.1); bx(0.35, 4.5, 0.35, 0x5a3a22, 6.4, 1.5, 3);
            const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 10), mat(0x4a3220)); wh.rotation.x = Math.PI / 2; wh.position.set(7.4, 0.9, 4.2); wh.rotation.z = 0.5; g.add(wh);
        }
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); g.rotation.y = rnd() * 6.28; this.worldGroup.add(g);
    }

    // The old passage down to the Gravity Core, buried under a rockslide. It is sealed for good; the quicksand is the only way left.
    buildSealedPassage(x, z) {
        const g = new THREE.Group(), rnd = Math.random, mat = (c) => new THREE.MeshStandardMaterial({ color: c });
        [-13, 13].forEach(px => { const p = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6), mat(0x8a7a62)); p.position.set(px, 9, 0); g.add(p); });
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(32, 5, 6.4), mat(0x9a8a70)); lintel.position.set(0, 20.5, 0); g.add(lintel);
        for (let i = 0; i < 26; i++) { const r = 1.6 + rnd() * 2.6, b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat([0x6a5e4e, 0x7a6e5c, 0x5a4e40][i % 3])); b.position.set((rnd() - 0.5) * 21, r * 0.7 + rnd() * 9, (rnd() - 0.5) * 3); b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(b); }
        const crack = new THREE.MeshBasicMaterial({ color: 0xb98aff });
        for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2 + rnd() * 2, 0.18), crack); c.position.set((rnd() - 0.5) * 16, 2 + rnd() * 8, 1.9); c.rotation.z = (rnd() - 0.5) * 0.8; g.add(c); }   // faint glow from the core beyond
        const faceMat = mat(0x6a5a44); [-0.7, 0.7].forEach(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), faceMat); e.position.set(sx * 2.2, 20.5, 3.4); g.add(e); });
        this.mergeGroup(g, { flat: true, castShadow: false });
        g.position.set(x, 0, z); this.worldGroup.add(g);
        const wall = new THREE.Box3(new THREE.Vector3(x - 17, 0, z - 4), new THREE.Vector3(x + 17, 24, z + 4)); this.colliders.push(wall);
    }

    buildQuicksand() {
        const { x, z, r } = QUICKSAND;
        const g = new THREE.Group(); g.position.set(x, 0, z);
        const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
        const grad = cx.createRadialGradient(128, 128, 4, 128, 128, 128);
        grad.addColorStop(0, '#5a3a14'); grad.addColorStop(0.45, '#8a5e24'); grad.addColorStop(0.85, '#b8843a'); grad.addColorStop(1, 'rgba(200,150,80,0)');
        cx.fillStyle = grad; cx.fillRect(0, 0, 256, 256);
        cx.strokeStyle = 'rgba(255,225,160,0.55)'; cx.lineWidth = 5; cx.lineCap = 'round';   // swirl
        for (let arm = 0; arm < 3; arm++) { cx.beginPath(); for (let t = 0; t < 6.5; t += 0.1) { const rr = 6 + t * 17, a = t * 1.35 + arm * 2.1; const px = 128 + Math.cos(a) * rr, py = 128 + Math.sin(a) * rr; if (t === 0) cx.moveTo(px, py); else cx.lineTo(px, py); } cx.stroke(); }
        const tex = new THREE.CanvasTexture(cv); tex.center.set(0.5, 0.5);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 1.15, 48), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1 }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.08; g.add(disc);
        const bubbles = [];
        const bm = new THREE.MeshStandardMaterial({ color: 0xe6c88a, roughness: 0.4, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bm); const a = Math.random() * 6.28, rr = Math.random() * r * 0.8; b.position.set(Math.cos(a) * rr, 0.2, Math.sin(a) * rr); g.add(b); bubbles.push({ m: b, ph: Math.random() * 6.28, sp: 0.8 + Math.random() }); }
        this.worldGroup.add(g);
        this.quicksand = { x, z, r, tex, bubbles, g, warned: false };
    }

    buildCactoVillage() {
        const rand = (a, b) => a + Math.random() * (b - a);
        const { x: vx, z: vz } = VILLAGE;
        this.buildCactoHall(vx, vz);
        // houses in a loose ring round the hall, each in a different state of ruin
        [[-34, 18, 0.9], [-26, -22, 0.5], [30, 20, 0.8], [36, -14, 0.4], [14, -34, 0.7], [-10, 38, 0.6], [-52, 2, 0.9], [54, 6, 0.6], [0, 54, 0.8], [26, 48, 0.5]].forEach(([dx, dz, ruin], i) => {
            this.buildCactoHut(vx + dx, vz + dz, rand(0, 6.28), 0.95 + (i % 3) * 0.12, ruin);
        });
        // broken walls
        this.buildRuinWall(vx - 42, vz + 38, 22, true); this.buildRuinWall(vx + 44, vz + 36, 20, true); this.buildRuinWall(vx - 60, vz - 20, 24, false); this.buildRuinWall(vx + 62, vz - 10, 22, false); this.buildRuinWall(vx - 20, vz - 50, 18, true); this.buildRuinWall(vx + 24, vz - 52, 16, true);
        for (let i = 0; i < 9; i++) this.buildWarDebris(vx + rand(-65, 65), vz + rand(-55, 60));
        // the sealed passage at the far end, and the quicksand tucked away behind the old houses
        this.buildSealedPassage(vx, vz - 74);
        this.buildQuicksand();
        // signposts that tell the story
        this.buildSignpost(10, vz + 80, ['Cacto Village', '(what is left of it)']);
        this.buildSignpost(-10, vz - 55, ['The Sealed Passage', 'to the Gravity Core']);
        this.buildSignpost(QUICKSAND.x + 14, QUICKSAND.z + 8, ['The sand here still moves...', 'it flows down to the core']);
        // a few treasures among the ruins
        for (let i = 0; i < 3; i++) this.spawnChest(vx + rand(-55, 55), 0, vz + rand(-45, 50), 80 + Math.floor(Math.random() * 60));
    }

    // Standing in the quicksand: you slow down and sink. Get out in time, or it carries you all the way down to the core.
    updateQuicksand(delta) {
        const q = this.quicksand; if (!q || !this.playerObj) return;
        const p = this.playerObj.position;
        const inside = Math.hypot(p.x - q.x, p.z - q.z) < q.r && !this.isJumping;
        if (inside) {
            this.qsSink = Math.min(1, (this.qsSink || 0) + delta * 0.42);
            if (!q.warned) { q.warned = true; window.gameSystem.showToast('The sand is pulling you down! Jump or run out!'); Sound.play('splat'); }
        } else this.qsSink = Math.max(0, (this.qsSink || 0) - delta * 1.2);
        if (this.qsSink > 0) p.y = this.groundHeight(p.x, p.z) - this.qsSink * 4.4;     // sinking into the sand
        if (this.qsSink >= 1 && !this._fallingToCore) { this._fallingToCore = true; window.gameSystem.onFallIntoCore(); }
    }

    // Oblongtalo's glow carries the player away: arrive on the sand at the start of the Dunes of Force.
    arriveInDesert() {
        this.desertReached = true; this.desertEndTriggered = false;
        const p = this.playerObj;
        p.position.set(0, 0, DESERT_START_Z - 8); p.rotation.set(0, Math.PI, 0);
        if (this.companionObj) { this.companionObj.position.set(3.5, 0, DESERT_START_Z - 4); this.companionObj.rotation.set(0, Math.PI, 0); this.compBaseY = undefined; }
        this.velocityY = 0; this.isJumping = false; this.isGliding = false; this.grounded = true;
        this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(-0.2, 0, 0);
        this.cameraYaw = 0; this.cameraPitch = -0.2;
        this.camera.position.set(0, 10, DESERT_START_Z + 12);
        this.applyLook(0, 0, 1);
        Sound.setMood('dunes');
        this.updateCulling();
    }

    // =====================================================================================
    //  CHAPTER 4: THE SKY KINGDOM  (a cloud city, reached by riding a giant friendly cloud)
    // =====================================================================================

    // The cloud city: a round cloud with a plaza, a fountain, white towers with colourful roofs, cottages and floating islands.
    buildSkyKingdom() {
        const g = this.worldGroup, C = SKY;
        const M = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.92 }, extra));
        const cloudMat = M(0xffffff, { emissive: 0xd4e4f8, emissiveIntensity: 0.65 });
        const stone = M(0xf4f1ec), band = M(0xc3d4ee), rock = M(0x8f9aa8, { flatShading: true });
        const glass = M(0xfff2b0, { emissive: 0xffd86a, emissiveIntensity: 0.9 });
        const water = M(0x8fdcff, { emissive: 0x3aa8e8, emissiveIntensity: 0.8, roughness: 0.2 });
        const roofs = [0x4aa3e8, 0xf07aa8, 0x7ad0c0, 0xf2b84a, 0x9a86e8].map(c => M(c, { roughness: 0.6 }));
        const sphere = new THREE.SphereGeometry(1, 14, 10);
        const put = (mesh, x, y, z, parent) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
        const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

        // --- the round cloud itself, a soft underside, and an endless sea of clouds far below ---
        const tex = this.makeGroundTexture({ base: '#f6faff', light: '#ffffff', dark: '#d3e3f6', blades: false, patches: ['#eaf3ff', '#dcebfb', '#fdfdff', '#cfe0f5', '#f3ecff'] });
        tex.repeat.set(300 / 70, 300 / 70); this._skyTex = tex;
        const floor = mesh(new THREE.CircleGeometry(SKY_RADIUS + 2, 56), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0, C.z); floor.receiveShadow = true; g.add(floor);
        const under = mesh(sphere, cloudMat); under.scale.set(SKY_RADIUS, 40, SKY_RADIUS); under.position.set(C.x, -42, C.z); g.add(under);
        const sea = mesh(new THREE.PlaneGeometry(3600, 3600), M(0x8fbbea, { emissive: 0x5f93d0, emissiveIntensity: 0.55, roughness: 1 }));
        sea.rotation.x = -Math.PI / 2; sea.position.set(C.x, -75, C.z); g.add(sea);
        // fluffy puffs: a ring round the rim of the city, and lumps scattered over the cloud sea (one draw call)
        const RIM = 48, FAR = 150, N = RIM + FAR, puffs = new THREE.InstancedMesh(sphere, cloudMat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
        for (let i = 0; i < N; i++) {
            let x, y, z, s;
            if (i < RIM) { const a = i / RIM * Math.PI * 2 + Math.random() * 0.1; s = 7 + Math.random() * 8; x = Math.cos(a) * (SKY_RADIUS - 2); z = Math.sin(a) * (SKY_RADIUS - 2); y = Math.random() * 3; }
            else { const a = Math.random() * Math.PI * 2, r = 190 + Math.random() * 800; s = 25 + Math.random() * 45; x = Math.cos(a) * r; z = Math.sin(a) * r; y = -85 + Math.random() * 28; }
            m4.compose(new THREE.Vector3(C.x + x, y, C.z + z), q, new THREE.Vector3(s, s * 0.55, s)); puffs.setMatrixAt(i, m4);
        }
        puffs.frustumCulled = false; g.add(puffs);

        // --- the central plaza and the cloud fountain ---
        const plaza = new THREE.Group();
        put(mesh(new THREE.CylinderGeometry(30, 31, 0.8, 40), stone), 0, 0.4, 0, plaza);
        put(mesh(new THREE.TorusGeometry(30.5, 0.7, 8, 48), band), 0, 0.8, 0, plaza).rotation.x = Math.PI / 2;
        plaza.position.set(C.x, 0, C.z); g.add(plaza);
        const fountain = new THREE.Group();
        put(mesh(new THREE.CylinderGeometry(7, 7.6, 1.6, 24), band), 0, 1.6, 0, fountain);
        put(mesh(new THREE.CylinderGeometry(6, 6, 0.3, 24), water), 0, 2.45, 0, fountain);
        put(mesh(new THREE.CylinderGeometry(1, 1.5, 6, 12), stone), 0, 5, 0, fountain);
        const orb = put(mesh(new THREE.SphereGeometry(1.8, 16, 12), water), 0, 9, 0, fountain);
        put(mesh(new THREE.TorusGeometry(3, 0.25, 6, 24), glass), 0, 9, 0, fountain).rotation.x = Math.PI / 2.4;
        this.addProp(fountain, C.x, C.z, { shrink: 0.5 });
        this.skyOrb = orb;

        // --- the landing pad where the giant cloud sets you down (south edge of the city) ---
        const pad = new THREE.Group();
        put(mesh(new THREE.CylinderGeometry(15, 15.5, 0.7, 36), stone), 0, 0.35, 0, pad);
        put(mesh(new THREE.TorusGeometry(12.5, 0.4, 6, 40), glass), 0, 0.75, 0, pad).rotation.x = Math.PI / 2;
        put(mesh(new THREE.TorusGeometry(7, 0.3, 6, 32), band), 0, 0.75, 0, pad).rotation.x = Math.PI / 2;
        pad.position.set(C.x, 0, C.z + 96); g.add(pad);

        // --- white towers with colourful cone roofs, and little round cottages, ringed round the plaza ---
        const tower = (r, h, roof) => {
            const t = new THREE.Group();
            put(mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), stone), 0, h / 2, 0, t);
            put(mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.8, 14), band), 0, h * 0.55, 0, t);
            put(mesh(new THREE.ConeGeometry(r * 1.4, r * 1.9, 14), roof), 0, h + r * 0.95, 0, t);
            for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; const w = put(mesh(new THREE.BoxGeometry(0.9, 1.7, 0.3), glass), Math.sin(a) * r, h * (0.7 - (k % 2) * 0.28), Math.cos(a) * r, t); w.rotation.y = a; }
            return t;
        };
        const cottage = (r, roof) => {
            const t = new THREE.Group();
            put(mesh(new THREE.CylinderGeometry(r, r * 1.05, 5, 12), stone), 0, 2.5, 0, t);
            const dome = put(mesh(sphere, roof), 0, 5, 0, t); dome.scale.set(r * 1.25, r * 0.9, r * 1.25);
            put(mesh(new THREE.BoxGeometry(1.5, 2.6, 0.3), glass), 0, 1.3, r, t);
            return t;
        };
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2 + 0.17, ring = i % 3, rr = 58 + ring * 24 + Math.random() * 6;
            const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
            if (Math.abs(x) < 17 && Math.abs(z) > 8) continue;      // keep the roads open: south to the landing pad, north to Makani Village
            const b = ring === 1 ? cottage(3.6 + Math.random() * 1.2, roofs[i % 5]) : tower(4.6 + Math.random() * 2, 14 + Math.random() * 16, roofs[(i + 2) % 5]);
            b.rotation.y = -a + Math.PI / 2;
            this.addProp(b, C.x + x, C.z + z, { shrink: 0.4 });
        }
        this.buildSignpost(C.x + 11, C.z + 84, ['Sky Kingdom', 'Cloud City: ahead']);

        // --- little floating islands drifting around the city (just for the view) ---
        for (let i = 0; i < 7; i++) {
            const isl = new THREE.Group(), a = i / 7 * Math.PI * 2 + 0.4, rr = 215 + (i % 3) * 30, s = 0.7 + Math.random() * 0.8;
            const cone = put(mesh(new THREE.ConeGeometry(14, 20, 7), rock), 0, -10, 0, isl); cone.rotation.x = Math.PI;
            put(mesh(new THREE.CylinderGeometry(15, 14, 2.4, 14), stone), 0, 1.2, 0, isl);
            if (i % 2 === 0) put(mesh(new THREE.CylinderGeometry(2.6, 3, 9, 10), stone), 0, 6.5, 0, isl); put(mesh(new THREE.ConeGeometry(3.6, 5, 10), roofs[i % 5]), 0, i % 2 === 0 ? 13.5 : 4.5, 0, isl);
            isl.scale.setScalar(s); isl.position.set(C.x + Math.cos(a) * rr, 14 + (i * 13) % 42, C.z + Math.sin(a) * rr);
            const ix = isl.position.x, iz = isl.position.z;   // (keep the view-only islands out of Makani Village and its road)
            if (Math.hypot(ix - MAKANI.x, iz - MAKANI.z) > 170 && !(Math.abs(ix - C.x) < 80 && iz < C.z - 100 && iz > MAKANI.z - 20)) g.add(isl);
        }
    }

    // =====================================================================================
    //  MAKANI VILLAGE (Chapter 4): a wind village of cloud roads and houses held up by clouds
    // =====================================================================================

    // A villager of Makani: a few merged meshes (static body, the head, the scarf), standing on the cloud.
    spawnVillager(v, x, z, yaw) {
        const mesh = buildVillager3D(v);
        const head = mesh.getObjectByName('head'), scarf = mesh.getObjectByName('scarf');
        if (head) this.mergeGroup(head, { own: true, castShadow: false });
        if (scarf) this.mergeGroup(scarf, { own: true, castShadow: false });
        this.mergeGroup(mesh, { own: true, castShadow: false, exclude: [head, scarf].filter(Boolean) });
        mesh.scale.setScalar(0.95); mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
        this.scene.add(mesh);
        this.entities.push({ type: 'villager', mesh, v, radius: 6 });
        this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 1.1, 0, z - 1.1), new THREE.Vector3(x + 1.1, 5, z + 1.1)));
    }

    // Find the villager (or the cat, or a clue) you're standing next to, so you can talk to it, and show / hide the "press E" hint.
    updateTalkPrompt() {
        const gs = window.gameSystem, el = document.getElementById('talk-prompt');
        let near = null, other = null;
        if (this.skyReached && this.playerObj && gs.state === 'overworld' && !gs.isCutscene && !this.skyRide && !this.voyage) {
            const p = this.playerObj.position; let best = 49, bestO = 1e9;
            for (const e of this.entities) {
                if (!e.mesh || !e.mesh.visible) continue;
                const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z, d2 = dx * dx + dz * dz;
                if (e.type === 'villager') { if (d2 < best) { best = d2; near = e; } }
                else if ((e.type === 'cat' || e.type === 'clue' || e.type === 'bully' || (e.guard && window.SkyGuards && SkyGuards.canTalk())) && d2 < (e.radius || 5) * (e.radius || 5) && d2 < bestO) { bestO = d2; other = e; }
            }
            // a villager wins unless the cat / clue is clearly closer
            this.nearPick = (other && (!near || Math.sqrt(bestO) + 2 < Math.sqrt(best))) ? other : near;
        } else this.nearPick = null;
        this.nearVillager = near;
        const pick = this.nearPick;
        if (el) {
            if (pick && !this.isMobile) { el.textContent = '💬  Press E to ' + (pick.type === 'villager' ? 'talk to ' + pick.v.name : pick.label); el.classList.remove('hidden'); }
            else el.classList.add('hidden');
        }
    }

    // Talk to whatever is next to you (the E key, or the 💬 button on a phone).
    tryTalk() {
        const e = this.nearPick, gs = window.gameSystem;
        if (!e || gs.state !== 'overworld' || gs.isCutscene) return;
        if (e.type === 'villager') { this.talkingTo = e; gs.talkToVillager(e); }
        else if (e.guard) { if (window.SkyGuards) SkyGuards.talk(); }
        else if (window.SideQuests) SideQuests.use(e);
    }

    // Can the player stand here? The city's round cloud, the cloud road, and every cloud of Makani Village.
    skyWalkable(x, z) {
        if (Math.hypot(x - SKY.x, z - SKY.z) < SKY_RADIUS - 6) return true;
        const sh = this.skyShapes;
        if (!sh) return false;
        for (let i = 0; i < sh.length; i++) {
            const a = sh[i];
            if (a.t === 0) { if (Math.hypot(x - a.x, z - a.z) < a.r - 1.5) return true; }
            else {
                const vx = a.bx - a.ax, vz = a.bz - a.az, l2 = vx * vx + vz * vz;
                const u = Math.max(0, Math.min(1, ((x - a.ax) * vx + (z - a.az) * vz) / l2));
                if (Math.hypot(x - (a.ax + vx * u), z - (a.az + vz * u)) < a.hw - 1.2) return true;
            }
        }
        return false;
    }

    buildMakaniVillage() {
        const g = this.worldGroup, V = MAKANI, C = SKY, rnd = Math.random;
        const M = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9 }, extra));
        const tex = this._skyTex;
        const layer = (off) => new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
        const roadMat = layer(-1), plotMat = layer(-2), plazaMat = layer(-3);
        const cloudMat = M(0xffffff, { emissive: 0xd4e4f8, emissiveIntensity: 0.65 });
        const stone = M(0xf4f1ec), band = M(0xc3d4ee);
        const pastel = [0xffd6e0, 0xcdeaff, 0xfff0b8, 0xd6f5d6, 0xe6d9ff, 0xffe0c4, 0xc9f2ee, 0xf7d3f0];
        const roofC = [0xf0627f, 0x3f8fe8, 0xf2b236, 0x4cc29a, 0x8c6cf0, 0xff8a4a, 0x2fb5c4, 0xd860c8];
        const sphere = new THREE.SphereGeometry(1, 12, 9);
        const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
        const put = (m, x, y, z, parent) => { m.position.set(x, y, z); parent.add(m); return m; };
        this.skyShapes = []; this.makaniVanes = [];
        const puffs = [];                                       // every cloud puff of the village (one instanced draw call)
        const puff = (x, y, z, sx, sy, sz) => puffs.push([x, y, z, sx, sy, sz]);
        const flat = (geo, mat, x, z, y) => { const m = mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m; };

        // ---- cloud shapes (the places you can walk) ----
        const disc = (x, z, r, mat, y = 0.03) => {
            flat(new THREE.CircleGeometry(r, 48), mat, x, z, y);
            this.skyShapes.push({ t: 0, x, z, r });
            const n = Math.ceil(r * 0.9);                            // a fluffy low rim all round
            for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd() * 0.2, s = 2.6 + rnd() * 2.4; puff(x + Math.cos(a) * (r - 1), rnd() * 1.6, z + Math.sin(a) * (r - 1), s, s * 0.55, s); }
            for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, rr = rnd() * r * 0.55, s = r * (0.35 + rnd() * 0.3); puff(x + Math.cos(a) * rr, -7 - rnd() * 7, z + Math.sin(a) * rr, s, s * 0.7, s); }   // the cloud's fat belly
            for (let k = 0; k < 6; k++) { const s = r * (0.5 - k * 0.07); puff(x + (rnd() - 0.5) * 3, -18 - k * 9, z + (rnd() - 0.5) * 3, s, s * 0.8, s); }                 // a tall column of cloud holding it up
        };
        const road = (ax, az, bx, bz, hw, y = 0.02) => {
            const len = Math.hypot(bx - ax, bz - az);
            const rg = new THREE.PlaneGeometry(hw * 2, len); rg.rotateX(-Math.PI / 2);       // lies flat, its length running along z
            const rm = mesh(rg, roadMat); rm.position.set((ax + bx) / 2, y, (az + bz) / 2); rm.rotation.y = Math.atan2(bx - ax, bz - az); rm.receiveShadow = true; g.add(rm);   // ...then spin it to point from a to b
            this.skyShapes.push({ t: 1, ax, az, bx, bz, hw });
            const n = Math.ceil(len / 8);
            for (let i = 0; i <= n; i++) {                                   // fluffy edges and a soft belly under the road
                const u = i / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u, nx = (bz - az) / len, nz = -(bx - ax) / len;
                [-1, 1].forEach(sd => { const s = 1.8 + rnd() * 1.6; puff(x + nx * sd * (hw - 0.8), rnd() * 1.2, z + nz * sd * (hw - 0.8), s, s * 0.55, s); });
                if (i % 2 === 0) { const s = hw * (1.2 + rnd() * 0.6); puff(x, -4 - rnd() * 5, z, s, s * 0.6, s); }
            }
        };

        // ---- the central plaza + the Great Windmill ----
        disc(V.x, V.z, 28, plazaMat, 0.05);
        const plaza = new THREE.Group();
        put(mesh(new THREE.TorusGeometry(24, 0.5, 6, 56), band), 0, 0.2, 0, plaza).rotation.x = Math.PI / 2;
        put(mesh(new THREE.TorusGeometry(10, 0.4, 6, 40), band), 0, 0.2, 0, plaza).rotation.x = Math.PI / 2;
        const windmill = (h, bl, roof, spd) => {
            const w = new THREE.Group();
            put(mesh(new THREE.CylinderGeometry(h * 0.16, h * 0.26, h, 14), stone), 0, h / 2, 0, w);
            put(mesh(new THREE.CylinderGeometry(h * 0.285, h * 0.285, 0.7, 14), band), 0, h * 0.5, 0, w);
            put(mesh(new THREE.ConeGeometry(h * 0.26, h * 0.3, 14), M(roof, { roughness: 0.6 })), 0, h + h * 0.13, 0, w);
            put(mesh(new THREE.SphereGeometry(h * 0.07, 10, 8), M(0xf2b236)), 0, h * 0.9, h * 0.17, w);
            const blades = new THREE.Group(); blades.position.set(0, h * 0.9, h * 0.2); w.add(blades);
            for (let k = 0; k < 4; k++) {
                const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; blades.add(arm);
                put(mesh(new THREE.BoxGeometry(h * 0.04, bl, h * 0.02), M(0x7a5a3a)), 0, bl / 2, 0, arm);
                put(mesh(new THREE.BoxGeometry(bl * 0.2, bl * 0.8, h * 0.012), M(k % 2 ? 0xffffff : roof)), bl * 0.12, bl * 0.55, 0, arm);
            }
            this.makaniVanes.push({ g: blades, sp: spd, ph: rnd() * 6, kind: 'windmill' });
            return { w, blades };
        };
        const great = windmill(26, 15, 0xf0627f, 0.5); great.w.position.set(0, 0, 0); plaza.add(great.w);
        // colourful flags strung between posts round the plaza
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2, px = Math.cos(a) * 20, pz = Math.sin(a) * 20;
            put(mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), M(0x7a5a3a)), px, 3.5, pz, plaza);
            const na = a + Math.PI / 12; const fx = Math.cos(na) * 20.3, fz = Math.sin(na) * 20.3;
            const f = put(mesh(new THREE.PlaneGeometry(3.4, 1.8), M(roofC[i % 8], { side: THREE.DoubleSide })), fx, 6, fz, plaza); f.rotation.y = -na + Math.PI / 2;
        }
        plaza.position.set(V.x, 0, V.z);
        this.mergeGroup(plaza, { flat: true, castShadow: false, exclude: [great.blades] });
        g.add(plaza);
        this.colliders.push(new THREE.Box3(new THREE.Vector3(V.x - 6, 0, V.z - 6), new THREE.Vector3(V.x + 6, 30, V.z + 6)));   // the windmill tower is solid (the spinning blades are high above your head)

        // ---- a house of Makani: a round pod with a big cone roof, round windows and its own little windmill ----
        const house = (idx) => {
            const h = new THREE.Group(), body = M(pastel[idx % 8]), roof = M(roofC[idx % 8], { roughness: 0.6 });
            put(mesh(new THREE.CylinderGeometry(4.4, 4.7, 5.4, 14), body), 0, 2.7, 0, h);
            put(mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.7, 14), band), 0, 5.5, 0, h);
            put(mesh(new THREE.ConeGeometry(6.2, 4.6, 14), roof), 0, 8.1, 0, h);
            for (let k = 0; k < 3; k++) { const a = Math.PI * 0.55 + k * 1.6 + 0.4; const wnd = put(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 12), M(0xfff2b0, { emissive: 0xffd86a, emissiveIntensity: 0.8 })), Math.sin(a) * 4.45, 3.2, Math.cos(a) * 4.45, h); wnd.rotation.order = 'YXZ'; wnd.rotation.set(0, a - Math.PI / 2, Math.PI / 2); }
            put(mesh(new THREE.BoxGeometry(1.8, 3, 0.5), M(0x6a4a34)), 0, 1.5, 4.5, h);                  // door (faces +z)
            put(mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0xf2b236)), 0.5, 1.5, 4.8, h);               // door knob
            const wm = windmill(5.2, 3, roofC[(idx + 3) % 8], 1.4 + (idx % 3) * 0.5);                      // a tiny windmill on the roof
            wm.w.position.set(0, 10.2, 0); wm.w.scale.setScalar(0.75); h.add(wm.w);
            return { h, vane: wm.blades };
        };
        const pinwheel = (x, z, idx, parent) => {
            put(mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), M(0x7a5a3a)), x, 1.5, z, parent);
            const bl = new THREE.Group(); bl.position.set(x, 3.1, z + 0.12); parent.add(bl);
            for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; bl.add(arm); put(mesh(new THREE.BoxGeometry(0.9, 1.2, 0.05), M(roofC[(idx + k) % 8], { side: THREE.DoubleSide })), 0.45, 0.6, 0, arm); }
            this.makaniVanes.push({ g: bl, sp: 3 + rnd() * 2, ph: rnd() * 6 });
            return bl;
        };

        // ---- eight house-clouds in a ring, joined to the plaza by roads and to each other by a ring road ----
        const plots = [];
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + 0.2, rr = 74 + (i % 2) * 8, px = V.x + Math.sin(a) * rr, pz = V.z + Math.cos(a) * rr;
            plots.push({ x: px, z: pz, a });
            disc(px, pz, 13, plotMat, 0.04);
            road(V.x + Math.sin(a) * 24, V.z + Math.cos(a) * 24, px, pz, 5);
            const { h, vane } = house(i);
            h.rotation.y = Math.atan2(V.x - px, V.z - pz) + (rnd() - 0.5) * 0.3;
            h.position.set(px, 0, pz);
            const flatParts = []; h.traverse(o => { if (o.isMesh) flatParts.push(o); });
            this.mergeGroup(h, { flat: true, castShadow: false, exclude: [vane] });
            g.add(h); this.addCollider(h, { shrink: 1.5 });
            // pinwheels and a puffy bush on the plot
            const dec = new THREE.Group(); dec.position.set(px, 0, pz); g.add(dec);
            [[-8.6, 3, 0], [8.4, 1.5, 1], [7.4, -5.5, 2]].forEach(([dx, dz, k]) => pinwheel(dx, dz, i + k, dec));
            puff(px + 9, 1.4, pz - 7, 2.6, 1.7, 2.6); puff(px - 9, 1.2, pz - 6, 2.2, 1.5, 2.2);
        }
        for (let i = 0; i < 8; i++) { const A = plots[i], B = plots[(i + 1) % 8]; road(A.x, A.z, B.x, B.z, 3.6, 0.015); }
        // ---- the villagers: one standing outside each house, looking toward the plaza ----
        plots.forEach((pl, i) => { const dx = V.x - pl.x, dz = V.z - pl.z, L = Math.hypot(dx, dz); this.spawnVillager(VILLAGERS[i], pl.x + dx / L * 9.5 + dz / L * 2.4, pl.z + dz / L * 9.5 - dx / L * 2.4, Math.atan2(dx, dz)); });

        // ---- Cashato's Cloud Market: a round little shop on its own cloud, halfway between the plaza and the first two houses ----
        {
            const sa = plots[0].a + Math.PI / 8, SR = 50, sx = V.x + Math.sin(sa) * SR, sz = V.z + Math.cos(sa) * SR;
            disc(sx, sz, 12.5, plotMat, 0.04);
            road(V.x + Math.sin(sa) * 24, V.z + Math.cos(sa) * 24, sx, sz, 5);
            const shop = new THREE.Group();
            const gold = M(0xffd24a, { emissive: 0xffae00, emissiveIntensity: 0.5, roughness: 0.4 }), teal = M(0x2fb5a8, { roughness: 0.6 }), coral = M(0xff6f61), cream = M(0xfff0b8), wood = M(0x7a5a3a), sky = M(0xdff1ff, { emissive: 0x9fd0ff, emissiveIntensity: 0.5 });
            put(mesh(new THREE.CylinderGeometry(5.0, 5.3, 4.6, 16), cream), 0, 2.3, 0, shop);                       // the round body
            put(mesh(new THREE.CylinderGeometry(5.45, 5.45, 0.6, 16), band), 0, 4.7, 0, shop);
            put(mesh(new THREE.ConeGeometry(6.6, 4.2, 16), teal), 0, 7.1, 0, shop);                                 // the roof
            put(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.36, 22), gold), 0, 10.2, 0, shop).rotation.x = Math.PI / 2;   // a giant gold coin on top
            put(mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), wood), 0, 9.3, 0, shop);
            [-1, 1].forEach(sd => put(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 12), M(0xfff2b0, { emissive: 0xffd86a, emissiveIntensity: 0.8 })), sd * 2.9, 3.0, 4.05, shop).rotation.x = Math.PI / 2);   // lit windows
            for (let i = 0; i < 5; i++) {                                                                           // the striped awning over the counter
                const a = (i - 2) * 0.3, slab = put(mesh(new THREE.BoxGeometry(3.4, 0.22, 3.6), i % 2 ? cream : coral), Math.sin(a) * 9.6, 6.0, Math.cos(a) * 9.6 + 0.3, shop);
                slab.rotation.order = 'YXZ'; slab.rotation.set(0.32, a, 0);
            }
            [-0.95, 0.95].forEach(a => put(mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.0, 8), wood), Math.sin(a) * 11.0, 3.0, Math.cos(a) * 11.0, shop));
            put(mesh(new THREE.BoxGeometry(7.2, 1.1, 1.5), wood), 0, 0.55, 8.9, shop);                              // the counter...
            put(mesh(new THREE.BoxGeometry(7.4, 0.14, 1.7), cream), 0, 1.15, 8.9, shop);
            put(mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 6), wood), -1.9, 1.4, 8.9, shop).rotation.z = Math.PI / 2;      // ...a Cloud Spear on display
            put(mesh(new THREE.ConeGeometry(0.24, 0.8, 6), sky), 0.5, 1.4, 8.9, shop).rotation.z = -Math.PI / 2;
            put(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), wood), 1.9, 1.4, 8.5, shop).rotation.z = Math.PI / 2;       // ...a Cloud Arrow
            put(mesh(new THREE.ConeGeometry(0.16, 0.5, 6), sky), 3.4, 1.4, 8.5, shop).rotation.z = -Math.PI / 2;
            [0.9, 1.05].forEach(x => put(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), sky), x, 1.4, 8.5, shop));
            for (let i = 0; i < 4; i++) put(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.13, 14), gold), 2.9, 1.3 + i * 0.14, 9.4, shop);   // a pile of gold coins
            [[-3.0, 1.9, 9.4], [-2.4, 1.7, 9.6]].forEach(([x, y, z]) => put(mesh(new THREE.SphereGeometry(0.7, 10, 8), cream), x, y - 0.4, z, shop));   // sacks of goods
            shop.rotation.y = Math.atan2(V.x - sx, V.z - sz);
            shop.position.set(sx, 0, sz);
            this.mergeGroup(shop, { flat: true, castShadow: false });
            g.add(shop);
            this.colliders.push(new THREE.Box3(new THREE.Vector3(sx - 4.6, 0, sz - 4.6), new THREE.Vector3(sx + 4.6, 9, sz + 4.6)));   // the round body is solid
            const dx = V.x - sx, dz = V.z - sz, L = Math.hypot(dx, dz);
            this.spawnVillager(VILLAGERS[8], sx + dx / L * 6.5, sz + dz / L * 6.5, Math.atan2(dx, dz));                            // Cashato stands behind the counter
            this.buildSignpost(sx + dx / L * 14 - dz / L * 7, sz + dz / L * 14 + dx / L * 7, ["CASHATO'S", 'CLOUD MARKET']);
            this.makaniInfo = { plots, shop: { x: sx, z: sz } };
        }

        // ---- the long cloud road from the cloud city, with lanterns and kites along it ----
        const rx0 = C.x, rz0 = C.z - 112, rx1 = V.x, rz1 = V.z + 26;
        road(rx0, rz0, rx1, rz1, 7);
        const lamps = new THREE.Group(), kite = [0xf0627f, 0x3f8fe8, 0xf2b236, 0x4cc29a, 0x8c6cf0, 0xff8a4a];
        const len = Math.hypot(rx1 - rx0, rz1 - rz0), nx = (rz1 - rz0) / len, nz = -(rx1 - rx0) / len;
        for (let d = 24, i = 0; d < len - 20; d += 30, i++) {
            [-1, 1].forEach((sd, j) => {
                const x = rx0 + (rx1 - rx0) * d / len + nx * sd * 6, z = rz0 + (rz1 - rz0) * d / len + nz * sd * 6;
                put(mesh(new THREE.CylinderGeometry(0.2, 0.28, 5.4, 6), M(0x7a5a3a)), x, 2.7, z, lamps);
                put(mesh(new THREE.SphereGeometry(0.9, 10, 8), M(0xfff2b0, { emissive: 0xffd86a, emissiveIntensity: 0.9 })), x, 5.9, z, lamps);
                if ((i + j) % 2 === 0) { const k = put(mesh(new THREE.PlaneGeometry(2.2, 2.2), M(kite[(i + j) % 6], { side: THREE.DoubleSide })), x + nx * sd * 1.6, 9.2 + (i % 3), z + nz * sd * 1.6, lamps); k.rotation.set(0.2, Math.atan2(nx, nz), Math.PI / 4); }
            });
        }
        this.mergeGroup(lamps, { flat: true, castShadow: false }); g.add(lamps);

        // ---- the road north to the Stairs of Foam, the Sky Guards' arena, the great gate, the stairs, and the Sun of Time ----
        {
            const F = FOAM, gold = M(0xffd24a, { emissive: 0xffae00, emissiveIntensity: 0.5, roughness: 0.4 });
            road(V.x, V.z - 26, F.x, F.z + 52, 7);                                              // the road
            disc(F.x, F.z, 52, plazaMat, 0.05);                                                 // the arena: a big round cloud
            const arena = new THREE.Group();
            [30, 14].forEach(r => { const t = mesh(new THREE.TorusGeometry(r, 0.5, 6, 64), band); t.rotation.x = Math.PI / 2; t.position.set(0, 0.25, 0); arena.add(t); });
            for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; put(mesh(new THREE.CylinderGeometry(0.5, 0.7, 6, 8), stone), Math.sin(a) * 47, 3, Math.cos(a) * 47, arena); put(mesh(new THREE.SphereGeometry(0.9, 8, 6), gold), Math.sin(a) * 47, 6.4, Math.cos(a) * 47, arena); }   // a ring of posts round the edge
            arena.position.set(F.x, 0, F.z); this.mergeGroup(arena, { flat: true, castShadow: false }); g.add(arena);
            // the great gate at the north edge of the arena
            const gate = new THREE.Group();
            [-1, 1].forEach(sd => { put(mesh(new THREE.CylinderGeometry(1.8, 2.3, 20, 12), stone), sd * 12, 10, 0, gate); put(mesh(new THREE.SphereGeometry(2.5, 12, 8), gold), sd * 12, 20.8, 0, gate); put(mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.7, 12), band), sd * 12, 4, 0, gate); });
            put(mesh(new THREE.TorusGeometry(12, 1.5, 8, 36, Math.PI), stone), 0, 20, 0, gate);
            put(mesh(new THREE.SphereGeometry(2.2, 10, 8), gold), 0, 32.4, 0, gate);
            gate.position.set(F.x, 0, F.z - 46); this.mergeGroup(gate, { flat: true, castShadow: false }); g.add(gate);
            [-1, 1].forEach(sd => this.colliders.push(new THREE.Box3(new THREE.Vector3(F.x + sd * 12 - 2.3, 0, F.z - 46 - 2.3), new THREE.Vector3(F.x + sd * 12 + 2.3, 22, F.z - 46 + 2.3))));
            // the Stairs of Foam: 28 wide steps of bubbly white cloud climbing into the sky
            for (let i = 0; i < 28; i++) {
                const z = F.z - 56 - i * 4.6, y = 1.4 + i * 2.3;
                [-9, -4.5, 0, 4.5, 9].forEach(x => puff(F.x + x, y, z, 4.2, 1.9, 3.3));
                for (let k = 0; k < 3; k++) puff(F.x + (rnd() - 0.5) * 22, y + 1.6 + rnd() * 0.8, z + (rnd() - 0.5) * 3, 0.9 + rnd() * 0.9, 0.9 + rnd() * 0.9, 0.9 + rnd() * 0.9);   // foam bubbles on top
                if (i % 3 === 0) [-1, 1].forEach(sd => puff(F.x + sd * 14, y + 1.2, z, 2.4, 2.4, 2.4));                                       // lumps along the sides
            }
            // the Sun of Time, far up at the top of the stairs (Chapter 5)
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, fog: false });
            const sun = new THREE.Mesh(new THREE.SphereGeometry(34, 28, 20), sunMat); sun.position.set(F.x, 150, F.z - 300); g.add(sun);
            const halo = new THREE.Mesh(new THREE.SphereGeometry(52, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.22, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.copy(sun.position); g.add(halo);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(66, 1.4, 8, 64), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.55, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); ring.position.copy(sun.position); g.add(ring);
            this.sunOfTime = { sun, halo, ring };
            this.buildSignpost(V.x + 11, V.z - 42, ['STAIRS OF FOAM', 'Follow the road north']);
            this.buildSignpost(F.x + 12, F.z + 58, ['STAIRS OF FOAM', 'Guarded by the Sky Guards']);
        }

        // ---- all the cloud puffs, in one draw call ----
        const inst = new THREE.InstancedMesh(sphere, cloudMat, puffs.length), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
        puffs.forEach((p, i) => { m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q0, new THREE.Vector3(p[3], p[4], p[5])); inst.setMatrixAt(i, m4); });
        inst.frustumCulled = false; g.add(inst);

        // ---- signs ----
        this.buildSignpost(C.x + 12, C.z - 128, ['Makani Village', 'Follow the cloud road north']);
        this.buildSignpost(V.x + 11, V.z + 46, ['MAKANI VILLAGE', 'Where the wind lives']);
        if (typeof SideQuests !== 'undefined') SideQuests.init(this);      // the windmill mystery and the missing cat
        if (typeof SkyGuards !== 'undefined') SkyGuards.init(this);        // Stratus and Cirro at the Stairs of Foam
    }

    // The friendly giant cloud that carries you up: a puffy white body with a smiling face and a wispy tail.
    // It faces -z at rest; the passengers sit on its flat, fluffy top (surface at y ~ 1.9).
    buildSkyCloud() {
        const M = (c, e = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, emissive: 0x6f86aa, emissiveIntensity: 0.32 }, e));
        const white = M(0xffffff), tint = M(0xe4efff), shade = M(0xcddcf4), wisp = M(0xf4f8ff, { transparent: true, opacity: 0.78 });
        const pink = new THREE.MeshStandardMaterial({ color: 0xffa8c0, roughness: 0.9, emissive: 0xff8aa8, emissiveIntensity: 0.25 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x1c2a44, roughness: 0.4 }), glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sph = new THREE.SphereGeometry(1, 18, 14), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
        const puffs = [], tail = [], eyes = [];
        const add = (mat, sx, sy, sz, x, y, z, live = true, parent = body) => {
            const m = new THREE.Mesh(sph, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m);
            if (live) puffs.push({ m, sx, sy, sz, ph: Math.random() * 6.28, sp: 1.1 + Math.random() * 0.9 });
            return m;
        };
        add(white, 4.2, 1.9, 7.0, 0, 0, 0, false);                                   // the main body
        for (let i = 0; i < 18; i++) {                                                 // a fluffy rim round the edge (kept low, away from the seat)
            const a = i / 18 * Math.PI * 2, x = Math.sin(a) * 4.0, z = Math.cos(a) * 6.4;
            if (z < -4.2 && Math.abs(x) < 2.9) continue;                               // (leave the face uncovered)
            if (z > 2.2 && Math.abs(x) < 2.6) continue;                                // (and keep the back clear so the riders can be seen)
            const sz = 1.5 + ((i * 7) % 4) * 0.25;
            add(i % 3 ? white : tint, sz, sz * 0.8, sz, x, 0.1 + ((i * 5) % 3) * 0.25, z);
        }
        for (let i = 0; i < 8; i++) add(shade, 2.3, 1.2, 2.3, ((i % 3) - 1) * 2.3, -1.4, (i - 3.5) * 1.9);   // lumpy belly
        [[-3.6, 0.5, -3.2, 1.4], [3.6, 0.5, -3.2, 1.4], [-3.8, 0.35, 4.8, 1.5], [3.8, 0.35, 4.8, 1.5]].forEach(([x, y, z, s2]) => add(tint, s2, s2 * 0.85, s2, x, y, z));
        // the face
        [-1, 1].forEach(sd => {
            const e = add(dark, 0.42, 0.62, 0.3, sd * 1.2, 0.55, -6.55, false); e.userData.sy = 0.62; eyes.push(e);
            add(glint, 0.13, 0.17, 0.1, sd * 1.12, 0.82, -6.82, false);
            add(pink, 0.75, 0.42, 0.25, sd * 2.4, -0.3, -6.1, false);
        });
        const smile = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 8, 18, Math.PI), dark); smile.rotation.z = Math.PI; smile.position.set(0, -0.05, -6.75); body.add(smile);
        // a wispy tail trailing behind
        for (let i = 0; i < 6; i++) { const m = add(wisp, 1.7 - i * 0.22, 0.9 - i * 0.1, 1.7 - i * 0.22, 0, -0.5 - i * 0.1, 8.4 + i * 2.4, false); tail.push({ m, y0: m.position.y }); }
        root.scale.setScalar(1.5);
        root.userData.puffs = puffs; root.userData.tail = tail; root.userData.eyes = eyes;
        root.traverse(o => { if (o.isMesh) o.castShadow = false; });
        this.scene.add(root);
        return root;
    }

    // Puffs breathe, the tail swishes, and now and then it blinks. energy: 0 = calm .. 1.5 = flying.
    animateSkyCloud(c, t, energy = 1) {
        const U = c.userData; if (!U.puffs) return;
        U.puffs.forEach(p => { const k = 1 + Math.sin(t * p.sp + p.ph) * 0.05 * (0.5 + energy * 0.5); p.m.scale.set(p.sx * k, p.sy * (2 - k), p.sz * k); });
        U.tail.forEach((p, i) => { p.m.position.x = Math.sin(t * 2.2 - i * 0.7) * (0.4 + i * 0.3) * (0.4 + energy * 0.6); p.m.position.y = p.y0 + Math.sin(t * 1.6 - i) * 0.22; });
        const blink = (t % 4.2) > 4.06 ? 0.12 : 1;
        U.eyes.forEach(e => { e.scale.y = e.userData.sy * blink; });
    }

    // Park the cloud on the landing pad.
    perchSkyCloud() {
        const b = this.skyCloud || (this.skyCloud = this.buildSkyCloud());
        b.visible = true; b.rotation.set(0, 0, 0);
        b.position.set(SKY.x - 11, 3.4, SKY.z + 95);
        this.animateSkyCloud(b, 0, 0.4);
    }

    // Cutscene step 1 (the Gravity Core is already left): the cloud scoops the party up and hovers high above the earth.
    beginSkyRide() {
        this.skyReached = true;
        const b = this.skyCloud || (this.skyCloud = this.buildSkyCloud());
        b.visible = true;
        this.skyRide = { phase: 'hover', t: 0, clock: 0, T: 17, done: false, prev: null };
        this.applyLook(0, 0, 0, 1);
        Sound.setMood('sky');
        if (this.controls && this.controls.isLocked) this.controls.unlock();
        this.camera.rotation.order = 'YXZ';
        this.updateSkyRide(0);
        this.camera.position.copy(this.skyCamTarget || this.camera.position);
    }

    startSkyFlight() { if (this.skyRide) { this.skyRide.phase = 'flight'; this.skyRide.t = 0; Sound.play('boat'); } }

    updateSkyRide(delta) {
        const R = this.skyRide, b = this.skyCloud;
        if (!R || !b) return;
        const C = SKY, ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
        R.clock += delta;
        const start = new THREE.Vector3(C.x - 90, 130, C.z + 640), end = new THREE.Vector3(C.x - 11, 3.4, C.z + 95);
        let pos, yaw = 0, pitch = 0, bank = 0;
        if (R.phase === 'hover') {
            pos = start.clone(); pos.y += Math.sin(R.clock * 1.2) * 1.2;
            yaw = Math.sin(R.clock * 0.3) * 0.15; bank = Math.sin(R.clock * 0.7) * 0.05;
        } else {
            R.t += delta;
            const u = Math.min(1, R.t / R.T), e = ease(u);
            pos = new THREE.Vector3().lerpVectors(start, end, e);
            pos.y = end.y + (start.y - end.y) * (1 - ease(Math.min(1, u * 1.04))) + Math.sin(R.t * 1.4) * 1.5 * (1 - u);
            pos.x += Math.sin(R.t * 0.8) * 12 * (1 - u) * (1 - u);
            if (R.prev) {
                const d = pos.clone().sub(R.prev);
                if (d.lengthSq() > 1e-8) { yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 1.6; }
            }
            R.yawS = R.yawS === undefined ? yaw : R.yawS + (yaw - R.yawS) * Math.min(1, delta * 3); yaw = R.yawS;
            R.pitchS = R.pitchS === undefined ? pitch : R.pitchS + (pitch - R.pitchS) * Math.min(1, delta * 3); pitch = R.pitchS;
            bank = Math.cos(R.t * 0.8) * 0.18 * (1 - u);
            if (u >= 1 && !R.done) { R.done = true; window.gameSystem.onSkyRideEnd(); }
        }
        R.prev = pos.clone();
        b.position.copy(pos); b.rotation.order = 'YXZ'; b.rotation.set(pitch, yaw, bank);
        this.animateSkyCloud(b, R.clock, R.phase === 'hover' ? 0.6 : 1.5 * (1 - ease((R.t / R.T - 0.9) * 10)));
        b.updateMatrixWorld(true);
        // the passengers ride on its back
        if (this.playerObj) { this.playerObj.position.copy(b.localToWorld(new THREE.Vector3(0, 1.95, -0.5))); this.playerObj.rotation.set(0, yaw + Math.PI, 0); }
        if (this.companionObj) { this.companionObj.position.copy(b.localToWorld(new THREE.Vector3(0, 1.95, 2.6))); this.companionObj.rotation.set(0, yaw + Math.PI, 0); }
        // camera: a slowly swinging view from behind and above (or off to the side while it hovers)
        const off = R.phase === 'hover' ? new THREE.Vector3(16, 5, -24) : new THREE.Vector3(8 + Math.sin(R.clock * 0.5) * 6, 15, 21);
        const ox = off.x * Math.cos(yaw) + off.z * Math.sin(yaw), oz = -off.x * Math.sin(yaw) + off.z * Math.cos(yaw);
        const target = new THREE.Vector3(pos.x + ox, pos.y + off.y, pos.z + oz);
        this.skyCamTarget = target;
        if (R.phase === 'hover' && R.clock === delta) this.camera.position.copy(target); else this.camera.position.lerp(target, 1 - Math.exp(-delta * 4));
        this.camera.lookAt(pos.x - Math.sin(yaw) * 5, pos.y + 1.5, pos.z - Math.cos(yaw) * 5);
    }

    // Cutscene last step: the cloud has landed. Step onto the landing pad of the cloud city.
    finishSkyRide() {
        this.skyRide = null;
        this.skyReached = true; this.desertReached = true;
        this.perchSkyCloud();
        const p = this.playerObj, C = SKY;
        p.position.set(C.x + 3.5, 0.7, C.z + 92); p.rotation.set(0, Math.PI, 0);
        if (this.companionObj) { this.companionObj.position.set(C.x + 7, 0.7, C.z + 94); this.companionObj.rotation.set(0, Math.PI, 0); this.compBaseY = undefined; }
        this.velocityY = 0; this.isJumping = false; this.isGliding = false; this.grounded = true;
        this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(-0.2, 0, 0);
        this.cameraYaw = 0; this.cameraPitch = -0.2;
        this.camera.position.set(C.x + 2, 10, C.z + 108);
        this.applyLook(0, 0, 0, 1);
        Sound.setMood('sky');
        this.updateCulling();
    }

    // =====================================================================================
    //  THE BOAT VOYAGE  (cutscene: board a boat, sail, and get slammed by a hand-shaped wave)
    // =====================================================================================

    setFade(opacity, seconds = 1, color = null) {
        const el = document.getElementById('screen-fade');
        if (!el) return;
        if (color) el.style.background = color;
        el.style.transition = `opacity ${seconds}s ease`;
        el.style.opacity = String(opacity);
    }

    // A giant wave shaped like an open hand: translucent water with foam-capped fingertips.
    buildHandWave() {
        const water = new THREE.MeshStandardMaterial({ color: 0x2f9ed0, transparent: true, opacity: 0.86, roughness: 0.12, metalness: 0.1, emissive: 0x0d4a6a, emissiveIntensity: 0.7, side: THREE.DoubleSide });
        const foam = new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: 0.6, emissive: 0x7fb6c8, emissiveIntensity: 0.35 });
        const hand = new THREE.Group();
        const add = (geo, mat, x, y, z, parent = hand) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
        const cap = (w, h, d) => VoxelBuilder.geometryFor({ shape: 'capsule', size: [w, h, d] });
        // wrist / arm rising out of the sea, and the palm
        add(new THREE.CylinderGeometry(4.6, 7, 46, 18), water, 0, -20, 0);
        const palm = add(new THREE.SphereGeometry(1, 22, 16), water, 0, 7, 0); palm.scale.set(9, 10, 3.8);
        // fingers (two joints each, so they can curl) - pinky, ring, middle, index
        const fingers = [];
        [[-5.6, 12, 0.18], [-1.9, 15, 0.06], [1.9, 14, -0.06], [5.6, 11, -0.16]].forEach(([x, len, spread]) => {
            const a = new THREE.Group(); a.position.set(x, 15, 0); a.rotation.z = spread; hand.add(a);
            add(cap(3.6, len, 3.6), water, 0, len / 2, 0, a);
            const b = new THREE.Group(); b.position.set(0, len, 0); a.add(b);
            add(cap(3.2, len * 0.8, 3.2), water, 0, len * 0.4, 0, b);
            add(new THREE.SphereGeometry(1.7, 10, 8), foam, 0, len * 0.8, 0, b);           // foamy fingertip
            add(new THREE.SphereGeometry(1.5, 10, 8), foam, 0, len * 0.05, 0.6, a);        // foamy knuckle
            fingers.push({ a, b });
        });
        // thumb
        const ta = new THREE.Group(); ta.position.set(8.2, 5, 0); ta.rotation.z = -0.95; hand.add(ta);
        add(cap(4, 11, 4), water, 0, 5.5, 0, ta);
        const tb = new THREE.Group(); tb.position.set(0, 11, 0); ta.add(tb);
        add(cap(3.4, 8, 3.4), water, 0, 4, 0, tb);
        add(new THREE.SphereGeometry(1.8, 10, 8), foam, 0, 8, 0, tb);
        fingers.push({ a: ta, b: tb, thumb: true });
        // flying droplets
        const drops = [];
        for (let i = 0; i < 18; i++) {
            const d = add(new THREE.SphereGeometry(0.5 + Math.random() * 0.6, 7, 6), foam, 0, 0, 0);
            drops.push({ m: d, a: Math.random() * Math.PI * 2, r: 8 + Math.random() * 12, h: Math.random() * 30, s: 0.6 + Math.random() });
        }
        return { group: hand, fingers, drops };
    }

    buildSeaScene() {
        if (this.sea) return this.sea;
        const root = new THREE.Group();
        root.position.set(SEA.x, 0, SEA.z);
        // the open sea
        const wtex = this.getWaterTexture().clone(); wtex.needsUpdate = true; wtex.repeat.set(170, 170);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x2f98c4, map: wtex, roughness: 0.25, metalness: 0.2, emissive: 0x0b3b57, emissiveIntensity: 0.55 }));
        water.rotation.x = -Math.PI / 2; water.position.set(0, -0.35, -400);
        root.add(water);
        // far-off rocky islets for a sense of distance
        const isle = new THREE.MeshStandardMaterial({ color: 0x5f7a6a, roughness: 1, flatShading: true });
        [[-260, -380, 38], [310, -520, 55], [-120, -700, 46], [200, -260, 26], [-420, -150, 34], [60, -900, 70]].forEach(([x, z, r]) => {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), isle); m.scale.y = 0.5; m.position.set(x, r * 0.1, z); root.add(m);
        });
        // wooden dock running back toward the land (+z)
        const wood = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
        const dock = new THREE.Group();
        for (let i = 0; i < 13; i++) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 2.2), wood(i % 2 ? 0x8a5a2b : 0x9a6a36)); p.position.set(0, 0.45, -3 + i * 2.3); dock.add(p);
        }
        for (let i = 0; i < 5; i++) [-4.6, 4.6].forEach(x => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 5, 8), wood(0x5c3b1c)); post.position.set(x, -0.2, -2 + i * 7); dock.add(post); });
        const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa52a, emissiveIntensity: 1 });
        [[-4.4, 2], [4.4, 2], [-4.4, 20], [4.4, 20]].forEach(([x, z]) => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 5, 6), wood(0x4a2f17)); pole.position.set(x, 3, z); dock.add(pole);
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), lampGlow); bulb.position.set(x, 5.8, z); dock.add(bulb);
        });
        [[-2.5, 22], [2.2, 24], [-1, 26]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), wood(0x7a4f26)); c.position.set(x, 1.4, z); dock.add(c); });
        root.add(dock);

        // the boat: a rounded wooden hull, deck, benches, a mast and a sail with a crab painted on it
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9b6430, roughness: 0.85, side: THREE.DoubleSide }));
        hull.scale.set(3.3, 2.0, 7.8); hull.position.y = 0.4; boat.add(hull);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 32), wood(0x5c3b1c)); rim.rotation.x = Math.PI / 2; rim.scale.set(3.3, 7.8, 1); rim.position.y = 0.4; boat.add(rim);
        const deck = new THREE.Mesh(new THREE.CircleGeometry(1, 24), wood(0xb98550)); deck.rotation.x = -Math.PI / 2; deck.scale.set(3.1, 7.5, 1); deck.position.y = -0.25; boat.add(deck);
        [-2.2, 2.6].forEach(z => { const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 1.1), wood(0x7a4f26)); b.position.set(0, 0.35, z); boat.add(b); });
        const prow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 8), wood(0x7a4f26)); prow.rotation.x = -Math.PI / 2; prow.position.set(0, 1.0, -8.6); boat.add(prow);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 8), wood(0x4a2f17)); mast.position.set(0, 5.6, -2.8); boat.add(mast);
        const sc = document.createElement('canvas'); sc.width = 256; sc.height = 320; const x2 = sc.getContext('2d');
        x2.fillStyle = '#f3e7c9'; x2.fillRect(0, 0, 256, 320);
        x2.fillStyle = '#d8c9a0'; for (let i = 0; i < 8; i++) x2.fillRect(0, 20 + i * 40, 256, 3);
        x2.fillStyle = '#d8503f'; x2.beginPath(); x2.ellipse(128, 175, 54, 34, 0, 0, Math.PI * 2); x2.fill();
        [[-1, 1]].forEach(() => [-1, 1].forEach(sd => { x2.beginPath(); x2.arc(128 + sd * 62, 140, 20, 0, Math.PI * 2); x2.fill(); x2.beginPath(); x2.arc(128 + sd * 28, 134, 7, 0, Math.PI * 2); x2.fillStyle = '#fff'; x2.fill(); x2.fillStyle = '#d8503f'; }));
        x2.strokeStyle = '#d8503f'; x2.lineWidth = 6; for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => { x2.beginPath(); x2.moveTo(128 + sd * 44, 190 + i * 10); x2.lineTo(128 + sd * 90, 210 + i * 18); x2.stroke(); });
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 9), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(sc), roughness: 1, side: THREE.DoubleSide }));
        sail.rotation.y = Math.PI / 2; sail.position.set(0, 6.4, -2.8 + 0.2); boat.add(sail);
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lampGlow); lantern.position.set(0, 2.4, -7.2); boat.add(lantern);
        boat.position.set(0, 0.2, -10);
        root.add(boat);

        const hand = this.buildHandWave();
        hand.group.position.set(0, -80, -126);
        root.add(hand.group);
        // a ring of foam on the water around the hand's base
        const ring = new THREE.Mesh(new THREE.RingGeometry(8, 15, 40), new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.1, -126); root.add(ring);

        root.visible = false;
        this.scene.add(root);
        this.sea = { root, water, boat, hand, ring, wtex };
        return this.sea;
    }

    // Cutscene step 1: cut to the dock. The party is aboard; the screen fades in from black.
    beginVoyageScene() {
        const s = this.buildSeaScene();
        s.root.visible = true;
        if (this.controls && this.controls.isLocked) this.controls.unlock();
        this.voyage = { phase: 'dock', t: 0, clock: 0, boatZ: -10, speed: 0, hit: false, crashT: 0, look: 0 };
        this.applyLook(0, 0);
        Sound.setMood('sea'); Sound.play('boat');
        this.setFade(1, 0, '#000000');
        const el = document.getElementById('screen-fade'); if (el) void el.offsetWidth;
        this.setFade(0, 1.6);
        this.updateVoyage(0);
    }

    startSailing() {
        if (!this.voyage) return;
        this.voyage.phase = 'sail'; this.voyage.t = 0;
        Sound.play('boat');
        window.gameSystem.showToast('⛵ Setting sail...');
    }

    updateVoyage(delta) {
        const v = this.voyage, s = this.sea;
        if (!v || !s) return;
        const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
        v.clock += delta;
        if (v.phase === 'sail' || v.phase === 'crash') v.t += delta;
        const t = v.t;
        s.wtex.offset.x += delta * 0.016; s.wtex.offset.y += delta * 0.01;

        // --- the hand-shaped wave: rises out of the sea ahead, hovers, then slams down on the boat ---
        const H = s.hand, hg = H.group;
        const rise = v.phase === 'dock' ? 0 : ease((t - 3.5) / 5);
        const slam = ease((t - 10.4) / 2.7);
        hg.position.y = -80 + 80 * rise;
        hg.scale.setScalar(1.7 * (0.7 + 0.3 * rise));
        hg.rotation.set(slam * 1.4, Math.sin(v.clock * 0.7) * 0.06 * rise, Math.sin(v.clock * 0.9) * 0.04 * rise);
        H.fingers.forEach((f, i) => {
            const idle = Math.sin(v.clock * 1.4 + i) * 0.1 * rise * (1 - slam);
            f.a.rotation.x = idle + slam * (f.thumb ? 0.5 : 1.15);
            f.b.rotation.x = idle * 1.3 + slam * (f.thumb ? 0.7 : 1.4);
        });
        H.drops.forEach(d => {
            d.a += delta * d.s * 0.8; const hh = (d.h + v.clock * 6 * d.s) % 34;
            d.m.position.set(Math.cos(d.a) * d.r, 6 + hh, Math.sin(d.a) * d.r * 0.4 + 2);
            d.m.visible = rise > 0.05 && v.phase !== 'crash';
        });
        s.ring.material.opacity = 0.45 * rise * (1 - slam * 0.5);
        s.ring.scale.setScalar(1 + Math.sin(v.clock * 1.2) * 0.04 + rise * 0.4);

        // --- the boat ---
        if (v.phase === 'sail') v.speed = 6.5 * ease(t / 2.5);
        if (v.phase === 'sail') v.boatZ -= v.speed * delta;
        const rough = 0.04 + rise * 0.08;
        const sink = v.phase === 'crash' ? ease(v.crashT / 1.0) : 0;
        s.boat.position.set(0, 0.2 + Math.sin(v.clock * 1.7) * 0.14 * (1 + rise * 2) - sink * 7, v.boatZ);
        s.boat.rotation.set(Math.sin(v.clock * 0.9) * 0.03 * (1 + rise * 2) + sink * 0.5, 0, Math.sin(v.clock * 1.3) * rough + sink * 0.4);
        s.root.updateMatrixWorld(true);

        // --- the passengers ride along ---
        if (this.playerObj) {
            const wp = s.boat.localToWorld(new THREE.Vector3(0, 0.55, 1.2));
            this.playerObj.position.copy(wp); this.playerObj.rotation.y = Math.PI;
            this.playerObj.rotation.z = s.boat.rotation.z * 0.5;
        }
        if (this.companionObj) {
            const wc = s.boat.localToWorld(new THREE.Vector3(1.5, 0.55, 3.6));
            this.companionObj.position.copy(wc); this.companionObj.rotation.y = Math.PI;
        }

        // --- the mood darkens as the wave rises ---
        v.look = v.phase === 'dock' ? 0 : ease((t - 3.5) / 5) * 0.55 + (v.phase === 'crash' ? 0.35 : 0);
        this.applyLook(Math.min(0.95, v.look), 0);
        if (v.phase === 'sail' && t > 3.5 && !v.eerie) { v.eerie = true; Sound.setMood('ocean'); }

        // --- camera ---
        const bw = s.boat.localToWorld(new THREE.Vector3(0, 2, -3));
        const hw = s.root.localToWorld(new THREE.Vector3(0, 18, -126));
        const far = ease((t - 7.5) / 3);
        const cx = bw.x + 17 + far * 14, cy = bw.y + 7.5 + far * 12, cz = bw.z + 14 + far * 22;
        const orbit = v.phase === 'dock' ? Math.sin(v.clock * 0.35) * 5 : 0;
        const shake = v.phase === 'crash' ? Math.max(0, 1 - v.crashT / 1.2) * 1.4 : 0;
        this.camera.position.set(cx + orbit + (Math.random() - 0.5) * shake, cy + (Math.random() - 0.5) * shake, cz);
        const target = bw.clone().lerp(hw, far * 0.8);
        this.camera.lookAt(target);

        // --- impact! ---
        if (v.phase === 'sail' && t >= 13.1 && !v.hit) {
            v.hit = true; v.phase = 'crash'; v.crashT = 0;
            Sound.play('slam'); Sound.play('gate'); Sound.play('hurt');
            this.setFade(1, 0.05, '#ffffff');
            setTimeout(() => this.setFade(1, 0.7, '#000000'), 140);
        }
        if (v.phase === 'crash') {
            v.crashT += delta;
            if (v.crashT >= 2.0 && !v.done) { v.done = true; window.gameSystem.onVoyageSlam(); }
        }
    }

    // Cutscene last step: the wave has dragged everyone down. Wake up at the start of the Coral Reef.
    finishVoyage() {
        if (this.sea) this.sea.root.visible = false;
        this.voyage = null;
        this.reefReached = true;
        const p = this.playerObj;
        p.position.set(0, 0, REEF_START_Z - 6); p.rotation.set(0, Math.PI, 0);
        if (this.companionObj) { this.companionObj.position.set(3.5, 0, REEF_START_Z - 3); this.companionObj.rotation.set(0, Math.PI, 0); this.compBaseY = undefined; }
        this.velocityY = 0; this.isJumping = false; this.isGliding = false; this.grounded = true;
        this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(-0.2, 0, 0);
        this.cameraYaw = 0; this.cameraPitch = -0.2;
        this.camera.position.set(0, 10, REEF_START_Z + 12);
        this.applyLook(1, 1);
        Sound.setMood('reef');
        this.setFade(0, 2.6, '#000000');
    }

    // --- Input ---------------------------------------------------------------

    bindEvents() {
        document.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key.toLowerCase() === 'e' && !e.repeat) this.tryTalk();   // talk to the villager next to you
        });
        document.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Mouse/touch attack input
        document.addEventListener('mousedown', e => {
            if (!this.isMobile && e.button === 0 && (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'core') && window.combatSystem) {
                window.combatSystem.performPlayerAttack();
            }
        });

    }

    // Turn the camera by a swipe of (dx, dy) pixels (touch screens). Works from whichever way the camera already faces.
    lookBy(dx, dy) {
        const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        e.y -= dx * 0.0055; e.x = THREE.MathUtils.clamp(e.x - dy * 0.0045, -1.2, 1.1); e.z = 0;
        this.camera.quaternion.setFromEuler(e);
    }

    // --- Movement / traversal -------------------------------------------------

    updatePlayer(delta) {
        if (!this.playerObj) return;
        if (window.gameSystem.state !== 'overworld' && window.gameSystem.state !== 'gauntlet') return;

        const player = window.gameSystem.party[0];

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const oldPos = this.playerObj.position.clone();

        if (this.isClimbing) {
            this.updateClimbing(delta, right);
        } else {
            const inLake = this.lakeAt(this.playerObj.position);
            this.isSwimming = !!inLake;
            // Movement is tuned per 60 FPS frame; `k` rescales it by real elapsed time so the game plays at the
            // same speed on a slow laptop (30 FPS) or a fast monitor (144 Hz). Capped at 2 so a hitch can't
            // launch the player through a thin wall.
            const k = Math.min(2, (delta || 1 / 60) * 60);
            this._k = k;
            const speed = (inLake ? 0.45 : 0.8) * k * (1 - 0.6 * (this.qsSink || 0)); // swimming and quicksand slow you down
            let moved = false;
            const st = this.stick, analog = !!(st && st.active);
            if (analog) {   // phone joystick: walk in exactly the direction (and as fast as) the thumb pushes
                const m = Math.min(1, Math.hypot(st.x, st.y)), sc = Math.max(0.3, (m - 0.1) / 0.8);
                this.playerObj.position.addScaledVector(forward, speed * (st.y / (m || 1)) * Math.min(1, sc));
                this.playerObj.position.addScaledVector(right, speed * (st.x / (m || 1)) * Math.min(1, sc));
                moved = true;
            }
            if (!analog && (this.keys['w'] || this.keys['arrowup'])) { this.playerObj.position.addScaledVector(forward, speed); moved = true; }
            if (!analog && (this.keys['s'] || this.keys['arrowdown'])) { this.playerObj.position.addScaledVector(forward, -speed); moved = true; }
            if (!analog && (this.keys['a'] || this.keys['arrowleft'])) { this.playerObj.position.addScaledVector(right, -speed); moved = true; }
            if (!analog && (this.keys['d'] || this.keys['arrowright'])) { this.playerObj.position.addScaledVector(right, speed); moved = true; }

            if (this.isGliding) {
                // Horizontal steering handled above already (normal speed); vertical handled below.
            }

            if (moved) {
                const playerBox = new THREE.Box3();
                playerBox.setFromCenterAndSize(this.playerObj.position, new THREE.Vector3(0.6, 2, 0.6));
                for (let collider of this.colliders) {
                    if (playerBox.intersectsBox(collider)) {
                        if (collider.isHandWaveTrigger) {   // the sea dock: starts the boat voyage
                            if (!this.handWaveTriggered) {
                                this.handWaveTriggered = true;
                                window.gameSystem.triggerBoatVoyage();
                            }
                            break;
                        }
                        if (collider.isDesertEndTrigger) {   // the far side of the dunes (for now: the end of what's built)
                            if (!this.desertEndTriggered) { this.desertEndTriggered = true; window.gameSystem.onDesertEnd(); }
                            break;
                        }
                        if (collider.isArenaTrigger) {      // the end of the reef: Oblongtalo's challenge
                            if (!this.arenaTriggered) {
                                this.arenaTriggered = true;
                                window.gameSystem.triggerOblongtaloEncounter();
                            }
                            break;
                        }
                        if (collider.isCoin) {
                            this.worldGroup.remove(collider.meshGroup);
                            this.colliders = this.colliders.filter(c => c !== collider);
                            this.collectedCoins.push(collider.coinId);
                            window.gameSystem.collectCoin();
                            break;
                        }
                        if (collider.climbable && (this.keys['w'] || this.keys['arrowup'])) {
                            this.enterClimb(collider);
                            this.playerObj.position.copy(oldPos);
                            break;
                        }
                        this.playerObj.position.x = oldPos.x;
                        this.playerObj.position.z = oldPos.z;
                        break;
                    }
                }
            }


            if (inLake) {
                // Swimming/wading: bob gently at the surface, no jumping or falling.
                this.isJumping = false; this.isGliding = false; this.velocityY = 0; this.grounded = true;
                this.playerObj.position.y = Math.sin(Date.now() * 0.004) * 0.12; // gentle bob at water level
            } else {
                // Jump / gravity / gliding
                if (this.keys[' '] && !this.isJumping && this.grounded) {
                    this.velocityY = 1.2; // modest hop (~4 units peak with the gravity below)
                    this.isJumping = true;
                    Sound.play('jump');
                    this.grounded = false;
                }

                if (this.isJumping) {
                    const wantsGlide = this.keys[' '] && this.velocityY < 0 && player.hasGlider;
                    if (wantsGlide) {
                        this.isGliding = true;
                        this.velocityY = -0.35; // slow, controlled descent
                        // steer while gliding
                        if (this.keys['a'] || this.keys['arrowleft']) this.playerObj.position.addScaledVector(right, -0.4 * k);
                        if (this.keys['d'] || this.keys['arrowright']) this.playerObj.position.addScaledVector(right, 0.4 * k);
                        if (this.keys['w'] || this.keys['arrowup']) this.playerObj.position.addScaledVector(forward, 0.5 * k);
                    } else {
                        this.isGliding = false;
                        this.velocityY -= 0.18 * k;
                    }
                    this.playerObj.position.y += this.velocityY * k;
                }

                // The ground isn't always at 0: on the desert dunes it rises. Land on it when falling, and stick to it when walking.
                const gy = this.groundHeight(this.playerObj.position.x, this.playerObj.position.z);
                if (this.playerObj.position.y <= gy) {
                    this.playerObj.position.y = gy;
                    this.velocityY = 0;
                    this.isJumping = false;
                    this.isGliding = false;
                    this.grounded = true;
                } else if (this.grounded && !this.isJumping && this.playerObj.position.y - gy < 3) {
                    this.playerObj.position.y = gy;     // walking downhill: follow the slope down
                } else if (this.grounded && !this.isJumping) {
                    this.isJumping = true; this.grounded = false; this.velocityY = 0;   // stepped off a ledge: fall
                }
            }
        }

        // Keep the player inside the world (the ground ends at x = ±165; the ocean ends past the arena).
        { const p = this.playerObj.position;
          if (this.skyReached) {   // the Sky Kingdom is made of clouds: you can only walk on them (not out into the open sky)
              if (!this.skyWalkable(p.x, p.z)) {
                  if (this.skyWalkable(oldPos.x, p.z)) p.x = oldPos.x;            // slide along the edge
                  else if (this.skyWalkable(p.x, oldPos.z)) p.z = oldPos.z;
                  else { p.x = oldPos.x; p.z = oldPos.z; }
              }
          } else {
          p.x = THREE.MathUtils.clamp(p.x, -160, 160);
          // (once you're in the reef the way back north is closed off: the wave carried you here)
          p.z = THREE.MathUtils.clamp(p.z, this.desertReached ? DESERT_END_Z - 12 : WORLD.arenaZ - 90, this.desertReached ? DESERT_START_Z + 25 : this.reefReached ? REEF_START_Z + 25 : 105); } }

        if (this.quicksand && this.desertReached) this.updateQuicksand(delta);
        this.animatePlayer(delta, oldPos, forward);

        // Stamina/MP regen when not climbing
        if (player) {
            if (!this.isClimbing) player.stamina = Math.min(player.maxStamina, player.stamina + 15 * delta);
            player.mp = Math.min(player.maxMp, player.mp + 3 * delta);
        }

        // Third-person camera that follows behind the player, but automatically pulls in
        // when a wall, tree, or hut would block the view (occlusion handling via ray vs colliders).
        const head = this.playerObj.position.clone();
        head.y += 4;
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const baseDist = 18, lift = 4;
        const ideal = head.clone().addScaledVector(camDir, -baseDist);
        ideal.y += lift;
        const toCam = ideal.clone().sub(head);
        const maxDist = toCam.length();
        const dir = toCam.clone().normalize();
        const ray = new THREE.Ray(head, dir);
        const hitPoint = new THREE.Vector3();
        let nearest = maxDist;
        for (const c of this.colliders) {
            if (c.isTrigger || c.isCoin) continue; // ignore triggers and coin pickups
            if (ray.intersectBox(c, hitPoint)) {
                const d = hitPoint.distanceTo(head);
                if (d < nearest) nearest = d;
            }
        }
        const finalDist = Math.max(3, nearest - 1.2); // small margin so we never poke through the surface
        this.camera.position.copy(head).addScaledVector(dir, finalDist);
        if (this.camera.position.y < 1) this.camera.position.y = 1;
        { const cg = this.groundHeight(this.camera.position.x, this.camera.position.z) + 1.4; if (this.camera.position.y < cg) this.camera.position.y = cg; }

        // Smoothly blend fog/sky as the player crosses into the Ruined Ocean; the Coral Reef is a brighter, bluer-green water.
        const pz = this.playerObj.position.z;
        const t = THREE.MathUtils.clamp((pz - WORLD.oceanBlendStartZ) / (WORLD.oceanFogThresholdZ - WORLD.oceanBlendStartZ), 0, 1);
        const reefIn = THREE.MathUtils.clamp((REEF_START_Z + 30 - pz) / 60, 0, 1);
        const reefOut = THREE.MathUtils.clamp((pz - (REEF_END_Z - 38)) / 40, 0, 1); // the plaza at the far end is dark again
        if (this.skyReached) this.applyLook(0, 0, 0, 1);       // the Sky Kingdom is a bright, airy blue day
        else if (this.desertReached) this.applyLook(0, 0, 1);       // the desert is a bright, hazy, golden day
        else this.applyLook(t, Math.min(reefIn, reefOut));

        this.checkCollisions();
    }

    // Set the fog, sky and lights. t = how "underwater" (0 sunny coast .. 1 deep sea), r = how much of the sunlit reef look.
    applyLook(t, r = 0, d = 0, s = 0) {
        this.oceanFactor = t;
        if (this.scene.fog && this.coastFogColor) {
            this.scene.fog.color.copy(this.coastFogColor).lerp(this.oceanFogColor, t).lerp(this.reefFogColor, r).lerp(this.desertFogColor, d).lerp(this.skyFogColor, s);
            this.scene.fog.near = 100 - t * 88 + r * 42 + d * 30 + s * 40;   // clear nearby, hazy far away; underwater: thick murky water
            this.scene.fog.far = 320 - t * 205 + r * 135 + d * 110 + s * 110;
            this.scene.background.copy(this.coastBgColor).lerp(this.oceanBgColor, t).lerp(this.reefFogColor, r).lerp(this.desertFogColor, d).lerp(this.skyFogColor, s);
        }
        // Sky + lighting follow the same blend: bright sunny coast -> dim, blue-green deep ocean (or the bright reef).
        if (this.skyUniforms) {
            this.skyUniforms.topColor.value.copy(this.coastSkyTop).lerp(this.oceanSkyTop, t).lerp(this.reefSkyTop, r).lerp(this.desertSkyTop, d).lerp(this.skySkyTop, s);
            this.skyUniforms.horizonColor.value.copy(this.coastFogColor).lerp(this.oceanFogColor, t).lerp(this.reefFogColor, r).lerp(this.desertFogColor, d).lerp(this.skyFogColor, s);
            this.skyUniforms.groundColor.value.copy(this.coastFogColor).lerp(this.oceanFogColor, t).lerp(this.reefFogColor, r).lerp(this.desertFogColor, d).lerp(this.skyFogColor, s);
            this.skyUniforms.sunGlow.value = 1 - t;
        }
        if (this.hemiLight) {
            this.hemiLight.intensity = 0.62 - t * 0.28 + r * 0.3 + d * 0.12 + s * 0.22;
            this.hemiLight.color.copy(this.hemiSkyCoast).lerp(this.hemiSkyOcean, t).lerp(this.hemiSkyReef, r).lerp(this.hemiSkyDesert, d).lerp(this.hemiSkyAir, s);
            this.hemiLight.groundColor.copy(this.hemiGroundCoast).lerp(this.hemiGroundOcean, t).lerp(this.hemiGroundReef, r).lerp(this.hemiGroundDesert, d).lerp(this.hemiGroundAir, s);
        }
        if (this.sunLight) {
            this.sunLight.intensity = 1.3 - t * 0.85 + r * 0.55 + d * 0.25 + s * 0.05;
            this.sunLight.color.copy(this.sunCoast).lerp(this.sunOcean, t).lerp(this.sunReef, r).lerp(this.sunDesert, d).lerp(this.sunAir, s);
        }
    }

    enterClimb(collider) {
        this.isClimbing = true;
        this.isJumping = false;
        this.velocityY = 0;
        this.activeClimbCollider = collider;
    }

    exitClimb() {
        this.isClimbing = false;
        this.activeClimbCollider = null;
    }

    updateClimbing(delta, right) {
        const player = window.gameSystem.party[0];
        if (!player || player.stamina <= 0) {
            this.exitClimb();
            return;
        }
        const climbSpeed = 3.2;
        if (this.keys['w'] || this.keys['arrowup']) this.playerObj.position.y += climbSpeed * delta;
        if (this.keys['s'] || this.keys['arrowdown']) this.playerObj.position.y -= climbSpeed * delta;
        if (this.keys['a'] || this.keys['arrowleft']) this.playerObj.position.addScaledVector(right, -climbSpeed * delta);
        if (this.keys['d'] || this.keys['arrowright']) this.playerObj.position.addScaledVector(right, climbSpeed * delta);

        player.stamina = Math.max(0, player.stamina - 20 * delta);

        if (this.playerObj.position.y <= 0) {
            this.playerObj.position.y = 0;
            this.exitClimb();
            return;
        }

        const playerBox = new THREE.Box3();
        playerBox.setFromCenterAndSize(this.playerObj.position, new THREE.Vector3(0.6, 2, 0.6));
        // The player hangs just outside the wall (collision pushed them back), so keep climbing while
        // they're within a margin of it; let go when they pass the top or drift sideways off the wall.
        const keep = this.activeClimbCollider ? this.activeClimbCollider.clone().expandByScalar(1.8) : null;
        const pastTop = this.activeClimbCollider && this.playerObj.position.y > this.activeClimbCollider.max.y + 0.5;
        if (keep && (!playerBox.intersectsBox(keep) || pastTop)) {
            this.exitClimb();
            this.isJumping = true;
            this.velocityY = 0;
        }
    }

    checkCollisions() {
        for (let i = 0; i < this.entities.length; i++) {
            const ent = this.entities[i];
            if (ent.type !== 'shopkeeper' && ent.type !== 'story_npc' && ent.type !== 'treasure' && ent.type !== 'song') continue; // combat entities handled by combatSystem

            const pPos = new THREE.Vector3(this.playerObj.position.x, 0, this.playerObj.position.z);
            const ePos = new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z);
            const dist = pPos.distanceTo(ePos);
            // Chests up on towers need the player to actually be up there (and may have a wider reach).
            if (ent.type === 'treasure' && ent.minY && this.playerObj.position.y < ent.minY) continue;

            if (dist < (ent.radius || 3)) {
                if (ent.type === 'song') {
                    this.scene.remove(ent.mesh);
                    this.entities.splice(i, 1);
                    window.gameSystem.collectFlowSong();
                } else if (ent.type === 'treasure') {
                    Sound.play('chest');
                    window.gameSystem.coins += ent.reward || 25;
                    window.gameSystem.updateHUD();
                    window.gameSystem.showToast(`Hidden treasure! +${ent.reward || 25} coins`);
                    this.scene.remove(ent.mesh);
                    this.entities.splice(i, 1);
                } else if (ent.type === 'shopkeeper') {
                    window.shopSystem.openShop();
                    const camDir = new THREE.Vector3();
                    this.camera.getWorldDirection(camDir);
                    camDir.y = 0; camDir.normalize();
                    this.playerObj.position.addScaledVector(camDir, -3);
                } else if (ent.type === 'story_npc') {
                    window.gameSystem.triggerStoryNPC(ent.storyId);
                    if (ent.oneTime) {
                        this.scene.remove(ent.mesh);
                        this.entities.splice(i, 1);
                    } else {
                        const camDir = new THREE.Vector3();
                        this.camera.getWorldDirection(camDir);
                        camDir.y = 0; camDir.normalize();
                        this.playerObj.position.addScaledVector(camDir, -3);
                    }
                }
                break;
            }
        }
    }

    spawnCompanion(charData) {
        if (this.companionObj) this.scene.remove(this.companionObj);
        this.companionObj = charData.build3D();
        this.companionObj.position.copy(this.playerObj.position);
        this.companionObj.position.x -= 3;
        this.scene.add(this.companionObj);
    }

    // --- Character animation -------------------------------------------------------------

    // Turn the player to face where they're going and pose their limbs for what they're doing.
    animatePlayer(delta, oldPos, forward) {
        const p = this.playerObj.position;
        const hv = Math.hypot(p.x - oldPos.x, p.z - oldPos.z) / Math.max(delta, 1e-4); // horizontal speed (units/sec)
        const now = performance.now() / 1000;
        if (this.isClimbing) Animations.faceYaw(this.playerObj, Math.atan2(forward.x, forward.z), delta, 12);          // face the wall
        else if (now < (this.faceHoldUntil || 0)) Animations.faceYaw(this.playerObj, this.faceYawTarget, delta, 30);  // mid-attack: face the target
        else if (hv > 1.5) Animations.faceYaw(this.playerObj, Math.atan2(p.x - oldPos.x, p.z - oldPos.z), delta, 14); // face the direction of travel
        const swimming = !!this.isSwimming && !this.isClimbing;
        const airborne = !this.grounded && !swimming && !this.isClimbing;
        const landed = this.grounded && !!this._wasAir;
        this._wasAir = airborne;
        // Sounds: landing thud, splash on entering water, and a footstep for every stride.
        if (landed) Sound.play('land');
        if (swimming && !this._wasSwim) Sound.play('splash');
        this._wasSwim = swimming;
        if (!airborne && !this.isClimbing && hv > 1.5 && hv < 75) {
            this._stepDist = (this._stepDist || 0) + hv * delta;
            if (this._stepDist > 6.8) { // one stride (matches the walk animation)
                this._stepDist = 0;
                const z = p.z;
                Sound.step(swimming ? 'water' : this.desertReached ? 'sand' : z < WORLD.oceanStartZ ? 'sand' : z < TEMPLE_FRONT_Z + 14 ? 'stone' : z < TEMPLE_FRONT_Z + 40 ? 'sand' : 'grass');
            }
        }
        const k = this.keys;
        const climbMoving = this.isClimbing && !!(k['w'] || k['s'] || k['a'] || k['d'] || k['arrowup'] || k['arrowdown'] || k['arrowleft'] || k['arrowright']);
        Animations.update(this.playerObj, delta, {
            speed: this.isClimbing ? 0 : hv, airborne, vy: this.velocityY, swimming, climbing: this.isClimbing,
            climbMoving, gliding: this.isGliding, landed, bob: false // (height belongs to the physics code)
        });
    }

    // Everything that should keep animating when the player isn't in control (cutscenes, dialogue, shop, game over).
    updateAmbientLife(delta) {
        if (this.playerObj) Animations.update(this.playerObj, delta, { speed: 0, bob: false });
        if (!this.voyage) this.updateCompanion(delta);   // (on the boat she's placed by the voyage code)
        else if (this.companionObj) Animations.update(this.companionObj, delta, { speed: 0, bob: false });
        this.updateAnimations(delta);
        this.updateCorpses(delta);
        if (window.combatSystem) window.combatSystem.updateFx(delta);
    }

    // Animate villagers, enemies, the boss and Oblongtalo: idle life, walking, wind-ups, looking at you.
    updateAnimations(delta) {
        if (!this.playerObj) return;
        const px = this.playerObj.position.x, pz = this.playerObj.position.z;
        for (const e of this.entities) {
            const m = e.mesh;
            if (!m || !m.visible || e.type === 'treasure' || e.type === 'cat' || e.type === 'clue' || e.type === 'bully' || e.custom) continue;
            const dx = m.position.x - px, dz = m.position.z - pz, d2 = dx * dx + dz * dz;
            if (d2 > 95 * 95) continue; // too far to see the details; save the work
            if (e.type === 'song') { this.animateFlowSong(m, px, pz, delta); continue; }
            const lp = e.lastPos || (e.lastPos = { x: m.position.x, z: m.position.z });
            const speed = Math.hypot(m.position.x - lp.x, m.position.z - lp.z) / Math.max(delta, 1e-4);
            lp.x = m.position.x; lp.z = m.position.z;
            const dist = Math.sqrt(d2);
            const ctx = { speed: speed < 60 ? speed : 0, baseY: (e.hoverY || 0) + (this.desertReached ? this.groundHeight(m.position.x, m.position.z) : 0), camo: !!e.data && e.data.ai === 'snake' && performance.now() / 1000 > ((e.aiState && e.aiState.revealUntil) || 0) };   // (fire fish hover above the seabed)
            if (e.type === 'enemy' || e.type === 'boss') {
                const aggro = dist < (e.data.aggroDist || (e.type === 'boss' ? 45 : 22));
                ctx.aggro = aggro;
                if (aggro || speed > 0.8) Animations.faceToward(m, px, pz, delta, 7);   // keep eyes on you
            } else { // villagers: turn to watch you when you're near, and wave hello
                if (dist < 20) { Animations.faceToward(m, px, pz, delta, 3.5); ctx.lookYaw = Animations.lookYawTo(m, px, pz); }
                ctx.calm = e.storyId === 'barnico';
                ctx.talk = e.type === 'villager' && this.talkingTo === e && window.gameSystem.state === 'dialogue';
                ctx.greet = dist < 13 && (e.storyId === 'barnico' || e.storyId === 'octa_join');
            }
            Animations.update(m, delta, ctx);
        }
        if (this.oblongtaloMesh) {
            Animations.faceToward(this.oblongtaloMesh, px, pz, delta, 3);
            Animations.update(this.oblongtaloMesh, delta, { baseY: 0 });
        }
    }

    // Flow Song sways to its own tune: it turns to look at you, pulses its glow and trails little notes.
    animateFlowSong(g, px, pz, delta) {
        const t = performance.now() / 1000, parts = g.userData.flowParts;
        if (!parts) return;
        Animations.faceToward(g, px, pz, delta, 1.6);
        g.rotation.z = Math.sin(t * 1.7) * 0.09;
        const pulse = 1 + Math.sin(t * 3.2) * 0.12;
        parts.halo.scale.set(7 * pulse, 7 * pulse, 1);
        parts.orbs.forEach((o, i) => {
            const a = t * 1.3 + i * (Math.PI * 2 / 3);
            o.position.set(Math.cos(a) * 3, 1.2 + Math.sin(t * 2 + i * 2) * 0.9, Math.sin(a) * 3);
            o.scale.setScalar(0.8 + Math.sin(t * 4 + i) * 0.25);
        });
    }

    // A defeated creature topples sideways, flushes red, shrinks away and leaves a puff of smoke.
    addCorpse(mesh, big = false) {
        if (!this.corpses) this.corpses = [];
        Animations.die(mesh);
        this.corpses.push({ mesh, t: 0, dur: big ? 2.0 : 0.95, side: Math.random() > 0.5 ? 1 : -1, base: mesh.userData.baseScale || mesh.scale.x || 1, y0: mesh.position.y, big });
    }

    updateCorpses(delta) {
        if (!this.corpses || !this.corpses.length) return;
        for (let i = this.corpses.length - 1; i >= 0; i--) {
            const c = this.corpses[i], m = c.mesh;
            c.t += delta;
            const p = Math.min(1, c.t / c.dur);
            const fall = Math.min(1, p / 0.5), fade = p > 0.55 ? (p - 0.55) / 0.45 : 0;
            m.rotation.z = c.side * (Math.PI / 2) * (fall * fall * (3 - 2 * fall));      // tip over onto its side
            m.position.y = c.y0 > 1.5 ? c.y0 * (1 - 0.85 * fall) : c.y0 - 0.3 * fall;   // hovering fish sink to the seabed
            const s = c.base * (1 - fade * fade); m.scale.setScalar(Math.max(0.001, s));  // then shrink away
            m.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.setHex(0xff2a18); o.material.emissiveIntensity = 0.55 * (1 - fade); } });
            if (p >= 1) {
                this.scene.remove(m);
                if (window.combatSystem) window.combatSystem.spawnPoof(m.position.x, 1.0 * c.base, m.position.z, c.big ? 3 : 1);
                this.corpses.splice(i, 1);
            }
        }
    }

    updateCompanion(delta) {
        if (!this.companionObj || !this.playerObj) return;
        const behind = new THREE.Vector3();
        this.camera.getWorldDirection(behind);
        behind.y = 0; behind.normalize();
        const targetPos = this.playerObj.position.clone().addScaledVector(behind, -4);
        targetPos.x += 2;
        const c = this.companionObj, before = { x: c.position.x, z: c.position.z };
        this.compBaseY = this.compBaseY === undefined ? c.position.y : this.compBaseY + (targetPos.y - this.compBaseY) * Math.min(1, delta * 6);
        c.position.lerp(targetPos, Math.min(1, delta * 3));
        const speed = Math.hypot(c.position.x - before.x, c.position.z - before.z) / Math.max(delta, 1e-4);
        // Octa hops along after you and faces the way she's going (or toward you when she's waiting)
        if (speed > 1.5) Animations.faceYaw(c, Math.atan2(c.position.x - before.x, c.position.z - before.z), delta, 8);
        else Animations.faceToward(c, this.playerObj.position.x, this.playerObj.position.z, delta, 3);
        Animations.update(c, delta, { speed, baseY: this.compBaseY });
    }

    // --- Oblongtalo's Arena entry (called after the hand-wave cutscene) ------

    spawnOblongtalo() {
        const ghost = BOSSES.oblongtalo_ghost.build3D();
        const s = BOSSES.oblongtalo_ghost.scale || 1;
        ghost.scale.set(s, s, s);
        ghost.position.set(this.arenaCenter.x, 0, this.arenaCenter.z - 15);
        this.scene.add(ghost);
        this.oblongtaloMesh = ghost;
        this.playerObj.position.set(this.arenaCenter.x, 0, this.arenaCenter.z + 15);
        return ghost;
    }

    // --- Main loop -------------------------------------------------------------

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const delta = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        this.frame(delta);
    }

    // Draw the scene (unless a test is fast-forwarding the game with this.noRender on).
    draw() { if (!this.noRender) this.renderer.render(this.scene, this.camera); }

    // One step of the game. (animate() calls this every frame; the Test Bot and the tests can call it directly.)
    frame(delta) {
        if (window.AutoPlay && AutoPlay.active) AutoPlay.tick(delta);   // the Test Bot "presses the buttons" for this frame

        if (window.GravityCore && GravityCore.active) {   // boss stage: its own little planet, its own rules
            GravityCore.update(delta);
            this.draw();
            return;
        }

        if (this.kite) {   // Iolana's kite ring race: you're flying, so the walking code sits this one out
            KiteRace.update(delta);
            this.updateAmbientLife(delta);
            this.updateAtmosphere(delta, this.oceanFactor || 0);
            this.draw();
            return;
        }

        if (window.gameSystem.isCutscene) {
            if (this.cutsceneProgress !== undefined) {
                this.cutsceneProgress += 0.005;
                const targetPos = this.playerObj.position.clone();
                targetPos.z += 20;
                targetPos.y += 6;
                this.camera.position.lerp(targetPos, 0.03);
                this.camera.lookAt(this.playerObj.position);
                if (this.cutsceneProgress >= 1.0) {
                    this.cutsceneProgress = undefined;
                    if (this.cutsceneCallback) {
                        const cb = this.cutsceneCallback;
                        this.cutsceneCallback = null;
                        cb();
                    }
                }
            }
            if (this.voyage) this.updateVoyage(delta);
            if (this.skyRide) this.updateSkyRide(delta);
            this.updateAmbientLife(delta);
            this.updateAtmosphere(delta, this.oceanFactor || 0);
            this.draw();
        } else if (window.gameSystem.state === 'dialogue' || window.gameSystem.state === 'shop' || window.gameSystem.state === 'gameover' || window.gameSystem.state === 'choice') {
            // While someone is talking (or you've fallen) the world doesn't freeze: everyone keeps breathing,
            // and hit / death animations finish playing.
            this.updateAmbientLife(delta);
            this.updateAtmosphere(delta, this.oceanFactor || 0);
            this.draw();
        } else if (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'gauntlet') {
            this.updatePlayer(delta);
            this.updateCompanion(delta);
            if (window.combatSystem) window.combatSystem.update(delta);
            this.updateAnimations(delta);
            this.updateCorpses(delta);
            this.updateAtmosphere(delta, this.oceanFactor || 0);

            // Animate opening temple gates dropping into the floor.
            if (this.templeGates) {
                for (const gate of this.templeGates) {
                    if (gate.opening) {
                        gate.group.position.y -= 16 * delta;
                        if (gate.group.position.y <= -16) { gate.opening = false; gate.group.visible = false; }
                    }
                }
            }

            const time = Date.now() * 0.002;
            this.scene.traverse((object) => {
                if (object === this.playerObj || object.userData.rigged) return; // animated characters drive their own motion
                if (object.userData && object.userData.baseY !== undefined) {
                    object.position.y = object.userData.baseY + Math.sin(time * 2 + object.userData.timeOffset) * 0.15;
                }
            });

            this.draw();
        }
    }

    hide() {}
    show() {}

    startCinematicFlyin(onComplete) {
        if (this.controls && this.controls.isLocked) this.controls.unlock();
        this.cutsceneProgress = 0;
        this.cutsceneCallback = onComplete;
        this.camera.position.set(this.playerObj.position.x, 50, this.playerObj.position.z + 50);
        this.camera.lookAt(this.playerObj.position);
    }
}

const overworld3d = new Overworld3D();
