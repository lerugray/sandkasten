# Sandkasten remaining code-drawn art inventory

Result for #ask-dot-night-s409-8: **one substantive FINISH candidate, SAND-ART2, seven fixed-site plot glyphs.** Not a whole-game second pass. No implementation, launch, product commit or merge performed.

Intended target card: `lerugray/sandkasten`, `docs/handoffs/sand-art2-site-glyphs-s409/CARD.md`, with this inventory beside it. No target branch or commit exists for this deliverable. Sandkasten is public; private-repository standing publication permission does not authorize publishing this packet there. Private staging is a custody copy, not a launch-ready Sandkasten branch.

## Verified snapshots and pass status

- Main source inspected: `fc3375056bdd202489043bcd8db9232a0e1b98b3`.
- ART1 harvested source: `sand/art-fable-r1` at `dae77a51987907ea5ea33f138850f72d97ea6137`.
- ART1 report expressly excludes redraw of facility symbols, OSINT site symbols and runway strips. It describes all four completed subject groups and identifies untouched legacy/home/editor surfaces.
- ART1 independent LOOK on `co3/sand-art1-look` rejects two wraps, while stating: “Nothing in the drawing needs to be redone.” The source does not authorize calling R1 accepted or landed.
- ART1 R2 brief on `co3/sand-art1-r2-brief` covers those two wrap blockers, optional closely related wrap fixes and limited ART1 S3 findings. GS reports its lane co3-sandart1r2-t495 running. Its future result/SHA is unknown here.
- `git diff fc3375056bdd202489043bcd8db9232a0e1b98b3 dae77a51987907ea5ea33f138850f72d97ea6137 -- src/lib/plot/facilityLayer.ts src/lib/plot/osintLayer.ts` is empty. These drawers have not changed in ART1.

## Family decisions

| Family | Exact source and coverage | Decision |
| --- | --- | --- |
| Tactical unit/installation and contact glyphs; certainty, damage, selected/hovered states | `src/lib/plot/symbolTextures.ts`, `TacticalPlot.ts`; ART1 report subject 1 and glyph sheet | FENCED. Already passed through Fable, though whole ART1 awaits wrap disposition. An installation *unit* is not a fixed real-world facility marker. |
| Weapons, trails, launches, hits, kills, fading and turn progress | `TacticalPlot.ts`, `TerminalPlay.tsx`; ART1 subjects 1 and 4 | FENCED. Motion observation limitations are existing review matters, not a new unpassed family. |
| Chart land/water/coast/bathymetry/grid/mission areas/waypoints/range rings/tilt/glow | `TacticalPlot.ts`, `palette.ts`; ART1 subject 2 | FENCED. Do not re-card unchanged subdetails just because the pass chose to retain them. |
| Terminal monitor/chrome/type/panels/teletype/briefing/debrief | `terminal.css`, terminal components; ART1 subject 3 | FENCED. R2 owns two wrap blockers and limited follow-up. |
| Four fixed-facility plot glyphs | `facilityLayer.ts:74–112`, `iconTexture`: airbase, heliport, naval_base, port; CanvasTexture generated in code | **FINISH SAND-ART2.** Explicitly omitted from R1 redraw. Seven-glyph combined family is substantive and visible in default play. Real-size BEFORE inspection decides whether each changes. |
| Three fixed-site OSINT plot glyphs | `osintLayer.ts:35–69`, `glyphTexture`: air defence, radar, nuclear; CanvasTexture generated in code | **FINISH same card**, not a second lane. Explicitly omitted by R1. Same plot register, related geography recognition problem. |
| Runway strips and facility-area outlines | `facilityLayer.ts`, RUNWAY_VERT/FRAG, buildRunways/buildAreas/setView/pick/withdrawSymbols | SKIP in this art lane. R1 retained these; they encode true geometry, construction/closed state and replacement thresholds. No demonstrated visual defect that warrants another lane; existing semantics and picking are protected, including runway-end readability. |
| OSINT measured/estimated/selected range rings and true-position dots | `osintLayer.ts`, buildRings/setView; `lib/osint/sites.ts` | SKIP. These are truthful data encodings and layout primitives, not a missing seven-glyph redraw. Preserve geodesic geometry, dashes, side colors and co-location offsets. |
| MapLibre facility and OSINT glyph copies | `src/components/map/FacilityLayer.tsx:57–136`, `OsintLayer.tsx:29–100` | Unpassed surfaces, **deferred rather than falsely “already done.”** Separate Canvas drawers serving home/editor/legacy map, with different colors/materials/layout. Do not expand this default-play card to redesign a second renderer. No evidence here of a release-blocking art defect; one clean default-play candidate is enough for the “up to two” ask across titles. |
| MapLibre unit/contact symbols | `UnitLayer.tsx`, `ContactLayer.tsx`, `lib/map/unitSymbol.ts`, `lib/symbols/milsymbolFactory.ts` | SKIP: standard milsymbol output plus tactical overlays, not a new original seven-glyph art family; changing them is a separate renderer/symbology decision. |
| MapLibre waypoint/range/sensor/weapon/measurement overlays and basemap styling | `WaypointLayer`, `RangeRingLayer`, `SensorCoverageLayer`, `WeaponTrackLayer`, `MeasurementLayer`, `lib/map/styles.ts` | Unpassed legacy map presentation, but mostly geographic/semantic layers. SKIP for this request: no verified visual deficiency or bounded original-art payoff found that beats fixed-site glyphs. Do not invent a wholesale map polish lane. |
| Database two generic placeholder silhouettes | `src/components/database/PlatformDatabase.tsx:70–92`, `Silhouette`: aircraft and surface ship SVG paths | Unpassed code art, **SKIP** as a new lane. Explicit NO OPEN-LICENSE PHOTO ON FILE placeholders, not depictions of individual hardware. SPEC demands real licensed photos; embellishing two generic substitutes is not the missing release deliverable and must not imply model-specific fidelity. |
| Platform photographs, satellite/terrain/vector tiles and geography data | `PhotoBay`, photo records/assets, map providers, plot geography JSON | OUT: not code-drawn art. No image generation, photo replacement or source-data edit. |
| Ordinary forms, editor controls, database/InfoWar UI | component/CSS tree | SKIP: no additional substantive original illustration family found. UI layout/typography work alone is not a license to invent another Fable art lane. |

