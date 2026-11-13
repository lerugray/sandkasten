# SAND-FONT1 verification

Five screens (briefing, plot, missiles, combat tab, god view) at 1920×1080 and 1440×900 for each candidate face (`vt323`, `glasstty`, `ibm3270`). Orphans = single-word last line of a wrapped block. Clipped = scrollWidth/Height overflow.

## Default proposal

**VT323** — clearest 80s/terminal face at chrome sizes; zero orphans/clipped across all thirty poses after metrics. Glass TTY VT220 is the most CRT-authentic but wider and needed wrap retunes; IBM 3270 is clean but more mainframe than 80s terminal. Seat (one Opus look against Ray's words) may override.

Compare with `?font=vt323|glasstty|ibm3270` on `/play` or `/database`.

## Issues found and fixed

| Face | Screen | Size | Issue | Fix |
|------|--------|------|-------|-----|
| glasstty | briefing | 1920, 1440 | Foot line ended with lone `BRIEFING` | Non-breaking space in `THIS\u00A0BRIEFING`; tighter glasstty letter-spacing |
| glasstty | combat | 1920, 1440 | Record rows ended with lone `AREA.` / `WEAPONS-FREE.` | Combat record text uses Measured + `turnAtSpaces` (shared `textWrap.tsx`); explicit pull-down when last line is one word |

## Per-face / per-screen (final capture)

Empty = none found.

### vt323
- briefing, plot, missiles, combat, god @ 1920 and 1440: no orphans, no clipped

### glasstty
- briefing, plot, missiles, combat, god @ 1920 and 1440: no orphans, no clipped

### ibm3270
- briefing, plot, missiles, combat, god @ 1920 and 1440: no orphans, no clipped

## Files

`docs/verification/sand-font1/<face>-<screen>-<w>.png` plus matching `.json` issue dumps from `tests/sand-font1-frames.spec.ts` (`SAND_FONT1_CAPTURE=1`).
