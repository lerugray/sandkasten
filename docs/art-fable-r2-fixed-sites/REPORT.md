SAND-ART2 base=443af2c1441c285f2bb64db112ac0964bfbc68ed decision=CHANGED glyphs_changed=2/7 battery=GREEN text_diff=empty forbidden_pixels=PASS

Lane co3-sandart2-t501, branch `co3/sand-art2-site-glyphs`, launch tip `4057be10113c399b6f3c16ef92b2f3faa26bcf60` (the card commit on the ART1 R2 base; `git diff 443af2c 4057be1` touches only `docs/handoffs/sand-art2-site-glyphs-s409/`). Nothing committed, nothing pushed, `docs/ready/` untouched. Provisional art: GS recaptures on the integrated descendant before any KEEP/REVERT.

## 1. Skipped, weakened or unverified (read this first)

1. **`forbidden_pixels=PASS` is against criteria fixed before the AFTER set existed, not against the card's literal wording.** The card expects a bounded glow fringe with zero change outside it. That fringe does not exist in this renderer: the plot's bloom pass spreads a symbol's light across hundreds of pixels (section 6). Outside the redrawn sprite squares, 2,920,587 pixels differ across the 25 frames, none by more than 8/255, all of it glow. No pixel exceeds the whole-symbol glow envelope measured in the BEFORE set. If GS reads the card as "any pixel outside a small fringe fails", the gate fails for any redraw that changes how much light a symbol emits, and the only passing result is NO CHANGE.
2. **No single frame holds all seven kinds.** In the checked-in data the two nuclear sites have no radar, port or naval base within one screen at a scale that draws heliports. Frame 02 holds six kinds (all but nuclear); frames 05, 06 and 08 hold nuclear. Every kind has a production crop on the glyph sheet, so no fixture stands in for a kind.
3. **The neutral OSINT tint is a fixture.** `osintLayer.ts` has a neutral colour, and no site in `data/osint/hormuz.json` uses it. The sheet shows it as a labelled fixture (production texture times the palette colour), not a chart crop.
4. **/play has no facilities-off switch.** The layers-off control (frame 15) is the three OSINT layers switched off plus a view of open water with no fixed-site symbol on screen. Frame 14 is OSINT off over Bandar Abbas, facility symbols still drawn.
5. **Performance is display-capped.** All six runs hold the 60 Hz display rate, so the measurement shows no drop below it and cannot show a gain or a sub-frame loss. Draw calls and texture counts carry the comparison (section 8). The pairs were run twice, because the first run was timed on a wall clock that steps on this host.
6. **Small viewports got four poses each**, not the whole list: cold chart, crowded Bandar Abbas, Bushehr wide and close, at 1440x900 and 1280x720.
7. **Picks were recorded in two frames** (02 and 06, 12 and 8 icons). Picking elsewhere rests on the existing specs in the battery.
8. **The first radar redraw was rejected and replaced.** Its frames are not in the repo (scratch: `/home/ray/lanes-d/sand-art2-host-1794374249-673838/after-attempt1`); one production row is kept in `exploration/`.
9. **A frame was renamed after capture.** `05-bushehr-all-seven` became `05-bushehr-nuclear-wide` in all three sets once the frame was seen to hold four kinds. Names and notes only; pixels and state untouched.
10. **`AGENTS.md` does not exist in this repo.** The launch message asked for it; `CLAUDE.md`, `SPEC.md`, the card and the inventory were read instead.
11. **Not touched, by the fence:** README, SESSION_NOTES, the MapLibre glyph copies (`src/components/map/FacilityLayer.tsx`, `OsintLayer.tsx`). The legacy map and editor therefore still draw the old airbase and radar forms; the two renderers now differ for those two kinds.
12. **Look minors not folded.** The C-/802 split and the record second-line indent are panel text, not part of the two drawing bodies.

## 2. Per-glyph decision

Evidence for every row: `glyph-sheet.png` (production texture at 4x, then the production chart at real device pixels and 4x, both tints). Texture hashes are in `manifest.json`.

