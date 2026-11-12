// The Three.js tactical plot: a naval combat-information display drawn from
// the live simulation. React feeds it state through update(); everything that
// moves between those updates (camera, sweeps, interpolation, effects, data
// block positions) runs in the plot's own animation loop.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Unit } from "@/types/game";
import { getAffiliation } from "@/types/game";
import type { Contact, UnitOrders } from "@/lib/simulation/gameState";
import type { WeaponInFlight, CombatEvent } from "@/lib/simulation/combat";
import { getPlatform } from "@/lib/platforms/lookup";
import { formatMeasurement } from "@/lib/map/measure";
import { trackNumber } from "@/lib/simulation/trackNumber";
import { PlotProjection, type GeoPoint, FT_TO_KM, KM_PER_NM } from "./projection";
import { LineBatch } from "./lineBatch";
import { PALETTE } from "./palette";
import { sidcFor, symbolTexture, drawGlyph, GLYPH_PX, type GlyphState } from "./symbolTextures";
import { FacilityPlotLayer, FACILITY_SYMBOL_PX } from "./facilityLayer";
import { OsintPlotLayer, OSINT_SYMBOL_PX } from "./osintLayer";
import { sideForAffiliation, siteLabel } from "@/lib/osint/sites";
import type { OsintSite } from "@/lib/osint/sites";
import { shortFacilityName } from "@/lib/facilities/labels";
import type { Facility } from "@/lib/facilities/facilities";
import geo from "./data/hormuz-geo.json";

export type PlotMode = "select" | "waypoint" | "measure";

export interface PlotInput {
  units: Unit[];
  playerSide: string;
  contacts: Contact[];
  orders: Map<string, UnitOrders>;
  fogOfWar: boolean;
  weaponsInFlight: WeaponInFlight[];
  combatLog: CombatEvent[];
  selectedUnitId: string | null;
  pinnedRingIds: Set<string>;
  showSensorCoverage: boolean;
  measureStart: GeoPoint | null;
  measureEnd: GeoPoint | null;
  simTime: number;
  mode: PlotMode;
  /** Real-world installations to draw; the layer is rebuilt when the array identity changes. */
  facilities?: Facility[];
  selectedFacilityId?: string | null;
  showFacilities?: boolean;
  /** Real-world AD, radar and nuclear sites (already filtered by the layer toggles); rebuilt when the array identity changes. */
  osint?: OsintSite[];
  selectedOsintId?: string | null;
  /** Mission areas (the transit gate); the fill is rebuilt when the array identity changes. */
  areas?: PlotArea[];
}

/** A player-authorised mission area drawn on the plot: the scenario's own polygon, labelled, not a sensor contact. */
export interface PlotArea {
  id: string;
  label: string;
  points: GeoPoint[];
}

export interface PlotCallbacks {
  onUnitSelect: (unitId: string | null, shiftKey: boolean) => void;
  onMapClick: (p: GeoPoint) => boolean | void;
  onFacilitySelect?: (facilityId: string | null) => void;
  onOsintSelect?: (siteId: string | null) => void;
}

export interface PlotReadouts {
  cursor?: HTMLElement | null;
  scaleLabel?: HTMLElement | null;
  scaleBar?: HTMLElement | null;
}

export interface PlotInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface DebugFeature {
  geometry: { type: "Point" | "LineString" | "Polygon" };
  properties: Record<string, unknown>;
}

type TrackKind = "unit" | "contact" | "weapon";

interface Track {
  key: string;
  kind: TrackKind;
  id: string;
  from: THREE.Vector2;
  to: THREE.Vector2;
  pos: THREE.Vector2;
  /** world offset that fans out co-located glyphs; zero when the glyph is alone */
  disp: THREE.Vector2;
  z: number;
  t0: number;
  history: number[]; // x,y pairs, oldest first
  lastHistSim: number;
  sprite?: THREE.Sprite;
  spriteKey?: string;
  spriteW: number;
  spriteH: number;
  /** glyph anchor inside the sprite box, CSS px from its top-left corner */
  spriteAx: number;
  spriteAy: number;
  /** screen offset (px) the glyph is fanned out by, eased toward its target */
  dispPx: THREE.Vector2;
  dispInit: boolean;
  /** the block is on show, as a one-line compact form or not */
  shown: boolean;
  compactOn: boolean;
  block?: HTMLDivElement;
  blockText: string;
  blockW: number;
  blockH: number;
  // one-line fallback when the full block has nowhere clear to go
  compactText: string;
  compactW: number;
  compactH: number;
  fullW: number;
  fullH: number;
  shownText: string;
  slot: number;
  screen: THREE.Vector2;
  onScreen: boolean;
  alpha: number;
  paintT: number;
  unit?: Unit;
  contact?: Contact;
  weapon?: WeaponInFlight;
  seen: boolean;
}

export interface OccBox {
  kind: "label" | "block" | "unit" | "facility-icon" | "osint-icon" | "scale";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group?: string;
}

interface StaticIcon {
  kind: "facility-icon" | "osint-icon" | "osint-dot";
  id: string;
  cx: number;
  cy: number;
  half: number;
}

