# SAND-ART1-FIX5 — wrap debrief LAUNCH path (co-seat 3 t533)

Tip base: `ce9ff5d` (FIX4) + brief `e3f7345`. Work branch `co3/sand-art1-fix5`.

## Cause
`tests/sand-art1-wrap.spec.ts` debrief cases teleported Nimitz to `GATE.centre` (~17 nm from `ir-fac-1`). Surface radar horizon at default 20 ft masts is ~11 nm, so no in-horizon FAC shot and `launches.length === 0`. Presentation wrap CSS from FIX4 was already correct.

## Fix (test-only)
Teleport to `{ lng: 56.38, lat: 26.78 }` (~8 nm from ir-fac-1 toward the gate, inside horizon). No production scenario/sensor/combat-math edits.

## Proof owed (QUEUED t533 — home-PC load5 OVER; co2 held 13 Chromium)
- `npx vitest run`
- targeted e2e `--workers=1`: wrap + combat-1-record + map-2-plot-facilities + osint-1-overlap
- Then ART1 re-landbat (e2e timeout ≥10800)

## Status
FIX SUBMITTED (code). Battery not run this turn — host refused.
