import type { MediaPost } from "@/lib/infowar/types";

interface ForumCardProps {
  post: MediaPost;
  age: string;
}

export function ForumCard({ post, age }: ForumCardProps) {
  const isReddit = post.channel === "reddit";

  return (
    <div className="border border-[var(--color-tactical-border)] rounded p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-[var(--color-terminal-amber)] text-[var(--color-tactical-dark)] px-1 rounded font-bold">
          {isReddit ? "RDT" : "WWW"}
        </span>
        <span className="text-sm text-[var(--color-terminal-amber)] truncate">
          {post.persona.name}
        </span>
        <span className="text-xs text-[var(--color-tactical-text-dim)] ml-auto shrink-0">
          {age}
        </span>
      </div>
      <p className="text-sm text-[var(--color-tactical-text)] leading-snug">
        {post.content}
      </p>
    </div>
  );
}
