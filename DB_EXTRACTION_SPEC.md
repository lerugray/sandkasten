# CMO Database Extraction Spec

Source: `C:\Program Files (x86)\Steam\steamapps\common\Command - Modern Operations\DB\DB3K_512.db3`
Format: SQLite (174 tables, junction tables use ID + ComponentID pattern)

This document defines what we extract now (MVP), what we extract but store raw for later, and what we skip. The goal is to never re-explore the database schema from scratch.

---

## Database Overview

| Table | Records | MVP? | Notes |
|-------|---------|------|-------|
| DataShip | 4,867 | Yes | Surface vessels |
| DataAircraft | 7,479 | Yes | Fixed-wing, helo, UAV |
| DataSubmarine | 745 | Deferred | Not in naval MVP |
| DataFacility | 4,563 | Deferred | Airbases, SAM sites, buildings |
| DataGroundUnit | 465 | Deferred | Army units |
| DataSatellite | ? | Deferred | Orbital assets |
| DataWeapon | 4,419 | Yes | Missiles, guns, bombs, torpedoes |
| DataSensor | 7,227 | Yes | Radar, ESM, sonar, IR, visual |
| DataMount | 4,115 | Yes | Weapon launchers/turrets |
| DataWarhead | 1,357 | Yes | Warhead specs |
| DataLoadout | 33,786 | Yes | Aircraft weapon configs |
| DataPropulsion | varies | Yes | Engine specs + speed profiles |
| DataFuel | varies | Yes | Fuel capacity |
| DataMagazine | varies | Deferred | Ammo storage detail |
| DataComm | varies | Deferred | Datalinks, SATCOM |
| DataDockingFacility | varies | Deferred | Ship docking/landing craft |
| DataAircraftFacility | varies | Deferred | Hangars, runways, catapults |
| DataContainer | varies | Deferred | Cargo containers |
| DataWeaponWRA | 25,042 | Yes | Weapon release authority rules |

---

## MVP Extraction (Phase 1)

### Global Filters
- `Deprecated = 0` (exclude deprecated entries)
- `Hypothetical = 0` (exclude hypothetical entries)
- All countries, all years (DB3K is already 1980+)

### Output Structure
```
data/
├── extraction/
│   ├── ships.json
│   ├── aircraft.json
│   ├── weapons.json
│   ├── sensors.json
│   ├── loadouts.json
│   ├── mounts.json
│   └── enums/
│       ├── countries.json
│       ├── services.json
│       ├── ship-types.json
│       ├── aircraft-types.json
│       ├── weapon-types.json
│       ├── sensor-types.json
│       ├── sensor-roles.json
│       └── loadout-roles.json
└── raw/                    # Full extraction for future phases
    ├── submarines.json
    ├── facilities.json
    ├── ground-units.json
    ├── comms.json
    ├── magazines.json
    ├── docking-facilities.json
    ├── aircraft-facilities.json
    └── satellites.json
```

---

### Ships (MVP)

**Source tables:** DataShip, DataShipSensors, DataShipMounts, DataShipPropulsion, DataShipFuel, DataShipSignatures, DataShipCodes

