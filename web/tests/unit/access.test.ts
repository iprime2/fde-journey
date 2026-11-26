// Who gets in, in capped mode (SIGNUP_MODE=capped): getIdentity, requireUser and requirePermission
// against a real Better Auth session reader and an in-memory database, and the save actions for
// waitlisted and suspended users. Made-up users only.
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { eq } from "drizzle-orm";
import { saveJournal, saveLink, saveNote, toggleDone } from "@/app/actions/progress";
import { refreshSession } from "@/app/actions/auth";
import type { Db } from "@/db/client";
import { progress, session, user, userPermission } from "@/db/schema";
import { getProgress } from "@/lib/data";
import { isReadOnly } from "@/lib/mode";
import { PermissionError, SignedOutError, WaitlistedError, getIdentity, requirePermission, requireUser } from "@/lib/session";
import { OWNER_ID, emptyDb, seedUser, setTestEnv } from "./support/db";

setTestEnv();

let db: Db;
const cookies = new Map<string, string>();
const as = (userId: string | null) => {
  request.headers = new Headers(userId ? { cookie: cookies.get(userId)! } : {});
};

beforeEach(async () => {
  process.env.SIGNUP_MODE = "capped";
  db = await emptyDb();
  cookies.clear();
  const add = async (userId: string, githubId: string, extra: Partial<Parameters<typeof seedUser>[1]> = {}) =>
    cookies.set(userId, (await seedUser(db, { userId, githubId, email: `${userId}@example.com`, githubLogin: userId, ...extra })).cookie);
  await add("owner", OWNER_ID);
  await add("active", "900000000021");
  await add("waiting", "900000000022", { status: "waitlisted" });
  await add("suspended", "900000000023", { status: "suspended" });
  await add("admin", "900000000024", { permissions: ["users.view", "audit.view"] });
  as(null);
});

describe("getIdentity in capped mode", () => {
  it("knows the owner as the super admin with every permission", async () => {
    as("owner");
    expect(await getIdentity()).toMatchObject({ userId: "owner", status: "active", isSuperAdmin: true, permissions: expect.arrayContaining(["admins.manage", "metrics.view"]) });
  });

  it("returns active and waitlisted users with their status; a waitlisted user has no permissions", async () => {
    as("active");
    expect(await getIdentity()).toMatchObject({ userId: "active", status: "active", isSuperAdmin: false, permissions: [], githubLogin: "active" });
    as("admin");
    expect(await getIdentity()).toMatchObject({ permissions: ["users.view", "audit.view"] });
    await db.insert(userPermission).values({ userId: "waiting", permission: "metrics.view" });
    as("waiting");
    expect(await getIdentity()).toMatchObject({ userId: "waiting", status: "waitlisted", permissions: [] });
  });

  it("ends every session of a suspended user on sight", async () => {
    await db.insert(session).values({ id: "suspended-2", token: "another-made-up-token-000", userId: "suspended", expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() });
    as("suspended");
    expect(await getIdentity()).toBeNull();
    expect(await db.select().from(session).where(eq(session.userId, "suspended"))).toEqual([]);
  });

  it("in owner-only mode, only the owner (other sessions are revoked)", async () => {
    process.env.SIGNUP_MODE = "owner-only";
    as("active");
    expect(await getIdentity()).toBeNull();
    expect(await db.select().from(session).where(eq(session.userId, "active"))).toEqual([]);
    as("owner");
    expect((await getIdentity())?.isSuperAdmin).toBe(true);
  });
});

describe("requireUser in capped mode", () => {
  it("lets active users in", async () => {
    as("active");
    expect((await requireUser()).userId).toBe("active");
    expect(await isReadOnly()).toBe(false);
  });

  it("sends a waitlisted user to /waitlist from every page, and refuses them in actions", async () => {
    as("waiting");
    await expect(requireUser()).rejects.toThrow("REDIRECT /waitlist");
    await expect(getProgress()).rejects.toThrow("REDIRECT /waitlist");
    await expect(requireUser({ onSignedOut: "throw" })).rejects.toBeInstanceOf(WaitlistedError);
    await expect(requireUser({ onSignedOut: "throw" })).rejects.toBeInstanceOf(SignedOutError);
    expect(await isReadOnly()).toBe(true);
    // Only /waitlist and leaving it ask for this.
    expect((await requireUser({ allowWaitlisted: true })).status).toBe("waitlisted");
  });

  it("sends a suspended user to /login?error=suspended", async () => {
    as("suspended");
    await expect(requireUser()).rejects.toThrow("REDIRECT /login?error=suspended");
  });
});

