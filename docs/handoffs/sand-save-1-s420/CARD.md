**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
MOVES: A player can save a running Hormuz battle to a local file, close the tab, reload it paused with the same orders, contacts, ammunition, damage and events, then continue to the real outcome or try another plan from that checkpoint.
SPEC STEP: SPEC.md player step 7, "Saves a game in progress and resumes it later" (main 69ee411d); the parity study §12 and Top 25 item 25 name game save/resume as MUST.
RAY-ASK: 2026-11-09 15:29 "Yes, add saves"
REQUEST: GS #ask-dot-night-s409-4, 2026-11-07: choose one release-critical BUILD after SAND-PLAY-1.

# SAND-SAVE-1 Save and resume a battle

Mode: BUILD / FINISH. One owner, pushed working checkpoints, ONE independent end review. Manual local battle files only.

## Why this is next

Original base (s409): main `dbe7c811`; now main `69ee411d` (see Door). SAND-PLAY-1 is landed and accepted: 214/214 units; GS's merge-head real-GPU battery is 85 passed / 2 capture-only skips / 0 failed. Its two successful plans take about 3–4 simulated hours. The objective, combat, victory/defeat and retry now work. Refreshing or closing the tab still loses the running battle.

Read `SPEC.md`, `README.md`, `docs/lane-reports/SAND-PLAY-1-s409.md`, and [OPUS-REVIEW.md](https://github.com/lerugray/sandkasten/blob/dbe7c811a8aa1cb5a2310d4f176578ce28b13df1/docs/verification/sand-play-1-s409/OPUS-REVIEW.md). Read the completed [CMO parity study](docs/handoffs/sand-save-1-s420/CMO-PARITY-EXCERPT.md), reviewed blob `28c981b813377c8a2e67db736fc15485dbc95026`: §12 saves/resume, §15 approachable play, Top 25 item 25. Current code overrides stale study statuses.

The editor exists and exports scenario setup JSON. It does not save a running `SimulationSession` or supply a complete playable missions/doctrine/events configuration. Do not mistake that export for battle persistence. General community-scenario loading, fuel/air operations and WeGo are separate cards. This card preserves the playable loop already shipped, rather than extending its combat rules.

## Door (GS co-seat 3 t389, 2026-11-09: replaces the s409 home-PC op-run door, which is full)

One named owner: a **backup-account Claude cloud session, Sonnet 5.5**. **Owner cap 9,000 seconds total**, including fixes; stop at a coherent pushed checkpoint and report PARTIAL if the cap is reached. The ONE independent Opus 5.5 end review (1,800 s) is GS's to assign after CP3: do not launch reviewers.

**Base moved and GS accepts it:** build from `main` `69ee411ddb7ab9cf20c579257e6d197ef289e76a` (this brief branch sits on it), not dbe7c811. Since dbe7c811, SAND-WEGO-1, SAND-COMBAT-1 and SAND-VICTORY-1 landed: WeGo mode, production combat and victory/defeat/PLAY AGAIN now exist on main. Save/restore must cover the state those added (WeGo phase/held orders included when a WeGo battle is saved, or reject WeGo saves with a clear message and say so in the report). Re-read the current code before trusting this card's file list or the baselines below (current unit/E2E totals replace 214/85).

Branch: push checkpoints to your session's own branch (or `s420co3/sand-save-1` if you can create it). The parity-study sections this card cites are vendored at `docs/handoffs/sand-save-1-s420/CMO-PARITY-EXCERPT.md`; never clone or fetch another private repo. Never ask the user anything: decide, record it in the report, continue. GS owns merge, the landing battery and main. Never force-push, change tags, push main or deploy. Mute audio.

**Cloud battery:** run full units, typecheck, production build and the full Playwright E2E headless with software WebGL (SwiftShader) inside your container, `--workers=1`; report `gpu=<renderer>` truthfully. The **serial real-GPU recipe below is GS's land battery** at harvest, not yours: skip it and say so. Pixel looks from your software renders are fine for the report.

## BUILD

### 1 A complete and validated battle checkpoint

Add an explicit versioned save format and a session-owned export/restore boundary. `JSON.stringify(session.snapshot())` is insufficient. Inventory the authoritative state before implementing:

- scenario identity, rules/content compatibility revision and the chosen player side;
- simulation clock, speed, sides/units including spawned/destroyed units and accumulated damage, orders/waypoints/throttle/radar/ROE, score, reference points and runtime doctrine overrides;
- both the player's and other sides' contact stores, classification/uncertainty/fix ages, and detection/AI/engagement schedules;
- active weapons, expended weapons/defences, cooldowns and combat record;
- fired-event set, interval bookkeeping, messages/read flags and any authoritative scenario result;
- private AI patrol indices and started/completed transit sets; autopause preferences and appropriate runtime bookkeeping;
- restore-safe contact, weapon and log ID allocation. Current `contactSeq` in `engine.ts` and `idCounter` in `combat.ts` are module globals and cannot restart into IDs already in the loaded battle.

Encode/revive all Maps and Sets deliberately. Do not serialize closures, React state, class instances or arbitrary executable scenario definitions. Keep the static scenario/missions/events/doctrine and platform data in the shipped game, selected by a stable built-in identity and compatibility revision. Compatibility covers actual simulation profiles, including `SIMFIX_PROFILES`, not just the platform source records. Support the two existing built-in configurations: the Hormuz battle and the committed neutral snapshot. This is the same save feature, not a new scenario importer. Reject unsupported identities or incompatible revisions before replacing anything; v1 needs a clear error, not a migration framework.

Validate the complete file before use: size bound, schema/version, finite numbers and allowed ranges, required arrays/maps, unique IDs and cross-references, known built-in configuration, valid runtime states. Treat file text as data, never code or HTML. A malformed, truncated, oversized or incompatible file must leave the current battle intact at its pause point. Stage the restored session and swap atomically.

Keep random combat behavior as it is. Saving preserves the current state, not a promise of identical future random outcomes. Do not introduce a new PRNG, deterministic replay system or combat rebalance for this card. Tests can supply the same deterministic random stream to compare continuation.

### 2 Save and load through the real terminal

Add keyboard-accessible SAVE BATTLE and LOAD BATTLE controls in the existing terminal register. Saving pauses at an atomic checkpoint and exports a clearly named, versioned local file. Loading uses a local file picker, previews scenario name/time/result, and deliberately confirms replacing an active run. Cancel or validation failure does not discard the run or issue orders. No cloud account, upload, server storage, autosave or live network source is required.

A fresh tab can load the file and immediately see the correct scenario, current clock, objective/state and player-visible record. Always load paused; do not advance by wall time spent away or silently run a restored speed. Reset timer baselines. Clear stale targeting/waypoint/measure/selection/dialog state and default to ordinary player fog. Do not reveal the AI contact store or hidden unit identities in the loaded UI.

Use explicit configuration ownership rather than mutating module-level `demoScenarioConfig`. The existing `SnapshotPlay.tsx` swap is a known boundary risk. Give the active play/session a stable built-in config; reset/replay after load restarts that config, not the previous route's scenario. Test demo↔snapshot navigation and the legacy routes. Snapshot saves must remain neutral observation, without a carrier objective or invented victory.

Historical combat/messages are part of the saved battle. Optional generated InfoWar media is **not saved in v1**: say so beside save/load and in README. Clear its feed on restore, seed its previous-log/message cursors to the restored lengths, and invalidate callbacks from the discarded session so old events are not regenerated or appended. Do not serialize pending requests/connections, require Ollama, or add new media generation. Ordinary gameplay and save/load must work without it.

### 3 Resume, outcome and retry stay truthful

Continue the real simulation after load: pending weapons continue, ammunition does not refill, AI does not restart completed missions, contacts age correctly and already-fired events do not repeat. A loaded victory/defeat remains terminal and keeps its deciding reason; PLAY AGAIN starts fresh. A running checkpoint can be reloaded deliberately to take a different plan without altering the saved file or weakening the scenario.

Keep the current living-carrier transit victory, carrier-destruction defeat and same-tick defeat precedence. No time/score shortcut, automatic route or disabled opponents.

## Touched SAND-PLAY-1 S3s

Use the exact numbering in OPUS-REVIEW.md. These are bounded fixes/receipts in this flow, not a new sweep of the whole product:

- **1 and 2:** capture the resumed focused objective with a selected unit and actual orders, and a real resumed-run victory debrief at both required DPR 2 sizes. Do not substitute instant-result fixtures.
- **3:** correct the earlier lane report's plan-A claim to afloat **damaged**, losses 2, matching its recorded trace. Keep the original trace.
- **4 and 5:** remove redundant "afloat" wording from the deciding line and clear/suppress stale HOLD/autopause cues on terminal results and load. Restored state must not look like an old pending contact alarm.
- **8:** exclude incidental `next-env.d.ts`/build-artifact churn; identify any necessary tracked change accurately rather than calling it docs-only.
- **9:** put test-only session access behind an explicit test-build flag, disabled in the normal production build even if `window.__SAND_E2E__` is set. Save/restore uses a real typed application API, not that handle.
- **10:** actually exercise demo→snapshot→demo navigation, reloads and both legacy routes. Do not use a direct snapshot load as proof of all paths.
- **11:** retain raw test command output, exits, exact tested SHA, renderer and named capture-only skips, not a five-line summary.
- **12:** selecting/clicking briefing body text must not close it; use explicit controls/keys. Include tilt-mode objective legibility after restore.

**Deferred:** S3 **6 and 7**, opening gate/site-label crowding and the grid-label/facility collision, are map-layout work outside this save slice. Record that they remain, and introduce no new overlap.

## Pushed checkpoints

1. **CP1 checkpoint contract:** state inventory, typed/versioned codec, validation, atomic session restore and restore-safe IDs. Failing-first round-trip and rejection tests become green. Push.
2. **CP2 real user path:** local save/load controls, explicit config ownership, paused restoration, optional-media lifecycle and finished/replay behavior. Push a usable slice.
3. **CP3 finished evidence:** touched S3s, full battery, real close/reopen/continue receipts, pixels, README and report. Push the exact tested head.

Likely files: `session.ts`, `useSimulation.ts`, a focused codec/validation module, minimal state/ID allocation hooks in `engine.ts`/`combat.ts`, `TerminalPlay.tsx`, `SnapshotPlay.tsx`/`LegacyPlay.tsx`/play routing, terminal CSS and the smallest InfoWar reset/epoch hook. The owner chooses the design; no broad engine rewrite.

## FINISH acceptance

- **Round trip:** create a nontrivial battle with routes, partial damage, spent ammo/defences, contacts on both sides, a fired one-shot event and a pending weapon. Export, reconstruct in a fresh session and compare every authoritative field except the intentional paused/UI reset. Maps/Sets and AI history survive; new IDs cannot collide. With the same test random stream, continuation matches the uninterrupted control.
- **Boundary cases:** tests cover cold start, mid-fight, post-spawn, post-victory/defeat, saving while time runs, repeated load, reset after load and fresh-page ID allocation. Verify no repeated briefing/reinforcement/score, ammunition refill, mission restart, timer jump or lost weapon. A terminal save still blocks simulation-mutating commands.
- **Failure cases:** wrong version/config revision, truncated/oversized files, invalid numeric/state/reference data, duplicate IDs, wrong file type, cancel and rapid repeated input preserve the current battle. Surface observable file-read/export failures, and distinguish initiating a download from verifying a disk write.
- **Real player path:** use ordinary controls and default fog to play Hormuz into a nontrivial mid-battle checkpoint, download it, close the page, open a fresh page, load the actual file, resume and reach real victory. No session writes, teleport or direct result assignment counts as this proof. Separately load a production-combat defeat fixture, verify terminal behavior and PLAY AGAIN; label the fixture.
- **Two approaches:** reload one unchanged checkpoint and issue a materially different route or engagement/sensor plan. Record actual commands and continued outcomes; continuation need not repeat random rolls or win identically. At least one full resumed run above must really win. Preserve the existing two winning-plan tests.
- **Configuration and lifecycle:** round-trip the existing neutral snapshot too; no mission/objective bleed. Navigate both directions and exercise legacy routes. Repeated loads/replay do not leak timers/listeners, stale media callbacks, selections or God mode. Save files use only local browser I/O and work with source/LLM network calls blocked.
- **Look:** open actual 1440×900 and 1920×1080 DPR 2 pixels for save/load, validation error, resumed objective with orders in flat and tilt, real resumed victory, and loaded defeat/replay. Keep 14 px body / 12 px label floors, constant canvas size, readable controls and no unintended dismissal or shortcut propagation. Existing terminal/Harpoon register only.
- **Battery:** full units and serial real-GPU E2E on the exact final code head; production build and typecheck with comparison against untouched base for any existing failure. Preserve the 214-unit and 85-E2E baseline intent. Never weaken an assertion or hide failures in totals. Verify normal production does not expose the E2E session handle.

### Serial real GPU recipe (GS land battery at harvest; not run in the cloud session)

Check `uptime` and `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check` first. Exit 3/4: wait ten minutes and retry within cap. Use a free `SAND_E2E_PORT`, `SAND_E2E_GPU=1` (or the established lane-local wrapper), Chromium `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --mute-audio`, and environment `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib`. Run `nice -n 15 npx playwright test --workers=1 --reporter=line`. Save raw output and `WEBGL_debug_renderer_info`; confirm NVIDIA/D3D12, not SwiftShader/llvmpipe. No driver/security changes or broad process kills.

## ONE end review and deliverable

One independent Opus 5.5 reviewer evaluates the exact tested head, behavior plus look together, within 1,800 seconds. Open with: "Does a player now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO." Return ACCEPT/REJECT, S1/S2 only, with concrete receipts. Same owner fixes accepted findings; same reviewer verifies them within the original budgets. No new audit or separate look lane. GS alone decides merge/landing.

Report `docs/lane-reports/SAND-SAVE-1-s409.md`; receipts under `docs/verification/sand-save-1-s409/`. First line:

`SAND-SAVE-1 READY|PARTIAL head=<sha> roundtrip=<pass/fail> cold_resume=<pass/fail> atomic_reject=<pass/fail> terminal=<pass/fail> snapshot=<pass/fail> unit=<passed/total> e2e=<passed/total> skipped=<n> gpu=<renderer>`

Include schema/version compatibility, state inventory, explicit media exclusion, checkpoint SHAs, real resume trace, second-plan outcome, S3 dispositions, named skips, raw logs and screenshots. Final reply: that line, branch and report path, then at most 150 words. Missing fresh-page continuation is PARTIAL, not a save feature demonstrated by a unit test alone.

OUT: cloud saves/accounts, autosave, save-slot management, generic scenario import/editor overhaul, arbitrary code in files, migrations across versions, deterministic replay/PRNG redesign, multiplayer/WeGo, fuel/air ops, platform/facility/OSINT data changes, combat rebalance, broad label-layout fixes, audio, main/tags/deploys.
