import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const RECORD_DIR = path.join(ROOT, "src/data/platforms/records");
const ALLOWED_LICENSES = ["Public Domain", "US-Gov", "CC0", "CC BY", "CC BY-SA"];

// The 14 ids lookup.ts has always carried, plus every platformId the demo scenario files use.
const LOOKUP_IDS = [111, 598, 2740, 1283, 342, 896, 2471, 466, 84, 2106, 1652, 1088, 265, 264];

// Engine profiles from the sim-fix lane (Chosin CG-65, Cole DDG-67) that have no first-party record yet;
// see SIMFIX_PROFILES in lookup.ts. Drop an id here when its record lands.
const PROFILES_WITHOUT_RECORD = new Set([9001, 9003]);

function demoPlatformIds(): number[] {
  const ids = new Set<number>(LOOKUP_IDS);
  for (const f of ["src/lib/scenarios/demo.ts", "src/lib/scenarios/demoConfig.ts", "src/lib/platforms/lookup.ts"]) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf-8");
    for (const m of text.matchAll(/platformId:\s*(\d+)/g)) ids.add(Number(m[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = any;

function loadRecords(): Rec[] {
  return fs
    .readdirSync(RECORD_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RECORD_DIR, f), "utf-8")));
}

const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);

test.describe("platform database data", () => {
  test("every demo platform has a complete, sourced, licensed record", () => {
    const records = loadRecords();
    const problems: string[] = [];

    for (const id of demoPlatformIds()) {
      if (PROFILES_WITHOUT_RECORD.has(id)) continue;
      if (!records.some((r) => r.legacyIds?.includes(id) || r.engineId === id)) {
        problems.push(`platform ${id} has no committed record`);
      }
    }
    // The two records the sim-fix lane will use for the retired-ship swap and the Boghammar craft.
    for (const slug of ["arleigh-burke-flt-iia", "irgcn-boghammar-fac"]) {
      if (!records.some((r) => r.slug === slug)) problems.push(`missing record ${slug}`);
    }
    expect(new Set(records.map((r) => r.slug)).size, "duplicate slugs").toBe(records.length);

    for (const r of records) {
      const w = (msg: string) => problems.push(`${r.slug}: ${msg}`);
      const sourceIds = new Set<string>((r.sources ?? []).map((s: Rec) => s.id));
      const needSrc = (id: unknown, where: string) => {
        if (typeof id !== "string" || !sourceIds.has(id)) w(`${where} lacks a valid sourceId (${String(id)})`);
      };
      for (const s of r.sources ?? []) {
        for (const k of ["id", "title", "publisher", "url"]) if (!s[k]) w(`source ${s.id} missing ${k}`);
        if (!/^https?:\/\//.test(s.url ?? "")) w(`source ${s.id} url is not http(s)`);
        if (!finite(s.year)) w(`source ${s.id} missing year`);
      }
      if (!r.sources?.length) w("no sources");

      for (const k of ["sensorRangeKm", "weaponRangeKm", "damagePoints", "missileDefense"]) {
        if (!finite(r[k])) w(`engine field ${k} missing or non-finite`);
      }
      needSrc(r.engineSourceId, "engine fields");
      if (!["verified", "estimated"].includes(r.engineProvenance)) w("engineProvenance invalid");
      if (!Array.isArray(r.weapons)) w("weapons[] missing");
      if (!Array.isArray(r.defenses)) w("defenses[] missing");
      for (const x of r.weapons ?? []) {
        for (const k of ["rangeKm", "speedKts", "pkAir", "pkSurface", "quantity", "warheadDamage"]) {
          if (!finite(x[k])) w(`weapon ${x.name} ${k} non-finite`);
        }
        needSrc(x.sourceId, `weapon ${x.name}`);
        if (!["verified", "estimated"].includes(x.provenance)) w(`weapon ${x.name} provenance`);
        if (x.provenance === "verified" && x.mountSummary && /engine|our figure|assumption/i.test(x.mountSummary)) {
          w(`weapon ${x.name} is marked verified but mountSummary mentions engine/assumption`);
        }
      }
      for (const x of r.defenses ?? []) {
        if (!finite(x.effectiveness)) w(`defense ${x.name} effectiveness non-finite`);
        needSrc(x.sourceId, `defense ${x.name}`);
        if (!["verified", "estimated"].includes(x.provenance)) w(`defense ${x.name} provenance`);
      }
      if (!r.sensors?.length) w("no sensors");
      for (const x of r.sensors ?? []) {
        if (!finite(x.rangeKm)) w(`sensor ${x.name} rangeKm non-finite`);
        needSrc(x.sourceId, `sensor ${x.name}`);
        if (!["verified", "estimated"].includes(x.provenance)) w(`sensor ${x.name} provenance`);
      }
      if (r.dimension === "air" && !r.loadouts?.length) w("aircraft has no loadouts");
      for (const x of r.loadouts ?? []) needSrc(x.sourceId, `loadout ${x.name}`);
      for (const blk of ["dimensions", "performance", "signatures"]) {
        needSrc(r[blk]?.sourceId, blk);
        if (!["verified", "estimated"].includes(r[blk]?.provenance)) w(`${blk} provenance`);
      }

      const d = r.dimensions;
      // A required spec is a finite number or an explicit null (not published); absent or any other type fails.
      const spec = (blk: Rec, name: string, label: string) => {
        if (blk[name] !== null && !finite(blk[name])) w(`${label} must be a number or null (not published), got ${String(blk[name])}`);
      };
      spec(d, "lengthM", "dimensions.lengthM");
      if (!d.crew) w("dimensions.crew missing");
      if (r.dimension === "sea") {
        for (const k of ["beamM", "draftM", "displacementFullTons"]) spec(d, k, `dimensions.${k}`);
      }
      if (r.dimension === "air") {
        for (const k of ["weightEmptyKg", "weightMaxKg"]) spec(d, k, `dimensions.${k}`);
        if (r.domain === "fixed-wing") for (const k of ["wingspanM", "heightM"]) spec(d, k, `dimensions.${k}`);
      }
      if (!finite(r.performance?.maxSpeedKts)) w("performance.maxSpeedKts missing");
      if (r.performance) spec(r.performance, "cruiseSpeedKts", "performance.cruiseSpeedKts");
      for (const blk of ["dimensions", "performance"]) {
        for (const [field, c] of Object.entries<Rec>(r[blk]?.fieldCitations ?? {})) {
          needSrc(c.sourceId, `${blk}.${field} citation`);
          if (!["verified", "estimated"].includes(c.provenance)) w(`${blk}.${field} citation provenance`);
          if (!finite(r[blk][field])) w(`${blk}.${field} has a citation but no value`);
        }
      }
      if (!finite(r.serviceWindow?.enteredService)) w("serviceWindow.enteredService missing");
      for (const k of ["name", "designation", "className", "nation", "service", "role", "propulsionSummary", "engineName", "functionId"]) {
        if (!r[k]) w(`${k} empty`);
      }
      if (!Array.isArray(r.legacyIds)) w("legacyIds not an array");
      if (r.legacyIds?.length === 0 && !finite(r.engineId)) w("no legacyIds and no engineId");

      const b = r.brief ?? {};
      if (!b.whatItIs?.trim()) w("brief.whatItIs empty");
      if (!b.howItIsUsed?.trim()) w("brief.howItIsUsed empty");
      if (!Array.isArray(b.typicalMissions) || b.typicalMissions.length < 3 || b.typicalMissions.length > 5) {
        w("brief.typicalMissions must have 3-5 items");
      }

      if (!Array.isArray(r.photos)) w("photos[] missing");
      if ((r.photos ?? []).length === 0) {
        if (!r.photoPlaceholderReason?.trim()) w("no photos and no photoPlaceholderReason");
      }
      for (const p of r.photos ?? []) {
        const file = path.join(ROOT, "public", p.localPath ?? "");
        if (!p.localPath || !fs.existsSync(file)) w(`photo file missing: ${p.localPath}`);
        else if (fs.statSync(file).size > 250 * 1024) w(`photo over 250 KB: ${p.localPath}`);
        if (!p.sourceUrl) w(`photo ${p.localPath} missing sourceUrl`);
        if (!p.author?.trim()) w(`photo ${p.localPath} missing author`);
        if (!ALLOWED_LICENSES.includes(p.license)) w(`photo ${p.localPath} license not allowed: ${p.license}`);
        if (!p.licenseUrl) w(`photo ${p.localPath} missing licenseUrl`);
        if (!p.attributionLine?.trim()) w(`photo ${p.localPath} missing attributionLine`);
        if (!p.caption?.trim()) w(`photo ${p.localPath} missing caption`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("the API and engine lookup serve the first-party records", async ({ request }) => {
    const status = await (await request.get("/api/platforms?status=true")).json();
    expect(status.available).toBe(true);
    expect(status.count).toBeGreaterThanOrEqual(16);

    const byLegacy = await (await request.get("/api/platforms?id=111")).json();
    expect(byLegacy.slug).toBe("arleigh-burke-flt-ii");
    const bySlug = await (await request.get("/api/platforms?slug=irgcn-boghammar-fac")).json();
    expect(bySlug.slug).toBe("irgcn-boghammar-fac");
    const search = await (await request.get("/api/platforms?search=tomcat")).json();
    expect(search.count).toBe(2);
    // The map detail panel's old CMO-shaped query degrades to "no detail", not an error.
    const legacyQuery = await request.get("/api/platforms?type=ship&id=111");
    expect(legacyQuery.ok()).toBe(true);
    expect(await legacyQuery.json()).toBeNull();
  });
});

test.describe("platform viewer", () => {
  test("steps through every demo platform with photo or placeholder, brief, tables and sources", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/database");
    const items = page.getByTestId("db-rail-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(16);
    await expect(page.getByTestId("db-detail")).toBeVisible();

    const slugs: string[] = [];
    for (let i = 0; i < count; i++) slugs.push((await items.nth(i).getAttribute("data-slug")) ?? "");

    for (const slug of slugs) {
      await page.locator(`[data-testid="db-rail-item"][data-slug="${slug}"]`).click();
      const detail = page.locator(`[data-testid="db-detail"][data-slug="${slug}"]`);
      await expect(detail, slug).toBeVisible();
      await expect(page.getByTestId("db-title")).toBeVisible();
      await expect(page.getByTestId("db-glyph").locator("svg")).toBeVisible();

      const photo = page.getByTestId("db-photo");
      if (await photo.count()) {
        await expect(photo, `${slug} photo`).toBeVisible();
        await expect
          .poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { message: `${slug} naturalWidth` })
          .toBeGreaterThan(0);
        const credit = page.getByTestId("db-photo-credit");
        await expect(credit).toBeVisible();
        await expect(page.getByTestId("db-photo-attribution")).not.toBeEmpty();
        await expect(page.getByTestId("db-photo-license")).not.toBeEmpty();
      } else {
        await expect(page.getByTestId("db-placeholder"), `${slug} placeholder`).toBeVisible();
      }

      await expect(page.getByTestId("db-brief-what")).toContainText("WHAT IT IS");
      await expect(page.getByTestId("db-brief-how")).toContainText("HOW IT IS USED");
      await expect(page.getByTestId("db-brief-missions")).toContainText("TYPICAL MISSIONS");
      await expect(page.getByTestId("db-brief-what").locator("p")).not.toBeEmpty();
      await expect(page.getByTestId("db-brief-how").locator("p")).not.toBeEmpty();
      expect(await page.getByTestId("db-brief-missions").locator("li").count()).toBeGreaterThanOrEqual(3);

      expect(await page.getByTestId("db-specs").locator("tbody tr").count(), `${slug} specs rows`).toBeGreaterThan(2);
      expect(await page.getByTestId("db-sensors-table").locator("tbody tr").count(), `${slug} sensors rows`).toBeGreaterThan(0);
      expect(await page.getByTestId("db-weapons-table").locator("tbody tr").count(), `${slug} weapons rows`).toBeGreaterThan(0);
      expect(await page.getByTestId("db-defenses-table").locator("tbody tr").count()).toBeGreaterThan(0);
      expect(await page.getByTestId("db-source").count(), `${slug} sources`).toBeGreaterThan(0);
      await expect(page.getByTestId("db-source").first().locator("a")).toHaveAttribute("href", /^https?:\/\//);
    }
    expect(errors).toEqual([]);
  });

  test("opens by id and slug, filters, and moves with the keyboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/database?id=111");
    await expect(page.locator('[data-testid="db-detail"][data-slug="arleigh-burke-flt-ii"]')).toBeVisible();
    await page.goto("/database?slug=f-14d-tomcat");
    await expect(page.locator('[data-testid="db-detail"][data-slug="f-14d-tomcat"]')).toBeVisible();

    // The server-rendered page is visible before hydration attaches the key handler; retry until it moves.
    await expect(async () => {
      await page.keyboard.press("j");
      await expect(page.getByTestId("db-detail")).not.toHaveAttribute("data-slug", "f-14d-tomcat", { timeout: 800 });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press("k");
    await expect(page.getByTestId("db-detail")).toHaveAttribute("data-slug", "f-14d-tomcat");

    await page.keyboard.press("/");
    await expect(page.getByTestId("db-search")).toBeFocused();
    await page.keyboard.type("tomcat");
    await expect(page.getByTestId("db-rail-item")).toHaveCount(2);
    await page.keyboard.type(" zzzz");
    await expect(page.getByTestId("db-rail-item")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
