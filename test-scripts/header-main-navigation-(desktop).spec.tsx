import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

function header(page: Page) {
  return page.getByRole("banner");
}

const it = test;

test.describe(`Header Main Navigation (Desktop)`, () => {
  test(`Header Main Navigation (Desktop)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await it.step(`1. Go to the release calendar and click the BIS logo to navigate home`, async () => {
      await gotoPath(page, "/release-calendar");
      await expect(header(page).getByRole("link", { name: "Navigate to home page" })).toBeVisible();
      await expect(header(page).getByRole("button", { name: "Search" })).toBeVisible();
      await header(page).getByRole("link", { name: "Navigate to home page" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(`${BASE_URL}/`);
    });

    await it.step(`2. Verify the Topics mega menu`, async () => {
      await expect(header(page).getByRole("button", { name: "Topics" })).toBeVisible();
      await expect(header(page).getByRole("button", { name: "Bookmarks" })).toBeVisible();
      await header(page).getByRole("button", { name: "Topics" }).hover();
      await expect(page.getByRole("menu").or(page.getByRole("dialog")).first()).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await it.step(`3. Click Releases in the main navigation`, async () => {
      await header(page).getByRole("link", { name: "Releases" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/release-calendar/);
    });

    await it.step(`4. Click Help in the main navigation`, async () => {
      await header(page).getByRole("link", { name: "Help" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/help/);
    });

    await it.step(`5. Click the Bookmarks button and show the bookmarks dialog`, async () => {
      await header(page).getByRole("button", { name: "Bookmarks" }).click();
      await expect(page.getByRole("dialog", { name: "Bookmarks" })).toBeAttached();
      await expect(page.getByRole("tab", { name: "Time series" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Tables" })).toBeVisible();
    });

    await it.step(`6. Full screen/normal screen button acts as a desktop toggle`, async () => {
      await page.setViewportSize({ width: 1800, height: 1000 });
      await gotoPath(page, "/help");
      const focusMode = header(page).getByRole("button", { name: "Toggle focus mode" });
      await expect(focusMode).toBeVisible();
      const before = await focusMode.getAttribute("aria-pressed");
      await focusMode.click();
      await expect(focusMode).not.toHaveAttribute("aria-pressed", before ?? "");
      await focusMode.click();
    });

    await it.step(`7. Click the BIS logo to return home and verify the header has no Search button`, async () => {
      await header(page).getByRole("link", { name: "Navigate to home page" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(`${BASE_URL}/`);
      await expect(header(page).getByRole("button", { name: "Search" })).toBeHidden();
    });
  });
});
