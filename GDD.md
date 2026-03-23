# SANDKASTEN — Game Design Document

*Open-source wargame simulation with real-world OSINT integration*

---

## 1. Concept

A player commands military forces on a continuous tactical map against scripted OPFOR scenarios. The simulation runs in continuous time with pause/play/speed controls — issue orders, unpause, watch events unfold, pause to reassess and reissue orders. Players see only what their sensors detect; everything else is fog of war.

An optional WeGo multiplayer mode allows two players to command opposing forces with simultaneous order submission and turn-based resolution.

The map, symbology, and data architecture come from Auftragstaktik. The simulation engine, platform database, and AI scripting system are new.

---

## 2. Core Loop

### 2.1 Single-Player (Primary Mode)
```
CONTINUOUS SIMULATION with player-controlled time:
  → Pause at any time to issue/modify orders
  → Set simulation speed (1x, 2x, 5x, 10x, 30x, 60x)
  → Autopause triggers: new contact detected, unit under attack,
    weapon impact, mission complete, unit lost

PLAYER ACTIONS (while paused or running):
  → Place waypoints, assign targets, set ROE, manage sensors
  → Launch/recover aircraft, set patrol areas
  → Manage weapon loadouts, assign missions

SIMULATION (continuous):
  → Execute movement along waypoints
  → Run sensor detection checks
  → Resolve weapons engagement
  → Execute OPFOR AI scripts and doctrine
  → Update fog of war
```

### 2.2 WeGo Multiplayer (Future Mode)
```
PLANNING PHASE (both players, simultaneous, timed)
  → Place waypoints, assign targets, set ROE, manage sensors

RESOLUTION PHASE (server-side, automatic)
  → Execute movement along waypoints
  → Run sensor detection checks
  → Resolve weapons engagement
  → Update fog of war for both sides

REVIEW PHASE (both players)
  → Watch resolution playback
  → Assess damage, losses, new contacts
  → Repeat
```

Turn length is configurable per scenario (30 seconds to 1 hour of simulated time per turn).

---

## 3. Units

### 3.1 Unit Types
- **Surface vessels** — carriers, destroyers, frigates, corvettes, patrol boats, auxiliaries
- **Submarines** — attack subs, ballistic missile subs
- **Fixed-wing aircraft** — fighters, bombers, strike, AEW, tankers, patrol, transports
- **Rotary-wing** — attack helicopters, ASW helicopters, transport
- **Ground units** — SAM batteries, radar sites, airbases, ports, ground forces
- **Missiles** — cruise missiles, ballistic missiles, anti-ship missiles (modeled individually in flight)

### 3.2 Platform Database Schema
Each platform entry:
```
{
  id: string,
  name: string,              // "Arleigh Burke-class (Flight IIA)"
  type: "surface" | "sub" | "fixed-wing" | "rotary" | "ground" | "missile",
  nation: string,

  // Performance
  maxSpeed: number,           // knots (ships/subs) or knots (aircraft)
  cruiseSpeed: number,
  maxAltitude?: number,       // feet (aircraft only)
  endurance?: number,         // hours of flight time

  // Sensors (array — unit can have multiple)
  sensors: [{
    type: "radar" | "esm" | "ir" | "sonar" | "visual",
    name: string,             // "AN/SPY-1D"
    rangeKm: number,
    detectionProbability: number,  // base probability at max range
    canTrack: boolean,
    arcDegrees?: number,      // 360 for rotating, less for fixed
  }],

  // Weapons (array)
  weapons: [{
    name: string,             // "RIM-66 Standard SM-2"
    type: "sam" | "asm" | "torpedo" | "gun" | "bomb" | "cruise-missile",
    rangeKm: number,
    quantity: number,
    pkHit: number,            // probability of kill on hit
    reloadTime?: number,      // seconds between shots
  }],

  // Defenses
  countermeasures: [{
    type: "chaff" | "flare" | "ecm" | "decoy" | "ciws",
    effectiveness: number,    // 0-1 probability of defeating incoming
    quantity?: number,
  }],

  // Signatures (how detectable this unit is)
  signatures: {
    radar: number,            // radar cross section (relative, 0-1)
    infrared: number,
    acoustic?: number,        // submarines/ships
    visual: number,
  }
}
```

