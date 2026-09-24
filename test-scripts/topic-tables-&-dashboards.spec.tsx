import { expect, test, type Locator, type Page } from "@playwright/test";

const LBS_PATH = "/topics/LBS/tables-and-dashboards";
const DSS_PATH = "/topics/DSS/tables-and-dashboards";

async function verifyTableCards(page: Page, container: Locator, path: string): Promise<void> {
  const cards = container.getByRole("link");
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card.getByRole("heading")).toBeVisible();
    await expect(card.getByRole("heading")).not.toBeEmpty();
    const href = await card.getAttribute("href");
    expect(href).toMatch(new RegExp(`^${path}/[^/?#]+$`));
  }
  // Table links have no accessible names; exercise the first card in this section/panel.
  const card = cards.first();
  const href = await card.getAttribute("href");
  await card.click();
  await expect(page).toHaveURL((url) => url.pathname === href);
  await expect(page.getByRole("main").getByRole("navigation", { name: "Breadcrumb", exact: true })
    .getByRole("link", { name: "Publication table", exact: true })).toHaveAttribute("href", href!);
  await expect(page.getByRole("main").getByRole("grid").first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === path);
}

test.describe("Topic tables & dashboards", () => {
  test("renders dashboard cards, opens dashboards, and navigates topic tables", async ({ page }) => {
    test.setTimeout(180_000);
    const main = page.getByRole("main");
    const navigation = main.getByRole("navigation", { name: "Page navigation", exact: true });
    const dashboards = main.getByRole("region", { name: "Dashboards", exact: true });
    const tables = main.getByRole("region", { name: "Tables", exact: true });

    await test.step("1. Navigate to LBS and verify Tables & dashboards is active", async () => {
      await page.goto(LBS_PATH);
      await expect(main.getByRole("heading", { name: "Locational banking statistics", level: 1, exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Tables & dashboards", exact: true })).toHaveAttribute("aria-current", "page");
    });

    await test.step("2. Verify every dashboard card has an image, title, and description", async () => {
      await expect(dashboards.getByRole("heading", { name: "Dashboards", level: 2, exact: true })).toBeVisible();
      const cards = dashboards.getByRole("article");
      await expect(cards.first()).toBeVisible();
      for (const card of await cards.all()) {
        await expect(card.getByRole("button")).toBeVisible();
        await expect(card.getByRole("heading", { level: 3 })).not.toBeEmpty();
        await expect(card.getByRole("paragraph").first()).toBeVisible();
        for (const paragraph of await card.getByRole("paragraph").all()) await expect(paragraph).not.toBeEmpty();
        // Decorative images have empty alt text and no img role.
        const image = card.locator("img");
        await expect(image).toHaveCount(1);
        await image.scrollIntoViewIfNeeded();
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      }
    });

    await test.step("3. Open every dashboard card and verify the embedded dashboard loads", async () => {
      const titles = await dashboards.getByRole("heading", { level: 3 }).allTextContents();
      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) {
        await test.step(`Open dashboard: ${title}`, async () => {
          await dashboards.getByRole("button").filter({
            has: page.getByRole("heading", { name: title, level: 3, exact: true }),
          }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toHaveCount(1);
          await expect(dialog.getByRole("button", { name: "Close modal", exact: true })).toBeVisible();
          // An iframe has no implicit role. Its title is supplied by Tableau and may be localized.
          const frame = dialog.locator("iframe");
          await expect(frame).toHaveCount(1);
          await expect(frame).toBeVisible();
          await expect(frame).toHaveAttribute("title", /\S+/);
          await expect(frame).toHaveAttribute("src", /^https:\/\/dataviz\.bis\.org\/t\/DataPortal\/views\/lbs_(rc|cc)\/Main\?/);
          const application = frame.contentFrame().getByRole("application");
          await expect(application).toBeVisible({ timeout: 60_000 });
          await expect(application.getByText("Locational banking statistics", { exact: true })).toBeVisible({ timeout: 60_000 });
          await expect(application.getByRole("combobox").first()).toBeVisible();
          await dialog.getByRole("button", { name: "Close modal", exact: true }).click();
          await expect(dialog).not.toBeAttached();
        });
      }
    });

    await test.step("4. Verify LBS table cards and open a publication table", async () => {
      await expect(tables.getByRole("heading", { name: "Tables", level: 2, exact: true })).toBeVisible();
      await verifyTableCards(page, tables, LBS_PATH);
    });

    await test.step("5. Navigate to DSS tables and dashboards", async () => {
      await page.goto(DSS_PATH);
      await expect(main.getByRole("heading", { name: "Debt securities statistics", level: 1, exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Tables & dashboards", exact: true })).toHaveAttribute("aria-current", "page");
    });

    await test.step("6. Verify Global, Country, and Climate finance tabs with Global active", async () => {
      await expect(tables.getByRole("tab")).toHaveText(["Global", "Country", "Climate finance"]);
      await expect(tables.getByRole("tab", { name: "Global", exact: true })).toHaveAttribute("aria-selected", "true");
      for (const name of ["Country", "Climate finance"]) {
        await expect(tables.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "false");
      }
    });

    await test.step("7. Verify each DSS tab contains table cards and open a table from each", async () => {
      for (const name of ["Global", "Country", "Climate finance"]) {
        await test.step(`Verify ${name} tables`, async () => {
          const tab = tables.getByRole("tab", { name, exact: true });
          await tab.click();
          await expect(tab).toHaveAttribute("aria-selected", "true");
          await expect(tables.getByRole("tab", { selected: true })).toHaveCount(1);
          // Climate finance's panel is unnamed; only the selected panel is exposed.
          const panel = tables.getByRole("tabpanel");
          await expect(panel).toHaveCount(1);
          await verifyTableCards(page, panel, DSS_PATH);
        });
      }
    });
  });
});
