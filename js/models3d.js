class BillboardBuilder {
    static buildBillboard(imageUrl) {
        const group = new THREE.Group();

        // Use a CanvasTexture so we can remove the background
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const texture = new THREE.CanvasTexture(canvas);
        
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            
            // Sample top-left corner as the background color
            const bgR = data[0], bgG = data[1], bgB = data[2];
            const tolerance = 40; // Tolerance for JPG artifacts
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                if (Math.abs(r - bgR) < tolerance && 
                    Math.abs(g - bgG) < tolerance && 
                    Math.abs(b - bgB) < tolerance) {
                    data[i+3] = 0; // Make transparent
                }
            }
            ctx.putImageData(imgData, 0, 0);
            texture.needsUpdate = true;
        };
        img.src = imageUrl;
        
        const planeGeo = new THREE.PlaneGeometry(5, 5);
        const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.1 // Prevents depth sorting issues for true transparency
        });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.castShadow = true;
        
        // Offset so the bottom of the plane touches the ground (Y=0)
        planeMesh.position.y = 2.5; 
        
        // Wrap plane in a pivot group so it can always face camera easily
        const pivot = new THREE.Group();
        pivot.add(planeMesh);
        pivot.name = "billboard"; // Tag it for the render loop to auto-rotate
        
        // Add a simple drop shadow blob
        const shadowGeo = new THREE.CircleGeometry(2, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.01; // Slightly above ground
        
        group.add(shadowMesh);
        group.add(pivot);

        // Store reference for animations
        group.userData = {
            baseY: group.position.y,
            randomOffset: Math.random() * Math.PI * 2,
            pivot: pivot
        };

        return group;
    }
}

// 3D Definitions using BillboardBuilder
const CHARACTERS = {
    glitch: {
        id: 'glitch', name: 'Glitch', level: 1, exp: 0, expToNext: 50, maxHp: 100, hp: 100, maxMp: 50, mp: 50, attack: 15, defense: 10, speed: 12,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.glitch_portrait),
        abilities: [{ name: 'Basic Attack', type: 'attack', power: 1, cost: 0 }]
    },
    mario: {
        id: 'mario', name: 'Speedrunner Mario', level: 1, exp: 0, expToNext: 50, maxHp: 80, hp: 80, maxMp: 30, mp: 30, attack: 12, defense: 8, speed: 25,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.new_mario_portrait),
        abilities: [
            { name: 'BLJ', type: 'attack', power: 1.5, cost: 5, description: 'Backwards Long Jump. High damage.' },
            { name: 'Frame Perfect', type: 'buff', stat: 'speed', amount: 10, cost: 10 }
        ]
    },
    steve: {
        id: 'steve', name: 'Steve', level: 1, exp: 0, expToNext: 50, maxHp: 120, hp: 120, maxMp: 20, mp: 20, attack: 18, defense: 15, speed: 8,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.steve_portrait_1783460827842),
        abilities: [
            { name: 'Diamond Sword', type: 'attack', power: 1.8, cost: 0 },
            { name: 'Eat Steak', type: 'heal', power: 40, cost: 5 }
        ]
    },
    second_coming: {
        id: 'second_coming', name: 'The Second Coming', level: 1, exp: 0, expToNext: 50, maxHp: 90, hp: 90, maxMp: 15, mp: 15, attack: 18, defense: 8, speed: 20,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.second_coming_portrait),
        abilities: [{ name: 'Basic Attack', type: 'attack', power: 1, cost: 0 }]
    },
    neckedfear: {
        id: 'neckedfear', name: 'Necked Fear', level: 1, exp: 0, expToNext: 50, maxHp: 110, hp: 110, maxMp: 30, mp: 30, attack: 22, defense: 12, speed: 15,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.neckedfear_portrait),
        abilities: [
            { name: 'Basic Attack', type: 'attack', power: 1, cost: 0 },
            { name: 'Neck Coil', type: 'debuff', stat: 'attack', amount: 5, cost: 10, description: 'Weakens the enemy attack.' },
            { name: 'Fire Aglore', type: 'attack', target: 'all', power: 1.2, cost: 15, description: 'Fires fireballs to all enemies.' }
        ]
    },
    blong: {
        id: 'blong', name: 'Oblongplot (Blong)', level: 1, exp: 0, expToNext: 50, maxHp: 130, hp: 130, maxMp: 25, mp: 25, attack: 20, defense: 18, speed: 10,
        build3D: () => BillboardBuilder.buildBillboard(window.IMG_BLONG || ASSETS.shopkeeper_villager),
        abilities: [{ name: 'Emerald Slash', type: 'attack', power: 1.6, cost: 5 }]
    },
    ash: {
        id: 'ash', name: 'Ash Ketchum', level: 1, exp: 0, expToNext: 50, maxHp: 100, hp: 100, maxMp: 80, mp: 80, attack: 15, defense: 10, speed: 20,
        build3D: () => BillboardBuilder.buildBillboard(window.IMG_ASH || ASSETS.glitch_portrait),
        abilities: [{ name: 'Pokeball Throw', type: 'attack', power: 1.8, cost: 10 }]
    },
    sonic_char: {
        id: 'sonic_char', name: 'Sonic', level: 1, exp: 0, expToNext: 50, maxHp: 80, hp: 80, maxMp: 50, mp: 50, attack: 14, defense: 8, speed: 45,
        build3D: () => BillboardBuilder.buildBillboard(window.IMG_SONIC || ASSETS.glitch_portrait),
        abilities: [{ name: 'Spin Dash', type: 'attack', power: 2.0, cost: 15 }]
    },
    imposter_char: {
        id: 'imposter_char', name: 'Friendly Imposter', level: 1, exp: 0, expToNext: 50, maxHp: 120, hp: 120, maxMp: 40, mp: 40, attack: 24, defense: 12, speed: 18,
        build3D: () => BillboardBuilder.buildBillboard(window.IMG_IMPOSTER || ASSETS.imposter_portrait),
        abilities: [{ name: 'Vent Sneak', type: 'buff', stat: 'speed', amount: 20, cost: 10 }]
    }
};

