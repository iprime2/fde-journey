import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_OWNER_GITHUB_ID, E2E_PORT, e2eRunSecrets } from "./tests/e2e/auth";

// End-to-end tests run against a production build: `npm run build` first.
// The server uses a fresh local test database (web/.data/pglite-e2e) seeded with a made-up owner,
// so the tests run signed in without GitHub (see tests/e2e/auth.ts and scripts/e2e-seed.mjs).
const { secret, token } = e2eRunSecrets();

const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } };
const PHONE = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

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
  // Every test shares one test database. Tests tagged @fresh need it untouched (nothing ticked or
  // noted yet), so they run first, on both screen sizes; every other test starts after them. Tests
  // that save use item ids that no other test touches, and different ids on desktop and phone,
  // because the two projects run the same test at the same time (see tests/e2e/helpers.ts).
  projects: [
    { name: "desktop-fresh", use: DESKTOP, grep: /@fresh/ },
    { name: "phone-fresh", use: PHONE, grep: /@fresh/ },
    { name: "desktop", use: DESKTOP, grepInvert: /@fresh/, dependencies: ["desktop-fresh", "phone-fresh"] },
    { name: "phone", use: PHONE, grepInvert: /@fresh/, dependencies: ["desktop-fresh", "phone-fresh"] },
  ],
  webServer: {
    command: `node scripts/e2e-seed.mjs && npx next start -p ${E2E_PORT}`,
    port: E2E_PORT,
    // Each run has its own secret and session, so a server left over from another run would
    // not recognise this run's sign-in. Always start a fresh one.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      E2E_AUTH: "1",
      E2E_SESSION_TOKEN: token,
      PGLITE_DIR: ".data/pglite-e2e",
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: E2E_BASE_URL,
      OWNER_GITHUB_ID: E2E_OWNER_GITHUB_ID,
      // Never a real database or real GitHub app from the developer's shell or .env files.
      DATABASE_URL: "",
      VERCEL: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
    },
  },
});
