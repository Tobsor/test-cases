import { expect, test, type Page } from "@playwright/test";

async function gotoTopics(page: Page): Promise<void> {
  await page.goto("/topics");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "BIS statistics" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topic Overview Page Filtering", () => {
  test("filters the topics list by Exchange rates and restores the full list", async ({ page }) => {
    await gotoTopics(page);

    const chips = main(page).getByRole("radiogroup", { name: "Topics filter chips" });
    const topicsList = main(page).getByRole("region", { name: "Topics list" });

    await expect(topicsList.getByRole("article")).toHaveCount(20);

    const exchangeRates = chips.getByRole("radio", { name: "Sort for items related to Exchange rates" });
    await exchangeRates.click();

    await expect(page).toHaveURL(/\/topics\?topicFilter=EXR$/);
    await expect(exchangeRates).toBeChecked();
    await expect(topicsList.getByRole("article")).toHaveCount(2);
    await expect(topicsList.getByRole("link", { name: /Bilateral exchange rates/i })).toHaveAttribute(
      "href",
      "/topics/XRU",
    );
    await expect(topicsList.getByRole("link", { name: /Effective exchange rates/i })).toHaveAttribute(
      "href",
      "/topics/EER",
    );
    await expect(topicsList.getByRole("link", { name: /Consumer prices/i })).toHaveCount(0);

    await exchangeRates.click();

    await expect(page).toHaveURL(/\/topics$/);
    await expect(exchangeRates).not.toBeChecked();
    await expect(topicsList.getByRole("article")).toHaveCount(20);
  });
});
