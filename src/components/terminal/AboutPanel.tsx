"use client";

/**
 * The terminal ABOUT card: version, description, the Ray Weiss credits line and the data/map
 * credits, in the register's own phosphor look. It opens from the command bar and closes on [X]
 * or Escape. No em dashes anywhere in this copy.
 */
export function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="tx-modal-backdrop" data-testid="about-backdrop">
      <div
        className="tx-panel tx-modal tx-about"
        role="dialog"
        aria-modal="true"
        aria-label="About Sandkasten"
        data-testid="about-panel"
      >
        <div className="tx-about-head">
          <span className="tx-about-title">SANDKASTEN</span>
          <span className="tx-dim" data-testid="about-version">v0.1.0</span>
          <button
            type="button"
            className="tx-btn"
            onClick={onClose}
            onMouseDown={(e) => e.preventDefault()}
            data-testid="about-close"
            aria-label="Close about panel"
          >
            [X]
          </button>
        </div>

        <p className="tx-about-designed" data-testid="about-designer">
          Designed by Ray Weiss, Conflict Simulations LLC
        </p>
        <p className="tx-about-desc">
          Command naval and air forces on a tactical map with NATO symbology, radar detection, fog of war, and WeGo turns.
          Free and open source.
        </p>

        <div className="tx-about-sec">DATA &amp; MAP CREDITS</div>
        <ul className="tx-about-credits">
          <li>Base map: OpenFreeMap vector tiles, OpenStreetMap data (ODbL), OpenMapTiles schema.</li>
          <li>Satellite imagery: EOX Sentinel-2 cloudless, 2018 (CC BY-NC-SA 4.0).</li>
          <li>Terrain relief: AWS Terrain Tiles.</li>
          <li>Facilities: OurAirports (public domain) and OpenStreetMap (ODbL).</li>
          <li>Land, coast and depth: Natural Earth and NOAA ETOPO1 (public domain).</li>
          <li>OSINT sites: Auftragstaktik (MIT).</li>
          <li>Snapshot aircraft: adsb.lol (ODbL).</li>
          <li>Typeface: JetBrains Mono (SIL OFL 1.1).</li>
        </ul>

        <div className="tx-about-sec">BUILT WITH</div>
        <p className="tx-about-built">MapLibre GL JS, milsymbol, Three.js, Next.js.</p>
      </div>
    </div>
  );
}
