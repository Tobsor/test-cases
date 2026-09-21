import { expect, test, type Page } from "@playwright/test";

async function gotoTotalCreditData(page: Page): Promise<void> {
  await page.goto("/topics/TOTAL_CREDIT/data");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Credit to the non-financial sector" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topic Data Sample tables", () => {
  test("opens sample table category tabs and template cards", async ({ page }) => {
    await gotoTotalCreditData(page);

    const sampleTables = main(page).getByRole("region", { name: "Sample tables" });
    await expect(sampleTables).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Sample tables" })).toHaveAttribute("aria-expanded", "true");

    for (const tab of [
      "Non‑financial sector",
      "Private non‑financial sector",
      "Households",
      "Non‑financial corporations",
      "Government sector",
    ]) {
      await expect(sampleTables.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }

    await expect(sampleTables.getByRole("tab", { name: "Non‑financial sector", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const nonFinancialPanel = sampleTables.locator('[role="tabpanel"]:not([hidden])');
    await expect(nonFinancialPanel).toBeVisible();
    await expect(nonFinancialPanel.getByRole("link").first()).toContainText(/^F1\./);
    await expect(nonFinancialPanel.getByRole("link")).toHaveCount(5);

    await sampleTables.getByRole("tab", { name: "Households", exact: true }).click();
    await expect(sampleTables.getByRole("tab", { name: "Households", exact: true })).toHaveAttribute("aria-selected", "true");
    const householdsPanel = sampleTables.locator('[role="tabpanel"]:not([hidden])');
    await expect(householdsPanel).toBeVisible();
    await expect(householdsPanel.getByRole("link").first()).toContainText(/^F3\./);
    await expect(householdsPanel.getByRole("link")).toHaveCount(5);

    const f31 = householdsPanel.locator('a[href*="BIS,PDQ_F3_1,1.0"]').first();
    await expect(f31).toHaveAttribute("href", /\/topics\/TOTAL_CREDIT\/data\/BIS,PDQ_F3_1,1\.0/);
    await f31.click();

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/topics/TOTAL_CREDIT/data" &&
        url.searchParams.get("pdqId") === "BIS,PDQ_F3_1,1.0" &&
        url.searchParams.get("data_view") === "table",
    );
    await expect(page.getByRole("heading", { level: 1, name: "Credit to the non-financial sector" })).toBeVisible();
    await expect(main(page).getByText(/F3\.1|Households/i).first()).toBeVisible();
    await expect(main(page).getByRole("radio", { name: "Table" })).toBeChecked();
    await expect(main(page).getByRole("grid")).toBeVisible();
    await expect(main(page).getByRole("grid")).toContainText("Borrowers' country");
    await expect(main(page).getByRole("grid")).toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(main(page).getByRole("grid")).toContainText(/Argentina|Australia|Switzerland/);
    await expect(main(page).getByRole("grid")).toContainText(/\d+[,.]\d/);
  });
});