interface Rect {
  /** index into labelEls when this is a facility/OSINT label a unit data block may displace */
  ev?: number;
  /** set when a displaced label's rect no longer counts */
  dead?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

interface Effect {
  x: number;
  y: number;
  t0: number;
  kind: "hit" | "intercept" | "kill" | "launch" | "wreck";
  /** launch: the shooter's side colour and the heading the weapon left on (radians) */
  friendly?: boolean;
  dir?: number;
}

const EFFECT_LIFE: Record<Effect["kind"], number> = { launch: 700, intercept: 700, hit: 1000, kill: 1600, wreck: 45_000 };
/** Fixed pseudo-random 0..1 per debris streak, so a burst looks the same every time it is drawn. */
const DEBRIS = [0.83, 0.31, 0.62, 0.12, 0.95, 0.47, 0.71, 0.24, 0.56, 0.9, 0.38, 0.05, 0.67, 0.19];

const FOV = 30;
const TILT_PITCH = 0.94; // radians at full tilt, about 54 degrees
const RELIEF_EXAG = 7; // vertical exaggeration for relief and altitude
const LERP_MS = 260;
const HIST_UNIT_MS = 45_000;
const HIST_WEAPON_MS = 2_500;
const HIST_MAX = 12;
const SWEEP_PERIOD_S = 4;
/** Water over the continental shelf: the field colour of the chart. Deeper water steps down toward PALETTE.field. */
const SHELF_WATER = 0x030e08;
/** Seconds without a fresh report before a contact's frame is drawn broken. */
const STALE_S = 45;
const OWN: GlyphState = { certainty: "own" };

const C = {
  phosphor: new THREE.Color(PALETTE.phosphor),
  hi: new THREE.Color(PALETTE.phosphorHi),
  dim: new THREE.Color(PALETTE.phosphorDim),
  faint: new THREE.Color(PALETTE.phosphorFaint),
  alarm: new THREE.Color(PALETTE.alarm),
  alarmDim: new THREE.Color(PALETTE.alarmDim),
  caution: new THREE.Color(PALETTE.caution),
  cautionDim: new THREE.Color(PALETTE.cautionDim),
  land: new THREE.Color(PALETTE.land),
};

const CLS_LABEL: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

export { trackNumber };

function pad3(n: number): string {
  const v = ((Math.round(n) % 360) + 360) % 360;
  return String(v).padStart(3, "0");
}

function shortName(name: string): string {
  return name.toUpperCase().replace(/^USS\s+/, "").replace(/[()]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

function formatDmm(v: number, pos: string, neg: string, degWidth: number): string {
  const hemi = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${String(d).padStart(degWidth, "0")}°${m.toFixed(1).padStart(4, "0")}'${hemi}`;
}

const SWEEP_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SWEEP_FRAG = /* glsl */ `
uniform float uAngle;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.x, p.y);
  float d = mod(uAngle - a + 12.566370, 6.283185);
  float trail = exp(-d * 2.4);
  float beam = smoothstep(0.05, 0.0, d);
  float rim = smoothstep(0.94, 1.0, r) * 0.18;
  float k = (trail * 0.32 + beam * 0.85) * (0.25 + 0.75 * r) + rim;
  gl_FragColor = vec4(uColor * k * uAlpha, 1.0);
}`;

const FINISH_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float vig = 1.0 - dot(q, q) * 0.6;
      gl_FragColor = vec4(c.rgb * vig, 1.0);
      // last pass: this also does the display encoding, which used to cost a full-screen pass of its own
      #include <colorspace_fragment>
    }`,
};


/** Distance from a point to the nearest point of a rect (0 inside). */
function distToRect(px: number, py: number, r: Rect): number {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w)), cy = Math.max(r.y, Math.min(py, r.y + r.h));
  return Math.hypot(px - cx, py - cy);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Uniform grid over screen rects, so a frame's collision tests do not grow with the square of the rect count. */
class RectGrid {
  private cells = new Map<number, Rect[]>();
  private seen = new Set<Rect>();
  constructor(private cell: number) {}

  clear() {
    this.cells.clear();
  }

  private span(r: Rect): [number, number, number, number] {
    const c = this.cell;
    return [Math.floor(r.x / c), Math.floor((r.x + r.w) / c), Math.floor(r.y / c), Math.floor((r.y + r.h) / c)];
  }

  add(r: Rect) {
    const [x0, x1, y0, y1] = this.span(r);
    if (x1 - x0 > 60 || y1 - y0 > 60) return;
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const k = gx * 100003 + gy;
        const list = this.cells.get(k);
        if (list) list.push(r); else this.cells.set(k, [r]);
      }
    }
  }

  hits(r: Rect): boolean {
    const [x0, x1, y0, y1] = this.span(r);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = this.cells.get(gx * 100003 + gy);
        if (!list) continue;
        for (const o of list) if (!o.dead && intersects(o, r)) return true;
      }
    }
    return false;
  }

  /** Every live rect that overlaps `r`, each once. */
  collect(r: Rect): Rect[] {
    const out: Rect[] = [];
    this.seen.clear();
    const [x0, x1, y0, y1] = this.span(r);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = this.cells.get(gx * 100003 + gy);
        if (!list) continue;
        for (const o of list) {
          if (o.dead || this.seen.has(o) || !intersects(o, r)) continue;
          this.seen.add(o);
          out.push(o);
        }
      }
    }
    return out;
  }
}

/**
 * Top-left offsets of a w x h label from the centre of an icon of half-size `half`: the four adjacent slots first
 * (right, left, above, below), then rings of eight at growing radius. Slot index 4 and up are away from the icon and
 * carry a leader line.
 */
function labelSlots(half: number, w: number, h: number): [number, number][] {
  const g = 3;
  const out: [number, number][] = [
    [half + g, -h / 2], [-half - g - w, -h / 2], [-w / 2, -half - g - h], [-w / 2, half + g],
  ];
  // Extra outer rings so a close-zoom runway obstacle grid still leaves a free plate (esp. at 1920×1080).
  for (const r of [half + 14, half + 30, half + 50, half + 74, half + 102, half + 136]) {
    const d = r * 0.72;
    out.push([r, -h / 2], [-r - w, -h / 2], [-w / 2, -r - h], [-w / 2, r], [d, -d - h], [d, d], [-d - w, -d - h], [-d - w, d]);
  }
  return out;
}

/**
 * The land tone as a texture: the elevation grid (ETOPO1, 0.1 degree) resampled smooth and lit from the north-west,
 * all inside the land's own dark phosphor tone. Sea cells are flat; the land mesh is the mask.
 */
function reliefTexture(r: { rows: number; cols: number; step: number; elev: number[] }): THREE.CanvasTexture {
  const K = 6;
  const w = (r.cols - 1) * K + 1, h = (r.rows - 1) * K + 1;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(w, h);
  const at = (i: number, j: number) => Math.max(0, r.elev[Math.min(r.rows - 1, Math.max(0, i)) * r.cols + Math.min(r.cols - 1, Math.max(0, j))]);
  const field = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fi = y / K, i0 = Math.floor(fi), ti = fi - i0;
    for (let x = 0; x < w; x++) {
      const fj = x / K, j0 = Math.floor(fj), tj = fj - j0;
      const a = at(i0, j0), b = at(i0, j0 + 1), c = at(i0 + 1, j0), d = at(i0 + 1, j0 + 1);
      // smoothstep weights: no creases along the coarse grid lines
      const u = tj * tj * (3 - 2 * tj), v = ti * ti * (3 - 2 * ti);
      field[y * w + x] = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
  }
  // canvas pixels are sRGB bytes: take the palette tone as written, not three's linear copy of it
  const hex = parseInt(PALETTE.land.slice(1), 16);
  const base = { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
  const cell = (r.step * 111_000) / K; // metres per texel
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = field[y * w + x];
      const dx = (field[y * w + Math.min(w - 1, x + 1)] - field[y * w + Math.max(0, x - 1)]) / (2 * cell);
      const dy = (field[Math.min(h - 1, y + 1) * w + x] - field[Math.max(0, y - 1) * w + x]) / (2 * cell);
      // light from the north-west; row 0 is the south edge
      const lit = THREE.MathUtils.clamp((-dx + dy) * 9, -1, 1);
      const k = 0.92 + lit * 0.5 + Math.min(1, e / 2600) * 0.55;
      const o = ((h - 1 - y) * w + x) * 4;
      img.data[o] = Math.min(255, base.r * 255 * k * 0.9);
      img.data[o + 1] = Math.min(255, base.g * 255 * k);
      img.data[o + 2] = Math.min(255, base.b * 255 * k * 0.95);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export class TacticalPlot {
  readonly proj: PlotProjection;
  private host: HTMLElement;
  private overlay: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  private callbacks: PlotCallbacks;
  private readouts: PlotReadouts = {};
  private insets: PlotInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private input: PlotInput | null = null;

  // view
  private W = 1;
  private H = 1;
  private dpr = 1;
  private target = new THREE.Vector2(0, 0);
  private dist = 800;
  private distGoal = 800;
  private zoomAnchor: THREE.Vector2 | null = null;
  private tiltGoal = 0;
  private tiltAmt = 0;
  private vel = new THREE.Vector2();
  private glide: THREE.Vector2 | null = null;
  private kPx = 1; // world km per CSS px at the view target
  private spriteK = 1;
  private viewHash = "";

  // input
  private drag: { x: number; y: number; lastX: number; lastY: number; lastT: number; moved: boolean; id: number } | null = null;
  private hoverKey: string | null = null;
  private cursorPx: THREE.Vector2 | null = null;

  // scene content
  private staticBatches: LineBatch[] = [];
  private coastBatch: LineBatch | null = null;
  private coastHalo: LineBatch | null = null;
  /** CSS px width of the static batches that are not 1 px */
  private batchWidth = new Map<LineBatch, number>();
  private landMesh: THREE.Mesh | null = null;
  private facilityLayer: FacilityPlotLayer | null = null;
  private facilitySource: Facility[] | undefined;
  private facilityLabelCount = 0;
  private osintLayer: OsintPlotLayer | null = null;
  private osintSource: OsintSite[] | undefined;
  private areaSource: PlotArea[] | undefined;
  private areaFills: THREE.Mesh[] = [];
  private areaLabelCount = 0;
  private pendingAreaFocus: { areaId: string; opts: { include?: { lng: number; lat: number }[]; avoidRight?: number } } | null = null;
  private osintLabelCount = 0;
  private relief: THREE.Mesh | null = null;
  private reliefWire: LineSegments2 | null = null;
  private solid = new LineBatch({ width: 1.4, renderOrder: 20 });
  private thin = new LineBatch({ width: 1, renderOrder: 19 });
  private dashed = new LineBatch({ width: 1.3, dashed: true, renderOrder: 21 });
  private dots: THREE.Points;
  private dotsPos = new Float32Array(3 * 4096);
  private dotsCol = new Float32Array(3 * 4096);
  private marks: THREE.Points;
  private marksPos = new Float32Array(3 * 1024);
  private marksCol = new Float32Array(3 * 1024);
  private discs: THREE.Mesh[] = [];
  private discGeo = new THREE.CircleGeometry(1, 72);
  private sweeps = new Map<string, THREE.Mesh>();
  private sweepGeo = new THREE.PlaneGeometry(2, 2);
  private tracks = new Map<string, Track>();
  private effects: Effect[] = [];
  // last combat event already turned into an effect (the log is append-only)
  private lastEventId: string | null = null;
  private lastSimTime = 0;

  // what the last frame actually drew; the test handle reports this, not the input
  private drawn = {
    weaponLines: 0,
    weaponHeads: 0,
    waypointPaths: [] as { unitId: string; points: number }[],
    uncertaintyDiscs: 0,
    uncertaintyEdges: 0,
    coverageDiscs: 0,
    coverageEdges: 0,
    unitSprites: 0,
    contactSprites: 0,
  };

  // screen rects of chrome that covers the plot (elements marked data-plot-occluder)
  private occluders: Rect[] = [];
  private occluderAt = -Infinity;
  private occluderHash = "";
  private leaderSvg: SVGSVGElement;
  private leaderPaths: Record<"friendly" | "hostile" | "unknown" | "site", SVGPathElement>;
  private leaderD = { friendly: "", hostile: "", unknown: "", site: "" };
  // per-frame obstacle grids (screen px): glyph fan-out, symbols, placed labels, data blocks, runway strips
  private gGlyph = new RectGrid(64);
  private gSym = new RectGrid(64);
  private gLab = new RectGrid(64);
  private gBlk = new RectGrid(64);
  private gRun = new RectGrid(64);
  private icons: StaticIcon[] = [];
  private declKey = "";
  private textBoxes = new Map<string, { w: number; h: number }>();
  private probe: HTMLDivElement | null = null;
  private siteLeaders: { ev: number; d: string }[] = [];
  private labelMeta: { text: string; owner: string; nearest: string; leader: boolean }[] = [];
  private planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  // DOM labels outside the tracks
  private labelPool: HTMLDivElement[] = [];
  private labelsUsed = 0;
  private labelRects: Rect[] = [];
  private labelEls: HTMLDivElement[] = [];
  private siteLabels = false;
  private labelTexts: string[] = [];
  private gridLabels: HTMLDivElement[] = [];
  private gridRects: Rect[] = [];

  private raf = 0;
  private lastFrame = 0;
  private disposed = false;
  private frames = 0;
  /** Soft GL / SwiftShader: HalfFloat MSAA bloom at CSS DPR 2 starves openPlay's frames()>30 budget. */
  private softGl = false;
  private tmpV3 = new THREE.Vector3();
  private projV = new THREE.Vector3();
  private screenV = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  private groundA = new THREE.Vector3();
  private groundB = new THREE.Vector3();

  constructor(host: HTMLElement, overlay: HTMLElement, origin: GeoPoint, callbacks: PlotCallbacks) {
    this.host = host;
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.proj = new PlotProjection(origin);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    // The field. three 0.187 writes the clear colour into the linear frame as if it were already display-encoded,
    // so the palette's near-black used to reach the screen as a grey-green haze (about #182a22) that was lighter
    // than the land. Encoding the wanted tone once more cancels that, and the shelf water comes out as written.
    this.renderer.setClearColor(new THREE.Color(SHELF_WATER).convertSRGBToLinear(), 1);
    this.renderer.domElement.setAttribute("data-testid", "plot-canvas");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.softGl = this.detectSoftGl();
    // Soft GL + HalfFloat MSAA4 paints a 4K buffer for seconds per frame; openPlay then never sees frames()>30.
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: this.softGl ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: this.softGl ? 0 : 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // A tight glow that stays on the stroke. The earlier, wider setting spread every bright line into a veil
    // over the water around it, which is a large part of why the plot was hard to read.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.softGl ? 0 : 0.26, 0.12, 0.34);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(FINISH_SHADER));

    // label leaders are drawn in screen space so they stay exact when tilted
    const NS = "http://www.w3.org/2000/svg";
    this.leaderSvg = document.createElementNS(NS, "svg") as SVGSVGElement;
    this.leaderSvg.setAttribute("class", "tx-leaders");
    const mk = (cls: string) => {
      const path = document.createElementNS(NS, "path") as SVGPathElement;
      path.setAttribute("class", cls);
      this.leaderSvg.appendChild(path);
      return path;
    };
    this.leaderPaths = { friendly: mk("tx-leader"), hostile: mk("tx-leader tx-leader--hostile"), unknown: mk("tx-leader tx-leader--unknown"), site: mk("tx-leader tx-leader--site") };
    overlay.appendChild(this.leaderSvg);

    this.dots = this.makePoints(this.dotsPos, this.dotsCol, 3, 22);
    this.marks = this.makePoints(this.marksPos, this.marksCol, 7, 23);

    this.buildStatic();
    this.scene.add(this.solid.object, this.thin.object, this.dashed.object, this.dots, this.marks);

    this.fitTheater();
    this.resize();
    this.bindInput();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    this.resizeObserver = ro;

    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    // Advance frames immediately after load (not only after focusArea): openPlay waits for frames()>30 within 60s.
    this.warmFrames(36);
  }

  private resizeObserver: ResizeObserver;

  // ------------------------------------------------------------------ setup

  private makePoints(pos: Float32Array, col: Float32Array, size: number, order: number): THREE.Points {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = order;
    return p;
  }

  private buildStatic() {
    const P = this.proj;
    const bbox = geo.bbox as number[];
    const onEdge = (a: number[], b: number[]) =>
      (a[0] === bbox[0] && b[0] === bbox[0]) || (a[0] === bbox[2] && b[0] === bbox[2]) ||
      (a[1] === bbox[1] && b[1] === bbox[1]) || (a[1] === bbox[3] && b[1] === bbox[3]);

    // the chart sheet: shelf water a shade lighter than the deeps, so the sea has form before any line is drawn
    const W0 = P.x(bbox[0]), W1 = P.x(bbox[2]), S0 = P.y(bbox[1]), N1 = P.y(bbox[3]);
    const flat = (color: number, order: number, geom: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }));
      m.renderOrder = order;
      this.scene.add(m);
      return m;
    };
    // The shelf-water tone is the renderer's clear colour (see the constructor), so the sea costs no fill at
    // all; only the deeps are drawn, as darker steps on top of it.
    const shapesOf = (polys: number[][][][]) => polys.map((poly) => {
      const shape = new THREE.Shape(poly[0].map((p) => new THREE.Vector2(P.x(p[0]), P.y(p[1]))));
      for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(P.x(p[0]), P.y(p[1])))));
      return shape;
    });
    const depthTone: Record<string, number> = { "200": 0x030b06, "1000": 0x020905, "2000": 0x020704, "3000": 0x020604 };
    Object.entries(geo.depth as Record<string, number[][][][]>)
      .sort((p, q) => Number(p[0]) - Number(q[0]))
      .forEach(([depth, polys], i) => flat(depthTone[depth] ?? 0x020805, -3 + i * 0.1, new THREE.ShapeGeometry(shapesOf(polys))));

    // land fill, lit by the same elevation grid the tilt view extrudes: hills read as hills in the flat chart too
    const landGeo = new THREE.ShapeGeometry(shapesOf(geo.land as number[][][][]));
    const rel = geo.relief as { lat0: number; lng0: number; step: number; rows: number; cols: number; elev: number[] };
    {
      const pos = landGeo.attributes.position as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2);
      const spanLng = (rel.cols - 1) * rel.step, spanLat = (rel.rows - 1) * rel.step;
      for (let i = 0; i < pos.count; i++) {
        const gp = P.toGeo(pos.getX(i), pos.getY(i));
        uv[i * 2] = (gp.lng - rel.lng0) / spanLng;
        uv[i * 2 + 1] = (gp.lat - rel.lat0) / spanLat;
      }
      landGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    const land = new THREE.Mesh(
      landGeo,
      new THREE.MeshBasicMaterial({ map: reliefTexture(rel), depthTest: false, depthWrite: false, transparent: true }),
    );
    land.renderOrder = 1;
    this.landMesh = land;
    this.scene.add(land);

    // depth contours (Natural Earth bathymetry polygons, outline only)
    const contour = new LineBatch({ width: 1, dashed: true, renderOrder: 3 });
    contour.material.dashSize = 6;
    contour.material.gapSize = 5;
    const depthAlpha: Record<string, number> = { "200": 0.42, "1000": 0.32, "2000": 0.26, "3000": 0.22 };
    for (const [depth, polys] of Object.entries(geo.depth as Record<string, number[][][][]>)) {
      for (const poly of polys) {
        for (const ring of poly) {
          contour.breakRun();
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            if (onEdge(a, b)) { contour.breakRun(); continue; }
            contour.seg(P.x(a[0]), P.y(a[1]), 0, P.x(b[0]), P.y(b[1]), 0, C.dim, depthAlpha[depth] ?? 0.3);
          }
        }
      }
    }
    contour.flush();

    // coastline: a crisp line over a soft wide one, so the shore glows the way a stroke does on a tube
    const coast = new LineBatch({ width: 1.5, renderOrder: 5 });
    const coastHalo = new LineBatch({ width: 6, renderOrder: 4 });
    for (const line of geo.coast as number[][][]) {
      const pts: number[] = [];
      for (const p of line) pts.push(P.x(p[0]), P.y(p[1]));
      coast.polyline(pts, 0, C.phosphor, 0.4);
      coastHalo.polyline(pts, 0, C.phosphor, 0.035);
    }
    coast.flush();
    coastHalo.flush();
    const borders = new LineBatch({ width: 1, dashed: true, renderOrder: 4 });
    borders.material.dashSize = 3;
    borders.material.gapSize = 4;
    for (const line of geo.borders as number[][][]) {
      const pts: number[] = [];
      for (const p of line) pts.push(P.x(p[0]), P.y(p[1]));
      borders.polyline(pts, 0, C.dim, 0.5);
    }
    borders.flush();

    // Graticule every 0.5 degree. The lines stay very quiet (Ray: the green grid was "a bit too much"); the
    // crossings carry small register crosses instead, which is all the eye needs to read position off a chart.
    const grid = new LineBatch({ width: 1, renderOrder: 2 });
    const ticks = new LineBatch({ width: 1, renderOrder: 2 });
    const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
    for (let lng = Math.ceil(bbox[0] * 2) / 2; lng <= bbox[2]; lng += 0.5) {
      grid.seg(P.x(lng), P.y(bbox[1]), 0, P.x(lng), P.y(bbox[3]), 0, C.faint, whole(lng) ? 0.5 : 0.2);
    }
    for (let lat = Math.ceil(bbox[1] * 2) / 2; lat <= bbox[3]; lat += 0.5) {
      grid.seg(P.x(bbox[0]), P.y(lat), 0, P.x(bbox[2]), P.y(lat), 0, C.faint, whole(lat) ? 0.5 : 0.2);
    }
    for (let lng = Math.ceil(bbox[0] * 2) / 2; lng <= bbox[2]; lng += 0.5) {
      for (let lat = Math.ceil(bbox[1] * 2) / 2; lat <= bbox[3]; lat += 0.5) {
        const big = whole(lng) && whole(lat);
        const arm = big ? 2.4 : 1.2; // km
        const x = P.x(lng), y = P.y(lat);
        ticks.seg(x - arm, y, 0, x + arm, y, 0, C.dim, big ? 0.7 : 0.4);
        ticks.seg(x, y - arm, 0, x, y + arm, 0, C.dim, big ? 0.7 : 0.4);
      }
    }
    // neat line: the edge of the charted sheet
    ticks.polyline([W0, S0, W1, S0, W1, N1, W0, N1], 0, C.dim, 0.55, true);
    grid.flush();
    ticks.flush();

    this.staticBatches = [contour, coast, borders, grid, coastHalo, ticks];
    this.batchWidth.set(coast, 1.5);
    this.batchWidth.set(coastHalo, 6);
    this.coastBatch = coast;
    this.coastHalo = coastHalo;
    for (const b of this.staticBatches) this.scene.add(b.object);

    this.buildRelief();
  }

  private buildRelief() {
    const r = geo.relief as { lat0: number; lng0: number; step: number; rows: number; cols: number; elev: number[] };
    const P = this.proj;
    const hAt = (i: number, j: number) => Math.max(0, r.elev[i * r.cols + j]) / 1000; // km
    const vx = (i: number, j: number) => new THREE.Vector3(P.x(r.lng0 + j * r.step), P.y(r.lat0 + i * r.step), hAt(i, j) * RELIEF_EXAG);

    const positions: number[] = [];
    const colors: number[] = [];
    const wire: number[] = [];
    const wireCol: number[] = [];
    const light = new THREE.Vector3(-0.5, 0.6, 0.62).normalize();
    const base = new THREE.Color(PALETTE.phosphorFaint);
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      if (a.z <= 0 && b.z <= 0 && c.z <= 0) return;
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      n.crossVectors(e1, e2).normalize();
      const shade = 0.3 + 0.7 * Math.max(0, n.dot(light));
      const height = Math.max(a.z, b.z, c.z) / (4 * RELIEF_EXAG);
      const k = shade * (0.55 + 0.6 * Math.min(1, height));
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z);
        colors.push(base.r * k, base.g * k, base.b * k);
      }
    };
    for (let i = 0; i < r.rows - 1; i++) {
      for (let j = 0; j < r.cols - 1; j++) {
        const a = vx(i, j), b = vx(i, j + 1), c = vx(i + 1, j), d = vx(i + 1, j + 1);
        tri(a, b, d);
        tri(a, d, c);
        if (a.z > 0 || b.z > 0) { wire.push(a.x, a.y, a.z, b.x, b.y, b.z); wireCol.push(...C.dim.toArray(), ...C.dim.toArray()); }
        if (a.z > 0 || c.z > 0) { wire.push(a.x, a.y, a.z, c.x, c.y, c.z); wireCol.push(...C.dim.toArray(), ...C.dim.toArray()); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const relief = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 }));
    relief.renderOrder = 2;
    relief.visible = false;
    this.relief = relief;
    this.scene.add(relief);

    const wg = new LineSegmentsGeometry();
    wg.setPositions(wire);
    wg.setColors(wireCol);
    const wm = new LineMaterial({
      linewidth: 1,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rw = new LineSegments2(wg, wm);
    rw.renderOrder = 3;
    rw.visible = false;
    this.reliefWire = rw;
    this.scene.add(rw);
  }

  fitTheater() {
    this.target.set(0, -12);
    this.dist = this.distGoal = 1000;
  }

  // ------------------------------------------------------------- public API

  setReadouts(r: PlotReadouts) {
    this.readouts = r;
    this.viewHash = "";
  }

  setInsets(i: PlotInsets) {
    this.insets = i;
    this.viewHash = "";
    this.applyViewOffset();
  }

  setCallbacks(c: PlotCallbacks) {
    this.callbacks = c;
  }

  setTilt(on: boolean) {
    this.tiltGoal = on ? 1 : 0;
  }

  get tilted() {
    return this.tiltGoal === 1;
  }

  /** Glide the view to a unit (used when a unit is picked from the forces list). */
  focusUnit(unitId: string) {
    const t = this.tracks.get(`unit:${unitId}`);
    if (!t) return;
    this.vel.set(0, 0);
    this.glide = t.to.clone();
  }

  /**
   * Jump the camera onto a facility and zoom until its longest runway fills a good part of the screen.
   * Snaps (no glide): under a capped frame dt the old ease could leave the view mid-move for seconds on a slow
   * WebGL host, so clicks and occupancy checks saw the wrong pose.
   */
  focusFacility(facilityId: string) {
    const it = this.facilityLayer?.get(facilityId);
    if (!it) return;
    let longestKm = 0;
    for (const r of it.facility.runways ?? []) longestKm = Math.max(longestKm, r.lengthM / 1000);
    const dist = THREE.MathUtils.clamp(Math.max(longestKm, 1.2) * 2.6 / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))), 15, 400);
    this.snapView(it.x, it.y, dist);
  }

  /** Snap pan/zoom immediately and force the next frame to re-declutter and relabel. */
  private snapView(x: number, y: number, dist: number) {
    this.vel.set(0, 0);
    this.glide = null;
    this.zoomAnchor = null;
    this.target.set(x, y);
    this.distGoal = dist;
    this.dist = dist;
    this.declKey = "";
    this.viewHash = "";
    this.updateCamera();
  }

  private rebuildAreaFills(areas: PlotArea[]) {
    for (const m of this.areaFills) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.areaFills = areas.map((a) => {
      const shape = new THREE.Shape(a.points.map((p) => new THREE.Vector2(this.proj.x(p.lng), this.proj.y(p.lat))));
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: C.hi.clone().multiplyScalar(0.018), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      return mesh;
    });
  }

  /**
   * Jump to a mission area and zoom until it fills a good part of the free area between the panels.
   * Snaps (no glide): under soft GL / capped frame dt the old ease left SHOW GATE mid-pose for seconds, so
   * occupancy and shot checks saw the wrong framing. `include` widens the frame; `avoidRight` keeps that many
   * px on the right clear (a docked card).
   */
  focusArea(areaId: string, opts: { include?: { lng: number; lat: number }[]; avoidRight?: number } = {}) {
    const a = this.input?.areas?.find((x) => x.id === areaId);
    if (!a) {
      this.pendingAreaFocus = { areaId, opts };
      return;
    }
    this.pendingAreaFocus = null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of [...a.points, ...(opts.include ?? [])]) {
      const x = this.proj.x(p.lng), y = this.proj.y(p.lat);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const avoid = opts.avoidRight ?? 0;
    const freeW = Math.max(200, this.W - this.insets.left - this.insets.right - avoid);
    const freeH = Math.max(150, this.H - this.insets.top - this.insets.bottom);
    const fill = opts.include?.length ? 0.68 : 0.55;
    // world km that one screen pixel spans at distance d is 2 d tan(FOV/2) / H
    const need = Math.max(((x1 - x0) * this.H) / (fill * freeW), ((y1 - y0) * this.H) / (fill * freeH));
    const dist = THREE.MathUtils.clamp(need / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))), 15, 2600);
    const kmPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.H;
    this.snapView((x0 + x1) / 2 + (avoid / 2) * kmPerPx, (y0 + y1) / 2, dist);
  }

  /** Back to the opening theater view (a fresh run). */
  homeView() {
    this.vel.set(0, 0);
    this.zoomAnchor = null;
    this.glide = new THREE.Vector2(0, -12);
    this.distGoal = 1000;
  }

  zoomBy(factor: number) {
    this.zoomAnchor = null;
    this.distGoal = THREE.MathUtils.clamp(this.distGoal * factor, 15, 2600);
  }

  update(input: PlotInput) {
    const now = performance.now();
    if (input.simTime < this.lastSimTime) this.resetHistory();
    this.lastSimTime = input.simTime;
    const prevWeapons = new Map<string, Track>();
    for (const t of this.tracks.values()) {
      t.seen = false;
      if (t.kind === "weapon") prevWeapons.set(t.id, t);
    }
    const hadInput = this.input !== null;
    this.input = input;
    const P = this.proj;
    if (input.facilities !== this.facilitySource) {
      this.facilitySource = input.facilities;
      if (this.facilityLayer) {
        this.scene.remove(this.facilityLayer.root);
        this.facilityLayer.dispose();
      }
      this.facilityLayer = input.facilities?.length ? new FacilityPlotLayer(P, input.facilities) : null;
      if (this.facilityLayer) this.scene.add(this.facilityLayer.root);
    }
    if (input.areas !== this.areaSource) {
      this.areaSource = input.areas;
      this.rebuildAreaFills(input.areas ?? []);
    }
    if (input.osint !== this.osintSource) {
      this.osintSource = input.osint;
      if (this.osintLayer) {
        this.scene.remove(this.osintLayer.root);
        this.osintLayer.dispose();
      }
      this.osintLayer = input.osint?.length ? new OsintPlotLayer(P, input.osint) : null;
      if (this.osintLayer) {
        this.scene.add(this.osintLayer.root);
        this.osintLayer.resize(this.W * this.dpr, this.H * this.dpr, this.dpr);
      }
    }
    this.osintLayer?.setSelected(input.selectedOsintId ?? null);

    // units the player may see
    for (const u of this.visibleUnits(input)) {
      const t = this.ensureTrack("unit", u.id);
      t.unit = u;
      this.moveTrack(t, P.x(u.position.lng), P.y(u.position.lat), now, true);
      this.sampleHistory(t, input.simTime, HIST_UNIT_MS);
      const aff = getAffiliation(u, input.playerSide);
      const pl = getPlatform(u.platformId);
      const color = aff === "friendly" ? PALETTE.phosphor : aff === "hostile" ? PALETTE.alarm : PALETTE.phosphorDim;
      const damage = u.damageState === "damaged" ? 1 : u.damageState === "mission-kill" ? 2 : 0;
      this.setSprite(t, sidcFor(aff, pl?.dimension ?? "sea", pl?.functionId ?? "CL"), color, damage ? { certainty: "own", damage } : OWN);
    }

    // contacts exactly as the sensors report them
    const unitById = new Map(input.units.map((u) => [u.id, u]));
    for (const c of input.contacts) {
      const t = this.ensureTrack("contact", c.id);
      if (t.contact && t.contact.lastUpdateTime !== c.lastUpdateTime) t.paintT = now;
      t.contact = c;
      this.moveTrack(t, P.x(c.position.lng), P.y(c.position.lat), now, false);
      this.sampleHistory(t, input.simTime, HIST_UNIT_MS);
      // The sim does not report a contact's domain at detection, so an
      // unknown or detected contact gets the unknown-dimension frame. Only
      // classification (CLS/TRK) reveals the platform type and its domain.
      const known = c.classification === "classified" || c.classification === "tracked";
      const actual = known ? unitById.get(c.actualUnitId) : undefined;
      const pl = actual ? getPlatform(actual.platformId) : undefined;
      // How sure the sensors are is drawn into the glyph: UNK dotted, DET solid with a question mark, CLS a thin
      // frame, TRK a heavy frame with lock ticks; any of them breaks into dashes once the report is stale.
      this.setSprite(
        t,
        known ? sidcFor("hostile", pl?.dimension ?? "unknown", pl?.functionId ?? "") : sidcFor("unknown", "unknown", ""),
        known ? PALETTE.alarm : PALETTE.caution,
        { certainty: c.classification, stale: (input.simTime - c.lastUpdateTime) / 1000 > STALE_S },
      );
    }

    // weapons in flight
    for (const w of this.visibleWeapons(input)) {
      const fresh = !this.tracks.has(`weapon:${w.id}`);
      const t = this.ensureTrack("weapon", w.id);
      // a launch: one short flare where the weapon leaves the rail
      if (fresh && hadInput && this.effects.length < 64) {
        this.effects.push({ x: P.x(w.position.lng), y: P.y(w.position.lat), t0: now, kind: "launch", friendly: w.launchedBySide === input.playerSide, dir: THREE.MathUtils.degToRad(w.heading) });
      }
      t.weapon = w;
      this.moveTrack(t, P.x(w.position.lng), P.y(w.position.lat), now, true);
      this.sampleHistory(t, input.simTime, HIST_WEAPON_MS);
    }

    // combat events since the last update decide what a vanished weapon did
    const hitTargets = new Set<string>();
    const killed = new Set<string>();
    const log = input.combatLog;
    let from = 0;
    if (this.lastEventId) {
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].id === this.lastEventId) { from = i + 1; break; }
      }
    }
    if (log.length) this.lastEventId = log[log.length - 1].id;
    for (let i = from; i < log.length; i++) {
      const e = log[i];
      if ((e.type === "hit" || e.type === "damaged" || e.type === "destroyed") && e.targetId) hitTargets.add(e.targetId);
      if (e.type === "destroyed" && e.targetId) killed.add(e.targetId);
    }

    for (const t of this.tracks.values()) {
      if (t.seen) continue;
      if (t.kind === "weapon" && prevWeapons.has(t.id) && t.weapon) {
        const struck = hitTargets.has(t.weapon.targetId);
        const tgt = this.tracks.get(`unit:${t.weapon.targetId}`);
        // Only a weapon that reached its target bursts, and it bursts on the target. The rest of a salvo, left
        // without a target when it dies, simply ends: it used to draw a hit in open water for every one of them.
        const far = !!tgt && t.pos.distanceTo(tgt.pos) > Math.max(6, 30 * this.kPx);
        if (!struck) this.effects.push({ x: t.pos.x, y: t.pos.y, t0: now, kind: "intercept" });
        else if (!far) this.effects.push({ x: tgt ? tgt.pos.x : t.pos.x, y: tgt ? tgt.pos.y : t.pos.y, t0: now, kind: "hit" });
      }
      if (t.kind === "unit" && t.unit && killed.has(t.unit.id)) {
        this.effects.push({ x: t.pos.x, y: t.pos.y, t0: now, kind: "kill" });
        this.effects.push({ x: t.pos.x, y: t.pos.y, t0: now, kind: "wreck" });
      }
    }
    // dispose only after every effect is placed: a weapon's burst needs its dead target's last position
    for (const [key, t] of this.tracks) {
      if (t.seen) continue;
      this.disposeTrack(t);
      this.tracks.delete(key);
    }
  }

  getHandle() {
    return {
      getSource: (name: string) => this.debugSource(name),
      getLayer: (name: string) => this.debugLayer(name),
      clickAt: (x: number, y: number, shiftKey = false) => this.handleClick(x, y, shiftKey),
      project: (lng: number, lat: number) => {
        const s = this.toScreen(this.proj.x(lng), this.proj.y(lat), 0);
        return { x: s.x, y: s.y };
      },
      unproject: (x: number, y: number) => {
        const g = this.groundAt(x, y);
        return g ? this.proj.toGeo(g.x, g.y) : null;
      },
      rendererInfo: () => {
        const gl = this.renderer.getContext();
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
          vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
          version: String(gl.getParameter(gl.VERSION)),
        };
      },
      frames: () => this.frames,
      drawnFacilities: () => ({
        symbols: this.facilityLayer?.drawnSymbols ?? 0,
        runways: this.facilityLayer?.drawnRunways ?? 0,
        labels: this.facilityLabelCount,
        total: this.facilityLayer?.items.length ?? 0,
      }),
      facilityScreen: (id: string) => {
        const it = this.facilityLayer?.get(id);
        if (!it) return null;
        const s = this.toScreen(it.x, it.y, 0);
        return { x: s.x, y: s.y };
      },
      focusFacility: (id: string) => this.focusFacility(id),
      focusArea: (id: string, opts?: { include?: { lng: number; lat: number }[]; avoidRight?: number }) => this.focusArea(id, opts),
      drawnAreas: () => ({ areas: this.input?.areas?.length ?? 0, labels: this.areaLabelCount }),
      areaScreen: (id: string) => {
        const a = this.input?.areas?.find((x) => x.id === id);
        if (!a) return null;
        return a.points.map((p) => {
          const s = this.toScreen(this.proj.x(p.lng), this.proj.y(p.lat), 0);
          return { x: s.x, y: s.y };
        });
      },
      occupancy: () => this.occupancy(),
      labelOwners: () => this.labelMeta.filter(Boolean).map((m) => ({ ...m })),
      scaleInChrome: () => this.scaleInChrome(),
      labels: () => this.labelRects.map((r, i) => ({ text: this.labelTexts[i], x: r.x, y: r.y, w: r.w, h: r.h })),
      drawnOsint: () => ({
        sites: this.osintLayer?.drawn ?? 0,
        rings: this.osintLayer?.drawnRings ?? 0,
        labels: this.osintLabelCount,
        total: this.osintLayer?.items.length ?? 0,
      }),
      osintScreen: (id: string) => {
        const it = this.osintLayer?.get(id);
        if (!it) return null;
        const s = this.toScreen(it.x + it.ox * this.kPx, it.y - it.oy * this.kPx, 0);
        return { x: s.x, y: s.y };
      },
      focusOsint: (id: string, dist?: number) => {
        const it = this.osintLayer?.get(id);
        if (!it) return;
        this.snapView(it.x, it.y, dist ?? 120);
      },
      setDist: (km: number) => { this.distGoal = this.dist = km; this.updateCamera(); },
      drawnTracks: () => ({ units: this.drawn.unitSprites, contacts: this.drawn.contactSprites }),
      /** One glyph as a PNG data URL, exactly as the plot draws it (the art sheet is built from this). */
      glyph: (sidc: string, color: string, resolution: number, state?: GlyphState) => drawGlyph(sidc, color, resolution, state).toDataURL("image/png"),
      tilt: (on: boolean) => this.setTilt(on),
      view: () => ({ dist: this.dist, tilt: this.tiltAmt, target: { x: this.target.x, y: this.target.y } }),
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.unbindInput();
    for (const t of this.tracks.values()) this.disposeTrack(t);
    this.tracks.clear();
    for (const l of this.labelPool) l.remove();
    for (const l of this.gridLabels) l.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.leaderSvg.remove();
    this.composer.dispose();
    // Do not forceContextLoss(): Chrome then blacklists WebGL for the origin after a few remounts
    // (overlap walks /play → snapshot, and the landbat suite remounts the plot dozens of times).
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------- tracks

  private visibleUnits(input: PlotInput): Unit[] {
    return input.units.filter(
      (u) => u.damageState !== "destroyed" && (!input.fogOfWar || u.side === input.playerSide),
    );
  }

  private visibleWeapons(input: PlotInput): WeaponInFlight[] {
    if (!input.fogOfWar) return input.weaponsInFlight;
    const side = new Map(input.units.map((u) => [u.id, u.side]));
    return input.weaponsInFlight.filter(
      (w) => w.launchedBySide === input.playerSide || side.get(w.targetId) === input.playerSide,
    );
  }

  private ensureTrack(kind: TrackKind, id: string): Track {
    const key = `${kind}:${id}`;
    let t = this.tracks.get(key);
    if (!t) {
      t = {
        key, kind, id,
        from: new THREE.Vector2(), to: new THREE.Vector2(NaN, NaN), pos: new THREE.Vector2(), disp: new THREE.Vector2(),
        dispPx: new THREE.Vector2(), dispInit: false, shown: false, compactOn: false,
        z: 0, t0: 0, history: [], lastHistSim: -Infinity,
        spriteW: 0, spriteH: 0, spriteAx: 0, spriteAy: 0, blockText: "", blockW: 0, blockH: 0, slot: 0,
        compactText: "", compactW: 0, compactH: 0, fullW: 0, fullH: 0, shownText: "",
        screen: new THREE.Vector2(), onScreen: false, alpha: 1, paintT: 0, seen: true,
      };
      if (kind !== "weapon") {
        const el = document.createElement("div");
        el.className = `tx-block tx-block--${kind}`;
        el.setAttribute("data-testid", "plot-track");
        el.dataset.kind = kind;
        if (kind === "unit") el.dataset.unitId = id;
        else el.dataset.contactId = id;
        this.overlay.appendChild(el);
        t.block = el;
      }
      this.tracks.set(key, t);
    }
    t.seen = true;
    return t;
  }

  private moveTrack(t: Track, x: number, y: number, now: number, smooth: boolean) {
    if (Number.isNaN(t.to.x)) {
      t.from.set(x, y);
      t.to.set(x, y);
      t.pos.set(x, y);
      t.t0 = now;
      return;
    }
    if (t.to.x === x && t.to.y === y) return;
    if (smooth) {
      t.from.copy(t.pos);
      t.to.set(x, y);
      t.t0 = now;
    } else {
      t.from.set(x, y);
      t.to.set(x, y);
      t.pos.set(x, y);
    }
  }

  private sampleHistory(t: Track, simTime: number, interval: number) {
    if (simTime - t.lastHistSim < interval) return;
    t.lastHistSim = simTime;
    const h = t.history;
    const n = h.length;
    if (n >= 2 && h[n - 2] === t.to.x && h[n - 1] === t.to.y) return;
    h.push(t.to.x, t.to.y);
    if (h.length > HIST_MAX * 2) h.splice(0, 2);
  }

  private resetHistory() {
    for (const t of this.tracks.values()) {
      t.history.length = 0;
      t.lastHistSim = -Infinity;
    }
    this.lastEventId = null;
    this.effects.length = 0;
  }

  private setSprite(t: Track, sidc: string, color: string, state: GlyphState) {
    const key = `${sidc}|${color}|${state.certainty}|${state.stale ? 1 : 0}|${state.damage ?? 0}`;
    if (t.spriteKey === key) return;
    const tex = symbolTexture(sidc, color, Math.max(2, Math.ceil(this.dpr * 1.5)), state);
    if (!t.sprite) {
      const m = new THREE.SpriteMaterial({
        map: tex.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      });
      t.sprite = new THREE.Sprite(m);
      t.sprite.renderOrder = 30;
      this.scene.add(t.sprite);
    } else {
      (t.sprite.material as THREE.SpriteMaterial).map = tex.texture;
      (t.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
    }
    // the drawing is centred on the anchor; the layout box below is the one labels have always kept clear of
    t.sprite.center.set(0.5, 0.5);
    t.spriteW = tex.width;
    t.spriteH = tex.height;
    t.spriteAx = tex.center.x * tex.width;
    t.spriteAy = (1 - tex.center.y) * tex.height;
    t.spriteKey = key;
  }

  private disposeTrack(t: Track) {
    if (t.sprite) {
      this.scene.remove(t.sprite);
      (t.sprite.material as THREE.Material).dispose();
    }
    t.block?.remove();
    const sw = this.sweeps.get(t.key);
    if (sw) {
      this.scene.remove(sw);
      (sw.material as THREE.Material).dispose();
      this.sweeps.delete(t.key);
    }
  }

  private blockLines(t: Track, input: PlotInput): { lines: string[]; cls: string } {
    if (t.kind === "unit" && t.unit) {
      const u = t.unit;
      const aff = getAffiliation(u, input.playerSide);
      const pl = getPlatform(u.platformId);
      let l2 = `C${pad3(u.heading)} S${Math.round(u.speed)}`;
      if (pl?.dimension === "air" && u.altitude !== undefined) l2 += ` FL${String(Math.round(u.altitude / 100)).padStart(3, "0")}`;
      if (pl?.dimension === "subsurface") l2 += " D---";
      const dmg = u.damageState === "damaged" ? "DMG" : u.damageState === "mission-kill" ? "M-KILL" : "";
      return { lines: [shortName(u.name), l2, ...(dmg ? [dmg] : [])], cls: aff };
    }
    if (t.kind === "contact" && t.contact) {
      const c = t.contact;
      const age = Math.max(0, Math.floor((input.simTime - c.lastUpdateTime) / 1000));
      const l1 = `TN${trackNumber(c.id)} ${CLS_LABEL[c.classification]}`;
      const l2 = c.platformName ? shortName(c.platformName.split("[")[0]) : c.sensorType.toUpperCase();
      const parts: string[] = [];
      if (c.estimatedHeading !== undefined) parts.push(`C${pad3(c.estimatedHeading)}`);
      if (c.estimatedSpeed !== undefined) parts.push(`S${Math.round(c.estimatedSpeed)}`);
      if (age > 30) parts.push(`+${age}S`);
      const known = c.classification === "classified" || c.classification === "tracked";
      return { lines: parts.length ? [l1, l2, parts.join(" ")] : [l1, l2], cls: known ? "hostile" : "unknown" };
    }
    return { lines: [], cls: "" };
  }

  private contactAlpha(c: Contact, simTime: number): number {
    const age = (simTime - c.lastUpdateTime) / 1000;
    if (age <= 15) return 1;
    return Math.max(0.3, 1 - (age - 15) / 150);
  }

  // ------------------------------------------------------------------ input

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.drag = { x, y, lastX: x, lastY: y, lastT: performance.now(), moved: false, id: e.pointerId };
    this.vel.set(0, 0);
    this.glide = null;
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.cursorPx = new THREE.Vector2(x, y);
    const d = this.drag;
    if (d) {
      if (!d.moved && Math.hypot(x - d.x, y - d.y) > 4) d.moved = true;
      if (d.moved) {
        const a = this.groundAt(d.lastX, d.lastY, this.groundA), b = this.groundAt(x, y, this.groundB);
        const now = performance.now();
        if (a && b) {
          const dx = a.x - b.x, dy = a.y - b.y;
          this.target.x += dx;
          this.target.y += dy;
          const dt = Math.max(1, now - d.lastT) / 1000;
          this.vel.set(this.vel.x * 0.6 + (dx / dt) * 0.4, this.vel.y * 0.6 + (dy / dt) * 0.4);
        }
        d.lastX = x;
        d.lastY = y;
        d.lastT = now;
      }
    }
    this.updateCursorReadout();
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    try { this.renderer.domElement.releasePointerCapture(d.id); } catch { /* already released */ }
    if (!d.moved) {
      this.vel.set(0, 0);
      this.handleClick(d.x, d.y, e.shiftKey);
    } else if (performance.now() - d.lastT > 80) {
      this.vel.set(0, 0); // held still before release: no throw
    }
  };

  private onPointerLeave = () => {
    this.cursorPx = null;
    this.hoverKey = null;
    this.updateCursorReadout();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.renderer.domElement.getBoundingClientRect();
    this.zoomAnchor = new THREE.Vector2(e.clientX - r.left, e.clientY - r.top);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.distGoal = THREE.MathUtils.clamp(this.distGoal * Math.exp(delta * 0.0012), 15, 2600);
  };

  private onContext = (e: Event) => e.preventDefault();

  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", this.onContext);
  }

  private unbindInput() {
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", this.onContext);
  }

  private pick(x: number, y: number): Track | null {
    let best: Track | null = null;
    let bestD = 18;
    for (const t of this.tracks.values()) {
      if (t.kind !== "unit" || !t.onScreen) continue;
      const d = Math.hypot(t.screen.x - x, t.screen.y - y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best) return best;
    // the data block is a click target too
    for (const t of this.tracks.values()) {
      if (t.kind !== "unit" || !t.onScreen || !t.block || t.block.style.display === "none") continue;
      const off = this.slotOffset(t, t.slot);
      const bx = t.screen.x + off.x, by = t.screen.y + off.y;
      if (x >= bx && x <= bx + t.blockW && y >= by && y <= by + t.blockH) return t;
    }
    return null;
  }

  private pickFacility(x: number, y: number): Facility | null {
    const layer = this.facilityLayer;
    if (!layer || this.input?.showFacilities === false) return null;
    const g = this.groundAt(x, y);
    return layer.pick(x, y, g ? { x: g.x, y: g.y } : null, this.kPx, (px, py) => this.toScreen(px, py, 0));
  }

  private handleClick(x: number, y: number, shiftKey: boolean) {
    const input = this.input;
    if (input && input.mode !== "select") {
      const g = this.groundAt(x, y);
      if (g && this.callbacks.onMapClick(this.proj.toGeo(g.x, g.y)) === true) return;
    }
    const hit = this.pick(x, y);
    if (hit) {
      this.callbacks.onUnitSelect(hit.id, shiftKey);
      return;
    }
    const osint = this.osintLayer ? this.osintLayer.pick(x, y, (px, py) => this.toScreen(px, py, 0), this.kPx) : null;
    if (osint) {
      this.callbacks.onOsintSelect?.(osint.site.id);
      return;
    }
    const fac = this.pickFacility(x, y);
    if (fac) {
      this.callbacks.onFacilitySelect?.(fac.id);
      return;
    }
    const g = this.groundAt(x, y);
    const handled = g ? this.callbacks.onMapClick(this.proj.toGeo(g.x, g.y)) === true : false;
    if (!handled) this.callbacks.onUnitSelect(null, false);
  }

  private updateCursorReadout() {
    const el = this.readouts.cursor;
    if (!el) return;
    let text = "--";
    if (this.cursorPx) {
      const g = this.groundAt(this.cursorPx.x, this.cursorPx.y);
      if (g) {
        const p = this.proj.toGeo(g.x, g.y);
        text = `${formatDmm(p.lat, "N", "S", 2)} ${formatDmm(p.lng, "E", "W", 3)}`;
      }
    }
    if (el.textContent !== text) el.textContent = text;
  }

  // ------------------------------------------------------------------ view

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.W = w;
    this.H = h;
    // Soft GL (SwiftShader / llvmpipe) at CSS DPR 2 paints a 4K buffer every frame and starves the play-shots
    // path under Xvfb. Cap the drawing buffer; window.devicePixelRatio itself stays whatever the host set.
    if (!this.softGl) this.softGl = this.detectSoftGl();
    const cap = this.softGl ? 1 : 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, cap);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * this.dpr, h * this.dpr);
    const rw = w * this.dpr, rh = h * this.dpr;
    for (const b of [...this.staticBatches, this.solid, this.thin, this.dashed]) b.setResolution(rw, rh);
    this.osintLayer?.resize(rw, rh, this.dpr);
    if (this.reliefWire) (this.reliefWire.material as LineMaterial).resolution.set(rw, rh);
    (this.dots.material as THREE.PointsMaterial).size = 3 * this.dpr;
    (this.marks.material as THREE.PointsMaterial).size = 7 * this.dpr;
    for (const b of [this.solid, this.thin, this.dashed, ...this.staticBatches]) {
      b.material.linewidth = (b === this.solid ? 1.5 : b === this.dashed ? 1.3 : this.batchWidth.get(b) ?? 1) * this.dpr;
    }
    if (this.reliefWire) (this.reliefWire.material as LineMaterial).linewidth = this.dpr;
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.viewHash = "";
  }

  private applyViewOffset() {
    // centre the theater in the free area between the chrome, without
    // resizing the canvas: shift the principal point instead
    const shiftX = (this.insets.right - this.insets.left) / 2;
    const shiftY = (this.insets.bottom - this.insets.top) / 2;
    this.camera.setViewOffset(this.W, this.H, shiftX, shiftY, this.W, this.H);
    this.camera.updateProjectionMatrix();
  }

  private updateCamera() {
    const pitch = this.tiltAmt * TILT_PITCH;
    const d = this.dist;
    this.camera.position.set(this.target.x, this.target.y - d * Math.sin(pitch), d * Math.cos(pitch));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target.x, this.target.y, 0);
    this.camera.near = Math.max(0.5, d * 0.02);
    this.camera.far = d * 6 + 4000;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const worldH = 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.kPx = worldH / this.H;
    this.spriteK = (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.H;
  }

  /** Ground point under a screen pixel, written into `out` (no allocation). */
  private groundAt(x: number, y: number, out: THREE.Vector3 = this.groundA): THREE.Vector3 | null {
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.ground, out);
  }

  /** Screen position of a plot point. Returns a shared vector: copy it to keep it. */
  private toScreen(x: number, y: number, z: number): THREE.Vector3 {
    const v = this.projV.set(x, y, z).project(this.camera);
    return this.screenV.set(((v.x + 1) / 2) * this.W, ((1 - v.y) / 2) * this.H, v.z);
  }

  /** World units per CSS pixel near a ground point (perspective-aware). */
  private pxAt(x: number, y: number, z = 0): number {
    if (this.tiltAmt < 0.001) return this.kPx;
    const d = this.camera.position.distanceTo(this.tmpV3.set(x, y, z));
    return (2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.H;
  }

  // ---------------------------------------------------------------- frame

  private detectSoftGl(): boolean {
    try {
      const gl = this.renderer.getContext() as WebGLRenderingContext | null;
      const name = gl ? String(gl.getParameter(gl.RENDERER) ?? "") : "";
      return /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(name);
    } catch {
      return false;
    }
  }

  /** One paint without scheduling RAF. Used by the RAF loop and by warmFrames. */
  private paintOnce(now: number) {
    if (this.disposed) return;
    // Never a negative step: the browser stamps a frame when it is scheduled, which on a busy page can be before
    // this plot was even built. A negative step turned the opening zoom's ease into a throw far out of the theater.
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.frames++;
    this.stepCamera(dt);
    this.drawDynamic(now);
    try {
      this.composer.render(dt);
    } catch {
      // Soft GL / lost context: keep the counter advancing so openPlay is not stuck behind a throw.
    }
  }

  /**
   * Pump real paints right after construct so `__sandPlot.frames()` clears the openPlay gate before focusArea.
   * Caps wall time so a slow first GPU compile cannot block React commit.
   */
  private warmFrames(count: number) {
    const t0 = performance.now();
    for (let i = 0; i < count && this.frames < count; i++) {
      if (performance.now() - t0 > 800) break;
      this.paintOnce(t0 + i * 16);
    }
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    this.paintOnce(now);
  };

  private stepCamera(dt: number) {
    // tilt
    const tiltPrev = this.tiltAmt;
    this.tiltAmt += (this.tiltGoal - this.tiltAmt) * (1 - Math.exp(-dt * 5));
    if (Math.abs(this.tiltGoal - this.tiltAmt) < 0.001) this.tiltAmt = this.tiltGoal;

    // zoom toward the anchor so the point under the cursor stays put
    if (Math.abs(this.dist - this.distGoal) > 0.01) {
      const anchor = this.zoomAnchor;
      this.updateCamera();
      const before = anchor ? this.groundAt(anchor.x, anchor.y, this.groundA) : null;
      this.dist += (this.distGoal - this.dist) * (1 - Math.exp(-dt * 11));
      if (Math.abs(this.dist - this.distGoal) < 0.01) this.dist = this.distGoal;
      this.updateCamera();
      const after = anchor ? this.groundAt(anchor.x, anchor.y, this.groundB) : null;
      if (before && after) {
        this.target.x += before.x - after.x;
        this.target.y += before.y - after.y;
      }
    }

    // glide to a focused unit
    if (this.glide) {
      const k = 1 - Math.exp(-dt * 4);
      this.target.x += (this.glide.x - this.target.x) * k;
      this.target.y += (this.glide.y - this.target.y) * k;
      if (this.target.distanceTo(this.glide) < this.kPx * 0.5) this.glide = null;
    }

    // pan inertia
    if (!this.drag && this.vel.lengthSq() > 1e-4) {
      this.target.x += this.vel.x * dt;
      this.target.y += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-dt * 4.5));
      if (this.vel.length() < this.kPx * 2) this.vel.set(0, 0);
    }

    // keep the plot over the theater
    const b = geo.bbox as number[];
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.proj.x(b[0]), this.proj.x(b[2]));
    this.target.y = THREE.MathUtils.clamp(this.target.y, this.proj.y(b[1]), this.proj.y(b[3]));
    this.updateCamera();
    // The simplified Natural Earth coast is off by up to 1.3 km (Havadarya's whole outline falls "at sea"), so where the
    // facility outlines draw, coast and land fill step back and the surveyed outlines are the only edge on screen
    const coastK = THREE.MathUtils.clamp((this.kPx - 0.05) / 0.1, 0, 1);
    if (this.coastBatch) this.coastBatch.material.opacity = coastK;
    if (this.coastBatch) this.coastBatch.object.visible = coastK > 0.01;
    if (this.coastHalo) {
      this.coastHalo.material.opacity = coastK;
      this.coastHalo.object.visible = coastK > 0.01;
    }
    if (this.landMesh) {
      const lm = this.landMesh.material as THREE.MeshBasicMaterial;
      lm.opacity = coastK;
      // tilted, the raised relief is drawn over the flat chart: the flat tone steps back so the two do not add up
      lm.color.setScalar(1 - 0.5 * this.tiltAmt);
    }
    this.facilityLayer?.setView(this.kPx, this.input?.showFacilities !== false);
    this.osintLayer?.setView(this.kPx, true);

    const t = this.tiltAmt;
    if (this.relief && this.reliefWire) {
      const vis = t > 0.002;
      this.relief.visible = vis;
      this.reliefWire.visible = vis;
      this.relief.scale.z = Math.max(0.001, t);
      this.reliefWire.scale.z = Math.max(0.001, t);
      (this.relief.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t * 1.2) * 0.5;
      // the mesh lines stay a hint (Ray: the green grid was "a bit too much"); the lit relief carries the shape
      (this.reliefWire.material as LineMaterial).opacity = t * 0.14;
    }

    const hash = `${this.target.x.toFixed(2)},${this.target.y.toFixed(2)},${this.dist.toFixed(2)},${t.toFixed(3)},${this.W},${this.H}`;
    // Coarse unit fingerprint so a settled camera re-declutters once tracks (or ADS-B snapshot traffic) appear.
    let unitSig = this.tracks.size;
    for (const tr of this.tracks.values()) {
      if (tr.kind === "weapon" || !tr.sprite) continue;
      unitSig = (unitSig * 33 + (Math.round(tr.pos.x) << 5) + Math.round(tr.pos.y)) | 0;
    }
    const declKey = `${hash}|${this.input?.selectedFacilityId ?? ""}|${this.input?.showFacilities !== false}|${this.osintLayer?.root.visible ? 1 : 0}|${unitSig}`;
    if (declKey !== this.declKey) {
      this.declKey = declKey;
      this.declutterFacilities();
    }
    if (hash !== this.viewHash || tiltPrev !== t) {
      this.viewHash = hash;
      this.updateGridLabels();
      this.updateScaleBar();
      this.updateCursorReadout();
    }
  }

  private drawDynamic(now: number) {
    const input = this.input;
    const solid = this.solid, thin = this.thin, dashed = this.dashed;
    solid.clear();
    thin.clear();
    dashed.clear();
    let nd = 0, nm = 0;
    const dotsPos = this.dotsPos, dotsCol = this.dotsCol, marksPos = this.marksPos, marksCol = this.marksCol;
    const dot = (x: number, y: number, z: number, c: THREE.Color, a: number) => {
      if (nd >= 4096) return;
      dotsPos[nd * 3] = x; dotsPos[nd * 3 + 1] = y; dotsPos[nd * 3 + 2] = z;
      dotsCol[nd * 3] = c.r * a; dotsCol[nd * 3 + 1] = c.g * a; dotsCol[nd * 3 + 2] = c.b * a;
      nd++;
    };
    const mark = (x: number, y: number, z: number, c: THREE.Color, a: number) => {
      if (nm >= 1024) return;
      marksPos[nm * 3] = x; marksPos[nm * 3 + 1] = y; marksPos[nm * 3 + 2] = z;
      marksCol[nm * 3] = c.r * a; marksCol[nm * 3 + 1] = c.g * a; marksCol[nm * 3 + 2] = c.b * a;
      nm++;
    };
    let discUsed = 0;
    const disc = (x: number, y: number, r: number, c: THREE.Color, a: number) => {
      let m = this.discs[discUsed];
      if (!m) {
        m = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
          transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        m.renderOrder = 6;
        this.discs.push(m);
        this.scene.add(m);
      }
      (m.material as THREE.MeshBasicMaterial).color.copy(c).multiplyScalar(a);
      m.position.set(x, y, 0);
      m.scale.set(r, r, 1);
      m.visible = true;
      discUsed++;
    };
    this.labelsUsed = 0;
    this.labelRects.length = 0;
    this.labelTexts.length = 0;
    this.labelEls.length = 0;
    const dr = this.drawn;
    dr.weaponLines = dr.weaponHeads = dr.uncertaintyDiscs = dr.uncertaintyEdges = 0;
    dr.coverageDiscs = dr.coverageEdges = dr.unitSprites = dr.contactSprites = 0;
    dr.waypointPaths.length = 0;
    this.refreshOccluders(now);
    if (!input) this.facilityLabels(null);

    const dashPx = 7, gapPx = 5;
    dashed.material.dashSize = dashPx * this.kPx;
    dashed.material.gapSize = gapPx * this.kPx;
    for (const b of this.staticBatches) {
      if (b.material.dashed) {
        b.material.dashSize = (b === this.staticBatches[0] ? 6 : 3) * this.kPx;
        b.material.gapSize = (b === this.staticBatches[0] ? 6 : 4) * this.kPx;
      }
    }

    if (input) {
      const tilt = this.tiltAmt;
      const sweepAngle = ((now / 1000) * Math.PI * 2) / SWEEP_PERIOD_S;

      // interpolate and lift tracks
      for (const t of this.tracks.values()) {
        const k = Math.min(1, (now - t.t0) / LERP_MS);
        t.pos.set(t.from.x + (t.to.x - t.from.x) * k, t.from.y + (t.to.y - t.from.y) * k);
        let z = 0;
        if (t.unit && t.unit.altitude && getPlatform(t.unit.platformId)?.dimension === "air") {
          z = t.unit.altitude * FT_TO_KM * RELIEF_EXAG * tilt;
        }
        t.z = z;
        t.alpha = t.contact ? this.contactAlpha(t.contact, input.simTime) : 1;
      }
      this.spreadTracks();
      this.buildObstacles();
      this.facilityLabels(input);

      const unitTrack = (id: string) => this.tracks.get(`unit:${id}`);

      // sensor coverage (S): faint disc and dashed edge, domes when tilted.
      // Overlapping emitters share one intensity budget so a group stays readable.
      let coverageShare = 1;
      if (input.showSensorCoverage) {
        const emitters = [...this.tracks.values()].filter(
          (t) => t.kind === "unit" && t.unit && t.unit.side === input.playerSide &&
            input.orders.get(t.unit.id)?.radarActive && getPlatform(t.unit.platformId)?.sensorRangeKm,
        );
        coverageShare = 1 / Math.max(1, emitters.length);
        const edgeShare = 1 / Math.sqrt(Math.max(1, emitters.length));
        for (const t of emitters) {
          const rKm = getPlatform(t.unit!.platformId)!.sensorRangeKm!;
          disc(t.pos.x, t.pos.y, rKm, C.phosphor, 0.03 * coverageShare);
          dr.coverageDiscs++;
          dashed.circle(t.pos.x, t.pos.y, 0, rKm, C.dim, 0.75 * edgeShare, 120);
          dr.coverageEdges++;
          if (tilt > 0.02) this.dome(thin, t.pos.x, t.pos.y, rKm, tilt * Math.max(0.4, edgeShare));
        }
      }

      // mission areas: the scenario's own polygon, outlined and labelled in the hi tone (a reference, not a contact)
      this.areaLabelCount = 0;
      if (this.pendingAreaFocus) this.focusArea(this.pendingAreaFocus.areaId, this.pendingAreaFocus.opts);
      for (const a of input.areas ?? []) {
        if (a.points.length < 3) continue;
        dashed.breakRun();
        let top = -Infinity, cx = 0;
        const xy = a.points.map((p) => [this.proj.x(p.lng), this.proj.y(p.lat)] as const);
        for (let i = 0; i < xy.length; i++) {
          const [x, y] = xy[i];
          const [nx, ny] = xy[(i + 1) % xy.length];
          dashed.seg(x, y, 0, nx, ny, 0, C.hi, 0.8);
          // a solid bracket at each corner, running a short way along both edges
          const [qx, qy] = xy[(i + xy.length - 1) % xy.length];
          const arm = 16 * this.pxAt(x, y);
          for (const [ox, oy] of [[nx, ny], [qx, qy]]) {
            const len = Math.hypot(ox - x, oy - y) || 1;
            const k = Math.min(arm, len / 3) / len;
            solid.seg(x, y, 0, x + (ox - x) * k, y + (oy - y) * k, 0, C.hi, 1);
          }
          cx += x / xy.length;
          top = Math.max(top, y);
        }
        if (this.placeNear(a.label, "tx-obj-label", cx, top, 4)) this.areaLabelCount++;
      }

      // range rings: selected unit and Shift+click pins
      const ringIds = new Set(input.pinnedRingIds);
      if (input.selectedUnitId) ringIds.add(input.selectedUnitId);
      for (const id of ringIds) {
        const t = unitTrack(id);
        if (!t || !t.unit) continue;
        const pl = getPlatform(t.unit.platformId);
        const friendly = t.unit.side === input.playerSide;
        const col = friendly ? C.phosphor : C.alarm;
        if (pl?.sensorRangeKm) {
          dashed.circle(t.pos.x, t.pos.y, 0, pl.sensorRangeKm, col, 0.75, 120);
          this.placeRingLabel(t.pos.x, t.pos.y, pl.sensorRangeKm, `SNS ${Math.round(pl.sensorRangeKm / KM_PER_NM)}NM`, friendly);
        }
        if (pl?.weaponRangeKm) {
          solid.circle(t.pos.x, t.pos.y, 0, pl.weaponRangeKm, col, 0.5, 120);
          this.placeRingLabel(t.pos.x, t.pos.y, pl.weaponRangeKm, `WPN ${Math.round(pl.weaponRangeKm / KM_PER_NM)}NM`, friendly);
        }
        if (id === input.selectedUnitId) this.bearingRose(thin, t.pos.x, t.pos.y, col);
      }

      // contact position uncertainty (fog of war only)
      if (input.fogOfWar) {
        for (const t of this.tracks.values()) {
          if (!t.contact || t.contact.positionUncertainty <= 0.5) continue;
          const known = t.contact.classification === "classified" || t.contact.classification === "tracked";
          const col = known ? C.alarm : C.cautionDim;
          disc(t.pos.x, t.pos.y, t.contact.positionUncertainty, col, 0.05 * t.alpha);
          dr.uncertaintyDiscs++;
          dashed.circle(t.pos.x, t.pos.y, 0, t.contact.positionUncertainty, col, 0.55 * t.alpha, 48);
          dr.uncertaintyEdges++;
        }
      }

      // waypoints
      for (const path of this.waypointPaths(input)) {
        const t = unitTrack(path.unitId);
        if (!t) continue;
        dashed.breakRun();
        dr.waypointPaths.push({ unitId: path.unitId, points: path.points.length });
        let px = t.pos.x, py = t.pos.y;
        path.points.forEach((p, i) => {
          const x = this.proj.x(p.lng), y = this.proj.y(p.lat);
          dashed.seg(px, py, 0, x, y, 0, C.phosphor, 0.85);
          // a diamond at each turn point; the last one, where the unit stops, is doubled
          const d = 5 * this.pxAt(x, y);
          solid.polyline([x, y + d, x + d, y, x, y - d, x - d, y], 0, C.phosphor, 1, true);
          if (i === path.points.length - 1) solid.polyline([x, y + d * 1.9, x + d * 1.9, y, x, y - d * 1.9, x - d * 1.9, y], 0, C.phosphor, 0.55, true);
          else dot(x, y, 0, C.phosphor, 0.9);
          this.placeNear(`WP${i + 1}`, "tx-wp-label", x, y, 5);
          px = x; py = y;
        });
      }

      // track history dots
      for (const t of this.tracks.values()) {
        const h = t.history;
        const n = h.length / 2;
        if (!n || t.kind === "weapon") continue;
        const col = t.contact ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? C.alarm : C.caution) : t.unit && t.unit.side !== input.playerSide ? C.alarm : C.phosphor;
        for (let i = 0; i < n; i++) {
          const a = (0.2 + 0.6 * ((i + 1) / n)) * t.alpha;
          dot(h[i * 2], h[i * 2 + 1], 0, col, a);
        }
      }

      // weapons: a dart on its heading, the smoke of where it has been, a quiet line to what it is going for
      for (const w of this.weaponLines(input)) {
        const t = this.tracks.get(`weapon:${w.weapon.id}`);
        if (!t) continue;
        const col = w.friendly ? C.phosphor : C.alarm;
        if (w.target) {
          dashed.breakRun();
          dashed.seg(t.pos.x, t.pos.y, 0, w.target.x, w.target.y, 0, col, 0.3);
          dr.weaponLines++;
        }
        dr.weaponHeads++;
        const px = this.pxAt(t.pos.x, t.pos.y);
        const dir = THREE.MathUtils.degToRad(w.weapon.heading);
        const fx = Math.sin(dir), fy = Math.cos(dir), rx = fy, ry = -fx;
        const at = (f: number, r: number): [number, number] => [t.pos.x + (fx * f + rx * r) * px, t.pos.y + (fy * f + ry * r) * px];
        const [nx, ny] = at(8, 0), [lx, ly] = at(-5, -4.5), [qx, qy] = at(-1.5, 0), [ex, ey] = at(-5, 4.5);
        solid.polyline([nx, ny, lx, ly, qx, qy, ex, ey], 0, C.hi, 1, true);
        solid.seg(nx, ny, 0, qx, qy, 0, col, 1);
        // trail: newest sample first, thinning out behind
        const h = t.history, n = h.length / 2;
        let tx = qx, ty = qy;
        for (let i = n - 1; i >= 0; i--) {
          const a = 0.85 * ((i + 1) / n);
          (i >= n - 3 ? solid : thin).seg(tx, ty, 0, h[i * 2], h[i * 2 + 1], 0, col, a);
          tx = h[i * 2]; ty = h[i * 2 + 1];
        }
        if (!n) {
          const [bx, by] = at(-16, 0);
          solid.seg(qx, qy, 0, bx, by, 0, col, 0.8);
        }
      }

      // unit and contact glyphs, leaders, drop lines, sweeps
      const usedSweeps = new Set<string>();
      for (const t of this.tracks.values()) {
        if (!t.sprite) continue;
        const px = this.pxAt(t.pos.x, t.pos.y, t.z);
        const gx = t.pos.x + t.disp.x, gy = t.pos.y + t.disp.y;
        t.sprite.position.set(gx, gy, t.z);
        if (t.disp.x !== 0 || t.disp.y !== 0) thin.seg(t.pos.x, t.pos.y, t.z, gx, gy, t.z, C.dim, 0.5);
        const pulse = t.paintT ? Math.max(0, 1 - (now - t.paintT) / 350) : 0;
        const s = this.spriteK * (1 + pulse * 0.25);
        t.sprite.scale.set(GLYPH_PX * s, GLYPH_PX * s, 1);
        (t.sprite.material as THREE.SpriteMaterial).opacity = t.alpha;
        if (t.sprite.visible && t.alpha > 0) {
          if (t.kind === "unit") dr.unitSprites++;
          else dr.contactSprites++;
        }

        const friendly = t.unit?.side === input.playerSide;
        const hostileUnit = !!t.unit && !friendly;
        const col = t.contact
          ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? C.alarm : C.caution)
          : hostileUnit ? C.alarm : C.phosphor;

        // course leader
        const hdg = t.unit ? t.unit.heading : t.contact?.estimatedHeading;
        const spd = t.unit ? t.unit.speed : t.contact?.estimatedSpeed ?? 0;
        if (hdg !== undefined && spd > 0) {
          // the leader starts at the frame, so the glyph's plate never swallows a slow ship's course
          const L0 = 19 * px, L = (29 + Math.min(30, spd * 0.07)) * px;
          const a = THREE.MathUtils.degToRad(hdg);
          solid.seg(gx + Math.sin(a) * L0, gy + Math.cos(a) * L0, t.z, gx + Math.sin(a) * L, gy + Math.cos(a) * L, t.z, col, 0.9 * t.alpha);
        }
        if (t.z > 0.01) thin.seg(gx, gy, 0, gx, gy, t.z, col, 0.45);

        // radar sweep on emitters
        if (t.unit && input.orders.get(t.unit.id)?.radarActive) {
          // with S on, friendly ships sweep their full radar range, faintly
          const pl = getPlatform(t.unit.platformId);
          const big = input.showSensorCoverage && friendly && pl?.dimension === "sea" ? pl.sensorRangeKm : undefined;
          const radius = big ?? 34 * px;
          this.sweep(t, radius, sweepAngle + (parseInt(trackNumber(t.id), 10) % 360) * 0.0174533, friendly ? C.phosphor : C.alarm, big ? 0.2 * coverageShare : 0.75);
          usedSweeps.add(t.key);
        }
      }
      for (const [key, m] of this.sweeps) {
        if (!usedSweeps.has(key)) m.visible = false;
      }

      // selection reticle and hover bracket
      const sel = input.selectedUnitId ? unitTrack(input.selectedUnitId) : undefined;
      if (sel) this.reticle(solid, sel, 25, C.hi, 1);
      const hov = this.hoverKey ? this.tracks.get(this.hoverKey) : undefined;
      if (hov && hov !== sel) this.reticle(thin, hov, 23, C.phosphor, 0.7);

      // measurement
      if (input.measureStart) {
        const a = input.measureStart;
        const ax = this.proj.x(a.lng), ay = this.proj.y(a.lat);
        mark(ax, ay, 0, C.hi, 1);
        if (input.measureEnd) {
          const b = input.measureEnd;
          const bx = this.proj.x(b.lng), by = this.proj.y(b.lat);
          mark(bx, by, 0, C.hi, 1);
          solid.seg(ax, ay, 0, bx, by, 0, C.hi, 0.9);
          this.placeNear(formatMeasurement(a, b).toUpperCase(), "tx-measure-label", (ax + bx) / 2, (ay + by) / 2, 4);
        }
      }

      // effects: each plays once and is gone. Nothing here repeats, blinks or strobes.
      this.effects = this.effects.filter((e) => {
        const k = (now - e.t0) / EFFECT_LIFE[e.kind];
        if (k >= 1) return false;
        if (k < 0) return true;
        const px = this.pxAt(e.x, e.y);
        const ease = 1 - Math.pow(1 - k, 3);
        const fade = 1 - k;
        if (e.kind === "launch") {
          // a flare at the rail: a ring opening, and a short blast back along the launch heading
          const col = e.friendly ? C.phosphor : C.alarm;
          solid.circle(e.x, e.y, 0, (3 + 15 * ease) * px, col, fade * 0.9, 28);
          const d = e.dir ?? 0;
          for (const off of [-0.5, 0, 0.5]) {
            const a = d + Math.PI + off;
            const r0 = (4 + 10 * ease) * px, r1 = r0 + 9 * px * fade;
            solid.seg(e.x + Math.sin(a) * r0, e.y + Math.cos(a) * r0, 0, e.x + Math.sin(a) * r1, e.y + Math.cos(a) * r1, 0, C.hi, fade);
          }
        } else if (e.kind === "intercept") {
          solid.circle(e.x, e.y, 0, (4 + 16 * ease) * px, C.hi, fade, 24);
          const s = 7 * px * (1 - ease * 0.4);
          solid.seg(e.x - s, e.y - s, 0, e.x + s, e.y + s, 0, C.hi, fade);
          solid.seg(e.x - s, e.y + s, 0, e.x + s, e.y - s, 0, C.hi, fade);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + 0.5;
            const r0 = (9 + 14 * ease) * px, r1 = r0 + 4 * px * fade;
            thin.seg(e.x + Math.sin(a) * r0, e.y + Math.cos(a) * r0, 0, e.x + Math.sin(a) * r1, e.y + Math.cos(a) * r1, 0, C.hi, fade * 0.8);
          }
        } else if (e.kind === "wreck") {
          // where a unit was lost: a small broken ring and cross that stays a while, then fades out once
          if (k < 0.03) return true;
          const a = Math.min(1, (1 - k) / 0.3) * 0.75;
          const r = 9 * px;
          for (let q = 0; q < 4; q++) {
            const a0 = q * (Math.PI / 2) + 0.35;
            let lx = e.x + Math.sin(a0) * r, ly = e.y + Math.cos(a0) * r;
            for (let i = 1; i <= 5; i++) {
              const an = a0 + (i / 5) * (Math.PI / 2 - 0.7);
              const x = e.x + Math.sin(an) * r, y = e.y + Math.cos(an) * r;
              thin.seg(lx, ly, 0, x, y, 0, C.alarm, a);
              lx = x; ly = y;
            }
          }
          const c = 4.5 * px;
          solid.seg(e.x - c, e.y - c, 0, e.x + c, e.y + c, 0, C.alarm, a);
          solid.seg(e.x - c, e.y + c, 0, e.x + c, e.y - c, 0, C.alarm, a);
        } else {
          const big = e.kind === "kill" ? 1.7 : 1;
          // the hot core: bright for the first third, then gone
          if (k < 0.34) disc(e.x, e.y, (5 + 9 * ease) * px * big, C.hi, (1 - k / 0.34) * 0.55);
          disc(e.x, e.y, (8 + 30 * ease) * px * big, C.alarm, fade * fade * 0.16);
          // shock front, and a second, slower one behind it
          solid.circle(e.x, e.y, 0, (6 + 38 * ease) * px * big, C.alarm, fade, 48);
          solid.circle(e.x, e.y, 0, (3 + 20 * ease) * px * big, C.hi, fade * 0.85, 36);
          if (e.kind === "kill") solid.circle(e.x, e.y, 0, (4 + 62 * ease) * px, C.alarm, fade * 0.5, 56);
          // debris: streaks of uneven length thrown outward
          const n = e.kind === "kill" ? 14 : 10;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + DEBRIS[i] * 0.5;
            const reach = 0.55 + DEBRIS[(i + 5) % DEBRIS.length] * 0.75;
            const r0 = (9 + 30 * ease * reach) * px * big, r1 = r0 + (4 + 9 * reach) * px * big * fade;
            solid.seg(e.x + Math.sin(a) * r0, e.y + Math.cos(a) * r0, 0, e.x + Math.sin(a) * r1, e.y + Math.cos(a) * r1, 0, i % 3 === 0 ? C.hi : C.alarm, fade);
          }
        }
        return true;
      });

      this.placeBlocks(input);
    }

    for (let i = discUsed; i < this.discs.length; i++) this.discs[i].visible = false;
    for (let i = this.labelsUsed; i < this.labelPool.length; i++) {
      if (this.labelPool[i].style.display !== "none") this.labelPool[i].style.display = "none";
    }

    solid.flush();
    thin.flush();
    dashed.flush();
    const dg = this.dots.geometry, mg = this.marks.geometry;
    dg.setDrawRange(0, nd);
    (dg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (dg.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    mg.setDrawRange(0, nm);
    (mg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (mg.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // hover state for the cursor
    if (this.cursorPx && !this.drag) {
      const h = this.pick(this.cursorPx.x, this.cursorPx.y);
      this.hoverKey = h ? h.key : null;
      const want = h ? "pointer" : input && input.mode !== "select" ? "crosshair" : "default";
      if (this.renderer.domElement.style.cursor !== want) this.renderer.domElement.style.cursor = want;
    } else if (this.drag?.moved) {
      if (this.renderer.domElement.style.cursor !== "grabbing") this.renderer.domElement.style.cursor = "grabbing";
    }
  }

  private sweep(t: Track, radius: number, angle: number, color: THREE.Color, alpha: number) {
    let m = this.sweeps.get(t.key);
    if (!m) {
      m = new THREE.Mesh(
        this.sweepGeo,
        new THREE.ShaderMaterial({
          vertexShader: SWEEP_VERT,
          fragmentShader: SWEEP_FRAG,
          uniforms: { uAngle: { value: 0 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } },
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      m.renderOrder = 7;
      this.sweeps.set(t.key, m);
      this.scene.add(m);
    }
    const u = (m.material as THREE.ShaderMaterial).uniforms;
    u.uAngle.value = angle % (Math.PI * 2);
    (u.uColor.value as THREE.Color).copy(color);
    u.uAlpha.value = alpha;
    m.position.set(t.pos.x + t.disp.x, t.pos.y + t.disp.y, 0.001);
    m.scale.set(radius, radius, 1);
    m.visible = true;
  }

  private dome(batch: LineBatch, cx: number, cy: number, r: number, tilt: number) {
    const hScale = 0.32 * tilt;
    const rings = 4;
    for (let i = 1; i <= rings; i++) {
      const el = (i / (rings + 1)) * (Math.PI / 2);
      const rr = r * Math.cos(el);
      const z = r * Math.sin(el) * hScale;
      batch.circle(cx, cy, z, rr, C.phosphor, 0.3 * tilt, 64);
    }
    for (let m = 0; m < 12; m++) {
      const az = (m / 12) * Math.PI * 2;
      let px = cx + Math.sin(az) * r, py = cy + Math.cos(az) * r, pz = 0;
      for (let s = 1; s <= 10; s++) {
        const el = (s / 10) * (Math.PI / 2);
        const nx = cx + Math.sin(az) * r * Math.cos(el), ny = cy + Math.cos(az) * r * Math.cos(el), nz = r * Math.sin(el) * hScale;
        batch.seg(px, py, pz, nx, ny, nz, C.phosphor, 0.24 * tilt);
        px = nx; py = ny; pz = nz;
      }
    }
  }

  private bearingRose(batch: LineBatch, cx: number, cy: number, col: THREE.Color) {
    const px = this.pxAt(cx, cy);
    const r = 46 * px;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = THREE.MathUtils.degToRad(deg);
      const len = (deg % 30 === 0 ? 7 : 3.5) * px;
      batch.seg(cx + Math.sin(a) * r, cy + Math.cos(a) * r, 0, cx + Math.sin(a) * (r + len), cy + Math.cos(a) * (r + len), 0, col, deg % 90 === 0 ? 0.9 : 0.5);
    }
  }

  private reticle(batch: LineBatch, t: Track, half: number, col: THREE.Color, alpha: number) {
    const px = this.pxAt(t.pos.x, t.pos.y, t.z);
    const h = half * px, a = 8 * px;
    const x = t.pos.x + t.disp.x, y = t.pos.y + t.disp.y;
    const z = t.z;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = x + sx * h, cy = y + sy * h;
      batch.seg(cx, cy, z, cx - sx * a, cy, z, col, alpha);
      batch.seg(cx, cy, z, cx, cy - sy * a, z, col, alpha);
    }
  }


  private iconRect(i: StaticIcon, pad: number): Rect {
    return { x: i.cx - i.half - pad, y: i.cy - i.half - pad, w: (i.half + pad) * 2, h: (i.half + pad) * 2 };
  }

  private glyphRect(t: Track, sx: number, sy: number, pad = 0): Rect {
    return { x: sx - t.spriteAx - pad, y: sy - t.spriteAy - pad, w: t.spriteW + pad * 2, h: t.spriteH + pad * 2 };
  }

  /** World point under a screen pixel on the horizontal plane at height z (a lifted glyph stays under its own pixel). */
  private groundAtHeight(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 | null {
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.planeZ.constant = -z;
    return this.raycaster.ray.intersectPlane(this.planeZ, out);
  }

  /**
   * Fan out glyphs that would sit on top of each other, or on a facility / OSINT icon, so each can be told apart and
   * clicked: every glyph takes the nearest spot where its real rect is clear; the tether shows the true position.
   */
  private spreadTracks() {
    const list: { t: Track; sx: number; sy: number }[] = [];
    for (const t of this.tracks.values()) {
      t.disp.set(0, 0);
      if (t.kind === "weapon" || !t.sprite || !t.spriteW) continue;
      const s = this.toScreen(t.pos.x, t.pos.y, t.z);
      if (s.z >= 1 || s.x < -60 || s.x > this.W + 60 || s.y < -60 || s.y > this.H + 60) {
        t.dispInit = false;
        continue;
      }
      list.push({ t, sx: s.x, sy: s.y });
    }
    const input = this.input;
    const rank = (t: Track) => (input && t.id === input.selectedUnitId ? 0 : input && t.unit?.side === input.playerSide ? 1 : 2);
    list.sort((a, b) => rank(a.t) - rank(b.t) || (a.t.id < b.t.id ? -1 : a.t.id > b.t.id ? 1 : 0));
    const grid = this.gGlyph;
    grid.clear();
    for (const i of this.icons) grid.add(this.iconRect(i, 1));
    for (const g of this.gridRects) grid.add({ x: g.x - 1, y: g.y - 1, w: g.w + 2, h: g.h + 2 });
    for (const e of list) {
      const t = e.t;
      const base = this.glyphRect(t, e.sx, e.sy, 1);
      let tx = 0, ty = 0;
      if (this.visiblePart(base)) {
        if (grid.hits(base)) {
          const baseBad = this.underChrome(base);
          search: for (let rad = 8; rad <= 150; rad += 6) {
            const n = Math.max(8, Math.ceil((2 * Math.PI * rad) / 9));
            for (let k = 0; k < n; k++) {
              const a = -Math.PI / 2 + (((k & 1) ? (k + 1) / 2 : -k / 2) * 2 * Math.PI) / n;
              const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad;
              const r = { x: base.x + dx, y: base.y + dy, w: base.w, h: base.h };
              if (grid.hits(r) || (!baseBad && this.underChrome(r))) continue;
              tx = dx; ty = dy;
              break search;
            }
          }
        }
        grid.add({ x: base.x + tx, y: base.y + ty, w: base.w, h: base.h });
      }
      // ease toward the target so a pan or zoom does not make glyphs hop
      if (!t.dispInit) {
        t.dispPx.set(tx, ty);
        t.dispInit = true;
      } else {
        const ex = tx - t.dispPx.x, ey = ty - t.dispPx.y;
        if (Math.hypot(ex, ey) < 0.5) t.dispPx.set(tx, ty);
        else t.dispPx.set(t.dispPx.x + ex * 0.4, t.dispPx.y + ey * 0.4);
      }
      if (t.dispPx.x !== 0 || t.dispPx.y !== 0) {
        const g = this.groundAtHeight(e.sx + t.dispPx.x, e.sy + t.dispPx.y, t.z, this.groundB);
        if (g) t.disp.set(g.x - t.pos.x, g.y - t.pos.y);
      }
    }
  }

  /** Per frame, after the glyphs are placed: what a label or data block may not sit on, and the grid labels already down. */
  private buildObstacles() {
    this.icons = this.staticIcons();
    this.gSym.clear();
    this.gRun.clear();
    this.gLab.clear();
    for (const i of this.icons) this.gSym.add(this.iconRect(i, 1));
    for (const t of this.tracks.values()) {
      if (t.kind === "weapon" || !t.sprite || !t.spriteW) continue;
      const s = this.toScreen(t.pos.x + t.disp.x, t.pos.y + t.disp.y, t.z);
      if (s.z >= 1) continue;
      this.gSym.add(this.glyphRect(t, s.x, s.y, 2));
    }
    for (const g of this.gridRects) this.gLab.add(g);
  }

  /** Measured size of a label's text with its CSS class (padding included), cached per text and class. */
  private textBox(text: string, cls: string): { w: number; h: number } {
    const key = `${cls}|${text}`;
    let b = this.textBoxes.get(key);
    if (b) return b;
    let el = this.probe;
    if (!el) {
      el = document.createElement("div");
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      this.overlay.appendChild(el);
      this.probe = el;
    }
    el.className = cls;
    el.textContent = text;
    const w = el.offsetWidth, h = el.offsetHeight;
    b = { w: Math.ceil(w) || Math.ceil(text.length * 7.7 + 8), h: Math.ceil(h) || 16 };
    if (this.textBoxes.size > 3000) this.textBoxes.clear();
    this.textBoxes.set(key, b);
    return b;
  }

  /** Put a pooled label element at a screen rect and record the rect. Returns the label's index. */
  private labelAt(text: string, cls: string, rect: Rect, soft: boolean): number {
    let el = this.labelPool[this.labelsUsed];
    if (!el) {
      el = document.createElement("div");
      this.overlay.appendChild(el);
      this.labelPool.push(el);
    }
    this.labelsUsed++;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    if (el.style.display === "none") el.style.display = "";
    el.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
    const idx = this.labelEls.length;
    if (soft) rect.ev = idx;
    this.labelRects.push(rect);
    this.labelTexts.push(text);
    this.labelEls.push(el);
    return idx;
  }

  private slotClear(r: Rect, runways = true): boolean {
    return !this.gLab.hits(r) && !this.gSym.hits(r) && !(runways && this.gRun.hits(r)) && !this.underChrome(r);
  }

  /**
   * Put a facility or OSINT label beside its own icon: the first free slot whose nearest icon is its own wins; with
   * none, the first free slot at all. A slot beyond the four adjacent ones, or nearer to another icon, gets a leader.
   */
  private placeSiteLabel(o: { key: string; text: string; cls: string; ax: number; ay: number; half: number }): boolean {
    const { w, h } = this.textBox(o.text, o.cls);
    const slots = labelSlots(o.half, w, h);
    const icons = this.icons;
    // Prefer slots clear of runways; if the strip grid blankets the field at close zoom, allow a led plate off the strip.
    for (const avoidRun of [true, false]) {
      for (const strict of [true, false]) {
        for (let si = 0; si < slots.length; si++) {
          const r: Rect = { x: Math.round(o.ax + slots[si][0]), y: Math.round(o.ay + slots[si][1]), w, h };
          if (!this.slotClear(r, avoidRun)) continue;
          const d0 = distToRect(o.ax, o.ay, r);
          let nearestKey = o.key, nd = d0;
          for (const i of icons) {
            if (i.kind === "osint-dot" || `${i.kind}:${i.id}` === o.key) continue;
            const d = distToRect(i.cx, i.cy, r);
            if (d < nd - 0.01) { nd = d; nearestKey = `${i.kind}:${i.id}`; }
          }
          const own = nearestKey === o.key;
          if (strict && !own) continue;
          const idx = this.labelAt(o.text, o.cls, r, true);
          this.gLab.add(r);
          const leader = si >= 4 || !own || !avoidRun;
          if (leader) {
            const ex = Math.max(r.x, Math.min(o.ax, r.x + r.w)), ey = Math.max(r.y, Math.min(o.ay, r.y + r.h));
            const dx = ex - o.ax, dy = ey - o.ay, len = Math.hypot(dx, dy);
            if (len > o.half + 2) {
              const sx = o.ax + (dx / len) * (o.half + 1), sy = o.ay + (dy / len) * (o.half + 1);
              this.siteLeaders.push({ ev: idx, d: `M${sx.toFixed(1)} ${sy.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}` });
            }
          }
          this.labelMeta[idx] = { text: o.text, owner: o.key, nearest: nearestKey, leader };
          return true;
        }
      }
    }
    return false;
  }

  /** A small label (waypoint, measurement) beside a screen point, in the first free slot. */
  private placeNear(text: string, cls: string, x: number, y: number, half: number): boolean {
    const s = this.toScreen(x, y, 0);
    if (s.z >= 1) return false;
    const ax = s.x, ay = s.y;
    const { w, h } = this.textBox(text, cls);
    for (const [ox, oy] of labelSlots(half, w, h)) {
      const r: Rect = { x: Math.round(ax + ox), y: Math.round(ay + oy), w, h };
      if (!this.slotClear(r, false)) continue;
      this.labelAt(text, cls, r, false);
      this.gLab.add(r);
      return true;
    }
    return false;
  }

  /** A range-ring label just outside the ring, moved along the ring until it finds clear space. */
  private placeRingLabel(cx: number, cy: number, rKm: number, text: string, friendly: boolean) {
    const cls = friendly ? "tx-ring-label" : "tx-ring-label tx-ring-label--alarm";
    const c = this.toScreen(cx, cy, 0).clone();
    const { w, h } = this.textBox(text, cls);
    for (let step = 0; step <= 30; step++) {
      const deg = step === 0 ? 0 : ((step + 1) >> 1) * 12 * (step & 1 ? 1 : -1);
      const a = THREE.MathUtils.degToRad(deg);
      const p = this.toScreen(cx + Math.sin(a) * rKm, cy + Math.cos(a) * rKm, 0);
      if (p.z >= 1) continue;
      let nx = p.x - c.x, ny = p.y - c.y;
      const len = Math.hypot(nx, ny);
      if (len < 1) { nx = 0; ny = -1; } else { nx /= len; ny /= len; }
      const d = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2 + 3;
      const r: Rect = { x: Math.round(p.x + nx * d - w / 2), y: Math.round(p.y + ny * d - h / 2), w, h };
      if (!this.slotClear(r, false)) continue;
      this.labelAt(text, cls, r, false);
      this.gLab.add(r);
      return;
    }
  }

  private facilityLabels(input: PlotInput | null) {
    const layer = this.facilityLayer;
    const osint = this.osintLayer && this.osintLayer.root.visible ? this.osintLayer : null;
    let used = 0;
    let osintUsed = 0;
    this.siteLabels = true;
    this.siteLeaders.length = 0;
    this.labelMeta.length = 0;
    if (((layer && layer.root.visible) || osint) && input) {
      const selId = input.selectedFacilityId ?? null;
      const mt = layer ? layer.maxLabelTier(this.kPx) : -1;
      const close = this.kPx < 0.03;
      const cap = 36;
      const margin = 60 * this.kPx;
      const lo = this.groundAt(0, this.H, this.groundA), hi = this.groundAt(this.W, 0, this.groundB);
      const x0 = Math.min(lo?.x ?? -1e9, hi?.x ?? -1e9) - margin, x1 = Math.max(lo?.x ?? 1e9, hi?.x ?? 1e9) + margin;
      const y0 = Math.min(lo?.y ?? -1e9, hi?.y ?? -1e9) - margin, y1 = Math.max(lo?.y ?? 1e9, hi?.y ?? 1e9) + margin;
      const runs: Rect[] = [];
      this.runwayRects(runs, x0, x1, y0, y1);
      for (const r of runs) this.gRun.add(r);
      const placedTexts: { text: string; x: number; y: number }[] = [];
      const facilityLabel = (it: { facility: Facility; x: number; y: number; decl?: boolean }, cls: string) => {
        if (it.decl) return;
        const s = this.toScreen(it.x, it.y, 0);
        if (s.z >= 1) return;
        const text = facilityLabelText(it.facility);
        if (cls === "tx-fac-label" && placedTexts.some((p) => p.text === text && Math.hypot(p.x - s.x, p.y - s.y) < 200)) return;
        if (this.placeSiteLabel({ key: `facility-icon:${it.facility.id}`, text, cls, ax: s.x, ay: s.y, half: FACILITY_SYMBOL_PX / 2 })) {
          placedTexts.push({ text, x: s.x, y: s.y });
          used++;
        }
      };
      if (osint) {
        const osel = input.selectedOsintId ?? null;
        const order = [...osint.items].sort((a, b) => (a.site.id === osel ? -1 : 0) - (b.site.id === osel ? -1 : 0));
        for (const it of order) {
          if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
          const sp = this.toScreen(it.x + it.ox * this.kPx, it.y - it.oy * this.kPx, 0);
          if (sp.z >= 1) continue;
          const cls = it.site.id === osel ? "tx-fac-label tx-fac-label--sel" : `tx-fac-label tx-osint-label${sideForAffiliation(it.site.affiliation) === "Iran" ? " tx-osint-label--hostile" : ""}`;
          if (this.placeSiteLabel({ key: `osint-icon:${it.site.id}`, text: siteLabel(it.site).toUpperCase(), cls, ax: sp.x, ay: sp.y, half: OSINT_SYMBOL_PX / 2 })) osintUsed++;
        }
      }
      if (selId && layer) {
        const it = layer.get(selId);
        if (it) {
          const px = this.pxAt(it.x, it.y);
          const h = 15 * px, a = 6 * px;
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const cx = it.x + sx * h, cy = it.y + sy * h;
            this.solid.seg(cx, cy, 0, cx - sx * a, cy, 0, C.hi, 0.95);
            this.solid.seg(cx, cy, 0, cx, cy - sy * a, 0, C.hi, 0.95);
          }
          facilityLabel(it, "tx-fac-label tx-fac-label--sel");
        }
      }
      const byTier = (layer && layer.root.visible ? layer.items : []).filter((it) => it.tier <= mt).sort((p, q) => p.tier - q.tier);
      for (const it of byTier) {
        if (used >= cap) break;
        if (it.facility.id === selId) continue;
        if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
        facilityLabel(it, "tx-fac-label");
      }
      if (close && layer) {
        // runway designators sit beyond the runway ends, along the runway axis, never on the strip
        for (const it of layer.items) {
          if (used >= cap + 24) break;
          if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1 || !it.facility.runways?.length) continue;
          for (const e of layer.runwayEnds(it.facility)) {
            if (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
            const se = this.toScreen(e.x, e.y, 0).clone(), so = this.toScreen(e.ox, e.oy, 0);
            if (se.z >= 1 || so.z >= 1) continue;
            let dx = se.x - so.x, dy = se.y - so.y;
            const len = Math.hypot(dx, dy);
            if (len < 70) continue;
            dx /= len; dy /= len;
            const cls = "tx-fac-label tx-fac-label--end";
            const { w, h } = this.textBox(e.ident, cls);
            for (const extra of [0, 22]) {
              const rr = 5 + extra + Math.abs(dx) * w / 2 + Math.abs(dy) * h / 2;
              const r: Rect = { x: Math.round(se.x + dx * rr - w / 2), y: Math.round(se.y + dy * rr - h / 2), w, h };
              if (!this.slotClear(r)) continue;
              this.labelAt(e.ident, cls, r, true);
              this.gLab.add(r);
              used++;
              break;
            }
          }
        }
      }
      // Close-zoom runway grids can blanket every ordinary slot. Keep at least the centred field's name so the
      // view stays readable (and occupancy proofs see a label) even when every neighbour plate was rejected.
      if (close && layer && used === 0) {
        let nearest: (typeof layer.items)[number] | null = null;
        let best = Infinity;
        for (const it of layer.items) {
          if (it.decl) continue;
          const d = Math.hypot(it.x - this.target.x, it.y - this.target.y);
          if (d < best) { best = d; nearest = it; }
        }
        if (nearest) {
          const s = this.toScreen(nearest.x, nearest.y, 0);
          if (s.z < 1) {
            const text = facilityLabelText(nearest.facility);
            const cls = "tx-fac-label tx-fac-label--sel";
            const { w, h } = this.textBox(text, cls);
            for (const [ox, oy] of labelSlots(FACILITY_SYMBOL_PX / 2, w, h)) {
              const r: Rect = { x: Math.round(s.x + ox), y: Math.round(s.y + oy), w, h };
              if (this.underChrome(r)) continue;
              const idx = this.labelAt(text, cls, r, true);
              this.gLab.add(r);
              this.labelMeta[idx] = { text, owner: `facility-icon:${nearest.facility.id}`, nearest: `facility-icon:${nearest.facility.id}`, leader: true };
              const ex = Math.max(r.x, Math.min(s.x, r.x + r.w)), ey = Math.max(r.y, Math.min(s.y, r.y + r.h));
              this.siteLeaders.push({ ev: idx, d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}` });
              used++;
              break;
            }
          }
        }
      }
    }
    this.siteLabels = false;
    this.facilityLabelCount = used;
    this.osintLabelCount = osintUsed;
  }

  /** Hide facility symbols that would sit on another symbol, an OSINT icon, or a unit glyph; the better claim stays. */
  private declutterFacilities() {
    const layer = this.facilityLayer;
    if (!layer || !layer.root.visible) return;
    const osint: { cx: number; cy: number }[] = [];
    if (this.osintLayer && this.osintLayer.root.visible) {
      for (const it of this.osintLayer.items) {
        const s = this.toScreen(it.x + it.ox * this.kPx, it.y - it.oy * this.kPx, 0);
        if (s.z < 1) osint.push({ cx: s.x, cy: s.y });
      }
    }
    const units: { cx: number; cy: number; gap: number }[] = [];
    for (const t of this.tracks.values()) {
      if (t.kind === "weapon" || !t.sprite || !t.sprite.visible || t.alpha < 0.05 || !t.spriteW) continue;
      const s = this.toScreen(t.pos.x + t.disp.x, t.pos.y + t.disp.y, t.z);
      if (s.z >= 1) continue;
      units.push({ cx: s.x, cy: s.y, gap: FACILITY_SYMBOL_PX / 2 + Math.max(t.spriteAx, t.spriteAy, t.spriteW / 2) + 1 });
    }
    layer.declutter(this.kPx, this.input?.selectedFacilityId ?? null, (x, y) => this.toScreen(x, y, 0), osint, { w: this.W, h: this.H }, FACILITY_SYMBOL_PX + 1, FACILITY_SYMBOL_PX / 2 + 11 + 1, units);
  }

  /** Every drawn facility symbol, OSINT symbol and OSINT true-position dot, as screen-space centres with a half size. */
  private staticIcons(x0 = -1e12, x1 = 1e12, y0 = -1e12, y1 = 1e12): StaticIcon[] {
    const out: StaticIcon[] = [];
    const layer = this.facilityLayer;
    if (layer && layer.root.visible) {
      const symTier = layer.maxTier(this.kPx);
      for (const it of layer.items) {
        if (it.tier > symTier || it.hidden) continue;
        if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
        const s = this.toScreen(it.x, it.y, 0);
        if (s.z < 1) out.push({ kind: "facility-icon", id: it.facility.id, cx: s.x, cy: s.y, half: FACILITY_SYMBOL_PX / 2 });
      }
    }
    const osint = this.osintLayer && this.osintLayer.root.visible ? this.osintLayer : null;
    if (osint) {
      for (const it of osint.items) {
        const s = this.toScreen(it.x + it.ox * this.kPx, it.y - it.oy * this.kPx, 0);
        if (s.z < 1) out.push({ kind: "osint-icon", id: it.site.id, cx: s.x, cy: s.y, half: OSINT_SYMBOL_PX / 2 });
        const d = this.toScreen(it.x, it.y, 0);
        if (d.z < 1 && (it.ox || it.oy)) out.push({ kind: "osint-dot", id: it.site.id, cx: d.x, cy: d.y, half: 3 });
      }
    }
    return out;
  }

  /** Screen rects of the static icons, grown by `pad` px on every side. */
  private staticSymbolRects(x0 = -1e12, x1 = 1e12, y0 = -1e12, y1 = 1e12, pad = 1): Rect[] {
    return this.staticIcons(x0, x1, y0, y1).map((i) => ({ x: i.cx - i.half - pad, y: i.cy - i.half - pad, w: (i.half + pad) * 2, h: (i.half + pad) * 2 }));
  }

  /** The visible part of a screen rect: clipped to the canvas, minus any chrome band that cuts a whole side off it. Null when nothing shows. */
  private visiblePart(r: Rect): Rect | null {
    let x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(this.W, r.x + r.w), y1 = Math.min(this.H, r.y + r.h);
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.occluders) {
        const ox0 = o.x, ox1 = o.x + o.w, oy0 = o.y, oy1 = o.y + o.h;
        if (ox1 <= x0 || ox0 >= x1 || oy1 <= y0 || oy0 >= y1) continue;
        const fullY = oy0 <= y0 && oy1 >= y1, fullX = ox0 <= x0 && ox1 >= x1;
        if (fullX && fullY) return null;
        if (fullY) { if (ox0 <= x0) x0 = ox1; else if (ox1 >= x1) x1 = ox0; }
        else if (fullX) { if (oy0 <= y0) y0 = oy1; else if (oy1 >= y1) y1 = oy0; }
      }
    }
    return x1 - x0 > 0.5 && y1 - y0 > 0.5 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  /**
   * Everything the player can see, as measured boxes in host-relative CSS px: real DOM rects for labels, data
   * blocks and the scale bar, the glyph / symbol size for symbols. Anything under opaque chrome is left out.
   */
  private occupancy(): OccBox[] {
    this.occluderAt = -Infinity;
    this.refreshOccluders(performance.now());
    const host = this.host.getBoundingClientRect();
    const out: OccBox[] = [];
    const push = (kind: OccBox["kind"], id: string, r: Rect, group?: string) => {
      const v = this.visiblePart(r);
      if (v) out.push({ kind, id, x: v.x, y: v.y, w: v.w, h: v.h, ...(group ? { group } : {}) });
    };
    const dom = (el: HTMLElement): Rect | null => {
      if (el.style.display === "none") return null;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 ? { x: b.left - host.left, y: b.top - host.top, w: b.width, h: b.height } : null;
    };
    this.overlay.querySelectorAll<HTMLElement>(".tx-grid-label, .tx-ring-label, .tx-fac-label, .tx-wp-label, .tx-measure-label, .tx-obj-label").forEach((el) => {
      const r = dom(el);
      if (r) push("label", el.textContent ?? "", r);
    });
    this.overlay.querySelectorAll<HTMLElement>(".tx-block").forEach((el) => {
      const r = dom(el);
      if (r) push("block", el.dataset.unitId ?? el.dataset.contactId ?? "", r);
    });
    for (const t of this.tracks.values()) {
      if (t.kind === "weapon" || !t.sprite || !t.sprite.visible || t.alpha < 0.05) continue;
      const s = this.toScreen(t.pos.x + t.disp.x, t.pos.y + t.disp.y, t.z);
      if (s.z >= 1) continue;
      push("unit", t.id, { x: s.x - t.spriteAx, y: s.y - t.spriteAy, w: t.spriteW, h: t.spriteH });
    }
    for (const i of this.staticIcons()) {
      if (i.kind === "osint-dot") continue;
      push(i.kind, i.id, { x: i.cx - i.half, y: i.cy - i.half, w: i.half * 2, h: i.half * 2 });
    }
    const scale = this.readouts.scaleBar?.parentElement;
    if (scale) {
      const b = scale.getBoundingClientRect();
      if (b.width > 0) out.push({ kind: "scale", id: this.readouts.scaleLabel?.textContent ?? "scale", x: b.left - host.left, y: b.top - host.top, w: b.width, h: b.height });
    }
    return out;
  }

  /** True when the scale bar sits wholly inside one piece of opaque chrome, so no map content can be under it. */
  private scaleInChrome(): boolean {
    const scale = this.readouts.scaleBar?.parentElement;
    if (!scale) return false;
    this.occluderAt = -Infinity;
    this.refreshOccluders(performance.now());
    const host = this.host.getBoundingClientRect();
    const b = scale.getBoundingClientRect();
    const r = { x: b.left - host.left, y: b.top - host.top, w: b.width, h: b.height };
    return b.width > 0 && this.occluders.some((o) => r.x >= o.x && r.y >= o.y && r.x + r.w <= o.x + o.w && r.y + r.h <= o.y + o.h);
  }

  /** Thin square samples along every drawn runway so labels can be kept off the strip. */
  private runwayRects(out: Rect[], x0: number, x1: number, y0: number, y1: number) {
    const layer = this.facilityLayer;
    if (!layer || !layer.root.visible || this.kPx >= 1.4) return;
    for (const it of layer.items) {
      if (!it.facility.runways?.length) continue;
      if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
      for (const sg of layer.runwaySegments(it.facility)) {
        const a = this.toScreen(sg.ax, sg.ay, 0).clone(), b = this.toScreen(sg.bx, sg.by, 0);
        if (a.z >= 1 || b.z >= 1) continue;
        const hw = Math.max(1.1, sg.halfKm / this.kPx);
        const size = Math.min(44, Math.max(26, 2 * (hw + 12)));
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const inset = size / 2;
        const n = Math.max(1, Math.ceil((len - 2 * inset) / (size * 0.5)));
        for (let k = 0; k <= n; k++) {
          const t = len <= 2 * inset ? 0.5 : (inset + ((len - 2 * inset) * k) / n) / len;
          const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
          if (cx < -40 || cx > this.W + 40 || cy < -40 || cy > this.H + 40) continue;
          out.push({ x: cx - size / 2, y: cy - size / 2, w: size, h: size });
        }
      }
    }
  }

  /** Re-read the chrome rects a few times a second (panels open and close). */
  private refreshOccluders(now: number) {
    if (now - this.occluderAt < 200) return;
    this.occluderAt = now;
    const host = this.host.getBoundingClientRect();
    const rects: Rect[] = [];
    document.querySelectorAll<HTMLElement>("[data-plot-occluder]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push({ x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height });
    });
    this.occluders = rects;
    const hash = rects.map((r) => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(";");
    if (hash !== this.occluderHash) {
      this.occluderHash = hash;
      this.updateGridLabels();
    }
  }

  /** True when a screen rect touches any chrome band or leaves the canvas. */
  private underChrome(r: Rect): boolean {
    if (r.x < 0 || r.y < 0 || r.x + r.w > this.W || r.y + r.h > this.H) return true;
    for (const o of this.occluders) if (intersects(r, o)) return true;
    return false;
  }

  // ---------------------------------------------------------- data blocks

  /**
   * Where a data block sits relative to its glyph centre, for the block size currently set on the track. Slots 0-15
   * are the four quadrants at four distances; 16-23 sit straight above, below, left and right at two distances. The
   * block always clears the glyph's real rect.
   */
  private slotOffset(t: Track, slot: number): { x: number; y: number } {
    const gl = t.spriteAx || 11, gr = (t.spriteW || 22) - (t.spriteAx || 11), gu = t.spriteAy || 11, gd = (t.spriteH || 22) - (t.spriteAy || 11);
    const W = t.blockW, H = t.blockH, g = 3;
    if (slot < 16) {
      const ring = slot >> 2;
      const dy = ring * (H + 4), dx = ring * 8;
      switch (slot & 3) {
        case 0: return { x: gr + g + dx, y: -H + 2 - dy };
        case 1: return { x: gr + g + dx, y: -2 + dy };
        case 2: return { x: -gl - g - W - dx, y: -H + 2 - dy };
        default: return { x: -gl - g - W - dx, y: -2 + dy };
      }
    }
    const e = ((slot - 16) >> 2) * 18;
    switch (slot & 3) {
      case 0: return { x: -W / 2, y: -gu - g - H - e };
      case 1: return { x: -W / 2, y: gd + g + e };
      case 2: return { x: -gl - g - W - e, y: -H / 2 };
      default: return { x: gr + g + e, y: -H / 2 };
    }
  }

  /** Slots beyond the first ring of adjacent ones hang off a leader line. */
  private slotFar(slot: number): boolean {
    return slot >= 20 || (slot >= 4 && slot < 16);
  }

  private placeBlocks(input: PlotInput) {
    const tilted = this.tiltAmt > 0.05;
    const now = performance.now();
    const list: Track[] = [];
    const sym = this.gSym, labs = this.gLab, blk = this.gBlk;
    blk.clear();

    for (const t of this.tracks.values()) {
      const s = this.toScreen(t.pos.x + t.disp.x, t.pos.y + t.disp.y, t.z);
      t.screen.set(s.x, s.y);
      t.onScreen = s.z < 1 && s.x > -40 && s.x < this.W + 40 && s.y > -40 && s.y < this.H + 40;
      if (!t.onScreen) {
        if (t.block && t.block.style.display !== "none") t.block.style.display = "none";
        continue;
      }
      if (t.kind === "weapon") {
        // live missile heads with their glow
        sym.add({ x: s.x - 18, y: s.y - 18, w: 36, h: 36 });
        continue;
      }
      if (t.block) list.push(t);
    }
    // fresh hit and intercept bursts
    for (const e of this.effects) {
      if (now - e.t0 > 700) continue;
      const sc = this.toScreen(e.x, e.y, 0);
      sym.add({ x: sc.x - 30, y: sc.y - 30, w: 60, h: 60 });
    }

    // selected first, then friendlies, then the rest; stable within a group
    const rank = (t: Track) => (t.id === input.selectedUnitId ? 0 : t.unit?.side === input.playerSide ? 1 : 2);
    list.sort((a, b) => rank(a) - rank(b));

    const leaders = { friendly: [] as string[], hostile: [] as string[], unknown: [] as string[] };
    const dropped = new Set<number>();
    const TIER_A = [0, 1, 2, 3, 16, 17, 18, 19], TIER_B = [4, 5, 6, 7, 20, 21, 22, 23], TIER_C = [8, 9, 10, 11, 12, 13, 14, 15];
    const ALL = [...TIER_A, ...TIER_B, ...TIER_C];
    type Pass = { compact: boolean; slots: number[]; ign: boolean };
    const normal: Pass[] = [
      { compact: false, slots: TIER_A, ign: false }, { compact: true, slots: TIER_A, ign: false },
      { compact: false, slots: TIER_B, ign: false }, { compact: true, slots: TIER_B, ign: false },
      { compact: false, slots: TIER_C, ign: false }, { compact: true, slots: TIER_C, ign: false },
      // last resort before hiding the block: let a facility or OSINT label give way (its icon stays)
      { compact: false, slots: TIER_A, ign: true }, { compact: true, slots: TIER_A, ign: true },
      { compact: false, slots: TIER_B, ign: true }, { compact: true, slots: TIER_B, ign: true },
      { compact: true, slots: TIER_C, ign: true },
    ];
    // the selected unit tries hardest: full block everywhere, then displacing site labels, then one line
    const hardest: Pass[] = [
      { compact: false, slots: TIER_A, ign: false }, { compact: false, slots: TIER_B, ign: false }, { compact: false, slots: TIER_C, ign: false },
      { compact: false, slots: TIER_A, ign: true }, { compact: false, slots: TIER_B, ign: true }, { compact: false, slots: TIER_C, ign: true },
      { compact: true, slots: TIER_A, ign: false }, { compact: true, slots: TIER_B, ign: false }, { compact: true, slots: TIER_C, ign: false },
      { compact: true, slots: TIER_A, ign: true }, { compact: true, slots: TIER_B, ign: true }, { compact: true, slots: TIER_C, ign: true },
    ];

    for (const t of list) {
      const el = t.block!;
      // a glyph under the chrome takes its label with it
      if (this.underChrome({ x: t.screen.x - 2, y: t.screen.y - 2, w: 4, h: 4 })) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      const { lines, cls } = this.blockLines(t, input);
      const text = lines.join("\n");
      const keep = t.id === input.selectedUnitId && t.kind === "unit";
      const wantCls = `tx-block tx-block--${t.kind} tx-block--${cls}${keep ? " is-selected" : ""}`;
      if (el.className !== wantCls) el.className = wantCls;
      if (el.style.display === "none") el.style.display = "";
      if (text !== t.blockText) {
        // measure both forms once per text change, not per frame
        t.blockText = text;
        t.compactText = lines[0] ?? "";
        el.textContent = t.compactText;
        t.compactW = el.offsetWidth;
        t.compactH = el.offsetHeight;
        el.textContent = text;
        t.fullW = el.offsetWidth;
        t.fullH = el.offsetHeight;
        t.shownText = text;
      }

      const rectFor = (compact: boolean, slot: number): Rect => {
        t.blockW = compact ? t.compactW : t.fullW;
        t.blockH = compact ? t.compactH : t.fullH;
        const o = this.slotOffset(t, slot);
        return { x: Math.round(t.screen.x + o.x), y: Math.round(t.screen.y + o.y), w: t.blockW, h: t.blockH };
      };
      // clear of every glyph and icon, other blocks, labels and chrome; `ign` lets site labels give way
      const clear = (r: Rect, ign: boolean) => {
        if (sym.hits(r) || blk.hits(r) || this.underChrome(r)) return false;
        return ign ? labs.collect(r).every((o) => o.ev !== undefined) : !labs.hits(r);
      };

      let pick: { compact: boolean; slot: number; ign: boolean } | null = null;
      // stay where it is while that spot stays clear: no hopping between slots
      if (t.shown && clear(rectFor(t.compactOn, t.slot), false)) pick = { compact: t.compactOn, slot: t.slot, ign: false };
      for (const pass of pick ? [] : keep ? hardest : normal) {
        for (const slot of pass.slots) {
          if (clear(rectFor(pass.compact, slot), pass.ign)) { pick = { compact: pass.compact, slot, ign: pass.ign }; break; }
        }
        if (pick) break;
      }
      if (!pick && keep) {
        // nowhere is clear: the selection still shows, at its least-covered slot
        let best = Infinity;
        for (const slot of ALL) {
          const r = rectFor(false, slot);
          if (this.underChrome(r)) continue;
          let c = 0;
          for (const o of [...sym.collect(r), ...blk.collect(r), ...labs.collect(r)]) c += overlapArea(r, o);
          if (c < best) { best = c; pick = { compact: false, slot, ign: false }; }
        }
      }
      if (!pick) {
        // no clear place: hide rather than show a sliced or stacked label
        if (el.style.display !== "none") el.style.display = "none";
        t.shown = false;
        continue;
      }

      const blockRect = rectFor(pick.compact, pick.slot);
      const want = pick.compact ? t.compactText : t.blockText;
      if (t.shownText !== want) {
        el.textContent = want;
        t.shownText = want;
      }
      t.slot = pick.slot;
      t.compactOn = pick.compact;
      t.shown = true;
      if (pick.ign) {
        for (const p of labs.collect(blockRect)) {
          if (p.ev === undefined) continue;
          this.labelEls[p.ev].style.display = "none";
          dropped.add(p.ev);
          p.dead = true;
        }
      }
      blk.add({ x: blockRect.x - 1.5, y: blockRect.y - 1.5, w: blockRect.w + 3, h: blockRect.h + 3 });

      if (tilted || this.slotFar(pick.slot)) {
        // leader from the glyph edge to the block's nearest point
        const gx = t.screen.x, gy = t.screen.y;
        const cx = Math.max(blockRect.x, Math.min(gx, blockRect.x + blockRect.w)), cy = Math.max(blockRect.y, Math.min(gy, blockRect.y + blockRect.h));
        const dx = cx - gx, dy = cy - gy;
        const len = Math.hypot(dx, dy) || 1;
        const sx = gx + (dx / len) * 10, sy = gy + (dy / len) * 10;
        if (len > 12) {
          const kind = t.contact
            ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? "hostile" : "unknown")
            : t.unit && t.unit.side !== input.playerSide ? "hostile" : "friendly";
          leaders[kind].push(`M${sx.toFixed(1)} ${sy.toFixed(1)}L${cx} ${cy}`);
        }
      }
      el.style.transform = `translate3d(${blockRect.x}px, ${blockRect.y}px, 0)`;
      const op = t.alpha.toFixed(2);
      if (el.style.opacity !== op) el.style.opacity = op;
    }

    if (dropped.size) {
      this.labelRects = this.labelRects.filter((_, i) => !dropped.has(i));
      this.labelTexts = this.labelTexts.filter((_, i) => !dropped.has(i));
    }

    // leaders from site labels to their own icons, minus any label a selected block displaced
    const site = this.siteLeaders.filter((l) => !dropped.has(l.ev)).map((l) => l.d).join("");
    const all = { ...leaders, site: [site] };
    for (const k of ["friendly", "hostile", "unknown", "site"] as const) {
      const d = all[k].join("");
      if (d !== this.leaderD[k]) {
        this.leaderD[k] = d;
        this.leaderPaths[k].setAttribute("d", d);
      }
    }
  }

  // ----------------------------------------------------- grid labels, scale

  private updateGridLabels() {
    const b = geo.bbox as number[];
    const used: { el: HTMLDivElement; text: string; x: number; y: number }[] = [];
    const top = this.insets.top + 8, left = this.insets.left + 8;
    const xMin = this.insets.left + 40, xMax = this.W - this.insets.right - 40;
    const yMin = this.insets.top + 30, yMax = this.H - this.insets.bottom - 30;

    const step = this.dist < 260 ? 0.25 : 0.5;
    for (let lng = Math.ceil(b[0] / step) * step; lng <= b[2]; lng += step) {
      let best: THREE.Vector3 | null = null;
      for (let lat = b[1]; lat <= b[3]; lat += 0.02) {
        const s = this.toScreen(this.proj.x(lng), this.proj.y(lat), 0);
        if (s.z >= 1 || s.x < xMin || s.x > xMax) continue;
        if (!best || Math.abs(s.y - top) < Math.abs(best.y - top)) best = s.clone();
      }
      if (best && Math.abs(best.y - top) < 24) used.push({ el: null!, text: formatDeg(lng, "E", "W", 3), x: best.x - 26, y: top });
    }
    for (let lat = Math.ceil(b[1] / step) * step; lat <= b[3]; lat += step) {
      let best: THREE.Vector3 | null = null;
      for (let lng = b[0]; lng <= b[2]; lng += 0.02) {
        const s = this.toScreen(this.proj.x(lng), this.proj.y(lat), 0);
        if (s.z >= 1 || s.y < yMin || s.y > yMax) continue;
        if (!best || Math.abs(s.x - left) < Math.abs(best.x - left)) best = s.clone();
      }
      if (best && Math.abs(best.x - left) < 24) used.push({ el: null!, text: formatDeg(lat, "N", "S", 2), x: left, y: best.y - 16 });
    }

    // drop labels that would crowd the previous one (meridians converge when tilted)
    const spaced: typeof used = [];
    for (const u of used) {
      const prev = spaced[spaced.length - 1];
      const horizontal = u.y === top;
      if (prev && (prev.y === top) === horizontal && (horizontal ? Math.abs(u.x - prev.x) < 86 : Math.abs(u.y - prev.y) < 26)) continue;
      spaced.push(u);
    }
    used.length = 0;
    used.push(...spaced);

    this.gridRects = [];
    const symbols = this.staticSymbolRects();
    for (let i = 0; i < Math.max(used.length, this.gridLabels.length); i++) {
      let el = this.gridLabels[i];
      if (i >= used.length) {
        if (el && el.style.display !== "none") el.style.display = "none";
        continue;
      }
      if (!el) {
        el = document.createElement("div");
        el.className = "tx-grid-label";
        this.overlay.appendChild(el);
        this.gridLabels.push(el);
      }
      const u = used[i];
      const tb = this.textBox(u.text, "tx-grid-label");
      const box = { x: Math.round(u.x), y: Math.round(u.y), w: tb.w, h: tb.h };
      if (this.underChrome(box) || symbols.some((q) => intersects(q, box))) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      if (el.textContent !== u.text) el.textContent = u.text;
      el.style.display = "";
      this.gridRects.push(box);
      el.style.transform = `translate3d(${Math.round(u.x)}px, ${Math.round(u.y)}px, 0)`;
    }
  }

  private updateScaleBar() {
    const { scaleBar, scaleLabel } = this.readouts;
    if (!scaleBar || !scaleLabel) return;
    const nmPerPx = this.kPx / KM_PER_NM;
    const options = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
    let nm = options[0];
    for (const o of options) if (o / nmPerPx <= 150) nm = o;
    const px = Math.round(nm / nmPerPx);
    scaleBar.style.width = `${px}px`;
    const text = `${nm} NM`;
    if (scaleLabel.textContent !== text) scaleLabel.textContent = text;
  }

  // ----------------------------------------------- shared with debug handle

  private weaponLines(input: PlotInput) {
    const out: { weapon: WeaponInFlight; friendly: boolean; target: THREE.Vector2 | null }[] = [];
    for (const w of this.visibleWeapons(input)) {
      const friendly = w.launchedBySide === input.playerSide;
      const tu = this.tracks.get(`unit:${w.targetId}`);
      let target: THREE.Vector2 | null = tu ? tu.pos : null;
      if (!target) {
        for (const t of this.tracks.values()) {
          if (t.contact && t.contact.actualUnitId === w.targetId) { target = t.pos; break; }
        }
      }
      out.push({ weapon: w, friendly, target });
    }
    return out;
  }

  private waypointPaths(input: PlotInput) {
    const out: { unitId: string; points: GeoPoint[] }[] = [];
    const ids = input.selectedUnitId
      ? [input.selectedUnitId]
      : input.units.filter((u) => u.side === input.playerSide).map((u) => u.id);
    for (const id of ids) {
      const o = input.orders.get(id);
      if (!o || o.waypoints.length === 0 || !this.tracks.has(`unit:${id}`)) continue;
      out.push({ unitId: id, points: o.waypoints.map((w) => w.position) });
    }
    return out;
  }

  // The test handle reports what the last frame drew, so a test fails when
  // the drawing breaks, not only when the input does.
  private debugSource(name: string): { features: DebugFeature[] } | undefined {
    if (!this.input) return undefined;
    const d = this.drawn;
    const f = (type: DebugFeature["geometry"]["type"], properties: Record<string, unknown> = {}): DebugFeature => ({ geometry: { type }, properties });
    const many = (n: number, type: DebugFeature["geometry"]["type"]) => Array.from({ length: n }, () => f(type));
    switch (name) {
      case "weapon-tracks": {
        const features = [...many(d.weaponLines, "LineString"), ...many(d.weaponHeads, "Point")];
        return features.length ? { features } : undefined;
      }
      case "waypoint-lines": {
        const features: DebugFeature[] = [];
        for (const p of d.waypointPaths) {
          features.push(f("LineString", { unitId: p.unitId }));
          for (let i = 0; i < p.points; i++) features.push(f("Point", { unitId: p.unitId, index: i }));
        }
        return { features };
      }
      case "contact-uncertainty":
        return d.uncertaintyDiscs + d.uncertaintyEdges > 0 ? { features: many(d.uncertaintyDiscs, "Polygon") } : undefined;
      case "sensor-coverage":
        return d.coverageDiscs + d.coverageEdges > 0 ? { features: many(d.coverageDiscs, "Polygon") } : undefined;
      default:
        return undefined;
    }
  }

  private debugLayer(name: string): boolean {
    const d = this.drawn;
    if (name === "contact-uncertainty-line") return d.uncertaintyEdges > 0;
    if (name === "contact-uncertainty-fill") return d.uncertaintyDiscs > 0;
    if (name === "sensor-coverage-line") return d.coverageEdges > 0;
    if (name === "sensor-coverage-fill") return d.coverageDiscs > 0;
    if (name === "relief") return !!this.relief?.visible;
    return false;
  }
}

function formatDeg(v: number, pos: string, neg: string, width: number): string {
  const a = Math.abs(v);
  const d = Math.floor(a + 1e-9);
  const m = Math.round((a - d) * 60);
  return `${String(d).padStart(width, "0")}°${String(m).padStart(2, "0")}'${v >= 0 ? pos : neg}`;
}

export type PlotHandle = ReturnType<TacticalPlot["getHandle"]>;

function facilityLabelText(f: Facility): string {
  return shortFacilityName(f.name).toUpperCase();
}
