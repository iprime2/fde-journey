// Owner-only mode (SIGNUP_MODE unset): production's default until the owner switches on capped
// sign-up. Runs only in the "owner-only" project, against the second test server (port 3200, its
// own test database, the same made-up users; playwright.config.ts). Every other spec runs against
// the capped server.
import { E2E_USERS } from "../../scripts/lib/e2e-data.mjs";
import { e2eExportKey } from "./auth";
import { expect, test } from "./fixtures";
import { gotoReady, pageHeading } from "./helpers";

test.describe("owner-only mode: the owner", () => {
  test("uses the app as usual, Admin and Settings included", async ({ page }) => {
    await gotoReady(page, "/roadmap");
    await expect(pageHeading(page)).toHaveText("Roadmap");
    await expect(page.getByRole("checkbox").first()).toBeEnabled();
    await gotoReady(page, "/admin/users");
    await expect(pageHeading(page)).toHaveText("Users");
    await gotoReady(page, "/settings");
    await expect(pageHeading(page)).toHaveText("Settings");
  });

  test("lands on the page they wanted after sign-in, with no extra hop", async ({ page }) => {
    const landed = await page.request.get("/auth/continue?next=%2Froadmap", { maxRedirects: 0 });
    expect(landed.status()).toBe(303);
    expect(new URL(landed.headers().location ?? "", "http://localhost").pathname).toBe("/roadmap");
    const res = await page.request.get("/roadmap", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('aria-label="Sections"');
  });
});

test.describe("owner-only mode: anyone else", () => {
  test.use({ as: "active" });

  test("has their session revoked on their first request", async ({ page }) => {
    // Better Auth alone still knows the session (it doesn't apply the owner rule)…
    const before = await page.request.get("/api/auth/get-session");
    expect(((await before.json()) as { user?: { name?: string } } | null)?.user?.name).toBe(E2E_USERS.active.name);
    // …until the app sees it: refused, and the session row is deleted.
    await page.goto("/roadmap");
    await expect(page).toHaveURL("/login?next=%2Froadmap");
    const after = await page.request.get("/api/auth/get-session");
    expect(await after.json()).toBeNull();
    await page.goto("/settings");
    await expect(page).toHaveURL("/login?next=%2Fsettings");
  });
});

test.describe("owner-only mode: a waitlisted account (left from capped mode)", () => {
  test.use({ as: "waitlisted" });

  test("is sent to the sign-in page before any page renders, and after sign-in", async ({ page }) => {
    // Never /waitlist: in owner-only mode nobody but the owner has a usable session.
    for (const path of ["/", "/roadmap", "/waitlist"]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(new URL(res.headers().location ?? "", "http://localhost").pathname, path).toBe("/login");
      expect(await res.text(), path).not.toContain('aria-label="Sections"');
    }
    const landed = await page.request.get("/auth/continue?next=%2Froadmap", { maxRedirects: 0 });
    expect(landed.status()).toBe(303);
    const target = new URL(landed.headers().location ?? "", "http://localhost");
    expect(`${target.pathname}${target.search}`).toBe("/login?next=%2Froadmap");
    // …and the session is revoked there, as on any page.
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
  });
});

test.describe("owner-only mode: signed out", () => {
  test.use({ signedIn: false });

  test("the sign-in page says only the owner can sign in", async ({ page }) => {
    await gotoReady(page, "/login");
    await expect(page.getByText("Private for now: only the owner's GitHub account can sign in.")).toBeVisible();
  });

  test("another user's Claude export key is refused", async ({ request }) => {
    const res = await request.get("/api/export", { headers: { authorization: `Bearer ${e2eExportKey()}` } });
    expect(res.status()).toBe(401);
  });
});
