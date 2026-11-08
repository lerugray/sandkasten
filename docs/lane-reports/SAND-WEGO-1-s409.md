SAND-WEGO-1 READY head=4827e37 phases=pass queued_fire=pass simultaneous_orders=pass exact_boundary=pass two_plans=pass fog=pass continuous=pass unit=237/237 e2e=93/95 skipped=2 gpu=ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)

# SAND-WEGO-1 (s409): solo WeGo for the Hormuz scenario

Branch `s409/sand-wego-1` from main dbe7c81. Operator co3-sandwego-t221 (s260). Tested head 4827e37; the commit that adds this report and the evidence changes docs only. `/home/ray/ops-s260/co3-sandwego-t221/STEER.md` never existed (checked at CP1, CP2 and CP3), so no steer entries were acted on.

**Solo WeGo is complete only if these checks pass; multiplayer remains unbuilt.** No networking, no lobby, no server-side fog, no save/resume (SAND-SAVE-1 is not included). The README roadmap line "WeGo multiplayer: planned" is still true and was not edited.

## Player-visible change
- The opening briefing has a MODE row: CONTINUOUS or WEGO, and for WeGo a turn length of 1, 5 or 15 min (default 5). The briefing is dismissed explicitly (TAKE COMMAND, Esc or Enter). WeGo is chosen before the run starts and is locked afterwards; RESET and PLAY AGAIN return to the choice.
- In WeGo the game starts held in PLANNING, turn 1. The header shows `TURN n // 5 MIN [PLANNING]`. Time does not move while planning. The player gives the usual orders (waypoints, throttle, ROE, ENGAGE). ENGAGE is staged, not fired: the turn panel shows `FIRE ORDERS STAGED n`, a staged shot can be cancelled and re-staged, and it executes exactly once at commit.
- COMMIT ORDERS (button, or Enter) locks all orders. The AI plans once at that boundary from its own contact store. Both sides then move together for exactly one turn of simulated time (header `[RESOLVING 60X 04:00 LEFT]`). The speed buttons change only how fast the turn plays; results do not depend on speed. SPC pauses and resumes the burst but cannot reopen planning. Orders are refused in the session (not just greyed out) while resolving and in review; inspection (select, look, pan, tilt) still works and the panel says `ORDERS LOCKED: THE TURN IS RESOLVING.`
- At the boundary the game holds in REVIEW. A review card lists your losses, the alerts that autopause would have raised (collected, never interrupting the burst), and the record of that turn, only from what the player's side saw. NEXT TURN (button or Enter) opens planning at exactly that state. The unit detail card is hidden during review so it does not sit under the review card.
- Victory and defeat use the existing SAND-PLAY-1 evaluator and overlay and add `TURNS n COMMITTED // 5 MIN EACH // WEGO`. A victory ends the burst on its real tick and offers no NEXT TURN. PLAY AGAIN returns to a clean briefing.
- Continuous play is unchanged and remains the default. The snapshot route is always continuous. The help panel documents the WeGo Space and Enter behaviour.

## Ray-quote trace
- "it should probably be both singleplayer and wego": both modes ship in one build, picked in the briefing; continuous stays the default and the snapshot and legacy routes never show WeGo (E2E route spec).
- "Headline it too": the WeGo choice is on the first screen the player sees, in the Tom Clancy / Harpoon terminal style (phase strip, turn panel, review card, same fonts and 14 px / 12 px floors).
- Anchor "more player friendly than CMO": no menu hunt; the same terminal orders, one COMMIT ORDERS button with an Enter hotkey, and a short plain-language prompt for each phase.

## Checkpoints
| | sha | content |
|---|---|---|
| CP1 | 56c825e | session turn phases, staged fire, AI boundary planning, exact fixed-step resolution, 23 unit tests (pushed) |
| CP2 | eb7e1d5 | terminal mode choice, planning/resolve/review UI, command lock, first WeGo E2E (pushed) |
| code | a335bb3 | hide unit card during review; victory, defeat, replay and look specs |
| code | 4827e37 | inline `NEXT_PUBLIC_SAND_E2E` so the test handle is absent from ordinary builds (tested head) |
| CP3 | the commit carrying this report | docs and evidence only |

