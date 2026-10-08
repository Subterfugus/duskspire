export const meta = {
  name: 'duskspire-v2-integrate',
  description: 'Duskspire v2: test-fix loop, UI integration + design QA, balance tuning, final check (Haiku high; one Sonnet medium design QA)',
  phases: [
    { title: 'Test-fix', model: 'haiku' },
    { title: 'Integrate' },
    { title: 'Balance', model: 'haiku' },
    { title: 'Final check', model: 'haiku' },
  ],
}

const ROOT = '<project>'
const HAIKU = { model: 'haiku', effort: 'high' }
const SONNET = { model: 'sonnet', effort: 'medium' }
const NOTES = (args && args.notes) || 'none'

const PRE = `You are an integration engineer on version 2 of DUSKSPIRE, a Slay-the-Spire-style roguelike deckbuilder (plain JS classic scripts on globalThis.DS, Electron shell). Twenty engineers just finished v2 work in parallel against a shared contract.
Project root (Windows): ${ROOT}
FIRST: Read ${ROOT}\\CONTRACT.md completely (section 10 is version 2 and overrides earlier sections). The contract is the source of truth; when files disagree, make them match it. Run node from the project root. A pre-v2 copy of the whole game is in backup_v1/ for reference (never edit it, never load it).
Notes from the v2 builders about problems they noticed (investigate the ones in your files): ${NOTES}

`

const RESULT = {
  type: 'object',
  properties: {
    pass: { type: 'boolean', description: 'true only if the final runs of BOTH node tools/smoke.js and node tools/tests.js succeeded (exit 0)' },
    smokeErrors: { type: 'number' },
    testFailures: { type: 'number' },
    fixed: { type: 'string' },
    remaining: { type: 'string' },
    counts: { type: 'string', description: 'content counts from the smoke report' },
  },
  required: ['pass', 'smokeErrors', 'testFailures', 'fixed', 'remaining'],
}

const testFix = (round, focus) => agent(PRE + `YOUR JOB (round ${round}): make \`node tools/smoke.js\` print "SMOKE RESULT: PASS" and \`node tools/tests.js\` exit 0. Redirect their output to files under tools/ (smoke_out.txt, tests_out.txt) and read those. ${focus}
You may edit any file under src/engine, src/content and tools, plus index.html. Do NOT edit src/ui/* or styles.css.
Also: add src/content/cards_colorless_2.js to the load order in index.html and tools/smoke.js (right after cards_colorless.js) if it is not there yet, and extend CONTRACT.md 10.1 accordingly.
Priority: (1) files that fail to load; (2) exceptions/hangs in engine files — fix root causes; (3) missing v2 APIs from contract section 10 — implement them in the engine; (4) validator/test bugs — fix a check only when the code under test is contract-correct, never weaken a legitimate check; (5) content errors — correct the content to valid DSL; never delete content to silence an error; if content uses a reasonable feature the engine lacks, implement it in the engine; (6) duplicate ids or names across files — rename the newer one and update its references.
Re-run after each batch of fixes; iterate until both pass or you have done at least 8 fix-and-rerun cycles. node --check every file you touch. Report honestly.`, { ...HAIKU, label: `test-fix:${round}`, phase: 'Test-fix', schema: RESULT })

phase('Test-fix')
let tf = null
for (let round = 1; round <= 3; round++) {
  const r = await testFix(round, round === 1 ? 'This is the first v2 integration pass; expect many errors.' : `A previous engineer already did a pass and reported as remaining: ${tf ? tf.remaining : 'unknown'}. Continue from the current state.`)
  if (r) tf = r
  log(`test-fix round ${round}: ${r ? (r.pass ? 'PASS' : `FAIL (smoke ${r.smokeErrors}, tests ${r.testFailures})`) : 'no result'}`)
  if (r && r.pass) break
}

