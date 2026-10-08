(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});
  DS.ui = DS.ui || {};

  /* ================================================================
   * constants
   * ================================================================ */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
  const CLASS_ORDER = { berserker: 0, shade: 1, arcanist: 2, warden: 3, colorless: 4, status: 5, curse: 6 };
  const RARITY_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, boss: 4, shop: 5, event: 6, special: 7 };
  const TIER_ORDER = { minion: 0, easy: 1, normal: 2, elite: 3, boss: 4 };
  const NODE_ICON = { fight: '⚔️', elite: '💀', rest: '🔥', shop: '🛒', event: '❔', treasure: '💰', boss: '👑' };
  const NODE_LABEL = { fight: 'Fight', elite: 'Elite fight', rest: 'Rest site', shop: 'Shop', event: 'Event', treasure: 'Treasure chest', boss: 'Boss' };
  const NODE_ORDER = ['fight', 'elite', 'rest', 'shop', 'event', 'treasure', 'boss'];
  const MAP = { colW: 104, rowH: 92, padX: 64, padY: 52, size: 58 };
  const HIDE_TOPBAR = { menu: true, charselect: true, compendium: true, gameover: true, victory: true };
  const CARD_FILTERS = ['all', 'berserker', 'shade', 'arcanist', 'warden', 'colorless', 'status', 'curse'];

  /* ================================================================
   * DOM and generic helpers
   * ================================================================ */
  function strip(attrs) {
    const out = {};
    if (!attrs) return out;
    Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v !== undefined && v !== null && v !== false) out[k] = v;
    });
    return out;
  }

  // DS.ui.el wrapper: drops empty attrs and null/false children so callers can use conditionals inline.
  function el(tag, attrs, kids) {
    let list = kids === undefined || kids === null ? [] : Array.isArray(kids) ? kids : [kids];
    list = list.filter(function (k) { return k !== undefined && k !== null && k !== false; });
    return DS.ui.el(tag, strip(attrs), list);
  }

  function txt(tag, cls, text) {
    return el(tag, { class: cls, text: text === undefined || text === null ? '' : String(text) });
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v !== undefined && v !== null && v !== false) node.setAttribute(k, String(v));
    });
    return node;
  }

  function tryCall(label, fn, fallback) {
    try {
      return fn();
    } catch (e) {
      console.error('[duskspire/screens] ' + label + ':', e);
      return fallback;
    }
  }

  async function tryAwait(label, fn, fallback) {
    try {
      return await fn();
    } catch (e) {
      console.error('[duskspire/screens] ' + label + ':', e);
      return fallback;
    }
  }

  function toast(msg) {
    tryCall('toast', function () { DS.ui.toast(msg); });
  }

  function go(name, params) {
    return tryCall('go ' + name, function () { return DS.ui.go(name, params); }, undefined);
  }

  function later(fn) {
    setTimeout(fn, 0);
  }

  function cap(s) {
    s = String(s === undefined || s === null ? '' : s);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function ord(map, key, dflt) {
    return map[key] !== undefined ? map[key] : (dflt === undefined ? 99 : dflt);
  }

  function dsc(text) {
    return tryCall('describe', function () { return DS.ui.describe(String(text || '')); }, esc(text));
  }

  function tip(node, html) {
    tryCall('tooltip', function () { DS.ui.tooltip(node, html); });
    return node;
  }

  function pageHead(title, sub, right) {
    return el('div', { class: 'ds-scr-head' }, [
      el('div', null, [txt('div', 'ds-title', title), sub ? txt('div', 'ds-subtitle', sub) : null]),
      right || null
    ]);
  }

  // Splits "[Pray] Heal 20 HP." into a bold tag and the rest of the text.
  function labelNodes(label) {
    const s = String(label === undefined || label === null ? '' : label);
    const m = s.match(/^\s*\[([^\]]+)\]\s*([\s\S]*)$/);
    if (m) return [txt('b', 'ds-scr-choice-tag', m[1]), txt('span', null, ' ' + m[2])];
    return [txt('span', null, s)];
  }

  /* ================================================================
   * data helpers
   * ================================================================ */
  const defOf = {
    card: function (id) { return (DS.cards && DS.cards[id]) || null; },
    relic: function (id) { return (DS.relics && DS.relics[id]) || null; },
    potion: function (id) { return (DS.potions && DS.potions[id]) || null; },
    enemy: function (id) { return (DS.enemies && DS.enemies[id]) || null; },
    character: function (id) { return (DS.characters && DS.characters[id]) || null; }
  };

  // Resolved card data for a card instance {id, upgraded}; never throws, never returns null.
  function cardData(inst) {
    const id = inst && inst.id;
    let d = tryCall('getCardData', function () { return DS.getCardData(inst); }, null);
    if (!d) {
      d = {
        id: id || '?', name: id || 'Unknown card', class: 'colorless', type: 'skill', rarity: 'common',
        cost: 0, icon: '❔', desc: '', effects: [], target: 'none', upgraded: !!(inst && inst.upgraded)
      };
    }
    if (!Array.isArray(d.effects)) d.effects = [];
    if (!d.name) d.name = String(d.id || id || '?');
    return d;
  }

  function renderCardSafe(inst, opts) {
    const data = cardData(inst);
    return tryCall('renderCard', function () { return DS.ui.renderCard(data, strip(opts)); }, null) ||
      txt('div', 'ds-card', data.name);
  }

  function isUpgradable(inst) {
    const def = defOf.card(inst && inst.id);
    if (!def || inst.upgraded || !def.upgrade) return false;
    if (def.type === 'curse' || def.type === 'status' || def.class === 'curse' || def.class === 'status') return false;
    return true;
  }

  function sortDeck(deck) {
    return (Array.isArray(deck) ? deck.slice() : []).sort(function (a, b) {
      const da = cardData(a);
      const db = cardData(b);
      const t = ord(TYPE_ORDER, da.type, 9) - ord(TYPE_ORDER, db.type, 9);
      if (t) return t;
      const n = String(da.name).localeCompare(String(db.name));
      if (n) return n;
      return (da.upgraded ? 1 : 0) - (db.upgraded ? 1 : 0);
    });
  }

  function defSort(a, b) {
    const c = ord(CLASS_ORDER, a.class) - ord(CLASS_ORDER, b.class);
    if (c) return c;
    const t = ord(TYPE_ORDER, a.type, 9) - ord(TYPE_ORDER, b.type, 9);
    if (t) return t;
    const ca = typeof a.cost === 'number' ? a.cost : 0;
    const cb = typeof b.cost === 'number' ? b.cost : 0;
    if (ca !== cb) return ca - cb;
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  }

  function rarityThenName(a, b) {
    const r = ord(RARITY_ORDER, a.rarity, 8) - ord(RARITY_ORDER, b.rarity, 8);
    if (r) return r;
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  }

  function relicTip(id, counter) {
    const d = defOf.relic(id) || {};
    let h = '<div><b>' + esc(d.name || id) + '</b></div>';
    if (d.desc) h += '<div>' + dsc(d.desc) + '</div>';
    if (d.flavor) h += '<div><i>' + esc(d.flavor) + '</i></div>';
    if (typeof counter === 'number') h += '<div class="ds-scr-muted">Counter: ' + counter + '</div>';
    return h;
  }

  function relicEl(r) {
    const id = r && r.id;
    const counter = r && typeof r.counter === 'number' ? r.counter : null;
    const d = defOf.relic(id) || {};
    const node = el('div', { class: 'ds-relic', text: d.icon || '🔮', style: 'position:relative;' });
    if (counter !== null && counter > 0) node.appendChild(txt('span', 'ds-scr-badge', counter));
    tip(node, relicTip(id, counter));
    return node;
  }

  function potionTip(id) {
    const d = defOf.potion(id) || {};
    let h = '<div><b>' + esc(d.name || id) + '</b></div>';
    if (d.desc) h += '<div>' + dsc(d.desc) + '</div>';
    if (d.rarity) h += '<div class="ds-scr-muted">' + esc(cap(d.rarity)) + ' potion</div>';
    return h;
  }

  function curGold() {
    return (DS.run && Number(DS.run.gold)) || 0;
  }

  function hasFreePotionSlot() {
    const pots = (DS.run && Array.isArray(DS.run.potions)) ? DS.run.potions : [];
    let n = tryCall('potionSlots', function () { return DS.Run.potionSlots(); }, null);
    n = Number(n) || pots.length || 3;
    for (let i = 0; i < n; i++) if (!pots[i]) return true;
    return false;
  }

  function priceTag(price, can) {
    return txt('div', 'ds-price' + (can ? '' : ' ds-price-unaffordable'), '🪙 ' + price);
  }

  // Generic tall "thing" tile for relics, potions and services in the shop.
  function thingItem(o) {
    const node = el('div', {
      class: 'ds-shop-item ds-scr-thing' + (o.sold ? ' ds-sold' : '') + (!o.sold && !o.can ? ' ds-scr-dim' : ''),
      style: 'position:relative;',
      onclick: o.sold ? null : o.onbuy
    }, [
      txt('div', 'ds-scr-bigicon', o.icon),
      txt('div', 'ds-scr-pick-name', o.name),
      txt('div', 'ds-scr-rarity', o.sub),
      el('div', { class: 'ds-scr-pick-desc', html: dsc(o.desc) }),
      priceTag(o.price, o.can)
    ]);
    if (o.sold) node.appendChild(txt('div', 'ds-scr-sold', o.soldText || 'SOLD'));
    return node;
  }

  /* ================================================================
   * top bar
   * ================================================================ */
  let topQueued = false;
  function scheduleTopBar() {
    if (topQueued) return;
    topQueued = true;
    setTimeout(function () {
      topQueued = false;
      refreshTopBarNow();
    }, 0);
  }

  function potionSlotCount() {
    const n = tryCall('potionSlots', function () { return DS.Run.potionSlots(); }, null);
    if (typeof n === 'number' && n > 0) return n;
    const pots = (DS.run && Array.isArray(DS.run.potions)) ? DS.run.potions : [];
    return Math.max(3, pots.length);
  }

  function onPotionClick(slot, id) {
    if (!id) return;
    tryCall('emit ui:potionClick', function () { DS.events.emit('ui:potionClick', { slot: slot }); });
    if (DS.ui.current === 'combat') return;
    const d = defOf.potion(id) || {};
    let m = null;
    m = DS.ui.modal({
      title: d.name || id,
      content: '<div class="ds-scr-pick-desc">' + dsc(d.desc || '') + '</div>' +
        '<div class="ds-scr-muted">Potions can only be used in combat. Discard this one?</div>',
      dismissable: true,
      buttons: [
        {
          label: 'Discard',
          onclick: function () {
            if (m) m.close();
            tryCall('discardPotion', function () { DS.Run.discardPotion(slot); });
            scheduleTopBar();
          }
        },
        { label: 'Keep', primary: true, onclick: function () { if (m) m.close(); } }
      ]
    });
  }

  function openDeck() {
    const run = DS.run;
    if (!run) return;
    const deck = sortDeck(run.deck);
    // showDeck appends the card count to the title itself.
    tryCall('showDeck', function () { DS.ui.showDeck('Deck', deck); });
  }

  function openMapPeek() {
    const run = DS.run;
    if (!run || !run.map) return;
    const scroll = el('div', { class: 'ds-scr-map-wrap', style: 'max-height:60vh;' }, [buildMapView(run.map, { interactive: false })]);
    let m = null;
    m = DS.ui.modal({
      title: 'Map',
      content: scroll,
      wide: true,
      dismissable: true,
      buttons: [{ label: 'Close', primary: true, onclick: function () { if (m) m.close(); } }]
    });
    later(function () { focusMap(scroll, run.map, run.nodeId); });
  }

  function abandonRun() {
    tryCall('abandon', function () { DS.Run.end(false); });
    // Only an unfinished fight on screen needs stopping; DS.combat keeps the last finished fight otherwise.
    if (DS.combat && DS.ui.current === 'combat') {
      tryCall('stop combat', function () { DS.combat.phase = 'lost'; });
      DS.combat = null;
    }
    go('gameover');
  }

  function confirmAbandon() {
    let m = null;
    m = DS.ui.modal({
      title: 'Abandon this run?',
      content: '<div class="ds-scr-pick-desc">The run ends here and cannot be resumed.</div>',
      dismissable: true,
      buttons: [
        { label: 'Abandon run', onclick: function () { if (m) m.close(); abandonRun(); } },
        { label: 'Keep going', primary: true, onclick: function () { if (m) m.close(); } }
      ]
    });
  }

  function muteLabel() {
    return DS.audio && DS.audio.muted ? '🔇 Sound: off' : '🔊 Sound: on';
  }

  function openSettings() {
    const run = DS.run;
    const info = run
      ? '<div class="ds-scr-muted">' + esc(defOf.character(run.character) ? defOf.character(run.character).name : run.character) +
        ' · Act ' + esc(run.act) + ' · Floor ' + esc(run.floor) + '</div>'
      : '';
    const body = el('div', { class: 'ds-scr-page', html: info }, []);
    let m = null;
    if (DS.audio && typeof DS.audio.setMuted === 'function') {
      const muteBtn = el('button', {
        class: 'ds-btn',
        text: muteLabel(),
        onclick: function () {
          tryCall('mute', function () { DS.audio.setMuted(!DS.audio.muted); });
          muteBtn.textContent = muteLabel();
        }
      });
      body.appendChild(muteBtn);
    }
    if (run && !run.over) {
      body.appendChild(el('button', {
        class: 'ds-btn ds-btn-danger',
        text: 'Abandon run',
        onclick: function () { if (m) m.close(); confirmAbandon(); }
      }));
    }
    m = DS.ui.modal({
      title: 'Settings',
      content: body,
      dismissable: true,
      buttons: [{ label: 'Close', primary: true, onclick: function () { if (m) m.close(); } }]
    });
  }

  function refreshTopBarNow() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('topbar');
    if (!bar) return;
    bar.className = 'ds-topbar';
    const run = DS.run;
    const cur = DS.ui.current;
    if (!run || run.over || !cur || HIDE_TOPBAR[cur]) {
      clear(bar);
      bar.style.display = 'none';
      return;
    }
    bar.style.display = '';

    const ch = defOf.character(run.character) || {};
    const kids = [];
    kids.push(el('div', { class: 'ds-topbar-item', style: ch.color ? 'border-color:' + ch.color + ';' : null }, [
      txt('span', 'ds-scr-tb-ico', ch.icon || '👤'),
      txt('b', null, ch.name || run.character || 'Unknown')
    ]));
    kids.push(txt('div', 'ds-topbar-item ds-scr-tb-hp', '❤️ ' + (Number(run.hp) || 0) + ' / ' + (Number(run.maxHp) || 0)));
    kids.push(txt('div', 'ds-topbar-item', '🪙 ' + (Number(run.gold) || 0)));
    kids.push(txt('div', 'ds-topbar-item', 'Act ' + (run.act || 1) + ' · Floor ' + (run.floor || 0)));

    // potions
    const potGroup = el('div', { class: 'ds-scr-tb-group' });
    const slots = potionSlotCount();
    const pots = Array.isArray(run.potions) ? run.potions : [];
    for (let i = 0; i < slots; i++) {
      const id = pots[i] || null;
      if (id) {
        const d = defOf.potion(id) || {};
        const slot = i;
        const p = el('div', {
          class: 'ds-potion',
          text: d.icon || '🧪',
          style: d.color ? 'border-color:' + d.color + ';' : null,
          onclick: function () { onPotionClick(slot, id); }
        });
        tip(p, potionTip(id));
        potGroup.appendChild(p);
      } else {
        potGroup.appendChild(el('div', { class: 'ds-potion-empty' }));
      }
    }
    kids.push(potGroup);

    // relics
    const relicGroup = el('div', { class: 'ds-scr-tb-group' }, (Array.isArray(run.relics) ? run.relics : []).map(relicEl));
    kids.push(relicGroup);

    kids.push(el('div', { class: 'ds-scr-tb-spacer' }));
    const deckLen = Array.isArray(run.deck) ? run.deck.length : 0;
    kids.push(el('button', { class: 'ds-btn ds-scr-tb-btn', text: '🂠 Deck (' + deckLen + ')', onclick: openDeck }));
    if (cur !== 'map') kids.push(el('button', { class: 'ds-btn ds-scr-tb-btn', text: '🗺️ Map', onclick: openMapPeek }));
    kids.push(el('button', { class: 'ds-btn ds-scr-tb-btn', text: '⚙️', onclick: openSettings }));

    clear(bar);
    kids.forEach(function (k) { bar.appendChild(k); });
  }

  DS.ui.refreshTopBar = refreshTopBarNow;

  /* ================================================================
   * map view (shared by the map screen and the map peek)
   * ================================================================ */
  function mapGeometry(map) {
    const nodes = map.nodes || {};
    const rows = Array.isArray(map.rows) ? map.rows : [];
    let topRow = rows.length || 15;
    const boss = map.bossId ? nodes[map.bossId] : null;
    if (boss && typeof boss.row === 'number' && boss.row > topRow) topRow = boss.row;
    let maxCol = 6;
    Object.keys(nodes).forEach(function (k) {
      const n = nodes[k] || {};
      if (typeof n.row === 'number' && n.row > topRow) topRow = n.row;
      if (typeof n.col === 'number' && n.col > maxCol) maxCol = n.col;
    });
    const pos = function (n) {
      const row = typeof n.row === 'number' ? n.row : topRow;
      const col = typeof n.col === 'number' ? n.col : 3;
      return { x: MAP.padX + col * MAP.colW, y: MAP.padY + (topRow - row) * MAP.rowH };
    };
    return {
      pos: pos,
      topRow: topRow,
      width: MAP.padX * 2 + maxCol * MAP.colW,
      height: MAP.padY * 2 + topRow * MAP.rowH
    };
  }

  // Scrolls so the player's current row (or the start row) sits near the lower-middle of the viewport.
  function focusMap(scroll, map, nodeId) {
    const geo = mapGeometry(map);
    const cur = nodeId && map.nodes ? map.nodes[nodeId] : null;
    const row = cur && typeof cur.row === 'number' ? cur.row : 0;
    const y = geo.pos({ row: row, col: 0 }).y;
    scroll.scrollTop = Math.max(0, y - scroll.clientHeight * 0.6);
  }

  function buildMapView(map, opts) {
    opts = opts || {};
    const run = DS.run || {};
    const nodes = map.nodes || {};
    const geo = mapGeometry(map);
    const avail = {};
    if (opts.interactive) {
      tryCall('availableNodes', function () {
        (DS.Run.availableNodes() || []).forEach(function (n) {
          avail[typeof n === 'string' ? n : n.id] = true;
        });
      });
    }
    const wrap = el('div', {
      class: 'ds-scr-map',
      style: 'width:' + geo.width + 'px;height:' + geo.height + 'px;'
    });

    const svg = svgEl('svg', {
      class: 'ds-scr-map-svg',
      width: geo.width,
      height: geo.height,
      viewBox: '0 0 ' + geo.width + ' ' + geo.height,
      style: 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;'
    });
    Object.keys(nodes).forEach(function (aid) {
      const a = nodes[aid] || {};
      const from = a.id || aid;
      (a.next || []).forEach(function (tid) {
        const b = nodes[tid];
        if (!b) return;
        const pa = geo.pos(a);
        const pb = geo.pos(b);
        const bid = b.id || tid;
        const lit = !!(a.visited && b.visited) || (!!a.visited && !!avail[bid]) || (from === run.nodeId && !!avail[bid]);
        const attrs = {
          class: 'ds-map-edge' + (lit ? ' ds-edge-lit' : ''),
          x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
          stroke: lit ? '#d9a441' : '#4b3d5c',
          'stroke-width': lit ? 4 : 3
        };
        if (!lit) attrs['stroke-dasharray'] = '6 6';
        svg.appendChild(svgEl('line', attrs));
      });
    });
    wrap.appendChild(svg);

    Object.keys(nodes).forEach(function (nid) {
      const n = nodes[nid] || {};
      if (!n.id) n.id = nid;
      const type = n.type || 'fight';
      const p = geo.pos(n);
      const isAvail = !!(opts.interactive && avail[n.id] && !n.visited);
      const isCur = n.id === run.nodeId;
      const cls = ['ds-map-node', 'ds-node-' + type];
      if (n.visited) cls.push('ds-map-node-visited');
      if (isAvail) cls.push('ds-map-node-available');
      if (isCur) cls.push('ds-map-node-current');
      const attrs = {
        class: cls.join(' '),
        text: NODE_ICON[type] || '❔',
        style: 'position:absolute;left:' + (p.x - MAP.size / 2) + 'px;top:' + (p.y - MAP.size / 2) +
          'px;width:' + MAP.size + 'px;height:' + MAP.size + 'px;',
        dataset: { node: n.id }
      };
      if (isAvail && opts.onPick) attrs.onclick = function () { opts.onPick(n); };
      const node = el('div', attrs);
      let h = '<b>' + esc(NODE_LABEL[type] || type) + '</b>';
      if (n.visited) h += ' · visited';
      else if (isAvail) h += ' · click to travel';
      tip(node, h);
      wrap.appendChild(node);
    });
    return wrap;
  }

  function legendEl() {
    return el('div', { class: 'ds-scr-legend' }, NODE_ORDER.map(function (t) {
      return txt('span', 'ds-scr-leg', NODE_ICON[t] + ' ' + NODE_LABEL[t]);
    }));
  }

  /* ================================================================
   * event bus and screen wrapper
   * ================================================================ */
  // Keep the top bar in sync whenever the screen changes (kit's go does not know about it).
  // kit's go awaits the old screen's exit() before it sets DS.ui.current, so the refresh must wait
  // for the returned promise; refreshing synchronously would still see the previous screen.
  if (typeof DS.ui.go === 'function' && !DS.ui.go.__dsTopbar) {
    const origGo = DS.ui.go;
    const wrappedGo = function () {
      const r = origGo.apply(this, arguments);
      return Promise.resolve(r).then(
        function (v) { tryCall('topbar', function () { refreshTopBarNow(); }); return v; },
        function (e) { tryCall('topbar', function () { refreshTopBarNow(); }); throw e; }
      );
    };
    wrappedGo.__dsTopbar = true;
    DS.ui.go = wrappedGo;
  }

  if (DS.events && typeof DS.events.on === 'function') {
    DS.events.on('run:update', scheduleTopBar);
    DS.events.on('combat:update', scheduleTopBar);
  }

  /* ================================================================
   * menu
   * ================================================================ */
  DS.ui.registerScreen('menu', {
    enter: function (params, root) {
      const hasSave = tryCall('hasSave', function () { return DS.Run.hasSave(); }, false) === true;
      let muteBtn = null;
      if (DS.audio && typeof DS.audio.setMuted === 'function') {
        muteBtn = el('button', {
          class: 'ds-btn',
          text: muteLabel(),
          onclick: function () {
            tryCall('mute', function () { DS.audio.setMuted(!DS.audio.muted); });
            muteBtn.textContent = muteLabel();
          }
        });
      }
      const continueRun = function () {
        const ok = tryCall('Run.load', function () { return DS.Run.load(); }, false);
        if (!ok) { toast('Could not load the saved run.'); return; }
        go('map');
      };
      root.appendChild(el('div', { class: 'ds-scr-menu' }, [
        txt('div', 'ds-scr-menu-title', 'DUSKSPIRE'),
        txt('div', 'ds-subtitle', 'Forge a deck. Climb the spire.'),
        el('div', { class: 'ds-scr-menu-btns' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'New Run', onclick: function () { go('charselect'); } }),
          hasSave ? el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: continueRun }) : null,
          el('button', { class: 'ds-btn', text: 'Compendium', onclick: function () { go('compendium'); } }),
          muteBtn
        ])
      ]));
    },
    exit: function () {}
  });

  /* ================================================================
   * character select
   * ================================================================ */
  function startRun(id) {
    const ok = tryCall('Run.start', function () { DS.Run.start(id); return true; }, false);
    if (!ok) { toast('Could not start a run.'); return; }
    go('map');
  }

  function charCard(c) {
    const starter = defOf.relic(c.starterRelic);
    const col = c.color || '#8a6d3b';
    const starterHtml = starter
      ? '<div class="ds-scr-rarity">Starter relic</div><div><b>' + (esc(starter.icon || '')) + ' ' + esc(starter.name || c.starterRelic) + '</b></div>' +
        '<div>' + dsc(starter.desc || '') + '</div>'
      : '<div class="ds-scr-rarity">Starter relic</div><div><b>' + esc(c.starterRelic || 'None') + '</b></div>';
    return el('div', {
      class: 'ds-panel ds-scr-char',
      style: 'border-color:' + col + ';',
      onclick: function () { startRun(c.id); }
    }, [
      txt('div', 'ds-scr-bigicon', c.icon || '👤'),
      el('div', { class: 'ds-scr-pick-name', style: 'color:' + col + ';', text: c.name || c.id }),
      txt('div', 'ds-scr-rarity', c.title || ''),
      el('div', { class: 'ds-scr-pick-desc', text: c.desc || '' }),
      txt('div', 'ds-scr-goldline', '❤️ ' + (Number(c.hp) || 0) + ' HP   🪙 ' + (Number(c.gold) || 0) + ' gold'),
      el('div', { class: 'ds-scr-starter', html: starterHtml })
    ]);
  }

  DS.ui.registerScreen('charselect', {
    enter: function (params, root) {
      const chars = Object.keys(DS.characters || {}).map(function (k) { return DS.characters[k]; }).filter(Boolean);
      root.appendChild(el('div', { class: 'ds-scr-page' }, [
        pageHead('Choose your champion', 'Each champion brings a unique deck and a starter relic.',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go('menu'); } })),
        el('div', { class: 'ds-scr-row' }, chars.length
          ? chars.map(charCard)
          : [txt('div', 'ds-scr-muted', 'No champions are available.')])
      ]));
    },
    exit: function () {}
  });

  /* ================================================================
   * map screen and room routing
   * ================================================================ */
  function routeRoom(room) {
    if (!room || !room.type) {
      toast('Nothing lies down that path.');
      go('map');
      return;
    }
    switch (room.type) {
      case 'combat':
        go('combat', { encounterId: room.encounterId, tier: room.tier || 'normal' });
        break;
      case 'event':
        go('event', { eventId: room.eventId });
        break;
      case 'shop':
        go('shop', { shop: room.shop });
        break;
      case 'rest':
        go('rest', {});
        break;
      case 'treasure':
        go('treasure', { relicId: room.relicId || null, gold: Number(room.gold) || 0 });
        break;
      default:
        toast('That path is unexplored.');
        go('map');
    }
  }

  DS.ui.registerScreen('map', {
    enter: function (params, root) {
      const run = DS.run;
      if (!run || !run.map) { later(function () { go('menu'); }); return; }
      if (run.over) { later(function () { go(run.won ? 'victory' : 'gameover'); }); return; }
      tryCall('Run.save', function () { DS.Run.save(); });

      let busy = false;
      const pick = async function (node) {
        if (busy) return;
        busy = true;
        const room = await tryAwait('enterNode', function () { return DS.Run.enterNode(node.id); }, null);
        if (!room) {
          busy = false;
          toast('You cannot travel there.');
          return;
        }
        routeRoom(room);
      };

      const scroll = el('div', { class: 'ds-scr-map-wrap' }, [buildMapView(run.map, { interactive: true, onPick: pick })]);
      root.appendChild(el('div', { class: 'ds-scr-page' }, [
        pageHead('Act ' + (run.act || 1), 'Floor ' + (run.floor || 0) + ' · Choose your path', legendEl()),
        scroll
      ]));
      later(function () { focusMap(scroll, run.map, run.nodeId); });
    },
    exit: function () {}
  });

  /* ================================================================
   * rewards
   * ================================================================ */
  // One reward line. onClick runs when the line is claimed; done rows are greyed out.
  function rowNode(icon, label, sub, done, onClick, actionText) {
    return el('div', {
      class: 'ds-reward-item' + (done ? ' ds-reward-done' : ''),
      onclick: done ? null : onClick
    }, [
      txt('div', 'ds-reward-icon', icon),
      el('div', { class: 'ds-reward-text' }, [
        txt('div', 'ds-reward-label', label),
        txt('div', 'ds-reward-sub', sub)
      ]),
      txt('div', 'ds-reward-action', done ? 'Done' : (actionText || 'Claim'))
    ]);
  }

  // Shows the card choices in the shared picker. Resolves to the chosen choice object, or null when skipped.
  function pickRewardCard(choices) {
    const cards = choices.map(function (c, i) { return { data: cardData(c), ref: i }; });
    return tryAwait('cardPicker', async function () {
      const refs = await DS.ui.cardPicker({
        cards: cards, count: 1, prompt: 'Choose a card to add to your deck', optional: true
      });
      if (Array.isArray(refs) && refs.length && choices[refs[0]]) return choices[refs[0]];
      return null;
    }, null);
  }

  DS.ui.registerScreen('reward', {
    enter: function (params, root) {
      params = params || {};
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const tier = params.tier || 'normal';
      const rw = tryCall('generateRewards', function () { return DS.Run.generateRewards(tier); }, null) || {};
      const choices = Array.isArray(rw.cardChoices) ? rw.cardChoices.filter(Boolean) : [];
      const items = [];
      if ((Number(rw.gold) || 0) > 0) items.push({ kind: 'gold', amount: Number(rw.gold), done: false });
      if (rw.potion) items.push({ kind: 'potion', id: rw.potion, done: false });
      if (rw.relic) items.push({ kind: 'relic', id: rw.relic, done: false });
      if (choices.length) items.push({ kind: 'card', done: false, busy: false, result: '' });

      const goldLine = txt('div', 'ds-scr-goldline', '');
      const listBox = el('div', { class: 'ds-reward-list' });

      function renderList() {
        goldLine.textContent = '❤️ ' + (Number(run.hp) || 0) + ' / ' + (Number(run.maxHp) || 0) +
          '     🪙 ' + (Number(run.gold) || 0);
        clear(listBox);
        if (!items.length) {
          listBox.appendChild(txt('div', 'ds-scr-muted', 'No rewards this time.'));
          return;
        }
        items.forEach(function (it) { listBox.appendChild(rewardRow(it)); });
      }

      function rewardRow(it) {
        if (it.kind === 'gold') {
          return rowNode('🪙', 'Gold', it.done ? 'Collected' : '+' + it.amount + ' gold', it.done, function () {
            tryCall('addGold', function () { DS.Run.addGold(it.amount); });
            it.done = true;
            renderList();
          }, 'Claim');
        }
        if (it.kind === 'potion') {
          const pd = defOf.potion(it.id) || {};
          const prow = rowNode(pd.icon || '🧪', pd.name || it.id,
            it.done ? 'Added to your belt' : (pd.desc || 'A potion'), it.done, function () {
              const ok = tryCall('addPotion', function () { return DS.Run.addPotion(it.id); }, false);
              if (ok === false) {
                toast('No free potion slot. Discard a potion from the top bar first.');
                return;
              }
              it.done = true;
              renderList();
            }, 'Claim');
          return tip(prow, potionTip(it.id));
        }
        if (it.kind === 'relic') {
          const rd = defOf.relic(it.id) || {};
          const rrow = rowNode(rd.icon || '🔮', rd.name || it.id,
            it.done ? 'Relic gained' : (rd.desc || 'A relic'), it.done, function () {
              tryCall('addRelic', function () { DS.Run.addRelic(it.id); });
              it.done = true;
              renderList();
            }, 'Claim');
          return tip(rrow, relicTip(it.id));
        }
        // card reward: pick one of three, or skip
        return rowNode('🃏', 'Card reward',
          it.done ? it.result : 'Pick 1 of 3 cards to add to your deck, or skip', it.done,
          async function () {
            if (it.busy) return;
            it.busy = true;
            const picked = await pickRewardCard(choices);
            it.busy = false;
            if (picked) {
              tryCall('addCard', function () { DS.Run.addCard(picked.id, !!picked.upgraded); });
              it.result = 'Added: ' + cardData(picked).name;
            } else {
              it.result = 'Skipped';
            }
            it.done = true;
            renderList();
          }, 'Choose');
      }

      const title = tier === 'boss' ? 'Boss Defeated!' : tier === 'elite' ? 'Elite Defeated' : 'Battle Won';
      const sub = params.fromEvent ? 'Spoils of an unexpected battle' : 'Claim what you have earned';
      root.appendChild(el('div', { class: 'ds-scr-page' }, [
        pageHead(title, sub, goldLine),
        listBox,
        el('div', { class: 'ds-scr-footer' }, [
          el('button', {
            class: 'ds-btn ds-btn-primary',
            text: 'Continue',
            onclick: function () { go(tier === 'boss' ? 'bossrelic' : 'map'); }
          })
        ])
      ]));
      renderList();
    },
    exit: function () {}
  });

  /* ================================================================
   * boss relic
   * ================================================================ */
  DS.ui.registerScreen('bossrelic', {
    enter: function (params, root) {
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const choices = (tryCall('bossRelicChoices', function () { return DS.Run.bossRelicChoices(); }, []) || []).filter(Boolean);
      let busy = false;

      // Ends the act: next act's map, or the victory screen after the final boss.
      async function advance() {
        if (busy) return;
        busy = true;
        const more = await tryAwait('nextAct', function () { return DS.Run.nextAct(); }, null);
        if (more === null) { busy = false; go('map'); return; }
        if (more) { go('map'); return; }
        tryCall('Run.end', function () { DS.Run.end(true); });
        go('victory');
      }

      const row = el('div', { class: 'ds-scr-row' }, choices.map(function (id) {
        const d = defOf.relic(id) || {};
        return el('div', {
          class: 'ds-panel ds-scr-relic-pick',
          onclick: function () {
            if (busy) return;
            tryCall('addRelic', function () { DS.Run.addRelic(id); });
            toast('Gained ' + (d.name || id) + '.');
            advance();
          }
        }, [
          txt('div', 'ds-scr-bigicon', d.icon || '🔮'),
          txt('div', 'ds-scr-pick-name', d.name || id),
          txt('div', 'ds-scr-rarity', cap(d.rarity || 'boss')),
          el('div', { class: 'ds-scr-pick-desc', html: dsc(d.desc || '') }),
          d.flavor ? txt('div', 'ds-scr-flavor', d.flavor) : null
        ]);
      }));
      if (!choices.length) row.appendChild(txt('div', 'ds-scr-muted', 'The spire offers nothing more.'));

      root.appendChild(el('div', { class: 'ds-scr-page' }, [
        pageHead('Boss Relic', 'Choose one relic to carry into what lies ahead.'),
        row,
        el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn', text: 'Skip', onclick: function () { advance(); } })
        ])
      ]));
    },
    exit: function () {}
  });


  /* ================================================================
   * shop
   * ================================================================ */
  DS.ui.registerScreen('shop', {
    enter: function (params, root) {
      params = params || {};
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const shop = params.shop;
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);
      if (!shop || typeof shop !== 'object') {
        page.appendChild(txt('div', 'ds-event-text', 'The shopkeeper is nowhere to be found.'));
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Leave', onclick: function () { go('map'); } })
        ]));
        return;
      }
      shop.cards = Array.isArray(shop.cards) ? shop.cards : [];
      shop.relics = Array.isArray(shop.relics) ? shop.relics : [];
      shop.potions = Array.isArray(shop.potions) ? shop.potions : [];
      let busy = false;

      function listFor(kind) {
        return kind === 'card' ? shop.cards : kind === 'relic' ? shop.relics : shop.potions;
      }

      async function buy(kind, idx) {
        if (busy) return;
        const it = listFor(kind)[idx];
        if (!it || it.sold) return;
        const price = Number(it.price) || 0;
        if (curGold() < price) { toast('Not enough gold.'); return; }
        if (kind === 'potion' && !hasFreePotionSlot()) { toast('Your potion slots are full.'); return; }
        busy = true;
        const ok = await tryAwait('Run.buy', function () { return DS.Run.buy(kind, idx); }, false);
        busy = false;
        if (ok) {
          it.sold = true;
          toast('Purchased.');
        } else {
          toast('That purchase did not go through.');
        }
        render();
      }

      async function removeCard() {
        if (busy || shop.removeUsed) return;
        const price = Number(shop.removePrice) || 0;
        if (curGold() < price) { toast('Not enough gold.'); return; }
        const deck = Array.isArray(run.deck) ? run.deck : [];
        if (!deck.length) { toast('Your deck is empty.'); return; }
        busy = true;
        let refs = [];
        try {
          refs = await DS.ui.cardPicker({
            cards: sortDeck(deck).map(function (inst) { return { data: cardData(inst), ref: inst.uid }; }),
            count: 1,
            prompt: 'Choose a card to remove from your deck',
            optional: true
          });
        } catch (e) {
          console.error('[duskspire/screens] cardPicker:', e);
          refs = [];
        }
        if (!Array.isArray(refs) || !refs.length) { busy = false; return; }
        const ok = await tryAwait('Run.shopRemove', function () { return DS.Run.shopRemove(refs[0]); }, false);
        busy = false;
        if (ok) {
          shop.removeUsed = true;
          toast('Card removed from your deck.');
        } else {
          toast('Could not remove that card.');
        }
        render();
      }

      function render() {
        clear(page);
        const gold = curGold();

        const cardsGrid = el('div', { class: 'ds-shop-grid' }, shop.cards.length
          ? shop.cards.map(function (it, i) {
            const sold = !!it.sold;
            const price = Number(it.price) || 0;
            const can = gold >= price;
            const wrap = el('div', {
              class: 'ds-shop-item' + (sold ? ' ds-sold' : '') + (!sold && !can ? ' ds-scr-dim' : ''),
              style: 'position:relative;'
            }, [
              renderCardSafe(it.inst || {}, { onclick: sold ? null : function () { buy('card', i); } }),
              priceTag(price, can)
            ]);
            if (sold) wrap.appendChild(txt('div', 'ds-scr-sold', 'SOLD'));
            return wrap;
          })
          : [txt('div', 'ds-scr-muted', 'Sold out.')]);

        const relicRow = el('div', { class: 'ds-scr-row' }, shop.relics.length
          ? shop.relics.map(function (it, i) {
            const d = defOf.relic(it.id) || {};
            const price = Number(it.price) || 0;
            return thingItem({
              icon: d.icon || '🔮', name: d.name || it.id, sub: cap(d.rarity || 'shop'), desc: d.desc || '',
              price: price, can: gold >= price, sold: !!it.sold,
              onbuy: function () { buy('relic', i); }
            });
          })
          : [txt('div', 'ds-scr-muted', 'No relics for sale.')]);

        const potRow = el('div', { class: 'ds-scr-row' }, shop.potions.length
          ? shop.potions.map(function (it, i) {
            const d = defOf.potion(it.id) || {};
            const price = Number(it.price) || 0;
            return thingItem({
              icon: d.icon || '🧪', name: d.name || it.id, sub: cap(d.rarity || 'potion'), desc: d.desc || '',
              price: price, can: gold >= price, sold: !!it.sold,
              onbuy: function () { buy('potion', i); }
            });
          })
          : [txt('div', 'ds-scr-muted', 'No potions for sale.')]);

        const removePrice = Number(shop.removePrice) || 0;
        const service = el('div', { class: 'ds-scr-row' }, [
          thingItem({
            icon: '🗑️', name: 'Remove a card', sub: 'Service',
            desc: 'Permanently remove one card from your deck. Once per visit.',
            price: removePrice, can: gold >= removePrice, sold: !!shop.removeUsed, soldText: 'USED',
            onbuy: function () { removeCard(); }
          })
        ]);

        page.appendChild(pageHead('Shop', 'Coin for steel, steel for survival',
          txt('div', 'ds-scr-goldline', '🪙 ' + gold + ' gold')));
        page.appendChild(txt('div', 'ds-scr-section', 'Cards'));
        page.appendChild(cardsGrid);
        page.appendChild(txt('div', 'ds-scr-section', 'Relics'));
        page.appendChild(relicRow);
        page.appendChild(txt('div', 'ds-scr-section', 'Potions'));
        page.appendChild(potRow);
        page.appendChild(txt('div', 'ds-scr-section', 'Services'));
        page.appendChild(service);
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Leave the shop', onclick: function () { go('map'); } })
        ]));
      }

      render();
    },
    exit: function () {}
  });

  /* ================================================================
   * rest site
   * ================================================================ */
  DS.ui.registerScreen('rest', {
    enter: function (params, root) {
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      let done = false;
      let busy = false;
      let outcome = '';
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);

      function doRest() {
        if (done || busy) return;
        const healed = Number(tryCall('Run.rest', function () { return DS.Run.rest(); }, 0)) || 0;
        done = true;
        outcome = healed > 0
          ? 'You rest by the embers and recover ' + healed + ' HP.'
          : 'You rest by the embers, but there is nothing to recover.';
        render();
      }

      function showSmithPreview(inst) {
        const before = cardData(inst);
        const after = cardData({ id: inst.id, upgraded: true });
        const content = el('div', { class: 'ds-scr-ba' }, [
          el('div', { class: 'ds-scr-ba-col' }, [txt('div', 'ds-scr-rarity', 'Before'), renderCardSafe(inst, {})]),
          txt('div', 'ds-scr-arrow', '➜'),
          el('div', { class: 'ds-scr-ba-col' }, [txt('div', 'ds-scr-rarity', 'After'), renderCardSafe({ id: inst.id, upgraded: true }, {})])
        ]);
        let m = null;
        m = DS.ui.modal({
          title: 'Upgrade ' + before.name,
          content: content,
          dismissable: true,
          buttons: [
            { label: 'Upgrade', primary: true, onclick: function () { if (m) m.close(); doUpgrade(inst.uid, after.name); } },
            { label: 'Cancel', onclick: function () { if (m) m.close(); } }
          ]
        });
      }

      async function doUpgrade(uid, newName) {
        if (done || busy) return;
        busy = true;
        const ok = await tryAwait('Run.upgradeCard', function () { return DS.Run.upgradeCard(uid); }, false);
        busy = false;
        if (!ok) { toast('That card cannot be upgraded.'); return; }
        done = true;
        outcome = newName + ' has been sharpened.';
        render();
      }

      async function doSmith() {
        if (done || busy) return;
        const eligible = (Array.isArray(run.deck) ? run.deck : []).filter(isUpgradable);
        if (!eligible.length) return;
        busy = true;
        let refs = [];
        try {
          refs = await DS.ui.cardPicker({
            cards: eligible.map(function (inst) { return { data: cardData(inst), ref: inst.uid }; }),
            count: 1,
            prompt: 'Choose a card to upgrade',
            optional: true
          });
        } catch (e) {
          console.error('[duskspire/screens] cardPicker:', e);
          refs = [];
        }
        busy = false;
        const uid = Array.isArray(refs) && refs.length ? refs[0] : null;
        const inst = uid === null ? null : eligible.find(function (c) { return c.uid === uid; });
        if (inst) showSmithPreview(inst);
      }

      function render() {
        clear(page);
        const maxHp = Number(run.maxHp) || 0;
        const hp = Number(run.hp) || 0;
        const heal = Math.min(Math.max(0, maxHp - hp), Math.floor(maxHp * 0.3));
        const eligibleCount = (Array.isArray(run.deck) ? run.deck : []).filter(isUpgradable).length;
        const smithBlocked = done || eligibleCount === 0;
        page.appendChild(pageHead('Rest Site', 'A quiet fire. Rest, or sharpen one card. Then move on.',
          txt('div', 'ds-scr-goldline', '❤️ ' + hp + ' / ' + maxHp)));
        page.appendChild(el('div', { class: 'ds-scr-row' }, [
          el('div', {
            class: 'ds-panel ds-scr-choice' + (done ? ' ds-choice-disabled' : ''),
            onclick: done ? null : doRest
          }, [
            txt('div', 'ds-scr-bigicon', '🏕️'),
            txt('div', 'ds-scr-pick-name', 'Rest'),
            txt('div', 'ds-scr-pick-desc', 'Heal 30% of your max HP.'),
            txt('div', 'ds-scr-rarity', '+' + heal + ' HP')
          ]),
          el('div', {
            class: 'ds-panel ds-scr-choice' + (smithBlocked ? ' ds-choice-disabled' : ''),
            onclick: smithBlocked ? null : doSmith
          }, [
            txt('div', 'ds-scr-bigicon', '⚒️'),
            txt('div', 'ds-scr-pick-name', 'Smith'),
            txt('div', 'ds-scr-pick-desc', eligibleCount
              ? 'Upgrade a card. You see the before and after first.'
              : 'Nothing in your deck can be upgraded.'),
            txt('div', 'ds-scr-rarity', eligibleCount + ' upgradable')
          ])
        ]));
        if (done) {
          page.appendChild(txt('div', 'ds-event-text', outcome));
          page.appendChild(el('div', { class: 'ds-scr-footer' }, [
            el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { go('map'); } })
          ]));
        } else {
          page.appendChild(el('div', { class: 'ds-scr-footer' }, [
            el('button', { class: 'ds-btn', text: 'Leave without resting', onclick: function () { go('map'); } })
          ]));
        }
      }

      render();
    },
    exit: function () {}
  });

  /* ================================================================
   * events
   * ================================================================ */
  DS.ui.registerScreen('event', {
    enter: function (params, root) {
      params = params || {};
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);
      const info = tryCall('Run.getEvent', function () { return DS.Run.getEvent(params.eventId); }, null);
      const def = info && info.def;
      if (!def) {
        page.appendChild(txt('div', 'ds-event-text', 'Nothing of note happens here.'));
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { go('map'); } })
        ]));
        return;
      }

      let busy = false;
      const choiceBox = el('div', { class: 'ds-scr-choices' });
      const resultBox = el('div', { class: 'ds-scr-result' });

      async function choose(idx) {
        if (busy) return;
        busy = true;
        const res = await tryAwait('Run.chooseEvent', function () { return DS.Run.chooseEvent(params.eventId, idx); }, null);
        if (!res || res.ok === false) {
          busy = false;
          toast('That choice did not work out.');
          return;
        }
        clear(choiceBox);
        const fight = res.fightEncounterId || null;
        const dead = res.dead === true;
        resultBox.appendChild(txt('div', 'ds-event-text', res.text || ''));
        resultBox.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', {
            class: 'ds-btn ds-btn-primary',
            text: dead ? 'Continue' : fight ? 'Fight' : 'Continue',
            onclick: function () {
              if (dead) {
                tryCall('Run.end', function () { DS.Run.end(false); });
                go('gameover');
              } else if (fight) {
                go('combat', { encounterId: fight, tier: 'normal', fromEvent: true });
              } else {
                go('map');
              }
            }
          })
        ]));
      }

      const choices = Array.isArray(info.choices) ? info.choices : [];
      choices.forEach(function (c, i) {
        const idx = c && c.index !== undefined ? c.index : i;
        const enabled = !!c && c.enabled !== false;
        choiceBox.appendChild(el('div', {
          class: 'ds-choice' + (enabled ? '' : ' ds-choice-disabled'),
          onclick: enabled ? function () { choose(idx); } : null
        }, labelNodes(c && c.label)));
      });
      if (!choices.length) {
        choiceBox.appendChild(el('button', {
          class: 'ds-btn ds-btn-primary',
          text: 'Continue',
          onclick: function () { go('map'); }
        }));
      }

      page.appendChild(el('div', { class: 'ds-scr-event-head' }, [
        txt('div', 'ds-scr-event-icon', def.icon || '❔'),
        txt('div', 'ds-title', def.name || 'Event')
      ]));
      page.appendChild(txt('div', 'ds-event-text', def.text || ''));
      page.appendChild(choiceBox);
      page.appendChild(resultBox);
    },
    exit: function () {}
  });

  /* ================================================================
   * treasure chest
   * ================================================================ */
  DS.ui.registerScreen('treasure', {
    enter: function (params, root) {
      params = params || {};
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const relicId = params.relicId || null;
      const gold = Number(params.gold) || 0;
      let opened = false;

      const hint = txt('div', 'ds-scr-muted', 'Tap the chest to open it.');
      const reveal = el('div', { class: 'ds-scr-reveal' });
      const chest = el('div', { class: 'ds-scr-chest', text: '🧰', onclick: openChest });
      const cont = el('div', { class: 'ds-scr-footer', style: 'display:none;' }, [
        el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { go('map'); } })
      ]);

      function renderReveal() {
        clear(reveal);
        if (gold > 0) reveal.appendChild(txt('div', 'ds-scr-goldline', '+' + gold + ' gold'));
        if (relicId) {
          const d = defOf.relic(relicId) || {};
          reveal.appendChild(el('div', { class: 'ds-panel ds-scr-relic-pick' }, [
            txt('div', 'ds-scr-bigicon', d.icon || '🔮'),
            txt('div', 'ds-scr-pick-name', d.name || relicId),
            txt('div', 'ds-scr-rarity', cap(d.rarity || 'treasure')),
            el('div', { class: 'ds-scr-pick-desc', html: dsc(d.desc || '') })
          ]));
        }
        if (!gold && !relicId) reveal.appendChild(txt('div', 'ds-scr-muted', 'The chest is empty.'));
      }

      function openChest() {
        if (opened) return;
        opened = true;
        hint.style.display = 'none';
        chest.classList.add('ds-scr-shake');
        setTimeout(function () {
          chest.classList.add('ds-scr-gone');
          if (gold > 0) tryCall('addGold', function () { DS.Run.addGold(gold); });
          if (relicId) tryCall('addRelic', function () { DS.Run.addRelic(relicId); });
          // onChestOpen already fired in DS.Run.enterNode when the treasure room was entered; do not fire twice.
          renderReveal();
          cont.style.display = '';
        }, 650);
      }

      root.appendChild(el('div', { class: 'ds-scr-page ds-scr-center' }, [
        pageHead('Treasure', 'A chest rests quietly in the dust.'),
        chest,
        hint,
        reveal,
        cont
      ]));
    },
    exit: function () {}
  });

  /* ================================================================
   * run summary: gameover and victory
   * ================================================================ */
  function summaryPage(o) {
    const run = DS.run;
    const st = (run && run.stats) || {};
    const ch = run ? defOf.character(run.character) : null;
    const deck = run && Array.isArray(run.deck) ? run.deck : [];
    const relics = run && Array.isArray(run.relics) ? run.relics : [];
    const stats = [
      ['Character', ch ? ch.name : ((run && run.character) || '—')],
      ['Act reached', (run && run.act) || '—'],
      ['Floor reached', (run && run.floor) || 0],
      ['Deck size', deck.length],
      ['Relics', relics.length],
      ['Max HP', (run && run.maxHp) || 0],
      ['Fights won', Number(st.fights) || 0],
      ['Elites slain', Number(st.elites) || 0],
      ['Bosses slain', Number(st.bosses) || 0],
      ['Turns taken', Number(st.turns) || 0],
      ['Cards played', Number(st.cardsPlayed) || 0],
      ['Damage dealt', Number(st.damageDealt) || 0],
      ['Gold earned', Number(st.goldEarned) || 0]
    ];
    const statGrid = el('div', { class: 'ds-scr-stats' }, stats.map(function (s) {
      return el('div', { class: 'ds-scr-stat' }, [
        txt('div', 'ds-scr-stat-v', s[1]),
        txt('div', 'ds-scr-stat-k', s[0])
      ]);
    }));
    const relicRow = relics.length
      ? el('div', { class: 'ds-scr-tb-group' }, relics.map(function (r) { return relicEl(r); }))
      : txt('div', 'ds-scr-muted', 'No relics.');
    const deckRow = deck.length
      ? el('div', { class: 'ds-scr-tb-group' }, sortDeck(deck).map(function (inst) {
        const d = cardData(inst);
        return tip(txt('span', 'ds-scr-mini', d.icon || '🃏'), '<b>' + esc(d.name) + '</b><div>' + dsc(d.desc || '') + '</div>');
      }))
      : txt('div', 'ds-scr-muted', 'Your deck is empty.');
    return el('div', { class: 'ds-scr-page ds-scr-center' }, [
      txt('div', 'ds-title ' + (o.won ? 'ds-scr-title-gold' : 'ds-scr-title-red'), o.title),
      txt('div', 'ds-subtitle', o.sub),
      el('div', { class: 'ds-panel ds-scr-sumpanel' }, [
        statGrid,
        txt('div', 'ds-scr-section', 'Relics'),
        relicRow,
        txt('div', 'ds-scr-section', 'Deck'),
        deckRow
      ]),
      el('div', { class: 'ds-scr-footer' }, [
        el('button', { class: 'ds-btn ds-btn-primary', text: 'Back to Menu', onclick: function () { go('menu'); } })
      ])
    ]);
  }

  DS.ui.registerScreen('gameover', {
    enter: function (params, root) {
      root.appendChild(summaryPage({
        title: 'Defeat',
        sub: 'The Duskspire claims another wanderer. Your deck scatters in the ash.',
        won: false
      }));
    },
    exit: function () {}
  });

  DS.ui.registerScreen('victory', {
    enter: function (params, root) {
      root.appendChild(summaryPage({
        title: 'Victory',
        sub: 'The Duskspire falls silent. Your name is carved into its ash.',
        won: true
      }));
    },
    exit: function () {}
  });

  /* ================================================================
   * compendium
   * ================================================================ */
  function keysOf(obj) {
    return Object.keys(obj || {}).map(function (k) { return obj[k]; }).filter(Boolean);
  }

  function hpMin(d) {
    return Array.isArray(d.hp) ? (Number(d.hp[0]) || 0) : (Number(d.hp) || 0);
  }

  // One card in the grid. Shows the base card; the upgrade appears on hover or when the toggle is on.
  function cardCell(def, showUp) {
    const hasUp = !!def.upgrade;
    const normal = renderCardSafe({ id: def.id, upgraded: false }, { small: true });
    const cell = el('div', { class: 'ds-scr-cell' }, [normal]);
    let up = null;
    if (hasUp) {
      up = renderCardSafe({ id: def.id, upgraded: true }, { small: true });
      cell.appendChild(up);
    }
    const setMode = function (upMode) {
      normal.style.display = upMode ? 'none' : '';
      if (up) up.style.display = upMode ? '' : 'none';
    };
    setMode(showUp && hasUp);
    if (hasUp && !showUp) {
      cell.onmouseenter = function () { setMode(true); };
      cell.onmouseleave = function () { setMode(false); };
    }
    let capText = cap(def.class || '') + ' · ' + cap(def.rarity || '');
    if (hasUp) capText += showUp ? ' · upgraded' : ' · hover for upgrade';
    cell.appendChild(txt('div', 'ds-scr-cap', capText));
    return cell;
  }

  function cardsTab(st, rerender) {
    const defs = keysOf(DS.cards)
      .filter(function (d) { return st.cls === 'all' || d.class === st.cls; })
      .sort(defSort);
    const chips = el('div', { class: 'ds-scr-tabs' }, CARD_FILTERS.map(function (c) {
      return el('button', {
        class: 'ds-scr-chip' + (st.cls === c ? ' ds-scr-on' : ''),
        text: cap(c),
        onclick: function () { st.cls = c; rerender(); }
      });
    }));
    const toggle = el('button', {
      class: 'ds-btn' + (st.showUp ? ' ds-btn-primary' : ''),
      text: st.showUp ? 'Showing upgraded' : 'Show upgraded',
      onclick: function () { st.showUp = !st.showUp; rerender(); }
    });
    return el('div', { class: 'ds-scr-page', style: 'max-width:none;' }, [
      el('div', { class: 'ds-scr-toolbar' }, [chips, toggle]),
      txt('div', 'ds-scr-muted', defs.length + ' cards shown'),
      el('div', { class: 'ds-grid' }, defs.map(function (d) { return cardCell(d, st.showUp); }))
    ]);
  }

  function relicsTab() {
    const list = keysOf(DS.relics).sort(rarityThenName);
    return el('div', { class: 'ds-scr-list' }, list.map(function (d) {
      const meta = [cap(d.rarity || ''), d.class ? cap(d.class) : ''].filter(Boolean).join(' · ');
      return el('div', { class: 'ds-panel ds-scr-entry' }, [
        txt('div', 'ds-scr-bigicon', d.icon || '🔮'),
        el('div', { class: 'ds-scr-entry-body' }, [
          el('div', { class: 'ds-scr-entry-name', html: '<b>' + esc(d.name || d.id) + '</b>' }),
          txt('div', 'ds-scr-rarity', meta),
          el('div', { class: 'ds-scr-pick-desc', html: dsc(d.desc || '') }),
          d.flavor ? txt('div', 'ds-scr-flavor', d.flavor) : null
        ])
      ]);
    }));
  }

  function potionsTab() {
    const list = keysOf(DS.potions).sort(rarityThenName);
    return el('div', { class: 'ds-scr-list' }, list.map(function (d) {
      const meta = [cap(d.rarity || ''), d.target ? 'Target: ' + String(d.target).replace(/_/g, ' ') : '']
        .filter(Boolean).join(' · ');
      return el('div', { class: 'ds-panel ds-scr-entry' }, [
        txt('div', 'ds-scr-bigicon', d.icon || '🧪'),
        el('div', { class: 'ds-scr-entry-body' }, [
          el('div', { class: 'ds-scr-entry-name', html: '<b>' + esc(d.name || d.id) + '</b>' }),
          txt('div', 'ds-scr-rarity', meta),
          el('div', { class: 'ds-scr-pick-desc', html: dsc(d.desc || '') })
        ])
      ]);
    }));
  }

  function enemiesTab() {
    const list = keysOf(DS.enemies).sort(function (a, b) {
      return (Number(a.act) || 0) - (Number(b.act) || 0) ||
        ord(TIER_ORDER, a.tier, 9) - ord(TIER_ORDER, b.tier, 9) ||
        hpMin(a) - hpMin(b) ||
        String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
    return el('div', { class: 'ds-scr-list' }, list.map(function (d) {
      const moves = d.moves && typeof d.moves === 'object'
        ? Object.keys(d.moves).map(function (k) { return (d.moves[k] && d.moves[k].name) || k; })
        : [];
      const hp = Array.isArray(d.hp) ? d.hp[0] + '–' + d.hp[1] + ' HP' : (d.hp !== undefined ? d.hp + ' HP' : '? HP');
      return el('div', { class: 'ds-panel ds-scr-entry' }, [
        txt('div', 'ds-scr-bigicon', d.icon || '👾'),
        el('div', { class: 'ds-scr-entry-body' }, [
          el('div', { class: 'ds-scr-entry-name', html: '<b>' + esc(d.name || d.id) + '</b>' }),
          txt('div', 'ds-scr-rarity', 'Act ' + (d.act || '?') + ' · ' + cap(d.tier || 'normal') + ' · ' + hp),
          txt('div', 'ds-scr-muted', moves.length ? 'Moves: ' + moves.join(', ') : '')
        ])
      ]);
    }));
  }

  DS.ui.registerScreen('compendium', {
    enter: function (params, root) {
      const st = { tab: 'cards', cls: 'all', showUp: false };
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);

      function render() {
        clear(page);
        const counts = {
          cards: keysOf(DS.cards).length,
          relics: keysOf(DS.relics).length,
          potions: keysOf(DS.potions).length,
          enemies: keysOf(DS.enemies).length
        };
        const tabs = [['cards', 'Cards'], ['relics', 'Relics'], ['potions', 'Potions'], ['enemies', 'Enemies']];
        page.appendChild(pageHead('Compendium', 'Everything the Duskspire has to offer',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go('menu'); } })));
        page.appendChild(el('div', { class: 'ds-scr-tabs' }, tabs.map(function (t) {
          return el('button', {
            class: 'ds-btn' + (st.tab === t[0] ? ' ds-btn-primary' : ''),
            text: t[1] + ' (' + counts[t[0]] + ')',
            onclick: function () { st.tab = t[0]; render(); }
          });
        })));
        let body;
        if (st.tab === 'cards') body = cardsTab(st, render);
        else if (st.tab === 'relics') body = relicsTab();
        else if (st.tab === 'potions') body = potionsTab();
        else body = enemiesTab();
        page.appendChild(body);
      }

      render();
    },
    exit: function () {}
  });

})();
