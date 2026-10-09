# Modding Duskspire

Duskspire's content is plain JavaScript. Every content file is a classic script that registers definitions on
`globalThis.DS`, so adding a card, relic, potion, enemy, encounter, event or status means writing one small object
and registering the file. There is no build step and no module system.

The authoritative rules are in `CONTRACT.md` (the effect language is in its section 3, content shapes in section 6,
statuses in section 4). This guide shows one working example of each content type, the id rules, and where a new file
has to be registered. The examples were checked against the validator in `tools/smoke.js` and the engine tests.

## Ground rules

- Every file has the same wrapper. Content never touches `window`, `document` or `localStorage` at load time.

  ```js
  (function () {
    'use strict';
    const DS = (globalThis.DS = globalThis.DS || {});
    // definitions go here
  })();
  ```

- Ids are lowercase snake_case (`^[a-z][a-z0-9_]*$`) and must be unique across the whole game.
- A `define*` call with a duplicate or missing id prints a warning and is ignored. It never throws.
- Each definition's text fields (`desc`, `text`, `label`, `result`) are written for players. Use literal numbers
  in them (`Deal 7 damage.`), not placeholders, except `{n}` in status descriptions, which is replaced with the
  stack count.
- Icons are one emoji each.
- Effects are data. Use the effect language (`{op: ...}` objects, see `CONTRACT.md` section 3) and only reach for
  `op: 'custom'` when nothing else can express the behaviour.

## Id prefixes

Every definition's id starts with a prefix that says where it lives. The validator enforces this for the files
listed in the `FILE_PREFIX` table in `tools/smoke.js`, and for cards by class through `CLASS_PREFIX` in the same file.

| File | Prefix | Contents |
|---|---|---|
| `cards_berserker.js`, `_2.js`, `_3.js` | `bz_` | Ulfar (Berserker) cards and custom statuses |
| `cards_shade.js`, `_2.js`, `_3.js` | `sh_` | Shade cards and custom statuses |
| `cards_arcanist.js`, `_2.js`, `_3.js` | `ar_` | Mirell (Arcanist) cards and custom statuses |
| `cards_warden.js`, `_2.js`, `_3.js` | `wd_` | Warden cards and custom statuses |
| `cards_tempest.js`, `_2.js` | `tp_` | Kaze (Tempest) cards and custom statuses |
| `cards_occultist.js`, `_2.js` | `oc_` | Hesper (Occultist) cards and custom statuses |
| `cards_artificer.js` | `af_` | Artificer cards and custom statuses |
| `cards_beastcaller.js` | `bc_` | Beastcaller cards and custom statuses |
| `cards_revenant.js` | `rv_` | Revenant cards and custom statuses |
| `cards_colorless.js`, `_2.js`, `_3.js` | `cl_`, `curse_`, `status_` | Colorless cards, curses and status cards |
| `relics_a.js` | `ra_` | Relics |
| `relics_b.js` | `rb_` | Relics |
| `relics_c.js` | `rc_` | Relics |
| `relics_d.js` | `rd_` | Relics |
| `relics_e.js` | `re_` | Relics |
| `trials.js` | `mu_` | Trials (relics flagged `trial: true`) |
| `potions.js` | `po_` | Potions |
| `potions_b.js` | `pb_` | Potions |
| `potions_c.js` | `pc_` | Potions |
| `enemies_act1.js`, `_b.js`, `_c.js` | `a1_` | Act 1 enemies and encounters |
| `enemies_act2.js`, `_b.js`, `_c.js` | `a2_` | Act 2 enemies and encounters |
| `enemies_act3.js`, `_b.js`, `_c.js` | `a3_` | Act 3 enemies and encounters |
| `events_a.js` | `ea_` | Events |
| `events_b.js` | `eb_` | Events |
| `events_c.js` | `ec_` | Events |
| `events_d.js` | `ed_` | Events |
| `events_e.js` | `ee_` | Events |

Rules that go with the table:

- A file ending in `_2`, `_3` or `_b` reuses the prefix of its base file. Its ids must still not collide with ids
  already defined.
