/**
 * Battle save format v1: an explicit, versioned, validated file for one running battle.
 *
 * The file names a built-in configuration (id + revision) and carries only the battle's own state. Scenario,
 * mission, event and doctrine definitions and the platform data stay in the shipped game. Maps and Sets are
 * encoded as arrays. Reading a file never evaluates anything: the text is parsed as JSON and every field is
 * checked and copied into freshly built objects, so unknown keys cannot ride along.
 *
 * Optional generated InfoWar media is deliberately not part of v1.
 */

import type { Unit, Position, ReferencePoint, Side } from "@/types/game";
import type { Doctrine } from "@/lib/ai/doctrine";
import type { EventMessage, EventState, ScenarioResult } from "@/lib/ai/events";
import type { Contact, GameState, UnitOrders, Waypoint } from "./gameState";
import { SPEED_OPTIONS } from "./gameState";
import type { CombatEvent, CombatState, WeaponInFlight } from "./combat";
import type { PlatformWeapon } from "@/lib/platforms/lookup";
import { getPlatform } from "@/lib/platforms/lookup";
import type { AutopausePreferences } from "./autopause";
import type { BattleDump, FireIntent, IntentOutcome, PlayMode, TurnMinutes, TurnReport, WeGoPhase } from "./session";
import { WEGO_TURN_MINUTES } from "./session";
import { builtinRevision, getBuiltinConfig, isBuiltinId, type BuiltinId } from "@/lib/scenarios/builtins";
import type { ScenarioConfig } from "./session";

export const SAVE_FORMAT = "sandkasten-battle-save";
export const SAVE_VERSION = 1;
/** A battle file larger than this is refused before it is parsed. */
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const SAVE_FILE_SUFFIX = ".sandsave.json";

const MAX_ITEMS = 50_000;
const MAX_TEXT = 4_000;

/** What the load dialog shows before anything is replaced. Derived from the validated state, not trusted from the file. */
export interface SavePreview {
  configId: BuiltinId;
  scenarioName: string;
  simTime: number;
  startTime: number;
  elapsedMs: number;
  result: "victory" | "defeat" | "draw" | null;
  resultMessage: string | null;
  mode: PlayMode;
  playerSide: string;
  savedAt: string;
}

export type SaveEnvelope = { configId: BuiltinId; configRevision: string; savedAt: string };

export type ParsedSave =
  | { ok: true; dump: BattleDump; config: ScenarioConfig; envelope: SaveEnvelope; preview: SavePreview }
  | { ok: false; error: string };

class SaveError extends Error {}
const bad = (path: string, msg: string): never => {
  throw new SaveError(`${path}: ${msg}`);
};

// --- encode -----------------------------------------------------------------------------------------------

const pairs = <K, V>(m: Map<K, V>): [K, V][] => [...m.entries()];

/** The file text for a checkpoint. `JSON.stringify` of the live state would lose every Map and Set. */
export function serializeBattle(configId: BuiltinId, dump: BattleDump, now: Date = new Date()): string {
  const g = dump.gameState;
  const e = dump.eventState;
  const c = dump.combatState;
  const file = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    configId,
    configRevision: builtinRevision(configId),
    savedAt: now.toISOString(),
    mode: dump.mode,
    turnMinutes: dump.turnMinutes,
    game: {
      scenario: g.scenario,
      simTime: g.simTime,
      speed: g.speed,
      sides: g.sides,
      contacts: g.contacts,
      sideContacts: Object.entries(g.sideContacts),
      orders: pairs(g.orders),
      referencePoints: g.referencePoints,
      score: Object.entries(g.score),
      turnNumber: g.turnNumber,
      schedule: g.schedule,
      sideDoctrineOverrides: g.sideDoctrineOverrides ? Object.entries(g.sideDoctrineOverrides) : null,
      missionDoctrineOverrides: g.missionDoctrineOverrides ? Object.entries(g.missionDoctrineOverrides) : null,
    },
    events: e
      ? {
          firedEvents: [...e.firedEvents],
          messages: e.messages,
          scenarioResult: e.scenarioResult ?? null,
          lastFired: Object.entries(e.lastFired ?? {}),
        }
      : null,
    combat: {
      weaponsInFlight: c.weaponsInFlight,
      combatLog: c.combatLog,
      weaponsExpended: pairs(c.weaponsExpended).map(([u, m]) => [u, pairs(m)]),
      defensesExpended: pairs(c.defensesExpended).map(([u, m]) => [u, pairs(m)]),
      cooldowns: pairs(c.cooldowns),
    },
    ai: {
      patrolIndex: pairs(dump.ai.patrolIndex),
      transitStarted: [...dump.ai.transitStarted],
      transitDone: [...dump.ai.transitDone],
    },
    autopausePrefs: dump.autopausePrefs,
    wego: {
      ...dump.wego,
      // the turn's combat events are entries of the log: stored by id so they cannot disagree with it
      report: dump.wego.report ? { ...dump.wego.report, events: undefined, eventIds: dump.wego.report.events.map((ev) => ev.id) } : null,
      turnLossBaseline: pairs(dump.wego.turnLossBaseline),
    },
    ids: dump.ids,
  };
  return JSON.stringify(file);
}

