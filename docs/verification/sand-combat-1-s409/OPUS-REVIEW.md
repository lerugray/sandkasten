OPUS-REVIEW ACCEPT head=f741c06 base=b0aa2893 answer=PARTLY S1=0 S2=0 S3=12

# SAND-COMBAT-1: independent Opus 5.5 end review (co3-combatrev-t247, 2026-11-08)

**Does a player now get an open-source CMO equivalent that is more player friendly than CMO: PARTLY.** This lane delivers SPEC step 5's readable combat log. It is clearer than CMO's message log: paged, filterable, own-unit inspectable, and reachable from review and debrief without moving the clock. The wider CMO-equivalent picture is still partial, though. Enemy weapon types and exact enemy damage states still read as perfect knowledge, and the record competes with a crowded 1440×900 sidebar.

**Complete combat record as the card defines it: YES.** Every retained player-view event and INTEL message of the run can be reached. Plan B has 420 rows over 21 pages, with an honest `SHOWING x–y OF z` cue. Own damage, mission kill and loss are reported distinctly in the review, the record's OWN FORCE line and chips, and the debrief. Each affected own unit, including lost ones, can be inspected read-only.

Scope of this review:
- I reviewed product code at f741c06 (code head 2f120c6).
- I re-ran the unit suite with `nice -n 15 npx vitest run`: 22 files, **258/258 passed** (04:56 EST).
- I did not run E2E, a browser or a build (those belong to the GS land battery).
- All 26 frames were opened. Two review sub-readers opened 13 each. I also opened three directly: 1440 A-record-last-turn, A-record-older-activity and A-review-inspect-own-platform.

## 1. Diff findings (`git diff b0aa2893 f741c06`)

- **Fence: PASS.** The product changes are confined to the seven permitted files: `combatRecord.ts` (new), `CombatRecord.tsx` (new), `TerminalPlay.tsx`, `session.ts`, `terminal.css`, `HelpPanel.tsx` and `README.md`. The proof files are `combatRecord.test.ts` (new), `wego.test.ts` additions and `tests/sand-combat-1-record.spec.ts` (new), plus the report and receipts. No changes to combat.ts, engine.ts, AI, sensors, scenario, map renderer, package or config.
- **session.ts: within its permitted hunks.**
  - It adds the `turnEventCursor`/`turnMessageCursor` fields.
  - The cursors are captured in `commitOrders` before `runAIUpdate` and staged execution, and reset in init/reset.
  - `finishTurn` slices by cursor instead of `time >= turnStart`.
  - The rank is exhaustive over `Unit["damageState"]` (`undamaged|damaged|mission-kill|destroyed`). This fixes the base defect where the nonexistent `minor-damage`/`major-damage` keys dropped undamaged→damaged.
  - No timing, stepping, order or result changes. Continuous mode never calls commit/finishTurn, so it is unaffected (plan B continuous reached VICTORY).
- **Player-view projection (`projectRecord`).**
  - Own involvement means `e.side === playerSide` or the unitId/targetId is own. Hostile-only events are dropped from rows, counts, filters and teletype unless GOD is on, in which case they are flagged `debug` and rendered `[GOD]`.
  - Enemy names go through `buildFog`: contact platformName, else `TNxxxx CLS`, else UNKNOWN TRACK. Destroyed enemy units stay in `sides`, so their names are still fogged.
  - A hostile defender's countermeasure is redacted ("with a defensive system").
  - The weapons-in-flight list shows only own weapons plus `INCOMING WEAPON -> <own unit>`, and its badge counts that list.
  - DOM attributes carry only own unit ids (`data-unit-id`) and source event/message ids. No enemy id appears. I found no fog leak of enemy *platform names or ids*.
  - Residual: enemy weapon *types* and exact enemy damage states remain in the text (S3-1, S3-2).
- **Inspection in REVIEW is read-only.**
  - The detail column now renders in REVIEW for own units only, via `DetailPanel` with just `onClose`/`onShowFacility`, so there is no command callback.
  - Order panel, ENGAGE, ROE and commit stay gated on `ordersOpen`.
  - Hotkeys: E/R act through `ordersOpen`-gated handlers. `isPlacingWaypoint` is cleared when orders close, so map waypoint gestures are dead.
  - `inspectOwn` only selects and focuses own units. Record and chip INSPECT buttons are generated only for own ids, so no enemy true position is ever focused from the log.
