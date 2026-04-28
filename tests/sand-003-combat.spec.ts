import { test, expect } from "@playwright/test";

async function getMapHandles(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const mapEl = document.querySelector(".maplibregl-map") as any;
    const map = mapEl?.__maplibreMap;
    if (!map) return { hasMap: false };
    const weaponSource = map.getSource("weapon-tracks");
    return {
      hasMap: true,
      hasWeaponSource: !!weaponSource,
    };
  });
}

test.describe("sand-003 — Combat launch + impact", () => {
  test("weapon tracks appear, WIF count updates, combat log shows impacts", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    // Disable autopause so the sim can run uninterrupted to engagement.
    await page.getByLabel("Autopause settings").click();
    const autopauseToggle = page.getByTestId("autopause-toggle-enabled");
    await expect(autopauseToggle).toBeVisible({ timeout: 5_000 });
    if (((await autopauseToggle.textContent()) ?? "").trim() === "ON") {
      await autopauseToggle.click();
    }

    // Run fast to reach engagement.
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY

    // Weapons-in-flight UI count updates.
    await page.getByTestId("sidebar-tab-combat").click();
    await expect(page.getByTestId("weapons-in-flight-count")).toBeVisible({ timeout: 120_000 });

    // Wait for weapon track source to be created and populated.
    await expect
      .poll(async () => getMapHandles(page), { timeout: 120_000 })
      .toMatchObject({ hasMap: true, hasWeaponSource: true });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mapEl = document.querySelector(".maplibregl-map") as any;
            const map = mapEl?.__maplibreMap;
            const features = map?.querySourceFeatures?.("weapon-tracks") ?? [];
            const hasLine = features.some((f: any) => f.geometry?.type === "LineString");
            const hasPoint = features.some((f: any) => f.geometry?.type === "Point");
            return { featureCount: features.length, hasLine, hasPoint };
          }),
        { timeout: 120_000 }
      )
      .toMatchObject({ hasLine: true, hasPoint: true });

    // Impact / damage events should eventually appear in combat log.
    const combatLog = page.getByTestId("combat-log");
    await expect(combatLog).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(
        async () => {
          const hit = await page.locator(`[data-testid="combat-log-entry"][data-event-type="hit"]`).count();
          const miss = await page.locator(`[data-testid="combat-log-entry"][data-event-type="miss"]`).count();
          const intercept = await page.locator(`[data-testid="combat-log-entry"][data-event-type="intercept"]`).count();
          const defended = await page.locator(`[data-testid="combat-log-entry"][data-event-type="defended"]`).count();
          const damaged = await page.locator(`[data-testid="combat-log-entry"][data-event-type="damaged"]`).count();
          const destroyed = await page.locator(`[data-testid="combat-log-entry"][data-event-type="destroyed"]`).count();
          return hit + miss + intercept + defended + damaged + destroyed > 0;
        },
        { timeout: 120_000 }
      )
      .toBe(true);
  });
});

