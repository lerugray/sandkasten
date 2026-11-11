SAND-ART1 branch=sand/art-fable-r1 battery=GREEN text_diff=empty subjects=4 frame_ms_before=19.6 frame_ms_after=17.9

# SAND-ART1: Fable art pass, round 1

Base: main fc33750 plus the card (2a59fda). Host: WSL2, headless Chromium, WebGL on the real GPU
(`ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)`), frames are not blank.
Nothing is committed or pushed; every change is in the working tree.

## Faked, skipped or unverified (read this first)

- **The poses are staged, not played.** Contacts, missiles and damage states are placed into the live session through the
  E2E handle, then drawn by the production renderer. No frame shows a contact the sensors found by themselves or a
  missile the AI chose to fire. The WeGo and debrief poses do run the production tick and event path.
- **Hit, kill and launch frames are held frames.** The plot's animation clock is stopped 0.21 s (hit), 0.33 s (kill) and
  0.24 s (launch) into the effect so the same instant can be shot in both sets. I have not watched any effect play in
  real time; I judged them from held frames only.
- **The WeGo "resolving" frame is paused mid-burst** (72 s of sim time in), so its header reads RESOLVING PAUSED.
- **Frame time is from this host, not Ray's Mac.** Headless Chromium on an RTX 3050 through WSL2. It says the pass is not
  slower here; it does not say the screen is no longer laggy on his machine.
- **Not redrawn:** facility symbols, OSINT site symbols and runway strips keep their drawing (they only pick up the
  tighter glow and the darker field). The legacy MapLibre view (`/play?map=legacy`), the home page and the scenario
  editor are outside the play screen the card names: untouched and not shot.
- **No new font.** The card says "the chunky bitmap fonts in use", but the play screen's font is JetBrains Mono, which
  is not a bitmap font. I kept it and made it sit heavier (bold where it carries structure, a 0.32 px stroke, a
  two-layer glow). Whether Ray's "bulkier/chunkier font" wants a different face is his call; I did not add one.
- **Only 1920x1080 at DPR 2 was shot by the frame tool.** The existing battery covers 1440x900 and 1280x720 for fit.
- **README.md and SESSION_NOTES.md are not updated**, although CLAUDE.md asks for it: both are on the SAND-THREAT-1
  file list this lane must stay out of.
- **Whether the redraw changes how often a data block shows in full is not established.** The plot shows a unit's
  data block either in full or as its first line, and which one depended on run-to-run timing even on the untouched
  tree. The text proof therefore records a block by its first line (see "Text held"). In some AFTER frames a block
  is one line where the BEFORE frame has it in full, and in others the reverse; I did not measure whether the
  balance shifted.
- **AGENTS.md does not exist in this repo** (the lane prompt named it); there was nothing to read.
- **One battery side effect undone:** the ordinary battery rewrites older lanes' evidence files under
  `docs/verification/` and `next-env.d.ts`. I restored those to the base version so this tree changes only its own
  files.

## Files changed

- `src/lib/plot/symbolTextures.ts`: rewritten (glyphs drawn in code).
- `src/lib/plot/TacticalPlot.ts`: world, weapons, effects, glow, frame-step clamp.
- `src/lib/plot/palette.ts`: the amber pair, with the reason.
- `src/app/play/terminal.css`: one appended section.
- `src/components/terminal/TerminalPlay.tsx`: the two turn-progress elements (7 lines).
- New: `tests/sand-art1-frames.spec.ts`, `tests/sand-art1-glyphs.spec.ts`, `docs/art-fable-r1/`,
  `docs/handoffs/sand-art-fable-r1-frames/`.
- No simulation, engine, AI, scenario, platform, map-data, save-codec or editor file is touched, and none of the
  SAND-THREAT-1 files. No npm dependency was added.

## Deliverables

