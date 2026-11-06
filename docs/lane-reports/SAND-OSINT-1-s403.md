SAND-OSINT-1 READY head=7a3e56c ad_sites=9 radars=3 snapshot_units=137 unit=173/173 e2e=71/71

# SAND-OSINT-1 (s403): Hormuz OSINT layers and ADS-B snapshot seed

Branch `s403/sand-osint-1`, from `origin/s403/sand-map-1` at 887e52c. Operator: sand-osint-1-s403.

## What was built

- **Import**: `npm run data:osint` (`scripts/import-osint.mjs`, helpers in `scripts/lib/osint.mjs`) reads the committed Auftragstaktik copy, filters to the Hormuz bbox, adds a curated supplement, matches the platform DB, and writes `data/osint/hormuz.json` plus OSINT fields on `data/facilities/hormuz.json`. It runs offline and is idempotent (a unit test builds, imports and byte-compares).
- **Sites**: 9 AD, 3 radar, 2 nuclear. 12 of 14 AD/radar rows are ESTIMATED; the 2 nuclear rows use the source exclusion radius (20 km).
- **Facility merge**: one record per real place. 9 existing facilities got an `osint` block (affiliation, function, notes, citations); 2 were created because no OSM/OurAirports record exists (Bandar Abbas Naval Base, Kharg Island). Total 871 facilities, no duplicates.
- **Default /play plot** (`src/lib/plot/osintLayer.ts`): engagement and detection rings, symbols, labels under the same collision rules as facilities, click for the detail panel, AD / RADAR / NUC toggles. Rings of 800 km or less always draw; Sepehr (3000 km) and AN/TPY-2 (1000 km) draw when selected, so they do not flood the view. ESTIMATED rings are dashed.
- **MapLibre views** (`/`, `/editor`, `/play?map=legacy`): the same rings, symbols, labels, panel and per-layer toggles. Facilities with OSINT data show an OSINT section in the facility panel.
- **Snapshot tool**: `node scripts/snapshot-seed.mjs`, the editor SNAPSHOT button (`/api/snapshot`), and `/play?scenario=snapshot`. Units map by platform-DB type; everything else becomes an UNKNOWN contact. No key is read or stored.

## Round 2 (FIX1 after the DPR 2 look gave FAIL-PULL)

Frames are in `docs/verification/sand-map-1-s403/` (SM) and `docs/verification/sand-osint-1-s403/` (SO), all 22 recaptured at DPR 2 at 1440x900 and 1920x1080 under the same names. A Gahkom/Dar view is SO `04-play-gahkom-dar`.

Root cause of the label-over-runway defects: the plot's runway obstacle rects were built from one shared screen vector, so both ends of every strip were the same point and no strip blocked a label. Fixed with a copy; the runway-end designators had the same fault and now draw beyond the runway ends.

| # | Item | Result | Frame |
|---|---|---|---|
| A | Labels over runways and each other (plot) | FIXED: runway strips block labels, designators beyond the ends, Bandar Abbas Intl / Havadarya / S-300PMU-2 plates clear, zoom-dependent density | SM `06-play-facilities`, `07-play-havadarya-panel`, SO `04-play-gahkom-dar` |
| B | Persian/Arabic script labels | FIXED: English or transliterated names only (curated names, `name:en`); the facility panel hides an Arabic "Local name"; e2e checks plot labels and the Havadarya panel; unit test on the import | SM `07-play-havadarya-panel`, SO `02-snapshot-scenario` |
| 1 | Unit symbols covering site icons on /map | FIXED: unit markers keep their true position (symbol anchor offset), site icons draw above units, an invisible obstacle layer keeps basemap and OSINT text off units | SO `03-map-osint` |
| 2 | /map labels pointing at the wrong icon | FIXED: DOM labels laid out by `layoutLabels`, each beside its own icon; e2e asserts every label's nearest icon is its own; displaced plot labels get a leader line | SO `03-map-osint-1920x1080`, `02-snapshot-scenario` |
| 3 | /map footer lacks "OSINT sites: Auftragstaktik" | FIXED, both views carry the same credit; e2e on /map | SM `01-map-tactical`, SO `03-map-osint` |
| 4 | Snapshot first-time view | FIXED: title "Hormuz air traffic, 6 November 2026, 19:02 UTC", briefing, played as Neutral observer so FORCES (137) lists the traffic, GOD off by default, ADSB teletype line; e2e without pressing G | SO `02-snapshot-scenario` |
| 5 | Duplicate AHMED BIN RASHID PORT; FDB3ND over scale bar and grid label | FIXED: same-place facilities de-duplicated in the import; scale bar and grid labels are occluders | SO `02-snapshot-scenario` |
| 6 | Map labels over grid labels | FIXED: grid labels are reserved rects | SO `01-plot-ad-rings`, `02-snapshot-scenario` |
| 7 | Unit diamond cutting "Hormuz" on /map | FIXED: obstacle layer under the units | SM `02-map-zoomed-bandar-abbas`, `03-map-terrain`, `04-map-satellite-credit` |
| 8 | Facility outlines crossing the coastline at 1 NM | FIXED: the coarse coastline fades once zoomed past its accuracy | SM `06-play-facilities`, `07-play-havadarya-panel` |
| 9 | Qeshm cluster overlaps; unnamed NAVAL BASE | FIXED: Qeshm labels offset with leader lines, the naval base has its real name | SO `01-plot-ad-rings`, `02-snapshot-scenario` |
| D1 | Runway dedupe kept genuine parallel strips | FIXED earlier, unit-tested (Bandar Abbas 03L/21R, 03R/21L) | SM `06-play-facilities` |
| D2 | Default snapshot shows civil traffic without G | FIXED, e2e asserts it | SO `02-snapshot-scenario` |
| S3 | UNKNOWN military stays Neutral; geodesic rings | FIXED: `sideFor` keeps UNKNOWN Neutral; rings use `geodesicCircle` in the plot and on the map, unit-tested | SO `01-plot-ad-rings` |

