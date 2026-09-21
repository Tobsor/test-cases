import { expect, test, type Page } from "@playwright/test";

const SAME_UNIT_URL =
  "/topics/IDS/BIS,WS_DEBT_SEC2_PUB,1.0/Q.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.G?additional_ts=BIS%2CWS_DEBT_SEC2_PUB%2C1.0%255EQ.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.I%2CQ.3P.PE.1.K.C.A.A.USD.K.U.A.A.A.I%2CQ.3P.4W.1.G.C.A.D.TO1.K.U.C.A.A.A.I";

const MIXED_UNIT_URL =
  "/topics/IDS/BIS,WS_DEBT_SEC2_PUB,1.0/Q.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.G?additional_ts=BIS%2CWS_DEBT_SEC2_PUB%2C1.0%255EQ.3P.1Z.1.B.C.A.A.TO1.C.A.C.A.A.I%257CBIS%2CWS_GLI%2C1.0%255EQ.JPY.JP.G.A.A.B.JPY%257CBIS%2CWS_CPMI_CT2%2C1.0%255EA.CH.U.CH2C.V.V.S";

async function gotoDetail(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Time Series detail chart Y Axes", () => {
  test("renders same-unit and mixed-unit comparison charts", async ({ page }) => {
    await test.step("same-unit comparison chart uses a shared unit label", async () => {
      await gotoDetail(page, SAME_UNIT_URL);

      await expect(page).toHaveURL(/additional_ts=/);
      await expect(main(page).getByRole("radio", { name: "Chart" })).toBeChecked();
      await expect(main(page).getByRole("region", { name: "Chart" })).toBeVisible();
      await expect(main(page).getByRole("region", { name: "Time series list" })).toBeVisible();
      await expect(main(page).getByText("Millions US dollar")).toBeVisible();
      await expect(main(page).getByText("Net issues").first()).toBeVisible();
    });

    await test.step("mixed-unit comparison chart renders multiple units in the detail view", async () => {
      await gotoDetail(page, MIXED_UNIT_URL);

      await expect(page).toHaveURL(/additional_ts=/);
      await expect(main(page).getByRole("radio", { name: "Chart" })).toBeChecked();
      await expect(main(page).getByRole("region", { name: "Chart" })).toBeVisible();
      await expect(main(page).getByRole("region", { name: "Time series list" })).toBeVisible();
      await expect(main(page).getByText(/Millions US dollar|US dollar/i).first()).toBeVisible();
      await expect(main(page).getByText(/Yen|JPY|Swiss franc|Value/i).first()).toBeVisible();
    });
  });
});
