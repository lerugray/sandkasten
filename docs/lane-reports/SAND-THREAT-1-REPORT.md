# SAND-THREAT-1 — Hormuz defeat reachable in real play

Author tip `1df1434c` on `claude/sand-threat-1-t438-lane-fr9no6` / harvested base for FIX1. Scenario data only. No engine, AI, combat, victory-rule, platform, UI or save-code change.

## Diagnosis (before knobs)

On fc337505, do-nothing and FLANK-alone runs did not lose. The two Kaman boats sat in the strait (`55.8,26.6` / `56.4,26.5`), patrolled a loop that pulled them north of the approach, and with `prosecutionRange` 130 km chased the first long-range air contact instead of holding a line the carrier had to cross. Escorts ahead of the carrier screened what little surface threat remained. Evidence: `docs/verification/sand-threat-1-t438/baseline-diagnosis-fc33750.txt`.

## Knobs (final)

| knob | old (fc337505) | new | why |
|---|---|---|---|
| Kaman count / ids | 2 (`ir-pc-1`, `ir-pc-2`) | 6 (`ir-pc-1`…`ir-pc-6`), platform 1088 | denser picket across the eastern approach |
| Kaman starts | strait positions above | line ~`57.19,25.709` … `57.049,25.836`, heading 135, speed 10 | 15.5–20.3 km NE of Nimitz base course (315): inside a boat's surface radar horizon of the carrier, outside it for the lead escorts |
| Missile Boat Patrol `assignedUnitIds` | `ir-pc-1`, `ir-pc-2` | all six | every boat runs the line |
| Patrol `referencePoints` | `55.8,26.6` / `56.4,26.3` / `56.0,26.0` | `57.218,25.683` / `57.021,25.861` | ends of the picket line |
| Patrol `prosecutionRange` | 130 km | 25 km | hold the line; close only on a contact a boat's own radar holds |

Files: `src/lib/scenarios/demo.ts`, `src/lib/scenarios/demoConfig.ts`.

## Proofs (production session, continuous 60x, seeds 1–5)

From `docs/verification/sand-threat-1-t438/seed-tables.md` (author tip):

| proof | need | got |
|---|---|---|
| do-nothing → DEFEAT | ≥4/5 | 5/5, Carrier Lost, T+~2.2h |
| careless FLANK alone ROE HOLD → DEFEAT | ≥3/5 | 5/5, T+~1.3h |
| escort screen forward ROE FREE → victory | ≥3/5 | 5/5, Transit Complete T+6.21h |
| southern dog-leg + CAP/Hawkeye → victory | ≥3/5 | 5/5, Transit Complete T+3.98h |

Extended 20-seed runs and offset window: `docs/verification/sand-threat-1-t438/`. Passive UI e2e: `tests/sand-threat-1-passive.spec.ts` (DEFEAT debrief).

Focused unit file on author tip (FIX1 re-measure): `hormuzThreat.test.ts` **9/9** with `--maxWorkers=1`.

## Old Hormuz saves

`builtinRevision("hormuz")` after the knobs is `sand-rules-1.7e5cbf79.ba5c1736` (was `…e2c9e818`). The three fixtures under `docs/verification/sand-save-1-s409/files` (`good`, `hormuz-early`, `defeat-fixture`) are refused by the existing `configRevision` check. Snapshot saves still load (`…cbc0f6b9`). See `docs/verification/sand-threat-1-t438/old-saves.txt` and FIX1 report: restoring `e2c9e818` while keeping the picket is out of bounds because the revision digests `sides`.

## Decisions for main (unchanged)

1. Pre-change Hormuz battle saves refuse; snapshot saves load.
2. Carrier kill is mostly 76 mm once missiles are stopped (~85%) with no saturation rule; guns skip the defence roll.
3. WeGo 15-minute turns: passive run may not lose, because the enemy re-plans once per turn.