**Fields extracted:**
```
{
  id: DataShip.ID,
  name: DataShip.Name,
  category: EnumShipCategory.Description,      // "Surface Combatant"
  type: EnumShipType.Description,               // "DDG - Guided Missile Destroyer"
  country: EnumOperatorCountry.Description,     // "United States"
  service: EnumOperatorService.Description,     // "Navy"
  yearCommissioned: DataShip.YearCommissioned,
  yearDecommissioned: DataShip.YearDecommissioned,

  // Physical
  length: DataShip.Length,                      // meters
  beam: DataShip.Beam,
  draft: DataShip.Draft,
  displacementFull: DataShip.DisplacementFull,  // tons
  crew: DataShip.Crew,

  // Combat
  damagePoints: DataShip.DamagePoints,
  missileDefense: DataShip.MissileDefense,      // drives WRA salvo sizing
  armor: {                                      // per-section armor type IDs
    belt: DataShip.ArmorBelt,
    deck: DataShip.ArmorDeck,
    cic: DataShip.ArmorCIC,
    bridge: DataShip.ArmorBridge,
    engineering: DataShip.ArmorEngineering,
    rudder: DataShip.ArmorRudder,
    bulkheads: DataShip.ArmorBulkheads,
  },
  opioda: {
    detection: DataShip.OODADetectionCycle,      // seconds
    targeting: DataShip.OODATargetingCycle,
    evasion: DataShip.OODAEvasiveCycle,
  },
  ergonomics: EnumErgonomics.Description,       // "Average", "Good", etc.

  // Performance
  propulsion: [{                                // via DataShipPropulsion → DataPropulsion
    name: DataPropulsion.Name,                  // "4x GE LM-2500 Gas Turbines, COGAG"
    type: EnumPropulsionType.Description,
    speedProfile: [{                            // via DataPropulsionPerformance
      throttle: number,                         // 1=loiter, 2=cruise, 3=full, 4=flank
      speed: number,                            // knots
      consumption: number,                      // fuel units/hour
    }],
  }],
  fuel: [{                                      // via DataShipFuel → DataFuel
    type: EnumFuelType.Description,
    capacity: number,
  }],

  // Sensors (IDs referencing sensors.json)
  sensorIds: number[],

  // Weapons (mount IDs referencing mounts.json)
  mountIds: number[],

  // Signatures (directional, all 11 types)
  signatures: [{
    type: string,                               // "Radar, E-M Band (2-100 GHz)"
    front: number,
    side: number,
    rear: number,
    top: number,                                // ships have top, weapons have 3 (no top)
  }],
}
```

**Simplifications for game use (applied later, not during extraction):**
- Armor sections → single armor rating (max or weighted)
- Signatures → can average directional values for simpler detection model
- Speed profile → derive maxSpeed, cruiseSpeed from throttle 4 and throttle 2

---

### Aircraft (MVP)

**Source tables:** DataAircraft, DataAircraftSensors, DataAircraftMounts, DataAircraftPropulsion, DataAircraftFuel, DataAircraftSignatures, DataAircraftLoadouts, DataAircraftCodes

**Fields extracted:**
```
{
  id, name, category, type, country, service,
  yearCommissioned, yearDecommissioned,

  // Physical
  length: DataAircraft.Length,
  span: DataAircraft.Span,
  weightEmpty: DataAircraft.WeightEmpty,        // kg
  weightMax: DataAircraft.WeightMax,
  crew: DataAircraft.Crew,
  physicalSize: EnumAircraftPhysicalSize.Description,

  // Performance
  agility: DataAircraft.Agility,                // 1.0-5.0+ scale
  climbRate: DataAircraft.ClimbRate,
  endurance: DataAircraft.TotalEndurance,        // minutes
  cockpitGen: EnumAircraftCockpitGen.Description,
  runwayLength: EnumRunwayLength.Description,

  // Combat
  damagePoints: DataAircraft.DamagePoints,
  ooda: { detection, targeting, evasion },
  armor: {
    engine: DataAircraft.AircraftEngineArmor,
    fuselage: DataAircraft.AircraftFuselageArmor,
    cockpit: DataAircraft.AircraftCockpitArmor,
  },

  // Propulsion (altitude-banded speed profiles)
  propulsion: [{
    name, type,
    thrustMilitary: DataPropulsion.ThrustPerEngineMilitary,
    thrustAfterburner: DataPropulsion.ThrustPerEngineAfterburner,
    speedProfile: [{
      altitudeBand: number,                     // 1-4
      altitudeMin: number,                      // feet
      altitudeMax: number,
      throttle: number,                         // 1-4
      speed: number,                            // knots
      consumption: number,
    }],
  }],
  fuel: [{ type, capacity }],

  // Sensors, mounts (by ID)
  sensorIds: number[],
  mountIds: number[],

  // Loadouts (IDs referencing loadouts.json)
  loadoutIds: number[],

  // Signatures (directional, all types)
  signatures: [{ type, front, side, rear, top }],
}
```

