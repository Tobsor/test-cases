import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, pathOrUrl: string): Promise<void> {
  const url = pathOrUrl.startsWith("http") ? new URL(pathOrUrl).pathname + new URL(pathOrUrl).search : pathOrUrl;
  await page.goto(`${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`);
  await page.waitForLoadState("domcontentloaded");
}

async function openFilter(page: Page, name: string): Promise<void> {
  const filter = page.getByRole("region", { name: "Filters", exact: true }).getByRole("button", { name: new RegExp(`^${name} filter `) });
  await filter.scrollIntoViewIfNeeded();
  await filter.click();
}

async function chooseFilterValue(page: Page, value: RegExp): Promise<void> {
  const checkbox = page.getByRole("checkbox", { name: value }).first();
  await expect(checkbox).toBeVisible();
  await checkbox.click();
}

async function expectFilterOptionChecked(page: Page, value: RegExp): Promise<void> {
  await expect(page.getByRole("checkbox", { name: value }).first()).toBeChecked();
}

async function optionCount(page: Page, name: RegExp): Promise<number> {
  const chip = page.getByRole("option", { name }).locator('[aria-label="Chip"]');
  await expect(chip).toHaveText(/^\d+$/);
  return Number(await chip.innerText());
}

async function expectResultCount(page: Page, count: number): Promise<void> {
  const toolbar = page.getByRole("region", { name: "Time series list", exact: true }).getByRole("toolbar");
  await expect(toolbar.getByText(`${count} time series found`, { exact: true })).toBeVisible();
}

async function expectActiveFilter(page: Page, name: string, summary: string | RegExp): Promise<void> {
  const filters = page.getByRole("region", { name: "Filters", exact: true });
  await expect(filters.getByRole("button", { name: new RegExp(`^${name} filter `) })).toContainText(summary);
  await expect(filters.getByRole("button", { name: `Clear ${name} filter`, exact: true })).toBeVisible();
}

async function closeOpenFilter(page: Page): Promise<void> {
  // Avoid hovering a result chart when the filter disappears under the pointer.
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("dialog")).toBeHidden();
}

const it = test;

