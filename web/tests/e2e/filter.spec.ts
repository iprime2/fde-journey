import { expect, test } from "./fixtures";
import { gotoReady, pageHeading } from "./helpers";

test.describe("search and status filter", () => {
  test("search filters rows, opens matching resource lists and is kept in the URL", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const search = page.getByRole("searchbox", { name: "Search this page" });
    await search.fill("cs50p");
    await expect(page).toHaveURL(/\/roadmap\?q=cs50p$/);

    // The matching resources show inside their task's opened list; other tasks are hidden.
    await expect(page.getByRole("link", { name: /CS50P Lectures 0–2/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Mark done: Python for AI, FastAPI, Pydantic and async programming" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Mark done: Embeddings and vector databases" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Phase 2 · RAG and retrieval" })).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: /^\d+ items? shown$/ })).toHaveText("3 items shown");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("cs50p");
    await expect(page.getByRole("checkbox", { name: "Mark done: Embeddings and vector databases" })).toBeHidden();
  });

  // Expects nothing on the Roadmap to be ticked or noted, so it runs before the tests that save.
  test("status filter, empty state and clearing", { tag: "@fresh" }, async ({ page }) => {
    await gotoReady(page, "/roadmap?q=qdrant");
    const show = page.getByRole("combobox", { name: "Show" });
    await show.selectOption("done");
    await expect(page).toHaveURL(/\/roadmap\?q=qdrant&status=done$/);
    await expect(page.getByText("Nothing matches this search or filter.")).toBeVisible();

    await page.getByRole("button", { name: "Clear search and filter" }).click();
    await expect(page).toHaveURL(/\/roadmap$/);
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("");
    // The button is gone, so focus moves to the search field rather than the page body.
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toBeFocused();
    await expect(show).toHaveValue("all");
    await expect(page.getByRole("heading", { name: "Phase 8 · Portfolio and career" })).toBeVisible();

    await show.selectOption("open");
    await expect(page).toHaveURL(/\/roadmap\?status=open$/);
    await expect(page.getByRole("heading", { name: "Phase 1 · Foundations" })).toBeVisible();

    await show.selectOption("noted");
    await expect(page.getByText("No notes yet.")).toBeVisible();

    // Nothing is ticked on the page and there is no search: say so, rather than "no match".
    await show.selectOption("done");
    await expect(page.getByText("Nothing marked done yet.")).toBeVisible();
    await expect(page.getByText("Nothing matches this search or filter.")).toBeHidden();
  });

  test("a search typed just before leaving is in the URL after Back", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    // Leave within the 300 ms the URL waits for typing to stop.
    await page.getByRole("searchbox", { name: "Search this page" }).fill("rag");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: /^Reading/ }).click();
    await expect(pageHeading(page)).toHaveText("Reading");
    await page.goBack();
    await expect(page).toHaveURL(/\/roadmap\?q=rag$/);
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("rag");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("rag");
  });

  test("Back returns to the filtered page", async ({ page }) => {
    await gotoReady(page, "/scaler");
    await page.getByRole("searchbox", { name: "Search this page" }).fill("kafka");
    await expect(page).toHaveURL(/\/scaler\?q=kafka$/);
    await expect(page.getByRole("heading", { name: "Module 1 · The FDE Launchpad" })).toBeHidden();

    // Client navigation to another section, then the browser's Back button.
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: /^Reading/ }).click();
    await expect(pageHeading(page)).toHaveText("Reading");
    await page.goBack();
    await expect(page).toHaveURL(/\/scaler\?q=kafka$/);
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("kafka");
    await expect(page.getByRole("heading", { name: "Module 7 · The Scale Question" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Module 1 · The FDE Launchpad" })).toBeHidden();

    // The page Back left is untouched by the filter it saw in passing.
    await page.goForward();
    await expect(page).toHaveURL(/\/reading$/);
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("");

    // A link to the plain page shows it unfiltered.
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: /^Scaler/ }).click();
    await expect(page).toHaveURL(/\/scaler$/);
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Module 1 · The FDE Launchpad" })).toBeVisible();
  });

  test("weekly notes stay under All items and With notes only", async ({ page }) => {
    await gotoReady(page, "/career?status=noted");
    await expect(page.getByRole("heading", { name: "Weekly notes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Career milestones" })).toBeHidden();
    await page.getByRole("combobox", { name: "Show" }).selectOption("open");
    await expect(page.getByRole("heading", { name: "Weekly notes" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Career milestones" })).toBeVisible();
  });
});