---

### Weapons (MVP)

**Source tables:** DataWeapon, DataWeaponTargets, DataWeaponWarheads, DataWeaponSensors, DataWeaponPropulsion, DataWeaponSignatures, DataWeaponWRA, DataWeaponCodes

**Fields extracted:**
```
{
  id, name,
  type: EnumWeaponType.Description,             // "Guided Weapon", "Torpedo", "Gun", etc.
  generation: EnumWeaponGeneration.Description,

  // Physical
  length, span, diameter, weight,

  // Performance
  cruiseAltitude: DataWeapon.CruiseAltitude,    // meters
  maxFlightTime: DataWeapon.MaxFlightTime,      // seconds
  climbRate: DataWeapon.ClimbRate,
  waypointNumber: DataWeapon.WaypointNumber,    // how many waypoints weapon can follow

  // Lethality per domain
  pk: {
    air: DataWeapon.AirPoK,                     // 0-100
    surface: DataWeapon.SurfacePoK,
    land: DataWeapon.LandPoK,
    subsurface: DataWeapon.SubsurfacePoK,
  },
  cep: DataWeapon.CEP,                          // meters
  cepSurface: DataWeapon.CEPSurface,

  // Range per domain (nautical miles)
  range: {
    air: { min: number, max: number },
    surface: { min: number, max: number },
    land: { min: number, max: number },
    subsurface: { min: number, max: number },
  },

  // Launch constraints
  launch: {
    speedMin: number, speedMax: number,         // knots
    altitudeMin: number, altitudeMax: number,    // feet
  },
  // Target constraints
  target: {
    speedMin: number, speedMax: number,
    altitudeMin: number, altitudeMax: number,
  },

  // Torpedo-specific
  torpedo: {
    speedCruise: number, rangeCruise: number,
    speedFull: number, rangeFull: number,
  },

  // Seeker sensors (IDs referencing sensors.json)
  seekerSensorIds: number[],

  // Warhead
  warhead: {
    id: number,
    name: string,
    type: string,                               // EnumWarheadType
    damagePoints: number,
    explosivesType: string,                     // EnumWarheadExplosivesType
    explosivesWeight: number,                   // kg
    numberOfWarheads: number,
  },

  // Valid targets
  validTargets: string[],                       // ["Surface Vessel", "Land Structure - Soft", ...]

  // WRA (weapon release authority)
  wra: [{
    targetType: string,                         // EnumWeaponWRA description
    weaponQty: number,                          // how many to fire (-2 = use target's missile defense value, etc.)
    shooterQty: number,                         // how many units coordinate
    autoFireRange: number,                      // % of max range, or -99 for max
    selfDefenseRange: number,                   // nautical miles, 0 = don't use in self defense
  }],

  // Propulsion
  propulsion: [{ name, type, speedProfile }],

  // Signatures (3 directional: front/side/rear)
  signatures: [{ type, front, side, rear }],
}
```

---

### Sensors (MVP)

**Source tables:** DataSensor, DataSensorCapabilities, DataSensorCodes, DataSensorFrequencySearchAndTrack, DataSensorFrequencyIlluminate