| glyph | decision | why |
|---|---|---|
| airbase | **CHANGED** | Before, the filled aircraft with its 3 px outline reached the ring (wing tips within half a texture pixel of the ring's inner edge). At 20 px the aircraft and ring fused into a disc with holes; see the civil crop (apt-ir-0057) and military crop (apt-ir-0003). After, the aircraft stays inside radius 16 of 32 with a slim fuselage, so wing, tailplane and ring read as three separate things. Ring, size and outer edge are unchanged. |
| heliport | NO CHANGE | The H in a ring reads at real size in both tints. Texture bytes identical. |
| naval base | NO CHANGE | The anchor reads at real size. Texture bytes identical. |
| port | NO CHANGE | Four alternatives were prototyped (a ship bow-on in the square, an open basin with three swells, heavier swells, a quay crane). None read better at 20 px; the ship and the crane dissolve into blobs (`exploration/prototype-round1-*.png`, `prototype-round2-*.png`). One observation stands without a fix: at close zoom the square sits among the surveyed pier outlines at Shahid Rajaee and looks like one of them (frame 02). |
| air defence | NO CHANGE | Launcher rail and arrow read at real size in both tints. Texture bytes identical. |
| radar | **CHANGED** (the smaller gain of the two) | Before, the dish was an arc opening downward on a mast, with two emission arcs nested 4.5 texture px apart: at 22 px it read as an umbrella. After, a solid bowl on a foot looks up and right, with its feed and one heavy wavefront. The first attempt put the feed off-centre; in the chart the true-position point of a site drawn on its own position (Khalij Fars, Sepehr) landed on the bowl and smeared it (`exploration/radar-attempt1-production-row-rejected.png`). The final form puts the feed on the centre, so that point lands on the feed. The gain is clearest on a fanned-out site (Al Udeid); on a true-position site the point still thickens the middle of the symbol, as it did before. |
| nuclear | NO CHANGE | The trefoil reads at real size in both tints. Texture bytes identical. |

Display size (20 and 22 px), texture size (64), colour space, filters, material, blending, tint mapping and the rings are untouched. The inked extent of both redrawn textures is the same as before (airbase columns and rows 8 to 55, radar 3 to 60). Summed texture alpha is 9.5 % lower for the airbase (1166 to 1055) and 3.3 % lower for the radar (1124 to 1087), so the haze around bright (military, coalition) instances drops slightly; that is the glow change measured in section 6.

## 3. Exact hunks

`allowed-hunks.diff` (also below). Both hunks sit inside the drawing bodies: `iconTexture`, airbase branch, and `glyphTexture`, radar branch.

```diff
diff --git a/src/lib/plot/facilityLayer.ts b/src/lib/plot/facilityLayer.ts
index e673abb..ed3c75d 100644
--- a/src/lib/plot/facilityLayer.ts
+++ b/src/lib/plot/facilityLayer.ts
@@ -84,12 +84,13 @@ function iconTexture(kind: IconKind): THREE.CanvasTexture {
   const c = S / 2;
   if (kind === "airbase") {
     g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
-    g.lineWidth = 3;
+    // the aircraft stands clear of the ring: slim fuselage, swept wing and tailplane read as separate parts at 20 px
+    g.lineWidth = 2;
     g.beginPath();
-    g.moveTo(c, c - 15); g.lineTo(c + 3, c - 6); g.lineTo(c + 15, c + 3); g.lineTo(c + 15, c + 7); g.lineTo(c + 3, c + 3);
-    g.lineTo(c + 2, c + 11); g.lineTo(c + 7, c + 14); g.lineTo(c + 7, c + 16); g.lineTo(c, c + 14);
-    g.lineTo(c - 7, c + 16); g.lineTo(c - 7, c + 14); g.lineTo(c - 2, c + 11); g.lineTo(c - 3, c + 3);
-    g.lineTo(c - 15, c + 7); g.lineTo(c - 15, c + 3); g.lineTo(c - 3, c - 6); g.closePath(); g.fill(); g.stroke();
+    g.moveTo(c, c - 14.5); g.lineTo(c + 2.8, c - 9.5); g.lineTo(c + 2.8, c - 4.8); g.lineTo(c + 13.5, c + 3.2); g.lineTo(c + 13.5, c + 6.6); g.lineTo(c + 2.8, c + 3.6);
+    g.lineTo(c + 2.8, c + 8.4); g.lineTo(c + 6.5, c + 11.3); g.lineTo(c + 6.5, c + 13.5); g.lineTo(c, c + 12.2);
+    g.lineTo(c - 6.5, c + 13.5); g.lineTo(c - 6.5, c + 11.3); g.lineTo(c - 2.8, c + 8.4); g.lineTo(c - 2.8, c + 3.6);
+    g.lineTo(c - 13.5, c + 6.6); g.lineTo(c - 13.5, c + 3.2); g.lineTo(c - 2.8, c - 4.8); g.lineTo(c - 2.8, c - 9.5); g.closePath(); g.fill(); g.stroke();
   } else if (kind === "heliport") {
     g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
     g.beginPath(); g.moveTo(c - 8, c - 11); g.lineTo(c - 8, c + 11); g.moveTo(c + 8, c - 11); g.lineTo(c + 8, c + 11); g.moveTo(c - 8, c); g.lineTo(c + 8, c); g.stroke();
diff --git a/src/lib/plot/osintLayer.ts b/src/lib/plot/osintLayer.ts
index b798b84..4a8b2a3 100644
--- a/src/lib/plot/osintLayer.ts
+++ b/src/lib/plot/osintLayer.ts
@@ -49,11 +49,16 @@ function glyphTexture(layer: OsintLayer): THREE.CanvasTexture {
     g.beginPath(); g.moveTo(c - 15, c + 15); g.lineTo(c + 15, c + 15); g.moveTo(c - 11, c + 9); g.lineTo(c + 10, c - 14); g.stroke();
     g.beginPath(); g.moveTo(c + 16, c - 18); g.lineTo(c + 3, c - 14); g.lineTo(c + 13, c - 5); g.closePath(); g.fill();
   } else if (layer === "radar") {
+    // a dish, not a canopy: solid bowl on a foot, looking up and right, and one wavefront. The feed sits on the symbol's
+    // centre, so the true-position point of a site drawn on its own position lands on the feed and not on the bowl.
+    g.lineWidth = 2;
+    g.beginPath(); g.moveTo(c - 19, c - 4); g.quadraticCurveTo(c - 19.5, c + 14.5, c - 1, c + 14); g.closePath(); g.fill(); g.stroke();
+    g.beginPath(); g.moveTo(c - 12, c + 11); g.lineTo(c - 15.5, c + 17.5); g.lineTo(c - 6.5, c + 17.5); g.closePath(); g.fill(); g.stroke();
+    g.lineWidth = 3;
+    g.beginPath(); g.moveTo(c - 10, c + 5); g.lineTo(c, c); g.stroke();
+    g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
     g.lineWidth = 5;
-    g.beginPath(); g.arc(c - 4, c + 4, 16, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
-    g.beginPath(); g.moveTo(c - 4, c + 4); g.lineTo(c - 4, c + 17); g.stroke();
-    g.lineWidth = 3.5;
-    for (const r of [12, 20]) { g.beginPath(); g.arc(c - 8, c + 8, r + 8, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); }
+    g.beginPath(); g.arc(c, c, 16.5, -Math.PI * 0.5, 0); g.stroke();
   } else {
     for (let i = 0; i < 3; i++) {
       const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
```

## 4. Source fence checks

`fence-check.txt`, produced by `tools/fence.py`: RESULT PASS, 12 of 12 checks, run after the battery and the restore below.

- Tracked changes are exactly `src/lib/plot/facilityLayer.ts` and `src/lib/plot/osintLayer.ts`. Untracked: the capture tool and this folder.
- In both files everything up to and including the function declaration, and everything from `new THREE.CanvasTexture(canvas)` to the end of the file, is byte-identical to the launch tip. Texture size, colour space, filters and all layer code are in those untouched parts.
- The new lines (6 and 9) are comments or statements on the 2D context `g`.
- String literals are identical before and after (35 and 26), so no product string changed.
- No change to `playwright.config.ts`, dependencies, data or `public/`. No host launch flag or GPU env name in source, tests or config.
- `git diff 443af2c 4057be1` has no product path, so the ART1 R2 base and the launch tip carry the same product code.

## 5. Frames and determinism

- Capture tool: `tests/sand-art2-frames.spec.ts`, skipped unless `SAND_ART2_SET` is set. It adds no production hook. It replaces the page's animation clock with a virtual one that advances 1/60 s per displayed frame only while the test steps it, and it reads the glyph textures from the canvases `iconTexture` and `glyphTexture` themselves created in the page (found by call stack).
- Sets: `before/`, `control/` (second run of the same untouched tree) and `after/`: 17 frames at 1920x1080 DPR 2, 4 at 1440x900, 4 at 1280x720, each with a JSON of camera, occupancy boxes, labels, picks and every visible string with its line rectangles. `manifest.json` lists the parameters and IDs.
- BEFORE vs CONTROL (`noise-floor.json`): 23 of 25 frames are pixel-identical. `00-briefing` and `01-cold-chart` differ in 9 and 8 pixels by 1/255. Every state field, rectangle and string is identical in all 25.
- Renderer in every frame: ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1), WebGL 2. No `--disable-gpu` retry was needed.

