#!/usr/bin/env node
/*
 * Duskspire engine unit tests. No dependencies.
 *
 *   node tools/tests.js                 run every test
 *   node tools/tests.js --only=text     run only tests whose "group > name" contains text
 *   node tools/tests.js --list          print the test names and exit
 *
 * The headless engine and content are loaded in the contract's load order, exactly as tools/smoke.js
 * loads them (UI files are never loaded). Test content is defined in this file: ids start with t_,
 * encounters and enemies use act 0 and cards / relics / events use rarity 'special' / 'event' or act 0,
 * so none of it reaches the real random pools. Each test starts from a clean DS.run, DS.combat and seed.
 * Exit code is 1 when any test fails.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const util = require('util');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const ONLY_ARG = ARGV.find((a) => a.startsWith('--only='));
const ONLY = ONLY_ARG ? ONLY_ARG.slice('--only='.length) : '';
const LIST_ONLY = ARGV.includes('--list');
const TEST_TIMEOUT_MS = 8000;

// Engine logging is swallowed (and counted) so the report stays readable.
let engineWarnings = 0;
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => { engineWarnings++; };
console.error = () => { engineWarnings++; };
const out = (s) => process.stdout.write((s === undefined ? '' : s) + '\n');

// ---------------------------------------------------------------------------
// Loading (same order as tools/smoke.js; v2 files are optional while they are being written)
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
];
const notLoaded = [];
const loadFailures = [];
for (const rel of LOAD) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    notLoaded.push(rel);
    continue;
  }
  try {
    vm.runInThisContext(fs.readFileSync(abs, 'utf8'), { filename: abs });
  } catch (e) {
    loadFailures.push(`${rel}: ${e && e.message ? e.message : e}`);
  }
}
const DS = globalThis.DS;
if (!DS || typeof DS.Combat !== 'function' || !DS.Run) {
  out('FATAL: the engine did not load (DS.Combat / DS.Run missing).');
  for (const f of loadFailures) out('  load failure: ' + f);
  process.exitCode = 1;
  throw new Error('engine missing');
}
const DEFAULT_HOOKS = Object.assign({}, DS.hooks);

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
class Fail extends Error {}
const show = (v) => util.inspect(v, { depth: 4, breakLength: 160 }).slice(0, 400);
function ok(cond, msg) {
  if (!cond) throw new Fail(msg || 'expected the condition to hold');
}
function eq(actual, expected, msg) {
  if (!util.isDeepStrictEqual(actual, expected)) {
    throw new Fail(`${msg ? msg + ': ' : ''}expected ${show(expected)}, got ${show(actual)}`);
  }
}
function near(actual, expected, msg) {
  eq(Math.round(actual * 1000) / 1000, Math.round(expected * 1000) / 1000, msg);
}
async function throwsAsync(fn, msg) {
  let threw = false;
  try { await fn(); } catch (e) { threw = true; }
  ok(threw, msg || 'expected an exception');
}

const TESTS = [];
function test(group, name, fn) {
  TESTS.push({ group, name, fn });
}

// Event subscriptions made by a test are removed after it finishes.
let subs = [];
function listen(name) {
  const log = [];
  subs.push(DS.events.on(name, (p) => log.push(p)));
  return log;
}
function resetState() {
  for (const off of subs) {
    try { off(); } catch (e) { /* ignore */ }
  }
  subs = [];
  DS.run = null;
  DS.combat = null;
  Object.assign(DS.hooks, DEFAULT_HOOKS);
  DS.rng.seed(20240607);
}

// ---------------------------------------------------------------------------
// Test content and fixtures. Everything defined here is prefixed t_.
// ---------------------------------------------------------------------------
let seq = 0;
const nid = (p) => 't_' + p + '_' + (++seq);

function defCard(o) {
  const id = o.id || nid('card');
  DS.defineCard(Object.assign({
    name: id, class: 'colorless', type: 'attack', rarity: 'special', cost: 1, target: 'enemy',
    icon: '?', desc: 'test card', effects: [], upgrade: { desc: 'upgraded', effects: [] },
  }, o, { id }));
  return id;
}
function defEnemy(o) {
  const x = o || {};
  const id = x.id || nid('enemy');
  DS.defineEnemy(Object.assign({
    name: id, act: 0, tier: 'normal', hp: [50, 50], icon: 'E', scale: 1,
    moves: { idle: { name: 'Idle', intent: 'defend', effects: [] } },
    pattern: { type: 'sequence', moves: ['idle'], loop: true },
  }, x, { id }));
  return id;
}
// An enemy that hits the player for `dmg` every turn (no block, no modifiers).
function attacker(dmg, o) {
  return defEnemy(Object.assign({
    hp: [200, 200],
    moves: { hit: { name: 'Hit', intent: 'attack', effects: [{ op: 'damage', amount: dmg }] } },
    pattern: { type: 'sequence', moves: ['hit'], loop: true },
  }, o || {}));
}
function defEncounter(enemies, tier) {
  const id = nid('enc');
  DS.defineEncounter({ id, act: 0, tier: tier || 'normal', name: id, enemies: enemies.slice() });
  return id;
}
function defStatus(o) {
  const id = o.id || nid('status');
  DS.defineStatus(Object.assign({ name: id, desc: 'test status {n}', icon: '*', type: 'buff', stacks: true }, o, { id }));
  return id;
}
function defRelic(o) {
  const id = o.id || nid('relic');
  DS.defineRelic(Object.assign({ name: id, desc: 'test relic', icon: '*', rarity: 'event' }, o, { id }));
  return id;
}
function defPotion(o) {
  const id = o.id || nid('potion');
  DS.definePotion(Object.assign({ name: id, desc: 'test potion', icon: '!', rarity: 'common', color: '#336699', target: 'none', effects: [] }, o, { id }));
  return id;
}
function defEvent(o) {
  const id = o.id || nid('event');
  DS.defineEvent(Object.assign({ name: id, icon: '?', text: 'test', act: 0, choices: [] }, o, { id }));
  return id;
}

// Shared test cards.
const STRIKE = defCard({ id: 't_strike', name: 'Test Strike', type: 'attack', cost: 1, target: 'enemy',
  effects: [{ op: 'damage', amount: 6 }], upgrade: { desc: 'Deal 9.', effects: [{ op: 'damage', amount: 9 }] } });
const DEFEND = defCard({ id: 't_defend', name: 'Test Defend', type: 'skill', cost: 1, target: 'self',
  effects: [{ op: 'block', amount: 5 }], upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8 }] } });
const SKILL0 = defCard({ id: 't_skill0', name: 'Test Skill', type: 'skill', cost: 0, target: 'none', effects: [] });
const POWER0 = defCard({ id: 't_power0', name: 'Test Power', type: 'power', cost: 1, target: 'none', effects: [] });
const DRAW1 = defCard({ id: 't_draw1', name: 'Test Draw', type: 'skill', cost: 0, target: 'none', effects: [{ op: 'draw', amount: 1 }] });

function newRun(o) {
  const x = o || {};
  const run = {
    character: x.character || 'berserker',
    hp: x.hp !== undefined ? x.hp : 80,
    maxHp: x.maxHp !== undefined ? x.maxHp : 80,
    gold: x.gold !== undefined ? x.gold : 50,
    deck: (x.deck || []).map((id, i) => ({ uid: 'd' + i, id, upgraded: false })),
    relics: (x.relics || []).map((id) => ({ id, counter: 0 })),
    potions: x.potions || [null, null, null],
    act: 1, floor: 0, map: null, nodeId: null, seed: 1,
    stats: { fights: 0, elites: 0, bosses: 0, turns: 0, cardsPlayed: 0, damageDealt: 0, goldEarned: 0 },
    over: false, won: false, removeCount: 0, usedEvents: [], lastEvent: null, actFights: 0,
    lastEncounter: null, shop: null, roomFired: {}, pending: null,
  };
  DS.run = run;
  return run;
}

// Builds a started combat. Piles, energy and player/enemy state are set after start() so each test
// controls them. Options: enemies (ids), tier, deck (ids for start()), hand / draw / discard (ids or
// card objects), energy (default 10), php, pblock, pstatus {id: stacks}, estatus {id: stacks} (all
// enemies), eblock, run {…} (passed to newRun), seed.
async function combatOf(o) {
  const x = o || {};
  const enemyIds = x.enemies || [defEnemy({})];
  const enc = defEncounter(enemyIds, x.tier || 'normal');
  const run = newRun(Object.assign({ deck: x.deck || [] }, x.run || {}));
  DS.rng.seed(x.seed || 99);
  const c = new DS.Combat(run, enc);
  await c.start();
  const toCard = (v) => {
    if (v && typeof v === 'object' && v.uid) return v;
    return c.makeCard({ id: typeof v === 'string' ? v : v.id, upgraded: !!(v && v.upgraded) });
  };
  if (x.hand) c.hand = x.hand.map(toCard).filter(Boolean);
  if (x.draw) c.drawPile = x.draw.map(toCard).filter(Boolean);
  if (x.discard) c.discardPile = x.discard.map(toCard).filter(Boolean);
  c.player.energy = x.energy !== undefined ? x.energy : 10;
  if (x.php !== undefined) c.player.hp = x.php;
  if (x.pblock !== undefined) c.player.block = x.pblock;
  for (const k of Object.keys(x.pstatus || {})) c.player.statuses[k] = x.pstatus[k];
  for (const e of c.enemies) {
    for (const k of Object.keys(x.estatus || {})) e.statuses[k] = x.estatus[k];
    if (x.eblock !== undefined) e.block = x.eblock;
  }
  return c;
}
// Creates a card by id and puts it in hand (so canPlay's "in hand" rule passes) and plays it.
async function playId(c, id, target, up) {
  const card = c.makeCard({ id, upgraded: !!up });
  c.hand.push(card);
  let t = target;
  if (t === undefined) t = card.data.target === 'enemy' ? (c.livingEnemies()[0] || null) : null;
  return c.playCard(card, t);
}
// Runs a block effect and returns the block it granted (Value tests). Dexterity/frail are unset.
// The value is read before the block is gained, so the gain equals the resolved Value.
async function valueOf(c, spec, opts) {
  const before = c.player.block;
  await c.runEffects([{ op: 'block', amount: spec }], Object.assign({ source: c.player }, opts || {}));
  return c.player.block - before;
}
function livingHp(c) {
  return c.enemies.map((e) => e.hp);
}

// ---------------------------------------------------------------------------
// Core: rng, uid, registries, events, card data, pools, vocabularies
// ---------------------------------------------------------------------------
test('core', 'rng: the same seed gives the same sequence', () => {
  DS.rng.seed(42);
  const a = [1, 2, 3, 4, 5].map(() => DS.rng.next());
  DS.rng.seed(42);
  const b = [1, 2, 3, 4, 5].map(() => DS.rng.next());
  eq(a, b);
});
test('core', 'rng: different seeds give different sequences', () => {
  DS.rng.seed(1);
  const a = DS.rng.next();
  DS.rng.seed(2);
  const b = DS.rng.next();
  ok(a !== b, 'seeds 1 and 2 produced the same first value');
});
test('core', 'rng: next() stays inside [0, 1)', () => {
  for (let i = 0; i < 1000; i++) {
    const x = DS.rng.next();
    ok(x >= 0 && x < 1, `value ${x} out of range`);
  }
});
test('core', 'rng: int(min, max) is inclusive on both ends', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(DS.rng.int(3, 5));
  eq([...seen].sort(), [3, 4, 5]);
});
test('core', 'rng: int with max below min returns min', () => {
  eq(DS.rng.int(5, 2), 5);
});
test('core', 'rng: pick of an empty array is undefined', () => {
  eq(DS.rng.pick([]), undefined);
});
test('core', 'rng: shuffle permutes in place and returns the same array', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = DS.rng.shuffle(arr);
  ok(r === arr, 'shuffle must return the array it was given');
  eq(arr.slice().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle changed the members');
});
test('core', 'rng: chance(0) is never true and chance(1) is always true', () => {
  for (let i = 0; i < 100; i++) {
    ok(!DS.rng.chance(0), 'chance(0) returned true');
    ok(DS.rng.chance(1), 'chance(1) returned false');
  }
});
test('core', 'rng: string seeds are deterministic', () => {
  DS.rng.seed('duskspire');
  const a = [DS.rng.next(), DS.rng.next()];
  DS.rng.seed('duskspire');
  const b = [DS.rng.next(), DS.rng.next()];
  eq(a, b);
});
test('core', 'uid: 2000 generated ids are unique strings', () => {
  const s = new Set();
  for (let i = 0; i < 2000; i++) {
    const u = DS.uid();
    ok(typeof u === 'string', 'uid is not a string');
    s.add(u);
  }
  eq(s.size, 2000);
});
test('core', 'define: a duplicate card id is ignored and the first definition is kept', () => {
  const id = defCard({ id: nid('dup'), name: 'First' });
  const second = DS.defineCard({ id, name: 'Second', class: 'colorless', type: 'attack', rarity: 'special', cost: 1, target: 'none', icon: '?', desc: 'x', effects: [] });
  eq(second, undefined, 'duplicate define returned a value');
  eq(DS.cards[id].name, 'First');
});
test('core', 'define: a definition without an id is rejected quietly', () => {
  eq(DS.defineCard({ name: 'no id' }), undefined);
  eq(DS.defineRelic(null), undefined);
});
test('core', 'define: defineEnemy stores the definition under its id', () => {
  const id = defEnemy({ name: 'Stored' });
  eq(DS.enemies[id].name, 'Stored');
});
test('core', 'events: on() listeners receive the emitted payload', () => {
  const got = [];
  const off = DS.events.on('t_core:ping', (p) => got.push(p));
  DS.events.emit('t_core:ping', { n: 1 });
  off();
  eq(got, [{ n: 1 }]);
});
test('core', 'events: the function returned by on() unsubscribes', () => {
  let n = 0;
  const off = DS.events.on('t_core:unsub', () => { n++; });
  DS.events.emit('t_core:unsub', {});
  off();
  DS.events.emit('t_core:unsub', {});
  eq(n, 1);
});
test('core', 'events: off() removes a listener', () => {
  let n = 0;
  const fn = () => { n++; };
  DS.events.on('t_core:off', fn);
  DS.events.off('t_core:off', fn);
  DS.events.emit('t_core:off', {});
  eq(n, 0);
});
test('core', 'events: a throwing listener does not stop the other listeners', () => {
  let n = 0;
  const a = DS.events.on('t_core:throw', () => { throw new Error('boom'); });
  const b = DS.events.on('t_core:throw', () => { n++; });
  DS.events.emit('t_core:throw', {});
  a();
  b();
  eq(n, 1);
});
test('core', 'DS.OPS lists every combat op named in the contract', () => {
  const want = ['damage', 'lose_hp', 'block', 'apply', 'remove_status', 'multiply_status', 'heal', 'draw', 'energy',
    'discard', 'exhaust', 'add_card', 'upgrade_hand', 'gold', 'max_hp', 'repeat', 'if', 'summon', 'custom'];
  for (const op of want) ok(DS.OPS.includes(op), `DS.OPS is missing '${op}'`);
});
test('core', 'DS.OPS lists every run-level op named in the contract', () => {
  const want = ['remove_card', 'upgrade_card', 'transform_card', 'add_relic', 'add_potion', 'chance', 'fight'];
  for (const op of want) ok(DS.OPS.includes(op), `DS.OPS is missing '${op}'`);
});
test('core', 'DS.TRIGGERS lists every trigger name named in the contract', () => {
  const want = ['onCombatStart', 'onCombatEnd', 'onTurnStart', 'onTurnEnd', 'onCardPlayed', 'onAttack', 'onAttacked',
    'onDamaged', 'onBlockGained', 'onBlockBroken', 'onCardDrawn', 'onCardExhausted', 'onCardDiscarded', 'onShuffle',
    'onApplyDebuff', 'onKill', 'onEnemyDeath', 'onDeath', 'onHeal', 'onPotionUsed', 'onGoldGained', 'onPickup',
    'onRest', 'onRoomEnter', 'onCardAdded', 'onChestOpen', 'onShopEnter'];
  for (const t of want) ok(DS.TRIGGERS.includes(t), `DS.TRIGGERS is missing '${t}'`);
});
test('core', 'getCardData: an unknown id gives a safe placeholder', () => {
  const d = DS.getCardData({ id: 't_no_such_card', upgraded: false });
  eq(d.id, 't_no_such_card');
  ok(Array.isArray(d.effects), 'placeholder effects must be an array');
  ok(typeof d.desc === 'string', 'placeholder desc must be a string');
});
test('core', 'getCardData: upgraded merges the upgrade fields and adds a plus to the name', () => {
  const d = DS.getCardData({ id: STRIKE, upgraded: true });
  eq(d.name, 'Test Strike+');
  eq(d.effects, [{ op: 'damage', amount: 9 }]);
  eq(d.upgraded, true);
});
test('core', 'getCardData: non-upgraded keeps the plain name and reports upgraded false', () => {
  const d = DS.getCardData({ id: STRIKE, upgraded: false });
  eq(d.name, 'Test Strike');
  eq(d.upgraded, false);
  eq(d.effects, [{ op: 'damage', amount: 6 }]);
});
test('core', 'getCardData: resolving an upgraded card does not change the definition', () => {
  DS.getCardData({ id: STRIKE, upgraded: true });
  eq(DS.cards[STRIKE].effects, [{ op: 'damage', amount: 6 }]);
  eq(DS.cards[STRIKE].name, 'Test Strike');
});
test('core', 'cardPool: by default excludes starter, special, curse and status cards', () => {
  const pool = DS.cardPool({});
  ok(pool.length > 0, 'pool is empty');
  for (const d of pool) {
    ok(d.rarity !== 'starter' && d.rarity !== 'special', `${d.id} is ${d.rarity}`);
    ok(d.class !== 'curse' && d.class !== 'status', `${d.id} is a ${d.class} card`);
  }
});
test('core', 'cardPool: asking for rarity starter returns starter cards', () => {
  const pool = DS.cardPool({ rarity: 'starter' });
  ok(pool.length > 0, 'no starter cards');
  ok(pool.every((d) => d.rarity === 'starter'), 'a non-starter card came back');
});
test('core', 'cardPool: the class filter returns only that class', () => {
  const pool = DS.cardPool({ class: 'berserker' });
  ok(pool.length > 0, 'no berserker cards');
  ok(pool.every((d) => d.class === 'berserker'), 'a card of another class came back');
});
test('core', 'relicPool: class-specific relics appear only for their own class', () => {
  const id = defRelic({ rarity: 'event', class: 'shade' });
  ok(DS.relicPool({ rarity: 'event', class: 'shade' }).some((d) => d.id === id), 'shade relic missing for shade');
  ok(!DS.relicPool({ rarity: 'event', class: 'berserker' }).some((d) => d.id === id), 'shade relic leaked to berserker');
});
test('core', 'relicPool: starter relics are excluded unless asked for', () => {
  const id = defRelic({ rarity: 'starter' });
  ok(!DS.relicPool({}).some((d) => d.id === id), 'starter relic in default pool');
  ok(DS.relicPool({ rarity: 'starter' }).some((d) => d.id === id), 'starter relic not returned when asked');
});

// ---------------------------------------------------------------------------
// Built-in status definitions (shape only; behaviour is covered below)
// ---------------------------------------------------------------------------
const BUILTIN_IDS = ['strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'burn', 'regen', 'thorns',
  'plated_armor', 'metallicize', 'artifact', 'intangible', 'barricade', 'ritual', 'energized', 'draw_next',
  'next_turn_block', 'strength_down', 'dexterity_down', 'no_draw', 'entangle', 'buffer', 'rage', 'double_tap',
  'vigor', 'lock_on', 'shackled', 'mark', 'curl_up', 'enrage', 'angry', 'split_ready'];

