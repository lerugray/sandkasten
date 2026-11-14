# CMO database coverage study (Part B)

STATUS: done 2026-11-14T08:59Z

What this is: the list of content our own platform database has to reach, measured against the database that ships
with Command: Modern Operations. It is a study of WHAT exists there (families, counts, kinds of attributes, platform
names). It carries no CMO value: no range, hit probability, signature, damage figure or description text appears here
or in `study/cmo-db/`. Our values come from public sources (section 5).

**How it was read.** `DB3K_519.db3` (63.6 MB, the newest of the 64 `DB3K_*.db3` files in the install's `DB` folder;
it calls itself the "1980 - 2020+ Database"). Opened in place, read-only (SQLite `mode=ro&immutable=1`: no journal,
no lock file, nothing written beside it). The install was not modified, the game and Steam were not started, and
`scripts/extract_cmo_db.py` was not run. Every number below comes from `study/cmo-db/coverage_queries.py`, which
writes the CSV notes in the same folder; rerun it against the same file to check any figure.

**How to read the counts.**
- One CMO row is one variant of one platform for one operator at one point in time. The Arleigh Burke class is 123
  rows under 20 names; the F-14 family is 69 rows; 117 rows carry the Nimitz name. Row counts overstate real-world
  classes.
- "Names" = distinct display names. "Name + operator" = distinct combinations of name, category, type, nation and
  service. The second is the closest match to how our records work (one record per class per operator), so it is
  the number to plan against.
- "Hypothetical" rows are paper designs and planned fits. They are counted but are not a coverage target.
- CMO records a retirement year on only about 20% of platform rows. "Not marked retired by 2026" therefore means
  "entered service by 2026 and has no retirement year", which still includes battleships and nuclear cruisers. Treat
  it as a ceiling; the real in-service list has to come from a public register (section 5).

## 1. Entity families and counts

The file has 179 tables: 102 data tables (the 14 entity tables below, a few small ones, and the link tables that
join them), 75 lookup tables that name categories, and 2 housekeeping tables.

### 1.1 Top-level families

Platforms (things a scenario places on the map):

| Family | Rows | Hypothetical | Names | Name + operator | Nations | Columns |
|---|---:|---:|---:|---:|---:|---:|
| Ship | 5,295 | 196 | 3,228 | 3,473 | 139 | 46 |
| Submarine | 805 | 23 | 370 | 443 | 65 | 35 |
| Aircraft | 8,188 | 403 | 3,292 | 5,816 | 163 | 39 |
| Facility (fixed sites and the older mobile land units) | 5,535 | 91 | 2,649 | 5,215 | 147 | 27 |
| Ground unit (newer land family: vehicles that can be carried as cargo) | 489 | 10 | 367 | 395 | 24 | 40 |
| Satellite | 320 | 2 | 306 | 320 | 61 | 26 |
| **All platforms** | **20,632** | 725 | | **15,662** | 181 | |

Components (things a platform is built from; they have no nation and no service date):

| Family | Rows | Hypothetical | Deprecated | Names | Columns | What one row is |
|---|---:|---:|---:|---:|---:|---|
| Weapon | 4,645 | 133 | 50 | 4,450 | 60 | A missile, shell type, bomb, torpedo, mine, decoy, pod, tank or cargo item |
| Warhead | 1,419 | 20 | 1 | 1,340 | 13 | The payload a weapon delivers |
| Sensor | 7,554 | 27 | 1 | 6,455 | 78 | A radar, ESM set, jammer, sonar, optic, laser or sweep gear |
| Mount | 4,391 | 31 | 7 | 3,047 | 24 | A launcher, gun, tube, pylon group or dispenser |
| Magazine | 1,821 | 8 | 0 | 823 | 9 | A store of reloads |
| Loadout | 35,440 | 1,979 | 66 | 8,805 | 30 | One mission fit for one aircraft |
| Propulsion | 4,245 | 21 | 0 | 2,505 | 16 | An engine plant; 24,422 speed and fuel-burn points hang off these |
| Comms | 563 | 0 | 0 | 551 | 13 | A radio, datalink, satellite link or weapon guidance link (184 link types) |

Smaller families and rule tables:

| Family | Rows | Note |
|---|---:|---|
| Weapon record | 12,198 | A weapon plus a quantity; mounts, magazines and loadouts all point at these, not at weapons directly |
| Fuel store | 2,212 | Fuel type and amount; 11 fuel types |
| Weapon release rules | 26,456 | Per weapon (3,728 of them) and target class (98 classes): how many to fire, how many shooters, when to fire unprompted, when to use in self-defence |
| Valid target classes | 14,647 | Which of 18 target classes each weapon may be fired at |
| Signatures | 205,381 | Per platform and weapon, per signature type (11 types), by aspect: ships 58,245, weapons 51,095, aircraft 49,128, facilities 33,210, submarines 8,855, ground units 2,928, satellites 1,920 |
| Satellite orbits | 1,684 | Orbital element sets with dates, for 320 satellites |
| Aircraft facility | 149 | Runway, taxiway, pad, hangar, open parking, elevator, catapult, ski jump, arresting gear, deck (12 types in use) |
| Docking facility | 60 | Pier, well dock, davit, boat ramp, dry-deck shelter, underwater-vehicle crane (6 types) |
| Container | 14 | Shipping containers, tanks and pallets for the cargo model |
| Stores stations | 2 (+9 stations) | Per-pylon stores; only a first trial entry exists |
| Trait flags | | Named on/off traits: ship 60, aircraft 45, submarine 13, ground unit 12, weapon 80, sensor 29; plus 24 sensor capability flags and 26 comms capability flags |

Outside the SQLite file, the same folder holds free-text descriptions (about 5,100 files: aircraft 1,283, weapons
1,170, facilities 1,135, ships 801, sensors 450, submarines 263) and photos (1,433 files: aircraft 567, facilities
379, ships 377, submarines 103). Only the file names were counted; none was opened. Our equivalent is each record's
`brief` and `photos[]`, written and licensed by us.

For scale: the sibling Cold War file (`CWDB_519.db3`, 1946 to 1979) holds a further 2,917 ship, 545 submarine,
4,605 aircraft and 2,486 facility rows. It is outside this card and is not counted anywhere else here.

### 1.2 Platform categories

