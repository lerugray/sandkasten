# SAND-ART1-LANDGATE5 — Play never reaches the victory debrief

Lane `co3-sandlg5-t696` on tip `45db63e` (LANDGATE4 `3b3eb48` + LANDGATE5 re-plan). Dirty tree left for the harvester. No commit / push.

## Defect

`tests/sand-play-1-shots.spec.ts` step 3: after the focused-objective frame, `runUntilResult(page, 40_000)` timed out waiting for `result-overlay` at both 1440 and 1920 on the LANDGATE4 tip (t694 home-PC GPU rerun). Briefing and objective frames already painted; this is not a blank-theater regression.

## Root cause (with evidence)

**The Transit Complete / UnitEntersArea win rule is intact. Continuous play still advances. The clock was held by autopause after SAND-THREAT-1, and the shot helper only resumed when the DOM label said PLAY.**

| Suspect | Verdict | Evidence |
|---|---|---|
| 1. SAND-THREAT-1 win rule / gate check | **Not a rule change** | `demoConfig.ts` still ends on `UnitEntersArea` for `us-cvn-1` / `transit-gate` with no hostile-in-gate condition. Session teleport-after-start with autopause ON reaches `scenarioResult === "victory"` in vitest (355/355 still green, including `hormuzThreat` and `session` finished-state). |
| 2. `MAX_REAL_DT_MS` removed on sealed WeGo turns | **Not continuous** | Continuous path still clips in `engine.ts` (`MAX_REAL_DT_MS = 2000`). WeGo-only change in `session.tickWeGo`. |
| 3. `runUntilResult` / clock after the position write | **This is the failure** | Live `__sandSession` read after the old step-3 order (unpause → write gate centre): `isPaused: true`, `autopauseEvent: "New contact detected"`, `scenarioResult: null`, carrier already at `(56.45, 26.65)`, sim clock frozen. Six Kaman pickets sit inside the opening CSG radar picture (THREAT-1); the first detection tick autopauses before a running tick can evaluate `UnitEntersArea`. `runUntilResult` only clicked when the DOM label matched `/PLAY/`; under a heavy DPR-2 plot frame that label can lag the authoritative pause, so the 40s wall budget burns on a stopped clock. One PLAY resume after the write produces `Transit Complete` + overlay on the next tick. |

So the mission “never ended” in the shot test because **time was not running**, not because victory was unreachable.

## Fix

Test / harness only — the shipped scenario and session rules already match the SPEC. The shot sequence asked for a production tick to decide after a living carrier is in the gate; it did not promise “unpause at the start fix, then teleport.”

| File | Change |
|---|---|
| `tests/sand-play-1-shots.spec.ts` | Write `us-cvn-1` to `GATE.centre` **while held**, then PLAY. The first production tick sees the unit in the gate and `EndScenario` fires (same tick as any opening autopause). |
| `tests/helpers/sandPlay.ts` (`runUntilResult`) | When `__sandSession` is present, resume from `snapshot().gameState.isPaused` and return once `scenarioResult` exists (then wait for the overlay). Label-only resume remains as fallback. |

No fonts, no art, no `/map` or plot render churn, no scenario/session production edits, no merge to main.

## Battery (this lane)

```text
npx vitest run
  → Test Files 28 passed (28) / Tests 355 passed (355)

npx playwright test --workers=1 tests/sand-play-1-shots.spec.ts tests/sand-play-1-result.spec.ts
  → 4 passed (1.7m) — play-result CP2 ×2, play-shots 1440 + 1920
```

Harvester still re-checks on home-PC GPU with map/plot/play.

## Harvester

Re-run on home-PC GPU: vitest + map, plot, and play specs. Expect play-shots step 3 (victory debrief) and step 5 (defeat debrief) green at 1440 and 1920; play-result CP2 green; SAND-THREAT-1 picket line still holds in unit tests.
