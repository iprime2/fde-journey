// Sign-in page messages, signing out, and the first-visit banner.
import type { Locator, Page, TestInfo } from "@playwright/test";
import { SESSION_COOKIE } from "./auth";
import { expect, test } from "./fixtures";
import {
  E2E_OWNER_NAME,
  FIRST_VISIT_TEXT,
  SIGN_IN_BUTTON,
  SIGNED_OUT_TEXT,
  forProject,
  gotoReady,
  isPhone,
  pageHeading,
} from "./helpers";

/** Sign out from the More sheet's account row (phone) or the sidebar's account menu (desktop). */
async function clickSignOut(page: Page, testInfo: TestInfo) {
  if (isPhone(testInfo)) {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Sign out" }).click();
  } else {
    await page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
  }
}

/** Design spec 5: messages sit above the sign-in button, inside the card. */
async function expectAboveButton(page: Page, message: Locator) {
  const [box, button] = await Promise.all([
    message.boundingBox(),
    page.getByRole("button", { name: SIGN_IN_BUTTON }).boundingBox(),
  ]);
  expect(box && button && box.y + box.height <= button.y, "message above the button").toBe(true);
}

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
  // Signs out for real, so it ends a spare session of its own: the shared session stays valid for
  // every other test (tests/e2e/auth.ts).
  test.use({ session: "sign-out" });

  test("Sign out ends the session: the sign-in page says so, and the same cookie no longer opens pages or saves", async ({ page, context }, testInfo) => {
    const item = forProject(
      testInfo,
      { id: "c6-1", title: "Study official exam guide" },
      { id: "c7-1", title: "Study official exam domains" },
    );
    // A second tab stays open on a page with tick boxes, to try a save once signed out.
    const other = await context.newPage();
    const otherErrors: string[] = [];
    other.on("pageerror", (e) => otherErrors.push(e.message));
    await gotoReady(other, "/certs");
    await gotoReady(page, "/roadmap");
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie, "signed in with a spare session").toBeDefined();

    await clickSignOut(page, testInfo);
    await expect(page).toHaveURL("/login?status=signed-out");
    const signedOut = page.getByRole("status").filter({ hasText: "You're signed out." });
    await expect(signedOut).toBeVisible();
    await expect(page.getByRole("button", { name: SIGN_IN_BUTTON })).toBeEnabled();
    await expectAboveButton(page, signedOut);
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE), "the browser dropped the cookie").toBe(false);

    // Send the same cookie again. The proxy lets it through (a cookie is present), but the session
    // behind it has ended, so the page sends the visitor to sign in.
    await context.addCookies([cookie!]);
    await page.goto("/roadmap");
    await expect(page).toHaveURL("/login?next=%2Froadmap");
    await expect(page.getByRole("button", { name: SIGN_IN_BUTTON })).toBeEnabled();

    // A save from the tab that stayed open, with that cookie, is refused as signed out, and the tab
    // stays where it is: the signed-out alert shows in place, nothing navigates it away.
    await context.addCookies([cookie!]);
    const row = other.locator(`#item-${item.id}`);
    const tick = row.getByRole("checkbox", { name: `Mark done: ${item.title}` });
    await expect(tick).not.toBeChecked();
    const documents: string[] = [];
    other.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === other.mainFrame()) documents.push(r.url());
    });
    // The save's answer, read by the test runner as it passes (route.fetch), so nothing the page
    // does afterwards can take the body away before it is checked.
    let saveAnswer!: (body: string) => void;
    const answered = new Promise<string>((resolve) => (saveAnswer = resolve));
    await other.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) return route.fallback();
      const response = await route.fetch();
      const body = await response.text();
      saveAnswer(body);
      await route.fulfill({ response, body });
    });
    await tick.click();
    expect(await answered).toContain('"code":"signed-out"');
    await expect(other.getByRole("alert").filter({ hasText: SIGNED_OUT_TEXT })).toBeVisible();
    await expect(tick).not.toBeChecked();
    await expect(other).toHaveURL(/\/certs$/);
    expect(documents, "the tab that stayed open loaded no other page").toEqual([]);
    // The tab's own background requests (the router's fetches) are answered as before the status
    // gate: not redirected to /login, which Next's router can turn into a full-page navigation,
    // and the cookie is not expired by them.
    const background = await other.evaluate(async () => {
      const res = await fetch("/roadmap");
      return { redirected: res.redirected, status: res.status };
    });
    expect(background).toEqual({ redirected: false, status: 200 });
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE), "a background request kept the cookie").toBe(true);
    expect(otherErrors).toEqual([]);
    await other.close();
  });
});

test.describe("signed in", () => {
  test("opening the sign-in page goes on to where the visitor was going, or Home", async ({ page }) => {
    await page.goto("/login?next=%2Freading");
    await expect(page).toHaveURL("/reading");
    await expect(pageHeading(page)).toHaveText("Reading");

    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await expect(pageHeading(page)).toHaveText("FDE Journey");

    // Only paths on this site: anything else goes Home.
    await page.goto("/login?next=%2F%2Fevil.example");
    await expect(page).toHaveURL("/");
    await page.goto("/login?status=signed-out&next=https%3A%2F%2Fevil.example%2Froadmap");
    await expect(page).toHaveURL("/");
    // Dot segments that would collapse to "//evil.example" once parsed.
    await page.goto(`/login?next=${encodeURIComponent("/.//evil.example")}`);
    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-in page", () => {
  test.use({ signedIn: false });

  // The test server runs in capped mode (read at request time), where nobody is turned away for
  // not being the owner: a stray not_owner code reads as a sign-in that didn't finish (design
  // spec 8). The owner-only wording is covered by tests/unit/login.test.ts.
  test("a stray not-allowed code in capped mode says sign-in didn't finish", async ({ page }) => {
    await gotoReady(page, "/login?error=not_owner");
    const alert = page.getByRole("alert").filter({ hasText: "Sign-in didn't finish. Try again." });
    await expect(alert).toBeVisible();
    await expect(page.getByRole("button", { name: SIGN_IN_BUTTON })).toBeEnabled();
    await expectAboveButton(page, alert);
  });

  test("the button keeps where the visitor was going, and explains when sign-in doesn't finish", async ({ page }) => {
    await gotoReady(page, "/roadmap?q=rag");
    await expect(page).toHaveURL("/login?next=%2Froadmap%3Fq%3Drag");
    await expect(pageHeading(page)).toHaveText("Sign in");
    await expect(page.locator('input[name="next"]')).toHaveValue("/roadmap?q=rag");
    // The test server has no GitHub app, so sign-in comes back with an error, keeping `next`.
    await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Froadmap%3Fq%3Drag&error=/);
    const alert = page.getByRole("alert").filter({ hasText: "Sign-in didn't finish. Try again." });
    await expect(alert).toBeVisible();
    await expectAboveButton(page, alert);
  });

  test("has no navigation and no M1 leftovers", async ({ page }) => {
    await gotoReady(page, "/login");
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go to Home" })).toHaveCount(0);
    await expect(page.getByText("Sign-in isn't available yet.")).toHaveCount(0);
  });
});
