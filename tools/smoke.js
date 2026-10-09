#!/usr/bin/env node
/*
 * Duskspire headless smoke validator.
 *
 *   node tools/smoke.js            static validation, bot combats, card/potion sandboxes, simulated runs
 *   node tools/smoke.js --quick    skip the simulated full runs
 *   node tools/smoke.js --only=X   print only the ERRORS and WARNINGS whose text contains X
 *
 * Engine and content files (src/engine, src/content) are loaded into this Node context with
 * vm.runInThisContext, in the contract's load order. src/ui is never loaded. Paths are resolved
 * from this file's location, so the script works from any working directory.
 * Exit code is 1 when any error is recorded.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const util = require('util');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const QUICK = ARGV.includes('--quick');
const ONLY_ARG = ARGV.find((a) => a.startsWith('--only='));
const ONLY = ONLY_ARG ? ONLY_ARG.slice('--only='.length) : '';

const COMBAT_TIMEOUT_MS = 5000;
const MAX_TURNS = 60;
const MAX_PLAYS_PER_TURN = 30;
const FULL_RUN_STEP_CAP = 400;
const FULL_RUN_BONUS_HP = 1000;
const DUMMY_ENEMY = 'smoke_dummy_enemy';
const DUMMY_ENCOUNTER = 'smoke_dummy_encounter';
const HP_PROBE_ENEMY = 'smoke_hp_probe_enemy';
const HP_PROBE_ENCOUNTER = 'smoke_hp_probe_encounter';
const DUMMY_ENERGY = 10;
const TIMEOUT = Symbol('timeout');

// ---------------------------------------------------------------------------
// Contract data. Hard-coded copies of the CONTRACT.md lists (DS.OPS is never relied on).
// ---------------------------------------------------------------------------
const LOAD_ORDER = [
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
  'src/ui/kit.js',
  'src/ui/art.js',
  'src/ui/audio.js',
  'src/ui/fx.js',
  'src/ui/screens.js',
  'src/ui/combat_ui.js',
  'src/ui/boot.js',
];
const HEADLESS_FILES = LOAD_ORDER.filter((f) => !f.startsWith('src/ui/'));

const OPS_COMBAT = [
  'damage', 'lose_hp', 'block', 'apply', 'remove_status', 'multiply_status', 'heal', 'draw', 'energy',
  'discard', 'exhaust', 'add_card', 'upgrade_hand', 'gold', 'max_hp', 'repeat', 'if', 'summon', 'custom',
];
const OPS_RUN = [
  'gold', 'heal', 'lose_hp', 'max_hp', 'add_card', 'remove_card', 'upgrade_card', 'transform_card',
  'add_relic', 'add_potion', 'chance', 'fight', 'custom',
];
const TRIGGERS_COMBAT = [
  'onCombatStart', 'onCombatEnd', 'onTurnStart', 'onTurnEnd', 'onCardPlayed', 'onAttack', 'onAttacked',
  'onDamaged', 'onBlockGained', 'onBlockBroken', 'onCardDrawn', 'onCardExhausted', 'onCardDiscarded',
  'onShuffle', 'onApplyDebuff', 'onKill', 'onEnemyDeath', 'onDeath', 'onHeal', 'onPotionUsed', 'onGoldGained',
];
const TRIGGERS_RUN = ['onPickup', 'onRest', 'onRoomEnter', 'onCardAdded', 'onChestOpen', 'onShopEnter'];
const VALUE_SOURCES = [
  'x', 'stacks', 'block', 'hp', 'max_hp', 'missing_hp', 'status', 'hand', 'draw_pile', 'discard_pile',
  'exhaust_pile', 'deck_size', 'energy', 'turn', 'cards_played', 'attacks_played', 'enemies', 'gold',
];
const TARGETS = ['target', 'self', 'all_enemies', 'random_enemy', 'player'];
const ADD_TO = ['hand', 'draw', 'discard'];
const CMP = ['>', '>=', '<', '<=', '==', '!='];
const CARD_CLASSES = ['berserker', 'shade', 'arcanist', 'warden', 'tempest', 'occultist', 'artificer', 'beastcaller', 'revenant', 'colorless', 'curse', 'status'];
const CARD_TYPES = ['attack', 'skill', 'power', 'curse', 'status'];
const CARD_RARITIES = ['starter', 'common', 'uncommon', 'rare', 'special'];
const CARD_TARGETS = ['enemy', 'all_enemies', 'random_enemy', 'self', 'none'];
const RELIC_RARITIES = ['starter', 'common', 'uncommon', 'rare', 'boss', 'shop', 'event'];
const RELIC_PASSIVE_KEYS = ['energy', 'draw', 'potionSlots'];
const POTION_RARITIES = ['common', 'uncommon', 'rare'];
const POTION_TARGETS = ['enemy', 'all_enemies', 'self', 'none'];
const ENEMY_TIERS = ['normal', 'elite', 'boss', 'minion'];
const ENCOUNTER_TIERS = ['easy', 'normal', 'elite', 'boss'];
const INTENTS = ['attack', 'defend', 'buff', 'debuff', 'attack_debuff', 'attack_defend', 'attack_buff', 'special', 'sleep', 'unknown'];
const ATTACK_INTENTS = ['attack', 'attack_debuff', 'attack_defend', 'attack_buff'];
const STATUS_TYPES = ['buff', 'debuff'];
const DECAY_VALUES = ['turn_end', 'turn_start'];
const STATUS_MODS = ['attackDealtAdd', 'attackDealtMul', 'attackTakenAdd', 'attackTakenMul', 'blockAdd', 'blockMul'];
const WHEN_KEYS = ['cardType', 'turn', 'hpBelowPct', 'hpAbovePct', 'costAtLeast', 'roomType', 'fromAttack'];
const WHEN_NUMERIC = ['turn', 'hpBelowPct', 'hpAbovePct', 'costAtLeast'];
const ROOM_TYPES = ['fight', 'elite', 'boss', 'rest', 'shop', 'event', 'treasure'];
const COND_KEYS = ['minGold', 'minHp', 'hasRelic', 'hasCardType'];
// Six characters in v2. tempest and occultist are expected only once their card files exist.
const CHARACTER_FILES = {
  berserker: 'cards_berserker.js', shade: 'cards_shade.js', arcanist: 'cards_arcanist.js', warden: 'cards_warden.js',
  tempest: 'cards_tempest.js', occultist: 'cards_occultist.js',
  artificer: 'cards_artificer.js', beastcaller: 'cards_beastcaller.js', revenant: 'cards_revenant.js',
};
const CHARACTERS = Object.keys(CHARACTER_FILES).filter((id) => fs.existsSync(path.join(ROOT, 'src/content', CHARACTER_FILES[id])));
const CHARACTER_STARTER_SIZE = 11;
const BUILTIN_STATUSES = [
  'strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'burn', 'regen', 'thorns',
  'plated_armor', 'metallicize', 'artifact', 'intangible', 'barricade', 'ritual', 'energized', 'draw_next',
  'next_turn_block', 'strength_down', 'dexterity_down', 'no_draw', 'entangle', 'buffer', 'rage', 'double_tap',
  'vigor', 'lock_on', 'shackled', 'mark', 'curl_up', 'enrage', 'angry', 'split_ready',
];
const CURSE_IDS = [
  'curse_regret', 'curse_pain', 'curse_doubt', 'curse_injury', 'curse_decay',
  'curse_clumsy', 'curse_parasite', 'curse_writhe', 'curse_shame', 'curse_normality',
];
const STATUS_CARD_IDS = ['status_wound', 'status_dazed', 'status_burn', 'status_slimed', 'status_void'];
const CLASS_PREFIX = {
  berserker: 'bz_', shade: 'sh_', arcanist: 'ar_', warden: 'wd_', tempest: 'tp_', occultist: 'oc_', artificer: 'af_', beastcaller: 'bc_', revenant: 'rv_',
  colorless: 'cl_', curse: 'curse_', status: 'status_',
};
// Id prefixes allowed per content file (statuses.js is exempt: built-ins have no prefix).
const FILE_PREFIX = {
  'cards_berserker.js': ['bz_'],
  'cards_shade.js': ['sh_'],
  'cards_arcanist.js': ['ar_'],
  'cards_warden.js': ['wd_'],
  'cards_colorless.js': ['cl_', 'curse_', 'status_'],
  'cards_colorless_2.js': ['cl_', 'curse_', 'status_'],
  'cards_tempest.js': ['tp_'],
  'cards_occultist.js': ['oc_'],
  'relics_a.js': ['ra_'],
  'relics_b.js': ['rb_'],
  'relics_c.js': ['rc_'],
  'potions.js': ['po_'],
  'potions_b.js': ['pb_'],
  'enemies_act1.js': ['a1_'],
  'enemies_act2.js': ['a2_'],
  'enemies_act3.js': ['a3_'],
  'enemies_act1_b.js': ['a1_'],
  'enemies_act2_b.js': ['a2_'],
  'enemies_act3_b.js': ['a3_'],
  'events_a.js': ['ea_'],
  'events_b.js': ['eb_'],
  'events_c.js': ['ec_'],
  'cards_artificer.js': ['af_'],
  'cards_beastcaller.js': ['bc_'],
  'cards_revenant.js': ['rv_'],
  'cards_berserker_3.js': ['bz_'],
  'cards_warden_3.js': ['wd_'],
  'cards_colorless_3.js': ['cl_', 'curse_', 'status_'],
  'potions_c.js': ['pc_'],
  'enemies_act3_c.js': ['a3_'],
  'trials.js': ['mu_'],
};
// Reuse rule: a *_2.js / *_b.js file without an entry of its own reuses the prefixes of its base file
// (cards_berserker_2.js -> cards_berserker.js -> bz_). Its ids must still not collide (checked as duplicates).
function allowedPrefixes(base) {
  if (FILE_PREFIX[base]) return FILE_PREFIX[base];
  const m = /^(.*)_(2|b)\.js$/.exec(base);
  if (m && FILE_PREFIX[`${m[1]}.js`]) return FILE_PREFIX[`${m[1]}.js`];
  return null;
}
// Run-level encounter placeholders accepted by the 'fight' op (v2).
const RANDOM_ENCOUNTERS = ['random_normal', 'random_elite'];
const REG_NAME = {
  Card: 'cards', Relic: 'relics', Potion: 'potions', Enemy: 'enemies',
  Encounter: 'encounters', Event: 'events_', Status: 'statuses', Character: 'characters',
};
const ID_RE = /^[a-z][a-z0-9_]*$/;
const HEX_RE = /^#[0-9a-f]{3,8}$/i;

// ---------------------------------------------------------------------------
// Reporting state. Errors and warnings are de-duplicated by (category, file, message).
// ---------------------------------------------------------------------------
const errors = new Map();
const warnings = new Map();
const consoleWarns = new Map();
const consoleErrs = new Map();

function bump(map, key, init) {
  const hit = map.get(key);
  if (hit) hit.count++;
  else map.set(key, Object.assign({ count: 1 }, init));
}
function addErr(cat, file, msg) {
  bump(errors, `${cat}\u0001${file}\u0001${msg}`, { cat, file, msg });
}
function addWarn(cat, file, msg) {
  bump(warnings, `${cat}\u0001${file}\u0001${msg}`, { cat, file, msg });
}
function bumpPlain(map, msg) {
  map.set(msg, (map.get(msg) || 0) + 1);
}
function clip(s) {
  s = String(s).replace(/\s+/g, ' ');
  return s.length > 240 ? s.slice(0, 237) + '...' : s;
}
function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}
function norm(s) {
  return String(s).replace(/\\/g, '/');
}
function describeErr(e) {
  if (e === null || e === undefined) return String(e);
  const msg = e && e.message ? e.message : String(e);
  const rootN = norm(ROOT) + '/';
  const frame = String((e && e.stack) || '')
    .split('\n')
    .slice(1)
    .map((l) => norm(l).trim())
    .find((l) => l.includes(rootN + 'src/'));
  if (!frame) return msg;
  return `${msg} [${frame.replace(rootN, '').replace(/^at /, '').replace(/\)$/, '')}]`;
}
function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function pickR(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function yieldMacro() {
  return new Promise((resolve) => setImmediate(resolve));
}
function pct(won, n) {
  return n ? `${Math.round((100 * won) / n)}%` : 'n/a';
}

// ---------------------------------------------------------------------------
// Loading. define* calls are wrapped so every submitted definition is recorded with its file.
// ---------------------------------------------------------------------------
const submitted = []; // {kind, def, file}
const loadedFiles = [];
let currentFile = '';

function reg(kind) {
  const DS = globalThis.DS;
  return (DS && DS[REG_NAME[kind]]) || {};
}

function installDefineWrappers() {
  const DS = globalThis.DS;
  if (!DS) return;
  for (const kind of Object.keys(REG_NAME)) {
    const fname = 'define' + kind;
    const orig = DS[fname];
    if (typeof orig !== 'function' || orig.__smokeWrapped) continue;
    const wrapped = function (def) {
      submitted.push({ kind, def, file: currentFile });
      return orig.apply(this, arguments);
    };
    wrapped.__smokeWrapped = true;
    DS[fname] = wrapped;
  }
}

function loadHeadlessFiles() {
  for (const rel of HEADLESS_FILES) {
    currentFile = rel;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      addErr('load', rel, 'file missing');
      continue;
    }
    try {
      vm.runInThisContext(fs.readFileSync(abs, 'utf8'), { filename: abs });
      loadedFiles.push(rel);
    } catch (e) {
      addErr('load', rel, `throws on load: ${describeErr(e)}`);
    }
    installDefineWrappers();
  }
  currentFile = '';
}

// Known-id sets, rebuilt after loading (dummy content is added later and is not included).
const KNOWN = {
  cards: new Set(), relics: new Set(), potions: new Set(), enemies: new Set(),
  encounters: new Set(), statuses: new Set(), events: new Set(),
};
function refreshKnown() {
  KNOWN.cards = new Set(Object.keys(reg('Card')));
  KNOWN.relics = new Set(Object.keys(reg('Relic')));
  KNOWN.potions = new Set(Object.keys(reg('Potion')));
  KNOWN.enemies = new Set(Object.keys(reg('Enemy')));
  KNOWN.encounters = new Set(Object.keys(reg('Encounter')));
  KNOWN.events = new Set(Object.keys(reg('Event')));
  KNOWN.statuses = new Set([...BUILTIN_STATUSES, ...Object.keys(reg('Status'))]);
}

// Trigger name -> context ('combat' or 'run').
const TRIGGER_CTX = {};
for (const n of TRIGGERS_COMBAT) TRIGGER_CTX[n] = 'combat';
for (const n of TRIGGERS_RUN) TRIGGER_CTX[n] = 'run';

// ---------------------------------------------------------------------------
// Static validation helpers. Each sink prefixes messages with the definition id.
// ---------------------------------------------------------------------------
function sinkFor(file, id) {
  const tag = id ? `${id}: ` : '';
  return {
    e: (msg) => addErr('static', file, `${tag}${msg}`),
    w: (msg) => addWarn('static', file, `${tag}${msg}`),
    allowSummon: false,
  };
}
function reqStrings(def, fields, S) {
  for (const f of fields) {
    if (typeof def[f] !== 'string' || def[f].trim() === '') S.e(`missing or empty string field '${f}'`);
  }
}
function checkIdFormat(def, S) {
  if (typeof def.id !== 'string' || !ID_RE.test(def.id)) S.e('id must be lowercase snake_case');
}
function checkPrefixes(def, file, S, classPrefix) {
  if (typeof def.id !== 'string') return;
  const base = path.basename(file);
  const allowed = allowedPrefixes(base);
  if (allowed && !allowed.some((p) => def.id.startsWith(p))) {
    S.e(`id prefix does not match ${base} (expected ${allowed.join(' or ')})`);
  }
  if (classPrefix && !def.id.startsWith(classPrefix)) {
    S.e(`id should start with '${classPrefix}' for this class`);
  }
}
function validCost(c) {
  return c === 'X' || (typeof c === 'number' && Number.isInteger(c) && c >= -1);
}
function checkValue(v, where, S) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) S.e(`${where}: non-finite number`);
    return;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    S.e(`${where}: must be a number or a Value object`);
    return;
  }
  if (!VALUE_SOURCES.includes(v.v)) S.e(`${where}: unknown Value source '${v.v}'`);
  if (v.v === 'status' && v.status === undefined) S.e(`${where}: Value source 'status' needs a status id`);
  if (v.status !== undefined && !KNOWN.statuses.has(v.status)) S.e(`${where}: unknown status '${v.status}' in Value`);
  if (v.of !== undefined && v.of !== 'self' && v.of !== 'target') S.e(`${where}: Value.of must be self or target`);
  if (v.mul !== undefined && typeof v.mul !== 'number') S.e(`${where}: Value.mul must be a number`);
  if (v.add !== undefined && typeof v.add !== 'number') S.e(`${where}: Value.add must be a number`);
}
function checkAmount(val, where, S, allowAll) {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) S.e(`${where}: non-finite number`);
    return;
  }
  if (typeof val === 'string') {
    if (allowAll && val === 'all') return;
    S.e(`${where}: invalid string '${val}'`);
    return;
  }
  if (val && typeof val === 'object') {
    checkValue(val, where, S);
    return;
  }
  S.e(`${where}: must be a number or Value object`);
}
function needAmount(eff, w, S, allowAll) {
  if (eff.amount === undefined) S.e(`${w}: missing amount`);
  else checkAmount(eff.amount, `${w}.amount`, S, allowAll);
}
function needStatus(eff, w, S) {
  if (eff.status === undefined) S.e(`${w}: missing status`);
  else if (!KNOWN.statuses.has(eff.status)) S.e(`${w}: unknown status '${eff.status}'`);
}
function checkTo(eff, w, S) {
  if (eff.to !== undefined && !TARGETS.includes(eff.to)) S.e(`${w}: unknown target 'to: ${eff.to}'`);
}
function checkCond(cond, where, S) {
  if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
    S.e(`${where}: cond must be {left, cmp, right}`);
    return;
  }
  if (!CMP.includes(cond.cmp)) S.e(`${where}: bad cmp '${cond.cmp}'`);
  if (cond.left === undefined) S.e(`${where}: cond missing left`);
  else checkValue(cond.left, `${where}.left`, S);
  if (cond.right === undefined) S.e(`${where}: cond missing right`);
  else checkValue(cond.right, `${where}.right`, S);
}
function checkEventCond(cond, where, S) {
  if (!cond || typeof cond !== 'object' || Array.isArray(cond)) {
    S.e(`${where}: cond must be an object`);
    return;
  }
  for (const k of Object.keys(cond)) {
    if (!COND_KEYS.includes(k)) S.e(`${where}: unknown cond key '${k}'`);
  }
  if (cond.minGold !== undefined && typeof cond.minGold !== 'number') S.e(`${where}: minGold must be a number`);
  if (cond.minHp !== undefined && typeof cond.minHp !== 'number') S.e(`${where}: minHp must be a number`);
  if (cond.hasRelic !== undefined && !KNOWN.relics.has(cond.hasRelic)) S.e(`${where}: unknown relic '${cond.hasRelic}'`);
  if (cond.hasCardType !== undefined && !CARD_TYPES.includes(cond.hasCardType)) {
    S.e(`${where}: unknown card type '${cond.hasCardType}'`);
  }
}

// Effects: ctx is 'combat' or 'run'. Walks nested lists (effects, onKill, then, else) recursively.
function checkEffects(list, ctx, where, S) {
  if (!Array.isArray(list)) {
    S.e(`${where}: must be an array of effects`);
    return;
  }
  list.forEach((eff, i) => checkEffect(eff, ctx, `${where}[${i}]`, S));
}
function checkAddCard(eff, w, S) {
  if (eff.card === undefined) S.e(`${w}: missing card`);
  else if (eff.card !== 'random' && !KNOWN.cards.has(eff.card)) S.e(`${w}: unknown card '${eff.card}'`);
  if (eff.to !== undefined && !ADD_TO.includes(eff.to)) S.e(`${w}: add_card 'to' must be hand, draw or discard`);
  if (eff.amount !== undefined) checkAmount(eff.amount, `${w}.amount`, S, false);
  if (eff.class !== undefined && !CARD_CLASSES.includes(eff.class)) S.e(`${w}: unknown class '${eff.class}'`);
  if (eff.rarity !== undefined && !CARD_RARITIES.includes(eff.rarity)) S.e(`${w}: unknown rarity '${eff.rarity}'`);
  if (eff.type !== undefined && !CARD_TYPES.includes(eff.type)) S.e(`${w}: unknown card type '${eff.type}'`);
}
function checkEffect(eff, ctx, where, S) {
  if (!eff || typeof eff !== 'object' || Array.isArray(eff)) {
    S.e(`${where}: effect must be an object`);
    return;
  }
  const op = eff.op;
  if (typeof op !== 'string') {
    S.e(`${where}: missing op`);
    return;
  }
  const known = OPS_COMBAT.includes(op) || OPS_RUN.includes(op);
  if (!known) {
    S.e(`${where}: unknown op '${op}'`);
    return;
  }
  const allowed = ctx === 'run' ? OPS_RUN : OPS_COMBAT;
  if (!allowed.includes(op)) {
    S.e(`${where}: op '${op}' is not valid in a ${ctx} context`);
    return;
  }
  const w = `${where}(${op})`;
  switch (op) {
    case 'damage':
      needAmount(eff, w, S, false);
      if (eff.times !== undefined) checkAmount(eff.times, `${w}.times`, S, false);
      checkTo(eff, w, S);
      break;
    case 'lose_hp':
    case 'block':
    case 'heal':
      needAmount(eff, w, S, false);
      checkTo(eff, w, S);
      break;
    case 'draw':
    case 'energy':
    case 'gold':
    case 'max_hp':
      needAmount(eff, w, S, false);
      break;
    case 'apply':
      needStatus(eff, w, S);
      needAmount(eff, w, S, false);
      checkTo(eff, w, S);
      break;
    case 'remove_status':
      needStatus(eff, w, S);
      checkTo(eff, w, S);
      break;
    case 'multiply_status':
      needStatus(eff, w, S);
      if (eff.factor === undefined) S.e(`${w}: missing factor`);
      else checkAmount(eff.factor, `${w}.factor`, S, false);
      checkTo(eff, w, S);
      break;
    case 'discard':
      needAmount(eff, w, S, true);
      break;
    case 'exhaust':
      needAmount(eff, w, S, true);
      if (eff.from !== undefined && !ADD_TO.includes(eff.from) && eff.from !== 'hand') {
        S.e(`${w}: exhaust 'from' must be hand, draw or discard`);
      }
      break;
    case 'upgrade_hand':
      needAmount(eff, w, S, true);
      break;
    case 'add_card':
      checkAddCard(eff, w, S);
      break;
    case 'summon':
      if (!S.allowSummon) S.e(`${w}: summon is only valid in enemy moves`);
      if (!KNOWN.enemies.has(eff.enemy)) S.e(`${w}: unknown enemy '${eff.enemy}'`);
      if (eff.amount !== undefined) checkAmount(eff.amount, `${w}.amount`, S, false);
      break;
    case 'repeat':
      if (eff.times === undefined) S.e(`${w}: missing times`);
      else checkAmount(eff.times, `${w}.times`, S, false);
      break;
    case 'if':
      if (eff.cond === undefined) S.e(`${w}: missing cond`);
      else checkCond(eff.cond, `${w}.cond`, S);
      break;
    case 'custom':
      if (typeof eff.fn !== 'function') S.e(`${w}: custom needs an fn function`);
      break;
    case 'remove_card':
    case 'upgrade_card':
    case 'transform_card':
      if (eff.amount !== undefined) checkAmount(eff.amount, `${w}.amount`, S, op === 'upgrade_card');
      if (eff.type !== undefined && !CARD_TYPES.includes(eff.type)) S.e(`${w}: unknown card type '${eff.type}'`);
      break;
    case 'add_relic':
      if (eff.relic === undefined) S.e(`${w}: missing relic`);
      else if (eff.relic !== 'random' && !KNOWN.relics.has(eff.relic)) S.e(`${w}: unknown relic '${eff.relic}'`);
      if (eff.rarity !== undefined && !RELIC_RARITIES.includes(eff.rarity)) S.e(`${w}: unknown relic rarity '${eff.rarity}'`);
      break;
    case 'add_potion':
      if (eff.potion === undefined) S.e(`${w}: missing potion`);
      else if (eff.potion !== 'random' && !KNOWN.potions.has(eff.potion)) S.e(`${w}: unknown potion '${eff.potion}'`);
      break;
    case 'chance':
      if (typeof eff.p !== 'number' || eff.p < 0 || eff.p > 1) S.e(`${w}: p must be a number from 0 to 1`);
      break;
    case 'fight':
      if (!KNOWN.encounters.has(eff.encounter) && !RANDOM_ENCOUNTERS.includes(eff.encounter)) {
        S.e(`${w}: unknown encounter '${eff.encounter}' (or random_normal / random_elite)`);
      }
      break;
    default:
      break;
  }
  for (const key of ['effects', 'onKill', 'then', 'else']) {
    if (eff[key] !== undefined) checkEffects(eff[key], ctx, `${w}.${key}`, S);
  }
}

// Triggers: effects list or {when, every, oncePerTurn, oncePerCombat, effects}.
function checkWhen(when, where, S) {
  if (!when || typeof when !== 'object' || Array.isArray(when)) {
    S.e(`${where}: when must be an object`);
    return;
  }
  for (const k of Object.keys(when)) {
    if (!WHEN_KEYS.includes(k)) S.e(`${where}: unknown when key '${k}'`);
  }
  if (when.cardType !== undefined && !CARD_TYPES.includes(when.cardType)) S.e(`${where}: unknown cardType '${when.cardType}'`);
  if (when.roomType !== undefined && !ROOM_TYPES.includes(when.roomType)) S.e(`${where}: unknown roomType '${when.roomType}'`);
  if (when.fromAttack !== undefined && typeof when.fromAttack !== 'boolean') S.e(`${where}: fromAttack must be a boolean`);
  for (const k of WHEN_NUMERIC) {
    if (when[k] !== undefined && typeof when[k] !== 'number') S.e(`${where}: ${k} must be a number`);
  }
}
function checkTriggerBody(val, ctx, where, S) {
  if (Array.isArray(val)) {
    checkEffects(val, ctx, where, S);
    return;
  }
  if (val && typeof val === 'object') {
    for (const k of Object.keys(val)) {
      if (!['when', 'every', 'oncePerTurn', 'oncePerCombat', 'effects'].includes(k)) {
        S.w(`${where}: unknown trigger key '${k}'`);
      }
    }
    if (val.when !== undefined) checkWhen(val.when, `${where}.when`, S);
    if (val.every !== undefined && !(Number.isInteger(val.every) && val.every >= 1)) {
      S.e(`${where}.every must be an integer >= 1`);
    }
    for (const k of ['oncePerTurn', 'oncePerCombat']) {
      if (val[k] !== undefined && typeof val[k] !== 'boolean') S.e(`${where}.${k} must be a boolean`);
    }
    if (!Array.isArray(val.effects)) {
      S.e(`${where}: {when, effects} form needs an effects array`);
      return;
    }
    checkEffects(val.effects, ctx, `${where}.effects`, S);
    return;
  }
  S.e(`${where}: trigger must be an effects array or {when, effects}`);
}
function checkTriggers(triggers, allowRun, S) {
  if (triggers === undefined) return;
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) {
    S.e('triggers must be an object');
    return;
  }
  for (const name of Object.keys(triggers)) {
    const ctx = hasOwn(TRIGGER_CTX, name) ? TRIGGER_CTX[name] : null;
    if (!ctx) {
      S.e(`unknown trigger '${name}'`);
      continue;
    }
    if (ctx === 'run' && !allowRun) {
      S.e(`trigger '${name}' is run-level and only valid on relics`);
      continue;
    }
    checkTriggerBody(triggers[name], ctx, `triggers.${name}`, S);
  }
}

// ---- per-kind checkers ----
function checkCard(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'icon', 'desc'], S);
  if (!CARD_CLASSES.includes(def.class)) S.e(`bad class '${def.class}'`);
  if (!CARD_TYPES.includes(def.type)) S.e(`bad type '${def.type}'`);
  if (!CARD_RARITIES.includes(def.rarity)) S.e(`bad rarity '${def.rarity}'`);
  if (!CARD_TARGETS.includes(def.target)) S.e(`bad target '${def.target}'`);
  if (!validCost(def.cost)) S.e(`bad cost '${def.cost}' (number, 'X' or -1)`);
  if (def.desc === '') S.w('empty desc');
  checkPrefixes(def, file, S, CLASS_PREFIX[def.class]);
  if (!Array.isArray(def.effects)) S.e('effects must be an array');
  else checkEffects(def.effects, 'combat', 'effects', S);
  const curseOrStatus = ['curse', 'status'].includes(def.class) || ['curse', 'status'].includes(def.type);
  if (!curseOrStatus && !def.upgrade) S.e('non-curse/status card has no upgrade');
  if (def.upgrade !== undefined) {
    if (!def.upgrade || typeof def.upgrade !== 'object' || Array.isArray(def.upgrade)) {
      S.e('upgrade must be an object');
    } else {
      if (def.upgrade.effects !== undefined) checkEffects(def.upgrade.effects, 'combat', 'upgrade.effects', S);
      if (def.upgrade.cost !== undefined && !validCost(def.upgrade.cost)) S.e(`bad upgrade cost '${def.upgrade.cost}'`);
      if (def.upgrade.target !== undefined && !CARD_TARGETS.includes(def.upgrade.target)) S.e('bad upgrade target');
    }
  }
  for (const hook of ['onDraw', 'onEndTurnInHand', 'onExhaust', 'onDiscard']) {
    if (def[hook] !== undefined) checkEffects(def[hook], 'combat', hook, S);
  }
  if (def.playableIf !== undefined) checkCond(def.playableIf, 'playableIf', S);
  for (const k of ['exhaust', 'ethereal', 'innate', 'retain']) {
    if (def[k] !== undefined && typeof def[k] !== 'boolean') S.e(`keyword '${k}' must be a boolean`);
  }
}
function checkRelic(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'desc', 'icon'], S);
  if (!RELIC_RARITIES.includes(def.rarity)) S.e(`bad rarity '${def.rarity}'`);
  if (def.class !== undefined && !CHARACTERS.includes(def.class)) S.e(`unknown class '${def.class}'`);
  if (def.flavor !== undefined && typeof def.flavor !== 'string') S.e('flavor must be a string');
  checkPrefixes(def, file, S, null);
  if (def.passive !== undefined) {
    if (!def.passive || typeof def.passive !== 'object') {
      S.e('passive must be an object');
    } else {
      for (const k of Object.keys(def.passive)) {
        if (!RELIC_PASSIVE_KEYS.includes(k)) S.e(`unknown passive key '${k}'`);
        else if (typeof def.passive[k] !== 'number') S.e(`passive.${k} must be a number`);
      }
    }
  }
  checkTriggers(def.triggers, true, S);
  if (def.passive === undefined && (def.triggers === undefined || Object.keys(def.triggers).length === 0)) {
    S.w('relic has no passive and no triggers');
  }
}
function checkPotion(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'desc', 'icon'], S);
  if (!POTION_RARITIES.includes(def.rarity)) S.e(`bad rarity '${def.rarity}'`);
  if (!POTION_TARGETS.includes(def.target)) S.e(`bad target '${def.target}'`);
  if (typeof def.color !== 'string' || !HEX_RE.test(def.color)) S.e(`color must be a hex string, got '${def.color}'`);
  checkPrefixes(def, file, S, null);
  if (!Array.isArray(def.effects)) S.e('effects must be an array');
  else checkEffects(def.effects, 'combat', 'effects', S);
}
function checkEnemy(def, file) {
  const S = sinkFor(file, def.id);
  S.allowSummon = true;
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'icon'], S);
  if (![1, 2, 3].includes(def.act)) S.e(`act must be 1, 2 or 3, got '${def.act}'`);
  else if (typeof def.id === 'string' && !def.id.startsWith(`a${def.act}_`)) S.e(`id prefix does not match act ${def.act}`);
  if (!ENEMY_TIERS.includes(def.tier)) S.e(`bad tier '${def.tier}'`);
  checkPrefixes(def, file, S, null);
  if (!Array.isArray(def.hp) || def.hp.length !== 2 || typeof def.hp[0] !== 'number' || typeof def.hp[1] !== 'number') {
    S.e('hp must be a [min, max] pair of numbers');
  } else if (def.hp[0] < 1 || def.hp[0] > def.hp[1]) {
    S.e(`hp range [${def.hp[0]}, ${def.hp[1]}] is invalid`);
  }
  if (def.scale !== undefined && (typeof def.scale !== 'number' || def.scale < 0.7 || def.scale > 2)) {
    S.e(`scale must be a number from 0.7 to 2, got '${def.scale}'`);
  }
  if (def.onSpawn !== undefined) checkEffects(def.onSpawn, 'combat', 'onSpawn', S);
  checkTriggers(def.triggers, false, S);
  const moves = def.moves;
  if (!moves || typeof moves !== 'object' || Object.keys(moves).length === 0) {
    S.e('enemy has no moves');
  } else {
    for (const [mid, mv] of Object.entries(moves)) {
      if (!mv || typeof mv !== 'object') {
        S.e(`move '${mid}' is not an object`);
        continue;
      }
      if (typeof mv.name !== 'string' || !mv.name) S.e(`move '${mid}' has no name`);
      if (!INTENTS.includes(mv.intent)) S.e(`move '${mid}' has bad intent '${mv.intent}'`);
      if (!Array.isArray(mv.effects)) S.e(`move '${mid}' effects must be an array`);
      else {
        checkEffects(mv.effects, 'combat', `moves.${mid}.effects`, S);
        if (ATTACK_INTENTS.includes(mv.intent) && !mv.effects.some((e) => e && e.op === 'damage')) {
          S.w(`move '${mid}' has an attack intent but no top-level damage effect`);
        }
      }
    }
  }
  const p = def.pattern;
  if (p !== undefined) {
    if (!p || typeof p !== 'object') {
      S.e('pattern must be an object');
    } else if (p.type === 'sequence') {
      if (!Array.isArray(p.moves) || p.moves.length === 0) S.e('sequence pattern needs a non-empty moves array');
      else {
        for (const m of p.moves) if (!hasOwn(moves, m)) S.e(`pattern references missing move '${m}'`);
      }
    } else if (p.type === 'random') {
      if (!p.weights || typeof p.weights !== 'object') S.e('random pattern needs weights');
      else {
        for (const [m, wgt] of Object.entries(p.weights)) {
          if (!hasOwn(moves, m)) S.e(`pattern weight references missing move '${m}'`);
          if (typeof wgt !== 'number' || wgt <= 0) S.e(`pattern weight for '${m}' must be a positive number`);
        }
      }
      if (p.first !== undefined && !hasOwn(moves, p.first)) S.e(`pattern.first references missing move '${p.first}'`);
      if (p.noRepeat !== undefined && typeof p.noRepeat !== 'number') S.e('pattern.noRepeat must be a number');
    } else {
      S.e(`unknown pattern type '${p.type}'`);
    }
  } else if (def.ai === undefined) {
    S.w('enemy has neither pattern nor ai');
  }
  if (def.ai !== undefined && typeof def.ai !== 'function') S.e('ai must be a function');
}
function checkEncounter(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name'], S);
  if (![1, 2, 3].includes(def.act)) S.e(`act must be 1, 2 or 3, got '${def.act}'`);
  else if (typeof def.id === 'string' && !def.id.startsWith(`a${def.act}_`)) S.e(`id prefix does not match act ${def.act}`);
  if (!ENCOUNTER_TIERS.includes(def.tier)) S.e(`bad tier '${def.tier}'`);
  checkPrefixes(def, file, S, null);
  if (!Array.isArray(def.enemies) || def.enemies.length < 1 || def.enemies.length > 4) {
    S.e('enemies must be an array of 1 to 4 enemy ids');
    return;
  }
  for (const eid of def.enemies) {
    if (!KNOWN.enemies.has(eid)) {
      S.e(`unknown enemy '${eid}'`);
      continue;
    }
    const en = reg('Enemy')[eid];
    if (en && en.act !== def.act) S.w(`enemy '${eid}' is act ${en.act} but encounter is act ${def.act}`);
  }
}
function checkEvent(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'icon', 'text'], S);
  const act = def.act;
  const actOk = act === 'any' || (Array.isArray(act) && act.length > 0 && act.every((a) => [1, 2, 3].includes(a)));
  if (!actOk) S.e(`act must be 'any' or an array of acts, got '${JSON.stringify(act)}'`);
  checkPrefixes(def, file, S, null);
  if (!Array.isArray(def.choices) || def.choices.length < 2 || def.choices.length > 4) {
    S.e('choices must be an array of 2 to 4 entries');
    return;
  }
  let alwaysAvailable = false;
  def.choices.forEach((ch, i) => {
    const where = `choices[${i}]`;
    if (!ch || typeof ch !== 'object') {
      S.e(`${where} is not an object`);
      return;
    }
    if (typeof ch.label !== 'string' || !ch.label) S.e(`${where} has no label`);
    if (typeof ch.result !== 'string') S.e(`${where} has no result text`);
    if (!Array.isArray(ch.effects)) S.e(`${where} effects must be an array`);
    else checkEffects(ch.effects, 'run', `${where}.effects`, S);
    if (ch.cond === undefined) alwaysAvailable = true;
    else checkEventCond(ch.cond, `${where}.cond`, S);
  });
  if (!alwaysAvailable) S.e('no always-available choice (every choice has a cond)');
}
function checkStatus(def, file) {
  const S = sinkFor(file, def.id);
  checkIdFormat(def, S);
  reqStrings(def, ['name', 'desc', 'icon'], S);
  if (!STATUS_TYPES.includes(def.type)) S.e(`bad type '${def.type}'`);
  if (def.stacks !== undefined && typeof def.stacks !== 'boolean') S.e('stacks must be a boolean');
  for (const k of ['decay', 'expire']) {
    if (def[k] !== undefined && def[k] !== null && !DECAY_VALUES.includes(def[k])) S.e(`bad ${k} '${def[k]}'`);
  }
  if (def.mods !== undefined) {
    if (!def.mods || typeof def.mods !== 'object') S.e('mods must be an object');
    else {
      for (const [k, v] of Object.entries(def.mods)) {
        if (!STATUS_MODS.includes(k)) S.e(`unknown mod '${k}'`);
        else if (typeof v !== 'number') S.e(`mod '${k}' must be a number`);
      }
    }
  }
  checkTriggers(def.triggers, false, S);
  checkPrefixes(def, file, S, null);
}
function checkCharacter(def, file) {
  const S = sinkFor(file, def.id);
  if (!CHARACTERS.includes(def.id)) S.e('unknown character id');
  reqStrings(def, ['name', 'title', 'desc', 'icon'], S);
  if (typeof def.hp !== 'number' || def.hp <= 0) S.e('hp must be a positive number');
  if (typeof def.gold !== 'number') S.e('gold must be a number');
  if (typeof def.color !== 'string' || !HEX_RE.test(def.color)) S.e(`color must be a hex string, got '${def.color}'`);
  if (!Array.isArray(def.starterDeck)) {
    S.e('starterDeck must be an array');
  } else {
    for (const cid of def.starterDeck) if (!KNOWN.cards.has(cid)) S.e(`starterDeck: unknown card '${cid}'`);
    if (def.starterDeck.length !== CHARACTER_STARTER_SIZE) {
      S.e(`starterDeck has ${def.starterDeck.length} cards (contract says ${CHARACTER_STARTER_SIZE})`);
    }
  }
  if (!KNOWN.relics.has(def.starterRelic)) {
    S.e(`starterRelic '${def.starterRelic}' does not exist`);
  } else {
    const r = reg('Relic')[def.starterRelic];
    if (r && r.rarity !== 'starter') S.w(`starterRelic '${def.starterRelic}' should have rarity starter`);
  }
}
const CHECKERS = {
  Card: checkCard, Relic: checkRelic, Potion: checkPotion, Enemy: checkEnemy,
  Encounter: checkEncounter, Event: checkEvent, Status: checkStatus, Character: checkCharacter,
};
const BUILTIN_SET = new Set(BUILTIN_STATUSES);

// ---------------------------------------------------------------------------
// Static phase: index.html, project files, registries and cross-references.
// ---------------------------------------------------------------------------
function checkIndexHtml() {
  const p = path.join(ROOT, 'index.html');
  if (!fs.existsSync(p)) {
    addErr('index', 'index.html', 'file missing');
    return;
  }
  const html = fs.readFileSync(p, 'utf8');
  const srcs = [];
  const re = /<script[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1]);
  const same = srcs.length === LOAD_ORDER.length && srcs.every((s, i) => s === LOAD_ORDER[i]);
  if (!same) {
    const missing = LOAD_ORDER.filter((f) => !srcs.includes(f));
    const extra = srcs.filter((f) => !LOAD_ORDER.includes(f));
    const parts = [];
    if (missing.length) parts.push(`missing ${missing.join(', ')}`);
    if (extra.length) parts.push(`extra ${extra.join(', ')}`);
    if (!parts.length) parts.push('wrong order');
    addErr('index', 'index.html', `script tags differ from the contract load order: ${parts.join('; ')}`);
  }
  for (const id of ['topbar', 'app', 'overlay']) {
    if (!new RegExp(`id\\s*=\\s*["']${id}["']`).test(html)) addErr('index', 'index.html', `missing <div id="${id}">`);
  }
  if (!/href\s*=\s*["']styles\.css["']/.test(html)) addErr('index', 'index.html', 'styles.css is not linked');
  for (const rel of LOAD_ORDER) {
    if (rel.startsWith('src/ui/') && !fs.existsSync(path.join(ROOT, rel))) addWarn('index', rel, 'UI file missing (not loaded by smoke)');
  }
  if (!/<title>\s*Duskspire\s*<\/title>/i.test(html)) addWarn('index', 'index.html', 'page title is not "Duskspire"');
}

function checkProjectFiles() {
  const wanted = ['package.json', 'main.js', 'run.bat', 'styles.css', 'tools/smoke.js'];
  for (const f of wanted) {
    if (!fs.existsSync(path.join(ROOT, f))) addWarn('project', f, 'file missing');
  }
}

const fileMap = new Map(); // `${kind}|${id}` -> rel file
function buildFileMap() {
  for (const s of submitted) {
    const id = s.def && s.def.id;
    if (typeof id !== 'string') continue;
    const key = `${s.kind}|${id}`;
    if (!fileMap.has(key)) fileMap.set(key, s.file);
  }
}
function fileOf(kind, id) {
  return fileMap.get(`${kind}|${id}`) || '';
}

function staticValidate() {
  const DS = globalThis.DS;
  refreshKnown();
  buildFileMap();

  // Duplicates, missing ids, registration.
  const seen = new Map();
  const globalIds = new Map();
  for (const s of submitted) {
    const id = s.def && s.def.id;
    if (typeof id !== 'string' || !id) {
      addErr('static', s.file, `${s.kind} definition has no id (ignored)`);
      continue;
    }
    const key = `${s.kind}|${id}`;
    if (seen.has(key)) {
      addErr('static', s.file, `duplicate ${s.kind} id '${id}' (first defined in ${seen.get(key) || 'another file'})`);
    } else {
      seen.set(key, s.file);
    }
    if (globalIds.has(id) && globalIds.get(id) !== s.kind) {
      addErr('static', s.file, `id '${id}' is used by both ${globalIds.get(id)} and ${s.kind}`);
    } else {
      globalIds.set(id, s.kind);
    }
    if (!hasOwn(reg(s.kind), id)) addErr('static', s.file, `${s.kind} '${id}' was not registered`);
  }

  // Registered definitions, one checker per kind.
  for (const kind of Object.keys(CHECKERS)) {
    for (const [id, def] of Object.entries(reg(kind))) {
      const file = fileOf(kind, id);
      if (!def || def.id !== id) {
        addErr('static', file, `${kind} registered under '${id}' has a mismatched id`);
        continue;
      }
      try {
        CHECKERS[kind](def, file);
      } catch (e) {
        addErr('static', file, `${id}: validator threw: ${describeErr(e)}`);
      }
    }
  }

  // Built-in statuses must be defined by statuses.js, and nothing else may be.
  const statusFile = 'src/engine/statuses.js';
  const statusReg = reg('Status');
  for (const id of BUILTIN_STATUSES) {
    if (!hasOwn(statusReg, id)) addErr('static', statusFile, `built-in status '${id}' is not defined`);
  }
  for (const id of Object.keys(statusReg)) {
    if (!BUILTIN_SET.has(id) && fileOf('Status', id) === statusFile) {
      addErr('static', statusFile, `statuses.js defines '${id}', which is not a built-in status`);
    }
  }

  // Fixed shared ids.
  for (const id of CURSE_IDS) {
    const c = reg('Card')[id];
    const f = 'src/content/cards_colorless.js';
    if (!c) addErr('static', f, `shared curse '${id}' is missing`);
    else if (c.class !== 'curse') addErr('static', f, `shared curse '${id}' must have class curse`);
  }
  for (const id of STATUS_CARD_IDS) {
    const c = reg('Card')[id];
    const f = 'src/content/cards_colorless.js';
    if (!c) addErr('static', f, `shared status card '${id}' is missing`);
    else if (c.class !== 'status') addErr('static', f, `shared status card '${id}' must have class status`);
  }
  for (const ch of CHARACTERS) {
    if (!hasOwn(reg('Character'), ch)) addErr('static', '', `character '${ch}' is not defined`);
  }

  // Compare the engine's own op and trigger lists with the contract (informational).
  if (DS && Array.isArray(DS.OPS)) {
    const mine = new Set([...OPS_COMBAT, ...OPS_RUN]);
    const theirs = new Set(DS.OPS);
    const missing = [...mine].filter((x) => !theirs.has(x));
    const extra = [...theirs].filter((x) => !mine.has(x));
    if (missing.length || extra.length) {
      addWarn('static', 'src/engine/core.js', `DS.OPS differs from contract (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
    }
  }
  if (DS && Array.isArray(DS.TRIGGERS)) {
    const mine = new Set([...TRIGGERS_COMBAT, ...TRIGGERS_RUN]);
    const theirs = new Set(DS.TRIGGERS);
    const missing = [...mine].filter((x) => !theirs.has(x));
    const extra = [...theirs].filter((x) => !mine.has(x));
    if (missing.length || extra.length) {
      addWarn('static', 'src/engine/core.js', `DS.TRIGGERS differs from contract (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Dynamic phase: bot combats, sandboxes and simulated runs.
// ---------------------------------------------------------------------------
const dyn = {
  enc: { n: 0, outcome: {}, byAct: {}, byTier: {}, grid: {} },
  cards: { runs: 0, skipped: 0, failed: 0 },
  potions: { used: 0, failed: 0 },
  runs: [],
  runAct: {},
};

function tallyInto(map, key, outcome) {
  if (!hasOwn(map, key)) map[key] = { n: 0, won: 0, lost: 0, other: 0 };
  const t = map[key];
  t.n++;
  if (outcome === 'won') t.won++;
  else if (outcome === 'lost') t.lost++;
  else t.other++;
}

// Runs fn(ctl) with a timeout. On timeout ctl.aborted is set so the work can stop itself.
function withTimeout(factory, ms) {
  const ctl = { aborted: false };
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      ctl.aborted = true;
      reject(TIMEOUT);
    }, ms);
  });
  const work = Promise.resolve().then(() => factory(ctl));
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function numericProblems(c) {
  const bad = [];
  const num = (label, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      bad.push(`${label} is ${v === undefined ? 'undefined' : String(v)}`);
    }
  };
  const p = c.player;
  if (!p) return ['player missing'];
  num('player.hp', p.hp);
  num('player.maxHp', p.maxHp);
  num('player.block', p.block);
  num('player.energy', p.energy);
  for (const [k, v] of Object.entries(p.statuses || {})) num(`player.status.${k}`, v);
  for (const e of c.enemies || []) {
    num(`${e.id}.hp`, e.hp);
    num(`${e.id}.block`, e.block);
    for (const [k, v] of Object.entries(e.statuses || {})) num(`${e.id}.status.${k}`, v);
  }
  return bad;
}

function noteBad(rec, c) {
  for (const p of numericProblems(c)) rec.bad.push(p);
}

// Random-legal-move bot: play random playable cards (random living target for enemy-target
// cards) until none are playable or 30 plays, then end the turn. Up to 60 turns.
async function runBotCombat(encounterId, seed) {
  const DS = globalThis.DS;
  const rng = makeRng(seed);
  const rec = { encounterId, phase: 'unknown', turns: 0, plays: 0, timedOut: false, error: null, bad: [] };
  try {
    await withTimeout(async (ctl) => {
      const c = new DS.Combat(DS.run, encounterId);
      await c.start();
      noteBad(rec, c);
      for (let turn = 0; turn < MAX_TURNS && !ctl.aborted; turn++) {
        if (c.phase !== 'player') break;
        rec.turns = turn + 1;
        for (let n = 0; n < MAX_PLAYS_PER_TURN && !ctl.aborted; n++) {
          await yieldMacro();
          if (c.phase !== 'player') break;
          const playable = (c.hand || []).filter((card) => c.canPlay(card).ok);
          if (playable.length === 0) break;
          const card = pickR(rng, playable);
          const living = c.livingEnemies();
          let target = null;
          if (card.data && card.data.target === 'enemy') {
            if (living.length === 0) break;
            target = pickR(rng, living);
          }
          await c.playCard(card, target);
          rec.plays++;
          noteBad(rec, c);
        }
        if (ctl.aborted || c.phase !== 'player') break;
        await yieldMacro();
        await c.endTurn();
        noteBad(rec, c);
      }
      rec.phase = c.phase;
    }, COMBAT_TIMEOUT_MS);
  } catch (e) {
    if (e === TIMEOUT) rec.timedOut = true;
    else rec.error = describeErr(e);
  }
  return rec;
}

function outcomeOf(rec) {
  if (rec.error) return 'error';
  if (rec.timedOut) return 'hang';
  if (rec.phase === 'won') return 'won';
  if (rec.phase === 'lost') return 'lost';
  return 'stalled';
}

function reportCombat(rec, file) {
  const id = rec.encounterId;
  if (rec.error) addErr('combat', file, `${id}: threw an exception: ${rec.error}`);
  else if (rec.timedOut) addErr('combat', file, `${id}: HANG, no result within ${COMBAT_TIMEOUT_MS / 1000}s`);
  else if (rec.phase !== 'won' && rec.phase !== 'lost') {
    // Not an engine fault by itself: the random bot may simply be too weak to finish the fight.
    addWarn('combat', file, `${id}: bot did not finish within ${MAX_TURNS} turns (still '${rec.phase}'): balance or stalemate`);
  }
  const uniq = [...new Set(rec.bad)];
  if (uniq.length) addErr('combat', file, `${id}: non-finite values: ${uniq.slice(0, 3).join('; ')}`);
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function byActId(a, b) {
  return (a.act || 0) - (b.act || 0) || byId(a, b);
}

// Every encounter, once per character, at full HP.
async function testEncounters(chars) {
  const DS = globalThis.DS;
  const encs = Object.values(reg('Encounter')).sort(byActId);
  let k = 0;
  for (const char of chars) {
    try {
      DS.Run.start(char, 1000 + k * 13);
    } catch (e) {
      addErr('dynamic', '', `${char}: DS.Run.start threw: ${describeErr(e)}`);
      continue;
    }
    for (const enc of encs) {
      k++;
      if (DS.run) DS.run.hp = DS.run.maxHp;
      const rec = await runBotCombat(enc.id, 7919 * k + 17);
      reportCombat(rec, fileOf('Encounter', enc.id));
      const outcome = outcomeOf(rec);
      dyn.enc.n++;
      dyn.enc.outcome[outcome] = (dyn.enc.outcome[outcome] || 0) + 1;
      tallyInto(dyn.enc.byAct, String(enc.act), outcome);
      tallyInto(dyn.enc.byTier, String(enc.tier), outcome);
      tallyInto(dyn.enc.grid, `${char}|act ${enc.act}|${enc.tier}`, outcome);
    }
  }
}

// Dummy target used by the sandboxes. Registered only while the dynamic phase runs. Act 0 keeps it out
// of every real encounter pool (run generation picks encounters by act).
function ensureDummy() {
  const DS = globalThis.DS;
  if (!hasOwn(reg('Enemy'), DUMMY_ENEMY)) {
    DS.defineEnemy({
      id: DUMMY_ENEMY, name: 'Training Dummy', act: 0, tier: 'minion', hp: [500, 500], icon: 'T', scale: 1,
      moves: { idle: { name: 'Idle', intent: 'defend', effects: [] } },
      pattern: { type: 'sequence', moves: ['idle'], loop: true },
    });
  }
  if (!hasOwn(reg('Encounter'), DUMMY_ENCOUNTER)) {
    DS.defineEncounter({ id: DUMMY_ENCOUNTER, act: 0, tier: 'normal', name: 'Dummy Sandbox', enemies: [DUMMY_ENEMY] });
  }
  // HP probe: one 100 HP enemy, used to compare enemy HP across ascension levels.
  if (!hasOwn(reg('Enemy'), HP_PROBE_ENEMY)) {
    DS.defineEnemy({
      id: HP_PROBE_ENEMY, name: 'HP Probe', act: 0, tier: 'normal', hp: [100, 100], icon: 'P', scale: 1,
      moves: { idle: { name: 'Idle', intent: 'defend', effects: [] } },
      pattern: { type: 'sequence', moves: ['idle'], loop: true },
    });
  }
  if (!hasOwn(reg('Encounter'), HP_PROBE_ENCOUNTER)) {
    DS.defineEncounter({ id: HP_PROBE_ENCOUNTER, act: 0, tier: 'normal', name: 'HP Probe', enemies: [HP_PROBE_ENEMY] });
  }
}
function removeDummy() {
  delete reg('Enemy')[DUMMY_ENEMY];
  delete reg('Encounter')[DUMMY_ENCOUNTER];
  delete reg('Enemy')[HP_PROBE_ENEMY];
  delete reg('Encounter')[HP_PROBE_ENCOUNTER];
}

// ---------------------------------------------------------------------------
// Version 2 checks: settings, ascension, preview, combat log, meta, resume, event fights.
// A missing API is reported once as "v2 API missing: X". An API that exists but misbehaves is an
// error attributed to the file that defines it.
// ---------------------------------------------------------------------------
const V2_MISSING = new Set();
function v2Missing(name, file) {
  if (V2_MISSING.has(name)) return;
  V2_MISSING.add(name);
  addErr('v2', file || '', `v2 API missing: ${name}`);
}
const dynV2 = { previewCards: 0, resume: [], eventChoices: 0 };

// Stand-in localStorage for the duration of fn. The previous global is restored afterwards.
function withFakeStorageSync(fn) {
  const store = new Map();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  try {
    return fn(store);
  } finally {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  }
}
async function withFakeStorage(fn) {
  const store = new Map();
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  try {
    return await fn(store);
  } finally {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  }
}

// Everything a preview or log check must leave unchanged, as a comparable string.
function combatState(c) {
  return JSON.stringify({
    p: c.player,
    e: c.enemies.map((e) => ({ id: e.id, hp: e.hp, block: e.block, st: e.statuses, dead: e.dead, intent: e.intent })),
    h: c.hand.map((x) => x.uid),
    d: c.drawPile.map((x) => x.uid),
    di: c.discardPile.map((x) => x.uid),
    x: c.exhaustPile.map((x) => x.uid),
    log: Array.isArray(c.log) ? c.log.length : -1,
    turn: c.turn,
    phase: c.phase,
    runHp: globalThis.DS.run ? globalThis.DS.run.hp : null,
  });
}

function testSettings() {
  const DS = globalThis.DS;
  const F = 'src/engine/core.js';
  const S = DS.settings;
  if (!S || typeof S.get !== 'function' || typeof S.set !== 'function') {
    v2Missing('DS.settings', F);
    return;
  }
  const defaults = { speed: 1, confirmEndTurn: false, screenShake: true, showLog: true };
  for (const [k, v] of Object.entries(defaults)) {
    const got = S.get(k);
    if (got !== v) addErr('settings', F, `default for '${k}' is ${JSON.stringify(got)}, contract says ${JSON.stringify(v)}`);
  }
  const seen = [];
  const off = DS.events.on('settings:update', (p) => seen.push(p));
  try {
    S.set('speed', 2);
    if (S.get('speed') !== 2) addErr('settings', F, 'set(speed, 2) did not change get(speed)');
    if (!seen.some((p) => p && p.key === 'speed' && p.value === 2)) {
      addErr('settings', F, "set() did not emit 'settings:update' with {key, value}");
    }
  } finally {
    S.set('speed', 1);
    off();
  }
  withFakeStorageSync((store) => {
    S.set('muted', true);
    if (!store.has('duskspire_settings')) addErr('settings', F, "settings are not saved under localStorage 'duskspire_settings'");
    S.set('muted', false);
  });
}

// Static shape of the ascension table and the run score API.
function testAscensionShape() {
  const DS = globalThis.DS;
  const F = 'src/engine/run.js';
  if (!Array.isArray(DS.Run.ASCENSIONS)) {
    v2Missing('DS.Run.ASCENSIONS', F);
  } else {
    const A = DS.Run.ASCENSIONS;
    if (A.length !== 10) addErr('ascension', F, `ASCENSIONS has ${A.length} levels, the contract says 10`);
    A.forEach((a, i) => {
      if (!a || a.level !== i + 1) addErr('ascension', F, `ASCENSIONS[${i}].level is ${a && a.level}, expected ${i + 1}`);
      if (!a || typeof a.name !== 'string' || !a.name) addErr('ascension', F, `ASCENSIONS[${i}] has no name`);
      if (!a || typeof a.desc !== 'string' || !a.desc) addErr('ascension', F, `ASCENSIONS[${i}] has no desc`);
    });
  }
  if (typeof DS.Run.score !== 'function') v2Missing('DS.Run.score', F);
}

// Ascension 10 must spawn tougher enemies than ascension 0 (same encounter, same seed).
async function testAscensionDifficulty(char) {
  const DS = globalThis.DS;
  const F = 'src/engine/run.js';
  const spawnHp = async (asc) => {
    DS.Run.start(char, { seed: 515, ascension: asc });
    const c = new DS.Combat(DS.run, HP_PROBE_ENCOUNTER);
    await c.start();
    return { hp: c.enemies[0] ? c.enemies[0].maxHp : null, run: DS.run };
  };
  const a0 = await spawnHp(0);
  const a10 = await spawnHp(10);
  if (a10.run.ascension === undefined) {
    v2Missing('DS.Run.start(char, {seed, ascension}) (run.ascension)', F);
    return;
  }
  if (!a10.run.difficulty) {
    v2Missing('run.difficulty', F);
    return;
  }
  if (!(a10.run.difficulty.enemyHpMul > 1)) {
    addErr('ascension', F, `ascension 10 has enemyHpMul ${a10.run.difficulty.enemyHpMul}, expected above 1`);
  }
  if (a0.hp === null || a10.hp === null) addErr('ascension', F, 'the HP probe encounter spawned no enemy');
  else if (a0.hp !== 100) addErr('ascension', F, `ascension 0 HP probe has ${a0.hp} max HP, expected 100`);
  else if (!(a10.hp > a0.hp)) addErr('ascension', F, `ascension 10 enemy has ${a10.hp} max HP, not above ascension 0 (${a0.hp})`);
}

// Every card, normal and upgraded, previewed against an enemy and against nothing. The preview must
// return sane numbers and must not change the state of the combat.
async function testPreview() {
  const DS = globalThis.DS;
  if (typeof DS.Combat.prototype.preview !== 'function') {
    v2Missing('c.preview', 'src/engine/combat.js');
    return;
  }
  DS.Run.start(CHARACTERS[0], 4321);
  const cards = Object.values(reg('Card')).sort(byId);
  for (const def of cards) {
    const file = fileOf('Card', def.id);
    for (const up of def.upgrade ? [false, true] : [false]) {
      const label = `${def.id}${up ? '+' : ''}`;
      try {
        await withTimeout(async () => {
          DS.run.hp = DS.run.maxHp;
          const c = new DS.Combat(DS.run, DUMMY_ENCOUNTER);
          await c.start();
          c.player.energy = DUMMY_ENERGY;
          const inst = c.makeCard({ id: def.id, upgraded: up });
          c.hand = [inst];
          const before = combatState(c);
          const effects = (inst.data && inst.data.effects) || [];
          const hasDamage = effects.some((e) => e && e.op === 'damage');
          const hasBlock = effects.some((e) => e && e.op === 'block');
          const target = c.livingEnemies()[0] || null;
          for (const t of [target, null]) {
            const p = c.preview(inst, t);
            if (!p || typeof p !== 'object') {
              addErr('preview', file, `${label}: preview returned ${p}`);
              continue;
            }
            for (const k of ['damage', 'block']) {
              const v = p[k];
              if (v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
                addErr('preview', file, `${label}: preview.${k} is ${v}`);
              }
            }
            if (!(typeof p.times === 'number' && Number.isFinite(p.times) && p.times >= 0)) {
              addErr('preview', file, `${label}: preview.times is ${p.times}`);
            }
            if (t && hasDamage && p.damage === null) addErr('preview', file, `${label}: has a damage effect but preview.damage is null`);
            if (hasBlock && p.block === null) addErr('preview', file, `${label}: has a block effect but preview.block is null`);
          }
          if (combatState(c) !== before) addErr('preview', file, `${label}: preview changed the combat state`);
          dynV2.previewCards++;
        }, COMBAT_TIMEOUT_MS);
      } catch (e) {
        addErr('preview', file, e === TIMEOUT ? `${label}: preview HANG` : `${label}: preview threw ${describeErr(e)}`);
      }
    }
  }
}

// The combat log grows with each action, has {turn, text} entries, emits combat:log and is capped at 200.
async function testLog() {
  const DS = globalThis.DS;
  const F = 'src/engine/combat.js';
  const attack = Object.values(reg('Card')).sort(byId).find((d) => d.type === 'attack' && d.target === 'enemy');
  if (!attack) return;
  try {
    await withTimeout(async () => {
      DS.Run.start(CHARACTERS[0], 777);
      const c = new DS.Combat(DS.run, DUMMY_ENCOUNTER);
      await c.start();
      if (!Array.isArray(c.log)) {
        v2Missing('c.log', F);
        return;
      }
      const emitted = [];
      const off = DS.events.on('combat:log', (p) => emitted.push(p));
      try {
        const before = c.log.length;
        c.hand = [c.makeCard({ id: attack.id })];
        c.player.energy = 9;
        await c.playCard(c.hand[0], c.livingEnemies()[0]);
        if (c.log.length <= before) addErr('log', F, 'playing a card added no combat log entry');
        const last = c.log[c.log.length - 1];
        if (last && (typeof last.text !== 'string' || typeof last.turn !== 'number')) {
          addErr('log', F, 'log entries must be {turn, text}');
        }
        if (emitted.length === 0) addErr('log', F, "no 'combat:log' event was emitted");
        for (let i = 0; i < 230; i++) {
          const k = c.makeCard({ id: attack.id });
          c.hand = [k];
          c.player.energy = 9;
          await c.playCard(k, c.livingEnemies()[0]);
        }
        if (c.log.length > 200) addErr('log', F, `log has ${c.log.length} entries, the cap is 200`);
      } finally {
        off();
      }
    }, COMBAT_TIMEOUT_MS);
  } catch (e) {
    addErr('log', F, e === TIMEOUT ? 'c.log check HANG' : `c.log check threw ${describeErr(e)}`);
  }
}

// Meta: Run.end records the run, the stored JSON matches get(), achievements unlock once, and the
// ascension unlock follows a win.
function testMeta() {
  const DS = globalThis.DS;
  const F = 'src/engine/run.js';
  if (!DS.Meta || typeof DS.Meta.get !== 'function') {
    v2Missing('DS.Meta', F);
    return;
  }
  const check = (cond, msg) => { if (!cond) addErr('meta', F, msg); };
  try {
    withFakeStorageSync((store) => {
      DS.Meta.reset();
      // get() may return the live state, so copies are taken before anything changes.
      const m0 = JSON.parse(JSON.stringify(DS.Meta.get()));
      check(typeof m0.runs === 'number' && Array.isArray(m0.history), 'get() lacks runs and history');
      DS.Run.start(CHARACTERS[0], { seed: 88, ascension: 0 });
      DS.Run.end(true);
      const m1 = JSON.parse(JSON.stringify(DS.Meta.get()));
      check(m1.runs === m0.runs + 1, `Run.end did not record the run (runs ${m0.runs} -> ${m1.runs})`);
      check(m1.history[0] && m1.history[0].character === CHARACTERS[0], 'newest history entry is not the run that just ended');
      check(m1.history[0] && m1.history[0].won === true, 'history entry does not record the win');
      const raw = store.get('duskspire_meta');
      if (!raw) addErr('meta', F, "nothing was saved under localStorage 'duskspire_meta'");
      else check(util.isDeepStrictEqual(JSON.parse(raw), m1), 'stored JSON does not match get()');
      const ach = DS.Meta.ACHIEVEMENTS;
      if (!Array.isArray(ach) || ach.length === 0) {
        addErr('meta', F, 'DS.Meta.ACHIEVEMENTS is missing or empty');
      } else {
        // A win can unlock achievements by itself, so test one that is still locked.
        const fresh = ach.find((a) => !(m1.achievements && m1.achievements[a.id])) || ach[0];
        if (m1.achievements && m1.achievements[fresh.id]) {
          check(DS.Meta.unlock(fresh.id) === false, `unlock('${fresh.id}') should return false for an unlocked achievement`);
        } else {
          check(DS.Meta.unlock(fresh.id) === true, `unlock('${fresh.id}') should return true the first time`);
          check(DS.Meta.unlock(fresh.id) === false, `unlock('${fresh.id}') should return false the second time`);
        }
      }
      check(DS.Meta.maxAscension(CHARACTERS[0]) >= 1, 'maxAscension should be at least 1 after an ascension 0 win');
      const card = Object.keys(reg('Card'))[0];
      if (card) {
        DS.Meta.markSeen('cards', card);
        check(DS.Meta.get().seen.cards[card] === true, 'markSeen did not record the card');
      }
      DS.Meta.reset();
      check(DS.Meta.get().runs === 0, 'reset() did not clear the run count');
    });
  } catch (e) {
    addErr('meta', F, `Meta checks threw ${describeErr(e)}`);
  }
}

// Resume: a room entered and saved must come back on Continue, on the screen for that room.
// resumeTarget() returns {screen, params}; the contract does not fix its shape, so the screen is checked.
const RESUME_SCREEN = { fight: 'combat', elite: 'combat', boss: 'combat', rest: 'rest', shop: 'shop', event: 'event', treasure: 'treasure' };
const ROOM_OF = { fight: 'combat', elite: 'combat', boss: 'combat', rest: 'rest', shop: 'shop', event: 'event', treasure: 'treasure' };
async function testResume() {
  const DS = globalThis.DS;
  const F = 'src/engine/run.js';
  if (typeof DS.Run.resumeTarget !== 'function') {
    v2Missing('DS.Run.resumeTarget', F);
    return;
  }
  const char = CHARACTERS[0];
  for (const type of Object.keys(RESUME_SCREEN)) {
    let res = 'not reached';
    try {
      await withFakeStorage(async () => {
        for (let seed = 1; seed <= 60; seed++) {
          DS.Run.start(char, seed);
          const id = DS.Run.availableNodes()[0].id;
          DS.run.map.nodes[id].type = type;
          const room = DS.Run.enterNode(id);
          if (!room || room.type !== ROOM_OF[type]) continue;
          DS.Run.save();
          if (!DS.Run.load()) { res = 'load() failed after save()'; return; }
          const r = DS.Run.resumeTarget();
          if (!r) { res = 'resumeTarget() is empty after load'; return; }
          if (r.screen !== RESUME_SCREEN[type]) { res = `resumes on '${r.screen}', expected '${RESUME_SCREEN[type]}'`; return; }
          if (room.type === 'combat' && r.params && r.params.encounterId !== room.encounterId) {
            res = 'resumes into a different encounter';
            return;
          }
          if (room.type === 'event' && r.params && r.params.eventId !== room.eventId) {
            res = 'resumes into a different event';
            return;
          }
          res = 'ok';
          return;
        }
        res = 'could not create that room in 60 seeds';
      });
    } catch (e) {
      res = `threw ${describeErr(e)}`;
    }
    dynV2.resume.push([type, res]);
    if (res !== 'ok') addErr('resume', F, `${type} room: ${res}`);
  }
}

function hasFightOp(list) {
  return (Array.isArray(list) ? list : []).some((e) => e && typeof e === 'object' &&
    (e.op === 'fight' || hasFightOp(e.then) || hasFightOp(e.else)));
}
// Every event choice that starts a fight must resolve to a real encounter id (random_normal and
// random_elite included).
async function testEventSweep() {
  const DS = globalThis.DS;
  for (const ev of Object.values(reg('Event')).sort(byId)) {
    const file = fileOf('Event', ev.id);
    const choices = Array.isArray(ev.choices) ? ev.choices : [];
    for (let i = 0; i < choices.length; i++) {
      if (!hasFightOp(choices[i].effects)) continue;
      try {
        await withTimeout(async () => {
          DS.Run.start(CHARACTERS[0], 900 + i);
          DS.run.gold = 999;
          DS.run.hp = DS.run.maxHp;
          const entry = DS.Run.getEvent(ev.id).choices[i];
          if (!entry || !entry.enabled) return;
          const res = await DS.Run.chooseEvent(ev.id, i);
          dynV2.eventChoices++;
          if (!res || !res.fightEncounterId) {
            addErr('events', file, `${ev.id} choice ${i}: its fight op produced no encounter`);
          } else if (!KNOWN.encounters.has(res.fightEncounterId)) {
            addErr('events', file, `${ev.id} choice ${i}: fight resolves to unknown encounter '${res.fightEncounterId}'`);
          }
        }, COMBAT_TIMEOUT_MS);
      } catch (e) {
        addErr('events', file, `${ev.id} choice ${i}: ${e === TIMEOUT ? 'HANG' : `threw ${describeErr(e)}`}`);
      }
    }
  }
}

// One sandbox combat: the card is put in hand with 10 energy and played (mode 'play'),
// or left in hand through the end of the turn (mode 'hold').
async function sandboxCard(id, upgraded, mode) {
  const DS = globalThis.DS;
  return withTimeout(async (ctl) => {
    DS.run.hp = DS.run.maxHp;
    const c = new DS.Combat(DS.run, DUMMY_ENCOUNTER);
    await c.start();
    if (c.phase !== 'player') throw new Error(`sandbox combat did not start in the player phase (phase '${c.phase}')`);
    const data = DS.getCardData({ id, upgraded });
    const inst = { uid: DS.uid(), id, upgraded, data, cost: data.cost };
    c.hand = [inst];
    c.player.energy = DUMMY_ENERGY;
    if (mode === 'play') {
      const chk = c.canPlay(inst);
      if (!chk.ok) return { skipped: chk.reason || 'not playable', bad: [] };
      const living = c.livingEnemies();
      const target = data.target === 'enemy' ? (living[0] || null) : null;
      await c.playCard(inst, target);
      if (c.phase === 'player' && !ctl.aborted) await c.endTurn();
    } else {
      await c.endTurn();
    }
    return { skipped: null, bad: numericProblems(c) };
  }, COMBAT_TIMEOUT_MS);
}

async function testCards() {
  const cards = Object.values(reg('Card')).sort(byId);
  for (const def of cards) {
    const file = fileOf('Card', def.id);
    const variants = def.upgrade ? [false, true] : [false];
    for (const up of variants) {
      for (const mode of ['play', 'hold']) {
        const label = `${def.id}${up ? '+' : ''} (${mode})`;
        dyn.cards.runs++;
        try {
          const res = await sandboxCard(def.id, up, mode);
          if (res.skipped) {
            dyn.cards.skipped++;
            continue;
          }
          if (res.bad.length) {
            dyn.cards.failed++;
            addErr('cards', file, `${label}: non-finite values: ${[...new Set(res.bad)].slice(0, 3).join('; ')}`);
          }
        } catch (e) {
          dyn.cards.failed++;
          addErr('cards', file, e === TIMEOUT ? `${label}: HANG` : `${label}: threw ${describeErr(e)}`);
        }
      }
    }
  }
}

async function testPotions() {
  const DS = globalThis.DS;
  const potions = Object.values(reg('Potion')).sort(byId);
  for (const def of potions) {
    const file = fileOf('Potion', def.id);
    try {
      await withTimeout(async (ctl) => {
        DS.run.hp = DS.run.maxHp;
        const c = new DS.Combat(DS.run, DUMMY_ENCOUNTER);
        await c.start();
        if (c.phase !== 'player') throw new Error(`sandbox combat did not start in the player phase (phase '${c.phase}')`);
        const slots = Array.isArray(DS.run.potions) && DS.run.potions.length ? DS.run.potions : [null, null, null];
        slots.fill(null);
        slots[0] = def.id;
        DS.run.potions = slots;
        const living = c.livingEnemies();
        const target = def.target === 'enemy' ? (living[0] || null) : null;
        const res = await c.usePotion(0, target);
        if (res && res.ok === false) {
          addErr('potions', file, `${def.id}: usePotion refused: ${res.reason || 'no reason given'}`);
        }
        if (DS.run.potions[0] !== null && DS.run.potions[0] !== undefined) {
          addErr('potions', file, `${def.id}: slot 0 was not cleared after use`);
        }
        const bad = numericProblems(c);
        if (bad.length && !ctl.aborted) {
          addErr('potions', file, `${def.id}: non-finite values: ${[...new Set(bad)].slice(0, 3).join('; ')}`);
        }
      }, COMBAT_TIMEOUT_MS);
      dyn.potions.used++;
    } catch (e) {
      dyn.potions.failed++;
      addErr('potions', file, e === TIMEOUT ? `${def.id}: HANG` : `${def.id}: threw ${describeErr(e)}`);
    }
  }
}

function tierOf(encId) {
  const def = reg('Encounter')[encId];
  return (def && def.tier) || 'normal';
}

// Run-level 'fight' ops may name a placeholder ('random_normal' / 'random_elite'); pick a real encounter.
function resolveEncounterId(id, act) {
  if (!RANDOM_ENCOUNTERS.includes(id)) return id;
  const tier = id === 'random_elite' ? 'elite' : 'normal';
  const pool = Object.values(reg('Encounter')).filter((e) => e.tier === tier && Number(e.act) === Number(act));
  return pool.length ? globalThis.DS.rng.pick(pool).id : null;
}

function takeRewards(tier) {
  const DS = globalThis.DS;
  const r = DS.Run.generateRewards(tier);
  if (!r) return;
  if (r.gold) DS.Run.addGold(r.gold);
  const choices = r.cardChoices || [];
  if (choices.length) DS.Run.addCard(choices[0].id, choices[0].upgraded);
  if (r.potion) DS.Run.addPotion(r.potion);
  if (r.relic) DS.Run.addRelic(r.relic);
}

function buyFromShop(shop, rng) {
  const DS = globalThis.DS;
  const gold = () => DS.run.gold;
  const opts = [];
  (shop.cards || []).forEach((it, i) => { if (!it.sold && it.price <= gold()) opts.push(['card', i]); });
  (shop.relics || []).forEach((it, i) => { if (!it.sold && it.price <= gold()) opts.push(['relic', i]); });
  (shop.potions || []).forEach((it, i) => { if (!it.sold && it.price <= gold()) opts.push(['potion', i]); });
  if (opts.length) {
    const [kind, idx] = pickR(rng, opts);
    DS.Run.buy(kind, idx);
  }
  if (!shop.removeUsed && shop.removePrice <= gold() && DS.run.deck.length && rng() < 0.5) {
    DS.Run.shopRemove(pickR(rng, DS.run.deck).uid);
  }
}

// Plays one encounter inside a run. Returns 'won', 'lost' or 'stopped'.
async function fightRun(encId, rng, char, out) {
  const DS = globalThis.DS;
  const rec = await runBotCombat(encId, Math.floor(rng() * 1e9) + 1);
  reportCombat(rec, fileOf('Encounter', encId));
  out.combats++;
  const outcome = outcomeOf(rec);
  const act = (reg('Encounter')[encId] || {}).act;
  tallyInto(dyn.runAct, String(act), outcome);
  if (outcome === 'won') return 'won';
  if (outcome === 'lost') {
    out.lost = true;
    out.stopReason = `lost to ${encId} on act ${act}`;
    addWarn('runs', fileOf('Encounter', encId), `${char}: lost to ${encId} (act ${act}) despite the +${FULL_RUN_BONUS_HP} HP bonus`);
    try {
      DS.Run.end(false);
    } catch (e) {
      addErr('runs', '', `${char}: DS.Run.end(false) threw: ${describeErr(e)}`);
    }
    return 'lost';
  }
  // A stall is a bot limitation (warning); a hang or exception is a fault (error, reported by reportCombat).
  out.stopKind = outcome === 'stalled' ? 'stalled' : 'error';
  out.stopReason = `${encId} ended as ${outcome}`;
  return 'stopped';
}

// Resolves one room. Returns false when the run should stop.
async function playRoom(room, node, rng, char, out) {
  const DS = globalThis.DS;
  switch (room.type) {
    case 'combat': {
      const tier = room.tier || tierOf(room.encounterId);
      const r = await fightRun(room.encounterId, rng, char, out);
      if (r !== 'won') return false;
      takeRewards(tier);
      if (node.type === 'boss' || tier === 'boss') {
        const choices = DS.Run.bossRelicChoices() || [];
        if (choices.length) DS.Run.addRelic(pickR(rng, choices));
        if (!DS.Run.nextAct()) return false;
      }
      return true;
    }
    case 'event': {
      const ev = DS.Run.getEvent(room.eventId);
      const choices = (ev.choices || []).map((c, i) => Object.assign({}, c, { index: c.index !== undefined ? c.index : i }));
      const enabled = choices.filter((c) => c.enabled);
      if (enabled.length === 0) {
        addErr('runs', fileOf('Event', room.eventId), `${char}: event ${room.eventId} offered no enabled choice`);
        return false;
      }
      const picked = pickR(rng, enabled);
      const res = await DS.Run.chooseEvent(room.eventId, picked.index);
      if (res && res.fightEncounterId) {
        const encId = resolveEncounterId(res.fightEncounterId, DS.run ? DS.run.act : 1);
        if (!encId) {
          addErr('runs', fileOf('Event', room.eventId), `${char}: event ${room.eventId} asked for '${res.fightEncounterId}' but no encounter fits`);
          return false;
        }
        const r = await fightRun(encId, rng, char, out);
        if (r !== 'won') return false;
        takeRewards(tierOf(encId));
      }
      return true;
    }
    case 'shop':
      buyFromShop(room.shop || {}, rng);
      return true;
    case 'rest':
      DS.Run.rest();
      return true;
    case 'treasure':
      if (room.gold) DS.Run.addGold(room.gold);
      if (room.relicId) DS.Run.addRelic(room.relicId);
      return true;
    default:
      addErr('runs', '', `${char}: unknown room type '${room.type}'`);
      return false;
  }
}

async function fullRun(char, seed, out) {
  const DS = globalThis.DS;
  const rng = makeRng(seed);
  DS.Run.start(char, seed);
  DS.run.maxHp += FULL_RUN_BONUS_HP;
  DS.run.hp += FULL_RUN_BONUS_HP;
  let steps = 0;
  while (DS.run && !DS.run.over && !DS.run.won) {
    if (++steps > FULL_RUN_STEP_CAP) {
      out.stopReason = `did not finish within ${FULL_RUN_STEP_CAP} rooms`;
      break;
    }
    out.maxAct = Math.max(out.maxAct, DS.run.act || 1);
    const nodes = DS.Run.availableNodes();
    if (!nodes || nodes.length === 0) {
      out.stopReason = `no reachable room on act ${DS.run.act} floor ${DS.run.floor}`;
      break;
    }
    const node = pickR(rng, nodes);
    let cont;
    try {
      const room = DS.Run.enterNode(node.id);
      out.rooms++;
      cont = await playRoom(room, node, rng, char, out);
    } catch (e) {
      out.stopReason = `threw: ${describeErr(e)}`;
      addErr('runs', '', `${char}: act ${DS.run ? DS.run.act : '?'} ${node.type} room threw: ${describeErr(e)}`);
      break;
    }
    if (!cont) break;
  }
  out.won = !!(DS.run && DS.run.won);
  if (DS.run) out.maxAct = Math.max(out.maxAct, DS.run.act || 1);
  if (!out.won && !out.lost && out.stopReason) {
    const msg = `${char}: run stopped on act ${out.maxAct}: ${out.stopReason}`;
    if (out.stopKind === 'stalled') addWarn('runs', '', msg);
    else addErr('runs', '', msg);
  } else if (!out.won && !out.lost && !out.stopReason) {
    addErr('runs', '', `${char}: run ended without a win or a loss`);
  }
}

async function runFullSimulations(chars) {
  let seed = 4242;
  for (const char of chars) {
    seed += 97;
    const out = { char, won: false, lost: false, maxAct: 1, rooms: 0, combats: 0, stopReason: null };
    try {
      await fullRun(char, seed, out);
    } catch (e) {
      out.stopReason = `threw: ${describeErr(e)}`;
      addErr('runs', '', `${char}: full run threw: ${describeErr(e)}`);
    }
    dyn.runs.push(out);
  }
}

async function runDynamic() {
  ensureDummy();
  try {
    testSettings();
    testAscensionShape();
    await testEncounters(CHARACTERS);
    await testCards();
    await testPotions();
    await testPreview();
    await testLog();
    testMeta();
    await testAscensionDifficulty(CHARACTERS[0]);
    await testResume();
    await testEventSweep();
    if (!QUICK) await runFullSimulations(CHARACTERS);
  } finally {
    removeDummy();
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
function allErrors() {
  const list = [...errors.values()];
  for (const [msg, n] of consoleErrs) list.push({ cat: 'console.error', file: '', msg, count: n });
  return list;
}
function allWarnings() {
  const list = [...warnings.values()];
  for (const [msg, n] of consoleWarns) list.push({ cat: 'console.warn', file: '', msg, count: n });
  return list;
}
function matchesOnly(e) {
  return !ONLY || `${e.cat} ${e.file} ${e.msg}`.includes(ONLY);
}
function sortEntries(list) {
  return list.slice().sort((a, b) => (a.cat.localeCompare(b.cat)) || (a.file.localeCompare(b.file)) || (a.msg.localeCompare(b.msg)));
}
function table(headers, rows) {
  const all = [headers, ...rows].map((r) => r.map((c) => String(c)));
  const widths = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  const fmt = (r) => '    ' + r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
  return [fmt(all[0]), ...all.slice(1).map(fmt)];
}
function printEntries(lines, title, list, total) {
  lines.push(`-- ${title} (${total} distinct${ONLY ? `, ${list.length} shown` : ''}) --`);
  if (list.length === 0) {
    lines.push('  none');
    return;
  }
  let lastGroup = null;
  for (const e of sortEntries(list)) {
    const group = `  [${e.cat}] ${e.file || '(general)'}`;
    if (group !== lastGroup) {
      lines.push(group);
      lastGroup = group;
    }
    lines.push(`      - ${e.msg}${e.count > 1 ? `  (x${e.count})` : ''}`);
  }
}

function printReport(info) {
  const DSG = globalThis.DS || {};
  const L = [];
  const add = (s = '') => L.push(s);
  const errs = allErrors();
  const warns = allWarnings();
  const shownErrs = errs.filter(matchesOnly);
  const shownWarns = warns.filter(matchesOnly);

  add('==============================================================');
  add(' DUSKSPIRE SMOKE REPORT');
  add(` root: ${ROOT}`);
  add(` mode: ${QUICK ? 'quick (full simulated runs skipped)' : 'full'}${ONLY ? `   filter: --only=${ONLY}` : ''}   elapsed: ${((Date.now() - info.started) / 1000).toFixed(1)}s`);
  add('==============================================================');

  add();
  add('-- Files --');
  for (const rel of HEADLESS_FILES) {
    if (loadedFiles.includes(rel)) {
      add(`  ok      ${rel}`);
    } else {
      const le = [...errors.values()].find((e) => e.cat === 'load' && e.file === rel);
      add(`  FAILED  ${rel}${le ? `  (${le.msg})` : ''}`);
    }
  }
  add('  (src/ui/* is not loaded headlessly)');

  add();
  add('-- Content --');
  const cards = Object.values(reg('Card'));
  const cardRows = CARD_CLASSES.map((cls) => {
    const counts = CARD_RARITIES.map((r) => cards.filter((c) => c.class === cls && c.rarity === r).length);
    return [cls, ...counts, counts.reduce((a, b) => a + b, 0)];
  });
  const cardTotals = CARD_RARITIES.map((r) => cards.filter((c) => c.rarity === r).length);
  cardRows.push(['all', ...cardTotals, cards.length]);
  add(`  Cards: ${cards.length}`);
  for (const l of table(['class', ...CARD_RARITIES, 'total'], cardRows)) add(l);

  const relics = Object.values(reg('Relic'));
  add(`  Relics: ${relics.length}   by rarity: ${RELIC_RARITIES.map((r) => `${r} ${relics.filter((x) => x.rarity === r).length}`).join(', ')}`);

  const potions = Object.values(reg('Potion'));
  add(`  Potions: ${potions.length}   by rarity: ${POTION_RARITIES.map((r) => `${r} ${potions.filter((x) => x.rarity === r).length}`).join(', ')}`);

  const enemies = Object.values(reg('Enemy'));
  const enemyRows = [1, 2, 3].map((a) => {
    const counts = ENEMY_TIERS.map((t) => enemies.filter((e) => e.act === a && e.tier === t).length);
    return [`act ${a}`, ...counts, counts.reduce((x, y) => x + y, 0)];
  });
  add(`  Enemies: ${enemies.length}`);
  for (const l of table(['act', ...ENEMY_TIERS, 'total'], enemyRows)) add(l);

  const encounters = Object.values(reg('Encounter'));
  const encRows = [1, 2, 3].map((a) => {
    const counts = ENCOUNTER_TIERS.map((t) => encounters.filter((e) => e.act === a && e.tier === t).length);
    return [`act ${a}`, ...counts, counts.reduce((x, y) => x + y, 0)];
  });
  add(`  Encounters: ${encounters.length}`);
  for (const l of table(['act', ...ENCOUNTER_TIERS, 'total'], encRows)) add(l);

  const events = Object.values(reg('Event'));
  const eventsFor = (a) => events.filter((e) => (Array.isArray(e.act) ? e.act.includes(a) : e.act === a)).length;
  add(`  Events: ${events.length}   any-act ${events.filter((e) => e.act === 'any').length}, act 1 ${eventsFor(1)}, act 2 ${eventsFor(2)}, act 3 ${eventsFor(3)}`);

  const statuses = Object.keys(reg('Status'));
  const builtinCount = statuses.filter((id) => BUILTIN_SET.has(id)).length;
  add(`  Statuses: ${statuses.length}   built-in ${builtinCount}/${BUILTIN_STATUSES.length}, custom ${statuses.length - builtinCount}`);

  const chars = Object.keys(reg('Character'));
  add(`  Characters: ${chars.length} (${chars.join(', ') || 'none'})`);

  add();
  add('-- Dynamic tests --');
  if (!info.engineOk) {
    add('  skipped: DS.Combat / DS.Run are not available');
  } else {
    const o = dyn.enc.outcome;
    add(`  Encounter bot fights (every encounter, ${CHARACTERS.length} characters, full HP): ${dyn.enc.n} total`);
    add(`      won ${o.won || 0}, lost ${o.lost || 0}, stalled ${o.stalled || 0}, hang ${o.hang || 0}, threw ${o.error || 0}`);
    add(`  Card sandbox: ${dyn.cards.runs} runs (play and hold, normal and upgraded), ${dyn.cards.skipped} skipped as unplayable, ${dyn.cards.failed} failed`);
    add(`  Potions used once each: ${dyn.potions.used} ok, ${dyn.potions.failed} failed`);
    add(`  v2: ${dynV2.previewCards} card previews checked; ${dynV2.eventChoices} event fight choices swept`);
    add(`      resume: ${dynV2.resume.map(([t, r]) => `${t} ${r === 'ok' ? 'ok' : 'FAIL'}`).join(', ') || 'not run'}`);
    if (QUICK) {
      add('  Full simulated runs: skipped (--quick)');
    } else {
      for (const r of dyn.runs) {
        const result = r.won ? 'WON' : r.lost ? `lost on act ${r.maxAct}` : `stopped on act ${r.maxAct}`;
        add(`  Full run ${r.char}: ${result} | ${r.rooms} rooms, ${r.combats} combats${r.stopReason ? ` | ${r.stopReason}` : ''}`);
      }
    }
  }
  add(`  Engine: ${DSG.Combat ? 'DS.Combat' : 'no DS.Combat'}, ${DSG.Run ? 'DS.Run' : 'no DS.Run'}, ${Object.keys(DSG).length} DS members`);

  add();
  add('-- Bot win rates (rough balance signal, not a verdict) --');
  for (const a of [1, 2, 3]) {
    const e = dyn.enc.byAct[String(a)] || { n: 0, won: 0 };
    const r = dyn.runAct[String(a)] || { n: 0, won: 0 };
    add(`  Act ${a}: single encounters ${pct(e.won, e.n)} (${e.won}/${e.n})   full-run combats ${pct(r.won, r.n)} (${r.won}/${r.n})`);
  }
  const tierLine = ENCOUNTER_TIERS.filter((t) => dyn.enc.byTier[t])
    .map((t) => `${t} ${pct(dyn.enc.byTier[t].won, dyn.enc.byTier[t].n)}`);
  if (tierLine.length) add(`  By tier (single encounters, all acts): ${tierLine.join(', ')}`);
  for (const ch of CHARACTERS) {
    const parts = [];
    for (const a of [1, 2, 3]) for (const t of ENCOUNTER_TIERS) {
      const g = dyn.enc.grid[`${ch}|act ${a}|${t}`];
      if (g) parts.push(`a${a} ${t} ${pct(g.won, g.n)}`);
    }
    if (parts.length) add(`  ${ch}: ${parts.join(' | ')}`);
  }

  add();
  printEntries(L, 'ERRORS', shownErrs, errs.length);
  add();
  printEntries(L, 'WARNINGS', shownWarns, warns.length);

  add();
  add(`SMOKE RESULT: ${errs.length === 0 ? 'PASS' : `FAIL (${errs.length} errors)`}`);
  process.stdout.write(L.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Driver.
// ---------------------------------------------------------------------------
async function main() {
  const started = Date.now();
  // Engine logging is swallowed; warnings and errors are captured for the report.
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = (...a) => bumpPlain(consoleWarns, clip(util.format(...a)));
  console.error = (...a) => bumpPlain(consoleErrs, clip(util.format(...a)));

  let engineOk = false;
  try {
    checkIndexHtml();
    checkProjectFiles();
    loadHeadlessFiles();
    installDefineWrappers();
    if (!globalThis.DS) {
      addErr('load', '', 'the DS global was never created');
    } else {
      staticValidate();
      engineOk = typeof globalThis.DS.Combat === 'function' && !!globalThis.DS.Run && typeof globalThis.DS.Run.start === 'function';
      if (!engineOk) addErr('dynamic', '', 'dynamic tests skipped: DS.Combat and DS.Run.start are required');
      else await runDynamic();
    }
  } catch (e) {
    addErr('harness', '', `smoke harness crashed: ${describeErr(e)}`);
  }
  printReport({ started, engineOk });
  process.exitCode = allErrors().length > 0 ? 1 : 0;
}

main().catch((e) => {
  process.stdout.write(`smoke harness failure: ${describeErr(e)}\nSMOKE RESULT: FAIL (1 errors)\n`);
  process.exitCode = 1;
});
// Safety net: never hang on lingering timers from a stalled bot combat.
setTimeout(() => process.exit(process.exitCode || 0), 60000).unref();