- **VIEW RECORD and return.**
  - From review: `recordHold="review"` hides the review panel, shows the `[ REVIEW ] TURN n HELD / BACK TO REVIEW` strip, and opens the record scoped to LAST RESOLVED TURN. Returning restores the held review; the phase stays `review` (spec asserts this).
  - From debrief: `reviewing=true`, and BACK TO DEBRIEF returns.
  - No clock or mode change in either path.
- **Test hooks: none added to ordinary builds.** No new `window.`, `process.env` or `globalThis` in the src diff. The spec uses the pre-existing `e2eHandle` session handle read-only. `Math.random=0.7` is injected only in the fog fixture test, never in the plan A or plan B tests.

## 2. Acceptance table

| Card item / FINISH check | Verdict | Receipt |
|---|---|---|
| 1 Complete record: categories, own-unit filter, ALL RUN / LAST TURN, absolute times, readable names, paging with honest cue, empty-filter CLEAR | PASS | `combatRecord.test.ts` "every eligible source id appears exactly once…past event 50", "pages cover every row once…", "combined filters…empty result is explained"; plan-B JSON `SHOWING 1-20 OF 420 // PAGE 1/21`; frames older-activity / own-unit-filter |
| New activity while reading old pages | PASS | unit "an explicit page does not move when new rows arrive"; spec test 3 (fog/paging/place-keeping) in `cp2-targeted-record-spec.log` |
| 2 One player-view projection, no hidden names/ids in rows, counts, filters, attributes | PASS (S3-1, S3-2 residual) | unit "keeps own-involved…leaves unrelated hostile-only…", "names enemies by classified…else UNKNOWN TRACK"; `assertNoLeak` on record/review/result/teletype every turn of plan A and at both debriefs |
| Weapons in flight scoped and generic | PASS | unit "lists own weapons and generic incoming weapons only…"; frame 1440 A-record-last-turn shows `INCOMING WEAPON -> HORNET 102` |
| GOD separate, gone at once when off | PASS | unit "GOD view adds the hidden rows flagged…turning it off removes them"; spec test 3 |
| 3 Summaries show total + VIEW RECORD; return restores held review/result, not NEXT TURN | PASS | spec plan A (record-return → `turn-review` visible, phase `review`); `debriefRecordFlow`; frames review-omitted-preview, real-debrief |
| Own-unit inspection during REVIEW, losses included, read-only | PASS | wego.test "every tactical command is refused while resolving and reviewing; inspection still works"; spec asserts `orders-locked`, `order-panel` 0, `cmd-engage` disabled, `cmd-commit` 0; red-base-review-inspect.log fails on base |
| 4 Cursor turn membership (boundary event, same-ts commit launch, no duplicate INTEL) | PASS | wego.test "an event stamped at the previous turn's end stays with that turn…", "messages already listed at the previous end…"; red-base-wego.log 2 fail on base; plan A turn 1 = 6 events + 3 INTEL = `OF 9` |
| Own-damage ranking: undamaged→damaged, →mission-kill, destroyed, unchanged | PASS | wego.test "reports undamaged→damaged, damaged→mission-kill and destruction, and nothing for an unchanged state" |
| Same-tick gate arrival / carrier destruction = defeat; record stops at result | PASS | wego.test "a carrier destroyed on the tick it reaches the gate is a defeat…" |
| Two sessions / two replays isolated | PASS | wego.test "two sessions keep separate reports and cursors"; spec test 4 demo→snapshot→demo→legacy; replay-clean frames ×4 |
| Cancelled / refused ENGAGE; exactly one launch | PASS (unit) | wego.test "queuing…can be cancelled, and executes exactly once at commit", "an invalid fire order refuses…", "a staged order that went stale is refused…" |
| 5 Keyboard reachable; Enter/Space on record controls does not commit/advance | PASS (S3-11 edge) | spec plan A opening block: focus+Enter/Space on category/unit controls, simTime/orders/turnsCommitted unchanged |
| Reset / PLAY AGAIN clears record state | PASS | frames A/B-replay-clean (`0 ON RECORD`, `ALL OWN UNITS`, `NOTHING ON THE RECORD YET.`) |
| Two actual UI battles: A WeGo VICTORY, B continuous VICTORY | PASS (real runs) | `cp2-targeted-record-spec.log` 4 passed (8.9 m) on GPU; plan A/B flows drive only ordinary UI (clicks/keys); `page.evaluate` there only reads the snapshot; GOD-off asserted; JSON `result "[ VICTORY ]"`, renderer `ANGLE…RTX 3050`; plan A debrief `TURNS 38 COMMITTED` (37 logged reviews + the resolving turn) |
| Losses and surviving damage for both plans | PASS | A: Hornet 101 LOST; B: Cole, Hornet 101, Hornet 102 LOST (JSON `affected`, debrief frames) |
| Staged ENGAGE → CANCEL visible → commit → actual LAUNCHED/REFUSED outcome | PARTLY: stage/cancel PASS, **outcome UNPROVEN** (S3-3) | frames A-staged-engage / -cancelled; JSON `staged {turn 2, shooter Hornet 101}`. No turn-2 `review-fire` capture or JSON field. The turn-2 JSON shows only "HORNET 101 LOST". |
| Pixel proof 1440/1920 DPR2, distinct states, no overlap | PARTLY (S3-4, S3-5, S3-6) | 26 distinct sha256 in frames.json; overlaps/clipping listed below |
| Red first on base | PASS | red-base-wego.log, red-base-legacy.log (50 of 60; 1 hostile-only leak), red-base-review-inspect.log |
| Regression: full unit / full E2E / build / tsc on final SHA | Unit PASS (258/258, re-run here); tsc PASS per `tsc-final.log` (3 base errors only); **full E2E + build UNPROVEN** | GS land battery owns these; last full E2E was CP1 93/2/0 |

