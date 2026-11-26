// Two made-up users, A and B, on one in-memory database. Whatever A does through the Server Actions
// and the page reads, B's rows and events stay exactly as they were, and A never sees them.
//
// Sign-in is owner-only in M4a, so "switching users" points OWNER_GITHUB_ID at the user whose
// session cookie the request carries: each user then signs in for real, through the same
// requireUser() path production uses. Every SQL statement the app sends is recorded and checked
// for a user filter (the runtime half of isolation-guard.test.ts). That covers the Server Actions
// and getProgress(), the one data function every page and the sidebar counts read through.
// Rendering the pages themselves here isn't practical (async Server Components need Next's
// renderer); the static guard is what keeps pages from querying the tables any other way.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { asc, eq } from "drizzle-orm";
import { saveJournal, saveLink, saveNote, toggleDone } from "@/app/actions/progress";
import type { Db } from "@/db/client";
import { progress, progressEvent, user } from "@/db/schema";
import { getProgress } from "@/lib/data";
import { readEvents, readProgress, setDone, setLink, setNote } from "@/lib/progress-db";
import { requireUser } from "@/lib/session";
import { checkSqlText } from "./support/query-guard";
import { emptyDb, seedUser, setTestEnv } from "./support/db";

setTestEnv();

const A = { userId: "user-a", githubId: "900000000011", email: "a@example.com" };
const B = { userId: "user-b", githubId: "900000000012", email: "b@example.com" };
type TestUser = typeof A;
const cookies = new Map<string, string>();

/** Makes the next requests come from this user's real session. */
function actAs(who: TestUser) {
  process.env.OWNER_GITHUB_ID = who.githubId;
  request.headers = new Headers({ cookie: cookies.get(who.userId)! });
}

let db: Db;
const B_NOTE = "B's made-up note, private to B.";
const B_LINK = "https://example.com/b-only";
const B_TIME = new Date("2026-11-20T08:00:00Z");

/** B's saved state: ticks, a note, a link and weekly notes on the items A will touch. */
async function seedB() {
  for (const id of ["l1-1", "r1-1-3", "p1-2", "s2-4"]) {
    await setDone(B.userId, db, id, true, B_TIME);
    await setNote(B.userId, db, id, B_NOTE, B_TIME);
    await setLink(B.userId, db, id, B_LINK, B_TIME);
  }
  await setNote(B.userId, db, "journal", B_NOTE, B_TIME);
}

const rowsOf = (who: TestUser) => db.select().from(progress).where(eq(progress.userId, who.userId)).orderBy(asc(progress.itemId));
const eventsOf = (who: TestUser) => db.select().from(progressEvent).where(eq(progressEvent.userId, who.userId)).orderBy(asc(progressEvent.id));

// Every statement sent to the database during this file. Drizzle's PGlite driver calls
// client.query for every statement, so a wrapper around it sees them all.
const statements: string[] = [];
type Client = { query: (...args: unknown[]) => Promise<unknown> };
let client: Client;
let realQuery: Client["query"];

beforeAll(async () => {
  db = await emptyDb();
  client = (db as unknown as { $client: Client }).$client;
  realQuery = client.query;
  client.query = function (this: Client, ...args: unknown[]) {
    if (typeof args[0] === "string") statements.push(args[0]);
    return realQuery.apply(this, args);
  };
});
afterAll(() => {
  client.query = realQuery;
});

beforeEach(async () => {
  db = await emptyDb();
  cookies.clear();
  for (const who of [A, B]) cookies.set(who.userId, (await seedUser(db, who)).cookie);
  await seedB();
  actAs(A);
});

// Each on an item B has ticked, noted and linked.
const actions = {
  toggleDone: { run: () => toggleDone("l1-1", true), itemId: "l1-1", done: true },
  untick: { run: () => toggleDone("r1-1-3", false), itemId: "r1-1-3", done: false },
  saveNote: { run: () => saveNote("p1-2", "A's made-up note."), itemId: "p1-2", done: false },
  clearNote: { run: () => saveNote("s2-4", ""), itemId: "s2-4", done: false },
  saveLink: { run: () => saveLink("l1-1", "https://example.com/a"), itemId: "l1-1", done: false },
  clearLink: { run: () => saveLink("p1-2", ""), itemId: "p1-2", done: false },
  saveJournal: { run: () => saveJournal("A's made-up weekly note."), itemId: "journal", done: false },
};

