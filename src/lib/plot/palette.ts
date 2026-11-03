// Terminal register palette. One phosphor hue, one alarm hue, plus the
// near-black field. Keep in sync with the --tx-* variables in
// src/app/play/terminal.css.
export const PALETTE = {
  field: "#020604",
  land: "#08200f",
  phosphor: "#4cf58e",
  phosphorHi: "#cfffe0",
  phosphorDim: "#2b9e5c",
  phosphorFaint: "#16502f",
  alarm: "#ff4b3a",
  alarmDim: "#9e2a20",
} as const;
