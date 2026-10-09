export const meta = {
  name: 'fix-duskspire',
  description: 'Duskspire: smoke-test fix loop, UI integration review, final check (Haiku)',
  phases: [{ title: 'Smoke-fix', model: 'haiku' }, { title: 'Integrate', model: 'haiku' }, { title: 'Final check', model: 'haiku' }],
}

const ROOT = '<absolute path to the project folder>';
const H = { model: 'haiku', effort: 'high' }

const PRE = `You are one of ~20 engineers building DUSKSPIRE, a Slay-the-Spire-style roguelike deckbuilder, in parallel.
Project root (Windows): ${ROOT}
FIRST: Read ${ROOT}\\CONTRACT.md completely and carefully. It is the shared contract: every name, signature, id prefix, data shape and op in it is law. Other agents are writing the other files right now against the same contract, so those files may not exist yet — do not wait for them, do not write them, and do not edit files you do not own.
Rules:
- A previous attempt at your task may have been interrupted. If any of YOUR FILES already exist, read them first and complete or rewrite them rather than assuming they are finished.
- Only create/modify the files listed under YOUR FILES. Use absolute paths.
- Plain classic-script JavaScript in an IIFE attaching to globalThis.DS, exactly as the contract shows. No ES modules, no require() in src files, no external libraries, no network assets.
- For big files, write in several steps (create with Write, then extend with Edit) rather than one enormous Write.
- When finished run \`node --check <file>\` on each JS file you wrote and fix any syntax errors.
- Quality bar: this must actually work and be fun. Be thorough and generous with content, and precise with the contract.
- Your final message: a 3-6 line summary of what you built, counts of things defined, and any contract ambiguity you had to resolve.

`

const cardAgent = (cls, prefix, file, theme) => ({
  label: `cards:${cls}`,
  prompt: PRE + `YOUR FILES: src/content/${file}
YOUR TASK: the complete "${cls}" character: DS.defineCharacter, its starter relic (DS.defineRelic, rarity 'starter', class '${cls}', id prefix ${prefix}), every custom status its cards need (DS.defineStatus, prefix ${prefix}), and its whole card pool (class '${cls}', id prefix ${prefix}).
Character fantasy and mechanics: ${theme}
Required content:
- Starter cards (rarity 'starter'): a Strike (6 dmg, cost 1), a Defend (5 block, cost 1) and 2 signature starters. starterDeck has exactly 10 ids (e.g. 4-5 strikes, 4 defends, signatures).
- AT LEAST 70 non-starter cards: about 24 common, 30 uncommon, 16 rare; roughly 40% attacks, 40% skills, 20% powers. Add token cards (rarity 'special') if your mechanics create cards.
- Every card: evocative name, emoji icon, player-facing desc with literal numbers that EXACTLY matches the effects, and an 'upgrade' override (better numbers and/or lower cost, with updated desc).
- Power cards work by applying a status (built-in or your own with triggers) to self. Define at least 10 custom statuses with triggers for powers.
- Build 3-4 distinct synergy archetypes so deckbuilding choices matter; include X-cost cards, exhaust/ethereal/innate/retain cards, multi-hit attacks, scaling cards using Value objects, and conditional cards using 'if'.
- Use only DSL ops, Value sources, targets, trigger names and built-in statuses that exist in the contract. Use 'custom' at most 3 times.
- Follow the balance reference in the contract.`,
})

