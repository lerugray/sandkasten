SAND-ART1-LOOK REJECT OPENED 30/30 defects_blocking=2 defects_minor=14

# SAND-ART1: independent look at the round-1 art pass

Looker: fresh Fable session, non-author, look only. I read the drawer's card and the "Faked, skipped or unverified"
part of the report first, then opened all 30 named images with the image reader. Fine detail was read from the
full-size stills and from unscaled crops of the named files (crops kept outside the repo). I ran no browser, dev
server or battery and changed no product file. Positions below are in CSS pixels of the 1920x1080 frame, x from the
left and y from the top, approximate.

The art is a clear improvement and is close. It is rejected for two text-wrap faults the pass itself introduced or
failed to cure, both on screens a first player reads during and after a fight. Both come from one CSS rule and are a
small fix. Nothing in the drawing needs to be redone.

## Files (30 of 30 opened)

A. Pairs, `docs/handoffs/sand-art-fable-r1-frames/after/pairs/`

| File | Opened |
|------|--------|
| 01-briefing.jpg | yes |
| 02-plot-start.jpg | yes |
| 04-own-unit-selected.jpg | yes |
| 05-own-unit-selected-close.jpg | yes |
| 06-contacts-certainty.jpg | yes |
| 08-missiles-in-flight.jpg | yes |
| 10-hit.jpg | yes |
| 11-kill.jpg | yes |
| 13-mode-sensors.jpg | yes |
| 15-mode-tilt.jpg | yes |
| 17-mode-god-close.jpg | yes |
| 20-facility-close.jpg | yes |
| 21-help.jpg | yes |
| 24-wego-planning.jpg | yes |
| 27-debrief-victory.jpg | yes |
| 28-debrief-defeat.jpg | yes |

B. Full-size stills, `.../after/` and `.../before/`

| File | AFTER opened | BEFORE opened |
|------|--------------|---------------|
| 02-plot-start.png | yes | yes |
| 05-own-unit-selected-close.png | yes | yes |
| 06-contacts-certainty.png | yes | yes |
| 09-missiles-combat-tab.png | yes | yes |
| 21-help.png | yes | yes |
| 28-debrief-defeat.png | yes | yes |

C. Sheets, `docs/art-fable-r1/`

| File | Opened |
|------|--------|
| glyph-sheet.png | yes |
| plot-details.png | yes |

## Verdict per subject

**Unit and contact glyphs: improvement, and a stranger sees it at once.** BEFORE, an own ship was a thin ring with a
small mark and an unknown contact was a dimmer green quatrefoil, so own and unknown differed only in brightness. AFTER,
side reads from colour and frame (green round, red pointed, amber quatrefoil), domain from the frame shape and the
silhouette inside, and certainty from the frame itself (dotted, solid with a question mark, thin, heavy with lock
ticks, dashed when fading). All three are told apart at normal zoom in `02-plot-start` and `06-contacts-certainty`.
The dark plate keeps grid, coast and rings out of every symbol. The selected unit stands out (larger brackets, white
outlined block). The damage slash and the mission-kill cross read at a glance. One limit: at real size the carrier,
the cruiser and the destroyer silhouettes are close to each other; the label still does that job.

**Missiles and effects: improvement.** A white square with a row of dots became a dart on its heading with a trail in
the launching side's colour, so direction and owner read without the list. The hit keeps the target's glyph visible
inside the burst, where BEFORE the ring covered it. I judged held frames only; nothing here says how the effects look
in motion.

**Plot field and overlays: improvement.** The grey-green haze is gone, the sea is dark, the land has relief, the grid
is quiet with register crosses, and the mission gate no longer reads as a grey slab. Units now outrank the map. The
tilt view is a small gain and still busy. The facility close-up is a wash (darker field, same drawing). The sensors
frame (`13-mode-sensors`) shows no visible coverage edge in either set at that pose, so the pair does not show what
the mode looks like.

**Terminal panels and type: a modest improvement with two text faults and some loss at the screen edges.** Status
chips, title bars, the lit tab, dashed disabled buttons and the teletype's bright newest line all help. Against that:
the two blocking wraps below, a dimmer top strip and command bar, and labels that lost their green key.

