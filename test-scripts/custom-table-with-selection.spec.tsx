import { expect, test, type Page } from "@playwright/test";

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
  const input = page.getByRole("combobox", { name: "Search for time series" });
  await expect(input).toBeVisible();
  await input.fill(term);
  await input.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/i);
}

async function setView(page: Page, name: "List" | "Table"): Promise<void> {
  const view = page.getByRole("radiogroup", { name: "view switch" }).getByRole("radio", { name });
  await view.click();
  await expect(view).toHaveAttribute("aria-checked", "true");
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
  // Leave room below the trigger for the Timespan menu and its tabs.
  await filter.hover();
  await page.mouse.wheel(0, 400);
  await filter.click();
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("dialog")).toBeHidden();
}

async function expectMainEventuallyContains(page: Page, expected: string): Promise<void> {
  await expect
    .poll(async () => page.getByRole("main").innerText(), { timeout: 60_000 })
    .toContain(expected);
}

async function expectSelectedTable(page: Page, year: string): Promise<void> {
  const grid = page.getByRole("treegrid");
  await expect(grid).toBeVisible();
  const referenceAreaHeader = grid.getByRole("columnheader", { name: "Reference area", exact: true });
  await expect(referenceAreaHeader).toBeVisible();
  const columnId = await referenceAreaHeader.getAttribute("col-id");
  if (!columnId) throw new Error("Reference area header is missing its column identifier");
  const referenceAreas = grid.getByRole("gridcell").and(grid.locator(`[col-id="${columnId}"]`));
  await expect.poll(async () => (await referenceAreas.allInnerTexts()).map((value) => value.trim()).sort())
    .toEqual(["Sweden", "Switzerland"]);

  const dateHeaders = grid.getByRole("columnheader", { name: /^\d{4}-\d{2}-\d{2}$/ });
  await expect(dateHeaders.first()).toBeVisible();
  await expect.poll(async () => {
    const dates = await dateHeaders.allInnerTexts();
    return dates.length > 0 && dates.every((date) => date.trim().startsWith(`${year}-`));
  }).toBe(true);
}

async function tableRows(page: Page): Promise<string[][]> {
  const grid = page.getByRole("treegrid");
  const rows = grid.getByRole("row").filter({ has: page.getByRole("gridcell") });
  const values: string[][] = [];
  for (const row of await rows.all()) {
    values.push((await row.getByRole("gridcell").allInnerTexts()).map((value) => value.trim()));
  }
  return values;
}

const it = test;

test.describe(`Custom Table with Selection`, () => {
  test(`Custom Table with Selection`, async ({ page }) => {
    let zurichTitle: string;
    let stockholmTitle: string;
    let selectedRows: string[][];
    const searchTerm = "Zurich OR Berlin OR Paris OR Stockholm";
    const selectedYear = "2024";
    await it.step(`1. Go to: \`/topics/RPP/data\``, async () => {
      await gotoPath(page, "/topics/RPP/data");
    });

    await it.step(`2. Click on the _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await expectMainEventuallyContains(page, "The amount of data exceeds the limitation");
      await expect(page.getByRole("main")).toContainText(/Please narrow down the number of time series \/ observations/);
    });

    await it.step(`3. Click on _List_ in the view switch`, async () => {
      await setView(page, "List");
      await expect(page.getByRole("heading", { name: "Time series list", exact: true })).toBeVisible();
    });

    await it.step(`4. Click into search input and type: "Zurich OR Berlin OR Paris OR Stockholm"`, async () => {
      await submitResultSearch(page, searchTerm);
      await expect(page.getByText(/Zurich|Berlin|Paris|Stockholm/).first()).toBeVisible();
    });

    await it.step(`5. Click on the _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expectMainEventuallyContains(page, "Cannot render table");
      await expect(page.getByRole("main")).toContainText("Too many rows or columns are defined");
    });

    await it.step(`6. Click on _List_ in the view switch`, async () => {
      await setView(page, "List");
    });

    await it.step(`7. Click on the _Timespan_ filter`, async () => {
      await openFilter(page, "Timespan");
      await expect(page.getByRole("tab", { name: "Years" })).toBeVisible();
    });

    await it.step(`8. Click on _Years_`, async () => {
      const yearsTab = page.getByRole("tab", { name: "Years" });
      await expect(yearsTab).toBeVisible();
      await yearsTab.click();
    });

    await it.step(`9. Click on one year`, async () => {
      const year = page.getByRole("checkbox", { name: selectedYear, exact: true });
      await expect(year).toBeVisible();
      await year.click();
      await expect(year).toBeChecked();
      await expect(page.getByRole("button", { name: "Clear Years filter", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Years filter / })).toContainText(`Years: ${selectedYear}`);
      await expect(page).toHaveURL(/filter=YEAR%3D2024/);
    });

    await it.step(`10. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.getByRole("main")).toContainText("Years: 2024");
    });

    await it.step(`11. Select only time series containing _Stockholm_ or _Zurich_ in its title`, async () => {
      zurichTitle = await page.getByRole("article").getByRole("link", { name: /Zurich/ }).first().innerText();
      stockholmTitle = await page.getByRole("article").getByRole("link", { name: /Stockholm/ }).first().innerText();
      const zurichSeries = page.getByRole("article").filter({ has: page.getByRole("link", { name: zurichTitle, exact: true }) }).getByRole("checkbox", { name: /^(Select|Unselect) time series$/ });
      const stockholmSeries = page.getByRole("article").filter({ has: page.getByRole("link", { name: stockholmTitle, exact: true }) }).getByRole("checkbox", { name: /^(Select|Unselect) time series$/ });

      await zurichSeries.check();
      await expect(zurichSeries).toBeChecked();
      await expect(page.getByRole("main")).toContainText(/1 selected/);
      await stockholmSeries.check();
      await expect(zurichSeries).toBeChecked();
      await expect(stockholmSeries).toBeChecked();
      await expect(page.getByRole("main")).toContainText(/2 selected/);
    });

    await it.step(`12. Click on the _Table_ view`, async () => {
      await setView(page, "Table");
      await expect(page.getByRole("radio", { name: "Table" })).toHaveAttribute("aria-checked", "true");
      await expectSelectedTable(page, selectedYear);
      selectedRows = await tableRows(page);
    });

    await it.step(`13. Refresh page`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page).toHaveURL(/q=Zurich\+OR\+Berlin\+OR\+Paris\+OR\+Stockholm/);
      await expect(page).toHaveURL(/YEAR%3D2024/);
      await expect(page.getByRole("main")).toContainText(/2 selected/);
      await expect(page.getByRole("combobox", { name: "Search for time series" })).toHaveValue(searchTerm);
      await expectSelectedTable(page, selectedYear);
      await expect.poll(() => tableRows(page)).toEqual(selectedRows);
    });

    await it.step(`14. Click on _List_ view`, async () => {
      await setView(page, "List");
      await expect(page.getByRole("article").filter({ has: page.getByRole("link", { name: zurichTitle, exact: true }) }).getByRole("checkbox", { name: /^(Select|Unselect) time series$/ })).toBeChecked();
      await expect(page.getByRole("article").filter({ has: page.getByRole("link", { name: stockholmTitle, exact: true }) }).getByRole("checkbox", { name: /^(Select|Unselect) time series$/ })).toBeChecked();
    });
  });
});
