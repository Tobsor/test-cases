import { expect, test, type Locator, type Page } from "@playwright/test";

const SAME_UNIT_PATH =
  "/topics/IDS/BIS,WS_DEBT_SEC2_PUB,1.0/Q.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.G?additional_ts=BIS%2CWS_DEBT_SEC2_PUB%2C1.0%255EQ.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.I%2CQ.3P.PE.1.K.C.A.A.USD.K.U.A.A.A.I%2CQ.3P.4W.1.G.C.A.D.TO1.K.U.C.A.A.I";

const MIXED_UNIT_PATH =
  "/topics/IDS/BIS,WS_DEBT_SEC2_PUB,1.0/Q.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.G?additional_ts=BIS%2CWS_DEBT_SEC2_PUB%2C1.0%255EQ.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.I%257CBIS%2CWS_GLI%2C1.0%255EQ.JPY.JP.G.A.A.B.JPY%257CBIS%2CWS_CPMI_CT2%2C1.0%255EA.CH.U.CH2C.V.V.S";

function chart(page: Page): Locator {
  return page.getByRole("region", { name: "Chart", exact: true });
}

function seriesRows(page: Page): Locator {
  const list = page.getByRole("region", { name: "Time series list", exact: true });
  return list.getByRole("button").filter({
    has: page.getByRole("button", { name: /^Toggle visibility of .+ in chart$/ }),
  });
}

async function yAxes(page: Page) {
  // Plotly axes have no accessible roles. Its computed layout is the source of
  // truth for how traces are assigned to visible Y-axes.
  return chart(page).locator(".js-plotly-plot").evaluate((plot) => {
    const plotly = plot as HTMLElement & {
      data?: Array<{ name?: string; yaxis?: string }>;
      _fullLayout?: Record<string, { visible?: boolean; title?: { text?: string } }>;
    };
    const axes = Object.entries(plotly._fullLayout ?? {})
      .filter(([key, axis]) => /^yaxis\d*$/.test(key) && axis.visible !== false)
      .map(([key, axis]) => ({ key, title: axis.title?.text ?? "" }));
    const traces = (plotly.data ?? []).map((trace) => ({
      name: trace.name ?? "",
      axis: trace.yaxis ?? "y",
    }));
    return { axes, traces };
  });
}

async function expectDetailPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL((url) =>
    url.pathname === new URL(path, "https://example.test").pathname &&
    url.searchParams.get("additional_ts") ===
      new URL(path, "https://example.test").searchParams.get("additional_ts"),
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(chart(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Time series list", exact: true })).toBeVisible();
}

test.describe("Time Series detail chart Y Axes", () => {
  test("merges Y-axes by unit, unit code, and multiplier", async ({ page }) => {
    await test.step("1. Open the comparison with four matching-unit time series", async () => {
      await expectDetailPage(page, SAME_UNIT_PATH);
    });

    await test.step("2. Verify four time series have the same unit and multiplier", async () => {
      const rows = seriesRows(page);
      await expect(rows).toHaveCount(4);
      for (const row of await rows.all()) {
        await expect(row.getByText("US dollar (Millions)", { exact: true })).toBeVisible();
      }
    });

    await test.step("3. Verify matching units share one Y-axis", async () => {
      const plot = await yAxes(page);
      expect(plot.traces).toHaveLength(4);
      expect(new Set(plot.traces.map(({ axis }) => axis))).toEqual(new Set(["y"]));
      expect(plot.axes).toEqual([{ key: "yaxis", title: "Millions US dollar" }]);
    });

    await test.step("4. Open the comparison with mixed-unit time series", async () => {
      await expectDetailPage(page, MIXED_UNIT_PATH);
    });

    await test.step("5. Verify four time series include one matching-unit pair", async () => {
      const rows = seriesRows(page);
      await expect(rows).toHaveCount(4);
      await expect(rows.nth(0).getByText("US dollar (Millions)", { exact: true })).toBeVisible();
      await expect(rows.nth(1).getByText("US dollar (Millions)", { exact: true })).toBeVisible();
      await expect(rows.nth(2).getByText("Yen (Millions)", { exact: true })).toBeVisible();
      await expect(rows.nth(3).getByText("Per transaction (Thousands)", { exact: true })).toBeVisible();
    });

    await test.step("6. Verify mixed units use three Y-axes", async () => {
      const plot = await yAxes(page);
      expect(plot.traces).toHaveLength(4);
      expect(plot.traces.map(({ axis }) => axis)).toEqual(["y", "y", "y2", "y3"]);
      expect(plot.axes).toEqual([
        { key: "yaxis", title: "Millions US dollar" },
        { key: "yaxis2", title: "Millions Yen" },
        { key: "yaxis3", title: "Thousands Per transaction" },
      ]);
    });
  });
});
