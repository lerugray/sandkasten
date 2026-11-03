Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." Round 3 of the CARD.md build in this folder: the plot stays readable in a dense fight, so a player can tell which label belongs to which contact.

RAY-ASK: 2026-11-03 15:2x "Build it in-game" (his pick over a mockup round; same card, round 3)
MOVES: /play stops crossing and stacking labels in dense clusters, which the s387 Opus look failed round 2 on; Ray's in-game look follows this round.
Author: Opus 5.5, the same session that wrote rounds 1-2 (one-line reason: it owns the placement engine; a new author would re-learn 360 changed lines).

# ROUND 3: label declutter in dense clusters (s387 seat, 2026-11-03)

Base: branch `sand/threejs-play-s386` @ 010bd14 (your round 2, WIP 7ede988, plus main's SPEC rulings merged in).
Rules as in CARD.md: no commit, no push, frames re-captured under the same names, the full suite on the lane GPU config.

## Why
The s387 Opus look of your round 2 frames: FAIL-PULL. Items 1, 2, 5, 6, 7, 8 and 9 of round 2 PASS (no text in the chrome,
no sliced labels, briefing in full, CSR `--`, track-number names, domes visible, ESM line and MORE bar). Item 3 (tilt
leaders and declutter) and the weapon-line part of item 4 FAIL. Coordinates are in 2880x1800 frame pixels.

## S2: fix all four (each is a player reading the wrong label for a contact)
1. **Leaders cross other labels.** `unit-selected.png`: TN7569's leader runs across TN4947's "TRK" text at about (1347,322),
   and TN4947's block sits directly under TN7569's glyph. `first-screen.png`: the TN6053 and TN8733 leaders cross at about
   (1770,485). A reader pairs the label with the nearest glyph, which is the wrong one.
2. **Leader through another block while moving.** `motion.webm` at about 1 s: TN4840's leader crosses TN4299's text, and the
   two blocks touch edge to edge.
3. **Blocks overlap in tilt.** `tilt-3d.png`: the TN7569 and TN8733 block backgrounds overlap by about 36x22 px near
   (1295,590), and TN1260 butts against both. NOTES says blocks only touch; here they stack.
4. **Weapon track lines through blocks.** `motion.webm` at about 1 s and 7 s: the dashed Phoenix track line runs through
   the TN5550 block and through the "K" of "TN4299 TRK". Missile heads clear labels; the track lines do not.

## What done looks like (the behaviour, not the method)
- No two data blocks overlap, ever. A leader never crosses another block's text, another leader, or a glyph other than its
  own. A weapon track line never passes through block text.
- A block sits nearer its own glyph than any other glyph, or has a leader that makes the pairing unambiguous.
- When a cluster is too dense for every full block, degrade in this order, keeping each step stable frame to frame (no jitter
  as the clock runs): first line only; then a leader out to clear space along the cluster's edge; then hide the
  lowest-priority block. Friendly units, the selection and classified hostiles (CLS/TRK) keep a block, at least their first
  line. Hide unknowns before them.
- Your choice how (slot scoring with leader-crossing and line-crossing penalties, a cluster callout, force relaxation, or
  anything better). Prove it on the dense case, not the easy one.

## S3: fix when the S2 work touches the same code
5. Grid labels overprint each other (`motion.webm` about 2 s: "27°30'N" over "052°30'E"). Grid labels yield to each other
   and to everything else.
6. The coverage ring cuts through "25°30'N", "24°30'N" and "25 NM" (`unit-selected.png`). Grid and ring text gets the same
   clearance as blocks.
7. In `tilt-3d.png`, Sina 102 (TN4947, a classified hostile) has no data block. Covered by the keep rule above.
8. The objective after the briefing is dismissed: INTEL dropped from 2 to 1 and the OPERATION line left traffic. A player
   must be able to read the objective again (the Intel tab is fine). Say where it is in NOTES.
9. The code review (Sonnet, ACCEPT-WITH-NOTES, no S1/S2) noted: chrome rects are not invalidated on resize or when a panel
   or the briefing closes (up to 200 ms of labels under chrome, or hidden); per-frame `new Map`/`Set`/spreads in the label
   pass and an `offsetWidth` re-measure each frame when block text changes. Fix if you are in that code anyway.

## Proof (in NOTES.md, a "Round 3" section)
- A dense-cluster frame: add `dense-tilt.png` (tilt, the hostile cluster near the strait, at the moment most contacts are
  close together) and re-capture the five existing frames and `motion.webm`.
- A measured check, not only frames: a test or a capture-time script that walks every drawn block, leader and weapon line
  over at least 60 s of 60x sim time in tilt and in flat view, and asserts zero block-block overlaps, zero leader crossings
  of another block or leader, and zero weapon lines through block text. Print the counts. Break-test it as you did in round 2
  (break the placement, watch it fail, restore it byte-identical).
- The full suite on the lane GPU config, `npm run build`, fps median and 5th percentile, console errors.
