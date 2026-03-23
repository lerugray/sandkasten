/**
 * Doctrine system — governs tactical behavior at side, mission, and unit levels.
 * Most specific level wins (unit > mission > side).
 *
 * See GDD Section 6.2 for design rationale.
 */

export interface Doctrine {
  roe: "weapons-free" | "weapons-tight" | "weapons-hold";
  engagementRange: "max" | "moderate" | "close";
  radarUsage: "active" | "passive" | "mixed";
  evasion: "none" | "if-attacked" | "always";
  withdrawOnDamage: "never" | "damaged" | "mission-killed";
  bvrWvr: "bvr" | "wvr";
}

export const DEFAULT_DOCTRINE: Doctrine = {
  roe: "weapons-tight",
  engagementRange: "max",
  radarUsage: "active",
  evasion: "if-attacked",
  withdrawOnDamage: "damaged",
  bvrWvr: "bvr",
};

/**
 * Resolve effective doctrine for a unit by cascading:
 * side defaults → mission overrides → unit overrides
 */
export function resolveDoctrine(
  sideDoctrine?: Partial<Doctrine>,
  missionDoctrine?: Partial<Doctrine>,
  unitDoctrine?: Partial<Doctrine>
): Doctrine {
  return {
    ...DEFAULT_DOCTRINE,
    ...sideDoctrine,
    ...missionDoctrine,
    ...unitDoctrine,
  };
}

/**
 * Should this unit engage detected contacts?
 */
export function shouldEngage(doctrine: Doctrine, isUnderAttack: boolean): boolean {
  switch (doctrine.roe) {
    case "weapons-free":
      return true;
    case "weapons-tight":
      return isUnderAttack;
    case "weapons-hold":
      return false;
  }
}

/**
 * Get engagement range as a fraction of max weapon range.
 */
export function getEngagementRangeFraction(doctrine: Doctrine): number {
  switch (doctrine.engagementRange) {
    case "max":
      return 1.0;
    case "moderate":
      return 0.5;
    case "close":
      return 0.25;
  }
}

/**
 * Should radar be active based on doctrine and current situation?
 */
export function shouldRadarBeActive(
  doctrine: Doctrine,
  hasContacts: boolean
): boolean {
  switch (doctrine.radarUsage) {
    case "active":
      return true;
    case "passive":
      return false;
    case "mixed":
      return hasContacts;
  }
}

/**
 * Should unit evade (turn away from threats)?
 */
export function shouldEvade(doctrine: Doctrine, isUnderAttack: boolean): boolean {
  switch (doctrine.evasion) {
    case "none":
      return false;
    case "if-attacked":
      return isUnderAttack;
    case "always":
      return true;
  }
}

/**
 * Should unit withdraw based on damage state?
 */
export function shouldWithdraw(
  doctrine: Doctrine,
  damageState: string
): boolean {
  switch (doctrine.withdrawOnDamage) {
    case "never":
      return false;
    case "damaged":
      return damageState === "damaged" || damageState === "mission-kill";
    case "mission-killed":
      return damageState === "mission-kill";
  }
}
