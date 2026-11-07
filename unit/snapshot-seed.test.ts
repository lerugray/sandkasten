import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AIS_SKIP_REASON,
  COUNTRY_BLOCKS,
  HORMUZ_BBOX,
  TYPE_TO_PLATFORM,
  UNKNOWN_AIR_ID,
  UNKNOWN_SURFACE_ID,
  buildSnapshotScenario,
  countryOfHex,
  type AdsbAircraft,
  type BBox,
  dateInWords,
  playerSideFor,
  snapshotIntro,
} from "@/lib/snapshot/seed";
import { ADSB_BASE, USER_AGENT, aircraftFromRequests, adsbSources, fetchAdsb, tilePoints, type RecordedRequest } from "@/lib/snapshot/adsb";
import { exampleSnapshotRaw, exampleSnapshotScenario } from "@/lib/snapshot/example";
import { snapshotScenarioConfig } from "@/lib/snapshot/playConfig";
import { getPlatform, getAllPlatforms, UNKNOWN_AIR_PLATFORM_ID, UNKNOWN_SURFACE_PLATFORM_ID } from "@/lib/platforms/lookup";
import { createInitialGameState } from "@/lib/simulation/gameState";
import { SimulationSession } from "@/lib/simulation/session";
import { DEFAULT_AUTOPAUSE } from "@/lib/simulation/autopause";
import { isHostileSide, type Scenario, type SnapshotSource } from "@/types/game";

const STAMP = "20261106T190240Z";
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures", `adsb-hormuz-${STAMP}.json`), "utf8")) as {
  fetchedAt: string;
  bbox: BBox;
  requests: RecordedRequest[];
};
const aircraft = aircraftFromRequests(fixture.requests);
const sources = adsbSources(fixture.requests, HORMUZ_BBOX);
const fetchedAt = fixture.fetchedAt;
const build = (extra: Partial<Parameters<typeof buildSnapshotScenario>[0]> = {}) =>
  buildSnapshotScenario({ aircraft, vessels: [], fetchedAt, sources, bbox: HORMUZ_BBOX, ...extra });
const unitsOf = (s: Scenario) => s.sides.flatMap((x) => x.units);

// US-continent box: the recorded global /v2/mil list has real mapped types (H60, P3) there.
const CONUS: BBox = [-130, 20, -60, 50];

describe("recorded fixture", () => {
  it("is the live capture: Hormuz has civil traffic but no military aircraft, the global mil list is large", () => {
    expect(fixture.fetchedAt).toBe("2026-11-06T19:02:40Z");
    expect(fixture.requests.length).toBe(5);
    expect(fixture.requests[0].url).toBe(`${ADSB_BASE}/mil`);
    expect(fixture.requests[0].ac.length).toBeGreaterThan(300);
    expect(aircraft.length).toBeGreaterThan(400);
  });
});

describe("bbox filtering", () => {
  it("keeps only aircraft inside the box and drops the rest of the global mil list", () => {
    const s = build({ includeCivil: true });
    const all = unitsOf(s);
    expect(all.length).toBeGreaterThan(50);
    for (const u of all) {
      expect(u.position.lat).toBeGreaterThanOrEqual(HORMUZ_BBOX[1]);
      expect(u.position.lat).toBeLessThanOrEqual(HORMUZ_BBOX[3]);
      expect(u.position.lng).toBeGreaterThanOrEqual(HORMUZ_BBOX[0]);
      expect(u.position.lng).toBeLessThanOrEqual(HORMUZ_BBOX[2]);
    }
    // the global list put many aircraft far outside; none of them got through
    expect(aircraft.length).toBeGreaterThan(all.length * 2);
  });

  it("default is military-relevant only (civil traffic excluded)", () => {
    const s = build();
    expect(unitsOf(s).filter((u) => u.mission === "Snapshot (civil ADS-B)")).toHaveLength(0);
    expect(s.snapshot!.limitations.join(" ")).toMatch(/Civil aircraft in the box \(\d+\) are not included/);
  });

  it("ground-station pseudo types (GND/TWR) are not aircraft", () => {
    const all = unitsOf(build({ includeCivil: true }));
    expect(all.some((u) => u.typeCode === "TWR" || u.typeCode === "GND")).toBe(false);
  });
});

