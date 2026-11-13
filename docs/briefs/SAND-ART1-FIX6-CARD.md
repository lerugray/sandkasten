**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-FIX6 — wrap debrief gets identified in-horizon FAC LAUNCH (GS co-seat 3, night-s409 t540)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

grounded: sandkasten tip `co3/sand-art1-fix5` @`7dcf9bc205e4d01c9f4a53c69596e189090a0b51` (FIX5 test-only teleport to `{lng:56.38,lat:26.78}` ~8 nm from `ir-fac-1`). RunPod targeted e2e t534 (`gs-sandart1fix5e2e-t534` id=`5pntd9766ykgf5`, deleted at harvest): **UNIT PASS / E2E FAIL**. Hard red (×3 each VP): `tests/sand-art1-wrap.spec.ts` debrief — `launches.length === 0` ("the opening salvo is on the record") at 1920 and 1280. Flaky green on retry (keep green): combat-1 plan A, Oghab 44 panel, OSINT @1920. Custody: GS-private `/home/ray/lanes/_co3/sandart1fix5e2e-t534/`. Ray s432 KEEP ART1 / REVISE font: land ART1 only on green unit+e2e. MOVES: YES — clears the wrap debrief LAUNCH gate so ART1+FIX3+FIX4+FIX5 can re-landbat.

## Defect (fix only this)
1. **S2 wrap — debrief still never gets C-802 LAUNCH after FIX5 teleport (`tests/sand-art1-wrap.spec.ts` debrief cases @1920 and @1280).** Horizon alone is not enough: after the FIX5 position, the opening salvo still does not appear on the result record (`/ LAUNCH /` filter empty). Required: both debrief viewport cases PASS with `launches.length > 0`, every drawn line's `midWord` empty, and every `LAUNCH` line joins to match `/C-802 NOOR AT USS NIMITZ \(CVN-68\)$/`. Prefer a **test-only** path in `tests/sand-art1-wrap.spec.ts` (and helpers under `tests/helpers/` if needed) that yields an **identified, in-horizon FAC shot** — identification + ROE/weapons-free setup so `ir-fac-1` actually fires the opening C-802 at Nimitz and the debrief record shows those LAUNCH lines — without weakening the wrap assertions. Do not weaken the test. Do not change production scenario seeds, detection defaults, or combat math unless a one-line production change is the only fence-safe way AND you prove THREAT-1 + battle-save still pass in the same battery. Keep FIX5's in-horizon teleport (or replace it with a better in-horizon point) — do not revert to `GATE.centre`.

## Already green on this tip (do not regress)
- Wrap weapon-row half of `sand-art1-wrap` (both VPs)
- WeGo combat record plan A / plan B / fog/GOD / demo (flaky plan A must stay green)
- Oghab 44 panel + map-2 keyless + OSINT @1440 and @1920 (flaky map/osint must stay green)
- `npx vitest run` green on tip

## Fence
- No font swap (SAND-FONT1 later).
- No new features; no save-format change; no merge to main.
- Prefer test-only edits. If you must touch production, touch the smallest surface that puts an identified in-horizon FAC under the debrief path, and re-run THREAT + battle-save proofs; revert any change that flips THREAT defeat→victory.
- Do not commit host-only Playwright GPU overlay (`pw-wsl-gpu.config.ts`). Leave dirty tree for the harvester.

## Battery and done
- This lane is **NO_EXEC**: write the fix only; do not run Playwright/Chromium here. Plain `npx vitest run` is OK if node_modules already exist; otherwise leave unit for harvest.
- Harvester battery (RunPod or home-PC after AN landbat frees): `npx vitest run` green; targeted e2e green (`--workers=1`): `tests/sand-art1-wrap.spec.ts` `tests/sand-combat-1-record.spec.ts` `tests/sand-map-2-plot-facilities.spec.ts` `tests/sand-osint-1-overlap-plot.spec.ts`.
- Write `docs/lane-reports/SAND-ART1-FIX6-REPORT.md`: cause (why FIX5 teleport was insufficient), files, proof owed, pass/fail. Cap 7200 s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>. End with the exact harvester battery command above.
