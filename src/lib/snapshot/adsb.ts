// Keyless ADS-B fetch for the snapshot seed: adsb.lol public API (https://api.adsb.lol/docs).
//
// Terms relied on (adsb.lol OpenAPI description + https://www.adsb.lol/docs/privacy-license, read 2026-11-06):
//   "You can use the API for free. In the future, you will require an API key which you can get by feeding to
//    adsb.lol. If you want to use the API for production purposes, please contact me so I do not break your
//    application by accident." "The license for the API as well as all data ADSB.lol makes public is ODbL."
//   Data is "as is", no accuracy warranty. No numeric rate limit is published, so this module self-limits to
//   one request per second, one attempt per request, no retries (a 429 or any error stops that request only).
// Attribution: data (c) adsb.lol contributors, ODbL 1.0, https://www.adsb.lol/ ; no API key is read or sent.
//
// Erasable TypeScript only (run directly by Node type stripping); the network and the clock are injected.

import type { SnapshotSource } from "@/types/game";
import type { AdsbAircraft, BBox } from "./seed";

export const ADSB_BASE = "https://api.adsb.lol/v2";
export const USER_AGENT = "SandkastenOSINT/0.1 (+https://github.com/lerugray/sandkasten)";
export const MIN_INTERVAL_MS = 1000;
/** adsb.lol point query maximum radius, nautical miles. */
export const MAX_RADIUS_NM = 250;
const TERMS = "Free to use, data ODbL 1.0, attribution to adsb.lol, 'as is'; an API key may be required in future";
const RATE = `self-limited to 1 request/second, single attempt, no retries (adsb.lol publishes no numeric limit)`;
const NM_PER_DEG_LAT = 60;

export interface PointQuery {
  lat: number;
  lon: number;
  radiusNm: number;
}

/**
 * Cover the bbox with as few <=250 nm circles as possible: the smallest nx x ny grid whose cell
 * half-diagonal stays under `maxRadiusNm * 0.96` (a little margin, circles overlap at the corners).
 */
export function tilePoints(bbox: BBox, maxRadiusNm: number = MAX_RADIUS_NM): PointQuery[] {
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const heightNm = (n - s) * NM_PER_DEG_LAT;
  const widthNm = (e - w) * NM_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  const limit = maxRadiusNm * 0.96;
  let nx = 1;
  let ny = 1;
  while (Math.hypot(widthNm / nx / 2, heightNm / ny / 2) > limit) {
    // grow the axis whose cells are longer
    if (widthNm / nx >= heightNm / ny) nx += 1;
    else ny += 1;
  }
  const radiusNm = Math.min(maxRadiusNm, Math.ceil(Math.hypot(widthNm / nx / 2, heightNm / ny / 2) * 1.04));
  const out: PointQuery[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      out.push({
        lat: Math.round((s + ((j + 0.5) * (n - s)) / ny) * 1000) / 1000,
        lon: Math.round((w + ((i + 0.5) * (e - w)) / nx) * 1000) / 1000,
        radiusNm,
      });
    }
  }
  return out;
}

export interface RecordedRequest {
  url: string;
  /** ISO UTC time the request was made. */
  at: string;
  status: number;
  /** adsb.lol "now" (epoch ms) of the response, when present. */
  now?: number;
  ac: AdsbAircraft[];
  error?: string;
}

export interface AdsbFetchResult {
  fetchedAt: string;
  requests: RecordedRequest[];
  aircraft: AdsbAircraft[];
  sources: SnapshotSource[];
  /** True when not a single request returned data. */
  failed: boolean;
}

export interface FetchDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Keep only the fields the seed reads, so recorded fixtures stay small. */
export function trimAircraft(a: Record<string, unknown>): AdsbAircraft {
  const keep = ["hex", "flight", "r", "t", "desc", "ownOp", "alt_baro", "gs", "track", "true_heading", "lat", "lon", "dbFlags", "category"];
  const out: Record<string, unknown> = {};
  for (const k of keep) {
    if (a[k] === undefined || a[k] === null) continue;
    out[k] = typeof a[k] === "string" ? (a[k] as string).trim() : a[k];
  }
  return out as unknown as AdsbAircraft;
}

