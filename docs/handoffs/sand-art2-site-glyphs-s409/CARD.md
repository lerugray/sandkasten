This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it

# SAND-ART2: finish the seven fixed-site plot glyphs

Placed at `docs/handoffs/sand-art2-site-glyphs-s409/CARD.md` on `co3/sand-art2-brief` from ART1 R2 @443af2c (co-seat 3 t501).

## 0 EXECUTION OVERRIDE

BUILD/FINISH art pass. Drawer: Fable 5.2 on BACKUP (HAI 5h spent until ~04:30 EST; HANDOFF s431 00:05), home-PC WSL. Cap: 10800 s total. FIX lane: DO NOT COMMIT OR PUSH. Leave edits for harvest. No implementation, launch or merge is authorized by the preparation of this card. GS runs scripts/spec-gate.sh before dispatch. This card's first line intentionally precedes the SPEC anchor, per the newer HAI launcher requirement.

At launch, GS supplies a brief branch cut from `sand/art-fable-r2` at `443af2c1441c285f2bb64db112ac0964bfbc68ed` plus this card. Do not start from main's pre-ART1 look. Base is harvested ART1 R2 @443af2c (Opus re-look PASS-WITH-NOTES; Ray KEEP packet staged). Fence: do not reopen R2 wrap work; draw only the seven fixed-site glyphs. Minors from the look (C-/802 split, unindented record second lines) may be folded here if they sit in the admitted drawing bodies. A changed launch base requires rechecking this fence and fresh BEFORE captures; never silently compare different bases.

Host limits: maximum four heavy processes on the host and only one battery at a time; coordinate with GS and the live slot gate before starting. Playwright workers stay at 1. Do not fill host capacity simply because this lane has time remaining.

Work from the launcher's repository checkout, not an assumed home directory. All home-PC scratch, logs, archives and external configs go under `/home/ray/lanes-d`; NEVER `/tmp`. Before EACH browser or battery batch run:

```bash
python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check
```

A nonzero gate means stop that batch and report to GS, not bypass. Use an installed Chromium only. Execute the following setup from the lane checkout; config stays outside the repo, and none of these host flags may enter committed source or Playwright config:

```bash
set -o pipefail
export REPO="$PWD"
export SAND_ART2_BASE=443af2c1441c285f2bb64db112ac0964bfbc68ed
export ART2_HOST="/home/ray/lanes-d/sand-art2-host-$(date +%s)-$$"
mkdir -p "$ART2_HOST"
export TMPDIR="$ART2_HOST/tmp"
mkdir -p "$TMPDIR"
export GALLIUM_DRIVER=d3d12
export MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
export SAND_E2E_GPU=1
export SAND_E2E_PORT=3017
unset SAND_E2E_SWIFTSHADER
export ART2_CONFIG="$ART2_HOST/playwright.host.config.ts"
cat > "$ART2_CONFIG" <<CONFIG
import base from '$REPO/playwright.config.ts';
export default {
  ...base,
  testDir: '$REPO/tests',
  outputDir: '$ART2_HOST/test-results',
  reporter: [['line']],
  workers: 1,
  projects: base.projects!.map((p) => ({
    ...p,
    use: { ...p.use, launchOptions: {
      ...p.use?.launchOptions,
      args: ['--mute-audio', '--no-sandbox', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'],
    } },
  })),
  webServer: { ...base.webServer, cwd: '$REPO', reuseExistingServer: false },
};
CONFIG
```

If 3017 is occupied, select and record an unused port before config generation, same port for both sequential captures. Do not stop another lane's server. If explicitly launching Chromium from a capture script, use exactly the five arguments above and the same two GPU environment variables; the config cannot control an independent launch. Record WebGL vendor/renderer and visibly inspect the rendered plot before drawing. Blank, software-rendered or failed WebGL frames: BLOCKED, not a blind art pass.

Implement the lane's capture tool as `tests/sand-art2-frames.spec.ts`, skipped unless `SAND_ART2_SET` is set. It accepts `SAND_ART2_OUT`, captures all §4 poses and freezes the scene identically before/after; it does not change production state rules. First run BEFORE from the untouched product tree with only the capture tool added. Then change the allowed drawing routines and run AFTER:

```bash
mkdir -p "$REPO/docs/art-fable-r2-fixed-sites"
python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check && \
  SAND_ART2_SET=before SAND_ART2_OUT="$REPO/docs/art-fable-r2-fixed-sites/before" \
  npx playwright test tests/sand-art2-frames.spec.ts --config "$ART2_CONFIG" \
  2>&1 | tee "$ART2_HOST/capture-before.log"
# Draw only after inspecting BEFORE. Then:
python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check && \
  SAND_ART2_SET=after SAND_ART2_OUT="$REPO/docs/art-fable-r2-fixed-sites/after" \
  npx playwright test tests/sand-art2-frames.spec.ts --config "$ART2_CONFIG" \
  2>&1 | tee "$ART2_HOST/capture-after.log"
# Full repository battery: package.json's npm test is vitest run && playwright test.
# Equivalent split preserves the host-only Playwright config:
set -o pipefail
python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check && \
  (npx vitest run && npx playwright test --config "$ART2_CONFIG") \
  2>&1 | tee "$ART2_HOST/battery.log"
```

