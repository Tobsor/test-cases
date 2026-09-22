import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://data.bis.org";

async function gotoPath(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("domcontentloaded");
}

type Series = { dataflowId: string; seriesKey: string };

async function seriesFromLink(link: Locator): Promise<Series> {
  await expect(link).toHaveAttribute("href", /\/topics\/EER\//);
  const href = await link.getAttribute("href");
  const path = decodeURIComponent(new URL(href!, BASE_URL).pathname);
  expect(path).toMatch(/^\/topics\/EER\/BIS,[^/]+\/[^/]+$/);
  const [, , , dataflowId, seriesKey] = path.split("/");
  return { dataflowId, seriesKey };
}

async function selectFirstTwoSeries(page: Page): Promise<[Series, Series]> {
  const checkboxes = page.locator("main").getByRole("checkbox", { name: /Select time series|Press Space to toggle row selection/ });
  const selected: Series[] = [];
  for (let index = 0; index < 2; index++) {
    const checkbox = checkboxes.nth(index);
    const result = checkbox.locator("xpath=ancestor::*[self::article or @role='row'][1]");
    selected.push(await seriesFromLink(result.getByRole("link").first()));
    await checkbox.check();
  }
  await expect(page.locator("main").getByText(/2 selected/)).toBeVisible();
  return [selected[0], selected[1]];
}

async function compareSelectedSeries(page: Page, [first, second]: [Series, Series]): Promise<void> {
  const compare = page.locator("main").getByRole("link", { name: "Compare time series" });
  await expect(compare).toBeEnabled();
  await compare.click();
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL((url) => {
    const additionalSeries = url.searchParams.get("additional_ts");
    return decodeURIComponent(url.pathname) === `/topics/EER/${first.dataflowId}/${first.seriesKey}`
      // URLSearchParams decodes the query layer; the value may also encode the caret separator.
      && additionalSeries !== null
      && decodeURIComponent(additionalSeries) === `${second.dataflowId}^${second.seriesKey}`;
  });
}

const it = test;

test.describe(`Global Search Item Navigation`, () => {
  test(`Global Search Item Navigation`, async ({ page }) => {
    let selectedSeries: [Series, Series];
    await it.step(`1. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
      await expect(page.getByText(/time series found/i)).toBeVisible();
    });

    await it.step(`2. Click on a time series in the time series list`, async () => {
      const card = page.locator("main article").first();
      const link = card.getByRole("link").first();
      const seriesKeyField = card.locator("dt", { hasText: /^Series key$/ }).locator("+ dd");
      await expect(seriesKeyField).toBeVisible();
      const seriesKey = (await seriesKeyField.innerText()).trim();
      expect(seriesKey).toMatch(/^[^.\s/]+(?:\.[^.\s/]+)+$/);

      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
      const expectedPath = decodeURIComponent(new URL(href!, BASE_URL).pathname);
      expect(expectedPath).toMatch(/^\/topics\/EER\/BIS,[^/]+\/[^/]+$/);
      expect(expectedPath.split("/").at(-1)).toBe(seriesKey);

      await link.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === expectedPath);
    });

    await it.step(`3. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`4. Select two time series in the time series list by checking the checkboxes`, async () => {
      selectedSeries = await selectFirstTwoSeries(page);
    });

    await it.step(`5. Click on \`Compare time series\``, async () => {
      await compareSelectedSeries(page, selectedSeries);
    });

    await it.step(`6. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`7. Select the table view in the toolbar`, async () => {
      const listView = page.getByRole("radio", { name: "Change to list view" });
      await listView.click();
      await expect(listView).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("main").getByRole("grid")).toBeVisible();
    });

    await it.step(`8. Click on a series key of a time series in the list`, async () => {
      const link = page.locator("main").getByRole("grid").getByRole("link").first();
      const { dataflowId, seriesKey } = await seriesFromLink(link);
      await expect(link).toHaveText(seriesKey);
      await link.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL((url) =>
        decodeURIComponent(url.pathname) === `/topics/EER/${dataflowId}/${seriesKey}`);
    });

    await it.step(`9. Navigate to \`/search\``, async () => {
      await gotoPath(page, "/search?q=exchange%20rate");
    });

    await it.step(`10. Select the table view in the toolbar`, async () => {
      const listView = page.getByRole("radio", { name: "Change to list view" });
      await listView.click();
      await expect(listView).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("main").getByRole("grid")).toBeVisible();
    });

    await it.step(`11. Select two time series in the time series table by checking the checkboxes`, async () => {
      selectedSeries = await selectFirstTwoSeries(page);
    });

    await it.step(`12. Click on \`Compare time series\``, async () => {
      await compareSelectedSeries(page, selectedSeries);
    });
  });
});
