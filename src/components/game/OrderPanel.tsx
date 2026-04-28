"use client";

import type { Unit } from "@/types/game";
import type { UnitOrders } from "@/lib/simulation/gameState";

interface OrderPanelProps {
  unit: Unit;
  orders: UnitOrders;
  isPlacingWaypoint: boolean;
  onToggleWaypointMode: () => void;
  onClearWaypoints: () => void;
  onSetThrottle: (throttle: number) => void;
  onToggleRadar: () => void;
}

const THROTTLE_LABELS: Record<number, string> = {
  1: "LOITER",
  2: "CRUISE",
  3: "FULL",
  4: "FLANK",
};

export function OrderPanel({
  unit,
  orders,
  isPlacingWaypoint,
  onToggleWaypointMode,
  onClearWaypoints,
  onSetThrottle,
  onToggleRadar,
}: OrderPanelProps) {
  return (
    <div data-testid="order-panel" className="text-sm space-y-3">
      <div className="text-[var(--color-terminal-green)] font-bold uppercase tracking-wider">
        Orders — {unit.name}
      </div>

      {/* Waypoints */}
      <div>
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
          <span data-testid="order-waypoints-count">
            Navigation ({orders.waypoints.length} waypoints)
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onToggleWaypointMode}
            data-testid="order-add-waypoint"
            className={`px-2 py-1 rounded text-sm cursor-pointer ${
              isPlacingWaypoint
                ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] font-bold"
                : "border border-[var(--color-tactical-border)] hover:border-[var(--color-terminal-green)]"
            }`}
          >
            {isPlacingWaypoint ? "PLACING..." : "ADD WAYPOINT"}
          </button>
          {orders.waypoints.length > 0 && (
            <button
              onClick={onClearWaypoints}
              data-testid="order-clear-waypoints"
              className="px-2 py-1 rounded text-sm border border-[var(--color-tactical-border)] text-[var(--color-terminal-red)] hover:border-[var(--color-terminal-red)] cursor-pointer"
            >
              CLEAR
            </button>
          )}
        </div>
        {orders.waypoints.length > 0 && (
          <div data-testid="order-waypoints-list" className="mt-2 space-y-1">
            {orders.waypoints.map((wp, i) => (
              <div
                key={i}
                data-testid="order-waypoint-item"
                data-waypoint-index={i}
                className="text-sm text-[var(--color-tactical-text-dim)] font-mono"
              >
                WP{i + 1}: {wp.position.lat.toFixed(3)}N {wp.position.lng.toFixed(3)}E
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Throttle */}
      <div>
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
          Throttle
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4].map((t) => (
            <button
              key={t}
              onClick={() => onSetThrottle(t)}
              data-testid="order-throttle"
              data-throttle={t}
              className={`px-2 py-1 rounded text-sm cursor-pointer ${
                orders.throttle === t
                  ? "bg-[var(--color-terminal-blue)] text-[var(--color-tactical-dark)] font-bold"
                  : "border border-[var(--color-tactical-border)] hover:border-[var(--color-terminal-blue)]"
              }`}
            >
              {THROTTLE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Radar */}
      <div>
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
          Sensors
        </div>
        <button
          onClick={onToggleRadar}
          data-testid="order-toggle-radar"
          className={`px-2 py-1 rounded text-sm cursor-pointer ${
            orders.radarActive
              ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] font-bold"
              : "border border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)]"
          }`}
        >
          RADAR {orders.radarActive ? "ACTIVE" : "OFF"}
        </button>
        {orders.radarActive && (
          <span className="text-sm text-[var(--color-tactical-text-dim)] ml-2">
            (emitting — detectable by ESM)
          </span>
        )}
      </div>
    </div>
  );
}