**S3-8 (staged-ENGAGE outcome field): S3, not S2.** The player-visible outcome surface (`review-fire` in the turn review, from SAND-WEGO-1) is unchanged and present. What is missing is the receipt: no frame and no JSON field records LAUNCHED or REFUSED for the turn-2 order. That is an evidence gap, not a defect a player can see.

## 3. Frame table (26 frames, all opened)

| frame | verdict | note |
|---|---|---|
| 1440 A-review-omitted-preview-and-record-access | SHOWN-OK | `SHOWING LATEST 5 OF 9 THIS TURN // 4 EARLIER NOT SHOWN HERE`, `VIEW RECORD (9)`, NEXT TURN |
| 1920 A-review-omitted-preview-and-record-access | SHOWN-OK | same state, legible |
| 1440 A-review-inspect-own-platform | SHOWN-OK (S3-6) | Nimitz INFO beside the review, no overlap. Nearly identical to the previous frame (Nimitz was already selected); no locked cue visible in pixels |
| 1920 A-review-inspect-own-platform | DEFECT (S3-6) | as above; the review card also covers the inspected Nimitz symbol on the map |
| 1440 A-record-last-turn | DEFECT (S3-4, S3-5) | LAST RESOLVED TURN on, `9 MATCHING`, `SHOWING 1-9 OF 9`. The hold strip clips the detail title ("IMITZ (CVN-68)"); only one row is above `-- MORE --` |
| 1920 A-record-last-turn | SHOWN-OK (S3-5) | state shown; INTEL rows push combat rows below the fold; two BACK TO REVIEW buttons |
| 1440 A-staged-engage | DEFECT (S3-7) | `FIRE ORDERS STAGED 1 / HORNET 101 → TN6 DETECTED [CANCEL]` while the selector reads `TN9484 DET` |
| 1920 A-staged-engage | DEFECT (S3-7) | same mismatch |
| 1440 A-staged-engage-cancelled | SHOWN-OK | `FIRE ORDERS STAGED 0`, "Fire order cancelled." |
| 1920 A-staged-engage-cancelled | SHOWN-OK | same |
| 1440 A-real-debrief | SHOWN-OK (S3-9) | `[ VICTORY ]`, `OWN FORCE 7 UNDAMAGED // 0 DAMAGED // 0 MISSION KILL // 1 LOST`, `HORNET 101 LOST`, `SHOWING LATEST 8 OF 36`, VIEW RECORD (36) next to REVIEW RECORD |
| 1920 A-real-debrief | SHOWN-OK (S3-9) | same. The reader's "Boghammar on TRK" concern is pre-existing contact/map naming (platformName carried by a tracked contact), outside this card |
| 1440 A-record-older-activity | DEFECT (S3-4, S3-5) | `SHOWING 1-20 OF 36 // PAGE 1/2`, FIRST/PREV disabled, LOST chip. The VICTORY strip clips the detail title ("RNET 101"); about 3 rows above the fold |
| 1920 A-record-older-activity | SHOWN-OK (S3-8) | state shown; a shooter is named differently over time (TN7674 DET → UNKNOWN TRACK), a card-acknowledged limit of current-contact naming |
| 1440 A-record-own-unit-filter | SHOWN-OK (S3-4) | `UNIT HORNET 101`, `12 MATCHING`, INSPECT per row; title clip |
| 1920 A-record-own-unit-filter | SHOWN-OK (S3-5) | the last row sits under MORE |
| 1440 A-replay-clean | SHOWN-OK | `0 ON RECORD`, `NOTHING ON THE RECORD YET.`, `STAGED 0`, no selection |
| 1920 A-replay-clean | SHOWN-OK | same |
| 1440 B-real-debrief | SHOWN-OK (S3-10) | `5 UNDAMAGED // … // 3 LOST`, `USS COLE (DDG-67) LOST // HORNET 101 LOST // HORNET 102 LOST`, `SHOWING LATEST 8 OF 420` |
| 1920 B-real-debrief | SHOWN-OK (S3-10) | same; the traffic header reads `40 MSG` against 420 on the record |
| 1440 B-record-older-activity | SHOWN-OK (S3-4) | `SHOWING 1-20 OF 420 // PAGE 1/21`, three LOST chips; title clip "S NIMITZ" |
| 1920 B-record-older-activity | SHOWN-OK | same |
| 1440 B-record-own-unit-filter | SHOWN-OK (S3-1) | `UNIT USS COLE (DDG-67)`, `353 MATCHING`, `SHOWING 341-353 OF 353 // PAGE 18/18`; `UNKNOWN TRACK LAUNCHED 76MM OTO MELARA…` |
| 1920 B-record-own-unit-filter | SHOWN-OK (S3-1, S3-5) | same; the final rows are under MORE |
| 1440 B-replay-clean | SHOWN-OK | clean, CONTINUOUS, 1x |
| 1920 B-replay-clean | SHOWN-OK | clean |

