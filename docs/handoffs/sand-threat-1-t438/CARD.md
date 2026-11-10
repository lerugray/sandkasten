**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-THREAT-1 — make the Hormuz defeat reachable in real play (GS co-seat 3, night t422, 2026-11-09)

grounded: sandkasten main fc337505 (2026-11-10 05:1x; SPEC steps 1-7 landed, SAND-RC-FIX1 + FIX2 UI fixes landed on it, land battery
unit 331/331, e2e 123 passed / 2 skipped). Start from fc337505. Cap: 10,800 s of work; stop and report what is left at the cap. Main's order s422 23:28 (HANDOFF-3 top block): "TUNE THE HORMUZ THREAT BEFORE EA. It is a spec defect, not a taste call".

MOVES: Sandkasten's first public EA build. SPEC step 6 says the player "wins or loses on the scenario's victory conditions". No real play
has ever lost: the RC cold play co3-sandcold-t415 (Opus first-time player, 37 min) won 3 of 3, including an undefended Nimitz at FLANK with
ROE HOLD, and the fast boats never reached the carrier. SAND-VICTORY-1's own report says "No natural defeat play through the UI"; every
defeat on record is a fixture (`injectKillOnCarrier`, 30 C-802s with fixed dice). When this lands: the documented loss is reachable by a
passive or careless player, so the RC can be re-played and the public-release gate can pass.

## What to change (tune, never script)
- Scenario: the built-in Hormuz demo (`src/lib/scenarios/demo.ts` units, `src/lib/scenarios/demoConfig.ts` Iranian missions, events and
  victory conditions). First MEASURE why the threat never closes: run the do-nothing and FLANK-straight plans headless and log, per Iranian
  unit, its position, mission state, detection of Nimitz, weapons state (ROE / weapons-free event timing) and range to Nimitz over time.
  Write that diagnosis in the report before changing anything.
- Then tune ONLY existing knobs: unit numbers and start positions, speeds, patrol areas, prosecutionRange, the timing of the existing
  "weapons-free" / "fast-moving contacts depart Bandar Abbas" events, existing loadouts and existing doctrine fields. The Boghammar fast
  attack craft and C-802 missile boats must be able to detect, close on and hurt an undefended carrier.
- **Never add a scripted trigger** (no "if player passive then kill carrier"), no new weapons, no new unit types, no new AI behaviour
  code. If the threat cannot be made real with existing data and doctrine fields, STOP and write in the report exactly which rule or
  behaviour is missing; the seat takes it to main. Do not invent it.
- Keep real-world plausibility: units, ranges and weapon numbers stay credible (C-802 ~120 km is already the scenario's figure).

## Proofs (battery, headless sim-level tests in the unit suite, plus one e2e)
1. **Do-nothing loses:** no orders, clock run to the end at max speed -> DEFEAT through the production combat path (not a fixture), in at
   least 4 of 5 seeds.
2. **Careless loses:** Nimitz alone, one FLANK waypoint straight to the gate, ROE HOLD, escorts left behind -> DEFEAT in at least 3 of 5 seeds.
3. **Two different sensible plans still win** (Ray 11-03: not scripted to one solution): e.g. (a) escorts forward with ROE FREE ahead of
   the carrier, (b) a southern dog-leg with CAP/air support; each wins in at least 3 of 5 seeds. Name the plans in the test names.
4. Existing unit and e2e suites stay green, except tests that hard-code the old toothless outcome: re-aim those only, list each in the report.
5. One e2e (`--workers=2` max): a passive run reaches the real DEFEAT debrief through the UI.

## Fence
- Scenario data and existing doctrine values only. No UI change (the landed FIX1/FIX2 own the UI), no save-format change (a save from e3697c0d still loads),
  no rule/victory-condition change: the loss conditions stay the ones the briefing already states; we make them reachable.
- Keep the look exactly. No new features.

## Done
Checkpoint-commit as you go; push to your branch; never merge to main. Write `docs/lane-reports/SAND-THREAT-1-REPORT.md`: the diagnosis,
each knob changed (old -> new, why), the seed tables for proofs 1-3, before/after test counts. Then the seat runs ONE end review
(different model) + land battery + a confirming cold play that reports whether a defeat was seen.
