# SAND-THREAT-1 FIX2 — re-aim three stale end-to-end pins

Lane: `co3-sandthreatfix2-t462` on branch `co3/sand-threat-1-fix2`.
Candidate head: `1df1434c9a93b9b38739ac56aa31aba751445231` (`claude/sand-threat-1-t438-lane-fr9no6`).
NO_EXEC Cursor lane: tests and this report only. No browser, Playwright, Chromium, npm install/ci, or full battery was run here.

Proof source: `docs/verification/sand-threat-1-t438/seed-tables.md` on that SHA — do-nothing defeat 5/5, careless carrier-alone defeat 5/5, escort-screen ROE FREE victory 5/5, southern dog-leg with air victory 5/5.

## Scope fence

Edited only:

- `tests/sand-play-1-plans.spec.ts`
- `tests/sand-wego-1-flow.spec.ts`
- `tests/sand-save-1-flow.spec.ts`
- `docs/lane-reports/SAND-THREAT-1-FIX2-REPORT.md` (this file)

No `src/` change, no scenario/save-format/fixture/config-revision change, no map or map-assertion change, no snapshot update, no commit or push.

## Per-test re-aim

### 1. `tests/sand-play-1-plans.spec.ts`

| | |
|---|---|
| **Old assertion** | Plan A (carrier alone, FLANK, one waypoint at the gate) expected `VICTORY\|COMPLETE`, deciding mentions Nimitz/gate, `mission-status=complete`. Artifacts named `plan-A-direct-flank.json` / `plan-A-direct-flank-victory.png`. Describe claimed both plans reach a real victory. |
| **New assertion** | Same plan A actions through the ordinary UI; expects `DEFEAT`, deciding mentions Nimitz destroyed, `mission-status=failed`. Artifact screenshot renamed to `plan-A-direct-flank-defeat.png`. Describe: carrier-alone loses; escorted southern dog-leg wins. |
| **Candidate proof** | Seed table proof 2 careless: defeat 5/5 by Carrier Lost before the gate (~T+1.3 h). Matches the unit proof `carelessFlankAlone` in `hormuzThreat.test.ts`. |
| **Unchanged** | Plan B escorted southern dog-leg still asserts real victory. PLAY AGAIN / fog / GOD-off checks remain. |

### 2. `tests/sand-wego-1-flow.spec.ts`

| | |
|---|---|
| **Old assertion** | 5-minute WeGo plan A (carrier alone FLANK to gate, with a queued ENGAGE) expected `VICTORY\|COMPLETE`, `mission-status=complete`. Artifacts `victory-A-direct-flank.json` and `*-5-victory-debrief-A.png`. Describe claimed two real victories. |
| **New assertion** | Same plan A path (orders, staged ENGAGE that waits for commit, commit/resolution/review, `result-turns`, PLAY AGAIN clean replay) now expects `DEFEAT`, Nimitz destroyed, `mission-status=failed`. Artifacts renamed to `defeat-A-direct-flank.json` and `*-5-defeat-debrief-A.png`. |
| **Candidate proof** | Same careless proof 2 (defeat 5/5). WeGo turn length stays 5 minutes; SAND-THREAT-2 still owns any 15-minute WeGo defect. |
| **Unchanged** | Plan B escorted dog-leg still asserts real victory. Queued ENGAGE / command-lock / fog-review / continuous-route / look-inspection specs untouched. The injected-kill defeat path is untouched. |

### 3. `tests/sand-save-1-flow.spec.ts`

| | |
|---|---|
| **Old assertion** | After loading the real mid-battle checkpoint (saved clock, orders, fog intact), resume with the saved careless FLANK-to-gate orders and require a real victory. |
| **New assertion** | All checkpoint / download / fresh-page load / saved clock / orders / fog / expended / score integrity assertions stay. After those checks (and the flat/tilt objective shots of the *saved* plan), the test switches orders through the ordinary UI to SAND-THREAT-1 proof 3a — Chosin/Mahan/Cole/Nitze ahead to (56.5, 26.6) FULL with ROE FREE, Nimitz throttle CRUISE with the saved gate waypoint kept — then resumes and still requires a real victory. |
| **Candidate proof** | Seed table proof 3a escort screen forward, ROE FREE: victory 5/5 by Transit Complete (~T+6.2 h). Chosen over southern dog-leg with air because a typical early checkpoint already has Hornet 102 destroyed (see prior `real-checkpoint-log.json` ownStates), so proof 3b cannot be applied whole from that real file. Mid-battle T+~10 m leaves room before the careless loss window (~T+1.3 h). |
| **Unchanged** | First test still builds a real nontrivial checkpoint with ordinary controls and downloads it (no fixture swap). Third test still reloads the unchanged file with a different dog-leg plan and asserts victory or defeat without altering the save bytes. Victory assertion on the resume path was not deleted or weakened to crash/load-only. |

## Map overlap (out of scope)

The battery's `/map` Qeshm / Khalij Fars vs `apt-ir-0057` failures are not touched. Attribution is for the seat on a browser host (base `fc337505` vs candidate `1df1434c`), not this lane.

## What was executed here

- Read brief, candidate seed tables, the three named specs, and the proof plans in `hormuzThreat.test.ts`.
- Static edit of the three specs + this report.
- STEER.md was absent for the lane at start and again before finish; no override applied.
- No browser / Playwright / Chromium / Electron / Godot process.
- No `npm install` / `npm ci`.
- No full battery. No claim of a browser pass.

## Harvest

Diff review on a non-author model, then the full battery with at most 2 Playwright workers on a free browser host. Seat runs base-vs-candidate map attribution separately before any map fix. Land only after the settled gate is green.
