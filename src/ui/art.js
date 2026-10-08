(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});
  const ART = (DS.art = DS.art || {});

  const HAS_DOM = typeof document !== 'undefined';
  const EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif";

  // ------------------------------------------------------------------ small utilities
  function hash(s) {
    s = String(s === undefined || s === null ? '' : s);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32: deterministic PRNG so that art never depends on Math.random
  function rngOf(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function f(n) {
    return String(Math.round(n * 10) / 10);
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseColor(c) {
    if (typeof c !== 'string') return null;
    c = c.trim();
    let m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) {
      const s = m[1];
      return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
    }
    m = /^#([0-9a-f]{6})/i.exec(c);
    if (m) {
      const s = m[1];
      return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    }
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
    if (m) return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
    return null;
  }

  function toHex(rgb) {
    let s = '#';
    for (let i = 0; i < 3; i++) {
      const v = Math.max(0, Math.min(255, Math.round(rgb[i])));
      s += (v < 16 ? '0' : '') + v.toString(16);
    }
    return s;
  }

  function mix(a, b, t) {
    const A = parseColor(a) || [128, 128, 128];
    const B = parseColor(b) || [128, 128, 128];
    return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }
  const light = (c, t) => mix(c, '#ffffff', t);
  const dark = (c, t) => mix(c, '#000000', t);
  function desat(c, t) {
    const A = parseColor(c) || [128, 128, 128];
    const g = A[0] * 0.3 + A[1] * 0.59 + A[2] * 0.11;
    return mix(c, toHex([g, g, g]), t);
  }

  function pick(r, arr) {
    return arr[Math.floor(r() * arr.length) % arr.length];
  }

  // a path of tiny circles (one element for many dots)
  function dotsPath(pts) {
    let d = '';
    for (const p of pts) {
      const rad = p[2];
      d += 'M' + f(p[0] - rad) + ' ' + f(p[1]) + 'a' + f(rad) + ' ' + f(rad) + ' 0 1 0 ' + f(rad * 2) + ' 0a' + f(rad) + ' ' + f(rad) + ' 0 1 0 ' + f(-rad * 2) + ' 0';
    }
    return d;
  }

  function sparkle(x, y, s) {
    return (
      'M' + f(x) + ' ' + f(y - s) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + s) + ' ' + f(y) +
      'Q' + f(x) + ' ' + f(y) + ' ' + f(x) + ' ' + f(y + s) +
      'Q' + f(x) + ' ' + f(y) + ' ' + f(x - s) + ' ' + f(y) +
      'Q' + f(x) + ' ' + f(y) + ' ' + f(x) + ' ' + f(y - s) + 'Z'
    );
  }

  // bounded markup caches
  function makeCache(limit) {
    const m = new Map();
    return {
      get: (k) => m.get(k),
      set: (k, v) => {
        if (m.size >= limit) m.clear();
        m.set(k, v);
      }
    };
  }

  // ------------------------------------------------------------------ styles
  let styled = false;
  const CSS =
    '.ds-art{position:relative;display:inline-block;line-height:0;vertical-align:middle}' +
    '.ds-art svg{display:block;width:100%;height:100%}' +
    '.ds-art-card{display:block;width:100%;height:100%;border-radius:inherit;overflow:hidden}' +
    '.ds-art-unit svg{overflow:visible}' +
    '.ds-art-relic,.ds-art-potion{width:1.7em;height:1.7em}' +
    '.ds-ua-bob{animation:ds-art-bob 3.4s ease-in-out infinite}' +
    '.ds-ua-pulse{transform-box:fill-box;transform-origin:center;animation:ds-art-pulse 2.8s ease-in-out infinite}' +
    '.ds-ua-spin{transform-box:view-box;transform-origin:50px 50px;animation:ds-art-spin 46s linear infinite}' +
    '.ds-ua-spin-r{transform-box:view-box;transform-origin:50px 50px;animation:ds-art-spin 70s linear infinite reverse}' +
    '.ds-ca-twinkle{animation:ds-art-twinkle 2.6s ease-in-out infinite}' +
    '@keyframes ds-art-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.2px)}}' +
    '@keyframes ds-art-pulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}' +
    '@keyframes ds-art-spin{to{transform:rotate(360deg)}}' +
    '@keyframes ds-art-twinkle{0%,100%{opacity:.35}50%{opacity:1}}' +
    '.ds-backdrop{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0}' +
    '.ds-backdrop svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}' +
    '.ds-bd-d1{animation:ds-bd-drift 52s ease-in-out infinite alternate}' +
    '.ds-bd-d2{animation:ds-bd-drift 80s ease-in-out infinite alternate-reverse}' +
    '.ds-bd-d3{animation:ds-bd-drift 120s ease-in-out infinite alternate}' +
    '.ds-bd-rise{animation:ds-bd-rise 12s linear infinite;opacity:0}' +
    '.ds-bd-fall{animation:ds-bd-fall 16s linear infinite;opacity:0}' +
    '.ds-bd-flicker{animation:ds-bd-flicker 2.4s ease-in-out infinite}' +
    '.ds-bd-flame{transform-box:fill-box;transform-origin:50% 100%;animation:ds-bd-flame 1.3s ease-in-out infinite alternate}' +
    '.ds-bd-sway{transform-box:fill-box;transform-origin:50% 0;animation:ds-bd-sway 6s ease-in-out infinite alternate}' +
    '.ds-bd-twinkle{animation:ds-art-twinkle 4s ease-in-out infinite}' +
    '.ds-bd-spin{transform-box:view-box;transform-origin:800px 520px;animation:ds-art-spin 240s linear infinite}' +
    '.ds-bd-breathe{animation:ds-bd-breathe 9s ease-in-out infinite alternate}' +
    '@keyframes ds-bd-drift{from{transform:translateX(-46px)}to{transform:translateX(46px)}}' +
    '@keyframes ds-bd-rise{0%{transform:translateY(0);opacity:0}12%{opacity:.9}100%{transform:translateY(-460px);opacity:0}}' +
    '@keyframes ds-bd-fall{0%{transform:translate(0,-40px);opacity:0}10%{opacity:.7}100%{transform:translate(-90px,520px);opacity:0}}' +
    '@keyframes ds-bd-flicker{0%,100%{opacity:.8}30%{opacity:1}55%{opacity:.62}75%{opacity:.95}}' +
    '@keyframes ds-bd-flame{from{transform:scale(1,.9) skewX(-3deg)}to{transform:scale(.94,1.1) skewX(3deg)}}' +
    '@keyframes ds-bd-sway{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}' +
    '@keyframes ds-bd-breathe{from{opacity:.55}to{opacity:1}}' +
    '@media (prefers-reduced-motion: reduce){.ds-art *,.ds-backdrop *{animation:none!important}}';

  function ensureStyle() {
    if (styled || !HAS_DOM) return;
    styled = true;
    try {
      const st = document.createElement('style');
      st.id = 'ds-art-style';
      st.textContent = CSS;
      (document.head || document.documentElement || document.body).appendChild(st);
    } catch (e) {
      /* style injection is cosmetic */
    }
  }

  // ------------------------------------------------------------------ element helper
  function holder(cls, svg, styleText, tag) {
    ensureStyle();
    const node = document.createElement(tag || 'div');
    node.className = cls;
    if (styleText) node.style.cssText = styleText;
    node.innerHTML = svg;
    return node;
  }

  function emojiText(x, y, size, ch, extra) {
    return (
      '<text x="' + f(x) + '" y="' + f(y) + '" font-size="' + f(size) + '" text-anchor="middle" dominant-baseline="central"' +
      ' font-family="' + EMOJI_FONT + '"' + (extra || '') + '>' + esc(ch) + '</text>'
    );
  }

  // ================================================================== CARD ART
  const FIXED_PALETTE = { colorless: '#9aa4b2', curse: '#7b2a5c', status: '#6f7580' };
  const RICHNESS = { starter: 0, common: 0, uncommon: 1, rare: 2, special: 1 };

  function charColor(cls) {
    try {
      const ch = cls && DS.characters ? DS.characters[cls] : null;
      return ch && parseColor(ch.color) ? ch.color : null;
    } catch (e) {
      return null;
    }
  }

  function cardColor(d) {
    const t = d.type;
    if (t === 'curse' || d.class === 'curse') return FIXED_PALETTE.curse;
    if (t === 'status' || d.class === 'status') return FIXED_PALETTE.status;
    return charColor(d.class) || (/^#|^rgb/i.test(String(d.color || '')) && parseColor(d.color) ? d.color : FIXED_PALETTE.colorless);
  }

  function slashPath(cx, cy, len, thick, ang) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const ax = cx - c * len / 2;
    const ay = cy - s * len / 2;
    const bx = cx + c * len / 2;
    const by = cy + s * len / 2;
    const nx = -s;
    const ny = c;
    return (
      'M' + f(ax) + ' ' + f(ay) + 'Q' + f(cx + nx * thick) + ' ' + f(cy + ny * thick) + ' ' + f(bx) + ' ' + f(by) +
      'Q' + f(cx + nx * thick * 0.18) + ' ' + f(cy + ny * thick * 0.18) + ' ' + f(ax) + ' ' + f(ay) + 'Z'
    );
  }

  function crackPath(r, sx, sy, tx, ty, segs) {
    let x = sx;
    let y = sy;
    let d = 'M' + f(x) + ' ' + f(y);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      x = sx + (tx - sx) * t + (r() - 0.5) * 16;
      y = sy + (ty - sy) * t + (r() - 0.5) * 12;
      d += 'L' + f(x) + ' ' + f(y);
    }
    return d;
  }

  const cardCache = makeCache(1500);

  function motifAttack(r, col, lt, rich, g) {
    let out = '';
    const n = 9 + rich * 3 + Math.floor(r() * 4);
    const a0 = r() * 6.283;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.283) / n + (r() - 0.5) * 0.25;
      const w = 0.05 + r() * 0.06;
      d += 'M75 45L' + f(75 + Math.cos(a - w) * 120) + ' ' + f(45 + Math.sin(a - w) * 80) + 'L' + f(75 + Math.cos(a + w) * 120) + ' ' + f(45 + Math.sin(a + w) * 80) + 'Z';
    }
    out += '<path d="' + d + '" fill="' + lt + '" opacity=".17"/>';
    const th = -0.62 + (r() - 0.5) * 0.5;
    out += '<path d="' + slashPath(75, 46, 128, 15, th) + '" fill="url(#' + g + 's)" opacity=".62"/>';
    out += '<path d="' + slashPath(80, 40, 108, 9, th - 0.07) + '" fill="' + lt + '" opacity=".34"/>';
    if (rich > 0) out += '<path d="' + slashPath(70, 54, 96, 7, th + 0.1) + '" fill="' + col + '" opacity=".5"/>';
    const pts = [];
    for (let i = 0; i < 5 + rich; i++) pts.push([75 + (r() - 0.5) * 90, 45 + (r() - 0.5) * 56, 0.7 + r() * 1.1]);
    out += '<path d="' + dotsPath(pts) + '" fill="#fff" opacity=".8"/>';
    return out;
  }

  function motifSkill(r, col, lt, rich) {
    let out = '';
    out += '<path d="M75 11L109 23V46Q109 71 75 83Q41 71 41 46V23Z" fill="' + lt + '" fill-opacity=".08" stroke="' + lt + '" stroke-opacity=".42" stroke-width="1.3"/>';
    out += '<circle cx="75" cy="45" r="36" fill="none" stroke="' + lt + '" stroke-opacity=".38" stroke-width="1.2" stroke-dasharray="2 4.5"/>';
    out += '<circle cx="75" cy="45" r="27" fill="none" stroke="' + lt + '" stroke-opacity=".28" stroke-width="1"/>';
    out += '<circle cx="75" cy="45" r="46" fill="none" stroke="' + lt + '" stroke-opacity=".16" stroke-width="1"/>';
    let d = '';
    const n = 12 + rich * 4;
    const a0 = r() * 6.283;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.283) / n;
      d += 'M' + f(75 + Math.cos(a) * 38) + ' ' + f(45 + Math.sin(a) * 38) + 'L' + f(75 + Math.cos(a) * 44) + ' ' + f(45 + Math.sin(a) * 44);
    }
    out += '<path d="' + d + '" stroke="' + lt + '" stroke-opacity=".4" stroke-width="1.2" fill="none"/>';
    return out;
  }

  function motifPower(r, col, lt, rich) {
    let out = '';
    const n = 8 + rich * 2;
    const a0 = r() * 6.283;
    let d1 = '';
    let d2 = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.283) / n;
      const pt = (ang, rad) => f(75 + Math.cos(ang) * rad * 1.5) + ' ' + f(45 + Math.sin(ang) * rad);
      d1 += 'M75 45Q' + pt(a - 0.3, 26) + ' ' + pt(a, 46) + 'Q' + pt(a + 0.3, 26) + ' 75 45Z';
      d2 += 'M75 45Q' + pt(a + 3.14159 / n - 0.2, 14) + ' ' + pt(a + 3.14159 / n, 27) + 'Q' + pt(a + 3.14159 / n + 0.2, 14) + ' 75 45Z';
    }
    out += '<path d="' + d1 + '" fill="' + lt + '" fill-opacity=".12" stroke="' + lt + '" stroke-opacity=".3" stroke-width=".7"/>';
    out += '<path d="' + d2 + '" fill="' + lt + '" fill-opacity=".2"/>';
    out += '<circle cx="75" cy="45" r="22" fill="none" stroke="' + lt + '" stroke-opacity=".4" stroke-width="1" stroke-dasharray="1.5 3"/>';
    out += '<circle cx="75" cy="45" r="40" fill="none" stroke="' + lt + '" stroke-opacity=".2" stroke-width="1"/>';
    const pts = [];
    for (let i = 0; i < 6 + rich * 2; i++) pts.push([r() * 150, r() * 90, 0.5 + r() * 0.8]);
    out += '<path d="' + dotsPath(pts) + '" fill="' + lt + '" opacity=".7"/>';
    return out;
  }

  function motifCurse(r, col, lt) {
    let out = '';
    out += '<ellipse cx="75" cy="48" rx="52" ry="30" fill="url(#' + 'GID' + 'm)" opacity=".5"/>';
    const c1 = crackPath(r, r() * 150, 0, 60 + r() * 30, 52, 6);
    const c2 = crackPath(r, r() > 0.5 ? 0 : 150, 20 + r() * 40, 70 + r() * 10, 48, 5);
    out += '<path d="' + c1 + c2 + '" stroke="#000" stroke-width="2.6" fill="none" opacity=".85" stroke-linejoin="bevel"/>';
    out += '<path d="' + c1 + c2 + '" stroke="' + lt + '" stroke-width=".7" fill="none" opacity=".7" stroke-linejoin="bevel"/>';
    let d = '';
    for (let x = -2; x < 152; x += 11 + Math.floor(r() * 4)) {
      const h = 7 + r() * 15;
      d += 'M' + f(x) + ' 90L' + f(x + 5) + ' ' + f(90 - h) + 'L' + f(x + 10) + ' 90Z';
    }
    for (let x = 4; x < 150; x += 26 + Math.floor(r() * 10)) {
      const h = 5 + r() * 9;
      d += 'M' + f(x) + ' 0L' + f(x + 4) + ' ' + f(h) + 'L' + f(x + 8) + ' 0Z';
    }
    out += '<path d="' + d + '" fill="#06020a" opacity=".92"/>';
    return out;
  }

  function motifStatus(r, col, lt) {
    let d = '';
    for (let i = 0; i < 20; i++) {
      const y = 3 + i * 4.4 + r() * 1.5;
      const x = r() * 130;
      d += 'M' + f(x) + ' ' + f(y) + 'h' + f(8 + r() * 36);
    }
    let out = '<path d="' + d + '" stroke="' + lt + '" stroke-width="1" opacity=".22" fill="none"/>';
    let d2 = '';
    for (let i = 0; i < 6; i++) d2 += 'M0 ' + f(10 + i * 15 + r() * 5) + 'h150';
    out += '<path d="' + d2 + '" stroke="#000" stroke-width="2" opacity=".25" fill="none"/>';
    const pts = [];
    for (let i = 0; i < 16; i++) pts.push([r() * 150, r() * 90, 0.5 + r() * 0.7]);
    out += '<path d="' + dotsPath(pts) + '" fill="' + lt + '" opacity=".32"/>';
    return out;
  }

  function ambient(kind, r, col, lt, rich, g) {
    if (kind === 0) {
      const pts = [];
      const pts2 = [];
      for (let i = 0; i < 7 + rich * 2; i++) pts.push([r() * 150, 30 + r() * 60, 0.5 + r() * 0.9]);
      for (let i = 0; i < 4; i++) pts2.push([r() * 150, 40 + r() * 50, 1.4 + r()]);
      return '<path d="' + dotsPath(pts2) + '" fill="' + col + '" opacity=".3"/><path d="' + dotsPath(pts) + '" fill="' + light(col, 0.55) + '" opacity=".8"/>';
    }
    if (kind === 1) {
      return (
        '<ellipse cx="' + f(20 + r() * 40) + '" cy="' + f(66 + r() * 14) + '" rx="60" ry="11" fill="url(#' + g + 'm)"/>' +
        '<ellipse cx="' + f(90 + r() * 40) + '" cy="' + f(24 + r() * 14) + '" rx="48" ry="9" fill="url(#' + g + 'm)" opacity=".8"/>'
      );
    }
    if (kind === 2) {
      let x = 25 + r() * 100;
      let d = 'M' + f(x) + ' 0';
      for (let y = 10; y <= 64; y += 9) {
        x += (r() - 0.5) * 26;
        d += 'L' + f(x) + ' ' + f(y);
      }
      return (
        '<path d="' + d + '" stroke="' + col + '" stroke-width="4" fill="none" opacity=".3" stroke-linejoin="bevel"/>' +
        '<path d="' + d + '" stroke="#fff" stroke-width="1.1" fill="none" opacity=".85" stroke-linejoin="bevel"/>'
      );
    }
    const vc = mix(col, '#4a9a4a', 0.6);
    const left = r() > 0.5;
    const sx = left ? 0 : 150;
    const dir = left ? 1 : -1;
    let d = 'M' + sx + ' 90C' + f(sx + dir * 20) + ' 70 ' + f(sx + dir * 6) + ' 52 ' + f(sx + dir * 30) + ' 38S' + f(sx + dir * 24) + ' 14 ' + f(sx + dir * 44) + ' 6';
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push([sx + dir * (6 + r() * 36), 10 + i * 12 + r() * 6, 1.4 + r()]);
    return '<path d="' + d + '" stroke="' + vc + '" stroke-width="1.6" fill="none" opacity=".7"/><path d="' + dotsPath(pts) + '" fill="' + light(vc, 0.25) + '" opacity=".75"/>';
  }

  function cardSvg(d) {
    const key = [d.id || d.name || '?', d.upgraded ? 1 : 0, d.type || '', d.rarity || '', d.class || '', d.icon || ''].join('|');
    const cached = cardCache.get(key);
    if (cached) return cached;
    const h = hash(key);
    const r = rngOf(h);
    const g = 'c' + h.toString(36);
    const type = d.type || 'skill';
    const col = cardColor(d);
    const rich = RICHNESS[d.rarity] === undefined ? 0 : RICHNESS[d.rarity];
    const lt = light(col, type === 'status' ? 0.25 : 0.5);

    let bgIn;
    let bgOut;
    if (type === 'curse') {
      bgIn = mix(col, '#0a0408', 0.62);
      bgOut = '#07030a';
    } else if (type === 'status') {
      bgIn = '#3a3e46';
      bgOut = '#121418';
    } else {
      bgIn = mix(col, '#0d0916', 0.5);
      bgOut = mix(col, '#050309', 0.88);
    }

    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 90" preserveAspectRatio="xMidYMid slice">';
    s += '<defs>';
    s += '<radialGradient id="' + g + 'b" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="' + bgIn + '"/><stop offset="1" stop-color="' + bgOut + '"/></radialGradient>';
    s += '<radialGradient id="' + g + 'g"><stop offset="0" stop-color="' + light(col, 0.35) + '" stop-opacity=".75"/><stop offset=".55" stop-color="' + col + '" stop-opacity=".25"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient>';
    s += '<radialGradient id="' + g + 'm"><stop offset="0" stop-color="' + light(col, 0.6) + '" stop-opacity=".4"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient>';
    s += '<linearGradient id="' + g + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="' + lt + '" stop-opacity="0"/></linearGradient>';
    s += '<linearGradient id="' + g + 'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>';
    s += '<radialGradient id="' + g + 'v" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>';
    s += '</defs>';
    s += '<rect width="150" height="90" fill="url(#' + g + 'b)"/>';

    if (type === 'attack') s += motifAttack(r, col, lt, rich, g);
    else if (type === 'power') s += motifPower(r, col, lt, rich);
    else if (type === 'curse') s += motifCurse(r, col, lt).split('GID').join(g);
    else if (type === 'status') s += motifStatus(r, col, lt);
    else s += motifSkill(r, col, lt, rich);

    if (type !== 'status') {
      const count = 1 + rich;
      let k = h % 4;
      for (let i = 0; i < count; i++) {
        let kind = (k + i) % 4;
        if (type === 'curse' && kind === 2) kind = 1;
        s += ambient(kind, r, col, lt, rich, g);
      }
    }

    s += '<rect y="52" width="150" height="38" fill="url(#' + g + 'f)"/>';

    if (rich >= 1) {
      s += '<rect x="1.5" y="1.5" width="147" height="87" rx="4" fill="none" stroke="' + (rich >= 2 ? '#e8c25a' : lt) + '" stroke-opacity="' + (rich >= 2 ? '.55' : '.3') + '" stroke-width="1"/>';
    }
    if (rich >= 2) {
      s += '<path class="ds-ca-twinkle" d="' + sparkle(20 + r() * 20, 14 + r() * 14, 4) + sparkle(110 + r() * 25, 60 + r() * 18, 3.2) + sparkle(120 + r() * 20, 14 + r() * 10, 2.4) + '" fill="#ffe9a8"/>';
    }
    if (d.upgraded) {
      s += '<circle cx="75" cy="45" r="35" fill="none" stroke="#9fe6a0" stroke-opacity=".38" stroke-width="1.2"/>';
      s += '<path d="' + sparkle(136, 14, 5) + '" fill="#c9ffc4" opacity=".95"/>';
    }

    // centrepiece
    s += '<circle cx="75" cy="45" r="33" fill="url(#' + g + 'g)"/>';
    s += '<ellipse cx="75" cy="73" rx="23" ry="3.6" fill="#000" opacity=".4"/>';
    s += emojiText(75, 45, 42, d.icon || '❓', ' style="filter:drop-shadow(0 2.2px 1.8px rgba(0,0,0,.65))"');
    s += '<rect width="150" height="90" fill="url(#' + g + 'v)"/>';
    s += '</svg>';
    cardCache.set(key, s);
    return s;
  }

  function fallbackCardEl(d) {
    const node = document.createElement('div');
    node.className = 'ds-art ds-art-card';
    node.textContent = (d && d.icon) || '❓';
    return node;
  }

  const lazyObs = { io: null };

  // cardArt(cardData, {lazy}) -> HTMLElement
  function cardArt(data, opts) {
    if (!HAS_DOM) return null;
    try {
      const d = data && typeof data === 'object' ? data : {};
      ensureStyle();
      const node = document.createElement('div');
      node.className = 'ds-art ds-art-card';
      if (opts && opts.lazy && typeof IntersectionObserver !== 'undefined') {
        if (!lazyObs.io) {
          lazyObs.io = new IntersectionObserver(
            (entries) => {
              for (const en of entries) {
                if (!en.isIntersecting) continue;
                const t = en.target;
                lazyObs.io.unobserve(t);
                try {
                  t.innerHTML = cardSvg(t.__dsCard || {});
                  t.__dsCard = null;
                } catch (e) {
                  /* leave placeholder */
                }
              }
            },
            { rootMargin: '200px' }
          );
        }
        node.__dsCard = d;
        lazyObs.io.observe(node);
        return node;
      }
      node.innerHTML = cardSvg(d);
      return node;
    } catch (e) {
      return fallbackCardEl(data);
    }
  }

  // ================================================================== UNIT ART
  const ACT_PAL = {
    1: { main: '#b5603a', alt: '#6a4f44', glow: '#ff9a4a', ground: '#1a1210' },
    2: { main: '#2fa8a0', alt: '#b8923a', glow: '#6ff0e0', ground: '#06181c' },
    3: { main: '#8a5fd6', alt: '#cdd3ff', glow: '#e8e0ff', ground: '#0b0818' }
  };

  const unitCache = makeCache(600);

  function unitSvg(def, isChar) {
    const tier = isChar ? 'char' : def.tier || 'normal';
    const act = def.act === 2 || def.act === 3 ? def.act : 1;
    const pal = ACT_PAL[act];
    const key = [def.id || def.name || '?', tier, act, def.color || '', def.icon || ''].join('|');
    const cached = unitCache.get(key);
    if (cached) return cached;
    const h = hash(key);
    const r = rngOf(h);
    const g = 'u' + h.toString(36);
    let main = pal.main;
    let glow = pal.glow;
    let alt = pal.alt;
    if (isChar) {
      main = parseColor(def.color) ? def.color : '#c9a35a';
      glow = light(main, 0.5);
      alt = dark(main, 0.5);
    } else if (tier === 'elite') {
      main = mix(pal.main, '#d02a3a', 0.65);
      glow = '#ff6a5a';
    } else if (tier === 'boss') {
      main = mix(pal.main, '#ffffff', 0.05);
    }
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">';
    s += '<defs>';
    s += '<radialGradient id="' + g + 'a"><stop offset="0" stop-color="' + glow + '" stop-opacity=".62"/><stop offset=".6" stop-color="' + main + '" stop-opacity=".22"/><stop offset="1" stop-color="' + main + '" stop-opacity="0"/></radialGradient>';
    s += '<radialGradient id="' + g + 'h"><stop offset=".6" stop-color="#d02a3a" stop-opacity="0"/><stop offset=".85" stop-color="#e03a48" stop-opacity=".5"/><stop offset="1" stop-color="#d02a3a" stop-opacity="0"/></radialGradient>';
    s += '</defs>';

    if (tier === 'boss') {
      // ornate animated aura: crown of rays, spinning rings, bright pulsing core
      const n = 12;
      let rays = '';
      for (let i = 0; i < n; i++) {
        const a = (i * 6.283) / n;
        const long = i % 2 === 0;
        const R = long ? 49 : 40;
        rays += 'M' + f(50 + Math.cos(a - 0.08) * 24) + ' ' + f(50 + Math.sin(a - 0.08) * 24) + 'L' + f(50 + Math.cos(a) * R) + ' ' + f(50 + Math.sin(a) * R) + 'L' + f(50 + Math.cos(a + 0.08) * 24) + ' ' + f(50 + Math.sin(a + 0.08) * 24) + 'Z';
      }
      s += '<circle class="ds-ua-pulse" cx="50" cy="46" r="48" fill="url(#' + g + 'a)"/>';
      s += '<g class="ds-ua-spin"><path d="' + rays + '" fill="' + glow + '" opacity=".28"/></g>';
      s += '<g class="ds-ua-spin-r"><circle cx="50" cy="50" r="40" fill="none" stroke="' + alt + '" stroke-opacity=".6" stroke-width="1" stroke-dasharray="3 3.5"/>';
      s += '<circle cx="50" cy="50" r="46" fill="none" stroke="' + glow + '" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="1 5"/></g>';
      s += '<circle cx="50" cy="50" r="33" fill="none" stroke="' + glow + '" stroke-opacity=".55" stroke-width="1.2"/>';
      s += '<path d="M50 6L54 16L50 12L46 16Z M50 94L54 84L50 88L46 84Z M6 50L16 46L12 50L16 54Z M94 50L84 46L88 50L84 54Z" fill="' + alt + '" opacity=".85"/>';
    } else if (tier === 'elite') {
      // spiked crimson halo
      const spikes = 12 + (h % 3) * 2;
      let d = '';
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const rad = i % 2 === 0 ? 46 : 33;
        d += (i === 0 ? 'M' : 'L') + f(50 + Math.cos(a) * rad) + ' ' + f(48 + Math.sin(a) * rad);
      }
      s += '<circle class="ds-ua-pulse" cx="50" cy="48" r="49" fill="url(#' + g + 'h)"/>';
      s += '<circle cx="50" cy="48" r="40" fill="url(#' + g + 'a)"/>';
      s += '<path d="' + d + 'Z" fill="#8a1424" fill-opacity=".34" stroke="#ff4a4a" stroke-opacity=".6" stroke-width="1" stroke-linejoin="miter"/>';
    } else {
      // subtle: soft aura plus a hooded silhouette backdrop
      s += '<circle cx="50" cy="48" r="40" fill="url(#' + g + 'a)"/>';
      s += '<path d="M20 90Q18 24 50 18Q82 24 80 90Z" fill="' + dark(alt, 0.5) + '" opacity=".3"/>';
      if (isChar) s += '<circle cx="50" cy="48" r="33" fill="none" stroke="' + glow + '" stroke-opacity=".4" stroke-width="1"/>';
    }

    const pts = [];
    const nsp = tier === 'boss' ? 9 : tier === 'elite' ? 6 : 4;
    for (let i = 0; i < nsp; i++) pts.push([10 + r() * 80, 12 + r() * 62, 0.5 + r() * 0.9]);
    s += '<path d="' + dotsPath(pts) + '" fill="' + glow + '" opacity=".6"/>';
    s += '<ellipse cx="50" cy="86" rx="' + (tier === 'boss' ? 34 : 27) + '" ry="5" fill="#000" opacity=".5"/>';
    s += '<g class="ds-ua-bob" style="animation-delay:-' + f((h % 30) / 10) + 's">';
    s += emojiText(50, 52, tier === 'boss' ? 58 : 52, def.icon || '❓', ' style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.7))"');
    s += '</g></svg>';
    unitCache.set(key, s);
    return s;
  }

  // unitArt(def, {size}) -> HTMLElement  (enemy def or character def)
  function unitArt(def, opts) {
    if (!HAS_DOM) return null;
    opts = opts || {};
    const d = def && typeof def === 'object' ? def : {};
    let size = Number(opts.size);
    if (!(size > 0)) size = Math.round(96 * (Number(d.scale) > 0 ? Number(d.scale) : 1));
    const st = 'width:' + size + 'px;height:' + size + 'px;';
    try {
      const isChar = !!(d.starterDeck || d.starterRelic || (d.title && !d.moves) || opts.character);
      return holder('ds-art ds-art-unit' + (d.tier ? ' ds-art-tier-' + d.tier : ''), unitSvg(d, isChar), st);
    } catch (e) {
      const n = document.createElement('div');
      n.className = 'ds-art ds-art-unit';
      n.style.cssText = st + 'font-size:' + Math.round(size * 0.6) + 'px;line-height:' + size + 'px;text-align:center';
      n.textContent = d.icon || '❓';
      return n;
    }
  }

  // ================================================================== RELIC / POTION ICONS
  const RELIC_RING = {
    starter: '#9aa3b0', common: '#b7bec8', uncommon: '#4fa3e8', rare: '#f0c040',
    boss: '#e0503c', shop: '#4fd0a0', event: '#b070e0', special: '#d8a0f0'
  };

  const iconCache = makeCache(600);

  function relicSvg(def) {
    const key = 'r|' + (def.id || def.name || '?') + '|' + (def.rarity || '') + '|' + (def.icon || '');
    const c = iconCache.get(key);
    if (c) return c;
    const h = hash(key);
    const g = 'r' + h.toString(36);
    const ring = RELIC_RING[def.rarity] || RELIC_RING.common;
    let ticks = '';
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      ticks += 'M' + f(24 + Math.cos(a) * 19) + ' ' + f(24 + Math.sin(a) * 19) + 'L' + f(24 + Math.cos(a) * 21.5) + ' ' + f(24 + Math.sin(a) * 21.5);
    }
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs>';
    s += '<radialGradient id="' + g + 'b" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="' + mix(ring, '#1a1424', 0.62) + '"/><stop offset="1" stop-color="#0a0710"/></radialGradient>';
    s += '</defs>';
    s += '<circle cx="24" cy="24" r="22" fill="url(#' + g + 'b)" stroke="' + ring + '" stroke-width="2.4"/>';
    s += '<circle cx="24" cy="24" r="18" fill="none" stroke="' + light(ring, 0.3) + '" stroke-opacity=".4" stroke-width=".8"/>';
    s += '<path d="' + ticks + '" stroke="' + ring + '" stroke-opacity=".7" stroke-width="1" fill="none"/>';
    if (def.rarity === 'rare' || def.rarity === 'boss') {
      s += '<path d="' + dotsPath([[24, 2.4, 1.7], [24, 45.6, 1.7], [2.4, 24, 1.7], [45.6, 24, 1.7]]) + '" fill="' + light(ring, 0.55) + '"/>';
    }
    s += '<path d="M9 17Q24 6 39 17" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2" stroke-linecap="round"/>';
    s += emojiText(24, 25, 23, def.icon || '❓', ' style="filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))"');
    s += '</svg>';
    iconCache.set(key, s);
    return s;
  }

  function potionSvg(def) {
    const color = parseColor(def.color) ? def.color : '#7aa0d8';
    const key = 'p|' + (def.id || def.name || '?') + '|' + color + '|' + (def.rarity || '') + '|' + (def.icon || '');
    const c = iconCache.get(key);
    if (c) return c;
    const h = hash(key);
    const g = 'p' + h.toString(36);
    const ring = RELIC_RING[def.rarity] || RELIC_RING.common;
    const body = 'M19 14L19 19C10 24 8 30 8 36C8 42 14 45.5 24 45.5C34 45.5 40 42 40 36C40 30 38 24 29 19L29 14Z';
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs>';
    s += '<clipPath id="' + g + 'c"><path d="' + body + '"/></clipPath>';
    s += '<linearGradient id="' + g + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + light(color, 0.35) + '"/><stop offset="1" stop-color="' + dark(color, 0.35) + '"/></linearGradient>';
    s += '</defs>';
    s += '<path d="' + body + '" fill="#10141c" fill-opacity=".7"/>';
    s += '<g clip-path="url(#' + g + 'c)"><rect x="0" y="26" width="48" height="24" fill="url(#' + g + 'l)"/>';
    s += '<ellipse cx="24" cy="26" rx="17" ry="2.4" fill="' + light(color, 0.5) + '" opacity=".8"/></g>';
    s += '<path d="' + body + '" fill="none" stroke="' + ring + '" stroke-width="1.8" stroke-linejoin="round"/>';
    s += '<rect x="18" y="9" width="12" height="5" rx="1.5" fill="#b08850" stroke="#5a4020" stroke-width=".8"/>';
    s += '<path d="M13 30Q12 35 15 39" stroke="#fff" stroke-opacity=".4" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    s += '<path d="' + dotsPath([[19, 34, 1.3], [29, 38, 1], [27, 31, 0.8]]) + '" fill="#fff" opacity=".45"/>';
    s += emojiText(24, 33, 15, def.icon || '❓', ' style="filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))"');
    s += '</svg>';
    iconCache.set(key, s);
    return s;
  }

  function iconEl(cls, svgFn, def, opts) {
    if (!HAS_DOM) return null;
    const d = def && typeof def === 'object' ? def : {};
    let st = '';
    const size = Number(opts && opts.size);
    if (size > 0) st = 'width:' + size + 'px;height:' + size + 'px;';
    try {
      return holder('ds-art ' + cls, svgFn(d), st, 'span');
    } catch (e) {
      const n = document.createElement('span');
      n.className = 'ds-art ' + cls;
      n.textContent = d.icon || '❓';
      return n;
    }
  }

  const relicIcon = (def, opts) => iconEl('ds-art-relic', relicSvg, def, opts);
  const potionIcon = (def, opts) => iconEl('ds-art-potion', potionSvg, def, opts);

  // ================================================================== BACKDROPS
  const bdCache = makeCache(80);

  function lin(id, stops, x2, y2) {
    let s = '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">';
    for (const st of stops) s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' + (st[2] !== undefined ? ' stop-opacity="' + st[2] + '"' : '') + '/>';
    return s + '</linearGradient>';
  }

  function rad(id, stops) {
    let s = '<radialGradient id="' + id + '">';
    for (const st of stops) s += '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"' + (st[2] !== undefined ? ' stop-opacity="' + st[2] + '"' : '') + '/>';
    return s + '</radialGradient>';
  }

  // rising/falling particles: circles with negative animation delays so they are mid-flight at load
  function particles(r, n, cls, x0, x1, y0, y1, r0, r1, fill, stroke) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const rr = r0 + r() * (r1 - r0);
      s +=
        '<circle class="' + cls + '" cx="' + f(x0 + r() * (x1 - x0)) + '" cy="' + f(y0 + r() * (y1 - y0)) + '" r="' + f(rr) + '" ' +
        (stroke ? 'fill="none" stroke="' + fill + '" stroke-width="1.6"' : 'fill="' + fill + '"') +
        ' style="animation-delay:-' + f(r() * 16) + 's;animation-duration:' + f(9 + r() * 9) + 's"/>';
    }
    return s;
  }

  function starField(r, n, y0, y1, fill) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([r() * 1600, y0 + r() * (y1 - y0), 0.7 + r() * 1.3]);
    let s = '<path d="' + dotsPath(pts) + '" fill="' + fill + '" opacity=".75"/>';
    for (let i = 0; i < 6; i++) {
      s += '<circle class="ds-bd-twinkle" cx="' + f(r() * 1600) + '" cy="' + f(y0 + r() * (y1 - y0)) + '" r="' + f(1.6 + r() * 1.4) + '" fill="#fff" style="animation-delay:-' + f(r() * 4) + 's"/>';
    }
    return s;
  }

  function ridge(r, base, amp, step, smooth, x0) {
    const pts = [];
    for (let x = (x0 === undefined ? -100 : x0); x <= 1700 + step; x += step) pts.push([x, base - r() * amp]);
    let d = 'M-100 900L' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    if (smooth) {
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        const my = (pts[i - 1][1] + pts[i][1]) / 2;
        d += 'Q' + f(pts[i - 1][0]) + ' ' + f(pts[i - 1][1]) + ' ' + f(mx) + ' ' + f(my);
      }
    } else {
      for (let i = 1; i < pts.length; i++) d += 'L' + f(pts[i][0]) + ' ' + f(pts[i][1]);
    }
    return d + 'L1800 900Z';
  }

  function archRow(r, spacing, pw, ySpring, apex) {
    let d = 'M-120 0H1800V900H-120Z';
    const ctrl = 2 * apex - ySpring;
    for (let x = -120; x < 1800; x += spacing) {
      const x1 = x + pw;
      const x2 = x + spacing;
      d += 'M' + f(x1) + ' 900L' + f(x1) + ' ' + f(ySpring) + 'Q' + f((x1 + x2) / 2) + ' ' + f(ctrl) + ' ' + f(x2) + ' ' + f(ySpring) + 'L' + f(x2) + ' 900Z';
    }
    return d;
  }

  function skyline(r, base, minH, maxH) {
    let x = -60;
    let d = 'M-60 900V' + f(base - minH);
    while (x < 1700) {
      const w = 46 + r() * 84;
      const h = minH + r() * (maxH - minH);
      const y = base - h;
      const t = r();
      d += 'H' + f(x) + 'V' + f(y);
      if (t < 0.25) d += 'L' + f(x + w / 2) + ' ' + f(y - 40 - r() * 60) + 'L' + f(x + w) + ' ' + f(y);
      else if (t < 0.42) d += 'Q' + f(x + w / 2) + ' ' + f(y - w * 0.85) + ' ' + f(x + w) + ' ' + f(y);
      else d += 'H' + f(x + w);
      x += w;
    }
    return d + 'V900Z';
  }

  function pine(x, base, h) {
    const w = h * 0.34;
    let d = '';
    for (let i = 0; i < 3; i++) {
      const y1 = base - h * (0.18 + i * 0.28);
      const y0 = y1 - h * 0.38;
      const ww = w * (1 - i * 0.26);
      d += 'M' + f(x - ww) + ' ' + f(y1) + 'L' + f(x) + ' ' + f(y0) + 'L' + f(x + ww) + ' ' + f(y1) + 'Z';
    }
    return d + 'M' + f(x - 5) + ' ' + f(base) + 'V' + f(base - h * 0.2) + 'H' + f(x + 5) + 'V' + f(base) + 'Z';
  }

  // ---- act scenes (also the base for map/combat/event/etc)
  function sceneAct1(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#0a090f'], [0.55, '#1c1511'], [1, '#2e1c12']]) + rad(p + 'e', [[0, '#ff8a3a', 0.55], [1, '#ff5a1a', 0]]) + rad(p + 't', [[0, '#ffb060', 0.8], [1, '#ff7a20', 0]]) + rad(p + 'm', [[0, '#b8a090', 0.22], [1, '#b8a090', 0]]) + lin(p + 'f', [[0, '#000', 0], [1, '#000', 0.7]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += '<ellipse class="ds-bd-breathe" cx="800" cy="900" rx="950" ry="400" fill="url(#' + p + 'e)"/>';
    s += '<g class="ds-bd-d3"><path d="' + archRow(r, 330, 70, 470, 270) + '" fill="#2a1d15" fill-rule="evenodd" opacity=".55"/></g>';
    s += '<g class="ds-bd-d2"><path d="' + archRow(r, 480, 120, 560, 250) + '" fill="#07050a" fill-rule="evenodd" opacity=".82"/></g>';
    for (let i = 0; i < 3; i++) {
      const x = 260 + i * 540 + r() * 60;
      s += '<circle class="ds-bd-flicker" cx="' + f(x) + '" cy="' + f(400 + r() * 60) + '" r="150" fill="url(#' + p + 't)" style="animation-delay:-' + f(r() * 2) + 's"/>';
      s += '<path d="M' + f(x - 7) + ' 440h14l-3 26h-8z" fill="#2a1a10"/>';
    }
    s += '<ellipse class="ds-bd-d1" cx="500" cy="780" rx="620" ry="90" fill="url(#' + p + 'm)"/>';
    s += '<ellipse class="ds-bd-d2" cx="1150" cy="840" rx="600" ry="80" fill="url(#' + p + 'm)"/>';
    s += particles(r, 18, 'ds-bd-rise', 100, 1500, 640, 900, 1.4, 3, '#ffa04a');
    s += '<rect y="560" width="1600" height="340" fill="url(#' + p + 'f)"/>';
    return s;
  }

  function sceneAct2(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#03121a'], [0.5, '#0a3640'], [1, '#115058']]) + lin(p + 'l', [[0, '#bff8ee', 0.34], [1, '#6fe0d0', 0]]) + rad(p + 'g', [[0, '#7fffe8', 0.35], [1, '#2fa8a0', 0]]) + lin(p + 'f', [[0, '#021012', 0], [1, '#021012', 0.85]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += '<ellipse class="ds-bd-breathe" cx="760" cy="0" rx="800" ry="300" fill="url(#' + p + 'g)"/>';
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 330 + r() * 80;
      const w = 50 + r() * 60;
      s += '<polygon class="' + (i % 2 ? 'ds-bd-d1' : 'ds-bd-d2') + '" points="' + f(x) + ',0 ' + f(x + w) + ',0 ' + f(x + w * 3.4 - 150) + ',800 ' + f(x - 190) + ',800" fill="url(#' + p + 'l)"/>';
    }
    s += '<g class="ds-bd-d3"><path d="' + skyline(r, 800, 90, 300) + '" fill="#0b3a42" opacity=".7"/></g>';
    s += '<g class="ds-bd-d2"><path d="' + skyline(r, 900, 60, 250) + '" fill="#05222a" opacity=".92"/></g>';
    const win = [];
    for (let i = 0; i < 14; i++) win.push([40 + r() * 1520, 700 + r() * 190, 1.8 + r() * 1.6]);
    s += '<path class="ds-bd-twinkle" d="' + dotsPath(win) + '" fill="#d4a84a" opacity=".75"/>';
    s += particles(r, 18, 'ds-bd-rise', 60, 1540, 700, 900, 3, 10, '#a8f0e6', true);
    s += '<rect y="520" width="1600" height="380" fill="url(#' + p + 'f)"/>';
    return s;
  }

  function sceneAct3(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#05031a'], [0.55, '#150c35'], [1, '#34205a']]) + lin(p + 'a', [[0, '#4cffd0', 0], [0.35, '#52e8c8', 0.5], [0.7, '#9a6cff', 0.3], [1, '#9a6cff', 0]]) + lin(p + 'f', [[0, '#04020c', 0], [1, '#04020c', 0.8]]) + rad(p + 'o', [[0, '#e8e0ff', 0.25], [1, '#e8e0ff', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += starField(r, 70, 0, 560, '#e6e2ff');
    s += '<circle cx="1260" cy="190" r="150" fill="url(#' + p + 'o)"/><circle cx="1260" cy="190" r="34" fill="#f4f0ff" opacity=".85"/>';
    for (let i = 0; i < 3; i++) {
      const y0 = 130 + i * 90 + r() * 40;
      s +=
        '<path class="' + (i === 1 ? 'ds-bd-breathe' : i === 2 ? 'ds-bd-d1' : 'ds-bd-d2') + '" d="M-140 ' + f(y0) + 'C300 ' + f(y0 - 140) + ' 700 ' + f(y0 + 120) + ' 1000 ' + f(y0 - 60) + 'S1500 ' + f(y0 + 80) + ' 1760 ' + f(y0 - 20) +
        'L1760 ' + f(y0 + 230) + 'C1400 ' + f(y0 + 300) + ' 1100 ' + f(y0 + 160) + ' 800 ' + f(y0 + 260) + 'S200 ' + f(y0 + 180) + ' -140 ' + f(y0 + 280) + 'Z" fill="url(#' + p + 'a)" opacity="' + f(0.45 - i * 0.08) + '"/>';
    }
    s += '<g class="ds-bd-d3"><path d="' + ridge(r, 700, 230, 120, false) + '" fill="#2b1b55"/></g>';
    s += '<g class="ds-bd-d2"><path d="' + ridge(r, 820, 300, 90, false) + '" fill="#120a2c"/></g>';
    s += particles(r, 12, 'ds-bd-fall', 200, 1700, 0, 200, 1.2, 2.4, '#ffffff');
    s += '<rect y="600" width="1600" height="300" fill="url(#' + p + 'f)"/>';
    return s;
  }

  // ---- mood scenes
  function sceneMenu(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#0c0720'], [0.38, '#2f1550'], [0.66, '#8a3a52'], [0.82, '#e07a3a'], [1, '#2a0f1c']]) + rad(p + 'h', [[0, '#ffc070', 0.7], [1, '#ff7a30', 0]]) + rad(p + 'c', [[0, '#5a2a60', 0.8], [1, '#5a2a60', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += starField(r, 50, 0, 380, '#f1e6ff');
    s += '<ellipse class="ds-bd-breathe" cx="800" cy="650" rx="900" ry="260" fill="url(#' + p + 'h)"/>';
    s += '<ellipse class="ds-bd-d1" cx="400" cy="300" rx="420" ry="26" fill="url(#' + p + 'c)"/>';
    s += '<ellipse class="ds-bd-d2" cx="1180" cy="400" rx="480" ry="30" fill="url(#' + p + 'c)"/>';
    s += '<ellipse class="ds-bd-d3" cx="760" cy="520" rx="560" ry="22" fill="url(#' + p + 'c)"/>';
    s += '<g class="ds-bd-d3"><path d="' + ridge(r, 720, 120, 160, true) + '" fill="#4a1d3c" opacity=".9"/></g>';
    // the spire
    s += '<path d="M690 900L734 540L738 484L762 484L764 340L778 340L782 236L792 236L795 130L800 38L805 130L808 236L818 236L822 340L836 340L838 484L862 484L866 540L910 900Z" fill="#06030b" stroke="#e8793c" stroke-opacity=".28" stroke-width="2"/>';
    s += '<path d="M738 484h24v-14h-5v8h-5v-8h-4v8h-5v-8h-5zM838 484h24v-14h-5v8h-5v-8h-4v8h-5v-8h-5z" fill="#06030b"/>';
    s += '<path class="ds-bd-flicker" d="M797 300h6v16h-6zM790 420h6v14h-6zM804 420h6v14h-6zM786 560h6v16h-6zM808 560h6v16h-6zM797 660h6v18h-6z" fill="#ffb55a"/>';
    s += '<g class="ds-bd-d2"><path d="' + ridge(r, 820, 90, 130, true) + '" fill="#1a0a18"/></g>';
    s += particles(r, 10, 'ds-bd-rise', 300, 1300, 700, 900, 1.2, 2.6, '#ffb060');
    return s;
  }

  function sceneShop(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#1b0f08'], [0.6, '#3a2210'], [1, '#150b06']]) + rad(p + 'l', [[0, '#ffc060', 0.6], [0.5, '#ff9a30', 0.16], [1, '#ff9a30', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    let sh = '';
    for (const y of [330, 520]) {
      sh += 'M0 ' + y + 'H1600V' + (y + 16) + 'H0Z';
      let x = 30;
      while (x < 1570) {
        const w = 26 + r() * 40;
        const h = 36 + r() * 70;
        sh += 'M' + f(x) + ' ' + y + 'V' + f(y - h + 12) + 'Q' + f(x + w / 2) + ' ' + f(y - h - 8) + ' ' + f(x + w) + ' ' + f(y - h + 12) + 'V' + y + 'Z';
        x += w + 20 + r() * 60;
      }
    }
    s += '<path class="ds-bd-d3" d="' + sh + '" fill="#0d0704" opacity=".8"/>';
    for (let i = 0; i < 4; i++) {
      const x = 200 + i * 390 + r() * 60;
      const len = 90 + r() * 120;
      s += '<g class="ds-bd-sway" style="animation-delay:-' + f(r() * 5) + 's"><path d="M' + f(x) + ' 0V' + f(len) + '" stroke="#2a1a0c" stroke-width="3"/>';
      s += '<circle class="ds-bd-flicker" cx="' + f(x) + '" cy="' + f(len + 36) + '" r="190" fill="url(#' + p + 'l)" style="animation-delay:-' + f(r() * 2) + 's"/>';
      s += '<rect x="' + f(x - 20) + '" y="' + f(len) + '" width="40" height="58" rx="10" fill="#ffb347" opacity=".95" stroke="#4a2a10" stroke-width="5"/></g>';
    }
    s += '<rect y="740" width="1600" height="160" fill="#0a0503" opacity=".7"/>';
    s += particles(r, 10, 'ds-bd-rise', 100, 1500, 600, 900, 1, 2.2, '#ffd080');
    return s;
  }

  function sceneRest(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#04050c'], [0.7, '#0e1226'], [1, '#1a1018']]) + rad(p + 'f', [[0, '#ff9a3a', 0.8], [0.45, '#ff6a20', 0.28], [1, '#ff5a10', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += starField(r, 45, 0, 520, '#dfe6ff');
    s += '<circle class="ds-bd-flicker" cx="800" cy="760" r="620" fill="url(#' + p + 'f)"/>';
    let far = '';
    let near = '';
    for (let x = -40; x < 1640; x += 90 + r() * 70) far += pine(x, 790, 220 + r() * 160);
    for (let i = 0; i < 4; i++) near += pine(60 + i * 150 + r() * 60, 900, 460 + r() * 200) + pine(1540 - i * 150 - r() * 60, 900, 460 + r() * 200);
    s += '<g class="ds-bd-d3"><path d="' + far + '" fill="#0a0d1a" opacity=".9"/></g>';
    s += '<path d="' + near + '" fill="#04050a"/>';
    s += '<path d="M-100 800Q800 740 1700 800V900H-100Z" fill="#07060a"/>';
    s += '<path d="M730 820L880 780L890 800L740 840ZM710 790L870 830L860 846L700 808Z" fill="#2a1608"/>';
    s += '<path class="ds-bd-flame" d="M800 800C770 760 782 700 800 640C818 700 830 760 800 800Z" fill="#ff5a1a"/>';
    s += '<path class="ds-bd-flame" style="animation-delay:-.4s" d="M800 800C780 770 788 730 800 690C812 730 820 770 800 800Z" fill="#ffa030"/>';
    s += '<path class="ds-bd-flame" style="animation-delay:-.8s" d="M800 800C790 782 794 760 800 740C806 760 810 782 800 800Z" fill="#ffe28a"/>';
    s += particles(r, 14, 'ds-bd-rise', 740, 860, 640, 790, 1.2, 2.6, '#ffb868');
    return s;
  }

  function sceneTreasure(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#0b0804'], [0.6, '#241705'], [1, '#0a0602']]) + rad(p + 'g', [[0, '#ffe08a', 0.75], [0.5, '#f0b030', 0.25], [1, '#f0a020', 0]]) + lin(p + 'r', [[0, '#ffe9a0', 0.4], [1, '#ffe9a0', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    let rays = '';
    for (let i = 0; i < 16; i++) {
      const a = (i * 6.283) / 16;
      rays += 'M800 520L' + f(800 + Math.cos(a - 0.07) * 1300) + ' ' + f(520 + Math.sin(a - 0.07) * 1300) + 'L' + f(800 + Math.cos(a + 0.07) * 1300) + ' ' + f(520 + Math.sin(a + 0.07) * 1300) + 'Z';
    }
    s += '<path class="ds-bd-spin" d="' + rays + '" fill="url(#' + p + 'r)" opacity=".5"/>';
    s += '<circle class="ds-bd-breathe" cx="800" cy="520" r="520" fill="url(#' + p + 'g)"/>';
    s += '<path d="' + archRow(r, 520, 160, 640, 230) + '" fill="#050301" fill-rule="evenodd" opacity=".85"/>';
    s += '<path d="M-100 780Q800 700 1700 780V900H-100Z" fill="#080502"/>';
    s += particles(r, 18, 'ds-bd-rise', 200, 1400, 560, 900, 1.2, 2.8, '#ffe08a');
    return s;
  }

  function sceneVictory(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#2a2f6a'], [0.45, '#b2608a'], [0.75, '#ffb36a'], [1, '#ffe2a0']]) + rad(p + 'u', [[0, '#fff6c8', 1], [0.35, '#ffd27a', 0.55], [1, '#ffb050', 0]]) + lin(p + 'r', [[0, '#fff0b8', 0.35], [1, '#fff0b8', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += starField(r, 18, 0, 200, '#ffffff');
    let rays = '';
    for (let i = 0; i < 14; i++) {
      const a = (i * 6.283) / 14;
      rays += 'M800 520L' + f(800 + Math.cos(a - 0.06) * 1400) + ' ' + f(520 + Math.sin(a - 0.06) * 1400) + 'L' + f(800 + Math.cos(a + 0.06) * 1400) + ' ' + f(520 + Math.sin(a + 0.06) * 1400) + 'Z';
    }
    s += '<path class="ds-bd-spin" d="' + rays + '" fill="url(#' + p + 'r)" opacity=".7"/>';
    s += '<circle class="ds-bd-breathe" cx="800" cy="520" r="360" fill="url(#' + p + 'u)"/><circle cx="800" cy="520" r="82" fill="#fff6d0"/>';
    s += '<ellipse class="ds-bd-d1" cx="420" cy="260" rx="260" ry="34" fill="#ffc6c0" opacity=".5"/><ellipse class="ds-bd-d2" cx="1220" cy="340" rx="300" ry="30" fill="#ffd0b0" opacity=".5"/>';
    s += '<path class="ds-bd-d1" d="M300 180l14 10l14 -10M340 200l10 8l10 -8M1180 130l12 9l12 -9" stroke="#3a2848" stroke-width="3" fill="none"/>';
    s += '<g class="ds-bd-d3"><path d="' + ridge(r, 650, 160, 130, false) + '" fill="#8a5078"/></g>';
    s += '<g class="ds-bd-d2"><path d="' + ridge(r, 760, 160, 100, true) + '" fill="#4e2e66"/></g>';
    s += '<path d="' + ridge(r, 850, 70, 120, true) + '" fill="#241838"/>';
    s += particles(r, 12, 'ds-bd-rise', 100, 1500, 600, 900, 1.2, 2.6, '#fff2b0');
    return s;
  }

  function sceneGameover(r, p) {
    let s = '<defs>' + lin(p + 's', [[0, '#090205'], [0.6, '#260610'], [1, '#12030a']]) + rad(p + 'm', [[0, '#ff6a52', 1], [0.7, '#c01f2a', 1], [1, '#8a0f1a', 1]]) + rad(p + 'h', [[0, '#ff3a30', 0.5], [0.4, '#a0141c', 0.22], [1, '#a0141c', 0]]) + rad(p + 'k', [[0, '#8a1a20', 0.35], [1, '#8a1a20', 0]]) + '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 's)"/>';
    s += '<circle class="ds-bd-breathe" cx="1110" cy="270" r="420" fill="url(#' + p + 'h)"/>';
    s += '<circle cx="1110" cy="270" r="150" fill="url(#' + p + 'm)"/>';
    s += '<path d="' + dotsPath([[1060, 230, 26], [1160, 300, 20], [1100, 330, 14], [1170, 220, 11]]) + '" fill="#7a0f18" opacity=".45"/>';
    s += '<path d="M150 900V620M150 700L90 640L70 560M150 660L214 600L250 520M150 770L100 720M150 740L220 700L260 650" stroke="#030102" stroke-width="12" stroke-linecap="round" fill="none"/>';
    let gs = '';
    for (let i = 0; i < 7; i++) {
      const x = 380 + i * 170 + r() * 50;
      const h = 70 + r() * 70;
      gs += 'M' + f(x) + ' 900V' + f(840 - h) + 'Q' + f(x + 26) + ' ' + f(800 - h) + ' ' + f(x + 52) + ' ' + f(840 - h) + 'V900Z';
    }
    s += '<path d="' + gs + '" fill="#050102" opacity=".92"/>';
    s += '<ellipse class="ds-bd-d1" cx="600" cy="840" rx="800" ry="120" fill="url(#' + p + 'k)"/><ellipse class="ds-bd-d2" cx="1100" cy="860" rx="700" ry="100" fill="url(#' + p + 'k)"/>';
    s += particles(r, 14, 'ds-bd-fall', 300, 1700, 0, 300, 1, 2.4, '#c24a40');
    return s;
  }

  const MOOD = {
    menu: sceneMenu, shop: sceneShop, rest: sceneRest, treasure: sceneTreasure, victory: sceneVictory, gameover: sceneGameover
  };
  const MOOD_ALIAS = {
    charselect: 'menu', history: 'menu', settings: 'menu', howto: 'menu', compendium: 'menu', bossrelic: 'treasure'
  };
  const DIM = {
    menu: 0, charselect: 0.28, history: 0.5, settings: 0.5, howto: 0.5, compendium: 0.58,
    map: 0.34, combat: 0.3, reward: 0.34, event: 0.22, shop: 0.12, rest: 0.05, treasure: 0.12, bossrelic: 0.2, victory: 0.05, gameover: 0.12
  };

  function backdropSvg(name, act) {
    name = typeof name === 'string' ? name : 'map';
    const a = act === 2 || act === 3 ? act : 1;
    const key = name + '|' + a;
    const c = bdCache.get(key);
    if (c) return c;
    const h = hash(key);
    const r = rngOf(h);
    const p = 'b' + h.toString(36);
    const mood = MOOD[MOOD_ALIAS[name] || name];
    let body;
    if (mood) body = mood(r, p);
    else body = a === 3 ? sceneAct3(r, p) : a === 2 ? sceneAct2(r, p) : sceneAct1(r, p);
    if (name === 'event') {
      body += '<defs>' + rad(p + 'z', [[0, '#a070ff', 0.4], [1, '#a070ff', 0]]) + '</defs><ellipse class="ds-bd-breathe" cx="800" cy="460" rx="620" ry="330" fill="url(#' + p + 'z)"/>';
    }
    const dim = DIM[name] === undefined ? 0.3 : DIM[name];
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' + body;
    s += '<defs>' + '<radialGradient id="' + p + 'v" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient></defs>';
    s += '<rect width="1600" height="900" fill="url(#' + p + 'v)"/>';
    if (dim > 0) s += '<rect width="1600" height="900" fill="#05030a" opacity="' + dim + '"/>';
    s += '</svg>';
    bdCache.set(key, s);
    return s;
  }

  // applyBackdrop(rootEl, name, act): paints an atmospheric layered background behind the screen.
  // The backdrop is inserted as a sibling just before the screen root (so it does not scroll with the screen);
  // without a parent it becomes the first child of rootEl, behind its content.
  function applyBackdrop(rootEl, name, act) {
    if (!HAS_DOM || !rootEl || typeof rootEl.appendChild !== 'function') return null;
    try {
      ensureStyle();
      const a = act === 2 || act === 3 ? act : DS.run && (DS.run.act === 2 || DS.run.act === 3) ? DS.run.act : 1;
      const bd = document.createElement('div');
      bd.className = 'ds-backdrop';
      bd.setAttribute('data-backdrop', String(name || ''));
      bd.setAttribute('aria-hidden', 'true');
      bd.innerHTML = backdropSvg(name, a);
      const parent = rootEl.parentNode;
      if (parent && parent.nodeType === 1) {
        const kids = Array.prototype.slice.call(parent.children || []);
        for (const k of kids) {
          if (k !== rootEl && k.classList && k.classList.contains('ds-backdrop')) parent.removeChild(k);
        }
        parent.insertBefore(bd, rootEl);
      } else {
        const kids = Array.prototype.slice.call(rootEl.children || []);
        for (const k of kids) {
          if (k.classList && k.classList.contains('ds-backdrop')) rootEl.removeChild(k);
        }
        bd.style.zIndex = '-1';
        rootEl.style.isolation = 'isolate';
        if (!rootEl.style.position && !(rootEl.classList && rootEl.classList.contains('ds-screen'))) rootEl.style.position = 'relative';
        rootEl.insertBefore(bd, rootEl.firstChild);
      }
      return bd;
    } catch (e) {
      return null;
    }
  }

  ART.cardArt = cardArt;
  ART.unitArt = unitArt;
  ART.relicIcon = relicIcon;
  ART.potionIcon = potionIcon;
  ART.applyBackdrop = applyBackdrop;
  ART._svg = { card: (d) => cardSvg(d || {}), unit: (d, c) => unitSvg(d || {}, !!c), relic: (d) => relicSvg(d || {}), potion: (d) => potionSvg(d || {}), backdrop: (n, a) => backdropSvg(n, a), hash };
})();
