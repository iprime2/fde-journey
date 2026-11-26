// Insights (M5a) against the in-memory database (PGlite): the scoped read in lib/progress-db.ts
// (readInsightRows) and the page read getInsights() in lib/data.ts, with its sign-in checks. All
// users, notes and links here are made up. The two-user test through real sessions is in
// isolation.test.ts, where every statement sent is also checked for a user filter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import type { Db } from "@/db/client";
import { getInsights } from "@/lib/data";
import { istWeekStart } from "@/lib/dates";
import { activityWindowStartDay } from "@/lib/insights";
import { readInsightRows, setDone, setLink, setNote } from "@/lib/progress-db";
import { checkSqlText } from "./support/query-guard";
import { emptyDb, recordStatements, seedOtherUser, seedOwner, seedUser, setTestEnv } from "./support/db";

setTestEnv();

const OWNER = "owner";
const OTHER = "other";
const NOTE = "Made-up insights note that must never be read.";
const LINK = "https://example.com/made-up-insights-link";
const DAY = 86_400_000;
const WEEK = 7 * DAY;

let db: Db;
let ownerCookie: string;
let otherCookie: string;

beforeEach(async () => {
  db = await emptyDb();
  ownerCookie = (await seedOwner(db)).cookie;
  otherCookie = (await seedOtherUser(db)).cookie;
  request.headers = new Headers({ cookie: ownerCookie });
});

afterEach(() => {
  delete process.env.SIGNUP_MODE;
});

describe("readInsightRows (the scoped query)", () => {
  const since = new Date("2026-06-07T18:30:00Z");

  beforeEach(async () => {
    // The owner: done items in and before the window, an untick, notes and links.
    await setDone(OWNER, db, "l1-1", true, new Date("2026-06-07T18:29:59Z")); // just before `since`
    await setDone(OWNER, db, "l1-2", true, since); // exactly at `since`
    await setDone(OWNER, db, "l1-3", true, new Date("2026-11-30T05:00:00Z"));
    await setDone(OWNER, db, "l1-3", false, new Date("2026-11-30T06:00:00Z"));
    await setNote(OWNER, db, "l1-2", NOTE, new Date("2026-12-01T05:00:00Z"));
    await setLink(OWNER, db, "l1-2", LINK, new Date("2026-12-01T05:01:00Z"));
    await setNote(OWNER, db, "journal", NOTE, new Date("2026-12-02T05:00:00Z"));
    // The other user: rows and events the owner must never get.
    await setDone(OTHER, db, "cr1", true, new Date("2026-12-01T05:00:00Z"));
    await setNote(OTHER, db, "l1-1", NOTE, new Date("2026-12-01T05:00:00Z"));
  });

  it("returns the user's done items (any date) and their events from `since` on, oldest first", async () => {
    const rows = await readInsightRows(OWNER, db, since);
    expect(rows.done.sort((a, b) => a.itemId.localeCompare(b.itemId))).toEqual([
      { itemId: "l1-1", done: true, doneAt: "2026-06-07T18:29:59.000Z" },
      { itemId: "l1-2", done: true, doneAt: "2026-06-07T18:30:00.000Z" },
    ]);
    expect(rows.events).toEqual([
      { itemId: "l1-2", kind: "done", at: "2026-06-07T18:30:00.000Z" },
      { itemId: "l1-3", kind: "done", at: "2026-11-30T05:00:00.000Z" },
      { itemId: "l1-3", kind: "undone", at: "2026-11-30T06:00:00.000Z" },
      { itemId: "l1-2", kind: "note", at: "2026-12-01T05:00:00.000Z" },
      { itemId: "l1-2", kind: "link", at: "2026-12-01T05:01:00.000Z" },
      { itemId: "journal", kind: "note", at: "2026-12-02T05:00:00.000Z" },
    ]);
  });

  it("never returns note or link text, or another user's rows", async () => {
    const text = JSON.stringify(await readInsightRows(OWNER, db, since));
    expect(text).not.toContain("Made-up insights note");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("cr1");
    const other = await readInsightRows(OTHER, db, since);
    expect(other.done).toEqual([{ itemId: "cr1", done: true, doneAt: "2026-12-01T05:00:00.000Z" }]);
    expect(other.events.map((e) => e.itemId)).toEqual(["cr1", "l1-1"]);
  });

  it("sends two statements, each scoped to the user, selecting no note or link column", async () => {
    const statements = recordStatements(db);
    statements.length = 0;
    await readInsightRows(OWNER, db, since);
    expect(statements).toHaveLength(2);
    for (const s of statements) {
      expect(checkSqlText(s)).toEqual([]);
      expect(s).toMatch(/"user_id" = \$1/);
      expect(s).not.toMatch(/"(note|link)"/);
    }
    expect(statements.find((s) => s.includes(`from "progress" `))).toMatch(/^select "item_id", "done_at" from "progress" where/);
    expect(statements.find((s) => s.includes(`from "progress_event"`))).toMatch(/^select "item_id", "kind", "at" from "progress_event" where \("progress_event"."user_id" = \$1 and "progress_event"."at" >= \$2\)/);
  });

  it("the event query can be served by the (user_id, at) index", async () => {
    const statements = recordStatements(db);
    statements.length = 0;
    await readInsightRows(OWNER, db, since);
    const eventQuery = statements.find((s) => s.includes(`from "progress_event"`))!;
    const client = (db as unknown as { $client: { query: (q: string, p?: unknown[]) => Promise<{ rows: Record<string, string>[] }> } }).$client;
    // With a few rows the planner rightly prefers a sequential scan; turning that off shows the
    // plan it would pick on a large table.
    await client.query("set enable_seqscan = off");
    try {
      const plan = (await client.query(`explain ${eventQuery}`, [OWNER, since.toISOString()])).rows.map((r) => Object.values(r)[0]).join("\n");
      expect(plan).toContain("progress_event_user_at_idx");
      expect(plan).toMatch(/Index Cond: \(\(user_id = .*\) AND \(at >= .*\)\)/);
    } finally {
      await client.query("reset enable_seqscan");
    }
  });

  it("refuses to run without a user id or with a bad start time", async () => {
    for (const bad of ["", undefined, null]) {
      await expect(readInsightRows(bad as unknown as string, db, since)).rejects.toThrow("A user id is required");
    }
    for (const bad of [new Date(Number.NaN), "2026-06-07", undefined]) {
      await expect(readInsightRows(OWNER, db, bad as unknown as Date)).rejects.toThrow("A valid start time is required");
    }
  });
});

