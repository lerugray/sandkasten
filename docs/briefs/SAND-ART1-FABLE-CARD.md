ANCHOR: SPEC.md line 1 (Ray): "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO."
RAY-ASK: 2026-11-10 09:10 "i figure the fable graphics pass should probably apply to sandkasten as well if its not already"
MOVES: Sandkasten first public EA build (ship board row 14). When this lands, the play screen a stranger opens at /play is drawn at the standard of the Fable art passes Ray kept on 11-10 (Darkness, Birdman), so the confirming cold play and Ray's go judge the finished look, not a builder's first draft.
grounded: base main @fc33750 (SAND-RC-FIX2 landed). Play screen = src/components/terminal/TerminalPlay.tsx, src/components/plot/PlotView.tsx, src/lib/plot/TacticalPlot.ts (2,737 lines, Three.js; unit glyphs via src/lib/plot/symbolTextures), src/lib/plot/palette.ts, src/app/play/terminal.css, src/components/ClassicFonts.tsx. Frame tool: tests/sand-play-1-shots.spec.ts (DPR 2). No Fable art pass has run on this repo. SAND-THREAT-1 sits unlanded on its own branch at 1df1434c.

# SAND-ART1: Fable art pass, round 1 (one drawer, BUILD shape)

You are the drawer. Model: Fable 5.2. You are on branch `sand/art-fable-r1`, cut from the brief branch (main fc33750 plus
this card). Cap: 3 hours. This is a fix-lane: do NOT commit and do NOT push; leave every edit in the working tree, the
harvester commits it as found. Write `docs/art-fable-r1/REPORT.md` early and keep it current, so a cut-off still leaves a
true report. Launch every browser with `--mute-audio`.

## Read first
- `SPEC.md` whole: the anchor, "Direction (Ray, 2026-11-03)" and "Out of spec".
- `CLAUDE.md`: run rules, and "No flashing/strobing UI".
- Ray's words about this screen. They are the brief.
  - 11-03: "for the UI, it needs to read more like a tom clancy style arcade/harpoon terminal as opposed to a flashy web
    app or saas but all that energy put towards a truly immersive and engaging setup".
  - 11-03: "we should be fully utilizing all the new UI/graphics improvements we have now, including implementing
    threejs ... and other tools like claude motion".
  - 11-03, after his first in-game look: "its a little laggy on my mac"; "looks a little vibecoded compared to like an
    old school terminal, the green grid for example is a bit too much and its difficult to see anything, i figure it
    should look more like its on a classic monitor or CRT with bulkier/chunkier font and UI".
  - 11-10, for every game: icons or acronyms the genre's players already know before raw text, where the icon is
    clearer (keep a word or key hint where it is not); and no text block may end with one word alone on its last line.
- `docs/handoffs/threejs-play-view-2026-11-03/` and `docs/verification/`: how earlier rounds captured and judged frames.

## Before you change anything
Capture the BEFORE set from the untouched tree at 1920x1080, DPR 2 (Ray's screen), into
`docs/handoffs/sand-art-fable-r1-frames/before/`: briefing; the plot at scenario start; one own unit selected; contacts
at each certainty state (unknown, tracked, fading); a missile engagement in flight; a hit; WeGo planning and WeGo
review; the debrief for a victory and for a defeat; each display mode the game offers. Extend
`tests/sand-play-1-shots.spec.ts` or add a sibling spec; the same spec re-shoots the AFTER set from the same poses.
If WebGL frames come back blank or the plot does not render on this host, STOP and say so on line 1 of the report.
Do not draw blind.

## What you draw, in this order
1. The plot's subjects. Every unit glyph (own, hostile, unknown; ship, submarine, fixed-wing, helicopter, ground unit,
   facility), the contact certainty states, selected and hovered states, weapons in flight, hits and kills. At a glance
   a player must tell what a thing is, whose it is and how sure the sensors are. Keep each symbol's meaning; raise the
   drawing.
2. The plot's world. Coastline, land and water, facilities and runways, range rings, sensor coverage, waypoints and
   tracks, labels, and the grid (Ray: "a bit too much"). The map should read as a place worth looking at, and units
   must never be lost against it.
3. The terminal's drawn finish. Panel frames, dividers, type hierarchy, how colour carries meaning, the teletype, the
   battle file, briefing and debrief, and the monitor finish (glow, scanlines, curve) so it reads as a real screen and
   not an effect layered on a web page.
4. Motion that tells the player something: a launch, a hit, a contact fading, a turn resolving. Nothing that runs on the
   render loop may tear down and rebuild layers, and nothing flashes or strobes.

Aim for the surpassing version inside this fence, not the minimum that keeps tests green: Ray's standard for these
passes is "real detail". Render your own frames and look at them before you move to the next subject.

## Frozen (not yours to change)
- Simulation, engine, AI, scenarios, platform and map data, the save codec, the scenario editor's behaviour: no
  gameplay, balance or data change. Stay out of every file SAND-THREAT-1 touches (`git diff --name-only
  fc33750 origin/claude/sand-threat-1-t438-lane-fr9no6` lists them; that branch holds 1df1434c); that lane lands on its own.
- Every word of text, what each panel contains, the controls and key bindings. Text moves only to fix a one-word last
  line, and the report lists each such move.
- The terminal register: one phosphor family and one alarm hue (`palette.ts`). A new colour is allowed only where it
  carries a meaning the player needs (side, domain, certainty); keep them few and say why each exists.
- The chunky bitmap fonts in use. A new font only if it is open-licensed, committed with its licence, and justified.
- Every display mode stays; refine each, remove none. No new screens, systems or npm dependencies.
- Speed: Ray called this screen laggy. Measure frame time on the heaviest judged pose before and after (same host,
  same viewport, same pose, 10 seconds each). The pass may not make it slower; record both numbers.
- Nothing copied from CMO or any other game: no art, text or data. Everything is drawn in code here.

## Deliverable (in the working tree, under docs/art-fable-r1/ unless named)
1. `docs/handoffs/sand-art-fable-r1-frames/after/`: the same poses re-shot, plus one side-by-side image per pose
   (before left, after right).
2. A before/after sheet of every redrawn glyph at real pixels and at 4x.
3. Proof the text held: an automated diff of the visible strings per pose, before against after. It must be empty apart
   from the listed one-word-last-line fixes. Record the method and the result.
4. `npm test` (vitest, then playwright) on your final tree: GREEN, or each red named and shown red on fc33750 too.
5. The two frame-time numbers.
6. `docs/art-fable-r1/REPORT.md`. Line 1:
   `SAND-ART1 branch=sand/art-fable-r1 battery=<GREEN|RED> text_diff=<empty|N> subjects=<n> frame_ms_before=<n> frame_ms_after=<n>`
   then, per subject, what changed; anything you tried and reverted, and why; anything faked, skipped or unverified,
   stated first.

What happens next (not yours): an independent review on a non-Claude model, a fresh Fable look at the before/after
frames, then Ray sees the pairs and says keep or revert.
