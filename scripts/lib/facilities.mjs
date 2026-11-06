// Pure parsing/merge helpers for the facility pipeline (no network, no fs).

const R_EARTH_M = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversineM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(p, headingDeg, distM) {
  const d = distM / R_EARTH_M;
  const th = rad(headingDeg);
  const lat1 = rad(p.lat);
  const lng1 = rad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(th));
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 };
}

const round = (n, p = 5) => Math.round(n * 10 ** p) / 10 ** p;
const FT = 0.3048;

// --- CSV (RFC 4180 subset: quoted fields, doubled quotes, CRLF) ---

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function inBbox(p, bbox) {
  return p.lat >= bbox.south && p.lat <= bbox.north && p.lng >= bbox.west && p.lng <= bbox.east;
}

const num = (s) => (s === "" || s == null || Number.isNaN(Number(s)) ? null : Number(s));

export function normalizeSurface(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (/^(asp|bit|tarmac|pem)/.test(s)) return "asphalt";
  if (/^(con|cem)/.test(s)) return "concrete";
  if (/^(turf|gr[se]|gra|sod)/.test(s)) return "grass";
  if (/^(gvl|grvl|gravel|cor|coral|pierced|mats)/.test(s)) return "gravel";
  if (/^(san)/.test(s)) return "sand";
  if (/^(dirt|earth|ground|gnd|clay|unpaved|compacted|soil)/.test(s)) return "dirt";
  if (/^(wat)/.test(s)) return "water";
  if (/^paved/.test(s)) return "paved";
  return "unknown";
}

function runwayFromEnds(id, a, b, props) {
  const lengthM = Math.round(haversineM(a, b));
  const hdg = bearingDeg(a, b);
  return {
    id,
    lengthM: props.lengthM ?? lengthM,
    widthM: props.widthM ?? null,
    headingTrue: Math.round(hdg),
    surface: props.surface ?? "unknown",
    lighted: props.lighted ?? null,
    closed: props.closed ?? false,
    ends: [
      { ident: props.identA, lat: round(a.lat), lng: round(a.lng), headingTrue: Math.round(hdg) },
      { ident: props.identB, lat: round(b.lat), lng: round(b.lng), headingTrue: Math.round((hdg + 180) % 360) },
    ],
    derivedEnds: props.derivedEnds ?? false,
    source: props.source,
  };
}

// --- OurAirports ---

const OA_KEEP = new Set(["large_airport", "medium_airport", "small_airport", "heliport"]);

export function parseOurAirports(airportsCsv, runwaysCsv, bbox) {
  const airports = parseCsv(airportsCsv);
  const runways = parseCsv(runwaysCsv);
  const runwaysByRef = new Map();
  for (const r of runways) {
    if (!runwaysByRef.has(r.airport_ref)) runwaysByRef.set(r.airport_ref, []);
    runwaysByRef.get(r.airport_ref).push(r);
  }
  const out = [];
  for (const a of airports) {
    const lat = num(a.latitude_deg);
    const lng = num(a.longitude_deg);
    if (lat == null || lng == null || !inBbox({ lat, lng }, bbox)) continue;
    if (!OA_KEEP.has(a.type)) continue;
    const position = { lat: round(lat), lng: round(lng) };
    const rws = [];
    for (const r of runwaysByRef.get(a.id) ?? []) {
      if (/^H\d/i.test(r.le_ident) && !r.he_ident) continue; // helipad pads
      const leLat = num(r.le_latitude_deg);
      const leLng = num(r.le_longitude_deg);
      const heLat = num(r.he_latitude_deg);
      const heLng = num(r.he_longitude_deg);
      const lengthM = num(r.length_ft) != null ? Math.round(num(r.length_ft) * FT) : null;
      const widthM = num(r.width_ft) != null ? Math.round(num(r.width_ft) * FT) : null;
      const props = {
        lengthM,
        widthM,
        surface: normalizeSurface(r.surface),
        lighted: r.lighted === "1",
        closed: r.closed === "1",
        identA: r.le_ident,
        identB: r.he_ident,
        source: { source: "ourairports", id: r.id },
      };
      const id = [r.le_ident, r.he_ident].filter(Boolean).join("/");
      if (leLat != null && leLng != null && heLat != null && heLng != null) {
        rws.push(runwayFromEnds(id, { lat: leLat, lng: leLng }, { lat: heLat, lng: heLng }, props));
        continue;
      }
      // Ends missing: derive from the airfield reference point, heading and length.
      let hdg = num(r.le_heading_degT);
      if (hdg == null) {
        const m = /^(\d{1,2})[LRC]?$/.exec(r.le_ident);
        if (m) hdg = Number(m[1]) * 10;
      }
      if (hdg != null && lengthM) {
        const a1 = destinationPoint(position, (hdg + 180) % 360, lengthM / 2);
        const b1 = destinationPoint(position, hdg, lengthM / 2);
        rws.push(runwayFromEnds(id, a1, b1, { ...props, derivedEnds: true }));
      }
    }
    out.push({
      key: `ourairports:${a.id}`,
      ident: a.ident,
      name: a.name,
      kind: "airbase",
      airportType: a.type,
      position,
      elevationFt: num(a.elevation_ft),
      icao: a.icao_code || (/^[A-Z]{4}$/.test(a.ident) ? a.ident : a.gps_code || null) || null,
      iata: a.iata_code || null,
      country: a.iso_country,
      municipality: a.municipality || null,
      scheduledService: a.scheduled_service === "yes",
      runways: rws,
      sources: [{ source: "ourairports", id: a.id, ident: a.ident }],
    });
  }
  return out;
}

