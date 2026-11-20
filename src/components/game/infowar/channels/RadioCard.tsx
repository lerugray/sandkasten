import type { MediaPost } from "@/lib/infowar/types";

interface RadioCardProps {
  post: MediaPost;
  age: string;
}

export function RadioCard({ post, age }: RadioCardProps) {
  return (
    <div className="border border-[var(--color-tactical-border)] rounded p-2 bg-[var(--color-tactical-dark)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-[var(--color-terminal-amber)] text-[var(--color-tactical-dark)] px-1 rounded font-bold">
          {post.persona.avatar}
        </span>
        <span className="text-xs text-[var(--color-terminal-amber)] uppercase tracking-wider">
          RADIO INTERCEPT
        </span>
        <span className="text-xs text-[var(--color-tactical-text-dim)] ml-auto shrink-0">
          {age}
        </span>
      </div>
      <p className="text-sm text-[var(--color-tactical-text)] leading-snug italic">
        {post.content}
      </p>
      <div className="text-xs text-[var(--color-tactical-text-dim)] mt-1">
        — {post.persona.name}
      </div>
    </div>
  );
}
