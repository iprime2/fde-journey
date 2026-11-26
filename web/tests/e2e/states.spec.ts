import { expect, test } from "./fixtures";
import { READ_ONLY_TEXT, SECTION_PAGES, SIGN_IN_BUTTON, expectNoSidewaysScroll, gotoReady, pageHeading } from "./helpers";

test.describe("signed in as the owner", () => {
  for (const s of SECTION_PAGES) {
    test(`${s.path} renders without the read-only banner and fits the screen`, async ({ page }) => {
      await gotoReady(page, s.path);
      await expect(pageHeading(page)).toHaveText(s.h1);
      await expect(page).toHaveTitle(s.title);
      await expect(page.getByText(READ_ONLY_TEXT)).toHaveCount(0);
      await expectNoSidewaysScroll(page);
    });
  }

  test("tick boxes and weekly notes are enabled", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    const tick = page.getByRole("checkbox", { name: "Mark done: Python for AI, FastAPI, Pydantic and async programming" });
    await expect(tick).toBeEnabled();
    await expect(tick).not.toBeChecked();

    await gotoReady(page, "/career");
    await expect(page.getByRole("textbox", { name: "Weekly notes" })).toBeEnabled();
  });

  test("works at 320 px wide without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ["/", "/roadmap", "/scaler", "/certs"]) {
      await gotoReady(page, path);
      await expectNoSidewaysScroll(page);
    }
  });
});

test.describe("Home", () => {
  test("shows tiles, the current phase and the countdown", async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: /roadmap milestones/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Certifications passed/ })).toHaveAttribute("href", "/certs");
    await expect(page.getByText(/^Phase \d · /).first()).toBeVisible();
    await expect(page.getByText(/^(In class now \(until 11:30 IST\)|Today, 09:00 IST|(Mon|Wed|Fri) \d{1,2} \w{3}, 09:00 IST)$/)).toBeVisible();
    await expect(page.getByText(/^(15 Feb 2027 · \d+ days? left|Today|15 Feb 2027 \(passed\))$/)).toBeVisible();
  });

  test("Up next links go to the task on the roadmap", async ({ page }) => {
    await gotoReady(page, "/");
    const next = page.getByRole("region", { name: /^Phase / }).getByRole("link").first();
    const title = (await next.innerText()).replace(/^→\s*/, "").trim();
    await next.click();
    await expect(page).toHaveURL(/\/roadmap#item-l\d+-\d+$/);
    await expect(page.getByRole("checkbox", { name: `Mark done: ${title}` })).toBeInViewport();
  });
});

test.describe("other pages", () => {
  test("unknown addresses show the not-found page", async ({ page }) => {
    const response = await gotoReady(page, "/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(pageHeading(page)).toHaveText("This page doesn't exist.");
    await expect(page).toHaveTitle("Page not found · FDE Journey");
    // The lockup names the app; it is text, not a heading or a link.
    await expect(page.getByText("FDE Journey", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "FDE Journey" })).toHaveCount(0);
    await page.getByRole("link", { name: "Go to Home" }).click();
    await expect(page).toHaveURL("/");
    await expect(pageHeading(page)).toHaveText("FDE Journey");
  });

  test.describe("signed out", () => {
    // A signed-in owner opening /login goes straight on to Home (session.spec.ts).
    test.use({ signedIn: false });

    test("sign-in page offers GitHub sign-in and fits the screen", async ({ page }) => {
      await gotoReady(page, "/login");
      await expect(pageHeading(page)).toHaveText("Sign in");
      await expect(page.getByRole("button", { name: SIGN_IN_BUTTON })).toBeEnabled();
      await expectNoSidewaysScroll(page);
    });
  });
});

test.describe("connection", () => {
  test("warns when offline, then says it's back online", async ({ page, context }) => {
    await gotoReady(page, "/roadmap");
    const offline = page.getByRole("status").filter({ hasText: /^You're offline\./ });
    await context.setOffline(true);
    await expect(offline).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search this page" })).toBeEnabled();
    // Ticks can't save offline, so they are disabled; notes can still be opened and read.
    const tick = page.getByRole("checkbox", { name: "Mark done: Python for AI, FastAPI, Pydantic and async programming" });
    await expect(tick).toBeDisabled();
    await expect(page.locator("#item-l1-1").getByRole("button", { name: "Add note" })).toBeEnabled();

    await context.setOffline(false);
    await expect(offline).toBeHidden();
    const back = page.getByRole("status").filter({ hasText: "Back online." });
    await expect(back).toBeVisible();
    await expect(back).toBeHidden({ timeout: 6000 });
    await expect(tick).toBeEnabled();
  });
});
