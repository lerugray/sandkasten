/**
 * Combat resolution system.
 *
 * Handles weapon selection, missile launch, flight, intercept, defense,
 * and damage application. Runs as Phase 5 in the simulation tick.
 *
 * Flow: weapon selection → launch → flight → defense roll → PK roll → damage
 *
 * Every shot, whether it is the player's ENGAGE order or an ROE auto-fire for any side,
 * goes through validateEngagement and works from the shooter's own contact, never from
 * the true position of the target.
 */

import type { Unit, Position } from "@/types/game";
import { isHostileSide } from "@/types/game";
import { contactsFor, type Contact, type GameState } from "./gameState";
import { distanceKm, bearingDeg, moveAlongBearing } from "./movement";
import { getPlatform, type PlatformWeapon, type PlatformDefense } from "@/lib/platforms/lookup";
import { getEngagementRangeFraction, type Doctrine } from "@/lib/ai/doctrine";
import { resolveUnitDoctrine } from "@/lib/ai/effectiveDoctrine";
import type { Mission } from "@/lib/ai/missions";

const KM_PER_NM = 1.852;

/** What combat needs to know about the scenario: missions and the authored side doctrine. */
export interface DoctrineContext {
  missions: Mission[];
  sideDoctrine: Record<string, Partial<Doctrine>>;
}

/**
 * Deliberate rule, separate from cumulative damage: an aircraft is destroyed outright by a
 * single hit whose warhead is at least this share of its damage points.
 */
export const AIRCRAFT_ONE_HIT_RATIO = 0.3;

/** Share of a platform's damage points at which a unit changes state (cumulative total). */
export const DAMAGED_RATIO = 0.15;
export const MISSION_KILL_RATIO = 0.5;
export const DESTROYED_RATIO = 0.8;

export type DamageState = Unit["damageState"];

export function damageStateFor(totalDamage: number, damagePoints: number): DamageState {
  const ratio = totalDamage / Math.max(1, damagePoints);
  if (ratio >= DESTROYED_RATIO) return "destroyed";
  if (ratio >= MISSION_KILL_RATIO) return "mission-kill";
  if (ratio >= DAMAGED_RATIO) return "damaged";
  return "undamaged";
}

const STATE_RANK: Record<DamageState, number> = { undamaged: 0, damaged: 1, "mission-kill": 2, destroyed: 3 };
const STATE_FLOOR: Record<DamageState, number> = {
  undamaged: 0,
  damaged: DAMAGED_RATIO,
  "mission-kill": MISSION_KILL_RATIO,
  destroyed: DESTROYED_RATIO,
};

/** Whether a defence has any chance against this weapon's seeker or flight profile. */
export function defenseApplies(defense: PlatformDefense, weapon: PlatformWeapon): boolean {
  if (weapon.type === "gun") return false;
  const radarSeeker = weapon.seekerType === "active-radar" || weapon.seekerType === "semi-active";
  switch (defense.type) {
    case "chaff":
      return radarSeeker;
    case "ecm":
      return radarSeeker || weapon.seekerType === "anti-radiation";
    case "ciws":
      return weapon.type === "asm" || weapon.type === "sam" || weapon.type === "aam";
    case "decoy":
      return weapon.type === "torpedo";
  }
}

/** Air or surface, from the platform, not from the instantaneous altitude. */
function isAirUnit(unit: Unit): boolean {
  const platform = getPlatform(unit.platformId);
  return platform ? platform.dimension === "air" : (unit.altitude ?? 0) > 500;
}

// --- Weapon in flight ---

export interface WeaponInFlight {
  id: string;
  name: string;
  launchedBy: string; // unit ID
  launchedBySide: string;
  targetId: string;
  position: Position;
  heading: number;
  speedKts: number;
  rangeRemainingKm: number;
  weapon: PlatformWeapon;
  // Terminal phase
  seekerActive: boolean;
  seekerRangeKm: number;
}

// --- Combat event log ---

