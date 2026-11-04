// The Three.js tactical plot: a naval combat-information display drawn from
// the live simulation. React feeds it state through update(); everything that
// moves between those updates (camera, sweeps, interpolation, effects, data
// block positions) runs in the plot's own animation loop.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Unit } from "@/types/game";
import { getAffiliation } from "@/types/game";
import type { Contact, UnitOrders } from "@/lib/simulation/gameState";
import type { WeaponInFlight, CombatEvent } from "@/lib/simulation/combat";
import { getPlatform } from "@/lib/platforms/lookup";
import { formatMeasurement } from "@/lib/map/measure";
import { PlotProjection, type GeoPoint, FT_TO_KM, KM_PER_NM } from "./projection";
import { LineBatch } from "./lineBatch";
import { PALETTE } from "./palette";
import { sidcFor, symbolTexture } from "./symbolTextures";
import { LabelPlacer, auditLabels, segHitsRect, type LabelItem, type Seg } from "./labelPlacer";
import geo from "./data/hormuz-geo.json";
import { THEMES, type DisplayMode, type PlotTheme } from "./themes";
import { contactName, isClassified, trackNumber } from "./contactName";

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
}

export interface PlotCallbacks {
  onUnitSelect: (unitId: string | null, shiftKey: boolean) => void;
  onMapClick: (p: GeoPoint) => boolean | void;
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
  z: number;
  t0: number;
  history: number[]; // x,y pairs, oldest first
  lastHistSim: number;
  sprite?: THREE.Sprite;
  spriteKey?: string;
  spriteSidc: string;
  spriteRole?: "friendly" | "hostile" | "unknown";
  spriteW: number;
  spriteH: number;
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
  blockX: number;
  blockY: number;
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

interface Rect {
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
  kind: "hit" | "intercept" | "kill";
}

const FOV = 30;
const TILT_PITCH = 0.94; // radians at full tilt, about 54 degrees
const RELIEF_EXAG = 7; // vertical exaggeration for relief and altitude
const LERP_MS = 260;
const HIST_UNIT_MS = 45_000;
const HIST_WEAPON_MS = 2_500;
const HIST_MAX = 12;
const SWEEP_PERIOD_S = 4;

// Colour slots the plot draws with. setMode() rewrites them from the theme.
const C = {
  phosphor: new THREE.Color(PALETTE.phosphor), // friendly tracks and own orders
  hi: new THREE.Color(PALETTE.phosphorHi), // selection, missile heads, measurement
  dim: new THREE.Color(PALETTE.phosphorDim), // coverage edges, unknown tracks
  hostile: new THREE.Color(PALETTE.alarm), // classified hostile tracks
  unknown: new THREE.Color(PALETTE.phosphorDim),
  alarm: new THREE.Color(PALETTE.alarm), // hits and incoming fire only
  weaponF: new THREE.Color(PALETTE.phosphor),
  weaponH: new THREE.Color(PALETTE.alarm),
  ringF: new THREE.Color(PALETTE.phosphor),
  ringH: new THREE.Color(PALETTE.alarm),
  coast: new THREE.Color(PALETTE.phosphor),
  contour: new THREE.Color(PALETTE.phosphorDim),
  border: new THREE.Color(PALETTE.phosphorDim),
  grid: new THREE.Color(PALETTE.phosphorFaint),
  relief: new THREE.Color(PALETTE.phosphorFaint),
  land: new THREE.Color(PALETTE.land),
  field: new THREE.Color(PALETTE.field),
};

function applyThemeColours(t: PlotTheme) {
  C.phosphor.set(t.friendly);
  C.hi.set(t.hi);
  C.dim.set(t.matte ? t.ringFriendly : t.unknown);
  C.hostile.set(t.hostile);
  C.unknown.set(t.unknown);
  C.alarm.set(t.alarm);
  C.weaponF.set(t.weaponFriendly);
  C.weaponH.set(t.weaponHostile);
  C.ringF.set(t.ringFriendly);
  C.ringH.set(t.ringHostile);
  C.coast.set(t.coast);
  C.contour.set(t.contour);
  C.border.set(t.border);
  C.grid.set(t.grid);
  C.relief.set(t.relief);
  C.land.set(t.land);
  C.field.set(t.field);
}

const DPR_CAP = 2;
const SCALE_MIN = 0.5;

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
    }`,
};

// CRT: phosphor glow from 12 taps, vignette and a dark rounded bezel falloff,
// all in one pass. Scanlines are CSS over the whole screen (text included).
const CRT_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uTexel: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    varying vec2 vUv;
    vec3 tap(vec2 o) { return texture2D(tDiffuse, vUv + o * uTexel).rgb; }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 g = tap(vec2(2.0, 0.0)) + tap(vec2(-2.0, 0.0)) + tap(vec2(0.0, 2.0)) + tap(vec2(0.0, -2.0))
             + tap(vec2(1.5, 1.5)) + tap(vec2(-1.5, 1.5)) + tap(vec2(1.5, -1.5)) + tap(vec2(-1.5, -1.5));
      vec3 w = tap(vec2(5.0, 0.0)) + tap(vec2(-5.0, 0.0)) + tap(vec2(0.0, 5.0)) + tap(vec2(0.0, -5.0));
      vec3 glow = max(g / 8.0 - 0.03, 0.0) * 0.75 + max(w / 4.0 - 0.05, 0.0) * 0.35;
      vec3 col = c + glow;
      vec2 q = vUv - 0.5;
      float vig = 1.0 - dot(q, q) * 0.85;
      // corners fall off like a curved tube behind a bezel
      vec2 e = smoothstep(vec2(0.0), vec2(0.035, 0.05), vUv) * smoothstep(vec2(0.0), vec2(0.035, 0.05), 1.0 - vUv);
      col *= vig * mix(0.55, 1.0, e.x * e.y);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class TacticalPlot {
  readonly proj: PlotProjection;
  private host: HTMLElement;
  private overlay: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private finishPass: ShaderPass;
  private crtPass: ShaderPass;
  private mode: DisplayMode = "current";
  private theme: PlotTheme = THEMES.current;
  private gridOn = true;
  private staticObjects: THREE.Object3D[] = [];
  // adaptive render scale: drop resolution when frames run long, recover when calm
  private renderScale = 1;
  private forcedScale: number | null = null;
  private frameMs = 16.7;
  private scaleCheckAt = 0;
  private calmChecks = 0;
  private occluderTimer: ReturnType<typeof setTimeout> | null = null;
  private occluderInterval: ReturnType<typeof setInterval> | null = null;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  private callbacks: PlotCallbacks;
  private readouts: PlotReadouts = {};
  private insets: PlotInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  // principal-point shift, eased so a panel opening slides the plot over
  private shift = new THREE.Vector2(NaN, NaN);
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
  private leaderPaths: Record<"friendly" | "hostile" | "unknown", SVGPathElement>;
  private leaderD = { friendly: "", hostile: "", unknown: "" };
  private leaderHalo!: SVGPathElement;
  private leaderHaloD = "";

  // DOM labels outside the tracks
  private labelPool: HTMLDivElement[] = [];
  private labelsUsed = 0;
  private labelRects: Rect[] = [];
  private gridLabels: HTMLDivElement[] = [];
  private gridCands: { el: HTMLDivElement; rect: Rect }[] = [];
  private gridShown: Rect[] = [];
  private placer = new LabelPlacer();
  private items: LabelItem[] = [];
  private itemTracks: { t: Track; cls: string }[] = [];
  private glyphs: { key: string; rect: Rect; core: Rect; x: number; y: number }[] = [];
  private pointRects: Rect[] = [];
  private rectPool: Rect[] = [];
  private weaponSegs: Seg[] = [];
  private segPool: Seg[] = [];
  private lastLeaders: { key: string; seg: Seg }[] = [];
  private lastBlocks: Rect[] = [];
  private keptHidden = 0;
  private keptHiddenKeys: string[] = [];
  private leaderParts = { friendly: [] as string[], hostile: [] as string[], unknown: [] as string[] };
  private metrics = { charW: 7.9, padW: 6, lineH: 15, padH: 2, gridCharW: 7.3, gridPadW: 0, gridH: 12 };
  private chromeObserver: MutationObserver | null = null;

  private raf = 0;
  private lastFrame = 0;
  private disposed = false;
  private frames = 0;
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
    this.renderer.setClearColor(new THREE.Color(PALETTE.field), 1);
    this.renderer.domElement.setAttribute("data-testid", "plot-canvas");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.3, 0.34);
    this.composer.addPass(this.bloom);
    this.finishPass = new ShaderPass(FINISH_SHADER);
    this.composer.addPass(this.finishPass);
    this.crtPass = new ShaderPass(CRT_SHADER);
    this.crtPass.enabled = false;
    this.composer.addPass(this.crtPass);
    this.composer.addPass(new OutputPass());

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
    this.leaderHalo = mk("tx-leader-halo");
    this.leaderPaths = { friendly: mk("tx-leader"), hostile: mk("tx-leader tx-leader--hostile"), unknown: mk("tx-leader tx-leader--unknown") };
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

    // text metrics now and again once the vendored font is in
    this.measureText();
    document.fonts?.ready.then(() => !this.disposed && this.measureText());
    // panels opening or closing invalidate the chrome rects at once
    // (the plot's own label writes are ignored; only chrome changes count)
    const root = host.closest(".tx-root") ?? document.body;
    this.chromeObserver = new MutationObserver((records) => {
      for (const m of records) {
        const el = m.target instanceof Element ? m.target : m.target.parentElement;
        if (el && !this.overlay.contains(el)) {
          this.scheduleOccluders();
          return;
        }
      }
    });
    this.chromeObserver.observe(root, { childList: true, subtree: true });
    this.occluderInterval = setInterval(() => this.scheduleOccluders(), 1000);
    this.scheduleOccluders();

    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
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

    // land fill
    const shapes: THREE.Shape[] = [];
    for (const poly of geo.land as number[][][][]) {
      const outer = poly[0].map((p) => new THREE.Vector2(P.x(p[0]), P.y(p[1])));
      const shape = new THREE.Shape(outer);
      for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(P.x(p[0]), P.y(p[1])))));
      shapes.push(shape);
    }
    const land = new THREE.Mesh(
      new THREE.ShapeGeometry(shapes),
      new THREE.MeshBasicMaterial({ color: C.land, depthTest: false, depthWrite: false }),
    );
    land.renderOrder = 1;
    this.scene.add(land);
    this.staticObjects.push(land);
    const matte = this.theme.matte ? C.field : null;

    // depth contours (Natural Earth bathymetry polygons, outline only)
    const contour = new LineBatch({ width: 1, dashed: true, renderOrder: 3 });
    contour.setMatte(matte);
    contour.material.dashSize = 6;
    contour.material.gapSize = 5;
    const depthAlpha: Record<string, number> = { "200": 0.55, "1000": 0.4, "2000": 0.32, "3000": 0.26 };
    for (const [depth, polys] of Object.entries(geo.depth as Record<string, number[][][][]>)) {
      for (const poly of polys) {
        for (const ring of poly) {
          contour.breakRun();
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            if (onEdge(a, b)) { contour.breakRun(); continue; }
            contour.seg(P.x(a[0]), P.y(a[1]), 0, P.x(b[0]), P.y(b[1]), 0, C.contour, (depthAlpha[depth] ?? 0.3) * this.theme.contourAlpha);
          }
        }
      }
    }
    contour.flush();

    // coastline and land borders
    const coast = new LineBatch({ width: 1.4, renderOrder: 5 });
    coast.setMatte(matte);
    for (const line of geo.coast as number[][][]) {
      const pts: number[] = [];
      for (const p of line) pts.push(P.x(p[0]), P.y(p[1]));
      coast.polyline(pts, 0, C.coast, this.theme.coastAlpha);
    }
    coast.flush();
    const borders = new LineBatch({ width: 1, dashed: true, renderOrder: 4 });
    borders.setMatte(matte);
    borders.material.dashSize = 3;
    borders.material.gapSize = 4;
    for (const line of geo.borders as number[][][]) {
      const pts: number[] = [];
      for (const p of line) pts.push(P.x(p[0]), P.y(p[1]));
      borders.polyline(pts, 0, C.border, this.theme.matte ? 1 : 0.5);
    }
    borders.flush();

    // lat/long grid every 0.5 degree, whole degrees brighter
    const grid = new LineBatch({ width: 1, renderOrder: 2 });
    grid.setMatte(matte);
    const gMaj = this.theme.gridMajor, gMin = this.theme.gridMinor;
    for (let lng = Math.ceil(bbox[0] * 2) / 2; lng <= bbox[2]; lng += 0.5) {
      const major = Math.abs(lng - Math.round(lng)) < 1e-6;
      grid.seg(P.x(lng), P.y(bbox[1]), 0, P.x(lng), P.y(bbox[3]), 0, C.grid, major ? gMaj : gMin);
    }
    for (let lat = Math.ceil(bbox[1] * 2) / 2; lat <= bbox[3]; lat += 0.5) {
      const major = Math.abs(lat - Math.round(lat)) < 1e-6;
      grid.seg(P.x(bbox[0]), P.y(lat), 0, P.x(bbox[2]), P.y(lat), 0, C.grid, major ? gMaj : gMin);
    }
    grid.flush();
    grid.object.visible = this.gridOn && grid.count > 0;

    this.staticBatches = [contour, coast, borders, grid];
    for (const b of this.staticBatches) {
      this.scene.add(b.object);
      this.staticObjects.push(b.object);
    }

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
    const base = C.relief.clone();
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
        if (a.z > 0 || b.z > 0) { wire.push(a.x, a.y, a.z, b.x, b.y, b.z); wireCol.push(...C.contour.toArray(), ...C.contour.toArray()); }
        if (a.z > 0 || c.z > 0) { wire.push(a.x, a.y, a.z, c.x, c.y, c.z); wireCol.push(...C.contour.toArray(), ...C.contour.toArray()); }
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
    this.staticObjects.push(relief);

    const wg = new LineSegmentsGeometry();
    wg.setPositions(wire);
    wg.setColors(wireCol);
    const wm = new LineMaterial({
      linewidth: 1,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: this.theme.matte ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rw = new LineSegments2(wg, wm);
    rw.renderOrder = 3;
    rw.visible = false;
    this.reliefWire = rw;
    this.scene.add(rw);
    this.staticObjects.push(rw);
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

  /** Switch display mode: palette, linework, glyphs and the post chain. */
  setMode(mode: DisplayMode) {
    if (mode === this.mode && this.staticObjects.length) return;
    this.mode = mode;
    this.theme = THEMES[mode];
    applyThemeColours(this.theme);
    this.renderer.setClearColor(C.field, 1);
    // rebuild the static map in the new inks
    for (const o of this.staticObjects) {
      this.scene.remove(o);
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    }
    this.staticObjects.length = 0;
    this.staticBatches = [];
    this.buildStatic();
    const matte = this.theme.matte ? C.field : null;
    for (const b of [this.solid, this.thin, this.dashed]) b.setMatte(matte);
    for (const p of [this.dots, this.marks]) {
      (p.material as THREE.PointsMaterial).blending = matte ? THREE.NormalBlending : THREE.AdditiveBlending;
      (p.material as THREE.PointsMaterial).needsUpdate = true;
    }
    for (const d of this.discs) {
      (d.material as THREE.MeshBasicMaterial).blending = matte ? THREE.NormalBlending : THREE.AdditiveBlending;
      (d.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    // post chain: bloom (current), one CRT pass, or nothing
    this.bloom.enabled = this.theme.post === "bloom";
    this.finishPass.enabled = this.theme.post === "bloom";
    this.crtPass.enabled = this.theme.post === "crt";
    // glyphs in the new inks and sizes
    for (const t of this.tracks.values()) if (t.spriteRole) this.setSprite(t, t.spriteSidc, t.spriteRole, true);
    this.resize();
    this.measureText();
    // the mode's font may load only now: measure again once it is in
    const family = getComputedStyle(this.overlay).fontFamily;
    const again = () => !this.disposed && this.measureText();
    if (document.fonts?.load) document.fonts.load(`16px ${family}`).then(again, again);
    for (const t of this.tracks.values()) t.blockText = "";
  }

  setGrid(on: boolean) {
    this.gridOn = on;
    const g = this.staticBatches[3];
    if (g) g.object.visible = on;
    this.viewHash = "";
  }

  /** Pin the render scale (testing and measurement); null returns to adaptive. */
  setRenderScale(scale: number | null) {
    this.forcedScale = scale;
    this.resize();
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
    this.input = input;
    const P = this.proj;

    // units the player may see
    for (const u of this.visibleUnits(input)) {
      const t = this.ensureTrack("unit", u.id);
      t.unit = u;
      this.moveTrack(t, P.x(u.position.lng), P.y(u.position.lat), now, true);
      this.sampleHistory(t, input.simTime, HIST_UNIT_MS);
      const aff = getAffiliation(u, input.playerSide);
      const pl = getPlatform(u.platformId);
      this.setSprite(t, sidcFor(aff, pl?.dimension ?? "sea", pl?.functionId ?? "CL"), aff === "friendly" ? "friendly" : aff === "hostile" ? "hostile" : "unknown");
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
      this.setSprite(
        t,
        known ? sidcFor("hostile", pl?.dimension ?? "unknown", pl?.functionId ?? "") : sidcFor("unknown", "unknown", ""),
        known ? "hostile" : "unknown",
      );
    }

    // weapons in flight
    for (const w of this.visibleWeapons(input)) {
      const t = this.ensureTrack("weapon", w.id);
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

    for (const [key, t] of this.tracks) {
      if (t.seen) continue;
      if (t.kind === "weapon" && prevWeapons.has(t.id) && t.weapon) {
        this.effects.push({ x: t.pos.x, y: t.pos.y, t0: now, kind: hitTargets.has(t.weapon.targetId) ? "hit" : "intercept" });
      }
      if (t.kind === "unit" && t.unit && killed.has(t.unit.id)) {
        this.effects.push({ x: t.pos.x, y: t.pos.y, t0: now, kind: "kill" });
      }
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
      drawnTracks: () => ({ units: this.drawn.unitSprites, contacts: this.drawn.contactSprites }),
      labelAudit: () => this.audit(),
      mode: () => this.mode,
      renderScale: () => this.forcedScale ?? this.renderScale,
      setRenderScale: (v: number | null) => this.setRenderScale(v),
      trackScreens: () =>
        [...this.tracks.values()]
          .filter((t) => t.onScreen && t.kind !== "weapon")
          .map((t) => ({ key: t.key, kind: t.kind, x: t.screen.x, y: t.screen.y })),
      tilt: (on: boolean) => this.setTilt(on),
      view: () => ({ dist: this.dist, tilt: this.tiltAmt, target: { x: this.target.x, y: this.target.y } }),
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.chromeObserver?.disconnect();
    if (this.occluderTimer) clearTimeout(this.occluderTimer);
    if (this.occluderInterval) clearInterval(this.occluderInterval);
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
    this.renderer.forceContextLoss();
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
        from: new THREE.Vector2(), to: new THREE.Vector2(NaN, NaN), pos: new THREE.Vector2(),
        z: 0, t0: 0, history: [], lastHistSim: -Infinity,
        spriteW: 0, spriteH: 0, spriteSidc: "", blockText: "", blockW: 0, blockH: 0, slot: 0,
        compactText: "", compactW: 0, compactH: 0, fullW: 0, fullH: 0, shownText: "", blockX: 0, blockY: 0,
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

  private setSprite(t: Track, sidc: string, role: "friendly" | "hostile" | "unknown", force = false) {
    const th = this.theme;
    const color = role === "friendly" ? th.friendly : role === "hostile" ? th.hostile : th.unknown;
    const key = `${sidc}|${color}|${th.symbolSize}|${th.symbolStroke}|${th.symbolKnockout ?? ""}`;
    t.spriteSidc = sidc;
    t.spriteRole = role;
    if (t.spriteKey === key && !force) return;
    const tex = symbolTexture(sidc, color, Math.max(2, Math.ceil(this.dpr * 1.5)), {
      size: th.symbolSize,
      stroke: th.symbolStroke,
      knockout: th.symbolKnockout,
    });
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
    t.sprite.center.copy(tex.center);
    t.spriteW = tex.width;
    t.spriteH = tex.height;
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
      // same name as the contact list: track number until classified, then the platform
      const known = isClassified(c);
      const name = contactName(c, (id) => input.units.find((u) => u.id === id));
      const l1 = `${shortName(name)} ${CLS_LABEL[c.classification]}`;
      const l2 = known ? `TN${trackNumber(c.id)} ${c.sensorType.toUpperCase()}` : c.sensorType.toUpperCase();
      const parts: string[] = [];
      if (c.estimatedHeading !== undefined) parts.push(`C${pad3(c.estimatedHeading)}`);
      if (c.estimatedSpeed !== undefined) parts.push(`S${Math.round(c.estimatedSpeed)}`);
      if (age > 30) parts.push(`+${age}S`);
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
      const bx = t.blockX, by = t.blockY;
      if (x >= bx && x <= bx + t.blockW && y >= by && y <= by + t.blockH) return t;
    }
    return null;
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
    // device pixels capped, then scaled down when frames run long
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * (this.forcedScale ?? this.renderScale);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * this.dpr, h * this.dpr);
    const rw = w * this.dpr, rh = h * this.dpr;
    for (const b of [...this.staticBatches, this.solid, this.thin, this.dashed]) b.setResolution(rw, rh);
    if (this.reliefWire) (this.reliefWire.material as LineMaterial).resolution.set(rw, rh);
    (this.dots.material as THREE.PointsMaterial).size = 3 * this.dpr;
    (this.marks.material as THREE.PointsMaterial).size = 7 * this.dpr;
    const ls = this.theme.lineScale;
    for (const b of [this.solid, this.thin, this.dashed, ...this.staticBatches]) {
      b.material.linewidth = (b === this.solid ? 1.4 : b === this.dashed ? 1.3 : b === this.staticBatches[1] ? 1.4 : 1) * this.dpr * ls;
    }
    (this.crtPass.uniforms.uTexel.value as THREE.Vector2).set(1 / (w * this.dpr), 1 / (h * this.dpr));
    if (this.reliefWire) (this.reliefWire.material as LineMaterial).linewidth = this.dpr;
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.viewHash = "";
    this.scheduleOccluders();
  }

  private applyViewOffset() {
    // centre the theater in the free area between the chrome, without
    // resizing the canvas: shift the principal point instead
    const goalX = (this.insets.right - this.insets.left) / 2;
    const goalY = (this.insets.bottom - this.insets.top) / 2;
    if (Number.isNaN(this.shift.x)) this.shift.set(goalX, goalY);
    this.camera.setViewOffset(this.W, this.H, this.shift.x, this.shift.y, this.W, this.H);
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

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frames++;
    this.adaptScale(now, dt * 1000);

    this.stepCamera(dt);
    this.drawDynamic(now);
    this.composer.render(dt);
  };

  /** Long frames for a second drop the render scale; three calm seconds bring it back. */
  private adaptScale(now: number, ms: number) {
    this.frameMs += (Math.min(ms, 100) - this.frameMs) * 0.08;
    if (this.forcedScale !== null || now < this.scaleCheckAt) return;
    this.scaleCheckAt = now + 1000;
    if (this.frameMs > 20 && this.renderScale > SCALE_MIN) {
      this.renderScale = Math.max(SCALE_MIN, this.renderScale * 0.85);
      this.calmChecks = 0;
      this.resize();
    } else if (this.frameMs < 14 && this.renderScale < 1) {
      if (++this.calmChecks >= 3) {
        this.renderScale = Math.min(1, this.renderScale / 0.85);
        this.calmChecks = 0;
        this.resize();
      }
    } else {
      this.calmChecks = 0;
    }
  }

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

    // ease the view centre toward the free area between panels
    {
      const goalX = (this.insets.right - this.insets.left) / 2;
      const goalY = (this.insets.bottom - this.insets.top) / 2;
      if (Math.abs(this.shift.x - goalX) > 0.25 || Math.abs(this.shift.y - goalY) > 0.25) {
        const k = 1 - Math.exp(-dt * 6);
        this.shift.x += (goalX - this.shift.x) * k;
        this.shift.y += (goalY - this.shift.y) * k;
        this.camera.setViewOffset(this.W, this.H, this.shift.x, this.shift.y, this.W, this.H);
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

    const t = this.tiltAmt;
    if (this.relief && this.reliefWire) {
      const vis = t > 0.002;
      this.relief.visible = vis;
      this.reliefWire.visible = vis;
      this.relief.scale.z = Math.max(0.001, t);
      this.reliefWire.scale.z = Math.max(0.001, t);
      (this.relief.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t * 1.2) * 0.78;
      (this.reliefWire.material as LineMaterial).opacity = t * 0.28;
    }

    const hash = `${this.target.x.toFixed(2)},${this.target.y.toFixed(2)},${this.dist.toFixed(2)},${t.toFixed(3)},${this.W},${this.H}`;
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
    const F = this.theme.matte ? C.field : null;
    const ink = (arr: Float32Array, i: number, c: THREE.Color, a: number) => {
      arr[i] = F ? F.r + (c.r - F.r) * a : c.r * a;
      arr[i + 1] = F ? F.g + (c.g - F.g) * a : c.g * a;
      arr[i + 2] = F ? F.b + (c.b - F.b) * a : c.b * a;
    };
    const dot = (x: number, y: number, z: number, c: THREE.Color, a: number) => {
      if (nd >= 4096) return;
      dotsPos[nd * 3] = x; dotsPos[nd * 3 + 1] = y; dotsPos[nd * 3 + 2] = z;
      ink(dotsCol, nd * 3, c, a);
      nd++;
    };
    const mark = (x: number, y: number, z: number, c: THREE.Color, a: number) => {
      if (nm >= 1024) return;
      marksPos[nm * 3] = x; marksPos[nm * 3 + 1] = y; marksPos[nm * 3 + 2] = z;
      ink(marksCol, nm * 3, c, a);
      nm++;
    };
    let discUsed = 0;
    this.weaponSegs.length = 0;
    let segUsed = 0;
    const screenSeg = (ax: number, ay: number, bx: number, by: number) => {
      const a = this.toScreen(ax, ay, 0);
      if (a.z >= 1) return;
      const x1 = a.x, y1 = a.y;
      const b = this.toScreen(bx, by, 0);
      if (b.z >= 1) return;
      let sg = this.segPool[segUsed];
      if (!sg) this.segPool.push((sg = { x1: 0, y1: 0, x2: 0, y2: 0 }));
      segUsed++;
      sg.x1 = x1; sg.y1 = y1; sg.x2 = b.x; sg.y2 = b.y;
      this.weaponSegs.push(sg);
    };
    const disc = (x: number, y: number, r: number, c: THREE.Color, a: number) => {
      let m = this.discs[discUsed];
      if (!m) {
        m = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
          transparent: true, depthTest: false, depthWrite: false,
          blending: this.theme.matte ? THREE.NormalBlending : THREE.AdditiveBlending,
        }));
        m.renderOrder = 6;
        this.discs.push(m);
        this.scene.add(m);
      }
      const dm = m.material as THREE.MeshBasicMaterial;
      if (this.theme.matte) {
        dm.color.copy(c);
        dm.opacity = Math.min(1, a * 4);
      } else {
        dm.color.copy(c).multiplyScalar(a);
        dm.opacity = 1;
      }
      m.position.set(x, y, 0);
      m.scale.set(r, r, 1);
      m.visible = true;
      discUsed++;
    };
    this.labelsUsed = 0;
    this.labelRects.length = 0;
    const dr = this.drawn;
    dr.weaponLines = dr.weaponHeads = dr.uncertaintyDiscs = dr.uncertaintyEdges = 0;
    dr.coverageDiscs = dr.coverageEdges = dr.unitSprites = dr.contactSprites = 0;
    dr.waypointPaths.length = 0;

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

      // range rings: selected unit and Shift+click pins
      const ringIds = new Set(input.pinnedRingIds);
      if (input.selectedUnitId) ringIds.add(input.selectedUnitId);
      for (const id of ringIds) {
        const t = unitTrack(id);
        if (!t || !t.unit) continue;
        const pl = getPlatform(t.unit.platformId);
        const friendly = t.unit.side === input.playerSide;
        const col = friendly ? C.ringF : C.ringH;
        if (pl?.sensorRangeKm) {
          dashed.circle(t.pos.x, t.pos.y, 0, pl.sensorRangeKm, col, 0.75, 120);
          this.ringLabel(t.pos.x, t.pos.y + pl.sensorRangeKm, `SNS ${Math.round(pl.sensorRangeKm / KM_PER_NM)}NM`, friendly);
        }
        if (pl?.weaponRangeKm) {
          solid.circle(t.pos.x, t.pos.y, 0, pl.weaponRangeKm, col, 0.6, 120);
          this.ringLabel(t.pos.x, t.pos.y + pl.weaponRangeKm, `WPN ${Math.round(pl.weaponRangeKm / KM_PER_NM)}NM`, friendly);
        }
        if (id === input.selectedUnitId) this.bearingRose(thin, t.pos.x, t.pos.y, col);
      }

      // contact position uncertainty (fog of war only)
      if (input.fogOfWar) {
        for (const t of this.tracks.values()) {
          if (!t.contact || t.contact.positionUncertainty <= 0.5) continue;
          const known = t.contact.classification === "classified" || t.contact.classification === "tracked";
          const col = known ? C.hostile : C.unknown;
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
          dashed.seg(px, py, 0, x, y, 0, C.phosphor, 0.9);
          mark(x, y, 0, C.phosphor, 0.95);
          this.label(x, y, 0, `WP${i + 1}`, "tx-wp-label", 8, -8);
          px = x; py = y;
        });
      }

      // track history dots
      for (const t of this.tracks.values()) {
        const h = t.history;
        const n = h.length / 2;
        if (!n) continue;
        const col = t.kind === "weapon" ? (t.weapon?.launchedBySide === input.playerSide ? C.weaponF : C.weaponH) : t.contact ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? C.hostile : C.unknown) : t.unit && t.unit.side !== input.playerSide ? C.hostile : C.phosphor;
        for (let i = 0; i < n; i++) {
          const a = (0.2 + 0.6 * ((i + 1) / n)) * t.alpha * (t.kind === "weapon" ? 0.75 : 1);
          dot(h[i * 2], h[i * 2 + 1], 0, col, a);
        }
      }

      // weapons: head, line to target, flight trail
      for (const w of this.weaponLines(input)) {
        const t = this.tracks.get(`weapon:${w.weapon.id}`);
        if (!t) continue;
        const col = w.friendly ? C.weaponF : C.weaponH;
        if (w.target) {
          dashed.breakRun();
          dashed.seg(t.pos.x, t.pos.y, 0, w.target.x, w.target.y, 0, col, 0.55);
          dr.weaponLines++;
          screenSeg(t.pos.x, t.pos.y, w.target.x, w.target.y);
        }
        mark(t.pos.x, t.pos.y, 0, C.hi, 1);
        dr.weaponHeads++;
        const dir = THREE.MathUtils.degToRad(w.weapon.heading);
        const L = 10 * this.pxAt(t.pos.x, t.pos.y);
        solid.seg(t.pos.x, t.pos.y, 0, t.pos.x - Math.sin(dir) * L, t.pos.y - Math.cos(dir) * L, 0, col, 0.9);
        screenSeg(t.pos.x, t.pos.y, t.pos.x - Math.sin(dir) * L, t.pos.y - Math.cos(dir) * L);
      }

      // unit and contact glyphs, leaders, drop lines, sweeps
      const usedSweeps = new Set<string>();
      for (const t of this.tracks.values()) {
        if (!t.sprite) continue;
        const px = this.pxAt(t.pos.x, t.pos.y, t.z);
        t.sprite.position.set(t.pos.x, t.pos.y, t.z);
        const pulse = t.paintT ? Math.max(0, 1 - (now - t.paintT) / 350) : 0;
        const s = this.spriteK * (1 + pulse * 0.25);
        t.sprite.scale.set(t.spriteW * s, t.spriteH * s, 1);
        (t.sprite.material as THREE.SpriteMaterial).opacity = t.alpha;
        if (t.sprite.visible && t.alpha > 0) {
          if (t.kind === "unit") dr.unitSprites++;
          else dr.contactSprites++;
        }

        const friendly = t.unit?.side === input.playerSide;
        const hostileUnit = !!t.unit && !friendly;
        const col = t.contact
          ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? C.hostile : C.unknown)
          : hostileUnit ? C.hostile : C.phosphor;

        // course leader
        const hdg = t.unit ? t.unit.heading : t.contact?.estimatedHeading;
        const spd = t.unit ? t.unit.speed : t.contact?.estimatedSpeed ?? 0;
        if (hdg !== undefined && spd > 0) {
          const L = (14 + Math.min(26, spd * 0.06)) * px;
          const a = THREE.MathUtils.degToRad(hdg);
          solid.seg(t.pos.x, t.pos.y, t.z, t.pos.x + Math.sin(a) * L, t.pos.y + Math.cos(a) * L, t.z, col, 0.85 * t.alpha);
        }
        if (t.z > 0.01) thin.seg(t.pos.x, t.pos.y, 0, t.pos.x, t.pos.y, t.z, col, 0.45);

        // radar sweep on emitters
        if (this.theme.sweeps && t.unit && input.orders.get(t.unit.id)?.radarActive) {
          // with S on, friendly ships sweep their full radar range, faintly
          const pl = getPlatform(t.unit.platformId);
          const big = input.showSensorCoverage && friendly && pl?.dimension === "sea" ? pl.sensorRangeKm : undefined;
          const radius = big ?? 26 * px;
          this.sweep(t, radius, sweepAngle + (parseInt(trackNumber(t.id), 10) % 360) * 0.0174533, friendly ? C.phosphor : C.hostile, big ? 0.2 * coverageShare : this.theme.sweepAlpha);
          usedSweeps.add(t.key);
        }
      }
      for (const [key, m] of this.sweeps) {
        if (!usedSweeps.has(key)) m.visible = false;
      }

      // selection reticle and hover bracket
      const sel = input.selectedUnitId ? unitTrack(input.selectedUnitId) : undefined;
      if (sel) this.reticle(solid, sel, 17, C.hi, 1);
      const hov = this.hoverKey ? this.tracks.get(this.hoverKey) : undefined;
      if (hov && hov !== sel) this.reticle(thin, hov, 15, C.phosphor, 0.6);

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
          this.label((ax + bx) / 2, (ay + by) / 2, 0, formatMeasurement(a, b).toUpperCase(), "tx-measure-label", 10, 8);
        }
      }

      // effects: short, sharp, then gone
      this.effects = this.effects.filter((e) => {
        const life = e.kind === "kill" ? 1400 : e.kind === "hit" ? 900 : 650;
        const k = (now - e.t0) / life;
        if (k >= 1) return false;
        const px = this.pxAt(e.x, e.y);
        const ease = 1 - Math.pow(1 - k, 3);
        const fade = 1 - k;
        if (e.kind === "intercept") {
          solid.circle(e.x, e.y, 0, (4 + 16 * ease) * px, C.hi, fade, 24);
          const s = 6 * px * (1 - ease * 0.5);
          solid.seg(e.x - s, e.y - s, 0, e.x + s, e.y + s, 0, C.hi, fade);
          solid.seg(e.x - s, e.y + s, 0, e.x + s, e.y - s, 0, C.hi, fade);
        } else {
          const big = e.kind === "kill" ? 1.6 : 1;
          solid.circle(e.x, e.y, 0, (6 + 34 * ease) * px * big, C.alarm, fade, 40);
          solid.circle(e.x, e.y, 0, (3 + 18 * ease) * px * big, C.hi, fade * 0.8, 32);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.39;
            const r0 = (8 + 20 * ease) * px * big, r1 = r0 + 8 * px * big * fade;
            solid.seg(e.x + Math.sin(a) * r0, e.y + Math.cos(a) * r0, 0, e.x + Math.sin(a) * r1, e.y + Math.cos(a) * r1, 0, C.alarm, fade);
          }
          if (k < 0.12) mark(e.x, e.y, 0, C.hi, 1 - k / 0.12);
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
    m.position.set(t.pos.x, t.pos.y, 0.001);
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
    const h = half * px, a = 6 * px;
    const { x, y } = t.pos;
    const z = t.z;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = x + sx * h, cy = y + sy * h;
      batch.seg(cx, cy, z, cx - sx * a, cy, z, col, alpha);
      batch.seg(cx, cy, z, cx, cy - sy * a, z, col, alpha);
    }
  }

  private ringLabel(x: number, y: number, text: string, friendly: boolean) {
    this.label(x, y, 0, text, friendly ? "tx-ring-label" : "tx-ring-label tx-ring-label--alarm", 4, -18);
  }

  private label(x: number, y: number, z: number, text: string, cls: string, dx: number, dy: number) {
    let el = this.labelPool[this.labelsUsed];
    if (!el) {
      el = document.createElement("div");
      this.overlay.appendChild(el);
      this.labelPool.push(el);
    }
    this.labelsUsed++;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    const s = this.toScreen(x, y, z);
    const visible = s.z < 1 && s.x > -50 && s.x < this.W + 50 && s.y > -20 && s.y < this.H + 20;
    if (!visible) {
      if (el.style.display !== "none") el.style.display = "none";
      return;
    }
    // ring and waypoint labels are short; estimate their box from the text
    const rect = { x: s.x + dx, y: s.y + dy, w: text.length * 7.6 + 8, h: 16 };
    if (this.underChrome(rect)) {
      if (el.style.display !== "none") el.style.display = "none";
      return;
    }
    if (el.style.display === "none") el.style.display = "";
    el.style.transform = `translate3d(${Math.round(rect.x)}px, ${Math.round(rect.y)}px, 0)`;
    this.labelRects.push(rect);
  }

  /** Chrome rects are read outside the animation frame, when the chrome changes. */
  private scheduleOccluders() {
    if (this.occluderTimer || this.disposed) return;
    this.occluderTimer = setTimeout(() => {
      this.occluderTimer = null;
      if (!this.disposed) this.refreshOccluders();
    }, 0);
  }

  private refreshOccluders() {
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

  /** Distance from a screen point to the nearest chrome band or canvas edge. */
  private chromeGap(x: number, y: number): number {
    let d = Math.min(x, y, this.W - x, this.H - y);
    for (const o of this.occluders) {
      const dx = Math.max(0, o.x - x, x - (o.x + o.w));
      const dy = Math.max(0, o.y - y, y - (o.y + o.h));
      d = Math.min(d, Math.hypot(dx, dy));
    }
    return d;
  }

  /** True when a screen rect touches any chrome band or leaves the canvas. */
  private underChrome(r: Rect): boolean {
    if (r.x < 0 || r.y < 0 || r.x + r.w > this.W || r.y + r.h > this.H) return true;
    for (const o of this.occluders) if (intersects(r, o)) return true;
    return false;
  }

  // ---------------------------------------------------------- data blocks

  /** Block text metrics from a hidden probe, so sizes need no per-frame DOM reads. */
  private measureText() {
    const probe = (cls: string, text: string) => {
      const el = document.createElement("div");
      el.className = cls;
      el.style.visibility = "hidden";
      el.textContent = text;
      this.overlay.appendChild(el);
      const r = { w: el.offsetWidth, h: el.offsetHeight };
      el.remove();
      return r;
    };
    const one = probe("tx-block", "M"), ten = probe("tx-block", "MMMMMMMMMM"), two = probe("tx-block", "M\nM");
    const charW = (ten.w - one.w) / 9;
    const lineH = two.h - one.h;
    if (charW > 0 && lineH > 0) {
      this.metrics.charW = charW;
      this.metrics.padW = one.w - charW;
      this.metrics.lineH = lineH;
      this.metrics.padH = one.h - lineH;
    }
    const g1 = probe("tx-grid-label", "M"), g10 = probe("tx-grid-label", "MMMMMMMMMM");
    const gW = (g10.w - g1.w) / 9;
    if (gW > 0) {
      this.metrics.gridCharW = gW;
      this.metrics.gridPadW = g1.w - gW;
      this.metrics.gridH = g1.h;
    }
    this.viewHash = "";
  }

  private blockSize(lines: string[], count: number): { w: number; h: number } {
    const m = this.metrics;
    let longest = 0;
    for (let i = 0; i < count; i++) longest = Math.max(longest, lines[i]?.length ?? 0);
    return { w: Math.ceil(longest * m.charW + m.padW), h: Math.ceil(count * m.lineH + m.padH) };
  }

  private trackPriority(t: Track, input: PlotInput): number {
    if (t.kind === "unit" && t.id === input.selectedUnitId) return 0;
    if (t.unit) return t.unit.side === input.playerSide ? 1 : 2;
    const c = t.contact!;
    return c.classification === "classified" || c.classification === "tracked" ? 2 : c.classification === "detected" ? 3 : 4;
  }

  private placeBlocks(input: PlotInput) {
    const now = performance.now();
    const items = this.items;
    items.length = 0;
    const glyphs = this.glyphs;
    glyphs.length = 0;
    const points = this.pointRects;
    points.length = 0;
    const byItem = this.itemTracks;
    byItem.length = 0;
    let pool = 0;
    const rect = (x: number, y: number, w: number, h: number): Rect => {
      let r = this.rectPool[pool];
      if (!r) this.rectPool.push((r = { x: 0, y: 0, w: 0, h: 0 }));
      pool++;
      r.x = x; r.y = y; r.w = w; r.h = h;
      return r;
    };

    for (const t of this.tracks.values()) {
      const s = this.toScreen(t.pos.x, t.pos.y, t.z);
      t.screen.set(s.x, s.y);
      t.onScreen = s.z < 1 && s.x > -40 && s.x < this.W + 40 && s.y > -40 && s.y < this.H + 40;
      if (!t.onScreen) {
        if (t.block && t.block.style.display !== "none") t.block.style.display = "none";
        continue;
      }
      if (t.kind === "weapon") {
        points.push(rect(s.x - 18, s.y - 18, 36, 36));
        continue;
      }
      const hw = Math.max(11, (t.spriteW || 22) / 2), hh = Math.max(11, (t.spriteH || 22) / 2);
      const g = rect(s.x - hw, s.y - hh, hw * 2, hh * 2);
      // the drawn symbol: a 2525 frame fills about 70% of its texture
      const ch = Math.max(8, Math.min(t.spriteW || 22, t.spriteH || 22) * 0.36);
      const core = rect(s.x - ch, s.y - ch, ch * 2, ch * 2);
      glyphs.push({ key: t.key, rect: g, core, x: s.x, y: s.y });
      if (!t.block) continue;
      // a glyph the chrome cuts into takes its label with it
      if (this.underChrome(core)) {
        if (t.block.style.display !== "none") t.block.style.display = "none";
        continue;
      }
      const { lines, cls } = this.blockLines(t, input);
      const text = lines.join("\n");
      if (text !== t.blockText) {
        t.blockText = text;
        t.compactText = lines[0] ?? "";
      }
      const full = this.blockSize(lines, lines.length), compact = this.blockSize(lines, 1);
      const priority = this.trackPriority(t, input);
      items.push({
        key: t.key, priority, keep: priority <= 2, gx: s.x, gy: s.y, glyph: g, core, edge: this.chromeGap(s.x, s.y),
        fullW: full.w, fullH: full.h, compactW: compact.w, compactH: compact.h,
      });
      byItem.push({ t, cls });
    }
    for (const e of this.effects) {
      if (now - e.t0 > 700) continue;
      const sc = this.toScreen(e.x, e.y, 0);
      points.push(rect(sc.x - 30, sc.y - 30, 60, 60));
    }

    const placements = this.placer.place(items, {
      compactWithin: this.mode === "crt" ? 64 : 0,
      blocked: (r) => this.underChrome(r),
      fixed: this.labelRects,
      glyphs,
      points,
      lines: this.weaponSegs,
    });

    const leaders = this.leaderParts;
    leaders.friendly.length = leaders.hostile.length = leaders.unknown.length = 0;
    this.lastLeaders.length = 0;
    this.lastBlocks.length = 0;
    this.keptHidden = 0;
    this.keptHiddenKeys.length = 0;
    for (let i = 0; i < items.length; i++) {
      const p = placements[i];
      const { t, cls } = byItem[i];
      const el = t.block!;
      if (!p.visible) {
        if (items[i].keep) {
          this.keptHidden++;
          this.keptHiddenKeys.push(`${t.key}@${Math.round(t.screen.x)},${Math.round(t.screen.y)}`);
        }
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      const wantCls = `tx-block tx-block--${t.kind} tx-block--${cls}${t.id === input.selectedUnitId && t.kind === "unit" ? " is-selected" : ""}`;
      if (el.className !== wantCls) el.className = wantCls;
      const want = p.compact ? t.compactText : t.blockText;
      if (t.shownText !== want) {
        el.textContent = want;
        t.shownText = want;
      }
      if (el.style.display === "none") el.style.display = "";
      t.blockW = p.rect.w;
      t.blockH = p.rect.h;
      t.blockX = p.rect.x;
      t.blockY = p.rect.y;
      el.style.transform = `translate3d(${p.rect.x}px, ${p.rect.y}px, 0)`;
      const op = t.alpha.toFixed(2);
      if (el.style.opacity !== op) el.style.opacity = op;
      this.lastBlocks.push(p.rect);
      if (p.leader) {
        const kind = t.contact
          ? (t.contact.classification === "classified" || t.contact.classification === "tracked" ? "hostile" : "unknown")
          : t.unit && t.unit.side !== input.playerSide ? "hostile" : "friendly";
        const l = p.leader;
        leaders[kind].push(`M${l.x1.toFixed(1)} ${l.y1.toFixed(1)}L${l.x2.toFixed(1)} ${l.y2.toFixed(1)}`);
        this.lastLeaders.push({ key: t.key, seg: l });
      }
    }

    let halo = "";
    for (const k of ["friendly", "hostile", "unknown"] as const) {
      const d = leaders[k].join("");
      halo += d;
      if (d !== this.leaderD[k]) {
        this.leaderD[k] = d;
        this.leaderPaths[k].setAttribute("d", d);
      }
    }
    if (halo !== this.leaderHaloD) {
      this.leaderHaloD = halo;
      this.leaderHalo.setAttribute("d", halo);
    }

    this.resolveGridLabels();
  }

  /** Grid labels yield to every block, leader, glyph, weapon line and to each other. */
  private resolveGridLabels() {
    const shown = this.gridShown;
    shown.length = 0;
    for (const g of this.gridCands) {
      let ok = this.gridOn && !this.underChrome(g.rect);
      if (ok) for (const b of this.lastBlocks) if (intersects(g.rect, b)) { ok = false; break; }
      if (ok) for (const r of this.labelRects) if (intersects(g.rect, r)) { ok = false; break; }
      if (ok) for (const l of this.lastLeaders) if (segHitsRect(l.seg, g.rect, 1)) { ok = false; break; }
      if (ok) for (const gl of this.glyphs) if (intersects(g.rect, gl.rect)) { ok = false; break; }
      if (ok) for (const s of this.weaponSegs) if (segHitsRect(s, g.rect, 1)) { ok = false; break; }
      if (ok) for (const o of shown) if (intersects(g.rect, o)) { ok = false; break; }
      const want = ok ? "" : "none";
      if (g.el.style.display !== want) g.el.style.display = want;
      if (ok) shown.push(g.rect);
    }
  }

  /** The label audit the declutter test runs: DOM block rects against what was drawn. */
  private audit() {
    const host = this.host.getBoundingClientRect();
    const blocks: { key: string; rect: Rect }[] = [];
    for (const t of this.tracks.values()) {
      if (!t.block || t.block.style.display === "none" || !t.onScreen) continue;
      const r = t.block.getBoundingClientRect();
      if (r.width <= 0) continue;
      blocks.push({ key: t.key, rect: { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height } });
    }
    const grid: Rect[] = [];
    for (const g of this.gridLabels) {
      if (g.style.display === "none") continue;
      const r = g.getBoundingClientRect();
      if (r.width > 0) grid.push({ x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height });
    }
    // the friendly leader path as the browser renders it
    const ls = getComputedStyle(this.leaderPaths.friendly);
    const opacity = parseFloat(ls.opacity || "1") * parseFloat(ls.strokeOpacity || "1") * parseFloat(getComputedStyle(this.leaderSvg).opacity || "1");
    const heads: Rect[] = [];
    for (const t of this.tracks.values()) {
      if (t.kind === "weapon" && t.onScreen) heads.push({ x: t.screen.x - 6, y: t.screen.y - 6, w: 12, h: 12 });
    }
    const layout: { key: string; form: string; side: number }[] = [];
    for (const b of blocks) {
      const t = this.tracks.get(b.key);
      if (!t) continue;
      const cx = b.rect.x + b.rect.w / 2, cy = b.rect.y + b.rect.h / 2;
      layout.push({
        key: b.key,
        form: t.shownText === t.blockText ? "full" : "compact",
        side: (cx >= t.screen.x ? 0 : 2) + (cy >= t.screen.y ? 1 : 0),
      });
    }
    const counts = auditLabels({
      heads,
      leaderStroke: { width: parseFloat(ls.strokeWidth || "1"), opacity },
      blocks,
      leaders: this.lastLeaders.map((l) => ({ key: l.key, seg: { ...l.seg } })),
      glyphs: this.glyphs.map((g) => ({ key: g.key, rect: { ...g.rect }, core: { ...g.core }, x: g.x, y: g.y })),
      lines: this.weaponSegs.map((s) => ({ ...s })),
      grid,
      keptHidden: this.keptHidden,
    });
    // how crowded the frame was: closest pair of glyphs, in px
    let closest = Infinity;
    for (let i = 0; i < this.glyphs.length; i++) {
      for (let j = i + 1; j < this.glyphs.length; j++) {
        closest = Math.min(closest, Math.hypot(this.glyphs[i].x - this.glyphs[j].x, this.glyphs[i].y - this.glyphs[j].y));
      }
    }
    return { ...counts, glyphs: this.glyphs.length, leaders: this.lastLeaders.length, weaponLines: this.weaponSegs.length, closestGlyphs: closest === Infinity ? -1 : Math.round(closest), tilt: this.tiltAmt, hiddenKeep: this.keptHiddenKeys.join(" "), layout, mode: this.mode };
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

    this.gridCands.length = 0;
    const m = this.metrics;
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
      if (el.textContent !== u.text) el.textContent = u.text;
      const rx = Math.round(u.x), ry = Math.round(u.y);
      this.gridCands.push({ el, rect: { x: rx, y: ry, w: Math.ceil(u.text.length * m.gridCharW + m.gridPadW), h: Math.ceil(m.gridH) } });
      el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
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