**Fields extracted:**
```
{
  id, name,
  type: EnumSensorType.Description,             // "Radar", "ESM", "Hull Sonar", etc.
  role: EnumSensorRole.Description,             // "Radar, FCR, Surface-to-Air, Long-Range"
  generation: EnumSensorGeneration.Description, // "Early 1990s"

  // Range
  rangeMin: number,                             // nm
  rangeMax: number,
  altitudeMin: number, altitudeMax: number,     // feet

  // Performance
  scanInterval: number,                         // seconds
  maxContacts: {
    air: number,
    surface: number,
    submarine: number,
    illuminate: number,
  },
  resolution: {
    range: number,                              // nm
    height: number,                             // feet
    angle: number,                              // degrees
  },
  availability: number,                         // percent

  // Capabilities
  capabilities: string[],                       // ["Air Search", "Surface Search", "Range Information", ...]

  // Radar-specific
  radar: {
    horizontalBeamwidth: number,
    verticalBeamwidth: number,
    systemNoiseLevel: number,
    processingGainLoss: number,
    peakPower: number,                          // watts
    pulseWidth: number,                         // microseconds
    blindTime: number,
    prf: number,                                // pulse repetition frequency
  },

  // ESM-specific
  esm: {
    sensitivity: number,
    systemLoss: number,
    numberOfChannels: number,
    preciseEmitterID: boolean,
  },

  // ECM-specific
  ecm: {
    gain: number,
    peakPower: number,
    bandwidth: number,
    numberOfTargets: number,
    pokReduction: number,                       // how much it reduces enemy weapon PK
  },

  // Sonar-specific
  sonar: {
    sourceLevel: number,
    pulseLength: number,
    directivityIndex: number,
    recognitionDifferentialActive: number,
    recognitionDifferentialPassive: number,
    towLength: number,
    minDeploymentDepth: number,
    maxDeploymentDepth: number,
    czNumber: number,                           // convergence zone number
  },

  // Visual/IR
  visual: {
    detectionZoomLevel: number,
    classificationZoomLevel: number,
  },
  ir: {
    detectionZoomLevel: number,
    classificationZoomLevel: number,
  },

  // Minimum detectable signatures
  minimumSignature: {
    radar: number,
    visual: number,
    ir: number,
    esm: number,
    activeSonar: number,
    passiveSonar: number,
  },

  // Frequencies
  frequencySearchTrack: number[],               // EnumSensorFrequency IDs
  frequencyIlluminate: number[],
}
```

---

### Mounts (MVP)

**Source tables:** DataMount, DataMountWeapons, DataMountSensors

**Fields extracted:**
```
{
  id, name,
  rof: number,                                 // rate of fire (rounds/minute)
  capacity: number,                             // ready rounds
  magazineROF: number,                          // reload rate from magazine
  magazineCapacity: number,
  damagePoints: number,
  armorGeneral: number,
  trainable: boolean,                           // can it rotate?
  autonomous: boolean,                          // can it fire independently (CIWS)?

  // Weapons this mount can fire (IDs referencing weapons.json)
  weaponIds: number[],

  // Sensors on this mount (fire control radars, etc.)
  sensorIds: number[],
}
```

---

### Loadouts (MVP)

**Source tables:** DataLoadout, DataLoadoutWeapons

**Fields extracted:**
```
{
  id, name,
  role: EnumLoadoutRole.Description,            // "Air Superiority, BVR AAMs"
  readyTime: number,                            // seconds to arm
  combatRadius: number,                         // nm
  timeOnStation: number,                        // minutes
  missionProfile: EnumLoadoutMissionProfile.Description,

  // Weapons in this loadout (IDs referencing weapons.json)
  weaponIds: number[],
}
```

---

## Deferred Extraction (Future Phases)

These are extracted to `data/raw/` as complete dumps — all fields, minimal transformation. This way we have the data available without re-exploring the schema.

### Submarines (Phase: Post-MVP)
**Why deferred:** Sub warfare adds thermal layers, sprint-and-drift, dipping sonar — a whole subsystem.
**Source tables:** DataSubmarine + all junction tables (Sensors, Mounts, Propulsion, Fuel, Signatures, Comms, Magazines, DockingFacilities, AircraftFacilities, Codes)
**Key fields to preserve:** MaxDepth, ROVRadius, all sonar-related signatures
**Extract:** Full records, same format as ships but with sub-specific fields.

### Facilities (Phase: Ground Warfare)
**Why deferred:** Facilities are airbases, SAM sites, radar installations, bunkers — need ground warfare.
**Source tables:** DataFacility + junction tables (Sensors, Mounts, Magazines, AircraftFacilities, DockingFacilities, Comms, Signatures, Fuel)
**Key fields to preserve:** Category (runway, building, structure), Area, MastHeight, Radius, MountsAreAimpoints
**Note:** SAM sites and radar installations will be needed before full ground warfare — could promote these earlier.

