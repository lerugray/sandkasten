"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SAVE_BYTES, parseBattle, type ParsedSave } from "@/lib/simulation/battleSave";

type OkSave = Extract<ParsedSave, { ok: true }>;

export type SaveNoticeState =
  | { ok: true; name: string; bytes: number; clock: string }
  | { ok: false; message: string };

/** The one line players see beside every save and load control: what a battle file does not hold. */
export const MEDIA_NOT_SAVED = "Generated media posts are not saved. The media feed starts empty after a load.";

const clockOf = (ms: number) => {
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `T+${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)}`;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "reading"; name: string }
  | { kind: "error"; name?: string; message: string }
  | { kind: "ready"; name: string; parsed: OkSave };

/**
 * LOAD BATTLE: a local file, read and validated completely before anything is replaced, previewed, then confirmed
 * deliberately. Cancel or any failure leaves the running battle exactly as it was. The file text is only ever parsed
 * as data and shown as plain text.
 */
export function LoadBattleDialog({
  hasProgress,
  ended,
  onCancel,
  onConfirm,
}: {
  hasProgress: boolean;
  ended: boolean;
  onCancel: () => void;
  /** Returns an error message when the restore could not be completed (the current battle is then unchanged). */
  onConfirm: (parsed: OkSave) => string | null;
}) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const readSeq = useRef(0);
  const confirming = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    chooseRef.current?.focus();
  }, []);

  const read = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const mine = ++readSeq.current; // a newer pick makes this read stale
    setState({ kind: "reading", name: file.name });
    if (file.size > MAX_SAVE_BYTES) {
      setState({ kind: "error", name: file.name, message: `file: larger than the ${Math.round(MAX_SAVE_BYTES / 1048576)} MB limit for a battle file` });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      if (mine === readSeq.current) setState({ kind: "error", name: file.name, message: "The file could not be read. Pick it again." });
      return;
    }
    if (mine !== readSeq.current) return;
    const parsed = parseBattle(text);
    setState(parsed.ok ? { kind: "ready", name: file.name, parsed } : { kind: "error", name: file.name, message: parsed.error });
  }, []);

  const confirm = useCallback(() => {
    if (state.kind !== "ready" || confirming.current) return;
    confirming.current = true;
    const err = onConfirm(state.parsed);
    if (err) {
      confirming.current = false;
      setState({ kind: "error", name: state.name, message: err });
    }
  }, [state, onConfirm]);

  // The dialog owns the keyboard wherever focus is (a click on the backdrop must not strand Esc): Esc cancels,
  // Tab stays inside, and no other key reaches the battle underneath.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key === "Tab" && rootRef.current) {
        const f = [...rootRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (f.length === 0) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 ? 0 : i + 1;
        e.preventDefault();
        f[next].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const p = state.kind === "ready" ? state.parsed.preview : null;
  return (
    <div className="tx-modal-backdrop" data-testid="load-backdrop" onMouseDown={(e) => e.preventDefault()}>
      <div
        ref={rootRef}
        className="tx-panel tx-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Load battle"
        data-testid="load-dialog"
        data-modal
        onKeyUp={(e) => e.stopPropagation()}
      >
        <div className="tx-modal-head">[ LOAD BATTLE ]</div>
        <p className="tx-modal-text">
          Pick a battle file saved on this computer. It is checked completely before anything changes. The battle loads
          paused.
        </p>
        <div className="tx-modal-row">
          <button type="button" ref={chooseRef} className="tx-btn is-on" data-testid="load-choose" onClick={() => inputRef.current?.click()}>
            CHOOSE BATTLE FILE
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="tx-file-input"
            data-testid="load-file"
            aria-label="Battle file"
            tabIndex={-1}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = ""; // the same file can be picked again
            }}
          />
          {state.kind === "reading" && <span className="tx-dim" data-testid="load-status">READING {state.name}</span>}
        </div>
        {state.kind === "error" && (
          <div className="tx-modal-error" role="alert" data-testid="load-error">
            <b>CANNOT LOAD</b>{state.name ? ` ${state.name}` : ""}
            <div>{state.message}</div>
            <div className="tx-dim">Your current battle is unchanged.</div>
          </div>
        )}
        {p && state.kind === "ready" && (
          <div className="tx-modal-preview" data-testid="load-preview">
            <div><b>FILE</b> {state.name}</div>
            <div><b>SCENARIO</b> {p.scenarioName.toUpperCase()}</div>
            <div><b>MISSION CLOCK</b> {clockOf(p.elapsedMs)}</div>
            <div>
              <b>STATE</b>{" "}
              {p.result ? `${p.result.toUpperCase()}: FINISHED. PLAY AGAIN starts a fresh run.` : "IN PROGRESS. Loads paused."}
            </div>
            <div><b>MODE</b> {p.mode === "wego" ? "WEGO" : "CONTINUOUS"}</div>
            <div className="tx-dim">SAVED {p.savedAt.slice(0, 19).replace("T", " ")}Z</div>
          </div>
        )}
        {hasProgress && !ended && (
          <div className="tx-modal-warn" data-testid="load-warning">
            Loading replaces the battle in progress. It is not saved. Use SAVE BATTLE first to keep it.
          </div>
        )}
        {ended && <div className="tx-modal-warn" data-testid="load-warning">Loading replaces this finished battle.</div>}
        <div className="tx-modal-note" data-testid="load-media-note">{MEDIA_NOT_SAVED}</div>
        <div className="tx-modal-actions">
          <button type="button" className="tx-btn is-on" data-testid="load-confirm" disabled={state.kind !== "ready"} onClick={confirm}>
            {hasProgress || ended ? "REPLACE CURRENT BATTLE" : "LOAD THIS BATTLE"}
          </button>
          <button type="button" className="tx-btn" data-testid="load-cancel" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What a save did. The browser is only asked to download the file; whether it reached the disk is the browser's and the
 * player's to know, and the notice says so rather than claiming a verified write.
 */
export function SaveNotice({ notice, onDismiss }: { notice: SaveNoticeState; onDismiss: () => void }) {
  return (
    <div className="tx-panel tx-save-notice" role="status" aria-live="polite" data-testid="save-notice" data-ok={notice.ok ? "true" : "false"} data-plot-occluder>
      {notice.ok ? (
        <>
          <div className="tx-modal-head">[ BATTLE SAVED TO A FILE ]</div>
          <div className="tx-save-name" data-testid="save-name">{notice.name}</div>
          <div>{notice.clock}  //  {(notice.bytes / 1024).toFixed(0)} KB  //  battle paused</div>
          <div className="tx-dim">
            The file was handed to your browser as a download. Sandkasten cannot see where it went or confirm it reached the disk: check your downloads.
          </div>
          <div className="tx-dim">{MEDIA_NOT_SAVED}</div>
        </>
      ) : (
        <>
          <div className="tx-modal-head tx-alarm">[ SAVE FAILED ]</div>
          <div data-testid="save-error">{notice.message}</div>
          <div className="tx-dim">The battle is paused and unchanged. Nothing was written.</div>
        </>
      )}
      <button type="button" className="tx-btn" data-testid="save-dismiss" onClick={onDismiss} onMouseDown={(e) => e.preventDefault()}>
        DISMISS
      </button>
    </div>
  );
}

export { clockOf as battleClock };
