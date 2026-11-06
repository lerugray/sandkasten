SAND-MAP-1 READY head=c5ee962 facilities=869 runways=207 unit=93/93 e2e=49/49

Branch `s403/sand-map-1`. `head` is the tested code commit. Only this report, a type-only fix in `styles.ts` and a meta-key rename in the pipeline (rebuilt offline, facility data byte-identical) follow it. Merged with origin/main `c282a79` (SAND-LAND) per STEER `20261106T170902Z`; tests were run on the merged head. GPU: ANGLE/D3D12 NVIDIA recipe, `--workers=2`.

## What Ray gets

On the MapLibre map (`/`, `/editor`, `/play?map=legacy`): 869 real facilities for the Strait of Hormuz theater with distinct symbols, runways drawn to real length and width, and a clickable terminal-style panel. Four toggles at top-left: FACILITIES, GLOBE, TERRAIN, SAT. Dark basemap stays the default.

**Important: the brief assumed the default `/play` is MapLibre. It is the Three.js terminal plot, which does not draw this layer.** The facility layer lives on the three MapLibre views. Smallest next step to put it in `/play`: project `scenario.facilities` runway lines and points in the Three.js plot (data and helpers in `src/lib/facilities/facilities.ts` are renderer-agnostic).

## Tests

| suite | result |
|---|---|
| vitest (`npx vitest run`) | 93/93 (main 83 + 5 pipeline + 5 scenario) |
| Playwright GPU, full suite, merged head | 49/49 (main's 44 + 5 new in `tests/sand-map-1-facilities.spec.ts`) |
| `tsc --noEmit` | no errors outside `tests/sand-001-*` (pre-existing, also on main) |

Nothing failed, so there are no failures to compare with main. New tests: `unit/facilities-pipeline.test.ts` (parsing, merge, dedupe, runway ends), `unit/facility-scenario.test.ts` (bindings, threshold spawn), `tests/sand-map-1-facilities.spec.ts` (layer build + attribution, click Oghab 44 opens panel with 2 runway rows and based units, facilities/globe/terrain/satellite toggles, globe at low zoom and flat at tactical zoom).

## Data

`scripts/build-facilities.mjs` (fetch with cache, `--offline` rebuild, retries and endpoint rotation for Overpass) writes `data/facilities/hormuz.json` (~490 KB). Fetch date 2026-11-06, bbox 22.5N 50E to 30N 61E. Offline rebuild reproduces the committed facilities exactly.

| kind | count |
|---|---|
| airbase | 192 |
| heliport | 347 |
| naval_base | 12 |
| port | 44 |
| military_area | 274 |
| runways | 207 (79 from OurAirports, 128 from OSM centrelines; 54 further OSM ways skipped as stubs or duplicates) |

| source | licence |
|---|---|
| OurAirports airports.csv, runways.csv | Public Domain |
| OpenStreetMap via Overpass (overpass-api.de, private.coffee, kumi.systems) | ODbL 1.0, "© OpenStreetMap contributors" |
| AWS Terrain Tiles (Mapzen terrarium; SRTM, GMTED2010, ETOPO1 and others), https://registry.opendata.aws/terrain-tiles/ | open data; sources must be credited (shown in the map attribution) |
| EOX Sentinel-2 cloudless 2018 | **CC BY-NC-SA 4.0** (see decision below) |
| CARTO raster basemap (unchanged) | © OpenStreetMap contributors, © CARTO |

Full text in `data/facilities/ATTRIBUTION.md`; OSM and OurAirports credits are in the map attribution control and in the status bar.

## Decision for Ray: satellite year

Brief said prefer CC BY. EOX's 2017 mosaic is CC BY 4.0 but has white no-data holes across the Hormuz theater at every zoom (visible in my first screenshots; checked tile pixels for z2 to z8). 2018 is gap-free but CC BY-NC-SA 4.0 (non-commercial). I shipped 2018 so the toggle works. To switch to 2017, set `SATELLITE_YEAR = 2017` in `src/lib/map/styles.ts` (URL and credit follow). If Sandkasten ever goes commercial, 2018 needs an EOX commercial licence or another source.

## Bindings and takeoff/landing

The sim has no takeoff or landing model and I did not add one (combat and sim rules are out of my fence). Binding is by `Unit.homeBase = { facilityId, runwayEnd? }` plus **spawn at the threshold**:

- `ir-f4-1`, `ir-f14-1` (airborne): `homeBase` = Oghab 44 Airbase `apt-ir-0161`, the nearest military airfield with a 1.8 km+ runway (asserted in a test).
- `ir-f4-2` "Phantom 302 (alert)": new, speed 0, altitude 0, mission Alert, spawned on the runway 08 threshold at Havadarya `apt-oikp`, heading along the runway (asserted within 50 m).
- US carrier aircraft: unbound (they operate from the carrier).
- The panel lists units based at the selected facility (respects fog of war).

## Screenshots (`docs/verification/sand-map-1-s403/`)

- `01-facility-layer-tactical.png`: Havadarya at z13.2, runway 08/26 to scale, alert Phantom at the threshold, panel open (SAT on so runway scale is checkable against imagery).
- `02-globe-terrain.png`: globe at z3 with terrain and satellite on.
- Extras: `01b-tactical-dark-default.png` (default dark basemap, Oghab 44 panel), `02b-terrain-pitched.png` (terrain at 60 degree pitch).

## Behavior notes

- Globe: `vertical-perspective` below z5 blending to `mercator` by z6.5 (theater default is z7, so it opens flat). GLOBE off forces mercator.
- Facility symbols tier by importance (primary bases from z3, minor heliports from z9.5); runway width scales with zoom; symbols fade at z11.5 to z13.5 so they do not hide the runway.
- Toggles re-apply after a theme switch; facility layers rebuild on `style.load`.
- Fixed while testing: toggles were silently dropped while tiles were loading (`isStyleLoaded()` is false then); redundant `setProjection` during load wiped the facility layers; glyph font `Noto Sans Regular` is not served by fonts.openmaptiles.org (now `Open Sans Regular`).
- Frame rate: no measured regression in the GPU runs; I did not run a dedicated FPS benchmark.

## Not done / known issues

1. **CARTO basemap shows "API KEY REQUIRED" watermarks.** CARTO now serves a watermark tile (etag `wm-...`) to keyless requests. This is on main too, not caused by this lane, and is visible in the dark and light themes. Smallest next step: choose a keyless basemap (for example Protomaps PMTiles self-hosted, needs a dependency decision) or a CARTO key.
2. `/play` (Three.js plot) does not show facilities (see above).
3. Data quality: Bandar Abbas Naval Base is absent from OSM as a naval base; many names are Persian where `name:en` is missing (English preferred, local name kept); Oghab 44 runways have no designators and show as "274° strip" (one is a 296 m OSM stub); some OSM runways use estimated ends (`derivedEnds`).
4. No takeoff/landing animation or runway occupancy: needs a sim change (outside this lane's fence).
5. Map attribution text is 10px (existing style); I did not change it.
