// Guard: no query on progress or progress_event runs without a user filter.
//
// Static: reads every source file under web/ (except the skip list) with the TypeScript parser and
// applies the rules in support/query-guard.ts. The second half feeds the checker bad examples,
// including every probe from the M4a review, so a checker that stopped finding things fails too.
// The runtime half (every statement actually sent to the database) is in isolation.test.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { checkSource, checkSqlText } from "./support/query-guard";

const WEB = process.cwd();
/** Not the app's code: dependencies, build output, local data, tests, generated migrations. */
const SKIP = new Set(["node_modules", ".next", ".data", ".git", "test-results", "playwright-report", "tests", "migrations", "public"]);
/** The only files that may touch the per-user tables. */
const ALLOWED = new Set([
  "lib/progress-db.ts", // the app's data layer
  "lib/settings-db.ts", // user_settings and export_token
  "scripts/lib/import-core.mjs", // npm run db:import, for the owner
  "scripts/e2e-seed.mjs", // end-to-end test data
]);
/** Allowed files whose SQL needn't come from a function with a userId parameter. */
const SEED_FILES = new Set(["scripts/e2e-seed.mjs"]);
/** Statements that read across users on purpose, matched exactly. Each returns a count only. */
const REVIEWED = new Map([
  // npm run db:migrate: before migration 0002, how many rows it will give to the owner.
  ["scripts/lib/migrate-check.mjs", ["select count(*)::int as n from progress"]],
  // /api/export: a request carries a key, not a user, so the key's hash finds the user. Returns that
  // user's id (and the rate-limit count) only, for an unrevoked key of an active user.
  [
    "lib/export-auth.ts",
    [
      `update "export_token" t set "last_used_at" = now(), "window_start" = case when t."window_start" is null or t."window_start" < now() - interval '1 hour' then now() else t."window_start" end, "window_count" = case when t."window_start" is null or t."window_start" < now() - interval '1 hour' then 1 else t."window_count" + 1 end from "user" u where t."token_hash" = \${tokenHash} and t."revoked_at" is null and u."id" = t."user_id" and u."status" = 'active' returning t."user_id", t."window_count"`,
    ],
  ],
]);
/**
 * Admin modules (M4b): cross-user by design. Every exported function checks its permission first;
 * only these functions may read the per-user tables, and only counts (never note or link columns).
 * tests/unit/admin.test.ts proves each refuses without its permission.
 */
const ADMIN_FILES = new Map([
  [
    "lib/admin-db.ts",
    [
      "getAdminOverview", // items marked done this week, all users: one count
      "listAdminUsers", // done counts per section for the people on the page
    ],
  ],
]);

function sourceFiles(rel: string): string[] {
  const full = path.join(WEB, rel);
  if (statSync(full).isFile()) return /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(rel) && !rel.endsWith(".d.ts") ? [rel] : [];
  return readdirSync(full).flatMap((name) => (SKIP.has(name) ? [] : sourceFiles(rel ? path.join(rel, name) : name)));
}

const files = sourceFiles("").filter((f) => f !== "db/schema.ts");
const check = (rel: string, source: string) => checkSource(rel, source, { allowed: ALLOWED, seedFiles: SEED_FILES, reviewed: REVIEWED, adminFiles: ADMIN_FILES });
const problems = (rel: string, source: string) => check(rel, source).map((f) => f.problem);

