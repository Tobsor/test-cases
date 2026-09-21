import { expect, test, type Locator, type Page } from "@playwright/test";

// Local test helpers. Kept inline so this spec has no project-local runtime imports.
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

  if (!pathOrUrl.startsWith("/")) {
    return `${BASE_URL}/${pathOrUrl}`;
  }

  return `${BASE_URL}${pathOrUrl}`;
}

function mainSearchInput(page: Page): Locator {
  return page
    .getByRole("combobox", { name: /search for time series|search/i })
    .first();
}
test.describe("Home Page Search", () => {
  test("Home Page Search", async ({ page }) => {
    await test.step("1. Navigate to /", async () => {
      await gotoPath(page, "/");
      await expect(page.getByRole("heading", { name: /global statistics at the heart of international cooperation/i })).toBeVisible();
      await expect(mainSearchInput(page)).toBeVisible();
    });

    await test.step("2. Click into the search bar", async () => {
      await mainSearchInput(page).click();
      await expect(mainSearchInput(page)).toBeFocused();
    });

    await test.step('3. Type in the term "Germany"', async () => {
      await mainSearchInput(page).fill("Germany");
      await expect(mainSearchInput(page)).toHaveValue("Germany");
      await expect(page.getByRole("option", { name: /germany/i }).first()).toBeVisible();
    });

    await test.step("Expected 1-2. Flyout menu appears with Germany suggestions", async () => {
      await expect(page.getByRole("listbox").first()).toBeVisible();
      await expect(page.getByRole("option", { name: /germany/i }).first()).toBeVisible();
    });

    await test.step("Expected 3. Clicking the first suggestion redirects to search page", async () => {
      await page.getByRole("option", { name: /germany/i }).first().click();
      await expect(page).toHaveURL(/\/search/i);
    });

    await test.step("Expected 4. Second suggestion redirects to a topic data page", async () => {
      await gotoPath(page, "/");
      await mainSearchInput(page).fill("Germany");
      const secondSuggestion = page.getByRole("option").nth(1);
      await expect(secondSuggestion).toBeVisible();
      await secondSuggestion.click();
      await expect(page).toHaveURL(/\/topics\/.+\/data/i);
    });
  });
});
