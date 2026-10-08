(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // Injected stylesheet: keyframes and classes for every effect in this file.
  // Shakes use the individual `translate` / `scale` properties so they never
  // fight with transforms that the combat layout sets on units.
  // ---------------------------------------------------------------------------
  const STYLE_ID = 'ds-fx-style';
  const CSS_TEXT = `
.ds-float{position:fixed;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none;z-index:1000;
  font-weight:900;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.7),0 0 10px rgba(0,0,0,.5);
  animation:ds-float-up 950ms ease-out both;}
.ds-float-damage{color:#ff6b5b;font-size:26px}
.ds-float-big{color:#ffb347;text-shadow:0 0 14px rgba(255,120,40,.85),0 2px 0 rgba(0,0,0,.7)}
.ds-float-tick{color:#c08cff;font-size:20px}
.ds-float-blocked{color:#8fd0ff;font-size:20px;font-weight:800}
.ds-float-block{color:#7fbfff;font-size:26px}
.ds-float-heal{color:#7dff9b;font-size:26px}
.ds-float-gold{color:#ffd65a;font-size:22px}
.ds-float-small{font-size:14px !important}
.ds-float-status{font-size:15px;font-weight:800;padding:1px 7px;border-radius:999px;background:rgba(10,8,14,.55);
  text-shadow:none;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.ds-float-buff{color:#ffe08a}
.ds-float-debuff{color:#e88cff}
@keyframes ds-float-up{
  0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}
  15%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}
  30%{transform:translate(-50%,-50%) scale(1)}
  100%{opacity:0;transform:translate(-50%,calc(-50% - 70px)) scale(1)}
}
.ds-shake{animation:ds-shake-anim 360ms ease-in-out both}
@keyframes ds-shake-anim{
  0%,100%{translate:0 0} 15%{translate:-7px 2px} 30%{translate:6px -2px}
  45%{translate:-5px 1px} 60%{translate:4px 0} 75%{translate:-2px 1px}
}
.ds-wobble{animation:ds-wobble-anim 240ms ease-in-out both}
@keyframes ds-wobble-anim{0%,100%{translate:0 0} 33%{translate:-3px 0} 66%{translate:3px 0}}
.ds-hitflash{animation:ds-hitflash-anim 220ms ease-out both}
@keyframes ds-hitflash-anim{0%{filter:brightness(2.4) saturate(.5)} 100%{filter:none}}
.ds-dying{animation:ds-dying-anim .65s ease-in both;pointer-events:none}
@keyframes ds-dying-anim{
  0%{opacity:1;filter:none;scale:1}
  35%{opacity:.9;filter:brightness(1.8)}
  100%{opacity:0;filter:grayscale(1) blur(2px);scale:.6}
}
#app.ds-screen-shake{animation:ds-screen-anim 300ms linear both}
#app.ds-screen-shake-big{animation:ds-screen-big-anim 520ms linear both}
@keyframes ds-screen-anim{
  0%,100%{translate:0 0} 20%{translate:-4px 3px} 40%{translate:4px -3px} 60%{translate:-3px -2px} 80%{translate:2px 2px}
}
@keyframes ds-screen-big-anim{
  0%,100%{translate:0 0} 10%{translate:-12px 6px} 20%{translate:11px -7px} 32%{translate:-10px -4px}
  46%{translate:8px 5px} 60%{translate:-6px 3px} 75%{translate:4px -2px} 90%{translate:-2px 1px}
}
.ds-flash{position:fixed;inset:0;pointer-events:none;z-index:998;animation:ds-flash-anim .5s ease-out both}
.ds-flash-red{background:radial-gradient(ellipse at center,rgba(255,40,40,0) 35%,rgba(200,20,30,.55) 100%)}
.ds-flash-strong{background:radial-gradient(ellipse at center,rgba(255,40,40,.08) 20%,rgba(220,20,30,.7) 100%)}
.ds-flash-gold{background:radial-gradient(ellipse at center,rgba(255,220,120,.05) 30%,rgba(255,200,90,.35) 100%)}
@keyframes ds-flash-anim{0%{opacity:1}100%{opacity:0}}
.ds-darken{position:fixed;inset:0;background:#000;pointer-events:none;z-index:997;animation:ds-darken-anim 1.8s ease-in-out both}
@keyframes ds-darken-anim{0%{opacity:0}70%{opacity:.8}100%{opacity:0}}
.ds-slash{position:fixed;height:6px;border-radius:4px;transform:translate(-50%,-50%) rotate(var(--rot,0deg));
  background:linear-gradient(90deg,transparent,#fff7d8 40%,#ff9a5a 70%,transparent);
  box-shadow:0 0 14px #ff8a4a,0 0 4px #fff;pointer-events:none;z-index:1000;animation:ds-slash-anim 360ms ease-out both;}
@keyframes ds-slash-anim{
  0%{opacity:1;clip-path:inset(0 100% 0 0)}
  45%{opacity:1;clip-path:inset(0 0 0 0)}
  100%{opacity:0;clip-path:inset(0 0 0 0)}
}
.ds-glow{position:fixed;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:990;
  background:radial-gradient(circle,var(--gc,#ffffff) 0%,transparent 66%);mix-blend-mode:screen;
  animation:ds-glow-anim .7s ease-out both;}
@keyframes ds-glow-anim{0%{opacity:0;scale:.4}30%{opacity:.9}100%{opacity:0;scale:1.3}}
.ds-burst{position:fixed;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:1000;
  animation:ds-burst-anim 700ms ease-out both;}
.ds-burst-glyph{background:none !important;border-radius:0;width:auto !important;height:auto !important;
  font-size:18px;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.6);}
@keyframes ds-burst-anim{
  0%{opacity:1;transform:translate(-50%,-50%) scale(1)}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),calc(-50% + var(--dy,0px))) scale(.3)}
}
@media (prefers-reduced-motion: reduce){
  .ds-shake,.ds-wobble,#app.ds-screen-shake,#app.ds-screen-shake-big{animation:none}
}
`;

  // ---------------------------------------------------------------------------
  // DOM helpers. Everything here is a no-op when there is no document.
  // ---------------------------------------------------------------------------
  const MAX_NODES = 240;   // soft cap on floating nodes in #overlay
  const anchorCache = new Map(); // uid -> last known rect centre (for units that vanish on death)

  function hasDom() {
    return typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function ensureStyle() {
    try {
      if (!hasDom() || document.getElementById(STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = CSS_TEXT;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { /* ignore */ }
  }

  function overlay() {
    if (!hasDom()) return null;
    try {
      return document.getElementById('overlay') || document.body || null;
    } catch (e) {
      return null;
    }
  }

  function mk(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = String(text);
    return el;
  }

  // Appends el to #overlay and removes it after ms. Returns el or null.
  function addNode(el, ms) {
    const root = overlay();
    if (!root) return null;
    if (root.childElementCount > MAX_NODES) return null;
    try {
      root.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (e) { /* ignore */ } }, ms + 60);
    } catch (e) { return null; }
    return el;
  }

  // Restart a class (so a CSS animation replays), removing it again after ms
  function restartClass(el, cls, ms) {
    try {
      if (!el || !el.classList) return;
      el.classList.remove(cls);
      void el.offsetWidth; // force reflow so the animation restarts
      el.classList.add(cls);
      const timers = el.__dsFxTimers || (el.__dsFxTimers = {});
      clearTimeout(timers[cls]);
      timers[cls] = setTimeout(() => { try { el.classList.remove(cls); } catch (e) { /* ignore */ } }, ms);
    } catch (e) { /* ignore */ }
  }

  // Web Animations for anything on a combat unit or #app. combat_ui rewrites unit
  // classNames on every update, which would wipe a CSS animation class mid-play;
  // a running Web Animation is untouched by className changes. Keyed per element
  // so a new hit cancels the previous shake on that element. Returns null when
  // the API is missing, so callers can fall back to restartClass.
  function animateEl(el, key, frames, ms, easing, fill) {
    try {
      if (!el || typeof el.animate !== 'function') return null;
      const map = el.__dsFxAnims || (el.__dsFxAnims = {});
      if (map[key]) { try { map[key].cancel(); } catch (e) { /* ignore */ } }
      const anim = el.animate(frames, { duration: ms, easing: easing || 'ease-in-out', fill: fill || 'none' });
      map[key] = anim;
      anim.onfinish = () => { if (map[key] === anim) delete map[key]; };
      return anim;
    } catch (e) {
      return null;
    }
  }

  const SHAKE_FRAMES = [
    { translate: '0px 0px' }, { translate: '-7px 2px' }, { translate: '6px -2px' },
    { translate: '-5px 1px' }, { translate: '4px 0px' }, { translate: '-2px 1px' }, { translate: '0px 0px' },
  ];
  const WOBBLE_FRAMES = [
    { translate: '0px 0px' }, { translate: '-3px 0px' }, { translate: '3px 0px' }, { translate: '0px 0px' },
  ];
  const HITFLASH_FRAMES = [
    { filter: 'brightness(2.4) saturate(0.5)' }, { filter: 'brightness(1) saturate(1)' },
  ];
  // Ends on the same look as .ds-enemy-dead so the unit does not pop when the class lands
  const DYING_FRAMES = [
    { opacity: 1, filter: 'grayscale(0) brightness(1)', scale: '1' },
    { opacity: 0.85, filter: 'brightness(1.9) grayscale(0.5)', scale: '0.96', offset: 0.35 },
    { opacity: 0.3, filter: 'grayscale(1)', scale: '0.8' },
  ];
  const SCREEN_SMALL = [
    { translate: '0px 0px' }, { translate: '-4px 3px' }, { translate: '4px -3px' },
    { translate: '-3px -2px' }, { translate: '2px 2px' }, { translate: '0px 0px' },
  ];
  const SCREEN_BIG = [
    { translate: '0px 0px' }, { translate: '-12px 6px' }, { translate: '11px -7px' },
    { translate: '-10px -4px' }, { translate: '8px 5px' }, { translate: '-6px 3px' },
    { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0px 0px' },
  ];

  function findEl(uid) {
    if (!hasDom() || uid == null) return null;
    try {
      const s = String(uid);
      const esc = (typeof CSS !== 'undefined' && CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
      return document.querySelector('[data-combatant="' + esc + '"]');
    } catch (e) {
      return null;
    }
  }

  function isPlayerUnit(u) {
    return !!u && (u.isPlayer === true || u.uid === 'player');
  }

  // Centre point and size of a unit element; remembers it for later (death puffs)
  function anchorOf(uid) {
    const key = String(uid);
    const el = findEl(uid);
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        const a = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
        anchorCache.set(key, a);
        return a;
      }
    }
    const c = anchorCache.get(key);
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  }

  function viewportCentre() {
    const w = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const h = (typeof window !== 'undefined' && window.innerHeight) || 720;
    return { x: w / 2, y: h * 0.4, w: 0, h: 0 };
  }

  function anchorOrFallback(uid) {
    if (!hasDom()) return null;
    return anchorOf(uid) || anchorOf('player') || viewportCentre();
  }

  function cardTypeOf(card) {
    if (!card) return null;
    if (card.data && card.data.type) return card.data.type;
    try {
      const def = DS.cards && card.id ? DS.cards[card.id] : null;
      if (def && def.type) return def.type;
    } catch (e) { /* ignore */ }
    return card.type || null;
  }

  // ---------------------------------------------------------------------------
  // Primitives
  // ---------------------------------------------------------------------------
  // Floating text anchored at point a. opts: {size, dy, jx, delay, life, cls}
  function floatText(a, text, cls, opts) {
    const o = opts || {};
    const el = mk('div', 'ds-float ' + cls, text);
    const jx = o.jx != null ? o.jx : (Math.random() * 2 - 1) * 22;
    el.style.left = (a.x + jx) + 'px';
    el.style.top = (a.y + (o.dy || 0)) + 'px';
    if (o.size) el.style.fontSize = o.size + 'px';
    const life = o.life || 950;
    el.style.animationDuration = life + 'ms';
    if (o.delay) el.style.animationDelay = o.delay + 'ms';
    return addNode(el, life + (o.delay || 0));
  }

  // Burst of particles from a point. o: {n, spread, rise, colors, glyphs, life}
  function burst(a, o) {
    const n = o.n || 10;
    const spread = o.spread || 70;
    const life = o.life || 700;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (0.4 + Math.random() * 0.8);
      const glyph = o.glyphs ? pick(o.glyphs) : null;
      const p = mk('div', 'ds-burst' + (glyph ? ' ds-burst-glyph' : ''), glyph);
      const spanX = a.w ? Math.min(a.w, 120) * 0.4 : 0;
      const spanY = a.h ? Math.min(a.h, 120) * 0.4 : 0;
      p.style.left = (a.x + (Math.random() - 0.5) * spanX) + 'px';
      p.style.top = (a.y + (Math.random() - 0.5) * spanY) + 'px';
      p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist - (o.rise || 0)).toFixed(1) + 'px');
      if (glyph) {
        if (o.textColor) p.style.color = o.textColor;
      } else {
        const sz = o.size ? o.size * (0.6 + Math.random() * 0.8) : 4 + Math.random() * 7;
        p.style.width = sz + 'px';
        p.style.height = sz + 'px';
        p.style.background = pick(o.colors || ['#ffffff']);
        p.style.boxShadow = '0 0 6px ' + (o.glow || 'rgba(255,255,255,.6)');
      }
      const dur = life * (0.7 + Math.random() * 0.6);
      p.style.animationDuration = dur + 'ms';
      if (o.stagger) p.style.animationDelay = (Math.random() * o.stagger) + 'ms';
      addNode(p, dur + (o.stagger || 0) + 40);
    }
  }

  function glowAt(a, colour, scale) {
    if (!a) return;
    const el = mk('div', 'ds-glow');
    const d = Math.max(a.w || 0, a.h || 0, 60) * (scale || 1.4);
    el.style.width = d + 'px';
    el.style.height = d + 'px';
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
    el.style.setProperty('--gc', colour);
    addNode(el, 720);
  }

  function slashAt(a) {
    const s = mk('div', 'ds-slash');
    const len = clamp(a.w * 0.95, 70, 260);
    const ang = Math.random() * 40 - 20 - 28; // diagonal slash, slightly jittered
    s.style.left = a.x + 'px';
    s.style.top = a.y + 'px';
    s.style.width = len + 'px';
    s.style.setProperty('--rot', ang + 'deg');
    addNode(s, 400);
    burst(a, { n: 7, spread: 75, colors: ['#fff7d8', '#ffffff', '#ffb070'], glow: 'rgba(255,160,90,.9)', life: 420 });
  }

  function screenShake(big) {
    const app = hasDom() ? document.getElementById('app') : null;
    if (!app) return;
    const ms = big ? 520 : 300;
    if (!animateEl(app, 'screen', big ? SCREEN_BIG : SCREEN_SMALL, ms, 'linear')) {
      restartClass(app, big ? 'ds-screen-shake-big' : 'ds-screen-shake', ms);
    }
  }

  function flash(kind, ms) {
    const el = mk('div', 'ds-flash ds-flash-' + kind);
    if (ms) el.style.animationDuration = ms + 'ms';
    addNode(el, ms || 500);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onDamage(p) {
    if (!hasDom() || !p || !p.target) return;
    const amt = Math.max(0, Math.round(Number(p.amount) || 0));
    const blk = Math.max(0, Math.round(Number(p.blocked) || 0));
    const target = p.target;
    const uid = target.uid;
    if (uid == null) return;
    const a = anchorOrFallback(uid);
    const player = isPlayerUnit(target);
    const selfInflicted = !p.source || p.source.uid === uid;

    if (amt > 0) {
      if (selfInflicted) {
        // Poison / burn / other HP loss with no attacker: smaller purple number
        floatText(a, '-' + amt, 'ds-float-tick', { size: clamp(18 + amt * 0.6, 18, 30), dy: a.h * 0.1 });
      } else {
        const size = clamp(22 + amt * 1.1, 22, 58);
        floatText(a, '-' + amt, 'ds-float-damage' + (amt >= 15 ? ' ds-float-big' : ''), { size, dy: -a.h * 0.15 });
      }
      if (blk > 0) {
        floatText(a, '🛡' + blk, 'ds-float-blocked ds-float-small', { dy: -a.h * 0.15 + 30, jx: 36, delay: 90 });
      }
      const el = findEl(uid);
      if (el && !animateEl(el, 'shake', SHAKE_FRAMES, 360)) restartClass(el, 'ds-shake', 360);
      if (el && !animateEl(el, 'flash', HITFLASH_FRAMES, 220)) restartClass(el, 'ds-hitflash', 220);
      if (player) {
        if (amt >= 8) screenShake(amt >= 18);
        if (amt >= 6) flash(amt >= 18 ? 'strong' : 'red', amt >= 18 ? 650 : 480);
      } else if (amt >= 10) {
        burst(a, {
          n: amt >= 20 ? 12 : 6, spread: 60, colors: ['#ffd9a0', '#ff8a5c', '#ffffff'],
          glow: 'rgba(255,140,80,.9)', life: 380,
        });
      }
    } else if (blk > 0) {
      floatText(a, 'Blocked', 'ds-float-blocked', { size: 20 });
      const wel = findEl(uid);
      if (wel && !animateEl(wel, 'wobble', WOBBLE_FRAMES, 240)) restartClass(wel, 'ds-wobble', 240);
    }
  }

  function onBlock(p) {
    if (!hasDom() || !p || !p.target || !(Number(p.amount) > 0)) return;
    const uid = p.target.uid;
    if (uid == null) return;
    const a = anchorOrFallback(uid);
    floatText(a, '+' + p.amount, 'ds-float-block', { size: 26, dy: -a.h * 0.25 });
    glowAt(a, 'rgba(120,180,255,.85)', 1.1);
    burst(a, {
      n: 6, spread: 55, colors: ['#bfe0ff', '#7fb8ff'], size: 5,
      glow: 'rgba(120,180,255,.8)', life: 500,
    });
  }

  function onHeal(p) {
    if (!hasDom() || !p || !p.target) return;
    const amt = Math.round(Number(p.amount) || 0);
    const uid = p.target.uid;
    if (amt <= 0 || uid == null) return;
    const a = anchorOrFallback(uid);
    floatText(a, '+' + amt, 'ds-float-heal', { size: clamp(22 + amt * 0.8, 22, 40), dy: -a.h * 0.2 });
    glowAt(a, 'rgba(110,255,150,.8)', 1.2);
    burst(a, {
      glyphs: ['✚', '+'], textColor: '#8dffa8', n: 6, spread: 45, rise: 60, life: 800, stagger: 150,
    });
  }

  function onStatus(p) {
    if (!hasDom() || !p || !p.target) return;
    const uid = p.target.uid;
    if (uid == null) return;
    const amt = Number(p.amount) || 0;
    const def = DS.statuses ? DS.statuses[p.status] : null;
    const icon = (def && def.icon) || '✦';
    const name = (def && def.name) || String(p.status || '');
    const isDebuff = !!def && def.type === 'debuff';
    const boolean = !!def && def.stacks === false;
    const signed = (amt > 0 ? '+' : '') + amt;
    const text = boolean || amt === 0 ? icon + ' ' + name : icon + ' ' + name + ' ' + signed;
    const a = anchorOrFallback(uid);
    floatText(a, text, 'ds-float-status ' + (isDebuff ? 'ds-float-debuff' : 'ds-float-buff'), {
      size: 15, dy: a.h * 0.22, jx: (Math.random() * 2 - 1) * 30, life: 1000,
    });
  }

  function onEnemyDied(p) {
    if (!hasDom() || !p || !p.enemy) return;
    const uid = p.enemy.uid;
    if (uid == null) return;
    const a = anchorOrFallback(uid);
    const el = findEl(uid);
    if (el) {
      try { el.style.pointerEvents = 'none'; } catch (e) { /* ignore */ }
      if (!animateEl(el, 'dying', DYING_FRAMES, 650, 'ease-in', 'forwards') && el.classList) {
        el.classList.add('ds-dying');
      }
    }
    // Dark smoke puff drifting up and out
    burst(a, {
      n: 18, spread: 90, rise: 30, size: 9, stagger: 120, life: 800,
      colors: ['#5b4b6b', '#3a2f44', '#8f7aa6', '#c9b8d9'], glow: 'rgba(160,130,200,.5)',
    });
    burst(a, { glyphs: ['💨', '✦'], n: 6, spread: 80, rise: 40, life: 800, stagger: 100 });
  }

  function onCardPlayed(p) {
    if (!hasDom()) return;
    const type = cardTypeOf(p && p.card) || 'skill';
    const tgt = p && p.target;
    if (type === 'attack') {
      if (tgt && tgt.uid != null) {
        slashAt(anchorOrFallback(tgt.uid));
      } else {
        // Multi-target attack: slash each enemy on screen (capped)
        const els = document.querySelectorAll('[data-combatant]');
        let n = 0;
        for (let i = 0; i < els.length && n < 5; i++) {
          const uid = els[i].getAttribute('data-combatant');
          if (uid == null || uid === 'player') continue;
          const a = anchorOf(uid);
          if (a) { slashAt(a); n++; }
        }
      }
      return;
    }
    const a = anchorOrFallback('player');
    if (type === 'power') {
      glowAt(a, 'rgba(255,214,110,.85)', 1.5);
      burst(a, {
        n: 10, spread: 80, colors: ['#ffe39a', '#fff3c4', '#ffc857'],
        glow: 'rgba(255,220,120,.9)', life: 650,
      });
    } else if (type === 'curse' || type === 'status') {
      glowAt(a, 'rgba(150,60,200,.85)', 1.4);
      burst(a, { glyphs: ['✶', '✧'], textColor: '#c79bff', n: 6, spread: 70, life: 700 });
    } else {
      glowAt(a, 'rgba(100,230,220,.8)', 1.3);
      burst(a, {
        n: 6, spread: 60, colors: ['#bffcf6', '#7ef0e4'],
        glow: 'rgba(120,255,240,.8)', life: 500,
      });
    }
  }

  // Where gold coins should appear: the gold readout if present, else the top bar
  function goldAnchor() {
    try {
      const el = document.querySelector('.ds-gold, [data-stat="gold"]');
      if (el && el.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      }
    } catch (e) { /* ignore */ }
    try {
      const bar = document.getElementById('topbar');
      if (bar && bar.getBoundingClientRect) {
        const r = bar.getBoundingClientRect();
        if (r.width > 0) return { x: r.left + r.width * 0.3, y: r.top + r.height / 2, w: 40, h: 20 };
      }
    } catch (e) { /* ignore */ }
    return { x: 120, y: 30, w: 40, h: 20 };
  }

  function onGold(p) {
    if (!hasDom() || !p) return;
    const amt = Math.round(Number(p.amount) || 0);
    if (amt <= 0) return;
    const a = goldAnchor();
    const n = clamp(Math.round(amt / 4), 4, 12);
    burst(a, { glyphs: ['🪙'], n, spread: 90, rise: 70, life: 820, stagger: 160 });
    floatText(a, '+' + amt, 'ds-float-gold', { size: 22, dy: 26, jx: 0, life: 900 });
  }

  // Turn banners are owned by combat_ui.js (they sit inside the combat screen), so fx.js does not draw its own.

  function onCombatEnd(p) {
    if (!hasDom() || !p) return;
    if (p.result === 'lost') addNode(mk('div', 'ds-darken'), 1800);
    else if (p.result === 'won') flash('gold', 500);
  }

  // ---------------------------------------------------------------------------
  // Self-wiring. Each handler is isolated so one failure never reaches the game.
  // ---------------------------------------------------------------------------
  function sub(name, fn) {
    try {
      if (!DS.events || typeof DS.events.on !== 'function') return;
      DS.events.on(name, (p) => {
        try {
          ensureStyle();
          fn(p);
        } catch (e) { /* visual flourish must never throw */ }
      });
    } catch (e) { /* ignore */ }
  }

  sub('combat:damage', onDamage);
  sub('combat:block', onBlock);
  sub('combat:heal', onHeal);
  sub('combat:status', onStatus);
  sub('combat:enemyDied', onEnemyDied);
  sub('combat:cardPlayed', onCardPlayed);
  sub('combat:end', onCombatEnd);
  sub('run:gold', onGold);

  ensureStyle();

  // Small public helper surface, for other UI code that wants the same juice
  DS.fx = {
    floatAt(uid, text, cls) {
      if (!hasDom()) return;
      const a = anchorOrFallback(uid);
      if (a) floatText(a, String(text), cls || 'ds-float-damage', { size: 24, dy: -a.h * 0.15 });
    },
    flash(kind, ms) { if (hasDom()) flash(kind || 'red', ms || 480); },
    screenShake(big) { if (hasDom()) screenShake(!!big); },
    burst(uid, opts) { if (hasDom()) { const a = anchorOrFallback(uid); if (a) burst(a, opts || {}); } },
  };
})();
