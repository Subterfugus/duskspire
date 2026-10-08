# DUSKSPIRE — shared build contract

Duskspire is a single-player roguelike deckbuilder (Slay the Spire style). Plain JavaScript, **no build step, no
frameworks, no npm runtime deps, no ES modules**. Every file is a classic script wrapped in an IIFE that attaches to one
global: `globalThis.DS`. The same files must load in a browser (`<script>` tags) and in Node (`vm`/`require`) for
headless tests — so **engine and content files must never touch `window`, `document`, or `localStorage` at load
time** (only UI files may use the DOM; `run.js` must guard `localStorage` with `typeof localStorage !== 'undefined'`).

Many agents are building this in parallel, each owning different files. **Only write the files you own.** Code against
this contract exactly — names, signatures and shapes here are law. If something is not specified, choose the simplest
behaviour and keep it internal to your file.

Every file starts like this:

```js
(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});
  // ...
})();
```

## 1. Files, owners, load order

`index.html` loads these in exactly this order:

```
src/engine/core.js            registries, define*, events, hooks, rng, helpers
src/engine/statuses.js        built-in statuses
src/engine/combat.js          DS.Combat
src/engine/run.js             DS.Run (run state, map, rewards, shop, rest, events, save)
src/content/cards_berserker.js
src/content/cards_shade.js
src/content/cards_arcanist.js
src/content/cards_warden.js
src/content/cards_colorless.js   colorless + curses + status cards
src/content/relics_a.js
src/content/relics_b.js
src/content/potions.js
src/content/enemies_act1.js
src/content/enemies_act2.js
src/content/enemies_act3.js
src/content/events_a.js
src/content/events_b.js
src/ui/kit.js                 DOM helpers, card renderer, tooltips, modal, screen router, card picker
src/ui/audio.js               synthesized SFX/music, self-wired to DS.events
src/ui/fx.js                  floating numbers, shakes, flashes, self-wired to DS.events
src/ui/screens.js             menu, charselect, map, reward, shop, rest, event, treasure, bossrelic, gameover, victory, compendium, top bar
src/ui/combat_ui.js           the combat screen
src/ui/boot.js                wires DS.hooks to UI, then DS.ui.go('menu')
styles.css                    (owned by kit.js agent) all CSS
```

Also: `package.json`, `main.js` (Electron shell), `tools/smoke.js` (headless validation).

**ID prefixes** (ids are never shown to players; they must be globally unique, lowercase snake_case):
berserker `bz_`, shade `sh_`, arcanist `ar_`, warden `wd_`, colorless `cl_`, curses `curse_`, status cards `status_`,
relics_a `ra_`, relics_b `rb_`, potions `po_`, act N enemies/encounters `a1_`/`a2_`/`a3_`, events_a `ea_`, events_b `eb_`.
Statuses you define yourself use your file's prefix too. Built-in status ids (section 4) have no prefix.

## 2. core.js — registries and helpers

```js
DS.cards = {}; DS.relics = {}; DS.potions = {}; DS.enemies = {}; DS.encounters = {};
DS.events_ = {};      // event definitions (DS.events is the event bus!)
DS.statuses = {}; DS.characters = {};

DS.defineCard(def)  DS.defineRelic(def)  DS.definePotion(def)  DS.defineEnemy(def)
DS.defineEncounter(def)  DS.defineEvent(def)  DS.defineStatus(def)  DS.defineCharacter(def)
```
Each `define*` stores `def` under `def.id`. A duplicate or missing id does `console.warn` and is ignored (never throws).

```js
DS.events.on(name, fn) -> unsubscribe fn      DS.events.off(name, fn)      DS.events.emit(name, payload)
DS.hooks = {                       // defaults are headless-safe; boot.js overrides them with UI versions
  delay: async (ms) => {},                                   // pacing
  chooseCards: async ({cards, count, prompt, optional}) => cards.slice(0, count),   // pick from combat cards
  chooseDeckCard: async ({prompt, filter}) => first run.deck instance passing filter(inst) or null,
};
DS.rng = { seed(n), next() /* float [0,1) */, int(min, max) /* inclusive */, pick(arr), shuffle(arr) /* in place, returns arr */, chance(p) };
DS.uid() -> unique string
DS.getCardData(inst) -> resolved card definition for a card instance {id, upgraded}: a shallow copy of the def with
   `def.upgrade` fields merged over it when inst.upgraded, and name + '+' (unless upgrade supplies a name). Always has
   `effects` (array), `cost`, `desc`, `id`, `upgraded`.
DS.cardPool({class, rarity, type}) -> array of card defs matching all provided filters (never starter/special/curse/status unless asked by rarity/class)
DS.relicPool({rarity, class}) -> relic defs (class-specific relics only for that class or class undefined)
DS.OPS (array of valid op names)   DS.TRIGGERS (array of valid trigger names)
```