describe.each(Object.entries(actions))("%s as user A", (_name, { run, itemId, done }) => {
  it("changes only A's row and A's events; B's rows and events stay exactly as they were", async () => {
    const [bRows, bEvents] = [await rowsOf(B), await eventsOf(B)];
    const result = await run();
    expect(result.ok).toBe(true);
    expect(await rowsOf(B)).toEqual(bRows);
    expect(await eventsOf(B)).toEqual(bEvents);
    const aRows = await rowsOf(A);
    expect(aRows.map((r) => r.itemId)).toEqual([itemId]);
    expect(aRows[0].userId).toBe(A.userId);
  });

  it("returns A's record, never B's values for the same item", async () => {
    const result = await run();
    if (!result.ok) throw new Error("expected ok");
    expect(result.record.itemId).toBe(itemId);
    expect(result.record.note).not.toBe(B_NOTE);
    expect(result.record.link).not.toBe(B_LINK);
    // B has these items ticked; A's first save on an item never inherits the tick.
    expect(result.record.done).toBe(done);
  });

  it("is refused as signed out for B's session while A is the owner, and writes nothing", async () => {
    request.headers = new Headers({ cookie: cookies.get(B.userId)! });
    const [aBefore, bBefore] = [await rowsOf(A), await rowsOf(B)];
    expect(await run()).toMatchObject({ ok: false, error: { code: "signed-out" } });
    expect(await rowsOf(A)).toEqual(aBefore);
    expect(await rowsOf(B)).toEqual(bBefore);
  });
});

describe("the user comes from the session only", () => {
  it("ignores anything extra the browser sends, such as another user's id", async () => {
    const forged = toggleDone as unknown as (...args: unknown[]) => Promise<unknown>;
    await forged("l1-1", true, B.userId, { userId: B.userId });
    expect((await rowsOf(A)).map((r) => r.itemId)).toEqual(["l1-1"]);
    expect((await rowsOf(B)).find((r) => r.itemId === "l1-1")?.updatedAt).toEqual(B_TIME);
  });

  it("switches with the session: B saves to B, A saves to A", async () => {
    actAs(B);
    expect(await requireUser()).toBe(B.userId);
    await saveNote("l1-2", "B's second made-up note.");
    actAs(A);
    expect(await requireUser()).toBe(A.userId);
    await saveNote("l1-2", "A's made-up note.");
    expect((await readProgress(B.userId, db)).get("l1-2")?.note).toBe("B's second made-up note.");
    expect((await readProgress(A.userId, db)).get("l1-2")?.note).toBe("A's made-up note.");
  });
});

describe("reads", () => {
  it("getProgress (every page) lists only the signed-in user's rows", async () => {
    await toggleDone("l1-2", true);
    const forA = await getProgress();
    expect([...forA.keys()]).toEqual(["l1-2"]);
    expect(JSON.stringify([...forA.values()])).not.toContain("B's made-up");
    actAs(B);
    const forB = await getProgress();
    expect([...forB.keys()].sort()).toEqual(["journal", "l1-1", "p1-2", "r1-1-3", "s2-4"]);
    expect(forB.has("l1-2")).toBe(false);
  });

  it("a user with nothing saved sees nothing, though another user has rows", async () => {
    expect((await getProgress()).size).toBe(0);
    expect(await readProgress(A.userId, db)).toEqual(new Map());
    expect(await readEvents(A.userId, db)).toEqual([]);
  });

  it("readEvents lists only the user's own events", async () => {
    await toggleDone("l1-1", true);
    expect(await readEvents(A.userId, db)).toEqual([{ itemId: "l1-1", kind: "done", at: expect.any(String) }]);
    const bEvents = await readEvents(B.userId, db);
    expect(bEvents).toHaveLength(13);
    expect(bEvents.every((e) => e.at === B_TIME.toISOString())).toBe(true);
  });

  it("refuses to run without a user id", async () => {
    for (const bad of ["", undefined, null]) {
      await expect(readProgress(bad as unknown as string, db)).rejects.toThrow("A user id is required");
      await expect(readEvents(bad as unknown as string, db)).rejects.toThrow("A user id is required");
      await expect(setDone(bad as unknown as string, db, "l1-1", true)).rejects.toThrow("A user id is required");
    }
    expect(await rowsOf(A)).toEqual([]);
  });

  it("deleting a user removes their rows and events only", async () => {
    await toggleDone("l1-1", true);
    await db.delete(user).where(eq(user.id, B.userId));
    expect(await rowsOf(B)).toEqual([]);
    expect(await eventsOf(B)).toEqual([]);
    expect(await rowsOf(A)).toHaveLength(1);
    expect(await eventsOf(A)).toHaveLength(1);
  });
});

describe("every statement the app sent on progress or progress_event", () => {
  it("had a user filter", () => {
    const touching = statements.filter((s) => /\b(from|into|update|join)\s+"?progress(_event)?"?(?![\w."])/i.test(s));
    // Reads, upserts with events, read-backs and the test's own scoped selects.
    expect(touching.length).toBeGreaterThan(50);
    const unscoped = touching.filter((s) => checkSqlText(s).length > 0);
    // The test support's emptyDb() deletes everything between tests; nothing else may be unscoped.
    expect(unscoped.filter((s) => !/^delete from "progress(_event)?"$/.test(s.trim()))).toEqual([]);
  });
});
