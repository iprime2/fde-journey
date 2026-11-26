// GET /auth/continue (app/auth/continue/route.ts): where GitHub sign-in lands. It answers with a
// redirect only, chosen from the session and the user's status: signed out, wrong user (owner-only
// mode), active, waitlisted, suspended, the owner, and unsafe `next` values. Then the whole sign-in
// through Better Auth's real handler, with GitHub replaced by a fake `fetch`. Made-up users only.
import type { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The app's database, swappable per test (Neon over a fake endpoint); the in-memory one otherwise.
const appDb = vi.hoisted(() => ({ override: null as null | (() => Promise<unknown>) }));
vi.mock("@/db/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/db/client")>();
  return { ...real, getDb: () => (appDb.override ? appDb.override() : real.getDb()) };
});

import { GET } from "@/app/auth/continue/route";
import { type Db, openDb } from "@/db/client";
import { session, user } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { continueHref, loginHref } from "@/lib/login";
import { captureOutput } from "./support/capture-output";
import { fakeNeon } from "./support/fake-neon";
import { OTHER_ID, OWNER_ID, emptyDb, resetAuth, seedOwner, seedUser, setTestEnv } from "./support/db";

setTestEnv();

const BASE = "http://localhost:3000";

async function land(next: string | null, cookie?: string) {
  const url = next === null ? `${BASE}/auth/continue` : `${BASE}/auth/continue?next=${encodeURIComponent(next)}`;
  const res = await GET(new NextRequest(url, { headers: cookie ? { cookie } : {} }));
  expect([302, 303, 307]).toContain(res.status);
  expect(res.headers.get("cache-control")).toBe("no-store");
  // A redirect, never a page.
  expect(await res.text()).toBe("");
  const target = new URL(res.headers.get("location") ?? "");
  expect(target.origin).toBe(BASE);
  return `${target.pathname}${target.search}${target.hash}`;
}

let db: Db;
beforeEach(async () => {
  setTestEnv();
  resetAuth();
  db = await emptyDb();
});
afterEach(() => {
  setTestEnv();
  appDb.override = null;
  resetAuth();
  vi.restoreAllMocks();
});

const seed = (userId: string, githubId: string, status: "active" | "waitlisted" | "suspended") =>
  seedUser(db, { githubId, userId, email: `${userId}@example.com`, status });
const sessionsOf = async (userId: string) => db.select().from(session).where(eq(session.userId, userId));

describe("/auth/continue: signed out", () => {
  it("no cookie: the sign-in page, remembering a safe next", async () => {
    expect(await land("/roadmap")).toBe("/login?next=%2Froadmap");
    expect(await land(null)).toBe("/login");
  });

  it("a forged, ended or expired session: the sign-in page", async () => {
    expect(await land("/roadmap", "better-auth.session_token=made-up-token.made-up-signature")).toBe("/login?next=%2Froadmap");
    const { cookie } = await seedOwner(db);
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, "owner"));
    expect(await land("/roadmap", cookie)).toBe("/login?next=%2Froadmap");
    await db.delete(session);
    expect(await land("/", cookie)).toBe("/login");
  });
});

describe("/auth/continue: owner-only mode (SIGNUP_MODE unset)", () => {
  it("the owner goes on to the page they wanted", async () => {
    const { cookie } = await seedOwner(db);
    expect(await land("/scaler?q=rag", cookie)).toBe("/scaler?q=rag");
    expect(await land(null, cookie)).toBe("/");
  });

  it("wrong user: any other account goes to /login and its session is revoked, the owner's kept", async () => {
    await seedOwner(db);
    const { cookie } = await seed("other", OTHER_ID, "active");
    expect(await land("/roadmap", cookie)).toBe("/login?next=%2Froadmap");
    expect(await sessionsOf("other")).toEqual([]);
    expect(await sessionsOf("owner")).toHaveLength(1);
  });
});

describe("/auth/continue: capped mode", () => {
  beforeEach(() => {
    process.env.SIGNUP_MODE = "capped";
  });

  it("active: the page they wanted", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    expect(await land("/roadmap?q=rag#l1-1", cookie)).toBe("/roadmap?q=rag#l1-1");
  });

  it("waitlisted: /waitlist, whatever they asked for, and still signed in", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const next of ["/", "/roadmap", "/admin", "/settings"]) expect(await land(next, cookie), next).toBe("/waitlist");
    expect(await sessionsOf("wren")).toHaveLength(1);
  });

  it("suspended: the sign-in page with the suspended notice, and their sessions end", async () => {
    const { cookie } = await seed("sid", OTHER_ID, "suspended");
    expect(await land("/roadmap", cookie)).toBe("/login?error=suspended");
    expect(await sessionsOf("sid")).toEqual([]);
  });

  it("the owner is never sent to the waitlist, even when their status reads oddly", async () => {
    const { cookie } = await seedOwner(db);
    for (const status of ["waitlisted", "suspended"] as const) {
      await db.update(user).set({ status }).where(eq(user.id, "owner"));
      expect(await land("/admin", cookie), status).toBe("/admin");
    }
  });

  it("wrong user: each cookie lands by its own user's status", async () => {
    const owner = await seedOwner(db);
    const wren = await seed("wren", OTHER_ID, "waitlisted");
    expect(await land("/roadmap", wren.cookie)).toBe("/waitlist");
    expect(await land("/roadmap", owner.cookie)).toBe("/roadmap");
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "javascript:alert(1)",
    "/login?next=/roadmap",
    "/api/auth/sign-out",
    "/auth/continue?next=%2Froadmap",
  ])("an unsafe next (%s) goes Home, never off the site", async (next) => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    expect(await land(next, cookie)).toBe("/");
  });

  it("when the check can't run: the sign-in page's try-again message, keeping next, nothing secret logged", async () => {
    const output = captureOutput();
    const { cookie, token } = await seed("wren", OTHER_ID, "waitlisted");
    delete process.env.BETTER_AUTH_SECRET;
    resetAuth();
    expect(await land("/roadmap", cookie)).toBe("/login?next=%2Froadmap&error=unavailable");
    expect(output.join("\n")).toMatch(/After sign-in: session check failed/);
    expect(output.join("\n")).not.toContain(token);
  });
});

