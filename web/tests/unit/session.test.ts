// The session helper and getProgress, against a real Better Auth instance and an in-memory database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers(), reads: 0 }));
// As in a Server Component: headers can be read, cookies cannot be set. Better Auth's Next.js
// plugin imports "next/headers.js", so both names are mocked.
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => {
    request.reads += 1;
    return request.headers;
  },
  cookies: async () => ({
    get: () => undefined,
    set: () => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    },
  }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { inspect } from "node:util";
import { eq, sql } from "drizzle-orm";
import { session } from "@/db/schema";
import { getProgress } from "@/lib/data";
import { PATH_HEADER } from "@/lib/login";
import { isReadOnly } from "@/lib/mode";
import { setDone, setNote } from "@/lib/progress-db";
import { SafeError } from "@/lib/safe-log";
import { SignedOutError, getIdentity, requireUser } from "@/lib/session";
import { OWNER_ID, emptyDb, seedOtherUser, seedOwner, setTestEnv, signedCookieValue } from "./support/db";

setTestEnv();

const useCookie = (cookie: string | null, path = "/roadmap") => {
  request.headers = new Headers(cookie ? { cookie, [PATH_HEADER]: path } : { [PATH_HEADER]: path });
};

beforeEach(async () => {
  process.env.OWNER_GITHUB_ID = OWNER_ID;
  await emptyDb();
  useCookie(null);
});

describe("getIdentity (owner-only mode, the default)", () => {
  it("always reads the request, even when it can answer early (so Next never prerenders it)", async () => {
    delete process.env.OWNER_GITHUB_ID;
    request.reads = 0;
    expect(await getIdentity()).toBeNull();
    expect(request.reads).toBe(1);
    expect(await isReadOnly()).toBe(true);
    expect(request.reads).toBe(2);
  });

  it("returns null when signed out", async () => {
    expect(await getIdentity()).toBeNull();
    expect(await isReadOnly()).toBe(true);
  });

  it("returns the owner for the owner's session", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    expect(await getIdentity()).toEqual({
      userId: "owner",
      name: "Test User",
      image: null,
      githubLogin: null,
      status: "active",
      isSuperAdmin: true,
      permissions: ["metrics.view", "users.view", "users.manage", "waitlist.manage", "settings.manage", "audit.view", "admins.manage"],
    });
    expect(await isReadOnly()).toBe(false);
  });

  it("returns null for a valid session of another GitHub account, and revokes that session", async () => {
    const db = await emptyDb();
    await seedOwner(db);
    useCookie((await seedOtherUser(db)).cookie);
    expect(await getIdentity()).toBeNull();
    expect((await db.select().from(session)).map((s) => s.userId)).toEqual(["owner"]);
  });

  it("signs the old owner out when OWNER_GITHUB_ID changes after sign-in", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    process.env.OWNER_GITHUB_ID = "900000000009";
    expect(await getIdentity()).toBeNull();
    expect(await db.select().from(session)).toEqual([]);
    process.env.OWNER_GITHUB_ID = OWNER_ID;
    expect(await getIdentity()).toBeNull();
  });

  it("keeps sessions when OWNER_GITHUB_ID is missing (a misconfiguration), but lets nobody in", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    delete process.env.OWNER_GITHUB_ID;
    expect(await getIdentity()).toBeNull();
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("never renews the session while reading it (pages cannot set cookies)", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    const [before] = await db.select().from(session);
    expect(await getIdentity()).not.toBeNull();
    const [after] = await db.select().from(session);
    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
  });

  it("returns null for a forged signature, an unknown token or an expired session", async () => {
    const db = await emptyDb();
    const { token } = await seedOwner(db);
    useCookie(`better-auth.session_token=${signedCookieValue(token, "a-different-secret-that-is-long-enough")}`);
    expect(await getIdentity()).toBeNull();
    useCookie(`better-auth.session_token=${signedCookieValue("no-such-token-0000000000000000")}`);
    expect(await getIdentity()).toBeNull();
    useCookie(`better-auth.session_token=${signedCookieValue(token)}`);
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.token, token));
    expect(await getIdentity()).toBeNull();
  });
});

describe("requireUser", () => {
  it("returns the signed-in owner's user id from the session", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    expect((await requireUser()).userId).toBe("owner");
    expect(await requireUser({ onSignedOut: "throw" })).toMatchObject({ userId: "owner", status: "active", isSuperAdmin: true });
  });

  it("sends signed-out visitors to /login, back to the page they wanted", async () => {
    useCookie(null, "/scaler?q=rag");
    await expect(requireUser()).rejects.toThrow("REDIRECT /login?next=%2Fscaler%3Fq%3Drag");
  });

  it("ignores an unsafe path header", async () => {
    useCookie(null, "//evil.example");
    await expect(requireUser()).rejects.toThrow("REDIRECT /login");
  });

  it("throws SignedOutError instead of redirecting when asked (Server Actions)", async () => {
    await expect(requireUser({ onSignedOut: "throw" })).rejects.toBeInstanceOf(SignedOutError);
  });

  it("refuses another account in M4a (owner-only), revoking its session", async () => {
    const db = await emptyDb();
    await seedOwner(db);
    useCookie((await seedOtherUser(db)).cookie);
    await expect(requireUser({ onSignedOut: "throw" })).rejects.toBeInstanceOf(SignedOutError);
    expect((await db.select().from(session)).map((s) => s.userId)).toEqual(["owner"]);
  });
});

describe("getProgress", () => {
  it("returns the owner's saved records", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    await setDone("owner", db, "l1-1", true, new Date("2026-11-30T10:00:00Z"));
    await setNote("owner", db, "journal", "Made-up weekly note.", new Date("2026-11-30T11:00:00Z"));
    const progress = await getProgress();
    expect(progress.size).toBe(2);
    expect(progress.get("l1-1")).toEqual({
      done: true,
      note: "",
      link: "",
      doneAt: "2026-11-30T10:00:00.000Z",
      updatedAt: "2026-11-30T10:00:00.000Z",
    });
    expect(progress.get("journal")?.note).toBe("Made-up weekly note.");
  });

  it("redirects signed-out visitors and other accounts instead of returning data", async () => {
    const db = await emptyDb();
    await seedOwner(db);
    await setDone("owner", db, "l1-1", true);
    await expect(getProgress()).rejects.toThrow(/^REDIRECT \/login/);
    useCookie((await seedOtherUser(db)).cookie);
    await expect(getProgress()).rejects.toThrow(/^REDIRECT \/login/);
  });

  it("throws a SafeError when the read fails, so the server log never gets the query or its parameters", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    await db.execute(sql`alter table progress rename to progress_unavailable`);
    try {
      const error = await getProgress().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SafeError);
      expect((error as SafeError).message).toMatch(/^Reading progress failed \(DrizzleQueryError < \w+ 42P01\)$/);
      expect((error as SafeError).cause).toBeUndefined();
      expect(inspect(error, { depth: 10 })).not.toMatch(/params|select|"owner"/);
    } finally {
      await db.execute(sql`alter table progress_unavailable rename to progress`);
    }
  });
});