| Family | Categories (rows) |
|---|---|
| Ship | Surface combatant 3,705 (6 of them aviation-capable); auxiliary 648; amphibious 438; carrier 348; merchant 80; civilian 58; offshore base 2; uncategorised 16. By type (141 types in use): guided-missile frigate 531, guided-missile destroyer 435, patrol boat 354, fast missile craft 274, fast patrol craft 203, corvette 196, offshore patrol vessel 187, destroyer 161, guided-missile cruiser 149, frigate 145, coastal patrol boat 139, nuclear carrier 139, then a long tail (landing ships, mine warfare, oilers, intelligence ships, unmanned surface vessels 76) |
| Submarine | Nuclear attack 263; diesel hunter-killer 172; diesel attack 119; nuclear ballistic-missile 84; remotely operated vehicle 45; nuclear guided-missile 38; unmanned underwater vehicle 30; midget 19; swimmer delivery vehicle 11; other 12. Also 6 "biologics" (whales and fish schools) and 6 false targets, which exist to confuse sonar |
| Aircraft | Fixed wing 5,577; helicopter 1,968; carrier-capable fixed wing 571; airship 27; tiltrotor 21; amphibian 21; seaplane 3. By role: multirole 1,374; transport 1,365; attack 1,303; fighter 701; UAV 471; trainer 371; ASW 330; maritime patrol 280; recon 258; commercial 239; bomber 174; utility 173; armed UAV 165; tanker 159; search and rescue 148; electronic warfare 134; area surveillance 131; early warning 130; other 282 |
| Facility | Mobile (vehicles and personnel) 4,212; fixed 1,323. Mobile by role: SAM 1,031; SSM 486; radar 602; armored 351; AAA 323; mechanized 309; rocket artillery 262; self-propelled artillery 195; towed artillery 144; infantry and other 509. Fixed: radar 563; plain structures (buildings, bunkers, piers, runways, air bases) 454; SAM 190; SSM 67; fuel 29; other 20 |
| Ground unit | Mechanized infantry 139; armor 61; supply 41; motorized infantry 40; wheeled mechanized 32; SAM 30; self-propelled artillery 26; surveillance 22; infantry 19; rocket artillery 19; other 60 |
| Satellite | Imaging 141; communications 71; measurement and signature 52; electronic intelligence 17; signals intelligence 14; radar ocean recon 10; other 15 |

### 1.3 By nation

181 operators have at least one platform (the list includes "Generic", "Commercial", "Civilian" and split eras
such as Soviet Union to 1991 and Russia from 1992). All rows, largest first, then the Gulf:

| Operator | Ship | Sub | Aircraft | Facility | Ground unit | Satellite | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| United States | 959 | 191 | 1,554 | 325 | 169 | 63 | 3,261 |
| China | 388 | 45 | 393 | 270 | 36 | 44 | 1,176 |
| Russia (1992 on) | 166 | 69 | 233 | 278 | 130 | 28 | 904 |
| United Kingdom | 213 | 55 | 332 | 86 | 24 | 6 | 716 |
| Soviet Union (to 1991) | 148 | 61 | 208 | 200 | 0 | 16 | 633 |
| Generic | 22 | 3 | 8 | 502 | 52 | 0 | 587 |
| Japan | 285 | 29 | 151 | 57 | 0 | 11 | 533 |
| Iran | 105 | 7 | 142 | 206 | 0 | 2 | 462 |
| Ukraine (1992 on) | 93 | 3 | 129 | 211 | 14 | 1 | 451 |
| France | 128 | 27 | 206 | 57 | 0 | 15 | 433 |
| India | 83 | 11 | 133 | 96 | 0 | 14 | 337 |
| Turkey | 112 | 13 | 138 | 63 | 0 | 2 | 328 |
| Greece | 119 | 9 | 129 | 44 | 0 | 2 | 303 |
| Australia | 109 | 9 | 152 | 27 | 1 | 2 | 300 |
| Israel | 45 | 10 | 161 | 70 | 2 | 4 | 292 |
| Sweden | 69 | 17 | 98 | 102 | 0 | 1 | 287 |
| Commercial | 55 | 0 | 219 | 10 | 0 | 0 | 284 |
| Germany | 65 | 13 | 115 | 75 | 3 | 8 | 279 |
| Italy | 77 | 16 | 124 | 45 | 0 | 6 | 268 |
| Iraq | 27 | 0 | 152 | 50 | 0 | 0 | 229 |
| UAE | 51 | 0 | 78 | 43 | 0 | 7 | 179 |
| Pakistan | 22 | 13 | 73 | 55 | 0 | 2 | 165 |
| Saudi Arabia | 29 | 1 | 66 | 58 | 1 | 4 | 159 |
| Qatar | 35 | 0 | 33 | 30 | 0 | 0 | 98 |
| Oman | 44 | 0 | 29 | 25 | 0 | 0 | 98 |
| Yemen | 29 | 0 | 48 | 19 | 0 | 0 | 96 |
| Kuwait | 27 | 0 | 27 | 40 | 1 | 0 | 95 |
| Bahrain | 34 | 0 | 31 | 20 | 0 | 0 | 85 |

The United States alone is 16% of all platform rows. Ground units exist for only 24 operators (US 169, Russia 130,
Generic 52, China 36, then single digits): CMO's newer land model is itself thinly filled. All 181 operators are in
`study/cmo-db/platforms_by_country.csv`.

### 1.4 By era

Rows by the decade the variant entered service ("undated" has no year):

| Decade | Ship | Sub | Aircraft | Facility | Ground unit | Satellite |
|---|---:|---:|---:|---:|---:|---:|
| undated | 213 | 20 | 167 | 1,458 | 67 | 1 |
| before 1960 | 49 | 1 | 35 | 48 | 2 | 0 |
| 1960s | 144 | 8 | 328 | 172 | 24 | 2 |
| 1970s | 542 | 93 | 843 | 403 | 30 | 15 |
| 1980s | 889 | 174 | 1,316 | 688 | 69 | 17 |
| 1990s | 1,071 | 168 | 1,532 | 921 | 67 | 27 |
| 2000s | 850 | 113 | 1,238 | 537 | 96 | 56 |
| 2010s | 836 | 109 | 1,417 | 713 | 68 | 145 |
| 2020s | 682 | 111 | 1,282 | 594 | 66 | 57 |
| 2030 and later | 19 | 8 | 30 | 1 | 0 | 0 |

