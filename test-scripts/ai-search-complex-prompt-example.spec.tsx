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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function submitResultSearch(page: Page, term: string): Promise<void> {
  const input = page.locator("main").getByRole("combobox", { name: /search for time series|search/i }).first();
  await expect(input, "Result search input should be available before typing").toBeVisible();
  await input.click();
  await input.clear();
  await input.pressSequentially(term);
  await input.press("Enter");
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

async function waitForAiSuggestions(page: Page): Promise<void> {
  const panel = page.locator("main").getByText(/AI-assisted time series suggestions/i).first();
  await expect(panel, "AI-assisted suggestions panel should be visible").toBeVisible();
  const loading = page.locator("main").getByText(/Preparing suggestions|Loading/i).first();
  await expect(loading, "AI suggestions should finish loading before reasoning is shown").toBeHidden({ timeout: 30_000 });
  const reasoningButton = page.locator("main").getByRole("button", { name: /show reasoning/i }).first();
  await expect(reasoningButton, "Show reasoning should be enabled after AI suggestions load").toBeEnabled({ timeout: 30_000 });
}

function aiSuggestionLinks(page: Page): Locator {
  return page.locator("main").getByRole("link").filter({ hasText: /in the Reference area/i });
}

async function expectAiSuggestionsForComplexPrompt(page: Page): Promise<string[]> {
  const suggestions = aiSuggestionLinks(page);
  const suggestionCount = await suggestions.count();
  expect(suggestionCount, "AI suggestion area should feature at least two suggestion items").toBeGreaterThanOrEqual(2);

  const labels = await suggestions.evaluateAll((links) =>
    links.map((link) => (link.textContent ?? "").replace(/\s+/g, " ").trim()),
  );

  expect(
    labels.some((label) => /Switzerland/i.test(label)),
    "At least one AI suggestion should relate to Switzerland",
  ).toBeTruthy();
  expect(
    labels.some((label) => /Norway|Norwey/i.test(label)),
    "At least one AI suggestion should relate to Norway/Norwey",
  ).toBeTruthy();

  const topicLabels = labels.map((label) => label.split(/\s+in the\s+/i)[0].trim()).filter(Boolean);
  expect(new Set(topicLabels).size, "Each AI suggestion should expose a different topic in its first label segment").toBe(
    topicLabels.length,
  );

  return topicLabels;
}

async function expectNonEmptyReasoningText(panel: Locator): Promise<void> {
  await expect
    .poll(async () => (await panel.innerText()).replace(/\s+/g, " ").trim(), {
      message: "Reasoning area should have non-empty text",
    })
    .not.toBe("");
}

async function expectReasoningDropdownOptionsHaveText(
  page: Page,
  tabName: "Region reasoning" | "Dimension reasoning",
  minimumOptionCount: number,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Show reasoning" });
  const tab = dialog.getByRole("tab", { name: tabName });
  await tab.click();
  await expect(tab, `${tabName} tab should be selected`).toHaveAttribute("aria-selected", "true");

  const panel = dialog.getByRole("tabpanel", { name: tabName });
  await expectNonEmptyReasoningText(panel);
  await expect(panel.getByText(/Data set:/i), `${tabName} should display a topic/data set label`).toBeVisible();

  const dropdownArrow = panel.locator("[title='Show options']").first();
  await expect(dropdownArrow, `${tabName} should expose a data set dropdown`).toBeVisible();
  await dropdownArrow.click();

  const options = page.getByRole("listbox").getByRole("option");
  await expect(options.first(), `${tabName} dropdown should expose options`).toBeVisible();
  const optionLabels = await options.evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? ""));
  expect(optionLabels.length, `${tabName} dropdown should have at least as many options as AI suggestions`).toBeGreaterThanOrEqual(
    minimumOptionCount,
  );

  for (let index = 0; index < optionLabels.length; index += 1) {
    const optionLabel = optionLabels[index];
    if (index > 0) {
      await panel.locator("[title='Show options']").first().click();
    }
    await page.getByRole("option", { name: optionLabel }).click();
    await expect(panel.getByText(new RegExp(`Data set:\\s*${escapeRegExp(optionLabel)}`, "i"))).toBeVisible();
    await expectNonEmptyReasoningText(panel);
  }
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

const it = test;

test.describe(`AI Search Complex prompt example`, () => {
  test(`AI Search Complex prompt example`, async ({ page }) => {
    await it.step(`1. Go to \`/search\``, async () => {
      await gotoPath(page, "/search");
      await ensureAiSearchEnabled(page);
    });

    await it.step(`2. Enter the following prompt and press Enter: "How are the house prices and inflation rate in the countries Germany, Switzerland, Greece, Italy and Norwey? Provide annual data and the currencies CHF / Euro where you see fit"`, async () => {
      await submitResultSearch(
        page,
        "How are the house prices and inflation rate in the countries Germany, Switzerland, Greece, Italy and Norwey? Provide annual data and the currencies CHF / Euro where you see fit",
      );
      await waitForAiSuggestions(page);
      await expectAiSuggestionsForComplexPrompt(page);
    });

    await it.step(`3. Click on "Show reasoning"`, async () => {
      await clickByRoleOrText(page, /show reasoning/i, ["button"]);
      const topicPanel = page.getByRole("dialog", { name: "Show reasoning" }).getByRole("tabpanel", {
        name: "Topic reasoning",
      });
      await expectNonEmptyReasoningText(topicPanel);
    });

    await it.step(`4. Click on the tab "Region reasoning"`, async () => {
      const suggestionCount = await aiSuggestionLinks(page).count();
      await expectReasoningDropdownOptionsHaveText(page, "Region reasoning", suggestionCount);
    });

    await it.step(`5. Click on the tab "Dimenion reasoning"`, async () => {
      const suggestionCount = await aiSuggestionLinks(page).count();
      await expectReasoningDropdownOptionsHaveText(page, "Dimension reasoning", suggestionCount);
    });

    await it.step(`7. Close the modal`, async () => {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Show reasoning" })).toBeHidden();
    });

    await it.step(`8. Click on the item that features a dimension filter`, async () => {
      const suggestionWithFrequencyFilter = page.locator('main a[href*="FREQ"]').first();
      await expect(suggestionWithFrequencyFilter, "AI suggestion should include a Frequency filter in its link").toBeVisible();
      await expect(suggestionWithFrequencyFilter).toHaveAttribute("href", /\/topics\/[^/]+\/data\?filter=.*FREQ/i);
      await suggestionWithFrequencyFilter.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/topics\/[^/]+\/data\?filter=.*FREQ/i);
      await expect(page.getByText(/Frequency:\s*Annual \[A\]/i)).toBeVisible();
    });
  });
});
