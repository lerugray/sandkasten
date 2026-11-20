import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import data from "../../../data/osint/hormuz.json";
import { createCircleGeoJSON } from "@/lib/map/rangeRings";
import type { OsintAffiliation, OsintDataset, OsintLayer, OsintSite } from "./types";

export type { OsintAffiliation, OsintLayer, OsintSite } from "./types";

const file = data as unknown as OsintDataset;

export const osintMeta = file.meta;
export const osintSites: OsintSite[] = file.sites;

export const OSINT_LAYERS: { id: OsintLayer; label: string; short: string }[] = [
  { id: "ad", label: "Air defence", short: "AD" },
  { id: "radar", label: "Radar", short: "RADAR" },
  { id: "nuclear", label: "Nuclear", short: "NUC" },
];

export type OsintLayerState = Record<OsintLayer, boolean>;
export const OSINT_LAYERS_ON: OsintLayerState = { ad: true, radar: true, nuclear: true };

export const OSINT_ATTRIBUTION =
  "OSINT sites: Auftragstaktik (MIT), public sources; ranges ESTIMATED.";

const byId = new Map(osintSites.map((s) => [s.id, s]));
export const getOsintSite = (id: string) => byId.get(id);

export const AFFILIATION_LABEL: Record<OsintAffiliation, string> = {
  iran: "Iran",
  us: "United States",
  gulf: "Gulf partner",
  "us-gulf": "US / Gulf partner",
  neutral: "Neutral",
};

/** Scenario side that owns a site of this affiliation: the Iranian AI side, or the player's coalition side. */
export function sideForAffiliation(a: OsintAffiliation): "Iran" | "US Navy" | "Neutral" {
  return a === "iran" ? "Iran" : a === "neutral" ? "Neutral" : "US Navy";
}

export const SIDE_FALLBACK_COLOR: Record<string, string> = { Iran: "#ff4444", "US Navy": "#00aaff", Neutral: "#9aa5b1" };

export const LAYER_TAG: Record<OsintLayer, string> = { ad: "SAM", radar: "RDR", nuclear: "NUC" };

/** Rings wider than this are drawn only for the selected site (a 1,000 km+ ring buries the theater). */
export const RING_ALWAYS_MAX_KM = 800;

export const ringAlways = (s: OsintSite) => s.rangeKm > 0 && s.rangeKm <= RING_ALWAYS_MAX_KM;

export const rangeLabel = (s: OsintSite) =>
  s.rangeKind === "engagement" ? "Engagement range" : s.rangeKind === "detection" ? "Detection range" : "Exclusion radius";

export function siteLabel(s: OsintSite): string {
  return s.layer === "nuclear" ? s.name.replace(/ Nuclear Power Plant$/, " NPP") : s.system;
}

export function sitesFor(layers: OsintLayerState, sites: OsintSite[] = osintSites): OsintSite[] {
  return sites.filter((s) => layers[s.layer]);
}

export function sitePointsGeoJSON(sites: OsintSite[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: sites.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.position.lng, s.position.lat] },
      properties: {
        id: s.id,
        layer: s.layer,
        side: sideForAffiliation(s.affiliation),
        label: siteLabel(s),
        estimated: s.estimated,
      },
    })),
  };
}

export function siteRingsGeoJSON(sites: OsintSite[], selectedId: string | null): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const s of sites) {
    if (!(s.rangeKm > 0)) continue;
    if (!ringAlways(s) && s.id !== selectedId) continue;
    const f = createCircleGeoJSON(s.position.lng, s.position.lat, s.rangeKm, 96);
    f.properties = { id: s.id, layer: s.layer, side: sideForAffiliation(s.affiliation), estimated: s.estimated, selected: s.id === selectedId };
    features.push(f);
  }
  return { type: "FeatureCollection", features };
}

/** Sites standing within `radiusM` of each other (e.g. Patriot and THAAD at one base) get an index 0..n-1 so symbols can fan out. */
export function coLocationIndex(sites: OsintSite[], radiusM = 800): Map<string, { index: number; count: number }> {
  const out = new Map<string, { index: number; count: number }>();
  const used = new Set<string>();
  for (const a of sites) {
    if (used.has(a.id)) continue;
    const group = sites.filter((b) => !used.has(b.id) && distM(a.position, b.position) <= radiusM);
    group.forEach((b, i) => {
      used.add(b.id);
      out.set(b.id, { index: i, count: group.length });
    });
  }
  return out;
}

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371008.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
