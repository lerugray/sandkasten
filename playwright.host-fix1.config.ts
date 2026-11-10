import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

// Host-only for this lane run: Chromium --no-sandbox. Never commit.
const cfg = base;
const project = cfg.projects?.[0];
const launch = project?.use?.launchOptions ?? {};
const args = [...(launch.args ?? []), "--no-sandbox"].filter(
  (a, i, all) => all.indexOf(a) === i,
);

export default defineConfig({
  ...cfg,
  reporter: "list",
  projects: [
    {
      ...project!,
      use: {
        ...project!.use,
        launchOptions: {
          ...launch,
          args,
        },
      },
    },
  ],
});