test('statusdefs', 'all 33 built-in statuses are defined', () => {
  for (const id of BUILTIN_IDS) ok(DS.statuses[id], `built-in status '${id}' is not defined`);
});
test('statusdefs', 'every built-in status has a name, an icon and a description', () => {
  for (const id of BUILTIN_IDS) {
    const d = DS.statuses[id];
    if (!d) continue;
    ok(typeof d.name === 'string' && d.name, `${id} has no name`);
    ok(typeof d.icon === 'string' && d.icon, `${id} has no icon`);
    ok(typeof d.desc === 'string' && d.desc, `${id} has no desc`);
  }
});
test('statusdefs', 'weak and vulnerable decay at turn end; weak deals 0.75x and vulnerable takes 1.5x', () => {
  eq(DS.statuses.weak.decay, 'turn_end');
  eq(DS.statuses.weak.mods.attackDealtMul, 0.75);
  eq(DS.statuses.vulnerable.decay, 'turn_end');
  eq(DS.statuses.vulnerable.mods.attackTakenMul, 1.5);
});
test('statusdefs', 'frail reduces block to 0.75x and decays at turn end', () => {
  eq(DS.statuses.frail.mods.blockMul, 0.75);
  eq(DS.statuses.frail.decay, 'turn_end');
});
test('statusdefs', 'poison decays at turn start; burn and regen decay at turn end', () => {
  eq(DS.statuses.poison.decay, 'turn_start');
  eq(DS.statuses.burn.decay, 'turn_end');
  eq(DS.statuses.regen.decay, 'turn_end');
});
test('statusdefs', 'strength and dexterity are stacking buffs that add per stack', () => {
  eq(DS.statuses.strength.stacks, true);
  eq(DS.statuses.strength.mods.attackDealtAdd, 1);
  eq(DS.statuses.dexterity.mods.blockAdd, 1);
});
test('statusdefs', 'barricade is non-stacking; no_draw and entangle expire at turn end', () => {
  eq(DS.statuses.barricade.stacks, false);
  eq(DS.statuses.no_draw.expire, 'turn_end');
  eq(DS.statuses.entangle.expire, 'turn_end');
});
test('statusdefs', 'rage and intangible: rage expires at turn end, intangible decays at turn end', () => {
  eq(DS.statuses.rage.expire, 'turn_end');
  eq(DS.statuses.intangible.decay, 'turn_end');
});
test('statusdefs', 'lock_on mirrors vulnerable (1.5x damage taken)', () => {
  eq(DS.statuses.lock_on.mods.attackTakenMul, 1.5);
});

// ---------------------------------------------------------------------------
// Damage, block and HP loss
// ---------------------------------------------------------------------------
test('damage', 'strength adds its stacks to attack damage (6 + 2 = 8)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { strength: 2 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 92);
});
test('damage', 'strength applies to every hit of a multi-hit attack', async () => {
  const id = defCard({ effects: [{ op: 'damage', amount: 4, times: 2 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { strength: 1 } });
  await playId(c, id);
  eq(c.enemies[0].hp, 90, 'two hits of 5');
});
test('damage', 'weak deals 25% less damage: 6 becomes 4 (4.5 rounded down)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { weak: 1 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 96);
});
test('damage', 'weak on an 8-damage attack deals exactly 6', async () => {
  const id = defCard({ effects: [{ op: 'damage', amount: 8 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { weak: 2 } });
  await playId(c, id);
  eq(c.enemies[0].hp, 94, 'weak 2 is still 0.75x, not 0.5x');
});
test('damage', 'vulnerable makes the target take 50% more: 6 becomes 9', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { vulnerable: 1 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 91);
});
test('damage', 'weak on the attacker and vulnerable on the target multiply (6 * 0.75 * 1.5 = 6.75 -> 6)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { weak: 1 }, estatus: { vulnerable: 1 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 94);
});
test('damage', 'lock_on takes 50% more attack damage like vulnerable', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { lock_on: 1 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 91);
});
test('damage', 'vigor adds its stacks to the next attack, then is removed', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { vigor: 5 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 89, '6 + 5 = 11');
  eq(c.player.statuses.vigor, undefined, 'vigor was not removed');
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 83, 'second attack should be a plain 6');
});
test('damage', 'a negative total is floored at zero damage', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { strength: -10 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 100);
});
test('damage', 'block absorbs damage before HP (8 damage into 5 block costs 3 HP)', async () => {
  const c = await combatOf({ enemies: [attacker(8)], pblock: 5 });
  await c.runEffects([{ op: 'damage', amount: 8, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 77);
  eq(c.player.block, 0);
});
test('damage', 'block that fully absorbs a hit leaves HP alone', async () => {
  const c = await combatOf({ enemies: [attacker(6)], pblock: 10 });
  await c.runEffects([{ op: 'damage', amount: 6, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 80);
  eq(c.player.block, 4);
});
test('damage', 'an enemy with strength hits harder (6 + 2 = 8)', async () => {
  const c = await combatOf({ enemies: [attacker(6)] });
  c.enemies[0].statuses.strength = 2;
  await c.runEffects([{ op: 'damage', amount: 6, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 72);
});
test('damage', 'dexterity adds to card block (5 + 2 = 7)', async () => {
  const c = await combatOf({ pstatus: { dexterity: 2 } });
  await playId(c, DEFEND);
  eq(c.player.block, 7);
});
test('damage', 'frail gives 25% less card block (5 becomes 3)', async () => {
  const c = await combatOf({ pstatus: { frail: 1 } });
  await playId(c, DEFEND);
  eq(c.player.block, 3);
});
test('damage', 'dexterity does not modify block granted by a status trigger (rage)', async () => {
  const c = await combatOf({ pstatus: { dexterity: 3, rage: 4 } });
  await playId(c, STRIKE);
  eq(c.player.block, 4);
});
test('damage', 'lose_hp ignores block', async () => {
  const c = await combatOf({ pblock: 10 });
  await c.runEffects([{ op: 'lose_hp', amount: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 77);
  eq(c.player.block, 10);
});
test('damage', 'heal is capped at max HP', async () => {
  const c = await combatOf({ php: 70 });
  await c.runEffects([{ op: 'heal', amount: 20, to: 'self' }], {});
  eq(c.player.hp, 80);
});
test('damage', 'each hit of a multi-hit is blocked separately (5 block, 4 x 3 hits -> 7 HP lost)', async () => {
  const c = await combatOf({ enemies: [attacker(4)], pblock: 5 });
  await c.runEffects([{ op: 'damage', amount: 4, times: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 73);
  eq(c.player.block, 0);
});
test('damage', 'intangible reduces an attack to 1 damage', async () => {
  const c = await combatOf({ enemies: [attacker(10)], pstatus: { intangible: 1 } });
  await c.runEffects([{ op: 'damage', amount: 10, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 79);
});
test('damage', 'intangible also caps HP loss from lose_hp to 1', async () => {
  const c = await combatOf({ pstatus: { intangible: 1 } });
  await c.runEffects([{ op: 'lose_hp', amount: 9, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 79);
});
test('damage', 'buffer prevents the next HP loss and is used up', async () => {
  const c = await combatOf({ enemies: [attacker(5)], pstatus: { buffer: 1 } });
  await c.runEffects([{ op: 'damage', amount: 5, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 80);
  eq(c.player.statuses.buffer, undefined);
});
test('damage', 'buffer is not spent on damage that block fully absorbs', async () => {
  const c = await combatOf({ enemies: [attacker(5)], pblock: 5, pstatus: { buffer: 1 } });
  await c.runEffects([{ op: 'damage', amount: 5, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 80);
  eq(c.player.statuses.buffer, 1);
});
test('damage', 'buffer 2 prevents two HP losses; the third hit lands', async () => {
  const c = await combatOf({ enemies: [attacker(3)], pstatus: { buffer: 2 } });
  await c.runEffects([{ op: 'damage', amount: 3, times: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 77);
  eq(c.player.statuses.buffer, undefined);
});
test('damage', 'artifact negates the next debuff from an opponent and is used up', async () => {
  const c = await combatOf({ enemies: [attacker(1)], pstatus: { artifact: 1 } });
  await c.runEffects([{ op: 'apply', status: 'weak', amount: 2, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.weak, undefined, 'weak was applied');
  eq(c.player.statuses.artifact, undefined, 'artifact was not used up');
});
test('damage', 'artifact stops only one debuff', async () => {
  const c = await combatOf({ enemies: [attacker(1)], pstatus: { artifact: 1 } });
  await c.runEffects([{ op: 'apply', status: 'weak', amount: 1, to: 'player' }], { source: c.enemies[0] });
  await c.runEffects([{ op: 'apply', status: 'weak', amount: 1, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.weak, 1);
});
test('damage', 'artifact does not stop buffs', async () => {
  const c = await combatOf({ enemies: [attacker(1)], pstatus: { artifact: 1 } });
  await c.runEffects([{ op: 'apply', status: 'strength', amount: 2, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.strength, 2);
  eq(c.player.statuses.artifact, 1);
});
test('damage', 'thorns deals its stacks back to whoever hit the owner', async () => {
  const c = await combatOf({ enemies: [attacker(5, { hp: [100, 100] })], pstatus: { thorns: 3 } });
  await c.runEffects([{ op: 'damage', amount: 5, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 75);
  eq(c.enemies[0].hp, 97);
});
test('damage', 'thorns still triggers when the attack is fully blocked', async () => {
  const c = await combatOf({ enemies: [attacker(3, { hp: [100, 100] })], pblock: 10, pstatus: { thorns: 3 } });
  await c.runEffects([{ op: 'damage', amount: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 80);
  eq(c.player.block, 7);
  eq(c.enemies[0].hp, 97);
});
test('damage', 'curl_up grants block after the first hit and is then removed', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { curl_up: 6 } });
  await c.runEffects([{ op: 'damage', amount: 10, to: 'target' }], { source: c.player, target: c.enemies[0] });
  eq(c.enemies[0].hp, 90, 'the first hit should not be absorbed');
  eq(c.enemies[0].block, 6);
  eq(c.enemies[0].statuses.curl_up, undefined);
});
test('damage', 'a second hit is absorbed by the curl_up block', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { curl_up: 6 } });
  await c.runEffects([{ op: 'damage', amount: 10, to: 'target' }], { source: c.player, target: c.enemies[0] });
  await c.runEffects([{ op: 'damage', amount: 4, to: 'target' }], { source: c.player, target: c.enemies[0] });
  eq(c.enemies[0].hp, 90);
  eq(c.enemies[0].block, 2);
});
test('damage', 'angry gives the enemy 1 strength when it is hit', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { angry: 1 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].statuses.strength, 1);
});
test('damage', 'enrage gives the enemy strength when the player plays a skill', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { enrage: 2 } });
  await playId(c, SKILL0);
  eq(c.enemies[0].statuses.strength, 2);
});
test('damage', 'rage gives block for attacks only, not skills', async () => {
  const c = await combatOf({ pstatus: { rage: 2 } });
  await playId(c, SKILL0);
  eq(c.player.block, 0, 'skill granted rage block');
  await playId(c, STRIKE);
  eq(c.player.block, 2, 'attack did not grant rage block');
});
test('damage', 'mark has no innate effect on damage', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { mark: 5 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 94);
});

// ---------------------------------------------------------------------------
// Statuses that act over turns (decay, expiry, end-of-turn and start-of-turn effects)
// ---------------------------------------------------------------------------
test('turns', 'poison on an enemy: loses its stacks at turn start, then 1 less each turn', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { poison: 3 } });
  await c.endTurn();
  eq(c.enemies[0].hp, 47);
  eq(c.enemies[0].statuses.poison, 2);
  await c.endTurn();
  eq(c.enemies[0].hp, 45);
  eq(c.enemies[0].statuses.poison, 1);
  await c.endTurn();
  eq(c.enemies[0].hp, 44);
  eq(c.enemies[0].statuses.poison, undefined);
});
test('turns', 'poison on the player is applied at the start of the player turn', async () => {
  const c = await combatOf({ pstatus: { poison: 3 } });
  await c.endTurn();
  eq(c.player.hp, 77);
  eq(c.player.statuses.poison, 2);
});
test('turns', 'burn on the player: loses its stacks at turn end, then 1 less', async () => {
  const c = await combatOf({ pstatus: { burn: 3 } });
  await c.endTurn();
  eq(c.player.hp, 77);
  eq(c.player.statuses.burn, 2);
});
test('turns', 'burn on an enemy: loses HP at the end of its turn', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { burn: 2 } });
  await c.endTurn();
  eq(c.enemies[0].hp, 48);
  eq(c.enemies[0].statuses.burn, 1);
});
test('turns', 'regen heals its stacks at turn end, then 1 less', async () => {
  const c = await combatOf({ php: 70, pstatus: { regen: 4 } });
  await c.endTurn();
  eq(c.player.hp, 74);
  eq(c.player.statuses.regen, 3);
});
test('turns', 'regen never heals above max HP', async () => {
  const c = await combatOf({ php: 79, pstatus: { regen: 5 } });
  await c.endTurn();
  eq(c.player.hp, 80);
  eq(c.player.statuses.regen, 4);
});
test('turns', 'metallicize block at turn end is still there during the enemy attack, and it does not decay', async () => {
  const c = await combatOf({ enemies: [attacker(5)], pstatus: { metallicize: 3 } });
  await c.endTurn();
  eq(c.player.hp, 78, 'block of 3 should absorb 3 of the 5 damage');
  eq(c.player.statuses.metallicize, 3);
});
test('turns', 'plated armor gives block at turn end and loses 1 stack when an attack costs HP', async () => {
  const c = await combatOf({ enemies: [attacker(6)], pstatus: { plated_armor: 4 } });
  await c.endTurn();
  eq(c.player.hp, 78, 'block of 4 should absorb 4 of 6');
  eq(c.player.statuses.plated_armor, 3);
});
test('turns', 'plated armor is not reduced by an attack that is fully blocked', async () => {
  const c = await combatOf({ enemies: [attacker(3)], pstatus: { plated_armor: 4 } });
  await c.endTurn();
  eq(c.player.hp, 80);
  eq(c.player.statuses.plated_armor, 4);
});
test('turns', 'plated armor is not reduced by burn (only by attacks)', async () => {
  const c = await combatOf({ pstatus: { plated_armor: 3, burn: 1 } });
  await c.endTurn();
  eq(c.player.statuses.plated_armor, 3);
});
test('turns', 'ritual adds strength to its owner at each turn end', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { ritual: 2 } });
  await c.endTurn();
  eq(c.enemies[0].statuses.strength, 2);
  await c.endTurn();
  eq(c.enemies[0].statuses.strength, 4);
});
test('turns', 'energized gives extra energy next turn, then is removed', async () => {
  const c = await combatOf({ pstatus: { energized: 2 } });
  await c.endTurn();
  eq(c.player.energy, 5);
  eq(c.player.statuses.energized, undefined);
});
test('turns', 'draw_next draws extra cards at turn start, then is removed', async () => {
  const c = await combatOf({ hand: [], draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0], pstatus: { draw_next: 2 } });
  await c.endTurn();
  eq(c.hand.length, 7);
  eq(c.player.statuses.draw_next, undefined);
});
test('turns', 'next_turn_block grants block at turn start, then is removed', async () => {
  const c = await combatOf({ pstatus: { next_turn_block: 6 } });
  await c.endTurn();
  eq(c.player.block, 6);
  eq(c.player.statuses.next_turn_block, undefined);
});
test('turns', 'strength_down reduces strength at turn end and is then removed', async () => {
  const c = await combatOf({ pstatus: { strength: 3, strength_down: 2 } });
  await c.endTurn();
  eq(c.player.statuses.strength, 1);
  eq(c.player.statuses.strength_down, undefined);
});
test('turns', 'dexterity_down reduces dexterity at turn end and is then removed', async () => {
  const c = await combatOf({ pstatus: { dexterity: 2, dexterity_down: 1 } });
  await c.endTurn();
  eq(c.player.statuses.dexterity, 1);
  eq(c.player.statuses.dexterity_down, undefined);
});
test('turns', 'shackled gives an enemy strength at its turn end, then is removed', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { shackled: 3 } });
  await c.endTurn();
  eq(c.enemies[0].statuses.strength, 3);
  eq(c.enemies[0].statuses.shackled, undefined);
});
test('turns', 'intangible with 1 stack is gone after the turn ends', async () => {
  const c = await combatOf({ pstatus: { intangible: 1 } });
  await c.endTurn();
  eq(c.player.statuses.intangible, undefined);
});
test('turns', 'intangible with 2 stacks drops to 1 after one turn end', async () => {
  const c = await combatOf({ pstatus: { intangible: 2 } });
  await c.endTurn();
  eq(c.player.statuses.intangible, 1);
});
test('turns', 'weak on an enemy loses one stack at the end of the enemy turn', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { weak: 2 } });
  await c.endTurn();
  eq(c.enemies[0].statuses.weak, 1);
});
test('turns', 'weak on the player loses one stack at the end of the player turn', async () => {
  const c = await combatOf({ pstatus: { weak: 2 } });
  await c.endTurn();
  eq(c.player.statuses.weak, 1);
});
test('turns', 'vulnerable on the player loses one stack at the end of the player turn', async () => {
  const c = await combatOf({ pstatus: { vulnerable: 2 } });
  await c.endTurn();
  eq(c.player.statuses.vulnerable, 1);
});
test('turns', 'frail loses one stack at the end of the player turn', async () => {
  const c = await combatOf({ pstatus: { frail: 2 } });
  await c.endTurn();
  eq(c.player.statuses.frail, 1);
});
test('turns', 'lock_on on an enemy is removed at the end of its turn (1 stack)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })], estatus: { lock_on: 1 } });
  await c.endTurn();
  eq(c.enemies[0].statuses.lock_on, undefined);
});
test('turns', 'no_draw stops every draw while it lasts', async () => {
  const c = await combatOf({ draw: [SKILL0, SKILL0, SKILL0], pstatus: { no_draw: 1 } });
  const n = await c.draw(3);
  eq(n, 0);
  eq(c.drawPile.length, 3);
});
test('turns', 'no_draw expires at the end of the turn', async () => {
  const c = await combatOf({ pstatus: { no_draw: 1 } });
  await c.endTurn();
  eq(c.player.statuses.no_draw, undefined);
});
test('turns', 'entangle blocks attacks but not skills', async () => {
  const c = await combatOf({ pstatus: { entangle: 1 } });
  const atk = c.makeCard({ id: STRIKE });
  const skl = c.makeCard({ id: DEFEND });
  c.hand = [atk, skl];
  ok(!c.canPlay(atk).ok, 'an attack was playable while entangled');
  ok(c.canPlay(skl).ok, 'a skill was refused while entangled');
});
test('turns', 'entangle expires at the end of the turn', async () => {
  const c = await combatOf({ pstatus: { entangle: 1 } });
  await c.endTurn();
  const atk = c.makeCard({ id: STRIKE });
  c.hand = [atk];
  ok(c.canPlay(atk).ok, 'attack still refused after the turn ended');
});
test('turns', 'double_tap plays the next two attacks twice, then the third once', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { double_tap: 2 } });
  await playId(c, STRIKE);
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 76, 'two doubled 6-damage attacks');
  eq(c.player.statuses.double_tap, undefined);
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 70);
});
test('turns', 'double_tap does not double skills', async () => {
  const c = await combatOf({ pstatus: { double_tap: 1 } });
  await playId(c, SKILL0);
  eq(c.player.statuses.double_tap, 1);
});
test('turns', 'a doubled attack triggers on-card-played effects only once (rage gives 2 block, not 4)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { double_tap: 1, rage: 2 } });
  await playId(c, STRIKE);
  eq(c.player.block, 2);
});
test('turns', 'split_ready and mark are markers: they change no damage or block', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { split_ready: 1 }, pstatus: { mark: 2 } });
  await playId(c, STRIKE);
  eq(c.enemies[0].hp, 94);
  await c.endTurn();
  eq(c.enemies[0].statuses.split_ready, 1, 'split_ready should not decay');
});
test('turns', 'barricade does not stack: applying it twice leaves one stack and it keeps block', async () => {
  const c = await combatOf({ pblock: 8 });
  await c.runEffects([{ op: 'apply', status: 'barricade', amount: 1, to: 'self' }, { op: 'apply', status: 'barricade', amount: 1, to: 'self' }], { source: c.player });
  eq(c.player.statuses.barricade, 1);
  await c.endTurn();
  eq(c.player.block, 8);
});
test('turns', 'the turn counter goes up by one each time the turn ends', async () => {
  const c = await combatOf({});
  eq(c.turn, 1);
  await c.endTurn();
  eq(c.turn, 2);
});

