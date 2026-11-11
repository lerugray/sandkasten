ACCEPT S1=0 S2=0 S3=3

Static review of `47a1a74` on top of ACCEPT base `70b3aa1`. Diff `70b3aa1..HEAD` (product): map layout + FacilityLayer/LayoutController/TacticalMap wiring, tests, docs, receipts. No file under simulation, AI, combat, scenario data, or save format. Vitest here: 352/352.

1. Item 1 is honest. `tests/sand-threat-1-passive.spec.ts` keeps DEFEAT title, Nimitz destroyed, mission failed, Carrier Lost, hit/launcher/Iran/picket checks, zero US orders, native dice, elapsedHours under 4. Wait moved to `runUntilResultOnSimClock` (`tests/helpers/sandPlay.ts:99-147`): fails at T+4 h with no result, on a 120 s stall, or at 25 min wall. It only reads `__sandSession` and clicks the real PLAY button; nothing forces defeat. No sim/AI product file changed for item 1.

2. Win proofs stay. `hormuzThreat.test.ts` still requires both sensible plans to win in ≥3 of 5 seeds; FIX3 adds 20-seed frame-pattern losses and wins on stalled/uneven frames.

3. Item 2 is a production layout fix. `mapLayout.ts` takes facility discs from data from z9; `LayoutController.tsx` re-solves on `moveend` and when the drawn facility set changes, and only publishes when `layout.key` changes. Zero-overlap assertion on `sand-osint-1-overlap-map.spec.ts` is unchanged. `SAND_E2E_STUB_TILES` / `stubTileHost` only drops the tile network; the new loading spec holds tiles so idle never arrives and still fails on the old layout. Unit `map-layout-facilities.test.ts` shows the Khalij Fars / apt-ir-0057 defect without facilities and the clear layout with them.

4. Fences hold: no balance knobs, no scripted loss trigger, no save-format change, no new dependency, no /play styling.

S3:
- Evidence gap: author e2e stopped unclean (`docs/verification/sand-threat-fix3-t486/e2e-full-2-workers-stopped-at-cap.log`); card "0 failed" unproven here.
- `LayoutController.tsx:122-130` `onRender`: globe/terrain attribution inconclusive in the report; land battery must watch `sand-map-1-facilities` globe/terrain/satellite.
- `sand-osint-1-overlap-map` against real tiles and `sand-osint-1-overlap-plot` at 1440/1920 unproven at this candidate (container had no tile server / soft WebGL).

Item 5 — unproven for the land battery (author container):
- reds run: `design-system` tilt; `sand-001-unit-placement`; `sand-combat-1-record` (3); `sand-map-1-facilities` globe/terrain/satellite; `sand-map-2-plot-facilities` (8: plot clicks + keyless tile requests); `sand-osint-1-overlap-map` 1440+1920; `sand-osint-1-overlap-plot` 1440+1920; `sand-osint-1-rings` Arabic-on-plot; `sand-play-1-shots` 1440+1920.
- not reached: rest of `sand-save-1-flow`, `sand-victory-1*`, `sand-wego-1-flow`, `simulation`, `smoke` (passive then run alone, 4/4 on the new wait).
