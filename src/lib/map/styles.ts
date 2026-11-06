import type { StyleSpecification, LayerSpecification, ProjectionSpecification } from "maplibre-gl";

/** Open-data layers behind the map toggles. Ids are shared with TacticalMap's toggle code. */
export const TERRAIN_SOURCE_ID = "terrain-dem";
export const HILLSHADE_LAYER_ID = "terrain-hillshade";
export const SATELLITE_SOURCE_ID = "sentinel2-cloudless";
export const SATELLITE_LAYER_ID = "sentinel2-cloudless-layer";

// AWS Terrain Tiles (Mapzen/Tilezen "terrarium" encoding). Free on the AWS Open Data registry; sources
// (SRTM, GMTED2010, ETOPO1 and others) must be credited: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
export const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (Mapzen, SRTM, GMTED2010, ETOPO1)';

// EOX Sentinel-2 cloudless. 2017 is CC BY 4.0 but has white no-data holes over the Gulf of Oman / Hormuz theater at every zoom;
// 2018 is gap-free but CC BY-NC-SA 4.0 (non-commercial). Flip SATELLITE_YEAR to 2017 for the CC BY layer.
export const SATELLITE_YEAR: number = 2018;
const SATELLITE_LICENCE = SATELLITE_YEAR === 2017 ? "CC BY 4.0" : "CC BY-NC-SA 4.0";
export const SATELLITE_TILES = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${SATELLITE_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`;
export const SATELLITE_ATTRIBUTION = `<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless ${SATELLITE_YEAR}</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data ${SATELLITE_YEAR}), ${SATELLITE_LICENCE}`;

export const SATELLITE_CREDIT_TEXT = `Imagery: Sentinel-2 cloudless ${SATELLITE_YEAR} by EOX IT Services GmbH (modified Copernicus Sentinel data), ${SATELLITE_LICENCE}`;

/** Globe when zoomed out, flat mercator from the tactical zoom (theater default is 7). */
export const ADAPTIVE_PROJECTION: ProjectionSpecification = {
  type: ["interpolate", ["linear"], ["zoom"], 5, "vertical-perspective", 6.5, "mercator"],
};
export const FLAT_PROJECTION: ProjectionSpecification = { type: "mercator" };

// Base map: OpenFreeMap (https://openfreemap.org), OpenMapTiles-schema vector tiles built from OpenStreetMap.
// No account, no API key, no usage cap; the operator asks only for attribution. The style below is ours, so
// the dark tactical look and the light theme are drawn client-side from the same vector data.
// Terms: https://openfreemap.org/tos/ . Tiles ODbL (OpenStreetMap), schema/design CC-BY 4.0 (OpenMapTiles).
export const BASEMAP_SOURCE_ID = "openfreemap";
export const BASEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
export const BASEMAP_CREDIT_TEXT = "Base map: OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors (ODbL)";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const MAP_FONT = "Noto Sans Regular";

interface BasePalette {
  land: string; park: string; urban: string; water: string; coast: string; waterway: string;
  building: string; aero: string; taxi: string; roadMinor: string; roadMajor: string; roadHighway: string; rail: string;
  ferry: string; boundary: string; boundarySub: string; label: string; labelDim: string; waterLabel: string; halo: string;
}

const DARK: BasePalette = {
  land: "#161b22", park: "#182420", urban: "#1d242c", water: "#080c11", coast: "#3a6178", waterway: "#101923",
  building: "#222b35", aero: "#222c36", taxi: "#2e3a47", roadMinor: "#222a33", roadMajor: "#2f3a47", roadHighway: "#415063", rail: "#2a323c",
  ferry: "#2f5266", boundary: "#6b7a8c", boundarySub: "#37424f", label: "#9aa7b6", labelDim: "#6c7886", waterLabel: "#47627a", halo: "#0b0f14",
};

const LIGHT: BasePalette = {
  land: "#e9e7e2", park: "#dfe6da", urban: "#e0ddd6", water: "#b7cfe2", coast: "#7f9fb8", waterway: "#a8c3d8",
  building: "#d6d2ca", aero: "#d9d6cf", taxi: "#cfcbc3", roadMinor: "#f7f5f1", roadMajor: "#ffffff", roadHighway: "#f1d9a8", rail: "#bdb8ae",
  ferry: "#6e94b0", boundary: "#7a6f8a", boundarySub: "#b7b0c0", label: "#3d4651", labelDim: "#6b747e", waterLabel: "#5b83a3", halo: "#f4f2ee",
};

// Latin-script names only: an OSM feature with no English or Latin name goes unlabelled rather than showing Persian/Arabic script that cannot be read on imagery.
const NAME = ["coalesce", ["get", "name_en"], ["get", "name:latin"]];
const OFM = BASEMAP_SOURCE_ID;
const widthRamp = (a: number, b: number, c: number) => ["interpolate", ["exponential", 1.4], ["zoom"], 8, a, 12, b, 16, c] as unknown as number;

function baseLayers(id: string, p: BasePalette): LayerSpecification[] {
  return [
    { id: `${id}-bg`, type: "background", paint: { "background-color": p.land } },
    { id: `${id}-landcover`, type: "fill", source: OFM, "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "farmland"]]], paint: { "fill-color": p.park, "fill-opacity": 0.7 } },
    { id: `${id}-park`, type: "fill", source: OFM, "source-layer": "park", paint: { "fill-color": p.park, "fill-opacity": 0.7 } },
    { id: `${id}-landuse`, type: "fill", source: OFM, "source-layer": "landuse", minzoom: 6, filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "industrial", "retail", "military"]]], paint: { "fill-color": p.urban } },
    { id: `${id}-water`, type: "fill", source: OFM, "source-layer": "water", paint: { "fill-color": p.water } },
    { id: `${id}-coast`, type: "line", source: OFM, "source-layer": "water", paint: { "line-color": p.coast, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 0.9, 14, 1.4], "line-opacity": 0.85 } },
    { id: `${id}-waterway`, type: "line", source: OFM, "source-layer": "waterway", minzoom: 9, paint: { "line-color": p.waterway, "line-width": widthRamp(0.4, 0.9, 1.6) } },
    { id: `${id}-aeroway-area`, type: "fill", source: OFM, "source-layer": "aeroway", minzoom: 10, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": p.aero } },
    { id: `${id}-taxiway`, type: "line", source: OFM, "source-layer": "aeroway", minzoom: 11, filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "class"], "taxiway"]], paint: { "line-color": p.taxi, "line-width": widthRamp(0.4, 0.8, 2) } },
    { id: `${id}-building`, type: "fill", source: OFM, "source-layer": "building", minzoom: 13.5, paint: { "fill-color": p.building } },
    { id: `${id}-road-minor`, type: "line", source: OFM, "source-layer": "transportation", minzoom: 11, filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track", "path"]]], layout: { "line-cap": "round" }, paint: { "line-color": p.roadMinor, "line-width": widthRamp(0.4, 0.8, 2.2) } },
    { id: `${id}-road-major`, type: "line", source: OFM, "source-layer": "transportation", minzoom: 7.5, filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary"]]], layout: { "line-cap": "round" }, paint: { "line-color": p.roadMajor, "line-width": widthRamp(0.5, 1, 3.2) } },
    { id: `${id}-road-highway`, type: "line", source: OFM, "source-layer": "transportation", minzoom: 5, filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]], layout: { "line-cap": "round" }, paint: { "line-color": p.roadHighway, "line-width": widthRamp(0.7, 1.4, 4) } },
    { id: `${id}-rail`, type: "line", source: OFM, "source-layer": "transportation", minzoom: 9, filter: ["==", ["get", "class"], "rail"], paint: { "line-color": p.rail, "line-width": widthRamp(0.4, 0.7, 1.4), "line-dasharray": [3, 2] } },
    { id: `${id}-ferry`, type: "line", source: OFM, "source-layer": "transportation", minzoom: 6, filter: ["==", ["get", "class"], "ferry"], paint: { "line-color": p.ferry, "line-width": 0.8, "line-dasharray": [2, 3] } },
  ];
}

/** Borders and place names sit above the satellite and hillshade layers so they stay readable on imagery. */
function overlayLayers(id: string, p: BasePalette): LayerSpecification[] {
  const halo = { "text-halo-color": p.halo, "text-halo-width": 2 };
  return [
    { id: `${id}-boundary-sub`, type: "line", source: OFM, "source-layer": "boundary", minzoom: 4, filter: ["all", ["in", ["get", "admin_level"], ["literal", [3, 4]]], ["!=", ["get", "maritime"], 1]], paint: { "line-color": p.boundarySub, "line-width": 0.8, "line-dasharray": [3, 2] } },
    { id: `${id}-boundary-country`, type: "line", source: OFM, "source-layer": "boundary", filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]], paint: { "line-color": p.boundary, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.2, 14, 1.8], "line-dasharray": [4, 2] } },
    { id: `${id}-water-label`, type: "symbol", source: OFM, "source-layer": "water_name", minzoom: 3, layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": 12, "text-letter-spacing": 0.15, "text-max-width": 8 }, paint: { "text-color": p.waterLabel, ...halo } },
    { id: `${id}-place-village`, type: "symbol", source: OFM, "source-layer": "place", minzoom: 10, filter: ["in", ["get", "class"], ["literal", ["village", "suburb", "hamlet", "neighbourhood"]]], layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": 12 }, paint: { "text-color": p.labelDim, ...halo } },
    { id: `${id}-place-town`, type: "symbol", source: OFM, "source-layer": "place", minzoom: 7, filter: ["==", ["get", "class"], "town"], layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": 12 }, paint: { "text-color": p.label, ...halo } },
    { id: `${id}-place-city`, type: "symbol", source: OFM, "source-layer": "place", minzoom: 4, filter: ["==", ["get", "class"], "city"], layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 15] as never }, paint: { "text-color": p.label, ...halo } },
    { id: `${id}-place-state`, type: "symbol", source: OFM, "source-layer": "place", minzoom: 4, maxzoom: 8, filter: ["==", ["get", "class"], "state"], layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.1 }, paint: { "text-color": p.labelDim, ...halo } },
    { id: `${id}-place-country`, type: "symbol", source: OFM, "source-layer": "place", maxzoom: 7, filter: ["==", ["get", "class"], "country"], layout: { "text-field": NAME as never, "text-font": [MAP_FONT], "text-size": ["interpolate", ["linear"], ["zoom"], 2, 12, 6, 15] as never, "text-transform": "uppercase", "text-letter-spacing": 0.12 }, paint: { "text-color": p.label, ...halo } },
  ];
}

function buildStyle(id: string, palette: BasePalette): StyleSpecification {
  return {
    version: 8,
    projection: ADAPTIVE_PROJECTION,
    sources: {
      [BASEMAP_SOURCE_ID]: { type: "vector", url: BASEMAP_TILEJSON, attribution: BASEMAP_ATTRIBUTION },
      [SATELLITE_SOURCE_ID]: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 13,
        attribution: SATELLITE_ATTRIBUTION,
      },
      [TERRAIN_SOURCE_ID]: {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 12,
        encoding: "terrarium",
        attribution: TERRAIN_ATTRIBUTION,
      },
    },
    layers: [
      ...baseLayers(id, palette),
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        layout: { visibility: "none" },
      },
      {
        id: HILLSHADE_LAYER_ID,
        type: "hillshade",
        source: TERRAIN_SOURCE_ID,
        layout: { visibility: "none" },
        paint: {
          "hillshade-exaggeration": 0.6,
          "hillshade-shadow-color": "#000000",
          "hillshade-highlight-color": "#6b7280",
          "hillshade-accent-color": "#374151",
        },
      },
      ...overlayLayers(id, palette),
    ],
    glyphs: GLYPHS,
  };
}

export const tacticalDarkStyle: StyleSpecification = buildStyle("ofm-dark", DARK);
export const tacticalLightStyle: StyleSpecification = buildStyle("ofm-light", LIGHT);

export function getMapStyle(theme: "dark" | "light"): StyleSpecification {
  return theme === "dark" ? tacticalDarkStyle : tacticalLightStyle;
}
