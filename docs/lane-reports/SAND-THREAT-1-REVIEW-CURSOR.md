ACCEPT-WITH-NOTES S1=0 S2=1 S3=3

# SAND-THREAT-1 independent end review (Cursor, NO_EXEC)

Reviewed: `fc337505..1df1434c9a93b9b38739ac56aa31aba751445231` on `co3/sand-threat-1-review` (matches author tip `1df1434`). Card: `docs/handoffs/sand-threat-1-t438/CARD.md`. Evidence: `docs/verification/sand-threat-1-t438/`. No STEER.md. No AGENTS.md in this checkout. No final author `SAND-THREAT-1-REPORT.md` (referenced, never committed).

## Verdict

Ship the scenario tune for land battery and confirming cold play. Continuous 60x proofs and the passive UI debrief meet the card. One player-visible save break remains (Hormuz revision bump). Three S3 notes for the seat at land.

## Fence (gate 1) — pass

Production diff is only Hormuz scenario data / existing doctrine knobs:

| file | change |
|---|---|
| `src/lib/scenarios/demo.ts:162-233` | move Kaman 201/202; add Kaman 203–206 (`platformId` 1088, existing loadout) on eastern-approach picket |
| `src/lib/scenarios/demoConfig.ts:35-49` | assign all six to `iran-missile-boat-patrol`; new `referencePoints`; `prosecutionRange` 130→25 |

No UI, save-format code, AI behaviour, weapon, unit-type, or scripted passive trigger. Victory events `Transit Complete` / `Carrier Lost` (`demoConfig.ts:191-217`) are byte-identical to `fc337505` (no lines in the diff). Weapons-free / reinforcement events untouched.

Allowed non-prod: evidence tree, `hormuzThreat.test.ts`, `sand-threat-1-passive.spec.ts`, README/SESSION_NOTES, re-aims below.

### Re-aims (old toothless pins only)

1. `src/lib/simulation/__tests__/plans.test.ts:32-71` — Plan A (carrier alone, flank, direct) and no-orders: expect `defeat` / `<3.1h` / `<4h` instead of `victory` / undecided-at-5-days. Plan B still wins. Does not hide a regression; pins the new real loss.
2. `src/lib/simulation/__tests__/battleSave.test.ts:37-89,210-258` — unit floor 19→23 (4 added boats + 2 Boghammar reinforcement); mid-fight RNG 7919→7907 (old stream no longer hits mid-fight under new pressure); finished-battle case split into natural Plan-A defeat + southern-dogleg victory. Still exercises serialize/restore/terminal lock, not a softer bar.

## Behaviour proof (gate 2) — pass

Tests drive production `SimulationSession(demoScenarioConfig)` at continuous 60x with seeded `Math.random` only. No `injectKillOnCarrier`, no fixture defeat, no forced carrier kill.

| proof | test | seed-tables.md | threshold |
|---|---|---|---|
| do-nothing | `hormuzThreat.test.ts:133-146` | 5/5 defeat, `Carrier Lost`, T+~2.2h, C-802 hits >0, Iranian hits ≫50 | ≥4/5 |
| careless (Nimitz alone FLANK + HOLD) | `hormuzThreat.test.ts:148-158` | 5/5 defeat, T+~1.3h | ≥3/5 |
| 3a escort screen ROE FREE | `hormuzThreat.test.ts:162-166` | 5/5 victory, `Transit Complete`, 6.21h, 0 damage | ≥3/5 |
| 3b southern dog-leg + air | `hormuzThreat.test.ts:168-172` | 5/5 victory, 3.98h | ≥3/5 |
| plans differ | `hormuzThreat.test.ts:174-180` | Δhours >1 | material |

Committed table `docs/verification/sand-threat-1-t438/seed-tables.md:1-22` matches those assertions. Broader evidence `after-20-seeds.txt` is 20/20 on the same four plans. Hit composition `after-who-hit-the-carrier.txt:3-12` shows C-802 first, then 76mm — production combat log, not injection.

