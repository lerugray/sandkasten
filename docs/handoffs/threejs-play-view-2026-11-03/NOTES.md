# NOTES: /play rebuilt in Three.js, terminal register

Lane sand-threejs-play-s386, 2026-11-03. Working tree only, nothing committed.

## What changed
- `/play` is a full-window Three.js plot (`src/lib/plot/TacticalPlot.ts`, hosted by
  `src/components/plot/PlotView.tsx`) under terminal chrome (`src/components/terminal/`,
  `src/app/play/terminal.css`). The simulation, AI and data layers are untouched; the page
  uses the same `useSimulation` / `useInfoWar` hooks and the same Order, Detail, Contact,
  Combat, Message, Media and Help components, restyled by CSS variables scoped to `.tx-root`.
- `/play?map=legacy` renders the old MapLibre page (`src/app/play/LegacyPlay.tsx`, moved
  unchanged except for the font loader). `/editor` and `/` keep MapLibre.
- `three` pinned at `0.187.0` (plus `@types/three` `0.187.0`, dev).
- The root layout no longer loads Google Fonts. The MapLibre pages load IBM Plex through
  `src/components/ClassicFonts.tsx`; `/play` loads only the vendored font.

## Palette (hex)
| Role | Hex |
|---|---|
| Field (near-black) | `#020604` |
| Land fill | `#08200f` |
| Phosphor, primary | `#4cf58e` |
| Phosphor hi (body text emphasis, missile heads) | `#cfffe0` |
| Body text | `#b9f4cf` |
| Dim phosphor (labels, unknown tracks) | `#3fbf74` / `#2b9e5c` |
| Rules | `#1d5c37` |
| Alarm | `#ff4b3a` |

One hue (phosphor green) for everything friendly and for chrome; one alarm red for hostile
tracks, enemy launches, hits, losses and autopause. Neutral and unknown use dimmed phosphor.

## Font
JetBrains Mono 400 and 700, latin subset woff2, from `@fontsource/jetbrains-mono` 5.3.0,
vendored in `public/fonts/jetbrains-mono/` with its SIL Open Font License 1.1
(`public/fonts/jetbrains-mono/OFL.txt`). Served same-origin; no remote font requests on /play.

## Map data
Natural Earth 10m (public domain) and NOAA ETOPO1 (public domain), clipped into a 78 KB
`src/lib/plot/data/hormuz-geo.json`; sources in `src/lib/plot/data/SOURCES.md`, rebuild with
`node scripts/build-plot-geo.mjs <download dir>`.

## What moves (all code-drawn, all tied to game state)
- Radar sweep: a rotating beam with afterglow on every unit whose radar is active (4 s period).
  With `S` on, friendly ships sweep their full radar range, faintly, over the coverage circles.
- Tracks glide between simulation updates (260 ms interpolation) instead of stepping at 4 Hz.
  Contacts do not glide: they jump to each new sensor report and pulse once when painted.
- Track history dots behind units and contacts; flight trails behind missiles.
- Contacts fade with data age (full for 15 s, down to 30% at about 2.5 min).
- Missiles: bright head, course tick, dashed line to the target (or to the contact standing
  in for it under fog of war).
- Intercept: a small white ring and cross, 0.65 s. Hit: alarm burst with radial ticks, 0.9 s.
  Kill: a larger burst, 1.4 s. One-shot, no strobing.
- Camera: drag-pan with inertia, wheel zoom eased toward the cursor, a glide to any unit picked
  from the forces list, and `T` easing into a 54 degree tilt with NOAA relief (7x vertical),
  wireframe sensor domes and aircraft lifted to altitude on drop lines.
- Teletype: each new traffic line prints in character by character (CSS `steps()`, once).
- Restrained bloom (strength 0.32), vignette, faint scanlines over everything.