### Ground Units (Phase: Ground Warfare)
**Why deferred:** Army-level combined arms combat.
**Source tables:** DataGroundUnit + junction tables
**Key fields to preserve:** Category (infantry, armor, artillery, SAM, etc.), Self_Cargo fields, Tow_Mass, Setup time

### Communications (Phase: Electronic Warfare / Multiplayer)
**Why deferred:** Datalinks (Link 16, CEC) affect cooperative engagement — complex system.
**Source tables:** DataComm, DataCommCapabilities, DataCommDirectors, DataCommType, DataCommTypeCanTalkTo
**Key fields to preserve:** Link types and which links can talk to which, weapon link requirements
**Note:** CEC (Cooperative Engagement Capability) is what lets one ship use another's radar to guide missiles — a major feature in advanced scenarios.

### Magazines (Phase: Logistics)
**Why deferred:** Detailed ammo management (which weapons can be stored where, reload from magazine to mount).
**Source tables:** DataMagazine, DataMagazineWeapons, DataShipMagazines
**Key fields to preserve:** Capacity, ROF (reload rate), AviationMagazine flag, allowed weapon types
**Note:** Relevant when we model running out of specific missile types mid-scenario.

### Docking Facilities (Phase: Amphibious Ops)
**Why deferred:** Landing craft, well decks, docking bays.
**Source tables:** DataDockingFacility, DataShipDockingFacilities, DataFacilityDockingFacilities
**Key fields to preserve:** Type (pier, dock, davit), PhysicalSize, Capacity
**Note:** Needed for amphibious assault scenarios — LCAC launches, troop landings.

### Aircraft Facilities (Phase: Carrier Ops / Ground Warfare)
**Why deferred:** Hangars, runways, catapults, elevators, parking.
**Source tables:** DataAircraftFacility, DataShipAircraftFacilities, DataFacilityAircraftFacilities
**Key fields to preserve:** Type (runway, catapult, ski jump, arresting gear, hangar, pad), Capacity, RunwayLength, PhysicalSize
**Note:** Partially needed for carrier ops (catapult count limits launch rate). Could promote carrier-specific data earlier.

### Satellites (Phase: Strategic)
**Why deferred:** Orbital reconnaissance, missile warning — strategic layer.
**Source tables:** DataSatellite, DataSatelliteOrbits, etc.
**Note:** Would be cool for OSINT integration — track real satellite passes.

### Descriptions (Informational)
**Location:** `DB/Descriptions/DB3000/` — text files named `Ship_111.txt`, `Aircraft_342.txt`, etc.
**Content:** Wikipedia-sourced overviews of each platform.
**Extract:** Bulk copy to `data/descriptions/` keyed by platform type and ID.
**Use:** Display in unit info panel, scenario editor tooltips.

### Images
**Location:** `DB/Images/DB3000/`
**Note:** Check format and licensing. May not be redistributable.

---

## Enum Tables to Extract

All enum tables should be extracted to `data/extraction/enums/` as simple ID → description mappings. These are needed to resolve the integer foreign keys in the platform data.

