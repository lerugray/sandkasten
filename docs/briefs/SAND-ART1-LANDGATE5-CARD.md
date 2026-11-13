**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-LANDGATE5 — RE-PLAN: /play never reaches the victory debrief on the ART1 branch

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts.
RE-PLAN (posture 1(e); LANDGATE4 card forbade a fifth round without one): LANDGATE4 fixed the blank Plot/Play theater (verified). One defect is left, and it is not a render defect: the Play mission never ends.

grounded: home-PC RTX 3050 real-GPU low-load rerun t694 (load5 3.6 at start) on LANDGATE4 tip `3b3eb48`: map@1440 + map@1920 PASS (the t691 map@1920 red was host load); plot specs PASS (t691); vitest 355/355. **play-shots FAIL at 1440 AND 1920 at the same line**: `tests/sand-play-1-shots.spec.ts:98` `runUntilResult(page, 40_000)` → `getByTestId('result-overlay')` not found. Briefing and focused-objective frames paint. Custody `/home/ray/lanes/_co3/sandlandgate4-t591-harvest/` (RERUN-RESULT.txt, rerun-e2e.log). main `fc33750` was e2e 123/0 fail at its last landing.

MOVES: YES — makes Play reach its victory and defeat debriefs on the ART1 branch so ART1's kept art can land, then ART2 @d9762b5 and SAND-FONT1 toward first public EA.

## Defect (fix only this)
**S2 Play never ends:** after step 3 of play-shots places the living carrier `us-cvn-1` at `GATE.centre` (56.45, 26.65) and unpauses, no result overlay appears within 40 s wall time, at either size. Suspects, all on this branch and NOT on main fc33750 (`git diff fc33750 3b3eb48`):
1. SAND-THREAT-1 in `src/lib/scenarios/demoConfig.ts` / `demo.ts`: six picket boats (was two), new picket line at 57.0-57.2 E, prosecutionRange 130 → 25 km. Does the gate/victory production check now see a hostile in or near the gate, or does the scenario's win rule changed with it?
2. `src/lib/simulation/session.ts`: the real-dt clip (MAX_REAL_DT_MS 2000) was removed for sealed turns. Check continuous play still advances the clock and the production tick fires.
3. The test itself: `runUntilResult` only clicks PLAY when the label matches /PLAY/; confirm the clock actually runs after the position write (read the game clock via the E2E handle before and after).
Find the real cause with evidence (game clock, production tick count, objective state read through `__sandSession`), fix the game if the game is wrong; change the test only if the test asks for something the SPEC does not promise, and say so.

## Already green (do not regress)
- vitest 355/355; map@1440 + map@1920; plot specs; LANDGATE4 blank-theater fix; SAND-THREAT-1 hormuzThreat unit tests (pickets must still hold the line).

## Fence
- No fonts, no art, no /map or plot render churn. Scenario/session edits only as far as the root cause needs. No merge to main. Dirty tree for the harvester. No sixth gate round without another written re-plan.

## Battery and done
- Lane runs vitest + `npx playwright test --workers=1 tests/sand-play-1-shots.spec.ts tests/sand-play-1-result.spec.ts` where it can (software GL is fine for this logic defect; raise nothing about render speed).
- Harvester re-runs on home-PC GPU: vitest + map, plot and play specs.
- Write `docs/lane-reports/SAND-ART1-LANDGATE5-REPORT.md` naming the root cause with the evidence.
- Cap 7200s. Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.

## Dispatch gate
Unblocks SAND-ART1 land after Ray's KEEP so ART2 and SAND-FONT1 can follow toward first public EA.
