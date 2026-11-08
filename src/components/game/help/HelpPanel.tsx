"use client";

import { useState } from "react";

interface HelpPanelProps {
  onClose: () => void;
  /** The Three.js terminal display on /play adds plot keys and mouse controls. */
  terminal?: boolean;
}

type HelpTab = "controls" | "concepts" | "sidebar" | "infowar";

export function HelpPanel({ onClose, terminal = false }: HelpPanelProps) {
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
          {tab === "controls" && <ControlsTab terminal={terminal} />}
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

function ControlsTab({ terminal }: { terminal: boolean }) {
  return (
    <>
      <SectionTitle>Keyboard</SectionTitle>
      <div className="space-y-1">
        <div><KeyLabel>Space</KeyLabel> Pause / resume the simulation (WeGo: only while a turn resolves)</div>
        {terminal && <div><KeyLabel>Enter</KeyLabel> WeGo: commit orders, then start the next turn after the review</div>}
        {terminal && <div><KeyLabel>1</KeyLabel>-<KeyLabel>6</KeyLabel> Time speed 1x, 2x, 5x, 10x, 30x, 60x</div>}
        {terminal && <div><KeyLabel>S</KeyLabel> Sensor coverage <KeyLabel>M</KeyLabel> Measure <KeyLabel>G</KeyLabel> God mode</div>}
        {terminal && <div><KeyLabel>T</KeyLabel> Tilt the plot into the 3D theater and back</div>}
        {terminal && <div><KeyLabel>E</KeyLabel> Engage the chosen contact <KeyLabel>N</KeyLabel> Next contact</div>}
        {terminal && <div><KeyLabel>R</KeyLabel> Cycle rules of engagement <KeyLabel>F</KeyLabel> Weapons free <KeyLabel>X</KeyLabel> Weapons hold</div>}
        {terminal && <div><KeyLabel>A</KeyLabel> Autopause settings</div>}
        <div><KeyLabel>H</KeyLabel> or <KeyLabel>?</KeyLabel> Open this help panel</div>
        <div><KeyLabel>Esc</KeyLabel> Close panels and deselect units</div>
      </div>

      <SectionTitle>Mouse</SectionTitle>
      <div className="space-y-1">
        <div><span className="text-[var(--color-terminal-amber)]">Click unit</span> — Select it. Opens orders and detail panels.</div>
        <div><span className="text-[var(--color-terminal-amber)]">Shift + click unit</span> — Pin its sensor range ring on the map.</div>
        <div><span className="text-[var(--color-terminal-amber)]">Click map</span> — While in waypoint mode, places a waypoint.</div>
        {terminal && <div><span className="text-[var(--color-terminal-amber)]">Drag</span> — Pan the plot. Let go while moving and it coasts.</div>}
        {terminal && <div><span className="text-[var(--color-terminal-amber)]">Wheel</span> — Zoom toward the cursor.</div>}
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
        Weapons in flight, your force condition and the full combat record. The
        record lists every retained event that involves your side, in order,
        with scenario clock times and names LAUNCH, DEFENDED, HIT, MISS,
        DAMAGED and LOST. Filter by ALL ACTIVITY, COMBAT or INTEL, by one of
        your units, and in WeGo by ALL RUN or LAST RESOLVED TURN. Pages show
        SHOWING X-Y OF Z; LATEST returns to the newest. Enemy units are named
        only as far as your own contacts identify them; an incoming weapon is
        shown as INCOMING WEAPON. Reading the record never changes the clock,
        your orders or the turn.
      </p>
      <p>
        VIEW RECORD on a turn review or the mission debrief opens the full
        record; BACK TO REVIEW or BACK TO DEBRIEF returns to exactly that
        summary. In a turn review you can still inspect your own units, lost
        ones included, but orders stay locked until you plan the next turn.
      </p>

      <SectionTitle>How a Run Ends</SectionTitle>
      <p>
        The briefing and the MISSION panel list the endings your side is told
        about: for Hormuz, USS Nimitz entering the transit gate wins and her
        loss ends it. When a run ends, the debrief says which rule decided it,
        shows the final score beside the result, and says whether the score
        decided the ending or is only a tally. A line reading OTHER ENDINGS NOT
        BRIEFED means the scenario has endings it does not tell you about.
        PLAY AGAIN starts a clean paused run with the briefing up; you can try
        different orders. VIEW RECORD or REVIEW RECORD reads the fight without
        moving time.
      </p>

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
