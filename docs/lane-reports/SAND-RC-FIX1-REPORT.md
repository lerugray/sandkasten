# SAND-RC-FIX1 report

Lane: co3 t420 (backup account), branch `claude/sand-rc-fix1-lane-8mxspe`. Card: `docs/handoffs/sand-rc-fix1-t420/CARD.md`.
Base: sandkasten main `e3697c0d` (brief commit `c9880b0`). UI only: no change to sim rules, combat, sensors, victory, scenario data, save format or the WEGO loop.
Reproduced on a production build (`next build` + `next start`), Playwright, 1280x720 and 1920x1080, software GL.

## Defect 1 (S2): editor LOAD shows the browser error page

**Reproduced: yes, with one condition.** Plain `/editor` -> LOAD does *not* fail: the file chooser opens (with and without a `filechooser` handler), and the title -> `/play` -> MAIN MENU -> EDITOR -> LOAD route does not fail either. It fails when the chosen file is valid JSON that is not a scenario. The input accepted any `.json`, which includes the player's own `.sandsave.json` battle save sitting in Downloads.

**Cause.** `loadScenario` did `setScenario(JSON.parse(text) as Scenario)` with no shape check. The editor reads `scenario.sides.flatMap(...)` on every render, so a wrong shape threw during render (`Cannot read properties of undefined (reading 'flatMap')`; `null` gave `reading 'sides'`), and Next showed its production global error page: "This page couldn't load / Reload / Back". Back recovered, as in the cold play. Repro files: a battle-save-shaped object, `[1,2]` and `null` all produced the page. Screenshot before the fix: `sand-rc-fix1/editor-load-error-BEFORE-fix.png`.

I cannot say from the report which file the cold-play driver chose. Wrong-shape JSON is the only trigger I could find; if the player's driver handled the chooser differently, that is the one thing I could not confirm.

**Fix.**
- New `src/lib/scenarios/parseScenarioFile` validates the text (JSON, object, `sides` list, theater centre and zoom, each side's name and units, each unit's id and position), fills the optional fields, and returns a message instead of state. A battle save gets a message that says it opens from LOAD BATTLE in the play screen.
- `src/app/editor/page.tsx`: the file input is now a hidden `<input>` in the page (not detached), the result shows in the header (`editor-file-message`), a refused file leaves the editor untouched, and choosing the same file twice fires again.
- `saveScenario`: the object URL is revoked after 10 s (`setTimeout`), not in the same tick as `a.click()`.

**Tests.**
- e2e `tests/sand-rc-fix1.spec.ts`: "LOAD opens a chooser, and a scenario saved by SAVE loads back unchanged" (real download, fresh editor, real chooser, second SAVE equals the first); "a scenario with units loads and shows them in the forces list"; "a file that is not a scenario (a battle save) is refused with a message, not the browser error page" (battle save, array, `null`; no page error; chooser opens again).
- unit `src/lib/scenarios/__tests__/parseScenario.test.ts`: 11 tests (round trip, defaults, playerSide fallback, 8 refusals).

## Defect 2 (S2): ORDERS panel shifts, hides, clips

**Reproduced: yes**, all three symptoms, at 1280x720 and 1920x1080.
1. After selecting Nimitz the panel started at y=492, below the FORCES list; THROTTLE at y=614, ROE at y=680 (the viewport ends at 720).
2. Adding waypoints grew the list above them: THROTTLE moved 614 -> 690 and ROE 680 -> 756, off-screen. This is the FLANK -> STOP and ROE -> HOLD misclicks.
3. Black region: after COMBAT -> FORCES the sidebar body was left with an inline `max-height: 220px` while the panel is 604 px tall, so about 180 px under the list was empty black. Same at 1920x1080 (220 px in a 964 px panel).

**Cause.**
- Layout: the waypoint list sat between the ADD WAYPOINT row and THROTTLE, so every waypoint pushed everything below it down; nothing scrolled the panel into view on selection.
- Clip: `snapPanelBody` (SAND-OSINT-1 FIX2, to avoid a half row under the "-- MORE --" cue) wrote an inline `max-height` from row positions measured at the moment of a tab or size change, with the old value cleared first and scroll offset ignored. It only re-ran on tab, unit count and panel resize, so it went stale when content changed and left a dead band.

**Fix.**
- `OrderPanel`: order is now ADD WAYPOINT/CLEAR, THROTTLE, ROE (+ note), ENGAGE, SENSORS, then the route list last in a bounded scroll box (max 6.5 rem, newest waypoint scrolled into view). Nothing above the list changes height when a waypoint is added.
- `TerminalPlay`: every unit selection bumps a counter that scrolls the orders section the least amount that shows the title through the ROE note (never off the top). It runs for force-row clicks (including re-clicking the selected unit), map picks, the NIMITZ mission button, and on returning to FORCES from another tab. A map pick or NIMITZ button switches to FORCES first (combat-record "inspect" does not).
- `snapPanelBody`, its ResizeObserver and the inline `max-height` are removed. The "-- MORE --" cue (`terminal.css`) is now its own fixed 24 px row under the list, always present and blank when idle, instead of an overlay; same colours, so showing or hiding it moves nothing. Look otherwise unchanged (phosphor green, fonts, palette).

