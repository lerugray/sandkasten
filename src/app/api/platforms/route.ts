import { NextRequest, NextResponse } from "next/server";
import {
  getShips,
  getAircraft,
  getWeapons,
  getSensors,
  getMounts,
  getLoadouts,
  isDatabaseAvailable,
  resolveCountry,
  resolveService,
  resolveShipType,
  resolveAircraftType,
  resolveWeaponType,
  resolveSensorType,
  resolveSensorRole,
  resolveLoadoutRole,
  resolvePropulsionType,
  resolveFuelType,
} from "@/lib/platforms/database";

// GET /api/platforms?type=ship&id=111
// GET /api/platforms?type=ship&search=arleigh
// GET /api/platforms?type=ship&country=2101&limit=20
// GET /api/platforms?status=true
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Status check
  if (params.get("status") === "true") {
    return NextResponse.json({ available: isDatabaseAvailable() });
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: "Platform database not found. Run scripts/extract_cmo_db.py first." },
      { status: 404 }
    );
  }

  const type = params.get("type");
  const id = params.get("id");
  const search = params.get("search")?.toLowerCase();
  const countryId = params.get("country");
  const limit = parseInt(params.get("limit") ?? "50");
  const resolve = params.get("resolve") !== "false"; // resolve enums by default

  if (!type) {
    return NextResponse.json(
      { error: "Missing 'type' parameter. Use: ship, aircraft, weapon, sensor, mount, loadout" },
      { status: 400 }
    );
  }

  // Get the right data map
  let dataMap: Map<number, Record<string, unknown>>;
  switch (type) {
    case "ship": dataMap = getShips() as unknown as Map<number, Record<string, unknown>>; break;
    case "aircraft": dataMap = getAircraft() as unknown as Map<number, Record<string, unknown>>; break;
    case "weapon": dataMap = getWeapons() as unknown as Map<number, Record<string, unknown>>; break;
    case "sensor": dataMap = getSensors() as unknown as Map<number, Record<string, unknown>>; break;
    case "mount": dataMap = getMounts() as unknown as Map<number, Record<string, unknown>>; break;
    case "loadout": dataMap = getLoadouts() as unknown as Map<number, Record<string, unknown>>; break;
    default:
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  // Single lookup by ID
  if (id) {
    const record = dataMap.get(parseInt(id));
    if (!record) {
      return NextResponse.json({ error: `${type} #${id} not found` }, { status: 404 });
    }
    const result = resolve ? resolveRecord(type, record) : record;
    return NextResponse.json(result);
  }

  // Search/filter
  let results = Array.from(dataMap.values());

  if (search) {
    results = results.filter((r) =>
      (r.name as string)?.toLowerCase().includes(search)
    );
  }

  if (countryId) {
    const cid = parseInt(countryId);
    results = results.filter((r) => (r as { countryId?: number }).countryId === cid);
  }

  results = results.slice(0, limit);

  if (resolve) {
    results = results.map((r) => resolveRecord(type, r));
  }

  return NextResponse.json({ count: results.length, records: results });
}

function resolveRecord(type: string, record: Record<string, unknown>): Record<string, unknown> {
  const resolved = { ...record };

  // Common fields
  if ("countryId" in resolved) {
    resolved.country = resolveCountry(resolved.countryId as number);
  }
  if ("serviceId" in resolved) {
    resolved.service = resolveService(resolved.serviceId as number);
  }

  // Type-specific
  switch (type) {
    case "ship":
      if ("typeId" in resolved) resolved.typeName = resolveShipType(resolved.typeId as number);
      if ("propulsion" in resolved && Array.isArray(resolved.propulsion)) {
        resolved.propulsion = (resolved.propulsion as Record<string, unknown>[]).map((p) => ({
          ...p,
          typeName: resolvePropulsionType(p.typeId as number),
        }));
      }
      if ("fuel" in resolved && Array.isArray(resolved.fuel)) {
        resolved.fuel = (resolved.fuel as Record<string, unknown>[]).map((f) => ({
          ...f,
          typeName: resolveFuelType(f.typeId as number),
        }));
      }
      break;
    case "aircraft":
      if ("typeId" in resolved) resolved.typeName = resolveAircraftType(resolved.typeId as number);
      break;
    case "weapon":
      if ("typeId" in resolved) resolved.typeName = resolveWeaponType(resolved.typeId as number);
      break;
    case "sensor":
      if ("typeId" in resolved) resolved.typeName = resolveSensorType(resolved.typeId as number);
      if ("roleId" in resolved) resolved.roleName = resolveSensorRole(resolved.roleId as number);
      break;
    case "loadout":
      if ("roleId" in resolved) resolved.roleName = resolveLoadoutRole(resolved.roleId as number);
      break;
  }

  return resolved;
}