- A card's id must start with the prefix of its `class` (`berserker` is `bz_`, `colorless` is `cl_`, `curse` is
  `curse_`, `status` is `status_`).
- An enemy or encounter's id must start with `a<act>_`, matching its `act` field.
- Custom statuses take the prefix of the file that defines them. A custom status id must differ from every card id.
- Built-in status ids (`strength`, `poison`, `barricade`, and the others in `CONTRACT.md` section 4) have no prefix
  and must not be redefined.

## Cards

Example, in the shape of `bz_cleave` in `src/content/cards_berserker.js`. This one is a Shade card, so it goes in a
shade file and uses the `sh_` prefix:

```js
DS.defineCard({
  id: 'sh_example_stab', name: 'Example Stab', class: 'shade', type: 'attack', rarity: 'common',
  cost: 1, target: 'enemy', icon: '🗡️',
  desc: 'Deal 7 damage. Apply 1 Weak.',
  effects: [{ op: 'damage', amount: 7 }, { op: 'apply', status: 'weak', amount: 1 }],
  upgrade: { desc: 'Deal 10 damage. Apply 1 Weak.', effects: [{ op: 'damage', amount: 10 }, { op: 'apply', status: 'weak', amount: 1 }] }
});
```

Fields:

- `class`: `berserker`, `shade`, `arcanist`, `warden`, `tempest`, `occultist`, `artificer`, `beastcaller`,
  `revenant`, `colorless`, `curse` or `status`.
- `type`: `attack`, `skill`, `power`, `curse` or `status`.
- `rarity`: `starter`, `common`, `uncommon`, `rare` or `special`. Special cards are tokens that are never offered
  as rewards.
- `cost`: a number, `'X'` (spend all energy) or `-1` (unplayable).
- `target`: `enemy` (the player clicks an enemy), `all_enemies`, `random_enemy`, `self` or `none`.
- `upgrade`: required for every card except curses and status cards. Its fields replace the base fields when the
  card is upgraded. The game adds a `+` to the name unless the upgrade supplies its own name.
- Optional keywords: `exhaust`, `ethereal`, `innate`, `retain`, and the hooks `onDraw`, `onEndTurnInHand`,
  `onExhaust`, `onDiscard`.
- `playableIf`: an optional condition, written like the `cond` objects in section 3 of `CONTRACT.md`.

## Relics

Example, in the shape of `ra_rusty_buckle` in `src/content/relics_a.js`:

```js
DS.defineRelic({
  id: 'ra_example_ring', name: 'Example Ring', rarity: 'common', icon: '💍',
  desc: 'At the start of each combat, gain 2 Block.',
  flavor: 'Plain, cold, and slightly too big.',
  triggers: { onCombatStart: [{ op: 'block', amount: 2 }] }
});
```

- `rarity`: `starter`, `common`, `uncommon`, `rare`, `boss`, `shop` or `event`. Fight and elite rewards roll only
  common, uncommon and rare relics. Boss rewards use `boss` and the ordinary rarities. Shops use `shop` relics. `event`
  relics stay out of those pools; an event reaches them through `add_relic` with `rarity: 'event'`, and Trials use the
  same rarity.
- `class` (optional): a character id. The relic is then offered only to that character.
- `passive` (optional): any of `energy`, `draw` or `potionSlots`, each a number. A relic needs a `passive` or a
  `triggers` block, or the validator warns.
- `triggers`: the same trigger names as statuses (`onCombatStart`, `onTurnStart`, `onCardPlayed` and so on). Run-level
  relics can also use `onPickup`, `onRest`, `onRoomEnter`, `onCardAdded`, `onChestOpen` and `onShopEnter`.

A trigger can be limited to one turn. From `ra_bent_nail`:

```js
triggers: {
  onTurnStart: { when: { turn: 1 }, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] },
  onTurnEnd: { when: { turn: 1 }, effects: [{ op: 'apply', status: 'strength', amount: -1, to: 'self' }] },
}
```

## Potions

