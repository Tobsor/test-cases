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

async function submitResultSearch(page: Page, term: string): Promise<void> {
  const input = main(page).getByRole("combobox", { name: "Search for time series" });
  await expect(input).toBeVisible();
  await input.fill(term);
  await input.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/i);
}

function main(page: Page): Locator {
  return page.getByRole("main");
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
  const filter = page.getByRole("button", { name: new RegExp(`^${name} filter (collapsed|expanded)`, "i") });
  await filter.scrollIntoViewIfNeeded();
  if ((await filter.getAttribute("aria-expanded")) !== "true") {
    await filter.click();
    return;
  }

  if (!(await filterPopoverIsVisible(page))) {
    await filter.click();
    await expect(filter).toHaveAttribute("aria-expanded", "false");
    await filter.click();
  }
}

async function ensureTimespanLastObservationsOpen(page: Page): Promise<void> {
  if (!(await filterPopoverIsVisible(page))) {
    await openFilter(page, "Timespan");
  }

  await page.getByRole("tab", { name: "Last ..." }).click();
  await page.getByRole("radio", { name: "Observations" }).click();
  await expect(page.getByRole("radio", { name: "Observations" })).toHaveAttribute("aria-checked", "true");
}

async function filterPopoverIsVisible(page: Page): Promise<boolean> {
  return (
    (await page.getByRole("menu").isVisible().catch(() => false)) ||
    (await page.getByRole("dialog").isVisible().catch(() => false))
  );
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("dialog")).toBeHidden();
}

function filterOption(page: Page, value: RegExp): Locator {
  return page.getByRole("option", { name: value });
}

async function filterOptionCount(page: Page, value: RegExp): Promise<number> {
  const optionText = await filterOption(page, value).innerText();
  const match = optionText.match(/\n(\d+)\s*$/);
  if (!match) {
    throw new Error(`Could not read the right-hand count from option: ${optionText}`);
  }
  return Number(match[1]);
}

async function chooseFilterValue(page: Page, value: RegExp): Promise<void> {
  await filterOption(page, value).click();
}

async function expectFilterOptionChecked(page: Page, value: RegExp): Promise<void> {
  await expect(filterOption(page, value).getByRole("checkbox", { name: value })).toBeChecked();
}

function resultsToolbar(page: Page): Locator {
  return page.getByRole("toolbar").filter({ hasText: /time series found/i });
}

async function expectTimeSeriesFoundSection(page: Page): Promise<void> {
  await expect(resultsToolbar(page).getByText(/time series found/i)).toBeVisible();
}

async function expectTimeSeriesFoundCount(page: Page, expectedCount: number): Promise<void> {
  await expect(resultsToolbar(page).getByText(`${expectedCount} time series found`)).toBeVisible();
}

async function setView(page: Page, name: "List" | "Table"): Promise<void> {
  const view = page.getByRole("radiogroup", { name: "view switch" }).getByRole("radio", { name });
  await view.click();
  await expect(view).toHaveAttribute("aria-checked", "true");
}

function tableSettingsSection(page: Page, name: "Rows" | "Columns" | "Sorting & Display"): Locator {
  return main(page).locator('[class*="CustomTableSection_root"]').filter({ has: page.getByText(name, { exact: true }) });
}

function tableSettingsChip(page: Page, sectionName: "Rows" | "Columns", chipName: string): Locator {
  return tableSettingsSection(page, sectionName).getByRole("listitem").filter({ hasText: new RegExp(`^${escapeRegExp(chipName)}$`) });
}

async function tableSettingsChipLabels(page: Page, sectionName: "Rows" | "Columns"): Promise<Array<string>> {
  const lists = await tableSettingsLists(page);
  return sectionName === "Rows" ? lists[0] : lists[1];
}

async function expectTableSettingsSection(page: Page, sectionName: "Rows" | "Columns", labels: Array<string>): Promise<void> {
  await expect.poll(() => tableSettingsChipLabels(page, sectionName)).toEqual(labels);
}

async function expectInitialTableSettings(page: Page): Promise<void> {
  await expectTableSettingsSection(page, "Columns", ["Period"]);
  await expectTableSettingsSection(page, "Rows", [
    "Reference area",
    "Covered area",
    "Real estate type",
    "Real estate vintage",
    "Priced unit",
    "Adjustment - coded",
  ]);
  await expectTableSettingValue(page, "Alphabetical sort", "Ascending");
  await expectTableSettingValue(page, "Period/Date sort", "Descending");
  await expectTableSettingValue(page, "Display", "Name");
}