describe("/auth/continue on Neon over HTTP, when the database fails", () => {
  let originalFetch: typeof neonConfig.fetchFunction;
  let failing = false;

  beforeEach(async () => {
    process.env.SIGNUP_MODE = "capped";
    // Neon's driver over the same in-memory data, through a fake endpoint (no network).
    const pg = (db as unknown as { $client: PGlite }).$client;
    const fake = fakeNeon(pg, () => (failing ? Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) : null));
    originalFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = fake.fetchFunction;
    const neonDb = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" });
    appDb.override = async () => neonDb;
    failing = false;
    resetAuth();
  });
  afterEach(() => {
    neonConfig.fetchFunction = originalFetch;
  });

  it("works through Neon's driver (the set-up is real)", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    expect(await land("/roadmap", cookie)).toBe("/waitlist");
  });

  it("unreachable: the sign-in page's try-again message, keeping next; the token is never logged", async () => {
    const output = captureOutput();
    const { cookie, token } = await seed("wren", OTHER_ID, "waitlisted");
    failing = true;
    expect(await land("/roadmap", cookie)).toBe("/login?next=%2Froadmap&error=unavailable");
    const log = output.join("\n");
    expect(log).toMatch(/After sign-in: session check failed \(SafeError/);
    expect(log).not.toContain(token);
    expect(log).not.toMatch(/params|select/i);
  });
});

describe("sign-in with GitHub lands on /auth/continue, which decides by status", () => {
  const people = new Map<string, number>();
  function fakeGitHub() {
    const realFetch = globalThis.fetch;
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://github.com/login/oauth/access_token")) {
        const body = new URLSearchParams(String(init?.body ?? ""));
        return Response.json({ access_token: `token-${body.get("code")}`, token_type: "bearer", scope: "read:user,user:email" });
      }
      const id = people.get((new Headers(init?.headers).get("authorization") ?? "").replace(/^Bearer token-/, ""));
      if (url === "https://api.github.com/user" && id) {
        return Response.json({ id, login: `person-${id}`, name: `Test ${id}`, email: `person-${id}@example.com`, avatar_url: "https://avatars.githubusercontent.com/u/0?v=4" });
      }
      if (url === "https://api.github.com/user/emails" && id) return Response.json([{ email: `person-${id}@example.com`, primary: true, verified: true }]);
      if (url.startsWith(BASE)) return realFetch(input, init);
      throw new Error(`unexpected request to ${url}`);
    });
  }
  const cookieHeader = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

  /** The sign-in action's request (callbackURL = continueHref(next)), GitHub, and Better Auth's callback. */
  async function signIn(githubId: number, next: string) {
    const auth = createAuth({ db, env: { ...process.env, GITHUB_CLIENT_ID: "test-client-id", GITHUB_CLIENT_SECRET: "test-client-secret" } });
    const code = `code-${githubId}-${Math.random().toString(36).slice(2)}`;
    people.set(code, githubId);
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ provider: "github", callbackURL: continueHref(next), errorCallbackURL: loginHref(next) }),
      }),
    );
    const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state");
    const callback = await auth.handler(new Request(`${BASE}/api/auth/callback/github?code=${code}&state=${state}`, { headers: { cookie: cookieHeader(start) } }));
    expect(callback.status).toBe(302);
    return { location: new URL(callback.headers.get("location") ?? "", BASE), cookie: cookieHeader(callback) };
  }

  beforeEach(() => {
    process.env.SIGNUP_MODE = "capped";
    people.clear();
    fakeGitHub();
  });

  it("past the cap (0): Better Auth returns to /auth/continue, which sends the new user to /waitlist", async () => {
    await db.execute(sql`update "app_setting" set "value" = '0' where "key" = 'user_cap'`);
    const { location, cookie } = await signIn(910000000001, "/roadmap");
    expect(`${location.pathname}${location.search}`).toBe("/auth/continue?next=%2Froadmap");
    expect(await land(location.searchParams.get("next"), cookie)).toBe("/waitlist");
  });

  it("with a free place: on to the page they wanted", async () => {
    const { location, cookie } = await signIn(910000000002, "/roadmap");
    expect(await land(location.searchParams.get("next"), cookie)).toBe("/roadmap");
  });

  it("the owner, with the cap at 0: on to the page they wanted", async () => {
    await db.execute(sql`update "app_setting" set "value" = '0' where "key" = 'user_cap'`);
    const { location, cookie } = await signIn(Number(OWNER_ID), "/admin");
    expect(await land(location.searchParams.get("next"), cookie)).toBe("/admin");
  });
});
