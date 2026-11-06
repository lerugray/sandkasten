"use client";

import { useState } from "react";
import type { Unit } from "@/types/game";
import type { Contact, UnitOrders } from "@/lib/simulation/gameState";
import type { Doctrine } from "@/lib/ai/doctrine";

type Roe = Doctrine["roe"];

/** Fire controls for the selected unit: rules of engagement and the ENGAGE order. */
export interface FireControls {
  roe: Roe;
  onSetRoe: (roe: Roe) => void;
  /** The shooter's own contacts that could be engaged (DETECTED or better). */
  contacts: Contact[];
  contactLabel: (contact: Contact) => string;
  weaponNames: string[];
  targetContactId: string | null;
  onTargetChange: (contactId: string | null) => void;
  onEngage: (contactId: string, weaponName?: string) => void;
  feedback: { ok: boolean; message: string; seq: number } | null;
}

const ROE_OPTIONS: { value: Roe; label: string }[] = [
  { value: "weapons-hold", label: "HOLD" },
  { value: "weapons-tight", label: "TIGHT" },
  { value: "weapons-free", label: "FREE" },
];

interface OrderPanelProps {
  unit: Unit;
  orders: UnitOrders;
  isPlacingWaypoint: boolean;
  onToggleWaypointMode: () => void;
  onClearWaypoints: () => void;
  onSetThrottle: (throttle: number) => void;
  onToggleRadar: () => void;
  fire?: FireControls;
}

const THROTTLE_LABELS: Record<number, string> = {
  0: "STOP",
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
  fire,
}: OrderPanelProps) {
  const targetId =
    fire && fire.targetContactId && fire.contacts.some((c) => c.id === fire.targetContactId) ? fire.targetContactId : "";
  const [weaponName, setWeaponName] = useState("");
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
          {[0, 1, 2, 3, 4].map((t) => (
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

      {fire && (
        <div data-testid="order-fire-controls">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
            Rules of engagement
          </div>
          <div className="flex gap-0.5">
            {ROE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => fire.onSetRoe(o.value)}
                data-testid="order-roe"
                data-roe={o.value}
                aria-pressed={fire.roe === o.value}
                className={`px-2 py-1 rounded text-sm cursor-pointer ${
                  fire.roe === o.value
                    ? "bg-[var(--color-terminal-amber)] text-[var(--color-tactical-dark)] font-bold"
                    : "border border-[var(--color-tactical-border)] hover:border-[var(--color-terminal-amber)]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="text-sm text-[var(--color-tactical-text-dim)] mt-1" data-testid="order-roe-note">
            {fire.roe === "weapons-free"
              ? "Fires at any contact DETECTED or better."
              : fire.roe === "weapons-tight"
                ? "Fires only in self-defence, at classified hostiles."
                : "Will not fire unless ordered."}
          </div>

          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mt-3 mb-1">Engage</div>
          {fire.weaponNames.length === 0 ? (
            <div className="text-sm text-[var(--color-tactical-text-dim)]">No weapons.</div>
          ) : fire.contacts.length === 0 ? (
            <div className="text-sm text-[var(--color-tactical-text-dim)]" data-testid="order-engage-none">
              No contact to engage.
            </div>
          ) : (
            <div className="space-y-1">
              <select
                value={targetId}
                onChange={(e) => fire.onTargetChange(e.target.value || null)}
                data-testid="order-engage-contact"
                aria-label="Contact to engage"
                className="w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-1 py-1 text-sm"
              >
                <option value="">Choose contact...</option>
                {fire.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fire.contactLabel(c)}
                  </option>
                ))}
              </select>
              <select
                value={weaponName}
                onChange={(e) => setWeaponName(e.target.value)}
                data-testid="order-engage-weapon"
                aria-label="Weapon"
                className="w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-1 py-1 text-sm"
              >
                <option value="">Weapon: AUTO</option>
                {fire.weaponNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                onClick={() => targetId && fire.onEngage(targetId, weaponName || undefined)}
                disabled={!targetId}
                data-testid="order-engage"
                className="px-2 py-1 rounded text-sm cursor-pointer border border-[var(--color-terminal-red)] text-[var(--color-terminal-red)] hover:bg-[var(--color-terminal-red)] hover:text-[var(--color-tactical-dark)] disabled:opacity-40 disabled:cursor-default"
              >
                ENGAGE
              </button>
            </div>
          )}
          {fire.feedback && (
            <div
              data-testid="order-engage-feedback"
              data-ok={fire.feedback.ok ? "true" : "false"}
              className={`text-sm mt-1 ${fire.feedback.ok ? "text-[var(--color-terminal-green)]" : "text-[var(--color-terminal-red)]"}`}
            >
              {fire.feedback.message}
            </div>
          )}
        </div>
      )}

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
