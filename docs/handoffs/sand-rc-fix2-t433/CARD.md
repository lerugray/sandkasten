**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
grounded (co-seat 3 t433, 2026-11-10 03:1x EST): sandkasten main @e3697c0d; candidate claude/sand-rc-fix1-lane-8mxspe @080af31e; its Opus end review (branch claude/sand-rc-fix1-review-t431-yjl6ge @891d0a55, docs/lane-reports/SAND-RC-FIX1-END-REVIEW.md) = REJECT S1=0 S2=1 S3=3.
MOVES: Sandkasten's first public EA build. FIX1 removed the editor LOAD error page for wrong-shape files, but one out-of-range latitude still crashes LOAD to the browser error page (S2-1). When this lands, every malformed scenario file is refused with a message, FIX1 can land, and there is a new RC sha for the confirming cold play.
SPEC STEP: SPEC.md player step 1 (build or open a scenario in the editor).
SHAPE: small fix (one source file plus its test), BUILD lane, Sonnet 5.5 author, cap 1,800 s. The seat does the diff review and the land battery; no critic lane.

# CO3-SANDFIX2-T433: harden the editor's scenario validator (SAND-RC-FIX2)

## Setup
`git fetch origin claude/sand-rc-fix1-lane-8mxspe && git checkout -B sand-rc-fix2 origin/claude/sand-rc-fix1-lane-8mxspe && npm ci`. Build ON TOP of FIX1 (head 080af31e); push your commits to your session branch.

## Fix, in src/lib/scenarios/parseScenario.ts only (plus tests)
1. **S2-1 (required):** range-check positions. Latitude in [-90, 90], longitude in [-180, 180], for `theater.center` and every unit `position` (and any waypoint/reference-point position the editor renders, if the file carries them). `theater.zoom` finite and within the map library's accepted range (0..24). Out of range = refuse with a plain message ("a unit's position is off the map"), editor state untouched.
2. **S3-1:** type-check unit `name`, `side` and `platformId` when present (strings) and side `color` (string). A wrong type = refuse with a message. Do not make optional fields required: every scenario the game itself saves, the shipped Hormuz scenario and the example snapshot must still load unchanged.
3. **S3-2:** cap the file at 5 MB of text and 5,000 units total; over = refuse with a message.
4. **S3-3:** correct the branch name in docs/lane-reports/SAND-RC-FIX1-REPORT.md (it names `s422co3/sand-rc-fix1-brief`; the build branch is `claude/sand-rc-fix1-lane-8mxspe`).

## Tests
Unit tests for each refusal (lat 95, lng 200, zoom 99, unit name as object, side color as number, 5,001 units, >5 MB text) and for acceptance of the shipped Hormuz scenario and a SAVE output. Add one e2e case to tests/sand-rc-fix1.spec.ts: LOAD a scenario with a unit at lat 95 shows the message and no error page. Run `npm test`, `npx tsc --noEmit` (the 3 pre-existing errors in tests/sand-001-unit-placement.spec.ts are known; add none), and `npx playwright test tests/sand-rc-fix1.spec.ts --workers=2` with every browser launched `--mute-audio`.

## Fence
Only parseScenario.ts, its unit test, tests/sand-rc-fix1.spec.ts and the FIX1 report line. No change to sim rules, combat, sensors, victory, scenario data, save format, WEGO loop, layout or look. Nothing audible.

## Output
docs/lane-reports/SAND-RC-FIX2-REPORT.md, first line `SAND-RC-FIX2: DONE|PARTIAL unit N/N tsc E e2e N/N`, then files changed and each fix with file:line. Under 300 words.
