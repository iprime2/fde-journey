// Settings, the waitlist place and "your data", for pages and Server Actions. Server-only.
//
// Each read takes the user from the session (requireUser) and reads only that user's rows through
// the scoped data layer (lib/settings-db.ts, lib/progress-db.ts). Request-time data: call these
// inside a <Suspense> boundary.
import "server-only";
import { eq, sql } from "drizzle-orm";
import { type Db, getDb } from "@/db/client";
import { adminAudit, user } from "@/db/schema";
import type { SectionChoices } from "./access-types";
import { istDate } from "./dates";
import { waitlistPosition } from "./places";
import { readEvents, readProgress } from "./progress-db";
import { withSafeErrors } from "./safe-log";
import { type SectionSettings, effectiveSections } from "./sections";
import { requireUser } from "./session";
import { listExportKeys, readSettingsRow } from "./settings-db";

/** A user's sections, as stored or by default (the owner's are all on). */
export async function sectionSettingsFor(db: Db, userId: string, isSuperAdmin: boolean): Promise<SectionSettings> {
  return effectiveSections(await readSettingsRow(userId, db), isSuperAdmin);
}

export interface MySettings extends SectionSettings {
  /** The GitHub username to type when deleting the account (null until the next sign-in). */
  githubLogin: string | null;
  /** The owner's account can't be deleted from the app. */
  canDeleteAccount: boolean;
}

/** The signed-in user's Settings page. Redirects as requireUser() does. */
export async function getMySettings(): Promise<MySettings> {
  const me = await requireUser();
  return withSafeErrors("Reading settings", async () => {
    const settings = await sectionSettingsFor(await getDb(), me.userId, me.isSuperAdmin);
    return { ...settings, githubLogin: me.githubLogin, canDeleteAccount: !me.isSuperAdmin };
  });
}

/** Just the sections, for the navigation and Home. */
export async function getMySections(): Promise<SectionChoices> {
  return (await getMySettings()).sections;
}

