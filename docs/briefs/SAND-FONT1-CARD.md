**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-FONT1 — swap the terminal face for an 80s terminal font (BUILD, one owner, one end review)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 "re sandkasten art pass - the game looks good but the fonts look vibecoded - needs a more 80s/terminal looking font I think"
(GS-private pings inbox 2026-11-11 04:11 [ruling][sandkasten]: KEEP the art, change the font.)

grounded: newest = sandkasten main 61f7e7df (SAND-ART2 landed 2026-11-13 t729 on top of ART1 4da15de6). JetBrains Mono (OFL) is vendored in `public/fonts/jetbrains-mono/` and named in `src/app/play/terminal.css` (`@font-face` + `--tx-font`), `src/app/database/database.css` (`@font-face` + body stack) and the preload list in `src/components/terminal/TerminalPlay.tsx:40-41`. The classic MapLibre pages (IBM Plex via `ClassicFonts.tsx`, `globals.css`, `LayoutController.tsx`, `OsintLayer.tsx`) are OUT of scope.

MOVES: YES — delivers Ray's 11-11 font ruling on the art-pass look (SPEC "graphics and an experience drastically more player friendly than CMO"), the last look item before the WeGo plan-A check and the RC cold play toward first public EA.

## Build
1. Vendor THREE candidate faces as woff2 + licence file, each in its own `public/fonts/<face>/` dir, no remote font requests:
   **VT323** (OFL; `@fontsource/vt323` or Google Fonts source), **Glass TTY VT220** (public domain), **IBM 3270** (`3270font`, check its licence file and record it). If one is not obtainable under OFL/public-domain/BSD terms, replace it with Px437 IBM VGA only if CC BY-SA fits the repo's art/licence notes; else ship two candidates and say why.
2. Make the terminal face one CSS variable used by BOTH terminal.css and database.css (no JetBrains name left in either), with a dev/test override `?font=vt323|glasstty|ibm3270` so the three can be compared on the same build. Default = your best pick of the three after step 3. Update the TerminalPlay preload list to the default face only.
3. Retune metrics so nothing breaks at the new face: font-size / line-height / letter-spacing per face where needed. Ray's standing presentation rules (s425) apply at the new metrics: **no text block ends with a single word alone on its last line; no clipped or overflowing text; icons and known acronyms stay** (do not widen panels or change chrome geometry — the e2e "chrome never resizes the plot" test must stay green).
4. Capture the same five screens in each candidate at 1920x1080 AND 1440x900: briefing, plot, missiles, combat tab, god view (use the existing play/plot e2e helpers to reach them). Save to `docs/verification/sand-font1/<face>-<screen>-<w>.png` plus `REPORT.md` listing, per face and screen, any single-word last line or clipped text you found and fixed.
5. Update the e2e font test (vendored font, no remote fonts) to assert the new default face loads; add the per-face licence to README's credits/licence section and the terminal.css header comment. Remove `public/fonts/jetbrains-mono/` only if nothing references it any more (`git grep -n jetbrains` empty).

## Gates (the land battery the seat runs at harvest)
`npm test` (vitest; 355/355 today) and `npm run test:e2e -- --workers=2` (129 pass today; the WeGo plan-A combat-record red is a known separate item, not yours). Report the numbers you saw.

## Fence
- Fonts and text metrics only. No art, palette, layout geometry, scenario, simulation or game-logic changes. No merge to main; leave a dirty tree or commits on your branch for the harvester. Classic MapLibre pages keep IBM Plex.
- The look that picks the face is the seat's (one Opus look against Ray's words); your default is a proposal.