// ---------------------------------------------------------------------------
// Trigger semantics: when, every, oncePerTurn, oncePerCombat, fromAttack, and each trigger name
// ---------------------------------------------------------------------------
const SKILL1 = defCard({ id: nid('skill1'), name: 'Test Skill 1', type: 'skill', cost: 1, target: 'none', effects: [] });
const SKILL2 = defCard({ id: nid('skill2'), name: 'Test Skill 2', type: 'skill', cost: 2, target: 'none', effects: [] });
const EXH = defCard({ id: nid('exh'), name: 'Exhaust Test', type: 'skill', cost: 0, target: 'none', exhaust: true, effects: [] });
const ETH = defCard({ id: nid('eth'), name: 'Ethereal Test', type: 'skill', cost: 0, target: 'none', ethereal: true, effects: [] });
const RET = defCard({ id: nid('ret'), name: 'Retain Test', type: 'skill', cost: 0, target: 'none', retain: true, effects: [] });
const INN = defCard({ id: nid('inn'), name: 'Innate Test', type: 'skill', cost: 0, target: 'none', innate: true, effects: [] });
const POWER = defCard({ id: nid('pow'), name: 'Power Test', type: 'power', cost: 0, target: 'none', effects: [{ op: 'block', amount: 1 }] });
const HIT2 = defCard({ id: nid('hit2'), name: 'Hit Test', type: 'attack', cost: 1, target: 'enemy', effects: [{ op: 'damage', amount: 6 }] });
const GOLD5 = defCard({ id: nid('gold5'), name: 'Gold Test', type: 'skill', cost: 0, target: 'none', effects: [{ op: 'gold', amount: 5 }] });

test('triggers', 'a when.cardType trigger fires only for cards of that type', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { cardType: 'attack' }, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL0);
  eq(c.player.block, 0, 'skill fired an attack-only trigger');
  await playId(c, STRIKE);
  eq(c.player.block, 1);
});
test('triggers', 'when.costAtLeast only fires for cards that cost at least that much', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { costAtLeast: 2 }, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL1);
  eq(c.player.block, 0);
  await playId(c, SKILL2);
  eq(c.player.block, 1);
});
test('triggers', 'when.turn fires only on that turn', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { turn: 2 }, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL0);
  eq(c.player.block, 0, 'fired on turn 1');
  await c.endTurn();
  await playId(c, SKILL0);
  eq(c.player.block, 1, 'did not fire on turn 2');
});
test('triggers', 'when.hpBelowPct fires only below that percentage of max HP', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { hpBelowPct: 50 }, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL0);
  eq(c.player.block, 0, 'fired at full HP');
  c.player.hp = 30;
  await playId(c, SKILL0);
  eq(c.player.block, 1, 'did not fire at 37% HP');
});
test('triggers', 'when.hpAbovePct fires only above that percentage of max HP', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { hpAbovePct: 50 }, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  c.player.hp = 30;
  await playId(c, SKILL0);
  eq(c.player.block, 0, 'fired at 37% HP');
  c.player.hp = 60;
  await playId(c, SKILL0);
  eq(c.player.block, 1);
});
test('triggers', 'when.roomType fires only in a matching room (elite here, not a normal fight)', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { when: { roomType: 'elite' }, effects: [{ op: 'block', amount: 1 }] } } });
  const normal = await combatOf({ pstatus: { [s]: 1 } });
  await playId(normal, SKILL0);
  eq(normal.player.block, 0, 'fired in a normal fight');
  const elite = await combatOf({ tier: 'elite', pstatus: { [s]: 1 } });
  await playId(elite, SKILL0);
  eq(elite.player.block, 1, 'did not fire in an elite fight');
});
test('triggers', 'every: 3 fires on the 3rd and 6th occurrence only', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { every: 3, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  for (let i = 0; i < 6; i++) await playId(c, SKILL0);
  eq(c.player.block, 2);
});
test('triggers', 'oncePerTurn fires once each turn, so two turns give two firings', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { oncePerTurn: true, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL0);
  await playId(c, SKILL0);
  await playId(c, SKILL0);
  eq(c.player.statuses.strength, 1, 'fired more than once in turn 1');
  await c.endTurn();
  await playId(c, SKILL0);
  await playId(c, SKILL0);
  eq(c.player.statuses.strength, 2, 'did not fire again in turn 2');
});
test('triggers', 'oncePerCombat fires a single time for the whole fight', async () => {
  const s = defStatus({ triggers: { onCardPlayed: { oncePerCombat: true, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, SKILL0);
  await playId(c, SKILL0);
  await c.endTurn();
  await playId(c, SKILL0);
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'fromAttack: an onDamaged listener with fromAttack true ignores burn (non-attack HP loss)', async () => {
  const s = defStatus({ triggers: { onDamaged: { when: { fromAttack: true }, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } } });
  const c = await combatOf({ enemies: [attacker(3)], pstatus: { [s]: 1, burn: 1 } });
  await c.endTurn();
  eq(c.player.statuses.strength, 1, 'only the attack should have counted');
});
test('triggers', 'onAttack fires on the attacker when its attack lands', async () => {
  const s = defStatus({ triggers: { onAttack: [{ op: 'block', amount: 1 }] } });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { [s]: 1 } });
  await playId(c, STRIKE);
  eq(c.player.block, 1);
});
test('triggers', 'onAttacked fires on the defender even when the hit is fully blocked', async () => {
  const s = defStatus({ triggers: { onAttacked: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ enemies: [attacker(3)], pblock: 10, pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'damage', amount: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onApplyDebuff fires on the applier when it debuffs an opponent', async () => {
  const s = defStatus({ triggers: { onApplyDebuff: [{ op: 'block', amount: 2 }] } });
  const debuff = defCard({ type: 'skill', cost: 0, target: 'enemy', effects: [{ op: 'apply', status: 'weak', amount: 1 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { [s]: 1 } });
  await playId(c, debuff);
  eq(c.player.block, 2);
});
test('triggers', 'onKill fires on the killer, and only after a kill', async () => {
  const s = defStatus({ triggers: { onKill: [{ op: 'block', amount: 4 }] } });
  const c = await combatOf({ enemies: [defEnemy({ hp: [5, 5] })], pstatus: { [s]: 1 } });
  await playId(c, STRIKE);
  eq(c.player.block, 4);
  const c2 = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { [s]: 1 } });
  await playId(c2, STRIKE);
  eq(c2.player.block, 0, 'onKill fired without a kill');
});
test('triggers', 'onEnemyDeath fires once for every enemy that dies', async () => {
  const s = defStatus({ triggers: { onEnemyDeath: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const sweep = defCard({ target: 'all_enemies', effects: [{ op: 'damage', amount: 5 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [1, 1] }), defEnemy({ hp: [1, 1] })], pstatus: { [s]: 1 } });
  await playId(c, sweep, null);
  eq(c.player.statuses.strength, 2);
});
test('triggers', 'onDeath on an enemy fires when it dies, with the killer as the target', async () => {
  const dying = defEnemy({ hp: [1, 1], triggers: { onDeath: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }] } });
  const c = await combatOf({ enemies: [dying] });
  await playId(c, STRIKE);
  eq(c.player.statuses.vulnerable, 1);
});
test('triggers', 'onBlockBroken fires when an attack takes the last of the block', async () => {
  const s = defStatus({ triggers: { onBlockBroken: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ enemies: [attacker(8)], pblock: 5, pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'damage', amount: 8, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onBlockGained fires when block is gained', async () => {
  const s = defStatus({ triggers: { onBlockGained: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, DEFEND);
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onCardDrawn fires once per card drawn', async () => {
  const s = defStatus({ triggers: { onCardDrawn: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ draw: [SKILL0, SKILL0, SKILL0], pstatus: { [s]: 1 } });
  await c.draw(3);
  eq(c.player.statuses.strength, 3, 'three draws should each add 1 strength');
});
test('triggers', 'onCardExhausted fires when a card is exhausted', async () => {
  const s = defStatus({ triggers: { onCardExhausted: [{ op: 'block', amount: 1 }] } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, EXH);
  eq(c.player.block, 1);
});
test('triggers', 'onCardDiscarded fires for discards made by effects, not for end-of-turn discards', async () => {
  const s = defStatus({ triggers: { onCardDiscarded: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0], hand: [SKILL0], pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'discard', amount: 1 }], { source: c.player });
  eq(c.player.statuses.strength, 1, 'effect discard did not fire');
  await c.endTurn();
  eq(c.player.statuses.strength, 1, 'end-of-turn discard fired');
});
test('triggers', 'onShuffle fires when the discard pile is shuffled into the draw pile', async () => {
  const s = defStatus({ triggers: { onShuffle: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ hand: [], draw: [], discard: [SKILL0, SKILL0], pstatus: { [s]: 1 } });
  await c.draw(1);
  eq(c.player.statuses.strength, 1, 'the shuffle should have fired once');
});
test('triggers', 'onHeal fires only when HP is actually gained', async () => {
  const s = defStatus({ triggers: { onHeal: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'heal', amount: 5, to: 'self' }], {});
  eq(c.player.statuses.strength, undefined, 'healing at full HP fired onHeal');
  c.player.hp = 70;
  await c.runEffects([{ op: 'heal', amount: 5, to: 'self' }], {});
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onPotionUsed fires when a potion is drunk', async () => {
  const s = defStatus({ triggers: { onPotionUsed: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const pid = defPotion({ effects: [{ op: 'heal', amount: 1 }] });
  const c = await combatOf({ pstatus: { [s]: 1 }, run: { potions: [pid, null, null] } });
  await c.usePotion(0, null);
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onGoldGained fires for a positive gold change made in combat', async () => {
  const s = defStatus({ triggers: { onGoldGained: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await playId(c, GOLD5, null);
  eq(c.player.statuses.strength, 1);
  eq(DS.run.gold, 55);
});
test('triggers', 'onDamaged fires for any HP loss, including lose_hp', async () => {
  const s = defStatus({ triggers: { onDamaged: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'lose_hp', amount: 2, to: 'self' }], {});
  eq(c.player.statuses.strength, 1);
});
test('triggers', 'onAttacked fires once for each hit of a multi-hit attack', async () => {
  const s = defStatus({ triggers: { onAttacked: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] } });
  const c = await combatOf({ enemies: [attacker(3)], pstatus: { [s]: 1 } });
  await c.runEffects([{ op: 'damage', amount: 1, times: 2, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.statuses.strength, 2);
});
test('triggers', 'onTurnStart and onTurnEnd fire for the player once per turn', async () => {
  const s = defStatus({ triggers: {
    onTurnStart: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
    onTurnEnd: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
  } });
  const c = await combatOf({ pstatus: { [s]: 1 } });
  eq(c.player.statuses.strength, undefined, 'the status was added after the turn started');
  await c.endTurn();
  eq(c.player.statuses.strength, 2, 'end of turn and next turn start should both fire once');
});
test('triggers', 'onCombatStart on a relic fires when the fight begins', async () => {
  const rid = defRelic({ triggers: { onCombatStart: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }] } });
  const c = await combatOf({ run: { relics: [rid] } });
  eq(c.player.statuses.strength, 2);
});
test('triggers', 'onCombatEnd on a relic fires on victory', async () => {
  const rid = defRelic({ triggers: { onCombatEnd: [{ op: 'gold', amount: 10 }] } });
  const c = await combatOf({ enemies: [defEnemy({ hp: [1, 1] })], run: { relics: [rid], gold: 50 } });
  await playId(c, STRIKE);
  eq(c.phase, 'won');
  eq(DS.run.gold, 60);
});
test('triggers', 'onCombatEnd does not fire on defeat', async () => {
  const rid = defRelic({ triggers: { onCombatEnd: [{ op: 'gold', amount: 10 }] } });
  const c = await combatOf({ enemies: [attacker(999)], php: 5, run: { relics: [rid], gold: 50 } });
  await c.endTurn();
  eq(c.phase, 'lost');
  eq(DS.run.gold, 50);
});
test('triggers', 'a relic every: 2 fires on every second card played', async () => {
  const rid = defRelic({ triggers: { onCardPlayed: { every: 2, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ run: { relics: [rid] } });
  for (let i = 0; i < 4; i++) await playId(c, SKILL0);
  eq(c.player.block, 2);
});
test('triggers', 'a relic passive energy of 1 gives 4 energy each turn', async () => {
  const rid = defRelic({ passive: { energy: 1 } });
  const c = await combatOf({ run: { relics: [rid] } });
  await c.endTurn();
  eq(c.player.energy, 4);
});
test('triggers', 'a relic passive draw of 1 draws one more card each turn', async () => {
  const rid = defRelic({ passive: { draw: 1 } });
  const c = await combatOf({ deck: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0], run: { relics: [rid] } });
  eq(c.hand.length, 6);
});
test('triggers', 'a relic passive potionSlots of 1 gives 4 potion slots', async () => {
  const rid = defRelic({ passive: { potionSlots: 1 } });
  newRun({ relics: [rid] });
  eq(DS.Run.potionSlots(), 4);
});
test('triggers', 'an onCardPlayed relic with a counter respects the counter across a fight', async () => {
  const rid = defRelic({ triggers: { onCardPlayed: { every: 3, effects: [{ op: 'block', amount: 1 }] } } });
  const c = await combatOf({ run: { relics: [rid] } });
  for (let i = 0; i < 2; i++) await playId(c, SKILL0);
  eq(c.player.block, 0);
  await playId(c, SKILL0);
  eq(c.player.block, 1);
});

// ---------------------------------------------------------------------------
// Combat operations (one test per op, plus the important variants)
// ---------------------------------------------------------------------------
test('ops', 'damage with times hits every living enemy for "all_enemies" cards', async () => {
  const sweep = defCard({ target: 'all_enemies', effects: [{ op: 'damage', amount: 3, times: 2 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] }), defEnemy({ hp: [100, 100] })] });
  await playId(c, sweep, null);
  eq(livingHp(c), [94, 94]);
});
test('ops', 'all_enemies skips enemies that are already dead', async () => {
  const sweep = defCard({ target: 'all_enemies', effects: [{ op: 'damage', amount: 3 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] }), defEnemy({ hp: [100, 100] })] });
  c.enemies[0].dead = true;
  c.enemies[0].hp = 0;
  await playId(c, sweep, null);
  eq(c.enemies[1].hp, 97);
  eq(c.enemies[0].hp, 0);
});
test('ops', 'random_enemy only ever picks living enemies', async () => {
  const pick = defCard({ target: 'random_enemy', effects: [{ op: 'damage', amount: 1 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] }), defEnemy({ hp: [100, 100] })] });
  c.enemies[0].dead = true;
  c.enemies[0].hp = 0;
  for (let i = 0; i < 10; i++) await playId(c, pick, null);
  eq(c.enemies[1].hp, 90);
});
test('ops', 'damage onKill runs when the hit is lethal', async () => {
  const id = defCard({ effects: [{ op: 'damage', amount: 10, onKill: [{ op: 'gold', amount: 7 }] }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [5, 5] })] });
  await playId(c, id);
  eq(DS.run.gold, 57);
});
test('ops', 'damage onKill does not run when the hit is not lethal', async () => {
  const id = defCard({ effects: [{ op: 'damage', amount: 10, onKill: [{ op: 'gold', amount: 7 }] }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [50, 50] })] });
  await playId(c, id);
  eq(DS.run.gold, 50);
});
test('ops', 'lose_hp on a card hits the player for the amount', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'lose_hp', amount: 4 }] });
  const c = await combatOf({});
  await playId(c, id);
  eq(c.player.hp, 76);
});
test('ops', 'block with amount 0 grants no block', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'block', amount: 0 }] });
  const c = await combatOf({});
  await playId(c, id);
  eq(c.player.block, 0);
});
test('ops', 'apply adds stacks each time it is played', async () => {
  const id = defCard({ target: 'enemy', effects: [{ op: 'apply', status: 'weak', amount: 2 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, id);
  await playId(c, id);
  eq(c.enemies[0].statuses.weak, 4);
});
test('ops', 'apply with a negative amount reduces stacks and removes the status at zero', async () => {
  const add = defCard({ target: 'enemy', effects: [{ op: 'apply', status: 'weak', amount: 2 }] });
  const sub = defCard({ target: 'enemy', effects: [{ op: 'apply', status: 'weak', amount: -2 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, add);
  await playId(c, sub);
  eq(c.enemies[0].statuses.weak, undefined);
});
test('ops', 'a negative apply never takes a non-negative status below zero', async () => {
  const sub = defCard({ target: 'enemy', effects: [{ op: 'apply', status: 'weak', amount: -3 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { weak: 1 } });
  await playId(c, sub);
  eq(c.enemies[0].statuses.weak, undefined);
});
test('ops', 'remove_status removes the status entirely', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'remove_status', status: 'strength', to: 'self' }] });
  const c = await combatOf({ pstatus: { strength: 5 } });
  await playId(c, id);
  eq(c.player.statuses.strength, undefined);
});
test('ops', 'multiply_status by 2 doubles the stacks', async () => {
  const id = defCard({ target: 'enemy', effects: [{ op: 'multiply_status', status: 'poison', factor: 2 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { poison: 3 } });
  await playId(c, id);
  eq(c.enemies[0].statuses.poison, 6);
});
test('ops', 'multiply_status by 0.5 floors the result (3 becomes 1)', async () => {
  const id = defCard({ target: 'enemy', effects: [{ op: 'multiply_status', status: 'poison', factor: 0.5 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { poison: 3 } });
  await playId(c, id);
  eq(c.enemies[0].statuses.poison, 1);
});
test('ops', 'multiply_status by 0 removes the status', async () => {
  const id = defCard({ target: 'enemy', effects: [{ op: 'multiply_status', status: 'poison', factor: 0 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { poison: 3 } });
  await playId(c, id);
  eq(c.enemies[0].statuses.poison, undefined);
});
test('ops', 'heal on a card restores HP', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'heal', amount: 5 }] });
  const c = await combatOf({ php: 70 });
  await playId(c, id);
  eq(c.player.hp, 75);
});
test('ops', 'draw draws the given number of cards', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'draw', amount: 2 }] });
  const c = await combatOf({ hand: [], draw: [SKILL0, SKILL0, SKILL0, SKILL0] });
  await playId(c, id);
  eq(c.hand.length, 2, 'the played card leaves hand; two cards were drawn');
  eq(c.drawPile.length, 2);
});
test('ops', 'energy adds energy and a negative amount floors at zero', async () => {
  const gain = defCard({ type: 'skill', cost: 0, target: 'none', effects: [{ op: 'energy', amount: 2 }] });
  const c = await combatOf({ energy: 1 });
  await playId(c, gain);
  eq(c.player.energy, 3);
  const drain = defCard({ type: 'skill', cost: 0, target: 'none', effects: [{ op: 'energy', amount: -5 }] });
  await playId(c, drain);
  eq(c.player.energy, 0);
});
test('ops', 'discard with the default chooser discards the first card in hand', async () => {
  const c = await combatOf({ hand: [SKILL0, DEFEND, SKILL1] });
  const first = c.hand[0];
  await c.runEffects([{ op: 'discard', amount: 1 }], { source: c.player });
  eq(c.hand.length, 2);
  ok(c.discardPile.includes(first), 'the first card was not discarded');
});
test('ops', 'discard uses the player choice from DS.hooks.chooseCards', async () => {
  DS.hooks.chooseCards = async ({ cards, count }) => cards.slice(-count);
  const c = await combatOf({ hand: [SKILL0, DEFEND, SKILL1] });
  const last = c.hand[2];
  await c.runEffects([{ op: 'discard', amount: 1 }], { source: c.player });
  ok(c.discardPile.includes(last), 'the chosen card was not discarded');
});
test('ops', 'discard random discards exactly the requested number', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0] });
  await c.runEffects([{ op: 'discard', amount: 2, random: true }], { source: c.player });
  eq(c.hand.length, 3);
  eq(c.discardPile.length, 2);
});
test('ops', 'discard "all" empties the hand', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0, SKILL0] });
  await c.runEffects([{ op: 'discard', amount: 'all' }], { source: c.player });
  eq(c.hand.length, 0);
  eq(c.discardPile.length, 3);
});
test('ops', 'exhaust from hand exhausts the first card by default', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0] });
  await c.runEffects([{ op: 'exhaust', amount: 1 }], { source: c.player });
  eq(c.exhaustPile.length, 1);
  eq(c.hand.length, 1);
});
test('ops', 'exhaust with from: draw exhausts from the draw pile', async () => {
  const c = await combatOf({ hand: [], draw: [SKILL0, SKILL0, SKILL0, SKILL0] });
  await c.runEffects([{ op: 'exhaust', amount: 2, from: 'draw' }], { source: c.player });
  eq(c.exhaustPile.length, 2);
  eq(c.drawPile.length, 2);
});
test('ops', 'exhaust "all" exhausts the whole hand', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0, SKILL0] });
  await c.runEffects([{ op: 'exhaust', amount: 'all' }], { source: c.player });
  eq(c.exhaustPile.length, 3);
  eq(c.hand.length, 0);
});
test('ops', 'add_card to hand adds the requested copies', async () => {
  const c = await combatOf({ hand: [] });
  await c.runEffects([{ op: 'add_card', card: DEFEND, to: 'hand', amount: 2 }], { source: c.player });
  eq(c.hand.map((x) => x.id), [DEFEND, DEFEND]);
});
test('ops', 'add_card to draw puts the card in the draw pile', async () => {
  const c = await combatOf({ hand: [], draw: [] });
  await c.runEffects([{ op: 'add_card', card: DEFEND, to: 'draw', amount: 1 }], { source: c.player });
  eq(c.drawPile.length, 1);
  eq(c.hand.length, 0);
});
test('ops', 'add_card to discard puts the card in the discard pile', async () => {
  const c = await combatOf({ hand: [], discard: [] });
  await c.runEffects([{ op: 'add_card', card: DEFEND, to: 'discard', amount: 1 }], { source: c.player });
  eq(c.discardPile.length, 1);
});
test('ops', 'add_card with card "random" and a class picks cards of that class', async () => {
  const c = await combatOf({ hand: [] });
  await c.runEffects([{ op: 'add_card', card: 'random', class: 'berserker', amount: 3 }], { source: c.player });
  eq(c.hand.length, 3);
  ok(c.hand.every((x) => x.data.class === 'berserker'), 'a card of another class was added');
});
test('ops', 'add_card into a full hand (10) goes to the discard pile', async () => {
  const ten = []; for (let i = 0; i < 10; i++) ten.push(SKILL0);
  const c = await combatOf({ hand: ten, discard: [] });
  await c.runEffects([{ op: 'add_card', card: DEFEND, to: 'hand', amount: 1 }], { source: c.player });
  eq(c.hand.length, 10);
  eq(c.discardPile.length, 1);
});
test('ops', 'upgrade_hand upgrades the requested number of hand cards', async () => {
  const c = await combatOf({ hand: [STRIKE, STRIKE, STRIKE] });
  await c.runEffects([{ op: 'upgrade_hand', amount: 2 }], { source: c.player });
  eq(c.hand.filter((x) => x.upgraded).length, 2);
});
test('ops', 'upgrade_hand "all" upgrades every upgradeable card in hand', async () => {
  const c = await combatOf({ hand: [STRIKE, STRIKE, STRIKE] });
  await c.runEffects([{ op: 'upgrade_hand', amount: 'all' }], { source: c.player });
  eq(c.hand.every((x) => x.upgraded), true);
});
test('ops', 'gold on a card adds to the run gold', async () => {
  const c = await combatOf({ run: { gold: 3 } });
  await playId(c, GOLD5, null);
  eq(DS.run.gold, 8);
});
test('ops', 'a negative gold change cannot take gold below zero', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'gold', amount: -10 }] });
  const c = await combatOf({ run: { gold: 3 } });
  await playId(c, id);
  eq(DS.run.gold, 0);
});
test('ops', 'max_hp raises max HP and current HP by the same amount', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'max_hp', amount: 10 }] });
  const c = await combatOf({ php: 70 });
  await playId(c, id);
  eq(c.player.maxHp, 90);
  eq(c.player.hp, 80);
  eq(DS.run.maxHp, 90);
});
test('ops', 'max_hp can lower max HP and clamps current HP to it', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'max_hp', amount: -30 }] });
  const c = await combatOf({});
  await playId(c, id);
  eq(c.player.maxHp, 50);
  eq(c.player.hp, 50);
});
test('ops', 'repeat runs its effects the given number of times', async () => {
  const id = defCard({ type: 'skill', target: 'none', effects: [{ op: 'repeat', times: 3, effects: [{ op: 'block', amount: 2 }] }] });
  const c = await combatOf({});
  await playId(c, id);
  eq(c.player.block, 6);
});
test('ops', 'if: all six comparison operators give the expected branch', async () => {
  const c = await combatOf({});
  const table = { '>': false, '>=': true, '<': false, '<=': true, '==': true, '!=': false };
  for (const cmp of Object.keys(table)) {
    const before = c.player.block;
    await c.runEffects([{ op: 'if', cond: { left: 2, cmp, right: 2 }, then: [{ op: 'block', amount: 1 }], else: [] }], { source: c.player });
    eq(c.player.block - before, table[cmp] ? 1 : 0, `2 ${cmp} 2`);
  }
});
test('ops', 'if: a Value on the left side is resolved from the battle state', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0] });
  await c.runEffects([{ op: 'if', cond: { left: { v: 'hand' }, cmp: '>=', right: 2 }, then: [{ op: 'block', amount: 4 }], else: [{ op: 'block', amount: 1 }] }], { source: c.player });
  eq(c.player.block, 4);
});
test('ops', 'summon adds enemies but never more than five on the field', async () => {
  const child = defEnemy({ hp: [10, 10] });
  const summoner = defEnemy({ hp: [100, 100] });
  const c = await combatOf({ enemies: [summoner, child, child] });
  await c.runEffects([{ op: 'summon', enemy: child, amount: 3 }], { source: c.enemies[0] });
  eq(c.livingEnemies().length, 5);
});
test('ops', 'spawnEnemy returns null once five enemies are alive', async () => {
  const child = defEnemy({ hp: [10, 10] });
  const c = await combatOf({ enemies: [child, child, child, child, child] });
  const e = await c.spawnEnemy(child);
  eq(e, null);
});
test('ops', 'custom runs the function with the combat and the run', async () => {
  let seen = null;
  const c = await combatOf({});
  await c.runEffects([{ op: 'custom', fn: async (ctx) => { seen = ctx; } }], { source: c.player });
  ok(seen && seen.combat === c, 'ctx.combat is not this combat');
  ok(seen.run === c.run, 'ctx.run is not this run');
});
test('ops', 'an enemy onSpawn effect runs when the enemy appears', async () => {
  const e = defEnemy({ onSpawn: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }] });
  const c = await combatOf({ enemies: [e] });
  eq(c.enemies[0].statuses.strength, 3);
});

