import { PLATFORM_RECORDS, getPlatformRecord } from "@/data/platforms";
import type { PlatformRecord } from "@/types/platformDb";

// Sandkasten's own platform database: committed records in src/data/platforms/.
// Nothing here reads data/extraction/ or data/raw/ (local, gitignored, never bundled).

export function getPlatformRecords(): PlatformRecord[] {
  return PLATFORM_RECORDS;
}

export function findPlatformRecord(idOrSlug: string | number): PlatformRecord | undefined {
  return getPlatformRecord(idOrSlug);
}

export function searchPlatformRecords(query: string): PlatformRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLATFORM_RECORDS;
  return PLATFORM_RECORDS.filter((r) =>
    [r.name, r.designation, r.className, r.nation, r.service, r.slug, r.role]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export function isDatabaseAvailable(): boolean {
  return PLATFORM_RECORDS.length > 0;
}
