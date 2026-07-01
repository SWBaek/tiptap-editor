import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web-playground/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:6280",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev:web",
    url: "http://127.0.0.1:6280",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