// ---------------------------------------------------------------------------
// Value sources and arithmetic (resolved through a block effect)
// ---------------------------------------------------------------------------
test('values', 'Value x resolves to the X-cost energy passed in the context', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'x', mul: 2 }, { x: 3 }), 6);
});
test('values', 'Value x is 0 when no X energy is in the context', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'x' }), 0);
});
test('values', 'Value stacks reads the owning status stacks from the context', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'stacks' }, { stacks: 4 }), 4);
});
test('values', 'Value block reads the acting unit block by default', async () => {
  const c = await combatOf({ pblock: 5 });
  eq(await valueOf(c, { v: 'block' }), 5);
});
test('values', 'Value block with of: target reads the target block', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], eblock: 7 });
  eq(await valueOf(c, { v: 'block', of: 'target' }, { target: c.enemies[0] }), 7);
});
test('values', 'Value block defaults to the acting unit, not the enemy with block', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], eblock: 9 });
  eq(await valueOf(c, { v: 'block' }, { target: c.enemies[0] }), 0);
});
test('values', 'Value hp reads current HP', async () => {
  const c = await combatOf({ php: 61 });
  eq(await valueOf(c, { v: 'hp' }), 61);
});
test('values', 'Value max_hp reads max HP', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'max_hp' }), 80);
});
test('values', 'Value missing_hp is max minus current', async () => {
  const c = await combatOf({ php: 61 });
  eq(await valueOf(c, { v: 'missing_hp' }), 19);
});
test('values', 'Value status (self) reads the stacks of a status on the actor', async () => {
  const c = await combatOf({ pstatus: { weak: 3 } });
  eq(await valueOf(c, { v: 'status', status: 'weak' }), 3);
});
test('values', 'Value status with of: target reads the stacks on the target', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], estatus: { strength: 4 } });
  eq(await valueOf(c, { v: 'status', status: 'strength', of: 'target' }, { target: c.enemies[0] }), 4);
});
test('values', 'Value hand counts the cards in hand', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0, SKILL0] });
  eq(await valueOf(c, { v: 'hand' }), 3);
});
test('values', 'Value draw_pile counts the draw pile', async () => {
  const c = await combatOf({ draw: [SKILL0, SKILL0, SKILL0, SKILL0] });
  eq(await valueOf(c, { v: 'draw_pile' }), 4);
});
test('values', 'Value discard_pile counts the discard pile', async () => {
  const c = await combatOf({ discard: [SKILL0, SKILL0] });
  eq(await valueOf(c, { v: 'discard_pile' }), 2);
});
test('values', 'Value exhaust_pile counts the exhaust pile', async () => {
  const c = await combatOf({});
  c.exhaustPile = [c.makeCard({ id: SKILL0 }), c.makeCard({ id: SKILL0 }), c.makeCard({ id: SKILL0 })];
  eq(await valueOf(c, { v: 'exhaust_pile' }), 3);
});
test('values', 'Value deck_size counts the cards in the run deck', async () => {
  const deck = []; for (let i = 0; i < 9; i++) deck.push(SKILL0);
  const c = await combatOf({ deck });
  eq(await valueOf(c, { v: 'deck_size' }), 9);
});
test('values', 'Value energy reads current energy', async () => {
  const c = await combatOf({ energy: 2 });
  eq(await valueOf(c, { v: 'energy' }), 2);
});
test('values', 'Value turn is 1 on the first turn and 2 after one turn ends', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'turn' }), 1);
  await c.endTurn();
  eq(await valueOf(c, { v: 'turn' }), 2);
});
test('values', 'Value cards_played counts cards played this turn', async () => {
  const c = await combatOf({});
  eq(await valueOf(c, { v: 'cards_played' }), 0);
  await playId(c, SKILL0);
  eq(await valueOf(c, { v: 'cards_played' }), 1);
  await playId(c, SKILL0);
  eq(await valueOf(c, { v: 'cards_played' }), 2);
});
test('values', 'Value attacks_played counts only attacks played this turn', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, STRIKE);
  await playId(c, SKILL0);
  eq(await valueOf(c, { v: 'attacks_played' }), 1);
});
test('values', 'Value enemies counts living enemies', async () => {
  const c = await combatOf({ enemies: [defEnemy({}), defEnemy({})] });
  eq(await valueOf(c, { v: 'enemies' }), 2);
  c.enemies[1].dead = true;
  eq(await valueOf(c, { v: 'enemies' }), 1);
});
test('values', 'Value gold reads the run gold', async () => {
  const c = await combatOf({ run: { gold: 37 } });
  eq(await valueOf(c, { v: 'gold' }), 37);
});
test('values', 'mul is applied before flooring: hp 7 times 0.5 is 3', async () => {
  const c = await combatOf({ php: 7 });
  eq(await valueOf(c, { v: 'hp', mul: 0.5 }), 3);
});
test('values', 'mul then add: hand 3 times 2 plus 1 is 7', async () => {
  const c = await combatOf({ hand: [SKILL0, SKILL0, SKILL0] });
  eq(await valueOf(c, { v: 'hand', mul: 2, add: 1 }), 7);
});
test('values', 'a negative add lowers the value: hp 10 minus 5 is 5', async () => {
  const c = await combatOf({ php: 10 });
  eq(await valueOf(c, { v: 'hp', add: -5 }), 5);
});

// ---------------------------------------------------------------------------
// Card keywords and card-level rules
// ---------------------------------------------------------------------------
test('keywords', 'exhaust: the card goes to the exhaust pile instead of the discard', async () => {
  const c = await combatOf({});
  await playId(c, EXH);
  eq(c.exhaustPile.length, 1);
  eq(c.discardPile.length, 0);
});
test('keywords', 'a normal card goes to the discard pile after it is played', async () => {
  const c = await combatOf({});
  await playId(c, SKILL0);
  eq(c.discardPile.length, 1);
  eq(c.exhaustPile.length, 0);
});
test('keywords', 'a power card leaves play: it is in neither the discard nor the exhaust pile', async () => {
  const c = await combatOf({});
  await playId(c, POWER);
  eq(c.discardPile.length, 0);
  eq(c.exhaustPile.length, 0);
  eq(c.hand.length, 0);
});
test('keywords', 'ethereal: an ethereal card left in hand is exhausted at end of turn', async () => {
  const c = await combatOf({ hand: [ETH], draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0] });
  const uid = c.hand[0].uid;
  await c.endTurn();
  ok(c.exhaustPile.some((x) => x.uid === uid), 'ethereal card was not exhausted');
});
test('keywords', 'retain: a retained card stays in hand through end of turn', async () => {
  const c = await combatOf({ hand: [RET], draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0] });
  const uid = c.hand[0].uid;
  await c.endTurn();
  ok(c.hand.some((x) => x.uid === uid), 'retained card left the hand');
});
test('keywords', 'without retain, a card left in hand is discarded at end of turn', async () => {
  const c = await combatOf({ hand: [SKILL0], draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0] });
  const uid = c.hand[0].uid;
  await c.endTurn();
  ok(c.discardPile.some((x) => x.uid === uid), 'card was not discarded');
});
test('keywords', 'innate: an innate card is in the opening hand and the hand is still 5 cards', async () => {
  const deck = [INN, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0];
  const c = await combatOf({ deck });
  ok(c.hand.some((x) => x.id === INN), 'innate card not in the opening hand');
  eq(c.hand.length, 5);
});
test('keywords', 'X cost spends all energy and X equals the energy spent', async () => {
  const id = defCard({ cost: 'X', target: 'enemy', effects: [{ op: 'damage', amount: { v: 'x' } }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], energy: 3 });
  await playId(c, id);
  eq(c.enemies[0].hp, 97);
  eq(c.player.energy, 0);
});
test('keywords', 'X cost is playable with zero energy and deals 0', async () => {
  const id = defCard({ cost: 'X', target: 'enemy', effects: [{ op: 'damage', amount: { v: 'x' } }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], energy: 0 });
  const res = await playId(c, id);
  eq(res.ok, true);
  eq(c.enemies[0].hp, 100);
});
test('keywords', 'a card with cost -1 is unplayable', async () => {
  const id = defCard({ cost: -1, type: 'skill', target: 'none', effects: [] });
  const c = await combatOf({});
  const card = c.makeCard({ id });
  c.hand = [card];
  const r = c.canPlay(card);
  eq(r.ok, false);
  eq(r.reason, 'Cannot be played');
});
test('keywords', 'playableIf: refused when the condition is false, allowed when true', async () => {
  const id = defCard({ type: 'skill', cost: 0, target: 'none', playableIf: { left: { v: 'enemies' }, cmp: '>=', right: 2 }, effects: [] });
  const one = await combatOf({ enemies: [defEnemy({})] });
  const cardOne = one.makeCard({ id });
  one.hand = [cardOne];
  ok(!one.canPlay(cardOne).ok, 'playable with one enemy');
  const two = await combatOf({ enemies: [defEnemy({}), defEnemy({})] });
  const cardTwo = two.makeCard({ id });
  two.hand = [cardTwo];
  ok(two.canPlay(cardTwo).ok, 'not playable with two enemies');
});
test('keywords', 'a card costing more than the energy you have is refused', async () => {
  const c = await combatOf({ energy: 0 });
  const card = c.makeCard({ id: STRIKE });
  c.hand = [card];
  const r = c.canPlay(card);
  eq(r.ok, false);
  eq(r.reason, 'Not enough energy');
});
test('keywords', 'an enemy-target card refuses to play without a target', async () => {
  const c = await combatOf({});
  const card = c.makeCard({ id: STRIKE });
  c.hand = [card];
  const r = await c.playCard(card, null);
  eq(r.ok, false);
});
test('keywords', 'a card that is not in hand cannot be played', async () => {
  const c = await combatOf({});
  const card = c.makeCard({ id: STRIKE });
  const r = await c.playCard(card, c.enemies[0]);
  eq(r.ok, false);
  eq(r.reason, 'Not in hand');
});
test('keywords', 'onDraw runs when the card is drawn', async () => {
  const id = defCard({ type: 'skill', cost: 0, target: 'none', effects: [], onDraw: [{ op: 'energy', amount: 1 }] });
  const c = await combatOf({ draw: [id], energy: 0 });
  await c.draw(1);
  eq(c.player.energy, 1);
});
test('keywords', 'onEndTurnInHand runs for cards still in hand at end of turn', async () => {
  const id = defCard({ type: 'skill', cost: 0, target: 'none', effects: [], onEndTurnInHand: [{ op: 'gold', amount: 5 }] });
  const c = await combatOf({ hand: [id], draw: [SKILL0, SKILL0, SKILL0, SKILL0, SKILL0, SKILL0], run: { gold: 10 } });
  await c.endTurn();
  eq(DS.run.gold, 15);
});
test('keywords', 'onExhaust runs when the card is exhausted', async () => {
  const id = defCard({ type: 'skill', cost: 0, target: 'none', exhaust: true, effects: [], onExhaust: [{ op: 'gold', amount: 3 }] });
  const c = await combatOf({ run: { gold: 10 } });
  await playId(c, id);
  eq(DS.run.gold, 13);
});
test('keywords', 'onDiscard runs when an effect discards the card', async () => {
  const id = defCard({ type: 'skill', cost: 0, target: 'none', effects: [], onDiscard: [{ op: 'gold', amount: 2 }] });
  const c = await combatOf({ hand: [id], run: { gold: 10 } });
  await c.runEffects([{ op: 'discard', amount: 1 }], { source: c.player });
  eq(DS.run.gold, 12);
});
test('keywords', 'an upgraded card resolves its upgrade effects (Strike deals 9)', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, STRIKE, undefined, true);
  eq(c.enemies[0].hp, 91);
});
test('keywords', 'an upgrade can change the cost of a card', async () => {
  const id = defCard({ cost: 2, type: 'skill', target: 'none', effects: [], upgrade: { cost: 1, effects: [] } });
  const c = await combatOf({ energy: 1 });
  const card = c.makeCard({ id, upgraded: true });
  c.hand = [card];
  ok(c.canPlay(card).ok, 'upgraded cost-1 card was refused with 1 energy');
});

