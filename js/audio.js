// Sound for The Glitching Tales. Every sound effect and every piece of background music is
// synthesised live with the Web Audio API, so the game needs no audio files.
// The one exception is the player's own "Flow Song": if a file called music/flow-song.mp3
// (or .ogg / .wav / .m4a) exists, that plays; otherwise a built-in tune stands in for it.
const Sound = (() => {
    let ctx = null, master = null, sfxBus = null, musicBus = null, reverb = null, ambGain = null, ambFilter = null;
    let noiseBuf = null;
    let volume = 0.5;                 // 0..1 (the settings slider)
    let mood = 'menu';                // what the world wants to hear
    let current = null;               // { name, node, nextBar, bar } - the music currently being scheduled
    let beacon = 0;                   // 0..1: how close the player is to the Flow Song creature
    const flow = { unlocked: false, on: false, fileOk: null, el: null };
    const lastPlayed = {};

    const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // ---------- setup ----------
    function ensure() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain(); master.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);

        // One second-and-a-half of noise, reused by every whoosh, footstep and drum.
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

        // A cheap hall reverb: decaying noise as an impulse response.
        const len = Math.floor(ctx.sampleRate * 2.2);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        const conv = ctx.createConvolver(); conv.buffer = ir;
        reverb = ctx.createGain(); reverb.gain.value = 0.8;
        reverb.connect(conv); conv.connect(master);

        // Always-on wind / water rumble under everything.
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'bandpass'; ambFilter.frequency.value = 500; ambFilter.Q.value = 0.5;
        ambGain = ctx.createGain(); ambGain.gain.value = 0.0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
        const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.02;
        lfo.connect(lfoAmt); lfoAmt.connect(ambGain.gain);
        src.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master);
        src.start(); lfo.start();

        applyVolume();
        setInterval(tick, 120);
        setInterval(beaconTick, 750);
        document.addEventListener('visibilitychange', () => {
            if (!ctx) return;
            if (document.hidden) ctx.suspend(); else ctx.resume();
        });
        return ctx;
    }

    // Browsers only allow sound after the player has clicked or pressed something.
    function unlock() {
        const c = ensure();
        if (c && c.state === 'suspended' && !document.hidden) c.resume();
        updateAmbience();
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
    // Every button makes a soft click.
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('button, .d-btn, .action-btn-mobile')) play('click');
    });

    function applyVolume() {
        if (master) master.gain.setTargetAtTime(1.2 * Math.pow(volume, 1.4), ctx.currentTime, 0.05);
        if (flow.el) flow.el.volume = Math.min(1, 0.9 * Math.pow(volume, 1.2));
    }

    // ---------- building blocks ----------
    function out(node, bus, send) {
        node.connect(bus);
        if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(reverb); }
    }

    function tone(o) {
        const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.2, a = o.attack || 0.005;
        const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t0);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        let last = g;
        if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); last = f; }
        out(last, o.bus || sfxBus, o.send || 0);
        osc.start(t0); osc.stop(t0 + dur + 0.05);
    }

    function noise(o) {
        const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.2, a = o.attack || 0.004;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 1;
        f.frequency.setValueAtTime(o.f || 1000, t0);
        if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g);
        out(g, o.bus || sfxBus, o.send || 0);
        src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
    }

    // A held note with a slow swell (pads and drones).
    function pad(freq, at, dur, vol, o = {}) {
        const t0 = ctx.currentTime + at;
        const g = ctx.createGain();
        const att = Math.min(dur * 0.45, o.attack || 1.2);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + att);
        g.gain.setValueAtTime(vol, t0 + Math.max(att, dur - 1.0));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp || 900;
        f.connect(g);
        [-6, 6].forEach(det => {
            const osc = ctx.createOscillator(); osc.type = o.type || 'triangle';
            osc.frequency.value = freq; osc.detune.value = det;
            osc.connect(f); osc.start(t0); osc.stop(t0 + dur + 0.1);
        });
        out(g, o.dest, o.send === undefined ? 0.5 : o.send);
    }

    // ---------- sound effects ----------
    const SFX = {
        click()   { tone({ f: 900, to: 650, dur: 0.06, type: 'square', vol: 0.05 }); },
        jump()    { tone({ f: 280, to: 640, dur: 0.17, vol: 0.13 }); },
        land()    { noise({ f: 500, to: 120, dur: 0.14, vol: 0.18 }); tone({ f: 90, to: 50, dur: 0.14, vol: 0.18 }); },
        splash()  { noise({ type: 'bandpass', f: 1200, to: 300, dur: 0.4, vol: 0.2, q: 0.7, send: 0.15 }); },
        swing()   { noise({ type: 'bandpass', f: 500, to: 2600, dur: 0.17, vol: 0.2, q: 0.9 }); },
        bow()     { tone({ f: 340, to: 190, dur: 0.12, type: 'sawtooth', vol: 0.08, lp: 1800 }); noise({ type: 'highpass', f: 3500, dur: 0.07, vol: 0.07 }); },
        spell()   { tone({ f: 500, to: 1500, dur: 0.32, vol: 0.12, send: 0.35 }); tone({ f: 760, to: 2100, dur: 0.28, at: 0.03, type: 'triangle', vol: 0.07, send: 0.35 }); },
        hit()     { noise({ f: 2000, to: 300, dur: 0.12, vol: 0.24 }); tone({ f: 190, to: 70, dur: 0.1, type: 'square', vol: 0.1, lp: 900 }); },
        hurt()    { tone({ f: 300, to: 110, dur: 0.24, type: 'sawtooth', vol: 0.15, lp: 1400 }); noise({ f: 900, to: 200, dur: 0.2, vol: 0.14 }); },
        kill()    { tone({ f: 420, to: 70, dur: 0.38, type: 'triangle', vol: 0.15 }); noise({ f: 1300, to: 150, dur: 0.38, vol: 0.14 });
                    tone({ f: 1100, to: 1700, dur: 0.18, at: 0.25, vol: 0.05, send: 0.3 }); },
        die()     { tone({ f: 320, to: 45, dur: 1.1, type: 'sawtooth', vol: 0.16, lp: 900, send: 0.3 }); noise({ f: 800, to: 80, dur: 0.9, vol: 0.12 }); },
        coin()    { tone({ f: 988, dur: 0.1, type: 'square', vol: 0.06, send: 0.2 }); tone({ f: 1319, dur: 0.32, at: 0.08, type: 'square', vol: 0.06, send: 0.3 }); },
        chest()   { [523, 659, 784, 1047].forEach((n, i) => tone({ f: n, dur: 0.3, at: i * 0.07, type: 'triangle', vol: 0.11, send: 0.35 })); },
        buy()     { tone({ f: 740, dur: 0.1, type: 'square', vol: 0.06 }); tone({ f: 1109, dur: 0.25, at: 0.08, type: 'square', vol: 0.06, send: 0.25 }); },
        error()   { tone({ f: 200, dur: 0.12, type: 'square', vol: 0.07 }); tone({ f: 160, dur: 0.16, at: 0.13, type: 'square', vol: 0.07 }); },
        gate()    { noise({ f: 200, to: 90, dur: 1.5, vol: 0.4, attack: 0.15 }); tone({ f: 58, to: 38, dur: 1.6, vol: 0.3, attack: 0.1 });
                    noise({ type: 'bandpass', f: 420, to: 220, dur: 1.3, vol: 0.14, q: 3, attack: 0.1 }); },
        windup()  { noise({ type: 'bandpass', f: 800, to: 1700, dur: 0.38, vol: 0.09, q: 2 }); tone({ f: 190, to: 330, dur: 0.38, type: 'sawtooth', vol: 0.05, lp: 1200 }); },
        roar()    { tone({ f: 95, to: 52, dur: 0.85, type: 'sawtooth', vol: 0.2, lp: 700, send: 0.3 }); noise({ f: 700, to: 150, dur: 0.8, vol: 0.2, send: 0.2 }); },
        slam()    { noise({ f: 1000, to: 70, dur: 0.55, vol: 0.4, send: 0.2 }); tone({ f: 85, to: 28, dur: 0.55, vol: 0.4 }); },
        charge()  { noise({ type: 'bandpass', f: 250, to: 1800, dur: 0.7, vol: 0.14, q: 1.2, send: 0.3 }); tone({ f: 120, to: 340, dur: 0.7, type: 'sawtooth', vol: 0.04, lp: 800, send: 0.3 }); },
        levelup() { [523, 659, 784, 1047, 1319].forEach((n, i) => { tone({ f: n, dur: 0.45, at: i * 0.09, vol: 0.1, send: 0.4 }); tone({ f: n * 2, dur: 0.3, at: i * 0.09, type: 'triangle', vol: 0.04, send: 0.4 }); }); },
        fanfare() { [[523, 659, 784], [587, 740, 880], [659, 831, 988], [784, 988, 1175, 1568]].forEach((ch, i) => ch.forEach(n => tone({ f: n, dur: i === 3 ? 1.6 : 0.5, at: i * 0.4, type: 'triangle', vol: 0.08, send: 0.45 }))); },
        zapup()   { tone({ f: 300, to: 1800, dur: 0.7, type: 'sawtooth', vol: 0.06, lp: 2500, send: 0.2 }); noise({ type: 'highpass', f: 5000, dur: 0.6, vol: 0.05, attack: 0.3 }); },
        zap()     { noise({ type: 'highpass', f: 2500, dur: 0.35, vol: 0.28, send: 0.2 }); tone({ f: 1500, to: 120, dur: 0.3, type: 'square', vol: 0.1, lp: 3000 });
                    [0.05, 0.11, 0.18].forEach(a => tone({ f: 900 + Math.random() * 1400, to: 200, dur: 0.07, at: a, type: 'sawtooth', vol: 0.07 })); },
        flame()   { noise({ type: 'bandpass', f: 900, to: 3200, dur: 0.45, vol: 0.2, q: 0.8, send: 0.15 }); tone({ f: 220, to: 520, dur: 0.4, type: 'sawtooth', vol: 0.05, lp: 1400 }); },
        hiss()    { noise({ type: 'highpass', f: 4200, dur: 0.6, vol: 0.12, attack: 0.15, send: 0.1 }); noise({ type: 'bandpass', f: 6000, dur: 0.5, vol: 0.06, q: 2, attack: 0.2 }); },
        venom()   { noise({ type: 'bandpass', f: 1400, to: 500, dur: 0.3, vol: 0.2, q: 1.5 }); tone({ f: 420, to: 160, dur: 0.28, vol: 0.09, type: 'triangle' }); },
        splat()   { noise({ type: 'lowpass', f: 900, to: 200, dur: 0.22, vol: 0.2 }); tone({ f: 200, to: 70, dur: 0.15, vol: 0.1 }); },
        needle()  { tone({ f: 1800, to: 700, dur: 0.14, type: 'triangle', vol: 0.08 }); noise({ type: 'highpass', f: 5000, dur: 0.1, vol: 0.08 }); },
        suck()    { noise({ type: 'bandpass', f: 3000, to: 200, dur: 1.0, vol: 0.2, q: 1.5, attack: 0.5, send: 0.2 }); tone({ f: 600, to: 60, dur: 1.1, type: 'sawtooth', vol: 0.07, lp: 1200, send: 0.3 }); },
        portal()  { tone({ f: 300, to: 1100, dur: 0.6, type: 'triangle', vol: 0.08, send: 0.5 }); tone({ f: 450, to: 1600, dur: 0.5, at: 0.1, vol: 0.05, send: 0.5 }); noise({ type: 'highpass', f: 4500, dur: 0.5, vol: 0.05, attack: 0.2 }); },
        boat()    { noise({ f: 400, to: 250, dur: 1.2, vol: 0.08, attack: 0.4 }); tone({ f: 110, to: 95, dur: 1.2, vol: 0.06, attack: 0.3 }); },
        song()    { [659, 784, 988, 1175, 1319, 1568, 1976].forEach((n, i) => tone({ f: n, dur: 0.5, at: i * 0.08, vol: 0.09, send: 0.5 })); },
        save()    { tone({ f: 660, dur: 0.12, type: 'triangle', vol: 0.08, send: 0.25 }); tone({ f: 990, dur: 0.3, at: 0.1, type: 'triangle', vol: 0.08, send: 0.3 }); },
    };
    const MIN_GAP = { hit: 0.05, click: 0.04, windup: 0.15, kill: 0.08, hurt: 0.15, coin: 0.05 }; // stop a sound piling up on itself

    function play(name) {
        if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
        const now = ctx.currentTime;
        if (lastPlayed[name] !== undefined && now - lastPlayed[name] < (MIN_GAP[name] || 0.02)) return;
        lastPlayed[name] = now;
        SFX[name]();
    }

    function step(surface) {
        if (!ctx || ctx.state !== 'running') return;
        const r = 0.85 + Math.random() * 0.3;
        if (surface === 'stone') { noise({ type: 'bandpass', f: 1800 * r, dur: 0.05, vol: 0.07, q: 3 }); tone({ f: 150 * r, to: 90, dur: 0.07, vol: 0.06 }); }
        else if (surface === 'water') noise({ type: 'bandpass', f: 700 * r, to: 350, dur: 0.18, vol: 0.09, q: 0.6, send: 0.1 });
        else if (surface === 'sand') noise({ type: 'lowpass', f: 600 * r, to: 300, dur: 0.1, vol: 0.06 });
        else noise({ type: 'bandpass', f: 900 * r, to: 450, dur: 0.08, vol: 0.06, q: 0.8 }); // grass
    }

    // The little "talking" ticks while a character speaks. Each speaker has their own voice pitch.
    function blip(speaker, i) {
        if (!ctx || ctx.state !== 'running' || i % 2) return;
        let h = 0; for (let k = 0; k < (speaker || '').length; k++) h = (h * 31 + speaker.charCodeAt(k)) % 97;
        const base = 200 + h * 4;
        tone({ f: base * (1 + Math.random() * 0.25), dur: 0.05, type: speaker === 'System' ? 'sine' : 'square', vol: 0.035, lp: 1500 });
    }

    // ---------- music ----------
    const MOODS = {
        menu:    { bpm: 72,  root: 57, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], mel: 0.38, pluck: 'triangle', padLp: 800 },
        village: { bpm: 96,  root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], mel: 0.55, pluck: 'triangle', padLp: 1000, bounce: true },
        wild:    { bpm: 80,  root: 62, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [-3, 0, 4], [-7, -3, 0, 4], [-5, -1, 2]], mel: 0.34, pluck: 'sine', padLp: 900 },
        temple:  { bpm: 56,  root: 45, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], mel: 0.2, pluck: 'sine', padLp: 520, drone: true, thump: true, padType: 'sawtooth' },
        boss:    { bpm: 132, root: 45, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], mel: 0.62, pluck: 'square', padLp: 700, drums: true, padType: 'sawtooth' },
        gauntlet:{ bpm: 144, root: 50, scale: [0, 3, 5, 6, 7, 10], prog: [[0, 3, 7], [-2, 1, 5], [-4, 0, 3], [-5, -1, 2]], mel: 0.5, pluck: 'sawtooth', padLp: 650, drums: true, padType: 'sawtooth' },
        ocean:   { bpm: 48,  root: 50, scale: [0, 3, 5, 7, 10], prog: [[0, 7, 15], [-4, 3, 8], [-2, 5, 10], [0, 7, 14]], mel: 0.16, pluck: 'bell', padLp: 450, drone: true },
        sea:     { bpm: 74,  root: 55, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]], mel: 0.42, pluck: 'triangle', padLp: 900 },
        reef:    { bpm: 92,  root: 62, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [-5, -1, 2, 6], [-3, 0, 4, 7], [-7, -3, 0, 4]], mel: 0.5, pluck: 'bell', padLp: 800, drone: true },
        core:    { bpm: 138, root: 43, scale: [0, 2, 3, 7, 8, 10], prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-7, -4, 0]], mel: 0.6, pluck: 'sawtooth', padLp: 600, drums: true, padType: 'sawtooth', drone: true },
        dunes:   { bpm: 84,  root: 57, scale: [0, 1, 4, 5, 7, 8, 10], prog: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 2, 5]], mel: 0.36, pluck: 'triangle', padLp: 700, drone: true, thump: false },
        sky:     { bpm: 88,  root: 65, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [5, 9, 12], [7, 11, 14], [4, 7, 11]], mel: 0.5, pluck: 'bell', padLp: 1500, arp: true },
        flow:    { bpm: 104, root: 64, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [-8, -4, -1], [-5, -1, 2]], mel: 0.7, pluck: 'sine', padLp: 1200, arp: true },
    };

    function pluck(freq, at, dur, vol, kind, dest) {
        if (kind === 'bell') {
            tone({ f: freq, dur: dur * 1.8, at, vol, bus: dest, send: 0.7 });
            tone({ f: freq * 2.76, dur: dur * 0.9, at, vol: vol * 0.35, bus: dest, send: 0.7 });
        } else {
            tone({ f: freq, dur, at, type: kind, vol, bus: dest, send: 0.45, lp: kind === 'sine' ? 0 : 2400, attack: 0.008 });
        }
    }

    function scheduleBar(m, at, bar, dest) {
        const beat = 60 / m.bpm, chord = m.prog[bar % m.prog.length];
        const barLen = beat * 4;
        const rel = at - ctx.currentTime;
        // Pad chord (one octave down so it sits underneath the tune)
        chord.forEach(c => pad(mf(m.root + c - 12), rel, barLen + 0.8, m.drums ? 0.05 : 0.07, { dest, lp: m.padLp, type: m.padType || 'triangle', attack: m.drums ? 0.1 : 1.3 }));
        // Bass
        const bassT = m.drums ? 'sawtooth' : 'sine';
        if (m.drums) { for (let i = 0; i < 8; i++) tone({ f: mf(m.root + chord[0] - 24), dur: beat * 0.45, at: rel + i * beat * 0.5, type: bassT, vol: 0.09, bus: dest, lp: 500 }); }
        else tone({ f: mf(m.root + chord[0] - 24), dur: barLen * 0.9, at: rel, type: bassT, vol: 0.14, bus: dest, attack: 0.04 });
        if (m.drone) pad(mf(m.root - 24), rel, barLen + 1.5, 0.09, { dest, lp: 260, type: 'sine', attack: 2 });
        if (m.thump) tone({ f: 62, to: 38, dur: 0.5, at: rel, vol: 0.25, bus: dest });
        // Drums
        if (m.drums) {
            for (let i = 0; i < 8; i++) {
                const t = rel + i * beat * 0.5;
                noise({ type: 'highpass', f: 7000, dur: 0.04, at: t, vol: i % 2 ? 0.04 : 0.025, bus: dest });
                if (i === 0 || i === 4 || i === 5) tone({ f: 130, to: 42, dur: 0.18, at: t, vol: 0.3, bus: dest });
                if (i === 2 || i === 6) noise({ type: 'bandpass', f: 1800, dur: 0.14, at: t, vol: 0.16, q: 0.8, bus: dest });
            }
        }
        // Tune: random notes from the scale, nudged toward chord tones on the strong beats.
        const steps = m.arp ? 8 : 8;
        let prev = -1;
        for (let i = 0; i < steps; i++) {
            if (!m.arp && Math.random() > m.mel * (i % 2 === 0 ? 1.2 : 0.7)) continue;
            let semis;
            if (m.arp) semis = chord[(i % chord.length)] + (Math.floor(i / chord.length) % 2 ? 12 : 0);
            else if (i % 4 === 0 && Math.random() < 0.6) semis = pick(chord) + 12;
            else { semis = pick(m.scale) + 12 * pick([0, 1, 1]); if (semis === prev) semis += 2; }
            prev = semis;
            const note = mf(m.root + semis + (m.arp ? 12 : 0));
            pluck(note, rel + i * beat * 0.5 + (m.bounce && i % 2 ? beat * 0.06 : 0), beat * (m.arp ? 0.9 : 1.1), m.arp ? 0.07 : 0.085, m.pluck, dest);
        }
        if (m.arp && bar % 2 === 1) { // the Flow Song's little flourish
            [0, 2, 4, 7, 4].forEach((s, i) => pluck(mf(m.root + 24 + s), rel + beat * (2 + i * 0.4), beat * 0.9, 0.06, 'triangle', dest));
        }
        return barLen;
    }

    function wantedMusic() {
        if (flow.on && flow.unlocked) return flow.fileOk ? null : 'flow'; // a real file plays by itself
        return mood;
    }

    function tick() {
        if (!ctx || ctx.state !== 'running') return;
        const want = wantedMusic();
        if (!current || current.name !== want) {
            if (current) { // fade the old music out and let it go
                const old = current.node;
                old.gain.cancelScheduledValues(ctx.currentTime);
                old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
                old.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.4);
                setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 3500);
            }
            current = null;
            if (want && MOODS[want]) {
                const node = ctx.createGain(); node.gain.setValueAtTime(0, ctx.currentTime);
                node.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.6);
                node.connect(musicBus);
                current = { name: want, node, nextBar: ctx.currentTime + 0.1, bar: 0 };
            }
        }
        if (!current) return;
        const m = MOODS[current.name];
        while (current.nextBar < ctx.currentTime + 0.5) {
            current.nextBar += scheduleBar(m, current.nextBar, current.bar++, current.node);
        }
    }

    // Faint sparkling notes that get louder as you near the Flow Song creature.
    function beaconTick() {
        if (!ctx || ctx.state !== 'running' || beacon < 0.04 || (flow.on && flow.unlocked)) return;
        const n = mf(88 + pick([0, 2, 4, 7, 9, 12, 14]));
        tone({ f: n, dur: 0.9, vol: 0.1 * beacon, bus: musicBus, send: 0.9 });
        if (Math.random() < 0.5) tone({ f: n * 1.5, dur: 0.7, at: 0.12, vol: 0.06 * beacon, bus: musicBus, send: 0.9 });
    }

    // Wind over the meadows, hollow rumble in the temple, deep water in the ocean.
    function updateAmbience() {
        if (!ctx || !ambGain) return;
        const t = ctx.currentTime;
        let f = 600, v = 0.05, q = 0.4;
        if (mood === 'ocean') { f = 180; v = 0.14; q = 0.8; }
        else if (mood === 'reef') { f = 320; v = 0.1; q = 0.7; }
        else if (mood === 'core') { f = 120; v = 0.08; q = 0.9; }
        else if (mood === 'dunes') { f = 900; v = 0.12; q = 0.35; }   // hot wind across open sand
        else if (mood === 'sky') { f = 1100; v = 0.1; q = 0.3; }   // high, clean wind above the clouds
        else if (mood === 'sea') { f = 450; v = 0.09; q = 0.5; }
        else if (mood === 'temple' || mood === 'boss') { f = 260; v = 0.05; q = 1; }
        else if (mood === 'gauntlet') { f = 150; v = 0.1; }
        else if (mood === 'menu') { v = 0.02; }
        ambFilter.frequency.setTargetAtTime(f, t, 1.2);
        ambFilter.Q.setTargetAtTime(q, t, 1.2);
        ambGain.gain.setTargetAtTime(v, t, 1.5);
    }

    // ---------- Flow Song (the player's own music) ----------
    function initFile() {
        if (flow.el) return;
        const el = document.createElement('audio');
        el.loop = true; el.preload = 'auto';
        const exts = ['mp3', 'ogg', 'wav', 'm4a'];
        exts.forEach(ext => { const s = document.createElement('source'); s.src = 'music/flow-song.' + ext; el.appendChild(s); });
        el.lastChild.addEventListener('error', () => { flow.fileOk = false; });
        el.addEventListener('canplay', () => { flow.fileOk = true; syncFlowFile(); });
        flow.el = el;
        applyVolume();
        try { el.load(); } catch (e) { flow.fileOk = false; }
    }
    function syncFlowFile() {
        if (!flow.el) return;
        if (flow.on && flow.unlocked && flow.fileOk) { const p = flow.el.play(); if (p && p.catch) p.catch(() => {}); }
        else flow.el.pause();
    }
    window.addEventListener('load', initFile);

    // ---------- public API ----------
    return {
        play, step, blip,
        unlock,
        setVolume(v) { volume = Math.max(0, Math.min(1, v / 100)); applyVolume(); },
        setMood(m) { if (m && m !== mood) { mood = m; updateAmbience(); } },
        setBeacon(b) { beacon = Math.max(0, Math.min(1, b)); },
        get flowUnlocked() { return flow.unlocked; },
        get flowOn() { return flow.on; },
        unlockFlow(autoPlay = true) { flow.unlocked = true; if (autoPlay) this.setFlow(true); },
        setFlow(on) { flow.on = !!on; syncFlowFile(); },
        get hasFlowFile() { return !!flow.fileOk; },
        get status() { return { ctx: ctx ? ctx.state : 'none', mood, music: current ? current.name : null, flow: { ...flow, el: !!flow.el } }; },
    };
})();
window.Sound = Sound;