describe("saving progress", () => {
  const saves = [() => toggleDone("l1-1", true), () => saveNote("l1-1", "A made-up note."), () => saveLink("l1-1", "https://example.com/x"), () => saveJournal("Made-up weekly note.")];

  it.each(["waiting", "suspended"])("is refused for a %s user, and writes nothing", async (who) => {
    for (const save of saves) {
      as(who);
      expect(await save()).toMatchObject({ ok: false, error: { code: "signed-out" } });
    }
    expect(await db.select().from(progress)).toEqual([]);
  });

  it("works for an active user and records them as active (at most once an hour)", async () => {
    as("active");
    expect((await toggleDone("l1-1", true)).ok).toBe(true);
    const [first] = await db.select({ at: user.lastActiveAt }).from(user).where(eq(user.id, "active"));
    expect(first.at).toBeInstanceOf(Date);
    expect((await toggleDone("l1-2", true)).ok).toBe(true);
    const [second] = await db.select({ at: user.lastActiveAt }).from(user).where(eq(user.id, "active"));
    expect(second.at).toEqual(first.at);
  });

  it("stops working the moment the user is suspended", async () => {
    as("active");
    expect((await toggleDone("l1-1", true)).ok).toBe(true);
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, "active"));
    expect(await toggleDone("l1-2", true)).toMatchObject({ ok: false, error: { code: "signed-out" } });
  });
});

describe("refreshSession", () => {
  it("keeps active and waitlisted users signed in, not suspended ones", async () => {
    for (const [who, expected] of [["active", true], ["waiting", true], ["suspended", false]] as const) {
      as(who);
      expect((await refreshSession()).ok).toBe(expected);
    }
  });
});

describe("requirePermission", () => {
  it("refuses signed-out and waitlisted visitors as signed out", async () => {
    await expect(requirePermission("users.view")).rejects.toBeInstanceOf(SignedOutError);
    as("waiting");
    await expect(requirePermission("users.view")).rejects.toBeInstanceOf(SignedOutError);
  });

  it("refuses a user without any permission, and an admin without this one", async () => {
    as("active");
    await expect(requirePermission("users.view")).rejects.toBeInstanceOf(PermissionError);
    as("admin");
    await expect(requirePermission("users.manage")).rejects.toBeInstanceOf(PermissionError);
    expect(await requirePermission("users.view")).toEqual({ userId: "admin", isSuperAdmin: false, permissions: ["users.view", "audit.view"] });
  });

  it("reads the permission fresh every time: one taken away a moment ago no longer works", async () => {
    as("admin");
    expect((await requirePermission("audit.view")).userId).toBe("admin");
    await db.delete(userPermission).where(eq(userPermission.userId, "admin"));
    await expect(requirePermission("audit.view")).rejects.toBeInstanceOf(PermissionError);
  });

  it("gives the super admin every permission", async () => {
    as("owner");
    for (const p of ["metrics.view", "users.view", "users.manage", "waitlist.manage", "settings.manage", "audit.view", "admins.manage"] as const) {
      expect(await requirePermission(p)).toMatchObject({ userId: "owner", isSuperAdmin: true });
    }
  });

  it("on admin pages: signed out goes to /login, no permission shows not-found", async () => {
    await expect(requirePermission("audit.view", { onDenied: "not-found" })).rejects.toThrow(/^REDIRECT \/login/);
    as("active");
    await expect(requirePermission("audit.view", { onDenied: "not-found" })).rejects.toThrow("NOT_FOUND");
    as("waiting");
    await expect(requirePermission("audit.view", { onDenied: "not-found" })).rejects.toThrow("REDIRECT /waitlist");
  });
});
