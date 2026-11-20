// Short on-map names for facilities. Rule-based, never cuts a word: known long words are abbreviated first,
// then whole trailing words are dropped until the label fits.
const ABBREVIATIONS: [RegExp, string][] = [
  [/\binternational\s+airport\b/gi, "Intl"],
  [/\binternational\b/gi, "Intl"],
  [/\bairport\b/gi, "Apt"],
  [/\bnaval\s+base\b/gi, "Naval Base"],
  [/\bheliport\b/gi, "Heli"],
  [/\bhelipad\b/gi, "Heli"],
  [/\bvertiport\b/gi, "Vertiport"],
  [/\buniversity\b/gi, "Univ"],
  [/\bhospital\b/gi, "Hosp"],
  [/\bterminals?\b/gi, "Term"],
];

const TRAILING_NOISE = /[\s,;:/&-]+$/;

export const FACILITY_LABEL_MAX = 22;

export function shortFacilityName(name: string, max: number = FACILITY_LABEL_MAX): string {
  let s = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, to] of ABBREVIATIONS) {
    const next = s.replace(re, to).trim();
    if (next.length >= 3) s = next;
    if (s.length <= max) break;
  }
  if (s.length <= max) return s;
  const words = s.split(" ");
  while (words.length > 1 && words.join(" ").length > max) words.pop();
  const out = words.join(" ").replace(TRAILING_NOISE, "");
  // a single word longer than max stays whole (never cut mid-word)
  return out || s;
}
