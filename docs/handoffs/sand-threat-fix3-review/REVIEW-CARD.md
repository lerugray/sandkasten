ANCHOR: SPEC.md line 1 (Ray): "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO."
MOVES: Sandkasten first public EA build (ship board row 14): lands SAND-THREAT-1 (SPEC step 6, the player can win or lose; a passive player in Hormuz is defeated). An ACCEPT here admits the land battery; it lands nothing by itself.
grounded: newest = sandkasten `claude/sand-threat-fix3-t486-lane-na6tvi` @ `47a1a74` (Fable cloud session, final commit 2026-11-11T02:20Z, remote-verified); base `co3/sand-threat-1-fix2` @ `70b3aa1` (already reviewed ACCEPT; do not re-review it); card `docs/handoffs/sand-threat-fix3-t486/CARD.md`; author report `docs/lane-reports/SAND-THREAT-FIX3-REPORT.md`; receipts `docs/verification/sand-threat-fix3-t486/`.

# SAND-THREAT-1 FIX3: the ONE independent end review (non-author, non-Claude)

You are an independent reviewer, not the author (the author was a Claude Fable session). STATIC, READ-ONLY review at exact HEAD: do not edit product files, format, commit, push, start the dev server, a browser, Playwright or the e2e battery (`npx vitest run` is allowed). Your ONLY permitted write is `docs/lane-reports/SAND-THREAT-FIX3-REVIEW.md`.

Read the card and the report, then the complete diff `git diff 70b3aa1 HEAD` (skip image files).

Background: on two hosts the spec `tests/sand-threat-1-passive.spec.ts` did not see the DEFEAT debrief at 60x, and two OSINT label-overlap specs were red on base and candidate alike. The author's diagnosis: (item 1) the game does defeat a passive player; the proof waited on wall-clock time and now waits on the game clock, no game code changed; (item 2) a real overlap on /map while a view loads, fixed in layout.

Verdict-gate every concern against the full source and try to refute it before reporting. Check specifically:
1. ITEM 1 IS HONEST. The rewritten proof still fails if a do-nothing player is NOT defeated (it must assert the DEFEAT debrief within a bounded amount of GAME time, not merely wait longer or forever; no assertion deleted, loosened or skipped; no test-only hook that forces the defeat). Confirm no file under the simulation or AI changed for item 1, or name what did.
2. The "at least two different sensible plans win" proofs and the unit tests from SAND-THREAT-1 are untouched or stronger.
3. ITEM 2 fixes the overlap for a player, in production layout code, not by stubbing, hiding labels, lengthening a settle wait or relaxing the zero-overlap assertion. The report mentions a "tile-host stub for the map specs": decide whether that stub only removes a network dependency from the test or also hides the defect the spec exists to catch.
4. FENCES of the card: no rule or balance number changed without a source, no save-format change, no scripted trigger added to force a loss, nothing outside the card's file list.
5. The report says the full e2e run in the author's container did not finish clean. List exactly which specs the report leaves unproven, so the land battery can target them.

Write at most 400 words to `docs/lane-reports/SAND-THREAT-FIX3-REVIEW.md`. Line 1 exactly `ACCEPT S1=0 S2=0 S3=<n>` only if no player- or rule-visible S1/S2 remains and items 1 to 4 hold; otherwise `REJECT S1=<n> S2=<n> S3=<n>`. S1/S2 need a concrete repro; fence, evidence and tidiness findings are S3. Each finding: file:line and a concrete failure scenario. End with the item-5 list.
