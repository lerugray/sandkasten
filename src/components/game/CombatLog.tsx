"use client";

import type { CombatEvent } from "@/lib/simulation/combat";

interface CombatLogProps {
  events: CombatEvent[];
  simTime: number;
  playerSide: string;
}

const EVENT_COLORS: Record<CombatEvent["type"], string> = {
  launch: "text-[var(--color-terminal-amber)]",
  intercept: "text-[var(--color-terminal-blue)]",
  hit: "text-[var(--color-terminal-red)]",
  miss: "text-[var(--color-tactical-text-dim)]",
  destroyed: "text-[var(--color-terminal-red)]",
  damaged: "text-[var(--color-terminal-amber)]",
  defended: "text-[var(--color-terminal-green)]",
};

const EVENT_ICONS: Record<CombatEvent["type"], string> = {
  launch: ">>",
  intercept: "<>",
  hit: "**",
  miss: "--",
  destroyed: "XX",
  damaged: "!!",
  defended: "[]",
};

export function CombatLog({ events, simTime, playerSide }: CombatLogProps) {
  if (events.length === 0) {
    return (
      <div className="text-[var(--color-tactical-text-dim)] text-center py-4 italic">
        No combat activity
      </div>
    );
  }

  // Show newest first, limit to last 50
  const recent = [...events].reverse().slice(0, 50);

  return (
    <div className="space-y-1">
      {recent.map((evt) => {
        const ageMs = simTime - evt.time;
        const ageSecs = Math.floor(ageMs / 1000);
        const ageStr =
          ageSecs < 60
            ? `${ageSecs}s`
            : ageSecs < 3600
              ? `${Math.floor(ageSecs / 60)}m`
              : `${Math.floor(ageSecs / 3600)}h`;

        return (
          <div
            key={evt.id}
            className={`text-[10px] leading-tight ${EVENT_COLORS[evt.type]}`}
          >
            <span className="text-[var(--color-tactical-text-dim)] mr-1">
              {ageStr}
            </span>
            <span className="font-mono mr-1">{EVENT_ICONS[evt.type]}</span>
            {evt.description}
          </div>
        );
      })}
    </div>
  );
}