Use `set -o pipefail` before capture commands too. Clear capture env before battery (inline assignments above do not persist). Preserve exit codes. The cap includes tools, captures and battery: reserve time and report unfinished proof honestly rather than extending the cap. Ordinary tests can overwrite earlier verification evidence: retain the pre-run status/diff and restore only test-generated changes outside this lane, never somebody else's edits. No dependency additions. Do not change system settings, drivers or install software to rescue the host.

## 1 Anchor, request and verified base

ANCHOR: SPEC.md line 1: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO."

RAY-ASK: s430 19:23 tokenmaxx art: "the fable passes on art (I think TKC was waiting too?) have all been incredible" and "i figure we need to utilize all this extra subsidized compute as strategically as possible". s431 23:37 HAI burn records Ray s430: "heads up for the session note, I just reset the HAI plan as well using the main full reset - same plan for that seat, we should utilize it for fable fully, then we can burn the fable reset on it." Ray s431: "Go, run it". GS #ask-dot-night-s409-8 specifically requests unpassed code-drawn families, not invented work to fill capacity.

MOVES: Sandkasten first public EA. SPEC numbered steps served: 1 (opens a scenario) and 2 (gives orders), through legible fixed-site geography supporting the chart; no new gameplay implementation is claimed. Finish the fixed-site symbols a first player sees in the default Three.js /play chart, so port/naval-base/airfield/heliport and air-defence/radar/nuclear site read as distinct supporting geography without competing with tactical units. No new release feature or launch gate is invented.

grounded: launch base = harvested ART1 R2 `sand/art-fable-r2` @ `443af2c1441c285f2bb64db112ac0964bfbc68ed` (Opus re-look PASS-WITH-NOTES 2026-11-11 00:03; Ray KEEP packet staged). Facility/OSINT glyph drawers unchanged by R1/R2. R1 report: facility/OSINT/runway symbols not redrawn. Read SPEC.md, CLAUDE.md, ART1 card/report/LOOK/REVIEW, and `INVENTORY.md` beside this card.



## 2 Draw this, and only this

Seven existing code-drawn glyphs, two routines:

- `src/lib/plot/facilityLayer.ts`, `iconTexture`, base lines 74–112: airbase, heliport, naval_base, port.
- `src/lib/plot/osintLayer.ts`, `glyphTexture`, base lines 35–69: ad, radar, nuclear.

These are distinct from ART1's installation *unit* glyph. Military-area polygons have no eighth glyph. Draw original, more legible forms in the existing monochrome texture register. Preserve recognition (aircraft, H, anchor, port; launcher, dish, radiation trefoil). Inspect real production-composited pixels at actual size, not just the 64px source canvas. Facility display size stays 20; OSINT stays 22. Preserve texture size, color space, filters, material, opacity, side/military color mapping and outer extents. No invented information, new badge, status or tactical meaning. A clearer port form is worth exploring; a claim that the current one is defective requires actual frame evidence. NO CHANGE is a fully valid result, individually or for all seven: retain the original when a redraw does not improve the real-size production view.

Only drawing statements within these two functions may change in product code. Tests and this lane's evidence may be added. No exported helper or production debug API is necessary: a test-only harness can intercept CanvasTexture creation to collect actual function output, then verify in normal chart frames. Do not hand-copy a second glyph implementation and call its sheet production proof.

## 3 Hard fence: passed art and geography semantics

Do NOT edit TacticalPlot.ts, symbolTextures.ts, palette.ts, TerminalPlay.tsx, terminal.css, PlotView.tsx, LineBatch, map renderers, database components, fonts, dependencies, data or simulation. No unit/contact glyphs, certainty, selection brackets, weapon trails, hit/kill/launch effects, world, coast, bathymetry, grid, glow, monitor finish, panel typography or wraps. ART1/R2 own all of these. No fix of the reported ART1 sprite/layout-box S3. No SAND-THREAT-1 files.

Runways are explicitly OUT: shader, geometry, dimensions, construction/closed tones, threshold 1.4, minimum half-width, withdrawal at 34px, orientation, endpoint labels and picking remain byte-identical. Facility polygon boundaries, tier thresholds, declutter (including selected exemption), slot offsets, hit radius, render order and label placement are frozen. OSINT true-position dots, geodesic ranges, solid vs estimated dashes, selected ring, true vs offset location, affiliation semantics and co-location slots are frozen. Do not replace real site knowledge with new inferred geometry. All words and all visible text layout remain identical; no text exception belongs to this lane. Preserve attribution and source links.

## 4 Evidence before drawing, then same evidence after

