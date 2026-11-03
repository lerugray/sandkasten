import { distanceNm, distanceKm, bearingDeg } from "@/lib/simulation/movement";

export interface MeasurePoint {
  lng: number;
  lat: number;
}

export function formatMeasurement(
  start: MeasurePoint,
  end: MeasurePoint
): string {
  const nm = distanceNm(start, end);
  const km = distanceKm(start, end);
  const brg = bearingDeg(start, end);
  return `${nm.toFixed(1)} nm / ${km.toFixed(1)} km • ${brg.toFixed(0)}°`;
}
