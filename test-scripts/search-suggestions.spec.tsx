import { expect, test, type Locator, type Page } from "@playwright/test";

const SEARCH_TERMS = [
  { term: "St.", suggestion: /St Helena, Ascension and Tristan da Cunha/i },
  { term: "Q", suggestion: /Qatar/i },
  { term: "Q.A", suggestion: /Q\.AE\s+United Arab Emirates/i },
  { term: "Q.A.", suggestion: /Q\.A\.B\s+Foreign exchange/i },
  { term: "Q.A.B", cursorPosition: 3, suggestion: /^Q\.A\.B\s+Outstanding - notional amounts$/i },
  { term: "Q.*.B", cursorPosition: 3, suggestion: /^Q\.A\.B\s+Outstanding - notional amounts$/i },
  { term: "Q.A+", suggestion: /Q\.A\+N\s+Neither seasonally adjusted nor calendar adjusted data/i },
  { term: "Q.A+.B", cursorPosition: 4, suggestion: /Q\.A\+N\.B\s+Neither seasonally adjusted nor calendar adjusted data/i },
  { term: "Q.A+N.B,A.*", suggestion: /Q\.A\+N\.B,A\.[A-Z]+\s+/i },
];

async function gotoHome(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { level: 1, name: "Global statistics at the heart of international cooperation" }),
  ).toBeVisible();
}

function searchInput(page: Page): Locator {
  return page.getByRole("combobox", { name: "Search for time series" }).first();
}

function suggestions(page: Page): Locator {
  return page.getByRole("listbox").first();
}

async function typeSearchTerm(page: Page, term: string): Promise<void> {
  const input = searchInput(page);
  await input.click();
  await input.fill(term);
  await expect(input).toHaveValue(term);
  await expect(suggestions(page)).toBeVisible();
}

async function typeSearchTermWithCursor(page: Page, term: string, cursorPosition?: number): Promise<void> {
  await typeSearchTerm(page, term);

  if (cursorPosition !== undefined) {
    await searchInput(page).evaluate((input, position) => {
      input.setSelectionRange(position, position);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, cursorPosition);
    await expect(suggestions(page)).toBeVisible();
  }
}

test.describe("Search suggestions", () => {
  test("shows country and series-key suggestions and submits valid searches", async ({ page }) => {
    await test.step("shows Germany country suggestions", async () => {
      await gotoHome(page);
      await typeSearchTerm(page, "Germany");

      await expect(page.getByRole("option", { name: /^Germany$/ })).toBeVisible();
      await expect(
        page.getByRole("option", { name: /Germany\s+International banking \/ Consolidated banking statistics/i }),
      ).toBeVisible();
      await expect(page.getByRole("option").first()).toHaveText("Germany");
      const germanySuggestions = await page
        .getByRole("option")
        .evaluateAll((options) => options.slice(1, 8).map((option) => (option as HTMLElement).innerText.trim()));
      expect(germanySuggestions.length).toBeGreaterThan(1);
      for (const suggestion of germanySuggestions) {
        expect(suggestion).toMatch(/^Germany\s+.+\/.+|^Germany\s+Global liquidity$/);
      }
    });

    await test.step("opens a topic data page from a described Germany suggestion", async () => {
      await page
        .getByRole("option", { name: /Germany\s+International banking \/ Consolidated banking statistics/i })
        .click();

      await expect(page).toHaveURL(
        (url) => url.pathname === "/topics/CBS/data" && url.searchParams.get("q") === "Germany",
      );
      await expect(page.getByRole("heading", { level: 1, name: "Consolidated banking statistics" })).toBeVisible();
    });

    await test.step("opens the search bar again from the header and opens exact search results", async () => {
      await page.getByRole("banner").getByRole("button", { name: "Search" }).click();
      await typeSearchTerm(page, "Germany");
      await page.getByRole("option", { name: /^Germany$/ }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/search" && url.searchParams.get("q") === "Germany");
    });

    await test.step("shows suggestions for dots, wildcards, plus signs, and comma-separated keys", async () => {
      await gotoHome(page);

      for (const { term, suggestion, cursorPosition } of SEARCH_TERMS) {
        await typeSearchTermWithCursor(page, term, cursorPosition);
        await expect(page.getByRole("option", { name: suggestion }).first()).toBeVisible();
      }
    });

    await test.step("submits a complex key search with Enter", async () => {
      const term = "Q.A+N.B,A.*";
      await typeSearchTerm(page, term);
      await searchInput(page).press("Enter");

      await expect(page).toHaveURL((url) => url.pathname === "/search" && url.searchParams.get("q") === term);
    });
  });
});
