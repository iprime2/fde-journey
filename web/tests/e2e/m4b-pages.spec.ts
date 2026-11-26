// The privacy page (public) and no sideways scrolling on the M4b pages, at the project's width
// (390 px on phone, 1280 px on desktop).
import { expect, test } from "./fixtures";
import { expectNoSidewaysScroll, gotoReady, pageHeading } from "./helpers";

test.describe("/privacy while signed out", () => {
  test.use({ signedIn: false });

  test("is reachable without signing in and has the issue link", async ({ page }) => {
    const response = await gotoReady(page, "/privacy");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL("/privacy");
    await expect(page).toHaveTitle("Privacy · FDE Journey");
    await expect(pageHeading(page)).toHaveText("Privacy");
    for (const h2 of ["In short", "What's stored", "Where it's stored", "Who can see it", "What isn't done with it", "Download or delete your data", "Questions"]) {
      await expect(page.getByRole("heading", { level: 2, name: h2 })).toBeVisible();
    }
    await expect(page.getByText("the browser and internet (IP) address used")).toBeVisible();
    const issue = page.getByRole("link", { name: "Open an issue on GitHub (opens in a new tab)" });
    await expect(issue).toHaveAttribute("href", "https://github.com/iprime2/fde-journey/issues/new");
    await expectNoSidewaysScroll(page);
    // "Back to FDE Journey" goes Home, which sends a signed-out visitor to sign in.
    await page.getByRole("link", { name: "Back to FDE Journey" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("no sideways scrolling on the M4b pages", () => {
  for (const path of ["/settings", "/admin", "/admin/users", "/admin/waitlist", "/admin/sign-up", "/admin/admins", "/admin/audit", "/privacy"]) {
    test(path, async ({ page }) => {
      await gotoReady(page, path);
      await expect(pageHeading(page)).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  }
});
