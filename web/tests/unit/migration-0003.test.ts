// Migration 0003 (M4b: sign-up, waitlist, admin, settings, export keys) on a database that already
// holds data, as production does, and `npm run db:migrate`'s owner check before it. Each test
// migrates a fresh in-memory PGlite to 0002, adds made-up rows, then applies the rest.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SETTINGS_CHECK_MIGRATION, checkBeforeMigrate } from "../../scripts/lib/migrate-check.mjs";

const MIGRATIONS = path.join(process.cwd(), "db", "migrations");
const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string; when: number }[];
};
/** Made-up GitHub ids. */
const OWNER_GITHUB_ID = "900000000001";
const OTHER_GITHUB_ID = "900000000002";

let root: string;
let before0003: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "fde-migration-0003-"));
  const index = journal.entries.findIndex((e) => e.tag === SETTINGS_CHECK_MIGRATION);
  expect(index).toBe(3);
  before0003 = path.join(root, "before-0003");
  mkdirSync(path.join(before0003, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, index);
  for (const e of entries) copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(before0003, `${e.tag}.sql`));
  writeFileSync(path.join(before0003, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle({ client }), { migrationsFolder: before0003 });
});
afterEach(async () => {
  await client.close();
});

const migrateAll = () => migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS });
const rows = async <T,>(text: string, params?: unknown[]) => (await client.query<T>(text, params)).rows;
const query = async (text: string, params?: unknown[]) => rows<Record<string, unknown>>(text, params);
const check = (env: Record<string, string | undefined>) => checkBeforeMigrate(query, env, journal);

async function addUser(id: string, githubId: string | null, createdAt = "2026-11-25T08:00:00Z") {
  await client.query(`insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, 'Test User', $2, true, $3, $3)`, [
    id,
    `${id}@example.com`,
    createdAt,
  ]);
  if (githubId) {
    await client.query(`insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values ($1, $2, 'github', $3, now(), now())`, [
      `${id}-gh`,
      githubId,
      id,
    ]);
  }
}

/** Fails if the statement succeeds; returns the constraint Postgres named. */
async function violation(text: string, params?: unknown[]): Promise<string> {
  try {
    await client.query(text, params);
  } catch (error) {
    return (error as { constraint?: string }).constraint ?? (error as Error).message;
  }
  throw new Error("expected the statement to fail");
}

describe("migration 0003", () => {
  it("keeps the owner's data and place, seeds the cap, and gives the owner every section with Scaler unlocked", async () => {
    await addUser("the-owner", OWNER_GITHUB_ID);
    await client.query(`insert into progress (user_id, item_id, done, done_at) values ('the-owner', 'l1-1', true, now()), ('the-owner', 'l1-2', false, null)`);
    const before = await rows<{ n: number }>(`select count(*)::int as n from progress`);
    await migrateAll();
    expect(await rows(`select count(*)::int as n from progress`)).toEqual(before);
    expect(await rows(`select id, status, github_login, waitlisted_at, last_active_at, activated_at = created_at as activated_at_sign_up from "user"`)).toEqual([
      { id: "the-owner", status: "active", github_login: null, waitlisted_at: null, last_active_at: null, activated_at_sign_up: true },
    ]);
    expect(await rows(`select key, value from app_setting`)).toEqual([{ key: "user_cap", value: "100" }]);
    expect(
      await rows(`select user_id, show_reading, show_scaler, show_certs, show_projects, show_career, scaler_unlocked_at is not null as unlocked from user_settings`),
    ).toEqual([{ user_id: "the-owner", show_reading: true, show_scaler: true, show_certs: true, show_projects: true, show_career: true, unlocked: true }]);
    for (const table of ["user_permission", "admin_audit", "export_token"]) expect(await rows(`select count(*)::int as n from ${table}`)).toEqual([{ n: 0 }]);
  });

  it("adds no settings rows when there isn't exactly one user", async () => {
    await migrateAll();
    expect(await rows(`select count(*)::int as n from user_settings`)).toEqual([{ n: 0 }]);
    await client.close();
    client = new PGlite();
    await migrate(drizzle({ client }), { migrationsFolder: before0003 });
    await addUser("a", OWNER_GITHUB_ID);
    await addUser("b", OTHER_GITHUB_ID);
    await migrateAll();
    expect(await rows(`select count(*)::int as n from user_settings`)).toEqual([{ n: 0 }]);
    expect(await rows(`select status from "user" order by id`)).toEqual([{ status: "active" }, { status: "active" }]);
  });

  it("guards the data with constraints", async () => {
    await addUser("u", OTHER_GITHUB_ID);
    await migrateAll();
    expect(await violation(`update "user" set status = 'banned'`)).toBe("user_status");
    expect(await violation(`update "user" set github_login = 'not a login'`)).toBe("user_github_login");
    expect(await violation(`update app_setting set value = '1001' where key = 'user_cap'`)).toBe("app_setting_user_cap");
    expect(await violation(`update app_setting set value = '-1' where key = 'user_cap'`)).toBe("app_setting_user_cap");
    expect(await violation(`update app_setting set value = 'lots' where key = 'user_cap'`)).toBe("app_setting_user_cap");
    expect(await violation(`insert into app_setting (key, value) values ('anything', 'x')`)).toBe("app_setting_key");
    await client.query(`update app_setting set value = '1000' where key = 'user_cap'`);
    expect(await violation(`insert into user_settings (user_id, show_scaler) values ('u', true)`)).toBe("user_settings_scaler_unlocked");
    expect(await violation(`insert into user_permission (user_id, permission) values ('u', 'root')`)).toBe("user_permission_permission");
    expect(await violation(`insert into admin_audit (action) values ('deleted_everything')`)).toBe("admin_audit_action");
    expect(await violation(`insert into admin_audit (action, details) values ('let_in', '[]')`)).toBe("admin_audit_details_object");
    expect(await violation(`insert into export_token (user_id, token_hash) values ('u', 'plain-text-key')`)).toBe("export_token_hash_format");
  });

  it("deleting a user removes their settings, keys and permissions, and keeps audit rows as 'a deleted account'", async () => {
    await addUser("admin", OWNER_GITHUB_ID);
    await addUser("u", OTHER_GITHUB_ID);
    await migrateAll();
    await client.query(`insert into user_settings (user_id) values ('u')`);
    await client.query(`insert into export_token (user_id, token_hash) values ('u', $1)`, ["a".repeat(64)]);
    await client.query(`insert into user_permission (user_id, permission, granted_by) values ('u', 'audit.view', 'admin')`);
    await client.query(`insert into admin_audit (actor_user_id, action, target_user_id) values ('admin', 'admin_added', 'u'), ('u', 'scaler_code_failed', null)`);
    await client.query(`delete from "user" where id = 'u'`);
    for (const table of ["user_settings", "export_token", "user_permission"]) expect(await rows(`select count(*)::int as n from ${table}`)).toEqual([{ n: 0 }]);
    expect(await rows(`select actor_user_id, action, target_user_id from admin_audit order by id`)).toEqual([
      { actor_user_id: "admin", action: "admin_added", target_user_id: null },
      { actor_user_id: null, action: "scaler_code_failed", target_user_id: null },
    ]);
  });
});

