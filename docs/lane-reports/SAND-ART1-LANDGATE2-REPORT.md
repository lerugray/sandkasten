# SAND-ART1-LANDGATE2 — osint map@1920 + play-shots

Lane `co3-sandlandgate2-t586` on `co3/sand-art1-landgate2-t586` from tip `cadd833` (card) over LANDGATE `c3a4f3b`. NO_EXEC: code only; no Playwright / Chromium / npm ci on this host. Dirty tree left for harvester.

## Cause (t576 landbat, SWIFT=1)

Custody `/home/ray/lanes/_ship/durable/co3-sandart1land-t576pod/`: UNIT green; facilities / osint-plot / plans / RC-FIX green; E2E_RC=124. Hard reds:

1. **`/map` overlaps at 1920×1080** (×3, ~1.2–1.4 m) while 1440 and plot@1920 stayed green. Loading@1920 (stub tiles, no terrain/sat) also green. Settled pure-layout probe of the walk poses is clear; the gap is style thrash. Terrain / satellite toggles rebuild the style under soft GL; LayoutController kept the old plates until the next solve, so labels could sit on facility discs that had just remounted. At 1920 more discs share the screen, so a least-bad label residue also survives more often than at 1440.

2. **play-shots at 1440 and 1920 DPR 2** (×3 each) hit the raised test timeouts (300 s / 420 s). GPU hosts clear the same spec in ~20 s. `focusArea` (SHOW GATE) still glided; under capped frame dt that left mid-pose work running. Soft GL at CSS DPR 2 paints a 4K buffer every frame and starves the shot path. LANDGATE only raised timeouts.

Out of scope (left soft): `sand-combat-1-record` plan A WeGo + plan B continuous.

## Fix

| File | Change |
|---|---|
| `src/lib/map/mapLayout.ts` | `EMPTY_MAP_LAYOUT`; wider icon/unit escape radii; drop labels that still overlap after the ring search |
| `src/lib/osint/labelLayout.ts` | Ring search out to 220 px before least-bad |
| `src/components/map/LayoutController.tsx` | On `style.load`, publish empty layout then re-solve; re-solve on `document.fonts` ready |
| `src/components/map/OsintLayer.tsx` | Hide labels when layout is empty; remove markers for omitted labels |
| `src/lib/plot/TacticalPlot.ts` | `focusArea` snaps like `focusFacility`; soft-GL renderer caps drawing-buffer DPR to 1 |
| `src/app/play/terminal.css` | Briefing `max-height` + `overflow-y: auto` so ART1 content fits a 900 px window |
| `unit/map-layout-facilities.test.ts` | Residue-drop case |
| `unit/osint-labels.test.ts` | Leader reach matches longer ring |

No fonts (SAND-FONT1). No combat / sensors / scenario / WeGo-record. No baseline PNG update (shots are fits/fonts/canvas asserts, not image-diff). No commit / push / `docs/ready/`.

## Battery (harvester)

```bash
npx vitest run && npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts
```

Expect: vitest green (incl. new layout case); map@1440 and map@1920 zero overlaps; play-shots both DPR2 sizes green without another timeout bump; plot overlap smoke still green.

## Stayed soft on purpose

`sand-combat-1-record` plan A WeGo / plan B continuous — host-class soft per card. Do not treat a lone WeGo timeout as a LANDGATE2 regression if the three named specs are green.
