import { expect, test, type Locator, type Page } from "@playwright/test";

type ReleaseTab = "Latest" | "Upcoming" | "Past";

function releaseTab(page: Page, name: ReleaseTab): Locator {
  return page.getByRole("main").getByRole("tab", { name: new RegExp(`^${name} releases \\(\\d+\\)$`) });
}

function releasePanel(page: Page, name: ReleaseTab): Locator {
  return page.getByRole("main").getByRole("tabpanel", { name: new RegExp(`^${name} releases \\(\\d+\\)$`) });
}

async function releaseCounts(page: Page, name: ReleaseTab): Promise<{ shown: number; total: number }> {
  const summary = releasePanel(page, name).getByText(/^Showing \d+ of \d+$/);
  await expect(summary).toBeVisible();
  const match = (await summary.innerText()).match(/^Showing (\d+) of (\d+)$/)!;
  return { shown: Number(match[1]), total: Number(match[2]) };
}

function dateCells(page: Page, name: ReleaseTab): Locator {
  // Each release-date cell contains its own gridcell with the date and status bar.
  return releasePanel(page, name).getByRole("grid").getByRole("gridcell")
    .getByRole("gridcell").filter({ hasText: /^\d{4}-\d{2}-\d{2}$/ });
}

async function releaseDates(page: Page, name: ReleaseTab): Promise<string[]> {
  const { shown } = await releaseCounts(page, name);
  await expect(dateCells(page, name)).toHaveCount(shown);
  return dateCells(page, name).allTextContents();
}

function expectDateOrder(dates: string[], order: "ascending" | "descending"): void {
  const sorted = [...dates].sort();
  expect(dates).toEqual(order === "ascending" ? sorted : sorted.reverse());
}

async function expectFilteredPast(page: Page, count: number): Promise<void> {
  await expect(releaseTab(page, "Past")).toHaveAttribute("aria-selected", "true");
  await expect(releaseTab(page, "Latest")).toBeDisabled();
  await expect(releaseTab(page, "Upcoming")).toBeDisabled();
  await expect(releasePanel(page, "Past").getByText(`Showing ${count} of ${count}`, { exact: true })).toBeVisible();
  await expect(dateCells(page, "Past")).toHaveCount(count);
}

