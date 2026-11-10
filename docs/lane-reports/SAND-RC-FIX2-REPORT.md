SAND-RC-FIX2: PARTIAL unit 331/331 tsc 3 e2e 14/14 (rc-fix1 spec only; full `npm test` e2e NOT completed)

Lane: co3 t433 (backup account), branch `claude/sand-rc-fix2-t433-lane-3p4p3p`, built on FIX1 head 080af31e.

## Files changed
- src/lib/scenarios/parseScenario.ts
- src/lib/scenarios/__tests__/parseScenario.test.ts
- tests/sand-rc-fix1.spec.ts
- docs/lane-reports/SAND-RC-FIX1-REPORT.md (branch name, line 3)

## Fixes
- **S2-1** parseScenario.ts:45-52, 68, 79-84: theater centre, theater.bounds, every unit position and every reference-point position must be lat -90..90, lng -180..180; zoom 0..24. Refused with "a unit's position is off the map" and similar. The editor state is never touched.
- **S3-1** parseScenario.ts:59-75: unit `name`/`side` and side `color` must be text when present. **Deviation:** `platformId` must be a finite number, not a string, because `Unit.platformId` is `number` and every shipped and saved scenario writes a number. A string would have broken the Hormuz scenario. Optional fields stay optional.
- **S3-2** parseScenario.ts:13-14, 25-27, 62-63: over 5 MB of text (checked before JSON.parse) or over 5,000 units is refused.
- **S3-3** FIX1 report line 3 now names `claude/sand-rc-fix1-lane-8mxspe`.

## Tests
- Unit: 331/331 (13 new in parseScenario.test.ts: lat 95, lng 200, zoom 99 and -1, centre, reference point, name as object, side as number, platformId text, colour as number, 5,001 units, over-5 MB text, edge values, Hormuz and example snapshot via SAVE round-trip).
- tsc: only the 3 known errors in tests/sand-001-unit-placement.spec.ts.
- e2e tests/sand-rc-fix1.spec.ts: 14/14 (new case: lat-95 LOAD shows the message, no error page).
- Environment note: the container's Playwright has no matching bundled browser, so runs used `SAND_E2E_CHROMIUM=/opt/pw-browsers/chromium SAND_E2E_SWIFTSHADER=1`; config already launches `--mute-audio`.

## Not done (seat to run)
- Full e2e suite (125 tests) did not finish inside the cap: on software GL it reached 13/125 (all passing) in about 10 minutes, then I stopped it. A follow-up run of tests/sand-001-unit-placement.spec.ts and tests/smoke.spec.ts hung with no output (probably a stale dev server on :3001) and was killed. The change touches only parseScenario.ts, which only the editor page imports, but the seat's land battery should run the whole suite on a real GPU.
