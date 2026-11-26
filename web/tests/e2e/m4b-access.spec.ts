// M4b, back-end-visible flows (the test server runs with SIGNUP_MODE=capped): a waitlisted user
// only ever reaches /waitlist, a suspended user is refused and signed out, another active user
// sees only their own tracker, and /api/export answers with a key and only for its user. Every
// user here is made up (scripts/lib/e2e-data.mjs).
import { E2E_ACTIVE_DONE, E2E_ACTIVE_NOTE, E2E_OTHER_NOTE } from "../../scripts/lib/e2e-data.mjs";
import { e2eExportKey } from "./auth";
import { expect, test } from "./fixtures";
import { gotoReady, pageHeading } from "./helpers";

const SUSPENDED_TEXT = "This account is suspended, so it can't sign in. If you think this is a mistake, open an issue on GitHub.";

test.describe("a waitlisted user", () => {
  test.use({ as: "waitlisted" });

  test("is sent to /waitlist from every app page, and sees their place", async ({ page }) => {
    for (const path of ["/", "/roadmap", "/career", "/scaler"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/waitlist");
    }
    await expect(pageHeading(page)).toHaveText("You're on the waitlist");
    await expect(page.getByText("Your place in line")).toBeVisible();
    await expect(page.getByText("You're next.")).toBeVisible();
    // No app navigation, ticks or notes anywhere.
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("/login sends them back to /waitlist", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/waitlist");
  });
});

test.describe("a suspended user", () => {
  test.use({ as: "suspended" });

  test("is refused at once and their session ends", async ({ page }) => {
    await page.goto("/roadmap");
    // The first request to see the session ends it. That is usually the page (which then says why,
    // ?error=suspended); a prefetch in the same page load can get there first, and the page then
    // sees a plain signed-out visitor. Either way: no app, and no session left.
    await expect(page).toHaveURL(/\/login\?(error=suspended|next=%2Froadmap)$/);
    await expect(pageHeading(page)).toHaveText("Sign in");
    await page.goto("/career");
    await expect(page).toHaveURL("/login?next=%2Fcareer");
    await expect(page.getByRole("textbox", { name: "Weekly notes" })).toHaveCount(0);
  });

  test("the sign-in page says why (where GitHub sign-in sends a suspended account)", async ({ page }) => {
    await page.goto("/login?error=suspended");
    await expect(page.getByRole("alert").filter({ hasText: SUSPENDED_TEXT })).toBeVisible();
  });
});

test.describe("another active user", () => {
  test.use({ as: "active" });

  test("sees their own ticks, never the owner's or anyone else's notes", async ({ page }) => {
    await gotoReady(page, "/reading");
    await expect(pageHeading(page)).toHaveText("Reading");
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(1);
    const html = await page.content();
    expect(html).not.toContain(E2E_OTHER_NOTE.slice(E2E_OTHER_NOTE.indexOf("made-up")));
  });
});

test.describe("/api/export", () => {
  test.use({ signedIn: false });

  test("returns the key's user's progress as JSON, and nobody else's", async ({ request }) => {
    const res = await request.get("/api/export", { headers: { authorization: `Bearer ${e2eExportKey()}` } });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("no-store");
    const body = (await res.json()) as { format: string; progress: { itemId: string; done: boolean; note: string }[]; sections: Record<string, boolean> };
    expect(body.format).toBe("fde-journey-export");
    expect(body.sections).toMatchObject({ roadmap: true, reading: true, scaler: false });
    expect(body.progress.map((p) => p.itemId).sort()).toEqual([...E2E_ACTIVE_DONE].sort());
    expect(body.progress.every((p) => p.done && p.note === E2E_ACTIVE_NOTE)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(E2E_OTHER_NOTE);
  });

  test("refuses requests without a valid key, and a session cookie is not a key", async ({ request }) => {
    expect((await request.get("/api/export")).status()).toBe(401);
    expect((await request.get("/api/export", { headers: { authorization: `Bearer fdej_${"A".repeat(43)}` } })).status()).toBe(401);
    expect((await request.post("/api/export", { headers: { authorization: `Bearer ${e2eExportKey()}` } })).status()).toBe(405);
  });
});