const BUILD = [
  {
    label: 'engine:core+combat',
    prompt: PRE + `YOUR FILES: src/engine/core.js, src/engine/statuses.js, src/engine/combat.js
YOUR TASK: the heart of the game. Implement contract sections 2, 3 (combat ops + Values + targets + cond), 4 (all built-in statuses, exactly the listed ids, with name/desc/icon/type), 5 (trigger dispatch for statuses on any unit and for the player's relics, with when/every/oncePerTurn/oncePerCombat) and 7 (DS.Combat with exactly the documented fields, methods, turn rules and emitted events).
Details that matter:
- core.js must not depend on any other file. DS.events is an event bus object; DS.events_ is the event-definition registry.
- combat.js reads the run only through the documented run shape (run.deck, run.relics, run.potions, run.hp, run.maxHp, run.gold, run.character, run.stats). For ops gold/max_hp inside combat, mutate run directly and emit 'run:update'. Do not call DS.Run methods that might not exist without guarding (typeof check).
- Relic passives: sum relic def.passive.energy / passive.draw over run.relics.
- All effect resolution is async (await DS.hooks.delay / DS.hooks.chooseCards). Guard against re-entrancy with c.busy. Guard infinite trigger loops with a depth limit (e.g. 30).
- Statuses implemented by hard-coded engine logic (artifact, intangible, buffer, barricade, no_draw, entangle, double_tap, vigor, etc.) must behave as described; the simple ones should be defined declaratively via mods/triggers/decay so the same machinery serves content-defined statuses.
- Unknown op / unknown status / unknown card id must console.warn and continue, never throw. Wrap custom fn calls in try/catch.
- X-cost cards: spend all energy, x = energy spent. Cost -1 = unplayable. Curses/status cards with cost -1 cannot be played. Respect playableIf, entangle, energy.
- Enemy intent: choose via def.ai or def.pattern (sequence / random with weights, noRepeat, first); intent.damage = modified per-hit damage of the first 'damage' effect in the move (resolve Values), intent.times = its times; recompute intents on each combat:update-worthy change of strength/weak/vulnerable.
- Check for death after every damage/lose_hp; dead enemies fire onDeath/onKill/onEnemyDeath and emit combat:enemyDied; end combat immediately when all are dead or the player dies (stop resolving remaining effects).
- Update run.stats (turns, cardsPlayed, damageDealt).
- Card-level hooks: onDraw, onEndTurnInHand, onExhaust, onDiscard; keywords exhaust, ethereal, innate, retain. Power cards are removed from play after use (not discarded).
- Write a tiny self-test at the end of your work: a throwaway node script in the project's tools/ folder named engine_selftest.js that loads the three files with require-free vm or plain require, defines 2 cards, 1 enemy, 1 encounter and a fake run object, plays a combat with random legal plays to completion, and prints the result. Run it and fix what breaks.`,
  },
  {
    label: 'engine:run',
    prompt: PRE + `YOUR FILES: src/engine/run.js
YOUR TASK: implement contract section 8 completely (DS.Run and the DS.run shape) plus the run-level effect interpreter (section 3 "Run-level ops", including 'chance' result text and 'fight').
Details:
- Map generation: 15 rows x up to 7 columns, 6 paths walked bottom to top giving a branching connected graph with no crossing edges where possible; row 0 fights, row 8 treasure, row 14 rest, then a single boss node all row-14 nodes lead to. Room mix elsewhere roughly: fight 45%, event 22%, elite 12% (never before row 5), rest 12% (never before row 5, not on row 13), shop 9%. Guarantee at least one shop and 2 elites per act map.
- Encounter choice: first 3 fights of an act use DS.encounters with tier 'easy' for that act, later ones 'normal'; elites 'elite'; boss 'boss' (random among that act's bosses). Avoid repeating the previous encounter. Fall back gracefully to any encounter of the act (then any encounter) if a tier is empty.
- Events: random DS.events_ entry valid for the act (act 'any' or array including act), not repeated within a run until exhausted. An event node has a 15% chance to be a fight instead.
- Rewards: gold 10-20 normal / 25-35 elite / 95-105 boss; 3 distinct card choices from the character's class pool with rarity odds 60/33/7 (boss: all rare), 10% chance of a colorless card replacing one; 40% potion chance; relic for elite (rarity odds common 50 / uncommon 33 / rare 17) and treasure. Never offer a relic already owned; fall back sensibly if a pool is empty.
- Shop: 5 class cards + 2 colorless, 3 relics (one of rarity 'shop' if any exist), 3 potions, card removal (75 gold, +25 each use across the run). Prices: common card 45-55, uncommon 68-82, rare 135-165; relic common 150 / uncommon 250 / rare 300 / shop 150 (±5%); potions 50/75/100.
- Boss relic choices: 3 distinct unowned relics of rarity 'boss'.
- nextAct: act++, heal to full, new map, nodeId null; returns false and sets run.won when finishing act 3.
- Relic counters; fire(triggerName, ctx) runs run-level relic triggers (onPickup, onRest, onRoomEnter, onCardAdded, onChestOpen, onShopEnter, onGoldGained) through the run-level interpreter, honoring 'when' and 'every'.
- Event choice cond: minGold, minHp, hasRelic, hasCardType. Choices needing player selection use DS.hooks.chooseDeckCard.
- Save/load: JSON in localStorage key 'duskspire_save', guarded so the file loads and works in Node without localStorage. Emit 'run:update' after every mutation.
- Everything must tolerate missing content (empty registries) without throwing. Use DS.rng for all randomness; seed it in start().
- Do not define DS.Combat or anything owned by other files. DS.getCardData, DS.cardPool, DS.relicPool, DS.rng, DS.uid, DS.events, DS.hooks come from core.js (written by another agent) — use them per the contract.`,
  },
  {
    label: 'ui:kit+css',
    prompt: PRE + `YOUR FILES: src/ui/kit.js, styles.css
YOUR TASK: the UI toolkit (contract section 9 "kit.js", every listed function with the exact signature) and ALL the game's CSS.
- styles.css must style everything the other UI agents will build, using these class names (they have been told to use them): layout .ds-screen, #topbar (.ds-topbar, .ds-topbar-item, .ds-relic, .ds-potion, .ds-potion-empty), buttons .ds-btn / .ds-btn-primary / .ds-btn-danger / .ds-btn:disabled, panels .ds-panel, titles .ds-title / .ds-subtitle, cards .ds-card (+ .ds-card-attack/.ds-card-skill/.ds-card-power/.ds-card-curse/.ds-card-status, rarity .ds-rarity-common/uncommon/rare/starter/special, .ds-card-small, .ds-card-disabled, .ds-card-selected, .ds-card-upgraded, parts .ds-card-cost .ds-card-name .ds-card-art .ds-card-type .ds-card-desc), class tint via CSS variable --class-color, combat .ds-combat, .ds-combat-field, .ds-player, .ds-enemies, .ds-enemy (.ds-enemy-targetable, .ds-enemy-targeted, .ds-enemy-dead), .ds-unit-art, .ds-unit-name, .ds-hpbar (.ds-hpbar-fill, .ds-hpbar-text, .ds-block-badge), .ds-intent, .ds-statuses .ds-status-chip, .ds-hand (fanned cards, hover lifts card), .ds-energy, .ds-pile (.ds-pile-draw/.ds-pile-discard/.ds-pile-exhaust), .ds-endturn, map .ds-map, .ds-map-node (.ds-map-node-available pulsing, -visited, -current, type classes .ds-node-fight/elite/rest/shop/event/treasure/boss), svg .ds-map-edge, reward/shop/event/rest .ds-reward-list .ds-reward-item .ds-shop-grid .ds-shop-item .ds-price (.ds-price-unaffordable) .ds-event-text .ds-choice (.ds-choice-disabled), .ds-grid (card grids), overlay .ds-modal-backdrop .ds-modal, .ds-tooltip, .ds-toast, fx .ds-float (.ds-float-damage/.ds-float-block/.ds-float-heal/.ds-float-status), .ds-shake, .ds-flash, keyword highlight .ds-kw.
- Look: dark gothic fantasy, rich gradients, glows, tasteful CSS animations (card draw, hover, pulse, screen fade-in). Cards ~170x240px (small ~120x170), cost orb top-left, emoji art large in the middle, type banner, readable description. Rarity shown by frame/name color. Must fit 1280x720 and scale up nicely; body has no scrollbars, screens can scroll internally.
- kit.js: renderCard takes resolved card data (fields from the contract's defineCard plus .upgraded); opts.cost overrides shown cost; cost -1 shows nothing, 'X' shows X. Sets --class-color from DS.characters[data.class].color when available. describe() highlights keywords (Block, Vulnerable, Weak, Strength, Exhaust, Ethereal, Innate, Retain, Poison, etc. plus any DS.statuses names) with .ds-kw and newline->br. tooltip: follows mouse, stays on-screen, rendered in #overlay. statusChips(unit): icon + stack count per status from DS.statuses with tooltip (name + desc with {n} replaced). modal/cardPicker/showDeck/toast render in #overlay. cardPicker lets the user click to select exactly 'count' cards (or fewer if optional / fewer available) and confirm. The screen router adds a fade-in class.
- kit.js must not call engine functions at load time; guard everything optional (DS.audio etc).`,
  },
  {
    label: 'ui:screens',
    prompt: PRE + `YOUR FILES: src/ui/screens.js
YOUR TASK: every non-combat screen and the top bar, per contract section 9, registered with DS.ui.registerScreen (kit.js, written by another agent, provides DS.ui.el/go/renderCard/tooltip/modal/cardPicker/showDeck/toast/describe; styles.css is written by that agent too — do not write CSS files; you may inject a small <style> block from JS only for things truly specific to your screens).
Use these CSS classes: .ds-screen, .ds-btn/.ds-btn-primary/.ds-btn-danger, .ds-panel, .ds-title/.ds-subtitle, .ds-grid, .ds-topbar/.ds-topbar-item/.ds-relic/.ds-potion/.ds-potion-empty, .ds-map/.ds-map-node (+ -available/-visited/-current, .ds-node-<type>), svg lines .ds-map-edge, .ds-reward-list/.ds-reward-item, .ds-shop-grid/.ds-shop-item/.ds-price/.ds-price-unaffordable, .ds-event-text/.ds-choice/.ds-choice-disabled.
Screens:
- menu: big title DUSKSPIRE, New Run, Continue (if DS.Run.hasSave(); load then go map), Compendium, mute toggle (DS.audio if present).
- charselect: a card per DS.characters entry (icon, name, title, desc, hp, gold, starter relic with description), choose -> DS.Run.start(id) -> map.
- map: vertical scrollable map of DS.run.map (boss at top, row 0 at bottom) with emoji node icons, SVG edges between connected nodes, available nodes clickable; legend; calls DS.Run.save() on enter; click -> DS.Run.enterNode(id) and route: combat -> go('combat', {encounterId, tier}); event -> go('event',{eventId}); shop -> go('shop',{shop}); rest; treasure.
- reward {tier, fromEvent}: DS.Run.generateRewards(tier); gold / potion / relic items clickable to claim; card reward opens a pick-1-of-3 (skippable); Continue. Then: tier 'boss' -> go('bossrelic'), otherwise go('map').
- bossrelic: pick 1 of DS.Run.bossRelicChoices() (or skip); then DS.Run.nextAct() ? go('map') : (DS.Run.end(true), go('victory')).
- shop {shop}: cards, relics, potions with prices (greyed if unaffordable, marked sold), card removal service (pick a deck card via DS.ui.cardPicker), Leave -> map.
- rest: Rest (heal 30%) or Smith (pick a non-upgraded upgradable deck card, show before/after, DS.Run.upgradeCard), then -> map.
- event {eventId}: DS.Run.getEvent; show icon, name, narration, choices (disabled ones greyed); on click await DS.Run.chooseEvent -> show result text and Continue; if fightEncounterId -> go('combat', {encounterId, tier:'normal', fromEvent:true}) else map.
- treasure {relicId, gold}: open chest animation-ish, claim relic and gold, -> map.
- gameover / victory: run summary from DS.run.stats, floor, act, deck size, relics; button back to menu.
- compendium: tabs for Cards (filter by class, shows normal + upgraded on hover or toggle), Relics, Potions, Enemies (icon, hp, act, tier), with counts; Back.
- Top bar: DS.ui.refreshTopBar() renders into #topbar when DS.run exists and is not over (hide on menu/charselect/compendium): character icon+name, HP, gold, act/floor, potion slots (click emits DS.events.emit('ui:potionClick', {slot}); when DS.ui.current !== 'combat' offer discard via modal), relics with tooltip (name, desc, counter), deck button (DS.ui.showDeck sorted), map peek button, settings (mute, abandon run). Re-render on 'run:update' and 'combat:update'.
- Be defensive: every DS.Run call result may be imperfect; never let one missing field crash a screen.`,
  },
  {
    label: 'ui:combat',
    prompt: PRE + `YOUR FILES: src/ui/combat_ui.js
YOUR TASK: the combat screen, registered as DS.ui.registerScreen('combat', ...) per contract sections 7 and 9. kit.js (another agent) provides DS.ui.el/renderCard/tooltip/statusChips/modal/cardPicker/showDeck/toast; styles.css comes from that agent — do not write CSS files (inject a small <style> from JS only if truly necessary).
Use these CSS classes: .ds-combat, .ds-combat-field, .ds-player, .ds-enemies, .ds-enemy (+ .ds-enemy-targetable/.ds-enemy-targeted/.ds-enemy-dead), .ds-unit-art, .ds-unit-name, .ds-hpbar/.ds-hpbar-fill/.ds-hpbar-text/.ds-block-badge, .ds-intent, .ds-statuses, .ds-hand, .ds-card-disabled, .ds-card-selected, .ds-energy, .ds-pile .ds-pile-draw/.ds-pile-discard/.ds-pile-exhaust, .ds-endturn.
Behaviour:
- enter({encounterId, tier, fromEvent}): new DS.Combat(DS.run, encounterId, {fromEvent}); subscribe to DS.events; await combat.start(); render. exit(): unsubscribe everything.
- Layout: player (character icon from DS.characters[run.character], name, hp bar with block badge, statuses) on the left; enemies on the right, each with intent above (emoji per intent type, damage as "12" or "7x3", tooltip explaining the intent and move name), emoji art sized by def.scale, name, hp bar, block, statuses; data-combatant attributes exactly as the contract says. Bottom: draw pile (count, click to view sorted contents), energy orb "2/3", fanned hand, discard pile, exhaust pile (click to view), End Turn button.
- Re-render on 'combat:update' (cheap full re-render is fine but keep hand hover smooth; do not re-render while a card picker is open).
- Playing cards: unplayable cards (combat.canPlay(card).ok false) are dimmed and show the reason as a toast when clicked. Cards whose data.target is 'enemy': click selects the card (highlighted, enemies become targetable), then click an enemy to play; click the card again / right-click / Escape cancels; if only one living enemy, play immediately on it. Also support drag-free keyboard: keys 1-9,0 select/play hand cards, E ends turn. Other targets play immediately. Show the card's current cost via renderCard(card.data, {cost: card.cost}).
- Disable input while combat.busy or phase !== 'player'. End Turn -> await combat.endTurn().
- Potions: listen for 'ui:potionClick' {slot}: show a small modal with the potion's name/desc and Use / Discard / Cancel; Use on target 'enemy' potions enters enemy-targeting mode; then await combat.usePotion(slot, target).
- A turn banner ("Your Turn" / "Enemy Turn") on 'combat:turnStart'. Show enemy move name briefly on 'combat:enemyMove'.
- On 'combat:end': won -> short delay then DS.ui.go('reward', {tier, fromEvent}); lost -> DS.Run.end(false), DS.ui.go('gameover').
- Be defensive about missing fields (intent may be null, etc.). Never throw from event handlers.`,
  },
  {
    label: 'ui:audio+fx',
    prompt: PRE + `YOUR FILES: src/ui/audio.js, src/ui/fx.js
YOUR TASK: sound and juice, fully self-wired through DS.events (contract sections 7-9) so no other file needs to call you.
- audio.js: WebAudio synthesized sound effects (no audio files): distinct sounds for card play (by card type), attack hit (pitch/weight by damage), blocked hit, block gain, buff, debuff, poison/burn tick, heal, gold, enemy death, shuffle, card draw, turn start, victory fanfare, defeat sting, UI click (global delegated listener on .ds-btn, .ds-card, .ds-map-node, .ds-choice), potion. A gentle generative ambient music loop (dark, slow, minor key pads/arpeggio) with DS.audio.setMusic(bool). DS.audio.play(name), DS.audio.setMuted(bool), DS.audio.muted, volume persisted in localStorage (guarded). Lazily create/resume AudioContext on first pointerdown/keydown. Never throw if WebAudio is unavailable.
- fx.js: on 'combat:damage' show a floating number (.ds-float .ds-float-damage, bigger for bigger hits; "Blocked" style when amount is 0 and blocked > 0) over the element [data-combatant="<target.uid>"], add .ds-shake to it briefly and screen-shake #app for big hits to the player; 'combat:block' -> .ds-float-block "+N"; 'combat:heal' -> .ds-float-heal; 'combat:status' -> small .ds-float-status with the status icon/name and signed amount; 'combat:enemyDied' -> fade/puff particles; 'combat:cardPlayed' -> a quick slash/spark/glow effect over the target (or player for skills/powers) depending on card type; 'run:gold' -> coin burst near the top bar. Simple emoji/DOM particle system with requestAnimationFrame or CSS animations; all floating elements are appended to #overlay with position computed from getBoundingClientRect and removed after their animation. fx.js injects its own keyframes in a <style> tag (styles.css belongs to another agent). Must be cheap and never throw when elements are missing.`,
  },
  cardAgent('berserker', 'bz_', 'cards_berserker.js', 'A raging axe warrior (80 HP, color #c0392b, icon 🪓). Archetypes: Strength scaling and multi-hit; self-damage ("Bloodprice": pay HP for power, bonuses when losing HP); Exhaust synergy; Rage/Vulnerable aggression and heavy single hits. Starter relic heals a little at the end of combat.'),
  cardAgent('shade', 'sh_', 'cards_shade.js', 'A nimble assassin (70 HP, color #27ae60, icon 🗡️). Archetypes: Poison stacking and catalysts; Shiv tokens (0-cost exhausting attack tokens) and many cheap attacks per turn; discard synergy and card draw/cycling; Weak/evasion with dexterity and next-turn setup (retain, energized, draw_next). Starter relic draws 2 extra cards at combat start.'),
  cardAgent('arcanist', 'ar_', 'cards_arcanist.js', 'A glass-cannon spellcaster (68 HP, color #2980b9, icon 🔮). Archetypes: "Arcane Charge" (a custom status that builds as you play skills and is consumed by finisher spells via Value objects); Burn damage-over-time and all-enemy fire spells; Frost (block + Weak, custom "Chill" status that punishes enemies); X-cost and energy-ramp spells, card generation of random cards. Starter relic grants 1 energy on the first turn of each combat.'),
  cardAgent('warden', 'wd_', 'cards_warden.js', 'An armored nature guardian (88 HP, color #b7950b, icon 🛡️). Archetypes: stacking Block and Barricade-style payoffs (attacks that deal damage equal to block via Value objects); Thorns/plated_armor/metallicize retaliation; Regen and max-HP sustain; "Seed/Growth" custom status that ramps over long fights, plus lock_on/mark setups. Starter relic grants 6 block at combat start.'),
  {
    label: 'cards:colorless+curses',
    prompt: PRE + `YOUR FILES: src/content/cards_colorless.js
YOUR TASK:
1. The fixed shared curse and status cards with EXACTLY the ids listed in the contract ("Fixed shared ids"): 10 curses (class 'curse', type 'curse', rarity 'special', usually cost -1; give each a distinct drawback using onDraw / onEndTurnInHand / ethereal / innate / unplayable etc. — e.g. regret: lose HP per card in hand at end of turn; pain: lose 1 HP when another card is played is hard, so use a status applied onDraw; decay: take 2 damage at end of turn; doubt: gain 1 Weak at end of turn; shame: 1 Frail; clumsy: ethereal; writhe: innate; injury/parasite: plain; normality: design something feasible) and 5 status cards (class 'status', type 'status', rarity 'special': wound unplayable; dazed unplayable ethereal; burn unplayable, lose 2 HP at end of turn in hand; slimed cost 1 exhaust; void unplayable ethereal, lose 1 energy on draw).
2. AT LEAST 45 colorless cards (class 'colorless', id prefix cl_): ~20 uncommon, ~20 rare, plus ~5 'special' ones only obtainable from events/relics (events may add them by id — name these cl_gift_1 … cl_gift_5 style ids are NOT needed; instead simply make them good and list them in your final summary). Colorless cards are flexible utility: card draw, energy, universal buffs/debuffs, cards that create random cards (add_card 'random' with class/type filters), upgrade_hand, gold-related, max-HP on kill, potions-like effects, multi-class-friendly scaling. Each needs emoji icon, exact desc, upgrade override.
Define any custom statuses you need with prefix cl_. Use only contract ops/values/triggers/built-in statuses; 'custom' at most 3 times.`,
  },
  {
    label: 'relics:a',
    prompt: PRE + `YOUR FILES: src/content/relics_a.js
YOUR TASK: AT LEAST 50 relics with id prefix ra_: about 28 rarity 'common' and 22 rarity 'uncommon'. (Another agent writes rare/boss/shop/event relics in relics_b.js with prefix rb_; class starter relics are written by the class agents.) Include 2 common/uncommon class-specific relics per class (class: 'berserker' | 'shade' | 'arcanist' | 'warden') that support that class's themes (berserker: strength/self-damage/exhaust; shade: poison/shivs/discard; arcanist: burn/skills/X-costs; warden: block/thorns/regen) using only built-in statuses.
Each relic: evocative name, emoji icon, exact player-facing desc, short flavor line, and behaviour implemented with contract triggers (section 5) + DSL effects, 'passive', or run-level triggers (onPickup, onRest, onRoomEnter, onCardAdded, onChestOpen, onShopEnter, onGoldGained). Use a wide variety: combat-start buffs, every-Nth-card/attack counters ('every'), first-turn effects (when:{turn:1}), on-kill/on-exhaust/on-shuffle/on-discard effects, low-HP conditionals (when:{hpBelowPct:50}), elite-room bonuses, healing on rest, gold on room enter, max HP on pickup, potion synergies (onPotionUsed), block retention style effects via next_turn_block, etc. Commons are modest (think +1 strength for the first turn, 3 block at combat start, heal 2 after combat); uncommons are stronger or build-around. Define custom statuses (prefix ra_) only when needed. Use 'custom' at most 3 times.`,
  },
  {
    label: 'relics:b',
    prompt: PRE + `YOUR FILES: src/content/relics_b.js
YOUR TASK: AT LEAST 50 relics with id prefix rb_: about 20 rarity 'rare', 14 rarity 'boss', 10 rarity 'shop', 8 rarity 'event'. (Another agent writes common/uncommon relics in relics_a.js with prefix ra_.)
- Rare: powerful build-arounds (e.g. start each combat with 1 artifact / buffer / 8 plated_armor, every 10th card played draws 2, heal 6 after combat if below 50% HP, first attack each combat is doubled via double_tap, apply 1 vulnerable to all enemies at combat start, gain strength whenever HP is lost, etc.). Include 1 rare class-specific relic per class (class field: berserker | shade | arcanist | warden).
- Boss: game-changing with a real drawback; at least 8 of them grant passive: {energy: 1} with a downside implemented through triggers/statuses (e.g. start combats with 1 weak / frail / a curse or status card added to draw pile via add_card on onCombatStart, lose HP each turn, enemies start with strength — apply to all_enemies on onCombatStart, no healing at rest is hard so prefer implementable downsides, gain a curse on pickup via run-level add_card). Others: passive draw +1 / potionSlots +2, transform/upgrade deck on pickup, big max HP, etc.
- Shop: utility and economy (gold on room enter, card removal on pickup via remove_card, potions each shop, upgrade random cards on pickup).
- Event: quirky double-edged relics that events hand out.
Each relic: evocative name, emoji icon, exact player-facing desc, short flavor line, behaviour implemented with contract triggers (section 5) + DSL effects, 'passive', and run-level triggers. Define custom statuses (prefix rb_) only when needed. Use 'custom' at most 4 times. In your final summary list the ids of all 'event' rarity relics.`,
  },
  {
    label: 'potions',
    prompt: PRE + `YOUR FILES: src/content/potions.js
YOUR TASK: AT LEAST 40 potions with id prefix po_: about 18 common, 14 uncommon, 8 rare. Each: name, emoji icon, liquid color hex, exact player-facing desc, target ('enemy' | 'all_enemies' | 'self' | 'none'), effects in the contract DSL. Variety: direct damage (20 to one enemy), fire to all enemies, block, strength/dexterity (permanent for combat, and temporary via strength + strength_down), weak/vulnerable/poison/burn application, energy, card draw, heal, regen, artifact, intangible, thorns, plated_armor, buffer, double_tap, upgrade_hand all, add random cards (add_card 'random' with type filters) to hand, exhaust-from-hand, discard-and-draw, max HP (rare fruit juice), gold, multiply_status poison, remove debuffs from self (remove_status weak/vulnerable/frail), next-turn setup (energized, draw_next, next_turn_block), scaling ones using Value objects (damage equal to block, block equal to cards in hand × 3...). Balance: a common potion is worth roughly 2 energy of card effects; rare ones are swingy. Define custom statuses (prefix po_) only if needed. No 'custom' op unless unavoidable (max 2).`,
  },
  ...[1, 2, 3].map(n => ({
    label: `enemies:act${n}`,
    prompt: PRE + `YOUR FILES: src/content/enemies_act${n}.js
YOUR TASK: the complete bestiary and encounter table for ACT ${n} (id prefix a${n}_, act: ${n}). Theme: ${['the Ashen Catacombs — rats, slimes, cultists, skeletons, fungal things, bandits, gremlin-like pests', 'the Drowned City — cursed knights, sirens, eels, thieves, clockwork sentries, plague priests, mimics', 'the Duskspire Summit — void horrors, fallen angels, living storms, crystal golems, time-eaters, shadow twins'][n - 1]}.
Required:
- AT LEAST 14 'normal' enemies (a mix of weak swarmers meant to appear in groups and sturdier solo/duo enemies), 3 'minion' enemies (only summoned or accompanying), 4 'elite' enemies, 3 'boss' enemies.
- Every enemy has 3-5 moves with fitting intents and an interesting pattern or ai function: openers, buff-then-big-hit telegraphs, scaling (ritual / strength gain), debuffers (weak/frail/vulnerable on the player via apply to 'target'), status-card shufflers (add_card status_wound / status_dazed / status_burn / status_slimed / status_void to the player's 'discard' or 'draw'), defenders, thorns/curl_up/angry/enrage/artifact/plated_armor users via onSpawn, summoners (summon op, minions), splitters or death effects (triggers.onDeath), HP-threshold phase changes (ai checks ctx.self.hp / ctx.self.maxHp), multi-hit attackers.
- Elites: distinctive gimmicks that punish a play style. Bosses: multi-phase fights with a clear rhythm and a signature mechanic each (${['e.g. a slime king that splits, a necromancer that summons, an armored guardian that alternates offense/defense modes', 'e.g. a clockwork colossus that counts down to a huge hit, a siren queen stacking debuffs and status cards, twin knights sharing a fight', 'e.g. a time-eater that punishes playing many cards (enrage-like trigger on onCardPlayed is the player\'s trigger, so implement via the enemy\'s own counters in ai / custom statuses), an awakened void that revives into phase two via onDeath + summon, a heart-like final boss with rotating multi-hit attacks and buffs'][n - 1]}).
- Numbers follow the contract's balance reference for act ${n} (act 1 baseline; act 2 ≈ ×1.7 HP and +50% damage; act 3 ≈ ×2.6 HP and +100% damage). Multi-enemy encounters should have lower per-enemy stats.
- Encounters (DS.defineEncounter): at least 5 tier 'easy' (1-2 weak enemies), 14 tier 'normal' (varied compositions of 1-4 enemies, total threat balanced), 4 tier 'elite' (some with minions), 3 tier 'boss'. Give each a name.
- In enemy effects 'target' is the player and 'self' is the enemy. Define custom statuses (prefix a${n}_) when needed. Use only contract ops/values/triggers/built-ins; 'custom' at most 4 times.`,
  })),
  ...['a', 'b'].map((s, i) => ({
    label: `events:${s}`,
    prompt: PRE + `YOUR FILES: src/content/events_${s}.js
YOUR TASK: AT LEAST 26 narrative events with id prefix e${s}_ (another agent writes a different batch in events_${i ? 'a' : 'b'}.js; your flavor: ${i ? 'act-specific set pieces — about 8 for act [1] (Ashen Catacombs: crypts, rats, cultists, fungus), 9 for act [2] (Drowned City: sunken markets, sirens, clockwork, plague), 9 for act [3] (Duskspire Summit: void rifts, fallen angels, storms, time distortions)' : 'act \'any\' events — shrines, gamblers, wandering merchants, mysterious strangers, cursed treasure, campfire tales, forks in the road, mirrors, wishing wells, duelists'}).
Each event: name, emoji icon, 2-4 sentences of atmospheric second-person narration in 'text', and 2-4 meaningful choices with a label that states the mechanical outcome in brackets style, e.g. "[Drink] Heal 15 HP. Gain a Curse.", exact run-level effects (section 3 "Run-level ops"), and a 1-2 sentence 'result'. Design real risk/reward trade-offs: HP for relics, gold for card removal, curses (curse_* ids from the contract) for power, upgrades, transforms, max HP, potions, 'chance' gambles with thenResult/elseResult, optional 'fight' choices (reference encounters ONLY through effects like {op:'fight', encounter:'RANDOM_ELITE'} is NOT supported — instead avoid 'fight' unless you use the special ids 'random_normal' or 'random_elite', which run.js may not support; so use 'fight' in at most 2 events and prefer other ops). Use 'cond' (minGold, minHp, hasRelic, hasCardType) for gated choices and make sure at least one choice per event is always available (a "[Leave]" with empty effects is fine). Use only ops from the run-level table; no 'custom' unless unavoidable (max 2).`,
  })),
  {
    label: 'shell+smoke',
    prompt: PRE + `YOUR FILES: index.html, src/ui/boot.js, package.json, main.js, tools/smoke.js, run.bat
YOUR TASK:
1. index.html: <!doctype html>, title Duskspire, links styles.css, body with <div id="topbar"></div><div id="app"></div><div id="overlay"></div>, then <script src> tags for every file in the contract's load order, exactly in that order (classic scripts, relative paths). No inline game logic.
2. src/ui/boot.js: on DOMContentLoaded wire DS.hooks to the UI — delay: real setTimeout promise; chooseCards({cards, count, prompt, optional}): uses DS.ui.cardPicker with [{data: card.data, ref: card}] and returns the chosen combat cards (auto-returns when cards.length === 0); chooseDeckCard({prompt, filter}): cardPicker over DS.run.deck instances (data via DS.getCardData), returns one instance or null — then a global window 'error' / 'unhandledrejection' handler that logs and shows DS.ui.toast, then DS.ui.go('menu').
3. package.json (name duskspire, version 1.0.0, main main.js, scripts: start = "electron .", smoke = "node tools/smoke.js", devDependencies: electron ^33) and main.js: Electron main process creating a 1440x900 BrowserWindow (min 1280x720, backgroundColor #0b0b12, autoHideMenuBar, title Duskspire) loading index.html; quit when all windows close; F11 toggles fullscreen. Do NOT run npm install. run.bat: starts the game with "npm start" (installing with npm install first if node_modules is missing).
4. tools/smoke.js — a thorough headless validator runnable with \`node tools/smoke.js\` from the project root. It must:
   a. Load every engine and content file from the contract's load order (NOT the src/ui files) into the current global context in order (e.g. vm.runInThisContext(fs.readFileSync(...), {filename})), reporting files that are missing or throw on load as errors without aborting.
   b. Statically validate every registered definition against the contract: required fields and enums for cards, relics, potions, enemies, encounters, events, statuses, characters; id prefix sanity; recursively walk all effects lists (card effects, upgrade.effects, onDraw/onEndTurnInHand/onExhaust/onDiscard, potion effects, enemy moves, onSpawn, all triggers incl. {when, effects} form, nested then/else/effects/onKill) and flag unknown ops, unknown status ids in apply/remove_status/multiply_status/Value objects, unknown card ids in add_card, unknown enemy ids in summon and encounters, unknown trigger names, unknown Value sources, unknown 'to' targets, pattern/weights moves that do not exist, starterDeck ids and starterRelic that do not exist, non-curse/status cards without an upgrade, events with no always-available choice, missing fixed shared ids. Use hard-coded lists copied from the contract (do not rely on DS.OPS existing).
   c. Dynamic tests with default headless hooks: for each character, DS.Run.start(char, seed); then for EVERY encounter: reset hp to max, create new DS.Combat(DS.run, id), await start(), and play with a simple random-legal-move bot (play random playable cards with a random living target until none are playable or 30 plays, then endTurn) for up to 60 turns, with a per-combat timeout guard (Promise.race, 5s) — record thrown exceptions, hangs, NaN/undefined hp/block/energy values, and combats that never end. Also: play every card of every class once in a sandbox combat against a dummy encounter with 10 energy (normal and upgraded) and record exceptions/NaN; use every potion once; fire a full simulated run per character (walk the map choosing random available nodes, auto-resolving combats with the bot and giving the player +1000 HP so it survives, taking the first card reward, buying one shop item, resting, picking random event choices via DS.Run.chooseEvent, boss relics, nextAct until won) and record exceptions.
   d. Capture console.warn output during tests and include the distinct warnings (with counts) in the report.
   e. Print a readable report grouped by file/category with content counts (cards per class and rarity, relics per rarity, potions, enemies and encounters per act and tier, events, statuses), a list of ERRORS and WARNINGS, bot win rates per act as a rough balance signal, and a last line exactly "SMOKE RESULT: PASS" or "SMOKE RESULT: FAIL (<n> errors)". Exit code 1 on failure. Support \`--quick\` (skip the full runs) and \`--only=<substring>\` to filter error output.
   The other files may not exist yet when you finish; verify smoke.js with \`node --check\` and run it once anyway to make sure it degrades gracefully (reports missing files rather than crashing).`,
  },
]

