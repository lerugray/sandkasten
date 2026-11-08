OPUS-REVIEW REJECT head=4749f6f base=63db2188 answer=PARTLY S1=0 S2=1 S3=9

# SAND-VICTORY-1 independent end review (co3-sandvicrev-t277, Opus 5.5, 2026-11-08)

**Does a player now get an open-source CMO equivalent that is more player friendly than CMO: PARTLY.** On the shipped Hormuz scenario, the end of a run is now clearer than in CMO: the debrief names the rule that ended it, shows the score next to the result and says the score did not decide the ending. PLAY AGAIN opens a clean briefing. However, the rule presenter can still tell a player "no time limit" when a scenario has a timed ending that forces another event.

- **Wins or loses on the scenario's own victory conditions:** YES. The result comes from the evaluator's `EndScenario` with additive `source` provenance. Two real UI victories end on "Transit Complete".
- **Understands which rule ended the run:** YES for Hormuz and for every directly triggered ending that can be stated. NO for one class: endings reached by `TriggerEvent` (see S2-1). There the briefing makes a false statement, although the debrief correctly falls back to "not part of your briefing".
- **Can play it again a different way:** YES. PLAY AGAIN after run 1 (continuous, Nimitz alone) led to run 2 (WeGo, escorted dog-leg). The receipt shows a fresh state between them.

## Blockers

**S2-1: the briefing claims "No time limit" while a timed event forces the loss.**
- Repro (unit probe, run and deleted):
  - Add to `demoScenarioConfig` one event `{name:"Deadline", triggers:[{type:"Time", time:start+1h}], actions:[{type:"TriggerEvent", eventName:"Carrier Lost"}]}`.
  - `describeEndings` returns `limited:false` with only the two transit rules. `missionLines(...).notes` is "No time limit. Escort ships, score and the clock cannot complete or fail the mission."
  - `evaluateEvents` at start+1h+1 ms returns `defeat` with `source {event:"Carrier Lost", forcedBy:"Deadline"}`.
- Why it matters: this is the false "time cannot end a mixed scenario" statement and the dependency-as-independent-ending case that BUILD 1 forbids. `endings.test.ts:185` covers forced events only in `explainResult`, never in `describeEndings`.
- File: `src/lib/scenarios/objective.ts`, `describeEndings` and `isPureTransit`. The loop skips events with no `EndScenario` of their own, so the forcing event is never examined.
- Fix direction: walk `TriggerEvent` actions transitively. When any event can force an ending event, mark `limited=true` and do not treat the target as pure transit. The "no time limit" note then never appears. Add a `describeEndings` fixture for the forced chain.
- Not reachable in shipped Hormuz content. It is reachable by any authored or edited scenario, and those are the mixed scenarios this lane exists to describe truthfully.

## 1. Diff findings (`git diff 63db2188 4749f6f`; src/ read in full, tests and evidence sampled)

- **Fence.** Product edits stay inside the owned files: objective.ts, events.ts, session.ts (one line: stageEngage label), TerminalPlay.tsx, terminal.css, the new `simulation/trackNumber.ts`, a TacticalPlot.ts re-export only, HelpPanel.tsx and README.md. `engine.ts`, `combat.ts`, scenario content and config are untouched. There is no save, export, reload or persistence work; README says "No save or export (SAND-SAVE-1 is not built)". No new ordinary-build hook: the only hook is the existing `window.__SAND_E2E__`-gated `__sandSession` in `useSimulation.ts`, which is not in this diff.
- **Presenter does not evaluate rules.** `describeEndings`, `explainResult` and `endingNotes` read the event definitions only; no game state is consulted.
- **Hidden information.**
  - Dropped and counted as `limited`: `UnitDetected`, `TimeInterval`, `RandomChance`, `EventHasFired`/`EventHasNotFired`, `SideIs`, hostile-side or hostile-owned areas, unknown sides, and events with no own triggers.
  - Hostile named `UnitDestroyed` targets are unsaid before the result. After it they appear only as "a designated hostile target".
  - Forced results show "unstated" in the debrief.
  - Gap: the forced chain in the briefing (S2-1).
