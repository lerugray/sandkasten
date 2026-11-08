import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Inlined at build time so the E2E session handle is dead code, and absent, in any build made without NEXT_PUBLIC_SAND_E2E=1.
  env: { NEXT_PUBLIC_SAND_E2E: process.env.NEXT_PUBLIC_SAND_E2E ?? "" },
};

export default nextConfig;
