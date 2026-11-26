// Users are kept apart (M4a). The seed gives a second made-up user ticks, notes, links and weekly
// notes in every section (scripts/lib/e2e-data.mjs); the owner has saved nothing yet. None of it
// may reach the owner's pages: no ticks, no counts, no text, not even in the page's hidden data.
import { E2E_OTHER_LINK, E2E_OTHER_NOTE } from "../../scripts/lib/e2e-data.mjs";
import { expect, test } from "./fixtures";
import { SECTION_PAGES, gotoReady } from "./helpers";

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
});
