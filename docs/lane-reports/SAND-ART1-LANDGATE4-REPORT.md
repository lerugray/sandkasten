# SAND-ART1-LANDGATE4 — Plot/Play blank theater (frames never advance)

Lane `co3-sandlandgate4-t591` on tip `6df67e8` (LANDGATE3 `f872514` + LANDGATE4 re-plan). NO_EXEC: code only; no Playwright / Chromium on this host. Dirty tree left for harvester.

## Cause (t590 home-PC RTX 3050 / ANGLE D3D12 landbat)

Targeted e2e on LANDGATE3 tip `f872514`: map@1440+1920 **PASS**; play-shots and plot overlap **FAIL** — `__sandPlot` appears but `frames()` stays at 0 through openPlay 60s / openPlot 30s at 1440 and 1920 (DPR2).

LANDGATE3 only switched the composer to UnsignedByte / no-MSAA / bloom-off when `detectSoftGl()` matched SwiftShader/llvmpipe/etc. Real GPU reports `ANGLE (… D3D12 (NVIDIA GeForce RTX 3050) …)`, so softGl stayed false and the composer kept **HalfFloatType + MSAA samples:4 + bloom**. On that path the first `composer.render` stalls hard (MSAA blit / first-compile on Mesa–ANGLE D3D12).

LANDGATE3 then added `warmFrames(36)` **inside the constructor**, still on that HalfFloat MSAA target, **before** `PlotView` assigned `window.__sandPlot`. So:

1. Sync warm paints either blocked construct on the stall, or never left a live RAF loop tied to the handle Playwright reads.
2. The player-visible loop (`requestAnimationFrame` / `setAnimationLoop`) was scheduled before the handle was published and could be cancelled on React remount while a disposed instance still sat on `window.__sandPlot` with `frames === 0` if construct never finished a successful warm on the instance under the handle.
3. Soft-GL-only lite path + pre-handle warmFrames therefore fixed Xvfb software GL in theory and **missed real GPU paint entirely**.

`frames()` is only the witness that the theater is alive; the product failure is a frozen/blank Plot/Play view.

## Fix

| File | Change |
|---|---|
| `src/lib/plot/TacticalPlot.ts` | Composer always UnsignedByte + samples 0 (keep bloom on real GPU for KEEP art; bloom off on soft GL). Remove in-constructor RAF/warmFrames. Add `start()`: after handle publish, pump cheap paints then `renderer.setAnimationLoop`. Full try/catch around `paintOnce`. |
| `src/components/plot/PlotView.tsx` | Assign `__sandPlot`, then `plot.start()`. Clear `__sandPlot` on dispose when it still points at this handle (no disposed zombie). |

No fonts. No /map layout. No combat/WeGo/sensors/scenario/save. No baseline PNG update. No commit / push / `docs/ready/`.

## Battery (harvester)

```bash
npx vitest run && npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts
```

Expect: vitest green; map@1440 and map@1920 still green (untouched); play-shots both DPR2 sizes green with `frames()>30` inside existing openPlay budget; plot overlap smoke green with `frames()>30` inside openPlot budget.

## Stayed soft on purpose

`sand-combat-1-record` plan A WeGo / plan B continuous — host-class soft per prior cards. Do not treat a lone WeGo timeout as a LANDGATE4 regression if the three named specs are green.
