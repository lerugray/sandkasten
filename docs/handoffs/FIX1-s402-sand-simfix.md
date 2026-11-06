# FIX1 s402: sand-simfix review REJECT fixes

**Verdict: FIX READY.** All four S2s are closed, the drop list is done, `npm run test:unit` is 9 files / 66 tests, all pass, and `npm run build` passes. No Playwright, e2e or dev server was run on this host.

Branch `sand/simfix-fix1-s402`, started from `ee05df68` (jules/sand-simfix-s401).

## Per finding, red to green

| Finding | Red on ee05df68 | Green |
|---|---|---|
| S2-15 result decided before combat | `terminal.test.ts` was a 0-byte file ("No test suite found"). The new test "a ship lost on the tick it enters the gate is a defeat, and stays one" failed: carrier destroyed, result `victory` (expected `defeat`). | 3 of 3 pass: the defeat (after tick 1 and tick 2), the no-weapon control (victory), and a repeatable terminal event firing once per tick. |
| S2-18 strike aims at the true position | "S2-18 strike missions aim at what the side has detected" (`ai.test.ts`): 3 of 3 failed (no contact, reported-position contact, other side's contact). | 3 of 3 pass. |
| S2-9 test red (ai.test.ts) | "mission doctrine overrides distinguish side" failed: it indexed `state.sides[0]` (the player side) and expected a `weapons-free` default. | Passes: units are looked up by id, and the Blue default is `weapons-tight`. |
| S2-9 test red (engage.test.ts) | "a mission-scoped runtime change does not leak to the side" failed on the old bare key. | Passes: the key is `Iran:Quiet Patrol`. |
| S2-8 | Already green at ee05df68 (combat.test.ts). | Unchanged. |

Unit totals: ee05df68 had 9 files, 60 tests, 58 pass, 2 fail, plus the empty terminal suite file. Now 9 files, 66 tests, all pass.

## What changed

- **S2-15.** `evaluateEvents` takes `{deferResult, terminalOnly, skip}`, returns `pendingResult` and `ran`, and exports `mergeResults` (defeat > draw > victory). In `engine.ts`, Phase 4 holds the `EndScenario` result. Phase 6 runs after combat and re-evaluates only `EndScenario` events on the post-combat state. It skips every event that already ran in Phase 4 that tick, so a repeatable event cannot fire twice. The merged result is final, and the substep loop still stops on it.
- **S2-18.** `executeStrike(unit, orders, mission, threats)` aims at the acting side's own contact for `targetUnitId`, and falls back to the strike-area reference point. `allUnits` is gone from it. `executeEscort` still takes `allUnits`, as it did before.
- `NOTES.md` now cites the correct tests for S2-15 and S2-18 and has an "s401 completions" section.

## Drop list, done

- `tsconfig.tsbuildinfo`
- 17 `patch_s2_*.sh` scripts (the review said 16; the tree had 17)
- `tests/zz-playcheck.spec.ts`
- `docs/handoffs/CARD-s401-sand-simfix.md`
- The empty `terminal.test.ts`, replaced with the real test
- `docs/handoffs/platform-db-2026-11-03/CARD.md` restored from main (8afe1a5b)

## Not done (S3s, left as is)

- The diff still goes past the card FENCE: platform ids 9001-9004 in `platforms/lookup.ts`, `demo.ts`, the OrderPanel and TerminalPlay UI, and `session.ts`.
- The `package-lock.json` churn is unchanged.
- `npm test` still runs vitest and then playwright.

## E2E specs for the seat to run elsewhere

This round changed only unit-test files, `engine.ts`, `events.ts`, `aiController.ts` and docs. The specs that cover those code paths:

- `sand-007-engage-roe.spec.ts`
- `sand-002`, `sand-003`, `sand-004`, `sand-005`, `sand-006`
- `simulation.spec.ts`
- `smoke.spec.ts`
- `design-system.spec.ts`

`zz-playcheck.spec.ts` was dropped.

---

## Round 2 (Dot re-review of 8cae8ad3: REJECT, 1 S2)

**Verdict: FIX READY.** `npm run test:unit` is 9 files / 67 tests, all pass (66 plus one new). `npm run build` passes. No e2e or browser was run.

### S2: terminal no-double-fire missed `TriggerEvent`

- **Cause.** The recursive `TriggerEvent` branch in `evaluateEvents` did not honour `opts.skip`, which the main loop does. A post-combat terminal event could therefore force an event that had already run before combat.
- **Red (8cae8ad).** New test "a post-combat event cannot force a terminal event that already ran before combat" in `terminal.test.ts`. A repeatable "Gate Score" event (score +10, message, EndScenario) runs before combat. The carrier is then destroyed, and "Loss Forces Score" forces "Gate Score" in the terminal pass. The test failed with `expected 20 to be 10` (score), and the same event also posted its message twice.
- **Green.** The `TriggerEvent` branch now breaks when `opts.skip` holds the target. The test passes: score 10, 1 message, result `defeat`.

### S3: platform ids 9001-9004

Not touched. The brief says to keep M61A2/412 and Nimitz RAM as they are, and the demo, `lookup.ts` and `demoFacts.test.ts` all reference those ids. Removing or renumbering them is not trivially safe, so it stays for the platform-db card.

### E2E specs

No change since round 1. This round touched only `events.ts` and `terminal.test.ts`, so the spec list above stands.
