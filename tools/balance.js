#!/usr/bin/env node
/*
 * Duskspire balance simulator. No dependencies.
 *
 *   node tools/balance.js [--runs=N] [--char=id] [--asc=N]
 *
 *   --runs=N   complete runs per character (default 30)
 *   --char=id  only this character (berserker, shade, arcanist, warden, tempest, occultist)
 *   --asc=N    ascension level 0..10 for every run (default 0)
 *
 * A heuristic bot plays full three-act runs through the real engine (DS.Combat, DS.Run). Its rules:
 *   combat    lethal check first; block when incoming intent damage exceeds block; powers early; plays by
 *             value per energy (c.preview when present, effect inspection otherwise); focuses the enemy with
 *             the lowest effective HP, weighted by how much damage it threatens; potions in elite and boss
 *             fights or below 40% HP.
 *   rewards   takes a card by rarity plus a class / type synergy score, skips when the deck has more than 30
 *             cards; takes gold, potions and relics.
 *   map       rests below 60% HP; prefers shops when rich, elites when healthy, avoids elites when hurt.
 *   rest      rests below 60% HP, otherwise upgrades the best upgradeable card.
 *   shop      buys relics first, removes a Strike when it can, then the best scoring cards.
 *   events    takes the safest enabled choice (gold, healing and relics good; HP loss, curses and fights bad).
 *
 * Caps so it never hangs: 60 turns and 4 s per fight, 150 rooms and 25 s per run. A run that hits a cap is
 * counted as stalled. Optional v2 APIs are used when present (c.preview, DS.Run.claimReward, closeRoom,
 * bossRelicChoices); missing ones fall back to the older flow.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
function argVal(name, def) {
  const a = ARGS.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
}
const RUNS = Math.max(1, parseInt(argVal('runs', '30'), 10) || 30);
const ONLY_CHAR = argVal('char', '');
const ASC = Math.max(0, Math.min(10, parseInt(argVal('asc', '0'), 10) || 0));
// --trace prints the engine combat log of every fight in each character's first run (for tuning the bot).
const TRACE = ARGS.includes('--trace');

const TURN_CAP = 60;
const FIGHT_MS = 4000;
const PLAYS_CAP = 40;
const ROOM_CAP = 150;
const RUN_MS = 25000;
const WATCHDOG_MS = 20 * 60 * 1000;

// The engine logs warnings through console; they are counted, not printed.
let engineWarnings = 0;
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => { engineWarnings++; };
console.error = () => { engineWarnings++; };
const out = (s) => process.stdout.write((s === undefined ? '' : s) + '\n');

// ---------------------------------------------------------------------------
// Loading (same order as tools/smoke.js; optional files are skipped when missing)
// ---------------------------------------------------------------------------
const LOAD = [
  'src/engine/core.js', 'src/engine/statuses.js', 'src/engine/combat.js', 'src/engine/run.js',
  'src/content/cards_berserker.js', 'src/content/cards_shade.js', 'src/content/cards_arcanist.js',
  'src/content/cards_warden.js', 'src/content/cards_colorless.js', 'src/content/cards_colorless_2.js', 'src/content/relics_a.js',
  'src/content/relics_b.js', 'src/content/potions.js', 'src/content/enemies_act1.js',
  'src/content/enemies_act2.js', 'src/content/enemies_act3.js', 'src/content/events_a.js',
  'src/content/events_b.js', 'src/content/cards_tempest.js', 'src/content/cards_occultist.js',
  'src/content/cards_berserker_2.js', 'src/content/cards_shade_2.js', 'src/content/cards_arcanist_2.js',
  'src/content/cards_warden_2.js', 'src/content/relics_c.js', 'src/content/potions_b.js',
  'src/content/enemies_act1_b.js', 'src/content/enemies_act2_b.js', 'src/content/enemies_act3_b.js',
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
for (const rel of LOAD) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  try {
    vm.runInThisContext(fs.readFileSync(abs, 'utf8'), { filename: abs });
  } catch (e) {
    engineWarnings++;
  }
}
const DS = globalThis.DS;
if (!DS || typeof DS.Combat !== 'function' || !DS.Run) {
  out('FATAL: the engine did not load (DS.Combat / DS.Run missing).');
  process.exitCode = 1;
  throw new Error('engine missing');
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function makeBotRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return {
    next() {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    },
  };
}
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : 'n/a');
const nameOf = (id) => {
  const d = (DS.encounters && DS.encounters[id]) || (DS.enemies && DS.enemies[id]) || (DS.cards && DS.cards[id]) ||
    (DS.relics && DS.relics[id]);
  return d && d.name ? d.name : String(id);
};
const RARITY_RANK = { boss: 4, rare: 3, uncommon: 2, common: 1, shop: 1, event: 1, starter: 0 };
const RARITY_W = { common: 1.0, uncommon: 1.5, rare: 2.2 };
const effHp = (e) => e.hp + e.block;

// ---------------------------------------------------------------------------
// Combat bot
// ---------------------------------------------------------------------------
function cardCost(c, card) {
  if (card.cost === 'X') return Math.max(1, c.player.energy || 0);
  return typeof card.cost === 'number' && card.cost > 0 ? card.cost : 0;
}
function fallbackPreview(card) {
  const eff = (card.data && card.data.effects) || [];
  let dmg = null;
  let times = 1;
  let block = null;
  for (const e of eff) {
    if (e && e.op === 'damage' && typeof e.amount === 'number') {
      dmg = (dmg || 0) + e.amount;
      times = typeof e.times === 'number' ? e.times : 1;
    }
    if (e && e.op === 'block' && typeof e.amount === 'number') block = (block || 0) + e.amount;
  }
  return { damage: dmg, times, block };
}
function previewOf(c, card, target) {
  if (typeof c.preview === 'function') {
    try {
      const p = c.preview(card, target);
      if (p && typeof p === 'object') return p;
    } catch (e) { /* use the fallback */ }
  }
  return fallbackPreview(card);
}
function threatOf(e) {
  return e.intent && typeof e.intent.damage === 'number' ? e.intent.damage * Math.max(1, e.intent.times || 1) : 0;
}
function focusEnemy(c) {
  let best = null;
  let bestV = Infinity;
  for (const e of c.livingEnemies()) {
    const v = effHp(e) - 0.6 * threatOf(e);
    if (v < bestV) {
      bestV = v;
      best = e;
    }
  }
  return best;
}
function incomingDamage(c) {
  return c.livingEnemies().reduce((s, e) => s + threatOf(e), 0);
}
function fightState(c, turn) {
  const enc = c.encounter || {};
  return {
    turn,
    incoming: incomingDamage(c),
    focus: focusEnemy(c),
    hpFrac: c.player.hp / Math.max(1, c.player.maxHp),
    elite: enc.tier === 'elite',
    boss: enc.tier === 'boss',
  };
}

