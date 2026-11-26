// The status gate before any page renders (proxy.ts) and where sign-in lands (/auth/continue,
// app/auth/continue/route.ts), on the capped test server. A waitlisted or suspended user must never
// see the app's frame, not even for a moment: the very first response for an app page is a
// redirect, with no app HTML. Checked at request level (redirects not followed), and in the browser
// with a watcher that notes if the app's navigation ever appears in the page. Made-up users only
// (scripts/lib/e2e-data.mjs).
import type { APIResponse, Page } from "@playwright/test";
import { e2eSpareUser } from "../../scripts/lib/e2e-data.mjs";
import { SESSION_COOKIE, screenOf, signedSessionCookie } from "./auth";
import { AVATAR_ROUTE, TEST_AVATAR_PNG } from "./avatar";
import { expect, test } from "./fixtures";
import { gotoReady, pageHeading } from "./helpers";

/** Text that only the signed-in app's frame (app/(app)/layout.tsx) has. */
const APP_FRAME = ['aria-label="Sections"', "Skip to content"];

/** One request, redirects not followed. `rsc`: as a client navigation asks for a page. */
const firstResponse = (page: Page, path: string, rsc = false) =>
  page.request.get(path, { maxRedirects: 0, headers: rsc ? { rsc: "1" } : {} });

/** A redirect to `path` (and query), with nothing of the app in the body. */
async function expectRedirect(res: APIResponse, target: string | RegExp, label: string) {
  expect(res.status(), label).toBeGreaterThanOrEqual(300);
  expect(res.status(), label).toBeLessThan(400);
  const location = new URL(res.headers().location ?? "", "http://localhost");
  const where = `${location.pathname}${location.search}`;
  if (typeof target === "string") expect(where, label).toBe(target);
  else expect(where, label).toMatch(target);
  expect(res.headers()["cache-control"], label).toBe("no-store");
  const body = await res.text();
  for (const marker of APP_FRAME) expect(body, label).not.toContain(marker);
}

/**
 * Watches every document the page loads (redirects included) and tells the test if the app's
 * navigation is ever added to one, even for a moment. Returns a check to call at the end.
 */
async function watchForAppFrame(page: Page): Promise<() => boolean> {
  let saw = false;
  await page.exposeBinding("__reportAppFrame", () => {
    saw = true;
  });
  await page.addInitScript(() => {
    const report = () => {
      if (document.querySelector('nav[aria-label="Sections"]')) (window as typeof window & { __reportAppFrame: () => void }).__reportAppFrame();
    };
    new MutationObserver(report).observe(document, { childList: true, subtree: true });
  });
  return () => saw;
}

test.describe("a waitlisted user", () => {
  test.use({ as: "waitlisted" });

  test("gets a redirect to /waitlist as the first response for app pages and the post-sign-in route", async ({ page }) => {
    for (const path of ["/", "/roadmap", "/roadmap?q=rag", "/admin", "/auth/continue", "/auth/continue?next=%2Froadmap"]) {
      await expectRedirect(await firstResponse(page, path), "/waitlist", path);
    }
    // A client navigation (an RSC request) too, and Next's page payload paths.
    await expectRedirect(await firstResponse(page, "/roadmap", true), "/waitlist", "/roadmap (rsc)");
    for (const path of ["/roadmap.rsc", "/roadmap.segments/_full.segment.rsc", "/index.rsc"]) {
      await expectRedirect(await firstResponse(page, path, true), "/waitlist", path);
    }
    // A Server Action anywhere but /waitlist is refused before it runs (403, no body).
    const action = await page.request.post("/roadmap", { maxRedirects: 0, headers: { "next-action": "made-up-action-id" } });
    expect(action.status()).toBe(403);
    expect(await action.text()).toBe("");
    // /waitlist itself is theirs.
    expect((await firstResponse(page, "/waitlist")).status()).toBe(200);
  });

  test("never sees the app's frame: typing an address, or following a link from the privacy page", async ({ page }) => {
    const sawAppFrame = await watchForAppFrame(page);
    const res = await page.goto("/roadmap");
    // The browser followed one redirect: the first response was the 307, not a page.
    const first = await res?.request().redirectedFrom()?.response();
    expect(first?.status()).toBe(307);
    await expect(page).toHaveURL("/waitlist");
    await expect(pageHeading(page)).toHaveText("You're on the waitlist");

    await gotoReady(page, "/privacy");
    await page.getByRole("link", { name: "Back to FDE Journey" }).click();
    await expect(page).toHaveURL("/waitlist");
    await expect(pageHeading(page)).toHaveText("You're on the waitlist");
    expect(sawAppFrame()).toBe(false);
  });
});

