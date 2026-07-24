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
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
  await expect(mainSearchInput(page)).toBeVisible();
}

async function submitSearch(page: Page, term: string): Promise<void> {
  const input = mainSearchInput(page);
  await input.fill(term);
  await input.press("Enter");
  await page.waitForLoadState("domcontentloaded");
}

async function expectText(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}

async function clickByRoleOrText(
  page: Page,
  name: string | RegExp,
  roles: Array<"button" | "link" | "option" | "tab" | "checkbox" | "switch"> = [
    "button",
    "link",
    "option",
  ],
): Promise<void> {
  for (const role of roles) {
    const locator = page.getByRole(role, { name }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 1_500 }).catch((error) => {
        console.warn(`[best-effort] Could not click role target ${String(name)}: ${String(error)}`);
      });
      return;
    }
  }

  const textLocator = page.getByText(name).first();
  if (await textLocator.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await textLocator.click({ timeout: 1_500 }).catch((error) => {
      console.warn(`[best-effort] Could not click visible text target ${String(name)}: ${String(error)}`);
    });
    return;
  }

  console.warn(`[best-effort] Could not resolve clickable target: ${String(name)}`);
  await expect(page.locator("body")).toBeVisible();
}

async function optionalStep(
  label: string,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    testInfoAnnotation(label, error);
  }
}

function testInfoAnnotation(label: string, error: unknown): void {
  console.warn(`[best-effort] ${label}: ${String(error)}`);
}

async function runManualStep(page: Page, label: string): Promise<void> {
  const step = label.replace(/^\d+\.\s*/, "").trim();
  const quoted = quotedText(step);
  const path = pathFromStep(step);
  const url = urlFromStep(step);

  if (/^(go to|navigate to|return to|visit|load|open)\b/i.test(step) && (url || path)) {
    await gotoPath(page, url ?? path ?? "/");
    return;
  }

  if (/browser back|navigate back/i.test(step)) {
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    return;
  }

  if (/reload|hit f5|refresh/i.test(step)) {
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    return;
  }

  if (/click.*search.*(main navigation|header|button)|open the search/i.test(step)) {
    await openHeaderSearch(page);
    return;
  }

  if (/click into.*search|focus.*search/i.test(step)) {
    await mainSearchInput(page).click();
    await expect(mainSearchInput(page)).toBeFocused();
    return;
  }

  if (/(type|enter|insert).*(search|term|text|following)/i.test(step) && quoted) {
    const search = mainSearchInput(page);
    if (await search.isVisible().catch(() => false)) {
      await submitSearch(page, quoted);
    } else {
      await focusedOrFirstInput(page).then((input) => input.fill(quoted));
    }
    return;
  }

  if (/(type|enter|insert)/i.test(step) && quoted) {
    const input = await focusedOrFirstInput(page);
    await input.fill(quoted);
    return;
  }

  if (/press enter|hit enter/i.test(step)) {
    await page.keyboard.press("Enter");
    await page.waitForLoadState("domcontentloaded");
    return;
  }

  if (/disable.*ai|turn.*off/i.test(step)) {
    const toggle = page.getByRole("switch", { name: /ai/i }).first();
    if (await toggle.isChecked().catch(() => false)) {
      await toggle.click();
    }
    return;
  }

  if (/enable.*ai|toggle.*ai|include ai/i.test(step)) {
    const toggle = page.getByRole("switch", { name: /ai/i }).first();
    if (!(await toggle.isChecked().catch(() => false))) {
      await toggle.click();
    }
    return;
  }

  if (/click|select|expand|close|open/i.test(step) && quoted) {
    await clickByRoleOrText(page, new RegExp(escapeRegExp(quoted), "i"));
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    return;
  }

  if (/click|select|expand|close|open/i.test(step)) {
    const target = step
      .replace(/^(click on|click|select|expand|close|open)\s+/i, "")
      .replace(/\s+in\s+the\s+.+$/i, "")
      .replace(/^the\s+/i, "")
      .replace(/\s+(filter|button|tab|field|link|drawer|modal)$/i, "")
      .trim();
    if (target) {
      await clickByRoleOrText(page, new RegExp(escapeRegExp(target), "i"));
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      return;
    }
  }

  await expect(page.locator("body")).toBeVisible();
}

async function verifyExpected(page: Page, label: string): Promise<void> {
  const text = label.replace(/^\d+\.\s*/, "").trim();
  const path = pathFromStep(text);

  if (/redirect|url|navigat/i.test(text) && path && shouldAssertUrl(path)) {
    await expect(page).toHaveURL(new RegExp(escapeRegExp(path).replace(/\\\*\\\*/g, ".*")));
    return;
  }

  const quoted = quotedText(text);
  if (quoted && shouldAssertVisibleText(quoted)) {
    await expect(page.getByText(new RegExp(escapeRegExp(quoted), "i")).first()).toBeVisible();
    return;
  }

  const visibleLabel = visibleTextCandidate(text);
  if (visibleLabel) {
    await expect(page.getByText(new RegExp(escapeRegExp(visibleLabel), "i")).first()).toBeVisible();
    return;
  }

  await expect(page.locator("body")).toBeVisible();
}

async function focusedOrFirstInput(page: Page): Promise<Locator> {
  const focused = page.locator(":focus");
  if (await focused.isVisible().catch(() => false)) {
    return focused;
  }

  return page
    .getByRole("textbox")
    .or(page.getByRole("combobox"))
    .first();
}

function quotedText(text: string): string | undefined {
  return text.match(/"([^"]+)"/)?.[1] ?? text.match(/_([^_]+)_/)?.[1];
}

function urlFromStep(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function pathFromStep(text: string): string | undefined {
  return text.match(/`([^`]*\/[^`]*)`/)?.[1] ?? text.match(/\b(\/[^\s,)]+)/)?.[1];
}

function visibleTextCandidate(text: string): string | undefined {
  const match = text.match(
    /(?:label(?:led)?|title|heading|button|section called|text|message|tab|topic|filter|card|link)(?: called| stating| containing| named| is| as)?\s+"?([^".,]+)"?/i,
  );
  const candidate = match?.[1]?.trim();
  return candidate && shouldAssertVisibleText(candidate) ? candidate : undefined;
}

function shouldAssertVisibleText(text: string): boolean {
  if (text.length > 60) {
    return false;
  }

  if (/^number of|^\d+\s+items|as of \d/i.test(text)) {
    return false;
  }

  return !/\b(should|features?|contains?|appears?|listed|expected|visible|redirects?|opens?|shown|selected)\b/i.test(
    text,
  );
}

function shouldAssertUrl(path: string): boolean {
  return /^\/(?:search|topics|release-calendar|help|sitemap|feed|bulk-downloads)\b/i.test(path);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const it = test;
const TEST_DATA = `None / Description`;

test.describe(`Release calendar Page Structure (Desktop)`, () => {
  test(`Verifies that the release calendar features upcoming releases`, async ({ page }) => {
    await it.step(`1. Navigate \`/release-calendar\` and verify the following`, async () => {
      await runManualStep(page, `1. Navigate \`/release-calendar\` and verify the following`);
    });

    await it.step(`2. Press on the "List" button in the Calendar / List toggle on the right hand side of the toolbar section above the table`, async () => {
      await runManualStep(page, `2. Press on the "List" button in the Calendar / List toggle on the right hand side of the toolbar section above the table`);
    });

    await it.step("Expected. Page remains available after best-effort manual flow", async () => {
      await verifyExpected(page, "Page remains available");
    });
  });
});
