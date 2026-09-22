import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Home BIS research section`, () => {
  test(`Home BIS research section`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Scroll to the BIS research and innovation section`, async () => {
      await page.getByRole("heading", { name: "BIS research and innovation" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("region", { name: "Data Portal tools carousel" })).toBeVisible();
    });

    await it.step(`3. Research cards are visible`, async () => {
      const carousel = page.getByRole("region", { name: "Data Portal tools carousel" });
      await carousel.hover();
      await expect(carousel.getByRole("button", { name: "Go to next slide" })).toBeVisible();
      await carousel.getByRole("button", { name: "Go to next slide" }).click();
      await expect(carousel.getByRole("button", { name: "Go to previous slide" })).toBeVisible();
      await carousel.getByRole("button", { name: "Go to previous slide" }).click();
      await expect(page.getByRole("heading", { name: "BIS Research", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "SDMX API" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sdmx.io" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "SDMX/FMR" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "IFC" })).toBeVisible();
      await expect(carousel.locator('a[href="https://stats.bis.org/api-doc/v2/"]')).toBeVisible();
      await expect(carousel.locator('a[href="https://www.sdmx.io/"]')).toBeVisible();
      await expect(carousel.locator('a[href="https://www.bis.org/innovation/bis_open_tech_sdmx.htm"]')).toBeVisible();
      await expect(carousel.locator('a[href="https://www.bis.org/ifc/index.htm"]')).toBeVisible();
    });

    await it.step(`4. BIS Research View all opens the BIS research site in a new tab`, async () => {
      const bisResearch = page.locator("article").filter({ has: page.getByRole("heading", { name: "BIS Research", exact: true }) });
      const popupPromise = page.waitForEvent("popup");
      await bisResearch.getByRole("link", { name: "View all" }).click();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/https:\/\/www\.bis\.org\/publications\/research/);
      await popup.close();
    });
  });
});