// --- OpenStreetMap / Overpass ---

const MIL_AIR_NAME = /\b(air\s?base|airbase|air\s?force|afb|raf|naval air|military|army|iriaf|irgc|nezaja|navy|air station)\b/i;

function osmName(tags) {
  return tags["name:en"] || tags.int_name || tags.name || tags["name:ar"] || tags["name:fa"] || null;
}

function osmId(el) {
  return `${el.type}/${el.id}`;
}

function ringFromGeometry(geom) {
  if (!geom || geom.length < 2) return null;
  return geom.map((p) => ({ lat: p.lat, lng: p.lon }));
}

function chainRings(ways) {
  // Join outer member ways end-to-end into closed rings (best effort).
  const pool = ways.filter((w) => w && w.length >= 2).map((w) => w.slice());
  const rings = [];
  const eq = (a, b) => a.lat === b.lat && a.lng === b.lng;
  while (pool.length) {
    let ring = pool.pop();
    let grew = true;
    while (grew && !eq(ring[0], ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        if (eq(ring[ring.length - 1], w[0])) ring = ring.concat(w.slice(1));
        else if (eq(ring[ring.length - 1], w[w.length - 1])) ring = ring.concat(w.slice(0, -1).reverse());
        else if (eq(ring[0], w[w.length - 1])) ring = w.slice(0, -1).concat(ring);
        else if (eq(ring[0], w[0])) ring = w.slice(1).reverse().concat(ring);
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4 && eq(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

export function ringAreaM2(ring) {
  if (!ring || ring.length < 4) return 0;
  const lat0 = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const kx = Math.cos(rad(lat0)) * 111320;
  const ky = 110574;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i].lng * kx * ring[i + 1].lat * ky - ring[i + 1].lng * kx * ring[i].lat * ky;
  }
  return Math.abs(a / 2);
}

export function ringCentroid(ring) {
  const pts = ring.slice(0, ring.length > 3 && ring[0].lat === ring[ring.length - 1].lat ? -1 : undefined);
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat, lng };
}

function simplifyRing(ring, tolM = 15, maxPts = 60) {
  // Douglas-Peucker in a local equirectangular frame.
  const lat0 = ring[0].lat;
  const kx = Math.cos(rad(lat0)) * 111320;
  const ky = 110574;
  const pts = ring.map((p) => ({ x: p.lng * kx, y: p.lat * ky, p }));
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const perp = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const rec = (i, j, tol) => {
    let max = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = perp(pts[k], pts[i], pts[j]);
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (idx !== -1 && max > tol) {
      keep[idx] = true;
      rec(i, idx, tol);
      rec(idx, j, tol);
    }
  };
  let tol = tolM;
  let res = ring;
  for (let n = 0; n < 8; n++) {
    keep.fill(false);
    keep[0] = keep[pts.length - 1] = true;
    rec(0, pts.length - 1, tol);
    res = pts.filter((_, i) => keep[i]).map((q) => q.p);
    if (res.length <= maxPts) break;
    tol *= 2;
  }
  return res.map((p) => [round(p.lng), round(p.lat)]);
}

function geometryOf(el) {
  // Returns { center, polygon (lng/lat ring) | null, line (points) | null }
  if (el.type === "node") return { center: { lat: el.lat, lng: el.lon }, polygon: null, line: null };
  if (el.type === "way") {
    const pts = ringFromGeometry(el.geometry);
    if (!pts) return { center: el.center ? { lat: el.center.lat, lng: el.center.lon } : null, polygon: null, line: null };
    const closed = pts.length >= 4 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lng === pts[pts.length - 1].lng;
    return closed
      ? { center: ringCentroid(pts), polygon: pts, line: null }
      : { center: { lat: (pts[0].lat + pts[pts.length - 1].lat) / 2, lng: (pts[0].lng + pts[pts.length - 1].lng) / 2 }, polygon: null, line: pts };
  }
  if (el.type === "relation") {
    const outers = (el.members ?? []).filter((m) => m.type === "way" && m.role !== "inner").map((m) => ringFromGeometry(m.geometry));
    const rings = chainRings(outers).sort((a, b) => ringAreaM2(b) - ringAreaM2(a));
    const poly = rings[0] ?? null;
    const center = poly ? ringCentroid(poly) : el.center ? { lat: el.center.lat, lng: el.center.lon } : null;
    return { center, polygon: poly, line: null };
  }
  return { center: null, polygon: null, line: null };
}

function lifecycleDead(tags) {
  return Object.keys(tags).some((k) => /^(disused|abandoned|demolished|razed|was):/.test(k)) || tags.disused === "yes" || tags.abandoned === "yes";
}

export function parseOsmRunways(elements) {
  const out = [];
  for (const el of elements) {
    if (el.type !== "way" || el.tags?.aeroway !== "runway" || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags;
    const pts = ringFromGeometry(el.geometry);
    const a = pts[0];
    const b = pts[pts.length - 1];
    const [identA, identB] = String(t.ref ?? "").split("/").map((s) => s.trim());
    const width = num(String(t.width ?? "").replace(/[^0-9.]/g, ""));
    out.push({
      osmId: osmId(el),
      center: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
      runway: runwayFromEnds(t.ref || "", a, b, {
        widthM: width,
        surface: normalizeSurface(t.surface),
        lighted: t.lit === "yes" ? true : t.lit === "no" ? false : null,
        closed: !!(t.access === "no" || t.disused === "yes"),
        identA: identA || "",
        identB: identB || "",
        source: { source: "osm", id: osmId(el) },
      }),
    });
  }
  return out;
}

const MIL_AREA_KINDS = new Set(["base", "range", "danger_area", "barracks", "training_area", "airfield", "naval_base"]);

export function parseOsmFacilities(elements) {
  const out = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (!Object.keys(t).length || lifecycleDead(t)) continue;
    const g = geometryOf(el);
    if (!g.center) continue;
    const name = osmName(t);
    const sources = [{ source: "osm", id: osmId(el) }];
    const common = {
      name,
      nameLocal: t.name && t.name !== name ? t.name : null,
      position: { lat: round(g.center.lat), lng: round(g.center.lon ?? g.center.lng) },
      polygon: g.polygon ? simplifyRing(g.polygon) : null,
      areaM2: g.polygon ? Math.round(ringAreaM2(g.polygon)) : null,
      sources,
    };
    if (t.aeroway === "aerodrome" || t.military === "airfield") {
      const mil = t.military === "airfield" || MIL_AIR_NAME.test(`${t.name ?? ""} ${t["name:en"] ?? ""} ${t.operator ?? ""}`);
      out.push({
        ...common,
        key: `osm:${osmId(el)}`,
        kind: "airbase",
        isMilitary: mil,
        icao: t.icao || null,
        iata: t.iata || null,
        osmAerodromeType: t["aerodrome:type"] || null,
        runways: [],
      });
    } else if (t.military === "naval_base") {
      out.push({ ...common, key: `osm:${osmId(el)}`, kind: "naval_base", isMilitary: true });
    } else if (t.landuse === "port" || t.industrial === "port" || t.harbour === "yes" || t.amenity === "ferry_terminal" && name) {
      if (!name) continue;
      out.push({ ...common, key: `osm:${osmId(el)}`, kind: "port", isMilitary: false });
    } else if (MIL_AREA_KINDS.has(t.military)) {
      out.push({ ...common, key: `osm:${osmId(el)}`, kind: "military_area", areaType: t.military, isMilitary: true });
    }
  }
  return out;
}

// --- Merge ---

const tokens = (s) =>
  new Set(
    String(s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(air|airport|airfield|base|international|intl|the|and|military|field)$/.test(w)),
  );

function sharesToken(a, b) {
  const ta = tokens(a);
  for (const w of tokens(b)) if (ta.has(w)) return true;
  return false;
}

function sameAerodrome(oa, osm) {
  const codes = [oa.icao, oa.ident, oa.iata].filter(Boolean);
  const osmCodes = [osm.icao, osm.iata].filter(Boolean);
  if (codes.some((c) => osmCodes.includes(c))) return true;
  const d = haversineM(oa.position, osm.position);
  if (d < 1200) return true;
  return d < 4000 && sharesToken(oa.name, osm.name);
}

function dedupeRunways(list) {
  // Same strip = ends within 250 m of each other (either orientation).
  const out = [];
  for (const rw of list) {
    const dup = out.find((o) => {
      const [a, b] = o.ends;
      const [c, d] = rw.ends;
      const same = haversineM(a, c) < 250 && haversineM(b, d) < 250;
      const flip = haversineM(a, d) < 250 && haversineM(b, c) < 250;
      return same || flip;
    });
    if (!dup) out.push(rw);
  }
  return out;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function mergeFacilities({ ourairports, osmFacilities, osmRunways, runwayAttachM = 4000 }) {
  const airbases = ourairports.map((a) => ({ ...a, isMilitary: false, polygon: null, areaM2: null }));
  const osmAerodromes = osmFacilities.filter((f) => f.kind === "airbase");
  const others = osmFacilities.filter((f) => f.kind !== "airbase");
  const merged = [...airbases];

  for (const osm of osmAerodromes) {
    const match = airbases
      .filter((a) => sameAerodrome(a, osm))
      .sort((a, b) => haversineM(a.position, osm.position) - haversineM(b.position, osm.position))[0];
    if (match) {
      match.sources.push(...osm.sources);
      match.polygon = match.polygon ?? osm.polygon;
      match.areaM2 = match.areaM2 ?? osm.areaM2;
      match.isMilitary = match.isMilitary || osm.isMilitary;
      match.nameLocal = match.nameLocal ?? osm.nameLocal ?? (osm.name && osm.name !== match.name ? osm.name : null);
      match.icao = match.icao ?? osm.icao;
      match.iata = match.iata ?? osm.iata;
    } else {
      merged.push({ ...osm, runways: [] });
    }
  }

  // Attach OSM runway geometry: to the nearest aerodrome within range; add only where OurAirports lacks that strip.
  const airMerged = merged.filter((f) => f.kind === "airbase");
  const osmRunwayCount = { attached: 0, orphans: 0 };
  for (const r of osmRunways) {
    let best = null;
    let bestD = Infinity;
    for (const f of airMerged) {
      const inside = f.polygon && pointInRing(r.center, f.polygon);
      const d = inside ? 0 : haversineM(f.position, r.center);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (best && bestD <= runwayAttachM) {
      best.runways = dedupeRunways([...best.runways, r.runway]);
      if (!best.sources.some((s) => s.id === r.osmId)) best.sources.push({ source: "osm", id: r.osmId, role: "runway" });
      osmRunwayCount.attached++;
    } else osmRunwayCount.orphans++;
  }

  for (const o of others) merged.push(o);

  // A military area that is the polygon of a base we already hold as airbase/naval_base duplicates it.
  const final = [];
  for (const f of merged) {
    if (f.kind === "military_area" && (f.areaType === "airfield" || f.areaType === "naval_base")) {
      const twin = merged.find((g) => g !== f && (g.kind === "airbase" || g.kind === "naval_base") && haversineM(g.position, f.position) < 3000);
      if (twin) continue;
    }
    final.push(f);
  }

  // Airbase classification
  for (const f of final) {
    if (f.kind !== "airbase") continue;
    if (!f.isMilitary) f.isMilitary = MIL_AIR_NAME.test(f.name ?? "");
    f.use = f.isMilitary ? "military" : "civil";
    f.runways.sort((a, b) => (b.lengthM ?? 0) - (a.lengthM ?? 0));
  }

  // Stable ids
  const used = new Set();
  for (const f of final) {
    let base;
    if (f.kind === "airbase") base = f.icao || f.ident ? `apt-${slug(f.icao || f.ident)}` : `apt-${slug(f.sources[0].id)}`;
    else base = `${f.kind === "naval_base" ? "nav" : f.kind === "port" ? "port" : "mil"}-${slug(f.sources[0].id)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    f.id = id;
    f.name = f.name || (f.kind === "airbase" ? f.icao || "Unnamed airfield" : f.kind === "naval_base" ? "Unnamed naval base" : f.kind === "port" ? "Unnamed port" : `Unnamed ${f.areaType ?? "military"} area`);
    delete f.key;
    delete f.ident;
    if (f.kind !== "airbase") {
      delete f.runways;
    }
  }

  final.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return { facilities: final, osmRunwayCount };
}

export function pointInRing(p, ring) {
  // ring: [{lat,lng}] or [[lng,lat]]
  const pts = ring.map((q) => (Array.isArray(q) ? { lng: q[0], lat: q[1] } : q));
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lng;
    const yi = pts[i].lat;
    const xj = pts[j].lng;
    const yj = pts[j].lat;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function buildOverpassQueries(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const head = "[out:json][timeout:180];";
  return {
    aerodromes: `${head}(nwr["aeroway"="aerodrome"](${b});nwr["military"="airfield"](${b}););out tags geom;`,
    runways: `${head}way["aeroway"="runway"](${b});out tags geom;`,
    naval: `${head}nwr["military"="naval_base"](${b});out tags geom;`,
    ports: `${head}(nwr["landuse"="port"](${b});nwr["industrial"="port"](${b});nwr["harbour"="yes"]["name"](${b}););out tags geom;`,
    military: `${head}nwr["military"~"^(base|range|danger_area|barracks|training_area)$"](${b});out tags geom;`,
  };
}