// ---------------------------------------------------------------------------
// Enemy patterns, AI and intents
// ---------------------------------------------------------------------------
const TWO_MOVES = {
  a: { name: 'A', intent: 'defend', effects: [] },
  b: { name: 'B', intent: 'defend', effects: [] },
};

test('enemies', 'a sequence pattern with loop cycles through its moves', async () => {
  const e = defEnemy({ hp: [500, 500], moves: TWO_MOVES, pattern: { type: 'sequence', moves: ['a', 'b'], loop: true } });
  const c = await combatOf({ enemies: [e] });
  const seen = [c.enemies[0].intent.moveId];
  await c.endTurn();
  seen.push(c.enemies[0].intent.moveId);
  await c.endTurn();
  seen.push(c.enemies[0].intent.moveId);
  eq(seen, ['a', 'b', 'a']);
});
test('enemies', 'a sequence pattern without loop stays on its last move', async () => {
  const e = defEnemy({ hp: [500, 500], moves: TWO_MOVES, pattern: { type: 'sequence', moves: ['a', 'b'], loop: false } });
  const c = await combatOf({ enemies: [e] });
  const seen = [c.enemies[0].intent.moveId];
  for (let i = 0; i < 3; i++) {
    await c.endTurn();
    seen.push(c.enemies[0].intent.moveId);
  }
  eq(seen, ['a', 'b', 'b', 'b']);
});
test('enemies', 'a random pattern with noRepeat 2 never plays the same move three times in a row', async () => {
  const e = defEnemy({ hp: [100000, 100000], moves: TWO_MOVES, pattern: { type: 'random', weights: { a: 1000, b: 1 }, noRepeat: 2 } });
  const c = await combatOf({ enemies: [e] });
  const seen = [c.enemies[0].intent.moveId];
  for (let i = 0; i < 60; i++) {
    await c.endTurn();
    seen.push(c.enemies[0].intent.moveId);
  }
  let run = 1;
  for (let i = 1; i < seen.length; i++) {
    run = seen[i] === seen[i - 1] ? run + 1 : 1;
    ok(run <= 2, `three '${seen[i]}' moves in a row at index ${i}`);
  }
});
test('enemies', 'a random pattern with first: honours the opening move on turn 1', async () => {
  const e = defEnemy({ hp: [500, 500], moves: TWO_MOVES, pattern: { type: 'random', weights: { a: 1000, b: 1 }, first: 'b' } });
  const c = await combatOf({ enemies: [e] });
  eq(c.enemies[0].intent.moveId, 'b');
});
test('enemies', 'a random pattern follows its weights (9:1 gives roughly 90% a over 400 turns)', async () => {
  const e = defEnemy({ hp: [100000, 100000], moves: TWO_MOVES, pattern: { type: 'random', weights: { a: 9, b: 1 } } });
  const c = await combatOf({ enemies: [e] });
  let a = 0;
  for (let i = 0; i < 400; i++) {
    await c.endTurn();
    if (c.enemies[0].intent.moveId === 'a') a++;
  }
  ok(a >= 300 && a <= 390, `a was chosen ${a} times out of 400`);
});
test('enemies', 'an ai function is called with turn and lastMoves, and its choice is used', async () => {
  const turns = [];
  let lastSeen = null;
  const e = defEnemy({ hp: [500, 500], moves: TWO_MOVES, ai: (ctx) => {
    turns.push(ctx.turn);
    lastSeen = ctx.lastMoves;
    return ctx.turn % 2 ? 'a' : 'b';
  } });
  const c = await combatOf({ enemies: [e] });
  const seen = [c.enemies[0].intent.moveId];
  await c.endTurn();
  seen.push(c.enemies[0].intent.moveId);
  await c.endTurn();
  seen.push(c.enemies[0].intent.moveId);
  eq(seen, ['a', 'b', 'a']);
  ok(Array.isArray(lastSeen), 'ctx.lastMoves was not an array');
  eq(turns.slice(0, 3), [1, 2, 3]);
});
test('enemies', 'an ai that returns an unknown move still leaves the enemy with a real intent', async () => {
  const e = defEnemy({ hp: [500, 500], moves: TWO_MOVES, ai: () => 'no_such_move' });
  const c = await combatOf({ enemies: [e] });
  ok(['a', 'b'].includes(c.enemies[0].intent.moveId), `intent is ${c.enemies[0].intent.moveId}`);
});
test('enemies', 'intent damage shows the player vulnerable multiplier (10 becomes 15)', async () => {
  const c = await combatOf({ enemies: [attacker(10)] });
  eq(c.enemies[0].intent.damage, 10);
  await c.runEffects([{ op: 'apply', status: 'vulnerable', amount: 1, to: 'player' }], { source: c.enemies[0] });
  eq(c.enemies[0].intent.damage, 15);
});
test('enemies', 'intent damage shows the enemy strength (4 + 3 = 7)', async () => {
  const c = await combatOf({ enemies: [attacker(4)] });
  await c.runEffects([{ op: 'apply', status: 'strength', amount: 3, to: 'target' }], { source: c.player, target: c.enemies[0] });
  eq(c.enemies[0].intent.damage, 7);
});
test('enemies', 'intent reports the hit count of a multi-hit move', async () => {
  const e = defEnemy({ hp: [200, 200], moves: { hit: { name: 'Flurry', intent: 'attack', effects: [{ op: 'damage', amount: 4, times: 3 }] } }, pattern: { type: 'sequence', moves: ['hit'], loop: true } });
  const c = await combatOf({ enemies: [e] });
  eq(c.enemies[0].intent.times, 3);
  eq(c.enemies[0].intent.damage, 4);
  eq(c.enemies[0].intent.type, 'attack');
});
test('enemies', 'a non-attack intent has damage null', async () => {
  const c = await combatOf({ enemies: [defEnemy({})] });
  eq(c.enemies[0].intent.damage, null);
});
test('enemies', 'an enemy block is cleared when its turn starts', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [500, 500] })], eblock: 5 });
  await c.endTurn();
  eq(c.enemies[0].block, 0);
});
test('enemies', 'an enemy attack consumes the player block first (2 block, 6 attack costs 4 HP)', async () => {
  const c = await combatOf({ enemies: [attacker(6)] });
  await c.runEffects([{ op: 'block', amount: 2 }], { source: c.player });
  await c.runEffects([{ op: 'damage', amount: 6, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 76);
});

// ---------------------------------------------------------------------------
// Piles, drawing, shuffling, hand limit
// ---------------------------------------------------------------------------
test('piles', 'the opening hand is 5 cards drawn from a deck of 12, the rest stay in the draw pile', async () => {
  const deck = []; for (let i = 0; i < 12; i++) deck.push(SKILL0);
  const c = await combatOf({ deck });
  eq(c.hand.length, 5);
  eq(c.drawPile.length, 7);
});
test('piles', 'drawing from an empty draw pile reshuffles the discard pile into it', async () => {
  const c = await combatOf({ hand: [], draw: [], discard: [SKILL0, SKILL0, SKILL0] });
  const shuffles = listen('combat:shuffle');
  const n = await c.draw(1);
  eq(n, 1);
  eq(c.hand.length, 1);
  eq(c.drawPile.length, 2);
  eq(c.discardPile.length, 0);
  eq(shuffles.length, 1);
});
test('piles', 'drawing with every pile empty draws nothing', async () => {
  const c = await combatOf({ hand: [], draw: [], discard: [] });
  eq(await c.draw(3), 0);
});
test('piles', 'a full hand (10) sends the drawn card straight to the discard pile', async () => {
  const ten = []; for (let i = 0; i < 10; i++) ten.push(SKILL0);
  const c = await combatOf({ hand: ten, draw: [DEFEND], discard: [] });
  await c.draw(1);
  eq(c.hand.length, 10);
  eq(c.discardPile.length, 1);
  eq(c.discardPile[0].id, DEFEND);
});
test('piles', 'end of turn discards the hand, and the next turn draws 5 again', async () => {
  const draw = []; for (let i = 0; i < 10; i++) draw.push(SKILL0);
  const c = await combatOf({ hand: [STRIKE, DEFEND], draw });
  const uids = c.hand.map((x) => x.uid);
  await c.endTurn();
  ok(uids.every((u) => c.discardPile.some((x) => x.uid === u)), 'hand cards were not discarded');
  eq(c.hand.length, 5);
});
test('piles', 'every card drawn fires combat:cardDrawn once', async () => {
  const drawn = listen('combat:cardDrawn');
  const c = await combatOf({ hand: [], draw: [SKILL0, SKILL0, SKILL0] });
  await c.draw(3);
  eq(drawn.length, 3);
});
test('piles', 'a reshuffle keeps every card (draw + hand + discard is unchanged)', async () => {
  const c = await combatOf({ hand: [SKILL0], draw: [], discard: [SKILL0, SKILL0, SKILL0, SKILL0] });
  await c.draw(2);
  eq(c.hand.length + c.drawPile.length + c.discardPile.length, 5);
});

// ---------------------------------------------------------------------------
// Combat flow: start, turns, victory, defeat, death mid-hit, busy, stats
// ---------------------------------------------------------------------------
test('flow', 'start spawns the encounter enemies in order, with hp inside their range', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [20, 30], name: 'One' }), defEnemy({ hp: [20, 30], name: 'Two' })] });
  eq(c.enemies.map((e) => e.name), ['One', 'Two']);
  ok(c.enemies.every((e) => e.hp >= 20 && e.hp <= 30), `hp out of range: ${livingHp(c)}`);
});
test('flow', 'a fresh combat starts on turn 1 in the player phase with 3 energy', async () => {
  const c = new DS.Combat(newRun({}), defEncounter([defEnemy({})]));
  await c.start();
  eq(c.phase, 'player');
  eq(c.turn, 1);
  eq(c.player.energy, 3);
});
test('flow', 'ending the turn runs the enemy attack and starts the next player turn', async () => {
  const c = await combatOf({ enemies: [attacker(5)] });
  await c.endTurn();
  eq(c.player.hp, 75);
  eq(c.turn, 2);
  eq(c.phase, 'player');
});
test('flow', 'endTurn is refused when it is not the player phase', async () => {
  const c = await combatOf({});
  c.phase = 'enemy';
  const r = await c.endTurn();
  eq(r.ok, false);
});
test('flow', 'endTurn is refused after the combat has ended', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [1, 1] })] });
  await playId(c, STRIKE);
  eq(c.phase, 'won');
  const r = await c.endTurn();
  eq(r.ok, false);
});
test('flow', 'killing the last enemy wins the combat, syncs HP to the run and emits combat:end', async () => {
  const ends = listen('combat:end');
  const c = await combatOf({ enemies: [defEnemy({ hp: [6, 6] })], php: 61 });
  await playId(c, STRIKE);
  eq(c.phase, 'won');
  eq(ends.map((x) => x.result), ['won']);
  eq(DS.run.hp, 61);
});
test('flow', 'the player dying loses the combat, sets run HP to 0 and emits combat:end lost', async () => {
  const ends = listen('combat:end');
  const c = await combatOf({ enemies: [attacker(999)], php: 5 });
  await c.endTurn();
  eq(c.phase, 'lost');
  eq(ends.map((x) => x.result), ['lost']);
  eq(DS.run.hp, 0);
});
test('flow', 'a multi-hit stops when the target dies, and onKill runs once', async () => {
  const id = defCard({ effects: [{ op: 'damage', amount: 6, times: 3, onKill: [{ op: 'gold', amount: 1 }] }] });
  const dmg = listen('combat:damage');
  const c = await combatOf({ enemies: [defEnemy({ hp: [10, 10] })], run: { gold: 0 } });
  await playId(c, id);
  eq(c.enemies[0].hp, 0);
  eq(dmg.length, 2, 'the third hit should not land');
  eq(DS.run.gold, 1);
});
test('flow', 'the player dying mid multi-hit ignores the remaining hits', async () => {
  const dmg = listen('combat:damage');
  const c = await combatOf({ enemies: [attacker(5)], php: 8 });
  await c.runEffects([{ op: 'damage', amount: 5, times: 3, to: 'player' }], { source: c.enemies[0] });
  eq(c.player.hp, 0);
  eq(c.phase, 'lost');
  eq(dmg.length, 2);
});
test('flow', 'livingEnemies leaves out dead enemies', async () => {
  const c = await combatOf({ enemies: [defEnemy({}), defEnemy({})] });
  c.enemies[0].dead = true;
  eq(c.livingEnemies().length, 1);
});
test('flow', 'playing a card emits combat:update so the UI can redraw', async () => {
  const updates = listen('combat:update');
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, STRIKE);
  ok(updates.length > 0, 'no combat:update was emitted');
});
test('flow', 'combat:damage carries the amount lost and the amount blocked', async () => {
  const dmg = listen('combat:damage');
  const c = await combatOf({ enemies: [attacker(5)], pblock: 2 });
  await c.runEffects([{ op: 'damage', amount: 5, to: 'player' }], { source: c.enemies[0] });
  eq(dmg.length, 1);
  eq(dmg[0].amount, 3);
  eq(dmg[0].blocked, 2);
  ok(dmg[0].target === c.player, 'target is not the player unit');
});
test('flow', 'while a card is resolving the combat is busy and refuses another card', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  const a = c.makeCard({ id: STRIKE });
  const b = c.makeCard({ id: STRIKE });
  c.hand = [a, b];
  const pending = c.playCard(a, c.enemies[0]);
  eq(c.canPlay(b).reason, 'Busy');
  await pending;
});
test('flow', 'energy refills to 3 when the next turn starts', async () => {
  const c = await combatOf({ energy: 0 });
  await c.endTurn();
  eq(c.player.energy, 3);
});
test('flow', 'run stats count the cards played and the damage dealt', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  await playId(c, STRIKE);
  eq(DS.run.stats.cardsPlayed, 1);
  eq(DS.run.stats.damageDealt, 6);
});
test('flow', 'run stats count player turns', async () => {
  const c = await combatOf({});
  eq(DS.run.stats.turns, 1);
  await c.endTurn();
  eq(DS.run.stats.turns, 2);
});
test('flow', 'DS.combat points at the combat that was just created', async () => {
  const c = await combatOf({});
  ok(DS.combat === c, 'DS.combat is not the new combat');
});
test('flow', 'starting a new run abandons the fight in progress', async () => {
  const c = await combatOf({});
  DS.Run.start('berserker', 5);
  ok(c._ended === true || c.phase === 'lost', 'the old combat was not stopped');
});

// ---------------------------------------------------------------------------
// Potions in combat
// ---------------------------------------------------------------------------
test('potions', 'a heal potion restores HP and empties its slot', async () => {
  const pid = defPotion({ target: 'none', effects: [{ op: 'heal', amount: 10 }] });
  const c = await combatOf({ php: 50, run: { potions: [pid, null, null] } });
  const r = await c.usePotion(0, null);
  eq(r.ok, true);
  eq(c.player.hp, 60);
  eq(DS.run.potions[0], null);
});
test('potions', 'an enemy-target potion refuses without a target and keeps the potion', async () => {
  const pid = defPotion({ target: 'enemy', effects: [{ op: 'damage', amount: 7 }] });
  const c = await combatOf({ run: { potions: [pid, null, null] } });
  const r = await c.usePotion(0, null);
  eq(r.ok, false);
  eq(DS.run.potions[0], pid);
});
test('potions', 'an enemy-target potion damages its target', async () => {
  const pid = defPotion({ target: 'enemy', effects: [{ op: 'damage', amount: 7 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], run: { potions: [pid, null, null] } });
  await c.usePotion(0, c.enemies[0]);
  eq(c.enemies[0].hp, 93);
});
test('potions', 'an all_enemies potion hits every enemy', async () => {
  const pid = defPotion({ target: 'all_enemies', effects: [{ op: 'damage', amount: 4 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] }), defEnemy({ hp: [100, 100] })], run: { potions: [pid, null, null] } });
  await c.usePotion(0, null);
  eq(livingHp(c), [96, 96]);
});
test('potions', 'using an empty slot is refused', async () => {
  const c = await combatOf({});
  const r = await c.usePotion(1, null);
  eq(r.ok, false);
});
test('potions', 'a self potion grants block to the player', async () => {
  const pid = defPotion({ target: 'self', effects: [{ op: 'block', amount: 5 }] });
  const c = await combatOf({ run: { potions: [pid, null, null] } });
  await c.usePotion(0, null);
  eq(c.player.block, 5);
});
test('potions', 'a potion that kills the last enemy wins the combat', async () => {
  const pid = defPotion({ target: 'enemy', effects: [{ op: 'damage', amount: 99 }] });
  const c = await combatOf({ enemies: [defEnemy({ hp: [10, 10] })], run: { potions: [pid, null, null] } });
  await c.usePotion(0, c.enemies[0]);
  eq(c.phase, 'won');
});

// ---------------------------------------------------------------------------
// Run: start, map invariants, navigation
// ---------------------------------------------------------------------------
const ROOM_TYPES = ['fight', 'elite', 'rest', 'shop', 'event', 'treasure', 'boss'];

// Returns a list of map problems (empty when the map is valid).
function mapProblems(map) {
  const p = [];
  const nodes = map.nodes;
  const rows = map.rows;
  if (!Array.isArray(rows) || rows.length !== 15) p.push(`expected 15 rows, got ${rows && rows.length}`);
  const incoming = new Set();
  for (const id of Object.keys(nodes)) for (const nx of nodes[id].next || []) incoming.add(nx);
  const boss = (o) => { if (o.type === 'boss') return true; return false; };
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!ROOM_TYPES.includes(n.type)) p.push(`${id}: bad type '${n.type}'`);
    if (boss(n)) {
      if ((n.next || []).length) p.push(`${id}: the boss has exits`);
      continue;
    }
    if (!n.next || n.next.length === 0) p.push(`${id}: no exits`);
    for (const nx of n.next || []) {
      const t = nodes[nx];
      if (!t) p.push(`${id}: exit to missing node ${nx}`);
      else if (t.row !== n.row + 1) p.push(`${id}: exit to row ${t.row}, expected ${n.row + 1}`);
    }
    if (n.row >= 1 && !incoming.has(id)) p.push(`${id}: orphan (no entry)`);
  }
  if (Array.isArray(rows)) {
    rows.forEach((row, r) => {
      if (row.length > 7) p.push(`row ${r} has ${row.length} nodes`);
      const cols = row.map((id) => nodes[id] && nodes[id].col);
      if (new Set(cols).size !== cols.length) p.push(`row ${r} repeats a column`);
      for (const id of row) {
        if (!nodes[id] || nodes[id].row !== r) p.push(`row ${r} lists ${id} with the wrong row`);
      }
      if (r === 0 && row.some((id) => nodes[id] && nodes[id].type !== 'fight')) p.push('row 0 has a non-fight node');
      if (r === 8 && row.some((id) => nodes[id] && nodes[id].type !== 'treasure')) p.push('row 8 has a non-treasure node');
      if (r === 14 && row.some((id) => nodes[id] && nodes[id].type !== 'rest')) p.push('row 14 has a non-rest node');
    });
  }
  // every node must be able to reach the boss
  const memo = new Map();
  const reach = (id, depth) => {
    if (depth > 40) return false;
    if (memo.has(id)) return memo.get(id);
    const n = nodes[id];
    const r = !n ? false : n.type === 'boss' ? true : (n.next || []).some((x) => reach(x, depth + 1));
    memo.set(id, r);
    return r;
  };
  for (const id of Object.keys(nodes)) if (!reach(id, 0)) { p.push(`${id}: cannot reach the boss`); break; }
  return p;
}

