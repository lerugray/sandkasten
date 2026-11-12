# Session Notes

## LANDGATE3 (t589) — 2026-11-12
- Cleared map@1920 settle hang (image-decode) + dense omit; play-shots frames warm on load.
- Dirty tree for harvester; no commit/push. Report: `docs/lane-reports/SAND-ART1-LANDGATE3-REPORT.md`.

## Session 1 — 2026-03-22 (GDD Refinement + DB Exploration)

### Key Decisions
- Single-player vs. scripted OPFOR is the primary mode (like CMO), WeGo multiplayer is future
- Continuous time with pause/play/speed controls, not strict turns
- CMO-style TCA (Trigger-Condition-Action) event scripting system adopted
- Mission-based AI (patrol, strike, CAP, escort, transit, support) with doctrine cascade (side > mission > unit)
- Will extract platform data directly from CMO's SQLite database files (DB3K_512.db3)

### CMO Database Analysis
Located at `C:\Program Files (x86)\Steam\steamapps\common\Command - Modern Operations\DB\`

**Record counts (DB3K_512 — 1980 to present):**
- Ships: 4,867 | Aircraft: 7,479 | Submarines: 745
- Facilities: 4,563 | Ground Units: 465
- Weapons: 4,419 | Sensors: 7,227 | Mounts: 4,115
- Warheads: 1,357 | Loadouts: 33,786 | WRA: 25,042
- Countries: 186 | Services: 57

**Schema structure (junction tables use ID + ComponentID pattern):**
- Platforms: DataShip, DataAircraft, DataSubmarine, DataFacility, DataGroundUnit
- Each platform has junction tables for: Sensors, Mounts, Propulsion, Fuel, Signatures, Comms, Codes
- Ships also have: Magazines, DockingFacilities, AircraftFacilities
- Aircraft also have: Loadouts (33k loadout configs with weapon lists and mission roles)
- Mounts contain weapons (DataMountWeapons), magazines contain allowed weapons
- Weapons have: Targets, Warheads, Sensors (seekers), Propulsion, Signatures, WRA

**Key data per platform:**
- OODA cycles (detection/targeting/evasion reaction times)
- MissileDefense value (drives WRA salvo sizing)
- Directional signatures (front/side/rear/top) for: radar (A-D, E-M bands), IR, visual, acoustic (4 frequency bands)
- Speed profiles by altitude band and throttle setting with fuel consumption
- Crew/displacement/armor per section (ships), agility/cockpit gen/endurance (aircraft), max depth (subs)

**Sensor detail level:**
- Full radar parameters: peak power, pulse width, PRF, beamwidth, system noise, processing gain
- ESM: sensitivity, system loss, channels, precise emitter ID
- Sonar: source level, pulse length, directivity index, recognition differential
- Range, scan interval, max contacts, capabilities (search/track types)
- Sensor generation (era) and frequency bands

**Weapon detail level:**
- PK per domain (air/surface/land/subsurface), range min/max per domain
- CEP, cruise altitude, max flight time, waypoint capability
- Warhead: type, damage points, explosives type/weight, caliber
- Seeker: passive radar + active radar seekers with ranges
- WRA: how many rounds per target type, shooter quantity, autofire/self-defense ranges

**Also available:**
- Text descriptions per platform (Wikipedia-sourced overviews)
- Images folder
- Lua scenario scripts showing CMO's scripting API (ScenEdit_AddUnit, ScenEdit_AssignUnitToMission, etc.)
- 186 countries, 57 service branches

### GDD Updates Made
- Concept: single-player primary, WeGo future
- Core loop: continuous time with pause/play/speed, autopause triggers
- New Section 6: OPFOR AI & Scripting with CMO-style TCA system
- Scenario format: updated with doctrine, missions, reference points, TCA events
- MVP: single-player only, includes OPFOR scripts
- Phases reordered: OPFOR AI before combat, multiplayer pushed to Phase 5

### DB Extraction Completed
Wrote `scripts/extract_cmo_db.py` — Python script that reads DB3K_512.db3 and outputs:

**MVP data (107 MB, `data/extraction/`):**
- ships.json: 4,696 records (filtered deprecated/hypothetical)
- aircraft.json: 7,109 records
- weapons.json: 4,262 records (with WRA, warheads, seekers, signatures)
- sensors.json: 7,200 records (full radar/ESM/sonar/IR params)
- mounts.json: 4,085 records (with weapon + sensor IDs)
- loadouts.json: 31,796 records (aircraft weapon configs with role, radius, time on station)
- 43 enum lookup files in `data/extraction/enums/`

**Deferred raw dumps (26 MB, `data/raw/`):**
- Submarines (732) with all junction tables
- Facilities (4,498) with mounts, sensors, signatures
- Ground units (455) with full loadouts
- Satellites (309) with orbits
- Comms, magazines, docking facilities, aircraft facilities

Full extraction spec documented in `DB_EXTRACTION_SPEC.md` — covers every table, field mapping, what's deferred and why, and schema gotchas (WRA codes, signature meanings, OODA math).

### Phase 1 Completed (Session 1, continued)
- Next.js 16 + TypeScript + Tailwind scaffold
- MapLibre tactical map with dark/light theme toggle
- milsymbol NATO symbol rendering with factory/cache
- Unit markers with click-to-select, shift+click persistent range ring pinning
- Detail panel with tabbed view (Info/Sensors/Weapons) pulling full platform data from API
- Platform database service: API route serving full CMO data with enum resolution
- TypeScript types for all extracted record types (ship, aircraft, weapon, sensor, mount, loadout)
- Scenario editor at /editor: place units from platform list, set scenario metadata, save/load JSON
- Demo scenario: Strait of Hormuz (US CSG vs Iran)

### Phase 2 Completed (Session 1, continued)
- Simulation engine with 20fps tick loop and configurable time compression (1x-60x)
- Game state management: sim clock, pause/play/speed, unit orders, contacts
- Movement system: waypoint paths, throttle-based speeds, great-circle navigation
- Radar detection model: range-based probability, radar horizon check, classification
- ESM detection: passive, detects active emitters at 1.5x range, bearing only
- Visual detection: short range, good classification
- Contact system: Unknown → Detected → Classified → Tracked with uncertainty circles
- Contact aging: degrade classification and grow uncertainty over time, lose contact after 2min
- Fog of war: player only sees own units + detected contacts in /play mode
- Waypoint layer: dashed lines showing planned routes
- Order panel: set waypoints (click map), throttle (loiter/cruise/full/flank), radar on/off
- Contact list sidebar sorted by threat level with age indicators
- Play page at /play with full simulation running
- Home page updated with PLAY and EDITOR navigation buttons

### Phase 3 Completed (Session 2 — 2026-03-23)
- Doctrine system: ROE (weapons-free/tight/hold), engagement range, radar usage (active/passive/mixed), evasion, withdraw on damage, BVR/WVR — cascading side → mission → unit
- Mission system: patrol (waypoint cycling), CAP (racetrack orbit + intercept), strike (target + RTB), escort (station-keeping near assigned unit), transit (point-to-point), support (orbit area)
- AI Controller: runs on detection cadence (5 sim-seconds), resolves doctrine per-unit, executes mission behavior, manages radar/throttle, handles prosecution (chase contacts within range) and withdrawal
- TCA Event System: full trigger-condition-action engine with 10 trigger types (ScenarioLoaded, Time, TimeInterval, UnitDetected, UnitDestroyed, UnitDamaged, UnitEntersArea, UnitLeavesArea, SideScore), 5 condition types (SideIs, RandomChance, EventHasFired/NotFired, UnitCountInArea), 7 action types (DisplayMessage, SpawnUnit, DestroyUnit, ChangeDoctrine, ChangeScore, EndScenario, TriggerEvent)
- Point-in-polygon geometry for area triggers
- Demo scenario scripted: 4 Iranian missions (coastal patrol, missile boat patrol, coastal defense escort, CAP station), side doctrine, 6 events (briefing, first contact alert, escalation at T+30m, reinforcement spawn at T+45m with 60% chance, victory at T+2h, defeat if carrier lost)
- Message log UI: sidebar tab with unread badge, timestamped messages, click to mark read
- Scenario result overlay: victory/defeat/draw screen with replay button
- Score tracking per side
- Simulation engine updated: 4-phase tick (AI decisions → movement → detection → TCA events)
- useSimulation hook refactored: accepts ScenarioConfig with missions/doctrine/events, exposes eventState and markMessageRead

### Notes
- Auftragstaktik is adding Radar/Sensor Layer, Military Installations, Nuclear/CBRN Layer, Data Model Normalization — all relevant for future Sandkasten OSINT import
- User wants audio/sound effects — deferred to polish phase (see memory)

### Phase 4 Completed (Session 2 — 2026-03-23, continued)
- Platform data enriched with combat stats: damage points, missile defense values, weapons (name, type, range, speed, PK, quantity, warhead damage, seeker type), defenses (chaff, ECM, CIWS, decoy with effectiveness ratings)
- Weapon selection logic: filters by target domain (air/surface), range (adjusted by doctrine engagement range), ammo remaining; prefers guided weapons over guns, higher PK first
- Missile flight model: weapons tracked as entities in flight with position, heading, speed, range remaining; move toward target each tick; seeker activation at terminal range
- SAM defense: AI ships engage incoming aircraft/missiles with SAMs based on doctrine ROE
- Countermeasures: chaff, ECM, CIWS, decoy each roll independently against incoming weapons; effectiveness values from platform data
- Damage model: warhead damage vs. platform HP; damage ratio determines state transition (undamaged → damaged → mission-kill → destroyed); aircraft are fragile (low HP); ships can absorb multiple hits
- Combat integrated as Phase 4 in sim tick (after movement, detection, before TCA events)
- Engagement cooldown: 30 seconds between salvos per unit
- Combat log UI: 3-tab sidebar (Forces/Intel/Combat); combat tab shows weapons in flight + event log with color-coded entries (launch/hit/miss/defended/destroyed)
- Weapons-in-flight badge on combat tab

### Session 3 — 2026-03-23 (Testing, Bug Fixes, UI Polish)

**Bugs Found & Fixed:**
- Range rings flashed/seizure-inducing when clicking units during simulation — layers were being torn down and rebuilt every 250ms. Fixed by separating layer creation (once) from data updates.
- Combat never triggered — three cascading bugs:
  1. TCA events ran AFTER combat phase, so doctrine changes were always one tick late
  2. `ChangeDoctrine` TCA action was a no-op (comment said "handled elsewhere" but wasn't)
  3. Combat system read static config doctrine, not runtime overrides from GameState
- Iranian units too far from US fleet (~170km) for C-802 range (120km). Adjusted starting positions and patrol areas.
- Escalation event required 30min sim timer which meant units sailed past each other. Changed Iran to weapons-free from start.
- UI text too small across the board (10-12px on what appears to be a high-res display). Bumped to 14-16px.
- MapLibre compass (N circle) and Next.js dev indicator (N logo) both visible. Hidden via CSS and next.config.
- Header elements ran together ("SANDKASTENPLAY"). Added spacing.
- Intel badge clipped by overflow-hidden parent. Changed to inline badge.

**UI Improvements:**
- Spacebar now pauses/unpauses simulation
- Speed buttons grouped in dark pill with visual separation
- Consistent text sizing across home page and play page
- Status bar text bumped up

**Process Lessons:**
- Should do a basic smoke test (start sim, wait 30s, check for combat) before asking user to test
- User is not a programmer — "restart the dev server" means nothing without explicit steps
- Debug logging should be minimal and filterable — flooding the console with per-unit messages is unhelpful
- Don't make the user debug — fix it myself and only ask for screenshots if needed

### Session 4 — 2026-03-25 (Design System Migration)

**Applied Slate Command design system** to match Auftragstaktik. Source: `../Auftragstaktik/DESIGN_SYSTEM_HANDOFF.md`.

**What changed:**
- **Fonts**: Share Tech Mono + Rajdhani → IBM Plex Mono + IBM Plex Sans
- **Colors**: Neon green accent → blue (#3B82F6). Purple-black backgrounds → navy-slate (#0B1120). New `--color-status-green` (#22C55E) for healthy/active/confirmed indicators.
- **Status indicators**: "undamaged", "defended", "AUTONOMOUS", Ollama connected dot now use status-green (actual green) instead of terminal-green (now blue)
- **MapLibre controls**: Repositioned to bottom-right to avoid panel overlap
- **No removals needed**: Sandkasten had no scanlines, glow-borders, or wide letter-spacing

**Also committed earlier this session:**
- Text sizing bump to `text-sm` (14px) across UI components
- Render throttle in useSimulation (sim ticks 50ms, React re-renders ~4fps)

**Session 4 design checklist — verified by Playwright (Session 5):**
1. ~~Home page — "SANDKASTEN" title and "PLAY" button should be blue, not green~~ PASS
2. ~~`/play` — sidebar tabs, time controls, order buttons all blue accent~~ PASS
3. ~~Select a unit — detail panel should show "UNDAMAGED" in green (not blue)~~ PASS
4. ~~Toggle light/dark theme — both should look clean~~ PASS
5. ~~Map zoom controls should be bottom-right corner, not top-right~~ PASS
6. ~~Fonts should feel cleaner — IBM Plex instead of the old monospace everywhere~~ PASS

### Session 5 — 2026-04-02 (Automated Testing)

**Set up Playwright E2E test suite.** 27 tests across 3 files, all passing.

**Test files:**
- `tests/smoke.spec.ts` — 12 tests: page loads, nav links, theme toggle, sidebar tabs, help panel, speed controls, unit selection
- `tests/simulation.spec.ts` — 6 tests: sim clock advances, contacts appear, combat triggers, waypoint mode, intel messages, reset
- `tests/design-system.spec.ts` — 9 tests: screenshots of all pages/states, blue accent color check, IBM Plex font check, zoom control position

**Infrastructure:**
- `playwright.config.ts` — Chromium only, auto-starts dev server on port 3001
- Dev server port changed to 3001 (`npm run dev --port 3001`) to avoid colliding with Auftragstaktik on 3000
- `npm test` runs all tests headless (~27s)
- `npm run test:ui` opens Playwright visual UI for debugging
- Screenshots saved to `test-results/` on failure and for design review
- CLAUDE.md updated: **run `npm test` before every push** is now a hard rule

**How to start the dev server:**
- Open a terminal in the Sandkasten folder
- Type `npm run dev` and hit Enter
- Open `http://localhost:3001` in your browser
- Or: open Claude Code and say "start the dev server and tell me when it's ready"

