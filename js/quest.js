// Quest guidance: a compass bar at the top of the screen with a gold marker pointing at your next goal,
// a line of text saying what that goal is, and a faint golden light-beam in the world over the goal.
// The goal is worked out from the game state each moment (nothing here needs saving).
const Quest = (() => {
    let compass, objective, tickEls = [], mark, markLabel, beam, beamCore, ready = false;
    let width = 440, lastKey = null, frame = 0, lastWidthCheck = 0;
    const TAU = Math.PI * 2;
    const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

    function build() {
        const layer = document.getElementById('ui-layer');
        if (!layer) return false;
        compass = document.createElement('div'); compass.id = 'compass';
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        for (let deg = 0; deg < 360; deg += 15) {
            const t = document.createElement('div');
            t.className = 'ct' + (deg % 90 === 0 ? ' cardinal' : deg % 45 === 0 ? ' inter' : ' minor');
            if (deg === 0) t.classList.add('north');
            t.textContent = names[deg] || '·';
            t.dataset.deg = deg;
            compass.appendChild(t); tickEls.push(t);
        }
        const center = document.createElement('div'); center.id = 'compass-center'; compass.appendChild(center);
        mark = document.createElement('div'); mark.className = 'cm';
        mark.innerHTML = '<span class="cm-gem">◆</span><span class="cm-dist"></span>';
        markLabel = mark.querySelector('.cm-dist');
        compass.appendChild(mark);
        objective = document.createElement('div'); objective.id = 'objective';
        layer.appendChild(compass); layer.appendChild(objective);

        // The light-beam in the world (lives in the 3D scene, not the page)
        const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
        beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 160, 14, 1, true), mat(0xffb938, 0.09));
        beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 160, 10, 1, true), mat(0xffd36e, 0.22));
        beam.visible = beamCore.visible = false;
        overworld3d.scene.add(beam); overworld3d.scene.add(beamCore);
        return true;
    }

    // What should the player be doing right now? -> { text, x, z } (x/z missing = nothing to point at)
    function current() {
        const gs = window.gameSystem, ow = overworld3d;
        if (!gs || !ow.playerObj || !gs.party.length) return null;
        const p = gs.party[0], pos = ow.playerObj.position;
        const at = (e, text) => ({ text, x: e.mesh.position.x, z: e.mesh.position.z });

        if (gs.state === 'gauntlet' || ow.oblongtaloMesh) return { text: "Survive Oblongtalo's charges!" };
        if (ow.skyReached) {
            const sg = window.SkyGuards && SkyGuards.objective(pos);       // the Stairs of Foam (a pass in your pocket, or you are at the arena)
            if (sg && (sg.x === undefined || Math.hypot(pos.x - MAKANI.x, pos.z - MAKANI.z) >= 120 || SkyGuards.active || (gameSystem.party[0].hasCloudPass && !(window.SideQuests && SideQuests.objective())))) return sg;
            if (Math.hypot(pos.x - MAKANI.x, pos.z - MAKANI.z) < 120) {
                const sq = window.SideQuests && SideQuests.objective();       // a side quest you have taken on comes first
                if (sq) return sq;
                const met = ow.metVillagers ? ow.metVillagers.size : 0;
                if (met < VILLAGERS.length) {   // lead the way to the nearest villager you haven't met yet
                    let best = null, bd = 1e12;
                    ow.entities.forEach(e => { if (e.type === 'villager' && !ow.metVillagers.has(e.v.id)) { const d = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z); if (d < bd) { bd = d; best = e; } } });
                    if (best) return { text: 'Say hello to the villagers of Makani (' + met + '/' + VILLAGERS.length + ')', x: best.mesh.position.x, z: best.mesh.position.z };
                }
                if (ow.kiteBest == null) {   // all met: point at Iolana and her kite race
                    const io = ow.entities.find(e => e.type === 'villager' && e.v.id === 'iolana');
                    if (io) return { text: 'Talk to Iolana again to try her kite race', x: io.mesh.position.x, z: io.mesh.position.z };
                }
                const ph = window.SkyGuards && SkyGuards.passHint();
                if (ph) { const cz = ow.entities.find(e => e.type === 'villager' && e.v.id === 'cashato'); if (cz) return at(cz, ph); }
                return { text: 'Explore Makani Village', x: MAKANI.x, z: MAKANI.z };
            }
            return { text: 'Follow the cloud road north to Makani Village', x: MAKANI.x, z: MAKANI.z + 30 };
        }
        if (ow.desertReached) {
            if (ow._fallingToCore) return { text: '...' };
            if (Math.hypot(pos.x - VILLAGE.x, pos.z - VILLAGE.z) < 130) return { text: 'Find the quicksand that leads to the Gravity Core', x: QUICKSAND.x, z: QUICKSAND.z };
            return { text: 'Cross the shifting Dunes to reach Cacto Village', x: VILLAGE.x, z: VILLAGE.z + 20 };
        }
        if (ow.reefReached) {
            if (ow.arenaTriggered) return { text: '...' };
            const left = Math.max(0, Math.round(pos.z - REEF_END_Z));
            return { text: left > 14 ? 'Cross the Coral Reef to find Oblongtalo' : "Enter Oblongtalo's plaza", x: 0, z: REEF_END_Z - 16 };
        }
        if (ow.handWaveTriggered) return { text: '...' };

        if (!p.hasGlider) {
            const b = ow.entities.find(e => e.storyId === 'barnico');
            if (b) return at(b, 'Talk to Elder Barnico');
        }
        if (gs.party.length < 2) {
            const o = ow.entities.find(e => e.storyId === 'octa_join');
            if (o) return at(o, 'Meet Octa (walk up to her)');
        }
        const croton = ow.entities.find(e => e.bossId === 'croton');
        if (!croton) return { text: 'Walk through the Sea Gate to the boat', x: 0, z: WORLD.handWaveTriggerZ + 7 };
        if (pos.z > TEMPLE_FRONT_Z + 12) return { text: 'Travel south to the Temple of Crabs', x: 0, z: TEMPLE_FRONT_Z + 8 };

        // Inside the temple: clear whichever locked room has crabs nearest to you, then take on Croton.
        let best = null, bestD = Infinity;
        (ow.templeGates || []).forEach(g => {
            if (g.opened || g.req === 'boss') return;
            ow.entities.forEach(e => {
                if (e.type !== 'enemy' || e.roomId !== g.req || e.data.hp <= 0) return;
                const d = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z);
                if (d < bestD) { bestD = d; best = e; }
            });
        });
        if (best) return at(best, 'Defeat the crabs to open the gate');
        return at(croton, 'Defeat Croton, King of Crabs');
    }

    function update(delta) {
        if (!ready) { ready = build(); if (!ready) return; }
        const gs = window.gameSystem, ow = overworld3d;
        const live = ow.playerObj && gs.party.length && !(window.GravityCore && GravityCore.active) && (gs.state === 'overworld' || gs.state === 'gauntlet' || gs.state === 'dialogue' || gs.state === 'shop' || gs.state === 'paused');
        compass.classList.toggle('on', !!live);
        objective.classList.toggle('on', !!live);
        if (!live) { beam.visible = beamCore.visible = false; return; }
        if (++frame % 2) return; // every other frame is plenty

        if (performance.now() - lastWidthCheck > 1000) { width = compass.offsetWidth || 440; lastWidthCheck = performance.now(); }
        const f = new THREE.Vector3(); ow.camera.getWorldDirection(f);
        const heading = Math.atan2(-f.x, f.z);               // north is +z, east is -x (so the temple lies to the south)
        const perRad = width / Math.PI;                       // the bar shows a 180 degree view

        tickEls.forEach(t => {
            const d = wrap(t.dataset.deg * Math.PI / 180 - heading);
            if (Math.abs(d) > Math.PI / 2 + 0.05) { t.style.display = 'none'; return; }
            t.style.display = 'flex';
            t.style.transform = `translateX(${width / 2 + d * perRad}px)`;
            t.style.opacity = String(1 - Math.pow(Math.abs(d) / (Math.PI / 2), 3) * 0.8);
        });

        const q = current();
        if (!q) return;
        const pos = ow.playerObj.position;
        const hasTarget = q.x !== undefined;
        const dist = hasTarget ? Math.hypot(q.x - pos.x, q.z - pos.z) : 0;
        objective.textContent = (q.text || '') + (hasTarget && dist > 14 ? `  ·  ${Math.round(dist)} m` : '');
        if (q.text !== lastKey) {
            if (lastKey !== null) { objective.classList.remove('flash'); void objective.offsetWidth; objective.classList.add('flash'); Sound.play('save'); }
            lastKey = q.text;
        }

        if (hasTarget && dist > 14) {
            const d = wrap(Math.atan2(-(q.x - pos.x), q.z - pos.z) - heading);
            const clamped = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d));
            mark.style.display = 'flex';
            mark.style.transform = `translateX(${width / 2 + clamped * perRad}px)`;
            mark.classList.toggle('edge', Math.abs(d) > Math.PI / 2);
            markLabel.textContent = Math.round(dist) + 'm';
            // the light-beam over the goal
            const t = performance.now() / 1000;
            beam.visible = beamCore.visible = true;
            beam.position.set(q.x, 70, q.z); beamCore.position.set(q.x, 70, q.z);
            beam.material.opacity = 0.09 + Math.sin(t * 2.4) * 0.03;
        } else {
            mark.style.display = 'none';
            beam.visible = beamCore.visible = false;
        }
    }

    function hide() { if (compass) compass.classList.remove('on'); if (objective) objective.classList.remove('on'); if (beam) beam.visible = beamCore.visible = false; }
    return { update, current, hide };
})();
window.Quest = Quest;