async function expectReorderedDimensions(page: Page): Promise<void> {
  const dimensions = ["Reference area", "Real estate type", "Covered area"];
  await expectTableSettingsSection(page, "Rows", dimensions);
  await expectTableSettingsSection(page, "Columns", ["Period"]);
  const dimensionHeaders = dataGrid(page).getByRole("columnheader").filter({
    hasText: /Reference area|Real estate type|Covered area/,
  });
  await expect(dimensionHeaders).toHaveCount(dimensions.length);
  await expect(dimensionHeaders).toContainText(dimensions);
}

function dataGrid(page: Page): Locator {
  return page.getByRole("treegrid");
}

async function waitForDataGrid(page: Page): Promise<void> {
  await expect(dataGrid(page)).toBeVisible({ timeout: 60_000 });
  await expect(dataGrid(page).getByRole("columnheader").first()).toBeVisible({ timeout: 60_000 });
}

async function expectRenderedTimeSeriesCount(page: Page, expectedCount: number): Promise<void> {
  const cards = main(page).getByRole("article");
  if ((await cards.count()) > 0) {
    await expect(cards).toHaveCount(expectedCount);
    return;
  }

  await expect.poll(() => observationValueRows(page)).toHaveLength(expectedCount);
}

async function expectReferenceAreasInGrid(page: Page, expectedAreas: Array<string>): Promise<void> {
  for (const area of expectedAreas) {
    await expect(dataGrid(page).getByRole("gridcell", { name: new RegExp(area) }).first()).toBeVisible();
  }
}

async function observationHeaderDates(page: Page): Promise<Array<string>> {
  const dates = await dataGrid(page).getByRole("columnheader").allInnerTexts();
  return dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
}

async function expectObservationHeadersSorted(page: Page, direction: "ascending" | "descending"): Promise<void> {
  await expect.poll(() => observationHeaderDates(page), { timeout: 60_000 }).not.toHaveLength(0);
  const dates = await observationHeaderDates(page);
  const sorted = [...dates].sort();
  if (direction === "descending") {
    sorted.reverse();
  }
  expect(dates).toEqual(sorted);
}

async function expectAtMostObservationValuesPerRow(page: Page, maxValues: number): Promise<void> {
  const valueCounts: Array<number> = [];
  const rows = dataGrid(page).getByRole("row");
  for (let index = 0; index < (await rows.count()); index += 1) {
    const links = rows.nth(index).getByRole("link", { name: /^\d/ });
    const count = await links.count();
    if (count > 0) {
      valueCounts.push(count);
    }
  }

  expect(valueCounts.length).toBeGreaterThan(0);
  expect(valueCounts.every((count) => count <= maxValues)).toBeTruthy();
}

async function expectNonObservationValuesUseCodeAndName(page: Page): Promise<void> {
  const values: Array<string> = [];
  const cells = dataGrid(page).getByRole("gridcell");
  for (let index = 0; index < (await cells.count()); index += 1) {
    const cell = cells.nth(index);
    if ((await cell.getByRole("link").count()) === 0) {
      const value = (await cell.innerText()).trim();
      if (value) {
        values.push(value);
      }
    }
  }

  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).toMatch(/\[[^\]]+\]\s+\S/);
  }
}

async function observationValueRows(page: Page): Promise<Array<string>> {
  const rowTexts: Array<string> = [];
  const rows = dataGrid(page).getByRole("row");
  for (let index = 0; index < (await rows.count()); index += 1) {
    if ((await rows.nth(index).getByRole("link", { name: /^\d/ }).count()) > 0) {
      rowTexts.push(await rows.nth(index).innerText());
    }
  }
  return rowTexts;
}

async function expectTableSettingValue(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await expect(page.getByRole("option", { name: value, exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
}

async function expectSearchResultCardsRepresent(page: Page, expected: Array<{ city: string; country: string }>): Promise<void> {
  const cards = main(page).getByRole("article");
  await expect(cards.first()).toBeVisible();
  const cardTexts = await cards.allInnerTexts();

  for (const { city, country } of expected) {
    const represented = cardTexts.some((text) => new RegExp(`${escapeRegExp(country)}[\\s\\S]*${escapeRegExp(city)}`, "i").test(text));
    expect(represented).toBeTruthy();
  }
}

async function expectFilterSummary(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: /Compiling agency filter (expanded|collapsed), click to (collapse|expand)/ }),
  ).toContainText("Compiling agency: Private sector [2]");
  await expect(
    page.getByRole("button", { name: /Seasonal adjustment filter (expanded|collapsed), click to (collapse|expand)/ }),
  ).toContainText("Seasonal adjustment: Non seasonally adjusted [0]");
  await expect(
    page.getByRole("button", { name: /Timespan filter (expanded|collapsed), click to (collapse|expand)/ }),
  ).toContainText("Timespan: Last 4 observation(s)");
}