const DEBUFF_VALUE = { weak: 2.2, vulnerable: 2.6, frail: 1.4, poison: 1.2, burn: 1.0, lock_on: 2.4, shackled: 1.0, entangle: 2.0, no_draw: 1.8 };
const BUFF_VALUE = {
  strength: 3, dexterity: 2.4, regen: 1.5, metallicize: 2, plated_armor: 2, thorns: 1.5, ritual: 2.5, energized: 2,
  draw_next: 2, next_turn_block: 1.2, artifact: 1, barricade: 2, double_tap: 1.5, vigor: 1.2, rage: 1.2, buffer: 1.2,
  intangible: 1.8, curl_up: 1,
};
// Non-damage, non-block value of an effect list, in rough "damage points".
function effectValue(effects, ctx) {
  let v = 0;
  for (const e of effects || []) {
    if (!e || typeof e !== 'object') continue;
    const amt = typeof e.amount === 'number' ? e.amount : 4;
    switch (e.op) {
      case 'apply': {
        const isSelf = e.to ? (e.to === 'self' || e.to === 'player') : (ctx.cardTarget === 'self' || ctx.cardTarget === 'none');
        const n = typeof e.amount === 'number' ? e.amount : 1;
        v += isSelf ? (BUFF_VALUE[e.status] || 1) * n : (DEBUFF_VALUE[e.status] || 1) * Math.max(0, n);
        break;
      }
      case 'draw': v += 2 * amt; break;
      case 'energy': v += 2.2 * amt; break;
      case 'heal': v += amt * (ctx.hpFrac < 0.7 ? 1.3 : 0.25); break;
      case 'max_hp': v += 1.5 * amt; break;
      case 'gold': v += 0.05 * amt; break;
      case 'add_card': {
        // Curses and status cards (Wound, Dazed, ...) clog the deck: they are a cost, not a gain.
        const junk = typeof e.card === 'string' && /^(curse_|status_)/.test(e.card);
        v += (junk ? -2.5 : 0.5) * (typeof e.amount === 'number' ? e.amount : 1);
        break;
      }
      case 'upgrade_hand': v += 1.2 * (typeof e.amount === 'number' ? e.amount : 2); break;
      case 'lose_hp': v -= 2.5 * amt; break;
      case 'repeat': v += effectValue(e.effects, ctx) * (typeof e.times === 'number' ? e.times : 1); break;
      default: break;
    }
  }
  return v;
}
// Value of playing a card now, per energy spent. Higher is better; <= 0.05 means "do not play".
function scoreCard(c, card, st) {
  const d = card.data || {};
  const target = d.target === 'enemy' ? st.focus : null;
  const p = previewOf(c, card, target);
  const perHit = typeof p.damage === 'number' ? p.damage : 0;
  const times = typeof p.times === 'number' && p.times > 0 ? p.times : 1;
  let v = 0;
  if (perHit > 0) {
    if (d.target === 'all_enemies') {
      for (const e of c.livingEnemies()) {
        const dmg = perHit * times;
        v += Math.min(dmg, effHp(e)) + (dmg >= effHp(e) ? 3 : 0);
      }
    } else if (target) {
      const dmg = perHit * times;
      v += Math.min(dmg, effHp(target)) + (dmg >= effHp(target) ? 4 : 0);
    } else if (d.target === 'random_enemy') {
      v += perHit * times * 0.7;
    }
  }
  if (typeof p.block === 'number' && p.block > 0) {
    const need = Math.max(0, st.incoming - c.player.block);
    const useful = Math.min(p.block, need);
    // Block is worth more while incoming damage is not covered yet.
    const weight = st.incoming > c.player.block ? 1.4 : 0.3;
    v += useful * weight + (p.block - useful) * 0.2;
  }
  v += effectValue(d.effects, { hpFrac: st.hpFrac, cardTarget: d.target });
  if (d.type === 'power') v += st.turn <= 3 ? 3.5 : 1.8;
  const cost = cardCost(c, card);
  return cost > 0 ? v / cost : v;
}
// The cheapest card that kills the focused enemy comes first; otherwise the best value per energy.
function pickCard(c, playable, st) {
  const focus = st.focus;
  let lethal = null;
  let best = null;
  let bestScore = 0.05;
  for (const card of playable) {
    const d = card.data || {};
    if (d.target === 'enemy' && focus) {
      const p = previewOf(c, card, focus);
      const dmg = (typeof p.damage === 'number' ? p.damage : 0) * (typeof p.times === 'number' ? p.times : 1);
      if (dmg > 0 && dmg >= effHp(focus)) {
        if (!lethal || cardCost(c, card) < cardCost(c, lethal)) lethal = card;
      }
    }
    const s = scoreCard(c, card, st);
    if (s > bestScore) {
      bestScore = s;
      best = card;
    }
  }
  if (lethal) return lethal;
  return best;
}
async function maybeUsePotions(c, st) {
  const run = DS.run;
  if (!run || !Array.isArray(run.potions)) return;
  if (!(st.elite || st.boss || st.hpFrac < 0.4)) return;
  for (let slot = 0; slot < run.potions.length; slot++) {
    const id = run.potions[slot];
    const def = id ? DS.potions[id] : null;
    if (!def) continue;
    let target = null;
    if (def.target === 'enemy') {
      target = focusEnemy(c);
      if (!target) continue;
    }
    await c.usePotion(slot, target);
    if (c.phase !== 'player') break;
  }
}
// Plays one fight to its end (or to a cap). Returns {phase, turns}.
async function playFight(c) {
  const t0 = Date.now();
  let turns = 0;
  while (c.phase === 'player' && turns < TURN_CAP && Date.now() - t0 < FIGHT_MS) {
    turns++;
    await maybeUsePotions(c, fightState(c, turns));
    let plays = 0;
    while (c.phase === 'player' && plays < PLAYS_CAP) {
      const st = fightState(c, turns);
      const playable = c.hand.filter((card) => c.canPlay(card).ok);
      if (!playable.length) break;
      const card = pickCard(c, playable, st);
      if (!card) break;
      const target = card.data.target === 'enemy' ? st.focus : null;
      if (card.data.target === 'enemy' && !target) break;
      const res = await c.playCard(card, target);
      plays++;
      if (!res || res.ok === false) break;
    }
    if (c.phase !== 'player') break;
    await c.endTurn();
  }
  return { phase: c.phase, turns: c.turn || turns };
}

