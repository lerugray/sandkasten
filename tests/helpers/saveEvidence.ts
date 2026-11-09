import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { W } from "./sandPlay";

export const OUT = path.join(process.cwd(), "docs", "verification", "sand-save-1-s409");
export const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

/** Screenshot at both required sizes (the context is DPR 2) and record its hash, size and DPR. */
export async function shotBoth(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  const vp = page.viewportSize()!;
  const manifestPath = path.join(OUT, "frames.json");
  const manifest: Record<string, unknown> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  for (const s of SIZES) {
    await page.setViewportSize(s);
    await page.waitForTimeout(900);
    const file = `${s.width}x${s.height}-${name}.png`;
    const buf = await page.screenshot({ path: path.join(OUT, file) });
    manifest[file] = { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length, viewport: `${s.width}x${s.height}`, dpr: await page.evaluate(() => window.devicePixelRatio) };
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await page.setViewportSize(vp);
  await page.waitForTimeout(500);
}

/** SAVE BATTLE through the real control; the file the browser downloads is kept where the receipts live. */
export async function saveViaUi(page: Page, file: string, testId = "cmd-save") {
  mkdirSync(path.dirname(file), { recursive: true });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), page.getByTestId(testId).click()]);
  await dl.saveAs(file);
  await expect(page.getByTestId("save-notice")).toBeVisible();
  return dl.suggestedFilename();
}

/** LOAD BATTLE through the real dialog: pick the file, read the preview, confirm. */
export async function loadViaUi(page: Page, file: string, opts: { loadId?: string } = {}) {
  await page.getByTestId(opts.loadId ?? "cmd-load").click();
  await expect(page.getByTestId("load-dialog")).toBeVisible();
  await page.getByTestId("load-file").setInputFiles(file);
  await expect(page.getByTestId("load-preview")).toBeVisible();
  const preview = (await page.getByTestId("load-preview").innerText()).replace(/\s+/g, " ").trim();
  return {
    preview,
    confirm: async () => {
      await page.getByTestId("load-confirm").click();
      await expect(page.getByTestId("load-dialog")).toBeHidden();
      await page.waitForTimeout(1800); // the view rebuilds on the restored session
    },
  };
}

/** Read-only look at the live session through the test-build handle. */
export async function facts(page: Page) {
  return page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as any).snapshot();
    const g = snap.gameState;
    const side = g.scenario.playerSide as string;
    const units = g.sides.flatMap((s: any) => s.units);
    const own = units.filter((u: any) => u.side === side);
    const c = snap.combatState;
    const res = snap.eventState?.scenarioResult;
    return {
      simTime: g.simTime as number,
      elapsedH: (g.simTime - g.scenario.startTime) / 3.6e6,
      isPaused: g.isPaused as boolean,
      speed: g.speed as number,
      result: (res?.result ?? null) as string | null,
      resultSource: res?.source ?? null,
      units: units.length as number,
      ownStates: Object.fromEntries(own.map((u: any) => [u.name, u.damageState])) as Record<string, string>,
      playerContacts: g.contacts.length as number,
      otherContacts: Object.values(g.sideContacts).flat().length as number,
      weaponsInFlight: c.weaponsInFlight.length as number,
      log: c.combatLog.length as number,
      expended: Object.fromEntries([...c.weaponsExpended.entries()].map(([u, m]: any) => [u, Object.fromEntries(m)])) as Record<string, Record<string, number>>,
      fired: [...(snap.eventState?.firedEvents ?? [])] as string[],
      messages: (snap.eventState?.messages?.length ?? 0) as number,
      score: { ...g.score } as Record<string, number>,
      orders: Object.fromEntries([...g.orders.entries()].filter(([id]: any) => own.some((u: any) => u.id === id)).map(([id, o]: any) => [id, { wp: o.waypoints.map((w: any) => [w.position.lng, w.position.lat]), throttle: o.throttle, radar: o.radarActive }])) as Record<string, unknown>,
      scenario: g.scenario.name as string,
      hasEvents: !!snap.eventState,
    };
  });
}

export const clockText = async (page: Page) => (await page.getByTestId("sim-clock").innerText()).trim();
export const godOff = async (page: Page) => expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");

/** Block every request that is not the local game: the save and load paths must work with no network at all. */
export async function localOnly(page: Page, seen: string[]) {
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    const origin = `http://localhost:${process.env.SAND_E2E_PORT ?? 3001}`;
    // only the game's own server: a local LLM (Ollama on another port) and every source feed are blocked too
    if (u.origin === origin || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    seen.push(route.request().url());
    return route.abort();
  });
}

/** Like openPlay, but the frame gate is 3 frames: a machine without a GPU draws the plot at about 1 fps (the cloud battery reports its renderer). */
export async function openPlayLite(page: Page, url = "/play", opts: { e2eHandle?: boolean } = {}) {
  if (opts.e2eHandle) await page.addInitScript(() => { (window as unknown as W).__SAND_E2E__ = true; });
  await page.goto(url, { timeout: 120_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
  await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.frames() ?? 0) > 3, null, { timeout: 120_000 });
}