/** A readable, clearly named file: scenario, mission clock, wall-clock stamp. */
export function saveFileName(configId: BuiltinId, dump: BattleDump, now: Date = new Date()): string {
  const g = dump.gameState;
  const el = Math.max(0, g.simTime - g.scenario.startTime);
  const hh = String(Math.floor(el / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((el / 60000) % 60)).padStart(2, "0");
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `sandkasten-${configId}-T+${hh}h${mm}m-${stamp}${SAVE_FILE_SUFFIX}`;
}

// --- validation primitives -------------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function obj(v: unknown, path: string): Obj {
  if (!isObj(v)) bad(path, "expected an object");
  return v as Obj;
}
function arr(v: unknown, path: string, max = MAX_ITEMS): unknown[] {
  if (!Array.isArray(v)) bad(path, "expected a list");
  if ((v as unknown[]).length > max) bad(path, `too many entries (limit ${max})`);
  return v as unknown[];
}
function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== "number" || !Number.isFinite(v)) bad(path, "expected a finite number");
  const n = v as number;
  if (n < min || n > max) bad(path, `out of range (${n})`);
  return n;
}
function int(v: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = num(v, path, min, max);
  if (!Number.isInteger(n)) bad(path, "expected a whole number");
  return n;
}
function str(v: unknown, path: string, max = MAX_TEXT): string {
  if (typeof v !== "string") bad(path, "expected text");
  if ((v as string).length > max) bad(path, "text too long");
  return v as string;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") bad(path, "expected true or false");
  return v as boolean;
}
function oneOf<T extends string>(v: unknown, path: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) bad(path, `unexpected value (allowed: ${allowed.join(", ")})`);
  return v as T;
}
const optNum = (o: Obj, k: string, path: string, min?: number, max?: number) =>
  o[k] === undefined || o[k] === null ? undefined : num(o[k], `${path}.${k}`, min, max);
const optStr = (o: Obj, k: string, path: string) => (o[k] === undefined || o[k] === null ? undefined : str(o[k], `${path}.${k}`));

const BANNED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function key(v: unknown, path: string): string {
  const k = str(v, path, 400);
  if (BANNED_KEYS.has(k)) bad(path, "reserved key");
  return k;
}
function entries(v: unknown, path: string, max = MAX_ITEMS): [string, unknown][] {
  return arr(v, path, max).map((e, i) => {
    const pair = arr(e, `${path}[${i}]`, 2);
    if (pair.length !== 2) bad(`${path}[${i}]`, "expected a key/value pair");
    return [key(pair[0], `${path}[${i}][0]`), pair[1]];
  });
}
function uniqueIds(ids: string[], path: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) bad(path, `duplicate id "${id}"`);
    seen.add(id);
  }
}

const DAMAGE_STATES = ["undamaged", "damaged", "mission-kill", "destroyed"] as const;

function position(v: unknown, path: string): Position {
  const o = obj(v, path);
  return { lng: num(o.lng, `${path}.lng`, -360, 360), lat: num(o.lat, `${path}.lat`, -90, 90) };
}

function doctrinePartial(v: unknown, path: string): Partial<Doctrine> {
  const o = obj(v, path);
  const out: Partial<Doctrine> = {};
  const set = <K extends keyof Doctrine>(k: K, allowed: readonly Doctrine[K][]) => {
    if (o[k] !== undefined) out[k] = oneOf(o[k], `${path}.${k}`, allowed as readonly string[]) as Doctrine[K];
  };
  set("roe", ["weapons-free", "weapons-tight", "weapons-hold"]);
  set("engagementRange", ["max", "moderate", "close"]);
  set("radarUsage", ["active", "passive", "mixed"]);
  set("evasion", ["none", "if-attacked", "always"]);
  set("withdrawOnDamage", ["never", "damaged", "mission-killed"]);
  set("bvrWvr", ["bvr", "wvr"]);
  return out;
}

function unit(v: unknown, path: string): Unit {
  const o = obj(v, path);
  const platformId = int(o.platformId, `${path}.platformId`, 0, 1_000_000);
  if (!getPlatform(platformId)) bad(`${path}.platformId`, `unknown platform ${platformId}`);
  const u: Unit = {
    id: str(o.id, `${path}.id`, 200),
    name: str(o.name, `${path}.name`, 300),
    platformId,
    side: str(o.side, `${path}.side`, 200),
    position: position(o.position, `${path}.position`),
    heading: num(o.heading, `${path}.heading`, -720, 720),
    speed: num(o.speed, `${path}.speed`, 0, 100_000),
    damageState: oneOf(o.damageState, `${path}.damageState`, DAMAGE_STATES),
  };
  const altitude = optNum(o, "altitude", path, -1000, 200_000);
  if (altitude !== undefined) u.altitude = altitude;
  const damage = optNum(o, "damage", path, 0, 1e9);
  if (damage !== undefined) u.damage = damage;
  const mission = optStr(o, "mission", path);
  if (mission !== undefined) u.mission = mission;
  const typeCode = optStr(o, "typeCode", path);
  if (typeCode !== undefined) u.typeCode = typeCode;
  if (o.unknown === true) u.unknown = true;
  if (o.homeBase !== undefined && o.homeBase !== null) {
    const hb = obj(o.homeBase, `${path}.homeBase`);
    u.homeBase = { facilityId: str(hb.facilityId, `${path}.homeBase.facilityId`, 200) };
    const re = optStr(hb, "runwayEnd", `${path}.homeBase`);
    if (re !== undefined) u.homeBase.runwayEnd = re;
  }
  return u;
}

