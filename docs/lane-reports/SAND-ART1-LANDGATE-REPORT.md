# SAND-ART1-LANDGATE — facility / OSINT / shots

Lane `co3-sandlandgate-t571` on `co3/sand-art1-landgate-fix-t571` from tip `a09c943` (FIX6 `72eef47` + card). Host: WSL2 s254, Chromium via untracked `/tmp/sand-chromium-t571.sh` with `--mute-audio --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist` and `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`. Those flags are **not** in committed Playwright config. GPU ANGLE/EGL launch succeeded (no `--disable-gpu` retry).

## Verdict

**FIX SUBMITTED.** The four landbat hard reds are green on this host. Unit 352/352. Targeted four specs 21/21. Full e2e 130 passed / 12 skipped / 0 failed (32.2m, workers=2). Dirty tree left for harvester; no commit, no push, no `docs/ready/`.

## Cause (t555 / t559)

RunPod cpu5c landbats used `SWIFT=1`. Under a capped frame `dt` the plot's focus glide could leave clicks and occupancy checks on the wrong pose; close-zoom facility views sometimes showed only the scale bar. Plot `dispose()` also called `forceContextLoss()`, which made Chrome blacklist WebGL for the origin after a few `/play` remounts (overlap walk `/play` → snapshot). Globe/terrain toggles needed an explicit repaint so `transitionState` and terrain applied under slow paints.

Out of scope and left alone: `sand-combat-1-record` plan A WeGo host flake (passed on this GPU full run anyway).

## Files changed

| File | Change |
|---|---|
| `src/lib/plot/TacticalPlot.ts` | `focusFacility` / `focusOsint` snap via `snapView`; close-zoom label fallback when every ordinary plate is rejected; stop `forceContextLoss` on dispose |
| `src/lib/plot/facilityLayer.ts` | Slightly larger facility pick hit disc (1.15×) |
| `src/components/map/TacticalMap.tsx` | `map.triggerRepaint()` after globe/terrain/sat apply |
| `tests/helpers/plotViews.ts` | After snap, wait for paints + occupancy at the new pose (not stale labels) |
| `tests/sand-map-1-facilities.spec.ts` | Globe test timeout 90s (host-timing) |
| `tests/sand-map-2-plot-facilities.spec.ts` | Wait for a post-snap frame before Oghab/Havadarya click |
| `tests/sand-play-1-shots.spec.ts` | Longer timeout at 1920 DPR 2 (host-timing under software GL) |
| `docs/lane-reports/SAND-ART1-LANDGATE-REPORT.md` | This report |

## Battery

| Command | Result |
|---|---|
| `npx vitest run` | **352/352 PASS** |
| Targeted four specs (`--workers=1`, GPU wrapper) | **21/21 PASS** (~2.6m). Log: `/tmp/sand-landgate-targeted5.log` |
| Full `npx playwright test --workers=2` (GPU wrapper) | **130 passed, 12 skipped, 0 failed** (32.2m). Log: `/tmp/sand-landgate-full-e2e.log`. Card hard reds all green; combat plan A WeGo also green here. |

GPU recipe used for every Playwright run on this host. Verification PNG churn from the battery was restored so the dirty tree is only the files above.

## Stayed red on purpose

None on this host. The card still allows `sand-combat-1-record` plan A WeGo to stay red on a later landbat as host-class flake; do not treat a lone WeGo timeout as a LANDGATE regression if the four named specs are green.
