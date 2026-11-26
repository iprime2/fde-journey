import { expect, test as base } from "@playwright/test";
import { type E2eSession, type E2eUser, SESSION_COOKIE, signedSessionCookie, spareSessionToken, userSessionToken } from "./auth";
import { AVATAR_ROUTE, TEST_AVATAR_PNG } from "./avatar";

/**
 * Every e2e test runs signed in as the (made-up) owner unless it opts out with
 * `test.use({ signedIn: false })`. They share one session; a test that ends its session (signs
 * out) uses a spare one of its own: `test.use({ session: "sign-out" })` (see tests/e2e/auth.ts).
 *
 * Every e2e test fails if the page throws or logs a console error, so hydration
 * mismatches and runtime errors cannot pass silently.
 *
 * No test reaches GitHub's avatar host: every request to it gets a made-up solid-colour PNG
 * (tests/e2e/avatar.ts). A test can override that with its own `page.route(AVATAR_ROUTE, …)`.
 *
 * One exception: a 404 for the page document itself (a test that visits a missing
 * address on purpose). A 404 for any asset (script, style, image, font) still fails.
 */
export const test = base.extend<{
  signedIn: boolean;
  session: E2eSession;
  /** Who is signed in: the owner (default) or one of M4b's made-up users (tests/e2e/auth.ts). */
  as: "owner" | E2eUser;
  allowedConsoleErrors: RegExp[];
  ownerSession: void;
  avatarRoute: void;
  failOnPageErrors: void;
}>({
  signedIn: [true, { option: true }],
  session: ["shared", { option: true }],
  as: ["owner", { option: true }],
  /**
   * Console errors a test causes on purpose, for example the browser's "Failed to load resource"
   * when the test cuts a save request. Opt in per test with `test.use({ allowedConsoleErrors: [...] })`.
   */
  allowedConsoleErrors: [[], { option: true }],
  ownerSession: [
    async ({ context, signedIn, session, as, baseURL }, use, testInfo) => {
      if (signedIn) {
        const token =
          as !== "owner"
            ? userSessionToken(as, testInfo.project.name, testInfo.retry)
            : session === "shared"
              ? undefined
              : spareSessionToken(session, testInfo.project.name, testInfo.retry);
        await context.addCookies([
          { name: SESSION_COOKIE, value: signedSessionCookie(token), url: baseURL ?? "", httpOnly: true, sameSite: "Lax" },
        ]);
      }
      await use();
    },
    { auto: true },
  ],
  avatarRoute: [
    async ({ context }, use) => {
      await context.route(AVATAR_ROUTE, (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: TEST_AVATAR_PNG }),
      );
      await use();
    },
    { auto: true },
  ],
  failOnPageErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      const missingDocuments = new Set<string>();
      page.on("response", (r) => {
        if (r.status() === 404 && r.request().resourceType() === "document") missingDocuments.add(r.url());
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const expected404 = m.text().includes("status of 404") && missingDocuments.has(m.location().url);
        const allowed = allowedConsoleErrors.some((pattern) => pattern.test(m.text()));
        if (!expected404 && !allowed) errors.push(`console.error: ${m.text()} (${m.location().url})`);
      });
      await use();
      expect(errors, "page errors or console errors during the test").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
