// Reads and writes of the progress table. Server-only. Callers must have checked that the
// visitor is the owner (lib/session.ts) and validated the input (lib/validation.ts) first.
import "server-only";
import { sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import { progress } from "@/db/schema";
import type { ProgressEntry, ProgressRecord } from "./progress";

type Row = typeof progress.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toEntry(row: Row): ProgressEntry {
  return {
    itemId: row.itemId,
    done: row.done,
    note: row.note,
    link: row.link,
    doneAt: iso(row.doneAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Every saved record, keyed by item id. */
export async function readProgress(db: Db): Promise<Map<string, ProgressRecord>> {
  const rows = await db.select().from(progress);
  return new Map(
    rows.map((row) => {
      const { itemId, ...record } = toEntry(row);
      return [itemId, record];
    }),
  );
}

async function upsertOne(db: Db, values: typeof progress.$inferInsert, set: PgUpdateSetSource<typeof progress>) {
  const [row] = await db.insert(progress).values(values).onConflictDoUpdate({ target: progress.itemId, set }).returning();
  return toEntry(row);
}

/**
 * Marks an item done or not done. Ticking sets `done_at` (keeping the first time if it was already
 * done, so a repeated tick does not move it); unticking clears it.
 */
export function setDone(db: Db, itemId: string, done: boolean, now = new Date()): Promise<ProgressEntry> {
  return upsertOne(
    db,
    { itemId, done, doneAt: done ? now : null, updatedAt: now },
    { done, doneAt: done ? sql`coalesce("progress"."done_at", excluded."done_at")` : null, updatedAt: now },
  );
}

export function setNote(db: Db, itemId: string, note: string, now = new Date()): Promise<ProgressEntry> {
  return upsertOne(db, { itemId, note, updatedAt: now }, { note, updatedAt: now });
}

export function setLink(db: Db, itemId: string, link: string, now = new Date()): Promise<ProgressEntry> {
  return upsertOne(db, { itemId, link, updatedAt: now }, { link, updatedAt: now });
}
