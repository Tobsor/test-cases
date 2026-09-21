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

test.describe(`Topic tables & dashboards`, () => {
  test(`Topic tables & dashboards`, async ({ page }) => {
    await it.step(`1. Navigate to \`/topics/LBS/tables-and-dashboards\``, async () => {
      await gotoPath(page, "/topics/LBS/tables-and-dashboards");

      await expect(page).toHaveTitle(/Locational banking statistics - tables & dashboards \| BIS Data Portal/);
      await expect(page.getByRole("heading", { level: 1, name: "Locational banking statistics" })).toBeVisible();

      const pageNavigation = page.locator("main").getByRole("navigation", { name: "Page navigation" });
      await expect(pageNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/topics/LBS");
      await expect(pageNavigation.getByRole("link", { name: "Tables & dashboards" })).toHaveAttribute(
        "href",
        "/topics/LBS/tables-and-dashboards",
      );
      await expect(pageNavigation.getByRole("link", { name: "Tables & dashboards" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(pageNavigation.getByRole("link", { name: "Data" })).toHaveAttribute("href", "/topics/LBS/data");

      const dashboards = page.locator("main").getByRole("region", { name: "Dashboards" });
      await expect(dashboards.getByRole("heading", { name: "Dashboards", level: 2 })).toBeVisible();
      await expect(dashboards.getByRole("article")).toHaveCount(2);
      await expect(dashboards.locator("img")).toHaveCount(2);
      await expect(
        dashboards.getByRole("button", { name: /Cross-border positions, by location of reporting bank/i }),
      ).toContainText(/Explore cross-border positions by location of reporting banks/i);
      await expect(
        dashboards.getByRole("button", { name: /Cross-border positions, by country \(residence\) of counterparty/i }),
      ).toContainText(/Explore cross-border positions by country \(residence\) of counterparty/i);

      await dashboards.getByRole("button", { name: /Cross-border positions, by location of reporting bank/i }).click();
      const dashboardDialog = page.locator('[role="dialog"][data-state="open"]');
      await expect(dashboardDialog).toBeAttached();
      await expect(dashboardDialog.locator("iframe")).toHaveCount(1);
      await page.getByRole("button", { name: "Close modal" }).click();
      await expect(page.locator('[role="dialog"][data-state="open"]')).toHaveCount(0);

      const tables = page.locator("main").getByRole("region", { name: "Tables" });
      await expect(tables.getByRole("heading", { name: "Tables", level: 2 })).toBeVisible();
      expect(await tables.getByRole("link").count()).toBeGreaterThan(0);
      const summaryTable = tables.locator('a[href="/topics/LBS/tables-and-dashboards/BIS,LBS_A1,1.0"]');
      await expect(summaryTable).toBeVisible();
      await expect(summaryTable).toContainText("A1");
      await expect(summaryTable).toContainText(/Summary of locational statistics/i);
    });

    await it.step(`2. Navigate to \`/topics/DSS/tables-and-dashboards\``, async () => {
      await gotoPath(page, "/topics/DSS/tables-and-dashboards");

      await expect(page).toHaveTitle(/Debt securities statistics - tables & dashboards \| BIS Data Portal/);
      await expect(page.getByRole("heading", { level: 1, name: "Debt securities statistics" })).toBeVisible();

      const pageNavigation = page.locator("main").getByRole("navigation", { name: "Page navigation" });
      await expect(pageNavigation.getByRole("link", { name: "Tables & dashboards" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      const tables = page.locator("main").getByRole("region", { name: "Tables" });
      const globalTab = tables.getByRole("tab", { name: "Global" });
      const countryTab = tables.getByRole("tab", { name: "Country" });
      const climateFinanceTab = tables.getByRole("tab", { name: "Climate finance" });

      await expect(globalTab).toHaveAttribute("aria-selected", "true");
      await expect(countryTab).toHaveAttribute("aria-selected", "false");
      await expect(climateFinanceTab).toHaveAttribute("aria-selected", "false");
      const globalTable = tables.locator('a[href="/topics/DSS/tables-and-dashboards/BIS,SEC_C1,1.0"]');
      await expect(globalTable).toBeVisible();
      await expect(globalTable).toContainText("C1");
      await expect(globalTable).toContainText(/Summary of debt securities outstanding/i);

      await countryTab.click();
      await expect(countryTab).toHaveAttribute("aria-selected", "true");
      const countryTable = tables.locator('a[href="/topics/DSS/tables-and-dashboards/BIS,SEC_C5_LOCAL,1.0"]');
      await expect(countryTable).toBeVisible();
      await expect(countryTable).toContainText("C5");
      await expect(countryTable).toContainText(/Debt securities issues, amounts outstanding and net transactions/i);

      await climateFinanceTab.click();
      await expect(climateFinanceTab).toHaveAttribute("aria-selected", "true");
      const climateFinanceTable = tables.locator(
        'a[href="/topics/DSS/tables-and-dashboards/BIS,SEC_C5_CLIMATE_A_LOCAL,1.0"]',
      );
      await expect(climateFinanceTable).toBeVisible();
      await expect(climateFinanceTable).toContainText("C5A");
      await expect(climateFinanceTable).toContainText(
        /Green securities issues, amounts outstanding and net transactions/i,
      );
    });
  });
});
