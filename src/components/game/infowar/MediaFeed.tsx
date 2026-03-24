import type { InfoWarState } from "@/lib/infowar/types";
import { MediaPost } from "./MediaPost";
import { OllamaStatus } from "./OllamaStatus";

interface MediaFeedProps {
  infoWarState: InfoWarState;
  simTime: number;
  onToggleEnabled: () => void;
  onMarkRead: (postId: string) => void;
}

export function MediaFeed({ infoWarState, simTime, onToggleEnabled, onMarkRead }: MediaFeedProps) {
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
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)] text-sm">
          InfoWar feed disabled. Toggle above to enable.
        </div>
      )}

      {enabled && !ollamaConnected && (
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)]">
          <p className="mb-1 text-sm">Ollama not detected.</p>
          <p className="text-sm">
            Install Ollama and run: ollama pull {model}
          </p>
        </div>
      )}

      {enabled && ollamaConnected && visiblePosts.length === 0 && (
        <div className="p-4 text-center text-[var(--color-tactical-text-dim)] text-sm">
          {generatingCount > 0
            ? "Generating media coverage..."
            : "Waiting for events to generate coverage..."}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {visiblePosts.map((post) => (
          <MediaPost
            key={post.id}
            post={post}
            simTime={simTime}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    </div>
  );
}
