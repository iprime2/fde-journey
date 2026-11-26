// The auth route handler and the sign-in, sign-out and refresh actions: signed out, wrong user, owner.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers(), cookiesSet: [] as { name: string; options: { maxAge?: number } }[] }));
// Better Auth's Next.js plugin writes cookies through cookies().set(), as it does in a Server
// Action. It imports "next/headers.js" (with the extension), so both names are mocked.
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    set: (name: string, _value: string, options: { maxAge?: number }) => request.cookiesSet.push({ name, options }),
    get: () => undefined,
  }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { refreshSession, signInWithGitHub, signOut } from "@/app/actions/auth";
import type { Db } from "@/db/client";
import { eq, sql } from "drizzle-orm";
import { session, verification } from "@/db/schema";
import { emptyDb, resetAuth, seedOtherUser, seedOwner, setTestEnv } from "./support/db";

setTestEnv();

const BASE = "http://localhost:3000";
let db: Db;
beforeEach(async () => {
  db = await emptyDb();
  request.headers = new Headers();
  request.cookiesSet = [];
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  resetAuth();
});

const form = (next?: string) => {
  const f = new FormData();
  if (next !== undefined) f.set("next", next);
  return f;
};
const redirectOf = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof Error) || !error.message.startsWith("REDIRECT ")) throw new Error(`expected a redirect, got ${String(error)}`);
  return error.message.slice("REDIRECT ".length);
};

describe("auth route handler", () => {
  it("signed out: get-session answers null", async () => {
    const res = await GET(new Request(`${BASE}/api/auth/get-session`));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("wrong user: sees only their own session, never the owner's", async () => {
    await seedOwner(db);
    const { cookie } = await seedOtherUser(db);
    const res = await GET(new Request(`${BASE}/api/auth/list-sessions`, { headers: { cookie } }));
    const sessions = (await res.json()) as { userId: string }[];
    expect(sessions.map((s) => s.userId)).toEqual(["other"]);
  });

  it("owner: get-session returns the owner", async () => {
    const { cookie } = await seedOwner(db);
    const res = await GET(new Request(`${BASE}/api/auth/get-session`, { headers: { cookie } }));
    expect(((await res.json()) as { user: { id: string } }).user.id).toBe("owner");
  });

  it("refuses sign-in requests from another site", async () => {
    const res = await POST(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example", cookie: "x=1" },
        body: JSON.stringify({ provider: "github", callbackURL: "https://evil.example/steal" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("signInWithGitHub", () => {
  it("goes to GitHub when it is configured", async () => {
    const url = new URL(await redirectOf(signInWithGitHub(form("/scaler"))));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/github`);
    expect(await db.select().from(verification)).toHaveLength(1);
  });

  it("clears expired sign-in attempts before storing a new one, so they cannot pile up", async () => {
    const now = Date.now();
    const row = (id: string, expiresInMs: number) => ({
      id,
      identifier: `made-up-${id}`,
      value: "{}",
      expiresAt: new Date(now + expiresInMs),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    await db.insert(verification).values([row("old-1", -60_000), row("old-2", -1), row("live", 5 * 60_000)]);
    for (let i = 0; i < 3; i += 1) await redirectOf(signInWithGitHub(form("/scaler")));
    const left = await db.select().from(verification);
    expect(left.map((v) => v.id)).toContain("live");
    expect(left.some((v) => v.id.startsWith("old-"))).toBe(false);
    // The three new attempts are still valid (10 minutes), so they stay.
    expect(left).toHaveLength(4);
    // The delete is one query on an indexed column.
    // (The test database is PGlite, whose results carry `rows`.)
    const indexes = (await db.execute(sql`select indexdef from pg_indexes where tablename = 'verification'`)) as unknown as {
      rows: { indexdef: string }[];
    };
    expect(indexes.rows.map((r) => r.indexdef).some((d) => /\(expires_at\)/.test(d))).toBe(true);
  });

  it("explains instead of crashing when GitHub is not configured, keeping a safe next", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    resetAuth();
    expect(await redirectOf(signInWithGitHub(form("/scaler")))).toBe("/login?next=%2Fscaler&error=unavailable");
    expect(await redirectOf(signInWithGitHub(form("https://evil.example")))).toBe("/login?error=unavailable");
    expect(await redirectOf(signInWithGitHub(form()))).toBe("/login?error=unavailable");
  });
});

describe("signOut", () => {
  it("signed out: still lands on the signed-out page", async () => {
    expect(await redirectOf(signOut())).toBe("/login?status=signed-out");
  });

  it("wrong user: ends only their own session", async () => {
    await seedOwner(db);
    request.headers = new Headers({ cookie: (await seedOtherUser(db)).cookie });
    expect(await redirectOf(signOut())).toBe("/login?status=signed-out");
    expect((await db.select().from(session)).map((s) => s.userId)).toEqual(["owner"]);
  });

  it("owner: ends the session", async () => {
    request.headers = new Headers({ cookie: (await seedOwner(db)).cookie });
    expect(await redirectOf(signOut())).toBe("/login?status=signed-out");
    expect(await db.select().from(session)).toEqual([]);
  });
});

describe("refreshSession", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const sessionCookieSets = () => request.cookiesSet.filter((c) => c.name === "better-auth.session_token");
  const expiryOf = async (userId: string) => (await db.select().from(session).where(eq(session.userId, userId)))[0]?.expiresAt;

  it("signed out: does nothing", async () => {
    expect(await refreshSession()).toEqual({ ok: false });
    expect(request.cookiesSet).toEqual([]);
  });

  it("wrong user: does nothing for them, and their session is revoked", async () => {
    await seedOwner(db);
    request.headers = new Headers({ cookie: (await seedOtherUser(db)).cookie });
    expect(await refreshSession()).toEqual({ ok: false });
    expect(sessionCookieSets()).toEqual([]);
    expect((await db.select().from(session)).map((s) => s.userId)).toEqual(["owner"]);
  });

  it("owner, session due: renews it for 30 days in the database and in the cookie", async () => {
    // Seeded sessions expire in one day, so they are due for renewal.
    request.headers = new Headers({ cookie: (await seedOwner(db)).cookie });
    expect(await refreshSession()).toEqual({ ok: true });
    const expires = await expiryOf("owner");
    expect(expires!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    expect(sessionCookieSets()).toHaveLength(1);
    expect(sessionCookieSets()[0].options.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("owner, renewed less than a day ago: changes nothing", async () => {
    request.headers = new Headers({ cookie: (await seedOwner(db)).cookie });
    const fresh = new Date(Date.now() + 30 * DAY);
    await db.update(session).set({ expiresAt: fresh }).where(eq(session.userId, "owner"));
    expect(await refreshSession()).toEqual({ ok: true });
    expect((await expiryOf("owner"))!.getTime()).toBe(fresh.getTime());
    expect(sessionCookieSets()).toEqual([]);
  });
});
