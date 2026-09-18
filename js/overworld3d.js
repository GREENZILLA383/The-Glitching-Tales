// World layout constants (single seamless world, no scene-swap between chapters).
// Emerald Coast spans roughly z = +40 (spawn) down to z = -95 (Croton's temple).
// A descent/transition sits around z = -95 to -115.
// Ruined Ocean spans z = -115 down to Oblongtalo's Arena at z = -210.
const WORLD = {
    playerSpawn: { x: 0, z: 30 },
    barnicoPos: { x: 6, z: 14 },
    octaPos: { x: -6, z: 16 },
    shopkeeperPos: { x: 12, z: 24 },
    crotonTempleZ: -90,
    oceanStartZ: -115,
    handWaveTriggerZ: -130,
    arenaZ: -210,
    oceanFogThresholdZ: -100
};

class Overworld3D {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = null;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

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

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.cameraYaw = 0;
        this.cameraPitch = 0;

        this.handWaveTriggered = false;

        this.bindEvents();
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

        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 20, 180);
        this.coastFogColor = new THREE.Color(0x9fd8e8);
        this.oceanFogColor = new THREE.Color(0x0d2b3a);
        this.coastBgColor = new THREE.Color(0x87ceeb);
        this.oceanBgColor = new THREE.Color(0x081820);

        // ---- One big ground plane spanning both zones ----
        const floorGeo = new THREE.PlaneGeometry(300, 700, 1, 1);
        const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
        const colors = [];
        const posAttr = floorGeo.attributes.position;
        const sandColor = new THREE.Color(0xe8d9a0);
        const oceanFloorColor = new THREE.Color(0x1f3d3a);
        for (let i = 0; i < posAttr.count; i++) {
            // plane is built in XY before rotation; local Y maps to world Z after rotation
            const localY = posAttr.getY(i);
            const worldZ = -localY; // rotated -90 about X below, flips sign
            const t = THREE.MathUtils.clamp((worldZ - (-40)) / (WORLD.oceanStartZ - (-40)), 0, 1);
            const c = sandColor.clone().lerp(oceanFloorColor, t);
            colors.push(c.r, c.g, c.b);
        }
        floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, -155); // center the 700-long plane over both zones
        floor.receiveShadow = true;
        this.worldGroup.add(floor);

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

    buildHut(x, z) {
        const g = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 4, 10), new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.9 }));
        wall.position.y = 2;
        wall.castShadow = true;
        g.add(wall);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a3a }));
        roof.position.y = 5.5;
        roof.castShadow = true;
        g.add(roof);
        this.addProp(g, x, z, { shrink: 0.5 });
    }

    buildPalmTree(x, z) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x8b6b3f }));
        trunk.position.y = 3;
        g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }));
        leaves.position.y = 6.5;
        leaves.rotation.x = Math.PI;
        g.add(leaves);
        this.addProp(g, x, z, { shrink: 1.2 });
    }

    buildCrabRock(x, z) {
        const g = new THREE.Group();
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1 }));
        rock.position.y = 1.5;
        g.add(rock);
        this.addProp(g, x, z, { shrink: 0.8 });
    }

    buildTempleWall(x, z, climbable = true) {
        const g = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 2), new THREE.MeshStandardMaterial({ color: 0x9a8b6f, roughness: 0.9 }));
        wall.position.y = 6;
        wall.castShadow = true;
        g.add(wall);
        g.position.set(x, 0, z);
        this.worldGroup.add(g);
        this.addCollider(g, { shrink: 0.3, climbable });
    }

    buildCoralTower(x, z) {
        const g = new THREE.Group();
        const segCount = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < segCount; i++) {
            const w = 3.5 - i * 0.7;
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.6, 2.5, 7),
                new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x3f6b6a : 0x2c4d4c, roughness: 1 }));
            seg.position.y = 1.25 + i * 2.5;
            seg.rotation.y = Math.random() * Math.PI;
            g.add(seg);
        }
        this.addProp(g, x, z, { shrink: 0.5 });
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
        // Octo Village huts
        [[-14, 8], [16, 6], [-10, 22], [4, -6]].forEach(([x, z]) => this.buildHut(x, z));

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

        // Palm trees + crab rocks scattered along the coast
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 120;
            const z = 30 - Math.random() * 60;
            if (Math.abs(x) < 12 && z > 0) continue; // keep village clearing
            if (Math.random() > 0.5) this.buildPalmTree(x, z); else this.buildCrabRock(x, z);
        }

        // Path toward the temple, more crab rocks
        for (let i = 0; i < 14; i++) {
            const x = (Math.random() - 0.5) * 60;
            const z = -20 - Math.random() * 60;
            this.buildCrabRock(x, z);
        }

        // A few coins to collect
        for (let i = 0; i < 10; i++) {
            this.buildCoin((Math.random() - 0.5) * 80, 20 - Math.random() * 100);
        }

        // Croton's Temple: climbable flanking walls + Croton himself + crab minions
        this.buildTempleWall(-14, WORLD.crotonTempleZ - 5);
        this.buildTempleWall(14, WORLD.crotonTempleZ - 5);

        const croton = BOSSES.croton.build3D();
        const s = BOSSES.croton.scale || 1;
        croton.scale.set(s, s, s);
        croton.position.set(0, 0, WORLD.crotonTempleZ);
        this.scene.add(croton);
        this.entities.push({ type: 'boss', bossId: 'croton', mesh: croton, data: this.scaleByDifficulty(BOSSES.croton), aiState: { cooldown: 0 } });

        for (let i = 0; i < 5; i++) {
            const minion = ENEMIES.crab_minion.build3D();
            const x = (Math.random() - 0.5) * 50;
            const z = -25 - Math.random() * 55;
            minion.position.set(x, 0, z);
            this.scene.add(minion);
            this.entities.push({ type: 'enemy', mesh: minion, data: this.scaleByDifficulty(ENEMIES.crab_minion), aiState: { cooldown: 0, homeX: x, homeZ: z } });
        }
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
        for (let i = 0; i < 18; i++) {
            const x = (Math.random() - 0.5) * 90;
            const z = WORLD.oceanStartZ - Math.random() * 80;
            this.buildCoralTower(x, z);
        }

        for (let i = 0; i < 6; i++) {
            const wraith = ENEMIES.sea_wraith.build3D();
            const x = (Math.random() - 0.5) * 70;
            const z = WORLD.oceanStartZ - 10 - Math.random() * 70;
            wraith.position.set(x, 0, z);
            this.scene.add(wraith);
            this.entities.push({ type: 'enemy', mesh: wraith, data: this.scaleByDifficulty(ENEMIES.sea_wraith), aiState: { cooldown: 0, homeX: x, homeZ: z } });
        }

        // Oblongtalo's Arena: ring of pillars + oval floor accent. Oblongtalo himself is NOT
        // spawned here - he's summoned directly by triggerHandWaveEvent's aftermath (see main3d.js).
        const arenaGroup = new THREE.Group();
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a5a5a, roughness: 0.9 });
        const pillarCount = 10;
        for (let i = 0; i < pillarCount; i++) {
            const angle = (i / pillarCount) * Math.PI * 2;
            const px = Math.cos(angle) * 22;
            const pz = Math.sin(angle) * 22;
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 10, 8), pillarMat);
            pillar.position.set(px, 5, pz);
            arenaGroup.add(pillar);
        }
        const floorAccent = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.4, 24),
            new THREE.MeshStandardMaterial({ color: 0x2c4d4c, roughness: 1 }));
        floorAccent.position.y = 0.05;
        arenaGroup.add(floorAccent);
        arenaGroup.position.set(0, 0, WORLD.arenaZ);
        this.worldGroup.add(arenaGroup);
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
            const speed = 0.8;
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

            // Jump / gravity / gliding
            if (this.keys[' '] && !this.isJumping && this.grounded) {
                this.velocityY = 2.6;
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
                    this.velocityY -= 0.15;
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

        // Stamina/MP regen when not climbing
        if (player) {
            if (!this.isClimbing) player.stamina = Math.min(player.maxStamina, player.stamina + 15 * delta);
            player.mp = Math.min(player.maxMp, player.mp + 3 * delta);
        }

        // Camera follow
        const trailDistance = 20;
        const heightOffset = 6;
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        this.camera.position.copy(this.playerObj.position);
        this.camera.position.addScaledVector(camDir, -trailDistance);
        this.camera.position.y += heightOffset;
        if (this.camera.position.y < 1) this.camera.position.y = 1;

        // Smoothly blend fog/sky as the player crosses into the Ruined Ocean
        const t = THREE.MathUtils.clamp((this.playerObj.position.z - 0) / (WORLD.oceanFogThresholdZ - 0), 0, 1);
        if (this.scene.fog && this.coastFogColor) {
            this.scene.fog.color.copy(this.coastFogColor).lerp(this.oceanFogColor, t);
            this.scene.background.copy(this.coastBgColor).lerp(this.oceanBgColor, t);
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
            if (ent.type !== 'shopkeeper' && ent.type !== 'story_npc') continue; // combat entities are handled by combatSystem

            const pPos = new THREE.Vector3(this.playerObj.position.x, 0, this.playerObj.position.z);
            const ePos = new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z);
            const dist = pPos.distanceTo(ePos);

            if (dist < 3) {
                if (ent.type === 'shopkeeper') {
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
            this.renderer.render(this.scene, this.camera);
        } else if (window.gameSystem.state === 'overworld' || window.gameSystem.state === 'gauntlet') {
            this.updatePlayer(delta);
            this.updateCompanion(delta);
            if (window.combatSystem) window.combatSystem.update(delta);

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