- **Provenance.** `source` is stamped inside the existing `mergeResults` call. Strictly-greater priority keeps the first result among equals, and the test "first of equals stands" covers it. Forced runs carry `forcedBy`. Engine merge and tick order are unchanged.
- **Score cause note.**
  - `usesScore`: shows "THE SCORE DECIDED THIS ENDING".
  - Transit win or loss, and other non-score rules: show "SCORE IS A TALLY…".
  - Unstated causes: no note.
  - Score values are rendered from `gameState.score`, which `createInitialGameState` seeds with 0 per side, so a zero score is shown. The terminal-tick `ChangeScore` is covered by `terminal.test.ts:204`.
  - Edge case: S3-1.
- **Frozen clock.** The session's `ended` guard blocks every order and time path (tick/step/commit/nextTurn/issue*). In the UI, Space acts only on the bare body and only when not ended and not WeGo review. Enter while `recordHold==="review"` returns early. `leaveHeldRecord` stamps `turnKeyAtRef`, so the same keystroke cannot also open the next turn. The `1`–`6` keys are guarded by `!ended`.
- **PLAY AGAIN and RESET.** Both use `handleReset` → `session.reset()`, which rebuilds gameState, eventState (cloned from config), combat, AI, intents, report and cursors. The UI clears selection, target, record view and filters, hold/reviewing, measure, help and GOD. `replay-rounds.json` shows listener and interval probes at 3/25/3 before and after each of two rounds.
- **Space vs Enter on PLAY AGAIN.** `swallowSpace` on keydown and keyup, so Space does nothing. Enter and click replay. A 600 ms guard stops a doubled Enter from also dismissing the new briefing.
- **c386c11.** This commit changes only `tests/helpers/sandPlay.ts`: two calls get `{timeout:2000}` and a `.catch`. The loop is still bounded by `timeoutMs` and ends with `expect(overlay).toBeVisible()`, so a real product hang (no result) would still fail. It cannot mask a hang. The 14/14 `--repeat-each=2` receipt is in `final/e2e-helper-fix-verify.log`.

## 2. Acceptance table

| Card item / FINISH check | Verdict | Receipt |
|---|---|---|
| Red then green | PASS | `unit-red-on-base.log`: 24 failed / 232 passed on base source. My own unit run: 286/286, exit 0 (`nice -n 15 npm run test:unit`, 24 files) |
| Truthful rule descriptions, no second evaluator, no leaks | **FAIL** | S2-1 (forced chain shown as an independent rule plus a false no-time note). Everything else PASS (`endings.test.ts`, 15 fixtures) |
| Hormuz needs the living Nimitz; same-tick arrive+destroy = defeat | PASS | `terminal.test.ts:167` |
| Result provenance, priority, forced provenance | PASS | `events.test.ts:119-140` |
| Debrief: outcome, message, cause, final score with sides, clock, losses, record | PASS | Frames play1/play2/fixture debriefs; `two-plays.json` debrief text |
| Score matches final authoritative score, unchanged in review | PASS | `terminal.test.ts:204`. Fixture frame: seeded 40 + shipped 10 = 50, same as the top bar |
| Replay clears result, provenance, score, fired events, intents, log, target, filters | PASS | `replay-rounds.json` (2 rounds), `two-plays.json` `freshAfterReplay`, replay-clean frames |
| Held review / record navigation stays read-only; Enter/Space safe | PASS (code + spec) | `sand-victory-1-replay.spec.ts`. Code read above |
| Two viable solutions through the UI, GOD off, PLAY AGAIN between | PASS | `two-plays.json`: run 1 continuous FLANK, losses 2 / kills 3. Run 2 WeGo 45 turns dog-leg plus escorts forward, losses 1 / kills 6. godMode null. The early-run frames show a different independent run (kills 2, 78 records), so the runs are real and not replayed copies |
| Defeat / draw / score endings | PASS (labelled fixtures) | Fixture frames. Carrier loss uses fixed dice through the production combat path, as the card allows |
| S3-3 staged ENGAGE receipt | PASS | Frame: `HORNET 101 -> TN9484 DET: LAUNCHED` in the turn-2 review. `plan-A-direct-flank-wego.json`. Refusal is a labelled fixture (turn 3) |
| S3-4 strip / title clip | PASS | `strip-intersections.json` (hits [] at both sizes); hold strip in the record-last-turn frames is clear of the Nimitz title |
| S3-7 one track number | PASS | Selector, staged row, "Staged: … TN9484 DET" and receipt all match in the frames. `data-contact-id` is asserted in the spec |
| Full E2E on the final code SHA | UNPROVEN | 102/105 on 8c41ebf (1 harness stall, 2 capture skips). Not re-run on c386c11. The GS land battery owns this |
| tsc | Not clean (pre-existing) | exit 2, 3 errors in `tests/sand-001-unit-placement.spec.ts`, same as base per the report |

