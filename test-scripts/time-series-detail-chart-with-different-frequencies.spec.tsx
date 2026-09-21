import { expect, test, type Page } from "@playwright/test";

const CASES = [
  {
    name: "annual, quarterly, and monthly",
    path: "/topics/CBTA/BIS%2CWS_CBTA%2C1.0/M.DK.B.XDC.DKK.B?view=chart&additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.8%2B2.0.2.6.0%257CBIS%2CWS_CPMI_INSTITUT%2C1.0%255EA.CH.CB.N.C",
    expected: [/Monthly \[M\]/i, /Central bank total assets/i],
  },
  {
    name: "annual and quarterly",
    path: "/topics/CPMI_CT/BIS,WS_CPMI_INSTITUT,1.0/A.CH.CB.N.C?additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.2.0.2.6.0",
    expected: [/Annual \[A\]/i, /Retail payments/i],
  },
  {
    name: "monthly and quarterly",
    path: "/topics/EER/BIS,WS_EER,1.0/M.R.B.DZ?additional_ts=BIS%2CWS_DPP%2C1.0%255EQ.CH.3.8.0.2.6.0",
    expected: [/Monthly \[M\]/i, /Effective exchange rates/i],
  },
  {
    name: "monthly and annual",
    path: "/topics/EER/BIS,WS_EER,1.0/M.R.B.DZ?additional_ts=BIS%2CWS_CPMI_PARTICIP%2C1.0%255EA.MX.U.MX2C.O",
    expected: [/Monthly \[M\]/i, /Effective exchange rates/i],
  },
  {
    name: "daily and monthly",
    path: "/topics/EER/BIS,WS_EER,1.0/D.N.N.CH?page=64&additional_ts=BIS%2CWS_CBPOL%2C1.0%255EM.CA",
    expected: [/Daily \[D\]/i, /Effective exchange rates/i],
  },
];

async function gotoDetail(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

function main(page: Page) {
  return page.locator("main");
}

test.describe("Time Series detail chart with different frequencies", () => {
  for (const { name, path, expected } of CASES) {
    test(`renders a comparison chart for ${name} frequencies`, async ({ page }) => {
      await gotoDetail(page, path);

      await expect(page).toHaveURL(/additional_ts=/);
      await expect(main(page).getByRole("radio", { name: "Chart" })).toBeChecked();
      await expect(main(page).getByRole("region", { name: "Chart" })).toBeVisible();
      await expect(main(page).getByRole("region", { name: "Time series list" })).toBeVisible();
      await expect(main(page).getByRole("button", { name: "Add time series" })).toBeVisible();

      for (const text of expected) {
        await expect(main(page).getByText(text).first()).toBeVisible();
      }
    });
  }
});
