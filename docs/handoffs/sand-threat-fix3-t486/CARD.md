This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it

**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-THREAT-1 FIX3 — the passive-defeat proof must pass on any host; clear the two OSINT overlap reds (GS co-seat 3, t486, 2026-11-10)

grounded: sandkasten branch co3/sand-threat-1-fix2 @70b3aa12b2f1f64443192caf75ddb3a8ec3a15cf (newest commit "Record independent ACCEPT for SAND-THREAT-1 FIX2"; main is fc337505). Start from this commit (you are on a brief branch cut from it). Cap: 7,200 s of work; stop and report what is left at the cap. Model: Fable 5.2, effort high.

MOVES: Sandkasten's first public EA build. SAND-THREAT-1 (the Hormuz defeat reachable by a passive player; main's order s422 23:28, "a spec defect", SPEC step 6: the player "wins or loses on the scenario's victory conditions") is reviewed ACCEPT but cannot land: its own headline proof failed on the land-attribution host. When this lands: the full e2e suite is green at the candidate, SAND-THREAT-1 lands on main, and the release-candidate cold play can be re-run.

## What is red (attribution run, Windows host "thinker", Playwright, 2026-11-10 19:20 EST, 3 failed / 32 passed of the focused set, 21.6 min)
1. `tests/sand-threat-1-passive.spec.ts:14` (new in this candidate): no orders, 60x, play. The DEFEAT debrief (`result-title`) was not visible when the test's wait ended. This is the headline behaviour of the whole card.
2. Two OSINT overlap tests (`tests/sand-osint-1-overlap-plot.spec.ts` / `sand-osint-1-overlap-map.spec.ts`, the 1440 and 1920 viewport cases). These are ALSO red on main fc337505 on the same host (base run: 2 failed / 32 passed), so they are older than this candidate.

## What to do
- FIRST find out which it is for item 1, and write the diagnosis in the report before changing anything: (a) the game really can fail to defeat a passive player (dice, or sim time advancing differently when the browser is slow, so the outcome depends on the wall clock), or (b) the game does reach DEFEAT but the test's wall-clock wait (`runUntilResult(page, 480_000)`, 60x) is too short on a slow host. Reproduce under a throttled CPU (Playwright CDP `Emulation.setCPUThrottlingRate` 4x and 6x) and over at least 20 different dice seeds headless.
- If (a): that is a player-visible defect (the outcome of a do-nothing run must not depend on machine speed or on lucky dice more than the card's 20-seed proof allows). Fix it at the source inside the existing rules: sim stepping must be deterministic in sim time whatever the frame rate. Tune only existing scenario knobs, exactly as the SAND-THREAT-1 card (docs/handoffs/sand-threat-1-t438/CARD.md) allows; never a scripted trigger, no new weapons, unit types or AI behaviour code.
- If (b): make the proof wait on SIM time (poll the session's sim clock or result through the existing e2e handle), not wall time, with a generous overall timeout, so a slow host passes and a real miss still fails. Do not weaken what it asserts (DEFEAT title, Nimitz destroyed, mission failed, zero US orders, hits by Iranian units).
- Item 2: find why the overlap tests fail at 1440 and 1920 (a real overlap of OSINT labels or panels at those sizes that a player would see, or a brittle measurement). A real overlap is fixed in the layout; a brittle test is fixed in the test, and say which in the report. Stay out of the files the art pass owns: branch sand/art-fable-r1 (SAND-ART1) is redrawing the /play screen's presentation right now; touch /play styling only where the overlap fix needs it and list those lines in the report.
- If you find the two wins from the original proofs (two different sensible plans win) no longer hold after your change, fix that too: both directions must stay proven.

## Fences
No rule the SPEC does not carry, no balance change beyond existing knobs, no save-format change, no new dependency. The repo is PUBLIC: no keys, no private paths, no client names in commits. Do not merge to main, do not deploy.

## Battery (run it before you report; at most 2 Playwright workers)
`npm test && npm run test:e2e -- --workers=2` : unit all green; e2e 0 failed. Then run `tests/sand-threat-1-passive.spec.ts` three more times, once with CPU throttling 4x, and record each result.

## Report
Commit and push your work on your session branch (checkpoint commits at each coherent state). Write `docs/lane-reports/SAND-THREAT-FIX3-REPORT.md`: the diagnosis for item 1 with the numbers (seeds, sim hours to defeat, throttled runs), what you changed and why, the overlap finding, the battery counts before and after, and anything left. One independent end review and the seat's land battery follow; you do not land.
