(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // Persistence + settings (guarded: localStorage / DS.settings may be missing)
  // Legacy keys are still read and written so older saves keep their volume.
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
  function sGet(key, fb) {
    try {
      return DS.settings && typeof DS.settings.get === 'function' ? DS.settings.get(key, fb) : fb;
    } catch (e) { return fb; }
  }
  function sSet(key, val) {
    try {
      if (DS.settings && typeof DS.settings.set === 'function' && DS.settings.get(key, undefined) !== val) DS.settings.set(key, val);
    } catch (e) { /* ignore */ }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  let volume = 0.7;
  let muted = false;
  let musicOn = true;
  let sfxVol = 1;
  let musVol = 1;

  function loadSettings() {
    try {
      const sv = lsGet(LS_VOL);
      const legacyVol = sv !== null && sv !== '' && !isNaN(parseFloat(sv)) ? clamp(parseFloat(sv), 0, 1) : 0.7;
      const v = Number(sGet('volume', legacyVol));
      volume = clamp(isNaN(v) ? legacyVol : v, 0, 1);
      const m = sGet('muted', lsGet(LS_MUTE) === '1');
      muted = m === true || m === '1' || m === 1;
      const mu = sGet('music', lsGet(LS_MUSIC) !== '0');
      musicOn = !(mu === false || mu === '0' || mu === 0);
      const sx = Number(sGet('sfxVolume', 1));
      sfxVol = clamp(isNaN(sx) ? 1 : sx, 0, 1);
      const mx = Number(sGet('musicVolume', 1));
      musVol = clamp(isNaN(mx) ? 1 : mx, 0, 1);
    } catch (e) { /* keep defaults */ }
  }
  loadSettings();

  // ---------------------------------------------------------------------------
  // Audio graph state (created lazily on first user gesture)
  //   voices -> sfxBus ---------------\
  //   tracks -> musicBus -> duck -----> master -> compressor -> limiter -> out
  //   feedback-delay "room" taps both buses; echo delay taps music arps
  // ---------------------------------------------------------------------------
  const Ctor = (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let duckNode = null;
  let verbSend = null;
  let echoIn = null;
  let noiseBuf = null;
  let gestureSeen = false;
  let failed = false;
  let suspendedByUs = false;

  const MUSIC_LEVEL = 0.8;
  const VOICE_CAP = 56;     // soft cap on simultaneous one-shot voices
  const VOICE_HARD = 96;    // even priority sounds stop here
  let voices = 0;
  let prioNow = false;

  // Per-sound minimum gap in ms, so rapid-fire events do not stack into mush
  const THROTTLE = {
    hit: 45, draw: 55, tick: 70, click: 35, select: 35, hover: 60, shuffle: 250, add_card: 60, buff: 60, debuff: 60,
    block: 60, heal: 80, gold: 60, hit_blocked: 50, enemy_swing: 160, card_attack: 40, card_skill: 40, exhaust: 80, unstatus: 70,
  };
  // Sounds that may exceed the soft voice cap
  const PRIO = { victory: 1, defeat: 1, achievement: 1, boss_intro: 1, elite_intro: 1, relic: 1, enemy_death: 1, win: 1, combat_start: 1 };
  const lastPlayed = {};

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
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(muted ? 0 : volume, t, 0.04);
      if (sfxBus) { sfxBus.gain.cancelScheduledValues(t); sfxBus.gain.setTargetAtTime(0.9 * sfxVol, t, 0.04); }
    } catch (e) { /* ignore */ }
  }

  function applyMusic() {
    if (!ctx || !musicBus) return;
    try {
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setTargetAtTime(musicOn ? MUSIC_LEVEL * musVol : 0, t, musicOn ? 0.6 : 0.3);
    } catch (e) { /* ignore */ }
  }

  // Temporarily lower the music so a stinger can breathe
  function duck(secs, depth) {
    if (!ctx || !duckNode) return;
    try {
      const t = ctx.currentTime;
      duckNode.gain.cancelScheduledValues(t);
      duckNode.gain.setTargetAtTime(depth == null ? 0.25 : depth, t, 0.05);
      duckNode.gain.setTargetAtTime(1, t + (secs || 2), 0.6);
    } catch (e) { /* ignore */ }
  }

  function build() {
    loadSettings();
    ctx = new Ctor();
    noiseBuf = makeNoise(ctx);

    // Master -> compressor -> hard limiter, so stacked hits never clip
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    master.connect(comp);
    comp.connect(limiter);
    limiter.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9 * sfxVol;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    duckNode = ctx.createGain();
    duckNode.gain.value = 1;
    musicBus.connect(duckNode);
    duckNode.connect(master);

    // Convolution-free room: four parallel damped feedback delays
    verbSend = ctx.createGain();
    verbSend.gain.value = 0.2;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    sfxBus.connect(verbSend);
    musicBus.connect(verbSend);
    [0.0297, 0.0371, 0.0533, 0.0719].forEach((dt) => {
      const d = ctx.createDelay(0.2);
      d.delayTime.value = dt;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const fb = ctx.createGain();
      fb.gain.value = 0.64;
      verbSend.connect(d);
      d.connect(lp);
      lp.connect(fb);
      fb.connect(d);
      lp.connect(verbOut);
    });
    verbOut.connect(master);

    // Music echo (arps and bells)
    echoIn = ctx.createGain();
    echoIn.gain.value = 1;
    const ed = ctx.createDelay(1.5);
    ed.delayTime.value = 0.38;
    const efb = ctx.createGain();
    efb.gain.value = 0.42;
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 2200;
    const ewet = ctx.createGain();
    ewet.gain.value = 0.5;
    echoIn.connect(ed);
    ed.connect(elp);
    elp.connect(efb);
    efb.connect(ed);
    elp.connect(ewet);
    ewet.connect(musicBus);

    applyVolume();
    applyMusic();
    startMusic();
  }

  function ensureCtx() {
    if (failed) return null;
    if (ctx) {
      if (ctx.state === 'suspended' && !hidden()) {
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

  function hidden() {
    try { return typeof document !== 'undefined' && !!document.hidden; } catch (e) { return false; }
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

  function voiceOk(o) {
    if (o.m) return true;
    if (voices >= VOICE_HARD) return false;
    if (voices >= VOICE_CAP && !prioNow) return false;
    return true;
  }

  // o: {t, f, f2?, dur, vol, type?, attack?, det?: [cents...], filt?: {type, f, f2?, q?}, bus?, send?, m?}
  function tone(o) {
    if (!ctx || !voiceOk(o)) return;
    const c = ctx;
    const t = o.t;
    const dur = o.dur;
    const dets = o.det && o.det.length ? o.det : [0];
    const g = c.createGain();
    env(g, t, o.vol / Math.sqrt(dets.length), o.attack || 0.005, dur);
    let dest = g;
    if (o.filt) {
      const bq = c.createBiquadFilter();
      bq.type = o.filt.type || 'lowpass';
      bq.frequency.setValueAtTime(o.filt.f, t);
      if (o.filt.f2) bq.frequency.exponentialRampToValueAtTime(o.filt.f2, t + dur);
      bq.Q.value = o.filt.q || 0.7;
      bq.connect(g);
      dest = bq;
    }
    g.connect(o.bus || sfxBus);
    if (o.send && echoIn) {
      const sg = c.createGain();
      sg.gain.value = o.send;
      g.connect(sg);
      sg.connect(echoIn);
    }
    for (let i = 0; i < dets.length; i++) {
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      if (dets[i]) osc.detune.value = dets[i];
      osc.connect(dest);
      if (!o.m) {
        voices++;
        osc.onended = () => { voices = Math.max(0, voices - 1); };
      }
      osc.start(t);
      osc.stop(t + dur + 0.06);
    }
  }

  // o: {t, dur, vol, type?, f?, f2?, q?, attack?, bus?, m?}
  function noise(o) {
    if (!ctx || !voiceOk(o)) return;
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
    if (!o.m) {
      voices++;
      src.onended = () => { voices = Math.max(0, voices - 1); };
    }
    // Start somewhere in the buffer so that offset + dur stays inside the 1 s noise loop
    src.start(t, Math.random() * Math.max(0, 0.95 - dur));
    src.stop(t + dur + 0.06);
  }

  // Inharmonic or harmonic partial stack (bells, clangs, glass)
  function partials(t, base, ratios, dur, vol, type, bus, send) {
    for (let i = 0; i < ratios.length; i++) {
      tone({
        t, f: base * ratios[i], dur: dur * (1 - i * 0.12), vol: vol / (1 + i * 0.6), type: type || 'sine', attack: 0.002,
        bus, send,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Damage flavor inference (mirrors fx.js): slash blunt fire poison frost lightning magic
  // ---------------------------------------------------------------------------
  const FLAVOR_RX = [
    ['lightning', /lightning|thunder|shock|bolt|storm|static|volt|galvan|zap|tempest|\barc\b/],
    ['frost', /frost|\bice\b|icy|freez|chill|cold|glacier|snow|blizzard|rime|winter|hail/],
    ['fire', /fire|flame|burn|blaze|inferno|ember|scorch|incinerat|immolat|molten|pyre|ignit|cinder|lava|sear|meteor|brand/],
    ['poison', /poison|venom|toxic|toxin|plague|acid|blight|corrod|viper|spore|noxious|caustic|rot\b|fester|miasma/],
    ['blunt', /bash|slam|smash|crush|pummel|hammer|mace|club|shield|bludgeon|stomp|quake|\bram\b|headbutt|punch|fist|knuckle|maul|pound|clobber|wallop|tackle|boulder|gavel|thump|impact|shockwave|trample|rampage|bulwark|fortress|stone/],
    ['magic', /arcane|spell|magic|rune|hex|void|soul|spirit|ether|astral|psychic|mind|ritual|eldritch|blood|dark|nova|orb|beam|missile|comet|star|radiant|holy|smite|curse|wraith|ghost|necro|occult|sigil|siphon|drain|essence|phantom|specter/],
    ['slash', /slash|\bcut|slice|cleave|blade|sword|dagger|stab|knife|rend|claw|\baxe|reap|scythe|shiv|pierce|lance|spear|strike|fang|bite|rake|carve|sever|gash|flay|whip|arrow|shot|throw|talon|saber|sabre|razor|rapier/],
  ];
  const ICON_FLAVOR = { '🔥': 'fire', '❄': 'frost', '🧊': 'frost', '⚡': 'lightning', '☠': 'poison', '🧪': 'poison', '🐍': 'poison', '🔨': 'blunt', '🛡': 'blunt', '⚔': 'slash', '🗡': 'slash', '🪓': 'slash', '🔮': 'magic', '✨': 'magic', '🌩': 'lightning', '☄': 'fire' };
  const CLASS_FLAVOR = { berserker: 'slash', shade: 'slash', arcanist: 'magic', warden: 'blunt', tempest: 'lightning', occultist: 'magic' };

  function effectFlavor(effects, depth) {
    if (!Array.isArray(effects) || depth > 3) return null;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (!e || typeof e !== 'object') continue;
      if (e.op === 'apply') {
        if (e.status === 'poison') return 'poison';
        if (e.status === 'burn') return 'fire';
      }
      const s = effectFlavor(e.effects, depth + 1) || effectFlavor(e.then, depth + 1) || effectFlavor(e.onKill, depth + 1);
      if (s) return s;
    }
    return null;
  }

  function flavorFrom(text, icon, effects, cls) {
    try {
      const t = String(text || '').toLowerCase();
      for (let i = 0; i < FLAVOR_RX.length; i++) if (FLAVOR_RX[i][1].test(t)) return FLAVOR_RX[i][0];
      const ef = effectFlavor(effects, 0);
      if (ef) return ef;
      if (icon) {
        const ic = String(icon).replace(/️/g, '');
        for (const k in ICON_FLAVOR) if (ic.indexOf(k) >= 0) return ICON_FLAVOR[k];
      }
      return CLASS_FLAVOR[cls] || 'slash';
    } catch (e) { return 'slash'; }
  }

  function cardFlavor(card) {
    if (!card) return 'slash';
    const d = card.data || (DS.cards && DS.cards[card.id]) || {};
    const text = [d.name, String(card.id || '').replace(/^[a-z]+_/, '').replace(/_/g, ' '), d.desc].join(' ');
    return flavorFrom(text, d.icon, d.effects, d['class']);
  }

  function enemyFlavor(enemy, move) {
    const def = (enemy && enemy.def) || {};
    const text = [move && move.name, def.name, String(def.id || '').replace(/^a\d_/, '').replace(/_/g, ' ')].join(' ');
    return flavorFrom(text, def.icon, move && move.effects, null);
  }

  let lastCard = { f: 'slash', t: 0 };
  const enemyFx = new Map();

  // ---------------------------------------------------------------------------
  // Sound bank. Each entry is (startTime, arg) => schedules nodes.
  // ---------------------------------------------------------------------------
  // Flavor layer of an impact. k = weight 0.15..1.6
  function hitLayer(t, f, k) {
    switch (f) {
      case 'blunt':
        noise({ t, dur: 0.22, vol: 0.2 + 0.14 * k, type: 'lowpass', f: 900, f2: 150, q: 0.6, attack: 0.002 });
        tone({ t, f: 120, f2: 40, dur: 0.3, vol: 0.28, type: 'sine', attack: 0.002 });
        if (k > 0.6) noise({ t, dur: 0.04, vol: 0.2, type: 'highpass', f: 2500, q: 0.7, attack: 0.001 });
        break;
      case 'fire':
        noise({ t, dur: 0.36, vol: 0.17, type: 'bandpass', f: 500, f2: 2800, q: 0.9, attack: 0.05 });
        for (let i = 0; i < 4; i++) noise({ t: t + 0.04 + i * 0.05 + Math.random() * 0.02, dur: 0.03, vol: 0.12, type: 'highpass', f: 3500, q: 0.6 });
        tone({ t, f: 150, f2: 85, dur: 0.3, vol: 0.09, type: 'sawtooth', filt: { type: 'lowpass', f: 600 } });
        break;
      case 'poison':
        for (let i = 0; i < 4; i++) tone({ t: t + i * 0.045, f: rnd(300, 600), f2: rnd(140, 260), dur: 0.12, vol: 0.09, type: 'sine' });
        noise({ t, dur: 0.22, vol: 0.06, type: 'lowpass', f: 700, f2: 250, q: 0.6 });
        tone({ t, f: 200, f2: 110, dur: 0.3, vol: 0.06, type: 'sawtooth', filt: { type: 'lowpass', f: 400 } });
        break;
      case 'frost':
        partials(t, 1600, [1, 1.5, 2.3, 3.1], 0.42, 0.06, 'sine');
        noise({ t, dur: 0.2, vol: 0.12, type: 'highpass', f: 6000, q: 0.6, attack: 0.001 });
        tone({ t, f: 2600, f2: 1200, dur: 0.1, vol: 0.05, type: 'triangle' });
        break;
      case 'lightning':
        tone({ t, f: 1800, f2: 120, dur: 0.14, vol: 0.1, type: 'square', filt: { type: 'lowpass', f: 4000, f2: 400 } });
        noise({ t, dur: 0.11, vol: 0.25, type: 'highpass', f: 3000, q: 0.7, attack: 0.001 });
        tone({ t, f: 70, dur: 0.3, vol: 0.1, type: 'sawtooth', filt: { type: 'lowpass', f: 300 } });
        for (let i = 1; i < 4; i++) tone({ t: t + i * 0.035, f: rnd(900, 2200), f2: 200, dur: 0.05, vol: 0.05, type: 'square' });
        break;
      case 'magic':
        tone({ t, f: 300, f2: 900, dur: 0.3, vol: 0.1, type: 'triangle', attack: 0.03 });
        partials(t + 0.02, 880, [1, 1.5, 2.01], 0.5, 0.05, 'sine');
        noise({ t, dur: 0.3, vol: 0.06, type: 'bandpass', f: 2000, q: 3, attack: 0.02 });
        tone({ t, f: 90, f2: 60, dur: 0.3, vol: 0.14, type: 'sine' });
        break;
      default: // slash
        noise({ t, dur: 0.16, vol: 0.18 + 0.12 * k, type: 'bandpass', f: 5200, f2: 1400, q: 1.4, attack: 0.002 });
        partials(t, 2400, [1, 1.51, 2.2], 0.18, 0.045 + 0.03 * k, 'sine');
        tone({ t, f: 900, f2: 300, dur: 0.08, vol: 0.06, type: 'sawtooth', filt: { type: 'lowpass', f: 3000 } });
        tone({ t, f: 150, f2: 70, dur: 0.12, vol: 0.1 + 0.1 * k, type: 'sine' });
    }
  }

  const SOUNDS = {
    // Card play, by type. arg = flavor for attacks
    card_attack(t, f) {
      switch (f) {
        case 'blunt':
          noise({ t, dur: 0.2, vol: 0.18, type: 'lowpass', f: 700, f2: 200, q: 0.5, attack: 0.04 });
          tone({ t, f: 180, f2: 80, dur: 0.18, vol: 0.12, type: 'triangle' });
          break;
        case 'fire':
          noise({ t, dur: 0.28, vol: 0.14, type: 'bandpass', f: 400, f2: 2000, q: 0.8, attack: 0.09 });
          tone({ t, f: 180, f2: 380, dur: 0.22, vol: 0.06, type: 'sawtooth', filt: { type: 'lowpass', f: 900 } });
          break;
        case 'poison':
          tone({ t, f: 300, f2: 520, dur: 0.22, vol: 0.08, type: 'sine', attack: 0.04 });
          noise({ t, dur: 0.14, vol: 0.06, type: 'highpass', f: 3500 });
          break;
        case 'frost':
          tone({ t, f: 1800, f2: 2600, dur: 0.2, vol: 0.05, type: 'sine' });
          noise({ t, dur: 0.16, vol: 0.08, type: 'highpass', f: 5000, attack: 0.03 });
          break;
        case 'lightning':
          tone({ t, f: 900, f2: 220, dur: 0.1, vol: 0.07, type: 'square', filt: { type: 'lowpass', f: 2500 } });
          noise({ t, dur: 0.08, vol: 0.14, type: 'highpass', f: 3500 });
          break;
        case 'magic':
          tone({ t, f: 400, f2: 900, dur: 0.26, vol: 0.08, type: 'triangle', attack: 0.04 });
          tone({ t: t + 0.04, f: 1200, dur: 0.2, vol: 0.03, type: 'sine' });
          break;
        default:
          noise({ t, dur: 0.14, vol: 0.2, type: 'bandpass', f: 2600, f2: 500, q: 1.2, attack: 0.01 });
          tone({ t, f: 480, f2: 200, dur: 0.12, vol: 0.09, type: 'triangle' });
      }
    },
    card_skill(t) {
      noise({ t, dur: 0.06, vol: 0.05, type: 'bandpass', f: 3000, q: 1.5 });
      tone({ t, f: 660, dur: 0.3, vol: 0.10, type: 'sine' });
      tone({ t: t + 0.04, f: 990, dur: 0.3, vol: 0.06, type: 'sine' });
      tone({ t: t + 0.08, f: 1320, dur: 0.22, vol: 0.025, type: 'sine' });
    },
    card_power(t) {
      [330, 440, 554, 660].forEach((f, i) => tone({ t: t + i * 0.05, f, dur: 0.6, vol: 0.09, type: 'triangle', attack: 0.01, det: [-6, 6] }));
      tone({ t, f: 82, f2: 110, dur: 0.6, vol: 0.14, type: 'sine', attack: 0.05 });
      noise({ t, dur: 0.3, vol: 0.05, type: 'highpass', f: 4000, f2: 7000, q: 0.5 });
      partials(t + 0.18, 1320, [1, 2.01], 0.7, 0.04, 'sine');
    },
    card_curse(t) {
      tone({ t, f: 110, f2: 82, dur: 0.55, vol: 0.18, type: 'sawtooth', filt: { type: 'lowpass', f: 500, f2: 200 } });
      tone({ t: t + 0.02, f: 155.6, f2: 120, dur: 0.55, vol: 0.07, type: 'square', filt: { type: 'lowpass', f: 600 } });
      tone({ t, f: 116, f2: 90, dur: 0.5, vol: 0.06, type: 'sawtooth', det: [30], filt: { type: 'lowpass', f: 400 } });
    },
    card_status(t) {
      tone({ t, f: 140, f2: 55, dur: 0.22, vol: 0.25, type: 'sine' });
      noise({ t, dur: 0.12, vol: 0.12, type: 'lowpass', f: 900, f2: 200, q: 0.5 });
    },
    card_flick(t) {
      noise({ t, dur: 0.05, vol: 0.09, type: 'bandpass', f: 4200, q: 1.8, attack: 0.001 });
    },

    // Combat damage. arg = number or {d, f (flavor), p (target is player)}
    hit(t, a) {
      const o = typeof a === 'object' && a ? a : { d: a };
      const d = clamp(Number(o.d) || 0, 1, 60);
      const k = clamp(d / 25, 0.15, 1.6);
      // Every hit: a sub thump whose weight scales with damage
      tone({ t, f: clamp(210 - d * 2.2, 60, 200), f2: 38, dur: 0.14 + clamp(d * 0.005, 0, 0.3), vol: clamp(0.12 + k * 0.24, 0.12, 0.45), type: 'sine', attack: 0.002 });
      hitLayer(t, o.f || 'slash', k);
      if (o.p) {
        tone({ t, f: 240, f2: 100, dur: 0.22, vol: 0.09 + k * 0.05, type: 'sawtooth', filt: { type: 'lowpass', f: 700, f2: 200 } });
        if (d >= 8) tone({ t: t + 0.01, f: 138, f2: 120, dur: 0.3, vol: 0.05, type: 'square', filt: { type: 'lowpass', f: 400 } });
      }
      if (d >= 12) tone({ t, f: 70, f2: 35, dur: 0.38, vol: 0.38, type: 'sine', attack: 0.002 });
      if (d >= 20) {
        noise({ t, dur: 0.3, vol: 0.2, type: 'lowpass', f: 700, f2: 120, q: 0.6, attack: 0.002 });
        tone({ t: t + 0.02, f: 55, f2: 30, dur: 0.6, vol: 0.28, type: 'sine', attack: 0.004 });
      }
    },
    // A blocked hit: metallic clang
    hit_blocked(t) {
      partials(t, 820, [1, 1.52, 2.34, 3.17], 0.4, 0.1, 'square', null);
      tone({ t, f: 1250, dur: 0.22, vol: 0.07, type: 'triangle' });
      tone({ t: t + 0.005, f: 1880, dur: 0.16, vol: 0.05, type: 'sine' });
      noise({ t, dur: 0.06, vol: 0.2, type: 'highpass', f: 3000, q: 0.7, attack: 0.001 });
      tone({ t, f: 180, f2: 90, dur: 0.1, vol: 0.12, type: 'sine' });
    },
    // Gaining block: a rising plate + ring
    block(t) {
      tone({ t, f: 300, f2: 900, dur: 0.22, vol: 0.10, type: 'triangle', attack: 0.04 });
      noise({ t, dur: 0.2, vol: 0.09, type: 'bandpass', f: 800, f2: 2400, q: 1.5, attack: 0.05 });
      partials(t + 0.17, 1100, [1, 1.51, 2.33], 0.45, 0.07, 'triangle');
      tone({ t: t + 0.17, f: 220, f2: 140, dur: 0.12, vol: 0.12, type: 'sine' });
    },

    // Statuses. arg = status id
    buff(t) {
      [440, 660, 880, 1320].forEach((f, i) => tone({ t: t + i * 0.055, f, dur: 0.32, vol: 0.075 - i * 0.008, type: 'triangle', attack: 0.01 }));
      noise({ t: t + 0.1, dur: 0.25, vol: 0.04, type: 'highpass', f: 6000, q: 0.5, attack: 0.05 });
    },
    debuff(t, id) {
      const s = String(id || '');
      tone({ t, f: 520, f2: 150, dur: 0.46, vol: 0.10, type: 'sawtooth', det: [-12, 12], filt: { type: 'lowpass', f: 1400, f2: 250 } });
      tone({ t: t + 0.05, f: 260, f2: 90, dur: 0.4, vol: 0.07, type: 'sine' });
      if (/poison|venom|toxic/.test(s)) {
        for (let i = 0; i < 3; i++) tone({ t: t + i * 0.05, f: rnd(300, 500), f2: rnd(150, 250), dur: 0.1, vol: 0.06, type: 'sine' });
      }
    },
    ignite(t) {
      noise({ t, dur: 0.3, vol: 0.14, type: 'bandpass', f: 400, f2: 2400, q: 0.9, attack: 0.04 });
      tone({ t, f: 130, f2: 220, dur: 0.28, vol: 0.07, type: 'sawtooth', filt: { type: 'lowpass', f: 700 } });
    },
    unstatus(t) {
      tone({ t, f: 660, f2: 440, dur: 0.2, vol: 0.08, type: 'sine' });
    },
    // Damage over time. arg: 'burn' for crackle, anything else for poison bubbles
    tick(t, kind) {
      if (kind === 'burn') {
        noise({ t, dur: 0.09, vol: 0.14, type: 'bandpass', f: 1800, f2: 600, q: 0.8 });
        for (let i = 1; i < 3; i++) noise({ t: t + i * 0.04, dur: 0.025, vol: 0.09, type: 'highpass', f: 4000 });
        tone({ t, f: 200, f2: 120, dur: 0.10, vol: 0.10, type: 'triangle' });
      } else {
        tone({ t, f: 420, f2: 260, dur: 0.14, vol: 0.12, type: 'sine' });
        tone({ t: t + 0.05, f: 620, f2: 380, dur: 0.10, vol: 0.06, type: 'sine' });
        tone({ t: t + 0.09, f: 360, f2: 200, dur: 0.1, vol: 0.05, type: 'sine' });
      }
    },
    heal(t) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ t: t + i * 0.07, f, dur: 0.45, vol: 0.085, type: 'triangle', attack: 0.01, send: 0 }));
      noise({ t, dur: 0.4, vol: 0.03, type: 'highpass', f: 6500, q: 0.5, attack: 0.1 });
    },
    // arg = amount: more coins for bigger sums
    gold(t, amt) {
      const n = clamp(Math.round((Number(amt) || 1) / 12) + 2, 2, 6);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.055 + Math.random() * 0.015;
        const base = rnd(1800, 2300);
        tone({ t: tt, f: base, dur: 0.1, vol: 0.09, type: 'triangle', attack: 0.001 });
        tone({ t: tt + 0.04, f: base * 1.5, dur: 0.34, vol: 0.075, type: 'triangle', attack: 0.001 });
        tone({ t: tt + 0.04, f: base * 2.76, dur: 0.18, vol: 0.025, type: 'sine', attack: 0.001 });
      }
    },
    spend(t) {
      tone({ t, f: 900, f2: 560, dur: 0.14, vol: 0.09, type: 'triangle' });
      tone({ t: t + 0.07, f: 700, f2: 420, dur: 0.14, vol: 0.07, type: 'triangle' });
      noise({ t, dur: 0.05, vol: 0.06, type: 'highpass', f: 3000, q: 0.6 });
    },

    // Enemy and deck flow. arg = tier for enemy_death
    enemy_death(t, tier) {
      const big = tier === 'boss' ? 2 : tier === 'elite' ? 1.4 : 1;
      tone({ t, f: 160, f2: 36, dur: 0.6 * big, vol: 0.32, type: 'sine', attack: 0.003 });
      tone({ t, f: 60, f2: 30, dur: 0.5 * big, vol: 0.26, type: 'sine', attack: 0.003 });
      noise({ t, dur: 0.7 * big, vol: 0.18, type: 'lowpass', f: 1600, f2: 180, q: 0.7, attack: 0.01 });
      tone({ t: t + 0.12, f: 330, f2: 90, dur: 0.4 * big, vol: 0.06, type: 'sawtooth', filt: { type: 'lowpass', f: 900, f2: 200 } });
      for (let i = 0; i < 4; i++) tone({ t: t + 0.15 + i * 0.05, f: rnd(1200, 2400), f2: rnd(300, 600), dur: 0.2, vol: 0.025, type: 'sine' });
    },
    shuffle(t) {
      for (let i = 0; i < 12; i++) {
        noise({ t: t + i * 0.03 + Math.random() * 0.01, dur: 0.035, vol: 0.09, type: 'bandpass', f: 2200 + Math.random() * 1800, q: 2 });
      }
      tone({ t: t + 0.4, f: 200, f2: 140, dur: 0.12, vol: 0.06, type: 'triangle' });
    },
    draw(t) {
      noise({ t, dur: 0.14, vol: 0.12, type: 'bandpass', f: 1200, f2: 3200, q: 1.1, attack: 0.03 });
      tone({ t: t + 0.09, f: 320, f2: 240, dur: 0.05, vol: 0.04, type: 'triangle' });
    },
    add_card(t) {
      tone({ t, f: 880, dur: 0.18, vol: 0.08, type: 'sine' });
      tone({ t: t + 0.06, f: 1320, dur: 0.25, vol: 0.06, type: 'sine' });
      tone({ t: t + 0.12, f: 1760, dur: 0.3, vol: 0.04, type: 'sine' });
      noise({ t, dur: 0.1, vol: 0.05, type: 'bandpass', f: 3000, f2: 1500, q: 1 });
    },
    exhaust(t) {
      tone({ t, f: 1400, f2: 260, dur: 0.5, vol: 0.07, type: 'sine' });
      noise({ t, dur: 0.4, vol: 0.07, type: 'highpass', f: 3000, f2: 6000, q: 0.5, attack: 0.05 });
      for (let i = 0; i < 3; i++) noise({ t: t + 0.05 + i * 0.07, dur: 0.025, vol: 0.07, type: 'highpass', f: 4500 });
    },
    turn_start(t) {
      tone({ t, f: 293.66, dur: 1.2, vol: 0.09, type: 'sine', attack: 0.01 });
      tone({ t, f: 440, dur: 1.0, vol: 0.05, type: 'sine', attack: 0.02 });
      tone({ t, f: 587.33, dur: 0.8, vol: 0.02, type: 'sine', attack: 0.03 });
      tone({ t, f: 146.83, dur: 1.2, vol: 0.07, type: 'triangle', attack: 0.02 });
    },
    enemy_swing(t) {
      noise({ t, dur: 0.18, vol: 0.08, type: 'bandpass', f: 600, f2: 200, q: 1, attack: 0.06 });
      tone({ t, f: 110, f2: 70, dur: 0.18, vol: 0.06, type: 'sine', attack: 0.05 });
    },
    combat_start(t) {
      tone({ t, f: 90, f2: 42, dur: 0.35, vol: 0.35, type: 'sine', attack: 0.003 });
      noise({ t, dur: 0.12, vol: 0.15, type: 'lowpass', f: 500, f2: 120, q: 0.6, attack: 0.002 });
      tone({ t: t + 0.22, f: 100, f2: 45, dur: 0.3, vol: 0.25, type: 'sine', attack: 0.003 });
      noise({ t: t + 0.22, dur: 0.1, vol: 0.12, type: 'lowpass', f: 500, f2: 120, q: 0.6, attack: 0.002 });
    },
    elite_intro(t) {
      SOUNDS.combat_start(t);
      [138.6, 164.8, 207.7].forEach((f) => tone({ t: t + 0.4, f, dur: 1.0, vol: 0.07, type: 'sawtooth', attack: 0.04, det: [-9, 9], filt: { type: 'lowpass', f: 900, f2: 300 } }));
      tone({ t: t + 0.4, f: 55, f2: 45, dur: 1.2, vol: 0.2, type: 'sine', attack: 0.05 });
    },
    boss_intro(t) {
      // Slow low swell, a dissonant brass cluster and three heavy hits
      tone({ t, f: 41, f2: 55, dur: 2.4, vol: 0.28, type: 'sine', attack: 0.9 });
      tone({ t, f: 82, f2: 110, dur: 2.2, vol: 0.12, type: 'sawtooth', attack: 1.0, filt: { type: 'lowpass', f: 300, f2: 900 } });
      [0, 0.5, 1.0].forEach((d, i) => {
        tone({ t: t + 1.2 + d, f: 90 - i * 8, f2: 36, dur: 0.6, vol: 0.38, type: 'sine', attack: 0.003 });
        noise({ t: t + 1.2 + d, dur: 0.3, vol: 0.2, type: 'lowpass', f: 600, f2: 100, q: 0.6, attack: 0.002 });
      });
      [185, 196, 233, 277].forEach((f) => tone({ t: t + 1.9, f, dur: 1.6, vol: 0.07, type: 'sawtooth', attack: 0.06, det: [-10, 10], filt: { type: 'lowpass', f: 1400, f2: 350 } }));
      noise({ t: t + 1.9, dur: 1.2, vol: 0.06, type: 'bandpass', f: 800, f2: 200, q: 0.8, attack: 0.1 });
    },
    // Boss-style fanfare (also callable directly by UI)
    victory(t) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone({ t: t + i * 0.16, f, dur: 0.3, vol: 0.12, type: 'triangle', attack: 0.005 });
        tone({ t: t + i * 0.16, f: f * 2, dur: 0.25, vol: 0.03, type: 'sine' });
      });
      const c = t + 0.66;
      notes.forEach((f) => tone({ t: c, f, dur: 1.8, vol: 0.08, type: 'triangle', attack: 0.02, det: [-5, 5] }));
      tone({ t: c, f: 130.8, dur: 1.8, vol: 0.14, type: 'sine', attack: 0.02 });
      partials(c + 0.1, 2093, [1, 1.5], 1.2, 0.04, 'sine');
      noise({ t: c, dur: 0.5, vol: 0.04, type: 'highpass', f: 5000, q: 0.5 });
      duck(2.8, 0.2);
    },
    // Short win chime for ordinary fights
    win(t) {
      [659.25, 783.99, 987.77].forEach((f, i) => tone({ t: t + i * 0.09, f, dur: 0.3, vol: 0.09, type: 'triangle', attack: 0.005 }));
      tone({ t: t + 0.27, f: 1318.5, dur: 0.6, vol: 0.05, type: 'sine' });
      duck(1.2, 0.35);
    },
    defeat(t) {
      const notes = [220, 174.61, 155.56, 146.83];
      notes.forEach((f, i) => tone({
        t: t + i * 0.38, f, dur: 0.9, vol: 0.13, type: 'sawtooth', attack: 0.02, det: [-8, 8],
        filt: { type: 'lowpass', f: 800, f2: 250 },
      }));
      tone({ t: t + 1.6, f: 73.42, dur: 1.8, vol: 0.16, type: 'sine', attack: 0.02 });
      tone({ t: t + 1.6, f: 36.7, dur: 2.2, vol: 0.2, type: 'sine', attack: 0.05 });
      duck(3.5, 0.15);
    },
    achievement(t) {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => {
        tone({ t: t + i * 0.09, f, dur: 0.34, vol: 0.1, type: 'square', attack: 0.004, filt: { type: 'lowpass', f: 3200 } });
        tone({ t: t + i * 0.09, f: f * 2, dur: 0.3, vol: 0.03, type: 'sine' });
      });
      const c = t + 0.5;
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone({ t: c, f, dur: 1.5, vol: 0.075, type: 'triangle', attack: 0.015, det: [-6, 6] }));
      for (let i = 0; i < 8; i++) tone({ t: c + i * 0.06, f: rnd(2400, 4200), dur: 0.2, vol: 0.025, type: 'sine' });
      noise({ t: c, dur: 0.6, vol: 0.05, type: 'highpass', f: 5500, q: 0.5 });
      duck(2.2, 0.3);
    },

    // UI
    click(t) {
      tone({ t, f: 1800, dur: 0.03, vol: 0.04, type: 'square', filt: { type: 'lowpass', f: 3000 } });
      tone({ t, f: 220, f2: 140, dur: 0.05, vol: 0.05, type: 'sine' });
    },
    select(t) {
      tone({ t, f: 900, f2: 1100, dur: 0.05, vol: 0.05, type: 'sine' });
    },
    hover(t) {
      tone({ t, f: 2400, dur: 0.018, vol: 0.022, type: 'sine', attack: 0.002 });
    },
    error(t) {
      tone({ t, f: 150, dur: 0.15, vol: 0.08, type: 'square', filt: { type: 'lowpass', f: 600 } });
      tone({ t: t + 0.09, f: 130, dur: 0.15, vol: 0.07, type: 'square', filt: { type: 'lowpass', f: 500 } });
    },
    potion(t) {
      tone({ t, f: 300, f2: 900, dur: 0.3, vol: 0.10, type: 'sine', attack: 0.01 });
      noise({ t, dur: 0.25, vol: 0.05, type: 'lowpass', f: 900, f2: 2000, q: 0.8 });
      for (let i = 0; i < 5; i++) {
        const f = 500 + Math.random() * 500;
        tone({ t: t + 0.1 + i * 0.05, f, f2: f * 1.4, dur: 0.08, vol: 0.06, type: 'sine' });
      }
    },
    relic(t) {
      partials(t, 880, [1, 2.01, 2.99, 4.2], 1.2, 0.09, 'sine');
      [880, 1320, 1760].forEach((f, i) => tone({ t: t + i * 0.07, f, dur: 0.7, vol: 0.07, type: 'sine', attack: 0.005 }));
      tone({ t: t + 0.2, f: 2640, dur: 1.0, vol: 0.03, type: 'sine' });
      noise({ t, dur: 0.5, vol: 0.03, type: 'highpass', f: 6000, q: 0.5, attack: 0.1 });
    },
    reward(t) {
      [523.25, 659.25, 783.99].forEach((f, i) => tone({ t: t + i * 0.08, f, dur: 0.4, vol: 0.09, type: 'triangle' }));
      tone({ t: t + 0.24, f: 1046.5, dur: 0.5, vol: 0.05, type: 'sine' });
    },
  };

  // ---------------------------------------------------------------------------
  // Public play() with lazy context, throttling and voice cap. Never throws.
  // ---------------------------------------------------------------------------
  function play(name, arg) {
    try {
      const fn = SOUNDS[name];
      if (!fn || muted) return;
      const c = ensureCtx();
      if (!c || !sfxBus || hidden()) return;
      const gap = THROTTLE[name];
      if (gap !== undefined) {
        const n = nowMs();
        const last = lastPlayed[name] || 0;
        if (n - last < gap) return;
        lastPlayed[name] = n;
      }
      prioNow = !!PRIO[name];
      try { fn(c.currentTime + 0.01, arg); } finally { prioNow = false; }
    } catch (e) { /* audio must never break the game */ }
  }

  // ---------------------------------------------------------------------------
  // Adaptive music: generative step sequencer, one config per mood.
  // Steps are eighth notes, 8 per bar. Uses Math.random on purpose so it never
  // disturbs the seeded DS.rng.
  // ---------------------------------------------------------------------------
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    harm: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  const TRIAD = [0, 2, 4];
  const SEVENTH = [0, 2, 4, 6];

  // pad: sustained chord. bass: step -> velocity. arp: random/pattern notes. drums: step arrays.
  // stab: short chord hits. bell: sparse bright notes. wind: filtered noise bed. crackle: fire pops.
  const TRACKS = {
    menu: {
      bpm: 60, root: 45, scale: 'minor', prog: [0, 5, 3, 4], shape: TRIAD, vol: 0.95,
      pad: { type: 'triangle', vol: 0.05, cutoff: 900, att: 2.5, oct: 1, det: [0, 7] },
      bass: { steps: { 0: 1 }, type: 'sine', vol: 0.12, cutoff: 300, oct: 0, len: 7 },
      arp: { p: 0.28, wave: 'sine', vol: 0.036, oct: 1, send: 0.55 },
      bell: { p: 0.08, vol: 0.03, oct: 2 },
    },
    map1: {
      bpm: 68, root: 38, scale: 'dorian', prog: [0, 3, 4, 0, 5, 3, 1, 4], shape: TRIAD, vol: 0.95,
      pad: { type: 'triangle', vol: 0.045, cutoff: 1000, att: 2.2, oct: 1, det: [0, 5] },
      bass: { steps: { 0: 1, 4: 0.6 }, type: 'sine', vol: 0.11, cutoff: 320, oct: 0, len: 4 },
      arp: { p: 0.4, wave: 'triangle', vol: 0.036, oct: 1, send: 0.5, pattern: 'rand' },
      wind: { vol: 0.02, f: 500 },
    },
    map2: {
      bpm: 74, root: 40, scale: 'phrygian', prog: [0, 1, 0, 6, 5, 0, 3, 1], shape: TRIAD, vol: 0.95,
      pad: { type: 'sine', vol: 0.06, cutoff: 700, att: 2.6, oct: 1, det: [0, 8] },
      bass: { steps: { 0: 1, 3: 0.6 }, type: 'sine', vol: 0.11, cutoff: 300, oct: 0, len: 3 },
      arp: { p: 0.45, wave: 'sine', vol: 0.04, oct: 1, send: 0.8, pattern: 'rand' },
      bell: { p: 0.1, vol: 0.03, oct: 2 },
      wind: { vol: 0.025, f: 300 },
    },
    map3: {
      bpm: 82, root: 36, scale: 'lydian', prog: [0, 4, 5, 3, 0, 2, 3, 4], shape: SEVENTH, vol: 0.95,
      pad: { type: 'sawtooth', vol: 0.02, cutoff: 1400, att: 2.0, oct: 2, det: [0, 9, -9] },
      bass: { steps: { 0: 1, 4: 0.8 }, type: 'triangle', vol: 0.13, cutoff: 420, oct: 0, len: 3.5 },
      arp: { p: 0.5, wave: 'triangle', vol: 0.036, oct: 2, send: 0.5, pattern: 'up' },
      drums: { kick: [0], hat: [], vol: 0.45 },
      wind: { vol: 0.03, f: 900 },
    },
    combat_normal: {
      bpm: 112, root: 38, scale: 'minor', prog: [0, 0, 5, 4, 0, 0, 3, 4], shape: TRIAD, vol: 1,
      pad: { type: 'sawtooth', vol: 0.02, cutoff: 700, att: 0.4, oct: 1, det: [0, 8] },
      bass: { steps: { 0: 1, 2: 0.7, 3: 0.7, 4: 1, 6: 0.7, 7: 0.6 }, type: 'sawtooth', vol: 0.12, cutoff: 420, oct: 0, len: 1.4 },
      arp: { p: 0.5, wave: 'square', vol: 0.026, oct: 1, send: 0.3, cutoff: 1800, pattern: 'updown' },
      drums: { kick: [0, 4], snare: [2, 6], hat: [1, 3, 5, 7], vol: 0.7 },
    },
    combat_elite: {
      bpm: 128, root: 37, scale: 'phrygian', prog: [0, 1, 0, 6, 0, 1, 5, 6], shape: TRIAD, vol: 1,
      pad: { type: 'sawtooth', vol: 0.022, cutoff: 800, att: 0.3, oct: 1, det: [0, 12, -12] },
      bass: { steps: { 0: 1, 1: 0.6, 2: 0.8, 3: 0.6, 4: 1, 5: 0.6, 6: 0.8, 7: 0.6 }, type: 'sawtooth', vol: 0.12, cutoff: 520, oct: 0, len: 1.1 },
      arp: { p: 0.62, wave: 'sawtooth', vol: 0.02, oct: 1, send: 0.25, cutoff: 2200, pattern: 'updown' },
      stab: { steps: [0, 3, 6], type: 'sawtooth', vol: 0.035, cutoff: 1500, oct: 1 },
      drums: { kick: [0, 2, 4, 6], snare: [2, 6], hat: [1, 3, 5, 7], vol: 0.8 },
    },
    combat_boss: {
      bpm: 92, root: 42, scale: 'harm', prog: [0, 5, 0, 4, 0, 5, 6, 4], shape: SEVENTH, vol: 1,
      pad: { type: 'sawtooth', vol: 0.032, cutoff: 900, att: 1.2, oct: 1, det: [0, 8, -8, 16] },
      bass: { steps: { 0: 1, 3: 0.8, 6: 0.9 }, type: 'sawtooth', vol: 0.15, cutoff: 360, oct: 0, len: 2 },
      arp: { p: 0.35, wave: 'square', vol: 0.022, oct: 2, send: 0.5, cutoff: 2000, pattern: 'up' },
      stab: { steps: [0, 4], type: 'sawtooth', vol: 0.05, cutoff: 1100, oct: 1 },
      drums: { kick: [0, 3, 6], snare: [4], hat: [2, 6], tom: [5, 7], vol: 0.95 },
      wind: { vol: 0.02, f: 200 },
    },
    shop: {
      bpm: 88, root: 41, scale: 'dorian', prog: [0, 3, 4, 3, 0, 5, 4, 3], shape: TRIAD, vol: 0.9,
      pad: { type: 'triangle', vol: 0.035, cutoff: 1100, att: 1.2, oct: 1, det: [0, 6] },
      bass: { steps: { 0: 1, 3: 0.7, 4: 0.9, 7: 0.6 }, type: 'triangle', vol: 0.13, cutoff: 500, oct: 0, len: 1.5 },
      arp: { p: 0.58, wave: 'triangle', vol: 0.036, oct: 1, send: 0.3, pattern: 'updown' },
      bell: { p: 0.1, vol: 0.03, oct: 2 },
    },
    rest: {
      bpm: 54, root: 41, scale: 'lydian', prog: [0, 4, 3, 0], shape: SEVENTH, vol: 0.9,
      pad: { type: 'sine', vol: 0.06, cutoff: 900, att: 3, oct: 1, det: [0, 6] },
      bass: { steps: { 0: 1 }, type: 'sine', vol: 0.1, cutoff: 260, oct: 0, len: 8 },
      arp: { p: 0.22, wave: 'sine', vol: 0.04, oct: 1, send: 0.7, pattern: 'rand' },
      bell: { p: 0.06, vol: 0.03, oct: 2 },
      crackle: { p: 0.3 },
    },
    event: {
      bpm: 64, root: 43, scale: 'harm', prog: [0, 1, 0, 5, 0, 3], shape: TRIAD, vol: 0.9,
      pad: { type: 'sawtooth', vol: 0.018, cutoff: 500, att: 2.5, oct: 1, det: [0, 14, -14] },
      bass: { steps: { 0: 1, 5: 0.5 }, type: 'sine', vol: 0.11, cutoff: 260, oct: 0, len: 5 },
      arp: { p: 0.16, wave: 'sine', vol: 0.04, oct: 2, send: 0.85, pattern: 'rand' },
      wind: { vol: 0.025, f: 400 },
    },
    reward: {
      bpm: 76, root: 48, scale: 'major', prog: [0, 4, 5, 3], shape: TRIAD, vol: 0.9,
      pad: { type: 'triangle', vol: 0.05, cutoff: 1400, att: 1.6, oct: 0, det: [0, 6] },
      bass: { steps: { 0: 1, 4: 0.6 }, type: 'sine', vol: 0.1, cutoff: 280, oct: -1, len: 4 },
      arp: { p: 0.5, wave: 'sine', vol: 0.04, oct: 1, send: 0.55, pattern: 'up' },
    },
    victory: {
      bpm: 80, root: 48, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 3, 0], shape: SEVENTH, vol: 0.95,
      pad: { type: 'triangle', vol: 0.05, cutoff: 1600, att: 1.4, oct: 0, det: [0, 7] },
      bass: { steps: { 0: 1, 4: 0.7 }, type: 'sine', vol: 0.11, cutoff: 320, oct: -1, len: 4 },
      arp: { p: 0.62, wave: 'triangle', vol: 0.038, oct: 1, send: 0.5, pattern: 'up' },
      bell: { p: 0.3, vol: 0.035, oct: 2 },
    },
    defeat: {
      bpm: 48, root: 33, scale: 'minor', prog: [0, 5, 3, 0], shape: TRIAD, vol: 0.9,
      pad: { type: 'sawtooth', vol: 0.03, cutoff: 300, att: 3, oct: 1, det: [0, 10] },
      bass: { steps: { 0: 1 }, type: 'sine', vol: 0.14, cutoff: 200, oct: 0, len: 8 },
      bell: { p: 0.07, vol: 0.03, oct: 1 },
      wind: { vol: 0.03, f: 150 },
    },
  };

  const insts = [];          // live track instances (current + fading out)
  let curKey = null;         // track currently playing (or last requested while no context)
  let musicTimer = null;
  let combatActive = false;
  let combatTier = 'normal';

  function degMidi(c, deg) {
    const s = SCALES[c.scale] || SCALES.minor;
    const n = s.length;
    return c.root + s[((deg % n) + n) % n] + 12 * Math.floor(deg / n);
  }

  function mnote(inst, o) {
    o.m = true;
    o.bus = inst.gain;
    tone(o);
  }

  function padNote(inst, t, midi, len, p) {
    const c = ctx;
    const dets = p.det || [0];
    const g = c.createGain();
    const vol = p.vol / Math.sqrt(dets.length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(p.att, len * 0.5));
    g.gain.setValueAtTime(vol, t + Math.max(len - 2.2, p.att));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const bq = c.createBiquadFilter();
    bq.type = 'lowpass';
    bq.frequency.value = p.cutoff;
    bq.Q.value = 0.5;
    bq.connect(g);
    g.connect(inst.gain);
    for (let i = 0; i < dets.length; i++) {
      const o = c.createOscillator();
      o.type = p.type;
      o.frequency.value = midiHz(midi);
      o.detune.value = dets[i];
      o.connect(bq);
      o.start(t);
      o.stop(t + len + 0.1);
    }
  }

  function bellNote(inst, t, midi, vol) {
    const f = midiHz(midi);
    [1, 2.76, 5.4].forEach((r, i) => mnote(inst, { t, f: f * r, dur: 2.2 - i * 0.6, vol: vol / (1 + i * 1.2), type: 'sine', attack: 0.004, send: 0.7 }));
  }

  function drumHit(inst, kind, t, v) {
    const m = { m: true, bus: inst.gain };
    if (kind === 'kick') {
      tone({ t, f: 150, f2: 42, dur: 0.24, vol: 0.34 * v, type: 'sine', attack: 0.002, m: true, bus: inst.gain });
      noise({ t, dur: 0.02, vol: 0.06 * v, type: 'lowpass', f: 1200, q: 0.6, attack: 0.001, m: true, bus: inst.gain });
    } else if (kind === 'snare') {
      noise({ t, dur: 0.14, vol: 0.14 * v, type: 'bandpass', f: 1900, q: 0.9, attack: 0.002, m: true, bus: inst.gain });
      tone({ t, f: 200, f2: 130, dur: 0.1, vol: 0.1 * v, type: 'triangle', m: true, bus: inst.gain });
    } else if (kind === 'hat') {
      noise({ t, dur: 0.04, vol: 0.05 * v, type: 'highpass', f: 7500, q: 0.6, attack: 0.001, m: true, bus: inst.gain });
    } else if (kind === 'tom') {
      tone({ t, f: 130, f2: 62, dur: 0.38, vol: 0.28 * v, type: 'sine', attack: 0.002, m: true, bus: inst.gain });
    }
    return m;
  }

  function scheduleStep(inst, s, t) {
    const c = inst.cfg;
    const bar = Math.floor(s / 8);
    const pos = s % 8;
    const rootDeg = c.prog[bar % c.prog.length];
    const sd = inst.stepDur;
    const shape = c.shape || TRIAD;

    if (pos === 0 && c.pad) {
      const len = 8 * sd + 1.2;
      shape.forEach((d) => padNote(inst, t, degMidi(c, rootDeg + d) + 12 * (c.pad.oct || 0), len, c.pad));
    }
    if (c.bass && c.bass.steps[pos]) {
      mnote(inst, {
        t, f: midiHz(degMidi(c, rootDeg) + 12 * (c.bass.oct || 0)), dur: sd * (c.bass.len || 1.5), vol: c.bass.vol * c.bass.steps[pos],
        type: c.bass.type, attack: 0.008, filt: { type: 'lowpass', f: c.bass.cutoff, q: 0.8 },
      });
    }
    if (c.arp && Math.random() < (typeof c.arp.p === 'number' ? c.arp.p : 0.3)) {
      const pool = [];
      shape.forEach((d) => { pool.push(rootDeg + d); pool.push(rootDeg + d + 7); });
      if (Math.random() < 0.25) pool.push(rootDeg + 1, rootDeg + 5);
      let idx;
      if (c.arp.pattern === 'up') idx = s % pool.length;
      else if (c.arp.pattern === 'updown') { const n = pool.length * 2 - 2; const k = s % n; idx = k < pool.length ? k : n - k; }
      else idx = (Math.random() * pool.length) | 0;
      const m = degMidi(c, pool[idx]) + 12 * (c.arp.oct || 0);
      const f = midiHz(m);
      if (f > 150 && f < 2400) {
        mnote(inst, {
          t, f, dur: c.arp.wave === 'sine' ? 1.8 : 0.5, vol: c.arp.vol * rnd(0.7, 1.15), type: c.arp.wave, attack: 0.008,
          send: c.arp.send, filt: c.arp.cutoff ? { type: 'lowpass', f: c.arp.cutoff } : null,
        });
      }
    }
    if (c.bell && pos % 2 === 0 && Math.random() < c.bell.p) {
      const m = degMidi(c, rootDeg + shape[(Math.random() * shape.length) | 0]) + 12 * (c.bell.oct || 1);
      if (midiHz(m) < 3000) bellNote(inst, t, m, c.bell.vol);
    }
    if (c.stab && c.stab.steps.indexOf(pos) >= 0) {
      shape.slice(0, 3).forEach((d) => mnote(inst, {
        t, f: midiHz(degMidi(c, rootDeg + d) + 12 * (c.stab.oct || 1)), dur: sd * 1.6, vol: c.stab.vol, type: c.stab.type, attack: 0.01,
        det: [-8, 8], filt: { type: 'lowpass', f: c.stab.cutoff, f2: c.stab.cutoff * 0.4 },
      }));
    }
    if (c.drums) {
      const dv = c.drums.vol || 1;
      const fill = bar % 4 === 3 && pos >= 6;
      ['kick', 'snare', 'hat', 'tom'].forEach((k) => {
        const arr = c.drums[k];
        if (arr && arr.indexOf(pos) >= 0) drumHit(inst, k, t, dv);
      });
      if (fill && c.drums.snare) drumHit(inst, 'snare', t + sd * 0.5, dv * 0.7);
    }
    if (c.crackle && Math.random() < c.crackle.p) {
      noise({ t: t + rnd(0, sd), dur: 0.03, vol: rnd(0.02, 0.05), type: 'highpass', f: rnd(2500, 6000), q: 0.6, m: true, bus: inst.gain });
    }
  }

  function addWind(inst) {
    const w = inst.cfg.wind;
    if (!w || !noiseBuf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = w.f;
      bq.Q.value = 0.9;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.06;
      const lg = ctx.createGain();
      lg.gain.value = w.f * 0.5;
      lfo.connect(lg);
      lg.connect(bq.frequency);
      const g = ctx.createGain();
      g.gain.value = w.vol;
      src.connect(bq);
      bq.connect(g);
      g.connect(inst.gain);
      src.start();
      lfo.start();
      inst.nodes.push(src, lfo);
    } catch (e) { /* ignore */ }
  }

  function spawnInst(key, fade) {
    const cfg = TRACKS[key];
    if (!cfg || !ctx || !musicBus) return null;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(cfg.vol, now + fade);
    g.connect(musicBus);
    const inst = { key, cfg, gain: g, stepDur: 60 / cfg.bpm / 2, step: 0, t: now + 0.12, nodes: [], dead: false, endAt: 0 };
    addWind(inst);
    insts.push(inst);
    ensureMusicTimer();
    return inst;
  }

  function releaseInst(inst, fade) {
    if (inst.dead || inst.endAt) return;
    try {
      const now = ctx.currentTime;
      inst.gain.gain.cancelScheduledValues(now);
      inst.gain.gain.setValueAtTime(Math.max(inst.gain.gain.value, 0.0001), now);
      inst.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
      inst.endAt = now + fade + 0.3;
    } catch (e) { inst.endAt = 1; }
  }

  function killInst(inst) {
    inst.dead = true;
    inst.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } });
    try { inst.gain.disconnect(); } catch (e) { /* ignore */ }
  }

  function musicTick() {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      if (ctx.state !== 'running') return;
      for (let i = insts.length - 1; i >= 0; i--) {
        const inst = insts[i];
        if (inst.endAt) {
          if (now > inst.endAt) { killInst(inst); insts.splice(i, 1); }
          continue;
        }
        // Resync after a starved timer instead of bursting
        if (inst.t < now - 0.25) inst.t = now + 0.05;
        const horizon = now + 0.7;
        let guard = 0;
        while (inst.t < horizon && guard++ < 24) {
          scheduleStep(inst, inst.step, inst.t);
          inst.t += inst.stepDur;
          inst.step++;
        }
      }
      if (!insts.length) stopMusicTimer();
    } catch (e) { /* ignore */ }
  }

  function ensureMusicTimer() {
    if (!musicTimer) musicTimer = setInterval(musicTick, 100);
  }
  function stopMusicTimer() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  // Crossfade to a track (null stops all music). Safe to call before the context exists.
  let wantKey = null;
  function setTrack(key, fade) {
    wantKey = key;
    if (!ctx || !musicOn) return;
    if (key === curKey && insts.some((i) => !i.endAt && i.key === key)) return;
    const f = fade || 1.6;
    insts.forEach((i) => releaseInst(i, f));
    curKey = key;
    if (key && TRACKS[key]) spawnInst(key, f);
  }

  function startMusic() {
    if (!ctx) return;
    applyMusic();
    if (!musicOn) return;
    syncMusic(true);
  }

  function setMusicOn(on, persist) {
    const was = musicOn;
    musicOn = !!on;
    if (persist !== false) {
      lsSet(LS_MUSIC, musicOn ? '1' : '0');
      sSet('music', musicOn);
    }
    if (!ctx) {
      ensureCtx();
      return;
    }
    applyMusic();
    if (musicOn && !was) {
      curKey = null;
      syncMusic(true);
    } else if (!musicOn) {
      insts.forEach((i) => releaseInst(i, 0.6));
      curKey = null;
    }
  }

  // Which track fits the game right now
  function desiredTrack() {
    if (combatActive) return 'combat_' + combatTier;
    const ui = DS.ui || {};
    const cur = ui.current;
    const act = clamp(Number(DS.run && DS.run.act) || 1, 1, 3);
    switch (cur) {
      case 'menu': case 'charselect': case 'compendium': case 'history': case 'settings': case 'howto': return 'menu';
      case 'map': return 'map' + act;
      case 'combat': return curKey && curKey.indexOf('combat_') === 0 ? curKey : 'combat_normal';
      case 'shop': return 'shop';
      case 'rest': case 'treasure': return 'rest';
      case 'event': return 'event';
      case 'reward': case 'bossrelic': return 'reward';
      case 'victory': return 'victory';
      case 'gameover': return 'defeat';
      default: return curKey || (cur ? 'menu' : null);
    }
  }

  function syncMusic(force) {
    try {
      if (!ctx || !musicOn || failed) return;
      const key = desiredTrack();
      if (!key) return;
      if (force || key !== curKey) setTrack(key, 1.6);
    } catch (e) { /* ignore */ }
  }

  function tierOf(p) {
    let tier = null;
    try { tier = (p && p.combat && p.combat.encounter && p.combat.encounter.tier) || (DS.combat && DS.combat.encounter && DS.combat.encounter.tier); } catch (e) { /* ignore */ }
    return tier === 'boss' ? 'boss' : tier === 'elite' ? 'elite' : 'normal';
  }

  // ---------------------------------------------------------------------------
  // Gesture unlock, page visibility, and delegated UI sounds
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

  try {
    if (typeof document !== 'undefined' && document && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        try {
          if (!ctx) return;
          if (document.hidden) {
            if (ctx.state === 'running') { suspendedByUs = true; ctx.suspend(); }
          } else if (suspendedByUs) {
            suspendedByUs = false;
            const p = ctx.resume();
            if (p && p.catch) p.catch(() => {});
          }
        } catch (e) { /* ignore */ }
      });

      document.addEventListener('click', (e) => {
        try {
          let t = e.target;
          if (!t) return;
          if (t.nodeType === 3) t = t.parentElement;
          if (!t || !t.closest) return;
          if (t.closest('.ds-btn') || t.closest('.ds-choice') || t.closest('.ds-map-node') || t.closest('.ds-tab')) play('click');
          else if (t.closest('.ds-card')) play('select');
        } catch (err) { /* ignore */ }
      }, true);

      // Hover tick when the pointer enters a new interactive element
      document.addEventListener('mouseover', (e) => {
        try {
          let t = e.target;
          if (!t) return;
          if (t.nodeType === 3) t = t.parentElement;
          if (!t || !t.closest) return;
          const sel = '.ds-btn,.ds-choice,.ds-map-node,.ds-card,.ds-tab';
          const to = t.closest(sel);
          if (!to) return;
          const from = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(sel) : null;
          if (from === to) return;
          if (to.disabled || to.getAttribute('aria-disabled') === 'true') return;
          play(to.classList.contains('ds-card') ? 'card_flick' : 'hover');
        } catch (err) { /* ignore */ }
      }, true);
    }
  } catch (e) { /* ignore */ }

  // Keep the music in step with screen changes
  try {
    setInterval(() => syncMusic(false), 500);
    if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
      const attach = () => {
        const app = document.getElementById('app');
        if (!app) return;
        new MutationObserver(() => { syncMusic(false); setTimeout(() => syncMusic(false), 200); }).observe(app, { childList: true });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
      else attach();
    }
  } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------------------
  // Self-wiring to DS.events
  // ---------------------------------------------------------------------------
  function sub(name, fn) {
    try {
      if (DS.events && typeof DS.events.on === 'function') DS.events.on(name, (p) => { try { fn(p); } catch (e) { /* ignore */ } });
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
    const card = p && p.card;
    const type = cardTypeOf(card);
    const f = cardFlavor(card);
    lastCard = { f, t: Date.now() };
    play(CARD_SFX[type] || 'card_skill', type === 'attack' ? f : undefined);
  });

  sub('combat:enemyMove', (p) => {
    if (!p || !p.enemy) return;
    enemyFx.set(p.enemy.uid, enemyFlavor(p.enemy, p.move));
    if (enemyFx.size > 30) enemyFx.delete(enemyFx.keys().next().value);
    const intent = p.move && p.move.intent;
    if (!intent || /attack/.test(intent)) play('enemy_swing');
  });

  sub('combat:damage', (p) => {
    if (!p || !p.target) return;
    const amt = Number(p.amount) || 0;
    const blk = Number(p.blocked) || 0;
    const player = !!(p.target.isPlayer || p.target.uid === 'player');
    if (amt > 0) {
      const selfInflicted = !p.source || p.source.uid === p.target.uid;
      if (selfInflicted) {
        const burning = !!(p.target.statuses && p.target.statuses.burn > 0);
        play('tick', burning ? 'burn' : 'poison');
      } else {
        let f = 'slash';
        if (p.source.isPlayer || p.source.uid === 'player') f = Date.now() - lastCard.t < 4000 ? lastCard.f : 'slash';
        else if (enemyFx.has(p.source.uid)) f = enemyFx.get(p.source.uid);
        play('hit', { d: amt, f, p: player });
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
    if (p.status === 'burn') { play('ignite'); return; }
    play(isDebuff ? 'debuff' : 'buff', p.status);
  });

  sub('combat:enemyDied', (p) => {
    const tier = p && p.enemy && p.enemy.def && p.enemy.def.tier;
    play('enemy_death', tier);
  });
  sub('combat:shuffle', () => play('shuffle'));
  sub('combat:cardDrawn', () => play('draw'));
  sub('combat:cardExhausted', () => play('exhaust'));
  sub('combat:potionUsed', () => play('potion'));

  sub('combat:start', (p) => {
    const tier = tierOf(p);
    combatActive = true;
    combatTier = tier;
    lastCard = { f: 'slash', t: 0 };
    enemyFx.clear();
    play(tier === 'boss' ? 'boss_intro' : tier === 'elite' ? 'elite_intro' : 'combat_start');
    if (ctx) setTrack('combat_' + tier, tier === 'boss' ? 2.2 : 1.2);
    else wantKey = 'combat_' + tier;
  });

  sub('combat:turnStart', (p) => {
    if (p && p.side === 'player' && Number(p.turn) > 1) play('turn_start');
  });

  sub('combat:end', (p) => {
    const result = p && p.result;
    combatActive = false;
    if (result === 'lost') { play('defeat'); return; }
    if (result === 'won') {
      let boss = false;
      try { boss = combatTier === 'boss' || !!(DS.combat && DS.combat.encounter && DS.combat.encounter.tier === 'boss'); } catch (e) { /* ignore */ }
      play(boss ? 'victory' : 'win');
    }
  });

  sub('run:gold', (p) => {
    const amt = Number(p && p.amount) || 0;
    if (amt > 0) play('gold', amt);
    else if (amt < 0) play('spend');
  });
  sub('run:relic', () => play('relic'));
  sub('run:card', () => play('add_card'));
  sub('meta:achievement', () => play('achievement'));

  sub('settings:update', (p) => {
    if (!p) return;
    const k = p.key;
    const v = p.value;
    if (k === 'volume') { const n = Number(v); if (!isNaN(n)) { volume = clamp(n, 0, 1); applyVolume(); } }
    else if (k === 'muted') { muted = v === true || v === '1' || v === 1; applyVolume(); }
    else if (k === 'music') { const on = !(v === false || v === 0 || v === '0'); if (on !== musicOn) setMusicOn(on, false); }
    else if (k === 'sfxVolume') { const n = Number(v); if (!isNaN(n)) { sfxVol = clamp(n, 0, 1); applyVolume(); } }
    else if (k === 'musicVolume') { const n = Number(v); if (!isNaN(n)) { musVol = clamp(n, 0, 1); applyMusic(); } }
  });

  // ---------------------------------------------------------------------------
  // Public API (compatible with the original surface)
  // ---------------------------------------------------------------------------
  function setMuted(b) {
    muted = !!b;
    lsSet(LS_MUTE, muted ? '1' : '0');
    sSet('muted', muted);
    applyVolume();
  }

  function setVolume(v) {
    const n = Number(v);
    volume = clamp(isNaN(n) ? 0.7 : n, 0, 1);
    lsSet(LS_VOL, volume.toFixed(2));
    sSet('volume', volume);
    applyVolume();
  }

  function setSfxVolume(v) {
    const n = Number(v);
    sfxVol = clamp(isNaN(n) ? 1 : n, 0, 1);
    sSet('sfxVolume', sfxVol);
    applyVolume();
  }

  function setMusicVolume(v) {
    const n = Number(v);
    musVol = clamp(isNaN(n) ? 1 : n, 0, 1);
    sSet('musicVolume', musVol);
    applyMusic();
  }

  DS.audio = {
    play,
    setMuted,
    setVolume,
    setSfxVolume,
    setMusicVolume,
    setMusic(on) { setMusicOn(on, true); },
    /** Force a music track by name (see .tracks); pass null to return to automatic selection. */
    setTrack(name) { if (name && !TRACKS[name]) return; if (name) { setTrack(name, 1.6); } else { syncMusic(true); } },
    duck,
    /** Call from a user gesture if you want audio ready before the first click. */
    unlock() { gestureSeen = true; return ensureCtx() !== null; },
    get muted() { return muted; },
    set muted(v) { setMuted(v); },
    get volume() { return volume; },
    set volume(v) { setVolume(v); },
    get sfxVolume() { return sfxVol; },
    set sfxVolume(v) { setSfxVolume(v); },
    get musicVolume() { return musVol; },
    set musicVolume(v) { setMusicVolume(v); },
    get music() { return musicOn; },
    set music(v) { setMusicOn(v, true); },
    get ready() { return !!ctx; },
    get track() { return curKey; },
    get voices() { return voices; },
    sounds: Object.keys(SOUNDS),
    tracks: Object.keys(TRACKS),
  };
})();
