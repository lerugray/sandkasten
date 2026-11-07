"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { unitSymbolSpec } from "@/lib/map/unitSymbol";
import type { MapLayout } from "@/lib/map/mapLayout";
import type { Unit } from "@/types/game";

interface UnitLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  playerSide: string;
  selectedUnitId?: string | null;
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onUnitDrag?: (unitId: string, position: { lat: number; lng: number }) => void;
  /** where the layout controller put each symbol relative to its true position (units not listed sit on it) */
  layout?: MapLayout | null;
}

/** The heading leader makes a symbol's SVG taller than the symbol: this shifts the SVG so the symbol sits on its position. */
function baseOffset(el: HTMLElement): [number, number] {
  return [Number(el.dataset.baseDx ?? 0), Number(el.dataset.baseDy ?? 0)];
}

export function UnitLayer({ map, units, playerSide, onUnitSelect, onUnitDrag, layout }: UnitLayerProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const selectRef = useRef(onUnitSelect);
  selectRef.current = onUnitSelect;
  const dragRef = useRef(onUnitDrag);
  dragRef.current = onUnitDrag;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const place = (id: string, m: maplibregl.Marker) => {
    const [bx, by] = baseOffset(m.getElement());
    const [dx, dy] = layoutRef.current?.units.get(id) ?? [0, 0];
    m.setOffset([bx + dx, by + dy]);
  };

  useEffect(() => {
    const markers = markersRef.current;
    const currentIds = new Set(units.filter((u) => u.damageState !== "destroyed").map((u) => u.id));

    markers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    });

    units.forEach((unit) => {
      if (unit.damageState === "destroyed") return;
      const existing = markers.get(unit.id);
      if (existing) {
        existing.setLngLat([unit.position.lng, unit.position.lat]);
        const el = existing.getElement();
        // the symbol only changes when the heading does
        const hdg = String(unit.heading ?? "");
        if (el.dataset.heading !== hdg) {
          const spec = unitSymbolSpec(unit, playerSide);
          el.innerHTML = spec.svg;
          el.dataset.heading = hdg;
          el.dataset.baseDx = String(spec.anchor.width / 2 - spec.anchor.x);
          el.dataset.baseDy = String(spec.anchor.height / 2 - spec.anchor.y);
          el.dataset.anchorX = String(spec.anchor.x);
          el.dataset.anchorY = String(spec.anchor.y);
          place(unit.id, existing);
        }
        return;
      }

      const spec = unitSymbolSpec(unit, playerSide);
      const el = document.createElement("div");
      el.className = "unit-marker";
      el.setAttribute("data-testid", "unit-marker");
      el.dataset.unitId = unit.id;
      el.dataset.heading = String(unit.heading ?? "");
      el.dataset.baseDx = String(spec.anchor.width / 2 - spec.anchor.x);
      el.dataset.baseDy = String(spec.anchor.height / 2 - spec.anchor.y);
      // the symbol frame inside the svg (the svg also holds the heading leader): the overlap check measures this
      el.dataset.anchorX = String(spec.anchor.x);
      el.dataset.anchorY = String(spec.anchor.y);
      el.dataset.frameW = String(spec.frame.w);
      el.dataset.frameH = String(spec.frame.h);
      el.innerHTML = spec.svg;
      el.style.cursor = "pointer";
      el.title = unit.name;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectRef.current(unit.id, e.shiftKey);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        offset: [spec.anchor.width / 2 - spec.anchor.x, spec.anchor.height / 2 - spec.anchor.y],
        draggable: !!dragRef.current,
      })
        .setLngLat([unit.position.lng, unit.position.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        dragRef.current?.(unit.id, { lat: lngLat.lat, lng: lngLat.lng });
      });
      markers.set(unit.id, marker);
      place(unit.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, units, playerSide]);

  // Layout changed: move the symbols to their solved spots.
  useEffect(() => {
    markersRef.current.forEach((m, id) => place(id, m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
    };
  }, [map]);

  return null;
}
