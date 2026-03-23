"use client";

import { SPEED_OPTIONS } from "@/lib/simulation/gameState";

interface TimeControlsProps {
  simTime: number;
  isPaused: boolean;
  speed: number;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

export function TimeControls({
  simTime,
  isPaused,
  speed,
  onTogglePause,
  onSetSpeed,
  onReset,
}: TimeControlsProps) {
  const timeStr = new Date(simTime).toISOString().replace("T", " ").slice(0, 19) + "Z";

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Play/Pause */}
      <button
        onClick={onTogglePause}
        className={`px-2 py-0.5 rounded border cursor-pointer font-bold tracking-wider ${
          isPaused
            ? "border-[var(--color-terminal-green)] text-[var(--color-terminal-green)]"
            : "border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)]"
        }`}
      >
        {isPaused ? "PLAY" : "PAUSE"}
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-0.5">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
              speed === s
                ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] font-bold"
                : "text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Sim clock */}
      <span className="text-[var(--color-tactical-text)] font-mono ml-2">
        {timeStr}
      </span>

      {/* Reset */}
      <button
        onClick={onReset}
        className="text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-terminal-red)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer ml-2"
      >
        RESET
      </button>
    </div>
  );
}
