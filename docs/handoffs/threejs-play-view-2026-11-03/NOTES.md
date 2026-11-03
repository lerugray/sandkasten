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
