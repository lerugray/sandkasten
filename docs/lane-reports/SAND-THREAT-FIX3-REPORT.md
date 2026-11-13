# SAND-THREAT-1 FIX3: the passive-defeat proof on any host, and the two OSINT overlap reds

Lane `sand-threat-fix3-t486`, branch `claude/sand-threat-fix3-t486-lane-na6tvi`, started from `70b3aa1` (the card commit `9085b4f` sits on top of it).
Card: `docs/handoffs/sand-threat-fix3-t486/CARD.md`. Receipts: `docs/verification/sand-threat-fix3-t486/`.

Short version:

- **Item 1 is case (b).** The game defeats a passive player every time, on every frame rate measured. The proof's 480 s wall-clock wait was too short for a slow host. The proof now waits on the game clock. No game code changed for item 1.
- **Item 2 is a real overlap, fixed in the layout.** On `/map` a site label could lie on a facility symbol for as long as a new view was loading its base map. The zero-overlap spec only saw it on a host slow enough for the loading to outlast its settle time.
- Unit suite: 341 before, 352 after, all green. The e2e numbers are in section 6; the full e2e run in this container did not finish clean, for the reasons listed there.

## 1. Item 1: diagnosis, written before any change

The question was whether (a) the game can fail to defeat a passive player, or (b) it does reach DEFEAT and the test stops waiting too early.

### 1.1 The game outcome does not depend on frame time or dice (headless, 20 seeds)

The browser loop ticks every 50 ms and hands the engine the real time since the last tick. At 60x the engine turns that into game time and cuts it into steps of at most 5 s (`simulationTick`, `MAX_SUBSTEP_MS`); a tick longer than 2 s of real time is clamped (`MAX_REAL_DT_MS`). So a slow machine changes two things: the size of the game step (2.5 to 5 s instead of 3 s) and, past the clamp, how fast game time runs. It does not skip any phase.

I ran the shipped scenario in the production `SimulationSession` with the frame time varied, 20 dice seeds each (seed n uses `n * 7919`, the same as the existing proofs; frame jitter comes from a separate seeded stream).

Do-nothing, 17 frame patterns x 20 seeds (`do-nothing-frame-patterns-20-seeds.txt`):

| frame pattern | defeats | T+ hours to defeat (min / median / max) |
|---|---|---|
| fixed 50 ms, the unit proof (3.0 s step) | 20 / 20 | 2.11 / 2.26 / 2.33 |
| fixed 50 ms, autopause on, resumed at once | 20 / 20 | 2.11 / 2.26 / 2.33 |
| fixed 60 ms (3.6 s step) | 20 / 20 | 2.22 / 2.31 / 2.52 |
| fixed 83 ms (4.98 s step) | 20 / 20 | 2.20 / 2.31 / 2.42 |
| fixed 84 ms (2 x 2.52 s) | 20 / 20 | 2.19 / 2.28 / 2.36 |
| fixed 100 ms (2 x 3 s) | 20 / 20 | 2.11 / 2.26 / 2.33 |
| fixed 150 ms (2 x 4.5 s) | 20 / 20 | 2.18 / 2.29 / 2.38 |
| fixed 250, 500, 1000, 2000 ms and 5000 ms (clamped): 5 s steps | 20 / 20 each | 2.18 / 2.26 / 2.40 |
| jitter 50 to 120 ms | 20 / 20 | 2.21 / 2.30 / 2.41 |
| jitter 50 to 400 ms (autopause off and on) | 20 / 20 each | 2.27 / 2.33 / 2.40 |
| jitter 200 to 2000 ms (autopause off and on) | 20 / 20 each | 2.22 / 2.31 / 2.44 |

340 of 340 runs end in DEFEAT by Carrier Lost, between T+2.11 h and T+2.52 h.

All four proof plans, 10 frame patterns x 20 seeds (`four-plans-frame-patterns-20-seeds.md`): do-nothing 200 / 200 defeat (T+2.11 to 2.52 h), careless FLANK alone 200 / 200 defeat (T+1.20 to 1.51 h), escort screen forward ROE FREE 200 / 200 victory (T+6.21 h), southern dog-leg with air 200 / 200 victory (T+3.98 h). 800 of 800 as the SAND-THREAT-1 card requires. So both directions hold on a slow machine too.

