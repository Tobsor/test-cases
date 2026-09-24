import { expect, test, type Locator, type Page } from "@playwright/test";

const DATA_PATH = "/topics/EER/data";

function main(page: Page): Locator {
  return page.getByRole("main");
}

function searchInput(page: Page): Locator {
  return main(page).getByRole("combobox", { name: "Search for time series" });
}

function resultCount(page: Page): Locator {
  return main(page).getByText(/^[\d,.]+ time series found$/).first();
}

function numberFrom(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

async function search(page: Page, query: string): Promise<void> {
  await searchInput(page).fill(query);
  await searchInput(page).press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && url.searchParams.get("q") === query);
}

async function clearSearch(page: Page, fullCount: number): Promise<void> {
  await main(page).getByRole("button", { name: /clear search terms/i }).click();
  await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && !url.searchParams.has("q"));
  await expect(searchInput(page)).toHaveValue("");
  await expect.poll(async () => numberFrom(await resultCount(page).innerText())).toBe(fullCount);
  await expect(main(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
}

async function visibleSeriesKeys(page: Page): Promise<string[]> {
  const cards = main(page).getByRole("article");
  await expect(cards.first()).toBeVisible();
  return (await cards.allInnerTexts()).map((text) => {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines[lines.indexOf("Series key") + 1] ?? "";
  });
}

async function openFilters(page: Page): Promise<void> {
  const referenceArea = main(page).getByRole("button", { name: /^Reference area filter collapsed/ });
  if (!(await referenceArea.isVisible())) {
    await main(page).getByRole("button", { name: "Filters", exact: true }).click();
  }
  await expect(referenceArea).toBeVisible();
}

test.describe("Topic Data Series Key Search", () => {
  test("searches exact, wildcard, partial, and plus-operator series keys", async ({ page }) => {
    let fullCount = 0;
    let identifiedKey = "";
    let identifiedTitle = "";
    let referenceArea = "";
    let referenceWildcardCount = 0;
    let referenceWildcardKeys: string[] = [];
    let typeWildcardCount = 0;
    let typeWildcardKeys: string[] = [];

    await test.step("1. Navigate to /topics/EER/data", async () => {
      await page.goto(DATA_PATH);
      await expect(page.getByRole("heading", { level: 1, name: "Effective exchange rates" })).toBeVisible();
      await expect(resultCount(page)).toBeVisible();
      fullCount = numberFrom(await resultCount(page).innerText());
      expect(fullCount).toBeGreaterThan(0);
    });

    await test.step("2. Identify one listed item and note its series key", async () => {
      const item = main(page).getByRole("article").filter({ hasText: /Series key\s*M\.N\.B\./ }).first();
      await expect(item).toBeVisible();
      const lines = (await item.innerText()).split("\n").map((line) => line.trim()).filter(Boolean);
      const keyLabel = lines.indexOf("Series key");
      identifiedKey = lines[keyLabel + 1] ?? "";
      identifiedTitle = lines[keyLabel + 2] ?? "";
      expect(identifiedKey.split(".")).toHaveLength(4);
      expect(identifiedTitle).not.toBe("");
      referenceArea = identifiedTitle.match(/, ([^/]+)\s*\//)?.[1].trim() ?? "";
      expect(referenceArea).not.toBe("");
    });

    await test.step("3. Search by the identified series key and verify its item and reference area", async () => {
      await search(page, identifiedKey);
      await expect(resultCount(page)).toHaveText("1 time series found");
      const result = main(page).getByRole("article");
      await expect(result).toHaveCount(1);
      await expect(result).toContainText(identifiedKey);
      await expect(result).toContainText(identifiedTitle);

      await openFilters(page);
      await expect(main(page).getByRole("button", { name: /^Reference area filter collapsed/ })).toContainText(
        `Reference area: ${referenceArea}`,
      );
    });

    await test.step("4. Clear the search and restore all unselected time series", async () => {
      await clearSearch(page, fullCount);
    });

    await test.step("5. Replace the reference-area code with * and verify prefix matches without a country filter", async () => {
      const [frequency, type, basket] = identifiedKey.split(".");
      const query = `${frequency}.${type}.${basket}.*`;
      await search(page, query);
      referenceWildcardCount = numberFrom(await resultCount(page).innerText());
      expect(referenceWildcardCount).toBeGreaterThan(1);
      await expect.poll(async () =>
        (await visibleSeriesKeys(page)).every((key) => key.startsWith("M.N.B.")),
      ).toBe(true);
      referenceWildcardKeys = await visibleSeriesKeys(page);

      await openFilters(page);
      await expect(main(page).getByRole("button", { name: /^Reference area filter collapsed/ })).toHaveText(
        "Reference area",
      );
    });

    await test.step("6. Remove * and verify the same prefix-search results", async () => {
      const [frequency, type, basket] = identifiedKey.split(".");
      await search(page, `${frequency}.${type}.${basket}.`);
      await expect.poll(async () => numberFrom(await resultCount(page).innerText())).toBe(referenceWildcardCount);
      await expect.poll(async () => JSON.stringify(await visibleSeriesKeys(page))).toBe(
        JSON.stringify(referenceWildcardKeys),
      );
      const keys = await visibleSeriesKeys(page);
      expect(keys).toEqual(referenceWildcardKeys);
      expect(keys.every((key) => key.startsWith("M.N.B."))).toBe(true);
      await expect(main(page).getByRole("button", { name: /^Reference area filter collapsed/ })).toHaveText(
        "Reference area",
      );
    });

    await test.step("7. Clear the search and restore all unselected time series", async () => {
      await clearSearch(page, fullCount);
    });

    await test.step("8. Replace the type code with * and verify matches without a type filter", async () => {
      const [frequency, , basket, area] = identifiedKey.split(".");
      await search(page, `${frequency}.*.${basket}.${area}`);
      typeWildcardCount = numberFrom(await resultCount(page).innerText());
      expect(typeWildcardCount).toBeGreaterThan(0);
      await expect.poll(async () =>
        (await visibleSeriesKeys(page)).every((key) => /^M\.[^. ]\.B\.DZ$/.test(key)),
      ).toBe(true);
      typeWildcardKeys = await visibleSeriesKeys(page);

      await openFilters(page);
      await expect(main(page).getByRole("button", { name: /^Type filter collapsed/ })).toHaveText("Type");
    });

    await test.step("9. Remove * and leave the type position empty, then verify the same results", async () => {
      const [frequency, , basket, area] = identifiedKey.split(".");
      await search(page, `${frequency}..${basket}.${area}`);
      await expect.poll(async () => numberFrom(await resultCount(page).innerText())).toBe(typeWildcardCount);
      await expect.poll(async () => JSON.stringify(await visibleSeriesKeys(page))).toBe(
        JSON.stringify(typeWildcardKeys),
      );
      const keys = await visibleSeriesKeys(page);
      expect(keys).toEqual(typeWildcardKeys);
      expect(keys.every((key) => /^M\.[^. ]\.B\.DZ$/.test(key))).toBe(true);
      await expect(main(page).getByRole("button", { name: /^Type filter collapsed/ })).toHaveText("Type");
    });

    await test.step("10. Search M.N+R.B.DZ and verify two Algeria results and implicit filters", async () => {
      await search(page, "M.N+R.B.DZ");
      await expect(resultCount(page)).toHaveText("2 time series found");
      const results = main(page).getByRole("article");
      await expect(results).toHaveCount(2);
      await expect(main(page)).toContainText("Nominal effective exchange rate, Algeria / Broad basket");
      await expect(main(page)).toContainText("Real effective exchange rate, Algeria / Broad basket");
      await expect(main(page).getByRole("button", { name: /^Reference area filter collapsed/ })).toContainText(
        "Reference area: Algeria",
      );
      await expect(main(page).getByRole("button", { name: /^Type filter collapsed/ })).toHaveText("Type");
    });

    // The source markdown contains two steps numbered 10; preserve its numbering.
    await test.step("10. Extend the search with +AR and verify all four Algeria and Argentina results", async () => {
      await search(page, "M.N+R.B.DZ+AR");
      await expect(resultCount(page)).toHaveText("4 time series found");
      const results = main(page).getByRole("article");
      await expect(results).toHaveCount(4);
      for (const title of [
        "Nominal effective exchange rate, Algeria / Broad basket",
        "Real effective exchange rate, Algeria / Broad basket",
        "Nominal effective exchange rate, Argentina / Broad basket",
        "Real effective exchange rate, Argentina / Broad basket",
      ]) {
        await expect(main(page)).toContainText(title);
      }
    });
  });
});
