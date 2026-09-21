import { expect, test, type Page } from "@playwright/test";

async function gotoTopicData(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topic Data Page Structure (Desktop)", () => {
  test("renders topic data navigation, tools, sample tables, filters, and results", async ({ page }) => {
    await gotoTopicData(page, "/topics/CPI/data");

    await expect(page).toHaveTitle(/Consumer prices - data \| BIS Data Portal/);
    await expect(page.getByRole("heading", { level: 1, name: "Consumer prices" })).toBeVisible();

    const pageNavigation = main(page).getByRole("navigation", { name: "Page navigation" });
    await expect(pageNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/topics/CPI");
    await expect(pageNavigation.getByRole("link", { name: "Tables & dashboards" })).toHaveAttribute(
      "href",
      "/topics/CPI/tables-and-dashboards",
    );
    await expect(pageNavigation.getByRole("link", { name: "Data" })).toHaveAttribute("href", "/topics/CPI/data");
    await expect(pageNavigation.getByRole("link", { name: "Data" })).toHaveAttribute("aria-current", "page");

    const toolbar = main(page).getByRole("region", { name: "Search toolbar" });
    await expect(toolbar.getByRole("combobox", { name: "Search for time series" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Bookmark" })).toBeDisabled();
    await expect(toolbar.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Open export modal" })).toBeVisible();

    await expect(main(page).getByRole("button", { name: "Sample tables" })).toHaveAttribute("aria-expanded", "true");
    await expect(main(page).getByRole("region", { name: "Sample tables" })).toContainText("Build your own table");
    await expect(main(page).locator('a[href="/topics/CPI/data/BIS,PDQ_K1,1.0"]')).toHaveAttribute(
      "href",
      "/topics/CPI/data/BIS,PDQ_K1,1.0",
    );
    await main(page).getByRole("button", { name: "Sample tables" }).click();
    await expect(main(page).getByRole("button", { name: "Sample tables" })).toHaveAttribute("aria-expanded", "false");
    await main(page).getByRole("button", { name: "Sample tables" }).click();
    await expect(main(page).getByRole("button", { name: "Sample tables" })).toHaveAttribute("aria-expanded", "true");

    await expect(main(page).getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "false");
    await main(page).getByRole("button", { name: "Filters" }).click();
    await expect(main(page).getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "true");
    await expect(main(page).getByRole("region", { name: "Filters" })).toContainText("Reference area");
    await main(page).getByRole("button", { name: "Filters" }).click();
    await expect(main(page).getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "false");

    await expect(main(page).getByRole("heading", { level: 1, name: "Time series list" })).toBeVisible();
    await expect(main(page).getByRole("radio", { name: "List" })).toBeChecked();
    await expect(main(page).getByRole("radio", { name: "Table" })).not.toBeChecked();
    await expect(main(page).getByText(/252 time series found/i)).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Sort dropdown collapsed/i })).toContainText("Country");
    await expect(main(page).getByRole("checkbox", { name: "Select all" })).toBeVisible();
    await expect(main(page).getByRole("article").first()).toContainText("Series key");
    await expect(main(page).getByRole("article").first()).toContainText("Unit");
    await expect(main(page).getByRole("article").first()).toContainText("End value");
    await expect(main(page).getByRole("article").first()).toContainText("Time span");
    await expect(main(page).getByRole("article").first()).toContainText("Frequency");
    await expect(main(page).getByRole("article").first().getByRole("checkbox", { name: "Select time series" })).toBeVisible();
    await expect(main(page).getByRole("article").first().getByRole("button", { name: "Show metadata" })).toBeVisible();
    await expect(main(page).getByRole("article").first().getByRole("link").first()).toHaveAttribute(
      "href",
      /\/topics\/CPI\/BIS,WS_LONG_CPI,1\.0\//,
    );
    await expect(main(page)).toContainText(/1-20 of 252/);
    await expect(main(page).getByRole("button", { name: "Go to first page" })).toBeDisabled();
    await expect(main(page).getByRole("button", { name: "Go to previous page" })).toBeDisabled();
    await expect(main(page).getByRole("link", { name: "Go to next page" })).toHaveAttribute("href", "/topics/CPI/data?page=1");
    await expect(main(page).getByText("20 / page")).toBeVisible();
  });
});
