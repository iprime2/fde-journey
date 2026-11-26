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
