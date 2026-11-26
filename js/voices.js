// CHARACTER VOICES: the villagers, the guards, Barnico, Octa, Croton... all TALK out loud!
//
// This uses the speech voices that already live inside the browser / computer / Chromebook (no sound files needed).
// Every character gets their own voice: a different pitch, a different speed, and (when the device has several voices) a
// different voice. Oblongtalo rumbles, Octa squeaks, Cirro rattles along at top speed, Mahina yawns...
// The narrator ("System") stays silent, and so does the Flow Song. Turn it all off in Settings ("Character Voices").
// Voices follow the game's volume slider. Clicking to the next line cuts the voice off.
//
// To change a character: edit their line in PROFILES  (g = voice kind 'm' / 'f' / 'n', pitch 0..2, rate 0.5..2).
// To fix how a name is pronounced: edit SAY below (it only changes what is SPOKEN, never what is written on screen).
const Voices = (() => {
    const PROFILES = {
        barnico:    { g: 'm', pitch: 0.70, rate: 0.85 },   // a wise old elder
        octa:       { g: 'f', pitch: 1.90, rate: 1.20 },   // a squeaky, excited little octopus
        croton:     { g: 'm', pitch: 0.45, rate: 0.80 },   // a deep, rumbling king of crabs
        oblongtalo: { g: 'm', pitch: 0.35, rate: 0.70 },   // an ancient, echoing ghost
        graton:     { g: 'm', pitch: 0.40, rate: 0.80 },   // gravelly and grim
        wisp:       { g: 'f', pitch: 1.50, rate: 1.05 },   // a soft, kind cloud
        kekoa:      { g: 'm', pitch: 0.70, rate: 0.85 },   // the village elder
        lani:       { g: 'f', pitch: 1.60, rate: 1.10 },   // sings to the clouds
        hoku:       { g: 'm', pitch: 0.95, rate: 0.90 },   // a dreamy stargazer
        iolana:     { g: 'f', pitch: 1.25, rate: 1.20 },   // a bold kite pilot
        malie:      { g: 'f', pitch: 1.35, rate: 0.90 },   // a gentle gardener
        aheahe:     { g: 'f', pitch: 1.70, rate: 1.40 },   // a very, very fast messenger
        noelani:    { g: 'f', pitch: 1.30, rate: 0.80 },   // soft and whispery
        mahina:     { g: 'f', pitch: 0.90, rate: 0.78 },   // sleepy
        cashato:    { g: 'm', pitch: 1.10, rate: 1.15 },   // a jolly trader
        zephyr:     { g: 'm', pitch: 1.70, rate: 1.25 },   // a cloud-school kid (and bully)
        nimbus:     { g: 'n', pitch: 2.00, rate: 1.10 },   // a cat who talks
        stratus:    { g: 'm', pitch: 0.75, rate: 0.90 },   // the calm Sky Guard
        cirro:      { g: 'm', pitch: 1.35, rate: 1.45 },   // the quick Sky Guard
        shopkeeper: { g: 'm', pitch: 1.00, rate: 1.00 }
    };
    const SILENT = ['system', 'flow'];            // the narrator and the Flow Song do not talk
    // how names / words should be SPOKEN
    const SAY = [[/\bAheahe\b/gi, 'Ah-hay-ah-hay'], [/\bNoelani\b/gi, 'No-eh-lah-nee'], [/\bMahina\b/gi, 'Mah-hee-nah'], [/\bIolana\b/gi, 'Ee-oh-lah-nah'],
                 [/\bHoku\b/gi, 'Ho-koo'], [/\bKekoa\b/gi, 'Keh-ko-ah'], [/\bLani\b/gi, 'Lah-nee'], [/\bMalie\b/gi, 'Mah-lee-eh'], [/\bMakani\b/gi, 'Mah-kah-nee'],
                 [/\bCirro\b/gi, 'Seer-oh'], [/\bStratus\b/gi, 'Stray-tuss'], [/\bZephyr\b/gi, 'Zeff-er'], [/\bOblongtalo\b/gi, 'Ob-long-tah-low'],
                 [/\bCacto\b/gi, 'Cack-toe'], [/\bBarnico\b/gi, 'Bar-nee-ko'], [/\bCashato\b/gi, 'Cah-shah-toe'], [/\bGraton\b/gi, 'Gray-ton'],
                 [/\bMrr+ow\b/gi, 'Meow'], [/\bOcta\b/gi, 'Ock-tah']];
    const FEMALE = /(female|woman|zira|samantha|victoria|karen|susan|hazel|jenny|aria|sonia|moira|tessa|fiona|ava\b|allison|catherine|sara|emma|libby|natasha|clara|joanna|salli|kendra|kimberly|ivy|amy|nicole)/i;
    const MALE = /(\bmale\b|david|mark|daniel|alex\b|fred|george|\bguy\b|ryan|brian|james|oliver|thomas|ralph|matthew|joey|justin|liam|william|arthur|rishi|russell|kevin|eric)/i;

    let enabled = true, speakingNow = false, cache = null, mesh = null, baseY = 1, t = 0;
    const synth = () => window.speechSynthesis, ok = () => !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined';
    const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

    function englishVoices() {
        if (!ok()) return [];
        if (!cache || !cache.length) { try { cache = synth().getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) { cache = []; } }
        return cache;
    }
    function pickVoice(key, kind) {
        const all = englishVoices(); if (!all.length) return null;
        let pool = kind === 'f' ? all.filter(v => FEMALE.test(v.name)) : kind === 'm' ? all.filter(v => MALE.test(v.name) && !FEMALE.test(v.name)) : all;
        if (!pool.length) pool = all;
        return pool[hash(key) % pool.length];
    }
    function profileFor(speaker) {
        const tokens = String(speaker || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
        if (tokens.some(k => SILENT.includes(k))) return null;
        for (const k of tokens) if (PROFILES[k]) return { key: k, ...PROFILES[k] };
        return { key: tokens[0] || 'x', g: 'n', pitch: 1, rate: 1 };      // someone new: an ordinary voice
    }
    function clean(text) {
        let s = String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/[♪~*_#<>]/g, ' ').replace(/\s*\(([^)]*)\)/g, ', $1,').replace(/\.{3,}/g, ', ').replace(/\s+/g, ' ');
        s = s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');                 // no emoji
        SAY.forEach(([re, to]) => { s = s.replace(re, to); });
        s = s.replace(/([.!?]),/g, '$1').replace(/\s+,/g, ',').replace(/\s+/g, ' ');
        return s.trim();
    }
    function volume() {
        const v = window.settingsSystem ? Number(window.settingsSystem.volume) : 50;
        return Math.max(0, Math.min(1, (isNaN(v) ? 50 : v) / 100 * 1.3));
    }

    // who is talking, so that they can bob while they speak (villagers already nod on their own)
    function meshFor(key) {
        const o = window.overworld3d; if (!o || !o.entities) return null;
        if (key === 'wisp' || key === 'cashato' || o.entities.some(e => e.type === 'villager' && e.v && e.v.id === key)) return null;
        if (key === 'barnico') { const e = o.entities.find(x => x.storyId === 'barnico'); return e && e.mesh; }
        if (key === 'octa') return o.companionObj || (o.entities.find(x => x.storyId === 'octa_join') || {}).mesh;
        if (key === 'croton') { const e = o.entities.find(x => x.bossId === 'croton'); return e && e.mesh; }
        if (key === 'oblongtalo') return o.oblongtaloMesh;
        if (key === 'nimbus') { const e = o.entities.find(x => x.type === 'cat'); return e && e.mesh; }
        if (key === 'zephyr') { const e = o.entities.find(x => x.type === 'bully'); return e && e.mesh; }
        if (key === 'stratus' || key === 'cirro') { const e = o.entities.find(x => x.guard && x.name && x.name.toLowerCase() === key); return e && e.mesh; }
        return null;
    }
    function endBob() { if (mesh) { mesh.scale.y = baseY; mesh = null; } }

    // Speak one line. Returns true if the character is really going to be heard (the dialogue box then types more slowly, to keep up).
    function speak(speaker, text) {
        stop();
        if (!enabled || !ok()) return false;
        const p = profileFor(speaker); if (!p) return false;
        const line = clean(text); if (!line) return false;
        const vol = volume(); if (vol <= 0) return false;
        const u = new SpeechSynthesisUtterance(line);
        const v = pickVoice(p.key, p.g); if (v) u.voice = v;
        u.pitch = p.pitch; u.rate = p.rate; u.volume = vol;
        u.onstart = () => { speakingNow = true; };
        u.onend = u.onerror = () => { speakingNow = false; endBob(); };
        speakingNow = true;
        try { mesh = meshFor(p.key); if (mesh) baseY = mesh.scale.y; } catch (e) { mesh = null; }
        setTimeout(() => { try { synth().speak(u); } catch (e) { speakingNow = false; } }, 40);   // (a tiny pause lets the browser finish cancelling the last line)
        return true;
    }
    function stop() { if (ok()) { try { synth().cancel(); } catch (e) {} } speakingNow = false; endBob(); }

    function update(dt) {
        t += dt;
        if (mesh && speakingNow) mesh.scale.y = baseY * (1 + 0.045 * Math.abs(Math.sin(t * 13)));      // little talking bounce
    }

    function setEnabled(on, save = true) {
        enabled = !!on;
        if (!enabled) stop();
        if (save) { try { localStorage.setItem('gt-voices', enabled ? 'on' : 'off'); } catch (e) {} }
        document.querySelectorAll('#voices-toggle, #pause-voices-toggle').forEach(b => { b.checked = enabled; });
    }

    window.addEventListener('DOMContentLoaded', () => {
        let saved = null; try { saved = localStorage.getItem('gt-voices'); } catch (e) {}
        enabled = saved !== 'off';
        document.querySelectorAll('#voices-toggle, #pause-voices-toggle').forEach(b => {
            b.checked = enabled;
            b.addEventListener('change', () => setEnabled(b.checked));
        });
        if (ok()) { try { synth().onvoiceschanged = () => { cache = null; }; } catch (e) {} }
    });

    return { speak, stop, update, setEnabled, get enabled() { return enabled; }, set enabled(v) { enabled = !!v; if (!enabled) stop(); }, get speaking() { return speakingNow; }, get available() { return ok(); }, PROFILES, _profileFor: profileFor, _clean: clean, _pick: pickVoice };
})();
window.Voices = Voices;
