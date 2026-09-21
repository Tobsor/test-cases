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
  await input.press("Enter");
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL(/[?&]q=/i);
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
  const scope = page.locator("main").or(page.getByRole("menu")).or(page.getByRole("dialog"));
  const target = roles
    .map((role) => scope.getByRole(role, { name }).first())
    .reduce((combined, locator) => combined.or(locator))
    .first();

  await expect(target, `Strict role target was not found: ${String(name)}`).toBeVisible({ timeout: 3_000 });
  await target.click({ timeout: 3_000 });
}

async function fillMainSearch(page: Page, term: string): Promise<void> {
  const input = mainSearchInput(page);
  await expect(input, "Main search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
}

async function ensureAiSearchEnabled(page: Page): Promise<void> {
  const toggle = page.getByRole("switch", { name: "Toggle AI-Search feature" });
  await expect(toggle, "AI toggle should be available").toBeVisible();

  if (await toggle.isChecked()) {
    return;
  }

  await toggle.click();
  await page.getByRole("button", { name: /^Agree$/i }).click();
  await expect(toggle, "AI toggle should be enabled").toBeChecked();
}

async function waitForAiSuggestions(page: Page): Promise<void> {
  const panel = page.locator("main").getByText(/AI-assisted time series suggestions/i).first();
  await expect(panel, "AI-assisted suggestions panel should be visible").toBeVisible();
  const loading = page.locator("main").getByText(/Preparing suggestions|Loading/i).first();
  await expect(loading, "AI suggestions should finish loading before reasoning is shown").toBeHidden({ timeout: 30_000 });
  const reasoningButton = page.locator("main").getByRole("button", { name: /show reasoning/i }).first();
  await expect(reasoningButton, "Show reasoning should be enabled after AI suggestions load").toBeEnabled({ timeout: 30_000 });
}

function aiSuggestionLinks(page: Page): Locator {
  return page.locator("main").getByRole("link").filter({ hasText: /Consumer prices statistics/i });
}

function showReasoningButton(page: Page): Locator {
  return page.locator("main").getByRole("button", { name: /show reasoning/i }).first();
}

function showReasoningHelpIcon(page: Page): Locator {
  // TODO: Improve this icon's accessibility in the website source code.
  return showReasoningButton(page)
    .locator('xpath=following-sibling::i[contains(concat(" ", normalize-space(@class), " "), " icon ")]')
    .first();
}

async function expectShowReasoningHelpIcon(page: Page): Promise<Locator> {
  const reasoningButton = showReasoningButton(page);
  await expect(reasoningButton, "Show reasoning button should be visible").toBeVisible();

  const icon = showReasoningHelpIcon(page);
  await expect(icon, "Show reasoning should have a question mark icon next to it").toBeVisible();
  await expect(icon, "Show reasoning help icon should be a question mark icon").toHaveClass(/\bfa-circle-question\b/);
  return icon;
}

async function expectShowReasoningTooltip(page: Page): Promise<void> {
  // TODO: Improve this icon's accessibility in the website source code.
  const icon = await expectShowReasoningHelpIcon(page);
  await icon.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: /AI's decision-making process|reasoning/i }).first(),
    "Hovering the Show reasoning help icon should explain the AI reasoning",
  ).toBeVisible();
}

async function expectReasoningTabsVisible(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Show reasoning" });
  await expect(dialog, "Show reasoning modal should be open").toHaveAttribute("data-state", "open");

  const expectedTabs = ["Topic reasoning", "Region reasoning", "Dimension reasoning"];
  await expect(dialog.getByRole("tab"), "Show reasoning modal should have exactly three tabs").toHaveCount(
    expectedTabs.length,
  );

  for (const tabName of expectedTabs) {
    await expect(dialog.getByRole("tab", { name: tabName }), `${tabName} should be available`).toBeVisible();
  }
}

async function expectAiSearchResultsForSwitzerland(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /Results for What is the inflation rate of Switzerland/i })).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Toggle AI-Search feature" });
  await expect(toggle, "AI toggle should be enabled on search results").toBeChecked();
  await waitForAiSuggestions(page);
  await expect(page.locator("main").getByText(/AI-assisted time series suggestions/i)).toBeVisible();
  await expectShowReasoningHelpIcon(page);
  await expect(aiSuggestionLinks(page).filter({ hasText: /Switzerland/i }).first()).toBeVisible();
  await expect(page.locator("main").getByText(/0 time series found/i)).toBeVisible();
}

async function expectReasoningTabsHaveText(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Show reasoning" });
  const expectedTabs = ["Topic reasoning", "Region reasoning", "Dimension reasoning"];

  for (const tabName of expectedTabs) {
    const tab = dialog.getByRole("tab", { name: tabName });
    await expect(tab, `${tabName} should be available`).toBeVisible();
    await tab.click();
    await expect(tab, `${tabName} should become selected`).toHaveAttribute("aria-selected", "true");
    const panel = dialog.getByRole("tabpanel", { name: tabName });
    await expect
      .poll(async () => (await panel.innerText()).replace(/\s+/g, " ").trim(), {
        message: `${tabName} should feature non-empty reasoning text`,
      })
      .not.toBe("");
  }
}

