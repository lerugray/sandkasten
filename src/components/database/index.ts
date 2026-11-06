export { PlatformDatabase } from "./PlatformDatabase";
export { PlatformDatabaseModal } from "./PlatformDatabaseModal";
export type { PlatformDatabaseModalProps } from "./PlatformDatabaseModal";

// Numeric engine ids and legacy aliases resolve through ?id=, first-party slugs through ?slug=.
export function getPlatformDatabaseHref(platformId: number | string): string {
  return typeof platformId === "number" || !Number.isNaN(Number(platformId))
    ? `/database?id=${platformId}`
    : `/database?slug=${encodeURIComponent(platformId)}`;
}
