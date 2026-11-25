// THE SKY GUARDS of the Stairs of Foam: STRATUS the calm and CIRRO the quick.
//
// North of Makani Village a long cloud road leads to a round arena at the foot of the Stairs of Foam, which climb toward the
// Sun of Time (Chapter 5). The Sky Guards block the way. To get past you need the Cloud Stair Pass (sold by Cashato). But the guards
// think anyone who shows up with a pass must have made it themselves - so you have to fight them!
//
// They are eagles with arms instead of wings, in police uniforms (a tag team). Their fight, in two phases:
//   PHASE 1  They CHARGE at you with their spears in an X formation and a + formation (red lanes show where they will come through:
//            step out of the lanes before they go!).
//   PHASE 2  (below half health) They JUMP into the air and SLAM down on the spots marked on the ground with their spears,
//            and every slam sends a shockwave ring across the floor (jump it!). Now and then they charge again, faster.
// If one guard is knocked out the other fights on, angrier. Defeat both and the Stairs of Foam open.
//
// The numbers (health, damage, speeds) are all in the CONFIG block just below.
const SkyGuards = (() => {
    const CONFIG = {
        hp: 360,                       // each guard's health (scaled by the difficulty setting)
        damage: { charge: 20, slam: 26, ring: 12 },
        arenaR: 50,
        laneLen: 36,                   // a charge covers 2 x this
        windup: [1.5, 1.0],            // seconds of warning before a charge: phase 1, phase 2
        chargeSpeed: [88, 112],
        reward: 500                    // XP
    };

    // ---------------------------------------------------------------- what they say
    const TEXT = {
        noPass: [['Stratus, the Calm', 'Halt, traveler. The Stairs of Foam are closed to everyone who does not carry a Cloud Stair Pass.'],
                 ['Cirro, the Quick', 'Nobody. Gets. Past. Us. Nobody! Not without a pass!'],
                 ['Stratus, the Calm', 'I hear the trader in Makani Village sells such things. If you can afford one.']],
        withPass: [['Stratus, the Calm', 'Hm? You carry a Cloud Stair Pass? Let me see.'],
                   ['Stratus, the Calm', '...The seal is crooked, and the ink is still wet.'],
                   ['Cirro, the Quick', 'YOU MADE THIS YOURSELF! A fake! A FAKE!'],
                   ['Stratus, the Calm', 'No forged pass climbs the Stairs of Foam. I am sorry, traveler. We must stop you.'],
                   ['Cirro, the Quick', 'We are the Sky Guards! I am Cirro, the quick!'],
                   ['Stratus, the Calm', 'And I am Stratus, the calm. Prepare yourself.']],
        phase2: ['The guards are furious! They are leaping into the sky!'],
        victory: [['Cirro, the Quick', 'Ow... ow ow ow... How can a FAKE hit so hard?!'],
                  ['Stratus, the Calm', '...Cirro. Look at the seal. It is glowing.'],
                  ['Cirro, the Quick', 'Glowing? ...It is REAL?! Oh no. We hit the hero with spears. Many times.'],
                  ['Stratus, the Calm', 'Forgive us, traveler. The Stairs of Foam are yours to climb. Beyond them waits the Sun of Time.'],
                  ['Cirro, the Quick', 'Go on! Go! Quickly! ...Sorry about the spears!']],
        done: ['Stratus: The Stairs of Foam are open to you, hero. Walk through the gate, and go.', 'Cirro: Still sorry about the spears! Good luck up there!'],
        ascend: 'You climb the Stairs of Foam, higher and higher, toward a sun that holds all of time inside it...'
    };

    let ow = null, A = { x: 0, z: 0 }, guards = [], barrier = null, fxGroup = null, G = null, T = 0, ascending = false, bar = null, gateGlow = null;
    const clamp = THREE.MathUtils.clamp;
    const gate = () => ({ x: A.x, z: A.z - 46 });
    const toast = (t) => gameSystem.showToast(t);
    const pp = () => ow.playerObj.position;
    const hpFrac = () => { const tot = guards.reduce((s, g) => s + Math.max(0, g.data.hp), 0); return tot / (guards.length * guards[0].data.maxHp); };
    const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const dmgMul = () => (gameSystem.difficultyMultiplier || 1);
    const save = () => { if (window.SaveGame) setTimeout(() => SaveGame.autosave(), 400); };

    // ---------------------------------------------------------------- the guards' look: an eagle with ARMS, in a police uniform
    function guardParts(c) {
        const P = [], add = (p) => { P.push(p); return p; };
        const white = '#fbf6ea', yellow = '#f4c542', navy = c.uniform, gold = '#ffd24a', brown = '#2a1a12';
        [-1, 1].forEach(s => {                                                              // taloned feet and trouser legs
            add({ shape: 'capsule', size: [0.5, 1.7, 0.5], pos: [s * 0.62, 1.0, 0], color: yellow });
            add({ shape: 'cylinder', size: [0.98, 1.5, 0.98], pos: [s * 0.62, 1.6, 0], color: navy });
            [-0.4, 0, 0.4].forEach(x => add({ shape: 'cone', size: [0.24, 0.85, 0.24], pos: [s * 0.62 + x * 0.7, 0.16, 0.66], rot: [Math.PI / 2, 0, 0], color: yellow }));
        });
        [-1, 0, 1].forEach(x => add({ shape: 'capsule', size: [0.5, 1.7, 0.14], pos: [x * 0.5, 1.9, -1.15], rot: [0.5, 0, x * 0.28], color: c.feather }));   // tail feathers
        add({ shape: 'cylinder', size: [2.3, 2.9, 1.7], taper: 0.85, pos: [0, 3.3, 0], color: navy });                // the uniform
        add({ shape: 'cylinder', size: [2.36, 0.32, 1.76], pos: [0, 2.35, 0], color: brown });                          // belt
        add({ shape: 'sphere', size: [0.55, 0.42, 0.18], pos: [0, 2.35, 0.9], color: gold });
        [3.65, 3.15].forEach(y => add({ shape: 'sphere', size: [0.2, 0.2, 0.12], pos: [0, y, 0.9], color: gold }));
        add({ shape: 'sphere', size: [0.64, 0.18, 0.12], pos: [0.62, 3.85, 0.88], color: gold, emissive: '#ffae00' });   // the badge (a gold star)
        add({ shape: 'sphere', size: [0.18, 0.64, 0.12], pos: [0.62, 3.85, 0.88], color: gold, emissive: '#ffae00' });
        add({ shape: 'sphere', size: [0.5, 0.5, 0.5], pos: [0.62, 3.85, 0.9], color: gold, emissive: '#ffae00' });
        [-1, 1].forEach(s => add({ shape: 'sphere', size: [0.85, 0.3, 0.8], pos: [s * 1.25, 4.5, 0], color: c.trim }));  // shoulder trim
        add({ shape: 'sphere', size: [1.55, 0.95, 1.25], pos: [0, 4.9, 0.18], color: white });                           // the fluffy white chest of an eagle
        // arms (not wings!): a navy sleeve, a feathered forearm and a taloned hand
        add({ shape: 'capsule', size: [0.62, 1.7, 0.62], pos: [-1.5, 3.7, 0.1], rot: [0, 0, 0.22], color: navy, name: 'arm_l', pivot: [-1.35, 4.4, 0] });
        add({ shape: 'capsule', size: [0.54, 1.5, 0.54], pos: [-1.68, 2.45, 0.3], rot: [-0.3, 0, 0.12], color: c.feather, follow: 'arm_l' });
        add({ shape: 'sphere', size: [0.66, 0.66, 0.66], pos: [-1.72, 1.7, 0.55], color: yellow, follow: 'arm_l' });
        add({ shape: 'capsule', size: [0.62, 1.7, 0.62], pos: [1.5, 3.7, 0.1], rot: [0, 0, -0.22], color: navy, name: 'arm_r', pivot: [1.35, 4.4, 0] });
        add({ shape: 'capsule', size: [0.54, 1.5, 0.54], pos: [1.68, 2.45, 0.3], rot: [-0.3, 0, -0.12], color: c.feather, follow: 'arm_r' });
        add({ shape: 'sphere', size: [0.66, 0.66, 0.66], pos: [1.72, 1.7, 0.55], color: yellow, follow: 'arm_r' });
        // the spear, held in the right hand (the whole spear tips forward for a charge and down for a slam)
        add({ shape: 'cylinder', size: [0.18, 9.8, 0.18], pos: [1.75, 4.5, 0.58], color: '#8a6a3a', name: 'spear', pivot: [1.75, 1.7, 0.58] });
        add({ shape: 'cone', size: [0.7, 1.8, 0.7], pos: [1.75, 9.9, 0.58], color: gold, emissive: '#ffae00', follow: 'spear' });
        add({ shape: 'cylinder', size: [0.34, 0.3, 0.34], pos: [1.75, 8.9, 0.58], color: gold, follow: 'spear' });
        add({ shape: 'box', size: [0.05, 0.9, 1.2], pos: [1.75, 8.3, 0.0], color: '#d9402f', follow: 'spear' });          // a little red pennant
        // the head: white eagle head, a hooked yellow beak, fierce eyes - and a police cap
        add({ shape: 'sphere', size: [1.7, 1.7, 1.65], pos: [0, 5.75, 0.1], color: white, name: 'head', pivot: [0, 5.0, 0] });
        add({ shape: 'cone', size: [0.9, 1.6, 0.9], pos: [0, 5.5, 1.25], rot: [Math.PI / 2, 0, 0], color: yellow, follow: 'head' });
        add({ shape: 'cone', size: [0.42, 0.65, 0.42], pos: [0, 5.2, 2.0], rot: [Math.PI, 0, 0], color: yellow, follow: 'head' });
        [-1, 1].forEach(s => {
            add({ shape: 'sphere', size: [0.52, 0.46, 0.22], pos: [s * 0.48, 5.95, 0.76], color: '#ffffff', follow: 'head' });
            add({ shape: 'sphere', size: [0.32, 0.34, 0.18], pos: [s * 0.48, 5.93, 0.86], color: '#f4c542', follow: 'head' });
            add({ shape: 'sphere', size: [0.14, 0.2, 0.14], pos: [s * 0.48, 5.93, 0.95], color: '#1a1a24', follow: 'head' });
            add({ shape: 'capsule', size: [0.2, 0.85, 0.2], pos: [s * 0.5, 6.32, 0.8], rot: [0, 0, s * 1.05], color: '#5a3a1e', follow: 'head' });   // an angry brow
        });
        add({ shape: 'sphere', size: [0.9, 0.9, 0.7], pos: [0, 5.55, -0.9], color: white, follow: 'head' });
        add({ shape: 'cylinder', size: [1.85, 0.85, 1.8], pos: [0, 6.7, 0.05], color: c.cap, follow: 'head' });          // the cap
        add({ shape: 'cylinder', size: [1.92, 0.2, 1.86], pos: [0, 6.32, 0.05], color: gold, follow: 'head' });
        add({ shape: 'cylinder', size: [2.2, 0.2, 2.1], pos: [0, 7.15, 0.05], color: c.cap, follow: 'head' });
        add({ shape: 'sphere', size: [1.9, 0.17, 1.35], pos: [0, 6.3, 0.8], color: '#10131f', follow: 'head' });          // the peak
        add({ shape: 'sphere', size: [0.42, 0.42, 0.13], pos: [0, 6.72, 0.95], color: gold, emissive: '#ffae00', follow: 'head' });   // cap badge
        return P;
    }
    function buildGuard(cfg) {
        const mesh = VoxelBuilder.buildCharacter(guardParts(cfg));
        mesh.scale.setScalar(cfg.scale); mesh.rotation.order = 'YXZ';
        mesh.userData.rigged = true;
        return mesh;
    }

    // ---------------------------------------------------------------- set-up (the world builder calls init once the arena exists)
    function init(o) {
        ow = o; A = { x: FOAM.x, z: FOAM.z }; guards = []; G = null; ascending = false;
        ow.guardState = 'none';
        const mk = (id, name, cfg, x) => {
            const mesh = buildGuard(cfg);
            const g = { type: 'boss', bossId: id, custom: true, guard: true, invuln: true, mesh, radius: 14, label: 'talk to the Sky Guards',
                        name, speedMul: id === 'cirro' ? 1.2 : 1, home: { x, z: gate().z + 9 }, y: 0, state: 'post', lean: 0, spearRot: 0, arm: 0, data: { name, hp: 1, maxHp: 1, xpReward: 0 }, aiState: {} };
            mesh.position.set(x, 0, g.home.z); ow.scene.add(mesh); ow.entities.push(g); guards.push(g);
        };
        mk('stratus', 'Stratus', { uniform: '#1c2f6b', trim: '#c9d3ee', feather: '#6b4a2b', cap: '#17265a', scale: 1.15 }, A.x - 9);
        mk('cirro', 'Cirro', { uniform: '#1f6f9c', trim: '#ffffff', feather: '#7b5a35', cap: '#17506f', scale: 1.0 }, A.x + 9);
        // the shimmering barrier across the gate (gone once the guards are beaten)
        const g0 = gate();
        barrier = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, fog: false, depthWrite: false }));
        barrier.position.set(g0.x, 9, g0.z - 1); ow.scene.add(barrier);
        fxGroup = new THREE.Group(); ow.scene.add(fxGroup);
        applyHP();
    }
    function applyHP() {
        const hp = Math.round(CONFIG.hp * dmgMul());
        guards.forEach(g => { g.data.maxHp = hp; g.data.hp = hp; });
    }
    function restore() {
        if (!ow) return;
        if (ow.guardState === 'done') { openGate(true); guards.forEach(g => { g.data.hp = 0; g.state = 'post'; g.invuln = true; }); }
    }
    function openGate(instant) { if (barrier) { barrier.visible = false; } ow.foamOpen = true; }

    // ---------------------------------------------------------------- talking to the guards
    function lineQueue(lines, after) {
        const g = gameSystem;
        g.dialogueQueue = lines.slice(1).map(([speaker, text]) => ({ speaker, text }));
        if (after) g.afterTalk = after;
        g.showDialogue(lines[0][0], lines[0][1]);
    }
    function talk() {
        if (!ow || G || ascending) return;
        const p = gameSystem.party[0];
        if (ow.guardState === 'done') { gameSystem.dialogueQueue = []; const l = TEXT.done[Math.floor(Math.random() * 2)].split(': '); gameSystem.showDialogue(l[0], l.slice(1).join(': ')); return; }
        if (!p.hasCloudPass) { lineQueue(TEXT.noPass); return; }
        lineQueue(TEXT.withPass, () => beginFight());
    }
    const canTalk = () => !G && !ascending;

    // ---------------------------------------------------------------- the fight
    function beginFight() {
        applyHP();
        ow.guardState = 'fighting';
        G = { phase: 1, step: 'intro', t: 0, queue: [], qi: 0, lanes: [], rings: [], slams: [], over: false };
        guards.forEach((g, i) => { g.state = 'fly'; g.invuln = false; g.y = 3; g.target = { x: A.x + (i ? 16 : -16), z: A.z - 26 }; g.spearRot = 0.2; });
        showBar(true);
        Sound.setMood('guards'); Sound.play('roar');
        toast('The Sky Guards attack!');
    }
    const alive = () => guards.filter(g => g.data.hp > 0);
    function showBar(on) {
        const c = document.getElementById('boss-health-container'); if (!c) return;
        c.classList.toggle('hidden', !on);
        if (on) { const nm = document.getElementById('boss-name'); if (nm) nm.textContent = 'Stratus & Cirro, the Sky Guards'; }
    }
    function updateBar() {
        const f = document.getElementById('boss-health-fill'); if (f) f.style.width = Math.max(0, hpFrac() * 100) + '%';
        showBar(true);
    }

    // the order of attacks
    const PHASE1 = ['X', '+', '+', 'X'];
    const PHASE2 = ['slam', 'slamStag', '+', 'slam', 'slamStag', 'X'];
    function nextPattern() {
        const list = G.phase === 1 ? PHASE1 : PHASE2;
        const p = list[G.qi % list.length]; G.qi++;
        return p;
    }

    // --- red lanes on the ground (charge warnings)
    function makeLane(cx, cz, dx, dz) {
        const grp = new THREE.Group();
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.laneLen * 2, 5.5), new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.45, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        plane.rotation.x = -Math.PI / 2; grp.add(plane);
        grp.rotation.y = Math.atan2(-dz, dx); grp.position.set(cx, 0.35, cz);
        fxGroup.add(grp);
        return { grp, plane, mat: plane.material, dx, dz, cx, cz };
    }
    function clearLanes() { if (!G) return; G.lanes.forEach(l => fxGroup.remove(l.grp)); G.lanes = []; }

    // --- shadows that mark where a slam will land
    function makeMark(x, z) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(9, 36), new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.35, z); fxGroup.add(m);
        return m;
    }
    function makeRing(x, z) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.4, z); fxGroup.add(m);
        return { mesh: m, x, z, r: 1, hit: false };
    }

    function hurtPlayer(amount) { combatSystem.damagePlayer(Math.round(amount * dmgMul())); }

    // move a guard smoothly toward a spot
    function glide(g, x, y, z, dt, rate = 5) {
        const m = g.mesh, k = Math.min(1, dt * rate);
        m.position.x += (x - m.position.x) * k; m.position.z += (z - m.position.z) * k; g.y += (y - g.y) * k;
    }
    const face = (g, tx, tz, dt, rate = 8) => { const m = g.mesh, want = Math.atan2(tx - m.position.x, tz - m.position.z); m.rotation.y += wrap(want - m.rotation.y) * Math.min(1, dt * rate); };

    function startFormation(kind) {
        const al = alive(); if (!al.length) return;
        const p = pp(), dx0 = p.x - A.x, dz0 = p.z - A.z, d0 = Math.hypot(dx0, dz0) || 1, lim = Math.min(d0, 22);
        const cx = A.x + dx0 / d0 * lim, cz = A.z + dz0 / d0 * lim;                // (the lanes cross where YOU are standing, kept inside the arena)
        const dirs = kind === '+' ? [[1, 0], [0, 1]] : [[0.7071, 0.7071], [0.7071, -0.7071]];
        const flip = () => (Math.random() < 0.5 ? -1 : 1);
        G.lanes = dirs.map(([dx, dz]) => { const f = flip(); return makeLane(cx, cz, dx * f, dz * f); });
        G.form = { kind, t: 0, wind: CONFIG.windup[G.phase - 1], dash: false, jobs: [] };
        // who takes which lane (one guard left: it does both, one after the other)
        if (al.length >= 2) al.forEach((g, i) => G.form.jobs.push({ g, lane: G.lanes[i], delay: i * 0.32, done: false }));
        else { G.form.jobs.push({ g: al[0], lane: G.lanes[0], delay: 0, done: false }); G.form.jobs.push({ g: al[0], lane: G.lanes[1], delay: 99, done: false, after: true }); }
        G.step = 'form'; G.t = 0;
        Sound.play('charge');
    }
    const laneStart = (l) => ({ x: l.cx - l.dx * CONFIG.laneLen, z: l.cz - l.dz * CONFIG.laneLen });

    function tickFormation(dt) {
        const F = G.form; F.t += dt;
        const speed = CONFIG.chargeSpeed[G.phase - 1];
        if (!F.dash) {
            // wind-up: fly to the start of the lane, aim the spear, the red lane fills in
            const k = clamp(F.t / F.wind, 0, 1);
            G.lanes.forEach(l => { l.mat.opacity = 0.2 + 0.4 * k + 0.2 * Math.sin(T * 24); l.plane.scale.x = 0.15 + 0.85 * ease(k * 1.5); });
            F.jobs.forEach(j => {
                if (j.after) return;
                const s = laneStart(j.lane); j.g.state = 'wind';
                glide(j.g, s.x, 1.5, s.z, dt, 7); face(j.g, j.lane.cx, j.lane.cz, dt, 12);
                j.g.spearRot += (1.45 - j.g.spearRot) * Math.min(1, dt * 8); j.g.lean += (0.1 - j.g.lean) * Math.min(1, dt * 5);
            });
            if (F.t >= F.wind) { F.dash = true; F.t = 0; Sound.play('roar'); }
            return;
        }
        // dash: each guard shoots along its lane (the second one a moment later)
        let allDone = true;
        F.jobs.forEach(j => {
            if (j.done) return;
            allDone = false;
            if (j.after && !F.jobs[0].done) return;
            if (j.after && !j.started) { j.started = true; j.delayT = -0.5; const s = laneStart(j.lane); j.g.mesh.position.set(s.x, 0, s.z); j.g.y = 1.5; }
            j.t = (j.t || 0) + dt;
            const wait = j.after ? 0 : j.delay;
            if (j.t < wait) return;
            const g = j.g, m = g.mesh, tt = j.t - wait, dist = tt * speed * g.speedMul, s = laneStart(j.lane), L2 = CONFIG.laneLen * 2;
            if (j.after && tt < 0.05) { /* just started */ }
            const d = Math.min(dist, L2);
            m.position.x = s.x + j.lane.dx * d; m.position.z = s.z + j.lane.dz * d; g.y = 1.5;
            m.rotation.y = Math.atan2(j.lane.dx, j.lane.dz); g.spearRot = 1.5; g.lean = 0.45; g.state = 'dash';
            const p = pp();
            if (pp().y < 3.5 && Math.hypot(p.x - m.position.x, p.z - m.position.z) < 3.6) hurtPlayer(CONFIG.damage.charge);
            if (dist >= L2) { j.done = true; }
        });
        if (allDone) { clearLanes(); G.step = 'rest'; G.t = 0; guards.forEach(g => { if (g.data.hp > 0) { g.state = 'tired'; } }); }
    }

    // --- slams (phase 2)
    function startSlam(stagger) {
        const al = alive(); if (!al.length) return;
        G.slams = al.map((g, i) => ({ g, t: -(stagger ? i * 0.9 : 0), phase: 'crouch', mark: null, target: null, done: false }));
        G.step = 'slam'; G.t = 0;
    }
    function tickSlams(dt) {
        let allDone = true;
        G.slams.forEach((S, idx) => {
            if (S.done) return;
            allDone = false;
            S.t += dt; if (S.t < 0) return;
            const g = S.g, m = g.mesh, p = pp();
            if (g.data.hp <= 0) { S.done = true; if (S.mark) fxGroup.remove(S.mark); return; }
            if (S.phase === 'crouch') {                                                // squat, then...
                g.state = 'crouch'; g.lean = 0.3; g.spearRot = 0.2; g.y += (-0.4 - g.y) * Math.min(1, dt * 12);
                if (S.t > 0.45) { S.phase = 'rise'; S.t = 0; S.y0 = g.y; Sound.play('jump'); }
            } else if (S.phase === 'rise') {                                          // ...JUMP up into the sky
                g.state = 'air'; g.y = S.y0 + (38 - S.y0) * ease(S.t / 0.75); g.spearRot = 3.14; g.lean = 0;
                if (S.t >= 0.75) { S.phase = 'track'; S.t = 0; S.mark = makeMark(m.position.x, m.position.z); }
            } else if (S.phase === 'track') {                                         // hover over the target while the red circle shows where the slam will land
                const T0 = 1.25;
                if (S.t < T0 - 0.35) {
                    const off = idx % 2 ? 11 : 0, ang = S.t * 1.7 + idx * 3;
                    S.target = { x: clamp(p.x + Math.cos(ang) * off, A.x - 44, A.x + 44), z: clamp(p.z + Math.sin(ang) * off, A.z - 44, A.z + 44) };   // (the second guard aims a little off to one side)
                }
                if (S.target) { glide(g, S.target.x, 38, S.target.z, dt, 6); S.mark.position.x = S.target.x; S.mark.position.z = S.target.z; }
                S.mark.material.opacity = 0.25 + 0.3 * (S.t / T0) + (S.t > T0 - 0.35 ? 0.2 * Math.sin(T * 40) : 0);
                S.mark.scale.setScalar(0.4 + 0.6 * ease(S.t / T0));
                g.spearRot = 3.14;
                if (S.t >= T0) { S.phase = 'fall'; S.t = 0; }
            } else if (S.phase === 'fall') {                                          // SLAM!
                g.y = 38 * (1 - ease(S.t / 0.28)); m.position.x += (S.target.x - m.position.x) * 0.5; m.position.z += (S.target.z - m.position.z) * 0.5;
                if (S.t >= 0.28) {
                    g.y = 0; S.phase = 'stuck'; S.t = 0; g.state = 'stuck';
                    G.rings.push(makeRing(S.target.x, S.target.z));
                    if (Math.hypot(p.x - S.target.x, p.z - S.target.z) < 9.5 && p.y < 4) hurtPlayer(CONFIG.damage.slam);
                    Sound.play('slam'); fxGroup.remove(S.mark); S.mark = null;
                    if (ow.camera) { ow.camera.position.y += 0.5; }
                }
            } else if (S.phase === 'stuck') {                                         // the spear is stuck in the floor: a moment to hit back
                g.lean = 0.15; g.spearRot = 3.14;
                if (S.t > 1.5) S.done = true;
            }
        });
        if (allDone) { G.slams = []; G.step = 'rest'; G.t = 0; }
    }
    function tickRings(dt) {
        const p = pp();
        for (let i = G.rings.length - 1; i >= 0; i--) {
            const R = G.rings[i]; R.r += 34 * dt; R.mesh.scale.setScalar(R.r); R.mesh.material.opacity = Math.max(0, 0.9 - R.r / 30);
            if (!R.hit && p.y < 1.6 && Math.abs(Math.hypot(p.x - R.x, p.z - R.z) - R.r) < 2.2) { R.hit = true; hurtPlayer(CONFIG.damage.ring); }   // jump over the ring!
            if (R.r > 30) { fxGroup.remove(R.mesh); G.rings.splice(i, 1); }
        }
    }

    function fightTick(dt) {
        const al = alive();
        if (!al.length) { victory(); return; }
        // phase change
        if (G.phase === 1 && hpFrac() <= 0.5 && G.step !== 'form' && G.step !== 'phase2') {
            G.phase = 2; G.qi = 0; clearLanes(); G.step = 'phase2'; G.t = 0; toast(TEXT.phase2[0]); Sound.play('roar');
        }
        G.t += dt;
        guards.forEach(g => { g.invuln = g.data.hp <= 0 || g.y > 4; });
        tickRings(dt);
        const o = (arr, x) => arr;
        switch (G.step) {
            case 'intro': guards.forEach((g, i) => { glide(g, A.x + (i ? 16 : -16), 3 + Math.sin(T * 3 + i) * 0.5, A.z - 26, dt, 4); face(g, pp().x, pp().z, dt); }); if (G.t > 1.8) { G.step = 'plan'; G.t = 0; } break;
            case 'plan': {
                const p = nextPattern();
                guards.forEach(g => { g.state = 'fly'; });
                if (p === 'slam') startSlam(false); else if (p === 'slamStag') startSlam(true); else startFormation(p);
                break;
            }
            case 'phase2': guards.forEach((g, i) => { if (g.data.hp > 0) { glide(g, A.x + (i ? 16 : -16), 3 + Math.sin(T * 6 + i) * 0.7, A.z - 22, dt, 4); face(g, pp().x, pp().z, dt); g.spearRot += (0.2 - g.spearRot) * dt * 6; g.lean *= 0.9; } }); if (G.t > 1.6) { G.step = 'plan'; G.t = 0; } break;
            case 'form': tickFormation(dt); break;
            case 'slam': tickSlams(dt); break;
            case 'rest': {
                const rest = G.phase === 1 ? 1.5 : 1.0;
                guards.forEach(g => { if (g.data.hp <= 0) return; g.lean += (0.25 - g.lean) * Math.min(1, dt * 4); g.spearRot += (3.0 - g.spearRot) * Math.min(1, dt * 4); g.y += (0 - g.y) * Math.min(1, dt * 8); });
                if (G.t > rest) { G.step = 'return'; G.t = 0; }
                break;
            }
            case 'return':
                guards.forEach((g, i) => { if (g.data.hp <= 0) return; glide(g, A.x + (i ? 18 : -18), 3 + Math.sin(T * 4 + i) * 0.6, A.z - 24, dt, 5); face(g, pp().x, pp().z, dt); g.spearRot += (0.2 - g.spearRot) * Math.min(1, dt * 6); g.lean *= 0.9; g.state = 'fly'; });
                if (G.t > 0.9) { G.step = 'plan'; G.t = 0; }
                break;
        }
        // the knocked-out guard kneels
        guards.forEach(g => { if (g.data.hp <= 0) { g.state = 'ko'; g.y += (0 - g.y) * Math.min(1, dt * 6); g.lean += (0.55 - g.lean) * Math.min(1, dt * 4); g.spearRot += (1.9 - g.spearRot) * Math.min(1, dt * 3); } });
        updateBar();
    }
    function onDown(g) {   // called (by the combat system) when a guard's health runs out
        g.data.hp = 0; g.invuln = true; Sound.play('kill');
        if (alive().length) toast(g.name + ' is down! ' + alive()[0].name + ' is fighting on, angrier than ever!');
    }

    function victory() {
        if (!G) return;
        clearLanes(); G.rings.forEach(r => fxGroup.remove(r.mesh)); G.slams.forEach(s => { if (s.mark) fxGroup.remove(s.mark); });
        G = null; showBar(false);
        ow.guardState = 'done';
        Sound.setMood('sky'); Sound.play('fanfare');
        const p = gameSystem.party[0]; p.exp += CONFIG.reward;
        while (p.exp >= p.expToNext) { p.exp -= p.expToNext; p.level += 1; p.expToNext = Math.round(p.expToNext * 1.3); p.maxHp += 10; p.hp = p.maxHp; }
        gameSystem.updateHUD();
        guards.forEach(g => { g.state = 'post'; });
        lineQueue(TEXT.victory, () => { openGate(); toast('The Stairs of Foam are open!'); save(); });
    }

    // ---------------------------------------------------------------- climbing the stairs (the end of Chapter 4)
    function ascend() {
        if (ascending) return; ascending = true;
        gameSystem.isCutscene = true; document.body.classList.add('cutscene-active');
        Sound.play('levelup');
        ow.setFade(1, 2.2, '#fff7d6');
        setTimeout(() => {
            gameSystem.showChapterEnd(5, 'The Sun of Time', TEXT.ascend + ' Chapter 5 is coming soon!');
            gameSystem.chapterFiveReached = true;
        }, 2400);
    }

    // ---------------------------------------------------------------- every frame
    function update(dt) {
        if (!ow || !guards.length) return;
        T += dt;
        if (barrier && barrier.visible) { barrier.material.opacity = 0.26 + 0.1 * Math.sin(T * 2.2); }
        const near = Math.hypot(pp().x - A.x, pp().z - A.z) < 140;
        if (!near && !G) return;
        if (G) fightTick(dt);
        else {   // standing guard at the gate
            guards.forEach((g, i) => {
                const m = g.mesh; m.position.x += (g.home.x - m.position.x) * Math.min(1, dt * 4); m.position.z += (g.home.z - m.position.z) * Math.min(1, dt * 4);
                g.y += (0 - g.y) * Math.min(1, dt * 6); g.lean *= 0.9; g.spearRot += (0.0 - g.spearRot) * Math.min(1, dt * 5);
                const dx = pp().x - m.position.x, dz = pp().z - m.position.z;
                if (Math.hypot(dx, dz) < 50) m.rotation.y += wrap(Math.atan2(dx, dz) - m.rotation.y) * Math.min(1, dt * 3);
                g.state = 'post';
            });
        }
        guards.forEach((g, i) => {                                                     // pose + bob
            const m = g.mesh, spear = g.spear || (g.spear = m.getObjectByName('spear')), head = g.head || (g.head = m.getObjectByName('head'));
            m.position.y = g.y + (g.state === 'post' ? Math.sin(T * 2 + i) * 0.08 : 0);
            m.rotation.x = g.lean;
            if (spear) spear.rotation.x += (g.spearRot - spear.rotation.x) * Math.min(1, dt * 12);
            if (head) head.rotation.x = g.state === 'ko' ? 0.5 : 0;
        });
        // the gate triggers the climb
        if (ow.guardState === 'done' && ow.foamOpen && !ascending && gameSystem.state === 'overworld' && !gameSystem.isCutscene) {
            const g0 = gate(), p = pp();
            if (Math.hypot(p.x - g0.x, p.z - g0.z) < 7) ascend();
        }
    }

    // ---------------------------------------------------------------- guidance for the compass / objective line
    function objective(pos) {
        if (!ow || !ow.skyReached) return null;
        const p = gameSystem.party[0], g0 = gate();
        const d = Math.hypot(pos.x - A.x, pos.z - A.z);
        if (G) return { text: 'Defeat Stratus and Cirro, the Sky Guards!' };
        if (ow.guardState === 'done') return { text: 'Walk through the gate and climb the Stairs of Foam!', x: g0.x, z: g0.z };
        if (d < 150) return { text: p.hasCloudPass ? 'Show the Sky Guards your Cloud Stair Pass' : 'Talk to the Sky Guards at the foot of the Stairs of Foam', x: A.x, z: A.z - 38 };
        if (p.hasCloudPass) return { text: 'Take your Cloud Stair Pass to the Stairs of Foam (far north of Makani)', x: A.x, z: A.z - 38 };
        return null;
    }
    function passHint() { const p = gameSystem.party[0]; return (!p.hasCloudPass) ? 'Cashato sells something special: the Cloud Stair Pass' : null; }

    return { init, restore, update, talk, canTalk, onDown, objective, passHint, CONFIG, TEXT, get active() { return !!G; }, get fighting() { return !!G; }, get guards() { return guards; } };
})();
window.SkyGuards = SkyGuards;
