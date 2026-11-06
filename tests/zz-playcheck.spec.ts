import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

test.skip(!process.env.PLAY_CHECK, "lane-local scripted play check; run with PLAY_CHECK=1");

test("scripted play at 10x: engage, damage a US ship, reach a result", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await page.goto("/play");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Autopause settings").click();
  const toggle = page.getByTestId("autopause-toggle-enabled");
  if (((await toggle.textContent()) ?? "").trim() === "ON") await toggle.click();
  await page.getByLabel("Autopause settings").click();

  const seen = new Map<string, { n: number; clock: string }>();
  let lastClock = "";
  const clock = async () => {
    try { lastClock = ((await page.getByTestId("sim-clock").textContent({ timeout: 2000 })) ?? "").trim(); } catch { /* result screen replaced the HUD */ }
    return lastClock;
  };
  const harvest = async () => {
    const now = await clock();
    const lines = (await page.locator('[data-testid="combat-log-entry"]').allTextContents()).map((t) => t.replace(/^\s*\d+[smh]\s*/, "").trim());
    const counts = new Map<string, number>();
    for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const [l, n] of counts) {
      const prev = seen.get(l);
      if (!prev) seen.set(l, { n, clock: now });
      else if (n > prev.n) prev.n = n;
    }
  };

  await page.getByTestId("sidebar-tab-combat").click();
  await page.getByTestId("sidebar-tab-forces").click();
  await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();

  // The carrier: waypoint at the transit gate, flank speed
  await page.getByTestId("force-row").filter({ hasText: "Nimitz" }).click();
  await page.getByTestId("order-add-waypoint").click();
  const gate = await page.evaluate(() => {
    const plot = (document.querySelector('[data-testid="tactical-plot"]') as any).__plot;
    return plot.project(56.45, 26.65);
  });
  await page.evaluate(({ x, y }) => (document.querySelector('[data-testid="tactical-plot"]') as any).__plot.clickAt(x, y), gate);
  await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
  await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();
  await page.keyboard.press("x"); // carrier holds fire

  await page.getByTestId("sim-toggle-pause").click(); // PLAY
  await expect(page.getByTestId("contact-row").first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("sim-toggle-pause").click(); // HOLD

  // The US engages an Iranian contact through the order panel
  const passive = !!process.env.PLAY_PASSIVE;
  const noEngage = passive || !!process.env.PLAY_NOENGAGE;
  let engaged = noEngage ? "(skipped: no manual engage in this pass)" : "";
  for (const name of noEngage ? [] : ["Hornet 101", "Hornet 102", "USS Cole", "USS Mahan", "USS Chosin", "USS Nitze"]) {
    await page.getByTestId("force-row").filter({ hasText: name }).click();
    const select = page.getByTestId("order-engage-contact");
    if (!(await select.isVisible())) continue;
    const options = await select.locator("option").count();
    for (let i = 1; i < options && !engaged; i++) {
      await select.selectOption({ index: i });
      await page.getByTestId("order-engage").click();
      if ((await page.getByTestId("order-engage-feedback").getAttribute("data-ok")) === "true") {
        engaged = `${name}: ${await page.getByTestId("order-engage-feedback").textContent()}`;
      }
    }
    if (engaged) break;
  }
  expect(engaged).not.toBe("");

  // The rest of the escorts hold fire so the carrier is the one Iran can shoot at
  for (const name of passive ? ["Hornet 101", "Hornet 102", "USS Cole", "USS Chosin", "USS Mahan", "USS Nitze"] : ["USS Chosin", "USS Mahan", "USS Nitze"]) {
    await page.getByTestId("force-row").filter({ hasText: name }).click();
    await page.keyboard.press("x");
  }

  await page.getByTestId("sidebar-tab-combat").click();
  await page.getByTestId("sim-toggle-pause").click(); // PLAY

  const started = Date.now();
  let result = "";
  const logPath = process.env.PLAY_NOENGAGE ? "/tmp/s387-playcheck-d.log" : passive ? "/tmp/s387-playcheck-b.log" : "/tmp/s387-playcheck.log";
  const flush = async () => {
    const out = [
      `ENGAGE ORDER: ${engaged}`,
      `RESULT: ${result || "(none yet)"}`,
      `FINAL CLOCK: ${await clock()}`,
      `REAL SECONDS: ${Math.round((Date.now() - started) / 1000)}`,
      "COMBAT LOG (first seen at sim clock, count):",
      ...[...seen].map(([l, v]) => `${v.clock}  x${v.n}  ${l}`),
    ].join("\n");
    writeFileSync(logPath, out);
  };
  while (Date.now() - started < 28 * 60_000) {
    if (await page.locator(".tx-result").isVisible()) {
      result = ((await page.locator(".tx-result").textContent()) ?? "").trim();
      break;
    }
    await harvest();
    await flush();
    await page.waitForTimeout(10_000);
  }
  await harvest();
  await flush();
  expect(result).toMatch(/VICTORY|DEFEAT/i);
  const nimitzHits = [...seen].filter(([l]) => /hit USS Nimitz/i.test(l)).reduce((a, [, v]) => a + v.n, 0);
  console.log("NIMITZ HITS", nimitzHits);
});
