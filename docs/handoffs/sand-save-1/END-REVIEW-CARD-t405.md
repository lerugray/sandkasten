**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
grounded (co-seat 3 t405, 2026-11-09 18:2x EST): sandkasten main @69ee411d; candidate = claude/sand-save-1-lane-mmiq6g, code at CP3 87737e8c, head 31020059 (report docs/lane-reports/SAND-SAVE-1-s409.md line 1: PARTIAL head=87737e8 unit=306/306, lane e2e 6/6; full 105-spec suite not run: software GL only, the real-GPU land battery is GS's).
MOVES: A player can save a running Hormuz battle to a local file, close the tab, reload it paused with the same orders, contacts, ammunition, damage and events, then continue to the real outcome or try another plan from that checkpoint.
SPEC STEP: SPEC.md player step 7, "Saves a game in progress and resumes it later"; the build card is docs/lane-cards/ (SAND-SAVE-1 card on branch s420co3/sand-save-1-brief).
RAY-ASK: 2026-11-09 15:29 "Yes, add saves"

# CO3-SANDSAVEREV-T405: ONE independent Opus end review of SAND-SAVE-1 (read-only except your report branch)
You are the end reviewer. You did not build this. Default to REJECT when a card requirement is not met in the code or the receipts. Nothing audible: every browser gets --mute-audio.

## Setup
`git fetch origin claude/sand-save-1-lane-mmiq6g s420co3/sand-save-1-brief && git checkout --detach origin/claude/sand-save-1-lane-mmiq6g && npm ci`. Read the build card from origin/s420co3/sand-save-1-brief (find it with `git diff --name-only 69ee411d origin/s420co3/sand-save-1-brief`), the lane report docs/lane-reports/SAND-SAVE-1-s409.md and receipts docs/verification/sand-save-1-s409/.

## Judge, in order
1. Every card requirement and acceptance line: MET / NOT MET with file:line or receipt name.
2. Save/restore correctness by reading `git diff 69ee411d 87737e8c -- src`: is every piece of battle state that changes the outcome saved and restored (units, orders, contacts on all sides, weapons in flight, cooldowns, events, AI state, WeGo state, id counters)? Name anything missing that would make a resumed battle play differently from the uninterrupted one: S1 if it changes the outcome, S2 if visible.
3. Validation and safety of loading an untrusted file (bounds, prototype keys, cross-references, refusal leaves the running battle untouched).
4. No rule, balance, scenario data or existing control changed outside the card's scope (S1 if a rule changed).
5. Run `npm test` (unit) and `npx tsc --noEmit` (or the repo's typecheck/build scripts) and the lane's two save specs if Playwright runs here; report counts. Do NOT judge the 105-spec suite (GS runs it on real GPU).
6. One hands-on check through the real controls in a browser if it runs: save mid-battle, reload the page, load, confirm paused + same clock + same selection-free view, continue.

S1/S2 = a player-visible behaviour defect with a repro; fence, evidence and wording findings are S3.

## Output
Write docs/lane-reports/SAND-SAVE-1-END-REVIEW.md, line 1 `SAND-SAVE-1 END-REVIEW VERDICT: ACCEPT|REJECT S1=n S2=n S3=n`, then findings (under 400 words). Commit it on a new branch gs/sand-save-1-review-t405 and push that branch only. Never push main or the candidate branch. Cap 3,000 s.