const SMOKE_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean', description: 'true only if the last run of node tools/smoke.js printed SMOKE RESULT: PASS' },
    errorsRemaining: { type: 'number' },
    fixed: { type: 'string', description: 'short summary of what was fixed' },
    remaining: { type: 'string', description: 'what is still broken, if anything' },
    counts: { type: 'string', description: 'content counts line from the report' },
  },
  required: ['pass', 'errorsRemaining', 'fixed', 'remaining'],
}

const FIX_PRE = `You are the integration engineer for DUSKSPIRE, a Slay-the-Spire-style roguelike deckbuilder that ~20 engineers just wrote in parallel against a shared contract.
Project root (Windows): ${ROOT}
FIRST: Read ${ROOT}\\CONTRACT.md completely. It is the source of truth; when two files disagree, make them match the contract.
`

const smokeFix = (round, focus) => agent(FIX_PRE + `YOUR JOB (round ${round}): make \`node tools/smoke.js\` pass. Run it from the project root (it can be long; redirect output to a file in tools/ such as tools/smoke_out.txt and read that). ${focus}
Work the errors in this priority order: (1) files that are missing or throw at load; (2) exceptions and hangs inside src/engine/core.js, statuses.js, combat.js, run.js — read the engine carefully and fix root causes, since one engine bug produces hundreds of content errors; (3) bugs in tools/smoke.js itself (false positives — fix the validator when the content is contract-correct, never weaken a legitimate check); (4) content errors: unknown ops/statuses/ids/targets/triggers, desc/effects mismatches flagged, missing upgrades, NaN values. Fix content by correcting it to valid contract DSL — do NOT delete content to make errors go away, and do not reduce the amount of content. If content uses a reasonable feature the engine lacks (a Value source, a 'when' key, a run-level op), prefer implementing it in the engine.
Re-run the smoke test after each batch of fixes; iterate until it prints "SMOKE RESULT: PASS" or you have made at least 6 fix-and-rerun cycles. Also run \`node --check\` on every file you touch. Do not edit files under src/ui/.
Report honestly: pass must be true only if the final run printed SMOKE RESULT: PASS.`, { ...H, label: `smoke-fix:${round}`, phase: 'Smoke-fix', schema: SMOKE_SCHEMA })

