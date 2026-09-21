import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, pathOrUrl: string): Promise<void> {
  const url = pathOrUrl.startsWith("http") ? new URL(pathOrUrl).pathname + new URL(pathOrUrl).search : pathOrUrl;
  await page.goto(`${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`);
  await page.waitForLoadState("domcontentloaded");
}

async function openFilter(page: Page, name: string): Promise<void> {
  const filter = page.locator(`main button[aria-label^="${name} filter"]`).first();
  await filter.scrollIntoViewIfNeeded();
  await filter.click();
}

async function chooseFilterValue(page: Page, value: RegExp): Promise<void> {
  const label = page.locator("label.checkbox__label").filter({ hasText: value }).first();
  await expect(label).toBeVisible();
  await label.evaluate((element) => {
    const inputId = element.getAttribute("for");
    if (!inputId) {
      throw new Error("Filter option label is missing an associated input");
    }
    document.getElementById(inputId)?.click();
  });
}

async function expectFilterOptionChecked(page: Page, value: RegExp): Promise<void> {
  const label = page.locator("label.checkbox__label").filter({ hasText: value }).first();
  const inputId = await label.getAttribute("for");
  if (!inputId) {
    throw new Error("Filter option label is missing an associated input");
  }
  await expect(page.locator(`#${inputId}`)).toBeChecked();
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toBeHidden();
}

const it = test;

test.describe(`Global Search Filters`, () => {
  test(`Global Search Filters`, async ({ page }) => {
    await it.step(`1. Go to home page: \`/\``, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Click on the chip _Payment statistics_`, async () => {
      await page.getByRole("link", { name: "Payment statistics" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/search\?filter=_CATEGORY/);
      await expect(page.locator("main")).toContainText("Retail payments, currency and related indicators");
      await expect(page.locator("main")).toContainText("Financial market infrastructures and critical service providers");
      await expect(page.locator("main").getByRole("button", { name: /Data set filter collapsed/i })).toBeVisible();
    });

    await it.step(`3. Click on _Data set_ filter`, async () => {
      await openFilter(page, "Data set");
      await expect(page.getByPlaceholder("Filter Data set ...")).toBeVisible();
    });

    await it.step(`4. Select _CPMI institutions (T3)_`, async () => {
      await chooseFilterValue(page, /CPMI institutions\[BIS,WS_CPMI_INSTITUT,1\.0\]/);
      await expectFilterOptionChecked(page, /CPMI institutions\[BIS,WS_CPMI_INSTITUT,1\.0\]/);
      await expect(page).toHaveURL(/WS_CPMI_INSTITUT/);
      await expect(page.getByText(/time series found/i).first()).toBeVisible();
    });

    await it.step(`5. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.locator("main")).toContainText("CPMI institutions");
    });

    await it.step(`6. Click on _Reporting country_ filter`, async () => {
      await openFilter(page, "Reporting country");
      await expect(page.getByPlaceholder("Filter Reporting country ...")).toBeVisible();
    });

    await it.step(`7. Click on _List view_`, async () => {
      await page.getByRole("button", { name: "List view" }).click();
      await expect(page.getByRole("button", { name: "Tree view" })).toBeVisible();
      await expect(page.locator("label.checkbox__label").filter({ hasText: /Canada|United States|Germany/ }).first()).toBeVisible();
    });

    await it.step(`9. Click on _Tree view_`, async () => {
      await page.getByRole("button", { name: "Tree view" }).click();
      await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
      await expect(page.locator("label.checkbox__label").filter({ hasText: /^G8$/ })).toBeVisible();
    });

    await it.step(`10. Click on _G8_ (in tree view) G8 is checked`, async () => {
      await chooseFilterValue(page, /^G8$/);
      await expect(page).toHaveURL(/REP_CTY_TXT%3DCanada/);
      await expectFilterOptionChecked(page, /^G8$/);
    });

    await it.step(`11. Expand _G8_`, async () => {
      await expect(page.getByText("G8").first()).toBeVisible();
      await expect(page.locator("[data-radix-popper-content-wrapper]")).toContainText("G8");
    });

    await it.step(`12. Close filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.locator("main")).toContainText("Canada");
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
      await expect(page.getByText(/Value \[V\]/).first()).toBeVisible();
      await expect(page.getByText(/time series found/i).first()).toBeVisible();
    });

    await it.step(`16. Close the filter`, async () => {
      await closeOpenFilter(page);
      await expect(page.locator("main")).toContainText("Value");
    });

    await it.step(`17. Click on _Timespan_`, async () => {
      await openFilter(page, "Timespan");
      await expect(page.getByRole("tab", { name: "Years" })).toBeVisible();
    });

    await it.step(`18. Click on Years`, async () => {
      const years = page.getByRole("tab", { name: "Years" });
      await years.evaluate((element) => (element as HTMLElement).click());
    });

    await it.step(`19. Select: 2012, 2013`, async () => {
      await chooseFilterValue(page, /^2012$/);
      await chooseFilterValue(page, /^2013$/);
      await expect(page).toHaveURL(/YEAR%3D2012/);
      await expectFilterOptionChecked(page, /^2012$/);
      await expectFilterOptionChecked(page, /^2013$/);
      await expect(page.locator("[data-radix-popper-content-wrapper]")).toContainText("2012");
      await expect(page.locator("[data-radix-popper-content-wrapper]")).toContainText("2013");
    });

    await it.step(`20. Click on Reset`, async () => {
      await page.getByRole("button", { name: "Reset" }).last().click();
      await expect(page.getByRole("tab", { name: "Years" })).toBeVisible();
      await expect(page.locator("[data-radix-popper-content-wrapper]")).not.toContainText("Years: 2012");
    });

    await it.step(`21. Close dropdown`, async () => {
      await closeOpenFilter(page);
    });

    await it.step(`22. Click on reset at the top right of filters section`, async () => {
      await page.locator("main").getByRole("button", { name: "Reset" }).first().click();
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.locator("main")).not.toContainText("CPMI institutions");
      await expect(page.locator("main")).not.toContainText("Value [V]");
    });
  });
});
