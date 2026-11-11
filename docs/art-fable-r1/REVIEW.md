ACCEPT S1=0 S2=0 S3=3

Static read of `git diff 2a59fda dae77a5 -- src tests`. Product touch set is the five named src files plus the two new specs. No package.json change, no font file, no SAND-THREAT-1 paths, no sim/rule/save/scenario edits. Visible-string proof in `text-diff.txt` is empty. AGENTS.md is absent in this repo.

Presentation holds. Amber for UNK/DET (`palette.ts` caution; `TacticalPlot.ts:1005`), damage/stale frames, launch/wreck flashes, WeGo progress chrome (`TerminalPlay.tsx:898-900,989-992`), and the struck-vs-far burst gate (`TacticalPlot.ts:1047-1049`) change drawing only. `blockLines` is untouched. Frame dt is clamped at zero (`TacticalPlot.ts:1555`); that stops a camera throw, not a rule change.

Glyph coverage: every affiliation/domain path in `framePath`/`icon` has an arm; Z falls to a centre dot; cache keys include certainty/stale/damage (`symbolTextures.ts` `symbolTexture`). DPR still uses `ceil(dpr*1.5)`. Discs and line batches are pooled; glyphs cache; `reliefTexture` runs once at init (~601×451). Frame times in the report are lower on this host.

S3:
1. `TacticalPlot.ts:1882` scales sprites to `GLYPH_PX` (42) while `setSprite` (`:1271-1272`) keeps milsymbol layout boxes (~28). Declutter and block slots clear the old box, so a block can sit a few CSS px into the plate rim. Author kept the small box so the text diff stayed empty.
2. `symbolTextures.ts` module `cache` never clears on `TacticalPlot.dispose`. Key count grew with certainty×stale×damage; it does not grow with play time.
3. `tests/sand-art1-frames.spec.ts` is capture-only (skip without `SAND_ART_SET`). Only `tests/sand-art1-glyphs.spec.ts:98` calls `__sandPlot.glyph`/`drawGlyph`. A stubbed glyph handle would still let frames shoot.

No player-visible S1/S2 left after refute. Fences hold.
