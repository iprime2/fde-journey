// Database access for the command-line scripts (import, migrate, end-to-end seed). Same rules as
// the app (db/client.ts): DATABASE_URL means Neon, otherwise a local PGlite folder.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeError } from "../../lib/error-chain.mjs";

/**
 * An error the scripts raise themselves, with a message written for the operator (no data in it).
 * Only these messages are printed; anything else prints as errorSummary().
 */
export class ScriptError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "ScriptError";
  }
}

/**
 * How a script reports a failure: a ScriptError's own message, otherwise names and codes only
 * (lib/error-chain.mjs), for example "DrizzleQueryError < DatabaseError 42P07". Database messages
 * quote the query's parameters and sometimes the row, so they are never printed.
 * @param {unknown} error
 * @returns {string}
 */
export function errorSummary(error) {
  return error instanceof ScriptError ? error.message : describeError(error);
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(here, "..", "..");
export const MIGRATIONS_FOLDER = path.join(WEB_DIR, "db", "migrations");

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ kind: "neon", url: string } | { kind: "pglite", dataDir: string | null }}
 */
export function scriptDbConfig(env) {
  const url = env.DATABASE_URL?.trim();
  if (url) {
    if (env.E2E_AUTH) throw new ScriptError("E2E_AUTH is set, so DATABASE_URL is refused.");
    if (!/^postgres(ql)?:\/\//.test(url)) throw new ScriptError("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
    return { kind: "neon", url };
  }
  if (env.VERCEL) throw new ScriptError("DATABASE_URL is required on Vercel.");
  const dir = env.PGLITE_DIR?.trim();
  if (dir === "memory://") return { kind: "pglite", dataDir: null };
  return { kind: "pglite", dataDir: path.resolve(WEB_DIR, dir || path.join(".data", "pglite")) };
}

/**
 * Opens the database. PGlite gets its migrations applied; Neon must already be migrated
 * (`npm run db:migrate`).
 * @returns {Promise<{ kind: string, query: (text: string, params?: unknown[]) => Promise<any[]>, close: () => Promise<void> }>}
 */
export async function openScriptDb(config) {
  if (config.kind === "neon") {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(config.url);
    const db = { kind: "neon", query: (text, params = []) => sql.query(text, params), close: async () => {} };
    // progress_event arrives with migration 0002 (progress per user), which the import needs.
    const [row] = await db.query("select to_regclass('public.progress_event') is not null as ready");
    if (!row?.ready) throw new ScriptError("The database is not migrated to per-user progress yet. Run `npm run db:migrate` first.");
    return db;
  }
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  if (config.dataDir) mkdirSync(config.dataDir, { recursive: true });
  const client = config.dataDir ? new PGlite(config.dataDir) : new PGlite();
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    kind: "pglite",
    query: async (text, params = []) => (await client.query(text, params)).rows,
    close: () => client.close(),
  };
}