Capture at 1920x1080 DPR 2, plus fit/legibility checks at 1440x900 and 1280x720. Same browser, host, renderer, camera, time, selected IDs and data. Capture a second untouched control BEFORE to establish determinism; fix the harness, not product code, if it drifts.

Named production poses: cold chart after briefing; all seven kinds visible at meaningful scale (derive actual IDs from checked-in data, record them); crowded Bandar Abbas/Havadarya with co-located facilities/OSINT; selected AD with estimated and measured rings; a radar and nuclear site; Kish two-runway close view; Fujairah construction strip; selected Havadarya panel; flat and tilt; OSINT/facilities-off negative control. Verify the known accessors and test idioms in `tests/sand-map-2-plot-facilities.spec.ts`, `tests/sand-osint-1-frames.spec.ts`, helpers/plotViews.ts and sandPlay.ts. Do not overwrite their evidence folders. If a kind is absent in a natural pose, use a separately labelled test fixture for the glyph sheet; do not invent a real-world site in product data.

Deliver a seven-row BEFORE/AFTER sheet at real displayed pixels and 4x nearest-neighbor, with military/civil facility and all existing OSINT side tints represented. Capture the true production texture, then the production chart composition, not an artist's separate mockup. Include identical retained glyphs marked NO CHANGE. Side-by-side whole-pose frames must show actual field usability.

Forbidden-pixel check is a gate, not a claim:
- Save each pose's icon screen rectangles BEFORE and AFTER; require identical rectangles and occupancy/label positions.
- Predetermine masks only around the seven allowed glyph interiors plus a measured bounded glow fringe. Use same masks on both frames; never derive masks by erasing arbitrary differing pixels. Keep masks off labels, runway strips, true-position dots, rings, unit glyphs and chrome. Capture an isolated no-overlap pose if the fringe touches protected pixels.
- Compare all pixels outside the masks against untouched control captures. Demand zero unexplained change, report raw changed-pixel counts and largest errors. If GPU noise prevents exact equality, establish and disclose a fixed threshold from BEFORE-vs-BEFORE before judging AFTER, and show heatmaps; do not tune until green. The layers-off control must be wholly unchanged.
- Independently crop protected runway ends/construction strips, co-located true-position dots, ring dashes and unit glyphs and compare. Same centers, membership, picked IDs, tiers, label strings and panel content must hold.
- Automated DOM visible-string AND text-rectangle diff per pose: empty, no omissions of data-block lines, no digit masking. Freeze time/data so exact comparison is meaningful. The ART1 report's first-line-only shortcut is not sufficient. Source-level literal diff must also show no changed product strings.

If these checks fail, revert the responsible glyph attempt or report BLOCKED. Do not fix the surrounding renderer. Run existing overlap/picking/ring/facility tests and the complete battery above. A baseline failure must be reproduced on the exact R1 base with the same config, otherwise do not label it pre-existing.

Measure the same heavy pose for 10 seconds before/after, preferably three alternating pairs; report interval and renderer, and any draw-call/texture-count change. No per-frame texture construction. No strobe or flashing. No performance regression accepted without GS disposition.

## 5 Handoff and verdict

Under `docs/art-fable-r2-fixed-sites/`, write REPORT.md early; before/, after/, pairs/, glyph-sheet.png, text-diff.txt, forbidden-pixels.json and heatmaps, test/battery logs, performance results and a manifest of capture parameters. Do not mix this with `docs/art-fable-r2/`, which is ART1's wrap round.

Report line 1:
`SAND-ART2 base=<full sha> decision=<CHANGED|NO CHANGE|BLOCKED> glyphs_changed=<n>/7 battery=<GREEN|RED|NOT RUN> text_diff=<empty|N|unverified> forbidden_pixels=<PASS|FAIL|unverified>`

Next: skipped/faked/unverified first; per-glyph evidence and why kept/reverted; exact allowed hunks; source fence checks; all test outcomes; renderer and performance; no-commit/no-push confirmation. If nothing improves, return NO CHANGE with before/after evidence, not seven cosmetic edits to spend capacity.

GS owns subsequent independent code review and fresh non-author LOOK by Opus 5.5 on MAIN, per s430 23:23 (not Fable). Give that looker a capped index: the glyph sheet, at most six decisive full-scene pairs and two protected-region sheets, plus raw evidence links. Reviewer opens: "Does a player now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO". Integration and Ray KEEP/REVERT remain GS/main's, after ART1 R2 disposition. No merge or launch here.

Integration prerequisite: this disjoint R1-based lane produces provisional art, not final post-ART1 acceptance. Once R2 is accepted or otherwise disposed, GS must recapture glyph proof, decisive frames, forbidden regions and text proof on the actual integrated descendant, using a paired BEFORE baseline carrying exactly the same R2/integration changes but not ART2, run the full combined battery and obtain the fresh Opus LOOK there before staging KEEP/REVERT. Never render a mutable or unharvested R2 tree; record its final full SHA only after custody is verified.
