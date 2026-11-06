import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import data from "../../../data/facilities/hormuz.json";
import { shortFacilityName } from "./labels";
import type { OsintFacilityFields } from "@/lib/osint/types";

export type FacilityKind = "airbase" | "heliport" | "naval_base" | "port" | "military_area";

export interface RunwayEnd {
  ident: string;
  lat: number;
  lng: number;
  headingTrue: number;
}

export interface Runway {
  id: string;
  lengthM: number;
  widthM: number | null;
  headingTrue: number;
  surface: string;
  lighted: boolean | null;
  closed: boolean;
  ends: [RunwayEnd, RunwayEnd];
  derivedEnds: boolean;
  source: { source: string; id: string };
}

export interface FacilitySource {
  source: "ourairports" | "osm" | "auftragstaktik";
  id: string;
  ident?: string;
  role?: string;
}

export interface Facility {
  id: string;
  name: string;
  nameLocal?: string | null;
  kind: FacilityKind;
  use?: "military" | "civil";
  isMilitary?: boolean;
  position: { lat: number; lng: number };
  polygon?: [number, number][] | null;
  areaM2?: number | null;
  runways?: Runway[];
  icao?: string | null;
  iata?: string | null;
  country?: string;
  municipality?: string | null;
  elevationFt?: number | null;
  airportType?: string;
  areaType?: string;
  sources: FacilitySource[];
  /** Curated OSINT fields (data/osint): affiliation, function, notes, citation. */
  osint?: OsintFacilityFields;
}

export interface FacilityDataMeta {
  schema: number;
  theater: string;
  bbox: { south: number; west: number; north: number; east: number };
  fetchDate: string;
  sources: { name: string; url: string; licence: string; attribution?: string }[];
  counts: Record<string, number>;
}

const file = data as unknown as { meta: FacilityDataMeta; facilities: Facility[] };

export const facilityMeta: FacilityDataMeta = file.meta;
export const hormuzFacilities: Facility[] = file.facilities;

const byId = new Map(hormuzFacilities.map((f) => [f.id, f]));

export const FACILITY_ATTRIBUTION =
  "Facilities: © OpenStreetMap contributors (ODbL), OurAirports (public domain)";

export const KIND_LABEL: Record<FacilityKind, string> = {
  airbase: "AIRFIELD",
  heliport: "HELIPORT",
  naval_base: "NAVAL BASE",
  port: "PORT",
  military_area: "MILITARY AREA",
};

export function getFacility(id: string, list: Facility[] = hormuzFacilities): Facility | undefined {
  return list === hormuzFacilities ? byId.get(id) : list.find((f) => f.id === id);
}

export function findRunwayEnd(facility: Facility, ident: string): { runway: Runway; end: RunwayEnd } | undefined {
  for (const runway of facility.runways ?? []) {
    const end = runway.ends.find((e) => e.ident === ident);
    if (end) return { runway, end };
  }
  return undefined;
}

/** Spawn point and heading for an aircraft sitting on a runway threshold. */
export function runwayThreshold(facilityId: string, ident: string): { position: { lng: number; lat: number }; heading: number } {
  const f = getFacility(facilityId);
  const hit = f && findRunwayEnd(f, ident);
  if (!hit) throw new Error(`No runway end ${ident} at ${facilityId}`);
  return { position: { lng: hit.end.lng, lat: hit.end.lat }, heading: hit.end.headingTrue };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

export interface NearestQuery {
  kind: FacilityKind;
  use?: "military" | "civil";
  minRunwayM?: number;
}

export function nearestFacility(pos: { lat: number; lng: number }, q: NearestQuery, list: Facility[] = hormuzFacilities): Facility | undefined {
  let best: Facility | undefined;
  let bestD = Infinity;
  for (const f of list) {
    if (f.kind !== q.kind) continue;
    if (q.use && f.use !== q.use) continue;
    if (q.minRunwayM && !(f.runways ?? []).some((r) => !r.closed && r.lengthM >= q.minRunwayM!)) continue;
    const d = distanceKm(pos, f.position);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** 0 = primary base, 3 = minor; drives label/symbol zoom thresholds on the map. */
export function facilityTier(f: Facility): 0 | 1 | 2 | 3 {
  if (f.kind === "heliport") return 3;
  if (f.kind === "military_area") return 3;
  if (f.kind === "naval_base") return 0;
  if (f.kind === "port") return f.areaM2 && f.areaM2 > 1_000_000 ? 1 : 2;
  const longest = Math.max(0, ...(f.runways ?? []).map((r) => r.lengthM));
  if (f.airportType === "large_airport" || (f.use === "military" && longest >= 2000)) return 0;
  if (f.airportType === "medium_airport" || f.use === "military") return 1;
  return 2;
}

export function facilityPointsGeoJSON(list: Facility[] = hormuzFacilities): FeatureCollection<Point> {
  const features: Feature<Point>[] = list
    .filter((f) => f.kind !== "military_area")
    .map((f) => ({
      type: "Feature",
      id: undefined,
      geometry: { type: "Point", coordinates: [f.position.lng, f.position.lat] },
      properties: {
        id: f.id,
        name: f.name,
        label: shortFacilityName(f.name),
        kind: f.kind,
        use: f.use ?? (f.kind === "naval_base" ? "military" : "civil"),
        tier: facilityTier(f),
        icao: f.icao ?? "",
      },
    }));
  return { type: "FeatureCollection", features };
}

export function facilityAreasGeoJSON(list: Facility[] = hormuzFacilities): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = list
    .filter((f) => f.polygon && f.polygon.length >= 4)
    .map((f) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [f.polygon!] },
      properties: { id: f.id, name: f.name, kind: f.kind, tier: facilityTier(f) },
    }));
  return { type: "FeatureCollection", features };
}

const DEFAULT_RUNWAY_WIDTH_M = 30;

export function facilityRunwaysGeoJSON(list: Facility[] = hormuzFacilities): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const f of list) {
    for (const r of f.runways ?? []) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: r.ends.map((e) => [e.lng, e.lat]) },
        properties: { id: f.id, runway: r.id, widthM: r.widthM ?? DEFAULT_RUNWAY_WIDTH_M, closed: r.closed },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
