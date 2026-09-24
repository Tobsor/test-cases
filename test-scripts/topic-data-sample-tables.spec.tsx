import { expect, test, type Locator } from "@playwright/test";

const DATA_PATH = "/topics/TOTAL_CREDIT/data";

async function expectCardsWithCodePrefix(panel: Locator, prefix: string): Promise<void> {
  const cardDetails = await panel.getByRole("link").evaluateAll((links) => links.map((link) => ({
    href: link.getAttribute("href") ?? "",
    text: (link.textContent ?? "").trim(),
  })));

  expect(cardDetails.length).toBeGreaterThan(0);
  for (const card of cardDetails) {
    const encodedCode = card.href.match(/PDQ_(F\d(?:_[A-Z0-9]+)+),/)?.[1];
    expect(encodedCode, `Card should have a PDQ code in ${card.href}`).toBeTruthy();
    const code = encodedCode!.replaceAll("_", ".");
    expect(code).toMatch(new RegExp(`^${prefix.replace(".", "\\.")}`));
    expect(card.text.startsWith(code), `${card.text} should start with ${code}`).toBe(true);
    expect(card.text.slice(code.length).trim(), `${code} should have a title`).not.toBe("");
  }
}

test.describe("Topic Data Sample tables", () => {
  test("opens the documented sample table and verifies its complete data grid", async ({ page }) => {
    let sampleTables: Locator;

    await test.step("1. Open Total credit data and verify the expanded Sample tables section", async () => {
      await page.goto(DATA_PATH);
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Credit to the non-financial sector",
      })).toBeVisible();

      const sampleTablesButton = page.getByRole("main").getByRole("button", {
        name: "Sample tables",
        exact: true,
      });
      sampleTables = page.getByRole("region", { name: "Sample tables" });
      await expect(sampleTablesButton).toHaveAttribute("aria-expanded", "true");
      await expect(sampleTables).toBeVisible();

      for (const tabName of [
        /^Non.financial sector$/,
        /^Private non.financial sector$/,
        /^Households$/,
        /^Non.financial corporations$/,
        /^Government sector$/,
      ]) {
        await expect(sampleTables.getByRole("tab", { name: tabName })).toBeVisible();
      }

      const nonFinancialSector = sampleTables.getByRole("tab", { name: /^Non.financial sector$/ });
      await expect(nonFinancialSector).toHaveAttribute("aria-selected", "true");
      await expectCardsWithCodePrefix(sampleTables.getByRole("tabpanel"), "F1.");
    });

    await test.step("3. Select Households and verify every card has an F3 code and title", async () => {
      const households = sampleTables.getByRole("tab", { name: "Households", exact: true });
      await households.click();
      await expect(households).toHaveAttribute("aria-selected", "true");
      await expectCardsWithCodePrefix(sampleTables.getByRole("tabpanel"), "F3.");
    });

    await test.step("4. Select F3.1 and verify the tailored table settings and complete data", async () => {
      const f31 = sampleTables.getByRole("tabpanel").locator('a[href*="BIS,PDQ_F3_1,1.0"]');
      await expect(f31).toHaveCount(1);
      await expect(f31).toContainText("F3.1");
      await f31.click();

      await expect(page).toHaveURL((url) =>
        url.pathname === DATA_PATH &&
        url.searchParams.get("pdqId") === "BIS,PDQ_F3_1,1.0" &&
        url.searchParams.get("data_view") === "table" &&
        url.searchParams.get("rows") === "BORROWERS_CTY" &&
        url.searchParams.get("cols") === "TIME_PERIOD" &&
        url.searchParams.has("filter") &&
        url.searchParams.has("settings"),
      );

      await expect.soft(f31).toHaveClass(/active/i);
      await expect.soft(sampleTables.getByRole("tab", { name: "Households", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await expect(page.getByRole("main").getByRole("radio", { name: "Table", exact: true })).toBeChecked();

      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible();
      const headers = grid.getByRole("columnheader");
      await expect(headers.first()).toContainText("Borrowers' country");
      const headerTexts = await headers.allInnerTexts();
      expect(headerTexts.length).toBeGreaterThan(1);
      for (const dateHeader of headerTexts.slice(1)) {
        expect(dateHeader).toMatch(/\d{4}-\d{2}-\d{2}/);
      }

      const cellTexts = (await grid.getByRole("gridcell").allInnerTexts()).map((text) => text.trim());
      expect(cellTexts.length).toBeGreaterThan(0);
      expect(cellTexts.length % headerTexts.length).toBe(0);
      const countryCount = cellTexts.length / headerTexts.length;
      expect(countryCount).toBeGreaterThan(0);

      const countries = cellTexts.slice(0, countryCount);
      const values = cellTexts.slice(countryCount);
      expect(countries.every(Boolean), "Every row should name a borrower's country").toBe(true);
      expect(values).toHaveLength(countryCount * (headerTexts.length - 1));
      expect(
        values.every((value) => /^-?\d+(?:[.,]\d+)?$/.test(value)),
        "Every country/date cell should contain a number",
      ).toBe(true);
    });
  });
});