| # | What | Where |
|---|------|-------|
| 1 | BEFORE and AFTER frames, 32 poses each plus the frame-time pose, 1920x1080 DPR 2 | `docs/handoffs/sand-art-fable-r1-frames/before/`, `.../after/` |
| 1 | One side-by-side per pose (before left, after right; both halved to the CSS pixel grid, JPEG) | `.../after/pairs/` |
| 2 | Glyph sheet: every unit and contact glyph, before and after, real pixels and 4x | `docs/art-fable-r1/glyph-sheet.png` |
| 2 | Line-drawn subjects (missile, hit, kill) cropped from both sets, real pixels and 4x | `docs/art-fable-r1/plot-details.png` |
| 3 | Text diff with the control run and the one-word-last-line findings | `docs/art-fable-r1/text-diff.txt` |
| 5 | Frame-time measurements (3 alternating runs each) | `.../before/frame-time-run*.json`, `.../after/frame-time-run*.json` |
| - | Frame tool, glyph-sheet tool | `tests/sand-art1-frames.spec.ts`, `tests/sand-art1-glyphs.spec.ts` |
| - | Pair and diff tools (Python + Pillow, host tools, not npm dependencies) | `docs/art-fable-r1/tools/` |

Both specs skip unless `SAND_ART_SET` is set, so the ordinary battery neither runs them nor overwrites the frames.
Re-shoot: `SAND_ART_SET=after npx playwright test tests/sand-art1-frames.spec.ts`.
The BEFORE set was shot from an untouched `git archive` of the base, served on its own port, with the same spec.

Poses: 01 briefing, 02 plot at start, 03 objective focused, 04/05 own unit selected, 06 contacts at every certainty
state (UNK, DET, CLS, TRK, each also fading) with two damaged own ships, 07 intel tab, 07b launch, 08 missiles in flight,
09 combat tab, 10 hit, 11 kill, 12 hover, 13 sensors, 14 sensors + tilt, 15 tilt, 16/17 god view, 18 measure,
19 OSINT layers off, 20 facility close-up, 21 help, 22 battle file, 23 WeGo briefing, 24 WeGo planning, 25 WeGo
resolving, 26 WeGo review, 27 victory debrief, 28 defeat debrief, 29 plot after the defeat, 30/31 snapshot scenario.

## Subject 1: the plot's subjects

Files: `src/lib/plot/symbolTextures.ts` (rewritten), `src/lib/plot/TacticalPlot.ts`, `src/lib/plot/palette.ts`.

- **Every unit and contact glyph is now drawn in code** instead of taken from milsymbol in one thin colour. The frame
  keeps the meaning the plot already used: round = own (circle at sea, arch in the air, cup under water, box on
  land), pointed = hostile (diamond, tent, vee), quatrefoil = unknown, square = neutral. Inside sits a silhouette:
  carrier, surface combatant, merchant, submarine, fixed-wing, helicopter, ground unit, installation. The own carrier
  used to show a hook-shaped mark; it is now a flat-deck hull with an island.
- **Each glyph sits on a dark plate** slightly larger than its frame, so no grid line, coast or ring runs through it.
  Own and tracked glyphs carry a tint of their side colour. Glyphs are drawn about 1.3x larger than before.
- **Certainty is drawn into the frame**, not only written in the data block: UNK = dotted quatrefoil with a bare
  centre dot; DET = solid quatrefoil with a question mark; CLS = thin solid frame, no tint; TRK = heavy frame, tint,
  four lock ticks. After 45 s without a report the frame breaks into dashes (the existing fade still applies).
- **One new colour: amber `#f5c451` (and a dim `#9a7a2c` for the uncertainty disc).** It means "the sensors hold this
  but have not identified it" (UNK, DET). Before, an unidentified contact was a dimmer shade of the player's own
  green, so own and unknown differed only in brightness. Now green = own, red = hostile, amber = not yet known.
  Nothing else uses it. It lives in `palette.ts` and `--tx-caution`; removing those two reverts it.
- **Own units show damage on the glyph**: one alarm-red slash for damaged, a cross for mission kill. The DMG and
  M-KILL words in the data block are unchanged.
- **Selected and hovered**: the corner brackets are larger to clear the new frames; the selected data block is
  outlined in the highlight tone with a glow. The course leader now starts at the frame edge, so a slow ship's
  heading is not hidden under its own glyph.
- **Weapons in flight** were a 7 px white square with a row of dots. They are now a dart on the weapon's heading with
  a trail through where it has been, in the launching side's colour, and a quieter dashed line to the target.
