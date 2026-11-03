Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." Round 5 of the CARD.md build in this folder: /play looks like it is on a classic CRT monitor, chunky and easy to read, and Ray picks the final look by flipping display modes in the running game.
RAY-ASK: 2026-11-03 17:45 "its a little laggy on my mac but that could be for a number of reasons, maybe we are over engineering the UI a little bit as a looks a little vibecoded compared to like an old school terminal, the green grid for example is a bit too much and its difficult to see anything, i figure it should look more like its on a classic monitor or CRT with bulkier/chunkier font and UI if that makes sense, but i dunno, im actually not sure to be perfectly honest"
RAY-ASK (second): 2026-11-03 17:4x AskUserQuestion pick "CRT mode to flip in-game (Recommended)": a chunky old-PC bitmap font, heavier boxier UI, the grid dimmed way down or off by default, phosphor glow, light scanlines, a slight screen curve; he flips between it, the current look and one OFF-SIGNATURE look in the running game, then picks; also fixes the fighter labels and runs smoother on his Mac.
MOVES: Ray judges and picks the CRT look in the real game on his own Mac; the labels pair correctly and the view runs smoothly there.
Author: Opus 5.5, the same session as rounds 1-3 (one-line reason: it owns the plot, the label placer and the register; Ray named Opus for this look work on 11-02).

# ROUND 5: classic CRT monitor look, three switchable display modes (s387 seat, 2026-11-03)

Base: branch `sand/threejs-play-s386` @ the commit that carries this card (your round 3 at b9f494d, plus cards). This
round SUPERSEDES the held ROUND4.md; its label-pairing fix is folded in below. Same rules: no commit, no push.

## What Ray saw (his first in-game look, round 3, on his Mac)
Laggy; "over engineering the UI a little bit"; "looks a little vibecoded compared to like an old school terminal"; "the
green grid ... is a bit too much and its difficult to see anything"; he wants "a classic monitor or CRT with
bulkier/chunkier font and UI". The bug to fix is readability: fewer, bigger, clearer things on screen.

## 1. Three display modes, switched in the game
A `[V] DISPLAY` command (key `V`, listed in help) cycles the modes; the mode name shows briefly in the top bar; the choice
persists per viewer (localStorage, wrapped in try/catch). Default: CRT. The simulation, controls and data are identical in
every mode; only how /play draws changes.