## 3. Look: frames (56 of 56 opened by this reviewer)

The terminal register holds: phosphor green on black, bracketed section heads, monospace, red only for hostile/alarm, no SaaS chrome. The debrief reads as a terminal after-action report. New text is ≥12 px at DPR 2. No new overlap was found on any titles or controls. A new player can see which rule ended the run, what the score meant, and that PLAY AGAIN or VIEW RECORD comes next.

| # | frame | verdict | note |
|---|---|---|---|
| 1 | `1440x900-final-record-strip.png` | SHOWN-OK | strip "[VICTORY] PLAY AGAIN DEBRIEF" at 360,96 below OSINT row, clear of mission panel; no detail panel open in this frame |
| 2 | `1440x900-fixture-carrier-loss-defeat-debrief.png` | SHOWN-OK | DEFEAT red; destroyed by TN2000 CLS (fog-safe); tally note; mission FAILED; fixture (fixed dice) |
| 3 | `1440x900-fixture-score-draw-debrief.png` | SHOWN-OK | DRAW; Iran score is at least 5; 10 // 5; SCORE DECIDED |
| 4 | `1440x900-fixture-score-victory-debrief.png` | SHOWN-OK | VICTORY "Fixture: score line reached."; Ending rule met: US Navy score is at least 40; FINAL 50 (40 seeded +10 shipped) = top bar; SCORE DECIDED; mission panel lists VICTORY score rule |
| 5 | `1440x900-play-briefing.png` | SHOWN-OK | paused briefing: PROTECT/WIN/LOSE + "No time limit..." note (correct for shipped Hormuz: no extra endings); mode choice; SPC/ENT/B hints |
| 6 | `1440x900-play1-debrief.png` | SHOWN-OK | continuous VICTORY T+03:06:14, score 10/0 tally note, losses 2 (Hornet 101/102), kills 3, record 8 of 89 |
| 7 | `1440x900-play2-debrief.png` | SHOWN-OK | WeGo VICTORY T+03:43:27, 45 turns, losses 1 (Hornet 101), kills 6; sidebar behind overlay left scrolled (cosmetic) |
| 8 | `1440x900-play2-orders.png` | SHOWN-OK | T1 planning after PLAY AGAIN, score 0/0, Nimitz WP1 25.900N 57.000E / WP2 26.650N 56.450E, FULL |
| 9 | `1920x1080-final-record-strip.png` | SHOWN-OK | strip at 360,96 clear of OSINT row/mission panel; fixture VICTORY rule "US Navy score is at least 1", top bar 11 |
| 10 | `1920x1080-fixture-carrier-loss-defeat-debrief.png` | SHOWN-OK | defeat by TN2000 CLS, tally note, FAILED |
| 11 | `1920x1080-fixture-score-draw-debrief.png` | SHOWN-OK | draw, 10/5 SCORE DECIDED |
| 12 | `1920x1080-fixture-score-victory-debrief.png` | SHOWN-OK | score rule victory, 50/0 SCORE DECIDED |
| 13 | `1920x1080-play-briefing.png` | SHOWN-OK | same rule block as 1440; legible |
| 14 | `1920x1080-play1-debrief.png` | SHOWN-OK | continuous victory T+03:06:14, 10/0 tally, losses 2 kills 3 |
| 15 | `1920x1080-play2-debrief.png` | SHOWN-OK | WeGo victory 45 turns T+03:43:27, losses 1 kills 6; PLAY AGAIN not visibly focused in this frame (focus ring absent vs other debriefs) - cosmetic |
| 16 | `1920x1080-play2-orders.png` | SHOWN-OK | T1 planning after PLAY AGAIN, Nimitz WP1/WP2 dog-leg drawn, score 0/0 |
| 17 | `combat-1-carries/1440x900-A-real-debrief.png` | SHOWN-OK | VICTORY; DECIDED BY Nimitz entered gate; FINAL SCORE US NAVY 10 // IRAN 0 + tally note; T+03:06:15; 38 turns WeGo |
| 18 | `combat-1-carries/1440x900-A-record-last-turn.png` | SHOWN-OK | hold strip "[REVIEW] TURN 1 HELD / BACK TO REVIEW" at 360,96 clear of OSINT row and Nimitz title; record LAST RESOLVED TURN |
| 19 | `combat-1-carries/1440x900-A-record-older-activity.png` | SHOWN-OK | final strip "[VICTORY] PLAY AGAIN DEBRIEF" clear of Hornet 101 title; record page 1/2 |
| 20 | `combat-1-carries/1440x900-A-record-own-unit-filter.png` | SHOWN-OK | unit filter HORNET 102, 7 matching |
| 21 | `combat-1-carries/1440x900-A-replay-clean.png` | SHOWN-OK | T1 PLANNING 06:00:00, score 0/0, record 0, briefing + mode choice, staged 0 |
| 22 | `combat-1-carries/1440x900-A-review-fire-receipt.png` | SHOWN-OK | FIRE ORDERS HORNET 101 -> TN9484 DET: LAUNCHED. S3 (pre-existing card position): review card top edge overlaps lower edge of OSINT RADAR/NUC toggles at 1440 |
| 23 | `combat-1-carries/1440x900-A-review-fire-refusal-fixture.png` | SHOWN-OK | REFUSED, NO SUCH CONTACT (TN2103); same OSINT/card edge overlap |
| 24 | `combat-1-carries/1440x900-A-review-inspect-own-platform.png` | SHOWN-OK | turn-1 review card centred; Nimitz detail title/tabs clear |
| 25 | `combat-1-carries/1440x900-A-review-omitted-preview-and-record-access.png` | SHOWN-OK | "SHOWING LATEST 5 OF 9 // 4 EARLIER NOT SHOWN", VIEW RECORD (9) |
| 26 | `combat-1-carries/1440x900-A-staged-engage.png` | SHOWN-OK | selector TN9484 DET = staged row = "Staged: Hornet 101 fires on TN9484 DET"; CANCEL visible. S3: RADAR ACTIVE button half-clipped by orders scroll area |
| 27 | `combat-1-carries/1440x900-A-staged-engage-cancelled.png` | SHOWN-OK | "Fire order cancelled.", staged 0 |
| 28 | `combat-1-carries/1440x900-B-real-debrief.png` | SHOWN-OK | continuous VICTORY, losses 2, kills 8, score 10/0 tally note, PLAY AGAIN focused |
| 29 | `combat-1-carries/1440x900-B-record-older-activity.png` | SHOWN-OK | strip clear of titles; sits over map near 3RD KHORDAD label (map-only occlusion) |
| 30 | `combat-1-carries/1440x900-B-record-own-unit-filter.png` | SHOWN-OK | HORNET 101 filter, 14 |
| 31 | `combat-1-carries/1440x900-B-replay-clean.png` | SHOWN-OK | [HOLD] 06:00:00, score 0/0, continuous selected, record empty |
| 32 | `combat-1-carries/1920x1080-A-real-debrief.png` | SHOWN-OK | same facts as 1440; legible |
| 33 | `combat-1-carries/1920x1080-A-record-last-turn.png` | SHOWN-OK | hold strip clear of Nimitz title and OSINT row |
| 34 | `combat-1-carries/1920x1080-A-record-older-activity.png` | SHOWN-OK | final strip clear; record 1-20 of 35 |
| 35 | `combat-1-carries/1920x1080-A-record-own-unit-filter.png` | SHOWN-OK | HORNET 102 filter 7 |
| 36 | `combat-1-carries/1920x1080-A-replay-clean.png` | SHOWN-OK | T1 planning, score 0/0, record 0 |
| 37 | `combat-1-carries/1920x1080-A-review-fire-receipt.png` | SHOWN-OK | T2 review: FIRE ORDERS HORNET 101 -> TN9484 DET: LAUNCHED (same TN) |
| 38 | `combat-1-carries/1920x1080-A-review-fire-refusal-fixture.png` | SHOWN-OK | T3: HORNET 101 -> TN2103 DET: REFUSED, NO SUCH CONTACT (fixture; frame itself carries no FIXTURE label) |
| 39 | `combat-1-carries/1920x1080-A-review-inspect-own-platform.png` | SHOWN-OK | review card + Nimitz detail coexist |
| 40 | `combat-1-carries/1920x1080-A-review-omitted-preview-and-record-access.png` | SHOWN-OK | omission line + VIEW RECORD (9) |
| 41 | `combat-1-carries/1920x1080-A-staged-engage.png` | SHOWN-OK | selector TN9484 DET = staged row HORNET 101 -> TN9484 DET = "Staged: Hornet 101 fires on TN9484 DET"; CANCEL visible |
| 42 | `combat-1-carries/1920x1080-A-staged-engage-cancelled.png` | SHOWN-OK | "Fire order cancelled.", FIRE ORDERS STAGED 0 |
| 43 | `combat-1-carries/1920x1080-B-real-debrief.png` | SHOWN-OK | continuous victory debrief, legible |
| 44 | `combat-1-carries/1920x1080-B-record-older-activity.png` | SHOWN-OK | final strip clear of titles; strip covers top-left corner of the TRANSIT GATE box on the map (S3) |
| 45 | `combat-1-carries/1920x1080-B-record-own-unit-filter.png` | SHOWN-OK | HORNET 101 14 |
| 46 | `combat-1-carries/1920x1080-B-replay-clean.png` | SHOWN-OK | [HOLD], score 0/0, continuous |
| 47 | `early-run/1440x900-fixture-carrier-loss-defeat-debrief.png` | SHOWN-OK | DEFEAT; "USS Nimitz was destroyed by TN2000 TRK"; score 10/0 tally note; fixture (fixed dice); 8 identical C-802 HIT lines fill the preview |
| 48 | `early-run/1440x900-fixture-score-draw-debrief.png` | SHOWN-OK | DRAW "Fixture: stalemate."; Ending rule met: Iran score is at least 5; THE SCORE DECIDED THIS ENDING; mission panel lists DRAW rule |
| 49 | `early-run/1440x900-play-briefing.png` | SHOWN-OK | earlier-run briefing; same rule block (pixel-identical content to final briefing, earlier run) |
| 50 | `early-run/1440x900-play1-debrief.png` | SHOWN-OK | earlier continuous victory T+03:06:14 but kills 2 and 78 records (final run: kills 3, 89) - independent real run, not a copy |
| 51 | `early-run/1440x900-play2-orders.png` | SHOWN-OK | earlier T1 planning dog-leg orders WP1/WP2 |
| 52 | `early-run/1920x1080-fixture-carrier-loss-defeat-debrief.png` | SHOWN-OK | earlier defeat fixture, TN2000 TRK at T+00:00:06 |
| 53 | `early-run/1920x1080-fixture-score-draw-debrief.png` | SHOWN-OK | earlier draw fixture |
| 54 | `early-run/1920x1080-play-briefing.png` | SHOWN-OK | earlier-run briefing at 1920 |
| 55 | `early-run/1920x1080-play1-debrief.png` | SHOWN-OK | earlier continuous victory, kills 2, 78 records |
| 56 | `early-run/1920x1080-play2-orders.png` | SHOWN-OK | earlier dog-leg orders |

