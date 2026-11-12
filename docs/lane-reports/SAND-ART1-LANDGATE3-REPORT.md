# SAND-ART1-LANDGATE3 — map@1920 residue + play-shots frames

Lane `co3-sandlandgate3-t589` on tip `a5fd9c3` (LANDGATE2 `b20748e` + card). NO_EXEC: code only; no Playwright / Chromium on this host. Dirty tree left for harvester.

## Cause (t588 home-PC GPU landbat + classify)

1. **`/map` @1920** — pure layout at settled poses is already clear after LANDGATE2. The walk still died when a satellite/DEM tile failed to decode (`InvalidStateError: The source image could not be decoded`): `settleMap` waited on `loaded()` until the 240s test budget. Stub hosts that answered raster/DEM with empty 204 bodies reproduced the same hang. At dense zooms a least-bad label/icon residue could also survive when more facility discs share a 1920-wide view.

2. **play-shots @1440/1920 DPR2** — `openPlay` waits for `__sandPlot.frames()>30` within 60s. Soft GL (and heavy HalfFloat MSAA4 bloom at CSS DPR 2) made each paint so expensive the counter never cleared the gate before any shot assert. Frames only looked “alive” after later camera work (focusArea); load itself did not warm the loop.

## Fix

| File | Change |
|---|---|
| `src/lib/plot/TacticalPlot.ts` | Detect soft GL up front; UnsignedByte + no MSAA + bloom off on soft GL; `warmFrames(36)` right after construct so frames advance before focusArea; paint try/catch so a GL throw cannot stall the counter |
| `src/lib/map/mapLayout.ts` | Dense zoom / wide viewport: wider icon escape, hide icons that cannot clear, skip least-bad labels (`omitIfBlocked`), stricter residue gap |
| `src/lib/osint/labelLayout.ts` | `omitIfBlocked` — no least-bad fallback when the ring is solid |
| `src/components/map/OsintLayer.tsx` | Honour `icons.hidden` (display none) |
| `src/components/map/TacticalMap.tsx` | On image-decode map errors, drop terrain and `triggerRepaint` so settle can finish |
| `tests/helpers/mapViews.ts` | Stub raster/DEM with tiny valid PNG/JPEG; `settleMap` falls back to `isStyleLoaded` after a `loaded()` hang |
| `unit/map-layout-facilities.test.ts` | 1920 Bandar dense clear-label case |
| `unit/osint-labels.test.ts` | `omitIfBlocked` empty-plate case |

No fonts (SAND-FONT1). No combat / WeGo / sensors / scenario / save. No baseline PNG update. No commit / push / `docs/ready/`.

## Battery (harvester)

```bash
npx vitest run && npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts
```

Expect: vitest green (incl. new layout cases); map@1440 and map@1920 zero overlaps without settle hang; play-shots both DPR2 sizes green with frames()>30 inside the existing openPlay budget; plot overlap smoke still green.

## Stayed soft on purpose

`sand-combat-1-record` plan A WeGo / plan B continuous — host-class soft per prior cards. Do not treat a lone WeGo timeout as a LANDGATE3 regression if the three named specs are green.
