(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // The combat screen (contract sections 7 and 9). Layout and unit styling come from styles.css
  // (.ds-combat-field, .ds-player, .ds-enemies, .ds-enemy, .ds-hand, .ds-pile-*, .ds-energy, .ds-endturn).
  // The hint line, turn banner and new combat classes are styled by the EXTRA_CSS block below.

  const INTENT_ICON = {
    attack: '⚔️',
    defend: '🛡️',
    buff: '⬆️',
    debuff: '⬇️',
    attack_debuff: '⚔️⬇️',
    attack_defend: '⚔️🛡️',
    attack_buff: '⚔️⬆️',
    special: '✨',
    sleep: '💤',
    unknown: '❔'
  };
  const INTENT_TEXT = {
    attack: 'Attacks you.',
    defend: 'Raises its guard and gains block.',
    buff: 'Grows stronger.',
    debuff: 'Weakens you with a debuff.',
    attack_debuff: 'Attacks you and applies a debuff.',
    attack_defend: 'Attacks you and gains block.',
    attack_buff: 'Attacks you and grows stronger.',
    special: 'Does something unusual.',
    sleep: 'Is asleep.',
    unknown: 'Its intentions are unclear.'
  };
  const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
  const BANNER_COLORS = { player: '#f5e6c8', enemy: '#e07a5f', win: '#f1c40f', lose: '#e74c3c' };
  const PILE_INFO = { draw: ['📚', 'Draw pile'], discard: ['🗑️', 'Discard pile'], exhaust: ['🔥', 'Exhaust pile'] };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LOG_MAX = 200;                 // log rows kept in the panel (the engine also caps its own log)
  const DRAG_PX = 6;                   // pointer travel before a press on a card becomes a drag
  const DRAG_CLICK_GUARD_MS = 250;     // a click this soon after a drag belongs to that drag

  // Keyword explanations for card tooltips. Status names and descriptions come from DS.statuses at hover time.
  const KEYWORD_TIPS = [
    ['Block', 'Absorbs damage. Damage removes Block before it removes HP. Block is lost at the start of your turn unless you have Barricade.'],
    ['Energy', 'Spent to play cards. Refills at the start of each of your turns.'],
    ['Draw', 'Move cards from your draw pile into your hand.'],
    ['Discard', 'Move cards from your hand to your discard pile.'],
    ['Exhaust', 'Removed from the battle after it is played, for the rest of this combat.'],
    ['Ethereal', 'If this card is still in your hand at the end of your turn, it is Exhausted.'],
    ['Innate', 'Always starts the battle in your opening hand.'],
    ['Retain', 'Stays in your hand at the end of your turn instead of being discarded.'],
    ['Unplayable', 'This card cannot be played.'],
    ['Shuffle', 'Your discard pile is shuffled back into your draw pile.'],
    ['Heal', 'Restore HP, up to your maximum.'],
    ['Max HP', 'Your maximum hit points.'],
    ['Upgrade', 'Upgraded cards use their improved text and numbers.']
  ];

  // Rules styles.css does not have for this screen. Injected once, when the combat screen first opens.
  // Only new classes are styled here, so styles.css keeps ownership of the hand, cards and units.
  const STYLE_ID = 'ds-combat-ui-style';
  const EXTRA_CSS = [
    // .ds-screen has padding for menus; the combat field should fill the whole screen edge to edge.
    '.ds-screen.ds-screen-combat{padding:0;overflow:hidden}',
    '.ds-intent-attack{border-color:#8f2a22}',
    '.ds-intent-special{border-color:#7d5fb0;box-shadow:0 0 0.6rem rgba(160,120,230,0.35)}',
    '.ds-combat-hint{position:absolute;left:0;right:0;top:0.6rem;z-index:12;padding:0 12px;text-align:center;' +
      'font:600 0.95rem system-ui,sans-serif;color:#e8d9b5;text-shadow:0 1px 3px #000;pointer-events:none}',
    '.ds-turn-banner{position:absolute;left:0;right:0;top:34%;z-index:40;text-align:center;' +
      'font:700 2.8rem Georgia,"Times New Roman",serif;letter-spacing:0.15em;text-shadow:0 3px 14px #000,0 0 6px #000;' +
      'pointer-events:none;opacity:0;transition:opacity 0.3s ease}',
    '.ds-hand{user-select:none}',
    // live damage / block numbers on hand cards (cards use em units, so the badges do too)
    '.ds-card > .ds-preview-badge{position:absolute;top:-0.55em;right:-0.6em;z-index:5;box-sizing:border-box;' +
      'min-width:2.3em;height:2.3em;padding:0 0.45em;display:flex;align-items:center;justify-content:center;' +
      'border-radius:999px;background:rgba(14,9,20,0.94);border:0.14em solid #e8b04a;color:#fff7e6;' +
      'font:800 1.25em/1 system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 0.2em 0.5em rgba(0,0,0,0.65)}',
    '.ds-card > .ds-preview-badge.ds-preview-block{top:auto;bottom:-0.55em;right:auto;left:-0.6em;border-color:#7fbfff}',
    // a card being dragged lifts and stops catching the pointer, so the drop target underneath is found
    '.ds-card.ds-card-dragging{--lift:-2.6em;--sc:1.1;z-index:40;pointer-events:none;opacity:0.92;' +
      'box-shadow:0 0.8em 1.6em rgba(0,0,0,0.8),0 0 1.4em #ffb070}',
    '.ds-target-arrow{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:29}',
    // exact result of the card being aimed at an enemy
    '.ds-enemy-preview{position:absolute;left:50%;top:40%;z-index:8;transform:translate(-50%,-50%);padding:0.2rem 0.7rem;' +
      'border-radius:999px;background:rgba(20,8,12,0.92);border:1px solid #c9a25a;color:#fff7e6;' +
      'font:800 1rem system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 0.3rem 0.8rem rgba(0,0,0,0.7)}',
    '.ds-enemy-preview[hidden]{display:none}',
    '.ds-enemy-preview.ds-preview-lethal{border-color:#ff5a48;background:rgba(70,8,8,0.94);color:#ffe0d8;' +
      'box-shadow:0 0 0.9rem rgba(255,60,40,0.8)}',
    // combat log panel
    '.ds-combat-log{position:absolute;top:3.2rem;right:1rem;z-index:14;width:17rem;max-height:40%;display:flex;' +
      'flex-direction:column;overflow:hidden;background:rgba(10,6,16,0.84);border:1px solid #5b4a6e;border-radius:0.6rem;' +
      'box-shadow:0 0.4rem 1rem rgba(0,0,0,0.6);color:#e8dcc4;font:500 0.82rem/1.35 system-ui,sans-serif}',
    '.ds-combat-log.ds-log-collapsed{width:auto;max-height:none}',
    '.ds-log-head{display:flex;align-items:center;justify-content:space-between;gap:0.5rem;width:100%;padding:0.35rem 0.6rem;' +
      'background:none;border:0;color:#e8b04a;font:700 0.78rem system-ui,sans-serif;letter-spacing:0.08em;' +
      'text-transform:uppercase;text-align:left;cursor:pointer}',
    '.ds-log-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 0.6rem 0.5rem}',
    '.ds-combat-log.ds-log-collapsed .ds-log-body{display:none}',
    '.ds-log-entry{padding:0.15rem 0;border-bottom:1px solid rgba(255,255,255,0.06)}',
    '.ds-log-turn{display:inline-block;min-width:2.2em;margin-right:0.35em;color:#c9a25a;font-weight:700;font-variant-numeric:tabular-nums}',
    // potion modal portrait, unit detail modal
    '.ds-potion-hero{display:flex;justify-content:center;margin-bottom:0.4rem}',
    '.ds-unit-detail{line-height:1.45;font-size:0.98rem}',
    '.ds-detail-h{margin:0.8rem 0 0.3rem;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8}',
    '.ds-detail-row{padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.08)}',
    '.ds-detail-desc{margin-top:0.15rem;font-size:0.9em;opacity:0.85}',
    '.ds-detail-n{color:#e8b04a;font-weight:700}'
  ].join('\n');

  // Live state of the combat screen. Only one combat screen exists at a time; async work captures its own
  // `st` and bails out once it is no longer the live one.
  let S = null;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function el(tag, attrs, kids) {
    return DS.ui.el(tag, attrs || {}, kids == null ? [] : kids);
  }
  function toast(msg) {
    try { if (DS.ui && typeof DS.ui.toast === 'function') DS.ui.toast(msg); } catch (e) { /* ignore */ }
  }
  function topBar() {
    try { if (DS.ui && typeof DS.ui.refreshTopBar === 'function') DS.ui.refreshTopBar(); } catch (e) { /* ignore */ }
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function num(v, d) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }
  function logErr(where, err) { console.error('[combat_ui] ' + where, err); }

  // A modal, card picker or deck view is open while #overlay directly holds a .ds-modal-backdrop.
  // Toasts and the shared tooltip also live in #overlay, so they are deliberately ignored here.
  function overlayOpen() {
    if (typeof document === 'undefined') return false;
    const o = document.getElementById('overlay');
    if (!o) return false;
    const kids = o.children || [];
    for (let i = 0; i < kids.length; i++) {
      if (String(kids[i].className || '').indexOf('ds-modal-backdrop') >= 0) return true;
    }
    return false;
  }

  function live(st) { return !!st && !st.exited && S === st; }
  function isDead(e) { return !!e.dead || (typeof e.hp === 'number' && e.hp <= 0); }
  function injectStyle() {
    try {
      if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = EXTRA_CSS;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { logErr('style', e); }
  }
  function isModalBackdrop(n) {
    return !!n && !!n.classList && n.classList.contains('ds-modal-backdrop');
  }

  function livingOf(st) {
    const c = st.combat;
    try {
      if (typeof c.livingEnemies === 'function') {
        return (c.livingEnemies() || []).filter((e) => e && !isDead(e));
      }
    } catch (err) { logErr('livingEnemies', err); }
    return (c.enemies || []).filter((e) => e && !isDead(e));
  }
  function findEnemy(st, uid) {
    return (st.combat.enemies || []).find((e) => e && e.uid === uid) || null;
  }
  function findHand(st, uid) {
    return (st.combat.hand || []).find((c) => c && c.uid === uid) || null;
  }
  function cardData(card) {
    if (card.data) return card.data;
    try { return DS.getCardData(card); } catch (e) { return { id: card.id, name: String(card.id || 'Card'), effects: [] }; }
  }
  function cardTarget(card) {
    return cardData(card).target || 'none';
  }
  function costKey(c) {
    if (typeof c === 'number') return c < 0 ? 98 : c;
    if (c === 'X') return 99;
    return 97;
  }
  function safeCheck(st, card) {
    try {
      const r = st.combat.canPlay(card);
      if (r && typeof r === 'object') return { ok: !!r.ok, reason: String(r.reason || '') };
      return { ok: !!r, reason: '' };
    } catch (e) {
      logErr('canPlay', e);
      return { ok: false, reason: 'That card cannot be played right now.' };
    }
  }

  // Settings are optional: every read falls back when DS.settings is not loaded.
  function setting(key, fallback) {
    try {
      if (DS.settings && typeof DS.settings.get === 'function') {
        const v = DS.settings.get(key, fallback);
        return v === undefined ? fallback : v;
      }
    } catch (e) { logErr('settings', e); }
    return fallback;
  }
  // A finite number, or null when missing. For previews, null means "this card has no such effect".
  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const wordReCache = new Map();
  // Case-insensitive whole-word match for a keyword or status name ("Block" also matches "Blocks").
  function wordRe(name) {
    const key = String(name).toLowerCase();
    let re = wordReCache.get(key);
    if (!re) {
      re = new RegExp('\\b' + escRe(key) + 's?\\b', 'i');
      wordReCache.set(key, re);
    }
    return re;
  }
  // Procedural portrait from the art module (DS.art, or DS.ui when that is where it lives). Null when unavailable.
  function unitArtNode(def, size) {
    try {
      const host = DS.art && typeof DS.art.unitArt === 'function' ? DS.art
        : (DS.ui && typeof DS.ui.unitArt === 'function' ? DS.ui : null);
      if (!host) return null;
      const node = host.unitArt(def || {}, { size: size });
      return node && node.nodeType === 1 ? node : null;
    } catch (e) { logErr('unitArt', e); return null; }
  }
  function potionArtNode(def) {
    try {
      if (DS.art && typeof DS.art.potionIcon === 'function') {
        const node = DS.art.potionIcon(def || {});
        return node && node.nodeType === 1 ? node : null;
      }
    } catch (e) { logErr('potionIcon', e); }
    return null;
  }
  // Description text with keyword highlighting (kit.js), escaped plain text when kit is missing.
  function richText(s) {
    try {
      if (DS.ui && typeof DS.ui.describe === 'function') return DS.ui.describe(String(s || ''));
    } catch (e) { logErr('describe', e); }
    return esc(s);
  }
  function keywordDesc(name) {
    const pair = KEYWORD_TIPS.find((p) => p[0] === name);
    return pair ? pair[1] : '';
  }
  // Tooltip for a hand card: every keyword, flag and status named in its text. '' when there is nothing to explain.
  function cardTipHtml(card) {
    const data = cardData(card) || {};
    const text = String(data.desc || '');
    const items = [];
    const seen = {};
    const add = (name, desc) => {
      const key = String(name).toLowerCase();
      if (!desc || seen[key]) return;
      seen[key] = true;
      items.push([name, desc]);
    };
    if (data.exhaust) add('Exhaust', keywordDesc('Exhaust'));
    if (data.ethereal) add('Ethereal', keywordDesc('Ethereal'));
    if (data.innate) add('Innate', keywordDesc('Innate'));
    if (data.retain) add('Retain', keywordDesc('Retain'));
    if (data.cost === 'X') add('X cost', 'Spends all of your remaining energy. The effect grows with the energy spent.');
    if (data.cost === -1) add('Unplayable', keywordDesc('Unplayable'));
    for (const pair of KEYWORD_TIPS) {
      if (wordRe(pair[0]).test(text)) add(pair[0], pair[1]);
    }
    const statuses = DS.statuses || {};
    for (const id of Object.keys(statuses)) {
      const s = statuses[id];
      if (!s || !s.name) continue;
      if (wordRe(s.name).test(text)) add(s.name, String(s.desc || '').split('{n}').join('X'));
    }
    if (!items.length) return '';
    return items.map((it) =>
      '<div class="ds-tip-title">' + esc(it[0]) + '</div><div class="ds-tip-body">' + esc(it[1]) + '</div>'
    ).join('');
  }

  // Core input gate, ignoring whether an overlay is visible (used right after a modal closes).
  function canActCore(st) {
    if (!live(st)) return false;
    const c = st.combat;
    return !!c && !c.busy && c.phase === 'player' && !st.localBusy;
  }
  // Full input gate for direct player clicks and keys.
  function canAct(st) {
    return canActCore(st) && !overlayOpen();
  }

  function schedule(st, fn, ms) {
    const id = setTimeout(() => {
      st.timers.delete(id);
      try { fn(); } catch (e) { logErr('timer', e); }
    }, ms);
    st.timers.add(id);
    return id;
  }
  function cancelTimer(st, id) {
    if (!id) return;
    clearTimeout(id);
    st.timers.delete(id);
  }
  async function delay(ms) {
    try {
      if (DS.hooks && typeof DS.hooks.delay === 'function') {
        await DS.hooks.delay(ms);
        return;
      }
    } catch (e) { logErr('delay', e); }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // DOM builders. Each unit is built once and patched in place on every update, so
  // hover states and CSS animations on units survive re-renders.
  // ---------------------------------------------------------------------------
  function makeHp() {
    const fill = el('div', { class: 'ds-hpbar-fill' });
    const text = el('span', { class: 'ds-hpbar-text' });
    const bar = el('div', { class: 'ds-hpbar' }, [fill, text]);
    return { bar, fill, text };
  }
  function paintHp(h, hp, max) {
    const cur = Math.max(0, num(hp, 0));
    const mx = Math.max(1, num(max, 1));
    h.fill.style.width = clamp((cur / mx) * 100, 0, 100) + '%';
    h.text.textContent = cur + '/' + mx;
  }
  function paintBlock(badge, block) {
    const b = Math.max(0, num(block, 0));
    badge.textContent = '🛡 ' + b;
    badge.style.display = b > 0 ? '' : 'none';
  }
  function paintStatuses(ref, unit) {
    const map = unit.statuses || {};
    let key;
    try { key = JSON.stringify(map); } catch (e) { key = String(Math.random()); }
    if (key === ref.statusKey) return;
    ref.statusKey = key;
    ref.statuses.textContent = '';
    let node = null;
    try {
      node = DS.ui && typeof DS.ui.statusChips === 'function' ? DS.ui.statusChips(unit) : null;
    } catch (e) { logErr('statusChips', e); }
    if (node) {
      // statusChips returns its own .ds-statuses wrapper; move its chips into ours to avoid nesting.
      const kids = Array.from(node.childNodes || []);
      for (let i = 0; i < kids.length; i++) ref.statuses.appendChild(kids[i]);
      return;
    }
    ref.statuses.textContent = Object.keys(map)
      .filter((k) => map[k])
      .map((k) => k + ' ' + map[k])
      .join(', ');
  }

  function buildPlayer(st) {
    const root = el('div', { class: 'ds-player', dataset: { combatant: 'player' } });
    const art = el('div', { class: 'ds-unit-art' });
    const name = el('div', { class: 'ds-unit-name' });
    const hp = makeHp();
    const block = el('span', { class: 'ds-block-badge' });
    const statuses = el('div', { class: 'ds-statuses' });
    root.append(art, name, hp.bar, block, statuses);
    // Clicking yourself (not while aiming) lists your statuses in detail.
    root.addEventListener('click', () => {
      if (!live(st) || st.mode || st.drag || recentDrag(st)) return;
      openUnitDetail(st, 'player');
    });
    return { root, art, name, hp, block, statuses, statusKey: null, artKey: null };
  }

  function intentValue(it) {
    if (it.damage == null || it.damage === '') return '';
    const times = Math.max(1, num(it.times, 1));
    return times > 1 ? it.damage + 'x' + times : String(it.damage);
  }
  function intentTip(st, uid) {
    const e = findEnemy(st, uid);
    if (!e) return '';
    const who = esc(e.name || (e.def && e.def.name) || 'Enemy');
    if (isDead(e)) return '<b>' + who + '</b><br>Defeated.';
    const it = e.intent;
    if (!it) return '<b>' + who + '</b><br>Its next move is unknown.';
    const lines = [
      '<b>' + esc(it.name || 'Unknown move') + '</b>',
      esc(INTENT_TEXT[it.type] || INTENT_TEXT.unknown)
    ];
    if (it.damage != null && it.damage !== '') {
      const times = Math.max(1, num(it.times, 1));
      const dmg = num(it.damage, 0);
      if (times > 1) lines.push('Hits ' + times + ' times for ' + dmg + ' each (' + dmg * times + ' total), before your block.');
      else lines.push('Deals ' + dmg + ' damage, before your block.');
    }
    return lines.join('<br>');
  }

  function buildEnemy(st, uid) {
    const root = el('div', { class: 'ds-enemy', dataset: { combatant: uid } });
    const intent = el('div', { class: 'ds-intent' });
    const intentIcon = el('span', { class: 'ds-intent-icon' });
    const intentVal = el('span', { class: 'ds-intent-value' });
    intent.append(intentIcon, intentVal);
    try { DS.ui.tooltip(intent, () => intentTip(st, uid)); } catch (e) { logErr('tooltip', e); }
    const art = el('div', { class: 'ds-unit-art' });
    const name = el('div', { class: 'ds-unit-name' });
    const hp = makeHp();
    const block = el('span', { class: 'ds-block-badge' });
    const statuses = el('div', { class: 'ds-statuses' });
    const preview = el('div', { class: 'ds-enemy-preview', hidden: true });
    root.append(intent, art, name, hp.bar, block, statuses, preview);

    root.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onEnemyClick(st, uid);
    });
    // Hovering sets the target that live previews are computed against, and the highlighted target while aiming.
    root.addEventListener('mouseenter', () => {
      if (!live(st)) return;
      const e = findEnemy(st, uid);
      if (!e || isDead(e)) return;
      let changed = false;
      if (st.hoverUid !== uid) {
        st.hoverUid = uid;
        changed = true;
      }
      if (st.mode && st.kbTarget !== uid) {
        st.kbTarget = uid;
        changed = true;
      }
      if (changed) refreshPreviews(st);
    });
    root.addEventListener('mouseleave', () => {
      if (!live(st) || st.hoverUid !== uid) return;
      st.hoverUid = null;
      refreshPreviews(st);
    });
    return { uid, root, intent, intentIcon, intentVal, art, name, hp, block, statuses, preview, statusKey: null, artKey: null };
  }

  // Portrait slot: procedural art when the art module is loaded, the emoji otherwise. Filled once per unit.
  function paintArt(ref, def, fallbackIcon, size, fontRem) {
    const key = String((def && (def.id || def.name)) || fallbackIcon);
    if (ref.artKey === key) return;
    ref.artKey = key;
    ref.art.textContent = '';
    const node = unitArtNode(def, size);
    if (node) {
      ref.art.appendChild(node);
      ref.art.style.fontSize = '';
    } else {
      ref.art.textContent = fallbackIcon;
      ref.art.style.fontSize = fontRem ? fontRem.toFixed(2) + 'rem' : '';
    }
  }

  function paintEnemy(st, ref, e) {
    const def = e.def || (DS.enemies && DS.enemies[e.id]) || {};
    const dead = isDead(e);
    const dragging = !!(st.drag && st.drag.started && st.drag.targetEnemy);
    const targeting = (!!st.mode || dragging) && !dead;
    const focused = targeting && (dragging ? st.drag.focusUid === e.uid : st.kbTarget === e.uid);
    const tier = String(def.tier || 'normal').replace(/[^a-z_]/g, '') || 'normal';
    const cls = ['ds-enemy', 'ds-tier-' + tier];
    if (dead) cls.push('ds-enemy-dead');
    if (targeting) cls.push('ds-enemy-targetable');
    if (focused) cls.push('ds-enemy-targeted');
    ref.root.className = cls.join(' ');

    if (dead) {
      ref.intent.style.display = 'none';
    } else {
      ref.intent.style.display = '';
      const it = e.intent;
      if (!it) {
        ref.intent.className = 'ds-intent ds-intent-unknown';
        ref.intentIcon.textContent = '❔';
        ref.intentVal.textContent = '';
      } else {
        const type = String(it.type || 'unknown').replace(/[^a-z_]/g, '') || 'unknown';
        ref.intent.className = 'ds-intent ds-intent-' + type;
        ref.intentIcon.textContent = INTENT_ICON[type] || '❔';
        ref.intentVal.textContent = intentValue(it);
      }
    }

    const scale = clamp(num(def.scale, 1), 0.7, 2);
    paintArt(ref, def, def.icon || '👾', Math.round(96 * scale), 5 * scale);
    ref.name.textContent = String(e.name || def.name || e.id || 'Enemy');
    paintHp(ref.hp, e.hp, e.maxHp);
    paintBlock(ref.block, e.block);
    paintStatuses(ref, e);
    paintEnemyPreview(st, ref, e);
  }

  function paintPlayer(st) {
    const p = st.combat.player || {};
    const ch = (DS.characters && st.run && DS.characters[st.run.character]) || {};
    const ref = st.playerRef;
    paintArt(ref, ch, ch.icon || '🧍', 96, 5.6);
    ref.name.textContent = String(ch.name || p.name || 'You');
    paintHp(ref.hp, p.hp, p.maxHp);
    paintBlock(ref.block, p.block);
    paintStatuses(ref, p);
  }

  function paintEnemies(st) {
    const list = (st.combat.enemies || []).filter((e) => e && e.uid);
    if (st.mode) {
      const living = list.filter((e) => !isDead(e));
      if (!living.some((e) => e.uid === st.kbTarget)) {
        st.kbTarget = living.length ? living[0].uid : null;
      }
    }
    const keep = new Set();
    for (const e of list) {
      keep.add(e.uid);
      let ref = st.enemyEls.get(e.uid);
      if (!ref) {
        ref = buildEnemy(st, e.uid);
        st.enemyEls.set(e.uid, ref);
      }
      paintEnemy(st, ref, e);
    }
    for (const [uid, ref] of Array.from(st.enemyEls.entries())) {
      if (!keep.has(uid)) {
        ref.root.remove();
        st.enemyEls.delete(uid);
      }
    }
    list.forEach((e, i) => {
      const ref = st.enemyEls.get(e.uid);
      if (!ref) return;
      const cur = st.enemiesEl.children[i];
      if (cur !== ref.root) st.enemiesEl.insertBefore(ref.root, cur || null);
    });
  }

  function makePile(kind, onclick) {
    const info = PILE_INFO[kind];
    const node = el('div', {
      class: 'ds-pile ds-pile-' + kind,
      title: info[1] + ' (click to view)',
      onclick: onclick
    });
    return { node, icon: info[0], shown: null };
  }
  function paintPile(p, n) {
    const txt = p.icon + ' ' + n;
    if (p.shown === txt) return;
    p.shown = txt;
    p.node.textContent = txt;
  }

  function buildDom(st, rootEl) {
    const root = el('div', { class: 'ds-combat' });
    const field = el('div', { class: 'ds-combat-field' });
    const player = buildPlayer(st);
    const enemies = el('div', { class: 'ds-enemies' });
    field.append(player.root, enemies);

    const hint = el('div', { class: 'ds-combat-hint' });
    const draw = makePile('draw', () => showPile(st, 'Draw pile', st.combat.drawPile));
    const discard = makePile('discard', () => showPile(st, 'Discard pile', st.combat.discardPile));
    const exhaust = makePile('exhaust', () => showPile(st, 'Exhaust pile', st.combat.exhaustPile));
    const energy = el('div', { class: 'ds-energy', text: '0/0' });
    const hand = el('div', { class: 'ds-hand' });
    const endBtn = el('button', {
      class: 'ds-btn ds-btn-primary ds-endturn',
      text: 'End Turn (E)',
      onclick: (ev) => {
        // Drop focus so that Space cannot also activate the button.
        if (ev && ev.currentTarget && typeof ev.currentTarget.blur === 'function') ev.currentTarget.blur();
        endTurnNow(st);
      }
    });
    const banner = el('div', { class: 'ds-turn-banner' });
    const log = buildLog(st);

    root.append(field, hint, draw.node, exhaust.node, discard.node, energy, hand, endBtn, banner, log.root);
    rootEl.appendChild(root);

    // Clicking anywhere that is not a target or a card cancels targeting. Enemies stop propagation themselves.
    root.addEventListener('click', (ev) => {
      if (!live(st) || !st.mode) return;
      const t = ev.target;
      if (t && t.closest && (t.closest('.ds-enemy') || t.closest('.ds-card'))) return;
      cancelTargeting(st);
    });
    root.addEventListener('contextmenu', (ev) => {
      if (st.mode) {
        ev.preventDefault();
        cancelTargeting(st);
      }
    });

    Object.assign(st, {
      root,
      field,
      playerRef: player,
      enemiesEl: enemies,
      hintEl: hint,
      handEl: hand,
      energyEl: energy,
      endBtn,
      drawRef: draw,
      discardRef: discard,
      exhaustRef: exhaust,
      bannerEl: banner,
      logRef: log
    });
    applyLogState(st);
  }

  // ---------------------------------------------------------------------------
  // Painting
  // ---------------------------------------------------------------------------
  function paintBottom(st) {
    const c = st.combat;
    const p = c.player || {};
    paintPile(st.drawRef, (c.drawPile || []).length);
    paintPile(st.discardRef, (c.discardPile || []).length);
    paintPile(st.exhaustRef, (c.exhaustPile || []).length);
    st.energyEl.textContent = num(p.energy, 0) + '/' + num(p.maxEnergy, 0);
    st.endBtn.disabled = !canAct(st);

    let hint = '';
    const enc = c.encounter && c.encounter.name ? c.encounter.name + ' · ' : '';
    if (st.drag && st.drag.started) {
      const dc = findHand(st, st.drag.uid);
      const dn = dc ? cardData(dc).name || 'card' : 'card';
      hint = st.drag.targetEnemy
        ? 'Release on an enemy to play ' + dn + '. Release anywhere else, or press Esc, to cancel.'
        : 'Release above the hand to play ' + dn + '. Release inside the hand to cancel.';
    } else if (st.mode === 'card') {
      const card = st.selectedUid ? findHand(st, st.selectedUid) : null;
      const nm = card ? cardData(card).name || 'card' : 'card';
      hint = 'Choose a target for ' + nm + ': click an enemy (or ←/→ then Enter). Esc cancels.';
    } else if (st.mode === 'potion') {
      hint = 'Choose a target for your potion: click an enemy (or ←/→ then Enter). Esc cancels.';
    } else if (c.phase === 'player') {
      hint = enc + 'Turn ' + num(c.turn, 1) + ' · keys 1-0 play cards · E or Space ends turn · L toggles the log';
    } else if (c.phase === 'enemy') {
      hint = enc + 'Enemies are acting…';
    } else {
      hint = enc.replace(/ · $/, '');
    }
    st.hintEl.textContent = hint;
  }

  // ---------------------------------------------------------------------------
  // Live previews. c.preview(card, enemy) gives the exact per-hit damage and block for a card right now.
  // The target is the enemy under the pointer or the one highlighted for aiming, else the only enemy left.
  // ---------------------------------------------------------------------------
  function previewTarget(st, card) {
    const living = livingOf(st);
    const only = living.length === 1 ? living[0] : null;
    if (cardTarget(card) !== 'enemy') return only;
    const uid = st.hoverUid || (st.mode === 'card' ? st.kbTarget : null);
    const hit = uid ? findEnemy(st, uid) : null;
    return hit && !isDead(hit) ? hit : only;
  }
  function previewFor(st, card, target) {
    const c = st.combat;
    if (!c || typeof c.preview !== 'function' || !card) return null;
    try {
      const r = c.preview(card, target || null);
      if (!r || typeof r !== 'object') return null;
      return {
        damage: numOrNull(r.damage),
        times: Math.max(1, num(r.times, 1)),
        block: numOrNull(r.block)
      };
    } catch (err) {
      logErr('preview', err);
      return null;
    }
  }
  function addPreviewBadges(node, pv) {
    if (pv.damage != null) {
      const txt = pv.times > 1 ? pv.damage + '×' + pv.times : String(pv.damage);
      node.appendChild(el('div', { class: 'ds-preview-badge ds-preview-dmg', text: '⚔ ' + txt, title: 'Damage per hit, against your current target' }));
    }
    if (pv.block != null && pv.block > 0) {
      node.appendChild(el('div', { class: 'ds-preview-badge ds-preview-block', text: '🛡 ' + pv.block, title: 'Block gained' }));
    }
  }
  // Exact outcome of the card aimed at this enemy: a drag hovering it, or the card selected for targeting.
  function enemyPreview(st, e) {
    if (!e || isDead(e)) return null;
    let card = null;
    if (st.drag && st.drag.started && st.drag.targetEnemy) {
      if (st.drag.focusUid === e.uid) card = findHand(st, st.drag.uid);
    } else if (st.mode === 'card' && st.selectedUid && st.kbTarget === e.uid) {
      card = findHand(st, st.selectedUid);
    }
    if (!card) return null;
    const pv = previewFor(st, card, e);
    if (!pv || pv.damage == null) return null;
    const total = Math.max(0, pv.damage) * pv.times;
    const hp = Math.max(0, num(e.hp, 0));
    const block = Math.max(0, num(e.block, 0));
    const absorbed = Math.min(block, total);
    const loss = total - absorbed;
    const note = absorbed > 0 ? ' (' + absorbed + ' blocked)' : '';
    if (loss >= hp) return { lethal: true, text: '☠ Kills · ' + loss + ' damage' + note };
    return { lethal: false, text: '-' + loss + ' HP → ' + (hp - loss) + ' left' + note };
  }
  function paintEnemyPreview(st, ref, e) {
    const pv = enemyPreview(st, e);
    if (!pv) {
      ref.preview.hidden = true;
      return;
    }
    ref.preview.hidden = false;
    ref.preview.className = 'ds-enemy-preview' + (pv.lethal ? ' ds-preview-lethal' : '');
    ref.preview.textContent = pv.text;
  }
  // Repaints what hover and aiming change: enemies (preview, highlight) and the hand (per-card numbers).
  function refreshPreviews(st) {
    if (!live(st) || overlayOpen()) return;
    try {
      paintEnemies(st);
      paintHand(st);
    } catch (e) { logErr('refresh previews', e); }
  }

  function paintHand(st) {
    // The card being dragged must stay where it is until the drag ends (endDrag clears handSig).
    if (st.drag && st.drag.started) return;
    const c = st.combat;
    const hand = (c.hand || []).filter(Boolean);
    const act = canAct(st);
    const checks = hand.map((card) => safeCheck(st, card));
    const previews = hand.map((card) => previewFor(st, card, previewTarget(st, card)));
    const selected = st.mode === 'card' ? st.selectedUid : null;
    // Only rebuild the hand when something visible changed, so hover states survive ordinary updates.
    const sig = [
      act ? 1 : 0,
      selected || '',
      hand.map((card, i) => [
        card.uid, card.id, card.upgraded ? 1 : 0, String(card.cost), checks[i].ok ? 1 : 0, checks[i].reason,
        previews[i] ? [previews[i].damage, previews[i].times, previews[i].block].join('/') : ''
      ].join(':')).join('|')
    ].join('#');
    if (sig === st.handSig) return;
    st.handSig = sig;
    st.handEl.textContent = '';

    hand.forEach((card, i) => {
      const chk = checks[i];
      const playable = act && chk.ok;
      const node = DS.ui.renderCard(cardData(card), {
        cost: card.cost,
        selected: selected === card.uid,
        onclick: () => {
          // The click that ends a drag is not a second play.
          if (recentDrag(st)) return;
          onCardClick(st, card.uid);
        }
      });
      if (!node) return;
      node.dataset.handUid = String(card.uid);
      // Dimmed rather than disabled, so that clicking still explains why it cannot be played.
      if (!playable) node.classList.add('ds-card-disabled');
      node.title = playable ? '' : (chk.reason || (act ? '' : 'Wait for your turn.'));
      if (previews[i]) addPreviewBadges(node, previews[i]);
      if (playable) node.addEventListener('pointerdown', (ev) => onCardPress(st, card.uid, ev));
      try { DS.ui.tooltip(node, () => cardTipHtml(card)); } catch (e) { logErr('card tooltip', e); }
      st.handEl.appendChild(node);
    });
  }

  // Full refresh. Skipped while a modal, picker or deck view is open; the overlay MutationObserver
  // re-runs this once the overlay closes.
  function update(st) {
    if (!live(st)) return;
    if (overlayOpen()) return;
    try {
      paintPlayer(st);
      paintEnemies(st);
      paintBottom(st);
      paintHand(st);
    } catch (e) {
      logErr('render', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Targeting state
  // ---------------------------------------------------------------------------
  function clearMode(st) {
    st.mode = null;
    st.selectedUid = null;
    st.potionSlot = null;
    st.kbTarget = null;
  }
  function cancelTargeting(st) {
    if (!st.mode) return;
    clearMode(st);
    update(st);
  }
  function cycleTarget(st, dir) {
    const living = livingOf(st);
    if (!living.length) return;
    let i = living.findIndex((e) => e.uid === st.kbTarget);
    if (i < 0) i = dir > 0 ? 0 : living.length - 1;
    else i = (i + dir + living.length) % living.length;
    st.kbTarget = living[i].uid;
    update(st);
  }

  // ---------------------------------------------------------------------------
  // Card play
  // ---------------------------------------------------------------------------
  function onCardClick(st, uid) {
    if (!canAct(st)) return;
    const card = findHand(st, uid);
    if (!card) return;
    const chk = safeCheck(st, card);
    if (!chk.ok) {
      toast(chk.reason || 'You cannot play that right now.');
      return;
    }
    if (cardTarget(card) === 'enemy') {
      const living = livingOf(st);
      if (!living.length) return;
      if (st.mode === 'card' && st.selectedUid === uid) {
        cancelTargeting(st);
        return;
      }
      if (living.length === 1) {
        clearMode(st);
        playCardNow(st, card, living[0]);
        return;
      }
      clearMode(st);
      st.mode = 'card';
      st.selectedUid = uid;
      st.kbTarget = living[0].uid;
      update(st);
      return;
    }
    clearMode(st);
    playCardNow(st, card, null);
  }

  async function playCardNow(st, card, target) {
    if (!canActCore(st)) return;
    st.localBusy = true;
    update(st);
    let res = null;
    try {
      res = await st.combat.playCard(card, target || null);
    } catch (e) {
      logErr('playCard', e);
      toast('That card could not be played.');
    } finally {
      st.localBusy = false;
      update(st);
    }
    if (res && res.ok === false && res.reason && live(st)) toast(res.reason);
    return res;
  }

  // With the confirmEndTurn setting on, ending the turn while energy and a playable card remain asks first.
  function needsEndTurnConfirm(st) {
    if (!setting('confirmEndTurn', false)) return false;
    const p = st.combat.player || {};
    if (!(num(p.energy, 0) > 0)) return false;
    return (st.combat.hand || []).some((card) => !!card && safeCheck(st, card).ok);
  }

  // Ends the player's turn: End Turn button, E and Space all come through here.
  async function endTurnNow(st) {
    if (!canAct(st)) return;
    clearMode(st);
    if (needsEndTurnConfirm(st) && DS.ui && typeof DS.ui.modal === 'function') {
      const energy = num(st.combat.player && st.combat.player.energy, 0);
      DS.ui.modal({
        title: 'End your turn?',
        content: '<p>You still have ' + energy + ' energy and playable cards.</p>',
        buttons: [
          { label: 'End Turn', primary: true, onclick: () => { doEndTurn(st); } },
          { label: 'Keep Playing' }
        ],
        dismissable: true
      });
      return;
    }
    doEndTurn(st);
  }

  // Runs the turn change. Uses canActCore: the confirmation dialog is still open when it is called.
  async function doEndTurn(st) {
    if (!canActCore(st)) return;
    clearMode(st);
    st.localBusy = true;
    update(st);
    try {
      await st.combat.endTurn();
    } catch (e) {
      logErr('endTurn', e);
    } finally {
      st.localBusy = false;
      update(st);
    }
  }

  function onEnemyClick(st, uid) {
    if (!live(st)) return;
    if (!st.mode) {
      // Not aiming: a click on an enemy shows its details.
      if (!st.drag && !recentDrag(st)) openUnitDetail(st, uid);
      return;
    }
    if (!canActCore(st)) return;
    const e = findEnemy(st, uid);
    if (!e || isDead(e)) return;
    if (st.mode === 'card') {
      const card = st.selectedUid ? findHand(st, st.selectedUid) : null;
      clearMode(st);
      if (!card) {
        update(st);
        return;
      }
      const chk = safeCheck(st, card);
      if (!chk.ok) {
        toast(chk.reason || 'You cannot play that right now.');
        update(st);
        return;
      }
      playCardNow(st, card, e);
    } else if (st.mode === 'potion') {
      const slot = st.potionSlot;
      clearMode(st);
      usePotionNow(st, slot, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Drag to play. Press a playable card and move past DRAG_PX. An enemy-target card draws an arrow to the
  // pointer and plays when released on an enemy. Other cards play when released above the hand. Releasing
  // anywhere else cancels. A press that never moves is an ordinary click, handled by renderCard's onclick.
  // Document listeners exist only while a press is in progress; dragOff() removes them.
  // ---------------------------------------------------------------------------
  function recentDrag(st) {
    return !!st.dragEndedAt && Date.now() - st.dragEndedAt < DRAG_CLICK_GUARD_MS;
  }

  function onCardPress(st, uid, ev) {
    if (!live(st) || !ev || ev.button !== 0) return;
    if (st.mode || st.drag || st.press || !canAct(st)) return;
    const card = findHand(st, uid);
    if (!card || !safeCheck(st, card).ok) return;
    st.press = { uid: uid, x: ev.clientX, y: ev.clientY };
    addDragListeners(st);
  }

  function addDragListeners(st) {
    if (st.dragOff || typeof document === 'undefined') return;
    const onMove = (ev) => { try { onDragMove(st, ev); } catch (e) { logErr('drag move', e); } };
    const onUp = (ev) => { try { onDragEnd(st, ev, false); } catch (e) { logErr('drag end', e); } };
    const onCancel = (ev) => { try { onDragEnd(st, ev, true); } catch (e) { logErr('drag cancel', e); } };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    st.dragOff = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      st.dragOff = null;
    };
  }

  function onDragMove(st, ev) {
    if (!live(st)) return;
    // A mouse button released outside the page never sends pointerup; a move with no button held ends the press.
    if (ev.pointerType === 'mouse' && ev.buttons === 0) {
      onDragEnd(st, ev, true);
      return;
    }
    if (!st.drag) {
      const p = st.press;
      if (!p) return;
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_PX) return;
      if (!startDrag(st)) {
        cancelDrag(st);
        return;
      }
    }
    const d = st.drag;
    d.x = ev.clientX;
    d.y = ev.clientY;
    if (d.targetEnemy) {
      const uid = enemyUidAt(st, ev.clientX, ev.clientY);
      if (uid !== d.focusUid) {
        d.focusUid = uid;
        paintEnemies(st);
        paintBottom(st);
      }
    }
    paintArrow(st);
  }

  function startDrag(st) {
    const p = st.press;
    const card = p ? findHand(st, p.uid) : null;
    if (!card || !canActCore(st) || overlayOpen()) return false;
    const targetEnemy = cardTarget(card) === 'enemy';
    if (targetEnemy && livingOf(st).length === 0) return false;
    // Find the card's current element: hover previews may have rebuilt the hand since the press.
    const node = Array.from(st.handEl.children).find((n) => n.dataset && n.dataset.handUid === String(p.uid)) || null;
    if (!node) return false;
    st.drag = { uid: p.uid, node: node, targetEnemy: targetEnemy, focusUid: null, x: p.x, y: p.y, started: true };
    st.press = null;
    try { if (DS.ui && typeof DS.ui.hideTooltip === 'function') DS.ui.hideTooltip(); } catch (e) { /* cosmetic */ }
    node.classList.add('ds-card-dragging');
    if (targetEnemy) ensureArrow(st);
    paintEnemies(st);
    paintBottom(st);
    return true;
  }

  function onDragEnd(st, ev, cancelled) {
    if (st.dragOff) st.dragOff();
    if (!live(st)) return;
    const d = st.drag;
    if (!d) {
      st.press = null;
      return;
    }
    const card = findHand(st, d.uid);
    let play = false;
    let target = null;
    if (!cancelled && card && ev) {
      if (d.targetEnemy) {
        const uid = enemyUidAt(st, ev.clientX, ev.clientY);
        const e = uid ? findEnemy(st, uid) : null;
        if (e && !isDead(e)) {
          play = true;
          target = e;
        }
      } else {
        const hr = st.handEl ? st.handEl.getBoundingClientRect() : null;
        if (hr && ev.clientY < hr.top) play = true;
      }
    }
    endDrag(st);
    if (play && card) playCardNow(st, card, target);
    else update(st);
  }

  // Esc or a cancelled press: no card is played.
  function cancelDrag(st) {
    if (st.dragOff) st.dragOff();
    st.press = null;
    if (st.drag) {
      endDrag(st);
      update(st);
    }
  }

  function endDrag(st) {
    const d = st.drag;
    st.drag = null;
    st.press = null;
    st.dragEndedAt = Date.now();
    if (d && d.node && d.node.classList) d.node.classList.remove('ds-card-dragging');
    removeArrow(st);
    st.handSig = null;
  }

  function enemyUidAt(st, x, y) {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
    const n = document.elementFromPoint(x, y);
    const en = n && typeof n.closest === 'function' ? n.closest('.ds-enemy') : null;
    if (!en || !st.enemiesEl || !st.enemiesEl.contains(en)) return null;
    const uid = en.getAttribute('data-combatant');
    return uid && uid !== 'player' ? uid : null;
  }

  function ensureArrow(st) {
    if (st.arrowEl || !st.root || typeof document === 'undefined') return;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ds-target-arrow');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffb070');
    path.setAttribute('stroke-width', '5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.9');
    const head = document.createElementNS(SVG_NS, 'circle');
    head.setAttribute('r', '9');
    head.setAttribute('fill', '#ff7a4a');
    head.setAttribute('stroke', '#fff3d6');
    head.setAttribute('stroke-width', '2');
    svg.appendChild(path);
    svg.appendChild(head);
    st.root.appendChild(svg);
    st.arrowEl = svg;
    st.arrowPath = path;
    st.arrowHead = head;
  }

  function removeArrow(st) {
    if (st.arrowEl && st.arrowEl.parentNode) st.arrowEl.parentNode.removeChild(st.arrowEl);
    st.arrowEl = null;
    st.arrowPath = null;
    st.arrowHead = null;
  }

  // Quadratic curve from the dragged card up and over to the pointer.
  function paintArrow(st) {
    const d = st.drag;
    if (!st.arrowEl || !d || !d.node || !d.node.isConnected || !st.root) return;
    const rr = st.root.getBoundingClientRect();
    const cr = d.node.getBoundingClientRect();
    const x0 = cr.left + cr.width / 2 - rr.left;
    const y0 = cr.top + cr.height * 0.25 - rr.top;
    const x1 = d.x - rr.left;
    const y1 = d.y - rr.top;
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - 60;
    st.arrowPath.setAttribute('d', 'M ' + x0.toFixed(1) + ' ' + y0.toFixed(1) +
      ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1));
    st.arrowHead.setAttribute('cx', x1.toFixed(1));
    st.arrowHead.setAttribute('cy', y1.toFixed(1));
  }

  // ---------------------------------------------------------------------------
  // Potions
  // ---------------------------------------------------------------------------
  function potionIdAt(slot) {
    const run = DS.run;
    return run && Array.isArray(run.potions) && slot >= 0 ? run.potions[slot] || null : null;
  }

  function onPotionClick(st, payload) {
    if (!live(st)) return;
    const slot = num(payload && payload.slot, -1);
    const id = potionIdAt(slot);
    if (!id) return;
    if (st.mode === 'potion') {
      clearMode(st);
      update(st);
    }
    openPotionModal(st, slot, id);
  }

  function openPotionModal(st, slot, id) {
    const def = (DS.potions && DS.potions[id]) || null;
    if (!def) return;
    const act = canAct(st);
    const tgtText = {
      enemy: 'Target: one enemy.',
      all_enemies: 'Affects all enemies.',
      self: 'Affects you.',
      none: ''
    }[def.target] || '';
    let m = null;
    const close = () => {
      try { if (m && typeof m.close === 'function') m.close(); } catch (e) { logErr('modal close', e); }
    };
    const buttons = [];
    if (act) buttons.push({ label: 'Use', primary: true, onclick: () => { close(); usePotionFlow(st, slot); } });
    buttons.push({ label: 'Discard', onclick: () => { close(); discardPotion(st, slot); } });
    buttons.push({ label: 'Cancel', onclick: () => close() });

    let desc = esc(def.desc || '');
    try { if (typeof DS.ui.describe === 'function') desc = DS.ui.describe(def.desc || ''); } catch (e) { logErr('describe', e); }
    const note = act ? '' : '<p><i>You can only use potions during your turn.</i></p>';
    const body = el('div', { class: 'ds-potion-detail' });
    const hero = potionArtNode(def);
    if (hero) body.appendChild(el('div', { class: 'ds-potion-hero' }, [hero]));
    body.appendChild(el('div', {
      html: '<p>' + desc + '</p>' + (tgtText ? '<p><i>' + esc(tgtText) + '</i></p>' : '') + note
    }));
    m = DS.ui.modal({
      title: ((def.icon ? def.icon + ' ' : '') + (def.name || id)).trim(),
      content: body,
      buttons: buttons,
      dismissable: true
    });
  }

  function usePotionFlow(st, slot) {
    if (!live(st)) return;
    const id = potionIdAt(slot);
    if (!id) return;
    if (!canActCore(st)) {
      toast("You can't use potions right now.");
      return;
    }
    const def = (DS.potions && DS.potions[id]) || {};
    const living = livingOf(st);
    if (def.target === 'enemy' && living.length > 1) {
      clearMode(st);
      st.mode = 'potion';
      st.potionSlot = slot;
      st.kbTarget = living[0].uid;
      update(st);
      return;
    }
    if (def.target === 'enemy' && living.length === 1) {
      usePotionNow(st, slot, living[0]);
      return;
    }
    usePotionNow(st, slot, null);
  }

  async function usePotionNow(st, slot, target) {
    if (!canActCore(st)) return;
    st.localBusy = true;
    update(st);
    let res = null;
    try {
      const pending = st.combat.usePotion(slot, target || null);
      // The engine empties the slot before its first await, so the top bar can drop the icon now
      // instead of after the potion's effect has played out.
      topBar();
      res = await pending;
    } catch (e) {
      logErr('usePotion', e);
      toast('That potion could not be used.');
    } finally {
      st.localBusy = false;
      topBar();
      update(st);
    }
    if (res && res.ok === false && res.reason && live(st)) toast(res.reason);
    return res;
  }

  function discardPotion(st, slot) {
    try {
      if (DS.Run && typeof DS.Run.discardPotion === 'function') DS.Run.discardPotion(slot);
    } catch (e) { logErr('discardPotion', e); }
    toast('Potion discarded.');
    topBar();
    update(st);
  }

  // ---------------------------------------------------------------------------
  // Piles, banners and enemy move bubbles
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Combat log: a collapsible panel of 'combat:log' entries ({turn, text}), newest at the bottom.
  // ---------------------------------------------------------------------------
  function buildLog(st) {
    const caret = el('span', { class: 'ds-log-caret' });
    const head = el('button', {
      class: 'ds-log-head',
      type: 'button',
      title: 'Show or hide the combat log (L)',
      onclick: () => {
        head.blur();
        toggleLog(st);
      }
    }, [el('span', { text: 'Combat log' }), caret]);
    const body = el('div', { class: 'ds-log-body' });
    const root = el('div', { class: 'ds-combat-log' }, [head, body]);
    return { root: root, head: head, caret: caret, body: body };
  }

  function applyLogState(st) {
    const log = st.logRef;
    if (!log) return;
    log.root.classList.toggle('ds-log-collapsed', !st.logOpen);
    log.caret.textContent = st.logOpen ? '▾' : '▸';
    log.head.setAttribute('aria-expanded', st.logOpen ? 'true' : 'false');
    if (st.logOpen) log.body.scrollTop = log.body.scrollHeight;
  }

  function toggleLog(st) {
    if (!live(st) || !st.logRef) return;
    st.logOpen = !st.logOpen;
    applyLogState(st);
  }

  function appendLog(st, entry) {
    const log = st.logRef;
    if (!live(st) || !log || !entry) return;
    const turn = num(entry.turn, 0);
    const row = el('div', { class: 'ds-log-entry' }, [
      el('span', { class: 'ds-log-turn', text: turn > 0 ? 'T' + turn : '' }),
      String(entry.text == null ? '' : entry.text)
    ]);
    log.body.appendChild(row);
    while (log.body.childElementCount > LOG_MAX) log.body.removeChild(log.body.firstElementChild);
    if (st.logOpen) log.body.scrollTop = log.body.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // Unit details: the player or an enemy, clicked while not aiming. Lists statuses in full and enemy moves.
  // ---------------------------------------------------------------------------
  function openUnitDetail(st, uid) {
    if (!live(st) || overlayOpen()) return;
    const isPlayer = uid === 'player';
    const u = isPlayer ? st.combat.player : findEnemy(st, uid);
    if (!u) return;
    const chDef = (DS.characters && st.run && DS.characters[st.run.character]) || {};
    const def = isPlayer ? chDef : (u.def || (DS.enemies && DS.enemies[u.id]) || {});
    const name = String(isPlayer ? (chDef.name || u.name || 'You') : (u.name || def.name || u.id || 'Enemy'));
    const hp = Math.max(0, num(u.hp, 0));
    const max = Math.max(1, num(u.maxHp, 1));
    const block = Math.max(0, num(u.block, 0));
    const parts = ['<p><b>HP</b> ' + hp + '/' + max + (block > 0 ? ' &middot; <b>Block</b> ' + block : '') + '</p>'];
    if (!isPlayer) {
      const it = u.intent;
      const tier = def.tier ? '<i>' + esc(def.tier) + '</i> &middot; ' : '';
      parts.push('<p>' + tier + (it
        ? 'Next: <b>' + esc(it.name || 'Unknown move') + '</b> &mdash; ' + esc(INTENT_TEXT[it.type] || INTENT_TEXT.unknown)
        : 'Next move unknown.') + '</p>');
    }
    parts.push('<div class="ds-detail-h">Statuses</div>');
    const map = u.statuses || {};
    const ids = Object.keys(map).filter((k) => !!map[k]);
    if (!ids.length) parts.push('<p><i>No status effects.</i></p>');
    for (const id of ids) {
      const n = map[id];
      const sd = (DS.statuses && DS.statuses[id]) || { name: id, icon: '•', desc: '' };
      const showN = typeof n === 'number' && sd.stacks !== false;
      const text = String(sd.desc || '').split('{n}').join(typeof n === 'number' ? String(n) : '');
      parts.push('<div class="ds-detail-row"><div><span>' + esc(sd.icon || '•') + '</span> <b>' + esc(sd.name || id) + '</b>' +
        (showN ? ' <span class="ds-detail-n">' + esc(n) + '</span>' : '') + '</div>' +
        (text ? '<div class="ds-detail-desc">' + richText(text) + '</div>' : '') + '</div>');
    }
    if (!isPlayer && def.moves && typeof def.moves === 'object') {
      const nextId = u.intent ? u.intent.moveId : null;
      parts.push('<div class="ds-detail-h">Moves</div>');
      for (const key of Object.keys(def.moves)) {
        const mv = def.moves[key] || {};
        parts.push('<div class="ds-detail-row"><b>' + esc(mv.name || key) + '</b> <i>' + esc(mv.intent || 'unknown') + '</i>' +
          (key === nextId ? ' <span class="ds-detail-n">next</span>' : '') + '</div>');
      }
    }
    DS.ui.modal({
      title: name,
      content: '<div class="ds-unit-detail">' + parts.join('') + '</div>',
      buttons: [{ label: 'Close', primary: true }],
      dismissable: true
    });
  }

  function showPile(st, title, cards) {
    if (!live(st)) return;
    const list = (cards || []).filter(Boolean);
    if (!list.length) {
      toast(title + ' is empty.');
      return;
    }
    const rows = list.map((c) => ({ c, d: cardData(c) }));
    rows.sort((a, b) => {
      const ta = TYPE_ORDER[a.d.type] != null ? TYPE_ORDER[a.d.type] : 9;
      const tb = TYPE_ORDER[b.d.type] != null ? TYPE_ORDER[b.d.type] : 9;
      if (ta !== tb) return ta - tb;
      const ca = costKey(a.c.cost != null ? a.c.cost : a.d.cost);
      const cb = costKey(b.c.cost != null ? b.c.cost : b.d.cost);
      if (ca !== cb) return ca - cb;
      return String(a.d.name || a.c.id).localeCompare(String(b.d.name || b.c.id));
    });
    const insts = rows.map((r) => ({ uid: r.c.uid, id: r.c.id, upgraded: !!r.c.upgraded }));
    try {
      DS.ui.showDeck(title, insts);
    } catch (e) { logErr('showDeck', e); }
  }

  function showBanner(st, text, kind) {
    const b = st.bannerEl;
    if (!b) return;
    b.textContent = text;
    b.style.color = BANNER_COLORS[kind] || BANNER_COLORS.player;
    b.style.opacity = '1';
    cancelTimer(st, st.bannerTimer);
    st.bannerTimer = schedule(st, () => { b.style.opacity = '0'; }, 1000);
  }

  function moveNameOf(e, move) {
    if (move && typeof move === 'object') return String(move.name || move.id || move.moveId || '');
    if (typeof move === 'string') {
      const d = e && e.def && e.def.moves ? e.def.moves[move] : null;
      return String((d && d.name) || move);
    }
    return String((e && e.intent && e.intent.name) || '');
  }

  function showMoveBubble(st, p) {
    if (!live(st) || !p || !p.enemy || !st.root) return;
    const ref = st.enemyEls.get(p.enemy.uid);
    if (!ref || typeof ref.root.getBoundingClientRect !== 'function') return;
    const name = moveNameOf(p.enemy, p.move);
    if (!name) return;
    const rr = st.root.getBoundingClientRect();
    const r = ref.root.getBoundingClientRect();
    const x = r.left - rr.left + r.width / 2;
    const y = r.top - rr.top + r.height * 0.35;
    const bub = el('div', { class: 'ds-enemy-move', text: name });
    bub.style.cssText = [
      'position:absolute',
      'left:' + x.toFixed(0) + 'px',
      'top:' + y.toFixed(0) + 'px',
      'transform:translate(-50%,-50%)',
      'pointer-events:none',
      'z-index:35',
      'white-space:nowrap',
      'padding:4px 12px',
      'border-radius:12px',
      'background:rgba(20,8,12,.92)',
      'border:1px solid #c9a25a',
      'color:#f5e6c8',
      'font:700 15px system-ui,sans-serif',
      'box-shadow:0 4px 14px rgba(0,0,0,.6)',
      'transition:opacity .35s ease',
      'opacity:1'
    ].join(';');
    st.root.appendChild(bub);
    schedule(st, () => {
      bub.style.opacity = '0';
      schedule(st, () => bub.remove(), 400);
    }, 900);
  }

  // ---------------------------------------------------------------------------
  // Turn flow and combat end
  // ---------------------------------------------------------------------------
  function onTurnStart(st, p) {
    if (!live(st)) return;
    if (p && p.side === 'enemy') {
      clearMode(st);
      showBanner(st, 'Enemy Turn', 'enemy');
    } else {
      showBanner(st, 'Your Turn', 'player');
    }
    update(st);
  }

  async function onCombatEnd(st, p) {
    if (!live(st) || st.ending) return;
    st.ending = true;
    clearMode(st);
    const won = !!p && p.result === 'won';
    try {
      if (won) {
        showBanner(st, 'Victory!', 'win');
        await delay(900);
        if (!live(st)) return;
        DS.ui.go('reward', { tier: st.tier, fromEvent: st.fromEvent });
      } else {
        showBanner(st, 'Defeat', 'lose');
        await delay(900);
        if (!live(st)) return;
        DS.Run.end(false);
        DS.ui.go('gameover');
      }
    } catch (e) {
      logErr('combat end', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard: 1-9 and 0 play hand cards, E ends the turn, arrows and Enter pick targets, Esc cancels
  // ---------------------------------------------------------------------------
  function confirmKbTarget(st) {
    if (!st.mode || !st.kbTarget) return;
    onEnemyClick(st, st.kbTarget);
  }

  function onKey(st, ev) {
    if (!live(st) || !ev) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (overlayOpen()) return;
    const key = ev.key;

    if (key === 'Escape') {
      if (st.drag || st.press) {
        ev.preventDefault();
        cancelDrag(st);
      } else if (st.mode) {
        ev.preventDefault();
        cancelTargeting(st);
      }
      return;
    }
    if (st.drag) return; // mid-drag: keys wait until the card is dropped
    if (st.mode) {
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        ev.preventDefault();
        cycleTarget(st, 1);
        return;
      }
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        ev.preventDefault();
        cycleTarget(st, -1);
        return;
      }
      if (key === 'Enter' || key === ' ') {
        ev.preventDefault();
        confirmKbTarget(st);
        return;
      }
    }
    if (key === ' ') {
      ev.preventDefault();
      if (canAct(st)) endTurnNow(st);
      return;
    }
    if (key === 'l' || key === 'L') {
      ev.preventDefault();
      toggleLog(st);
      return;
    }
    if (typeof key === 'string' && /^[0-9]$/.test(key)) {
      const idx = key === '0' ? 9 : Number(key) - 1;
      const card = (st.combat.hand || [])[idx];
      if (card) {
        ev.preventDefault();
        onCardClick(st, card.uid);
      }
      return;
    }
    if (key === 'e' || key === 'E') {
      ev.preventDefault();
      if (canAct(st)) endTurnNow(st);
    }
  }

  // ---------------------------------------------------------------------------
  // Event subscriptions and lifecycle
  // ---------------------------------------------------------------------------
  function subscribe(st) {
    const on = (name, fn) => {
      const wrapped = (payload) => {
        try {
          if (live(st)) fn(payload);
        } catch (e) {
          logErr(name, e);
        }
      };
      let off = null;
      try {
        off = DS.events.on(name, wrapped);
      } catch (e) {
        logErr('subscribe ' + name, e);
        return;
      }
      st.unsubs.push(() => {
        if (typeof off === 'function') off();
        else if (DS.events && typeof DS.events.off === 'function') DS.events.off(name, wrapped);
      });
    };
    on('combat:update', () => update(st));
    on('combat:turnStart', (p) => onTurnStart(st, p));
    on('combat:enemyMove', (p) => showMoveBubble(st, p));
    on('combat:end', (p) => { onCombatEnd(st, p); });
    on('ui:potionClick', (p) => onPotionClick(st, p));
    on('combat:log', (p) => appendLog(st, p && p.entry ? p.entry : p));
  }

  function teardown(st) {
    if (!st || st.exited) return;
    st.exited = true;
    // Drag listeners live on the document: drop them and any arrow or half-finished drag.
    try { if (st.dragOff) st.dragOff(); } catch (e) { logErr('drag listeners', e); }
    st.drag = null;
    st.press = null;
    try { removeArrow(st); } catch (e) { logErr('arrow', e); }
    for (const fn of st.unsubs) {
      try { fn(); } catch (e) { logErr('unsubscribe', e); }
    }
    st.unsubs = [];
    try {
      if (st.onKey && typeof document !== 'undefined') document.removeEventListener('keydown', st.onKey);
    } catch (e) { logErr('keydown', e); }
    try {
      if (st.observer) st.observer.disconnect();
    } catch (e) { logErr('observer', e); }
    st.observer = null;
    for (const id of Array.from(st.timers)) clearTimeout(id);
    st.timers.clear();
    // Leaving mid-fight (menu, abandon, error recovery) must not let the engine keep playing in the
    // background. A no-op when the fight already ended.
    try {
      if (st.combat && typeof st.combat.abandon === 'function') st.combat.abandon();
    } catch (e) { logErr('abandon', e); }
  }

  if (DS.ui && typeof DS.ui.registerScreen === 'function') {
    DS.ui.registerScreen('combat', {
      async enter(params, rootEl) {
        params = params || {};
        const run = DS.run;
        if (!run) {
          setTimeout(() => DS.ui.go('menu'), 0);
          return;
        }
        if (S) teardown(S);

        const st = {
          exited: false,
          run,
          tier: params.tier || 'normal',
          fromEvent: !!params.fromEvent,
          combat: null,
          root: null,
          field: null,
          playerRef: null,
          enemiesEl: null,
          enemyEls: new Map(),
          hintEl: null,
          handEl: null,
          energyEl: null,
          endBtn: null,
          drawRef: null,
          discardRef: null,
          exhaustRef: null,
          bannerEl: null,
          bannerTimer: null,
          mode: null,            // null | 'card' | 'potion'
          selectedUid: null,     // hand card awaiting an enemy target
          potionSlot: null,      // potion slot awaiting an enemy target
          kbTarget: null,        // uid of the highlighted enemy while targeting
          localBusy: false,
          ending: false,
          handSig: null,
          unsubs: [],
          timers: new Set(),
          onKey: null,
          observer: null,
          hoverUid: null,              // enemy under the pointer: the target for live previews
          drag: null,                  // card drag in progress (see onDragMove)
          press: null,                 // pointer down on a playable card, before it becomes a drag
          dragOff: null,               // removes the document drag listeners
          dragEndedAt: 0,
          arrowEl: null,
          arrowPath: null,
          arrowHead: null,
          logRef: null,
          logOpen: !!setting('showLog', true)
        };
        S = st;

        let combat = null;
        try {
          combat = new DS.Combat(run, params.encounterId, { fromEvent: !!params.fromEvent });
        } catch (err) {
          logErr('new DS.Combat', err);
          S = null;
          toast('That encounter could not be started.');
          setTimeout(() => DS.ui.go('map'), 0);
          return;
        }
        st.combat = combat;

        injectStyle();
        buildDom(st, rootEl);
        (Array.isArray(combat.log) ? combat.log : []).forEach((entry) => appendLog(st, entry));
        subscribe(st);

        if (typeof document !== 'undefined') {
          st.onKey = (ev) => {
            try { onKey(st, ev); } catch (e) { logErr('key', e); }
          };
          document.addEventListener('keydown', st.onKey);
          const ov = document.getElementById('overlay');
          if (ov && typeof MutationObserver === 'function') {
            // Updates are skipped while a modal is open; redraw once a modal opens or closes. Toasts and
            // floating numbers also land in #overlay, and redrawing for each of them would be wasted work.
            st.observer = new MutationObserver((records) => {
              if (!live(st) || overlayOpen()) return;
              const modalChanged = records.some((r) =>
                Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some(isModalBackdrop));
              if (modalChanged) update(st);
            });
            st.observer.observe(ov, { childList: true });
          }
        }

        update(st);
        try {
          await combat.start();
        } catch (err) {
          logErr('combat.start', err);
          toast('The fight could not be started.');
        }
        update(st);
      },

      exit() {
        const st = S;
        S = null;
        if (st) teardown(st);
      }
    });
  } else {
    console.warn('[combat_ui] DS.ui.registerScreen is not available; combat screen not registered.');
  }
})();
