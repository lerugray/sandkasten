@@HEADLINE@@

# SAND-SAVE-1 (s409 / s420co3): save and resume a battle

Branch `claude/sand-save-1-lane-mmiq6g`, from main `69ee411d` (brief `5b5f249`). Owner: backup-account cloud session, Sonnet 5.5. No reviewer was launched (GS assigns the one Opus review after CP3). GS owns merge, the real-GPU land battery and main.

**Why PARTIAL, not READY.** Everything the card builds is done and demonstrated through the real controls (fresh-page resume to a real victory, second plan, refusals, terminal fixture, snapshot, navigation). What is missing is the card's full-suite battery: the existing 105-spec Playwright suite cannot give meaningful totals on a machine with only a software renderer (see Battery), and the serial real-GPU run is GS's by the card. Unit, typecheck and production build are complete.

## What a player gets

- **SAVE BATTLE** (top bar and the debrief): pauses at one atomic checkpoint and offers a file `sandkasten-<scenario>-T+HHhMMm-<stamp>.sandsave.json` as a browser download. The notice says the file was handed to the browser and that Sandkasten cannot confirm it reached the disk, and that generated media is not saved. A failed export shows SAVE FAILED with the reason (tested by forcing `URL.createObjectURL` to throw).
- **LOAD BATTLE**: local file picker; the whole file is checked first; the dialog previews scenario, mission clock, state (in progress / victory / defeat) and mode; replacing a run needs an explicit REPLACE CURRENT BATTLE; Cancel, Esc, a bad file or a failed restore leave the battle as it was. Loading opens the game paused on a rebuilt view (selection, targeting, waypoint mode, measure, God mode, dialogs, HOLD cues and the media feed all start clean; default fog).
- Works for the Hormuz battle (continuous and WeGo, including phase, staged fire orders and the last turn report) and the committed neutral snapshot. A save from one route loads on the other and switches the whole session to that built-in configuration (the address is updated); RESET / PLAY AGAIN then restart that configuration.

## Format, compatibility, rejection

`format: "sandkasten-battle-save"`, `version: 1`, `configId` (`hormuz` | `snapshot`), `configRevision` = `sand-rules-1.<digest of every simulation profile, SIMFIX_PROFILES overrides included>.<digest of the scenario, missions, doctrine and event definitions>`. Static definitions never travel in the file. Anything other than version 1, a known id and the identical revision is refused with a reason (no migration). `RULES_REVISION` in `src/lib/scenarios/builtins.ts` must be bumped by hand when a rule changes without a data change.

Validation (`battleSave.ts`): 8 MB bound before parsing, JSON parse (a truncated file fails here), then every field is checked and **copied into new objects** (unknown keys are dropped, `__proto__`/`constructor` keys refused): finite numbers in ranges, enums, platform ids that exist, unique ids, every cross-reference (orders, contacts on both sides, weapons, expenditure, cooldowns, AI sets, fired-event names, WeGo intents), side and scenario identity. The restored session is built first (`SimulationSession.restore`) and only then swapped in by remounting the view, so nothing can be half-replaced.

## State inventory (all in the file; Maps/Sets encoded as arrays)

Scenario id/revision, player side (checked against the built-in), clock, speed, sides and every unit including spawned and destroyed ones with accumulated damage, orders (waypoints, throttle, held speed, radar, ROE/doctrine), score, reference points, schedule (detection, AI and engagement due times), runtime side and mission doctrine overrides; player contacts and every other side's contact store (classification, uncertainty, fix ages); weapons in flight, spent weapons and defences, cooldowns, combat log; fired events, interval bookkeeping, messages with read flags, the scenario result with its source event; AI patrol indices and started/completed transit sets; autopause preferences; WeGo phase, turn window, committed count, staged intents and sequence, report, loss baseline, cursors, resolve budget; the contact-id and weapon/log-id counters (restore raises the module counters to at least the saved value and above every id in the file, never lowers them). Not saved on purpose: pending autopause cue and seen-trigger set (cleared on load), order-feedback text, all UI state, and **the generated InfoWar media feed** (stated beside both controls, in the load dialog and in the README; the feed starts empty and its cursors are seeded to the restored log lengths so history is not regenerated; callbacks from a discarded view are ignored).

## Checkpoints