Passive e2e `tests/sand-threat-1-passive.spec.ts:14-86`: no orders, 60x, asserts UI DEFEAT + `Carrier Lost` + Iranian `ir-pc-*` launchers + `usOrders===0` + native dice. Receipts: `passive-defeat.json` (defeat, 154 hits, 4× C-802, launchers ir-pc-1..6, usOrders 0) and `passive-defeat-debrief.png` (live `[ DEFEAT ]` debrief, Nimitz LOST, combat log 76mm terminal hits).

## Plausibility (gate 3) — pass

- Type/loadout: platform 1088 Kaman / C-802 Noor + 76mm (`lookup.ts` / `kaman-class-combattante-ii.json`). Iran roster note in `demo.ts:162-167` (ten of class; six used).
- Geometry: pickets 15.5–20.3 km NE of Nimitz base course (`hormuzThreat.test.ts:203-223`); offset-window evidence supports that band; shipped offset ~18 km.
- Doctrine: `prosecutionRange` 25 km keeps boats on the line instead of chasing aircraft at 130 km — existing mission field, not new AI.
- No passivity special-case in engine code.
- Two workable answers remain (screen ahead; southern dog-leg); `after-20-seeds.txt` also shows oldB and dogleg4flank win 20/20.

## Old saves (gate 4) — note / S2

Format still `sandkasten-battle-save` v1. Scenario data change bumps Hormuz `configRevision`; existing refusal in `battleSave.ts:377-378` then blocks resume.

`docs/verification/sand-threat-1-t438/old-saves.txt:5-8`:

- `good` / `hormuz-early` / `defeat-fixture` from e3697c0d → REFUSED (`configRevision`)
- `snapshot` → LOADS

README discloses the Hormuz break. No save-format schema change and no save-code change. Still a player-visible load failure for prior Hormuz battles.

## Findings

### S2 (1)

1. **Prior Hormuz battle saves refuse to load after this revision.** Repro: load any `docs/verification/sand-save-1-s409/files` Hormuz save on this tip → `configRevision: this save was made with different rules or platform data…` (`old-saves.txt:5-7`). Snapshot saves unaffected. Inherent to hashing scenario units into `builtinRevision`; seat already flagged in SESSION_NOTES. Not a format bug; still breaks in-progress Hormuz files from before the tune.

### S3 (3)

1. **Missing author report.** `docs/lane-reports/SAND-THREAT-1-REPORT.md` is linked from README, SESSION_NOTES, and `demo.ts:167` but was never committed (cloud session capped). Diagnosis and knobs live in SESSION_NOTES + verification texts; seat can land prose.
2. **WeGo 15 min does not meet the continuous loss bar.** `after-wego.txt:5-11`: passive 15 min stays undecided at 12 h (heavy damage, no `Carrier Lost`); careless 15 min wins 3/5. Author correctly treats this as enemy re-plan-once-per-turn (rules), outside the tune fence. Default mode remains continuous (`wego.test.ts`); card proofs are continuous 60x.
3. **Kill flavour is gun-heavy.** After a few C-802 hits, most destroy damage is 76mm (`after-who-hit-the-carrier.txt`; debrief screenshot ends on OTO Melara). Existing defence/gun rules, not a tune defect; seat may want a later combat card.

## Scope check

| asked | result |
|---|---|
| Fence: data/doctrine only | yes |
| Do-nothing ≥4/5 | 5/5 (+20/20) |
| Careless ≥3/5 | 5/5 (+20/20) |
| Two sensible wins ≥3/5 each | 5/5 each |
| Passive UI DEFEAT | yes, committed receipt |
| Victory conditions unchanged | yes |
| No new AI / weapons / unit types / passive scripts | yes |

NO_EXEC: no browser, npm, or battery run in this lane.
