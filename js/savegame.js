// Saving and loading. Progress is stored in the browser (localStorage), so it stays on this device.
// The world is generated from a fixed seed, so a save only needs to remember what CHANGED:
// which creatures / chests / coins are gone, plus your character, stats, weapon and position.
const SaveGame = (() => {
    const KEY = 'glitching-tales-save-v1';
    const VERSION = 1;
    let indicator = null, lastSave = 0, startedAt = Date.now(), priorPlaySeconds = 0;

    function read() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            const d = JSON.parse(raw);
            return d && d.v === VERSION && d.player ? d : null;
        } catch (e) { return null; }
    }
    function has() { return !!read(); }
    function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

    // Can the game be saved right now? (Not mid-cutscene, mid-boss-gauntlet, or after falling.)
    function canSave() {
        const gs = window.gameSystem, ow = typeof overworld3d !== 'undefined' ? overworld3d : null;
        if (!gs || !ow || !ow.playerObj || !gs.party.length) return false;
        if (window.AutoPlay && (AutoPlay.active || AutoPlay.S.done)) return false;   // Test Mode never touches your real saved game
        if (gs.isCutscene || gs.state === 'gauntlet' || gs.state === 'gameover' || gs.state === 'menu') return false;
        // Not while the boat voyage runs or during Oblongtalo's challenge; the long Coral Reef is fine to save in.
        if (ow.voyage || ow.skyRide || ow.kite || gs.state === 'choice' || ow.oblongtaloMesh || (window.GravityCore && GravityCore.active)) return false;
        if (ow.arenaTriggered && !ow.desertReached) return false;
        if (ow.handWaveTriggered && !ow.reefReached) return false;
        if (gs.party[0].hp <= 0) return false;
        return true;
    }

    function collect() {
        const gs = window.gameSystem, ow = overworld3d, p = gs.party[0];
        const present = new Set(ow.entities.map(e => e.uid));
        const gone = [];
        for (let i = 0; i < (ow._entityTotal || 0); i++) if (!present.has(i)) gone.push(i);
        const w = p.equippedWeapon;
        return {
            v: VERSION,
            savedAt: Date.now(),
            playSeconds: Math.round(priorPlaySeconds + (Date.now() - startedAt) / 1000),
            difficulty: gs.difficultyStr,
            coins: gs.coins,
            player: {
                name: p.name, skillType: p.skillType, appearance: p.appearance,
                level: p.level, exp: p.exp, expToNext: p.expToNext,
                maxHp: p.maxHp, maxMp: p.maxMp, maxStamina: p.maxStamina,
                attack: p.attack, defense: p.defense, speed: p.speed,
                hasGlider: !!p.hasGlider,
                equippedWeapon: { ...w }, weaponIsDefault: w.name === p.defaultWeapon.name
            },
            hasOcta: gs.party.length > 1,
            world: {
                x: +ow.playerObj.position.x.toFixed(2), y: +Math.max(0, ow.playerObj.position.y).toFixed(2), z: +ow.playerObj.position.z.toFixed(2),
                yaw: ow.camera.rotation.y
            },
            gone,
            reef: !!ow.reefReached,
            desert: !!ow.desertReached,
            sky: !!ow.skyReached,
            met: [...(ow.metVillagers || [])],
            kite: { best: ow.kiteBest == null ? null : +ow.kiteBest.toFixed(2), medal: ow.kiteMedal || 0 },
            coinsTaken: ow.collectedCoins || [],
            flow: { unlocked: Sound.flowUnlocked, on: Sound.flowOn }
        };
    }

    function showIndicator(text) {
        if (!indicator) {
            indicator = document.createElement('div'); indicator.id = 'save-indicator';
            indicator.style.cssText = 'position:fixed;left:18px;bottom:16px;padding:6px 12px;border-radius:8px;background:rgba(0,0,0,0.6);color:#fff;font:600 13px Outfit,sans-serif;z-index:5000;opacity:0;transition:opacity .4s;pointer-events:none;';
            document.body.appendChild(indicator);
        }
        indicator.textContent = text;
        indicator.style.opacity = '1';
        clearTimeout(indicator._t);
        indicator._t = setTimeout(() => { indicator.style.opacity = '0'; }, 1600);
    }

    // Write the save. Returns true on success.
    function save(manual = false) {
        if (!canSave()) return false;
        try {
            localStorage.setItem(KEY, JSON.stringify(collect()));
            lastSave = Date.now();
            showIndicator('💾 ' + (manual ? 'Game saved!' : 'Saved'));
            if (manual) Sound.play('save');
            return true;
        } catch (e) { return false; } // storage blocked or full
    }

    // Quiet background save (ignored if we just saved, or it isn't a safe moment).
    function autosave() {
        if (Date.now() - lastSave < 4000) return false;
        const gs = window.gameSystem;
        if (!gs || gs.state === 'paused' || gs.state === 'settings') return false;
        return save(false);
    }

    // After the world has been built, put it back the way the save left it.
    function applyWorld(d) {
        const ow = overworld3d, gs = window.gameSystem;
        const gone = new Set(d.gone || []);
        ow.entities = ow.entities.filter(e => {
            if (gone.has(e.uid)) { if (e.mesh) ow.scene.remove(e.mesh); return false; }
            return true;
        });
        const taken = new Set(d.coinsTaken || []);
        ow.collectedCoins = [...taken];
        ow.colliders = ow.colliders.filter(c => {
            if (c.isCoin && taken.has(c.coinId)) { ow.worldGroup.remove(c.meshGroup); return false; }
            return true;
        });
        ow.tryOpenGates(true); // gates for cleared rooms stay open
        if (d.reef) { ow.reefReached = true; ow.handWaveTriggered = true; } // already past the boat: back in the Coral Reef
        if (d.desert) { ow.reefReached = true; ow.handWaveTriggered = true; ow.arenaTriggered = true; ow.desertReached = true; } // Chapter 3: the Dunes of Force
        if (d.met) ow.metVillagers = new Set(d.met);
        if (d.kite) { ow.kiteBest = d.kite.best == null ? null : d.kite.best; ow.kiteMedal = d.kite.medal || 0; }
        if (d.sky) { ow.reefReached = true; ow.handWaveTriggered = true; ow.arenaTriggered = true; ow.desertReached = true; ow.skyReached = true; ow.perchSkyCloud(); } // Chapter 4: the Sky Kingdom

        const w = d.world;
        ow.playerObj.position.set(w.x, w.y, w.z);
        if (w.y > 0.2) { ow.isJumping = true; ow.grounded = false; ow.velocityY = 0; }
        ow.camera.rotation.order = 'YXZ';
        ow.camera.rotation.set(-0.22, w.yaw || 0, 0);
        ow.cameraYaw = w.yaw || 0; ow.cameraPitch = -0.22;

        if (d.hasOcta) {
            const octa = JSON.parse(JSON.stringify(CHARACTERS.octa));
            octa.build3D = CHARACTERS.octa.build3D;
            gs.party.push(octa);
            ow.spawnCompanion(octa);
        }
        if (d.flow && d.flow.unlocked) {
            gs.flowSongUnlocked = true;
            Sound.unlockFlow(false);
            Sound.setFlow(!!d.flow.on);
            ow._songHinted = true;
        }
        priorPlaySeconds = d.playSeconds || 0; startedAt = Date.now();
    }

    function describe(d) {
        if (!d) return '';
        const mins = Math.max(0, Math.round((Date.now() - d.savedAt) / 60000));
        const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
        return `${d.player.name} · Lv.${d.player.level} · ${d.coins} coins · saved ${ago}`;
    }

    // Autosave every 20 seconds while you play.
    setInterval(() => { if (window.gameSystem && window.gameSystem.state === 'overworld') autosave(); }, 20000);
    const saveOnLeave = () => { try { if (canSave() && window.gameSystem.state !== 'gameover') save(false); } catch (e) {} };
    window.addEventListener('beforeunload', saveOnLeave);
    window.addEventListener('pagehide', saveOnLeave);                                   // phones: switching apps or closing the tab
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnLeave(); });

    return { read, has, clear, save, autosave, canSave, applyWorld, describe };
})();
window.SaveGame = SaveGame;