// Forces the next selectable map node to a room type and enters it.
function enterForced(run, type) {
  const id = DS.Run.availableNodes()[0].id;
  run.map.nodes[id].type = type;
  return { id, room: DS.Run.enterNode(id) };
}

test('run', 'Run.start: the deck is the character starter deck and the starter relic is owned', () => {
  const ch = DS.characters.berserker;
  const run = DS.Run.start('berserker', 3);
  eq(run.deck.map((x) => x.id), ch.starterDeck);
  ok(run.relics.some((r) => r.id === ch.starterRelic), 'starter relic missing');
  ok(new Set(run.deck.map((x) => x.uid)).size === run.deck.length, 'deck uids are not unique');
});
test('run', 'Run.start: HP and gold come from the character definition', () => {
  const ch = DS.characters.shade;
  const run = DS.Run.start('shade', 4);
  eq(run.hp, ch.hp);
  eq(run.maxHp, ch.hp);
  eq(run.gold, ch.gold);
});
test('run', 'Run.start: the first room choices are the row 0 nodes, all fights', () => {
  const run = DS.Run.start('berserker', 5);
  const av = DS.Run.availableNodes();
  ok(av.length >= 1 && av.length <= 7, `${av.length} starting nodes`);
  ok(av.every((n) => n.row === 0 && n.type === 'fight'), 'a starting node is not a row 0 fight');
});
test('run', 'Run.start: the same numeric seed gives the same map', () => {
  DS.Run.start('berserker', 123);
  const a = JSON.stringify(DS.run.map);
  DS.Run.start('berserker', 123);
  eq(JSON.stringify(DS.run.map), a);
});
test('run', 'Run.start: different seeds give different maps', () => {
  DS.Run.start('berserker', 123);
  const a = JSON.stringify(DS.run.map);
  DS.Run.start('berserker', 124);
  ok(JSON.stringify(DS.run.map) !== a, 'two seeds gave the same map');
});
test('run', 'Run.start: a string seed is deterministic', () => {
  DS.Run.start('warden', 'the spire');
  const a = JSON.stringify(DS.run.map);
  DS.Run.start('warden', 'the spire');
  eq(JSON.stringify(DS.run.map), a);
});
test('run', 'Run.end(false) marks the run over and not won', () => {
  DS.Run.start('berserker', 8);
  DS.Run.end(false);
  eq(DS.run.over, true);
  eq(DS.run.won, false);
});
test('run', 'Run.end(true) marks the run over and won', () => {
  DS.Run.start('berserker', 8);
  DS.Run.end(true);
  eq(DS.run.won, true);
});
test('map', 'a map has 15 rows, row 0 fights, row 8 treasure, row 14 rest, then one boss (seeds 1-200)', () => {
  for (let s = 1; s <= 200; s++) {
    DS.Run.start('berserker', s);
    const m = DS.run.map;
    eq(m.rows.length, 15, `seed ${s}`);
    ok(m.rows[0].every((id) => m.nodes[id].type === 'fight'), `seed ${s} row 0`);
    ok(m.rows[8].every((id) => m.nodes[id].type === 'treasure'), `seed ${s} row 8`);
    ok(m.rows[14].every((id) => m.nodes[id].type === 'rest'), `seed ${s} row 14`);
    eq(m.nodes[m.bossId].type, 'boss', `seed ${s} boss`);
  }
});
test('map', 'every map node is connected: valid types, exits go one row down, no orphans, all reach the boss (seeds 1-200)', () => {
  for (let s = 1; s <= 200; s++) {
    DS.Run.start('shade', s);
    const probs = mapProblems(DS.run.map);
    ok(probs.length === 0, `seed ${s}: ${probs.slice(0, 3).join('; ')}`);
  }
});
test('map', 'every map has at least one shop and at least two elites (seeds 1-200)', () => {
  for (let s = 1; s <= 200; s++) {
    DS.Run.start('arcanist', s);
    const types = Object.values(DS.run.map.nodes).map((n) => n.type);
    ok(types.includes('shop'), `seed ${s} has no shop`);
    ok(types.filter((t) => t === 'elite').length >= 2, `seed ${s} has fewer than two elites`);
  }
});
test('map', 'acts 2 and 3 get valid maps from nextAct (seeds 1-50)', () => {
  for (let s = 1; s <= 50; s++) {
    DS.Run.start('warden', s);
    ok(DS.Run.nextAct(), 'nextAct from act 1 failed');
    eq(DS.run.act, 2);
    let probs = mapProblems(DS.run.map);
    ok(probs.length === 0, `seed ${s} act 2: ${probs.slice(0, 2).join('; ')}`);
    ok(DS.Run.nextAct(), 'nextAct from act 2 failed');
    eq(DS.run.act, 3);
    probs = mapProblems(DS.run.map);
    ok(probs.length === 0, `seed ${s} act 3: ${probs.slice(0, 2).join('; ')}`);
  }
});
test('map', 'a random walk from row 0 reaches the boss after exactly 16 rooms (seeds 1-50)', () => {
  for (let s = 1; s <= 50; s++) {
    DS.Run.start('berserker', s);
    let rooms = 0;
    let last = null;
    for (;;) {
      const av = DS.Run.availableNodes();
      if (av.length === 0) break;
      const pick = av[(s + rooms) % av.length];
      DS.Run.enterNode(pick.id);
      rooms++;
      last = pick;
      if (rooms > 40) break;
    }
    eq(last && last.type, 'boss', `seed ${s} did not end at the boss`);
    eq(rooms, 16, `seed ${s} room count`);
  }
});
test('map', 'entering a node marks it visited and bumps the floor', () => {
  DS.Run.start('berserker', 17);
  const id = DS.run.map.rows[0][0];
  const before = DS.run.floor;
  const room = DS.Run.enterNode(id);
  ok(room && room.type === 'combat', `row 0 fight gave ${room && room.type}`);
  eq(DS.run.map.nodes[id].visited, true);
  eq(DS.run.floor, before + 1);
});
test('map', 'entering a node that is not reachable returns null', () => {
  DS.Run.start('berserker', 17);
  const r = DS.run.map.rows[14][0];
  eq(DS.Run.enterNode(r), null);
});
test('map', 'a combat room counts as a fight in run stats, and an elite as an elite', () => {
  DS.Run.start('berserker', 19);
  const { room } = enterForced(DS.run, 'elite');
  eq(room.type, 'combat');
  eq(room.tier, 'elite');
  eq(DS.run.stats.elites, 1);
});

// ---------------------------------------------------------------------------
// Rewards, shops, rest, gold
// ---------------------------------------------------------------------------
test('rewards', 'normal fight gold is 10 to 20 (100 rolls)', () => {
  DS.Run.start('berserker', 31);
  for (let i = 0; i < 100; i++) {
    const g = DS.Run.generateRewards('normal').gold;
    ok(g >= 10 && g <= 20, `gold ${g}`);
  }
});
test('rewards', 'elite gold is 25 to 35 and an elite always offers a relic', () => {
  DS.Run.start('berserker', 32);
  for (let i = 0; i < 50; i++) {
    const r = DS.Run.generateRewards('elite');
    ok(r.gold >= 25 && r.gold <= 35, `gold ${r.gold}`);
    ok(typeof r.relic === 'string' && r.relic.length > 0, 'no relic on an elite reward');
  }
});
test('rewards', 'boss gold is 95 to 105 and its three card choices are all rare', () => {
  DS.Run.start('berserker', 33);
  for (let i = 0; i < 20; i++) {
    const r = DS.Run.generateRewards('boss');
    ok(r.gold >= 95 && r.gold <= 105, `gold ${r.gold}`);
    eq(r.cardChoices.length, 3);
    ok(r.cardChoices.every((x) => DS.cards[x.id].rarity === 'rare'), 'a boss choice is not rare');
  }
});
test('rewards', 'treasure gold is 15 to 25, gives a relic and no card choices', () => {
  DS.Run.start('berserker', 34);
  for (let i = 0; i < 30; i++) {
    const r = DS.Run.generateRewards('treasure');
    ok(r.gold >= 15 && r.gold <= 25, `gold ${r.gold}`);
    ok(typeof r.relic === 'string', 'no relic from treasure');
    eq(r.cardChoices, []);
  }
});
test('rewards', 'a normal reward offers 3 distinct, non-starter, non-special cards', () => {
  DS.Run.start('berserker', 35);
  for (let i = 0; i < 40; i++) {
    const r = DS.Run.generateRewards('normal');
    eq(r.cardChoices.length, 3);
    eq(new Set(r.cardChoices.map((x) => x.id)).size, 3, 'duplicate choices');
    for (const ch of r.cardChoices) {
      const d = DS.cards[ch.id];
      ok(!['starter', 'special'].includes(d.rarity), `${ch.id} is ${d.rarity}`);
      eq(ch.upgraded, false);
    }
  }
});
test('rewards', 'normal card choices come from the character class or colorless', () => {
  DS.Run.start('shade', 36);
  for (let i = 0; i < 60; i++) {
    for (const ch of DS.Run.generateRewards('normal').cardChoices) {
      ok(['shade', 'colorless'].includes(DS.cards[ch.id].class), `${ch.id} is ${DS.cards[ch.id].class}`);
    }
  }
});
test('rewards', 'common cards are offered more often than rare ones (300 rolls)', () => {
  DS.Run.start('berserker', 37);
  const count = { common: 0, uncommon: 0, rare: 0 };
  for (let i = 0; i < 100; i++) {
    for (const ch of DS.Run.generateRewards('normal').cardChoices) {
      const r = DS.cards[ch.id].rarity;
      if (count[r] !== undefined) count[r]++;
    }
  }
  ok(count.common > count.rare * 3, `common ${count.common}, rare ${count.rare}`);
});
test('rewards', 'a normal fight gives a potion about 40% of the time (500 rolls)', () => {
  DS.Run.start('berserker', 38);
  let n = 0;
  for (let i = 0; i < 500; i++) if (DS.Run.generateRewards('normal').potion) n++;
  ok(n >= 150 && n <= 250, `${n} potions in 500`);
});
test('rewards', 'a normal fight gives no relic', () => {
  DS.Run.start('berserker', 39);
  for (let i = 0; i < 30; i++) eq(DS.Run.generateRewards('normal').relic, null);
});
test('shop', 'a shop offers cards, relics and potions', () => {
  DS.Run.start('berserker', 41);
  const { room } = enterForced(DS.run, 'shop');
  eq(room.type, 'shop');
  ok(room.shop.cards.length >= 5, `cards ${room.shop.cards.length}`);
  ok(room.shop.relics.length >= 1, 'no relics');
  eq(room.shop.potions.length, 3);
  eq(room.shop.removeUsed, false);
  eq(room.shop.removePrice, 75);
});
test('shop', 'shop card prices follow their rarity bands (common 45-55, uncommon 68-82, rare 135-165)', () => {
  const bands = { common: [45, 55], uncommon: [68, 82], rare: [135, 165] };
  for (let s = 1; s <= 30; s++) {
    DS.Run.start('berserker', s);
    const { room } = enterForced(DS.run, 'shop');
    for (const item of room.shop.cards) {
      const band = bands[DS.cards[item.inst.id].rarity];
      if (!band) continue;
      ok(item.price >= band[0] && item.price <= band[1], `${item.inst.id} costs ${item.price}`);
    }
  }
});
test('shop', 'shop relic prices sit in their rarity bands and potion prices are exact', () => {
  for (let s = 1; s <= 30; s++) {
    DS.Run.start('warden', s);
    const { room } = enterForced(DS.run, 'shop');
    for (const it of room.shop.relics) {
      const r = DS.relics[it.id].rarity;
      const band = r === 'uncommon' ? [235, 265] : r === 'rare' ? [285, 315] : [140, 160];
      ok(it.price >= band[0] && it.price <= band[1], `${it.id} (${r}) costs ${it.price}`);
    }
    for (const it of room.shop.potions) {
      const r = DS.potions[it.id].rarity;
      eq(it.price, r === 'rare' ? 100 : r === 'uncommon' ? 75 : 50, `${it.id} (${r})`);
    }
  }
});
test('shop', 'buying a card spends gold, adds the card and marks the item sold', () => {
  DS.Run.start('berserker', 42);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 1000;
  const item = room.shop.cards[0];
  const deck = DS.run.deck.length;
  eq(DS.Run.buy('card', 0), true);
  eq(DS.run.gold, 1000 - item.price);
  eq(DS.run.deck.length, deck + 1);
  eq(item.sold, true);
});
test('shop', 'a sold item cannot be bought again', () => {
  DS.Run.start('berserker', 43);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 1000;
  DS.Run.buy('card', 0);
  eq(DS.Run.buy('card', 0), false);
});
test('shop', 'buying with too little gold fails and changes nothing', () => {
  DS.Run.start('berserker', 44);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 0;
  const deck = DS.run.deck.length;
  eq(DS.Run.buy('card', 0), false);
  eq(DS.run.deck.length, deck);
  eq(room.shop.cards[0].sold, false);
});
test('shop', 'a relic you already own cannot be bought', () => {
  DS.Run.start('berserker', 45);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 1000;
  DS.run.relics.push({ id: room.shop.relics[0].id, counter: 0 });
  eq(DS.Run.buy('relic', 0), false);
});
test('shop', 'card removal costs 75, then 100 for the next shop, and works once per shop', () => {
  DS.Run.start('berserker', 46);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 500;
  const deck = DS.run.deck.length;
  const uid = DS.run.deck[0].uid;
  eq(DS.Run.shopRemove(uid), true);
  eq(DS.run.gold, 425);
  eq(DS.run.deck.length, deck - 1);
  eq(room.shop.removeUsed, true);
  eq(room.shop.removePrice, 100);
  eq(DS.Run.shopRemove(DS.run.deck[0].uid), false, 'second removal in one shop');
});
test('shop', 'card removal is refused without enough gold', () => {
  DS.Run.start('berserker', 47);
  enterForced(DS.run, 'shop');
  DS.run.gold = 10;
  eq(DS.Run.shopRemove(DS.run.deck[0].uid), false);
});
test('shop', 'a potion cannot be bought when every potion slot is full', () => {
  DS.Run.start('berserker', 48);
  const { room } = enterForced(DS.run, 'shop');
  DS.run.gold = 1000;
  DS.run.potions = ['po_none_x', 'po_none_y', 'po_none_z'];
  eq(DS.Run.buy('potion', 0), false);
});
test('rest', 'resting heals 30% of max HP, rounded down (80 max: 10 becomes 34)', () => {
  DS.Run.start('berserker', 51);
  DS.run.hp = 10;
  DS.run.maxHp = 80;
  eq(DS.Run.rest(), 24);
  eq(DS.run.hp, 34);
});
test('rest', 'resting never heals above max HP', () => {
  DS.Run.start('berserker', 52);
  DS.run.hp = 75;
  DS.run.maxHp = 80;
  eq(DS.Run.rest(), 5);
  eq(DS.run.hp, 80);
});
test('rest', 'resting at 73 max HP heals 21 (30% of 73 rounded down)', () => {
  DS.Run.start('berserker', 53);
  DS.run.hp = 0;
  DS.run.maxHp = 73;
  eq(DS.Run.rest(), 21);
});
test('rest', 'a rest room heals and fires the onRest relic trigger', () => {
  const rid = defRelic({ triggers: { onRest: [{ op: 'gold', amount: 3 }] } });
  DS.Run.start('berserker', 54);
  DS.run.relics.push({ id: rid, counter: 0 });
  DS.run.gold = 10;
  DS.run.hp = 40;
  DS.Run.rest();
  eq(DS.run.gold, 13);
});
test('gold', 'addGold never takes gold below zero', () => {
  DS.Run.start('berserker', 55);
  DS.run.gold = 5;
  eq(DS.Run.addGold(-50), 0);
  eq(DS.run.gold, 0);
});
test('gold', 'addGold counts positive gains in stats.goldEarned and emits run:gold', () => {
  const gold = listen('run:gold');
  DS.Run.start('berserker', 56);
  DS.Run.addGold(12);
  eq(DS.run.stats.goldEarned, 12);
  ok(gold.length > 0, 'no run:gold event');
});
test('gold', 'a relic onGoldGained trigger fires for a positive gold gain', () => {
  const rid = defRelic({ triggers: { onGoldGained: [{ op: 'heal', amount: 2 }] } });
  DS.Run.start('berserker', 57);
  DS.run.relics.push({ id: rid, counter: 0 });
  DS.run.hp = 10;
  DS.Run.addGold(4);
  eq(DS.run.hp, 12);
});