describe("npm run db:migrate's check before 0003", () => {
  it("passes when the only user is the owner", async () => {
    await addUser("the-owner", OWNER_GITHUB_ID);
    expect(await check({ OWNER_GITHUB_ID })).toEqual({ ok: true, checked: true });
  });

  it.each([
    ["OWNER_GITHUB_ID is missing", {}, /OWNER_GITHUB_ID must be set/],
    ["OWNER_GITHUB_ID names another account", { OWNER_GITHUB_ID: OTHER_GITHUB_ID }, /that user is not the owner/],
  ])("refuses when %s, saying nothing personal", async (_label, env, reason) => {
    await addUser("the-owner", OWNER_GITHUB_ID);
    const result = await check(env);
    expect(result).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
    if (!result.ok) expect(result.reason).not.toMatch(/9000000000|the-owner|example\.com/);
  });

  it("skips the check with no users, with several users, or once 0003 is applied", async () => {
    expect(await check({})).toEqual({ ok: true, checked: false });
    await addUser("a", OWNER_GITHUB_ID);
    await addUser("b", OTHER_GITHUB_ID);
    expect(await check({})).toEqual({ ok: true, checked: false });
    await client.query(`delete from "user" where id = 'a'`);
    await migrateAll();
    expect(await check({})).toEqual({ ok: true, checked: false });
  });
});

describe("docs/M4b-ROLLOUT.md matches the migration file", () => {
  const file = readFileSync(path.join(MIGRATIONS, `${SETTINGS_CHECK_MIGRATION}.sql`), "utf8");
  const doc = readFileSync(path.join(process.cwd(), "docs", "M4b-ROLLOUT.md"), "utf8");
  const optionB = /## Option B[^]*?```sql\n([^]*?)```/.exec(doc)?.[1] ?? "";

  it("records the file's SHA-256 and its journal time, as db:migrate would", () => {
    const hash = createHash("sha256").update(file).digest("hex");
    const when = journal.entries.find((e) => e.tag === SETTINGS_CHECK_MIGRATION)?.when;
    expect(optionB).toContain(`VALUES ('${hash}', ${when});`);
    expect(doc).toContain(`DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`);
  });

  it("lists the file's statements, in order and word for word", () => {
    const fromFile = file
      .split("--> statement-breakpoint")
      .map((part) =>
        part
          .split("\n")
          .filter((line) => !line.startsWith("--"))
          .join("\n")
          .trim(),
      )
      .filter(Boolean);
    const fromDoc = optionB
      .split(/^-- \d+.*$/m)
      .map((part) => part.trim())
      .filter(Boolean);
    expect(fromDoc.slice(0, -1)).toEqual(fromFile);
    expect(fromDoc.at(-1)).toMatch(/^INSERT INTO "drizzle"\."__drizzle_migrations"/);
  });
});
