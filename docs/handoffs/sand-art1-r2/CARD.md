This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it

ANCHOR: SPEC.md line 1 (Ray): "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO."
RAY-ASK: 2026-11-10 09:16 "i figure the fable graphics pass should probably apply to sandkasten as well if its not already"
MOVES: Sandkasten first public EA build (ship board row 14). Round-2 closes the two text-wrap blockers that kept the R1 look from PASS so GS can stage the before/after pairs for Ray's keep/revert.
grounded: base = sandkasten `sand/art-fable-r1` @ `dae77a5` (R1 harvested AS FOUND); look REJECT `docs/art-fable-r1/LOOK.md` @`8b461ff9` OPENED 30/30, 2 blocking; Cursor review ACCEPT `docs/art-fable-r1/REVIEW.md` @`b873614` S1=0 S2=0 S3=3. R1 card `docs/briefs/SAND-ART1-FABLE-CARD.md`.

# SAND-ART1 R2: fix the two look blockers (one Fable drawer, BUILD shape)

You are the drawer. Model: Fable 5.2. Branch `sand/art-fable-r2`, cut from this brief (dae77a5 plus this card). Cap: 5400 s. FIX-lane: do NOT commit or push; leave edits in the tree. Write `docs/art-fable-r2/REPORT.md` early. Launch every browser with `--mute-audio`.

## Must fix (look blockers; shared cause: balanced wrap breaks at a hyphen)

1. Weapons list arrow split across two lines. Evidence: `docs/handoffs/sand-art-fable-r1-frames/after/09-missiles-combat-tab.png` and pairs `10-hit.jpg`. AFTER reads `>> INCOMING WEAPON -` / `> USS NIMITZ (CVN-68)` so five weapons read as ten. Cure so each weapon is one line (or a deliberate wrap that does not invent a second `>` entry). Do not change what the list says.
2. Victory debrief RECORD lines break inside the weapon name. Evidence: pairs `27-debrief-victory.jpg`. AFTER reads `...LAUNCHED 4× C-` / `802 NOOR AT USS NIMITZ (CVN-68)`. Cure so the weapon id stays intact on one line (or wraps only at a word boundary that does not split `C-802`).

## Worth fixing if cheap (look minors that share the wrap/layout work)

3. Help: `X` key chip separated from `Weapons hold` (`after/21-help.png`).
4. Prefer keeping JetBrains Mono unless a one-line CSS change restores phosphor weight without a new font file; do not add a font file.

## Review S3 (fix only if it does not expand scope)

- Sprite scale vs milsymbol layout box (`TacticalPlot.ts` ~1882 vs ~1271): only if a one-line declutter fix is obvious; otherwise leave for a later round and name it in the report.
- Do not clear the glyph cache mid-play unless dispose already runs and a one-liner is safe.

## Frozen

- Simulation, AI, scenarios, save codec, SAND-THREAT-1 files: untouched.
- No new npm dependency, no new font file, no new screen.
- Visible-string proof must stay empty apart from single-word-last-line cures you list in the report.
- Stay inside the five R1 product files plus CSS if needed: `src/app/play/terminal.css`, `src/components/terminal/TerminalPlay.tsx`, `src/lib/plot/TacticalPlot.ts`, `src/lib/plot/palette.ts`, `src/lib/plot/symbolTextures.ts`.

## Prove

Re-shoot ONLY the touched poses into `docs/handoffs/sand-art-fable-r1-frames/after-r2/` (or overwrite a clearly named r2 set): missiles-in-flight / combat-tab weapons list, hit, victory debrief RECORD, and help if you touched it. Run the existing author battery the R1 report used (or the focused glyph/frame specs). Report: what changed, frame proof paths, text-diff empty check, any S3 left open.

Leave the tree dirty for harvest. Final chat response under 300 words.