## 3. The effect DSL (used by cards, potions, enemy moves, status/relic triggers)

An **effect** is `{op, ...}`. An **effects list** is an array of effects executed in order. All content should be
expressed in this DSL; only use `custom` when truly impossible otherwise.

### Values
Anywhere a number is expected (`amount`, `times`), you may give a number or a Value object:
`{v: SOURCE, mul: 1, add: 0, status: 'id', of: 'self'|'target'}` → `floor(source * mul) + add`. Sources:
`x` (energy spent by an X-cost card), `stacks` (stacks of the status/relic counter owning this trigger), `block` (block of `of`, default self),
`hp`, `max_hp`, `missing_hp` (of `of`), `status` (stacks of `status` on `of`), `hand` (cards in hand), `draw_pile`,
`discard_pile`, `exhaust_pile`, `deck_size`, `energy`, `turn`, `cards_played` (this turn), `attacks_played` (this turn),
`enemies` (living enemy count), `gold`.

### Targets (`to`)
`'target'` (the chosen enemy for a card; for enemy moves: the player; in triggers: the contextual other party — the
attacker for onAttacked, the victim for onAttack, the played card's target else a random enemy for onCardPlayed),
`'self'` (the acting unit / owner of the status / the player for relics), `'all_enemies'` (all opponents of the acting unit),
`'random_enemy'`, `'player'`. Defaults: `damage`/`apply` default to the card's `target` field mapping (`enemy`→target,
`all_enemies`→all_enemies, `random_enemy`→random_enemy, `self`/`none`→self) and to `'target'` for enemy moves;
`block`/`heal`/`draw`/`energy` default to `'self'`.

### Combat ops
| op | fields | meaning |
|---|---|---|
| `damage` | amount, times=1, to, onKill:[effects] | attack damage (strength/weak/vulnerable apply, block absorbs). `onKill` runs if this kills. |
| `lose_hp` | amount, to | HP loss ignoring block and modifiers |
| `block` | amount, to | gain block (dexterity/frail apply only when a card grants it to self) |
| `apply` | status, amount, to | apply stacks of a status (negative amount reduces) |
| `remove_status` | status, to | remove a status entirely |
| `multiply_status` | status, factor, to | multiply stacks |
| `heal` | amount, to | heal, capped at max hp |
| `draw` | amount | draw cards (player only) |
| `energy` | amount | gain energy (player only) |
| `discard` | amount, random=false | discard from hand; player chooses unless random. amount `'all'` allowed |
| `exhaust` | amount, random=false, from='hand' | exhaust from hand; amount `'all'` allowed. Optional `type:'attack'` etc. filter, `notType` |
| `add_card` | card, to:'hand'\|'draw'\|'discard', amount=1, upgraded=false | create cards in combat. `card` may be `'random'` with optional `class`, `type`, `rarity` filters |
| `upgrade_hand` | amount (number or `'all'`) | upgrade cards in hand for this combat |
| `gold` | amount | gain/lose gold |
| `max_hp` | amount | change player max hp (and hp by same amount if positive) |
| `repeat` | times, effects | run effects `times` times |
| `if` | cond, then, else | cond = `{left: Value, cmp: '>'\|'>='\|'<'\|'<='\|'=='\|'!=', right: Value}` |
| `summon` | enemy (id), amount=1 | enemy moves only: add enemies (max 5 on field) |
| `custom` | fn: `async (ctx) => {}` | escape hatch. `ctx = {combat, run, source, target, card, x}` |