phase('Smoke-fix')
let smoke = null
for (let round = 1; round <= 3; round++) {
  const r = await smokeFix(round, round === 1 ? 'This is the first integration pass, expect many errors.' : `A previous engineer already did a pass; what they reported as remaining: ${smoke ? smoke.remaining : 'unknown'}. Continue from the current state.`)
  if (r) smoke = r
  log(`smoke round ${round}: ${r ? (r.pass ? 'PASS' : `FAIL, ${r.errorsRemaining} errors remaining`) : 'agent returned nothing'}`)
  if (r && r.pass) break
}

phase('Integrate')
const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    mismatchesFound: { type: 'number' },
    fixed: { type: 'string' },
    risks: { type: 'string', description: 'anything you suspect is still broken at runtime in the browser' },
  },
  required: ['mismatchesFound', 'fixed', 'risks'],
}
const integ = await parallel([
  () => agent(FIX_PRE + `YOUR JOB: make the COMBAT screen work end to end in a real browser. You may edit ONLY: src/ui/combat_ui.js, src/ui/fx.js, src/ui/audio.js, src/engine/combat.js (minimal, API-preserving fixes only). Read (do not edit) src/ui/kit.js, styles.css, src/engine/core.js, src/engine/run.js.
Method: read src/ui/combat_ui.js line by line. For EVERY reference to DS.* (DS.Combat fields and methods, DS.events names and payload fields, DS.ui.* kit functions and their argument shapes, DS.Run.*, DS.hooks, DS.audio) open the file that defines it and verify the name exists, the signature and return shape match how it is used, async functions are awaited, and event names/payload keys match exactly what combat.js really emits. Do the same for fx.js and audio.js event subscriptions (payload.target.uid etc.) and the data-combatant attributes. Verify every CSS class combat_ui.js uses exists in styles.css; if one is missing, inject the needed rules from combat_ui.js via a <style> tag rather than editing styles.css. Mentally simulate: entering combat, rendering, selecting a targeted card, playing it, playing an untargeted card, a discard-choice card (DS.hooks.chooseCards via the picker), ending the turn, enemy turn pacing, using a potion, winning (transition to reward), losing (gameover), and leaving the screen (listeners removed, no double subscriptions on the next combat). Fix every mismatch and logic bug you find. Run \`node --check\` on edited files and \`node tools/smoke.js --quick\` if you touched combat.js to be sure it still passes.`, { ...H, label: 'integrate:combat-ui', phase: 'Integrate', schema: INTEG_SCHEMA }),
  () => agent(FIX_PRE + `YOUR JOB: make every NON-combat screen and the app shell work end to end in a real browser. You may edit ONLY: src/ui/screens.js, src/ui/kit.js, src/ui/boot.js, styles.css, index.html, main.js, package.json. Read (do not edit) src/engine/core.js, src/engine/run.js, src/engine/combat.js, src/ui/combat_ui.js. If you find a genuine bug in run.js, describe it precisely in 'risks' instead of editing it.
Method: check index.html loads every file in the contract's order and that each file exists on disk. Then read src/ui/screens.js and src/ui/boot.js line by line. For EVERY reference to DS.* (DS.Run methods and their real return shapes in run.js, DS.run fields, the map structure, room objects from enterNode, reward and shop object shapes, getEvent/chooseEvent results, DS.ui.* kit functions and argument shapes, DS.getCardData, registries such as DS.events_ vs DS.events) open the defining file and verify names, signatures, return shapes and awaits. Verify the router contract in kit.js (registerScreen/go/enter(params, rootEl)/exit) matches how screens.js and combat_ui.js use it, and that cardPicker/modal/showDeck/tooltip/renderCard are used with the shapes kit.js implements. Verify every CSS class used by screens.js and combat_ui.js exists in styles.css and add good-looking rules for any that are missing; check #app/#topbar/#overlay layout so the top bar never overlaps screens, overlays sit above everything, and long screens (map, compendium, shop) scroll. Mentally simulate a full run: menu -> charselect -> map render and node click -> each room type -> reward -> map, boss -> bossrelic -> next act, death -> gameover -> menu, Continue from a save, the compendium. Fix every mismatch and logic bug. Run \`node --check\` on edited JS files.`, { ...H, label: 'integrate:screens', phase: 'Integrate', schema: INTEG_SCHEMA }),
])

phase('Final check')
const final = await smokeFix('final', `Two UI integration engineers just made small fixes. Their notes on suspected remaining problems — investigate and fix the ones in engine/content files: ${JSON.stringify(integ.filter(Boolean).map(r => r.risks))}. Also do a balance sanity pass using the bot win rates in the report: if act 1 easy/normal encounters are unwinnable for a starter deck or act 3 is trivial, adjust enemy numbers modestly.`)

return { smoke, integ, final }