| Enum Table | Used By | Priority |
|------------|---------|----------|
| EnumOperatorCountry | All platforms | MVP |
| EnumOperatorService | All platforms | MVP |
| EnumShipCategory | Ships | MVP |
| EnumShipType | Ships | MVP |
| EnumAircraftCategory | Aircraft | MVP |
| EnumAircraftType | Aircraft | MVP |
| EnumWeaponType | Weapons | MVP |
| EnumWeaponTarget | Weapons | MVP |
| EnumSensorType | Sensors | MVP |
| EnumSensorRole | Sensors | MVP |
| EnumSensorGeneration | Sensors | MVP |
| EnumSensorCapability | Sensors | MVP |
| EnumSensorFrequency | Sensors | MVP |
| EnumLoadoutRole | Loadouts | MVP |
| EnumLoadoutMissionProfile | Loadouts | MVP |
| EnumPropulsionType | Propulsion | MVP |
| EnumPropulsionCombinedType | Propulsion | MVP |
| EnumFuelType | Fuel | MVP |
| EnumWarheadType | Warheads | MVP |
| EnumWarheadExplosivesType | Warheads | MVP |
| EnumArmorType | Ships, Aircraft | MVP |
| EnumErgonomics | All platforms | MVP |
| EnumShipPhysicalSize | Ships | MVP |
| EnumAircraftPhysicalSize | Aircraft | MVP |
| EnumWeaponWRA | WRA | MVP |
| EnumWeaponWRAWeaponQty | WRA | MVP |
| EnumWeaponWRAShooterQty | WRA | MVP |
| EnumWeaponWRAAutoFireRange | WRA | MVP |
| EnumWeaponWRASelfDefenceRange | WRA | MVP |
| EnumWeaponGeneration | Weapons | MVP |
| EnumSubmarineCategory | Submarines | Deferred |
| EnumSubmarineType | Submarines | Deferred |
| EnumFacilityCategory | Facilities | Deferred |
| EnumFacilityType | Facilities | Deferred |
| EnumGroundUnitCategory | Ground Units | Deferred |
| EnumAircraftFacilityType | Aircraft Facilities | Deferred |
| EnumDockingFacilityType | Docking | Deferred |
| EnumCommType | Comms | Deferred |

---

## Schema Notes & Gotchas

### Junction Table Pattern
All platform-to-component relationships use the same pattern:
- `Data{Platform}{Component}` table with columns: `ID` (platform ID), `ComponentNumber` (slot), `ComponentID` (component ID)
- Example: `DataShipSensors(ID=111, ComponentNumber=1, ComponentID=1594)` means ship 111 has sensor 1594 in slot 1

### WRA Target Codes
WeaponQty uses special negative values:
- `-99` = use all weapons
- `-2` = use target's MissileDefense value
- `-3` = 2x MissileDefense
- `-4` = 4x MissileDefense
- `-5` = 0.5x MissileDefense (heavy supersonic weapons)
- `-6` = 0.25x MissileDefense
- `0` = do not use against this target

### Signature Values
- Ships/Aircraft: 4 directional (front, side, rear, top)
- Weapons: 3 directional (front, side, rear — no top)
- Acoustic signatures are in dB
- Radar signatures are in dBsm (radar cross section)
- Visual/IR are detection/classification ranges in nm

### Speed Profile Throttle Values
- 1 = loiter/creep
- 2 = cruise
- 3 = full
- 4 = flank/afterburner

### Altitude Bands (Aircraft)
- Band 1: 0 - ~12,000 ft
- Band 2: ~12,000 - ~24,000 ft
- Band 3: ~24,000 - ~36,000 ft
- Band 4: ~36,000 - ~45,000 ft
(exact values vary per aircraft propulsion entry)

### OODA Cycle
Reaction time in seconds for:
- Detection: how long to notice a new contact
- Targeting: how long to generate a firing solution
- Evasion: how long to begin evasive maneuvers
Lower = better. Modified by Ergonomics enum (Awful: +20/+30/+15, Excellent: -20/-30/-15).

### Ergonomics Modifiers
| Level | Detection | Targeting | Evasion |
|-------|-----------|-----------|---------|
| Awful | +20 | +30 | +15 |
| Poor | +10 | +15 | +5 |
| Average | 0 | 0 | 0 |
| Good | -10 | -15 | -5 |
| Excellent | -20 | -30 | -15 |

---

## Extraction Script Requirements

- Language: Python (sqlite3 + json standard library)
- Input: DB3K_512.db3 path (configurable)
- Output: JSON files to `data/extraction/` and `data/raw/`
- Resolve all enum foreign keys to human-readable strings
- Filter: Deprecated=0, Hypothetical=0
- Include a metadata header in each JSON file: source DB version, extraction date, record count
- Deferred tables: dump as raw records with column names, no transformation
- MVP tables: full relational resolution (join platforms to sensors, weapons, etc.)
