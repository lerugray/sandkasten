# SAND-ART1-FIX6 — wrap debrief identified in-horizon FAC LAUNCH

Tip base: `7dcf9bc` (FIX5) + brief `78c6140`. Work branch `co3/sand-art1-fix6-wip`. Lane NO_EXEC (no Playwright/Chromium here).

## Cause
FIX5 teleported Nimitz to `{ lng: 56.38, lat: 26.78 }` (~8 nm from `ir-fac-1`, inside surface radar horizon and inside the transit gate). Horizon alone was not enough: the wrap debrief pins `Math.random = 0.7`, and at that range the surface-radar detection roll fails (`baseProbability ≈ 0.695`), so Iran never holds a DETECTED+ contact. Weapons-free will not engage an unknown/ESM-only picture, so `ir-fac-1` never fires and `launches.length === 0` on both viewport cases. Presentation wrap from FIX4 was already correct.

## Fix (test-only)
Helper `primeWrapDebriefLaunch` in `tests/helpers/sandPlay.ts`:
- keeps the FIX5 in-horizon teleport (gate still ends the run via Transit Complete after combat’s same-tick salvo);
- seeds Iran `sideContacts` with a tracked radar contact on `us-cvn-1`;
- forces `engageAt` to now and `setRoe("ir-fac-1", "weapons-free")`.

Wrap debrief cases call the helper instead of a bare position poke. Assertions unchanged. No production scenario / sensor / combat-math edits.

## Files
- `tests/helpers/sandPlay.ts` — `primeWrapDebriefLaunch`
- `tests/sand-art1-wrap.spec.ts` — debrief setup uses the helper
- `docs/lane-reports/SAND-ART1-FIX6-REPORT.md` — this file

## Proof owed (harvester)
- `npx vitest run` green
- targeted e2e `--workers=1`: `tests/sand-art1-wrap.spec.ts` `tests/sand-combat-1-record.spec.ts` `tests/sand-map-2-plot-facilities.spec.ts` `tests/sand-osint-1-overlap-plot.spec.ts`
- Both wrap debrief VPs: `launches.length > 0`, no mid-word turns, every LAUNCH line ends `/C-802 NOOR AT USS NIMITZ \(CVN-68\)$/`

## Status
FIX SUBMITTED (code). Battery not run this turn — NO_EXEC lane; no `node_modules` on this host.
