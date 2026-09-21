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
  const input = page.locator("main").getByRole("combobox", { name: "Search for time series" });
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
  await filter.click();
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toBeHidden();
}

async function expectMainEventuallyContains(page: Page, expected: string): Promise<void> {
  await expect
    .poll(async () => page.locator("main").innerText(), { timeout: 60_000 })
    .toContain(expected);
}

const it = test;

test.describe(`Custom Table with Selection`, () => {
  test(`Custom Table with Selection`, async ({ page }) => {
    await it.step(`1. Go to: \`/topics/RPP/data\``, async () => {
      await gotoPath(page, "/topics/RPP/data");
    });

    await it.step(`2. Click on the _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expect(page.getByRole("heading", { name: "Table", exact: true })).toBeVisible();
      await expectMainEventuallyContains(page, "The amount of data exceeds the limitation");
      await expect(page.locator("main")).toContainText(/Please narrow down the number of time series \/ observations/);
    });

    await it.step(`3. Click on _List_ in the view switch`, async () => {
      await setView(page, "List");
      await expect(page.getByRole("heading", { name: "Time series list", exact: true })).toBeVisible();
    });

    await it.step(`4. Click into search input and type: "Zurich OR Berlin OR Paris OR Stockholm"`, async () => {
      await submitResultSearch(page, "Zurich OR Berlin OR Paris OR Stockholm");
      await expect(page.getByText(/Zurich|Berlin|Paris|Stockholm/).first()).toBeVisible();
    });

    await it.step(`5. Click on the _Table_ Switch`, async () => {
      await setView(page, "Table");
      await expectMainEventuallyContains(page, "Cannot render table");
      await expect(page.locator("main")).toContainText("Too many rows or columns are defined");
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
      await yearsTab.evaluate((element) => (element as HTMLElement).click());
    });

    await it.step(`9. Click on one year`, async () => {
      const year = page.locator("label.checkbox__label").filter({ hasText: /^2024$/ }).first();
      await expect(year).toBeVisible();
      await year.evaluate((element) => {
        const inputId = element.getAttribute("for");
        if (!inputId) {
          throw new Error("Year option label is missing an associated input");
        }
        document.getElementById(inputId)?.click();
      });
      await expect(page).toHaveURL(/filter=YEAR%3D2024/);
    });

    await it.step(`10. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.locator("main")).toContainText("Years: 2024");
    });

    await it.step(`11. Select only time series containing _Stockholm_ or _Zurich_ in its title`, async () => {
      const zurichSeries = page.locator("article").filter({ hasText: /Zurich/ }).getByLabel("Select time series").first();
      const stockholmSeries = page.locator("article").filter({ hasText: /Stockholm/ }).getByLabel("Select time series").first();

      await zurichSeries.check();
      await stockholmSeries.check();
      await expect(zurichSeries).toBeChecked();
      await expect(stockholmSeries).toBeChecked();
      await expect(page.locator("main")).toContainText(/2 selected/);
    });

    await it.step(`12. Click on the _Table_ view`, async () => {
      await setView(page, "Table");
      await expect(page.getByRole("radio", { name: "Table" })).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("main")).toContainText("Switzerland");
      await expect(page.locator("main")).toContainText("Sweden");
      await expect(page.locator("main")).toContainText("2024");
    });

    await it.step(`13. Refresh page`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]data_view=table/);
      await expect(page).toHaveURL(/q=Zurich\+OR\+Berlin\+OR\+Paris\+OR\+Stockholm/);
      await expect(page).toHaveURL(/YEAR%3D2024/);
      await expect(page.locator("main")).toContainText(/2 selected/);
    });

    await it.step(`14. Click on _List_ view`, async () => {
      await setView(page, "List");
      await expect(page.locator("article").filter({ hasText: /Zurich/ }).getByLabel("Select time series").first()).toBeChecked();
      await expect(page.locator("article").filter({ hasText: /Stockholm/ }).getByLabel("Select time series").first()).toBeChecked();
    });
  });
});
