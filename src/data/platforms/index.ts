import type { PlatformRecord } from "@/types/platformDb";

import arleighBurkeFlt2 from "./records/arleigh-burke-flt-ii.json";
import arleighBurkeFlt2a from "./records/arleigh-burke-flt-iia.json";
import ticonderogaBaseline3 from "./records/ticonderoga-baseline-3.json";
import nimitzCvn68 from "./records/nimitz-cvn-68.json";
import perryLongHull from "./records/oliver-hazard-perry-long-hull.json";
import fa18e from "./records/fa-18e-super-hornet.json";
import f14d from "./records/f-14d-tomcat.json";
import e2c from "./records/e-2c-hawkeye-2000.json";
import p3c from "./records/p-3c-orion-update-iii.json";
import sh60b from "./records/sh-60b-seahawk.json";
import sina from "./records/sina-class-houdong.json";
import bayandor from "./records/bayandor-class-pf-103.json";
import kaman from "./records/kaman-class-combattante-ii.json";
import iriafF4e from "./records/iriaf-f-4e-phantom-ii.json";
import iriafF14a from "./records/iriaf-f-14a-tomcat.json";
import boghammar from "./records/irgcn-boghammar-fac.json";

export const PLATFORM_RECORDS = [
  nimitzCvn68,
  ticonderogaBaseline3,
  arleighBurkeFlt2,
  arleighBurkeFlt2a,
  perryLongHull,
  fa18e,
  f14d,
  e2c,
  p3c,
  sh60b,
  sina,
  bayandor,
  kaman,
  boghammar,
  iriafF4e,
  iriafF14a,
] as unknown as PlatformRecord[];

export function getPlatformRecordBySlug(slug: string): PlatformRecord | undefined {
  return PLATFORM_RECORDS.find((r) => r.slug === slug);
}

// Resolves a first-party slug, a legacy engine number, or an engine id.
export function getPlatformRecord(idOrSlug: number | string): PlatformRecord | undefined {
  if (typeof idOrSlug === "string" && Number.isNaN(Number(idOrSlug))) {
    return getPlatformRecordBySlug(idOrSlug);
  }
  const n = Number(idOrSlug);
  return PLATFORM_RECORDS.find((r) => r.legacyIds.includes(n) || r.engineId === n);
}