test.describe(`Global Search Filters`, () => {
  test(`Global Search Filters`, async ({ page }) => {
    let expectedValueCount: number;
    let selectedCountries: string[];
    await it.step(`1. Go to home page: \`/\``, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Click on the chip _Payment statistics_`, async () => {
      await page.getByRole("link", { name: "Payment statistics" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/search\?filter=_CATEGORY/);
      await expect(page.getByRole("main")).toContainText("Retail payments, currency and related indicators");
      await expect(page.getByRole("main").getByRole("button", { name: /Data set filter collapsed/i })).toBeVisible();
    });

    await it.step(`3. Click on _Data set_ filter`, async () => {
      await openFilter(page, "Data set");
      await expect(page.getByPlaceholder("Filter Data set ...")).toBeVisible();
    });

    await it.step(`4. Select _CPMI institutions (T3)_`, async () => {
      const expectedDataSetCount = await optionCount(page, /CPMI institutions\[BIS,WS_CPMI_INSTITUT,1\.0\]/);
      await chooseFilterValue(page, /CPMI institutions\[BIS,WS_CPMI_INSTITUT,1\.0\]/);
      await expectFilterOptionChecked(page, /CPMI institutions\[BIS,WS_CPMI_INSTITUT,1\.0\]/);
      await expect(page).toHaveURL(/WS_CPMI_INSTITUT/);
      await expectResultCount(page, expectedDataSetCount);
    });

    await it.step(`5. Close filter`, async () => {
      await closeOpenFilter(page);
      await expectActiveFilter(page, "Data set", "Data set: CPMI institutions [BIS,WS_CPMI_INSTITUT,1.0]");
    });

    await it.step(`6. Click on _Reporting country_ filter`, async () => {
      await openFilter(page, "Reporting country");
      await expect(page.getByPlaceholder("Filter Reporting country ...")).toBeVisible();
    });

    await it.step(`7. Click on _List view_`, async () => {
      await page.getByRole("button", { name: "List view" }).click();
      await expect(page.getByRole("button", { name: "Tree view" })).toBeVisible();
      const list = page.getByRole("menu").getByRole("listbox");
      await expect(list).toBeVisible();
      const options = list.getByRole("option");
      await expect.poll(() => options.count()).toBeGreaterThan(1);
      await expect(options.getByRole("option")).toHaveCount(0);
      await expect(list.getByRole("treeitem")).toHaveCount(0);
      for (const option of await options.all()) {
        await expect(option.getByRole("checkbox")).toHaveCount(1);
      }
    });

    await it.step(`8. Click on _Tree view_`, async () => {
      await page.getByRole("button", { name: "Tree view" }).click();
      await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
      const tree = page.getByRole("tree");
      await expect(tree).toBeVisible();
      const groups = tree.getByRole("treeitem");
      await expect.poll(() => groups.count()).toBeGreaterThan(1);
      for (const group of await groups.all()) {
        await expect(group.getByRole("button")).toHaveCount(1);
        await expect(group.locator('[role="presentation"]')).toBeVisible();
      }
      const group = groups.first();
      const chevron = group.locator('[role="presentation"]').first();
      await chevron.click();
      await expect.poll(() => group.getByRole("treeitem").count()).toBeGreaterThan(0);
      await chevron.click();
      await expect(group.getByRole("treeitem")).toHaveCount(0);
    });

    await it.step(`10. Click on _G8_ (in tree view) G8 is checked`, async () => {
      await chooseFilterValue(page, /^G8$/);
      await expect(page).toHaveURL(/REP_CTY_TXT%3DCanada/);
      await expectFilterOptionChecked(page, /^G8$/);
    });

    await it.step(`11. Expand _G8_`, async () => {
      const group = page.getByRole("treeitem").filter({ has: page.getByRole("button", { name: "G8", exact: true }) });
      await group.locator('[role="presentation"]').first().click();
      const countries = group.getByRole("treeitem");
      await expect.poll(() => countries.count()).toBeGreaterThan(1);
      selectedCountries = [];
      for (const country of await countries.all()) {
        await expect(country.getByRole("checkbox")).toBeChecked();
        selectedCountries.push((await country.getByRole("button").innerText()).trim());
      }
    });

    await it.step(`12. Close filter`, async () => {
      await closeOpenFilter(page);
      await expectActiveFilter(page, "Reporting country", "Reporting country:");
      const filter = page.getByRole("button", { name: /^Reporting country filter / });
      await expect(filter).toHaveText(/^Reporting country:\s*[^,]+,\s*[^+]+\+\d+$/);
      const summary = (await filter.innerText()).match(/^Reporting country:\s*([^,]+),\s*([^+]+)\+(\d+)$/);
      if (!summary) throw new Error("Reporting country summary must show two countries and a +N counter");
      const visibleCountries = summary.slice(1, 3).map((country) => country.trim());
      expect(new Set(visibleCountries).size).toBe(2);
      for (const country of visibleCountries) {
        expect(selectedCountries).toContain(country);
      }
      expect(Number(summary[3])).toBe(selectedCountries.length - visibleCountries.length);
    });

    await it.step(`13. Click on _Measure_ filter`, async () => {
      await openFilter(page, "Measure");
      await expect(page.getByPlaceholder("Filter Measure ...")).toBeVisible();
    });

    await it.step(`14. Select the _Value_ filter option`, async () => {
      await chooseFilterValue(page, /Value\[V\]/);
      await expectFilterOptionChecked(page, /Value\[V\]/);
      await expect(page).toHaveURL(/MEASURE%3DV/);
    });

    await it.step(`15. Note the number in the chip of _Value_`, async () => {
      expectedValueCount = await optionCount(page, /Value\[V\]/);
    });

    await it.step(`16. Close the filter`, async () => {
      await closeOpenFilter(page);
      await expectActiveFilter(page, "Measure", "Measure: Value [V]");
      await expectResultCount(page, expectedValueCount);
    });

    await it.step(`17. Click on _Timespan_`, async () => {
      await openFilter(page, "Timespan");
      await expect(page.getByRole("tab", { name: "Years" })).toBeVisible();
    });

    await it.step(`18. Click on Years`, async () => {
      const years = page.getByRole("tab", { name: "Years" });
      await years.click();
    });

    await it.step(`19. Select: 2012, 2013`, async () => {
      await chooseFilterValue(page, /^2012$/);
      await chooseFilterValue(page, /^2013$/);
      await expect(page).toHaveURL(/YEAR%3D2012/);
      await expectFilterOptionChecked(page, /^2012$/);
      await expectFilterOptionChecked(page, /^2013$/);
      await expectActiveFilter(page, "Years", /Years:.*2012.*2013/);
    });

    await it.step(`20. Click on Reset`, async () => {
      await page.getByRole("button", { name: "Reset" }).last().click();
      await expect(page.getByRole("tab", { name: "Years" })).toBeVisible();
      await expect(page.getByRole("tabpanel", { name: "Years" }).getByRole("checkbox", { checked: true })).toHaveCount(0);
    });

    await it.step(`21. Close dropdown`, async () => {
      await closeOpenFilter(page);
    });

    await it.step(`22. Click on reset at the top right of filters section`, async () => {
      await page.getByRole("main").getByRole("button", { name: "Reset" }).first().click();
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.getByRole("main")).not.toContainText("CPMI institutions");
      await expect(page.getByRole("main")).not.toContainText("Value [V]");
    });
  });
});
