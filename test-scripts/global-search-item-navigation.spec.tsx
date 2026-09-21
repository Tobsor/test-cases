import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

function firstResultLink(page: Page) {
  return page.locator("main article").first().getByRole("link").first().or(page.locator("main").getByRole("grid").getByRole("link").first()).first();
}

async function selectFirstTwoSeries(page: Page): Promise<void> {
  const checkboxes = page.locator("main").getByRole("checkbox", { name: /Select time series|Press Space to toggle row selection/ });
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await expect(page.locator("main").getByText(/2 selected/)).toBeVisible();
}

async function compareSelectedSeries(page: Page): Promise<void> {
  const compare = page.locator("main").getByRole("link", { name: "Compare time series" });
  await expect(compare).toBeEnabled();
  await compare.click();
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL(/\/topics\/.+additional_ts=/);
}

const it = test;

test.describe(`Global Search Item Navigation`, () => {
  test(`Global Search Item Navigation`, async ({ page }) => {
    await it.step(`1. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
      await expect(page.getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`2. Click on a time series in the time series list`, async () => {
      const href = await firstResultLink(page).getAttribute("href");
      expect(href).toMatch(/\/topics\/.+\/BIS,/);
      await firstResultLink(page).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/.+\/BIS,/);
    });

    await it.step(`3. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`4. Select two time series in the time series list by checking the checkboxes`, async () => {
      await selectFirstTwoSeries(page);
    });

    await it.step(`5. Click on \`Compare time series\``, async () => {
      await compareSelectedSeries(page);
      await expect(page).toHaveURL(/additional_ts=.*BIS/);
    });

    await it.step(`6. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`7. Select the table view in the toolbar`, async () => {
      const listView = page.getByRole("radio", { name: "Change to list view" });
      await listView.click();
      await expect(listView).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("main").getByRole("grid")).toBeVisible();
    });

    await it.step(`8. Click on a series key of a time series in the list`, async () => {
      const href = await firstResultLink(page).getAttribute("href");
      expect(href).toMatch(/\/topics\/.+\/BIS,/);
      await firstResultLink(page).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/.+\/BIS,/);
    });

    await it.step(`9. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`10. Select the table view in the toolbar`, async () => {
      const listView = page.getByRole("radio", { name: "Change to list view" });
      await listView.click();
      await expect(listView).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("main").getByRole("grid")).toBeVisible();
    });

    await it.step(`11. Select two time series in the time series table by checking the checkboxes`, async () => {
      await selectFirstTwoSeries(page);
    });

    await it.step(`12. Click on \`Compare time series\``, async () => {
      await compareSelectedSeries(page);
      await expect(page).toHaveURL(/additional_ts=.*BIS/);
    });
  });
});