/** Merge the aircraft of recorded responses by hex (the first sighting wins); /v2/mil members are flagged. */
export function aircraftFromRequests(requests: RecordedRequest[]): AdsbAircraft[] {
  const byHex = new Map<string, AdsbAircraft>();
  for (const r of requests) {
    const isMil = r.url.endsWith("/mil");
    for (const a of r.ac) {
      const key = a.hex.toLowerCase();
      const prev = byHex.get(key);
      if (prev) {
        if (isMil) prev.fromMilEndpoint = true;
        continue;
      }
      byHex.set(key, isMil ? { ...a, fromMilEndpoint: true } : { ...a });
    }
  }
  return [...byHex.values()];
}

function inBox(a: AdsbAircraft, b: BBox): boolean {
  return typeof a.lat === "number" && typeof a.lon === "number" && a.lat >= b[1] && a.lat <= b[3] && a.lon >= b[0] && a.lon <= b[2];
}

/** Source entries (mil + point) for a finished fetch, with counts. */
export function adsbSources(requests: RecordedRequest[], bbox: BBox): SnapshotSource[] {
  const mil = requests.filter((r) => r.url.endsWith("/mil"));
  const pts = requests.filter((r) => !r.url.endsWith("/mil"));
  const mk = (id: string, name: string, url: string, reqs: RecordedRequest[]): SnapshotSource => {
    const ok = reqs.filter((r) => r.status >= 200 && r.status < 300);
    const returned = ok.reduce((n, r) => n + r.ac.length, 0);
    const inside = new Set<string>();
    for (const r of ok) for (const a of r.ac) if (inBox(a, bbox)) inside.add(a.hex.toLowerCase());
    const fail = reqs.filter((r) => !(r.status >= 200 && r.status < 300));
    return {
      id,
      name,
      url,
      terms: TERMS,
      rateLimit: RATE,
      fetchedAt: reqs.length ? reqs[reqs.length - 1].at : null,
      status: ok.length > 0 ? "used" : "failed",
      ...(fail.length ? { reason: `${fail.length} of ${reqs.length} requests failed: ${fail[0].error ?? "HTTP " + fail[0].status}` } : {}),
      counts: { requests: reqs.length, returned, uniqueInBbox: inside.size },
    };
  };
  return [
    mk("adsblol-mil", "adsb.lol /v2/mil (all military-registered aircraft)", `${ADSB_BASE}/mil`, mil),
    mk("adsblol-point", "adsb.lol /v2/point/{lat}/{lon}/{radiusNm} (bbox tiles)", `${ADSB_BASE}/point/{lat}/{lon}/{radiusNm}`, pts),
  ];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Fetch /v2/mil once and one /v2/point query per tile, strictly one request per MIN_INTERVAL_MS, one
 * attempt each. Never throws on HTTP/network errors: they are recorded on the request.
 */
export async function fetchAdsb(bbox: BBox, deps: FetchDeps = {}): Promise<AdsbFetchResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? 20000;

  const urls = [
    `${ADSB_BASE}/mil`,
    ...tilePoints(bbox).map((p) => `${ADSB_BASE}/point/${p.lat}/${p.lon}/${p.radiusNm}`),
  ];
  const requests: RecordedRequest[] = [];
  let lastStart = -Infinity;
  for (const url of urls) {
    if (deps.signal?.aborted) break;
    const wait = lastStart + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    const at = now().toISOString().replace(/\.\d+Z$/, "Z");
    try {
      const signals = [AbortSignal.timeout(timeoutMs), ...(deps.signal ? [deps.signal] : [])];
      const res = await fetchFn(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.any(signals),
      });
      if (!res.ok) {
        requests.push({ url, at, status: res.status, ac: [], error: `HTTP ${res.status}` });
        if (res.status === 429) break; // asked to slow down: stop, do not hammer the remaining tiles
        continue;
      }
      const body = (await res.json()) as { ac?: Record<string, unknown>[]; now?: number };
      const ac = (body.ac ?? []).filter((a) => typeof a.hex === "string").map(trimAircraft);
      requests.push({ url, at, status: res.status, ...(typeof body.now === "number" ? { now: body.now } : {}), ac });
    } catch (err) {
      requests.push({ url, at, status: 0, ac: [], error: err instanceof Error ? err.message : String(err) });
    }
  }
  const fetchedAt = requests.length ? requests[requests.length - 1].at : now().toISOString().replace(/\.\d+Z$/, "Z");
  const failed = !requests.some((r) => r.status >= 200 && r.status < 300);
  return { fetchedAt, requests, aircraft: aircraftFromRequests(requests), sources: adsbSources(requests, bbox), failed };
}
