import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 568 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
