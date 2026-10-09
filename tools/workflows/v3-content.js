export const meta = {
  name: 'duskspire-v3-content',
  description: 'Duskspire v3 content expansion: one group of 6 Haiku builders, each followed by a Haiku reviewer',
  phases: [{ title: 'Build' }, { title: 'Review' }],
}

const ROOT = '<absolute path to the project folder>';
const HAIKU = { model: 'haiku', effort: 'high' }

const PRE = `You are one of 18 engineers working in parallel on version 3 of DUSKSPIRE, a working Slay-the-Spire-style roguelike deckbuilder (plain JS classic scripts on globalThis.DS, no build step, Electron shell). The game already has 6 characters, 741 cards, 188 relics, 65 potions, 130 enemies and 84 events, and passes its test suites. Version 3 is a pure CONTENT expansion: no engine or UI changes.
Project root (Windows): ${ROOT}
FIRST: Read ${ROOT}\\CONTRACT.md sections 3-7 and 11 (registries, effect DSL, statuses, triggers, id prefixes). It is law. Then read the model files named in your task, and skim src/engine/combat.js and src/engine/statuses.js so you use ONLY ops, Value sources, 'when' keys, targets and built-in statuses that are really implemented. Inventing an op or a field that the engine does not read is the most common failure: every effect you write must be traceable to code in combat.js or run.js.
Rules:
- You own exactly ONE file (given under YOUR FILE). It already exists as a placeholder; replace its contents. Do not create or modify any other file. 17 other engineers are writing the other v3 files right now.
- Classic-script IIFE style exactly like the existing content files. No ES modules, no libraries.
- Every id must start with your prefix, and must not collide with any existing id or display name in the game (grep src/content before choosing names).
- Player-facing desc text must state the literal numbers and match the effects exactly, including the upgraded version.
- Write the file in several steps (Write a first part, then extend with Edit) so no single step is huge.
- Verify, running node from the project root: \`node --check <your file>\`, then \`node tools/smoke.js\` (takes a minute or two). Fix every error and warning that names your file or your ids. Errors that name other v3 files (cards_artificer.js, cards_beastcaller.js, cards_revenant.js, *_3.js, *_c.js, relics_d/e, potions_c, events_d/e) are other engineers' work in progress: ignore those.
- A previous attempt may have been interrupted: if your file already has real content, read it and complete it instead of starting over.
- Final message: 3-6 plain lines: what you built, exact counts, and anything you could not make work.

`

const moreCards = (file, cls, prefix, base, n, hint) => ({ file, label: 'cards:' + file.replace('.js', ''),
  prompt: PRE + `YOUR FILE: src/content/${file}
YOUR TASK: a new expansion set for the existing '${cls}' class. Model files to read fully first: ${base.map(b => 'src/content/' + b).join(', ')} (cards, custom statuses, archetypes, every id and name already used).
Add AT LEAST ${n} new cards (class '${cls}', ids prefixed ${prefix}): roughly 35% common, 40% uncommon, 25% rare. ${hint} Each card needs an emoji icon (avoid the fog emoji and plain white emoji, they render as blank squares), an exact desc, and an upgrade override. Define any new custom statuses you need (prefix ${prefix}, ids different from every card id). Power level must sit in line with the existing set for this class: no card may be strictly better than an existing card of the same cost and rarity by a wide margin.` })

