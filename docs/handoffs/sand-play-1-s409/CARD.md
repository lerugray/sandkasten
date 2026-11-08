**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
RAY-ASK: Ray s409 18:0x on co-seat 3: "can we maybe push forward dinky on co-seat 3 as well if it makes sense? I figure thats a decent idea, either that/sandkasten would be good if possible"
MOVES: In the shipped Three.js Hormuz scenario, a player can find the actual transit objective, keep its win/loss conditions in view, command a route and fight, understand the real result, and replay from a clean briefing with a different plan.
SPEC STEP: Finish step 6, "Wins or loses on the scenario's victory conditions, and can play it again a different way," by connecting the existing steps 1–5 to a visible objective and clean retry.

# SAND-PLAY-1 Finish the Hormuz mission loop

Mode: BUILD / FINISH. One product owner. One independent end review. This is an in-game build, not another study, mockup, map-data pass or a replacement combat engine.

## Grounding and choice

Base: `lerugray/sandkasten` main `536087f83e0e118319d9f2641935e29839660a8c`. GS reports its landing battery as 193/193 unit tests and real-GPU E2E 75 passed / 2 capture-only skips / 0 failed.

Read `SPEC.md` steps 1–6 and Direction, `GDD.md` §6.5, the existing `docs/handoffs/*/CARD.md`, and `docs/lane-reports/SAND-{LAND,MAP-1,MAP-2,OSINT-1}-s403.md`. They establish what already landed: Three.js terminal play, first-party platform data, engagement/ROE and cumulative damage, real terminal events, facilities and OSINT/snapshot support.

The CMO parity study is not in this main tree. Read the completed public-source study in GS's private repo: [CMO-PARITY-STUDY-2026-11-03.md](https://github.com/lerugray/generalstaff-private/blob/master/state/sandkasten/study/CMO-PARITY-STUDY-2026-11-03.md), reviewed blob `28c981b813377c8a2e67db736fc15485dbc95026`. Relevant: §11 victory/scoring, §15 approachable first play, Top 25 item 24, and the complaints about not knowing why an outcome happened or having only one viable solution. Its old "no victory dialog" assessment is stale: current code already has a result overlay and PLAY AGAIN. Use the study as direction, current code as the baseline. Do not copy CMO data, layouts, art or text.

Concrete gap on the pinned main:
- `demo.ts` and the opening message in `demoConfig.ts` tell the player to enter the "marked transit gate." The gate exists as a player-side reference polygon, but the plot/map rendering path does not draw scenario reference points.
- `TerminalPlay.tsx` dismisses the briefing on any first key/click, has no briefing recall control, and its reset clears simulation/media/holds but does not restore the opening briefing or clear all transient terminal modes.
- The terminal outcome freezes ticks, but session commands remain callable behind the overlay. Finish-state command guards belong to this card.
- Victory and defeat already work. `Transit Complete` means a surviving `us-cvn-1` enters `transit-gate`; `Carrier Lost` means that carrier is destroyed. The engine resolves same-tick arrival/destruction as defeat. There is no deadline, escort-survival condition or victory score threshold. The first-contact +10 points are incidental, not mission progress.

This closes a missing player-facing connection around working systems. Fuel/air operations, game saves and WeGo remain worthwhile later cards; they are not prerequisites for finding and finishing this existing objective.

## Door and ownership

- One named GS operator owns implementation, tests, checkpoint commits and the report. Launch through `op-run`, backup account, Sonnet 5.5, on home-PC, `nice -n 15`.
- BUILD cap: **9,000 seconds**. Reserve **1,800 seconds** for the ONE independent end review, total **10,800 seconds maximum**. If time runs out, push the coherent checkpoint and report PARTIAL with the smallest remaining step. Do not launch another owner or expand the card.
- Fetch first and branch `s409/sand-play-1` from the exact base above, not the old OSINT branch or the documentation branch. Verify the base is reachable from origin/main; if main gained material gameplay changes, report the changed files to GS before rebasing the plan. Do not silently change the requested baseline.
- Commit and push that implementation branch at each checkpoint below. Never force-push, update main/tags, merge or deploy. The published card's `dot/` branch is documentation only.
- Re-read any lane `STEER.md` and applicable repository instructions at checkpoints. Mute audio. Kill only processes this lane started, by recorded PID. Keep existing test assertions unless a documented behavior change requires a precise replacement.

## BUILD

### 1 Make the objective legible before and during play

