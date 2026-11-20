FIX SUBMITTED: a player can now launch an aircraft from the carrier, fly it on waypoints, recover it aboard, wait out turnaround, and relaunch — in continuous time and WeGo, with save/resume mid-sortie.

## What changed

- **Air operations model (`src/lib/simulation/airOps.ts`, new).** A carrier or airbase holds an air wing as counts by platform type (`Unit.airWing`). `LAUNCH` moves one aircraft out of the host's air wing and spawns a launching unit on deck; the sim clock then advances it through `launching -> airborne -> landing -> parked (turnaround)` in one phase inside the existing tick, so it works identically in continuous time and WeGo resolution. `src/lib/simulation/engine.ts` runs that phase after movement and before detection/combat.
- **Fuel/endurance.** A launched aircraft carries `fuelRemainingMs`, derived from the platform record's published `enduranceHours` (else `rangeNm / cruiseSpeedKts`, else a 2.5 h fallback) in `src/lib/platforms/lookup.ts`. It burns while airborne and is lost at zero. An aircraft whose host is destroyed has no deck to land on: it diverts (logged) and is lost when fuel runs out; a host that is destroyed loses its parked aircraft on the next tick.
- **Turnaround.** Recovery starts a per-type turnaround timer (the demo carrier uses 2 minutes); the slot shows TURNAROUND and refuses launch until it elapses.
- **Player orders.** `SimulationSession.launch()` / `.recover()` and the order panel's new AIR OPERATIONS section (same terminal buttons as the rest of the panel, no new visual style): LAUNCH per slot on a carrier/airbase, RECOVER plus fuel/status on a launched aircraft. Wired through `useSimulation` and `TerminalPlay`.
- **Scenario.** `src/lib/scenarios/demo.ts` gives USS Nimitz an air wing of four Super Hornets and one Hawkeye; the two CAP Hornets and the AEW Hawkeye already in the air are unchanged, so the existing Hormuz outcomes and tests are untouched.
- **Save/resume.** The battle-save codec round-trips the new unit fields and a new launched-aircraft id counter, so a mid-sortie save restores an airborne aircraft exactly.

## Acceptance (before -> after, from my own runs)

- Player can launch, fly, recover and relaunch an aircraft: **no -> yes**. New E2E spec `tests/sand-air-1-flow.spec.ts`:
  - continuous: LAUNCH a Super Hornet, run until airborne, fly it to a waypoint, RECOVER, land aboard (count back to 4, slot in turnaround), wait out turnaround, LAUNCH again.
  - WeGo: plan a LAUNCH + waypoint, commit and resolve to airborne, plan RECOVER the next turn, resolve to landed, and the next planning phase shows the slot ready and can LAUNCH again.
- Save mid-sortie, resume, recover: **no -> yes**. The same spec saves while the aircraft is airborne, loads the real file, confirms the airborne aircraft and reduced air wing restored, then RECOVERs and lands it.
- e2e: **new `tests/sand-air-1-flow.spec.ts` passes 3/3 (continuous, WeGo, save/resume)**. The full battery on THIS host (Vultr Linux, no GPU, SwiftShader) finished **71 passed / 16 skipped / 62 failed** — every failure is a pre-existing GPU-bound spec timing out on the software renderer (10 s canvas wait, 30 s default test timeout, or the 60 s plot-warm-up frame gate in `helpers/sandPlay.ts` `openPlay`), not a feature regression; none of the 62 failures is an air-operations test. The baseline "130/0" was measured on GPU host s254 (see the WEGO-A report).
- vitest: **355/355** (run on this host). A second full run under load tripped a pre-existing wall-clock flake in `unit/snapshot-seed.test.ts` (the "one request per second" timing assertion); that file passes 26/26 in isolation and is unrelated to this change.
- SPEC step 2 row of the WEGO-A table: PARTIAL (launch/recovery NO) -> **PARTIAL (launch/recovery YES; missions still AI-only)**.

## Notes

- Turnaround is modelled per aircraft type (one next-launch time per slot), not as a queue of per-aircraft ready times; launching a ready aircraft does not block the rest of the slot until a recovery advances the slot's timer. A faithful per-aircraft queue is a follow-up.
- Altitude changes are instantaneous (no climb model); aircraft spawn on deck at 0 ft and jump to a cruise altitude when the launch delay elapses.
- The demo uses a 2-minute turnaround so the E2E turnaround wait stays short; rearm/refuel for a real carrier would be longer.
- Read first per the card: `AGENTS.md` does not exist in this repo (also noted by the earlier platform-db lane); I followed CARD.md, CLAUDE.md and STEER.md (no steer entries were present at any checkpoint).
