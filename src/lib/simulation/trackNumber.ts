/** Stable four-digit display number for a contact id: the plot, selector, staged orders and record all use this one. */
export function trackNumber(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return String(1000 + (Math.abs(h) % 9000));
}
