SAND-RC-FIX1 END-REVIEW VERDICT: REJECT S1=0 S2=1 S3=3

Reviewer co3 t431 (independent). Candidate `claude/sand-rc-fix1-lane-8mxspe` @080af31e vs main @e3697c0d. Headless Chromium, `--mute-audio`, SwiftShader.

## Battery
- Unit: 317/317.
- `tsc --noEmit`: 3 errors, all in `tests/sand-001-unit-placement.spec.ts`. Main has the same 3 and the file is untouched; `src/` is clean.
- `sand-rc-fix1.spec.ts --workers=2`: 13/13.

## Card
- D1, wrong-shape files get a message (`parseScenario.ts:23-44`): MET. Hidden input (`editor/page.tsx:205`) and deferred revoke (`:118`): MET. See S2-1.
- D2, THROTTLE/ROE fixed (`OrderPanel.tsx:242`): MET. ORDERS in view on select (`TerminalPlay.tsx:817-835`): MET. No clipped band: MET.
- S3 items: re-click MET. Space/Enter (`TerminalPlay.tsx:315,375`) MET. MEDIA not reproduced, test added: acceptable.
- e2e (a), (b), (c) present and passing.

## Fence
Only the editor page, `terminal.css`, `OrderPanel`, `TerminalPlay` and the new validator changed. No sim, combat, sensor, victory, data, save-format or WEGO change. Look is unchanged; the "-- MORE --" cue is now a fixed 24 px row.

## Hands-on
- Editor SAVE -> LOAD -> SAVE: byte-identical.
- Nimitz + 4 waypoints at 1280x720 and 1920x1080: THROTTLE/ROE boxes unchanged. Clicks at the old FLANK and FREE spots set FLANK and FREE.
- COMBAT -> FORCES: no black band.
- Re-click brings orders back. No snap-back while the clock runs.
- Hormuz and the example snapshot pass the validator unchanged.

## Findings
**S2-1. One out-of-range latitude still crashes LOAD to the browser error page.**
- Repro: a valid scenario with one unit at `{lat: 95, lng: 56.4}`, then EDITOR -> LOAD. Result: "Invalid LngLat latitude value", then "This page couldn't load", which is the defect-1 symptom.
- Cause: `isPos` (`parseScenario.ts:9`) checks only that the numbers are finite.

**S3-1. Unit fields are not type-checked.** A unit whose `name` is an object also reaches the error page. Only `id` and `position` are validated.

**S3-2. No size cap.** A 9 MB file with 200,000 units is accepted. Prototype keys are safe: nothing is polluted.

**S3-3. The lane report names the wrong branch** (`s422co3/sand-rc-fix1-brief`).

## To accept
- Range-check lat, lng and zoom.
- Type-check unit `name`, `side` and `platformId`, and side `color`.
- Cap the file size and unit count.
- Add unit tests for these cases.

Pushed to session branch `claude/sand-rc-fix1-review-t431-yjl6ge` (session rule), not `gs/sand-rc-fix1-review-t431`.