In default `/play`, show a compact MISSION view in the existing phosphor terminal register. Name the protected unit, success condition and loss condition in plain English. It must remain available after the first click, with an explicit BRIEFING/MISSION recall control and keyboard access. Dismissal is deliberate; clicking a briefing control must not also place a waypoint, fire, toggle time or invoke a hidden shortcut. Reopening the briefing should pause safely and leave resuming to the player.

Draw the actual `transit-gate` polygon on the Three.js plot, with a readable label and a focus action from MISSION. Use the same scenario geometry that the event evaluator uses, not a separately drawn approximation. The current polygon spans longitude 56.2–56.7 and latitude 26.5–26.8, for orientation only: do not duplicate those coordinates in UI code. Keep labels, unit symbols, facilities, rings, scale and panels readable at theater and tactical zoom and in tilt mode. Camera focus must respect the usable area around overlays.

Show only player-authorized objective geometry. Do not expose enemy mission/reference areas or hidden units through this feature. Keep the overlay distinct from a sensor contact and do not imply it is a detection report.

Use a small shared, typed description for this shipped transit objective if needed. Objective display, briefing and event wiring must not drift into three separate rule copies. Do not build a generic TCA inspector, scoring editor or mission-authoring system. Read the existing snapshot integration before wiring metadata: `SnapshotPlay.tsx` mutates module-level `demoScenarioConfig`, and the terminal opening is currently computed at module load. Do not add another cached demo objective that leaks into a snapshot. Exercise demo/snapshot navigation in both directions.

### 2 Connect actual progress and result

While playing, show that the transit is pending and the carrier's known state, with a useful focus action. A distance readout may be added if accurately labeled; neither distance nor +10 detection score is completion. Entering the polygon on a still-running, post-combat state is not a substitute for the authoritative `scenarioResult`.

Reuse the existing victory/defeat overlay. Explain the actual deciding condition and preserve access to the relevant player-visible traffic/combat record so the player can understand what happened. Do not invent kills, expose hidden enemy positions, or add a timeline/replay engine. An ending must stop time and refuse further simulation-mutating orders until a new run begins.

Preserve the real scenario rules, original date/premise, weapon behavior, sensor fog and AI. Do not make winning easier by disabling opponents, automatically routing the carrier, adding a timer victory, or awarding victory for score/escort movement.

### 3 Make PLAY AGAIN genuinely clean

Both RESET and PLAY AGAIN return to a fresh, paused scenario and visible opening briefing. Clear stale selections, weapon/waypoint targeting, measure state, pinned ranges, transient panels, old result/messages/combat/media state and old objective progress as appropriate. Preserve only explicitly harmless display preferences. Default replay returns to ordinary player fog, not GOD mode.

A second run can take a different route or engagement/sensor plan with the existing controls. Do not enforce a tutorial route, prescribed kill order or a single tactic. Repeated reset/replay and briefing open/close cycles must not accumulate listeners, duplicated UI or running timers.

## Checkpoint commits

1. **CP1 objective shown:** shared objective description, visible real gate, mission/briefing recall and focus. Add failing-first tests for the missing geometry/recall behavior, then make them pass. Push a coherent playable checkpoint.
2. **CP2 result and retry:** authoritative progress/result presentation and complete reset behavior, with regressions for success, failure and replay. Push.
3. **CP3 finished evidence:** full battery, two-plan play receipts, screenshots, README and lane report. Push the tested head and name it. No process-only checkpoint substitutes for these working slices.

Likely touch points: `src/components/terminal/TerminalPlay.tsx`, `src/components/plot/PlotView.tsx`, `src/lib/plot/TacticalPlot.ts` plus a focused objective layer/helper, `src/app/play/terminal.css`, `src/lib/scenarios/demo.ts`/`demoConfig.ts`, and the minimal objective types/shared helpers needed. Read `src/lib/simulation/session.ts`, `useSimulation.ts`, `engine.ts`, `src/lib/ai/events.ts` and existing `terminal.test.ts` before changing integration. The owner chooses the smallest sound implementation.

## FINISH and acceptance

The owner verifies all of these before requesting the single end review:

