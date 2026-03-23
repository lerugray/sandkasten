"use client";

import type { EventMessage } from "@/lib/ai/events";

interface MessageLogProps {
  messages: EventMessage[];
  simTime: number;
  onMarkRead: (messageId: string) => void;
}

export function MessageLog({ messages, simTime, onMarkRead }: MessageLogProps) {
  if (messages.length === 0) {
    return (
      <div className="text-[var(--color-tactical-text-dim)] text-center py-4 italic">
        No messages
      </div>
    );
  }

  // Show newest first
  const sorted = [...messages].sort((a, b) => b.time - a.time);
  const unreadCount = sorted.filter((m) => !m.read).length;

  return (
    <div className="space-y-2">
      {unreadCount > 0 && (
        <div className="text-[var(--color-terminal-amber)] text-[10px] uppercase tracking-wider">
          {unreadCount} unread
        </div>
      )}
      {sorted.map((msg) => {
        const ageMs = simTime - msg.time;
        const ageMins = Math.floor(ageMs / 60000);
        const ageStr =
          ageMins < 1 ? "just now" : ageMins < 60 ? `${ageMins}m ago` : `${Math.floor(ageMins / 60)}h ago`;

        return (
          <button
            key={msg.id}
            onClick={() => onMarkRead(msg.id)}
            className={`w-full text-left p-2 rounded border cursor-pointer transition-colors ${
              msg.read
                ? "border-[var(--color-tactical-border)] opacity-60"
                : "border-[var(--color-terminal-amber)] bg-[var(--color-terminal-amber)]/5"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              {msg.title && (
                <span
                  className={`font-bold text-[10px] uppercase tracking-wider ${
                    msg.read
                      ? "text-[var(--color-tactical-text-dim)]"
                      : "text-[var(--color-terminal-amber)]"
                  }`}
                >
                  {msg.title}
                </span>
              )}
              <span className="text-[var(--color-tactical-text-dim)] text-[9px] ml-auto">
                {ageStr}
              </span>
            </div>
            <div className="text-[var(--color-tactical-text)] text-[11px] leading-relaxed">
              {msg.text}
            </div>
          </button>
        );
      })}
    </div>
  );
}
