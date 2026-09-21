import { expect, test, type Locator, type Page } from "@playwright/test";

async function gotoReleaseCalendar(page: Page, search = "?view=list"): Promise<void> {
  await page.goto(`/release-calendar${search}`);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Release calendar of BIS statistics" })).toBeVisible();
}

function main(page: Page): Locator {
  return page.locator("main");
}

function releaseTab(page: Page, name: "Latest" | "Upcoming" | "Past"): Locator {
  return main(page).getByRole("tab", { name: new RegExp(`^${name} releases \\(\\d+\\)$`) });
}

function activeReleasePanel(page: Page, name: "Latest" | "Upcoming" | "Past"): Locator {
  return main(page).getByRole("tabpanel", { name: new RegExp(`^${name} releases \\(\\d+\\)$`) });
}

async function visibleReleaseCount(page: Page, tabName: "Latest" | "Upcoming" | "Past"): Promise<number> {
  const showingText = await activeReleasePanel(page, tabName).getByText(/^Showing \d+ of \d+$/).textContent();
  const match = showingText?.match(/^Showing (\d+) of \d+$/);

  expect(match, `Unexpected release count text: ${showingText}`).not.toBeNull();
  return Number(match?.[1]);
}

test.describe("Release calendar List view", () => {
  test("supports list tabs, pagination, filters, reload, and topic navigation", async ({ page }) => {
    await gotoReleaseCalendar(page);

    await test.step("shows the latest releases list by default", async () => {
      await expect(page).toHaveURL(/\/release-calendar\?view=list/);
      await expect(main(page).getByRole("radiogroup", { name: "view switch" }).getByRole("radio", { name: "List" })).toBeChecked();
      await expect(releaseTab(page, "Latest")).toHaveAttribute("aria-selected", "true");

      const latestGrid = activeReleasePanel(page, "Latest").getByRole("grid");
      await expect(latestGrid.getByRole("columnheader", { name: "Release Date" })).toBeVisible();
      await expect(latestGrid.getByRole("columnheader", { name: "Topic" })).toBeVisible();
      await expect(latestGrid.getByRole("columnheader", { name: "Reference Period" })).toBeVisible();
      await expect(latestGrid.getByRole("columnheader", { name: "Release Type" })).toBeVisible();
    });

    await test.step("switches between upcoming and past release tabs", async () => {
      await releaseTab(page, "Upcoming").click();
      await expect(page).toHaveURL(/tab=upcoming/);
      await expect(releaseTab(page, "Upcoming")).toHaveAttribute("aria-selected", "true");
      await expect(activeReleasePanel(page, "Upcoming").getByRole("link").first()).toBeVisible();

      await releaseTab(page, "Past").click();
      await expect(page).toHaveURL(/tab=past/);
      await expect(releaseTab(page, "Past")).toHaveAttribute("aria-selected", "true");
      await expect(activeReleasePanel(page, "Past").getByRole("link").first()).toBeVisible();
    });

    await test.step("loads more upcoming releases", async () => {
      await releaseTab(page, "Upcoming").click();

      const initialCount = await visibleReleaseCount(page, "Upcoming");
      await main(page).getByRole("button", { name: "Show more" }).click();
      await expect
        .poll(() => visibleReleaseCount(page, "Upcoming"), { message: "visible release count should increase" })
        .toBeGreaterThan(initialCount);
    });

    await test.step("opens a release topic and returns to the calendar", async () => {
      const calendarUrl = page.url();
      const [topicPage] = await Promise.all([
        page.waitForEvent("popup"),
        activeReleasePanel(page, "Upcoming").getByRole("link").first().click(),
      ]);

      await topicPage.waitForLoadState("domcontentloaded");
      await expect(topicPage).toHaveURL(/\/topics\//);
      await expect(topicPage.getByRole("heading", { level: 1 })).toBeVisible();
      await topicPage.close();

      await expect(page).toHaveURL(calendarUrl);
      await expect(page.getByRole("heading", { level: 1, name: "Release calendar of BIS statistics" })).toBeVisible();
    });

    await test.step("applies topic and release-date filters and persists them after reload", async () => {
      await main(page).getByRole("button", { name: /Topics filter collapsed/i }).click();
      await page.getByRole("checkbox", { name: "Effective exchange rates[EER]" }).check();
      await expect(page).toHaveURL(/filter=.*categoryId%3DEER/);
      await expect(main(page).getByRole("button", { name: /Clear Topics filter/i })).toBeVisible();

      await main(page).getByRole("button", { name: /Release date filter collapsed/i }).click();
      await page.getByRole("button", { name: "July" }).click();
      await expect(page).toHaveURL(/filter=.*RELEASE_DATE%3D\d{4}-07-01_/);
      await expect(main(page).getByRole("button", { name: /Clear Release date filter/i })).toBeVisible();

      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await expect(main(page).getByRole("button", { name: /Clear Topics filter/i })).toBeVisible();
      await expect(main(page).getByRole("button", { name: /Clear Release date filter/i })).toBeVisible();
      await expect(activeReleasePanel(page, "Upcoming").getByRole("gridcell", { name: "Effective exchange rates" }).first()).toBeVisible();
    });

    await test.step("clears applied filters", async () => {
      await main(page).getByRole("button", { name: /Clear Release date filter/i }).click();
      await expect(main(page).getByRole("button", { name: /Clear Release date filter/i })).toBeHidden();

      await main(page).getByRole("button", { name: /Clear Topics filter/i }).click();
      await expect(main(page).getByRole("button", { name: /Clear Topics filter/i })).toBeHidden();
    });
  });
});
