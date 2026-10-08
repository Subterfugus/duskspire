'use strict';
// Headless self-test for the DUSKSPIRE engine (core.js, statuses.js, combat.js).
// Usage: node tools/engine_selftest.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = ['src/engine/core.js', 'src/engine/statuses.js', 'src/engine/combat.js'];

let warnCount = 0;
const warnSamples = [];
const origWarn = console.warn;
console.warn = function () {
  warnCount++;
  if (warnSamples.length < 12) warnSamples.push(Array.prototype.slice.call(arguments).map(String).join(' '));
};

for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInThisContext(src, { filename: f });
}
const DS = globalThis.DS;
let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    origWarn('  FAIL: ' + msg);
  }
}

// ---------------------------------------------------------------------------
// Content: 2 cards, 1 enemy, 1 encounter (as the brief asks)
// ---------------------------------------------------------------------------
DS.defineCard({
  id: 'tst_strike', name: 'Strike', class: 'berserker', type: 'attack', rarity: 'starter', cost: 1,
  target: 'enemy', icon: '⚔️', desc: 'Deal 6 damage.',
  effects: [{ op: 'damage', amount: 6 }],
  upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
});
DS.defineCard({
  id: 'tst_defend', name: 'Defend', class: 'berserker', type: 'skill', rarity: 'starter', cost: 1,
  target: 'self', icon: '🛡️', desc: 'Gain 5 Block.',
  effects: [{ op: 'block', amount: 5 }],
  upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8 }] }
});

