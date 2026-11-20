import type { ReactNode } from "react";

/**
 * Keep hyphenated / parenthesised tokens (C-802, (CVN-68)) on one glyph run. Breaks stay at the spaces
 * the caller already chose; a soft wrap must not cut inside those tokens.
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