phase('Integrate')
const INTEG = {
  type: 'object',
  properties: { mismatchesFound: { type: 'number' }, fixed: { type: 'string' }, risks: { type: 'string' } },
  required: ['mismatchesFound', 'fixed', 'risks'],
}
const BROWSER = `Browser testing: a static server may already be running at http://localhost:8123 (start one with \`node tools/serve.js\` in the background if not). If you have browser tools, open YOUR OWN new tab (other engineers are testing in other tabs at the same time — never navigate or close a tab you did not create), set a 1280x720 viewport, and drive the real UI. Screenshots can time out; rely on DOM reads and console error checks when they do. IMPORTANT: a previous engineer doing this exact job was interrupted mid-edit yesterday, so the files you may edit can contain half-finished changes (a function partly rewritten, a call to a helper that was never added, duplicated blocks). Read them with that in mind and finish or repair such edits first.`
const integ = await parallel([
  () => agent(PRE + `YOUR JOB: make the v2 COMBAT experience work end to end in a real browser. You may edit ONLY: src/ui/combat_ui.js, src/ui/fx.js, src/ui/audio.js, and src/engine/combat.js (minimal API-preserving fixes). Read (not edit) kit.js, art.js, styles.css, core.js, run.js, screens.js.
Method: read combat_ui.js, fx.js and audio.js line by line. For every DS.* reference verify against the defining file that the name exists and the signature, return shape, event name and payload keys match (c.preview, c.log / 'combat:log', DS.settings, DS.ui.unitArt / potionIcon, DS.art, 'meta:achievement', 'run:*' events, data-combatant attributes). Verify every CSS class they use has a rule in styles.css (report missing ones in 'risks' — the design QA engineer owns styles.css). Then test for real. ${BROWSER} Cover: entering combat with each of the 6 characters; preview badges updating with strength/weak/vulnerable; click-to-play, keyboard play, drag-to-play with targeting arrow, cancel paths; a discard-choice card; X-cost card; power card; potions (all target types); combat log toggle; confirm-end-turn setting; game speed 1x/3x; elite and boss fights (tier classes, art); summons; win → reward; loss → gameover; leaving mid-fight and Continue; no duplicate listeners after 3 consecutive fights; no console errors; the whole hand visible at 1280x720 with 10 cards; fx and audio never throwing (wrap-check by forcing each event once). Fix every bug you find. node --check edited files; \`node tools/smoke.js --quick\` and \`node tools/tests.js\` must still pass if you touched combat.js.`, { ...HAIKU, label: 'integrate:combat', phase: 'Integrate', schema: INTEG }),
  () => agent(PRE + `YOUR JOB: make every v2 NON-combat screen and the app shell work end to end in a real browser. You may edit ONLY: src/ui/screens.js, src/ui/boot.js, src/ui/kit.js, src/ui/art.js, index.html, main.js, and src/engine/run.js (minimal API-preserving fixes). Read (not edit) core.js, combat.js, combat_ui.js, styles.css.
Method: check index.html loads every file from contract sections 1 and 10.1 in order and that each exists. Read screens.js, boot.js, kit.js and art.js line by line; for every DS.* reference verify against the defining file (DS.Run v2 API: start opts, ASCENSIONS, score, resumeTarget, run.room shapes documented at the top of run.js; DS.Meta; DS.settings; DS.art; kit wrappers) that names, signatures, return shapes and awaits match. Verify every CSS class used has a rule in styles.css (report missing ones in 'risks' — the design QA engineer owns styles.css). Then test for real. ${BROWSER} Cover: menu → every menu button; charselect with 6 characters, ascension picker (unlock one by writing a win into DS.Meta), seed field; a full run driven through the real UI for the non-combat parts (you may auto-win fights by killing enemies through the engine); every room type; quit-and-Continue from inside each room type (event, shop, rest, treasure, reward, bossrelic) returning to the same room without duplicated or lost rewards; history screen after a win and a loss; settings changes applying live and persisting across reload; how-to-play; compendium search/filters/tabs with 600+ cards staying responsive; gameover and victory recaps with score and achievements; art rendering on cards, units, relics, potions and backdrops for each screen and act; no console errors anywhere. Fix every bug you find. node --check edited files; \`node tools/smoke.js --quick\` and \`node tools/tests.js\` must still pass if you touched run.js.`, { ...HAIKU, label: 'integrate:screens', phase: 'Integrate', schema: INTEG }),
  () => agent(PRE + `YOU ARE THE DESIGN QA LEAD. You may edit ONLY: styles.css. Read styles.css fully, then kit.js, art.js, screens.js, combat_ui.js and fx.js to see the real DOM and every class in use (including classes built dynamically, e.g. 'ds-card-' + type, 'ds-node-' + type, 'ds-tier-' + tier, 'ds-intent-' + type).
YOUR JOB: a visual quality pass over the whole game. (1) Write a small Node script (in the OS temp dir, not the project) that extracts every 'ds-*' class used in the JS files and lists those with no rule in styles.css; add well-designed rules for every missing one, consistent with the design system at the top of the file. (2) Check for collisions between styles.css and <style> blocks injected by JS files (art.js, fx.js, combat_ui.js) and resolve them on the CSS side. (3) ${BROWSER} Look at every screen at 1280x720 and at 1920x1080: menu, charselect (6 characters), map, combat (5 and 10 card hands, 1 and 4 enemies, elite, boss), reward, shop, rest, event, treasure, boss relic, history, settings, how-to-play, compendium, gameover, victory, modals, tooltips, toasts. Fix overflow/clipping, overlap, unreadable contrast, misalignment, inconsistent spacing, elements hidden behind backdrops (z-index), hand cards clipped at the bottom, text overflow in card descriptions (long descriptions must still fit: scale font down via container queries or clamp), and anything that looks unfinished. Aim for a cohesive premium dark-fantasy look. Do not rename or remove class names. Keep braces balanced (verify with a script). In 'risks' list JS-side visual problems you could not fix from CSS (file, element, problem).`, { ...SONNET, label: 'design:qa', phase: 'Integrate', schema: INTEG }),
])

