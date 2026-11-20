// SAND-ART1 glyph sheet: every unit and contact glyph the plot draws, before (milsymbol, as the base tree drew
// it) beside after (src/lib/plot/symbolTextures.ts), at real pixels (DPR 2) and at 4x.
//
//   SAND_ART_SET=after npx playwright test tests/sand-art1-glyphs.spec.ts
//
// Skipped without SAND_ART_SET, like the frame tool. The "before" column is rebuilt here from the milsymbol
// package with the exact options the base tree used, so the sheet can be regenerated from this tree alone.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay } from "./helpers/sandPlay";

const SET = process.env.SAND_ART_SET ?? "";
const OUT = path.join(process.cwd(), "docs", "art-fable-r1");

test.skip(!SET, "capture tool: set SAND_ART_SET to build the glyph sheet");

const GREEN = "#4cf58e", DIM = "#2b9e5c", RED = "#ff4b3a", AMBER = "#f5c451";

type Row = { label: string; sidc: string; before: string; after: string; state: { certainty: string; stale?: boolean; damage?: number } };
const own = { certainty: "own" };
const ROWS: Row[] = [
  { label: "OWN carrier", sidc: "SFSPCV--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN surface combatant", sidc: "SFSPCL--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN merchant / auxiliary", sidc: "SFSPXM--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN submarine", sidc: "SFUPSN--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN fixed-wing", sidc: "SFAPMF--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN helicopter", sidc: "SFAPMH--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN ground unit", sidc: "SFGPUCI-------", before: GREEN, after: GREEN, state: own },
  { label: "OWN facility", sidc: "SFGPIB--------", before: GREEN, after: GREEN, state: own },
  { label: "OWN ship, damaged", sidc: "SFSPCL--------", before: GREEN, after: GREEN, state: { certainty: "own", damage: 1 } },
  { label: "OWN ship, mission kill", sidc: "SFSPCL--------", before: GREEN, after: GREEN, state: { certainty: "own", damage: 2 } },
  { label: "HOSTILE ship (god view)", sidc: "SHSPCL--------", before: RED, after: RED, state: own },
  { label: "HOSTILE submarine (god view)", sidc: "SHUPSN--------", before: RED, after: RED, state: own },
  { label: "HOSTILE fixed-wing (god view)", sidc: "SHAPMF--------", before: RED, after: RED, state: own },
  { label: "HOSTILE helicopter (god view)", sidc: "SHAPMH--------", before: RED, after: RED, state: own },
  { label: "HOSTILE ground unit (god view)", sidc: "SHGPUCI-------", before: RED, after: RED, state: own },
  { label: "HOSTILE facility (god view)", sidc: "SHGPIB--------", before: RED, after: RED, state: own },
  { label: "NEUTRAL ship", sidc: "SNSPXM--------", before: DIM, after: DIM, state: own },
  { label: "NEUTRAL fixed-wing", sidc: "SNAPMF--------", before: DIM, after: DIM, state: own },
  { label: "CONTACT unknown (UNK)", sidc: "SUZP----------", before: DIM, after: AMBER, state: { certainty: "unknown" } },
  { label: "CONTACT unknown, fading", sidc: "SUZP----------", before: DIM, after: AMBER, state: { certainty: "unknown", stale: true } },
  { label: "CONTACT detected (DET)", sidc: "SUZP----------", before: DIM, after: AMBER, state: { certainty: "detected" } },
  { label: "CONTACT detected, fading", sidc: "SUZP----------", before: DIM, after: AMBER, state: { certainty: "detected", stale: true } },
  { label: "CONTACT classified ship (CLS)", sidc: "SHSPCL--------", before: RED, after: RED, state: { certainty: "classified" } },
  { label: "CONTACT classified aircraft (CLS)", sidc: "SHAPMF--------", before: RED, after: RED, state: { certainty: "classified" } },
  { label: "CONTACT tracked ship (TRK)", sidc: "SHSPCL--------", before: RED, after: RED, state: { certainty: "tracked" } },
  { label: "CONTACT tracked aircraft (TRK)", sidc: "SHAPMF--------", before: RED, after: RED, state: { certainty: "tracked" } },
  { label: "CONTACT tracked submarine (TRK)", sidc: "SHUPSN--------", before: RED, after: RED, state: { certainty: "tracked" } },
  { label: "CONTACT tracked, no platform", sidc: "SHZP----------", before: RED, after: RED, state: { certainty: "tracked" } },
  { label: "CONTACT tracked ship, fading", sidc: "SHSPCL--------", before: RED, after: RED, state: { certainty: "tracked", stale: true } },
  { label: "CONTACT classified ship, fading", sidc: "SHSPCL--------", before: RED, after: RED, state: { certainty: "classified", stale: true } },
];

