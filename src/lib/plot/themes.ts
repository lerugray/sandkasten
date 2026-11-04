// Display modes for /play. Only how the plot draws changes between them; the
// simulation, controls and data are identical. CSS for the chrome lives in
// src/app/play/terminal.css under .tx-mode-<id>.

export type DisplayMode = "crt" | "current" | "offsig";

export const DISPLAY_MODES: DisplayMode[] = ["crt", "current", "offsig"];

export const DISPLAY_MODE_NAMES: Record<DisplayMode, string> = {
  crt: "CRT",
  current: "CURRENT",
  offsig: "ADMIRALTY DUSK (OFF-SIGNATURE)",
};

export interface PlotTheme {
  field: string;
  land: string;
  coast: string;
  coastAlpha: number;
  contour: string;
  contourAlpha: number;
  border: string;
  grid: string;
  gridMajor: number;
  gridMinor: number;
  relief: string;
  friendly: string;
  hostile: string;
  unknown: string;
  hi: string;
  alarm: string;
  weaponFriendly: string;
  weaponHostile: string;
  ringFriendly: string;
  ringHostile: string;
  /** symbol glyph: CSS px size, stroke, optional knockout fill */
  symbolSize: number;
  symbolStroke: number;
  symbolKnockout: string | null;
  /** multiplier on every line width */
  lineScale: number;
  /** linework mixes toward the field colour instead of adding light */
  matte: boolean;
  post: "bloom" | "crt" | "none";
  sweeps: boolean;
  sweepAlpha: number;
}

export const THEMES: Record<DisplayMode, PlotTheme> = {
  // Round 3's look, unchanged, for an honest comparison
  current: {
    field: "#020604",
    land: "#08200f",
    coast: "#4cf58e",
    coastAlpha: 0.5,
    contour: "#2b9e5c",
    contourAlpha: 1,
    border: "#2b9e5c",
    grid: "#16502f",
    gridMajor: 0.9,
    gridMinor: 0.5,
    relief: "#16502f",
    friendly: "#4cf58e",
    hostile: "#ff4b3a",
    unknown: "#2b9e5c",
    hi: "#cfffe0",
    alarm: "#ff4b3a",
    weaponFriendly: "#4cf58e",
    weaponHostile: "#ff4b3a",
    ringFriendly: "#4cf58e",
    ringHostile: "#ff4b3a",
    symbolSize: 22,
    symbolStroke: 3,
    symbolKnockout: null,
    lineScale: 1,
    matte: false,
    post: "bloom",
    sweeps: true,
    sweepAlpha: 0.75,
  },
  // A classic monochrome monitor: one phosphor, brightness for hierarchy,
  // shape tells friend from foe, alarm only when something is coming at you
  crt: {
    field: "#030603",
    land: "#071209",
    coast: "#5cff8f",
    coastAlpha: 0.55,
    contour: "#2e8f55",
    contourAlpha: 0.55,
    border: "#2e8f55",
    grid: "#5cff8f",
    // ~8-10% intensity: the glow pass lifts it a little on screen
    gridMajor: 0.08,
    gridMinor: 0.045,
    relief: "#123a20",
    friendly: "#5cff8f",
    hostile: "#e6fff0",
    unknown: "#2f9a5a",
    hi: "#ffffff",
    alarm: "#ff6a3d",
    weaponFriendly: "#5cff8f",
    weaponHostile: "#ff6a3d",
    ringFriendly: "#5cff8f",
    ringHostile: "#e6fff0",
    symbolSize: 30,
    symbolStroke: 5,
    symbolKnockout: "#030603",
    lineScale: 1.6,
    matte: false,
    post: "crt",
    sweeps: true,
    sweepAlpha: 0.55,
  },
  // Admiralty Dusk, designed by Argon (off-signature): a matte ECDIS chart
  // on deep slate, desaturated inks, no effects
  offsig: {
    field: "#14181D",
    land: "#1E232A",
    coast: "#323B46",
    coastAlpha: 1,
    contour: "#2A323C",
    contourAlpha: 1,
    border: "#2A323C",
    grid: "#222932",
    gridMajor: 1,
    gridMinor: 1,
    relief: "#2A3038",
    friendly: "#4EA8DE",
    hostile: "#D64F45",
    unknown: "#D9B24C",
    hi: "#F4F1EA",
    alarm: "#D64F45",
    weaponFriendly: "#E87A3E",
    weaponHostile: "#E87A3E",
    ringFriendly: "#36414F",
    ringHostile: "#36414F",
    symbolSize: 16,
    symbolStroke: 2.4,
    symbolKnockout: "#14181D",
    lineScale: 1,
    matte: true,
    post: "none",
    sweeps: false,
    sweepAlpha: 0,
  },
};

export function isDisplayMode(v: unknown): v is DisplayMode {
  return v === "crt" || v === "current" || v === "offsig";
}