### Session 5 continued — Quick-Win Polish Features

**4 features implemented, all 29 tests passing:**

1. **God Mode Toggle** — `GOD` button in header + `G` hotkey. Bypasses fog of war, shows all units from both sides. Useful for testing/debugging scenarios.

2. **WRA-Based Salvo Sizing** — Ships now fire realistic salvos based on target's missile defense value (2x missileDefense, clamped 2-8). A DDG firing at a carrier launches 8 Harpoons, not 1. Combat log shows "4× Harpoon" style messages.

3. **Weapon Tracks on Map** — Dashed lines from missiles in flight to their targets, with colored dots at weapon positions. Blue for friendly, red for hostile. Visible through fog of war for incoming threats.

4. **Autopause System** — Auto-pauses on: new contact, friendly damaged/destroyed, incoming weapon, intel message. Shows amber "NEW CONTACT DETECTED" flash in time controls. Auto-switches sidebar to relevant tab. Configurable via `AUTO` button dropdown. Preferences saved in localStorage. Seen triggers reset on manual unpause.

### Session 5 continued — Phase 1-2 Gap Features (3 of 6)

**3 more features, 29 tests still passing:**

5. **Sensor Coverage Overlay** — `SENSORS` button + `S` hotkey. Shows translucent blue radar coverage circles for friendly units with active radar. Uses existing `createCircleGeoJSON()` from rangeRings.ts. Separate from per-unit range rings (which show on selection/pin).

