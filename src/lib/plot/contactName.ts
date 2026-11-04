// One naming rule for a contact everywhere the player reads it (plot, contact
// list, traffic): its track number until it is classified, then its platform
// name. The sim sets platformName when it first holds the contact at classified
// range; a contact upgraded to CLS/TRK later shows its platform class instead.
import type { Contact } from "@/lib/simulation/gameState";
import type { Unit } from "@/types/game";
import { getPlatform } from "@/lib/platforms/lookup";

export function trackNumber(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return String(1000 + (Math.abs(h) % 9000));
}

export const CLS_LABEL: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

export function isClassified(c: Contact): boolean {
  return c.classification === "classified" || c.classification === "tracked";
}

export function contactName(c: Contact, unitOf: (id: string) => Unit | undefined): string {
  if (!isClassified(c)) return `TN${trackNumber(c.id)}`;
  if (c.platformName) return c.platformName;
  const u = unitOf(c.actualUnitId);
  const pl = u ? getPlatform(u.platformId) : undefined;
  return pl ? pl.name.split("[")[0].trim() : `TN${trackNumber(c.id)}`;
}
