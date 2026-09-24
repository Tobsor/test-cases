import { expect, test, type Locator, type Page } from "@playwright/test";

const DATA_PATH = "/topics/RPP/data";
const SEARCH_TERM = "Zurich OR Berlin";

function main(page: Page): Locator {
  return page.getByRole("main");
}

function resultCount(page: Page): Locator {
  return main(page).getByText(/^[\d,.]+ time series found$/).first();
}

async function ensureFiltersOpen(page: Page): Promise<void> {
  const compilingAgency = main(page).getByRole("button", { name: /^Compiling agency filter collapsed/ });
  if (!(await compilingAgency.isVisible())) {
    await main(page).getByRole("button", { name: "Filters", exact: true }).click();
  }
  await expect(compilingAgency).toBeVisible();
}

async function copyShareUrl(page: Page): Promise<string> {
  await main(page).getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toContainText("Use this URL to share this view");
  const urlInput = dialog.getByRole("textbox", { name: "URL" });
  const sharedUrl = await urlInput.inputValue();
  await dialog.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect(page.getByText(/copied/i).last()).toBeVisible();
  return sharedUrl;
}

async function expectSharedState(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "Residential property prices" })).toBeVisible();
  await expect(main(page).getByRole("combobox", { name: "Search for time series" })).toHaveValue(SEARCH_TERM);
  await expect(resultCount(page)).toHaveText("3 time series found");
  await ensureFiltersOpen(page);
  await expect(main(page).getByRole("button", { name: /^Compiling agency filter collapsed/ })).toContainText(
    "Compiling agency: Private sector [2]",
  );
  await expect(main(page).getByRole("button", { name: /^Timespan filter collapsed/ })).toContainText(
    "Timespan: Last 8 observation(s)",
  );
  await expect(main(page).getByRole("button", { name: /^Sort dropdown collapsed/ })).toContainText("Country");
  await expect(main(page).getByRole("button", { name: "Toggle sorting", exact: true })).toHaveAttribute(
    "title",
    "Descending",
  );
  await expect(main(page).getByRole("article").first()).toContainText("Switzerland");
}

test.describe("Topic Data Share", () => {
  test("shares filtered, sorted, and selected topic-data state", async ({ page, context }) => {
    let firstSharedPage!: Page;

    await test.step("1. Go to /topics/RPP/data", async () => {
      await page.goto(DATA_PATH);
      await expect(page.getByRole("heading", { level: 1, name: "Residential property prices" })).toBeVisible();
    });

    await test.step("2. Search for Zurich OR Berlin and verify results", async () => {
      const input = main(page).getByRole("combobox", { name: "Search for time series" });
      await input.fill(SEARCH_TERM);
      await input.press("Enter");
      await expect(page).toHaveURL((url) => url.pathname === DATA_PATH && url.searchParams.get("q") === SEARCH_TERM);
      await expect(resultCount(page)).toBeVisible();
      expect(Number((await resultCount(page).innerText()).replace(/[^0-9]/g, ""))).toBeGreaterThan(0);
    });

    await test.step("3. Open the Compiling agency filter", async () => {
      await main(page).getByRole("button", { name: "Filters", exact: true }).click();
      await main(page).getByRole("button", { name: /^Compiling agency filter collapsed/ }).click();
      await expect(page.getByRole("option").filter({ hasText: "Private sector" })).toBeVisible();
    });

    await test.step("4. Select Private sector", async () => {
      await page.getByRole("option").filter({ hasText: "Private sector" }).click();
      await page.keyboard.press("Escape");
      await expect(resultCount(page)).toHaveText("3 time series found");
      await expect(main(page).getByRole("button", { name: /^Compiling agency filter collapsed/ })).toContainText(
        "Compiling agency: Private sector [2]",
      );
    });

    await test.step("5. Open the Timespan filter", async () => {
      await main(page).getByRole("button", { name: /^Timespan filter collapsed/ }).click();
      await expect(page.getByRole("tab", { name: "Range", exact: true })).toBeVisible();
    });

    await test.step("6. Select Last ...", async () => {
      await page.getByRole("tab", { name: "Last ...", exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: "Last ..." })).toBeVisible();
    });

    await test.step("7. Select Observations", async () => {
      const observations = page.getByRole("radio", { name: "Observations", exact: true });
      await observations.click();
      await expect(observations).toHaveAttribute("aria-checked", "true");
    });

    await test.step("8. Select 8 observations", async () => {
      const timespanDialog = page.getByRole("dialog").last();
      await timespanDialog.getByRole("button", { name: "8", exact: true }).click();
      await expect(page.getByRole("spinbutton", { name: "Amount of observations:" })).toHaveValue("8");
      await page.keyboard.press("Escape");
      await expect(main(page).getByRole("button", { name: /^Timespan filter collapsed/ })).toContainText(
        "Timespan: Last 8 observation(s)",
      );
    });

    await test.step("9. Open the Relevance sort dropdown", async () => {
      const sortDropdown = main(page).getByRole("button", { name: /^Sort dropdown collapsed/ });
      await expect(sortDropdown).toContainText("Relevance");
      await sortDropdown.click();
    });

    await test.step("10. Select Country", async () => {
      await page.getByRole("menuitem", { name: "Country", exact: true }).click();
      await expect(main(page).getByRole("button", { name: /^Sort dropdown collapsed/ })).toContainText("Country");
    });

    await test.step("11. Select descending order and verify Switzerland is first", async () => {
      const toggleSorting = main(page).getByRole("button", { name: "Toggle sorting", exact: true });
      if ((await toggleSorting.getAttribute("title")) !== "Descending") {
        await toggleSorting.click();
      }
      await expect(toggleSorting).toHaveAttribute("title", "Descending");
      await expect(main(page).getByRole("article").first()).toContainText("Switzerland");
    });

    await test.step("12. Open Share", async () => {
      await main(page).getByRole("button", { name: "Share", exact: true }).click();
      await expect(page.getByRole("dialog").last()).toContainText("Use this URL to share this view");
    });

    let firstSharedUrl = "";
    await test.step("13. Copy the share URL and verify the confirmation message", async () => {
      const dialog = page.getByRole("dialog").last();
      firstSharedUrl = await dialog.getByRole("textbox", { name: "URL" }).inputValue();
      await dialog.getByRole("button", { name: "Copy to clipboard" }).click();
      await expect(page.getByText(/copied/i).last()).toBeVisible();
    });

    await test.step("14. Open the copied URL in a new tab and verify the exact state", async () => {
      firstSharedPage = await context.newPage();
      await firstSharedPage.goto(firstSharedUrl);
      await expectSharedState(firstSharedPage);
    });

    await test.step("15. Select the last item and verify the toolbar says 1 selected", async () => {
      const lastCard = firstSharedPage.getByRole("main").getByRole("article").last();
      await lastCard.getByRole("checkbox", { name: "Select time series" }).check();
      await expect(firstSharedPage.getByRole("main")).toContainText("1 selected");
    });

    await test.step("16. Share the later state and verify the selected item is recreated", async () => {
      const secondSharedUrl = await copyShareUrl(firstSharedPage);
      const secondSharedPage = await context.newPage();
      await secondSharedPage.goto(secondSharedUrl);
      await expectSharedState(secondSharedPage);
      const lastCard = secondSharedPage.getByRole("main").getByRole("article").last();
      await expect(lastCard.getByRole("checkbox", { name: "Select time series" })).toBeChecked();
      await expect(secondSharedPage.getByRole("main")).toContainText("1 selected");
      await secondSharedPage.close();
      await firstSharedPage.close();
    });
  });
});
