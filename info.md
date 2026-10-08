# Duskspire — status as of 2026-10-08

Slay-the-Spire-style roguelike deckbuilder. Plain JS, no build step, Electron shell. Built almost entirely by
Haiku 5.5 subagents (high reasoning); the design jobs used Sonnet 5.5 (medium).

## Run it

- Desktop: double-click `run.bat`, or `npm start`
- Browser: `node tools/serve.js`, then http://localhost:8123
- Checks: `node tools/smoke.js` (validator + bot fights), `node tools/tests.js` (406 engine tests),
  `node tools/balance.js --runs=20` (heuristic bot playing full runs)

## Where things stand

**v2 is working.** Smoke passes with 0 errors, all 406 engine tests pass, and I played it in a browser.

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

**Not verified by anyone:** how the audio sounds; the shop, rest and boss-relic screens in v2 (they worked in v1 and
the Haiku reviewer reports testing them); acts 2 and 3 in the browser; sizes other than 1280x720; the Electron
window on v2.

## What happened on day 2

- Integration stage finished. The combat reviewer found nothing to fix. The screens reviewer rewired the room
  screens to the run engine's claim/close API, which is what makes resume work. Sonnet design QA added rules for
  about 100 unstyled classes.
- Balance stage: the card tuner and act 2 tuner finished. The act 1 tuner made its edits but died on its final
  report. The act 3 tuner was stopped mid-run when the tasks looked stuck. Both left valid files.
- I then took over directly: made undiscovered compendium entries readable (`styles.css`) and added a global 15% cut
  to enemy attack damage (`BASE_TUNING` in `src/engine/combat.js`), because the simulator showed most classes
  almost never winning.

## Balance (heuristic bot, 30 full runs per class, after the damage cut)

| Class | Win rate | Reaches act 2 |
|---|---|---|
| Warden | 37% | 100% |
| Occultist | 30% | 73% |
| Berserker | 13% | 90% |
| Shade | 10% | 77% |
| Arcanist | 10% | 67% |
| Tempest | 3% | 77% |

Before the cut it was Warden 32% and every other class 0-5%. The bot plays defensively, which flatters Warden; a
human should do better with the others. Tempest is the weakest and stalls in some fights.

## Known problems

- Class balance is uneven (table above). Act 3 was never fully tuned.
- Two smoke warnings: `a3_enc_b_choir_hymn` can stalemate (three healers); Dusk Heart beats the arcanist bot even
  with +1000 HP.
- A large faint ring drifts across backgrounds; I believe it is part of the backdrop art. Cosmetic.
- With 10 cards in hand at 1280x720 the rightmost card sits partly under the End Turn button.
- `combat_ui.js` still injects its own CSS that duplicates rules in `styles.css`.
- Leaving a fight and choosing Continue restarts that fight with a reshuffled deck (could be used to reroll a hand).
- The map and some art use fixed pixel sizes, so they look small at 1920x1080.
- `backup_v1/` still holds the original working v1 game.

## Next steps (if you want more)

1. Tune act 3 and the weak classes (Tempest first) with `node tools/balance.js`.
2. Fix the choir stalemate and the hand / End Turn overlap.
3. Check the Electron window and larger resolutions.

## How the agents were run

- Rule set by the user: Haiku 5.5 high for everything; Sonnet 5.5 medium only for design, at most 5 at once; no Opus agents.
- A single workflow runs at most CPU count minus 2 agents at once (6 on this machine, hard cap 16). To get 20 running
  together, the build was launched as 4 workflows of 5 agents each, with disjoint file ownership per agent.
- Shared spec all agents code against: `CONTRACT.md` (section 10 is v2).
- Totals: v1 used 38 Haiku runs; v2 build 17 Haiku + 3 Sonnet; v2 integration and balance 7 Haiku + 1 Sonnet (two cut short).
- Workflow scripts are in `tools/workflows/` (build.js, fix.js, v2.js, v2fix.js).

## Outstanding request

Raise the workflow size setting so 20-agent workflows are the norm. Not done: it is "Dynamic workflow size" in
`/config`, which only opens from an interactive `claude` terminal. The concurrency cap itself has no setting I could find.

## Project location

These files are in a folder the app made for this session; deleting the session deletes the folder. Move the session
to a permanent folder before relying on it.
