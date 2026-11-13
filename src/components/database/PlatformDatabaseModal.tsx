"use client";

import { PlatformDatabase } from "./PlatformDatabase";
import "@/app/terminal-font.css";
import "@/app/database/database.css";

export interface PlatformDatabaseModalProps {
  platformId: number | string;
  onClose: () => void;
}

export function PlatformDatabaseModal({ platformId, onClose }: PlatformDatabaseModalProps) {
  return (
    <div className="db-modal" data-testid="db-modal" role="dialog" aria-label="Platform manual">
      <PlatformDatabase initialId={platformId} onClose={onClose} />
    </div>
  );
}
