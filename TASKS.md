# Sandkasten — Task Breakdown

Derived from GDD.md Section 12 (Development Phases). Each phase broken into concrete implementation tasks. Tasks marked with priority within phase.

---

## Phase 1: Foundation

### 1.1 Project Scaffold
- [x] Initialize Next.js project with TypeScript and Tailwind
- [x] Set up project directory structure per GDD Section 11
- [x] Configure ESLint, tsconfig
- [x] Add core dependencies: MapLibre GL JS, milsymbol
- [x] Set up git repo structure (.gitignore for data/, node_modules/, etc.)

### 1.2 Platform Database Integration
- [x] Design TypeScript types/interfaces from extracted JSON schema
- [x] Build platform lookup service (load ships/aircraft/weapons/sensors by ID)
- [x] Build enum resolver (convert enum IDs to human-readable strings)
- [x] Select MVP platform subset (~20 platforms for Persian Gulf scenario)
- [x] Create platform detail view component (click unit → see specs)

### 1.3 Map & Unit Rendering
- [x] Port MapLibre GL JS setup from Auftragstaktik (dark tactical basemap)
- [x] Implement milsymbol NATO symbol rendering for units on map
- [x] Render unit icons with correct affiliation (friendly/hostile/neutral)
- [x] Unit selection (click to select, show info panel)
- [x] Range ring rendering for sensors and weapons
- [ ] Measurement tools (distance, bearing between points)

### 1.4 Scenario Editor (Basic)
- [x] Create/load/save scenario JSON files matching GDD Section 7.1 format
- [x] Place units on map (click to place)
- [x] Assign units to sides (player/OPFOR)
- [x] Set unit properties (platform type, name)
- [ ] Drag to move placed units
- [ ] Define reference points (point and area types)
- [x] Set basic scenario metadata (name, description, briefing, start time, theater bounds)

---

## Phase 2: Simulation Core

### 2.1 Game State & Time
- [x] Define game state data structure (units, contacts, time, score)
- [x] Implement simulation clock (start time, elapsed time, current sim time)
- [x] Time controls UI: play/pause button, speed selector (1x-60x)
- [ ] Autopause system with configurable triggers (new contact, unit attacked, etc.)
- [ ] Game state serialization (save/load mid-game)

### 2.2 Movement
- [x] Waypoint system: place waypoints on map, assign to units
- [x] Unit movement along waypoint paths at set speed
- [x] Speed/throttle selection per unit (loiter, cruise, full, flank)
- [ ] Fuel consumption based on speed profile from platform data
- [x] Heading interpolation and turn radius
- [ ] Aircraft altitude changes and altitude-based speed profiles

### 2.3 Sensor & Detection Model
- [x] Implement radar detection check (range, RCS, probability curve)
- [x] ESM detection (detect emitters, bearing only, no range)
- [x] Visual/IR detection (range-based, affected by target signature)
- [x] Detection probability formula: base_prob × (1 - range/maxRange) × signature_modifier
- [x] Contact creation on successful detection roll

### 2.4 Contact & Classification System
- [x] Contact states: Unknown → Detected → Classified → Tracked
- [x] Position uncertainty circles (larger for worse sensor data)
- [x] Multi-sensor fusion (radar + ESM improves classification speed)
- [x] Contact list UI panel (sorted by threat level)
- [x] Contact aging (lose track if no sensor updates)

### 2.5 Fog of War
- [x] Player sees only own units + detected contacts
- [x] Undetected OPFOR units hidden from rendering
- [ ] Sensor coverage visualization (optional overlay showing radar arcs/ranges)
- [ ] "God mode" toggle for scenario testing (see everything)

---

## Phase 3: OPFOR AI

### 3.1 Doctrine System
- [x] Implement doctrine data structure (ROE, engagement range, radar usage, evasion, withdraw, BVR/WVR)
- [x] Doctrine cascade: side default → mission override → unit override
- [x] AI units follow doctrine rules for engagement and sensor decisions

### 3.2 Mission System
- [x] Mission data structure (type, reference area, prosecution range, assigned units)
- [x] Patrol: cycle through waypoints in reference area, prosecute contacts per doctrine
- [x] Strike: proceed to target, attack, return to base/orbit
- [x] CAP: racetrack orbit, intercept hostiles entering prosecution range
- [x] Escort: station-keeping near assigned unit
- [x] Transit: move from A to B, minimize engagement
- [x] Support: orbit assigned area

### 3.3 TCA Event System
- [x] Event data structure (name, triggers, conditions, actions, repeatable flag)
- [x] Implement trigger checks: ScenarioLoaded, Time, TimeInterval, UnitDetected, UnitDestroyed, UnitDamaged, UnitEntersArea, UnitLeavesArea, SideScore
- [x] Implement conditions: SideIs, RandomChance, EventHasFired, EventHasNotFired, UnitCountInArea
- [x] Implement actions: DisplayMessage, SpawnUnit, DestroyUnit, ChangeDoctrine, ChangeScore, EndScenario, TriggerEvent
- [x] Event evaluation loop integrated into simulation tick
- [x] Victory/defeat condition evaluation with scenario result overlay