## Behaviour checklist (checked in the running game on this host)
| Item | Result | How checked |
|---|---|---|
| Select a unit, see Info/Sensors/Weapons | PASS | design-system unit-selected test, checklist probe clicked all three tabs |
| Shift+click pins range rings | PASS | probe Shift+clicked Nimitz on the plot: SNS 175NM / WPN 11NM rings stay after deselect, list shows the pin mark |
| `S` sensor coverage | PASS | probe: 8 coverage circles from radar-active friendlies; tilt-3d.png |
| `M` measure distance and bearing | PASS | probe: two plot clicks give "120.0 NM / 222.2 KM • 126°" banner and on-plot label |
| `G` God mode | PASS | sand-005 (8 tracks to 16, uncertainty circles gone); probe |
| Waypoints and the four throttle settings | PASS | sand-006, simulation "waypoint mode" |
| Time controls (pause, 1x-60x) | PASS | simulation clock, sand-002/003/004; keys 1-6 probe |
| Autopause: new contact, damage, incoming weapon, intel message | PASS | sand-004; probe saw NEW CONTACT, INCOMING WEAPON, NEW INTEL MESSAGE holds; friendly damage/loss holds come from the unchanged autopause code (Hornets were lost under autopause in the probe run) |
| Classification Unknown -> Detected -> Classified -> Tracked, and fading | PASS | sand-002; probe saw UNK, DET, TRK; plot fades by age |
| Missile launch, flight, intercept, damage states | PASS | sand-003; first-screen.png and motion.webm show Phoenix salvos in flight, DEFD/HIT/KILL traffic |
| Combat log | PASS | sand-003, simulation "combat log" |
| Help panel | PASS | smoke help test; help lists the new keys and mouse controls |
| InfoWar tab (empty without Ollama) | PASS | probe: Media tab shows DISCONNECTED and the setup hint |
| Light theme | Dropped on /play | The terminal register has no light variant. Light theme still works on `/`, `/editor` and `/play?map=legacy`. |

## Tests
- Before: 35 tests, 35 passed (baseline run of `e874ad0` on this host, same GPU recipe).
- After: 36 tests, 36 passed (final run on the working tree).
- Behaviour specs keep their assertions; only selectors changed (`.maplibregl-map` handle to
  the plot handle on `[data-testid="tactical-plot"]`, `.maplibregl-marker` to
  `[data-testid="plot-track"]`, `.w-80 button.w-full` to `[data-testid="force-row"]`,
  `map.fire("click")` to `plot.clickAt`). The plot handle reports what the scene actually draws:
  `getSource("weapon-tracks")` exists only while visible weapons fly, `contact-uncertainty`
  only under fog of war.
- design-system.spec.ts: the old-look checks are replaced, per the 11-03 ruling. Light-theme
  screenshot became a tilt screenshot; blue-accent became phosphor-primary; IBM Plex became
  "vendored JetBrains Mono is loaded and used"; MapLibre zoom controls became "chrome overlays
  do not resize the canvas"; new "no remote font requests on /play".
- `npm run build` passes. `tsc` is clean apart from three pre-existing errors in
  `tests/sand-001-unit-placement.spec.ts` (unchanged file). The repo has no ESLint config.

## Captures (frames/)
Headless Chromium 153.0.8010.12 (Playwright's cached headless shell build 1243) with
`--mute-audio --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist` and
`GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`, passed through the
environment to `capture.mjs` (no host flags in the repo).
- `renderer.txt`: ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1).
- `fps.txt`: median 59.9, 5th percentile 59.9 over 10 s at 1440x900 DPR 2 with weapons in flight
  (vsync-bound; 599 frames).
- `first-screen.png`: 1440x900 DPR 2. Run at 60x with autopause off until the first salvo is in
  the air, then 5 s at 10x. The opening salvo is Iranian Phoenix missiles at the Hornets; at 10x
  from 06:00 it would take minutes of wall time to reach.
- `unit-selected.png`, `tilt-3d.png` (with `S` on), `motion.webm` (8.2 s, VP9: salvo, pan with
  coast, zoom to the strait, tilt up and back), `console-errors.txt` ("none").