// ---------------------------------------------------------------------------
// Run-level effects (events, relics, rewards) and event conditions
// ---------------------------------------------------------------------------
test('runops', 'gold op adds gold', async () => {
  DS.Run.start('berserker', 61);
  DS.run.gold = 10;
  await DS.Run.runEffects([{ op: 'gold', amount: 15 }]);
  eq(DS.run.gold, 25);
});
test('runops', 'heal op is capped at max HP', async () => {
  DS.Run.start('berserker', 62);
  DS.run.hp = 70; DS.run.maxHp = 80;
  await DS.Run.runEffects([{ op: 'heal', amount: 50 }]);
  eq(DS.run.hp, 80);
});
test('runops', 'lose_hp op cannot take HP below zero', async () => {
  DS.Run.start('berserker', 63);
  await DS.Run.runEffects([{ op: 'lose_hp', amount: 999 }]);
  eq(DS.run.hp, 0);
});
test('runops', 'max_hp +10 raises max HP and current HP', async () => {
  DS.Run.start('berserker', 64);
  DS.run.hp = 70; DS.run.maxHp = 80;
  await DS.Run.runEffects([{ op: 'max_hp', amount: 10 }]);
  eq(DS.run.maxHp, 90);
  eq(DS.run.hp, 80);
});
test('runops', 'max_hp -20 lowers max HP and clamps current HP', async () => {
  DS.Run.start('berserker', 65);
  DS.run.hp = 80; DS.run.maxHp = 80;
  await DS.Run.runEffects([{ op: 'max_hp', amount: -20 }]);
  eq(DS.run.maxHp, 60);
  eq(DS.run.hp, 60);
});
test('runops', 'add_card by id adds the card, upgraded when asked', async () => {
  DS.Run.start('berserker', 66);
  const n = DS.run.deck.length;
  await DS.Run.runEffects([{ op: 'add_card', card: STRIKE, upgraded: true }]);
  eq(DS.run.deck.length, n + 1);
  const added = DS.run.deck[DS.run.deck.length - 1];
  eq(added.id, STRIKE);
  eq(added.upgraded, true);
});
test('runops', 'add_card "random" uses the run character class', async () => {
  DS.Run.start('berserker', 67);
  await DS.Run.runEffects([{ op: 'add_card', card: 'random' }]);
  const last = DS.run.deck[DS.run.deck.length - 1];
  eq(DS.cards[last.id].class, 'berserker');
});
test('runops', 'remove_card with amount 2 and random removes two cards', async () => {
  DS.Run.start('berserker', 68);
  DS.run.deck = [{ uid: 'a', id: STRIKE, upgraded: false }, { uid: 'b', id: DEFEND, upgraded: false }, { uid: 'c', id: SKILL0, upgraded: false }, { uid: 'd', id: STRIKE, upgraded: false }];
  await DS.Run.runEffects([{ op: 'remove_card', amount: 2, random: true }]);
  eq(DS.run.deck.length, 2);
});
test('runops', 'remove_card with a type filter removes only matching cards', async () => {
  DS.Run.start('berserker', 69);
  DS.run.deck = [{ uid: 'a', id: STRIKE, upgraded: false }, { uid: 'b', id: DEFEND, upgraded: false }, { uid: 'c', id: STRIKE, upgraded: false }];
  await DS.Run.runEffects([{ op: 'remove_card', amount: 5, random: true, type: 'attack' }]);
  eq(DS.run.deck.map((x) => x.id), [DEFEND]);
});
test('runops', 'upgrade_card "all" upgrades every upgradeable card and skips curses', async () => {
  DS.Run.start('berserker', 70);
  DS.run.deck = [{ uid: 'a', id: STRIKE, upgraded: false }, { uid: 'b', id: STRIKE, upgraded: false }, { uid: 'c', id: 'curse_regret', upgraded: false }];
  await DS.Run.runEffects([{ op: 'upgrade_card', amount: 'all' }]);
  eq(DS.run.deck.map((x) => x.upgraded), [true, true, false]);
});
test('runops', 'upgrade_card random upgrades exactly one card', async () => {
  DS.Run.start('berserker', 71);
  DS.run.deck = [{ uid: 'a', id: STRIKE, upgraded: false }, { uid: 'b', id: STRIKE, upgraded: false }];
  await DS.Run.runEffects([{ op: 'upgrade_card', amount: 1, random: true }]);
  eq(DS.run.deck.filter((x) => x.upgraded).length, 1);
});
test('runops', 'transform_card random replaces the card with a different card of the class', async () => {
  DS.Run.start('berserker', 72);
  DS.run.deck = [{ uid: 'a', id: STRIKE, upgraded: false }];
  await DS.Run.runEffects([{ op: 'transform_card', amount: 1, random: true }]);
  eq(DS.run.deck.length, 1);
  ok(DS.run.deck[0].id !== STRIKE, 'the card did not change');
  eq(DS.cards[DS.run.deck[0].id].class, 'berserker');
});
test('runops', 'add_relic adds the relic once; a duplicate is ignored', () => {
  const rid = defRelic({});
  DS.Run.start('berserker', 73);
  eq(DS.Run.addRelic(rid), true);
  eq(DS.Run.addRelic(rid), false);
  eq(DS.run.relics.filter((r) => r.id === rid).length, 1);
});
test('runops', 'add_relic "random" gives a relic the run does not own yet', async () => {
  DS.Run.start('berserker', 74);
  const before = DS.run.relics.map((r) => r.id);
  await DS.Run.runEffects([{ op: 'add_relic', relic: 'random' }]);
  ok(DS.run.relics.length === before.length + 1, 'no relic was added');
  const added = DS.run.relics[DS.run.relics.length - 1].id;
  ok(!before.includes(added), 'the relic was already owned');
});
test('runops', 'add_relic "random" with rarity common gives a common relic', async () => {
  DS.Run.start('berserker', 75);
  await DS.Run.runEffects([{ op: 'add_relic', relic: 'random', rarity: 'common' }]);
  const added = DS.run.relics[DS.run.relics.length - 1].id;
  eq(DS.relics[added].rarity, 'common');
});
test('runops', 'add_potion puts a potion in the first free slot', async () => {
  const pid = defPotion({});
  DS.Run.start('berserker', 76);
  DS.run.potions = [null, null, null];
  await DS.Run.runEffects([{ op: 'add_potion', potion: pid }]);
  eq(DS.run.potions[0], pid);
});
test('runops', 'add_potion when every slot is full changes nothing', async () => {
  const pid = defPotion({});
  DS.Run.start('berserker', 77);
  DS.run.potions = ['po_a', 'po_b', 'po_c'];
  eq(DS.Run.addPotion(pid), false);
  eq(DS.run.potions, ['po_a', 'po_b', 'po_c']);
});
test('runops', 'add_potion "random" fills a slot with a real potion', async () => {
  DS.Run.start('berserker', 78);
  DS.run.potions = [null, null, null];
  await DS.Run.runEffects([{ op: 'add_potion', potion: 'random' }]);
  ok(DS.potions[DS.run.potions[0]], 'slot 0 is not a real potion');
});
test('runops', 'chance with p = 1 runs the then branch', async () => {
  DS.Run.start('berserker', 79);
  DS.run.gold = 0;
  await DS.Run.runEffects([{ op: 'chance', p: 1, then: [{ op: 'gold', amount: 5 }], else: [{ op: 'gold', amount: -5 }] }]);
  eq(DS.run.gold, 5);
});
test('runops', 'chance with p = 0 runs the else branch', async () => {
  DS.Run.start('berserker', 80);
  DS.run.gold = 20;
  await DS.Run.runEffects([{ op: 'chance', p: 0, then: [{ op: 'gold', amount: 5 }], else: [{ op: 'gold', amount: -5 }] }]);
  eq(DS.run.gold, 15);
});
test('runops', 'an event chance result text comes from thenResult', async () => {
  const ev = defEvent({ choices: [
    { label: 'Flip', effects: [{ op: 'chance', p: 1, then: [], else: [], thenResult: 'Heads!', elseResult: 'Tails!' }], result: 'Done.' },
    { label: 'Leave', effects: [], result: 'Bye.' },
  ] });
  DS.Run.start('berserker', 81);
  const r = await DS.Run.chooseEvent(ev, 0);
  eq(r.text, 'Heads!');
});
test('runops', 'a fight op makes chooseEvent report the encounter to fight', async () => {
  const enc = defEncounter([defEnemy({})]);
  const ev = defEvent({ choices: [
    { label: 'Fight', effects: [{ op: 'fight', encounter: enc }], result: 'Fight!' },
    { label: 'Leave', effects: [], result: 'Bye.' },
  ] });
  DS.Run.start('berserker', 82);
  const r = await DS.Run.chooseEvent(ev, 0);
  eq(r.fightEncounterId, enc);
});
test('runops', 'a custom run op receives the run', async () => {
  let seen = null;
  DS.Run.start('berserker', 83);
  await DS.Run.runEffects([{ op: 'custom', fn: ({ run }) => { seen = run; } }]);
  ok(seen === DS.run, 'custom op did not get the run');
});
test('runops', 'an event choice with minGold is disabled and refused when gold is short', async () => {
  const ev = defEvent({ choices: [
    { label: 'Pay', cond: { minGold: 100 }, effects: [], result: 'Paid.' },
    { label: 'Leave', effects: [], result: 'Bye.' },
  ] });
  DS.Run.start('berserker', 84);
  DS.run.gold = 10;
  const ch = DS.Run.getEvent(ev).choices;
  eq(ch[0].enabled, false);
  eq(ch[1].enabled, true);
  const r = await DS.Run.chooseEvent(ev, 0);
  eq(r.ok, false);
});
test('runops', 'an event choice with minGold is enabled when gold is enough', () => {
  const ev = defEvent({ choices: [
    { label: 'Pay', cond: { minGold: 100 }, effects: [], result: 'Paid.' },
    { label: 'Leave', effects: [], result: 'Bye.' },
  ] });
  DS.Run.start('berserker', 85);
  DS.run.gold = 100;
  eq(DS.Run.getEvent(ev).choices[0].enabled, true);
});
test('runops', 'an event choice with minHp is disabled below that HP', () => {
  const ev = defEvent({ choices: [
    { label: 'Sacrifice', cond: { minHp: 30 }, effects: [], result: 'x' },
    { label: 'Leave', effects: [], result: 'y' },
  ] });
  DS.Run.start('berserker', 86);
  DS.run.hp = 10;
  eq(DS.Run.getEvent(ev).choices[0].enabled, false);
});
test('runops', 'an event choice with hasRelic needs that relic', () => {
  const rid = defRelic({});
  const ev = defEvent({ choices: [
    { label: 'Use relic', cond: { hasRelic: rid }, effects: [], result: 'x' },
    { label: 'Leave', effects: [], result: 'y' },
  ] });
  DS.Run.start('berserker', 87);
  eq(DS.Run.getEvent(ev).choices[0].enabled, false);
  DS.run.relics.push({ id: rid, counter: 0 });
  eq(DS.Run.getEvent(ev).choices[0].enabled, true);
});
test('runops', 'an event choice with hasCardType curse needs a curse in the deck', () => {
  const ev = defEvent({ choices: [
    { label: 'Cleanse', cond: { hasCardType: 'curse' }, effects: [], result: 'x' },
    { label: 'Leave', effects: [], result: 'y' },
  ] });
  DS.Run.start('berserker', 88);
  eq(DS.Run.getEvent(ev).choices[0].enabled, false);
  DS.run.deck.push({ uid: 'cz', id: 'curse_regret', upgraded: false });
  eq(DS.Run.getEvent(ev).choices[0].enabled, true);
});
test('runops', 'getEvent returns each choice with its label and index', () => {
  const ev = defEvent({ choices: [
    { label: 'One', effects: [], result: 'x' },
    { label: 'Two', effects: [], result: 'y' },
  ] });
  DS.Run.start('berserker', 89);
  const ch = DS.Run.getEvent(ev).choices;
  eq(ch.map((x) => [x.label, x.index]), [['One', 0], ['Two', 1]]);
});
test('runops', 'chooseEvent applies the effects and returns the result text', async () => {
  const ev = defEvent({ choices: [
    { label: 'Take gold', effects: [{ op: 'gold', amount: 9 }], result: 'You feel richer.' },
    { label: 'Leave', effects: [], result: 'Bye.' },
  ] });
  DS.Run.start('berserker', 90);
  DS.run.gold = 1;
  const r = await DS.Run.chooseEvent(ev, 0);
  eq(DS.run.gold, 10);
  eq(r.text, 'You feel richer.');
});
test('runops', 'a relic onPickup trigger fires when the relic is added', () => {
  const rid = defRelic({ triggers: { onPickup: [{ op: 'gold', amount: 4 }] } });
  DS.Run.start('berserker', 91);
  DS.run.gold = 0;
  DS.Run.addRelic(rid);
  eq(DS.run.gold, 4);
});
test('runops', 'a relic onRoomEnter trigger sees the room type', () => {
  const rid = defRelic({ triggers: { onRoomEnter: { when: { roomType: 'shop' }, effects: [{ op: 'gold', amount: 2 }] } } });
  DS.Run.start('berserker', 92);
  DS.run.relics.push({ id: rid, counter: 0 });
  DS.run.gold = 0;
  enterForced(DS.run, 'fight');
  eq(DS.run.gold, 0, 'fired for a fight');
  enterForced(DS.run, 'shop');
  eq(DS.run.gold, 2, 'did not fire for a shop');
});
test('runops', 'a relic onCardAdded trigger fires when a card joins the deck', () => {
  const rid = defRelic({ triggers: { onCardAdded: { when: { cardType: 'attack' }, effects: [{ op: 'gold', amount: 1 }] } } });
  DS.Run.start('berserker', 93);
  DS.run.relics.push({ id: rid, counter: 0 });
  DS.run.gold = 0;
  DS.Run.addCard(DEFEND, false);
  eq(DS.run.gold, 0, 'fired for a skill');
  DS.Run.addCard(STRIKE, false);
  eq(DS.run.gold, 1);
});
test('runops', 'a relic onShopEnter and onChestOpen trigger fire on those rooms', () => {
  const shopRelic = defRelic({ triggers: { onShopEnter: [{ op: 'gold', amount: 2 }] } });
  const chestRelic = defRelic({ triggers: { onChestOpen: [{ op: 'gold', amount: 3 }] } });
  DS.Run.start('berserker', 94);
  DS.run.relics.push({ id: shopRelic, counter: 0 }, { id: chestRelic, counter: 0 });
  DS.run.gold = 0;
  enterForced(DS.run, 'shop');
  eq(DS.run.gold, 2);
  enterForced(DS.run, 'treasure');
  ok(DS.run.gold >= 5, `gold ${DS.run.gold} after a treasure room`);
});

// ---------------------------------------------------------------------------
// Save and load
// ---------------------------------------------------------------------------
test('save', 'save then load gives back the same run', () => {
  withStorageSync(() => {
    DS.Run.start('berserker', 101);
    DS.Run.addGold(7);
    DS.Run.addCard(DEFEND, true);
    const before = JSON.parse(JSON.stringify(DS.run));
    eq(DS.Run.save(), true);
    eq(DS.Run.load(), true);
    eq(JSON.parse(JSON.stringify(DS.run)), before);
  });
});
test('save', 'load returns false when there is no save', () => {
  withStorageSync(() => {
    DS.Run.clearSave();
    eq(DS.Run.load(), false);
    eq(DS.Run.hasSave(), false);
  });
});
test('save', 'hasSave is true after save and false after clearSave', () => {
  withStorageSync(() => {
    DS.Run.start('berserker', 102);
    DS.Run.save();
    eq(DS.Run.hasSave(), true);
    DS.Run.clearSave();
    eq(DS.Run.hasSave(), false);
  });
});
test('save', 'ending the run clears the save', () => {
  withStorageSync(() => {
    DS.Run.start('berserker', 103);
    DS.Run.save();
    DS.Run.end(false);
    eq(DS.Run.hasSave(), false);
  });
});
test('save', 'load restores the gold that was saved, not the gold that came after', () => {
  withStorageSync(() => {
    DS.Run.start('berserker', 104);
    DS.run.gold = 30;
    DS.Run.save();
    DS.run.gold = 999;
    DS.Run.load();
    eq(DS.run.gold, 30);
  });
});
test('save', 'a fight entered but not won resumes into that same fight after load', () => {
  requireV2('DS.Run.resumeTarget', typeof DS.Run.resumeTarget === 'function');
  withStorageSync(() => {
    DS.Run.start('berserker', 105);
    const { room } = enterForced(DS.run, 'fight');
    DS.Run.save();
    ok(DS.Run.load(), 'load failed');
    const r = DS.Run.resumeTarget();
    eq(r && r.screen, 'combat', 'resume did not go to the fight');
    eq(r.params.encounterId, room.encounterId, 'resume went to another encounter');
  });
});
test('save', 'nextAct moves to the next act, refills HP, makes a new map and resets the act counters', () => {
  DS.Run.start('berserker', 106);
  const oldMap = JSON.stringify(DS.run.map);
  DS.run.hp = 3;
  DS.run.actFights = 7;
  eq(DS.Run.nextAct(), true);
  eq(DS.run.act, 2);
  eq(DS.run.hp, DS.run.maxHp);
  eq(DS.run.actFights, 0);
  ok(JSON.stringify(DS.run.map) !== oldMap, 'the map was not regenerated');
});
test('save', 'nextAct from act 3 returns false and marks the run as won', () => {
  DS.Run.start('berserker', 107);
  DS.Run.nextAct();
  DS.Run.nextAct();
  eq(DS.run.act, 3);
  eq(DS.Run.nextAct(), false);
  eq(DS.run.won, true);
});

// ---------------------------------------------------------------------------
// Relic and content sanity (real content)
// ---------------------------------------------------------------------------
const COMBAT_OPS = ['damage', 'lose_hp', 'block', 'apply', 'remove_status', 'multiply_status', 'heal', 'draw', 'energy',
  'discard', 'exhaust', 'add_card', 'upgrade_hand', 'gold', 'max_hp', 'repeat', 'if', 'summon', 'custom'];
const RUN_OPS = ['gold', 'heal', 'lose_hp', 'max_hp', 'add_card', 'remove_card', 'upgrade_card', 'transform_card',
  'add_relic', 'add_potion', 'chance', 'fight', 'custom'];
function opsIn(list, out) {
  for (const e of list || []) {
    if (!e || typeof e !== 'object') continue;
    out.push(e.op);
    for (const k of ['effects', 'onKill', 'then', 'else']) if (Array.isArray(e[k])) opsIn(e[k], out);
  }
  return out;
}
test('content', 'every real character has a starter deck of known cards and a known starter relic', () => {
  for (const ch of Object.values(DS.characters)) {
    for (const id of ch.starterDeck) ok(DS.cards[id], `${ch.id} starter card ${id} is unknown`);
    ok(DS.relics[ch.starterRelic], `${ch.id} starter relic ${ch.starterRelic} is unknown`);
    ok(ch.hp > 0, `${ch.id} has no hp`);
  }
});
test('content', 'the shared curse and status cards exist', () => {
  for (const id of ['curse_regret', 'curse_pain', 'curse_doubt', 'curse_injury', 'curse_decay', 'curse_clumsy',
    'curse_parasite', 'curse_writhe', 'curse_shame', 'curse_normality', 'status_wound', 'status_dazed', 'status_burn',
    'status_slimed', 'status_void']) {
    ok(DS.cards[id], `${id} is missing`);
  }
});
test('content', 'every real card effect uses only combat ops', () => {
  for (const d of Object.values(DS.cards)) {
    const used = opsIn(d.effects, []).concat(opsIn(d.upgrade && d.upgrade.effects, []));
    for (const hook of ['onDraw', 'onEndTurnInHand', 'onExhaust', 'onDiscard']) opsIn(d[hook], used);
    for (const op of used) ok(COMBAT_OPS.includes(op), `${d.id} uses non-combat op '${op}'`);
  }
});
test('content', 'every real event choice uses only run-level ops', () => {
  for (const ev of Object.values(DS.events_)) {
    for (const ch of ev.choices) {
      for (const op of opsIn(ch.effects, [])) ok(RUN_OPS.includes(op), `${ev.id} uses non-run op '${op}'`);
    }
  }
});
test('content', 'every real event has at least one choice that is always available', () => {
  for (const ev of Object.values(DS.events_)) {
    ok(ev.choices.some((ch) => !ch.cond), `${ev.id} has no always-available choice`);
  }
});
test('content', 'every real encounter lists only known enemies, and every enemy has moves', () => {
  for (const enc of Object.values(DS.encounters)) {
    for (const id of enc.enemies) ok(DS.enemies[id], `${enc.id} lists unknown enemy ${id}`);
  }
  for (const en of Object.values(DS.enemies)) {
    ok(en.moves && Object.keys(en.moves).length > 0, `${en.id} has no moves`);
    ok(en.pattern || en.ai, `${en.id} has neither pattern nor ai`);
  }
});
test('content', 'every real card costs a number, X, or -1', () => {
  for (const d of Object.values(DS.cards)) {
    ok(d.cost === 'X' || (Number.isInteger(d.cost) && d.cost >= -1), `${d.id} cost is ${d.cost}`);
  }
});

// ---------------------------------------------------------------------------
// Version 2 APIs. A missing API fails with "v2 API missing: X".
// ---------------------------------------------------------------------------
function requireV2(name, present) {
  if (!present) throw new Fail(`v2 API missing: ${name}`);
}
function fakeStorage(store) {
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
  };
}
// Runs fn with an in-memory localStorage stand-in, then restores the previous global.
function withStorageSync(fn) {
  const store = new Map();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  globalThis.localStorage = fakeStorage(store);
  try {
    return fn(store);
  } finally {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  }
}
async function withStorage(fn) {
  const store = new Map();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  globalThis.localStorage = fakeStorage(store);
  try {
    return await fn(store);
  } finally {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  }
}
function combatSnapshot(c) {
  return JSON.stringify({
    player: c.player,
    enemies: c.enemies.map((e) => ({ id: e.id, hp: e.hp, block: e.block, statuses: e.statuses, dead: e.dead, intent: e.intent })),
    hand: c.hand.map((x) => x.uid),
    draw: c.drawPile.map((x) => x.uid),
    discard: c.discardPile.map((x) => x.uid),
    exhaust: c.exhaustPile.map((x) => x.uid),
    turn: c.turn,
    phase: c.phase,
    log: Array.isArray(c.log) ? c.log.length : null,
    runHp: DS.run ? DS.run.hp : null,
  });
}

