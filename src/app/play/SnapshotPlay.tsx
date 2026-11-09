"use client";

import { getBuiltinConfig } from "@/lib/scenarios/builtins";
import { TerminalPlay } from "@/components/terminal/TerminalPlay";
import { LegacyPlay } from "./LegacyPlay";

// /play?scenario=snapshot opens the committed real-world snapshot (data/snapshots) instead of the demo.
// The snapshot is its own built-in configuration, handed to the play screen explicitly: nothing is swapped into
// the Hormuz demo's module state, so navigating between the two routes cannot leak one into the other.
export function SnapshotPlay({ legacy }: { legacy: boolean }) {
  return legacy ? <LegacyPlay key="snapshot-legacy" config={getBuiltinConfig("snapshot")} /> : <TerminalPlay key="snapshot" configId="snapshot" />;
}