Example, in the shape of `po_fire` in `src/content/potions.js`:

```js
DS.definePotion({
  id: 'po_example_salve', name: 'Example Salve', rarity: 'common', icon: '🧴', color: '#7fb77e', target: 'self',
  desc: 'Heal 6 HP.',
  effects: [{ op: 'heal', amount: 6, to: 'self' }]
});
```

- `rarity`: `common`, `uncommon` or `rare`.
- `target`: `enemy`, `all_enemies`, `self` or `none`. `color` is a hex string used for the potion's bottle.

## Enemies

Example, in the shape of `a1_catacomb_rat` in `src/content/enemies_act1.js`:

```js
DS.defineEnemy({
  id: 'a1_example_slug', name: 'Example Slug', act: 1, tier: 'normal', hp: [14, 18], icon: '🐌', scale: 0.8,
  moves: {
    slime: { name: 'Slime', intent: 'attack_debuff', effects: [
      { op: 'damage', amount: 6 },
      { op: 'apply', status: 'weak', amount: 1, to: 'target' }
    ] },
    harden: { name: 'Harden', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] }
  },
  pattern: { type: 'sequence', moves: ['slime', 'harden'], loop: true }
});
```

- `tier`: `normal`, `elite`, `boss` or `minion`.
- `hp`: a `[min, max]` pair. The game rolls within it. Difficulty multipliers apply on top at spawn.
- `scale`: visual size, from 0.7 to 2.
- `moves`: each move has a `name`, an `intent` and `effects`. Intents are `attack`, `defend`, `buff`, `debuff`,
  `attack_debuff`, `attack_defend`, `attack_buff`, `special`, `sleep` and `unknown`. Inside an enemy move, `to: 'target'`
  means the player.
- `pattern`: either `{type: 'sequence', moves: [...], loop: true}` or
  `{type: 'random', weights: {moveId: 50, ...}, noRepeat: 2}`. For full control, give an `ai: (ctx) => 'moveId'`
  function instead; it receives `turn`, `self`, `combat`, `lastMoves` and `rng`.
- Optional `onSpawn` effects and `triggers`, where the enemy is the owner (`to: 'self'`).

## Encounters

Example, in the shape of `a1_enc_rat_nest` in `src/content/enemies_act1.js`:

```js
DS.defineEncounter({ id: 'a1_enc_example_slug', act: 1, tier: 'easy', name: 'Lone Slug', enemies: ['a1_example_slug'] });
```

- `enemies`: one to four enemy ids. Every id must be defined somewhere, or the validator reports it.
- `tier`: `easy`, `normal`, `elite` or `boss`. Ordinary map fights use `easy` for the first three normal fights of an
  act. Elite rooms draw from `elite`, falling back to `normal` and then `easy`. Boss rooms draw from `boss`
  encounters.

## Events

Example, in the shape of `ea_wishing_well` in `src/content/events_a.js`:

```js
DS.defineEvent({
  id: 'ea_example_spring', name: 'The Dry Spring', act: 'any', icon: '⛲',
  text: 'A stone basin sits under a dead vine. Something glints at the bottom.',
  choices: [
    { label: '[Drink] Heal 8 HP.', effects: [{ op: 'heal', amount: 8 }], result: 'The water is cold and tastes of iron.' },
    { label: '[Dig] Lose 5 HP. Gain 40 gold.', cond: { minHp: 8 }, effects: [{ op: 'lose_hp', amount: 5 }, { op: 'gold', amount: 40 }], result: 'You come up with a fistful of coins and grit.' },
    { label: '[Leave] Walk on.', effects: [], result: 'You leave the basin to its silence.' }
  ]
});
```

- `act`: `'any'` or an array such as `[1, 2]`.
- `choices`: two to four entries. Each has a `label`, a `result` line and run-level `effects`. Put the cost in the
  label (`[Dig] Lose 5 HP...`), since players read the labels before they choose.
- `cond` (optional): `minGold`, `minHp`, `hasRelic` (a relic id) or `hasCardType`. A choice whose condition fails is
  shown greyed out and cannot be picked.
