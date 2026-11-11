// Real-world facilities (airbases, heliports, naval bases, ports, military
// areas, runways) for the Three.js plot, drawn in the plot's phosphor
// register. Everything is built once; per frame the layer only sets draw
// ranges and one uniform, so it costs a handful of draw calls.
import * as THREE from "three";
import { LineBatch } from "./lineBatch";
import { PALETTE } from "./palette";
import type { PlotProjection } from "./projection";
import { facilityTier, type Facility, type FacilityKind } from "@/lib/facilities/facilities";

const COL = {
  phosphor: new THREE.Color(PALETTE.phosphor),
  dim: new THREE.Color(PALETTE.phosphorDim),
  faint: new THREE.Color(PALETTE.phosphorFaint),
};

// The map layer's zoom thresholds, expressed as km per CSS pixel on the plot
// (web-mercator z ~ log2(139.5 / kmPerPx) at this latitude).
const zoomOf = (kmPerPx: number) => Math.log2(139.5 / kmPerPx);
const TIER_MINZOOM = [3, 5.5, 7.5, 9.5];
const TIER_LABEL_MINZOOM = [6.5, 8.2, 9, 10.5];
const AREA_MAX_KM_PER_PX = 0.35;
const RUNWAY_MAX_KM_PER_PX = 1.4;
const DEFAULT_RUNWAY_WIDTH_M = 30;
export const FACILITY_SYMBOL_PX = 20;
const SYMBOL_PX = FACILITY_SYMBOL_PX;

export interface FacilityItem {
  facility: Facility;
  x: number;
  y: number;
  tier: 0 | 1 | 2 | 3;
  group: number;
  /** Index inside its symbol group (position attribute slot). */
  slot?: number;
  /** Longest runway in km; 0 when none. */
  rwKm?: number;
  /** True while the symbol is not drawn: withdrawn for its runways, or decluttered. */
  hidden?: boolean;
  /** Withdrawn because its runways are drawn big enough to say it. */
  withdrawn?: boolean;
  /** Decluttered: another symbol, or an OSINT icon, would sit on top of this one. */
  decl?: boolean;
}

export interface RunwayGeom {
  ident: string;
  x: number; y: number;
  ox: number; oy: number;
  ax: number; ay: number; bx: number; by: number;
  halfKm: number;
}

/** A runway longer than this many screen px replaces the airfield symbol, which would sit on it. */
const RUNWAY_REPLACES_SYMBOL_PX = 34;

interface RunwaySeg {
  facility: Facility;
  ax: number; ay: number; bx: number; by: number;
  halfKm: number;
  closed: boolean;
}

interface Group {
  kind: FacilityKind;
  military: boolean;
  items: FacilityItem[];
  tierEnd: number[]; // draw count when tiers 0..n are visible
  points: THREE.Points;
}

type IconKind = Exclude<FacilityKind, "military_area">;

