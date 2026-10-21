// Procedural character animation. No keyframes or imported clips: every pose is computed each frame
// from simple math (sine-wave walk cycles, eased swings), in the spirit of blocky-game limb animation
// (arms and legs swinging in opposition, a weapon swing, a flinch when hit, toppling over when KO'd).
//
// Rigs are discovered from the named parts a model was built with (see VoxelBuilder / models3d.js):
//   human   -> arm_l arm_r leg_l leg_r head torso         (player, shopkeeper)
//   octopus -> tent_0..tent_7                             (Octa, Barnico)
//   crab    -> pinch_l pinch_r                            (crab minions, Croton)
//   king    -> arm_l arm_r hem staff_loop                 (Oblongtalo)
//   eel     -> seg_0..seg_7 spk_*                         (electric eels)
//   firefish-> mouth fin_l fin_r tail crest_*             (fire fish)
//   snake   -> sseg_0..sseg_8 venom_l venom_r             (dune vipers; fade out to camouflage)
//   scortus -> tail_0 tail_1 pinch_l pinch_r              (scorpion-cactus)
const Animations = (() => {
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const angleLerp = (a, b, t) => { const d = ((((b - a) + Math.PI) % TAU) + TAU) % TAU - Math.PI; return a + d * t; };
    let DT = 1 / 60;

    // How long each attack animation lasts, and the moment (seconds in) the blow actually lands.
    // Combat uses `strike` to delay enemy damage until the claw comes down, which gives you time to react.
    const ATTACKS = {
        melee:  { dur: 0.38, strike: 0.15 },   // player sword swing
        range:  { dur: 0.34, strike: 0.10 },   // player bow
        magick: { dur: 0.44, strike: 0.14 },   // player spell cast
        pinch:  { dur: 0.60, strike: 0.40 },   // crab minion snip
        claw:   { dur: 0.90, strike: 0.62 },   // Croton's claw slam
        wave:   { dur: 1.40, strike: 1.00 },   // Croton's wave summon
        zap:    { dur: 1.10, strike: 0.70 },   // electric eel: coils up, then shocks everything nearby
        spit:   { dur: 1.00, strike: 0.60 },   // fire fish: puffs up, then spits a spray of sparks
        venom:  { dur: 1.10, strike: 0.65 },   // dune viper: rears up, cheeks swell, lobs a glob of poison
        needle: { dur: 1.10, strike: 0.65 }    // Scortus: arches its tail over its head, then fires a needle
    };

    function rig(g) {
        let r = g.userData.rig;
        if (r) return r;
        r = { parts: {}, t: Math.random() * 20, phase: 0, atk: null, atkT: 0, hurtT: -1, deathT: -1, s: {},
              kind: 'generic', squash: 0, yaw: g.rotation.y };
        g.traverse(o => { if (o.name && o !== g) r.parts[o.name] = o; });
        for (const n in r.parts) {
            const p = r.parts[n];
            p.userData.rest = { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z, px: p.position.x, py: p.position.y, pz: p.position.z, sx: p.scale.x, sy: p.scale.y, sz: p.scale.z };
        }
        const P = r.parts;
        if (P.staff_loop && P.hem) r.kind = 'king';
        else if (P.arm_l && P.head) r.kind = 'human';
        else if (P.tail_0 && P.pinch_l) r.kind = 'scortus';
        else if (P.pinch_l) r.kind = 'crab';
        else if (P.sseg_0 && P.sseg_1) r.kind = 'snake';
        else if (P.tent_0) r.kind = 'octopus';
        else if (P.seg_0 && P.seg_1) r.kind = 'eel';
        else if (P.mouth && P.fin_l) r.kind = 'firefish';
        g.rotation.order = 'YXZ'; // yaw first, then lean in the body's own frame
        g.userData.rig = r;
        g.userData.rigged = true; // tells the world loop not to apply its generic idle bob
        return r;
    }

    // Smoothly chase a target value (so poses blend instead of snapping between states).
    function S(r, key, target, rate = 14) {
        if (r.s[key] === undefined) r.s[key] = target;
        r.s[key] = lerp(r.s[key], target, 1 - Math.exp(-rate * DT));
        return r.s[key];
    }
    function pose(r, name, x = 0, y = 0, z = 0) {
        const p = r.parts[name];
        if (!p) return;
        const q = p.userData.rest;
        p.rotation.set(q.x + x, q.y + y, q.z + z);
    }

    // ---------------------------------------------------------------- human
    function human(g, r, dt, c) {
        const t = r.t, speed = c.speed || 0;
        let aLx = 0, aRx = 0, aLz = 0, aRz = 0, lLx = 0, lRx = 0, headX = 0, headY = 0, torsoY = 0, lean = 0, bob = 0;
        const moving = speed > 1.5;

        if (r.deathT >= 0) {
            // Knocked out: stagger and topple over backwards, arms flung out
            const p = ease(r.deathT / 0.7);
            lean = -1.5 * p; aLz = -1.1 * p; aRz = 1.1 * p; aLx = -0.4 * p; aRx = -0.4 * p; headX = -0.5 * p;
        } else if (c.climbing) {
            r.phase += dt * (c.climbMoving ? 7.5 : 0);
            const s = Math.sin(r.phase);
            aLx = -2.55 + s * 0.55; aRx = -2.55 - s * 0.55; lLx = -0.55 * s - 0.2; lRx = 0.55 * s - 0.2; headX = -0.35; lean = 0.05;
        } else if (c.swimming) {
            r.phase += dt * (3.2 + speed * 0.22);
            const s = Math.sin(r.phase);
            lean = 1.05; aLx = -2.3 + s * 0.9; aRx = -2.3 - s * 0.9; lLx = s * 0.55; lRx = -s * 0.55; headX = -0.75;
            bob = Math.sin(t * 3.4) * 0.06;
        } else if (c.gliding) {
            lean = 0.42; aLz = -1.45; aRz = 1.45; aLx = -0.25; aRx = -0.25; lLx = 0.3; lRx = 0.3; headX = -0.2;
        } else if (c.airborne) {
            if (c.vy > 0) { aLx = -1.0; aRx = -1.0; aLz = -0.55; aRz = 0.55; lLx = 0.35; lRx = -0.75; lean = 0.08; }   // rising: arms up, knee tucked
            else { aLz = -1.0; aRz = 1.0; aLx = -0.15; aRx = -0.15; lLx = -0.25; lRx = 0.4; lean = 0.05; }              // falling: arms out for balance
        } else if (moving) {
            r.phase += dt * clamp(speed, 0, 60) * 0.46;
            const amp = clamp(speed / 18, 0.3, 1);
            const s = Math.cos(r.phase) * amp * 0.95;
            lLx = s; lRx = -s; aLx = -s * 0.85; aRx = s * 0.85; torsoY = s * 0.14;
            bob = Math.abs(Math.sin(r.phase)) * 0.14 * amp; lean = 0.14 * amp;
            headY = -torsoY * 0.8;
        } else {
            // Idle: breathing, a slow look-around, and a loosely swinging arm
            aLz = Math.sin(t * 1.5) * 0.035; aRz = -Math.sin(t * 1.5) * 0.035;
            aLx = Math.sin(t * 1.1) * 0.05; aRx = -Math.sin(t * 1.1) * 0.05;
            headY = Math.sin(t * 0.55) * 0.22; headX = Math.sin(t * 0.8) * 0.05;
            bob = Math.sin(t * 1.8) * 0.02;
        }

        // Look toward whatever the caller wants (villagers watch you walk by)
        if (c.lookYaw !== undefined && !moving && r.deathT < 0) headY = clamp(c.lookYaw, -0.95, 0.95);

        // Attack swings override the arms
        if (r.atk && r.deathT < 0) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1);
            if (r.atk === 'melee') {
                if (p < 0.35) { const e = ease(p / 0.35); aRx = lerp(aRx, -2.7, e); aLx = lerp(aLx, -0.5, e); torsoY = lerp(torsoY, 0.6, e); lean = lerp(lean, -0.12, e); }
                else if (p < 0.68) { const e = ease((p - 0.35) / 0.33); aRx = lerp(-2.7, 0.85, e); aLx = -0.5 * (1 - e); torsoY = lerp(0.6, -0.75, e); lean = lerp(-0.12, 0.32, e); lLx = -0.3 * e; lRx = 0.3 * e; }
                else { const e = ease((p - 0.68) / 0.32); aRx = lerp(0.85, 0, e); torsoY = lerp(-0.75, 0, e); lean = lerp(0.32, 0, e); }
            } else if (r.atk === 'range') {
                const draw = ease(p / 0.55), rel = p > 0.55 ? ease((p - 0.55) / 0.45) : 0;
                aLx = lerp(aLx, -1.55, draw); aRx = lerp(aRx, -1.4, draw); aRz = lerp(aRz, 0.5, draw) * (1 - rel); torsoY = 0.35 * draw * (1 - rel); headX = 0.0; lean = 0.05;
            } else if (r.atk === 'magick') {
                const up = ease(p / 0.45), down = p > 0.6 ? ease((p - 0.6) / 0.4) : 0;
                aRx = lerp(aRx, -3.0, up) * (1 - down) + 0.4 * down; aLx = lerp(aLx, -0.9, up) * (1 - down); headX = -0.35 * up * (1 - down);
                lean = lerp(0, -0.18, up) * (1 - down) + 0.22 * down;
            }
            r.atkT += dt;
            if (r.atkT >= k.dur) { r.atk = null; }
        }

        // Flinch when hit: whole upper body snaps back, then recovers
        if (r.hurtT >= 0 && r.deathT < 0) {
            const p = clamp(r.hurtT / 0.38, 0, 1), k = Math.pow(1 - p, 2);
            lean -= 0.5 * k; headX -= 0.4 * k; aLz -= 0.5 * k; aRz += 0.5 * k;
            r.hurtT += dt; if (r.hurtT >= 0.38) r.hurtT = -1;
        }
        if (r.deathT >= 0) r.deathT += dt;

        // Landing squash
        if (c.landed) r.squash = 1;
        r.squash = Math.max(0, r.squash - dt * 6);

        pose(r, 'leg_l', S(r, 'lLx', lLx, 22)); pose(r, 'leg_r', S(r, 'lRx', lRx, 22));
        pose(r, 'arm_l', S(r, 'aLx', aLx, 26), 0, S(r, 'aLz', aLz, 20)); pose(r, 'arm_r', S(r, 'aRx', aRx, 26), 0, S(r, 'aRz', aRz, 20));
        pose(r, 'head', S(r, 'hx', headX, 12), S(r, 'hy', headY, 10), 0);
        pose(r, 'torso', 0, S(r, 'ty', torsoY, 22), 0);
        const body = S(r, 'lean', lean, 12);
        g.rotation.x = body;
        const sq = r.squash;
        g.scale.set(1 + 0.1 * sq, 1 - 0.14 * sq, 1 + 0.1 * sq);
        return bob;
    }

    // ---------------------------------------------------------------- crabs (minions + Croton)
    function crab(g, r, dt, c) {
        const t = r.t, moving = (c.speed || 0) > 0.8;
        r.phase += dt * (moving ? 22 : 0);
        let wob = moving ? Math.sin(r.phase) * 0.09 : 0;
        let bob = moving ? Math.abs(Math.sin(r.phase)) * 0.16 : Math.sin(t * 2.1) * 0.03;
        let lean = c.aggro ? 0.08 : 0, clawX = Math.sin(t * 2.2) * 0.12, clawZ = 0, sy = 1, sz = 1;
        if (c.aggro) { clawX = -0.5 + Math.sin(t * 9) * 0.16; clawZ = 0.12; } // claws up and snapping

        if (r.atk) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1), sp = k.strike / k.dur;
            if (p < sp) { // wind-up: rear back with claws raised high (the warning that a hit is coming)
                const e = ease(p / sp);
                clawX = lerp(clawX, r.atk === 'wave' ? -2.5 : -1.75, e); clawZ = lerp(clawZ, 0.5, e); lean = lerp(lean, -0.3, e);
                sy = 1 + 0.07 * e; bob += (r.atk === 'wave' ? 0.9 : 0.25) * e;
            } else {       // strike: slam down and lunge, then settle
                const u = (p - sp) / (1 - sp), slam = ease(u * 2.6), settle = u > 0.4 ? ease((u - 0.4) / 0.6) : 0;
                clawX = lerp(-1.75, 0.65, slam) * (1 - settle) + clawX * settle; clawZ = lerp(0.5, 0, slam); lean = lerp(-0.3, 0.38, slam) * (1 - settle);
                sz = 1 + 0.16 * (1 - settle) * slam; sy = 1 - 0.1 * slam * (1 - settle); bob -= 0.1 * slam;
            }
            r.atkT += dt; if (r.atkT >= k.dur) r.atk = null;
        }
        if (r.hurtT >= 0) { // squash when hit
            const p = clamp(r.hurtT / 0.3, 0, 1), k = Math.pow(1 - p, 2);
            sy *= 1 - 0.22 * k; sz *= 1 + 0.12 * k; lean -= 0.25 * k; r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1;
        }
        const ws = S(r, 'wob', wob, 18), cx = S(r, 'cx', clawX, 16), cz = S(r, 'cz', clawZ, 16);
        pose(r, 'pinch_l', cx, 0, -cz); pose(r, 'pinch_r', cx, 0, cz);
        g.rotation.z = ws; g.rotation.x = S(r, 'lean', lean, 12);
        const base = g.userData.baseScale || (g.userData.baseScale = g.scale.x);
        g.scale.set(base, base * S(r, 'sy', sy, 18), base * S(r, 'sz', sz, 18));
        // Croton: the staff orb pulses
        const orb = r.parts.staff_orb; if (orb) { const k = 1 + Math.sin(t * 3) * 0.14 + (r.atk === 'wave' ? 0.4 : 0); orb.scale.setScalar(k * (orb.userData.rest.sx)); }
        return bob;
    }

    // ---------------------------------------------------------------- octopuses (Octa, Barnico)
    function octopus(g, r, dt, c) {
        const t = r.t, speed = c.speed || 0, moving = speed > 1.5, calm = !!c.calm;
        r.phase += dt * (moving ? 12 : 0);
        const amp = 1 + clamp(speed * 0.04, 0, 1.6);
        for (let i = 0; i < 8; i++) {
            const p = r.parts['tent_' + i]; if (!p) continue;
            let x = Math.sin(t * (calm ? 1.7 : 2.4) + i * 0.9) * 0.16 * amp, z = Math.cos(t * (calm ? 1.4 : 2.0) + i * 0.9) * 0.16 * amp;
            if (moving) x += Math.sin(r.phase + i * 0.8) * 0.3;
            if (c.greet && i === 0) { x = -1.9 + Math.sin(t * 7) * 0.45; z = 0.3; }  // one tentacle waves hello
            pose(r, 'tent_' + i, S(r, 'tx' + i, x, 14), 0, S(r, 'tz' + i, z, 14));
        }
        let bob = moving ? Math.abs(Math.sin(r.phase)) * 0.4 : Math.sin(t * (calm ? 1.4 : 3.0)) * (calm ? 0.04 : 0.07);
        const breathe = 1 + Math.sin(t * (calm ? 1.6 : 2.6)) * 0.018;
        let sy = breathe;
        if (r.hurtT >= 0) { const p = clamp(r.hurtT / 0.3, 0, 1); sy *= 1 - 0.2 * Math.pow(1 - p, 2); r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        g.rotation.z = moving ? Math.sin(r.phase) * 0.07 : Math.sin(t * 1.1) * 0.025;
        g.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
        return bob;
    }

    // ---------------------------------------------------------------- the ghost king
    function king(g, r, dt, c) {
        const t = r.t;
        const sway = Math.sin(t * 1.4);
        pose(r, 'arm_l', -0.15 + (c.charging ? 0.9 : 0), 0, -0.15 - sway * 0.12);
        pose(r, 'arm_r', -0.15 + (c.charging ? 0.9 : 0), 0, 0.15 + sway * 0.12);
        const loop = r.parts.staff_loop; if (loop) loop.rotation.y = loop.userData.rest.y + t * 1.1;
        const hem = r.parts.hem; if (hem) hem.scale.set(1 + Math.sin(t * 2.1) * 0.04, 1, 1 + Math.cos(t * 1.7) * 0.04);
        g.rotation.x = S(r, 'lean', c.charging ? 0.4 : 0, 8);
        g.rotation.z = Math.sin(t * 0.9) * 0.03;
        return 0.45 + Math.sin(t * 1.3) * 0.4; // hovers
    }

    // ---------------------------------------------------------------- electric eel
    function eel(g, r, dt, c) {
        const t = r.t, moving = (c.speed || 0) > 0.8;
        r.phase += dt * (moving ? 10 : 3.4);
        let amp = moving ? 0.62 : 0.3, coil = 0, glow = c.aggro ? 0.35 : 0, pitch = 0, sq = 1;
        if (r.atk) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1), sp = k.strike / k.dur;
            if (p < sp) { // wind-up: rears up, coils into an arch and crackles
                const e = ease(p / sp);
                amp = lerp(amp, 1.0, e); coil = e; glow = lerp(glow, 1, e); pitch = -0.35 * e;
            } else {      // strike: whips forward as the sparks burst out
                const u = (p - sp) / (1 - sp), s = ease(u * 2.2), settle = u > 0.5 ? ease((u - 0.5) / 0.5) : 0;
                coil = 1 - s; glow = 1 - settle * 0.7; pitch = 0.4 * s * (1 - settle); amp = lerp(amp, 0.9, 1 - settle);
            }
            r.atkT += dt; if (r.atkT >= k.dur) r.atk = null;
        }
        if (r.hurtT >= 0) { const p = clamp(r.hurtT / 0.3, 0, 1); sq = 1 - 0.18 * Math.pow(1 - p, 2); amp += 0.6 * (1 - p); r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        for (let i = 0; i < 8; i++) {
            const seg = r.parts['seg_' + i]; if (!seg) continue;
            const q = seg.userData.rest, w = 0.3 + i * 0.16;
            seg.position.x = q.px + Math.sin(r.phase - i * 0.78) * amp * w;
            seg.position.y = q.py + coil * Math.sin(i * 0.55) * 1.4 + Math.sin(r.phase * 0.5 - i * 0.6) * 0.08;
            seg.scale.set(q.sx, q.sy * sq, q.sz);
            const spk = r.parts['spk_' + i];
            if (spk) { const f = 1 + glow * (1.2 + Math.sin(t * 40 + i * 2) * 0.8); spk.scale.set(spk.userData.rest.sx * f, spk.userData.rest.sy * f, spk.userData.rest.sz * f); }
        }
        g.rotation.x = S(r, 'pitch', pitch, 10);
        return 0.35 + Math.sin(t * 1.5) * 0.12;
    }

    // ---------------------------------------------------------------- dune viper
    // Camouflage: while `c.camo` is true the whole snake fades to a faint sand-colored shimmer; it snaps
    // back into view the moment it attacks, gets hit, or you get close.
    function snake(g, r, dt, c) {
        const t = r.t, moving = (c.speed || 0) > 0.8;
        if (!r.mats) { r.mats = []; g.traverse(o => { if (o.isMesh && o.material && r.mats.indexOf(o.material) < 0) { o.material.transparent = true; r.mats.push(o.material); } }); }
        const vis = S(r, 'vis', c.camo ? 0.07 + (Math.sin(t * 2.3) * 0.5 + 0.5) * 0.06 : 1, c.camo ? 2.6 : 11);
        r.mats.forEach(m => { m.opacity = vis; m.depthWrite = vis > 0.85; });
        const sacL = r.parts.venom_l, sacR = r.parts.venom_r;
        r.phase += dt * (moving ? 11 : 2.6);
        let amp = moving ? 0.7 : 0.18, rear = 0, swell = 1, pitch = 0, sq = 1;
        if (r.atk) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1), sp = k.strike / k.dur;
            if (p < sp) { const e = ease(p / sp); rear = e; swell = 1 + 1.1 * e; amp = lerp(amp, 0.25, e); pitch = -0.45 * e; }   // rear back, cheeks fill with venom
            else { const u = (p - sp) / (1 - sp), s = ease(u * 2.4); rear = 1 - s; swell = lerp(2.1, 1, ease(u)); pitch = 0.35 * (1 - s); }  // snap forward and spit
            r.atkT += dt; if (r.atkT >= k.dur) r.atk = null;
        }
        if (r.hurtT >= 0) { const p = clamp(r.hurtT / 0.3, 0, 1); sq = 1 - 0.2 * Math.pow(1 - p, 2); amp += 0.6 * (1 - p); r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        for (let i = 0; i < 9; i++) {
            const seg = r.parts['sseg_' + i]; if (!seg) continue;
            const q = seg.userData.rest, w = 0.25 + i * 0.16;
            seg.position.x = q.px + Math.sin(r.phase - i * 0.85) * amp * w;
            seg.position.y = q.py + (i < 4 ? rear * (4 - i) * 0.5 : 0);     // the front of the body lifts off the sand when it rears up
            seg.scale.set(q.sx, q.sy * sq, q.sz);
        }
        [sacL, sacR].forEach(sc => { if (sc) { const q = sc.userData.rest, f = swell * (c.camo ? 0.3 : 1); sc.scale.set(q.sx * f, q.sy * f, q.sz * f); } });
        g.rotation.x = S(r, 'pitch', pitch, 10);
        return 0;
    }

    // ---------------------------------------------------------------- Scortus (scorpion cactus)
    function scortus(g, r, dt, c) {
        const t = r.t, moving = (c.speed || 0) > 0.8;
        r.phase += dt * (moving ? 18 : 0);
        let wob = moving ? Math.sin(r.phase) * 0.08 : 0;
        let bob = moving ? Math.abs(Math.sin(r.phase)) * 0.14 : Math.sin(t * 1.8) * 0.03;
        let lean = c.aggro ? 0.05 : 0, clawX = Math.sin(t * 2.0) * 0.1 + (c.aggro ? -0.35 : 0), clawZ = c.aggro ? 0.1 : 0;
        let tail0 = Math.sin(t * 1.5) * 0.07, tail1 = Math.sin(t * 2.1 + 1) * 0.1, sy = 1, sz = 1;
        if (r.atk) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1), sp = k.strike / k.dur;
            if (r.atk === 'needle') {
                if (p < sp) { const e = ease(p / sp); tail0 = lerp(tail0, -0.5, e); tail1 = lerp(tail1, -0.9, e); lean = lerp(lean, -0.12, e); bob += 0.1 * e; }   // coil the tail back, aiming the needle
                else { const u = (p - sp) / (1 - sp), s = ease(u * 3); tail0 = lerp(-0.5, 0.45, s) * (1 - ease(u)) ; tail1 = lerp(-0.9, 0.9, s) * (1 - ease(u)); lean = 0.1 * (1 - ease(u)); }   // whip forward: fire!
            } else {                                                  // claw snap (uses the shared 'pinch')
                if (p < sp) { const e = ease(p / sp); clawX = lerp(clawX, -1.5, e); clawZ = lerp(clawZ, 0.55, e); lean = lerp(lean, -0.22, e); sy = 1 + 0.06 * e; }
                else { const u = (p - sp) / (1 - sp), slam = ease(u * 2.6), settle = u > 0.4 ? ease((u - 0.4) / 0.6) : 0; clawX = (lerp(-1.5, 0.6, slam)) * (1 - settle) + clawX * settle; clawZ = lerp(0.55, 0, slam); lean = lerp(-0.22, 0.3, slam) * (1 - settle); sz = 1 + 0.12 * (1 - settle) * slam; }
            }
            r.atkT += dt; if (r.atkT >= k.dur) r.atk = null;
        }
        if (r.hurtT >= 0) { const p = clamp(r.hurtT / 0.3, 0, 1), k2 = Math.pow(1 - p, 2); sy *= 1 - 0.2 * k2; sz *= 1 + 0.1 * k2; lean -= 0.2 * k2; r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        const cx = S(r, 'cx', clawX, 16), cz = S(r, 'cz', clawZ, 16);
        pose(r, 'pinch_l', cx, 0, -cz); pose(r, 'pinch_r', cx, 0, cz);
        pose(r, 'tail_0', S(r, 't0', tail0, 14), 0, 0); pose(r, 'tail_1', S(r, 't1', tail1, 14), 0, 0);
        g.rotation.z = S(r, 'wob', wob, 18); g.rotation.x = S(r, 'lean', lean, 12);
        const base = g.userData.baseScale || (g.userData.baseScale = g.scale.x);
        g.scale.set(base, base * S(r, 'sy', sy, 18), base * S(r, 'sz', sz, 18));
        return bob;
    }

    // ---------------------------------------------------------------- fire fish
    function firefish(g, r, dt, c) {
        const t = r.t, moving = (c.speed || 0) > 0.8;
        let puff = 1, mouth = 1, lean = 0, wag = Math.sin(t * (moving ? 12 : 5)) * (moving ? 0.55 : 0.3), glow = 1;
        if (r.atk) {
            const k = ATTACKS[r.atk], p = clamp(r.atkT / k.dur, 0, 1), sp = k.strike / k.dur;
            if (p < sp) { const e = ease(p / sp); puff = 1 + 0.2 * e; mouth = 1 + 1.5 * e; lean = -0.35 * e; glow = 1 + e; wag *= 0.4; }
            else { const u = (p - sp) / (1 - sp), s = ease(u * 2.4); puff = lerp(1.2, 0.92, s) + (1 - s) * 0; mouth = lerp(2.5, 1, ease(u)); lean = lerp(-0.35, 0.2, s) * (1 - ease(u)); wag *= 1.4; glow = lerp(2, 1, ease(u)); }
            r.atkT += dt; if (r.atkT >= k.dur) r.atk = null;
        }
        let sq = 1;
        if (r.hurtT >= 0) { const p = clamp(r.hurtT / 0.3, 0, 1); sq = 1 - 0.2 * Math.pow(1 - p, 2); r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        const tail = r.parts.tail; if (tail) tail.rotation.y = tail.userData.rest.y + wag;
        ['fin_l', 'fin_r'].forEach((n, i) => { const f = r.parts[n]; if (f) f.rotation.z = f.userData.rest.z + (i ? -1 : 1) * (0.25 + Math.sin(t * 7 + i) * 0.3); });
        const m = r.parts.mouth; if (m) m.scale.set(m.userData.rest.sx * mouth, m.userData.rest.sy * mouth, m.userData.rest.sz * (0.8 + mouth * 0.25));
        for (let i = 0; i < 3; i++) {
            const cr = r.parts['crest_' + i]; if (!cr) continue;
            const f = (0.85 + Math.sin(t * 11 + i * 2.1) * 0.22) * glow;
            cr.scale.set(cr.userData.rest.sx, cr.userData.rest.sy * f, cr.userData.rest.sz);
        }
        g.rotation.x = S(r, 'lean', lean, 10);
        g.rotation.z = Math.sin(t * 1.8 + 1) * 0.07;
        const base = g.userData.baseScale || (g.userData.baseScale = g.scale.x);
        g.scale.set(base * S(r, 'pf', puff * sq, 14), base * S(r, 'pf2', puff * sq, 14), base * S(r, 'pf3', puff, 14));
        return Math.sin(t * 1.7) * 0.4;
    }

    // Anything else (sea wraiths, charge ghosts): a gentle hover/wobble
    function generic(g, r, dt, c) {
        const t = r.t;
        g.rotation.z = Math.sin(t * 2.2 + (r.s.off || (r.s.off = Math.random() * 6))) * 0.06;
        const tail = r.parts.tail; if (tail) tail.rotation.z = Math.sin(t * 9) * 0.35;
        if (r.hurtT >= 0) { r.hurtT += dt; if (r.hurtT >= 0.3) r.hurtT = -1; }
        return 0.25 + Math.sin(t * 1.8 + 1) * 0.15;
    }

    // ---------------------------------------------------------------- public API
    function update(g, dt, c = {}) {
        const r = rig(g);
        DT = dt; r.t += dt;
        let bob = 0;
        switch (r.kind) {
            case 'human': bob = human(g, r, dt, c); break;
            case 'crab': bob = crab(g, r, dt, c); break;
            case 'octopus': bob = octopus(g, r, dt, c); break;
            case 'king': bob = king(g, r, dt, c); break;
            case 'eel': bob = eel(g, r, dt, c); break;
            case 'firefish': bob = firefish(g, r, dt, c); break;
            case 'snake': bob = snake(g, r, dt, c); break;
            case 'scortus': bob = scortus(g, r, dt, c); break;
            default: bob = generic(g, r, dt, c);
        }
        if (c.bob !== false) g.position.y = (c.baseY || 0) + bob; // (the player's height is owned by physics)
        return r;
    }

    function attack(g, kind) { const r = rig(g); r.atk = kind; r.atkT = 0; }
    function hurt(g) { const r = rig(g); r.hurtT = 0; }
    function die(g) { const r = rig(g); r.deathT = 0; r.atk = null; }
    function isAttacking(g) { const r = g.userData.rig; return !!(r && r.atk); }

    // Turn a creature to face a point (smoothly), or to a given yaw.
    function faceToward(g, x, z, dt, rate = 10) {
        const dx = x - g.position.x, dz = z - g.position.z;
        if (dx * dx + dz * dz < 0.0001) return;
        g.rotation.y = angleLerp(g.rotation.y, Math.atan2(dx, dz), clamp(rate * dt, 0, 1));
    }
    function faceYaw(g, yaw, dt, rate = 12) { g.rotation.y = angleLerp(g.rotation.y, yaw, clamp(rate * dt, 0, 1)); }
    // The yaw (relative to the body) needed for a head to look at a point
    function lookYawTo(g, x, z) {
        const want = Math.atan2(x - g.position.x, z - g.position.z);
        return ((((want - g.rotation.y) + Math.PI) % TAU) + TAU) % TAU - Math.PI;
    }

    return { ATTACKS, update, attack, hurt, die, isAttacking, faceToward, faceYaw, lookYawTo, rig };
})();