## Design in one paragraph
`SimulationSession` stays the single authority. A WeGo run has a phase (planning, resolving, review) plus the terminal scenario result. Resolution advances the exported engine `simulationStep` in fixed 1000 ms steps with `planAI:false`, filling a simulated-ms budget; presentation speed and frame stalls only change how fast the budget fills, so a stalled frame at 60x cannot overshoot the boundary. The AI is planned once at commit and once more at the next commit, never mid-turn; contacts first seen mid-turn get the existing legal weapons-free auto-fire. Mode lives in the session, not on the shared demo scenario config. Staged fire is validated when staged and again at execution (a stale order is refused and spends nothing).

## Acceptance map (the DONE-line fields)
- **phases=pass**: unit `WeGo session: phases, start state, locks` (6 tests) and the E2E turn-loop test (planning, commit, resolve lock, review lock, next turn).
- **queued_fire=pass**: unit `WeGo staged fire` (3 tests: no side effects until commit, cancel, exactly once, invalid and stale orders lose no ammunition). E2E: ENGAGE with Hornet 101 on turn 2 leaves log length and sim time unchanged between stage and commit (`flow-queued-fire.json`: log 7 before and after staging, sim clock identical, log 20 after the turn).
- **simultaneous_orders=pass**: both sides are applied in one resolution pass. Unit evidence: the AI plans once at commit from its own contact store, and a mid-turn contact gets auto-fire with no replan. E2E evidence is behavioural (both real victories had the AI act in the same turns). I have no separate test that diffs player and AI order timestamps inside a turn; the claim rests on the unit tests above.
- **exact_boundary=pass**: unit `WeGo exact resolution` (speed 60 with a huge stalled frame never overshoots; speed and timer cadence change no outcome; carrier already in the gate wins on its real tick and ends the burst early). E2E review header `ELAPSED 05:00` at the 5 min boundary.
- **two_plans=pass**: two different real victories through the ordinary UI with GOD off, no state writes. See Evidence.
- **fog=pass**: E2E `both sides stay in fog: the review lists only what the player's side saw`, plus both plans run with GOD `false`.
- **continuous=pass**: E2E route test (demo, then the real snapshot, then demo again, then legacy: no WeGo controls or state), unit `continuous keeps its old behaviour`, and the unchanged pre-existing specs (all green).

## Evidence (all on 4827e37 unless noted; `docs/verification/sand-wego-1-s409/`)
- **Red on base:** `red-on-base.log`. With the base `src` restored, `wego.test.ts` fails 22 of 23 (`Tests 22 failed | 1 passed`); all 23 pass at CP1.
- **Unit:** `unit.log`, 21 files, 237/237 (baseline 214, +23).
- **Real-GPU E2E, `--workers=1`, nice 15, `--mute-audio`:** `e2e-full-4827e37.log`: 93 passed, 2 skipped, 0 failed, 27.6 min, `exit=0`, run via `/home/ray/ops-s260/co3-sandwego-t221/work/launch.sh` (gate checks, then the Playwright run). `e2e-full-a335bb3.log` is the same suite one commit earlier (93/2/0, 27.7 min); only `next.config.ts` changed between them. Baseline was 85 passed + 2 skipped; the +8 passes are the new WeGo specs.
- **Named skips (2):** `tests/sand-osint-1-frames.spec.ts` "verification frames at 1440x900" and "... at 1920x1080", skipped by `test.skip(!process.env.SAND_CAPTURE, ...)` at line 15. Capture-only; unchanged from base.
- **tsc:** `tsc.log`, exactly the 3 baseline nullable errors in `tests/sand-001-unit-placement.spec.ts` (lines 72, 80, 100); nothing new. **Build:** `build.log`, `npm run build` exit 0. After the build, `grep -rl __sandSession .next/static` over the emitted JS finds nothing; the string appears only in source maps.
- **Two plans:** `victory-A-direct-flank.json` (carrier alone, FLANK, one waypoint at the gate, plus a Hornet 101 ENGAGE queued on turn 2 that waited for commit; 38 turns, victory 09:06:15Z, `afloat, undamaged`, YOUR LOSSES 2 = both Hornets) and `victory-B-escorted-dogleg.json` (Chosin/Mahan/Cole ahead, carrier by a southern dog-leg at FULL; 45 turns, victory 09:43:27Z, `afloat, undamaged`). Screenshots `*-5-victory-debrief-A.png` and `*-6-victory-debrief-B.png` at both sizes are captured from these real runs. Outcomes vary between runs (the engine dice are not pinned in the real-UI specs): in the earlier a335bb3 run plan A ended `afloat, damaged`. Both runs were real victories; the specs assert VICTORY, not the damage state.
- **Defeat and replay:** `*-8-defeat-debrief.png`, `*-7-replay-start.png`. The defeat is forced with a fixture (`injectKillOnCarrier`) but resolves through the normal WeGo turn path; PLAY AGAIN returns to a clean briefing with no pending intents, phase or messages.
- **Pixel inspection** (DPR 2, 1440x900 and 1920x1080, real GPU): `fonts-1440x900.json`, `fonts-1920x1080.json`: minimum 12 px in briefing, planning and review (labels), 14 px in the status strip; the review card fits the viewport. Captures: `*-1-briefing-mode-choice`, `*-2-planning-orders-gate`, `*-3-resolving-lock`, `*-4-review`, `*-9-gate-flat`, `*-10-gate-tilted`.
- **Raw logs of the targeted runs:** `cp2-targeted*.log`, `cp3-targeted*.log` (includes the few early failures and the fixes). One targeted run was started while another lane's Playwright process was present (`busy=2` at launch); I did not kill it. The two full-suite runs were launched through the gate with the process count at 0.

