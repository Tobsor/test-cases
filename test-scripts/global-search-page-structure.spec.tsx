import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

async function openFilter(page: Page, name: string): Promise<void> {
  const filter = page.getByRole("main").getByRole("button", { name: new RegExp(`^${name} filter`) }).first();
  await filter.scrollIntoViewIfNeeded();
  await filter.click();
}

async function closeOpenFilter(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toBeHidden();
}

const it = test;

test.describe(`Global search Page structure`, () => {
  test(`Global search Page structure`, async ({ page }) => {
    await it.step(`1. Navigate to "/search"`, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
      await expect(page.getByText(/time series found/i)).toBeVisible();
      await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("exchange rate");
      await expect(page.getByRole("radio", { name: "Change to card view" })).toHaveAttribute("aria-checked", "true");
    });

    await it.step(`2. Click on Timespan filter, select YTD and close the filter`, async () => {
      await openFilter(page, "Timespan");
      await page.getByRole("button", { name: "YTD" }).click();
      await closeOpenFilter(page);
      await expect(page.getByRole("main")).toContainText(/Timespan: \d{4}-01-01 - \d{4}-\d{2}-\d{2}/);
    });

    await it.step(`3. Click on \`Relevance\` button in the toolbar`, async () => {
      await page.getByRole("main").getByRole("button", { name: /Sort dropdown collapsed/ }).click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem").first()).toBeVisible();
    });

    await it.step(`4. Click on \`Topics\` suggestion`, async () => {
      await page.getByRole("menuitem", { name: /Topic|Topics/ }).first().click();
      await expect(page.getByRole("main").getByRole("button", { name: /Sort dropdown/ })).toBeVisible();
      await expect(page).toHaveURL((url) => url.searchParams.get("sort") === "_CATEGORY_SORT-DESC");
    });

    await it.step(`5. Click on the sort icon button in the toolbar`, async () => {
      await page.getByRole("main").getByRole("button", { name: "Toggle sorting" }).click();
      await expect(page).toHaveURL((url) => url.searchParams.get("sort") === "_CATEGORY_SORT-ASC");
    });

    await it.step(`6. Check the two first time series`, async () => {
      const checkboxes = page.getByRole("main").getByRole("checkbox", { name: "Select time series" });
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await expect(checkboxes.nth(0)).toBeChecked();
      await expect(checkboxes.nth(1)).toBeChecked();
      await expect(page.getByRole("main")).toContainText("2 selected");
      await expect(page.getByRole("main").getByText("Compare time series")).toBeVisible();
    });

    await it.step(`7. Check the checkbox in the toolbar`, async () => {
      await page.getByRole("main").getByRole("checkbox", { name: "Select all" }).check();
      await expect(page.getByRole("main").getByRole("checkbox", { name: "Select all" })).toBeChecked();
      await expect(page.getByRole("main")).toContainText(/20 selected/);
    });

    await it.step(`8. Hover on \`Compare time series\` button in the toolbar`, async () => {
      await page.getByRole("main").getByRole("button").filter({ hasText: "Compare time series" }).hover();
      await expect(page.getByText("Too many time series selected")).toBeVisible();
    });

    await it.step(`9. Unhover the floating message`, async () => {
      await page.mouse.move(0, 0);
      await expect(page.getByText("Too many time series selected")).toBeHidden();
    });

    await it.step(`10. Click on the table icon button in the switch view button in the toolbar`, async () => {
      const listView = page.getByRole("radio", { name: "Change to list view" });
      await listView.click();
      await expect(listView).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("main").getByRole("grid")).toBeVisible();
      const rowCheckboxes = page.getByRole("main").getByRole("grid").getByRole("checkbox", {
        name: "Press Space to toggle row selection",
      });
      await expect(rowCheckboxes).toHaveCount(20);
      for (const checkbox of await rowCheckboxes.all()) {
        await expect(checkbox).toBeChecked();
      }
    });

    await it.step(`11. Click on the list icon button in the switch view button in the toolbar`, async () => {
      const cardView = page.getByRole("radio", { name: "Change to card view" });
      await cardView.click();
      await expect(cardView).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("main").getByRole("article").first()).toBeVisible();
    });

    await it.step(`12. Scroll to the navigation bar at the bottom of the list`, async () => {
      await page.getByRole("link", { name: "Go to next page" }).scrollIntoViewIfNeeded();
      await expect(page.getByText(/1-20 of [\d.]+/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to first page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
      await expect(page.getByRole("link", { name: "Go to next page" })).toBeVisible();
      await expect(page.getByText("20 / page")).toBeVisible();
    });

    await it.step(`13. Click on the last page icon button`, async () => {
      const lastPage = page.getByRole("link", { name: "Go to last page" }).or(page.getByRole("button", { name: "Too many pages" })).first();
      await expect(lastPage).toBeVisible();
      if ((await page.getByRole("button", { name: "Too many pages" }).count()) > 0) {
        await expect(page.getByRole("button", { name: "Too many pages" })).toBeDisabled();
      }
    });

    await it.step(`14. Select "10 / page" in the dropdown menu`, async () => {
      // Start on page two so changing the page size must reset pagination.
      await page.getByRole("link", { name: "Go to next page" }).click();
      await expect(page.getByText(/21-40 of [\d.]+/)).toBeVisible();
      await expect(page.locator("#paginator-page-size")).toBeVisible();
      await expect(page.getByText("20 / page")).toBeVisible();
      await page.locator("#paginator-page-size").click();
      await page.getByRole("option", { name: "10 / page" }).click();
      const pageSizeControl = page.locator(".select").filter({ has: page.locator("#paginator-page-size") });
      await expect(pageSizeControl.getByText("10 / page", { exact: true })).toBeVisible();
      await expect(page.getByText(/1-10 of [\d.]+/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to first page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
      await expect(page.getByRole("link", { name: "Go to next page" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Too many pages" })).toBeDisabled();
    });
  });
});
