import { NextRequest, NextResponse } from "next/server";
import { buildSnapshotScenario, HORMUZ_BBOX } from "@/lib/snapshot/seed";
import { fetchAdsb } from "@/lib/snapshot/adsb";
import type { Scenario } from "@/types/game";

// GET /api/snapshot[?civil=1]
// Fetches a fresh real-world snapshot (keyless adsb.lol: /v2/mil plus /v2/point tiles over the Hormuz bbox, one
// request per second with a descriptive User-Agent) and returns the scenario JSON that
// scripts/snapshot-seed.mjs would write. No API key is read or stored. A fetch takes ~5-6 s because of the
// rate limit; results are cached for 60 s and concurrent calls share one fetch so the route cannot be used to
// hammer adsb.lol. Failure -> 502 { error }.
export const dynamic = "force-dynamic";

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; scenario: Scenario }>();
const inflight = new Map<string, Promise<Scenario>>();

async function fresh(includeCivil: boolean): Promise<Scenario> {
  const res = await fetchAdsb(HORMUZ_BBOX);
  if (res.failed) {
    const why = res.requests.map((r) => r.error ?? `HTTP ${r.status}`)[0] ?? "no request made";
    throw new Error(`adsb.lol unreachable or refused all requests (${why})`);
  }
  return buildSnapshotScenario({
    aircraft: res.aircraft,
    vessels: [],
    fetchedAt: res.fetchedAt,
    sources: res.sources,
    bbox: HORMUZ_BBOX,
    includeCivil,
  });
}

export async function GET(request: NextRequest) {
  const includeCivil = request.nextUrl.searchParams.get("civil") === "1";
  const key = includeCivil ? "civil" : "mil";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.scenario);

  let pending = inflight.get(key);
  if (!pending) {
    pending = fresh(includeCivil).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    const scenario = await pending;
    cache.set(key, { at: Date.now(), scenario });
    return NextResponse.json(scenario);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "snapshot fetch failed" }, { status: 502 });
  }
}
