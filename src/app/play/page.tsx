"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LegacyPlay } from "./LegacyPlay";
import { SnapshotPlay } from "./SnapshotPlay";
import { EditorPlay } from "./EditorPlay";
import { TerminalPlay } from "@/components/terminal/TerminalPlay";

// /play is the Three.js terminal display. /play?map=legacy keeps the old
// MapLibre view reachable for side-by-side comparison only.
// /play?scenario=snapshot opens the committed real-world ADS-B snapshot (data/snapshots) instead of the
// Hormuz demo; /play?scenario=editor plays the scenario the editor's PLAY button just handed over.
// Both combine with map=legacy for the MapLibre view.
//
// This page is a client component so the static export serves one shell for /play and the
// query decides the view at runtime (a server component would freeze `searchParams` at build time).
function PlayView() {
  const params = useSearchParams();
  const map = params.get("map");
  const scenario = params.get("scenario");
  if (scenario === "snapshot") return <SnapshotPlay legacy={map === "legacy"} />;
  if (scenario === "editor") return <EditorPlay legacy={map === "legacy"} />;
  return map === "legacy" ? <LegacyPlay key="hormuz-legacy" /> : <TerminalPlay key="hormuz" configId="hormuz" />;
}

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayView />
    </Suspense>
  );
}