## Inspection findings (looked at the real captures)
- Briefing: the MODE row, turn-length chips and the one-line explainer are legible and sit above TAKE COMMAND / SHOW GATE. The wording "No time limit..." is the existing SAND-PLAY-1 text.
- Planning: the turn panel, `FIRE ORDERS STAGED 0` and COMMIT ORDERS with its ENT hotkey chip read clearly; the same COMMIT ORDERS button sits in the bottom bar. The tilted gate capture shows the gate as a perspective trapezoid with the WP1 leg crossing it, so the objective is visible in both flat and tilted views.
- Resolving: the header shows time left in the turn; the left panel shows the lock sentence; traffic fills from the burst.
- Review: the review card covers the right part of the map (about the right third at 1440x900). It is intentional (it replaces the unit card) but it hides map content there until NEXT TURN. The map stays pannable. Not changed.
- Victory/defeat overlays show TURNS n COMMITTED and the WeGo tag. In the victory frame the previously selected, now lost Hornet 101 detail card is still showing behind the overlay; harmless, inherited behaviour.
- The defeat record repeats the three opening INTL lines at 06:00:01Z after the five C-802 hits, because the fixture kills the carrier in the first second; real defeats will not look like that.

## S3 dispositions (from `docs/verification/sand-play-1-s409/OPUS-REVIEW.md`)
1. Orders visible in the focused objective frame: planning captures `*-2-planning-orders-gate.png` and the tilted/flat gate captures show orders and the gate. **Done.**
2. Real captures: victory debriefs A and B, defeat and replay are from real E2E runs at both sizes (defeat uses the kill fixture, said above). **Done.**
3. "Both undamaged" claim: that SAND-PLAY-1 statement was wrong (its plan A was damaged, losses 2). This lane states each run's actual deciding line instead and notes that outcomes vary. **Corrected.**
4. Redundant "afloat": the deciding line now reads `entered the transit gate (afloat, undamaged)` (the doubled `afloat` is gone). The mission win line `enters the transit gate afloat` and the live `AFLOAT, UNDAMAGED // n NM TO GATE EDGE` readout (`src/lib/scenarios/objective.ts:62`) are kept: afloat is part of the win condition. **Done for the duplicate; the rest kept on purpose.**
5. Stale HOLD cue under a result: the frozen-result helper now asserts `ENDED` and no `HOLD`; the defeat capture shows `[ENDED]`. **Done.**
6. Opening gate crowded by the 3RD KHORDAD / QESHM labels: **carry, not addressed** (map layout, outside this fence).
7. 26°45'N grid label over the Qeshm Intl glyph: **carry, not addressed.** A nearby label pair (QESHM INTL with 26°45'N) is also tight in the 1440x900 planning capture.
8. `next-env.d.ts` churn: kept out of every commit (restored with `git checkout` before each); every code delta is listed below.
9. Session handle: `window.__sandSession` is exposed only when `NEXT_PUBLIC_SAND_E2E==="1"` and `window.__SAND_E2E__`; `next.config.ts` inlines the variable so ordinary builds dead-code it (checked in the build output above). `playwright.config.ts` sets it for the test server only.
10. Route coverage: the continuous/snapshot/legacy spec navigates demo, snapshot, demo and legacy and asserts no WeGo leak. **Done.**
11. Raw logs and named skips: included above. **Done.**
12. Explicit briefing dismissal plus a tilted gate capture: TAKE COMMAND, Esc or Enter dismisses; `*-10-gate-tilted.png` at both sizes. **Done.** Three existing specs were adapted to the dismissal step (below).