- Rerun: `CHROMIUM_EXECUTABLE=... CHROMIUM_ARGS="..." node docs/handoffs/threejs-play-view-2026-11-03/capture.mjs full`
  with the dev server on :3001.

## Small fixes outside the view, to meet "no console errors on /play"
- `/api/platforms?id=...` returns `null` (200) instead of 404 when the gitignored local platform
  database is not installed, so the detail panel degrades without browser errors. Search and
  `status` responses are unchanged.
- The InfoWar Ollama health check goes through a same-origin `/api/ollama/tags` route (loopback
  hosts only) instead of a direct browser fetch, so a stopped Ollama is no longer a refused
  connection in the console. Generation requests still go to Ollama directly, as before.
- `formatMeasurement` moved to `src/lib/map/measure.ts` (re-exported from MeasurementLayer) so
  /play does not pull MapLibre into its bundle.
- `DetailPanel` takes an optional `className`; `ContactList` an optional `contactLabel`
  (the plot and list both show track numbers like TN4127); `HelpPanel` a `terminal` flag for
  the extra keys. Defaults keep the legacy pages identical.

## Known gaps
- Unit selection by clicking a contact is not offered (contacts are not selectable, as before).
- Grid labels and data blocks are DOM text over the canvas, so bloom and scanlines treat them
  slightly differently from the drawn plot (text gets a CSS glow instead).
- In tilt mode the data blocks stay screen-aligned and the declutter works in screen space;
  dense clusters at the far edge can still crowd.
- The teletype shows the newest 6 lines and ellipsizes long intel text (full text in the Intel
  tab and on hover).
