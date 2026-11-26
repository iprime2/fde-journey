// TEMPORARY: the stale tab's late prefetch wave, after sign-out (deleted after use).
import { SESSION_COOKIE } from "./auth";
import { expect, test } from "./fixtures";
import { E2E_OWNER_NAME } from "./helpers";

test.use({ session: "sign-out" });

test("stale tab: late prefetches after sign-out", async ({ page, context }) => {
  const other = await context.newPage();
  const seen: string[] = [];
  other.on("response", (r) => { if (!r.url().includes("_next/static") && !r.url().includes("avatars")) seen.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}${new URL(r.url()).search.replace(/_rsc=[^&]+/, "_rsc=…")}`); });
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  await other.route("**/*", async (route) => {
    const h = route.request().headers();
    if (h["next-router-prefetch"]) await released;
    await route.continue();
  });
  await other.goto("/certs");
  await other.waitForLoadState("load");
  await page.goto("/roadmap");
  await page.waitForLoadState("networkidle");
  const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
  await page.getByRole("button", { name: `Account: ${E2E_OWNER_NAME}` }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login?status=signed-out");
  await context.addCookies([cookie!]);
  seen.length = 0;
  release();
  await other.waitForTimeout(2500);
  const statuses = seen.map((l) => l.split(" ")[0]);
  console.log(`late prefetch wave: ${seen.length} responses; 307: ${statuses.filter((s) => s === "307").length}; 404: ${statuses.filter((s) => s === "404").length}; cookie still set: ${(await context.cookies()).some((c) => c.name === SESSION_COOKIE)}`);
  console.log(seen.filter((l) => !l.startsWith("200")).slice(0, 6).join("\n"));
});