Community-editable. Submit platform data via pull request or in-app editor.

---

## 4. Detection Model

### 4.1 Sensor Checks
Each turn, for every sensor on every unit:
1. Calculate range to every opposing unit
2. If target is within sensor range, roll detection check:
   - Base probability = sensor.detectionProbability × (1 - range/maxRange)
   - Modify by target signature for that sensor type
   - Modify by weather, terrain masking, altitude differential
   - Modify by target countermeasures (ECM reduces radar detection)
3. If detected: contact appears on map with position uncertainty proportional to sensor quality
4. If tracked (sensor.canTrack): contact position updates each turn with low uncertainty

### 4.2 Contact Classification
- **Unknown** — bearing and rough range only, no ID
- **Detected** — position known, type unknown (shows as generic symbol)
- **Classified** — type identified (shows correct NATO symbol)
- **Tracked** — continuous position updates

Multiple sensor hits on the same target improve classification. Radar + ESM = faster classification than radar alone.

### 4.3 Fog of War
Each player's map shows:
- Own units: full information
- Detected contacts: position with uncertainty circle
- Classified contacts: correct symbol, estimated course/speed
- Everything else: blank map

---

## 5. Combat Resolution

### 5.1 Weapons Engagement Sequence
1. **Launch decision** — player sets ROE (weapons free, weapons tight, weapons hold) or manually assigns targets
2. **Launch phase** — weapon fires, enters flight
3. **Intercept phase** — if target has defensive systems, roll countermeasure checks
4. **Terminal phase** — roll pkHit for weapon against target
5. **Damage assessment** — apply damage, check if target destroyed/mission-killed/damaged

### 5.2 Damage Model
- **Destroyed** — unit removed from play
- **Mission kill** — unit alive but combat-ineffective (sensors/weapons offline)
- **Damaged** — reduced performance (speed, sensor range, weapon count)
- Ships can take multiple hits before sinking. Aircraft are usually one-hit kills.

---

## 6. AI & Scenario Scripting

The scripting system follows CMO's proven architecture: **Missions** control what AI units do, **Doctrine** controls how they do it, and **Events** (Trigger-Condition-Action) script the scenario narrative around them. Both player and AI sides use the same mission/doctrine system — the only difference is who issues orders.

### 6.1 Missions

Units are assigned to named missions. The AI (or player) handles tactical execution. A unit not assigned to any mission follows its side's default doctrine.

**MVP Mission Types:**
| Mission | Behavior |
|---------|----------|
| **Patrol** | Cycle through waypoints in a reference area. Engage contacts per doctrine. |
| **Strike** | Proceed to target area, attack assigned target(s), return to base/orbit point. |
| **CAP** | Orbit a reference area. Intercept hostile contacts that enter prosecution range. |
| **Escort** | Stay with assigned unit/group. Engage threats to the escorted asset. |
| **Transit** | Move from A to B. Minimize engagement unless attacked. |
| **Support** | Provide fuel (tanker), AEW radar coverage, or ASW screen for assigned area. |

**Mission-level settings:**
- Assigned units/groups
- Reference area (one or more reference points defining the patrol zone, strike target area, etc.)
- Prosecution range — how far from the mission area units will chase contacts
- One-time vs. repeating
- Throttle/altitude constraints (e.g., "transit at cruise speed, low altitude")

### 6.2 Doctrine

Doctrine settings govern tactical behavior. They can be set at three levels: **side default → mission override → unit override** (most specific wins).

**MVP Doctrine Settings:**
| Setting | Options | Default |
|---------|---------|---------|
| **ROE** | Weapons free · Weapons tight (self-defense only) · Weapons hold (never fire) | Weapons tight |
| **Engagement range** | Max range · Moderate (50% of max) · Close (25% of max) | Max range |
| **Radar usage** | Active (emitting) · Passive (ESM/visual only) · Mixed (activate on contact) | Active |
| **Evasion** | None · Evasive if attacked · Always evade | Evasive if attacked |
| **Withdraw on damage** | Never · If damaged · If mission-killed | If damaged |
| **BVR/WVR** | Engage beyond visual range · Close to visual range first | BVR |

