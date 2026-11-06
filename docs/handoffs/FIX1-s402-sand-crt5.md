# FIX1 s402: sand-crt5 adaptive render scale recovers at 60 Hz

**Verdict: FIX READY** (unit level; hand repro on the Mac still owed by the seat).

Branch `sand/crt5-fix1-s402` off `41b32291` (carrier jules-carrier/sand-crt5-s401). Spec: `docs/handoffs/CARD-s401-sand-crt5.md`.

## Change
- New pure module `src/lib/plot/adaptiveScale.ts` (`createAdaptiveScale`, `stepAdaptiveScale(state, nowMs, deltaMs)`; no THREE, no DOM).
  - `refreshMs`: 20th percentile of the last 2 s of rAF deltas, clamped 4-34 ms; falls at once, rises slowly (3.3% per 1 s check) so a sustained slowdown is not mistaken for a slower display.
  - Drop: `frameMs > max(20, 1.25 * refreshMs)` at a 1 s check, x0.85 per step, floor 0.5.
  - Recover: `frameMs <= 1.15 * refreshMs` for 3 consecutive checks, back to scale 1 in one step (stepwise x1/0.85 needed about 15 s from 0.5, over the card's 10 s).
  - No flip-flop: a drop within 10 s of an upgrade doubles the calm wait (3, 6, 12, 24, max 30 s); it resets after 10 s stable at full scale.
- `TacticalPlot.adaptScale` now calls the module; `forcedScale`, `resize()` on change, `__plot.renderScale` and `setRenderScale` unchanged. While forced, the module's scale is pinned to the plot's, so releasing the pin does not jump.
- NOTES.md "recovers after 3 s under 14 ms" sentence updated.

## Red -> green
`tests/plot-adaptive-scale.spec.ts` (6 tests, imports the module by relative path, no browser). Run with `node --test` through a small loader that stands in for `@playwright/test` (host rule: no Playwright).
- RED, old logic ported unchanged into the module: 3 pass / 3 fail. Failing: 60 Hz recovery (scale stays low after 10 s smooth), 120 Hz recovery, settle-after-upgrade case.
- GREEN, new logic: 6 pass / 0 fail (clean 60 and 120 Hz stay 1; 5 s of 30 ms falls to <= 0.6; 10 s smooth returns to 1; steady 16.7 ms makes zero changes over 120 s; 25 ms for 60 s gives at most 3 upgrades, each >= 10 s apart, and no changes in the last 5 s).
- `npm run build`: passes.

## Not run (host rule), seat to run elsewhere
- `npx playwright test tests/plot-adaptive-scale.spec.ts` (confirm it also passes under the real runner; it should list 6 tests).
- Existing e2e (`plot-labels.spec.ts`, smoke) to confirm no regression from the `adaptScale` edit.
- Hand repro on the 60 Hz Mac: load the plot, induce sustained slow frames until `__plot.renderScale()` drops, remove the load, run smoothly 10+ s, expect `renderScale()` back to 1. Also check the visual at full scale after recovery.
- A 25 ms steady scene at constant load settles at full scale because the display then looks like 40 Hz; that is intended, not a bug.
- SwiftShader lane GPU cannot prove smoothness; nothing here claims it does.

Note: the card says "do not commit or push"; the s402 brief overrides that (commit and push the branch, never main).

## Round 2 (seat review, S2): sustained load must not climb to full scale

**Verdict: FIX READY.** Defect confirmed: with `REFRESH_MAX = 34`, a steady 25 ms load pulled `refreshMs` toward 25, `dropAbove` rose past 25, and a slow machine ended at full resolution.

- `REFRESH_MAX` is now 17.5 ms (nothing slower than about 57 Hz is treated as the display's own rate). At constant 25 ms: `dropAbove` = max(20, 21.9) = 21.9 so it drops; the calm bar is 20.1 so it never recovers. 60 Hz and 120 Hz behaviour is unchanged.
- New test 5, "sustained 25 ms load keeps the scale dropped for the whole run": 60 s of 25 ms after a smooth start, at most 3 upgrades, then each second of the final 30 s must be below scale 1, ending at <= 0.6.
- Red -> green: with `REFRESH_MAX = 34` the suite is 6 pass / 1 fail (new test 5); with 17.5 it is 7 pass / 0 fail. The 60 Hz and 120 Hz recovery tests stay green. `npm run build` passes.
- Known trade-off: a genuine 30-40 Hz display is now treated as a slow machine and will sit at reduced scale under any frame time above about 22 ms.
- Still for the seat elsewhere: real Playwright runner, existing e2e, hand repro on the 60 Hz Mac.

## Round 3 (Dot re-review of ad316eb, S2): startup partial intervals pinned the refresh estimate

**Verdict: FIX READY.** Confirmed: the first frame ran a check with one sample, so a partial 4 ms interval became `refreshMs`; it falls at once but rises only 3.3% per second, so recovery after a later hitch took about 47 s.

- `adaptiveScale.ts`: the first 5 deltas are ignored for the refresh estimate (and the first check is delayed 1 s); `refreshMs` is only updated once the window is full (>= 20 samples spanning >= 1.5 s); `REFRESH_MIN` raised from 4 to 6.9 ms (144 Hz) so one short delta cannot pin it.
- New tests (4): Dot's repro (4 ms first delta, 3 s at 60 Hz, 5 s at 30 ms, 10 s at 60 Hz -> back to 1); a burst of 1-4 ms partial deltas then 60 Hz; a 1 ms first delta then 120 Hz; a 100 ms first delta then clean 60 Hz never drops.
- Red -> green: on `ad316eb` 7 pass / 4 fail (all four new tests); now 11 pass / 0 fail. The earlier 7 tests stay green. `npm run build` passes.
- Still for the seat elsewhere: real Playwright runner, existing e2e, hand repro on the 60 Hz Mac.
