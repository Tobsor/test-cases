import { expect, test, type Locator, type Page } from "@playwright/test";

// Local test helpers. Kept inline so this spec has no project-local runtime imports.
const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, pathOrUrl: string): Promise<void> {
  const url = normalizeUrl(pathOrUrl);
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

function normalizeUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${BASE_URL}${url.pathname}${url.search}${url.hash}`;
  }

  if (!pathOrUrl.startsWith("/")) {
    return `${BASE_URL}/${pathOrUrl}`;
  }

  return `${BASE_URL}${pathOrUrl}`;
}

function mainSearchInput(page: Page): Locator {
  return page
    .getByRole("combobox", { name: /search for time series|search/i })
    .first();
}

async function openHeaderSearch(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: /^search$/i }).first();
  await expect(button, "Header search button should be available").toBeVisible();
  await button.click();
  await expect(mainSearchInput(page), "Main search input should open").toBeVisible();
  await expect(mainSearchInput(page)).toBeFocused();
}

async function submitHeaderSearch(page: Page, term: string): Promise<void> {
  const input = mainSearchInput(page);
  await expect(input, "Header search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
  await input.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === "/search" && url.searchParams.get("q") === term);
  await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue(term);
}

async function submitResultSearch(page: Page, term: string, options: { expectQueryInUrl?: boolean } = {}): Promise<void> {
  const { expectQueryInUrl = true } = options;
  const input = page.getByRole("main").getByRole("combobox", { name: /search for time series|search/i }).first();
  await expect(input, "Result search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
  await input.press("Enter");
  if (expectQueryInUrl) {
    await expect(page).toHaveURL(/[?&]q=/i);
  }
  await expect(input).toHaveValue(term);
}

async function startDates(page: Page): Promise<number[]> {
  const cards = page.getByRole("main").getByRole("article");
  await expect(cards.first()).toBeVisible();
  const spans = cards.locator("dt", { hasText: /^Time span$/ }).locator("+ dd");
  await expect(spans).toHaveCount(20);
  await expect(spans.first()).toContainText(/\d{4}/);
  return (await spans.allTextContents()).map((span) => {
    const start = span.trim().split(/\s+-\s+/)[0];
    const quarter = start.match(/^(\d{4})-Q([1-4])$/);
    const timestamp = quarter
      ? Date.UTC(Number(quarter[1]), (Number(quarter[2]) - 1) * 3, 1)
      : Date.parse(start);
    expect(Number.isFinite(timestamp), `Valid start date: ${start}`).toBe(true);
    return timestamp;
  });
}

function resultCount(text: string): number {
  const count = text.match(/[\d][\d,.\s]*/)?.[0];
  expect(count, `Result count in: ${text}`).toBeTruthy();
  return Number(count!.replace(/\D/g, ""));
}

const it = test;

test.describe(`Global search`, () => {
  test(`Global search`, async ({ page }) => {
    let firstPageDates: number[];
    let secondPageUrl: string;
    let consumerPricesCount: number;
    await it.step(`1. Go to \`/help\``, async () => {
      await gotoPath(page, "/help");
    });

    await it.step(`2. Click on _Search_ in the main navigation`, async () => {
      await openHeaderSearch(page);
    });

    await it.step(`3. Type in: _US Dollar Swiss franc_ and hit ENTER`, async () => {
      await submitHeaderSearch(page, "US Dollar Swiss franc");
      await expect(page).toHaveURL(/\/search\?q=US\+Dollar\+Swiss\+franc/);
      await expect(page.getByRole("main").getByText(/time series found/i)).toBeVisible();
      await expect(page.getByRole("main").getByRole("article").first()).toBeVisible();
    });

    await it.step(`4. Open Topic filter and expand Derivatives using its chevron`, async () => {
      await page.getByRole("button", { name: /^Topic filter/ }).click();
      const derivatives = page.getByRole("treeitem", { name: "Derivatives", exact: true });
      // The chevron has no accessible role; clicking the button would select the whole branch.
      await derivatives.locator(".tree-item-expand-icon").click();
      await expect(derivatives).toHaveAttribute("aria-expanded", "true");
    });

    await it.step(`5. Select Triennial survey`, async () => {
      await page.getByRole("menu").getByRole("button", { name: "Triennial Survey [DER]", exact: true }).click();
    });

    await it.step(`6. Verify Triennial survey is selected`, async () => {
      await expect(page.getByRole("button", { name: /^Topic filter/ }).filter({ hasText: /Triennial Survey/ })).toBeVisible();
      await expect(page).toHaveURL(/DER/);
      await expect(page.getByRole("main").getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`7. Close the filter`, async () => {
      await expect(page.getByRole("region", { name: /filters/i }), "Filters region should exist before closing a filter").toBeVisible();
      await page.keyboard.press("Escape");
    });

    await it.step(`8. Click on button above the time series list: _Show all data for Triennial Survey_`, async () => {
      const showAll = page.getByRole("main").getByRole("link", { name: /Show all data for Triennial Survey/i }).first();
      await expect(showAll).toBeVisible();
      await showAll.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL((url) => url.pathname === "/topics/DER/data" && url.searchParams.get("q") === "US Dollar Swiss franc");
      await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("US Dollar Swiss franc");
    });

    await it.step(`9. Navigate back to global search by using browser back`, async () => {
      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/search\?q=US\+Dollar\+Swiss\+franc.*DER/);
    });

    await it.step(`10. Click into search bar and type: "exchange rate" and hit ENTER`, async () => {
      await submitResultSearch(page, "exchange rate");
      await expect(page).toHaveURL(/\/search\?q=exchange\+rate/);
      await expect(page.getByRole("main").getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`11. Click into Sort filter labelled as _Relevance_`, async () => {
      const sortButton = page.getByRole("main").getByRole("button", { name: /sort dropdown|relevance/i }).first();
      await expect(sortButton, "Sort dropdown should be available").toBeVisible();
      await sortButton.click();
    });

    await it.step(`12. Select _Start date_`, async () => {
      await page.getByRole("menuitem", { name: "Start date" }).click();
      await page.waitForLoadState("domcontentloaded");
    });

    await it.step(`13. Change order to _Ascending_`, async () => {
      const sortOrderButton = page.getByRole("main").getByRole("button", { name: /toggle sorting|ascending|descending/i }).first();
      await expect(sortOrderButton, "Sort order toggle should be available").toBeVisible();
      await sortOrderButton.click();
      await expect(page).toHaveURL(/sort=_?START_DATE-ASC/);
      await expect.poll(async () => {
        const dates = await startDates(page);
        return dates.length > 0 && dates.every((date, index) => index === 0 || date >= dates[index - 1]);
      }).toBe(true);
      firstPageDates = await startDates(page);
    });

    await it.step(`14. Scroll down to the bottom of the list and jump to the next page`, async () => {
      const nextPage = page.getByRole("main").getByRole("link", { name: /go to next page/i }).first();
      await expect(nextPage, "Next page link should be available").toBeVisible();
      await nextPage.scrollIntoViewIfNeeded();
      await nextPage.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]page=/);
      await expect.poll(async () => {
        const dates = await startDates(page);
        return dates.length > 0
          && dates.every((date, index) => index === 0 || date >= dates[index - 1])
          && dates[0] >= firstPageDates[firstPageDates.length - 1]
          && dates[dates.length - 1] > firstPageDates[0];
      }).toBe(true);
      secondPageUrl = page.url();
    });

    await it.step(`15. Hit F5 in the browser`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(secondPageUrl);
      await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("exchange rate");
      await expect(page.getByRole("button", { name: /Sort dropdown/ })).toContainText("Start date");
      await expect(page.getByRole("main").getByText(/21-40 of/)).toBeVisible();
    });

    await it.step(`16. Click on _X_ (clear) button in the search input`, async () => {
      const clearButton = page.getByRole("main").getByRole("button", { name: /clear search terms|clear/i }).first();
      await expect(clearButton, "Clear search terms button should be available").toBeVisible();
      await clearButton.click();
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("");
      await expect(page.getByRole("button", { name: /Sort dropdown/ })).toContainText("Relevance");
      await expect(page.getByRole("main").getByText(/1-20 of/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Go to first page" })).toBeDisabled();
    });

    await it.step(`17. Click on _Show all filters_`, async () => {
      await page.getByRole("button", { name: "Show all filters" }).click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("dialog", { name: "Filters" })).toContainText("Topic");
    });

    await it.step(`18. Click into topic filter`, async () => {
      const topicButton = page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: /topic filter/i });
      await expect(topicButton, "Topic filter should be available").toBeVisible();
      await topicButton.click();
    });

    await it.step(`19. Select Consumer prices and save its result count`, async () => {
      const consumerPrices = page.getByRole("treeitem", { name: /^Consumer prices \[CPI\]/ });
      consumerPricesCount = resultCount(await consumerPrices.innerText());
      await consumerPrices.getByRole("button", { name: "Consumer prices [CPI]", exact: true }).click();
      await expect(page.getByRole("button", { name: /show [\d,.]+ results/i })).toBeVisible();
    });

    await it.step(`20. Click on the button labelled _Show N results_`, async () => {
      const showResults = page.getByRole("button", { name: /show [\d,.]+ results/i }).first();
      await expect(showResults, "Show results button should display a concrete result count").toBeVisible();
      await showResults.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/CATEGORY%3DCPI/);
      await expect(page.getByRole("main")).toContainText("Consumer prices");
      const resultSummary = page.getByRole("region", { name: "Time series list", exact: true }).getByText(/time series found/i);
      await expect.poll(async () => resultCount(await resultSummary.innerText())).toBe(consumerPricesCount);
    });

    await it.step(`21. Click into Search input and type in "CHF/USD" and hit ENTER`, async () => {
      await submitResultSearch(page, "CHF/USD", { expectQueryInUrl: false });
      await expect(page.getByRole("main").getByText(/time series found/i)).toBeVisible();
      await expect(page.getByRole("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("CHF/USD");
      await expect(page.getByRole("main")).not.toContainText("Consumer prices [CPI]");
    });
  });
});
