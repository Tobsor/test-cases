import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";
const BASE_ORIGIN = new URL(BASE_URL).origin;

const EXPECTED_URLS = [
  BASE_ORIGIN,
  `${BASE_ORIGIN}/topics`,
  `${BASE_ORIGIN}/topics/CBS`,
  `${BASE_ORIGIN}/topics/CBS/data`,
  `${BASE_ORIGIN}/topics/EER`,
  `${BASE_ORIGIN}/topics/EER/data`,
  `${BASE_ORIGIN}/release-calendar`,
  `${BASE_ORIGIN}/help`,
  `${BASE_ORIGIN}/help/getting-started`,
  `${BASE_ORIGIN}/help/explore-statistics`,
  `${BASE_ORIGIN}/help/export`,
  `${BASE_ORIGIN}/help/tools`,
  `${BASE_ORIGIN}/help/glossary`,
  `${BASE_ORIGIN}/help/legal`,
  `${BASE_ORIGIN}/help/faq`,
  `${BASE_ORIGIN}/bulkdownload`,
];

function pathnames(locations: string[]): string[] {
  return locations.map((location) => new URL(location).pathname);
}

test.describe("Sitemap", () => {
  test("publishes complete environment-specific sitemap URLs", async ({ page }) => {
    await page.goto("/sitemap.xml");
    await page.waitForLoadState("domcontentloaded");

    const locations = await page.evaluate(() =>
      Array.from(document.querySelectorAll("loc"), (node) => node.textContent?.trim()).filter(Boolean),
    );

    expect(locations.length, "Sitemap should include generated page URLs").toBeGreaterThan(100);
    expect(new Set(locations).size, "Sitemap URLs should be unique").toBe(locations.length);

    for (const location of locations) {
      expect(location, "Sitemap location should be an absolute URL").toMatch(/^https:\/\//);
      expect(new URL(location).origin, `Sitemap URL should use ${BASE_ORIGIN}`).toBe(BASE_ORIGIN);
      expect(location, "Sitemap should not contain UAT placeholder URLs").not.toContain("dataportal.uat.bisinfo.org");
    }

    for (const expectedUrl of EXPECTED_URLS) {
      expect(locations, `Sitemap should include ${expectedUrl}`).toContain(expectedUrl);
    }

    const paths = pathnames(locations);
    const topicOverviewPaths = paths.filter((path) => /^\/topics\/[A-Z0-9_]+$/.test(path));
    const topicDataPaths = paths.filter((path) => /^\/topics\/[A-Z0-9_]+\/data$/.test(path));
    const topicTablesPaths = paths.filter((path) => /^\/topics\/[A-Z0-9_]+\/tables-and-dashboards$/.test(path));
    const publicationTablePaths = paths.filter((path) =>
      /^\/topics\/[A-Z0-9_]+\/tables-and-dashboards\/.+/.test(path),
    );
    const pdqPaths = paths.filter((path) => /^\/topics\/[A-Z0-9_]+\/data\/.+/.test(path));

    expect(topicOverviewPaths, "Sitemap should include one overview URL per topic").toHaveLength(20);
    expect(topicDataPaths, "Sitemap should include one data URL per topic").toHaveLength(20);
    expect(topicTablesPaths, "Sitemap should include one tables & dashboards URL per topic").toHaveLength(20);
    expect(publicationTablePaths.length, "Sitemap should include roughly 130 publication table URLs").toBeGreaterThanOrEqual(120);
    expect(publicationTablePaths.length, "Sitemap should include roughly 130 publication table URLs").toBeLessThanOrEqual(140);
    expect(pdqPaths.length, "Sitemap should include roughly 70 PDQ URLs").toBeGreaterThanOrEqual(65);
    expect(pdqPaths.length, "Sitemap should include roughly 70 PDQ URLs").toBeLessThanOrEqual(80);

    for (const topicPath of topicOverviewPaths) {
      expect(paths, `Sitemap should include ${topicPath}/data`).toContain(`${topicPath}/data`);
      expect(paths, `Sitemap should include ${topicPath}/tables-and-dashboards`).toContain(
        `${topicPath}/tables-and-dashboards`,
      );
    }
  });
});
