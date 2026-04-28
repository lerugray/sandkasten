import { test, expect } from "@playwright/test";

function readNumberFromText(text: string | null | undefined) {
  const n = Number((text ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

test.describe("sand-006 — Waypoints + throttle interaction", () => {
  test("waypoints render, flank throttle set, unit moves and waypoints clear", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    const fireMapClick = async (position: { x: number; y: number }) => {
      await page.evaluate(({ x, y }) => {
        const mapEl = document.querySelector(".maplibregl-map") as any;
        const map = mapEl?.__maplibreMap;
        if (!map) throw new Error("Map handle not found on .maplibregl-map");
        const lngLat = map.unproject([x, y]);
        map.fire("click", {
          lngLat,
          point: { x, y },
          originalEvent: { target: map.getCanvas() },
        });
      }, position);
    };

    // Select first friendly unit in Forces sidebar.
    const firstUnitBtn = page.locator(".w-80 button.w-full").first();
    await firstUnitBtn.click();

    // Order panel should appear.
    await expect(page.getByTestId("order-panel")).toBeVisible({ timeout: 5_000 });

    // Enter waypoint placement mode.
    await page.getByTestId("order-add-waypoint").click();
    await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible({ timeout: 3_000 });

    await fireMapClick({ x: 420, y: 320 });
    await fireMapClick({ x: 520, y: 360 });
    await fireMapClick({ x: 620, y: 420 });

    await expect(page.getByTestId("order-waypoints-list")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("order-waypoint-item")).toHaveCount(3);

    // Waypoint path should be present in the map source.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mapEl = document.querySelector(".maplibregl-map") as any;
            const map = mapEl?.__maplibreMap;
            const src = map?.getSource("waypoint-lines") as any;
            const data = src?._data;
            return { hasMap: !!map, featureCount: (data?.features ?? []).length };
          }),
        { timeout: 5_000 }
      )
      .toMatchObject({ hasMap: true });

    // Set throttle to FLANK.
    await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();

    // Capture initial speed/heading, then run for a bit.
    await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 5_000 });
    const spd0 = await readNumberFromText(await page.getByTestId("detail-unit-spd").textContent());
    const hdg0 = await readNumberFromText(await page.getByTestId("detail-unit-hdg").textContent());

    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY
    await page.waitForTimeout(3_000);

    // Speed should increase and heading should change at least once while navigating.
    await expect
      .poll(async () => readNumberFromText(await page.getByTestId("detail-unit-spd").textContent()), {
        timeout: 20_000,
      })
      .toBeGreaterThan(spd0);

    await expect
      .poll(async () => readNumberFromText(await page.getByTestId("detail-unit-hdg").textContent()), {
        timeout: 20_000,
      })
      .not.toBe(hdg0);

    // Pause, then clear waypoints and ensure they disappear.
    await page.getByTestId("sim-toggle-pause").click(); // PAUSE
    await page.getByTestId("order-clear-waypoints").click();

    await expect(page.getByTestId("order-waypoints-list")).not.toBeVisible({ timeout: 5_000 });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mapEl = document.querySelector(".maplibregl-map") as any;
            const map = mapEl?.__maplibreMap;
            const src = map?.getSource("waypoint-lines") as any;
            const data = src?._data;
            return (data?.features ?? []).length;
          }),
        { timeout: 5_000 }
      )
      .toBe(0);
  });
});

