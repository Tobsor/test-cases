import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const hostBrowserPath = findHostBrowser();

function findHostBrowser(): string {
  const candidates = [
    process.env.HOST_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean) as string[];

  const browserPath = candidates.find((candidate) => existsSync(candidate));
  if (!browserPath) {
    throw new Error(
      "No host browser found. Set HOST_BROWSER_PATH to a local Chrome, Chromium, or Edge executable.",
    );
  }

  return browserPath;
}

export default defineConfig({
  testDir: "./test-scripts",
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  outputDir: "./test-results",
  preserveOutput: "always",
  reporter: [
    ["list"],
    ["json", { outputFile: "./test-results/results.json" }],
    ["html", { outputFolder: "./playwright-report", open: "never" }],
  ],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "https://data.bis.org",
    browserName: "chromium",
    launchOptions: {
      executablePath: hostBrowserPath,
    },
    viewport: { width: 1440, height: 1000 },
    trace: "on",
  },
});
