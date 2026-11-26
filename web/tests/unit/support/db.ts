// Test helpers: an in-memory database, a made-up owner and signed session cookies.
// All data here is invented. Nothing in this file is a real credential.
import { createHmac, randomBytes } from "node:crypto";
import { type Db, getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { account, adminAudit, appSetting, progress, progressEvent, session, user, userPermission, verification } from "@/db/schema";
import type { Permission, UserStatus } from "@/lib/access-types";

/** Values for a test run. The secret is random per run; the GitHub ids are made up. */
export const TEST_SECRET = randomBytes(32).toString("base64url");
export const OWNER_ID = "900000000001";
export const OTHER_ID = "900000000002";

export function setTestEnv() {
  process.env.BETTER_AUTH_SECRET = TEST_SECRET;
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.OWNER_GITHUB_ID = OWNER_ID;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.SIGNUP_MODE;
}

/** Forgets the app's memoised auth instances so the next call reads the environment again. */
export function resetAuth() {
  delete (globalThis as { __fdeJourneyAuth?: unknown }).__fdeJourneyAuth;
  delete (globalThis as { __fdeJourneySessionReader?: unknown }).__fdeJourneySessionReader;
}

/** The app's database under Vitest (in memory), emptied, with the starting cap of 100. */
export async function emptyDb(): Promise<Db> {
  const db = await getDb();
  await db.delete(progressEvent);
  await db.delete(progress);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  // Deleting users also deletes their settings, export keys and permissions (foreign keys).
  await db.delete(user);
  await db.delete(adminAudit);
  await db.delete(appSetting);
  await db.execute(sql`insert into "app_setting" ("key", "value") values ('user_cap', '100')`);
  return db;
}

/** Better Auth's signed cookie value: the token, ".", then an HMAC-SHA256 signature (base64). */
export function signedCookieValue(token: string, secret = TEST_SECRET) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

export interface SeedUser {
  githubId: string;
  userId: string;
  email: string;
  name?: string;
  githubLogin?: string | null;
  status?: UserStatus;
  permissions?: Permission[];
  createdAt?: Date;
  waitlistedAt?: Date | null;
}

/** Inserts a user with a GitHub account and a live session. Returns the session cookie header. */
export async function seedUser(db: Db, { githubId, userId, email, name = "Test User", githubLogin = null, status = "active", permissions = [], createdAt, waitlistedAt }: SeedUser) {
  const now = createdAt ?? new Date();
  await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    githubLogin,
    status,
    activatedAt: status === "active" ? now : null,
    waitlistedAt: status === "waitlisted" ? (waitlistedAt ?? now) : null,
  });
  for (const permission of permissions) await db.insert(userPermission).values({ userId, permission });
  await db.insert(account).values({ id: `${userId}-gh`, accountId: githubId, providerId: "github", userId, createdAt: now, updatedAt: now });
  const token = randomBytes(24).toString("base64url");
  const sessionStart = new Date();
  await db.insert(session).values({
    id: `${userId}-session`,
    token,
    userId,
    expiresAt: new Date(sessionStart.getTime() + 24 * 60 * 60 * 1000),
    createdAt: sessionStart,
    updatedAt: sessionStart,
  });
  return { token, cookie: `better-auth.session_token=${signedCookieValue(token)}` };
}

export const seedOwner = (db: Db) => seedUser(db, { githubId: OWNER_ID, userId: "owner", email: "owner@example.com" });
export const seedOtherUser = (db: Db) => seedUser(db, { githubId: OTHER_ID, userId: "other", email: "someone@example.com" });

type Runner = { query: (...args: unknown[]) => Promise<unknown> };
type Client = Runner & { transaction: (fn: (tx: Runner) => Promise<unknown>, ...rest: unknown[]) => Promise<unknown> };
const recorded = new WeakMap<object, string[]>();

/**
 * Every SQL statement the in-memory database runs from now on, statements inside transactions
 * included (PGlite runs those on a separate handle). Patches the database's client once; clear the
 * returned array (`length = 0`) to start again.
 */
export function recordStatements(db: Db): string[] {
  const client = (db as unknown as { $client: Client }).$client;
  const existing = recorded.get(client);
  if (existing) return existing;
  const statements: string[] = [];
  const record = (runner: Runner) => {
    const real = runner.query.bind(runner);
    runner.query = (...args: unknown[]) => {
      if (typeof args[0] === "string") statements.push(args[0]);
      return real(...args);
    };
  };
  record(client);
  const realTransaction = client.transaction.bind(client);
  client.transaction = (fn, ...rest) =>
    realTransaction((tx: Runner) => {
      record(tx);
      return fn(tx);
    }, ...rest);
  recorded.set(client, statements);
  return statements;
}
