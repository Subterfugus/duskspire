(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const SAVE_KEY = 'duskspire_save';
  const ROWS = 15;            // map rows 0..14; the boss sits one row beyond them
  const COLS = 7;             // columns 0..6
  const PATHS = 6;            // paths walked from row 0 to row 14
  const TREASURE_ROW = 8;
  const REST_ROW = 14;
  const BOSS_COL = 3;
  const MAX_FIRE_DEPTH = 6;   // guards relic trigger recursion (onGoldGained -> gold -> ...)
  const MAX_REPEAT = 50;
  const EASY_FIGHTS = 3;      // the first N normal fights of each act use the 'easy' tier
  const AMBUSH_CHANCE = 0.15; // event nodes that turn out to be a fight instead
  const DEFAULT_HP = 80;
  const DEFAULT_GOLD = 99;
  const RARITY_FALLBACK = ['common', 'uncommon', 'rare'];

  let fireDepth = 0;
  if (DS.run === undefined) DS.run = null;

  // ---------------------------------------------------------------------------
  // Plumbing
  // ---------------------------------------------------------------------------
  function warn(msg, e) {
    try { console.warn('[DS.Run] ' + msg, e === undefined ? '' : e); } catch (_) { /* no console */ }
  }

  function isThenable(x) {
    return !!x && typeof x.then === 'function';
  }

  function R() {
    return DS.run || null;
  }

  function emit(name, payload) {
    try {
      if (DS.events && typeof DS.events.emit === 'function') DS.events.emit(name, payload || {});
    } catch (e) {
      warn('listener failed for ' + name, e);
    }
  }

  function newUid() {
    if (typeof DS.uid === 'function') return DS.uid();
    return 'run' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  }

  function storage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function emptyStats() {
    return { fights: 0, elites: 0, bosses: 0, turns: 0, cardsPlayed: 0, damageDealt: 0, goldEarned: 0 };
  }

  // Wrapper over DS.rng that degrades to Math.random when core is absent.
  const rng = {
    next() {
      return DS.rng && typeof DS.rng.next === 'function' ? DS.rng.next() : Math.random();
    },
    int(min, max) {
      if (DS.rng && typeof DS.rng.int === 'function') return DS.rng.int(min, max);
      return min + Math.floor(Math.random() * (max - min + 1));
    },
    pick(arr) {
      if (!arr || !arr.length) return undefined;
      if (DS.rng && typeof DS.rng.pick === 'function') return DS.rng.pick(arr);
      return arr[Math.floor(Math.random() * arr.length)];
    },
    shuffle(arr) {
      if (DS.rng && typeof DS.rng.shuffle === 'function') return DS.rng.shuffle(arr);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },
    chance(p) {
      if (DS.rng && typeof DS.rng.chance === 'function') return DS.rng.chance(p);
      return Math.random() < p;
    },
  };

  // Runs a list of steps in order. A step may return a thenable (player choice,
  // custom async fn); the rest of the list then continues asynchronously. When no
  // step is async the whole list runs synchronously and returns undefined.
  function runSeq(items, start, step, label) {
    for (let i = start; i < items.length; i++) {
      let r;
      try {
        r = step(items[i]);
      } catch (e) {
        warn(label + ' failed', e);
        r = undefined;
      }
      if (isThenable(r)) {
        const next = i + 1;
        const cont = () => runSeq(items, next, step, label);
        return r.then(cont, (e) => { warn(label + ' failed', e); return cont(); });
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Registry / card / relic helpers
  // ---------------------------------------------------------------------------
  function cardDef(id) {
    return (DS.cards && DS.cards[id]) || null;
  }

  function cardData(inst) {
    if (!inst) return null;
    try {
      if (typeof DS.getCardData === 'function') {
        const d = DS.getCardData(inst);
        if (d) return d;
      }
    } catch (e) {
      warn('getCardData failed for ' + inst.id, e);
    }
    return cardDef(inst.id);
  }

  function typeOf(inst) {
    const d = cardData(inst);
    return d ? d.type : undefined;
  }

  function costOf(inst) {
    const d = cardData(inst);
    return d && typeof d.cost === 'number' ? d.cost : undefined;
  }

  function isUpgradeable(inst) {
    if (!inst || inst.upgraded) return false;
    const d = cardDef(inst.id);
    return !!(d && d.upgrade && d.type !== 'curse' && d.type !== 'status');
  }

  function safeCardPool(q) {
    try {
      return typeof DS.cardPool === 'function' ? (DS.cardPool(q) || []) : [];
    } catch (e) {
      warn('cardPool failed', e);
      return [];
    }
  }

  function safeRelicPool(q) {
    try {
      return typeof DS.relicPool === 'function' ? (DS.relicPool(q) || []) : [];
    } catch (e) {
      warn('relicPool failed', e);
      return [];
    }
  }

  function potionDefs() {
    return Object.values(DS.potions || {}).filter((p) => p && p.id);
  }

  function actMatches(act, n) {
    if (act === undefined || act === null || act === 'any') return true;
    if (Array.isArray(act)) return act.some((a) => Number(a) === Number(n));
    return Number(act) === Number(n);
  }

  function hasRelic(id) {
    const run = R();
    return !!(run && run.relics.some((r) => r.id === id));
  }

  function ownedRelicSet() {
    const run = R();
    return new Set(run ? run.relics.map((r) => r.id) : []);
  }

  function rarityOrder(first) {
    const out = [];
    for (const r of [first].concat(RARITY_FALLBACK)) {
      if (r && !out.includes(r)) out.push(r);
    }
    return out;
  }

  // Card rarity odds 60 / 33 / 7.
  function cardRarityRoll() {
    const x = rng.next();
    return x < 0.60 ? 'common' : x < 0.93 ? 'uncommon' : 'rare';
  }

  // Relic rarity odds 50 / 33 / 17.
  function relicRarityRoll() {
    const x = rng.next();
    return x < 0.50 ? 'common' : x < 0.83 ? 'uncommon' : 'rare';
  }

  // Potion rarity odds 65 / 25 / 10.
  function potionRarityRoll() {
    const x = rng.next();
    return x < 0.65 ? 'common' : x < 0.90 ? 'uncommon' : 'rare';
  }

  // Picks a card def. filter: {class, type}; rarities: ordered list tried first;
  // exclude: Set of ids. Falls back to any allowed rarity in the class.
  // Starter, special, curse and status cards are only eligible when the class
  // itself is 'curse' or 'status'.
  function randomCardDef(filter, rarities, exclude) {
    const f = filter || {};
    const ex = exclude || new Set();
    const special = f.class === 'curse' || f.class === 'status';
    const ok = (d) => {
      if (!d || !d.id || ex.has(d.id)) return false;
      if (f.type && d.type !== f.type) return false;
      if (!special) {
        if (d.rarity === 'starter' || d.rarity === 'special') return false;
        if (d.type === 'curse' || d.type === 'status') return false;
      }
      return true;
    };
    const query = (rarity) => {
      const q = {};
      if (f.class !== undefined) q.class = f.class;
      if (rarity) q.rarity = rarity;
      if (f.type) q.type = f.type;
      return q;
    };
    for (const r of rarities || []) {
      const arr = safeCardPool(query(r)).filter(ok);
      if (arr.length) return rng.pick(arr);
    }
    const any = safeCardPool(query(null)).filter(ok);
    return any.length ? rng.pick(any) : null;
  }

  // Picks a relic id of the first rarity that has an unowned option.
  function randomRelicId(rarities, exclude) {
    const run = R();
    const ex = exclude || new Set();
    const owned = ownedRelicSet();
    for (const r of rarities || []) {
      const q = { rarity: r };
      if (run && run.character !== undefined) q.class = run.character;
      const arr = safeRelicPool(q).filter((d) => d && d.id && !owned.has(d.id) && !ex.has(d.id));
      if (arr.length) return rng.pick(arr).id;
    }
    return null;
  }

  function randomPotionId(rarities, exclude) {
    const ex = exclude || new Set();
    const all = potionDefs().filter((p) => !ex.has(p.id));
    for (const r of rarities || []) {
      const arr = all.filter((p) => (p.rarity || 'common') === r);
      if (arr.length) return rng.pick(arr).id;
    }
    return all.length ? rng.pick(all).id : null;
  }

  // When a tier is empty for the act, try the nearest tiers first, then any non-boss
  // encounter of the act, then any encounter at all.
  const TIER_FALLBACK = {
    easy: ['easy', 'normal'],
    normal: ['normal', 'easy'],
    elite: ['elite', 'normal', 'easy'],
    boss: ['boss'],
  };

  function pickEncounter(act, tier, avoidLast) {
    const all = Object.values(DS.encounters || {}).filter((e) => e && e.id);
    const inAct = all.filter((e) => Number(e.act) === Number(act));
    let pool = [];
    for (const t of TIER_FALLBACK[tier] || [tier]) {
      pool = inAct.filter((e) => e.tier === t);
      if (pool.length) break;
    }
    if (!pool.length) pool = inAct.filter((e) => e.tier !== 'boss');
    if (!pool.length) pool = inAct;
    if (!pool.length) pool = all;
    if (!pool.length) return null;
    const run = R();
    if (avoidLast && run && run.lastEncounter) {
      const fresh = pool.filter((e) => e.id !== run.lastEncounter);
      if (fresh.length) pool = fresh;
    }
    return rng.pick(pool).id;
  }

  // Tier for the next normal fight of the current act; advances the act counter.
  function fightTier() {
    const run = R();
    const n = run ? (run.actFights || 0) : 0;
    if (run) run.actFights = n + 1;
    return n < EASY_FIGHTS ? 'easy' : 'normal';
  }

  function pickEvent() {
    const run = R();
    if (!run) return null;
    const all = Object.values(DS.events_ || {}).filter((e) => e && e.id);
    const valid = all.filter((e) => actMatches(e.act, run.act));
    if (!valid.length) return null;
    let fresh = valid.filter((e) => !run.usedEvents.includes(e.id));
    if (!fresh.length) {
      // Pool exhausted: start a new cycle, avoiding an immediate repeat when possible.
      run.usedEvents = [];
      fresh = valid.filter((e) => e.id !== run.lastEvent);
      if (!fresh.length) fresh = valid;
    }
    const pick = rng.pick(fresh);
    run.usedEvents.push(pick.id);
    run.lastEvent = pick.id;
    return pick.id;
  }

  // ---------------------------------------------------------------------------
  // Map generation
  // ---------------------------------------------------------------------------
  function weightedNodeType(row) {
    const opts = [['fight', 45], ['event', 22], ['shop', 9]];
    if (row >= 5) opts.push(['elite', 12]);
    if (row >= 5 && row !== REST_ROW - 1) opts.push(['rest', 12]);
    const total = opts.reduce((s, o) => s + o[1], 0);
    let x = rng.next() * total;
    for (const [type, w] of opts) {
      if (x < w) return type;
      x -= w;
    }
    return 'fight';
  }

  function generateMap(act) {
    const nodes = {};
    const rows = [];
    const rowEdges = [];
    for (let r = 0; r < ROWS; r++) {
      rows.push([]);
      rowEdges.push([]);
    }
    const idOf = (r, c) => 'a' + act + '_r' + r + 'c' + c;

    const ensure = (r, c) => {
      const id = idOf(r, c);
      if (!nodes[id]) {
        nodes[id] = { id, row: r, col: c, type: 'fight', next: [], visited: false };
        rows[r].push(id);
      }
      return id;
    };

    // Two edges between the same pair of rows cross when their column order flips.
    const crosses = (r, c1, c2) => rowEdges[r].some(([x, y]) => (x - c1) * (y - c2) < 0);

    const link = (r, c1, c2) => {
      const from = nodes[idOf(r, c1)];
      const to = idOf(r + 1, c2);
      if (!from.next.includes(to)) from.next.push(to);
      if (!rowEdges[r].some(([x, y]) => x === c1 && y === c2)) rowEdges[r].push([c1, c2]);
    };

    // Six paths, each starting in a distinct column of row 0 and walking up to row 14.
    const starts = rng.shuffle(Array.from({ length: COLS }, (_, i) => i)).slice(0, PATHS);
    for (const c0 of starts) {
      let c = c0;
      ensure(0, c);
      for (let r = 0; r < REST_ROW; r++) {
        const opts = [c - 1, c, c + 1].filter((x) => x >= 0 && x < COLS);
        rng.shuffle(opts);
        let pick = opts.find((x) => !crosses(r, c, x));
        if (pick === undefined) pick = opts[0];
        ensure(r + 1, pick);
        link(r, c, pick);
        c = pick;
      }
    }

    // Single boss node that every row-14 node leads into.
    const bossId = 'a' + act + '_boss';
    nodes[bossId] = { id: bossId, row: ROWS, col: BOSS_COL, type: 'boss', next: [], visited: false };
    for (const id of rows[REST_ROW]) nodes[id].next = [bossId];

    for (const row of rows) row.sort((a, b) => nodes[a].col - nodes[b].col);

    // Room types.
    const all = [];
    for (const row of rows) for (const id of row) all.push(nodes[id]);
    for (const n of all) {
      if (n.row === 0) n.type = 'fight';
      else if (n.row === TREASURE_ROW) n.type = 'treasure';
      else if (n.row === REST_ROW) n.type = 'rest';
      else n.type = weightedNodeType(n.row);
    }

    // Guarantees: at least one shop, at least two elites.
    const midRow = (n) => n.row >= 1 && n.row <= ROWS - 2 && n.row !== TREASURE_ROW;
    const plain = (n) => n.type === 'fight' || n.type === 'event';
    if (!all.some((n) => n.type === 'shop')) {
      const c = all.filter((n) => midRow(n) && plain(n));
      if (c.length) rng.pick(c).type = 'shop';
    }
    let elites = all.filter((n) => n.type === 'elite').length;
    let guard = 0;
    while (elites < 2 && guard++ < 100) {
      const c = all.filter((n) => n.row >= 5 && midRow(n) && plain(n));
      if (!c.length) break;
      rng.pick(c).type = 'elite';
      elites++;
    }

    return { nodes, rows, bossId };
  }

  // ---------------------------------------------------------------------------
  // Rewards and shop generation
  // ---------------------------------------------------------------------------
  function rollCardChoices(allRare, count, cls) {
    const used = new Set();
    const picks = [];
    const roll = () => (allRare ? ['rare'] : rarityOrder(cardRarityRoll()));

    for (let i = 0; i < count; i++) {
      const d = randomCardDef({ class: cls }, roll(), used);
      if (!d) break;
      used.add(d.id);
      picks.push({ id: d.id, upgraded: false });
    }

    // 10% chance that one choice is swapped for a colorless card.
    if (picks.length && rng.chance(0.10)) {
      const d = randomCardDef({ class: 'colorless' }, roll(), used);
      if (d) {
        const idx = rng.int(0, picks.length - 1);
        used.delete(picks[idx].id);
        picks[idx] = { id: d.id, upgraded: false };
        used.add(d.id);
      }
    }

    // Class pool exhausted: top up from colorless so the offer is not short.
    while (picks.length < count) {
      const d = randomCardDef({ class: 'colorless' }, roll(), used);
      if (!d) break;
      used.add(d.id);
      picks.push({ id: d.id, upgraded: false });
    }
    return picks;
  }

  function generateRewards(tier) {
    const run = R();
    const cls = run ? run.character : undefined;
    const t = tier === 'elite' || tier === 'boss' || tier === 'treasure' ? tier : 'normal';

    if (t === 'treasure') {
      return {
        gold: rng.int(15, 25),
        cardChoices: [],
        potion: null,
        relic: randomRelicId(rarityOrder(relicRarityRoll()), null),
      };
    }

    const gold = t === 'elite' ? rng.int(25, 35) : t === 'boss' ? rng.int(95, 105) : rng.int(10, 20);
    const cardChoices = rollCardChoices(t === 'boss', 3, cls);
    const potion = rng.chance(0.4) ? randomPotionId(rarityOrder(potionRarityRoll()), null) : null;
    const relic = t === 'elite' ? randomRelicId(rarityOrder(relicRarityRoll()), null) : null;
    return { gold, cardChoices, potion, relic };
  }

  function cardPrice(def) {
    const r = def && def.rarity;
    if (r === 'uncommon') return rng.int(68, 82);
    if (r === 'rare') return rng.int(135, 165);
    return rng.int(45, 55);
  }

  function relicPrice(id) {
    const d = DS.relics && DS.relics[id];
    const r = d && d.rarity;
    const base = r === 'uncommon' ? 250 : r === 'rare' ? 300 : 150;
    return Math.round(base * (0.95 + 0.10 * rng.next()));
  }

  function potionPrice(id) {
    const d = DS.potions && DS.potions[id];
    const r = d && d.rarity;
    return r === 'rare' ? 100 : r === 'uncommon' ? 75 : 50;
  }

  function makeShop() {
    const run = R();
    const cls = run ? run.character : undefined;
    const removePrice = 75 + 25 * (run ? run.removeCount || 0 : 0);

    // Cards: 5 class cards and 2 colorless cards.
    const usedCards = new Set();
    const cards = [];
    const addCardItem = (d) => {
      usedCards.add(d.id);
      cards.push({ inst: { id: d.id, upgraded: false }, price: cardPrice(d), sold: false });
    };
    for (let i = 0; i < 5; i++) {
      const d = randomCardDef({ class: cls }, rarityOrder(cardRarityRoll()), usedCards);
      if (d) addCardItem(d);
    }
    for (let i = 0; i < 2; i++) {
      const d = randomCardDef({ class: 'colorless' }, rarityOrder(cardRarityRoll()), usedCards);
      if (d) addCardItem(d);
    }

    // Relics: 3 total, one of rarity 'shop' when any exists.
    const usedRelics = new Set();
    const relics = [];
    const addRelicItem = (id) => {
      usedRelics.add(id);
      relics.push({ id, price: relicPrice(id), sold: false });
    };
    const shopRelic = randomRelicId(['shop'], usedRelics);
    if (shopRelic) addRelicItem(shopRelic);
    while (relics.length < 3) {
      const id = randomRelicId(rarityOrder(relicRarityRoll()), usedRelics);
      if (!id) break;
      addRelicItem(id);
    }

    // Potions: 3 distinct.
    const usedPotions = new Set();
    const potions = [];
    while (potions.length < 3) {
      const id = randomPotionId(rarityOrder(potionRarityRoll()), usedPotions);
      if (!id) break;
      usedPotions.add(id);
      potions.push({ id, price: potionPrice(id), sold: false });
    }

    return { cards, relics, potions, removePrice, removeUsed: false };
  }

  // ---------------------------------------------------------------------------
  // Deck helpers, choosers
  // ---------------------------------------------------------------------------
  function typeFilter(type) {
    if (!type) return () => true;
    return (inst) => typeOf(inst) === type;
  }

  async function chooseDeck(prompt, filter) {
    try {
      const h = DS.hooks && DS.hooks.chooseDeckCard;
      if (typeof h !== 'function') return null;
      const picked = await h({ prompt, filter });
      return picked || null;
    } catch (e) {
      warn('chooseDeckCard failed', e);
      return null;
    }
  }

  function freePotionSlot() {
    const run = R();
    if (!run) return -1;
    const slots = potionSlots();
    for (let i = 0; i < slots; i++) {
      if (run.potions[i] === null || run.potions[i] === undefined) return i;
    }
    return -1;
  }

  function potionSlots() {
    const run = R();
    let n = 3;
    if (run) {
      for (const r of run.relics) {
        const d = DS.relics && DS.relics[r.id];
        if (d && d.passive && typeof d.passive.potionSlots === 'number') n += d.passive.potionSlots;
      }
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Values and conditions
  // ---------------------------------------------------------------------------
  function sourceValue(v, ctx) {
    const run = R();
    switch (v) {
      case 'gold': return run ? run.gold : 0;
      case 'hp': return run ? run.hp : 0;
      case 'max_hp': return run ? run.maxHp : 0;
      case 'missing_hp': return run ? run.maxHp - run.hp : 0;
      case 'deck_size': return run ? run.deck.length : 0;
      case 'stacks': return ctx.stacks || 0;
      case 'x': return ctx.x || 0;
      default: return 0;
    }
  }

  // Resolves a number or a Value object {v, mul, add} at run level.
  function val(x, ctx) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    if (typeof x === 'string' && x.trim() !== '' && isFinite(Number(x))) return Number(x);
    if (!x || typeof x !== 'object' || !('v' in x)) return 0;
    const src = sourceValue(x.v, ctx || {});
    const mul = x.mul === undefined ? 1 : Number(x.mul);
    const add = x.add === undefined ? 0 : Number(x.add);
    return Math.floor(src * mul) + add;
  }

  function compare(a, cmp, b) {
    switch (cmp) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '==': return a === b;
      case '!=': return a !== b;
      default: return false;
    }
  }

  function condOk(cond) {
    if (!cond) return true;
    const run = R();
    if (!run) return false;
    if (cond.minGold != null && run.gold < cond.minGold) return false;
    if (cond.minHp != null && run.hp < cond.minHp) return false;
    if (cond.hasRelic != null && !hasRelic(cond.hasRelic)) return false;
    if (cond.hasCardType != null && !run.deck.some((i) => typeOf(i) === cond.hasCardType)) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Run-level effect interpreter
  // ---------------------------------------------------------------------------
  function asList(effects) {
    if (!effects) return [];
    return Array.isArray(effects) ? effects : [effects];
  }

  function execList(effects, ctx) {
    return runSeq(asList(effects), 0, (op) => execOp(op, ctx), 'effect');
  }

  function changeMaxHp(a) {
    const run = R();
    if (!run) return;
    run.maxHp = Math.max(1, run.maxHp + a);
    if (a > 0) run.hp += a;
    run.hp = Math.max(0, Math.min(run.hp, run.maxHp));
    touch();
  }

  function addCardOp(op, ctx) {
    const run = R();
    if (!run) return;
    const n = op.amount === undefined ? 1 : val(op.amount, ctx);
    for (let i = 0; i < n; i++) {
      let id = op.card;
      if (id === 'random') {
        const rar = op.rarity ? rarityOrder(op.rarity) : rarityOrder(cardRarityRoll());
        const d = randomCardDef({ class: op.class || run.character, type: op.type }, rar, null);
        if (!d) break;
        id = d.id;
      }
      if (typeof id === 'string') addCard(id, !!op.upgraded);
    }
  }

  function removeCardOp(op, ctx) {
    const run = R();
    if (!run) return undefined;
    const all = op.amount === 'all';
    const n = all ? Infinity : op.amount === undefined ? 1 : val(op.amount, ctx);
    const filter = typeFilter(op.type);
    if (op.random || all) {
      for (let i = 0; i < n; i++) {
        const cands = run.deck.filter(filter);
        if (!cands.length) break;
        removeCard(rng.pick(cands).uid);
      }
      return undefined;
    }
    return (async () => {
      for (let i = 0; i < n; i++) {
        if (!R() || !R().deck.length) break;
        const inst = await chooseDeck('Choose a card to remove.', filter);
        if (!inst || !removeCard(inst.uid)) break;
      }
    })();
  }

  function upgradeCardOp(op, ctx) {
    const run = R();
    if (!run) return undefined;
    if (op.amount === 'all') {
      for (const inst of run.deck.slice()) {
        if (isUpgradeable(inst)) upgradeCard(inst.uid);
      }
      return undefined;
    }
    const n = op.amount === undefined ? 1 : val(op.amount, ctx);
    if (op.random) {
      for (let i = 0; i < n; i++) {
        const cands = run.deck.filter((inst) => isUpgradeable(inst));
        if (!cands.length) break;
        upgradeCard(rng.pick(cands).uid);
      }
      return undefined;
    }
    return (async () => {
      for (let i = 0; i < n; i++) {
        const inst = await chooseDeck('Choose a card to upgrade.', (c) => isUpgradeable(c));
        if (!inst || !upgradeCard(inst.uid)) break;
      }
    })();
  }

  function transformCardOp(op, ctx) {
    const run = R();
    if (!run) return undefined;
    const n = op.amount === undefined ? 1 : val(op.amount, ctx);
    const transformOne = (inst) => {
      const d = randomCardDef({ class: run.character }, rarityOrder(cardRarityRoll()), new Set([inst.id]));
      if (!d) return false;
      removeCard(inst.uid);
      addCard(d.id, false);
      return true;
    };
    if (op.random) {
      for (let i = 0; i < n; i++) {
        if (!run.deck.length) break;
        if (!transformOne(rng.pick(run.deck))) break;
      }
      return undefined;
    }
    return (async () => {
      for (let i = 0; i < n; i++) {
        const inst = await chooseDeck('Choose a card to transform.', typeFilter(null));
        if (!inst || !transformOne(inst)) break;
      }
    })();
  }

  function chanceOp(op, ctx) {
    const p = val(op.p, ctx);
    const hit = rng.chance(p);
    if (hit && op.thenResult !== undefined) ctx.resultText = op.thenResult;
    if (!hit && op.elseResult !== undefined) ctx.resultText = op.elseResult;
    return execList(hit ? op.then : op.else, ctx);
  }

  function execOp(op, ctx) {
    if (!op || typeof op !== 'object') return undefined;
    const run = R();
    switch (op.op) {
      case 'gold':
        addGold(val(op.amount, ctx));
        return undefined;
      case 'heal':
        if (run) {
          run.hp = Math.min(run.maxHp, run.hp + val(op.amount, ctx));
          touch();
        }
        return undefined;
      case 'lose_hp':
        if (run) {
          run.hp = Math.max(0, run.hp - val(op.amount, ctx));
          touch();
        }
        return undefined;
      case 'max_hp':
        changeMaxHp(val(op.amount, ctx));
        return undefined;
      case 'add_card':
        addCardOp(op, ctx);
        return undefined;
      case 'remove_card':
        return removeCardOp(op, ctx);
      case 'upgrade_card':
        return upgradeCardOp(op, ctx);
      case 'transform_card':
        return transformCardOp(op, ctx);
      case 'add_relic': {
        let id = op.relic;
        if (id === 'random') {
          const rar = op.rarity ? rarityOrder(op.rarity) : rarityOrder(relicRarityRoll());
          id = randomRelicId(rar, null);
        }
        if (id) addRelic(id);
        return undefined;
      }
      case 'add_potion': {
        let id = op.potion;
        if (id === 'random') id = randomPotionId(rarityOrder(potionRarityRoll()), null);
        if (id) addPotion(id);
        return undefined;
      }
      case 'chance':
        return chanceOp(op, ctx);
      case 'fight': {
        let id = op.encounter;
        if (!id) id = pickEncounter(run ? run.act : 1, 'normal', true);
        if (id) ctx.fightEncounterId = id;
        return undefined;
      }
      case 'custom': {
        if (typeof op.fn !== 'function') return undefined;
        const r = op.fn({ run, ctx });
        return isThenable(r) ? r : undefined;
      }
      case 'repeat': {
        const times = Math.min(MAX_REPEAT, Math.max(0, Math.floor(val(op.times, ctx))));
        const body = asList(op.effects);
        let list = [];
        for (let i = 0; i < times; i++) list = list.concat(body);
        return runSeq(list, 0, (o) => execOp(o, ctx), 'effect');
      }
      case 'if': {
        const c = op.cond || {};
        const ok = compare(val(c.left, ctx), c.cmp, val(c.right, ctx));
        return execList(ok ? op.then : op.else, ctx);
      }
      default:
        warn('unknown run-level op: ' + op.op);
        return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Run-level relic triggers
  // ---------------------------------------------------------------------------
  function matchWhen(when, ctx) {
    if (!when) return true;
    const run = R();
    if (when.roomType !== undefined && ctx.roomType !== when.roomType) return false;
    if (when.cardType !== undefined) {
      let ct = ctx.cardType;
      if (ct === undefined && ctx.card !== undefined) {
        ct = typeOf(typeof ctx.card === 'string' ? { id: ctx.card, upgraded: false } : ctx.card);
      }
      if (ct !== when.cardType) return false;
    }
    if (when.costAtLeast !== undefined) {
      let cost = ctx.cost;
      if (cost === undefined && ctx.card !== undefined) {
        cost = costOf(typeof ctx.card === 'string' ? { id: ctx.card, upgraded: false } : ctx.card);
      }
      if (typeof cost !== 'number' || cost < when.costAtLeast) return false;
    }
    if ((when.hpBelowPct !== undefined || when.hpAbovePct !== undefined) && run) {
      const pct = run.maxHp > 0 ? (run.hp / run.maxHp) * 100 : 0;
      if (when.hpBelowPct !== undefined && !(pct < when.hpBelowPct)) return false;
      if (when.hpAbovePct !== undefined && !(pct > when.hpAbovePct)) return false;
    }
    if (when.turn !== undefined && ctx.turn !== when.turn) return false;
    return true;
  }

  function applyTrigger(entry, name, ctx) {
    const run = R();
    if (!run) return undefined;
    const rel = entry.rel;
    const t = entry.t;
    let effects = t;
    let when;
    let every;
    let once = false;
    if (t && !Array.isArray(t) && typeof t === 'object') {
      effects = t.effects;
      when = t.when;
      every = t.every;
      once = !!(t.oncePerTurn || t.oncePerCombat);
    }
    if (!matchWhen(when, ctx)) return undefined;

    let stacks = rel.counter || 0;
    if (every) {
      // The relic's counter shows progress toward the next firing (0 .. every-1).
      const c = (rel.counter || 0) + 1;
      if (c < every) {
        rel.counter = c;
        return undefined;
      }
      rel.counter = 0;
      stacks = c;
    }
    if (once) {
      // No combat exists at run level, so these flags are per room.
      run.roomFired = run.roomFired || {};
      const key = rel.id + ':' + name;
      if (run.roomFired[key]) return undefined;
      run.roomFired[key] = true;
    }
    return execList(effects, Object.assign({}, ctx, { stacks, relicId: rel.id }));
  }

  function runEntries(entries, name, ctx) {
    fireDepth++;
    try {
      return runSeq(entries, 0, (en) => applyTrigger(en, name, ctx), 'relic trigger ' + name);
    } finally {
      fireDepth--;
    }
  }

  function fire(name, ctx) {
    const run = R();
    if (!run || fireDepth >= MAX_FIRE_DEPTH) return undefined;
    const entries = [];
    for (const rel of run.relics) {
      const def = DS.relics && DS.relics[rel.id];
      const t = def && def.triggers ? def.triggers[name] : undefined;
      if (t !== undefined && t !== null) entries.push({ rel, t });
    }
    if (!entries.length) return undefined;
    const r = runEntries(entries, name, ctx || {});
    // Relic counters (every: N) may have changed even when no effect ran.
    touch();
    return r;
  }

  // ---------------------------------------------------------------------------
  // Persistence and mutation plumbing
  // ---------------------------------------------------------------------------
  function isValidRun(o) {
    return !!(o && typeof o === 'object' && typeof o.hp === 'number' &&
      o.map && o.map.nodes && Array.isArray(o.map.rows) &&
      Array.isArray(o.deck) && Array.isArray(o.relics));
  }

  function normalizeRun(o) {
    o.stats = Object.assign(emptyStats(), o.stats || {});
    if (!Array.isArray(o.deck)) o.deck = [];
    if (!Array.isArray(o.relics)) o.relics = [];
    o.relics.forEach((r) => { if (typeof r.counter !== 'number') r.counter = 0; });
    if (!Array.isArray(o.potions)) o.potions = [null, null, null];
    if (typeof o.gold !== 'number') o.gold = 0;
    if (typeof o.maxHp !== 'number') o.maxHp = Math.max(1, o.hp || 1);
    if (typeof o.act !== 'number') o.act = 1;
    if (typeof o.floor !== 'number') o.floor = 0;
    if (o.nodeId === undefined) o.nodeId = null;
    if (typeof o.removeCount !== 'number') o.removeCount = 0;
    if (!Array.isArray(o.usedEvents)) o.usedEvents = [];
    if (o.lastEvent === undefined) o.lastEvent = null;
    if (typeof o.actFights !== 'number') o.actFights = 0;
    if (o.lastEncounter === undefined) o.lastEncounter = null;
    if (o.shop === undefined) o.shop = null;
    if (!o.roomFired || typeof o.roomFired !== 'object') o.roomFired = {};
    o.pending = null;
    o.over = !!o.over;
    o.won = !!o.won;
    return o;
  }

  // While a fight is pending (entered but not won), the save holds the run as it was before that
  // room was entered. Continue then restarts the fight from the map instead of skipping it.
  function saveView(run) {
    const p = run.pending;
    return p && p.snapshot ? p.snapshot : run;
  }

  function snapshotRun(run) {
    return JSON.parse(JSON.stringify(Object.assign({}, run, { pending: null })));
  }

  function save() {
    const run = R();
    if (!run || run.over) return false;
    const s = storage();
    if (!s) return false;
    try {
      s.setItem(SAVE_KEY, JSON.stringify(saveView(run)));
      return true;
    } catch (e) {
      warn('save failed', e);
      return false;
    }
  }

  function readSave() {
    const s = storage();
    if (!s) return null;
    try {
      const raw = s.getItem(SAVE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!isValidRun(o) || o.over) return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function clearSave() {
    const s = storage();
    if (!s) return;
    try {
      s.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
  }

  // Every state change goes through here: auto-save while the run is live, then notify the UI.
  function touch() {
    const run = R();
    if (run && !run.over) save();
    emit('run:update', {});
  }

  // ---------------------------------------------------------------------------
  // Run lifecycle
  // ---------------------------------------------------------------------------
  // Stops a fight that is still running (the player left it through the menu) before the run it
  // belongs to is replaced. The combat unwinds quietly: nothing is resolved or rewarded.
  function stopActiveCombat() {
    const c = DS.combat;
    DS.combat = null;
    if (c && typeof c.abandon === 'function') {
      try { c.abandon(); } catch (e) { warn('abandon failed', e); }
    }
  }

  // Called by the combat engine when a fight is won: the room counts as done and the run is saved.
  function settleRoom(target) {
    const run = target || R();
    if (!run || !run.pending) return;
    run.pending = null;
    if (run === R()) touch();
  }

  function start(characterId, seed) {
    stopActiveCombat();
    const n = Number(seed);
    const hasSeed = seed !== undefined && seed !== null && seed !== '' && isFinite(n);
    const s = hasSeed ? Math.floor(n) : Math.floor(Math.random() * 2147483646) + 1;
    if (DS.rng && typeof DS.rng.seed === 'function') DS.rng.seed(s);

    const ch = (DS.characters && DS.characters[characterId]) || null;
    if (!ch) warn('unknown character "' + characterId + '"');
    const hp = ch && ch.hp > 0 ? ch.hp : DEFAULT_HP;
    const gold = ch && typeof ch.gold === 'number' ? ch.gold : DEFAULT_GOLD;

    DS.run = {
      character: characterId,
      hp,
      maxHp: hp,
      gold,
      deck: [],
      relics: [],
      potions: [null, null, null],
      act: 1,
      floor: 0,
      map: null,
      nodeId: null,
      seed: s,
      stats: emptyStats(),
      over: false,
      won: false,
      removeCount: 0,
      usedEvents: [],
      lastEvent: null,
      actFights: 0,
      lastEncounter: null,
      shop: null,
      roomFired: {},
      pending: null,
    };
    const run = DS.run;
    run.map = generateMap(1);

    const starter = ch && Array.isArray(ch.starterDeck) ? ch.starterDeck : [];
    for (const id of starter) run.deck.push({ uid: newUid(), id, upgraded: false });
    if (ch && ch.starterRelic) addRelic(ch.starterRelic);

    touch();
    return run;
  }

  function nextAct() {
    const run = R();
    if (!run) return false;
    if (run.act >= 3) {
      run.won = true;
      touch();
      return false;
    }
    run.act += 1;
    run.hp = run.maxHp;
    run.map = generateMap(run.act);
    run.nodeId = null;
    run.actFights = 0;
    run.shop = null;
    run.roomFired = {};
    touch();
    return true;
  }

  function end(won) {
    const run = R();
    if (!run) return;
    run.over = true;
    run.won = !!won;
    clearSave();
    emit('run:update', {});
  }

  function load() {
    const o = readSave();
    if (!o) return false;
    stopActiveCombat();
    DS.run = normalizeRun(o);
    emit('run:update', {});
    return true;
  }

  function hasSave() {
    return readSave() !== null;
  }

  // ---------------------------------------------------------------------------
  // Map navigation
  // ---------------------------------------------------------------------------
  function availableNodes() {
    const run = R();
    if (!run || !run.map) return [];
    const nodes = run.map.nodes;
    if (run.nodeId === null || run.nodeId === undefined) {
      return (run.map.rows[0] || []).map((id) => nodes[id]).filter(Boolean);
    }
    const cur = nodes[run.nodeId];
    if (!cur) return [];
    return (cur.next || []).map((id) => nodes[id]).filter((n) => n && !n.visited);
  }

  function enterNode(nodeId) {
    const run = R();
    if (!run || !run.map) return null;
    const node = run.map.nodes[nodeId];
    if (!node || !availableNodes().some((n) => n.id === nodeId)) {
      warn('node not available: ' + nodeId);
      return null;
    }
    const before = snapshotRun(run);
    node.visited = true;
    run.nodeId = nodeId;
    run.floor = (run.floor || 0) + 1;
    run.roomFired = {};
    run.shop = null;

    // Event nodes have a chance to be an ambush fight instead.
    let kind = node.type;
    let eventId = null;
    if (kind === 'event') {
      if (rng.chance(AMBUSH_CHANCE)) {
        kind = 'fight';
      } else {
        eventId = pickEvent();
        if (!eventId) kind = 'fight';
      }
    }

    fire('onRoomEnter', { roomType: kind });

    let room;
    if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
      const tier = kind === 'fight' ? fightTier() : kind;
      const encounterId = pickEncounter(run.act, tier, true);
      if (encounterId) {
        run.lastEncounter = encounterId;
        run.stats.fights = (run.stats.fights || 0) + 1;
        if (kind === 'elite') run.stats.elites = (run.stats.elites || 0) + 1;
        if (kind === 'boss') run.stats.bosses = (run.stats.bosses || 0) + 1;
        room = { type: 'combat', encounterId, tier };
      } else {
        warn('no encounters defined; room falls back to rest');
        room = { type: 'rest' };
      }
    } else if (kind === 'event') {
      room = { type: 'event', eventId };
    } else if (kind === 'shop') {
      const shop = makeShop();
      run.shop = shop;
      room = { type: 'shop', shop };
      fire('onShopEnter', {});
    } else if (kind === 'treasure') {
      const rw = generateRewards('treasure');
      room = { type: 'treasure', relicId: rw.relic, gold: rw.gold };
      fire('onChestOpen', { relicId: rw.relic, gold: rw.gold });
    } else {
      room = { type: 'rest' };
    }

    // A fight stays pending until it is won (see settleRoom); other rooms are final on entry.
    run.pending = room.type === 'combat' ? { nodeId, snapshot: before } : null;
    touch();
    return room;
  }

  // ---------------------------------------------------------------------------
  // Economy and deck
  // ---------------------------------------------------------------------------
  function addGold(n) {
    const run = R();
    if (!run) return 0;
    const amt = Math.trunc(Number(n) || 0);
    const before = run.gold;
    run.gold = Math.max(0, run.gold + amt);
    if (amt > 0) run.stats.goldEarned = (run.stats.goldEarned || 0) + amt;
    if (run.gold !== before) emit('run:gold', { amount: run.gold - before });
    if (amt > 0) fire('onGoldGained', { amount: amt });
    touch();
    return run.gold;
  }

  function addCard(id, upgraded) {
    const run = R();
    if (!run) return null;
    if (!cardDef(id)) warn('unknown card id ' + id);
    const inst = { uid: newUid(), id, upgraded: !!upgraded };
    run.deck.push(inst);
    emit('run:card', { id });
    fire('onCardAdded', { card: inst, cardType: typeOf(inst), cost: costOf(inst) });
    touch();
    return inst;
  }

  function removeCard(uid) {
    const run = R();
    if (!run) return false;
    const i = run.deck.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    const removed = run.deck.splice(i, 1)[0];
    emit('run:card', { id: removed.id });
    touch();
    return true;
  }

  function upgradeCard(uid) {
    const run = R();
    if (!run) return false;
    const inst = run.deck.find((c) => c.uid === uid);
    if (!inst || !isUpgradeable(inst)) return false;
    inst.upgraded = true;
    emit('run:card', { id: inst.id });
    touch();
    return true;
  }

  function addRelic(id) {
    const run = R();
    if (!run || !id || hasRelic(id)) return false;
    const def = DS.relics && DS.relics[id];
    if (!def) warn('unknown relic id ' + id);
    const entry = { id, counter: 0 };
    run.relics.push(entry);
    emit('run:relic', { id });
    if (def && def.triggers && def.triggers.onPickup) {
      runEntries([{ rel: entry, t: def.triggers.onPickup }], 'onPickup', { relicId: id });
    }
    touch();
    return true;
  }

  function addPotion(id) {
    const run = R();
    if (!run || !id) return false;
    const slots = potionSlots();
    while (run.potions.length < slots) run.potions.push(null);
    const idx = freePotionSlot();
    if (idx < 0) return false;
    run.potions[idx] = id;
    touch();
    return true;
  }

  function discardPotion(slot) {
    const run = R();
    if (!run || slot < 0 || slot >= run.potions.length) return;
    run.potions[slot] = null;
    touch();
  }

  function rest() {
    const run = R();
    if (!run) return 0;
    const heal = Math.floor(run.maxHp * 0.3);
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + heal);
    const healed = run.hp - before;
    fire('onRest', {});
    touch();
    return healed;
  }

  function getShop() {
    const run = R();
    return run ? run.shop : null;
  }

  function buy(kind, index) {
    const run = R();
    const shop = run && run.shop;
    if (!run || !shop) return false;
    const list = kind === 'card' ? shop.cards : kind === 'relic' ? shop.relics : kind === 'potion' ? shop.potions : null;
    const item = list ? list[index] : null;
    if (!item || item.sold) return false;
    if (run.gold < item.price) return false;
    if (kind === 'relic' && hasRelic(item.id)) return false;
    if (kind === 'potion' && freePotionSlot() < 0) return false;

    run.gold -= item.price;
    item.sold = true;
    emit('run:gold', { amount: -item.price });
    if (kind === 'card') addCard(item.inst.id, item.inst.upgraded);
    else if (kind === 'relic') addRelic(item.id);
    else addPotion(item.id);
    touch();
    return true;
  }

  function shopRemove(uid) {
    const run = R();
    const shop = run && run.shop;
    if (!run || !shop || shop.removeUsed) return false;
    const idx = run.deck.findIndex((c) => c.uid === uid);
    if (idx < 0) return false;
    const price = shop.removePrice;
    if (run.gold < price) return false;

    run.gold -= price;
    run.deck.splice(idx, 1);
    run.removeCount = (run.removeCount || 0) + 1;
    shop.removeUsed = true;
    shop.removePrice = 75 + 25 * run.removeCount;
    emit('run:gold', { amount: -price });
    touch();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Rewards and bosses
  // ---------------------------------------------------------------------------
  function bossRelicChoices() {
    const run = R();
    if (!run) return [];
    const out = [];
    const owned = ownedRelicSet();
    for (const rar of ['boss', 'rare', 'uncommon', 'common']) {
      if (out.length >= 3) break;
      const q = { rarity: rar };
      if (run.character !== undefined) q.class = run.character;
      const cands = safeRelicPool(q)
        .filter((d) => d && d.id && !owned.has(d.id) && !out.includes(d.id))
        .map((d) => d.id);
      rng.shuffle(cands);
      for (const id of cands) {
        if (out.length >= 3) break;
        out.push(id);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function getEvent(eventId) {
    const def = (DS.events_ && DS.events_[eventId]) || null;
    if (!def) return { def: null, choices: [] };
    const choices = (def.choices || []).map((c, i) => ({
      label: c.label,
      enabled: condOk(c.cond),
      index: i,
    }));
    return { def, choices };
  }

  async function chooseEvent(eventId, index) {
    const run = R();
    const def = (DS.events_ && DS.events_[eventId]) || null;
    const choice = def && Array.isArray(def.choices) ? def.choices[index] : null;
    if (!run || !choice || !condOk(choice.cond)) {
      return { text: '', fightEncounterId: null, ok: false, dead: false };
    }
    const ctx = { event: eventId, resultText: null, fightEncounterId: null };
    const r = execList(choice.effects, ctx);
    if (isThenable(r)) await r;
    touch();
    const text = ctx.resultText !== null && ctx.resultText !== undefined ? ctx.resultText : (choice.result || '');
    return {
      text,
      fightEncounterId: ctx.fightEncounterId || null,
      ok: true,
      dead: run.hp <= 0,
    };
  }

  async function runEffects(effects, ctx) {
    const c = ctx || {};
    const r = execList(effects, c);
    if (isThenable(r)) await r;
    return c;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  DS.Run = {
    start,
    availableNodes,
    enterNode,
    generateRewards,
    addGold,
    addCard,
    removeCard,
    upgradeCard,
    addRelic,
    hasRelic,
    addPotion,
    discardPotion,
    potionSlots,
    buy,
    shopRemove,
    rest,
    getEvent,
    chooseEvent,
    runEffects,
    bossRelicChoices,
    nextAct,
    fire,
    save,
    load,
    hasSave,
    clearSave,
    end,
    getShop,
    settleRoom,
  };
})();