One thing to know, not a defect under this card: because the step size follows the frame time, the same dice seed gives a slightly different run at a different frame rate (the defeat moves by a few minutes of game time). The result does not change in any of the 1,140 runs above. I left the stepping alone: the card asks for a stepping change only in case (a).

### 1.2 The browser reaches DEFEAT, throttled or not; what it costs is wall time

Chromium headless (software WebGL, about 2 frames per second on this container), the old wait logic copied into a script that also logs the game clock (`browser-old-wait-diag.cjs`, results in `browser-old-wait-runs.jsonl`). CPU throttling is Playwright CDP `Emulation.setCPUThrottlingRate`. Dice are the browser's own, so every run is a different seed.

| CPU throttle | result | game time at defeat | wall time | autopause resumes |
|---|---|---|---|---|
| none | DEFEAT | T+2.34 h | 238 s | 114 |
| 4x | DEFEAT | T+2.31 h | 292 s | 133 |
| 6x | DEFEAT | T+2.35 h | 302 s | 111 |

Where the wall time goes (unthrottled run): the first T+1.87 h take 122 s (about 55x, close to the nominal 60x). Then the missile boats open fire and the default autopause stops the clock on almost every tick (new contact, weapon incoming, friendly damaged). The last 0.47 h of game time take 116 s, about 14x, at 4x throttle 171 s, about 10x: the clock only moves between the test noticing PLAY and the next autopause, and each resume costs the old helper a 400 ms poll plus a click that waits for two stable animation frames.

So the budget of the old proof was: at least 138 s of running clock, plus 110 to 135 resumes at whatever one poll-and-click costs on that host. This container needs 238 to 302 s of the 480 s. A host where one resume costs about 2.5 s instead of 1 s (Windows, two workers, a busy GPU process) runs past 480 s with the carrier still afloat at about T+2.2 h, and the helper then reports "result overlay not visible". That is the red on the attribution host. I could not make this container slow enough to cross 480 s with main-thread CPU throttling alone (the software renderer runs in another process), so the 480 s miss itself is not reproduced here; the mechanism and the margin are measured.

**Diagnosis: (b).** The game reaches DEFEAT; the test's wall-clock wait was too short for a slow host.

## 2. Item 1: what changed

Tests only. No file under `src/` changed for item 1 except the unit test file.

- `tests/helpers/sandPlay.ts`: new `runUntilResultOnSimClock(page, { maxSimHours, wallCapMs, stallMs })`. It reads the game clock, pause state and result from the existing e2e handle (`window.__sandSession`), presses the real PLAY button every time the game pauses itself, and ends when the session has a result; then it waits for the debrief overlay. It fails in three cases: the game clock passes `maxSimHours` with no result (a real miss), the clock stands still for 120 s while the game says it is running (a hang), or 25 minutes of wall time pass. `runUntilResult` is unchanged; the other specs still use it.
- `tests/sand-threat-1-passive.spec.ts`: uses the new wait with `maxSimHours: 4` (every measured run is lost by T+2.52 h; the spec already asserted under 4 h). Test timeout 30 minutes. `SAND_E2E_CPU_THROTTLE=<n>` slows the page CPU n times. The receipt JSON now records the wait (game clock, throttle, wall seconds, resumes); a throttled run writes `passive-defeat-cpu<n>x.json`. Every assertion is as before: DEFEAT title, Nimitz destroyed in the deciding line, mission status failed, result decided by Carrier Lost, more than 50 hits, C-802 hits, all launchers Iranian and at least one picket boat, zero US orders, native dice.
- `src/lib/scenarios/__tests__/hormuzThreat.test.ts`: four new unit proofs. Do-nothing loses in at least 19 of 20 seeds on each of three slow-machine frame patterns (every frame at the 2 s clamp; 50 to 400 ms with autopause on; 200 to 2000 ms with autopause on), each defeat by Carrier Lost between T+1.8 h and T+3 h; measured 20 of 20 on all three. Both winning plans still win in at least 3 of 5 seeds on a stalled and on a slow, uneven machine; measured 5 of 5.