test('v2', 'settings: the defaults are speed 1, confirmEndTurn false, screenShake true and showLog true', () => {
  requireV2('DS.settings', DS.settings && typeof DS.settings.get === 'function' && typeof DS.settings.set === 'function');
  eq(DS.settings.get('speed'), 1);
  eq(DS.settings.get('confirmEndTurn'), false);
  eq(DS.settings.get('screenShake'), true);
  eq(DS.settings.get('showLog'), true);
});
test('v2', 'settings: set changes the value and emits settings:update with key and value', () => {
  requireV2('DS.settings', DS.settings && typeof DS.settings.set === 'function');
  const log = listen('settings:update');
  DS.settings.set('speed', 2);
  eq(DS.settings.get('speed'), 2);
  const last = log[log.length - 1];
  ok(last && last.key === 'speed' && last.value === 2, 'no matching settings:update event');
  DS.settings.set('speed', 1);
});
test('v2', 'settings: an unknown key gives the fallback', () => {
  requireV2('DS.settings', DS.settings && typeof DS.settings.get === 'function');
  eq(DS.settings.get('t_no_such_setting', 'fallback'), 'fallback');
});
test('v2', 'settings: values are saved under duskspire_settings', () => {
  requireV2('DS.settings', DS.settings && typeof DS.settings.set === 'function');
  withStorageSync((store) => {
    DS.settings.set('muted', true);
    ok(store.has('duskspire_settings'), 'nothing was saved under duskspire_settings');
    DS.settings.set('muted', false);
  });
});
test('v2', 'Run.ASCENSIONS has ten levels numbered 1 to 10, each with a name and a description', () => {
  requireV2('DS.Run.ASCENSIONS', Array.isArray(DS.Run.ASCENSIONS));
  eq(DS.Run.ASCENSIONS.length, 10);
  DS.Run.ASCENSIONS.forEach((a, i) => {
    eq(a.level, i + 1, `level of entry ${i}`);
    ok(typeof a.name === 'string' && a.name, `level ${i + 1} has no name`);
    ok(typeof a.desc === 'string' && a.desc, `level ${i + 1} has no desc`);
  });
});
test('v2', 'Run.start accepts {seed, ascension} and records the ascension', () => {
  const run = DS.Run.start('berserker', { seed: 5, ascension: 3 });
  requireV2('run.ascension', run.ascension !== undefined);
  eq(run.ascension, 3);
});
test('v2', 'ascension 0 leaves every difficulty multiplier at 1', () => {
  const run = DS.Run.start('berserker', { seed: 6, ascension: 0 });
  const d = run.difficulty || {};
  for (const k of ['enemyHpMul', 'enemyDmgMul', 'eliteHpMul', 'bossHpMul']) {
    eq(d[k] === undefined ? 1 : d[k], 1, k);
  }
});
test('v2', 'ascension 10 raises every spawned enemy max HP (a 100 HP enemy spawns above 100)', async () => {
  requireV2('run.difficulty', true);
  const enc = defEncounter([defEnemy({ hp: [100, 100] })], 'normal');
  DS.Run.start('berserker', { seed: 5, ascension: 0 });
  const c0 = new DS.Combat(DS.run, enc);
  await c0.start();
  eq(c0.enemies[0].maxHp, 100, 'ascension 0 changed the enemy HP');
  DS.Run.start('berserker', { seed: 5, ascension: 10 });
  const c10 = new DS.Combat(DS.run, enc);
  await c10.start();
  const hp = c10.enemies[0].maxHp;
  ok(hp > 100 && hp <= 130, `ascension 10 enemy HP is ${hp}`);
  ok(c10.enemies[0].hp === hp, 'current HP does not start at max HP');
});
test('v2', 'ascension 10 raises elite HP above the ascension 0 value', async () => {
  requireV2('run.difficulty', true);
  const enc = defEncounter([defEnemy({ hp: [100, 100], tier: 'elite' })], 'elite');
  DS.Run.start('berserker', { seed: 6, ascension: 10 });
  const c = new DS.Combat(DS.run, enc);
  await c.start();
  ok(c.enemies[0].maxHp > 100, `elite HP is ${c.enemies[0].maxHp}`);
});
test('v2', 'c.preview returns damage, times and block for a card against an enemy', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  requireV2('c.preview', typeof c.preview === 'function');
  const p = c.preview(c.makeCard({ id: STRIKE }), c.enemies[0]);
  eq(p.damage, 6);
  eq(p.times, 1);
  eq(p.block, null);
});
test('v2', 'c.preview includes strength and weak in the damage number', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], pstatus: { strength: 2 } });
  requireV2('c.preview', typeof c.preview === 'function');
  eq(c.preview(c.makeCard({ id: STRIKE }), c.enemies[0]).damage, 8);
  c.player.statuses.strength = 0;
  c.player.statuses.weak = 1;
  eq(c.preview(c.makeCard({ id: STRIKE }), c.enemies[0]).damage, 4);
});
test('v2', 'c.preview gives block for a block card and null damage', async () => {
  const c = await combatOf({});
  requireV2('c.preview', typeof c.preview === 'function');
  const p = c.preview(c.makeCard({ id: DEFEND }), null);
  eq(p.block, 5);
  eq(p.damage, null);
});
test('v2', 'c.preview changes no combat state', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })], hand: [STRIKE, DEFEND], pstatus: { strength: 1 }, estatus: { vulnerable: 1 } });
  requireV2('c.preview', typeof c.preview === 'function');
  const before = combatSnapshot(c);
  c.preview(c.hand[0], c.enemies[0]);
  c.preview(c.hand[1], null);
  c.preview(c.hand[0], null);
  eq(combatSnapshot(c), before);
});
test('v2', 'c.preview gives finite, non-negative numbers for every real card, normal and upgraded', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  requireV2('c.preview', typeof c.preview === 'function');
  const bad = [];
  for (const id of Object.keys(DS.cards)) {
    for (const up of [false, true]) {
      const card = c.makeCard({ id, upgraded: up });
      for (const target of [c.enemies[0], null]) {
        const p = c.preview(card, target);
        for (const k of ['damage', 'block']) {
          if (p[k] !== null && !(Number.isFinite(p[k]) && p[k] >= 0)) bad.push(`${id}${up ? '+' : ''} ${k}=${p[k]}`);
        }
        if (!(Number.isFinite(p.times) && p.times >= 0)) bad.push(`${id} times=${p.times}`);
      }
    }
  }
  ok(bad.length === 0, bad.slice(0, 4).join('; '));
});
test('v2', 'c.log gets an entry for each action, with a turn and text', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  requireV2('c.log', Array.isArray(c.log));
  const before = c.log.length;
  await playId(c, STRIKE);
  ok(c.log.length > before, 'playing a card added no log entry');
  const e = c.log[c.log.length - 1];
  ok(typeof e.text === 'string' && e.text.length > 0, 'log entry has no text');
  eq(typeof e.turn, 'number');
});
test('v2', 'c.log emits combat:log for each entry it adds', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100, 100] })] });
  requireV2('c.log', Array.isArray(c.log));
  const got = listen('combat:log');
  await playId(c, STRIKE);
  ok(got.length > 0, 'no combat:log event');
});
test('v2', 'c.log keeps at most 200 entries', async () => {
  const c = await combatOf({ enemies: [defEnemy({ hp: [100000, 100000] })] });
  requireV2('c.log', Array.isArray(c.log));
  for (let i = 0; i < 230; i++) {
    c.player.energy = 9;
    await playId(c, STRIKE);
  }
  ok(c.log.length <= 200, `log has ${c.log.length} entries`);
  ok(c.log.length >= 150, `log has only ${c.log.length} entries`);
});
test('v2', 'DS.Meta exists and get() returns the save shape', () => {
  requireV2('DS.Meta', DS.Meta && typeof DS.Meta.get === 'function');
  withStorageSync(() => {
    DS.Meta.reset();
    const m = DS.Meta.get();
    ok(typeof m.runs === 'number' && Array.isArray(m.history), 'shape is wrong');
  });
});
test('v2', 'Run.end records the run in Meta (runs goes up by one, newest history first)', () => {
  requireV2('DS.Meta', DS.Meta && typeof DS.Meta.recordRun === 'function');
  withStorageSync(() => {
    DS.Meta.reset();
    const before = DS.Meta.get().runs;
    DS.Run.start('berserker', 9);
    DS.Run.end(false);
    eq(DS.Meta.get().runs, before + 1);
    eq(DS.Meta.get().history[0].character, 'berserker');
  });
});
test('v2', 'Meta round trip: the stored JSON under duskspire_meta matches get()', () => {
  requireV2('DS.Meta', DS.Meta && typeof DS.Meta.recordRun === 'function');
  withStorageSync((store) => {
    DS.Meta.reset();
    DS.Run.start('shade', 9);
    DS.Meta.recordRun(DS.run);
    const raw = store.get('duskspire_meta');
    ok(raw, 'nothing saved under duskspire_meta');
    eq(JSON.parse(raw), JSON.parse(JSON.stringify(DS.Meta.get())));
  });
});
test('v2', 'Meta.unlock returns true the first time and false after', () => {
  requireV2('DS.Meta.unlock', DS.Meta && typeof DS.Meta.unlock === 'function');
  withStorageSync(() => {
    DS.Meta.reset();
    const id = DS.Meta.ACHIEVEMENTS[0].id;
    eq(DS.Meta.unlock(id), true);
    eq(DS.Meta.unlock(id), false);
    ok(DS.Meta.get().achievements[id], 'achievement date not stored');
  });
});
test('v2', 'Meta.maxAscension is 0 at first and rises to 1 after an ascension 0 win', () => {
  requireV2('DS.Meta.maxAscension', DS.Meta && typeof DS.Meta.maxAscension === 'function');
  withStorageSync(() => {
    DS.Meta.reset();
    eq(DS.Meta.maxAscension('berserker'), 0);
    DS.Run.start('berserker', { seed: 3, ascension: 0 });
    DS.Run.end(true);
    eq(DS.Meta.maxAscension('berserker'), 1);
  });
});
test('v2', 'Meta.markSeen records a card as seen', () => {
  requireV2('DS.Meta.markSeen', DS.Meta && typeof DS.Meta.markSeen === 'function');
  withStorageSync(() => {
    DS.Meta.reset();
    DS.Meta.markSeen('cards', STRIKE);
    eq(DS.Meta.get().seen.cards[STRIKE], true);
  });
});
test('v2', 'Meta.reset clears the run count', () => {
  requireV2('DS.Meta.reset', DS.Meta && typeof DS.Meta.reset === 'function');
  withStorageSync(() => {
    DS.Run.start('berserker', 10);
    DS.Run.end(false);
    DS.Meta.reset();
    eq(DS.Meta.get().runs, 0);
  });
});
test('v2', 'Run.score returns a finite number for a finished run', () => {
  requireV2('DS.Run.score', typeof DS.Run.score === 'function');
  withStorageSync(() => {
    DS.Run.start('berserker', 11);
    DS.Run.end(true);
    ok(Number.isFinite(DS.Run.score(DS.run)), 'score is not a finite number');
  });
});
test('v2', 'a fight op with encounter random_normal resolves to a normal encounter', async () => {
  DS.Run.start('berserker', 12);
  const ev = defEvent({ choices: [
    { label: 'Fight', effects: [{ op: 'fight', encounter: 'random_normal' }], result: 'x' },
    { label: 'Leave', effects: [], result: 'y' },
  ] });
  const r = await DS.Run.chooseEvent(ev, 0);
  const enc = DS.encounters[r.fightEncounterId];
  ok(enc && enc.tier === 'normal', `random_normal gave ${r.fightEncounterId}`);
});
test('v2', 'a fight op with encounter random_elite resolves to an elite encounter', async () => {
  DS.Run.start('berserker', 13);
  const ev = defEvent({ choices: [
    { label: 'Fight', effects: [{ op: 'fight', encounter: 'random_elite' }], result: 'x' },
    { label: 'Leave', effects: [], result: 'y' },
  ] });
  const r = await DS.Run.chooseEvent(ev, 0);
  const enc = DS.encounters[r.fightEncounterId];
  ok(enc && enc.tier === 'elite', `random_elite gave ${r.fightEncounterId}`);
});

// Resume: a room entered and then saved must be returned to on Continue. resumeTarget() gives the
// screen to show ({screen, params}); the screen must match the room that was entered.
const RESUME_SCREEN = { combat: 'combat', rest: 'rest', shop: 'shop', event: 'event', treasure: 'treasure' };
// ---------------------------------------------------------------------------
// v2 regressions: combat-start effects, draw-pile placement, of:'target', stale rooms
// ---------------------------------------------------------------------------
test('flow', 'block and energy granted by onCombatStart survive into turn 1', async () => {
  const relic = defRelic({ triggers: { onCombatStart: [{ op: 'block', amount: 3 }, { op: 'energy', amount: 1 }] } });
  const enc = defEncounter([defEnemy({})], 'normal');
  const run = newRun({ relics: [relic] });
  const c = new DS.Combat(run, enc);
  await c.start();
  eq(c.turn, 1, 'the first player turn did not start');
  eq(c.player.block, 3, 'combat-start block was wiped on turn 1');
  eq(c.player.energy, 4, 'combat-start energy was wiped on turn 1 (3 base + 1 granted)');
});
test('flow', 'turn 2 still starts with zero block and base energy', async () => {
  const relic = defRelic({ triggers: { onCombatStart: [{ op: 'block', amount: 3 }] } });
  const enc = defEncounter([defEnemy({})], 'normal');
  const run = newRun({ relics: [relic] });
  const c = new DS.Combat(run, enc);
  await c.start();
  await c.endTurn();
  eq(c.turn, 2);
  eq(c.player.block, 0, 'block carried into turn 2');
  eq(c.player.energy, 3, 'energy not reset on turn 2');
});
test('piles', 'a card added to the draw pile lands at a random position, not always on top', async () => {
  const c = await combatOf({ deck: [] });
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    c.drawPile = [1, 2, 3, 4, 5, 6].map((n) => ({ uid: 'u' + n, id: 'x', data: {} }));
    const card = c.makeCard({ id: STRIKE, upgraded: false });
    c._placeCard(card, 'draw');
    seen.add(c.drawPile.indexOf(card));
    c._detach(card);
  }
  ok(seen.size >= 4, `expected varied positions, saw ${seen.size}`);
});
test('values', 'of:"target" with no target reads zero instead of the player', async () => {
  const c = await combatOf({ pblock: 9 });
  eq(await valueOf(c, { v: 'block', of: 'target' }), 0, 'read the player block through of:target');
});
test('values', 'of:"target" reads the chosen target when there is one', async () => {
  const c = await combatOf({});
  const enemy = c.livingEnemies()[0];
  const before = c.player.block;
  await c.runEffects([{ op: 'block', amount: { v: 'max_hp', of: 'target' } }], { source: c.player, target: enemy });
  eq(c.player.block - before, enemy.maxHp, 'of:target did not read the enemy max hp');
});
test('resume', 'listing the map closes a reward room that was left open', async () => {
  requireV2('DS.Run.closeRoom', typeof DS.Run.closeRoom === 'function');
  await withStorage(async () => {
    DS.Run.start('berserker', 5);
    DS.run.room = { type: 'reward', tier: 'normal', fromEvent: false, gold: 10, cardChoices: [], potion: null, relic: null, claimed: {} };
    DS.Run.availableNodes();
    eq(DS.run.room, null, 'a reward room left for the map was still open');
  });
});
test('resume', 'listing the map keeps a boss reward room open (it leaves through the boss relic step)', async () => {
  requireV2('DS.Run.closeRoom', typeof DS.Run.closeRoom === 'function');
  await withStorage(async () => {
    DS.Run.start('berserker', 5);
    DS.run.room = { type: 'reward', tier: 'boss', fromEvent: false, gold: 10, cardChoices: [], potion: null, relic: null, claimed: {} };
    DS.Run.availableNodes();
    ok(DS.run.room && DS.run.room.type === 'reward', 'the boss reward room was closed from the map');
  });
});

async function resumeCase(type, roomType) {
  requireV2('DS.Run.resumeTarget', typeof DS.Run.resumeTarget === 'function');
  return withStorage(async () => {
    for (let seed = 1; seed <= 80; seed++) {
      DS.Run.start('berserker', seed);
      const { room } = enterForced(DS.run, type);
      if (!room || room.type !== roomType) continue;
      DS.Run.save();
      ok(DS.Run.load(), 'load() failed after save()');
      const r = DS.Run.resumeTarget();
      ok(r, 'resumeTarget() returned nothing after load');
      eq(r.screen, RESUME_SCREEN[roomType], `${type} room resumes on the wrong screen`);
      if (roomType === 'combat') {
        eq(r.params && r.params.encounterId, room.encounterId, 'resumed into another encounter');
      }
      if (roomType === 'event') {
        eq(r.params && r.params.eventId, room.eventId, 'resumed into another event');
      }
      return;
    }
    throw new Fail(`could not create a ${type} room in 80 seeds`);
  });
}
test('resume', 'Continue returns to a fight room that was entered', () => resumeCase('fight', 'combat'));
test('resume', 'Continue returns to an elite room that was entered', () => resumeCase('elite', 'combat'));
test('resume', 'Continue returns to a boss room that was entered', () => resumeCase('boss', 'combat'));
test('resume', 'Continue returns to a rest room that was entered', () => resumeCase('rest', 'rest'));
test('resume', 'Continue returns to a shop that was entered', () => resumeCase('shop', 'shop'));
test('resume', 'Continue returns to an event that was entered', () => resumeCase('event', 'event'));
test('resume', 'Continue returns to a treasure room that was entered', () => resumeCase('treasure', 'treasure'));

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
function withTimeout(fn) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${TEST_TIMEOUT_MS} ms`)), TEST_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve().then(fn), limit]).finally(() => clearTimeout(timer));
}

async function runAll() {
  const selected = TESTS.filter((t) => !ONLY || `${t.group} > ${t.name}`.includes(ONLY));
  if (LIST_ONLY) {
    for (const t of selected) out(`${t.group} > ${t.name}`);
    return;
  }
  const started = Date.now();
  const failures = [];
  let passed = 0;
  out('==============================================================');
  out(' DUSKSPIRE ENGINE TESTS');
  out(` tests: ${selected.length}${ONLY ? `   filter: --only=${ONLY}` : ''}`);
  if (notLoaded.length) out(` not loaded (file missing): ${notLoaded.join(', ')}`);
  for (const f of loadFailures) out(` LOAD FAILURE ${f}`);
  out('==============================================================');
  let lastGroup = '';
  for (const t of selected) {
    if (t.group !== lastGroup) {
      out('');
      out(`-- ${t.group} --`);
      lastGroup = t.group;
    }
    resetState();
    let err = null;
    try {
      await withTimeout(t.fn);
    } catch (e) {
      err = e;
    }
    resetState();
    if (err) {
      const msg = err instanceof Fail ? err.message : `threw: ${err && err.message ? err.message : String(err)}`;
      failures.push({ label: `${t.group} > ${t.name}`, msg });
      out(`  FAIL  ${t.name}`);
      out(`          ${msg.replace(/\n/g, '\n          ')}`);
    } else {
      passed++;
      out(`  PASS  ${t.name}`);
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  out('');
  out('==============================================================');
  out(` RESULT: ${passed} passed, ${failures.length} failed, ${selected.length} total (${secs}s)`);
  out(` engine console messages suppressed: ${engineWarnings}`);
  if (failures.length) {
    out(' Failed:');
    for (const f of failures) out(`   - ${f.label}: ${f.msg.split('\n')[0].slice(0, 300)}`);
  }
  out('==============================================================');
  out(`TESTS RESULT: ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length} failed)`}`);
  process.exitCode = failures.length ? 1 : 0;
}

runAll().catch((e) => {
  out(`test harness failure: ${e && e.message ? e.message : e}`);
  process.exitCode = 1;
});
setTimeout(() => process.exit(process.exitCode || 0), 10 * 60 * 1000).unref();