export interface CombatEvent {
  id: string;
  time: number; // sim time
  type: "launch" | "intercept" | "hit" | "miss" | "destroyed" | "damaged" | "defended";
  description: string;
  unitId?: string;
  targetId?: string;
  side: string;
}

// --- Combat state (tracked between ticks) ---

export interface CombatState {
  weaponsInFlight: WeaponInFlight[];
  combatLog: CombatEvent[];
  weaponsExpended: Map<string, Map<string, number>>; // unitId → weaponName → count fired
  /** Expendable defences used so far: unitId → defence name → count. */
  defensesExpended: Map<string, Map<string, number>>;
  cooldowns: Map<string, number>; // unitId → next allowed fire time (sim ms)
}

export function createCombatState(): CombatState {
  return {
    weaponsInFlight: [],
    combatLog: [],
    weaponsExpended: new Map(),
    defensesExpended: new Map(),
    cooldowns: new Map(),
  };
}

// --- Engagement check interval ---

const ENGAGEMENT_INTERVAL_MS = 5000;
const SALVO_COOLDOWN_MS = 30000;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Run the full combat phase.
 * Weapons fly every call; the launch decisions run on the state's own schedule.
 */
export function runCombatPhase(
  state: GameState,
  combatState: CombatState,
  ctx: DoctrineContext,
  dtSeconds: number
): { state: GameState; combatState: CombatState } {
  let newState = state;
  let newCombat: CombatState = { ...combatState, weaponsInFlight: [...combatState.weaponsInFlight] };

  // 1. Move weapons in flight
  const moveResult = moveWeapons(newCombat, newState, dtSeconds);
  newCombat = moveResult.combatState;
  newState = moveResult.state;

  // 2. Check for new engagements, once per interval of simulated time
  const due = newState.schedule.engageAt;
  if (newState.simTime >= due) {
    const next = due + ENGAGEMENT_INTERVAL_MS * (Math.floor((newState.simTime - due) / ENGAGEMENT_INTERVAL_MS) + 1);
    newState = { ...newState, schedule: { ...newState.schedule, engageAt: next } };
    newCombat = checkEngagements(newState, newCombat, ctx);
  }

  return { state: newState, combatState: newCombat };
}

// --- Weapon movement ---

function moveWeapons(
  combatState: CombatState,
  state: GameState,
  dtSeconds: number
): { combatState: CombatState; state: GameState } {
  const surviving: WeaponInFlight[] = [];
  const newLog = [...combatState.combatLog];
  const defensesExpended = new Map(combatState.defensesExpended);
  let newState = state;

  // Weapons arriving in the same step all find the target as it was when the step began
  const startUnits = new Map(state.sides.flatMap((s) => s.units).map((u) => [u.id, u]));

  for (const wif of combatState.weaponsInFlight) {
    const distKm = (wif.speedKts * KM_PER_NM * dtSeconds) / 3600;
    const newRange = wif.rangeRemainingKm - distKm;

    const startTarget = startUnits.get(wif.targetId);
    if (!startTarget || startTarget.damageState === "destroyed") {
      // Target gone — weapon lost
      continue;
    }
    const target = newState.sides.flatMap((s) => s.units).find((u) => u.id === wif.targetId) ?? startTarget;

    const bearing = bearingDeg(wif.position, target.position);
    const distToTarget = distanceKm(wif.position, target.position);

    // A weapon can only fly as far as it has fuel for
    const reachKm = Math.min(distKm, Math.max(0, wif.rangeRemainingKm));
    const arrived = (distToTarget <= 0.5 && wif.rangeRemainingKm >= distToTarget) || distToTarget <= reachKm;

    if (arrived) {
      const result = resolveImpact(wif, target, newState, state.simTime, defensesExpended);
      newLog.push(...result.events);
      newState = result.state;
      continue;
    }

    if (newRange <= 0) {
      newLog.push(createEvent(state.simTime, "miss",
        `${wif.name} from ${getUnitName(wif.launchedBy, newState)} ran out of fuel`,
        wif.launchedBy, wif.targetId, wif.launchedBySide));
      continue;
    }

    // Activate seeker at terminal range
    const seekerActive = distToTarget <= (wif.seekerRangeKm || 10);

    const newPos = moveAlongBearing(wif.position, bearing, distKm);
    surviving.push({
      ...wif,
      position: newPos,
      heading: bearing,
      rangeRemainingKm: newRange,
      seekerActive,
    });
  }

  return {
    combatState: { ...combatState, weaponsInFlight: surviving, combatLog: newLog, defensesExpended },
    state: newState,
  };
}