**Tests** (`tests/sand-rc-fix1.spec.ts`, each at 1280x720 and 1920x1080):
- "(b) adding 4 waypoints leaves the THROTTLE and ROE buttons exactly where they were" (bounding boxes equal; list height bounded; clicks aimed at FLANK and ROE FREE land on them).
- "(c) selecting a unit puts its ORDERS panel, through the ROE rows, inside the viewport" (and inside the scrolling body, so not clipped; two units).
- "no black or clipped region after a visit to COMBAT; the sidebar body fills its panel" (no inline `max-height`; cue row ends at the panel's bottom edge and the body runs down to it, through COMBAT/INTEL/FORCES switches).

Screenshots: `sand-rc-fix1/orders-before-4wp-1280x720.png`, `orders-after-4wp-1280x720.png`, `combat-then-forces-after-1280x720.png`.

## S3 items

| Item | Result | Test |
|---|---|---|
| Clicking the already-selected unit does not bring orders back | Real, fixed (selection counter fires on every click) | "S3: re-clicking the selected unit shows its orders again; NIMITZ from COMBAT lands on FORCES" |
| Space acts on a focused sidebar button | Real, fixed. Space on a focused `<button>` inside the sidebar now toggles the clock (keydown and keyup are both prevented so the key-up click is swallowed). Enter still activates buttons. Other focus targets (inputs, selects, dialogs, bottom bar) are unchanged. | "Space runs the clock after a sidebar button was clicked, and does not press the button; Enter still does" |
| MEDIA tab click did not switch tabs | **Not reproduced.** The tab buttons switch on a plain click on the production build and under the e2e run, including after waypoints and a COMBAT visit. The only code that moves the tab behind a click is the autopause `suggestedTab` effect (INTEL/COMBAT), which would put the panel back on INTEL if an autopause landed with the click; I think that is what screenshot 99 caught but I could not prove it, so no change beyond the test. | "every sidebar tab switches when clicked, including MEDIA, also after waypoints and a COMBAT visit" |

## Test counts

| | before | after |
|---|---|---|
| Unit (vitest) | 306 tests / 25 files | 317 tests / 26 files (+11) |
| e2e (playwright `--list`) | 111 tests / 28 files | 124 tests / 29 files (+13) |

Run results, `--workers=2`, Chromium with SwiftShader, no network (tile server unreachable):
- **Unit: 317 / 317 pass.** `tsc --noEmit` is clean for `src/`; the pre-existing `tests/sand-001-unit-placement.spec.ts` type errors are untouched.
- **New spec: 13 / 13 pass** in the full run.
- **Full e2e after: 95 passed, 27 failed, 2 skipped.** All 27 failures are in 9 existing spec files (combat-1 record, map-2 facilities, osint-1 overlap/rings, play-1 shots, victory-1, wego-1 flow).
- **Same 9 files on the untouched base (`c9880b0`): 19 passed, 25 failed.** The 25 are a subset of my 27. The causes visible in the logs are the container, not the code: `tiles.openfreemap.org` unreachable (map-2 "no failed requests", OpenFreeMap), 60 s frame-count waits on software GL (victory, wego, combat, play-1 shots at DPR 2), and "labels present" on the overlap checks.
- The two failures only in my run were `sand-map-2 ... Havadarya` and `sand-osint-1-overlap-plot ... 1440x900`. Re-run alone: overlap-plot 1440 fails on base as well as on mine (its 1920 sibling fails on both too). Havadarya is flaky on base (2 of 6 repeats fail there, 1 of 3 on mine): the click lands before the camera has settled and hits the top bar. Not caused by this lane.
- **The long victory / WEGO / combat plays did not run clean in this container, on base or after, so they are not evidence for or against this change.** They need the GS real-GPU run. They use `force-row`, `order-*` testids and the plot handle, none of which changed.
- Running the full suite rewrites tracked evidence under `docs/verification/`; I restored those files and committed none of them.

## Not done / for the seat
- Out-of-scope items from the card were left alone (toothless scenario, escorts not following, Hornets 0 kts at waypoints, no keyboard map pan, one scenario).
- The camera re-centring on selection (a click-coordinate shift in the cold play) is by design in this code and unchanged.
- The confirming cold play needs a new RC sha from this branch.

## Re-verification (co3 t428 relaunch r2, backup account)
The branch already held the full fix from the first run, so this run re-checked it and changed no code. Chromium via `SAND_E2E_CHROMIUM=/opt/pw-browsers/chromium`, `SAND_E2E_SWIFTSHADER=1`, `--workers=2`, no network (tile server unreachable).
- Unit (vitest): 317 / 317 pass (26 files).
- `tests/sand-rc-fix1.spec.ts`: 13 / 13 pass.
- Existing specs on sidebar, orders, save and design (smoke, simulation, design-system, sand-001..007, sand-save-1 flow and lifecycle, sand-play-1 plans and objective, platform-database): 56 / 56 pass.
- Not re-run here: the long victory / WEGO / combat / overlap plays that the first run found do not finish on software GL. They still need the GS real-GPU run.
- Test runs rewrote tracked files under `docs/verification/`; restored, not committed.
