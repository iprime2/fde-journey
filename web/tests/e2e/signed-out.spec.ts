// Visitors without the owner's sign-in see nothing but /login (design spec 6, "Signed out").
import { SESSION_COOKIE } from "./auth";
import { expect, test } from "./fixtures";
import { SECTION_PAGES, pageHeading } from "./helpers";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("every page goes straight to /login, remembering where the visitor was going", async ({ page }) => {
    for (const s of SECTION_PAGES) {
      await page.goto(s.path);
      const next = s.path === "/" ? "" : `?next=${encodeURIComponent(s.path)}`;
      await expect(page).toHaveURL(`/login${next}`);
      await expect(pageHeading(page)).toHaveText("FDE Journey");
      await expect(page.getByRole("navigation")).toHaveCount(0);
    }
  });

  test("keeps the query, and unknown addresses also need sign-in", async ({ page }) => {
    await page.goto("/roadmap?q=rag&status=open");
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent("/roadmap?q=rag&status=open")}`);
    await page.goto("/no-such-page");
    await expect(page).toHaveURL("/login?next=%2Fno-such-page");
  });

  test("a forged session cookie still ends on /login", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: SESSION_COOKIE, value: "forged.value", url: baseURL ?? "" }]);
    await page.goto("/career");
    await expect(page).toHaveURL("/login?next=%2Fcareer");
    await expect(page.getByRole("textbox", { name: "Weekly notes" })).toHaveCount(0);
  });

  test("Better Auth's endpoints stay reachable and report no session", async ({ request }) => {
    const res = await request.get("/api/auth/get-session");
    expect(res.status()).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

// A signed-in owner opening /login goes on to Home or `next`: see session.spec.ts ("signed in").
