import { expect, test, type Page } from "@playwright/test";

const CBPOL_PATH = "/topics/CBPOL/BIS,WS_CBPOL,1.0/M.BR";
const LBS_PATH = "/topics/LBS/BIS,WS_LBS_D_PUB,1.0/Q.S.C.A.TO1.A.5J.A.5A.A.5J.A";

async function expectChartAndTableColoursToMatch(page: Page): Promise<void> {
  const chartColour = await page.getByRole("region", { name: "Chart", exact: true })
    // Plotly does not expose its traces through accessibility roles.
    .locator(".js-plotly-plot")
    .evaluate((plot) => {
      const trace = (plot as HTMLElement & { data?: Array<{ line?: { color?: string } }> }).data?.[0];
      return trace?.line?.color ?? "";
    });
  const tableColour = await page.getByRole("button", {
    name: "Toggle visibility of M.BR in chart",
    exact: true,
  })
    .evaluate((button) => getComputedStyle(button.querySelector("i")!).color);

  const normalize = (colour: string) => colour.replace(/\s/g, "");
  expect(normalize(tableColour), "The table marker should use the chart line colour")
    .toBe(normalize(chartColour));
}

test.describe("Time Series Detail Page Structure", () => {
  test("renders the documented detail-page structure and LBS-specific metadata", async ({ page }) => {
    await test.step("1. Open M.BR and verify the complete time-series detail structure", async () => {
      await page.goto(CBPOL_PATH);
      const main = page.getByRole("main");
      const breadcrumb = main.getByRole("navigation", { name: "Breadcrumb" });
      const chart = main.getByRole("region", { name: "Chart", exact: true });
      const seriesList = main.getByRole("region", { name: "Time series list", exact: true });

      await expect(page).toHaveURL((url) => url.pathname === CBPOL_PATH);
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.getByRole("link", { name: "home page" })).toHaveAttribute("href", "/");
      const breadcrumbItems = await breadcrumb.evaluate((navigation) =>
        Array.from(navigation.querySelectorAll("li.breadcrumb-item"), (item) =>
          item.querySelector("a")?.getAttribute("aria-label") ?? item.textContent?.trim() ?? "",
        ),
      );
      // Back is conditional and is absent after direct navigation in this step.
      expect(breadcrumbItems).toEqual(["home page", "Topics", "CBPOL", "BIS,WS_CBPOL,1.0", "M.BR"]);

      for (const action of ["Bookmark", "Share", "Export"]) {
        await expect(main.getByRole("button", { name: action, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("heading", {
        level: 1,
        name: "Central bank policy rates, Brazil",
      })).toBeVisible();

      await expect(chart).toBeVisible();
      await expect(main.getByRole("button", { name: "1Y", exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: "5Y", exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: "All", exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: "Popover collapsed, click to expand" }))
        .toContainText("Timespan");
      await expect(main.getByRole("radio", { name: "Chart", exact: true })).toBeChecked();
      await expect(main.getByRole("radio", { name: "Observations", exact: true })).toBeVisible();

      await expect(main.getByText("Dimensions", { exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: /^Frequency filter collapsed/ }))
        .toContainText("Monthly [M]");
      await expect(main.getByRole("button", { name: /^Reference area filter collapsed/ }))
        .toContainText("Brazil [BR]");

      await expect(seriesList).toBeVisible();
      await expect(seriesList.getByText("Time series", { exact: true })).toBeVisible();
      await expect(seriesList.getByText(/Unit\s*\(Unit multiplier\)/)).toBeVisible();
      await expect(seriesList.getByText(/Start & end date\s*Frequency/)).toBeVisible();
      await expect(seriesList.getByText("Topic", { exact: true })).toBeVisible();
      await expect(seriesList.getByLabel(/^Toggle visibility of .+ in chart$/)).toHaveCount(1);
      await expect(seriesList.getByText("M.BR", { exact: true })).toBeVisible();
      await expect(seriesList.getByRole("button", { name: "Show metadata", exact: true })).toBeVisible();
      // The pin is currently a non-interactive, aria-hidden icon with no role or accessible name.
      await expect(seriesList.locator('[class*="pinIcon"]')).toBeVisible();
      await expectChartAndTableColoursToMatch(page);

      const addButton = main.getByRole("button", { name: "Add time series", exact: true });
      await expect(addButton).toBeVisible();
      const listBox = await seriesList.boundingBox();
      const addBox = await addButton.boundingBox();
      expect(listBox).not.toBeNull();
      expect(addBox).not.toBeNull();
      expect(addBox!.y, "Add time series should appear below the series table")
        .toBeGreaterThanOrEqual(listBox!.y + listBox!.height);
    });

    await test.step("2. Open the LBS series and verify its unit and pre-break action", async () => {
      await page.goto(LBS_PATH);
      const seriesList = page.getByRole("region", { name: "Time series list", exact: true });

      await expect(page).toHaveURL((url) => url.pathname === LBS_PATH);
      await expect(seriesList).toBeVisible();
      await expect(seriesList.getByText("US dollar (Millions)", { exact: true })).toBeVisible();
      await expect(seriesList.getByRole("button", { name: "Toggle pre-breaks", exact: true }))
        .toBeVisible();
    });
  });
});
