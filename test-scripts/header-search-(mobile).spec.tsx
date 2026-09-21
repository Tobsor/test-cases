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
  await expect(page.getByRole("banner").getByRole("button", { name: "Search" })).toBeHidden();
  await expect(mainSearchInput(page)).toHaveAttribute("placeholder", "Search for time series");
}

async function clearSearch(page: Page): Promise<void> {
  const clearButton = page.getByRole("button", { name: /clear search terms/i }).first();
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(mainSearchInput(page)).toHaveValue("");
}

const it = test;

test.describe(`Header Search (Mobile)`, () => {
  test(`Header Search (Mobile)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await it.step(`1. Go to a non-home page`, async () => {
      await gotoPath(page, "/help");
      await expect(page.getByRole("banner").getByRole("button", { name: "Open mobile navigation" })).toBeVisible();
    });

    await it.step(`2. Open search from the mobile header`, async () => {
      await openHeaderSearch(page);
      await expect(page.getByRole("button", { name: "Open mobile navigation" })).toBeVisible();
    });

    await it.step(`3. Type Germany and clear it`, async () => {
      await page.keyboard.type("Germany");
      await expect(mainSearchInput(page)).toHaveValue("Germany");
      await expect(page.getByRole("button", { name: /clear search terms/i })).toBeVisible();
      await expect(page.getByRole("option").filter({ hasText: /Germany/i }).first()).toBeVisible();
      await clearSearch(page);
      await expect(mainSearchInput(page)).toHaveAttribute("placeholder", "Search for time series");
    });

    await it.step(`4. Search by clicking the first Germany suggestion`, async () => {
      await mainSearchInput(page).fill("Germany");
      const firstSuggestion = page.getByRole("option").filter({ hasText: /Germany/i }).first();
      await expect(firstSuggestion).toBeVisible();
      await firstSuggestion.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]q=Germany/i);
      await expect(page.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("Germany");
    });

    await it.step(`5. Search by clicking the second Germany suggestion`, async () => {
      await gotoPath(page, "/help");
      await openHeaderSearch(page);
      await mainSearchInput(page).fill("Germany");
      const secondSuggestion = page.getByRole("option").filter({ hasText: /Germany/i }).nth(1);
      await expect(secondSuggestion).toBeVisible();
      await secondSuggestion.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/.+\/data\?q=Germany/i);
    });

    await it.step(`6. Mobile search closes and mobile navigation can open and close`, async () => {
      await gotoPath(page, "/help");
      await openHeaderSearch(page);
      await page.keyboard.press("Escape");
      await expect(mainSearchInput(page)).toBeHidden();
      await expect(page.getByRole("banner").getByRole("button", { name: "Search" })).toBeVisible();
      await page.getByRole("banner").getByRole("button", { name: "Open mobile navigation" }).click();
      await expect(page.getByRole("dialog").or(page.getByRole("navigation")).first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open mobile navigation" })).toBeVisible();
    });
  });
});
