import { expect, test, type Page } from "@playwright/test";

async function gotoReleaseCalendar(page: Page, search = ""): Promise<void> {
  await page.goto(`/release-calendar${search}`);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Release calendar of BIS statistics" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Release calendar Page Structure (Desktop)", () => {
  test("renders the calendar page controls and switches to list view", async ({ page }) => {
    await gotoReleaseCalendar(page);

    await expect(page).toHaveTitle(/Release calendar of BIS statistics \| BIS Data Portal/);
    await expect(
      main(page).getByText("Find the latest publication dates of BIS statistics on this page."),
    ).toBeVisible();

    await expect(main(page).getByRole("button", { name: /Release date filter collapsed/i })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Topics filter collapsed/i })).toBeVisible();
    await expect(main(page).getByRole("link", { name: /RSS calendar feed/i })).toHaveAttribute("href", "/feed.xml");
    await expect(main(page).getByRole("button", { name: /Export menu collapsed/i })).toBeVisible();

    const viewSwitch = main(page).getByRole("radiogroup", { name: "view switch" });
    await expect(viewSwitch.getByRole("radio", { name: "Calendar" })).toBeChecked();
    await expect(main(page).getByRole("grid")).toBeVisible();

    await viewSwitch.getByRole("radio", { name: "List" }).click();
    await expect(page).toHaveURL(/\/release-calendar\?view=list/);
    await expect(viewSwitch.getByRole("radio", { name: "List" })).toBeChecked();

    await expect(main(page).getByRole("tab", { name: /^Latest releases \(\d+\)$/ })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: /^Upcoming releases \(\d+\)$/ })).toBeVisible();
    await expect(main(page).getByRole("tab", { name: /^Past releases \(\d+\)$/ })).toBeVisible();

    const listGrid = main(page).getByRole("grid");
    await expect(listGrid.getByRole("columnheader", { name: "Release Date" })).toBeVisible();
    await expect(listGrid.getByRole("columnheader", { name: "Topic" })).toBeVisible();
    await expect(listGrid.getByRole("columnheader", { name: "Reference Period" })).toBeVisible();
    await expect(listGrid.getByRole("columnheader", { name: "Release Type" })).toBeVisible();
  });
});
