// npm run db:migrate's check before migration 0002: the existing rows go to the owner, so the only
// user must be the owner (OWNER_GITHUB_ID). Each test starts from a fresh in-memory PGlite at 0001.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OWNER_CHECK_MIGRATION, checkBeforeMigrate } from "../../scripts/lib/migrate-check.mjs";

const MIGRATIONS = path.join(process.cwd(), "db", "migrations");
const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string; when: number }[];
};
/** Made-up GitHub ids. */
const OWNER_GITHUB_ID = "900000000001";
const OTHER_GITHUB_ID = "900000000002";

let root: string;
let before0002: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "fde-migrate-check-"));
  before0002 = path.join(root, "before-0002");
  mkdirSync(path.join(before0002, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === OWNER_CHECK_MIGRATION));
  for (const e of entries) copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(before0002, `${e.tag}.sql`));
  writeFileSync(path.join(before0002, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
});
afterEach(async () => {
  await client.close();
});

const query = async (text: string, params?: unknown[]) => (await client.query<Record<string, unknown>>(text, params)).rows;
const check = (env: Record<string, string | undefined>) => checkBeforeMigrate(query, env, journal);
const at0001 = () => migrate(drizzle({ client }), { migrationsFolder: before0002 });

async function addUser(id: string, githubId: string | null) {
  await client.query(`insert into "user" (id, name, email, created_at, updated_at) values ($1, 'Test User', $2, now(), now())`, [id, `${id}@example.com`]);
  if (githubId) {
    await client.query(`insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values ($1, $2, 'github', $3, now(), now())`, [
      `${id}-gh`,
      githubId,
      id,
    ]);
  }
}
const addRows = async () => {
  await client.query(`insert into progress (item_id, done, done_at) values ('l1-1', true, now()), ('l1-2', false, null)`);
};
const ENV = { OWNER_GITHUB_ID };

describe("checkBeforeMigrate", () => {
  it("passes when the only user is the owner, and says it checked", async () => {
    await at0001();
    await addUser("the-owner", OWNER_GITHUB_ID);
    await addRows();
    expect(await check(ENV)).toEqual({ ok: true, checked: true });
  });

  it.each([
    ["OWNER_GITHUB_ID is missing", {}, /OWNER_GITHUB_ID must be set/],
    ["OWNER_GITHUB_ID is not a number", { OWNER_GITHUB_ID: "someone" }, /OWNER_GITHUB_ID must be set/],
    ["OWNER_GITHUB_ID names another account", { OWNER_GITHUB_ID: OTHER_GITHUB_ID }, /that user is not the owner/],
  ])("refuses when %s", async (_label, env, reason) => {
    await at0001();
    await addUser("the-owner", OWNER_GITHUB_ID);
    await addRows();
    const result = await check(env);
    expect(result).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
  });

  it("refuses when the only user has no GitHub account", async () => {
    await at0001();
    await addUser("no-account", null);
    await addRows();
    expect(await check(ENV)).toMatchObject({ ok: false, reason: expect.stringMatching(/that user is not the owner/) });
  });

  it("refuses when there are two users, even if one is the owner", async () => {
    await at0001();
    await addUser("the-owner", OWNER_GITHUB_ID);
    await addUser("someone-else", OTHER_GITHUB_ID);
    await addRows();
    expect(await check(ENV)).toMatchObject({ ok: false, reason: expect.stringMatching(/there are 2 users/) });
  });

  it("refuses when there are rows and no user", async () => {
    await at0001();
    await addRows();
    expect(await check(ENV)).toMatchObject({ ok: false, reason: expect.stringMatching(/there are 0 users/) });
  });

  it("says nothing personal: counts only, no ids", async () => {
    await at0001();
    await addUser("the-owner", OWNER_GITHUB_ID);
    await addRows();
    for (const env of [{}, { OWNER_GITHUB_ID: OTHER_GITHUB_ID }]) {
      const result = await check(env);
      if (result.ok) throw new Error("expected a refusal");
      expect(result.reason).toContain("2 existing progress rows");
      expect(result.reason).toContain("Nothing was changed.");
      expect(result.reason).not.toMatch(/9000000000|the-owner|example\.com/);
    }
  });

  it("skips the check when progress is empty, a brand-new database, or 0002 is already applied", async () => {
    // Brand new: no tables at all.
    expect(await check({})).toEqual({ ok: true, checked: false });
    // At 0001 with users but no rows.
    await at0001();
    await addUser("a", OWNER_GITHUB_ID);
    await addUser("b", OTHER_GITHUB_ID);
    expect(await check({})).toEqual({ ok: true, checked: false });
    // Fully migrated, rows present: 0002 is not pending.
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS });
    await client.query(`insert into progress (user_id, item_id) values ('a', 'l1-1'), ('b', 'l1-1')`);
    expect(await check({})).toEqual({ ok: true, checked: false });
  });

  it("is what npm run db:migrate runs before migrating, refusing with exit code 2", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts", "db-migrate.mjs"), "utf8");
    const checkAt = script.indexOf("await checkBeforeMigrate(");
    const migrateAt = script.indexOf("await migrate(");
    expect(checkAt).toBeGreaterThan(0);
    expect(migrateAt).toBeGreaterThan(checkAt);
    expect(script).toMatch(/if \(!check\.ok\) \{\s*console\.error\(`Migration refused: \$\{check\.reason\}`\);\s*process\.exitCode = 2;\s*\} else \{/);
  });
});
