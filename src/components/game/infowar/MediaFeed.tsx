import type { MediaPost as MediaPostType, InfoWarState } from "@/lib/infowar/types";
import { MediaPost } from "./MediaPost";
import { OllamaStatus } from "./OllamaStatus";

interface MediaFeedProps {
  infoWarState: InfoWarState;
  simTime: number;
  onToggleEnabled: () => void;
}

export function MediaFeed({ infoWarState, simTime, onToggleEnabled }: MediaFeedProps) {
  const { posts, enabled, ollamaConnected, generatingCount, era, model } = infoWarState;

  // Only show posts that have "published" by sim time
  const visiblePosts = posts
    .filter((p) => p.simTime <= simTime)
    .sort((a, b) => b.simTime - a.simTime);

  return (
    <div className="flex flex-col h-full">
      <OllamaStatus
        enabled={enabled}
        connected={ollamaConnected}
        generatingCount={generatingCount}
        era={era}
        model={model}
        onToggle={onToggleEnabled}
      />

      {!enabled && (
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)]">
          InfoWar feed disabled. Toggle above to enable.
        </div>
      )}

      {enabled && !ollamaConnected && (
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)]">
          <p className="mb-1">Ollama not detected.</p>
          <p className="text-[10px]">
            Install Ollama and run: ollama pull {model}
          </p>
        </div>
      )}

      {enabled && ollamaConnected && visiblePosts.length === 0 && (
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)]">
          {generatingCount > 0
            ? "Generating media coverage..."
            : "Waiting for events to generate coverage..."}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {visiblePosts.map((post) => (
          <MediaPost key={post.id} post={post} simTime={simTime} />
        ))}
      </div>
    </div>
  );
}
