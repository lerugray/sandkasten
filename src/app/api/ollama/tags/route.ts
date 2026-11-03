import { NextRequest, NextResponse } from "next/server";

// GET /api/ollama/tags?base=http://localhost:11434
// Server-side probe of the local Ollama model list for the InfoWar feed.
// Only loopback hosts are allowed so this can't be used to reach elsewhere.
export async function GET(request: NextRequest) {
  const base = request.nextUrl.searchParams.get("base") ?? "http://localhost:11434";
  let url: URL;
  try {
    url = new URL("/api/tags", base);
  } catch {
    return NextResponse.json({ models: null });
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !/^https?:$/.test(url.protocol)) {
    return NextResponse.json({ models: null });
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ models: null });
    const data = await res.json();
    return NextResponse.json({ models: data.models ?? [] });
  } catch {
    return NextResponse.json({ models: null });
  }
}