const newClass = (cls, prefix, theme) => ({ file: 'cards_' + cls + '.js', label: 'class:' + cls,
  prompt: PRE + `YOUR FILE: src/content/cards_${cls}.js
YOUR TASK: a brand-new playable character '${cls}' (id prefix ${prefix}). Model files to read fully first: src/content/cards_tempest.js and src/content/cards_berserker.js (structure, DS.defineCharacter shape, starter relic, quality bar).
Character: ${theme}
Deliver: DS.defineCharacter (id '${cls}', name, title, desc, hp, gold 99, icon, color, starterDeck of 11 ids = 5 Strike + 4 Defend + 2 signature starters, starterRelic); its starter relic (rarity 'starter', class '${cls}'); 4 more class relics (common, uncommon, rare, boss; class '${cls}'); at least 12 custom statuses with triggers; and AT LEAST 70 non-starter cards (about 25 common, 28 uncommon, 17 rare) across attack / skill / power, forming 3 clear archetypes that also cross over. Every card: emoji icon (no fog emoji, no plain white emoji), exact desc, upgrade override.
After smoke passes, check balance with \`node tools/balance.js --runs=20 --char=${cls}\` (a heuristic bot plays full runs; takes a few minutes). Existing classes win 10-45% of bot runs. Tune numbers until yours lands between 15% and 45%, and say the final figure in your report.` })

