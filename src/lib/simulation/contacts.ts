import type { Contact } from "./gameState";

/** A contact with no report for this long is dropped. */
export const CONTACT_LOST_MS = 120_000;
/** A precise fix older than this is no longer a firm track. */
export const TRACK_STALE_MS = 60_000;
/** Position uncertainty starts growing this long after the last fix. */
export const UNCERTAINTY_GRACE_MS = 30_000;
/** Growth of the uncertainty circle per simulated second once stale (km/s, about 190 kt). */
export const UNCERTAINTY_GROWTH_KM_PER_S = 0.1;

/**
 * Age a side's contacts to the given simulation time. The result depends only on
 * simulated time since the last fix, never on how many callbacks produced it.
 */
export function ageContacts(contacts: Contact[], simTime: number): Contact[] {
  const out: Contact[] = [];
  for (const c of contacts) {
    if (simTime - c.lastUpdateTime > CONTACT_LOST_MS) continue;

    const base = c.baseUncertainty ?? c.positionUncertainty;
    const fixTime = c.lastFixTime ?? c.lastUpdateTime;
    const fixAge = simTime - fixTime;
    const staleMs = Math.max(0, fixAge - UNCERTAINTY_GRACE_MS);
    const uncertainty = base + (UNCERTAINTY_GROWTH_KM_PER_S * staleMs) / 1000;
    const classification =
      c.classification === "tracked" && fixAge > TRACK_STALE_MS ? "classified" : c.classification;

    if (
      uncertainty === c.positionUncertainty &&
      classification === c.classification &&
      c.baseUncertainty === base &&
      c.lastFixTime === fixTime
    ) {
      out.push(c);
    } else {
      out.push({ ...c, classification, positionUncertainty: uncertainty, baseUncertainty: base, lastFixTime: fixTime });
    }
  }
  return out;
}
