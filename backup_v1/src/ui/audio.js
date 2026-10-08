(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // Persistence (guarded: localStorage may be missing, blocked or throw)
  // ---------------------------------------------------------------------------
  const LS_VOL = 'duskspire_volume';
  const LS_MUTE = 'duskspire_muted';
  const LS_MUSIC = 'duskspire_music';

  function lsGet(key) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, val) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return;
      localStorage.setItem(key, String(val));
    } catch (e) { /* ignore */ }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  let volume = 0.7;
  let muted = false;
  let musicOn = true;
  try {
    const sv = lsGet(LS_VOL);
    if (sv !== null && sv !== '' && !isNaN(parseFloat(sv))) volume = clamp(parseFloat(sv), 0, 1);
    muted = lsGet(LS_MUTE) === '1';
    musicOn = lsGet(LS_MUSIC) !== '0';
  } catch (e) { /* keep defaults */ }

  // ---------------------------------------------------------------------------
  // Audio graph state (created lazily on first user gesture)
  // ---------------------------------------------------------------------------
  const Ctor = (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;

  let ctx = null;
  let master = null;      // master volume (mute lives here)
  let sfxBus = null;      // all sound effects
  let musicBus = null;    // ambient music
  let verbSend = null;    // shared reverb send
  let arpBus = null;      // arpeggio notes (feeds delay + music bus)
  let noiseBuf = null;    // one second of white noise, reused
  let gestureSeen = false;
  let failed = false;

  let musicTimer = null;
  let musicStart = 0;     // ctx time of chord 0
  let nextChordK = 0;
  let nextArpT = 0;

  const MUSIC_LEVEL = 0.8;  // music bus level, relative to master
  const BAR = 7.0;          // seconds per chord
  // Dark i - VI - III - v progression in A minor (MIDI note numbers)
  const PROG = [
    { bass: 45, tones: [57, 60, 64, 69] },   // Am   (A2 bass; A3 C4 E4 A4)
    { bass: 41, tones: [53, 57, 60, 65] },   // F    (F2 bass; F3 A3 C4 F4)
    { bass: 36, tones: [48, 52, 55, 59] },   // C    (C2 bass; C3 E3 G3 B3)
    { bass: 40, tones: [52, 55, 59, 64] },   // Em   (E2 bass; E3 G3 B3 E4)
  ];

  // Per-sound minimum gap in ms, so rapid-fire events do not stack into mush
  const THROTTLE = { hit: 45, draw: 55, tick: 70, click: 35, select: 35, shuffle: 250, add_card: 60, buff: 60, debuff: 60, block: 60, heal: 80, gold: 60 };
  const lastPlayed = {};

  function makeIR(c, secs, decay) {
    const rate = c.sampleRate;
    const len = Math.max(1, Math.floor(rate * secs));
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function makeNoise(c) {
    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function applyVolume() {
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const target = muted ? 0 : volume;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(target, t, 0.04);
    } catch (e) { /* ignore */ }
  }

  function applyMusic() {
    if (!ctx || !musicBus) return;
    try {
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setTargetAtTime(musicOn ? MUSIC_LEVEL : 0, t, musicOn ? 0.8 : 0.4);
    } catch (e) { /* ignore */ }
  }

  function build() {
    ctx = new Ctor();
    noiseBuf = makeNoise(ctx);

    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);

    // Shared small reverb: sfx and music both send into it
    const conv = ctx.createConvolver();
    conv.buffer = makeIR(ctx, 2.4, 2.8);
    verbSend = ctx.createGain();
    verbSend.gain.value = 0.22;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.8;
    sfxBus.connect(verbSend);
    musicBus.connect(verbSend);
    verbSend.connect(conv);
    conv.connect(verbOut);
    verbOut.connect(master);

    // Arpeggio path: arp -> musicBus, plus a soft feedback delay
    arpBus = ctx.createGain();
    arpBus.gain.value = 0.9;
    arpBus.connect(musicBus);
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.46;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    arpBus.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(wet);
    wet.connect(musicBus);

    applyVolume();
    applyMusic();
    if (musicOn) startMusic();
  }

  function ensureCtx() {
    if (failed) return null;
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          const p = ctx.resume();
          if (p && p.catch) p.catch(() => {});
        } catch (e) { /* ignore */ }
      }
      return ctx;
    }
    if (!Ctor || !gestureSeen) return null;
    try {
      build();
    } catch (e) {
      failed = true;
      ctx = null;
    }
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // Synthesis primitives
  // ---------------------------------------------------------------------------
  // Peak volume `peak` reached after `attack`, then exponential decay to silence at t+dur
  function env(g, t, peak, attack, dur) {
    const p = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(p, t + Math.max(0.001, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  }

  // o: {t, f, f2?, dur, vol, type?, attack?, detune?, filt?: {type, f, f2?, q?}, bus?}
  function tone(o) {
    const c = ctx;
    const t = o.t;
    const dur = o.dur;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    env(g, t, o.vol, o.attack || 0.005, dur);
    let last = osc;
    if (o.filt) {
      const bq = c.createBiquadFilter();
      bq.type = o.filt.type || 'lowpass';
      bq.frequency.setValueAtTime(o.filt.f, t);
      if (o.filt.f2) bq.frequency.exponentialRampToValueAtTime(o.filt.f2, t + dur);
      bq.Q.value = o.filt.q || 0.7;
      osc.connect(bq);
      last = bq;
    }
    last.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  // o: {t, dur, vol, type?, f?, f2?, q?, attack?, bus?}
  function noise(o) {
    const c = ctx;
    const t = o.t;
    const dur = o.dur;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bq = c.createBiquadFilter();
    bq.type = o.type || 'bandpass';
    bq.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    bq.Q.value = o.q || 1;
    const g = c.createGain();
    env(g, t, o.vol, o.attack || 0.003, dur);
    src.connect(bq);
    bq.connect(g);
    g.connect(o.bus || sfxBus);
    // Start somewhere in the buffer so that offset + dur stays inside the 1 s noise loop
    src.start(t, Math.random() * Math.max(0, 0.95 - dur));
    src.stop(t + dur + 0.06);
  }

  // ---------------------------------------------------------------------------
  // Sound bank. Each entry is (startTime, arg) => schedules nodes.
  // ---------------------------------------------------------------------------
  const SOUNDS = {
    // Card play, by type
    card_attack(t) {
      noise({ t, dur: 0.14, vol: 0.22, type: 'bandpass', f: 2600, f2: 500, q: 1.2, attack: 0.01 });
      tone({ t, f: 480, f2: 200, dur: 0.12, vol: 0.10, type: 'triangle' });
    },
    card_skill(t) {
      tone({ t, f: 660, dur: 0.3, vol: 0.10, type: 'sine' });
      tone({ t: t + 0.04, f: 990, dur: 0.3, vol: 0.06, type: 'sine' });
    },
    card_power(t) {
      [330, 440, 554, 660].forEach((f, i) => tone({ t: t + i * 0.05, f, dur: 0.55, vol: 0.09, type: 'triangle', attack: 0.01 }));
      noise({ t, dur: 0.25, vol: 0.05, type: 'highpass', f: 4000, f2: 7000, q: 0.5 });
    },
    card_curse(t) {
      tone({ t, f: 110, f2: 82, dur: 0.5, vol: 0.18, type: 'sawtooth', filt: { type: 'lowpass', f: 500, f2: 200 } });
      tone({ t: t + 0.02, f: 155.6, f2: 120, dur: 0.5, vol: 0.07, type: 'square', filt: { type: 'lowpass', f: 600 } });
    },
    card_status(t) {
      tone({ t, f: 140, f2: 55, dur: 0.22, vol: 0.25, type: 'sine' });
      noise({ t, dur: 0.12, vol: 0.12, type: 'lowpass', f: 900, f2: 200, q: 0.5 });
    },

    // Combat damage, weight scales with the hit
    hit(t, dmg) {
      const d = clamp(Number(dmg) || 0, 1, 60);
      const k = clamp(d / 25, 0.15, 1.6);
      const base = clamp(260 - d * 2.5, 60, 240);
      const dur = 0.12 + clamp(d * 0.004, 0, 0.18);
      tone({ t, f: base, f2: base * 0.45, dur, vol: clamp(0.18 + k * 0.22, 0.18, 0.5), type: 'sine', attack: 0.002 });
      noise({ t, dur: 0.06, vol: clamp(0.12 + k * 0.18, 0.12, 0.35), type: 'highpass', f: 1400 + (60 - d) * 10, q: 0.8, attack: 0.001 });
      if (d >= 12) tone({ t, f: 70, f2: 35, dur: 0.35, vol: 0.40, type: 'sine', attack: 0.002 });
      if (d >= 20) noise({ t, dur: 0.25, vol: 0.20, type: 'lowpass', f: 700, f2: 150, q: 0.6, attack: 0.002 });
    },
    hit_blocked(t) {
      tone({ t, f: 1250, dur: 0.22, vol: 0.09, type: 'triangle' });
      tone({ t: t + 0.005, f: 1880, dur: 0.16, vol: 0.06, type: 'sine' });
      noise({ t, dur: 0.05, vol: 0.16, type: 'highpass', f: 3000, q: 0.7 });
    },
    block(t) {
      tone({ t, f: 300, f2: 900, dur: 0.22, vol: 0.12, type: 'triangle', attack: 0.04 });
      noise({ t, dur: 0.22, vol: 0.10, type: 'bandpass', f: 800, f2: 2400, q: 1.5, attack: 0.05 });
      tone({ t: t + 0.2, f: 1320, dur: 0.35, vol: 0.07, type: 'sine' });
    },

    // Statuses
    buff(t) {
      tone({ t, f: 440, f2: 880, dur: 0.35, vol: 0.10, type: 'triangle', attack: 0.02 });
      tone({ t: t + 0.15, f: 1320, dur: 0.3, vol: 0.06, type: 'sine' });
    },
    debuff(t) {
      tone({ t, f: 520, f2: 170, dur: 0.42, vol: 0.10, type: 'sawtooth', filt: { type: 'lowpass', f: 1400, f2: 300 } });
    },
    unstatus(t) {
      tone({ t, f: 660, f2: 440, dur: 0.2, vol: 0.08, type: 'sine' });
    },
    // Damage over time. arg: 'burn' for crackle, anything else for poison bubbles
    tick(t, kind) {
      if (kind === 'burn') {
        noise({ t, dur: 0.09, vol: 0.14, type: 'bandpass', f: 1800, f2: 600, q: 0.8 });
        tone({ t, f: 200, f2: 120, dur: 0.10, vol: 0.10, type: 'triangle' });
      } else {
        tone({ t, f: 420, f2: 260, dur: 0.14, vol: 0.12, type: 'sine' });
        tone({ t: t + 0.05, f: 620, f2: 380, dur: 0.10, vol: 0.06, type: 'sine' });
      }
    },
    heal(t) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ t: t + i * 0.07, f, dur: 0.4, vol: 0.09, type: 'triangle', attack: 0.01 }));
    },
    gold(t) {
      tone({ t, f: 1760, dur: 0.12, vol: 0.10, type: 'triangle' });
      tone({ t: t + 0.06, f: 2637, dur: 0.40, vol: 0.09, type: 'triangle' });
      tone({ t: t + 0.06, f: 3520, dur: 0.25, vol: 0.03, type: 'sine' });
    },
    spend(t) {
      tone({ t, f: 900, f2: 560, dur: 0.14, vol: 0.09, type: 'triangle' });
      noise({ t, dur: 0.05, vol: 0.06, type: 'highpass', f: 3000, q: 0.6 });
    },

    // Enemy and deck flow
    enemy_death(t) {
      tone({ t, f: 160, f2: 38, dur: 0.6, vol: 0.32, type: 'sine', attack: 0.003 });
      noise({ t, dur: 0.7, vol: 0.18, type: 'lowpass', f: 1600, f2: 180, q: 0.7, attack: 0.01 });
      tone({ t: t + 0.12, f: 330, f2: 90, dur: 0.4, vol: 0.06, type: 'sawtooth', filt: { type: 'lowpass', f: 900, f2: 200 } });
    },
    shuffle(t) {
      for (let i = 0; i < 9; i++) {
        noise({ t: t + i * 0.035 + Math.random() * 0.01, dur: 0.035, vol: 0.10, type: 'bandpass', f: 2200 + Math.random() * 1600, q: 2 });
      }
    },
    draw(t) {
      noise({ t, dur: 0.14, vol: 0.12, type: 'bandpass', f: 1200, f2: 3200, q: 1.1, attack: 0.03 });
    },
    add_card(t) {
      tone({ t, f: 880, dur: 0.18, vol: 0.08, type: 'sine' });
      tone({ t: t + 0.06, f: 1320, dur: 0.25, vol: 0.06, type: 'sine' });
    },
    exhaust(t) {
      tone({ t, f: 1400, f2: 260, dur: 0.5, vol: 0.07, type: 'sine' });
      noise({ t, dur: 0.4, vol: 0.06, type: 'highpass', f: 3000, f2: 6000, q: 0.5, attack: 0.05 });
    },
    turn_start(t) {
      tone({ t, f: 293.66, dur: 1.2, vol: 0.09, type: 'sine', attack: 0.01 });
      tone({ t, f: 440, dur: 1.0, vol: 0.05, type: 'sine', attack: 0.02 });
      tone({ t, f: 587.33, dur: 0.8, vol: 0.02, type: 'sine', attack: 0.03 });
    },
    combat_start(t) {
      tone({ t, f: 90, f2: 42, dur: 0.35, vol: 0.35, type: 'sine', attack: 0.003 });
      noise({ t, dur: 0.12, vol: 0.15, type: 'lowpass', f: 500, f2: 120, q: 0.6, attack: 0.002 });
      tone({ t: t + 0.22, f: 100, f2: 45, dur: 0.3, vol: 0.25, type: 'sine', attack: 0.003 });
      noise({ t: t + 0.22, dur: 0.1, vol: 0.12, type: 'lowpass', f: 500, f2: 120, q: 0.6, attack: 0.002 });
    },
    // Boss-style fanfare (also callable directly by UI)
    victory(t) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone({ t: t + i * 0.16, f, dur: 0.3, vol: 0.12, type: 'triangle', attack: 0.005 });
        tone({ t: t + i * 0.16, f: f * 2, dur: 0.25, vol: 0.03, type: 'sine' });
      });
      const c = t + 0.66;
      notes.forEach((f) => tone({ t: c, f, dur: 1.6, vol: 0.08, type: 'triangle', attack: 0.02 }));
      noise({ t: c, dur: 0.5, vol: 0.04, type: 'highpass', f: 5000, q: 0.5 });
    },
    // Short win chime for ordinary fights
    win(t) {
      [659.25, 783.99, 987.77].forEach((f, i) => tone({ t: t + i * 0.09, f, dur: 0.3, vol: 0.09, type: 'triangle', attack: 0.005 }));
    },
    defeat(t) {
      const notes = [220, 174.61, 155.56, 146.83];
      notes.forEach((f, i) => tone({
        t: t + i * 0.38, f, dur: 0.9, vol: 0.13, type: 'sawtooth', attack: 0.02,
        filt: { type: 'lowpass', f: 800, f2: 250 },
      }));
      tone({ t: t + 1.6, f: 73.42, dur: 1.6, vol: 0.14, type: 'sine', attack: 0.02 });
    },

    // UI
    click(t) {
      tone({ t, f: 1800, dur: 0.03, vol: 0.04, type: 'square', filt: { type: 'lowpass', f: 3000 } });
    },
    select(t) {
      tone({ t, f: 900, f2: 1100, dur: 0.05, vol: 0.05, type: 'sine' });
    },
    error(t) {
      tone({ t, f: 150, dur: 0.15, vol: 0.08, type: 'square', filt: { type: 'lowpass', f: 600 } });
    },
    potion(t) {
      tone({ t, f: 300, f2: 900, dur: 0.3, vol: 0.10, type: 'sine', attack: 0.01 });
      for (let i = 0; i < 5; i++) {
        const f = 500 + Math.random() * 500;
        tone({ t: t + 0.1 + i * 0.05, f, f2: f * 1.4, dur: 0.08, vol: 0.06, type: 'sine' });
      }
    },
    relic(t) {
      [880, 1320, 1760].forEach((f, i) => tone({ t: t + i * 0.07, f, dur: 0.6, vol: 0.08, type: 'sine', attack: 0.005 }));
    },
    reward(t) {
      [523.25, 659.25, 783.99].forEach((f, i) => tone({ t: t + i * 0.08, f, dur: 0.4, vol: 0.09, type: 'triangle' }));
    },
  };

  // ---------------------------------------------------------------------------
  // Public play() with lazy context and throttling. Never throws.
  // ---------------------------------------------------------------------------
  function play(name, arg) {
    try {
      const fn = SOUNDS[name];
      if (!fn || muted) return;
      const c = ensureCtx();
      if (!c || !sfxBus) return;
      const gap = THROTTLE[name];
      if (gap !== undefined) {
        const n = nowMs();
        const last = lastPlayed[name] || 0;
        if (n - last < gap) return;
        lastPlayed[name] = n;
      }
      fn(c.currentTime + 0.01, arg);
    } catch (e) { /* audio must never break the game */ }
  }

  // ---------------------------------------------------------------------------
  // Music: a slow generative loop. Pads on each chord, sparse random plucks.
  // Uses Math.random on purpose so it never disturbs the seeded DS.rng.
  // ---------------------------------------------------------------------------
  function padNote(t, freq, vol, attack, len, type, cutoff) {
    const c = ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const bq = c.createBiquadFilter();
    bq.type = 'lowpass';
    bq.frequency.value = cutoff;
    bq.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + len - 2.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(bq);
    bq.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + len + 0.1);
  }

  function scheduleChord(t, k) {
    const ch = PROG[k % PROG.length];
    const len = BAR + 3.0; // overlaps the next chord for a soft crossfade
    padNote(t, midiHz(ch.bass), 0.10, 1.5, len, 'sine', 300);
    ch.tones.slice(0, 3).forEach((m) => {
      padNote(t, midiHz(m), 0.028, 2.5, len, 'triangle', 900);
      padNote(t, midiHz(m) * 1.004, 0.007, 3.0, len, 'sawtooth', 500);
    });
  }

  function pluck(t, freq, vol) {
    const c = ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    g.connect(arpBus);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g2 = c.createGain();
    g2.gain.value = 0.22;
    o2.connect(g2);
    g2.connect(g);
    o.start(t);
    o2.start(t);
    o.stop(t + 2.6);
    o2.stop(t + 2.6);
  }

  function scheduleArp(t, k) {
    const ch = PROG[k % PROG.length];
    if (Math.random() < 0.2) return; // rests keep it sparse
    let m = ch.tones[(Math.random() * ch.tones.length) | 0];
    if (Math.random() < 0.35) m += 12;
    const f = midiHz(m);
    if (f < 180 || f > 1100) return;
    pluck(t, f, 0.035 + Math.random() * 0.015);
  }

  function musicTick() {
    if (!ctx || !musicOn) return;
    try {
      const now = ctx.currentTime;
      // If the timer was starved (background tab), resync instead of bursting
      if (musicStart + nextChordK * BAR < now) {
        nextChordK = Math.floor((now - musicStart) / BAR) + 1;
      }
      if (nextArpT < now) nextArpT = now + 0.1;
      // A longer look-ahead keeps the loop gapless when a background tab throttles the timer
      const horizon = now + 0.9;
      while (musicStart + nextChordK * BAR < horizon) {
        scheduleChord(musicStart + nextChordK * BAR, nextChordK);
        nextChordK++;
      }
      while (nextArpT < horizon) {
        const k = Math.max(0, Math.floor((nextArpT - musicStart) / BAR));
        scheduleArp(nextArpT, k);
        nextArpT += 0.9 + Math.random() * 0.9;
      }
    } catch (e) { /* ignore */ }
  }

  function startMusic() {
    if (!ctx) return;
    if (musicTimer) { applyMusic(); return; }
    musicStart = ctx.currentTime + 0.15;
    nextChordK = 0;
    nextArpT = musicStart + 1.2;
    musicTimer = setInterval(musicTick, 120);
    musicTick();
    applyMusic();
  }

  function setMusicOn(on) {
    musicOn = !!on;
    lsSet(LS_MUSIC, musicOn ? '1' : '0');
    if (!ctx) {
      // Music will start when the context is built on the first gesture
      ensureCtx();
      return;
    }
    if (musicOn) {
      startMusic();
    } else {
      applyMusic();
      // Stop scheduling once the fade has finished
      setTimeout(() => {
        if (!musicOn && musicTimer) {
          clearInterval(musicTimer);
          musicTimer = null;
        }
      }, 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // Gesture unlock. The AudioContext is only created after a real user gesture.
  // ---------------------------------------------------------------------------
  function onGesture() {
    gestureSeen = true;
    try { ensureCtx(); } catch (e) { /* ignore */ }
  }
  try {
    if (typeof window !== 'undefined' && window && window.addEventListener) {
      window.addEventListener('pointerdown', onGesture, true);
      window.addEventListener('keydown', onGesture, true);
    }
  } catch (e) { /* ignore */ }

  // Delegated UI clicks
  try {
    if (typeof document !== 'undefined' && document && document.addEventListener) {
      document.addEventListener('click', (e) => {
        try {
          let t = e.target;
          if (!t) return;
          if (t.nodeType === 3) t = t.parentElement;
          if (!t || !t.closest) return;
          if (t.closest('.ds-btn') || t.closest('.ds-choice') || t.closest('.ds-map-node')) play('click');
          else if (t.closest('.ds-card')) play('select');
        } catch (err) { /* ignore */ }
      }, true);
    }
  } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------------------
  // Self-wiring to DS.events
  // ---------------------------------------------------------------------------
  function sub(name, fn) {
    try {
      if (DS.events && typeof DS.events.on === 'function') DS.events.on(name, fn);
    } catch (e) { /* ignore */ }
  }

  function cardTypeOf(card) {
    if (!card) return null;
    if (card.data && card.data.type) return card.data.type;
    try {
      const def = DS.cards && card.id ? DS.cards[card.id] : null;
      if (def && def.type) return def.type;
    } catch (e) { /* ignore */ }
    if (card.type) return card.type;
    return null;
  }

  const CARD_SFX = { attack: 'card_attack', skill: 'card_skill', power: 'card_power', curse: 'card_curse', status: 'card_status' };

  sub('combat:cardPlayed', (p) => {
    const type = cardTypeOf(p && p.card);
    play(CARD_SFX[type] || 'card_skill');
  });

  sub('combat:damage', (p) => {
    if (!p) return;
    const amt = Number(p.amount) || 0;
    const blk = Number(p.blocked) || 0;
    if (amt > 0) {
      // Self-inflicted HP loss (poison, burn, etc.) gets a tick instead of a hit
      const selfInflicted = !p.source || (p.target && p.source.uid === p.target.uid);
      if (selfInflicted) {
        const burning = !!(p.target && p.target.statuses && p.target.statuses.burn > 0);
        play('tick', burning ? 'burn' : 'poison');
      } else {
        play('hit', amt);
      }
    } else if (blk > 0) {
      play('hit_blocked');
    }
  });

  sub('combat:block', (p) => { if (p && Number(p.amount) > 0) play('block'); });
  sub('combat:heal', (p) => { if (p && Number(p.amount) > 0) play('heal'); });

  sub('combat:status', (p) => {
    if (!p) return;
    const amt = Number(p.amount) || 0;
    if (amt < 0) { play('unstatus'); return; }
    if (amt === 0) return;
    const def = DS.statuses ? DS.statuses[p.status] : null;
    const isDebuff = !!def && def.type === 'debuff';
    play(isDebuff ? 'debuff' : 'buff');
  });

  sub('combat:enemyDied', () => play('enemy_death'));
  sub('combat:shuffle', () => play('shuffle'));
  sub('combat:cardDrawn', () => play('draw'));
  sub('combat:cardExhausted', () => play('exhaust'));
  sub('combat:potionUsed', () => play('potion'));
  sub('combat:start', () => play('combat_start'));

  sub('combat:turnStart', (p) => {
    if (p && p.side === 'player' && Number(p.turn) > 1) play('turn_start');
  });

  sub('combat:end', (p) => {
    const result = p && p.result;
    if (result === 'lost') { play('defeat'); return; }
    if (result === 'won') {
      let boss = false;
      try { boss = !!(DS.combat && DS.combat.encounter && DS.combat.encounter.tier === 'boss'); } catch (e) { /* ignore */ }
      play(boss ? 'victory' : 'win');
    }
  });

  sub('run:gold', (p) => {
    const amt = Number(p && p.amount) || 0;
    if (amt > 0) play('gold');
    else if (amt < 0) play('spend');
  });
  sub('run:relic', () => play('relic'));
  sub('run:card', () => play('add_card'));

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function setMuted(b) {
    muted = !!b;
    lsSet(LS_MUTE, muted ? '1' : '0');
    applyVolume();
  }

  function setVolume(v) {
    const n = Number(v);
    volume = clamp(isNaN(n) ? 0.7 : n, 0, 1);
    lsSet(LS_VOL, volume.toFixed(2));
    applyVolume();
  }

  DS.audio = {
    play,
    setMuted,
    setVolume,
    setMusic: setMusicOn,
    /** Call from a user gesture if you want audio ready before the first click. */
    unlock() { gestureSeen = true; return ensureCtx() !== null; },
    get muted() { return muted; },
    set muted(v) { setMuted(v); },
    get volume() { return volume; },
    set volume(v) { setVolume(v); },
    get music() { return musicOn; },
    set music(v) { setMusicOn(v); },
    get ready() { return !!ctx; },
    sounds: Object.keys(SOUNDS),
  };
})();