function contact(v: unknown, path: string): Contact {
  const o = obj(v, path);
  const c: Contact = {
    id: str(o.id, `${path}.id`, 200),
    detectedById: str(o.detectedById, `${path}.detectedById`, 200),
    actualUnitId: str(o.actualUnitId, `${path}.actualUnitId`, 200),
    side: str(o.side, `${path}.side`, 200),
    classification: oneOf(o.classification, `${path}.classification`, ["unknown", "detected", "classified", "tracked"] as const),
    position: position(o.position, `${path}.position`),
    positionUncertainty: num(o.positionUncertainty, `${path}.positionUncertainty`, 0, 1e6),
    lastUpdateTime: num(o.lastUpdateTime, `${path}.lastUpdateTime`),
    sensorType: str(o.sensorType, `${path}.sensorType`, 100),
  };
  const eh = optNum(o, "estimatedHeading", path, -720, 720);
  if (eh !== undefined) c.estimatedHeading = eh;
  const es = optNum(o, "estimatedSpeed", path, 0, 100_000);
  if (es !== undefined) c.estimatedSpeed = es;
  const pn = optStr(o, "platformName", path);
  if (pn !== undefined) c.platformName = pn;
  const lf = optNum(o, "lastFixTime", path);
  if (lf !== undefined) c.lastFixTime = lf;
  const bu = optNum(o, "baseUncertainty", path, 0, 1e6);
  if (bu !== undefined) c.baseUncertainty = bu;
  return c;
}

function orders(v: unknown, path: string): UnitOrders {
  const o = obj(v, path);
  const out: UnitOrders = {
    unitId: str(o.unitId, `${path}.unitId`, 200),
    waypoints: arr(o.waypoints, `${path}.waypoints`, 2000).map((w, i): Waypoint => {
      const wo = obj(w, `${path}.waypoints[${i}]`);
      const wp: Waypoint = { position: position(wo.position, `${path}.waypoints[${i}].position`) };
      const sp = optNum(wo, "speed", `${path}.waypoints[${i}]`, 0, 100_000);
      if (sp !== undefined) wp.speed = sp;
      const al = optNum(wo, "altitude", `${path}.waypoints[${i}]`, -1000, 200_000);
      if (al !== undefined) wp.altitude = al;
      return wp;
    }),
    throttle: int(o.throttle, `${path}.throttle`, 0, 4),
    radarActive: bool(o.radarActive, `${path}.radarActive`),
  };
  const sk = optNum(o, "speedKts", path, 0, 100_000);
  if (sk !== undefined) out.speedKts = sk;
  const da = optNum(o, "desiredAltitude", path, -1000, 200_000);
  if (da !== undefined) out.desiredAltitude = da;
  if (o.doctrine !== undefined && o.doctrine !== null) out.doctrine = doctrinePartial(o.doctrine, `${path}.doctrine`);
  return out;
}

function weapon(v: unknown, path: string): PlatformWeapon {
  const o = obj(v, path);
  const w: PlatformWeapon = {
    name: str(o.name, `${path}.name`, 300),
    type: oneOf(o.type, `${path}.type`, ["asm", "sam", "gun", "torpedo", "aam"] as const),
    rangeKm: num(o.rangeKm, `${path}.rangeKm`, 0, 1e6),
    speedKts: num(o.speedKts, `${path}.speedKts`, 0, 1e6),
    pkAir: num(o.pkAir, `${path}.pkAir`, 0, 100),
    pkSurface: num(o.pkSurface, `${path}.pkSurface`, 0, 100),
    quantity: num(o.quantity, `${path}.quantity`, 0, 1e6),
    warheadDamage: num(o.warheadDamage, `${path}.warheadDamage`, 0, 1e6),
  };
  if (o.seekerType !== undefined && o.seekerType !== null) {
    w.seekerType = oneOf(o.seekerType, `${path}.seekerType`, ["active-radar", "semi-active", "ir", "anti-radiation"] as const);
  }
  return w;
}

function nestedCounts(v: unknown, path: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [unitId, inner] of entries(v, path)) {
    if (out.has(unitId)) bad(path, `duplicate unit "${unitId}"`);
    const m = new Map<string, number>();
    for (const [name, n] of entries(inner, `${path}.${unitId}`)) {
      if (m.has(name)) bad(`${path}.${unitId}`, `duplicate entry "${name}"`);
      m.set(name, int(n, `${path}.${unitId}.${name}`, 0, 1e7));
    }
    out.set(unitId, m);
  }
  return out;
}

