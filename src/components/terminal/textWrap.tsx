"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

/**
 * `text` with its line turns written in as newlines, taken at spaces only, for a line of `cols` characters whose
 * first line already holds `lead` of them. Fewest lines first, then the narrowest measure that keeps that count, so
 * a second line is not left with one word. The browser's own wrap also turns after a hyphen, which split "C-802",
 * "(CVN-68)" and the "->" of a weapon row, and no CSS wrap mode forbids that turn; so the turns are chosen here.
 * The words are untouched. Before the first measurement (`cols` 0) the text is returned as it came.
 */
export function turnAtSpaces(text: string, cols: number, lead = 0): string {
  if (cols <= lead) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const lay = (width: number) => {
    const lines: string[] = [];
    let line = "";
    let room = width - lead;
    let fits = true;
    for (const w of words) {
      if (line && line.length + 1 + w.length > room) {
        lines.push(line);
        line = w;
        room = width;
      } else line = line ? `${line} ${w}` : w;
      if (line.length > room) fits = false;
    }
    lines.push(line);
    return { lines, fits };
  };
  let { lines } = lay(cols);
  if (lines.length === 1) return text;
  for (let width = cols - 1; width > lead; width--) {
    const narrower = lay(width);
    if (!narrower.fits || narrower.lines.length !== lines.length) break;
    lines = narrower.lines;
  }
  // If the last line is still a single word, pull the previous word down when both fit.
  if (lines.length >= 2) {
    const last = lines[lines.length - 1]!.split(/\s+/).filter(Boolean);
    if (last.length === 1) {
      const prevWords = lines[lines.length - 2]!.split(/\s+/).filter(Boolean);
      if (prevWords.length >= 2) {
        const moved = prevWords[prevWords.length - 1]!;
        const combined = `${moved} ${last[0]}`;
        if (combined.length <= cols) {
          lines = [
            ...lines.slice(0, -2),
            prevWords.slice(0, -1).join(" "),
            combined,
          ];
        }
      }
    }
  }
  return lines.join("\n");
}

/**
 * Keep hyphenated / parenthetical tokens (C-802, (CVN-68)) on one glyph run. Breaks stay at the spaces
 * turnAtSpaces already chose; a soft wrap must not cut inside those tokens.
 */
export function nowrapTokens(text: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /(\S+)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[1];
    if (/[-–—/]/.test(tok) || /^\([^)]*\)$/.test(tok)) {
      out.push(<span key={n++} className="tx-nowrap">{tok}</span>);
    } else {
      out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : out;
}

/**
 * A block that knows how many characters fit across it (the terminal face is monospace) and hands that count to
 * its children. The count comes from a hidden probe as wide as the block's content, holding a rule 10ch long; both
 * are watched, so a resize, a scrollbar or the web font arriving re-measures. The first count lands before paint.
 * The probe inherits the block's font, so the lines measured for must be set in that same size.
 */
export function Measured({
  children,
  ...rest
}: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & { children: (cols: number) => React.ReactNode }) {
  const [cols, setCols] = useState(0);
  const watch = useRef<ResizeObserver | null>(null);
  const probe = useCallback((el: HTMLSpanElement | null) => {
    watch.current?.disconnect();
    watch.current = null;
    const rule = el?.firstElementChild;
    if (!el || !rule) return;
    const measure = () => {
      const ch = rule.getBoundingClientRect().width / 10;
      setCols(ch > 0 ? Math.floor(el.getBoundingClientRect().width / ch) : 0);
    };
    measure();
    watch.current = new ResizeObserver(measure);
    watch.current.observe(el);
    watch.current.observe(rule);
  }, []);
  return (
    <div {...rest}>
      <span className="tx-cols" ref={probe} aria-hidden="true"><i /></span>
      {children(cols)}
    </div>
  );
}
