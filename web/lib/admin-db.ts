// Admin pages' data and changes (M4-DESIGN 6). Server-only. CROSS-USER BY DESIGN, so reviewed:
//
// - Every exported function starts with `await requirePermission(…)`, which re-reads the caller's
//   status and permissions from the database. tests/unit/isolation-guard.test.ts fails if one
//   doesn't, and tests/unit/admin.test.ts proves each one refuses without its permission.
// - Only the functions listed as reviewed in tests/unit/isolation-guard.test.ts may read the
//   per-user tables (progress), and only counts: never notes, links, Weekly notes, settings or
//   export keys. Nothing here returns an email address.
// - The owner (the super admin, OWNER_GITHUB_ID) can't be suspended, removed, or have permissions
//   changed by anyone. Only the super admin can grant or take away "admins.manage", or suspend or
//   reactivate an admin. Nobody changes their own permissions or suspends themselves. Each rule is
//   checked here and again inside the statement that makes the change.
// - Every change writes its audit row in the same statement (counts and permission names only).
//
// Reads return plain data for the pages. Changes return an ActionResult; app/actions/admin.ts
// turns a refused session or permission into its "signed-out" or "forbidden" answer.
import "server-only";
import { type SQL, sql } from "drizzle-orm";
import { type Db, getDb } from "@/db/client";
import { loadAccess } from "./access";
import {
  ADMIN_PAGE_SIZE,
  AUDIT_FILTERS,
  type AuditAction,
  type AuditFilter,
  DONE_SECTIONS,
  type DoneSection,
  PERMISSIONS,
  type Permission,
  SUPER_ADMIN_ONLY,
  TARGETED_AUDIT_ACTIONS,
  USER_CAP_MAX,
  USER_CAP_MIN,
  type UserStatus,
  isPermission,
  sortPermissions,
  withImpliedPermissions,
} from "./access-types";
import { hashAccessCode, normaliseAccessCode } from "./access-code";
import { type ActionResult, fail, invalid, ok } from "./action-result";
import { accountView } from "./account";
import { ownerGithubId } from "./owner";
import { type PlacesSummary, letInNext, letInOne, placesSummary, reactivateUser, setCapAndAdmit } from "./places";
import { withSafeErrors } from "./safe-log";
import { type AdminActor, requirePermission } from "./session";

type Rows<T> = { rows: T[] };
const run = async <T,>(db: Db, query: SQL) => ((await db.execute(query)) as unknown as Rows<T>).rows;
const owner = () => ownerGithubId(process.env);
const fromMs = (ms: number | string | null | undefined) => (ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString());

/** True for the owner's user (the GitHub account OWNER_GITHUB_ID). */
const isOwnerSql = (userColumn: SQL) =>
  sql`exists (select 1 from "account" oa where oa."user_id" = ${userColumn} and oa."provider_id" = 'github' and oa."account_id" = ${owner() ?? ""})`;
/** Monday 00:00 IST of this week (M4-DESIGN 10.4: "this week" starts Monday, IST, until M5). */
const WEEK_START_IST = sql.raw(`(date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')`);
/** Which section an item id belongs to (lib/ids.ts), for done counts. */
const SECTION_OF_ITEM = sql.raw(`case
  when item_id ~ '^l[0-9]' then 'roadmap'
  when item_id ~ '^r[0-9]' then 'resources'
  when item_id ~ '^(pp|bk)[0-9]' then 'reading'
  when item_id ~ '^s[0-9]' then 'scaler'
  when item_id ~ '^c[0-9]' then 'certs'
  when item_id ~ '^p[0-9]' then 'projects'
  when item_id ~ '^k[0-9]' then 'career'
end`);

// ---- People as the admin pages show them (never an email address)

export interface AdminPerson {
  id: string;
  name: string;
  githubLogin: string | null;
  initials: string;
  /** A checked GitHub avatar URL, or null for initials (lib/account.ts). */
  avatar: string | null;
}

interface PersonRow {
  id: string;
  name: string | null;
  github_login: string | null;
  image: string | null;
}

function person(row: PersonRow): AdminPerson {
  const view = accountView({ name: row.name, image: row.image });
  return { id: row.id, name: view.name, githubLogin: row.github_login, initials: view.initials, avatar: view.avatar };
}

