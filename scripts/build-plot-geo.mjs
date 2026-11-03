#!/usr/bin/env node
// Builds src/lib/plot/data/hormuz-geo.json, the small vendored theater file the
// Three.js plot draws. Inputs (download first, see NOTES):
//   Natural Earth 10m GeoJSON (public domain): ne_10m_land, ne_10m_coastline, ne_10m_minor_islands,
//   ne_10m_bathymetry_{K_200,J_1000,I_2000,H_3000}, ne_10m_admin_0_boundary_lines_land
//   NOAA ETOPO1 (public domain) via ERDDAP griddap etopo180, stride 6 (0.1 deg)
// Usage: node scripts/build-plot-geo.mjs /path/to/downloads

import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: build-plot-geo.mjs <download dir>");
  process.exit(1);
}

const BBOX = [51.5, 22.5, 61.5, 30.0]; // minLng, minLat, maxLng, maxLat
const TOL = 0.004; // degrees, about 400 m

const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const r3 = (v) => Math.round(v * 1000) / 1000;

function clipRing(ring) {
  // Sutherland-Hodgman against the four bbox edges
  const edges = [
    (p) => p[0] >= BBOX[0], (p) => p[0] <= BBOX[2],
    (p) => p[1] >= BBOX[1], (p) => p[1] <= BBOX[3],
  ];
  const cut = [
    (a, b) => { const t = (BBOX[0] - a[0]) / (b[0] - a[0]); return [BBOX[0], a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (BBOX[2] - a[0]) / (b[0] - a[0]); return [BBOX[2], a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (BBOX[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BBOX[1]]; },
    (a, b) => { const t = (BBOX[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BBOX[3]]; },
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) {
        if (!pi) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (pi) {
        out.push(cut[e](prev, cur));
      }
    }
    if (out.length === 0) return [];
  }
  return out;
}

function clipLine(line) {
  const inside = (p) => p[0] >= BBOX[0] && p[0] <= BBOX[2] && p[1] >= BBOX[1] && p[1] <= BBOX[3];
  const parts = [];
  let cur = [];
  for (const p of line) {
    if (inside(p)) cur.push(p);
    else if (cur.length) { parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  return parts.filter((p) => p.length > 1);
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function ringArea(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function polygonsOf(fc) {
  const out = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) {
      const rings = [];
      for (const ring of poly) {
        const clipped = simplify(clipRing(ring.slice(0, -1)), TOL);
        if (clipped.length >= 3 && Math.abs(ringArea(clipped)) > 1e-5) rings.push(clipped.map((p) => [r3(p[0]), r3(p[1])]));
      }
      if (rings.length) out.push(rings);
    }
  }
  return out;
}

function linesOf(fc) {
  const out = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const l of lines) {
      for (const part of clipLine(l)) {
        const s = simplify(part, TOL);
        if (s.length > 1) out.push(s.map((p) => [r3(p[0]), r3(p[1])]));
      }
    }
  }
  return out;
}

const land = [...polygonsOf(read("ne_10m_land.geojson")), ...polygonsOf(read("ne_10m_minor_islands.geojson"))];
const depth = {};
for (const [key, file] of [["200", "K_200"], ["1000", "J_1000"], ["2000", "I_2000"], ["3000", "H_3000"]]) {
  depth[key] = polygonsOf(read(`ne_10m_bathymetry_${file}.geojson`));
}
const borders = linesOf(read("ne_10m_admin_0_boundary_lines_land.geojson"));
const coast = linesOf(read("ne_10m_coastline.geojson"));
// minor islands have no coastline lines of their own; use their rings
for (const poly of polygonsOf(read("ne_10m_minor_islands.geojson"))) coast.push([...poly[0], poly[0][0]]);

// ETOPO1 grid, rows [lat, lng, alt]
const etopo = read("etopo.json").table.rows;
const lats = [...new Set(etopo.map((r) => r3(r[0])))].sort((a, b) => a - b);
const lngs = [...new Set(etopo.map((r) => r3(r[1])))].sort((a, b) => a - b);
const elev = new Array(lats.length * lngs.length).fill(0);
for (const [la, ln, alt] of etopo) {
  const i = lats.indexOf(r3(la)), j = lngs.indexOf(r3(ln));
  elev[i * lngs.length + j] = Math.round(alt);
}

const out = {
  sources: {
    vectors: "Natural Earth 10m (public domain), naturalearthdata.com",
    relief: "NOAA ETOPO1 1 arc-minute global relief (public domain), sampled every 0.1 deg",
  },
  bbox: BBOX,
  land,
  coast,
  depth,
  borders,
  relief: {
    lat0: lats[0], lng0: lngs[0], step: r3(lats[1] - lats[0]),
    rows: lats.length, cols: lngs.length, elev,
  },
};

const target = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "src/lib/plot/data/hormuz-geo.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log(`wrote ${target}: ${fs.statSync(target).size} bytes, land ${land.length}, ` +
  Object.entries(depth).map(([k, v]) => `d${k} ${v.length}`).join(", ") +
  `, coast ${coast.length}, borders ${borders.length}, relief ${lats.length}x${lngs.length}`);
