import { expect, test, type Locator, type Page } from "@playwright/test";

const DATA_PATH = "/topics/XTD_DER/data";

function resultCount(page: Page): Locator {
  return page.getByRole("main").getByText(/^[\d.,\s]+ time series found$/).first();
}

function numberFrom(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

async function currentResultCount(page: Page): Promise<number> {
  return numberFrom(await resultCount(page).innerText());
}

async function filterOption(page: Page, label: string): Promise<{ option: Locator; count: number }> {
  const option = page.getByRole("option").filter({ hasText: label });
  await expect(option).toHaveCount(1);
  const lines = (await option.innerText()).trim().split(/\s+/);
  return { option, count: numberFrom(lines.at(-1) ?? "") };
}

function timespan(url: URL): [Date, Date] {
  const match = url.searchParams.get("filter")?.match(/TIMESPAN=([^_]+)_([^\^]+)/);
  expect(match, "The URL should contain a TIMESPAN range").not.toBeNull();
  return [new Date(match![1]), new Date(match![2])];
}

test.describe("Topic Data Filter (Desktop)", () => {
  test("applies, persists, and resets the documented topic filters", async ({ page }) => {
    let fullCount = 0;
    let riskFilteredCount = 0;
    let yearFilteredCount = 0;

    await test.step("1. Go to /topics/XTD_DER/data", async () => {
      expect(page.viewportSize()!.width, "This test requires a desktop viewport").toBeGreaterThanOrEqual(1024);
      await page.goto(DATA_PATH);
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Exchange-traded derivatives statistics",
      })).toBeVisible();
    });

    await test.step("2. Record the full result count", async () => {
      await expect(resultCount(page)).toBeVisible();
      fullCount = await currentResultCount(page);
      expect(fullCount).toBeGreaterThan(0);
    });

    await test.step("3. Expand Filters and open Issue currency", async () => {
      await page.getByRole("main").getByRole("button", { name: "Filters", exact: true }).click();
      await page.getByRole("main").getByRole("button", { name: /^Issue currency filter collapsed/ }).click();
      await expect(page.getByRole("textbox", { name: "Filter Issue currency ..." })).toBeVisible();
    });

    await test.step("4. Type Swiss without clicking the filter input", async () => {
      await page.keyboard.type("Swiss");
      await expect(page.getByRole("textbox", { name: "Filter Issue currency ..." })).toHaveValue("Swiss");
      await expect(page.getByRole("option").filter({ hasText: "Swiss Franc" })).toBeVisible();
    });

    await test.step("5. Select Swiss Franc and match the result count to its chip count", async () => {
      const swissFranc = await filterOption(page, "Swiss Franc");
      expect(swissFranc.count).toBeGreaterThan(0);
      await swissFranc.option.click();
      await page.keyboard.press("Escape");

      await expect.poll(() => currentResultCount(page)).toBe(swissFranc.count);
      await expect(page.getByRole("button", { name: "Clear Issue currency filter", exact: true })).toBeVisible();
    });

    // The source markdown contains two steps numbered 5; preserve its numbering.
    await test.step("5. Open Risk category", async () => {
      await page.getByRole("main").getByRole("button", { name: /^Risk category filter collapsed/ }).click();
      await expect(page.getByRole("option").filter({ hasText: "Interest rate, long-term" })).toBeVisible();
    });

    await test.step("6. Select long-term and short-term interest rates and match their chip counts", async () => {
      const longTerm = await filterOption(page, "Interest rate, long-term");
      const shortTerm = await filterOption(page, "Interest rate, short-term");
      await longTerm.option.click();
      await shortTerm.option.click();
      await page.keyboard.press("Escape");

      riskFilteredCount = longTerm.count + shortTerm.count;
      await expect.poll(() => currentResultCount(page)).toBe(riskFilteredCount);
      await expect(page.getByRole("button", { name: "Clear Risk category filter", exact: true })).toBeVisible();
    });

    await test.step("7. Open Timespan", async () => {
      await page.getByRole("main").getByRole("button", { name: /^Timespan filter collapsed/ }).click();
      await expect(page.getByRole("tab", { name: "Range", exact: true })).toBeVisible();
    });

    await test.step("8. Select 5Y and verify its active five-year range", async () => {
      const fiveYears = page.getByRole("button", { name: "5Y", exact: true });
      await fiveYears.click();
      await expect(fiveYears).toHaveClass(/chip--checked/);

      const [start, end] = timespan(new URL(page.url()));
      const elapsedDays = (end.getTime() - start.getTime()) / 86_400_000;
      expect(elapsedDays).toBeGreaterThanOrEqual(1_825);
      expect(elapsedDays).toBeLessThanOrEqual(1_827);
    });

    await test.step("9. Reset the Timespan filter", async () => {
      await page.getByRole("button", { name: "Reset", exact: true }).last().click();
      await expect(page).toHaveURL((url) => !url.searchParams.get("filter")?.includes("TIMESPAN="));
    });

    await test.step("10. Open the Years tab", async () => {
      await page.getByRole("tab", { name: "Years", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Years", exact: true })).toHaveAttribute("aria-selected", "true");
    });

    await test.step("11. Scroll to and select the last two years", async () => {
      const oldestYear = page.getByRole("checkbox", { name: "1975", exact: true });
      const nextOldestYear = page.getByRole("checkbox", { name: "1976", exact: true });
      await oldestYear.scrollIntoViewIfNeeded();
      await nextOldestYear.check();
      await oldestYear.check();
      await expect(page).toHaveURL((url) =>
        decodeURIComponent(url.searchParams.get("filter") ?? "").includes("YEAR=1976|1975"),
      );
    });

    await test.step("12. Close Timespan and verify fewer results", async () => {
      await page.keyboard.press("Escape");
      yearFilteredCount = await currentResultCount(page);
      expect(yearFilteredCount).toBeLessThan(riskFilteredCount);
    });

    await test.step("13. Refresh the browser", async () => {
      await page.reload();
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Exchange-traded derivatives statistics",
      })).toBeVisible();
      await expect.poll(() => currentResultCount(page)).toBe(yearFilteredCount);
    });

    await test.step("14. Reopen Filters and verify state and result count persisted", async () => {
      const clearIssueCurrency = page.getByRole("button", {
        name: "Clear Issue currency filter",
        exact: true,
      });
      if (!(await clearIssueCurrency.isVisible())) {
        await page.getByRole("main").getByRole("button", { name: "Filters", exact: true }).click();
      }
      await expect(clearIssueCurrency).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear Risk category filter", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear Years filter", exact: true })).toBeVisible();

      await expect(page.getByRole("button", { name: /^Issue currency filter collapsed/ })).toContainText(
        "Issue currency: Swiss Franc [CHF]",
      );
      const riskCategory = page.getByRole("button", { name: /^Risk category filter collapsed/ });
      await expect(riskCategory).toHaveText("Risk category: Interest rate, long-term [J]+1");
      await expect(page.getByRole("button", { name: /^Years filter collapsed/ })).toContainText(
        "Years: 1976, 1975",
      );
      await expect.poll(() => currentResultCount(page)).toBe(yearFilteredCount);
    });

    await test.step("15. Clear Timespan and restore the step-6 result count", async () => {
      await page.getByRole("button", { name: "Clear Years filter", exact: true }).click();
      await expect.poll(() => currentResultCount(page)).toBe(riskFilteredCount);
    });

    await test.step("16. Verify Asian exchanges cannot be selected", async () => {
      await page.getByRole("main").getByRole("button", {
        name: /^Location of trade \(Exchange or country\) filter collapsed/,
      }).click();
      const asianExchanges = page.getByRole("option").filter({ hasText: "Asian exchanges" });
      await expect(asianExchanges).toBeVisible();
      await expect(asianExchanges.getByRole("checkbox")).toBeDisabled();
    });

    await test.step("17. Close Location of trade", async () => {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("option").filter({ hasText: "Asian exchanges" })).toBeHidden();
    });

    await test.step("18. Reset all filters and restore the full result count", async () => {
      await page.getByRole("main").getByRole("button", { name: "Reset", exact: true }).click();
      await expect(page).toHaveURL((url) => !url.searchParams.has("filter"));
      await expect.poll(() => currentResultCount(page)).toBe(fullCount);
      await expect(page.getByRole("button", { name: /^Clear .* filter$/ })).toHaveCount(0);
    });
  });
});