const ENEMIES = {
    goomba: {
        id: 'goomba', name: 'Goomba', maxHp: 60, hp: 60, attack: 15, defense: 10, speed: 10, xpReward: 15,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.goomba_portrait_1783460848607)
    },
    zombie: {
        id: 'zombie', name: 'Minecraft Zombie', maxHp: 100, hp: 100, attack: 22, defense: 15, speed: 6, xpReward: 25,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.mc_zombie_portrait_1783475077081)
    },
    pokemon_enemy: {
        id: 'pokemon_enemy', name: 'Electric Mouse', maxHp: 150, hp: 150, attack: 35, defense: 20, speed: 18, xpReward: 45,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.pokemon_enemy_portrait)
    },
    amongus_enemy: {
        id: 'amongus_enemy', name: 'Sus Crewmate', maxHp: 220, hp: 220, attack: 45, defense: 30, speed: 12, xpReward: 60,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.amongus_enemy_portrait)
    },
    animation_enemy: {
        id: 'animation_enemy', name: 'Agent', maxHp: 300, hp: 300, attack: 60, defense: 40, speed: 25, xpReward: 80,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.agent_portrait)
    },
    sonic_enemy: {
        id: 'sonic_enemy', name: 'Motobug', maxHp: 400, hp: 400, attack: 80, defense: 50, speed: 60, xpReward: 100,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.motobug_portrait)
    },
    hologoomba: {
        id: 'hologoomba', name: 'Hologoomba', maxHp: 10, hp: 10, attack: 2, defense: 1, speed: 1, xpReward: 5, isHologram: true,
        build3D: () => {
            const mesh = BillboardBuilder.buildBillboard(ASSETS.goomba_portrait_1783460848607);
            mesh.children.forEach(c => {
                if (c.name === "billboard" && c.children[0]) {
                    c.children[0].material.color.setHex(0x00ffff);
                    c.children[0].material.opacity = 0.5;
                }
            });
            return mesh;
        }
    }
};

const BOSSES = {
    mario_boss: {
        id: 'corrupted_bowser', name: 'Corrupted Bowser', maxHp: 250, hp: 250, attack: 45, defense: 25, speed: 20, isBoss: true, xpReward: 150,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.bowser_boss_portrait_1783460855874)
    },
    minecraft_boss: {
        id: 'ender_dragon', name: 'Ender Dragon', maxHp: 400, hp: 400, attack: 60, defense: 35, speed: 30, isBoss: true, xpReward: 300,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.ender_dragon_portrait_1783475082776)
    },
    pokemon_boss: {
        id: 'armored_mewtwo', name: 'Armored Mewtwo', maxHp: 800, hp: 800, attack: 90, defense: 50, speed: 45, isBoss: true, xpReward: 600,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.mewtwo_portrait_1783475095568)
    },
    lost_boss: {
        id: 'cuphead_devil', name: 'Cuphead Devil', maxHp: 1500, hp: 1500, attack: 120, defense: 60, speed: 50, isBoss: true, xpReward: 1000,
        build3D: () => BillboardBuilder.buildBillboard(window.IMG_DEVIL || ASSETS.glitch_portrait)
    },
    amongus_boss: {
        id: 'supreme_imposter', name: 'Supreme Imposter', maxHp: 900, hp: 900, attack: 110, defense: 70, speed: 55, isBoss: true, xpReward: 800,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.imposter_portrait_1783475273071)
    },
    animation_boss: {
        id: 'dark_lord', name: 'The Dark Lord', maxHp: 1500, hp: 1500, attack: 150, defense: 100, speed: 70, isBoss: true, xpReward: 1500,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.dark_lord_portrait)
    },
    sonic_boss: {
        id: 'dr_eggman', name: 'Dr. Eggman', maxHp: 2500, hp: 2500, attack: 200, defense: 140, speed: 90, isBoss: true, xpReward: 3000,
        build3D: () => BillboardBuilder.buildBillboard(ASSETS.eggman_portrait)
    }
};

