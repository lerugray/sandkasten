import { test, expect, describe } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  SYSTEM_RANGES,
  adFromAuftragstaktik,
  affiliationFor,
  applyPlatformMatches,
  curatedSite,
  dedupeSites,
  inBbox,
  matchPlatform,
  overlayFacilities,
  radarFromAuftragstaktik,
} from "../scripts/lib/osint.mjs";
import { osintSites, siteRingsGeoJSON, sitePointsGeoJSON, coLocationIndex, ringAlways, sideForAffiliation } from "../src/lib/osint/sites";
import { hormuzFacilities } from "../src/lib/facilities/facilities";

const root = join(__dirname, "..");
const dataset = JSON.parse(readFileSync(join(root, "data/osint/hormuz.json"), "utf8"));
const facFile = JSON.parse(readFileSync(join(root, "data/facilities/hormuz.json"), "utf8"));
const BBOX = facFile.meta.bbox;
const records = readdirSync(join(root, "src/data/platforms/records"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(root, "src/data/platforms/records", f), "utf8")));

const atAd = {
  id: "ir-s300-x", system: "S-300PMU-2", location: "Somewhere", operator: "Iran", lat: 27.1, lng: 56.1,
  rangeKm: 200, status: "assessed", lastConfirmed: "2024-01", source: "CSIS",
};

describe("OSINT import: helpers", () => {
  test("affiliation from operator", () => {
    expect(affiliationFor("Iran (IRIAF)")).toBe("iran");
    expect(affiliationFor("United States Air Force")).toBe("us");
    expect(affiliationFor("Saudi Arabia")).toBe("gulf");
    expect(affiliationFor("United States / Qatar")).toBe("us-gulf");
    expect(affiliationFor("Nobody")).toBe("neutral");
  });

  test("Auftragstaktik records keep their range and carry a commit-pinned citation", () => {
    const s = adFromAuftragstaktik(atAd);
    expect(s.rangeKm).toBe(200);
    expect(s.rangeKind).toBe("engagement");
    expect(s.citations[0].label).toMatch(/Auftragstaktik \(MIT\).*airDefense\.ts @ 7c5904e, record ir-s300-x/);
    const r = radarFromAuftragstaktik({ ...atAd, id: "r1", system: "Sepehr", radarType: "early-warning", detectionRangeKm: 3000 });
    expect(r.rangeKind).toBe("detection");
    expect(r.rangeKm).toBe(3000);
  });

  test("bbox filter", () => {
    expect(inBbox({ lat: 27, lng: 56 }, BBOX)).toBe(true);
    expect(inBbox({ lat: 35, lng: 56 }, BBOX)).toBe(false);
    expect(inBbox({ lat: 27, lng: 70 }, BBOX)).toBe(false);
  });

  test("dedupe: same system, affiliation and place within 5 km is one site; citations fold in", () => {
    const a = adFromAuftragstaktik(atAd);
    const b = { ...adFromAuftragstaktik({ ...atAd, id: "other", lat: 27.12 }), citations: [{ label: "Extra source" }] };
    const far = adFromAuftragstaktik({ ...atAd, id: "far", lat: 28.5 });
    const otherSystem = adFromAuftragstaktik({ ...atAd, id: "ts", system: "Tor-M1" });
    const out = dedupeSites([a, b, far, otherSystem]);
    expect(out.map((s) => s.id)).toEqual([a.id, far.id, otherSystem.id]);
    expect(out[0].citations.map((c: { label: string }) => c.label)).toContain("Extra source");
  });

  test("curated site resolves a facility anchor, takes its range from the table, and rejects unknown anchors", () => {
    const fac = new Map([["apt-x", { id: "apt-x", position: { lat: 25.1, lng: 51.3 } }]]);
    const s = curatedSite({ id: "c1", layer: "ad", system: "MIM-104 Patriot", facilityId: "apt-x", citations: [] }, fac, new Map());
    expect(s.position).toEqual({ lat: 25.1, lng: 51.3 });
    expect(s.rangeKm).toBe(SYSTEM_RANGES["MIM-104 Patriot"]);
    expect(s.positionBasis).toBe("facility-anchor");
    expect(s.facilityId).toBe("apt-x");
    expect(() => curatedSite({ id: "c2", layer: "ad", system: "Patriot", facilityId: "nope" }, fac, new Map())).toThrow(/unknown facility/);
    expect(() => curatedSite({ id: "c3", layer: "ad", system: "No Such SAM", position: { lat: 1, lng: 1 } }, fac, new Map())).toThrow(/no range/);
  });
});

