"use client";

import dynamic from "next/dynamic";

// MapLibre requires browser APIs — disable SSR
export const MapWrapper = dynamic(
  () =>
    import("./TacticalMap").then((mod) => ({
      default: mod.TacticalMap,
    })),
  { ssr: false }
);