## 3. Item 2: finding

The two reds are the `/map` spec (`tests/sand-osint-1-overlap-map.spec.ts`) at 1440x900 and 1920x1080, the pair the FIX2 report names: Khalij Fars against `apt-ir-0057` in the Qeshm view. I reproduced exactly that pair at both sizes:

```
site-label:radar-ir-khalij-fars [811,270 83x16] x facility-icon:apt-ir-0057 [887,281 23x23]      (1440x900)
site-label:radar-ir-khalij-fars [1051,370 83x16] x facility-icon:apt-ir-0057 [1127,381 23x23]    (1920x1080)
```

**It is a real overlap a player sees, not a brittle measurement.** Cause:

- The layout of site labels, site symbols and unit symbols (`computeMapLayout`) treats facility symbols as fixed obstacles. It read them from the renderer's last placement (`queryRenderedFeatures`).
- The layout was solved 120 ms after a zoom, and again only on MapLibre's `idle`. `idle` waits until every base-map tile of the new view has arrived and been placed.
- The Qeshm view is reached from the Gulf view (z6.3). The Qeshm airport symbol is tier 2, drawn from z7.5, so at the first layout the renderer has not placed it yet and the Khalij Fars label takes its first-choice spot, right of the radar, where the airport symbol then appears. It stays there until `idle`.

A player on a slow connection or machine sees the plate on the airport symbol after every such zoom, for as long as the tiles take. The zero-overlap spec measures 2.2 s after `map.loaded()`; on a fast host `idle` has come by then, on the attribution host it had not. Main `fc337505` has the same code, which is why base and candidate were both red there.

With the tile host answered locally and the base-map tiles held back, the old layout shows the overlap for the whole wait, and not only at Qeshm (`map-loading-overlaps-before-fix.txt`): 11 pairs across six views at 1440x900, among them site symbols on airport symbols at Dhafra and Al Udeid after a pan (a pan fires no `zoomend`, so nothing was re-solved until `idle`).

I could not run the original spec against real tiles: this container cannot reach the tile server (proxy 403), so `/map` never reports loaded there and the spec times out (section 6).

## 4. Item 2: what changed (layout, plus tests)

- `src/lib/map/mapLayout.ts`
  - `FACILITY_POINT_TIERS` and `FACILITY_ICONS_ALL_DRAWN_ZOOM` (9): the tier table and the zoom from which every facility symbol is drawn, moved here from `FacilityLayer.tsx` so the layers and the layout share one copy.
  - `facilityIconRectsFromData(...)`: the discs of every facility symbol drawn at a zoom, from the facility data. `facilityIconRects(map, facilities)` uses it from z9, where no symbol is hidden by a collision, so the answer no longer depends on what the renderer has placed. Below z9 the renderer still decides which symbols are drawn, so the rendered set is still used.
  - `drawnFacilityKey(map, fromData)`: identity of the facility symbols on screen.
  - `computeMapLayout` takes the facility list as an optional input.
- `src/components/map/LayoutController.tsx`: takes the facility list; also re-solves after a pan (`moveend`) and as soon as the set of drawn facility symbols changes (checked at most five times a second while the map is drawing and not being dragged), instead of waiting for `idle`. `idle` and `zoomend` still trigger it. The layout is only published when its result changes, as before, so nothing flashes.
- `src/components/map/FacilityLayer.tsx`: imports the tier table and the z9 constant from `mapLayout.ts` (same values).
- `src/components/map/TacticalMap.tsx`: passes `scenario.facilities` to the layout controller.

**/play styling touched: none.** No line of `src/app/play/`, `terminal.css`, `TerminalPlay.tsx` or `src/lib/plot/` changed. The four files above are the MapLibre view (`/`, `/editor`, `/play?map=legacy`); the changes are logic only, no style, colour, size or class.

Tests:

