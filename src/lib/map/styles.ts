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
export const SATELLITE_YEAR: 2017 | 2018 = 2018;
const SATELLITE_LICENCE = SATELLITE_YEAR === 2017 ? "CC BY 4.0" : "CC BY-NC-SA 4.0";
export const SATELLITE_TILES = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${SATELLITE_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`;
export const SATELLITE_ATTRIBUTION = `<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless ${SATELLITE_YEAR}</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data ${SATELLITE_YEAR}), ${SATELLITE_LICENCE}`;

/** Globe when zoomed out, flat mercator from the tactical zoom (theater default is 7). */
export const ADAPTIVE_PROJECTION: ProjectionSpecification = {
  type: ["interpolate", ["linear"], ["zoom"], 5, "vertical-perspective", 6.5, "mercator"],
};
export const FLAT_PROJECTION: ProjectionSpecification = { type: "mercator" };

const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";

function basemap(id: string, name: "dark_all" | "light_all"): { source: StyleSpecification["sources"]; layer: LayerSpecification } {
  return {
    source: {
      [id]: {
        type: "raster",
        tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/${name}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors, CARTO",
      },
    },
    layer: { id: `${id}-layer`, type: "raster", source: id },
  };
}

function buildStyle(id: string, name: "dark_all" | "light_all"): StyleSpecification {
  const base = basemap(id, name);
  return {
    version: 8,
    projection: ADAPTIVE_PROJECTION,
    sources: {
      ...base.source,
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
      base.layer,
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
    ],
    glyphs: GLYPHS,
  };
}

export const tacticalDarkStyle: StyleSpecification = buildStyle("carto-dark", "dark_all");
export const tacticalLightStyle: StyleSpecification = buildStyle("carto-light", "light_all");

export function getMapStyle(theme: "dark" | "light"): StyleSpecification {
  return theme === "dark" ? tacticalDarkStyle : tacticalLightStyle;
}