describe("platform mapping", () => {
  it("every table entry points at a platform record that exists and is an aircraft", () => {
    for (const [type, m] of Object.entries(TYPE_TO_PLATFORM)) {
      const p = getPlatform(m.platformId);
      expect(p, type).toBeDefined();
      expect(p!.dimension, type).toBe("air");
    }
    expect(getPlatform(264)?.name).toMatch(/F-14A/);
  });

  it("real recorded military types map to a platformId in the DB; the rest are UNKNOWN contacts", () => {
    const s = buildSnapshotScenario({ aircraft, vessels: [], fetchedAt, sources, bbox: CONUS });
    const all = unitsOf(s);
    const h60 = all.filter((u) => u.typeCode === "H60");
    expect(h60.length).toBeGreaterThan(10);
    for (const u of h60) {
      expect(u.platformId).toBe(84);
      expect(u.unknown).toBeUndefined();
      expect(getPlatform(u.platformId)).toBeDefined();
    }
    const unknown = all.filter((u) => u.unknown);
    expect(unknown.length).toBeGreaterThan(10);
    for (const u of unknown) {
      expect(u.platformId).toBe(UNKNOWN_AIR_ID);
      expect(TYPE_TO_PLATFORM[u.typeCode ?? ""]).toBeUndefined();
    }
    expect(s.snapshot!.counts.mappedByType.H60).toBe(h60.length);
    expect(s.snapshot!.counts.unknownContacts).toBe(unknown.length);
  });

  it("synthetic one-of-each: exact designators map, near misses (F18H) and civil types do not", () => {
    const mk = (hex: string, t: string, extra: Partial<AdsbAircraft> = {}): AdsbAircraft => ({
      hex, t, flight: t, lat: 26, lon: 56, alt_baro: 20000, gs: 300, track: 90, dbFlags: 1, ...extra,
    });
    const s = buildSnapshotScenario({
      aircraft: [
        mk("ae0001", "F18S"), mk("ae0002", "E2"), mk("ae0003", "P3"), mk("ae0004", "H60"), mk("ae0005", "F14"),
        mk("730001", "F14"), mk("ae0006", "F4"), mk("ae0007", "F18H"), mk("ae0008", "C17"),
        mk("ae0009", "B738", { dbFlags: 0 }),
      ],
      fetchedAt,
      sources: [],
      bbox: HORMUZ_BBOX,
      includeCivil: true,
    });
    const by = Object.fromEntries(unitsOf(s).map((u) => [u.id, u]));
    expect(by["adsb-ae0001"].platformId).toBe(342);
    expect(by["adsb-ae0002"].platformId).toBe(2471);
    expect(by["adsb-ae0003"].platformId).toBe(466);
    expect(by["adsb-ae0004"].platformId).toBe(84);
    expect(by["adsb-ae0005"].platformId).toBe(896);
    expect(by["adsb-730001"].platformId).toBe(264);
    expect(by["adsb-ae0006"].platformId).toBe(265);
    expect(by["adsb-ae0007"].unknown).toBe(true); // legacy Hornet is not a Super Hornet
    expect(by["adsb-ae0008"].unknown).toBe(true); // C-17: no record
    expect(by["adsb-ae0009"]).toMatchObject({ side: "Neutral", unknown: true, platformId: UNKNOWN_AIR_ID });
    for (const u of Object.values(by)) expect(getPlatform(u.platformId)).toBeDefined();
  });

  it("units use feet, knots and integer headings", () => {
    const s = buildSnapshotScenario({
      aircraft: [{ hex: "ae0001", t: "F18S", lat: 26, lon: 56, alt_baro: 31000, gs: 451.6, track: 359.7, dbFlags: 1 }],
      fetchedAt, sources: [], bbox: HORMUZ_BBOX,
    });
    expect(unitsOf(s)[0]).toMatchObject({ altitude: 31000, speed: 452, heading: 0 });
    const g = buildSnapshotScenario({
      aircraft: [{ hex: "ae0002", t: "H60", lat: 26, lon: 56, alt_baro: "ground", dbFlags: 1 }],
      fetchedAt, sources: [], bbox: HORMUZ_BBOX,
    });
    expect(unitsOf(g)[0]).toMatchObject({ altitude: 0, speed: 0, heading: 0 });
  });
});

