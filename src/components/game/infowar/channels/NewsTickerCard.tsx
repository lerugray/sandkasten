import type { MediaPost } from "@/lib/infowar/types";

interface NewsTickerCardProps {
  post: MediaPost;
  age: string;
}

export function NewsTickerCard({ post, age }: NewsTickerCardProps) {
  return (
    <div className="border-l-2 border-[var(--color-terminal-red)] bg-[var(--color-tactical-dark)] px-2 py-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-[var(--color-terminal-red)] text-[var(--color-tactical-dark)] px-1 font-bold">
          {post.persona.avatar}
        </span>
        <span className="text-xs text-[var(--color-terminal-red)] uppercase tracking-wider">
          {post.persona.name}
        </span>
        <span className="text-xs text-[var(--color-tactical-text-dim)] ml-auto shrink-0">
          {age}
        </span>
      </div>
      <p className="text-sm text-[var(--color-terminal-red)] font-bold uppercase leading-snug tracking-wide">
        {post.content}
      </p>
    </div>
  );
}
