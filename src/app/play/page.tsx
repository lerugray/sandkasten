import { LegacyPlay } from "./LegacyPlay";
import { SnapshotPlay } from "./SnapshotPlay";
import { TerminalPlay } from "@/components/terminal/TerminalPlay";

// /play is the Three.js terminal display. /play?map=legacy keeps the old
// MapLibre view reachable for side-by-side comparison only.
// /play?scenario=snapshot opens the committed real-world ADS-B snapshot (data/snapshots) instead of the
// Hormuz demo; combine with map=legacy for the MapLibre view.
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { map, scenario } = await searchParams;
  if (scenario === "snapshot") return <SnapshotPlay legacy={map === "legacy"} />;
  return map === "legacy" ? <LegacyPlay /> : <TerminalPlay />;
}
