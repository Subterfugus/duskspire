# Duskspire — status as of 2026-10-08

Slay-the-Spire-style roguelike deckbuilder. Plain JS, no build step, Electron shell. Built almost entirely by
Haiku 5.5 subagents (high reasoning); the design jobs used Sonnet 5.5 (medium).

## Run it

- Desktop: double-click `run.bat`, or `npm start`
- Browser: `node tools/serve.js`, then http://localhost:8123
- Checks: `node tools/smoke.js` (validator + bot fights), `node tools/tests.js` (406 engine tests),
  `node tools/balance.js --runs=20` (heuristic bot playing full runs)

## Where things stand

**v2 is working.** Smoke passes with 0 errors and 0 warnings, all 406 engine tests pass, and I played it in a browser.

| Content loaded | Count |
|---|---|
| Characters | 6 (Berserker, Shade, Arcanist, Warden, Tempest, Occultist) |
| Cards | 741 |
| Relics | 188 |
| Potions | 65 |
| Enemies / encounters | 130 / 158 |
| Events | 84 |
| Statuses | 188 |

v2 features: ascension 1-10, meta-progression (run history, 32 achievements), settings, resume into any room,
live damage preview, combat log, drag-to-play, history / settings / how-to-play screens, compendium search,
redesigned stylesheet, procedural SVG art, rewritten effects and adaptive music.

**Verified in a browser by me (1280x720):** menu; six-character select with ascension picker; map; a full Tempest
fight played by clicking cards; reward screen (gold claim, card pick); quit to menu and Continue back into the
reward room without losing or duplicating rewards; eight more floors of fights, an event and a treasure room;
history, settings, how-to-play and compendium screens. No game errors in the console.

**Not verified by anyone:** how the audio sounds; the Electron window on v2. See the polish pass section below.

## What happened on day 2

- Integration stage finished. The combat reviewer found nothing to fix. The screens reviewer rewired the room
  screens to the run engine's claim/close API, which is what makes resume work. Sonnet design QA added rules for
  about 100 unstyled classes.
- Balance stage: the card tuner and act 2 tuner finished. The act 1 tuner made its edits but died on its final
  report. The act 3 tuner was stopped mid-run when the tasks looked stuck. Both left valid files.
- I then took over directly: made undiscovered compendium entries readable (`styles.css`) and added a global 15% cut
  to enemy attack damage (`BASE_TUNING` in `src/engine/combat.js`), because the simulator showed most classes
  almost never winning.

## Balance (heuristic bot, 40 full runs per class, after the third tuning pass)

| Class | Win rate | Survives act 1 | Survives act 2 | Survives act 3 |
|---|---|---|---|---|
| Warden | 43% | 98% | 69% | 63% |
| Berserker | 30% | 90% | 56% | 60% |
| Occultist | 20% | 75% | 50% | 53% |
| Shade | 15% | 85% | 38% | 46% |
| Arcanist | 15% | 70% | 39% | 55% |
| Tempest | 13% | 95% | 55% | 24% |

History: untuned v2 was Warden 32% and every other class 0-5%. The bot plays defensively, which flatters Warden.

Tuning applied on 2026-10-08 (all by hand, measured with `node tools/balance.js`):
- Global: enemy attack damage x0.85 (`BASE_TUNING` in `src/engine/combat.js`).
- Hardest bosses and elites cut 8-12% HP and 10-20% damage: Fallen Seraph, Sanctum Idol, Duskspire Heart, Orrery Titan,
  Awakened Void, Siren Queen, Clockwork Colossus, Kraken Mother, Oathbound Twins, Brass Assessor, Plague Priest,
  Hoard Mimic, Drowned Knight, Ashen Gatekeeper.
- Tempest: Momentum now adds +1 attack damage per stack; Wind Bell also grants 2 Momentum each turn; Gust Lash gains
  Momentum before it hits; HP 72 -> 78.
- Warden: HP 88 -> 80; Ironbark Charm 6 -> 4 Block; Sapwell costs 2.
- Shade HP 70 -> 76; Arcanist HP 68 -> 75.
- Choir of the Fallen: Mending Hymn heals only the most wounded enemy for 5 (was 3 to every enemy), and is used less.
  The stalemate warning is gone from the smoke test.

## Polish pass (2026-10-08, later the same day) - stopped part-way at the user's request

Done and checked in the browser at 1280x720 unless noted:
- Played a whole run through all three acts to the victory screen with a scripted autopilot (enemy HP forced to 1):
  map, fights, elites, bosses, shop, rest site and upgrade picker, events (including one that starts a fight),
  treasure, boss relic, act 2 and act 3 backdrops, victory. No game errors.
- After the final boss the game no longer offers a boss relic "to carry on"; it goes straight to victory.
- Quitting mid-fight and choosing Continue now replays the same fight (same enemy HP and opening hand). Each fight is
  seeded from run seed + act + floor + encounter in `src/ui/combat_ui.js`.
