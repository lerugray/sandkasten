import { describe, it, expect } from "vitest";
import {
  BASEMAP_SOURCE_ID,
  BASEMAP_TILEJSON,
  BASEMAP_ATTRIBUTION,
  MAP_FONT,
  SATELLITE_YEAR,
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
  SATELLITE_CREDIT_TEXT,
  SATELLITE_LAYER_ID,
  getMapStyle,
} from "../src/lib/map/styles";

describe("keyless base map style", () => {
  for (const theme of ["dark", "light"] as const) {
    const style = getMapStyle(theme);

    it(`${theme}: base is OpenFreeMap vector tiles, with no CARTO raster and no key in any URL`, () => {
      const src = style.sources[BASEMAP_SOURCE_ID] as { type: string; url?: string; attribution?: string };
      expect(src.type).toBe("vector");
      expect(src.url).toBe(BASEMAP_TILEJSON);
      expect(src.attribution).toContain("OpenStreetMap");
      expect(BASEMAP_ATTRIBUTION).toContain("OpenFreeMap");
      const text = JSON.stringify(style);
      expect(text).not.toMatch(/carto/i);
      expect(text).not.toMatch(/api[_-]?key|access_token|apikey/i);
      expect(style.glyphs).toBe("https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf");
    });

    it(`${theme}: every layer points at a defined source and uses the served font stack`, () => {
      const ids = new Set<string>();
      for (const l of style.layers) {
        expect(ids.has(l.id), `duplicate layer id ${l.id}`).toBe(false);
        ids.add(l.id);
        if (l.type !== "background") expect(style.sources[(l as { source: string }).source], l.id).toBeDefined();
        const font = (l.layout as { "text-font"?: string[] } | undefined)?.["text-font"];
        if (font) expect(font).toEqual([MAP_FONT]);
      }
      expect(ids.has(SATELLITE_LAYER_ID)).toBe(true);
    });

    it(`${theme}: borders and labels draw above the satellite layer`, () => {
      const order = style.layers.map((l) => l.id);
      const sat = order.indexOf(SATELLITE_LAYER_ID);
      expect(order.findIndex((i) => i.endsWith("-boundary-country"))).toBeGreaterThan(sat);
      expect(order.findIndex((i) => i.endsWith("-place-city"))).toBeGreaterThan(sat);
      expect(order.findIndex((i) => i.endsWith("-water"))).toBeLessThan(sat);
    });
  }

  it("SATELLITE_YEAR is the single switch for the imagery URL, credit and licence", () => {
    expect(SATELLITE_TILES).toContain(`s2cloudless-${SATELLITE_YEAR}_3857`);
    expect(SATELLITE_ATTRIBUTION).toContain(String(SATELLITE_YEAR));
    expect(SATELLITE_CREDIT_TEXT).toContain(String(SATELLITE_YEAR));
    expect(SATELLITE_ATTRIBUTION).toContain(SATELLITE_YEAR === 2017 ? "CC BY 4.0" : "CC BY-NC-SA 4.0");
    expect(SATELLITE_ATTRIBUTION).toContain("EOX");
  });
});