const UNLOCKABLE_ABILITIES = {
    mario: { name: 'Fireball', type: 'attack', power: 1.5, cost: 10, description: 'Throw a bouncing fireball.' },
    pokemon: { name: 'Charizard Breath', type: 'attack', power: 2.5, cost: 20, description: 'Breathe massive fire.' },
    minecraft: { name: 'Place Blocks', type: 'defense', power: 0, cost: 15, description: 'Increases defense by placing a wall.' },
    amongus: { name: 'Shapeshifter', type: 'special', cost: 25, description: 'Copy an enemy attack.' },
    sonic: { name: 'Spin Dash', type: 'attack', power: 3.0, cost: 30, description: 'A high-speed rolling attack.' }
};

window.SHOPKEEPER_ART = {
    mario: { wizard: window.IMG_WIZARD_TOAD || ASSETS.shopkeeper_toad, sword: window.IMG_SWORD_TOAD || ASSETS.shopkeeper_toad, armor: window.IMG_ARMOR_TOAD || ASSETS.shopkeeper_toad },
    minecraft: { wizard: window.IMG_WIZARD_VILLAGER || ASSETS.shopkeeper_villager, sword: window.IMG_SWORD_VILLAGER || ASSETS.shopkeeper_villager, armor: window.IMG_ARMOR_VILLAGER || ASSETS.shopkeeper_villager },
    pokemon: { wizard: window.IMG_WIZARD_JOY || ASSETS.shopkeeper_nurse_joy, sword: window.IMG_SWORD_JOY || ASSETS.shopkeeper_nurse_joy, armor: window.IMG_ARMOR_JOY || ASSETS.shopkeeper_nurse_joy },
    amongus: { wizard: window.IMG_WIZARD_HOST || ASSETS.shopkeeper_host, sword: window.IMG_SWORD_HOST || ASSETS.shopkeeper_host, armor: window.IMG_ARMOR_HOST || ASSETS.shopkeeper_host },
    animation: { wizard: window.IMG_WIZARD_BLUE || ASSETS.shopkeeper_blue, sword: window.IMG_SWORD_BLUE || ASSETS.shopkeeper_blue, armor: window.IMG_ARMOR_BLUE || ASSETS.shopkeeper_blue },
    sonic: { wizard: window.IMG_WIZARD_TAILS || ASSETS.tails_portrait, sword: window.IMG_SWORD_TAILS || ASSETS.tails_portrait, armor: window.IMG_ARMOR_TAILS || ASSETS.tails_portrait }
};

const SHOPKEEPERS = {
    wizard_shop: (w) => BillboardBuilder.buildBillboard(window.SHOPKEEPER_ART[w]?.wizard || ASSETS.shopkeeper_toad),
    sword_shop: (w) => BillboardBuilder.buildBillboard(window.SHOPKEEPER_ART[w]?.sword || ASSETS.shopkeeper_toad),
    armor_shop: (w) => BillboardBuilder.buildBillboard(window.SHOPKEEPER_ART[w]?.armor || ASSETS.shopkeeper_toad)
};

const LEVEL_ABILITIES = {
    mario: {
        2: { name: 'Super Jump Punch', type: 'attack', power: 2.0, cost: 12, description: 'A devastating uppercut!' },
        3: { name: 'Star Invincibility', type: 'buff', stat: 'defense', amount: 50, cost: 20, description: 'Huge defense boost.' }
    },
    steve: {
        2: { name: 'Bow & Arrow', type: 'attack', power: 1.6, cost: 8, description: 'Ranged attack.' },
        3: { name: 'TNT Explosion', type: 'attack', power: 3.5, cost: 30, description: 'Massive damage!' }
    },
    neckedfear: {
        5: { name: 'Fly', type: 'status', status: 'invincible', cost: 20, description: 'Become invincible for the next enemy turn!' }
    }
};
