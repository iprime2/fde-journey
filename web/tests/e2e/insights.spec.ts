// Insights (M5a, design spec 10): the page for a fresh user (empty states), the made-up Insights
// user's history (charts and tables agree, hidden kinds are left out, a tick elsewhere shows after a
// reload), the navigation entries and Home's link, and no sideways scrolling. All data is made up
// (scripts/lib/e2e-data.mjs).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  E2E_EVENT_HISTORY_START,
  E2E_INSIGHTS_HIDDEN,
  E2E_INSIGHTS_READING,
  e2eInsightsExpected,
  e2eInsightsSeedFile,
  e2eIstDate,
  e2eIstMonday,
} from "../../scripts/lib/e2e-data.mjs";
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, isPhone, pageHeading } from "./helpers";

const glance = (page: Page) => page.getByRole("region", { name: "This week at a glance" });
const card = (page: Page, name: string) => page.getByRole("region", { name });
const barChart = (page: Page) => page.getByRole("img", { name: "Bar chart of items done per week, last 12 weeks" });
const calendar = (page: Page) => page.getByRole("img", { name: "Calendar of active days, last 26 weeks" });

/** A table's body rows as text cells: [row header, ...cells]. */
async function tableRows(table: Locator): Promise<string[][]> {
  const rows = table.locator("tbody tr");
  const out: string[][] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    out.push([(await row.locator("th").innerText()).trim(), ...(await row.locator("td").allInnerTexts()).map((t) => t.trim())]);
  }
  return out;
}

async function openTable(section: Locator): Promise<Locator> {
  await section.getByText("Show as table").click();
  await expect(section.getByText("Hide table")).toBeVisible();
  return section.getByRole("table");
}

/**
 * The seed's own clock (scripts/e2e-seed.mjs writes it next to the main server's test database), and
 * the expected numbers for this run: the seed places the history relative to its IST week, so a run
 * that starts in the next week (seed just before Monday 00:00 IST) expects it one week older.
 */
function seedClock(): { monday: string; today: string; shift: number } {
  const root = path.dirname(test.info().config.configFile ?? path.join(process.cwd(), "playwright.config.ts"));
  const seed = JSON.parse(readFileSync(e2eInsightsSeedFile(path.join(root, ".data", "pglite-e2e")), "utf8")) as { monday: string; today: string };
  const runMonday = e2eIstDate(e2eIstMonday(Date.now(), 0));
  const shift = Math.round((Date.parse(runMonday) - Date.parse(seed.monday)) / (7 * 86_400_000));
  return { ...seed, shift };
}

const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
const streakText = (n: number) => (n > 0 ? `${n}-week streak` : "no streak yet");

/** The number on a tile: its visible value. */
const tileValue = (tile: Locator) => tile.locator(".type-num-lg > span").first();