- **Hits and kills**: a hot core that lasts a third of the burst, two shock rings, and debris streaks of uneven length
  (fixed, so a burst looks the same every time). A kill is larger, adds a third ring, and leaves a small broken ring
  and cross where the unit was lost for 45 s, fading once at the end.
- **A drawing fault fixed on the way**: when a target died, every other missile of the salvo drew a full hit burst
  in open water where it happened to be. Now only a weapon that reached its target bursts, and it bursts on the
  target. This changes what is drawn, not what the simulation does.
- **Label placement is untouched.** The glyph's layout box is still the one milsymbol reported, so every data block
  and label is placed where it was. milsymbol is still a dependency (the legacy map uses it); on the plot it is asked
  only for that box.

## Subject 2: the plot's world

File: `src/lib/plot/TacticalPlot.ts`.

- **The field is finally dark.** The palette's near-black never reached the screen: three 0.187 writes the clear
  colour into the linear frame as if it were already display-encoded, so the sea came out near `#182a22`, a
  grey-green haze that was lighter than the land. The clear colour is now encoded so the intended tone arrives.
  This is the largest single change in contrast, and probably much of what "difficult to see anything" was.
- **Water**: shelf water is `#030e08`; the 200, 1000, 2000 and 3000 m depth areas step down toward the palette's
  field tone, under the existing dashed contours (now a little quieter).
- **Land** is lit from the same ETOPO1 elevation grid the tilt view extrudes, resampled smooth and shaded from the
  north-west inside the land's own dark tone. Mountains read as mountains in the flat chart.
- **Coast**: a crisp line over a soft wide one. Both are quieter than the old single line so units outrank the shore.
- **Grid** (Ray: "a bit too much"): the half-degree lines are about half as bright as they were (whole degrees) or less (the rest); small register crosses mark
  the crossings, larger on whole degrees. A thin neat line marks the edge of the charted sheet.
- **Glow**: bloom is tighter (strength 0.32 to 0.26, radius 0.3 to 0.12). The old setting spread every bright line
  into a veil over the water around it.
- **Mission area**: the fill is a quarter as bright (it read as a grey slab); solid brackets mark the corners.
- **Waypoints** are diamonds, the last one doubled, instead of square points. Range rings: the weapon ring is
  slightly quieter. Sensor sweeps, coverage discs and domes are unchanged apart from the glow.
- **Tilt view**: the relief mesh lines are half as bright and the relief fill is lighter-handed, and the flat land
  tone steps back while tilted so the two do not add up. Every display mode is still there.

## Subject 3: the terminal's drawn finish

File: `src/app/play/terminal.css` (one appended section; earlier rules are not edited).

- **Monitor**: scanlines, a dimming toward the edge of the tube, rounded glass corners with a black bezel outside
  them. All static. No blend modes, no backdrop filters, no animation.
- **Type**: bold for structure (section heads, tabs, keys, clock, data blocks), a 0.32 px stroke and a two-layer glow
  on all text so the one face sits heavier. Inverse-video elements carry no glow.
- **Frames and dividers**: panels have a double rule with heavier corner brackets; the top strip and command bar
  have a second line under their rule; section heads sit on a dashed rule; panel titles are bars.
- **How colour carries meaning**: mission status is an inverse chip (highlight pending, green complete, red failed);
  the active tab is lit and underlined; lit buttons glow; **disabled buttons now look disabled** (dashed, dimmed).
  They looked identical to live ones before.
- **Teletype**: the newest line is the bright one, the one before it normal, older traffic dim; a steady block
  (it does not blink) marks the print head.
- **Data blocks on the plot** carry a bar of their side colour on the left edge; unknown blocks and their leaders
  are amber. Box sizes are unchanged, so placement is unchanged.
- **Briefing, review, debrief, battle file**: larger titles with a glow; the result title sits between double
  rules, red for a defeat; the debrief backdrop darkens toward the edges.

## Subject 4: motion