test.describe("Release calendar List view", () => {
  test("follows the numbered release calendar list workflow", async ({ page }) => {
    let today: string;
    let latestDates: string[];
    let initialPastDates: string[];
    let initialPastCounts: { shown: number; total: number };
    let calendarUrl: string;
    let topicPage: Page;

    await test.step("1. Navigate to /release-calendar?view=list", async () => {
      await page.goto("/release-calendar?view=list");
      await expect(page.getByRole("heading", { level: 1, name: "Release calendar of BIS statistics" })).toBeVisible();
      today = await page.evaluate(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      });
      await expect(page.getByRole("radio", { name: "List", exact: true })).toBeChecked();
      for (const name of ["Latest", "Upcoming", "Past"] as const) {
        await expect(releaseTab(page, name)).toBeVisible();
      }
      await expect(releaseTab(page, "Latest")).toHaveAttribute("aria-selected", "true");
      latestDates = await releaseDates(page, "Latest");
      expect(latestDates.length).toBeGreaterThanOrEqual(7);
      expectDateOrder(latestDates, "descending");
      expect(latestDates.every((date) => date <= today)).toBe(true);
      expect(latestDates.slice(6).every((date) => date === latestDates[6])).toBe(true);
      const counts = await releaseCounts(page, "Latest");
      expect(counts.shown).toBe(counts.total);
      await expect(releaseTab(page, "Latest")).toHaveText(`Latest releases (${counts.total})`);
    });

    await test.step("2. Click Upcoming releases", async () => {
      await releaseTab(page, "Upcoming").click();
      await expect(releaseTab(page, "Upcoming")).toHaveAttribute("aria-selected", "true");
      const counts = await releaseCounts(page, "Upcoming");
      expect(counts.shown).toBe(Math.min(20, counts.total));
      await expect(releaseTab(page, "Upcoming")).toHaveText(`Upcoming releases (${counts.total})`);
      const dates = await releaseDates(page, "Upcoming");
      expectDateOrder(dates, "ascending");
      expect(dates.every((date) => date > today)).toBe(true);
      for (let index = 0; index < dates.length && dates[index] === dates[0]; index++) {
        await expect(dateCells(page, "Upcoming").nth(index)).toHaveCSS("border-left-color", "rgb(170, 51, 47)");
        await expect(dateCells(page, "Upcoming").nth(index)).toHaveCSS("border-left-style", "solid");
      }
      const showMore = releasePanel(page, "Upcoming").getByRole("button", { name: "Show more", exact: true });
      if (counts.total >= 21) await expect(showMore).toBeVisible();
      else await expect(showMore).toBeHidden();
    });

    await test.step("3. Click Past releases", async () => {
      await releaseTab(page, "Past").click();
      await expect(page).toHaveURL((url) => url.searchParams.get("tab") === "past");
      await expect(releaseTab(page, "Past")).toHaveAttribute("aria-selected", "true");
      initialPastCounts = await releaseCounts(page, "Past");
      expect(initialPastCounts.shown).toBe(Math.min(20, initialPastCounts.total));
      await expect(releaseTab(page, "Past")).toHaveText(`Past releases (${initialPastCounts.total})`);
      initialPastDates = await releaseDates(page, "Past");
      expectDateOrder(initialPastDates, "descending");
      // The confirmed cutoff is the last Latest date, not the start of the month.
      // This also verifies that releases on the seventh Latest date stay together.
      expect(initialPastDates.every((date) => date < latestDates[6])).toBe(true);
      for (const cell of await dateCells(page, "Past").all()) {
        await expect(cell).toHaveCSS("border-left-color", "rgb(204, 204, 204)");
        await expect(cell).toHaveCSS("border-left-style", "solid");
      }
    });

    await test.step("4. Click Show more", async () => {
      await releasePanel(page, "Past").getByRole("button", { name: "Show more", exact: true }).click();
      const expectedCount = Math.min(initialPastCounts.shown + 20, initialPastCounts.total);
      await expect(releasePanel(page, "Past").getByText(`Showing ${expectedCount} of ${initialPastCounts.total}`, { exact: true })).toBeVisible();
      const dates = await releaseDates(page, "Past");
      expect(dates.slice(0, initialPastDates.length)).toEqual(initialPastDates);
      expectDateOrder(dates, "descending");
    });

    await test.step("5. Click Upcoming releases", async () => {
      await releaseTab(page, "Upcoming").click();
      await expect(releaseTab(page, "Upcoming")).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL((url) => url.searchParams.get("tab") === "upcoming");
    });

    await test.step("6. Select Release date 2024-01 to 2024-02", async () => {
      await page.getByRole("button", { name: /^Release date filter collapsed/ }).click();
      const from = page.getByRole("combobox", { name: "from date", exact: true });
      const to = page.getByRole("combobox", { name: "to date", exact: true });
      await from.fill("2024-01");
      await from.press("Tab");
      await to.fill("2024-02");
      await to.press("Tab");
      await page.keyboard.press("Escape");
      await expectFilteredPast(page, 16);
      const dates = await releaseDates(page, "Past");
      expect(dates.every((date) => date >= "2024-01-01" && date < "2024-03-01")).toBe(true);
    });

    await test.step("7. Select Topics: Effective exchange rates", async () => {
      await page.getByRole("button", { name: /^Topics filter collapsed/ }).click();
      await page.getByRole("checkbox", { name: "Effective exchange rates[EER]", exact: true }).check();
      await page.keyboard.press("Escape");
      await expectFilteredPast(page, 9);
      await expect(releasePanel(page, "Past").getByRole("link", { name: "Effective exchange rates", exact: true })).toHaveCount(9);
    });

    await test.step("8. Refresh the page and verify filters persist", async () => {
      calendarUrl = page.url();
      await page.reload();
      await expect(page).toHaveURL(calendarUrl);
      await expectFilteredPast(page, 9);
      await expect(page.getByRole("button", { name: /^Topics filter/ })).toContainText("Effective exchange rates");
      await page.getByRole("button", { name: /^Release date filter collapsed/ }).click();
      await expect(page.getByRole("combobox", { name: "from date", exact: true })).toHaveValue("2024-01");
      await expect(page.getByRole("combobox", { name: "to date", exact: true })).toHaveValue("2024-02");
      await page.keyboard.press("Escape");
    });

    await test.step("9. Open the first release in a new browser tab", async () => {
      [topicPage] = await Promise.all([
        page.waitForEvent("popup"),
        releasePanel(page, "Past").getByRole("link", { name: "Effective exchange rates", exact: true }).first().click(),
      ]);
      await expect(topicPage).toHaveURL((url) => url.pathname === "/topics/EER");
      await expect(topicPage.getByRole("heading", { level: 1, name: "Effective exchange rates" })).toBeVisible();
    });

    await test.step("10. Return to the release calendar browser tab", async () => {
      await page.bringToFront();
      await expect(page).toHaveURL(calendarUrl);
      await expectFilteredPast(page, 9);
      await topicPage.close();
    });

    // The source Markdown numbers both final actions as Step 10.
    await test.step("10. Clear Release date and Topics filters", async () => {
      await page.getByRole("button", { name: "Clear Release date filter", exact: true }).click();
      await page.getByRole("button", { name: "Clear Topics filter", exact: true }).click();
      await expect(page.getByRole("button", { name: /^Clear (Release date|Topics) filter$/ })).toHaveCount(0);
      await expect(releaseTab(page, "Upcoming")).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL((url) => url.searchParams.get("tab") === "upcoming" && !url.searchParams.has("filter"));
    });
  });
});
