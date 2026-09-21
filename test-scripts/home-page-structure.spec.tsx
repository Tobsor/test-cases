import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

function mainSearchInput(page: Page): Locator {
  return page.getByRole("combobox", { name: /search for time series/i }).first();
}

const it = test;

test.describe(`Home Page Structure`, () => {
  test(`Home Page Structure`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
      await expect(page.getByRole("heading", { name: /Global statistics at the heart of international cooperation/i })).toBeVisible();
    });

    await it.step(`2. Page features the home search bar`, async () => {
      await expect(mainSearchInput(page)).toBeVisible();
    });

    await it.step(`3. Page features popular topic quick links`, async () => {
      const popularSearches = page.getByRole("region", { name: "Popular time series searches" });
      await expect(popularSearches).toBeVisible();
      for (const topic of [
        "International banking",
        "Debt securities",
        "Credit",
        "Global liquidity",
        "Derivatives",
        "Property prices",
        "Consumer prices",
        "Exchange rates",
        "Central bank statistics",
        "Payment statistics",
      ]) {
        await expect(popularSearches.getByRole("link", { name: topic })).toBeVisible();
      }
      await expect(popularSearches.getByRole("link", { name: "Global liquidity" })).toHaveAttribute("href", /_CATEGORY=GLI/);
      await expect(popularSearches.getByRole("link", { name: "Payment statistics" })).toHaveAttribute("href", /CPMI/);
    });

    await it.step(`4. Page features the main home sections`, async () => {
      await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Release calendar" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "BIS statistics" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "BIS research and innovation" })).toBeVisible();
      await expect(page.locator('a[href="/topics"]', { hasText: "View all" })).toBeVisible();
      await expect(page.locator('a[href="https://www.bis.org/forum/research.htm"]', { hasText: "View all" })).toBeVisible();
    });

    await it.step(`5. BIS statistics cards link to overview and data pages`, async () => {
      const statistics = page.locator("main").getByRole("region").filter({
        has: page.getByRole("heading", { name: "BIS statistics" }),
      });
      const lbsCard = statistics.locator("article").filter({
        has: page.getByRole("heading", { name: "Locational banking statistics" }),
      });
      await expect(lbsCard.locator('a[href="/topics/LBS"]')).toBeVisible();

      await lbsCard.hover();
      const dataLink = lbsCard.getByRole("link", { name: "Go to data of Locational banking statistics" });
      await expect(dataLink).toBeVisible();
      await expect(dataLink).toHaveAttribute("href", "/topics/LBS/data");
      await expect(page.locator('a[href="/topics"]', { hasText: "View all" })).toBeVisible();
    });

    await it.step(`6. BIS research carousel can navigate forwards and backwards`, async () => {
      const carousel = page.getByRole("region", { name: "Data Portal tools carousel" });
      await carousel.hover();

      const next = carousel.getByRole("button", { name: "Go to next slide" });
      const previous = carousel.getByRole("button", { name: "Go to previous slide" });
      await expect(next).toBeVisible();
      await next.click();
      await expect(previous).toBeVisible();
      await previous.click();
      await expect(carousel.getByRole("heading", { name: "BIS Research", exact: true })).toBeVisible();
    });

    await it.step(`7. Scroll-to-top button appears after scrolling down`, async () => {
      await page.getByRole("heading", { name: "BIS research and innovation" }).scrollIntoViewIfNeeded();
      const scrollTop = page.getByRole("button", { name: "Scroll to top" });
      await expect(scrollTop).toBeVisible();
      await scrollTop.click();
      await expect(page.getByRole("heading", { name: /Global statistics/i })).toBeVisible();
    });
  });
});
