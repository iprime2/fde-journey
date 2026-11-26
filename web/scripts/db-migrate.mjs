// Applies pending migrations (db/migrations) to the Neon database in DATABASE_URL:
//   DATABASE_URL=postgresql://… npm run db:migrate
// Uses Neon's WebSocket pool so all pending migrations run in one transaction (the HTTP driver
// the app uses cannot do that). Local PGlite databases migrate themselves; this is only for Neon.
// Prints counts only.
//
// Before migration 0002 (progress per user) it also needs OWNER_GITHUB_ID, and refuses unless
// the only user is the owner (scripts/lib/migrate-check.mjs).
import { readFileSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS_FOLDER, errorSummary } from "./lib/db.mjs";
import { checkBeforeMigrate } from "./lib/migrate-check.mjs";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set. Local PGlite databases apply migrations automatically; this command is for Neon.");
  process.exit(2);
}
if (process.env.E2E_AUTH) {
  console.error("E2E_AUTH is set. Refusing to migrate a real database from a test environment.");
  process.exit(2);
}

const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
  import("@neondatabase/serverless"),
  import("drizzle-orm/neon-serverless"),
  import("drizzle-orm/neon-serverless/migrator"),
]);

const pool = new Pool({ connectionString: url });
const countApplied = async () => {
  const { rows } = await pool.query("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
  if (!rows[0]?.present) return 0;
  const result = await pool.query("select count(*)::int as n from drizzle.__drizzle_migrations");
  return result.rows[0].n;
};

try {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"));
  const check = await checkBeforeMigrate(async (text, params) => (await pool.query(text, params)).rows, process.env, journal);
  if (!check.ok) {
    console.error(`Migration refused: ${check.reason}`);
    process.exitCode = 2;
  } else {
    if (check.checked) console.log("Owner check passed: the only user is the owner.");
    const before = await countApplied();
    await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_FOLDER });
    const after = await countApplied();
    console.log(`Migrations: ${after - before} applied now, ${after} in total.`);
  }
} catch (error) {
  // The scripts' own messages, or names and codes only (look the Postgres code up): a failed
  // query's message quotes its parameters.
  console.error(`Migration failed: ${errorSummary(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
