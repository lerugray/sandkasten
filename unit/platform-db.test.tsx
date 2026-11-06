import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformDatabase } from "@/components/database/PlatformDatabase";

const ROOT = path.resolve(__dirname, "..");
const RECORD_DIR = path.join(ROOT, "src/data/platforms/records");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;

const records: Rec[] = fs
  .readdirSync(RECORD_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(RECORD_DIR, f), "utf-8")));
const bySlug = (slug: string): Rec => records.find((r) => r.slug === slug);

const html = (slug: string) => renderToStaticMarkup(<PlatformDatabase initialId={slug} />);

function kvRow(markup: string, label: string): string {
  const m = markup.match(new RegExp(`<tr><th>${label}</th>(.*?)</tr>`));
  if (!m) throw new Error(`no row "${label}"`);
  return m[1];
}

function sourceLines(markup: string): string[] {
  return [...markup.matchAll(/<li data-testid="db-source">(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

const ENGINE_TEXT = /engine|our figure|assumption/i;

describe("S2-1 per-field citation (card 2a)", () => {
  it("F-14A dimensions: published rows stay plain, only the estimated weights read EST", () => {
    const m = html("iriaf-f-14a-tomcat");
    for (const label of ["Length", "Wingspan", "Height", "Crew"]) {
      expect(kvRow(m, label), `${label} must not be EST`).not.toContain("EST");
    }
    for (const label of ["Empty weight", "Max takeoff weight"]) {
      expect(kvRow(m, label), `${label} must be EST`).toContain("EST");
    }
  });

  it("Sina dimensions: only the conflicting displacement figure reads EST", () => {
    const m = html("sina-class-houdong");
    for (const label of ["Length", "Beam", "Draft", "Crew"]) {
      expect(kvRow(m, label), `${label} must not be EST`).not.toContain("EST");
    }
    expect(kvRow(m, "Full-load displacement")).toContain("EST");
  });

  it("every fieldCitations entry names a field the block carries and a source the record lists", () => {
    let seen = 0;
    for (const r of records) {
      const ids = new Set(r.sources.map((s: Rec) => s.id));
      for (const blk of ["dimensions", "performance"]) {
        for (const [field, c] of Object.entries<Rec>(r[blk].fieldCitations ?? {})) {
          seen++;
          expect(r[blk][field], `${r.slug} ${blk}.${field}`).toBeTypeOf("number");
          expect(ids.has(c.sourceId), `${r.slug} ${blk}.${field} sourceId`).toBe(true);
          expect(["verified", "estimated"]).toContain(c.provenance);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("S2-2 source label rule (card 3)", () => {
  it("a source cited by both verified and estimated rows reads MIXED with both counts; VERIFIED only when no estimated row cites it", () => {
    let mixed = 0;
    const problems: string[] = [];
    for (const r of records) {
      for (const line of sourceLines(html(r.slug))) {
        const c = line.match(/\(cited by (\d+) verified, (\d+) estimated rows\)/);
        if (!c) continue;
        const [v, e] = [Number(c[1]), Number(c[2])];
        const label = line.match(/\[SRC \d+\] (VERIFIED|MIXED|ESTIMATED|REFERENCE)/)?.[1];
        const want = v > 0 && e > 0 ? "MIXED" : v > 0 ? "VERIFIED" : "ESTIMATED";
        if (label !== want) problems.push(`${r.slug}: ${line.slice(0, 40)} reads ${label}, want ${want} (${v}v/${e}e)`);
        if (want === "MIXED") mixed++;
      }
    }
    expect(problems).toEqual([]);
    expect(mixed, "the rule must actually fire somewhere").toBeGreaterThan(0);
  });

  it("f-14d-tomcat SRC 3 (3 verified, 4 estimated citing rows in the reviewed build) is not labelled VERIFIED", () => {
    const line = sourceLines(html("f-14d-tomcat")).find((l) => l.startsWith("[SRC 3]"))!;
    expect(line).not.toMatch(/^\[SRC 3\] VERIFIED/);
  });
});

describe("card 3 retags: engine values are never verified", () => {
  it("no weapon, sensor, defense or loadout row with engine/assumption wording is verified", () => {
    const problems: string[] = [];
    for (const r of records) {
      for (const kind of ["weapons", "sensors", "defenses", "loadouts"]) {
        for (const row of r[kind]) {
          const text = Object.values(row).filter((v) => typeof v === "string").join(" | ");
          if (row.provenance === "verified" && ENGINE_TEXT.test(text)) problems.push(`${r.slug} ${kind} ${row.name}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("AIM-120C (F/A-18E) and AIM-54C (F-14D) rows carry engine quantity/Pk so they are estimated", () => {
    const amraam = bySlug("fa-18e-super-hornet").weapons.find((w: Rec) => /AIM-120C/.test(w.name));
    const phoenix = bySlug("f-14d-tomcat").weapons.find((w: Rec) => /AIM-54C/.test(w.name));
    expect(amraam.provenance).toBe("estimated");
    expect(phoenix.provenance).toBe("estimated");
  });

  it("no verified sensor row shows an engine range", () => {
    for (const r of records) {
      for (const s of r.sensors) {
        if (s.provenance === "verified") expect(ENGINE_TEXT.test(`${s.name} ${s.role}`), `${r.slug} ${s.name}`).toBe(false);
      }
    }
  });
});

describe("card 2 completeness: every required spec is a number or an explicit null", () => {
  const required = (r: Rec) => {
    const dims = ["lengthM"];
    if (r.dimension === "sea") dims.push("beamM", "draftM", "displacementFullTons");
    if (r.dimension === "air") dims.push("weightEmptyKg", "weightMaxKg");
    if (r.domain === "fixed-wing") dims.push("wingspanM", "heightM");
    return { dimensions: dims, performance: ["maxSpeedKts", "cruiseSpeedKts"] };
  };

  it("no required field is absent or of another type; nulls are exactly the known not-published set", () => {
    const nulls: string[] = [];
    const problems: string[] = [];
    for (const r of records) {
      const req = required(r);
      for (const blk of ["dimensions", "performance"] as const) {
        for (const f of req[blk]) {
          const v = r[blk][f];
          if (v === null) nulls.push(`${r.slug}.${blk}.${f}`);
          else if (typeof v !== "number" || !Number.isFinite(v)) problems.push(`${r.slug}.${blk}.${f} is ${String(v)}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(nulls.sort()).toEqual([
      "nimitz-cvn-68.performance.cruiseSpeedKts",
      "sh-60b-seahawk.performance.cruiseSpeedKts",
      "sina-class-houdong.performance.cruiseSpeedKts",
    ]);
  });

  it("the viewer shows null fields as NOT PUBLISHED rows, never hides them", () => {
    expect(kvRow(html("nimitz-cvn-68"), "Cruise speed")).toContain("NOT PUBLISHED");
    expect(kvRow(html("sh-60b-seahawk"), "Cruise speed")).toContain("NOT PUBLISHED");
    expect(kvRow(html("sina-class-houdong"), "Cruise speed")).toContain("NOT PUBLISHED");
  });
});

describe("S2-3 / card 1: DDG 89 Harpoon row is a plain scenario assumption", () => {
  const mustin = bySlug("arleigh-burke-flt-iia");
  const harpoon = mustin.weapons.find((w: Rec) => /Harpoon/.test(w.name));

  it("row is estimated, says it is not a documented fit, engine numbers unchanged", () => {
    expect(harpoon.provenance).toBe("estimated");
    expect(harpoon.mountSummary).toMatch(/not a documented fit/);
    expect(harpoon.quantity).toBe(8);
  });

  it("brief and typical missions make no Harpoon claim", () => {
    const text = [mustin.brief.whatItIs, mustin.brief.howItIsUsed, ...mustin.brief.typicalMissions].join(" ");
    expect(text).not.toMatch(/harpoon/i);
  });

  it("NOTES.md quotes the FAS line relied on", () => {
    const notes = fs.readFileSync(path.join(ROOT, "docs/handoffs/platform-db-2026-11-03/NOTES.md"), "utf-8");
    expect(notes).toContain("The modifications require removal of Harpoon missile capability");
  });
});

describe("round 2: a VERIFIED figure needs a source that states it for that variant", () => {
  const notes = fs.readFileSync(path.join(ROOT, "docs/handoffs/platform-db-2026-11-03/NOTES.md"), "utf-8");
  const methods = fs.readFileSync(path.join(ROOT, "src/data/platforms/METHODS.md"), "utf-8");

  it("Iranian F-14A performance is not verified from F-14D/F-14B tables; METHODS.md gives the method", () => {
    const perf = bySlug("iriaf-f-14a-tomcat").performance;
    expect(perf.provenance).toBe("estimated");
    for (const [field, c] of Object.entries<Rec>(perf.fieldCitations ?? {})) {
      expect(c.provenance, `performance.${field}`).not.toBe("verified");
    }
    expect(methods).toMatch(/F-14A performance/);
  });

  it("Nimitz draft is not verified against FAS s1 (which gives no draft); it cites the source that states it, tagged estimated", () => {
    const d = bySlug("nimitz-cvn-68").dimensions;
    expect(d.draftM).toBe(11.3);
    const c = d.fieldCitations?.draftM;
    expect(c, "draftM needs its own citation").toBeDefined();
    expect(c.provenance).toBe("estimated");
    expect(c.sourceId).toBe("s13");
    expect(bySlug("nimitz-cvn-68").sources.find((s: Rec) => s.id === "s13").publisher).toBe("Wikipedia");
    expect(notes).toContain("a draft of 37 ft");
  });

  it("the row renders EST for Nimitz draft and plain for its other dimensions", () => {
    const m = html("nimitz-cvn-68");
    expect(kvRow(m, "Draft")).toContain("EST");
    for (const label of ["Length", "Beam", "Full-load displacement"]) expect(kvRow(m, label), label).not.toContain("EST");
  });
});