Each decade from the 1980s on holds between 680 and 1,100 ship rows and between 1,200 and 1,550 aircraft rows: CMO's
depth is spread evenly across 45 years, because it keeps every refit of a class as its own row. A database that only
aims at "today" needs roughly the 2010s and 2020s share plus whatever older stock is still in service.

Components carry no service dates. Sensors carry a technology generation instead: 1950s 195, 1960s 641, 1970s 1,132,
1980s 1,124, 1990s 718, 2000s 840, 2010s 526, 2020s 174, plus 1,351 optical and infrared sensors graded by imaging
generation and 853 with none. Weapons have a dated generation on only 169 of 4,645 rows, so weapon era cannot be read from
the schema; it has to come from the platforms that carry them.

### 1.5 Components by type

| Family | Types (rows) |
|---|---|
| Weapon | Guided weapons 2,038; gun ammunition 742; sensor pods 289; re-entry vehicles 251; torpedoes 249; decoys 201; bombs 174; sonobuoys 137; rockets 130; fuel tanks 111; cargo, troops and paratroops 96; mines 62 (8 kinds); depth charges 33; guided shells 29; directed energy 27; hypersonic glide vehicles 22; helicopter-towed sweep packages 17; other 37 |
| Sensor | Radar 2,716; sonar 1,007 (hull 763, towed array 104, variable depth 86, dipping 41, seabed 11, bow 2); ESM 938; infrared 754; visual 652; jammers 462; sensor groups 437; lasers 283; semi-active receivers 111; non-detecting emitters 71; acoustic intercept 45; mine sweep and disposal gear 37; magnetic anomaly detectors 20; other 21. 263 named roles are in use (for example "air search, 3D, long range") |
| Loadout | 54 roles in use. Strike 14,440; ferry 3,292; air superiority with long-range missiles 2,584; standoff strike on land 2,312; standoff strike on land or ships 2,185; cargo 1,874; close air support 1,240; air superiority with short-range missiles 1,080; ASW patrol 876; troop transport 622; anti-ship standoff 613; anti-radar 608; then recon, surveillance, mine laying, tanker, early warning, search and rescue |
| Propulsion | Diesel 1,782; rocket 415; turbofan 360; turbojet 355; helicopter turboshaft 241; turboprop 197; piston 182; electric 169; torpedo engines 128; steam 125; gas turbine 98; nuclear 94; ramjet 32; air-independent 14; other 53 |
| Warhead | 32 kinds in use: blast and fragmentation 511; carrier warheads that release another weapon 314; shaped charge 85; nuclear 79; torpedo 58; cluster 92; penetrator 52; armor-piercing 114; other |

About 1,070 of the 4,645 weapons are not carried by any platform directly: they are released by other weapons
(re-entry vehicles, submunitions, torpedoes delivered by missiles) or are unused.

### 1.6 How much hangs off one platform

Average links per platform row (`study/cmo-db/platform_links.csv`):

| Family | Sensors | Mounts | Magazines | Loadouts | Comms | Signature rows | Other |
|---|---:|---:|---:|---:|---:|---:|---|
| Ship | 6.7 | 8.4 | 2.7 | | 5.3 | 11 | 1.6 aircraft facilities, 0.4 docking facilities, 1.4 fuel stores, 2.3 trait flags |
| Submarine | 7.6 | 7.0 | 1.4 | | 6.4 | 11 | 1.5 engine plants (diesel plus electric), 1.5 trait flags |
| Aircraft | 2.7 | 1.0 | | 12.9 | 2.4 | 6 | 2.7 trait flags |
| Facility | 0.2 | 3.3 | 0.3 | | 0.0 | 6 | 2,346 facilities have no sensor of their own and carry them on their mounts |
| Ground unit | 0.8 | 1.7 | 0.8 | | 2.0 | 6 | 1.9 trait flags |
| Satellite | 0.8 | 0.0 | | | 1.0 | 6 | 5.3 orbit rows |

A CMO ship is therefore not one row. It is about 40 linked rows, and its weapons are reached three hops away (ship to
mount to weapon record to weapon). That nesting is the main structural difference from our records today (section 3).

## 2. Field families

Attribute groups are named in our own words; the number is how many columns CMO spends on the group. The call is
about our engine, not about CMO:

- **NEED**: without this group our engine cannot produce the play CMO gets from the family in a naval and air
  scenario the size of the Hormuz demo.
- **LATER**: depth beyond that (logistics, amphibious and land war, component damage, strategic systems).
- "NEED with X" means the group becomes NEED the moment X enters play (for example submarines).

NEED says we must hold an equivalent, sourced by us. It never means we take CMO's number or its exact shape.

### Ship (46 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and classification | 9 | Name, category, type, operator nation and service, notes, hypothetical and deprecated flags | NEED |
| Service window | 2 | Year in, year out | NEED (pick the right variant for a scenario date) |
| Hull size and displacement | 8 | Length, beam, draft, height, three displacements, berth size class | NEED (size class drives salvo sizing and signature) |
| Damage capacity | 1 | Hull points | NEED |
| Missile-defence rating | 1 | How hard the ship is to saturate | NEED |
| Command and reaction | 6 | Combat-system generation, ergonomics, three reaction times, autonomy level | NEED (who shoots first) |
| Armor by section | 7 | Belt, deck, bulkheads, bridge, CIC, engineering, rudder | LATER |
| Sea-keeping | 2 | Sea-state limits | LATER (needs weather) |
| Transport capacity | 7 | Troops, cargo by type, mass, area, crew, volume | LATER |
| Crew | 1 | | LATER |
| Repair capacity | 1 | Almost empty in CMO (1% of rows) | LATER |
| Cost | 1 | Empty in CMO | LATER |

### Submarine (35 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and classification | 9 | As ships; includes non-submarine sonar clutter (whales, false targets) | NEED with submarines |
| Service window | 2 | | NEED with submarines |
| Hull size and displacement | 8 | | NEED with submarines |
| Depth limit | 1 | Deepest operating depth | NEED with submarines |
| Damage capacity | 1 | | NEED with submarines |
| Command and reaction | 6 | | NEED with submarines |
| Tethered-vehicle radius | 1 | For remotely operated vehicles | LATER |
| Cargo | 5 | | LATER |
| Crew, cost | 2 | | LATER |

