class Overworld3D {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        
        // Skybox initialized in buildProceduralMap
        
        // Setup Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20); // Initial 3rd person offset

        // Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Setup OrbitControls for mouse look
        // We defer this until window load so THREE.OrbitControls is definitely loaded
        this.controls = null;

        // Lighting
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
        
        // Initialize Procedural Textures
        if (typeof TextureGenerator !== 'undefined') TextureGenerator.init();

        // Create an invisible target for the camera to orbit around
        this.cameraTarget = new THREE.Vector3(0, 5, 0);
        this.colliders = []; // Array of THREE.Box3 for collisions
        this.activePartyIndex = 0;

        // Mobile Device Detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Manual camera look state for mobile
        this.cameraYaw = 0;
        this.cameraPitch = 0;

        this.bindEvents();
    }

    start(party) {
        if (this.isMobile) {
            // Show mobile controls
            const mobileOverlay = document.getElementById('mobile-controls');
            if (mobileOverlay) mobileOverlay.classList.remove('hidden');
        } else {
            // Initialize PointerLockControls here if not already done, ONLY on desktop
            if (!this.controls && typeof THREE.PointerLockControls !== 'undefined') {
                this.controls = new THREE.PointerLockControls(this.camera, document.body);
                
                // Click to lock pointer
                document.getElementById('canvas-container').addEventListener('click', () => {
                    if (window.gameSystem.state === 'overworld') {
                        this.controls.lock();
                    }
                });
            }
        }

        // Build Player
        this.activePartyIndex = 0;
        this.playerObj = party[this.activePartyIndex].build3D();
        this.playerObj.position.set(0, 0, 0);
        this.scene.add(this.playerObj);

        this.buildProceduralMap();
        this.animate();
    }

    buildProceduralMap(worldName = 'mario') {
        if (this.worldGroup) this.scene.remove(this.worldGroup);
        this.worldGroup = new THREE.Group();
        this.scene.add(this.worldGroup);

        // Remove old entities
        this.entities.forEach(ent => {
            if (ent.mesh && ent.mesh.parent) {
                ent.mesh.parent.remove(ent.mesh);
            }
        });
        this.entities = [];

        // Set World Styles
        let floorMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, map: TextureGenerator.grassTexture }); // Mario grass
        let treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x166534, map: TextureGenerator.leafTexture });
        let skyIntensity = 1.0;
        let enemyType = ENEMIES.goomba;
        let bossType = BOSSES.mario_boss;
        let skyAsset = ASSETS.mario_world_bg_1783460841676;
        
        if (worldName === 'minecraft') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, map: TextureGenerator.dirtTexture }); // dirt
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x228b22, map: TextureGenerator.leafTexture }); // minecraft leaves
            enemyType = ENEMIES.zombie; // Zombies in Minecraft!
            bossType = BOSSES.minecraft_boss;
            skyAsset = ASSETS.minecraft_village_bg_1783475064320;
        } else if (worldName === 'pokemon') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, map: TextureGenerator.dirtTexture }); // yellow electric arena
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0xff0000, map: TextureGenerator.leafTexture }); // red trees
            enemyType = ENEMIES.pokemon_enemy;
            bossType = BOSSES.pokemon_boss;
            skyAsset = null;
        } else if (worldName === 'amongus') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, map: TextureGenerator.metalTexture }); // spaceship floor
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, map: TextureGenerator.metalTexture }); // metal structures
            enemyType = ENEMIES.amongus_enemy;
            skyIntensity = 0.3; // dark space
            bossType = BOSSES.amongus_boss;
            skyAsset = null;
        } else if (worldName === 'lost') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 }); // Dark metallic floor
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x444444, map: TextureGenerator.metalTexture }); // Grey structures
            enemyType = ENEMIES.lost_soul; // Spawn Lost Souls
            bossType = BOSSES.lost_boss;
            skyAsset = window.IMG_LOST_BG;
            skyIntensity = 0.5;
        } else if (worldName === 'cuphead') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, map: TextureGenerator.dirtTexture }); // Sepia/Vintage paper color
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown structures
            enemyType = ENEMIES.cuphead_minion;
            bossType = BOSSES.cuphead_boss;
            skyAsset = null;
            skyIntensity = 0.9;
        } else if (worldName === 'magic') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, map: TextureGenerator.stoneTexture }); // Dark mystical stone
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x4a148c }); // Purple magical trees
            enemyType = ENEMIES.death_eater;
            bossType = BOSSES.magic_boss;
            skyAsset = null;
            skyIntensity = 0.4;
        } else if (worldName === 'animation') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.8 }); // white grid floor
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x00a8ff }); // blue digital structures
            enemyType = ENEMIES.animation_enemy;
            bossType = BOSSES.animation_boss;
            skyAsset = ASSETS.animation_dimension_bg;
        } else if (worldName === 'sonic') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.grassTexture }); // Checkered style grass
            treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.leafTexture });
            enemyType = ENEMIES.sonic_enemy;
            bossType = BOSSES.sonic_boss;
            skyAsset = ASSETS.sonic_bg;
        } else if (worldName === 'bonus') {
            floorMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.3, roughness: 0.6 }); // Gold floor, not black
            skyIntensity = 0.8; // Brighter
            skyAsset = null;
        }

        this.scene.backgroundIntensity = skyIntensity;
        
        if (skyAsset) {
            const textureLoader = new THREE.TextureLoader();
            const skyTexture = textureLoader.load(skyAsset);
            skyTexture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = skyTexture;
            this.scene.environment = skyTexture;
        } else if (worldName === 'tutorial') {
            this.scene.background = new THREE.Color(0xffffff); // White void
        } else {
            this.scene.background = new THREE.Color(worldName === 'amongus' ? 0x000000 : 0x87ceeb);
        }
        
        // Add Fog for atmosphere
        let fogColor = 0x87CEEB;
        if (worldName === 'tutorial') fogColor = 0xffffff;
        if (worldName === 'minecraft') fogColor = 0x5c4033;
        if (worldName === 'pokemon') fogColor = 0xfacc15;
        if (worldName === 'amongus' || worldName === 'lost') fogColor = 0x000000;
        if (worldName === 'animation') fogColor = 0x00a8ff;
        if (worldName === 'sonic') fogColor = 0x4dd0e1; // Light cyan sky blue
        if (worldName === 'cuphead') fogColor = 0xd2b48c; // Sepia fog
        if (worldName === 'magic') fogColor = 0x1a237e; // Dark blue/purple fog
        if (worldName === 'bonus') fogColor = 0xffd700;
        this.scene.fog = new THREE.Fog(fogColor, 20, 150);

        // Ground Plane
        const floorGeo = new THREE.PlaneGeometry(500, 500);
        
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.worldGroup.add(floor);
        this.colliders = [];

        // Procedural Scenery Generation
        for (let i = 0; i < 200; i++) {
            const tx = (Math.random() - 0.5) * 400;
            const tz = (Math.random() - 0.5) * 400;
            if (Math.abs(tx) < 20 && Math.abs(tz) < 20) continue; // keep clearing

            const objGroup = new THREE.Group();
            let isPipe = false;
            let isExitPipe = false;
            let isCoin = false;
            
            if (worldName === 'bonus') {
                if (i === 0) { // Only one exit pipe
                    const pipeGeo = new THREE.CylinderGeometry(2, 2, 6);
                    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.metalTexture });
                    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
                    pipe.position.y = 3;
                    objGroup.add(pipe);
                    isExitPipe = true;
                } else if (Math.random() > 0.5) {
                    // Golden coins/blocks
                    const coinGeo = new THREE.CylinderGeometry(2, 2, 0.5);
                    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffa500, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.2 });
                    const coin = new THREE.Mesh(coinGeo, coinMat);
                    coin.position.y = 2;
                    coin.rotation.x = Math.PI / 2;
                    objGroup.add(coin);
                    isCoin = true;
                }
            } else if (worldName === 'mario') {
                if (Math.random() > 0.97) {
                    // Warp Pipe (3% chance)
                    const pipeGeo = new THREE.CylinderGeometry(2, 2, 6);
                    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.metalTexture });
                    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
                    pipe.position.y = 3;
                    pipe.castShadow = true;
                    objGroup.add(pipe);
                    const rimGeo = new THREE.CylinderGeometry(2.3, 2.3, 1);
                    const rim = new THREE.Mesh(rimGeo, pipeMat);
                    rim.position.y = 6.5;
                    rim.castShadow = true;
                    objGroup.add(rim);
                    isPipe = true;
                } else if (Math.random() > 0.6) {
                    // Floating Brick
                    const brickGeo = new THREE.BoxGeometry(3, 3, 3);
                    const brickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, map: TextureGenerator.brickTexture });
                    const brick = new THREE.Mesh(brickGeo, brickMat);
                    brick.position.y = 8 + Math.random() * 5;
                    brick.castShadow = true;
                    objGroup.add(brick);
                } else {
                    // Standard Tree
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x78350f, map: TextureGenerator.woodTexture }));
                    trunk.position.y = 2;
                    trunk.castShadow = true;
                    objGroup.add(trunk);
                    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), treeLeavesMat);
                    leaves.position.y = 6;
                    leaves.castShadow = true;
                    objGroup.add(leaves);
                }
                // Add Smooth Cone Grass Clusters to Mario World
                if (Math.random() > 0.5) {
                    const grassGeo = new THREE.ConeGeometry(0.3, 2, 5);
                    const grassMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.leafTexture });
                    for(let j=0; j<8; j++) {
                        const grass = new THREE.Mesh(grassGeo, grassMat);
                        grass.position.set((Math.random()-0.5)*4, 1, (Math.random()-0.5)*4);
                        grass.rotation.x = (Math.random()-0.5)*0.5;
                        grass.rotation.z = (Math.random()-0.5)*0.5;
                        objGroup.add(grass);
                    }
                }
            } else if (worldName === 'minecraft') {
                if (Math.random() > 0.9) {
                    // Hut
                    const wallGeo = new THREE.BoxGeometry(10, 8, 10);
                    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, map: TextureGenerator.woodTexture });
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.y = 4;
                    wall.castShadow = true;
                    objGroup.add(wall);
                    const roofGeo = new THREE.ConeGeometry(8, 5, 4);
                    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, map: TextureGenerator.woodTexture });
                    const roof = new THREE.Mesh(roofGeo, roofMat);
                    roof.position.y = 10.5;
                    roof.rotation.y = Math.PI / 4;
                    roof.castShadow = true;
                    objGroup.add(roof);
                } else {
                    // Minecraft Blocky Tree
                    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), new THREE.MeshStandardMaterial({ color: 0x5c4033, map: TextureGenerator.woodTexture }));
                    trunk.position.y = 2.5;
                    trunk.castShadow = true;
                    objGroup.add(trunk);
                    const leaves = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), treeLeavesMat);
                    leaves.position.y = 6;
                    leaves.castShadow = true;
                    objGroup.add(leaves);
                }
            } else if (worldName === 'pokemon') {
                // Tall Grass Patches
                const grassGeo = new THREE.ConeGeometry(0.3, 3, 5);
                const grassMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.leafTexture });
                for(let j=0; j<8; j++) {
                    const grass = new THREE.Mesh(grassGeo, grassMat);
                    grass.position.set((Math.random()-0.5)*4, 1.5, (Math.random()-0.5)*4);
                    grass.rotation.x = (Math.random()-0.5)*0.5;
                    grass.rotation.z = (Math.random()-0.5)*0.5;
                    objGroup.add(grass);
                }
            } else if (worldName === 'amongus') {
                // Spaceship Crates & Corridors
                const crateGeo = new THREE.BoxGeometry(4, 4, 4);
                const crateMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2, map: TextureGenerator.metalTexture });
                const crate = new THREE.Mesh(crateGeo, crateMat);
                crate.position.y = 2;
                crate.castShadow = true;
                objGroup.add(crate);
            } else if (worldName === 'sonic') {
                if (Math.random() > 0.8) {
                    // Palm tree
                    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 6);
                    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, map: TextureGenerator.woodTexture });
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.y = 3;
                    objGroup.add(trunk);
                    
                    const leafGeo = new THREE.ConeGeometry(3, 1.5, 4);
                    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, map: TextureGenerator.leafTexture });
                    const leaves = new THREE.Mesh(leafGeo, leafMat);
                    leaves.position.y = 6.5;
                    leaves.rotation.x = Math.PI; // upside down cone for palm look
                    objGroup.add(leaves);
                } else if (Math.random() > 0.5) {
                    // Loop-de-loop decoration (Torus)
                    const loopGeo = new THREE.TorusGeometry(3, 0.5, 8, 20);
                    const loopMat = new THREE.MeshStandardMaterial({ color: 0x964B00, map: TextureGenerator.brickTexture });
                    const loop = new THREE.Mesh(loopGeo, loopMat);
                    loop.position.y = 3;
                    loop.rotation.y = Math.random() * Math.PI;
                    objGroup.add(loop);
                }
            }

            // Global Coin Spawns (except in bonus where they spawn above)
            if (worldName !== 'bonus' && Math.random() > 0.95) {
                const coinGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.4);
                const coinMat = new THREE.MeshStandardMaterial({ color: 0xffea00, emissive: 0xffa500, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.2 });
                const coin = new THREE.Mesh(coinGeo, coinMat);
                coin.position.set(0, 2, 0); // Local to objGroup
                coin.rotation.x = Math.PI / 2;
                objGroup.add(coin);
                isCoin = true;
            }

            objGroup.position.set(tx, 0, tz);
            const scale = 0.5 + Math.random() * 1.5;
            objGroup.scale.set(scale, scale, scale);
            this.worldGroup.add(objGroup);
            
            // Add Bounding Box for Collision
            const box = new THREE.Box3().setFromObject(objGroup);
            // Slightly reduce box size to make movement forgiving
            box.expandByScalar(-0.5); 
            if (isPipe) box.isPipe = true;
            if (isExitPipe) box.isExitPipe = true;
            if (isCoin) box.isCoin = true;
            
            // Add a reference to the group so we can remove it later
            box.meshGroup = objGroup;
            
            this.colliders.push(box);
        }

        // Spawn Enemies and Shopkeeper (Don't spawn in bonus room)
        if (worldName === 'tutorial') {
            // Only spawn the hologoomba
            const holo = ENEMIES.hologoomba.build3D();
            holo.position.set(0, 1, -15);
            this.scene.add(holo);
            this.entities.push({ 
                type: 'enemy', 
                mesh: holo,
                data: JSON.parse(JSON.stringify(ENEMIES.hologoomba)) 
            });
        } else if (worldName !== 'bonus') {
            
            // Spawn 3 Distinct Shops
            const shopTypes = ['wizard_shop', 'sword_shop', 'armor_shop'];
            const shopPositions = [
                {x: -20, z: -20}, // Wizard
                {x: 20, z: -20},  // Sword
                {x: -20, z: 20}   // Armor
            ];
            
            for (let i = 0; i < 3; i++) {
                const sType = shopTypes[i];
                if (SHOPKEEPERS[sType]) {
                    const shopkeeper = SHOPKEEPERS[sType](worldName);
                    shopkeeper.position.set(shopPositions[i].x, 1.5, shopPositions[i].z);
                    this.scene.add(shopkeeper);
                    
                    this.entities.push({ 
                        type: 'shopkeeper',
                        shopType: sType,
                        mesh: shopkeeper
                    });
                }
            }
            
            // Physical Bounty Board next to the Armor Shop
            const bbGeo = new THREE.BoxGeometry(4, 3, 0.5);
            const bbMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, map: TextureGenerator.woodTexture });
            const bbMesh = new THREE.Mesh(bbGeo, bbMat);
            bbMesh.position.set(-15, 2, 20); // Near Armor shop
            bbMesh.castShadow = true;
            this.scene.add(bbMesh);
            this.entities.push({
                type: 'bounty_board',
                mesh: bbMesh
            });
            const bbCol = new THREE.Box3().setFromObject(bbMesh);
            bbCol.expandByScalar(2); // Interact radius
            bbCol.meshGroup = bbMesh;
            bbCol.isBountyBoard = true;
            this.colliders.push(bbCol);

            for (let i = 0; i < 15; i++) {
                const enemy = enemyType.build3D();
                let ex = 0, ez = 0;
                do {
                    ex = (Math.random() - 0.5) * 200;
                    ez = (Math.random() - 0.5) * 200;
                } while (Math.abs(ex) < 30 && Math.abs(ez) < 30); // Keep away from spawn
                
                enemy.position.set(ex, 1, ez);
                this.scene.add(enemy);
                this.entities.push({ 
                    type: 'enemy', 
                    mesh: enemy,
                    data: JSON.parse(JSON.stringify(enemyType)) 
                });
            }

            // Spawn Boss (Far away)
            const boss = bossType.build3D();
            boss.scale.set(3, 3, 3);
            boss.position.set(0, 0, -80);
            this.scene.add(boss);
            this.entities.push({ 
                type: 'boss', 
                mesh: boss,
                data: JSON.parse(JSON.stringify(bossType)) 
            });
        }
    }

    bindEvents() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.swapCharacter();
            }
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('mousemove', () => {
            if (this.controls && this.controls.isLocked && window.gameSystem.state === 'overworld') {
                window.gameSystem.advanceTutorial('look');
            }
        });

        document.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Mobile Touch Events
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
            btnSwap.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.swapCharacter();
            });
        }

        // Camera Pan (Drag to look)
        const touchZone = document.getElementById('touch-pad-zone');
        if (touchZone) {
            let lastTouchX = 0;
            let lastTouchY = 0;
            touchZone.addEventListener('touchstart', (e) => {
                if(e.touches.length > 0) {
                    lastTouchX = e.touches[0].clientX;
                    lastTouchY = e.touches[0].clientY;
                }
            });
            touchZone.addEventListener('touchmove', (e) => {
                e.preventDefault(); // Prevent scrolling
                if (window.gameSystem.state !== 'overworld' || !this.isMobile) return;
                
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const deltaX = touchX - lastTouchX;
                const deltaY = touchY - lastTouchY;
                
                if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                    window.gameSystem.advanceTutorial('look');
                }
                
                // Sensitivity
                this.cameraYaw -= deltaX * 0.005;
                this.cameraPitch -= deltaY * 0.005;
                
                // Clamp pitch
                this.cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));
                
                // Apply rotation
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y = this.cameraYaw;
                this.camera.rotation.x = this.cameraPitch;
                
                lastTouchX = touchX;
                lastTouchY = touchY;
            }, { passive: false });
        }
    }

    swapCharacter() {
        if (!window.gameSystem || !window.gameSystem.party) return;
        
        const pos = this.playerObj.position.clone();
        this.scene.remove(this.playerObj);
        
        this.activePartyIndex = (this.activePartyIndex + 1) % window.gameSystem.party.length;
        this.playerObj = window.gameSystem.party[this.activePartyIndex].build3D();
        this.playerObj.position.copy(pos);
        this.scene.add(this.playerObj);
        
        // Show message
        const charName = window.gameSystem.party[this.activePartyIndex].name;
        window.gameSystem.showDialogue('System', `Swapped to ${charName}!`);
    }

    updatePlayer() {
        if (!this.playerObj || window.gameSystem.state !== 'overworld') return;

        const speed = 0.8;
        
        // Calculate forward/right vectors based on where the camera is looking
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement on the horizontal plane
        if (forward.lengthSq() < 0.001) {
            forward.set(0, 0, -1); // Fallback to avoid NaN crash
        }
        forward.normalize();
        
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        let moved = false;
        const oldPos = this.playerObj.position.clone();

        if (this.keys['w'] || this.keys['arrowup']) {
            this.playerObj.position.addScaledVector(forward, speed);
            moved = true;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.playerObj.position.addScaledVector(forward, -speed);
            moved = true;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.playerObj.position.addScaledVector(right, -speed);
            moved = true;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.playerObj.position.addScaledVector(right, speed);
            moved = true;
        }

        if (moved) {
            window.gameSystem.advanceTutorial('move');
        }

        // Check Collisions
        if (moved) {
            // Create a small bounding box for the player
            const playerBox = new THREE.Box3();
            playerBox.setFromCenterAndSize(this.playerObj.position, new THREE.Vector3(0.5, 2, 0.5));
            
            for (let collider of this.colliders) {
                if (playerBox.intersectsBox(collider)) {
                    if (collider.isPipe) {
                        window.gameSystem.enterBonusLevel();
                        break;
                    }
                    if (collider.isExitPipe) {
                        window.gameSystem.exitBonusLevel();
                        break;
                    }
                    if (collider.isCoin) {
                        // Collect coin
                        this.worldGroup.remove(collider.meshGroup);
                        this.colliders = this.colliders.filter(c => c !== collider);
                        window.gameSystem.collectCoin();
                        break;
                    }
                    if (collider.isBountyBoard) {
                        window.bountySystem.openBountyBoard();
                        // Bounce player back so they don't get stuck
                        this.playerObj.position.x = oldPos.x - forward.x * 2;
                        this.playerObj.position.z = oldPos.z - forward.z * 2;
                        break;
                    }
                    // Revert horizontal movement but keep vertical (for jumping onto things if needed, though simple block here)
                    this.playerObj.position.x = oldPos.x;
                    this.playerObj.position.z = oldPos.z;
                    break;
                }
            }
        }

        // Walk animation
        if (moved) {
            const walkTime = Date.now() * 0.015;
            this.playerObj.rotation.z = Math.sin(walkTime) * 0.15; // Waddle
        } else {
            this.playerObj.rotation.z = 0;
        }

        // Jumping Logic
        if (this.keys[' '] && !this.isJumping) {
            this.velocityY = 2.5; // Increased jump height
            this.isJumping = true;
            window.gameSystem.advanceTutorial('jump');
        }

        // Apply gravity and update Y
        if (this.isJumping) {
            this.velocityY -= 0.15; // Gravity
            this.playerObj.position.y += this.velocityY;
        }

        // Floor Collision
        if (this.playerObj.position.y <= 0) {
            this.playerObj.position.y = 0;
            this.velocityY = 0;
            this.isJumping = false;
            
            // Slide animation (hop) ONLY when grounded
            if (moved) {
                this.playerObj.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 1.5;
            }
        }

        // Update Camera Position to trail the player in 3rd person
        const trailDistance = 20;
        const heightOffset = 6;
        
        // The camera's forward direction is determined by PointerLockControls
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        
        // Place camera behind the player
        this.camera.position.copy(this.playerObj.position);
        this.camera.position.addScaledVector(camDir, -trailDistance);
        this.camera.position.y += heightOffset;
        
        // Prevent camera from clipping through the floor
        if (this.camera.position.y < 1) {
            this.camera.position.y = 1;
        }

        this.checkCollisions();
    }

    checkCollisions() {
        // Distance check for enemies
        for (let i = 0; i < this.entities.length; i++) {
            const ent = this.entities[i];
            
            // Use distance from the base
            const pPos = new THREE.Vector3(this.playerObj.position.x, 0, this.playerObj.position.z);
            const ePos = new THREE.Vector3(ent.mesh.position.x, 0, ent.mesh.position.z);
            
            const dist = pPos.distanceTo(ePos);
            
            // Boss has a larger hitbox due to scale
            const hitDist = ent.type === 'boss' ? 6 : 2;
            const aggroDist = ent.type === 'boss' ? 50 : 35; // Increased aggro radius
            
            if (dist < hitDist) { // Hit!
                if (ent.type === 'shopkeeper') {
                    // Open Shop based on shopType
                    window.shopSystem.openShop(ent.shopType);
                    
                    // Bounce player back so it doesn't instantly retrigger when closing
                    const camDir = new THREE.Vector3();
                    this.camera.getWorldDirection(camDir);
                    camDir.y = 0;
                    camDir.normalize();
                    this.playerObj.position.addScaledVector(camDir, -3);
                } else {
                    this.scene.remove(ent.mesh);
                    this.entities.splice(i, 1);
                    
                    if (ent.type === 'enemy') {
                        window.gameSystem.triggerEncounter(false, ent.data);
                    } else if (ent.type === 'boss') {
                        window.gameSystem.triggerEncounter(true, ent.data);
                    }
                }
                break;
            } else if (ent.type !== 'shopkeeper' && dist < aggroDist) {
                // Aggro! Move towards player faster
                const speed = ent.type === 'boss' ? 0.6 : 0.3;
                const dir = new THREE.Vector3().subVectors(pPos, ePos).normalize();
                ent.mesh.position.addScaledVector(dir, speed);
                
                // Aggro run animation (wobble fast)
                if (ent.mesh.children.length > 1) { // assuming index 1 is pivot
                    const time = Date.now() * 0.03;
                    ent.mesh.children[1].rotation.z = Math.sin(time) * 0.3; 
                }
            } else {
                // Idle animation (reset rotation)
                if (ent.mesh.children.length > 1) {
                    ent.mesh.children[1].rotation.z = 0;
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (window.gameSystem.isCutscene) {
            if (this.cutsceneProgress !== undefined) {
                this.cutsceneProgress += 0.005; // Adjust for fly-in speed
                
                // Target camera position (behind player)
                const targetPos = this.playerObj.position.clone();
                targetPos.z += 20;
                targetPos.y += 6;
                
                // Lerp towards target position and look at player
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
        } else if (window.gameSystem.state === 'overworld') {
            this.updatePlayer();
            
            // Update Billboards
            const time = Date.now() * 0.002;
            this.scene.traverse((object) => {
                if (object.name === "billboard") {
                    const targetPos = new THREE.Vector3(this.camera.position.x, object.position.y, this.camera.position.z);
                    object.lookAt(targetPos);
                    
                    if (object.parent && object.parent.userData && object.parent.userData.baseY !== undefined) {
                        const data = object.parent.userData;
                        // Bobbing effect
                        object.position.y = Math.sin(time * 2 + data.randomOffset) * 0.5;
                    }
                }
            });

            this.renderer.render(this.scene, this.camera);
        }
    }

    hide() {
        // DO NOT set display none! Combat needs the same canvas!
    }

    show() {
        // Container remains visible always.
    }

    spawnHoloGoomba() {
        const holoGoomba = ENEMIES.goomba.build3D();
        
        // Calculate position 15 units in front of the player
        const forward = new THREE.Vector3(0, 0, -1);
        if (this.playerObj) {
            const playerPos = this.playerObj.position.clone();
            holoGoomba.position.set(playerPos.x, 1, playerPos.z - 15);
        } else {
            holoGoomba.position.set(0, 1, -15);
        }
        
        // Make it holographic (cyan wireframe)
        holoGoomba.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.6,
                    wireframe: true
                });
            }
        });

        this.scene.add(holoGoomba);
        
        const data = JSON.parse(JSON.stringify(ENEMIES.goomba));
        data.name = 'Holo-Goomba';
        
        this.entities.push({ 
            type: 'enemy', 
            mesh: holoGoomba,
            data: data
        });
    }

    startCinematicFlyin(onComplete) {
        if (this.controls && this.controls.isLocked) {
            this.controls.unlock();
        }
        this.cutsceneProgress = 0;
        this.cutsceneCallback = onComplete;
        
        // Start camera high up in the sky, looking down
        this.camera.position.set(0, 50, 50);
        this.camera.lookAt(0, 0, 0);
    }
}

const overworld3d = new Overworld3D();
