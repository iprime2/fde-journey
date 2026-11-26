"use server";
// Saving progress. Every action takes the signed-in user from the server session first
// (requireUser), then validates its input, then writes that user's row and its event in one
// statement (lib/progress-db.ts) and refreshes the pages. Results are typed (lib/save-result.ts); raw
// database errors never reach the browser.
//
// Call from a client component, for example inside startTransition:
//   const result = await toggleDone("l1-1", true);
//   if (!result.ok && result.error.code === "signed-out") showSignedOutBanner();
import { revalidatePath } from "next/cache";
import { type Db, getDb } from "@/db/client";
import { JOURNAL_ID } from "@/lib/ids";
import type { ProgressEntry } from "@/lib/progress";
import { setDone, setLink, setNote } from "@/lib/progress-db";
import { describeError } from "@/lib/safe-log";
import { FAILED_ERROR, SIGNED_OUT_ERROR, type SaveResult } from "@/lib/save-result";
import { SignedOutError, requireUser } from "@/lib/session";
import { type Parsed, doneSchema, linkSchema, noteIdSchema, noteSchema, parseField, tickableIdSchema } from "@/lib/validation";

async function save<T>(parse: () => Parsed<T>, write: (userId: string, db: Db, input: T) => Promise<ProgressEntry>): Promise<SaveResult> {
  try {
    // The user comes from the session only, never from the action's arguments.
    const userId = await requireUser({ onSignedOut: "throw" });
    const input = parse();
    if (!input.ok) return { ok: false, error: input.error };
    const record = await write(userId, await getDb(), input.value);
    // Every page shows done counts (sidebar, Home tiles), so refresh them all. The current page
    // re-renders in this response; other pages refresh when next visited.
    revalidatePath("/", "layout");
    return { ok: true, record };
  } catch (error) {
    if (error instanceof SignedOutError) return { ok: false, error: SIGNED_OUT_ERROR };
    // Names and codes only: messages and details can quote the row, which holds personal notes.
    console.error(`Saving progress failed (${describeError(error)})`);
    return { ok: false, error: FAILED_ERROR };
  }
}

function both<A, B>(a: Parsed<A>, b: Parsed<B>): Parsed<[A, B]> {
  if (!a.ok) return a;
  if (!b.ok) return b;
  return { ok: true, value: [a.value, b.value] };
}

/** Ticks or unticks an item. Sets `doneAt` when ticked and clears it when unticked. */
export async function toggleDone(itemId: string, done: boolean): Promise<SaveResult> {
  return save(
    () => both(parseField(tickableIdSchema, itemId, "itemId"), parseField(doneSchema, done, "done")),
    (userId, db, [id, value]) => setDone(userId, db, id, value),
  );
}

/** Saves an item's note (up to 10,000 characters; empty clears it). */
export async function saveNote(itemId: string, note: string): Promise<SaveResult> {
  return save(
    () => both(parseField(noteIdSchema, itemId, "itemId"), parseField(noteSchema, note, "note")),
    (userId, db, [id, value]) => setNote(userId, db, id, value),
  );
}

/** Saves an item's link: empty, or https:// and up to 2,000 characters. */
export async function saveLink(itemId: string, link: string): Promise<SaveResult> {
  return save(
    () => both(parseField(tickableIdSchema, itemId, "itemId"), parseField(linkSchema, link, "link")),
    (userId, db, [id, value]) => setLink(userId, db, id, value),
  );
}

/** Saves the weekly notes on Career (item id `journal`). */
export async function saveJournal(note: string): Promise<SaveResult> {
  return save(
    () => parseField(noteSchema, note, "note"),
    (userId, db, value) => setNote(userId, db, JOURNAL_ID, value),
  );
}
