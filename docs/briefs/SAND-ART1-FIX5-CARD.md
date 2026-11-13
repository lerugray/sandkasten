**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-FIX5 — prove wrap debrief LAUNCH lines on FIX4 tip ce9ff5d (GS co-seat 3, night-s409 t533)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

grounded: sandkasten tip `co3/sand-art1-fix4` @`ce9ff5dd2d64a162d4c541f8545df4691a4a74d7` (WIP FIX4: WeGo/Oghab/OSINT PASS; wrap CSS kept; debrief half of `sand-art1-wrap` still fails). FIX4 report: `docs/lane-reports/SAND-ART1-FIX4-REPORT.md`. Ray s432 KEEP ART1 / REVISE font: land ART1 only on green unit+e2e; wrap FAIL alone blocks land. MOVES: YES — clears the last FIX4 blocker so ART1+FIX3+FIX4 can re-landbat.

## Defect (fix only this)
1. **S2 wrap — debrief never gets in-horizon C-802 LAUNCH (`tests/sand-art1-wrap.spec.ts` debrief cases @1920 and @1280).** After THREAT-1 the wrap test teleports Nimitz to `GATE.centre` (~17 nm from nearest FAC). Surface radar horizon at default mast leaves that shot below the horizon, so `launches.length === 0` and the mid-word assertions never run. Presentation CSS/nowrap for `.tx-result-line` is already in tree from FIX4 — keep it. Required: both debrief viewport cases PASS with `launches.length > 0` and every drawn line's `midWord` empty; every `LAUNCH` line joins to match `/C-802 NOOR AT USS NIMITZ \(CVN-68\)$/`. Prefer a **test-only** path fix (adjust teleport / wait / identification setup inside `tests/sand-art1-wrap.spec.ts` only) that yields an in-horizon identified FAC shot without weakening the wrap assertions. Do not weaken the test. Do not change production scenario seeds, detection defaults, or combat math unless a one-line production change is the only fence-safe way AND you prove THREAT-1 + battle-save still pass in the same battery.

## Already green on this tip (do not regress)
- WeGo combat record plan A (`tests/sand-combat-1-record.spec.ts`)
- Oghab 44 panel (`tests/sand-map-2-plot-facilities.spec.ts`)
- OSINT overlap @1920 (`tests/sand-osint-1-overlap-plot.spec.ts`)
- Wrap weapon-row half of `sand-art1-wrap`
- `npx vitest run` 352/352

## Fence
- No font swap (SAND-FONT1 later).
- No new features; no save-format change; no merge to main.
- Prefer test-only edits. If you must touch production, touch the smallest surface that puts an identified in-horizon FAC under the existing gate-teleport debrief, and re-run THREAT + battle-save proofs; revert any change that flips THREAT defeat→victory.
- Do not commit host-only Playwright GPU overlay (`pw-wsl-gpu.config.ts`). Leave dirty tree for the harvester.

## Battery and done
- `npx vitest run` green.
- Targeted e2e green (`--workers=1`): `tests/sand-art1-wrap.spec.ts` `tests/sand-combat-1-record.spec.ts` `tests/sand-map-2-plot-facilities.spec.ts` `tests/sand-osint-1-overlap-plot.spec.ts`.
- Write `docs/lane-reports/SAND-ART1-FIX5-REPORT.md`: cause, files, proof, pass/fail. Cap 7200 s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.