// ---------------------------------------------------------------------------
// Rewards, shops, events, map, rest (the run-level bot)
// ---------------------------------------------------------------------------
function cardScore(run, id, rng) {
  const d = DS.cards[id];
  if (!d) return -Infinity;
  const attacks = run.deck.filter((x) => DS.cards[x.id] && DS.cards[x.id].type === 'attack').length;
  const skills = run.deck.filter((x) => DS.cards[x.id] && DS.cards[x.id].type === 'skill').length;
  let s = RARITY_W[d.rarity] || 1;
  if (d.class === run.character) s += 1;
  else if (d.class === 'colorless') s += 0.3;
  if (d.type === 'attack' && attacks < 6) s += 0.6;
  if (d.type === 'skill' && skills < 5) s += 0.4;
  if (d.type === 'power') s += 0.5;
  if (d.cost === 0) s += 0.2;
  return s + rng.next() * 0.1;
}
// Index of the card to take from a reward, or null to skip it.
function pickRewardCard(choices, run, rng) {
  if (!choices || !choices.length) return null;
  if (run.deck.length > 30) return null;
  let best = null;
  let bestS = -Infinity;
  choices.forEach((ch, i) => {
    const s = cardScore(run, ch.id, rng);
    if (s > bestS) {
      bestS = s;
      best = i;
    }
  });
  return bestS >= 1.6 ? best : null;
}
// Claims one reward line: DS.Run.claimReward when present, otherwise the direct grant.
function claimLine(room, kind, arg) {
  if (typeof DS.Run.claimReward === 'function') return DS.Run.claimReward(kind, arg);
  if (kind === 'gold' && room.gold > 0) return DS.Run.addGold(room.gold) >= 0;
  if (kind === 'potion' && room.potion) return DS.Run.addPotion(room.potion);
  if (kind === 'relic' && room.relic) return DS.Run.addRelic(room.relic);
  if (kind === 'card' && arg !== null && room.cardChoices && room.cardChoices[arg]) {
    const ch = room.cardChoices[arg];
    return !!DS.Run.addCard(ch.id, ch.upgraded);
  }
  return false;
}
// Leaves the current room for the map: DS.Run.closeRoom when present, otherwise the room is cleared.
function closeCurrentRoom() {
  if (typeof DS.Run.closeRoom === 'function') return DS.Run.closeRoom();
  if (DS.run) DS.run.room = null;
  return true;
}
function claimRewardRoom(ctx, room) {
  const run = DS.run;
  const claimed = room.claimed || {};
  if (room.gold > 0 && !claimed.gold) claimLine(room, 'gold');
  if (room.potion && !claimed.potion) claimLine(room, 'potion');
  if (room.relic && !claimed.relic) claimLine(room, 'relic');
  if (!claimed.card) {
    const idx = pickRewardCard(room.cardChoices || [], run, ctx.rng);
    claimLine(room, 'card', idx);
  }
}
function shopVisit(ctx, run) {
  const shop = run.shop;
  if (!shop) return;
  // 1. relics, best rarity first
  const relics = (shop.relics || []).map((it, i) => ({ it, i })).filter((x) => !x.it.sold)
    .sort((a, b) => (RARITY_RANK[DS.relics[b.it.id] && DS.relics[b.it.id].rarity] || 0) - (RARITY_RANK[DS.relics[a.it.id] && DS.relics[a.it.id].rarity] || 0));
  for (const { it, i } of relics) {
    if (it.price <= run.gold) DS.Run.buy('relic', i);
  }
  // 2. remove a Strike, or a Defend when there is no Strike left
  if (!shop.removeUsed && shop.removePrice <= run.gold) {
    const named = (re) => run.deck.find((x) => re.test(x.id) || (DS.cards[x.id] && re.test(DS.cards[x.id].name)));
    const junk = named(/strike/i) || named(/^defend/i);
    if (junk && typeof DS.Run.shopRemove === 'function') DS.Run.shopRemove(junk.uid);
  }
  // 3. up to two cards that score well enough
  let bought = 0;
  const cards = (shop.cards || []).map((it, i) => ({ it, i })).filter((x) => !x.it.sold)
    .sort((a, b) => cardScore(run, b.it.inst.id, ctx.rng) - cardScore(run, a.it.inst.id, ctx.rng));
  for (const { it, i } of cards) {
    if (bought >= 2) break;
    if (it.price > run.gold || run.deck.length > 30) continue;
    if (cardScore(run, it.inst.id, ctx.rng) < 1.8) continue;
    if (DS.Run.buy('card', i)) bought++;
  }
  // 4. potions when comfortably rich
  if (run.gold >= 120) {
    (shop.potions || []).forEach((it, i) => {
      if (!it.sold && it.price <= run.gold) DS.Run.buy('potion', i);
    });
  }
}
function eventScore(effects, run, hpFrac) {
  let s = 0;
  for (const e of effects || []) {
    if (!e || typeof e !== 'object') continue;
    const n = typeof e.amount === 'number' ? e.amount : 5;
    switch (e.op) {
      case 'gold': s += n * 0.12; break;
      case 'heal': s += n * (hpFrac < 0.6 ? 0.8 : 0.2); break;
      case 'lose_hp': s -= n * 1.6 + (hpFrac < 0.35 ? 10 : 0); break;
      case 'max_hp': s += n * 2.5; break;
      case 'add_relic': s += 14; break;
      case 'add_potion': s += 3; break;
      case 'add_card':
        if (typeof e.card === 'string' && (e.card.startsWith('curse_') || e.card.startsWith('status_'))) s -= 8;
        else s += e.card === 'random' ? 0.8 : 2;
        break;
      case 'remove_card': s += 2.5; break;
      case 'upgrade_card': s += 3; break;
      case 'transform_card': s += 1; break;
      case 'fight': s -= hpFrac > 0.8 ? 4 : 12; break;
      case 'chance': s += 0.5 * (eventScore(e.then, run, hpFrac) + eventScore(e.else, run, hpFrac)); break;
      default: break;
    }
  }
  return s;
}
function chooseEventIndex(run, eventId) {
  const def = DS.events_[eventId];
  const info = DS.Run.getEvent(eventId);
  const hpFrac = run.hp / Math.max(1, run.maxHp);
  let best = null;
  let bestS = -Infinity;
  for (const ch of info.choices) {
    if (!ch.enabled) continue;
    const choice = def && def.choices ? def.choices[ch.index] : null;
    const s = eventScore(choice ? choice.effects : [], run, hpFrac);
    if (s > bestS) {
      bestS = s;
      best = ch.index;
    }
  }
  return best;
}
function restStep(run) {
  const hpFrac = run.hp / Math.max(1, run.maxHp);
  if (hpFrac < 0.6 || typeof DS.Run.upgradeCard !== 'function') {
    DS.Run.rest();
    return;
  }
  let pick = null;
  let bestS = -Infinity;
  for (const inst of run.deck) {
    const d = DS.cards[inst.id];
    if (!d || inst.upgraded || !d.upgrade) continue;
    const s = (d.type === 'attack' ? 3 : 2) + (d.cost === 0 ? 0.5 : 0) + (d.type === 'power' ? 1 : 0);
    if (s > bestS) {
      bestS = s;
      pick = inst;
    }
  }
  if (pick) DS.Run.upgradeCard(pick.uid);
  else DS.Run.rest();
}
function chooseNode(nodes, run, rng) {
  const hpFrac = run.hp / Math.max(1, run.maxHp);
  let best = null;
  let bestS = -Infinity;
  for (const n of nodes) {
    let s;
    switch (n.type) {
      case 'rest': s = hpFrac < 0.6 ? 10 + (1 - hpFrac) * 6 : 1.5; break;
      case 'shop': s = run.gold >= 90 ? 6 : 2; break;
      case 'elite': s = hpFrac >= 0.75 ? 5 : hpFrac >= 0.5 ? 1 : -6; break;
      case 'treasure': s = 4; break;
      case 'event': s = 3; break;
      case 'fight': s = 2.5; break;
      case 'boss': s = 1; break;
      default: s = 0;
    }
    s += rng.next() * 0.5;
    if (s > bestS) {
      bestS = s;
      best = n;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Room driver
// ---------------------------------------------------------------------------
async function fightRoom(ctx, room) {
  const run = DS.run;
  const hpBefore = run.hp;
  const act = run.act;
  const c = new DS.Combat(run, room.encounterId, { fromEvent: !!room.fromEvent });
  await c.start();
  const res = await playFight(c);
  const lost = Math.max(0, hpBefore - (DS.run ? DS.run.hp : 0));
  if (TRACE && ctx.index === 0) {
    out(`  [trace] ${room.encounterId} (${res.phase}, ${res.turns} turns, hp ${hpBefore} -> ${DS.run ? DS.run.hp : '?'})`);
    for (const e of (Array.isArray(c.log) ? c.log : [])) out(`      t${e.turn}: ${e.text}`);
  }
  ctx.fights.push({ encId: room.encounterId, tier: room.tier || (c.encounter && c.encounter.tier) || 'normal', act, turns: res.turns, outcome: res.phase, lost });
  if (res.phase === 'won') return 'won';
  if (res.phase === 'lost') {
    ctx.killer = room.encounterId;
    return 'lost';
  }
  ctx.stopReason = `${room.encounterId} did not finish within ${TURN_CAP} turns or ${FIGHT_MS} ms`;
  return 'stalled';
}
async function bossSteps(ctx) {
  const run = DS.run;
  let choices = [];
  if (typeof DS.Run.bossRelicChoices === 'function') choices = DS.Run.bossRelicChoices() || [];
  if (choices.length && typeof DS.Run.claimReward === 'function') {
    const best = choices.slice().sort((a, b) => (RARITY_RANK[DS.relics[b] && DS.relics[b].rarity] || 0) - (RARITY_RANK[DS.relics[a] && DS.relics[a].rarity] || 0))[0];
    DS.Run.claimReward('boss', best);
  }
  const more = DS.Run.nextAct();
  if (!more || (run && run.won)) ctx.finished = true;
}
async function eventStep(ctx, room) {
  const run = DS.run;
  const idx = chooseEventIndex(run, room.eventId);
  if (idx === null) {
    closeCurrentRoom();
    return;
  }
  await DS.Run.chooseEvent(room.eventId, idx);
}
// Resolves the room the run is in until the map (or the end of the run). Returns a status string.
async function resolveRooms(ctx) {
  for (let guard = 0; guard < 40; guard++) {
    const run = DS.run;
    if (!run || run.over) return 'over';
    if (run.won && ctx.finished) return 'finished';
    const room = run.room;
    if (!room) return 'map';
    switch (room.type) {
      case 'combat': {
        const r = await fightRoom(ctx, room);
        if (r !== 'won') return r === 'lost' ? 'lost' : 'stalled';
        break;
      }
      case 'reward':
        claimRewardRoom(ctx, room);
        if (room.tier === 'boss') {
          await bossSteps(ctx);
          if (ctx.finished) return 'finished';
        } else {
          closeCurrentRoom();
        }
        break;
      case 'event':
        await eventStep(ctx, room);
        if (DS.run && DS.run.room && DS.run.room.type === 'event') closeCurrentRoom();
        break;
      case 'shop':
        shopVisit(ctx, run);
        closeCurrentRoom();
        break;
      case 'rest':
        restStep(run);
        closeCurrentRoom();
        break;
      case 'treasure':
        if (typeof DS.Run.claimReward === 'function') {
          DS.Run.claimReward('chest');
        } else {
          if (room.gold) DS.Run.addGold(room.gold);
          if (room.relicId) DS.Run.addRelic(room.relicId);
        }
        closeCurrentRoom();
        break;
      case 'bossrelic':
        await bossSteps(ctx);
        if (ctx.finished) return 'finished';
        break;
      default:
        closeCurrentRoom();
        break;
    }
    if (DS.run && DS.run.room === room && room.type !== 'combat') {
      // A room that would not close (for example a boss step) cannot be left by this bot.
      if (room.type === 'reward' && room.tier === 'boss') continue;
      return 'stuck';
    }
  }
  return 'stuck';
}
// Records which cards and relics the run gained since the last check.
function noteAcquisitions(ctx) {
  const run = DS.run;
  if (!run) return;
  const deck = {};
  for (const x of run.deck) deck[x.id] = (deck[x.id] || 0) + 1;
  for (const id of Object.keys(deck)) {
    const gained = deck[id] - (ctx.lastDeck[id] || 0);
    if (gained > 0) ctx.cardPicks.add(id, ctx.index);
  }
  ctx.lastDeck = deck;
  for (const r of run.relics) {
    if (!ctx.lastRelics.has(r.id)) {
      ctx.lastRelics.add(r.id);
      ctx.relicPicks.add(r.id, ctx.index);
    }
  }
}

async function playRun(char, seed, index) {
  const ctx = {
    char, seed, index, rng: makeBotRng(seed * 31 + 7), fights: [], killer: null, stopReason: null, finished: false,
    cardPicks: new PickMap(), relicPicks: new PickMap(), lastDeck: {}, lastRelics: new Set(), act: 1,
    reached: { 1: true }, cleared: {}, rooms: 0, error: null,
  };
  const t0 = Date.now();
  let stalled = false;
  try {
    DS.Run.start(char, { seed, ascension: ASC });
    if (DS.run) {
      const deck = {};
      for (const x of DS.run.deck) deck[x.id] = (deck[x.id] || 0) + 1;
      ctx.lastDeck = deck;
      for (const r of DS.run.relics) ctx.lastRelics.add(r.id);
    }
    for (;;) {
      if (!DS.run || DS.run.over || DS.run.won) break;
      if (ctx.rooms >= ROOM_CAP || Date.now() - t0 > RUN_MS) {
        stalled = true;
        ctx.stopReason = `run cap reached (${ctx.rooms} rooms)`;
        break;
      }
      const av = DS.Run.availableNodes();
      if (!av || av.length === 0) {
        stalled = true;
        ctx.stopReason = `no reachable room on act ${DS.run.act}`;
        break;
      }
      const node = chooseNode(av, DS.run, ctx.rng);
      DS.Run.enterNode(node.id);
      ctx.rooms++;
      const status = await resolveRooms(ctx);
      noteAcquisitions(ctx);
      if (status === 'lost') break;
      if (status === 'stalled' || status === 'stuck') {
        stalled = true;
        if (!ctx.stopReason) ctx.stopReason = `room could not be resolved (${status})`;
        break;
      }
      if (status === 'finished' || status === 'over') break;
      if (DS.run && DS.run.act !== ctx.act) {
        ctx.cleared[ctx.act] = true;
        ctx.act = DS.run.act;
        ctx.reached[ctx.act] = true;
      }
    }
  } catch (e) {
    ctx.error = e && e.message ? e.message : String(e);
    stalled = true;
  }
  const won = !!(DS.run && DS.run.won);
  if (won) {
    for (const a of [1, 2, 3]) ctx.cleared[a] = true;
  }
  return {
    char, won, stalled: stalled && !won, error: ctx.error, stopReason: ctx.stopReason,
    floor: DS.run ? DS.run.floor : 0, act: DS.run ? DS.run.act : 1,
    killer: won || stalled ? null : ctx.killer,
    fights: ctx.fights, reached: ctx.reached, cleared: ctx.cleared, index,
    cardPicks: ctx.cardPicks, relicPicks: ctx.relicPicks,
  };
}

// id -> Set of run indices
class PickMap extends Map {
  add(id, runIndex) {
    if (!this.has(id)) this.set(id, new Set());
    this.get(id).add(runIndex);
  }
}

// ---------------------------------------------------------------------------
// Aggregation and report
// ---------------------------------------------------------------------------
function summarise(char, results) {
  const N = results.length;
  const wins = results.filter((r) => r.won).length;
  const L = [];
  L.push(`== ${char}   ascension ${ASC}   ${N} runs ==`);
  if (!N) {
    L.push('  no runs');
    return L;
  }
  const stalledN = results.filter((r) => r.stalled).length;
  const errN = results.filter((r) => r.error).length;
  L.push(`  win rate ${pct(wins, N)} (${wins}/${N})   average floor reached ${mean(results.map((r) => r.floor)).toFixed(1)}   stalled ${stalledN}${errN ? `   errors ${errN}` : ''}`);
  const tiers = ['easy', 'normal', 'elite', 'boss'];
  const tierParts = tiers.map((t) => {
    const xs = results.flatMap((r) => r.fights).filter((f) => f.tier === t);
    return xs.length ? `${t} ${mean(xs.map((f) => f.turns)).toFixed(1)} (n=${xs.length})` : `${t} -`;
  });
  L.push(`  average turns per fight: ${tierParts.join(', ')}`);
  const surv = [1, 2, 3].map((a) => {
    const reached = results.filter((r) => r.reached[a]).length;
    const cleared = results.filter((r) => r.cleared[a]).length;
    return `act ${a} ${pct(cleared, reached)} (${cleared}/${reached})`;
  });
  L.push(`  per-act survival: ${surv.join(', ')}`);
  const deaths = {};
  for (const r of results) if (r.killer) deaths[r.killer] = (deaths[r.killer] || 0) + 1;
  const topKill = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 8);
  L.push(`  top killers: ${topKill.length ? topKill.map(([id, n]) => `${nameOf(id)} (${n})`).join(', ') : 'none'}`);

  // HP lost per encounter, per act: average over the fights of that encounter, top 15 by average.
  const byEnc = {};
  for (const r of results) {
    for (const f of r.fights) {
      const k = f.encId;
      if (!byEnc[k]) byEnc[k] = { act: f.act, lost: 0, n: 0 };
      byEnc[k].lost += f.lost;
      byEnc[k].n++;
    }
  }
  for (const a of [1, 2, 3]) {
    const rows = Object.keys(byEnc)
      .filter((k) => byEnc[k].act === a)
      .map((k) => ({ id: k, avg: byEnc[k].lost / byEnc[k].n, n: byEnc[k].n }))
      .sort((x, y) => y.avg - x.avg || (x.id < y.id ? -1 : 1))
      .slice(0, 15);
    L.push(`  most damaging encounters, act ${a} (average HP lost per fight):`);
    if (!rows.length) L.push('      none fought');
    for (const row of rows) {
      L.push(`      ${nameOf(row.id).padEnd(30).slice(0, 30)} ${row.avg.toFixed(1).padStart(5)}   fights ${row.n}   ${row.id}`);
    }
  }
  L.push(...pickBlock('cards', results, N, wins, (r) => r.cardPicks));
  L.push(...pickBlock('relics', results, N, wins, (r) => r.relicPicks));
  return L;
}
function pickBlock(label, results, N, wins, getMap) {
  const seen = new Map();
  for (const r of results) {
    for (const [id, set] of getMap(r)) {
      if (!seen.has(id)) seen.set(id, new Set());
      for (const idx of set) seen.get(id).add(idx);
    }
  }
  const rows = [...seen.entries()].map(([id, set]) => {
    const withN = set.size;
    const withW = [...set].filter((idx) => results[idx] && results[idx].won).length;
    const withoutN = N - withN;
    const withoutW = wins - withW;
    const wr = withN ? withW / withN : null;
    const wrOut = withoutN ? withoutW / withoutN : null;
    return { id, n: withN, wr, delta: wr !== null && wrOut !== null ? wr - wrOut : null };
  }).sort((a, b) => b.n - a.n || (a.id < b.id ? -1 : 1));
  const line = (r) => {
    const delta = r.delta === null ? 'n/a' : `${r.delta >= 0 ? '+' : ''}${Math.round(r.delta * 100)} pts`;
    return `      ${nameOf(r.id).padEnd(28).slice(0, 28)} picked in ${String(r.n).padStart(3)} runs (${pct(r.n, N).padStart(4)})   win rate when picked ${pct(Math.round((r.wr || 0) * 1000), 1000).padStart(4)}   vs others ${delta}`;
  };
  const out2 = [`  most picked ${label}:`];
  if (!rows.length) out2.push('      none');
  for (const r of rows.slice(0, 8)) out2.push(line(r));
  out2.push(`  least picked ${label} (among those picked at least once):`);
  const least = rows.slice().sort((a, b) => a.n - b.n || (a.id < b.id ? -1 : 1)).slice(0, 8);
  if (!least.length) out2.push('      none');
  for (const r of least) out2.push(line(r));
  return out2;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
const WORLD_TIMEOUT = setTimeout(() => {
  out('balance: watchdog reached; partial output above');
  process.exit(0);
}, WATCHDOG_MS);
WORLD_TIMEOUT.unref();

async function main() {
  const started = Date.now();
  const all = ['berserker', 'shade', 'arcanist', 'warden', 'tempest', 'occultist', 'artificer', 'beastcaller', 'revenant'];
  const chars = all.filter((id) => DS.characters && DS.characters[id] && (!ONLY_CHAR || ONLY_CHAR === id));
  const header = [
    '==============================================================',
    ' DUSKSPIRE BALANCE SIMULATOR',
    ` runs per character: ${RUNS}   ascension: ${ASC}   characters: ${chars.join(', ') || 'none'}`,
    ` caps: ${TURN_CAP} turns and ${FIGHT_MS / 1000}s per fight, ${ROOM_CAP} rooms and ${RUN_MS / 1000}s per run`,
    '==============================================================',
  ];
  for (const l of header) out(l);
  if (!chars.length) {
    out(ONLY_CHAR ? `unknown character '${ONLY_CHAR}'` : 'no characters are defined');
    process.exitCode = 1;
    return;
  }
  const totals = { runs: 0, wins: 0, stalled: 0, errors: 0 };
  for (let ci = 0; ci < chars.length; ci++) {
    const char = chars[ci];
    const results = [];
    for (let i = 0; i < RUNS; i++) {
      const seed = 4000 + ci * 104729 + i * 7919;
      results.push(await playRun(char, seed, i));
    }
    totals.runs += results.length;
    totals.wins += results.filter((r) => r.won).length;
    totals.stalled += results.filter((r) => r.stalled).length;
    totals.errors += results.filter((r) => r.error).length;
    out('');
    for (const l of summarise(char, results)) out(l);
  }
  out('');
  out('==============================================================');
  out(` overall: ${totals.wins}/${totals.runs} wins (${pct(totals.wins, totals.runs)}), stalled ${totals.stalled}, errors ${totals.errors}`);
  out(` engine console messages suppressed: ${engineWarnings}   elapsed ${((Date.now() - started) / 1000).toFixed(1)}s`);
  out('==============================================================');
}

main().catch((e) => {
  out(`balance harness failure: ${e && e.message ? e.message : e}`);
  process.exitCode = 1;
});
