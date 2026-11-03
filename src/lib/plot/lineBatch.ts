// A reusable batch of screen-width line segments (three's fat lines). The plot
// refills a batch each frame for anything that follows moving tracks, so the
// buffers are allocated once and grown, never rebuilt per frame.
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export class LineBatch {
  readonly object: LineSegments2;
  readonly material: LineMaterial;
  private geometry: LineSegmentsGeometry;
  private pos = new Float32Array(0);
  private col = new Float32Array(0);
  private dist = new Float32Array(0);
  private posBuf: THREE.InstancedInterleavedBuffer | null = null;
  private colBuf: THREE.InstancedInterleavedBuffer | null = null;
  private distBuf: THREE.InstancedInterleavedBuffer | null = null;
  private n = 0;
  private run = 0; // running dash distance along the current polyline

  constructor(opts: { width: number; dashed?: boolean; opacity?: number; renderOrder?: number }) {
    this.geometry = new LineSegmentsGeometry();
    this.material = new LineMaterial({
      linewidth: opts.width,
      vertexColors: true,
      dashed: !!opts.dashed,
      dashSize: 1,
      gapSize: 1,
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new LineSegments2(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = opts.renderOrder ?? 10;
    this.grow(256);
  }

  private grow(cap: number) {
    const pos = new Float32Array(cap * 6);
    const col = new Float32Array(cap * 6);
    const dist = new Float32Array(cap * 2);
    pos.set(this.pos.subarray(0, this.n * 6));
    col.set(this.col.subarray(0, this.n * 6));
    dist.set(this.dist.subarray(0, this.n * 2));
    this.pos = pos;
    this.col = col;
    this.dist = dist;
    this.posBuf = new THREE.InstancedInterleavedBuffer(pos, 6, 1);
    this.posBuf.setUsage(THREE.DynamicDrawUsage);
    this.colBuf = new THREE.InstancedInterleavedBuffer(col, 6, 1);
    this.colBuf.setUsage(THREE.DynamicDrawUsage);
    this.distBuf = new THREE.InstancedInterleavedBuffer(dist, 2, 1);
    this.distBuf.setUsage(THREE.DynamicDrawUsage);
    const g = this.geometry;
    g.setAttribute("instanceStart", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 0));
    g.setAttribute("instanceEnd", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 3));
    g.setAttribute("instanceColorStart", new THREE.InterleavedBufferAttribute(this.colBuf, 3, 0));
    g.setAttribute("instanceColorEnd", new THREE.InterleavedBufferAttribute(this.colBuf, 3, 3));
    g.setAttribute("instanceDistanceStart", new THREE.InterleavedBufferAttribute(this.distBuf, 1, 0));
    g.setAttribute("instanceDistanceEnd", new THREE.InterleavedBufferAttribute(this.distBuf, 1, 1));
  }

  clear() {
    this.n = 0;
    this.run = 0;
  }

  get count() {
    return this.n;
  }

  /** Start a new dash run (each polyline dashes from its own start). */
  breakRun() {
    this.run = 0;
  }

  seg(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    c: THREE.Color, alpha = 1,
  ) {
    if (this.n * 6 + 6 > this.pos.length) this.grow(Math.max(256, this.pos.length / 3));
    const i = this.n * 6;
    const p = this.pos, q = this.col;
    p[i] = x1; p[i + 1] = y1; p[i + 2] = z1;
    p[i + 3] = x2; p[i + 4] = y2; p[i + 5] = z2;
    const r = c.r * alpha, g = c.g * alpha, b = c.b * alpha;
    q[i] = r; q[i + 1] = g; q[i + 2] = b;
    q[i + 3] = r; q[i + 4] = g; q[i + 5] = b;
    const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    this.dist[this.n * 2] = this.run;
    this.run += len;
    this.dist[this.n * 2 + 1] = this.run;
    this.n++;
  }

  polyline(pts: ArrayLike<number>, z: number, c: THREE.Color, alpha = 1, closed = false) {
    this.breakRun();
    const n = pts.length / 2;
    for (let i = 0; i < n - 1; i++) {
      this.seg(pts[i * 2], pts[i * 2 + 1], z, pts[i * 2 + 2], pts[i * 2 + 3], z, c, alpha);
    }
    if (closed && n > 2) {
      this.seg(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], z, pts[0], pts[1], z, c, alpha);
    }
  }

  circle(cx: number, cy: number, z: number, r: number, c: THREE.Color, alpha = 1, segments = 72) {
    this.breakRun();
    let px = cx, py = cy + r;
    for (let i = 1; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const nx = cx + Math.sin(a) * r, ny = cy + Math.cos(a) * r;
      this.seg(px, py, z, nx, ny, z, c, alpha);
      px = nx; py = ny;
    }
  }

  flush() {
    this.geometry.instanceCount = this.n;
    if (this.posBuf) {
      this.posBuf.needsUpdate = true;
      this.posBuf.updateRanges.length = 0;
      this.posBuf.addUpdateRange(0, this.n * 6);
    }
    if (this.colBuf) {
      this.colBuf.needsUpdate = true;
      this.colBuf.updateRanges.length = 0;
      this.colBuf.addUpdateRange(0, this.n * 6);
    }
    if (this.distBuf) {
      this.distBuf.needsUpdate = true;
      this.distBuf.updateRanges.length = 0;
      this.distBuf.addUpdateRange(0, this.n * 2);
    }
    this.object.visible = this.n > 0;
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