const TASKS = [
  newClass('artificer', 'af_', 'The Artificer, a brass-fingered inventor (76 HP, color #d08a2e, icon ⚙️). Archetypes: "Constructs" (custom statuses on self that act each turn like turrets: deal damage or grant block at turn start/end, and cards that scale or detonate them); "Overclock" (gain extra energy or draws now in exchange for a self-debuff or status cards later); "Scrap" (cards that exhaust other cards for payoff, and payoffs that count cards exhausted this combat).'),
  newClass('beastcaller', 'bc_', 'The Beastcaller, a wilds-born pack leader (82 HP, color #5fa043, icon 🐺). Archetypes: "Pack" (a custom stacking status representing companions; many small multi-hit attacks that scale with pack size); "Bleed and Hunt" (apply a damage-over-time debuff, then cards that deal more to bleeding or marked targets); "Feral" (cards that get stronger the lower your HP or the more attacks played this turn).'),
  newClass('revenant', 'rv_', 'The Revenant, a knight who refuses to stay dead (74 HP, color #7f8fa6, icon ⚰️). Archetypes: "Grave" (cards that work from or count the discard and exhaust piles, returning cards to hand); "Deathless" (temporary HP / block that carries over, effects that trigger when HP is lost, a once-per-combat survive-lethal power); "Dread" (debuff enemies with weak/vulnerable-like custom statuses and punish debuffed enemies).'),
  moreCards('cards_berserker_3.js', 'berserker', 'bz_', ['cards_berserker.js', 'cards_berserker_2.js'], 30, 'Theme: "Trophies" - cards that grow permanently for the combat each time an enemy dies or each time you play them, plus a few reliable block tools.'),
  moreCards('cards_shade_3.js', 'shade', 'sh_', ['cards_shade.js', 'cards_shade_2.js'], 34, 'Theme: this class is the weakest in mid-game bot runs (it dies in act 2). Give it sturdier defence that fits its style (block tied to cards played or to poison on enemies, weak application) and scaling damage for long fights.'),
  moreCards('cards_arcanist_3.js', 'arcanist', 'ar_', ['cards_arcanist.js', 'cards_arcanist_2.js'], 34, 'Theme: this class dies in act 2 in bot runs. Add efficient block and early scaling, plus a "Runes" sub-theme: cheap powers with small permanent effects that stack.'),
  moreCards('cards_warden_3.js', 'warden', 'wd_', ['cards_warden.js', 'cards_warden_2.js'], 30, 'Theme: this is already the strongest class, so add sideways options, not raw power: "Thorns and Retaliation" payoffs and cards that convert Block into damage at a fair rate.'),
  moreCards('cards_tempest_2.js', 'tempest', 'tp_', ['cards_tempest.js'], 40, 'Theme: deepen Momentum, Gale/Stillness stances and Static; the class falls off in act 3 in bot runs, so add late-game scaling (powers that grow each turn) and at least 8 solid block cards.'),
  moreCards('cards_occultist_2.js', 'occultist', 'oc_', ['cards_occultist.js'], 40, 'Theme: deepen its existing archetypes and add "Pacts": strong effects that add a curse or cost HP, plus cards that profit from curses in the deck or hand.'),
  moreCards('cards_colorless_3.js', 'colorless', 'cl_', ['cards_colorless.js', 'cards_colorless_2.js'], 36, 'Theme: class "colorless" utility cards usable by anyone (draw, energy, tutoring, generic block and damage, potion and gold interactions), plus 4 new curses (ids curse_..., type "curse") and 2 new status cards (ids status_...). Colorless must be slightly weaker than class cards of the same cost.'),
  { file: 'relics_d.js', label: 'relics:d', prompt: PRE + `YOUR FILE: src/content/relics_d.js
YOUR TASK: 40 new relics, ids prefixed rd_. Model files: src/content/relics_a.js and relics_c.js; also read how relic triggers and counters work in src/engine/combat.js and run.js. Mix: 14 common, 12 uncommon, 8 rare, 4 shop, 2 boss (boss relics carry a real drawback). Focus: COMBAT relics with interesting triggers (every Nth card, first attack each turn, on exhaust, on shuffle, on enemy death, when HP is below half, turn-number based). No duplicates of effects that existing relics already have: grep before writing. Each has icon, exact desc and a one-line flavor if the model files use one.` },
  { file: 'relics_e.js', label: 'relics:e', prompt: PRE + `YOUR FILE: src/content/relics_e.js
YOUR TASK: 36 new relics, ids prefixed re_. Model files: src/content/relics_b.js and relics_c.js; also read how run-level relic triggers work in src/engine/run.js (onPickup, rest, shop, gold, rewards, map, events, potions). Mix: 12 common, 11 uncommon, 7 rare, 4 shop, 2 boss. Focus: RUN and ECONOMY relics (rest sites, shops, card rewards, potions, gold, max HP, upgrades, removal) plus about 10 hybrid combat ones. Only use run-level hooks that the engine really fires. No duplicates of existing relic effects.` },
  { file: 'potions_c.js', label: 'potions:c', prompt: PRE + `YOUR FILE: src/content/potions_c.js
YOUR TASK: 30 new potions, ids prefixed pc_. Model files: src/content/potions.js and potions_b.js. Mix of common, uncommon and rare as the models do. Each must do something no existing potion does (grep first): stance-like temporary statuses, card generation, discard/exhaust manipulation, conditional effects based on enemy count or HP, delayed effects through a custom status (prefix pc_). Icon, exact desc, correct target field.` },
  { file: 'enemies_act1_c.js', label: 'enemies:act1c', prompt: PRE + `YOUR FILE: src/content/enemies_act1_c.js
YOUR TASK: a third bestiary wave for ACT 1 (ids prefixed a1_, act: 1). Model files: src/content/enemies_act1.js and enemies_act1_b.js (ids, HP and damage ranges per tier, move/pattern/ai style, encounter shape). Add at least 9 normal enemies, 2 minions, 3 elites, 2 bosses, each with 3-5 moves and a distinct pattern, and at least 4 easy, 10 normal, 3 elite and 2 boss encounters (mix with existing enemies). Theme: a flooded crypt-market: toll ghosts, lantern eels, coin beetles, a drowned auctioneer. HP and damage must match the existing act 1 ranges for the same tier. No encounter may stall: avoid mutual healing loops, and check the smoke output for stall warnings on your encounters.` },
  { file: 'enemies_act2_c.js', label: 'enemies:act2c', prompt: PRE + `YOUR FILE: src/content/enemies_act2_c.js
YOUR TASK: a third bestiary wave for ACT 2 (ids prefixed a2_, act: 2). Model files: src/content/enemies_act2.js and enemies_act2_b.js. Add at least 9 normal enemies, 2 minions, 3 elites, 2 bosses, each with 3-5 moves and a distinct pattern, and at least 4 easy, 10 normal, 3 elite and 2 boss encounters (mix with existing enemies). Theme: a clockwork opera house: stage automatons, mask swarms, a prima donna that buffs her chorus, a conductor boss with a visible tempo mechanic. Act 2 is where weaker classes die, so keep HP and damage at or slightly BELOW the existing act 2 ranges for the same tier. No stalling encounters.` },
  { file: 'enemies_act3_c.js', label: 'enemies:act3c', prompt: PRE + `YOUR FILE: src/content/enemies_act3_c.js
YOUR TASK: a third bestiary wave for ACT 3 (ids prefixed a3_, act: 3). Model files: src/content/enemies_act3.js and enemies_act3_b.js. Add at least 9 normal enemies, 2 minions, 3 elites, 2 bosses, each with 3-5 moves and a distinct pattern, and at least 4 easy, 10 normal, 3 elite and 2 boss encounters (mix with existing enemies). Theme: the storm-wracked summit: lightning wardens, frost-bound titans, mirror knights that copy a buff, an eclipse boss with phases. Keep HP and damage within the existing act 3 ranges for the same tier (do not exceed them). No stalling encounters: at most one healer per encounter and heals must be small.` },
  { file: 'events_d.js', label: 'events:d', prompt: PRE + `YOUR FILE: src/content/events_d.js
YOUR TASK: 24 new events, ids prefixed ed_. Model files: src/content/events_a.js and events_c.js; read how events, conditions and event effects are resolved in src/engine/run.js (getEvent, chooseEvent, runEffects) and use only what exists there. Each event: 2-4 choices with real trade-offs, short atmospheric text (3-5 sentences), result text per choice, and act restrictions where the models use them. Include 4 events that can start a fight (use the existing mechanism exactly as the models do) and 4 that depend on a condition (gold, HP, a relic, a card type). Never offer a choice with no downside AND a strong reward.` },
  { file: 'events_e.js', label: 'events:e', prompt: PRE + `YOUR FILE: src/content/events_e.js
YOUR TASK: 24 new events, ids prefixed ee_. Model files: src/content/events_b.js and events_c.js; read how events, conditions and event effects are resolved in src/engine/run.js (getEvent, chooseEvent, runEffects) and use only what exists there. Theme: recurring characters across the three acts (a travelling cartographer, a debt collector, a child who trades in secrets): 8 events per act, written so that meeting them in any order still reads well. Each event: 2-4 choices with real trade-offs, 3-5 sentences of text, result text per choice. Include gambles with stated odds, card transforms/upgrades/removals, max HP trades and potion rewards.` },
]

