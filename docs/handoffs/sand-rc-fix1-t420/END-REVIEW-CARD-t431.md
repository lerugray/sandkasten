**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
grounded (co-seat 3 t431, 2026-11-10 02:3x EST): sandkasten main @e3697c0d; candidate = claude/sand-rc-fix1-lane-8mxspe head 080af31e (8 commits; report docs/lane-reports/SAND-RC-FIX1-REPORT.md: unit 317/317, new spec 13/13, 56 existing e2e pass on software GL).
MOVES: Sandkasten's first public EA build. The RC cold play found two S2 player-visible defects (editor LOAD error page; ORDERS panel shifts so clicks give the wrong order). When this lands the editor opens scenarios without an error page, THROTTLE/ROE stay put, and there is a new RC sha for the confirming cold play.
SPEC STEP: SPEC.md player step 1 (build or open a scenario in the editor) and the orders steps; the build card is docs/handoffs/sand-rc-fix1-t420/CARD.md on the candidate branch.

# CO3-SANDFIX1REV-T431: ONE independent Opus end review of SAND-RC-FIX1 (read-only except your report branch)
You are the end reviewer. You did not build this. Default to REJECT when a card requirement is not met in the code or the receipts. Nothing audible: every browser gets --mute-audio.

## Setup
`git fetch origin claude/sand-rc-fix1-lane-8mxspe main && git checkout --detach origin/claude/sand-rc-fix1-lane-8mxspe && npm ci`. Read the build card docs/handoffs/sand-rc-fix1-t420/CARD.md and the lane report docs/lane-reports/SAND-RC-FIX1-REPORT.md.

## Judge, in order
1. Every card requirement and acceptance line (defects 1, 2, the S3 items in 3, the three required e2e tests): MET / NOT MET with file:line or test name.
2. Fence, by reading `git diff e3697c0d origin/claude/sand-rc-fix1-lane-8mxspe -- src`: no change to sim rules, combat, sensors, victory, scenario data/balance, save format or the WEGO loop; look (palette, fonts) unchanged. A rule change is S1.
3. The new scenario validator (`src/lib/scenarios/parseScenario.ts`): does it refuse wrong-shape and hostile files (prototype keys, absurd sizes) without crashing, accept every scenario the game itself saves (the shipped Hormuz scenario included), and leave the editor untouched on refusal?
4. Layout: THROTTLE/ROE bounding boxes fixed when waypoints are added; selecting a unit (and re-clicking the selected one) brings ORDERS into view; no black/clipped sidebar region after COMBAT -> FORCES at 1280x720 and 1920x1080; Space does not re-press a focused sidebar button; Enter still activates buttons.
5. Run `npm test` (unit), `npx tsc --noEmit` (or the repo's typecheck/build), and `npx playwright test tests/sand-rc-fix1.spec.ts --workers=2` if Playwright runs here; report counts. Do NOT judge the full e2e suite (GS runs it).
6. One hands-on check through the real controls in a browser if it runs: editor SAVE then LOAD round trip; select Nimitz, add 4 waypoints, confirm FLANK and ROE buttons are where they were.

S1/S2 = a player-visible behaviour defect with a repro; fence, evidence and wording findings are S3.

## Output
Write docs/lane-reports/SAND-RC-FIX1-END-REVIEW.md, line 1 `SAND-RC-FIX1 END-REVIEW VERDICT: ACCEPT|REJECT S1=n S2=n S3=n`, then findings (under 400 words). Commit it on a new branch gs/sand-rc-fix1-review-t431 and push that branch only. Never push main or the candidate branch. Cap 3,000 s.
