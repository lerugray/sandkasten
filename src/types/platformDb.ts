// Sandkasten first-party platform database. Every record is compiled from
// public sources listed in its own `sources[]`. Nothing here comes from CMO.

export type Provenance = "verified" | "estimated";
export type PlatformDomain = "surface" | "sub" | "fixed-wing" | "rotary" | "ground" | "missile";
export type PlatformDimension = "sea" | "air" | "ground";
export type PhotoLicense = "Public Domain" | "US-Gov" | "CC0" | "CC BY" | "CC BY-SA";
export type Grade = "very-low" | "low" | "medium" | "high" | "very-high";

export interface PlatformSource {
  id: string; // e.g. "s1"
  title: string;
  publisher: string;
  year: number;
  url: string;
}

export interface PlatformPhoto {
  localPath: string; // path under public/, e.g. "/platforms/<slug>/main.jpg"
  caption: string;
  sourceUrl: string;
  author: string;
  license: PhotoLicense;
  licenseUrl: string;
  attributionLine: string;
}

export interface SpecBlock {
  sourceId: string;
  provenance: Provenance;
}

export interface PlatformDimensions extends SpecBlock {
  lengthM?: number;
  beamM?: number;
  wingspanM?: number;
  draftM?: number;
  heightM?: number;
  displacementFullTons?: number;
  weightEmptyKg?: number;
  weightMaxKg?: number;
  crew: string; // text, because crews are ranges and include air wings ("c. 3,200 + air wing")
}

export interface PlatformPerformance extends SpecBlock {
  maxSpeedKts: number;
  cruiseSpeedKts?: number;
  maxAltitudeFt?: number;
  combatRadiusNm?: number;
  rangeNm?: number;
  enduranceHours?: number;
}

export interface PlatformWeaponRow {
  name: string;
  type: "asm" | "sam" | "gun" | "torpedo" | "aam";
  rangeKm: number;
  speedKts: number;
  pkAir: number; // 0-100, engine abstraction (METHODS.md)
  pkSurface: number; // 0-100, engine abstraction
  quantity: number;
  warheadDamage: number; // engine abstraction
  seekerType?: "active-radar" | "semi-active" | "ir" | "anti-radiation";
  mountSummary?: string;
  sourceId: string;
  provenance: Provenance;
}

export interface PlatformDefenseRow {
  name: string;
  type: "chaff" | "ecm" | "ciws" | "decoy";
  effectiveness: number; // 0-1, engine abstraction
  quantity?: number;
  sourceId: string;
  provenance: Provenance;
}

export interface PlatformSensorRow {
  name: string;
  type: "radar" | "esm" | "ir" | "sonar" | "visual";
  role: string;
  band?: string;
  rangeKm: number;
  canTrack: boolean;
  sourceId: string;
  provenance: Provenance;
}

export interface PlatformLoadout {
  name: string;
  role: string;
  combatRadiusNm: number;
  stores: { weaponName: string; count: number }[];
  sourceId: string;
  provenance: Provenance;
}

export interface SignatureEntry {
  grade: Grade;
  note: string;
}

export interface PlatformSignatures {
  radar: SignatureEntry;
  infrared: SignatureEntry;
  acoustic?: SignatureEntry;
  visual: SignatureEntry;
  sourceId: string;
  provenance: Provenance;
}

export interface PlatformBrief {
  whatItIs: string;
  howItIsUsed: string;
  typicalMissions: string[]; // 3-5
}

export interface PlatformRecord {
  // identity
  slug: string;
  legacyIds: number[]; // engine aliases only (numbers lookup.ts has always used)
  engineId?: number; // own engine id for records that never had a legacy number
  engineName: string; // display name the editor and engine have always used
  name: string;
  designation: string;
  className: string;
  nation: string;
  side: string; // grouping in the viewer: "US Navy" | "Iran"
  service: string;
  domain: PlatformDomain;
  dimension: PlatformDimension;
  functionId: string; // NATO symbol function code
  role: string;
  serviceWindow: { enteredService: number; retired?: number | null; statusNotes?: string };

  // physical and performance
  dimensions: PlatformDimensions;
  propulsionSummary: string;
  performance: PlatformPerformance;

  // engine-read fields (abstractions documented in METHODS.md)
  sensorRangeKm: number;
  weaponRangeKm: number;
  damagePoints: number;
  missileDefense: number;
  engineSourceId: string;
  engineProvenance: Provenance;
  weapons: PlatformWeaponRow[];
  defenses: PlatformDefenseRow[];

  sensors: PlatformSensorRow[];
  loadouts: PlatformLoadout[];
  signatures: PlatformSignatures;
  brief: PlatformBrief;

  photos: PlatformPhoto[];
  photoPlaceholderReason?: string;
  sources: PlatformSource[];
}