Also: a unit data block outranks site labels (it may displace one); the always-keep rule applies to the selected unit only, so a crowd of 137 aircraft thins out instead of stacking.

Tests now: unit 173/173; e2e 71/71 with the GPU recipe (the globe test can time out under 3 parallel workers and passes alone).

## Sources, licences and terms

| Source | Used for | Licence / terms | Rate limit / access | Status |
|---|---|---|---|---|
| Auftragstaktik, commit 7c5904e (github.com/lerugray/auftragstaktik) | Radar and nuclear records, installation overlay | MIT per its README (no LICENSE file at that commit); notice in `data/osint/ATTRIBUTION.md`; 4 data files copied unmodified into `data/osint/raw/auftragstaktik-7c5904e/` | none (local copy) | used |
| Curated supplement (`data/osint/curated/hormuz-supplement.json`) | All 9 AD sites and the AN/TPY-2 radar | MIT (this repo); each entry cites Wikipedia, CSIS Missile Defense Project or US Navy public information | none | used. Auftragstaktik has no AD inside the Hormuz bbox, so the SYSTEM is public, the PLACEMENT is anchored to a named real facility and is a scenario assumption (the panel says so) |
| Original source citations carried by Auftragstaktik records | per-record `source` field (CSIS Missile Threat, IAEA PRIS, NTI, FAS, imagery) | as cited | none | kept verbatim on each site |
| OpenStreetMap / OurAirports | facility base data | ODbL / public domain | built earlier, raw cache committed | credited in `/play` and on the map; OSINT text appended |
| adsb.lol (`api.adsb.lol/v2/mil`, `/v2/point`) | Aircraft snapshot | Free, data ODbL 1.0, attribution to adsb.lol, provided as is; docs say an API key may be required in future | publishes no numeric limit; the tool limits itself to 1 request per second, one attempt, no retries | used |
| AISStream | Ships | Free tier but needs a personal API key | n/a | **skipped**: key required, none stored; no keyless AIS source covers the bbox. Snapshot has no ships |
| Platform DB (`src/data/platforms/records`) | Range and type matching | repo data | read only | not edited |

## Platform-DB matches and misses

Matching is by weapon name (AD) or sensor name (radar) against `src/data/platforms/records`. A match takes the DB range and drops ESTIMATED; a miss keeps the OSINT range and shows ESTIMATED. The matcher is unit-tested with synthetic records.

**Matches: 0.** The platform DB holds ships, aircraft and helicopters, and no ground SAM battery or ground radar. Nothing in the DB was changed, as the fence requires.

**Misses: 12, all ESTIMATED** (range km, kind):

| Site | System | Side | Range |
|---|---|---|---|
| ad-ir-s300-bandar-abbas | S-300PMU-2 | Iran | 200 |
| ad-ir-s300-bushehr | S-300PMU-2 | Iran | 200 |
| ad-ir-3khordad-qeshm | 3rd Khordad | Iran | 75 |
| ad-ir-tor-bushehr | Tor-M1 | Iran | 12 |
| ad-us-patriot-udeid | MIM-104 Patriot | US/Gulf | 160 |
| ad-us-patriot-dhafra | MIM-104 Patriot | US/Gulf | 160 |
| ad-us-thaad-dhafra | THAAD | US/Gulf | 200 |
| ad-sa-patriot-dhahran | MIM-104 Patriot | Gulf | 160 |
| ad-bh-patriot-isa | MIM-104 Patriot | Gulf | 160 |
| radar-ir-khalij-fars | Khalij Fars | Iran | 300 |
| radar-ir-sepehr | Sepehr | Iran | 3000 |
| radar-us-tpy2-udeid | AN/TPY-2 | US/Gulf | 1000 |

