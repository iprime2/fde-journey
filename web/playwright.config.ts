import { type PlaywrightTestConfig, defineConfig, devices } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_OWNER_GITHUB_ID,
  E2E_OWNER_ONLY_PORT,
  E2E_OWNER_ONLY_URL,
  E2E_PORT,
  e2eExportKeyHash,
  e2eRunSecrets,
  spareSessionTokens,
  userSessionTokens,
} from "./tests/e2e/auth";

// End-to-end tests run against a production build: `npm run build` first.
// The server uses a fresh local test database (web/.data/pglite-e2e) seeded with a made-up owner,
// so the tests run signed in without GitHub (see tests/e2e/auth.ts and scripts/e2e-seed.mjs).
//
// Two servers from the same build: the main one runs with SIGNUP_MODE=capped (M4b's waitlist,
// suspension, admin and settings flows); a second one, port 3200 with its own test database,
// runs owner-only (SIGNUP_MODE unset, as production does until the owner switches) for the
// "owner-only" project, which runs tests/e2e/owner-only.spec.ts and nothing else.
const { secret, token } = e2eRunSecrets();

const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } };
const PHONE = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// Every test shares one test database. Tests tagged @fresh need it untouched (nothing ticked or
// noted yet), so they run first, on both screen sizes; every other test starts after them. Tests
// that save use item ids that no other test touches, and different ids on desktop and phone,
// because the two projects run the same test at the same time (see tests/e2e/helpers.ts).
const OWNER_ONLY_SPEC = /owner-only\.spec\.ts$/;
const projects: NonNullable<PlaywrightTestConfig["projects"]> = [
  { name: "desktop-fresh", use: DESKTOP, grep: /@fresh/, testIgnore: OWNER_ONLY_SPEC },
  { name: "phone-fresh", use: PHONE, grep: /@fresh/, testIgnore: OWNER_ONLY_SPEC },
  { name: "desktop", use: DESKTOP, grepInvert: /@fresh/, testIgnore: OWNER_ONLY_SPEC, dependencies: ["desktop-fresh", "phone-fresh"] },
  { name: "phone", use: PHONE, grepInvert: /@fresh/, testIgnore: OWNER_ONLY_SPEC, dependencies: ["desktop-fresh", "phone-fresh"] },
  { name: "owner-only", use: { ...DESKTOP, baseURL: E2E_OWNER_ONLY_URL }, testMatch: OWNER_ONLY_SPEC },
];
// Tests that sign out end a spare session of their own, one per project and attempt (auth.ts).
const spareTokens = spareSessionTokens(projects.map((p) => p.name ?? ""));
// M4b's made-up users (waitlisted, suspended, an admin, another active user) get sessions the same way.
const userTokens = userSessionTokens(projects.map((p) => p.name ?? ""));

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "off",
  },
  projects,
  webServer: [server(E2E_PORT, ".data/pglite-e2e", "capped"), server(E2E_OWNER_ONLY_PORT, ".data/pglite-e2e-owner-only", "")],
});

/** A test server: seed its own fresh test database, then `next start` on `port` with this SIGNUP_MODE. */
type WebServer = Exclude<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>;
function server(port: number, pgliteDir: string, signupMode: string): WebServer {
  return {
    command: `node scripts/e2e-seed.mjs && npx next start -p ${port}`,
    port,
    // Each run has its own secret and session, so a server left over from another run would
    // not recognise this run's sign-in. Always start a fresh one.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      E2E_AUTH: "1",
      E2E_SESSION_TOKEN: token,
      E2E_SPARE_SESSION_TOKENS: spareTokens.join(","),
      E2E_USER_SESSION_TOKENS: userTokens.join(","),
      E2E_EXPORT_KEY_HASH: e2eExportKeyHash(),
      // M4b: "capped" on the main server, so waitlisted and suspended users behave as they will in
      // production once it is on; empty (owner-only) on the second. The owner's experience is the
      // same in both modes.
      SIGNUP_MODE: signupMode,
      PGLITE_DIR: pgliteDir,
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: `http://localhost:${port}`,
      OWNER_GITHUB_ID: E2E_OWNER_GITHUB_ID,
      // Never a real database or real GitHub app from the developer's shell or .env files.
      DATABASE_URL: "",
      VERCEL: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
    },
  };
}
