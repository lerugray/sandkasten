SAND-ART1-R2 branch=sand/art-fable-r2 battery=126-PASS-1-OOM-KILLED-RERUN-PASS text_diff=empty blockers_fixed=2 minors_fixed=1 s3_open=3

# SAND-ART1 R2: the two wrap blockers

Base: `sand/art-fable-r1` @ `dae77a5` plus the R2 card (`e8d1cdb`). Host: WSL2, headless Chromium 147, WebGL on the
real GPU (`ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)`).
Nothing is committed or pushed; every change is in the working tree.

## Faked, skipped or unverified (read this first)

- **Chromium only.** The cure does not depend on a browser's wrap heuristics (see "What changed"), but I ran it
  in no other browser.
- **The poses are staged, as in round 1.** Same frame tool, same staging; nothing about that changed.
- **The line turns are now written into the text of three kinds of line** (weapon rows, debrief record lines,
  turn-review record lines) as newline characters. The words are identical. Two side effects follow: copying one of
  those lines out of the page carries the turn with it, and the E2E evidence files that store a record's `innerText`
  now hold a newline where the line turns.
- **The combat record in the left column still splits `C-802`** ("ARMED WITH C-" / "802 ANTI-SHIP MISSILES", visible
  in `09` and `10`). It did so in BEFORE as well. Its text is drawn by `src/components/game/CombatRecord.tsx`, which
  is outside the five files this round may touch, and no CSS wrap mode can forbid a turn after a hyphen (measured,
  see below). Left open; the cure is to pass that text through the same function.
- **The help cure rests on the browser's balanced wrap**, because `HelpPanel.tsx` is also outside the five files.
  It is right in Chromium at 1920x1080 and 1280x720 (checked row by row); another browser may balance differently.
- **I did not watch the first frame a weapon list or debrief appears in.** The line width is measured when the list
  mounts and the turns are applied in the same commit, which should land before paint; I did not capture that frame
  to prove no single frame shows the browser's own wrap.
- **The new spec's two window sizes exercise nearly the same column widths** (the left column is 344 px at both; the
  debrief is 640 px at both). The measurement adapts to width, but no narrower layout was shot.
- **Not updated:** README.md and SESSION_NOTES.md (on the SAND-THREAT-1 file list, as in round 1). No user-facing
  feature was added.
- **AGENTS.md does not exist in this repo.** `docs/art-fable-r1/LOOK.md` and `REVIEW.md` are not in this tree either;
  I worked from the card's description and the R1 frames.
- **Battery side effects undone:** `next-env.d.ts` and the older lanes' evidence under `docs/verification/` are
  restored to the base version after the run, as in round 1.

## What changed

Files: `src/components/terminal/TerminalPlay.tsx`, `src/app/play/terminal.css`. New: `tests/sand-art1-wrap.spec.ts`,
`docs/art-fable-r2/`, `docs/handoffs/sand-art-fable-r1-frames/after-r2/`. No simulation, AI, scenario, save-codec or
SAND-THREAT-1 file is touched. No dependency, no font file, no new screen. JetBrains Mono is kept as it was.

### Cause

Round 1 set `text-wrap: balance` on weapon rows and record lines. A browser may turn a line after a hyphen, and the
balanced wrap picked those turns: `-` / `>` inside the arrow, `C-` / `802` inside the weapon id. BEFORE had the same
class of fault with the ordinary wrap (`(CVN-` / `68)`).

I measured every CSS wrap mode Chromium offers against these strings across line widths of 18 to 80 characters
(ordinary, `balance`, `pretty`, `word-break: keep-all`, `line-break: strict`, `hyphens: none`). Each one turns after
a hyphen at some width. CSS has no way to forbid that turn inside a run of text.

### Blocker 1: weapons list (fixed)

- `TerminalPlay.tsx` now chooses where a weapon row turns (`turnAtSpaces`): at spaces only, fewest lines, then the
  narrowest measure that keeps that count. The carrier's row reads `>> INCOMING WEAPON ->` / `USS NIMITZ (CVN-68)`.
- The second line hangs 3 characters in, under the weapon's name and clear of the `>>` column. One mark, one weapon:
  seven weapons read as seven.
- Rows that fit on one line are unchanged (`>> RGM-84 Harpoon -> TN7865 DET`).

### Blocker 2: debrief RECORD (fixed)

- The same function turns debrief record lines and the turn-review record lines (they share the class). The launch
  lines read `06:00:00Z LAUNCH TN2103 TRK LAUNCHED` / `4x C-802 NOOR AT USS NIMITZ (CVN-68)`: the count stays with
  its weapon, the weapon id and the hull number stay whole.
- Longer entries (the INTEL paragraphs) are turned by the same rule, so they keep the even look round 1 gave them.

### How the line width is known

The face is monospace, so a line's capacity is its width divided by one character. A hidden zero-height probe inside
each list (`Measured`, class `tx-cols`) is as wide as the list and holds a rule 10ch long; a `ResizeObserver` watches
both, so a window resize, a scrollbar or the web font arriving re-measures. The count is rounded down, so a line
never overruns. If the measurement were ever wrong, the browser's ordinary wrap still applies on top (`pre-line`),
so text cannot be clipped or lost.

### Minor 3: help key chip (fixed, CSS only)

Rows that hold key chips now use the balanced wrap (`.tx-root .space-y-1 > div:has(> kbd)`). `X` sits with
`Weapons hold` again: `R Cycle rules of engagement` / `F Weapons free  X Weapons hold`.

Two other help rows turn at a different place as a result; the words are unchanged:

| Row | R1 | Now |
|-----|----|-----|
| Space | "...(WeGo: only while a / turn resolves)" | "...the simulation / (WeGo: only while a turn resolves)" |
| Enter | "...the next turn after / the review" | "...commit orders, then / start the next turn after the review" |

### Minor 4: font

Kept JetBrains Mono. No one-line change suggested itself that R1 had not already made (bold, 0.32 px stroke, glow),
so nothing was changed.

## Proof

### Frames

Re-shot with the R1 frame tool, 1920x1080 at DPR 2, into `docs/handoffs/sand-art-fable-r1-frames/after-r2/`.
Only the touched poses are kept as frames:

| Pose | Frame | Shows |
|------|-------|-------|
| 09 missiles, combat tab | `after-r2/09-missiles-combat-tab.png` | weapons list |
| 10 hit | `after-r2/10-hit.png` | weapons list during a hit |
| 21 help | `after-r2/21-help.png` | key chips |
| 26 WeGo review | `after-r2/26-wego-review.png` | turn-review record lines |
| 27 victory debrief | `after-r2/27-debrief-victory.png` | RECORD |
| 28 defeat debrief | `after-r2/28-debrief-defeat.png` | RECORD |

For each pose `after-r2/pairs/` holds `NN-pose.jpg` (BEFORE left, R2 right, half size) and `NN-pose-crop.png` (the
touched text from BEFORE, R1 and R2 side by side at real pixels). Tool: `docs/art-fable-r2/tools/pairs_r2.py`.

Re-shoot: `SAND_ART_SET=after-r2 npx playwright test tests/sand-art1-frames.spec.ts -g "missiles in flight|debrief|WeGo planning|briefing, start"`
(this shoots every pose of those five tests; I deleted the frames of the untouched poses and kept their text).

### Text held

`python3 docs/art-fable-r1/tools/textdiff.py before after-r2`, output in `docs/art-fable-r2/text-diff.txt`. The R1
tool is unchanged.

- **0 strings differ, exactly, in all 27 poses shot** (the five tests above cover 27 of the 32 poses). Against the R1
  AFTER set: 0 as well.
- **One-word last lines new in R2: 0.** Still present: 0. The cures against BEFORE are the ones round 1 listed
  (mission WIN line, mission progress line, weapon rows, combat record entry, debrief record lines, the help row).
  No further single-word-last-line cure was made this round.
- The tool collapses whitespace before it compares, as it did in round 1 ("line breaks never enter the comparison"),
  so a newline in place of a space compares equal. That is why the proof is empty although three kinds of line now
  carry their turns in the text.

### New regression spec

`tests/sand-art1-wrap.spec.ts`, 4 tests in the ordinary battery (about 7 s): at 1920x1080 and 1280x720 it stages
weapons in flight and a victory debrief, reads the lines as drawn, and fails if any line turns inside a word, if a
weapon row's later line starts with `>`, or if a launch line loses `C-802 NOOR AT USS NIMITZ (CVN-68)`.

Run against the R1 versions of the two product files it fails 4 of 4, naming the two blockers
(`>> INCOMING WEAPON - | >` and `...LAUNCHED 4x C- | 8`); against this tree it passes 4 of 4.

### Battery

`npm test` is `vitest run && playwright test`. Run on the final tree on this host. The WSL GPU flags
(`--mute-audio --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist`, with
`GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`) came from a config file outside the repo; nothing
host-specific is in the repo's Playwright config or source. No `--disable-gpu` retry was needed.

- **vitest: 26 files, 331 tests, all passed.**
- **playwright, full run: 126 passed, 1 failed, 12 skipped, 14.8 min.** There is no single all-green full run.
  - The one failure is `sand-osint-1-overlap-map.spec.ts:20` (/map at 1920x1080): `worker process exited
    unexpectedly (signal=SIGKILL)`. The kernel log names the cause: this lane's memory cap killed the worker
    (`Memory cgroup out of memory: Killed process (node)`, cgroup `lane-co3-sandart1r2-t495`). The test asserted
    nothing before it was killed. `/map` is the legacy MapLibre view, which does not load either changed file.
  - **That spec re-run alone: 2 of 2 passed** (1440x900 and 1920x1080).
  - The 12 skipped are the ten capture tests (skipped without `SAND_ART_SET`) and two `sand-osint-1-frames` tests
    that skip at base as well, the same twelve as in round 1.
  - The 4 new wrap tests are in the 126.
- Log: `docs/art-fable-r2/battery.txt` (web-server chatter removed, absolute paths shortened).
- `tsc --noEmit`: only the three errors in `tests/sand-001-unit-placement.spec.ts` that the base already has.

That was the third attempt. The two before it, in order:

1. A dev server I had started by hand went away part-way through (56 passed, then every test failed on a refused
   connection). Most likely the same memory cap; I did not confirm it for that process. Round 1 saw the same thing.
2. I let Playwright start the server, but from my out-of-repo config it started in the wrong directory and exited
   at once; no test ran. Fixed in the out-of-repo config (the server's working directory), not in the repo.

## Review S3 left open

1. **Sprite scale against the milsymbol layout box** (`TacticalPlot.ts`, the glyph is drawn about 1.3x its layout
   box). No one-line fix is obvious: round 1 found that enlarging the layout box moves labels and breaks the text
   proof. Left for a later round.
2. **Glyph cache is not cleared mid-play.** Left as it is, per the card.
3. **Combat record entries can still turn at a hyphen** (`CombatRecord.tsx`, see the top section). Pre-existing in
   BEFORE; needs one call to the new function in a file outside this round's list.

## Steering

`STEER.md` was checked at each checkpoint and before each long command. It never existed, so no steer entry was
acted on.
