**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-COMBAT-1 Read the whole fight

BUILD card for #ask-dot-night-s409-5. Delivers **SPEC step 5**, “Fights: missiles, air defense, countermeasures, damage, all in a readable combat log.” It supports step 4's player picture and the next step 2 order, without changing combat rules. Base: `lerugray/sandkasten` main `b0aa28935a259147d1ee43e1df2036717e07105b`. GS spec-gates, launches and merges. This is a proposed card, not an admission or implementation.

RAY-ASK: 2026-11-03 15:1x "for the UI, it needs to read more like a tom clancy style arcade/harpoon terminal as opposed to a flashy web app or saas but all that energy put towards a truly immersive and engaging setup"
Source: [SPEC.md lines 28–31](https://github.com/lerugray/sandkasten/blob/b0aa28935a259147d1ee43e1df2036717e07105b/SPEC.md#L28-L31).

MOVES: After a missile exchange, the player can find every retained player-visible combat event in this run, see which own ships or aircraft were damaged or lost, inspect an affected own unit, and return to orders without guessing what an eight-line summary omitted. The same record works during continuous play, a held WeGo review and the final debrief.

The exact owner words above govern the tactical interface. SPEC step 5 explicitly calls for the readable combat log. Filtering, paging and navigation below are implementation choices for that requirement, not quotations or separate feature requests from Ray. **SAND-SAVE-1 remains NOT ADMITTED.** No save, export, reload recovery or cross-session history is part of this card.

## Why this next

The fight is simulated already. The player cannot reliably review it: `CombatLog.tsx` silently takes the latest 50 events, the traffic strip takes 40, and review/debrief show eight without access to their omitted record. Current combat and scenario-message stores append without dropping earlier entries, so the session history exists upstream. This card exposes that existing history; it does not invent a recorder or replay engine.

There is also a concrete assessment defect: `Unit.damageState` uses `damaged`, but `finishTurn()` ranks nonexistent `minor-damage` and `major-damage`. An `undamaged → damaged` own-unit transition therefore compares 0 > 0 and disappears from the turn's loss/damage list. Correct the report, not the damage rules. The latest review also identifies duplicated boundary events and hidden unit inspection.

Combat visibility is inconsistent in source: review excludes unrelated hostile-only events, whereas the COMBAT tab and traffic consume the full raw log and redact names. The weapons list consumes all weapons in flight. A controlled fixture must demonstrate the precise visible consequence before the lane claims a fog defect. Apply one bounded player-view rule to these textual surfaces; do not redesign sensors or weapon tracking.

## Build one combat assessment flow

1. **A complete accessible record.** In the existing terminal COMBAT area, provide ALL ACTIVITY, COMBAT and INTEL categories, an optional own-unit filter, and ALL RUN / LAST RESOLVED TURN in WeGo. Use absolute scenario timestamps plus readable event names such as LAUNCH, DEFENDED, HIT, MISS, DAMAGED and LOST. Preserve stable source IDs and source order for equal timestamps. All retained eligible events must be reachable through explicit paging or a bounded scrolling view with an honest “showing X–Y of Z” cue. Never silently discard event 51 or invent links between salvos that lack a common ID. Empty results explain the active filter and offer CLEAR FILTERS.

2. **One player-view projection.** A small pure helper supplies the terminal COMBAT record, short traffic preview, review and debrief. Use the existing review's conservative own-involvement rule: events issued by the player's side or touching one of its units; leave unrelated hostile-only events out of the ordinary view. Keep authored player-side INTEL messages distinct from combat. Preserve the existing contact-derived name rules: classified contact label, otherwise track label, otherwise UNKNOWN TRACK. Do not expose raw enemy IDs, true positions, hidden platform names or hidden unit choices through text, counts, filters, DOM attributes or navigation. Restrict the textual weapons-in-flight list/count to the same own-involvement scope; identify own weapons from their own launch data and use a generic incoming-weapon label where the player's data does not identify the enemy weapon. This uses the existing simulation's incoming-threat convention, not a new missile detection model. GOD-mode debug visibility must remain visibly separate and disappear immediately when GOD is turned off. No hidden debug rows retained in an ordinary filter or summary.

   The current model lacks event-time intelligence snapshots. Do not claim this is a reconstruction of what the player knew at each historic second, or build a new omniscient historical dossier. Reuse current player-contact naming consistently. “Whole fight” means the whole retained **player-view record of this run**, not all sides' secret activities.

3. **Summaries open the record without changing time.** Review and debrief may keep a short preview, but show its total and a clear VIEW RECORD action selecting the corresponding scope. Returning restores the held review or result, not NEXT TURN. Selecting an affected own unit opens its existing read-only details alongside, or as an explicit alternative to, the record/review. REVIEW must no longer require NEXT TURN merely to inspect a platform. Support friendly losses as read-only information, without reviving them or enabling orders. Inspect/focus actions target own units only; do not focus an enemy's true position from a log ID. Keep actual tactical commands locked in REVIEW, RESOLVING and after a result.

4. **Accurate turn ownership and own damage.** Capture event/message start cursors before staged fire executes at COMMIT. Assign entries by newly appended IDs/indices, not `time >= turnStart`: an event at the previous end belongs to that previous turn, while a newly committed launch at the same timestamp belongs to the new turn. No skipped first-turn INTEL and no duplicate boundary record. Use the real damage-state union with an exhaustive rank for report comparison. Show newly worsened damage states, mission kills and losses distinctly; do not count damage as a destroyed unit. This turn summary reports state changes, not every additional damage point within an unchanged state; the full event record and current own-unit details remain accessible. Keep a useful own-force condition summary in the full record, and let the debrief report actual losses and surviving damage. Neither a log entry nor a distance readout may decide the scenario result.

5. **Readable under real use.** Keep the Harpoon terminal style, fonts, existing color system and map. Preserve a player's place while new events arrive; show NEW ACTIVITY / LATEST rather than dragging them away from an older incident. Filters, paging, close, back-to-review and unit inspection must be keyboard reachable. Enter/Space while operating these controls must not also commit/advance a turn. Opening the record must not resume a held clock, pause an already running clock implicitly, reset orders or change the selected mode. Reset/PLAY AGAIN clears record filters, page/scroll state and stale selection.

Use the existing COMBAT panel as the entry point, with a full-record view only as needed for readable history and own-unit inspection. Keep an obvious way back to the tactical map. No separate design bake-off, competing interfaces or dashboard cards.

## Explicit file and hunk fence

Permitted product changes only:
- `src/lib/simulation/combatRecord.ts` (new): pure eligibility, labeling, filtering and stable ordering helpers; no simulation or RNG calls.
- `src/components/game/CombatRecord.tsx` (new): record controls, pagination/scroll state, own-unit inspection links and empty states.
- `src/components/terminal/TerminalPlay.tsx`: COMBAT tab, combat-derived traffic/review/debrief text and counts, record navigation, review/detail coexistence, associated keyboard/reset handling. Preserve unrelated map, briefing, mode and order logic.
- `src/lib/simulation/session.ts`: turn event/message cursors captured before staged execution, reset/initialization of those cursors, `finishTurn` collection and exhaustive damage-report ranking only. No timing, stepping, orders, AI or terminal-result changes.
- `src/app/play/terminal.css`: scoped combat-record and review/detail layout rules only.
- `src/components/game/help/HelpPanel.tsx`: help for the new record controls only.
- `README.md`: accurate Current State description of this shipped record and its limits.

Permitted proof: new `src/lib/simulation/__tests__/combatRecord.test.ts`, focused additions to `src/lib/simulation/__tests__/wego.test.ts`, new `tests/sand-combat-1-record.spec.ts`, necessary evidence/assertion additions to `tests/sand-wego-1-flow.spec.ts` and `tests/helpers/sandPlay.ts`; report `docs/lane-reports/SAND-COMBAT-1-s409.md`; receipts `docs/verification/sand-combat-1-s409/`.

Read `CLAUDE.md` and any executor/repository instructions before editing. At the pinned tree there is no `AGENTS.md`; do not invent one. No changes to `SPEC.md`, `GDD.md`, `combat.ts`, `engine.ts`, AI planners/doctrine, sensor/detection/contact-aging rules, scenario/event/objective content, platform data, map renderer or OSINT geometry. Do not change the legacy CombatLog API merely to implement the terminal record. No fonts, package/dependency/config changes, generated-file churn, networking, save feature, deployment or merge. If the slice requires an out-of-fence product change, stop and return the precise dependency to GS.

## FINISH tests and actual proof

- **Red first:** On the pinned base, demonstrate inaccessible events older than 50; silent review truncation; duplicate end/start timestamp membership; ordinary own damage omitted; unit inspection unavailable during REVIEW. A fixture with an unrelated hostile-only exchange must establish whether raw text/counts leak into COMBAT/traffic. Record observed assertions, not an inferred browser failure.
- **Complete record:** More than 50 eligible events, more than eight in one turn, mixed INTEL/combat, identical timestamps, empty/combined filters and a newly arriving event while reading old pages. Every eligible source ID appears exactly once in its scope. “No activity” must not appear merely because the newest page is empty. Hidden events must not inflate any ordinary count.
- **Fog and read-only behavior:** Classified/unknown/lost contact cases; unrelated hostile-only events and weapons; GOD on→off; no forbidden name/ID in rows, filters or attributes. A record click never reads an enemy's true position. Verify all six tactical command families remain locked in resolution/review/end while own-platform inspection works. Preserve current session/contact protections; no new public test hook.
- **Turn/report edge cases:** Previous-end event and new commit launch at the same timestamp; initial INTEL; cancelled and refused ENGAGE; exactly one launch outcome; undamaged→damaged, damaged→mission-kill, destruction and unchanged damage. Add a WeGo-specific same-tick gate arrival/carrier destruction test: defeat still wins and the final record stops at the authoritative result. Two independent sessions and two replays must not share records or UI state.
- **Two actual UI approaches to battle:** Fresh GOD-off Hormuz runs using the existing direct/flank plan and the escorted/dog-leg plan, one continuous and one WeGo. Both must reach the genuine scenario result through ordinary UI, with no injected victory, state-editing or fixed dice. Read a real launch/defense/damage sequence in the full record, filter an involved own unit and inspect it. At least the WeGo run stages ENGAGE, visibly captures CANCEL, commits and records the actual LAUNCHED or REFUSED outcome. Include both plans' losses and surviving damage, whether favorable or not. If a particular damage/defense case does not occur naturally, cover it separately with a clearly labeled fixture, never claim it happened in the played run.
- **Pixel proof:** Set viewport before selection/scroll positioning. At actual 1440×900 and 1920×1080, DPR 2, capture and inspect full record with older activity, active own-unit filter, review with omitted-preview count and record access, own-platform inspection during REVIEW, staged ENGAGE/CANCEL, its actual outcome, real debrief and clean replay. Keep body ≥14 px, labels ≥12 px, controls visible, no panel overlap or hidden orders after returning. Each distinct receipt must capture the named state; do not relabel a duplicate image as separate proof.
- **Regression:** Full unit suite, full serial real-GPU E2E, production build and typecheck on the final code SHA. GS reports the landed base at 237/237 units and E2E 93 passed / 2 skipped / 0 failed. The two skips are the named capture-only `sand-osint-1-frames` cases. Prior tsc logs have three nullable errors in `sand-001-unit-placement.spec.ts`; compare to the base, report exact errors, and allow no new diagnostic or silent skip. Exercise actual demo→snapshot→demo→legacy navigation, unchanged continuous control/WeGo timings/results and no record-state leak. `npm test` is required before **every push** by CLAUDE.md; serialize its browser portion as below.

## Twelve WeGo S3 dispositions

Source: [the pinned independent review](https://github.com/lerugray/sandkasten/blob/b0aa28935a259147d1ee43e1df2036717e07105b/docs/verification/sand-wego-1-s409/OPUS-REVIEW.md#5-s3-non-blocking). These remain non-blocking findings of an ACCEPT, not invented rejections.

1. **Fold:** inspection during REVIEW is an explicit flow above.
2. **Fold:** eight-row preview has a total and access to the complete eligible record.
3. **Fold:** cursor/ID-based turn membership eliminates duplicated boundary entries while retaining new commit-time fire.
4. **Fold in evidence:** new receipts state every own loss and surviving damage. Explicitly note prior plan B showed two Hornet losses and Cole damage although its JSON/report omitted them; do not rewrite old artifacts.
5. **Fold in captures:** set each viewport before selection and make selected orders visible after return.
6. **Fold in captures:** distinct states and an image-hash manifest; identify any deliberate duplicate instead of counting it twice.
7. **Fold:** actual staged ENGAGE/CANCEL pixels at both sizes.
8. **Fold:** actual execution outcome recorded in screenshot and JSON/report.
9. **Defer:** stale-contact falsification of AI planning is a separate AI-test carry. No planner or planning cadence changes here; the new record's own-contact visibility tests do not claim to close it.
10. **Fold:** explicit WeGo same-tick arrival/destruction regression because final assessment is touched.
11. **Defer:** the legacy “continuous only” label is outside the terminal record fence. Existing legacy behavior and navigation still receive regression coverage.
12. **Defer:** empty-turn pacing / resolve-until-contact needs a separate time-control decision. No auto-commit, skipped review, turn-length or balance changes here.

The older named gate/OSINT and Qeshm grid-label map-layout carries remain deferred; this is not a map-relayout lane.

## Checkpoints and authority

One op-run **backup Claude Sonnet 5.5** owner on home-PC, branch `s409/sand-combat-1` from the pinned main. **≤9,000 seconds aggregate**, including waiting, tests, fixes and closeout; reserve the last 600 seconds for evidence and a candid report. No second author or unbounded continuation. Budget the known ~28-minute full E2E baseline before promising three pushes. If the mandatory checks/checkpoints cannot fit, report PARTIAL rather than skip them.

- **CP1:** pure record projection, correct turn membership/own damage, red-to-green tests and a runnable unchanged-or-improved UI. Full required pre-push checks; push a working checkpoint.
- **CP2:** full record/filters/inspection/return flow and targeted real-GPU interaction/pixel proof. Full required pre-push checks; push a working checkpoint.
- **CP3:** complete two-plan/fixture receipts, final full battery, inspected captures and lane report. Push the exact tested code and evidence; distinguish any later docs-only SHA from the tested product SHA.

**ONE independent Opus 5.5 combined behavior/look end review, ≤1,800 seconds aggregate**, including report. Open with “Does a player now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO”. Review the actual final diff, full receipts and every required image; challenge completeness, visibility, damage reporting, locks and navigation rather than reviewing green counts alone. Use the serial gate if doing browser proof. No second critic chain. A missing contract is REWORK/PARTIAL, not a claim that a terminal skin completed combat.

GS owns the spec gate before launch, the exact-successor land battery, and merge. Stop on a changed base/fence, insufficient owner provenance at the spec gate, denied access, exhausted budget or unavailable GPU proof. Push only working, checked checkpoints within authorization; explain what remains. Do not weaken the visibility/reporting contract to reach READY.

## Serial real GPU recipe

Before every heavy step: `uptime` and `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check`. rc 3/4 means wait ten minutes **inside the cap**, then retry or report PARTIAL. Honor the current slot holder and PAUSE. One browser worker, `nice -n 15`, no overlapping browser/Godot runs; free `SAND_E2E_PORT`, `SAND_E2E_GPU=1`. Use Chromium flags `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --mute-audio` and home-PC environment `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib`. Run the unit and Playwright stages of `npm test` sequentially; browser command `nice -n 15 npx playwright test --workers=1 --reporter=line`. Keep complete output/exit status for each required pre-push run. Record actual WebGL NVIDIA/D3D12 renderer; software rendering is not GPU proof. Scope cleanup to owned processes.

DONE first line: `SAND-COMBAT-1 READY|PARTIAL head=<sha> history=<pass/fail> player_view=<pass/fail> own_damage=<pass/fail> turn_membership=<pass/fail> inspection=<pass/fail> two_plans=<pass/fail> unit=<passed/total> e2e=<passed/total> skipped=<n> gpu=<renderer>`.

Then give the player-visible result, Ray/SPEC trace, three pushed checkpoint SHAs, exact commands/logs, frame index/hashes, S3 dispositions, failures/skips and remaining limits. This card was produced from connector source reads and prior review receipts; no new implementation, browser run or gameplay pass is claimed.

