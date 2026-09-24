import { expect, test, type Page } from "@playwright/test";

const CASES = [
  {
    step: 1,
    frequencies: ["Annual", "Quarterly", "Monthly"],
    path: "/topics/CBTA/BIS%2CWS_CBTA%2C1.0/M.DK.B.XDC.DKK.B?view=chart&additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.8%2B2.0.2.6.0%257CBIS%2CWS_CPMI_INSTITUT%2C1.0%255EA.CH.CB.N.C",
  },
  {
    step: 2,
    frequencies: ["Annual", "Quarterly"],
    path: "/topics/CPMI_CT/BIS,WS_CPMI_INSTITUT,1.0/A.CH.CB.N.C?additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.2.0.2.6.0",
  },
  {
    step: 3,
    frequencies: ["Monthly", "Quarterly"],
    path: "/topics/EER/BIS,WS_EER,1.0/M.R.B.DZ?additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.8.0.2.6.0",
  },
  {
    step: 4,
    frequencies: ["Monthly", "Annual"],
    path: "/topics/EER/BIS,WS_EER,1.0/M.R.B.DZ?additional_ts=BIS%2CWS_CPMI_PARTICIP%2C1.0%255EA.MX.U.MX2C.O",
  },
  {
    step: 5,
    frequencies: ["Daily", "Monthly"],
    path: "/topics/EER/BIS,WS_EER,1.0/D.N.N.CH?page=64&additional_ts=BIS%2CWS_CBPOL%2C1.0%255EM.CA",
  },
] as const;

async function verifyComparisonChart(page: Page, frequencies: readonly string[]): Promise<void> {
  const chart = page.getByRole("region", { name: "Chart", exact: true });
  const seriesList = page.getByRole("region", { name: "Time series list", exact: true });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(chart).toBeVisible();
  await expect(seriesList).toBeVisible();

  for (const frequency of frequencies) {
    await expect(seriesList.getByText(frequency, { exact: true }).first()).toBeVisible();
  }

  const listedSeries = await seriesList
    .getByRole("button", { name: /^Toggle visibility of .+ in chart$/ })
    .evaluateAll((buttons) => buttons.map((button) =>
      button.getAttribute("aria-label")!.replace(/^Toggle visibility of | in chart$/g, ""),
    ));
  expect(listedSeries.length, "The comparison must list at least two time series").toBeGreaterThan(1);
  expect(new Set(listedSeries).size, "Listed time-series keys must be unique").toBe(listedSeries.length);

  // Plotly does not expose chart traces through accessibility roles. Inspect its
  // trace data and SVG paths to compare them with the accessible series list.
  const plottedSeries = await chart.locator(".js-plotly-plot").evaluate((plot) => {
    const plotly = plot as HTMLElement & {
      data?: Array<{ name?: string; y?: unknown[]; connectgaps?: boolean }>;
      _fullData?: Array<{ visible?: boolean | "legendonly" }>;
    };

    return (plotly.data ?? []).map((trace, index) => {
      const renderedTrace = plot.querySelectorAll<SVGGElement>(".scatterlayer .trace")[index];
      const paths = Array.from(renderedTrace?.querySelectorAll<SVGPathElement>("path.js-line") ?? []);
      return {
        name: trace.name ?? "",
        hasValues: (trace.y ?? []).some((value) => value !== null && value !== undefined),
        connectGaps: trace.connectgaps === true,
        visible: plotly._fullData?.[index]?.visible !== false &&
          plotly._fullData?.[index]?.visible !== "legendonly",
        pathCount: paths.length,
        moveCommands: paths.reduce((count, path) =>
          count + ((path.getAttribute("d") ?? "").match(/M/g)?.length ?? 0), 0),
      };
    });
  });

  expect(plottedSeries.map(({ name }) => name),
    "Every series listed below the chart must have one chart trace").toEqual(listedSeries);
  for (const series of plottedSeries) {
    expect(series.visible, `${series.name} should be visible`).toBe(true);
    expect(series.hasValues, `${series.name} should contain observations`).toBe(true);
    expect(series.connectGaps, `${series.name} should connect observations across frequencies`).toBe(true);
    expect(series.pathCount, `${series.name} should render exactly one line`).toBe(1);
    expect(series.moveCommands, `${series.name} should have no empty pieces within its rendered line`).toBe(1);
  }
}

test.describe("Time Series detail chart with different frequencies", () => {
  test("renders continuous comparison lines for all documented frequency combinations", async ({ page }) => {
    for (const { step, frequencies, path } of CASES) {
      await test.step(`${step}. Combine ${frequencies.join(", ")} time series`, async () => {
        await page.goto(path);
        await expect(page).toHaveURL((url) =>
          url.pathname === new URL(path, "https://example.test").pathname &&
          url.searchParams.has("additional_ts"),
        );
        await verifyComparisonChart(page, frequencies);
      });
    }
  });
});
