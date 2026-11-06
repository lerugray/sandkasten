import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.unit\.spec\.ts/,
  reporter: "list",
});
