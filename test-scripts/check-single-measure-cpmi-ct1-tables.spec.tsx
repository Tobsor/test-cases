import { expect, test, type Locator, type Page } from "@playwright/test";

async function gotoCpmiTables(page: Page): Promise<void> {
  await page.goto("/topics/CPMI_CT/tables-and-dashboards");
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { level: 1, name: "Retail payments, currency and related indicators" }),
    'The "Retail payments, currency and related indicators" topic page should open',
  ).toBeVisible();
}

async function expectCt1PublicationTable(page: Page, label = "The CT1 overview table should be populated"): Promise<Locator> {
  await expect(page).toHaveURL(/\/topics\/CPMI_CT\/tables-and-dashboards\/BIS,CPMI_CT1,1\.0$/);
  await expect(page).toHaveTitle(/BIS,CPMI_CT1,1\.0/);
  await expect(page.getByRole("heading", { level: 1, name: /CT1: Basic statistical data/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Change publication table" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "publication table date" })).toBeVisible();

  const grid = page.getByRole("grid");
  await expect(grid, label).toBeVisible();
  await expect(grid.getByRole("link", { name: "Argentina" }), "The CT1 overview table should contain country rows").toHaveAttribute(
    "href",
    /\/topics\/CPMI_CT\/tables-and-dashboards\/BIS,CPMI_T1,1\.0\?dimensions=REP_CTY%3AAR$/,
  );
  await expect(grid.getByRole("link", { name: "GDP", exact: true })).toHaveAttribute(
    "href",
    "/topics/CPMI_CT/tables-and-dashboards/BIS,CPMI_CT1_M1,1.0",
  );
  await expect(grid.getByRole("link", { name: "CPI inflation", exact: true })).toHaveAttribute(
    "href",
    "/topics/CPMI_CT/tables-and-dashboards/BIS,CPMI_CT1_M4,1.0",
  );
  await expect(grid.getByRole("link", { name: "774" }), "The CT1 overview table should contain numeric data cells").toHaveAttribute(
    "href",
    "/topics/CPMI_CT/BIS,WS_CPMI_CT1,1.0/A.AR.A.V.A.Z.Z.Z.Z",
  );

  return grid;
}

async function expectSingleMeasureTable(page: Page, tableId: string, label?: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/topics/CPMI_CT/tables-and-dashboards/BIS,${tableId},1\\.0$`));
  await expect(page.getByRole("heading", { level: 1, name: /CT1: Basic statistical data/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Measure" })).toBeVisible();
  await expect(page.getByRole("grid"), label).toBeVisible();
}

test.describe("Check single measure CPMI CT1 tables", () => {
  test("opens CT1 and navigates to GDP and CPI inflation single-measure tables", async ({ page }) => {
    await test.step('1-3. Go to `/`; open "Retail payments, currency and related indicators"; click "Tables & dashboards"', async () => {
      await gotoCpmiTables(page);
    });

    let tablesRegion!: Locator;
    let comparativePanel!: Locator;
    let grid!: Locator;

    await test.step('4. Choose the "Comparative" button under "Tables" on the main part of the page', async () => {
      tablesRegion = page.getByRole("region").filter({ has: page.getByRole("heading", { name: "Tables" }) });
      await expect(tablesRegion.getByRole("tab", { name: "Country" })).toHaveAttribute("aria-selected", "true");

      const comparativeTab = tablesRegion.getByRole("tab", { name: "Comparative" });
      await comparativeTab.click();
      await expect(page).toHaveURL(/activeTab=Comparative/);
      await expect(comparativeTab).toHaveAttribute("aria-selected", "true");

      comparativePanel = tablesRegion.getByRole("tabpanel", { name: "Comparative" });
      await expect(
        comparativePanel.getByRole("heading", { level: 3, name: "Banknotes and coins; transferable deposits" }),
        "Comparative table cards should be shown",
      ).toBeVisible();
      await expect(
        comparativePanel.locator('a[href="/topics/CPMI_CT/tables-and-dashboards/BIS,CPMI_CT1,1.0"]'),
        "The CT1 comparative table card should be available",
      ).toBeVisible();
    });

    await test.step("5. Click on CT1 Basic statistical data", async () => {
      await comparativePanel.getByRole("link").filter({ hasText: /CT1\s*Basic statistical data/i }).click();
      await page.waitForLoadState("domcontentloaded");
    });

    await test.step("6. You should see a populated table", async () => {
      grid = await expectCt1PublicationTable(page);
    });

    await test.step('7. Click on the column header "CPI Inflation"', async () => {
      await grid.getByRole("link", { name: "CPI inflation", exact: true }).click();
      await page.waitForLoadState("domcontentloaded");
      const label = "The CPI inflation single-measure table should be populated by country and year";

      await expectSingleMeasureTable(page, "CPMI_CT1_M4", label);
      await expect
        .poll(() => page.getByRole("grid").getByRole("columnheader").getByText(/^20\d{2}$/).count(), { message: label })
        .toBeGreaterThan(0);
      await expect(page.getByRole("grid").getByRole("gridcell", { name: "Argentina" }), label).toBeVisible();
    });

    await test.step("8. Click the back button on the browser to return to the CT1 overview table", async () => {
      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
      grid = await expectCt1PublicationTable(page, "The browser back button should return to the CT1 overview table");
    });

    await test.step('9. Click on the column header for the first column "GDP"', async () => {
      await grid.getByRole("link", { name: "GDP", exact: true }).click();
      await page.waitForLoadState("domcontentloaded");
      const label = "The GDP single-measure table should be populated by country and year";

      await expectSingleMeasureTable(page, "CPMI_CT1_M1", label);
      await expect
        .poll(() => page.getByRole("grid").getByRole("columnheader").getByText(/^20\d{2}$/).count(), { message: label })
        .toBeGreaterThan(0);
      await expect(page.getByRole("grid").getByRole("gridcell", { name: "Argentina" }), label).toBeVisible();
    });
  });
});
