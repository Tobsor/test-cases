import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

const it = test;

test.describe(`Home Page Highlights`, () => {
  test(`Home Page Highlights`, async ({ page }) => {
    const highlights = page.getByRole("region", { name: "Highlights", exact: true })
      .getByRole("region", { name: "Highlights", exact: true });
    await it.step(`1. Navigate to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`2. Scroll to the Highlights section`, async () => {
      await page.getByRole("heading", { name: "Highlights" }).scrollIntoViewIfNeeded();
      await expect(highlights).toBeVisible();
      await expect(highlights.getByRole("link").first()).toBeVisible();
      await expect(highlights.getByRole("button", { name: "Go to slide 1" })).toHaveAttribute("aria-current", "true");
      await expect(highlights.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "false");
    });

    await it.step(`3. Highlight cards expose links`, async () => {
      await expect(highlights.getByRole("link").first()).toBeVisible();
      await highlights.hover();
      await expect(highlights.getByRole("button", { name: /Go to next slide/i })).toBeVisible();
    });

    await it.step(`4. Navigate using carousel dots`, async () => {
      await highlights.getByRole("button", { name: /Go to next slide/i }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true");
      await expect(highlights.getByRole("button", { name: /Go to previous slide/i })).toBeVisible();
      await highlights.getByRole("button", { name: "Go to slide 4" }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 4" })).toHaveAttribute("aria-current", "true");
      await highlights.getByRole("button", { name: "Go to slide 1" }).click();
      await expect(highlights.getByRole("button", { name: "Go to slide 1" })).toHaveAttribute("aria-current", "true");
    });

    await it.step(`5. Tab focuses news card links and then the navigation dots`, async () => {
      const card = highlights.getByRole("group", { name: /^Slide 1 of \d+$/ });
      const links = card.getByRole("link");
      await expect(links.first()).toBeVisible();
      // Stop hovering the carousel so its mouse-only arrow controls do not intervene.
      await page.mouse.move(0, 0);

      // Establish the natural tab stop preceding the card before testing forward navigation.
      await links.first().focus();
      await page.keyboard.press("Shift+Tab");
      await expect.poll(() => card.evaluate((element) => {
        const focused = document.activeElement;
        return focused !== null && focused !== document.body && !element.contains(focused)
          && Boolean(element.compareDocumentPosition(focused) & Node.DOCUMENT_POSITION_PRECEDING);
      })).toBe(true);

      for (const link of await links.all()) {
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
      }
      await page.keyboard.press("Tab");
      await expect(highlights.getByRole("button", { name: "Go to slide 1", exact: true })).toBeFocused();
    });
  });
});
