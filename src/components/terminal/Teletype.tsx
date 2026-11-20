"use client";

import type { ReactNode } from "react";
import { nowrapTokens } from "./nowrap";

export interface TtyLine {
  id: string;
  time: number;
  tag: string;
  text: string;
  alarm: boolean;
}

const VISIBLE = 5; // one row went to the licence footer, so the panel keeps its old height and the plot its old view
// A line longer than this wraps in full inside the panel instead of typing across one row and
// clipping mid-word. 88 characters is safely one row at the narrowest supported window (1280 px).
const TYPE_MAX = 88;

function hhmmss(t: number) {
  return new Date(t).toISOString().slice(11, 19);
}

// Message traffic as teletype: the newest line prints in character by
// character (a CSS steps() reveal that runs once when the line mounts). Lines too
// long for one row wrap in full instead of clipping. The map scale bar rides in the
// header and the licence line in the footer: both opaque chrome, so no map content is ever under them.
export function Teletype({ lines, scale, credit }: { lines: TtyLine[]; scale?: ReactNode; credit?: string }) {
  const shown = lines.slice(-VISIBLE);
  return (
    <section className="tx-panel tx-tty" data-testid="teletype" data-plot-occluder aria-live="polite">
      <div className="tx-tty-head">
        <span>[ TRAFFIC ]</span>
        {scale}
        <span className="tx-dim">{lines.length ? `${lines.length} MSG` : "NO TRAFFIC"}</span>
      </div>
      <div className="tx-tty-body">
        {shown.map((l) => {
          const body = `${hhmmss(l.time)}Z ${l.tag.padEnd(4, " ")} ${l.text}`;
          const type = body.length <= TYPE_MAX;
          return (
            <div
              key={l.id}
              className={`tx-tty-line${l.alarm ? " is-alarm" : ""}${type ? "" : " is-wrap"}`}
              data-testid="teletype-line"
              title={body}
              style={type ? ({ "--n": body.length, "--d": `${Math.min(1100, body.length * 14)}ms` } as React.CSSProperties) : undefined}
            >
              {type ? <span className="tx-tty-text">{body}</span> : <span className="tx-tty-text tx-tty-text--wrap">{nowrapTokens(body)}</span>}
            </div>
          );
        })}
      </div>
      <div className="tx-tty-credit" data-testid="plot-attribution" aria-label="Map data credits">
        {credit}
      </div>
    </section>
  );
}