## 6. Text diff and forbidden pixels

**Text and rectangles (`text-diff.txt`): 0 differences in 25 frames.** Compared without masking: every visible DOM text node (whole string, document order) and each line rectangle to 0.01 px, every occupancy box (labels, data blocks, unit glyphs, facility and OSINT icon rectangles, scale), label strings and owners, icon centres, camera, drawn counts, panel text, and what a click on each icon opens. The source literal check (section 4) shows no product string changed.

**Pixels (`forbidden-pixels.json`, `heatmaps/`).** The criteria were written into the early skeleton of this report at 00:40 EST, after BEFORE, CONTROL and the calibration and before the first AFTER capture. That skeleton was replaced by this report, so the timing rests on my word and on the capture log order. The criteria:

1. State, rectangles, text and picks identical, no tolerance. Met.
2. The layers-off control and every frame with no airbase or radar symbol drawn must be pixel-identical. Met: frames 03, 11, 12 and 15 differ in 0 pixels.
3. Elsewhere, pixels inside the airbase and radar sprite squares (+1 px) are the art. Pixels outside must stay under the whole-symbol glow envelope by distance. Met: 0 pixels above the envelope in every frame.

Why an envelope and not a fringe: in the BEFORE set, switching one coalition-tint symbol off (frames 08 and 08b, same camera) changes pixels by up to 77/255 at the sprite edge, 11/255 at 30 px, 3/255 at 100 px, and still changes most pixels at 120 px (`fringe-calibration.json`, `heatmaps/calibration-08-vs-08b.png`). A redraw cannot change the glow more than removing the symbol does, so that profile is the bound. Sprite positions for the masks come from the plot's own reported centres and the data, never from the pixel diff; they cover symbols under panels and decluttered ones too.

