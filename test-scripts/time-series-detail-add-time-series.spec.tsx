import { expect, test, type Locator } from "@playwright/test";

const SERIES_KEY = "Q.S.C.A.TO1.A.5J.A.5A.A.5J.A";
const DETAIL_PATH = `/topics/LBS/BIS,WS_LBS_D_PUB,1.0/${SERIES_KEY}`;

function field(card: Locator, name: string): Locator {
  // Definitions have no accessible names linking them to their terms.
  return card.getByRole("term").filter({ hasText: new RegExp(`^${name}$`) }).locator("xpath=following-sibling::dd[1]");
}

function cardTitle(card: Locator): Locator {
  // Card titles are plain text in a header, with no heading or other named role.
  return card.locator("header");
}

function resultCount(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

test.describe("Time Series Detail Add time series", () => {
  test("searches, filters, adds, and removes a comparison time series", async ({ page, baseURL }) => {
    // The accessible name changes to Filters when the filter pane is open.
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Close modal", exact: true }) });
    const input = dialog.getByRole("combobox", { name: "Search for time series" });
    const cards = dialog.getByRole("article");
    const found = dialog.getByText(/^[\d.,\s]+ time series found$/);
    const seriesList = page.getByRole("region", { name: "Time series list", exact: true });
    const rows = seriesList.getByRole("button").filter({ has: page.getByRole("button", { name: /^Toggle visibility of/ }) });
    // Plotly traces have no accessible roles; count rendered series, not SVG line segments.
    const chartSeries = page.getByRole("region", { name: "Chart", exact: true })
      .locator(".js-plotly-plot .scatterlayer .trace").filter({ has: page.locator(".js-line") });
    let totalResults = 0;
    let filteredResults = 0;
    let selectedKey = "";

    await test.step("1. Navigate to the LBS time series detail page", async () => {
      await page.goto(DETAIL_PATH);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("All reporting countries");
    });

    await test.step("2. Open Add time series and verify the modal, cards, previews, and pagination", async () => {
      await page.getByRole("button", { name: "Add time series", exact: true }).click();
      await expect(dialog.getByRole("banner")).toBeVisible();
      await expect(input).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
      await expect(found).toBeVisible();
      totalResults = resultCount(await found.innerText());
      expect(totalResults).toBeGreaterThan(20);
      await expect(dialog.getByText("1 selected", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Sort dropdown/ })).toHaveText("Relevance");
      await expect(dialog.getByRole("button", { name: "Toggle sorting" })).toHaveAttribute("title", "Descending");
      await expect(cards).toHaveCount(20);
      for (const card of await cards.all()) {
        // Chart thumbnails are loaded when their cards enter the scroll viewport.
        await card.scrollIntoViewIfNeeded();
        await expect(card.getByRole("button", { name: /Popover .*click to/ }).getByRole("img").first()).toBeAttached();
        await expect(cardTitle(card)).not.toHaveText("");
        await expect(field(card, "Series key")).not.toHaveText("");
        await expect(field(card, "Unit")).toHaveText(/.+\(.+\)/);
        // The end-value field exists, but the markdown explicitly allows a missing value.
        await expect(field(card, "End value")).toBeAttached();
        await expect(field(card, "Time span")).toHaveText(/\d{4}.* - \d{4}/);
        await expect(field(card, "Frequency")).not.toHaveText("");
        await expect(card.getByRole("checkbox")).toBeAttached();
        await expect(card.getByRole("button", { name: "Show metadata" })).toBeVisible();
      }

      const card = cards.first();
      await card.scrollIntoViewIfNeeded();
      await input.hover();
      const background = await card.evaluate((element) => getComputedStyle(element).backgroundColor);
      await cardTitle(card).hover();
      await expect.poll(() => card.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(background);
      // Rounded corners are applied on hover on the current site.
      await expect.poll(() => card.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius)))
        .toBeGreaterThan(0);

      const preview = page.getByRole("dialog").filter({ hasNot: page.getByRole("button", { name: "Close modal", exact: true }) });
      const previewKey = await field(card, "Series key").innerText();
      const previewTitle = await cardTitle(card).innerText();
      await card.getByRole("button", { name: /Popover .*click to/ }).hover();
      await expect(preview).toBeVisible();
      await expect(preview).toContainText(previewKey);
      await expect(preview).toContainText(previewTitle);
      await expect(preview.getByRole("img").first()).toBeVisible();
      await preview.hover();
      await page.mouse.move(0, 0);
      await expect(preview).toBeHidden();
      await card.getByRole("button", { name: /Popover .*click to/ }).hover();
      await expect(preview).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(preview).toBeHidden();

      await expect(dialog.getByText(/^1-20 of [\d.,\s]+$/)).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Go to first page" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
      // The enabled next-page control is a link; the last-page control is labelled Too many pages.
      await expect(dialog.getByRole("link", { name: "Go to next page" })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "Too many pages" })).toBeDisabled();
      await expect(dialog.getByText("20 / page", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("combobox", { name: "", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Update selection" })).toBeVisible();
    });

    await test.step("3. Search for the original series and verify it cannot be unselected", async () => {
      await input.fill(SERIES_KEY);
      await input.press("Enter");
      await expect(found).toHaveText("1 time series found");
      await expect(cards).toHaveCount(1);
      await expect(field(cards.first(), "Series key")).toHaveText(SERIES_KEY);
      await expect(cards.getByRole("checkbox")).toBeChecked();
      await expect(cards.getByRole("checkbox")).toBeDisabled();
      await cardTitle(cards.first()).click();
      await expect(cards.getByRole("checkbox")).toBeChecked();
      await expect(dialog.getByText("1 selected", { exact: true })).toBeVisible();
    });

    await test.step("4. Clear the search with X and restore all results", async () => {
      await dialog.getByRole("button", { name: "Clear search terms" }).click();
      await expect(input).toHaveValue("");
      await expect.poll(async () => resultCount(await found.innerText())).toBe(totalResults);
      await expect(cards).toHaveCount(20);
    });

    await test.step("5. Open Filters and verify the filter pane", async () => {
      await dialog.getByRole("button", { name: "Filters", exact: true }).click();
      await expect(dialog.getByRole("banner")).toHaveText("Filters");
      await expect(dialog.getByRole("button", { name: "Back", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /^Topic filter collapsed/ })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /^Frequency filter collapsed/ })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /^Show .* results$/ })).toBeVisible();
    });

    await test.step("6. Filter Topic to International banking / Locational banking statistics", async () => {
      await dialog.getByRole("button", { name: /^Topic filter collapsed/ }).click();
      const branch = page.getByRole("treeitem").filter({
        has: page.getByText("International banking", { exact: true }),
      });
      await branch.focus();
      await branch.press("ArrowRight");
      await expect(branch).toHaveAttribute("aria-expanded", "true");
      const lbsOption = page.getByRole("treeitem").filter({
        has: page.getByRole("checkbox", { name: "Locational banking statistics [LBS]", exact: true }),
        hasNot: page.getByRole("checkbox", { name: "International banking", exact: true }),
      });
      const optionCount = lbsOption.getByText(/^[\d.,\s]+$/);
      await expect(optionCount).toBeVisible();
      const expectedLbsResults = resultCount(await optionCount.innerText());
      expect(expectedLbsResults).toBeGreaterThan(0);
      await page.getByText("Locational banking statistics [LBS]", { exact: true }).click();
      await expect(page.getByRole("checkbox", { name: "Locational banking statistics [LBS]", exact: true }))
        .toBeChecked();
      await dialog.getByRole("button", { name: /^Topic filter expanded/ }).click();
      await expect(dialog.getByRole("banner").getByText("1", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /^Topic filter collapsed/ }))
        .toContainText("Topic: Locational banking statistics");
      await expect(dialog.getByRole("button", { name: "Clear Topic filter", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
      const showResults = dialog.getByRole("button", { name: /^Show .* results$/ });
      await expect.poll(async () => resultCount(await showResults.innerText())).toBe(expectedLbsResults);
      filteredResults = resultCount(await showResults.innerText());
      expect(filteredResults).toBeLessThan(totalResults);
    });

    await test.step("7. Click Back and verify the filtered result count", async () => {
      await dialog.getByRole("button", { name: "Back", exact: true }).click();
      await expect.poll(async () => resultCount(await found.innerText())).toBe(filteredResults);
    });

    await test.step("8. Search for Germany and press Enter", async () => {
      await input.fill("Germany");
      await input.press("Enter");
      await expect(input).toHaveValue("Germany");
      await expect(cardTitle(cards.first())).toContainText("Germany");
    });

    await test.step("9. Click the first checkable series title and verify selection counts", async () => {
      const card = cards.filter({ has: page.getByRole("checkbox", { disabled: false }) }).first();
      selectedKey = (await field(card, "Series key").innerText()).trim();
      await cardTitle(card).click();
      await expect(card.getByRole("checkbox")).toBeChecked();
      await expect(dialog.getByText("2 selected", { exact: true })).toBeVisible();
      await expect(dialog.getByText("2 / 8 time series selected", { exact: true })).toBeVisible();
    });

    await test.step("10. Update selection and verify the URL, two chart lines, and two series rows", async () => {
      await dialog.getByRole("button", { name: "Update selection" }).click();
      await expect(dialog).not.toBeAttached();
      await expect(page).toHaveURL((url) =>
        url.origin + url.pathname === new URL(DETAIL_PATH, baseURL).href &&
        url.searchParams.size === 1 &&
        url.searchParams.get("additional_ts")?.split("^")[1] === selectedKey,
      );
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText(SERIES_KEY);
      await expect(rows.nth(1)).toContainText(selectedKey);
      await expect(chartSeries).toHaveCount(2);
    });

    await test.step("11. Remove the second series and restore the original URL, chart, and table", async () => {
      await rows.nth(1).getByRole("button", { name: "Remove row" }).click();
      await expect(page).toHaveURL((url) =>
        url.origin + url.pathname === new URL(DETAIL_PATH, baseURL).href && url.search === "",
      );
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(SERIES_KEY);
      await expect(chartSeries).toHaveCount(1);
    });
  });
});
