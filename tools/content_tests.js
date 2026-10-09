#!/usr/bin/env node
/*
 * Duskspire content test suite. No dependencies.
 *
 *   node tools/content_tests.js                 run every section over every loaded definition
 *   node tools/content_tests.js --only=cards    run only the named sections (comma separated)
 *
 * Sections. Each one walks the registries as they are loaded, so new content is covered without edits here:
 *   cards       every card, base and upgraded: put in hand in a fresh act 1 fight with 10 energy, played on a valid target
 *   potions     every potion: used once in a fresh act 1 fight
 *   relics      every relic alone: a bot plays its first playable cards and ends the turn, for 3 turns
 *   encounters  every encounter: a bot with 9999 block each turn plays 12 turns; each enemy must act
 *   events      every event: a fresh run, and every choice whose condition can be set up, applied to that run
 *   text        "Deal N damage" / "Gain N Block" descriptions on single-effect cards match the effect amount
 *
 * The content files load in the same order and from the same list as tools/tests.js. Engine console output is
 * swallowed; exceptions the engine catches and logs are reported as findings, not hidden. Nothing is defined here
 * and the harness never edits content. Exit code is 1 when any check failed. The last line is
 * "CONTENT TESTS RESULT: PASS" or "CONTENT TESTS RESULT: FAIL".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const util = require('util');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const ONLY_ARG = ARGV.find((a) => a.startsWith('--only='));
const ONLY = ONLY_ARG ? ONLY_ARG.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

const CASE_TIMEOUT_MS = 5000;   // one check may not run longer than this
const BUDGET_MS = 150000;       // no new check starts after this, so the whole suite stays well under 3 minutes
const SECTIONS = ['cards', 'potions', 'relics', 'encounters', 'events', 'text'];
const SECTION_RANK = { load: 0, cards: 1, potions: 2, relics: 3, encounters: 4, events: 5, text: 6 };

// Severity: lower is worse. The failure list is printed worst first.
const SEV = {
  THREW: 1,       // engine exception, hang, or a content file that failed to load
  NONFINITE: 2,   // HP or block that is not a finite integer
  DUPLICATE: 3,   // one card instance in two places (or a malformed card)
  PILE: 4,        // card in the wrong pile, or a power still in play
  DEFINE: 5,      // duplicate or missing id reported while loading
  EVENT_STAT: 5,  // event left run HP, gold or max HP invalid
  ENEMY: 6,       // enemy never acts, undefined enemy, potion not used up
  STATE: 6,       // fight did not reach a player turn
  TEXT: 7,        // description disagrees with the effect amount
  REFUSED: 8,     // card, potion or choice refused though it should be usable
};

// ---------------------------------------------------------------------------
// Console capture. Engine logging is swallowed here. Exceptions the engine catches and logs (console.error,
// or a warning that says "failed" or "threw") become findings. Other warnings are only counted.
// ---------------------------------------------------------------------------
const captured = { errors: [], warns: [] };
const engineWarnings = new Map();
const FAILURE_WARN = /\bfailed\b|\bthrew\b/;
function describeArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) {
      const frame = String(a.stack || '').split('\n')[1] || '';
      return a.message + (frame ? ' (' + frame.trim() + ')' : '');
    }
    if (typeof a === 'string') return a;
    try { return util.inspect(a, { depth: 1, breakLength: 200 }); } catch (e) { return String(a); }
  }).join(' ');
}
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = (...args) => { captured.warns.push(describeArgs(args)); };
console.error = (...args) => { captured.errors.push(describeArgs(args)); };
const out = (s) => process.stdout.write((s === undefined ? '' : s) + '\n');

// ---------------------------------------------------------------------------
// Loading (same list and order as tools/tests.js)
// ---------------------------------------------------------------------------
const LOAD = [
  'src/engine/core.js',
  'src/engine/statuses.js',
  'src/engine/combat.js',
  'src/engine/run.js',
  'src/content/cards_berserker.js',
  'src/content/cards_shade.js',
  'src/content/cards_arcanist.js',
  'src/content/cards_warden.js',
  'src/content/cards_colorless.js',
  'src/content/cards_colorless_2.js',
  'src/content/relics_a.js',
  'src/content/relics_b.js',
  'src/content/potions.js',
  'src/content/enemies_act1.js',
  'src/content/enemies_act2.js',
  'src/content/enemies_act3.js',
  'src/content/events_a.js',
  'src/content/events_b.js',
  'src/content/cards_tempest.js',
  'src/content/cards_occultist.js',
  'src/content/cards_berserker_2.js',
  'src/content/cards_shade_2.js',
  'src/content/cards_arcanist_2.js',
  'src/content/cards_warden_2.js',
  'src/content/relics_c.js',
  'src/content/potions_b.js',
  'src/content/enemies_act1_b.js',
  'src/content/enemies_act2_b.js',
  'src/content/enemies_act3_b.js',
  'src/content/events_c.js',
  'src/content/cards_artificer.js',
  'src/content/cards_beastcaller.js',
  'src/content/cards_revenant.js',
  'src/content/cards_berserker_3.js',
  'src/content/cards_warden_3.js',
  'src/content/cards_colorless_3.js',
  'src/content/potions_c.js',
  'src/content/enemies_act3_c.js',
  'src/content/trials.js',
];

const loaded = [];
const notLoaded = [];
const loadFindings = [];   // {file, sev, msg}
for (const rel of LOAD) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    notLoaded.push(rel);
    continue;
  }
  const warnMark = captured.warns.length;
  const errMark = captured.errors.length;
  try {
    vm.runInThisContext(fs.readFileSync(abs, 'utf8'), { filename: abs });
    loaded.push(rel);
  } catch (e) {
    loadFindings.push({ file: rel, sev: SEV.THREW, msg: 'failed to load: ' + (e && e.message ? e.message : String(e)) });
  }
  for (const w of captured.warns.splice(warnMark)) loadFindings.push({ file: rel, sev: SEV.DEFINE, msg: 'while loading: ' + w });
  for (const w of captured.errors.splice(errMark)) loadFindings.push({ file: rel, sev: SEV.THREW, msg: 'while loading: ' + w });
}
const DS = globalThis.DS;

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
const stats = {};
for (const s of ['load'].concat(SECTIONS)) stats[s] = { pass: 0, fail: 0, skip: 0, secs: 0 };
const failures = [];
const skipReasons = new Map();
const RUN_START = Date.now();
let DEFAULT_HOOKS = null;
let DEFAULT_CHAR = 'berserker';
let FIGHT = null;   // encounter id used by the card, potion and relic checks

function clip(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const max = n || 320;
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}
function addFailure(section, kind, id, sev, msg) {
  stats[section].fail++;
  failures.push({ section: section, kind: kind, id: id, sev: sev, msg: clip(msg) });
}
function addSkip(section, reason) {
  stats[section].skip++;
  const key = section + ': ' + reason;
  skipReasons.set(key, (skipReasons.get(key) || 0) + 1);
}
function budgetLeft() {
  return Date.now() - RUN_START < BUDGET_MS;
}
function sortedKeys(obj) {
  return Object.keys(obj || {}).filter((k) => obj[k]).sort();
}
function countOf(obj) {
  return Object.keys(obj || {}).length;
}

function resetState() {
  DS.run = null;
  DS.combat = null;
  if (DEFAULT_HOOKS) Object.assign(DS.hooks, DEFAULT_HOOKS);
}

function withTimeout(fn, ms) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('timed out after ' + ms + ' ms');
      e.hang = true;
      reject(e);
    }, ms);
  });
  return Promise.race([Promise.resolve().then(fn), limit]).finally(() => clearTimeout(timer));
}

// Runs one check. fn(problems) pushes {sev, msg} for each defect it finds, may return {skip: reason}, or throws.
// Engine exceptions captured while the check ran are added as THREW problems.
async function runCase(section, kind, id, tag, fn) {
  if (!budgetLeft()) {
    addSkip(section, 'time budget reached; not run');
    return;
  }
  resetState();
  captured.errors.length = 0;
  captured.warns.length = 0;
  const problems = [];
  let skip = null;
  let thrown = null;
  try {
    const r = await withTimeout(() => fn(problems), CASE_TIMEOUT_MS);
    if (r && r.skip) skip = r.skip;
  } catch (e) {
    thrown = e;
  }
  const exceptions = captured.errors.concat(captured.warns.filter((w) => FAILURE_WARN.test(w)));
  for (const w of captured.warns) {
    if (!FAILURE_WARN.test(w)) engineWarnings.set(w, (engineWarnings.get(w) || 0) + 1);
  }
  resetState();
  for (const x of exceptions.slice(0, 3)) problems.unshift({ sev: SEV.THREW, msg: 'engine exception: ' + clip(x, 240) });
  if (thrown) {
    problems.unshift({ sev: SEV.THREW, msg: (thrown.hang ? 'hang: ' : 'threw: ') + clip(thrown && thrown.message ? thrown.message : String(thrown), 240) });
  }
  if (!problems.length) {
    if (skip) addSkip(section, skip);
    else stats[section].pass++;
    return;
  }
  const msgs = [];
  for (const p of problems) if (msgs.indexOf(p.msg) < 0) msgs.push(p.msg);
  const sev = Math.min.apply(null, problems.map((p) => p.sev));
  addFailure(section, kind, id, sev, tag + msgs.join(' | '));
}

// ---------------------------------------------------------------------------
// Fixtures: a fresh run, a started fight, and the shared state checks
// ---------------------------------------------------------------------------
function minHpOf(def) {
  if (!def) return 0;
  if (typeof def.hp === 'number') return def.hp;
  if (Array.isArray(def.hp) && typeof def.hp[0] === 'number') return def.hp[0];
  return 10;
}

// The simplest act 1 encounter: non-boss, every enemy defined, easy before normal, fewest enemies, least HP, then id.
function pickFight() {
  const encs = sortedKeys(DS.encounters).map((k) => DS.encounters[k]);
  const defined = encs.filter((e) => Array.isArray(e.enemies) && e.enemies.length > 0 &&
    e.enemies.every((id) => DS.enemies[id]));
  const act1 = defined.filter((e) => Number(e.act) === 1 && e.tier !== 'boss');
  const pool = act1.length ? act1 : defined.filter((e) => e.tier !== 'boss');
  const rank = { easy: 0, normal: 1, elite: 2 };
  const rankOf = (e) => (rank[e.tier] !== undefined ? rank[e.tier] : 3);
  const hpSum = (e) => e.enemies.reduce((s, id) => s + minHpOf(DS.enemies[id]), 0);
  pool.sort((a, b) => (rankOf(a) - rankOf(b)) || (a.enemies.length - b.enemies.length) ||
    (hpSum(a) - hpSum(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool.length ? pool[0].id : null;
}

function charFor(def) {
  return def && def.class && DS.characters && DS.characters[def.class] ? def.class : DEFAULT_CHAR;
}

// A fresh run for a character: starter deck, no relics, no potions, default difficulty. Becomes DS.run.
function makeRun(character) {
  const ch = DS.characters && DS.characters[character] ? DS.characters[character] : null;
  const maxHp = ch && ch.hp > 0 ? ch.hp : 80;
  const starter = ch && Array.isArray(ch.starterDeck) ? ch.starterDeck : [];
  const run = {
    character: character,
    hp: maxHp,
    maxHp: maxHp,
    gold: ch && typeof ch.gold === 'number' ? ch.gold : 99,
    deck: starter.map((id, i) => ({ uid: 'start' + i, id: id, upgraded: false })),
    relics: [],
    potions: [null, null, null],
    act: 1,
    floor: 1,
    map: null,
    nodeId: null,
    seed: 1,
    stats: { fights: 0, elites: 0, bosses: 0, turns: 0, cardsPlayed: 0, damageDealt: 0, goldEarned: 0 },
    over: false,
    won: false,
    room: null,
    difficulty: DS.Run && typeof DS.Run.difficultyFor === 'function' ? DS.Run.difficultyFor(0) : undefined,
  };
  DS.run = run;
  return run;
}

// Starts a fight against `opts.encounter` (default FIGHT) with `opts.relics` (ids) as the only relics.
async function startFight(character, seed, opts) {
  const o = opts || {};
  const run = makeRun(character);
  run.relics = (o.relics || []).map((id) => ({ id: id, counter: 0 }));
  DS.rng.seed(seed);
  const c = new DS.Combat(run, o.encounter || FIGHT);
  await c.start();
  return c;
}

// Moves the current hand back to the draw pile and puts `card` alone in hand.
function putInHand(c, card) {
  c.drawPile.push.apply(c.drawPile, c.hand);
  c.hand = [card];
}

// HP and block must be finite integers, and no card instance may sit in two places. Returns uid -> pile name.
function stateProblems(c, problems) {
  const p = c.player;
  const values = [['player hp', p.hp], ['player max HP', p.maxHp], ['player block', p.block]];
  for (const e of c.enemies) {
    values.push([e.id + ' hp', e.hp]);
    values.push([e.id + ' block', e.block]);
  }
  for (const pair of values) {
    if (!Number.isInteger(pair[1])) {
      problems.push({ sev: SEV.NONFINITE, msg: pair[0] + ' is ' + util.inspect(pair[1]) + ', not a finite integer' });
    }
  }
  const where = new Map();
  const piles = [['hand', c.hand], ['draw pile', c.drawPile], ['discard pile', c.discardPile], ['exhaust pile', c.exhaustPile]];
  for (const pile of piles) {
    const name = pile[0];
    for (const card of pile[1]) {
      if (!card || typeof card.uid !== 'string') {
        problems.push({ sev: SEV.DUPLICATE, msg: 'malformed card object in the ' + name });
        continue;
      }
      if (where.has(card.uid)) {
        const first = where.get(card.uid);
        const place = first === name ? 'the ' + name + ' twice' : 'the ' + first + ' and the ' + name;
        problems.push({ sev: SEV.DUPLICATE, msg: 'card ' + card.id + ' (instance ' + card.uid + ') is in ' + place });
      } else {
        where.set(card.uid, name);
      }
    }
  }
  return where;
}

// ---------------------------------------------------------------------------
// Section 1: cards
// ---------------------------------------------------------------------------
async function cardCase(id, up, problems) {
  const c = await startFight(charFor(DS.cards[id]), 7);
  if (c.phase !== 'player') {
    problems.push({ sev: SEV.STATE, msg: 'fight did not reach a player turn (phase ' + c.phase + ')' });
    return;
  }
  if (!c.livingEnemies().length) {
    problems.push({ sev: SEV.STATE, msg: 'the act 1 fight has no living enemy' });
    return;
  }
  const card = c.makeCard({ id: id, upgraded: up });
  if (!card) {
    problems.push({ sev: SEV.THREW, msg: 'makeCard returned nothing' });
    return;
  }
  if (card.cost === -1) return { skip: 'cost -1 (unplayable by design)' };
  putInHand(c, card);
  c.player.energy = 10;
  const target = card.data.target === 'enemy' ? c.livingEnemies()[0] : null;
  let can = c.canPlay(card);
  if (!can.ok && /right now/.test(can.reason)) {
    // playableIf gates on fight state (for example Strength above 0): give the player one Strength and retry once.
    c.player.statuses.strength = (c.player.statuses.strength || 0) + 1;
    can = c.canPlay(card);
  }
  if (!can.ok) {
    if (/right now/.test(can.reason)) return { skip: 'playableIf not met even with 1 Strength' };
    problems.push({ sev: SEV.REFUSED, msg: 'not playable with 10 energy on a valid target: ' + can.reason });
    return;
  }
  const r = await c.playCard(card, target);
  if (!r || !r.ok) {
    problems.push({ sev: SEV.REFUSED, msg: 'playCard refused: ' + (r && r.reason) });
    return;
  }
  const where = stateProblems(c, problems);
  const at = where.get(card.uid);
  const d = card.data;
  if (d.type === 'power') {
    if (at) problems.push({ sev: SEV.PILE, msg: 'power is still in the ' + at + ' (powers leave play)' });
  } else if (d.exhaust) {
    if (at !== 'exhaust pile') problems.push({ sev: SEV.PILE, msg: 'exhaust card went to the ' + (at || 'nowhere') + ', expected the exhaust pile' });
  } else if (at !== 'discard pile') {
    problems.push({ sev: SEV.PILE, msg: 'card went to the ' + (at || 'nowhere') + ', expected the discard pile' });
  }
}

// ---------------------------------------------------------------------------
// Section 2: potions
// ---------------------------------------------------------------------------
async function potionCase(id, problems) {
  const def = DS.potions[id];
  const c = await startFight(DEFAULT_CHAR, 11);
  if (c.phase !== 'player') {
    problems.push({ sev: SEV.STATE, msg: 'fight did not reach a player turn (phase ' + c.phase + ')' });
    return;
  }
  c.run.potions[0] = id;
  const target = def.target === 'enemy' ? (c.livingEnemies()[0] || null) : null;
  const r = await c.usePotion(0, target);
  if (!r || !r.ok) {
    problems.push({ sev: SEV.REFUSED, msg: 'usePotion refused: ' + (r && r.reason) });
    return;
  }
  if (c.run.potions[0] !== null) problems.push({ sev: SEV.ENEMY, msg: 'potion is still in slot 0 after use' });
  stateProblems(c, problems);
}

// ---------------------------------------------------------------------------
// Section 3: relics. A bot plays its first playable card until none is playable, then ends the turn. 3 turns.
// ---------------------------------------------------------------------------
async function relicCase(id, problems) {
  const def = DS.relics[id];
  const character = def.class && DS.characters && DS.characters[def.class] ? def.class : DEFAULT_CHAR;
  const c = await startFight(character, 23, { relics: [id] });
  if (c.phase !== 'player') {
    problems.push({ sev: SEV.STATE, msg: 'fight did not reach a player turn (phase ' + c.phase + ')' });
    return;
  }
  for (let t = 0; t < 3 && c.phase === 'player'; t++) {
    let plays = 0;
    while (c.phase === 'player' && plays < 40) {
      const card = c.hand.find((cd) => c.canPlay(cd).ok);
      if (!card) break;
      const target = card.data.target === 'enemy' ? (c.livingEnemies()[0] || null) : null;
      const r = await c.playCard(card, target);
      plays++;
      if (!r || !r.ok) break;
    }
    if (c.phase !== 'player') break;
    await c.endTurn();
    stateProblems(c, problems);
  }
}

// ---------------------------------------------------------------------------
// Section 4: encounters. A bot with 9999 block each turn plays 12 turns; every enemy must act.
// ---------------------------------------------------------------------------
async function encounterCase(encId, problems) {
  const def = DS.encounters[encId];
  const ids = Array.isArray(def.enemies) ? def.enemies : [];
  const missing = ids.filter((x) => !DS.enemies[x]);
  if (missing.length) problems.push({ sev: SEV.ENEMY, msg: 'lists undefined enemies: ' + missing.join(', ') });
  const run = makeRun(DEFAULT_CHAR);
  DS.rng.seed(31);
  const c = new DS.Combat(run, encId);
  const acted = new Map();
  const off = DS.events.on('combat:enemyMove', (p) => {
    const uid = p && p.enemy ? p.enemy.uid : null;
    if (uid) acted.set(uid, (acted.get(uid) || 0) + 1);
  });
  try {
    await c.start();
    const spawned = c.enemies.slice();
    if (spawned.length !== ids.length) {
      problems.push({ sev: SEV.ENEMY, msg: 'spawned ' + spawned.length + ' of ' + ids.length + ' listed enemies' });
    }
    let turns = 0;
    for (let t = 0; t < 12 && c.phase === 'player'; t++) {
      await c.runEffects([{ op: 'block', amount: 9999, to: 'self' }], { source: c.player });
      await c.endTurn();
      turns++;
      stateProblems(c, problems);
    }
    for (const e of spawned) {
      if (!acted.get(e.uid)) {
        problems.push({ sev: SEV.ENEMY, msg: e.id + ' took no action in ' + turns + ' turns (fight ' + c.phase + ')' });
      }
    }
  } finally {
    off();
  }
}

// ---------------------------------------------------------------------------
// Section 5: events
// ---------------------------------------------------------------------------
function actOf(ev) {
  const a = ev.act;
  if (typeof a === 'number') return a;
  if (Array.isArray(a) && a.length) return Number(a[0]) || 1;
  return 1;
}

// Sets the fresh run up so a choice's condition holds. Returns {ok}, {skip: reason} or {defect: message}.
function satisfy(run, cond) {
  if (!cond || typeof cond !== 'object') return { ok: true };
  const keys = Object.keys(cond);
  for (const key of keys) {
    const v = cond[key];
    if (key === 'minGold') {
      if (typeof v !== 'number') return { defect: 'cond.minGold is ' + util.inspect(v) + ', not a number' };
      run.gold = Math.max(run.gold, v);
    } else if (key === 'minHp') {
      if (typeof v !== 'number') return { defect: 'cond.minHp is ' + util.inspect(v) + ', not a number' };
      if (v > run.maxHp) return { skip: 'minHp ' + v + ' is above the starting max HP ' + run.maxHp };
      run.hp = Math.max(run.hp, v);
    } else if (key === 'hasRelic') {
      if (!DS.relics[v]) return { defect: 'cond.hasRelic names an undefined relic "' + v + '"' };
      run.relics.push({ id: v, counter: 0 });
    } else if (key === 'hasCardType') {
      const cid = sortedKeys(DS.cards).find((k) => DS.cards[k].type === v);
      if (!cid) return { skip: 'no card of type ' + v + ' is defined' };
      run.deck.push({ uid: 'cond' + run.deck.length, id: cid, upgraded: false });
    } else {
      return { skip: 'cond key "' + key + '" is not known to the harness' };
    }
  }
  return { ok: true };
}

// A fresh run: the choice list must be 2 to 4 long, and at least one choice must be enabled.
async function eventFreshCase(id, problems) {
  const ev = DS.events_[id];
  const choices = Array.isArray(ev.choices) ? ev.choices : [];
  if (choices.length < 2 || choices.length > 4) {
    problems.push({ sev: SEV.REFUSED, msg: 'has ' + choices.length + ' choices (contract: 2 to 4)' });
  }
  const run = makeRun(DEFAULT_CHAR);
  run.act = actOf(ev);
  DS.rng.seed(5);
  const view = DS.Run.getEvent(id);
  if (!view.choices.some((x) => x.enabled)) {
    problems.push({ sev: SEV.REFUSED, msg: 'no choice is enabled in a fresh run (contract: one should always be available)' });
  }
}

// One choice, applied to a fresh run in which its condition holds.
async function eventChoiceCase(id, index, problems) {
  const ev = DS.events_[id];
  const choice = Array.isArray(ev.choices) ? ev.choices[index] : null;
  if (!choice) return { skip: 'no such choice' };
  const run = makeRun(DEFAULT_CHAR);
  run.act = actOf(ev);
  const setup = satisfy(run, choice.cond);
  if (setup.defect) {
    problems.push({ sev: SEV.REFUSED, msg: setup.defect });
    return;
  }
  if (setup.skip) return { skip: setup.skip };
  DS.rng.seed(41 + index);
  const entry = DS.Run.getEvent(id).choices[index];
  if (!entry || !entry.enabled) return { skip: 'condition still disabled after setup' };
  const res = await DS.Run.chooseEvent(id, index);
  if (!res || !res.ok) problems.push({ sev: SEV.REFUSED, msg: 'chooseEvent refused an enabled choice' });
  const r = DS.run;
  if (!r) {
    problems.push({ sev: SEV.EVENT_STAT, msg: 'the run was cleared by the choice' });
    return;
  }
  if (!(Number.isFinite(r.hp) && r.hp >= 0)) problems.push({ sev: SEV.EVENT_STAT, msg: 'run HP is ' + util.inspect(r.hp) + ' after the choice' });
  if (!(Number.isFinite(r.gold) && r.gold >= 0)) problems.push({ sev: SEV.EVENT_STAT, msg: 'run gold is ' + util.inspect(r.gold) + ' after the choice' });
  if (!(Number.isFinite(r.maxHp) && r.maxHp >= 1)) problems.push({ sev: SEV.EVENT_STAT, msg: 'run max HP is ' + util.inspect(r.maxHp) + ' after the choice' });
  if (res && res.fightEncounterId && !DS.encounters[res.fightEncounterId]) {
    problems.push({ sev: SEV.ENEMY, msg: 'the fight op asks for undefined encounter "' + res.fightEncounterId + '"' });
  }
}

// ---------------------------------------------------------------------------
// Section 6: text. "Deal N damage" and "Gain N Block" against the first damage / block effect.
// ---------------------------------------------------------------------------
const TEXT_CLAIMS = [
  { op: 'damage', re: /\bDeal (\d+) damage\b/i, label: 'Deal N damage' },
  { op: 'block', re: /\bGain (\d+) Block\b/i, label: 'Gain N Block' },
];

// Only a claim the card's own single effect carries is compared. "Deal N damage" written for an onExhaust hook, a
// status trigger or a custom effect describes something else and is reported as skipped, not as a mismatch.
function textCheck(id, up) {
  const d = DS.getCardData({ id: id, upgraded: up });
  const desc = typeof d.desc === 'string' ? d.desc : '';
  const claims = TEXT_CLAIMS.filter((t) => t.re.test(desc));
  if (!claims.length) return { skip: 'no "Deal N damage" or "Gain N Block" claim' };
  if (!Array.isArray(d.effects) || d.effects.length !== 1) return { skip: 'not a single-effect card' };
  const e = d.effects[0] || {};
  const problems = [];
  let unverifiable = false;
  let elsewhere = false;
  for (const t of claims) {
    if (e.op !== t.op) {
      elsewhere = true;
      continue;
    }
    if (typeof e.amount !== 'number') {
      unverifiable = true;
      continue;
    }
    const said = Number(desc.match(t.re)[1]);
    if (e.amount !== said) problems.push('desc says "' + t.label + '" (' + said + ') but the ' + t.op + ' effect is ' + e.amount);
  }
  if (problems.length) return { problems: problems };
  if (unverifiable) return { skip: 'amount is a Value, not a literal' };
  if (elsewhere) return { skip: 'claim is made by a hook, status or other effect, not the card effect' };
  return { problems: [] };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
function report() {
  out('');
  out('==============================================================');
  out(' RESULTS BY SECTION');
  out('  section      pass   fail   skip   secs');
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  for (const s of ['load'].concat(SECTIONS)) {
    if (ONLY && !ONLY.includes(s)) continue;
    const st = stats[s];
    totalPass += st.pass;
    totalFail += st.fail;
    totalSkip += st.skip;
    out('  ' + s.padEnd(12) + String(st.pass).padStart(4) + '   ' + String(st.fail).padStart(4) + '   ' +
      String(st.skip).padStart(4) + '   ' + st.secs.toFixed(1));
  }
  out('==============================================================');
  out('');
  out('FAILURES (worst first)');
  if (!failures.length) out('  none');
  const ordered = failures.map((f, i) => ({ f: f, i: i })).sort((a, b) =>
    (a.f.sev - b.f.sev) ||
    ((SECTION_RANK[a.f.section] || 0) - (SECTION_RANK[b.f.section] || 0)) ||
    (a.f.id < b.f.id ? -1 : a.f.id > b.f.id ? 1 : 0) ||
    (a.i - b.i));
  for (const o of ordered) out(o.f.kind + ' ' + o.f.id + ': ' + o.f.msg);
  out('');
  out('SKIPPED (by design, or not applicable), most common first');
  const skips = Array.from(skipReasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (!skips.length) out('  none');
  for (const s of skips) out('  ' + s[1] + 'x ' + s[0]);
  out('');
  const warns = Array.from(engineWarnings.entries()).sort((a, b) => b[1] - a[1]);
  const warnTotal = warns.reduce((n, w) => n + w[1], 0);
  out('ENGINE WARNINGS (not counted as failures): ' + warnTotal + ' total, ' + warns.length + ' distinct');
  for (const w of warns.slice(0, 12)) out('  ' + w[1] + 'x ' + clip(w[0], 220));
  out('');
  const secs = ((Date.now() - RUN_START) / 1000).toFixed(1);
  out('TOTAL: ' + totalPass + ' passed, ' + totalFail + ' failed, ' + totalSkip + ' skipped (' + secs + 's)');
  const failed = totalFail > 0;
  out(failed ? 'CONTENT TESTS RESULT: FAIL' : 'CONTENT TESTS RESULT: PASS');
  process.exitCode = failed ? 1 : 0;
}

function installStorage() {
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear: () => { store.clear(); },
    key: (i) => { const keys = Array.from(store.keys()); return i < keys.length ? keys[i] : null; },
    get length() { return store.size; },
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  } catch (e) { /* keep the engine's own no-storage path */ }
}

