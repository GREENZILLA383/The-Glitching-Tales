// Iolana's Kite Ring Race (Makani Village mini-game).
//
// Talk to Iolana, say yes, and you take off under a big kite. Fly through all 12 glowing rings before the time runs out:
//   A / D  (or the stick left / right)  steer         W / S  (stick up / down)  climb / dive         Q  quit
// Your best time and medal (Bronze / Silver / Gold) are saved with the game.
const KiteRace = (() => {
    const RING_COUNT = 12, RING_R = 9.5, SPEED = 38, TURN = 1.7, TIME_LIMIT = 60, COUNTDOWN = 3;
    const GOLD = 34, SILVER = 45;                       // seconds (a perfect flight takes about 24)
    const REWARD = [0, 20, 40, 60];                     // coins for reaching Bronze / Silver / Gold (you only get the difference when you improve)
    const MEDAL = ['', 'Bronze', 'Silver', 'Gold'];
    let R = null;
    const $ = (id) => document.getElementById(id);
    const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

    // ---- the kite: four coloured panels, a golden sun, wooden spars, strings and a long wiggly ribbon tail ----
    function buildKite() {
        const rig = new THREE.Group();
        const kite = new THREE.Group(); kite.position.set(0, 9.5, 1.2); kite.rotation.x = 0.35; rig.add(kite);
        const M = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: e === undefined ? c : e, emissiveIntensity: 0.32, side: THREE.DoubleSide });
        const tri = (a, b, c, color) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0], 3));
            g.computeVertexNormals();
            const m = new THREE.Mesh(g, M(color)); kite.add(m); return m;
        };
        const T = [0, 4.8], Rt = [3.6, 0.8], B = [0, -4], L = [-3.6, 0.8], C = [0, 0.8];
        tri(T, Rt, C, 0xf0627f); tri(Rt, B, C, 0x3f8fe8); tri(B, L, C, 0xf2b236); tri(L, T, C, 0x4cc29a);
        const sun = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), M(0xfff2b0, 0xffd86a)); sun.position.set(0, 0.8, 0.03); kite.add(sun);
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.9 });
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.9, 0.18), wood); v.position.set(0, 0.4, 0.05); kite.add(v);
        const h = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.18, 0.18), wood); h.position.set(0, 0.8, 0.05); kite.add(h);
        // the ribbon tail (little bows on a long ribbon) - they wiggle in update()
        const tail = [], colors = [0xf0627f, 0xf2b236, 0x3f8fe8, 0x4cc29a, 0x8c6cf0, 0xff8a4a, 0xf0627f, 0xf2b236];
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 15, 0.05), M(0xffffff)); ribbon.position.set(0, -11.4, 0.04); kite.add(ribbon);
        colors.forEach((c, i) => { const bow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.06), M(c)); bow.position.set(0, -5.3 - i * 1.7, 0.1); kite.add(bow); tail.push(bow); });
        // strings from your hands up to the kite
        const line = new THREE.LineBasicMaterial({ color: 0xffffff });
        [-1, 1].forEach(s => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([s * 0.6, 3.4, -0.1, s * 1.2, 8.1, 0.68], 3)); rig.add(new THREE.Line(g, line)); });
        rig.userData.tail = tail;
        return rig;
    }

    // ---- the course: 12 rings weaving round the village (out over the houses, in toward the windmill, and back) ----
    function ringPoints(V, a0) {
        const pts = [];
        for (let k = 0; k < RING_COUNT; k++) {
            const ang = a0 + (k + 1) * (Math.PI * 2 / RING_COUNT), r = k % 2 === 0 ? 102 : 66;
            const y = 17 + 11 * (0.5 + 0.5 * Math.sin(k * 0.85)) + (k % 2 ? 3 : 0);
            pts.push(new THREE.Vector3(V.x + Math.sin(ang) * r, y, V.z + Math.cos(ang) * r));
        }
        return pts;
    }

    function buildRings(pts, start) {
        const group = new THREE.Group(), rings = [];
        const geo = new THREE.TorusGeometry(RING_R - 1, 0.85, 8, 36);
        pts.forEach((p, i) => {
            const m = new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.6, fog: false, depthWrite: false });
            const mesh = new THREE.Mesh(geo, m); mesh.position.copy(p);
            const prev = i === 0 ? start : pts[i - 1], dir = p.clone().sub(prev).normalize();
            mesh.lookAt(p.clone().add(dir));                       // the ring faces the way you fly through it
            group.add(mesh); rings.push({ mesh, mat: m, done: false, fade: 0 });
        });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 140, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.32, fog: false, depthWrite: false, side: THREE.DoubleSide }));
        group.add(beam);
        return { group, rings, beam };
    }

    function say(text, big) { const m = $('kite-msg'); if (!m) return; m.textContent = text; m.classList.toggle('big', !!big); m.classList.toggle('show', !!text); }

    // ---- start / update / end ----
    function begin(ent) {
        const ow = overworld3d, gs = gameSystem, V = MAKANI;
        if (R || !ow.playerObj) return;
        const p = ow.playerObj.position;
        const start = new THREE.Vector3(p.x, 0, p.z);
        const a0 = Math.atan2(p.x - V.x, p.z - V.z);
        const pts = ringPoints(V, a0), course = buildRings(pts, start.clone().setY(14));
        const rig = buildKite();
        ow.scene.add(course.group); ow.scene.add(rig);
        R = {
            t: 0, clock: 0, phase: 'count', pts, rings: course.rings, beam: course.beam, courseGroup: course.group, rig,
            pos: start.clone(), yaw: Math.atan2(-(pts[0].x - start.x), -(pts[0].z - start.z)), pitch: 0, bank: 0, next: 0,
            back: { pos: p.clone(), rotY: ow.playerObj.rotation.y, quat: ow.camera.quaternion.clone(), cam: ow.camera.position.clone() }, warned: false, lastCount: 4
        };
        ow.kite = R;
        gs.state = 'kite';
        const tp = $('talk-prompt'); if (tp) tp.classList.add('hidden');
        ow.nearVillager = null;
        if (ow.controls && ow.controls.isLocked) ow.controls.unlock();
        document.body.classList.add('kite-on');
        $('kite-hud').classList.remove('hidden');
        $('kite-hint').textContent = window.IS_MOBILE ? 'Left thumb: steer left / right, push up to climb, down to dive' : 'A / D steer   ·   W climb   ·   S dive   ·   Q quit';
        $('kite-best').textContent = ow.kiteBest ? '🏅 Best ' + ow.kiteBest.toFixed(1) + 's' : '';
        Sound.play('levelup');
        place(0.001, true);
        update(0.001);
    }

    // put the kite, the player and the camera where the flight says they are
    function place(dt, snap) {
        const ow = overworld3d, r = R, pos = r.pos;
        r.rig.position.copy(pos); r.rig.rotation.order = 'YXZ'; r.rig.rotation.set(r.pitch * 0.6, r.yaw, r.bank);
        ow.playerObj.position.copy(pos); ow.playerObj.rotation.set(0, r.yaw + Math.PI, 0);
        if (ow.companionObj) ow.companionObj.visible = false;
        const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw);
        const target = new THREE.Vector3(pos.x - fx * 23, pos.y + 9 - r.pitch * 7, pos.z - fz * 23);
        if (snap) ow.camera.position.copy(target); else ow.camera.position.lerp(target, 1 - Math.exp(-dt * 5));
        ow.camera.lookAt(pos.x + fx * 12, pos.y + 5 + r.pitch * 4, pos.z + fz * 12);
    }

    function update(delta) {
        if (!R) return;
        const ow = overworld3d, r = R, dt = Math.min(delta, 0.05), V = MAKANI;
        r.t += dt;
        if (gameSystem.state !== 'kite') gameSystem.state = 'kite';   // (nothing else may take over while you fly)
        const k = ow.keys, st = ow.stick;
        let steer = 0, climb = 0;                                     // steer > 0 = turn left
        if (k['a'] || k['arrowleft']) steer += 1;
        if (k['d'] || k['arrowright']) steer -= 1;
        if (k['w'] || k['arrowup']) climb += 1;
        if (k['s'] || k['arrowdown']) climb -= 1;
        if (st && st.active) { steer = -st.x; climb = st.y; }

        if (r.phase === 'count') {
            const left = COUNTDOWN - r.t, e = Math.min(1, r.t / COUNTDOWN);
            r.pos.y = 14 * e * e * (3 - 2 * e);                       // the kite lifts off the ground
            r.pitch = 0; r.bank = Math.sin(r.t * 2) * 0.06;
            const n = Math.ceil(left);
            if (left > 0) { if (n !== r.lastCount) { r.lastCount = n; say(String(n), true); Sound.play('click'); } }
            else { r.phase = 'fly'; r.clock = 0; say('GO!', true); r.goAt = r.t; Sound.play('levelup'); }
        } else {
            r.clock += dt;
            if (r.goAt !== undefined && r.t - r.goAt > 0.9) { r.goAt = undefined; say(''); }
            r.yaw += steer * TURN * dt;
            r.pitch += (climb * 0.5 - r.pitch) * Math.min(1, dt * 3);
            const speed = SPEED * (1 - 0.2 * r.pitch / 0.5);
            r.pos.x += -Math.sin(r.yaw) * Math.cos(r.pitch) * speed * dt;
            r.pos.z += -Math.cos(r.yaw) * Math.cos(r.pitch) * speed * dt;
            r.pos.y += Math.sin(r.pitch) * speed * dt;
            if (r.pos.y < 5) { r.pos.y = 5; if (r.pitch < 0) r.pitch = 0; }
            if (r.pos.y > 62) { r.pos.y = 62; if (r.pitch > 0) r.pitch = 0; }
            const dx = V.x - r.pos.x, dz = V.z - r.pos.z;
            if (Math.hypot(dx, dz) > 138) {                           // the wind gently turns you back toward the village
                const diff = wrap(Math.atan2(-dx, -dz) - r.yaw);
                r.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
                if (!r.warned) { r.warned = true; gameSystem.showToast('The wind is turning you back toward Makani!'); }
            } else r.warned = false;
            r.bank += (steer * 0.45 - r.bank) * Math.min(1, dt * 4);

            // flying through a ring?
            const ring = r.rings[r.next];
            if (ring && r.pos.distanceTo(r.pts[r.next]) < RING_R) {
                ring.done = true; ring.fade = 1; ring.mat.color.setHex(0x7dff9c); r.next++;
                Sound.play('coin');
                if (r.next >= RING_COUNT) { finish(); return; }
                say(r.next === RING_COUNT - 1 ? 'Last ring!' : '');
                if (r.next === RING_COUNT - 1) setTimeout(() => { if (R === r) say(''); }, 1400);
            }
            if (TIME_LIMIT - r.clock <= 0) { end('timeout'); return; }
        }
        // the rings: the next one glows gold and pulses, passed ones pop and fade, the rest wait
        r.rings.forEach((g, i) => {
            if (g.done) { g.fade = Math.max(0, g.fade - dt * 2.2); g.mesh.visible = g.fade > 0; g.mesh.scale.setScalar(1 + (1 - g.fade) * 0.6); g.mat.opacity = g.fade * 0.8; return; }
            if (i === r.next) { g.mat.color.setHex(0xffd23f); g.mat.opacity = 0.95; g.mesh.scale.setScalar(1 + Math.sin(r.t * 6) * 0.07); }
            else { g.mat.color.setHex(i === r.next + 1 ? 0xb9e6ff : 0x8ad0ff); g.mat.opacity = i === r.next + 1 ? 0.7 : 0.4; g.mesh.scale.setScalar(1); }
        });
        const nx = r.pts[Math.min(r.next, RING_COUNT - 1)];
        r.beam.position.set(nx.x, nx.y + 62, nx.z); r.beam.visible = r.next < RING_COUNT;
        r.rig.userData.tail.forEach((b, i) => { b.position.x = Math.sin(r.t * 5 - i * 0.8) * (0.5 + i * 0.28); b.rotation.z = Math.sin(r.t * 5 - i * 0.8) * 0.5; });
        place(dt, false);
        hud();
    }

    function hud() {
        const r = R, tl = Math.max(0, TIME_LIMIT - r.clock);
        const t = $('kite-time'); t.textContent = '⏱ ' + r.clock.toFixed(1) + 's'; t.classList.toggle('low', r.phase === 'fly' && tl < 10);
        $('kite-rings').textContent = '◯ ' + Math.min(r.next, RING_COUNT) + ' / ' + RING_COUNT;
        const target = r.pts[Math.min(r.next, RING_COUNT - 1)];
        const dx = target.x - r.pos.x, dz = target.z - r.pos.z, dy = target.y - r.pos.y;
        const diff = wrap(Math.atan2(-dx, -dz) - r.yaw);                // > 0: the ring is to your left
        $('kite-arrow').style.transform = 'rotate(' + (-diff * 180 / Math.PI).toFixed(0) + 'deg)';
        const alt = $('kite-alt'); alt.textContent = dy > 7 ? '▲ climb' : dy < -7 ? '▼ dive' : '';
        $('kite-dist').textContent = Math.round(Math.hypot(dx, dz, dy)) + ' m';
    }

    function finish() {
        const r = R, time = r.clock, ow = overworld3d, gs = gameSystem;
        const medal = time <= GOLD ? 3 : time <= SILVER ? 2 : 1;
        const prevMedal = ow.kiteMedal || 0, prevBest = ow.kiteBest;
        const coins = medal > prevMedal ? REWARD[medal] - REWARD[prevMedal] : 5;
        const newBest = prevBest == null || time < prevBest;
        ow.kiteMedal = Math.max(prevMedal, medal); if (newBest) ow.kiteBest = time;
        gs.coins += coins;
        end('win');
        gs.updateHUD();
        Sound.play('fanfare');
        const who = 'Iolana, the Kite Pilot';
        const lines = [];
        lines.push(`${time.toFixed(1)} seconds! That is a ${MEDAL[medal].toUpperCase()} flight!` + (newBest && prevBest != null ? ' And a new personal best!' : ''));
        lines.push(medal === 3 ? 'Gold! You fly better than me. Do not tell anyone I said that. Here, take ' + coins + ' coins!'
            : medal === 2 ? 'Nearly gold! Get under ' + GOLD + ' seconds and I will give you the big prize. Here are ' + coins + ' coins!'
            : 'You made it round! Try for ' + SILVER + ' seconds next time, or even ' + GOLD + '. Here are ' + coins + ' coins for flying!');
        gs.dialogueQueue = lines.slice(1).map(text => ({ speaker: who, text }));
        gs.showDialogue(who, lines[0]);
        gs.showToast('🪁 Kite Race: ' + MEDAL[medal] + ' · +' + coins + ' coins');
        setTimeout(() => { if (window.SaveGame) SaveGame.autosave(); }, 800);
    }

    // reason: 'quit' | 'timeout' | 'win'
    function end(reason) {
        if (!R) return;
        const ow = overworld3d, gs = gameSystem, r = R, got = r.next;
        R = null; ow.kite = null;
        ow.scene.remove(r.rig); ow.scene.remove(r.courseGroup);
        $('kite-hud').classList.add('hidden'); say('');
        document.body.classList.remove('kite-on');
        ow.playerObj.position.copy(r.back.pos); ow.playerObj.rotation.set(0, r.back.rotY, 0);
        ow.camera.quaternion.copy(r.back.quat); ow.camera.position.copy(r.back.cam);
        ow.velocityY = 0; ow.isJumping = false; ow.isGliding = false; ow.grounded = true;
        if (ow.companionObj) { ow.companionObj.visible = true; ow.companionObj.position.set(r.back.pos.x + 4, r.back.pos.y, r.back.pos.z + 3); ow.compBaseY = undefined; }
        gs.state = 'overworld';
        ow.updateCulling();
        if (reason === 'timeout') {
            Sound.play('error');
            const who = 'Iolana, the Kite Pilot';
            gs.dialogueQueue = [{ speaker: who, text: 'Do not worry. Even the wind misses a turn now and then. Talk to me whenever you want another go!' }];
            gs.showDialogue(who, 'Time is up! You flew through ' + got + ' of ' + RING_COUNT + ' rings. So close!');
        } else if (reason === 'quit') gs.showToast('Kite race cancelled.');
    }

    document.addEventListener('keydown', (e) => { if (R && e.key.toLowerCase() === 'q' && !e.repeat) end('quit'); });
    window.addEventListener('DOMContentLoaded', () => { const q = $('kite-quit'); if (q) q.addEventListener('click', () => end('quit')); });

    return { begin, update, end, get active() { return !!R; }, GOLD, SILVER, TIME_LIMIT, RING_COUNT };
})();
window.KiteRace = KiteRace;
