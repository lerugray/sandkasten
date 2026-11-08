OPUS-REVIEW ACCEPT head=e0d0bb42 base=536087f8 answer=PARTLY S1=0 S2=0 S3=12

# SAND-PLAY-1 independent end review (co3-sandrev-t213, Opus 5.5, 2026-11-07)

**Does a player now get an open-source CMO equivalent that is more player friendly than CMO: PARTLY.** In the one shipped Hormuz scenario a new player now sees what to protect, where the gate is, what wins and loses, why the run ended, and gets a clean retry, which is friendlier than CMO's first play. One scenario with no saves, air ops or editor is still not a CMO equivalent.

Reviewer did not write this work and changed no product code. Re-ran `nice -n 15 npx vitest run` on e0d0bb42: 20 files, **214/214 passed**. No browser, E2E or build was run, per the brief. Tree: branch s409/sand-play-1, HEAD e0d0bb42, nothing tracked modified.

## 1 Diff findings (536087f8..e0d0bb42)
- **Fence held.** No change to the scenario (`demo.ts`/`demoConfig.ts` untouched), opponent strength, AI, weapons or combat engine. `events.ts` only exports the existing `isPointInPolygon`. `session.ts` adds `ended` guards on togglePause/setSpeed/cycleSpeed/updateOrders (waypoint, throttle, radar, ROE) and engage, plus `pause()` and a pause on the tick a result lands. These only gate commands; no rule changes.
- **One rule source.** `src/lib/scenarios/objective.ts` derives the unit, gate and win/lose text from the scenario's own `EndScenario` events and reference area. The plot draws `objective.area`, the same array the evaluator reads (asserted by `toBe`). The old module-level `OPENING` cache is gone. The objective is computed per mount from the live config, so the snapshot swap in `SnapshotPlay.tsx` gives `transitObjective()===null` (unit test plus `sand-play-1-objective` snapshot spec). Legacy play has no MISSION code path.
- **Fixtures are test-only.** `injectKillOnCarrier`, the C-802 defeat fixture, lives in `tests/helpers/sandPlay.ts`. It pushes weapons-in-flight into `combatState`, pins `Math.random`, and the production tick, combat and event path decides the defeat; `scenarioResult` is never assigned. `window.__SAND_E2E__` is read in `useSimulation.ts` and only exposes the session when set before load (an init script); normal play never sets it.
- **Win/loss vs acceptance 3:** time alone (200 ticks, >1 h) gives no result; an escort alone in the real gate gives no result; a living true-Nimitz (2740) at the gate centre wins and stays victory; a destroyed Nimitz loses both far away and on the arrival tick in the gate, and stays defeat. Result is terminal: `session.test` "a victory holds the clock and refuses every later order". The result comes from `scenarioResult` only. Distance is labelled "NM TO GATE EDGE" and status stays PENDING inside the polygon until the evaluator decides.
- No hidden-information leak found. The debrief shooter name goes through `fog()`, and the record is the fogged `ttyLines` minus HOLD/ADSB. The gate is drawn only when `objective.side === playerSide`, in the hi tone, dashed, with a label, so it does not look like a contact.

