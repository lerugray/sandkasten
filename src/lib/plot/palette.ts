// Terminal register palette. One phosphor hue, one alarm hue, plus the
// near-black field. Keep in sync with the --tx-* variables in
// src/app/play/terminal.css.
//
// `caution` (amber) is the one colour outside those two families. It carries a meaning the player needs at a
// glance: a contact the sensors hold but have not identified (UNK, DET). Before it, an unidentified contact was a
// dimmer shade of the player's own green, so "mine" and "nobody knows whose" differed only in brightness.
// Green = own, red = hostile, amber = not yet known. Nothing else may use it.
export const PALETTE = {
  field: "#020604",
  land: "#08200f",
  phosphor: "#4cf58e",
  phosphorHi: "#cfffe0",
  phosphorDim: "#2b9e5c",
  phosphorFaint: "#16502f",
  alarm: "#ff4b3a",
  alarmDim: "#9e2a20",
  caution: "#f5c451",
  cautionDim: "#9a7a2c",
} as const;
