# Sim fix card: lane sand-simfix-s387 (branch sand/sim-fix-s387)

Nothing committed, nothing pushed, `docs/ready/` untouched. All changes sit in the working tree.

## Process notes

- **AGENTS.md is missing.** The launch message said to read it first. It does not exist in the repo or any parent directory. I worked from CARD.md and the project CLAUDE.md.
- **Method.** Each finding got a unit test written against the audit receipt first. The unfixed engine ran 55 tests: 42 failed, 13 passed. I did not keep a per-test record of which 13 passed, so I can't claim which findings failed individually at baseline. No finding ended up as NOT REPRODUCED: every S2 has a test that exercises the fixed behaviour, and the group failed as a whole on the old engine.
- **GPU.** Playwright ran with real-GPU WebGL (RTX 3050 via WSL: `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`, `--mute-audio --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist`). The `--disable-gpu` fallback was not needed. Flags live only in a lane-local config outside the repo (`/home/ray/lanes/sand-simfix-s387/pw/pw-gpu.config.ts`). Port 3387, because another lane (s386) held 3001; I did not touch its process.
- **Test script.** `npm test` is now `vitest run && playwright test`; `test:unit` and `test:e2e` added. `vitest` and `vitest.config.ts` are new (alias `@` to `src`).

## Test counts

| | Before | After |
|---|---|---|
| Vitest unit tests | 0 | 58 (all pass). First red run on the unfixed engine: 55 tests, 42 failed, 13 passed |
| Playwright E2E | 36 | 40 (4 new in `tests/sand-007-engage-roe.spec.ts`) |

Unit tests by file: combat 7, engage 17, sensors 6, movement 6, session 3, events 8, ai 5, demoFacts 6.

## Findings

Test names are `describe` blocks in `src/lib/*/__tests__/`.

| Finding | Status | Test (file) | Fix |
|---|---|---|---|
| S1-1 player fire | FIXED | "S1-1 player engagement order" (7 tests) and "S1-1 player rules of engagement" (5 tests) in `engage.test.ts`; E2E `sand-007-engage-roe.spec.ts` (4 tests) | `engagePlayer` in `combat.ts` with the AI's validation (range from the contact's reported position, ammo, target domain, shooter state); per-unit ROE in `effectiveDoctrine.ts`; UI in `OrderPanel` + `useFireControls` |
| S1-2 cumulative damage | FIXED | "S1-2 cumulative damage" (4 tests: 20 C-802 hits on Mahan, state walks with total, carrier takes cumulative damage, aircraft one-hit rule) in `combat.test.ts` | `Unit.damage` persists; damaged / mission-kill / destroyed at 15% / 50% / 80% of damagePoints. `AIRCRAFT_ONE_HIT_RATIO = 0.3` is the named, separate aircraft rule |
| S2-1 rewind | FIXED | "S2-1 one authoritative state" (3 tests) in `session.test.ts` | `SimulationSession` (`session.ts`) is the single state; `useSimulation` holds it in a ref |
| S2-2 throttle without waypoints | FIXED | "S2-2 throttle applies without waypoints" (3) in `movement.test.ts` | `getUnitSpeed`: waypoint speed, then held authored speed (cleared by any throttle/route order), then table; throttle 0 = STOP |
| S2-3 arrival teleport | FIXED | "S2-3 waypoint arrival" (3) in `movement.test.ts` | Budget carries across legs; a finished route holds position |
| S2-4 uncertainty vs speed | FIXED | "S2-4 contact uncertainty is a function of simulated time" in `sensors.test.ts` | Aging uses simulated seconds |
| S2-5 weak ESM keeps precise track | FIXED | "S2-5 weak reports do not keep a precise track" (2) in `sensors.test.ts` | `mergeContact` only moves position / fix clock when the report is at least as precise |
| S2-6 autopause on unrelated fire | FIXED | "S2-6 autopause only for weapons aimed at the player" in `sensors.test.ts` | `autopause.ts` requires the weapon's target to be one of the player's units |
| S2-7 low aircraft as surface targets | FIXED | "S2-7 aircraft are not surface targets" in `engage.test.ts` | Domain by platform, not altitude |
| S2-8 fuel vs reachable impact | FIXED | "S2-8 weapon fuel versus arrival" (2) in `combat.test.ts` | Impact checked before fuel expiry |
| S2-9 doctrine leaks | FIXED | "S2-9 one doctrine resolver for combat" (`engage.test.ts`) and "S2-9 AI reads runtime doctrine" (`ai.test.ts`) | One resolver, `resolveUnitDoctrine`, used by combat, AI and detection. Precedence: default, side static, side runtime, mission static, mission runtime, unit orders |
| S2-10 spawned units miss mission | FIXED | "S2-10 spawned units join their declared mission" in `ai.test.ts` | Spawned units match the mission by name |
| S2-11 TriggerEvent | FIXED | "S2-11 TriggerEvent runs the forced event" in `events.test.ts` | Runs the forced event's actions once, with a cycle guard |
| S2-12 CAP vs nearby ship | FIXED | "S2-12 CAP picks an air contact" in `ai.test.ts` | CAP filters to air contacts |
| S2-13 transit restarts | FIXED | "S2-13 a one-shot transit stays finished" (2) in `ai.test.ts` | A non-repeating transit stops on completion; repeating still restarts |
| S2-14 neutrals as targets | FIXED | "S2-14 neutrals" in `engage.test.ts` | `isHostileSide` excludes Civilian/Neutral for auto-fire |
| S2-15 victory by time | FIXED (s401 completion) | "S2-15 the demo is won by transiting" (3) in `events.test.ts` covers the event definitions only; the tick-level result is "S2-15 the result is decided after combat" (3) in `terminal.test.ts` | Victory is `UnitEntersArea` for `us-cvn-1` in `transit-gate`; defeat beats draw beats victory. The tick holds an `EndScenario` result until combat finishes, then re-evaluates terminal events on post-combat state (`engine.ts` Phase 6) |
| S2-16 endless defences | FIXED | "S2-16 expendable defences" in `combat.test.ts` | Chaff etc. are spent per try (24 uses) |
| S2-17 event side filters | FIXED | "S2-17 event side filters" (4) in `events.test.ts` | Side checks use the detected / triggering side; `TimeInterval` state kept in `EventState`, not the shared scenario |
| S2-18 AI uses true positions | FIXED (s401 completion) | "S2-18 AI fires on its own contacts" (`engage.test.ts`), "S2-18 every side keeps contacts" (`sensors.test.ts`), and "S2-18 strike missions aim at what the side has detected" (3, `ai.test.ts`) | Per-side contact stores; AI reasons from its own contacts. `executeStrike` aims at the acting side's contact for `targetUnitId`, else the strike-area reference point |
| S2-19 detection vs time compression | FIXED | "S2-19 detection cadence is independent of time compression" in `sensors.test.ts` | Detection runs on a sim-time schedule (`GameState.schedule`); dt clamp 2000 ms, sim substeps at most 5000 ms |

