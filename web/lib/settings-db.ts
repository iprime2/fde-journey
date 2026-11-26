// Reads and writes of the user_settings and export_token tables. Server-only.
//
// Isolation rule (M4), as in lib/progress-db.ts: every function takes the user's id as its required
// first argument, and every query filters on it. Callers get the id from the server session only
// (requireUser() in lib/session.ts). tests/unit/isolation-guard.test.ts fails if a query here, or
// anywhere else, lacks the filter. The one lookup that can't have it (finding a key's user from the
// key's hash, for /api/export) is the reviewed statement in lib/export-auth.ts.
import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { exportToken, userSettings } from "@/db/schema";
import type { SwitchableSection } from "./access-types";
import { runLocked } from "./places";

/** A user id from the session: a non-empty string. Anything else is a bug, so it throws. */
function checkUserId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0) throw new Error("A user id is required for settings queries.");
}

export interface SettingsRow {
  reading: boolean;
  scaler: boolean;
  certs: boolean;
  projects: boolean;
  career: boolean;
  scalerUnlockedAt: Date | null;
}

/** The user's stored choices, or null when they have never changed one (the defaults apply). */
export async function readSettingsRow(userId: string, db: Db): Promise<SettingsRow | null> {
  checkUserId(userId);
  const rows = await db
    .select({
      reading: userSettings.showReading,
      scaler: userSettings.showScaler,
      certs: userSettings.showCerts,
      projects: userSettings.showProjects,
      career: userSettings.showCareer,
      scalerUnlockedAt: userSettings.scalerUnlockedAt,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Turns a section on or off (not Scaler on: see showScaler). A first change creates the row with
 * the defaults for everything else.
 */
export async function setSection(userId: string, db: Db, section: Exclude<SwitchableSection, "scaler">, on: boolean, now = new Date()): Promise<void> {
  checkUserId(userId);
  switch (section) {
    case "reading":
      await db.insert(userSettings).values({ userId, showReading: on, updatedAt: now }).onConflictDoUpdate({ target: userSettings.userId, set: { showReading: on, updatedAt: now } });
      return;
    case "certs":
      await db.insert(userSettings).values({ userId, showCerts: on, updatedAt: now }).onConflictDoUpdate({ target: userSettings.userId, set: { showCerts: on, updatedAt: now } });
      return;
    case "projects":
      await db.insert(userSettings).values({ userId, showProjects: on, updatedAt: now }).onConflictDoUpdate({ target: userSettings.userId, set: { showProjects: on, updatedAt: now } });
      return;
    case "career":
      await db.insert(userSettings).values({ userId, showCareer: on, updatedAt: now }).onConflictDoUpdate({ target: userSettings.userId, set: { showCareer: on, updatedAt: now } });
      return;
  }
}

/**
 * Scaler on or off. On only works once the section is unlocked (the access code, or the owner's
 * row); returns false and changes nothing otherwise. The database refuses it too
 * (user_settings_scaler_unlocked).
 */
export async function setScaler(userId: string, db: Db, on: boolean, now = new Date()): Promise<boolean> {
  checkUserId(userId);
  if (!on) {
    await db.insert(userSettings).values({ userId, showScaler: false, updatedAt: now }).onConflictDoUpdate({ target: userSettings.userId, set: { showScaler: false, updatedAt: now } });
    return true;
  }
  const rows = await db
    .update(userSettings)
    .set({ showScaler: true, updatedAt: now })
    .where(and(eq(userSettings.userId, userId), sql`${userSettings.scalerUnlockedAt} is not null`))
    .returning({ on: userSettings.showScaler });
  return rows.length > 0;
}

/** The owner's row: every section on and Scaler unlocked. Keeps any choices already made. */
export async function ensureOwnerSettings(userId: string, db: Db, now = new Date()): Promise<void> {
  checkUserId(userId);
  await db
    .insert(userSettings)
    .values({ userId, showReading: true, showScaler: true, showCerts: true, showProjects: true, showCareer: true, scalerUnlockedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set: { scalerUnlockedAt: sql`coalesce(${userSettings.scalerUnlockedAt}, excluded."scaler_unlocked_at")` } });
}

/** Wrong access-code tries allowed per user per hour (M4-DESIGN 10.2). */
export const SCALER_TRIES_PER_HOUR = 5;

/**
 * Takes one access-code try from the user's allowance, atomically: returns the try's number in the
 * current hour, or null when the user has used all of them (nothing is counted then). A correct code
 * resets the count (unlockScaler).
 */
export async function takeScalerTry(userId: string, db: Db): Promise<number | null> {
  checkUserId(userId);
  await db.execute(sql`insert into "user_settings" ("user_id") values (${userId}) on conflict ("user_id") do nothing`);
  const result = (await db.execute(sql`
    update "user_settings" set
      "scaler_attempts" = case when "scaler_attempts_since" is null or "scaler_attempts_since" < now() - interval '1 hour' then 1 else "scaler_attempts" + 1 end,
      "scaler_attempts_since" = case when "scaler_attempts_since" is null or "scaler_attempts_since" < now() - interval '1 hour' then now() else "scaler_attempts_since" end
    where "user_id" = ${userId}
      and ("scaler_attempts_since" is null or "scaler_attempts_since" < now() - interval '1 hour' or "scaler_attempts" < ${SCALER_TRIES_PER_HOUR})
    returning "scaler_attempts"`)) as unknown as { rows: { scaler_attempts: number | string }[] };
  const row = result.rows[0];
  return row ? Number(row.scaler_attempts) : null;
}

/** A correct code: unlock Scaler, switch it on and clear the tries. Keeps the first unlock time. */
export async function unlockScaler(userId: string, db: Db, now = new Date()): Promise<void> {
  checkUserId(userId);
  await db
    .update(userSettings)
    .set({ scalerUnlockedAt: sql`coalesce(${userSettings.scalerUnlockedAt}, ${now.toISOString()}::timestamptz)`, showScaler: true, scalerAttempts: 0, scalerAttemptsSince: null, updatedAt: now })
    .where(eq(userSettings.userId, userId));
}

// ---- Claude export keys

export interface ExportKeyRow {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** Keys a user may hold at once. */
export const EXPORT_KEYS_MAX = 5;

/** The user's keys that still work, oldest first. Never the hash. */
export async function listExportKeys(userId: string, db: Db): Promise<ExportKeyRow[]> {
  checkUserId(userId);
  return db
    .select({ id: exportToken.id, createdAt: exportToken.createdAt, lastUsedAt: exportToken.lastUsedAt })
    .from(exportToken)
    .where(and(eq(exportToken.userId, userId), isNull(exportToken.revokedAt)))
    .orderBy(asc(exportToken.createdAt));
}

/**
 * Stores a new key's hash, unless the user already has EXPORT_KEYS_MAX working keys (then null).
 * Exact even when two keys are made at once: the count and the insert run under a lock for this
 * user (a transaction-scoped advisory lock; lib/places.ts runLocked explains why a single statement
 * isn't enough).
 */
export async function addExportKey(userId: string, db: Db, tokenHash: string): Promise<ExportKeyRow | null> {
  checkUserId(userId);
  const rows = await runLocked<{ id: string; created_ms: number | string }>(
    db,
    sql`
    insert into "export_token" ("user_id", "token_hash")
    select ${userId}, ${tokenHash}
    where (select count(*) from "export_token" where "user_id" = ${userId} and "revoked_at" is null) < ${EXPORT_KEYS_MAX}
    returning "id", (extract(epoch from "created_at") * 1000)::float8 as created_ms`,
    sql`select pg_advisory_xact_lock(7243, hashtext(${userId}))`,
  );
  const row = rows[0];
  return row ? { id: row.id, createdAt: new Date(Number(row.created_ms)), lastUsedAt: null } : null;
}

/** Revokes one of the user's keys. False when it isn't theirs or was already revoked. */
export async function revokeExportKey(userId: string, db: Db, keyId: string, now = new Date()): Promise<boolean> {
  checkUserId(userId);
  const rows = await db
    .update(exportToken)
    .set({ revokedAt: now })
    .where(and(eq(exportToken.userId, userId), eq(exportToken.id, keyId), isNull(exportToken.revokedAt)))
    .returning({ id: exportToken.id });
  return rows.length > 0;
}