1. A fresh default Three.js `/play` presents the real success/failure conditions, the actual visible gate, and an obvious way to focus it. A player can dismiss and recall briefing without losing the objective or issuing an unintended order. No page reload is needed.
2. Own-unit waypoint/throttle, ENGAGE/ROE, radar, pause/speed, autopause and sensor fog still work. The gate is usable without GOD mode, debug-console knowledge or live network data. The snapshot routes and legacy play are not broken or falsely given the Hormuz combat objective.
3. Unit/integration tests preserve: time alone never wins; an escort entering alone never wins; the living carrier entering wins; its destruction loses; destruction on the arrival tick wins precedence as defeat; the result remains terminal. The existing engine tests must keep their intent. Add a true-Nimitz-platform loss/arrival case as well: the current terminal test fixture substitutes a Mahan platform for the carrier.
4. Record **two distinct viable plans** through the production scenario rules, using different route geometry or meaningful route/ROE/sensor choices, without changing scenario rules or opponent strength. At least one is a complete ordinary player-UI run from cold opening through real victory, with default fog and no state injection. Give commands/waypoints and outcome evidence rather than claiming alternate strategies from a screenshot.
5. Exercise defeat and PLAY AGAIN in the actual UI. A clearly labeled deterministic short browser fixture may accelerate the defeat setup, but it must use the production session/combat/event path, not assign `scenarioResult` directly. Keep fixture code test-only. Unit fixtures may accelerate edge cases; do not pass them off as a full unmodified play run.
6. After either result, PLAY AGAIN restores the paused clean start, initial units/ammo/damage and pending objective. A second route can be issued. Repeat twice, including resetting with a selected destroyed unit and with waypoint/measure/target modes active. Keyboard/button double activation and focus/Escape behavior are checked. After a result, Space, speed keys, ROE/engage keys and stale map/order handlers must not mutate the finished state.
7. At **1440×900 and 1920×1080, DPR 2**, inspect actual pixels of opening briefing, focused objective with orders, victory/debrief, defeat/debrief and replay start. Use existing overlap helpers for labels/symbols/panels. Body text stays at least 14 px, labels at least 12 px, no clipping or decorative SaaS chrome. Canvas dimensions do not change when panels open.
8. Full unit and real-GPU E2E pass on the exact final code head. Run the production build and typecheck; compare any baseline failure on untouched main and report it explicitly rather than weakening tests or labeling a failed command green. Preserve the 193-unit / 75-E2E baseline intent and identify the two capture-only skips separately.

### Real GPU recipe

Use the SAND-OSINT-1 home-PC recipe. Check `uptime`, then `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check`; exit 3/4 means wait ten minutes and retry within the cap, not start a competing browser. Use a free lane port through `SAND_E2E_PORT`, and the current `SAND_E2E_GPU=1` config path (or its established lane-local wrapper), with Chromium arguments `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --mute-audio`.

Environment: `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib`. Run `nice -n 15 npx playwright test --workers=1 --reporter=line` with that environment. The final OSINT suite used one worker because the globe case timed out under parallel load. Record the actual `WEBGL_debug_renderer_info` renderer string and confirm hardware NVIDIA/D3D12, not SwiftShader or llvmpipe. A software-rendered pass is not the real-GPU gate. No broad process kills, driver changes or weakening of security settings.

### One independent end review

After CP3, GS assigns **one independent Opus 5.5 reviewer**, capped at 1,800 seconds, to the exact tested head. This one review covers behavior, source/rule alignment and the actual captured/running terminal look together. Do not add separate audit/look/review lanes.

It opens: "Does a player now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO." Return ACCEPT or REJECT, S1/S2 only, with concrete reproduction and affected file for any blocker. The same owner fixes accepted findings; the same reviewer closes those findings on the updated head within the remaining cap. No repeated fresh whole-product review. If a blocker cannot close in budget, report PARTIAL to GS, who decides the next move.

## Deliverable and fence

Report `docs/lane-reports/SAND-PLAY-1-s409.md` and screenshots/log receipts under `docs/verification/sand-play-1-s409/`. First report line:

`SAND-PLAY-1 READY|PARTIAL head=<sha> objective=<pass/fail> victory=<pass/fail> defeat=<pass/fail> replay=<pass/fail> plans=<n> unit=<passed/total> e2e=<passed/total> skipped=<n> gpu=<renderer>`

Then the exact scenario rules, changed files, checkpoint SHAs, two-plan traces (actual successful runs, not proposed tactics), result/replay receipts, baseline comparisons, screenshots and remaining limits. Final owner reply: that line, branch and report path, then at most 150 words. READY requires the named acceptance gates; a screenshot-only result is PARTIAL. The seat retains any main/landing battery and landing decision.

IN: this objective-to-result-to-retry flow, its minimal typed/shared wiring and rendering, terminal session-command guards and reset integration, focused tests, README, report/evidence.
OUT: new scenarios or editor/launcher overhaul, platform/facility/OSINT data changes, new feeds/API keys, CMO extraction, fuel/loadouts/air launch-recovery, WeGo/multiplayer, saves, combat rebalance, generic mission/scoring editor, new map renderer, media generation, audio, main/tags/deploys. Do not reopen the landed runway reconciliation or other completed cards.
