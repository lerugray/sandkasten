"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/types/game";
import { parseScenarioFile } from "@/lib/scenarios/parseScenario";
import { editorScenarioConfig } from "@/lib/scenarios/victoryConditions";
import { TerminalPlayView } from "@/components/terminal/TerminalPlay";
import { LegacyPlay } from "./LegacyPlay";

export const EDITOR_SCENARIO_KEY = "sandkasten-editor-scenario";

type State = { kind: "loading" } | { kind: "ready"; scenario: Scenario } | { kind: "error"; message: string };

// /play?scenario=editor plays the scenario the editor's PLAY button just stored in localStorage. It is a real
// player path: the editor hands the same JSON it saves to the play screen, which validates it exactly like LOAD.
export function EditorPlay({ legacy }: { legacy: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EDITOR_SCENARIO_KEY);
      if (!raw) {
        setState({ kind: "error", message: "No editor scenario found. Build one in the editor, then press PLAY." });
        return;
      }
      const parsed = parseScenarioFile(raw);
      if (!parsed.ok) {
        setState({ kind: "error", message: parsed.error });
        return;
      }
      setState({ kind: "ready", scenario: parsed.scenario });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "The editor scenario could not be read." });
    }
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-tactical-dark)] text-[var(--color-tactical-text-dim)] text-sm">
        Loading scenario…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-tactical-dark)]">
        <div className="max-w-md text-center">
          <div className="text-[var(--color-terminal-amber)] text-sm mb-4" data-testid="editor-play-error">
            {state.message}
          </div>
          <a href="/editor" className="text-[var(--color-terminal-green)] text-sm underline">
            BACK TO EDITOR
          </a>
        </div>
      </div>
    );
  }

  const config = editorScenarioConfig(state.scenario);
  return legacy ? (
    <LegacyPlay key="editor-legacy" config={config} />
  ) : (
    <TerminalPlayView key="editor-run" config={config} restored={null} allowBattleFile={false} />
  );
}