test("glyph sheet: before and after, real pixels and 4x", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await openPlay(page, "/play", { e2eHandle: true });
    await page.addScriptTag({ path: path.join(process.cwd(), "node_modules", "milsymbol", "dist", "milsymbol.js") });
    const dataUrl = await page.evaluate(async (rows) => {
      const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const ms = w.ms;
      const R = 2; // device pixels per CSS pixel on Ray's screen
      const load = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const cell = 48 * R, big = cell * 4, pad = 14, labelW = 520, rowH = big + pad;
      const cols = [labelW, labelW + cell + 40, labelW + cell + 40 + big + 60, labelW + cell + 40 + big + 60 + cell + 40];
      // two blocks of rows side by side, so the sheet is not one endless strip
      const BW = cols[3] + big + pad + 30, half = Math.ceil(rows.length / 2);
      const W = BW * 2, H = 70 + half * rowH + pad;
      const sheet = document.createElement("canvas");
      sheet.width = W; sheet.height = H;
      const g = sheet.getContext("2d")!;
      g.fillStyle = "#030e08"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#b9f4cf"; g.font = "bold 24px monospace"; g.textBaseline = "middle";
      for (const ox of [0, BW]) {
        g.fillText("GLYPH", ox + pad, 34);
        g.fillText("BEFORE 1x", ox + cols[0] - 30, 34); g.fillText("BEFORE 4x", ox + cols[1], 34);
        g.fillText("AFTER 1x", ox + cols[2] - 30, 34); g.fillText("AFTER 4x", ox + cols[3], 34);
      }
      const put = (src: CanvasImageSource, sw: number, sh: number, x: number, y: number, k: number) => {
        // centre the glyph in its cell; k = 1 real pixels, k = 4 enlarged without smoothing
        g.imageSmoothingEnabled = false;
        g.drawImage(src, x + (cell * k - sw * k) / 2, y + (cell * k - sh * k) / 2, sw * k, sh * k);
      };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const ox = i < half ? 0 : BW;
        const y = 70 + (i < half ? i : i - half) * rowH;
        g.fillStyle = (i < half ? i : i - half) % 2 ? "#04130b" : "#030e08"; g.fillRect(ox, y - pad / 2, BW, rowH);
        g.fillStyle = "#b9f4cf"; g.font = "22px monospace";
        g.fillText(r.label, ox + pad, y + big / 2);
        const sym = new ms.Symbol(r.sidc, { size: 22, monoColor: r.before, strokeWidth: 3, outlineWidth: 0, infoFields: false });
        const b = sym.asCanvas(R) as HTMLCanvasElement;
        put(b, b.width, b.height, ox + cols[0], y + (big - cell) / 2, 1);
        put(b, b.width, b.height, ox + cols[1], y, 4);
        const a = await load(w.__sandPlot.glyph(r.sidc, r.after, R, r.state));
        put(a, a.width, a.height, ox + cols[2], y + (big - cell) / 2, 1);
        put(a, a.width, a.height, ox + cols[3], y, 4);
      }
      return sheet.toDataURL("image/png");
    }, ROWS);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, "glyph-sheet.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
    expect(dataUrl.length).toBeGreaterThan(10_000);
  } finally {
    await ctx.close();
  }
});