- `tests/sand-osint-1-overlap-map-loading.spec.ts` (new, 2 tests): answers the tile host locally, holds the base-map tiles of each view, checks zero overlaps while the view is still loading, releases the tiles and checks the settled view. Seven views at both sizes, including the Gulf to Qeshm zoom, a pan at one zoom and the way back below z9. It needs no tile server and no GPU flag. On the old layout it fails at both sizes with the reported pair; with the fix it passes.
- `unit/map-layout-facilities.test.ts` (new, 7 tests): on the real Hormuz data, the Khalij Fars label is clear of the airport symbol when the renderer has placed nothing, and the same layout without the facility list puts the label on the symbol (the defect).
- `tests/sand-osint-1-overlap-map.spec.ts`: its checks are unchanged; it was right. One opt-in was added: `SAND_E2E_STUB_TILES=1` answers the tile host locally (`stubTileHost` in `tests/helpers/mapViews.ts`) so the spec can run on a machine without the tile server. Unset, nothing changes.
- While holding tiles, the loading spec waits 3 s for the facility symbols to appear and then allows up to 20 s for the overlaps to clear. On the old layout they never clear while the tiles are held.

## 5. Both directions still proven

No scenario data, doctrine, engine, combat or victory rule changed, so the SAND-THREAT-1 proofs stand as they were: the existing unit proofs (do-nothing and careless lose, both sensible plans win, 5 seeds each) pass, and section 1.1 adds 20 seeds on 10 frame patterns for all four plans, 800 of 800.

Fences: no rule the SPEC does not carry, no balance change, no save-format change, no new dependency. Nothing merged to main, nothing deployed.

## 6. Battery

Environment here: cloud container, 4 cores, no GPU, no route to the tile server. Chromium via `SAND_E2E_CHROMIUM=/opt/pw-browsers/chromium SAND_E2E_SWIFTSHADER=1`, at most 2 Playwright workers at any time.

`npm test` runs the unit suite and then the whole e2e suite, and on this 4-core host Playwright's default is 2 workers, so `npm test && npm run test:e2e -- --workers=2` would be the same e2e run twice. I ran the unit suite and one full e2e pass at `--workers=2`.