describe("every query on progress and progress_event is scoped to a user", () => {
  it("scans all of the app's code, not a fixed list of folders", () => {
    expect(files.length).toBeGreaterThan(50);
    for (const f of ["lib/progress-db.ts", "app/actions/progress.ts", "scripts/lib/import-core.mjs", "proxy.ts", "next.config.ts", "drizzle.config.ts"]) {
      expect(files).toContain(f);
    }
    expect(files.some((f) => f.startsWith("tests/") || f.startsWith("node_modules/"))).toBe(false);
  });

  it("finds no unscoped query", () => {
    const findings = files.flatMap((rel) => check(rel, readFileSync(path.join(WEB, rel), "utf8")));
    expect(findings).toEqual([]);
  });

  it("would object if a filter were removed from the data layer (so it isn't passing vacuously)", () => {
    const dataLayer = readFileSync(path.join(WEB, "lib/progress-db.ts"), "utf8");
    expect(dataLayer.match(/\.from\((progress|progressEvent)\)/g)?.length).toBeGreaterThanOrEqual(5);
    const broken = dataLayer.replace(".where(eq(progress.userId, userId));", ";");
    expect(broken).not.toBe(dataLayer);
    expect(problems("lib/progress-db.ts", broken)).toEqual(["from(progress) needs one where() with eq(progress.userId, userId) at its top level"]);
    const importCore = readFileSync(path.join(WEB, "scripts/lib/import-core.mjs"), "utf8");
    const brokenImport = importCore.replace("where user_id = $1 and item_id = any($2::text[])", "where item_id = any($2::text[])");
    expect(brokenImport).not.toBe(importCore);
    expect(problems("scripts/lib/import-core.mjs", brokenImport)).toContain("from progress without a top-level user_id = $n condition");
  });

  it("covers the Insights queries (M5a): removing or weakening their user filter is caught", () => {
    const dataLayer = readFileSync(path.join(WEB, "lib/progress-db.ts"), "utf8");
    const doneFilter = ".where(and(eq(progress.userId, userId), eq(progress.done, true)))";
    // Saves per item and IST day (grouped in SQL), and the items noted this month.
    const eventFilter = ".where(and(eq(progressEvent.userId, userId), gte(progressEvent.at, since)))\n      .groupBy(";
    const noteFilter = '.where(and(eq(progressEvent.userId, userId), eq(progressEvent.kind, "note"), gte(progressEvent.at, notesSince)))';
    expect(dataLayer).toContain(doneFilter);
    expect(dataLayer).toContain(eventFilter);
    expect(dataLayer).toContain(noteFilter);
    const NOT_SCOPED = "from(progressEvent) needs one where() with eq(progressEvent.userId, userId) at its top level";
    const probes: [string, string, string][] = [
      [doneFilter, ".where(eq(progress.done, true))", "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
      [eventFilter, ".where(gte(progressEvent.at, since))\n      .groupBy(", NOT_SCOPED],
      [eventFilter, ".where(or(eq(progressEvent.userId, userId), gte(progressEvent.at, since)))\n      .groupBy(", NOT_SCOPED],
      [eventFilter, ".groupBy(", NOT_SCOPED],
      [noteFilter, '.where(and(eq(progressEvent.kind, "note"), gte(progressEvent.at, notesSince)))', NOT_SCOPED],
      [noteFilter, '.where(or(eq(progressEvent.userId, userId), eq(progressEvent.kind, "note")))', NOT_SCOPED],
      [noteFilter, '.where(and(eq(progressEvent.userId, otherUserId), eq(progressEvent.kind, "note")))', NOT_SCOPED],
      [noteFilter, "", NOT_SCOPED],
    ];
    for (const [from, to, problem] of probes) {
      const broken = dataLayer.replace(from, to);
      expect(broken).not.toBe(dataLayer);
      expect(problems("lib/progress-db.ts", broken)).toEqual([problem]);
    }
    // The same counts written as raw SQL without the user filter are caught too.
    const rawCounts = dataLayer.replace(
      "checkUserId(userId);\n  const { since, notesSince }",
      "checkUserId(userId);\n  await db.execute(sql`select item_id, count(*) from progress_event where at >= ${since} group by item_id`);\n  const { since, notesSince }",
    );
    expect(rawCounts).not.toBe(dataLayer);
    expect(problems("lib/progress-db.ts", rawCounts)).toContain("from progress_event without a top-level user_id = $n condition");
    // The page read must go through the data layer: the same query anywhere else is refused.
    const elsewhere = `import { progressEvent } from "@/db/schema";\nexport async function getInsights(userId: string, db: Db) { return db.select().from(progressEvent).where(eq(progressEvent.userId, userId)); }`;
    expect(problems("lib/data.ts", elsewhere).some((p) => p.startsWith("imports the progressEvent table"))).toBe(true);
  });

  it("the database's relational API can't reach the per-user tables at all", async () => {
    const tables = Object.keys((await getDb()).query);
    expect(tables).toEqual(expect.arrayContaining(["user", "session", "account", "verification"]));
    expect(tables).not.toContain("progress");
    expect(tables).not.toContain("progressEvent");
    expect(tables).not.toContain("userSettings");
    expect(tables).not.toContain("exportToken");
  });

  it("would object if a filter were removed from the settings layer, or a permission check from an admin function", () => {
    const settings = readFileSync(path.join(WEB, "lib/settings-db.ts"), "utf8");
    const broken = settings.replace(".where(eq(userSettings.userId, userId))\n    .limit(1);", ".limit(1);");
    expect(broken).not.toBe(settings);
    expect(problems("lib/settings-db.ts", broken)).toEqual(["from(userSettings) needs one where() with eq(userSettings.userId, userId) at its top level"]);
    const admin = readFileSync(path.join(WEB, "lib/admin-db.ts"), "utf8");
    const unchecked = admin.replace('export async function getAdminOverview(): Promise<AdminOverview> {\n  await requirePermission("metrics.view");', "export async function getAdminOverview(): Promise<AdminOverview> {");
    expect(unchecked).not.toBe(admin);
    expect(problems("lib/admin-db.ts", unchecked)).toEqual(["getAdminOverview must start with await requirePermission(…)"]);
    const noted = admin.replace('from "progress" where "done" and "done_at"', 'from "progress" where "done" and "note" <> \'\' and "done_at"');
    expect(noted).not.toBe(admin);
    expect(problems("lib/admin-db.ts", noted)).toEqual(["admin SQL that names note, link, token_hash or email"]);
  });

  it("every reviewed admin function exists and is exported", () => {
    const admin = readFileSync(path.join(WEB, "lib/admin-db.ts"), "utf8");
    for (const name of ADMIN_FILES.get("lib/admin-db.ts") ?? []) expect(admin).toContain(`export async function ${name}(`);
  });
});

describe("the checker catches", () => {
  const DATA = "lib/progress-db.ts";
  const header = `import { and, eq, ne, or, sql } from "drizzle-orm";\nimport { progress, progressEvent } from "@/db/schema";\nimport type { Db } from "@/db/client";\n`;
  const fn = (body: string) => `${header}export async function f(userId: string, db: Db) { ${body} }`;

  // Every probe from the M4a review, plus the original rules.
  it.each([
    // Review probes.
    ["the relational API in any file", "app/(app)/page.tsx", `const rows = await db.query.progress.findMany();`, "reaches progress through the relational API (db.query), which has no user filter"],
    ["the relational API by key", DATA, fn(`return db.query["progress_event"].findMany();`), "reaches progress_event through the relational API (db.query), which has no user filter"],
    ["a table inside a sql template", DATA, fn("return db.execute(sql`select * from ${progress}`);"), "uses the progress table outside .from(), .update(), .delete() or .insert()"],
    ["$count", DATA, fn(`return db.$count(progress);`), "uses the progress table outside .from(), .update(), .delete() or .insert()"],
    ["a left join", DATA, fn(`return db.select().from(progressEvent).leftJoin(progress, eq(progress.itemId, progressEvent.itemId)).where(eq(progressEvent.userId, userId));`), "uses the progress table outside .from(), .update(), .delete() or .insert()"],
    ["an inner join", DATA, fn(`return db.select().from(progress).innerJoin(progressEvent, sql\`true\`).where(eq(progress.userId, userId));`), "uses the progressEvent table outside .from(), .update(), .delete() or .insert()"],
    ["ne instead of eq", DATA, fn(`return db.select().from(progress).where(ne(progress.userId, userId));`), "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
    ["the filter under or", DATA, fn("return db.select().from(progress).where(or(eq(progress.userId, userId), sql`true`));"), "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
    ["raw user_id = user_id", DATA, fn("return db.execute(sql`select note from progress where user_id = user_id and ${userId} = ${userId}`);"), "from progress without a top-level user_id = $n condition"],
    ["raw user_id = $1 or true", "scripts/lib/import-core.mjs", `export async function f(db, userId) { return db.query("select note from progress where user_id = $1 or true", [userId]); }`, "from progress has a top-level or in its where clause"],
    ["the table in a variable", DATA, fn(`const t = progress; return db.select().from(t);`), "uses the progress table outside .from(), .update(), .delete() or .insert()"],
    ["an exported arrow function taking Db", DATA, `${header}export const f = async (db: Db, userId: string) => db.select().from(progress).where(eq(progress.userId, userId));`, "f must take userId: string as its required first argument"],
    ["a cached arrow function taking Db", DATA, `${header}export const f = cache(async (db: Db) => 1);`, "f must take userId: string as its required first argument"],
    // Further holes of the same kind.
    ["a filter on another value", DATA, fn(`const other = "x"; return db.select().from(progress).where(eq(progress.userId, other));`), "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
    ["a second where() replacing the first", DATA, fn(`return db.select().from(progress).where(eq(progress.userId, userId)).where(sql\`true\`);`), "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
    ["$dynamic()", DATA, fn(`return db.select().from(progress).where(eq(progress.userId, userId)).$dynamic();`), "from(progress) uses $dynamic(), which hides conditions from this check"],
    ["a query outside a userId function", DATA, `${header}export async function f(db: Db, id: string) { return 1; }\nasync function g(db: Db, id: string) { return db.select().from(progress).where(eq(progress.userId, id)); }`, "from(progress) outside a function with a userId parameter"],
    ["an update moving rows to another user", DATA, fn(`await db.update(progress).set({ userId: "someone-else" }).where(eq(progress.userId, userId));`), "update(progress) must set fields by name, never userId"],
    ["an insert for another user", DATA, fn(`await db.insert(progress).values({ userId: "someone-else", itemId: "l1-1" });`), "insert into progress without userId: userId in values()"],
    ["an upsert targeting the item alone", DATA, fn(`await db.insert(progress).values({ userId, itemId: "l1-1" }).onConflictDoUpdate({ target: progress.itemId, set: { done: true } });`), "upsert on progress without progress.userId in its target"],
    ["a select without where", DATA, fn(`return db.select().from(progress);`), "from(progress) needs one where() with eq(progress.userId, userId) at its top level"],
    ["a delete without where", DATA, fn(`await db.delete(progressEvent);`), "delete(progressEvent) needs one where() with eq(progressEvent.userId, userId) at its top level"],
    ["sql.identifier", DATA, fn(`return sql.identifier("progress");`), "names a per-user table through sql.identifier(), which hides it from this check"],
    ["raw SQL without a where", "scripts/lib/import-core.mjs", "const Q = `delete from \"progress_event\"`;", "from progress_event without a where clause"],
    ["a sub-query without its own filter", "scripts/lib/import-core.mjs", "const Q = `select * from progress where user_id = $1 and item_id in (select item_id from progress_event where kind = 'done')`;", "from progress_event without a top-level user_id = $n condition"],
    ["a raw insert without user_id", "scripts/lib/import-core.mjs", "const Q = `insert into progress (item_id, done) values ($1, $2)`;", "insert into progress without a user_id column"],
    ["an upsert on item_id alone", "scripts/lib/import-core.mjs", "const Q = `insert into progress (user_id, item_id) values ($1, $2) on conflict (item_id) do nothing`;", "on conflict without user_id in its target"],
    ["an upsert that moves rows", "scripts/lib/import-core.mjs", "const Q = `insert into progress (user_id, item_id) values ($1, $2) on conflict (user_id, item_id) do update set user_id = 'x'`;", "on conflict do update sets user_id"],
    ["a raw update that moves rows", "scripts/lib/import-core.mjs", "const Q = `update progress set user_id = $2 where user_id = $1`;", "update progress sets user_id"],
    ["an insert binding user_id to another value", DATA, fn("return db.execute(sql`insert into progress (user_id, item_id) values (${id}, ${id})`);"), "user_id is bound to ${id}, not the user's id"],
    ["an insert-select binding user_id to another value", DATA, fn("return db.execute(sql`insert into progress_event (user_id, item_id, kind) select ${other}, item_id, 'done' from up`);"), "user_id is bound to ${other}, not the user's id"],
    ["a parameter other than userId bound to user_id", "scripts/lib/import-core.mjs", `export async function f(db, userId, id) { return db.query("select note from progress where user_id = $2", [userId, id]); }`, "SQL on a per-user table that is not given userId"],
    ["SQL sent without userId", "scripts/lib/import-core.mjs", `export async function f(db, userId, id) { return db.query("select note from progress where user_id = $1", [id]); }`, "SQL on a per-user table that is not given userId"],
    ["SQL sent outside a userId function", "scripts/lib/import-core.mjs", `const Q = "select note from progress where user_id = $1";\nexport async function f(db, id) { return db.query(Q, [id]); }`, "SQL on a per-user table outside a function with a userId parameter"],
    ["a data function without userId first", DATA, `${header}export async function f(db: Db, userId: string) { return db.select().from(progress).where(eq(progress.userId, userId)); }`, "f must take userId: string as its required first argument"],
    ["an optional userId", DATA, `${header}export async function f(userId: string = "", db: Db) { return 1; }`, "f must take userId: string as its required first argument"],
  ])("%s", (_label, file, source, problem) => {
    expect(problems(file, source)).toContain(problem);
  });

  // M4b: user_settings and export_token are per-user tables too.
  it.each([
    ["an unscoped settings read", DATA, fn(`return db.select().from(userSettings);`), "from(userSettings) needs one where() with eq(userSettings.userId, userId) at its top level"],
    ["a settings update for everyone", DATA, fn(`await db.update(userSettings).set({ showScaler: true });`), "update(userSettings) needs one where() with eq(userSettings.userId, userId) at its top level"],
    ["an export key lookup without a user", DATA, fn("return db.execute(sql`select user_id from export_token where token_hash = ${id}`);"), "from export_token without a top-level user_id = $n condition"],
    ["raw SQL on user_settings outside the allowed files", "lib/settings.ts", "const q = `update user_settings set show_scaler = true where user_id = $1`;", "SQL that names a per-user table outside the allowed files"],
    ["an upsert on user_settings on another key", DATA, fn("return db.execute(sql`insert into user_settings (user_id) values (${userId}) on conflict (show_scaler) do nothing`);"), "on conflict without user_id in its target"],
    ["an upsert whose table is hidden in a placeholder", "lib/places.ts", "const q = sql`insert into ${t} (key) values ($1) on conflict (key) do nothing`;", "SQL that names a per-user table outside the allowed files"],
  ])("%s", (_label, file, source, problem) => {
    const withTables = source.replace('import { progress, progressEvent } from "@/db/schema";', 'import { progress, progressEvent, userSettings, exportToken } from "@/db/schema";');
    expect(problems(file, withTables)).toContain(problem);
  });

  describe("in an admin module", () => {
    const ADMIN = "lib/admin-db.ts";
    const top = `import { sql } from "drizzle-orm";\n`;
    it.each([
      ["an exported function without the permission check", `${top}export async function getAdminOverview() { return 1; }`, "getAdminOverview must start with await requirePermission(…)"],
      ["the check after other work", `${top}export async function getAdminOverview() { const db = await getDb(); await requirePermission("metrics.view"); }`, "getAdminOverview must start with await requirePermission(…)"],
      ["the check not awaited", `${top}export async function getAdminOverview() { requirePermission("metrics.view"); }`, "getAdminOverview must start with await requirePermission(…)"],
      ["an exported arrow function without it", `${top}export const f = async () => 1;`, "f must start with await requirePermission(…)"],
      ["cross-user SQL in a function not reviewed", `${top}export async function listAuditLog() { await requirePermission("audit.view"); return sql\`select count(*) from progress\`; }`, "cross-user SQL outside the reviewed admin functions"],
      ["cross-user SQL in a helper", `${top}async function helper() { return sql\`select count(*) from progress\`; }`, "cross-user SQL outside the reviewed admin functions"],
      ["note text", `${top}export async function listAdminUsers() { await requirePermission("users.view"); return sql\`select note from progress\`; }`, "admin SQL that names note, link, token_hash or email"],
      ["links", `${top}export async function listAdminUsers() { await requirePermission("users.view"); return sql\`select count(*) from progress where link <> ''\`; }`, "admin SQL that names note, link, token_hash or email"],
      ["emails", `${top}export async function listAdminUsers() { await requirePermission("users.view"); return sql\`select count(*) from progress p join "user" u on u.id = p.user_id where u.email like '%x'\`; }`, "admin SQL that names note, link, token_hash or email"],
      ["settings", `${top}export async function listAdminUsers() { await requirePermission("users.view"); return sql\`select * from user_settings\`; }`, "admin SQL that names user_settings or export_token"],
      ["a table object", `import { progress } from "@/db/schema";\n`, "imports the progress table: admin modules use reviewed SQL only"],
    ])("%s", (_label, source, problem) => {
      expect(problems(ADMIN, source)).toContain(problem);
    });

    it("accepts a reviewed count behind the permission check", () => {
      const ok = `${top}export async function listAdminUsers() {\n  const actor = await requirePermission("users.view");\n  return sql\`select count(*) from progress where done\`;\n}`;
      expect(problems(ADMIN, ok)).toEqual([]);
    });
  });

  it("any other file that imports the tables or writes SQL naming them", () => {
    const page = `import { progress } from "@/db/schema";\nconst q = "select note from progress where user_id = $1";`;
    expect(problems("app/(app)/page.tsx", page)).toEqual([
      "imports the progress table: only lib/progress-db.ts, lib/settings-db.ts, scripts/lib/import-core.mjs, scripts/e2e-seed.mjs may query it",
      "SQL that names a per-user table outside the allowed files",
    ]);
  });

  it("a reviewed cross-user statement only where it is listed, and only exactly as listed", () => {
    expect(problems("scripts/lib/migrate-check.mjs", `const q = "select count(*)::int as n from progress";`)).toEqual([]);
    expect(problems("scripts/lib/migrate-check.mjs", `const q = "select note from progress";`)).toContain("SQL that names a per-user table outside the allowed files");
    expect(problems("lib/data.ts", `const q = "select count(*)::int as n from progress";`)).toContain("SQL that names a per-user table outside the allowed files");
  });

  it("aliasing tricks that would hide a table", () => {
    expect(problems(DATA, `import { progress as p } from "@/db/schema";`)).toContain("renames the progress table on import, which hides it from this check");
    expect(problems(DATA, `import * as schema from "@/db/schema";`)).toContain("imports the schema as a namespace, which hides table use from this check");
  });
});

describe("the checker accepts", () => {
  it("scoped Drizzle queries", () => {
    const ok = `import { and, eq } from "drizzle-orm";\nimport { progress } from "@/db/schema";\nimport type { Db } from "@/db/client";\ntype Row = typeof progress.$inferSelect;
export async function f(userId: string, db: Db, id: string) {
  await db.select({ id: progress.itemId }).from(progress).where(and(eq(progress.userId, userId), eq(progress.itemId, id)));
  await db.update(progress).set({ done: true }).where(eq(progress.userId, userId));
  await db.insert(progress).values({ userId, itemId: id }).onConflictDoUpdate({ target: [progress.userId, progress.itemId], set: { done: true } });
}`;
    expect(problems("lib/progress-db.ts", ok)).toEqual([]);
  });

  it("scoped SQL", () => {
    expect(checkSqlText(`select item_id from progress where user_id = $1 and item_id = any($2)`)).toEqual([]);
    expect(checkSqlText(`select * from "progress" where ("progress"."user_id" = $1 and "progress"."item_id" = $2) order by 1`)).toEqual([]);
    expect(checkSqlText("select * from progress where user_id = ${userId} and (done or note <> '')")).toEqual([]);
    expect(checkSqlText(`insert into "progress" ("user_id", "item_id") values ($1, $2) on conflict ("user_id", "item_id") do nothing`)).toEqual([]);
    expect(checkSqlText(`update progress set done = true where user_id = $1`)).toEqual([]);
    // Mentions that are not table references.
    expect(checkSqlText(`select to_regclass('public.progress_event')`)).toEqual([]);
    expect(checkSqlText(`returning "progress".*`)).toEqual([]);
    // Upserts on tables that aren't per-user (app_setting, user_permission) are not this check's business.
    expect(checkSqlText(`insert into "app_setting" ("key", "value") values ('user_cap', $1) on conflict ("key") do update set "value" = excluded."value"`)).toEqual([]);
    expect(problems("lib/places.ts", "const q = `insert into \"app_setting\" (\"key\") values ($1) on conflict (\"key\") do nothing`;")).toEqual([]);
  });
});