## 4. S1 / S2

None.

## 5. S3 (non-blocking, one line each)

1. **Fog consistency.** Hostile launch/hit/miss rows name the enemy weapon even from DET or UNKNOWN tracks (`TN7674 DET LAUNCHED 2× AIM-54A PHOENIX AT HORNET 101`, `UNKNOWN TRACK LAUNCHED 76MM OTO MELARA`), while the weapons list on the same screen says `INCOMING WEAPON`. This is pre-existing log text and the card scoped the generic label to the list. Carry it to a fog card: a generic weapon label in `projectRecord` for unclassified shooters.
2. **Perfect BDA.** Own-weapon results state the exact enemy damage state (`… IS NOW MISSION-KILL`, `HAS BEEN DESTROYED`) on unclassified tracks. Pre-existing and not in the card contract.
3. **Staged ENGAGE outcome.** Its actual LAUNCHED/REFUSED result has no frame or JSON field (the WeGo S3-8 fold is still partial). The `review-fire` surface exists. Add a turn-2 review capture and a JSON field.
4. **Banner overlap.** The REVIEW-HELD strip and the VICTORY/DEBRIEF strip overlap the detail panel title at both sizes ("IMITZ", "RNET 101", "S NIMITZ"), against the card's "no panel overlap". Fix: offset `.tx-result-strip` or the detail column.
5. **Cramped record at 1440×900.** Weapons list, OWN FORCE, controls and long INTEL rows leave only 1–3 rows above `-- MORE --`. It is still scrollable and honestly cued.
6. **Weak inspect receipt.** The inspect-own-platform receipt nearly duplicates the preview receipt (Nimitz was selected before the review). No `orders-locked` cue is visible in pixels, and ENGAGE's disabled style is indistinct. The 1920 review card hides the inspected unit's symbol.
7. **Staged-row track number.** It reads `TN6 DETECTED` (session.ts:418 `contactLabel` uses the contact-id digits) while the UI elsewhere shows `TN9484 DET`. Pre-existing and outside the session.ts hunk fence.
8. **Naming drift.** The same shooter reads TN7674 DET early and UNKNOWN TRACK later. Card-acknowledged (current-contact naming, no event-time snapshot).
9. **Two debrief buttons.** VIEW RECORD and REVIEW RECORD sit side by side with overlapping meaning.
10. **Traffic count.** The traffic header count (`40 MSG`) is the 40-line tail, not the run total (420 on record), which is confusing.
11. **Enter in held review.** Record buttons keep focus on body (`onMouseDown preventDefault`), so after a mouse click Enter still triggers NEXT TURN from the held-review record.
12. **Spec leftovers.** `console.log('STEP …')`, console/pageerror listeners and the `SC1_TO` override (known; GS strips them in the land commit).

## 6. Land notes for GS

The full serial E2E and production build on the final SHA are still unproven; GS runs them in the land battery. Unit suite re-verified here: 258/258. No STEER entries existed during this review.
