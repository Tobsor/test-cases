import { expect, test } from "@playwright/test";

const EXPECTED_PATHS = [
  "/",
  "/release-calendar",
  "/help",
  "/help/getting-started",
  "/help/explore-statistics",
  "/help/export",
  "/help/tools",
  "/help/glossary",
  "/help/legal",
  "/help/faq",
  "/bulkdownload",
];

function expectApproximateCount(items: string[], minimum: number, maximum: number, description: string): void {
  expect(items.length, description).toBeGreaterThanOrEqual(minimum);
  expect(items.length, description).toBeLessThanOrEqual(maximum);
}

test.describe("Sitemap", () => {
  test("publishes complete environment-specific sitemap URLs", async ({ page, baseURL }) => {
    expect(baseURL, "Playwright baseURL must identify the environment under test").toBeTruthy();
    const origin = new URL(baseURL!).origin;
    const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const topicRoute = new RegExp(`^${escapedOrigin}/topics/[^/?#]+(?:/data|/tables-and-dashboards)?$`);
    const tableRoute = new RegExp(`^${escapedOrigin}/topics/[^/?#]+/tables-and-dashboards/[^/?#]+$`);
    const pdqRoute = new RegExp(`^${escapedOrigin}/topics/[^/?#]+/data/[^/?#]+$`);
    const expectedUrls = EXPECTED_PATHS.map((path) => new URL(path, origin).href);
    let locations: string[] = [];

    await test.step("1. Visit /sitemap.xml", async () => {
      const response = await page.goto("/sitemap.xml");
      expect(response, "Sitemap navigation should return a response").not.toBeNull();
      expect(response!.ok(), "Sitemap should load successfully").toBe(true);
      locations = await page.evaluate(() =>
        Array.from(document.querySelectorAll("loc"), (node) => node.textContent?.trim() ?? ""),
      );
      expect(locations.length, "Sitemap should include generated page URLs").toBeGreaterThan(0);
    });

    await test.step("2–3. Verify complete page, topic, table, and PDQ URLs for the current environment", async () => {
      // Parse without a base to reject relative URLs and normalize the homepage's trailing slash.
      const urls = locations.map((location) => new URL(location).href);
      expect(new Set(urls).size, "Sitemap URLs should be unique").toBe(urls.length);

      for (const expectedUrl of expectedUrls) {
        expect(urls, `Sitemap should include ${expectedUrl}`).toContain(expectedUrl);
      }

      const topicUrls = urls.filter((url) => topicRoute.test(url));
      const tableUrls = urls.filter((url) => tableRoute.test(url));
      const pdqUrls = urls.filter((url) => pdqRoute.test(url));

      // Each complete URL must match a supported route on the configured domain.
      const staticUrls = new Set([...expectedUrls, `${origin}/topics`]);
      for (const url of urls) {
        expect(
          staticUrls.has(url) || topicRoute.test(url) || tableRoute.test(url) || pdqRoute.test(url),
          `Unexpected sitemap URL: ${url}`,
        ).toBe(true);
      }

      // The markdown gives approximate totals, allowing modest content changes.
      expectApproximateCount(topicUrls, 54, 66, "Sitemap should contain about 60 topic routes");
      expectApproximateCount(tableUrls, 120, 140, "Sitemap should contain about 130 table links");
      expectApproximateCount(pdqUrls, 65, 80, "Sitemap should contain about 70 PDQ links");

      // Derive IDs from every topic URL so missing overview routes are detected too.
      const topicIds = new Set([...topicUrls, ...tableUrls, ...pdqUrls].map(
        (url) => url.slice(`${origin}/topics/`.length).split("/")[0],
      ));
      for (const topicId of topicIds) {
        for (const suffix of ["", "/tables-and-dashboards", "/data"]) {
          const expectedUrl = `${origin}/topics/${topicId}${suffix}`;
          expect(urls, `Sitemap should include ${expectedUrl}`).toContain(expectedUrl);
        }
      }
    });
  });
});
