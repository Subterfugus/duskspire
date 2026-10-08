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
@keyframes ds-flash-anim{0%{opacity:var(--fo,1)}100%{opacity:0}}
.ds-num{position:fixed;left:0;top:0;pointer-events:none;z-index:1001;font-weight:900;white-space:nowrap;
  font-family:inherit;letter-spacing:.5px;text-shadow:0 2px 0 rgba(0,0,0,.75),0 0 12px rgba(0,0,0,.55);
  transform:translate(-50%,-50%);will-change:transform,opacity}
.ds-num-crit{-webkit-text-stroke:1.5px rgba(90,25,0,.9);text-shadow:0 0 18px rgba(255,170,40,.95),0 3px 0 rgba(0,0,0,.8)}
.ds-num-sm{font-size:14px;font-weight:800}
.ds-pop-icon{position:fixed;left:0;top:0;pointer-events:none;z-index:1001;font-size:34px;line-height:1;
  transform:translate(-50%,-50%);filter:drop-shadow(0 0 8px var(--pc,#fff)) drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.ds-rays{position:fixed;left:50%;top:46%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;pointer-events:none;z-index:995;
  background:repeating-conic-gradient(from 0deg,rgba(255,225,140,.34) 0deg 6deg,rgba(255,225,140,0) 6deg 18deg);
  -webkit-mask-image:radial-gradient(circle,#000 0%,transparent 42%);mask-image:radial-gradient(circle,#000 0%,transparent 42%);
  animation:ds-rays-anim 1300ms ease-out both;mix-blend-mode:screen}
@keyframes ds-rays-anim{0%{opacity:0;transform:rotate(0deg) scale(.3)}25%{opacity:1}100%{opacity:0;transform:rotate(38deg) scale(1)}}
.ds-ghost{position:fixed;left:0;top:0;pointer-events:none;z-index:999;will-change:transform,opacity}
.ds-ghost-in{position:absolute;left:0;top:0;transform:translate(-50%,-50%) scale(.55);transform-origin:center;margin:0 !important;
  box-shadow:0 0 22px var(--gc,#9cf)}
.ds-ghost-fallback{min-width:110px;padding:14px 10px;border-radius:10px;background:#1c1830;color:#eee;text-align:center;
  border:2px solid var(--gc,#9cf);font-weight:800;font-size:15px}
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
  .ds-rays{display:none}
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
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function setting(key, fb) {
    try { return DS.settings && typeof DS.settings.get === 'function' ? DS.settings.get(key, fb) : fb; } catch (e) { return fb; }
  }
  function reduced() {
    try {
      return typeof window !== 'undefined' && !!window.matchMedia && !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

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

  // Directional slash streak. o: {ang (deg), thick, len}
  function slashAt(a, o) {
    o = o || {};
    const s = mk('div', 'ds-slash');
    const len = o.len || clamp(a.w * 0.95, 70, 260);
    const ang = o.ang != null ? o.ang : Math.random() * 40 - 20 - 28;
    s.style.left = a.x + 'px';
    s.style.top = a.y + 'px';
    s.style.width = len + 'px';
    if (o.thick) s.style.height = o.thick + 'px';
    s.style.setProperty('--rot', ang + 'deg');
    addNode(s, 400);
  }

  // mag: boolean (legacy: big) or a 0..1.5 strength
  function screenShake(mag) {
    const app = hasDom() ? document.getElementById('app') : null;
    if (!app) return;
    if (reduced() || setting('screenShake', true) === false) return;
    const k = mag === true ? 1 : mag === false || mag == null ? 0.35 : clamp(Number(mag) || 0, 0.1, 1.5);
    const ms = Math.round(240 + 300 * Math.min(k, 1));
    const sc = 0.25 + k * 0.85;
    const frames = SCREEN_BIG.map((f) => {
      const m = /(-?[\d.]+)px (-?[\d.]+)px/.exec(f.translate);
      return { translate: (m ? (parseFloat(m[1]) * sc).toFixed(1) : 0) + 'px ' + (m ? (parseFloat(m[2]) * sc).toFixed(1) : 0) + 'px' };
    });
    if (!animateEl(app, 'screen', frames, ms, 'linear')) {
      restartClass(app, k > 0.6 ? 'ds-screen-shake-big' : 'ds-screen-shake', ms);
    }
  }

  // Vignette flash. strength 0..1 scales the peak opacity.
  function flash(kind, ms, strength) {
    const el = mk('div', 'ds-flash ds-flash-' + kind);
    if (ms) el.style.animationDuration = ms + 'ms';
    if (strength != null) el.style.setProperty('--fo', String(clamp(strength, 0.1, 1)));
    addNode(el, ms || 500);
  }


  // ---------------------------------------------------------------------------
  // Pooled canvas particles. One canvas, hard cap of MAX_P live particles,
  // requestAnimationFrame runs only while at least one particle is alive.
  // ---------------------------------------------------------------------------
  const MAX_P = 150;
  const live = [];
  let canvas = null;
  let g2 = null;
  let raf = 0;
  let lastTs = 0;
  let cw = 0;
  let chh = 0;
  let dpr = 1;

  function sizeCanvas() {
    try {
      dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
      cw = window.innerWidth || 1280;
      chh = window.innerHeight || 720;
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(chh * dpr);
    } catch (e) { /* ignore */ }
  }

  function ensureCanvas() {
    if (!hasDom()) return false;
    try {
      if (canvas && canvas.isConnected) return true;
      const c = document.createElement('canvas');
      c.id = 'ds-fx-canvas';
      c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:996';
      const ctx2 = c.getContext && c.getContext('2d');
      if (!ctx2) return false;
      (document.body || document.documentElement).appendChild(c);
      canvas = c;
      g2 = ctx2;
      sizeCanvas();
      return true;
    } catch (e) {
      canvas = null;
      g2 = null;
      return false;
    }
  }

  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => { if (canvas) sizeCanvas(); });
    }
  } catch (e) { /* ignore */ }

  const ease = {
    out: (u) => 1 - (1 - u) * (1 - u),
    in: (u) => u * u,
    io: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  };

  // Spawn one particle. Fields: x y vx vy gy drag life size color shape comp alpha rot vr grow glow delay
  // r0 r1 lw (ring) pts (bolt) path (bezier) home {x,y,at,dur} onEnd onArrive fade ('late') prio seed
  function spawn(o) {
    if (!hasDom() || reduced()) return null;
    if (live.length >= MAX_P) {
      if (!o.prio) return null;
      live.shift();
    }
    if (typeof document !== 'undefined' && document.hidden) return null; // no frames run while hidden, so nothing would ever clear it
    // Frames stopped (window minimised or covered): drop the stale backlog instead of piling up behind it.
    if (live.length && lastWall && Date.now() - lastWall > 2000) live.length = 0;
    if (!ensureCanvas()) return null;
    o.age = -(o.delay || 0);
    o.life = o.life || 0.8;
    o.size = o.size || 3;
    o.alpha = o.alpha != null ? o.alpha : 1;
    o.vx = o.vx || 0;
    o.vy = o.vy || 0;
    o.gy = o.gy || 0;
    o.drag = o.drag || 0;
    o.rot = o.rot || 0;
    o.vr = o.vr || 0;
    o.seed = Math.random() * 100;
    o.shape = o.shape || 'dot';
    o.color = o.color || '#fff';
    live.push(o);
    kick();
    return o;
  }

  function kick() {
    if (raf || typeof requestAnimationFrame !== 'function') return;
    lastTs = 0;
    raf = requestAnimationFrame(frame);
  }

  let lastWall = 0;
  function frame(ts) {
    raf = 0;
    lastWall = Date.now();
    if (!g2 || !canvas) { live.length = 0; return; }
    const dt = lastTs ? clamp((ts - lastTs) / 1000, 0.001, 0.05) : 0.016;
    lastTs = ts;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, cw, chh);
    const ended = [];
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) {
        live.splice(i, 1);
        if (p.onEnd) ended.push(p);
        continue;
      }
      const u = p.age / p.life;
      if (p.path) {
        const e = ease.io(u);
        const m = 1 - e;
        p.x = m * m * p.path.x0 + 2 * m * e * p.path.cx + e * e * p.path.x1;
        p.y = m * m * p.path.y0 + 2 * m * e * p.path.cy + e * e * p.path.y1;
        const dx = 2 * m * (p.path.cx - p.path.x0) + 2 * e * (p.path.x1 - p.path.cx);
        const dy = 2 * m * (p.path.cy - p.path.y0) + 2 * e * (p.path.y1 - p.path.cy);
        p.rot = Math.atan2(dy, dx) + Math.PI / 2;
      } else {
        if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
        p.vy += p.gy * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.sway) p.x += Math.sin(p.age * p.swayF + p.seed) * p.sway * dt;
        if (p.home && p.age >= p.home.at) {
          if (p.hx == null) { p.hx = p.x; p.hy = p.y; }
          const hu = clamp((p.age - p.home.at) / p.home.dur, 0, 1);
          const he = ease.in(hu);
          p.x = p.hx + (p.home.x - p.hx) * he;
          p.y = p.hy + (p.home.y - p.hy) * he;
          if (hu >= 1) {
            live.splice(i, 1);
            if (p.onArrive) ended.push({ onEnd: p.onArrive, x: p.x, y: p.y });
            continue;
          }
        }
      }
      let a = p.alpha * Math.min(1, u * 10);
      a *= p.fade === 'late' ? clamp((1 - u) * 3, 0, 1) : (1 - u);
      if (p.twinkle) a *= 0.55 + 0.45 * Math.sin(p.age * 22 + p.seed);
      if (p.home && p.age >= p.home.at) a = p.alpha;
      drawP(p, u, a);
    }
    g2.globalAlpha = 1;
    g2.globalCompositeOperation = 'source-over';
    for (let i = 0; i < ended.length; i++) {
      try { ended[i].onEnd(ended[i]); } catch (e) { /* ignore */ }
    }
    if (live.length) {
      raf = requestAnimationFrame(frame);
    } else {
      g2.setTransform(1, 0, 0, 1, 0, 0);
      g2.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawP(p, u, a) {
    const c = g2;
    c.globalAlpha = clamp(a, 0, 1);
    c.globalCompositeOperation = p.comp || 'source-over';
    c.fillStyle = p.color;
    c.strokeStyle = p.color;
    const s = p.size * (p.grow ? 1 + (p.grow - 1) * u : 1);
    switch (p.shape) {
      case 'dot':
        if (p.glow) {
          c.globalAlpha = clamp(a * 0.25, 0, 1);
          c.beginPath(); c.arc(p.x, p.y, s * 2.4, 0, 6.2832); c.fill();
          c.globalAlpha = clamp(a, 0, 1);
        }
        c.beginPath(); c.arc(p.x, p.y, s, 0, 6.2832); c.fill();
        break;
      case 'puff':
        c.beginPath(); c.arc(p.x, p.y, s, 0, 6.2832); c.fill();
        break;
      case 'streak': {
        c.lineWidth = s;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        c.stroke();
        break;
      }
      case 'ring': {
        const r = p.r0 + (p.r1 - p.r0) * ease.out(u);
        c.lineWidth = Math.max(0.6, (p.lw || 3) * (1 - u));
        c.beginPath(); c.arc(p.x, p.y, r, 0, 6.2832); c.stroke();
        break;
      }
      case 'star': {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 === 0 ? s : s * 0.22;
          const ang = (k * Math.PI) / 4;
          if (k === 0) c.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          else c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        c.closePath(); c.fill();
        c.restore();
        break;
      }
      case 'shard': {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.beginPath();
        c.moveTo(0, -s); c.lineTo(s * 0.55, s * 0.6); c.lineTo(-s * 0.55, s * 0.6);
        c.closePath(); c.fill();
        c.restore();
        break;
      }
      case 'rect': {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.scale(1, Math.cos(p.age * 9 + p.seed));
        c.fillRect(-s, -s * 0.5, s * 2, s);
        c.restore();
        break;
      }
      case 'chunk': {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-s * 0.5, -s * 0.5, s, s);
        c.restore();
        break;
      }
      case 'coin': {
        const w = Math.max(0.18, Math.abs(Math.cos(p.age * 11 + p.seed)));
        c.save();
        c.translate(p.x, p.y);
        c.beginPath(); c.ellipse(0, 0, s * w, s, 0, 0, 6.2832);
        c.fillStyle = '#ffcf40'; c.fill();
        c.lineWidth = 1.2; c.strokeStyle = '#a86b00'; c.stroke();
        c.beginPath(); c.ellipse(0, 0, s * w * 0.5, s * 0.5, 0, 0, 6.2832);
        c.strokeStyle = '#fff1a8'; c.stroke();
        c.restore();
        break;
      }
      case 'card': {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = '#2b2447';
        c.fillRect(-s * 0.7, -s, s * 1.4, s * 2);
        c.lineWidth = 1.5;
        c.strokeStyle = p.color;
        c.strokeRect(-s * 0.7, -s, s * 1.4, s * 2);
        c.restore();
        break;
      }
      case 'bolt': {
        const pts = p.pts;
        if (!pts || pts.length < 2) break;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.lineWidth = s * 2.6;
        c.globalAlpha = clamp(a * 0.4, 0, 1);
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
        c.stroke();
        c.globalAlpha = clamp(a, 0, 1);
        c.lineWidth = s;
        c.strokeStyle = '#ffffff';
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
        c.stroke();
        break;
      }
      default:
        break;
    }
  }

  // ----- particle recipes ----------------------------------------------------
  const COL = {
    spark: ['#fff7d8', '#ffffff', '#ffb070'],
    fire: ['#ffd27a', '#ff9a3c', '#ff5a1f', '#ffe9b0'],
    ember: ['#ffb347', '#ff7a2e', '#ffd27a'],
    frost: ['#e8fbff', '#9fe6ff', '#6fc8ff', '#ffffff'],
    poison: ['#9cff6b', '#5fd13a', '#c8ff8a'],
    magic: ['#d9b3ff', '#9a6bff', '#6fb2ff', '#ffffff'],
    bolt: ['#fff7a0', '#ffffff', '#9fd0ff'],
    gold: ['#ffe39a', '#ffc857', '#fff3c4'],
    heal: ['#bfffd0', '#7dff9b', '#ffffff'],
    block: ['#bfe0ff', '#7fb8ff', '#ffffff'],
    dust: ['#8c7f72', '#a89a8a', '#6b6159'],
    confetti: ['#ff5a7a', '#ffd24a', '#5fd3ff', '#8dff7a', '#c08cff', '#ffffff'],
  };

  function jitterPt(a, f) {
    const sx = Math.min(a.w || 0, 120) * (f || 0.4);
    const sy = Math.min(a.h || 0, 120) * (f || 0.4);
    return { x: a.x + (Math.random() - 0.5) * sx, y: a.y + (Math.random() - 0.5) * sy };
  }

  // Radial or directional streak sparks. o: {col, speed, angle(rad), spread, gy, life, size, comp}
  function sparks(a, n, o) {
    for (let i = 0; i < n; i++) {
      let ang;
      if (o.angle != null) ang = o.angle + (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 2 * (o.spread || 0.6);
      else ang = Math.random() * 6.2832;
      const sp = (o.speed || 240) * rnd(0.45, 1.15);
      const q = jitterPt(a, 0.25);
      spawn({
        x: q.x, y: q.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, gy: o.gy || 0, drag: o.drag || 3,
        life: (o.life || 0.45) * rnd(0.7, 1.3), size: o.size || rnd(1.6, 3.2), color: pick(o.col || COL.spark),
        shape: o.shape || 'streak', comp: o.comp || 'lighter', rot: rnd(0, 6), vr: rnd(-8, 8),
      });
    }
  }

  function ringAt(a, color, r0, r1, life, lw, delay) {
    spawn({ x: a.x, y: a.y, shape: 'ring', color, r0, r1, life: life || 0.4, lw: lw || 3, comp: 'lighter', delay: delay || 0 });
  }

  function starsAt(a, n, o) {
    for (let i = 0; i < n; i++) {
      const q = jitterPt(a, o.span || 0.8);
      spawn({
        x: q.x, y: q.y, vx: rnd(-25, 25), vy: -rnd(o.up != null ? o.up : 30, (o.up != null ? o.up : 30) + 60), gy: o.gy || 0,
        life: rnd(0.6, 1.1) * (o.life || 1), size: rnd(o.min || 3, o.max || 7), color: pick(o.col || COL.heal), shape: 'star',
        comp: 'lighter', vr: rnd(-3, 3), twinkle: true, delay: rnd(0, o.stagger || 0.25),
      });
    }
  }

  function puffs(a, n, o) {
    for (let i = 0; i < n; i++) {
      const q = jitterPt(a, 0.5);
      spawn({
        x: q.x, y: q.y, vx: rnd(-70, 70) * (o.k || 1), vy: -rnd(5, 50), gy: o.gy || 0, drag: 2, life: rnd(0.5, 0.9),
        size: rnd(6, 12), grow: 2.2, color: pick(o.col || COL.dust), shape: 'puff', alpha: o.alpha || 0.4,
      });
    }
  }

  function zigzag(x0, y0, x1, y1) {
    const pts = [[x0, y0]];
    const n = 7;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = rnd(-1, 1) * 26 * (1 - Math.abs(t - 0.5) * 0.6);
      pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
    }
    pts.push([x1, y1]);
    return pts;
  }

  // ---------------------------------------------------------------------------
  // Flavor inference (slash / blunt / magic / poison / fire / frost / lightning)
  // ---------------------------------------------------------------------------
  const FLAVOR_RX = [
    ['lightning', /lightning|thunder|shock|bolt|storm|static|volt|galvan|zap|tempest|chain arc|\barc\b/],
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
      const sub2 = effectFlavor(e.effects, depth + 1) || effectFlavor(e.then, depth + 1) || effectFlavor(e.onKill, depth + 1);
      if (sub2) return sub2;
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
    // Enemy: move name has priority; fall back to blunt for heavy tiers
    const f = flavorFrom(text, def.icon, move && move.effects, null);
    return f;
  }

  // Last known flavors
  let lastCardFx = { f: 'slash', t: 0 };
  const enemyFx = new Map();      // uid -> flavor from its most recent move
  let hitCounter = 0;

  // ---------------------------------------------------------------------------
  // Floating numbers
  // ---------------------------------------------------------------------------
  const numStack = new Map();     // key -> {t, n}

  function stackSlot(key, windowMs) {
    const now = Date.now();
    const s = numStack.get(key);
    if (s && now - s.t < (windowMs || 650)) { s.n = Math.min(s.n + 1, 6); s.t = now; return s.n; }
    numStack.set(key, { t: now, n: 0 });
    if (numStack.size > 40) {
      numStack.forEach((v, k) => { if (now - v.t > 2000) numStack.delete(k); });
    }
    return 0;
  }

  // Damage number look scaled by amount
  function dmgLook(amt) {
    if (amt >= 35) return { size: 68, color: '#ffe066', crit: true };
    if (amt >= 20) return { size: 54, color: '#ffd24a', crit: true };
    if (amt >= 12) return { size: 40, color: '#ff9a3c' };
    if (amt >= 6) return { size: 31, color: '#ff6b5b' };
    return { size: 24, color: '#ff8f84' };
  }

  // Pop, arc and fade. o: {size, color, crit, slot, dx, rise, life, cls}
  function popNumber(a, text, o) {
    const slot = o.slot || 0;
    const size = o.size || 26;
    const el = mk('div', 'ds-num' + (o.crit ? ' ds-num-crit' : '') + (o.cls ? ' ' + o.cls : ''), text);
    const side = slot % 2 === 0 ? 1 : -1;
    const baseDx = o.dx != null ? o.dx : rnd(-14, 14);
    const dx = baseDx + side * slot * 12 + (slot ? side * 10 : 0);
    const startY = a.y + (o.dy || 0) - slot * size * 0.62;
    el.style.left = a.x + 'px';
    el.style.top = startY + 'px';
    el.style.fontSize = size + 'px';
    if (o.color) el.style.color = o.color;
    const life = o.life || (o.crit ? 1250 : 1000);
    const rise = o.rise != null ? o.rise : 54 + size * 0.7;
    const pop = o.crit ? 1.65 : 1.3;
    if (!addNode(el, life)) return null;
    const dir = dx >= 0 ? 1 : -1;
    const T = (x, y, s) => 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s + ')';
    if (typeof el.animate === 'function') {
      try {
        const calm = reduced();
        el.animate(calm ? [
          { transform: T(dx * 0.5, 0, 1), opacity: 0 },
          { transform: T(dx * 0.5, -10, 1), opacity: 1, offset: 0.2 },
          { transform: T(dx * 0.5, -20, 1), opacity: 0 },
        ] : [
          { transform: T(0, 0, 0.35), opacity: 0 },
          { transform: T(dx * 0.22, -rise * 0.32, pop), opacity: 1, offset: 0.12 },
          { transform: T(dx * 0.5, -rise * 0.78, 1), opacity: 1, offset: 0.4 },
          { transform: T(dx * 0.85, -rise * 0.92, 0.96), opacity: 1, offset: 0.62 },
          { transform: T(dx + dir * 6, -rise * 0.55, 0.88), opacity: 0 },
        ], { duration: life, easing: 'cubic-bezier(.22,.7,.3,1)', fill: 'both' });
        el.style.animation = 'none';
      } catch (e) { /* CSS fallback below */ }
    }
    if (!el.style.animation) {
      // Fallback: reuse the stylesheet keyframes
      el.classList.add('ds-float');
      el.style.animationDuration = life + 'ms';
    }
    return el;
  }

  // Status icon popping near a unit
  function popIcon(a, icon, color, slot) {
    const el = mk('div', 'ds-pop-icon', icon);
    const ox = (slot % 2 === 0 ? 1 : -1) * (24 + slot * 20) * (slot ? 1 : 0);
    el.style.left = (a.x + ox + rnd(-8, 8)) + 'px';
    el.style.top = (a.y - (a.h || 0) * 0.28) + 'px';
    el.style.setProperty('--pc', color);
    if (!addNode(el, 1000)) return;
    if (typeof el.animate === 'function') {
      try {
        const T = (y, s) => 'translate(-50%,-50%) translateY(' + y + 'px) scale(' + s + ')';
        el.animate([
          { transform: T(10, 0.2), opacity: 0 },
          { transform: T(-6, 1.5), opacity: 1, offset: 0.22 },
          { transform: T(-14, 1.0), opacity: 1, offset: 0.55 },
          { transform: T(-44, 0.9), opacity: 0 },
        ], { duration: reduced() ? 600 : 950, easing: 'ease-out', fill: 'both' });
      } catch (e) { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Unit reactions
  // ---------------------------------------------------------------------------
  function hitPunch(el, amt) {
    if (!el || reduced()) return;
    const big = amt >= 20;
    const k = clamp(amt / 25, 0.2, 1.4);
    const s = 1 + 0.06 * k + (big ? 0.06 : 0);
    const frames = big ? [
      { scale: '1', filter: 'brightness(2.8) saturate(.4)', offset: 0 },
      { scale: String(s + 0.02), filter: 'brightness(2.8) saturate(.4)', offset: 0.18 },
      { scale: String(s + 0.02), filter: 'brightness(2.2) saturate(.5)', offset: 0.42 },
      { scale: '0.95', filter: 'brightness(1.4)', offset: 0.7 },
      { scale: '1', filter: 'brightness(1)', offset: 1 },
    ] : [
      { scale: '1', filter: 'brightness(2.4) saturate(.5)' },
      { scale: String(s), filter: 'brightness(1.8) saturate(.7)', offset: 0.3 },
      { scale: '0.97', filter: 'brightness(1.2)', offset: 0.7 },
      { scale: '1', filter: 'brightness(1)' },
    ];
    animateEl(el, 'punch', frames, big ? 300 : 200, 'ease-out');
  }

  function impactFx(a, flavor, amt, player) {
    const k = clamp(amt / 25, 0.25, 1.6);
    const cnt = (b) => Math.round(b * clamp(0.6 + k * 0.5, 0.6, 1.5));
    const angs = [-0.6, 0.55, -1.0, 0.9, -0.25];
    const ang = angs[hitCounter++ % angs.length];
    switch (flavor) {
      case 'blunt':
        ringAt(a, '#ffe7c0', 8, 55 + k * 55, 0.36, 4 + k * 2);
        puffs(a, cnt(4), { gy: 20 });
        sparks(a, cnt(6), { col: ['#ffd9a0', '#ffffff', '#ff9a5a'], speed: 220 + k * 120, gy: 520, life: 0.42 });
        if (amt >= 14) ringAt(a, '#ffffff', 4, 36, 0.2, 6, 0.03);
        break;
      case 'magic':
        glowAt(a, 'rgba(160,110,255,.9)', 1.2);
        ringAt(a, '#c9a6ff', 6, 48 + k * 40, 0.42, 3);
        starsAt(a, cnt(7), { col: COL.magic, up: -20, gy: 40, min: 3, max: 7, span: 0.9, life: 0.7, stagger: 0.08 });
        sparks(a, cnt(5), { col: COL.magic, speed: 190, life: 0.5, drag: 2 });
        break;
      case 'poison':
        glowAt(a, 'rgba(110,255,80,.6)', 1.1);
        for (let i = 0; i < cnt(8); i++) {
          const q = jitterPt(a, 0.7);
          spawn({
            x: q.x, y: q.y - (a.h || 40) * 0.2, vx: rnd(-35, 35), vy: -rnd(40, 130), gy: 560, life: rnd(0.55, 0.9),
            size: rnd(2.5, 5), color: pick(COL.poison), shape: 'dot', glow: true, comp: 'lighter', delay: rnd(0, 0.12),
          });
        }
        puffs(a, 3, { col: ['#5fa83a', '#7ccf4e'], alpha: 0.28, gy: -30 });
        break;
      case 'fire':
        glowAt(a, 'rgba(255,140,50,.95)', 1.3);
        for (let i = 0; i < cnt(10); i++) {
          const q = jitterPt(a, 0.7);
          spawn({
            x: q.x, y: q.y, vx: rnd(-50, 50), vy: -rnd(70, 230), gy: -40, drag: 1.2, life: rnd(0.45, 0.9),
            size: rnd(2.5, 6), color: pick(COL.fire), shape: 'dot', glow: true, comp: 'lighter', twinkle: true,
          });
        }
        ringAt(a, '#ffb066', 6, 44 + k * 30, 0.3, 4);
        break;
      case 'frost':
        glowAt(a, 'rgba(150,225,255,.9)', 1.2);
        ringAt(a, '#c8f1ff', 6, 46 + k * 36, 0.4, 3);
        for (let i = 0; i < cnt(8); i++) {
          const an = rnd(0, 6.28);
          const sp = rnd(120, 280);
          spawn({
            x: a.x, y: a.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 40, gy: 420, drag: 1.6, life: rnd(0.45, 0.8),
            size: rnd(4, 8), color: pick(COL.frost), shape: 'shard', rot: rnd(0, 6), vr: rnd(-9, 9), comp: 'lighter',
          });
        }
        break;
      case 'lightning': {
        glowAt(a, 'rgba(255,245,150,.95)', 1.3);
        const top = a.y - Math.max(120, (a.h || 100) * 1.2);
        for (let i = 0; i < 2; i++) {
          spawn({ shape: 'bolt', x: a.x, y: a.y, pts: zigzag(a.x + rnd(-24, 24), top, a.x + rnd(-8, 8), a.y), life: 0.2 + i * 0.06, size: 2.2, color: '#9fd0ff', comp: 'lighter', delay: i * 0.05, fade: 'late' });
        }
        sparks(a, cnt(8), { col: COL.bolt, speed: 300, life: 0.35, gy: 200 });
        ringAt(a, '#fff7a0', 4, 40 + k * 20, 0.25, 3);
        break;
      }
      default: { // slash
        const deg = (ang * 180) / Math.PI * 0.8 + (player ? 0 : 160 * (hitCounter % 2));
        slashAt(a, { ang: deg - 28, thick: 3 + k * 4.5, len: clamp((a.w || 90) * (0.8 + k * 0.4), 70, 300) });
        sparks(a, cnt(7), { col: COL.spark, speed: 260 + k * 160, angle: (deg - 28) * Math.PI / 180, spread: 0.45, gy: 260, life: 0.4 });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers: combat
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
    const el = findEl(uid);

    if (amt > 0) {
      let flavor;
      if (selfInflicted) {
        const st = target.statuses || {};
        flavor = st.poison > 0 ? 'poison' : st.burn > 0 ? 'fire' : 'magic';
        popNumber(a, '-' + amt, {
          size: clamp(18 + amt * 0.6, 18, 30), color: flavor === 'fire' ? '#ff9a4a' : flavor === 'poison' ? '#9cff6b' : '#c08cff',
          slot: stackSlot(uid + ':n'), dy: a.h * 0.1, life: 900,
        });
        if (!reduced()) {
          if (flavor === 'poison') {
            for (let i = 0; i < 3; i++) spawn({ x: a.x + rnd(-18, 18), y: a.y, vy: -rnd(10, 50), gy: 500, life: 0.7, size: rnd(2, 3.5), color: pick(COL.poison), glow: true, comp: 'lighter', delay: i * 0.06 });
          } else if (flavor === 'fire') {
            for (let i = 0; i < 4; i++) spawn({ x: a.x + rnd(-20, 20), y: a.y + rnd(-6, 12), vy: -rnd(50, 130), vx: rnd(-20, 20), gy: -30, life: 0.7, size: rnd(2, 4), color: pick(COL.fire), glow: true, comp: 'lighter' });
          }
        }
      } else {
        if (p.source && isPlayerUnit(p.source) && Date.now() - lastCardFx.t < 4000) flavor = lastCardFx.f;
        else if (p.source && enemyFx.has(p.source.uid)) flavor = enemyFx.get(p.source.uid);
        else flavor = 'slash';
        const look = dmgLook(amt);
        popNumber(a, '-' + amt + (look.crit ? '!' : ''), {
          size: look.size, color: look.color, crit: look.crit, slot: stackSlot(uid + ':n'), dy: -a.h * 0.15,
        });
        if (look.crit) {
          ringAt(a, '#ffe28a', 10, 80 + Math.min(amt, 50), 0.45, 6);
          sparks(a, 10, { col: COL.gold, speed: 340, life: 0.5, gy: 300 });
        }
        impactFx(a, flavor, amt, player);
      }
      if (blk > 0) {
        popNumber(a, '🛡' + blk, { size: 17, color: '#8fd0ff', cls: 'ds-num-sm', slot: stackSlot(uid + ':b'), dy: a.h * 0.12, dx: 34, life: 800, rise: 36 });
        ringAt(a, '#7fb8ff', 8, 38, 0.3, 3);
      }
      if (el) {
        hitPunch(el, amt);
        if (!reduced() && !animateEl(el, 'shake', SHAKE_FRAMES, 360)) restartClass(el, 'ds-shake', 360);
      }
      if (player) {
        const k = clamp(amt / 22, 0.15, 1.5);
        screenShake(amt >= 3 ? k : 0);
        flash(amt >= 18 ? 'strong' : 'red', amt >= 18 ? 650 : 480, clamp(0.3 + amt / 24, 0.3, 1));
      } else if (amt >= 15) {
        screenShake(clamp(amt / 40, 0.2, 0.8));
      }
    } else if (blk > 0) {
      popNumber(a, 'Blocked', { size: 21, color: '#8fd0ff', slot: stackSlot(uid + ':b'), dy: -a.h * 0.1, life: 800, rise: 44 });
      // Block clang: ripple + metal sparks
      ringAt(a, '#bfe0ff', 10, 64, 0.38, 4);
      ringAt(a, '#ffffff', 4, 38, 0.24, 2.5, 0.05);
      sparks(a, 8, { col: ['#ffffff', '#ffe9a8', '#bfe0ff'], speed: 260, life: 0.32, gy: 200 });
      if (el && !reduced() && !animateEl(el, 'wobble', WOBBLE_FRAMES, 240)) restartClass(el, 'ds-wobble', 240);
    }
  }

  function onBlock(p) {
    if (!hasDom() || !p || !p.target || !(Number(p.amount) > 0)) return;
    const uid = p.target.uid;
    if (uid == null) return;
    const a = anchorOrFallback(uid);
    popNumber(a, '+' + p.amount, { size: 26, color: '#7fbfff', slot: stackSlot(uid + ':g'), dy: -a.h * 0.25 });
    glowAt(a, 'rgba(120,180,255,.85)', 1.1);
    // Shield ripple
    ringAt(a, '#7fb8ff', 12, Math.max(50, (a.h || 80) * 0.55), 0.55, 5);
    ringAt(a, '#cfe6ff', 6, Math.max(34, (a.h || 80) * 0.4), 0.42, 3, 0.08);
    sparks(a, 6, { col: COL.block, speed: 120, life: 0.5, drag: 2, shape: 'dot', size: 3 });
  }

  function onHeal(p) {
    if (!hasDom() || !p || !p.target) return;
    const amt = Math.round(Number(p.amount) || 0);
    const uid = p.target.uid;
    if (amt <= 0 || uid == null) return;
    const a = anchorOrFallback(uid);
    popNumber(a, '+' + amt, { size: clamp(22 + amt * 0.8, 22, 40), color: '#7dff9b', slot: stackSlot(uid + ':h'), dy: -a.h * 0.2 });
    glowAt(a, 'rgba(110,255,150,.8)', 1.2);
    starsAt(a, clamp(5 + Math.round(amt / 4), 6, 14), { col: COL.heal, up: 40, gy: -10, min: 3, max: 8, span: 1.2, life: 1.1, stagger: 0.3 });
  }

  function onStatus(p) {
    if (!hasDom() || !p || !p.target) return;
    const uid = p.target.uid;
    if (uid == null) return;
    const amt = Number(p.amount) || 0;
    if (amt === 0 && !p.status) return;
    const def = DS.statuses ? DS.statuses[p.status] : null;
    const icon = (def && def.icon) || '✦';
    const name = (def && def.name) || String(p.status || '');
    const isDebuff = !!def && def.type === 'debuff';
    const boolean = !!def && def.stacks === false;
    const signed = (amt > 0 ? '+' : '') + amt;
    const text = boolean || amt === 0 ? icon + ' ' + name : icon + ' ' + name + ' ' + signed;
    const a = anchorOrFallback(uid);
    const slot = stackSlot(uid + ':s', 800);
    floatText(a, text, 'ds-float-status ' + (isDebuff ? 'ds-float-debuff' : 'ds-float-buff'), {
      size: 15, dy: a.h * 0.22 + slot * 22, jx: (Math.random() * 2 - 1) * 30, life: 1000,
    });
    if (amt > 0 || boolean) {
      popIcon(a, icon, isDebuff ? '#d77bff' : '#ffe08a', slot);
      if (!reduced()) {
        if (isDebuff) {
          for (let i = 0; i < 4; i++) spawn({ x: a.x + rnd(-24, 24), y: a.y - 20, vy: rnd(40, 90), gy: 120, life: 0.8, size: rnd(2, 3.5), color: '#c07bff', shape: 'dot', glow: true, comp: 'lighter', delay: i * 0.04 });
        } else {
          starsAt(a, 4, { col: COL.gold, up: 30, min: 3, max: 6, span: 0.9, stagger: 0.15 });
        }
      }
    }
  }

  function onEnemyDied(p) {
    if (!hasDom() || !p || !p.enemy) return;
    const uid = p.enemy.uid;
    if (uid == null) return;
    const a = anchorOrFallback(uid);
    const el = findEl(uid);
    const tier = (p.enemy.def && p.enemy.def.tier) || 'normal';
    const boss = tier === 'boss';
    if (el) {
      try { el.style.pointerEvents = 'none'; } catch (e) { /* ignore */ }
      if (!animateEl(el, 'dying', DYING_FRAMES, 650, 'ease-in', 'forwards') && el.classList) {
        el.classList.add('ds-dying');
      }
    }
    // Dissolve: a grid of chunks lifts off and falls, plus shards and a soul wisp
    const w = Math.min(a.w || 100, 200);
    const h = Math.min(a.h || 100, 200);
    const cols = boss ? 6 : 5;
    const rows = boss ? 6 : 4;
    const pal = ['#2b2336', '#4b3a5e', '#8f7aa6', '#c9b8d9', '#ff9a5a'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = a.x - w / 2 + (c + 0.5) * (w / cols);
        const py = a.y - h / 2 + (r + 0.5) * (h / rows);
        const dx = px - a.x;
        spawn({
          x: px, y: py, vx: dx * 1.4 + rnd(-30, 30), vy: -rnd(30, 150) + (r - rows / 2) * 6, gy: 260, drag: 0.8,
          life: rnd(0.7, 1.3), size: rnd(4, 9), color: pick(pal), shape: 'chunk', rot: rnd(0, 6), vr: rnd(-7, 7),
          delay: rnd(0, 0.18) + (rows - r) * 0.015, prio: true,
        });
      }
    }
    sparks(a, boss ? 22 : 12, { col: COL.magic, speed: 260, life: 0.8, gy: 120 });
    ringAt(a, '#c9b8d9', 10, Math.max(60, w * 0.7), 0.6, 5);
    for (let i = 0; i < 5; i++) {
      spawn({ x: a.x + rnd(-w * 0.3, w * 0.3), y: a.y + rnd(-h * 0.2, h * 0.2), vy: -rnd(30, 80), vx: rnd(-15, 15), life: rnd(1, 1.6), size: rnd(3, 6), color: '#e8dcff', shape: 'star', comp: 'lighter', twinkle: true, delay: rnd(0.1, 0.4) });
    }
    glowAt(a, 'rgba(210,190,255,.8)', 1.5);
    if (boss) { screenShake(1); flash('gold', 700, 0.7); }
    else if (tier === 'elite') screenShake(0.5);
  }

  function onEnemyMove(p) {
    try {
      if (!p || !p.enemy) return;
      enemyFx.set(p.enemy.uid, enemyFlavor(p.enemy, p.move));
      if (enemyFx.size > 30) enemyFx.delete(enemyFx.keys().next().value);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Card feel
  // ---------------------------------------------------------------------------
  function rectCentre(el) {
    try {
      if (!el || !el.getBoundingClientRect) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    } catch (e) { return null; }
  }
  function q1(sel) { try { return hasDom() ? document.querySelector(sel) : null; } catch (e) { return null; } }

  function pileAnchor(kind) {
    const a = rectCentre(q1('.ds-pile-' + kind));
    if (a) return a;
    const w = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const h = (typeof window !== 'undefined' && window.innerHeight) || 720;
    return kind === 'draw' ? { x: 70, y: h - 90, w: 60, h: 80 } : { x: w - 70, y: h - 90, w: 60, h: 80 };
  }

  function handAnchor() {
    const drag = rectCentre(q1('.ds-card-dragging'));
    if (drag) return drag;
    const a = rectCentre(q1('.ds-hand'));
    if (a) return a;
    const w = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const h = (typeof window !== 'undefined' && window.innerHeight) || 720;
    return { x: w / 2, y: h - 110, w: 300, h: 150 };
  }

  const TYPE_GLOW = { attack: '#ff7a5a', skill: '#6fe0d6', power: '#ffd26a', curse: '#a455d6', status: '#a455d6' };

  function cardGhost(card, type, from, to) {
    if (reduced() || !hasDom()) return;
    const root = overlay();
    if (!root || typeof root.appendChild !== 'function') return;
    const wrap = mk('div', 'ds-ghost');
    wrap.style.setProperty('--gc', TYPE_GLOW[type] || '#9cf');
    let inner = null;
    try {
      if (DS.ui && typeof DS.ui.renderCard === 'function' && card && card.data) inner = DS.ui.renderCard(card.data, { cost: card.cost, small: true });
    } catch (e) { inner = null; }
    if (inner) {
      inner.classList.add('ds-ghost-in');
      inner.removeAttribute && inner.removeAttribute('id');
    } else {
      inner = mk('div', 'ds-ghost-in ds-ghost-fallback', ((card && card.data && (card.data.icon + ' ' + card.data.name)) || 'Card'));
    }
    wrap.appendChild(inner);
    if (!addNode(wrap, 520)) return;
    try {
      const mx = (from.x + to.x) / 2 + (to.x < from.x ? 30 : -30);
      const my = Math.min(from.y, to.y) - 70;
      const rot = (to.x - from.x) / 28;
      wrap.animate([
        { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(1) rotate(0deg)', opacity: 0.95, filter: 'blur(0px) brightness(1)' },
        { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.92) rotate(' + (rot * 0.5) + 'deg)', opacity: 0.95, offset: 0.45, filter: 'blur(0px) brightness(1.2)' },
        { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(.55) rotate(' + rot + 'deg)', opacity: 0.85, offset: 0.82, filter: 'blur(1px) brightness(1.8)' },
        { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(.3) rotate(' + rot + 'deg)', opacity: 0, filter: 'blur(5px) brightness(2.5)' },
      ], { duration: 460, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
    } catch (e) { /* ignore */ }
    // Dissolve into sparks where it lands
    const col = type === 'attack' ? COL.fire : type === 'power' ? COL.gold : type === 'skill' ? COL.block : COL.magic;
    setTimeout(() => { try { sparks(to, 7, { col, speed: 180, life: 0.4, drag: 3 }); } catch (e) { /* ignore */ } }, 330);
  }

  function aliveEnemiesCentre() {
    try {
      const els = document.querySelectorAll('[data-combatant]');
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < els.length; i++) {
        const uid = els[i].getAttribute('data-combatant');
        if (uid === 'player') continue;
        const a = anchorOf(uid);
        if (a) { sx += a.x; sy += a.y; n++; }
      }
      return n ? { x: sx / n, y: sy / n, w: 0, h: 0 } : null;
    } catch (e) { return null; }
  }

  function onCardPlayed(p) {
    if (!hasDom()) return;
    const card = p && p.card;
    const type = cardTypeOf(card) || 'skill';
    const tgt = p && p.target;
    if (type === 'attack') lastCardFx = { f: cardFlavor(card), t: Date.now() };
    else lastCardFx = { f: cardFlavor(card), t: Date.now() };
    const from = handAnchor();
    let to;
    if (tgt && tgt.uid != null) to = anchorOrFallback(tgt.uid);
    else if (type === 'attack') to = aliveEnemiesCentre() || anchorOrFallback('player');
    else to = anchorOrFallback('player');
    cardGhost(card, type, from, to);

    // Non-attack plays also get an aura on the player
    if (type === 'attack') return;
    const a = anchorOrFallback('player');
    if (type === 'power') {
      glowAt(a, 'rgba(255,214,110,.85)', 1.5);
      ringAt(a, '#ffe39a', 12, 90, 0.6, 4);
      starsAt(a, 8, { col: COL.gold, up: 40, min: 3, max: 7, span: 1.2, stagger: 0.2 });
    } else if (type === 'curse' || type === 'status') {
      glowAt(a, 'rgba(150,60,200,.85)', 1.4);
      sparks(a, 8, { col: ['#a455d6', '#6b2a8f', '#d8a8ff'], speed: 120, life: 0.7, drag: 2, shape: 'dot', size: 3 });
    } else {
      glowAt(a, 'rgba(100,230,220,.8)', 1.3);
      sparks(a, 6, { col: COL.block, speed: 100, life: 0.5, drag: 2, shape: 'dot', size: 2.8 });
    }
  }

  let lastDrawFx = 0;
  function onCardDrawn() {
    if (!hasDom() || reduced()) return;
    const now = Date.now();
    if (now - lastDrawFx < 70) return;
    lastDrawFx = now;
    const a = pileAnchor('draw');
    starsAt(a, 3, { col: ['#ffffff', '#bfe9ff', '#d9b3ff'], up: 20, min: 2.5, max: 5, span: 0.9, life: 0.7, stagger: 0.1 });
  }

  function onShuffle() {
    if (!hasDom() || reduced()) return;
    const from = pileAnchor('discard');
    const to = pileAnchor('draw');
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 150;
    for (let i = 0; i < 10; i++) {
      spawn({
        shape: 'card', size: 9, color: i % 2 ? '#b79cff' : '#7fd0ff', life: 0.55 + i * 0.015, delay: i * 0.05, fade: 'late',
        path: { x0: from.x + rnd(-6, 6), y0: from.y + rnd(-6, 6), cx: mx + rnd(-40, 40), cy: my + rnd(-30, 20), x1: to.x + rnd(-6, 6), y1: to.y + rnd(-6, 6) },
        x: from.x, y: from.y, alpha: 0.9,
      });
    }
    setTimeout(() => { try { ringAt(to, '#b79cff', 8, 46, 0.4, 3); } catch (e) { /* ignore */ } }, 600);
  }

  function onExhaust() {
    if (!hasDom() || reduced()) return;
    const h = handAnchor();
    const a = { x: h.x + rnd(-h.w * 0.25, h.w * 0.25), y: h.y - (h.h || 0) * 0.3, w: 90, h: 120 };
    for (let i = 0; i < 14; i++) {
      const q = jitterPt(a, 0.8);
      spawn({
        x: q.x, y: q.y, vx: rnd(-40, 40), vy: -rnd(40, 160), gy: -30, drag: 1, life: rnd(0.6, 1.2), size: rnd(1.8, 4.2),
        color: pick(COL.ember), shape: 'dot', glow: true, comp: 'lighter', twinkle: true, delay: rnd(0, 0.15),
      });
    }
    puffs(a, 2, { col: ['#3a3340', '#5a4f66'], alpha: 0.3, gy: -40 });
  }

  // ---------------------------------------------------------------------------
  // Reward moments
  // ---------------------------------------------------------------------------
  function viewport() {
    return {
      w: (typeof window !== 'undefined' && window.innerWidth) || 1280,
      h: (typeof window !== 'undefined' && window.innerHeight) || 720,
    };
  }

  // Where gold coins should land: the gold readout in the top bar
  function goldAnchor() {
    try {
      const items = document.querySelectorAll('#topbar .ds-topbar-item, .ds-gold, [data-stat="gold"]');
      for (let i = 0; i < items.length; i++) {
        if (items[i].classList.contains('ds-gold') || items[i].getAttribute('data-stat') === 'gold' || (items[i].textContent || '').indexOf('🪙') >= 0) {
          const a = rectCentre(items[i]);
          if (a) { a.el = items[i]; return a; }
        }
      }
    } catch (e) { /* ignore */ }
    const bar = rectCentre(q1('#topbar'));
    if (bar) return { x: bar.x - bar.w * 0.2, y: bar.y, w: 40, h: 20 };
    return { x: 120, y: 30, w: 40, h: 20 };
  }

  function onGold(p) {
    if (!hasDom() || !p) return;
    const amt = Math.round(Number(p.amount) || 0);
    if (amt <= 0) return;
    const to = goldAnchor();
    const v = viewport();
    const n = clamp(Math.round(amt / 6) + 4, 5, 18);
    const ox = v.w / 2;
    const oy = v.h * 0.55;
    let pulsed = false;
    for (let i = 0; i < n; i++) {
      spawn({
        shape: 'coin', size: rnd(6, 9), x: ox + rnd(-30, 30), y: oy + rnd(-10, 10),
        vx: rnd(-170, 170), vy: -rnd(330, 560), gy: 1000, drag: 0.5, life: 1.4 + rnd(0, 0.3), delay: i * 0.035,
        home: { x: to.x + rnd(-6, 6), y: to.y + rnd(-4, 4), at: 0.55, dur: 0.5 }, fade: 'late', alpha: 1,
        onArrive: () => {
          try {
            starsAt({ x: to.x, y: to.y, w: 10, h: 10 }, 1, { col: COL.gold, up: 10, min: 3, max: 5, span: 0.2, life: 0.5, stagger: 0 });
            if (!pulsed && to.el && typeof to.el.animate === 'function' && !reduced()) {
              pulsed = true;
              to.el.animate([{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { duration: 260, easing: 'ease-out' });
            }
          } catch (e) { /* ignore */ }
        },
      });
    }
    popNumber({ x: to.x, y: to.y, w: 20, h: 20 }, '+' + amt, { size: 22, color: '#ffd65a', dy: 30, dx: 0, rise: 30, life: 1100, slot: stackSlot('gold', 500) });
  }

  function onRelic() {
    if (!hasDom()) return;
    // The starter relic is granted while the character screen is still up: no fanfare for that one.
    const scr = DS.ui && DS.ui.current;
    if (scr === 'charselect' || scr === 'menu') return;
    const v = viewport();
    const a = { x: v.w / 2, y: v.h * 0.46, w: 120, h: 120 };
    addNode(mk('div', 'ds-rays'), 1300);
    glowAt(a, 'rgba(255,225,140,.95)', 4);
    flash('gold', 700, 0.8);
    ringAt(a, '#fff0b0', 16, 150, 0.7, 5);
    ringAt(a, '#ffd26a', 8, 105, 0.55, 3, 0.1);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * 6.2832 + rnd(-0.1, 0.1);
      const sp = rnd(260, 520);
      spawn({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: 2.4, gy: 40, life: rnd(0.7, 1.1), size: rnd(2, 3.4), color: pick(COL.gold), shape: 'streak', comp: 'lighter', prio: true });
    }
    starsAt(a, 10, { col: COL.gold, up: 10, gy: 0, min: 4, max: 9, span: 2.6, life: 1.4, stagger: 0.4 });
  }

  function onRunCard() {
    if (!hasDom()) return;
    const v = viewport();
    const from = { x: v.w / 2, y: v.h * 0.6, w: 80, h: 80 };
    const bar = rectCentre(q1('#topbar'));
    const to = bar ? { x: bar.x + bar.w * 0.42, y: bar.y } : { x: v.w - 90, y: 26 };
    glowAt(from, 'rgba(180,150,255,.8)', 1.6);
    starsAt(from, 8, { col: COL.magic, up: 30, min: 3, max: 7, span: 1.6, stagger: 0.2 });
    ringAt(from, '#d9c4ff', 8, 70, 0.5, 4);
    for (let i = 0; i < 3; i++) {
      spawn({
        shape: 'card', size: 11, color: '#d9c4ff', life: 0.75, delay: 0.1 + i * 0.07, fade: 'late', x: from.x, y: from.y,
        path: { x0: from.x, y0: from.y, cx: (from.x + to.x) / 2 + rnd(-80, 80), cy: Math.min(from.y, to.y) - 120, x1: to.x, y1: to.y },
      });
    }
    setTimeout(() => { try { starsAt({ x: to.x, y: to.y, w: 10, h: 10 }, 4, { col: COL.magic, up: 10, min: 3, max: 6, span: 0.5, stagger: 0.05, life: 0.6 }); } catch (e) { /* ignore */ } }, 800);
  }

  function confetti(n, opts) {
    const v = viewport();
    const o = opts || {};
    for (let i = 0; i < n; i++) {
      spawn({
        shape: 'rect', size: rnd(3.5, 6), x: o.x != null ? o.x + rnd(-20, 20) : rnd(0, v.w), y: o.y != null ? o.y : -rnd(0, 80),
        vx: o.x != null ? rnd(-320, 320) : rnd(-60, 60), vy: o.y != null ? -rnd(300, 620) : rnd(60, 220), gy: 420, drag: 0.9,
        rot: rnd(0, 6), vr: rnd(-8, 8), life: rnd(2.2, 3.4), color: pick(COL.confetti), fade: 'late', delay: rnd(0, 0.5), prio: true,
      });
    }
  }

  function onAchievement() {
    if (!hasDom()) return;
    const v = viewport();
    confetti(70);
    confetti(24, { x: v.w * 0.15, y: v.h });
    confetti(24, { x: v.w * 0.85, y: v.h });
    flash('gold', 600, 0.45);
  }

  // Fireworks
  let fwTimer = null;
  function firework() {
    const v = viewport();
    if (live.length > 95) return;
    const x = rnd(v.w * 0.15, v.w * 0.85);
    const y = rnd(v.h * 0.15, v.h * 0.45);
    const pal = pick([COL.gold, COL.confetti, COL.magic, COL.fire, COL.frost]);
    spawn({
      x: x + rnd(-30, 30), y: v.h, vx: 0, vy: -(v.h - y) * 1.55, drag: 0, gy: 0, life: 0.65, size: 2.4, color: '#fff3c4', shape: 'dot', glow: true, comp: 'lighter', fade: 'late',
      onEnd: (p) => {
        try {
          const cx = p.x;
          const cy = p.y;
          const n = 22;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * 6.2832 + rnd(-0.08, 0.08);
            const sp = rnd(170, 330);
            spawn({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: 1.9, gy: 150, life: rnd(0.9, 1.4), size: rnd(1.8, 3), color: pick(pal), shape: 'streak', comp: 'lighter', fade: 'late' });
          }
          ringAt({ x: cx, y: cy }, pal[0], 4, 70, 0.4, 3);
          glowAt({ x: cx, y: cy, w: 100, h: 100 }, 'rgba(255,230,160,.7)', 1.6);
        } catch (e) { /* ignore */ }
      },
    });
  }

  function stopFireworks() {
    if (fwTimer) { clearInterval(fwTimer); fwTimer = null; }
  }

  function startFireworks() {
    if (!hasDom() || reduced()) return;
    stopFireworks();
    let shots = 0;
    firework();
    fwTimer = setInterval(() => {
      shots++;
      if (shots > 14 || (DS.ui && DS.ui.current !== 'victory')) { stopFireworks(); return; }
      firework();
      if (Math.random() < 0.4) setTimeout(firework, 180);
    }, 520);
    confetti(40);
  }

  // Screen change watching: victory fireworks
  let lastScreen = null;
  function checkScreen() {
    try {
      const cur = DS.ui && DS.ui.current;
      if (cur === lastScreen) return;
      lastScreen = cur;
      if (cur === 'victory') startFireworks();
      else stopFireworks();
    } catch (e) { /* ignore */ }
  }

  function watchScreens() {
    try {
      const app = document.getElementById('app');
      if (!app || typeof MutationObserver !== 'function') return;
      const mo = new MutationObserver(() => {
        checkScreen();
        setTimeout(checkScreen, 160);
      });
      mo.observe(app, { childList: true });
      checkScreen();
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Ambient drifting embers / dust (capped, only while the page is visible)
  // ---------------------------------------------------------------------------
  let ambientTimer = null;
  function ambientTick() {
    try {
      if (!hasDom() || reduced() || document.hidden) return;
      if (setting('ambientFx', true) === false) return;
      if (live.length > 50) return;
      const v = viewport();
      const ember = Math.random() < 0.55;
      const inCombat = DS.ui && DS.ui.current === 'combat';
      spawn({
        x: rnd(0, v.w), y: v.h + 6, vx: rnd(-6, 6), vy: -rnd(14, 34), gy: 0,
        life: rnd(6, 11), size: ember ? rnd(1.2, 2.4) : rnd(0.9, 1.7), color: ember ? pick(COL.ember) : '#cbbfd9', shape: 'dot',
        glow: ember, comp: 'lighter', alpha: (ember ? 0.5 : 0.28) * (inCombat ? 0.7 : 1), sway: rnd(8, 18), swayF: rnd(0.6, 1.4), twinkle: ember, fade: 'late',
      });
    } catch (e) { /* ignore */ }
  }
  function startAmbient() {
    if (ambientTimer || !hasDom()) return;
    ambientTimer = setInterval(ambientTick, 700);
  }

  // ---------------------------------------------------------------------------
  // Misc combat events
  // ---------------------------------------------------------------------------
  function onCombatEnd(p) {
    if (!hasDom() || !p) return;
    if (p.result === 'lost') addNode(mk('div', 'ds-darken'), 1800);
    else if (p.result === 'won') {
      flash('gold', 500, 0.6);
      const a = anchorOrFallback('player');
      starsAt(a, 6, { col: COL.gold, up: 40, min: 3, max: 6, span: 1.6, stagger: 0.3 });
    }
  }

  function onCombatStart() {
    lastCardFx = { f: 'slash', t: 0 };
    enemyFx.clear();
    anchorCache.clear();
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

  sub('combat:start', onCombatStart);
  sub('combat:damage', onDamage);
  sub('combat:block', onBlock);
  sub('combat:heal', onHeal);
  sub('combat:status', onStatus);
  sub('combat:enemyDied', onEnemyDied);
  sub('combat:enemyMove', onEnemyMove);
  sub('combat:cardPlayed', onCardPlayed);
  sub('combat:cardDrawn', onCardDrawn);
  sub('combat:shuffle', onShuffle);
  sub('combat:cardExhausted', onExhaust);
  sub('combat:end', onCombatEnd);
  sub('run:gold', onGold);
  sub('run:relic', onRelic);
  sub('run:card', onRunCard);
  sub('meta:achievement', onAchievement);

  ensureStyle();

  try {
    if (hasDom()) {
      const boot = () => { watchScreens(); startAmbient(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else boot();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { live.length = 0; stopFireworks(); if (g2 && canvas) { g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, canvas.width, canvas.height); } }
      });
    }
  } catch (e) { /* ignore */ }

  // Small public helper surface, for other UI code that wants the same juice
  DS.fx = {
    floatAt(uid, text, cls) {
      if (!hasDom()) return;
      const a = anchorOrFallback(uid);
      if (a) floatText(a, String(text), cls || 'ds-float-damage', { size: 24, dy: -a.h * 0.15 });
    },
    flash(kind, ms) { if (hasDom()) flash(kind || 'red', ms || 480); },
    screenShake(big) { if (hasDom()) screenShake(big === undefined ? 0.35 : big); },
    burst(uid, opts) { if (hasDom()) { const a = anchorOrFallback(uid); if (a) burst(a, opts || {}); } },
    confetti(n) { if (hasDom()) confetti(clamp(Number(n) || 60, 1, 120)); },
    fireworks() { startFireworks(); },
    ambient(on) { if (on === false) { if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; } } else startAmbient(); },
    get particles() { return live.length; },
  };
})();
