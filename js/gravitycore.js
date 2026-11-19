// THE GRAVITY CORE - the Chapter 3 boss stage.
//
// The arena is a small round planet (think Super Mario Galaxy): gravity pulls toward its centre, so "up" is
// always straight away from the planet and you can run all the way around it. The boss, Graton, is made of
// floating rock debris held together by a tiny black hole in his chest.
//
//   Phase 1: he chases you, uses his black hole to PULL you in, then slams a giant rock hammer.
//   Phase 2: portals open in the sky and meteors rain down, and the black-hole pull keeps happening too.
//
// Everything here works on the surface of a sphere. A "position" is a unit direction `dir` from the planet's
// centre plus a height `h` above the surface; moving means rotating `dir` around the centre.
const GravityCore = (() => {
    const C = new THREE.Vector3(-2600, 0, -2400);   // far away from the rest of the world
    const R = 90;                                    // planet radius
    const GRAV = 648, JUMP_V = 72, RUN = 48;         // units per second (same feel as the overworld jump)
    const BOSS_NAME = 'Graton, Protector of the Gravity Core';
    const X = { active: false, boss: null };

    let built = false, stage = null, P = null, B = null, boss = null;
    let t = 0, camPitch = 0.28, camShake = 0, stepDist = 0, listeners = false;
    const fx = [], orbs = [], meteors = [];
    const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const clamp = THREE.MathUtils.clamp;

    // ------------------------------------------------------------------ sphere maths
    const worldPos = (dir, h = 0) => dir.clone().multiplyScalar(R + h).add(C);
    const arc = (a, b) => R * Math.acos(clamp(a.dot(b), -1, 1));
    function flatten(fwd, dir) { // make `fwd` lie flat against the ground at `dir`
        const f = fwd.clone().sub(dir.clone().multiplyScalar(fwd.dot(dir)));
        if (f.lengthSq() < 1e-8) f.set(1, 0, 0).sub(dir.clone().multiplyScalar(dir.x));
        return f.normalize();
    }
    function quatFor(dir, fwd) {  // a rotation whose up is `dir` and whose forward (+z) is `fwd`
        const y = dir, z = flatten(fwd, dir), x = V3().crossVectors(y, z);
        return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    }
    // Slide `dir` along the ground by the tangent vector `move`, carrying the other tangent vectors with it.
    function travel(dir, carry, move) {
        const len = move.length(); if (len < 1e-6) return;
        const axis = V3().crossVectors(dir, move).normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(axis, len / R);
        dir.applyQuaternion(q).normalize(); carry.forEach(v => v.applyQuaternion(q));
    }
    function travelToward(dir, carry, target, dist) {
        const total = Math.acos(clamp(dir.dot(target), -1, 1)); if (total < 1e-5) return;
        const axis = V3().crossVectors(dir, target).normalize();
        const q = new THREE.Quaternion().setFromAxisAngle(axis, Math.min(total, dist / R));
        dir.applyQuaternion(q).normalize(); carry.forEach(v => v.applyQuaternion(q));
    }
    const towardTangent = (from, to) => flatten(to.clone().sub(from.clone().multiplyScalar(to.dot(from))), from); // direction from -> to along the ground
    const rotateAbout = (v, axis, ang) => v.applyAxisAngle(axis, ang);

    // ------------------------------------------------------------------ building the stage
    function noise3(x, y, z) { return Math.sin(x * 3.1 + Math.sin(y * 2.3)) * Math.sin(z * 2.7 + x * 1.3) * 0.5 + Math.sin(y * 7.3 + z * 5.1) * Math.sin(x * 6.1) * 0.25; }

    function glowTexture(inner, outer) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
        const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer);
        cx.fillStyle = g; cx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
    }

    function buildStage() {
        const ow = overworld3d, scene = ow.scene, group = new THREE.Group();
        group.position.copy(C);
        // the planet: faceted dark rock with violet / blue patches
        const geo = new THREE.IcosahedronGeometry(R, 5);
        const pos = geo.attributes.position, col = [];
        const dark = new THREE.Color(0x2b2745), mid = new THREE.Color(0x4a3f78), light = new THREE.Color(0x6f6aa8), glow = new THREE.Color(0x3a6aa8);
        for (let i = 0; i < pos.count; i += 3) {   // one colour per triangle -> crisp facets
            const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / (3 * R), cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / (3 * R), cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / (3 * R);
            const n = noise3(cx, cy, cz), c = dark.clone().lerp(mid, clamp(n * 1.6 + 0.5, 0, 1)).lerp(light, clamp(n * 2.2 - 0.25, 0, 0.6)).lerp(glow, clamp(noise3(cz * 2, cx * 2, cy * 2) * 1.5 - 0.35, 0, 0.5));
            const j = 0.93 + Math.random() * 0.14;
            for (let k = 0; k < 3; k++) col.push(c.r * j, c.g * j, c.b * j);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, emissive: 0x120c2a, emissiveIntensity: 1 })));

        // glowing "gravity lines" running around the planet
        const runeMat = new THREE.MeshBasicMaterial({ color: 0x5fe3ff, transparent: true, opacity: 0.85 });
        stage = { group, runeMat, runes: [] };
        [[Math.PI / 2, 0, 0], [0.5, 0, 1.1], [-0.6, 0, -0.9]].forEach(rot => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.4, 6, 160), runeMat);
            ring.rotation.set(rot[0], rot[1], rot[2]); group.add(ring);
        });
        // crystal spires pointing straight up from the ground (one instanced draw call)
        const spireGeo = new THREE.ConeGeometry(1.3, 9, 5), spireMat = new THREE.MeshStandardMaterial({ color: 0x7ee0ff, emissive: 0x2aa0d0, emissiveIntensity: 0.9, roughness: 0.3, flatShading: true });
        const SP = 46, spires = new THREE.InstancedMesh(spireGeo, spireMat, SP), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = V3(0, 1, 0);
        for (let i = 0; i < SP; i++) {
            const d = V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), s = 0.6 + Math.random() * 1.1;
            q4.setFromUnitVectors(up, d); m4.compose(d.clone().multiplyScalar(R + 3.5 * s), q4, V3(s, s * (0.8 + Math.random() * 0.8), s)); spires.setMatrixAt(i, m4);
        }
        group.add(spires);
        // craters
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x1f1a38, roughness: 1, flatShading: true });
        for (let i = 0; i < 12; i++) {
            const d = V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), r = 5 + Math.random() * 6;
            const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 1.1, 6, 20), rimMat);
            rim.quaternion.setFromUnitVectors(V3(0, 0, 1), d); rim.position.copy(d.clone().multiplyScalar(R + 0.2)); group.add(rim);
        }
        // atmosphere glow
        group.add(new THREE.Mesh(new THREE.SphereGeometry(R + 5, 32, 24), new THREE.MeshBasicMaterial({ color: 0x7a5cff, transparent: true, opacity: 0.1, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
        // floating rocks drifting around the planet
        const FR = 44, rockGeo = new THREE.IcosahedronGeometry(1, 0), rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x5a527a, roughness: 1, flatShading: true }), FR);
        for (let i = 0; i < FR; i++) {
            const d = V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), s = 1 + Math.random() * 3.5;
            q4.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); m4.compose(d.multiplyScalar(R + 22 + Math.random() * 40), q4, V3(s, s * 0.8, s)); rocks.setMatrixAt(i, m4);
        }
        const orbit = new THREE.Group(); orbit.add(rocks); group.add(orbit); stage.orbit = orbit;
        scene.add(group); stage.group = group;
        // stars
        const sg = new THREE.BufferGeometry(), sp = [];
        for (let i = 0; i < 900; i++) { const d = V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(850); sp.push(d.x, d.y, d.z); }
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        stage.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, fog: false }));
        scene.add(stage.stars);
    }

    // The boss: a body of floating rocks round a tiny black hole. Local space: +y up, +z forward, about 5.6 tall.
    function buildBoss() {
        const ow = overworld3d, root = new THREE.Group();
        const mats = [0xa59cb8, 0xc2b8d2, 0x8a8098].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true, emissive: 0x2a1a50 }));
        const rocks = []; // every rock: { m, base, size, kind, ph, ... }
        const geo = new THREE.IcosahedronGeometry(1, 0);
        const add = (x, y, z, size, kind, extra = {}, parent = root) => {
            const m = new THREE.Mesh(geo, mats[Math.floor(Math.random() * 3)]); m.scale.setScalar(size); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            m.position.set(x, y, z); parent.add(m);
            const r = Object.assign({ m, base: V3(x, y, z), size, kind, ph: Math.random() * 6.28, vel: V3(), spin: V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) }, extra);
            rocks.push(r); return r;
        };
        // the black hole: a black sphere, a glowing accretion disc, and a dark violet halo
        const hole = new THREE.Group(); hole.position.set(0, 3.0, 0.15); root.add(hole);
        hole.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 22, 16), new THREE.MeshBasicMaterial({ color: 0x000000 })));
        const discTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'); const g = cx.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,170,60,0.95)'); g.addColorStop(0.65, 'rgba(160,80,255,0.7)'); g.addColorStop(1, 'rgba(60,20,120,0)'); cx.fillStyle = g; cx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
        const disc = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        disc.rotation.x = Math.PI / 2 - 0.35; hole.add(disc);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(90,40,200,0.55)', 'rgba(40,10,100,0)'), transparent: true, depthWrite: false }));
        halo.scale.set(10, 10, 1); hole.add(halo);
        const holeLight = new THREE.PointLight(0xb08aff, 2.2, 70); hole.add(holeLight);
        // orbiting rocks (the "body" ring)
        for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; add(Math.cos(a) * 1.75, 3.0 + Math.sin(i * 1.7) * 0.9, Math.sin(a) * 1.75, 0.42 + (i % 3) * 0.12, 'orbit', { ang: a, rad: 1.75, y0: 3.0 + Math.sin(i * 1.7) * 0.9, spd: 0.5 + (i % 3) * 0.15 }); }
        // head with glowing eyes, shoulders, arms, legs
        const head = add(0, 4.95, 0.1, 0.95, 'limb');
        [-0.3, 0.3].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7ffcff })); e.position.set(x, 5.0, 0.95); root.add(e); });
        add(-1.55, 3.95, 0, 0.72, 'limb'); add(1.55, 3.95, 0, 0.72, 'limb');
        add(-2.0, 3.0, 0.3, 0.5, 'limb'); add(-2.3, 2.1, 0.75, 0.66, 'limb');
        add(2.0, 3.0, 0.3, 0.5, 'limb'); const rHand = add(2.35, 2.2, 0.85, 0.72, 'limb');
        [-1, 1].forEach(s => { add(s * 0.8, 1.65, 0, 0.62, 'limb'); add(s * 0.85, 0.9, 0.05, 0.56, 'limb'); add(s * 0.85, 0.32, 0.2, 0.62, 'limb'); });
        // the hammer: a handle of rocks and a big blocky head, hinged at the right hand
        const hinge = new THREE.Group(); hinge.position.copy(rHand.base); root.add(hinge);
        const hammerMat = new THREE.MeshStandardMaterial({ color: 0x7a7090, roughness: 0.8, flatShading: true, emissive: 0x4a22a0 });
        [0.9, 1.8, 2.7, 3.6].forEach(y => { const m = new THREE.Mesh(geo, mats[1]); m.scale.setScalar(0.5); m.position.set(0, y, 0); hinge.add(m); });
        [[0, 4.6, 0, 1.75], [-1.45, 4.5, 0.05, 1.25], [1.45, 4.5, -0.05, 1.25]].forEach(([x, y, z, s]) => { const m = new THREE.Mesh(geo, hammerMat); m.scale.set(s, s * 0.9, s * 1.1); m.position.set(x, y, z); m.rotation.set(Math.random(), Math.random(), Math.random()); hinge.add(m); });
        const runeMat = new THREE.MeshBasicMaterial({ color: 0xd2a8ff }); [[0, 4.6, 1.9], [-1.45, 4.5, 1.35], [1.45, 4.5, 1.35]].forEach(([x, y, z]) => { const rn = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.2, 0.28), runeMat); rn.position.set(x, y, z); hinge.add(rn); });
        ow.scene.add(root);
        boss = { root, rocks, mats, hole, disc, halo, holeLight, hinge, head, hammerAng: -0.55, flash: 0, scale: 1 };
        // everything that can fall apart: all the rocks and eyes, plus every piece of the hammer
        boss.parts = [...root.children.filter(c => c !== hole && c !== hinge), ...hinge.children].map(m => ({ m, vel: V3(), spin: V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) }));
        X.boss = boss;
    }

    // ------------------------------------------------------------------ effects on the sphere surface
    function surfaceDisc(dir, radius, dur, color, opts = {}) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
        const m = new THREE.Mesh(opts.ring ? new THREE.RingGeometry(0.86, 1, 56) : new THREE.CircleGeometry(1, 44), mat);
        m.quaternion.setFromUnitVectors(V3(0, 0, 1), dir); m.position.copy(worldPos(dir, 0.3)); m.scale.set(opts.ring ? 0.2 : radius * 0.55, opts.ring ? 0.2 : radius * 0.55, 1);
        overworld3d.scene.add(m); fx.push({ kind: opts.ring ? 'ring' : 'tele', m, mat, t: 0, dur, radius });
    }
    function burst(dir, h, count, color, size = 0.7) {
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size * (0.5 + Math.random()), 0), new THREE.MeshBasicMaterial({ color, transparent: true }));
            const p = worldPos(dir, h); m.position.copy(p); overworld3d.scene.add(m);
            const v = V3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 20);
            const up = dir.clone(); const out = v.x * 0 + 0; // (velocity expressed in the ground's frame)
            const b = quatFor(dir, V3(0, 0, 1).cross(dir).lengthSq() > 0.01 ? V3(0, 0, 1) : V3(1, 0, 0));
            fx.push({ kind: 'chunk', m, t: 0, dur: 0.9 + Math.random() * 0.5, v: v.applyQuaternion(b), up });
        }
    }
    function updateFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i]; f.t += dt; const p = Math.min(1, f.t / f.dur);
            if (f.kind === 'tele') { f.mat.opacity = 0.12 + 0.3 * p + Math.sin(f.t * 16) * 0.05; const s = f.radius * (0.55 + 0.45 * p); f.m.scale.set(s, s, 1); }
            else if (f.kind === 'ring') { const s = f.radius * (0.2 + 0.8 * p); f.m.scale.set(s, s, 1); f.mat.opacity = 0.9 * (1 - p); }
            else if (f.kind === 'chunk') { f.v.addScaledVector(f.up, -60 * dt); f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += dt * 6; f.m.material.opacity = 1 - p; }
            if (f.t >= f.dur) { overworld3d.scene.remove(f.m); if (f.m.geometry) f.m.geometry.dispose(); if (f.m.material) f.m.material.dispose(); fx.splice(i, 1); }
        }
    }

    // ------------------------------------------------------------------ the player on the planet
    function startPlayer() {
        const ow = overworld3d;
        P = { dir: V3(0, 1, 0), h: 0, vh: 0, heading: V3(0, 0, -1), camFwd: V3(0, 0, -1), pull: false, faceHold: 0, grounded: true };
        // carry the player's model onto a pivot that we rotate to match the ground
        P.pivot = new THREE.Group(); ow.scene.add(P.pivot);
        ow.scene.remove(ow.playerObj); P.pivot.add(ow.playerObj); ow.playerObj.position.set(0, 0, 0); ow.playerObj.rotation.set(0, 0, 0);
        if (ow.companionObj) { P.cpivot = new THREE.Group(); ow.scene.remove(ow.companionObj); P.cpivot.add(ow.companionObj); ow.companionObj.position.set(0, 0, 0); ow.companionObj.rotation.set(0, 0, 0); ow.scene.add(P.cpivot); P.cdir = V3(0.1, 1, 0.1).normalize(); P.cfwd = V3(0, 0, -1); }
        if (!listeners) {
            listeners = true;
            document.addEventListener('mousemove', (e) => {
                if (!X.active || !document.pointerLockElement || gameSystem.state !== 'core') return;
                P.camFwd.applyAxisAngle(P.dir, -e.movementX * 0.0026);
                camPitch = clamp(camPitch + e.movementY * 0.0022, -0.05, 1.15);
            });
        }
    }

    function playerAlive() { return gameSystem.party[0] && gameSystem.party[0].hp > 0; }

    function updatePlayer(dt) {
        const ow = overworld3d, k = ow.keys;
        const up = P.dir, f = flatten(P.camFwd, up); P.camFwd.copy(f);
        const right = V3().crossVectors(f, up).normalize();
        let mx = 0, mz = 0;
        if (k['w'] || k['arrowup']) mz += 1; if (k['s'] || k['arrowdown']) mz -= 1;
        if (k['d'] || k['arrowright']) mx += 1; if (k['a'] || k['arrowleft']) mx -= 1;
        if (ow.stick && ow.stick.active) { mx = ow.stick.x; mz = ow.stick.y; }   // phone joystick
        const mag = Math.min(1, Math.hypot(mx, mz));
        const move = f.clone().multiplyScalar(mz).addScaledVector(right, mx);
        const moving = move.lengthSq() > 0.01;
        let speed = 0;
        if (moving) {
            move.normalize(); speed = RUN * Math.max(0.35, mag) * (P.h > 0.1 ? 0.9 : 1);
            travel(P.dir, [P.camFwd, P.heading], move.clone().multiplyScalar(speed * dt));
            // turn to face where you're running
            P.heading.lerp(flatten(move, P.dir), 1 - Math.exp(-14 * dt)); P.heading.copy(flatten(P.heading, P.dir));
        } else if (P.faceHold <= 0) P.heading.copy(flatten(P.heading, P.dir));
        if (P.faceHold > 0) { P.faceHold -= dt; if (B) P.heading.lerp(towardTangent(P.dir, B.dir), 1 - Math.exp(-25 * dt)); P.heading.copy(flatten(P.heading, P.dir)); }
        // jumping / gravity (toward the planet's centre)
        if (k[' '] && P.grounded) { P.vh = JUMP_V; P.grounded = false; Sound.play('jump'); }
        P.vh -= GRAV * dt; P.h += P.vh * dt;
        if (P.h <= 0) { if (!P.grounded && P.vh < -20) Sound.play('land'); P.h = 0; P.vh = 0; P.grounded = true; }
        else P.grounded = false;
        P.speed = speed;
        if (moving && P.grounded) { stepDist += speed * dt; if (stepDist > 6.8) { stepDist = 0; Sound.step('stone'); } }
        // boss black hole pulling you in
        if (P.pull && B) { const d = arc(P.dir, B.dir); if (d > 7) travelToward(P.dir, [P.camFwd, P.heading], B.dir, 33 * dt); }
        // stamina / mana regen like the overworld
        const pl = gameSystem.party[0]; pl.stamina = Math.min(pl.maxStamina, pl.stamina + 15 * dt); pl.mp = Math.min(pl.maxMp, pl.mp + 3 * dt);
    }

    // ------------------------------------------------------------------ the boss fight
    function newBoss() {
        const maxHp = Math.round(520 * (gameSystem.difficultyMultiplier || 1));
        const dir = V3(0, 1, 0); const axis = V3(1, 0, 0); dir.applyAxisAngle(axis, 1.7);
        B = { dir, heading: towardTangent(dir, V3(0, 1, 0)), hp: maxHp, maxHp, atk: Math.max(1, Math.round(24 * (gameSystem.difficultyMultiplier || 1))),
              phase: 1, state: 'intro', st: 0, cdPull: 2.5, cdHammer: 1.2, cdMeteor: 3, pulling: false, invuln: false, slamDir: null, slamDone: false, dead: false };
    }

    function setState(s) { B.state = s; B.st = 0; B.slamDone = false; B.tele = false; }

    function updateBoss(dt, live) {
        if (!B || B.dead) return;
        if (B.state === 'intro') { if (live) setState('chase'); return; }
        if (!live) return;                 // (frozen during dialogue / pause: the attack timers hold still)
        B.st += dt;
        const dist = arc(P.dir, B.dir), spd = B.phase === 2 ? 20 : 16;
        const faceTo = (rate = 6) => { B.heading.lerp(towardTangent(B.dir, P.dir), 1 - Math.exp(-rate * dt)); B.heading.copy(flatten(B.heading, B.dir)); };
        B.cdPull -= dt; B.cdHammer -= dt;
        P.pull = false;

        if (B.state === 'chase') {
            faceTo(7);
            if (dist > 6) travelToward(B.dir, [B.heading], P.dir, spd * dt);
            if (dist < 14 && B.cdHammer <= 0) { setState('hammer'); Sound.play('roar'); }
            else if (dist > 15 && dist < 80 && B.cdPull <= 0) { setState('pullWind'); Sound.play('suck'); }
        } else if (B.state === 'pullWind') {
            faceTo(5); if (B.st >= 0.9) setState('pull');
        } else if (B.state === 'pull') {
            faceTo(5); P.pull = true;
            if (B.st >= 2.6 || dist <= 8) {
                B.cdPull = B.phase === 2 ? 4.2 : 5.5;
                if (dist < 18) { B.cdHammer = 0; setState('hammer'); Sound.play('roar'); }
                else setState('chase');
            }
        } else if (B.state === 'hammer') {
            if (B.st < 0.45) faceTo(8);
            else if (!B.tele) { B.tele = true; B.slamDir = slamPoint(); surfaceDisc(B.slamDir, 11, 0.55, 0xff5a3a); }   // warning circle where the hammer will land
            if (!B.slamDone && B.st >= 1.0) {   // SLAM
                B.slamDone = true; B.slamDir = slamPoint();
                surfaceDisc(B.slamDir, 14, 0.6, 0xffc07a, { ring: true }); burst(B.slamDir, 0.5, 14, 0xb9a8d0, 0.9);
                Sound.play('slam'); camShake = 1;
                if (arc(P.dir, B.slamDir) < 11 && P.h < 2.8 && playerAlive()) combatSystem.damagePlayer(B.atk);
            }
            if (B.st >= 1.0 + 1.5) { B.cdHammer = B.phase === 2 ? 1.6 : 2.2; setState('chase'); }
        } else if (B.state === 'roar') {
            if (B.st >= 2.6) { B.invuln = false; setState('chase'); }
        }
        // phase 2: portals and meteors on their own timer
        if (B.phase === 2 && B.state !== 'roar') {
            B.cdMeteor -= dt;
            if (B.cdMeteor <= 0) { meteorVolley(); B.cdMeteor = 6.2; }
        }
    }

    const slamPoint = () => { const d = B.dir.clone(), h = B.heading.clone(); travel(d, [h], h.clone().multiplyScalar(5.2)); return d; };

    function hurtBoss(amount) {
        if (!B || B.dead || B.invuln || B.state === 'intro') return;
        B.hp = Math.max(0, B.hp - amount); boss.flash = 0.14; Sound.play('hit');
        if (B.hp <= 0) { dieBoss(); return; }
        if (B.phase === 1 && B.hp <= B.maxHp * 0.5) {
            B.phase = 2; B.invuln = true; setState('roar'); B.cdMeteor = 2.4; B.cdPull = 4; P.pull = false;
            Sound.play('roar'); camShake = 1.6; gameSystem.showToast('Graton’s black hole roars to life! Portals are opening...');
            burst(B.dir, 3, 16, 0xa77aff, 1.1);
        }
    }

    function dieBoss() {
        B.dead = true; B.state = 'dying'; B.st = 0; P.pull = false;
        boss.parts.forEach(p => { p.vel.set((Math.random() - 0.5) * 16, 6 + Math.random() * 10, (Math.random() - 0.5) * 16); });
        Sound.play('kill'); Sound.play('fanfare'); camShake = 1.8;
        setTimeout(() => gameSystem.onCoreBossDefeated(), 3200);
    }

    // ---- meteors and portals (phase 2)
    function meteorVolley() {
        const n = 4 + (B.hp < B.maxHp * 0.25 ? 2 : 0);
        for (let i = 0; i < n; i++) {
            const d = P.dir.clone();
            if (i > 0) { // scatter the rest around you; the first one is aimed straight at you
                const axis = V3().crossVectors(d, V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)).normalize();
                d.applyAxisAngle(axis, (6 + Math.random() * 20) / R);
            }
            spawnMeteor(d, i * 0.4);
        }
    }
    function spawnMeteor(dir, delay) {
        const g = new THREE.Group();
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a4a52, roughness: 1, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0.7 });
        const a = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), rockMat), b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), rockMat); b.position.set(1.9, 0.8, 0.5);
        const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,160,60,0.9)', 'rgba(255,60,0,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fire.scale.set(12, 12, 1);
        g.add(a); g.add(b); g.add(fire); g.visible = false; overworld3d.scene.add(g);
        // portal in the sky above the landing spot
        const portal = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.5, 8, 36), new THREE.MeshBasicMaterial({ color: 0xb98aff, transparent: true, opacity: 0.95 }));
        const swirl = new THREE.Mesh(new THREE.CircleGeometry(5, 32), new THREE.MeshBasicMaterial({ color: 0x3a1a8a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
        portal.add(ring); portal.add(swirl); portal.quaternion.setFromUnitVectors(V3(0, 0, 1), dir); portal.position.copy(worldPos(dir, 78)); portal.scale.setScalar(0.01);
        overworld3d.scene.add(portal);
        const fallT = 1.15, wait = delay + 1.2;
        surfaceDisc(dir, 8, wait + fallT, 0xff3b2a);
        meteors.push({ g, portal, ring, dir: dir.clone(), t: 0, wait, fallT, landed: false });
        Sound.play('portal');
    }
    function updateMeteors(dt) {
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i]; m.t += dt;
            const open = clamp(m.t / 0.35, 0, 1) * (m.t > m.wait + m.fallT + 0.2 ? clamp(1 - (m.t - m.wait - m.fallT - 0.2) / 0.3, 0, 1) : 1);
            m.portal.scale.setScalar(Math.max(0.01, open)); m.ring.rotation.z += dt * 2;
            if (m.t >= m.wait && !m.landed) {
                const p = clamp((m.t - m.wait) / m.fallT, 0, 1), h = 78 * (1 - p * p);
                m.g.visible = true; m.g.position.copy(worldPos(m.dir, h + 2)); m.g.rotation.x += dt * 3; m.g.rotation.y += dt * 2;
                if (p >= 1) {
                    m.landed = true; m.g.visible = false;
                    surfaceDisc(m.dir, 11, 0.55, 0xffa050, { ring: true }); burst(m.dir, 0.5, 12, 0x7a6a72, 0.8); Sound.play('slam'); camShake = Math.max(camShake, 0.7);
                    if (P && arc(P.dir, m.dir) < 8.5 && P.h < 4 && playerAlive()) combatSystem.damagePlayer(B.atk * 0.85);
                }
            }
            if (m.t > m.wait + m.fallT + 0.6) { [m.g, m.portal].forEach(o => { overworld3d.scene.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }); meteors.splice(i, 1); }
        }
    }

    // ---- the player's attacks (called by the combat system when the swing / shot lands)
    function strike(style, weapon) {
        if (!B || B.dead) return;
        const power = combatSystem.computePower(weapon, null);
        if (style === 'melee') {
            if (arc(P.dir, B.dir) < 10.5) hurtBoss(power);
        } else {
            const g = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: weapon.playStyle === 'magick' ? 0x8fd6ff : 0xffe066 }));
            overworld3d.scene.add(g);
            orbs.push({ m: g, dir: P.dir.clone(), life: 2.4, power });
        }
    }
    function updateOrbs(dt) {
        for (let i = orbs.length - 1; i >= 0; i--) {
            const o = orbs[i]; o.life -= dt;
            if (B && !B.dead) travelToward(o.dir, [], B.dir, 85 * dt);
            o.m.position.copy(worldPos(o.dir, 3));
            if ((B && !B.dead && arc(o.dir, B.dir) < 4.5) || o.life <= 0) {
                if (o.life > 0) hurtBoss(o.power);
                overworld3d.scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); orbs.splice(i, 1);
            }
        }
    }
    // Swipe-to-look for touch screens (the mouse version is the mousemove listener in startPlayer)
    function lookBy(dx, dy) { if (!X.active || !P) return; P.camFwd.applyAxisAngle(P.dir, -dx * 0.0035); camPitch = clamp(camPitch + dy * 0.003, -0.05, 1.15); }
    function playerAttackStarted() { if (P) P.faceHold = 0.45; }

    // ------------------------------------------------------------------ visuals each frame
    function animateBoss(dt) {
        const tt = t, pulling = B && (B.state === 'pullWind' || B.state === 'pull'), dying = B && B.dead;
        const boost = pulling ? 1 : 0;
        boss.boost = (boss.boost || 0) + (boost - (boss.boost || 0)) * Math.min(1, dt * 5);
        if (dying) {   // Graton falls apart: rocks, eyes and the hammer all tumble away and shrink to nothing
            const shrink = Math.max(0, 1 - Math.max(0, B.st - 1.2) / 1.6);
            boss.parts.forEach(p => { p.m.position.addScaledVector(p.vel, dt); p.vel.y -= 14 * dt; p.m.rotation.x += p.spin.x * dt * 6; p.m.rotation.z += p.spin.z * dt * 6; p.m.scale.multiplyScalar(shrink > 0 ? Math.pow(shrink, dt * 2) : 0); });
            if (B.st > 3) boss.root.visible = false;
        } else boss.rocks.forEach(r => {
            if (r.kind === 'orbit') {
                r.ang += dt * r.spd * (1 + boss.boost * 4 + (B.state === 'roar' ? 2 : 0));
                const rad = r.rad * (1 - 0.4 * boss.boost) * (B.state === 'roar' ? 1.5 : 1);
                r.m.position.set(Math.cos(r.ang) * rad, r.y0 + Math.sin(tt * 1.4 + r.ph) * 0.25, Math.sin(r.ang) * rad);
            } else {
                const amp = 0.12 + (B.state === 'roar' ? 0.4 : 0);
                r.m.position.set(r.base.x + Math.sin(tt * 1.3 + r.ph) * amp, r.base.y + Math.sin(tt * 1.7 + r.ph * 2) * amp, r.base.z + Math.cos(tt * 1.1 + r.ph) * amp * 0.6);
            }
            r.m.rotation.x += r.spin.x * dt * 0.6; r.m.rotation.y += r.spin.y * dt * 0.6;
        });
        // hole: disc spins, swells when it's about to pull / roar
        const swell = 1 + boss.boost * 0.9 + (B.phase === 2 ? 0.35 : 0) + (B.state === 'roar' ? 0.8 : 0);
        boss.hole.scale.setScalar(dying ? Math.max(0.01, 1 - B.st * 0.5) : swell);
        boss.disc.rotation.z += dt * (2 + boss.boost * 8);
        boss.holeLight.intensity = (dying ? 3 : 1.1 + boss.boost * 2) + Math.sin(tt * 5) * 0.2;
        boss.halo.material.opacity = 0.7 + Math.sin(tt * 3) * 0.2;
        // hammer pose: rests on the shoulder, rises overhead in the wind-up, whips down on the slam
        let target = -0.55;
        if (B.state === 'hammer') { if (B.st < 1.0) target = -0.55 + (B.st / 1.0) * 0.75 - Math.sin(Math.min(1, B.st / 1.0) * Math.PI) * 0.2; else target = 2.25; }
        else if (B.state === 'pull' || B.state === 'pullWind') target = -0.2;
        boss.hammerAng += (target - boss.hammerAng) * Math.min(1, dt * (B.state === 'hammer' && B.st >= 1.0 ? 30 : 9));
        boss.hinge.rotation.x = boss.hammerAng;
        // hit flash
        if (boss.flash > 0) boss.flash -= dt;
        boss.mats.forEach(m => m.emissive.setHex(boss.flash > 0 ? 0xc02828 : (B.phase === 2 ? 0x5a2aa0 : 0x2a1a50)));
        boss.root.position.copy(worldPos(B.dir, 0));
        boss.root.quaternion.copy(quatFor(B.dir, B.heading));
    }

    function syncVisuals(dt, frozen) {
        const ow = overworld3d, cam = ow.camera, pl = gameSystem.party[0];
        // the player's model
        P.pivot.position.copy(worldPos(P.dir, P.h)); P.pivot.quaternion.copy(quatFor(P.dir, P.heading));
        const alive = playerAlive();
        Animations.update(ow.playerObj, dt, { speed: frozen || !alive ? 0 : (P.speed || 0), bob: false, airborne: !P.grounded, vy: P.vh / 60, landed: false });
        // Octa tags along
        if (P.cpivot) {
            const behind = P.dir.clone(); travel(behind, [], flatten(P.heading, P.dir).multiplyScalar(-4.5));
            const cdist = arc(P.cdir, behind); if (cdist > 0.3 && !frozen) travelToward(P.cdir, [P.cfwd], behind, Math.min(cdist, 40 * dt + cdist * 3 * dt));
            P.cfwd.copy(towardTangent(P.cdir, P.dir));
            P.cpivot.position.copy(worldPos(P.cdir, 0)); P.cpivot.quaternion.copy(quatFor(P.cdir, P.cfwd));
            Animations.update(ow.companionObj, dt, { speed: cdist > 1.5 ? 12 : 0, baseY: 0 });
        }
        // camera behind and above the player, looking along the ground, always upright relative to the planet
        const dist = 17, f = flatten(P.camFwd, P.dir), up = P.dir;
        const target = worldPos(P.dir, P.h + 3.4);
        const camPos = target.clone().addScaledVector(f, -dist * Math.cos(camPitch)).addScaledVector(up, 1.5 + dist * Math.sin(camPitch));
        if (camShake > 0) { camShake = Math.max(0, camShake - dt * 2.2); camPos.add(V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(camShake * 2.2)); }
        cam.position.copy(camPos); cam.up.copy(up); cam.lookAt(target); cam.updateMatrixWorld();
        // sky + sun follow the camera
        if (ow.skyDome) ow.skyDome.position.copy(cam.position);
        stage.stars.position.copy(cam.position);
        stage.orbit.rotation.y += dt * 0.025;
        stage.runeMat.opacity = 0.65 + Math.sin(t * 2) * 0.2;
        // boss health bar
        const cont = document.getElementById('boss-health-container');
        if (cont && B.dead) cont.classList.add('hidden');
        else if (cont) { cont.classList.remove('hidden'); const nm = document.getElementById('boss-name'); if (nm) nm.textContent = BOSS_NAME; const fl = document.getElementById('boss-health-fill'); if (fl) fl.style.width = `${Math.max(0, B.hp / B.maxHp * 100)}%`; }
    }

    function update(delta) {
        if (!built) return;
        const gs = gameSystem, dt = Math.min(delta, 0.05);
        const frozen = gs.state !== 'core' || gs.isCutscene;
        const live = !frozen && playerAlive();
        t += dt;
        if (live) { updatePlayer(dt); }
        else if (gs.state === 'core' && !playerAlive()) { P.speed = 0; }
        else { P.speed = 0; }
        P.pull = P.pull && live;
        updateBoss(dt, live);
        if (!frozen) { combatSystem.update(dt); updateOrbs(dt); updateMeteors(dt); }
        updateFx(dt);
        if (B.dead && B.state === 'dying') { B.st += dt; }
        animateBoss(dt);
        syncVisuals(dt, frozen);
    }

    // Move the game into the Gravity Core (called once the quicksand has swallowed the player).
    function begin() {
        const ow = overworld3d, gs = gameSystem;
        if (!built) { buildStage(); buildBoss(); built = true; }
        X.active = true;
        startPlayer(); newBoss();
        // the look of the place: deep violet space, no sun-glow, no clouds
        ow.scene.fog.color.set(0x0a0820); ow.scene.fog.near = 400; ow.scene.fog.far = 2200; ow.scene.background.set(0x05030f);
        if (ow.skyUniforms) { ow.skyUniforms.topColor.value.set(0x090620); ow.skyUniforms.horizonColor.value.set(0x24104a); ow.skyUniforms.groundColor.value.set(0x090620); ow.skyUniforms.sunGlow.value = 0; }
        if (ow.hemiLight) { ow.hemiLight.intensity = 0.7; ow.hemiLight.color.set(0x9a8cff); ow.hemiLight.groundColor.set(0x241a52); }
        if (ow.sunLight) { ow.sunLight.castShadow = false; ow.sunLight.intensity = 1.25; ow.sunLight.color.set(0xd6e4ff); ow.sunLight.position.copy(C).add(V3(220, 180, 140)); ow.sunLight.target.position.copy(C); ow.sunLight.target.updateMatrixWorld(); }
        if (ow.sunGroup) ow.sunGroup.visible = false; if (ow.clouds) ow.clouds.visible = false; if (ow.motes) ow.motes.visible = false;
        if (ow.lightPool) ow.lightPool.forEach(l => { l.intensity = 0; });
        ['compass', 'objective'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('on'); });
        if (window.Quest && Quest.hide) Quest.hide();
        // place the player at the start and the boss across the planet
        P.camFwd.copy(towardTangent(P.dir, B.dir)); P.heading.copy(P.camFwd);
        gs.state = 'core';
        Sound.setMood('core');
        update(0.001);
    }

    // Leave the Gravity Core for good (after Graton falls): put the party back in the normal world and bring the sun back.
    function leave() {
        const ow = overworld3d, gs = gameSystem;
        X.active = false;
        if (P && P.pivot) { P.pivot.remove(ow.playerObj); ow.scene.add(ow.playerObj); ow.playerObj.rotation.set(0, 0, 0); ow.scene.remove(P.pivot); }
        if (P && P.cpivot && ow.companionObj) { P.cpivot.remove(ow.companionObj); ow.scene.add(ow.companionObj); ow.companionObj.rotation.set(0, 0, 0); ow.scene.remove(P.cpivot); }
        if (stage && stage.group) stage.group.visible = false;
        if (stage && stage.stars) stage.stars.visible = false;
        if (boss && boss.root) boss.root.visible = false;
        if (ow.sunGroup) ow.sunGroup.visible = true; if (ow.clouds) ow.clouds.visible = true; if (ow.motes) ow.motes.visible = true;
        if (ow.sunLight) ow.sunLight.castShadow = true;
        gs.state = 'overworld';
    }

    return {
        get active() { return X.active; }, begin, leave, update, strike, playerAttackStarted, lookBy,
        get boss() { return B; }, get player() { return P; }, get meteors() { return meteors; }, BOSS_NAME, R, C
    };
})();
window.GravityCore = GravityCore;