### Aircraft (39 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and classification | 9 | Name, airframe category, role type, operator | NEED |
| Service window | 2 | | NEED |
| Airframe size and weights | 7 | Length, span, height, empty, max and payload weight, size class | NEED for the size class (parking, signature); LATER for weights |
| Flight performance | 3 | Agility grade, climb rate, endurance | NEED (agility decides air combat and which release rule applies) |
| Basing requirement | 1 | Runway length class, catapult, vertical | NEED (we already hold real runway lengths) |
| Cockpit, autonomy and reaction | 7 | Cockpit generation, visibility, ergonomics, three reaction times, drone autonomy | NEED |
| Damage and armor | 4 | Airframe points, engine, fuselage and cockpit armor | NEED for points; LATER for armor |
| Air refuelling rates | 4 | Give and take, boom and probe | LATER |
| Crew, cost | 2 | Cost is empty in CMO | LATER |

### Facility (27 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and classification | 9 | Name, structure category (fixed or mobile), role type, operator | NEED |
| Service window | 2 | Missing on a quarter of rows | NEED |
| Protection and damage | 2 | Armor grade, points | NEED |
| Antenna height | 1 | Mast height above ground | NEED (radar horizon) |
| Missile-defence rating | 1 | | NEED |
| Command and reaction | 5 | | NEED |
| Footprint | 4 | Area, length, width, radius | LATER |
| Aimpoint model | 1 | Whether each mount is a separate target | LATER |
| Crew, cost | 2 | | LATER |

### Ground unit (40 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and classification | 8 | Name, category, operator (no separate type) | NEED with land units |
| Service window | 2 | | NEED with land units |
| Protection and damage | 2 | Damage points are empty in CMO; the mounts carry the damage | NEED with land units |
| Command and reaction | 5 | | NEED with land units |
| Antenna height | 1 | | NEED with land units |
| Size and mass | 4 | | LATER |
| Being carried as cargo | 6 | Cargo class, mass, area, paradrop | LATER |
| Carrying cargo | 5 | | LATER |
| Towing and set-up time | 2 | | LATER |
| Crew and passengers, missile defence, amphibious limit, cost | 5 | | LATER |

### Satellite (26 columns, plus 33 on each orbit row)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity, service window | 11 | Name, type (imaging, signals, radar, comms), operator, years | LATER |
| Size and weights | 6 | Mostly empty in CMO | LATER |
| Protection, manoeuvre, reaction, cost | 9 | | LATER |
| Orbit rows | 33 | Mission name, life-cycle dates, a full orbital element set | LATER (public element sets exist, section 5) |

### Weapon (60 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity | 7 | Name, weapon type, generation, notes, flags | NEED |
| Range by target domain | 8 | Minimum and maximum against air, surface, land, underwater | NEED |
| Hit probability by target domain | 4 | Base chance against air, surface, land, underwater | NEED |
| Target envelope | 6 | Target speed and altitude limits | NEED (what a missile can and cannot engage) |
| Flight profile | 6 | Cruise altitude, climb rate, waypoints, flight time, snap-up | NEED (sea-skimmers arrive under the radar horizon) |
| Guidance support | 3 | Illumination time, acts as a sensor, cooperative engagement | NEED (illumination ties up fire-control channels) |
| Accuracy | 2 | Miss distance for unguided and land-attack weapons | LATER (NEED with land strike) |
| Launch envelope | 6 | Launcher speed and altitude limits | LATER |
| Torpedo speed and range pairs | 4 | Two speed settings | NEED with submarines |
| Size and mass | 6 | Length, span, diameter, weight, burnout | LATER |
| Fuzing | 1 | Detonation delay | LATER |
| Cargo footprint | 6 | | LATER |
| Cost | 1 | Empty in CMO | LATER |

Linked to each weapon: warheads, seeker sensors, engine and fuel, signatures by aspect, comms links, trait flags
(80 kinds: seeker behaviour, flight profile, navigation, fuze, mine and torpedo logic), valid target classes, and the
release rules. Of these, valid target classes, release rules, seeker type and the sea-skimming and home-on-jam
traits are NEED; the rest are LATER.

### Warhead (13 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity | 6 | Name, warhead kind | NEED |
| Damage | 1 | Points delivered | NEED |
| Explosive fill | 3 | Calibre class, explosive type, explosive weight | NEED (our damage method starts from warhead mass) |
| Count | 1 | Warheads per weapon | LATER |
| Cluster footprint | 2 | | LATER |

### Sensor (78 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity | 9 | Name, sensor type, role, generation, what it shows up as to enemy ESM | NEED |
| Coverage envelope | 6 | Minimum and maximum range, altitude limits | NEED |
| Scan timing and availability | 2 | Scan interval, reliability | NEED (scan interval sets how fast contacts refresh) |
| Measurement precision | 4 | Range, height and angle resolution, bearing accuracy | NEED (feeds contact position uncertainty) |
| Track capacity | 4 | Simultaneous air, surface, underwater tracks and illuminated targets | NEED (saturation) |
| Radar search and track parameters | 8 | Beamwidths, noise, gain, peak power, pulse width, blind time, pulse rate | NEED as an equivalent: a sourced detection range against a reference target does the same job in our engine |
| ESM receiver | 4 | Sensitivity, loss, channels, precise emitter identification | NEED |
| Jammer | 5 | Gain, power, bandwidth, targets jammed, hit-chance reduction | NEED |
| Operating frequency limits | 4 | Search and illumination band edges | NEED as a band class (ESM and jammer matching) |
| Smallest detectable signature | 6 | Only the radar one is filled in CMO (37% of rows) | NEED for radar |
| Optical and infrared magnification | 4 | Detection and classification zoom | NEED (classification range) |
| Sonar | 10 | Source level, array, tow length, deployment depths, convergence zones; six of the ten are empty or nearly empty in CMO | NEED with submarines |
| Radar illumination parameters | 8 | A second radar set for the illuminator | LATER |
| Mine-sweep gear | 4 | Width, depths, speed | LATER |

Linked to each sensor: capability flags (24: what it can search for and what it measures), trait flags (29: track
while scan, look-down, low probability of intercept, phased array, identification), frequency bands (36 named
bands), and sensor groups. Capability flags are NEED: they say whether a radar sees aircraft, ships, periscopes or
ground units. Trait flags are NEED for identification and look-down, LATER otherwise.

