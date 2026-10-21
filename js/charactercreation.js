const STARTER_WEAPONS = {
    magick: { name: 'Spark Bolt', playStyle: 'magick', power: 12, skillType: 'magick', durability: null, maxDurability: null },
    melee: { name: 'Basic Slash', playStyle: 'melee', power: 14, skillType: 'melee', durability: null, maxDurability: null },
    range: { name: 'Quick Shot', playStyle: 'range', power: 12, skillType: 'range', durability: null, maxDurability: null }
};

const SKILL_DESCRIPTIONS = {
    magick: 'Spell-focused. Elemental attacks, time manipulation, arcane abilities.',
    melee: 'Close-range combat. Swords, axes, hammers. High strength and defense.',
    range: 'Long-distance combat. Bows, slings, crossbows. Precision and mobility.'
};

class CharacterCreationSystem {
    constructor() {
        this.ui = document.getElementById('character-creation-ui');
        this.nameInput = document.getElementById('cc-name-input');
        this.bodyColorInput = document.getElementById('cc-body-color');
        this.outfitColorInput = document.getElementById('cc-outfit-color');
        this.confirmBtn = document.getElementById('cc-confirm-btn');
        this.selectedSkillType = 'melee';

        this.ui.querySelectorAll('.cc-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectSkillType(btn.dataset.skill));
        });
        this.selectSkillType('melee');

        this.confirmBtn.addEventListener('click', () => this.confirm());

        // Changing a color updates the little 3D hero right away.
        [this.bodyColorInput, this.outfitColorInput].forEach(inp => inp.addEventListener('input', () => this.rebuildPreview()));

        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.open());
        }
    }

    selectSkillType(skill) {
        this.selectedSkillType = skill;
        this.ui.querySelectorAll('.cc-skill-btn').forEach(btn => {
            btn.classList.toggle('cc-skill-selected', btn.dataset.skill === skill);
        });
        const desc = document.getElementById('cc-skill-desc');
        if (desc) desc.textContent = SKILL_DESCRIPTIONS[skill];
        // Show off the fighting style in the preview (sword swing / bow draw / spell cast).
        if (this.pv && this.pv.model) Animations.attack(this.pv.model, skill === 'range' ? 'range' : skill === 'magick' ? 'magick' : 'melee');
    }

    open() {
        // A new game replaces the saved one the next time the game saves - make sure that's what they want.
        if (window.SaveGame && SaveGame.has() && !window.confirm('You already have a saved game. Starting a new adventure will replace it. Start over?')) return;
        document.getElementById('main-menu').classList.add('hidden');
        this.ui.classList.remove('hidden');
        requestAnimationFrame(() => this.startPreview()); // wait a frame so the box has a size
    }

    // ---- Live 3D preview of the character ----
    startPreview() {
        const host = document.getElementById('cc-preview');
        if (!host || this.pv || typeof THREE === 'undefined') return;
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; } // no preview if WebGL is unavailable
        const w = host.clientWidth || 220, h = host.clientHeight || 240;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xdfeaff, 0x5a6a80, 0.95));
        const sun = new THREE.DirectionalLight(0xfff1d6, 1.1); sun.position.set(4, 8, 6); scene.add(sun);
        const rim = new THREE.DirectionalLight(0x8fb4ff, 0.5); rim.position.set(-5, 3, -6); scene.add(rim);
        const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);

        // A little stage to stand on
        const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x2b3556, roughness: 0.7 }));
        stage.position.y = -0.17; scene.add(stage);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.07, 8, 48), new THREE.MeshStandardMaterial({ color: 0x7fd3ff, emissive: 0x3aa6e0, emissiveIntensity: 0.9 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0; scene.add(ring);

        this.pv = { host, renderer, scene, camera, model: null, yaw: 0.6, last: performance.now(), raf: 0, drag: null };
        this.rebuildPreview();

        // Frame the hero nicely whatever size the model turns out to be
        const box = new THREE.Box3().setFromObject(this.pv.model), size = box.getSize(new THREE.Vector3());
        const dist = (size.y * 0.62) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + 2;
        camera.position.set(0, size.y * 0.58, dist); camera.lookAt(0, size.y * 0.47, 0);

        // Drag to turn
        const el = renderer.domElement;
        el.style.cursor = 'grab';
        el.addEventListener('pointerdown', (e) => { this.pv.drag = { x: e.clientX }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
        el.addEventListener('pointermove', (e) => { if (!this.pv || !this.pv.drag) return; this.pv.yaw += (e.clientX - this.pv.drag.x) * 0.012; this.pv.drag.x = e.clientX; });
        const end = () => { if (this.pv) this.pv.drag = null; el.style.cursor = 'grab'; };
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);

        const loop = () => {
            const pv = this.pv;
            if (!pv) return;
            if (this.ui.classList.contains('hidden')) { pv.raf = 0; return; }
            pv.raf = requestAnimationFrame(loop);
            const now = performance.now(), dt = Math.min(0.05, (now - pv.last) / 1000); pv.last = now;
            if (!pv.drag) pv.yaw += dt * 0.7;                       // slowly turns by itself
            pv.model.rotation.y = pv.yaw;
            Animations.update(pv.model, dt, { speed: 0, bob: false });
            pv.renderer.render(pv.scene, pv.camera);
        };
        loop();
    }

    rebuildPreview() {
        const pv = this.pv;
        if (!pv) return;
        if (pv.model) {
            pv.scene.remove(pv.model);
            pv.model.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        }
        pv.model = VoxelBuilder.buildCharacter(buildPlayerParts({ bodyColor: this.bodyColorInput.value, outfitColor: this.outfitColorInput.value }));
        pv.model.rotation.y = pv.yaw;
        pv.scene.add(pv.model);
    }

    stopPreview() {
        const pv = this.pv;
        if (!pv) return;
        cancelAnimationFrame(pv.raf);
        pv.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        pv.renderer.dispose();
        if (pv.renderer.forceContextLoss) pv.renderer.forceContextLoss();
        if (pv.renderer.domElement.parentNode) pv.renderer.domElement.parentNode.removeChild(pv.renderer.domElement);
        this.pv = null;
    }

    confirm() {
        const name = (this.nameInput.value || 'Traveler').trim().slice(0, 20) || 'Traveler';
        const bodyColor = this.bodyColorInput.value || '#e8b98a';
        const outfitColor = this.outfitColorInput.value || '#3b6ea5';
        const skillType = this.selectedSkillType;
        const weapon = { ...STARTER_WEAPONS[skillType] };

        const player = {
            id: 'player', name, isPlayerCharacter: true,
            skillType,
            appearance: { bodyColor, outfitColor },
            level: 1, exp: 0, expToNext: 50,
            maxHp: 100, hp: 100, maxMp: 50, mp: 50, maxStamina: 100, stamina: 100,
            attack: 14, defense: 10, speed: 5,
            hasGlider: false,
            invincibleUntil: 0,
            defaultWeapon: weapon,
            equippedWeapon: weapon,
            build3D: () => VoxelBuilder.buildCharacter(buildPlayerParts({ bodyColor, outfitColor }))
        };

        this.ui.classList.add('hidden');
        this.stopPreview();
        window.gameSystem.beginAdventure(player);
    }
}

window.addEventListener('load', () => {
    window.characterCreationSystem = new CharacterCreationSystem();
});
