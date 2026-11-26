import { expect, test as base } from "@playwright/test";
import { SESSION_COOKIE, signedSessionCookie } from "./auth";

/**
 * Every e2e test runs signed in as the (made-up) owner unless it opts out with
 * `test.use({ signedIn: false })`.
 *
 * Every e2e test fails if the page throws or logs a console error, so hydration
 * mismatches and runtime errors cannot pass silently.
 *
 * One exception: a 404 for the page document itself (a test that visits a missing
 * address on purpose). A 404 for any asset (script, style, image, font) still fails.
 */
export const test = base.extend<{
  signedIn: boolean;
  allowedConsoleErrors: RegExp[];
  ownerSession: void;
  failOnPageErrors: void;
}>({
  signedIn: [true, { option: true }],
  /**
   * Console errors a test causes on purpose, for example the browser's "Failed to load resource"
   * when the test cuts a save request. Opt in per test with `test.use({ allowedConsoleErrors: [...] })`.
   */
  allowedConsoleErrors: [[], { option: true }],
  ownerSession: [
    async ({ context, signedIn, baseURL }, use) => {
      if (signedIn) {
        await context.addCookies([
          { name: SESSION_COOKIE, value: signedSessionCookie(), url: baseURL ?? "", httpOnly: true, sameSite: "Lax" },
        ]);
      }
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
