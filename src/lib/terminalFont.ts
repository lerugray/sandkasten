/** Terminal face for /play and /database. Override with ?font=vt323|glasstty|ibm3270. */

export type TerminalFontId = "vt323" | "glasstty" | "ibm3270";

/** Proposal default after SAND-FONT1 capture compare (seat may override). */
export const DEFAULT_TERMINAL_FONT: TerminalFontId = "vt323";

export const TERMINAL_FONT_FAMILY: Record<TerminalFontId, string> = {
  vt323: "VT323",
  glasstty: "Glass TTY VT220",
  ibm3270: "IBM 3270",
};

export const TERMINAL_FONT_FILES: Record<TerminalFontId, string[]> = {
  vt323: ["/fonts/vt323/vt323-latin-400-normal.woff2"],
  glasstty: ["/fonts/glasstty/Glass_TTY_VT220.woff2"],
  ibm3270: ["/fonts/ibm3270/3270-Regular.woff2"],
};

export function resolveTerminalFont(raw: string | null | undefined): TerminalFontId {
  if (raw === "vt323" || raw === "glasstty" || raw === "ibm3270") return raw;
  return DEFAULT_TERMINAL_FONT;
}

export function terminalFontFromSearch(search?: string): TerminalFontId {
  const q = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return resolveTerminalFont(new URLSearchParams(q).get("font"));
}
