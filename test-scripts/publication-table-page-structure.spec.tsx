import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Publication Table Page structure`, () => {
  test(`Publication Table Page structure`, async ({ page }) => {
    await it.step(`1. Navigate to the LBS A1 publication table`, async () => {
      await gotoPath(page, "/topics/LBS/tables-and-dashboards/BIS,LBS_A1,1.0");
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(breadcrumb).toContainText(/Topics[\s\S]*Locational banking statistics[\s\S]*Tables & dashboards[\s\S]*Publication table/);
      await expect(page.getByRole("link", { name: "Publication table" })).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Bookmark", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Custom table" })).toBeVisible();
    });

    await it.step(`2. Publication table controls and grid are visible`, async () => {
      await expect(page.getByRole("button").filter({ hasText: "Publication tables" })).toBeVisible();
      await expect(page.locator("main").getByText("Summary of locational statistics, by currency, instrument and residence and sector of counterparty").last()).toBeVisible();
      await expect(page.getByRole("combobox", { name: "publication table date" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Measure" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "View" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Level" })).toBeVisible();
      await expect(page.getByRole("grid")).toBeVisible();
      await expect(page.getByRole("grid").getByRole("link").filter({ hasText: /[\d,.]+/ }).first()).toBeVisible();
    });

    await it.step(`3. Publication tables section lists selectable cards`, async () => {
      const publicationTables = page.getByRole("button", { name: "Publication tables" });
      await publicationTables.click();
      await expect(publicationTables).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator('main a[href*="/topics/LBS/tables-and-dashboards/BIS,LBS_A"]').first()).toBeVisible();
      await expect(page.locator('main a[href*="/topics/LBS/tables-and-dashboards/BIS,LBS_A"]')).toHaveCount(await page.locator('main a[href*="/topics/LBS/tables-and-dashboards/BIS,LBS_A"]').count());
      await expect.poll(() => page.locator('main a[href*="/topics/LBS/tables-and-dashboards/BIS,LBS_A"]').count()).toBeGreaterThan(0);
    });

    await it.step(`4. A2 publication table card navigates from the Publication tables section`, async () => {
      await page.locator('main a[href="/topics/LBS/tables-and-dashboards/BIS,LBS_A2,1.0"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,LBS_A2,1\.0$/);
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(breadcrumb.getByRole("link", { name: /Back to Summary of locational statistics/i })).toBeVisible();
      await expect(breadcrumb).toContainText(/Topics[\s\S]*Locational banking statistics[\s\S]*Tables & dashboards[\s\S]*Publication table/);
    });

    await it.step(`5. Breadcrumb returns to Tables & dashboards`, async () => {
      await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Tables & dashboards" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/LBS\/tables-and-dashboards$/);
    });

    await it.step(`6. A1 publication table card navigates to its table page`, async () => {
      await page.locator('main a[href="/topics/LBS/tables-and-dashboards/BIS,LBS_A1,1.0"]').click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/BIS,LBS_A1,1\.0$/);
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(breadcrumb.getByRole("link", { name: /^Back$/ })).toBeVisible();
      await expect(breadcrumb).toContainText(/Topics[\s\S]*Locational banking statistics[\s\S]*Tables & dashboards[\s\S]*Publication table/);
    });

    await it.step(`7. DSS publication table C1 loads with publication table tabs`, async () => {
      await gotoPath(page, "/topics/DSS/tables-and-dashboards/BIS,SEC_C1,1.0");
      await expect(page.getByRole("link", { name: "Publication table" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "publication table date" })).toBeVisible();
      await expect(page.getByRole("grid")).toBeVisible();
      await page.getByRole("button", { name: "Publication tables" }).click();
      await expect(page.getByRole("tab", { name: "Global" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Country" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Climate finance" })).toBeVisible();
      await expect.poll(() => page.locator('main a[href*="/topics/DSS/tables-and-dashboards/"]').count()).toBeGreaterThan(0);
    });
  });
});