### Mount (24 columns) and magazine (9 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Mount identity | 5 | | NEED |
| Fire rate and ready rounds | 2 | | NEED |
| Built-in magazine and reload | 3 | Reload rate, reload stock, reload under way | NEED (what happens after the first salvo) |
| Control mode | 4 | Trainable, autonomous, local control, held for a reserved target | NEED (point defence fires on its own) |
| Protection and damage | 2 | | LATER (component damage) |
| Reliability, logistics flag | 2 | | LATER |
| Cargo and vehicle form | 6 | A mount can itself be a vehicle in a land unit | LATER |
| Magazine capacity and reload rate | 2 | | NEED |
| Magazine identity, protection, aviation flag | 7 | | LATER |

A mount's weapons and a magazine's weapons are lists of weapon records (weapon, default load, maximum load, rate).
Mounts also carry their own sensors, fire directors and comms.

### Loadout (30 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity and role | 6 | Name, mission role | NEED |
| Reach and profile | 4 | Combat radius, time on station, flight profile, drag from the load | NEED |
| Turnaround times | 2 | Ready time, surge and sustained | NEED (sortie rate) |
| Conditions | 2 | Day or night, weather | LATER (needs weather and time of day) |
| Disengage rule and buddy support | 2 | When to go home with weapons left | LATER |
| Quick-turnaround rules | 6 | | LATER |
| Stores handling | 2 | | LATER |
| Cargo load | 6 | | LATER |

The flight profile is a lookup with 29 columns of its own (174 profiles): form-up, cruise, attack, station and
combat altitudes and throttles, attack run distances, fuel reserve. Our missions will need an equivalent, but a
handful of profiles, not 174.

### Propulsion (16 columns), performance points (7), fuel (3)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity | 6 | Name, engine type | NEED |
| Performance points | 7 | Speed and fuel burn at each of four throttle settings; for aircraft also per altitude band | NEED (we use one generic speed table today) |
| Fuel store | 3 | Fuel type and amount | NEED (range and endurance) |
| Plant layout | 6 | Engines, shafts, compartments, combined-plant type | LATER |
| Thrust and specific fuel consumption | 4 | Aircraft engines only | LATER |

### Comms (13 columns)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Identity | 6 | Name, link type | LATER |
| Reach and capacity | 2 | Range, channels | LATER |
| Link behaviour | 2 | Optional, weapon link needs a sensor | LATER |
| Quality and latency | 3 | Grades for track quality and refresh | LATER |

Comms are LATER as a family: they matter for cooperative engagement and for cutting units off, which our engine
does not model. One piece is NEED earlier: whether a guided weapon needs a guidance link from the shooter.

### Link tables (field groups that live between entities)

| Group | Columns | What it holds | Call |
|---|---:|---|---|
| Signatures | 4 per row | Front, side, rear and top values for each of 11 signature types: four passive sonar bands, active sonar, visual detection and classification, infrared detection and classification, two radar bands | NEED (radar, infrared, visual); NEED with submarines (sonar). Our detection uses none today |
| Sensor placement | 33 to 37 | Slot, 16 bearing sectors of 22.5 degrees the sensor covers, a second set of 16 with the suffix Max, mast height, a few overrides | NEED for mast height; LATER for arcs. The second arc set equals the first on all but 8 of 35,222 ship rows; its meaning could not be established from the schema |
| Mount placement | 17 to 18 | Slot and 16 bearing sectors the mount can fire into; 28% of ship mount rows cover the full circle | LATER |
| Release rules | 4 | Per weapon and target class: quantity, shooters, automatic-fire range, self-defence range | NEED |
| Aircraft and docking facilities | 3 to 4 | Type, size class, capacity, runway length class | NEED for aircraft facilities (carrier and airbase operations); LATER for docking |
| Comms placement | 3 | Slot, platform-specific, relay | LATER |

### Columns CMO itself leaves empty

Worth knowing so no lane chases them: cost (every family), repair capacity, five of the six smallest-detectable-
signature columns, six of the ten sonar detail columns (empty or nearly so), weapon burnout time and weight,
ground-unit damage points, most satellite size columns. Fill rates per column are in
`study/cmo-db/column_fill.csv`.

## 3. Sandkasten today

Read from this branch (`co1/cmo-partb-t2843`, base `61f7e7d`). "Present" means the engine uses it; "descriptive"
means the record holds it and the `/database` viewer shows it, but the simulation does not read it.

### 3.1 Where our platform data lives

| Piece | File | What it is |
|---|---|---|
| Record schema | `src/types/platformDb.ts` | `PlatformRecord`: identity, service window, dimensions, performance, engine fields, weapons, defenses, sensors, loadouts, signatures, brief, photos, sources. Every row carries a source id and a `verified` or `estimated` tag |
| Records | `src/data/platforms/records/*.json` (16), indexed by `src/data/platforms/index.ts` | 9 surface ships and craft, 6 fixed-wing aircraft, 1 helicopter. All are US Navy or Iran. 132 cited sources in total |
| Methods | `src/data/platforms/METHODS.md` | How our engine numbers are set (damage points, missile defence, hit chances, warhead damage, signature grades) |
| Engine view | `src/lib/platforms/lookup.ts` | `PlatformInfo`: the six things the simulation reads (below). Also 9 hand-written engine profiles (`SIMFIX_PROFILES`) that override or extend the records, and 2 placeholder platforms for unknown snapshot contacts |
| Viewer and API | `src/lib/platforms/database.ts`, `src/app/api/platforms/route.ts`, `src/components/database/`, `src/app/database/` | The `/database` manual |
| Old CMO-shaped types | `src/types/platform.ts` | Types for the optional local extraction path (`DB_EXTRACTION_SPEC.md`, `scripts/extract_cmo_db.py`), which the game never reads. Nothing imports them. They mirror CMO's tables field for field, so they are not a model for our database |

What the simulation actually reads per platform (`PlatformInfo` in `src/lib/platforms/lookup.ts`): one sensor range,
one weapon range, damage points, missile-defence rating, a weapon list (name, one of five types, range, speed, hit
chance against air and against surface, quantity, warhead damage, seeker type) and a defense list (name, one of four
types, effectiveness, quantity). Everything else in a record is descriptive.

### 3.2 Families