/** Highest trailing number of ids shaped `<prefix>-<n>`; bounds the module id counters from below. */
function maxSuffix(ids: string[], prefix: string): number {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d{1,12})$`);
  for (const id of ids) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// --- decode -----------------------------------------------------------------------------------------------

/**
 * Validate a complete battle file and build the restored state. Nothing is applied: the caller gets either a
 * dump the session can be restored from or one readable error. Any failure leaves the running battle untouched.
 */
export function parseBattle(text: string, now: () => number = Date.now): ParsedSave {
  void now;
  try {
    return { ok: true, ...decode(text) };
  } catch (e) {
    if (e instanceof SaveError) return { ok: false, error: e.message };
    return { ok: false, error: "The file could not be read as a battle save." };
  }
}

function decode(text: string): { dump: BattleDump; config: ScenarioConfig; envelope: SaveEnvelope; preview: SavePreview } {
  if (typeof text !== "string") bad("file", "not text");
  if (text.length > MAX_SAVE_BYTES) bad("file", `larger than the ${Math.round(MAX_SAVE_BYTES / 1048576)} MB limit for a battle file`);
  if (text.trim().length === 0) bad("file", "the file is empty");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return bad("file", "not a Sandkasten battle save (the text is not complete, valid JSON; a truncated copy fails here)");
  }
  const f = obj(raw, "file");
  if (f.format !== SAVE_FORMAT) bad("file", "not a Sandkasten battle save (wrong file type)");
  if (f.version !== SAVE_VERSION) bad("version", `this save is format version ${String(f.version)}; this game reads version ${SAVE_VERSION} only`);
  const configId = f.configId;
  if (!isBuiltinId(configId)) return bad("configId", `unsupported scenario "${String(configId).slice(0, 60)}"; only the built-in Hormuz battle and the real-world snapshot can be loaded`);
  if (f.configRevision !== builtinRevision(configId)) {
    bad("configRevision", "this save was made with different rules or platform data than this version of the game, so it cannot be resumed here");
  }
  const config = getBuiltinConfig(configId);
  const savedAt = str(f.savedAt, "savedAt", 64);

  const mode = oneOf(f.mode, "mode", ["continuous", "wego"] as const);
  const turnMinutes = num(f.turnMinutes, "turnMinutes") as number;
  if (!(WEGO_TURN_MINUTES as readonly number[]).includes(turnMinutes)) bad("turnMinutes", "must be 1, 5 or 15");
  if (configId === "snapshot" && mode === "wego") bad("mode", "the real-world snapshot plays continuous only");

  // --- game state ---
  const g = obj(f.game, "game");
  const sc = obj(g.scenario, "game.scenario");
  const cfgScenario = config.scenario;
  const startTime = new Date(cfgScenario.startTime).getTime();
  if (str(sc.name, "game.scenario.name") !== cfgScenario.name) bad("game.scenario.name", "does not match the built-in scenario");
  if (num(sc.startTime, "game.scenario.startTime") !== startTime) bad("game.scenario.startTime", "does not match the built-in scenario");
  if (str(sc.playerSide, "game.scenario.playerSide") !== cfgScenario.playerSide) bad("game.scenario.playerSide", "does not match the built-in scenario");
  const simTime = num(g.simTime, "game.simTime", startTime, startTime + 366 * 86_400_000);
  const speed = num(g.speed, "game.speed");
  if (!(SPEED_OPTIONS as readonly number[]).includes(speed)) bad("game.speed", "not an allowed speed");

  const sides: Side[] = arr(g.sides, "game.sides", 20).map((s, i) => {
    const so = obj(s, `game.sides[${i}]`);
    return {
      name: str(so.name, `game.sides[${i}].name`, 200),
      color: str(so.color, `game.sides[${i}].color`, 64),
      isAI: bool(so.isAI, `game.sides[${i}].isAI`),
      units: arr(so.units, `game.sides[${i}].units`).map((u, j) => unit(u, `game.sides[${i}].units[${j}]`)),
    };
  });
  const sideNames = sides.map((s) => s.name);
  uniqueIds(sideNames, "game.sides");
  const cfgSides = cfgScenario.sides.map((s) => s.name);
  if (cfgSides.length !== sideNames.length || cfgSides.some((n, i) => n !== sideNames[i])) bad("game.sides", "do not match the built-in scenario's sides");
  if (!sideNames.includes(cfgScenario.playerSide)) bad("game.scenario.playerSide", "not one of the sides");
  const allUnits = sides.flatMap((s) => s.units);
  uniqueIds(allUnits.map((u) => u.id), "game.sides.units");
  for (const s of sides) for (const u of s.units) if (u.side !== s.name) bad(`unit ${u.id}`, `belongs to side "${u.side}" but is listed under "${s.name}"`);
  const unitIds = new Set(allUnits.map((u) => u.id));

  const checkContact = (c: Contact, storeSide: string, path: string) => {
    if (c.side !== storeSide) bad(path, `contact on side "${c.side}" is stored under "${storeSide}"`);
    if (!unitIds.has(c.actualUnitId)) bad(path, `refers to unknown unit "${c.actualUnitId}"`);
    if (!unitIds.has(c.detectedById)) bad(path, `refers to unknown detecting unit "${c.detectedById}"`);
  };
  const playerSide = cfgScenario.playerSide;
  const contacts = arr(g.contacts, "game.contacts").map((c, i) => contact(c, `game.contacts[${i}]`));
  uniqueIds(contacts.map((c) => c.id), "game.contacts");
  contacts.forEach((c, i) => checkContact(c, playerSide, `game.contacts[${i}]`));
  const sideContacts: Record<string, Contact[]> = {};
  const allContactIds = contacts.map((c) => c.id);
  for (const [sname, list] of entries(g.sideContacts, "game.sideContacts", 20)) {
    if (!sideNames.includes(sname) || sname === playerSide) bad("game.sideContacts", `unexpected side "${sname}"`);
    if (sname in sideContacts) bad("game.sideContacts", `duplicate side "${sname}"`);
    const cs = arr(list, `game.sideContacts.${sname}`).map((c, i) => contact(c, `game.sideContacts.${sname}[${i}]`));
    uniqueIds(cs.map((c) => c.id), `game.sideContacts.${sname}`);
    cs.forEach((c, i) => checkContact(c, sname, `game.sideContacts.${sname}[${i}]`));
    allContactIds.push(...cs.map((c) => c.id));
    sideContacts[sname] = cs;
  }
  uniqueIds(allContactIds, "contact ids across all sides");

  const orderMap = new Map<string, UnitOrders>();
  for (const [uid, o] of entries(g.orders, "game.orders")) {
    if (orderMap.has(uid)) bad("game.orders", `duplicate orders for "${uid}"`);
    if (!unitIds.has(uid)) bad("game.orders", `orders for unknown unit "${uid}"`);
    const ord = orders(o, `game.orders.${uid}`);
    if (ord.unitId !== uid) bad(`game.orders.${uid}`, "unitId does not match its key");
    orderMap.set(uid, ord);
  }

  const referencePoints: ReferencePoint[] = arr(g.referencePoints, "game.referencePoints", 5000).map((r, i) => {
    const ro = obj(r, `game.referencePoints[${i}]`);
    const out: ReferencePoint = {
      id: str(ro.id, `game.referencePoints[${i}].id`, 200),
      name: str(ro.name, `game.referencePoints[${i}].name`, 300),
      type: oneOf(ro.type, `game.referencePoints[${i}].type`, ["point", "area"] as const),
      points: arr(ro.points, `game.referencePoints[${i}].points`, 5000).map((p, j) => position(p, `game.referencePoints[${i}].points[${j}]`)),
    };
    const side = optStr(ro, "side", `game.referencePoints[${i}]`);
    if (side !== undefined) out.side = side;
    return out;
  });
  uniqueIds(referencePoints.map((r) => r.id), "game.referencePoints");

  const score: Record<string, number> = {};
  for (const [sname, n] of entries(g.score, "game.score", 20)) {
    if (!sideNames.includes(sname)) bad("game.score", `unknown side "${sname}"`);
    if (sname in score) bad("game.score", `duplicate side "${sname}"`);
    score[sname] = num(n, `game.score.${sname}`, -1e9, 1e9);
  }
  for (const n of sideNames) if (!(n in score)) bad("game.score", `missing score for "${n}"`);

  const sch = obj(g.schedule, "game.schedule");
  const schedule = {
    detectionAt: num(sch.detectionAt, "game.schedule.detectionAt"),
    aiAt: num(sch.aiAt, "game.schedule.aiAt"),
    engageAt: num(sch.engageAt, "game.schedule.engageAt"),
  };

  const overrides = (v: unknown, path: string): Record<string, Partial<Doctrine>> | undefined => {
    if (v === null || v === undefined) return undefined;
    const out: Record<string, Partial<Doctrine>> = {};
    for (const [k, d] of entries(v, path, 5000)) {
      if (k in out) bad(path, `duplicate key "${k}"`);
      out[k] = doctrinePartial(d, `${path}.${k}`);
    }
    return out;
  };

  const gameState: GameState = {
    scenario: { name: cfgScenario.name, startTime, playerSide },
    simTime,
    isPaused: true,
    speed,
    sides,
    contacts,
    sideContacts,
    orders: orderMap,
    referencePoints,
    score,
    turnNumber: int(g.turnNumber, "game.turnNumber", 0, 1_000_000),
    schedule,
  };
  const sdo = overrides(g.sideDoctrineOverrides, "game.sideDoctrineOverrides");
  if (sdo) gameState.sideDoctrineOverrides = sdo;
  const mdo = overrides(g.missionDoctrineOverrides, "game.missionDoctrineOverrides");
  if (mdo) gameState.missionDoctrineOverrides = mdo;

  // --- events ---
  let eventState: EventState | undefined;
  const messageIds: string[] = [];
  if (config.events) {
    const e = obj(f.events, "events");
    const known = new Set(config.events.events.map((ev) => ev.name));
    const fired = new Set<string>();
    for (const name of arr(e.firedEvents, "events.firedEvents", 5000)) {
      const n = str(name, "events.firedEvents", 300);
      if (!known.has(n)) bad("events.firedEvents", `unknown event "${n}"`);
      if (fired.has(n)) bad("events.firedEvents", `duplicate event "${n}"`);
      fired.add(n);
    }
    const messages: EventMessage[] = arr(e.messages, "events.messages", 10_000).map((m, i) => {
      const mo = obj(m, `events.messages[${i}]`);
      const out: EventMessage = {
        id: str(mo.id, `events.messages[${i}].id`, 300),
        side: str(mo.side, `events.messages[${i}].side`, 200),
        text: str(mo.text, `events.messages[${i}].text`, 20_000),
        time: num(mo.time, `events.messages[${i}].time`),
        read: bool(mo.read, `events.messages[${i}].read`),
      };
      const title = optStr(mo, "title", `events.messages[${i}]`);
      if (title !== undefined) out.title = title;
      return out;
    });
    messageIds.push(...messages.map((m) => m.id));
    uniqueIds(messageIds, "events.messages");
    let scenarioResult: ScenarioResult | undefined;
    if (e.scenarioResult !== null && e.scenarioResult !== undefined) {
      const r = obj(e.scenarioResult, "events.scenarioResult");
      scenarioResult = {
        result: oneOf(r.result, "events.scenarioResult.result", ["victory", "defeat", "draw"] as const),
        message: str(r.message, "events.scenarioResult.message", 4000),
      };
      if (r.source !== undefined && r.source !== null) {
        const so = obj(r.source, "events.scenarioResult.source");
        scenarioResult.source = { event: str(so.event, "events.scenarioResult.source.event", 300) };
        const fb = optStr(so, "forcedBy", "events.scenarioResult.source");
        if (fb !== undefined) scenarioResult.source.forcedBy = fb;
        if (!known.has(scenarioResult.source.event)) bad("events.scenarioResult.source", "refers to an unknown event");
      }
    }
    const lastFired: Record<string, number> = {};
    for (const [k, t] of entries(e.lastFired, "events.lastFired", 5000)) {
      if (k in lastFired) bad("events.lastFired", `duplicate key "${k}"`);
      lastFired[k] = num(t, `events.lastFired.${k}`);
    }
    eventState = { events: config.events.events, firedEvents: fired, messages, lastFired };
    if (scenarioResult) eventState.scenarioResult = scenarioResult;
  } else if (f.events !== null && f.events !== undefined) {
    bad("events", "this scenario has no scripted events");
  }

  // --- combat ---
  const c = obj(f.combat, "combat");
  const weaponsInFlight: WeaponInFlight[] = arr(c.weaponsInFlight, "combat.weaponsInFlight", 20_000).map((w, i) => {
    const p = `combat.weaponsInFlight[${i}]`;
    const wo = obj(w, p);
    const out: WeaponInFlight = {
      id: str(wo.id, `${p}.id`, 200),
      name: str(wo.name, `${p}.name`, 300),
      launchedBy: str(wo.launchedBy, `${p}.launchedBy`, 200),
      launchedBySide: str(wo.launchedBySide, `${p}.launchedBySide`, 200),
      targetId: str(wo.targetId, `${p}.targetId`, 200),
      position: position(wo.position, `${p}.position`),
      heading: num(wo.heading, `${p}.heading`, -720, 720),
      speedKts: num(wo.speedKts, `${p}.speedKts`, 0, 1e6),
      rangeRemainingKm: num(wo.rangeRemainingKm, `${p}.rangeRemainingKm`, -1e6, 1e6),
      weapon: weapon(wo.weapon, `${p}.weapon`),
      seekerActive: bool(wo.seekerActive, `${p}.seekerActive`),
      seekerRangeKm: num(wo.seekerRangeKm, `${p}.seekerRangeKm`, 0, 1e6),
    };
    if (!unitIds.has(out.launchedBy)) bad(p, `launched by unknown unit "${out.launchedBy}"`);
    if (!unitIds.has(out.targetId)) bad(p, `aimed at unknown unit "${out.targetId}"`);
    if (!sideNames.includes(out.launchedBySide)) bad(p, `unknown side "${out.launchedBySide}"`);
    return out;
  });
  uniqueIds(weaponsInFlight.map((w) => w.id), "combat.weaponsInFlight");
  const combatLog: CombatEvent[] = arr(c.combatLog, "combat.combatLog", 200_000).map((ev, i) => {
    const p = `combat.combatLog[${i}]`;
    const eo = obj(ev, p);
    const out: CombatEvent = {
      id: str(eo.id, `${p}.id`, 200),
      time: num(eo.time, `${p}.time`),
      type: oneOf(eo.type, `${p}.type`, ["launch", "intercept", "hit", "miss", "destroyed", "damaged", "defended"] as const),
      description: str(eo.description, `${p}.description`, 4000),
      side: str(eo.side, `${p}.side`, 200),
    };
    const uid = optStr(eo, "unitId", p);
    if (uid !== undefined) out.unitId = uid;
    const tid = optStr(eo, "targetId", p);
    if (tid !== undefined) out.targetId = tid;
    return out;
  });
  uniqueIds(combatLog.map((e) => e.id), "combat.combatLog");
  const weaponsExpended = nestedCounts(c.weaponsExpended, "combat.weaponsExpended");
  const defensesExpended = nestedCounts(c.defensesExpended, "combat.defensesExpended");
  for (const uid of [...weaponsExpended.keys(), ...defensesExpended.keys()]) if (!unitIds.has(uid)) bad("combat", `expenditure for unknown unit "${uid}"`);
  const cooldowns = new Map<string, number>();
  for (const [uid, t] of entries(c.cooldowns, "combat.cooldowns")) {
    if (!unitIds.has(uid)) bad("combat.cooldowns", `cooldown for unknown unit "${uid}"`);
    if (cooldowns.has(uid)) bad("combat.cooldowns", `duplicate unit "${uid}"`);
    cooldowns.set(uid, num(t, `combat.cooldowns.${uid}`));
  }
  const combatState: CombatState = { weaponsInFlight, combatLog, weaponsExpended, defensesExpended, cooldowns };

  // --- AI runtime ---
  const a = obj(f.ai, "ai");
  const patrolIndex = new Map<string, number>();
  for (const [uid, n] of entries(a.patrolIndex, "ai.patrolIndex")) {
    if (!unitIds.has(uid)) bad("ai.patrolIndex", `unknown unit "${uid}"`);
    if (patrolIndex.has(uid)) bad("ai.patrolIndex", `duplicate unit "${uid}"`);
    patrolIndex.set(uid, int(n, `ai.patrolIndex.${uid}`, 0, 100_000));
  }
  const unitSet = (v: unknown, path: string) => {
    const out = new Set<string>();
    for (const id of arr(v, path)) {
      const s = str(id, path, 200);
      if (!unitIds.has(s)) bad(path, `unknown unit "${s}"`);
      if (out.has(s)) bad(path, `duplicate unit "${s}"`);
      out.add(s);
    }
    return out;
  };
  const ai = { patrolIndex, transitStarted: unitSet(a.transitStarted, "ai.transitStarted"), transitDone: unitSet(a.transitDone, "ai.transitDone") };

  // --- autopause preferences ---
  const ap = obj(f.autopausePrefs, "autopausePrefs");
  const tr = obj(ap.triggers, "autopausePrefs.triggers");
  const autopausePrefs: AutopausePreferences = {
    enabled: bool(ap.enabled, "autopausePrefs.enabled"),
    triggers: {
      newContact: bool(tr.newContact, "autopausePrefs.triggers.newContact"),
      friendlyDamaged: bool(tr.friendlyDamaged, "autopausePrefs.triggers.friendlyDamaged"),
      friendlyDestroyed: bool(tr.friendlyDestroyed, "autopausePrefs.triggers.friendlyDestroyed"),
      weaponIncoming: bool(tr.weaponIncoming, "autopausePrefs.triggers.weaponIncoming"),
      scenarioMessage: bool(tr.scenarioMessage, "autopausePrefs.triggers.scenarioMessage"),
    },
  };

  // --- WeGo bookkeeping ---
  const w = obj(f.wego, "wego");
  const phase = oneOf(w.phase, "wego.phase", ["planning", "resolving", "review"] as const) as WeGoPhase;
  const intents: FireIntent[] = arr(w.intents, "wego.intents", 1000).map((it, i) => {
    const p = `wego.intents[${i}]`;
    const io = obj(it, p);
    const out: FireIntent = {
      id: str(io.id, `${p}.id`, 200),
      shooterId: str(io.shooterId, `${p}.shooterId`, 200),
      shooterName: str(io.shooterName, `${p}.shooterName`, 300),
      contactId: str(io.contactId, `${p}.contactId`, 200),
      contactLabel: str(io.contactLabel, `${p}.contactLabel`, 300),
    };
    const wn = optStr(io, "weaponName", p);
    if (wn !== undefined) out.weaponName = wn;
    if (!unitIds.has(out.shooterId)) bad(p, `unknown shooter "${out.shooterId}"`);
    return out;
  });
  uniqueIds(intents.map((i) => i.id), "wego.intents");
  const intentOutcomes = (v: unknown, path: string): IntentOutcome[] =>
    arr(v, path, 1000).map((o0, i) => {
      const oo = obj(o0, `${path}[${i}]`);
      const it = obj(oo.intent, `${path}[${i}].intent`);
      const intent: FireIntent = {
        id: str(it.id, `${path}[${i}].intent.id`, 200),
        shooterId: str(it.shooterId, `${path}[${i}].intent.shooterId`, 200),
        shooterName: str(it.shooterName, `${path}[${i}].intent.shooterName`, 300),
        contactId: str(it.contactId, `${path}[${i}].intent.contactId`, 200),
        contactLabel: str(it.contactLabel, `${path}[${i}].intent.contactLabel`, 300),
      };
      const wn = optStr(it, "weaponName", `${path}[${i}].intent`);
      if (wn !== undefined) intent.weaponName = wn;
      return { intent, ok: bool(oo.ok, `${path}[${i}].ok`), message: str(oo.message, `${path}[${i}].message`, 4000) };
    });
  const turnOutcomes = intentOutcomes(w.turnOutcomes, "wego.turnOutcomes");
  let report: TurnReport | null = null;
  if (w.report !== null && w.report !== undefined) {
    const r = obj(w.report, "wego.report");
    report = {
      turn: int(r.turn, "wego.report.turn", 0, 1_000_000),
      startTime: num(r.startTime, "wego.report.startTime"),
      endTime: num(r.endTime, "wego.report.endTime"),
      elapsedMs: num(r.elapsedMs, "wego.report.elapsedMs", 0),
      ended: bool(r.ended, "wego.report.ended"),
      ownLosses: arr(r.ownLosses, "wego.report.ownLosses", 5000).map((l, i) => {
        const lo = obj(l, `wego.report.ownLosses[${i}]`);
        return {
          unitId: str(lo.unitId, `wego.report.ownLosses[${i}].unitId`, 200),
          name: str(lo.name, `wego.report.ownLosses[${i}].name`, 300),
          from: oneOf(lo.from, `wego.report.ownLosses[${i}].from`, DAMAGE_STATES),
          to: oneOf(lo.to, `wego.report.ownLosses[${i}].to`, DAMAGE_STATES),
        };
      }),
      // the turn's events are the combat-log entries after the cursor, by id: rebuilt from the restored log, not trusted twice
      events: [],
      messageIds: arr(r.messageIds, "wego.report.messageIds", 10_000).map((m, i) => str(m, `wego.report.messageIds[${i}]`, 300)),
      outcomes: intentOutcomes(r.outcomes, "wego.report.outcomes"),
      alerts: arr(r.alerts, "wego.report.alerts", 1000).map((x, i) => str(x, `wego.report.alerts[${i}]`, 1000)),
    };
    const byId = new Map(combatLog.map((e) => [e.id, e]));
    report.events = arr(r.eventIds, "wego.report.eventIds", 200_000).map((id, i) => {
      const ev = byId.get(str(id, `wego.report.eventIds[${i}]`, 200));
      if (!ev) return bad(`wego.report.eventIds[${i}]`, "refers to a combat-log entry that is not in the log");
      return ev;
    });
  }
  const baseline = new Map<string, Unit["damageState"]>();
  for (const [uid, st] of entries(w.turnLossBaseline, "wego.turnLossBaseline")) {
    if (!unitIds.has(uid)) bad("wego.turnLossBaseline", `unknown unit "${uid}"`);
    baseline.set(uid, oneOf(st, `wego.turnLossBaseline.${uid}`, DAMAGE_STATES));
  }
  const wego = {
    phase,
    turnStart: num(w.turnStart, "wego.turnStart"),
    turnEnd: num(w.turnEnd, "wego.turnEnd"),
    turnsCommitted: int(w.turnsCommitted, "wego.turnsCommitted", 0, 1_000_000),
    intents,
    intentSeq: int(w.intentSeq, "wego.intentSeq", 0, 1e9),
    report,
    started: bool(w.started, "wego.started"),
    resolveBudgetMs: num(w.resolveBudgetMs, "wego.resolveBudgetMs", 0, 1e9),
    turnAlerts: arr(w.turnAlerts, "wego.turnAlerts", 1000).map((x, i) => str(x, `wego.turnAlerts[${i}]`, 1000)),
    turnOutcomes,
    turnLossBaseline: baseline,
    turnEventCursor: int(w.turnEventCursor, "wego.turnEventCursor", 0, combatLog.length),
    turnMessageCursor: int(w.turnMessageCursor, "wego.turnMessageCursor", 0, messageIds.length),
  };
  if (mode === "continuous" && (phase !== "planning" || intents.length || report)) bad("wego", "turn state in a continuous battle");
  if (mode === "wego" && phase === "resolving" && eventState?.scenarioResult) bad("wego.phase", "a finished battle cannot be resolving");

  // --- id counters: never below any id already in the file ---
  const idsRaw = obj(f.ids, "ids");
  const contactSeq = Math.max(int(idsRaw.contactSeq, "ids.contactSeq", 0, 1e12), maxSuffix(allContactIds, "contact"));
  const combatSeq = Math.max(
    int(idsRaw.combatSeq, "ids.combatSeq", 0, 1e12),
    maxSuffix(weaponsInFlight.map((x) => x.id), "wif"),
    maxSuffix(combatLog.map((x) => x.id), "ce"),
  );

  const dump: BattleDump = {
    mode: mode as PlayMode,
    turnMinutes: turnMinutes as TurnMinutes,
    gameState,
    eventState,
    combatState,
    ai,
    autopausePrefs,
    wego,
    ids: { contactSeq, combatSeq },
  };

  const result = eventState?.scenarioResult;
  const preview: SavePreview = {
    configId,
    scenarioName: cfgScenario.name,
    simTime,
    startTime,
    elapsedMs: simTime - startTime,
    result: result?.result ?? null,
    resultMessage: result?.message ?? null,
    mode: dump.mode,
    playerSide,
    savedAt,
  };
  return { dump, config, envelope: { configId, configRevision: builtinRevision(configId), savedAt }, preview };
}
