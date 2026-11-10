**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-RC-FIX1 — fix round from the RC cold play on sandkasten main e3697c0d (GS co-seat 3, night t420, 2026-11-09)

grounded: sandkasten main e3697c0d (all SPEC steps 1-7 landed); cold play co3-sandcold-t415 DONE 23:05 (Opus first-time player, 37 min,
VICTORY x3, save -> reload -> load PASS). Report: GS private /home/ray/lanes/co3-sandcold-t415/evidence/PLAY-REPORT.md (copied below).

MOVES: Sandkasten's first public EA build. The RC cold play found two S2 player-visible defects; the public-release gate cannot pass
and no go packet can be staged until they are fixed and a re-play confirms. When this lands: a new RC sha for the confirming cold play.

## Defects to fix (repro from the cold play)
1. **S2 — editor LOAD shows a browser error page.** Repro: title -> MAIN MENU -> EDITOR (blank New Scenario) -> click LOAD. The player got
   a white "This page couldn't load / Reload / Back" page (Back recovered). SPEC step 1 says a player can build or open a scenario in the
   editor. `src/app/editor/page.tsx` loadScenario only creates a detached file input, so first REPRODUCE it in Playwright on a production
   build (`next build` + the served output, the way the release ships), both with a file chooser handler and without. Fix the real cause
   (route, static export, navigation, a button inside a form, whatever it is). If it does not reproduce, write that down with the exact
   steps tried and still add the e2e test below. Also: `saveScenario` revokes the object URL in the same tick as `a.click()`; defer the
   revoke (setTimeout) so the download is not cancelled in some browsers.
2. **S2 — ORDERS panel layout shifts and hides, so clicks give the wrong order.** Repro: select USS Nimitz, ADD WAYPOINT, click 3-4 map
   points: the waypoint list grows and pushes the THROTTLE and ROE rows down, so a click aimed at FLANK hits STOP and one aimed at an ROE
   button hits HOLD. Also the ORDERS panel often sits below the FORCES list out of view, and the lower sidebar renders black/clipped until
   the player wheel-scrolls it (worse after visiting the COMBAT tab). Required: THROTTLE and ROE rows keep a fixed position when waypoints
   are added (e.g. controls above, waypoint list in a bounded scroll box below); selecting a unit brings its ORDERS panel into view; no
   black/clipped region in the sidebar at 1280x720 and 1920x1080.
3. S3 (same files, fix if small): clicking the already-selected unit does not bring its orders back (must re-show them); Space starts/pauses
   the clock even after a sidebar button was clicked (do not let Space re-press a focused sidebar button; Enter still activates buttons);
   the MEDIA tab click did not switch tabs (stayed INTEL) — check and fix if it is a real bug.

## Fence
- UI only. No change to sim rules, combat, sensors, victory conditions, scenario data/balance, save format or the WEGO loop.
- No new features. Keep the look (phosphor green, fonts, palette) exactly as it is.
- Out of scope (seat holds it for a design call): the scenario feels toothless (fast boats never reach the carrier); escorts not following
  the carrier; Hornets 0 kts at waypoints; no keyboard map pan; only one scenario.

## Battery and done
- Unit tests and the existing e2e suite stay green (run e2e with `--workers=2` max). Add e2e tests: (a) editor LOAD opens a chooser and a
  saved scenario JSON round-trips (SAVE then LOAD); (b) adding 4 waypoints leaves the THROTTLE/ROE button bounding boxes unchanged;
  (c) selecting a unit puts the ORDERS panel inside the viewport.
- Checkpoint-commit as you go; push to your session branch. Write `docs/lane-reports/SAND-RC-FIX1-REPORT.md`: per defect, cause found,
  fix, test name, and before/after test counts. Never merge to main.
