> **REFUSED by spec-gate, 2026-11-03 17:3x (ON-SPEC, MOVES=NO), and HELD for Ray's call. Do not build. (The commit that added this card, 1f33cec, says "spec-gate PASS" in error: the gate had refused it.)**

Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." Round 4 of the CARD.md build in this folder: every label reads as belonging to its own contact, so a player never mistakes one aircraft for another.

RAY-ASK: 2026-11-03 15:2x "Build it in-game" (his pick over a mockup round; same card, round 4)
MOVES: /play stops pairing labels with the wrong contact, the last S2 the s387 Opus look found; Ray's in-game look follows this round.
Author: Opus 5.5, the same session as rounds 1-3 (one-line reason: it owns labelPlacer.ts and the audit).

# ROUND 4: unambiguous pairing (s387 seat, 2026-11-03)

Base: branch `sand/threejs-play-s386` @ b9f494d (your round 3, harvested as found). Same rules: no commit, no push.

## Where round 3 stands
The s387 Opus look of your round 3 frames: FAIL-PULL, narrowly. PASS: no block overlaps, no leader crossings, no weapon
line through text, grid labels clean, every TRK and friendly keeps a block, briefing complete. Much better than round 2.
The code review (Sonnet): ACCEPT-WITH-NOTES, no S1/S2. Coordinates are in 2880x1800 frame pixels.

## S2: fix both
1. **Ambiguous pairing.** `unit-selected.png` around (1170-1600, 140-280): both HORNET blocks sit at the right jet; the
   left jet has no block. `dense-tilt.png`: the HORNET 101 block is about 40 px from the left jet and about 38 px from the
   right one, with no leader. Your audit reported `ambiguousPairing: 0`, so its rule is too loose.
2. **Far block with no visible leader.** `tilt-3d.png` around (1400-1590, 345-380): the TN5391 DET block sits about 12 px
   above the TN2585 diamond and about 100 px from its own "?" glyph, and no leader is visible.

## What done looks like
- A block with no leader is clearly nearer its own glyph than any other: its distance to its own glyph is at most about
  60% of its distance to the next-nearest glyph (pick the exact margin and say why). Otherwise it gets a leader, or moves.
- Any block farther than about 24 px from its own glyph has a leader a player can SEE (contrast and length checked on the
  real frame, not only "drawn").
- No block sits nearer another contact's glyph than its own unless its leader makes the pairing explicit.
- Tighten the audit to the same rules, measured from DOM rects and drawn glyph centres: `ambiguousPairing`,
  `farBlockNoVisibleLeader`, plus `blockOverGlyph` and `blockOverMissileHead` (the review found the audit never checks a
  block covering a symbol). Break-test the new checks as before.
- Stability: with the camera still, a block keeps its form and side. The look saw HORNET 101/102 swap between one and two
  lines and TN4557 flip sides between frames 6 and 7.

## S3: fix when in the same code
3. Trail squares and the coastline draw over the TN5520 block (`unit-selected`, `first-screen`): give blocks an opaque
   backing in the register (map linework passes under text), as grid labels got in round 3.
4. The dashed SNS ring cuts the right edge of the TN5391 block (`dense-tilt`): same fix.
5. Map vs list names: the list shows "Kaman 201" and "Sina 102" while the plot shows TN8457 and TN4557 for the same
   classified contacts. Use the same rule on both: the platform name once classified (CLS/TRK), the track number before.
6. From the review: the `[B] BRIEF` button cannot close the briefing (capture-phase pointerdown dismisses it, then onClick
   reopens it, `TerminalPlay.tsx` ~682); the MutationObserver on `.tx-root` subtree fires on the plot's own text writes and
   forces a rect sweep almost every frame (observe the chrome only, or ignore plot nodes); a rejected repair attempt leaves
   mutated `Memory` objects behind (`labelPlacer.ts` ~205-209: clone before trying); bound the repair pass so a kept track
   that stays hidden cannot re-run three full passes every frame.

## Proof (a "Round 4" section in NOTES.md)
- Re-capture all frames and `motion.webm`, plus `hornet-pair.png`: a close-up of two friendly fighters flying close
  together, at the moment they are nearest, with both labels visible and paired.
- The tightened audit's printed counts over the same 2 x 60 s run, the break-test results, the full suite on the lane GPU
  config, `npm run build`, fps median and 5th percentile, console errors.
