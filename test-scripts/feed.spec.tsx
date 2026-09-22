import { expect, test, type Page } from "@playwright/test";

// Local test helpers. Kept inline so this spec has no project-local runtime imports.
const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, pathOrUrl: string): Promise<void> {
  const url = normalizeUrl(pathOrUrl);
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

function normalizeUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${BASE_URL}${url.pathname}${url.search}${url.hash}`;
  }

  if (!pathOrUrl.startsWith("/")) {
    return `${BASE_URL}/${pathOrUrl}`;
  }

  return `${BASE_URL}${pathOrUrl}`;
}

const it = test;

test.describe(`Feed`, () => {
  test(`Feed`, async ({ page }) => {
    let xml = "";

    await it.step(`1. Navigate to \`/feed.xml\``, async () => {
      await gotoPath(page, "/feed.xml");
      const response = await page.request.get(`${BASE_URL}/feed.xml`);
      expect(response.ok()).toBeTruthy();
      xml = await response.text();
      expect(xml).toContain("<rss");
      expect(xml).toContain("<channel>");
    });

    await it.step(`2. Verify that the following metadata is set`, async () => {
      expect(xml).toContain("<title><![CDATA[BIS release calendar feed]]></title>");
      expect(xml).toContain(
        "<description><![CDATA[Find here the latest publication dates of BIS statistics. Data are released no later than the specified date.]]></description>",
      );
      expect(xml).toContain("<generator>BIS</generator>");
      expect(xml).toMatch(/<lastBuildDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT<\/lastBuildDate>/);
      expect(xml).toContain('<atom:link href="https://data.bis.org/feed.xml" rel="self" type="application/rss+xml"/>');
    });

    await it.step(`3. Verify the item count and required fields of every feed item`, async () => {
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      expect(items.length).toBeGreaterThanOrEqual(50);
      expect(items.length).toBeLessThanOrEqual(200);

      for (const [index, item] of items.entries()) {
        await it.step(`Verify required fields for feed item ${index + 1}`, async () => {
          expect(item).toMatch(/<title><!\[CDATA\[[^<]+, \d{4}[- ][^<]+ \/ [^<]+\]\]><\/title>/);
          expect(item).toMatch(/<description><!\[CDATA\[[\s\S]+?\]\]><\/description>/);
          expect(item).toMatch(/<category><!\[CDATA\[[A-Z0-9_]+\]\]><\/category>/);
          const link = item.match(/<link>(https:\/\/data\.bis\.org\/topics\/[A-Z0-9_]+)<\/link>/)?.[1];
          expect(link).toBeTruthy();
          expect(item).toContain(`<guid isPermaLink="true">${link}</guid>`);
          expect(item).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/);
        });
      }
    });
  });
});