**Readability against the anchor.** Side, domain and certainty: yes, at a glance. Selected unit: yes. Text on its
field: legible everywhere, with the edge dimming noted in defect 8. Hidden or lost: one data-block line (defect 7),
and data blocks that now touch their glyphs (defect 4). Nothing is lost in glow.

**Register.** One phosphor family and one alarm red hold. Amber is the only new colour and it carries a meaning the
player needs (held but not identified); I found no colour that carries none. The glow, scanlines, edge dimming and
rounded glass stay inside the terminal register; nothing reads as a modern web effect. Nothing resembles another
game's art. The frame shapes follow the public military symbol convention and the silhouettes are plain originals.

**Icons before text (Ray's rule i).** The pass moves the right way: silhouettes in the glyphs, damage marks on the
glyph, status as chips. The one icon that was already in the text, the arrow in the weapons list, is the thing
defect 1 breaks.

**The font.** It reads as the same face made bolder with a soft glow, not as a chunkier face. Headings and chips,
which are bold, spaced and often inverse, look deliberate. Body text and the lists look like heavier JetBrains Mono
with a halo, slightly softer than BEFORE at real pixels. If Ray's "bulkier/chunkier font" meant a blockier terminal
face, this does not deliver it; if he meant heavier type, it does.

## Defects

### Blocking

1. **Weapons list: the arrow is split across two lines.** `after/09-missiles-combat-tab.png`, left panel, WEAPONS IN
   FLIGHT, rows 1 to 5 (x 20 to 190, y 290 to 480); the same in `pairs/10-hit.jpg`, right half, four rows. BEFORE read
   `>> INCOMING WEAPON → USS NIMITZ (CVN-` / `68)`. AFTER reads `>> INCOMING WEAPON -` / `> USS NIMITZ (CVN-68)`. The
   arrow is cut into a dash and a `>`, and the second line now starts with `>` under rows that start with `>>`, so
   five weapons read as ten entries. This is worse than BEFORE, and it sits in the alarm list a player opens during
   their first engagement.

2. **Victory debrief: record lines break inside the weapon name.** `pairs/27-debrief-victory.jpg`, right half, RECORD,
   the five red LAUNCH lines (x 665 to 1005, y 445 to 620). AFTER reads `...LAUNCHED 4× C-` / `802 NOOR AT USS NIMITZ
   (CVN-68)`, five times in a row, with the first line stopping a little past half the panel's width. BEFORE had an
   equal fault at the same place (`(CVN-` / `68)`), so this is a failed cure, not a new fault, but it is what the
   AFTER frame shows and a first player would see it.

   Defects 1 and 2 share a cause (the balanced wrap breaks at a hyphen) and should be fixed together.

### Minor

3. **Help: the X key is separated from its label.** `after/21-help.png`, KEYBOARD, the R / F / X row. The `X` key chip
   hangs alone at the end of the line (x 1090 to 1110, y 492) and `Weapons hold` starts the next line with no key
   (x 717 to 813, y 515). BEFORE read `X Weapons` / `hold`. The one-word last line is cured; the key lost its label.

4. **Data blocks placed above or below a glyph now sit on its rim.** `after/06-contacts-certainty.png`, COLE DDG-67
   block (x 725 to 820, y 192 to 238) covers the top of its own glyph, and the TN6040 DET block (x 992 to 1080, y 106
   to 152) touches the bottom of its glyph. The same for COLE in `after/02-plot-start.png` (x 888 to 980, y 622 to 653)
   and `after/05-own-unit-selected-close.png` (x 900 to 994, y 304 to 334). The glyphs are drawn larger than the box
   the label placement still uses. Blocks placed to the side touch the rim too, which reads as an attached tag and is
   acceptable.

5. **A course leader runs along the bottom of a data block.** `after/06-contacts-certainty.png`, TN7850 DET, third
   line `C090 S420 +70S` (x 765 to 800, y 490): the amber heading line from the glyph underlines `C090`. In BEFORE
   the block sat on the other side and the line was clear.

6. **A close formation merges at theatre zoom in the tilt view.** `pairs/15-mode-tilt.jpg`, right half, the carrier
   group at centre (x 1045 to 1230, y 425 to 490). The four larger glyphs chain into one another and cover part of
   the selected carrier's brackets. BEFORE was also crowded there, but the smaller cores stood apart.

7. **One data block shows less in AFTER.** `after/02-plot-start.png`, HORNET 102 (x 672 to 758, y 430), and the same
   in `pairs/01-briefing.jpg`: one line, where BEFORE shows `C350 S450 FL250` as a second line. The block also moved
   onto the Musandam coast beside KHASAB AIRPORT. The drawer reports this as run-to-run timing and did not prove it;
   as drawn, the right-hand frame shows less than the left.

8. **The screen edges are dimmer than BEFORE.** Every AFTER frame; clearest in `after/02-plot-start.png` top strip
   (y 0 to 42: the SANDKASTEN brand, the scenario name and the clock) and `after/09-missiles-combat-tab.png` command
   bar (y 1030 to 1075, including the active `5x` chip). The clock went from bright white to grey and the brand looks
   soft. All of it is legible, but the clock and the row the player clicks most are now the dimmest text on screen.

9. **Field labels lost their green key.** `after/02-plot-start.png` mission panel, WIN and LOSE (x 19 to 55, y 92 and
   129); `pairs/01-briefing.jpg` right half, PROTECT / WIN / LOSE; `after/28-debrief-defeat.png`, DECIDED BY and the
   four labels under it. BEFORE they were bright green beside white text. AFTER they are white bold beside white
   text, and in the mission panel WIN reads dimmer than the sentence it labels.

10. **Single word on the last line (Ray's rule ii), stacked data row.** `after/06-contacts-certainty.png`, COLE
    DDG-67 block, last row `DMG` (x 729, y 230).

11. **Single word on the last line, stacked data row.** `after/06-contacts-certainty.png`, TN1183 UNK block, last row
    `ESM` (x 857 to 940, y 79 to 106).

12. **Single word on the last line, stacked data row.** `after/06-contacts-certainty.png`, TN6945 UNK block, last row
    `+150S` (x 920 to 1001, y 624 to 655).

    Defects 10 to 12 are rows of a data block, not wrapped sentences, and BEFORE has the same rows. They are listed
    because the card asks for every instance. I found no wrapped text block ending in a single word in any AFTER
    frame of the set; the seven kinds the drawer lists as cured are cured in the frames I opened.

13. **Uneven spacing in a heading (also in BEFORE).** `after/09-missiles-combat-tab.png`, left panel, `//      COMBAT
    RECORD     3 ON RECORD` (x 20 to 340, y 549): a wide gap after the `//` that no other section heading has.

14. **Plot marks show outside the panels (also in BEFORE).** `after/02-plot-start.png`, left gutter (x 0 to 8) at
    y 455, y 585 and y 852; `after/09-missiles-combat-tab.png`, the strip between the panels and the command bar
    (y 1017). Small white and red ticks from range rings appear in the gutters around the frame.

15. **A range ring crosses a data block (also in BEFORE).** `pairs/17-mode-god-close.jpg`, right half, SINA 103 block
    (x 1197 to 1266, y 257 to 286): the dashed red ring runs through its right edge. `after/06-contacts-certainty.png`,
    TN8564 TRK block (x 1258 to 1375, y 579 to 619): the dashed ring runs through `CLASS` and `S30`.

16. **The help panel did not get the new frame.** `after/21-help.png`, the panel (x 700 to 1220, y 144 to 936) keeps
    its plain single border, while the debrief, the briefing, the unit panel and the side panels now carry the double
    rule and corner brackets. It looks like the one panel the pass missed.

## Not judged

- Motion. Hit, kill and launch are held frames; the pairs cannot show whether anything flashes or how an effect plays.
- The sixteen poses outside this capped set, and any viewport other than 1920x1080 at DPR 2.
- Speed, and anything about Ray's Mac.
- Whether defect 7 is timing or a result of the redraw.

## What Ray should be told

The new look is clearly better where it matters most: you can now tell at a glance what a contact is, whose it is and
how sure the sensors are, and the map no longer hides the units. It is going back to the drawer for one more short
round first, because two lists now break their text in the wrong place (the incoming-weapons list splits its arrow in
half, and the victory record splits "C-802"), and you should also know the font is the same one made heavier, not a
chunkier face.
