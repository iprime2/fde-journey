// The session helper and getProgress, against a real Better Auth instance and an in-memory database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers(), reads: 0 }));
vi.mock("next/headers", () => ({
  headers: async () => {
    request.reads += 1;
    return request.headers;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { eq } from "drizzle-orm";
import { session } from "@/db/schema";
import { getProgress } from "@/lib/data";
import { PATH_HEADER } from "@/lib/login";
import { isReadOnly } from "@/lib/mode";
import { setDone, setNote } from "@/lib/progress-db";
import { getOwnerSession, requireOwner } from "@/lib/session";
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

describe("getOwnerSession", () => {
  it("always reads the request, even when it can answer early (so Next never prerenders it)", async () => {
    delete process.env.OWNER_GITHUB_ID;
    request.reads = 0;
    expect(await getOwnerSession()).toBeNull();
    expect(request.reads).toBe(1);
    expect(await isReadOnly()).toBe(true);
    expect(request.reads).toBe(2);
  });

  it("returns null when signed out", async () => {
    expect(await getOwnerSession()).toBeNull();
    expect(await isReadOnly()).toBe(true);
  });

  it("returns the owner for the owner's session", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    expect(await getOwnerSession()).toEqual({ userId: "owner", name: "Test User", image: null });
    expect(await isReadOnly()).toBe(false);
  });

  it("returns null for a valid session of another GitHub account", async () => {
    const db = await emptyDb();
    useCookie((await seedOtherUser(db)).cookie);
    expect(await getOwnerSession()).toBeNull();
  });

  it("returns null when OWNER_GITHUB_ID changes after sign-in", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    process.env.OWNER_GITHUB_ID = "900000000009";
    expect(await getOwnerSession()).toBeNull();
    delete process.env.OWNER_GITHUB_ID;
    expect(await getOwnerSession()).toBeNull();
  });

  it("returns null for a forged signature, an unknown token or an expired session", async () => {
    const db = await emptyDb();
    const { token } = await seedOwner(db);
    useCookie(`better-auth.session_token=${signedCookieValue(token, "a-different-secret-that-is-long-enough")}`);
    expect(await getOwnerSession()).toBeNull();
    useCookie(`better-auth.session_token=${signedCookieValue("no-such-token-0000000000000000")}`);
    expect(await getOwnerSession()).toBeNull();
    useCookie(`better-auth.session_token=${signedCookieValue(token)}`);
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.token, token));
    expect(await getOwnerSession()).toBeNull();
  });
});

describe("requireOwner", () => {
  it("sends signed-out visitors to /login, back to the page they wanted", async () => {
    useCookie(null, "/scaler?q=rag");
    await expect(requireOwner()).rejects.toThrow("REDIRECT /login?next=%2Fscaler%3Fq%3Drag");
  });

  it("ignores an unsafe path header", async () => {
    useCookie(null, "//evil.example");
    await expect(requireOwner()).rejects.toThrow("REDIRECT /login");
  });
});

describe("getProgress", () => {
  it("returns the owner's saved records", async () => {
    const db = await emptyDb();
    useCookie((await seedOwner(db)).cookie);
    await setDone(db, "l1-1", true, new Date("2026-11-30T10:00:00Z"));
    await setNote(db, "journal", "Made-up weekly note.", new Date("2026-11-30T11:00:00Z"));
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
    await setDone(db, "l1-1", true);
    await expect(getProgress()).rejects.toThrow(/^REDIRECT \/login/);
    useCookie((await seedOtherUser(db)).cookie);
    await expect(getProgress()).rejects.toThrow(/^REDIRECT \/login/);
  });
});
