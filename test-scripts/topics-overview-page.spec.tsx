import { expect, test } from "@playwright/test";

// Expected taxonomy and display order, verified against the live site on 24 September 2026.
const TOPIC_GROUPS = [
  { parent: "International banking", topics: [
    { id: "LBS", name: "Locational banking statistics" },
    { id: "CBS", name: "Consolidated banking statistics" },
  ] },
  { parent: "Debt securities", topics: [
    { id: "DSS", name: "Debt securities statistics" },
    { id: "IDS", name: "International debt securities (BIS-compiled)" },
  ] },
  { parent: "Credit", topics: [
    { id: "TOTAL_CREDIT", name: "Credit to the non-financial sector" },
    { id: "CREDIT_GAPS", name: "Credit-to-GDP gaps" },
    { id: "DSR", name: "Debt service ratios" },
  ] },
  { parent: "Global liquidity", topics: [{ id: "GLI", name: "Global liquidity" }] },
  { parent: "Derivatives", topics: [
    { id: "XTD_DER", name: "Exchange-traded derivatives statistics" },
    { id: "OTC_DER", name: "OTC derivatives outstanding" },
    { id: "DER", name: "Triennial Survey" },
  ] },
  { parent: "Property prices", topics: [
    { id: "RPP", name: "Residential property prices" },
    { id: "CPP", name: "Commercial property prices" },
  ] },
  { parent: "Consumer prices", topics: [{ id: "CPI", name: "Consumer prices" }] },
  { parent: "Exchange rates", topics: [
    { id: "XRU", name: "Bilateral exchange rates" },
    { id: "EER", name: "Effective exchange rates" },
  ] },
  { parent: "Central bank statistics", topics: [
    { id: "CBTA", name: "Central bank total assets" },
    { id: "CBPOL", name: "Central bank policy rates" },
  ] },
  { parent: "Payment statistics", topics: [
    { id: "CPMI_CT", name: "Retail payments, currency and related indicators" },
    { id: "CPMI_FMI", name: "Financial market infrastructures and critical service providers" },
  ] },
];
const TOPICS = TOPIC_GROUPS.flatMap(({ topics }) => topics);
const OVERVIEW_HEADINGS: Record<string, string> = {
  GLI: "Global liquidity indicators",
  OTC_DER: "OTC derivatives statistics",
};

test.describe("Topics Overview Page", () => {
  test("lists all parent chips and grouped leaf cards and opens every topic overview", async ({ page }) => {
    test.setTimeout(180_000);
    const main = page.getByRole("main");
    const chips = main.getByRole("radiogroup", { name: "Topics filter chips", exact: true });
    const topicsList = main.getByRole("region", { name: "Topics list", exact: true });
    const cardFor = (name: string) => topicsList.getByRole("article").filter({
      has: page.getByRole("heading", { name, level: 2, exact: true }),
    });

    await test.step("1. Go to /topics", async () => {
      await page.goto("/topics");
      await expect(main.getByRole("heading", { name: "BIS statistics", level: 1, exact: true })).toBeVisible();
      await expect(page).toHaveTitle("BIS statistics | BIS Data Portal");
    });

    await test.step("2. Verify all ten parent-topic chips", async () => {
      await expect(chips.getByRole("radio")).toHaveCount(10);
      await expect(chips.getByRole("radio")).toHaveText(TOPIC_GROUPS.map(({ parent }) => parent));
      for (const { parent } of TOPIC_GROUPS) {
        await expect(chips.getByRole("radio", { name: `Sort for items related to ${parent}`, exact: true })).toBeVisible();
      }
    });

    await test.step("3. Verify all twenty leaf-topic cards and their overview links", async () => {
      await expect(topicsList.getByRole("article")).toHaveCount(20);
      for (const { name, id } of TOPICS) {
        const card = cardFor(name);
        await expect(card).toHaveCount(1);
        await expect(card.getByRole("heading", { name, level: 2, exact: true })).toBeVisible();
        await expect(card.getByRole("link")).toHaveCount(1);
        await expect(card.getByRole("link")).toHaveAttribute("href", `/topics/${id}`);
      }
    });

    await test.step("4. Verify leaf cards follow parent-topic order", async () => {
      await expect(topicsList.getByRole("heading", { level: 2 })).toHaveText(TOPICS.map(({ name }) => name));
    });

    await test.step("5. Open every leaf card and verify its topic overview", async () => {
      for (const { name, id } of TOPICS) {
        await test.step(`Open ${name} (${id})`, async () => {
          await cardFor(name).getByRole("link").click();
          await expect(page).toHaveURL((url) => url.pathname === `/topics/${id}` && url.search === "" && url.hash === "");
          const overviewTitle = OVERVIEW_HEADINGS[id] ?? name;
          const headingName = new RegExp(`^${overviewTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
          await expect(main.getByRole("heading", { name: headingName, level: 1 })).toBeVisible();
          const overview = main.getByRole("navigation", { name: "Page navigation", exact: true })
            .getByRole("link", { name: "Overview", exact: true });
          await expect(overview).toHaveAttribute("aria-current", "page");
          await expect(overview).toHaveAttribute("href", `/topics/${id}`);
          await page.goBack();
          await expect(page).toHaveURL((url) => url.pathname === "/topics");
          await expect(topicsList.getByRole("article")).toHaveCount(20);
        });
      }
    });
  });
});
