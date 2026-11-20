// Local equirectangular projection for the tactical plot. Plot units are km,
// x east and y north of the theater origin. Good to well under 1% across a
// theater the size of the Gulf, which is finer than anything the plot draws.

export interface GeoPoint {
  lng: number;
  lat: number;
}

const KM_PER_DEG_LAT = 110.574;

export class PlotProjection {
  readonly origin: GeoPoint;
  private readonly kx: number;

  constructor(origin: GeoPoint) {
    this.origin = origin;
    this.kx = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  }

  x(lng: number): number {
    return (lng - this.origin.lng) * this.kx;
  }

  y(lat: number): number {
    return (lat - this.origin.lat) * KM_PER_DEG_LAT;
  }

  toGeo(x: number, y: number): GeoPoint {
    return {
      lng: this.origin.lng + x / this.kx,
      lat: this.origin.lat + y / KM_PER_DEG_LAT,
    };
  }
}

export const KM_PER_NM = 1.852;
export const FT_TO_KM = 0.0003048;
