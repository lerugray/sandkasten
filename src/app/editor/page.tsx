"use client";

import { useState, useCallback, useRef } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { UnitPlacer } from "@/components/editor/UnitPlacer";
import { ScenarioSettings } from "@/components/editor/ScenarioSettings";
import type { Scenario, Unit, Side, Position } from "@/types/game";
import { ClassicFonts } from "@/components/ClassicFonts";
import { parseScenarioFile } from "@/lib/scenarios/parseScenario";
import { exampleSnapshotScenario, withFacilities } from "@/lib/snapshot/example";

const DEFAULT_SCENARIO: Scenario = {
  name: "New Scenario",
  description: "",
  briefing: "",
  theater: {
    center: { lng: 56.5, lat: 26.5 },
    zoom: 7,
  },
  startTime: new Date().toISOString(),
  playerSide: "Side A",
  sides: [
    { name: "Side A", color: "#00aaff", isAI: false, units: [] },
    { name: "Side B", color: "#ff4444", isAI: true, units: [] },
  ],
  referencePoints: [],
};

export default function EditorPage() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activePanel, setActivePanel] = useState<"none" | "place" | "settings">("none");
  const [placingSide, setPlacingSide] = useState<string>("Side A");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMessage, setFileMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });

  const allUnits = scenario.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId ? allUnits.find((u) => u.id === selectedUnitId) : null;

  const handleUnitSelect = useCallback(
    (unitId: string | null, shiftKey?: boolean) => {
      if (unitId && shiftKey) {
        setPinnedRingIds((prev) => {
          const next = new Set(prev);
          next.has(unitId) ? next.delete(unitId) : next.add(unitId);
          return next;
        });
      }
      setSelectedUnitId(unitId);
    },
    []
  );

  const addUnit = useCallback(
    (unit: Unit) => {
      setScenario((prev) => ({
        ...prev,
        sides: prev.sides.map((side) =>
          side.name === unit.side
            ? { ...side, units: [...side.units, unit] }
            : side
        ),
      }));
    },
    []
  );

  const handleUnitDrag = useCallback(
    (unitId: string, position: { lat: number; lng: number }) => {
      setScenario((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => ({
          ...side,
          units: side.units.map((u) =>
            u.id === unitId ? { ...u, position } : u
          ),
        })),
      }));
    },
    []
  );

  const removeUnit = useCallback(
    (unitId: string) => {
      setScenario((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => ({
          ...side,
          units: side.units.filter((u) => u.id !== unitId),
        })),
      }));
      setSelectedUnitId(null);
    },
    []
  );

  const updateScenarioMeta = useCallback(
    (updates: Partial<Scenario>) => {
      setScenario((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const saveScenario = useCallback(() => {
    const json = JSON.stringify(scenario, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.name.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    // Revoking in the same tick can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [scenario]);

  // The picker input lives in the page (hidden), not detached, so every browser opens its chooser.
  const loadScenario = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onScenarioFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // choosing the same file twice must fire again
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseScenarioFile(String(reader.result ?? ""));
      if (!parsed.ok) {
        setFileMessage({ kind: "error", text: parsed.error });
        return;
      }
      setScenario(parsed.scenario);
      setSelectedUnitId(null);
      setPinnedRingIds(new Set());
      setPlacingSide(parsed.scenario.sides[0]?.name ?? "Side A");
      setFileMessage({ kind: "ok", text: `Loaded ${parsed.scenario.name}` });
    };
    reader.onerror = () => setFileMessage({ kind: "error", text: "Could not read that file." });
    reader.readAsText(file);
  }, []);

  const openScenario = useCallback((loaded: Scenario) => {
    setScenario(loaded);
    setSelectedUnitId(null);
    setPinnedRingIds(new Set());
    setPlacingSide(loaded.sides[0]?.name ?? "Side A");
    setActivePanel("none");
  }, []);

  // The committed example: a file in data/snapshots, imported at build time.
  const openSnapshot = useCallback(() => {
    openScenario(exampleSnapshotScenario);
    setSnapshotStatus({ busy: false, message: `Opened ${exampleSnapshotScenario.snapshot?.fetchedAt ?? "snapshot"}` });
  }, [openScenario]);

  // A fresh one: the server fetches adsb.lol (rate limited, keyless) and builds the same scenario.
  const fetchSnapshot = useCallback(async () => {
    setSnapshotStatus({ busy: true, message: "Contacting adsb.lol..." });
    try {
      const res = await fetch("/api/snapshot?civil=1");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      openScenario(withFacilities(body as Scenario));
      setSnapshotStatus({ busy: false, message: `Fetched ${(body as Scenario).snapshot?.fetchedAt ?? "snapshot"}` });
    } catch (err) {
      setSnapshotStatus({ busy: false, message: `Fetch failed: ${err instanceof Error ? err.message : "unknown error"}` });
    }
  }, [openScenario]);

  return (
    <div className={`h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)] ${theme === "light" ? "theme-light" : ""}`}>
      <ClassicFonts />
      {/* Header */}
      <div className="h-8 flex items-center px-3 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <a
          href="/"
          className="text-[var(--color-terminal-green)] text-sm font-bold tracking-widest mr-3 hover:underline"
          style={{ fontFamily: "IBM Plex Sans, sans-serif" }}
        >
          SANDKASTEN
        </a>
        <span className="text-[var(--color-terminal-amber)] text-xs font-bold tracking-wider">
          EDITOR
        </span>
        <span className="text-[var(--color-tactical-text-dim)] text-xs ml-3">
          {scenario.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {fileMessage && (
            <span
              role="status"
              data-testid="editor-file-message"
              className={`text-xs ${fileMessage.kind === "error" ? "text-[var(--color-terminal-amber)]" : "text-[var(--color-tactical-text-dim)]"}`}
            >
              {fileMessage.text}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onScenarioFile}
            className="hidden"
            data-testid="editor-load-input"
          />
          <button
            onClick={loadScenario}
            data-testid="editor-load"
            className="text-xs text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            LOAD
          </button>
          <button
            onClick={saveScenario}
            data-testid="editor-save"
            className="text-xs text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            SAVE
          </button>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="text-xs text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            {theme === "dark" ? "LIGHT" : "DARK"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Editor sidebar */}
        <EditorToolbar
          scenario={scenario}
          activePanel={activePanel}
          placingSide={placingSide}
          onSetActivePanel={setActivePanel}
          onSetPlacingSide={setPlacingSide}
          selectedUnit={selectedUnit ?? undefined}
          onRemoveUnit={removeUnit}
          onOpenSnapshot={openSnapshot}
          onFetchSnapshot={fetchSnapshot}
          snapshotStatus={snapshotStatus}
        />

        {/* Map area */}
        <div className="flex-1 relative">
          <MapWrapper
            scenario={scenario}
            selectedUnitId={selectedUnitId}
            pinnedRingIds={pinnedRingIds}
            theme={theme}
            onUnitSelect={handleUnitSelect}
            onUnitDrag={handleUnitDrag}
          />

          {activePanel === "place" && (
            <UnitPlacer
              side={placingSide}
              onPlace={addUnit}
            />
          )}

          {activePanel === "settings" && (
            <ScenarioSettings
              scenario={scenario}
              onUpdate={updateScenarioMeta}
              onClose={() => setActivePanel("none")}
            />
          )}

          {selectedUnit && activePanel === "none" && (
            <DetailPanel
              unit={selectedUnit}
              onClose={() => setSelectedUnitId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