6. **Measurement Tools** — `MEASURE` button + `M` hotkey. Click two points on the map to see distance (nm/km) and bearing. Yellow dashed line with endpoint dots. Click again to start a new measurement.

7. **Drag-to-Move in Editor** — Units in the scenario editor can now be dragged to reposition. Uses MapLibre's `draggable: true` marker option with `dragend` event. Only enabled in editor (play page doesn't use it).

**Tests added:** simulation clock test uses 10x speed to avoid autopause flakiness at 1x.

### Next Steps — 3 Remaining Phase 1-2 Gaps
These were planned and explored but deferred to next session:

1. **Fuel consumption** — Add `fuel`/`fuelMax` to Unit type, throttle-based burn rates in movement.ts, fuel bar in DetailPanel, force loiter when empty. MVP rates: ships 50-400/hr by throttle, aircraft 200-1200/hr. Files: `types/game.ts`, `platforms/lookup.ts`, `simulation/movement.ts`, `simulation/gameState.ts`, `map/DetailPanel.tsx`.

2. **Aircraft altitude + speed profiles** — LOW/MED/HIGH altitude bands affecting speed (80%/100%/110% of base). Climb/descend rate ~2000 ft/min fighters, ~1000 patrol. Altitude selector in OrderPanel for aircraft. Files: `types/game.ts`, `simulation/movement.ts`, `game/OrderPanel.tsx`, `platforms/lookup.ts`.