- **Launch**: a ring opens at the rail with a short blast back along the launch heading, 0.7 s, once.
- **Hit, kill, intercept**: as under subject 1; each plays once.
- **Contact fading**: the frame breaks into dashes at 45 s, on top of the existing fade.
- **Turn resolving** (`TerminalPlay.tsx`, 7 lines): a bar in the turn panel and a hairline under the top strip fill
  as the burst runs, at the pace of the clock. No text was added.
- Nothing on the render loop tears down or rebuilds layers: glyph textures are cached per state, effects reuse the
  pooled line batches and discs, and nothing repeats, blinks or strobes.

## Text held (deliverable 3)

Method: for every pose the frame tool records every visible string on the page (whitespace-collapsed, sorted) and
every text block whose last line holds one word. `docs/art-fable-r1/tools/textdiff.py` compares BEFORE with AFTER
pose by pose, and BEFORE with a second BEFORE capture as a control.

Result: **0 strings differ, exactly, in all 32 poses** (digits unmasked). Control: 0. Output in `text-diff.txt`.

Three things in the method a reviewer should know:
- The capture is made repeatable: every sim tick is handed exactly 50 ms, the dice are fixed, and runs stop on a
  condition tested on the tick. Without this, two captures of the untouched tree differed in 410 strings.
- A unit or contact data block is recorded by its first line. The plot shows a block in full or as its first line
  depending on what its declutter placed first, and that differed between two runs of the untouched tree. The code
  that writes the block text (`blockLines`) is unchanged.
- Line breaks do not enter the comparison, so a block that only re-broke compares equal. Those are listed below.

One-word last lines: seven kinds of block had one in BEFORE (40 pose instances); none has one in AFTER; no new one
appeared in any captured pose. The words are unchanged; only where the line turns moved:

| Block | Before | Now | Rule |
|-------|--------|-----|------|
| Mission panel, WIN line (every Hormuz pose) | "...the transit gate / afloat" | "...the transit / gate afloat" | `.tx-mission-line` pretty |
| Mission panel, progress line (victory) | "... // INSIDE / GATE" | two words on the last line | same |
| Snapshot briefing, rule note | "...RESET restarts / it." | two or more words | `.tx-briefing-mission > div` pretty |
| Weapons-in-flight rows | "...USS NIMITZ (CVN- / 68)" | "...-> / USS NIMITZ (CVN-68)" | `.tx-wif-row` balance |
| Combat record entry | "...ARE GOING / WEAPONS-FREE." | broken evenly | `.tx-rec-text` balance |
| Debrief record lines (3 kinds) | "...AT USS NIMITZ (CVN- / 68)" | broken evenly | `.tx-result-line` balance |
| Help, rules-of-engagement row | "...X Weapons / hold" | two or more words | `.space-y-1 > div` pretty |

Two honest limits. `balance` re-breaks every block of its kind that runs to two to six lines, not only the ones
that had the fault, so I cannot list each move it makes. And `text-wrap: pretty` is also set on the briefing text,
mode text, result message and facts, modal text and notes, the credit line and the review body, where no fault was
seen in the captured poses; it acts only on a short last line, but it may re-break one in a state I did not shoot.

Two titles changed size, not words: the briefing title (14 to 18 px) and the result title (22 to 30 px).

## Tried and reverted

- **A full-screen radial vignette and a glass-reflection gradient.** The browser dithers a full-screen gradient
  pixel by pixel; it doubled the weight of every frame and read as an effect laid over a page. Replaced by inset
  shadows.
- **Opaque meshes for the sea and the field.** They added two full-screen layers at 4K with MSAA and made the frame
  slower (21.4 ms against 20.5 ms). Replaced by the clear colour, which costs nothing.
- **Larger glyph layout boxes.** Labels moved and the text diff was no longer empty. The drawing is larger; the
  layout box is the old one.
- **The SANDKASTEN brand in the highlight tone.** `tests/design-system.spec.ts` pins it to the phosphor primary.
- **`text-wrap: pretty` on weapon rows and record lines.** It does not treat a long last word as alone; `balance` does.

## Speed (deliverable 5)

Pose (`32-frame-time-pose.png`): god view, sensor coverage on, tilted, the carrier selected, eight contacts and
fourteen missiles on the plot, sim held. 1920x1080 at DPR 2 (a 3840x2160 canvas), 10 s of animation frames, three
runs of each tree taken alternately on the final tree, same host, same Chromium flags.