The 2 nuclear sites (Bushehr reactor, Barakah) are not platforms; their 20 km figure comes from the source record and is not ESTIMATED.

Scenario wiring: the demo scenario carries `osint` so both MapLibre views and the plot show the sites on the right side (Iran red, Gulf/US cyan, neutral dim). Because the DB has no SAM or radar type, no site becomes a scenario unit; they are map layers. Once records exist, `npm run data:osint` links them with no code change.

**Dropped records**: `cp-hormuz` (a chokepoint, no single position); outside the bbox: 17 air defence, 17 radar, 15 nuclear and 30 installation records.

## Snapshot example (honest note)

`data/snapshots/hormuz-adsb-20261106T190240Z.scenario.json`, fetched 2026-11-06T19:02:40Z from adsb.lol: **137 units, 0 type-mapped, 137 UNKNOWN contacts, 0 military aircraft**. No military aircraft were broadcasting inside the box at that moment, so the example holds civil traffic only, kept as Neutral UNKNOWN contacts (transponder type code kept, generic unarmed placeholder platform). The type-to-platform mapping (for example E2 to E-2C, H60 to SH-60B) is covered by the fixture tests, not by this example. Ships are absent (AIS needs a key). Side comes from the ICAO address block, which is an estimate; the limits are written inside the scenario file. Play works offline: `/play?scenario=snapshot` reads the committed file.

## Tests

- Unit: `unit/osint-import.test.ts` (dedupe, ranges, citations, platform matcher, facility overlay), `unit/snapshot-seed.test.ts` (fixture based, no network), `unit/facilities-pipeline.test.ts` (build, import, byte compare). Full suite: 156/156 (16 files).
- E2E with the GPU recipe: `tests/sand-osint-1-rings.spec.ts` covers plot rings and toggles, the S-300 panel with the ESTIMATED range, the credit line, the MapLibre ring and symbol layers with the AD toggle, the snapshot scenario opening offline and running with no calls to adsb.lol or aisstream, and the editor SNAPSHOT button. Full suite: 68/68 on the GPU recipe (the rings spec was re-run after a type-only cleanup: 7/7).

## Fix found while verifying

On the MapLibre map the OSINT layer never built: `map.isStyleLoaded()` is false while tiles stream in and `style.load` had already fired. `OsintLayer.tsx` now also builds on the next `idle`, and a browser test asserts the layers exist. Also moved the plot scale bar above the credit line, which had grown to two lines.

## Verification screenshots

DPR 2, 1440x900 and 1920x1080, in `docs/verification/sand-osint-1-s403/`:

- `01-plot-ad-rings-*.png`: AD rings in the default plot, S-300PMU-2 selected with its ESTIMATED panel.
- `02-snapshot-scenario-*.png`: the snapshot scenario in the plot.
- `03-map-osint-*.png`: the MapLibre map with rings, symbols and the AD/RADAR/NUC toggles.

The SAND-MAP-1 frames 05 to 07 in `docs/verification/sand-map-1-s403/` were recaptured (cold-boot `/play`, facilities, Havadarya panel), because the plot credit line and OSINT toggles changed.

## Known limits

- Bushehr (about 50.9E) sits outside the plot camera clamp, so the plot cannot centre on it; the Bandar Abbas sites are the test targets. On /map Bushehr labels are checked by the nearest-icon test.
- In the densest part of the snapshot (Dubai area) some aircraft data blocks are dropped rather than stacked; the full list is under FORCES.
- Where the coarse Natural Earth coastline meets facility outlines, the land fill edge still shows faintly at 1 NM.
- All AD placements are scenario assumptions anchored to real facilities, not surveyed positions.

## Steer entries acted on

- `20261106T182116Z` (visual fixes): all frames recaptured at DPR 2 at both sizes including cold-boot `/play`; OSINT labels use the same collision rules (obstacles, halos, 12 px minimum); readable credit line; EOX licence needed no action.
- `20261106T183238Z` (data fixes): already committed before this lane (runway designators from bearing, one runway per strip, `/play` credits, committed raw cache); the Havadarya 08 threshold spawn (heading 79) was re-checked and is fine. The OSINT import reuses the committed raw-cache approach so it regenerates offline.
- Round 2: both entries were re-read at every checkpoint; no newer entries appeared.