describe("OSINT import: platform DB matching", () => {
  const sam = { id: "sam1", layer: "ad", system: "MIM-104 Patriot", rangeKm: 160, citations: [] };

  test("no platform record carries a land SAM, so every real AD / radar site is a miss and ESTIMATED", () => {
    const real = dataset.sites.filter((s: { layer: string }) => s.layer !== "nuclear");
    expect(real.length).toBeGreaterThan(0);
    for (const s of real) {
      expect(s.platform.status).toBe("miss");
      expect(s.estimated).toBe(true);
    }
  });

  test("a synthetic record carrying the system matches: DB range wins and ESTIMATED is dropped", () => {
    const rec = {
      engineName: "Test Patriot Battery", engineId: 9000,
      weapons: [{ name: "MIM-104C Patriot PAC-2", type: "sam", rangeKm: 120 }],
    };
    const [m] = applyPlatformMatches([sam], [rec]);
    expect(m.platform.status).toBe("match");
    expect(m.platform.platformId).toBe(9000);
    expect(m.rangeKm).toBe(120);
    expect(m.estimated).toBe(false);
    expect(m.notes).toMatch(/replaced by the platform DB/);
  });

  test("radar matches against sensor names; a sensor name for another system does not match", () => {
    const radar = { id: "r", layer: "radar", system: "AN/TPY-2", rangeKm: 1000, citations: [] };
    expect(matchPlatform(radar, [{ engineName: "X", sensors: [{ name: "AN/TPY-2 X-band", rangeKm: 900 }] }]).status).toBe("match");
    expect(matchPlatform(radar, [{ engineName: "X", sensors: [{ name: "AN/SPY-1D", rangeKm: 400 }] }]).status).toBe("miss");
  });

  test("nuclear sites are never estimated and never platform-matched", () => {
    const [n] = applyPlatformMatches([{ id: "n", layer: "nuclear", system: "reactor", rangeKm: 20, citations: [] }], records);
    expect(n.estimated).toBe(false);
    expect(n.platform.status).toBe("miss");
  });
});

describe("OSINT dataset", () => {
  test("counts: 9 AD, 3 radar, 2 nuclear; all inside the bbox with ranges and citations", () => {
    const by = (l: string) => dataset.sites.filter((s: { layer: string }) => s.layer === l);
    expect(by("ad")).toHaveLength(9);
    expect(by("radar")).toHaveLength(3);
    expect(by("nuclear")).toHaveLength(2);
    expect(dataset.meta.counts.ad + dataset.meta.counts.radar + dataset.meta.counts.nuclear).toBe(dataset.sites.length);
    for (const s of dataset.sites) {
      expect(inBbox(s.position, BBOX), s.id).toBe(true);
      expect(s.rangeKm, s.id).toBeGreaterThan(0);
      expect(s.citations.length, s.id).toBeGreaterThan(0);
      expect(s.source, s.id).toBeTruthy();
    }
  });

  test("ranges match the published figures", () => {
    const r = (id: string) => dataset.sites.find((s: { id: string }) => s.id === id).rangeKm;
    expect(r("ad-ir-s300-bandar-abbas")).toBe(200);
    expect(r("ad-us-patriot-udeid")).toBe(160);
    expect(r("ad-us-thaad-dhafra")).toBe(200);
    expect(r("ad-ir-tor-bushehr")).toBe(12);
    expect(r("radar-ir-sepehr")).toBe(3000);
  });

  test("site ids are unique and no two sites of one system and operator share a place", () => {
    expect(new Set(dataset.sites.map((s: { id: string }) => s.id)).size).toBe(dataset.sites.length);
    expect(dedupeSites(dataset.sites.map((s: object) => ({ ...s, citations: [...(s as { citations: object[] }).citations] }))).length).toBe(dataset.sites.length);
  });

  test("curated AD/radar sites are anchored to a real facility or nuclear record (the panel labels the placement an assumption)", () => {
    const ids = new Set(facFile.facilities.map((f: { id: string }) => f.id));
    for (const s of dataset.sites.filter((x: { origin: string }) => x.origin === "curated")) {
      expect(s.positionBasis).toBe("facility-anchor");
      if (s.facilityId) expect(ids.has(s.facilityId), s.id).toBe(true);
    }
  });

  test("the app reads the same dataset", () => {
    expect(osintSites).toHaveLength(dataset.sites.length);
  });
});