describe("unknown contacts and sides", () => {
  it("placeholder platforms exist, are unarmed and are not offered in the editor picker", () => {
    expect(UNKNOWN_AIR_ID).toBe(UNKNOWN_AIR_PLATFORM_ID);
    expect(UNKNOWN_SURFACE_ID).toBe(UNKNOWN_SURFACE_PLATFORM_ID);
    expect(getPlatform(UNKNOWN_AIR_ID)).toMatchObject({ dimension: "air", functionId: "MF" });
    expect(getPlatform(UNKNOWN_AIR_ID)!.weapons).toBeUndefined();
    expect(getPlatform(UNKNOWN_SURFACE_ID)!.dimension).toBe("sea");
    expect(getAllPlatforms().some((p) => p.id === UNKNOWN_AIR_ID || p.id === UNKNOWN_SURFACE_ID)).toBe(false);
  });

  it("sides come from the ICAO address block; unknown contacts are Neutral and never hostile", () => {
    const mk = (hex: string, t = "F18S"): AdsbAircraft => ({ hex, t, lat: 26, lon: 56, alt_baro: 25000, gs: 400, track: 10, dbFlags: 1 });
    const s = buildSnapshotScenario({
      aircraft: [mk("ae1111"), mk("43c001"), mk("730123", "F14"), mk("710001"), mk("123456"), mk("ae2222", "C17"), mk("730456", "C17")],
      fetchedAt, sources: [], bbox: HORMUZ_BBOX,
    });
    const side = (id: string) => unitsOf(s).find((u) => u.id === `adsb-${id}`)!.side;
    expect(side("ae1111")).toBe("Coalition");
    expect(side("43c001")).toBe("Coalition");
    expect(side("730123")).toBe("Iran");
    expect(side("710001")).toBe("Neutral");
    expect(side("123456")).toBe("Neutral"); // no known block
    // an UNKNOWN military contact (type not in the platform DB) stays Neutral whatever its registry
    expect(side("ae2222")).toBe("Neutral");
    expect(side("730456")).toBe("Neutral");
    for (const x of ["Neutral"]) {
      expect(isHostileSide(x, "Coalition")).toBe(false);
      expect(isHostileSide("Iran", x)).toBe(false);
    }
    expect(countryOfHex("896700")?.code).toBe("AE");
    expect(COUNTRY_BLOCKS.every((c) => c.from <= c.to)).toBe(true);
  });

  it("AIS vessels given to the builder become Neutral unknown surface contacts", () => {
    const s = buildSnapshotScenario({
      aircraft: [], fetchedAt, sources: [], bbox: HORMUZ_BBOX,
      vessels: [{ mmsi: "422000001", name: "TEST TANKER", lat: 26.5, lon: 56.2, sog: 12.4, cog: 301, shipType: 80 }],
    });
    expect(unitsOf(s)[0]).toMatchObject({ side: "Neutral", unknown: true, platformId: UNKNOWN_SURFACE_ID, speed: 12, heading: 301 });
  });
});

