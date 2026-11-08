/**
 * The player's combat record: one pure projection from the raw combat log and scenario messages
 * to what the player may read. No simulation, no RNG, no state. Own involvement is the existing
 * review rule: an event the player's side issued, or that touches one of the player's units.
 * Enemy names come only from the player's own contacts (classified name, else track label, else
 * UNKNOWN TRACK); this is today's contact picture, not a reconstruction of what was known then.
 */
import type { Unit } from "@/types/game";
import type { CombatEvent, WeaponInFlight } from "./combat";
import type { Contact } from "./gameState";
import type { EventMessage } from "@/lib/ai/events";

export const CLS_LABEL: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

export const RECORD_PAGE_SIZE = 20;

export type RecordCategory = "all" | "combat" | "intel";
export type RecordScope = "run" | "turn";

export interface RecordRow {
  /** The source event or message id, unchanged. */
  id: string;
  kind: "combat" | "intel";
  type: CombatEvent["type"] | "intel";
  time: number;
  /** Readable event name: LAUNCH, DEFENDED, HIT, MISS, DAMAGED, LOST, KILL, INTERCEPT, INTEL. */
  tag: string;
  text: string;
  alarm: boolean;
  /** Own units this row names or touches (the only units a row may offer to inspect). */
  ownUnitIds: string[];
  /** GOD view only: not part of the player's ordinary record. */
  debug: boolean;
}

export interface RecordInput {
  combatLog: CombatEvent[];
  messages: EventMessage[];
  units: Unit[];
  contacts: Contact[];
  playerSide: string;
  godMode: boolean;
  trackNumber: (contactId: string) => string;
}

export function ownIdSet(units: Unit[], playerSide: string): Set<string> {
  return new Set(units.filter((u) => u.side === playerSide).map((u) => u.id));
}

/** The existing review rule for "this concerns the player". */
export function isOwnInvolved(e: CombatEvent, playerSide: string, own: Set<string>): boolean {
  return e.side === playerSide || (!!e.targetId && own.has(e.targetId)) || (!!e.unitId && own.has(e.unitId));
}

/**
 * Player-visible name for a contact. A classified `platformName` is used only when it is not the
 * true hull name (the sensor stub currently copies the unit name on classify; that must not leak).
 * Otherwise: track label with classification. No contact → UNKNOWN TRACK.
 */
export function contactDisplayName(
  contact: Contact | undefined,
  trackNumber: (contactId: string) => string,
  trueName?: string,
): string {
  if (!contact) return "UNKNOWN TRACK";
  if (contact.platformName && contact.platformName !== trueName) return contact.platformName;
  return `TN${trackNumber(contact.id)} ${CLS_LABEL[contact.classification]}`;
}

/** Replacement for every non-player unit name: classified name, else track label, else UNKNOWN TRACK. */
export function buildFog(input: Pick<RecordInput, "units" | "contacts" | "playerSide" | "godMode" | "trackNumber">): (text: string) => string {
  if (input.godMode) return (t) => t;
  const byUnit = new Map(input.contacts.map((c) => [c.actualUnitId, c]));
  const pairs = input.units
    .filter((u) => u.side !== input.playerSide)
    .map((u) => {
      const c = byUnit.get(u.id);
      return [u.name, contactDisplayName(c, input.trackNumber, u.name)] as const;
    })
    .sort((a, b) => b[0].length - a[0].length);
  return (text) => pairs.reduce((acc, [name, label]) => acc.split(name).join(label), text);
}

const EVENT_NAME: Record<CombatEvent["type"], string> = {
  launch: "LAUNCH",
  intercept: "INTERCEPT",
  hit: "HIT",
  miss: "MISS",
  destroyed: "KILL",
  damaged: "DAMAGED",
  defended: "DEFENDED",
};

/** The scenario's authored INTEL line (title and text), as shown in the record. */
export function intelText(m: Pick<EventMessage, "title" | "text">): string {
  return `${m.title ? m.title.toUpperCase() + "  " : ""}${m.text.toUpperCase()}`;
}

/**
 * Every retained eligible row in source order: combat events in log order, messages in list order,
 * merged by time with the combat event first at an equal timestamp. In GOD view the rows the player
 * could not otherwise see are added, flagged `debug`, with true names; turning GOD off removes them.
 */
export function projectRecord(input: RecordInput): RecordRow[] {
  const { playerSide, godMode } = input;
  const own = ownIdSet(input.units, playerSide);
  const fog = buildFog(input);
  const rows: (RecordRow & { seq: number })[] = [];

  input.combatLog.forEach((e, i) => {
    const involved = isOwnInvolved(e, playerSide, own);
    if (!involved && !godMode) return;
    const lost = e.type === "destroyed" && !!e.targetId && own.has(e.targetId);
    let text = fog(e.description);
    // a hostile ship's countermeasure choice is its own business: the player sees that it defended, not how
    if (e.type === "defended" && e.side !== playerSide && !godMode) text = text.replace(/ with .*$/, " with a defensive system");
    rows.push({
      id: e.id,
      kind: "combat",
      type: e.type,
      time: e.time,
      tag: lost ? "LOST" : EVENT_NAME[e.type] ?? e.type.toUpperCase(),
      text: text.toUpperCase(),
      alarm: e.side !== playerSide && (e.type === "launch" || e.type === "hit" || e.type === "destroyed" || e.type === "damaged"),
      ownUnitIds: [...new Set([e.unitId, e.targetId].filter((id): id is string => !!id && own.has(id)))],
      debug: !involved,
      seq: i,
    });
  });

  input.messages.forEach((m, i) => {
    const mine = m.side === playerSide;
    if (!mine && !godMode) return;
    rows.push({ id: m.id, kind: "intel", type: "intel", time: m.time, tag: "INTEL", text: intelText(m), alarm: false, ownUnitIds: [], debug: !mine, seq: input.combatLog.length + i });
  });

  return rows.sort((a, b) => a.time - b.time || a.seq - b.seq).map((r) => ({
    id: r.id, kind: r.kind, type: r.type, time: r.time, tag: r.tag, text: r.text, alarm: r.alarm, ownUnitIds: r.ownUnitIds, debug: r.debug,
  }));
}