*CMO has dozens more — these cover the decisions that actually affect gameplay outcomes. More can be added as the simulation deepens.*

### 6.3 Reference Points

Named geographic markers used by missions, events, and triggers. Equivalent to CMO's reference points.

- **Point** — single lat/lng (strike target, orbit center, spawn point)
- **Area** — polygon of 3+ points (patrol zone, no-go area, trigger zone)
- **Bearing/range** — relative to a unit (e.g., "30nm ahead of carrier")

Reference points can belong to a side (visible only to that side) or be scenario-level (used by events). The player can create their own reference points during gameplay.

### 6.4 Events (Trigger-Condition-Action)

Events are the scenario scripting backbone. Each event has a name, one or more triggers, optional conditions, and one or more actions. An event can fire once or repeat.

**Triggers — "when does this event check?"**
| Trigger | Description |
|---------|-------------|
| `ScenarioLoaded` | Fires once at scenario start |
| `Time` | At a specific scenario clock time (e.g., "0800Z") |
| `TimeInterval` | Every N minutes of sim time |
| `UnitDetected` | A unit on side X is detected by side Y |
| `UnitDestroyed` | A specific unit or any unit of type X is destroyed |
| `UnitDamaged` | A unit takes damage |
| `UnitEntersArea` | A unit enters a reference area |
| `UnitLeavesArea` | A unit leaves a reference area |
| `MissionComplete` | All targets of a strike mission destroyed, or patrol time elapsed |
| `SideScore` | Side's score reaches a threshold |

**Conditions — "should this event actually fire?" (optional filters)**
| Condition | Description |
|-----------|-------------|
| `SideIs` | Only if the triggering unit belongs to side X |
| `UnitTypeIs` | Only if the unit is a specific platform type (e.g., "fixed-wing") |
| `UnitCountInArea` | Only if N or more/fewer units of side X are in area Y |
| `RandomChance` | Probability check (e.g., 30% chance to fire) |
| `EventHasFired` | Only if another named event has already occurred |
| `EventHasNotFired` | Only if another named event has NOT occurred |

**Actions — "what happens?"**
| Action | Description |
|--------|-------------|
| `DisplayMessage` | Show briefing/intel message to a side |
| `SpawnUnit` | Create new units at a position or reference point (reinforcements) |
| `DestroyUnit` | Remove a unit from play |
| `ChangeMission` | Reassign units to a different mission |
| `ChangeDoctrine` | Modify doctrine settings for a side, mission, or unit |
| `ChangeROE` | Shortcut to change just the ROE |
| `ChangeScore` | Add/subtract points from a side's score |
| `EndScenario` | End the scenario with a result (victory/defeat/draw) |
| `SetReferencePoint` | Create or move a reference point |
| `TriggerEvent` | Force another event to fire |

**Example event — "Ambush in the Strait":**
```
{
  name: "Ambush in the Strait",
  repeatable: false,
  triggers: [{ type: "UnitEntersArea", area: "Strait of Hormuz", side: "NATO" }],
  conditions: [{ type: "UnitTypeIs", unitType: "surface" }],
  actions: [
    { type: "DisplayMessage", side: "NATO",
      text: "FLASH: Multiple fast-movers detected launching from Bandar Abbas!" },
    { type: "SpawnUnit", side: "Iran", units: [
      { platformId: "c-802-ashore", position: [56.27, 27.18] },
      { platformId: "boghammar", position: [56.30, 26.95], count: 4, mission: "Strike Convoy" }
    ]},
    { type: "ChangeDoctrine", side: "Iran", mission: "Coastal Defense",
      changes: { roe: "weapons-free", radarUsage: "active" }}
  ]
}
```

### 6.5 Victory Conditions

Victory conditions are just events with `EndScenario` actions, but they deserve their own UI treatment so the player knows what they're trying to achieve.

**MVP victory condition types:**
- **Destroy target(s)** — specific named units or all units of a type
- **Protect unit(s)** — keep specific units alive for a duration or until they reach an area
- **Hold area** — maintain presence in a reference area for a duration
- **Survive** — keep a minimum number of units alive until scenario time expires
- **Score threshold** — reach a point total (flexible, works with the `ChangeScore` action)

