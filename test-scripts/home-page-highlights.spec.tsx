import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Home Page Highlights`, () => {
  test(`Home Page Highlights`, async ({ page }) => {
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Scroll to the Highlights section`, async () => {
      await page.getByRole("heading", { name: "Highlights" }).scrollIntoViewIfNeeded();
      await expect(page.locator('section[aria-label="Highlights"]')).toBeVisible();
      const highlights = page.locator('section[aria-label="Highlights"]');
      await expect(highlights.getByRole("link").first()).toBeVisible();
      await expect(highlights.getByRole("button", { name: "Go to slide 1" })).toHaveAttribute("aria-current", "true");
      await expect(highlights.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "false");
    });

    await it.step(`3. Highlight cards expose links`, async () => {
      const highlights = page.locator('section[aria-label="Highlights"]');
      await expect(highlights.getByRole("link").first()).toBeVisible();
      await highlights.hover();
      await expect(highlights.getByRole("button", { name: /Go to next slide/i })).toBeVisible();
    });

    await it.step(`4. Navigate using carousel dots`, async () => {
      const highlights = page.locator('section[aria-label="Highlights"]');
      await highlights.getByRole("button", { name: /Go to next slide/i }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true");
      await expect(highlights.getByRole("button", { name: /Go to previous slide/i })).toBeVisible();
      await highlights.getByRole("button", { name: "Go to slide 4" }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 4" })).toHaveAttribute("aria-current", "true");
      await highlights.getByRole("button", { name: "Go to slide 1" }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 1" })).toHaveAttribute("aria-current", "true");
    });

    await it.step(`5. Tab can reach content inside the carousel`, async () => {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
    });
  });
});
