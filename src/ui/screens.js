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
  const HIDE_TOPBAR = {
    menu: true, charselect: true, compendium: true, gameover: true, victory: true,
    history: true, settings: true, howto: true
  };

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
    const node = el('div', { class: 'ds-relic', style: 'position:relative;' }, [itemIcon('relic', d, '🔮')]);
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
   * guarded access to settings, meta, art and persisted room state
   * (settings.js-era modules may be absent: every read falls back)
   * ================================================================ */
  function setting(key, fallback) {
    const v = tryCall('settings.get', function () {
      return DS.settings && typeof DS.settings.get === 'function' ? DS.settings.get(key, fallback) : undefined;
    }, undefined);
    return v === undefined || v === null ? fallback : v;
  }

  function setSetting(key, value) {
    tryCall('settings.set', function () {
      if (DS.settings && typeof DS.settings.set === 'function') DS.settings.set(key, value);
    });
  }

  function hasMeta() {
    return !!(DS.Meta && typeof DS.Meta.get === 'function');
  }

  function metaData() {
    if (!hasMeta()) return null;
    const m = tryCall('Meta.get', function () { return DS.Meta.get(); }, null);
    return m && typeof m === 'object' ? m : null;
  }

  // Without DS.Meta nothing is hidden: every entry counts as discovered.
  function isSeen(kind, id) {
    const m = metaData();
    if (!m) return true;
    return !!(m.seen && m.seen[kind] && m.seen[kind][id]);
  }

  function markSeen(kind, id) {
    if (!hasMeta() || !id) return;
    tryCall('Meta.markSeen', function () { DS.Meta.markSeen(kind, id); });
  }

  function maxAsc(charId) {
    if (!hasMeta() || typeof DS.Meta.maxAscension !== 'function') return 0;
    const n = tryCall('Meta.maxAscension', function () { return DS.Meta.maxAscension(charId); }, 0);
    return Math.max(0, Math.min(10, Number(n) || 0));
  }

  function ascensionLevels() {
    return Array.isArray(DS.Run && DS.Run.ASCENSIONS) ? DS.Run.ASCENSIONS : [];
  }

  function ascensionDef(level) {
    return ascensionLevels().find(function (a) { return Number(a.level) === Number(level); }) || null;
  }

  // Relic and potion art: DS.art first, then DS.ui, else the emoji. Always returns a node.
  function itemIcon(kind, def, fallbackEmoji, cls) {
    const fn = kind + 'Icon';
    let node = null;
    tryCall('icon', function () {
      if (DS.art && typeof DS.art[fn] === 'function') node = DS.art[fn](def);
      else if (DS.ui && typeof DS.ui[fn] === 'function') node = DS.ui[fn](def);
    });
    if (node && node.nodeType) {
      if (cls) node.classList.add(cls);
      return node;
    }
    return txt('span', cls || null, (def && def.icon) || fallbackEmoji);
  }

  function artBackdrop(root, name, act) {
    tryCall('backdrop', function () {
      if (DS.art && typeof DS.art.applyBackdrop === 'function') DS.art.applyBackdrop(root, name, act);
    });
  }

  // The room the player is in (run.room) and the engine calls that act on it. The engine saves each room's
  // stock and claims with the run, so the room screens keep no room state of their own.
  function roomIs(type) {
    const r = DS.run && DS.run.room;
    return r && typeof r === 'object' && r.type === type ? r : null;
  }

  // Leaves the current room for the map or another screen. The engine refuses to close fights and boss steps.
  function leaveRoom(to) {
    tryCall('Run.closeRoom', function () { if (DS.Run && typeof DS.Run.closeRoom === 'function') DS.Run.closeRoom(); });
    go(to || 'map');
  }

  // An engine call that answers true or false; an exception counts as false.
  function engineBool(label, fn) {
    return tryCall(label, fn, false) === true;
  }

  // Achievements unlocked since the current run began (shown on its summary screen).
  let runAchievements = [];
  // Highest selectable ascension for the character when the current run began, to detect a new unlock.
  let runMaxBase = null;

  function noteRunBase() {
    const ch = DS.run && DS.run.character;
    runMaxBase = { char: ch, max: maxAsc(ch) };
  }

  function achievementDef(id) {
    const list = hasMeta() && Array.isArray(DS.Meta.ACHIEVEMENTS) ? DS.Meta.ACHIEVEMENTS : [];
    return list.find(function (a) { return a.id === id; }) || null;
  }

  if (DS.events && typeof DS.events.on === 'function') {
    DS.events.on('meta:achievement', function (p) {
      if (p && p.id && runAchievements.indexOf(p.id) < 0) runAchievements.push(p.id);
    });
  }

  // Card tooltip: name, type, cost, full text and the upgrade text.
  function cardTipHtml(inst) {
    const d = cardData(inst);
    const typeName = cap(d.type || '');
    let h = '<div><b>' + esc(d.name) + '</b>' + (d.upgraded ? ' <span class="ds-scr-muted">(upgraded)</span>' : '') + '</div>';
    h += '<div class="ds-scr-muted">' + esc(typeName) + ' · ' + (d.cost === -1 ? 'Unplayable' : d.cost === 'X' ? 'Cost X' : 'Cost ' + esc(d.cost)) +
      ' · ' + esc(cap(d.rarity || '')) + '</div>';
    if (d.desc) h += '<div class="ds-tip-body">' + dsc(d.desc) + '</div>';
    const def = defOf.card(inst && inst.id);
    if (def && def.upgrade && def.upgrade.desc && !inst.upgraded) {
      h += '<div class="ds-scr-muted">Upgraded: ' + dsc(def.upgrade.desc) + '</div>';
    }
    return h;
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
      content: '<div class="ds-scr-pick-desc">The run ends here and cannot be resumed.</div>' +
        (DS.run ? '<div class="ds-scr-muted">Seed: ' + esc(DS.run.seed) + '</div>' : ''),
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
    if (run) body.appendChild(el('div', { class: 'ds-scr-muted', text: 'Seed: ' + String(run.seed) }));
    if (DS.audio && typeof DS.audio.setMuted === 'function') {
      const muteBtn = el('button', {
        class: 'ds-btn',
        text: muteLabel(),
        onclick: function () {
          tryCall('mute', function () { DS.audio.setMuted(!DS.audio.muted); });
          setSetting('muted', !!(DS.audio && DS.audio.muted));
          muteBtn.textContent = muteLabel();
        }
      });
      body.appendChild(muteBtn);
    }
    // Full settings can leave the screen safely, except mid-fight, where it would drop the combat.
    if (DS.ui.current !== 'combat') {
      body.appendChild(el('button', {
        class: 'ds-btn',
        text: 'Full settings',
        onclick: function () { if (m) m.close(); go('settings', { back: DS.ui.current || 'map' }); }
      }));
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
    if (Number(run.ascension) > 0) {
      const ad = ascensionDef(run.ascension);
      const asc = el('div', { class: 'ds-badge ds-topbar-item ds-scr-asc', text: 'Ascension ' + run.ascension });
      if (ad) tip(asc, '<b>Ascension ' + esc(run.ascension) + ': ' + esc(ad.name || '') + '</b><div>' + dsc(ad.desc || '') + '</div>');
      kids.push(asc);
    }
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
          style: d.color ? 'border-color:' + d.color + ';' : null,
          onclick: function () { onPotionClick(slot, id); }
        }, [itemIcon('potion', d, '🧪')]);
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
    const y = geo.pos({ row: row, col: 0 }).y * mapZoom();
    scroll.scrollTop = Math.max(0, y - scroll.clientHeight * 0.6);
  }

  // The map is laid out in pixels for a 16px root font; scale it with the rest of the UI on larger windows.
  function mapZoom() {
    let k = 1;
    try { k = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16; } catch (e) { k = 1; }
    return isFinite(k) && k > 0 ? Math.round(Math.min(3, Math.max(0.75, k)) * 100) / 100 : 1;
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
      style: 'width:' + geo.width + 'px;height:' + geo.height + 'px;zoom:' + mapZoom() + ';'
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
  // The screen that shows a saved room. Rooms the engine persists are shown again, not skipped.
  function roomRoute(room) {
    const r = room || {};
    switch (r.type) {
      case 'combat': return { screen: 'combat', params: { encounterId: r.encounterId, tier: r.tier || 'normal' } };
      case 'event': return { screen: 'event', params: { eventId: r.eventId } };
      case 'shop': return { screen: 'shop', params: { shop: r.shop } };
      case 'rest': return { screen: 'rest', params: {} };
      case 'treasure': return { screen: 'treasure', params: { relicId: r.relicId || null, gold: Number(r.gold) || 0 } };
      case 'reward': return { screen: 'reward', params: { tier: r.tier || 'normal', fromEvent: !!r.fromEvent } };
      case 'bossrelic': return { screen: 'bossrelic', params: {} };
      default: return { screen: 'map', params: {} };
    }
  }

  // Where Continue lands: DS.Run.resumeTarget() when the engine has it, otherwise the map.
  function resumeRoute() {
    const t = tryCall('resumeTarget', function () {
      return DS.Run && typeof DS.Run.resumeTarget === 'function' ? DS.Run.resumeTarget() : null;
    }, null);
    if (!t) return { screen: 'map', params: {} };
    if (typeof t === 'string') return { screen: t, params: {} };
    if (t.type && !t.screen && !t.name) return roomRoute(t);
    if (t.room && typeof t.room === 'object' && !t.screen) return roomRoute(t.room);
    return { screen: t.screen || t.name || 'map', params: t.params || {} };
  }

  function continueRun() {
    const ok = tryCall('Run.load', function () { return DS.Run.load(); }, false);
    if (!ok) { toast('Could not load the saved run.'); return; }
    runAchievements = [];
    noteRunBase();
    const route = resumeRoute();
    go(route.screen, route.params);
  }

  DS.ui.registerScreen('menu', {
    enter: function (params, root) {
      const hasSave = tryCall('hasSave', function () { return DS.Run.hasSave(); }, false) === true;
      const m = metaData();
      const wins = m ? Number(m.wins) || 0 : 0;
      const runs = m ? Number(m.runs) || 0 : 0;
      const canQuit = typeof navigator !== 'undefined' && /Electron/.test(String(navigator.userAgent || ''));
      const btn = function (label, fn, cls) {
        return el('button', { class: 'ds-btn ' + (cls || ''), text: label, onclick: fn });
      };
      const buttons = [];
      if (hasSave) buttons.push(btn('Continue', continueRun, 'ds-btn-primary'));
      buttons.push(btn('New Run', function () { go('charselect'); }, hasSave ? '' : 'ds-btn-primary'));
      buttons.push(btn('Compendium', function () { go('compendium'); }));
      buttons.push(btn('History', function () { go('history', { back: 'menu' }); }));
      buttons.push(btn('Settings', function () { go('settings', { back: 'menu' }); }));
      buttons.push(btn('How to Play', function () { go('howto', { back: 'menu' }); }));
      if (canQuit) buttons.push(btn('Quit', function () { tryCall('quit', function () { window.close(); }); }));
      root.appendChild(el('div', { class: 'ds-scr-menu' }, [
        txt('div', 'ds-scr-menu-title', 'DUSKSPIRE'),
        txt('div', 'ds-subtitle', 'Forge a deck. Climb the spire.'),
        el('div', { class: 'ds-scr-menu-meta' }, [
          txt('span', 'ds-badge', 'v3'),
          txt('span', 'ds-scr-muted', 'Total wins: ' + wins + (runs ? ' · Runs: ' + runs : ''))
        ]),
        el('div', { class: 'ds-scr-menu-btns' }, buttons)
      ]));
      artBackdrop(root, 'menu', 1);
    },
    exit: function () {}
  });

  /* ================================================================
   * character select
   * ================================================================ */
  // The champion and ascension picked on the last visit; the seed is never remembered.
  let lastPick = { id: null, asc: 0 };

  // Seeds are numbers. Text seeds are hashed so the same words always give the same run.
  function seedNumber(text) {
    const s = String(text === undefined || text === null ? '' : text).trim();
    if (s === '') return undefined;
    if (/^\d{1,10}$/.test(s)) return Number(s);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h || 1;
  }

  // Trials: optional run modifiers (relics flagged trial:true), toggled on the character screen.
  function trialDefs() {
    return Object.keys(DS.relics || {}).map(function (k) { return DS.relics[k]; })
      .filter(function (d) { return d && d.trial; })
      .sort(function (a, b) { return (Number(b.trialScore) || 0) - (Number(a.trialScore) || 0) || String(a.name).localeCompare(String(b.name)); });
  }

  function trialPicker(st, rerender) {
    const defs = trialDefs();
    if (!defs.length) return null;
    let total = 0;
    const chips = defs.map(function (d) {
      const on = st.trials.indexOf(d.id) >= 0;
      const pct = Number(d.trialScore) || 0;
      if (on) total += pct;
      const chip = el('button', {
        class: ['ds-trial-chip', on ? 'ds-trial-on' : '', pct < 0 ? 'ds-trial-boon' : ''].join(' '),
        onclick: function () {
          const i = st.trials.indexOf(d.id);
          if (i >= 0) st.trials.splice(i, 1); else st.trials.push(d.id);
          rerender();
        }
      }, [
        txt('span', 'ds-trial-icon', d.icon || '🎲'),
        txt('span', 'ds-trial-name', d.name || d.id),
        txt('span', 'ds-trial-pct', (pct >= 0 ? '+' : '') + pct + '%')
      ]);
      tip(chip, '<b>' + esc(d.name || d.id) + '</b><br>' + esc(d.desc || '') + '<br><i>Score ' + (pct >= 0 ? '+' : '') + pct + '%</i>');
      return chip;
    });
    const label = st.trials.length
      ? st.trials.length + ' active · score ' + (total >= 0 ? '+' : '') + total + '%'
      : 'Optional. Handicaps raise your score, boons lower it.';
    return el('div', { class: 'ds-trial-picker' }, [
      el('div', { class: 'ds-scr-section', text: 'Trials' }),
      el('div', { class: 'ds-trial-chips' }, chips),
      txt('div', 'ds-scr-muted', label)
    ]);
  }

  function startRun(id, asc, seedText, trials) {
    const seed = seedNumber(seedText);
    const opts = { ascension: Math.max(0, Math.min(maxAsc(id), Number(asc) || 0)) };
    if (seed !== undefined) opts.seed = seed;
    const ok = tryCall('Run.start', function () { DS.Run.start(id, opts); return true; }, false);
    if (!ok || !DS.run) { toast('Could not start a run.'); return; }
    (trials || []).forEach(function (tid) {
      tryCall('addTrial', function () { DS.Run.addRelic(tid); });
    });
    tryCall('save', function () { DS.Run.save(); });
    runAchievements = [];
    noteRunBase();
    go('map');
  }

  function charsList() {
    return Object.keys(DS.characters || {}).map(function (k) { return DS.characters[k]; }).filter(Boolean);
  }

  function charMeta(id) {
    const m = metaData();
    return m && m.perChar && m.perChar[id] ? m.perChar[id] : null;
  }

  // Up to three sample cards from the class pool, spread from the commonest to the rarest.
  function sampleCards(charId) {
    const pool = tryCall('cardPool', function () { return DS.cardPool({ class: charId }); }, []) || [];
    const list = pool
      .filter(function (d) { return d && d.id && d.rarity !== 'starter' && d.rarity !== 'special' && d.type !== 'curse' && d.type !== 'status'; })
      .sort(rarityThenName);
    if (list.length <= 3) return list;
    return [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
  }

  // One line on how the class plays: its own text if the content has any, otherwise its card mix.
  function playLine(c) {
    if (c.playstyle || c.howToPlay || c.play) return String(c.playstyle || c.howToPlay || c.play);
    const pool = tryCall('cardPool', function () { return DS.cardPool({ class: c.id }); }, []) || [];
    const n = { attack: 0, skill: 0, power: 0 };
    pool.forEach(function (d) {
      if (d && n[d.type] !== undefined && d.rarity !== 'starter' && d.rarity !== 'special') n[d.type]++;
    });
    const focus = n.attack >= n.skill && n.attack >= n.power ? 'attacks' : n.skill >= n.power ? 'skills' : 'powers';
    return 'Plays through ' + focus + ': ' + n.attack + ' attacks, ' + n.skill + ' skills and ' + n.power +
      ' powers in its pool. Starts with ' + (Array.isArray(c.starterDeck) ? c.starterDeck.length : '?') + ' cards.';
  }

  // Tooltip for one ascension pip: the cumulative modifiers up to that level.
  function ascTipHtml(lvl, locked) {
    if (lvl === 0) return '<b>Standard run</b><div>The base game with no extra difficulty.</div>';
    let h = '<b>Ascension ' + lvl + '</b>';
    for (let i = 1; i <= lvl; i++) {
      const ad = ascensionDef(i);
      h += '<div>' + i + '. ' + esc(ad ? ad.name : 'Level ' + i) + (ad && ad.desc ? ': ' + dsc(ad.desc) : '') + '</div>';
    }
    if (locked) h += '<div class="ds-scr-muted">Locked. Win at ascension ' + (lvl - 1) + ' to unlock.</div>';
    return h;
  }

  function ascPicker(charId, st, rerender) {
    const max = maxAsc(charId);
    const pips = [];
    for (let lvl = 0; lvl <= 10; lvl++) {
      const locked = lvl > max;
      const pip = el('button', {
        class: ['ds-asc-pip', lvl === st.asc ? 'ds-asc-pip-active' : '', locked ? 'ds-asc-pip-locked' : ''].join(' '),
        text: String(lvl),
        onclick: function () {
          if (locked) return;
          st.asc = lvl;
          rerender();
        }
      });
      tip(pip, ascTipHtml(lvl, locked));
      pips.push(pip);
    }
    const cur = st.asc === 0 ? 'Standard run' : 'Ascension ' + st.asc + ': ' + ((ascensionDef(st.asc) || {}).name || '');
    return el('div', { class: 'ds-asc-picker' }, [
      el('div', { class: 'ds-scr-section', text: 'Ascension (' + max + ' unlocked)' }),
      el('div', { class: 'ds-scr-tabs' }, pips),
      txt('div', 'ds-scr-muted', cur)
    ]);
  }

  DS.ui.registerScreen('charselect', {
    enter: function (params, root) {
      const chars = charsList();
      const st = { id: null, asc: 0, seed: '', trials: lastPick.trials ? lastPick.trials.slice() : [] };
      if (lastPick.id && chars.some(function (c) { return c.id === lastPick.id; })) {
        st.id = lastPick.id;
        st.asc = Math.min(lastPick.asc || 0, maxAsc(lastPick.id));
      } else if (chars.length) {
        st.id = chars[0].id;
      }
      const page = el('div', { class: 'ds-scr-page ds-scr-charpage' });
      root.appendChild(page);
      artBackdrop(root, 'menu', 1);

      function tile(c) {
        const on = c.id === st.id;
        const col = c.color || '#8a6d3b';
        const cm = charMeta(c.id);
        return el('div', {
          class: ['ds-panel', 'ds-scr-char', on ? 'ds-scr-char-on' : ''].join(' '),
          style: 'border-color:' + col + ';',
          onclick: function () {
            st.id = c.id;
            st.asc = Math.min(st.asc, maxAsc(c.id));
            render();
          }
        }, [
          txt('div', 'ds-scr-bigicon', c.icon || '👤'),
          el('div', { class: 'ds-scr-pick-name', style: 'color:' + col + ';', text: c.name || c.id }),
          txt('div', 'ds-scr-rarity', c.title || ''),
          cm ? txt('div', 'ds-scr-muted', 'Wins: ' + (Number(cm.wins) || 0) + ' · Best ascension: ' + (Number(cm.maxAscensionWon) || 0)) : null
        ]);
      }

      function detail(c) {
        const col = c.color || '#8a6d3b';
        const starter = defOf.relic(c.starterRelic);
        const picks = sampleCards(c.id);
        const preview = el('div', { class: 'ds-scr-preview' });
        const showPreview = function (id) {
          clear(preview);
          preview.appendChild(renderCardSafe({ id: id, upgraded: false }, {}));
        };
        const samples = el('div', { class: 'ds-scr-samples' }, picks.map(function (d) {
          const node = renderCardSafe({ id: d.id, upgraded: false }, { small: true });
          node.addEventListener('mouseenter', function () { showPreview(d.id); });
          return node;
        }));
        if (picks.length) showPreview(picks[0].id);

        let hero = null;
        tryCall('unitArt', function () {
          if (DS.art && typeof DS.art.unitArt === 'function') hero = DS.art.unitArt(c, { size: 112 });
        });
        if (!(hero && hero.nodeType)) hero = txt('div', 'ds-scr-bigicon', c.icon || '👤');

        const seedInput = el('input', {
          class: 'ds-seed-input',
          type: 'text',
          placeholder: 'Random seed (optional)',
          maxlength: 24,
          value: st.seed,
          'aria-label': 'Seed'
        });
        seedInput.addEventListener('input', function () { st.seed = seedInput.value; });

        const starterEl = starter
          ? el('div', { class: 'ds-scr-starter' }, [
            itemIcon('relic', starter, '🔮'),
            txt('b', null, ' ' + (starter.name || c.starterRelic))
          ])
          : null;
        if (starter) tip(starterEl, relicTip(c.starterRelic));

        return el('div', { class: 'ds-panel ds-scr-detail', style: 'border-color:' + col + ';' }, [
          el('div', { class: 'ds-scr-detail-head' }, [
            hero,
            el('div', { class: 'ds-scr-detail-text' }, [
              el('div', { class: 'ds-scr-pick-name', style: 'color:' + col + ';', text: c.name || c.id }),
              txt('div', 'ds-scr-rarity', c.title || ''),
              el('div', { class: 'ds-scr-pick-desc', text: c.desc || '' }),
              txt('div', 'ds-scr-play', playLine(c)),
              txt('div', 'ds-scr-goldline', '❤️ ' + (Number(c.hp) || 0) + ' HP   🪙 ' + (Number(c.gold) || 0) + ' gold'),
              starterEl
            ])
          ]),
          txt('div', 'ds-scr-section', 'Sample cards'),
          el('div', { class: 'ds-scr-sample-row' }, [samples, preview]),
          el('div', { class: 'ds-scr-setup' }, [ascPicker(c.id, st, render), trialPicker(st, render)]),
          el('div', { class: 'ds-scr-seedrow' }, [
            seedInput,
            el('button', {
              class: 'ds-btn ds-btn-primary ds-scr-begin',
              text: 'Begin run',
              onclick: function () {
                lastPick = { id: c.id, asc: st.asc, trials: st.trials.slice() };
                startRun(c.id, st.asc, st.seed, st.trials);
              }
            })
          ])
        ]);
      }

      function render() {
        clear(page);
        page.appendChild(pageHead('Choose your champion', 'Each champion brings a unique deck and a starter relic.',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go('menu'); } })));
        if (!chars.length) {
          page.appendChild(txt('div', 'ds-scr-muted', 'No champions are available.'));
          return;
        }
        page.appendChild(el('div', { class: 'ds-scr-chargrid' }, chars.map(tile)));
        const cur = st.id ? defOf.character(st.id) : null;
        if (cur) page.appendChild(detail(cur));
      }

      render();
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

      artBackdrop(root, 'map', run.act);
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
      el('div', { class: 'ds-reward-icon' }, [icon]),
      el('div', { class: 'ds-reward-text' }, [
        txt('div', 'ds-reward-label', label),
        txt('div', 'ds-reward-sub', sub)
      ]),
      txt('div', 'ds-reward-action', done ? 'Done' : (actionText || 'Claim'))
    ]);
  }

  DS.ui.registerScreen('reward', {
    enter: function (params, root) {
      params = params || {};
      const run = DS.run;
      if (!run) { later(function () { go('menu'); }); return; }
      const page = el('div', { class: 'ds-scr-page ds-scr-reward' });
      root.appendChild(page);

      // The reward room (run.room) is made when the fight is won. The engine keeps its stock and its claims,
      // so a resumed screen offers exactly the lines still open, and nothing is granted twice.
      const first = roomIs('reward');
      if (first) {
        (first.cardChoices || []).forEach(function (c) { if (c) markSeen('cards', c.id); });
        if (first.relic) markSeen('relics', first.relic);
        if (first.potion) markSeen('potions', first.potion);
      }
      const tier = (first && first.tier) || params.tier || 'normal';
      const fromEvent = first ? !!first.fromEvent : !!params.fromEvent;
      const title = tier === 'boss' ? (DS.run && DS.run.act >= 3 ? 'The Spire Falls Silent' : 'Boss Defeated!') : tier === 'elite' ? 'Elite Defeated' : 'Battle Won';
      const sub = fromEvent ? 'Spoils of an unexpected battle' : 'Claim what you have earned';
      let selected = -1;
      let cardNote = '';

      function claim(kind, arg) {
        return engineBool('Run.claimReward', function () { return DS.Run.claimReward(kind, arg); });
      }
      // After the final boss there is no deck left to build: settle the card reward so only the spoils show.
      const finalBoss = tier === 'boss' && !!DS.run && DS.run.act >= 3;
      if (finalBoss) { claim('card', null); cardNote = 'The climb ends here. No card is needed.'; }

      function takeCard(choices) {
        if (selected < 0 || !choices[selected]) return;
        const name = cardData(choices[selected]).name;
        if (claim('card', selected)) cardNote = 'Added to your deck: ' + name;
        else toast('That card could not be added.');
        render();
      }

      function skipCard() {
        if (claim('card', null)) cardNote = 'Skipped. No card taken.';
        render();
      }

      // Boss rewards lead to the boss relic step (which replaces this room); every other room closes for the map.
      function continueOn() {
        if (tier === 'boss') {
          // Nothing lies beyond the final boss, so there is no relic to carry on: finish the run here.
          if (DS.run && DS.run.act >= 3) {
            tryCall('nextAct', function () { DS.Run.nextAct(); });
            tryCall('Run.end', function () { DS.Run.end(true); });
            go('victory');
            return;
          }
          go('bossrelic');
          return;
        }
        leaveRoom('map');
      }

      function render() {
        clear(page);
        const r = roomIs('reward');
        const deckLen = Array.isArray(run.deck) ? run.deck.length : 0;
        const goldLine = txt('div', 'ds-scr-goldline',
          '❤️ ' + (Number(run.hp) || 0) + ' / ' + (Number(run.maxHp) || 0) + '     🪙 ' + (Number(run.gold) || 0));
        page.appendChild(pageHead(title, sub, el('div', { class: 'ds-scr-reward-head' }, [
          goldLine,
          el('button', { class: 'ds-btn', text: '🂠 Deck (' + deckLen + ')', onclick: openDeck })
        ])));
        if (!r) {
          page.appendChild(txt('div', 'ds-scr-muted', 'The spoils have already been taken.'));
          page.appendChild(el('div', { class: 'ds-scr-footer' }, [
            el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { leaveRoom('map'); } })
          ]));
          return;
        }

        const claimed = r.claimed || {};
        const choices = Array.isArray(r.cardChoices) ? r.cardChoices : [];
        const rows = [];
        if (r.gold > 0) {
          rows.push(rowNode('🪙', 'Gold', claimed.gold ? 'Collected' : '+' + r.gold + ' gold', !!claimed.gold, function () {
            claim('gold');
            render();
          }, 'Claim'));
        }
        if (r.potion) {
          const pd = defOf.potion(r.potion) || {};
          const prow = rowNode(itemIcon('potion', pd, '🧪'), pd.name || r.potion,
            claimed.potion ? 'Added to your belt' : (pd.desc || 'A potion'), !!claimed.potion, function () {
              if (!claim('potion')) {
                toast('No free potion slot. Discard a potion from the top bar first.');
                return;
              }
              render();
            }, 'Claim');
          rows.push(tip(prow, potionTip(r.potion)));
        }
        if (r.relic) {
          const rd = defOf.relic(r.relic) || {};
          const rrow = rowNode(itemIcon('relic', rd, '🔮'), rd.name || r.relic,
            claimed.relic ? 'Relic gained' : (rd.desc || 'A relic'), !!claimed.relic, function () {
              claim('relic');
              render();
            }, 'Claim');
          rows.push(tip(rrow, relicTip(r.relic)));
        }
        if (rows.length) page.appendChild(el('div', { class: 'ds-reward-list' }, rows));

        if (choices.length) {
          page.appendChild(txt('div', 'ds-scr-section', 'Card reward'));
          if (claimed.card) {
            page.appendChild(el('div', { class: 'ds-reward-list' }, [rowNode('🃏', 'Card reward', cardNote || 'Resolved.', true, null)]));
          } else {
            page.appendChild(txt('div', 'ds-scr-muted', 'Pick one card to add to your deck, or skip the reward.'));
            page.appendChild(el('div', { class: 'ds-reward-cards' }, choices.map(function (c, i) {
              const node = renderCardSafe(c, {
                selected: selected === i,
                onclick: function () { selected = i; render(); }
              });
              tip(node, cardTipHtml(c));
              return node;
            })));
            page.appendChild(el('div', { class: 'ds-scr-footer' }, [
              el('button', {
                class: 'ds-btn ds-btn-primary',
                text: selected >= 0 && choices[selected] ? 'Add ' + cardData(choices[selected]).name + ' to deck' : 'Choose a card',
                disabled: selected < 0,
                onclick: function () { takeCard(choices); }
              }),
              el('button', { class: 'ds-btn', text: 'Skip card reward', onclick: skipCard })
            ]));
          }
        }

        if (!rows.length && !choices.length) page.appendChild(txt('div', 'ds-scr-muted', 'No rewards this time.'));

        const pending = (r.gold > 0 && !claimed.gold) || (r.potion && !claimed.potion) ||
          (r.relic && !claimed.relic) || (choices.length && !claimed.card);
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          pending ? txt('div', 'ds-scr-muted', 'Rewards you leave unclaimed are lost.') : null,
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: continueOn })
        ]));
      }

      render();
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
      // The three offers are stored on the boss relic room; a resumed step shows the same three and any claim.
      if (!roomIs('bossrelic')) tryCall('bossRelicChoices', function () { DS.Run.bossRelicChoices(); });
      const r = roomIs('bossrelic');
      const claimedId = r && r.claimed ? String(r.claimed) : null;
      const offers = claimedId ? [claimedId] : (r && Array.isArray(r.choices) ? r.choices.filter(Boolean) : []);
      let busy = false;
      // A run resumed on the final boss's relic step has nothing to choose for: go straight to the ending.
      if (run.act >= 3 && !claimedId) { later(advance); return; }

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

      const row = el('div', { class: 'ds-scr-row' }, offers.map(function (id) {
        const d = defOf.relic(id) || {};
        return el('div', {
          class: 'ds-panel ds-scr-relic-pick' + (claimedId ? ' ds-choice-disabled' : ''),
          onclick: function () {
            if (busy || claimedId) return;
            if (!engineBool('Run.claimReward', function () { return DS.Run.claimReward('boss', id); })) {
              toast('That relic could not be taken.');
              return;
            }
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
      if (!offers.length) row.appendChild(txt('div', 'ds-scr-muted', 'The spire offers nothing more.'));

      root.appendChild(el('div', { class: 'ds-scr-page' }, [
        pageHead('Boss Relic', claimedId ? 'Relic claimed. Continue when ready.' : 'Choose one relic to carry into what lies ahead.'),
        row,
        el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn', text: claimedId ? 'Continue' : 'Skip', onclick: function () { advance(); } })
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
      // A resumed shop has no params: its stock is run.shop, which the engine saves with the run.
      const engineShop = tryCall('getShop', function () { return DS.Run.getShop(); }, null);
      const shop = params.shop || engineShop || run.shop || null;
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);
      if (!shop || typeof shop !== 'object') {
        page.appendChild(txt('div', 'ds-event-text', 'The shopkeeper is nowhere to be found.'));
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Leave', onclick: function () { leaveRoom('map'); } })
        ]));
        return;
      }
      shop.cards = Array.isArray(shop.cards) ? shop.cards : [];
      shop.relics = Array.isArray(shop.relics) ? shop.relics : [];
      shop.potions = Array.isArray(shop.potions) ? shop.potions : [];
      shop.cards.forEach(function (c) { if (c && c.inst) markSeen('cards', c.inst.id); });
      shop.relics.forEach(function (r) { if (r) markSeen('relics', r.id); });
      shop.potions.forEach(function (p) { if (p) markSeen('potions', p.id); });
      artBackdrop(root, 'shop', run.act);
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
            if (it.inst) tip(wrap, cardTipHtml(it.inst));
            if (!sold && (it.sale || it.onSale)) wrap.appendChild(txt('div', 'ds-scr-sale', 'SALE'));
            if (sold) wrap.appendChild(txt('div', 'ds-scr-sold', 'SOLD'));
            return wrap;
          })
          : [txt('div', 'ds-scr-muted', 'Sold out.')]);

        const relicRow = el('div', { class: 'ds-scr-row' }, shop.relics.length
          ? shop.relics.map(function (it, i) {
            const d = defOf.relic(it.id) || {};
            const price = Number(it.price) || 0;
            return tip(thingItem({
              icon: d.icon || '🔮', name: d.name || it.id, sub: cap(d.rarity || 'shop'), desc: d.desc || '',
              price: price, can: gold >= price, sold: !!it.sold,
              onbuy: function () { buy('relic', i); }
            }), relicTip(it.id));
          })
          : [txt('div', 'ds-scr-muted', 'No relics for sale.')]);

        const potRow = el('div', { class: 'ds-scr-row' }, shop.potions.length
          ? shop.potions.map(function (it, i) {
            const d = defOf.potion(it.id) || {};
            const price = Number(it.price) || 0;
            return tip(thingItem({
              icon: d.icon || '🧪', name: d.name || it.id, sub: cap(d.rarity || 'potion'), desc: d.desc || '',
              price: price, can: gold >= price, sold: !!it.sold,
              onbuy: function () { buy('potion', i); }
            }), potionTip(it.id));
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
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Leave the shop', onclick: function () { leaveRoom('map'); } })
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
      // The rest room records whether the fire was used (room.done). Rest and Smith both close it, so a resumed
      // rest site stays closed. Without a rest room there is nothing left to use.
      let busy = false;
      let outcome = '';
      const page = el('div', { class: 'ds-scr-page' });
      root.appendChild(page);
      artBackdrop(root, 'rest', run.act);

      function used() {
        const r = roomIs('rest');
        return !r || !!r.done;
      }

      function doRest() {
        if (used() || busy) return;
        const healed = Number(tryCall('Run.rest', function () { return DS.Run.rest(); }, 0)) || 0;
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

      function doUpgrade(uid, newName) {
        if (used() || busy) return;
        busy = true;
        const ok = engineBool('Run.upgradeCard', function () { return DS.Run.upgradeCard(uid); });
        busy = false;
        if (!ok) { toast('That card cannot be upgraded.'); return; }
        outcome = newName + ' has been sharpened.';
        render();
      }

      async function doSmith() {
        if (used() || busy) return;
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
        const heal = Math.max(0, Number(tryCall('restAmount', function () { return DS.Run.restAmount(); }, 0)) || 0);
        const eligibleCount = (Array.isArray(run.deck) ? run.deck : []).filter(isUpgradable).length;
        const done = used();
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
            txt('div', 'ds-scr-pick-desc', 'Recover HP at the fire.'),
            txt('div', 'ds-scr-rarity', '+' + (done ? 0 : heal) + ' HP')
          ]),
          el('div', {
            class: 'ds-panel ds-scr-choice' + (smithBlocked ? ' ds-choice-disabled' : ''),
            onclick: smithBlocked ? null : function () { doSmith(); }
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
          page.appendChild(txt('div', 'ds-event-text', outcome || 'The fire has already been used.'));
          page.appendChild(el('div', { class: 'ds-scr-footer' }, [
            el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { leaveRoom('map'); } })
          ]));
        } else {
          page.appendChild(el('div', { class: 'ds-scr-footer' }, [
            el('button', { class: 'ds-btn', text: 'Leave without resting', onclick: function () { leaveRoom('map'); } })
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
      const room = roomIs('event');
      const eventId = params.eventId || (room && room.eventId) || null;
      const info = tryCall('Run.getEvent', function () { return DS.Run.getEvent(eventId); }, null);
      const def = info && info.def;
      if (!def) {
        page.appendChild(txt('div', 'ds-event-text', 'Nothing of note happens here.'));
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { leaveRoom('map'); } })
        ]));
        return;
      }

      // The engine resolves a choice atomically and keeps the event open until one is taken. A choice that starts
      // a fight turns the room into a combat room, so Continue returns to that fight rather than to this event.
      let busy = false;
      const choiceBox = el('div', { class: 'ds-scr-choices' });
      const resultBox = el('div', { class: 'ds-scr-result' });

      function showResult(res) {
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
                go('combat', { encounterId: fight, tier: res.fightTier || 'normal', fromEvent: true });
              } else {
                leaveRoom('map');
              }
            }
          })
        ]));
      }

      async function choose(idx) {
        if (busy) return;
        busy = true;
        const res = await tryAwait('Run.chooseEvent', function () { return DS.Run.chooseEvent(eventId, idx); }, null);
        busy = false;
        if (!res || res.ok === false) {
          toast('That choice did not work out.');
          return;
        }
        showResult(res);
      }

      const choices = info && Array.isArray(info.choices) ? info.choices : [];
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
          onclick: function () { leaveRoom('map'); }
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
      // The chest is a treasure room whose contents were rolled when the room was entered. DS.Run.claimReward('chest')
      // pays them out once and records it on the room, so a resumed screen shows the contents without paying again.
      const room = roomIs('treasure');
      const relicId = (room && room.relicId) || params.relicId || null;
      const gold = Number(room ? room.gold : params.gold) || 0;
      const bonus = room ? room.bonus : (params.bonus || null);
      let opened = !!(room && room.claimed && room.claimed.chest);
      let potionLost = false;
      let busy = false;

      const hint = txt('div', 'ds-scr-muted', room ? 'Tap the chest to open it.' : 'This chest has already been looted.');
      const reveal = el('div', { class: 'ds-scr-reveal' });
      const chest = el('div', { class: 'ds-scr-chest', text: '🧰', onclick: openChest });
      const cont = el('div', { class: 'ds-scr-footer', style: 'display:none;' }, [
        el('button', { class: 'ds-btn ds-btn-primary', text: 'Continue', onclick: function () { leaveRoom('map'); } })
      ]);

      function renderReveal() {
        clear(reveal);
        if (gold > 0) reveal.appendChild(txt('div', 'ds-scr-goldline', '+' + gold + ' gold'));
        if (relicId) {
          const d = defOf.relic(relicId) || {};
          const node = el('div', { class: 'ds-panel ds-scr-relic-pick' }, [
            itemIcon('relic', d, '🔮', 'ds-scr-bigicon'),
            txt('div', 'ds-scr-pick-name', d.name || relicId),
            txt('div', 'ds-scr-rarity', cap(d.rarity || 'treasure')),
            el('div', { class: 'ds-scr-pick-desc', html: dsc(d.desc || '') })
          ]);
          markSeen('relics', relicId);
          reveal.appendChild(node);
        }
        if (bonus && bonus.kind === 'potion') {
          const pd = defOf.potion(bonus.id) || {};
          reveal.appendChild(el('div', { class: 'ds-panel ds-scr-relic-pick' }, [
            itemIcon('potion', pd, '🧪', 'ds-scr-bigicon'),
            txt('div', 'ds-scr-pick-name', pd.name || bonus.id),
            txt('div', 'ds-scr-rarity', 'Potion'),
            potionLost
              ? txt('div', 'ds-scr-muted', 'Your potion belt was full, so this potion was lost.')
              : el('div', { class: 'ds-scr-pick-desc', html: dsc(pd.desc || '') })
          ]));
          markSeen('potions', bonus.id);
        } else if (bonus && bonus.kind === 'gold' && Number(bonus.amount) > 0) {
          reveal.appendChild(txt('div', 'ds-scr-goldline', '+' + Number(bonus.amount) + ' gold (bonus)'));
        }
        if (!gold && !relicId && !(bonus && (bonus.kind === 'potion' || Number(bonus.amount) > 0))) {
          reveal.appendChild(txt('div', 'ds-scr-muted', 'The chest is empty.'));
        }
      }

      function showOpened() {
        hint.style.display = 'none';
        chest.classList.add('ds-scr-gone');
        renderReveal();
        cont.style.display = '';
      }

      function openChest() {
        if (opened || busy || !room) return;
        busy = true;
        const freeBefore = tryCall('hasFreePotionSlot', hasFreePotionSlot, true);
        const ok = engineBool('Run.claimReward', function () { return DS.Run.claimReward('chest'); });
        busy = false;
        if (!ok) { toast('The chest is already empty.'); return; }
        opened = true;
        potionLost = !!(bonus && bonus.kind === 'potion' && !freeBefore);
        hint.style.display = 'none';
        chest.classList.add('ds-scr-shake');
        setTimeout(showOpened, 650);
      }

      root.appendChild(el('div', { class: 'ds-scr-page ds-scr-center' }, [
        pageHead('Treasure', 'A chest rests quietly in the dust.'),
        chest,
        hint,
        reveal,
        cont
      ]));
      if (opened) {
        showOpened();
      } else if (!room) {
        // No treasure room left: nothing is paid out from the parameters alone.
        hint.style.display = 'none';
        chest.classList.add('ds-scr-gone');
        reveal.appendChild(txt('div', 'ds-scr-muted', 'Nothing is left here.'));
        cont.style.display = '';
      }
    },
    exit: function () {}
  });

  /* ================================================================
   * run summary: gameover and victory
   * ================================================================ */
  // The encounter that ended a lost run, or null.
  function killedByText(run) {
    // Only a fall to zero HP names a killer; an abandoned run was not killed by its last fight.
    if (!run || run.won || !(Number(run.hp) <= 0) || !run.lastEncounterId) return null;
    const enc = DS.encounters && DS.encounters[run.lastEncounterId];
    return enc ? (enc.name || run.lastEncounterId) : String(run.lastEncounterId);
  }

  function runScore(run) {
    const s = tryCall('Run.score', function () {
      return DS.Run && typeof DS.Run.score === 'function' ? DS.Run.score(run) : null;
    }, null);
    return typeof s === 'number' && isFinite(s) ? Math.round(s) : null;
  }

  // Set when this run's victory raised the highest selectable ascension for its champion.
  function unlockedAscensionText(run) {
    if (!run || !run.won || !runMaxBase || runMaxBase.char !== run.character) return null;
    const now = maxAsc(run.character);
    if (now <= runMaxBase.max) return null;
    const ch = defOf.character(run.character);
    return 'Next ascension unlocked: ascension ' + now + ' for ' + (ch ? ch.name : run.character) + '.';
  }

  function restartSameCharacter() {
    const r = DS.run;
    if (!r || !r.character || !defOf.character(r.character)) { go('charselect'); return; }
    startRun(r.character, r.ascension || 0, '');
  }

  function summaryFact(k, v) {
    return el('div', { class: 'ds-scr-stat' }, [txt('div', 'ds-scr-stat-v', v), txt('div', 'ds-scr-stat-k', k)]);
  }

  function summaryPage(o) {
    const run = DS.run;
    const st = (run && run.stats) || {};
    const ch = run ? defOf.character(run.character) : null;
    const deck = run && Array.isArray(run.deck) ? run.deck : [];
    const relics = run && Array.isArray(run.relics) ? run.relics : [];
    const asc = run && Number(run.ascension) > 0 ? Number(run.ascension) : 0;
    const score = runScore(run);
    const killed = killedByText(run);
    const unlocked = unlockedAscensionText(run);
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
    const statGrid = el('div', { class: 'ds-scr-stats' }, stats.map(function (s) { return summaryFact(s[0], s[1]); }));
    const relicRow = relics.length
      ? el('div', { class: 'ds-scr-tb-group' }, relics.map(function (r) { return relicEl(r); }))
      : txt('div', 'ds-scr-muted', 'No relics.');
    const deckRow = deck.length
      ? el('div', { class: 'ds-scr-tb-group' }, sortDeck(deck).map(function (inst) {
        const d = cardData(inst);
        return tip(txt('span', 'ds-scr-mini', d.icon || '🃏'), cardTipHtml(inst));
      }))
      : txt('div', 'ds-scr-muted', 'Your deck is empty.');

    const achIds = runAchievements.slice();
    const achNodes = achIds.map(function (id) {
      const a = achievementDef(id) || { name: id, icon: '🏅', desc: '' };
      return el('div', { class: 'ds-achievement' }, [
        txt('div', 'ds-scr-bigicon', a.icon || '🏅'),
        txt('b', null, a.name || id),
        txt('div', 'ds-scr-muted', a.desc || '')
      ]);
    });

    const buttons = [];
    if (ch) buttons.push(el('button', { class: 'ds-btn ds-btn-primary', text: 'New Run (' + ch.name + ')', onclick: restartSameCharacter }));
    buttons.push(el('button', { class: 'ds-btn', text: 'Menu', onclick: function () { go('menu'); } }));

    return el('div', { class: 'ds-scr-page ds-scr-center' }, [
      txt('div', 'ds-title ' + (o.won ? 'ds-scr-title-gold' : 'ds-scr-title-red'), o.title),
      txt('div', 'ds-subtitle', o.sub),
      el('div', { class: 'ds-scr-stats' }, [
        summaryFact('Score', score === null ? '—' : String(score)),
        summaryFact('Ascension', asc ? String(asc) : 'Standard'),
        killed ? summaryFact('Killed by', killed) : null
      ]),
      unlocked ? el('div', { class: 'ds-scr-unlock', text: unlocked }) : null,
      el('div', { class: 'ds-panel ds-scr-sumpanel' }, [
        statGrid,
        txt('div', 'ds-scr-section', 'New achievements'),
        achNodes.length
          ? el('div', { class: 'ds-scr-achv-row' }, achNodes)
          : txt('div', 'ds-scr-muted', 'No new achievements this run.'),
        txt('div', 'ds-scr-section', 'Relics'),
        relicRow,
        txt('div', 'ds-scr-section', 'Deck'),
        deckRow
      ]),
      el('div', { class: 'ds-scr-footer' }, buttons)
    ]);
  }

  DS.ui.registerScreen('gameover', {
    enter: function (params, root) {
      root.appendChild(summaryPage({
        title: 'Defeat',
        sub: 'The Duskspire claims another wanderer. Your deck scatters in the ash.',
        won: false
      }));
      artBackdrop(root, 'gameover', (DS.run && DS.run.act) || 1);
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
      artBackdrop(root, 'victory', 3);
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

  // Keywords explained for players. Statuses are added from DS.statuses at display time.
  const GLOSSARY_TERMS = [
    ['Block', 'Absorbs damage. Damage removes Block before it removes HP. Block is lost at the start of your turn unless you have Barricade.'],
    ['Energy', 'Spent to play cards. Refills at the start of each of your turns.'],
    ['Draw', 'Move cards from your draw pile into your hand.'],
    ['Discard', 'Move cards from your hand to your discard pile. Discarded cards come back when the draw pile is shuffled.'],
    ['Exhaust', 'Removed from the battle after it is played, for the rest of this combat.'],
    ['Ethereal', 'If this card is still in your hand at the end of your turn, it is Exhausted.'],
    ['Innate', 'Always starts the battle in your opening hand.'],
    ['Retain', 'Stays in your hand at the end of your turn instead of being discarded.'],
    ['Unplayable', 'This card cannot be played.'],
    ['Shuffle', 'Your discard pile is shuffled back into your draw pile when the draw pile runs out.'],
    ['Heal', 'Restore HP, up to your maximum.'],
    ['Max HP', 'Your maximum hit points.'],
    ['Gold', 'The currency spent in shops and gained from battles and events.'],
    ['Intent', 'The icon above an enemy shows what it will do on its next turn. Hover it for the exact damage.'],
    ['Upgrade', 'Upgraded cards are marked with a + and have stronger effects. Smithing at a rest site upgrades one card.']
  ];

  const CHUNK = 60;            // entries rendered per step in long lists
  let compendiumIO = null;     // IntersectionObserver feeding the current list; disconnected on exit

  // Renders a long list in chunks: a sentinel below the grid loads the next chunk as it scrolls into view.
  function chunkedGrid(items, makeNode, cls) {
    const grid = el('div', { class: cls });
    const sentinel = el('div', { class: 'ds-scr-more' });
    const count = txt('span', 'ds-scr-muted', '');
    let shown = 0;
    const more = function () {
      const end = Math.min(items.length, shown + CHUNK);
      for (let i = shown; i < end; i++) grid.appendChild(makeNode(items[i]));
      shown = end;
      count.textContent = 'Showing ' + shown + ' of ' + items.length;
      if (shown >= items.length) {
        sentinel.style.display = 'none';
        if (compendiumIO) { compendiumIO.disconnect(); compendiumIO = null; }
      }
    };
    sentinel.appendChild(el('button', { class: 'ds-btn', text: 'Show more', onclick: more }));
    sentinel.appendChild(count);
    more();
    if (shown < items.length && typeof IntersectionObserver === 'function') {
      try {
        if (compendiumIO) compendiumIO.disconnect();
        compendiumIO = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) more();
        }, { rootMargin: '480px 0px' });
        compendiumIO.observe(sentinel);
      } catch (e) {
        compendiumIO = null;
      }
    }
    return el('div', { class: 'ds-scr-chunked' }, [grid, sentinel]);
  }

  // Lookup of discovered ids for a kind, or null when there is no meta (then nothing is dimmed).
  function seenMap(kind) {
    const m = metaData();
    return m && m.seen && m.seen[kind] ? m.seen[kind] : null;
  }

  function costBucket(c) {
    if (c === 'X') return 'X';
    if (c === -1 || c === undefined || c === null) return 'U';
    if (typeof c === 'number') return c >= 4 ? '4+' : String(c);
    return String(c);
  }

  function costKey(c) {
    if (typeof c === 'number') return c >= 0 ? c : 60;
    if (c === 'X') return 50;
    return 70;
  }

  // One card cell in the grid. The upgraded version shows on hover, or always when the toggle is on.
  function cardCell(def, showUp, seen) {
    const hasUp = !!def.upgrade;
    const normal = renderCardSafe({ id: def.id, upgraded: false }, { small: true });
    const dim = seen && !seen[def.id];
    const cell = el('div', { class: 'ds-scr-cell' + (dim ? ' ds-undiscovered' : '') }, [normal]);
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
    let capText = cap(def.class || '') + ' · ' + cap(def.rarity || '') + ' · ' + (def.cost === -1 ? 'unplayable' : 'cost ' + def.cost);
    if (hasUp) capText += showUp ? ' · upgraded' : ' · hover for upgrade';
    if (dim) capText += ' · not yet seen';
    cell.appendChild(txt('div', 'ds-scr-cap', capText));
    return cell;
  }

  // Damage and block of an enemy move, as a short text.
  function moveSummary(effects) {
    if (!Array.isArray(effects)) return '';
    const parts = [];
    effects.forEach(function (e) {
      if (!e) return;
      if (e.op === 'damage') parts.push((typeof e.amount === 'number' ? e.amount : '?') + ' damage' + (Number(e.times) > 1 ? ' ×' + e.times : ''));
      else if (e.op === 'block') parts.push((typeof e.amount === 'number' ? e.amount : '?') + ' block');
      else if (e.op === 'apply' && e.status) parts.push(String(e.status) + (typeof e.amount === 'number' ? ' ' + e.amount : ''));
      else if (e.op === 'summon') parts.push('summons');
    });
    return parts.join(' + ');
  }

  function enemyEntry(d, seen, st) {
    const undiscovered = seen && !seen[d.id];
    const moveIds = d.moves && typeof d.moves === 'object' ? Object.keys(d.moves) : [];
    const hp = Array.isArray(d.hp) ? d.hp[0] + '–' + d.hp[1] + ' HP' : (d.hp !== undefined ? d.hp + ' HP' : '? HP');
    const open = !!st.open[d.id];
    let portrait = null;
    tryCall('unitArt', function () {
      if (DS.art && typeof DS.art.unitArt === 'function') portrait = DS.art.unitArt(d, { size: 56 });
    });
    if (!(portrait && portrait.nodeType)) portrait = txt('div', 'ds-scr-bigicon', d.icon || '👾');
    const body = [
      el('div', { class: 'ds-scr-entry-name', html: '<b>' + esc(d.name || d.id) + '</b>' }),
      txt('div', 'ds-scr-rarity', 'Act ' + (d.act || '?') + ' · ' + cap(d.tier || 'normal') + ' · ' + hp +
        (moveIds.length ? ' · ' + moveIds.length + ' moves (click for details)' : ''))
    ];
    if (open) {
      body.push(el('div', { class: 'ds-scr-moves' }, moveIds.map(function (k) {
        const m = d.moves[k] || {};
        const dmg = moveSummary(m.effects);
        const intent = m.intent ? cap(String(m.intent).replace(/_/g, ' ')) : 'Unknown';
        return el('div', { class: 'ds-scr-move' }, [
          txt('b', null, m.name || k),
          txt('span', 'ds-scr-muted', ' · ' + intent + (dmg ? ' · ' + dmg : ''))
        ]);
      })));
    } else if (!moveIds.length) {
      body.push(txt('div', 'ds-scr-muted', 'No moves listed.'));
    }
    return el('div', {
      class: 'ds-panel ds-scr-entry ds-scr-enemy' + (undiscovered ? ' ds-undiscovered' : '') + (open ? ' ds-scr-open' : ''),
      onclick: function () { st.open[d.id] = !open; st.rerender(); }
    }, [portrait, el('div', { class: 'ds-scr-entry-body' }, body)]);
  }

  function entryRow(icon, name, meta, desc, dim, extra) {
    return el('div', { class: 'ds-panel ds-scr-entry' + (dim ? ' ds-undiscovered' : '') }, [
      icon,
      el('div', { class: 'ds-scr-entry-body' }, [
        el('div', { class: 'ds-scr-entry-name', html: '<b>' + esc(name) + '</b>' }),
        txt('div', 'ds-scr-rarity', meta),
        el('div', { class: 'ds-scr-pick-desc', html: dsc(desc || '') }),
        extra || null
      ])
    ]);
  }

  // Sorting helpers shared by the tabs.
  function byName(a, b) {
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  }

  function matchesText(q, parts) {
    if (!q) return true;
    return parts.some(function (p) { return String(p || '').toLowerCase().indexOf(q) >= 0; });
  }

  // Search, sort and filter controls for one tab. `st` holds the choices; `rerender` redraws the body only.
  function compendiumTools(st, tabName, rerender, opts) {
    const bar = el('div', { class: 'ds-scr-toolbar' });
    const search = el('input', {
      class: 'ds-search-input',
      type: 'search',
      placeholder: 'Search by name or text…',
      value: st.q,
      'aria-label': 'Search'
    });
    search.addEventListener('input', function () {
      st.q = search.value;
      rerender();
    });
    const select = function (label, options, current, key) {
      const s = el('select', { class: 'ds-select', 'aria-label': label }, options.map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: o[0] === current });
      }));
      s.addEventListener('change', function () {
        st[key] = s.value;
        rerender();
      });
      return s;
    };
    bar.appendChild(search);
    if (opts.sorts && opts.sorts.length) bar.appendChild(select('Sort', opts.sorts, st.sort, 'sort'));
    if (opts.filters) {
      opts.filters.forEach(function (f) {
        bar.appendChild(select(f.label, f.options, st[f.key], f.key));
      });
    }
    if (tabName === 'cards') {
      bar.appendChild(el('button', {
        class: 'ds-btn' + (st.showUp ? ' ds-btn-primary' : ''),
        text: st.showUp ? 'Showing upgrades' : 'Show upgrades',
        onclick: function () { st.showUp = !st.showUp; st.rerenderAll(); }
      }));
    }
    return bar;
  }

  function cardRowsFor(st) {
    const q = String(st.q || '').trim().toLowerCase();
    let list = keysOf(DS.cards).slice();
    if (st.cls !== 'all') list = list.filter(function (d) { return d.class === st.cls; });
    if (st.type !== 'all') list = list.filter(function (d) { return d.type === st.type; });
    if (st.rarity !== 'all') list = list.filter(function (d) { return d.rarity === st.rarity; });
    if (st.cost !== 'all') list = list.filter(function (d) { return costBucket(d.cost) === st.cost; });
    list = list.filter(function (d) {
      return matchesText(q, [d.name, d.desc, d.upgrade && d.upgrade.desc]);
    });
    if (st.sort === 'name') list.sort(byName);
    else if (st.sort === 'cost') list.sort(function (a, b) { return costKey(a.cost) - costKey(b.cost) || byName(a, b); });
    else if (st.sort === 'rarity') list.sort(rarityThenName);
    else list.sort(defSort);
    return list;
  }

  function cardsTab(st) {
    const list = cardRowsFor(st);
    const seen = seenMap('cards');
    const classes = [['all', 'All classes']].concat(Object.keys(DS.characters || {}).map(function (k) {
      return [k, cap(k)];
    })).concat([['colorless', 'Colorless'], ['status', 'Status'], ['curse', 'Curse']]);
    const tools = compendiumTools(st, 'cards', st.rerender, {
      sorts: [['class', 'Sort: class'], ['name', 'Sort: name'], ['cost', 'Sort: cost'], ['rarity', 'Sort: rarity']],
      filters: [
        { key: 'cls', label: 'Class', options: classes },
        { key: 'type', label: 'Type', options: [['all', 'All types'], ['attack', 'Attack'], ['skill', 'Skill'], ['power', 'Power'], ['status', 'Status'], ['curse', 'Curse']] },
        { key: 'rarity', label: 'Rarity', options: [['all', 'All rarities'], ['starter', 'Starter'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['special', 'Special']] },
        { key: 'cost', label: 'Cost', options: [['all', 'Any cost'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4+'], ['X', 'X'], ['U', 'Unplayable']] }
      ]
    });
    const total = keysOf(DS.cards).length;
    const seenCount = seen ? keysOf(DS.cards).filter(function (d) { return seen[d.id]; }).length : null;
    return [
      tools,
      txt('div', 'ds-scr-muted', (seenCount !== null ? 'Seen ' + seenCount + ' / ' + total + ' · ' : '') + list.length + ' cards shown'),
      list.length
        ? chunkedGrid(list, function (d) { return cardCell(d, st.showUp, seen); }, 'ds-grid')
        : txt('div', 'ds-scr-muted', 'No cards match.')
    ];
  }

  function relicsTab(st) {
    const q = String(st.q || '').trim().toLowerCase();
    let list = keysOf(DS.relics).filter(function (d) { return matchesText(q, [d.name, d.desc, d.flavor]); });
    if (st.sort === 'name') list.sort(byName); else list.sort(rarityThenName);
    const seen = seenMap('relics');
    const tools = compendiumTools(st, 'relics', st.rerender, {
      sorts: [['rarity', 'Sort: rarity'], ['name', 'Sort: name']]
    });
    const seenCount = seen ? list.filter(function (d) { return seen[d.id]; }).length : null;
    return [
      tools,
      txt('div', 'ds-scr-muted', (seenCount !== null ? 'Seen ' + seenCount + ' / ' + list.length + ' · ' : '') + list.length + ' relics'),
      chunkedGrid(list, function (d) {
        const meta = [cap(d.rarity || ''), d.class ? cap(d.class) : ''].filter(Boolean).join(' · ');
        return entryRow(itemIcon('relic', d, '🔮', 'ds-scr-bigicon'), d.name || d.id, meta, d.desc,
          seen && !seen[d.id], d.flavor ? txt('div', 'ds-scr-flavor', d.flavor) : null);
      }, 'ds-scr-list')
    ];
  }

  function potionsTab(st) {
    const q = String(st.q || '').trim().toLowerCase();
    let list = keysOf(DS.potions).filter(function (d) { return matchesText(q, [d.name, d.desc]); });
    if (st.sort === 'name') list.sort(byName); else list.sort(rarityThenName);
    const seen = seenMap('potions');
    const tools = compendiumTools(st, 'potions', st.rerender, {
      sorts: [['rarity', 'Sort: rarity'], ['name', 'Sort: name']]
    });
    return [
      tools,
      txt('div', 'ds-scr-muted', list.length + ' potions'),
      chunkedGrid(list, function (d) {
        const meta = [cap(d.rarity || ''), d.target ? 'Target: ' + String(d.target).replace(/_/g, ' ') : ''].filter(Boolean).join(' · ');
        return entryRow(itemIcon('potion', d, '🧪', 'ds-scr-bigicon'), d.name || d.id, meta, d.desc, seen && !seen[d.id], null);
      }, 'ds-scr-list')
    ];
  }

  function enemiesTab(st) {
    const q = String(st.q || '').trim().toLowerCase();
    let list = keysOf(DS.enemies).filter(function (d) { return matchesText(q, [d.name]); });
    if (st.sort === 'name') list.sort(byName);
    else {
      list.sort(function (a, b) {
        return (Number(a.act) || 0) - (Number(b.act) || 0) ||
          ord(TIER_ORDER, a.tier, 9) - ord(TIER_ORDER, b.tier, 9) ||
          hpMin(a) - hpMin(b) ||
          byName(a, b);
      });
    }
    const seen = seenMap('enemies');
    const tools = compendiumTools(st, 'enemies', st.rerender, {
      sorts: [['act', 'Sort: act and tier'], ['name', 'Sort: name']]
    });
    return [
      tools,
      txt('div', 'ds-scr-muted', list.length + ' enemies · click one to see its moves'),
      chunkedGrid(list, function (d) { return enemyEntry(d, seen, st); }, 'ds-scr-list')
    ];
  }

  // Statuses (from DS.statuses) followed by the keyword glossary.
  function keywordsTab(st) {
    const q = String(st.q || '').trim().toLowerCase();
    const statuses = keysOf(DS.statuses).filter(function (s) { return matchesText(q, [s.name, s.desc]); })
      .sort(function (a, b) {
        const t = (a.type === 'debuff' ? 1 : 0) - (b.type === 'debuff' ? 1 : 0);
        return t || String(a.name || a.id).localeCompare(String(b.name || b.id));
      });
    const terms = GLOSSARY_TERMS.filter(function (t) { return matchesText(q, [t[0], t[1]]); });
    const tools = compendiumTools(st, 'keywords', st.rerender, { sorts: [] });
    return [
      tools,
      txt('div', 'ds-scr-section', 'Statuses'),
      statuses.length
        ? el('div', { class: 'ds-scr-list' }, statuses.map(function (s) {
          return entryRow(txt('div', 'ds-scr-bigicon', s.icon || '•'), s.name || s.id,
            (s.type === 'debuff' ? 'Debuff' : 'Buff') + (s.stacks === false ? ' · no stacks' : ' · stacks'),
            String(s.desc || '').split('{n}').join('X'), false, null);
        }))
        : txt('div', 'ds-scr-muted', 'No statuses match.'),
      txt('div', 'ds-scr-section', 'Keywords'),
      terms.length
        ? el('div', { class: 'ds-scr-list' }, terms.map(function (t) {
          return entryRow(txt('div', 'ds-scr-bigicon', '📖'), t[0], 'Keyword', t[1], false, null);
        }))
        : txt('div', 'ds-scr-muted', 'No keywords match.')
    ];
  }

  DS.ui.registerScreen('compendium', {
    enter: function (params, root) {
      const st = {
        tab: 'cards', q: '', cls: 'all', type: 'all', rarity: 'all', cost: 'all',
        sort: 'class', showUp: false, open: {}
      };
      const page = el('div', { class: 'ds-scr-page ds-scr-comp' });
      root.appendChild(page);

      const tabDefs = [
        ['cards', 'Cards', keysOf(DS.cards).length, 'cards'],
        ['relics', 'Relics', keysOf(DS.relics).length, 'relics'],
        ['potions', 'Potions', keysOf(DS.potions).length, 'potions'],
        ['enemies', 'Enemies', keysOf(DS.enemies).length, 'enemies'],
        ['keywords', 'Statuses & keywords', keysOf(DS.statuses).length + GLOSSARY_TERMS.length, null]
      ];

      function seenLabel(t) {
        const seen = t[3] ? seenMap(t[3]) : null;
        if (!seen) return t[1] + ' (' + t[2] + ')';
        const n = keysOf(t[3] === 'cards' ? DS.cards : t[3] === 'relics' ? DS.relics : t[3] === 'potions' ? DS.potions : DS.enemies)
          .filter(function (d) { return seen[d.id]; }).length;
        return t[1] + ' (' + n + ' / ' + t[2] + ')';
      }

      // Redraws the list only. The toolbar stays put, so the search box keeps focus while typing.
      // Returns the freshly built toolbar, which renderAll uses on a full redraw.
      function rerenderBody() {
        const body = page.querySelector('.ds-scr-comp-body');
        if (compendiumIO) { compendiumIO.disconnect(); compendiumIO = null; }
        const parts = st.tab === 'cards' ? cardsTab(st)
          : st.tab === 'relics' ? relicsTab(st)
            : st.tab === 'potions' ? potionsTab(st)
              : st.tab === 'enemies' ? enemiesTab(st)
                : keywordsTab(st);
        if (body) {
          clear(body);
          parts.slice(1).forEach(function (p) { body.appendChild(p); });
        }
        return parts[0];
      }

      // Full redraw: tabs, toolbar and body. Used when the tab or the card-upgrade toggle changes.
      function renderAll() {
        clear(page);
        if (compendiumIO) { compendiumIO.disconnect(); compendiumIO = null; }
        st.rerender = rerenderBody;
        st.rerenderAll = renderAll;
        page.appendChild(pageHead('Compendium', 'Everything the Duskspire has to offer',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go('menu'); } })));
        page.appendChild(el('div', { class: 'ds-scr-tabs' }, tabDefs.map(function (t) {
          return el('button', {
            class: 'ds-tab' + (st.tab === t[0] ? ' ds-tab-active' : ''),
            text: seenLabel(t),
            onclick: function () {
              st.tab = t[0];
              st.q = '';
              st.sort = t[0] === 'cards' ? 'class' : 'name';
              renderAll();
            }
          });
        })));
        const toolsHost = el('div', { class: 'ds-scr-comp-tools' });
        page.appendChild(toolsHost);
        page.appendChild(el('div', { class: 'ds-scr-comp-body' }));
        const tools = rerenderBody();
        if (tools) toolsHost.appendChild(tools);
      }

      renderAll();
    },
    exit: function () {
      if (compendiumIO) { compendiumIO.disconnect(); compendiumIO = null; }
    }
  });

  /* ================================================================
   * how to play
   * ================================================================ */
  const HOWTO_SECTIONS = [
    ['Goal', [
      'Climb three acts of the Duskspire. Each act ends at a boss. Defeat the boss of the third act to win.',
      'If your HP reaches zero the run ends. Your score counts what you achieved before that.'
    ]],
    ['The map', [
      'Each act is a branching map. You can travel only to the rooms linked from where you stand. Each room is shown with an icon.',
      'Fight: an ordinary enemy group, with card and gold rewards. Elite: a tougher fight with better rewards, and it can drop a relic.',
      'Rest site: heal 30% of your max HP, or Smith to upgrade one card. Shop: buy cards, relics and potions, or pay to remove a card.',
      'Event: a story with choices. Some choices cost HP or gold for something better. Treasure: open a chest for gold, often with a relic.',
      'Boss: the guardian of the act. After it you choose one boss relic.'
    ]],
    ['Turns', [
      'A fight is played in turns. On your turn you have energy and draw cards. Play a card by clicking it, or drag it onto its target.',
      'When you are done, end your turn. The enemies then act. Enemies show their next move above them, so you can plan around it.',
      'If you have playable cards and energy left, the game can ask you to confirm before ending the turn. You can turn this off in Settings.'
    ]],
    ['Energy and cards', [
      'Each card shows its cost in the orb on its corner. Energy refills every turn.',
      'Cards left in your hand are discarded at the end of the turn. When your draw pile runs out it is shuffled from your discard pile.',
      'Your hand holds at most 10 cards. Exhausted cards leave the fight until it ends.'
    ]],
    ['Block', [
      'Block absorbs damage before HP is lost. It is removed at the start of your turn, unless a relic or status keeps it.',
      'Hover a card to see the damage or block it will do right now, after strength, weakness and vulnerability are counted.'
    ]],
    ['Relics and potions', [
      'Relics are permanent passive effects. They are shown in the top bar, and hovering one explains it.',
      'Potions are single-use. You can use them only in a fight. Outside a fight you can discard one from the top bar.'
    ]],
    ['Upgrading', [
      'At a rest site, Smith lets you upgrade a card. Upgraded cards show a + and have stronger effects. Hover a card to compare.'
    ]],
    ['Ascension', [
      'Winning a run at an ascension level unlocks the next one, up to level 10. Each level adds a harder modifier, and higher levels stack the earlier ones.',
      'Choose the ascension on the champion screen. The top bar shows the level you are playing.'
    ]],
    ['Seeds and saving', [
      'Every run is built from a seed. The same champion, seed and ascension give the same map and rewards. Leave the seed empty for a random run.',
      'Runs save automatically. Continue on the menu returns you to the exact room you left.'
    ]]
  ];

  DS.ui.registerScreen('howto', {
    enter: function (params, root) {
      params = params || {};
      const back = params.back || 'menu';
      const sections = HOWTO_SECTIONS.map(function (s) {
        return el('div', { class: 'ds-panel ds-howto-section' }, [
          txt('div', 'ds-scr-section', s[0]),
          el('div', { class: 'ds-howto-body' }, s[1].map(function (p) {
            return el('p', { class: 'ds-howto-p', html: dsc(p) });
          }))
        ]);
      });
      const glossaryRows = GLOSSARY_TERMS.map(function (t) {
        return el('div', { class: 'ds-howto-term' }, [
          el('b', { class: 'ds-kw-term', text: t[0] }),
          el('div', { class: 'ds-scr-muted', html: dsc(t[1]) })
        ]);
      });
      const statusRows = keysOf(DS.statuses).slice().sort(byName).map(function (s) {
        return el('div', { class: 'ds-howto-term' }, [
          el('b', { class: 'ds-kw-term', text: (s.icon ? s.icon + ' ' : '') + (s.name || s.id) }),
          el('div', { class: 'ds-scr-muted', html: dsc(String(s.desc || '').split('{n}').join('X')) })
        ]);
      });
      root.appendChild(el('div', { class: 'ds-scr-page ds-howto' }, [
        pageHead('How to Play', 'The short version. Every term below is also shown in the compendium.',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go(back); } })),
        el('div', { class: 'ds-howto-sections' }, sections),
        txt('div', 'ds-scr-section', 'Keyword glossary'),
        el('div', { class: 'ds-howto-glossary' }, glossaryRows),
        txt('div', 'ds-scr-section', 'Statuses'),
        el('div', { class: 'ds-howto-glossary' }, statusRows.length ? statusRows : [txt('div', 'ds-scr-muted', 'No statuses are defined.')])
      ]));
    },
    exit: function () {}
  });

  /* ================================================================
   * settings
   * ================================================================ */
  // Full-screen toggling. Quietly does nothing where the browser refuses it.
  function applyFullscreen(on) {
    tryCall('fullscreen', function () {
      const root = document.documentElement;
      if (on && !document.fullscreenElement && typeof root.requestFullscreen === 'function') {
        Promise.resolve(root.requestFullscreen()).catch(function () { /* refused */ });
      } else if (!on && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        Promise.resolve(document.exitFullscreen()).catch(function () { /* refused */ });
      }
    });
  }

  function settingsRow(label, hint, control) {
    return el('div', { class: 'ds-settings-row' }, [
      el('div', { class: 'ds-settings-text' }, [
        txt('div', 'ds-settings-label', label),
        hint ? txt('div', 'ds-scr-muted', hint) : null
      ]),
      control
    ]);
  }

  function toggleControl(key, on, onchange) {
    const btn = el('button', {
      class: 'ds-toggle' + (on ? ' ds-toggle-on' : ''),
      text: on ? 'On' : 'Off',
      'aria-pressed': on ? 'true' : 'false',
      onclick: function () {
        const next = !btn.classList.contains('ds-toggle-on');
        btn.classList.toggle('ds-toggle-on', next);
        btn.textContent = next ? 'On' : 'Off';
        btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        setSetting(key, next);
        if (onchange) onchange(next);
      }
    });
    return btn;
  }

  DS.ui.registerScreen('settings', {
    enter: function (params, root) {
      params = params || {};
      const back = params.back || 'menu';
      const page = el('div', { class: 'ds-scr-page ds-scr-settings' });
      root.appendChild(page);

      let speed = Number(setting('speed', 1)) || 1;
      const volume = Math.max(0, Math.min(1, Number(setting('volume', DS.audio ? DS.audio.volume : 0.7))));
      const muted = !!setting('muted', DS.audio ? !!DS.audio.muted : false);
      const music = !!setting('music', DS.audio ? DS.audio.music !== false : true);

      const volumeInput = el('input', {
        class: 'ds-slider',
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        value: Math.round(volume * 100),
        'aria-label': 'Volume'
      });
      volumeInput.addEventListener('input', function () {
        const v = Math.max(0, Math.min(1, Number(volumeInput.value) / 100));
        setSetting('volume', v);
        tryCall('volume', function () { if (DS.audio && typeof DS.audio.setVolume === 'function') DS.audio.setVolume(v); });
        volumeLabel.textContent = Math.round(v * 100) + '%';
      });
      const volumeLabel = txt('span', 'ds-scr-muted', Math.round(volume * 100) + '%');

      const muteToggle = toggleControl('muted', muted, function (on) {
        tryCall('mute', function () { if (DS.audio && typeof DS.audio.setMuted === 'function') DS.audio.setMuted(on); });
      });
      const musicToggle = toggleControl('music', music, function (on) {
        tryCall('music', function () { if (DS.audio && typeof DS.audio.setMusic === 'function') DS.audio.setMusic(on); });
      });
      const fullscreenOn = !!setting('fullscreen', false);
      const fsToggle = toggleControl('fullscreen', fullscreenOn, function (on) { applyFullscreen(on); });

      function render() {
        // Speed buttons re-render the page so the active choice updates; the other controls keep their state.
        clear(page);
        page.appendChild(pageHead('Settings', 'Saved on this device and applied straight away',
          el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go(back); } })));
        page.appendChild(txt('div', 'ds-scr-section', 'Gameplay'));
        page.appendChild(settingsRow('Game speed', 'Scales the pauses between enemy actions and animations.',
          el('div', { class: 'ds-scr-tabs' }, [1, 2, 3].map(function (n) {
            return el('button', {
              class: 'ds-btn' + (speed === n ? ' ds-btn-primary' : ''),
              text: n + '×',
              onclick: function () { speed = n; setSetting('speed', n); render(); }
            });
          }))));
        page.appendChild(settingsRow('Confirm before ending turn', 'Ask first when you still have playable cards and energy.',
          toggleControl('confirmEndTurn', !!setting('confirmEndTurn', false))));
        page.appendChild(settingsRow('Screen shake', 'Shake the screen on heavy hits.',
          toggleControl('screenShake', !!setting('screenShake', true))));
        page.appendChild(settingsRow('Show combat log', 'A panel listing what happened each turn.',
          toggleControl('showLog', !!setting('showLog', true))));
        page.appendChild(txt('div', 'ds-scr-section', 'Audio'));
        page.appendChild(settingsRow('Volume', null, el('div', { class: 'ds-settings-slider' }, [volumeInput, volumeLabel])));
        page.appendChild(settingsRow('Mute all sound', null, muteToggle));
        page.appendChild(settingsRow('Music', 'Ambient music under the sound effects.', musicToggle));
        page.appendChild(txt('div', 'ds-scr-section', 'Display'));
        page.appendChild(settingsRow('Fullscreen', 'Fill the screen. Escape also leaves it.', fsToggle));
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-primary', text: 'Done', onclick: function () { go(back); } })
        ]));
      }

      render();
    },
    exit: function () {}
  });

  /* ================================================================
   * history
   * ================================================================ */
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return tryCall('date', function () { return d.toLocaleDateString(); }, String(iso));
  }

  function confirmResetProgress(back) {
    let m = null;
    m = DS.ui.modal({
      title: 'Reset all progress?',
      content: '<div class="ds-scr-pick-desc">This erases run history, lifetime statistics, achievements and unlocked ascensions. Settings are kept.</div>',
      dismissable: true,
      buttons: [
        {
          label: 'Reset progress',
          danger: true,
          onclick: function () {
            if (m) m.close();
            tryCall('Meta.reset', function () { DS.Meta.reset(); });
            go('history', { back: back });
          }
        },
        { label: 'Cancel', primary: true, onclick: function () { if (m) m.close(); } }
      ]
    });
  }

  DS.ui.registerScreen('history', {
    enter: function (params, root) {
      params = params || {};
      const back = params.back || 'menu';
      const page = el('div', { class: 'ds-scr-page ds-scr-history' });
      root.appendChild(page);
      page.appendChild(pageHead('History', 'Lifetime statistics, past runs and achievements',
        el('button', { class: 'ds-btn', text: 'Back', onclick: function () { go(back); } })));
      const m = metaData();
      if (!m) {
        page.appendChild(txt('div', 'ds-scr-muted', 'Progress is not available in this build.'));
        return;
      }
      const runs = Number(m.runs) || 0;
      const wins = Number(m.wins) || 0;
      const rate = runs ? Math.round((wins / runs) * 100) + '%' : '—';
      const tile = function (label, value, sub) {
        return el('div', { class: 'ds-panel ds-stat-tile' }, [
          txt('div', 'ds-stat-value', value),
          txt('div', 'ds-stat-label', label),
          sub ? txt('div', 'ds-scr-muted', sub) : null
        ]);
      };

      page.appendChild(txt('div', 'ds-scr-section', 'Lifetime'));
      page.appendChild(el('div', { class: 'ds-stat-grid' }, [
        tile('Runs', String(runs)),
        tile('Wins', String(wins)),
        tile('Win rate', rate),
        tile('Best score', String(Number(m.bestScore) || 0))
      ]));

      page.appendChild(txt('div', 'ds-scr-section', 'Champions'));
      const per = m.perChar || {};
      page.appendChild(el('div', { class: 'ds-stat-grid' }, Object.keys(DS.characters || {}).map(function (id) {
        const c = DS.characters[id] || {};
        const p = per[id] || {};
        return tile((c.icon ? c.icon + ' ' : '') + (c.name || id),
          (Number(p.wins) || 0) + ' wins',
          (Number(p.runs) || 0) + ' runs · highest ascension won: ' + (Number(p.maxAscensionWon) || 0));
      })));

      page.appendChild(txt('div', 'ds-scr-section', 'Past runs'));
      const history = Array.isArray(m.history) ? m.history : [];
      page.appendChild(history.length
        ? el('div', { class: 'ds-history-list' }, history.map(function (h) {
          const c = defOf.character(h.character) || {};
          const cls = 'ds-history-row ' + (h.won ? 'ds-history-row-won' : 'ds-history-row-lost');
          return el('div', { class: cls }, [
            txt('div', 'ds-history-icon', c.icon || '👤'),
            el('div', { class: 'ds-history-main' }, [
              el('div', null, [
                txt('b', null, (h.won ? 'Victory' : 'Defeat') + ' · ' + (c.name || h.character || '?')),
                txt('span', 'ds-scr-muted', '  ' + fmtDate(h.date))
              ]),
              txt('div', 'ds-scr-muted', 'Act ' + (h.act || '?') + ' · Floor ' + (h.floor || 0) +
                ' · Ascension ' + (Number(h.ascension) || 0) + (h.turns ? ' · ' + h.turns + ' turns' : '') +
                (h.won ? '' : ' · ' + (h.killedBy ? 'Killed by ' + h.killedBy : 'Ended early')))
            ]),
            txt('div', 'ds-history-score', 'Score ' + (Number(h.score) || 0))
          ]);
        }))
        : txt('div', 'ds-scr-muted', 'No runs yet. Your first run will appear here.'));

      const achievements = hasMeta() && Array.isArray(DS.Meta.ACHIEVEMENTS) ? DS.Meta.ACHIEVEMENTS : [];
      const got = m.achievements || {};
      const unlockedCount = achievements.filter(function (a) { return !!got[a.id]; }).length;
      page.appendChild(txt('div', 'ds-scr-section', 'Achievements · ' + unlockedCount + ' / ' + achievements.length));
      page.appendChild(el('div', { class: 'ds-achievement-grid' }, achievements.map(function (a) {
        const when = got[a.id];
        return el('div', { class: 'ds-achievement' + (when ? '' : ' ds-achievement-locked') }, [
          txt('div', 'ds-scr-bigicon', a.icon || '🏅'),
          txt('b', null, a.name || a.id),
          txt('div', 'ds-scr-muted', a.desc || ''),
          when ? txt('div', 'ds-scr-muted', 'Unlocked ' + fmtDate(when)) : txt('div', 'ds-scr-muted', 'Locked')
        ]);
      })));

      if (hasMeta() && typeof DS.Meta.reset === 'function') {
        page.appendChild(el('div', { class: 'ds-scr-footer' }, [
          el('button', { class: 'ds-btn ds-btn-danger', text: 'Reset progress', onclick: function () { confirmResetProgress(back); } })
        ]));
      }
    },
    exit: function () {}
  });

})();
