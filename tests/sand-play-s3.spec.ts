import { test, expect, type Page } from "@playwright/test";

/**
 * SAND-PLAY-S3 (round 2): the /play attribution line must stay visible and clear of the plot's
 * labelled area, and the TRAFFIC teletype must never clip its opening briefing mid-word.
 *
 * Four sizes reproduce the release-polish sizes named in the card (1280x720, 1400x730, 1600x900,
 * 1920x1080). At each size we check that:
 *   1. the credit is present, visible and unclipped by its own box or the viewport;
 *   2. no map label or unit data block intersects the credit box;
 *   3. hiding the credit does not change the number of visible map labels (the credit is not an
 *      occluder that pushes labels away);
 *   4. every TRAFFIC line fits its row (no horizontal clip).
 */

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1400, height: 730 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
] as const;

// DOM elements the plot places in its overlay: unit/contact data blocks and every map label type.
const PLOT_LABELS =
  ".tx-block, .tx-grid-label, .tx-ring-label, .tx-fac-label, .tx-wp-label, .tx-measure-label, .tx-obj-label";

type Credit = { x: number; y: number; w: number; h: number; text: string; visible: boolean; clipped: boolean };
type Measure = {
  viewport: { w: number; h: number };
  credit: Credit | null;
  creditOverlaps: string[];
  teletype: { visible: boolean; lines: number; lineStates: { text: string; scrollWidth: number; clientWidth: number; clipped: boolean }[] };
};

async function measure(page: Page): Promise<Measure> {
  return page.evaluate((labelsSel) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const shown = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0;
    };
    const onScreen = (b: DOMRect) => b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < vw && b.top < vh;

    const creditEl = document.querySelector<HTMLElement>('[data-testid="plot-attribution"]');
    let credit: Credit | null = null;
    const creditOverlaps: string[] = [];
    if (creditEl) {
      const visible = shown(creditEl);
      const r = creditEl.getBoundingClientRect();
      const clipped =
        !visible ||
        r.x < 0 || r.y < 0 || r.right > vw || r.bottom > vh || r.width === 0 || r.height === 0 ||
        creditEl.scrollWidth > creditEl.clientWidth + 1 ||
        creditEl.scrollHeight > creditEl.clientHeight + 1;
      credit = { x: r.x, y: r.y, w: r.width, h: r.height, text: (creditEl.textContent ?? "").replace(/\s+/g, " ").trim(), visible, clipped };
      document.querySelectorAll<HTMLElement>(labelsSel).forEach((el) => {
        if (!shown(el)) return;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        const ox = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        const oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (ox > 1 && oy > 1) {
          creditOverlaps.push(`${el.className.split(" ")[0]} "${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24)}"`);
        }
      });
    }

    const tty = document.querySelector<HTMLElement>('[data-testid="teletype"]');
    const lineEls = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="teletype-line"]'));
    // The docked briefing panel sits over the right of the teletype: text running under it is clipped to the player too.
    const brief = document.querySelector<HTMLElement>('[data-testid="briefing"]');
    const briefLeft = brief && shown(brief) ? brief.getBoundingClientRect().left : Infinity;
    const lineStates = lineEls.map((l) => {
      const range = document.createRange();
      range.selectNodeContents(l);
      const textRight = Math.max(...Array.from(range.getClientRects()).map((r) => r.right), 0);
      return {
        text: (l.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
        scrollWidth: l.scrollWidth,
        clientWidth: l.clientWidth,
        clipped: l.scrollWidth > l.clientWidth || textRight > briefLeft + 1,
      };
    });

    return {
      viewport: { w: vw, h: vh },
      credit,
      creditOverlaps,
      teletype: { visible: !!tty && shown(tty), lines: lineEls.length, lineStates },
    };
  }, PLOT_LABELS);
}

async function countVisibleLabels(page: Page): Promise<number> {
  return page.evaluate((labelsSel) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let n = 0;
    document.querySelectorAll<HTMLElement>(labelsSel).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < vw && b.top < vh) n++;
    });
    return n;
  }, PLOT_LABELS);
}

async function setCreditHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    const el = document.querySelector<HTMLElement>('[data-testid="plot-attribution"]');
    if (el) el.style.display = h ? "none" : "";
  }, hidden);
}

test("credit sits in chrome clear of the plot and TRAFFIC wraps without clipping at four sizes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/play", { timeout: 120_000 });
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("plot-attribution")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.fonts.ready);

    const m = await measure(page);

    // 1. credit present, visible and unclipped
    expect.soft(m.credit, `credit present at ${size.width}x${size.height}`).not.toBeNull();
    expect.soft(m.credit?.visible, `credit visible at ${size.width}x${size.height}`).toBe(true);
    expect.soft(m.credit?.clipped, `credit not clipped at ${size.width}x${size.height}`).toBe(false);
    expect.soft(m.credit?.text ?? "", `credit carries its licence text at ${size.width}x${size.height}`).toContain("OpenStreetMap");
    expect.soft(m.credit?.text ?? "").toContain("ETOPO1");
    expect.soft(m.credit?.text ?? "").toContain("Auftragstaktik");

    // 2. no map label or unit data block intersects the credit box
    expect.soft(
      m.creditOverlaps,
      `credit clear of every map label at ${size.width}x${size.height}\n${m.creditOverlaps.join("\n")}`,
    ).toEqual([]);

    // 3. hiding the credit must not push any label away
    const withCredit = await countVisibleLabels(page);
    await setCreditHidden(page, true);
    await page.waitForTimeout(600);
    const withoutCredit = await countVisibleLabels(page);
    await setCreditHidden(page, false);
    await page.waitForTimeout(600);
    expect.soft(
      withoutCredit,
      `no label pushed away by the credit at ${size.width}x${size.height} (visible with credit ${withCredit}, without ${withoutCredit})`,
    ).toBe(withCredit);

    // 4. TRAFFIC: filled with the opening briefing, never clipped mid-word
    expect.soft(m.teletype.visible, `TRAFFIC panel visible at ${size.width}x${size.height}`).toBe(true);
    expect.soft(m.teletype.lines, `TRAFFIC panel has lines at ${size.width}x${size.height}`).toBeGreaterThan(0);
    for (const line of m.teletype.lineStates) {
      expect.soft(
        line.clipped,
        `TRAFFIC line not clipped at ${size.width}x${size.height} (scroll ${line.scrollWidth} > client ${line.clientWidth}): "${line.text}..."`,
      ).toBe(false);
    }
  }
});
