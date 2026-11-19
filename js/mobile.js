// Phone / tablet support: touch controls, a phone-friendly layout, fullscreen + landscape, and the install-as-an-app bits.
//
//   LEFT thumb  : a floating analog joystick appears wherever you touch (move)
//   RIGHT side  : drag anywhere to look around
//   Buttons     : ATTACK (hold to keep attacking) and JUMP (hold in the air to glide)
//   Everything else (talking, shops, menus) is just tapping.
//
// The page decides it's on a touch device in index.html (window.IS_MOBILE); you can force it with ?mobile=1
// (or turn it off with ?mobile=0), or with the "Touch Controls" switch in Settings.
const Mobile = (() => {
    const on = !!window.IS_MOBILE;
    const stick = { x: 0, y: 0, active: false };
    let root = null, stickZone, lookZone, base, knob, atkBtn, jumpBtn, talkBtn, hint, built = false, wasPlaying = false;
    let stickId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0, atkTimer = null;
    const STICK_R = 58;

    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };

    function setKeys(x, y) {   // the game's climbing / gliding still read the keyboard, so mirror the stick as arrow keys too
        const k = overworld3d.keys;
        k['w'] = y > 0.4; k['s'] = y < -0.4; k['d'] = x > 0.4; k['a'] = x < -0.4;
    }

    function releaseStick() {
        stickId = null; stick.x = stick.y = 0; stick.active = false; setKeys(0, 0);
        if (base) { base.classList.remove('live'); base.style.left = ''; base.style.top = ''; knob.style.transform = ''; }
    }
    function releaseAll() {
        releaseStick(); lookId = null; clearInterval(atkTimer); atkTimer = null;
        overworld3d.keys[' '] = false;
        [atkBtn, jumpBtn].forEach(b => b && b.classList.remove('down'));
    }

    function updateStick(e) {
        let dx = e.clientX - ox, dy = e.clientY - oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        stick.x = dx / STICK_R; stick.y = -dy / STICK_R;
        stick.active = Math.hypot(stick.x, stick.y) > 0.12;
        if (!stick.active) { stick.x = stick.y = 0; }
        setKeys(stick.x, stick.y);
    }

    function lookBy(dx, dy) {
        if (window.GravityCore && GravityCore.active) GravityCore.lookBy(dx, dy);
        else overworld3d.lookBy(dx, dy);
    }

    function build() {
        if (built) return;
        built = true;
        root = document.getElementById('mobile-controls');
        root.innerHTML = '';
        root.classList.add('mc-root');
        lookZone = el('div', 'mc-look-zone');
        stickZone = el('div', 'mc-stick-zone');
        base = el('div', 'mc-stick-base'); knob = el('div', 'mc-stick-knob'); base.appendChild(knob);
        atkBtn = el('div', 'mc-btn', '⚔'); atkBtn.id = 'mc-attack';
        jumpBtn = el('div', 'mc-btn', '⤒'); jumpBtn.id = 'mc-jump';
        talkBtn = el('div', 'mc-btn', '💬'); talkBtn.id = 'mc-talk';
        const jl = el('div', 'mc-btn-label', 'JUMP / GLIDE'); jumpBtn.appendChild(jl);
        hint = el('div', 'mc-hint', 'Left thumb: move   ·   Drag on the right: look   ·   ⚔ attack   ·   ⤒ jump (hold in air to glide)');
        root.append(lookZone, stickZone, base, atkBtn, jumpBtn, talkBtn, hint);
        overworld3d.stick = stick;

        // --- joystick: appears wherever the left thumb lands
        stickZone.addEventListener('pointerdown', (e) => {
            if (stickId !== null) return;
            stickId = e.pointerId; stickZone.setPointerCapture(e.pointerId);
            ox = e.clientX; oy = e.clientY;
            base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('live');
            updateStick(e);
        });
        stickZone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) updateStick(e); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => stickZone.addEventListener(ev, (e) => { if (e.pointerId === stickId) releaseStick(); }));

        // --- look: drag on the right side
        lookZone.addEventListener('pointerdown', (e) => { if (lookId !== null) return; lookId = e.pointerId; lookZone.setPointerCapture(e.pointerId); lx = e.clientX; ly = e.clientY; });
        lookZone.addEventListener('pointermove', (e) => { if (e.pointerId !== lookId) return; lookBy(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => lookZone.addEventListener(ev, (e) => { if (e.pointerId === lookId) lookId = null; }));

        // --- attack: tap, or hold to keep swinging / shooting
        const attack = () => { if (window.combatSystem) combatSystem.performPlayerAttack(); };
        atkBtn.addEventListener('pointerdown', (e) => { atkBtn.setPointerCapture(e.pointerId); atkBtn.classList.add('down'); attack(); clearInterval(atkTimer); atkTimer = setInterval(attack, 130); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => atkBtn.addEventListener(ev, () => { atkBtn.classList.remove('down'); clearInterval(atkTimer); atkTimer = null; }));

        // --- jump / glide: holding it in the air glides (once you have the glider)
        jumpBtn.addEventListener('pointerdown', (e) => { jumpBtn.setPointerCapture(e.pointerId); jumpBtn.classList.add('down'); overworld3d.keys[' '] = true; });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => jumpBtn.addEventListener(ev, () => { jumpBtn.classList.remove('down'); overworld3d.keys[' '] = false; }));

        // talk: the 💬 button appears when a villager is next to you
        talkBtn.addEventListener('pointerdown', () => overworld3d.tryTalk());

        // show the controls only while you're actually playing (not in dialogue, menus, shops or cutscenes)
        setInterval(() => {
            const gs = window.gameSystem;
            const playing = !!(gs && overworld3d.playerObj && (gs.state === 'overworld' || gs.state === 'gauntlet' || gs.state === 'core' || gs.state === 'kite') && !gs.isCutscene);
            root.classList.toggle('mc-off', !playing);
            talkBtn.classList.toggle('show', playing && !!overworld3d.nearVillager);
            if (!playing && wasPlaying) releaseAll();
            wasPlaying = playing;
            if (playing && !showHint.done) showHint();
        }, 120);
    }

    function showHint() {
        showHint.done = true;
        let seen = false; try { seen = localStorage.getItem('gt-hint-seen') === '1'; localStorage.setItem('gt-hint-seen', '1'); } catch (e) {}
        if (seen) return;
        hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 9000);
    }

    // Fullscreen + landscape (Android: both; iPhone: use "Add to Home Screen" for fullscreen).
    function enterFullscreen() {
        try {
            const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
            if (req && !document.fullscreenElement && !document.webkitFullscreenElement) { const p = req.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
        } catch (e) {}
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    }

    // Settings switches ("Low Graphics", "Touch Controls") - they need a restart to take effect.
    function bindSwitches() {
        const pairs = [['lowgfx-toggle', 'gt-gfx', 'low', 'high', !!window.LOW_GFX], ['touch-toggle', 'gt-touch', 'on', 'off', !!window.IS_MOBILE]];
        pairs.forEach(([id, key, onVal, offVal, current]) => {
            ['', 'pause-'].forEach(prefix => {
                const box = document.getElementById(prefix + id); if (!box) return;
                box.checked = current;
                box.addEventListener('change', () => {
                    try { localStorage.setItem(key, box.checked ? onVal : offVal); } catch (e) {}
                    document.querySelectorAll('#' + id + ', #pause-' + id).forEach(b => { b.checked = box.checked; });
                    if (window.confirm('This change needs a restart. Restart the game now? (Your progress is saved first.)')) {
                        try { if (window.SaveGame) SaveGame.save(true); } catch (e) {}
                        location.reload();
                    }
                });
            });
        });
        const fs = document.getElementById('pause-fs-btn'); if (fs) fs.addEventListener('click', enterFullscreen);
    }

    // Let the game be installed like an app (works when it's hosted on the web; it also works offline once installed).
    function registerOffline() {
        if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }

    function init() {
        bindSwitches();
        registerOffline();
        if (!on) return;
        document.body.classList.add('is-mobile');
        // no browser gestures on top of the game (zoom, long-press menu, pull-to-refresh)
        document.addEventListener('contextmenu', e => e.preventDefault());
        ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
        document.addEventListener('dblclick', e => e.preventDefault());
        // going fullscreen needs a tap, so do it when the player starts the game
        document.addEventListener('pointerup', (e) => { if (e.target.closest && e.target.closest('#start-btn, #continue-btn, #cc-confirm-btn')) enterFullscreen(); }, true);
    }

    window.addEventListener('DOMContentLoaded', init);

    return { show() { if (!on) return; build(); root.classList.remove('hidden'); }, stick, enterFullscreen, get on() { return on; } };
})();
window.Mobile = Mobile;
