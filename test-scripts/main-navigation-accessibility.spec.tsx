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
    const topicsNavigation = page.getByRole("navigation", { name: "Topics navigation" });
    const subtopics = topicsNavigation.getByRole("complementary");
    const firstSubtopic = subtopics.getByRole("link").first();

    await it.step(`1. Go to /`, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`3. Header links are reachable by keyboard`, async () => {
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
      await expect(topicsNavigation.getByRole("menuitem", { name: "International banking", exact: true })).toBeVisible();
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
      const internationalBanking = topicsNavigation.getByRole("menuitem", { name: "International banking", exact: true });
      await expect(internationalBanking).toBeFocused();
      // Topic activation is delayed and cancelled on blur. Wait before the next Tab.
      await expect(internationalBanking).toHaveAttribute("aria-current", "true");
      await expect(firstSubtopic).toBeVisible();
    });

    await it.step(`7. Tab into the right-hand subtopic content area`, async () => {
      await page.keyboard.press("Tab");
    });

    await it.step(`8. Wait for the right-hand subtopics to render and verify focus`, async () => {
      await expect(subtopics).toBeVisible();
      await expect(firstSubtopic, "The Topics submenu should render its first subtopic link").toBeVisible();
      await expect(firstSubtopic).toContainText("Locational banking statistics");
      await expect(subtopics.getByRole("link", { name: /Consolidated banking statistics/ }).first()).toBeVisible();
      await expect(firstSubtopic).toBeFocused();
    });

    await it.step(`9. Tab focuses the subtopic data icon`, async () => {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("navigation", { name: "Topics navigation" })
        .getByRole("link", { name: "Go to data of Locational banking statistics", exact: true })).toBeFocused();
    });

    await it.step(`10. Three more Tabs focus the next top-level topic`, async () => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("menuitem", { name: "Debt securities", exact: true })).toBeFocused();
    });

    await it.step(`11. Arrow down moves focus through parent topics`, async () => {
      // Restore the starting topic for the original ArrowDown checks.
      await page.getByRole("menuitem", { name: "International banking", exact: true }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(focusedElement(page)).toHaveAttribute("role", "menuitem");
      await expect(focusedElement(page)).toContainText("Debt securities");

      await page.keyboard.press("ArrowDown");
      await expect(focusedElement(page)).toHaveAttribute("role", "menuitem");
      await expect(focusedElement(page)).toContainText("Credit");
    });
  });
});
