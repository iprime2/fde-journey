// Reads and writes of the progress and progress_event tables. Server-only.
//
// Isolation rule (M4): every function takes the user's id as its required first argument, and
// every query filters on it. Callers get the id from the server session only (requireUser() in
// lib/session.ts), never from the request, and validate the input (lib/validation.ts) first.
// tests/unit/isolation-guard.test.ts fails if a query here, or anywhere else, lacks the filter.
import "server-only";
import { type SQL, and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { type ProgressEventKind, progress, progressEvent } from "@/db/schema";
import type { ProgressEntry, ProgressRecord } from "./progress";

type Row = typeof progress.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** A user id from the session: a non-empty string. Anything else is a bug, so it throws. */
function checkUserId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0) throw new Error("A user id is required for progress queries.");
}

export function toEntry(row: Pick<Row, "itemId" | "done" | "note" | "link" | "doneAt" | "updatedAt">): ProgressEntry {
  return {
    itemId: row.itemId,
    done: row.done,
    note: row.note,
    link: row.link,
    doneAt: iso(row.doneAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Every record the user has saved, keyed by item id. */
export async function readProgress(userId: string, db: Db): Promise<Map<string, ProgressRecord>> {
  checkUserId(userId);
  const rows = await db.select().from(progress).where(eq(progress.userId, userId));
  return new Map(
    rows.map((row) => {
      const { itemId, ...record } = toEntry(row);
      return [itemId, record];
    }),
  );
}

export interface ProgressEvent {
  itemId: string;
  kind: ProgressEventKind;
  at: string;
}

/** The user's save history, oldest first. Holds no note or link text (the table has none). */
export async function readEvents(userId: string, db: Db): Promise<ProgressEvent[]> {
  checkUserId(userId);
  const rows = await db
    .select({ itemId: progressEvent.itemId, kind: progressEvent.kind, at: progressEvent.at })
    .from(progressEvent)
    .where(eq(progressEvent.userId, userId))
    .orderBy(asc(progressEvent.at), asc(progressEvent.id));
  return rows.map((r) => ({ itemId: r.itemId, kind: r.kind, at: r.at.toISOString() }));
}

// ---- Saving
//
// Each save is ONE SQL statement with data-modifying CTEs: the upsert of the progress row and the
// insert of its progress_event row. A single statement is atomic on every driver, so the event can
// never be written without the change or the change without the event. (The Neon HTTP driver has
// no interactive transactions, and `db.batch` exists only there, not on PGlite; one statement
// behaves the same on both.)
//
// - The update only runs when the value really changes (`IS DISTINCT FROM`), so saving the same
//   value again writes nothing: no event, and `updated_at` and `done_at` stay as they were.
// - A new row gets an event only when its value differs from the default (a first untick or an
//   empty note on an item never saved changes nothing a user can see).
// - `(xmax = 0)` is true for a row this statement inserted, false for one it updated.

type Field = "done" | "note" | "link";

/** Per field: the column, its default, and the event kind for the value saved. */
const FIELDS: Record<Field, { column: SQL; isDefault: SQL; kind: SQL }> = {
  done: { column: sql.raw(`"done"`), isDefault: sql.raw(`up.done = false`), kind: sql.raw(`case when up.done then 'done' else 'undone' end`) },
  note: { column: sql.raw(`"note"`), isDefault: sql.raw(`up.note = ''`), kind: sql.raw(`'note'`) },
  link: { column: sql.raw(`"link"`), isDefault: sql.raw(`up.link = ''`), kind: sql.raw(`'link'`) },
};

/** Raw rows from `db.execute`. The Neon HTTP driver returns timestamps as text, so they come back as epoch milliseconds. */
interface SavedRow {
  item_id: string;
  done: boolean;
  note: string;
  link: string;
  done_at_ms: number | string | null;
  updated_at_ms: number | string;
}

const fromMs = (ms: number | string | null) => (ms === null ? null : new Date(Number(ms)));

async function saveField(userId: string, db: Db, itemId: string, field: Field, value: boolean | string, now: Date): Promise<ProgressEntry> {
  checkUserId(userId);
  const { column, isDefault, kind } = FIELDS[field];
  // Sent as ISO text with explicit casts, so both drivers pass the same value and Postgres never
  // has to guess a parameter's type.
  const at = now.toISOString();
  const doneAt = field === "done" && value === true ? at : null;
  // Only the done field sets done_at; note and link saves leave it alone.
  const setDoneAt = field === "done" ? sql`, "done_at" = excluded."done_at"` : sql``;
  const query = sql`
    with up as (
      insert into "progress" ("user_id", "item_id", ${column}, "done_at", "updated_at")
      values (${userId}, ${itemId}, ${value}, ${doneAt}::timestamptz, ${at}::timestamptz)
      on conflict ("user_id", "item_id") do update
        set ${column} = excluded.${column}${setDoneAt}, "updated_at" = excluded."updated_at"
        where "progress"."user_id" = ${userId} and "progress".${column} is distinct from excluded.${column}
      returning "progress".*, (xmax = 0) as inserted
    ), ev as (
      insert into "progress_event" ("user_id", "item_id", "kind", "at")
      select up.user_id, up.item_id, ${kind}, ${at}::timestamptz from up
      where up.user_id = ${userId} and not (up.inserted and ${isDefault})
    )
    select item_id, done, note, link,
      (extract(epoch from done_at) * 1000)::float8 as done_at_ms,
      (extract(epoch from updated_at) * 1000)::float8 as updated_at_ms
    from up where up.user_id = ${userId}`;
  const result = (await db.execute(query)) as unknown as { rows: SavedRow[] };
  const [saved] = result.rows;
  if (saved) {
    return toEntry({
      itemId: saved.item_id,
      done: saved.done,
      note: saved.note,
      link: saved.link,
      doneAt: fromMs(saved.done_at_ms),
      updatedAt: fromMs(saved.updated_at_ms) ?? now,
    });
  }
  // Nothing changed (same value saved again): return the row as it is.
  const [row] = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.itemId, itemId)));
  if (!row) throw new Error("The saved row could not be read back.");
  return toEntry(row);
}

/**
 * Marks an item done or not done. Ticking sets `done_at`; ticking an item that is already done
 * changes nothing (so `done_at` keeps the first time). Unticking clears it.
 */
export function setDone(userId: string, db: Db, itemId: string, done: boolean, now = new Date()): Promise<ProgressEntry> {
  return saveField(userId, db, itemId, "done", done, now);
}

export function setNote(userId: string, db: Db, itemId: string, note: string, now = new Date()): Promise<ProgressEntry> {
  return saveField(userId, db, itemId, "note", note, now);
}

export function setLink(userId: string, db: Db, itemId: string, link: string, now = new Date()): Promise<ProgressEntry> {
  return saveField(userId, db, itemId, "link", link, now);
}
