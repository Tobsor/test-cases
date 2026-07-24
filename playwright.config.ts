import { defineConfig } from "@playwright/test";

const chromeExecutable =
  process.env.PLAYWRIGHT_CHROME ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export default defineConfig({
  testDir: ".",
  testMatch: ["*.spec.tsx"],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "https://data.bis.org",
    browserName: "chromium",
    launchOptions: {
      executablePath: chromeExecutable,
    },
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
});
