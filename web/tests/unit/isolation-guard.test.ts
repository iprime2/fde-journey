// Guard: no query on progress or progress_event runs without a user filter.
//
// Static: reads every source file of the app and its scripts with the TypeScript parser and
// applies the rules in support/query-guard.ts. The second half feeds the checker small bad
// examples, so a checker that stopped finding anything would fail here too.
// The runtime half (every statement actually sent to the database) is in isolation.test.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSource, checkSqlText } from "./support/query-guard";

const WEB = process.cwd();
/** Where the app's and the scripts' code lives. Tests and generated files are not scanned. */
const ROOTS = ["app", "components", "lib", "db", "scripts", "content", "proxy.ts"];
const SKIP = new Set(["node_modules", ".next", ".data", "migrations", "tests"]);
/** The only files that may touch the per-user tables. */
const ALLOWED = new Set([
  "lib/progress-db.ts", // the app's data layer
  "scripts/lib/import-core.mjs", // npm run db:import, for the owner
  "scripts/e2e-seed.mjs", // end-to-end test data
]);

function sourceFiles(rel: string): string[] {
  const full = path.join(WEB, rel);
  if (statSync(full).isFile()) return /\.(ts|tsx|mjs|js)$/.test(rel) ? [rel] : [];
  return readdirSync(full).flatMap((name) => (SKIP.has(name) ? [] : sourceFiles(path.join(rel, name))));
}

const files = ROOTS.flatMap(sourceFiles).filter((f) => f !== "db/schema.ts");
const check = (rel: string, source: string, allowed = ALLOWED) => checkSource(rel, source, { allowed });

describe("every query on progress and progress_event is scoped to a user", () => {
  it("scans the app's code", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("lib/progress-db.ts");
    expect(files).toContain("app/actions/progress.ts");
    expect(files).toContain("scripts/lib/import-core.mjs");
  });

  it("finds no unscoped query", () => {
    const findings = files.flatMap((rel) => check(rel, readFileSync(path.join(WEB, rel), "utf8")));
    expect(findings).toEqual([]);
  });

  it("finds the queries it is meant to check (so a silent parser change can't pass it)", () => {
    // Count what the checker looks at in the data layer: if it saw nothing, the rules above would
    // pass vacuously.
    const dataLayer = readFileSync(path.join(WEB, "lib/progress-db.ts"), "utf8");
    expect(dataLayer.match(/\.from\((progress|progressEvent)\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(dataLayer).toMatch(/insert into "progress" \("user_id"/);
    expect(dataLayer).toMatch(/insert into "progress_event" \("user_id"/);
    // Remove the filter from one query and the checker objects.
    const broken = dataLayer.replace(".where(eq(progress.userId, userId));", ";");
    expect(broken).not.toBe(dataLayer);
    expect(check("lib/progress-db.ts", broken)).toEqual([expect.objectContaining({ problem: "from(progress) without a where() on progress.userId" })]);
  });
});

describe("the checker itself", () => {
  const DATA = "lib/progress-db.ts";
  const header = `import { progress, progressEvent } from "@/db/schema";\nimport type { Db } from "@/db/client";\n`;

  it.each([
    ["a select without where", `export async function f(userId: string, db: Db) { return db.select().from(progress); }`, "from(progress) without a where() on progress.userId"],
    [
      "a select filtered on the item only",
      `export async function f(userId: string, db: Db, id: string) { return db.select().from(progressEvent).where(eq(progressEvent.itemId, id)); }`,
      "from(progressEvent) without a where() on progressEvent.userId",
    ],
    ["an update without where", `export async function f(userId: string, db: Db) { await db.update(progress).set({ done: true }); }`, "update(progress) without a where() on progress.userId"],
    ["a delete without where", `export async function f(userId: string, db: Db) { await db.delete(progressEvent); }`, "delete(progressEvent) without a where() on progressEvent.userId"],
    ["an insert without userId", `export async function f(userId: string, db: Db) { await db.insert(progress).values({ itemId: "l1-1" }); }`, "insert into progress without userId in values()"],
    ["raw SQL without user_id", "export async function f(userId: string, db: Db) { await db.execute(sql`select * from progress where item_id = ${'$'}{id}`); }", "from progress without a user_id = condition"],
    ["a raw delete", "const Q = `delete from \"progress_event\"`;", "from progress_event without a user_id = condition"],
    ["a raw insert without user_id", "const Q = `insert into progress (item_id, done) values ($1, $2)`;", "insert into progress without a user_id column"],
    ["an upsert on item_id alone", "const Q = `insert into progress (user_id, item_id) values ($1, $2) on conflict (item_id) do nothing`;", "on conflict without user_id in its target"],
    ["a data function without userId first", `export async function f(db: Db, userId: string) { return db.select().from(progress).where(eq(progress.userId, userId)); }`, "f must take userId: string as its required first argument"],
    ["an optional userId", `export async function f(userId: string = "", db: Db) { return 1; }`, "f must take userId: string as its required first argument"],
  ])("flags %s", (_label, body, problem) => {
    expect(check(DATA, header + body).map((f) => f.problem)).toContain(problem);
  });

  it("flags any other file that imports the tables or writes SQL naming them", () => {
    const page = `import { progress } from "@/db/schema";\nconst q = "select note from progress where user_id = $1";`;
    expect(check("app/(app)/page.tsx", page).map((f) => f.problem)).toEqual([
      "imports the progress table: only lib/progress-db.ts, scripts/lib/import-core.mjs, scripts/e2e-seed.mjs may query it",
      "SQL that names a per-user table outside the allowed files",
    ]);
  });

  it("flags aliasing tricks that would hide a table from it", () => {
    expect(check(DATA, `import { progress as p } from "@/db/schema";`).map((f) => f.problem)).toContain(
      "renames the progress table on import, which hides it from this check",
    );
    expect(check(DATA, `import * as schema from "@/db/schema";`).map((f) => f.problem)).toContain(
      "imports the schema as a namespace, which hides table use from this check",
    );
  });

  it("accepts scoped queries", () => {
    expect(checkSqlText(`select item_id from progress where user_id = $1 and item_id = any($2)`)).toEqual([]);
    expect(checkSqlText(`insert into "progress" ("user_id", "item_id") values ($1, $2) on conflict ("user_id", "item_id") do nothing`)).toEqual([]);
    expect(checkSqlText(`update progress set done = true where user_id = $1`)).toEqual([]);
    // Mentions that are not table references.
    expect(checkSqlText(`select to_regclass('public.progress_event')`)).toEqual([]);
    expect(checkSqlText(`returning "progress".*`)).toEqual([]);
  });
});
