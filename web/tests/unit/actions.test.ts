// Every save action: signed out, wrong user, owner, and invalid inputs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const fail = vi.hoisted(() => ({ next: false }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/progress-db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/progress-db")>();
  const maybeFail =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      if (fail.next) {
        fail.next = false;
        // Like a Postgres error, whose detail can quote the row.
        throw Object.assign(new Error(`Failing row contains (${String(args[2])})`), { code: "23514" });
      }
      return fn(...args);
    };
  return { ...real, setDone: maybeFail(real.setDone), setNote: maybeFail(real.setNote), setLink: maybeFail(real.setLink) };
});

import { revalidatePath } from "next/cache";
import { saveJournal, saveLink, saveNote, toggleDone } from "@/app/actions/progress";
import type { Db } from "@/db/client";
import { progress } from "@/db/schema";
import { readProgress } from "@/lib/progress-db";
import { emptyDb, seedOtherUser, seedOwner, setTestEnv } from "./support/db";

setTestEnv();

let db: Db;
beforeEach(async () => {
  db = await emptyDb();
  request.headers = new Headers();
  vi.mocked(revalidatePath).mockClear();
});

const signInAsOwner = async () => {
  request.headers = new Headers({ cookie: (await seedOwner(db)).cookie });
};
const signInAsOther = async () => {
  request.headers = new Headers({ cookie: (await seedOtherUser(db)).cookie });
};

const NOTE = "Finished the quickstart. Next: try hybrid search on the sample set.";
const LINK = "https://example.com/demo";

const actions = {
  toggleDone: () => toggleDone("l1-1", true),
  saveNote: () => saveNote("l1-1", NOTE),
  saveLink: () => saveLink("l1-1", LINK),
  saveJournal: () => saveJournal(NOTE),
};

describe.each(Object.entries(actions))("%s authorisation", (_name, run) => {
  it("refuses when signed out, without writing", async () => {
    expect(await run()).toEqual({ ok: false, error: { code: "signed-out", message: "You were signed out, so that change wasn't saved." } });
    expect(await db.select().from(progress)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a signed-in account that is not the owner, without writing", async () => {
    await signInAsOther();
    const result = await run();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("signed-out");
    expect(await db.select().from(progress)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saves for the owner and refreshes every page", async () => {
    await signInAsOwner();
    const result = await run();
    expect(result.ok).toBe(true);
    expect(await db.select().from(progress)).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns a generic error if the database fails, and logs no personal text", async () => {
    await signInAsOwner();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fail.next = true;
    const result = await run();
    expect(result).toEqual({ ok: false, error: { code: "failed", message: "That change wasn't saved. Check your connection, then try again." } });
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("23514");
    expect(logged).not.toContain("quickstart");
    expect(logged).not.toContain("example.com");
    log.mockRestore();
  });
});

describe("toggleDone", () => {
  beforeEach(signInAsOwner);

  it("sets doneAt when ticked, keeps it on a repeat tick, clears it when unticked", async () => {
    const first = await toggleDone("r1-1-3", true);
    if (!first.ok) throw new Error("expected ok");
    expect(first.record).toMatchObject({ itemId: "r1-1-3", done: true, note: "", link: "" });
    expect(first.record.doneAt).not.toBeNull();
    const again = await toggleDone("r1-1-3", true);
    if (!again.ok) throw new Error("expected ok");
    expect(again.record.doneAt).toBe(first.record.doneAt);
    const undone = await toggleDone("r1-1-3", false);
    if (!undone.ok) throw new Error("expected ok");
    expect(undone.record).toMatchObject({ done: false, doneAt: null });
  });

  it.each([
    ["an unknown id", "l99-1", true, "itemId"],
    ["the journal (not tickable)", "journal", true, "itemId"],
    ["SQL in the id", "l1-1'; drop table progress; --", true, "itemId"],
    ["a non-boolean done", "l1-1", "yes", "done"],
    ["a missing done", "l1-1", undefined, "done"],
  ])("rejects %s", async (_label, id, done, field) => {
    const result = await toggleDone(id as string, done as boolean);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid", field } });
    expect(await db.select().from(progress)).toEqual([]);
  });
});

describe("saveNote and saveJournal", () => {
  beforeEach(signInAsOwner);

  it("keeps the tick when a note is saved, and the note when the item is ticked", async () => {
    await toggleDone("s2-4", true);
    await saveNote("s2-4", NOTE);
    await toggleDone("s2-4", false);
    expect((await readProgress(db)).get("s2-4")).toMatchObject({ done: false, note: NOTE });
  });

  it("saves the weekly journal under the id journal", async () => {
    const result = await saveJournal(NOTE);
    expect(result).toMatchObject({ ok: true, record: { itemId: "journal", note: NOTE } });
  });

  it("accepts exactly 10,000 characters and rejects 10,001", async () => {
    expect((await saveNote("l1-1", "a".repeat(10_000))).ok).toBe(true);
    expect(await saveNote("l1-1", "a".repeat(10_001))).toMatchObject({ ok: false, error: { code: "invalid", field: "note", message: "Notes can be up to 10,000 characters." } });
    expect(await saveJournal("a".repeat(10_001))).toMatchObject({ ok: false, error: { field: "note" } });
  });

  it("rejects unknown ids and non-text notes", async () => {
    expect(await saveNote("bk999", NOTE)).toMatchObject({ ok: false, error: { field: "itemId" } });
    expect(await saveNote("l1-1", { text: NOTE } as unknown as string)).toMatchObject({ ok: false, error: { field: "note" } });
    expect(await saveJournal(42 as unknown as string)).toMatchObject({ ok: false, error: { field: "note" } });
    expect(await db.select().from(progress)).toEqual([]);
  });
});

describe("saveLink", () => {
  beforeEach(signInAsOwner);

  it("saves https links (trimmed) and clears with an empty string", async () => {
    expect(await saveLink("p1-2", `  ${LINK}  `)).toMatchObject({ ok: true, record: { link: LINK } });
    expect(await saveLink("p1-2", "")).toMatchObject({ ok: true, record: { link: "" } });
  });

  it.each([
    ["javascript:", "javascript:alert(document.cookie)", "Links must start with https://"],
    ["http", "http://example.com", "Links must start with https://"],
    ["too long", `https://example.com/${"a".repeat(2_000)}`, "Links can be up to 2,000 characters."],
    ["credentials", "https://user:pw@example.com", "Links can't include a user name or password."],
  ])("rejects a %s link", async (_label, link, message) => {
    expect(await saveLink("p1-2", link)).toEqual({ ok: false, error: { code: "invalid", field: "link", message } });
    expect(await db.select().from(progress)).toEqual([]);
  });

  it("does not take links for the journal", async () => {
    expect(await saveLink("journal", LINK)).toMatchObject({ ok: false, error: { field: "itemId" } });
  });
});
