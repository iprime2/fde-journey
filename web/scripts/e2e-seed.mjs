// End-to-end tests only: creates a fresh local test database with a made-up owner ("Sam Example",
// no avatar image, so the account menu shows the initials "SE"), the session
// every test shares, and spare sessions for tests that sign out, so Playwright can sign in without
// GitHub. playwright.config.ts runs it right before `next start`; the browser then sends a cookie
// signed with the test run's secret.
//
// Nothing in the app knows about this: there is no test sign-in route or flag in production code.
// The seed refuses to run unless scripts/lib/e2e-guard.mjs passes (E2E_AUTH=1, not on Vercel, no
// DATABASE_URL, and a folder named pglite-e2e* directly inside web/.data/).
import { rmSync } from "node:fs";
import { checkE2eSeedEnv } from "./lib/e2e-guard.mjs";
import { openScriptDb } from "./lib/db.mjs";

const check = checkE2eSeedEnv(process.env);
if (!check.ok) {
  console.error(`e2e seed refused: ${check.reason}`);
  process.exit(1);
}

rmSync(check.dataDir, { recursive: true, force: true });
const db = await openScriptDb({ kind: "pglite", dataDir: check.dataDir });
try {
  await db.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ('e2e-owner', 'Sam Example', 'owner@example.com', true, now(), now())`,
  );
  await db.query(
    `insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
     values ('e2e-owner-github', $1, 'github', 'e2e-owner', now(), now())`,
    [check.ownerId],
  );
  const sessions = [
    ["e2e-session", check.token],
    ...check.spareTokens.map((token, i) => [`e2e-spare-session-${i + 1}`, token]),
  ];
  for (const [id, token] of sessions) {
    await db.query(
      `insert into session (id, expires_at, token, created_at, updated_at, user_id)
       values ($1, now() + interval '1 day', $2, now(), now(), 'e2e-owner')`,
      [id, token],
    );
  }
  console.log(`e2e seed: test database ready (${sessions.length} sessions).`);
} finally {
  await db.close();
}