describe("OSINT facility overlay", () => {
  test("one record per real place: no duplicate ids and none within 300 m with the same name", () => {
    const ids = facFile.facilities.map((f: { id: string }) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const withOsint = facFile.facilities.filter((f: { osint?: unknown }) => f.osint);
    expect(withOsint.length).toBe(dataset.meta.counts.installationsMerged + dataset.meta.counts.installationsCreated);
    const names = withOsint.map((f: { name: string }) => f.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  test("OSINT fields carry affiliation, function, source and a citation", () => {
    for (const f of facFile.facilities.filter((x: { osint?: unknown }) => x.osint)) {
      expect(f.osint.affiliation, f.id).toBeTruthy();
      expect(f.osint.function, f.id).toBeTruthy();
      expect(f.osint.source, f.id).toBeTruthy();
      expect(f.osint.citations.length, f.id).toBeGreaterThan(0);
    }
    expect(hormuzFacilities.find((f) => f.id === "apt-oikp")?.osint).toBeUndefined();
    expect(hormuzFacilities.find((f) => f.id === "apt-otbh")?.osint?.affiliation).toBeTruthy();
  });

  test("overlay is idempotent and does not mutate its input", () => {
    const spec = {
      installations: [{ id: "i1", type: "airbase", operator: "Iran", lat: 27, lng: 56, description: "d", source: "s" }],
      atInstallations: { map: { i1: { facilityId: "a" } }, dropped: {} },
      curatedInstallations: {},
    };
    const base = [{ id: "a", kind: "airbase", position: { lat: 27, lng: 56 } }];
    const once = overlayFacilities(base, spec);
    const twice = overlayFacilities(once.facilities, spec);
    expect(twice.facilities).toEqual(once.facilities);
    expect((base[0] as { osint?: unknown }).osint).toBeUndefined();
  });
});

describe("OSINT map helpers", () => {
  test("rings: one polygon per site with a range, selected flag set, long ranges only when selected", () => {
    const all = siteRingsGeoJSON(osintSites, null).features;
    const sepehr = osintSites.find((s) => s.id === "radar-ir-sepehr")!;
    expect(ringAlways(sepehr)).toBe(false);
    expect(all.some((f) => f.properties?.id === sepehr.id)).toBe(false);
    const sel = siteRingsGeoJSON(osintSites, sepehr.id).features;
    expect(sel.find((f) => f.properties?.id === sepehr.id)?.properties?.selected).toBe(true);
    expect(all.find((f) => f.properties?.id === "ad-ir-s300-bandar-abbas")?.properties?.estimated).toBe(true);
  });

  test("side colours: Iranian sites go to Iran, US and Gulf allies to US Navy", () => {
    expect(sideForAffiliation("iran")).toBe("Iran");
    expect(sideForAffiliation("us")).toBe("US Navy");
    expect(sitePointsGeoJSON(osintSites).features).toHaveLength(osintSites.length);
  });

  test("co-located sites get distinct slots", () => {
    const idx = coLocationIndex(osintSites, 1500);
    const dhafra = osintSites.filter((s) => s.facilityId === "apt-omam").map((s) => idx.get(s.id)!.index);
    expect(new Set(dhafra).size).toBe(dhafra.length);
  });
});
