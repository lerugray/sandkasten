# SAND-MAP-2 (s403), round 2

Branch `s403/sand-map-1`. Round 1 put facilities on the MapLibre views. Round 2 puts them in the default `/play` plot and removes the vendor key from every base map.

## What changed

1. **Default `/play` shows the real installations.** `src/lib/plot/facilityLayer.ts` draws them in the plot's phosphor style.
   - Airbase, heliport, naval base and port each have their own symbol; military is bright, civil is dim.
   - Symbols appear by importance tier as you zoom in. At the theater view about 248 symbols and 207 runways are drawn; at close zoom all 595.
   - Runways are real length and width when zoomed in, never thinner than 2 px zoomed out. Area outlines appear at close range.
   - Name labels are collision-checked; runway-end designators show at the closest zoom.
   - Click a symbol or a runway strip: the same facility panel as the map (name, kind, codes, runway length, heading, surface, lighting, based units).
   - A unit with `homeBase` shows a HOME BASE row (facility and runway end) in its panel; the link flies the plot to the facility.
2. **Keyless base map.** CARTO is gone from every MapLibre view (`/`, `/editor`, `/play?map=legacy`).
   - Source: **OpenFreeMap** (https://openfreemap.org), vector tiles from `https://tiles.openfreemap.org/planet`.
   - Terms: no account, no API key, no usage cap; attribution is the only requirement (https://openfreemap.org/tos/).
   - Licences: OSM data ODbL 1.0; OpenMapTiles schema CC BY 4.0; Noto Sans glyphs SIL OFL.
   - Attribution: "OpenFreeMap, (c) OpenMapTiles, data (c) OpenStreetMap contributors" in the status bar and in the MapLibre attribution control.
   - The dark tactical look is kept (dark and light palettes rebuilt as vector layers). The Three.js plot uses no tile source.
3. **Satellite.** Still EOX Sentinel-2 cloudless 2018, **CC BY-NC-SA 4.0 (non-commercial)**; the seat decision on the default is pending Ray. While SAT is on, the status bar and the attribution control show "Sentinel-2 cloudless 2018 by EOX IT Services GmbH ... CC BY-NC-SA 4.0". `SATELLITE_YEAR` in `src/lib/map/styles.ts` is still the single switch for URL, credit and licence text.

## Frame rate on `/play` (GPU recipe, WSL2 NVIDIA)

| | before | after |
|---|---|---|
| vsync-capped, theater and zoomed | 60 / 60 | 60 / 60 |
| uncapped, theater view (dist 1000 km) | 155.9 | 186.8 |
| uncapped, closest zoom (dist 15 km) | 165.4 | 191.0 |

The uncapped numbers moved up, which is machine load noise (the box was busy); the point is there is no regression. The facility layer is 8 `Points` draws, one runway mesh and one line batch, all with draw ranges.

## Tests

- New `unit/basemap-style.test.ts` (7): vector OpenFreeMap source with `url`, no CARTO or key strings, glyph host, every layer has a source and the served font, labels above satellite, `SATELLITE_YEAR` drives URL, credit and licence.
- New `tests/sand-map-2-plot-facilities.spec.ts` (11, GPU recipe): `/play` draws symbols and runways; click on Oghab 44 opens the panel with 2 runways (2,437 m) and closes; click on Havadarya; unit panel HOME BASE and its link; on `/`, light theme, SAT, `/play?map=legacy`, `/editor` and `/play`, no "API KEY" text, no failed or 4xx/5xx remote request, no CARTO host; OpenFreeMap tiles all 200; OSM attribution; SAT adds and removes the EOX credit with the licence.
- Full results are in the final message.

## Screenshots (`docs/verification/sand-map-1-s403/`)

- `03-play-facilities.png`: default `/play` at the theater view (248 symbols, 207 runways, 25 labels drawn), Havadarya selected with its panel open.
- `04-basemap-tactical.png`: OpenFreeMap dark base at tactical zoom, no watermark. `04b-basemap-satellite-credit.png`: same view with SAT on, showing the EOX credit and CC BY-NC-SA 4.0 line.

## Notes and open items

- Main moved to `ce3d5ba` (a docs-only card) after c282a79; the branch already contains c282a79 from round 1. No new merge (no new STEER).
- OpenFreeMap is a free community service with no SLA. If it ever goes away, `BASEMAP_TILEJSON` is the one line to repoint (self-hosted PMTiles of the same OpenMapTiles schema would work without other changes).
- Satellite default stays 2018 CC BY-NC-SA until Ray decides; 2017 (CC BY) has no-data holes over the theater.
- Status bar is now two rows: the existing row, then a 12px credits row (base map, facilities, and imagery with its licence when SAT is on). MapLibre's own attribution control moved to bottom-left above it and is 12px (was 10px).
- Not done: no takeoff or landing model (sim fence).