## Every code delta (dbe7c81..4827e37, 14 files, 1,793 insertions, 43 deletions, docs and `next-env.d.ts` excluded)
- `src/lib/simulation/engine.ts` (+20/-): export `simulationStep`; guard so the AI replan runs only when `planAI` is not false.
- `src/lib/simulation/session.ts` (+363): WeGo mode and turn length config, phases, staged fire intents, `commit`, `nextTurn`, `tickWeGo`, `finishTurn`, command locks, alert collection, `configure` and `reset` handling.
- `src/lib/simulation/useSimulation.ts` (+22): callbacks `configureMode`, `commitOrders`, `nextTurn`, `cancelIntent`; env-gated test handle.
- `src/lib/simulation/__tests__/wego.test.ts` (+492, new): 23 tests.
- `src/components/terminal/TerminalPlay.tsx` (+275): mode choice, header tag, phase strip, turn panel, review card, commit and next-turn commands and the Enter hotkey, orders-locked line, result TURNS line, explicit briefing dismissal, unit card hidden in review, deciding-line duplicate removed.
- `src/app/play/terminal.css` (+55): WeGo styles; review card position and scroll cap.
- `src/components/game/help/HelpPanel.tsx` (+3/-): Space line extended, Enter line added.
- `next.config.ts` (+2): inline `NEXT_PUBLIC_SAND_E2E`.
- `playwright.config.ts` (+1): `NEXT_PUBLIC_SAND_E2E:"1"` for the test web server.
- `tests/helpers/sandPlay.ts` (+27/-): frozen-result assert expects ENDED and no HOLD; `wegoState` helper.
- `tests/sand-wego-1-flow.spec.ts` (+570, new): 8 tests (turn loop and lock, fog, plan A, plan B, defeat and replay, route transitions, look inspection at two sizes).
- `tests/sand-map-2-plot-facilities.spec.ts`, `tests/sand-osint-1-rings.spec.ts` (+1/-1 each), `tests/sand-play-1-objective.spec.ts` (+2): briefing dismissal step.
- Platform values, weapons, damage, scenario content and fonts: untouched.

## Remaining risks
- WeGo balance is untuned: the AI plans once per turn, so a 15 min turn gives it long stretches without replanning, and a 1 min turn shifts the feel toward continuous. Only the 5 min default was played end to end.
- The real-UI victories take several minutes of wall time each (38 and 45 turns; the WeGo spec file ran 9.9 min for its 8 tests); a human may find the turn count high.
- The review card covers the right third of the map until NEXT TURN.
- The real-UI plan specs do not pin the engine dice, so plan runs are not bit-reproducible; they assert victory, not damage state.
- Defeat is exercised with a fixture kill, not a naturally lost run.
- Dev-server (next dev) E2E only; the production build was compiled and checked for the handle but not browser-driven.
- Map-layout carries 6 and 7 remain. 1280x720 was not pixel-inspected.
- Multiplayer (sync, lobby, server fog) is unbuilt; this is solo versus the existing AI.
