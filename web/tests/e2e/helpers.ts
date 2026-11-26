import { type Locator, type Page, type TestInfo, expect } from "@playwright/test";
import { SESSION_COOKIE } from "./auth";

/** Open a page and wait until it is interactive (hydrated), so typing and toggles are not lost. */
export async function gotoReady(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState("networkidle");
  return response;
}

/** The phone projects ("phone" and "phone-fresh"). */
export const isPhone = (testInfo: TestInfo) => testInfo.project.name.startsWith("phone");

/**
 * Desktop and phone run each test at the same time against the same test database, so a test that
 * saves must use different items on each: `forProject(testInfo, desktopValue, phoneValue)`.
 */
export const forProject = <T>(testInfo: TestInfo, desktop: T, phone: T): T => (isPhone(testInfo) ? phone : desktop);

export const READ_ONLY_TEXT = "Read-only. Sign in to save ticks and notes.";
export const FIRST_VISIT_TEXT = "Nothing ticked yet. Tick items as you finish them and your progress will show here.";
export const SAVE_FAILED_TEXT = "A change wasn't saved. Check your connection, then use Try again next to it.";
export const SIGNED_OUT_TEXT = "You were signed out, so that change wasn't saved.";
/** A note or weekly notes change waiting for the connection. */
export const WAITING_TEXT = "Not saved yet. Saves when you're back online.";
/** Made-up example note from the design spec. */
export const EXAMPLE_NOTE = "Finished the quickstart. Next: try hybrid search on the sample set.";
export const EXAMPLE_LINK = "https://example.com/demo";

/**
 * What a note area (a row's note, or the weekly notes) announces: its live region, which is
 * visually hidden and holds "Saved", "Not saved.", "Not saved yet…" and field problems.
 */
export const announced = (scope: Locator) => scope.getByRole("status");

/**
 * A status line as shown on screen, matched exactly. Its words are aria-hidden (screen readers
 * get them from `announced`), and its buttons are described by them.
 */
export const shownLine = (scope: Locator, text: string) =>
  scope.locator('[aria-hidden="true"]').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });

/** Make every Server Action request on `path` fail, as a dropped connection would. Returns the undo. */
export async function failSaves(page: Page, path: string): Promise<() => Promise<void>> {
  const pattern = `**${path}`;
  await page.route(pattern, (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) return route.abort("failed");
    return route.continue();
  });
  return () => page.unroute(pattern);
}

/**
 * Swap the browser's sign-in cookie for one the server won't accept. The shared test session stays
 * valid for the tests running alongside; this browser now counts as signed out.
 */
export async function replaceSessionCookie(page: Page, baseURL: string | undefined) {
  const context = page.context();
  await context.clearCookies({ name: SESSION_COOKIE });
  await context.addCookies([{ name: SESSION_COOKIE, value: "decoy.value", url: baseURL ?? "", httpOnly: true, sameSite: "Lax" }]);
}

export const SECTION_PAGES = [
  { path: "/", h1: "FDE Journey", title: "FDE Journey" },
  { path: "/roadmap", h1: "Roadmap", title: "Roadmap · FDE Journey" },
  { path: "/reading", h1: "Reading", title: "Reading · FDE Journey" },
  { path: "/scaler", h1: "Scaler course", title: "Scaler course · FDE Journey" },
  { path: "/certs", h1: "Certifications", title: "Certifications · FDE Journey" },
  { path: "/projects", h1: "Projects", title: "Projects · FDE Journey" },
  { path: "/career", h1: "Career", title: "Career · FDE Journey" },
] as const;

/** The page's single visible h1. */
export const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 });

export async function expectNoSidewaysScroll(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(innerWidth);
}