## Decisions and interpretations to review

- **TIGHT.** A TIGHT unit fires only while a weapon is in flight at it, at contacts classified or better, preferring the launcher's contact. Consequence seen in play: a Hornet under Phoenix attack fires Harpoons at any classified hostile if it has no air-to-air option. FREE fires at contacts DETECTED or better. HOLD never fires.
- **Hostility.** Auto-fire enforces true-side hostility (`isHostileSide`). A manual ENGAGE order enforces it only when the contact is classified or better (an UNKNOWN or DETECTED contact can be engaged at the player's risk). Detection still treats every non-own, non-Civilian side as a target.
- **Movement.** Route finished means hold position. Any throttle or route order clears the held authored speed. Throttle 0 is a new STOP button.
- **Events.** A `ScenarioLoaded` trigger fires only within start + 1000 ms.
- **Command bar.** ENGAGE (E) and ROE (R) buttons only; N, F, X are keyboard-only. Five buttons overflowed 1280 px and broke the "chrome overlays do not resize the canvas" test, so below 1500 px wide the group labels are hidden (`terminal.css`). This is a look change for the s386 seat to accept or replace.
- **Observation, not fixed (out of scope).** Iranian surface boats prosecute aircraft contacts and drift off their patrol; the AI picks the nearest threat regardless of domain.
- **Observation, not fixed.** USS Cole's 6 Harpoons at Kaman 202 ran out of fuel because the target moved; Boghammar MRL fire at the Nimitz missed.


## Files touched in the s386 round-3 area (merge list)

`src/lib/plot/*`: untouched.

`src/components/terminal/TerminalPlay.tsx` (pure additions, 46 lines, no existing line modified; line numbers in the working tree):
- line 9: import `useFireControls`
- lines 41-42: `ROE_SHORT` const
- lines 134-136: `setRoe`, `engage`, `orderFeedback` destructured from `useSimulation`
- lines 284-317: `contactTag`, `useFireControls`, `cycleRoe`, and the E / N / R / F / X key handler effect
- line 552: `fire={fire}` on `<OrderPanel>`
- lines 668-672: command-bar separator, ENGAGE and ROE `Cmd` buttons (after TILT, before the AUTO anchor)

`src/app/play/terminal.css`: lines 587-599, one new `@media (max-width: 1500px)` block after `.tx-cmd-right` (tighter gap/padding, hides `.tx-group-label`).

Shared (non-terminal) files with UI edits: `src/components/game/OrderPanel.tsx` (FireControls block, STOP throttle), `src/components/game/useFireControls.ts` (new), `src/components/game/help/HelpPanel.tsx` (two help lines), `src/app/play/LegacyPlay.tsx` (wiring). I did not re-capture frames in `docs/handoffs/threejs-play-view-2026-11-03/frames/`.

`useSimulation.ts` was rewritten to wrap `SimulationSession`; `TerminalPlay.tsx` still consumes the same return shape plus `setRoe`, `engage`, `orderFeedback`.

## Scripted play check at 10x on /play
@@PLAY@@

## Demo fact check (scenario date fixed at 2026-03-15)

Audit source: docs/audits/SIM-AUDIT-2026-11-03.md section 3 (branch origin/dot/sandkasten-sim-audit). Research done 2026-11-03.
Files: src/lib/scenarios/demo.ts, src/lib/platforms/lookup.ts, src/lib/scenarios/__tests__/demoFacts.test.ts.
All weapon counts, ranges, Pk, damage points, missile-defense scores are simulation abstractions (unverified model assumptions).

## Corrections

1. USS Bunker Hill (CG-52) replaced by USS Chosin (CG-65). Unit id us-cg-1 kept; platform 598 deleted, new platform 9001.
   Bunker Hill decommissioned 22 Sep 2023: https://www.navy.mil/Press-Office/News-Stories/display-news/Article/3536575/uss-bunker-hill-decommissions/
   Chosin in active service, life-extended: https://en.wikipedia.org/wiki/USS_Chosin ; air-defense-commander cruiser of CSG 9 (Sep 2026): https://news.usni.org/2026/09/28/usni-news-fleet-and-marine-tracker-sept-28-2026
   Chosin is Mk 41 VLS (122 cells). Baseline number not claimed. Weapon numbers copied from the old 598 profile.
2. USS Taylor (FFG-50) replaced by USS Nitze (DDG-94, Flight IIA). Unit id us-ffg-1 kept; platform 1283 (Perry, 36 SM-1MR) deleted (no other references in src/tests), new platform 9002.
   Taylor decommissioned 8 May 2015: https://www.dvidshub.net/news/162764/uss-taylor-ffg-50-decommissions
   Nitze in active service, Flight IIA, Norfolk: https://en.wikipedia.org/wiki/USS_Nitze . Nitze's actual March 2026 tasking was not established; it is a plausible-role substitute. Weapon numbers copied from Mahan 111.
3. Cole (DDG-67) now uses own Flight I profile 9003 (was Mahan Flight II 111). Source: https://www.history.navy.mil/browse-by-topic/ships/modern-ships/uss-cole.html ; https://en.wikipedia.org/wiki/USS_Cole_(DDG-67) (90 VLS cells, 2 Phalanx). Weapon numbers copied from Mahan 111, unverified model assumption.
4. Super Hornet (342) gun: M61A1/578 changed to M61A2/412. https://www.gdots.com/wp-content/uploads/2025/11/400003005-20mm-F-A-18-E-F-Gatling-Gun-System-ARMAMENT.pdf
5. "76mm/50 OTO Melara" removed. Kaman (1088): "76mm OTO Melara Compact (76/62 family)" (Leonardo datasheet https://electronics.leonardo.com/documents/16277707/18404219/OTO_76_62_SR%2B%28MM08727%29_LQ_new.pdf?t=1625148164800). Bayandor (1652): "76mm Fajr-27 (OTO Melara type, approx.)" per https://en.wikipedia.org/wiki/Bayandor-class_corvette (2013 refit). Exact Iranian fits unverified.
6. Profile 2106 renamed "Sina Class [Kaman-derived missile boat, approximate fit]"; no longer claims Houdong. Sources: https://en.wikipedia.org/wiki/Sina-class_fast_attack_craft ; IISS and ONI p.34 links in the lookup.ts comment. Public sources list a 76 mm Fajr-27 and 40 mm gun on Sina boats; the profile's 4 C-802/Noor + ZU-23-2 fit is left as a labelled approximation.
7. New profile 9004 "Boghammar [IRGCN inshore patrol craft]": 12.7mm DShK MG (400), 107mm MRL modeled as type "gun" (12), no asm, no missileDefense, damagePoints 15. Sources: https://www.globalsecurity.org/military/world/iran/boghammar.htm ; https://admiraltytrilogy.com/scensupp/H002_OriginsHcon2021_IRGCN_Small_Boats_Briefing.pdf . demoConfig.ts reinforcements (ir-boghammar units, lines ~168 and ~177) still use 2106 and MUST be switched to 9004 by the demoConfig owner.
8. Nimitz (2740): added "RIM-116 RAM" (21 rounds, range 9 km, model assumption) as a sam entry. Capability sources: https://www.navy.mil/Resources/Photo-Gallery/igphoto/2002400143/ ; https://www.dvidshub.net/image/8679626/nimitz-launches-rolling-airframe-missile-during-live-fire-exercise . Sources establish capability, not a March 2026 magazine.

## Unverified, left as is

- Mahan 111 loadout/sensor fit (identity and Flight II are correct); Nimitz 2740 still labelled "[1998]" with Sea Sparrow 16 and Phalanx.
- Hornet 101/102 mixed AMRAAM/Harpoon loadout (authored assumption); Hawkeye 601 (E-2C, no weapons; no E-2C retirement shown before the date).
- Sina 101-103 fictional identifiers and 4 C-802/ZU-23 fit; Kaman 201/202 missile fit (C-802 vs Harpoon, counts) and the 35 km header vs 120 km C-802 range inconsistency.
- Phantom 301 (F-4E: 4 AIM-7E, 4 AIM-9P) and Tomcat 401 (F-14A: 4 AIM-54A, 2 AIM-7E, 2 AIM-9P): stocks and serviceability unverified. Unused F-14D profile 896 is not this Tomcat.
- All ranges, speeds, sensor/ECM variants, chaff counts, Pk, damage, readiness. Positions, headings, missions, callsigns are authored.

## Flagged for Ray

- Bayandor (FF-81, unit ir-ff-1, profile 1652): TWZ (https://www.twz.com/news-features/irans-key-naval-base-on-strait-of-hormuz-set-ablaze-from-strikes) quotes OSINT imagery analysis "IRIS Bayandor (81) sunk" at Konarak, 1-2 March 2026 (Operation Epic Fury); Critical Threats (https://www.criticalthreats.org/analysis/iran-update-evening-special-report-march-1-2026) is the other audit source (not independently read here); Wikipedia's Bayandor-class page lists the class as lost in the 2026 Iran war. Evidence is strong but not an official statement. Unit kept with code comments; decide whether to remove or reframe.
- Sina class: Wikipedia reports four Sina boats destroyed, two in an Israeli strike in March 2026 (date within month not checked). Not applied; the demo uses fictional Sina identifiers.
- Nimitz: in commission on 2026-03-15 but had finished its final deployment on 16 Dec 2025 and was in transit to Norfolk; service life extended to March 2027 (https://news.usni.org/2026/03/14/navy-extends-uss-nimitz-service-life-to-2027-in-line-with-carrier-john-f-kennedys-delivery). A Hormuz transit is a counterfactual premise.
- Chosin and Nitze: in commission on the date; neither was shown to be in the Gulf then (Chosin deployed with CSG 9 in Sep 2026). Counterfactual placement.
- Remaining active US cruisers in March 2026: Princeton, Robert Smalls, Gettysburg, Chosin, Cape St. George (Wikipedia Ticonderoga page). Swap Chosin for another if preferred.
- E-2C: E-2D transition scheduled for July 2026 (audit); not proof of retirement before the date.

## s401 completions (fix1, s402)

Red runs are on ee05df68 (the unfixed branch tip); green runs are on the fix branch.

| Item | Red on ee05df68 | Green |
|---|---|---|
| S2-8 | already green at ee05df68 (`combat.test.ts` "S2-8", Dot's repro and control) | unchanged |
| S2-9 | `ai.test.ts` "mission doctrine overrides distinguish side" and `engage.test.ts` "a mission-scoped runtime change does not leak to the side" failed (2 tests; the code was right, the tests checked the wrong unit, the wrong default ROE and the old bare key) | both pass; the Blue unit keeps the default `weapons-tight` while Red's Patrol holds |
| S2-15 | `terminal.test.ts` was a 0-byte file ("No test suite found"); the new "ship lost on the tick it enters the gate" test fails with victory instead of defeat | 3 of 3 pass |
| S2-18 | "S2-18 strike missions aim at what the side has detected": 3 of 3 fail (aimed at the true position) | 3 of 3 pass |

Unit totals: ee05df68 had 9 files, 60 tests, 58 pass, 2 fail, plus the empty suite file. Now 9 files, 66 tests, all pass.
