import { expect, test, type Page } from "@playwright/test";

const PARENT_TOPICS = [
  "International banking",
  "Debt securities",
  "Credit",
  "Global liquidity",
  "Derivatives",
  "Property prices",
  "Consumer prices",
  "Exchange rates",
  "Central bank statistics",
  "Payment statistics",
];

async function gotoHome(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { level: 1, name: "Global statistics at the heart of international cooperation" }),
  ).toBeVisible();
}

async function openTopicsMenu(page: Page) {
  const topicsButton = page.getByRole("banner").getByRole("button", { name: "Topics" });
  await expect(topicsButton).toBeVisible();
  await topicsButton.click();

  const topicsNavigation = page.getByRole("navigation", { name: "Topics navigation" });
  await expect(topicsNavigation).toBeVisible();
  return topicsNavigation;
}

test.describe("Topics mega menu", () => {
  test("opens parent topics and property-prices detail links", async ({ page }) => {
    await gotoHome(page);

    const topicsNavigation = await openTopicsMenu(page);
    await expect(topicsNavigation.getByRole("menuitem")).toHaveCount(PARENT_TOPICS.length);

    for (const topic of PARENT_TOPICS) {
      await expect(topicsNavigation.getByRole("menuitem", { name: topic })).toBeVisible();
    }

    await topicsNavigation.getByRole("menuitem", { name: "Property prices" }).click();

    const propertySubmenu = topicsNavigation.getByRole("complementary", { name: "Property prices-submenu" });
    await expect(propertySubmenu).toBeVisible();
    await expect(propertySubmenu.getByRole("heading", { level: 2, name: "Property prices" })).toBeVisible();
    await expect(propertySubmenu).toContainText("residential and the commercial market segments");

    const residential = propertySubmenu.getByRole("link", { name: /Residential property prices/i });
    const commercial = propertySubmenu.getByRole("link", { name: /Commercial property prices/i });
    await expect(residential).toHaveAttribute("href", "/topics/RPP");
    await expect(commercial).toHaveAttribute("href", "/topics/CPP");

    await commercial.click();
    await expect(page).toHaveURL("/topics/CPP");
    await expect(page.getByRole("heading", { level: 1, name: "Commercial property prices" })).toBeVisible();
  });
});
