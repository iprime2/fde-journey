// The save history (progress_event): one row per real change, the right kind, written in the same
// statement as the change, and never any note or link text.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sql } from "drizzle-orm";
import { saveJournal, saveLink, saveNote, toggleDone } from "@/app/actions/progress";
import type { Db } from "@/db/client";
import { readEvents, readProgress, setDone, setLink, setNote } from "@/lib/progress-db";
import { emptyDb, seedOtherUser, seedOwner, setTestEnv } from "./support/db";

setTestEnv();

const OWNER = "owner";
const NOTE = "Made-up note text that must never reach the event log.";
const LINK = "https://example.com/made-up-event-link";

let db: Db;
beforeEach(async () => {
  db = await emptyDb();
  request.headers = new Headers({ cookie: (await seedOwner(db)).cookie });
});

const kinds = async () => (await readEvents(OWNER, db)).map((e) => `${e.itemId}:${e.kind}`);

describe("event kinds", () => {
  it("tick → done, untick → undone; repeating either writes nothing", async () => {
    await toggleDone("l1-1", true);
    await toggleDone("l1-1", true);
    await toggleDone("l1-1", false);
    await toggleDone("l1-1", false);
    await toggleDone("l1-1", true);
    expect(await kinds()).toEqual(["l1-1:done", "l1-1:undone", "l1-1:done"]);
  });

  it("a note change → note; the same note again writes nothing; clearing it → note", async () => {
    await saveNote("s2-4", NOTE);
    await saveNote("s2-4", NOTE);
    await saveNote("s2-4", `${NOTE} Edited.`);
    await saveNote("s2-4", "");
    await saveNote("s2-4", "");
    expect(await kinds()).toEqual(["s2-4:note", "s2-4:note", "s2-4:note"]);
  });

  it("a link change → link; the same link again (even with spaces around it) writes nothing", async () => {
    await saveLink("p1-2", LINK);
    await saveLink("p1-2", `  ${LINK}  `);
    await saveLink("p1-2", "");
    expect(await kinds()).toEqual(["p1-2:link", "p1-2:link"]);
  });

  it("weekly notes → note on the item journal", async () => {
    await saveJournal(NOTE);
    await saveJournal(NOTE);
    expect(await kinds()).toEqual(["journal:note"]);
  });

  it("saving the default on an item never saved writes no event (nothing visible changed)", async () => {
    await toggleDone("l1-2", false);
    await saveNote("l1-3", "");
    await saveLink("r1-1-3", "");
    expect(await kinds()).toEqual([]);
  });

  it("each field logs on its own: a note does not log a tick, a tick does not log a note", async () => {
    await saveNote("l1-1", NOTE);
    await toggleDone("l1-1", true);
    await saveLink("l1-1", LINK);
    await saveNote("l1-1", NOTE);
    await toggleDone("l1-1", true);
    expect(await kinds()).toEqual(["l1-1:note", "l1-1:done", "l1-1:link"]);
  });

  it("refused saves write no event (invalid input, signed out)", async () => {
    await toggleDone("l99-1", true);
    await saveLink("l1-1", "http://example.com");
    await saveNote("l1-1", "a".repeat(10_001));
    request.headers = new Headers();
    await toggleDone("l1-1", true);
    request.headers = new Headers({ cookie: (await seedOtherUser(db)).cookie });
    await saveJournal(NOTE);
    expect(await db.execute(sql`select count(*)::int as n from progress_event`)).toMatchObject({ rows: [{ n: 0 }] });
  });
});

describe("the change and its event", () => {
  it("share one time, which is the row's updated_at", async () => {
    const now = new Date("2026-11-30T10:00:00.000Z");
    const record = await setDone(OWNER, db, "l1-1", true, now);
    expect(record).toMatchObject({ done: true, doneAt: now.toISOString(), updatedAt: now.toISOString() });
    expect(await readEvents(OWNER, db)).toEqual([{ itemId: "l1-1", kind: "done", at: now.toISOString() }]);
  });

  it("an unchanged save keeps updated_at and done_at, and returns the saved row", async () => {
    const first = new Date("2026-11-30T10:00:00.000Z");
    await setDone(OWNER, db, "l1-1", true, first);
    await setNote(OWNER, db, "l1-1", NOTE, first);
    const again = await setDone(OWNER, db, "l1-1", true, new Date("2026-12-01T10:00:00.000Z"));
    expect(again).toEqual({ itemId: "l1-1", done: true, note: NOTE, link: "", doneAt: first.toISOString(), updatedAt: first.toISOString() });
    const sameNote = await setNote(OWNER, db, "l1-1", NOTE, new Date("2026-12-02T10:00:00.000Z"));
    expect(sameNote.updatedAt).toBe(first.toISOString());
  });

  it("a note or link save leaves done_at alone", async () => {
    const ticked = new Date("2026-11-30T10:00:00.000Z");
    await setDone(OWNER, db, "l1-1", true, ticked);
    const noted = await setNote(OWNER, db, "l1-1", NOTE, new Date("2026-11-30T11:00:00.000Z"));
    expect(noted).toMatchObject({ done: true, doneAt: ticked.toISOString(), updatedAt: "2026-11-30T11:00:00.000Z" });
    const linked = await setLink(OWNER, db, "l1-1", LINK, new Date("2026-11-30T12:00:00.000Z"));
    expect(linked).toMatchObject({ done: true, doneAt: ticked.toISOString(), note: NOTE, link: LINK });
  });

  it("are written together or not at all", async () => {
    // Make the event insert fail for one item: the progress change must roll back with it.
    await db.execute(sql`alter table progress_event add constraint test_refuse_l1_2 check (item_id <> 'l1-2')`);
    try {
      await expect(setDone(OWNER, db, "l1-2", true)).rejects.toThrow();
      expect((await readProgress(OWNER, db)).has("l1-2")).toBe(false);
      await setNote(OWNER, db, "l1-2", "", new Date());
      await expect(setNote(OWNER, db, "l1-2", NOTE)).rejects.toThrow();
      expect((await readProgress(OWNER, db)).get("l1-2")?.note).toBe("");
      // Through the action: a generic error, nothing saved.
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await toggleDone("l1-2", true)).toMatchObject({ ok: false, error: { code: "failed" } });
      log.mockRestore();
      expect((await readProgress(OWNER, db)).get("l1-2")?.done).toBe(false);
    } finally {
      await db.execute(sql`alter table progress_event drop constraint test_refuse_l1_2`);
    }
  });
});

describe("no note or link text in the event log", () => {
  it("has no column that could hold it", async () => {
    const columns = await db.execute(sql`select column_name from information_schema.columns where table_name = 'progress_event' order by ordinal_position`);
    expect((columns as unknown as { rows: { column_name: string }[] }).rows.map((r) => r.column_name)).toEqual(["id", "user_id", "item_id", "kind", "at"]);
  });

  it("stores none of the text that was saved", async () => {
    await saveNote("l1-1", NOTE);
    await saveLink("l1-1", LINK);
    await saveJournal(NOTE);
    const rows = await db.execute(sql`select row_to_json(e)::text as row from progress_event e`);
    const dump = (rows as unknown as { rows: { row: string }[] }).rows.map((r) => r.row).join("\n");
    expect(dump).toContain('"kind":"note"');
    expect(dump).not.toContain("Made-up note text");
    expect(dump).not.toContain("example.com");
  });
});