### 3.4 Integration
- [x] AI controller wired into simulation engine (runs on detection cadence)
- [x] Demo scenario scripted with 4 missions, side doctrine, 6 TCA events
- [x] Message log UI with unread badge, timestamp, click-to-read
- [x] Score display in header
- [x] Scenario result overlay (victory/defeat/draw with replay)

---

## Phase 4: Combat

### 4.1 Weapons Engagement
- [ ] Weapon selection logic (choose best weapon for target type using WRA data)
- [ ] Salvo sizing from WRA (weaponQty vs. target's missileDefense value)
- [ ] Launch decision based on ROE and engagement range doctrine
- [ ] Weapon entity creation on launch (missile in flight)
- [ ] Missile flight path toward target (speed from weapon propulsion data)

### 4.2 Anti-Ship Missile Combat
- [ ] ASM flight model (cruise altitude, terminal pop-up or sea-skim)
- [ ] ASM seeker activation (active radar seeker at terminal range)
- [ ] Target PK roll using weapon's SurfacePoK
- [ ] Miss/hit resolution

### 4.3 SAM Defense
- [ ] SAM engagement of incoming missiles and aircraft
- [ ] Illumination requirement (SPG-62 style fire control radar)
- [ ] SAM intercept PK roll using weapon's AirPoK
- [ ] Multiple engagement capability (how many simultaneous targets)

### 4.4 Countermeasures
- [ ] Chaff deployment (reduce incoming missile PK)
- [ ] ECM (reduce radar detection probability, pokReduction from sensor data)
- [ ] CIWS last-ditch defense (autonomous mount engagement)
- [ ] Decoy systems (towed decoys, expendables)

### 4.5 Damage Model
- [ ] Damage points system (warhead damage vs. platform HP)
- [ ] Damage states: Undamaged → Damaged → Mission Kill → Destroyed
- [ ] Damaged: speed/sensor/weapon degradation
- [ ] Mission Kill: combat ineffective but afloat
- [ ] Destroyed: unit removed
- [ ] Aircraft: generally one-hit kills (low damage points)

---

## Phase 5: WeGo Multiplayer

### 5.1 Networking
- [ ] WebSocket server for game state synchronization
- [ ] Client-server protocol (orders submission, state updates)
- [ ] Server-side game state (authoritative)
- [ ] Server-side fog of war enforcement

### 5.2 Turn System
- [ ] WeGo turn structure: planning → resolution → review
- [ ] Turn timer (configurable per scenario)
- [ ] Order submission and locking
- [ ] Resolution playback animation

### 5.3 Lobby
- [ ] Create game (select scenario, settings)
- [ ] Join game browser
- [ ] Invite by link/code
- [ ] Spectator mode (delayed, sees both sides)

---

## Phase 6: Polish + Community

### 6.1 Auftragstaktik Integration
- [ ] Import real-world OSINT snapshots as scenario starting positions
- [ ] Match OSINT unit types to platform database entries
- [ ] Auto-generate two sides from faction data
- [ ] Review/adjust UI before starting generated scenario

### 6.2 Community Features
- [ ] Community scenario sharing (upload/download/rate)
- [ ] Scenario tags (era, region, scale, difficulty)
- [ ] Community platform database contributions (PR-based or in-app editor)

### 6.3 Audio
- [ ] Source public domain sound effects (freesound.org, OpenGameArt)
- [ ] Radar ping on new contact detection
- [ ] Missile launch / weapon fire
- [ ] Explosion / impact
- [ ] Warning buzzer (unit under attack, autopause trigger)
- [ ] UI interaction sounds (clicks, button feedback)
- [ ] Ambient background (optional — ocean, radio chatter)

### 6.4 Expanded Content
- [ ] Submarine warfare (thermal layers, sprint-and-drift, dipping sonar)
- [ ] Ground units and ground warfare
- [ ] Electronic warfare (EMCON, communications jamming)
- [ ] Campaign mode (linked scenarios with persistent forces)
- [ ] Cold War database (CWDB) extraction and integration

---

## Completed

- [x] **Session 0**: Project conception, GDD draft, session notes
- [x] **Session 1**: GDD refinement (single-player primary, TCA scripting system, CMO-style missions/doctrine)
- [x] **Session 1**: CMO database exploration (174 tables, full schema mapping)
- [x] **Session 1**: DB extraction spec (`DB_EXTRACTION_SPEC.md`)
- [x] **Session 1**: Extraction script (`scripts/extract_cmo_db.py`) — 60k+ records extracted
- [x] **Session 1**: Phase 1 scaffold (map, symbols, demo scenario, theme toggle, range ring pinning)
- [x] **Session 1**: Platform database integration (TypeScript types, API route, enum resolver)
- [x] **Session 1**: Scenario editor (place units, save/load JSON, scenario settings)
- [x] **Session 1**: Detail panel with tabbed Info/Sensors/Weapons view
- [x] **Session 1**: Phase 2 simulation core (movement, detection, contacts, fog of war, time controls)
- [x] **Session 2**: Phase 3 OPFOR AI (doctrine, missions, TCA events, AI controller, demo scenario scripting)