| | before | after |
|---|---|---|
| unit (`vitest run`) | 341 / 341 at `70b3aa1` | **352 / 352** |
| e2e, attribution host (from the card, focused set) | candidate 3 failed / 32 passed; base 2 failed / 32 passed | not run by this lane (seat's land battery) |
| e2e, this container, full suite, 2 workers | not run | **stopped at the time cap: 68 passed, 21 failed, 2 skipped, 37 of 128 not run** |

**The full e2e run is not "0 failed" here, and it did not finish.** I stopped it after 39 minutes to keep the three passive runs inside the cap. The list is in `e2e-full-2-workers-stopped-at-cap.log`. Not reached: the rest of `sand-save-1-flow`, `sand-victory-1*`, `sand-wego-1-flow`, `simulation`, `smoke` (and the passive spec, which was then run four times on its own, below).

The 21 reds, by spec, with the error each one gave:

| spec | reds | error |
|---|---|---|
| `sand-map-2-plot-facilities` | 8 | failed tile requests counted by the "no failed requests" tests (no tile server); plot clicks at software-GL frame rates |
| `sand-combat-1-record` | 3 | 60 s frame gate of the DPR 2 plot (software WebGL) |
| `sand-osint-1-overlap-plot` | 2 | plot draws no labels in time at 1440 and 1920 (software WebGL) |
| `sand-play-1-shots` | 2 | DPR 2 pixel inspection (software WebGL) |
| `sand-osint-1-overlap-map` | 2 | no tile server: the attribution control stays open and covers facility symbols at the top edge. No Khalij Fars pair. With `SAND_E2E_STUB_TILES=1` both sizes pass (below) |
| `sand-osint-1-rings` | 1 | plot label check (software WebGL) |
| `design-system` | 1 | tilt reached 0.89 of 0.95 within 5 s; `/play`, code this lane did not touch; passed in a rerun on base code, failed again in a rerun on this branch |
| `sand-001-unit-placement` | 1 | 0 unit markers in the editor; passed in a rerun on base code and in a rerun on this branch |
| `sand-map-1-facilities` | 1 | globe / terrain / satellite test ran past its 30 s |

Attribution I could do in the time: `sand-001`, `design-system` and the `sand-map-1` globe test were rerun against the base layout code and against this branch. `sand-001` passes on both. The tilt test passed on base once and failed on this branch once; it is a `/play` page that runs none of the changed code. **The globe test is the one to watch:** it passed once on base beside another worker, then failed alone on base; on this branch it failed in the full run, in a rerun, and again alone with the `onRender` handler taken out for the test. So in this container it is unstable either way and I cannot show it is unaffected by the layout change. The OSINT report already notes it at 27.7 s of its 30 s on a real host. If it is red in the seat's battery, the suspect is the layout re-solving while the globe is drawing (`onRender` in `LayoutController.tsx`); removing that handler alone leaves the reported Qeshm fix intact (the z9 data path) but lets the transient overlaps below z9 return.

The other reds were not rerun against base. Their errors are tile requests and frame gates, and earlier lane reports record the same specs as unable to run in this container.

Focused runs in this container:

| run | result |
|---|---|
| passive spec, new wait, beside the overlap specs (2 workers) | PASS: DEFEAT at T+2.3 h, 213.7 s wall, 104 resumes |
| `sand-osint-1-overlap-map-loading` (new), old layout, 2 workers | FAIL at both sizes, reported pair present |
| `sand-osint-1-overlap-map-loading` (new), fixed layout, 2 workers | PASS at both sizes (1.0 and 1.1 min) |
| `sand-osint-1-overlap-map` 1440 and 1920 | cannot run here: no tile server, times out in `settleMap` |
| `sand-osint-1-overlap-plot` 1440 and 1920 | cannot run here: software WebGL cannot draw the plot at these sizes in time (frame gate) |

The three extra passive runs the card asks for:

| run | CPU throttle | result | game time at defeat | wall time | resumes |
|---|---|---|---|---|---|
| 1 (beside the throttled run) | none | PASS, DEFEAT | T+2.31 h | 293 s | 133 |
| 2 (beside run 1) | 4x | PASS, DEFEAT | T+2.16 h | 262 s | 99 |
| 3 (beside the map specs) | none | PASS, DEFEAT | T+2.33 h | 303 s | 148 |

With the earlier run that makes four of four on the new wait. Receipts: `docs/verification/sand-threat-1-t438/passive-defeat.json` (run 3) and `passive-defeat-cpu4x.json` (run 2). The container restarted once during this step and killed a first attempt at runs 1 and 2; they were started again from scratch.

Map specs after the final test edits, tile host answered locally:

| run | result |
|---|---|
| `sand-osint-1-overlap-map-loading` 1440 and 1920 | PASS, PASS (run three times on the final code) |
| `sand-osint-1-overlap-map` with `SAND_E2E_STUB_TILES=1`, 1440 and 1920, all 14 views | PASS, PASS (0 overlaps; the outline-on-land check has no base-map water to test against in this mode) |

## 7. Left for the seat

- **The full e2e suite has not been seen green at this candidate.** Section 6 has what ran here. The card's "e2e 0 failed" is still owed and needs the seat's host.
- **Run the land battery on a real-GPU host with the tile server reachable.** The original `/map` zero-overlap spec and the plot spec at 1440 and 1920 could not run in this container. The new loading spec covers the defect without a tile server, and the unit test covers the layout, but the original spec against real tiles is the confirming run.
- **Stepping is frame-rate dependent in its detail** (section 1.1): same seed, different frame rate, slightly different run, same result in 1,140 of 1,140 runs. If main wants bit-identical runs for a given seed, that is a fixed-step accumulator in `simulationTick`, a rules-level change outside this card.
- **The autopause fires about 110 to 135 times in a passive run**, almost all of them in the last half hour of game time. That is what a passive player sits through before the defeat, and it is what made the old proof slow. Whether repeated "weapon incoming" pauses should collapse during one attack is a UI decision for the seat, not part of this card.
- `README.md` and `SESSION_NOTES.md` point to `docs/lane-reports/SAND-THREAT-1-REPORT.md`, which is not on this branch (only the FIX2 report and the t438 verification folder are).
- Other long plays still use the wall-clock `runUntilResult`. They passed on the attribution host. If one turns red on a slow host for the same reason, `runUntilResultOnSimClock` is the replacement.