| | SHA | Content |
|---|---|---|
| CP1 | `670dced` | codec, validation, `checkpoint()`/`restore()`, id floors, builtins registry; 16 unit tests |
| CP2 | `33d54f1` | SAVE/LOAD controls, config ownership (no module swap), paused restore, media lifecycle |
| evidence | `f9550c3` | first real-play checkpoint, resume, second plan, specs, README |
| CP3 | `87737e8` | Esc owned at document level, lifecycle spec, probe script, S3 #3, notes |
| final | see headline `head=` | final-build receipts and this report (code identical to CP3) |

CP1 tests were written together with the code (not strictly failing-first); the rejection and round-trip cases go red if the codec is removed or weakened.

## Receipts (`docs/verification/sand-save-1-s409/`)

- **Real checkpoint** `real-checkpoint.sandsave.json` (19762 bytes, `sandkasten-hormuz-T+00h10m-20261109-223006.sandsave.json`), downloaded by the browser from the real SAVE BATTLE control while time was running: clock 2026-03-15 06:10:00Z, 28 combat-log entries, spent: ir-f14-1 AIM-54A Phoenix x4, us-fa18-2 AGM-84 Harpoon x2, us-fa18-2 AIM-120C AMRAAM x2, us-fa18-1 AGM-84 Harpoon x2, us-fa18-1 AIM-120C AMRAAM x4, ir-f4-2 AIM-7E Sparrow x4, ir-f4-1 AIM-7E Sparrow x2, own aircraft lost, 6 player contacts and 7 AI contacts in the file, Nimitz ordered to the gate at FLANK. The tab was then closed.
- **Fresh-page resume** (`resumed-run.json`, attempt 1 of at most 3): a new browser context opened /play (new run), LOAD BATTLE with that file, previewed, confirmed; it came up paused at 2026-03-15 06:10:00Z with the saved orders, ammunition, log, units, fired events and score (asserted equal), no briefing, no stale cue, time unchanged after 3 s paused. Resumed at 60x with ordinary controls to **VICTORY** at mission hour 3.10: DECIDED BY USS Nimitz entered the transit gate (afloat, undamaged). YOUR LOSSES 1 // HOSTILE KILLS CONFIRMED 5. Ammunition never fell below the saved counts and no event fired twice.
- **Second plan from the same unchanged file** (`second-plan.json`): Nimitz: CLEAR WAYPOINTS (the saved plan was one waypoint at the gate); Nimitz: waypoint 1 at 57E 25.9N; Nimitz: waypoint 2 at 56.45E 26.65N; Nimitz: throttle FULL (the saved plan was FLANK); Nimitz: radar toggled (EMCON change). Outcome: **VICTORY** at mission hour 3.69. The saved file was byte-identical afterwards.
- **Network:** the lifecycle run blocked every request except the game's own pages (and its Ollama/snapshot proxies); the page asked for basemap tiles, web fonts and the optional LLM probe, all blocked, no other host (`network-and-lifecycle.json`: 4 distinct blocked URLs, 0 outside that list, 0 page errors). Save and load worked throughout.
- **Lifecycle:** after five repeated loads (each with God mode on and a unit selected) window listeners / intervals stayed at 21 / 2 every time; demo, snapshot, demo client navigation, back/forward, reload and both legacy routes ran with no page error.
- **Defeat fixture** (`defeat-fixture-note.txt`, labelled): 30 C-802s put in flight at Nimitz through the production combat path with fixed dice, saved from the real debrief, loaded in a fresh page: DEFEAT debrief, frozen commands (`assertFrozen`), no HOLD cue, PLAY AGAIN to a fresh paused briefing. Not a real-play defeat.
- **Refusals** (lifecycle test 1): HTML, truncated, empty, wrong version, wrong revision, unknown scenario, null number, duplicate id, dangling reference, 9 MB, PNG bytes: each shows its reason, disables confirm and leaves the battle byte-identical; rapid picks (last wins), Esc, CANCEL, five rapid LOAD clicks (one dialog), a double-click confirm (one load), shortcut keys under the dialog (no effect).
- **Pixels** (DPR 2, 1440x900 and 1920x1080, `frames.json` has hashes): `save-notice`, `load-dialog-preview`, `load-validation-error`, `resumed-objective-flat` and `-tilt` (Nimitz selected, its waypoint, gate legible), `resumed-real-victory-debrief`, `second-plan-debrief`, `loaded-defeat-debrief`, `loaded-defeat-play-again`, `snapshot-and-demo-after-loads`. Body text 14 px and labels 12 px or more in the new dialogs; the plot canvas size is unchanged.
- Logs: `logs/` (unit, tsc and untouched-base copies, builds, prod handle probe, flow and lifecycle runs, partial existing suite).

