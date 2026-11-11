// Real-world air-defence, radar and nuclear sites for the Three.js plot: range rings (solid when measured, dashed
// when ESTIMATED), a symbol fanned out beside the true position, and a dot on the true position. Static data, so the
// rings are built once per site set; per frame the layer only moves symbols by a pixel offset.
import * as THREE from "three";
import { LineBatch } from "./lineBatch";
import { PALETTE } from "./palette";
import type { PlotProjection } from "./projection";
import { geodesicCircle } from "@/lib/map/rangeRings";
import { coLocationIndex, ringAlways, sideForAffiliation } from "@/lib/osint/sites";
import type { OsintLayer, OsintSite } from "@/lib/osint/sites";

export const OSINT_SYMBOL_PX = 22;
export const OSINT_SLOTS: [number, number][] = [[0, -26], [28, -2], [-28, -2], [0, 26]];
const HIT_PX = 15;

const COL = {
  friendly: new THREE.Color(PALETTE.phosphorHi),
  hostile: new THREE.Color(PALETTE.alarm),
  neutral: new THREE.Color(PALETTE.phosphorDim),
};
const colorOf = (s: OsintSite) => {
  const side = sideForAffiliation(s.affiliation);
  return side === "Iran" ? COL.hostile : side === "Neutral" ? COL.neutral : COL.friendly;
};

export interface OsintItem {
  site: OsintSite;
  x: number;
  y: number;
  /** Pixel offset of the symbol from the true position. */
  ox: number;
  oy: number;
}

