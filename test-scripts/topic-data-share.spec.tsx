import { expect, test, type Page } from "@playwright/test";

async function gotoRppData(page: Page): Promise<void> {
  await page.goto("/topics/RPP/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Residential property prices" })).toBeVisible();
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

test.describe("Topic Data Share", () => {
  test("shares a topic data search and selected time-series state", async ({ page }) => {
    await gotoRppData(page);
    await searchTopicData(page, "Zurich OR Berlin");
    await expect(main(page).getByText(/time series found/i).first()).toBeVisible();

    await main(page).getByRole("button", { name: "Filters" }).click();
    await main(page).getByRole("button", { name: /Compiling agency filter collapsed/i }).click();
    await page.getByRole("checkbox", { name: /Private sector\[2\]/i }).check({ force: true });
    await expect(page).toHaveURL(/filter=.*COMPILING_ORG%3D2/);
    await expect(main(page).getByText("3 time series found")).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Clear Compiling agency filter/i })).toBeVisible();

    await main(page).getByRole("checkbox", { name: "Select time series" }).last().check();
    await expect(main(page).getByRole("button", { name: "Bookmark" })).toBeEnabled();
    await expect(main(page)).toContainText("1 selected");

    await main(page).getByRole("button", { name: "Share" }).click();

    const dialog = page.locator('[role="dialog"][data-state="open"]').filter({ hasText: "Share" });
    await expect(dialog).toBeAttached();
    await expect(dialog).toContainText("Share");
    await expect(dialog).toContainText("Use this URL to share this view");

    const urlInput = dialog.getByRole("textbox", { name: "URL" });
    await expect(urlInput).toHaveValue(/\/topics\/RPP\/data\?/);
    await expect(urlInput).toHaveValue(/q=Zurich\+OR\+Berlin|q=Zurich%20OR%20Berlin/);
    await expect(urlInput).toHaveValue(/filter=.*COMPILING_ORG/);
    await expect(dialog.getByRole("button", { name: "Copy to clipboard" })).toBeAttached();

    const sharedUrl = await urlInput.inputValue();
    const sharedPage = await page.context().newPage();
    await sharedPage.goto(sharedUrl);
    await expect(sharedPage.getByRole("heading", { level: 1, name: "Residential property prices" })).toBeVisible();
    await expect(sharedPage.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue(
      "Zurich OR Berlin",
    );
    await expect(sharedPage.locator("main")).toContainText("3 time series found");
    await expect(sharedPage.locator("main")).toContainText("1 selected");
    await sharedPage.close();
  });
});
