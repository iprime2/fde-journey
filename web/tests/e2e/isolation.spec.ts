// Users are kept apart (M4a). The seed gives a second made-up user ticks, notes, links and weekly
// notes in every section (scripts/lib/e2e-data.mjs); the owner has saved nothing yet. None of it
// may reach the owner's pages: no ticks, no counts, no text, not even in the page's hidden data.
import { E2E_OTHER_LINK, E2E_OTHER_NOTE } from "../../scripts/lib/e2e-data.mjs";
import { expect, test } from "./fixtures";
import { SECTION_PAGES, gotoReady, isPhone } from "./helpers";

// The note's apostrophe is escaped in HTML, so search for a part without it.
const NOTE_PART = E2E_OTHER_NOTE.slice(E2E_OTHER_NOTE.indexOf("made-up"));

test.describe("another user's progress", () => {
  // Needs the owner to have saved nothing yet, so it runs before every test that saves.
  test("never shows on the owner's pages", { tag: "@fresh" }, async ({ page }) => {
    for (const section of SECTION_PAGES) {
      await gotoReady(page, section.path);
      await expect(page.getByRole("checkbox", { checked: true }), `${section.path}: no ticks`).toHaveCount(0);
      const html = await page.content();
      expect(html, `${section.path}: no note text`).not.toContain(NOTE_PART);
      expect(html, `${section.path}: no link`).not.toContain(E2E_OTHER_LINK);
    }
    await gotoReady(page, "/career");
    await expect(page.getByRole("textbox", { name: "Weekly notes" })).toHaveValue("");
  });

  // Counts catch a tick-only leak that sits in a collapsed section, out of sight of the checks above.
  test("leaves every done count at 0", { tag: "@fresh" }, async ({ page }, testInfo) => {
    await gotoReady(page, "/");
    const tiles = page.getByRole("region", { name: "Summary" }).getByRole("link");
    await expect(tiles).toHaveCount(7);
    for (let i = 0; i < 7; i++) await expect(tiles.nth(i)).toHaveAccessibleName(/^(0%|0 of \d+ done),/);
    if (!isPhone(testInfo)) {
      // The sidebar shows a count beside each section (the phone bar has none).
      const counted = page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: / of \d+ done$/ });
      await expect(counted).toHaveCount(7);
      for (let i = 0; i < 7; i++) await expect(counted.nth(i)).toHaveAccessibleName(/ 0 of \d+ done$/);
    }
    // The other user's course (cr4) gives a badge, so a leak would show in either fact.
    await gotoReady(page, "/courses");
    const fact = (label: string) => page.locator("header dl > div").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");
    await expect(fact("Done")).toHaveText(/^0 of \d+$/);
    await expect(fact("Badges earned")).toHaveText(/^0 of \d+$/);
  });

  // M5a: the other users' items were all done this week, so any leak would fill Insights.
  test("never reaches Insights or Home's Insights line", { tag: "@fresh" }, async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: "This week: 0 done · no streak yet Insights" })).toBeVisible();
    await gotoReady(page, "/insights");
    await expect(page.getByText("0 items done this week, 0 last week")).toBeAttached();
    await expect(page.getByRole("img", { name: /^Bar chart/ })).toHaveCount(0);
    await expect(page.getByRole("img", { name: /^Calendar/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "This month" }).locator("dd")).toHaveText(["0", "0"]);
    // Holds on any date: outside the roadmap's dates the card has no count at all.
    const phase = page.getByRole("region", { name: "Current phase" });
    await expect(phase).toBeVisible();
    await expect(phase.getByText(/^[1-9]\d* of \d+ done$/)).toHaveCount(0);
    if ((await phase.getByText(/ of \d+ done$/).count()) > 0) await expect(phase.getByText(/^0 of \d+ done$/)).toBeAttached();
    await expect(page.getByRole("region", { name: "Certifications" }).getByText(/^[1-9]\d* of \d+ (done|passed)$/)).toHaveCount(0);
  });
});