| Run | BEFORE frame interval, mean ms (frames in 10 s) | AFTER frame interval, mean ms (frames in 10 s) |
|-----|------|------|
| 1 | 19.85 (503) | 17.95 (557) |
| 2 | 19.69 (507) | 17.83 (559) |
| 3 | 19.35 (516) | 17.76 (563) |
| mean | **19.6** | **17.9** |

The pass is about 9% faster on this pose, in every pair (an earlier set of three pairs gave 19.6 and 17.9 as well).
The interval is locked to the display (16.7 / 33.3 ms), so the mean reflects how many frames missed a refresh:
fewer do now. Inside that, the plot's own frame callback (JavaScript only) costs slightly more than it did:
2.87 ms before, 3.02 ms after.

Where the time went: the display-encoding pass is folded into the finish pass (one full-screen pass less at 4K), and
the darker field is the clear colour instead of drawn geometry. Glyph textures are built once per state and cached.

A fourth pair with the frame limiter off (`frame-time-uncapped.json`) is in the folders but is not usable: both
trees stalled for 0.6 to 0.8 s at a time under those flags, and the medians disagreed from one such pair to the next.

This is one host. It does not show what Ray's Mac does.

## Battery (deliverable 4)

`npm test` is `vitest run && playwright test`. Run on the final tree on this host, with the WSL GPU flags supplied
from a config file outside the repo (nothing host-specific is in the repo's Playwright config or source):

- **vitest: 26 files, 331 tests, all passed.**
- **playwright: 123 passed, 0 failed, 12 skipped, 14.6 min.** The 12 skipped are this lane's ten capture tests
  (skipped without `SAND_ART_SET`) and two `sand-osint-1-frames` tests that skip at base as well.
- Log: `docs/art-fable-r1/battery.txt` (web-server chatter removed, absolute paths shortened).
- `tsc --noEmit`: only the three errors in `tests/sand-001-unit-placement.spec.ts` that the base already has.
  The repo has no ESLint config, so nothing was linted.

That green run was the third full run. What happened before it, in order:

1. An early run stopped being meaningful part-way: the dev server I had started by hand exited without a trace
   and every later test failed on a refused connection. One real failure showed first, the design-system test that
   pins the SANDKASTEN title to the phosphor colour; I had restyled it and put it back.
2. First full run on the then-final tree: 121 passed, 2 failed
   (`sand-osint-1-rings.spec.ts:65`, `simulation.spec.ts:55`). Each passed 4 of 4 alone, on this tree and on the
   untouched base.
3. Second full run: stopped after `sand-map-2-plot-facilities.spec.ts:30` failed with 51 facility symbols drawn
   where over 100 were expected. Its screenshot showed the plot thrown far out of the theater at load. Cause: the
   plot's frame loop accepted a negative time step. The browser stamps a frame when it is scheduled, which on a
   busy page can be before the plot was built, and a negative step turns the opening zoom's ease into a throw.
   The base has the same line, so the fault is latent there; my heavier plot setup (relief texture, glyphs) most
   likely made it bite. The step is now clamped at zero (`TacticalPlot.frame`). I was also running image tooling
   on the machine during that run, which added load.
4. Third full run, machine otherwise idle: green, as above.

I have one green run after the fix, not several. The two failures in run 2 fit the same cause (a plot that had not
settled within the test's wait) but I did not prove that for `simulation.spec.ts:55`, which waits on a PAUSE button.

## Housekeeping a reviewer may trip over

- `tests/sand-art1-frames.spec.ts` replaces the page's clock (`Date.now`, `performance.now`, `requestAnimationFrame`,
  `setInterval`) inside its own pages to make captures repeatable. It does this only in the capture tool.
- The frames weigh about 150 MB (PNG at 3840x2160). The control capture keeps only its text.
- While starting the battery's web server from the wrong directory once, `npx` fetched the public `next` package
  from the npm registry. Nothing was installed into the repo and `package.json` / the lockfile are unchanged.
- No steering file appeared during the lane (`STEER.md` was checked at each checkpoint), so no steer entry was acted on.
