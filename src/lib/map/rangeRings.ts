import type { Feature, Polygon } from "geojson";

const EARTH_RADIUS_KM = 6371;

/** Points on the true geodesic circle (great-circle destination from the centre), [lng, lat], closed. */
export function geodesicCircle(lng: number, lat: number, radiusKm: number, points: number = 64): [number, number][] {
  const d = radiusKm / EARTH_RADIUS_KM;
  const phi1 = (lat * Math.PI) / 180;
  const lam1 = (lng * Math.PI) / 180;
  const out: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const brg = (i / points) * 2 * Math.PI;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(brg));
    const lam2 = lam1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(phi1), Math.cos(d) - Math.sin(phi1) * Math.sin(phi2));
    out.push([(((lam2 * 180) / Math.PI + 540) % 360) - 180, (phi2 * 180) / Math.PI]);
  }
  out[out.length - 1] = out[0];
  return out;
}

export function createCircleGeoJSON(
  lng: number,
  lat: number,
  radiusKm: number,
  points: number = 64
): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [geodesicCircle(lng, lat, radiusKm, points)] },
  };
}
