// Database connection. Server-only.
//
// - DATABASE_URL set: Neon over HTTP (drizzle-orm/neon-http). Each query is one HTTPS request,
//   so there is no connection to open, keep or leak between serverless invocations. Every write
//   in this app is a single statement, so the driver's lack of interactive transactions does not
//   matter. Migrations are applied separately by `npm run db:migrate` (a WebSocket pool, so the
//   whole migration runs in one transaction).
// - Otherwise: PGlite, an in-process Postgres. Stored in .data/pglite (or PGLITE_DIR) for local
//   development, in memory under Vitest. Migrations apply automatically on first use.
import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { authSchema } from "./schema";

/**
 * The tables Drizzle's relational API (`db.query.*`) can reach: Better Auth's only. The per-user
 * tables (`progress`, `progress_event`) are left out on purpose, so they can't be read with
 * `db.query.progress.findMany()` and no user filter. Query them through lib/progress-db.ts.
 */
const schema = authSchema;
export type Schema = typeof schema;
/** The query API shared by the Neon and PGlite drivers. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export type DbConfig = { kind: "neon"; url: string } | { kind: "pglite"; dataDir: string | null };

type Env = Record<string, string | undefined>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

/** Chooses the database from the environment. Throws a clear error for unsafe set-ups. */
export function dbConfigFromEnv(env: Env, cwd = process.cwd()): DbConfig {
  const url = env.DATABASE_URL?.trim();
  if (url) {
    if (env.E2E_AUTH) {
      throw new Error("E2E_AUTH is set, so the app refuses to use DATABASE_URL. End-to-end tests only run on a local PGlite folder.");
    }
    if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
    return { kind: "neon", url };
  }
  if (env.VERCEL) throw new Error("DATABASE_URL is required on Vercel. The local PGlite database is for development only.");
  if (env.VITEST || env.NODE_ENV === "test") return { kind: "pglite", dataDir: null };
  const dir = env.PGLITE_DIR?.trim();
  if (dir === "memory://") return { kind: "pglite", dataDir: null };
  return { kind: "pglite", dataDir: path.resolve(cwd, dir || path.join(".data", "pglite")) };
}

/**
 * Opens a database. Exported for tests, which create their own in-memory databases.
 * `timeoutMs` (Neon only): every request is aborted after that long. Only the proxy's own client
 * sets it (getGateDb); page and action queries keep the driver's default.
 */
export async function openDb(config: DbConfig, { timeoutMs }: { timeoutMs?: number } = {}): Promise<Db> {
  if (config.kind === "neon") {
    const [{ neon }, { drizzle }] = await Promise.all([import("@neondatabase/serverless"), import("drizzle-orm/neon-http")]);
    // The driver spreads fetchOptions into each request's fetch() call, so the getter gives every
    // request a fresh timer (one fixed signal would expire for good after the first wait).
    const options = timeoutMs
      ? {
          fetchOptions: {
            get signal() {
              return AbortSignal.timeout(timeoutMs);
            },
          },
        }
      : undefined;
    return drizzle({ client: neon(config.url, options), schema }) as unknown as Db;
  }
  // Loaded from node_modules at run time, never bundled or traced (turbopackIgnore): PGlite is for
  // local development and e2e only, and is about 21 MB. Without this, every deployed function, the
  // proxy included, would carry it (Next 16's Turbopack doesn't apply outputFileTracingExcludes to
  // the proxy). On Vercel this branch never runs: dbConfigFromEnv requires DATABASE_URL there.
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import(/* turbopackIgnore: true */ "@electric-sql/pglite"),
    import(/* turbopackIgnore: true */ "drizzle-orm/pglite"),
    import(/* turbopackIgnore: true */ "drizzle-orm/pglite/migrator"),
  ]);
  if (config.dataDir) mkdirSync(config.dataDir, { recursive: true });
  const client = config.dataDir ? new PGlite(config.dataDir) : new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Db;
}

// One connection per process. Kept on globalThis so hot reloads in development reuse it: two
// PGlite instances must never open the same folder. The proxy runs in the same process (Next 16
// loads it with require), so it shares this one too.
const store = globalThis as typeof globalThis & { __fdeJourneyDb?: Promise<Db>; __fdeJourneyGateDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!store.__fdeJourneyDb) {
    store.__fdeJourneyDb = openDb(dbConfigFromEnv(process.env)).catch((error: unknown) => {
      store.__fdeJourneyDb = undefined;
      throw error;
    });
  }
  return store.__fdeJourneyDb;
}

/** How long the proxy waits for one status query on Neon before giving up on that try. */
export const GATE_QUERY_TIMEOUT_MS = 5000;

/**
 * The proxy's database (lib/session-gate.ts). On Neon, its own client whose every request is
 * aborted after GATE_QUERY_TIMEOUT_MS, so a slow database can't hold every page visit. With PGlite,
 * the shared in-process instance (getDb): there is no network to wait on.
 */
export function getGateDb(): Promise<Db> {
  const config = dbConfigFromEnv(process.env);
  if (config.kind !== "neon") return getDb();
  if (!store.__fdeJourneyGateDb) {
    store.__fdeJourneyGateDb = openDb(config, { timeoutMs: GATE_QUERY_TIMEOUT_MS }).catch((error: unknown) => {
      store.__fdeJourneyGateDb = undefined;
      throw error;
    });
  }
  return store.__fdeJourneyGateDb;
}