async function clickAllReasoningTabs(page: Page): Promise<void> {
  const tabs = page.locator("main").or(page.getByRole("dialog")).getByRole("tab");
  await expect(tabs.first(), "Reasoning tabs should be visible").toBeVisible();
  const tabCount = await tabs.count();
  expect(tabCount, "Reasoning should expose multiple tabs").toBeGreaterThan(1);

  for (let index = 0; index < tabCount; index += 1) {
    await tabs.nth(index).click();
    await expect(tabs.nth(index), "Clicked reasoning tab should become selected").toHaveAttribute("aria-selected", "true");
  }
}

const it = test;

test.describe(`AI Search Standard Search`, () => {
  test(`AI Search Standard Search`, async ({ page }) => {
    await it.step(`1. Go to \`/\``, async () => {
      await gotoPath(page, "/");
      await ensureAiSearchEnabled(page);
    });

    await it.step(`2. Insert the following text into the search field "What is the inflation rate of Switzerland?"`, async () => {
      await fillMainSearch(page, "What is the inflation rate of Switzerland?");
      await expect(page.getByText(/Include AI-assisted results/i)).toBeVisible();
      await expect(page.getByRole("switch", { name: "Toggle AI-Search feature" })).toBeChecked();
    });

    await it.step(`3. Make sure that the Toggle with the label "Include AI-assisted results" is enabled`, async () => {
      await ensureAiSearchEnabled(page);
      await expect(page.getByText(/Includes AI-refined results/i)).toBeVisible();
    });

    await it.step(`3. Press Enter`, async () => {
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]q=/i);
      await expectAiSearchResultsForSwitzerland(page);
    });

    await it.step(`4. Highlighting the question mark items`, async () => {
      await expect(page.locator("main").getByText(/AI-assisted time series suggestions/i)).toBeVisible();
      await expectShowReasoningTooltip(page);
    });

    await it.step(`5. Click on the button "Show reasoning"`, async () => {
      await clickByRoleOrText(page, /show reasoning/i, ["button"]);
      await expectReasoningTabsVisible(page);
    });

    await it.step(`6. Click on each tab`, async () => {
      await expectReasoningTabsHaveText(page);
    });

    await it.step(`7. Close the modal`, async () => {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Show reasoning" })).toBeHidden();
    });

    await it.step(`8. Click on the first link`, async () => {
      const firstContentLink = page.locator("main").getByRole("link").first();
      await expect(firstContentLink, "First content link should be available").toBeVisible();
      await firstContentLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/CPI\/data\?/);
      await expect(page.getByText(/Data set:\s*Consumer prices statistics/i)).toBeVisible();
      await expect(page.getByText(/Reference area:\s*Switzerland/i)).toBeVisible();
    });

    await it.step(`9. Open the search by clicking the search button in the header`, async () => {
      await openHeaderSearch(page);
      await expect(page.getByText(/Include AI-assisted results/i)).toBeVisible();
      await expect(page.getByRole("switch", { name: "Toggle AI-Search feature" })).toBeChecked();
    });

    await it.step(`10. Enter the term "What is the inflation rate of Switzerland?" and press enter`, async () => {
      await submitHeaderSearch(page, "What is the inflation rate of Switzerland?");
      await expectAiSearchResultsForSwitzerland(page);
    });

    await it.step(`11. Return to \`/\``, async () => {
      await gotoPath(page, "/");
    });

    await it.step(`12. Enter the term "What is the inflation rate of Switzerland?" and press enter`, async () => {
      await fillMainSearch(page, "What is the inflation rate of Switzerland?");
      await expect(page.getByRole("switch", { name: "Toggle AI-Search feature" })).toBeChecked();
      await expect(page.getByText(/Includes AI-refined results/i)).toBeVisible();
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/[?&]q=/i);
    });

    await it.step(`14. Disable the AI-Search Toggle- The right hand side label "Includes AI-refined results" should disappear`, async () => {
      const toggle = page.getByRole("switch", { name: "Toggle AI-Search feature" });
      await expect(toggle, "AI toggle should be enabled before disabling it").toBeChecked();
      await toggle.click();
      await expect(toggle, "AI toggle should be disabled after clicking it").not.toBeChecked();
      await expect(page.getByText(/Includes AI-refined results/i)).toBeHidden();
    });

    await it.step(`15. Enter the term "What is the inflation rate of Switzerland?" and press enter- The user again should be redirected to \`/search\``, async () => {
      await fillMainSearch(page, "What is the inflation rate of Switzerland?");
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/search/i);
      await expect(page.getByRole("switch", { name: "Toggle AI-Search feature" })).not.toBeChecked();
      await expect(page.locator("main").getByText(/AI-assisted time series suggestions/i)).toBeHidden();
      await expect(page.locator("main").getByRole("button", { name: /show reasoning/i })).toBeHidden();
    });
  });
});
