FIX BLOCKED builtinRevision hashes sides (units); picket demo.ts cannot keep sand-rules-1.7e5cbf79.e2c9e818 without changing save/hash semantics (fence)

# SAND-THREAT-1 FIX1 — preserve old Hormuz save loading

Base `1df1434c`. Branch `co3/sand-threat-1-fix1`. No commit, no push.

## Diagnosis (measured)

`src/lib/scenarios/builtins.ts` `builtinRevision("hormuz")` digests:

```
scenario: { name, startTime, playerSide, sides, referencePoints }
missions, sideDoctrine, events
```

`sides` is the full side list, including every unit. The review note that the hash skips the unit list is wrong. Changing `demo.ts` unit counts or positions changes `configRevision`.

| tree | hormuz revision | old Hormuz fixtures | snapshot |
|---|---|---|---|
| author tip `1df1434` (pickets + mission edits) | `sand-rules-1.7e5cbf79.ba5c1736` | all three REFUSED | LOADS |
| variant 1: `demoConfig.ts` = fc337505, `demo.ts` pickets kept | `sand-rules-1.7e5cbf79.efd8decc` | all three REFUSED | LOADS |
| both files = fc337505 | `sand-rules-1.7e5cbf79.e2c9e818` | all three LOADS via `parseBattle` + `SimulationSession.restore` | LOADS |

Target revision `e2c9e818` appears only when `demo.ts` sides match fc337505. Any picket layout that makes the defeat reachable moves the digest off that value.

## Variant 1 (cheapest falsification)

Reverted production `demoConfig.ts` Missile Boat Patrol to fc337505 (`assignedUnitIds` ir-pc-1/2, old reference points, `prosecutionRange` 130). Kept author `demo.ts` six-boat picket.

Focused `hormuzThreat.test.ts` (`--maxWorkers=1`):

| proof | result |
|---|---|
| do-nothing ≥4/5 defeat | FAIL (1/5; seeds 1–4 undecided at T+12h) |
| careless ≥3/5 defeat | PASS (5/5) |
| escort screen ≥3/5 victory | PASS (5/5) |
| southern dog-leg ≥3/5 victory | PASS (5/5) |
| picket geometry / assigned ids / prosecution 25 | FAIL (4 tests; mission still fc337505) |

Seed table: `docs/verification/sand-threat-1-t438/variant1-seeds.md` (copied from the run).

Old-save probe on variant 1: good / hormuz-early / defeat-fixture REFUSED (`configRevision`); snapshot LOADS.

## Why demo.ts-only tuning cannot close it

Keeping `demoConfig.ts` byte-identical to fc337505 still leaves `sides` in the digest. Moving or adding boats in `demo.ts` yields a revision other than `e2c9e818`, so the three e3697c0d Hormuz fixtures stay refused. Restoring `e2c9e818` requires the fc337505 unit list, which is the toothless baseline the card replaced.

Fence forbids editing save code, `builtins.ts`, aliasing revisions, or migrating saves. No in-bounds path keeps both the reachable defeat and `e2c9e818`.

## Working tree left for harvest

Product files restored to author tip `1df1434` (threat proofs green; old Hormuz saves still refuse). Evidence and reports only:

- this file
- `docs/lane-reports/SAND-THREAT-1-REPORT.md` (author knobs + seed tables; notes the save break)
- `docs/verification/sand-threat-1-t438/old-saves.txt`
- `docs/verification/sand-threat-1-t438/variant1-seeds.md`
- SESSION_NOTES note on FIX1 block

No re-aim of picket assertions (variant failed). Passive UI e2e not run (focused unit proofs for the fix path did not pass).

## Commands and counts

```
npx vitest run src/lib/scenarios/__tests__/hormuzThreat.test.ts --maxWorkers=1
# author tip: 9 passed / 9
# variant 1: 4 passed / 5 failed

npx vitest run src/lib/scenarios/__tests__/fix1Probe.test.ts --maxWorkers=1
# revisions and parseBattle+restore outcomes as in the table above (probe removed after measurement)
```

Full host battery: not completed and not required by the fix card. The seat stopped the lane at 2026-11-10 09:17 EST after the blocked result was proven, while an extra Playwright run was active. No full-battery PASS is claimed; the focused author-tip and variant results above are the evidence.
