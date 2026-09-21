import { expect, test, type Locator, type Page } from "@playwright/test";

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

  return pathOrUrl.startsWith("/") ? `${BASE_URL}${pathOrUrl}` : `${BASE_URL}/${pathOrUrl}`;
}

async function openFilters(page: Page): Promise<void> {
  const filters = page.getByRole("button", { name: "Filters" });
  if ((await filters.getAttribute("aria-expanded")) !== "true") {
    await filters.click();
  }
  await expect(page.getByRole("region", { name: "Filters" })).toBeVisible();
}

async function openFilter(page: Page, name: string): Promise<void> {
  await openFilters(page);
  const filter = page.getByRole("button", { name: new RegExp(`^${name} filter collapsed`, "i") });
  await filter.scrollIntoViewIfNeeded();
  await filter.click();
  await expect(page.getByPlaceholder(`Filter ${name} ...`)).toBeVisible();
}

function filterOption(page: Page, value: string): Locator {
  return page.getByRole("option", { name: new RegExp(`^${escapeRegExp(value)}\\s+Chip$`) });
}

function filterOptionCheckbox(page: Page, value: string): Locator {
  return page.getByRole("checkbox", { name: value });
}

async function filterOptionCount(page: Page, value: string): Promise<number> {
  const countText = await filterOption(page, value).locator('[aria-label="Chip"]').innerText();
  return Number(countText.trim());
}

async function chooseFilterValue(page: Page, value: string): Promise<void> {
  await filterOption(page, value).locator("label.checkbox__label").click();
}

async function expectFilterOptionChecked(page: Page, value: string): Promise<void> {
  await expect(filterOptionCheckbox(page, value)).toBeChecked();
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toBeHidden();
}

async function setView(page: Page, name: "List" | "Table"): Promise<void> {
  const view = page.getByRole("radiogroup", { name: "view switch" }).getByRole("radio", { name });
  await view.click();
  await expect(view).toHaveAttribute("aria-checked", "true");
}

function resultsToolbar(page: Page): Locator {
  return page.getByRole("toolbar").filter({ hasText: /time series found/i });
}

async function expectTimeSeriesFound(page: Page, expectedCount: number): Promise<void> {
  await expect(resultsToolbar(page).getByText(`${expectedCount} time series found`)).toBeVisible();
}

function tableSettingsSection(page: Page, name: "Rows" | "Columns"): Locator {
  return page.locator(".CustomTableSection_root__k7v46").filter({
    has: page.locator("strong", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
  });
}

function tableSettingsChip(page: Page, sectionName: "Rows" | "Columns", chipName: string): Locator {
  return tableSettingsSection(page, sectionName)
    .locator(".CustomTableChip_root__NHP4L")
    .filter({ has: page.locator(".chip__label", { hasText: new RegExp(`^${escapeRegExp(chipName)}$`) }) });
}

function tableSettingsSelectValue(page: Page, label: string): Locator {
  return page
    .locator(".CustomTableSorter_group__vWixt")
    .filter({ has: page.locator("label", { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
    .locator(".select__single-value");
}

async function dragTableSettingsChip(page: Page, chipName: string, from: "Rows" | "Columns", to: "Rows" | "Columns"): Promise<void> {
  await tableSettingsChip(page, from, chipName).dragTo(tableSettingsSection(page, to).locator(".CustomTableConfigurator_dragArea__FHU1Q"));
}

async function expectSelectedFilters(page: Page, expectedTimeSeriesCount: number): Promise<void> {
  await expect(page.getByRole("button", { name: /Reference area filter (expanded|collapsed), click to (collapse|expand)/ })).toContainText(
    /Reference area:\s*Sweden \[SE\]\s*\+1/,
  );
  await expect(page.getByRole("button", { name: /Unit of measure filter (expanded|collapsed), click to (collapse|expand)/ })).toContainText(
    "Unit of measure: Index, 2010 = 100 [628]",
  );
  await expectTimeSeriesFound(page, expectedTimeSeriesCount);
}

async function expectFinalTableSettings(page: Page): Promise<void> {
  await expect(tableSettingsSection(page, "Rows").locator(".chip__label")).toHaveText(["Period"]);
  await expect(tableSettingsSection(page, "Columns").locator(".chip__label")).toHaveText(["Reference area", "Frequency"]);
}

async function expectFinalTableLayout(page: Page): Promise<void> {
  const grid = page.locator(".ag-root");

  await expect(grid.getByRole("columnheader", { name: "Period" })).toBeVisible();
  await expect(grid.getByRole("gridcell", { name: /^20\d{2}-\d{2}-\d{2}$/ }).first()).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: "Sweden" })).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: "Switzerland" })).toBeVisible();
  await expect.poll(() => grid.getByRole("columnheader", { name: "Annual" }).count()).toBeGreaterThanOrEqual(2);
  await expect.poll(() => grid.getByRole("columnheader", { name: "Monthly" }).count()).toBeGreaterThanOrEqual(2);
}

