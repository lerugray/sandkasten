SAND-RC-FIX1 END-REVIEW VERDICT: REJECT S1=0 S2=1 S3=3

Reviewer: co3 t431 (Opus, independent). Candidate `claude/sand-rc-fix1-lane-8mxspe` @080af31e vs main @e3697c0d. Headless Chromium, `--mute-audio`, SwiftShader.

## Battery
- Unit (vitest): 317/317, 26 files.
- `tsc --noEmit`: 3 errors, all in `tests/sand-001-unit-placement.spec.ts`. Main has the same 3 and the candidate does not touch that file. `src/` is clean.
- `tests/sand-rc-fix1.spec.ts --workers=2`: 13/13.

## Card requirements
- D1 LOAD error page: wrong-shape files (battle save, array, null) now get a message: MET (`parseScenario.ts:23-44`, spec "a file that is not a scenario…"). Hidden in-DOM input (`editor/page.tsx:205`), deferred revoke (`:118`): MET. But see S2-1.
- D2 THROTTLE/ROE fixed: MET (`OrderPanel.tsx:242`, list last, max 6.5rem; spec "(b)…"). ORDERS in view on select: MET (`TerminalPlay.tsx:817-835`; spec "(c)…"). No black/clipped band: MET (`snapPanelBody` removed; spec "no black or clipped region…").
- S3: re-click shows orders: MET. Space/Enter: MET (`TerminalPlay.tsx:315,375`; spec "Space runs the clock…"). MEDIA: not reproduced, test added. That is acceptable under the card.
- Required e2e (a), (b), (c): present and passing.

## Fence
The `src` diff touches only the editor page, `terminal.css`, `OrderPanel`, `TerminalPlay` and the new validator. No change to sim rules, combat, sensors, victory, scenario data, save format or the WEGO loop. Palette and fonts are unchanged. The only visual change is the "-- MORE --" cue, now a fixed 24 px row. No S1.

## Hands-on (real controls)
- Editor SAVE -> fresh editor -> LOAD -> SAVE: the file comes back byte-identical, with no page errors.
- Nimitz + 4 waypoints at 1280x720 and 1920x1080: the THROTTLE/ROE boxes do not move. Clicks at the pre-waypoint FLANK and FREE positions set FLANK and FREE.
- COMBAT -> FORCES: no inline max-height and no black band; ROE stays in view.
- Wheel-scrolling away while the clock runs does not snap back. Re-clicking the selected unit brings its orders back into view.
- The shipped Hormuz scenario and the example snapshot both pass the validator unchanged.

## Findings
**S2-1. A scenario file with one out-of-range latitude still crashes LOAD to the browser error page.**
Repro: a valid editor scenario with one unit at `position: {lat: 95, lng: 56.4}`, then EDITOR -> LOAD that file. Result: "Invalid LngLat latitude value", then Next's "This page couldn't load".
- This is the defect-1 symptom.
- `isPos` (`parseScenario.ts:9`) only checks that the numbers are finite, not that they are in range.
- Hand-edited community scenarios are a stated goal, and a typo is enough to trigger it.

**S3-1. Unit fields are not type-checked.** A unit whose `name` is an object also reaches the error page (React child error). Only `id` and `position` are validated. This needs a hostile file.

**S3-2. No size cap.** A 9 MB, 200,000-unit file is accepted, and the editor would try to render all of it. The validator does not bound sizes. Prototype keys are safe: no pollution, and `__proto__` is kept only as an own key.

**S3-3. Report wording.** The lane report names branch `s422co3/sand-rc-fix1-brief`. The candidate is actually `claude/sand-rc-fix1-lane-8mxspe`.

## Fix to accept
- Range-check lat in [-90, 90], lng in [-180, 180] and a sane zoom.
- Type-check unit `name`, `side` and `platformId`, and side `color`.
- Cap the file size and unit count.
- Add these cases to the unit tests.

Note: this report is pushed to the session branch `claude/sand-rc-fix1-review-t431-yjl6ge`, as the session instructions require, not to `gs/sand-rc-fix1-review-t431`.
