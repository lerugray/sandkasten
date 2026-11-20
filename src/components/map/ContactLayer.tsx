"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Contact } from "@/lib/simulation/gameState";
import { createCircleGeoJSON } from "@/lib/map/rangeRings";
import type { Feature, FeatureCollection, Polygon } from "geojson";

const UNCERTAINTY_SOURCE = "contact-uncertainty";
const UNCERTAINTY_FILL = "contact-uncertainty-fill";
const UNCERTAINTY_LINE = "contact-uncertainty-line";

interface ContactLayerProps {
  map: maplibregl.Map;
  contacts: Contact[];
  fogOfWar?: boolean;
}

const CLASSIFICATION_COLORS: Record<Contact["classification"], string> = {
  unknown: "#888888",
  detected: "#ffbf00",
  classified: "#ff4444",
  tracked: "#ff4444",
};

const CLASSIFICATION_SYMBOLS: Record<Contact["classification"], string> = {
  unknown: "?",
  detected: "!",
  classified: "X",
  tracked: "X",
};

export function ContactLayer({ map, contacts, fogOfWar = true }: ContactLayerProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Contact markers
  useEffect(() => {
    const existing = markersRef.current;
    const currentIds = new Set(contacts.map((c) => c.id));

    // Remove old markers
    existing.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    });

    // Add/update markers
    contacts.forEach((contact) => {
      const color = CLASSIFICATION_COLORS[contact.classification];
      const symbol = CLASSIFICATION_SYMBOLS[contact.classification];
      const label = contact.platformName ?? `C-${contact.id.slice(-4)}`;

      const marker = existing.get(contact.id);
      if (marker) {
        marker.setLngLat([contact.position.lng, contact.position.lat]);
        return;
      }

      const el = document.createElement("div");
      el.className = "contact-marker";
      el.style.cssText = `
        width: 20px; height: 20px;
        border: 2px solid ${color};
        border-radius: ${contact.classification === "unknown" ? "50%" : "2px"};
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: bold; color: ${color};
        font-family: monospace;
        transform: ${contact.classification === "unknown" ? "none" : "rotate(45deg)"};
        cursor: pointer;
      `;
      el.innerHTML = `<span style="transform: ${contact.classification === "unknown" ? "none" : "rotate(-45deg)"}">${symbol}</span>`;
      el.title = `${label} (${contact.sensorType.toUpperCase()})`;

      const newMarker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([contact.position.lng, contact.position.lat])
        .addTo(map);

      existing.set(contact.id, newMarker);
    });

    return () => {
      existing.forEach((m) => m.remove());
      existing.clear();
    };
  }, [map, contacts]);

  // Uncertainty circles
  useEffect(() => {
    if (!fogOfWar) {
      if (map.getLayer(UNCERTAINTY_LINE)) map.removeLayer(UNCERTAINTY_LINE);
      if (map.getLayer(UNCERTAINTY_FILL)) map.removeLayer(UNCERTAINTY_FILL);
      if (map.getSource(UNCERTAINTY_SOURCE)) map.removeSource(UNCERTAINTY_SOURCE);
      return;
    }

    const features: Feature<Polygon>[] = contacts
      .filter((c) => c.positionUncertainty > 0.5)
      .map((c) => {
        const ring = createCircleGeoJSON(
          c.position.lng,
          c.position.lat,
          c.positionUncertainty
        );
        ring.properties = {
          classification: c.classification,
          color: CLASSIFICATION_COLORS[c.classification],
        };
        return ring;
      });

    const geojson: FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    const source = map.getSource(UNCERTAINTY_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(UNCERTAINTY_SOURCE, { type: "geojson", data: geojson });

      map.addLayer({
        id: UNCERTAINTY_FILL,
        type: "fill",
        source: UNCERTAINTY_SOURCE,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.06,
        },
      });

      map.addLayer({
        id: UNCERTAINTY_LINE,
        type: "line",
        source: UNCERTAINTY_SOURCE,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1,
          "line-dasharray": [2, 2],
          "line-opacity": 0.4,
        },
      });
    }

    return () => {
      if (map.getLayer(UNCERTAINTY_LINE)) map.removeLayer(UNCERTAINTY_LINE);
      if (map.getLayer(UNCERTAINTY_FILL)) map.removeLayer(UNCERTAINTY_FILL);
      if (map.getSource(UNCERTAINTY_SOURCE)) map.removeSource(UNCERTAINTY_SOURCE);
    };
  }, [map, contacts, fogOfWar]);

  return null;
}
