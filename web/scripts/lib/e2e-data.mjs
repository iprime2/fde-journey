// Made-up data for the end-to-end seed (scripts/e2e-seed.mjs), shared with the tests that check it
// (tests/e2e/isolation.spec.ts). Nothing here is real.

/** A second user, never the owner. Can't sign in while sign-in is owner-only (M4a). */
export const E2E_OTHER_USER = "e2e-other";
export const E2E_OTHER_GITHUB_ID = "900000000002";
/** Text that must never appear on the owner's pages. */
export const E2E_OTHER_NOTE = "Other user's made-up note, never shown to the owner.";
export const E2E_OTHER_LINK = "https://example.com/other-user";
/** One done item per section, so every section's done count would show a leak. */
export const E2E_OTHER_DONE = ["l1-1", "r1-1-1", "pp1", "bk1", "s1-1", "c1-1", "p1-1", "k1"];

/**
 * M4b: made-up users in every state, for the waitlist, suspension, admin and export flows. Each has
 * its own sessions (tests/e2e/auth.ts, userSessionToken), so tests can act as any of them.
 */
export const E2E_USERS = {
  active: { id: "e2e-active", name: "Riley Active", githubId: "900000000003", login: "riley-active", status: "active", permissions: [] },
  waitlisted: { id: "e2e-waitlisted", name: "Wren Waiting", githubId: "900000000004", login: "wren-waiting", status: "waitlisted", permissions: [] },
  suspended: { id: "e2e-suspended", name: "Sid Suspended", githubId: "900000000005", login: "sid-suspended", status: "suspended", permissions: [] },
  admin: { id: "e2e-admin", name: "Ada Admin", githubId: "900000000006", login: "ada-admin", status: "active", permissions: ["metrics.view", "users.view", "audit.view"] },
};
/** The active user's saved progress: what their export key returns. */
export const E2E_ACTIVE_DONE = ["l1-1", "pp1"];
export const E2E_ACTIVE_NOTE = "Riley's made-up note, readable only with Riley's export key.";