- Keep at least one choice that is always available, as the real events do with a `[Leave]` option.
- Run-level ops available in event effects: `gold`, `heal`, `lose_hp`, `max_hp`, `add_card`, `remove_card`,
  `upgrade_card`, `transform_card`, `add_relic`, `add_potion`, `chance` (`p` from 0 to 1, with `then` and `else`
  effect lists), `fight` (starts a combat after the event) and `custom`.

## Statuses

Example, in the shape of `sh_aura_plague` in `src/content/cards_shade.js`. A custom status is defined in the file of
the class that owns it:

```js
DS.defineStatus({
  id: 'sh_example_drip', name: 'Drip', type: 'buff', icon: '💧', stacks: true,
  desc: 'At the start of your turn, apply {n} Poison to ALL enemies.',
  triggers: {
    onTurnStart: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'all_enemies' }]
  }
});
```

A card then grants it like any other status: `{ op: 'apply', status: 'sh_example_drip', amount: 2, to: 'self' }`.

- `type`: `buff` or `debuff`. `stacks`: `true` for a counted status, `false` for a plain on/off marker.
- `decay`: `'turn_end'` or `'turn_start'` loses one stack per turn. `expire` removes the status entirely at that
  point. Both are optional.
- `mods` (optional): numeric modifiers from the list in `CONTRACT.md` section 4 (`attackDealtAdd`, `attackDealtMul`,
  `attackTakenAdd`, `attackTakenMul`, `blockAdd`, `blockMul`).
- `triggers`: the same trigger names as relics. Inside a status, `{v: 'stacks'}` is the stack count and `to: 'self'` is
  the owner.
- The validator requires `name`, `desc` and `icon`.

## Trials

A Trial is a relic that the player switches on at the character screen. The score multiplier comes from
`trialScore`. Positive values make the run harder. Negative values are boons that make it easier. The game never
offers Trial relics as loot. Example, in the shape of the real definitions in `src/content/trials.js`:

```js
DS.defineRelic({
  id: 'mu_sluggish_blood', name: 'Sluggish Blood', rarity: 'event', icon: '🐌',
  trial: true, trialScore: 50,
  desc: 'You have 2 Energy each turn instead of 3.',
  flavor: 'Every heartbeat arrives a little late.',
  passive: { energy: -1 },
});
```

Use `rarity: 'event'`, no `class`, the `mu_` prefix, and only the relic triggers and passives that already exist.

## Adding a new file

Suppose you add `src/content/cards_example.js`, a file of new shade cards. Do these steps in order.

1. Create the file with the wrapper from the top of this guide. Give its ids the prefix of the file that owns them
   (`sh_` for shade cards). If you add a new prefix, add a row to the `FILE_PREFIX` table in `tools/smoke.js`.
2. Add a script tag to `index.html`. Content files load in one block, after the engine files and before the `src/ui/`
   files. Put the new tag at the end of that block, or where the contract's load order says, and keep the order the
   same in every list below.

   ```html
   <script src="src/content/cards_example.js"></script>
   ```

3. Add the same path to the `LOAD_ORDER` array in `tools/smoke.js`, at the same position. The validator compares
   the script tags in `index.html` with that array, in order, and reports an error if they differ.
4. Add the same path to the `LOAD` array in `tools/tests.js` and in `tools/balance.js`, at the same position.
5. Run the checks, described in the README: `node tools/smoke.js`, `node tools/tests.js`, and
   `node tools/balance.js --runs=20`.

### Adding a character

A character needs more than a file. Its class must be known to the validator.

- `defineCharacter({id, name, title, desc, hp, gold, icon, color, starterDeck, starterRelic})`. The starter deck must
  hold exactly 11 card ids, and the starter relic must be a defined relic id.
- In `tools/smoke.js`, add the character to `CHARACTER_FILES` (its id maps to its card file) and to `CLASS_PREFIX`,
  and add its id to `CARD_CLASSES`. The validator reports a character as undefined when its card file exists but no
  `defineCharacter` call is present.