async function tableSettingsLists(page: Page): Promise<Array<Array<string>>> {
  const listTexts = await main(page).getByRole("list").allInnerTexts();
  return listTexts
    .map((text) => text.split("\n").map((label) => label.replace(/[^\w\s/&-]/g, "").trim()).filter(Boolean))
    .filter((labels) => !labels.includes("Overview"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const it = test;

test.describe(`Custom Table with Search`, () => {
  test(`Custom Table with Search`, async ({ page }) => {
    let expectedPrivateSectorTimeSeriesCount!: number;
    let expectedNonSeasonallyAdjustedTimeSeriesCount!: number;
    let initialRowItemCount!: number;

    await it.step(`1. Go to: \`/topics/RPP/data\``, async () => {
      await gotoPath(page, "/topics/RPP/data");
    });

    await it.step(`2. Click into search input and type: "Zurich OR Berlin OR Paris"`, async () => {
      await submitResultSearch(page, "Zurich OR Berlin OR Paris");
      await expectTimeSeriesFoundSection(page);
    });

    await it.step(`3. Click on _Compiling agency_ filter`, async () => {
      await openFilter(page, "Compiling agency");
      await expect(page.getByPlaceholder("Filter Compiling agency ...")).toBeVisible();
    });

    await it.step(`4. Click on _Private sector_`, async () => {
      expectedPrivateSectorTimeSeriesCount = await filterOptionCount(page, /Private sector\[2\]/);
      await chooseFilterValue(page, /Private sector\[2\]/);
      await expectFilterOptionChecked(page, /Private sector\[2\]/);
      await expect(page.getByRole("button", { name: "Clear Compiling agency filter", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Compiling agency filter / })).toContainText("Compiling agency: Private sector [2]");
      await expect(page).toHaveURL(/filter=COMPILING_ORG%3D2/);
      await expectTimeSeriesFoundCount(page, expectedPrivateSectorTimeSeriesCount);
      await expectSearchResultCardsRepresent(page, [
        { city: "Zurich", country: "Switzerland" },
        { city: "Berlin", country: "Germany" },
        { city: "Paris", country: "France" },
      ]);
    });

    await it.step(`6. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.getByRole("button", { name: /Compiling agency filter collapsed, click to expand/ })).toContainText(
        "Compiling agency: Private sector [2]",
      );
    });

    await it.step(`7. Click on the _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await waitForDataGrid(page);
      await expect(page.getByLabel("Select time series")).toHaveCount(0);
    });

    await it.step(`8. Click on table settings`, async () => {
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expectInitialTableSettings(page);
      initialRowItemCount = (await tableSettingsChipLabels(page, "Rows")).length;
    });

    await it.step(`9. Click into filter _Seasonal adjustment_`, async () => {
      await page.getByRole("button", { name: "Close table settings" }).click();
      await openFilter(page, "Seasonal adjustment");
    });

    await it.step(`10. Click on _Non seasonally adjusted_`, async () => {
      expectedNonSeasonallyAdjustedTimeSeriesCount = await filterOptionCount(page, /Non seasonally adjusted\[0\]/);
      await chooseFilterValue(page, /Non seasonally adjusted\[0\]/);
      await expectFilterOptionChecked(page, /Non seasonally adjusted\[0\]/);
      await expect(page.getByRole("button", { name: "Clear Seasonal adjustment filter", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Seasonal adjustment filter / })).toContainText("Seasonal adjustment: Non seasonally adjusted [0]");
      await expectTimeSeriesFoundCount(page, expectedNonSeasonallyAdjustedTimeSeriesCount);
      await expectRenderedTimeSeriesCount(page, expectedNonSeasonallyAdjustedTimeSeriesCount);
      await closeOpenFilter(page);
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expect((await tableSettingsChipLabels(page, "Rows")).length).toBeLessThan(initialRowItemCount);
      await page.getByRole("button", { name: "Close table settings" }).click();
      await expectReferenceAreasInGrid(page, ["Germany", "Switzerland"]);
    });

    await it.step(`11. Click on the _Timespan_ filter`, async () => {
      await openFilter(page, "Timespan");
      await expect(page.getByRole("tab", { name: "Last ..." })).toBeVisible();
    });

    await it.step(`12. Click on _Last ..._`, async () => {
      await page.getByRole("tab", { name: "Last ..." }).click();
    });

    await it.step(`13. Click on _Observations_`, async () => {
      await page.getByRole("radio", { name: "Observations" }).click();
      await expect(page.getByRole("radio", { name: "Observations" })).toHaveAttribute("aria-checked", "true");
    });

    await it.step(`14. Select _4_`, async () => {
      await page.getByRole("button", { name: "4", exact: true }).click();
      await expect(page).toHaveURL(/LAST_N_OBSERVATIONS%3D4/);
      await expect(page.getByRole("button", { name: /Timespan filter (expanded|collapsed), click to (collapse|expand)/ })).toContainText(
        "Timespan: Last 4 observation(s)",
      );
      await ensureTimespanLastObservationsOpen(page);
      await expect(page.getByRole("dialog").getByRole("button", { name: "4", exact: true })).toBeVisible();
      await expect(page.getByRole("spinbutton", { name: "Amount of observations:" })).toHaveValue("4");
      await expectAtMostObservationValuesPerRow(page, 4);
      await expectObservationHeadersSorted(page, "descending");
    });

    await it.step(`15. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.getByRole("button", { name: /Timespan filter collapsed, click to expand/ })).toContainText(
        "Timespan: Last 4 observation(s)",
      );
    });

    await it.step(`16. Click on _Period/Date sort_`, async () => {
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await page.getByLabel("Period/Date sort", { exact: true }).click();
      await expect(page.getByRole("option", { name: "Ascending", exact: true })).toBeVisible();
    });

    await it.step(`17. Select _Ascending_`, async () => {
      await page.getByRole("option", { name: "Ascending", exact: true }).click();
      await expectTableSettingValue(page, "Period/Date sort", "Ascending");
      await expect(page).toHaveURL(/LAST_N_OBSERVATIONS%3D4/);
      await expectObservationHeadersSorted(page, "ascending");
    });

    await it.step(`18. Click on _Display_`, async () => {
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await page.getByLabel("Display", { exact: true }).click();
      await expect(page.getByRole("option", { name: "Code & Name", exact: true })).toBeVisible();
    });

    await it.step(`19. Select _Code & Name_`, async () => {
      await page.getByRole("option", { name: "Code & Name", exact: true }).click();
      await expectTableSettingValue(page, "Display", "Code & Name");
      await expectNonObservationValuesUseCodeAndName(page);
    });

    await it.step(`20. Move chip _Real estate type_ before _Covered area_ within _Rows_ and verify column header order`, async () => {
      const source = tableSettingsChip(page, "Rows", "Real estate type");
      await source.scrollIntoViewIfNeeded();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error("Real estate type chip has no bounding box");
      await source.hover();
      await page.mouse.down();
      try {
        // Start the native drag so the insertion drop zones become visible.
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 10, { steps: 5 });
        const targetChip = tableSettingsChip(page, "Rows", "Covered area");
        await targetChip.hover();
        await targetChip.hover();
        const target = targetChip.locator('[class*="CustomTableDropzone_root"]');
        await expect(target).toBeVisible();
        await target.hover();
        await target.hover();
      } finally {
        await page.mouse.up();
      }
      await expectReorderedDimensions(page);
    });

    await it.step(`21. Refresh page`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page).toHaveURL(/q=Zurich\+OR\+Berlin\+OR\+Paris/);
      await expect(page).toHaveURL(/COMPILING_ORG%3D2/);
      await expect(page).toHaveURL(/LAST_N_OBSERVATIONS%3D4/);
    });

    await it.step(`22. Click on _Table settings_`, async () => {
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expectReorderedDimensions(page);
      await expectTableSettingValue(page, "Alphabetical sort", "Ascending");
      await expectTableSettingValue(page, "Period/Date sort", "Ascending");
      await expectTableSettingValue(page, "Display", "Code & Name");
    });

    await it.step(`23. Click observational value in the table`, async () => {
      const valueCell = dataGrid(page).getByRole("link", { name: /\d{2,3}[,.]\d/ }).first();
      await expect(valueCell).toBeVisible();
      await valueCell.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/RPP\/BIS,/);
    });

    await it.step(`24. Click on _Back_ next to the bread crumb`, async () => {
      await page.getByRole("link", { name: "Back" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await waitForDataGrid(page);
      await expectFilterSummary(page);
      await page.getByRole("button", { name: "Open table settings" }).click();
      await expect(page.getByRole("button", { name: "Close table settings" })).toBeVisible();
      await expectReorderedDimensions(page);
      await expectTableSettingValue(page, "Alphabetical sort", "Ascending");
      await expectTableSettingValue(page, "Period/Date sort", "Ascending");
      await expectTableSettingValue(page, "Display", "Code & Name");
    });
  });
});
