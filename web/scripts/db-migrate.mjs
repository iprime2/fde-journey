// Applies pending migrations (db/migrations) to the Neon database in DATABASE_URL:
//   DATABASE_URL=postgresql://… npm run db:migrate
// Uses Neon's WebSocket pool so all pending migrations run in one transaction (the HTTP driver
// the app uses cannot do that). Local PGlite databases migrate themselves; this is only for Neon.
// Prints counts only.
import { MIGRATIONS_FOLDER } from "./lib/db.mjs";

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
  const before = await countApplied();
  await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_FOLDER });
  const after = await countApplied();
  console.log(`Migrations: ${after - before} applied now, ${after} in total.`);
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
