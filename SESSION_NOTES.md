# Session Notes

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

### Next Steps
- Begin Phase 4: Combat (weapons engagement, missile flight, SAM, damage model, countermeasures)
- See `TASKS.md` for full breakdown

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