test.describe("a suspended user", () => {
  test.use({ as: "suspended" });

  // Every project shares the suspended user, and the first page that sees their session ends all
  // of them (lib/session.ts). So the redirect is to /login?error=suspended while a session is left,
  // and to /login?next=… once another test has ended it: the sign-in page either way, never the app.
  test("gets a redirect to the sign-in page as the first response, never app HTML", async ({ page }) => {
    for (const path of ["/", "/roadmap", "/waitlist"]) {
      await expectRedirect(await firstResponse(page, path), /^\/login(\?(error=suspended|next=%2F\w+))?$/, path);
    }
    await expectRedirect(await firstResponse(page, "/roadmap", true), /^\/login\?(error=suspended|next=%2Froadmap)$/, "/roadmap (rsc)");
    // The post-sign-in route ends their sessions, as any page does.
    await expectRedirect(await firstResponse(page, "/auth/continue?next=%2Froadmap"), /^\/login\?(error=suspended|next=%2Froadmap)$/, "/auth/continue");
    await expectRedirect(await firstResponse(page, "/roadmap"), "/login?next=%2Froadmap", "/roadmap after");
  });

  test("never sees the app's frame", async ({ page }) => {
    const sawAppFrame = await watchForAppFrame(page);
    await page.goto("/career");
    await expect(page).toHaveURL(/^[^?]*\/login\?(error=suspended|next=%2Fcareer)$/);
    await expect(pageHeading(page)).toHaveText("Sign in");
    expect(sawAppFrame()).toBe(false);
  });
});

test.describe("an active user", () => {
  test.use({ as: "active" });

  test("lands on the page they wanted after sign-in, with no extra hop", async ({ page }) => {
    await expectRedirect(await firstResponse(page, "/auth/continue?next=%2Freading"), "/reading", "/auth/continue");
    const res = await firstResponse(page, "/reading");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('aria-label="Sections"');
    // An unsafe next goes Home, never off the site.
    await expectRedirect(await firstResponse(page, "/auth/continue?next=https%3A%2F%2Fevil.example"), "/", "evil next");
    await expectRedirect(await firstResponse(page, "/auth/continue?next=%2F%2Fevil.example"), "/", "protocol-relative next");
    // /waitlist isn't for them.
    await expectRedirect(await firstResponse(page, "/waitlist"), "/", "/waitlist");
  });
});

test.describe("the owner", () => {
  test("lands on the page they wanted after sign-in, with no extra hop", async ({ page }) => {
    await expectRedirect(await firstResponse(page, "/auth/continue?next=%2Fadmin"), "/admin", "/auth/continue");
    const res = await firstResponse(page, "/admin");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('aria-label="Sections"');
  });
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the post-sign-in route sends them to the sign-in page", async ({ page }) => {
    await expectRedirect(await firstResponse(page, "/auth/continue?next=%2Froadmap"), "/login?next=%2Froadmap", "/auth/continue");
  });
});

test.describe("a waitlisted user who is let in", () => {
  test.use({ as: "joiner" });

  test("goes into the app on their next reload of /waitlist", async ({ page, browser, baseURL }, testInfo) => {
    const { name } = e2eSpareUser("joiner", screenOf(testInfo.project.name), testInfo.retry);
    await gotoReady(page, "/waitlist");
    await expect(pageHeading(page)).toHaveText("You're on the waitlist");
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    // The owner lets them in, in a browser of their own.
    const owner = await browser.newContext();
    try {
      await owner.route(AVATAR_ROUTE, (route) => route.fulfill({ status: 200, contentType: "image/png", body: TEST_AVATAR_PNG }));
      await owner.addCookies([{ name: SESSION_COOKIE, value: signedSessionCookie(), url: baseURL ?? "", httpOnly: true, sameSite: "Lax" }]);
      const admin = await owner.newPage();
      await gotoReady(admin, "/admin/waitlist");
      await admin.getByRole("button", { name: `Let in ${name}` }).click();
      await expect(admin.getByRole("status").filter({ hasText: `${name} was let in.` })).toBeVisible();
    } finally {
      await owner.close();
    }

    // No stale status anywhere: the very next request for /waitlist sends them Home.
    await expectRedirect(await firstResponse(page, "/waitlist"), "/", "/waitlist after let in");
    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation", { name: "Sections" }).first()).toBeAttached();
  });
});