phase('Balance')
const BAL = {
  type: 'object',
  properties: { changes: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, concerns: { type: 'string' } },
  required: ['changes', 'before', 'after', 'concerns'],
}
const balance = await parallel([
  ...[1, 2, 3].map(n => () => agent(PRE + `YOUR JOB: balance ACT ${n} using data. You may edit ONLY: src/content/enemies_act${n}.js and src/content/enemies_act${n}_b.js (numbers, move patterns, encounter compositions — not ids). Three other engineers are tuning the other acts and the cards at the same time, so judge your act by per-encounter data, not by overall win rate alone.
Method: run \`node tools/balance.js --runs=20\` (and per character with --char) and \`node tools/smoke.js\`; read the per-encounter HP-loss and top-killer tables and the per-tier bot win rates for act ${n}. Targets for the heuristic bot at ascension 0: act 1 normal fights cost on average 4-12 HP, elites 15-30 HP, the boss 25-45 HP; act 2 about 1.3x those; act 3 about 1.6x; no single encounter should kill more than ~2x its share of runs; no encounter should be free (0-1 HP lost on average) except 'easy' tier; fights should rarely exceed 12 turns (elites) or 16 turns (bosses) — fix slogs by trimming HP or block, fix spikes by trimming burst or scaling speed (ritual / strength gain), fix runaway summoners with caps. Also read every enemy in your two files for design bugs: moves that never get used by the pattern/ai, intents that do not match the move's effects, bosses without a real phase change, statuses that are applied but never matter. Make measured changes (10-25% steps), re-run, iterate at least 3 times. node --check your files; \`node tools/smoke.js --quick\` must still pass. Report before/after numbers.`, { ...HAIKU, label: `balance:act${n}`, phase: 'Balance', schema: BAL })),
  () => agent(PRE + `YOUR JOB: card and class balance using data. You may edit ONLY the src/content/cards_*.js files (numbers, costs, upgrade values, descriptions kept exactly in sync with effects — not ids). Three other engineers are tuning enemies per act at the same time.
Method: (1) write a static power audit script in the OS temp dir that loads the game like tools/smoke.js does and, for every card (base and upgraded), estimates value per energy (damage, block, draw ≈ 3 each, energy ≈ 6, status stacks with rough weights, scaling flagged separately) and lists outliers per class and rarity: commons far above 9-10 dmg or 8-9 block per energy, 0-cost cards with no drawback, upgrades that change nothing or less than ~20%, rares weaker than commons, cards whose desc numbers do not match their effects, infinite-loop risks (0-cost draw + energy refunds). (2) run \`node tools/balance.js --runs=20\` per character and compare class win rates and pick/win correlations; the six classes should land within roughly 15 percentage points of each other for the heuristic bot. (3) Fix outliers with measured number changes, strengthen clearly dead cards, and make sure each class's starter deck and starter relic are comparable in strength. Keep every desc exactly matching its effects after edits. Iterate at least 3 times. node --check edited files; \`node tools/smoke.js --quick\` and \`node tools/tests.js\` must still pass. Report before/after class win rates and the list of cards changed.`, { ...HAIKU, label: 'balance:cards', phase: 'Balance', schema: BAL }),
])

phase('Final check')
const final = await testFix('final', `Integration, design QA and balance engineers just made changes. Their notes on suspected remaining problems — investigate and fix those in engine/content/tools files: ${JSON.stringify(integ.filter(Boolean).map(r => r.risks)).slice(0, 6000)}. Balance concerns raised: ${JSON.stringify(balance.filter(Boolean).map(r => r.concerns)).slice(0, 3000)}. Finish with full (not --quick) runs of smoke and tests, and one \`node tools/balance.js --runs=10\` to confirm nothing is wildly off.`)

return { testFix: tf, integ, balance, final }