// ---- Input checks (everything an action receives is untrusted)

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const isUserId = (value: unknown): value is string => typeof value === "string" && USER_ID.test(value);
const isOffset = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000;
const pageOffset = (value: unknown) => (isOffset(value) ? value : 0);

/** A LIKE pattern matching `text` anywhere, with the wildcard characters escaped. */
const containsPattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// =====================================================================================
// Overview (metrics.view)

export interface AdminOverview extends PlacesSummary {
  /** Active users (the owner too) who signed in or saved in the last 7 and 30 days. */
  active7: number;
  active30: number;
  /** Items marked done since Monday 00:00 IST, across all users. */
  doneThisWeek: number;
  /** Sign-ups per week (Mondays, IST), newest first, last 8 weeks. Waitlisted sign-ups count; the owner doesn't. */
  signupsPerWeek: { weekOf: string; count: number }[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requirePermission("metrics.view");
  return withSafeErrors("Reading the admin overview", async () => {
    const db = await getDb();
    const [summary, [counts], weeks] = await Promise.all([
      placesSummary(db, owner()),
      run<{ active7: number | string; active30: number | string; done_this_week: number | string }>(
        db,
        sql`select
          (select count(*)::int from "user" where "status" = 'active' and "last_active_at" >= now() - interval '7 days') as active7,
          (select count(*)::int from "user" where "status" = 'active' and "last_active_at" >= now() - interval '30 days') as active30,
          (select count(*)::int from "progress" where "done" and "done_at" >= ${WEEK_START_IST}) as done_this_week`,
      ),
      run<{ week_of: string; n: number | string }>(
        db,
        sql`with weeks as (
          select generate_series(date_trunc('week', now() at time zone 'Asia/Kolkata') - interval '7 weeks', date_trunc('week', now() at time zone 'Asia/Kolkata'), interval '1 week') as wk
        )
        select to_char(wk, 'YYYY-MM-DD') as week_of,
          (select count(*)::int from "user" u where not ${isOwnerSql(sql`u."id"`)}
             and (u."created_at" at time zone 'Asia/Kolkata') >= wk and (u."created_at" at time zone 'Asia/Kolkata') < wk + interval '1 week') as n
        from weeks order by wk desc`,
      ),
    ]);
    return {
      ...summary,
      active7: Number(counts?.active7 ?? 0),
      active30: Number(counts?.active30 ?? 0),
      doneThisWeek: Number(counts?.done_this_week ?? 0),
      signupsPerWeek: weeks.map((w) => ({ weekOf: w.week_of, count: Number(w.n) })),
    };
  });
}

// =====================================================================================
// Users (users.view to read; users.manage to suspend and reactivate)

export const USER_FILTERS = ["all", "active", "waitlisted", "suspended", "admins"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export interface AdminUserRow extends AdminPerson {
  status: UserStatus;
  isOwner: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  /** Items done per section, and in total. Counts only. */
  done: Record<DoneSection, number> & { total: number };
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  /** People matching the search and filter, on every page. */
  total: number;
  /** The offset for "Show 50 more", or null when there are no more. */
  nextOffset: number | null;
}

/** People, newest sign-up first, 50 at a time. Search matches the name or GitHub username. */
export async function listAdminUsers({ q = "", filter = "all", offset = 0 }: { q?: unknown; filter?: unknown; offset?: unknown } = {}): Promise<AdminUserPage> {
  await requirePermission("users.view");
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const show: UserFilter = (USER_FILTERS as readonly unknown[]).includes(filter) ? (filter as UserFilter) : "all";
  const start = pageOffset(offset);
  return withSafeErrors("Reading users", async () => {
    const db = await getDb();
    const isAdmin = sql`exists (select 1 from "user_permission" up where up."user_id" = u."id")`;
    const where = sql.join(
      [
        show === "admins" ? sql`(${isAdmin} or ${isOwnerSql(sql`u."id"`)})` : show === "all" ? sql`true` : sql`u."status" = ${show}`,
        search ? sql`(u."name" ilike ${containsPattern(search)} escape '\\' or u."github_login" ilike ${containsPattern(search)} escape '\\')` : sql`true`,
      ],
      sql` and `,
    );
    const [people, [count]] = await Promise.all([
      run<PersonRow & { status: UserStatus; is_owner: boolean; is_admin: boolean; created_ms: number | string; active_ms: number | string | null }>(
        db,
        sql`select u."id", u."name", u."github_login", u."image", u."status",
            ${isOwnerSql(sql`u."id"`)} as is_owner, ${isAdmin} as is_admin,
            (extract(epoch from u."created_at") * 1000)::float8 as created_ms,
            (extract(epoch from u."last_active_at") * 1000)::float8 as active_ms
          from "user" u where ${where}
          order by u."created_at" desc, u."id" desc
          limit ${ADMIN_PAGE_SIZE + 1} offset ${start}`,
      ),
      run<{ n: number | string }>(db, sql`select count(*)::int as n from "user" u where ${where}`),
    ]);
    const page = people.slice(0, ADMIN_PAGE_SIZE);
    // Done counts per section for this page's people. Counts only, never notes or links.
    const doneRows =
      page.length === 0
        ? []
        : await run<{ user_id: string; section: DoneSection | null; n: number | string }>(
            db,
            sql`select "user_id", ${SECTION_OF_ITEM} as section, count(*)::int as n
              from "progress" where "done" and "user_id" = any(string_to_array(${page.map((p) => p.id).join(",")}, ','))
              group by 1, 2`,
          );
    const done = tallyDone(doneRows);
    return {
      rows: page.map((p) => ({
        ...person(p),
        status: p.status,
        isOwner: p.is_owner === true,
        isAdmin: p.is_owner === true || p.is_admin === true,
        createdAt: fromMs(p.created_ms) ?? "",
        lastActiveAt: fromMs(p.active_ms),
        done: done.get(p.id) ?? emptyDone(),
      })),
      total: Number(count?.n ?? 0),
      nextOffset: people.length > ADMIN_PAGE_SIZE ? start + ADMIN_PAGE_SIZE : null,
    };
  });
}

const emptyDone = (): AdminUserRow["done"] => ({ ...(Object.fromEntries(DONE_SECTIONS.map((s) => [s, 0])) as Record<DoneSection, number>), total: 0 });

/** Done counts by user from the grouped rows. */
function tallyDone(rows: { user_id: string; section: DoneSection | null; n: number | string }[]): Map<string, AdminUserRow["done"]> {
  const out = new Map<string, AdminUserRow["done"]>();
  for (const row of rows) {
    if (!row.section) continue;
    const counts = out.get(row.user_id) ?? emptyDone();
    counts[row.section] += Number(row.n);
    counts.total += Number(row.n);
    out.set(row.user_id, counts);
  }
  return out;
}

/** Who the target is, for the rules on who may change whom. */
async function targetAccess(db: Db, targetId: string) {
  const access = await loadAccess(db, targetId, owner());
  if (!access) return null;
  return { ...access, isAdmin: access.isOwner || access.permissions.length > 0 };
}

const NOT_THERE = "That person isn't there any more. Reload the page.";

/** Suspend: they're signed out at once and can't sign in. Their data is kept. */
export async function suspendUser(targetId: unknown): Promise<ActionResult<{ status: "suspended" }>> {
  const actor = await requirePermission("users.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  if (targetId === actor.userId) return fail({ code: "forbidden", message: "You can't suspend yourself." });
  const db = await getDb();
  const target = await targetAccess(db, targetId);
  if (!target) return fail({ code: "not-found", message: NOT_THERE });
  if (target.isOwner) return fail({ code: "forbidden", message: "The owner can't be suspended." });
  if (target.isAdmin && !actor.isSuperAdmin) return fail({ code: "forbidden", message: "Only the owner can suspend an admin." });
  const [row] = await run<{ n: number | string }>(
    db,
    sql`with upd as (
      update "user" set "status" = 'suspended'
      where "id" = ${targetId} and "status" in ('active', 'waitlisted') and not ${isOwnerSql(sql`"user"."id"`)}
        ${actor.isSuperAdmin ? sql`` : sql`and not exists (select 1 from "user_permission" p where p."user_id" = "user"."id")`}
      returning "id"
    ), ended as (
      delete from "session" where "user_id" in (select "id" from upd)
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actor.userId}, 'suspended', "id", '{}'::jsonb from upd
    )
    select count(*)::int as n from upd`,
  );
  if (Number(row?.n ?? 0) === 0) return fail({ code: "not-found", message: "They're already suspended. Reload the page." });
  return ok({ status: "suspended" });
}

/** Reactivate: back to a place if one is free, otherwise to the back of the waitlist. */
export async function reactivateSuspendedUser(targetId: unknown): Promise<ActionResult<{ status: "active" | "waitlisted" }>> {
  const actor = await requirePermission("users.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  const db = await getDb();
  const target = await targetAccess(db, targetId);
  if (!target) return fail({ code: "not-found", message: NOT_THERE });
  if (target.isOwner) return fail({ code: "forbidden", message: "The owner can't be changed here." });
  if (target.isAdmin && !actor.isSuperAdmin) return fail({ code: "forbidden", message: "Only the owner can reactivate an admin." });
  const result = await reactivateUser(db, targetId, actor.userId, owner());
  if (result === "not-suspended") return fail({ code: "not-found", message: "They aren't suspended any more. Reload the page." });
  return ok({ status: result });
}

// =====================================================================================
// Waitlist (waitlist.manage)

export interface WaitlistRow extends AdminPerson {
  /** 1 is next in line. */
  place: number;
  joinedAt: string;
}

export interface WaitlistPage extends PlacesSummary {
  rows: WaitlistRow[];
  nextOffset: number | null;
}

/** The queue in order, 50 at a time, with the free places and the number waiting. */
export async function getWaitlistQueue({ offset = 0 }: { offset?: unknown } = {}): Promise<WaitlistPage> {
  await requirePermission("waitlist.manage");
  const start = pageOffset(offset);
  return withSafeErrors("Reading the waitlist", async () => {
    const db = await getDb();
    const [summary, rows] = await Promise.all([
      placesSummary(db, owner()),
      run<PersonRow & { joined_ms: number | string }>(
        db,
        sql`select u."id", u."name", u."github_login", u."image",
            (extract(epoch from coalesce(u."waitlisted_at", u."created_at")) * 1000)::float8 as joined_ms
          from "user" u where u."status" = 'waitlisted'
          order by coalesce(u."waitlisted_at", u."created_at"), u."id"
          limit ${ADMIN_PAGE_SIZE + 1} offset ${start}`,
      ),
    ]);
    return {
      ...summary,
      rows: rows.slice(0, ADMIN_PAGE_SIZE).map((r, i) => ({ ...person(r), place: start + i + 1, joinedAt: fromMs(r.joined_ms) ?? "" })),
      nextOffset: rows.length > ADMIN_PAGE_SIZE ? start + ADMIN_PAGE_SIZE : null,
    };
  });
}

const NO_PLACE = { code: "no-place", message: "All places are taken. Raise the cap to let more people in." } as const;

/** "Let in": one person from the waitlist, if a place is free. */
export async function letInFromWaitlist(targetId: unknown): Promise<ActionResult<{ status: "active" }>> {
  const actor = await requirePermission("waitlist.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  const result = await letInOne(await getDb(), targetId, actor.userId, owner());
  if (result === "no-place") return fail(NO_PLACE);
  if (result === "not-waiting") return fail({ code: "not-found", message: "They aren't on the waitlist any more. Reload the page." });
  return ok({ status: "active" });
}

/** "Let in the next N": up to N people in order, never past the cap. Returns how many got in. */
export async function letInNextFromWaitlist(count: unknown): Promise<ActionResult<{ admitted: number }>> {
  const actor = await requirePermission("waitlist.manage");
  if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > USER_CAP_MAX) {
    return invalid(`Enter a whole number from 1 to ${USER_CAP_MAX.toLocaleString("en-GB")}.`, "count");
  }
  const db = await getDb();
  const summary = await placesSummary(db, owner());
  if (summary.free === 0 && summary.waiting > 0) return fail(NO_PLACE);
  return ok({ admitted: await letInNext(db, count as number, actor.userId, owner()) });
}

/** "Remove": deletes a waitlisted person's account (M4-DESIGN 10.4). The audit shows "a deleted account". */
export async function removeFromWaitlist(targetId: unknown): Promise<ActionResult<{ removed: true }>> {
  const actor = await requirePermission("waitlist.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  const db = await getDb();
  const target = await targetAccess(db, targetId);
  // An admin who was suspended and then reactivated onto the waitlist keeps their permission rows:
  // only the super admin may delete them.
  if (target?.isAdmin && !actor.isSuperAdmin) return fail({ code: "forbidden", message: "Only the owner can remove an admin." });
  const [row] = await run<{ n: number | string }>(
    db,
    sql`with gone as (
      delete from "user" where "id" = ${targetId} and "status" = 'waitlisted' and not ${isOwnerSql(sql`"user"."id"`)}
      returning "id"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actor.userId}, 'waitlist_removed', null, '{}'::jsonb from gone
    )
    select count(*)::int as n from gone`,
  );
  if (Number(row?.n ?? 0) === 0) return fail({ code: "not-found", message: "They aren't on the waitlist any more. Reload the page." });
  return ok({ removed: true });
}

// =====================================================================================
// Sign-up settings (settings.manage): the cap and the Scaler access code

export interface SignupSettings extends PlacesSummary {
  /** Whether a Scaler access code is set, and when it was last set or rotated. Never the code or its hash. */
  scalerCodeSet: boolean;
  scalerCodeUpdatedAt: string | null;
}

export async function getSignupSettings(): Promise<SignupSettings> {
  await requirePermission("settings.manage");
  return withSafeErrors("Reading sign-up settings", async () => {
    const db = await getDb();
    const [summary, [code]] = await Promise.all([
      placesSummary(db, owner()),
      run<{ updated_ms: number | string }>(db, sql`select (extract(epoch from "updated_at") * 1000)::float8 as updated_ms from "app_setting" where "key" = 'scaler_code_hash'`),
    ]);
    return { ...summary, scalerCodeSet: !!code, scalerCodeUpdatedAt: fromMs(code?.updated_ms) };
  });
}

/** Saves the cap (0 to 1,000). Raising it lets in waitlisted people in order, in the same statement. */
export async function setUserCap(cap: unknown): Promise<ActionResult<{ cap: number; previous: number; admitted: number }>> {
  const actor = await requirePermission("settings.manage");
  if (!Number.isInteger(cap) || (cap as number) < USER_CAP_MIN || (cap as number) > USER_CAP_MAX) {
    return invalid("Enter a whole number from 0 to 1,000.", "cap");
  }
  const result = await setCapAndAdmit(await getDb(), cap as number, actor.userId, owner());
  return ok({ cap: cap as number, ...result });
}

/**
 * Sets or rotates the Scaler access code (M4-DESIGN 10.2). Stored only as a scrypt hash. People who
 * already unlocked Scaler keep it. Audited without the code.
 */
export async function setScalerAccessCode(code: unknown): Promise<ActionResult<{ set: true }>> {
  const actor = await requirePermission("settings.manage");
  const clean = normaliseAccessCode(code);
  if (!clean) return invalid("Use 6 to 64 letters, numbers or symbols.", "code");
  const hash = await hashAccessCode(clean);
  await run(
    await getDb(),
    sql`with saved as (
      insert into "app_setting" ("key", "value", "updated_by", "updated_at") values ('scaler_code_hash', ${hash}, ${actor.userId}, now())
      on conflict ("key") do update set "value" = excluded."value", "updated_by" = excluded."updated_by", "updated_at" = excluded."updated_at"
      returning "key"
    )
    insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
    select ${actor.userId}, 'scaler_code_set', null, '{}'::jsonb from saved`,
  );
  return ok({ set: true });
}

// =====================================================================================
// Admins (admins.manage)

export interface AdminEntry extends AdminPerson {
  permissions: Permission[];
}

export interface AdminList {
  /** The super admin: every permission, can't be changed. Null if the owner hasn't signed in yet. */
  owner: AdminPerson | null;
  admins: AdminEntry[];
}

export async function listAdmins(): Promise<AdminList> {
  await requirePermission("admins.manage");
  return withSafeErrors("Reading admins", async () => {
    const db = await getDb();
    const rows = await run<PersonRow & { is_owner: boolean; permissions: string }>(
      db,
      sql`select u."id", u."name", u."github_login", u."image", ${isOwnerSql(sql`u."id"`)} as is_owner,
          coalesce((select string_agg(p."permission", ',') from "user_permission" p where p."user_id" = u."id"), '') as permissions
        from "user" u
        where ${isOwnerSql(sql`u."id"`)} or exists (select 1 from "user_permission" p where p."user_id" = u."id")
        order by u."name", u."id"`,
    );
    const ownerRow = rows.find((r) => r.is_owner === true);
    return {
      owner: ownerRow ? person(ownerRow) : null,
      admins: rows
        .filter((r) => r.is_owner !== true)
        .map((r) => ({ ...person(r), permissions: sortPermissions(r.permissions.split(",").filter(isPermission)) })),
    };
  });
}

export type FoundPerson = (AdminPerson & { status: UserStatus; isOwner: boolean; permissions: Permission[] }) | null;

/** "Add an admin" → Find: an exact GitHub username (any case). Null when nobody has it. */
export async function findUserByGithubLogin(login: unknown): Promise<FoundPerson> {
  await requirePermission("admins.manage");
  if (typeof login !== "string") return null;
  const clean = login.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(clean)) return null;
  return withSafeErrors("Finding a user", async () => {
    const db = await getDb();
    const [row] = await run<PersonRow & { status: UserStatus }>(
      db,
      sql`select u."id", u."name", u."github_login", u."image", u."status" from "user" u
        where lower(u."github_login") = lower(${clean}) order by u."created_at" desc limit 1`,
    );
    if (!row) return null;
    const access = await targetAccess(db, row.id);
    return { ...person(row), status: row.status, isOwner: access?.isOwner ?? false, permissions: access?.isOwner ? [...PERMISSIONS] : (access?.permissions ?? []) };
  });
}


/**
 * Gives a person exactly these permissions (an empty list removes them as an admin). Audited as
 * admin_added, permissions_changed or admin_removed, with the permissions given and taken away.
 */
export async function setAdminPermissions(targetId: unknown, permissions: unknown): Promise<ActionResult<{ permissions: Permission[] }>> {
  const actor = await requirePermission("admins.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  if (!Array.isArray(permissions) || permissions.length > PERMISSIONS.length * 2 || !permissions.every(isPermission)) {
    return invalid("Those permissions can't be saved.", "permissions");
  }
  if (targetId === actor.userId) return fail({ code: "forbidden", message: "You can't change your own permissions." });
  const wanted = withImpliedPermissions(permissions);
  const db = await getDb();
  const target = await targetAccess(db, targetId);
  if (!target) return fail({ code: "not-found", message: NOT_THERE });
  if (target.isOwner) return fail({ code: "forbidden", message: "The owner's permissions can't be changed." });
  if (target.status !== "active" && wanted.length > 0) return fail({ code: "not-found", message: "Only people with a place can be admins." });
  if (!actor.isSuperAdmin && wanted.includes(SUPER_ADMIN_ONLY) !== target.permissions.includes(SUPER_ADMIN_ONLY)) {
    return fail({ code: "forbidden", message: "Only the owner can give or take away “Manage admins”." });
  }
  return ok({ permissions: await savePermissions(db, actor, targetId, wanted) });
}

/** Removes every admin permission from a person. */
export async function removeAdmin(targetId: unknown): Promise<ActionResult<{ permissions: Permission[] }>> {
  const actor = await requirePermission("admins.manage");
  if (!isUserId(targetId)) return invalid(NOT_THERE);
  if (targetId === actor.userId) return fail({ code: "forbidden", message: "You can't change your own permissions." });
  const db = await getDb();
  const target = await targetAccess(db, targetId);
  if (!target) return fail({ code: "not-found", message: NOT_THERE });
  if (target.isOwner) return fail({ code: "forbidden", message: "The owner's permissions can't be changed." });
  if (!actor.isSuperAdmin && target.permissions.includes(SUPER_ADMIN_ONLY)) {
    return fail({ code: "forbidden", message: "Only the owner can take away “Manage admins”." });
  }
  return ok({ permissions: await savePermissions(db, actor, targetId, []) });
}

/**
 * One statement: take away what isn't wanted, give what is, and audit the difference. The target
 * must still be active and not the owner when it runs. Without the super admin, "admins.manage"
 * is never given or taken here, whatever the caller asked.
 */
async function savePermissions(db: Db, actor: AdminActor, targetId: string, wanted: Permission[]): Promise<Permission[]> {
  const keepSuperOnly = actor.isSuperAdmin ? sql`` : sql`and "permission" <> ${SUPER_ADMIN_ONLY}`;
  const give = actor.isSuperAdmin ? wanted : wanted.filter((p) => p !== SUPER_ADMIN_ONLY);
  await run(
    db,
    sql`with target as (
      select "id" from "user" where "id" = ${targetId} and not ${isOwnerSql(sql`"user"."id"`)}
    ), held as (
      select count(*)::int as n from "user_permission" where "user_id" = (select "id" from target)
    ), del as (
      delete from "user_permission"
      where "user_id" = (select "id" from target) and "permission" <> all(string_to_array(${wanted.join(",")}, ',')) ${keepSuperOnly}
      returning "permission"
    ), ins as (
      insert into "user_permission" ("user_id", "permission", "granted_by")
      select t."id", p, ${actor.userId} from target t, unnest(string_to_array(${give.join(",")}, ',')) p
      where exists (select 1 from "user" u where u."id" = t."id" and u."status" = 'active')
      on conflict ("user_id", "permission") do nothing
      returning "permission"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actor.userId},
        case when (select n from held) = 0 then 'admin_added'
             when (select n from held) - (select count(*) from del) + (select count(*) from ins) = 0 then 'admin_removed'
             else 'permissions_changed' end,
        (select "id" from target),
        jsonb_build_object(
          'gave', coalesce((select jsonb_agg("permission" order by "permission") from ins), '[]'::jsonb),
          'took', coalesce((select jsonb_agg("permission" order by "permission") from del), '[]'::jsonb))
      where exists (select 1 from ins) or exists (select 1 from del)
    )
    select 1`,
  );
  const after = await loadAccess(db, targetId, owner());
  return after?.permissions ?? [];
}

// =====================================================================================
// Audit log (audit.view)

export interface AuditEntry {
  id: number;
  at: string;
  action: AuditAction;
  /** The admin (or user) who acted; null for a deleted account, or for an account's own deletion. */
  actor: AdminPerson | null;
  /** The person affected, when the action names one. */
  target: AdminPerson | null;
  /** The action named a person who has since deleted their account ("a deleted account"). */
  targetDeleted: boolean;
  /** Counts and permission names only. */
  details: Record<string, unknown>;
}

export interface AuditPage {
  rows: AuditEntry[];
  nextOffset: number | null;
}

/** Admin actions, newest first, 50 at a time, optionally one kind (the "Show" filter). */
export async function listAuditLog({ filter = "all", offset = 0 }: { filter?: unknown; offset?: unknown } = {}): Promise<AuditPage> {
  await requirePermission("audit.view");
  const start = pageOffset(offset);
  const actions: readonly AuditAction[] | null =
    typeof filter === "string" && Object.hasOwn(AUDIT_FILTERS, filter) ? AUDIT_FILTERS[filter as AuditFilter] : null;
  return withSafeErrors("Reading the audit log", async () => {
    const db = await getDb();
    const rows = await run<{
      id: number | string;
      at_ms: number | string;
      action: AuditAction;
      details: Record<string, unknown> | string | null;
      actor_id: string | null;
      actor_name: string | null;
      actor_login: string | null;
      actor_image: string | null;
      target_id: string | null;
      target_name: string | null;
      target_login: string | null;
      target_image: string | null;
    }>(
      db,
      sql`select a."id", (extract(epoch from a."at") * 1000)::float8 as at_ms, a."action", a."details",
          actor."id" as actor_id, actor."name" as actor_name, actor."github_login" as actor_login, actor."image" as actor_image,
          target."id" as target_id, target."name" as target_name, target."github_login" as target_login, target."image" as target_image
        from "admin_audit" a
        left join "user" actor on actor."id" = a."actor_user_id"
        left join "user" target on target."id" = a."target_user_id"
        ${actions ? sql`where a."action" = any(string_to_array(${actions.join(",")}, ','))` : sql``}
        order by a."at" desc, a."id" desc
        limit ${ADMIN_PAGE_SIZE + 1} offset ${start}`,
    );
    return {
      rows: rows.slice(0, ADMIN_PAGE_SIZE).map((r) => ({
        id: Number(r.id),
        at: fromMs(r.at_ms) ?? "",
        action: r.action,
        actor: r.actor_id ? person({ id: r.actor_id, name: r.actor_name, github_login: r.actor_login, image: r.actor_image }) : null,
        target: r.target_id ? person({ id: r.target_id, name: r.target_name, github_login: r.target_login, image: r.target_image }) : null,
        targetDeleted: !r.target_id && TARGETED_AUDIT_ACTIONS.has(r.action),
        details: typeof r.details === "string" ? (JSON.parse(r.details) as Record<string, unknown>) : (r.details ?? {}),
      })),
      nextOffset: rows.length > ADMIN_PAGE_SIZE ? start + ADMIN_PAGE_SIZE : null,
    };
  });
}