function iconTexture(kind: IconKind): THREE.CanvasTexture {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = 5;
  g.lineCap = "round";
  g.lineJoin = "round";
  const c = S / 2;
  if (kind === "airbase") {
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    // the aircraft stands clear of the ring: slim fuselage, swept wing and tailplane read as separate parts at 20 px
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c, c - 14.5); g.lineTo(c + 2.8, c - 9.5); g.lineTo(c + 2.8, c - 4.8); g.lineTo(c + 13.5, c + 3.2); g.lineTo(c + 13.5, c + 6.6); g.lineTo(c + 2.8, c + 3.6);
    g.lineTo(c + 2.8, c + 8.4); g.lineTo(c + 6.5, c + 11.3); g.lineTo(c + 6.5, c + 13.5); g.lineTo(c, c + 12.2);
    g.lineTo(c - 6.5, c + 13.5); g.lineTo(c - 6.5, c + 11.3); g.lineTo(c - 2.8, c + 8.4); g.lineTo(c - 2.8, c + 3.6);
    g.lineTo(c - 13.5, c + 6.6); g.lineTo(c - 13.5, c + 3.2); g.lineTo(c - 2.8, c - 4.8); g.lineTo(c - 2.8, c - 9.5); g.closePath(); g.fill(); g.stroke();
  } else if (kind === "heliport") {
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(c - 8, c - 11); g.lineTo(c - 8, c + 11); g.moveTo(c + 8, c - 11); g.lineTo(c + 8, c + 11); g.moveTo(c - 8, c); g.lineTo(c + 8, c); g.stroke();
  } else if (kind === "naval_base") {
    g.beginPath(); g.arc(c, c - 17, 5, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(c, c - 12); g.lineTo(c, c + 19); g.moveTo(c - 10, c - 4); g.lineTo(c + 10, c - 4); g.stroke();
    g.beginPath(); g.arc(c, c + 4, 16, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  } else {
    g.strokeRect(c - 19, c - 19, 38, 38);
    g.beginPath();
    g.moveTo(c - 12, c - 4); g.quadraticCurveTo(c - 6, c - 11, c, c - 4); g.quadraticCurveTo(c + 6, c + 3, c + 12, c - 4);
    g.moveTo(c - 12, c + 8); g.quadraticCurveTo(c - 6, c + 1, c, c + 8); g.quadraticCurveTo(c + 6, c + 15, c + 12, c + 8);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const RUNWAY_VERT = /* glsl */ `
  uniform float uKm;
  uniform float uMinHalfPx;
  attribute vec2 aPerp;
  attribute float aHalf;
  attribute float aTone;
  varying float vTone;
  void main() {
    float h = max(aHalf, uMinHalfPx * uKm);
    vTone = aTone;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(aPerp * h, 0.0), 1.0);
  }
`;
const RUNWAY_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vTone;
  void main() { gl_FragColor = vec4(uColor * vTone, uAlpha); }
`;

export class FacilityPlotLayer {
  readonly root = new THREE.Group();
  readonly items: FacilityItem[] = [];
  private byId = new Map<string, FacilityItem>();
  private groups: Group[] = [];
  private runways: RunwaySeg[] = [];
  private runwayMesh: THREE.Mesh | null = null;
  private runwayMat: THREE.ShaderMaterial | null = null;
  private areas: LineBatch | null = null;
  private polys: { facility: Facility; xy: number[]; minX: number; minY: number; maxX: number; maxY: number }[] = [];
  private textures: THREE.CanvasTexture[] = [];
  private visibleSymbols = 0;

  constructor(private proj: PlotProjection, facilities: Facility[]) {
    this.root.renderOrder = 8;
    this.buildSymbols(facilities);
    this.buildRunways(facilities);
    this.buildAreas(facilities);
  }

  private buildSymbols(facilities: Facility[]) {
    const kinds: IconKind[] = ["airbase", "heliport", "naval_base", "port"];
    const tex = new Map(kinds.map((k) => [k, iconTexture(k)]));
    this.textures.push(...tex.values());
    for (const kind of kinds) {
      for (const military of [true, false]) {
        const list = facilities
          .filter((f) => f.kind === kind && (f.use ? f.use === "military" : kind === "naval_base") === military)
          .map((f) => ({ facility: f, x: this.proj.x(f.position.lng), y: this.proj.y(f.position.lat), tier: facilityTier(f), group: this.groups.length }))
          .sort((a, b) => a.tier - b.tier);
        if (!list.length) continue;
        const pos = new Float32Array(list.length * 3);
        list.forEach((it, i) => {
          pos[i * 3] = it.x; pos[i * 3 + 1] = it.y; pos[i * 3 + 2] = 0;
          (it as FacilityItem).slot = i;
          (it as FacilityItem).rwKm = longestRunwayKm(it.facility, this.proj);
        });
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geom.setDrawRange(0, 0);
        const mat = new THREE.PointsMaterial({
          map: tex.get(kind)!,
          size: SYMBOL_PX,
          sizeAttenuation: false,
          color: military ? COL.phosphor : COL.dim,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const points = new THREE.Points(geom, mat);
        points.frustumCulled = false;
        points.renderOrder = 24;
        const tierEnd = [0, 1, 2, 3].map((t) => list.filter((it) => it.tier <= t).length);
        const group: Group = { kind, military, items: list as FacilityItem[], tierEnd, points };
        this.groups.push(group);
        this.root.add(points);
        for (const it of list) { this.items.push(it as FacilityItem); this.byId.set(it.facility.id, it as FacilityItem); }
      }
    }
    for (const f of facilities) {
      if (this.byId.has(f.id)) continue;
      const it: FacilityItem = { facility: f, x: this.proj.x(f.position.lng), y: this.proj.y(f.position.lat), tier: facilityTier(f), group: -1 };
      this.byId.set(f.id, it);
    }
  }

  private buildRunways(facilities: Facility[]) {
    for (const f of facilities) {
      for (const r of f.runways ?? []) {
        const [a, b] = r.ends;
        this.runways.push({
          facility: f,
          ax: this.proj.x(a.lng), ay: this.proj.y(a.lat),
          bx: this.proj.x(b.lng), by: this.proj.y(b.lat),
          halfKm: ((r.widthM ?? DEFAULT_RUNWAY_WIDTH_M) / 2) / 1000,
          closed: r.closed,
        });
      }
    }
    const n = this.runways.length;
    if (!n) return;
    const pos = new Float32Array(n * 4 * 3);
    const perp = new Float32Array(n * 4 * 2);
    const half = new Float32Array(n * 4);
    const tone = new Float32Array(n * 4);
    const idx = new Uint32Array(n * 6);
    this.runways.forEach((r, i) => {
      const dx = r.bx - r.ax, dy = r.by - r.ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len;
      const verts: [number, number, number][] = [[r.ax, r.ay, 1], [r.ax, r.ay, -1], [r.bx, r.by, 1], [r.bx, r.by, -1]];
      verts.forEach(([x, y, side], k) => {
        const o = i * 4 + k;
        pos[o * 3] = x; pos[o * 3 + 1] = y;
        perp[o * 2] = px * side; perp[o * 2 + 1] = py * side;
        half[o] = r.halfKm;
        tone[o] = r.closed ? 0.4 : 1;
      });
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("aPerp", new THREE.BufferAttribute(perp, 2));
    geom.setAttribute("aHalf", new THREE.BufferAttribute(half, 1));
    geom.setAttribute("aTone", new THREE.BufferAttribute(tone, 1));
    geom.setIndex(new THREE.BufferAttribute(idx, 1));
    this.runwayMat = new THREE.ShaderMaterial({
      uniforms: { uKm: { value: 1 }, uMinHalfPx: { value: 1.1 }, uColor: { value: COL.phosphor.clone() }, uAlpha: { value: 0.9 } },
      vertexShader: RUNWAY_VERT,
      fragmentShader: RUNWAY_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, this.runwayMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 23;
    this.runwayMesh = mesh;
    this.root.add(mesh);
  }

  private buildAreas(facilities: Facility[]) {
    const batch = new LineBatch({ width: 1, renderOrder: 7 });
    for (const f of facilities) {
      if (!f.polygon || f.polygon.length < 4) continue;
      const xy: number[] = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [lng, lat] of f.polygon) {
        const x = this.proj.x(lng), y = this.proj.y(lat);
        xy.push(x, y);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      this.polys.push({ facility: f, xy, minX, minY, maxX, maxY });
      batch.polyline(xy, 0, f.kind === "military_area" ? COL.faint : COL.dim, f.kind === "military_area" ? 0.9 : 0.55);
    }
    batch.flush();
    this.areas = batch;
    this.root.add(batch.object);
  }

  get(id: string): FacilityItem | undefined {
    return this.byId.get(id);
  }

  /** Highest tier drawn at this scale, or -1 when none is. */
  maxTier(kmPerPx: number): number {
    const z = zoomOf(kmPerPx);
    let t = -1;
    for (let i = 0; i < 4; i++) if (z >= TIER_MINZOOM[i]) t = i;
    return t;
  }

  maxLabelTier(kmPerPx: number): number {
    const z = zoomOf(kmPerPx);
    let t = -1;
    for (let i = 0; i < 4; i++) if (z >= TIER_LABEL_MINZOOM[i]) t = i;
    return t;
  }

  /** Per-frame: draw ranges and the runway width uniform. */
  setView(kmPerPx: number, on: boolean) {
    this.root.visible = on;
    const mt = this.maxTier(kmPerPx);
    let n = 0;
    for (const g of this.groups) {
      const count = mt < 0 ? 0 : g.tierEnd[mt];
      g.points.geometry.setDrawRange(0, count);
      n += count;
    }
    this.visibleSymbols = n;
    this.withdrawSymbols(kmPerPx);
    if (this.runwayMesh && this.runwayMat) {
      const show = kmPerPx < RUNWAY_MAX_KM_PER_PX;
      this.runwayMesh.visible = show;
      this.runwayMat.uniforms.uKm.value = kmPerPx;
      // fade in over the last stretch so zoomed-out runways do not shimmer
      this.runwayMat.uniforms.uAlpha.value = THREE.MathUtils.clamp((RUNWAY_MAX_KM_PER_PX - kmPerPx) / 0.6, 0.35, 0.95);
    }
    if (this.areas) this.areas.object.visible = kmPerPx < AREA_MAX_KM_PER_PX;
  }

  /** Airfield symbols step aside once their own runways are long enough on screen to be the marker. */
  private withdrawSymbols(kmPerPx: number) {
    for (const it of this.items) {
      if (!it.rwKm || it.slot === undefined) continue;
      const hide = it.rwKm / kmPerPx > RUNWAY_REPLACES_SYMBOL_PX && kmPerPx < RUNWAY_MAX_KM_PER_PX;
      if (hide === !!it.withdrawn) continue;
      it.withdrawn = hide;
      this.applyHidden(it);
    }
  }

  private applyHidden(it: FacilityItem) {
    const hide = !!(it.withdrawn || it.decl);
    if (hide === !!it.hidden || it.slot === undefined) return;
    it.hidden = hide;
    const g = this.groups[it.group];
    const attr = g.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(it.slot, hide ? 1e9 : it.x, hide ? 1e9 : it.y, 0);
    attr.needsUpdate = true;
  }

  /**
   * Hide the lower-priority symbol of any two that would overlap on screen (the selected one first, then the higher
   * tier, then the longer runway), and any symbol that would sit under an OSINT icon. `minGap` is the centre spacing
   * in px for two facility symbols; `osint` are the OSINT icon centres, kept at `osintGap`.
   */
  declutter(
    kmPerPx: number,
    selectedId: string | null,
    toScreen: (x: number, y: number) => { x: number; y: number; z: number },
    osint: { cx: number; cy: number }[],
    bounds: { w: number; h: number },
    minGap = SYMBOL_PX + 1,
    osintGap = SYMBOL_PX / 2 + 11 + 1,
  ) {
    const mt = this.maxTier(kmPerPx);
    const cand: { it: FacilityItem; x: number; y: number }[] = [];
    for (const it of this.items) {
      if (it.slot === undefined) continue;
      if (mt < 0 || it.tier > mt || it.withdrawn) { this.setDecl(it, false); continue; }
      const s = toScreen(it.x, it.y);
      if (s.z >= 1 || s.x < -30 || s.y < -30 || s.x > bounds.w + 30 || s.y > bounds.h + 30) { this.setDecl(it, false); continue; }
      cand.push({ it, x: s.x, y: s.y });
    }
    cand.sort((a, b) =>
      (a.it.facility.id === selectedId ? -1 : 0) - (b.it.facility.id === selectedId ? -1 : 0) ||
      a.it.tier - b.it.tier || (b.it.rwKm ?? 0) - (a.it.rwKm ?? 0) || (a.it.facility.id < b.it.facility.id ? -1 : 1));
    const cell = 24;
    const keep = new Map<string, { x: number; y: number }[]>();
    const key = (cx: number, cy: number) => `${cx},${cy}`;
    const near = (x: number, y: number, gap: number) => {
      for (let gx = Math.floor((x - gap) / cell); gx <= Math.floor((x + gap) / cell); gx++) {
        for (let gy = Math.floor((y - gap) / cell); gy <= Math.floor((y + gap) / cell); gy++) {
          for (const k of keep.get(key(gx, gy)) ?? []) if (Math.abs(k.x - x) < gap && Math.abs(k.y - y) < gap) return true;
        }
      }
      return false;
    };
    for (const c of cand) {
      let bad = c.it.facility.id !== selectedId && osint.some((o) => Math.abs(o.cx - c.x) < osintGap && Math.abs(o.cy - c.y) < osintGap);
      if (!bad && c.it.facility.id !== selectedId) bad = near(c.x, c.y, minGap);
      this.setDecl(c.it, bad);
      if (!bad) {
        const k = key(Math.floor(c.x / cell), Math.floor(c.y / cell));
        const arr = keep.get(k);
        if (arr) arr.push({ x: c.x, y: c.y }); else keep.set(k, [{ x: c.x, y: c.y }]);
      }
    }
  }

  private setDecl(it: FacilityItem, v: boolean) {
    if (!!it.decl === v) return;
    it.decl = v;
    this.applyHidden(it);
  }

  get drawnSymbols() {
    return this.root.visible ? this.visibleSymbols : 0;
  }

  get drawnRunways() {
    return this.root.visible && this.runwayMesh?.visible ? this.runways.length : 0;
  }

  /** Runways drawn near the view, for runway-end labels at close range. */
  runwayEnds(f: Facility): RunwayGeom[] {
    const out: RunwayGeom[] = [];
    for (const r of f.runways ?? []) {
      const [a, b] = r.ends;
      const ax = this.proj.x(a.lng), ay = this.proj.y(a.lat), bx = this.proj.x(b.lng), by = this.proj.y(b.lat);
      const halfKm = ((r.widthM ?? DEFAULT_RUNWAY_WIDTH_M) / 2) / 1000;
      if (a.ident) out.push({ ident: a.ident, x: ax, y: ay, ox: bx, oy: by, ax, ay, bx, by, halfKm });
      if (b.ident) out.push({ ident: b.ident, x: bx, y: by, ox: ax, oy: ay, ax, ay, bx, by, halfKm });
    }
    return out;
  }

  /** Every runway segment of a facility, in plot units. */
  runwaySegments(f: Facility): { ax: number; ay: number; bx: number; by: number; halfKm: number }[] {
    return (f.runways ?? []).map((r) => ({
      ax: this.proj.x(r.ends[0].lng), ay: this.proj.y(r.ends[0].lat),
      bx: this.proj.x(r.ends[1].lng), by: this.proj.y(r.ends[1].lat),
      halfKm: ((r.widthM ?? DEFAULT_RUNWAY_WIDTH_M) / 2) / 1000,
    }));
  }

  /** Facility under a screen point: symbol first, then runway strip, then area. */
  pick(
    sx: number,
    sy: number,
    ground: { x: number; y: number } | null,
    kmPerPx: number,
    toScreen: (x: number, y: number) => { x: number; y: number; z: number },
  ): Facility | null {
    if (!this.root.visible) return null;
    const mt = this.maxTier(kmPerPx);
    let best: FacilityItem | null = null;
    let bestD = SYMBOL_PX * 0.75;
    if (mt >= 0) {
      for (const g of this.groups) {
        const count = g.tierEnd[mt];
        for (let i = 0; i < count; i++) {
          const it = g.items[i];
          if (it.hidden) continue;
          const s = toScreen(it.x, it.y);
          if (s.z >= 1) continue;
          const d = Math.hypot(s.x - sx, s.y - sy);
          if (d < bestD) { bestD = d; best = it; }
        }
      }
    }
    if (best) return best.facility;
    if (!ground) return null;
    if (kmPerPx < RUNWAY_MAX_KM_PER_PX) {
      let bestRw: RunwaySeg | null = null;
      let bestRd = Infinity;
      for (const r of this.runways) {
        const dx = r.bx - r.ax, dy = r.by - r.ay;
        const l2 = dx * dx + dy * dy || 1;
        const t = THREE.MathUtils.clamp(((ground.x - r.ax) * dx + (ground.y - r.ay) * dy) / l2, 0, 1);
        const d = Math.hypot(ground.x - (r.ax + dx * t), ground.y - (r.ay + dy * t));
        const reach = Math.max(r.halfKm, 7 * kmPerPx);
        if (d < reach && d < bestRd) { bestRd = d; bestRw = r; }
      }
      if (bestRw) return bestRw.facility;
    }
    if (kmPerPx < AREA_MAX_KM_PER_PX) {
      let smallest: { facility: Facility; area: number } | null = null;
      for (const p of this.polys) {
        if (ground.x < p.minX || ground.x > p.maxX || ground.y < p.minY || ground.y > p.maxY) continue;
        if (!inside(ground.x, ground.y, p.xy)) continue;
        const area = (p.maxX - p.minX) * (p.maxY - p.minY);
        if (!smallest || area < smallest.area) smallest = { facility: p.facility, area };
      }
      if (smallest) return smallest.facility;
    }
    return null;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    for (const t of this.textures) t.dispose();
  }
}

function longestRunwayKm(f: Facility, proj: PlotProjection): number {
  let best = 0;
  for (const r of f.runways ?? []) {
    const [a, b] = r.ends;
    best = Math.max(best, Math.hypot(proj.x(a.lng) - proj.x(b.lng), proj.y(a.lat) - proj.y(b.lat)));
  }
  return best;
}

function inside(x: number, y: number, xy: number[]): boolean {
  let c = false;
  for (let i = 0, j = xy.length - 2; i < xy.length; j = i, i += 2) {
    const xi = xy[i], yi = xy[i + 1], xj = xy[j], yj = xy[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
