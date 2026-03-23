import type { Feature, Polygon } from "geojson";

const EARTH_RADIUS_KM = 6371;

export function createCircleGeoJSON(
  lng: number,
  lat: number,
  radiusKm: number,
  points: number = 64
): Feature<Polygon> {
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat =
      ((radiusKm / EARTH_RADIUS_KM) * Math.cos(angle) * 180) / Math.PI;
    const dLng =
      ((radiusKm / EARTH_RADIUS_KM) * Math.sin(angle) * 180) /
      Math.PI /
      Math.cos(latRad);
    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}
