import { expect, test, type Page } from "@playwright/test";

const SECTIONS = [
  "About",
  "Metadata",
  "Commentary",
  "Methodology",
  "Research and publications",
  "Glossary",
  "FAQs",
  "Related topics",
];

async function gotoLbsOverview(page: Page): Promise<void> {
  await page.goto("/topics/LBS");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1, name: "Locational banking statistics" })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Topic Overview Page", () => {
  test("renders the LBS overview content, sections, and local navigation", async ({ page }) => {
    await gotoLbsOverview(page);

    await expect(page).toHaveTitle(/Locational banking statistics - overview \| BIS Data Portal/);
    await expect(main(page).getByText(/measure international banking activity from a residence perspective/i)).toBeVisible();

    const pageNavigation = main(page).getByRole("navigation", { name: "Page navigation" });
    await expect(pageNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/topics/LBS");
    await expect(pageNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(pageNavigation.getByRole("link", { name: "Tables & dashboards" })).toHaveAttribute(
      "href",
      "/topics/LBS/tables-and-dashboards",
    );
    await expect(pageNavigation.getByRole("link", { name: "Data" })).toHaveAttribute("href", "/topics/LBS/data");

    await expect(main(page).getByRole("navigation", { name: "Table of contents" })).toBeVisible();
    for (const section of SECTIONS) {
      await expect(main(page).getByRole("heading", { level: 2, name: section })).toBeVisible();
      await expect(main(page).getByRole("region", { name: section })).toBeVisible();
    }

    const metadata = main(page).getByRole("region", { name: "Metadata" });
    for (const metadataLabel of ["Supervising committee", "Seasonal adjustment", "Frequencies", "Contact", "Units"]) {
      await expect(metadata).toContainText(metadataLabel);
    }
    await expect(metadata).toContainText("Next release date");
    await expect(metadata).toContainText("Last release date");
    await expect(metadata.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      /\/release-calendar\?filter=categoryId(?:=|%3D)LBS/,
    );
    await expect(metadata.getByRole("link", { name: "BIS statistics" })).toHaveAttribute("href", "/help/contact?topic=LBS");

    const commentary = main(page).getByRole("region", { name: "Commentary" });
    await expect(commentary.getByRole("link", { name: "View latest" })).toBeVisible();
    await expect(commentary.getByRole("link", { name: "View all" })).toHaveAttribute("href", /stats_banking_commentaries/);

    const methodology = main(page).getByRole("region", { name: "Methodology" });
    await expect(methodology.getByRole("tab", { name: "Explanatory Notes" })).toHaveAttribute("aria-selected", "true");
    await expect(methodology.getByRole("tab", { name: "Reporting guidelines" })).toHaveAttribute("aria-selected", "false");
    await expect(methodology).toContainText(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
    await expect(methodology.getByRole("link").first()).toBeVisible();

    await expect(main(page).getByRole("region", { name: "Glossary" }).getByRole("link", { name: "View full" })).toHaveAttribute(
      "href",
      "/help/glossary",
    );

    await expect(
      main(page).getByRole("region", { name: "Related topics" }).getByRole("link", {
        name: /Consolidated banking statistics/i,
      }),
    ).toHaveAttribute("href", "/topics/CBS");
    await expect(main(page).getByRole("region", { name: "Related topics" })).not.toContainText("Locational banking statistics");

    await pageNavigation.getByRole("link", { name: "Data" }).click();
    await expect(page).toHaveURL("/topics/LBS/data");
    await expect(page.getByRole("heading", { level: 1, name: "Locational banking statistics" })).toBeVisible();
  });
});