## S3 (non-blocking, one line each)

1. `objective.ts` `describeEvent`: `usesScore` is true if any ANY-trigger is a score trigger. A "Time OR SideScore" ending decided by the clock would still print "THE SCORE DECIDED THIS ENDING".
2. Hostile-side `SideScore` thresholds are stated before the result (e.g. "Iran score is at least 5"). The score is public, but the model has no disclosure flag, so this is a judgement call to log.
3. The final strip at `top:96px; left:360px` sits over the top-left of the map (in the 1920 B frames it covers a corner of the TRANSIT GATE box). Map only.
4. At 1440×900 the WeGo review card's top edge overlaps the bottom of the OSINT RADAR/NUC toggles. This is a pre-existing card position, not the moved strip.
5. At 1440×900 the staged-engage frame shows the RADAR ACTIVE button half-clipped at the order panel's scroll edge.
6. The refusal-fixture frame has no on-screen FIXTURE label; only the JSON and spec label it.
7. In continuous mode at 60×, the first tick skips the `ScenarioLoaded` "Scenario Briefing" event (run 1's fired list lacks it; WeGo run 2 has it). The cause is the evaluator's `simTime <= start+1000`, which is pre-existing and outside this lane's files.
8. The defeat-fixture debrief preview is 8 identical "C-802 HIT USS NIMITZ" lines; duplicate record lines are not collapsed.
9. Full E2E has not been run on the final helper SHA c386c11, and tsc carries 3 errors that the report says also exist on base.
