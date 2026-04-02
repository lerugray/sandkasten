"use client";

import { SPEED_OPTIONS } from "@/lib/simulation/gameState";

interface TimeControlsProps {
  simTime: number;
  isPaused: boolean;
  speed: number;
  autopauseReason?: string | null;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

export function TimeControls({
  simTime,
  isPaused,
  speed,
  autopauseReason,
  onTogglePause,
  onSetSpeed,
  onReset,
}: TimeControlsProps) {
  const timeStr = new Date(simTime).toISOString().replace("T", " ").slice(0, 19) + "Z";

  return (
    <div className="flex items-center gap-5">
      {/* Play/Pause */}
      <button
        onClick={onTogglePause}
        className={`px-5 py-2 rounded border-2 cursor-pointer font-bold tracking-wider text-base ${
          isPaused
            ? "border-[var(--color-terminal-green)] text-[var(--color-terminal-green)]"
            : "border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)]"
        }`}
      >
        {isPaused ? "PLAY" : "PAUSE"}
      </button>

      {/* Autopause reason */}
      {autopauseReason && isPaused && (
        <span className="text-[var(--color-terminal-amber)] text-sm font-bold tracking-wider animate-pulse">
          {autopauseReason.toUpperCase()}
        </span>
      )}

      {/* Speed selector */}
      <div className="flex items-center gap-1 bg-[var(--color-tactical-dark)] rounded p-1">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className={`px-3 py-1.5 rounded text-sm text-center cursor-pointer font-mono ${
              speed === s
                ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] font-bold"
                : "text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] hover:bg-[var(--color-tactical-border)]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Sim clock */}
      <span className="text-[var(--color-tactical-text)] font-mono text-base tracking-wide">
        {timeStr}
      </span>

      {/* Reset */}
      <button
        onClick={onReset}
        className="text-sm text-[var(--color-tactical-text-dim)] hover:text-[var(--color-terminal-red)] border border-[var(--color-tactical-border)] px-3 py-2 rounded cursor-pointer tracking-wider"
      >
        RESET
      </button>
    </div>
  );
}