describe("scenario shape, determinism and provenance", () => {
  it("is valid: theater, sides, start time = fetch time, REAL snapshot wording, no embedded facilities", () => {
    const s = build({ includeCivil: true });
    expect(s.startTime).toBe(fetchedAt);
    expect(s.sides.map((x) => x.name)).toContain(s.playerSide);
    expect(s.theater.bounds).toEqual(HORMUZ_BBOX);
    expect(s.theater.center).toEqual({ lng: 55.5, lat: 26.25 });
    expect(s.facilities).toBeUndefined();
    for (const text of [s.description, s.briefing]) expect(text).toMatch(/real/i);
    // a human title with the date in words, not the raw id; a briefing that says what the player can do
    expect(s.name).toBe(`Hormuz air traffic, ${dateInWords(fetchedAt)}`);
    expect(dateInWords("2026-11-06T19:02:40Z")).toBe("6 November 2026, 19:02 UTC");
    expect(s.name).not.toMatch(/\d{8}T\d{6}Z/);
    expect(s.briefing).toMatch(/You are the observer/);
    expect(s.description).toContain(fetchedAt);
    expect(s.briefing).toContain("ESTIMATED");
    expect(s.briefing).toContain(AIS_SKIP_REASON);
    const ids = unitsOf(s).map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic, whatever the input order", () => {
    const a = JSON.stringify(build({ includeCivil: true }));
    const b = JSON.stringify(build({ includeCivil: true }));
    const c = JSON.stringify(build({ includeCivil: true, aircraft: [...aircraft].reverse() }));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("lists every source with terms, rate limit, fetch time and status; AIS is skipped with the note", () => {
    const s = build();
    const src = s.snapshot!.sources;
    expect(src.map((x) => x.id)).toEqual(["adsblol-mil", "adsblol-point", "aisstream"]);
    for (const x of src) {
      expect(x.name && x.url && x.terms && x.rateLimit).toBeTruthy();
    }
    const [mil, pt, ais] = src as [SnapshotSource, SnapshotSource, SnapshotSource];
    expect(mil.status).toBe("used");
    expect(mil.fetchedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(pt.counts!.requests).toBe(4);
    expect(pt.terms).toMatch(/ODbL/);
    expect(ais).toMatchObject({ status: "skipped", reason: AIS_SKIP_REASON, fetchedAt: null });
    expect(AIS_SKIP_REASON).toBe("AISStream requires an API key; no keyless AIS source covers this bbox");
    expect(s.snapshot!.fetchedAt).toBe(fetchedAt);
  });

  it("holds no key-like strings (scenario, fixture, committed example)", () => {
    const keyLike = /api[_-]?key[\s]*[=:]|apikey|Bearer |authorization|x-api-key|[A-Za-z0-9]{32,}/i;
    const texts = [
      JSON.stringify(build({ includeCivil: true })),
      JSON.stringify(fixture),
      readFileSync(join(__dirname, "..", "data", "snapshots", `hormuz-adsb-${STAMP}.scenario.json`), "utf8"),
    ];
    for (const t of texts) expect(t).not.toMatch(keyLike);
  });

  it("the committed example is exactly what the tool builds from the committed fixture", () => {
    const rebuilt = buildSnapshotScenario({ aircraft, vessels: [], fetchedAt, sources, bbox: HORMUZ_BBOX, includeCivil: true });
    expect(JSON.parse(JSON.stringify(rebuilt))).toEqual(JSON.parse(JSON.stringify(exampleSnapshotRaw)));
    expect(exampleSnapshotRaw.facilities).toBeUndefined();
    expect(exampleSnapshotScenario.facilities!.length).toBeGreaterThan(800);
  });
});

describe("fetcher (no network: fetch is injected)", () => {
  const body = { now: 1, ac: [{ hex: "ae0001", t: "H60", lat: 26, lon: 56, dbFlags: 1, secret: "x" }] };
  const okFetch = (log: { url: string; headers: Record<string, string> }[]) =>
    (async (url: string, init?: RequestInit) => {
      log.push({ url, headers: init?.headers as Record<string, string> });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;

  it("one request per second, descriptive User-Agent, mil + one request per tile, no key header", async () => {
    const log: { url: string; headers: Record<string, string> }[] = [];
    const sleeps: number[] = [];
    const res = await fetchAdsb(HORMUZ_BBOX, { fetchFn: okFetch(log), sleep: async (ms) => void sleeps.push(ms) });
    expect(log.length).toBe(1 + tilePoints(HORMUZ_BBOX).length);
    expect(log[0].url).toBe(`${ADSB_BASE}/mil`);
    expect(log.slice(1).every((r) => /\/v2\/point\/[\d.]+\/[\d.]+\/\d+$/.test(r.url))).toBe(true);
    for (const r of log) {
      expect(r.headers["User-Agent"]).toBe(USER_AGENT);
      expect(JSON.stringify(r.headers)).not.toMatch(/key|authorization|bearer/i);
    }
    // every request after the first waited out (almost) the full second
    expect(sleeps.length).toBe(log.length - 1);
    for (const ms of sleeps) expect(ms).toBeGreaterThan(900);
    expect(res.failed).toBe(false);
    expect(res.aircraft).toHaveLength(1);
    expect(res.aircraft[0]).not.toHaveProperty("secret"); // trimmed to used fields
    expect(res.aircraft[0].fromMilEndpoint).toBe(true);
  });

  it("a 429 stops the run (no retry storm); total failure is reported, not thrown", async () => {
    let calls = 0;
    const tooMany = (async () => {
      calls += 1;
      return new Response("slow down", { status: 429 });
    }) as unknown as typeof fetch;
    const res = await fetchAdsb(HORMUZ_BBOX, { fetchFn: tooMany, sleep: async () => {} });
    expect(calls).toBe(1);
    expect(res.failed).toBe(true);
    expect(res.sources.every((s) => s.status === "failed")).toBe(true);

    const down = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    const res2 = await fetchAdsb(HORMUZ_BBOX, { fetchFn: down, sleep: async () => {} });
    expect(res2.failed).toBe(true);
    expect(res2.requests[0].error).toMatch(/ENOTFOUND/);
  });

  it("the tiles cover the whole box within the 250 nm point-query limit", () => {
    const pts = tilePoints(HORMUZ_BBOX);
    expect(pts.length).toBeLessThanOrEqual(6);
    const nm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
      const r = Math.PI / 180;
      const d = Math.acos(
        Math.min(1, Math.sin(aLat * r) * Math.sin(bLat * r) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.cos((aLon - bLon) * r)),
      );
      return (d / r) * 60;
    };
    for (const p of pts) expect(p.radiusNm).toBeLessThanOrEqual(250);
    for (let lat = HORMUZ_BBOX[1]; lat <= HORMUZ_BBOX[3]; lat += 0.25) {
      for (let lon = HORMUZ_BBOX[0]; lon <= HORMUZ_BBOX[2]; lon += 0.25) {
        expect(pts.some((p) => nm(lat, lon, p.lat, p.lon) <= p.radiusNm), `${lat},${lon}`).toBe(true);
      }
    }
  });
});

describe("the simulation loads and runs snapshot scenarios", () => {
  // Coalition F/A-18 and E-2 beside an Iranian F-14A and Neutral unknown contacts, all in sensor range.
  const mixed = buildSnapshotScenario({
    aircraft: [
      { hex: "ae0001", flight: "BLUE1", t: "F18S", lat: 26.0, lon: 56.0, alt_baro: 25000, gs: 450, track: 90, dbFlags: 1 },
      { hex: "ae0002", flight: "BLUE2", t: "E2", lat: 26.05, lon: 56.0, alt_baro: 25000, gs: 250, track: 90, dbFlags: 1 },
      { hex: "730001", flight: "IRAN1", t: "F14", lat: 26.3, lon: 56.3, alt_baro: 25000, gs: 400, track: 270, dbFlags: 1 },
      { hex: "710001", flight: "NEUT1", t: "C130", lat: 26.1, lon: 56.1, alt_baro: 20000, gs: 300, track: 180, dbFlags: 1 },
      { hex: "896001", flight: "AIRL1", t: "B77W", lat: 26.05, lon: 56.05, alt_baro: 36000, gs: 480, track: 45 },
    ],
    vessels: [{ mmsi: "422000001", name: "TEST TANKER", lat: 26.0, lon: 56.1, sog: 12, cog: 90 }],
    fetchedAt, sources: [], bbox: HORMUZ_BBOX, includeCivil: true,
  });

  it("createInitialGameState accepts a snapshot scenario (committed example and mixed)", () => {
    for (const sc of [exampleSnapshotScenario, mixed]) {
      const st = createInitialGameState(sc);
      expect(st.simTime).toBe(new Date(sc.startTime).getTime());
      expect(st.orders.size).toBe(unitsOf(sc).length);
    }
  });

  function run(sc: Scenario, ticks: number, overrideRoe?: "weapons-free") {
    const config = snapshotScenarioConfig(sc);
    if (overrideRoe) for (const s of sc.sides) config.sideDoctrine![s.name] = { roe: overrideRoe };
    const session = new SimulationSession(config);
    session.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    session.togglePause();
    session.setSpeed(60);
    for (let i = 0; i < ticks; i++) session.tick(50);
    return session.snapshot();
  }

  it("runs 50 ticks on the committed example without throwing; aircraft move on their headings", () => {
    const before = unitsOf(exampleSnapshotScenario).filter((u) => u.speed > 100)[0];
    const snap = run(exampleSnapshotScenario, 50);
    expect(snap.gameState.simTime).toBeGreaterThan(new Date(exampleSnapshotScenario.startTime).getTime());
    const after = snap.gameState.sides.flatMap((s) => s.units).find((u) => u.id === before.id)!;
    expect(after.position).not.toEqual(before.position);
    expect(snap.combatState.weaponsInFlight).toHaveLength(0);
    expect(snap.combatState.combatLog).toHaveLength(0);
  });

  it("unknown/neutral contacts start no fights even when every side is weapons-free", () => {
    const snap = run(mixed, 120, "weapons-free");
    const log = snap.combatState.combatLog;
    const neutralIds = new Set(unitsOf(mixed).filter((u) => u.side === "Neutral").map((u) => u.id));
    // Coalition vs Iran may legitimately fight (both armed, weapons-free); nothing may involve a Neutral unit
    for (const w of snap.combatState.weaponsInFlight) {
      expect(neutralIds.has(w.launchedBy)).toBe(false);
      expect(neutralIds.has(w.targetId)).toBe(false);
    }
    expect(JSON.stringify(log)).not.toMatch(/adsb-710001|adsb-896001|ais-422000001/);
    for (const u of snap.gameState.sides.flatMap((s) => s.units)) {
      if (neutralIds.has(u.id)) expect(u.damageState).toBe("undamaged");
    }
  });

  it("with the snapshot config (weapons-hold everywhere) the mixed scenario stays peaceful", () => {
    const snap = run(mixed, 120);
    expect(snap.combatState.combatLog).toHaveLength(0);
    expect(snap.combatState.weaponsInFlight).toHaveLength(0);
    // the Coalition radar picture sees the unknown aircraft as contacts
    expect(snap.gameState.contacts.length).toBeGreaterThan(0);
  });
});

describe("the committed example is a normal player view of its own traffic", () => {
  it("the player side holds all 137 aircraft, so FORCES counts and lists them without god mode", () => {
    const sc = exampleSnapshotScenario;
    expect(sc.name).toBe("Hormuz air traffic, 6 November 2026, 19:02 UTC");
    expect(sc.name).not.toMatch(/\d{8}T\d{6}Z/);
    expect(sc.briefing).toMatch(/real snapshot/i);
    expect(sc.briefing).toMatch(/observer/);
    const mine = sc.playerSide;
    const units = unitsOf(sc);
    const mineUnits = sc.sides.find((x) => x.name === mine)!.units;
    expect(units).toHaveLength(137);
    expect(mineUnits).toHaveLength(137);
    expect(playerSideFor(units)).toBe(mine);
    expect(sc.sides.filter((x) => !x.isAI).map((x) => x.name)).toEqual([mine]);
    expect(mine).toBe("Neutral");
  });
});


describe("snapshot briefing wording", () => {
  const u = (side: string) => ({ side, mission: "civil" }) as never;
  it("claims every aircraft only when one side holds them all", () => {
    expect(snapshotIntro([u("Neutral"), u("Neutral")], "2026-11-06T19:02:40Z")).toMatch(/every aircraft is listed under FORCES/);
    const mixed = snapshotIntro([u("Neutral"), u("Neutral"), u("Iran")], "2026-11-06T19:02:40Z");
    expect(mixed).not.toMatch(/every aircraft/);
    expect(mixed).toMatch(/the 1 Iran aircraft are listed.*other 2 belong to other sides.*GOD mode/);
  });
  it("the committed example's briefing makes the claim and it holds", () => {
    expect(exampleSnapshotScenario.briefing).toMatch(/every aircraft is listed under FORCES/);
  });
});
