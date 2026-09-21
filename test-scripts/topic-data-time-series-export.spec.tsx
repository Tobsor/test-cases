import { expect, test, type Page } from "@playwright/test";

async function gotoCppData(page: Page): Promise<void> {
  await page.goto("/topics/CPP/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Commercial property prices" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

async function searchTopicData(page: Page, query: string): Promise<void> {
  const input = main(page).getByRole("combobox", { name: "Search for time series" });
  await input.fill("");
  await input.fill(query);
  await input.press("Enter");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
}

test.describe("Topic Data Time Series Export", () => {
  test("configures export options for searched and selected topic data", async ({ page }) => {
    await gotoCppData(page);
    await searchTopicData(page, "Switzerland OR Germany");
    await expect(main(page).getByText(/time series found/i).first()).toBeVisible();

    await main(page).getByRole("button", { name: "Filters" }).click();
    await main(page).getByRole("button", { name: /Covered area filter collapsed/i }).click();
    await page.getByRole("checkbox", { name: /Whole country\[0\]/i }).check({ force: true });
    await expect(page).toHaveURL(/filter=.*COVERED_AREA%3D0/);
    await expect(main(page).getByText("4 time series found")).toBeVisible();

    await main(page).getByRole("checkbox", { name: "Select time series" }).first().check();
    await expect(main(page).getByRole("button", { name: "Bookmark" })).toBeEnabled();
    await expect(main(page)).toContainText("1 selected");

    await main(page).getByRole("button", { name: "Open export modal" }).click();

    const dialog = page.locator('[role="dialog"][data-state="open"]').filter({ hasText: "Export" });
    await expect(dialog).toBeAttached();
    await expect(dialog).toContainText("Export");
    await expect(dialog.getByRole("tab", { name: "Time series" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("form", { name: "Export time series form" })).toBeVisible();
    await expect(dialog).toContainText(/1 time series/i);
    await expect(dialog).toContainText(/BIS WS_CPP 1\.0|Commercial property prices/i);
    await expect(dialog.getByRole("link", { name: /Terms and conditions/i })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "File Format" })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "Format", exact: true })).toBeVisible();
    await expect(dialog.getByRole("radiogroup", { name: "Additional time series information" })).toBeVisible();

    await expect(dialog.getByText("Long (stacked)").first()).toBeVisible();
    await expect(dialog.getByText("Wide (unstacked)").first()).toBeVisible();
    await expect(dialog.getByText("Dimension codes").first()).toBeVisible();
    await expect(dialog.getByText("Descriptive labels").first()).toBeVisible();

    await dialog.getByText("Wide (unstacked)").first().click();
    await expect(dialog.getByText("Wide (unstacked)").first()).toBeVisible();
    await expect(dialog.getByText(/Split frequency in worksheets/i)).toBeVisible();
    await expect(dialog.getByText(/Transposed/i)).toBeVisible();
    await dialog.getByText(/Transposed/i).click();
    await dialog.getByText("CSV").first().click();
    await dialog.getByText("Dimension codes").first().click();

    await expect(dialog.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(dialog.getByText(/Source URL|Download URL|Citation/i).first()).toBeVisible();

    await dialog.getByRole("button", { name: "Close modal" }).click({ force: true });
    await expect(dialog).toBeHidden();
  });
});
