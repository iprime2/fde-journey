// Notes, links and the weekly notes. Every test here saves, so each uses its own items, different
// on desktop and phone (helpers.ts); the weekly notes are a single record, so only one project
// writes them.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { EXAMPLE_LINK, EXAMPLE_NOTE, forProject, gotoReady, isPhone } from "./helpers";

const isSaveRequest = (request: { method(): string; headers(): Record<string, string> }) =>
  request.method() === "POST" && !!request.headers()["next-action"];

/** Empties a row's note and link, so a retried run starts clean. */
async function clearNote(page: Page, row: Locator, title: string) {
  const edit = row.getByRole("button", { name: "Edit note" });
  if (!(await edit.isVisible())) return;
  await edit.click();
  for (const field of [row.getByRole("textbox", { name: `Note for ${title}` }), row.getByRole("textbox", { name: `Link for ${title}` })]) {
    if ((await field.inputValue()) === "") continue;
    await field.fill("");
    await field.blur();
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();
  }
  await row.getByRole("button", { name: "Hide note" }).click();
  await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();
}

test.describe("notes", () => {
  test("a note saves after a pause and on blur, survives a reload, and can be edited and hidden", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-1", title: "Complete system requirements and architecture" },
      { id: "p2-1", title: "Integrate Prometheus metrics and application logs" },
    );
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    // Opening the editor focuses the note.
    const button = row.getByRole("button", { name: "Add note" });
    await button.click();
    await expect(row.getByRole("button", { name: "Hide note" })).toHaveAttribute("aria-expanded", "true");
    const note = row.getByRole("textbox", { name: `Note for ${item.title}` });
    await expect(note).toBeFocused();

    // Saves after typing stops, while the field still has focus.
    await note.pressSequentially(EXAMPLE_NOTE);
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();
    await expect(note).toBeFocused();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByRole("button", { name: "Edit note" })).toBeVisible();
    await expect(row.getByText(EXAMPLE_NOTE)).toBeVisible();

    // Edit, then leave the field: the save starts at once, not after the 800 ms pause.
    await row.getByRole("button", { name: "Edit note" }).click();
    await expect(note).toHaveValue(EXAMPLE_NOTE);
    await note.fill(`${EXAMPLE_NOTE} Edited.`);
    const saveRequest = page.waitForRequest(isSaveRequest, { timeout: 500 });
    await note.blur();
    await saveRequest;
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();

    // Escape closes the editor and returns focus to the button.
    await note.focus();
    await page.keyboard.press("Escape");
    const edit = row.getByRole("button", { name: "Edit note" });
    await expect(edit).toBeFocused();
    await expect(edit).toHaveAttribute("aria-expanded", "false");
    await expect(note).toBeHidden();
    await expect(row.getByText(`${EXAMPLE_NOTE} Edited.`)).toBeVisible();

    // Hide note closes it too.
    await edit.click();
    await row.getByRole("button", { name: "Hide note" }).click();
    await expect(note).toBeHidden();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByText(`${EXAMPLE_NOTE} Edited.`)).toBeVisible();
    await clearNote(page, row, item.title);
  });

  test("a link must be https: bad links show the error and aren't saved; a good one becomes a link", async ({ page }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "p1-2", title: "Implement document ingestion and asynchronous processing" },
      { id: "p2-2", title: "Build incident investigation workflow" },
    );
    await gotoReady(page, "/projects");
    const row = page.locator(`#item-${item.id}`);
    await clearNote(page, row, item.title);

    await row.getByRole("button", { name: "Add note" }).click();
    const link = row.getByRole("textbox", { name: `Link for ${item.title}` });
    for (const bad of ["javascript:alert(1)", "http://example.com/demo"]) {
      await link.fill(bad);
      await link.blur();
      const error = row.getByText("Links must start with https://");
      await expect(error).toBeVisible();
      await expect(link).toHaveAttribute("aria-invalid", "true");
      await expect(link).toHaveAttribute("aria-describedby", (await error.getAttribute("id")) ?? "");
    }
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(row.getByRole("button", { name: "Add note" })).toBeVisible();

    await row.getByRole("button", { name: "Add note" }).click();
    await link.fill(EXAMPLE_LINK);
    await link.blur();
    await expect(row.getByText("Saved", { exact: true })).toBeVisible();
    await expect(link).not.toHaveAttribute("aria-invalid", "true");

    await page.reload();
    await page.waitForLoadState("networkidle");
    const preview = row.getByRole("link", { name: new RegExp(EXAMPLE_LINK.replaceAll(".", "\\.")) });
    await expect(preview).toHaveAttribute("href", EXAMPLE_LINK);
    await expect(preview).toHaveAttribute("target", "_blank");
    await clearNote(page, row, item.title);
  });
});

test.describe("weekly notes", () => {
  test("save and survive a reload", async ({ page }, testInfo) => {
    // One record shared by both projects: desktop writes it; the phone run checks the offline state.
    test.skip(isPhone(testInfo), "the weekly notes are one record; the desktop run saves them");
    await gotoReady(page, "/career");
    const journal = page.getByRole("textbox", { name: "Weekly notes" });
    const text = "Week of 30 Nov: finished Phase 1. Next: the retrieval prototype.";
    await journal.fill(text);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(journal).toHaveValue(text);

    await journal.fill("");
    await journal.blur();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  });

  test("become read-only offline and keep what is there", async ({ page, context }) => {
    await gotoReady(page, "/career");
    const journal = page.getByRole("textbox", { name: "Weekly notes" });
    await expect(journal).toBeEditable();
    await context.setOffline(true);
    await expect(journal).not.toBeEditable();
    await context.setOffline(false);
    await expect(journal).toBeEditable();
  });
});
