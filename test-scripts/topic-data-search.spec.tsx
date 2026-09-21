import { expect, test, type Page } from "@playwright/test";

const DSS_SERIES_KEY = "Q.N.MT.XW.S11.S1.N.L.LE.F3VRC.T._Z.EUR._T.M.V.N._T";

async function gotoDssData(page: Page): Promise<void> {
  await page.goto("/topics/DSS/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Debt securities statistics" })).toBeVisible();
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

test.describe("Topic Data Search", () => {
  test("filters topic data by series key and country text", async ({ page }) => {
    await gotoDssData(page);
    await expect(main(page).getByText(/time series found/i).first()).toBeVisible();

    await searchTopicData(page, DSS_SERIES_KEY);
    await expect(main(page).getByText("1 time series found")).toBeVisible();
    await expect(main(page).getByText(DSS_SERIES_KEY)).toBeVisible();
    await expect(main(page).getByRole("article").first()).toContainText(/Malta/i);

    await main(page).getByRole("button", { name: /clear search terms/i }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/topics/DSS/data" && !url.searchParams.has("q"));
    await expect(main(page).getByRole("combobox", { name: "Search for time series" })).toHaveValue("");
    await expect(main(page).getByText(/time series found/i).first()).not.toHaveText("1 time series found");

    const input = main(page).getByRole("combobox", { name: "Search for time series" });
    await input.fill("Switzerland");
    await expect(page.getByRole("listbox").first()).toBeVisible();
    await expect(page.getByRole("option", { name: "Switzerland", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /Switzerland[\s\S]*Debt securities/i })).toBeVisible();
    await page.getByRole("option", { name: /Switzerland[\s\S]*Debt securities/i }).click();

    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Switzerland");
    await expect(main(page).getByText(/time series found/i).first()).toBeVisible();
    await expect(main(page).getByRole("article").first()).toContainText(/Switzerland|Swiss/i);
    await expect(main(page).getByRole("article").first()).not.toContainText(/Malta/i);

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Switzerland");
    await expect(main(page).getByRole("combobox", { name: "Search for time series" })).toHaveValue("Switzerland");
  });
});