export interface ExportKeyView {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** The signed-in user's Claude export keys (never the key or its hash). */
export async function getMyExportKeys(): Promise<ExportKeyView[]> {
  const me = await requireUser();
  return withSafeErrors("Reading export keys", async () => {
    const rows = await listExportKeys(me.userId, await getDb());
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
  });
}

export interface WaitlistView {
  name: string;
  image: string | null;
  /** 1 is next in line. */
  place: number;
  joinedAt: string;
}

/**
 * The /waitlist page: the signed-in waitlisted user's place, or null for an active user (the page
 * then goes to Home). Signed-out and suspended visitors are redirected as by requireUser().
 */
export async function getMyWaitlistPlace(): Promise<WaitlistView | null> {
  const me = await requireUser({ allowWaitlisted: true });
  if (me.status !== "waitlisted") return null;
  return withSafeErrors("Reading the waitlist place", async () => {
    const position = await waitlistPosition(await getDb(), me.userId);
    return position ? { name: me.name, image: me.image, place: position.place, joinedAt: position.joinedAt.toISOString() } : null;
  });
}

// ---- Your data

export interface ProgressItemExport {
  itemId: string;
  done: boolean;
  note: string;
  link: string;
  doneAt: string | null;
  updatedAt: string | null;
}

/** Everything a user has saved, as "Download my data" gives it. Only that user's rows. */
export interface MyData {
  format: "fde-journey-data";
  version: 1;
  exportedAt: string;
  profile: { name: string; githubLogin: string | null };
  settings: SectionSettings & { scalerUnlockedAt: string | null };
  progress: ProgressItemExport[];
  events: { itemId: string; kind: string; at: string }[];
}

async function progressList(db: Db, userId: string): Promise<ProgressItemExport[]> {
  const progress = await readProgress(userId, db);
  return [...progress.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([itemId, r]) => ({ itemId, ...r }));
}

/** "Download my data" for one user. The caller takes `userId` from the session. */
export async function buildMyData(db: Db, userId: string, isSuperAdmin: boolean, now = new Date()): Promise<MyData> {
  const [profileRows, settingsRow, progress, events] = await Promise.all([
    db.select({ name: user.name, githubLogin: user.githubLogin }).from(user).where(eq(user.id, userId)).limit(1),
    readSettingsRow(userId, db),
    progressList(db, userId),
    readEvents(userId, db),
  ]);
  const profile = profileRows[0] ?? { name: "", githubLogin: null };
  return {
    format: "fde-journey-data",
    version: 1,
    exportedAt: now.toISOString(),
    profile: { name: profile.name, githubLogin: profile.githubLogin },
    settings: { ...effectiveSections(settingsRow, isSuperAdmin), scalerUnlockedAt: settingsRow?.scalerUnlockedAt?.toISOString() ?? null },
    progress,
    events,
  };
}

/** The download's file name: `fde-journey-data-{YYYY-MM-DD}.json`, date in IST (design spec 5). */
export const myDataFileName = (now = new Date()) => `fde-journey-data-${istDate(now.getTime())}.json`;

/** What `/api/export` returns to a Claude session: the user's sections and progress, nothing else. */
export interface ClaudeExport {
  format: "fde-journey-export";
  version: 1;
  exportedAt: string;
  sections: SectionChoices;
  progress: ProgressItemExport[];
}

/** The Claude export for the key's user (the caller looked the key up; lib/export-auth.ts). */
export async function buildClaudeExport(db: Db, userId: string, isSuperAdmin: boolean, now = new Date()): Promise<ClaudeExport> {
  const [settings, progress] = await Promise.all([sectionSettingsFor(db, userId, isSuperAdmin), progressList(db, userId)]);
  return { format: "fde-journey-export", version: 1, exportedAt: now.toISOString(), sections: settings.sections, progress };
}

// ---- Deleting an account

/**
 * Deletes the user and, through the foreign keys, everything that is theirs: sessions, GitHub
 * account link, progress, events, settings, export keys and permissions. The audit log keeps its
 * rows with the person shown as "a deleted account" (user ids set to null), and gets one more:
 * `account_deleted`, with no user on it at all. One statement, so both happen or neither does.
 * `onlyStatus` limits it to a user with that status (leaving the waitlist). Returns whether a user
 * was deleted. Never call it for the owner; the callers check.
 */
export async function deleteUserAccount(db: Db, userId: string, onlyStatus: "waitlisted" | null): Promise<boolean> {
  const result = (await db.execute(sql`
    with gone as (
      delete from ${user} where ${user.id} = ${userId} ${onlyStatus ? sql`and ${user.status} = ${onlyStatus}` : sql``}
      returning ${user.status} as status
    ), aud as (
      insert into ${adminAudit} ("actor_user_id", "action", "target_user_id", "details")
      select null, 'account_deleted', null, jsonb_build_object('status', gone.status) from gone
    )
    select count(*)::int as n from gone`)) as unknown as { rows: { n: number | string }[] };
  return Number(result.rows[0]?.n ?? 0) > 0;
}

// ---- The Scaler access code (M4-DESIGN 10.2)

/** The stored hash of the Scaler access code, or null when none is set. Never logged. */
export async function readScalerCodeHash(db: Db): Promise<string | null> {
  const result = (await db.execute(sql`select "value" from "app_setting" where "key" = 'scaler_code_hash'`)) as unknown as { rows: { value: string }[] };
  return result.rows[0]?.value ?? null;
}

/** A wrong code, in the audit log: who and which try this hour. Never the code. */
export async function auditScalerCodeFailure(db: Db, userId: string, tryInHour: number): Promise<void> {
  await db.execute(sql`
    insert into ${adminAudit} ("actor_user_id", "action", "target_user_id", "details")
    values (${userId}, 'scaler_code_failed', null, jsonb_build_object('tryInHour', ${tryInHour}::int))`);
}