What the glow change looks like: smooth contour bands in the heatmaps, strongest next to bright (military or coalition) symbols. Frames 08 and 08b are the clean case: their only drawn airbase is civil (dim, below the bloom threshold), and they differ in 154 and 349 pixels outside the sprite, all by 1/255.

Distances are CSS px from the nearest airbase or radar sprite square. "Protected regions" are the label, data block, unit glyph, scale, unchanged-kind icon and DOM text rectangles of the frame, judged outside the redrawn squares.

| frame | airbase/radar symbols on canvas (listed visible) | pixels changed | inside sprite squares | outside, 0-8 px | 8-30 px | 30-100 px | beyond 100 px | protected regions, worst | BEFORE vs CONTROL |
|---|---|---|---|---|---|---|---|---|---|
| 00-briefing-1920 | 56 (29) | 287958 | 32930 (max 204) | 40908 (max 6) | 89742 (max 3) | 109012 (max 1) | 15353 (max 1) | 2/255 | 9 px, max 1 |
| 01-cold-chart-1920 | 56 (29) | 288314 | 33064 (max 204) | 40950 (max 6) | 89859 (max 3) | 108726 (max 1) | 15680 (max 1) | 2/255 | 8 px, max 1 |
| 02-bandar-abbas-crowded-1920 | 5 (3) | 105358 | 5804 (max 218) | 9838 (max 5) | 26321 (max 3) | 43375 (max 1) | 19832 (max 1) | 2/255 | 0 px, max 0 |
| 03-bandar-abbas-close-1920 | 2 (0) | 0 | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0/255 | 0 px, max 0 |
| 04-ad-selected-rings-1920 | 54 (30) | 394033 | 33548 (max 214) | 44069 (max 5) | 119330 (max 3) | 174038 (max 1) | 23045 (max 1) | 4/255 | 0 px, max 0 |
| 05-bushehr-nuclear-wide-1920 | 17 (13) | 279466 | 17056 (max 100) | 22317 (max 6) | 73488 (max 4) | 131796 (max 2) | 34761 (max 1) | 4/255 | 0 px, max 0 |
| 06-bushehr-nuclear-close-1920 | 6 (4) | 220318 | 7007 (max 92) | 12444 (max 6) | 52423 (max 3) | 113663 (max 1) | 34284 (max 1) | 3/255 | 0 px, max 0 |
| 07-radar-khalij-fars-1920 | 5 (2) | 63372 | 3824 (max 218) | 5870 (max 4) | 14821 (max 1) | 25541 (max 1) | 13270 (max 1) | 2/255 | 0 px, max 0 |
| 08-barakah-nuclear-1920 | 4 (1) | 400 | 246 (max 103) | 40 (max 1) | 43 (max 1) | 53 (max 1) | 15 (max 1) | 1/255 | 0 px, max 0 |
| 08b-barakah-nuc-off-1920 | 4 (1) | 648 | 299 (max 111) | 76 (max 1) | 118 (max 1) | 114 (max 1) | 39 (max 1) | 1/255 | 0 px, max 0 |
| 09-udeid-radar-ad-1920 | 7 (3) | 67833 | 4168 (max 148) | 4658 (max 4) | 10292 (max 1) | 30768 (max 1) | 17832 (max 1) | 3/255 | 0 px, max 0 |
| 10-kish-two-runways-1920 | 3 (1) | 78973 | 1929 (max 99) | 3678 (max 5) | 17416 (max 3) | 37357 (max 1) | 18449 (max 1) | 3/255 | 0 px, max 0 |
| 11-fujairah-construction-1920 | 2 (0) | 0 | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0/255 | 0 px, max 0 |
| 12-havadarya-panel-1920 | 1 (0) | 0 | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0 (max 0) | 0/255 | 0 px, max 0 |
| 13-bandar-abbas-tilt-1920 | 7 (3) | 41641 | 5061 (max 216) | 6675 (max 5) | 12776 (max 2) | 13143 (max 1) | 3979 (max 1) | 1/255 | 0 px, max 0 |
| 14-bandar-abbas-osint-off-1920 | 4 (2) | 90474 | 3409 (max 101) | 5099 (max 6) | 17434 (max 3) | 40803 (max 1) | 23329 (max 1) | 2/255 | 0 px, max 0 |
| 15-control-no-glyphs-1920 | 0 (0) | 0 | 0 (max 0) | 0 | 0 | 0 | 0 | 0/255 | 0 px, max 0 |
| 01-cold-chart-1440 | 55 (20) | 148806 | 20907 (max 203) | 27406 (max 7) | 49694 (max 3) | 46907 (max 1) | 3862 (max 1) | 3/255 | 0 px, max 0 |
| 02-bandar-abbas-crowded-1440 | 5 (3) | 107015 | 5439 (max 225) | 8409 (max 8) | 27898 (max 3) | 48185 (max 1) | 16989 (max 1) | 5/255 | 0 px, max 0 |
| 05-bushehr-nuclear-wide-1440 | 13 (9) | 255601 | 15037 (max 98) | 20889 (max 6) | 68393 (max 3) | 118894 (max 2) | 32257 (max 1) | 3/255 | 0 px, max 0 |
| 06-bushehr-nuclear-close-1440 | 6 (4) | 138348 | 6252 (max 90) | 10047 (max 5) | 39135 (max 3) | 63300 (max 1) | 19341 (max 1) | 4/255 | 0 px, max 0 |
| 01-cold-chart-1280 | 70 (26) | 199587 | 26719 (max 188) | 32444 (max 4) | 66979 (max 2) | 63500 (max 1) | 9945 (max 1) | 2/255 | 0 px, max 0 |
| 02-bandar-abbas-crowded-1280 | 6 (3) | 89158 | 5323 (max 73) | 6453 (max 4) | 22169 (max 2) | 43436 (max 1) | 11737 (max 1) | 4/255 | 0 px, max 0 |
| 05-bushehr-nuclear-wide-1280 | 14 (9) | 187217 | 11975 (max 105) | 17903 (max 5) | 50452 (max 3) | 88608 (max 1) | 18279 (max 1) | 4/255 | 0 px, max 0 |
| 06-bushehr-nuclear-close-1280 | 5 (4) | 121821 | 5757 (max 95) | 10293 (max 6) | 34571 (max 4) | 50633 (max 2) | 20447 (max 1) | 3/255 | 0 px, max 0 |

