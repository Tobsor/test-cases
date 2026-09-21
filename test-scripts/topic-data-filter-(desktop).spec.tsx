import { expect, test, type Page } from "@playwright/test";

async function gotoTopicData(page: Page): Promise<void> {
  await page.goto("/topics/XTD_DER/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Exchange-traded derivatives statistics" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

function resultCount(page: Page) {
  return main(page).getByText(/time series found/i).first();
}

test.describe("Topic Data Filter (Desktop)", () => {
  test("applies, persists, and clears topic data filters", async ({ page }) => {
    await gotoTopicData(page);
    await expect(resultCount(page)).toHaveText(/1[,.]296 time series found/);

    await main(page).getByRole("button", { name: "Filters" }).click();
    await expect(main(page).getByRole("region", { name: "Filters" })).toBeVisible();

    await main(page).getByRole("button", { name: /Issue currency filter collapsed/i }).click();
    await page.getByRole("checkbox", { name: "Swiss Franc[CHF]" }).check();
    await expect(page).toHaveURL(/filter=.*ISSUE_CUR%3DCHF/);
    await expect(resultCount(page)).toContainText("40 time series found");
    await expect(main(page).getByRole("button", { name: /Clear Issue currency filter/i })).toBeVisible();

    await main(page).getByRole("button", { name: /Risk category filter collapsed/i }).click();
    await page.getByRole("checkbox", { name: "Interest rate, long-term[J]" }).check();
    await page.getByRole("checkbox", { name: "Interest rate, short-term[I]" }).check();
    await expect(page).toHaveURL(/filter=.*OD_RISK_CAT/);
    await expect(main(page).getByRole("button", { name: /Clear Risk category filter/i })).toBeVisible();

    await main(page).getByRole("button", { name: /Timespan filter collapsed/i }).click();
    await page.getByRole("button", { name: "5Y" }).click();
    await expect(page).toHaveURL(/filter=.*TIMESPAN/);
    await expect(main(page).getByRole("button", { name: /Clear Timespan filter/i })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(main(page).getByRole("button", { name: /Clear Issue currency filter/i })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Clear Risk category filter/i })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Clear Timespan filter/i })).toBeVisible();

    await main(page).getByRole("button", { name: /Clear Timespan filter/i }).click();
    await expect(main(page).getByRole("button", { name: /Clear Timespan filter/i })).toBeHidden();

    await main(page).getByRole("button", { name: /Location of trade \(Exchange or country\) filter collapsed/i }).click();
    await expect(page.getByRole("textbox", { name: "Filter Location of trade (Exchange or country) ..." })).toBeVisible();
    await page.keyboard.press("Escape");

    await main(page).getByRole("button", { name: /Clear Issue currency filter/i }).click();
    await main(page).getByRole("button", { name: /Clear Risk category filter/i }).click();
    await expect(page).not.toHaveURL(/filter=/);
  });
});