- Relief is ETOPO1 at 0.1 degree, so the tilted coast is approximate next to the 10m coastline.
- This host's Playwright 1.59.1 expects Chromium build 1217, which is not in the cache; both the
  baseline and final suite runs used the cached build 1243 through a lane-local config outside
  the repo. `npm test` with the repo config needs 1217 installed (host rule: lanes don't install).
- No AGENTS.md exists in this repo; the brief and CLAUDE.md were followed.

## Round 2 (GS seat follow-up, 2026-11-03, on top of WIP 0e5391b)

### LOOK S2
1. **Labels through the chrome: FIXED.** The chrome bands (top bar, side panel, track panel, traffic strip, command bar, banners, autopause popover, briefing) are now opaque, and each is marked `data-plot-occluder`. The plot re-reads their rects five times a second, and no data block, grid label, ring label or waypoint label is drawn where it would touch one.
2. **Sliced labels under panels: FIXED.** A block tries its eight slots against the chrome first. If none is clear, the block is hidden, never cut. A glyph under a panel takes its label with it. Grid labels under a panel are hidden.
3. **Tilt leaders and declutter: FIXED.** Leaders are now a screen-space SVG overlay, exact at any tilt. In tilt every block gets a thin leader to its glyph; in flat view only pushed-out blocks do. The declutter now scores against every glyph at its real sprite size, live missile heads (36 px), hit/intercept bursts still in flight, ring/waypoint labels and grid labels, not only other blocks. When no slot is clear, a block drops to its first line. If even that lands on another label, an enemy or unknown track's block is hidden; friendly units and the selection always keep theirs.
4. **Missile bloom on a label: FIXED.** Same mechanism: missile heads and effect bursts are obstacles.
5. **Briefing cut off: FIXED.** A `[ BRIEFING ]` card shows the scenario's opening message (OPERATION SENTINEL PASSAGE, the full objective and ROE) at load, in the register (`briefing.png`). The first key or click anywhere, or starting the clock, dismisses it. It never swallows that input: the key or click still does its job. The text comes from the scenario's ScenarioLoaded event, so other scenarios get their own.

### LOOK S3
6. **CSR placeholder: FIXED.** Shows a clean `--` off the map.
7. **True enemy names in messages: FIXED.** Traffic, the combat log and the weapons-in-flight list name an enemy only once its contact carries a classified platform name, the same rule as the contact list and the plot. Before that it is `TN#### CLS` (for example "TN7609 DET LAUNCHED 2x AIM-54A PHOENIX AT HORNET 102"), or UNKNOWN TRACK if no sensor holds it. God mode shows true names. The sim only sets a name when a contact is first detected at classified range; a contact upgraded to TRK later keeps its track number.
8. **Domes too faint: FIXED.** Domes now draw in phosphor at 0.3/0.24 line strength, scaled by 1/sqrt(emitters) with a floor, so they read without washing the plot (`tilt-3d.png`).
9. **ESM note wrap and no scroll cue: FIXED.** "(emitting — detectable by ESM)" sits on its own line under the radar button. The side panel shows a `-- MORE --` pager bar while content continues below, and the scrollbar thumb is brighter.

### Review notes
1. **Test handle reports the drawn scene: FIXED.** `getSource` / `getLayer` / `drawnTracks` now read counters the frame fills as it draws: weapon target lines and heads, waypoint paths and marks, uncertainty discs and edges, coverage discs and edges, and visible unit/contact sprites. Two tests got stronger, not weaker:
   - **sand-005** now runs the sim until uncertainty circles are actually drawn under fog, then checks God mode raises both the DOM track count and the drawn unit-sprite count and removes the drawn circles. Before, it checked removal at t=0 with no contacts, which could not fail.
   - **sand-006** now requires the drawn path (one line plus three marks) where it previously only checked that the plot existed.
   - **Break test, done:** I temporarily broke the engine three ways at once: weapon tracks not drawn, uncertainty drawn even in God mode, waypoints not drawn. Then I ran sand-003/005/006. All three FAILED at their drawn-state assertions: sand-003 line 39 (`hasWeaponSource`), sand-005 line 56 (uncertainty still drawn after G), sand-006 line 41 (`featureCount: 4`). The engine was restored from a backup and verified byte-identical (md5), and the full suite then passed.
2. **Detected contact used the true domain: FIXED.** The sim does not report a contact's domain at detection: `Contact` has no domain field, and `actualUnitId` is the hidden truth. UNK and DET contacts now get the 2525 unknown-dimension frame (SIDC dimension Z). Only CLS/TRK show the platform's domain and function. Kept as-is: a friendly missile's target line ends at the contact the player fired on. That is player knowledge, not a leak.
3. **Unbounded `seenEvents`; per-frame allocation: FIXED.** The set became a last-seen-id cursor into the append-only combat log, so the memory is constant. `toScreen` and `groundAt` reuse vectors, and callers that need two points at once pass two distinct buffers.
4. **WebGL context leak on remount: FIXED.** `dispose()` calls `renderer.forceContextLoss()` before `renderer.dispose()` and removes the leader overlay.

### Round 2 numbers
- **Tests:** 36 of 36 passed (lane-local GPU config, headless shell 1243, RTX 3050), with no tests added or removed. sand-005 and sand-006 assert more than before.
- **Build:** `npm run build` passes.
- **Frames:** all re-captured under the same names, plus `briefing.png`. `fps.txt`: median 59.9, 5th percentile 59.5. `renderer.txt` names the NVIDIA GeForce RTX 3050. `console-errors.txt`: none. `motion.webm`: 8.1 s.
- **Still open:** in a dense hostile cluster in tilt, two contact blocks can sit edge to edge (touching, not stacked). The traffic strip still ellipsizes long lines; the full text is in the Intel tab and on hover, and the objective is on the briefing card.

## Round 3 (s387 seat, ROUND3.md: label declutter in dense clusters)

### How the placement works now
The per-block slot scoring is replaced by `src/lib/plot/labelPlacer.ts`, pure screen-space geometry with hard rules. A candidate spot is legal only when all of these hold:
- the block is clear of the chrome and the canvas edge;
- it clears every placed block (2 px), every other glyph, missile heads and live bursts, every weapon track line, and every leader already drawn;
- if it has a leader, the leader clears every other block, never crosses another leader, and never touches another glyph's drawn symbol (16 px core);
- if it has no leader, it is nearer its own glyph than any other glyph; otherwise it gets a leader.

Blocks degrade in the card's order, each step stable frame to frame:
1. Full block beside the glyph.
2. First line only beside the glyph.
3. First line on a leader out to clear space, searching 5 rings x 24 directions, preferring the side facing away from the local cluster.
4. Hidden.

Who keeps a label:
- Placement order is selection, friendly units, classified hostiles (CLS/TRK), DET, UNK. Each block keeps last frame's spot while it stays legal, and only moves up a tier after the better spot has been free for 24 frames, so there is no jitter as the clock runs.
- Keep tracks (selection, friendlies, CLS/TRK) search four more rings, out to 410 px.
- If a keep track still finds nothing, a repair pass re-places the frame with it first, trying three orders for everyone else, and keeps the pass with fewest losses. Memory then holds that layout.
- Unknowns are hidden first.

### S2
1. **Leaders crossing other labels: FIXED.** Hard rule; the audit counts 0 leader-through-block and 0 leader-leader crossings.
2. **Leader through another block while moving: FIXED.** Same rule; held over 120 s of 60x motion.
3. **Blocks overlapping in tilt: FIXED.** Hard rule; the audit counts 0 overlaps in flat and in tilt (`dense-tilt.png`).
4. **Weapon track lines through blocks: FIXED.** Weapon target lines and course ticks are recorded in screen space as they are drawn; blocks may not touch them. Missile heads and bursts stay obstacles.

### S3
5. **Grid labels overprinting: FIXED.** Grid labels are resolved every frame and yield to blocks, leaders, glyphs, weapon lines, ring labels and each other (audit `gridOverlaps` 0).
6. **Ring lines through grid and scale text: FIXED.** Grid labels and the scale readout now have an opaque backing, so rings pass under the text. The scale readout is also an occluder that labels avoid.
7. **Sina 102 without a block: FIXED.** It is a classified hostile, so the keep rule and repair pass apply. The audit's `keptHidden` (keep tracks on screen without a block) is 0.
8. **Objective unreadable after the briefing: FIXED.** The objective is pinned at the top of the Intel tab ("// BRIEFING", OPERATION SENTINEL PASSAGE, full text), and `B` or the new `[B] BRIEF` command reopens the card; the help panel lists the key.
   - Root cause, a sim issue: the scenario's ScenarioLoaded trigger only fires while sim time is within 1 s of the start (`events.ts`). At 60x the first 50 ms tick already advances 3 s, so the opening message never fires at fast speed; at 1x/10x it does.
   - I left `events.ts` alone; it belongs to the sim-fix card. The pinned entry shows whenever that message is missing from Intel, so the objective is readable either way.
9. **Review notes: FIXED.**
   - Chrome rects are invalidated at once on resize and on any DOM change in the play view (MutationObserver), not after up to 200 ms.
   - Block sizes come from measured font metrics (probe at start and again once the vendored font loads), so there is no `offsetWidth` read per frame.
   - The label pass reuses its arrays, rects and segments. It allocates only the committed rects and, on the rare repair frames, a memory snapshot.

Also: when a unit is selected, the view centre now eases left to make room for the track panel (principal-point shift; the canvas never resizes). A selected group no longer sits against the panel edge.

### Proof
- **Measured check: `tests/plot-labels.spec.ts`, new, in the suite.**
  - What it does: autopause off, a unit selected (rings and ring labels on), sim at 60x. It runs 60 s flat, then tilts and runs 60 s. Every 200 ms it calls the plot's `labelAudit()`.
  - How the audit is independent: it takes every visible block's rect from the DOM (`getBoundingClientRect`), and the leaders, glyphs and weapon lines from what the frame drew. It counts block overlaps, leaders through other blocks, leader crossings, leaders through other glyphs, weapon lines through blocks, ambiguous pairings, grid overlaps and hidden keep tracks.
  - It asserts all are zero, and that the run exercised dense frames, weapon lines and leaders.
  - Final suite run (under full parallel load), as printed: `{"samples":580,"denseSamples":580,"weaponSamples":75,"leaderSamples":580,"maxBlocks":10,"minClosestGlyphs":6,"blockOverlaps":0,"leaderThroughBlock":0,"leaderCrossings":0,"leaderThroughGlyph":0,"weaponThroughBlock":0,"ambiguousPairing":0,"gridOverlaps":0,"keptHidden":0}`. Every sample had two glyphs closer than 40 px.
- **Break test, done twice.** Each time I removed the placer's block-block check and its weapon-line check, ran the spec, and restored the file from a backup; md5 verified byte-identical, no markers left.
  - Earlier placer: the spec failed with `blockOverlaps` 684 and `weaponThroughBlock` 100.
  - Final placer: the spec failed with `blockOverlaps` 341. The weapon break produced 0 hits in that run, because the missile-head and leader rules happened to keep blocks off the lines.
- **Frames:** all re-captured under the same names (`first-screen.png`, `unit-selected.png`, `tilt-3d.png`, `briefing.png`, `motion.webm` 8.2 s, renderer/fps/console files) plus `dense-tilt.png`.
  - `dense-tilt.png` is tilted and zoomed at the densest contact group (8 contacts within 120 px), with the audit at capture in `dense-tilt.txt`: 16 blocks, 13 leaders, 0 violations.
  - I looked at every frame and at a contact sheet of the motion clip.
- **Tests:** 37 of 37 passed (36 before plus `plot-labels`) on the lane GPU config. An earlier full run in this round failed 1 sample in 579 (`keptHidden` 1, a CLS contact in the top-left corner pocket). That led to the three-order repair; the final run is clean.
- **Build:** `npm run build` passes.
- **fps:** median 59.9, 5th percentile 59.9 (1440x900 DPR 2, RTX 3050).
- **Console errors:** none.

### Known limits
- Dense clusters now show first-line labels with leaders more often than full blocks, for example the five-ship carrier group at default zoom. That is the card's degrade order; zoom in and the full blocks come back.
- The audit's "glyph" test for leaders uses the drawn 16 px symbol core, not the 22 px texture frame. Ships 25 px apart have overlapping frames, so no leader could leave one without touching a neighbour's frame.

## Round 5 (ROUND5.md, s386-r4 + r4-r2): CRT display mode, label pairing, smoothness

### Built
- Three display modes, `V` cycles (`DISPLAY` on the command bar), saved per viewer in localStorage
  (`sandkasten.display`, try/catch), mode name flashes in the top bar.
  - CRT (default): Px437 IBM VGA 9x16 (VileR, CC BY-SA 4.0, `public/fonts/px437-ibm-vga/LICENSE.TXT`, credited in
    Help > Credits), 16 px minimum, double-rule frames, inverse-video selection, static block cursor, grid at 8% (`L` toggles),
    one phosphor with brightness for hierarchy (hostile = bright, unknown = dim, by shape), alarm only for incoming
    fire and hits, one CRT shader pass (glow + vignette), CSS scanlines at 10%, bezel.
    Font pick: Px437 over VT323. Px437's strokes are heavier and its 9x16 cells read cleanly at 16 px; VT323 needs
    20 px and its thin strokes blur under the glow. A comparison frame is scripted (`capture.mjs`, `font-compare.png`) but
    not yet captured.
  - CURRENT: round 3 unchanged (bloom chain, JetBrains Mono).
  - ADMIRALTY DUSK (OFF-SIGNATURE, Argon's spec): slate field, matte inks, IBM Plex Mono (OFL), knocked-out hollow
    symbols, haloed labels on #4A5564 leaders, no effects. Sizes raised to the project floor (14 px body, 12 px labels).
- Labels: pairing ratio 0.6 (the next symbol is at least 1.67x farther, which reads at a glance), a leader beyond 24 px,
  8 px minimum leader, distances from the drawn symbol. One naming rule for map, list and traffic. The BRIEF button now
  toggles; the MutationObserver ignores the plot's own writes; Memory is deep-cloned before a repair; repair is bounded
  to one extra pass per frame.
- Smoothness: DPR cap 2 with an adaptive render scale (0.5-1, drops after 1 s over 20 ms, recovers after 3 s under
  14 ms), chrome rect reads moved out of the frame loop.

### Checks (honest state)
- `tsc` clean (pre-existing sand-001 errors only); `npm run build` passes.
- plot-labels audit, 3 modes x 2 x 60 s at 60x (last complete GPU run, 19:11): 0 block overlaps, 0 leader crossings,
  0 leaders through blocks or symbols, 0 weapon lines through text, 0 blocks over symbols or missile heads,
  0 far blocks without a visible leader, 0 grid overlaps. Still failing: keptHidden 8 (CRT), 2 (CURRENT), 9 (OFFSIG),
  from one classified contact in the top-left corner pocket at 1280x720; ambiguousPairing 11 (CURRENT tilt).
  Margins were tightened and edge-first ordering added after that run, but not re-verified.
- Later runs hung: browsers idle at load 0.7 (the GPU path, not a JS loop). A software-GL run timed out. The full suite
  was not re-run this round. Break tests for the new audit checks were not run.
- Not captured: per-mode frames, `mode-switch.webm`, `hornet-pair.png`, `font-compare.png`, per-mode fps at DPR 2 and
  0.6 on a production build. All are scripted in `capture.mjs full`.

### Round 5, follow-up 3 (Vultr box, software GL, 2026-11-03 19:48-20:40)
Every browser step ran on the Vultr box (`ray@149.28.56.56:/home/ray/runs/main-crt-r5`, xvfb, no GPU, `--mute-audio`),
because home-PC Chromium was being paused for a commission run.
- Fixes this pass:
  - The scroll-cue effect re-ran after every render; it now runs only when the panel content changes.
  - Text is re-measured once the active mode's font has loaded (this cleared CURRENT's ambiguous pairs).
  - Kept tracks get half-step fallback bearings, and the mode readout stays up 4 s.
  - The audit's sample floor is 100 (software GL gives about 1.5 samples/s), and flip rates use real elapsed time.
  - `capture.mjs` keeps raw frames if the host has no ffmpeg; they were stitched and encoded on home-PC.
- plot-labels audit (2 x 60 s at 60x per mode):
  - Clean run (19:57): CRT and off-signature PASS with every count 0. CURRENT had ambiguousPairing 4, since fixed.
  - Loaded run (alongside the capture): CRT and CURRENT 0 on every rule; off-signature keptHidden 4, the top-left
    corner pocket at 1280x720. The CRT and CURRENT tests still failed that run on the load-driven checks (samples
    under the floor, or the flip bound).
- Full suite on Vultr: 36 passed, 4 failed (the 3 label audits as above, plus design-system "V cycles": the readout
  check). A "Maximum update depth" warning traces to `useSimulation.ts` line 142, the sim's interval `setState`. That
  file is fenced (`src/lib/simulation/*`), so it is not changed here.
- Break tests for the new audit checks: NOT RUN (time).
- Captures (`frames-r5/`): `{crt,current,offsig}-{first-screen,unit-selected,tilt-3d,dense-tilt}.png`, `hornet-pair.png`,
  `font-compare.png` (Px437 left, VT323 right), `mode-switch.webm` (13 s), `briefing.png`, `fps.txt`,
  `label-audit-at-capture.txt` (0 violations in every dense frame and the hornet pair), `console-errors.txt` (none).
  The crt-dense-tilt frame was taken late in the fight (2 contacts), so it is not a dense case.
- fps in `fps.txt` (0.4-2 fps) is software GL on a GPU-less box. It is NOT the smoothness verdict; the Mac production
  build is.
