import type { MediaEra } from "@/lib/infowar/types";

interface OllamaStatusProps {
  enabled: boolean;
  connected: boolean;
  generatingCount: number;
  era: MediaEra;
  model: string;
  onToggle: () => void;
}

const ERA_LABELS: Record<MediaEra, string> = {
  "pre-1980": "Pre-1980s Media",
  "1980s-1990s": "1980s-90s Media",
  "2000s": "2000s Media",
  "2010s": "2010s Media",
  "2020s+": "2020s+ Media",
};

export function OllamaStatus({
  enabled,
  connected,
  generatingCount,
  era,
  model,
  onToggle,
}: OllamaStatusProps) {
  return (
    <div className="p-2 border-b border-[var(--color-tactical-border)] shrink-0">
      <div className="flex items-center gap-2 mb-1">
        {/* Connection indicator */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: !enabled
              ? "var(--color-tactical-text-dim)"
              : connected
                ? "var(--color-terminal-green)"
                : "var(--color-terminal-red)",
          }}
        />
        <span className="text-[10px] text-[var(--color-tactical-text-dim)] uppercase tracking-wider">
          {!enabled ? "Disabled" : connected ? `Ollama (${model})` : "Disconnected"}
        </span>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`ml-auto text-[10px] px-2 py-0.5 rounded cursor-pointer uppercase tracking-wider ${
            enabled
              ? "bg-[var(--color-terminal-blue)] text-[var(--color-tactical-dark)] font-bold"
              : "border border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)]"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--color-tactical-text-dim)]">
          {ERA_LABELS[era]}
        </span>
        {generatingCount > 0 && (
          <span className="text-[10px] text-[var(--color-terminal-amber)]">
            Generating {generatingCount}...
          </span>
        )}
      </div>
    </div>
  );
}
