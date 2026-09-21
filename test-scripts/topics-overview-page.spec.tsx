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

async function gotoTopics(page: Page): Promise<void> {
  await page.goto("/topics");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "BIS statistics" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topics Overview Page", () => {
  test("lists parent topic chips and all leaf topic cards", async ({ page }) => {
    await gotoTopics(page);

    await expect(page).toHaveTitle(/BIS statistics \| BIS Data Portal/);
    await expect(main(page).getByText(/compiled in cooperation with central banks/i)).toBeVisible();

    const chips = main(page).getByRole("radiogroup", { name: "Topics filter chips" });
    await expect(chips.getByRole("radio")).toHaveCount(PARENT_TOPICS.length);
    for (const topic of PARENT_TOPICS) {
      await expect(chips.getByRole("radio", { name: `Sort for items related to ${topic}` })).toBeVisible();
    }

    const topicsList = main(page).getByRole("region", { name: "Topics list" });
    await expect(topicsList.getByRole("article")).toHaveCount(20);

    await expect(topicsList.getByRole("link", { name: /Locational banking statistics/i })).toHaveAttribute(
      "href",
      "/topics/LBS",
    );
    await expect(topicsList.getByRole("link", { name: /Bilateral exchange rates/i })).toHaveAttribute(
      "href",
      "/topics/XRU",
    );
    await expect(topicsList.getByRole("link", { name: /Financial market infrastructures and critical service providers/i })).toHaveAttribute(
      "href",
      "/topics/CPMI_FMI",
    );

    await topicsList.getByRole("link", { name: /Effective exchange rates/i }).click();
    await expect(page).toHaveURL("/topics/EER");
    await expect(page.getByRole("heading", { level: 1, name: "Effective exchange rates" })).toBeVisible();
  });
});
