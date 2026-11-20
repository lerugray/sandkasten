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

function csvField(v) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(header, rows) {
  return [header.join(","), ...rows.map((r) => header.map((h) => csvField(String(r[h] ?? ""))).join(","))].join("\n") + "\n";
}

/** Keep only what parseOurAirports can use: airports in the bbox of a kept type, and their runways. */
export function slimOurAirports(airportsCsv, runwaysCsv, bbox) {
  const aRows = parseCsv(airportsCsv);
  const rRows = parseCsv(runwaysCsv);
  const aHead = airportsCsv.slice(0, airportsCsv.indexOf("\n")).replace(/\r$/, "").split(",").map((h) => h.replace(/^"|"$/g, ""));
  const rHead = runwaysCsv.slice(0, runwaysCsv.indexOf("\n")).replace(/\r$/, "").split(",").map((h) => h.replace(/^"|"$/g, ""));
  const keep = aRows.filter((a) => OA_KEEP.has(a.type) && inBbox({ lat: num(a.latitude_deg), lng: num(a.longitude_deg) }, bbox));
  const ids = new Set(keep.map((a) => a.id));
  return { airports: toCsv(aHead, keep), runways: toCsv(rHead, rRows.filter((r) => ids.has(r.airport_ref))) };
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

const circDist = (x, y) => {
  const d = Math.abs(((x - y) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
};

function parseDesignator(raw) {
  const m = /^\s*(\d{1,2})\s*([LRC]?)\s*$/i.exec(String(raw ?? ""));
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 36) return null;
  return { text: `${String(n).padStart(2, "0")}${m[2].toUpperCase()}`, n, letter: m[2].toUpperCase() };
}

const FLIP = { L: "R", R: "L", C: "C", "": "" };

function designatorFor(headingDeg, letter = "") {
  const n = Math.round(headingDeg / 10) % 36 || 36;
  return { text: `${String(n).padStart(2, "0")}${letter}`, n, letter };
}

/** Pair of designators for a strip; a lone designator implies its reciprocal. Null when nothing parses. */
export function designatorPair(identA, identB) {
  const a = parseDesignator(identA);
  const b = parseDesignator(identB);
  if (a && b) return [a, b];
  const one = a ?? b;
  if (!one) return null;
  const recip = designatorFor(((one.n * 10 + 180) % 360) || 360, FLIP[one.letter]);
  return [one, recip];
}

/**
 * Designators are assigned from true bearing, never from vertex or column order: runway N is the one a pilot
 * lines up on heading ~N*10 deg from that threshold. Ends come back in ascending designator order, so the
 * result is the same whichever way the strip was digitised.
 */
function runwayFromEnds(id, a, b, props) {
  const lengthM = Math.round(haversineM(a, b));
  const hdgAB = bearingDeg(a, b);
  const hdgBA = (hdgAB + 180) % 360;
  const tokens = [props.identA, props.identB].flatMap((x) => String(x ?? "").split(/[/;,-]/)).map((x) => x.trim()).filter(Boolean);
  let identA = tokens[0] ?? "";
  let identB = tokens[1] ?? "";
  const pair = designatorPair(identA, identB);
  if (pair) {
    const [p, q] = pair;
    const straight = circDist(p.n * 10, hdgAB) + circDist(q.n * 10, hdgBA);
    const swapped = circDist(q.n * 10, hdgAB) + circDist(p.n * 10, hdgBA);
    [identA, identB] = straight <= swapped ? [p.text, q.text] : [q.text, p.text];
  } else if (!identA && !identB && !props.construction) {
    identA = designatorFor(hdgAB).text;
    identB = designatorFor(hdgBA).text;
  }
  let ends = [
    { ident: identA, lat: round(a.lat), lng: round(a.lng), headingTrue: Math.round(hdgAB) % 360 },
    { ident: identB, lat: round(b.lat), lng: round(b.lng), headingTrue: Math.round(hdgBA) % 360 },
  ];
  const key = (e) => parseDesignator(e.ident)?.n ?? (e.headingTrue < 180 ? e.headingTrue / 10 : 100 + e.headingTrue);
  if (key(ends[1]) < key(ends[0]) || (key(ends[1]) === key(ends[0]) && ends[1].ident < ends[0].ident)) ends = [ends[1], ends[0]];
  const ident = ends.map((e) => e.ident).filter(Boolean).join("/");
  return {
    id: ident || id,
    lengthM: props.lengthM ?? lengthM,
    widthM: props.widthM ?? null,
    headingTrue: ends[0].headingTrue,
    surface: props.surface ?? "unknown",
    lighted: props.lighted ?? null,
    closed: props.closed ?? false,
    ...(props.construction ? { construction: true } : {}),
    ...(props.lengthUnverified ? { lengthUnverified: true } : {}),
    ends,
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
    // construction=yes: an unfinished strip. It stays closed, takes no designator it was not given, and no chart record attaches to it.
    const construction = !!t.construction && t.construction !== "no";
    const tagLen = parseFloat(String(t.length ?? ""));
    const rough = /fixme|rough|sketch/i.test(`${t.note ?? ""} ${t.fixme ?? ""}`);
    out.push({
      osmId: osmId(el),
      center: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
      runway: runwayFromEnds(t.ref || osmId(el), a, b, {
        construction,
        widthM: width,
        surface: normalizeSurface(t.surface),
        lighted: t.lit === "yes" ? true : t.lit === "no" ? false : null,
        closed: construction || !!(t.access === "no" || t.disused === "yes"),
        identA: identA || "",
        identB: identB || "",
        source: { source: "osm", id: osmId(el) },
      }),
    });
    // read by mergeStrip only; the merged runway is rebuilt without it
    out[out.length - 1].runway._claims = { tagLengthM: tagLen > 0 ? tagLen : null, rough };
  }
  return out;
}

const MIL_AREA_KINDS = new Set(["base", "range", "danger_area", "barracks", "training_area", "airfield", "naval_base"]);

export const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// OSM names written only in Persian/Arabic script get a plain English description from their type words; the original
// stays in nameLocal. Order matters: the first matching rule wins.
const ENGLISH_BY_WORD = [
  [/سمپاشی/, "Crop-spraying airstrip"],
  [/پایگاه هوایی|هوافضا/, "Air base"],
  [/فرودگاه|ميناء رأس|فرودگاه/, "Airfield"],
  [/دریابانی/, "Coast guard base"],
  [/اسکله صیادی/, "Fishing pier"],
  [/ميناء|بندر/, "Port"],
  [/بسیج/, "Basij post"],
  [/پاسگاه انتظامی/, "Police post"],
  [/مرزبانی/, "Border guard command"],
  [/میدان تیر/, "Firing range"],
  [/پدآفندی/, "Air defence base"],
  [/مرکز آموزش|معهد/, "Training centre"],
  [/پادگان|تیپ/, "Barracks"],
  [/سپاه/, "IRGC facility"],
  [/دادگستری/, "Government compound"],
];

// OSM objects whose only name is a bare type word ("Naval base"): the real, public name of the place.
const CURATED_NAMES = { "way/176976419": "Qeshm Naval Base" };

// Applied after the merge so a place name cannot pull an unrelated aerodrome (here Kish Island's military field, 2.4 km from Kish Intl) into another record.
const LOCATED_NAMES = {
  "node/8625983990": "Kish Island Air Base",
  "way/1368796748": "Larestan IRGC Aerospace Base",
  "node/5759688563": "Kangan Coast Guard Base",
  "node/5854812099": "Kangan Coast Guard Base",
};

// A bare type word is not a name: whatever still carries one gets the nearest named airfield, base or port as a locator.
const GENERIC_NAMES = new Set(["Air base", "Airfield", "Coast guard base", "Naval base", "Military Helipad", "Air defence base", "Border guard command"]);

export function englishFallbackName(name, kind, areaType) {
  for (const [re, en] of ENGLISH_BY_WORD) if (re.test(name)) return en;
  if (kind === "airbase") return "Airstrip";
  if (kind === "naval_base") return "Naval base";
  if (kind === "port") return "Port";
  return areaType === "range" ? "Military range" : areaType === "barracks" ? "Barracks" : areaType === "training_area" ? "Training area" : "Military base";
}

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
  for (const f of out) {
    const curated = CURATED_NAMES[f.sources[0].id];
    if (curated) {
      f.nameLocal = f.nameLocal ?? (f.name !== curated ? f.name : null);
      f.name = curated;
    }
    if (f.name && ARABIC_SCRIPT.test(f.name)) {
      f.nameLocal = f.nameLocal ?? f.name;
      f.name = englishFallbackName(f.name, f.kind, f.areaType);
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

const STRIP_ACROSS_M = 60;
const STRIP_GAP_M = 120;

function frame(o) {
  const a0 = o.ends[0];
  const kx = Math.cos(rad(a0.lat)) * 111320;
  const ky = 110574;
  const P = (e) => ({ x: (e.lng - a0.lng) * kx, y: (e.lat - a0.lat) * ky });
  const a = P(o.ends[0]);
  const b = P(o.ends[1]);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return {
    len,
    P,
    along: (q) => (q.x - a.x) * ux + (q.y - a.y) * uy,
    across: (q) => Math.abs(-(q.x - a.x) * uy + (q.y - a.y) * ux),
  };
}

function midpoint(o) {
  return { lat: (o.ends[0].lat + o.ends[1].lat) / 2, lng: (o.ends[0].lng + o.ends[1].lng) / 2 };
}

/** Same designators (letters not in conflict), same heading, midpoints within 1.5 km: two records that name one runway, wherever the centrelines lie. */
function samePairLoose(o, rw) {
  const key = (r) => r.ends.map((e) => parseDesignator(e.ident)).filter(Boolean);
  const x = key(o);
  const y = key(rw);
  if (x.length !== 2 || y.length !== 2) return false;
  for (let i = 0; i < 2; i++) {
    if (x[i].n !== y[i].n) return false;
    if (x[i].letter && y[i].letter && x[i].letter !== y[i].letter) return false;
  }
  return circDist(o.ends[0].headingTrue, rw.ends[0].headingTrue) <= 12 && haversineM(midpoint(o), midpoint(rw)) <= 1500;
}

/** Two surveyed records are one strip only when their centrelines are within a strip width: parallel strips with the same number stay two (Fujairah, Chabahar). */
function samePair(o, rw) {
  return samePairLoose(o, rw) && frame(o).across(frame(o).P(midpoint(rw))) <= STRIP_ACROSS_M;
}

/** Same physical strip: collinear with it and overlapping or within a short gap (segments, displaced thresholds). */
function sameStrip(o, rw) {
  if (samePair(o, rw)) return true;
  const f = frame(o);
  const c = f.P(rw.ends[0]);
  const d = f.P(rw.ends[1]);
  if (Math.max(f.across(c), f.across(d)) > STRIP_ACROSS_M) return false;
  const lo = Math.min(f.along(c), f.along(d));
  const hi = Math.max(f.along(c), f.along(d));
  return Math.max(0, lo - f.len, -hi) <= STRIP_GAP_M;
}

const sourceKey = (rw) => `${rw.source.source}:${rw.source.id}`;

const within10 = (x, y) => Math.abs(x - y) <= 0.1 * Math.max(x, y);

/**
 * Drawn geometry and the length shown are separate things. The geometry (ends) is always the surveyed strip; the length
 * is the one value the sources support, decided by agreement, not by "geometry wins":
 *  - chart length agrees with the drawn extent, or with the OSM `length` tag: the chart length (Arzanah, Khasab, Jiroft);
 *  - the OSM tag agrees with the chart's own end coordinates, though not its length field: the tag (Umm Al-Shokhot);
 *  - the OSM tag agrees with the drawn extent (and the extent is not marked FIXME / rough sketch): the extent (Lavan, Suweihan);
 *  - nothing agrees: the chart length, flagged unverified, since it matches the chart's own end coordinates and the
 *    drawn extent may include displaced-threshold segments (Zirku, Sir Bani Yas).
 * Returns lengthM null where the drawn extent stands.
 */
function resolveLength(osm, oa, drawnM) {
  if (!oa.length) return { lengthM: null };
  const chart = oa[0].lengthM ?? null;
  const span = oa[0].derivedEnds ? null : haversineM(oa[0].ends[0], oa[0].ends[1]);
  const claims = osm.map((m) => m._claims).filter(Boolean);
  const tag = claims.map((c) => c.tagLengthM).find((v) => v != null) ?? null;
  const rough = claims.some((c) => c.rough);
  if (!osm.length || chart == null) return { lengthM: chart };
  if (!rough && within10(chart, drawnM)) return { lengthM: chart };
  if (tag != null && within10(chart, tag)) return { lengthM: chart };
  if (tag != null && span != null && within10(tag, span)) return { lengthM: Math.round(tag) };
  if (tag != null && !rough && within10(tag, drawnM)) return { lengthM: null };
  return { lengthM: chart, unverified: true };
}

function mergeStrip(members) {
  const osm = members.filter((m) => m.source.source === "osm");
  const oa = members.filter((m) => m.source.source !== "osm").sort((x, y) => y.lengthM - x.lengthM || sourceKey(x).localeCompare(sourceKey(y)));
  const byLen = (x, y) => y.lengthM - x.lengthM || sourceKey(x).localeCompare(sourceKey(y));
  osm.sort(byLen);
  // OSM geometry wins (extent of all its segments along the longest one); OurAirports metadata is merged in.
  let a;
  let b;
  if (osm.length) {
    const f = frame(osm[0]);
    let lo = null;
    let hi = null;
    for (const m of osm)
      for (const e of m.ends) {
        const t = f.along(f.P(e));
        if (!lo || t < lo.t) lo = { t, e };
        if (!hi || t > hi.t) hi = { t, e };
      }
    a = lo.e;
    b = hi.e;
  } else {
    a = oa[0].ends[0];
    b = oa[0].ends[1];
  }
  const withRef = [...osm, ...oa].find((m) => m.ends.some((e) => e.ident));
  const first = (key, bad) => [...osm, ...oa].map((m) => m[key]).find((v) => v != null && v !== bad);
  const primary = osm[0] ?? oa[0];
  const sources = [...osm, ...oa].map((m) => m.source);
  const len = resolveLength(osm, oa, haversineM(a, b));
  const rw = runwayFromEnds(primary.id, a, b, {
    identA: withRef?.ends[0].ident,
    identB: withRef?.ends[1].ident,
    widthM: first("widthM"),
    surface: first("surface", "unknown") ?? "unknown",
    lighted: first("lighted"),
    closed: members.some((m) => m.closed),
    construction: members.some((m) => m.construction),
    ...(len.lengthM != null ? { lengthM: len.lengthM } : {}),
    lengthUnverified: len.unverified,
    derivedEnds: !osm.length && oa[0].derivedEnds,
    source: primary.source,
  });
  if (sources.length > 1) rw.sources = sources;
  return rw;
}

/** Two records name different physical strips when the same number carries different letters (16L against 16R). */
function lettersConflict(o, rw) {
  const x = o.ends.map((e) => parseDesignator(e.ident));
  const y = rw.ends.map((e) => parseDesignator(e.ident));
  for (let i = 0; i < 2; i++) if (x[i] && y[i] && x[i].n === y[i].n && x[i].letter && y[i].letter && x[i].letter !== y[i].letter) return true;
  return false;
}

/** Union-find over `sameStrip`, nearest pair first; a join that would put two letter-conflicting records (16L, 16R) in one group is refused. */
function groupStrips(list) {
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (sameStrip(list[i], list[j]) || sameStrip(list[j], list[i])) {
        const [a, b] = [sourceKey(list[i]), sourceKey(list[j])].sort();
        pairs.push({ i, j, d: Math.round(haversineM(midpoint(list[i]), midpoint(list[j]))), k: `${a}|${b}` });
      }
  pairs.sort((p, q) => p.d - q.d || p.k.localeCompare(q.k));
  const members = (root) => list.filter((_, i) => find(i) === root);
  for (const { i, j } of pairs) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) continue;
    const mi = members(ri);
    const mj = members(rj);
    if (mi.some((a) => mj.some((b) => lettersConflict(a, b)))) continue;
    parent[rj] = ri;
  }
  const groups = new Map();
  list.forEach((rw, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(rw);
  });
  return [...groups.values()];
}

/** How far the chart record's midpoint lies from the strip's centreline (longest surveyed member), in whole metres. */
function acrossStrip(strip, oa) {
  const longest = [...strip].sort((x, y) => y.lengthM - x.lengthM || sourceKey(x).localeCompare(sourceKey(y)))[0];
  const f = frame(longest);
  return Math.round(f.across(f.P(midpoint(oa))));
}

/**
 * One runway per physical strip, independent of input order, in two steps.
 *  1. PHYSICAL STRIPS come from surveyed (OSM) geometry alone: segments of one strip join, parallel strips stay apart, an
 *     unfinished (construction) strip is its own strip and nothing joins it.
 *  2. CHART RECORDS (OurAirports) are then ATTACHED to the best-matching physical strip and never create one while a
 *     surveyed strip matches them (same numbers, letters not in conflict, same heading, within 1.5 km, however far the
 *     chart is displaced across). Several matches: the strip whose designators are identical, then the nearest centreline
 *     (so an unlettered 09/27 between 09L/27R and 09R/27L joins the nearer one), then the longer strip, then the lower id.
 *     A chart record that matches no surveyed strip, or conflicts with the chart records already on it, is a strip of its own.
 */
function reconcileRunways(list) {
  const surveyed = list.filter((r) => r.source.source === "osm");
  const charted = list
    .filter((r) => r.source.source !== "osm")
    .sort((x, y) => Number(!!(parseDesignator(y.ends[0].ident)?.letter || parseDesignator(y.ends[1].ident)?.letter)) - Number(!!(parseDesignator(x.ends[0].ident)?.letter || parseDesignator(x.ends[1].ident)?.letter)) || sourceKey(x).localeCompare(sourceKey(y)));
  const strips = [...groupStrips(surveyed.filter((r) => !r.construction)), ...groupStrips(surveyed.filter((r) => r.construction))];
  const open = strips.filter((g) => !g.some((m) => m.construction));
  const orphans = [];
  for (const oa of charted) {
    const fits = open
      .filter((g) => !g.some((m) => lettersConflict(m, oa)) && g.some((m) => samePairLoose(oa, m) || sameStrip(m, oa) || sameStrip(oa, m)))
      .map((g) => ({
        g,
        exact: g.some((m) => m.ends.every((e, i) => e.ident === oa.ends[i].ident)) ? 0 : 1,
        across: acrossStrip(g, oa),
        len: Math.max(...g.map((m) => m.lengthM)),
        id: g.map(sourceKey).sort()[0],
      }))
      .sort((p, q) => p.exact - q.exact || p.across - q.across || q.len - p.len || p.id.localeCompare(q.id));
    if (fits.length) fits[0].g.push(oa);
    else orphans.push(oa);
  }
  const all = [...strips, ...groupStrips(orphans)];
  return all.map(mergeStrip).sort((x, y) => y.lengthM - x.lengthM || x.id.localeCompare(y.id) || x.ends[0].lat - y.ends[0].lat);
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Drops a second record only on identity proof: both carry the same source record (the same OSM element or OurAirports id).
 * Separately catalogued places with the same name and kind stay, however close (Offshore Helipad AE-0215 and AE-0217).
 * The richer record stays.
 * @param {any[]} list
 * @returns {any[]}
 */
export function dedupeSamePlace(list) {
  const score = (f) => (f.runways?.length ? 4 : 0) + (f.polygon ? 2 : 0) + (f.osint ? 1 : 0);
  const ids = (f) => (f.sources ?? []).map((s) => `${s.source}:${s.id}`);
  const drop = new Set();
  for (let i = 0; i < list.length; i++) {
    if (drop.has(i)) continue;
    const mine = new Set(ids(list[i]));
    for (let j = i + 1; j < list.length; j++) {
      if (drop.has(j) || !ids(list[j]).some((k) => mine.has(k))) continue;
      if (score(list[j]) > score(list[i])) { drop.add(i); break; }
      drop.add(j);
    }
  }
  return list.filter((_, i) => !drop.has(i));
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

  // Attach OSM runway geometry to the nearest aerodrome within range, then reconcile each aerodrome's strips.
  const airMerged = merged.filter((f) => f.kind === "airbase");
  const osmRunwayCount = { attached: 0, orphans: 0 };
  const osmByAerodrome = new Map();
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
      if (!osmByAerodrome.has(best)) osmByAerodrome.set(best, []);
      osmByAerodrome.get(best).push(r);
    } else osmRunwayCount.orphans++;
  }
  for (const [f, rs] of osmByAerodrome) {
    const charted = f.runways.length > 0;
    for (const r of rs) {
      // A short lone OSM strip next to charted runways is a stopway, blast pad or segment, not an extra runway.
      const joins = [...f.runways, ...rs.map((x) => x.runway)].some((o) => o !== r.runway && (sameStrip(o, r.runway) || sameStrip(r.runway, o)));
      if (charted && r.runway.lengthM < 600 && !joins) {
        osmRunwayCount.orphans++;
        continue;
      }
      f.pendingRunways = [...(f.pendingRunways ?? []), r.runway];
      if (!f.sources.some((s) => s.id === r.osmId)) f.sources.push({ source: "osm", id: r.osmId, role: "runway" });
      osmRunwayCount.attached++;
    }
  }
  for (const f of airMerged) {
    f.runways = reconcileRunways([...f.runways, ...(f.pendingRunways ?? [])]);
    delete f.pendingRunways;
  }

  for (const o of others) merged.push(o);

  // A military area that is the polygon of a base we already hold as airbase/naval_base duplicates it.
  /** @type {any[]} */
  let final = [];
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
    const heliOnly = f.runways.length === 0 && (f.airportType === "heliport" || /heli/i.test(f.name ?? ""));
    if (heliOnly) f.kind = "heliport";
  }

  // One record per real place, on identity proof only (a shared source record)
  final = dedupeSamePlace(final);

  // Stable ids
  const used = new Set();
  for (const f of final) {
    let base;
    if (f.kind === "airbase" || f.kind === "heliport") base = f.icao || f.ident ? `apt-${slug(f.icao || f.ident)}` : `apt-${slug(f.sources[0].id)}`;
    else base = `${f.kind === "naval_base" ? "nav" : f.kind === "port" ? "port" : "mil"}-${slug(f.sources[0].id)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    f.id = id;
    f.name = f.name || (f.kind === "airbase" ? f.icao || "Unnamed airfield" : f.kind === "heliport" ? "Unnamed heliport" : f.kind === "naval_base" ? "Unnamed naval base" : f.kind === "port" ? "Unnamed port" : `Unnamed ${f.areaType ?? "military"} area`);
    delete f.key;
    delete f.ident;
    if (f.kind !== "airbase") delete f.runways;
  }

  for (const f of final) {
    const located = LOCATED_NAMES[f.sources[0]?.id];
    if (located && GENERIC_NAMES.has(f.name)) {
      f.name = located;
    }
  }
  const named = final.filter((f) => !GENERIC_NAMES.has(f.name) && !/^Unnamed /.test(f.name) && ["airbase", "naval_base", "port"].includes(f.kind));
  for (const f of final) {
    if (!GENERIC_NAMES.has(f.name)) continue;
    let best = null;
    for (const n of named) {
      const d = haversineM(f.position, n.position);
      if (d <= 80000 && (!best || d < best.d)) best = { n, d };
    }
    if (best) f.name = `${f.name} near ${best.n.name}`;
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
