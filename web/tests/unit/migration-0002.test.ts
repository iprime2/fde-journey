// Migration 0002 (progress per user) on a database that already holds data, as production does.
// Each test migrates a fresh in-memory PGlite to 0001, adds made-up rows, then applies the rest.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = path.join(process.cwd(), "db", "migrations");
const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string }[];
};

/** A copy of the migrations folder holding only the first `count` migrations. */
function partialFolder(root: string, count: number): string {
  const dir = path.join(root, `first-${count}`);
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, count);
  for (const e of entries) copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

let root: string;
let before0002: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "fde-migration-test-"));
  const index = journal.entries.findIndex((e) => e.tag === "0002_progress_per_user");
  expect(index).toBe(2);
  before0002 = partialFolder(root, index);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle({ client }), { migrationsFolder: before0002 });
});
afterEach(async () => {
  await client.close();
});

const migrateAll = () => migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS });
/** The Postgres error behind a failed migration (Drizzle wraps it as `cause`). */
async function migrationError(): Promise<string> {
  try {
    await migrateAll();
  } catch (error) {
    return error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error);
  }
  throw new Error("expected the migration to fail");
}
const rows = async <T,>(text: string) => (await client.query<T>(text)).rows;

async function addUser(id: string) {
  await client.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, 'Test User', $2, true, now(), now())`,
    [id, `${id}@example.com`],
  );
}

async function addProgress() {
  await client.query(`insert into progress (item_id, done, note, done_at) values ('l1-1', true, 'Made-up note.', now())`);
  await client.query(`insert into progress (item_id, link) values ('p1-2', 'https://example.com/demo')`);
  await client.query(`insert into progress (item_id, note) values ('journal', 'Made-up weekly note.')`);
}

const appliedCount = async () => (await rows<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations"))[0].n;
const columns = async (table: string) =>
  (await rows<{ column_name: string }>(`select column_name from information_schema.columns where table_name = '${table}' order by ordinal_position`)).map(
    (r) => r.column_name,
  );
const primaryKey = async () =>
  (
    await rows<{ name: string; columns: string }>(`
      select c.conname as name, string_agg(a.attname, ',' order by k.n) as columns
      from pg_constraint c
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, n)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.conrelid = 'progress'::regclass and c.contype = 'p'
      group by c.conname`)
  )[0];

describe("migration 0002", () => {
  it("assigns every existing row to the only user, keeping the data, and sets the new key", async () => {
    await addUser("the-owner");
    await addProgress();
    const before = await rows("select item_id, done, note, link, done_at, updated_at from progress order by item_id");
    await migrateAll();

    expect(await appliedCount()).toBe(journal.entries.length);
    const after = await rows<{ user_id: string }>("select user_id, item_id, done, note, link, done_at, updated_at from progress order by item_id");
    expect(after.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "user_id")))).toEqual(before);
    expect(new Set(after.map((r) => r.user_id))).toEqual(new Set(["the-owner"]));
    expect(await rows("select 1 from progress where user_id is null")).toEqual([]);
    expect(await primaryKey()).toEqual({ name: "progress_user_id_item_id_pk", columns: "user_id,item_id" });
    // The check constraints are still there.
    await expect(client.query(`update progress set link = 'http://example.com' where item_id = 'p1-2'`)).rejects.toThrow(/progress_link_https/);
    expect(await columns("progress_event")).toEqual(["id", "user_id", "item_id", "kind", "at"]);
  });

  it("stops, changing nothing, when there are rows and more than one user", async () => {
    await addUser("user-a");
    await addUser("user-b");
    await addProgress();
    expect(await migrationError()).toMatch(/^Migration 0002 stopped: progress has 3 rows but there are 2 users\. .*Nothing was changed\.$/);
    // Rolled back: still at 0001, no user_id, no event table, the old key.
    expect(await appliedCount()).toBe(2);
    expect(await columns("progress")).not.toContain("user_id");
    expect(await columns("progress_event")).toEqual([]);
    expect(await primaryKey()).toEqual({ name: "progress_pkey", columns: "item_id" });
    expect(await rows("select item_id from progress")).toHaveLength(3);
  });

  it("stops when there are rows but no user at all", async () => {
    await addProgress();
    expect(await migrationError()).toMatch(/progress has 3 rows but there are 0 users/);
    expect(await appliedCount()).toBe(2);
  });

  it("passes on an empty progress table, whatever the number of users", async () => {
    await addUser("user-a");
    await addUser("user-b");
    await migrateAll();
    expect(await appliedCount()).toBe(journal.entries.length);
    expect(await rows("select * from progress")).toEqual([]);
    expect(await primaryKey()).toEqual({ name: "progress_user_id_item_id_pk", columns: "user_id,item_id" });
  });

  it("passes on a brand-new database (no users, no rows)", async () => {
    await migrateAll();
    expect(await appliedCount()).toBe(journal.entries.length);
  });

  it("removes a user's progress and events when the user is deleted", async () => {
    await addUser("the-owner");
    await addProgress();
    await migrateAll();
    await client.query(`insert into progress_event (user_id, item_id, kind) values ('the-owner', 'l1-1', 'done')`);
    await client.query(`delete from "user" where id = 'the-owner'`);
    expect(await rows("select 1 from progress")).toEqual([]);
    expect(await rows("select 1 from progress_event")).toEqual([]);
  });

  it("refuses an event kind outside done, undone, note and link", async () => {
    await addUser("the-owner");
    await migrateAll();
    await expect(client.query(`insert into progress_event (user_id, item_id, kind) values ('the-owner', 'l1-1', 'deleted')`)).rejects.toThrow(
      /progress_event_kind/,
    );
  });
});
