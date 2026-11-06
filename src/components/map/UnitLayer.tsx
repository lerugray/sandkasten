"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { createSymbolSVG, getSymbolAnchor } from "@/lib/symbols/milsymbolFactory";
import { getPlatform } from "@/lib/platforms/lookup";
import { getAffiliation } from "@/types/game";
import type { Unit, Affiliation } from "@/types/game";
import type { BattleDimension } from "@/lib/symbols/milsymbolFactory";

interface UnitLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  playerSide: string;
  selectedUnitId: string | null;
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onUnitDrag?: (unitId: string, position: { lat: number; lng: number }) => void;
}

const CLUSTER_PX = 24;

/** Fan out markers that sit within CLUSTER_PX of each other on a ring, with a count badge at the true spot. */
function declutter(map: maplibregl.Map, markers: Map<string, maplibregl.Marker>, badges: maplibregl.Marker[]) {
  badges.forEach((b) => b.remove());
  badges.length = 0;
  const items = [...markers.entries()].map(([id, m]) => {
    const ll = m.getLngLat();
    return { id, m, ll, pt: map.project(ll), group: -1 };
  });
  const groups: typeof items[] = [];
  for (const it of items) {
    const g = groups.find((grp) => grp.some((o) => Math.hypot(o.pt.x - it.pt.x, o.pt.y - it.pt.y) < CLUSTER_PX));
    if (g) g.push(it);
    else groups.push([it]);
  }
  for (const g of groups) {
    if (g.length < 2) {
      g[0].m.setOffset([0, 0]);
      continue;
    }
    const cx = g.reduce((a, o) => a + o.pt.x, 0) / g.length;
    const cy = g.reduce((a, o) => a + o.pt.y, 0) / g.length;
    const r = 24 + g.length * 3;
    g.sort((a, b) => a.id.localeCompare(b.id));
    g.forEach((o, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / g.length;
      o.m.setOffset([cx + Math.cos(ang) * r - o.pt.x, cy + Math.sin(ang) * r - o.pt.y]);
    });
    const el = document.createElement("div");
    el.className = "unit-cluster-badge";
    el.setAttribute("data-testid", "unit-cluster-badge");
    el.textContent = String(g.length);
    el.style.cssText =
      "pointer-events:none;min-width:18px;height:18px;border-radius:9px;background:#0f172a;color:#f1f5f9;border:1px solid #94a3b8;font:600 12px/16px sans-serif;text-align:center;padding:0 3px;box-sizing:border-box";
    const center = map.unproject([cx, cy]);
    badges.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(center).addTo(map));
  }
}

export function UnitLayer({
  map,
  units,
  playerSide,
  selectedUnitId,
  onUnitSelect,
  onUnitDrag,
}: UnitLayerProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const badgesRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    const existingMarkers = markersRef.current;
    const currentIds = new Set(units.map((u) => u.id));

    // Remove markers for units no longer present
    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        existingMarkers.delete(id);
      }
    });

    // Add or update markers
    units.forEach((unit) => {
      if (unit.damageState === "destroyed") {
        const existing = existingMarkers.get(unit.id);
        if (existing) {
          existing.remove();
          existingMarkers.delete(unit.id);
        }
        return;
      }

      const platform = getPlatform(unit.platformId);
      const affiliation = getAffiliation(unit, playerSide);
      const dimension: BattleDimension = platform?.dimension ?? "sea";
      const functionId = platform?.functionId ?? "CL";

      const symbolOptions = {
        affiliation,
        dimension,
        functionId,
        size: 25,
        heading: unit.heading,
      };

      const svg = createSymbolSVG(symbolOptions);
      const anchor = getSymbolAnchor(symbolOptions);

      const existing = existingMarkers.get(unit.id);
      if (existing) {
        existing.setLngLat([unit.position.lng, unit.position.lat]);
        return;
      }

      const el = document.createElement("div");
      el.className = "unit-marker";
      el.setAttribute("data-testid", "unit-marker");
      el.dataset.unitId = unit.id;
      el.innerHTML = svg;
      el.style.cursor = "pointer";
      el.title = unit.name;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onUnitSelect(unit.id, e.shiftKey);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        draggable: !!onUnitDrag,
      })
        .setLngLat([unit.position.lng, unit.position.lat])
        .addTo(map);

      if (onUnitDrag) {
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onUnitDrag(unit.id, { lat: lngLat.lat, lng: lngLat.lng });
        });
      }

      existingMarkers.set(unit.id, marker);
    });

    const badges = badgesRef.current;
    const run = () => declutter(map, existingMarkers, badges);
    run();
    map.on("zoomend", run);
    return () => {
      map.off("zoomend", run);
      badges.forEach((b) => b.remove());
      badges.length = 0;
      existingMarkers.forEach((marker) => marker.remove());
      existingMarkers.clear();
    };
  }, [map, units, playerSide, selectedUnitId, onUnitSelect, onUnitDrag]);

  return null;
}