### Run-level ops (event choices, relic `onPickup`, outside combat)
`gold`, `heal`, `lose_hp`, `max_hp` as above (they affect `DS.run`), plus:
| op | fields |
|---|---|
| `add_card` | card: id or `'random'` (+ optional `class`, `rarity`, `type`; class defaults to the run's character), upgraded, amount |
| `remove_card` | amount=1, random=false (else player chooses), optional `type` filter |
| `upgrade_card` | amount=1 (or `'all'`), random=false |
| `transform_card` | amount=1, random=false — replace with a random card of the character's class |
| `add_relic` | relic: id or `'random'`, optional rarity |
| `add_potion` | potion: id or `'random'` |
| `chance` | p (0..1), then:[effects], else:[effects], thenResult:'text', elseResult:'text' |
| `fight` | encounter: id — start this combat after the event (normal rewards) |
| `custom` | fn: `async ({run}) => {}` |

## 4. Statuses

```js
DS.defineStatus({
  id, name, desc: 'Text. Use {n} for stack count.', type: 'buff'|'debuff', icon: '💪',
  stacks: true,                 // false = boolean status (amount ignored, shown without number)
  decay: 'turn_end'|'turn_start'|null,   // lose 1 stack at end/start of owner's turn; removed at 0
  expire: 'turn_end'|'turn_start'|null,  // removed entirely at that time
  mods: { attackDealtAdd, attackDealtMul, attackTakenAdd, attackTakenMul, blockAdd, blockMul },
        // *Add are per stack; *Mul are flat multipliers while status is present
  triggers: { onTurnStart: [effects], onAttacked: {when:{...}, effects:[...]} , ... }
});
```
Removed when stacks reach 0 (statuses that may go negative: `strength`, `dexterity`). In a status's trigger effects,
`{v:'stacks'}` is that status's stack count, `'self'` is its owner.

**Built-ins (statuses.js defines exactly these ids; everyone may use them):**
`strength` (+1 attack dmg/stack), `dexterity` (+1 block/stack), `weak` (deal 25% less attack dmg; decays),
`vulnerable` (take 50% more attack dmg; decays), `frail` (gain 25% less block; decays), `poison` (turn start: lose
{n} HP, then −1), `burn` (turn end: lose {n} HP, then −1), `regen` (turn end: heal {n}, then −1), `thorns` (when
attacked, deal {n} to attacker), `plated_armor` (turn end: gain {n} block; −1 when losing HP from an attack),
`metallicize` (turn end: gain {n} block), `artifact` (negate next debuff, −1), `intangible` (all damage/HP loss
reduced to 1; decays), `barricade` (block not removed at turn start; non-stacking), `ritual` (turn end: +{n}
strength), `energized` (next turn start: +{n} energy, then removed), `draw_next` (next turn start: draw {n} more, then
removed), `next_turn_block` (next turn start: gain {n} block, then removed), `strength_down` (turn end: lose {n}
strength, then removed), `dexterity_down` (same for dexterity), `no_draw` (cannot draw; expires turn end), `entangle`
(cannot play attacks; expires turn end), `buffer` (prevent next HP loss, −1), `rage` (whenever you play an attack gain
{n} block; expires turn end), `double_tap` (next {n} attacks are played twice), `vigor` (next attack deals +{n}; then
removed), `lock_on` (take 50% more attack damage... same as vulnerable but stacks separately; decays), `shackled`
(regain {n} strength at turn end, then removed), `mark` (no innate effect; counter usable by content), `curl_up` (first
time attacked gain {n} block, then removed), `enrage` (whenever the player plays a skill gain {n} strength — enemy buff),
`angry` (when attacked gain {n} strength), `split_ready` (no innate effect; marker).

## 5. Triggers (statuses and relics)

`triggers: { NAME: effects[] | {when, every, oncePerTurn, oncePerCombat, effects} }`

Names: `onCombatStart`, `onCombatEnd` (victory only), `onTurnStart`, `onTurnEnd`, `onCardPlayed`, `onAttack` (owner
lands an attack hit), `onAttacked` (owner is hit by an attack), `onDamaged` (owner loses HP, any source), `onBlockGained`,
`onBlockBroken` (owner's block reduced to 0 by an attack), `onCardDrawn`, `onCardExhausted`, `onCardDiscarded`
(discarded by an effect, not end of turn), `onShuffle`, `onApplyDebuff` (owner applies a debuff to an opponent),
`onKill` (owner kills a unit), `onEnemyDeath` (any enemy dies), `onDeath` (owner dies), `onHeal`, `onPotionUsed`,
`onGoldGained`.
Relic-only, run level (run-level ops only): `onPickup`, `onRest`, `onRoomEnter` (ctx.roomType), `onCardAdded`, `onChestOpen`, `onShopEnter`.

`when`: `{cardType:'attack'|'skill'|'power'|'curse'|'status', turn: N, hpBelowPct: N, hpAbovePct: N, costAtLeast: N, roomType: 'elite'|..., fromAttack: true|false}` (all must hold). `fromAttack` (boolean) matches whether the trigger came from an attack hit (used by `onDamaged`, e.g. plated_armor).
`every: N` fires on every Nth occurrence (counter resets each combat; the relic UI shows the counter).
`oncePerTurn`, `oncePerCombat`: booleans.

## 6. Content definitions

```js
DS.defineCard({
  id: 'bz_cleave', name: 'Cleave', class: 'berserker', // berserker|shade|arcanist|warden|colorless|curse|status
  type: 'attack',            // attack|skill|power|curse|status
  rarity: 'common',          // starter|common|uncommon|rare|special (special = tokens, never offered)
  cost: 1,                   // number, or 'X', or -1 for unplayable
  target: 'all_enemies',     // enemy (needs a click on an enemy) | all_enemies | random_enemy | self | none
  icon: '🪓',                // one emoji used as card art
  desc: 'Deal 8 damage to ALL enemies.',     // literal numbers, written for players
  effects: [{op: 'damage', amount: 8}],
  upgrade: {desc: 'Deal 11 damage to ALL enemies.', effects: [{op: 'damage', amount: 11}]},  // any fields to override; REQUIRED for non-curse/status cards
  exhaust: false, ethereal: false, innate: false, retain: false,   // optional keywords
  onDraw: [effects], onEndTurnInHand: [effects], onExhaust: [effects], onDiscard: [effects],   // optional
  playableIf: cond,          // optional (section 3 cond)
});

DS.defineCharacter({id: 'berserker', name, title, desc, hp: 80, gold: 99, icon: '🪓', color: '#c0392b',
  starterDeck: ['bz_strike', ...10 ids], starterRelic: 'bz_relic_id'});

DS.defineRelic({id, name, desc, flavor, rarity /* starter|common|uncommon|rare|boss|shop|event */, icon,
  class: undefined | 'berserker'..., passive: {energy: 1, draw: 1, potionSlots: 1}, triggers: {...}});

DS.definePotion({id, name, desc, rarity /* common|uncommon|rare */, icon, color: '#hex',
  target: 'enemy'|'all_enemies'|'self'|'none', effects: [...]});

DS.defineEnemy({id, name, act: 1, tier: 'normal'|'elite'|'boss'|'minion', hp: [min, max], icon: '🐀', scale: 1 /* visual size 0.7..2 */,
  onSpawn: [effects],                                   // optional, 'self' = the enemy
  triggers: {...},                                      // optional, same trigger names (owner = enemy)
  moves: { bite: {name: 'Bite', intent: 'attack', effects: [{op: 'damage', amount: 7}]}, ... },
  // intent: attack|defend|buff|debuff|attack_debuff|attack_defend|attack_buff|special|sleep|unknown
  pattern: {type: 'sequence', moves: ['bite','growl'], loop: true}
         | {type: 'random', weights: {bite: 60, growl: 40}, noRepeat: 2 /* max consecutive same move */, first: 'growl' /* optional */}
         | undefined,
  ai: (ctx) => 'moveId',  // optional, overrides pattern. ctx = {turn (1-based per enemy), self, combat, lastMoves: [ids], rng: DS.rng}
});
DS.defineEncounter({id, act: 1, tier: 'easy'|'normal'|'elite'|'boss', name, enemies: ['a1_rat', 'a1_rat']});  // 1..4 enemies

DS.defineEvent({id, name, act: 'any' | [1,2], icon, text: 'Narration...',
  choices: [{label: '[Pray] Heal 20 HP.', cond: {minGold: 50, minHp: 10, hasRelic: 'id', hasCardType: 'curse'} /* optional */,
             effects: [run-level effects], result: 'Outcome narration.'}]});   // 2-4 choices; one should always be available
```

**Fixed shared ids** (cards_colorless.js defines them; anyone may reference them):
curses: `curse_regret`, `curse_pain`, `curse_doubt`, `curse_injury`, `curse_decay`, `curse_clumsy`, `curse_parasite`, `curse_writhe`, `curse_shame`, `curse_normality`.
status cards: `status_wound`, `status_dazed`, `status_burn`, `status_slimed`, `status_void`.
Character ids: `berserker`, `shade`, `arcanist`, `warden`.

Balance reference: player has 3 energy, draws 5, ~70-80 HP. Starter Strike = 6 dmg for 1, Defend = 5 block for 1.
Commons ≈ 8-9 dmg or 7-8 block for 1 energy plus a small rider. Act 1 normal enemies: 12-50 HP, hit for 5-12; elites
80-110 HP; bosses 140-250 HP. Act 2 ≈ ×1.7 hp and +50% dmg; act 3 ≈ ×2.6 hp and +100% dmg (bosses 400-600 HP).

## 7. Combat (combat.js)

```js
DS.combat   // the current DS.Combat or null
const c = new DS.Combat(run, encounterId, {fromEvent: bool});   // also sets DS.combat = c
c.player  = {isPlayer: true, uid: 'player', name, hp, maxHp, block, statuses: {id: stacks}, energy, maxEnergy}
c.enemies = [{isPlayer: false, uid, id, def, name, hp, maxHp, block, statuses, dead, intent: {moveId, name, type, damage /* per hit after modifiers or null */, times}}]
c.hand, c.drawPile, c.discardPile, c.exhaustPile   // arrays of combat cards
//   combat card: {uid, id, upgraded, data /* DS.getCardData */, cost /* current cost: number or 'X' or -1 */}
c.turn (1-based), c.phase: 'player'|'enemy'|'won'|'lost', c.encounter (def), c.busy (bool, true while resolving)
await c.start()                      // spawn, shuffle, innate, onCombatStart relics, first player turn
c.canPlay(card) -> {ok: bool, reason: string}
await c.playCard(card, targetEnemyOrNull)
await c.endTurn()                    // end player turn, run enemy turn, begin next player turn
await c.usePotion(slotIndex, targetEnemyOrNull)   // removes potion from run.potions[slot] (sets null)
c.livingEnemies() -> array
await c.runEffects(effects, {source, target, card, x, stacks})   // public: the interpreter
```
Turn rules: player turn start → remove block (unless barricade), energy = 3 + relic `passive.energy` (+energized),
draw 5 + relic `passive.draw`, fire onTurnStart. Turn end → onTurnEnd, `onEndTurnInHand`, exhaust ethereal, discard
the rest (except retain), decay player statuses. Enemy phase: for each living enemy in order: remove its block, its
onTurnStart, perform its intent move (`await DS.hooks.delay(450)` between enemies), its onTurnEnd + decay; then all
enemies pick next intent. Draw pile empty → shuffle discard into draw (emit shuffle). Hand limit 10. When all enemies
dead → phase 'won', onCombatEnd, write `run.hp = player.hp`. Player hp ≤ 0 → phase 'lost'.
Damage: `floor((base + strength + ΣattackDealtAdd) × ΠattackDealtMul × ΠattackTakenMul)` min 0, then block, then HP.

Events emitted on `DS.events` (payloads are plain objects):
`combat:start {combat}`, `combat:update {}` (after ANY state change — UI re-renders on this), `combat:turnStart {side:'player'|'enemy', turn}`,
`combat:cardPlayed {card, target}`, `combat:damage {target, amount /* hp lost */, blocked, source}`,
`combat:block {target, amount}`, `combat:heal {target, amount}`, `combat:status {target, status, amount}`,
`combat:enemyMove {enemy, move}`, `combat:enemyDied {enemy}`, `combat:shuffle {}`, `combat:cardDrawn {card}`,
`combat:cardExhausted {card}`, `combat:potionUsed {potion}`, `combat:end {result: 'won'|'lost'}`.
`target`/`enemy`/`source` are the unit objects (use `.uid`).

## 8. Run (run.js)

```js
DS.run  // current run or null:
{ character /* id */, hp, maxHp, gold, deck: [{uid, id, upgraded}], relics: [{id, counter}], potions: [id|null, id|null, id|null],
  act /* 1..3 */, floor, map, nodeId /* current node or null */, seed, stats: {fights, elites, bosses, turns, cardsPlayed, damageDealt, goldEarned}, over: false, won: false }
map: { nodes: {id: node}, rows: [[nodeId,...] x 15 rows], bossId }   node: {id, row, col /* 0..6 */, type, next: [nodeIds], visited}
   type: 'fight'|'elite'|'rest'|'shop'|'event'|'treasure'|'boss'. Row 0 all fights; row 8 treasure; row 14 rest; then boss node.

DS.Run.start(characterId, seed?)           // creates DS.run with starter deck/relic, generates act 1 map
DS.Run.availableNodes() -> [node]          // row 0 nodes if nodeId null, else current node's `next`
DS.Run.enterNode(nodeId) -> room           // marks visited, floor++, fires onRoomEnter; room is one of:
     {type:'combat', encounterId, tier} | {type:'event', eventId} | {type:'shop', shop} | {type:'rest'} | {type:'treasure', relicId, gold}
     shop = {cards:[{inst:{id,upgraded}, price, sold}], relics:[{id, price, sold}], potions:[{id, price, sold}], removePrice, removeUsed}
DS.Run.generateRewards(tier) -> {gold, cardChoices: [{id, upgraded}] x3, potion: id|null, relic: id|null}   // elite/boss/treasure give relics
DS.Run.addGold(n)  DS.Run.addCard(id, upgraded) -> inst  DS.Run.removeCard(uid)  DS.Run.upgradeCard(uid) -> bool
DS.Run.addRelic(id)  /* fires onPickup */   DS.Run.hasRelic(id)   DS.Run.addPotion(id) -> bool (false if full)   DS.Run.discardPotion(slot)
DS.Run.potionSlots() -> number (3 + passives)
DS.Run.buy(kind /* 'card'|'relic'|'potion' */, index) -> bool        DS.Run.shopRemove(uid) -> bool
DS.Run.rest() -> hp healed (30% max hp, fires onRest)
DS.Run.getEvent(eventId) -> {def, choices: [{label, enabled, index}]}
await DS.Run.chooseEvent(eventId, index) -> {text, fightEncounterId: id|null}
await DS.Run.runEffects(effects, ctx)      // run-level interpreter
DS.Run.bossRelicChoices() -> [relicId x3]
DS.Run.nextAct() -> bool                   // false if that was the final act (run.won = true)
DS.Run.fire(triggerName, ctx)              // fire run-level relic triggers
DS.Run.save()  DS.Run.load() -> bool  DS.Run.hasSave() -> bool  DS.Run.clearSave()    // localStorage key 'duskspire_save'
DS.Run.end(won)                            // run.over = true, clear save
```
Events emitted: `run:update {}` after any run state change (top bar re-renders on this), `run:gold {amount}`,
`run:relic {id}`, `run:card {id}`.

## 9. UI

`index.html` has `<div id="topbar"></div><div id="app"></div><div id="overlay"></div>`. Design target 1280×720+, dark
fantasy look, emoji as art. CSS class prefix `ds-`.

kit.js:
```js
DS.ui.el(tag, attrs /* {class, text, html, onclick, style, dataset:{}, ...} */, children /* array|node|string */) -> HTMLElement
DS.ui.registerScreen(name, {enter(params, rootEl), exit()})    // rootEl = fresh <div class="ds-screen ds-screen-NAME"> inside #app
DS.ui.go(name, params)                                         // exit current, clear #app, enter new; DS.ui.current = name
DS.ui.renderCard(cardData /* DS.getCardData result or combat card .data */, {cost, small, onclick, disabled}) -> HTMLElement (.ds-card)
DS.ui.tooltip(el, htmlOrFn)        DS.ui.describe(text) -> html with keyword highlighting
DS.ui.statusChips(unit) -> HTMLElement of status icons with tooltips
DS.ui.modal({title, content /* node|html */, buttons: [{label, onclick, primary}], dismissable}) -> {close()}
DS.ui.cardPicker({cards /* [{data, ref}] */, count, prompt, optional}) -> Promise<ref[]>
DS.ui.showDeck(title, instances)   // modal grid of cards
DS.ui.toast(text)
```
Screens (screens.js) and params: `menu`, `charselect`, `map`, `reward {tier, fromEvent}`, `shop {shop}`, `rest`,
`event {eventId}`, `treasure {relicId, gold}`, `bossrelic`, `gameover`, `victory`, `compendium`.
combat_ui.js registers `combat {encounterId, tier, fromEvent}`: creates `new DS.Combat(DS.run, encounterId)`, awaits
`start()`, renders on `combat:update`. On `combat:end` won → `DS.ui.go('reward', {tier, fromEvent})`; lost →
`DS.Run.end(false); DS.ui.go('gameover')`. After rewards: boss → `bossrelic` → `DS.Run.nextAct()` ? `map` : `victory`; else `map`.
Map screen calls `DS.Run.enterNode` and routes by room type. `DS.Run.save()` is called on entering the map screen.

Combat DOM contract (fx.js relies on it): the player element has `data-combatant="player"`, each enemy element has
`data-combatant="<enemy.uid>"`.
Top bar (screens.js): `DS.ui.refreshTopBar()`; shows HP, gold, floor/act, potions, relics (with tooltips + counters), deck button.
Clicking a potion emits `ui:potionClick {slot}`; combat_ui handles it during combat (targeting if needed), otherwise
screens.js offers to discard it.
audio.js: `DS.audio.play(name)`, `DS.audio.setMuted(bool)`, `DS.audio.muted`; subscribes to DS.events on its own. Must lazily create
the AudioContext on first user gesture.

## 10. Version 2 additions (this section overrides anything above it that conflicts)

The game already works end to end. V2 adds content, features and polish. Existing files have owners again for this
round; **read the current file before changing it and preserve working behaviour**.

### 10.1 New files and load order
`index.html` and `tools/smoke.js` load, after `events_b.js` and in this order:
`cards_tempest.js`, `cards_occultist.js`, `cards_berserker_2.js`, `cards_shade_2.js`, `cards_arcanist_2.js`,
`cards_warden_2.js`, `relics_c.js`, `potions_b.js`, `enemies_act1_b.js`, `enemies_act2_b.js`, `enemies_act3_b.js`,
`events_c.js` (all under `src/content/`). `src/ui/art.js` loads right after `src/ui/kit.js`.
New id prefixes: tempest `tp_`, occultist `oc_`, relics_c `rc_`, potions_b `pb_`, events_c `ec_`.
`src/content/cards_colorless_2.js` (the colorless expansion: cards `cl_`, custom statuses `cl_`, curses `curse_`, status cards
`status_`) is also part of the v2 load order. It loads directly after `cards_colorless.js`, so the full content order in
`index.html`, `tools/smoke.js`, `tools/tests.js` and `tools/balance.js` is: `cards_colorless.js`, `cards_colorless_2.js`,
`relics_a.js`, ... (section 1 otherwise unchanged).

**Behaviour decisions made in the v2 integration pass** (these override earlier wording):
- **Combat start.** `start()` runs `onCombatStart` before the first player turn. Turn 1 keeps the block and energy those
  effects granted (`_beginPlayerTurn(first)`); only later turns zero block and reset energy.
- **Draw-pile placement.** `add_card` with `to: 'draw'` (and any other draw-pile placement) inserts at a uniformly random
  position in the draw pile, not on top.
- **double_tap.** A replayed attack replays its whole effects list, riders included (as in Slay the Spire). Each played
  attack consumes one stack. `onCardPlayed` fires once per card.
- **Value `of:'target'`.** Reads the target when the context has one. When it has none (random_enemy, none and all_enemies
  cards), it reads 0 and logs a one-time warning for non-enemy cards. Enemy-targeted cards previewed without an enemy read 0 silently.
- **Map and stale rooms.** Listing the map (`DS.Run.availableNodes()`, which the map screen calls) closes any open room
  that `closeRoom()` allows (everything except combat rooms and the boss reward / boss relic steps), so Continue no longer
  returns to a room the player already left. Screens should still call `DS.Run.closeRoom()` when leaving a room.
- **Difficulty.** `enemyHpMul`, `eliteHpMul` and `bossHpMul` apply at spawn, and `enemyDmgMul` applies to enemy move damage
  (including intent numbers). All read `run.difficulty` and default to 1.
`cards_<class>_2.js` reuse their class prefix (`bz_`, `sh_`, `ar_`, `wd_`) and `enemies_actN_b.js` reuse `aN_` —
their ids must not collide with ids in the existing file for that class/act (read it first).
New character ids: `tempest`, `occultist`. Starter decks have 11 cards (5 Strikes, 4 Defends, 2 signature cards).

### 10.2 Settings (core.js)
```js
DS.settings.get(key, fallback)   DS.settings.set(key, value)   // persisted in localStorage 'duskspire_settings' (guarded for Node); set emits 'settings:update' {key, value}
```
Keys: `speed` (1 | 2 | 3, default 1 — `DS.hooks.delay(ms)` in boot.js waits `ms / speed`), `volume` (0..1), `muted` (bool),
`music` (bool), `confirmEndTurn` (bool, default false: ask before ending a turn with playable cards and energy left),
`screenShake` (bool, default true), `showLog` (bool, default true), `fullscreen` (bool).

### 10.3 Combat additions (combat.js)
```js
c.preview(card, enemyOrNull) -> {damage: number|null, times: number, block: number|null}
   // what the card's first 'damage' effect would deal per hit to that enemy right now (strength, weak, vulnerable, vigor ... applied;
   // null if it has no damage effect; if enemyOrNull is null use no target modifiers) and what its first self 'block' effect would grant (dexterity/frail applied)
c.log   // array of {turn, text} strings describing what happened (card played, damage dealt, status applied, enemy move, deaths), newest last, capped at 200;
        // 'combat:log' {entry} is emitted for each
```
Difficulty: at spawn every enemy's max hp is multiplied by `run.difficulty.enemyHpMul` (and additionally by
`eliteHpMul` / `bossHpMul` for those tiers); enemy attack damage base is multiplied by `run.difficulty.enemyDmgMul`.
All default to 1 when `run.difficulty` is missing.

### 10.4 Run additions (run.js)
```js
DS.Run.start(characterId, opts)      // opts: {seed, ascension} (a bare number is still accepted as seed)
run.ascension (0..10), run.difficulty = {enemyHpMul, enemyDmgMul, eliteHpMul, bossHpMul, healMul, goldMul, shopPriceMul, startCurses, lessRestHeal ...}
DS.Run.ASCENSIONS = [{level: 1, name, desc}, ... 10]   // cumulative modifiers; level n applies 1..n
DS.Run.score(run) -> number
run.lastEncounterId                  // set when a combat starts
DS.Meta   // persistent meta-progression, localStorage 'duskspire_meta' (guarded for Node)
DS.Meta.get() -> {runs, wins, bestScore, perChar: {id: {runs, wins, maxAscensionWon}}, history: [{character, won, act, floor, ascension, score, date, killedBy /* encounter name or null */, deckSize, relics: [ids], turns}] /* newest first, max 50 */,
                  seen: {cards: {id: true}, relics: {}, enemies: {}, potions: {}}, achievements: {id: isoDate}}
DS.Meta.recordRun(run)               // called by DS.Run.end
DS.Meta.maxAscension(characterId) -> highest selectable ascension (0 at first; winning at level n unlocks n+1, up to 10)
DS.Meta.markSeen(kind, id)           // kind: 'cards'|'relics'|'enemies'|'potions'
DS.Meta.ACHIEVEMENTS = [{id, name, desc, icon}]   DS.Meta.unlock(id) -> bool (true if newly unlocked; emits 'meta:achievement' {id})
DS.Meta.reset()
```
Leaving the game inside ANY room (not just fights) and choosing Continue must return the player to that room, not skip it.
A character with zero wins on ascension 0 can still be played; nothing is locked except ascension levels.

### 10.5 UI additions
Screens (screens.js): `history` (run history, lifetime stats, achievements), `settings`, `howto` (how to play + keyword
glossary). `charselect` gains an ascension picker (0..DS.Meta.maxAscension(char)) and an optional seed field. Menu links to all.
Compendium gains a search box and shows undiscovered entries dimmed (per DS.Meta.get().seen).
combat_ui.js: uses `c.preview` to show live damage/block numbers on hand cards (badge) and over the hovered/targeted enemy,
adds `ds-tier-<tier>` to enemy elements, a collapsible combat log panel fed by 'combat:log', drag-to-play with a targeting arrow
(click-to-play still works), honours `confirmEndTurn`, and keeps the whole hand visible at 1280x720.
art.js (`DS.art`, every call must be safe when given unknown input; UI files call it only if `DS.art` exists):
```js
DS.art.cardArt(cardData) -> HTMLElement    // procedural SVG illustration for a card (uses class color, type, rarity, and the card's emoji as centrepiece)
DS.art.unitArt(def, {size}) -> HTMLElement // portrait for an enemy def or character def: emoji centrepiece on a procedural SVG aura/silhouette keyed by tier/act/color
DS.art.applyBackdrop(rootEl, name, act)    // name: 'menu'|'map'|'combat'|'shop'|'rest'|'event'|'treasure'|'victory'|'gameover'; paints an atmospheric layered background (act 1 catacombs, act 2 drowned city, act 3 summit)
DS.art.relicIcon(def) -> HTMLElement   DS.art.potionIcon(def) -> HTMLElement
```
New CSS classes (styles.css owns their rules; UI files just use them): `.ds-tier-elite`, `.ds-tier-boss`,
`.ds-preview-badge`, `.ds-combat-log`, `.ds-log-entry`, `.ds-target-arrow`, `.ds-card-dragging`, `.ds-asc-picker`,
`.ds-asc-pip` (+`-active`, `-locked`), `.ds-history-row` (+`-won`, `-lost`), `.ds-stat-tile`, `.ds-achievement`
(+`-locked`), `.ds-settings-row`, `.ds-slider`, `.ds-toggle` (+`-on`), `.ds-howto`, `.ds-search-input`, `.ds-tab`
(+`-active`), `.ds-badge`, `.ds-art`, `.ds-backdrop`, `.ds-undiscovered`.