async function expectInitialTableSettings(page: Page): Promise<void> {
  await expect(tableSettingsSection(page, "Rows").locator(".chip__label")).toHaveText(["Frequency", "Reference area"]);
  await expect(tableSettingsSection(page, "Columns").locator(".chip__label")).toHaveText(["Period"]);
  await expect(tableSettingsSelectValue(page, "Alphabetical sort")).toHaveText("Ascending");
  await expect(tableSettingsSelectValue(page, "Period/Date sort")).toHaveText("Descending");
  await expect(tableSettingsSelectValue(page, "Display")).toHaveText("Name");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const it = test;

test.describe(`Custom Table with Filters`, () => {
  test(`Custom Table with Filters`, async ({ page }) => {
    let expectedReferenceAreaTimeSeriesCount!: number;
    let expectedUnitMeasureTimeSeriesCount!: number;

    await it.step(`1. Go to \`/topics/CPI/data\``, async () => {
      await gotoPath(page, "/topics/CPI/data");
    });

    await it.step(`2. Click on _Reference area_ filter`, async () => {
      await openFilter(page, "Reference area");
    });

    await it.step(`3. Filter for _Sw_`, async () => {
      await page.getByPlaceholder("Filter Reference area ...").fill("Sw");
      await expect(filterOption(page, "Sweden[SE]")).toBeVisible();
      await expect(filterOption(page, "Switzerland[CH]")).toBeVisible();
    });

    await it.step(`4. Select _Sweden_ and _Switzerland_`, async () => {
      expectedReferenceAreaTimeSeriesCount = (await filterOptionCount(page, "Sweden[SE]")) + (await filterOptionCount(page, "Switzerland[CH]"));

      await chooseFilterValue(page, "Sweden[SE]");
      await chooseFilterValue(page, "Switzerland[CH]");
      await expectFilterOptionChecked(page, "Sweden[SE]");
      await expectFilterOptionChecked(page, "Switzerland[CH]");
      await expect(page.getByRole("button", { name: /^Reference area filter expanded, click to collapse$/ })).toContainText(
        /Reference area:\s*Sweden \[SE\]\s*\+1/,
      );
      await expectTimeSeriesFound(page, expectedReferenceAreaTimeSeriesCount);
    });

    await it.step(`5. Click on _Unit of measure_ filter`, async () => {
      await closeOpenFilter(page);
      await page.mouse.wheel(0, 400);
      await openFilter(page, "Unit of measure");
    });

    await it.step(`6. Select _Index, 2010 = 100_`, async () => {
      await expectTimeSeriesFound(page, expectedReferenceAreaTimeSeriesCount);
      expectedUnitMeasureTimeSeriesCount = await filterOptionCount(page, "Index, 2010 = 100[628]");

      await chooseFilterValue(page, "Index, 2010 = 100[628]");
      await expectFilterOptionChecked(page, "Index, 2010 = 100[628]");
      await expectSelectedFilters(page, expectedUnitMeasureTimeSeriesCount);
    });

    await it.step(`7. Close filter`, async () => {
      await closeOpenFilter(page);
      await expectSelectedFilters(page, expectedUnitMeasureTimeSeriesCount);
    });

    await it.step(`8. Click on _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expect(page).toHaveURL(/[?&]data_view=table/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expectInitialTableSettings(page);
    });

    await it.step(`9. Click on _Table Settings_`, async () => {
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
    });

    await it.step(`10. Move _Period_ to _Rows_`, async () => {
      await expect(tableSettingsChip(page, "Columns", "Period")).toBeVisible();
      await dragTableSettingsChip(page, "Period", "Columns", "Rows");
      await expect(tableSettingsChip(page, "Rows", "Period")).toBeVisible();
      await expect(tableSettingsSection(page, "Columns").locator(".chip__label")).toHaveCount(0);
    });

    await it.step(`11. Move _Frequency_ and _Reference Area_ to _Columns_`, async () => {
      await expect(tableSettingsChip(page, "Rows", "Frequency")).toBeVisible();
      await expect(tableSettingsChip(page, "Rows", "Reference area")).toBeVisible();
      await dragTableSettingsChip(page, "Reference area", "Rows", "Columns");
      await dragTableSettingsChip(page, "Frequency", "Rows", "Columns");
      await expectFinalTableSettings(page);
    });

    await it.step(`12. Make sure _Reference area_ comes before _Frequency_`, async () => {
      await expectFinalTableLayout(page);
    });

    await it.step(`13. Refresh page`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await expectSelectedFilters(page, expectedUnitMeasureTimeSeriesCount);
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expectFinalTableSettings(page);
      await expectFinalTableLayout(page);
    });
  });
});
