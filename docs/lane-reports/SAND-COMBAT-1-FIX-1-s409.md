DONE — fog leak fixed; simulation Combat locator fixed; facility symbols FLAKE (3/3 alone green); unit 260/260; tsc = 3 pre-existing errors in `tests/sand-001-unit-placement.spec.ts` only; three targeted specs green; `sand-combat-1-record.spec.ts` 4/4 green (D3D11 ANGLE on Windows).

Base: `s409/sand-combat-1` @ `92481b64`. Working tree only (no commit/push per lane operator).

## Red 1 — turn-review leaks `Boghammar 502`
**Cause.** `buildFog` treated `contact.platformName` as a safe classified label. The sensor stub sets `platformName = target.name` on first classify (`engine.ts`), so a classified Boghammar replaced its own hull name with itself. Review/record/teletype all read that projection; stripping `SC1_TO` did not create the leak — it only let plan A run long enough to hit a classified hostile launch.
**Fix.** Added `contactDisplayName` in `combatRecord.ts`: use `platformName` only when it differs from the true hull name; otherwise TN + classification (or UNKNOWN TRACK). Wired through `buildFog`, TerminalPlay contact tags, ContactList preference order, and staged-fire labels in `session.ts`.
**Files.** `src/lib/simulation/combatRecord.ts`, `src/lib/simulation/__tests__/combatRecord.test.ts`, `src/components/terminal/TerminalPlay.tsx`, `src/components/game/ContactList.tsx`, `src/lib/simulation/session.ts`.

## Red 2 — `simulation.spec.ts` Combat button strict-mode collision
**Cause.** SAND-COMBAT-1 mounts a category button labelled `COMBAT` inside the combat record. After autopause switches to the Combat tab, `locator('button').filter({ hasText: 'Combat' })` matches two controls.
**Fix.** Click `getByTestId('sidebar-tab-combat')`; assert via `combat-log-entry` (timeout raised to 90s so the 15s sim fit).
**Files.** `tests/simulation.spec.ts`.

## Red 3 — facility symbols `>100` (received 51)
**Cause.** FLAKE under the land battery. Alone on this host at `92481b64` + fix: pass / pass / pass (`fac-run1..3`, then `fac-verify`).
**Fix.** None in game code; recorded FLAKE.
**Files.** none (game).

## Host notes (verify only)
- `unit/facilities-pipeline.test.ts`: normalize `\r\n` before byte compare so Windows checkout vs LF generator passes.
- `playwright.config.ts`: on `win32`, launch Chromium with ANGLE D3D11 so DPR-2 SC1 specs clear the `frames() > 30` gate (Intel UHD 620).

## Tests
| check | result |
|---|---|
| `npx vitest run` | 22 files, **260/260** |
| `npx tsc --noEmit` | 3 errors, all pre-existing in `tests/sand-001-unit-placement.spec.ts` |
| `sand-map-2-plot-facilities` symbols alone ×3 | **pass, pass, pass** (FLAKE) |
| `simulation.spec` combat log | **pass** |
| `sand-combat-1-record.spec.ts` whole `--workers=1` | **4/4 pass** (~10.8m, D3D11) |
| New unit cases | unidentified hostile → TN label; `platformName ===` hull name → TN CLS, not hull |
