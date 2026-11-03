import { LegacyPlay } from "./LegacyPlay";
import { TerminalPlay } from "@/components/terminal/TerminalPlay";

// /play is the Three.js terminal display. /play?map=legacy keeps the old
// MapLibre view reachable for side-by-side comparison only.
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { map } = await searchParams;
  return map === "legacy" ? <LegacyPlay /> : <TerminalPlay />;
}
