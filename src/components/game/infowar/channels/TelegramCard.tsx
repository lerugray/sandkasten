import type { MediaPost } from "@/lib/infowar/types";

interface TelegramCardProps {
  post: MediaPost;
  age: string;
}

export function TelegramCard({ post, age }: TelegramCardProps) {
  return (
    <div className="border border-[var(--color-tactical-border)] rounded p-2 bg-[var(--color-tactical-dark)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] bg-[#2AABEE] text-white px-1 rounded font-bold">
          TG
        </span>
        <span className="text-sm text-[#2AABEE] font-bold truncate">
          {post.persona.name}
        </span>
        <span className="text-[10px] text-[var(--color-tactical-text-dim)] ml-auto shrink-0">
          {age}
        </span>
      </div>
      <p className="text-sm text-[var(--color-tactical-text)] leading-snug">
        {post.content}
      </p>
    </div>
  );
}
