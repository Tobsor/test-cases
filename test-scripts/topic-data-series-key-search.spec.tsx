import { expect, test, type Page } from "@playwright/test";

const SEARCH_CASES = [
  { query: "M.N.B.DZ", count: "1 time series found" },
  { query: "M.N.B.*", count: "64 time series found" },
  { query: "M.N.B.", count: "64 time series found" },
  { query: "M.*.B.DZ", count: "2 time series found" },
  { query: "M..B.DZ", count: "2 time series found" },
  { query: "M.N+R.B.DZ", count: "2 time series found" },
  { query: "M.N+R.B.DZ+AR", count: "4 time series found" },
];

async function gotoEerData(page: Page): Promise<void> {
  await page.goto("/topics/EER/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Effective exchange rates" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

async function searchTopicData(page: Page, query: string): Promise<void> {
  const input = main(page).getByRole("combobox", { name: "Search for time series" });
  await input.fill("");
  await input.fill(query);
  await input.press("Enter");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
}

test.describe("Topic Data Series Key Search", () => {
  test("searches exact, wildcard, partial, and plus-operator series keys", async ({ page }) => {
    await gotoEerData(page);
    await expect(
      main(page).getByRole("link", { name: "Nominal effective exchange rate, Algeria / Broad basket" }).first(),
    ).toBeVisible();

    for (const { query, count } of SEARCH_CASES) {
      await searchTopicData(page, query);
      await expect(main(page).getByText(count)).toBeVisible();

      if (query === "M.N.B.DZ") {
        await expect(main(page).getByRole("article")).toHaveCount(1);
        await expect(main(page).getByRole("article").first()).toContainText("M.N.B.DZ");
        await expect(main(page).getByRole("article").first()).toContainText(
          "Nominal effective exchange rate, Algeria / Broad basket",
        );
      }

      if (query === "M.N.B.*" || query === "M.N.B.") {
        await expect(main(page).getByRole("article").first()).toContainText(/Series key\s*M\.N\.B\./);
        await expect(main(page).getByRole("article").first()).toContainText(/Broad basket/);
      }

      if (query === "M.*.B.DZ" || query === "M..B.DZ" || query === "M.N+R.B.DZ") {
        await expect(main(page)).toContainText("Nominal effective exchange rate, Algeria / Broad basket");
        await expect(main(page)).toContainText("Real effective exchange rate, Algeria / Broad basket");
        await expect(main(page)).not.toContainText("Argentina / Broad basket");
      }

      if (query === "M.N+R.B.DZ+AR") {
        await expect(main(page)).toContainText("Nominal effective exchange rate, Algeria / Broad basket");
        await expect(main(page)).toContainText("Real effective exchange rate, Algeria / Broad basket");
        await expect(main(page)).toContainText("Nominal effective exchange rate, Argentina / Broad basket");
        await expect(main(page)).toContainText("Real effective exchange rate, Argentina / Broad basket");
      }
    }

    await main(page).getByRole("button", { name: /clear search terms/i }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/topics/EER/data" && !url.searchParams.has("q"));
    await expect(main(page).getByRole("combobox", { name: "Search for time series" })).toHaveValue("");
    await expect(main(page).getByText(/time series found/i).first()).toBeVisible();
  });
});