| CMO family | Sandkasten today | Where | State |
|---|---|---|---|
| Ship | 9 records (Nimitz, Ticonderoga, two Arleigh Burke flights, Perry, Sina, Kaman, Bayandor, Boghammar) | `src/data/platforms/records/` | Partial: 9 of roughly 3,470 |
| Submarine | The schema allows domain `sub`; no record, no underwater detection or weapons | `src/types/platformDb.ts` | Absent |
| Aircraft | 7 records (F/A-18E, F-14D, Iranian F-14A and F-4E, E-2C, P-3C, SH-60B) | `src/data/platforms/records/` | Partial: 7 of roughly 5,800 |
| Facility, fixed | 871 real installations for the Hormuz area (192 airbases, 347 heliports, 13 naval bases, 45 ports, 274 military areas) with runway geometry. They are map objects and home bases. They have no sensors, mounts, magazines or damage | `src/lib/facilities/facilities.ts`, `data/facilities/hormuz.json` | Partial: richer geography than CMO, no combat model |
| Facility, air defence and radar sites | 14 sites (9 air defence, 3 radar, 2 nuclear) with a published range ring. Not simulated units. All 12 air defence and radar sites are marked as missing from the platform database | `src/lib/osint/types.ts`, `data/osint/hormuz.json` | Partial: placed, not modelled |
| Ground unit | The schema allows domain `ground`; no record, no land movement or combat | `src/types/platformDb.ts` | Absent |
| Satellite | Nothing | | Absent |
| Weapon | 18 weapon names as rows inside platform records, not as records of their own. Five types: anti-ship missile, surface-to-air missile, air-to-air missile, gun, torpedo (no torpedo row exists) | `PlatformWeaponRow` in `src/types/platformDb.ts`; fired by `src/lib/simulation/combat.ts` | Partial |
| Warhead | One number per weapon row (`warheadDamage`) | same | Partial |
| Sensor | 56 sensor names as rows inside platform records (radar, ESM, infrared, sonar, visual; name, role, band, range, can-track). The engine reads none of them; it uses the platform's single `sensorRangeKm` | `PlatformSensorRow`; `src/lib/simulation/detection.ts` | Descriptive |
| Mount | A text note per weapon row (`mountSummary`) | `src/types/platformDb.ts` | Absent as a model |
| Magazine | A quantity per weapon row; no reload, no shared magazine | `src/lib/simulation/combat.ts` | Partial |
| Loadout | 13 loadouts on the 7 aircraft (name, role, combat radius, stores). The engine does not read them; an aircraft always carries its weapon rows | `PlatformLoadout` | Descriptive |
| Propulsion and fuel | A text summary plus max speed, cruise speed, ceiling, radius, range, endurance per record. The engine does not read them: every ship moves at 5, 15, 25 or 30 knots and every aircraft at 200, 350, 450 or 550 knots by throttle setting. No fuel for platforms (weapons in flight do run out) | `PlatformPerformance`; `src/lib/simulation/movement.ts` | Descriptive |
| Comms | Nothing | | Absent |
| Decoys, jammers, close-in guns as defenses | 10 defense names in four types (chaff, jammer, close-in weapon, decoy) with an effectiveness and a count | `PlatformDefenseRow`; `src/lib/simulation/combat.ts` | Present, simpler than CMO |

### 3.3 Field groups

| CMO field group | Sandkasten today | Where | State |
|---|---|---|---|
| Identity, operator, classification | Name, designation, class, nation, side, service, domain, NATO symbol function | `PlatformRecord` | Present |
| Service window | Entered service, retired, status notes | `PlatformRecord.serviceWindow` | Descriptive (no scenario-date check) |
| Hull and airframe size | Length, beam or wingspan, draft, height, displacement, weights, crew | `PlatformDimensions` | Descriptive |
| Damage capacity | Damage points and four damage states | `lookup.ts`, `combat.ts` | Present |
| Armor | Nothing | | Absent |
| Missile-defence rating | One number; a salvo is twice that, between 2 and 8 | `combat.ts` (`computeSalvoSize`) | Present, simpler |
| Command and reaction times | Nothing per platform; one global schedule for the detection, AI and engagement phases | `src/lib/simulation/gameState.ts` | Absent per platform |
| Flight performance (agility, climb) | Nothing | | Absent |
| Basing requirement | Units can have a home base and runway end; no check that the runway is long enough | `src/types/game.ts` (`Unit.homeBase`) | Partial |
| Weapon range and hit chance by target | One range; hit chance against air and against surface. No land or underwater figures, no minimum range | `PlatformWeaponRow` | Partial |
| Weapon target envelope, flight profile | Weapon speed only | `PlatformWeaponRow` | Absent |
| Weapon guidance | Seeker type (active radar, semi-active, infrared, anti-radiation) | `PlatformWeaponRow`, `combat.ts` | Partial |
| Release rules | One rule for all weapons (above), plus rules of engagement and engagement range in doctrine | `combat.ts`, `src/lib/ai/doctrine.ts` | Partial |
| Sensor range | One number per platform, used as radar range; ESM range is derived from the emitter's | `detection.ts` | Partial |
| Sensor precision, scan time, track capacity | A contact position uncertainty exists; it is not driven by sensor data | `gameState.ts`, `src/lib/simulation/contacts.ts` | Absent per sensor |
| Sensor kinds | Radar with a radar-horizon check, ESM (bearing only), visual. No infrared, no sonar | `detection.ts` | Partial |
| Antenna height | Fixed 20 feet for anything without an altitude | `detection.ts` | Absent per platform |
| Signatures | Five-step grades for radar, infrared, acoustic and visual with a note. Detection does not use them | `PlatformSignatures`; `detection.ts` | Descriptive |
| Emission control | Radar on or off per unit and by doctrine | `gameState.ts`, `doctrine.ts` | Present |
| Mission profiles | Six mission types that generate waypoints; no altitude or throttle profile | `src/lib/ai/missions.ts` | Partial |
| Descriptions and photos | A plain-English brief, typical missions and licensed photos on every record | `PlatformBrief`, `PlatformPhoto` | Present, and ahead of CMO: every row is sourced |

### 3.4 Gaps that matter before more records are added

1. Two ships in the Hormuz demo have no record at all: USS Chosin (engine id 9001) and USS Cole (9003) exist only as
   engine profiles in `lookup.ts`. Seven more profiles there override the numbers of an existing record.
2. Weapons and sensors are copied into each platform. The same missile appears in several records with its own
   copy of the numbers. CMO's shape (platform to mount to weapon) is the reason 4,645 weapons can serve 20,632
   platforms. Our database needs weapon and sensor records of their own before it grows.
3. The engine reads six things per platform. Most NEED groups in section 2 have nowhere to go yet, so adding records ahead of
   engine support only adds descriptive data.
