import { expect, test, type Locator, type Page } from "@playwright/test";

const DATA_PATH = "/topics/DSS/data";

function searchInput(page: Page): Locator {
  return page.getByRole("main").getByRole("combobox", { name: "Search for time series" });
}

function resultCount(page: Page): Locator {
  return page.getByRole("main").getByText(/^[\d,.]+ time series found$/).first();
}

function countFrom(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

async function expectVisibleResultsFrom(page: Page, referenceArea: string): Promise<void> {
  const cards = page.getByRole("main").getByRole("article");
  await expect(cards.first()).toContainText(referenceArea);
  const cardTexts = await cards.allInnerTexts();
  expect(cardTexts.length).toBeGreaterThan(0);
  expect(
    cardTexts.every((text) => text.includes(referenceArea)),
    `Every visible result should relate to ${referenceArea}`,
  ).toBe(true);
}

test.describe("Topic Data Search", () => {
  test("filters topic data by series key and reference-area suggestion", async ({ page }) => {
    let fullResultCount = 0;
    let switzerlandResultCount = 0;
    let identifiedSeriesKey = "";
    let identifiedSeriesTitle = "";

    await test.step("1. Navigate to /topics/DSS/data", async () => {
      await page.goto(DATA_PATH);
      await expect(page.getByRole("heading", { level: 1, name: "Debt securities statistics" })).toBeVisible();
      await expect(resultCount(page)).toBeVisible();
      fullResultCount = countFrom(await resultCount(page).innerText());
      expect(fullResultCount).toBeGreaterThan(0);
    });

    await test.step("2. Identify an item in the time-series list and note its series key", async () => {
      const item = page.getByRole("main").getByRole("article").first();
      await expect(item).toBeVisible();
      const lines = (await item.innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
      const seriesKeyLabel = lines.indexOf("Series key");
      expect(seriesKeyLabel).toBeGreaterThanOrEqual(0);
      identifiedSeriesKey = lines[seriesKeyLabel + 1] ?? "";
      identifiedSeriesTitle = lines[seriesKeyLabel + 2] ?? "";
      expect(identifiedSeriesKey).toMatch(/^[A-Z]\./);
      expect(identifiedSeriesTitle).not.toBe("");
    });

    await test.step("3. Search by series key and verify the identified item", async () => {
      await searchInput(page).fill(identifiedSeriesKey);
      await searchInput(page).press("Enter");
      await expect(page).toHaveURL((url) =>
        url.pathname === DATA_PATH && url.searchParams.get("q") === identifiedSeriesKey,
      );
      await expect(resultCount(page)).toHaveText("1 time series found");

      const result = page.getByRole("main").getByRole("article");
      await expect(result).toHaveCount(1);
      await expect(result).toContainText(identifiedSeriesKey);
      await expect(result).toContainText(identifiedSeriesTitle);
    });

    await test.step("4. Clear the search and restore all unselected time series", async () => {
      await page.getByRole("main").getByRole("button", { name: /clear search terms/i }).click();
      await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && !url.searchParams.has("q"));
      await expect(searchInput(page)).toHaveValue("");
      await expect.poll(async () => countFrom(await resultCount(page).innerText())).toBe(fullResultCount);
      await expect(page.getByRole("main").getByRole("checkbox", { checked: true })).toHaveCount(0);
    });

    await test.step("5. Type Switzerland and verify all suggestions relate to it", async () => {
      await searchInput(page).fill("Switzerland");
      const suggestions = page.getByRole("option");
      await expect(suggestions.first()).toBeVisible();
      const suggestionTexts = await suggestions.allInnerTexts();
      expect(suggestionTexts.length).toBeGreaterThan(0);
      expect(suggestionTexts.every((text) => text.includes("Switzerland"))).toBe(true);
      await expect(page.getByRole("option", { name: "Switzerland", exact: true })).toBeVisible();
    });

    await test.step("6. Select Switzerland and verify its reference-area filter and results", async () => {
      await page.getByRole("option", { name: "Switzerland", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && url.searchParams.get("q") === "Switzerland");
      await expect(searchInput(page)).toHaveValue("Switzerland");
      await expectVisibleResultsFrom(page, "Switzerland");
      switzerlandResultCount = countFrom(await resultCount(page).innerText());
      expect(switzerlandResultCount).toBeLessThan(fullResultCount);

      await page.getByRole("main").getByRole("button", { name: "Filters", exact: true }).click();
      await expect(page.getByRole("main").getByRole("button", {
        name: /^Reference area filter collapsed/,
      })).toContainText("Reference area: Switzerland");
    });

    await test.step("7. Reload and verify the Switzerland search state persists", async () => {
      await page.reload();
      await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && url.searchParams.get("q") === "Switzerland");
      await expect(searchInput(page)).toHaveValue("Switzerland");
      await expect.poll(async () => countFrom(await resultCount(page).innerText())).toBe(switzerlandResultCount);
      await expectVisibleResultsFrom(page, "Switzerland");

      const referenceArea = page.getByRole("main").getByRole("button", {
        name: /^Reference area filter collapsed/,
      });
      if (!(await referenceArea.isVisible())) {
        await page.getByRole("main").getByRole("button", { name: "Filters", exact: true }).click();
      }
      await expect(referenceArea).toContainText("Reference area: Switzerland");
    });
  });
});
