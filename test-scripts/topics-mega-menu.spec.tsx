import { expect, test, type Page } from "@playwright/test";

const PARENT_TOPICS = [
  "International banking", "Debt securities", "Credit", "Global liquidity", "Derivatives",
  "Property prices", "Consumer prices", "Exchange rates", "Central bank statistics", "Payment statistics",
];
const PROPERTY_TOPICS = [
  { name: "Residential property prices", id: "RPP", description: "Tracks developments of residential property prices including regional data and information for various property types" },
  { name: "Commercial property prices", id: "CPP", description: "Tracks developments of office, retail premises and industrial property prices" },
];

async function hoverPropertyMenu(page: Page): Promise<void> {
  await page.getByRole("banner").getByRole("button", { name: "Topics", exact: true }).hover();
  const navigation = page.getByRole("navigation", { name: "Topics navigation", exact: true });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("menuitem", { name: "Property prices", exact: true }).hover();
  await expect(navigation.getByRole("complementary", { name: "Property prices-submenu", exact: true })).toBeVisible();
}

test.describe("Topics mega menu", () => {
  test("opens on hover and exposes property overview and data links", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "Topics navigation", exact: true });
    const detail = navigation.getByRole("complementary", { name: "Property prices-submenu", exact: true });
    const cardFor = (name: string) => detail.getByRole("article").filter({
      has: page.getByRole("heading", { name, level: 3, exact: true }),
    });

    await test.step("1. Go to the home page in desktop view", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", {
        level: 1, name: "Global statistics at the heart of international cooperation", exact: true,
      })).toBeVisible();
    });

    await test.step("2. Hover Topics and verify the ten parent topics", async () => {
      await page.getByRole("banner").getByRole("button", { name: "Topics", exact: true }).hover();
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("menuitem")).toHaveText(PARENT_TOPICS);
      for (const name of PARENT_TOPICS) {
        await expect(navigation.getByRole("menuitem", { name, exact: true })).toBeVisible();
      }
    });

    await test.step("3. Hover Property prices and verify the master-detail layout", async () => {
      await navigation.getByRole("menuitem", { name: "Property prices", exact: true }).hover();
      const heading = detail.getByRole("heading", { name: "Property prices", level: 2, exact: true });
      const description = detail.getByRole("paragraph");
      await expect(heading).toBeVisible();
      await expect(description).toBeVisible();
      await expect(description).toHaveText(/residential and the commercial market segments/);
      const menuBox = await navigation.getByRole("menu").boundingBox();
      const detailBox = await detail.boundingBox();
      const headingBox = await heading.boundingBox();
      const descriptionBox = await description.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(detailBox).not.toBeNull();
      expect(headingBox).not.toBeNull();
      expect(descriptionBox).not.toBeNull();
      expect(detailBox!.x).toBeGreaterThanOrEqual(menuBox!.x + menuBox!.width);
      expect(descriptionBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height);
    });

    await test.step("4. Verify the two property-topic cards and overview destinations", async () => {
      await expect(detail.getByRole("article")).toHaveCount(PROPERTY_TOPICS.length);
      for (const { name, id } of PROPERTY_TOPICS) {
        const card = cardFor(name);
        await expect(card.getByRole("heading", { name, level: 3, exact: true })).toBeVisible();
        await expect(card.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) }))
          .toHaveAttribute("href", `/topics/${id}`);
      }
    });

    await test.step("5. Hover each card and verify revealed text, image darkening, and Data icon", async () => {
      for (const { name, id, description } of PROPERTY_TOPICS) {
        await navigation.getByRole("menuitem", { name: "Property prices", exact: true }).hover();
        const card = cardFor(name);
        // Decorative image and visual overlays have no accessible roles or names.
        const image = card.locator("img");
        const overlayText = card.locator('[class*="TopicCard_overlayText__"]');
        const overlayBackground = card.locator('[class*="TopicCard_overlayBackground__"]');
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
        await expect(overlayText).toHaveCSS("opacity", "0");
        await expect(overlayBackground).toHaveCSS("opacity", "0");
        await card.hover();
        await expect(overlayText).toHaveText(description);
        await expect(overlayText).toHaveCSS("opacity", "1");
        await expect(overlayBackground).toHaveCSS("background-color", "rgb(0, 0, 0)");
        await expect.poll(() => overlayBackground.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);
        const data = card.getByRole("link", { name: `Go to data of ${name}`, exact: true });
        await expect(data).toBeVisible();
        await expect(data.getByRole("img")).toBeVisible();
        await expect(data).toHaveAttribute("href", `/topics/${id}/data`);
      }
    });

    await test.step("6. Open each card and verify its topic overview", async () => {
      for (const { name, id } of PROPERTY_TOPICS) {
        await hoverPropertyMenu(page);
        await cardFor(name).getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) }).click();
        await expect(page).toHaveURL((url) => url.pathname === `/topics/${id}`);
        await expect(page.getByRole("main").getByRole("heading", { name: new RegExp(`^${name}$`, "i"), level: 1 })).toBeVisible();
        await expect(page.getByRole("main").getByRole("navigation", { name: "Page navigation", exact: true })
          .getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
      }
    });

    await test.step("7. Open each Data icon and verify its topic data page", async () => {
      for (const { name, id } of PROPERTY_TOPICS) {
        await hoverPropertyMenu(page);
        const card = cardFor(name);
        await card.hover();
        await card.getByRole("link", { name: `Go to data of ${name}`, exact: true }).click();
        await expect(page).toHaveURL((url) => url.pathname === `/topics/${id}/data`);
        await expect(page.getByRole("main").getByRole("heading", { name: new RegExp(`^${name}$`, "i"), level: 1 })).toBeVisible();
        await expect(page.getByRole("main").getByRole("navigation", { name: "Page navigation", exact: true })
          .getByRole("link", { name: "Data", exact: true })).toHaveAttribute("aria-current", "page");
      }
    });
  });
});