**A. CRT (default, Ray's direction).** It should read as a real old monitor, not a web page with green effects:
- A chunky old-PC bitmap font, vendored locally with its license file and an attribution line in the credits: compare
  Px437 IBM VGA 8x16/9x16 (VileR's Ultimate Oldschool PC Font Pack, CC BY-SA 4.0) and VT323 (SIL OFL) on a real frame
  and pick the chunkier, more readable one (say why). Bigger text: at least 16 px body in panels at 1440x900, block cursor,
  inverse-video highlight for selection.
- Heavier, boxier UI: thick box-drawing frames, fewer columns, less text per panel, fewer simultaneous panels by default
  (keep everything reachable, show less at once).
- The grid dimmed way down (about 8-12% intensity, labels only at the screen edges) or off by default with a toggle key
  that does not collide with G (God mode) or any existing binding.
- One phosphor colour with brightness levels for hierarchy, plus at most one alarm colour used sparingly. Friendly,
  hostile and unknown must stay distinguishable at a glance by symbol shape and brightness, not colour alone.
- Screen treatment, subtle and cheap: phosphor glow on bright text and lines, light scanlines (darken at most ~10%), a slight
  curvature or vignette and a dark bezel around the screen. Readability wins every tie: if an effect blurs text, reduce it.
- Labels: fewer and bigger; with the chunkier font, prefer first-line-plus-leader earlier than now.

**B. CURRENT.** Round 3's look exactly as it is today, for an honest comparison. Do not restyle it.

**C. OFF-SIGNATURE: "ADMIRALTY DUSK"** (designed by Argon, a model that has never read Ray's corpus; labelled
OFF-SIGNATURE in the mode readout). Build it as specified:
- Idea: a matte, low-glare ECDIS nautical chart look modelled on darkened naval bridge plotters and paper manoeuvring boards, desaturated pigment inks on deep slate.
- Background: flat slate #14181D for sea, basalt #1E232A for land, 1 px coastline #323B46, no gradients or textures.
- Palette: friendly steel cyan #4EA8DE, hostile matte vermilion #D64F45, unknown ochre #D9B24C, weapons ordnance orange #E87A3E, selection chalk ivory #F4F1EA, neutral text #C5CCD3.
- Type: IBM Plex Mono (SIL OFL): 10 px graticule degrees, 11 px track labels, 12 px lists and log, 13 px bold headers.
- Linework: 1 px graticule #222932 with 4 px degree ticks; range rings 1 px dashed #36414F (6/4) with inline NM numerals.
- Contacts: 14 px hollow NATO-style strokes (1.5 px) with a #14181D knockout fill and velocity vectors; labels on 1 px #4A5564 leaders with a 2 px #14181D halo.
- Panels: square-cornered flat sidebars #181D23, 1 px borders #2E3742, no shadows or radius, dense 20 px rows with hairline rules.
- Effects: none (no post-processing, bloom or blur).

## 2. Labels pair with the right contact (folded from ROUND4.md, in every mode)
The s387 Opus look of round 3 found: in `unit-selected.png` both HORNET blocks sat at the right jet and the left jet had none;
in `dense-tilt.png` the HORNET 101 block was ~40 px from the left jet and ~38 px from the right with no leader; in
`tilt-3d.png` the TN5391 DET block sat ~12 px above the TN2585 diamond and ~100 px from its own glyph with no visible leader.
Done means: a block with no leader is clearly nearer its own glyph than any other (pick a margin, about 60% of the
next-nearest distance, and say why), else it gets a leader or moves; a block farther than ~24 px from its glyph has a leader
a player can SEE; no block sits nearer another contact's glyph than its own without a leader; with the camera still a block
keeps its form and side. Tighten the audit to match (`ambiguousPairing`, `farBlockNoVisibleLeader`, `blockOverGlyph`,
`blockOverMissileHead`) and break-test the new checks. Plus the review's notes: the `[B] BRIEF` button must be able to close
the briefing; the MutationObserver must not fire on the plot's own text writes; clone `Memory` before a repair attempt;
bound the repair pass. Map and list use the same naming rule (platform name once CLS/TRK, track number before).

## 3. Smooth on Ray's Mac
Ray's machine: an 8 GB MacBook (Apple A18 Pro GPU via ANGLE Metal); the seat measured 30 fps median in the app's browser pane
on the dev build at DPR 2 (2048x1536 canvas), with ~100 ms hitches, under memory pressure. Add an adaptive render scale
(cap device pixel ratio, drop render scale when frame time stays over ~20 ms, recover when it is low), keep the CRT effects to
one cheap pass, and keep layout reads out of the frame loop. Report fps for each mode on the lane GPU at DPR 2 and at a
forced render scale of 0.6, on a production build (`npm run build` then `npm run start`), not only `npm run dev`.

## Fences
Do not touch `src/lib/simulation/*`, `src/lib/scenarios/demo.ts`, `demoConfig.ts`, `src/data/platforms/*`,
`src/app/database/*` or `src/components/database/*` (two other lanes own them). Use port 3001 as before.

## Proof (a "Round 5" section in NOTES.md)
- Per mode: `first-screen`, `unit-selected`, `tilt-3d` and `dense-tilt` frames (1440x900, DPR 2), named `crt-*.png`,
  `current-*.png`, `offsig-*.png`; one `mode-switch.webm` cycling the three modes on the same moment; a `hornet-pair.png`
  close-up in CRT mode.
- Font comparison frame and the chosen font's license file path.
- The tightened audit's counts in each mode over the 2 x 60 s run, break-test results, the full suite on the lane GPU
  config, `npm run build`, fps per mode at DPR 2 and render scale 0.6, console errors.
