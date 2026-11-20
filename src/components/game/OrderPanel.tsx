"use client";

import { useEffect, useRef, useState } from "react";
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

/** Air controls for the selected unit: launch from a host's air wing, or recover a launched aircraft. */
export interface AirSlotInfo {
  platformId: number;
  name: string;
  count: number;
  ready: boolean;
}

export interface AirControls {
  airWing: AirSlotInfo[];
  onLaunch: (platformId: number) => void;
  isLaunchedAircraft: boolean;
  airStatus?: string;
  fuelLabel?: string;
  hostName?: string;
  recovering?: boolean;
  onRecover: () => void;
  feedback: { ok: boolean; message: string; seq: number } | null;
}

/** Player mission assignment (SAND-MISSIONS-1) for the selected unit. */
export interface MissionOption {
  id: string;
  name: string;
  type: string;
}

export interface MissionControls {
  /** The player missions the selected unit could join. */
  options: MissionOption[];
  /** The mission this unit is already on, if any. */
  currentMissionId: string | null;
  onAssign: (missionId: string) => void;
  onUnassign: () => void;
  /** True when the selected unit is a carrier/airbase with a ready aircraft to launch. */
  canLaunchAircraft: boolean;
  onLaunchForMission: (missionId: string) => void;
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
  air?: AirControls;
  mission?: MissionControls;
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
  air,
  mission,
}: OrderPanelProps) {
  const targetId =
    fire && fire.targetContactId && fire.contacts.some((c) => c.id === fire.targetContactId) ? fire.targetContactId : "";
  const [weaponName, setWeaponName] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // the newest waypoint stays in view inside the bounded list
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [orders.waypoints.length]);
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
      </div>

      {/* Throttle */}
      <div>
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
          Throttle
        </div>
        <div className="flex gap-0.5" data-testid="order-throttle-row">
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

      {air && (air.airWing.length > 0 || air.isLaunchedAircraft) && (
        <div data-testid="order-air-ops">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
            Air operations
          </div>
          {air.airWing.map((slot) => (
            <div key={slot.platformId} data-testid="air-slot" data-platform-id={slot.platformId} className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm text-[var(--color-tactical-text-dim)]">
                {slot.name} × {slot.count}
              </span>
              <button
                onClick={() => air.onLaunch(slot.platformId)}
                disabled={!slot.ready || slot.count <= 0}
                data-testid="air-launch"
                className={`px-2 py-1 rounded text-sm cursor-pointer border ${
                  slot.ready && slot.count > 0
                    ? "border-[var(--color-terminal-green)] text-[var(--color-terminal-green)] hover:bg-[var(--color-terminal-green)] hover:text-[var(--color-tactical-dark)]"
                    : "border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)] cursor-default"
                }`}
              >
                {slot.ready ? "LAUNCH" : "TURNAROUND"}
              </button>
            </div>
          ))}
          {air.isLaunchedAircraft && (
            <div className="mb-1">
              <div className="text-sm text-[var(--color-tactical-text-dim)]" data-testid="air-status">
                {air.airStatus?.toUpperCase()}  //  {air.fuelLabel}  //  HOST {air.hostName}
              </div>
              <button
                onClick={air.onRecover}
                disabled={air.recovering || air.airStatus !== "airborne"}
                data-testid="air-recover"
                className={`px-2 py-1 rounded text-sm cursor-pointer border ${
                  air.recovering || air.airStatus !== "airborne"
                    ? "border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)] cursor-default"
                    : "border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)] hover:bg-[var(--color-terminal-amber)] hover:text-[var(--color-tactical-dark)]"
                }`}
              >
                {air.recovering ? "RECOVERING" : "RECOVER"}
              </button>
            </div>
          )}
          {air.feedback && (
            <div
              data-testid="air-feedback"
              data-ok={air.feedback.ok ? "true" : "false"}
              className={`text-sm mt-1 ${air.feedback.ok ? "text-[var(--color-terminal-green)]" : "text-[var(--color-terminal-red)]"}`}
            >
              {air.feedback.message}
            </div>
          )}
        </div>
      )}

      {mission && mission.options.length > 0 && (
        <div data-testid="order-mission-controls">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
            Mission
          </div>
          {mission.currentMissionId ? (
            <button
              onClick={mission.onUnassign}
              data-testid="order-unassign-mission"
              className="px-2 py-1 rounded text-sm cursor-pointer border border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)] hover:bg-[var(--color-terminal-amber)] hover:text-[var(--color-tactical-dark)]"
            >
              {mission.options.find((m) => m.id === mission.currentMissionId)?.name.toUpperCase() ?? "MISSION"} — UNASSIGN
            </button>
          ) : (
            <div className="space-y-1">
              {mission.options.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--color-tactical-text-dim)]">
                    {m.name.toUpperCase()} ({m.type.toUpperCase()})
                  </span>
                  <button
                    onClick={() => mission.onAssign(m.id)}
                    data-testid="order-assign-mission"
                    data-mission-id={m.id}
                    className="px-2 py-1 rounded text-sm cursor-pointer border border-[var(--color-terminal-green)] text-[var(--color-terminal-green)] hover:bg-[var(--color-terminal-green)] hover:text-[var(--color-tactical-dark)]"
                  >
                    ASSIGN
                  </button>
                </div>
              ))}
            </div>
          )}

          {mission.canLaunchAircraft && (
            <div className="mt-1 space-y-1">
              <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">
                Launch aircraft on mission
              </div>
              {mission.options.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--color-tactical-text-dim)]">{m.name.toUpperCase()}</span>
                  <button
                    onClick={() => mission.onLaunchForMission(m.id)}
                    data-testid="order-launch-mission"
                    data-mission-id={m.id}
                    className="px-2 py-1 rounded text-sm cursor-pointer border border-[var(--color-terminal-blue)] text-[var(--color-terminal-blue)] hover:bg-[var(--color-terminal-blue)] hover:text-[var(--color-tactical-dark)]"
                  >
                    LAUNCH
                  </button>
                </div>
              ))}
            </div>
          )}

          {mission.feedback && (
            <div
              data-testid="order-mission-feedback"
              data-ok={mission.feedback.ok ? "true" : "false"}
              className={`text-sm mt-1 ${mission.feedback.ok ? "text-[var(--color-terminal-green)]" : "text-[var(--color-terminal-red)]"}`}
            >
              {mission.feedback.message}
            </div>
          )}
        </div>
      )}

      {/* Waypoint list: last, in a bounded box, so a growing route never moves the controls above it. */}
      {orders.waypoints.length > 0 && (
        <div>
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-1">Route</div>
          <div
            ref={listRef}
            data-testid="order-waypoints-list"
            className="space-y-1 overflow-y-auto pr-1"
            style={{ maxHeight: "6.5rem" }}
          >
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
        </div>
      )}
    </div>
  );
}