4. The committed air-traffic snapshot (`data/snapshots/`) has 137 aircraft of 16 types and maps none of them: there
   is no civil aircraft record. The snapshot importer knows six military type codes (`src/lib/snapshot/seed.ts`).

## 4. Coverage targets

The order follows what a scenario needs before it can be played with nothing missing: first the demo that exists,
then everything else that is on the map in the same strait, then the wider theater, then the world. A step is done
when every platform a scenario of that step can place has a record, and every weapon and sensor those records name
has a record of its own.

For steps 0 to 3 the "entries" column comes from this repo's own data. From step 4 on it uses CMO's name + operator
pairs not marked retired by 2026 (see the caveat at the top) as the best available list of what exists; a public
order of battle should confirm each list before a lane starts on it. The last column says how much CMO holds for
the same ground. It is a size check and a ceiling, not a quota. Both come from `study/cmo-db/theater_closure.csv`
and the `names_*.csv` lists.

| Step | What | Entries the step needs | CMO size check |
|---|---|---|---|
| 0 (done) | The 16 records that exist | 16 platforms; 18 weapon names, 56 sensor names and 10 defensive systems held inside them | |
| 1 | Finish the demo's own roster. The Strait of Hormuz Standoff places 21 units of 12 platform types (`src/lib/scenarios/demo.ts`) | **+2 platforms** (Arleigh Burke Flight I for USS Cole, vertical-launch Ticonderoga for USS Chosin), making 18. Fold the 7 override profiles in `lookup.ts` into their records. Split components out: **18 weapon records, 10 defensive-system records, up to 56 sensor records** (fewer once duplicates under different spellings are merged) | CMO spends 123 rows on the Arleigh Burke class, 104 on Ticonderoga, 117 on Nimitz. We need one record per fit that a scenario can tell apart |
| 2 | The air defence and radar sites already drawn on the Hormuz map (`data/osint/hormuz.json`) | **8 site systems**: 5 SAM systems (3rd Khordad, Patriot, S-300PMU-2, THAAD, Tor-M1) and 3 radars (AN/TPY-2, Khalij Fars, Sepehr). Each SAM system brings at least one missile and one engagement radar: **at least 5 weapons and 8 sensors**. When these exist, the 12 "missing from platform database" flags clear on their own | Iran alone: 44 SAM and 23 radar names. The six Gulf states: 53 SAM and 36 radar names |
| 3 | The traffic around the fight, so a real-world snapshot has no unknown contacts | **16 civil aircraft types** seen in the committed snapshot (B77W, A320, B38M, B789, A21N, A388, A20N, B738, B77L, B788, A35K, A359, A332, B742, A339, B763), unarmed, with size, speed and signature. **About 7 generic merchant and civil vessel classes**, one per AIS vessel category the importer can meet (cargo, tanker, passenger, fishing, tug and service, high-speed, pleasure); this second number is a proposal, the snapshot has no vessels yet | 276 commercial and civilian aircraft pairs; 73 commercial and civilian ship names |
| 4 | Iran in full: the demo's opponent, both navies, the air arms, the coast | **About 370 platforms.** 4a naval: 71 ships and craft, 5 submarines. 4b coast and air defence: 79 surface-to-surface missile units (coastal anti-ship and ballistic), 44 SAM, 23 radar, 10 AAA. 4c air: 104 aircraft, 41 of them drones. 4d other ground: 33. Six of these exist today | These pull in 399 weapons, 371 sensors (108 of them missile seekers), 307 mounts, 102 magazines and 595 loadouts in CMO. 285 of the weapons are used by Iran and by neither the US nor the Gulf states |
| 5 | US forces that sail and fly in the Gulf | Set the list from the Naval Vessel Register and the services' own fact files on the day of the build, not from CMO: the CMO list cannot tell a commissioned ship from a retired one. Ten exist today | Ceiling: 193 Navy and Marine Corps ship names, 31 submarine names, 134 Navy and Marine Corps aircraft, 146 Air Force aircraft. Navy and Marine Corps alone pull in 448 weapons, 703 sensors, 354 mounts, 2,415 loadouts |
| 6 | The six Gulf states (Saudi Arabia, UAE, Qatar, Bahrain, Kuwait, Oman) | **About 530 platforms**: 156 ships and craft, 182 aircraft, 194 land sites and units | 472 weapons (188 shared with the US, 81 shared with Iran), 609 sensors, 295 mounts, 950 loadouts |
| 7 | Underwater warfare, when the engine has sonar | World submarine list **about 320**, plus the sonars, torpedoes and sonobuoys that make them playable | 1,007 sonar sensors, 249 torpedoes, 137 sonobuoys, 33 depth charges in CMO |
| 8 | The next theaters, largest operators first | China (1,176 CMO rows), Russia (904), United Kingdom (716), Japan (533), then Ukraine, France, India, Turkey | |
| End state | Parity with the 1980-to-today file | **About 12,400 platforms** not marked retired, **15,662** with every retired variant | 4,645 weapons, 1,419 warheads, 7,554 sensors, 4,391 mounts, 1,821 magazines, 35,440 loadouts |

How far along we are: 16 of about 12,400. Steps 1 to 3 add about 33 platforms and are enough for every unit in the
demo, every site on its map and every aircraft in the snapshot to be a real record. Step 4 is the first large one.

### Depth to fill at each step

Section 2's NEED groups do not all have to be filled at step 1. A record is useful as soon as it holds what the
engine reads at that time:

| When | Fill |
|---|---|
| Steps 1 to 3 | Today's record shape: identity, service window, dimensions, performance, the engine fields, sensors, loadouts, signature grades, brief, photos, sources. New: weapons and sensors as records of their own, referenced by name |
| Before step 4 | The NEED groups the engine gains support for, in this order, because each one changes play on its own: per-platform speeds and fuel; antenna height and sensor capability flags; signatures used by detection; weapon target envelope and flight profile; track and illumination capacity; mounts with ready rounds and reload |
| After step 6 | LATER groups, family by family, when a scenario asks for them: comms and links, cargo and amphibious, armor by section, satellites |
| With step 7 | Sonar, depth limit, torpedo settings, the acoustic signature bands |

### Planning numbers

- The 16 existing records cite 132 sources, about 8 per record. At that rate step 4 is roughly 3,000 citations.
- CMO's ratio is about 4.4 platform rows per weapon and 2.7 per sensor. Components are shared heavily, so the
  weapon and sensor lists grow much more slowly than the platform list: 399 weapons cover all of Iran.
