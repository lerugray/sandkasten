"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { snapshotScenarioConfig } from "@/lib/snapshot/playConfig";
import type { ScenarioConfig } from "@/lib/simulation/useSimulation";

// /play?scenario=snapshot opens the committed real-world snapshot (data/snapshots) instead of the demo.
//
// TerminalPlay and LegacyPlay read the module-level `demoScenarioConfig` directly, and both are off limits
// for this change, so the snapshot config is swapped into that object (in place) before either one is
// loaded. They are imported dynamically so the swap always happens first on a fresh page load.
// Cleaner follow-up: give TerminalPlay/LegacyPlay a `config` prop that defaults to demoScenarioConfig and
// pass snapshotScenarioConfig() from page.tsx; this wrapper and the swap then go away.
const SNAPSHOT_KEYS = ["scenario", "missions", "sideDoctrine", "events", "infowar"] as const;

function applyConfig(target: ScenarioConfig, next: ScenarioConfig): () => void {
  const saved: ScenarioConfig = { ...target };
  for (const k of SNAPSHOT_KEYS) {
    if (next[k] === undefined) delete target[k];
    else (target as unknown as Record<string, unknown>)[k] = next[k];
  }
  return () => {
    for (const k of SNAPSHOT_KEYS) {
      if (saved[k] === undefined) delete target[k];
      else (target as unknown as Record<string, unknown>)[k] = saved[k];
    }
  };
}

const TerminalPlay = dynamic(() => import("@/components/terminal/TerminalPlay").then((m) => m.TerminalPlay), { ssr: false });
const LegacyPlay = dynamic(() => import("./LegacyPlay").then((m) => m.LegacyPlay), { ssr: false });

export function SnapshotPlay({ legacy }: { legacy: boolean }) {
  // Browser only: during SSR this would mutate the server's copy of the demo config for every other request.
  // Applied while rendering (before the dynamic import below resolves) and again in the effect, which also
  // covers React strict-mode's mount/unmount/mount; the restore runs when the page is left.
  const restoreRef = useRef<(() => void) | null>(null);
  if (typeof window !== "undefined" && !restoreRef.current) {
    restoreRef.current = applyConfig(demoScenarioConfig, snapshotScenarioConfig());
  }
  useEffect(() => {
    if (!restoreRef.current) restoreRef.current = applyConfig(demoScenarioConfig, snapshotScenarioConfig());
    return () => {
      restoreRef.current?.();
      restoreRef.current = null;
    };
  }, []);
  return legacy ? <LegacyPlay /> : <TerminalPlay />;
}