3. **Game state save/load** — Serialize GameState + EventState + CombatState + AIState to JSON. Convert Map→Record for serialization. Download as `.sandkasten` file, upload to resume. Files: new `simulation/saveLoad.ts`, `play/page.tsx`, `simulation/useSimulation.ts`.

After these 3, all Phase 1-2 gaps are filled and the project is ready for Phase 5 (WeGo Multiplayer).

**How to start the dev server:**
- Open a terminal in the Sandkasten folder
- Type `npm run dev` and hit Enter
- Open `http://localhost:3001` in your browser
- Run tests: `npm test`

### Full Keyboard Shortcuts Reference
| Key | Action |
|-----|--------|
| Space | Pause/resume simulation |
| H / ? | Toggle help panel |
| G | Toggle god mode (see all units) |
| S | Toggle sensor coverage overlay |
| M | Toggle measurement mode |
| Escape | Close panels, deselect units, exit modes |

---

## Session 0 — 2026-03-22 (Conception)

### Origin
- Conceived during Auftragstaktik development session 3
- User is a wargame designer who owns Command: Modern Operations
- Auftragstaktik (tactical OSINT terminal) proved out the map, symbology, range rings, and data feed architecture
- The natural next step: make it playable

### Core Concept
Open-source WeGo wargame simulation where two players command opposing forces on a tactical map with NATO symbology. Inspired by CMO but open-source, community-driven, and connected to real-world OSINT data.

