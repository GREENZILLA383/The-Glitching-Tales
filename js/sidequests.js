// SIDE QUESTS of Makani Village.
//
//  1. THE WINDMILL MYSTERY (Kekoa the Elder). Makani's windmills spin extremely fast until the player finds out why:
//     look for the swirling gusts at the Great Windmill and at two of the houses, then tell Kekoa. The windmills then calm down.
//     THE CAUSE (from the game's creator): a bully from cloud school wants to get back at a windmill, so every day he uses his
//     wings to make the windmills spin SUPER fast. The clues are feathers, then the player finds him hovering at the Great Windmill and
//     talks him round. (Exactly WHY he hates the windmill, his name "Zephyr" and his lines are my own placeholders - see TEXT.bully*.)
//  2. THE MISSING CAT (Malie the Cloud Gardener). Her cat Nimbus (name is a placeholder) has wandered off, to a different
//     hiding place every game. When the player finds him, he says the line about the game, then trots home to Malie.
//     Malie has no idea he is no ordinary cat: she never hears him talk.
//
// Both quests are offered the SECOND time you talk to Kekoa / Malie. State is kept in overworld3d.side (and saved).
const SideQuests = (() => {
    const WIND_RAGE = 9;                    // how many times too fast the windmills spin until the mystery is solved
    const CAT_NAME = 'Nimbus';              // (placeholder name)
    const REWARD = { wind: 150, cat: 120 };

    // ------------------------------------------------------------------ everything the characters say (edit freely)
    const TEXT = {
        windOffer: ['Traveler, have you noticed the windmills? They have been spinning so fast that the whole village hums!',
                    'They never turned like this before. Something is wrong, and I cannot tell what. Would you look into it for me?',
                    'Check the Great Windmill in the plaza, and the little windmills on the roofs. Look for anything strange.'],
        windInspect: [
            ['You put your hand on the Great Windmill. Its blades are whirling so fast they hum like a thousand bees.',
             'Nothing is broken. The gears, the blades, the tower... all fine. But a big white feather is caught on the tower. Somebody was here.'],
            ['Lani\'s little roof windmill is spinning so fast the whole house shivers.',
             'The gusts come in beats, whoosh, whoosh, whoosh, like something huge flapping. And there is another white feather on the roof.'],
            ['Hoku\'s roof windmill is a blur. A third white feather drifts down from the chimney.',
             'Three windmills, three feathers, all from big wings. Whoever is doing this can FLY. The gusts seem to start near the Great Windmill...']],
        windReady: 'Whoever is flapping those wings must be near the Great Windmill. Go and find them!',
        windConfront: [
            ['Zephyr, the Cloud-School Bully', 'Hey! Go away! I am busy!'],
            ['Zephyr, the Cloud-School Bully', 'What? Why am I flapping so hard? It is none of your business!'],
            ['Zephyr, the Cloud-School Bully', 'FINE. That windmill spun right in my face on my very first flying lesson at cloud school. Everybody laughed at me!'],
            ['Zephyr, the Cloud-School Bully', 'So every single day I come here and flap and flap until it spins SO fast it gets dizzy. That will show it!'],
            ['System', 'You tell him that windmills cannot help spinning, and that every windmill in Makani is spinning too fast because of him. The whole village hums, and nobody can sleep.'],
            ['Zephyr, the Cloud-School Bully', '...Everybody? I did not know that. I only wanted that one windmill to feel bad.'],
            ['Zephyr, the Cloud-School Bully', 'Maybe it never meant to spin in my face. It is just a windmill. Hmph. Okay. OKAY! I will stop. I am sorry, windmill.']],
        bullyChat: ['I said I was sorry! I am not flapping any more. Look, no flapping!', 'Cloud school is hard. Those windmills were only spinning. I know that now.'],
        windRemind: (n) => ['Have you found anything yet? You have looked at ' + n + ' of the 3 places so far.',
                            'Check the Great Windmill, and the roof windmills on Lani\'s and Hoku\'s houses. Look for anything strange.'],
        windRemind2: ['Feathers? From big wings? Then whoever is behind this can fly. I would look near the Great Windmill. That is where the wind is strongest.'],
        windReveal: ['So it was a bully from cloud school, all along! He has wings, but not very much sense yet.',
                     'And he said sorry? Well! Good. The windmills are already slowing down. I will have a word with his teachers, and I think he owes the village an apology too.',
                     'Thank you, traveler. You listened when nobody else did. Please take this for your trouble.'],
        catOffer: (hint) => ['Oh, hello again! Have you seen my cat, Nimbus? He is just an ordinary orange cat, but he wanders off and I worry.',
                             'He likes quiet corners... ' + hint + ' perhaps? Could you look for him? Thank you ever so much!'],
        catRemind: (hint) => ['No sign of Nimbus yet? He likes quiet corners. Maybe ' + hint + '?'],
        catWaiting: ['Oh? I think I hear little paws pattering this way...'],
        catThanks: ['Nimbus! There you are, you silly thing! Where did you wander off to?',
                    'He is giving me the strangest look... as if he is trying to tell me something. Cats, hm?',
                    'Thank you so much for finding him. Here, please take these coins. You are very kind.'],
        catMeet: ['Mrrrow.', '...Oh. You can hear me? Of course you can.', 'I know you think this is a game.',
                  'Do not tell Malie that I can talk. She thinks I am just an ordinary cat. It is better that way.',
                  'Fine. I was heading home anyway. Do not follow me.']
    };

    let ow = null, V = null, clues = [], cat = null, catT = 0, restPos = null, bully = null;
    const BULLY = { id: 'zephyr', name: 'Zephyr', title: 'the Cloud-School Bully', skin: '#f0c6a0', robe: '#e8643c', trim: '#ffd9b0', accent: '#ffcf4a', hair: '#2b2b3a', hairStyle: 'spiky', extra: 'schoolcap', pattern: 'stars', wings: true };
    const away = (x, z) => { const dx = x - V.x, dz = z - V.z, L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L }; };
    const toast = (t) => gameSystem.showToast(t);
    const save = () => { if (window.SaveGame) setTimeout(() => SaveGame.autosave(), 400); };
    function say(speaker, lines, after) {
        const g = gameSystem;
        g.dialogueQueue = lines.slice(1).map(text => ({ speaker, text }));
        if (after) g.afterTalk = after;
        g.showDialogue(speaker, lines[0]);
    }
    function reward(coins, label) { gameSystem.coins += coins; gameSystem.updateHUD(); Sound.play('chest'); toast('✔ ' + label + ' complete! +' + coins + ' coins'); }

    // where the cat might be hiding (a different one is picked each time the quest starts)
    const behind = (i) => { const p = ow.makaniInfo.plots[i], a = away(p.x, p.z); return { x: p.x + a.x * 8.5, z: p.z + a.z * 8.5 }; };
    const SPOTS = [
        { hint: 'near the Great Windmill', pos: () => ({ x: V.x + 13, z: V.z - 12 }) },
        { hint: 'behind Cashato\'s market', pos: () => { const s = ow.makaniInfo.shop, a = away(s.x, s.z); return { x: s.x + a.x * 10, z: s.z + a.z * 10 }; } },
        { hint: 'behind Hoku\'s house', pos: () => behind(2) },
        { hint: 'behind Aheahe\'s house', pos: () => behind(5) },
        { hint: 'behind Mahina\'s house', pos: () => behind(7) },
        { hint: 'out on the cloud road', pos: () => ({ x: V.x + 3, z: V.z + 70 }) }
    ];

    const villager = (id) => ow.entities.find(e => e.type === 'villager' && e.v.id === id);

    // ------------------------------------------------------------------ the swirling-gust markers (the clues)
    function buildClues() {
        const info = ow.makaniInfo, mk = (x, z, label) => {
            const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.95, fog: false, depthWrite: false });
            [[1.3, 0.14, 0], [0.85, 0.12, 1.1], [0.5, 0.1, 2.2]].forEach(([r, tube, y], i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 24), mat); t.rotation.x = Math.PI / 2; t.position.y = 1.0 + y * 0.7; t.userData.sp = (i % 2 ? -1 : 1) * (2 + i); grp.add(t); });
            grp.position.set(x, 0, z); grp.visible = false; ow.scene.add(grp);
            const ent = { type: 'clue', mesh: grp, idx: clues.length, label, radius: 6 };
            ow.entities.push(ent); clues.push(ent);
        };
        mk(V.x, V.z + 11, 'inspect the Great Windmill');
        [1, 2].forEach(i => {
            const p = info.plots[i], dx = V.x - p.x, dz = V.z - p.z, L = Math.hypot(dx, dz);
            mk(p.x + dx / L * 6 + dz / L * 5, p.z + dz / L * 6 - dx / L * 5, 'inspect the roof windmill');
        });
    }

    // ------------------------------------------------------------------ the cat
    function buildCatMesh() {
        const O = '#f2a65a', D = '#d9893a', W = '#fff6e8', P = [];
        const add = (p) => P.push(p);
        add({ shape: 'sphere', size: [1.5, 1.2, 2.3], pos: [0, 1.0, 0], color: O });
        add({ shape: 'sphere', size: [1.1, 0.7, 1.7], pos: [0, 0.75, 0.15], color: W });
        [-0.35, 0, 0.35].forEach(x => add({ shape: 'sphere', size: [0.22, 0.12, 0.9], pos: [x, 1.55, -0.1], color: D }));
        [[-0.5, 0.7], [0.5, 0.7], [-0.5, -0.7], [0.5, -0.7]].forEach(([x, z]) => add({ shape: 'capsule', size: [0.42, 0.85, 0.42], pos: [x, 0.42, z], color: W }));
        add({ shape: 'sphere', size: [1.45, 1.25, 1.25], pos: [0, 1.85, 1.2], color: O, name: 'head', pivot: [0, 1.5, 1.0] });
        add({ shape: 'sphere', size: [0.75, 0.5, 0.5], pos: [0, 1.62, 1.75], color: W, follow: 'head' });
        [-1, 1].forEach(s => {
            add({ shape: 'cone', size: [0.5, 0.75, 0.5], pos: [s * 0.45, 2.6, 1.15], color: O, follow: 'head' });
            add({ shape: 'sphere', size: [0.34, 0.42, 0.16], pos: [s * 0.36, 1.98, 1.78], color: '#9dff9d', emissive: '#4bd24b', follow: 'head' });
            add({ shape: 'sphere', size: [0.1, 0.34, 0.12], pos: [s * 0.36, 1.98, 1.88], color: '#1a1a24', follow: 'head' });
        });
        add({ shape: 'sphere', size: [0.18, 0.13, 0.13], pos: [0, 1.72, 1.98], color: '#ff9aa8', follow: 'head' });
        add({ shape: 'capsule', size: [0.4, 2.2, 0.4], pos: [0, 1.7, -1.8], rot: [-0.95, 0, 0], color: O, name: 'tail', pivot: [0, 1.0, -1.2] });
        const m = VoxelBuilder.buildCharacter(P); m.scale.setScalar(1.15);
        return m;
    }
    function spawnCat(x, z) {
        if (cat) removeCat();
        const mesh = buildCatMesh(); mesh.position.set(x, 0, z); mesh.userData.rigged = true; ow.scene.add(mesh);
        cat = { type: 'cat', mesh, label: 'talk to the cat', radius: 5, tail: mesh.getObjectByName('tail'), head: mesh.getObjectByName('head'), travel: null };
        ow.entities.push(cat);
    }
    // the bully: hovers beside the Great Windmill flapping like mad (until talked to), then lands and sulks
    function bullyHome() { return { x: V.x + 11, z: V.z + 2 }; }
    function spawnBully() {
        if (bully) removeBully();
        const mesh = buildVillager3D(BULLY);
        const wl = mesh.getObjectByName('wing_l'), wr = mesh.getObjectByName('wing_r'), head = mesh.getObjectByName('head'), scarf = mesh.getObjectByName('scarf');
        [head, scarf, wl, wr].forEach(p => { if (p) ow.mergeGroup(p, { own: true, castShadow: false }); });
        ow.mergeGroup(mesh, { own: true, castShadow: false, exclude: [head, scarf, wl, wr].filter(Boolean) });
        const h = bullyHome(); mesh.scale.setScalar(0.8); mesh.position.set(h.x, 7, h.z); mesh.rotation.y = Math.atan2(V.x - h.x, V.z - h.z);
        mesh.userData.rigged = true;      // (we animate him ourselves: the game's gentle bobbing pass must leave him alone)
        ow.scene.add(mesh);
        bully = { type: 'bully', mesh, wl, wr, head, label: 'talk to Zephyr', radius: 7, y: 7 };
        ow.entities.push(bully);
    }
    function removeBully() { if (!bully) return; ow.scene.remove(bully.mesh); const i = ow.entities.indexOf(bully); if (i >= 0) ow.entities.splice(i, 1); bully = null; }

    function removeCat() { if (!cat) return; ow.scene.remove(cat.mesh); const i = ow.entities.indexOf(cat); if (i >= 0) ow.entities.splice(i, 1); cat = null; }
    function computeRest() {
        const m = villager('malie'); if (!m) return null;
        const dx = V.x - m.mesh.position.x, dz = V.z - m.mesh.position.z, L = Math.hypot(dx, dz) || 1;
        return { x: m.mesh.position.x + dx / L * 2 - dz / L * 2.8, z: m.mesh.position.z + dz / L * 2 + dx / L * 2.8, mx: m.mesh.position.x, mz: m.mesh.position.z };
    }

    // ------------------------------------------------------------------ talking to Kekoa and Malie (their SECOND chat)
    function talkVillager(ent, first) {
        if (!ow || first) return false;
        const id = ent.v.id, who = ent.v.name + ', ' + ent.v.title, S = ow.side;
        if (id === 'kekoa') {
            const w = S.wind;
            if (w.state === 'none') { w.state = 'active'; say(who, TEXT.windOffer, () => toast('Side quest started: The Windmill Mystery')); save(); return true; }
            if (w.state === 'active') { say(who, TEXT.windRemind(w.clues.filter(Boolean).length)); return true; }
            if (w.state === 'confront') { say(who, TEXT.windRemind2); return true; }
            if (w.state === 'stopped') { w.state = 'done'; say(who, TEXT.windReveal, () => reward(REWARD.wind, 'The Windmill Mystery')); save(); return true; }
            return false;
        }
        if (id === 'malie') {
            const c = S.cat;
            if (c.state === 'none') {
                c.state = 'active'; c.spot = Math.floor(Math.random() * SPOTS.length);
                const p = SPOTS[c.spot].pos(); spawnCat(p.x, p.z);
                say(who, TEXT.catOffer(SPOTS[c.spot].hint), () => toast('Side quest started: The Missing Cat')); save(); return true;
            }
            if (c.state === 'active') { say(who, TEXT.catRemind(SPOTS[c.spot].hint)); return true; }
            if (c.state === 'returning') { say(who, TEXT.catWaiting); return true; }
            if (c.state === 'found') { c.state = 'done'; say(who, TEXT.catThanks, () => reward(REWARD.cat, 'The Missing Cat')); save(); return true; }
            return false;
        }
        return false;
    }

    // ------------------------------------------------------------------ pressing E on a clue or on the cat
    function use(e) {
        const S = ow.side;
        if (e.type === 'clue') {
            if (S.wind.state !== 'active' || S.wind.clues[e.idx]) return;
            S.wind.clues[e.idx] = 1;
            const n = S.wind.clues.filter(Boolean).length;
            say('System', TEXT.windInspect[e.idx], () => {
                if (n >= 3) { S.wind.state = 'confront'; spawnBully(); toast(TEXT.windReady); } else toast('Clue found (' + n + '/3)');
                save();
            });
        } else if (e.type === 'bully') {
            if (S.wind.state === 'confront') {
                const g = gameSystem; g.dialogueQueue = TEXT.windConfront.slice(1).map(([speaker, text]) => ({ speaker, text }));
                g.afterTalk = () => { S.wind.state = 'stopped'; toast('The windmills are slowing down. Tell Kekoa!'); save(); };
                g.showDialogue(TEXT.windConfront[0][0], TEXT.windConfront[0][1]);
            } else say(BULLY.name + ', ' + BULLY.title, [TEXT.bullyChat[Math.floor(Math.random() * TEXT.bullyChat.length)]]);
        } else if (e.type === 'cat') {
            if (S.cat.state !== 'active') return;
            say(CAT_NAME + ' the Cat', TEXT.catMeet, () => {
                S.cat.state = 'returning';
                restPos = computeRest();
                if (restPos && cat) cat.travel = { x: restPos.x, z: restPos.z };
                toast(CAT_NAME + ' trots off home.');
                save();
            });
        }
    }

    // ------------------------------------------------------------------ every frame
    function update(dt) {
        if (!ow || !ow.side) return;
        catT += dt;
        const S = ow.side;
        clues.forEach((c, i) => {
            const show = S.wind.state === 'active' && !S.wind.clues[i];
            c.mesh.visible = show;
            if (show) c.mesh.children.forEach(t => { t.rotation.z += t.userData.sp * dt; });
        });
        // the windmills settle down (smoothly) once the mystery is solved
        const target = (S.wind.state === 'done' || S.wind.state === 'stopped') ? 1 : WIND_RAGE;
        ow.windMul += (target - ow.windMul) * Math.min(1, dt * 0.7);
        if (bully) {
            const m = bully.mesh, angry = S.wind.state === 'confront', ty = angry ? 7 + Math.sin(catT * 2.2) * 0.6 : 0;
            bully.y += (ty - bully.y) * Math.min(1, dt * 2.5); m.position.y = bully.y;
            const flap = angry ? Math.sin(catT * 16) * 0.65 : 0.12;           // flapping like mad, then wings folded
            if (bully.wr) bully.wr.rotation.z = flap; if (bully.wl) bully.wl.rotation.z = -flap;
            if (bully.head) bully.head.rotation.x += ((angry ? -0.1 : 0.45) - bully.head.rotation.x) * Math.min(1, dt * 3);   // glaring, then looking at his feet
        }
        if (!cat) return;
        if (cat.tail) cat.tail.rotation.z = Math.sin(catT * 3.2) * 0.45;
        const m = cat.mesh;
        if (cat.travel) {                                              // bounding home across the clouds
            const dx = cat.travel.x - m.position.x, dz = cat.travel.z - m.position.z, d = Math.hypot(dx, dz);
            if (d < 0.8) {
                cat.travel = null; m.position.y = 0; S.cat.state = 'found';
                if (restPos) m.rotation.y = Math.atan2(restPos.mx - m.position.x, restPos.mz - m.position.z);
                toast(CAT_NAME + ' is back with Malie!'); save();
            } else {
                const step = Math.min(d, 15 * dt);
                m.position.x += dx / d * step; m.position.z += dz / d * step;
                m.position.y = Math.abs(Math.sin(catT * 9)) * 1.1;
                m.rotation.y = Math.atan2(dx, dz);
            }
        } else if (cat.head) cat.head.rotation.y = Math.sin(catT * 0.8) * 0.4;     // looking about
    }

    // ------------------------------------------------------------------ guidance for the compass / objective line
    function objective() {
        if (!ow || !ow.side) return null;
        const S = ow.side, at = (e, text) => ({ text, x: e.mesh.position.x, z: e.mesh.position.z });
        const c = S.cat;
        if (c.state === 'active') return { text: 'Side quest: find ' + CAT_NAME + ', Malie\'s cat (maybe ' + SPOTS[c.spot].hint + ')' };
        if (c.state === 'returning' || c.state === 'found') { const m = villager('malie'); if (m) return at(m, 'Side quest: tell Malie you found ' + CAT_NAME); }
        const w = S.wind;
        if (w.state === 'confront' && bully) return at(bully, 'Side quest: find whoever is flapping those wings (near the Great Windmill)');
        if (w.state === 'active') {
            const left = clues.filter((cl, i) => !w.clues[i]);
            if (left.length) { const p = ow.playerObj.position; left.sort((a, b) => Math.hypot(a.mesh.position.x - p.x, a.mesh.position.z - p.z) - Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z)); return at(left[0], 'Side quest: find out why the windmills spin so fast (' + w.clues.filter(Boolean).length + '/3 clues)'); }
        }
        if (w.state === 'stopped') { const k = villager('kekoa'); if (k) return at(k, 'Side quest: tell Kekoa what happened'); }
        return null;
    }

    // ------------------------------------------------------------------ set-up, saving and loading
    function init(o) {
        ow = o; V = MAKANI; clues = []; cat = null; bully = null; catT = 0;
        ow.side = { cat: { state: 'none', spot: -1 }, wind: { state: 'none', clues: [0, 0, 0] } };
        ow.windMul = WIND_RAGE;
        buildClues();
    }
    // called after a saved game has put ow.side back
    function restore() {
        if (!ow || !ow.side) return;
        const S = ow.side;
        if (S.wind.state === 'ready') S.wind.state = 'confront';
        ow.windMul = (S.wind.state === 'done' || S.wind.state === 'stopped') ? 1 : WIND_RAGE;
        removeBully();
        if (['confront', 'stopped', 'done'].includes(S.wind.state)) spawnBully();
        removeCat();
        if (S.cat.state === 'active' && S.cat.spot >= 0) { const p = SPOTS[S.cat.spot].pos(); spawnCat(p.x, p.z); }
        else if (S.cat.state === 'returning' || S.cat.state === 'found' || S.cat.state === 'done') {
            S.cat.state = S.cat.state === 'returning' ? 'found' : S.cat.state;
            restPos = computeRest(); if (restPos) { spawnCat(restPos.x, restPos.z); cat.mesh.rotation.y = Math.atan2(restPos.mx - restPos.x, restPos.mz - restPos.z); }
        }
    }

    return { init, restore, update, use, talkVillager, objective, TEXT, WIND_RAGE, get cat() { return cat; } };
})();
window.SideQuests = SideQuests;