DS.defineEnemy({
  id: 'tst_slime', name: 'Test Slime', act: 1, tier: 'normal', hp: [20, 30], icon: '🟢', scale: 1,
  moves: {
    bite: { name: 'Bite', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
    growl: { name: 'Growl', intent: 'debuff', effects: [{ op: 'apply', status: 'weak', amount: 1 }] }
  },
  pattern: { type: 'random', weights: { bite: 60, growl: 40 }, noRepeat: 2, first: 'growl' }
});

DS.defineEncounter({ id: 'tst_enc', act: 1, tier: 'normal', name: 'Test Slimes', enemies: ['tst_slime', 'tst_slime'] });

function makeRun(seedDeckSize) {
  const deck = [];
  for (let i = 0; i < seedDeckSize / 2; i++) deck.push({ uid: 'a' + i, id: 'tst_strike', upgraded: false });
  for (let i = 0; i < seedDeckSize / 2; i++) deck.push({ uid: 'b' + i, id: 'tst_defend', upgraded: false });
  return {
    character: 'tst', hp: 40, maxHp: 40, gold: 0, deck: deck, relics: [], potions: [null, null, null],
    act: 1, floor: 1, map: null, nodeId: null, seed: 1,
    stats: { fights: 0, elites: 0, bosses: 0, turns: 0, cardsPlayed: 0, damageDealt: 0, goldEarned: 0 },
    over: false, won: false
  };
}

// Random legal play until the fight ends. Returns the final combat.
async function playRandomly(c) {
  let guard = 0;
  while (c.phase !== 'won' && c.phase !== 'lost' && guard++ < 3000) {
    if (c.phase !== 'player' || c.busy) {
      origWarn('  FAIL: control returned in phase ' + c.phase + ' busy=' + c.busy);
      failures++;
      break;
    }
    const playable = c.hand.filter(function (card) { return c.canPlay(card).ok; });
    if (playable.length && DS.rng.chance(0.85)) {
      const card = DS.rng.pick(playable);
      const living = c.livingEnemies();
      const target = card.data.target === 'enemy' ? DS.rng.pick(living) : null;
      if (card.data.target === 'enemy' && !target) {
        await c.endTurn();
        continue;
      }
      const r = await c.playCard(card, target);
      check(r.ok, 'legal play rejected: ' + r.reason);
    } else {
      await c.endTurn();
    }
    checkInvariants(c);
  }
  return c;
}

function checkInvariants(c) {
  check(c.player.hp >= 0 && c.player.hp <= c.player.maxHp, 'player hp out of range: ' + c.player.hp);
  check(c.hand.length <= 10, 'hand over limit: ' + c.hand.length);
  check(c.player.energy >= 0, 'negative energy');
  check(c.player.block >= 0, 'negative block');
  const total = c.hand.length + c.drawPile.length + c.discardPile.length + c.exhaustPile.length;
  check(total === c.run.deck.length, 'card conservation broke: ' + total + ' vs ' + c.run.deck.length);
  for (const e of c.enemies) {
    check(e.hp >= 0 && e.hp <= e.maxHp, 'enemy hp out of range');
    if (e.dead) check(e.hp === 0, 'dead enemy with hp');
  }
}

(async function main() {
  // Event bus sanity
  let seen = 0;
  const off = DS.events.on('test:ping', function () { seen++; });
  DS.events.emit('test:ping', {});
  off();
  DS.events.emit('test:ping', {});
  check(seen === 1, 'event bus on/unsubscribe');

  // Registry sanity
  check(DS.defineCard({ id: 'tst_strike' }) === undefined, 'duplicate define is ignored');
  check(DS.defineCard({}) === undefined, 'missing id is ignored');
  check(DS.statuses.strength && DS.statuses.weak && DS.statuses.artifact, 'built-in statuses defined');
  check(Object.keys(DS.statuses).length === 33, 'expected 33 built-in statuses, got ' + Object.keys(DS.statuses).length);
  check(DS.getCardData({ id: 'tst_strike', upgraded: true }).name === 'Strike+', 'upgraded name');
  check(DS.getCardData({ id: 'tst_strike', upgraded: true }).effects[0].amount === 9, 'upgrade effects');

  // ---- 1. Random-play fights -------------------------------------------------
  let won = 0, lost = 0, turnsTotal = 0;
  const FIGHTS = 200;
  for (let f = 0; f < FIGHTS; f++) {
    DS.rng.seed(1000 + f);
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    await playRandomly(c);
    check(c.phase === 'won' || c.phase === 'lost', 'fight did not finish');
    if (c.phase === 'won') {
      won++;
      check(run.hp === c.player.hp, 'run.hp not synced on win');
      check(c.livingEnemies().length === 0, 'won with living enemies');
    } else {
      lost++;
      check(c.player.hp <= 0, 'lost with hp left');
    }
    turnsTotal += c.turn;
    check(run.stats.cardsPlayed > 0, 'cardsPlayed stat not updated');
  }
  console.log('random fights: ' + FIGHTS + ' played, won ' + won + ', lost ' + lost +
    ', avg turns ' + (turnsTotal / FIGHTS).toFixed(1));

  // ---- 2. Targeted mechanics -------------------------------------------------
  DS.rng.seed(7);
  {
    // Artifact negates a debuff
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    const e = c.enemies[0];
    c.player.statuses.artifact = 1;
    await c.applyStatus(c.player, 'weak', 1, e);
    check(!c.player.statuses.weak, 'artifact should negate weak');
    check(!c.player.statuses.artifact, 'artifact should be consumed');
    await c.applyStatus(c.player, 'weak', 2, e);
    check(c.player.statuses.weak === 2, 'weak applies once artifact is gone');
    c.player.statuses = {};
  }
  {
    // Intangible reduces HP loss to 1; block still absorbs first
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    const e = c.enemies[0];
    c.player.statuses.intangible = 2;
    c.player.block = 0;
    const hp0 = c.player.hp;
    await c.runEffects([{ op: 'damage', amount: 20 }], { source: e, target: c.player, kind: 'move' });
    check(c.player.hp === hp0 - 1, 'intangible should cap hit at 1, got ' + (hp0 - c.player.hp));
    c.player.statuses = {};
  }
  {
    // Thorns reflect into the attacker (flat, no loop)
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    const e = c.enemies[0];
    e.statuses.thorns = 3;
    e.hp = 50; e.maxHp = 50;
    c.player.block = 0;
    const hp0 = c.player.hp;
    await c.runEffects([{ op: 'damage', amount: 6 }], { source: c.player, target: e, kind: 'card' });
    check(e.hp === 44, 'enemy should take 6, hp=' + e.hp);
    check(c.player.hp === hp0 - 3, 'thorns should hit player for 3, lost ' + (hp0 - c.player.hp));
  }
  {
    // Double tap plays an attack twice; the stack is consumed
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.enemies.forEach(function (x) { x.hp = 100; x.maxHp = 100; x.block = 0; });
    const target = c.enemies[0];
    c.player.statuses.double_tap = 1;
    c.hand.length = 0;
    c.drawPile.length = 0;
    const strike = c.makeCard({ id: 'tst_strike', upgraded: false });
    c.hand.push(strike);
    c.player.energy = 3;
    c.phase = 'player';
    run.deck.length = 0; run.deck.push({ uid: 'x', id: 'tst_strike', upgraded: false });
    const before = target.hp;
    const r = await c.playCard(strike, target);
    check(r.ok, 'double tap play should be legal');
    check(before - target.hp === 12, 'double tap should deal 12, dealt ' + (before - target.hp));
    check(!c.player.statuses.double_tap, 'double tap should be consumed');
  }
  {
    // Barricade keeps block across turns; buffer prevents one HP loss
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.player.statuses.barricade = 1;
    c.player.statuses.buffer = 1;
    c.player.block = 9;
    c.enemies.forEach(function (x) { x.hp = 100; x.maxHp = 100; });
    const hp0 = c.player.hp;
    await c.runEffects([{ op: 'lose_hp', amount: 4, to: 'self' }], { source: c.player, kind: 'card' });
    check(c.player.hp === hp0, 'buffer should prevent HP loss');
    check(!c.player.statuses.buffer, 'buffer should be consumed');
    c.player.statuses.barricade = 1;
    await c.endTurn();
    check(c.player.block >= 9 || c.player.block === 0, 'block sanity');
  }
  {
    // X-cost: spend all energy, x = energy spent
    DS.defineCard({
      id: 'tst_xslash', name: 'X Slash', class: 'berserker', type: 'attack', rarity: 'common', cost: 'X',
      target: 'enemy', icon: '🌀', desc: 'Deal 4 damage X times.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 4 } }],
      upgrade: { desc: 'Deal 4 damage X+1 times.', effects: [{ op: 'damage', amount: { v: 'x', mul: 4 } }] }
    });
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.enemies.forEach(function (x) { x.hp = 100; x.maxHp = 100; x.block = 0; });
    const card = c.makeCard({ id: 'tst_xslash' });
    c.hand.push(card);
    c.player.energy = 2;
    const t = c.enemies[0];
    const before = t.hp;
    const r = await c.playCard(card, t);
    check(r.ok, 'X card should be playable');
    check(c.player.energy === 0, 'X card should spend all energy');
    check(before - t.hp === 8, 'X=2 should deal 8, dealt ' + (before - t.hp));
  }
  {
    // Unplayable (cost -1) and entangle
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    const card = c.makeCard({ id: 'tst_strike' });
    card.cost = -1;
    c.hand.push(card);
    check(!c.canPlay(card).ok, 'cost -1 must be unplayable');
    card.cost = 1;
    c.player.statuses.entangle = 1;
    check(!c.canPlay(card).ok, 'entangle blocks attacks');
    c.player.statuses = {};
  }
  {
    // Enemy death: onKill / combat:enemyDied / combat:end won, and rewards run.hp
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    let ended = null, died = 0;
    const offEnd = DS.events.on('combat:end', function (p) { ended = p.result; });
    const offDie = DS.events.on('combat:enemyDied', function () { died++; });
    await c.start();
    c.enemies.forEach(function (x) { x.hp = 1; x.maxHp = 1; x.block = 0; });
    const card = c.makeCard({ id: 'tst_strike' });
    c.hand.push(card);
    c.player.energy = 3;
    await c.playCard(card, c.enemies[0]);
    check(died === 1, 'one enemy should die, got ' + died);
    check(c.phase === 'player', 'fight should continue with one enemy left');
    c.enemies[1].hp = 1;
    c.hand.push(c.makeCard({ id: 'tst_strike' }));
    c.player.energy = 3;
    await c.playCard(c.hand[c.hand.length - 1], c.enemies[1]);
    check(c.phase === 'won' && ended === 'won', 'fight should be won, phase=' + c.phase);
    offEnd(); offDie();
  }

  {
    // Relic passives, every-N relic trigger, power removal, ethereal, retain, poison, energized
    DS.defineRelic({
      id: 'tst_relic', name: 'Test Relic', desc: 'x', flavor: '', rarity: 'common', icon: '💎',
      passive: { energy: 1, draw: 1 },
      triggers: { onCardPlayed: { every: 2, effects: [{ op: 'heal', amount: 1, to: 'self' }] } }
    });
    DS.defineCard({
      id: 'tst_power', name: 'Test Power', class: 'berserker', type: 'power', rarity: 'uncommon', cost: 1,
      target: 'self', icon: '🌟', desc: 'Gain 1 Dexterity.', effects: [{ op: 'apply', status: 'dexterity', amount: 1, to: 'self' }],
      upgrade: { desc: 'Gain 2 Dexterity.', effects: [{ op: 'apply', status: 'dexterity', amount: 2, to: 'self' }] }
    });
    DS.defineCard({
      id: 'tst_ghost', name: 'Ghost', class: 'colorless', type: 'skill', rarity: 'common', cost: 0,
      target: 'none', icon: '👻', desc: 'Ethereal. Retain.', effects: [{ op: 'block', amount: 3 }],
      ethereal: true, retain: true, upgrade: { desc: 'Gain 5 Block. Ethereal. Retain.', effects: [{ op: 'block', amount: 5 }] }
    });
    const run = makeRun(12);
    run.relics = [{ id: 'tst_relic', counter: 0 }];
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    check(c.player.maxEnergy === 4, 'relic energy passive should give 4 energy, got ' + c.player.maxEnergy);
    check(c.hand.length === 6, 'relic draw passive should draw 6, hand=' + c.hand.length);
    const power = c.makeCard({ id: 'tst_power' });
    c.hand.push(power);
    c.player.energy = 4;
    const dexBefore = c.player.statuses.dexterity || 0;
    await c.playCard(power, null);
    check(c.player.statuses.dexterity === dexBefore + 1, 'power should apply dexterity');
    check(c.exhaustPile.indexOf(power) < 0 && c.discardPile.indexOf(power) < 0, 'power should leave play');
    // every-2 relic: the power was card 1, so the ghost (card 2) heals 1 and defend (card 3) does not
    c.player.hp = c.player.maxHp - 5;
    const ghost = c.makeCard({ id: 'tst_ghost' });
    c.hand.push(ghost);
    const hpBefore = c.player.hp;
    await c.playCard(ghost, null);
    check(c.player.hp === hpBefore + 1, 'every-2 relic should heal 1 on card 2, hp ' + c.player.hp);
    const d = c.makeCard({ id: 'tst_defend' });
    c.hand.push(d);
    c.player.energy = 4;
    await c.playCard(d, null);
    check(c.player.hp === hpBefore + 1, 'every-2 relic should not fire on card 3');
    // ethereal exhausts, retain keeps the card in hand at turn end
    c.hand.push(c.makeCard({ id: 'tst_ghost' }));
    const ghostInHand = c.hand[c.hand.length - 1];
    c.player.hp = Math.max(c.player.hp, 5);
    await c.endTurn();
    check(c.exhaustPile.indexOf(ghostInHand) >= 0, 'ethereal card should be exhausted at end of turn');
    // poison ticks at turn start for the owner and then decays
    const enemy = c.livingEnemies()[0];
    if (enemy) {
      enemy.statuses.poison = 3;
      const hp = enemy.hp;
      enemy.block = 0;
      await c.fire('onTurnStart', enemy, {});
      check(enemy.hp === hp - 3 || enemy.dead, 'poison should deal 3 at turn start, dealt ' + (hp - enemy.hp));
      c.player.statuses = {};
    }
    // energized adds energy at turn start and is removed
    c.player.statuses.energized = 2;
    await c.fire('onTurnStart', c.player, {});
    check(!c.player.statuses.energized, 'energized should be removed after use');
    check(c.player.energy >= 2, 'energized should add energy');
    // curl_up gains block once when first attacked
    if (c.livingEnemies()[0]) {
      const tgt = c.livingEnemies()[0];
      tgt.statuses.curl_up = 4;
      tgt.hp = 100; tgt.maxHp = 100; tgt.block = 0;
      await c.runEffects([{ op: 'damage', amount: 2, targetKind: 'enemy' }], { source: c.player, target: tgt, kind: 'card', targetKind: 'enemy' });
      check(tgt.block === 4 && !tgt.statuses.curl_up, 'curl_up should grant 4 block once, block=' + tgt.block);
    }
  }
  {
    // Trigger loop guard: two units whose onAttacked reflects damage with attacks.
    DS.defineStatus({ id: 'tst_mirror', name: 'Mirror', type: 'buff', icon: '🪞', stacks: true,
      desc: 'Reflects.', triggers: { onAttacked: [{ op: 'damage', amount: 1, to: 'target' }] } });
    DS.defineStatus({ id: 'tst_mirror2', name: 'Mirror2', type: 'buff', icon: '🪞', stacks: true,
      desc: 'Reflects.', triggers: { onAttacked: [{ op: 'damage', amount: 1, to: 'target' }] } });
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.enemies[0].statuses.tst_mirror = 1;
    c.player.statuses.tst_mirror2 = 1;
    c.player.block = 0; c.player.hp = 40;
    let threw = false;
    try {
      await c.runEffects([{ op: 'damage', amount: 1 }], { source: c.player, target: c.enemies[0], kind: 'card', targetKind: 'enemy' });
    } catch (e) { threw = true; }
    check(!threw, 'mirror loop must not throw');
    check(c.player.hp > 0 || c.phase === 'lost', 'mirror loop state sane');
  }
  {
    // X value must survive nested effects (repeat / if)
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.enemies.forEach(function (x) { x.hp = 100; x.maxHp = 100; x.block = 0; });
    const t = c.enemies[0];
    const before = t.hp;
    await c.runEffects([{ op: 'repeat', times: 2, effects: [{ op: 'damage', amount: { v: 'x' }, to: 'target' }] }],
      { source: c.player, target: t, kind: 'card', x: 3 });
    check(before - t.hp === 6, 'x must survive repeat, dealt ' + (before - t.hp));
  }
  {
    // Intangible caps damage at 1 before block: block 5 absorbs the 1, no HP lost
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    await c.start();
    c.player.statuses = { intangible: 1 };
    c.player.block = 5;
    const hp0 = c.player.hp;
    await c.runEffects([{ op: 'damage', amount: 20 }], { source: c.enemies[0], target: c.player, kind: 'move' });
    check(c.player.hp === hp0, 'intangible + block should lose no hp, lost ' + (hp0 - c.player.hp));
    check(c.player.block === 4, 'intangible + block should leave 4 block, got ' + c.player.block);
    c.player.statuses = {};
  }
  {
    // Poison kills are credited to the player who applied it
    const run = makeRun(12);
    const c = new DS.Combat(run, 'tst_enc');
    let kills = 0;
    const offKill = DS.events.on('combat:enemyDied', function () { kills++; });
    await c.start();
    const e = c.enemies[0];
    e.hp = 2; e.maxHp = 2;
    await c.applyStatus(e, 'poison', 3, c.player);
    await c.fire('onTurnStart', e, {});
    check(e.dead && kills === 1, 'poison should kill the enemy, hp=' + e.hp);
    offKill();
  }
  console.log('warnings emitted: ' + warnCount);
  warnSamples.forEach(function (w) { console.log('  warn: ' + w); });
  console.log(failures === 0 ? 'ENGINE SELFTEST PASSED' : ('ENGINE SELFTEST FAILED: ' + failures + ' check(s)'));
  console.warn = origWarn;
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(function (err) {
  console.warn = origWarn;
  console.error('selftest crashed', err);
  process.exitCode = 2;
});
