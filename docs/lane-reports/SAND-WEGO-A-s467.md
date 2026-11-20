FIX SUBMITTED: no game or test change needed — WeGo plan A already equals continuous plan A (both DEFEAT); the "known-soft" red is a host-class timing flake, not a real defect.

## What ran (this lane, GPU host s254, RTX 3050)

- Unit: `npx vitest run` — 355/355.
- Full e2e (`SAND_E2E_GPU=1 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib npx playwright test --workers=2 --mute-audio`): **130 passed / 16 skipped / 0 failed** (28.1m, exit 0). The 16 skips are pre-existing capture-only specs (`SAND_ART_SET`, `SAND_CAPTURE`, `SAND_ART2_SET`).
- The named red does not reproduce: `tests/sand-wego-1-flow.spec.ts:289` passes in isolation (2.1m GPU, 8.2m SwiftShader) and in the full run.

## Decision: game vs test (job 2)

Neither side is wrong — both already give the same outcome, so no rule/balance/test change.

- Continuous plan A (`tests/sand-play-1-plans.spec.ts:54`): `[ DEFEAT ]`, "USS Nimitz was destroyed".
- WeGo plan A (`tests/sand-wego-1-flow.spec.ts:289`): `[ DEFEAT ]`, "USS Nimitz was destroyed", `mission-status=failed`, one queued ENGAGE staged.

The "known-soft" red is the host-class flake already recorded in `SAND-ART1-LANDGATE-REPORT.md` ("combat plan A WeGo … host-class flake") plus the wall-clock-wait mechanism in `SAND-THREAT-FIX3-REPORT.md` §1.2/§7. It is not a deterministic defect and does not reproduce on this GPU host.

## SPEC steps 1–7, can a player do it today

1. Open scenario / build one — PARTIAL (bundled/snapshot open yes; editor places units/sides/settings and saves JSON, no reference-point/victory editing — `src/app/editor/page.tsx`, `tests/sand-001-unit-placement.spec.ts`).
2. Give orders — PARTIAL (waypoint/throttle/ENGAGE/ROE/sensor yes — `sand-006`/`sand-007`; aircraft launch/recovery NO — `demo.ts:5` "no takeoff/landing model"; missions are AI-only — `src/lib/ai/missions.ts`).
3. Run time (continuous + WeGo) — YES (`simulation.spec.ts`, `sand-wego-1-flow.spec.ts`).
4. Sensors/fog — YES (`sand-002-radar-detection.spec.ts`, `sand-005-fow-godmode.spec.ts`).
5. Combat (missiles/AD/damage/log) — YES (`sand-003-combat.spec.ts`, `sand-combat-1-record.spec.ts`; Phalanx defends a C-802).
6. Win/lose + play again — YES (`sand-victory-1.spec.ts`, `sand-play-1-result.spec.ts`).
7. Save/resume — YES (`sand-save-1-flow.spec.ts`, `sand-save-1-lifecycle.spec.ts`).

Next missing SPEC step: step 2 (aircraft launch/recovery + player missions).
