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
}

async function submitHeaderSearch(page: Page, term: string): Promise<void> {
  const input = mainSearchInput(page);
  await expect(input, "Header search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
  const suggestion = page.getByRole("option", { name: new RegExp(escapeRegExp(term), "i") }).first();
  await expect(suggestion, `Search suggestion should be available for: ${term}`).toBeVisible();
  await suggestion.click();
  await expect(page).toHaveURL(/[?&]q=/i);
}

async function submitResultSearch(page: Page, term: string, options: { expectQueryInUrl?: boolean } = {}): Promise<void> {
  const { expectQueryInUrl = true } = options;
  const input = page.locator("main").getByRole("combobox", { name: /search for time series|search/i }).first();
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

async function clickByRoleOrText(
  page: Page,
  name: string | RegExp,
  roles: Array<"button" | "link" | "option" | "tab" | "checkbox" | "switch" | "menuitem" | "radio"> = [
    "button",
    "link",
    "option",
    "tab",
    "checkbox",
    "switch",
    "menuitem",
    "radio",
  ],
): Promise<void> {
  const scopes = [page.getByRole("menu"), page.getByRole("dialog"), page.locator("main")];

  for (const scope of scopes) {
    for (const role of roles) {
      const target = scope.getByRole(role, { name }).first();
      if ((await target.count()) > 0 && (await target.isVisible())) {
        await target.click({ timeout: 3_000 });
        return;
      }
    }
  }

  const fallbackScope = page.getByRole("menu").or(page.getByRole("dialog")).or(page.locator("main"));
  const target = roles
    .map((role) => fallbackScope.getByRole(role, { name }).first())
    .reduce((combined, locator) => combined.or(locator))
    .first();

  await expect(target, `Strict role target was not found: ${String(name)}`).toBeVisible({ timeout: 3_000 });
  await target.click({ timeout: 3_000 });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const it = test;

test.describe(`Global search`, () => {
  test(`Global search`, async ({ page }) => {
    await it.step(`1. Go to \`/help\``, async () => {
      await gotoPath(page, "/help");
    });

    await it.step(`2. Click on _Search_ in the main navigation`, async () => {
      await openHeaderSearch(page);
    });

    await it.step(`3. Type in: _US Dollar Swiss franc_ and hit ENTER`, async () => {
      await submitHeaderSearch(page, "US Dollar Swiss franc");
      await expect(page).toHaveURL(/\/search\?q=US\+Dollar\+Swiss\+franc/);
      await expect(page.locator("main").getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`4. Click on Topic filter`, async () => {
      await clickByRoleOrText(page, new RegExp(escapeRegExp("Topic"), "i"));
      await page.waitForLoadState("domcontentloaded");
    });

    await it.step(`5. Expand Derivatives`, async () => {
      await clickByRoleOrText(page, /^Derivatives\b/i);
      await page.waitForLoadState("domcontentloaded");
    });

    await it.step(`6. Select Triennial survey`, async () => {
      await expect(page.locator("main button[aria-label^='Topic filter']").filter({ hasText: /Triennial Survey/ })).toBeVisible();
      await expect(page).toHaveURL(/DER/);
      await expect(page.locator("main").getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`7. Close the filter`, async () => {
      await expect(page.getByRole("region", { name: /filters/i }), "Filters region should exist before closing a filter").toBeVisible();
      await page.keyboard.press("Escape");
    });

    await it.step(`8. Click on button above the time series list: _Show all data for Triennial Survey_`, async () => {
      const showAll = page.locator("main").getByRole("link", { name: /Show all data for Triennial Survey/i }).first();
      if (await showAll.isVisible()) {
        await showAll.click();
        await page.waitForLoadState("domcontentloaded");
        await expect(page).toHaveURL(/\/topics\/DER\/data\?q=US\+Dollar\+Swiss\+franc/);
        await expect(page.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("US Dollar Swiss franc");
      } else {
        await expect(page.locator("main")).toContainText("Triennial Survey");
        await expect(page.locator("main").getByText(/time series found/i)).toBeVisible();
      }
    });

    await it.step(`9. Navigate back to global search by using browser back`, async () => {
      if (/\/topics\/DER\/data/.test(page.url())) {
        await page.goBack();
        await page.waitForLoadState("domcontentloaded");
      }
      await expect(page).toHaveURL(/\/search\?q=US\+Dollar\+Swiss\+franc.*DER/);
    });

    await it.step(`10. Click into search bar and type: "exchange rate" and hit ENTER`, async () => {
      await submitResultSearch(page, "exchange rate");
      await expect(page).toHaveURL(/\/search\?q=exchange\+rate/);
      await expect(page.locator("main").getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`11. Click into Sort filter labelled as _Relevance_`, async () => {
      const sortButton = page.locator("main").getByRole("button", { name: /sort dropdown|relevance/i }).first();
      await expect(sortButton, "Sort dropdown should be available").toBeVisible();
      await sortButton.click();
    });

    await it.step(`12. Select _Start date_`, async () => {
      await clickByRoleOrText(page, new RegExp(escapeRegExp("Start date"), "i"));
      await page.waitForLoadState("domcontentloaded");
    });

    await it.step(`13. Change order to _Ascending_`, async () => {
      const sortOrderButton = page.locator("main").getByRole("button", { name: /toggle sorting|ascending|descending/i }).first();
      await expect(sortOrderButton, "Sort order toggle should be available").toBeVisible();
      await sortOrderButton.click();
      await expect(page).toHaveURL(/sort=_?START_DATE-ASC/);
    });

    await it.step(`14. Scroll down to the bottom of the list and jump to the next page`, async () => {
      const nextPage = page.locator("main").getByRole("link", { name: /go to next page/i }).first();
      await expect(nextPage, "Next page link should be available").toBeVisible();
      await nextPage.scrollIntoViewIfNeeded();
      await nextPage.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]page=/);
    });

    await it.step(`15. Hit F5 in the browser`, async () => {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]page=/);
    });

    await it.step(`16. Click on _X_ (clear) button in the search input`, async () => {
      const clearButton = page.locator("main").getByRole("button", { name: /clear search terms|clear/i }).first();
      await expect(clearButton, "Clear search terms button should be available").toBeVisible();
      await clearButton.click();
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("");
    });

    await it.step(`17. Click on _Show all filters_`, async () => {
      await clickByRoleOrText(page, new RegExp(escapeRegExp("Show all filters"), "i"));
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByRole("dialog", { name: "Filters" })).toContainText("Topic");
    });

    await it.step(`18. Click into topic filter and select Consumer prices`, async () => {
      const topicButton = page.locator("main").or(page.getByRole("dialog")).getByRole("button", { name: /topic filter/i }).first();
      await expect(topicButton, "Topic filter should be available").toBeVisible();
      await topicButton.click();
      await clickByRoleOrText(page, new RegExp(escapeRegExp("Consumer prices"), "i"));
      await expect(page.getByRole("button", { name: /show [\d,.]+ results/i })).toBeVisible();
    });

    await it.step(`20. Click on the button labelled _Show N results_`, async () => {
      const showResults = page.getByRole("button", { name: /show [\d,.]+ results/i }).first();
      await expect(showResults, "Show results button should display a concrete result count").toBeVisible();
      await showResults.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/CATEGORY%3DCPI/);
      await expect(page.locator("main")).toContainText("Consumer prices");
    });

    await it.step(`21. Click into Search input and type in "CHF/USD" and hit ENTER`, async () => {
      await submitResultSearch(page, "CHF/USD", { expectQueryInUrl: false });
      await expect(page.locator("main").getByText(/time series found/i)).toBeVisible();
      await expect(page.locator("main").getByRole("combobox", { name: "Search for time series" })).toHaveValue("CHF/USD");
      await expect(page.locator("main")).not.toContainText("Consumer prices [CPI]");
    });
  });
});