function glyphTexture(layer: OsintLayer): THREE.CanvasTexture {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  g.lineJoin = "round";
  const c = S / 2;
  g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
  if (layer === "ad") {
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(c - 15, c + 15); g.lineTo(c + 15, c + 15); g.moveTo(c - 11, c + 9); g.lineTo(c + 10, c - 14); g.stroke();
    g.beginPath(); g.moveTo(c + 16, c - 18); g.lineTo(c + 3, c - 14); g.lineTo(c + 13, c - 5); g.closePath(); g.fill();
  } else if (layer === "radar") {
    // a dish, not a canopy: solid bowl on a foot, looking up and right, and one wavefront. The feed sits on the symbol's
    // centre, so the true-position point of a site drawn on its own position lands on the feed and not on the bowl.
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(c - 19, c - 4); g.quadraticCurveTo(c - 19.5, c + 14.5, c - 1, c + 14); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(c - 12, c + 11); g.lineTo(c - 15.5, c + 17.5); g.lineTo(c - 6.5, c + 17.5); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(c - 10, c + 5); g.lineTo(c, c); g.stroke();
    g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 16.5, -Math.PI * 0.5, 0); g.stroke();
  } else {
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, 19, a - Math.PI / 6, a + Math.PI / 6); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(c, c, 4, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export class OsintPlotLayer {
  readonly root = new THREE.Group();
  readonly items: OsintItem[] = [];
  private byId = new Map<string, OsintItem>();
  private solid = new LineBatch({ width: 1.4, renderOrder: 9 });
  private dashed = new LineBatch({ width: 1.4, dashed: true, renderOrder: 9 });
  private selRing = new LineBatch({ width: 2.6, renderOrder: 10 });
  private points: { layer: OsintLayer; obj: THREE.Points; items: OsintItem[] }[] = [];
  private dots: THREE.Points;
  private dotPos: Float32Array;
  private textures: THREE.CanvasTexture[] = [];
  private selected: string | null = null;

  constructor(private proj: PlotProjection, sites: OsintSite[]) {
    this.root.renderOrder = 9;
    const loc = coLocationIndex(sites, 1500);
    for (const s of sites) {
      const l = loc.get(s.id)!;
      const slot = s.facilityId || l.count > 1 || s.positionBasis === "facility-anchor" ? l.index % OSINT_SLOTS.length : -1;
      const [ox, oy] = slot >= 0 ? OSINT_SLOTS[slot] : [0, 0];
      const it: OsintItem = { site: s, x: proj.x(s.position.lng), y: proj.y(s.position.lat), ox, oy };
      this.items.push(it);
      this.byId.set(s.id, it);
    }
    for (const layer of ["ad", "radar", "nuclear"] as OsintLayer[]) {
      const list = this.items.filter((i) => i.site.layer === layer);
      if (!list.length) continue;
      const tex = glyphTexture(layer);
      this.textures.push(tex);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(list.length * 3), 3));
      const col = new Float32Array(list.length * 3);
      list.forEach((it, i) => { const c = colorOf(it.site); col.set([c.r, c.g, c.b], i * 3); });
      geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        map: tex, size: OSINT_SYMBOL_PX, sizeAttenuation: false, vertexColors: true, transparent: true,
        depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const obj = new THREE.Points(geom, mat);
      obj.frustumCulled = false;
      obj.renderOrder = 26;
      this.points.push({ layer, obj, items: list });
      this.root.add(obj);
    }
    const dg = new THREE.BufferGeometry();
    this.dotPos = new Float32Array(this.items.length * 3);
    this.items.forEach((it, i) => this.dotPos.set([it.x, it.y, 0], i * 3));
    dg.setAttribute("position", new THREE.BufferAttribute(this.dotPos, 3));
    const dcol = new Float32Array(this.items.length * 3);
    this.items.forEach((it, i) => { const c = colorOf(it.site); dcol.set([c.r, c.g, c.b], i * 3); });
    dg.setAttribute("color", new THREE.BufferAttribute(dcol, 3));
    this.dots = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 25;
    this.root.add(this.dots, this.solid.object, this.dashed.object, this.selRing.object);
    this.buildRings(null);
  }

  private buildRings(selectedId: string | null) {
    this.solid.clear();
    this.dashed.clear();
    this.selRing.clear();
    for (const it of this.items) {
      const s = it.site;
      if (!(s.rangeKm > 0)) continue;
      const sel = s.id === selectedId;
      if (!sel && !ringAlways(s)) continue;
      const c = colorOf(s);
      const batch = sel ? this.selRing : s.estimated ? this.dashed : this.solid;
      // true geodesic outline: the planar circle is visibly wrong for the 1000-3000 km rings
      const ring = geodesicCircle(s.position.lng, s.position.lat, s.rangeKm, 160);
      const pts = new Float32Array(ring.length * 2);
      ring.forEach(([lng, lat], i) => { pts[i * 2] = this.proj.x(lng); pts[i * 2 + 1] = this.proj.y(lat); });
      batch.polyline(pts, 0, c, sel ? 1 : 0.8);
    }
    this.solid.flush();
    this.dashed.flush();
    this.selRing.flush();
    this.selected = selectedId;
  }

  setSelected(id: string | null) {
    if (id !== this.selected) this.buildRings(id);
  }

  get(id: string) {
    return this.byId.get(id);
  }

  /** Per frame: move each symbol its pixel offset from the true position and set the dash lengths. */
  setView(kmPerPx: number, on: boolean) {
    this.root.visible = on && this.items.length > 0;
    if (!this.root.visible) return;
    for (const g of this.points) {
      const p = g.obj.geometry.getAttribute("position") as THREE.BufferAttribute;
      g.items.forEach((it, i) => p.setXYZ(i, it.x + it.ox * kmPerPx, it.y - it.oy * kmPerPx, 0));
      p.needsUpdate = true;
    }
    this.dashed.material.dashSize = 8 * kmPerPx;
    this.dashed.material.gapSize = 5 * kmPerPx;
  }

  /** Line widths are in device pixels, like the plot's own batches. */
  resize(rw: number, rh: number, dpr: number) {
    for (const [b, px] of [[this.solid, 1.4], [this.dashed, 1.3], [this.selRing, 2.6]] as const) {
      b.setResolution(rw, rh);
      b.material.linewidth = px * dpr;
    }
  }

  get drawn() {
    return this.root.visible ? this.items.length : 0;
  }

  get drawnRings() {
    return this.root.visible ? this.solid.count / 160 + this.dashed.count / 160 + this.selRing.count / 160 : 0;
  }

  pick(sx: number, sy: number, toScreen: (x: number, y: number) => { x: number; y: number; z: number }, kmPerPx: number): OsintItem | null {
    if (!this.root.visible) return null;
    let best: OsintItem | null = null;
    let bestD = HIT_PX;
    for (const it of this.items) {
      const s = toScreen(it.x + it.ox * kmPerPx, it.y - it.oy * kmPerPx);
      if (s.z >= 1) continue;
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  dispose() {
    this.solid.dispose();
    this.dashed.dispose();
    this.selRing.dispose();
    this.root.traverse((o) => {
      const m = o as THREE.Points;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    for (const t of this.textures) t.dispose();
  }
}