const group = 1
const mine = TASKS.filter((t, i) => i % 3 === group)
log('group ' + group + ': ' + mine.map(t => t.label).join(', '))

const results = await pipeline(
  mine,
  t => agent(t.prompt, { ...HAIKU, label: t.label, phase: 'Build' }),
  (built, t) => agent(`You are a careful reviewer on DUSKSPIRE, a Slay-the-Spire-style deckbuilder in plain JS (project root: ${ROOT}). Another engineer just wrote src/content/${t.file}. Their report: """${String(built).slice(0, 1500)}"""
Your job is to find and FIX real defects in that one file (do not touch any other file):
1. Read CONTRACT.md sections 3-7 and 11, then the file in full, then the parts of src/engine/combat.js, statuses.js and run.js that resolve the ops, Value sources, triggers and fields the file uses.
2. For every definition check: does each op / field / 'when' key / status id / card id / enemy id it references really exist? Does the desc text match the effects exactly (numbers, targets, upgraded numbers)? Is anything absurdly strong or useless next to the older files of the same kind? Any id or display name that collides with older content (grep src/content)? Any fog or plain-white emoji icon?
3. Fix what you find by editing the file. Then run \`node --check\` on it and \`node tools/smoke.js\` from the project root and fix every error or warning that names this file or its ids (ignore ones naming other v3 files).
Final message: 3-6 plain lines: how many definitions you checked, what you fixed (specific), and what remains wrong if anything.`, { ...HAIKU, label: 'review:' + t.file.replace('.js', ''), phase: 'Review' }).then(r => ({ file: t.file, built: String(built).slice(0, 600), review: String(r).slice(0, 800) }))
)
return results