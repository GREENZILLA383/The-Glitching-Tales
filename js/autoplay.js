// THE TEST BOT ("Test Mode").
//
// Press  🤖 TEST MODE  on the title screen and the game plays ITSELF, start to finish, slowly enough to watch:
//   Chapter 1  Emerald Coast: Barnico, Octa, the shop, (optionally) the Flow Song,
//              the Temple of Crabs (only the crabs that block the way) and Croton
//   Chapter 2  the Sea Gate + boat, the Coral Reef, Oblongtalo's challenge
//   Chapter 3  the Dunes of Force, Cacto Village, the quicksand, Graton in the Gravity Core
//   Chapter 4  Wisp's flight, the Sky Kingdom, all the villagers of Makani (twice each), Cashato's shop, both side quests and Iolana's Kite Ring Race
//
// It "presses the buttons" like a person: it steers the camera, holds W, swings / shoots, clicks through dialogue (waiting long
// enough to read it), buys things in the shop, and presses E to talk. Your real saved game is never touched.
// A panel in the corner shows what it is doing; at the end you get a report (also downloadable).
//
// Honest limits: it has a "safety net" (the Invincible switch is on and its health / mana never run out) so the walkthrough
// can't die, and when it gets truly stuck on scenery it "assists" by hopping forward - every assist is counted in the report.
const AutoPlay = (() => {
    const STOP = { stopped: true };
    const CFG = { speed: 'slow', thorough: true, skill: 'melee', safety: true };
    const S = { active: false, paused: false, done: false, clock: 0, t0: 0, step: 'Waiting...', chapter: '', log: [], assists: 0, errors: [], milestones: [], prog: null, stats: { creatures: 0, villagers: 0, shop: 0, assists: 0 }, godBefore: false };
    const given = new Set();      // things that cannot be collected (reported once, then ignored for the rest of the run)
    let waiters = [], nav = null, aim = null, lookAt = null, manualKeys = false, inShopTask = false, panel = null, ending = false;
    const dlg = { last: '', t: 0, at: 0, changes: 0 };
    const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const clamp = THREE.MathUtils.clamp;
    const ow = () => overworld3d, gs = () => gameSystem;
    const PM = () => ({ slow: 1, normal: 0.5, fast: 0.12 }[CFG.speed] || 1);   // how long it "thinks" / pauses
    const fmt = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

    // ---------------------------------------------------------------- tiny scheduler (so the story reads like a script)
    const sleep = (sec) => new Promise((res, rej) => waiters.push({ at: S.clock + sec, res, rej }));
    const until = (cond, timeout = 1e9) => new Promise((res, rej) => waiters.push({ cond, deadline: S.clock + timeout, res, rej }));
    function runWaiters() {
        const keep = [];
        for (const w of waiters) {
            if (w.cond) { let ok = false; try { ok = !!w.cond(); } catch (e) { ok = true; } if (ok) w.res(true); else if (S.clock >= w.deadline) w.res(false); else keep.push(w); }
            else if (S.clock >= w.at) w.res(true); else keep.push(w);
        }
        waiters = keep;
    }

    // ---------------------------------------------------------------- reporting
    function say(kind, text) { S.log.push({ t: S.clock, kind, text }); if (S.log.length > 400) S.log.shift(); if (kind !== 'info') updatePanel(true); }
    function step(text) { S.step = text; say('info', text); updatePanel(true); }
    function note(kind, text) { say(kind, text); if (kind === 'assist') { S.assists++; S.stats.assists++; } }
    function milestone(id, label) { S.milestones.push({ id, label, t: S.clock }); say('info', '✓ ' + label); updatePanel(true); }
    const totalMilestones = () => CFG.thorough ? 20 : 19;

    // ---------------------------------------------------------------- helpers about the world
    const free = () => { const g = gs(), o = ow(); return (g.state === 'overworld' || g.state === 'gauntlet') && !g.isCutscene && !(g.dialogueQueue && g.dialogueQueue.length) && !o.skyRide && !o.voyage && !o.kite && !(window.GravityCore && GravityCore.active) && o.cutsceneProgress === undefined; };
    // wait until nothing is going on (no dialogue, cutscene, flight...). The game leaves a tiny gap between two lines of a
    // conversation, so look again after a moment to make sure it really is over.
    const settle = async () => { for (let i = 0; i < 400; i++) { await until(free); await sleep(Math.max(0.3, 0.35 * PM())); if (free()) return; } };
    const pos = () => ow().playerObj.position;
    const d2 = (x, z) => Math.hypot(x - pos().x, z - pos().z);
    const yawTo = (x, z) => Math.atan2(-(x - pos().x), -(z - pos().z));            // camera yaw that faces (x, z)
    const present = (ent) => ow().entities.includes(ent);
    const alive = (ent) => present(ent) && ent.data && ent.data.hp > 0;
    const style = () => { const w = gs().party[0].equippedWeapon; return w && (w.playStyle === 'range' || w.playStyle === 'magick') ? w.playStyle : 'melee'; };
    const keys = () => ow().keys;
    function releaseKeys() { const k = keys(); k['w'] = k['a'] = k['s'] = k['d'] = k[' '] = false; }
    function assistTo(x, z, why) {
        const o = ow();
        if (o.skyReached && !o.skyWalkable(x, z)) {          // up in the clouds: land on the nearest bit of cloud, never in the open sky
            let found = false;
            for (let r = 1; r <= 40 && !found; r++) for (let k = 0; k < 16 && !found; k++) { const a = k / 16 * Math.PI * 2, cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r; if (o.skyWalkable(cx, cz) && o.skyWalkable(cx + 1, cz) && o.skyWalkable(cx - 1, cz) && o.skyWalkable(cx, cz + 1) && o.skyWalkable(cx, cz - 1)) { x = cx; z = cz; found = true; } }
        }
        pos().set(x, o.groundHeight ? o.groundHeight(x, z) : 0, z); o.isJumping = false; o.grounded = true; o.velocityY = 0;
        if (o.isClimbing) o.exitClimb();
        note('assist', why);
    }

    // ---------------------------------------------------------------- driving the camera and the keys
    function setYaw(target, rate, dt) {
        const cam = ow().camera, e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        const d = wrap(target - e.y), stepY = clamp(d, -rate * dt, rate * dt);
        e.y += stepY; e.x = -0.25; e.z = 0; cam.quaternion.setFromEuler(e);
        return Math.abs(d - stepY);
    }
    const canMove = () => { const g = gs(), o = ow(); return (g.state === 'overworld' || g.state === 'gauntlet') && !g.isCutscene && !o.skyRide && !o.voyage && !o.kite && !(window.GravityCore && GravityCore.active); };
    const blockedAt = (x, z, n) => {
        const o = ow();
        if (o.skyReached && !o.skyWalkable(x, z)) return true;
        const q = o.quicksand; if (q && o.desertReached && !(n && n.quick) && Math.hypot(x - q.x, z - q.z) < q.r + 2.5) return true;   // keep out of the quicksand (until it's time)
        if (n) for (const zn of triggerZones(n.x, n.z)) if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return true;
        if (n) for (const c of storyTriggers(n.x, n.z)) if (x > c.min.x - 3 && x < c.max.x + 3 && z > c.min.z - 3 && z < c.max.z + 3) return true;
        return o.isBlocked(x, z, 0.8);
    };
    const OFFS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6, Math.PI];
    function pickHeading(p, want, n) {
        const clear = (h) => !blockedAt(p.x - Math.sin(h) * 1.8, p.z - Math.cos(h) * 1.8, n) && !blockedAt(p.x - Math.sin(h) * 3.6, p.z - Math.cos(h) * 3.6, n);
        if (n.commit && S.clock < n.commit.until) return n.commit.h;
        if (clear(want)) return want;
        const order = OFFS.slice(1); if (n.side < 0) order.sort((a, b) => (a < 0 ? -1 : 1) - (b < 0 ? -1 : 1) || Math.abs(a) - Math.abs(b));
        for (const off of order) { const h = want + off; if (clear(h)) { n.side = off > 0 ? 1 : -1; n.commit = { h, until: S.clock + 0.7 }; return h; } }
        return want;
    }
    // Walking close to a shopkeeper or a story character starts the shop / a conversation. Avoid those circles unless that is the goal.
    function triggerZones(gx, gz) {
        const out = [];
        ow().entities.forEach(e => {
            if ((e.type !== 'shopkeeper' && e.type !== 'story_npc') || !e.mesh) return;
            const x = e.mesh.position.x, z = e.mesh.position.z;
            if (Math.hypot(x - gx, z - gz) < 4) return;            // (we are going there on purpose)
            out.push({ x, z, r: (e.radius || 3) + 1.4 });
        });
        return out;
    }

    function storyTriggers(gx, gz) {
        return ow().colliders.filter(c => (c.isHandWaveTrigger || c.isArenaTrigger || c.isDesertEndTrigger) && !(gx > c.min.x - 6 && gx < c.max.x + 6 && gz > c.min.z - 6 && gz < c.max.z + 6));
    }

    // ---- path finding: a grid over the area between here and the goal, with every solid thing (and, in the sky, every gap
    //      between clouds) marked as blocked; A* finds a way round, then the route is straightened out.
    // (first try to keep a comfortable distance from walls - the game stops you dead if you brush one - then squeeze through if there is no other way)
    function planPath(x0, z0, x1, z1, n, extra = 0) { return planPathCore(x0, z0, x1, z1, n, 1.6 + extra) || planPathCore(x0, z0, x1, z1, n, 0.9 + extra); }
    function planPathCore(x0, z0, x1, z1, n, ex) {
        const o = ow();
        for (const pad of [40, 110]) {
            const span = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) + pad * 2;
            const cs = clamp(span / 80, 1.5, 5);       // (a finer grid for short trips, so narrow gaps stay open)
            const minX = Math.min(x0, x1) - pad, minZ = Math.min(z0, z1) - pad;
            const W = Math.ceil((Math.abs(x1 - x0) + pad * 2) / cs), H = Math.ceil((Math.abs(z1 - z0) + pad * 2) / cs);
            if (W * H > 120000) continue;
            const blocked = new Uint8Array(W * H), cost = new Float32Array(W * H).fill(1);
            const maxX = minX + W * cs, maxZ = minZ + H * cs;
            for (const c of o.colliders) {
                if (c.isCoin || c.isTrigger || c.max.y < 0.5) continue;
                if (c.max.x + ex < minX || c.min.x - ex > maxX || c.max.z + ex < minZ || c.min.z - ex > maxZ) continue;
                const i0 = Math.max(0, Math.floor((c.min.x - ex - minX) / cs)), i1 = Math.min(W - 1, Math.floor((c.max.x + ex - minX) / cs));
                const j0 = Math.max(0, Math.floor((c.min.z - ex - minZ) / cs)), j1 = Math.min(H - 1, Math.floor((c.max.z + ex - minZ) / cs));
                for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                    const cx = minX + (i + 0.5) * cs, cz = minZ + (j + 0.5) * cs;
                    if (cx > c.min.x - ex && cx < c.max.x + ex && cz > c.min.z - ex && cz < c.max.z + ex) blocked[j * W + i] = 1;
                }
            }
            for (const c of storyTriggers(x1, z1)) {      // (you only get to cross these when it is time)
                const i0 = Math.max(0, Math.floor((c.min.x - 4 - minX) / cs)), i1 = Math.min(W - 1, Math.floor((c.max.x + 4 - minX) / cs));
                const j0 = Math.max(0, Math.floor((c.min.z - 4 - minZ) / cs)), j1 = Math.min(H - 1, Math.floor((c.max.z + 4 - minZ) / cs));
                for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * W + i] = 1;
            }
            const q = o.quicksand, avoidQ = q && o.desertReached && !(n && n.quick), zones = triggerZones(x1, z1);
            for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
                const cx = minX + (i + 0.5) * cs, cz = minZ + (j + 0.5) * cs, k = j * W + i;
                for (const zn of zones) if (Math.hypot(cx - zn.x, cz - zn.z) < zn.r) { blocked[k] = 1; break; }
                if (o.skyReached && !(o.skyWalkable(cx, cz) && o.skyWalkable(cx + 0.9, cz) && o.skyWalkable(cx - 0.9, cz) && o.skyWalkable(cx, cz + 0.9) && o.skyWalkable(cx, cz - 0.9))) blocked[k] = 1;   // (stay a little way in from the cloud edge)
                if (avoidQ && Math.hypot(cx - q.x, cz - q.z) < q.r + 2.5) blocked[k] = 1;
                if (!blocked[k] && o.lakes) for (const l of o.lakes) if (Math.hypot(cx - l.x, cz - l.z) < l.r) { cost[k] = 1.9; break; }   // swimming is slow
            }
            const cellOf = (x, z) => [clamp(Math.floor((x - minX) / cs), 0, W - 1), clamp(Math.floor((z - minZ) / cs), 0, H - 1)];
            const nearestFree = (ci, cj) => {
                if (!blocked[cj * W + ci]) return [ci, cj];
                for (let r = 1; r < 9; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                    const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
                    if (!blocked[b * W + a]) return [a, b];
                }
                return null;
            };
            const s0 = nearestFree(...cellOf(x0, z0)), g0 = nearestFree(...cellOf(x1, z1));
            if (!s0 || !g0) continue;
            // A*
            const N = W * H, gs_ = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
            const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
            const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
            const sk = s0[1] * W + s0[0], gk = g0[1] * W + g0[0];
            const hfun = (k) => { const i = k % W, j = (k / W) | 0, dx = Math.abs(i - g0[0]), dz = Math.abs(j - g0[1]); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)); };
            gs_[sk] = 0; push(sk, hfun(sk));
            let found = false, iters = 0;
            while (heap.length && iters++ < 300000) {
                const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
                if (k === gk) { found = true; break; }
                const i = k % W, j = (k / W) | 0;
                for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                    if (!di && !dj) continue;
                    const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
                    const kk = b * W + a; if (blocked[kk] || closed[kk]) continue;
                    if (di && dj && (blocked[j * W + a] || blocked[b * W + i])) continue;       // no cutting corners
                    const ng = gs_[k] + (di && dj ? 1.414 : 1) * cost[kk];
                    if (ng < gs_[kk]) { gs_[kk] = ng; from[kk] = k; push(kk, ng + hfun(kk)); }
                }
            }
            if (!found) continue;
            const cells = []; for (let k = gk; k !== -1; k = from[k]) cells.push(k); cells.reverse();
            const pts = cells.map(k => ({ x: minX + ((k % W) + 0.5) * cs, z: minZ + (((k / W) | 0) + 0.5) * cs }));
            // straighten: skip ahead while a straight line between two points crosses no blocked cell
            const clearLine = (A, B) => { const d = Math.hypot(B.x - A.x, B.z - A.z), steps = Math.ceil(d / (cs * 0.5)); for (let t = 0; t <= steps; t++) { const x = A.x + (B.x - A.x) * t / steps, z = A.z + (B.z - A.z) * t / steps; const [ci, cj] = cellOf(x, z); if (blocked[cj * W + ci]) return false; } return true; };
            const out = []; let a = 0;
            while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !clearLine(pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
            if (out.length) out[out.length - 1] = { x: x1, z: z1 };       // the real goal, not the middle of its cell
            return out;
        }
        return null;
    }

    function setNav(x, z, r, opts = {}) {
        if (nav && Math.abs(nav.x - x) < 0.5 && Math.abs(nav.z - z) < 0.5 && nav.r === r) { nav.arrived = false; return nav; }
        if (nav && opts.replanEvery && nav.replanEvery && nav.r === r && nav.label === opts.label && !nav.failed) { nav.x = x; nav.z = z; nav.arrived = false; return nav; }   // (chasing something that moves: keep going, just aim at its new spot)
        nav = Object.assign({ x, z, r, side: 1, commit: null, arrived: false, t0: S.clock, moveT: 0, timeout: opts.timeout || 70, stuck: 0, lastPos: null, lastCheck: S.clock, jumpAt: 0, assisted: 0, label: opts.label || '' }, opts);
        return nav;
    }

    function navTick(dt) {
        const k = keys();
        if (ow().kite || (window.GravityCore && GravityCore.active)) return;       // the kite and the core have their own drivers
        if (!nav) { if (!manualKeys) { k['w'] = k['a'] = k['s'] = k['d'] = false; } return; }
        if (!canMove()) { k['w'] = false; return; }
        const p = pos(), dist = d2(nav.x, nav.z);
        if (dist <= nav.r) { nav.arrived = true; k['w'] = false; return; }
        nav.arrived = false;
        nav.moveT += dt;
        // too slow? hop forward a little (counted as an assist)
        const allowed = Math.max(nav.timeout, dist / 30 + (nav.giveUp ? 8 : 25));
        if (nav.moveT > allowed && nav.giveUp) {
            if (!nav.hopped) {                               // first, maybe we are just pinned against a wall: hop out once
                nav.hopped = true; nav.moveT = allowed - 7; nav.stuck = 0; nav.commit = null;
                const f = Math.min(1, 10 / Math.max(10, dist));
                assistTo(p.x + (nav.x - p.x) * f, p.z + (nav.z - p.z) * f, 'Pinned against scenery on the way to ' + (nav.label || 'a goal') + ' - hopped out');
                return;
            }
            note('warn', 'Could not reach ' + (nav.label || 'a goal') + ' at (' + Math.round(nav.x) + ', ' + Math.round(nav.z) + ')');
            nav.failed = true; nav.arrived = true; return;
        }
        if (nav.stuck > 1.0) nav.stuckSum = (nav.stuckSum || 0) + dt;
        if (nav.moveT > allowed || (nav.stuckSum || 0) > 9) {
            nav.stuckSum = 0;
            const f = Math.min(1, Math.max(14, dist * 0.5) / dist);
            assistTo(p.x + (nav.x - p.x) * f, p.z + (nav.z - p.z) * f, 'Got stuck walking to ' + (nav.label || 'a goal') + ' - hopped forward');
            nav.moveT = 0; nav.assisted++; nav.stuck = 0; nav.commit = null; return;
        }
        // stuck detection (are we actually getting anywhere?)
        if (S.clock - nav.lastCheck > 0.6) {
            if (nav.lastPos && Math.hypot(p.x - nav.lastPos.x, p.z - nav.lastPos.z) < 0.35) nav.stuck += S.clock - nav.lastCheck; else nav.stuck = Math.max(0, nav.stuck - 0.6);
            nav.lastPos = { x: p.x, z: p.z }; nav.lastCheck = S.clock;
        }
        if (nav.stuck > 1.0 && S.clock - nav.jumpAt > 1.5) { nav.jumpAt = S.clock; k[' '] = true; setTimeout(() => { k[' '] = false; }, 220); }
        if (nav.stuck > 1.6 && !nav.noAvoid && S.clock - (nav.lastReplan || 0) > 2) { nav.lastReplan = S.clock; nav.extra = Math.min(1.6, (nav.extra || 0) + 0.4); nav.needReplan = true; }
        if (nav.stuck > 2.4) { nav.side = -nav.side; nav.commit = { h: yawTo(nav.x, nav.z) + nav.side * (1.2 + Math.random()), until: S.clock + 1.2 }; nav.stuck = 0.8; }
        // plan a route (again if we are stuck, or if the goal moves)
        if (!nav.noAvoid && (!nav.planned || (nav.replanEvery && S.clock - nav.planAt > nav.replanEvery) || nav.needReplan)) {
            const direct = dist < 8 && !blockedAt((p.x + nav.x) / 2, (p.z + nav.z) / 2, nav);
            nav.path = direct ? null : planPath(p.x, p.z, nav.x, nav.z, nav, nav.extra || 0);
            nav.planned = true; nav.planAt = S.clock; nav.pi = 0; nav.needReplan = false;
        }
        let tx = nav.x, tz = nav.z;
        if (nav.path && nav.path.length) {
            while (nav.pi < nav.path.length - 1 && Math.hypot(p.x - nav.path[nav.pi].x, p.z - nav.path[nav.pi].z) < 2.4) nav.pi++;
            tx = nav.path[nav.pi].x; tz = nav.path[nav.pi].z;
        }
        const want = yawTo(tx, tz);
        const h = (nav.noAvoid || (nav.path && nav.path.length)) ? want : pickHeading(p, want, nav);
        const err = setYaw(h, dist < 12 ? 80 : 5, dt);       // (turn gently while far away, aim straight at it when close)
        k['w'] = err < (dist < 6 ? 0.3 : 0.85); k['a'] = k['d'] = k['s'] = false;
    }

    // ---------------------------------------------------------------- the things that happen "between the lines"
    function safetyNet() {
        const g = gs(); if (!g.party.length) return;
        if (CFG.safety) {
            g.godMode = true;
            const p = g.party[0];
            if (p.hp > 0) { p.hp = p.maxHp; p.mp = p.maxMp; p.stamina = p.maxStamina; }
            if (p.burn) { p.burn = null; }
        }
    }

    function readTime(len) { return CFG.speed === 'slow' ? 1.3 + len * 0.028 : CFG.speed === 'normal' ? 0.85 + len * 0.012 : 0.7; }
    function dialogueTick() {
        const g = gs(), now = performance.now() / 1000;
        if (g.state !== 'dialogue') { dlg.last = ''; dlg.at = now; return; }
        const txt = g.dialogueBox.querySelector('.dialogue-text').textContent;
        if (txt !== dlg.last) { dlg.last = txt; dlg.at = now; dlg.changes++; return; }
        if (now - dlg.at >= readTime(txt.length)) { document.dispatchEvent(new MouseEvent('click', { bubbles: true })); dlg.last = ''; dlg.at = now; }
    }

    // the shop can pop open if we brush past the shopkeeper while collecting things: shut it again
    let shopSeen = 0;
    function shopTick(dt) {
        if (gs().state === 'shop' && !inShopTask) { shopSeen += dt; if (shopSeen > 1.2) { const b = document.getElementById('close-shop-btn'); if (b) b.click(); shopSeen = 0; } } else shopSeen = 0;
    }

    // ---- Gravity Core (Graton): the bot runs at him and attacks
    function coreTick() {
        if (!(window.GravityCore && GravityCore.active)) return;
        const g = gs(), k = keys(), P = GravityCore.player, B = GravityCore.boss;
        if (!P || !B || B.dead || g.state !== 'core' || g.isCutscene) { k['w'] = false; return; }
        const dot = clamp(P.dir.dot(B.dir), -1, 1), arc = GravityCore.R * Math.acos(dot);
        const t = B.dir.clone().sub(P.dir.clone().multiplyScalar(dot));
        if (t.lengthSq() > 1e-6) P.camFwd.copy(t.normalize());              // the camera faces him, so "forward" runs at him
        const rng = style() === 'melee' ? 7 : 22;
        k['w'] = arc > rng; k['a'] = k['d'] = k['s'] = false;
        if (arc < rng + 6) combatSystem.performPlayerAttack();
    }

    // ---- kite race: steer toward the next ring
    function kiteTick() {
        const o = ow(), r = o.kite, k = keys();
        if (!r) return;
        if (r.phase !== 'fly') { k['a'] = k['d'] = k['w'] = k['s'] = false; return; }
        const tg = r.pts[Math.min(r.next, r.pts.length - 1)], dx = tg.x - r.pos.x, dz = tg.z - r.pos.z, dy = tg.y - r.pos.y;
        const diff = wrap(Math.atan2(-dx, -dz) - r.yaw);
        k['a'] = diff > 0.08; k['d'] = diff < -0.08; k['w'] = dy > 3; k['s'] = dy < -3;
    }

    // ---- fighting: face the enemy and swing / shoot whenever it is in reach
    function combatTick(dt) {
        if (!aim || !alive(aim) || !canMove()) return;
        const rng = style() === 'melee' ? 3.6 : 12;
        const d = d2(aim.mesh.position.x, aim.mesh.position.z);
        if (d <= rng + 0.8) {
            const err = setYaw(yawTo(aim.mesh.position.x, aim.mesh.position.z), 9, dt);
            if (err < 0.4) combatSystem.performPlayerAttack();
        }
    }

    // ---- if nothing has changed for a long time, give the game a little shove
    let wd = { pos: null, t: 0, state: '', n: 0, dchanges: 0 };
    function watchdog(dt) {
        wd.t += dt;
        if (wd.t < 30) return;
        const g = gs(), p = ow().playerObj ? pos() : null, moved = p && wd.pos ? Math.hypot(p.x - wd.pos.x, p.z - wd.pos.z) : 99;
        const talking = dlg.changes !== wd.dchanges;      // (a long conversation is progress too)
        wd.dchanges = dlg.changes;
        if (moved < 1.5 && g.state === wd.state && !S.paused && !talking) {
            wd.n++;
            note('warn', 'No progress for 30s in state "' + g.state + '" during: ' + S.step + ' (nudge #' + wd.n + ')' + (nav ? ' [walking to (' + Math.round(nav.x) + ', ' + Math.round(nav.z) + '), ' + Math.round(d2(nav.x, nav.z)) + ' away, route ' + (nav.path ? nav.path.length + ' stops' : 'none') + ', stuck ' + nav.stuck.toFixed(1) + ']' : ' [not walking: ' + (waiters.length) + ' waits]'));
            releaseKeys(); document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            if (g.state === 'paused') window.settingsSystem.closePauseMenu();
            if (g.state === 'settings') window.settingsSystem.closeSettings();
            if (g.state === 'choice') { const b = document.getElementById('choice-yes'); if (b) b.click(); }
            if (nav && canMove()) { const q = pos(); assistTo(q.x + (nav.x - q.x) * 0.3, q.z + (nav.z - q.z) * 0.3, 'Watchdog hopped toward ' + (nav.label || 'the goal')); }
        }
        wd.pos = p ? { x: p.x, z: p.z } : null; wd.state = g.state; wd.t = 0;
    }

    function tick(dt) {
        if (!S.active) return;
        if (S.paused) { releaseKeys(); return; }
        S.clock += dt;
        try {
            safetyNet(); dialogueTick(); shopTick(dt); coreTick(); kiteTick();
            if (window.GravityCore && GravityCore.active) { /* the core has its own movement */ } else { navTick(dt); combatTick(dt); if (lookAt && canMove()) setYaw(yawTo(lookAt.x, lookAt.z), 9, dt); }
            watchdog(dt); runWaiters(); updatePanel(false);
        } catch (e) { if (e !== STOP) { note('error', 'Bot error: ' + (e && e.message)); console.error(e); } }
    }

    // ---------------------------------------------------------------- bigger "skills" the script uses
    async function walkTo(x, z, opts = {}) {
        await settle();
        const n = setNav(x, z, opts.r === undefined ? 2.5 : opts.r, { timeout: opts.timeout || 70, label: opts.label || '', noAvoid: !!opts.noAvoid, quick: !!opts.quick, giveUp: !!opts.giveUp });
        await until(() => n.arrived || nav !== n || (opts.stopWhen && opts.stopWhen()));
        if (nav === n) nav = null;
        releaseKeys();
    }

    async function fight(ent, opts = {}) {
        const t0 = S.clock, timeout = opts.timeout || 70, name = (ent.data && ent.data.name) || 'creature';
        aim = ent;
        const rng = () => style() === 'melee' ? 3.2 : 10;
        while (alive(ent) && S.clock - t0 < timeout) {
            await until(() => canMove() || !alive(ent), 60);
            if (!alive(ent)) break;
            const ex = ent.mesh.position.x, ez = ent.mesh.position.z, d = d2(ex, ez);
            if (d > rng()) setNav(ex, ez, rng() * 0.8, { label: name, timeout: 40, replanEvery: 1.2 }); else nav = null;
            await sleep(0.12);
        }
        aim = null; nav = null; releaseKeys();
        if (alive(ent)) { note('warn', 'Could not finish off ' + name + ' in time - moving on'); return false; }
        S.stats.creatures++;
        await sleep(0.4 * PM());
        return true;
    }

    // The bot does NOT hunt creatures (it only fights what the story needs: the temple crabs, Croton and Graton).
    // The one optional thing it looks for is the Flow Song, the shy little music creature that you befriend by walking up to it.
    async function findFlowSong() {
        const song = ow().entities.find(e => e.type === 'song');
        if (!song) return;
        step('Looking for the Flow Song (the little music creature)');
        await walkTo(song.mesh.position.x, song.mesh.position.z, { r: Math.max(1.2, (song.radius || 3) - 1.2), timeout: 120, label: 'the Flow Song' });
        await sleep(0.5); await settle();
        if (!present(song)) milestone('flowsong', 'Befriended the Flow Song');
    }

    // ---------------------------------------------------------------- the story, chapter by chapter
    async function talkToStoryNpc(id, label) {
        const e = ow().entities.find(x => x.storyId === id);
        if (!e) return;
        step('Talking to ' + label);
        // (the game starts the conversation by itself when you get close, so stop walking the moment it does)
        await walkTo(e.mesh.position.x, e.mesh.position.z, { r: 2.0, timeout: 80, label, stopWhen: () => gs().state === 'dialogue' || !present(e) });
        await sleep(0.5); await settle();
    }

    const boughtIds = new Set();
    async function visitShop() {
        const sk = ow().entities.find(e => e.type === 'shopkeeper');
        if (!sk) return;
        step('Visiting the shopkeeper');
        inShopTask = true;
        await walkTo(sk.mesh.position.x, sk.mesh.position.z, { r: 2.0, timeout: 80, label: 'the shopkeeper', stopWhen: () => gs().state === 'shop' });
        await until(() => gs().state === 'shop', 6);
        if (gs().state !== 'shop') { inShopTask = false; note('warn', 'The shop did not open'); return; }
        await buyAll();
        inShopTask = false;
        await settle();
        milestone('shop' + boughtIds.size + '_' + Math.floor(S.clock), 'Visited the shop' + (S.stats.shop ? ' (' + S.stats.shop + ' item(s) bought so far)' : ''));
    }

    // the shop screen is open: look around, buy everything we can afford (once each), then leave
    async function buyAll(onlyMine = false) {
        await sleep(1.2 * PM() + 0.4);
        // everything on sale, once: charms first, then gear that is not for this hero, and last the gear that IS (so that ends up equipped)
        const skill = gs().party[0].skillType;
        const inv = shopSystem.inventory;
        const rank = (i) => i.category === 'Charm' ? 0 : (i.weaponData && i.weaponData.skillType === skill) ? 2 : 1;
        const want = inv.filter(i => !(onlyMine && i.weaponData && i.weaponData.skillType !== skill)).sort((a, b) => rank(a) - rank(b) || a.price - b.price).map(i => i.id).filter(id => !boughtIds.has(id));
        for (const id of want) {
            const idx = shopSystem.inventory.findIndex(i => i.id === id);
            const btn = document.querySelectorAll('#shop-items-grid .buy-btn')[idx];
            if (btn && !btn.disabled) {
                step('Buying ' + shopSystem.inventory[idx].name); btn.click(); S.stats.shop++; boughtIds.add(id);
                await sleep(0.4);
                await until(() => gs().state === 'shop', 20);          // (the "Equipped / Bought" message closes by itself)
                await sleep(0.6 * PM());
            }
        }
        if (!S.stats.shop) note('info', 'Not enough coins to buy anything yet');
        else note('info', 'Shop: owns ' + boughtIds.size + ' of ' + shopSystem.inventory.length + ' items so far');
        const close = document.getElementById('close-shop-btn'); if (close) close.click();
    }

    // talk to Cashato: his chat ends by opening the Cloud Market
    async function cashatoTalk(ent, again) {
        inShopTask = true;
        await talkToVillager(ent, again);
        if (await until(() => gs().state === 'shop', 90)) { step('Browsing Cashato\'s Cloud Market'); await buyAll(true); S.stats.cashato = (S.stats.cashato || 0) + 1; }
        else note('warn', 'Cashato\'s shop did not open');
        inShopTask = false;
        await settle();
        if (!S.cashatoDone) { S.cashatoDone = true; milestone('cashato', 'Visited Cashato\'s Cloud Market'); }
    }

    async function uiTour() {
        step('Checking the Pause menu');
        await settle();
        window.settingsSystem.openPauseMenu();
        await sleep(2.2 * PM() + 0.6);
        window.settingsSystem.closePauseMenu();
        await settle();
    }

    async function chapter1() {
        S.chapter = 'Chapter 1: The Emerald Coast';
        step('The adventure begins');
        await settle();
        await uiTour();
        await talkToStoryNpc('barnico', 'Elder Barnico');
        milestone('barnico', 'Met Elder Barnico and got the glider');
        await talkToStoryNpc('octa_join', 'Octa');
        milestone('octa', 'Octa joined the party');
        await visitShop();
        if (CFG.thorough) await findFlowSong();
        await temple();
    }

    async function temple() {
        step('Travelling to the Temple of Crabs');
        await walkTo(0, TEMPLE_FRONT_Z + 8, { r: 4, timeout: 150, label: 'the Temple of Crabs' });
        for (const room of ['room1', 'room2']) {
            step('Temple of Crabs: clearing ' + (room === 'room1' ? 'the Entrance Hall' : 'the Pillar Hall'));
            let guard = 0;
            while (guard++ < 40) {
                const left = ow().entities.filter(e => e.type === 'enemy' && e.roomId === room && alive(e));
                if (!left.length) break;
                const p = pos(); left.sort((a, b) => d2(a.mesh.position.x, a.mesh.position.z) - d2(b.mesh.position.x, b.mesh.position.z));
                S.step = 'Temple of Crabs: fighting a crab (' + left.length + ' left in this room)';
                await fight(left[0], { timeout: 70 });
            }
            await sleep(1.8 * PM() + 0.5);          // the gate rumbles open
            milestone(room, room === 'room1' ? 'Cleared the Entrance Hall' : 'Cleared the Pillar Hall');
        }
        const croton = ow().entities.find(e => e.bossId === 'croton');
        if (croton) {
            step('Boss fight: Croton, King of Crabs');
            await walkTo(croton.mesh.position.x, croton.mesh.position.z + 14, { r: 5, timeout: 90, label: 'Croton' });
            await fight(croton, { timeout: 420 });
            await settle();
            milestone('croton', 'Defeated Croton, King of Crabs');
        }
    }

    async function chapter2() {
        S.chapter = 'Chapter 2: The Ruined Ocean & Coral Reef';
        step('Walking to the Sea Gate');
        const trig = ow().colliders.find(c => c.isHandWaveTrigger);
        const tc = trig ? trig.getCenter(new THREE.Vector3()) : { x: 0, z: WORLD.handWaveTriggerZ + 7 };
        await walkTo(tc.x, tc.z, { r: 1.5, timeout: 160, label: 'the Sea Gate', stopWhen: () => ow().handWaveTriggered });
        step('Sailing out on the boat...');
        await until(() => ow().reefReached && free(), 240);
        milestone('voyage', 'Boat voyage and the hand-shaped wave');
        const trig2 = ow().colliders.find(c => c.isArenaTrigger);
        const ac = trig2 ? trig2.getCenter(new THREE.Vector3()) : { x: 0, z: REEF_END_Z - 16 };
        step('Crossing the reef to Oblongtalo\'s plaza');
        await walkTo(ac.x, ac.z, { r: 1.5, timeout: 200, label: 'Oblongtalo\'s plaza', stopWhen: () => ow().arenaTriggered });
        await until(() => combatSystem.gauntlet || ow().desertReached, 90);
        milestone('reef', 'Crossed the Coral Reef');
        if (combatSystem.gauntlet) {
            step('Oblongtalo\'s challenge: dodging the charges');
            const cc = ow().arenaCenter;
            const tx = cc.x + 13, tz = cc.z + 13;                  // the corner of the arena no charge ever passes through
            while (combatSystem.gauntlet) {
                if (free() && d2(tx, tz) > 1.5) setNav(tx, tz, 1.2, { label: 'the safe corner', timeout: 30 });
                else if (free()) nav = null;
                await sleep(0.25);
            }
            nav = null;
        }
        await until(() => ow().desertReached && free(), 240);
        milestone('oblongtalo', 'Survived Oblongtalo and reached the desert');
    }

    async function chapter3() {
        S.chapter = 'Chapter 3: The Dunes of Force';
        step('Entering the Dunes of Force');
        await settle();
        step('Heading for the quicksand in Cacto Village');
        await walkTo(QUICKSAND.x, QUICKSAND.z + 16, { r: 3, timeout: 220, label: 'Cacto Village' });
        milestone('cacto', 'Reached Cacto Village');
        step('Stepping into the quicksand...');
        await walkTo(QUICKSAND.x, QUICKSAND.z, { r: 1.2, timeout: 60, label: 'the quicksand', quick: true });
        for (let i = 0; i < 80 && !(window.GravityCore && GravityCore.active); i++) await sleep(0.25);   // stand still and sink
        step('The Gravity Core: fighting Graton');
        await until(() => window.GravityCore && GravityCore.active, 30);
        await until(() => !(window.GravityCore && GravityCore.active) && ow().skyRide, 600);
        milestone('graton', 'Defeated Graton, Protector of the Gravity Core');
        step('Riding Wisp up to the Sky Kingdom');
        await until(() => ow().skyReached && !ow().skyRide && free(), 300);
        milestone('wisp', 'Wisp carried the party to the Sky Kingdom');
    }

    function press(key) { document.dispatchEvent(new KeyboardEvent('keydown', { key })); document.dispatchEvent(new KeyboardEvent('keyup', { key })); }

    async function talkToVillager(ent, again) {
        step((again ? 'Chatting again with ' : 'Meeting ') + ent.v.name + ', ' + ent.v.title);
        // stand on the plaza side of them
        const V = MAKANI, dx = V.x - ent.mesh.position.x, dz = V.z - ent.mesh.position.z, L = Math.hypot(dx, dz) || 1;
        await walkTo(ent.mesh.position.x + dx / L * 4.2, ent.mesh.position.z + dz / L * 4.2, { r: 1.6, timeout: 90, label: ent.v.name });
        // press E, and if nothing starts, step a little closer and try again
        for (let tries = 0; tries < 5; tries++) {
            await until(() => ow().nearVillager === ent, 3);
            await sleep(0.5 * PM() + 0.2);
            press('e');
            if (await until(() => gs().state === 'dialogue' || gs().state === 'choice', 2.5)) break;
            if (tries >= 1) await walkTo(ent.mesh.position.x + dx / L * 3.2, ent.mesh.position.z + dz / L * 3.2, { r: 1.2, timeout: 20, label: ent.v.name });
        }
        await sleep(0.4);
    }

    // walk up to the cat / a clue and press E on it
    async function interact(ent, label) {
        await walkTo(ent.mesh.position.x, ent.mesh.position.z, { r: ent.type === 'clue' ? 1.4 : 2.4, timeout: 90, label });
        for (let tries = 0; tries < 5; tries++) {
            await until(() => ow().nearPick === ent, 3);
            await sleep(0.4 * PM() + 0.2);
            press('e');
            if (await until(() => gs().state === 'dialogue', 2.5)) break;
        }
        await settle();
    }

    // the two side quests of Makani (they were offered during the villagers' second chat)
    async function sideQuests() {
        const o = ow(), get = (id) => o.entities.find(e => e.type === 'villager' && e.v.id === id);
        if (o.side.cat.state === 'active') {
            step('Side quest: finding Malie\'s lost cat');
            const cat = o.entities.find(e => e.type === 'cat');
            if (cat) { await interact(cat, 'the lost cat'); await until(() => o.side.cat.state === 'found', 60); }
            step('Side quest: telling Malie the cat is home');
            await talkToVillager(get('malie'), true); await settle();
            if (o.side.cat.state === 'done') milestone('cat', 'Side quest done: found Malie\'s cat'); else note('warn', 'The missing-cat quest did not finish');
        }
        if (o.side.wind.state === 'active') {
            step('Side quest: investigating the fast windmills');
            for (const clue of o.entities.filter(e => e.type === 'clue')) { await interact(clue, 'a windmill clue'); }
            const bully = o.entities.find(e => e.type === 'bully');
            if (bully && o.side.wind.state === 'confront') { step('Side quest: confronting the cloud-school bully'); await interact(bully, 'the bully'); await until(() => o.side.wind.state === 'stopped', 30); }
            step('Side quest: telling Kekoa what was found');
            await talkToVillager(get('kekoa'), true); await settle();
            if (o.side.wind.state === 'done') milestone('windmill', 'Side quest done: the Windmill Mystery'); else note('warn', 'The windmill quest did not finish');
        }
    }

    async function chapter4() {
        S.chapter = 'Chapter 4: The Sky Kingdom - Makani Village';
        step('Exploring the Sky Kingdom');
        await settle();
        step('Following the cloud road north to Makani Village');
        await walkTo(MAKANI.x, MAKANI.z + 40, { r: 6, timeout: 300, label: 'Makani Village' });
        milestone('makani', 'Arrived at Makani Village');
        let list = ow().entities.filter(e => e.type === 'villager');
        const order = []; { let p = { x: pos().x, z: pos().z }; const rest = list.slice(); while (rest.length) { rest.sort((a, b) => Math.hypot(a.mesh.position.x - p.x, a.mesh.position.z - p.z) - Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z)); const n = rest.shift(); order.push(n); p = { x: n.mesh.position.x, z: n.mesh.position.z }; } }
        for (const v of order) { if (v.v.shop) await cashatoTalk(v, false); else { await talkToVillager(v, false); await settle(); } S.stats.villagers++; }
        milestone('villagers1', 'Met all ' + order.length + ' villagers');
        for (const v of order.slice().reverse()) {
            if (v.v.id === 'iolana') continue;
            if (v.v.shop) await cashatoTalk(v, true); else { await talkToVillager(v, true); await settle(); }
        }
        milestone('villagers2', 'Chatted with every villager a second time');
        await sideQuests();
        const io = order.find(v => v.v.id === 'iolana');
        if (io) {
            await talkToVillager(io, true);                      // her second talk is the kite race offer
            step('Iolana\'s Kite Ring Race');
            await until(() => gs().state === 'choice', 60);
            await sleep(0.8 * PM() + 0.3);
            const yes = document.getElementById('choice-yes'); if (yes) yes.click();
            await until(() => ow().kite, 8);
            step('Kite race: flying through all 12 rings');
            await until(() => !ow().kite, 120);
            await settle();
            milestone('kite', 'Flew Iolana\'s Kite Ring Race' + (ow().kiteMedal ? ' (' + ['', 'Bronze', 'Silver', 'Gold'][ow().kiteMedal] + ')' : ''));
        }
    }

    // ---------------------------------------------------------------- start / stop / finish
    async function run() {
        try {
            await until(() => ow().playerObj && gs().party.length, 120);
            await sleep(1.0);
            if (CFG.script) { await CFG.script({ walkTo, fight, findFlowSong, settle, sleep, until, step, note, talkToVillager, setNav, pos, assistTo, S, ow, gs }); await finish(true); return; }   // (a custom test script, for developers)
            await chapter1();
            await chapter2();
            await chapter3();
            await chapter4();
            await finish(true);
        } catch (e) {
            if (e === STOP) return;
            note('error', 'The bot hit a problem: ' + (e && e.message)); console.error(e);
            await finish(false);
        }
    }

    function reportText() {
        const lines = [];
        lines.push('THE GLITCHING TALES - TEST BOT REPORT');
        lines.push('Date: ' + new Date().toLocaleString());
        lines.push('Settings: class ' + CFG.skill + ', speed ' + CFG.speed + ', ' + (CFG.thorough ? 'everything' : 'story only') + ', safety net ' + (CFG.safety ? 'on' : 'off'));
        lines.push('Result: ' + (S.done ? 'THE GAME WAS BEATEN' : 'did not finish') + ' in ' + fmt(S.clock) + ' of game time');
        lines.push('');
        lines.push('Counts: ' + S.stats.creatures + ' story fights won, ' + S.stats.villagers + ' villagers met, ' + S.stats.shop + ' shop purchases');
        const p = gs().party[0]; if (p) lines.push('Hero at the end: level ' + p.level + ', ' + gs().coins + ' coins, weapon ' + (p.equippedWeapon && p.equippedWeapon.name));
        lines.push('Times the bot had to help (hop over scenery): ' + S.assists);
        lines.push('');
        lines.push('MILESTONES');
        S.milestones.forEach(m => lines.push('  [' + fmt(m.t) + '] ' + m.label));
        const bad = S.log.filter(l => l.kind !== 'info');
        lines.push(''); lines.push('PROBLEMS AND ASSISTS (' + bad.length + ')');
        bad.forEach(l => lines.push('  [' + fmt(l.t) + '] ' + l.kind.toUpperCase() + ': ' + l.text));
        lines.push(''); lines.push('GAME ERRORS CAUGHT (' + S.errors.length + ')');
        S.errors.forEach(e => lines.push('  ' + e));
        return lines.join('\n');
    }

    async function finish(ok) {
        if (ending) return; ending = true;
        S.done = ok; nav = null; aim = null; releaseKeys();
        S.step = ok ? 'DONE! The bot beat the game.' : 'The bot stopped.';
        updatePanel(true);
        const box = document.createElement('div'); box.id = 'bot-report';
        box.innerHTML = '<div class="br-card"><h2>' + (ok ? '🏆 The bot beat the game!' : '🤖 Test run stopped') + '</h2><pre></pre><div class="br-btns"><button id="br-dl">⬇ Download report</button><button id="br-close">Keep looking around</button><button id="br-menu">Back to title</button></div></div>';
        box.querySelector('pre').textContent = reportText();
        document.body.appendChild(box);
        box.querySelector('#br-dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportText()], { type: 'text/plain' })); a.download = 'glitching-tales-test-report.txt'; a.click(); };
        box.querySelector('#br-close').onclick = () => { box.remove(); };
        box.querySelector('#br-menu').onclick = () => location.reload();
        stopControl(true);
    }

    function stopControl(keepPanel) {
        S.active = false; releaseKeys(); nav = null; aim = null; lookAt = null; manualKeys = false;
        waiters.forEach(w => { try { w.rej(STOP); } catch (e) {} }); waiters = [];
        document.body.classList.remove('bot-on');
        if (CFG.safety && window.settingsSystem) window.settingsSystem.setGodMode(S.godBefore);
        if (panel && !keepPanel) panel.remove();
    }

    function start(opts = {}) {
        if (S.active) return;
        Object.assign(CFG, opts);
        Object.assign(S, { active: true, paused: false, done: false, cashatoDone: false, clock: 0, t0: Date.now(), step: 'Starting...', chapter: '', log: [], assists: 0, errors: [], milestones: [], prog: null, stats: { creatures: 0, villagers: 0, shop: 0, assists: 0 } });
        ending = false; waiters = []; nav = null; aim = null; lookAt = null; manualKeys = false; inShopTask = false;
        S.godBefore = !!gs().godMode;
        document.body.classList.add('bot-on');
        buildPanel();
        // a brand-new hero (the real save is never touched)
        const cc = window.characterCreationSystem;
        const player = cc.createPlayer('Test Bot', CFG.skill, '#e8b98a', '#3b6ea5');
        document.getElementById('main-menu').classList.add('hidden');
        gs().setDifficulty('NORMAL');
        gs().beginAdventure(player);
        if (window.settingsSystem && CFG.safety) window.settingsSystem.setGodMode(true);
        run();
    }

    function stop() { note('info', 'Stopped by the tester.'); finish(false); }

    // ---------------------------------------------------------------- the on-screen panel and the title-screen button
    function buildPanel() {
        if (panel) panel.remove();
        panel = document.createElement('div'); panel.id = 'bot-panel';
        panel.innerHTML = `
          <div class="bp-head"><span>🤖 TEST BOT</span><span class="bp-time">00:00</span></div>
          <div class="bp-chap"></div>
          <div class="bp-step"></div>
          <div class="bp-bar"><div class="bp-fill"></div></div>
          <div class="bp-prog"></div>
          <div class="bp-btns">
            <button data-a="pause">⏸ Pause</button>
            <button data-a="speed">🐢 Slow</button>
            <button data-a="list">☰</button>
            <button data-a="stop">⏹ Stop</button>
          </div>
          <div class="bp-list"></div>`;
        document.body.appendChild(panel);
        panel.addEventListener('click', (e) => {
            const a = e.target.dataset && e.target.dataset.a; if (!a) return;
            if (a === 'pause') { S.paused = !S.paused; e.target.textContent = S.paused ? '▶ Resume' : '⏸ Pause'; updatePanel(true); }
            else if (a === 'speed') { CFG.speed = CFG.speed === 'slow' ? 'normal' : CFG.speed === 'normal' ? 'fast' : 'slow'; updatePanel(true); }
            else if (a === 'list') panel.classList.toggle('open');
            else if (a === 'stop') stop();
        });
    }
    let panelAcc = 0;
    function updatePanel(force) {
        if (!panel) return;
        panelAcc += 1; if (!force && panelAcc % 12) return;
        const q = (s) => panel.querySelector(s);
        q('.bp-time').textContent = fmt(S.clock);
        q('.bp-chap').textContent = S.chapter;
        q('.bp-step').textContent = (S.paused ? '⏸ PAUSED - ' : '') + S.step;
        q('.bp-fill').style.width = Math.min(100, S.milestones.length / totalMilestones() * 100) + '%';
        q('.bp-prog').textContent = S.prog ? S.prog.label + ': ' + S.prog.done + ' / ' + S.prog.total + '   ·   assists: ' + S.assists : 'fights ' + S.stats.creatures + ' · villagers ' + S.stats.villagers + ' · assists ' + S.assists;
        const sp = panel.querySelector('[data-a="speed"]'); if (sp) sp.textContent = { slow: '🐢 Slow', normal: '🚶 Normal', fast: '🐇 Fast' }[CFG.speed];
        if (panel.classList.contains('open')) q('.bp-list').innerHTML = S.milestones.map(m => '<div>✓ ' + m.label + '</div>').join('') + S.log.filter(l => l.kind !== 'info').slice(-6).map(l => '<div class="bp-' + l.kind + '">' + (l.kind === 'assist' ? '↷ ' : '⚠ ') + l.text + '</div>').join('');
    }

    function buildSetup() {
        const old = document.getElementById('bot-setup'); if (old) old.remove();
        const m = document.createElement('div'); m.id = 'bot-setup';
        m.innerHTML = `
          <div class="bs-card">
            <h2>🤖 TEST MODE</h2>
            <p>The game plays itself, start to finish, slowly enough to watch. Your saved game is <b>not</b> touched.</p>
            <label>Hero class
              <select id="bs-class"><option value="melee">⚔ Melee</option><option value="range">🏹 Ranged</option><option value="magick">✨ Magick</option></select></label>
            <label>Coverage
              <select id="bs-cov"><option value="all">Everything (also finds the secret Flow Song creature)</option><option value="story">Story only (the main path, side quests, villagers)</option></select></label>
            <label>Speed
              <select id="bs-speed"><option value="slow">🐢 Slow (time to read everything)</option><option value="normal">🚶 Normal</option><option value="fast">🐇 Fast</option></select></label>
            <div class="bs-btns"><button id="bs-go">▶ Start the test</button><button id="bs-cancel">Cancel</button></div>
          </div>`;
        document.body.appendChild(m);
        m.querySelector('#bs-cancel').onclick = () => m.remove();
        m.querySelector('#bs-go').onclick = () => { const o = { skill: m.querySelector('#bs-class').value, thorough: m.querySelector('#bs-cov').value === 'all', speed: m.querySelector('#bs-speed').value }; m.remove(); start(o); };
    }

    window.addEventListener('DOMContentLoaded', () => {
        const b = document.getElementById('autoplay-btn'); if (b) b.addEventListener('click', buildSetup);
        // catch game errors so they show up in the report
        const harmless = (t) => /Pointer Lock|ResizeObserver/i.test(t);
        window.addEventListener('error', (e) => { const t = (e.message || 'error') + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : ''); if ((S.active || S.done) && !harmless(t)) S.errors.push(t); });
        const ce = console.error; console.error = function () { const t = Array.from(arguments).map(String).join(' ').slice(0, 200); if (S.active && !harmless(t)) S.errors.push(t); return ce.apply(console, arguments); };
        // ?autoplay=1 starts a run straight away (handy for testing): ?autoplay=1&speed=fast&mode=story&class=ranged
        const q = new URLSearchParams(location.search);
        if (q.get('turbo')) installTurbo(Math.max(1, Number(q.get('turbo')) || 8));
        if (q.get('autoplay')) setTimeout(() => start({ speed: q.get('speed') || 'slow', thorough: q.get('mode') !== 'story', skill: q.get('class') || 'melee' }), 600);
    });

    // DEVELOPER TOOL (?turbo=8): run the whole game F times faster than real life, without drawing, to test a full run quickly.
    function installTurbo(F) {
        const realNow = performance.now.bind(performance), st = window.setTimeout.bind(window), si = window.setInterval.bind(window), t0 = realNow();
        performance.now = () => t0 + (realNow() - t0) * F;
        window.setTimeout = (f, d, ...a) => st(f, (d || 0) / F, ...a);
        window.setInterval = (f, d, ...a) => si(f, (d || 0) / F, ...a);
        const ch = new MessageChannel(); let wake = null; ch.port1.onmessage = () => { const r = wake; wake = null; if (r) r(); };
        const yieldNow = () => new Promise(r => { wake = r; ch.port2.postMessage(0); });
        const T = window.__turbo = { run: true, frames: 0, errors: [], F };
        (async () => {
            let last = realNow();
            while (T.run) {
                const n = realNow();
                if (!T.muted && window.settingsSystem && typeof Sound !== 'undefined') { Sound.setVolume(0); T.muted = true; }   // (fast test runs are silent; this does not change the player's saved volume)
                if (typeof overworld3d !== 'undefined' && overworld3d.playerObj && n - last >= 30 / F) { last = n; overworld3d.noRender = !T.draw; try { overworld3d.frame(0.03); } catch (e) { T.errors.push(e.message); } T.frames++; }
                await yieldNow();
            }
        })();
    }

    return { start, stop, tick, get active() { return S.active; }, S, CFG, reportText, _sleep: sleep, _until: until, get _nav() { return nav; }, get _aim() { return aim; }, _plan: planPath };
})();
window.AutoPlay = AutoPlay;
