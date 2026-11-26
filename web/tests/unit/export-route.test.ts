// GET /api/export: the Claude export, authenticated only by a user's export key. A's key returns
// A's sections and progress and never B's; revoked keys and keys of users without a place are
// refused; it is rate-limited, never cached, and never logs a key. Made-up users and keys only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { GET } from "@/app/api/export/route";
import type { Db } from "@/db/client";
import { exportToken, user } from "@/db/schema";
import { EXPORT_REQUESTS_PER_HOUR } from "@/lib/export-auth";
import { hashExportKey, newExportKey } from "@/lib/export-token";
import { setDone, setLink, setNote } from "@/lib/progress-db";
import { addExportKey, revokeExportKey, setSection } from "@/lib/settings-db";
import { OWNER_ID, emptyDb, seedUser, setTestEnv } from "./support/db";

setTestEnv();

let db: Db;
const keys = new Map<string, { key: string; id: string }>();
const A_NOTE = "A's made-up note for Claude.";
const B_NOTE = "B's made-up note, private to B.";

async function addWithKey(userId: string, githubId: string, status: "active" | "waitlisted" | "suspended" = "active") {
  await seedUser(db, { userId, githubId, email: `${userId}@example.com`, status });
  const key = newExportKey();
  const row = await addExportKey(userId, db, hashExportKey(key));
  keys.set(userId, { key, id: row!.id });
}

const call = (authorization?: string) => GET(new Request("http://localhost:3000/api/export", { headers: authorization ? { authorization } : {} }));
const withKey = (userId: string) => call(`Bearer ${keys.get(userId)!.key}`);

beforeEach(async () => {
  process.env.SIGNUP_MODE = "capped";
  db = await emptyDb();
  keys.clear();
  await addWithKey("owner", OWNER_ID);
  await addWithKey("a", "900000000041");
  await addWithKey("b", "900000000042");
  await addWithKey("w", "900000000043", "waitlisted");
  await addWithKey("s", "900000000044", "suspended");
  await setDone("a", db, "l1-1", true);
  await setNote("a", db, "l1-1", A_NOTE);
  await setSection("a", db, "projects", true);
  await setDone("b", db, "l1-2", true);
  await setNote("b", db, "journal", B_NOTE);
  await setLink("b", db, "l1-2", "https://example.com/b-only");
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/export", () => {
  it("returns only the key's user's sections and progress, never cached", async () => {
    const res = await withKey("a");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { format: string; sections: Record<string, boolean>; progress: { itemId: string; note: string }[] };
    expect(body).toMatchObject({ format: "fde-journey-export", version: 1, sections: { roadmap: true, projects: true, scaler: false } });
    expect(body.progress).toEqual([{ itemId: "l1-1", done: true, note: A_NOTE, link: "", doneAt: expect.any(String), updatedAt: expect.any(String) }]);
    const text = JSON.stringify(body);
    expect(text).not.toContain(B_NOTE);
    expect(text).not.toContain("b-only");
    expect(text).not.toContain("@example.com");
  });

  it("B's key returns B's data, and the owner's key the owner's (with every section)", async () => {
    const b = (await (await withKey("b")).json()) as { progress: { itemId: string }[] };
    expect(b.progress.map((p) => p.itemId)).toEqual(["journal", "l1-2"]);
    const owner = (await (await withKey("owner")).json()) as { sections: Record<string, boolean>; progress: unknown[] };
    expect(owner.sections).toMatchObject({ scaler: true, projects: true, career: true });
    expect(owner.progress).toEqual([]);
  });

  it.each([
    ["no header", undefined],
    ["a cookie-style value", "better-auth.session_token=x"],
    ["Basic auth", "Basic dXNlcjpwYXNz"],
    ["a malformed key", "Bearer fdej_short"],
    ["an unknown key", `Bearer ${"fdej_" + "A".repeat(43)}`],
  ])("refuses %s with 401", async (_label, header) => {
    const res = await call(header);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a revoked key, and keys of waitlisted, suspended and deleted users", async () => {
    await revokeExportKey("a", db, keys.get("a")!.id);
    expect((await withKey("a")).status).toBe(401);
    expect((await withKey("w")).status).toBe(401);
    expect((await withKey("s")).status).toBe(401);
    const bKey = keys.get("b")!.key;
    await db.delete(user).where(eq(user.id, "b"));
    expect((await call(`Bearer ${bKey}`)).status).toBe(401);
  });

  it("in owner-only mode, only the owner's key works", async () => {
    process.env.SIGNUP_MODE = "";
    expect((await withKey("a")).status).toBe(401);
    expect((await withKey("owner")).status).toBe(200);
  });

  it("records when a key was last used, and limits requests per key per hour", async () => {
    await db.update(exportToken).set({ windowStart: new Date(), windowCount: EXPORT_REQUESTS_PER_HOUR - 1 }).where(eq(exportToken.userId, "a"));
    expect((await withKey("a")).status).toBe(200);
    const limited = await withKey("a");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3600");
    // Other keys have their own allowance; the window resets after an hour.
    expect((await withKey("b")).status).toBe(200);
    await db.update(exportToken).set({ windowStart: new Date(Date.now() - 61 * 60 * 1000) }).where(eq(exportToken.userId, "a"));
    expect((await withKey("a")).status).toBe(200);
    const [row] = await db.select().from(exportToken).where(eq(exportToken.userId, "a"));
    expect(row).toMatchObject({ lastUsedAt: expect.any(Date), windowCount: 1 });
  });

  it("is read-only for the user's data, and answers 405 to anything but GET", async () => {
    const route = await import("@/app/api/export/route");
    expect(Object.keys(route).filter((k) => k !== "GET")).toEqual([]);
  });

  it("a failure answers 500 and logs names and codes only, never the key", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.execute(sql`alter table export_token rename to export_token_unavailable`);
    try {
      const res = await withKey("a");
      expect(res.status).toBe(500);
      const logged = log.mock.calls.flat().join(" ");
      expect(logged).toMatch(/^Export failed \(/);
      expect(logged).not.toContain(keys.get("a")!.key);
      expect(logged).not.toContain(hashExportKey(keys.get("a")!.key));
    } finally {
      await db.execute(sql`alter table export_token_unavailable rename to export_token`);
    }
  });
});
