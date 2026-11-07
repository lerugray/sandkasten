export type Box = { kind: string; id: string; x: number; y: number; w: number; h: number };

/** Every pair of boxes whose rectangles overlap by more than `eps` px on both axes. Boxes with the same non-empty `group` never count against each other. */
export function findOverlaps(boxes: (Box & { group?: string })[], eps = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.group && a.group === b.group) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > eps && oy > eps) {
        out.push(`${a.kind}:${a.id} [${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.w)}x${Math.round(a.h)}] x ${b.kind}:${b.id} [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}]`);
      }
    }
  }
  return out;
}
