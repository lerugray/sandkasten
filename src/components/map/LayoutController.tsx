"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { computeMapLayout, type MapLayout } from "@/lib/map/mapLayout";
import { unitFrame } from "@/lib/map/unitSymbol";
import { LABEL_EM } from "@/lib/osint/labelLayout";
import type { OsintSite } from "@/lib/osint/sites";
import type { Unit } from "@/types/game";

const SRC = "map-tethers-src";
const CASING = "map-tethers-casing";
const LINE = "map-tethers";

interface Props {
  map: maplibregl.Map;
  units: Unit[];
  playerSide: string;
  sites: OsintSite[];
  onLayout: (layout: MapLayout) => void;
}

function lines(map: maplibregl.Map, tethers: MapLayout["tethers"]) {
  return {
    type: "FeatureCollection" as const,
    features: tethers.map(([a, b]) => {
      const p = map.unproject(a);
      const q = map.unproject(b);
      return {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: [[p.lng, p.lat], [q.lng, q.lat]] },
      };
    }),
  };
}

/**
 * Solves one layout for the unit symbols, OSINT symbols and OSINT labels (see computeMapLayout) whenever the map
 * settles or the inputs change, and draws the leader lines for anything that had to leave its true spot.
 * It renders nothing; UnitLayer and OsintLayer read the layout it reports.
 */
export function LayoutController({ map, units, playerSide, sites, onLayout }: Props) {
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const sideRef = useRef(playerSide);
  sideRef.current = playerSide;
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;
  const keyRef = useRef("");
  const tetherKeyRef = useRef("");
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `${LABEL_EM}px "IBM Plex Mono", monospace`;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ensureLayers = () => {
      if (!map.isStyleLoaded() && !map.getSource(SRC)) return false;
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: lines(map, []) });
        map.addLayer({
          id: CASING,
          type: "line",
          source: SRC,
          layout: { "line-cap": "round" },
          paint: { "line-color": "#0b1120", "line-width": 3.4, "line-opacity": 0.75 },
        });
        map.addLayer({
          id: LINE,
          type: "line",
          source: SRC,
          layout: { "line-cap": "round" },
          paint: { "line-color": "#e2e8f0", "line-width": 1.4, "line-opacity": 0.95 },
        });
      }
      return true;
    };

    const run = () => {
      const live = unitsRef.current
        .filter((u) => u.damageState !== "destroyed")
        .map((u) => {
          const f = unitFrame(u, sideRef.current);
          return { id: u.id, lng: u.position.lng, lat: u.position.lat, w: f.w, h: f.h };
        });
      const layout = computeMapLayout(map, { units: live, sites: sitesRef.current, textWidth: (t) => measure.measureText(t).width });
      const tk = JSON.stringify(layout.tethers.map(([a, b]) => [a[0].toFixed(1), a[1].toFixed(1), b[0].toFixed(1), b[1].toFixed(1)]));
      // only touch the source when the lines moved: setData re-renders, which would fire `idle` and loop
      if (tk !== tetherKeyRef.current && ensureLayers()) {
        tetherKeyRef.current = tk;
        (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(lines(map, layout.tethers));
      }
      if (layout.key !== keyRef.current) {
        keyRef.current = layout.key;
        onLayoutRef.current(layout);
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 120);
    };
    runRef.current = schedule;
    const onStyle = () => {
      tetherKeyRef.current = "";
      schedule();
    };
    map.on("idle", schedule);
    map.on("zoomend", schedule);
    map.on("style.load", onStyle);
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      map.off("idle", schedule);
      map.off("zoomend", schedule);
      map.off("style.load", onStyle);
      for (const id of [LINE, CASING]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
  }, [map]);

  // inputs changed: relayout shortly
  const unitKey = units.map((u) => `${u.id}:${u.damageState === "destroyed" ? "x" : `${u.position.lng.toFixed(4)},${u.position.lat.toFixed(4)}`}`).join(";");
  const siteKey = sites.map((s) => s.id).join(",");
  useEffect(() => {
    runRef.current();
  }, [unitKey, siteKey, playerSide]);

  return null;
}