Scenarios can combine multiple conditions (all required, or any one sufficient).

### 6.6 What We Defer (CMO Has, We Don't Need Yet)
- Lua scripting layer — TCA covers MVP needs without exposing a programming language
- Special actions (cargo, deploy mines, landing operations)
- Communications disruption / EMCON plans
- Detailed magazine management and weapon allocation logic
- Weather fronts and moving weather systems
- Submarine layer doctrine (thermal layers, sprint-and-drift)

---

## 7. Scenario System

### 7.1 Scenario File Format
```
{
  name: string,
  description: string,
  briefing: string,              // player-facing scenario briefing (supports markdown)
  theater: TheaterConfig,        // map bounds, center, zoom
  startTime: string,             // "2026-03-15T06:00:00Z"
  duration: number,              // max scenario length in hours
  weather?: WeatherConfig,

  // Single-player settings
  playerSide: string,            // which side the player controls
  defaultSpeed: number,          // initial time compression (1-60)

  // WeGo settings (optional, for multiplayer)
  turnLengthMinutes?: number,
  maxTurns?: number,

  referencePoints: [{
    id: string,
    name: string,                // "Strait of Hormuz", "Rally Point Alpha"
    type: "point" | "area",
    side?: string,               // null = scenario-level
    points: [[lng, lat], ...],   // single point or polygon vertices
  }],

  sides: [{
    name: string,                // "NATO" / "Iran"
    color: string,
    isAI: boolean,
    doctrine: {                  // side-level defaults
      roe: "weapons-free" | "weapons-tight" | "weapons-hold",
      engagementRange: "max" | "moderate" | "close",
      radarUsage: "active" | "passive" | "mixed",
      evasion: "none" | "if-attacked" | "always",
      withdrawOnDamage: "never" | "damaged" | "mission-killed",
    },
    units: [{
      id: string,               // unique unit ID for event references
      name: string,             // "USS Arleigh Burke"
      platformId: string,       // references platform database
      position: [lng, lat],
      heading: number,
      altitude?: number,
      mission?: string,         // name of assigned mission
      doctrineOverrides?: {},   // unit-level doctrine overrides
    }]
  }],

  missions: [{
    name: string,                // "Patrol Persian Gulf"
    side: string,
    type: "patrol" | "strike" | "cap" | "escort" | "transit" | "support",
    referenceArea?: string,      // reference point ID
    targetUnit?: string,         // for escort: unit ID to protect
    prosecutionRange?: number,   // km — how far to chase contacts
    repeating: boolean,
    doctrineOverrides?: {},      // mission-level doctrine overrides
  }],

  events: [{                     // TCA event scripts
    name: string,
    repeatable: boolean,
    triggers: [Trigger, ...],
    conditions?: [Condition, ...],
    actions: [Action, ...],
  }],
}
```

### 7.2 Real-World Snapshot Import
Pull from Auftragstaktik:
- Current aircraft positions → populate air units (match type codes to platform database)
- Current ship positions → populate naval units
- AD installations → populate ground-based SAM units with correct systems
- Frontline positions → set ground control zones
- Generate two sides based on faction data

User reviews and adjusts the auto-generated scenario before starting.

### 7.3 Community Scenarios
- Upload scenarios to a shared repository
- Browse, download, rate scenarios
- Tags: era, region, scale (tactical/operational/strategic), difficulty

---

## 8. Multiplayer (Future)

### 8.1 Architecture
- WebSocket connection between two players and server
- Server holds authoritative game state
- Players send orders, server validates and resolves
- Fog of war enforced server-side (players never receive data about undetected units)

### 8.2 Turn Flow
1. Server starts planning phase, sends each player their visible game state
2. Both players submit orders within time limit
3. Server resolves turn (movement → detection → combat)
4. Server sends updated visible state to each player
5. Optional: playback animation of resolution phase
6. Repeat

### 8.3 Lobby
- Create game (select scenario, invite opponent)
- Join game (browse open games)
- Spectator mode (see both sides, delayed)

---

## 9. User Interface

