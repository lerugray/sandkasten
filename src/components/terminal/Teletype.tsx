"use client";

export interface TtyLine {
  id: string;
  time: number;
  tag: string;
  text: string;
  alarm: boolean;
}

const VISIBLE = 6;

function hhmmss(t: number) {
  return new Date(t).toISOString().slice(11, 19);
}

// Message traffic as teletype: the newest line prints in character by
// character (a CSS steps() reveal that runs once when the line mounts). The
// map scale bar rides in the header: opaque chrome, so no map content is ever under it.
export function Teletype({ lines, scale }: { lines: TtyLine[]; scale?: React.ReactNode }) {
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
          const n = Math.min(body.length, 120);
          return (
            <div
              key={l.id}
              className={`tx-tty-line${l.alarm ? " is-alarm" : ""}`}
              data-testid="teletype-line"
              title={body}
              style={{ "--n": n, "--d": `${Math.min(1100, n * 14)}ms` } as React.CSSProperties}
            >
              <span className="tx-tty-text">{body}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
