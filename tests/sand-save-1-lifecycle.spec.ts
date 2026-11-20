import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { clickGeo, autopauseOff, installProbes, probeCounts, runUntilResult, injectKillOnCarrier, assertFrozen, GATE, type W } from "./helpers/sandPlay";
import { openPlayLite as openPlay, OUT, SIZES, shotBoth, saveViaUi, loadViaUi, facts, godOff, localOnly } from "./helpers/saveEvidence";

// SAND-SAVE-1: validation, atomic refusal, terminal fixture, snapshot, navigation, legacy routes, lifecycle.
const DIR = path.join(OUT, "files");
const setSpeed = (page: Page, label: string) => page.getByTestId("sim-speed").filter({ hasText: label }).click();

async function newPage(browser: import("@playwright/test").Browser, opts: { size?: (typeof SIZES)[number]; errors?: string[] } = {}) {
  const ctx = await browser.newContext({ viewport: opts.size ?? SIZES[0], deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => opts.errors?.push(e.message));
  return { ctx, page };
}

/** Everything a stray command or a refused file could change in the running battle. */
async function snap(page: Page) {
  const f = await facts(page);
  return JSON.stringify({ simTime: f.simTime, isPaused: f.isPaused, speed: f.speed, orders: f.orders, units: f.units, log: f.log, messages: f.messages, expended: f.expended, scenario: f.scenario });
}


test.describe("SAND-SAVE-1 refusal, terminal, navigation and lifecycle", () => {
  test("bad files, cancel, Esc, keys and rapid input leave the running battle intact; a save failure is shown", async ({ browser }) => {
    test.setTimeout(600_000);
    mkdirSync(DIR, { recursive: true });
    const { ctx, page } = await newPage(browser);
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      await page.keyboard.press("Escape");
      // a real order, then some real time
      await page.getByTestId("mission-focus-unit").click();
      await page.getByTestId("order-add-waypoint").click();
      await page.getByTestId("mission-focus-gate").click();
      await page.waitForTimeout(3500);
      await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
      await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await autopauseOff(page);
      await setSpeed(page, "60x");
      await page.getByTestId("sim-toggle-pause").click();
      await expect.poll(async () => (await facts(page)).elapsedH, { timeout: 120_000 }).toBeGreaterThan(0.05);
      const good = path.join(DIR, "good.sandsave.json");
      await saveViaUi(page, good);
      const text = readFileSync(good, "utf8");
      const mutate = (fn: (f: any) => void) => {
        const f = JSON.parse(text);
        fn(f);
        return JSON.stringify(f);
      };
      const reference = await snap(page);
      expect((await facts(page)).isPaused).toBe(true);
      await godOffThenOn(page);

      const bad: [string, { name: string; mimeType: string; buffer: Buffer }, RegExp][] = [
        ["html page", { name: "page.html", mimeType: "text/html", buffer: Buffer.from("<html><body>hello</body></html>") }, /valid JSON|wrong file type|not a Sandkasten/i],
        ["truncated", { name: "cut.sandsave.json", mimeType: "application/json", buffer: Buffer.from(text.slice(0, Math.floor(text.length / 2))) }, /valid JSON|truncated/i],
        ["empty", { name: "empty.json", mimeType: "application/json", buffer: Buffer.from("") }, /empty/i],
        ["wrong version", { name: "v2.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.version = 2; })) }, /version 2/i],
        ["wrong revision", { name: "rev.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.configRevision = "sand-rules-0.00000000.00000000"; })) }, /different rules or platform data/i],
        ["unknown scenario", { name: "custom.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.configId = "custom"; })) }, /unsupported scenario/i],
        ["bad number", { name: "nan.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.game.simTime = null; })) }, /game\.simTime/],
        ["duplicate unit id", { name: "dup.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.game.sides[0].units.push({ ...f.game.sides[0].units[0] }); })) }, /duplicate id/i],
        ["dangling reference", { name: "ref.sandsave.json", mimeType: "application/json", buffer: Buffer.from(mutate((f) => { f.game.orders.push(["ghost", { ...f.game.orders[0][1], unitId: "ghost" }]); })) }, /unknown unit "ghost"/],
        ["oversized", { name: "huge.sandsave.json", mimeType: "application/json", buffer: Buffer.alloc(9 * 1024 * 1024, 32) }, /larger than/i],
        ["image bytes", { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]) }, /valid JSON|Sandkasten/i],
      ];
      await page.getByTestId("cmd-load").click();
      await expect(page.getByTestId("load-dialog")).toBeVisible();
      for (const [label, file, re] of bad) {
        await page.getByTestId("load-file").setInputFiles(file);
        await expect(page.getByTestId("load-error"), label).toBeVisible();
        await expect(page.getByTestId("load-error"), label).toContainText(re);
        await expect(page.getByTestId("load-error")).toContainText("Your current battle is unchanged");
        await expect(page.getByTestId("load-confirm"), label).toBeDisabled();
        if (label === "wrong revision") await shotBoth(page, "load-validation-error");
      }
      expect(await snap(page)).toBe(reference);

      // rapid repeated input: the last pick wins, one valid file previews, nothing changed yet
      await page.getByTestId("load-file").setInputFiles(bad[0][1]);
      await page.getByTestId("load-file").setInputFiles({ name: "good.sandsave.json", mimeType: "application/json", buffer: Buffer.from(text) });
      await expect(page.getByTestId("load-preview")).toBeVisible();
      await expect(page.getByTestId("load-error")).toHaveCount(0);
      await expect(page.getByTestId("load-warning")).toContainText(/replaces the battle in progress/i);
      await expect(page.getByTestId("load-media-note")).toContainText(/media/i);
      expect(await snap(page)).toBe(reference);

      // keys belong to the dialog: no shortcut reaches the battle underneath
      for (const k of ["Space", "1", "2", "3", "g", "t", "b", "s", "m", "e", "r"]) await page.keyboard.press(k);
      await godOffStill(page);
      expect(await snap(page)).toBe(reference);
      // Esc cancels
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("load-dialog")).toBeHidden();
      expect(await snap(page)).toBe(reference);
      // Cancel button
      await page.getByTestId("cmd-load").click();
      await page.getByTestId("load-file").setInputFiles({ name: "good.sandsave.json", mimeType: "application/json", buffer: Buffer.from(text) });
      await page.getByTestId("load-cancel").click();
      await expect(page.getByTestId("load-dialog")).toBeHidden();
      expect(await snap(page)).toBe(reference);
      // five rapid clicks on LOAD BATTLE open one dialog
      for (let i = 0; i < 5; i++) await page.getByTestId("cmd-load").click({ force: true, noWaitAfter: true }).catch(() => {});
      await expect(page.getByTestId("load-dialog")).toHaveCount(1);
      await page.keyboard.press("Escape");

      // a save that cannot be written says so, and the battle stays as it was
      await page.evaluate(() => { URL.createObjectURL = () => { throw new Error("blob store full"); }; });
      await page.getByTestId("cmd-save").click();
      await expect(page.getByTestId("save-error")).toContainText("blob store full");
      await expect(page.getByTestId("save-notice")).toContainText(/Nothing was written/i);
      expect(await snap(page)).toBe(reference);
      await page.getByTestId("save-dismiss").click();

      // confirm a valid load: replaces the run, drops selection and God mode, loads paused
      await page.getByTestId("cmd-load").click();
      await page.getByTestId("load-file").setInputFiles({ name: "good.sandsave.json", mimeType: "application/json", buffer: Buffer.from(text) });
      await page.getByTestId("load-confirm").dblclick(); // a double click confirms once
      await expect(page.getByTestId("load-dialog")).toBeHidden();
      await page.waitForTimeout(1800);
      await godOff(page);
      await expect(page.getByTestId("order-panel")).toHaveCount(0);
      const after = await facts(page);
      expect(after.isPaused).toBe(true);
      expect(await snap(page)).toBe(reference);
    } finally {
      await ctx.close();
    }
  });

  test("a production-combat defeat (fixture) loads terminal, keeps blocking commands, and PLAY AGAIN starts fresh", async ({ browser }) => {
    test.setTimeout(600_000);
    mkdirSync(DIR, { recursive: true });
    const fixture = path.join(DIR, "defeat-fixture.sandsave.json");
    {
      // FIXTURE: thirty C-802s are put into flight at the carrier through the real combat path with fixed dice
      const { ctx, page } = await newPage(browser);
      try {
        await openPlay(page, "/play", { e2eHandle: true });
        await page.keyboard.press("Escape");
        await injectKillOnCarrier(page);
        await setSpeed(page, "60x");
        await page.getByTestId("sim-toggle-pause").click();
        await runUntilResult(page, 300_000);
        await expect(page.getByTestId("result-title")).toContainText("DEFEAT");
        // a finished battle can be saved from its own debrief
        await saveViaUi(page, fixture, "result-save");
      } finally {
        await ctx.close();
      }
    }
    const { ctx, page } = await newPage(browser);
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const L = await loadViaUi(page, fixture);
      expect(L.preview).toContain("DEFEAT");
      expect(L.preview).toContain("PLAY AGAIN");
      await L.confirm();
      await expect(page.getByTestId("result-overlay")).toBeVisible();
      await expect(page.getByTestId("result-title")).toContainText("DEFEAT");
      await expect(page.getByTestId("result-deciding")).toContainText(/destroyed/i);
      await expect(page.getByTestId("autopause-reason")).toHaveCount(0);
      await expect(page.getByTestId("teletype-line").filter({ hasText: "AUTOPAUSE" })).toHaveCount(0);
      const f = await facts(page);
      expect(f.result).toBe("defeat");
      expect(f.isPaused).toBe(true);
      await shotBoth(page, "loaded-defeat-debrief");
      await page.getByTestId("review-record").click();
      await assertFrozen(page, { selected: false });
      await page.getByTestId("show-debrief").click();
      await expect(page.getByTestId("result-overlay")).toBeVisible();
      // PLAY AGAIN: a fresh run of the same built-in battle
      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("result-overlay")).toHaveCount(0);
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
      const g = await facts(page);
      expect(g.result).toBeNull();
      expect(g.units).toBeLessThan(f.units + 1);
      expect(g.log).toBe(0);
      expect(g.isPaused).toBe(true);
      expect(g.elapsedH).toBe(0);
      await shotBoth(page, "loaded-defeat-play-again");
    } finally {
      await ctx.close();
    }
    writeFileSync(path.join(OUT, "defeat-fixture-note.txt"), "FIXTURE: defeat produced by injectKillOnCarrier (tests/helpers/sandPlay.ts): 30 C-802 Noor missiles put in flight at USS Nimitz through the production combat phase with fixed dice (Math.random = 0.7), then saved from the real debrief with SAVE BATTLE and loaded in a fresh page. Not a real-play defeat.\n");
  });

  test("snapshot round trip, demo to snapshot to demo navigation, reloads, legacy routes, repeated loads and a network-free save/load", async ({ browser }) => {
    test.setTimeout(600_000);
    mkdirSync(DIR, { recursive: true });
    const errors: string[] = [];
    const blocked: string[] = [];
    const { ctx, page } = await newPage(browser, { errors });
    const hormuzName = "Strait of Hormuz Standoff";
    const nav = (url: string) => page.evaluate((u) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(u), url);
    try {
      await localOnly(page, blocked);
      await installProbes(page);
      await openPlay(page, "/play", { e2eHandle: true });
      await expect(page.getByTestId("mission-panel")).toBeVisible();
      await autopauseOff(page);
      await setSpeed(page, "60x");
      await page.getByTestId("sim-toggle-pause").click();
      await expect.poll(async () => (await facts(page)).elapsedH, { timeout: 90_000 }).toBeGreaterThan(0.03);
      const hormuzFile = path.join(DIR, "hormuz-early.sandsave.json");
      await saveViaUi(page, hormuzFile);
      await page.getByTestId("save-dismiss").click();

      // demo -> snapshot (client navigation, no reload)
      await nav("/play?scenario=snapshot");
      await expect.poll(async () => (await facts(page).catch(() => ({ scenario: "" }))).scenario, { timeout: 60_000 }).not.toBe(hormuzName);
      await expect(page.getByTestId("mission-panel")).toHaveCount(0);
      await expect(page.getByTestId("briefing-mission")).toHaveCount(0);
      const snapFacts = await facts(page);
      expect(snapFacts.hasEvents).toBe(false);
      expect(snapFacts.result).toBeNull();
      await expect(page.getByTestId("mode-continuous-only")).toBeVisible();
      await page.keyboard.press("Escape");
      await autopauseOff(page);
      await setSpeed(page, "30x");
      await page.getByTestId("sim-toggle-pause").click();
      await expect.poll(async () => (await facts(page)).elapsedH, { timeout: 90_000 }).toBeGreaterThan(0.01);
      const snapshotFile = path.join(DIR, "snapshot.sandsave.json");
      await saveViaUi(page, snapshotFile);
      await page.getByTestId("save-dismiss").click();
      const snapAtSave = await facts(page);

      // snapshot -> demo (client navigation): the Hormuz battle is whole again, nothing of the snapshot in it
      await nav("/play");
      await expect.poll(async () => (await facts(page).catch(() => ({ scenario: "" }))).scenario, { timeout: 60_000 }).toBe(hormuzName);
      await expect(page.getByTestId("mission-panel")).toBeVisible();
      const back = await facts(page);
      expect(back.hasEvents).toBe(true);
      expect(back.elapsedH).toBe(0);
      // history: back and forward
      await page.goBack();
      await expect.poll(async () => (await facts(page).catch(() => ({ scenario: "" }))).scenario, { timeout: 60_000 }).not.toBe(hormuzName);
      await page.goForward();
      await expect.poll(async () => (await facts(page).catch(() => ({ scenario: "" }))).scenario, { timeout: 60_000 }).toBe(hormuzName);

      // loading a snapshot file on the Hormuz route switches the whole play session to the snapshot configuration
      const L1 = await loadViaUi(page, snapshotFile);
      expect(L1.preview).not.toContain(hormuzName.toUpperCase());
      await L1.confirm();
      const s1 = await facts(page);
      expect(s1.scenario).toBe(snapAtSave.scenario);
      expect(s1.simTime).toBe(snapAtSave.simTime);
      expect(s1.isPaused).toBe(true);
      expect(s1.hasEvents).toBe(false);
      await expect(page.getByTestId("mission-panel")).toHaveCount(0);
      await expect(page).toHaveURL(/scenario=snapshot/);
      await expect(page.getByTestId("result-overlay")).toHaveCount(0);
      // reset after load restarts the snapshot, not the Hormuz route's battle
      await page.getByTestId("cmd-reset").click();
      const s2 = await facts(page);
      expect(s2.scenario).toBe(snapAtSave.scenario);
      expect(s2.elapsedH).toBe(0);
      await expect(page.getByTestId("mission-panel")).toHaveCount(0);
      // a reload opens what the address says
      await page.reload();
      await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
      expect((await facts(page)).scenario).toBe(snapAtSave.scenario);
      // and the Hormuz file loads back from the snapshot route
      const L2 = await loadViaUi(page, hormuzFile);
      await L2.confirm();
      const h1 = await facts(page);
      expect(h1.scenario).toBe(hormuzName);
      expect(h1.hasEvents).toBe(true);
      await expect(page.getByTestId("mission-panel")).toBeVisible();
      await expect(page).not.toHaveURL(/scenario=snapshot/);
      await page.getByTestId("cmd-reset").click();
      expect((await facts(page)).scenario).toBe(hormuzName);
      expect((await facts(page)).elapsedH).toBe(0);

      // repeated loads leak nothing: the same counts of window listeners and intervals after each one, no God mode, no selection
      const counts: unknown[] = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("g");
        await page.getByTestId("mission-focus-unit").click();
        const L = await loadViaUi(page, hormuzFile);
        await L.confirm();
        await godOff(page);
        await expect(page.getByTestId("order-panel")).toHaveCount(0);
        counts.push(await probeCounts(page));
      }
      const c = counts as { keydown: number; total: number; intervals: number }[];
      for (const x of c.slice(1)) expect(x).toEqual(c[0]);
      expect((await facts(page)).isPaused).toBe(true);
      await shotBoth(page, "snapshot-and-demo-after-loads");

      // legacy routes, both ways, no page error
      for (const [url, snapshot] of [["/play?map=legacy", false], ["/play?scenario=snapshot&map=legacy", true]] as const) {
        const e0 = errors.length;
        await page.goto(url, { timeout: 120_000 });
        await page.waitForSelector("[data-testid=sim-clock], .maplibregl-canvas", { timeout: 60_000 });
        await page.waitForTimeout(2500);
        const body = await page.locator("body").innerText();
        if (snapshot) expect(body).not.toMatch(/OPERATION SENTINEL PASSAGE|Transit Complete/i);
        expect(errors.slice(e0)).toEqual([]);
      }
      await page.goto("/play", { timeout: 120_000 });
      await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
      await expect(page.getByTestId("mission-panel")).toBeVisible();

      // all of the above ran with the network closed: nothing but the game's own server was reachable
      // what the page itself asks for (basemap tiles, web fonts, the optional local-LLM probe) is blocked and the game still plays;
      // no source feed or any other host is ever contacted, and save/load needed none of it
      const outside = [...new Set(blocked)].filter(
        (u) => !/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|tiles\.openfreemap\.org)\//.test(u) && !/\/api\/ollama\//.test(u) && !/^http:\/\/localhost:11434\//.test(u),
      );
      writeFileSync(path.join(OUT, "network-and-lifecycle.json"), JSON.stringify({ requestsBlocked: [...new Set(blocked)], nonOllamaRequestsBlocked: outside, probeCounts: c, pageErrors: errors }, null, 2));
      expect(outside).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});

async function godOffThenOn(page: Page) {
  await page.getByLabel("Toggle god mode").click();
  await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "true");
}
async function godOffStill(page: Page) {
  await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "true");
}
