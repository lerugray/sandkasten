import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.SAND_E2E_PORT ?? 3001);

// SAND_E2E_GPU=1: hardware GL for WebGL-heavy specs (the software renderer runs the plot at ~2 fps).
// Windows always prefers D3D11 ANGLE so DPR-2 combat specs can clear the frame gate; Linux/WSL keeps EGL under SAND_E2E_GPU.
const GPU_ARGS =
  process.platform === "win32"
    ? ["--mute-audio", "--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist"]
    : process.env.SAND_E2E_GPU
      ? ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--mute-audio"]
      : ["--mute-audio"];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: GPU_ARGS } },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    env: { NEXT_PUBLIC_SAND_E2E: "1" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