## 2 Acceptance (FINISH 1-8)
| # | Verdict | Receipt |
|---|---|---|
| 1 Objective, gate, focus, dismiss/recall without order | PASS | `sand-play-1-objective.spec` tests 1-3 ("nothing is ordered by reading it", "recallable ... Esc/Enter/button", "SHOW GATE fits the real polygon"); frames 1, 2 |
| 2 Existing controls, fog, no GOD, snapshot/legacy unharmed | PASS (owner battery) | battery.txt 85 passed / 0 failed incl. pre-existing order/ROE/autopause specs; both plans assert GOD `false`; snapshot spec. Radar not exercised by a new spec |
| 3 Rule cases incl. true Nimitz | PASS | `terminal.test.ts` "SAND-PLAY-1 transit result on the real carrier and the real gate" (4 cases); `session.test.ts` finished-state block; re-run 214/214 |
| 4 Two distinct viable plans, real UI, default fog | PASS | `sand-play-1-plans.spec` A/B use real clicks, buttons and keys, with no state writes. `plan-A-direct-flank.json` (carrier alone, FLANK, gate centre, victory 09:06:15Z, T+03:06:15, carrier damaged, losses 2) and `plan-B-escorted-dogleg.json` (escorts into the gate first with no win, carrier dog-leg via 57.0E/25.9N at FULL, victory 09:43:27Z, undamaged, 5 kills). Both have a matching PNG and the seeded `plans.test.ts` (seeds 1-3) |
| 5 Defeat + PLAY AGAIN in real UI, fixture honest | PASS | `sand-play-1-result.spec` "defeat through the production combat path ... PLAY AGAIN twice"; fixture as above |
| 6 Clean replay x2, modes armed, destroyed unit selected, keys inert | PASS | same spec plus "RESET mid-run"; `assertFrozen` (Space, 1-6, e/r/x/c/f, disabled buttons, map clicks; session state byte-equal); listener and interval probes; double-Enter guard |
| 7 Pixels 1440x900 + 1920x1080 DPR 2 | PASS with S3 gaps | frame table below; `sand-play-1-shots.spec` asserts 14/12 px floors and a constant canvas size |
| 8 Unit + real-GPU E2E + build + tsc on final head | PASS (E2E/build/tsc on owner receipt) | unit 214/214 re-run here on e0d0bb42. battery.txt: ANGLE D3D12 RTX 3050, 85/87, 2 capture-only skips, build exit 0, tsc 3 baseline errors in `sand-001-unit-placement.spec.ts`. Code head 62fb8b2 vs e0d0bb4 differs only in docs plus `next-env.d.ts` |

## 3 Frames (all 10 opened, actual pixels)
| Frame | 1440x900 | 1920x1080 |
|---|---|---|
| 1 briefing | SHOWN-OK: docked card leaves gate and carrier group clear; PROTECT/WIN/LOSE plain; SHOW GATE / TAKE COMMAND obvious | SHOWN-OK (same) |
| 2 objective-focused | SHOWN-OK for the focus (gate fills the free area, label readable); "with orders" NOT SHOWN: no waypoint or selection in the frame | SHOWN-OK, same gap; 26°45'N grid label sits on the Qeshm Intl runway glyph |
| 3 victory-debrief | SHOWN-OK, fixture (T+00:00:00, record is only the opening intel); DECIDED BY, losses/kills and buttons legible | SHOWN-OK, fixture |
| 4 replay-start | SHOWN-OK: identical to cold open, PENDING, HOLD, 0-0 score, no contacts, GOD off | SHOWN-OK |
| 5 defeat-debrief | SHOWN-OK: red DEFEAT, "destroyed by Sina 101", NIMITZ LOST in forces, FAILED in MISSION | SHOWN-OK |
Also opened: `plan-A-direct-flank-victory.png` and `plan-B-escorted-dogleg-victory.png` (1280x720 DPR 1). These are the only real-victory debrief pixels: clock, record and deciding line all legible.

## S1 / S2
None.

## S3 (one line each)
1. Frame 2 at both sizes shows no orders; acceptance 7 asked for "focused objective with orders". Orders are only visible in the DPR 1 plan PNGs.
2. Both DPR 2 victory frames are fixtures. No real-run victory debrief was captured at 1440/1920 DPR 2.
3. Lane report says both plans end "afloat, undamaged"; plan A's own trace says "afloat, damaged", losses 2.
4. Deciding line reads "entered the transit gate afloat (afloat, damaged)": redundant wording in `TerminalPlay.tsx` debrief.
5. A stale "[HOLD] NEW CONTACT DETECTED" autopause cue stays in the header and traffic under the defeat result.
6. At the opening theater zoom the gate's NW corner sits under the 3RD KHORDAD / QESHM labels, and the gate is small (about 120-170 css px); usable via GATE.
7. 1920 focused frame: the 26°45'N grid label overlaps the Qeshm Intl facility glyph.
8. `next-env.d.ts` build-artifact churn committed (also in e0d0bb4, which the report calls docs-only).
9. The `__SAND_E2E__` session handle ships in production `useSimulation.ts`. It is opt-in and unreachable in play, but a build flag would be cleaner.
10. The spec titled "snapshot route and legacy routes" exercises only a direct snapshot load. demo⇄snapshot navigation in both directions and the legacy route are not exercised.
11. The E2E receipt is a 5-line summary with no raw Playwright log, and the two capture-only skips are not named.
12. Any click on the briefing body (including text) closes it. Deliberate enough, but a reader clicking to select text loses the card (B recalls it). Tilt-mode gate legibility was not captured.