describe("getInsights (the page read)", () => {
  it("signed out: redirects to sign-in and reads nothing", async () => {
    request.headers = new Headers();
    const statements = recordStatements(db);
    statements.length = 0;
    await expect(getInsights()).rejects.toThrow(/^REDIRECT \/login/);
    expect(statements.some((s) => /progress/.test(s))).toBe(false);
  });

  it("a forged or expired session cookie counts as signed out", async () => {
    request.headers = new Headers({ cookie: "better-auth.session_token=forged.value" });
    await expect(getInsights()).rejects.toThrow(/^REDIRECT \/login/);
  });

  it("another account in owner-only mode is signed out, and its session revoked", async () => {
    request.headers = new Headers({ cookie: otherCookie });
    await expect(getInsights()).rejects.toThrow(/^REDIRECT \/login/);
  });

  it("a waitlisted user goes to /waitlist; a suspended user to sign-in", async () => {
    process.env.SIGNUP_MODE = "capped";
    const waiting = await seedUser(db, { githubId: "900000000021", userId: "waiting", email: "waiting@example.com", status: "waitlisted" });
    await setDone("waiting", db, "l1-1", true);
    request.headers = new Headers({ cookie: waiting.cookie });
    await expect(getInsights()).rejects.toThrow("REDIRECT /waitlist");
    const suspended = await seedUser(db, { githubId: "900000000022", userId: "suspended", email: "suspended@example.com", status: "suspended" });
    request.headers = new Headers({ cookie: suspended.cookie });
    await expect(getInsights()).rejects.toThrow("REDIRECT /login?error=suspended");
  });

  it("computes the owner's insights from their own rows", async () => {
    const now = Date.now();
    await setDone(OWNER, db, "l1-1", true, new Date(now - 1000));
    await setDone(OWNER, db, "pp1", true, new Date(now - 1000));
    await setDone(OWNER, db, "cr1", true, new Date(now - 1000));
    await setDone(OWNER, db, "l1-2", true, new Date(now - 1000));
    await setDone(OWNER, db, "l1-2", false, new Date(now - 500)); // untick after tick
    await setNote(OWNER, db, "journal", NOTE, new Date(now - 400));
    // Long ago: outside the event window, but the completion still counts towards streaks.
    await setDone(OWNER, db, "l1-3", true, new Date(now - 40 * WEEK));
    // The other user's busy week must not show.
    for (const id of ["l1-4", "l1-5", "c1-1"]) await setDone(OTHER, db, id, true, new Date(now - 1000));

    const i = await getInsights();
    const today = i.activity.days.at(-1)!;
    expect(i.thisWeek.weekStart).toBe(istWeekStart(now));
    expect(i.thisWeek.done).toBe(3);
    expect(i.weekly.at(-1)?.byKind).toMatchObject({ roadmap: 1, reading: 1, courses: 1, certs: 0 });
    expect(i.thisWeek.currentStreak).toBe(1);
    expect(i.thisWeek.longestStreak).toBe(1);
    // Ticks, the tick and untick, and the weekly note: 6 saves today (none from the other user).
    expect(today.count).toBe(6);
    expect(i.activity.activeDays30).toBe(1);
    expect(i.activity.windowStart).toBe(activityWindowStartDay(now));
    expect(i.thisMonth.notesSaved).toBe(1);
    // The owner sees every section.
    expect(i.kinds).toEqual(["roadmap", "resources", "reading", "scaler", "certs", "courses", "projects", "career"]);
    expect(JSON.stringify(i)).not.toContain("Made-up insights note");
  });

  it("an active user's hidden and locked sections are left out (defaults: Scaler, Projects, Career off)", async () => {
    process.env.SIGNUP_MODE = "capped";
    const member = await seedUser(db, { githubId: "900000000023", userId: "member", email: "member@example.com" });
    const now = Date.now();
    for (const id of ["l1-1", "pp1", "s1-1", "p1-1", "k1", "cr2"]) await setDone("member", db, id, true, new Date(now - 1000));
    request.headers = new Headers({ cookie: member.cookie });
    const i = await getInsights();
    expect(i.kinds).toEqual(["roadmap", "resources", "reading", "certs", "courses"]);
    expect(i.thisWeek.done).toBe(3);
    expect(i.weekly.at(-1)?.byKind).toMatchObject({ roadmap: 1, reading: 1, courses: 1, scaler: 0, projects: 0, career: 0 });
    expect(i.activity.days.at(-1)?.count).toBe(3);
  });

  it("an empty user gets a full, all-zero result", async () => {
    const i = await getInsights();
    expect(i.hasCompletions).toBe(false);
    expect(i.activity.hasActivity).toBe(false);
    expect(i.weekly).toHaveLength(12);
    expect(i.thisWeek).toMatchObject({ done: 0, lastWeek: 0, currentStreak: 0, longestStreak: 0 });
    expect(i.phase.projection.status).toBe("not-enough-activity");
  });
});
