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

const it = test;

const TOPICS = [
  { name: "Locational banking statistics", code: "LBS" },
  { name: "Consolidated banking statistics", code: "CBS" },
  { name: "Debt securities statistics", code: "DSS" },
  { name: "International debt securities (BIS-compiled)", code: "IDS" },
  { name: "Credit to the non-financial sector", code: "TOTAL_CREDIT" },
  { name: "Credit-to-GDP gaps", code: "CREDIT_GAPS" },
  { name: "Debt service ratios", code: "DSR" },
  { name: "Global liquidity", code: "GLI" },
  { name: "Exchange-traded derivatives statistics", code: "XTD_DER" },
  { name: "OTC derivatives outstanding", code: "OTC_DER" },
  { name: "Triennial Survey", code: "DER" },
  { name: "Residential property prices", code: "RPP" },
  { name: "Commercial property prices", code: "CPP" },
  { name: "Consumer prices", code: "CPI" },
  { name: "Bilateral exchange rates", code: "XRU" },
  { name: "Effective exchange rates", code: "EER" },
  { name: "Central bank total assets", code: "CBTA" },
  { name: "Central bank policy rates", code: "CBPOL" },
  { name: "Retail payments, currency and related indicators", code: "CPMI_CT" },
  { name: "Financial market infrastructures and critical service providers", code: "CPMI_FMI" },
];

async function expectTopicSection(page: Page, topicName: string): Promise<void> {
  const section = page.locator(`#${bulkDownloadAnchorId(topicName)}`);

  await expect(page.getByRole("heading", { name: topicName, level: 2 })).toBeVisible();
  await expect(section.getByRole("heading", { name: /\((CSV|SDMX)/i }).first()).toBeVisible();
  await expect(section.locator("time").first()).toHaveText(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
  await expect(page.getByRole("link", { name: "Go to topic" }).and(page.locator(`[href="/topics/${topicCode(topicName)}"]`))).toBeVisible();
}

function bulkDownloadAnchorId(topicName: string): string {
  return topicName
    .toLowerCase()
    .replace(/[(),]/g, "-")
    .replace(/\s+/g, "-");
}

function topicCode(topicName: string): string {
  return TOPICS.find((topic) => topic.name === topicName)?.code ?? "";
}

async function expectDownloadHoverState(downloadItem: Locator): Promise<void> {
  const downloadIcon = downloadItem.locator("i.icon.fa-download").first();
  const downloadItemContent = downloadItem.locator("> :first-child");

  await expect(downloadItemContent).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await downloadItem.hover();
  await expect(downloadItemContent).toHaveCSS("background-color", "rgb(242, 242, 242)");
  await expect(downloadIcon, "Download icon should be shown on the right side of the download item").toBeVisible();
  await expect(downloadIcon).toHaveClass(/\bfa-download\b/);

  await expect
    .poll(async () => {
      return downloadItem.evaluate((item) => {
        const content = item.firstElementChild;
        const icon = item.querySelector("i.icon.fa-download");

        if (!content || !icon) {
          return false;
        }

        const contentRect = content.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        return iconRect.left > contentRect.left + contentRect.width / 2 && Math.abs(contentRect.right - iconRect.right) <= 1;
      });
    }, { message: "Download icon should be aligned to the right hand side of the download item" })
    .toBe(true);
}

test.describe(`Bulk downloads Page structure (Desktop)`, () => {
  test(`Bulk downloads Page structure (Desktop)`, async ({ page }) => {
    await it.step(`1. Navigate to \`/bulkdownload\` and confirm the following:`, async () => {
      await gotoPath(page, "/bulkdownload");
      await expect(page).toHaveTitle(/Bulk downloads \| BIS Data Portal/);
      await expect(page.getByRole("heading", { name: "Bulk downloads", level: 1 })).toBeVisible();
      await expect(page.getByText("You can download a full topic in CSV or SDMX format as a single (zipped) file.")).toBeVisible();

      const tableOfContents = page.getByRole("navigation", { name: "Table of contents" });
      await expect(tableOfContents).toBeVisible();

      const topicLinks = tableOfContents.getByRole("link");
      await expect(topicLinks.first()).toHaveText("Locational banking statistics");
      await expect(topicLinks.first()).toHaveAttribute("aria-current", "true");
      await expect.poll(() => topicLinks.count()).toBeGreaterThanOrEqual(TOPICS.length);

      for (const { name } of TOPICS) {
        await expect(tableOfContents.getByRole("link", { name })).toBeVisible();
        await expectTopicSection(page, name);
      }

      const firstDownload = page.locator('a[href="/static/bulk/WS_LBS_D_PUB_csv_col.zip"]');
      await expect(firstDownload).toHaveAttribute("href", /\/static\/bulk\/.*\.zip$/);
      await expectDownloadHoverState(firstDownload);
      await expect(firstDownload.getByRole("heading", { name: "Locational banking statistics (CSV)" })).toBeVisible();
      await expect(firstDownload.locator("time")).toHaveText(/\d{1,2} [A-Z][a-z]{2} \d{4}/);

      await tableOfContents.getByRole("link", { name: "Consolidated banking statistics" }).click();
      await expect(page).toHaveURL(/#consolidated-banking-statistics$/);
      await expect(tableOfContents.getByRole("link", { name: "Consolidated banking statistics" })).toHaveAttribute("aria-current", "true");
    });
  });
});