### Key Differentiators from CMO
1. **Real-world scenario generation** — pull live OSINT snapshots from Auftragstaktik as starting positions
2. **Open platform database** — community-maintained, not proprietary like CMO's CWDB
3. **Open scenario sharing** — upload, download, rate community scenarios
4. **Free** — CMO costs $80+, this is open source

### What Transfers from Auftragstaktik
- MapLibre GL JS tactical map (dark/light themes)
- milsymbol NATO MIL-STD-2525 rendering
- Theater system with bounding boxes and sub-regions
- Air defense range ring rendering (proven concept for sensor/weapon ranges)
- Equipment Wikipedia links (starting point for platform database UI)
- Detail panel pattern (click unit → see stats)

### Major Systems to Build
1. **Platform Database** — equipment specs (speed, sensors, weapons, countermeasures) for ships, aircraft, ground units, missiles. Community-editable. This is the biggest single piece of work.
2. **Scenario Editor** — place units on map, assign sides, set victory conditions, save/load/share
3. **Orders System** — waypoints, patrol routes, rules of engagement, weapon release authority
4. **WeGo Turn Engine** — server-side simultaneous resolution. Both players submit orders, server resolves movement, detection, engagement
5. **Detection Model** — sensor ranges by type (radar, ESM, IR, visual, sonar), terrain/weather masking, probability of detection curves
6. **Combat Resolution** — weapon range envelopes, probability of kill, damage model, countermeasures (chaff, flares, ECM, CIWS)
7. **Fog of War** — each player sees only what their sensors detect. Unknown contacts show as bearing/range with uncertainty
8. **Multiplayer** — WebSocket lobby, game state sync, turn timer, replay