## Source evidence

Public source references, not private staging claims:
- https://github.com/lerugray/sandkasten/blob/fc3375056bdd202489043bcd8db9232a0e1b98b3/SPEC.md
- https://github.com/lerugray/sandkasten/blob/fc3375056bdd202489043bcd8db9232a0e1b98b3/src/lib/plot/facilityLayer.ts#L74-L112
- https://github.com/lerugray/sandkasten/blob/fc3375056bdd202489043bcd8db9232a0e1b98b3/src/lib/plot/osintLayer.ts#L35-L69
- https://github.com/lerugray/sandkasten/blob/dae77a51987907ea5ea33f138850f72d97ea6137/docs/art-fable-r1/REPORT.md
- https://github.com/lerugray/sandkasten/blob/s426/sand-art1-brief/docs/briefs/SAND-ART1-FABLE-CARD.md
- https://github.com/lerugray/sandkasten/blob/co3/sand-art1-r2-brief/docs/briefs/SAND-ART1-R2-CARD.md

Research checked the exact R1 report/card, R2 card, LOOK and REVIEW, refs and the empty fixed-site diff. Main source, package scripts and Playwright configuration were read directly from a verified clean clone; no game build or battery was executed for this documentation-only inventory. No rendered-pixel aesthetic defect is asserted here. The drawer must inspect baseline pixels and is explicitly permitted NO CHANGE.

## Dispatch and integration readiness

Card content is ready for GS spec gate and custody staging, not proof that host tooling or a target brief branch has been provisioned. Source-verified battery: package.json `test` = `vitest run && playwright test`; repository Playwright config has SAND_E2E_PORT, auto-started Next with NEXT_PUBLIC_SAND_E2E, and the GPU branch. Home-PC launcher/slot-check paths come from current GS HANDOFF, not a live home-PC execution in this research.

The proposed disjoint art lane starts from harvested R1 full SHA plus the card, never old main or mutable R2. It may run alongside R2 because the two permitted drawing routines are outside all R2 product files. Its artifacts are provisional: after R2/ART1 is accepted and GS chooses a final integration base, recapture relevant pairs and protected regions there, run the combined battery and obtain a fresh non-author Opus LOOK before staging KEEP/REVERT. If integration changes the two drawers, re-inventory before dispatch rather than claiming the old card still applies. No future base SHA is fabricated.