## Battery (exact numbers, raw output in `logs/`)

- **Unit:** `logs/unit.txt` 306/306 passed (25 files); untouched base `69ee411d` was 290/290 (24 files, `logs/unit-base-untouched.txt`). The extra 16 are `battleSave.test.ts`.
- **Typecheck:** `logs/tsc.txt` exit 2 with exactly the three errors in `tests/sand-001-unit-placement.spec.ts` that the untouched base has (`logs/tsc-base-untouched.txt`). No new error. `next build`, which type-checks `src`, passes.
- **Production build:** `logs/build_prod.txt` exit 0 (normal build, no test flag). `logs/prod-handle-check.txt`: with `window.__SAND_E2E__` set by the page, `window.__sandSession` is `undefined` and no built JS chunk contains the handle name (S3 #9; the flag `NEXT_PUBLIC_SAND_E2E=1` that the Playwright server sets was already the gate at base).
- **E2E (this lane, serial `--workers=1`, software WebGL):** `sand-save-1-flow.spec.ts` and `sand-save-1-lifecycle.spec.ts`, results below and in `logs/`. The lifecycle snapshot/navigation test had red runs first: a too-strict network assertion (it also counted the page's own basemap/font requests and the local platform API) and a timeout from running beside another suite; both were test-side, fixed, and it then passed alone (`logs/life5.txt`). The Esc-at-document-level fix landed after the first flow runs, so the flow spec was re-run on the final build. Named skips: none.
- **Existing suite:** started with `--grep-invert SAND-SAVE-1` and stopped at 28 of 105 started (27 finished: 24 passed, 3 failed; `logs/e2e-existing-suite-partial-swiftshader.txt`). All 3 failures are at `helpers/sandPlay.ts:23`: `openPlay` requires the plot to draw more than 30 frames within 60 s, and software WebGL here draws about 1 frame per second at DPR 1 (0.5 at DPR 2). That is the environment, not a product failure, but it means I cannot report a total for the existing suite. **GS's serial real-GPU run is the proof for the 85-spec baseline intent and was skipped here, as the card says.** My specs use their own 3-frame gate (`openPlayLite`).
- `gpu=` ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver). Cloud Chromium via `SAND_E2E_CHROMIUM` / `SAND_E2E_SWIFTSHADER` (new, in the README; no effect when unset).
- The server for these runs was a build with `NEXT_PUBLIC_SAND_E2E=1` served by `next start` (the dev server's error overlay intercepted clicks because the container has no internet for the basemap; dev-only).

## S3 dispositions (numbering from OPUS-REVIEW.md)

1, 2: done with real captures (resumed focused objective with Nimitz selected and its waypoint, flat and tilt; a real resumed victory debrief; 1440x900 and 1920x1080, DPR 2). 3: corrected in `SAND-PLAY-1-s409.md` (plan A afloat damaged, losses 2; trace untouched). 4: already single-worded at base (`entered the transit gate (afloat, damaged)`); now pinned by an assertion on the real debrief. 5: already suppressed at base for the ended state; now asserted after a real victory, after the loaded defeat and after every load (no autopause cue in header or traffic). 6, 7: **remain** (opening gate/site-label crowding, grid label over the Qeshm glyph): map-layout work outside this slice, nothing new introduced. 8: no `next-env.d.ts` or build output is committed (restored before every commit; `tsconfig.tsbuildinfo` ignored); the tracked changes are code, tests, README, notes, one report line and receipts, not docs-only. 9: see Battery. 10: exercised (client navigation demo to snapshot to demo, back/forward, reload, both legacy routes, cross-route loads). 11: raw logs, exits, renderer and the partial-suite explanation are in `logs/`. 12: selecting briefing text (triple click) does not close it, asserted after restore; tilt objective legibility after restore captured.

## Known limits

- A checkpoint made by one build is refused by another if any simulation profile or built-in definition changed: by design, with a clear message.
- A save contains the AI's contact store and full unit truth (it is a save file); the loaded UI stays in default fog.
- The browser decides where a download goes; no disk-write verification is possible.
- Resumed runs use the real dice: attempts and outcomes are recorded, not promised.
