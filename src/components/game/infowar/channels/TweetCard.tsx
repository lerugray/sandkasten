import type { MediaPost } from "@/lib/infowar/types";

interface TweetCardProps {
  post: MediaPost;
  age: string;
  channelLabel?: string;
}

export function TweetCard({ post, age, channelLabel }: TweetCardProps) {
  return (
    <div className="border border-[var(--color-tactical-border)] rounded p-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-[var(--color-terminal-blue)] text-[var(--color-tactical-dark)] px-1 rounded font-bold">
          {post.persona.avatar}
        </span>
        <span className="text-sm text-[var(--color-terminal-blue)] font-bold truncate">
          {post.persona.name}
        </span>
        {channelLabel && (
          <span className="text-xs text-[var(--color-tactical-text-dim)] uppercase">
            {channelLabel}
          </span>
        )}
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
