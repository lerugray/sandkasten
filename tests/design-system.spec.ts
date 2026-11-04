import { test, expect } from "@playwright/test";

// /play is the Three.js terminal display (Ray 2026-11-03). The old Slate
// Command checks (blue accent, IBM Plex, MapLibre zoom controls) pinned the
// look that ruling replaced; these pin the terminal register instead.
test.describe("Terminal register design system", () => {
  test("home page — screenshot for visual review", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/home-page.png", fullPage: true });
  });

  test("play page — screenshot of initial state", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/play-page-dark.png", fullPage: true });
  });

  test("play page — tilt mode screenshot", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("t");
    await expect(page.getByRole("button", { name: "Toggle 3D tilt" })).toHaveAttribute("data-active", "true");
    await expect
      .poll(async () =>
        page.evaluate(() => (document.querySelector('[data-testid="tactical-plot"]') as any)?.__plot?.view().tilt ?? 0),
      )
      .toBeGreaterThan(0.95);
    await page.screenshot({ path: "test-results/play-page-tilt.png", fullPage: true });
  });

  test("play page — unit selected with detail panel", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("force-row").first().click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/play-page-unit-selected.png", fullPage: true });
  });

  test("play page — help panel screenshot", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("button[aria-label='Open help']").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/play-page-help.png", fullPage: true });
  });

  test("editor page — screenshot", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/editor-page.png", fullPage: true });
  });

  test("SANDKASTEN title uses the mode's phosphor primary colour", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    // CRT is the default display; its primary is phosphor #5cff8f = rgb(92, 255, 143)
    await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-display-mode", "crt");
    const title = page.getByRole("link", { name: "SANDKASTEN" });
    const color = await title.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/rgb\(92,\s*255,\s*143\)/);
  });

  test("each display mode loads and uses its vendored font", async ({ page }) => {
    const fontResponses: { url: string; status: number }[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/fonts/")) fontResponses.push({ url: r.url(), status: r.status() });
    });
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const expected: Record<string, string> = { crt: "Px437 IBM VGA", current: "JetBrains Mono", offsig: "IBM Plex Mono" };
    const title = page.getByRole("link", { name: "SANDKASTEN" });
    for (const mode of ["crt", "current", "offsig"]) {
      await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-display-mode", mode);
      const family = expected[mode];
      expect((await title.evaluate((el) => getComputedStyle(el).fontFamily)).toLowerCase()).toContain(family.toLowerCase());
      await expect.poll(() => page.evaluate((f) => document.fonts.check(`16px "${f}"`), family), { timeout: 10_000 }).toBe(true);
      await page.keyboard.press("v");
    }
    expect(fontResponses.length).toBeGreaterThanOrEqual(3);
    for (const r of fontResponses) expect(r.status).toBeLessThan(400);
  });

  test("V cycles the three display modes and the choice persists", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const root = page.getByTestId("terminal-root");
    await expect(root).toHaveAttribute("data-display-mode", "crt");
    await page.keyboard.press("v");
    await expect(root).toHaveAttribute("data-display-mode", "current");
    await expect(page.getByTestId("display-mode-readout")).toContainText("CURRENT");
    await page.keyboard.press("v");
    await expect(root).toHaveAttribute("data-display-mode", "offsig");
    await expect(page.getByTestId("display-mode-readout")).toContainText("OFF-SIGNATURE");
    await expect.poll(() => page.evaluate(() => (document.querySelector('[data-testid="tactical-plot"]') as any).__plot.mode())).toBe("offsig");
    await page.reload();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-display-mode", "offsig");
    await page.keyboard.press("v");
    await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-display-mode", "crt");
  });

  test("no remote font requests on /play", async ({ page }) => {
    const remote: string[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      const isFont = r.resourceType() === "font" || /\.(woff2?|ttf|otf)$/.test(url.pathname) || url.hostname.includes("fonts.g");
      if (isFont && url.hostname !== "localhost") remote.push(r.url());
    });
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.getByTestId("force-row").first().click();
    await page.locator("button[aria-label='Open help']").click();
    await page.waitForTimeout(500);
    expect(remote).toEqual([]);
  });

  test("chrome overlays do not resize the canvas", async ({ page }) => {
    await page.goto("/play");
    const canvas = page.getByTestId("plot-canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const viewport = page.viewportSize()!;
    const box0 = await canvas.boundingBox();
    expect(box0).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });

    // open every overlay that could plausibly push the scene around
    await page.getByTestId("force-row").first().click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await page.getByTestId("sidebar-tab-combat").click();
    await page.getByRole("button", { name: "Autopause settings" }).click();
    await expect(page.getByTestId("autopause-settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("button[aria-label='Open help']").click();
    await expect(page.locator("button[aria-label='Close help']")).toBeVisible();

    expect(await canvas.boundingBox()).toEqual(box0);
  });
});
