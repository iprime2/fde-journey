// Sign-in page messages, signing out, and the first-visit banner.
import { expect, test } from "./fixtures";
import { FIRST_VISIT_TEXT, gotoReady, isPhone, pageHeading, replaceSessionCookie } from "./helpers";

test.describe("first visit", () => {
  // Needs a test database with nothing saved yet, so it runs before every test that saves.
  test("Home welcomes a first visit while nothing is saved", { tag: "@fresh" }, async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("status").filter({ hasText: FIRST_VISIT_TEXT })).toBeVisible();
    // Home only.
    await gotoReady(page, "/roadmap");
    await expect(page.getByText(FIRST_VISIT_TEXT)).toHaveCount(0);
  });
});

test.describe("signing out", () => {
  test("Sign out lands on the sign-in page, and pages then need sign-in again", async ({ page, baseURL }, testInfo) => {
    await gotoReady(page, "/roadmap");
    // Every test shares one test session, so this browser swaps its cookie for one of its own
    // before signing out: the server's sign-out then ends nothing the other tests use. Ending a
    // real session is covered by tests/unit/auth-actions.test.ts ("owner: ends the session").
    await replaceSessionCookie(page, baseURL);
    if (isPhone(testInfo)) {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Sign out" }).click();
    } else {
      await page.getByRole("button", { name: "Sign out" }).click();
    }
    await expect(page).toHaveURL("/login?status=signed-out");
    await expect(page.getByRole("status").filter({ hasText: "You're signed out." })).toBeVisible();
    await page.goto("/roadmap");
    await expect(page).toHaveURL("/login?next=%2Froadmap");
  });
});

test.describe("sign-in page", () => {
  test.use({ signedIn: false });

  test("a GitHub account that isn't the owner's gets the not-allowed message", async ({ page }) => {
    await gotoReady(page, "/login?error=not_owner");
    await expect(page.getByRole("alert").filter({ hasText: "This GitHub account can't sign in. The app is private to its owner." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeEnabled();
  });

  test("the button keeps where the visitor was going, and explains when sign-in doesn't finish", async ({ page }) => {
    await gotoReady(page, "/roadmap?q=rag");
    await expect(page).toHaveURL("/login?next=%2Froadmap%3Fq%3Drag");
    await expect(pageHeading(page)).toHaveText("FDE Journey");
    await expect(page.locator('input[name="next"]')).toHaveValue("/roadmap?q=rag");
    // The test server has no GitHub app, so sign-in comes back with an error, keeping `next`.
    await page.getByRole("button", { name: "Sign in with GitHub" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Froadmap%3Fq%3Drag&error=/);
    await expect(page.getByRole("alert").filter({ hasText: "Sign-in didn't finish. Try again." })).toBeVisible();
  });

  test("has no navigation and no M1 leftovers", async ({ page }) => {
    await gotoReady(page, "/login");
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go to Home" })).toHaveCount(0);
    await expect(page.getByText("Sign-in isn't available yet.")).toHaveCount(0);
  });
});