test.describe("a fresh user", () => {
  test("sees zeros and each block's empty state, never anyone else's ticks", { tag: "@fresh" }, async ({ page }) => {
    // The made-up owner has nothing saved yet, while Alex Other and Riley Active have items done this
    // week (scripts/e2e-seed.mjs): none of theirs may show here.
    await gotoReady(page, "/insights");
    await expect(page).toHaveTitle("Insights · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Insights");
    await expect(page.getByText(/^Mon \d{1,2} \w{3} – Sun \d{1,2} \w{3}$/)).toBeVisible();

    const tiles = glance(page).getByRole("listitem");
    await expect(tiles).toHaveCount(3);
    await expect(glance(page).getByText("0 items done this week, 0 last week")).toBeAttached();
    await expect(tiles.nth(0)).toContainText("done this week · 0 last week");
    await expect(tiles.nth(1)).toContainText(/weeks? in your current streak/);
    await expect(tiles.nth(1)).toContainText("Mark something done this week to start one.");
    for (let i = 0; i < 3; i++) await expect(tileValue(tiles.nth(i))).toHaveText("0");
    // The owner has every section on: no hidden-sections line.
    await expect(page.getByText(/^Hidden sections aren't counted here/)).toHaveCount(0);

    await expect(card(page, "Done per week")).toContainText("Nothing marked done in the last 12 weeks. Tick your first item to start your weekly chart.");
    await expect(card(page, "Done per week").getByRole("link", { name: "Go to the Roadmap" })).toHaveAttribute("href", "/roadmap");
    await expect(card(page, "Active days")).toContainText("No activity in the last 26 weeks yet.");
    await expect(barChart(page)).toHaveCount(0);
    await expect(calendar(page)).toHaveCount(0);
    await expect(page.getByText("Show as table")).toHaveCount(0);

    await expect(card(page, "This month")).toContainText("Notes you save and learning resources you finish this month will show here.");
    await expect(card(page, "Certifications").getByText("0 of 7 passed")).toBeAttached();
    await expect(card(page, "Current phase")).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});

test.describe("navigation", () => {
  test("Insights is in the sidebar right after Home", async ({ page }) => {
    test.skip(isPhone(test.info()), "desktop only");
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const links = nav.getByRole("link");
    await expect(links.nth(0)).toHaveAccessibleName("Home");
    await expect(links.nth(1)).toHaveAccessibleName("Insights");
    await links.nth(1).click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
    await expect(pageHeading(page)).toBeFocused();
    await expect(nav.getByRole("link", { name: "Insights" })).toHaveAttribute("aria-current", "page");
  });

  test("Insights is the first row of the More sheet; the bottom bar doesn't change", async ({ page }) => {
    test.skip(!isPhone(test.info()), "phone only");
    await gotoReady(page, "/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    const bar = nav.locator(":scope > ul").last();
    await expect(bar.getByRole("link")).toHaveText(["Home", "Roadmap", "Reading", "Scaler"]);
    const more = nav.getByRole("button", { name: "More" });
    await more.click();
    const insights = nav.getByRole("link", { name: "Insights", exact: true });
    await expect(insights).toBeFocused();
    await insights.click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
    // More takes the current style; the row is current when the sheet opens again.
    await expect(more).toHaveClass(/text-accent/);
    await more.click();
    await expect(nav.getByRole("link", { name: "Insights", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("Home links to Insights with this week's numbers", async ({ page }) => {
    await gotoReady(page, "/");
    const link = page.getByRole("link", { name: /^This week: \d+ done · (\d+-week streak|no streak yet) Insights$/ });
    await expect(link).toBeVisible();
    // A real 44 px target.
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL("/insights");
    await expect(pageHeading(page)).toHaveText("Insights");
  });
});

// The made-up Insights user (one per screen size and attempt) with a few weeks of history. Serial:
// the later tests change that user's saved state.
test.describe("a user with history", () => {
  test.use({ as: "insights" });
  test.describe.configure({ mode: "serial" });

  test("tiles, charts and tables show the same numbers, and only this user's", async ({ page }) => {
    const seed = seedClock();
    const E = e2eInsightsExpected(seed.shift);
    // Home's line uses the same numbers as the tiles.
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: `This week: ${E.thisWeek} done · ${streakText(E.currentStreak)} Insights` })).toBeVisible();

    await gotoReady(page, "/insights");
    const tiles = glance(page).getByRole("listitem");
    await expect(glance(page).getByText(`${items(E.thisWeek)} done this week, ${E.lastWeek} last week`)).toBeAttached();
    await expect(tileValue(tiles.nth(0))).toHaveText(String(E.thisWeek));
    await expect(tiles.nth(0)).toContainText(`done this week · ${E.lastWeek} last week`);
    await expect(tileValue(tiles.nth(1))).toHaveText(String(E.currentStreak));
    await expect(tiles.nth(1)).toContainText(/weeks? in your current streak/);
    await expect(tileValue(tiles.nth(2))).toHaveText(String(E.longestStreak));
    // A new user's sections: Projects and Career off, Scaler locked (never listed).
    await expect(page.getByText("Hidden sections aren't counted here: Projects and Career.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show them in Settings" })).toHaveAttribute("href", "/settings");

    // Done per week: the totals over the bars are the table's "Done" column, newest first.
    const weekly = card(page, "Done per week");
    await expect(barChart(page)).toBeVisible();
    const totals = (await barChart(page).locator("[data-total]").filter({ visible: true }).allInnerTexts()).map(Number);
    expect(totals).toHaveLength(12);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(E.total);
    expect(totals.at(-1)).toBe(E.thisWeek);
    await expect(weekly.getByRole("list", { name: "Colour key" }).getByRole("listitem")).toHaveText([
      "Roadmap tasks",
      "Learning resources",
      "Reading",
      "Certification prep",
      "Courses",
    ]);
    await expect(weekly.getByText(`Over the last 12 weeks you marked ${items(E.total)} done. This week so far: ${E.thisWeek}; last week: ${E.lastWeek}.`, { exact: false })).toBeAttached();
    const weekRows = await tableRows(await openTable(weekly));
    expect(weekRows.map((r) => Number(r[1]))).toEqual([...totals].reverse());
    expect(weekRows[0][0]).toMatch(/^\d{1,2} \w{3}\s+this week$/);
    // The seed's week, wherever it now sits: its three shown items, in stack order. Entries wrap
    // whole, so no line of the cell starts with the separator.
    expect(weekRows[seed.shift][2].replace(/\s+/g, " ")).toBe("Roadmap tasks 1 · Learning resources 1 · Courses 1");
    // Every separator is tied to the entry before it by a no-break space, so it can't start a line.
    const cells = await weekly.getByRole("table").locator("td").evaluateAll((tds) => tds.map((td) => td.textContent ?? ""));
    expect(cells.some((t) => t.includes("·"))).toBe(true);
    expect(cells.filter((t) => / ·/.test(t))).toEqual([]);
    expect(weekRows.map((r) => r[2]).join(" ")).not.toMatch(/Projects|Career/);
    await weekly.getByText("Hide table").click();
    await expect(weekly.getByRole("table")).toBeHidden();

    // Active days: the facts, the calendar's squares and the table agree.
    const activity = card(page, "Active days");
    await expect(calendar(page)).toBeVisible();
    const factText = await activity.locator("dd").nth(1).innerText();
    const activeDays = Number(factText.split(" ")[0]);
    const squares = calendar(page).locator("rect[data-date]");
    const counts = (await squares.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-count"))))) as number[];
    expect(counts.filter((c) => c > 0)).toHaveLength(activeDays);
    // The seed's day has its five saves (a note twice, a link, a tick and an untick) at least.
    expect(Number(await calendar(page).locator(`rect[data-date="${seed.today}"]`).getAttribute("data-count"))).toBeGreaterThanOrEqual(5);
    const dayRows = await tableRows(await openTable(activity));
    expect(dayRows).toHaveLength(26);
    expect(dayRows.reduce((sum, r) => sum + Number(r[1]), 0)).toBe(activeDays);
    // While the window reaches back to the first day of save history, the estimate line says so.
    const windowStart = e2eIstDate(e2eIstMonday(Date.now(), 25));
    await expect(activity.getByText(/^Days up to 26 Nov 2026 are estimated/)).toHaveCount(windowStart <= E2E_EVENT_HISTORY_START ? 1 : 0);

    // This month: one item with notes saved twice counts once (none once the seed's month is over).
    const sameMonth = seed.today.slice(0, 7) === e2eIstDate(new Date()).slice(0, 7);
    const notes = card(page, "This month").getByText(/^items? with a note saved$/).locator("xpath=following-sibling::dd");
    await expect(notes).toHaveText(sameMonth ? "1" : "0");
    // Certifications: the first in rank order has 2 of its 3 prep steps done.
    const certRows = card(page, "Certifications").getByRole("listitem");
    await expect(certRows).toHaveCount(7);
    await expect(certRows.first().getByText("2 of 3 done")).toBeAttached();
  });

  test("a tick on another page changes This week after a reload", async ({ page }) => {
    const E = e2eInsightsExpected(seedClock().shift);
    await gotoReady(page, "/roadmap");
    const tick = page.locator("#item-l1-6").getByRole("checkbox");
    await expect(tick).not.toBeChecked();
    await tick.click();
    await expect(tick).toBeChecked();
    await page.waitForLoadState("networkidle");
    await gotoReady(page, "/insights");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(tileValue(glance(page).getByRole("listitem").first())).toHaveText(String(E.thisWeek + 1));
    await expect(glance(page).getByText(`${items(E.thisWeek + 1)} done this week, ${E.lastWeek} last week`)).toBeAttached();
  });

  test("a section switched off leaves the charts and totals", async ({ page }) => {
    const shift = seedClock().shift;
    const noReading = e2eInsightsExpected(shift, [...E2E_INSIGHTS_HIDDEN, ...E2E_INSIGHTS_READING]);
    await gotoReady(page, "/settings");
    const reading = page.getByRole("switch", { name: "Reading" });
    await expect(reading).toBeChecked();
    await reading.click();
    await expect(reading).not.toBeChecked();
    await page.waitForLoadState("networkidle");

    await gotoReady(page, "/insights");
    await expect(page.getByText("Hidden sections aren't counted here: Reading, Projects and Career.")).toBeVisible();
    // The paper and the book no longer count (this week also has the previous test's tick).
    await expect(glance(page).getByText(`${items(noReading.thisWeek + 1)} done this week, ${noReading.lastWeek} last week`)).toBeAttached();
    const weekly = card(page, "Done per week");
    await expect(weekly.getByRole("list", { name: "Colour key" }).getByRole("listitem")).toHaveText(["Roadmap tasks", "Learning resources", "Certification prep", "Courses"]);
    const rows = await tableRows(await openTable(weekly));
    expect(rows.map((r) => r[2]).join(" ")).not.toContain("Reading");
  });

  test("never scrolls sideways, from 320 to 1920 px", async ({ page }) => {
    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/insights");
      await expect(barChart(page)).toBeVisible();
      await openTable(card(page, "Done per week"));
      await openTable(card(page, "Active days"));
      await expectNoSidewaysScroll(page);
    }
  });
});
