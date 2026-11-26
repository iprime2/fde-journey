// Places under the user cap (M4-DESIGN 2). Server-only.
//
// Every change that can give someone a place (a new sign-up, "Let in", "Let in the next N",
// Reactivate, raising the cap) runs here, under one Postgres advisory lock, so two of them at the
// same moment can never take the number of places past the cap.
//
// How the lock works with each driver (runLocked):
// - Neon over HTTP (production) has no interactive transactions, but it runs a batch of statements
//   as ONE transaction (`db.batch`). The batch is: READ COMMITTED, take the lock
//   (pg_advisory_xact_lock, held until the transaction ends), then the change itself.
// - PGlite (development, tests) and any pooled driver: an ordinary transaction with the same two
//   statements.
// Why two statements and not one: under READ COMMITTED each statement sees the database as it was
// when that statement STARTED. A single statement that took the lock part-way through would still
// count places from before it waited, so two sign-ups queued on the lock would both see the last
// free place. Here the counting statement starts only once the lock is held, so it sees every
// earlier holder's committed change. The lock is released at commit, after the change is visible.
//
// Each change is a single statement (data-modifying CTEs), with its audit row in the same
// statement, so the change and its record are written together or not at all.
//
// "Places taken" counts active users other than the owner (the owner is never capped). Suspended
// and waitlisted users don't count. The queue order is when people joined the waitlist.
import "server-only";
import { type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { UserStatus } from "./access-types";

/** One fixed key for the whole app: there is one cap. */
const PLACES_LOCK = sql.raw("select pg_advisory_xact_lock(7243100001)");

type Rows<T> = { rows: T[] };

/** A database that runs a batch of statements as one transaction (Neon over HTTP). */
interface BatchDb {
  batch: (queries: unknown[]) => Promise<unknown[]>;
}
const isBatchDb = (db: Db): db is Db & BatchDb => typeof (db as unknown as Partial<BatchDb>).batch === "function";

/** Runs `statement` while holding the places lock, in one READ COMMITTED transaction. Returns its rows. */
export async function runLocked<T>(db: Db, statement: SQL): Promise<T[]> {
  if (isBatchDb(db)) {
    const results = await db.batch([
      db.execute(sql.raw("set transaction isolation level read committed")),
      db.execute(PLACES_LOCK),
      db.execute(statement),
    ]);
    return (results[2] as Rows<T>).rows;
  }
  return db.transaction(
    async (tx) => {
      await tx.execute(PLACES_LOCK);
      return ((await tx.execute(statement)) as unknown as Rows<T>).rows;
    },
    { isolationLevel: "read committed" },
  );
}

/** True for the owner's user: the GitHub account OWNER_GITHUB_ID. Never matches when it isn't set. */
const isOwnerSql = (userColumn: SQL, ownerId: string | null) =>
  sql`exists (select 1 from "account" oa where oa."user_id" = ${userColumn} and oa."provider_id" = 'github' and oa."account_id" = ${ownerId ?? ""})`;

/** Places taken: active users who aren't the owner. */
const takenSql = (ownerId: string | null) =>
  sql`(select count(*)::int from "user" tu where tu."status" = 'active' and not ${isOwnerSql(sql`tu."id"`, ownerId)})`;
/** The cap. A missing setting counts as 0, so nobody new gets a place (fails closed). */
const capSql = sql`coalesce((select "value"::int from "app_setting" where "key" = 'user_cap'), 0)`;
/** Free places, never below zero. */
const freeSql = (ownerId: string | null) => sql`greatest(0, ${capSql} - ${takenSql(ownerId)})`;
/** Waitlist order: when someone joined (their sign-up time if that is missing), then id. */
const queueKey = (alias: string) => sql.raw(`(coalesce(${alias}."waitlisted_at", ${alias}."created_at"), ${alias}."id")`);

export interface PlacesSummary {
  /** Active users other than the owner. */
  taken: number;
  cap: number;
  free: number;
  waiting: number;
}

/** Counts for the admin pages. Read without the lock: a snapshot, not a promise. */
export async function placesSummary(db: Db, ownerId: string | null): Promise<PlacesSummary> {
  const result = (await db.execute(sql`
    select ${takenSql(ownerId)} as taken, ${capSql} as cap,
      (select count(*)::int from "user" where "status" = 'waitlisted') as waiting`)) as unknown as Rows<{ taken: number | string; cap: number | string; waiting: number | string }>;
  const row = result.rows[0];
  const taken = Number(row?.taken ?? 0);
  const cap = Number(row?.cap ?? 0);
  return { taken, cap, free: Math.max(0, cap - taken), waiting: Number(row?.waiting ?? 0) };
}

/**
 * A new sign-up (capped mode), already stored as waitlisted: gives them a place if one is free for
 * them. Nobody jumps the queue: they get a place only if fewer people joined the waitlist before
 * them than there are free places. Returns the status they end up with.
 */
export async function placeNewUser(db: Db, userId: string, ownerId: string | null): Promise<UserStatus | null> {
  const rows = await runLocked<{ status: UserStatus }>(
    db,
    sql`
    with me as (
      select "id", "waitlisted_at", "created_at" from "user" where "id" = ${userId} and "status" = 'waitlisted'
    ), upd as (
      update "user" set "status" = 'active', "activated_at" = now(), "waitlisted_at" = null
      where "id" = (select "id" from me)
        and (select count(*) from "user" w, me
             where w."status" = 'waitlisted' and w."id" <> me."id" and ${queueKey("w")} < ${queueKey("me")}) < ${freeSql(ownerId)}
      returning "status"
    )
    select "status" from upd
    union all
    select "status" from "user" where "id" = ${userId} and not exists (select 1 from upd)`,
  );
  return rows[0]?.status ?? null;
}

/** The owner always has a place. Idempotent; not under the lock (the owner isn't counted). */
export async function activateOwner(db: Db, userId: string): Promise<void> {
  await db.execute(sql`
    update "user" set "status" = 'active', "activated_at" = coalesce("activated_at", now()), "waitlisted_at" = null
    where "id" = ${userId} and "status" <> 'active'`);
}

export type LetInResult = "let-in" | "no-place" | "not-waiting";

/** "Let in": one waitlisted person gets a place if one is free. Audited as `let_in`. */
export async function letInOne(db: Db, targetId: string, actorId: string, ownerId: string | null): Promise<LetInResult> {
  const rows = await runLocked<{ outcome: LetInResult }>(
    db,
    sql`
    with target as (
      select "id" from "user" where "id" = ${targetId} and "status" = 'waitlisted'
    ), upd as (
      update "user" set "status" = 'active', "activated_at" = now()
      where "id" = (select "id" from target) and ${freeSql(ownerId)} > 0
      returning "id"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actorId}, 'let_in', "id", '{}'::jsonb from upd
    )
    select case when exists (select 1 from upd) then 'let-in'
                when exists (select 1 from target) then 'no-place'
                else 'not-waiting' end as outcome`,
  );
  return rows[0]?.outcome ?? "not-waiting";
}

/**
 * "Let in the next N": the earliest waitlisted people, up to N and up to the free places. Returns
 * how many got a place (it can be fewer than N if the queue or the places changed). Audited as one
 * `let_in_many` row with the count.
 */
export async function letInNext(db: Db, count: number, actorId: string, ownerId: string | null): Promise<number> {
  const rows = await runLocked<{ admitted: number | string }>(
    db,
    sql`
    with picked as (
      select "id" from "user" q where q."status" = 'waitlisted'
      order by ${queueKey("q")}
      limit greatest(0, least(${count}::int, ${freeSql(ownerId)}))
    ), upd as (
      update "user" set "status" = 'active', "activated_at" = now()
      where "id" in (select "id" from picked) and "status" = 'waitlisted'
      returning "id"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actorId}, 'let_in_many', null, jsonb_build_object('count', (select count(*) from upd))
      where exists (select 1 from upd)
    )
    select count(*)::int as admitted from upd`,
  );
  return Number(rows[0]?.admitted ?? 0);
}

export type ReactivateResult = "active" | "waitlisted" | "not-suspended";

/**
 * Reactivate a suspended user. With a free place they get it back; otherwise they join the back of
 * the waitlist (M4-DESIGN 10.4: Reactivate never exceeds the cap).
 */
export async function reactivateUser(db: Db, targetId: string, actorId: string, ownerId: string | null): Promise<ReactivateResult> {
  const rows = await runLocked<{ status: UserStatus }>(
    db,
    sql`
    with room as (select ${freeSql(ownerId)} > 0 as has_place), upd as (
      update "user" set
        "status" = case when (select has_place from room) then 'active' else 'waitlisted' end,
        "activated_at" = case when (select has_place from room) then now() else "activated_at" end,
        "waitlisted_at" = case when (select has_place from room) then "waitlisted_at" else now() end
      where "id" = ${targetId} and "status" = 'suspended'
      returning "id", "status"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actorId}, case when "status" = 'active' then 'reactivated' else 'reactivated_to_waitlist' end, "id", '{}'::jsonb from upd
    )
    select "status" from upd`,
  );
  const status = rows[0]?.status;
  return status === "active" || status === "waitlisted" ? status : "not-suspended";
}

/**
 * Sets the cap. Raising it lets in the earliest waitlisted people, up to the new free places, in
 * the same statement. Audited as `cap_changed` with the old and new cap and how many got in.
 */
export async function setCapAndAdmit(db: Db, cap: number, actorId: string, ownerId: string | null): Promise<{ previous: number; admitted: number }> {
  const rows = await runLocked<{ previous: number | string | null; admitted: number | string }>(
    db,
    sql`
    with old as (
      select "value"::int as n from "app_setting" where "key" = 'user_cap'
    ), setcap as (
      insert into "app_setting" ("key", "value", "updated_by", "updated_at") values ('user_cap', ${String(cap)}, ${actorId}, now())
      on conflict ("key") do update set "value" = excluded."value", "updated_by" = excluded."updated_by", "updated_at" = excluded."updated_at"
    ), picked as (
      select "id" from "user" q where q."status" = 'waitlisted' and ${cap}::int > coalesce((select n from old), 0)
      order by ${queueKey("q")}
      limit greatest(0, ${cap}::int - ${takenSql(ownerId)})
    ), upd as (
      update "user" set "status" = 'active', "activated_at" = now()
      where "id" in (select "id" from picked) and "status" = 'waitlisted'
      returning "id"
    ), aud as (
      insert into "admin_audit" ("actor_user_id", "action", "target_user_id", "details")
      select ${actorId}, 'cap_changed', null,
        jsonb_build_object('from', (select n from old), 'to', ${cap}::int, 'admitted', (select count(*) from upd))
      where (select n from old) is distinct from ${cap}::int or exists (select 1 from upd)
    )
    select (select n from old) as previous, (select count(*)::int from upd) as admitted`,
  );
  return { previous: Number(rows[0]?.previous ?? 0), admitted: Number(rows[0]?.admitted ?? 0) };
}

/** A waitlisted user's place in line (1 = next), or null when they aren't waiting. */
export async function waitlistPosition(db: Db, userId: string): Promise<{ place: number; joinedAt: Date } | null> {
  const result = (await db.execute(sql`
    select (select count(*)::int from "user" w where w."status" = 'waitlisted' and ${queueKey("w")} < ${queueKey("me")}) as ahead,
      (extract(epoch from coalesce(me."waitlisted_at", me."created_at")) * 1000)::float8 as joined_ms
    from "user" me where me."id" = ${userId} and me."status" = 'waitlisted'`)) as unknown as Rows<{ ahead: number | string; joined_ms: number | string }>;
  const row = result.rows[0];
  return row ? { place: Number(row.ahead) + 1, joinedAt: new Date(Number(row.joined_ms)) } : null;
}