- Loadouts are the largest family by far (35,440, about 13 per aircraft row). A first pass needs only the few an
  aircraft would fly in the scenario's role: 13 loadouts cover our 7 aircraft today.

## 5. Sources for our own values

Rules that already hold in this repo (`src/data/platforms/METHODS.md`) and apply to every family below:

- Every value carries a source id from the record's own `sources[]` (title, publisher, year, URL) and a tag:
  `verified` when the cited source states it for this variant, `estimated` when it is our abstraction or a range.
- A figure the public record does not give is `null` and shows as NOT PUBLISHED. It is never filled from CMO.
- Not a source: the CMO database, any export of it, the in-game database viewer, or websites that republish CMO's
  database entries. Community wikis that copy game values count as the same thing.
- Commercial references (Jane's, IISS Military Balance, Combat Fleets) may be cited for a fact a compiler has
  lawful access to. Their tables and text are not copied.
- Facts are the shared starting point. The engine numbers (hit chance, damage points, missile-defence rating,
  signature grade, reaction time) have no public authority. They are ours, set by a written method, tagged
  `estimated`.

The existing 16 records show the mix that works: Federation of American Scientists pages (46 citations), Wikipedia
(40), GlobalSecurity.org (23), archived US Navy fact files (19), plus single manufacturer, trade-press and
NavSource pages.

| Family | Public source types a compiler lane can cite | What stays our estimate |
|---|---|---|
| Ships and craft | Official navy fact files and ship pages; the US Naval Vessel Register for what is in commission; shipbuilder data sheets and launch releases; government reports (Congressional Research Service, Government Accountability Office, Office of Naval Intelligence studies of the Iranian, Russian and Chinese navies, Defense Intelligence Agency military-power reports); open references (Wikipedia with its footnotes, FAS, GlobalSecurity, NavSource); fleet trackers such as USNI News for who is deployed | Damage points, missile-defence rating, reaction times, armor grades |
| Submarines | The same navy, register and builder sources; export catalogues for exported boats; published naval-institute and academic papers for quieting generations | Depth limit where unpublished, acoustic signature grade, sonar performance |
| Military aircraft | Air force, navy and army fact sheets; naval air systems command product pages; manufacturer specification pages; declassified Standard Aircraft Characteristics sheets for older US types; export catalogues; government budget and test reports for new variants | Agility grade, reaction times, damage points, radar and infrared signature grades |
| Civil aircraft | Type certificate data sheets from the US and European aviation regulators; the ICAO type-designator list (the codes a snapshot carries); EUROCONTROL's aircraft performance database; manufacturer airport-planning documents | Signature grades |
| Merchant and civil vessels | Classification-society registers, builder specifications, port-authority and canal-authority size classes, the AIS vessel-type coding standard | Damage points, signature grades |
| Fixed facilities (airbases, ports, bases) | Already ours: OurAirports and OpenStreetMap through `scripts/build-facilities.mjs`; national aeronautical information publications for runways; the World Port Index for ports | Hardening and damage |
| Air defence, radar and missile sites | Auftragstaktik's OSINT dataset (already imported); manufacturer and export-agency brochures; army and missile-defence-agency fact sheets; CSIS Missile Threat pages; defence-ministry and state-media announcements for Iranian systems; published satellite-imagery studies for where things are | Engagement capacity, hit chance, reaction time |
| Land units | Army fact files and equipment pages, manufacturer sheets, export catalogues, government reports | All combat values |
| Satellites | Public orbital element sets (CelesTrak); the Union of Concerned Scientists satellite database; space-agency mission pages; operator press kits | Sensor resolution and revisit where unpublished |
| Weapons | Service fact files; manufacturer data sheets; CSIS Missile Threat; export catalogues; operational test and selected acquisition reports for US weapons; arms-transfer registers (SIPRI) for who holds what | Hit chance by target type, effective range against manoeuvring targets where only a maximum is published, seeker ranges |
| Warheads | The same weapon sources (warhead mass and type are usually published with the weapon) | Damage points, by our mass-based method |
| Sensors | Manufacturer brochures (radar, sonar, electro-optics, electronic warfare); navy and air force fact files; radio-frequency band tables; published instrumented ranges; textbook radar-range methods for filling gaps, with the inputs cited | Detection range against a stated reference target when only an instrumented range is published; sonar performance; jammer effectiveness |
| Mounts and magazines | Launcher and gun fact files (cell counts, rate of fire, ready rounds), ship class pages for how many are fitted | Reload times where unpublished |
| Loadouts | Official photo captions with a stated date and unit (US military imagery is public domain); manufacturer stores charts; Standard Aircraft Characteristics sheets; squadron and exercise releases | Combat radius for a specific load when only a clean or ferry figure is published |
| Propulsion and fuel | Engine manufacturer data sheets; civil engine type certificate data sheets; ship class pages for plant layout, speed and range at a stated speed | Fuel burn by throttle setting, derived from published range and speed |
| Comms and datalinks | Service fact sheets, manufacturer pages, published standards summaries | Range and quality grades |
| Photos | Wikimedia Commons and official imagery services, with author, license and URL recorded on the record (`PlatformPhoto`) | |

Where the public record is thin, say so in the record instead of forcing a number: Iranian fast craft, Iranian
air defence radars and most sonar and jammer performance are the known thin areas in the first four steps. The
viewer already shows `estimated` rows and NOT PUBLISHED rows honestly; a larger database should keep that visible
rather than hide it.

## Working notes

Private study notes are in `study/cmo-db/` (not for the public repo, not read by any code):

| File | Contents |
|---|---|
| `coverage_queries.py` | The read-only queries behind every number here |
| `table_inventory.csv` | All 179 tables with row and column counts |
| `family_counts.csv`, `type_breakdown.csv`, `platform_links.csv` | Family totals, category and type counts, links per platform |
| `platforms_by_country.csv`, `platforms_by_decade.csv` | Nation and era splits |
| `column_fill.csv` | How often each column is filled (no values) |
| `names_ship.csv`, `names_submarine.csv`, `names_aircraft.csv`, `names_facility.csv`, `names_groundunit.csv`, `names_satellite.csv` | Platform names with category, type, operator, decade range and a not-retired flag |
| `theater_closure.csv`, `theater_weapons.csv`, `theater_sensors.csv`, `theater_mounts.csv` | The components the Iran, US and Gulf-state platforms pull in, by name |