### Research Resources
- Command: Modern Operations (user owns, can reference mechanics)
- BookFinder General (user's tool for sourcing military reference books)
- Harpoon (tabletop predecessor to CMO, simpler mechanics, good reference for core model)
- Jane's Fighting Ships / Jane's All The World's Aircraft (platform data source)

### Estimated Scope
- This is a multi-month project minimum
- Phase 1 (scenario editor + unit placement): 3-4 sessions
- Phase 2 (basic movement + sensor model): 3-4 sessions
- Phase 3 (combat resolution): 3-4 sessions
- Phase 4 (WeGo multiplayer): 3-4 sessions
- Phase 5 (platform database + community features): ongoing
- Full feature parity with CMO: probably never (and that's fine — different goals)

### Next Steps
- Write GDD covering core mechanics in detail
- Research CMO's detection and combat models for reference
- Design platform database schema
- Decide on minimum viable scenario: probably a naval engagement (fewer unit types, simpler terrain)

---

## Session s387 — Sim fix card (lane sand-simfix-s387, branch sand/sim-fix-s387)

Worked from `docs/handoffs/sim-fix-2026-11-03/CARD.md`. Full per-finding record: `docs/handoffs/sim-fix-2026-11-03/NOTES.md`.

- Player ENGAGE order and per-unit ROE (hold / tight / free, default tight) in the order panel and as keys E, N, R, F, X.
- Persisted cumulative damage per unit. Aircraft keep a separate one-hit rule.
- One authoritative simulation state (`SimulationSession`), so pause, speed and orders no longer rewind the game.
- Victory comes from taking the carrier through the transit gate, not from elapsed time.
- Demo ships replaced with vessels in service on 2026-03-15; unverified loadouts listed in NOTES.
- Vitest added (`npm run test:unit`); `npm test` runs it before Playwright.

Next: the seat reviews, merges with the s386 round-3 lane (touched-lines list in NOTES), then commits.

## SAND-SAVE-1 (2026-11-09, cloud lane, branch claude/sand-save-1-lane-mmiq6g)

**What now exists:** manual battle save/resume. SAVE BATTLE (top bar and debrief) downloads a versioned `.sandsave.json`; LOAD BATTLE previews and confirms before replacing the run; a restored battle is always paused. Hormuz (continuous and WeGo) and the real-world snapshot are supported. Format v1 only, no migration. InfoWar media is not saved.

**Where the code is:** `src/lib/simulation/battleSave.ts` (codec + validation), `session.ts` (`checkpoint()` / `SimulationSession.restore()`), `src/lib/scenarios/builtins.ts` (built-in config ids and revision digest), `src/components/terminal/BattleFile.tsx` (dialogs), `TerminalPlay.tsx` (config ownership: the route passes a built-in config id, no module swap). Unit tests: `battleSave.test.ts`. E2E: `tests/sand-save-1-flow.spec.ts` (real play, close, reopen, resume, second plan) and `tests/sand-save-1-lifecycle.spec.ts` (refusals, defeat fixture, snapshot, navigation, leaks). Receipts: `docs/verification/sand-save-1-s409/`. Report: `docs/lane-reports/SAND-SAVE-1-s409.md`.

**Decisions:** WeGo battles are saved (not rejected). A rules change that does not touch data needs `RULES_REVISION` bumped in `builtins.ts`; data changes change the digest on their own and old saves are then refused with a clear message. Cloud E2E uses `SAND_E2E_CHROMIUM` and `SAND_E2E_SWIFTSHADER` (see README).

**Next:** GS runs the real-GPU land battery and decides merge. Deferred S3: opening gate/site-label crowding and the grid-label/facility collision (map-layout work).

## SAND-RC-FIX1 (2026-11-10, co3 t420 backup lane, branch s422co3/sand-rc-fix1-brief)

**What changed (UI only):** editor LOAD now validates the file (`src/lib/scenarios/parseScenarioFile`) and shows a message instead of the browser error page when the JSON is not a scenario; the ORDERS panel keeps THROTTLE/ROE fixed with the route list last in a bounded box, scrolls into view on every selection, and the stale inline `max-height` sidebar clip is gone (the MORE cue is a fixed row). Space no longer re-presses a focused sidebar button. Report: `docs/lane-reports/SAND-RC-FIX1-REPORT.md`.
**Next:** a new RC sha for the confirming cold play; GS real-GPU run of the long victory/WEGO/combat e2e plays (they did not run clean in the cloud container on base or after). MEDIA tab bug did not reproduce.

## SAND-THREAT-1 (2026-11-10, co3 t438 backup lane, branch claude/sand-threat-1-t438-lane-fr9no6)

**What changed (scenario data only):** `src/lib/scenarios/demo.ts` now has six Kaman missile boats (two moved out of the strait, four added) on a picket line in the eastern approach, 18 km north-east of the strike group's base course. `demoConfig.ts`: the Missile Boat Patrol runs that line and its `prosecutionRange` is 25 km, not 130. Nothing else moved: no engine, AI, combat, victory-rule, platform, UI or save-code change.
**Result:** with no orders, or with the Nimitz sent alone at FLANK straight to the gate, the carrier is sunk before the gate (20 of 20 seeds each, continuous 60x). Escorts ahead with ROE FREE, or a dog-leg round the line, still win (20 of 20 each). Proofs: `src/lib/scenarios/__tests__/hormuzThreat.test.ts` and `tests/sand-threat-1-passive.spec.ts`. Report with the diagnosis, every knob and the seed tables: `docs/lane-reports/SAND-THREAT-1-REPORT.md`.
**Decisions needed from main:** (1) Hormuz battle saves made before this change are refused by the existing revision check (snapshot saves still load). (2) The carrier is sunk mostly by 76 mm gunfire, because missiles are stopped 85 % of the time with no saturation rule and guns skip the defence roll. (3) In WeGo with 15-minute turns the passive run is not lost, because the enemy re-plans once per turn. All three are rules, not tuning; the report lists them.
**Next:** the seat's end review, the real-GPU land battery (the long DPR-2 e2e plays cannot start in the cloud container) and a cold play that reports whether a defeat was seen.

## SAND-THREAT-1 FIX3 (2026-11-11, co3 t486 backup lane, branch claude/sand-threat-fix3-t486-lane-na6tvi)

**Item 1, the passive-defeat proof (tests only):** the game does defeat a passive player on every run measured (headless: 17 frame-time patterns x 20 seeds, 340 of 340, T+2.11 to 2.52 h; browser at 1x, 4x and 6x CPU throttle: DEFEAT each time). The red on the attribution host was the proof's 480 s wall-clock wait: the missile attack fires about 110 to 135 autopauses and a slow host spends the wait resuming them. `tests/sand-threat-1-passive.spec.ts` now waits on the game clock (`runUntilResultOnSimClock` in `tests/helpers/sandPlay.ts`, fails at T+4 h of game time with no result). New unit proofs in `hormuzThreat.test.ts`: the defeat and both wins hold however a slow machine delivers frames.
**Item 2, the two OSINT overlap reds (real overlap, fixed in the layout):** on `/map` the label layout read facility symbols from the renderer and re-solved only at MapLibre's `idle`, which waits for every base-map tile; after the zoom to Qeshm the Khalij Fars plate lay on the Qeshm airport symbol until then. `src/lib/map/mapLayout.ts` now takes facility symbols from the data from z9, and `LayoutController.tsx` re-solves after a pan and when the drawn symbols change. New hermetic spec `tests/sand-osint-1-overlap-map-loading.spec.ts`, unit `unit/map-layout-facilities.test.ts`. No /play styling touched.
**Report:** `docs/lane-reports/SAND-THREAT-FIX3-REPORT.md`; receipts in `docs/verification/sand-threat-fix3-t486/`.
**Next:** the seat's end review and the land battery on a real-GPU host that can reach the tile server (the original `/map` and plot zero-overlap specs cannot run in the cloud container). Not merged, not deployed.
