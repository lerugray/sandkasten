ANCHOR: SPEC.md line 1 (Ray): "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO."
RAY-ASK: 2026-11-10 09:16 "i figure the fable graphics pass should probably apply to sandkasten as well if its not already"
MOVES: Sandkasten first public EA build (ship board row 14). An ACCEPT here plus a passing visual look lets GS send the before/after pairs to Ray for keep-or-revert; it lands nothing by itself.
grounded: newest = sandkasten `sand/art-fable-r1` @ `dae77a5` (harvested AS FOUND from Fable lane co3-sandart1-t485, remote-verified); base main `fc33750` plus the card commit `2a59fda`; card `docs/briefs/SAND-ART1-FABLE-CARD.md`; author report `docs/art-fable-r1/REPORT.md`.

# SAND-ART1 independent code review (non-author, non-Claude)

You are an independent reviewer, not the author (the author was a Claude Fable session). STATIC, READ-ONLY review at exact HEAD of this branch: do not edit product files, format, commit, push, start the dev server, a browser, Playwright or the full test battery (`npx vitest run` on single files is allowed if you need it). Your ONLY permitted write is `docs/art-fable-r1/REVIEW.md`.

Read the card first, then the complete product diff: `git diff 2a59fda dae77a5 -- src tests` (five files under src: `src/app/play/terminal.css`, `src/components/terminal/TerminalPlay.tsx`, `src/lib/plot/TacticalPlot.ts`, `src/lib/plot/palette.ts`, `src/lib/plot/symbolTextures.ts`; two new specs under tests). Ignore the image files.

Verdict-gate every concern against the full source and try to refute it before reporting. Check specifically:
1. PRESENTATION ONLY. No simulation, rule, AI, sensor, weapon, scoring, save-format or scenario-data behaviour changed; no change to what information the player is shown or when (the card demands an empty visible-text diff apart from single-word-last-line fixes). Name any line that changes behaviour rather than drawing.
2. FENCES. No new npm dependency, no new font file, no new screen or system, every display mode still reachable, nothing in the files SAND-THREAT-1 owns (README.md, SESSION_NOTES.md, src/lib/sim/**, tests/sand-threat-1-*), no copied third-party art, text or data.
3. PERFORMANCE AND LEAKS in the Three.js code: textures, canvases, geometries or materials created per frame or per update and never disposed or cached; per-frame allocation in the render loop; listeners or timers added without removal; anything that grows with play time. Ray called this screen laggy: a regression here is S2.
4. CORRECTNESS of the glyph drawing: every side/domain/certainty combination the old code drew still gets a symbol (no missing switch arm or undefined texture key), device-pixel-ratio handling, and that a failed texture build cannot blank the plot.
5. The two new specs test the real renderer and would fail if the redraw were removed; no weakened or deleted existing assertion.

Write at most 400 words to `docs/art-fable-r1/REVIEW.md`. Line 1 exactly `ACCEPT S1=0 S2=0 S3=<n>` only if no player-visible S1/S2 remains and the fences hold; otherwise `REJECT S1=<n> S2=<n> S3=<n>`. S1/S2 = a player- or rule-visible behaviour defect with a concrete repro; fence, evidence and tidiness findings are S3. List each finding with file:line and a concrete failure scenario.