Protected crops (`protected-geometry.png`, `protected-units-labels.png`, numbers in `protected-regions.json`), outside the redrawn squares:

- Fujairah runway and construction strip: identical (0 of 621,316 pixels).
- Havadarya co-located true-position dot, runway and outlines (frame 03): identical (0 of 118,064).
- Kish runways and end labels: 17,894 of 621,074 pixels differ, largest 5/255. A military airbase symbol sits at the corner of the crop; the difference is its glow.
- Dashed AD ring over Bandar Abbas: 1,149 of 332,800, largest 1/255.
- Bushehr solid nuclear ring, dashed Tor ring, co-located dot: 83,065 of 500,128, largest 6/255, around two military airbase symbols.
- Three unit glyphs with their data blocks on the cold chart: 87 to 164 of 57,121 each, largest 1/255.
- Labels beside a redrawn symbol (HAVADARYA AIRPORT, KHALIJ FARS, 30 px margin): largest 5/255 and 3/255.

## 7. Tests

Full battery on this host, one worker, external host config, capture env cleared: **exit 0** (`logs/battery.log`).

- vitest: 26 files, 331 tests passed.
- Playwright: 143 tests, **127 passed, 16 skipped, 0 failed**, 59.8 min. The 16 skipped are the env-gated capture tools: `sand-art1-frames` 9, `sand-art2-frames` 4, `sand-osint-1-frames` 2, `sand-art1-glyphs` 1.
- The overlap, picking, ring and facility specs ran inside it and passed: `sand-map-1-facilities`, `sand-map-2-plot-facilities`, `sand-osint-1-overlap-plot`, `sand-osint-1-overlap-map`, `sand-osint-1-rings`.
- No baseline failure to explain. One browser console message was forwarded during a passing test (59/143, the MapLibre `/` map with satellite tiles): `InvalidStateError: The source image could not be decoded`. That view is drawn by the other renderer, which this lane did not touch. It was not checked against the base, so it is not labelled pre-existing here.
- Capture runs: `before`, `control`, `after` and the rejected first `after` each passed 3 of 3 (`logs/capture-*.log`).
- `tsc --noEmit`: 3 errors, all in `tests/sand-001-unit-placement.spec.ts`, which this lane did not touch. None in the capture tool or the two drawers.
- The battery rewrote 121 tracked files under `docs/verification/` (other lanes' evidence) and `next-env.d.ts`. The pre-run status had none of the verification files modified (`logs/pre-battery-status.txt`, `logs/post-battery-status.txt`), and `next-env.d.ts` is rewritten by the dev server, so they were restored with `git checkout`. Nothing else was reverted.

## 8. Renderer and performance

Heavy pose: Bandar Abbas at 150 km, 1920x1080 DPR 2, real clock, 10 s window timed by the test process, three alternating BEFORE/AFTER pairs (`perf/`, `logs/perf.log`). Renderer as above.

| run | window ms (monotonic) | frames | fps | frame interval ms | draw calls per frame | textures created / uploads / canvases during window | GL textures live | page wall clock ms |
|---|---|---|---|---|---|---|---|---|
| before 1 | 10018 | 601 | 60 | 16.67 | 42 | 0 / 0 / 0 | 32 | 8902 |
| after 1 | 10013 | 601 | 60.02 | 16.66 | 42 | 0 / 0 / 0 | 32 | 10013 |
| before 2 | 10017 | 602 | 60.1 | 16.64 | 42 | 0 / 0 / 0 | 32 | 10016 |
| after 2 | 10018 | 601 | 59.99 | 16.67 | 42 | 0 / 0 / 0 | 32 | 10018 |
| before 3 | 10021 | 601 | 59.98 | 16.67 | 42 | 0 / 0 / 0 | 32 | 10020 |
| after 3 | 10014 | 601 | 60.02 | 16.66 | 42 | 0 / 0 / 0 | 32 | 8866 |

Both trees hold the display rate: 601 or 602 frames in every 10 s window, 16.64 to 16.67 ms per frame. Draw calls per frame (42) and live GL textures (32) are the same before and after; the only difference between the trees is the content of two 64x64 textures. No regression.

The last column is why there are two runs on file. The page's wall clock (`Date.now`) stepped back about 1.1 s in two of these six windows, one BEFORE and one AFTER, while the monotonic clock and the frame count did not move. The first run of the three pairs was timed on that wall clock alone and shows the same artefact (`perf-wallclock-run1/`: 601 or 602 frames and 42 draw calls in every window, reported durations 9.07 to 10.03 s). The tool was then changed to time on `performance.now` and the pairs were run again; the table above is that second run.

No texture is built per frame: 0 canvases, 0 GL textures and 0 texture uploads during any window. The redraw adds no animation, so nothing strobes or flashes.

## 9. For the looker (capped index)

Opening question: "Does a player now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO".

1. `glyph-sheet.png`: seven rows, BEFORE/AFTER, texture and production chart at real pixels and 4x.
2. Six whole-scene pairs in `pairs/`: `01-cold-chart-1920.jpg`, `02-bandar-abbas-crowded-1920.jpg`, `07-radar-khalij-fars-1920.jpg`, `09-udeid-radar-ad-1920.jpg`, `06-bushehr-nuclear-close-1920.jpg`, `02-bandar-abbas-crowded-1280.jpg`.
3. Two protected-region sheets: `protected-geometry.png`, `protected-units-labels.png`.
4. Raw evidence: `before/`, `after/`, `control/` (PNG and JSON per frame), `heatmaps/`, `forbidden-pixels.json`, `text-diff.txt`, `fringe-calibration.json`, `noise-floor.json`, `manifest.json`, `logs/`.

## 10. Handoff

- Working tree: two product hunks, `tests/sand-art2-frames.spec.ts`, and this folder (about 130 MB, most of it the three PNG frame sets; `control/` is 36 MB and can be dropped at harvest if `noise-floor.json` is enough).
- No commit, no push, no `docs/ready/` change, no host flag in the repo (the Playwright config that carries them is outside it: `/home/ray/lanes-d/sand-art2-host-1794374249-673838/playwright.host.config.ts`).
- Steer entry acted on: `2026-11-11T05:15:49Z` (scratch under `/home/ray/lanes-d` only; base and fence as the card).
- To reproduce on another base: capture `before` and `control` on the untouched tree, apply the hunks, capture `after`, then `tools/gate.py noise`, `calib`, `after`, `tools/sheets.py glyphs|pairs|protected`, `tools/fence.py`.
