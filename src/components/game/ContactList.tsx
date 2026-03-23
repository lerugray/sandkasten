"use client";

import type { Contact } from "@/lib/simulation/gameState";

interface ContactListProps {
  contacts: Contact[];
  simTime: number;
  onContactClick?: (contact: Contact) => void;
}

const CLASSIFICATION_COLORS: Record<Contact["classification"], string> = {
  unknown: "var(--color-tactical-text-dim)",
  detected: "var(--color-terminal-amber)",
  classified: "var(--color-terminal-red)",
  tracked: "var(--color-terminal-red)",
};

const CLASSIFICATION_LABELS: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

export function ContactList({ contacts, simTime, onContactClick }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-[var(--color-tactical-text-dim)] text-xs p-2">
        No contacts detected
      </div>
    );
  }

  // Sort: tracked first, then classified, then detected, then unknown
  const sorted = [...contacts].sort((a, b) => {
    const order: Contact["classification"][] = ["tracked", "classified", "detected", "unknown"];
    return order.indexOf(a.classification) - order.indexOf(b.classification);
  });

  return (
    <div className="space-y-1">
      {sorted.map((contact) => {
        const age = Math.floor((simTime - contact.lastUpdateTime) / 1000);
        const isStale = age > 30;

        return (
          <button
            key={contact.id}
            onClick={() => onContactClick?.(contact)}
            className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-[var(--color-tactical-border)] cursor-pointer ${
              isStale ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="font-bold text-[10px] w-6"
                style={{ color: CLASSIFICATION_COLORS[contact.classification] }}
              >
                {CLASSIFICATION_LABELS[contact.classification]}
              </span>
              <span className="text-[var(--color-tactical-text)] truncate flex-1">
                {contact.platformName ?? `Contact ${contact.id.slice(-4)}`}
              </span>
              <span className="text-[var(--color-tactical-text-dim)] text-[10px]">
                {contact.sensorType.toUpperCase()}
              </span>
            </div>
            <div className="text-[10px] text-[var(--color-tactical-text-dim)] ml-8">
              {contact.position.lat.toFixed(2)}N {contact.position.lng.toFixed(2)}E
              {age > 0 && ` · ${age}s ago`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
