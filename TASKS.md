# Sandkasten — Task Breakdown

Derived from GDD.md Section 12 (Development Phases). Each phase broken into concrete implementation tasks. Tasks marked with priority within phase.

---

## Phase 1: Foundation

### 1.1 Project Scaffold
- [ ] Initialize Next.js project with TypeScript and Tailwind
- [ ] Set up project directory structure per GDD Section 11
- [ ] Configure ESLint, Prettier, tsconfig
- [ ] Add core dependencies: MapLibre GL JS, milsymbol
- [ ] Set up git repo structure (.gitignore for data/, node_modules/, etc.)

### 1.2 Platform Database Integration
- [ ] Design TypeScript types/interfaces from extracted JSON schema
- [ ] Build platform lookup service (load ships/aircraft/weapons/sensors by ID)
- [ ] Build enum resolver (convert enum IDs to human-readable strings)
- [ ] Select MVP platform subset (~20 platforms for Persian Gulf scenario)
- [ ] Create platform detail view component (click unit → see specs)

### 1.3 Map & Unit Rendering
- [ ] Port MapLibre GL JS setup from Auftragstaktik (dark tactical basemap)
- [ ] Implement milsymbol NATO symbol rendering for units on map
- [ ] Render unit icons with correct affiliation (friendly/hostile/neutral)
- [ ] Unit selection (click to select, show info panel)
- [ ] Range ring rendering for sensors and weapons
- [ ] Measurement tools (distance, bearing between points)

### 1.4 Scenario Editor (Basic)
- [ ] Create/load/save scenario JSON files matching GDD Section 7.1 format
- [ ] Place units on map (click to place, drag to move)
- [ ] Assign units to sides (player/OPFOR)
- [ ] Set unit properties (platform type, name, heading)
- [ ] Define reference points (point and area types)
- [ ] Set basic scenario metadata (name, description, briefing, start time, theater bounds)

---

## Phase 2: Simulation Core

### 2.1 Game State & Time
- [ ] Define game state data structure (units, contacts, time, score)
- [ ] Implement simulation clock (start time, elapsed time, current sim time)
- [ ] Time controls UI: play/pause button, speed selector (1x-60x)
- [ ] Autopause system with configurable triggers (new contact, unit attacked, etc.)
- [ ] Game state serialization (save/load mid-game)

### 2.2 Movement
- [ ] Waypoint system: place waypoints on map, assign to units
- [ ] Unit movement along waypoint paths at set speed
- [ ] Speed/throttle selection per unit (loiter, cruise, full, flank)
- [ ] Fuel consumption based on speed profile from platform data
- [ ] Heading interpolation and turn radius
- [ ] Aircraft altitude changes and altitude-based speed profiles

### 2.3 Sensor & Detection Model
- [ ] Implement radar detection check (range, RCS, probability curve)
- [ ] ESM detection (detect emitters, bearing only, no range)
- [ ] Visual/IR detection (range-based, affected by target signature)
- [ ] Detection probability formula: base_prob × (1 - range/maxRange) × signature_modifier
- [ ] Contact creation on successful detection roll

### 2.4 Contact & Classification System
- [ ] Contact states: Unknown → Detected → Classified → Tracked
- [ ] Position uncertainty circles (larger for worse sensor data)
- [ ] Multi-sensor fusion (radar + ESM improves classification speed)
- [ ] Contact list UI panel (sorted by threat level)
- [ ] Contact aging (lose track if no sensor updates)

### 2.5 Fog of War
- [ ] Player sees only own units + detected contacts
- [ ] Undetected OPFOR units hidden from rendering
- [ ] Sensor coverage visualization (optional overlay showing radar arcs/ranges)
- [ ] "God mode" toggle for scenario testing (see everything)

---

## Phase 3: OPFOR AI

### 3.1 Doctrine System
- [ ] Implement doctrine data structure (ROE, engagement range, radar usage, evasion, withdraw)
- [ ] Doctrine cascade: side default → mission override → unit override
- [ ] AI units follow doctrine rules for engagement decisions

### 3.2 Mission System
- [ ] Mission data structure (type, reference area, prosecution range, assigned units)
- [ ] Patrol: cycle through waypoints in reference area, engage per doctrine
- [ ] Strike: proceed to target, attack, return to base/orbit
- [ ] CAP: orbit area, intercept hostiles entering prosecution range
- [ ] Escort: stay with assigned unit, engage threats to escorted asset
- [ ] Transit: move from A to B, minimize engagement
- [ ] Support: tanker/AEW station-keeping in assigned area

### 3.3 TCA Event System
- [ ] Event data structure (name, triggers, conditions, actions, repeatable flag)
- [ ] Implement trigger checks: ScenarioLoaded, Time, UnitDetected, UnitDestroyed, UnitEntersArea, etc.
- [ ] Implement conditions: SideIs, UnitTypeIs, UnitCountInArea, RandomChance, EventHasFired
- [ ] Implement actions: DisplayMessage, SpawnUnit, ChangeMission, ChangeDoctrine, ChangeScore, EndScenario
- [ ] Event evaluation loop (check triggers each sim tick)
- [ ] Victory condition evaluation (special events with EndScenario action)

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

### 6.3 Expanded Content
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
