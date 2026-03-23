"use client";

import { useEffect, useState } from "react";
import { getPlatform } from "@/lib/platforms/lookup";
import type { Unit } from "@/types/game";

interface PlatformDetail {
  name: string;
  typeName?: string;
  country?: string;
  service?: string;
  yearCommissioned?: number;
  crew?: number;
  displacementFull?: number;
  damagePoints?: number;
  missileDefense?: number;
  agility?: number;
  endurance?: number;
  weightMax?: number;
  ooda?: { detection: number; targeting: number; evasion: number };
  propulsion?: { name: string; speedProfile: { throttle: number; speed: number }[] }[];
  sensorIds?: number[];
  mountIds?: number[];
  loadoutIds?: number[];
}

interface DetailPanelProps {
  unit: Unit;
  onClose: () => void;
}

export function DetailPanel({ unit, onClose }: DetailPanelProps) {
  const platform = getPlatform(unit.platformId);
  const [detail, setDetail] = useState<PlatformDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"info" | "sensors" | "weapons">("info");

  useEffect(() => {
    setDetail(null);
    setTab("info");

    const platformInfo = getPlatform(unit.platformId);
    if (!platformInfo) return;

    const type = platformInfo.dimension === "sea" ? "ship" : "aircraft";

    setLoading(true);
    fetch(`/api/platforms?type=${type}&id=${unit.platformId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDetail(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [unit.platformId]);

  const maxSpeed = detail?.propulsion?.[0]?.speedProfile?.find(
    (s) => s.throttle === 4
  )?.speed;
  const cruiseSpeed = detail?.propulsion?.[0]?.speedProfile?.find(
    (s) => s.throttle === 2
  )?.speed;

  return (
    <div className="absolute bottom-8 left-2 z-20 w-96 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)]">
        <span className="text-[var(--color-terminal-green)] font-bold text-sm uppercase tracking-wider truncate mr-2">
          {unit.name}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer shrink-0"
        >
          [X]
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-tactical-border)]">
        {(["info", "sensors", "weapons"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[10px] uppercase tracking-wider cursor-pointer ${
              tab === t
                ? "text-[var(--color-terminal-green)] border-b border-[var(--color-terminal-green)]"
                : "text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 max-h-80 overflow-y-auto">
        {tab === "info" && (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-[var(--color-tactical-text-dim)]">CLASS</span>
            <span>{platform?.name ?? `Platform #${unit.platformId}`}</span>

            {detail?.typeName && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">TYPE</span>
                <span>{detail.typeName}</span>
              </>
            )}

            {detail?.country && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">NATION</span>
                <span>{detail.country}</span>
              </>
            )}

            <span className="text-[var(--color-tactical-text-dim)]">SIDE</span>
            <span>{unit.side}</span>

            <span className="text-[var(--color-tactical-text-dim)]">POS</span>
            <span>
              {unit.position.lat.toFixed(4)}N {unit.position.lng.toFixed(4)}E
            </span>

            <span className="text-[var(--color-tactical-text-dim)]">HDG</span>
            <span>{unit.heading.toFixed(0)}&deg;</span>

            <span className="text-[var(--color-tactical-text-dim)]">SPD</span>
            <span>{unit.speed} kts</span>

            {unit.altitude !== undefined && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">ALT</span>
                <span>{unit.altitude.toLocaleString()} ft</span>
              </>
            )}

            <span className="text-[var(--color-tactical-text-dim)]">STATUS</span>
            <span
              className={
                unit.damageState === "undamaged"
                  ? "text-[var(--color-terminal-green)]"
                  : unit.damageState === "damaged"
                  ? "text-[var(--color-terminal-amber)]"
                  : "text-[var(--color-terminal-red)]"
              }
            >
              {unit.damageState.toUpperCase()}
            </span>

            {unit.mission && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">MISSION</span>
                <span>{unit.mission}</span>
              </>
            )}

            {/* Performance section */}
            {(maxSpeed || detail?.crew || detail?.damagePoints) && (
              <>
                <div className="col-span-2 border-t border-[var(--color-tactical-border)] mt-1 pt-1 text-[var(--color-tactical-text-dim)] uppercase tracking-wider">
                  Performance
                </div>

                {maxSpeed && (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">MAX SPD</span>
                    <span>{maxSpeed} kts</span>
                  </>
                )}

                {cruiseSpeed && (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">CRUISE</span>
                    <span>{cruiseSpeed} kts</span>
                  </>
                )}

                {detail?.displacementFull ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">DISP</span>
                    <span>{detail.displacementFull.toLocaleString()} t</span>
                  </>
                ) : null}

                {detail?.weightMax ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">MTOW</span>
                    <span>{detail.weightMax.toLocaleString()} kg</span>
                  </>
                ) : null}

                {detail?.crew ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">CREW</span>
                    <span>{detail.crew}</span>
                  </>
                ) : null}

                {detail?.damagePoints ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">HP</span>
                    <span>{detail.damagePoints}</span>
                  </>
                ) : null}

                {detail?.agility ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">AGILITY</span>
                    <span>{detail.agility.toFixed(1)}</span>
                  </>
                ) : null}

                {detail?.endurance ? (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">ENDUR</span>
                    <span>{Math.floor(detail.endurance / 60)}h {detail.endurance % 60}m</span>
                  </>
                ) : null}

                {detail?.ooda && (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">OODA</span>
                    <span>
                      D:{detail.ooda.detection}s T:{detail.ooda.targeting}s E:{detail.ooda.evasion}s
                    </span>
                  </>
                )}

                {detail?.propulsion?.[0] && (
                  <>
                    <span className="text-[var(--color-tactical-text-dim)]">PROP</span>
                    <span className="text-[11px]">{detail.propulsion[0].name}</span>
                  </>
                )}
              </>
            )}

            {loading && (
              <div className="col-span-2 text-[var(--color-tactical-text-dim)] mt-1">
                Loading platform data...
              </div>
            )}
          </div>
        )}

        {tab === "sensors" && (
          <div>
            {detail?.sensorIds?.length ? (
              <SensorList sensorIds={detail.sensorIds} />
            ) : (
              <span className="text-[var(--color-tactical-text-dim)]">
                {loading ? "Loading..." : "No sensor data available"}
              </span>
            )}
          </div>
        )}

        {tab === "weapons" && (
          <div>
            {detail?.mountIds?.length ? (
              <MountList mountIds={detail.mountIds} />
            ) : (
              <span className="text-[var(--color-tactical-text-dim)]">
                {loading ? "Loading..." : "No weapon data available"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SensorSummary {
  name: string;
  typeName?: string;
  roleName?: string;
  rangeMax: number;
}

function SensorList({ sensorIds }: { sensorIds: number[] }) {
  const [sensors, setSensors] = useState<SensorSummary[]>([]);

  useEffect(() => {
    const unique = [...new Set(sensorIds)];
    Promise.all(
      unique.slice(0, 20).map((id) =>
        fetch(`/api/platforms?type=sensor&id=${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      setSensors(results.filter(Boolean));
    });
  }, [sensorIds]);

  if (!sensors.length) return <span className="text-[var(--color-tactical-text-dim)]">Loading sensors...</span>;

  const seen = new Set<string>();
  const unique = sensors.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });

  return (
    <div className="space-y-2">
      {unique.map((s, i) => (
        <div key={i} className="border-b border-[var(--color-tactical-border)] pb-1">
          <div className="text-[var(--color-terminal-blue)] font-bold">{s.name}</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
            {s.typeName && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">TYPE</span>
                <span>{s.typeName}</span>
              </>
            )}
            {s.rangeMax > 0 && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">RANGE</span>
                <span>{s.rangeMax} nm</span>
              </>
            )}
            {s.roleName && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">ROLE</span>
                <span>{s.roleName}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MountSummary {
  name: string;
  rof: number;
  capacity: number;
  autonomous: boolean;
}

function MountList({ mountIds }: { mountIds: number[] }) {
  const [mounts, setMounts] = useState<MountSummary[]>([]);

  useEffect(() => {
    const unique = [...new Set(mountIds)];
    Promise.all(
      unique.slice(0, 20).map((id) =>
        fetch(`/api/platforms?type=mount&id=${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      setMounts(results.filter(Boolean));
    });
  }, [mountIds]);

  if (!mounts.length) return <span className="text-[var(--color-tactical-text-dim)]">Loading weapons...</span>;

  const seen = new Set<string>();
  const unique = mounts.filter((m) => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  return (
    <div className="space-y-2">
      {unique.map((m, i) => (
        <div key={i} className="border-b border-[var(--color-tactical-border)] pb-1">
          <div className="text-[var(--color-terminal-amber)] font-bold">{m.name}</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
            {m.rof > 0 && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">ROF</span>
                <span>{m.rof} rpm</span>
              </>
            )}
            {m.capacity > 0 && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">CAP</span>
                <span>{m.capacity}</span>
              </>
            )}
            {m.autonomous && (
              <>
                <span className="text-[var(--color-tactical-text-dim)]">MODE</span>
                <span className="text-[var(--color-terminal-green)]">AUTONOMOUS</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
