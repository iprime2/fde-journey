// End-to-end tests only: creates a fresh local test database with a made-up owner, the session
// every test shares, and spare sessions for tests that sign out, so Playwright can sign in without
// GitHub. The owner is "Sam Example" (initials "SE") with a made-up GitHub avatar URL (u/0, not a
// real account). The browser never fetches it: tests/e2e/fixtures.ts answers every request to
// avatars.githubusercontent.com with a solid-colour PNG made in the test. playwright.config.ts runs
// it right before `next start`; the browser then sends a cookie signed with the test run's secret.
//
// It also adds a second made-up user ("Alex Other", scripts/lib/e2e-data.mjs) with saved progress
// and no session. The owner starts with nothing saved (the @fresh tests check that), so any of
// Alex's rows showing up on the owner's pages would fail them. Every progress row has its user_id.
//
// M4b adds made-up users in every state (E2E_USERS): another active user with progress and a Claude
// export key (its hash only, E2E_EXPORT_KEY_HASH), a waitlisted user, a suspended user (with
// sessions, to prove they end on sight), and an admin with some permissions. Each gets its own
// sessions (E2E_USER_SESSION_TOKENS, one per project and attempt).
//
// Nothing in the app knows about this: there is no test sign-in route or flag in production code.
// The seed refuses to run unless scripts/lib/e2e-guard.mjs passes (E2E_AUTH=1, not on Vercel, no
// DATABASE_URL, and a folder named pglite-e2e* directly inside web/.data/).
import { randomBytes, scryptSync } from "node:crypto";
import { rmSync } from "node:fs";
import { checkE2eSeedEnv } from "./lib/e2e-guard.mjs";
import { openScriptDb } from "./lib/db.mjs";
import {
  E2E_ACTIVE_DONE,
  E2E_ACTIVE_NOTE,
  E2E_OTHER_DONE,
  E2E_OTHER_GITHUB_ID,
  E2E_OTHER_LINK,
  E2E_OTHER_NOTE,
  E2E_OTHER_USER,
  E2E_SCALER_CODE,
  E2E_TARGETS,
  E2E_USERS,
} from "./lib/e2e-data.mjs";

/** Made-up avatar URL for the test owner. u/0 is not a GitHub account; tests route it anyway. */
const E2E_OWNER_IMAGE = "https://avatars.githubusercontent.com/u/0?v=4";

const check = checkE2eSeedEnv(process.env);
if (!check.ok) {
  console.error(`e2e seed refused: ${check.reason}`);
  process.exit(1);
}

rmSync(check.dataDir, { recursive: true, force: true });
const db = await openScriptDb({ kind: "pglite", dataDir: check.dataDir });
try {
  await db.query(
    `insert into "user" (id, name, email, email_verified, image, created_at, updated_at)
     values ('e2e-owner', 'Sam Example', 'owner@example.com', true, $1, now(), now())`,
    [E2E_OWNER_IMAGE],
  );
  await db.query(
    `insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
     values ('e2e-owner-github', $1, 'github', 'e2e-owner', now(), now())`,
    [check.ownerId],
  );
  if (E2E_OTHER_GITHUB_ID === check.ownerId) throw new Error("The second test user must not have the owner's GitHub id.");
  await db.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Alex Other', 'other@example.com', true, now(), now())`,
    [E2E_OTHER_USER],
  );
  await db.query(
    `insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
     values ('e2e-other-github', $1, 'github', $2, now(), now())`,
    [E2E_OTHER_GITHUB_ID, E2E_OTHER_USER],
  );
  for (const itemId of E2E_OTHER_DONE) {
    await db.query(
      `insert into progress (user_id, item_id, done, note, link, done_at, updated_at)
       values ($1, $2, true, $3, $4, now(), now())`,
      [E2E_OTHER_USER, itemId, E2E_OTHER_NOTE, E2E_OTHER_LINK],
    );
  }
  await db.query(`insert into progress (user_id, item_id, note, updated_at) values ($1, 'journal', $2, now())`, [E2E_OTHER_USER, E2E_OTHER_NOTE]);

  // M4b users. The waitlisted user joined a day ago; the owner's GitHub login is set as sign-in would.
  await db.query(`update "user" set github_login = 'sam-example' where id = 'e2e-owner'`);
  for (const u of [...Object.values(E2E_USERS), ...Object.values(E2E_TARGETS)]) {
    // Wren Waiting joined a day ago; every spare waitlisted user an hour ago, so Wren stays first.
    const joined = u.id === E2E_USERS.waitlisted.id ? "1 day" : "1 hour";
    await db.query(
      `insert into "user" (id, name, email, email_verified, github_login, status, activated_at, waitlisted_at, created_at, updated_at)
       values ($1, $2, $3, true, $4, $5,
         case when $5 = 'active' then now() end, case when $5 = 'waitlisted' then now() - $6::interval end, now() - interval '2 days', now())`,
      [u.id, u.name, `${u.login}@example.com`, u.login, u.status, joined],
    );
    await db.query(
      `insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values ($1, $2, 'github', $3, now(), now())`,
      [`${u.id}-github`, u.githubId, u.id],
    );
    for (const permission of u.permissions ?? []) {
      await db.query(`insert into user_permission (user_id, permission, granted_by) values ($1, $2, 'e2e-owner')`, [u.id, permission]);
    }
  }
  for (const itemId of E2E_ACTIVE_DONE) {
    await db.query(
      `insert into progress (user_id, item_id, done, note, done_at, updated_at) values ($1, $2, true, $3, now(), now())`,
      [E2E_USERS.active.id, itemId, E2E_ACTIVE_NOTE],
    );
  }
  if (check.exportKeyHash) {
    await db.query(`insert into export_token (user_id, token_hash) values ($1, $2)`, [E2E_USERS.active.id, check.exportKeyHash]);
  }

  // The made-up Scaler access code, stored as the app stores it (lib/access-code.ts): scrypt with
  // N=2^15, r=8, p=1 over the normalised code (trimmed, NFKC, upper case).
  const salt = randomBytes(16);
  const key = scryptSync(E2E_SCALER_CODE.normalize("NFKC").trim().toUpperCase(), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  await db.query(`insert into app_setting (key, value) values ('scaler_code_hash', $1)`, [
    ["scrypt", 32768, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$"),
  ]);

  const sessions = [
    ["e2e-session", check.token, "e2e-owner"],
    ...check.spareTokens.map((token, i) => [`e2e-spare-session-${i + 1}`, token, "e2e-owner"]),
    ...check.userTokens.map(({ user, token }, i) => [`e2e-user-session-${i + 1}`, token, E2E_USERS[user].id]),
  ];
  for (const [id, token, userId] of sessions) {
    await db.query(
      `insert into session (id, expires_at, token, created_at, updated_at, user_id)
       values ($1, now() + interval '1 day', $2, now(), now(), $3)`,
      [id, token, userId],
    );
  }
  console.log(
    `e2e seed: test database ready (${sessions.length} sessions, 1 other user with ${E2E_OTHER_DONE.length + 1} progress rows, ${Object.keys(E2E_USERS).length} M4b users).`,
  );
} finally {
  await db.close();
}
