// Test helpers: an in-memory database, a made-up owner and signed session cookies.
// All data here is invented. Nothing in this file is a real credential.
import { createHmac, randomBytes } from "node:crypto";
import { type Db, getDb } from "@/db/client";
import { account, progress, progressEvent, session, user, verification } from "@/db/schema";

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
}

/** Forgets the app's memoised auth instances so the next call reads the environment again. */
export function resetAuth() {
  delete (globalThis as { __fdeJourneyAuth?: unknown }).__fdeJourneyAuth;
  delete (globalThis as { __fdeJourneySessionReader?: unknown }).__fdeJourneySessionReader;
}

/** The app's database under Vitest (in memory), emptied. */
export async function emptyDb(): Promise<Db> {
  const db = await getDb();
  await db.delete(progressEvent);
  await db.delete(progress);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
  return db;
}

/** Better Auth's signed cookie value: the token, ".", then an HMAC-SHA256 signature (base64). */
export function signedCookieValue(token: string, secret = TEST_SECRET) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

/** Inserts a user with a GitHub account and a live session. Returns the session cookie header. */
export async function seedUser(db: Db, { githubId, userId, email }: { githubId: string; userId: string; email: string }) {
  const now = new Date();
  await db.insert(user).values({ id: userId, name: "Test User", email, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(account).values({ id: `${userId}-gh`, accountId: githubId, providerId: "github", userId, createdAt: now, updatedAt: now });
  const token = randomBytes(24).toString("base64url");
  await db.insert(session).values({
    id: `${userId}-session`,
    token,
    userId,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  return { token, cookie: `better-auth.session_token=${signedCookieValue(token)}` };
}

export const seedOwner = (db: Db) => seedUser(db, { githubId: OWNER_ID, userId: "owner", email: "owner@example.com" });
export const seedOtherUser = (db: Db) => seedUser(db, { githubId: OTHER_ID, userId: "other", email: "someone@example.com" });