export interface RecordFilter {
  category: RecordCategory;
  /** An own unit id, or null for all. */
  unitId: string | null;
  /** The ids of the last resolved turn, or null for the whole run. */
  scopeIds: Set<string> | null;
}

export const NO_FILTER: RecordFilter = { category: "all", unitId: null, scopeIds: null };

export function filterRecord(rows: RecordRow[], f: RecordFilter): RecordRow[] {
  return rows.filter(
    (r) =>
      (f.category === "all" || r.kind === f.category) &&
      (f.unitId === null || r.ownUnitIds.includes(f.unitId)) &&
      (f.scopeIds === null || f.scopeIds.has(r.id))
  );
}

export function describeFilter(f: RecordFilter, unitName: (id: string) => string): string {
  const parts: string[] = [];
  if (f.category !== "all") parts.push(f.category.toUpperCase());
  if (f.unitId) parts.push(unitName(f.unitId).toUpperCase());
  if (f.scopeIds) parts.push("LAST RESOLVED TURN");
  return parts.length ? parts.join(" + ") : "NONE";
}

export interface PageWindow {
  page: number;
  pages: number;
  /** 1-based, inclusive; both 0 when there is nothing to show. */
  from: number;
  to: number;
  atLatest: boolean;
}

/** Oldest-first pages. `page` null follows the latest page; an explicit index never moves when new rows arrive. */
export function pageWindow(total: number, page: number | null, pageSize = RECORD_PAGE_SIZE): PageWindow {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = page === null ? pages - 1 : Math.min(Math.max(0, page), pages - 1);
  return { page: p, pages, from: total === 0 ? 0 : p * pageSize + 1, to: Math.min(total, (p + 1) * pageSize), atLatest: p === pages - 1 };
}

export interface WeaponRow {
  id: string;
  own: boolean;
  debug: boolean;
  label: string;
}

/**
 * Weapons in flight the player may read about: its own, and any aimed at one of its units. An incoming
 * weapon is labelled generically (the player's data does not identify it). GOD view adds the rest, flagged.
 */
export function visibleWeapons(wifs: WeaponInFlight[], input: Pick<RecordInput, "units" | "contacts" | "playerSide" | "godMode" | "trackNumber">): WeaponRow[] {
  const own = ownIdSet(input.units, input.playerSide);
  const fog = buildFog(input);
  const nameOf = (id: string) => {
    const u = input.units.find((x) => x.id === id);
    return u ? fog(u.name).toUpperCase() : "UNKNOWN TRACK";
  };
  const rows: WeaponRow[] = [];
  for (const w of wifs) {
    const mine = w.launchedBySide === input.playerSide;
    const incoming = !mine && own.has(w.targetId);
    if (mine) rows.push({ id: w.id, own: true, debug: false, label: `${w.name} -> ${nameOf(w.targetId)}` });
    else if (incoming) rows.push({ id: w.id, own: false, debug: false, label: input.godMode ? `${w.name} -> ${nameOf(w.targetId)}` : `INCOMING WEAPON -> ${nameOf(w.targetId)}` });
    else if (input.godMode) rows.push({ id: w.id, own: false, debug: true, label: `${w.name} -> ${nameOf(w.targetId)}` });
  }
  return rows;
}

export interface OwnForce {
  total: number;
  damaged: number;
  missionKill: number;
  lost: number;
  /** Own units that are not undamaged, worst first. */
  affected: { id: string; name: string; state: Unit["damageState"] }[];
}

const SEVERITY: Record<Unit["damageState"], number> = { undamaged: 0, damaged: 1, "mission-kill": 2, destroyed: 3 };

export function ownForce(units: Unit[], playerSide: string): OwnForce {
  const mine = units.filter((u) => u.side === playerSide);
  const affected = mine
    .filter((u) => u.damageState !== "undamaged")
    .map((u) => ({ id: u.id, name: u.name, state: u.damageState }))
    .sort((a, b) => SEVERITY[b.state] - SEVERITY[a.state]);
  return {
    total: mine.length,
    damaged: mine.filter((u) => u.damageState === "damaged").length,
    missionKill: mine.filter((u) => u.damageState === "mission-kill").length,
    lost: mine.filter((u) => u.damageState === "destroyed").length,
    affected,
  };
}

/** How a state change reads in a turn summary: distinct words for damage, mission kill and loss. */
export function stateWord(state: Unit["damageState"]): string {
  return state === "destroyed" ? "LOST" : state === "mission-kill" ? "MISSION KILL" : state === "damaged" ? "DAMAGED" : "UNDAMAGED";
}
