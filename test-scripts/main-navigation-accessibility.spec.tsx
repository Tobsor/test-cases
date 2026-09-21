import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

function focusedElement(page: Page) {
  return page.locator(":focus");
}

const it = test;

test.describe(`Main Navigation Accessibility`, () => {
  test(`Main Navigation Accessibility`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await it.step(`1. Go to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Skip link is first keyboard target and moves focus to main content`, async () => {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: /Global statistics/i })).toBeVisible();
    });

    await it.step(`3. Header links are reachable by keyboard`, async () => {
      await gotoPath(page, "/");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("banner").getByRole("link", { name: "Navigate to home page" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("banner").getByRole("button", { name: "Topics" })).toBeFocused();
    });

    await it.step(`4. Topics menu opens from the keyboard`, async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu").or(page.getByRole("dialog")).first()).toBeVisible();
      await expect(page.getByRole("banner").getByRole("button", { name: "Topics" })).toBeFocused();
      await expect(page.getByRole("link", { name: /Locational banking statistics|LBS/i }).first()).toBeVisible();
    });

    await it.step(`5. Enter closes and reopens the Topics menu while keeping focus on Topics`, async () => {
      const topicsButton = page.getByRole("banner").getByRole("button", { name: "Topics" });

      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu").or(page.getByRole("dialog")).first()).toHaveCount(0);
      await expect(topicsButton).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu").or(page.getByRole("dialog")).first()).toBeVisible();
      await expect(topicsButton).toBeFocused();
    });

    await it.step(`6. Tab enters the Topics menu parent list`, async () => {
      await page.keyboard.press("Tab");
      await expect(focusedElement(page)).toHaveAttribute("role", "menuitem");
      await expect(focusedElement(page)).toContainText("International banking");
    });

    await it.step(`7. Arrow down moves focus through parent topics`, async () => {
      await page.keyboard.press("ArrowDown");
      await expect(focusedElement(page)).toHaveAttribute("role", "menuitem");
      await expect(focusedElement(page)).toContainText("Debt securities");

      await page.keyboard.press("ArrowDown");
      await expect(focusedElement(page)).toHaveAttribute("role", "menuitem");
      await expect(focusedElement(page)).toContainText("Credit");
    });
  });
});
