import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

function mainSearchInput(page: Page): Locator {
  return page.getByRole("combobox", { name: /search for time series/i }).first();
}

async function openHeaderSearch(page: Page): Promise<void> {
  await page.getByRole("banner").getByRole("button", { name: "Search" }).click();
  await expect(mainSearchInput(page), "Header search input should open").toBeVisible();
  await expect(mainSearchInput(page)).toBeFocused();
  await expect(page.getByRole("button", { name: /close search|search/i }).first()).toBeVisible();
}

async function clearSearch(page: Page): Promise<void> {
  const clearButton = page.getByRole("button", { name: /clear search terms/i }).first();
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(mainSearchInput(page)).toHaveValue("");
}

const it = test;

test.describe(`Header Search (Desktop)`, () => {
  test(`Header Search (Desktop)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await it.step(`1. Go to a non-home page`, async () => {
      await gotoPath(page, "/help");
    });

    await it.step(`2. Open search from the header`, async () => {
      await openHeaderSearch(page);
    });

    await it.step(`3. Type without selecting the text field again`, async () => {
      await page.keyboard.type("anything");
      await expect(mainSearchInput(page)).toHaveValue("anything");
    });

    await it.step(`4. Clear the entered text`, async () => {
      await clearSearch(page);
    });

    await it.step(`5. Type Germany and show suggestions`, async () => {
      await mainSearchInput(page).fill("germany");
      await expect(page.getByRole("option").filter({ hasText: /germany/i }).first()).toBeVisible();
    });

    await it.step(`6. Explore opens and closes from the header search`, async () => {
      await page.getByRole("button", { name: "Explore" }).click();
      await expect(page.getByRole("region", { name: "Exploration panel" })).toBeVisible();
      await page.getByRole("button", { name: "Explore" }).click();
      await expect(page.getByRole("region", { name: "Exploration panel" })).toBeHidden();
    });

    await it.step(`7. Clear Germany`, async () => {
      await clearSearch(page);
    });

    await it.step(`8. Search for Switzerland from suggestions`, async () => {
      await mainSearchInput(page).fill("Switzerland");
      const suggestion = page.getByRole("option").filter({ hasText: /Switzerland/i }).first();
      await expect(suggestion).toBeVisible();
      await suggestion.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]q=Switzerland/i);
      await expect(page.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("Switzerland");
    });
  });
});
