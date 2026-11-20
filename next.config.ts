import type { NextConfig } from "next";

// Only the release export build runs in `output: "export"` (scripts/build-static.mjs sets
// SAND_STATIC_EXPORT=1). `next dev` must NOT run in export mode: the dev-only API routes under
// src/app/api (platforms, snapshot, ollama) all 500 under `output: "export"` because Next requires
// `force-static` on every route handler, and the e2e battery runs against `next dev`.
const staticExport = process.env.SAND_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // The release build is a fully static export served by Cloudflare Pages (no server). For the
  // export build scripts/build-static.mjs moves src/app/api aside so no /api/* route ships in out/.
  output: staticExport ? "export" : undefined,
  // Static exports cannot run the image optimizer; no next/image is used, but keep the loader off.
  images: { unoptimized: true },
  // Directory-style pages (/play/index.html, /editor/index.html, ...) so a plain static file
  // server (npx serve out) and Cloudflare Pages both resolve /play, /editor and /database.
  trailingSlash: true,
  devIndicators: false,
  // Inlined at build time so each flag is dead code, and absent, in any build made without it.
  env: {
    NEXT_PUBLIC_SAND_E2E: process.env.NEXT_PUBLIC_SAND_E2E ?? "",
    NEXT_PUBLIC_SAND_RELEASE: process.env.NEXT_PUBLIC_SAND_RELEASE ?? "",
  },
};

export default nextConfig;
