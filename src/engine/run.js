(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  /*
   * DS.Run: run state, map, rooms, rewards, shop, rest, events, save/resume, ascension, score.
   * DS.Meta: persistent meta progression (history, seen compendium entries, achievements).
   *
   * ---------------------------------------------------------------------------------------------
   * ROOMS AND RESUME
   * ---------------------------------------------------------------------------------------------
   * run.room is the room the player is in, or null while they are on the map. It is saved with the run,
   * and any extra keys a screen stores under run.room (for example run.room.screen) are kept.
   * Room shapes (run.room):
   *   {type:'combat',    encounterId, tier, fromEvent, stage:'fight', resume?}
   *   {type:'reward',    tier:'normal'|'elite'|'boss', fromEvent, gold, cardChoices:[{id,upgraded}], potion, relic,
   *                      claimed:{gold,potion,relic,card}}
   *   {type:'event',     eventId}
   *   {type:'shop'}                                  (the stock is run.shop)
   *   {type:'rest', done?}                           done = true once the player rested or smithed
   *   {type:'treasure',  relicId, gold, bonus, claimed:{chest}}   bonus: null | {kind:'potion',id} | {kind:'gold',amount}
   *   {type:'bossrelic', choices:[relicId x3], claimed: relicId|null}
   * enterNode(id) returns a public copy: {type:'combat', encounterId, tier, fromEvent} | {type:'event', eventId}
   *   | {type:'shop', shop} | {type:'rest'} | {type:'treasure', relicId, gold, bonus}.
   *
   * DS.Run.resumeTarget() -> {screen, params} | null      (use on Continue, after load; null = show the map)
   *   combat    -> {screen:'combat',    params:{encounterId, tier, fromEvent}}
   *   event     -> {screen:'event',     params:{eventId}}
   *   shop      -> {screen:'shop',      params:{shop}}
   *   rest      -> {screen:'rest',      params:{}}                      (null once done)
   *   treasure  -> {screen:'treasure',  params:{relicId, gold, bonus}}   (null once the chest is claimed)
   *   reward    -> {screen:'reward',    params:{tier, fromEvent}}        (null once every line is claimed)
   *   bossrelic -> {screen:'bossrelic', params:{}}
   *   A boss node that was beaten with no room left also resumes as bossrelic (the act cannot be left otherwise).
   *
   * Rewards: DS.Run.generateRewards(tier) returns the SAME stock while the reward room is open:
   *   {tier, fromEvent, gold, cardChoices:[{id,upgraded}], potion, relic, claimed:{gold,potion,relic,card}}.
   *   DS.Run.claimReward(kind, arg) grants one line once and returns bool:
   *     'gold' | 'potion' | 'relic' (no arg); 'card' (arg = index into cardChoices, or null to skip).
   *   Treasure: claimReward('chest') grants gold, relic and bonus once.
   *   Boss relic: bossRelicChoices() returns the stored three; claimReward('boss', relicId) takes one.
   *   Shop: buy()/shopRemove() persist sold flags on run.shop. Rest: rest() and upgradeCard() close the rest.
   *   Event: chooseEvent(eventId, i) -> {text, fightEncounterId, fightTier, ok, dead}. A following fight turns the
   *   room into a combat room (fromEvent true, tier = fightTier) that resumes there.
   *   closeRoom(): call when leaving any room for the map (Continue / Leave). It refuses combat rooms and the
   *   boss reward/boss relic rooms (those leave through bossRelicChoices() and nextAct()).
   *
   * Atomic rooms: a combat room (and an event choice in progress) keeps room.resume, a snapshot of the run from
   * before the fight / choice. While it exists the save file holds that snapshot, so leaving mid-fight and
   * continuing restarts the fight from its starting state (no HP scumming) and leaving mid-choice re-offers the
   * event. settleRoom(run) is called by DS.Combat on a win and turns the combat room into a reward room.
   *
   * ---------------------------------------------------------------------------------------------
   * ASCENSION AND SCORE
   * ---------------------------------------------------------------------------------------------
   * DS.Run.start(characterId, {seed, ascension}) (a bare number is accepted as the seed). run.ascension is 0..10 and
   * run.difficulty = {ascension, enemyHpMul, enemyDmgMul, eliteHpMul, bossHpMul, healMul, goldMul, shopPriceMul,
   *   startCurses, restHealPct, lessRestHeal, actStartHpMul, potionSlotPenalty}. Combat applies enemyHpMul,
   * enemyDmgMul, eliteHpMul and bossHpMul to enemies at spawn. Run-side modifiers are applied here.
   * DS.Run.ASCENSIONS lists the 10 cumulative levels. DS.Run.score(run) returns a number.
   * DS.Run.restAmount() returns the HP a rest would heal right now (for previews).
   *
   * ---------------------------------------------------------------------------------------------
   * META
   * ---------------------------------------------------------------------------------------------
   * DS.Meta lives in localStorage 'duskspire_meta' (memory only when storage is missing). DS.Run.end(won)
   * records the run (history, totals, per-character wins, achievements). See DS.Meta below.
   */

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const SAVE_KEY = 'duskspire_save';
  const META_KEY = 'duskspire_meta';
  const ROWS = 15;            // map rows 0..14; the boss sits one row beyond them
  const COLS = 7;             // columns 0..6
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
  const MAX_ASCENSION = 10;
  const HISTORY_MAX = 50;
  const REST_PCT = 0.30;
  const TREASURE_POTION_CHANCE = 0.35;
  const TREASURE_GOLD_CHANCE = 0.25;

  // Map layouts, chosen per act from the run seed. 'standard' is the classic map.
  const LAYOUTS = {
    standard: { paths: 6, straight: 1 },  // six paths start in distinct columns
    dense: { paths: 7, straight: 1 },     // every column starts a path: busier map
    sparse: { paths: 3, straight: 2 },    // three paths that favour running straight up
  };
  const LAYOUT_NAMES = ['standard', 'dense', 'sparse'];

  // Ascension levels (cumulative). Level n applies every level 1..n.
  const ASCENSIONS = [
    { level: 1, name: 'Hardened Elites', desc: 'Elite enemies have 15% more max HP.' },
    { level: 2, name: 'Bloodthirst', desc: 'Enemies deal 10% more damage.' },
    { level: 3, name: 'Frugal Hearth', desc: 'Resting heals 25% of max HP instead of 30%.' },
    { level: 4, name: 'Cursed Start', desc: 'You begin the run with a random curse in your deck.' },
    { level: 5, name: "Guardian's Wrath", desc: 'Bosses have 20% more max HP.' },
    { level: 6, name: 'Lean Purse', desc: 'Fight rewards and treasure give 15% less gold.' },
    { level: 7, name: 'Inflation', desc: 'Shop prices are 10% higher.' },
    { level: 8, name: 'Thick Hides', desc: 'All enemies have 10% more max HP.' },
    { level: 9, name: 'Weary Road', desc: 'Each new act begins at 90% of max HP instead of full HP.' },
    { level: 10, name: 'Final Ordeal', desc: 'Enemies deal 10% more damage again, and you have one fewer potion slot.' },
  ];

  // Per-level modifiers. '*' keys multiply, 'add' keys add, restHealPct is replaced.
  const ASC_MODS = [
    null,
    { eliteHpMul: 1.15 },
    { enemyDmgMul: 1.10 },
    { restHealPct: 0.25 },
    { startCurses: 1 },
    { bossHpMul: 1.20 },
    { goldMul: 0.85 },
    { shopPriceMul: 1.10 },
    { enemyHpMul: 1.10 },
    { actStartHpMul: 0.90 },
    { enemyDmgMul: 1.10, potionSlotPenalty: 1 },
  ];
  const ADD_MODS = { startCurses: true, potionSlotPenalty: true };

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

  function plainObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function finiteNum(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function emptyStats() {
    return {
      fights: 0, elites: 0, bosses: 0, turns: 0, cardsPlayed: 0, damageDealt: 0, goldEarned: 0,
      maxGold: 0, maxRelics: 0,
    };
  }

  function clampAsc(n) {
    const v = Math.floor(Number(n));
    return isFinite(v) ? Math.max(0, Math.min(MAX_ASCENSION, v)) : 0;
  }

  function roundMul(x) {
    return Math.round(x * 10000) / 10000;
  }

  // Cumulative modifiers for an ascension level. Pure: depends only on the level.
  function difficultyFor(asc) {
    const n = clampAsc(asc);
    const d = {
      ascension: n,
      enemyHpMul: 1,
      enemyDmgMul: 1,
      eliteHpMul: 1,
      bossHpMul: 1,
      healMul: 1,
      goldMul: 1,
      shopPriceMul: 1,
      startCurses: 0,
      restHealPct: REST_PCT,
      lessRestHeal: n >= 3,
      actStartHpMul: 1,
      potionSlotPenalty: 0,
    };
    for (let lvl = 1; lvl <= n; lvl++) {
      const mod = ASC_MODS[lvl] || {};
      for (const key of Object.keys(mod)) {
        if (ADD_MODS[key]) d[key] += mod[key];
        else if (key === 'restHealPct') d[key] = mod[key];
        else d[key] = roundMul(d[key] * mod[key]);
      }
    }
    return d;
  }

  const BASE_DIFF = difficultyFor(0);

  function diff() {
    const run = R();
    return (run && run.difficulty) || BASE_DIFF;
  }

  function restPct() {
    const p = Number(diff().restHealPct);
    return p > 0 ? p : REST_PCT;
  }

  function goldScale(n) {
    return Math.max(0, Math.round(n * (diff().goldMul || 1)));
  }

  function shopScale(n) {
    return Math.max(1, Math.round(n * (diff().shopPriceMul || 1)));
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

  // A random curse id (any curse the content defines), or null.
  function randomCurseId() {
    const pool = Object.values(DS.cards || {}).filter((d) => d && d.id && d.type === 'curse');
    const pick = rng.pick(pool);
    return pick ? pick.id : null;
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

  // Combat tier used for rewards: easy counts as normal.
  function rewardTier(tier) {
    return tier === 'elite' || tier === 'boss' ? tier : 'normal';
  }

  function encounterTier(encounterId) {
    const def = DS.encounters && DS.encounters[encounterId];
    return def && def.tier === 'elite' ? 'elite' : def && def.tier === 'boss' ? 'boss' : 'normal';
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
    const layoutName = rng.pick(LAYOUT_NAMES) || 'standard';
    const layout = LAYOUTS[layoutName] || LAYOUTS.standard;
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

    // Paths, each starting in a distinct column of row 0 and walking up to row 14.
    const starts = rng.shuffle(Array.from({ length: COLS }, (_, i) => i)).slice(0, layout.paths);
    for (const c0 of starts) {
      let c = c0;
      ensure(0, c);
      for (let r = 0; r < REST_ROW; r++) {
        const opts = [c - 1, c, c + 1].filter((x) => x >= 0 && x < COLS);
        rng.shuffle(opts);
        if (layout.straight > 1 && opts.includes(c) && rng.chance(0.5)) {
          opts.splice(opts.indexOf(c), 1);
          opts.unshift(c);
        }
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

    return { nodes, rows, bossId, layout: layoutName };
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

  // Fresh roll of rewards for a tier. Does not store anything.
  function rollRewards(tier) {
    const run = R();
    const cls = run ? run.character : undefined;
    const t = tier === 'elite' || tier === 'boss' || tier === 'treasure' ? tier : 'normal';

    if (t === 'treasure') {
      const gold = goldScale(rng.int(15, 25));
      return {
        gold,
        cardChoices: [],
        potion: null,
        relic: randomRelicId(rarityOrder(relicRarityRoll()), null),
      };
    }

    const base = t === 'elite' ? rng.int(25, 35) : t === 'boss' ? rng.int(95, 105) : rng.int(10, 20);
    const gold = goldScale(base);
    const cardChoices = rollCardChoices(t === 'boss', 3, cls);
    const potion = rng.chance(0.4) ? randomPotionId(rarityOrder(potionRarityRoll()), null) : null;
    const relic = t === 'elite' ? randomRelicId(rarityOrder(relicRarityRoll()), null) : null;
    return { gold, cardChoices, potion, relic };
  }

  // Public: while a reward room is open this returns its stored stock (same every time, with claims);
  // otherwise a fresh roll.
  function generateRewards(tier) {
    const run = R();
    if (run && run.room && run.room.type === 'reward') return rewardView(run.room);
    return Object.assign(rollRewards(tier), {
      tier: rewardTier(tier),
      fromEvent: false,
      claimed: { gold: false, potion: false, relic: false, card: false },
    });
  }

  function rewardView(room) {
    return {
      tier: room.tier,
      fromEvent: !!room.fromEvent,
      gold: room.gold || 0,
      cardChoices: (room.cardChoices || []).map((c) => ({ id: c.id, upgraded: !!c.upgraded })),
      potion: room.potion || null,
      relic: room.relic || null,
      claimed: Object.assign({ gold: false, potion: false, relic: false, card: false }, room.claimed || {}),
    };
  }

  // Lines a reward room offers (only the ones that exist).
  function rewardLines(room) {
    const lines = [];
    if (room.gold > 0) lines.push('gold');
    if (room.potion) lines.push('potion');
    if (room.relic) lines.push('relic');
    if ((room.cardChoices || []).length) lines.push('card');
    return lines;
  }

  function rewardDone(room) {
    const c = room.claimed || {};
    return rewardLines(room).every((k) => !!c[k]);
  }

  function makeRewardRoom(tier, fromEvent) {
    const t = rewardTier(tier);
    const rw = rollRewards(t);
    return {
      type: 'reward',
      tier: t,
      fromEvent: !!fromEvent,
      gold: rw.gold,
      cardChoices: rw.cardChoices,
      potion: rw.potion,
      relic: rw.relic,
      claimed: {},
    };
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

  function removePriceFor(count) {
    return shopScale(75 + 25 * count);
  }

  function makeShop() {
    const run = R();
    const cls = run ? run.character : undefined;
    const removePrice = removePriceFor(run ? run.removeCount || 0 : 0);

    // Cards: 5 class cards and 2 colorless cards.
    const usedCards = new Set();
    const cards = [];
    const addCardItem = (d) => {
      usedCards.add(d.id);
      cards.push({ inst: { id: d.id, upgraded: false }, price: shopScale(cardPrice(d)), sold: false });
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
      relics.push({ id, price: shopScale(relicPrice(id)), sold: false });
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
      potions.push({ id, price: shopScale(potionPrice(id)), sold: false });
    }

    return { cards, relics, potions, removePrice, removeUsed: false };
  }

  // Treasure bonus, decided once when the chest room is entered: a potion (if a belt slot is free),
  // a little gold, or nothing.
  function rollTreasureBonus() {
    const x = rng.next();
    if (x < TREASURE_POTION_CHANCE && freePotionSlot() >= 0) {
      const id = randomPotionId(rarityOrder(potionRarityRoll()), null);
      if (id) return { kind: 'potion', id };
    }
    if (x < TREASURE_POTION_CHANCE + TREASURE_GOLD_CHANCE) {
      return { kind: 'gold', amount: goldScale(rng.int(8, 14)) };
    }
    return null;
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
      n -= diff().potionSlotPenalty || 0;
    }
    return Math.max(1, n);
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

  // Encounter for a run-level fight op: an id, or 'random_normal' / 'random_elite' from the current act.
  function fightEncounterFor(op, run) {
    const act = run ? run.act : 1;
    const want = op.encounter;
    if (want === 'random_elite') return pickEncounter(act, 'elite', true);
    if (want === 'random_normal' || !want) return pickEncounter(act, 'normal', true);
    return want;
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
        const id = fightEncounterFor(op, run);
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
  const ROOM_TYPES = ['combat', 'reward', 'event', 'shop', 'rest', 'treasure', 'bossrelic'];
  let batchDepth = 0;   // while > 0, mutations do not write the save file (one write at the end of a claim)

  function isValidRun(o) {
    return !!(o && typeof o === 'object' && typeof o.hp === 'number' &&
      o.map && o.map.nodes && Array.isArray(o.map.rows) &&
      Array.isArray(o.deck) && Array.isArray(o.relics));
  }

  // Keeps a loaded room well formed; unknown extra keys (screen state) are kept.
  function normalizeRoom(r) {
    if (!r || typeof r !== 'object' || ROOM_TYPES.indexOf(r.type) < 0) return null;
    delete r.resume;
    switch (r.type) {
      case 'combat':
        if (!r.encounterId) return null;
        r.tier = r.tier || 'normal';
        r.fromEvent = !!r.fromEvent;
        r.stage = 'fight';
        break;
      case 'event':
        if (!r.eventId) return null;
        break;
      case 'reward':
        r.tier = rewardTier(r.tier);
        r.fromEvent = !!r.fromEvent;
        r.gold = finiteNum(r.gold, 0);
        r.cardChoices = Array.isArray(r.cardChoices) ? r.cardChoices : [];
        r.potion = r.potion || null;
        r.relic = r.relic || null;
        r.claimed = plainObj(r.claimed);
        break;
      case 'treasure':
        r.relicId = r.relicId || null;
        r.gold = finiteNum(r.gold, 0);
        r.bonus = r.bonus && typeof r.bonus === 'object' ? r.bonus : null;
        r.claimed = plainObj(r.claimed);
        break;
      case 'bossrelic':
        r.choices = Array.isArray(r.choices) ? r.choices : [];
        if (r.claimed === undefined) r.claimed = null;
        break;
      default:
        break;
    }
    return r;
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
    if (o.lastEncounterId === undefined) o.lastEncounterId = o.lastEncounter;
    if (o.shop === undefined) o.shop = null;
    if (!o.roomFired || typeof o.roomFired !== 'object') o.roomFired = {};
    o.ascension = clampAsc(o.ascension);
    o.difficulty = difficultyFor(o.ascension);
    o.room = normalizeRoom(o.room);
    delete o.pending;
    o.over = !!o.over;
    o.won = !!o.won;
    // A loaded fight is restarted: keep the snapshot so that leaving again still restarts it.
    if (o.room && o.room.type === 'combat') beginAtomic(o);
    return o;
  }

  // A copy of the run as it is now, without any pending snapshot inside it.
  function snapshotRun(run) {
    const copy = Object.assign({}, run, {
      room: run.room ? Object.assign({}, run.room, { resume: undefined }) : null,
    });
    return JSON.parse(JSON.stringify(copy));
  }

  // Starts an atomic room: the save file keeps the state from before this point until the room resolves.
  function beginAtomic(run) {
    if (run && run.room) run.room.resume = snapshotRun(run);
  }

  // While a fight or an event choice is in progress the save holds its snapshot, not the live run.
  function saveView(run) {
    const r = run.room;
    return r && r.resume ? r.resume : run;
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
    if (run && !run.over && batchDepth === 0) save();
    emit('run:update', {});
  }

  // Runs fn with saving suspended, then the caller saves once (see claimReward).
  function batch(fn) {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
    }
  }

  // ---------------------------------------------------------------------------
  // Meta progression (DS.Meta)
  // ---------------------------------------------------------------------------
  const ACH = [
    { id: 'ach_win_berserker', name: 'Axe Falls', desc: 'Win a run as the Berserker.', icon: '🪓' },
    { id: 'ach_win_shade', name: 'Out of the Shadow', desc: 'Win a run as the Shade.', icon: '🌑' },
    { id: 'ach_win_arcanist', name: 'Spellbound', desc: 'Win a run as the Arcanist.', icon: '🔮' },
    { id: 'ach_win_warden', name: 'Iron Keeper', desc: 'Win a run as the Warden.', icon: '🛡️' },
    { id: 'ach_win_tempest', name: 'Storm Breaker', desc: 'Win a run as the Tempest.', icon: '⛈️' },
    { id: 'ach_win_occultist', name: 'Unhallowed Crown', desc: 'Win a run as the Occultist.', icon: '🕯️' },
    { id: 'ach_win_artificer', name: 'Works as Designed', desc: 'Win a run as the Artificer.', icon: '⚙️' },
    { id: 'ach_win_beastcaller', name: 'Leader of the Pack', desc: 'Win a run as the Beastcaller.', icon: '🐺' },
    { id: 'ach_win_revenant', name: 'Twice Buried', desc: 'Win a run as the Revenant.', icon: '⚰️' },
    { id: 'ach_asc_1', name: 'Hardened Climb', desc: 'Win a run on ascension 1 or higher.', icon: '🔥' },
    { id: 'ach_asc_3', name: 'Frugal Victor', desc: 'Win a run on ascension 3 or higher.', icon: '🍂' },
    { id: 'ach_asc_5', name: 'Ordeal Survivor', desc: 'Win a run on ascension 5 or higher.', icon: '⚔️' },
    { id: 'ach_asc_7', name: 'Against Inflation', desc: 'Win a run on ascension 7 or higher.', icon: '💰' },
    { id: 'ach_asc_10', name: 'Spire Conqueror', desc: 'Win a run on ascension 10.', icon: '👑' },
    { id: 'ach_deck_big', name: 'Overflowing', desc: 'Win a run with 40 or more cards in your deck.', icon: '📚' },
    { id: 'ach_deck_small', name: 'Lean and Mean', desc: 'Win a run with 15 or fewer cards in your deck.', icon: '🗡️' },
    { id: 'ach_curses_5', name: 'Cursed Collector', desc: 'End a run with 5 or more curses in your deck.', icon: '💀' },
    { id: 'ach_gold_hoard', name: 'Hoarder', desc: 'Hold 500 gold at once.', icon: '🪙' },
    { id: 'ach_gold_earned', name: 'Gilded Path', desc: 'Earn 1000 gold in a single run.', icon: '💎' },
    { id: 'ach_relics_15', name: 'Relic Collector', desc: 'Hold 15 relics at once.', icon: '📿' },
    { id: 'ach_act2', name: 'Into the Drowned City', desc: 'Reach act 2.', icon: '🌊' },
    { id: 'ach_act3', name: 'Summit Reached', desc: 'Reach act 3.', icon: '🏔️' },
    { id: 'ach_lose_floor1', name: 'Stillborn', desc: 'Lose a run on floor 1.', icon: '☠️' },
    { id: 'ach_speed', name: 'Swift Ascent', desc: 'Win a run in fewer than 120 turns.', icon: '⏱️' },
    { id: 'ach_elite_10', name: 'Elite Hunter', desc: 'Defeat 10 elite enemies in a single run.', icon: '🏹' },
    { id: 'ach_boss_1', name: 'Bane of Giants', desc: 'Defeat a boss.', icon: '👹' },
    { id: 'ach_boss_3', name: 'Triple Crown', desc: 'Defeat 3 bosses in a single run.', icon: '🎖️' },
    { id: 'ach_fights_50', name: 'Long Road', desc: 'Fight 50 battles in a single run.', icon: '🥾' },
    { id: 'ach_cards_300', name: 'Relentless Hand', desc: 'Play 300 cards in a single run.', icon: '🃏' },
    { id: 'ach_damage_5000', name: 'Storm of Steel', desc: 'Deal 5000 damage in a single run.', icon: '💥' },
    { id: 'ach_first_loss', name: 'First Fall', desc: 'Lose a run.', icon: '🩸' },
    { id: 'ach_runs_10', name: 'Persistent', desc: 'Finish 10 runs.', icon: '🔁' },
    { id: 'ach_runs_50', name: 'Spire Veteran', desc: 'Finish 50 runs.', icon: '🏛️' },
    { id: 'ach_cards_seen_60', name: 'Scholar of Cards', desc: 'Discover 60 different cards.', icon: '📖' },
    { id: 'ach_relics_seen_25', name: 'Keeper of Relics', desc: 'Discover 25 different relics.', icon: '🗝️' },
  ];
  const ACH_IDS = new Set(ACH.map((a) => a.id));
  const SEEN_KINDS = ['cards', 'relics', 'enemies', 'potions'];

  // Achievement checks run on the context built by recordRun.
  const CHECKS = {
    ach_win_berserker: (c) => c.won && c.character === 'berserker',
    ach_win_shade: (c) => c.won && c.character === 'shade',
    ach_win_arcanist: (c) => c.won && c.character === 'arcanist',
    ach_win_warden: (c) => c.won && c.character === 'warden',
    ach_win_tempest: (c) => c.won && c.character === 'tempest',
    ach_win_occultist: (c) => c.won && c.character === 'occultist',
    ach_win_artificer: (c) => c.won && c.character === 'artificer',
    ach_win_beastcaller: (c) => c.won && c.character === 'beastcaller',
    ach_win_revenant: (c) => c.won && c.character === 'revenant',
    ach_asc_1: (c) => c.won && c.ascension >= 1,
    ach_asc_3: (c) => c.won && c.ascension >= 3,
    ach_asc_5: (c) => c.won && c.ascension >= 5,
    ach_asc_7: (c) => c.won && c.ascension >= 7,
    ach_asc_10: (c) => c.won && c.ascension >= 10,
    ach_deck_big: (c) => c.won && c.deckSize >= 40,
    ach_deck_small: (c) => c.won && c.deckSize <= 15,
    ach_curses_5: (c) => c.curses >= 5,
    ach_gold_hoard: (c) => c.maxGold >= 500,
    ach_gold_earned: (c) => c.goldEarned >= 1000,
    ach_relics_15: (c) => c.relicCount >= 15,
    ach_act2: (c) => c.act >= 2,
    ach_act3: (c) => c.act >= 3,
    ach_lose_floor1: (c) => !c.won && c.floor <= 1,
    ach_speed: (c) => c.won && c.turns < 120,
    ach_elite_10: (c) => c.elites >= 10,
    ach_boss_1: (c) => c.bosses >= 1,
    ach_boss_3: (c) => c.bosses >= 3,
    ach_fights_50: (c) => c.fights >= 50,
    ach_cards_300: (c) => c.cardsPlayed >= 300,
    ach_damage_5000: (c) => c.damageDealt >= 5000,
    ach_first_loss: (c) => !c.won,
    ach_runs_10: (c) => c.runs >= 10,
    ach_runs_50: (c) => c.runs >= 50,
    ach_cards_seen_60: (c) => c.seenCards >= 60,
    ach_relics_seen_25: (c) => c.seenRelics >= 25,
  };

  let metaState = null;

  function metaDefault() {
    return {
      runs: 0,
      wins: 0,
      bestScore: 0,
      perChar: {},
      history: [],
      seen: { cards: {}, relics: {}, enemies: {}, potions: {} },
      achievements: {},
    };
  }

  // Tolerant read: missing, blank, corrupt or wrongly shaped storage gives a fresh state.
  function metaLoad() {
    const d = metaDefault();
    const s = storage();
    if (!s) return d;
    try {
      const raw = s.getItem(META_KEY);
      if (!raw) return d;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return d;
      d.runs = Math.max(0, Math.floor(finiteNum(o.runs, 0)));
      d.wins = Math.max(0, Math.floor(finiteNum(o.wins, 0)));
      d.bestScore = finiteNum(o.bestScore, 0);
      const perChar = plainObj(o.perChar);
      for (const k of Object.keys(perChar)) {
        const e = plainObj(perChar[k]);
        d.perChar[k] = {
          runs: finiteNum(e.runs, 0),
          wins: finiteNum(e.wins, 0),
          maxAscensionWon: finiteNum(e.maxAscensionWon, -1),
        };
      }
      if (Array.isArray(o.history)) {
        d.history = o.history.filter((h) => h && typeof h === 'object' && !Array.isArray(h)).slice(0, HISTORY_MAX);
      }
      const seen = plainObj(o.seen);
      for (const k of SEEN_KINDS) d.seen[k] = plainObj(seen[k]);
      d.achievements = plainObj(o.achievements);
      return d;
    } catch (e) {
      warn('meta data unreadable; starting fresh', e);
      return metaDefault();
    }
  }

  function M() {
    if (!metaState) metaState = metaLoad();
    return metaState;
  }

  function metaSave() {
    const s = storage();
    if (!s || !metaState) return false;
    try {
      s.setItem(META_KEY, JSON.stringify(metaState));
      return true;
    } catch (e) {
      warn('meta save failed', e);
      return false;
    }
  }

  function markSeen(kind, id) {
    if (!id || SEEN_KINDS.indexOf(kind) < 0) return false;
    const m = M();
    if (!m.seen[kind] || typeof m.seen[kind] !== 'object') m.seen[kind] = {};
    if (m.seen[kind][id]) return false;
    m.seen[kind][id] = true;
    metaSave();
    return true;
  }

  function unlockAchievement(id) {
    if (!ACH_IDS.has(id)) return false;
    const m = M();
    if (!m.achievements || typeof m.achievements !== 'object') m.achievements = {};
    if (m.achievements[id]) return false;
    m.achievements[id] = new Date().toISOString();
    metaSave();
    emit('meta:achievement', { id });
    return true;
  }

  // Score: floors climbed, act, elites and bosses killed, gold; a win bonus; then the ascension multiplier.
  function scoreRun(run) {
    const r = run || R();
    if (!r) return 0;
    const st = r.stats || {};
    const base = (r.floor || 0) * 10 +
      Math.max(0, (r.act || 1) - 1) * 100 +
      (st.elites || 0) * 30 +
      (st.bosses || 0) * 100 +
      Math.max(0, r.gold || 0) +
      Math.floor((st.goldEarned || 0) / 10);
    const winBonus = r.won ? 1000 + Math.max(0, 300 - (st.turns || 0)) : 0;
    const mult = 1 + 0.25 * clampAsc(r.ascension);
    // Trials (relics flagged trial:true) scale the score by their summed trialScore percent, floored at x0.25.
    let trialPct = 0;
    (r.relics || []).forEach((e) => {
      const d = e && DS.relics && DS.relics[e.id];
      if (d && d.trial) trialPct += Number(d.trialScore) || 0;
    });
    return Math.round((base + winBonus) * mult * Math.max(0.25, 1 + trialPct / 100));
  }

  // Records a finished run once. Returns the ids of achievements it unlocked.
  function recordRun(run) {
    if (!run || run.recorded) return [];
    run.recorded = true;
    const m = M();
    const won = !!run.won;
    const asc = clampAsc(run.ascension);
    const st = run.stats || {};
    const deck = Array.isArray(run.deck) ? run.deck : [];
    const relicIds = (run.relics || []).map((r) => r.id);
    const score = scoreRun(run);
    const curses = deck.filter((c) => {
      const d = cardDef(c.id);
      return !!d && d.type === 'curse';
    }).length;
    const enc = run.lastEncounterId && DS.encounters ? DS.encounters[run.lastEncounterId] : null;
    const killedBy = !won && run.hp <= 0 && enc ? (enc.name || enc.id) : null;

    m.runs = finiteNum(m.runs, 0) + 1;
    if (won) m.wins = finiteNum(m.wins, 0) + 1;
    m.bestScore = Math.max(finiteNum(m.bestScore, 0), score);
    if (!m.perChar[run.character] || typeof m.perChar[run.character] !== 'object') {
      m.perChar[run.character] = { runs: 0, wins: 0, maxAscensionWon: -1 };
    }
    const pc = m.perChar[run.character];
    pc.runs = finiteNum(pc.runs, 0) + 1;
    if (won) {
      pc.wins = finiteNum(pc.wins, 0) + 1;
      pc.maxAscensionWon = Math.max(finiteNum(pc.maxAscensionWon, -1), asc);
    }
    m.history.unshift({
      character: run.character,
      won,
      act: run.act,
      floor: run.floor,
      ascension: asc,
      score,
      date: new Date().toISOString(),
      killedBy,
      deckSize: deck.length,
      relics: relicIds,
      turns: st.turns || 0,
    });
    if (m.history.length > HISTORY_MAX) m.history.length = HISTORY_MAX;
    metaSave();

    const ctx = {
      won,
      character: run.character,
      ascension: asc,
      act: run.act || 1,
      floor: run.floor || 0,
      deckSize: deck.length,
      curses,
      maxGold: Math.max(st.maxGold || 0, run.gold || 0),
      goldEarned: st.goldEarned || 0,
      relicCount: Math.max(st.maxRelics || 0, relicIds.length),
      turns: st.turns || 0,
      elites: st.elites || 0,
      bosses: st.bosses || 0,
      fights: st.fights || 0,
      cardsPlayed: st.cardsPlayed || 0,
      damageDealt: st.damageDealt || 0,
      runs: m.runs,
      seenCards: Object.keys(m.seen.cards || {}).length,
      seenRelics: Object.keys(m.seen.relics || {}).length,
    };
    const newly = [];
    for (const a of ACH) {
      if (m.achievements[a.id]) continue;
      let ok = false;
      try {
        ok = !!CHECKS[a.id](ctx);
      } catch (e) {
        warn('achievement check failed: ' + a.id, e);
      }
      if (ok && unlockAchievement(a.id)) newly.push(a.id);
    }
    return newly;
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

  // Called by the combat engine when a fight is won: the combat room becomes a reward room.
  function settleRoom(target) {
    const run = target || R();
    if (!run || !run.room || run.room.type !== 'combat') return;
    const room = run.room;
    run.room = makeRewardRoom(room.tier, room.fromEvent);
    if (run === R()) touch();
  }

  // A seed from a number, a numeric string, or any other text (hashed, so the same text gives the same run).
  // Returns null when no seed was given.
  function seedFrom(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return isFinite(v) ? Math.floor(v) : null;
    const str = String(v).trim();
    if (!str) return null;
    const n = Number(str);
    if (isFinite(n)) return Math.floor(n);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 2147483646) + 1;
  }

  // opts: {seed, ascension} or a bare seed number. Ascension 0..10.
  function start(characterId, opts) {
    stopActiveCombat();
    let seedIn = opts;
    let asc = 0;
    if (opts && typeof opts === 'object') {
      seedIn = opts.seed;
      asc = opts.ascension;
    }
    const given = seedFrom(seedIn);
    const s = given !== null ? given : Math.floor(Math.random() * 2147483646) + 1;
    if (DS.rng && typeof DS.rng.seed === 'function') DS.rng.seed(s);

    const ascension = clampAsc(asc);
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
      ascension,
      difficulty: difficultyFor(ascension),
      removeCount: 0,
      usedEvents: [],
      lastEvent: null,
      actFights: 0,
      lastEncounter: null,
      lastEncounterId: null,
      shop: null,
      roomFired: {},
      room: null,
    };
    const run = DS.run;
    run.map = generateMap(1);

    const starter = ch && Array.isArray(ch.starterDeck) ? ch.starterDeck : [];
    for (const id of starter) {
      run.deck.push({ uid: newUid(), id, upgraded: false });
      markSeen('cards', id);
    }
    if (ch && ch.starterRelic) addRelic(ch.starterRelic);
    for (let i = 0; i < run.difficulty.startCurses; i++) {
      const id = randomCurseId();
      if (id) addCard(id, false);
    }

    touch();
    return run;
  }

  function nextAct() {
    const run = R();
    if (!run) return false;
    run.room = null;
    if (run.act >= 3) {
      run.won = true;
      touch();
      return false;
    }
    run.act += 1;
    run.hp = Math.max(1, Math.min(run.maxHp, Math.floor(run.maxHp * (diff().actStartHpMul || 1))));
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
    if (!run.over) {
      run.over = true;
      run.won = !!won;
      clearSave();
      try {
        recordRun(run);
      } catch (e) {
        warn('recording the run failed', e);
      }
    }
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
  // Map navigation and rooms
  // ---------------------------------------------------------------------------
  function availableNodes() {
    const run = R();
    if (!run || !run.map) return [];
    // Asking for the map's choices means the player is on the map. A room still open here was left
    // without closeRoom(), so close it now (fights and boss steps refuse and stay open).
    if (run.room) closeRoom();
    const nodes = run.map.nodes;
    if (run.nodeId === null || run.nodeId === undefined) {
      return (run.map.rows[0] || []).map((id) => nodes[id]).filter(Boolean);
    }
    const cur = nodes[run.nodeId];
    if (!cur) return [];
    return (cur.next || []).map((id) => nodes[id]).filter((n) => n && !n.visited);
  }

  // Starts a fight room. kind: 'fight' | 'elite' | 'boss' (drives the stats).
  function openCombat(encounterId, tier, kind, fromEvent) {
    const run = R();
    run.lastEncounter = encounterId;
    run.lastEncounterId = encounterId;
    run.stats.fights = (run.stats.fights || 0) + 1;
    if (kind === 'elite') run.stats.elites = (run.stats.elites || 0) + 1;
    if (kind === 'boss') run.stats.bosses = (run.stats.bosses || 0) + 1;
    const def = DS.encounters && DS.encounters[encounterId];
    if (def && Array.isArray(def.enemies)) def.enemies.forEach((id) => markSeen('enemies', id));
    run.room = { type: 'combat', encounterId, tier, fromEvent: !!fromEvent, stage: 'fight' };
    beginAtomic(run);
    return run.room;
  }

  // The room as the UI receives it from enterNode.
  function publicRoom(room) {
    if (!room) return null;
    switch (room.type) {
      case 'combat':
        return { type: 'combat', encounterId: room.encounterId, tier: room.tier, fromEvent: !!room.fromEvent };
      case 'event':
        return { type: 'event', eventId: room.eventId };
      case 'shop': {
        const run = R();
        return { type: 'shop', shop: run ? run.shop : null };
      }
      case 'treasure':
        return {
          type: 'treasure',
          relicId: room.relicId,
          gold: room.gold,
          bonus: room.bonus ? Object.assign({}, room.bonus) : null,
        };
      default:
        return { type: room.type };
    }
  }

  function enterNode(nodeId) {
    const run = R();
    if (!run || !run.map) return null;
    const node = run.map.nodes[nodeId];
    if (!node || !availableNodes().some((n) => n.id === nodeId)) {
      warn('node not available: ' + nodeId);
      return null;
    }
    node.visited = true;
    run.nodeId = nodeId;
    run.floor = (run.floor || 0) + 1;
    run.roomFired = {};
    run.shop = null;
    run.room = null;

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

    if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
      const tier = kind === 'fight' ? fightTier() : kind;
      const encounterId = pickEncounter(run.act, tier, true);
      if (encounterId) {
        openCombat(encounterId, tier, kind, false);
      } else {
        warn('no encounters defined; room falls back to rest');
        run.room = { type: 'rest' };
      }
    } else if (kind === 'event') {
      run.room = { type: 'event', eventId };
    } else if (kind === 'shop') {
      run.shop = makeShop();
      run.room = { type: 'shop' };
    } else if (kind === 'treasure') {
      const rw = rollRewards('treasure');
      run.room = {
        type: 'treasure',
        relicId: rw.relic || null,
        gold: rw.gold,
        bonus: rollTreasureBonus(),
        claimed: {},
      };
    } else {
      run.room = { type: 'rest' };
    }

    if (kind === 'shop') fire('onShopEnter', {});
    if (kind === 'treasure') fire('onChestOpen', { relicId: run.room.relicId, gold: run.room.gold });
    touch();
    return publicRoom(run.room);
  }

  // Where to go on Continue (or after a load). null means: show the map.
  function resumeTarget() {
    const run = R();
    if (!run || run.over) return null;
    const room = run.room;
    if (!room) {
      // A beaten boss with no room left: the act can only be left through the boss relic step.
      const cur = run.nodeId && run.map ? run.map.nodes[run.nodeId] : null;
      if (cur && cur.type === 'boss') return { screen: 'bossrelic', params: {} };
      return null;
    }
    switch (room.type) {
      case 'combat':
        return {
          screen: 'combat',
          params: { encounterId: room.encounterId, tier: room.tier || 'normal', fromEvent: !!room.fromEvent },
        };
      case 'event':
        return { screen: 'event', params: { eventId: room.eventId } };
      case 'shop':
        return run.shop ? { screen: 'shop', params: { shop: run.shop } } : null;
      case 'rest':
        return room.done ? null : { screen: 'rest', params: {} };
      case 'treasure':
        if (room.claimed && room.claimed.chest) return null;
        return {
          screen: 'treasure',
          params: {
            relicId: room.relicId || null,
            gold: room.gold || 0,
            bonus: room.bonus ? Object.assign({}, room.bonus) : null,
          },
        };
      case 'reward':
        if (rewardDone(room)) return null;
        return { screen: 'reward', params: { tier: room.tier || 'normal', fromEvent: !!room.fromEvent } };
      case 'bossrelic':
        return { screen: 'bossrelic', params: {} };
      default:
        return null;
    }
  }

  // Leaves the current room for the map. Refuses combat rooms and the boss steps (see the header).
  function closeRoom() {
    const run = R();
    const room = run ? run.room : null;
    if (!room || room.type === 'combat' || room.type === 'bossrelic') return false;
    if (room.type === 'reward' && room.tier === 'boss') return false;
    run.room = null;
    touch();
    return true;
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
    run.stats.maxGold = Math.max(run.stats.maxGold || 0, run.gold);
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
    markSeen('cards', id);
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
    // Smithing is the rest site's one action.
    if (run.room && run.room.type === 'rest') run.room.done = true;
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
    run.stats.maxRelics = Math.max(run.stats.maxRelics || 0, run.relics.length);
    markSeen('relics', id);
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
    markSeen('potions', id);
    touch();
    return true;
  }

  function discardPotion(slot) {
    const run = R();
    if (!run || slot < 0 || slot >= run.potions.length) return;
    run.potions[slot] = null;
    touch();
  }

  // Heals the rest amount and closes the rest site.
  function rest() {
    const run = R();
    if (!run) return 0;
    const healed = restAmount();
    run.hp = Math.min(run.maxHp, run.hp + healed);
    if (run.room && run.room.type === 'rest') run.room.done = true;
    fire('onRest', {});
    touch();
    return healed;
  }

  // HP a rest would heal right now.
  function restAmount() {
    const run = R();
    if (!run) return 0;
    return Math.max(0, Math.min(run.maxHp - run.hp, Math.floor(run.maxHp * restPct())));
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
    shop.removePrice = removePriceFor(run.removeCount);
    emit('run:gold', { amount: -price });
    touch();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Rewards, claims and bosses
  // ---------------------------------------------------------------------------
  // Claims one line of the open reward room ('gold' | 'potion' | 'relic' | 'card') or the chest ('chest'),
  // or the boss relic ('boss', relicId). Each line is granted once. Returns false when nothing was granted.
  function claimReward(kind, arg) {
    const run = R();
    const room = run && !run.over ? run.room : null;
    if (!room) return false;
    if (room.type === 'reward') {
      if (!room.claimed || typeof room.claimed !== 'object') room.claimed = {};
      const ok = batch(() => claimRewardLine(room, kind, arg));
      if (ok) touch();
      return ok;
    }
    if (room.type === 'treasure') {
      const ok = batch(() => claimChest(room, kind));
      if (ok) touch();
      return ok;
    }
    if (room.type === 'bossrelic') return claimBossRelic(room, kind, arg);
    return false;
  }

  function claimRewardLine(room, kind, arg) {
    const c = room.claimed;
    switch (kind) {
      case 'gold':
        if (c.gold || !(room.gold > 0)) return false;
        c.gold = true;
        addGold(room.gold);
        return true;
      case 'potion':
        if (c.potion || !room.potion) return false;
        c.potion = true;
        if (!addPotion(room.potion)) {
          c.potion = false;
          return false;
        }
        return true;
      case 'relic':
        if (c.relic || !room.relic) return false;
        c.relic = true;
        addRelic(room.relic);
        return true;
      case 'card': {
        if (c.card) return false;
        if (arg === null) {
          c.card = true;
          return true;
        }
        const choice = (room.cardChoices || [])[Number(arg)];
        if (!choice) return false;
        c.card = true;
        addCard(choice.id, !!choice.upgraded);
        return true;
      }
      default:
        return false;
    }
  }

  function claimChest(room, kind) {
    if (kind !== 'chest') return false;
    if (!room.claimed || typeof room.claimed !== 'object') room.claimed = {};
    if (room.claimed.chest) return false;
    room.claimed.chest = true;
    if (room.gold > 0) addGold(room.gold);
    if (room.relicId) addRelic(room.relicId);
    const b = room.bonus;
    if (b && b.kind === 'potion') addPotion(b.id);
    else if (b && b.kind === 'gold' && b.amount > 0) addGold(b.amount);
    return true;
  }

  function claimBossRelic(room, kind, arg) {
    if (kind !== 'boss' || room.claimed) return false;
    if (!Array.isArray(room.choices) || room.choices.indexOf(arg) < 0) return false;
    room.claimed = arg;
    addRelic(arg);
    touch();
    return true;
  }

  // Public: while a reward room is open this returns its stored stock (same every time, with claims);
  // otherwise a fresh roll (see generateRewards above).

  // The three boss relics for the boss relic step. Stored in the room so a resumed step shows the same three.
  function rollBossChoices() {
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

  function bossRelicChoices() {
    const run = R();
    if (!run) return [];
    const room = run.room;
    if (room && room.type === 'bossrelic') {
      return room.claimed ? [] : room.choices.slice();
    }
    const choices = rollBossChoices();
    if (room && room.type === 'combat') return choices;
    run.room = { type: 'bossrelic', choices: choices.slice(), claimed: null };
    touch();
    return choices;
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

  // Resolves an event choice. The choice is atomic: until its effects are done the save holds the state
  // from before it, so leaving mid-choice re-offers the event. A following fight becomes a combat room.
  async function chooseEvent(eventId, index) {
    const run = R();
    const def = (DS.events_ && DS.events_[eventId]) || null;
    const choice = def && Array.isArray(def.choices) ? def.choices[index] : null;
    const fail = { text: '', fightEncounterId: null, fightTier: null, ok: false, dead: false };
    if (!run || run.over || !choice || !condOk(choice.cond)) return fail;
    if (run.room && run.room.type !== 'event') return fail;
    if (run.room) beginAtomic(run);

    const ctx = { event: eventId, resultText: null, fightEncounterId: null };
    const r = execList(choice.effects, ctx);
    if (isThenable(r)) await r;
    const text = ctx.resultText !== null && ctx.resultText !== undefined ? ctx.resultText : (choice.result || '');
    const dead = run.hp <= 0;
    const fightId = ctx.fightEncounterId || null;
    let fightTier = null;
    if (fightId && !dead) {
      fightTier = encounterTier(fightId);
      openCombat(fightId, fightTier, fightTier, true);
    } else {
      run.room = null;
    }
    touch();
    return { text, fightEncounterId: fightId, fightTier, ok: true, dead };
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
    ASCENSIONS,
    difficultyFor,
    start,
    availableNodes,
    enterNode,
    resumeTarget,
    closeRoom,
    generateRewards,
    claimReward,
    settleRoom,
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
    restAmount,
    getShop,
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
    score: scoreRun,
  };

  DS.Meta = {
    ACHIEVEMENTS: ACH.map((a) => Object.assign({}, a)),
    get() {
      return M();
    },
    recordRun(run) {
      return recordRun(run);
    },
    maxAscension(characterId) {
      const pc = M().perChar[characterId];
      const won = pc && typeof pc.maxAscensionWon === 'number' ? pc.maxAscensionWon : -1;
      return Math.max(0, Math.min(MAX_ASCENSION, won + 1));
    },
    markSeen(kind, id) {
      return markSeen(kind, id);
    },
    unlock(id) {
      return unlockAchievement(id);
    },
    reset() {
      metaState = metaDefault();
      try {
        const s = storage();
        if (s) s.removeItem(META_KEY);
      } catch (e) { /* ignore */ }
    },
  };
})();
