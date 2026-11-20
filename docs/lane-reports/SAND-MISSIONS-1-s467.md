FIX SUBMITTED: a Sandkasten player can now create PATROL, STRIKE and INTERCEPT missions, assign their own units or launched aircraft to them, and watch the existing mission model carry them out — in continuous time and WeGo, with save/resume mid-mission (SPEC step 2 complete).

## What changed

- **Player mission model (`src/lib/ai/playerMissions.ts`, finished from the stopped DeepSeek WIP).** Pure state transformation that reuses the AI mission model: `createPlayerMission`, `assignPlayerMissionUnit`, `unassignPlayerMissionUnit`, `launchPlayerMissionAircraft` (SAND-AIR-1 launch + assignment in one order), and `runPlayerMissions`, which drives every player unit assigned to a player mission each AI cadence — patrol legs, CAP orbits, strike routes, weapons-free prosecution — and marks a mission aircraft `recovering` (home to its host, via `airOps.ts`) when its fuel reaches bingo or its strike route completes.
- **Engine wiring (`src/lib/simulation/engine.ts`).** The player's mission orders are generated on the same 5 s cadence as the AI, in both continuous play and WeGo resolution (`planAI: false` still drives player missions, so a committed assignment carries through the burst). A WeGo commit also seeds player-mission orders once, exactly like the AI's commit-time plan (`src/lib/simulation/session.ts`).
- **Save/resume (`src/lib/simulation/battleSave.ts`).** `playerMissions` round-trips the battle codec (validated `Mission` records); battle files written before the feature load with no missions, so existing saves are not broken.
- **UI (existing terminal look only).** The FORCES tab gains a MISSIONS panel: PATROL / STRIKE / INTERCEPT buttons, click-on-map reference points, CREATE/CANCEL, and a live list with assigned-unit counts and the mission feedback. The order panel gains a MISSION section for the selected unit: ASSIGN / UNASSIGN, and LAUNCH AIRCRAFT ON MISSION for a carrier/airbase with a ready aircraft. No new visual style, no dashboard chrome.
- **State (`src/lib/simulation/gameState.ts`).** `GameState.playerMissions` holds the player's missions, alongside the AI's scenario missions.

## Acceptance (before -> after, from my own runs)

- Player can create and assign PATROL / STRIKE / INTERCEPT: **0 of 3 -> 3 of 3**. New E2E spec `tests/sand-missions-1-flow.spec.ts` (5 tests, all passing on this host):
  - continuous PATROL: create a two-point patrol, assign USS Chosin, run — the mission routes the ship and it moves.
  - continuous STRIKE: create a strike, launch a Super Hornet onto it from the carrier — it goes airborne, flies to the target reference point, then returns and lands aboard (air wing count back to 4).
  - continuous INTERCEPT/CAP: create a CAP, launch a Hornet — it closes on the station and orbits.
  - WeGo: plan a PATROL assignment and a STRIKE launch across two turns; each resolves and the ship moved and the aircraft is airborne after the burst.
  - save/resume: save while a strike aircraft is airborne and still outbound, load the real file, confirm the mission and the airborne aircraft restored, then let it finish and land aboard.
- SPEC step 2 row: PARTIAL (missions AI-only) -> **YES** (waypoints/throttle/ENGAGE/ROE/sensors and aircraft launch/recovery were already YES; player missions were the last missing part).
- vitest: **361 total (355 before + 5 `playerMissions.test.ts` + 1 `battleSave.test.ts` round-trip)**. A full run on this host gives 359/361 — the only two failures are the pre-existing host-class wall-clock flakes (`unit/snapshot-seed.test.ts` "one request per second" timing, `unit/facilities-pipeline.test.ts` 5 s regeneration timeout); both files pass in isolation (55/55). They are unrelated to this change (same flakes the SAND-AIR-1 report recorded on this box).
- New e2e specs pass. On this Vultr box (no GPU, SwiftShader) I ran my new spec (5/5), `sand-air-1-flow` (3/3), and the three non-GPU core `sand-wego-1-flow` tests (turn loop + command lock, fog review, continuous/snapshot route isolation; 3/3). The remaining `sand-wego-1-flow` tests (the two long combat plays and the DPR-2 look-inspection frames) are GPU-bound and time out on the software renderer, exactly as the SAND-AIR-1 report recorded; the seat re-runs the full e2e battery on a GPU host.

## Notes

- Player patrol/CAP missions default to weapons-free (the AI patrol/CAP behaviour): a patrol unit prosecutes a detected contact inside its prosecution range instead of staying on the loop. That is the reused AI model working as designed, not a regression; the e2e PATROL test therefore asserts mission-driven routing/movement rather than an exact patrol waypoint.
- A player STRIKE with a single reference point flies to that point and then turns for home (recovery), matching the AI strike generator (target = last reference point, return = first).
- `runPlayerMissions` runs on the AI cadence and never touches units the player has not assigned to a player mission, so every other player order and all OPFOR behaviour are unchanged.
