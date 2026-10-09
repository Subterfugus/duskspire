# Duskspire

Duskspire is a single-player roguelike deckbuilder in the style of Slay the Spire. You pick a champion, build a deck
as you go, and fight your way through three acts of branching maps. Each act ends in a boss. Winning the third act's
boss wins the run, and a run that ends early still counts toward your score.

The game is plain JavaScript. There is no build step and no npm runtime dependencies. It runs in a browser or inside an
Electron window.

- Player guide: [docs/GUIDE.md](docs/GUIDE.md)
- Adding content: [docs/MODDING.md](docs/MODDING.md)
- Shared build contract: [CONTRACT.md](CONTRACT.md)
- Status notes from the build: [info.md](info.md)

## Running it

Pick one of these.

1. Windows, double-click `run.bat`. If `node_modules` is missing, the script runs `npm install` first, then starts the
   game with `npm start`.
2. Any platform, from a terminal in the project folder: `npm install`, then `npm start`. This opens the Electron window.
3. In a browser: `node tools/serve.js`, then open http://localhost:8123. Set the `PORT` environment variable to use another
   port. This route needs no `npm install`, because the server only uses Node's built-in modules.

Node.js must be installed for all three routes. npm is only needed for the Electron window; the only development
dependency is `electron`.

## Controls

Mouse: click a card to play it, or drag it onto its target. Click an enemy to pick it as the target. Click a potion in
the top bar to use it. Hover over cards, enemy intents, statuses and relics to read what they do.

Keyboard in combat:

| Key | Action |
|---|---|
| 1 to 9, 0 | Play the card in that hand position. |
| E or Space | End your turn. |
| Arrow keys | Move the target while choosing one. |
| Enter or Space | Confirm the target. |
| Esc | Cancel a card you are targeting or dragging. |
| L | Show or hide the combat log. |

Elsewhere, Esc closes the top dialog. In the Electron window, F11 toggles fullscreen.

## Features

- Several playable characters, each with its own card class, starter relic and archetypes. More are in progress.
- Three acts. Each act is a branching map of fights, elite fights, shops, rest sites, events and treasure rooms, ending
  in a boss followed by a boss relic choice.
- Combat with energy, block, enemy intents you can read ahead, statuses, potions and relics. Hover a card to see the
  damage or block it will do right now.
- Ascension levels 1 to 10 that make the game harder, unlocked per character by winning.
- Trials: optional run modifiers, chosen on the character screen, that raise or lower the score.
- Seeds. The same champion, seed and ascension give the same map and rewards.
- Saves that resume at the exact room you left. A fight you quit mid-way starts again from the beginning.
- A run history with achievements, a compendium with search, and a how-to-play screen with a glossary.
- Settings for game speed, volume, music, confirming the end of a turn, screen shake, the combat log and fullscreen.
- Art is drawn procedurally as SVG, and sound is synthesized in the browser. No image or audio files are shipped.

## Project layout

```
index.html          page shell and the script load order
styles.css          all styling
main.js             Electron main process: one window that loads index.html
run.bat             Windows launcher
package.json        npm scripts and the electron dev dependency
CONTRACT.md         the shared build contract: names, data shapes, id prefixes, load order
info.md             status notes from the build
docs/               player guide and modding guide
src/engine/         core.js (registries, events, helpers), statuses.js, combat.js, run.js (run, map, rewards, save)
src/content/        data files: cards, relics, potions, enemies, encounters, events, trials
src/ui/             kit.js, art.js, audio.js, fx.js, screens.js, combat_ui.js, boot.js
tools/serve.js      static server for the browser route
tools/smoke.js      content validator and bot fights
tools/tests.js      engine unit tests
tools/balance.js    heuristic bot that plays full runs and reports win rates
tools/engine_selftest.js   headless self-test of the core engine files
tools/workflows/    the orchestration scripts used to split the build across agents
backup_v1/          a snapshot of the first version, kept for reference and not loaded by the game
```

Every file in `src/` is a classic script wrapped in a function that attaches to one global, `globalThis.DS`. The engine
and content load first, then the UI.

## Checks

Three commands check the project. Run them from the project root.

```
node tools/smoke.js               validate every content file and run bot fights
node tools/tests.js               run the engine unit tests
node tools/balance.js --runs=20   play full runs with a heuristic bot and print win rates per character
```

- `node tools/smoke.js` checks each definition's shape and id prefix, checks that the script tags in `index.html` match
  the load list, and runs a set of fights and simulated runs. `--quick` skips the simulated full runs. `--only=text`
  prints only the errors and warnings that contain the text. It exits with code 1 when there is an error.
- `node tools/tests.js` runs the engine tests. `--only=text` runs the tests whose name contains the text, and `--list`
  prints the names. It exits with code 1 when a test fails.
- `node tools/balance.js` is a heuristic bot, not a human player. Its win rates are a rough guide to balance, not a
  verdict on it. Options: `--char=id` for one character, `--asc=N` for an ascension level, `--runs=N` for the number of
  runs per character.

## Known gaps

- The Electron window has been checked less than the browser build.
- Audio has not been judged by ear.
- The balance numbers come from a bot, which plays defensively, so they are a rough guide only.
- Some characters from the next content pass are placeholders. Until their card files are finished, `node tools/smoke.js`
  reports errors for them.

## How this was made

Duskspire was built by many Claude subagents running on Claude Haiku 5.5, coordinated by a lead Claude session. Each
subagent owned a small set of files and worked against one shared document, `CONTRACT.md`, which fixes names, data
shapes, id prefixes and the script load order. The orchestration scripts are in `tools/workflows/`. The design and QA
passes used Sonnet 5.5, as recorded in `info.md`.

## Licence

No licence is specified in this repository.
