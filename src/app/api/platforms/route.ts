import { NextRequest, NextResponse } from "next/server";
import {
  findPlatformRecord,
  getPlatformRecords,
  isDatabaseAvailable,
  searchPlatformRecords,
} from "@/lib/platforms/database";

// GET /api/platforms?status=true
// GET /api/platforms?slug=arleigh-burke-flt-ii
// GET /api/platforms?id=10003          (Sandkasten engine id)
// GET /api/platforms?search=arleigh&limit=20
// Serves the first-party records in src/data/platforms/. A single-record miss returns
// null so detail panels degrade quietly (SPEC: no build may require third-party reference study).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("status") === "true") {
    return NextResponse.json({ available: isDatabaseAvailable(), count: getPlatformRecords().length });
  }

  const slug = params.get("slug");
  const id = params.get("id");

  // The old third-party-shaped detail queries (?type=ship&id=..) are no longer served; the map
  // detail panel treats null as "no extra detail".
  if (params.get("type") && id) return NextResponse.json(null);

  if (slug || id) {
    return NextResponse.json(findPlatformRecord(slug ?? id!) ?? null);
  }

  const limit = Math.max(1, parseInt(params.get("limit") ?? "50", 10) || 50);
  const records = searchPlatformRecords(params.get("search") ?? "").slice(0, limit);
  return NextResponse.json({ count: records.length, records });
}
