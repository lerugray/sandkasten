import type { MediaPost } from "@/lib/infowar/types";

interface NewspaperCardProps {
  post: MediaPost;
  age: string;
}

export function NewspaperCard({ post, age }: NewspaperCardProps) {
  const isWire = post.channel === "wire-bulletin";
  const isGovt = post.channel === "government-communique";

  let label = "NEWSPAPER";
  let color = "var(--color-tactical-text)";
  if (isWire) {
    label = "WIRE SERVICE";
    color = "var(--color-terminal-green)";
  } else if (isGovt) {
    label = "OFFICIAL STATEMENT";
    color = "var(--color-terminal-amber)";
  }

  return (
    <div className="border border-[var(--color-tactical-border)] rounded p-2">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] px-1 rounded font-bold"
          style={{ backgroundColor: color, color: "var(--color-tactical-dark)" }}
        >
          {post.persona.avatar}
        </span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="text-[10px] text-[var(--color-tactical-text-dim)] ml-auto shrink-0">
          {age}
        </span>
      </div>
      <p className="text-sm font-bold leading-snug" style={{ color }}>
        {post.content}
      </p>
      <div className="text-[10px] text-[var(--color-tactical-text-dim)] mt-1">
        — {post.persona.name}
      </div>
    </div>
  );
}
