// World layout constants (single seamless world, no scene-swap between chapters).
// Emerald Coast spans z = +40 (spawn) down to the Temple of Crabs (z = -70 entrance .. -116 arena).
// A descent/transition sits around z = -118 to -130.
// Ruined Ocean spans z = -130 down to Oblongtalo's Arena at z = -210.
const WORLD = {
    playerSpawn: { x: 0, z: 30 },
    barnicoPos: { x: 6, z: 14 },
    octaPos: { x: -6, z: 16 },
    shopkeeperPos: { x: 12, z: 24 },
    crotonTempleZ: -132,     // Croton's position, deep in the temple's boss arena
    oceanStartZ: -163,
    handWaveTriggerZ: -178,
    arenaZ: -210,
    oceanFogThresholdZ: -138
};

class Overworld3D {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.92; // a touch under 1 keeps the colors rich instead of bleached
        this.container.appendChild(this.renderer.domElement);

        this.controls = null;

        // Soft sky/ground bounce light + a warm sun with crisp shadows that follows the player.
        this.hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x6f8f4a, 0.62);
        this.scene.add(this.hemiLight);
        this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.15);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        const sc = this.sunLight.shadow.camera;
        sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 320;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.4;
        this.sunOffset = new THREE.Vector3(70, 110, 45);
        this.sunLight.position.copy(this.sunOffset);
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        this.swayers = [];   // plants that sway in the wind: { obj, phase, amp, speed }
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

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.cameraYaw = 0;
        this.cameraPitch = 0;

        this.handWaveTriggered = false;

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
        group.traverse(o => {
            if (!o.isMesh) return;
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
        const mesh = new THREE.Mesh(mg, this[key]);
        mesh.castShadow = opts.castShadow !== false;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
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
            const mobileOverlay = document.getElementById('mobile-controls');
            if (mobileOverlay) mobileOverlay.classList.remove('hidden');
        } else {
            if (!this.controls && typeof THREE.PointerLockControls !== 'undefined') {
                this.controls = new THREE.PointerLockControls(this.camera, document.body);
                document.getElementById('canvas-container').addEventListener('click', () => {
                    if (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'gauntlet') {
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

    buildWorld() {
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

        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0xd3e8ea, 120, 380); // long, soft haze so distant hills/huts melt into the sky
        this.coastFogColor = new THREE.Color(0xd3e8ea);
        this.oceanFogColor = new THREE.Color(0x0d2b3a);
        this.coastBgColor = new THREE.Color(0x87ceeb);
        this.oceanBgColor = new THREE.Color(0x081820);
        this.coastSkyTop = new THREE.Color(0x3f86d6);
        this.oceanSkyTop = new THREE.Color(0x050f1a);
        this.hemiSkyCoast = new THREE.Color(0xcfe8ff);   this.hemiSkyOcean = new THREE.Color(0x4a9fc0);
        this.hemiGroundCoast = new THREE.Color(0x6f8f4a); this.hemiGroundOcean = new THREE.Color(0x1d4a55);
        this.sunCoast = new THREE.Color(0xfff1d6);       this.sunOcean = new THREE.Color(0x6fc8e8);

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
        // Grassy coast: emerald, meadow, yellow-green, olive, deep forest green and patches of bare earth
        makeGround(110, -52, this.makeGroundTexture({
            base: '#3f9a24', light: '#8fd13c', dark: '#26701c', blades: true,
            patches: ['#55b52e', '#1f7a2c', '#a8c93a', '#5f8f26', '#16692f', '#c9ae3c', '#8a6a33', '#2fae4f']
        }));
        // Beach: warm sand with pale shell-white and damp tan patches
        makeGround(-52, -66, this.makeGroundTexture({
            base: '#e0cf9a', light: '#f3e7c0', dark: '#bfa972', blades: false,
            patches: ['#ead9a6', '#d4bd86', '#f1e4c2', '#c9b07a', '#e6c99a']
        }));
        // Ocean floor: deep teal with sandy-silt and murky purple-blue patches
        makeGround(-66, -520, this.makeGroundTexture({
            base: '#1f4a4a', light: '#3d7a74', dark: '#143232', blades: false,
            patches: ['#2a5f5a', '#1b3d4a', '#355a6a', '#4a6a5a', '#2d4a5e', '#5a6a58']
        }));

        this.buildEmeraldCoast();
        this.buildTransition();
        this.buildRuinedOcean();
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
            if (c.isCoin || c.isHandWaveTrigger) continue;
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

        // Interior: wooden floor, rug, bed, table with stools, and a warm lantern
        const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.8 });
        const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0xb08250, roughness: 0.9 }));
        floor.position.y = 0.05;
        floor.receiveShadow = true;
        g.add(floor);
        const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0xb8433a, roughness: 1 }));
        rug.position.y = 0.12;
        g.add(rug);

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
            g.add(stool);
        });

        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa640, emissiveIntensity: 1 }));
        lantern.position.set(0, H - 1, 0);
        g.add(lantern);
        if (withLight) {
            const light = new THREE.PointLight(0xffc070, 0.9, R * 2);
            light.position.set(0, H - 1.5, 0);
            g.add(light);
        }

        furniture.forEach(f => g.add(f));
        this.worldGroup.add(g);
        g.updateMatrixWorld(true);
        furniture.forEach(f => this.addCollider(f, { shrink: 0.2 }));

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
    openGate(gate) {
        if (!gate || gate.opened) return;
        gate.opened = true;
        gate.opening = true;
        this.colliders = this.colliders.filter(c => c !== gate.box);
        if (window.gameSystem && window.gameSystem.showToast) {
            window.gameSystem.showToast('The gate rumbles open!');
        }
    }

    // Called whenever an enemy dies: open any gate whose room is now clear.
    tryOpenGates() {
        if (!this.templeGates) return;
        const liveInRoom = (roomId) => this.entities.some(e => e.type === 'enemy' && e.roomId === roomId && e.data.hp > 0);
        const crotonAlive = this.entities.some(e => e.bossId === 'croton');
        this.templeGates.forEach(gate => {
            if (gate.opened) return;
            if (gate.req === 'boss') { if (!crotonAlive) this.openGate(gate); }
            else if (!liveInRoom(gate.req)) this.openGate(gate);
        });
    }

    // The Temple of Crabs: a multi-room temple you fight through. From the north you climb the
    // steps and pass the portico, then move south through the Entrance Hall and the Pillar Hall
    // (each guarded by crab minions, divided by walls with doorways) before emerging into Croton's
    // open-air boss Arena. Beyond the Arena, an emblem archway leads out toward the Ruined Ocean.
    // All coordinates are world-space Z: FRONT(-70) -> DIV1(-86) -> DIV2(-100) -> BACK(-116).
    buildCrabTemple() {
        const g = new THREE.Group();
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
            const gbox = new THREE.Box3(new THREE.Vector3(-gapHalf, 0, z - 0.6), new THREE.Vector3(gapHalf, h, z + 0.6));
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
        const l1 = new THREE.PointLight(0xffd9a0, 0.85, 62); l1.position.set(0, 11, (FRONT + DIV1) / 2); g.add(l1);
        const l2 = new THREE.PointLight(0xffd9a0, 0.85, 62); l2.position.set(0, 11, (DIV1 + DIV2) / 2); g.add(l2);

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
        this.buildCoastBarrier(FRONT);
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
        this.addCollider(coin, { shrink: -0.3, isCoin: true });
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
            if (Math.hypot(x - WORLD.playerSpawn.x, z - WORLD.playerSpawn.z) < 14) return false;  // keep spawn clear
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
        const inCorridor = (x, z) => Math.abs(x) < 12 && z < 8 && z > -70;   // keep the path to the temple clear
        const inTempleZone = (z) => z < -66;                                  // nothing out here collides with the temple
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
            const minion = ENEMIES.crab_minion.build3D();
            minion.position.set(x, 0, z);
            this.scene.add(minion);
            const roomId = z > -92 ? 'room1' : 'room2';
            this.entities.push({ type: 'enemy', roomId, mesh: minion, data: this.scaleByDifficulty(ENEMIES.crab_minion), aiState: { cooldown: 0, homeX: x, homeZ: z } });
        });
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

        // Invisible trigger volume for the "slammed by a hand-shaped wave" story beat.
        const triggerBox = new THREE.Box3(
            new THREE.Vector3(-30, -2, WORLD.handWaveTriggerZ - 4),
            new THREE.Vector3(30, 6, WORLD.handWaveTriggerZ + 4)
        );
        triggerBox.isHandWaveTrigger = true;
        this.colliders.push(triggerBox);
    }

    buildRuinedOcean() {
        const oStart = WORLD.oceanStartZ, oEnd = WORLD.arenaZ - 30; // the ocean stretches down past the arena
        const rand = (a, b) => a + Math.random() * (b - a);
        const nearArena = (x, z) => Math.hypot(x, z - WORLD.arenaZ) < 30;

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

        // Sea wraiths haunting the ruins
        for (let i = 0; i < 8; i++) {
            const wraith = ENEMIES.sea_wraith.build3D();
            const x = rand(-70, 70), z = oStart - 10 - Math.random() * 90;
            if (nearArena(x, z)) continue;
            wraith.position.set(x, 0, z);
            this.scene.add(wraith);
            this.entities.push({ type: 'enemy', mesh: wraith, data: this.scaleByDifficulty(ENEMIES.sea_wraith), aiState: { cooldown: 0, homeX: x, homeZ: z } });
        }

        // --- Oblongtalo's Arena: a sunken royal plaza (Oblongtalo is summoned later, see main3d) ---
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
        for (let i = 0; i < 6; i++) this.buildGlowJelly(WORLD.arenaZ * 0 + (Math.random() - 0.5) * 36, WORLD.arenaZ + (Math.random() - 0.5) * 36);

        this.arenaCenter = new THREE.Vector3(0, 0, WORLD.arenaZ);
    }

    // --- Input ---------------------------------------------------------------

    bindEvents() {
        document.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Mouse/touch attack input
        document.addEventListener('mousedown', e => {
            if (e.button === 0 && (window.gameSystem.state === 'overworld') && window.combatSystem) {
                window.combatSystem.performPlayerAttack();
            }
        });

        const bindTouchBtn = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys[key] = true; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[key] = false; });
            el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.keys[key] = false; });
        };
        bindTouchBtn('btn-up', 'w');
        bindTouchBtn('btn-down', 's');
        bindTouchBtn('btn-left', 'a');
        bindTouchBtn('btn-right', 'd');
        bindTouchBtn('btn-jump', ' ');
        const btnSwap = document.getElementById('btn-swap');
        if (btnSwap) {
            btnSwap.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.combatSystem) window.combatSystem.performPlayerAttack(); });
        }

        const touchZone = document.getElementById('touch-pad-zone');
        if (touchZone) {
            let lastTouchX = 0, lastTouchY = 0;
            touchZone.addEventListener('touchstart', (e) => {
                if (e.touches.length > 0) { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
            });
            touchZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if ((window.gameSystem.state !== 'overworld' && window.gameSystem.state !== 'gauntlet') || !this.isMobile) return;
                const touchX = e.touches[0].clientX, touchY = e.touches[0].clientY;
                const deltaX = touchX - lastTouchX, deltaY = touchY - lastTouchY;
                this.cameraYaw -= deltaX * 0.005;
                this.cameraPitch -= deltaY * 0.005;
                this.cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y = this.cameraYaw;
                this.camera.rotation.x = this.cameraPitch;
                lastTouchX = touchX; lastTouchY = touchY;
            }, { passive: false });
        }
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
            const speed = inLake ? 0.45 : 0.8; // swimming is slower than walking
            let moved = false;
            if (this.keys['w'] || this.keys['arrowup']) { this.playerObj.position.addScaledVector(forward, speed); moved = true; }
            if (this.keys['s'] || this.keys['arrowdown']) { this.playerObj.position.addScaledVector(forward, -speed); moved = true; }
            if (this.keys['a'] || this.keys['arrowleft']) { this.playerObj.position.addScaledVector(right, -speed); moved = true; }
            if (this.keys['d'] || this.keys['arrowright']) { this.playerObj.position.addScaledVector(right, speed); moved = true; }

            if (this.isGliding) {
                // Horizontal steering handled above already (normal speed); vertical handled below.
            }

            if (moved) {
                const playerBox = new THREE.Box3();
                playerBox.setFromCenterAndSize(this.playerObj.position, new THREE.Vector3(0.6, 2, 0.6));
                for (let collider of this.colliders) {
                    if (playerBox.intersectsBox(collider)) {
                        if (collider.isHandWaveTrigger) {
                            if (!this.handWaveTriggered) {
                                this.handWaveTriggered = true;
                                window.gameSystem.triggerHandWaveEvent();
                            }
                            break;
                        }
                        if (collider.isCoin) {
                            this.worldGroup.remove(collider.meshGroup);
                            this.colliders = this.colliders.filter(c => c !== collider);
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

            this.playerObj.rotation.z = moved ? Math.sin(Date.now() * 0.015) * 0.15 : 0;

            if (inLake) {
                // Swimming/wading: bob gently at the surface, no jumping or falling.
                this.isJumping = false; this.isGliding = false; this.velocityY = 0; this.grounded = true;
                this.playerObj.position.y = Math.sin(Date.now() * 0.004) * 0.12; // gentle bob at water level
            } else {
                // Jump / gravity / gliding
                if (this.keys[' '] && !this.isJumping && this.grounded) {
                    this.velocityY = 1.2; // modest hop (~4 units peak with the gravity below)
                    this.isJumping = true;
                    this.grounded = false;
                }

                if (this.isJumping) {
                    const wantsGlide = this.keys[' '] && this.velocityY < 0 && player.hasGlider;
                    if (wantsGlide) {
                        this.isGliding = true;
                        this.velocityY = -0.35; // slow, controlled descent
                        // steer while gliding
                        if (this.keys['a'] || this.keys['arrowleft']) this.playerObj.position.addScaledVector(right, -0.4);
                        if (this.keys['d'] || this.keys['arrowright']) this.playerObj.position.addScaledVector(right, 0.4);
                        if (this.keys['w'] || this.keys['arrowup']) this.playerObj.position.addScaledVector(forward, 0.5);
                    } else {
                        this.isGliding = false;
                        this.velocityY -= 0.18;
                    }
                    this.playerObj.position.y += this.velocityY;
                }

                if (this.playerObj.position.y <= 0) {
                    this.playerObj.position.y = 0;
                    this.velocityY = 0;
                    this.isJumping = false;
                    this.isGliding = false;
                    this.grounded = true;
                }
            }
        }

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
            if (c.isHandWaveTrigger || c.isCoin) continue; // ignore triggers and coin pickups
            if (ray.intersectBox(c, hitPoint)) {
                const d = hitPoint.distanceTo(head);
                if (d < nearest) nearest = d;
            }
        }
        const finalDist = Math.max(3, nearest - 1.2); // small margin so we never poke through the surface
        this.camera.position.copy(head).addScaledVector(dir, finalDist);
        if (this.camera.position.y < 1) this.camera.position.y = 1;

        // Smoothly blend fog/sky as the player crosses into the Ruined Ocean
        const t = THREE.MathUtils.clamp((this.playerObj.position.z - 0) / (WORLD.oceanFogThresholdZ - 0), 0, 1);
        this.oceanFactor = t;
        if (this.scene.fog && this.coastFogColor) {
            this.scene.fog.color.copy(this.coastFogColor).lerp(this.oceanFogColor, t);
            this.scene.fog.near = 120 - t * 108;   // clear nearby, hazy far away; underwater: thick murky water
            this.scene.fog.far = 380 - t * 265;
            this.scene.background.copy(this.coastBgColor).lerp(this.oceanBgColor, t);
        }
        // Sky + lighting follow the same blend: bright sunny coast -> dim, blue-green deep ocean.
        if (this.skyUniforms) {
            this.skyUniforms.topColor.value.copy(this.coastSkyTop).lerp(this.oceanSkyTop, t);
            this.skyUniforms.horizonColor.value.copy(this.coastFogColor).lerp(this.oceanFogColor, t);
            this.skyUniforms.groundColor.value.copy(this.coastFogColor).lerp(this.oceanFogColor, t);
            this.skyUniforms.sunGlow.value = 1 - t;
        }
        if (this.hemiLight) {
            this.hemiLight.intensity = 0.62 - t * 0.28;
            this.hemiLight.color.copy(this.hemiSkyCoast).lerp(this.hemiSkyOcean, t);
            this.hemiLight.groundColor.copy(this.hemiGroundCoast).lerp(this.hemiGroundOcean, t);
        }
        if (this.sunLight) {
            this.sunLight.intensity = 1.3 - t * 0.85;
            this.sunLight.color.copy(this.sunCoast).lerp(this.sunOcean, t);
        }

        this.checkCollisions();
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
        if (this.activeClimbCollider && !playerBox.intersectsBox(this.activeClimbCollider)) {
            // Climbed off the top (or sideways off) the wall - let them stand/fall normally.
            this.exitClimb();
            this.isJumping = true;
            this.velocityY = 0;
        }
    }

    checkCollisions() {
        for (let i = 0; i < this.entities.length; i++) {
            const ent = this.entities[i];
            if (ent.type !== 'shopkeeper' && ent.type !== 'story_npc' && ent.type !== 'treasure') continue; // combat entities handled by combatSystem

            const pPos = new THREE.Vector3(this.playerObj.position.x, 0, this.playerObj.position.z);
            const ePos = new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z);
            const dist = pPos.distanceTo(ePos);

            if (dist < 3) {
                if (ent.type === 'treasure') {
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

    updateCompanion(delta) {
        if (!this.companionObj || !this.playerObj) return;
        const behind = new THREE.Vector3();
        this.camera.getWorldDirection(behind);
        behind.y = 0; behind.normalize();
        const targetPos = this.playerObj.position.clone().addScaledVector(behind, -4);
        targetPos.x += 2;
        this.companionObj.position.lerp(targetPos, Math.min(1, delta * 3));
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
            this.updateAtmosphere(delta, this.oceanFactor || 0);
            this.renderer.render(this.scene, this.camera);
        } else if (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'gauntlet') {
            this.updatePlayer(delta);
            this.updateCompanion(delta);
            if (window.combatSystem) window.combatSystem.update(delta);
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
                if (object === this.playerObj) return; // player's Y is fully owned by gravity/climb/glide logic
                if (object.userData && object.userData.baseY !== undefined) {
                    object.position.y = object.userData.baseY + Math.sin(time * 2 + object.userData.timeOffset) * 0.15;
                }
            });

            this.renderer.render(this.scene, this.camera);
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
