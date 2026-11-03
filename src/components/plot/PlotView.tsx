"use client";

import { useEffect, useRef } from "react";
import { TacticalPlot, type PlotInput, type PlotInsets, type PlotReadouts } from "@/lib/plot/TacticalPlot";
import type { GeoPoint } from "@/lib/plot/projection";

export interface PlotViewProps {
  input: PlotInput;
  origin: GeoPoint;
  tilt: boolean;
  insets: PlotInsets;
  readouts: { cursor: React.RefObject<HTMLElement | null>; scaleLabel: React.RefObject<HTMLElement | null>; scaleBar: React.RefObject<HTMLElement | null> };
  zoomRequest?: { n: number; factor: number };
  focusRequest?: { n: number; unitId: string } | null;
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onMapClick: (p: GeoPoint) => boolean | void;
}

// Hosts the Three.js plot. The plot owns its canvas and animation loop; this
// component only forwards React state into it, so React renders never tear
// the scene down.
export function PlotView({ input, origin, tilt, insets, readouts, zoomRequest, focusRequest, onUnitSelect, onMapClick }: PlotViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<TacticalPlot | null>(null);
  const cbRef = useRef({ onUnitSelect, onMapClick });
  cbRef.current = { onUnitSelect, onMapClick };

  useEffect(() => {
    if (!hostRef.current || !overlayRef.current) return;
    const plot = new TacticalPlot(hostRef.current, overlayRef.current, origin, {
      onUnitSelect: (id, shift) => cbRef.current.onUnitSelect(id, shift),
      onMapClick: (p) => cbRef.current.onMapClick(p),
    });
    plotRef.current = plot;
    const host = hostRef.current as HTMLDivElement & { __plot?: unknown };
    host.__plot = plot.getHandle();
    (window as unknown as { __sandPlot?: unknown }).__sandPlot = host.__plot;
    return () => {
      plot.dispose();
      plotRef.current = null;
      delete host.__plot;
    };
    // origin is fixed for a scenario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    plotRef.current?.update(input);
  }, [input]);

  useEffect(() => {
    plotRef.current?.setTilt(tilt);
  }, [tilt]);

  useEffect(() => {
    plotRef.current?.setInsets(insets);
  }, [insets]);

  useEffect(() => {
    const r: PlotReadouts = {
      cursor: readouts.cursor.current,
      scaleLabel: readouts.scaleLabel.current,
      scaleBar: readouts.scaleBar.current,
    };
    plotRef.current?.setReadouts(r);
  }, [readouts]);

  useEffect(() => {
    if (zoomRequest && zoomRequest.n > 0) plotRef.current?.zoomBy(zoomRequest.factor);
  }, [zoomRequest]);

  useEffect(() => {
    if (focusRequest) plotRef.current?.focusUnit(focusRequest.unitId);
  }, [focusRequest]);

  return (
    <div className="tx-plot" data-testid="tactical-plot-wrap">
      <div ref={hostRef} className="tx-plot-host" data-testid="tactical-plot" />
      <div ref={overlayRef} className="tx-plot-overlay" aria-hidden="true" />
    </div>
  );
}

export default PlotView;
