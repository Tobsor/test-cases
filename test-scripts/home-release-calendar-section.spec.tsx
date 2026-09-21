import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

function parseReleaseDate(dateText: string): Date {
  const parsed = new Date(`${dateText} 00:00:00 GMT`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse release date: ${dateText}`);
  }
  return parsed;
}

async function visibleReleaseDates(page: Page, panelName: string): Promise<Date[]> {
  const text = await page.getByRole("tabpanel", { name: panelName }).innerText();
  return [...text.matchAll(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/g)].map((match) => parseReleaseDate(match[0]));
}

test.describe(`Home Release Calendar section`, () => {
  test(`Home Release Calendar section`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Scroll to the release calendar section`, async () => {
      await page.getByRole("heading", { name: "Release calendar" }).scrollIntoViewIfNeeded();
    });

    await it.step(`3. Latest releases tab is active by default`, async () => {
      await expect(page.getByRole("tab", { name: "Latest releases" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tab", { name: "Upcoming releases" })).toHaveAttribute("aria-selected", "false");
      await expect(page.getByRole("tabpanel", { name: "Latest releases" }).getByRole("link").first()).toBeVisible();
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      for (const releaseDate of await visibleReleaseDates(page, "Latest releases")) {
        expect(releaseDate.getTime()).toBeLessThanOrEqual(today.getTime());
      }
    });

    await it.step(`4. Clicking a release heading opens its topic`, async () => {
      await page.getByRole("tabpanel", { name: "Latest releases" }).getByRole("link").first().click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/[A-Z0-9_]+/);
    });

    await it.step(`5. View all opens the release calendar`, async () => {
      await gotoPath(page, "/");
      await page.getByRole("heading", { name: "Release calendar" }).scrollIntoViewIfNeeded();
      await page.getByRole("link", { name: "View all" }).first().click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/release-calendar/);
    });

    await it.step(`6. Upcoming releases tab shows future release entries`, async () => {
      await gotoPath(page, "/");
      await page.getByRole("heading", { name: "Release calendar" }).scrollIntoViewIfNeeded();
      await page.getByRole("tab", { name: "Upcoming releases" }).click();
      await expect(page.getByRole("tab", { name: "Upcoming releases" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel", { name: "Upcoming releases" }).getByRole("link").first()).toBeVisible();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const releaseDate of await visibleReleaseDates(page, "Upcoming releases")) {
        expect(releaseDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
      }
    });
  });
});