- The map now scales with the window (`mapZoom` in `src/ui/screens.js`); checked at 1920x1080.
- Unit art is larger; one or two enemies stand further right instead of bunching mid-screen.
- Character select shows three readable sample cards instead of thumbnails plus a hover preview.
- The "blank square" card icon was the fog emoji, which is drawn as a pale square on Windows. Replaced in 10 places.
- Relic fanfare: smaller rings, and none for the starter relic at run start. Effects are dropped when the window
  stops drawing frames, so they no longer freeze on screen.
- Combat log: wrapped lines stay aligned.
- Smoke: PASS, 0 warnings. Engine tests: PASS. (Both run after most of these edits; the log CSS and final-boss change
  came after and only had a syntax check plus the browser run.)

Not finished:
- Electron on v2 is still unverified. Two scripted launch attempts produced no result because the user closed the
  window on purpose. Do not relaunch it without asking.
- No balance changes were made in this pass. Fresh 40-run sims: Tempest 20%, Shade 8%, Arcanist 10%. Shade and
  Arcanist mostly die in act 2 (34% and 30% survival), Tempest in act 3 (32%). 40 runs is noisy.
- The final-boss reward screen still offers a card that can never be used.
- Not started: README, audio check, settings/history/compendium review at other sizes.

## v3 (2026-10-08, evening)

Loaded content now: 9 characters, 1074 cards, 227 relics (24 of them Trials), 95 potions, 183 encounters, 84 events.

Added:
- Three classes: Artificer (Ottilie Brass, `af_`, Haiku-written), Beastcaller (Wren Ashfang, `bc_`) and Revenant
  (Sir Aldous Vane, `rv_`), the last two each written by one Sonnet 5.5 agent. 70-75 cards, 14-16 statuses and 5 relics each.
- Third card sets for Berserker and Warden, a third colorless set, 30 potions (`pc_`), 17 act 3 enemies.
- Trials (`src/content/trials.js`, `mu_`): optional run modifiers picked on the character screen. They are relics with
  `trial: true`, never drop as loot (`DS.relicPool` in core.js) and scale the score (`scoreRun` in run.js).
- `tools/content_tests.js`: plays every card, potion, relic, encounter and event once and compares simple card text with
  the effect. Fault-injected once: it failed on a Strike whose text and damage disagreed. It does not fail on an unknown
  status id; `tools/smoke.js` does.
- README.md, docs/GUIDE.md, docs/MODDING.md.
- Character screen relaid out for nine classes plus the Trials picker; fits 1280x720.
- Seven cards/relics renamed because they shared a name with something a player could hold at the same time.

Dropped: ten content files the Haiku workflows never finished (shade_3, arcanist_3, tempest_2, occultist_2, relics_d/e,
enemies_act1_c/act2_c, events_d/e). They are deleted and not loaded.

What went wrong: I launched three workflows with a group number in `args`; it did not arrive as a number, so all three
ran group 0 and three agents wrote each of six files at once. The user then asked for no more Haiku and no big workflows.

Checks at the end of v3: smoke PASS (0 errors, 0 warnings), engine tests PASS, content tests PASS (3310 checks).
Browser: Artificer first fight; Revenant and Beastcaller each with every class card added to the deck, six fights.

Bot win rates after v3 (heuristic bot, 40 runs each unless noted, so noisy): Warden 55% (HP now 72), Occultist 45%,
Beastcaller 30% (60 runs), Revenant 28% (200 runs), Shade 28% (50 runs), Artificer 18-23%, Tempest 20%, Arcanist 18%,
Berserker 15%. Starter relics of Shade, Arcanist and Tempest now act every turn and heal after each combat.
The bot plays defensively, which flatters Warden; HP cuts barely move it.

## Known problems

- Class spread is still wide for the bot (Warden 55%, Occultist 45%, the rest 15-30%).
- The Haiku-written v3 content has passed the automated checks but has not been read card by card.
- Revenant cards with custom effects (pile returns, per-debuff damage) do not show that part in the damage preview.
- `combat_ui.js` still injects its own CSS that duplicates rules in `styles.css`. Harmless; left alone.
- Not verified by anyone: audio, the Electron window on v2.
- `backup_v1/` still holds the original working v1 game.

## Repository

Private GitHub repo: https://github.com/Subterfugus/duskspire (branch `main`). Commit and push from this folder.

## How the agents were run

- Current rule (2026-10-08 evening): no Haiku, no big workflows; at most 5 Sonnet agents and only when that is cheaper
  than the lead session doing the work; no Opus agents. The earlier rule was Haiku 5.5 high for everything.
- A single workflow runs at most CPU count minus 2 agents at once (6 on this machine, hard cap 16). To get 20 running
  together, the build was launched as 4 workflows of 5 agents each, with disjoint file ownership per agent.
- Shared spec all agents code against: `CONTRACT.md` (section 10 is v2).
- Totals: v1 used 38 Haiku runs; v2 build 17 Haiku + 3 Sonnet; v2 integration and balance 7 Haiku + 1 Sonnet (two cut short).
- Workflow scripts are in `tools/workflows/` (build.js, fix.js, v2.js, v2fix.js).

## Project location

These files are in a folder the app made for this session; deleting the session deletes the folder. Move the session
to a permanent folder before relying on it.
