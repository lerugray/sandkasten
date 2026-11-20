export type OsintLayer = "ad" | "radar" | "nuclear";
export type OsintAffiliation = "iran" | "us" | "gulf" | "us-gulf" | "neutral";
export type OsintRangeKind = "engagement" | "detection" | "exclusion";

export interface OsintCitation {
  label: string;
  url?: string;
}

export interface OsintPlatformLink {
  /** match: the platform DB has this type; miss: the OSINT range is used and the site is ESTIMATED. */
  status: "match" | "miss";
  platformId?: number;
  platformName?: string;
  note: string;
}

export interface OsintSite {
  id: string;
  layer: OsintLayer;
  system: string;
  /** Radar type, nuclear facility type, or "sam". */
  kind: string;
  name: string;
  operator: string;
  affiliation: OsintAffiliation;
  position: { lat: number; lng: number };
  /** Facility this site is anchored to (curated placements only). */
  facilityId?: string;
  positionBasis: "source-coordinates" | "facility-anchor";
  rangeKm: number;
  rangeKind: OsintRangeKind;
  trackingRangeKm?: number;
  status: string;
  lastConfirmed?: string;
  source: string;
  citations: OsintCitation[];
  origin: "auftragstaktik" | "curated";
  /** Auftragstaktik record id and file, for Auftragstaktik-origin records. */
  originId?: string;
  platform: OsintPlatformLink;
  /** True when the platform DB has no record of the type, so the OSINT range is used as published. */
  estimated: boolean;
  notes?: string;
}

export interface OsintFacilityFields {
  affiliation: OsintAffiliation;
  function: string;
  notes?: string;
  source: string;
  citations: OsintCitation[];
  origin: "auftragstaktik" | "curated";
  originId?: string;
}

export interface OsintDataset {
  meta: {
    schema: number;
    theater: string;
    bbox: { south: number; west: number; north: number; east: number };
    generated: string;
    generator: string;
    attribution: string;
    sources: { name: string; url: string; licence: string; commit?: string; files?: string[] }[];
    counts: Record<string, number>;
    dropped: { id: string; reason: string }[];
  };
  sites: OsintSite[];
}