// --- Impact resolution ---

function resolveImpact(
  weapon: WeaponInFlight,
  target: Unit,
  state: GameState,
  simTime: number,
  defensesExpended: Map<string, Map<string, number>>
): { state: GameState; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  const targetPlatform = getPlatform(target.platformId);

  // 1. Run defensive systems that can act on this weapon
  const used = new Map(defensesExpended.get(target.id) ?? []);
  for (const defense of targetPlatform?.defenses ?? []) {
    if (!defenseApplies(defense, weapon.weapon)) continue;
    const spent = used.get(defense.name) ?? 0;
    if (defense.quantity !== undefined && spent >= defense.quantity) continue;

    used.set(defense.name, spent + 1);
    defensesExpended.set(target.id, used);

    if (Math.random() < defense.effectiveness) {
      events.push(createEvent(simTime, "defended",
        `${target.name} defeated ${weapon.name} with ${defense.name}`,
        target.id, weapon.launchedBy, target.side));
      return { state, events };
    }
  }

  // 2. PK roll
  const isAirTarget = isAirUnit(target);
  const pk = isAirTarget ? weapon.weapon.pkAir : weapon.weapon.pkSurface;
  const pkRoll = Math.random() * 100;

  if (pkRoll > pk) {
    events.push(createEvent(simTime, "miss",
      `${weapon.name} missed ${target.name}`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
    return { state, events };
  }

  // 3. Hit — damage accumulates on the unit
  events.push(createEvent(simTime, "hit",
    `${weapon.name} hit ${target.name}!`,
    weapon.launchedBy, target.id, weapon.launchedBySide));

  const current = state.sides.flatMap((s) => s.units).find((u) => u.id === target.id) ?? target;
  const hp = targetPlatform?.damagePoints ?? 100;
  const warhead = weapon.weapon.warheadDamage;
  const carried = Math.max(current.damage ?? 0, STATE_FLOOR[current.damageState] * hp);
  const total = carried + warhead;

  let newDamageState = damageStateFor(total, hp);
  if (isAirTarget && warhead / hp >= AIRCRAFT_ONE_HIT_RATIO) newDamageState = "destroyed";
  if (STATE_RANK[current.damageState] > STATE_RANK[newDamageState]) newDamageState = current.damageState;

  if (newDamageState === "destroyed" && current.damageState !== "destroyed") {
    events.push(createEvent(simTime, "destroyed",
      `${target.name} has been destroyed!`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
  } else if (newDamageState !== current.damageState) {
    events.push(createEvent(simTime, "damaged",
      `${target.name} is now ${newDamageState}`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
  }

  const newState: GameState = {
    ...state,
    sides: state.sides.map((s) => ({
      ...s,
      units: s.units.map((u) =>
        u.id === target.id ? { ...u, damageState: newDamageState, damage: total } : u
      ),
    })),
  };

  return { state: newState, events };
}

// --- Engagement validation (shared by the player's ENGAGE order and every ROE auto-fire) ---

export type EngagementRefusal =
  | "shooter-unknown"
  | "shooter-disabled"
  | "contact-unknown"
  | "contact-lost"
  | "not-hostile"
  | "no-weapons"
  | "no-such-weapon"
  | "wrong-domain"
  | "no-ammo"
  | "out-of-range";

export interface EngagementOptions {
  /** Weapon by name; omit to let the best one be chosen. */
  weaponName?: string;
  /** Engagement range as a fraction of weapon range (doctrine). Player orders use the full range. */
  rangeFraction?: number;
  /** Player order: the shooter's identification of the contact decides hostility, not the true side. */
  manual?: boolean;
}

export type EngagementCheck =
  | { ok: true; weapon: PlatformWeapon; target: Unit; rangeKm: number }
  | { ok: false; reason: EngagementRefusal; message: string };

const CLASS_RANK: Record<Contact["classification"], number> = { unknown: 0, detected: 1, classified: 2, tracked: 3 };

function ammoLeft(shooter: Unit, weapon: PlatformWeapon, expended: CombatState["weaponsExpended"]): number {
  return weapon.quantity - (expended.get(shooter.id)?.get(weapon.name) ?? 0);
}

function weaponCanHit(weapon: PlatformWeapon, targetIsAir: boolean): boolean {
  return (targetIsAir ? weapon.pkAir : weapon.pkSurface) > 0;
}

/**
 * Can this shooter fire at this contact? Uses the shooter's contact only: the range is
 * measured to where the contact says the target is, the way the shooter knows it.
 */
export function validateEngagement(
  state: GameState,
  combatState: CombatState,
  shooter: Unit,
  contact: Contact,
  opts: EngagementOptions = {}
): EngagementCheck {
  const refuse = (reason: EngagementRefusal, message: string): EngagementCheck => ({ ok: false, reason, message });

  if (shooter.damageState === "destroyed" || shooter.damageState === "mission-kill") {
    return refuse("shooter-disabled", `${shooter.name} is ${shooter.damageState} and cannot fire`);
  }
  if (CLASS_RANK[contact.classification] < CLASS_RANK.detected) {
    return refuse("contact-unknown", "Contact is too poorly established to engage (needs DETECTED or better)");
  }
  const target = state.sides.flatMap((s) => s.units).find((u) => u.id === contact.actualUnitId);
  if (!target || target.damageState === "destroyed") {
    return refuse("contact-lost", "Contact no longer exists");
  }
  const sideKnown = !opts.manual || CLASS_RANK[contact.classification] >= CLASS_RANK.classified;
  if (sideKnown && !isHostileSide(shooter.side, target.side)) {
    return refuse("not-hostile", `Contact is not hostile to ${shooter.side}`);
  }

  const platform = getPlatform(shooter.platformId);
  const weapons = platform?.weapons ?? [];
  if (weapons.length === 0) return refuse("no-weapons", `${shooter.name} carries no weapons`);

  const targetIsAir = isAirUnit(target);
  const dist = distanceKm(shooter.position, contact.position);
  const fraction = opts.rangeFraction ?? 1;

  const verdict = (w: PlatformWeapon): EngagementRefusal | null => {
    if (!weaponCanHit(w, targetIsAir)) return "wrong-domain";
    if (ammoLeft(shooter, w, combatState.weaponsExpended) <= 0) return "no-ammo";
    if (dist > w.rangeKm * fraction) return "out-of-range";
    return null;
  };
  const explain = (reason: EngagementRefusal, w?: PlatformWeapon): string => {
    switch (reason) {
      case "wrong-domain":
        return w ? `${w.name} cannot engage ${targetIsAir ? "air" : "surface"} targets` : `${shooter.name} has no weapon for ${targetIsAir ? "air" : "surface"} targets`;
      case "no-ammo":
        return w ? `${shooter.name} is out of ${w.name}` : `${shooter.name} is out of ammunition for this target`;
      default:
        return w
          ? `Contact is ${Math.round(dist)} km away, beyond ${w.name} range of ${Math.round(w.rangeKm * fraction)} km`
          : `Contact is ${Math.round(dist)} km away, beyond every weapon ${shooter.name} can use`;
    }
  };

  if (opts.weaponName) {
    const w = weapons.find((x) => x.name === opts.weaponName);
    if (!w) return refuse("no-such-weapon", `${shooter.name} does not carry ${opts.weaponName}`);
    const reason = verdict(w);
    return reason ? refuse(reason, explain(reason, w)) : { ok: true, weapon: w, target, rangeKm: dist };
  }

  const usable = weapons.filter((w) => verdict(w) === null);
  if (usable.length === 0) {
    const forDomain = weapons.filter((w) => weaponCanHit(w, targetIsAir));
    if (forDomain.length === 0) return refuse("wrong-domain", explain("wrong-domain"));
    if (forDomain.every((w) => ammoLeft(shooter, w, combatState.weaponsExpended) <= 0)) {
      return refuse("no-ammo", explain("no-ammo"));
    }
    return refuse("out-of-range", explain("out-of-range"));
  }
  // Prefer guided weapons over guns, higher PK first
  usable.sort((a, b) => {
    if (a.type !== "gun" && b.type === "gun") return -1;
    if (a.type === "gun" && b.type !== "gun") return 1;
    return (targetIsAir ? b.pkAir - a.pkAir : b.pkSurface - a.pkSurface);
  });
  return { ok: true, weapon: usable[0], target, rangeKm: dist };
}

// --- Launching ---

function launchSalvo(
  state: GameState,
  combatState: CombatState,
  shooter: Unit,
  contact: Contact,
  check: Extract<EngagementCheck, { ok: true }>
): { combatState: CombatState; message: string } {
  const { weapon, target } = check;
  const available = ammoLeft(shooter, weapon, combatState.weaponsExpended);
  const salvoSize = computeSalvoSize(weapon, target, available);
  const heading = bearingDeg(shooter.position, contact.position);

  const launched: WeaponInFlight[] = [];
  for (let i = 0; i < salvoSize; i++) {
    const offset = (i - (salvoSize - 1) / 2) * 0.002;
    launched.push({
      id: nextId("wif"),
      name: weapon.name,
      launchedBy: shooter.id,
      launchedBySide: shooter.side,
      targetId: target.id,
      position: { lat: shooter.position.lat + offset, lng: shooter.position.lng + offset },
      heading,
      speedKts: weapon.speedKts > 0 ? weapon.speedKts : 530,
      rangeRemainingKm: weapon.rangeKm,
      weapon,
      seekerActive: false,
      seekerRangeKm: weapon.seekerType === "active-radar" ? 10 : 5,
    });
  }

  const expended = new Map(combatState.weaponsExpended);
  const unitExpended = new Map(expended.get(shooter.id) ?? []);
  unitExpended.set(weapon.name, (unitExpended.get(weapon.name) ?? 0) + salvoSize);
  expended.set(shooter.id, unitExpended);

  const cooldowns = new Map(combatState.cooldowns);
  cooldowns.set(shooter.id, state.simTime + SALVO_COOLDOWN_MS);

  const label = salvoSize > 1 ? `${salvoSize}× ${weapon.name}` : weapon.name;
  const targetName = contact.platformName ?? `contact ${contact.id}`;
  const message = `${shooter.name} launched ${label} at ${targetName}`;
  const event = createEvent(state.simTime, "launch", `${shooter.name} launched ${label} at ${target.name}`, shooter.id, target.id, shooter.side);

  return {
    combatState: {
      ...combatState,
      weaponsInFlight: [...combatState.weaponsInFlight, ...launched],
      combatLog: [...combatState.combatLog, event],
      weaponsExpended: expended,
      cooldowns,
    },
    message,
  };
}

export interface EngageOrder {
  shooterId: string;
  contactId: string;
  weaponName?: string;
}

export interface EngageResult {
  combatState: CombatState;
  ok: boolean;
  reason?: EngagementRefusal | "shooter-unknown" | "contact-unknown";
  message: string;
}

/**
 * The player's ENGAGE order: fire at one of the shooter's own contacts.
 * The order ignores the automatic-fire cooldown but sets it, so ROE does not double the salvo.
 */
export function engageContact(
  state: GameState,
  combatState: CombatState,
  order: EngageOrder,
  _ctx?: DoctrineContext
): EngageResult {
  const shooter = state.sides.flatMap((s) => s.units).find((u) => u.id === order.shooterId);
  if (!shooter) return { combatState, ok: false, reason: "shooter-unknown", message: "No such unit" };

  const contact = contactsFor(state, shooter.side).find((c) => c.id === order.contactId);
  if (!contact) return { combatState, ok: false, reason: "contact-unknown", message: "No such contact" };

  const check = validateEngagement(state, combatState, shooter, contact, { weaponName: order.weaponName, manual: true });
  if (!check.ok) return { combatState, ok: false, reason: check.reason, message: check.message };

  const launch = launchSalvo(state, combatState, shooter, contact, check);
  return { combatState: launch.combatState, ok: true, message: launch.message };
}

// --- Automatic fire under rules of engagement ---

function checkEngagements(state: GameState, combatState: CombatState, ctx: DoctrineContext): CombatState {
  let combat = combatState;

  for (const side of state.sides) {
    const contacts = contactsFor(state, side.name);
    if (contacts.length === 0) continue;

    for (const unit of side.units) {
      if (unit.damageState === "destroyed" || unit.damageState === "mission-kill") continue;
      if (state.simTime < (combat.cooldowns.get(unit.id) ?? 0)) continue;
      if (!getPlatform(unit.platformId)?.weapons?.length) continue;

      const doctrine = resolveUnitDoctrine(unit, state, ctx);
      if (doctrine.roe === "weapons-hold") continue;

      const inbound = combat.weaponsInFlight.filter((w) => w.targetId === unit.id && isHostileSide(unit.side, w.launchedBySide));
      const minClass = doctrine.roe === "weapons-free" ? CLASS_RANK.detected : CLASS_RANK.classified;
      if (doctrine.roe === "weapons-tight" && inbound.length === 0) continue;

      const attackers = new Set(inbound.map((w) => w.launchedBy));
      const candidates = contacts
        .filter((c) => CLASS_RANK[c.classification] >= minClass)
        .sort((a, b) => {
          const pa = attackers.has(a.actualUnitId) ? 0 : 1;
          const pb = attackers.has(b.actualUnitId) ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return distanceKm(unit.position, a.position) - distanceKm(unit.position, b.position);
        });

      const rangeFraction = getEngagementRangeFraction(doctrine);
      for (const contact of candidates) {
        if (combat.weaponsInFlight.some((w) => w.launchedBy === unit.id && w.targetId === contact.actualUnitId)) continue;
        const check = validateEngagement(state, combat, unit, contact, { rangeFraction });
        if (!check.ok) continue;
        combat = launchSalvo(state, combat, unit, contact, check).combatState;
        break; // one engagement per cycle per unit
      }
    }
  }

  return combat;
}

export function computeSalvoSize(
  weapon: PlatformWeapon,
  target: Unit,
  availableAmmo: number
): number {
  const targetPlatform = getPlatform(target.platformId);
  const missileDefense = targetPlatform?.missileDefense ?? 0;

  // Guns fire single rounds per engagement cycle
  if (weapon.type === "gun") return 1;

  // Aircraft and small craft with little/no missile defense: 1-2 shots
  if (missileDefense <= 1) return Math.min(2, availableAmmo);

  // Surface combatants: 2x their missile defense value, clamped
  const desired = missileDefense * 2;
  return Math.min(Math.max(desired, 2), 8, availableAmmo);
}

// --- Helpers ---

function createEvent(
  time: number,
  type: CombatEvent["type"],
  description: string,
  unitId: string | undefined,
  targetId: string | undefined,
  side: string
): CombatEvent {
  return { id: nextId("ce"), time, type, description, unitId, targetId, side };
}

function getUnitName(unitId: string, state: GameState): string {
  const unit = state.sides.flatMap((s) => s.units).find((u) => u.id === unitId);
  return unit?.name ?? unitId;
}