### 9.1 Map (from Auftragstaktik)
- MapLibre GL JS with dark tactical basemap
- NATO MIL-STD-2525 symbols for all units
- Range rings for sensors and weapons
- Waypoint drawing tools
- Measurement tools (distance, bearing)

### 9.2 Order Panel
- Click unit → assign orders
- Waypoint mode: click map to add waypoints
- Set speed, altitude, formation
- Set ROE per unit or group
- Assign specific targets from detected contacts

### 9.3 Intel Panel
- Contact list (all detected/classified contacts)
- Sorted by threat level
- Click contact to center map

### 9.4 Time Controls (Single-Player)
- Play / Pause button
- Speed selector: 1x, 2x, 5x, 10x, 30x, 60x
- Autopause settings (configurable triggers)
- Simulated clock display (date/time in scenario timezone)

### 9.5 Turn Controls (WeGo Multiplayer)
- SUBMIT ORDERS button (locks in orders for this turn)
- Status: "Waiting for opponent..." / "Resolving..." / "Review"
- Turn counter, simulated clock
- Playback controls for resolution phase

---

## 10. Minimum Viable Product

**Scenario: Modern naval engagement in the Persian Gulf (single-player)**

Why naval first:
- Fewer unit types (ships, aircraft, missiles)
- No terrain complexity (open water)
- Sensor model is cleaner (radar over water has fewer variables)
- CMO started as Harpoon (naval wargame) for the same reasons

Why single-player first:
- No networking complexity
- AI scripting is needed regardless (OPFOR always needs behavior)
- Matches how most players will use the game (CMO is overwhelmingly single-player)
- WeGo multiplayer can be layered on top of a working single-player engine

MVP scope:
- Single-player vs. scripted OPFOR
- Continuous time with pause/play/speed controls
- 5-10 ship classes, 5 aircraft types, 3-4 missile types
- Basic radar detection model
- Anti-ship missile combat
- SAM defense
- OPFOR with patrol and strike mission scripts
- Scenario editor with save/load
- One bundled tutorial scenario
- No ground units, no submarines, no multiplayer (add later)

---

## 11. Technical Architecture

```
Sandkasten/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── map/                # Shared with Auftragstaktik
│   │   ├── game/               # Game-specific UI (orders, intel, time controls)
│   │   └── editor/             # Scenario editor
│   ├── lib/
│   │   ├── simulation/         # Sim engine, detection, combat resolution
│   │   ├── ai/                 # OPFOR doctrine, mission scripts, triggers
│   │   ├── platforms/          # Platform database
│   │   ├── scenarios/          # Scenario loader/saver
│   │   ├── map/                # Shared map styles
│   │   └── symbols/            # Shared milsymbol rendering
│   └── data/
│       └── platforms/          # JSON platform database files
├── public/
│   └── scenarios/              # Bundled starter scenarios
```

---

## 12. Development Phases

**Phase 1: Foundation**
- Project scaffold (Next.js, shared map components from Auftragstaktik)
- Platform database schema + 15-20 starter platforms
- Scenario editor: place units on map, save/load JSON
- Basic unit rendering with NATO symbols

**Phase 2: Simulation Core**
- Continuous-time simulation loop with pause/play/speed controls
- Waypoint system with unit movement along paths
- Radar detection model with range, probability, RCS
- Fog of war rendering
- Contact classification pipeline

**Phase 3: OPFOR AI**
- Doctrine system (engagement posture, sensor policy, weapon release)
- Mission scripts (patrol, strike, CAP, escort, transit)
- Trigger-based behavior changes
- Scripted events and reinforcements

**Phase 4: Combat**
- Weapons engagement sequence
- Anti-ship missile flight and intercept
- SAM engagement
- Damage model (destroyed/mission-kill/damaged)
- Countermeasures (chaff, ECM, CIWS)

**Phase 5: WeGo Multiplayer**
- WebSocket server for game state
- Lobby system (create/join/spectate)
- Server-side fog of war enforcement
- Turn timer and synchronization
- Resolution playback

**Phase 6: Polish + Community**
- Auftragstaktik snapshot import
- Community scenario sharing
- Expanded platform database (community contributions)
- Submarines, ground units, electronic warfare
- Campaign mode (linked scenarios)
