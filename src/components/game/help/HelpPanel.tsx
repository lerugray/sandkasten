"use client";

import { useState } from "react";

interface HelpPanelProps {
  onClose: () => void;
}

type HelpTab = "controls" | "concepts" | "sidebar" | "infowar";

export function HelpPanel({ onClose }: HelpPanelProps) {
  const [tab, setTab] = useState<HelpTab>("controls");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded-lg w-[520px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-tactical-border)] shrink-0">
          <span
            className="text-lg text-[var(--color-terminal-green)] font-bold tracking-widest"
            style={{ fontFamily: "IBM Plex Sans, sans-serif" }}
          >
            HELP
          </span>
          <button
            onClick={onClose}
            aria-label="Close help"
            className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer text-base px-2 py-1"
          >
            [ESC]
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-tactical-border)] shrink-0">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              aria-selected={tab === id}
              className={`flex-1 py-2 text-sm uppercase tracking-wider cursor-pointer ${
                tab === id
                  ? "text-[var(--color-terminal-green)] border-b border-[var(--color-terminal-green)]"
                  : "text-[var(--color-tactical-text-dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 text-sm text-[var(--color-tactical-text)] leading-relaxed space-y-4">
          {tab === "controls" && <ControlsTab />}
          {tab === "concepts" && <ConceptsTab />}
          {tab === "sidebar" && <SidebarTab />}
          {tab === "infowar" && <InfoWarTab />}
        </div>
      </div>
    </div>
  );
}

const TABS: { id: HelpTab; label: string }[] = [
  { id: "controls", label: "Controls" },
  { id: "concepts", label: "Game" },
  { id: "sidebar", label: "Sidebar" },
  { id: "infowar", label: "Media" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[var(--color-terminal-green)] text-sm font-bold uppercase tracking-wider mb-1">
      {children}
    </h3>
  );
}

function KeyLabel({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-[var(--color-tactical-border)] text-[var(--color-tactical-text)] px-1.5 py-0.5 rounded text-xs font-bold">
      {children}
    </kbd>
  );
}

function ControlsTab() {
  return (
    <>
      <SectionTitle>Keyboard</SectionTitle>
      <div className="space-y-1">
        <div><KeyLabel>Space</KeyLabel> Pause / resume the simulation</div>
        <div><KeyLabel>H</KeyLabel> or <KeyLabel>?</KeyLabel> Open this help panel</div>
        <div><KeyLabel>Esc</KeyLabel> Close panels and deselect units</div>
      </div>

      <SectionTitle>Mouse</SectionTitle>
      <div className="space-y-1">
        <div><span className="text-[var(--color-terminal-amber)]">Click unit</span> — Select it. Opens orders and detail panels.</div>
        <div><span className="text-[var(--color-terminal-amber)]">Shift + click unit</span> — Pin its sensor range ring on the map.</div>
        <div><span className="text-[var(--color-terminal-amber)]">Click map</span> — While in waypoint mode, places a waypoint.</div>
      </div>

      <SectionTitle>Placing Waypoints</SectionTitle>
      <div className="space-y-1">
        <div>1. Select a friendly unit.</div>
        <div>2. Click ADD WAYPOINT in the orders panel.</div>
        <div>3. Click the map to drop waypoints along the route.</div>
        <div>4. Click ADD WAYPOINT again to stop placing.</div>
      </div>
    </>
  );
}

function ConceptsTab() {
  return (
    <>
      <SectionTitle>Time Controls</SectionTitle>
      <p>
        The simulation runs in continuous time. Pause whenever you need to think.
        Speed multipliers (1x through 60x) compress simulated time — at 10x, one
        real second covers ten simulated seconds.
      </p>

      <SectionTitle>Detection</SectionTitle>
      <p>
        You only see what your sensors detect. Radar reaches far but announces
        your position to anyone with ESM (electronic support measures). ESM is
        passive — it detects radar emitters without revealing your own location.
        Visual detection works at short range regardless of emissions.
      </p>

      <SectionTitle>Contact Classification</SectionTitle>
      <div className="space-y-1">
        <div><span className="text-[var(--color-tactical-text-dim)]">UNK</span> — Unknown. Bearing and rough range only.</div>
        <div><span className="text-[var(--color-terminal-amber)]">DET</span> — Detected. Position known, type unknown.</div>
        <div><span className="text-[var(--color-terminal-red)]">CLS</span> — Classified. Platform type identified.</div>
        <div><span className="text-[var(--color-terminal-red)]">TRK</span> — Tracked. Continuous position updates.</div>
      </div>
      <p>
        Contacts age over time. Without fresh sensor data, a tracked contact
        degrades to classified, then fades from the map entirely.
      </p>

      <SectionTitle>Throttle Settings</SectionTitle>
      <div className="space-y-1">
        <div><span className="text-[var(--color-terminal-green)]">LOITER</span> — Minimum speed. Conserves fuel, extends station time.</div>
        <div><span className="text-[var(--color-terminal-green)]">CRUISE</span> — Standard transit speed.</div>
        <div><span className="text-[var(--color-terminal-green)]">FULL</span> — High speed. Closes distance fast.</div>
        <div><span className="text-[var(--color-terminal-green)]">FLANK</span> — Maximum speed. Burns fuel quickly.</div>
      </div>

      <SectionTitle>Radar Toggle</SectionTitle>
      <p>
        Turning your radar off makes you harder to detect but blinds your own
        sensors to everything except ESM and visual range. Toggle radar per-unit
        based on whether you need to see or need to hide.
      </p>

      <SectionTitle>Combat</SectionTitle>
      <p>
        Units engage based on their side{"'"}s rules of engagement (ROE). Weapons
        launch, fly to the target, and face defensive systems — chaff, ECM, CIWS.
        Each weapon has a probability of kill. Damage ranges from minor to
        destroyed. Ships can absorb multiple hits; aircraft usually cannot.
      </p>
    </>
  );
}

function SidebarTab() {
  return (
    <>
      <SectionTitle>Forces Tab</SectionTitle>
      <p>
        Lists your units. Click one to select it. Below the unit list: the
        orders panel (waypoints, throttle, radar) for the selected unit, and a
        contact list showing everything your sensors have detected.
      </p>

      <SectionTitle>Intel Tab</SectionTitle>
      <p>
        Scenario messages from the event system — briefings, intel updates,
        warnings. Unread messages show an amber badge on the tab. Click a
        message to mark it read.
      </p>

      <SectionTitle>Combat Tab</SectionTitle>
      <p>
        Weapons currently in flight and a log of combat events. The log uses
        shorthand:
      </p>
      <div className="space-y-1">
        <div><span className="text-[var(--color-terminal-amber)]">{">>"}</span> — Weapon launched</div>
        <div><span className="text-[var(--color-terminal-red)]">{"**"}</span> — Weapon hit target</div>
        <div><span className="text-[var(--color-terminal-green)]">{"[]"}</span> — Defenses intercepted the weapon</div>
        <div><span className="text-[var(--color-terminal-red)]">XX</span> — Unit destroyed</div>
      </div>

      <SectionTitle>Media Tab</SectionTitle>
      <p>
        Simulated media coverage of in-game events. Requires Ollama running
        locally. See the Media help tab for setup details.
      </p>
    </>
  );
}

function InfoWarTab() {
  return (
    <>
      <SectionTitle>Media Feed</SectionTitle>
      <p>
        Game events produce simulated media coverage. A missile strike generates
        wire service bulletins, cable news tickers, social media posts, and
        civilian reactions — each written by a different AI persona.
      </p>

      <SectionTitle>Era and Channels</SectionTitle>
      <p>
        A 1988 scenario produces radio broadcasts, newspaper headlines, and
        cable news tickers. A 2026 scenario adds tweets, Telegram posts, and
        OSINT analyst accounts. No social media in a Cold War scenario.
      </p>

      <SectionTitle>Setup</SectionTitle>
      <div className="space-y-1">
        <div>1. Install Ollama from ollama.com</div>
        <div>2. Open a terminal and run: <KeyLabel>ollama pull mistral</KeyLabel></div>
        <div>3. Start the game. The Media tab connects on its own.</div>
      </div>
      <p>
        Green dot = connected. Red dot = Ollama not running. The game works
        without it — the Media tab stays empty.
      </p>

      <SectionTitle>Personas</SectionTitle>
      <p>
        State media spins events for their side. Wire services report facts.
        OSINT accounts cite coordinates and timestamps. Troll farms amplify
        and distort. Consider the source.
      </p>
    </>
  );
}
