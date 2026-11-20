"use client";

// The front door is the terminal title screen (SAND-TITLE-1): SANDKASTEN, a plain
// explanation, the scenario menu, and the version/credits. Play is one Enter away at
// /play; the MapLibre home page stays retired (comparison only at /play?map=legacy).
import { TitleScreen } from "@/components/terminal/TitleScreen";

export default function Home() {
  return <TitleScreen />;
}
