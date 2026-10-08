(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // The combat screen (contract sections 7 and 9). Layout and unit styling come from styles.css
  // (.ds-combat-field, .ds-player, .ds-enemies, .ds-enemy, .ds-hand, .ds-pile-*, .ds-energy, .ds-endturn).
  // Only the hint line and the turn banner use inline styles, because styles.css has no rules for them.

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
  const HINT_STYLE = 'position:absolute;left:0;right:0;top:0.6rem;z-index:12;padding:0 12px;text-align:center;' +
    'font:600 0.95rem system-ui,sans-serif;color:#e8d9b5;text-shadow:0 1px 3px #000;pointer-events:none;';
  const BANNER_STYLE = 'position:absolute;left:0;right:0;top:34%;z-index:40;text-align:center;' +
    'font:700 2.8rem Georgia,"Times New Roman",serif;letter-spacing:0.15em;text-shadow:0 3px 14px #000,0 0 6px #000;' +
    'pointer-events:none;opacity:0;transition:opacity 0.3s ease;';

  // Rules styles.css does not have for this screen. Injected once, when the combat screen first opens.
  const STYLE_ID = 'ds-combat-ui-style';
  const EXTRA_CSS = [
    // .ds-screen has padding for menus; the combat field should fill the whole screen edge to edge.
    '.ds-screen.ds-screen-combat{padding:0;overflow:hidden}',
    '.ds-intent-attack{border-color:#8f2a22}',
    '.ds-intent-special{border-color:#7d5fb0;box-shadow:0 0 0.6rem rgba(160,120,230,0.35)}'
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

  function buildPlayer() {
    const root = el('div', { class: 'ds-player', dataset: { combatant: 'player' } });
    const art = el('div', { class: 'ds-unit-art' });
    const name = el('div', { class: 'ds-unit-name' });
    const hp = makeHp();
    const block = el('span', { class: 'ds-block-badge' });
    const statuses = el('div', { class: 'ds-statuses' });
    root.append(art, name, hp.bar, block, statuses);
    return { root, art, name, hp, block, statuses, statusKey: null };
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
    root.append(intent, art, name, hp.bar, block, statuses);

    root.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onEnemyClick(st, uid);
    });
    root.addEventListener('mouseenter', () => {
      if (!live(st) || !st.mode) return;
      const e = findEnemy(st, uid);
      if (!e || isDead(e) || st.kbTarget === uid) return;
      st.kbTarget = uid;
      paintEnemies(st);
    });
    return { uid, root, intent, intentIcon, intentVal, art, name, hp, block, statuses, statusKey: null };
  }

  function paintEnemy(st, ref, e) {
    const def = e.def || (DS.enemies && DS.enemies[e.id]) || {};
    const dead = isDead(e);
    const targeting = !!st.mode && !dead;
    const cls = ['ds-enemy'];
    if (dead) cls.push('ds-enemy-dead');
    if (targeting) cls.push('ds-enemy-targetable');
    if (targeting && st.kbTarget === e.uid) cls.push('ds-enemy-targeted');
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
    ref.art.textContent = def.icon || '👾';
    ref.art.style.fontSize = (5 * scale).toFixed(2) + 'rem';
    ref.name.textContent = String(e.name || def.name || e.id || 'Enemy');
    paintHp(ref.hp, e.hp, e.maxHp);
    paintBlock(ref.block, e.block);
    paintStatuses(ref, e);
  }

  function paintPlayer(st) {
    const p = st.combat.player || {};
    const ch = (DS.characters && st.run && DS.characters[st.run.character]) || {};
    const ref = st.playerRef;
    ref.art.textContent = ch.icon || '🧍';
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
    const player = buildPlayer();
    const enemies = el('div', { class: 'ds-enemies' });
    field.append(player.root, enemies);

    const hint = el('div', { class: 'ds-combat-hint', style: HINT_STYLE });
    const draw = makePile('draw', () => showPile(st, 'Draw pile', st.combat.drawPile));
    const discard = makePile('discard', () => showPile(st, 'Discard pile', st.combat.discardPile));
    const exhaust = makePile('exhaust', () => showPile(st, 'Exhaust pile', st.combat.exhaustPile));
    const energy = el('div', { class: 'ds-energy', text: '0/0' });
    const hand = el('div', { class: 'ds-hand' });
    const endBtn = el('button', {
      class: 'ds-btn ds-btn-primary ds-endturn',
      text: 'End Turn (E)',
      onclick: () => endTurnNow(st)
    });
    const banner = el('div', { class: 'ds-turn-banner', style: BANNER_STYLE });

    root.append(field, hint, draw.node, exhaust.node, discard.node, energy, hand, endBtn, banner);
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
      bannerEl: banner
    });
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
    if (st.mode === 'card') {
      const card = st.selectedUid ? findHand(st, st.selectedUid) : null;
      const nm = card ? cardData(card).name || 'card' : 'card';
      hint = 'Choose a target for ' + nm + ': click an enemy (or ←/→ then Enter). Esc cancels.';
    } else if (st.mode === 'potion') {
      hint = 'Choose a target for your potion: click an enemy (or ←/→ then Enter). Esc cancels.';
    } else if (c.phase === 'player') {
      hint = enc + 'Turn ' + num(c.turn, 1) + ' · keys 1-0 play cards · E ends turn';
    } else if (c.phase === 'enemy') {
      hint = enc + 'Enemies are acting…';
    } else {
      hint = enc.replace(/ · $/, '');
    }
    st.hintEl.textContent = hint;
  }

  function paintHand(st) {
    const c = st.combat;
    const hand = (c.hand || []).filter(Boolean);
    const act = canAct(st);
    const checks = hand.map((card) => safeCheck(st, card));
    const selected = st.mode === 'card' ? st.selectedUid : null;
    // Only rebuild the hand when something visible changed, so hover states survive ordinary updates.
    const sig = [
      act ? 1 : 0,
      selected || '',
      hand.map((card, i) => [
        card.uid, card.id, card.upgraded ? 1 : 0, String(card.cost), checks[i].ok ? 1 : 0, checks[i].reason
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
        onclick: () => onCardClick(st, card.uid)
      });
      if (!node) return;
      // Dimmed rather than disabled, so that clicking still explains why it cannot be played.
      if (!playable) node.classList.add('ds-card-disabled');
      node.title = playable ? '' : (chk.reason || (act ? '' : 'Wait for your turn.'));
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

  async function endTurnNow(st) {
    if (!canAct(st)) return;
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
    if (!live(st) || !st.mode || !canActCore(st)) return;
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
    const html = '<div class="ds-potion-detail"><p>' + desc + '</p>' +
      (tgtText ? '<p><i>' + esc(tgtText) + '</i></p>' : '') + note + '</div>';
    m = DS.ui.modal({
      title: ((def.icon ? def.icon + ' ' : '') + (def.name || id)).trim(),
      content: html,
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
      if (st.mode) {
        ev.preventDefault();
        cancelTargeting(st);
      }
      return;
    }
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
  }

  function teardown(st) {
    if (!st || st.exited) return;
    st.exited = true;
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
          observer: null
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