async function main() {
  installStorage();
  if (!DS || typeof DS.Combat !== 'function' || !DS.Run) {
    out('FATAL: the engine did not load (DS.Combat / DS.Run missing).');
    for (const f of loadFindings) out('file ' + f.file + ': ' + f.msg);
    out('CONTENT TESTS RESULT: FAIL');
    process.exitCode = 1;
    return;
  }
  DEFAULT_HOOKS = Object.assign({}, DS.hooks);
  DEFAULT_CHAR = DS.characters && DS.characters.berserker ? 'berserker' : (sortedKeys(DS.characters)[0] || 'berserker');
  FIGHT = pickFight();

  out('==============================================================');
  out(' DUSKSPIRE CONTENT TESTS');
  out(' definitions: ' + countOf(DS.cards) + ' cards, ' + countOf(DS.potions) + ' potions, ' +
    countOf(DS.relics) + ' relics, ' + countOf(DS.encounters) + ' encounters, ' + countOf(DS.events_) + ' events');
  out(' files loaded: ' + loaded.length + ' of ' + LOAD.length +
    (notLoaded.length ? ' (missing, not loaded: ' + notLoaded.join(', ') + ')' : ''));
  out(' fight used by card, potion and relic checks: ' + (FIGHT || 'NONE'));
  out('==============================================================');

  // Load findings: files that threw, and define-time warnings (duplicate or missing ids).
  const badFiles = new Set(loadFindings.map((f) => f.file));
  stats.load.pass = LOAD.length - notLoaded.length - badFiles.size;
  for (const f of loadFindings) addFailure('load', 'file', f.file, f.sev, f.msg);

  const sel = (s) => !ONLY || ONLY.includes(s);
  const timed = async (s, body) => {
    const t0 = Date.now();
    await body();
    stats[s].secs = (Date.now() - t0) / 1000;
  };

  if (!FIGHT) {
    addFailure('encounters', 'encounter', '-', SEV.ENEMY, 'no encounter has only defined enemies; card, potion and relic checks cannot run');
  }

  if (FIGHT && sel('cards')) {
    await timed('cards', async () => {
      for (const id of sortedKeys(DS.cards)) {
        for (const up of [false, true]) {
          await runCase('cards', 'card', id, up ? '[upgraded] ' : '', (p) => cardCase(id, up, p));
        }
      }
    });
  }
  if (FIGHT && sel('potions')) {
    await timed('potions', async () => {
      for (const id of sortedKeys(DS.potions)) {
        await runCase('potions', 'potion', id, '', (p) => potionCase(id, p));
      }
    });
  }
  if (FIGHT && sel('relics')) {
    await timed('relics', async () => {
      for (const id of sortedKeys(DS.relics)) {
        await runCase('relics', 'relic', id, '', (p) => relicCase(id, p));
      }
    });
  }
  if (sel('encounters')) {
    await timed('encounters', async () => {
      for (const id of sortedKeys(DS.encounters)) {
        await runCase('encounters', 'encounter', id, '', (p) => encounterCase(id, p));
      }
    });
  }
  if (sel('events')) {
    await timed('events', async () => {
      for (const id of sortedKeys(DS.events_)) {
        await runCase('events', 'event', id, '', (p) => eventFreshCase(id, p));
        const ev = DS.events_[id];
        const n = Array.isArray(ev.choices) ? ev.choices.length : 0;
        for (let i = 0; i < n; i++) {
          const label = clip(String((ev.choices[i] && ev.choices[i].label) || ''), 40);
          await runCase('events', 'event', id, 'choice ' + i + ' "' + label + '": ', (p) => eventChoiceCase(id, i, p));
        }
      }
    });
  }
  if (sel('text')) {
    await timed('text', async () => {
      for (const id of sortedKeys(DS.cards)) {
        for (const up of [false, true]) {
          const tag = up ? '[upgraded] ' : '';
          let r;
          try {
            r = textCheck(id, up);
          } catch (e) {
            addFailure('text', 'card', id, SEV.THREW, tag + 'threw: ' + clip(e && e.message ? e.message : String(e), 240));
            continue;
          }
          if (r.skip) addSkip('text', r.skip);
          else if (r.problems.length) addFailure('text', 'card', id, SEV.TEXT, tag + r.problems.join(' | '));
          else stats.text.pass++;
        }
      }
    });
  }
  resetState();
  report();
}

main().catch((e) => {
  out('harness failure: ' + (e && e.stack ? e.stack : String(e)));
  out('CONTENT TESTS RESULT: FAIL');
  process.exitCode = 1;
});
