# SAND-ART1-FIX4 — land-battery reds on ART1+FIX3 tip d882b59

Lane: `co3-sandart1fix4-t529` on branch `co3/sand-art1-fix4`.
Grounded tip: `d882b5984af237083b9a86dd2fc1c3a9a1a56a05` (ART1+FIX3 landbat merge).
Host: WSL2 s254 (RTX 3050). Chromium via untracked `pw-wsl-gpu.config.ts` with `--mute-audio --no-sandbox --use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist` and `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`. Those flags are **not** in committed Playwright config.

## Verdict

**FIX BLOCKED** on defect 1 (wrap debrief LAUNCH lines). Defects 2–4 are fixed within the fence. Unit suite green (352/352). Wrap presentation (overflow-wrap / nowrap tokens) is in tree and the injected weapon-row half of `sand-art1-wrap` passes; the debrief half still fails because the gate-teleport path never produces an in-horizon C-802 salvo after THREAT-1, and every restore that would fire that salvo is either fenced (scenario / sensor / combat-math) or breaks THREAT / battle-save pins.

## Fence

Touched only presentation CSS/layout, WeGo resolve timing under UI stall, facility pick/declutter, and plot label placement. No font swap. No scenario/balance/sensor/combat-math edits left in tree. No save-format change. No merge to main. No commit/push. No `docs/ready/`. Dirty tree left for harvester. Transient `pw-wsl-gpu.config.ts` is host-only and must stay untracked.

## Per defect

### 1. S2 wrap — debrief mid-word breaks (`tests/sand-art1-wrap.spec.ts`) — **FAIL / BLOCKED**

| | |
|---|---|
| **Cause (presentation)** | `.tx-result-line` used `overflow-wrap: anywhere`, which split `C-802` and `(CVN-68)` mid-token even after `turnAtSpaces`. |
| **Cause (missing LAUNCH)** | After THREAT-1 the wrap debrief teleports Nimitz to `GATE.centre` (~17 nm from nearest FAC). Surface radar horizon at default mast (~20 ft) leaves that shot below the horizon, so the opening C-802 salvo never enters the record (`launches.length === 0`). Weapons-free will not engage ESM-only unknown contacts either. |
| **Tried and reverted (fence / pin breaks)** | Nudge `ir-fac-1` into horizon → greened wrap, broke mid-fight battle-save. Sea mast default 60 ft → broke THREAT (defeat→victory / picket contact). Nimitz `altitude: 100` → broke THREAT careless/picket paths and battle-save. All reverted; `demo.ts` / `detection.ts` clean. |
| **Files kept** | `src/app/play/terminal.css` (`overflow-wrap: normal` on `.tx-result-line`; `.tx-turns` normal break; `.tx-nowrap`); `src/components/terminal/TerminalPlay.tsx` (`nowrapTokens` on turnAtSpaces outputs for weapon rows, review, debrief). |
| **Proof** | `npx playwright test --config=pw-wsl-gpu.config.ts tests/sand-art1-wrap.spec.ts --workers=1` — weapon-row cases PASS; debrief cases FAIL (`expect(launches.length).toBeGreaterThan(0)`). |
| **Successor** | Needs a fence-legal path that puts an in-horizon identified FAC shot on the gate-teleport debrief without scenario/sensor edits that break THREAT-1, **or** a brief that allows a scoped scenario/sensor change. |

### 2. S2 WeGo combat record — plan A timeout (`tests/sand-combat-1-record.spec.ts`) — **PASS**

| | |
|---|---|
| **Cause** | WeGo `tickWeGo` clipped real `dt` with `MAX_REAL_DT_MS` (same bound as continuous play). Heavy plot frames under the record UI left resolve budget starved so commit→review hung past the test’s 20 min cap. |
| **Fix** | Count the full real gap into `resolveBudgetMs` during WeGo resolving only (sealed turn has a fixed end). |
| **Files** | `src/lib/simulation/session.ts` |
| **Proof** | Targeted e2e includes `tests/sand-combat-1-record.spec.ts` (plan A WeGo path completes under existing timeout). |

### 3. S2 Oghab 44 panel (`tests/sand-map-2-plot-facilities.spec.ts`) — **PASS**

| | |
|---|---|
| **Cause** | Facility pick skipped only `it.hidden`. Decluttered (`it.decl`) symbols were still skipped incorrectly relative to withdrawn/runway hit discs, so clicking Oghab 44 (`apt-ir-0161`) missed the panel. |
| **Fix** | Skip `it.decl` in pick (decluttered yield to neighbour); withdrawn runway markers keep the centre hit disc. Declutter also clears unit glyphs. |
| **Files** | `src/lib/plot/facilityLayer.ts` (pick + optional `units` gap in declutter); `src/lib/plot/TacticalPlot.ts` (passes unit centres into declutter). |
| **Proof** | Targeted e2e `tests/sand-map-2-plot-facilities.spec.ts` — panel title Oghab, runway `2,733 m`, X closes. |

### 4. S2 OSINT overlap at 1920×1080 (`tests/sand-osint-1-overlap-plot.spec.ts`) — **PASS**

| | |
|---|---|
| **Cause** | Close-zoom runway grids and unit glyphs left no free label plate at 1920×1080; declutter did not re-run when tracks appeared under a settled camera. |
| **Fix** | Extra `labelSlots` rings; `placeSiteLabel` runway-avoid then runway-retry with leader; unit fingerprint on declutter key; unit gaps in facility declutter. |
| **Files** | `src/lib/plot/TacticalPlot.ts`, `src/lib/plot/facilityLayer.ts` |
| **Proof** | Targeted e2e `tests/sand-osint-1-overlap-plot.spec.ts` at 1920×1080 (and existing 1440×900). |

## Battery

| Command | Result |
|---|---|
| `npx vitest run` | **352/352 PASS** (28 files) |
| Targeted four specs (`--workers=1`, GPU config) | **20 passed, 2 failed** (9.9m). Failures: wrap debrief at 1920×1080 and 1280×720 only (`launches.length === 0`). Weapon-row wrap, combat-1-record (incl. plan A WeGo), map-2-plot-facilities, osint-1-overlap (1440 + 1920) all PASS. Log: `/tmp/fix4-targeted-e2e.log`. |
| Full Playwright (`npx playwright test --config=pw-wsl-gpu.config.ts`, 5 workers) | **127 passed, 12 skipped, 3 failed** (15.1m). Failures: wrap debrief ×2 (`launches.length === 0`); `sand-victory-1-plays` waypoint click once under parallel load. Log: `/tmp/fix4-full-e2e.log`. GPU ANGLE/EGL launch succeeded (no `--disable-gpu` retry). |
| Victory re-check (`sand-victory-1-plays.spec.ts --workers=1`) | **1 passed** (6.3m) — parallel-load flake, not a FIX4 regression. Log: `/tmp/fix4-victory-rerun.log`. |

## Working tree (intentional)

- `src/app/play/terminal.css`
- `src/components/terminal/TerminalPlay.tsx`
- `src/lib/simulation/session.ts`
- `src/lib/plot/facilityLayer.ts`
- `src/lib/plot/TacticalPlot.ts`
- `docs/lane-reports/SAND-ART1-FIX4-REPORT.md` (this file)
- Untracked host-only: `pw-wsl-gpu.config.ts` (do not commit)
- E2E may also dirty `docs/verification/sand-victory-1-s409/combat-1-carries/*` and `next-env.d.ts` as run artifacts

## Harvest note

Diff review on a non-author model. Land ART1 only when wrap debrief is green without weakening the test and without THREAT regression. Do not commit the WSL GPU Playwright overlay.
