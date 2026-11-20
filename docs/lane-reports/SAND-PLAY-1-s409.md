SAND-PLAY-1 READY head=62fb8b2 objective=pass victory=pass defeat=pass replay=pass plans=2 unit=214/214 e2e=85/87 skipped=2 gpu=ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)

# SAND-PLAY-1 (s409): the Hormuz mission loop, finished

Branch `s409/sand-play-1` from main 536087f. Operator co3-sandplay1-t205 (s260). Tested head 62fb8b2; the commit that adds this report changes docs only. No STEER.md ever existed, so no steer entries were acted on. Game rules are unchanged.

## What was built
1. **Objective legible before and during play.** `src/lib/scenarios/objective.ts` derives the protected unit, win and loss text, the gate and the opening briefing from the live scenario config and the same `evaluateEvents` data (one source, built per mount, nothing cached at module level; the snapshot and legacy routes get no objective). A MISSION panel shows PROTECT/WIN/LOSE and the carrier state with distance to the gate edge (informational, never completion). The BRIEFING card is recallable with the BRIEFING button or `B`, and closes with Esc, Enter, TAKE COMMAND, SHOW GATE or the first PLAY. The real `transit-gate` polygon is drawn on the plot with a label, with GATE and NIMITZ focus actions. The opening view is framed on gate plus carrier with the briefing docked right so it covers neither.
2. **Authoritative result.** Status is PENDING / COMPLETE / FAILED from the evaluator only. The result overlay shows the deciding condition and the player-visible record, with PLAY AGAIN, REVIEW RECORD (collapses to a strip) and MAIN MENU. After a result `SimulationSession` refuses orders, speed and engage, `tick` pauses on the result tick, and the UI disables the clock, speed, ENGAGE and ROE commands and shows ORDERS LOCKED. Space and Enter on the focused PLAY AGAIN cannot double-fire (Space is inert there; a double Enter does not dismiss the fresh briefing within 600 ms).
3. **Clean RESET / PLAY AGAIN.** A fresh paused scenario with the briefing, default fog (GOD off), selection, placement and measure modes, target, holds, pinned rings, help and autopause popovers cleared; harmless display choices (tilt, OSINT layers, coverage, autopause settings) survive. No listener or interval accumulation across two replays (probed in the result spec).

## Behaviour changes to note
- The briefing no longer dismisses on any key. A real mouse click over the card closes it rather than reaching the map.
- Escape closes help / autopause settings before the briefing. Two existing specs adapted: `sand-osint-1-rings` (Shift to Escape) and `sand-map-2-plot-facilities` (focus the airbase first, since the opening view now frames the gate). `smoke` help-Escape needed a product fix (above).
- Test-only opt-in `window.__SAND_E2E__` exposes the session handle for read-only checks and test fixtures; never set in normal play.

## Evidence (all on the exact tested head)
- **Failing first:** with the pre-change non-test src restored from 536087f, the new unit tests failed (objective test file cannot load; 3 session.test cases fail: victory holds the clock, reset after a result, pause idempotent); they pass on 62fb8b2.
- **Unit:** 20 files, 214/214 (baseline 193). Covers time alone never wins, an escort alone never wins, the living carrier entering wins, destruction loses, destruction on the arrival tick is a defeat, result terminal; true Nimitz (2740, random pinned to 0.7 to defeat point defence). `plans.test.ts` plays two seeded plans through production rules.
- **Real-GPU E2E, `--workers=1`:** 85 passed, 2 skipped (capture-only), 0 failed, 17.4 min. Baseline was 75/2/0; +10 SAND-PLAY-1 tests. First full run had 3 failures (help-Escape smoke, the facilities spec, an objective spec relying on a non-autopaused RUN); fixed and the whole battery re-run on the final head.
- **tsc:** 3 errors, the baseline ones in `tests/sand-001-unit-placement.spec.ts`. **`npm run build`:** exit 0.
- **Two distinct plans, ordinary UI, default fog, no state injection** (`plan-*.json`, `plan-*-victory.png`): A carrier alone, FLANK, one waypoint on the gate centre by real mouse click (victory about 09:06Z); B Chosin/Mahan/Cole to (56.5, 26.6) at FULL then Nimitz via (57.0, 25.9) then the gate at FULL (victory about 09:43Z). Plan A ended "USS Nimitz entered the transit gate afloat (afloat, damaged)" with losses 2 (its recorded trace, `plan-A-direct-flank.json`, is unchanged); plan B ended afloat, undamaged. [Corrected by SAND-SAVE-1 (OPUS-REVIEW S3 #3): this line first said both plans ended undamaged.] Both then went through the frozen checks and PLAY AGAIN to a fresh paused briefing with GOD off.
- **Defeat + replay in the real UI** (`sand-play-1-result.spec.ts`): loss through the production combat path (30 C-802 in flight, test fixture only, dice pinned), twice, once with waypoint mode armed and once with measure mode armed, the destroyed carrier selected. Space, speed keys, ROE/engage keys, buttons and map clicks do not change state; REVIEW RECORD and Esc do not undo the result; double Enter is one reset; RESET mid-run also returns to the paused briefing; listener/interval counts equal the cold-open baseline.
- **Pixel inspection** DPR 2 at 1440x900 and 1920x1080 (`docs/verification/sand-play-1-s409/*-{1-briefing,2-objective-focused,3-victory-debrief,4-replay-start,5-defeat-debrief}.png`): body text >= 14 px and labels >= 12 px asserted, overlay fits the viewport, canvas size unchanged with panels open. The victory debrief frame uses a test fixture (carrier moved into the gate, decided by the production tick).
- `docs/verification/sand-play-1-s409/battery.txt` records the counts.

## Known limits
- 1280x720 was checked only through the default-viewport specs, not by pixel inspection.
- The victory debrief screenshot is a fixture; the real victories are the two plan runs.
- Each plan takes about 3.5 minutes of real time at 60x.
