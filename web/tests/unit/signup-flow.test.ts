// Capped sign-up (SIGNUP_MODE=capped) through Better Auth's real HTTP handler, with GitHub replaced
// by a fake `fetch` that knows several made-up accounts. New accounts get a place while there is
// one, then join the waitlist; suspended accounts are refused before any session is written; the
// owner always gets in; and a crowd signing up at once never takes the places past the cap.
//
// PGlite is one connection, so the "crowd" below is handled one transaction at a time, never truly
// interleaved: it proves the counting and that each sign-up takes the places lock (asserted), not
// the lock's behaviour under real concurrency (see lib/places.ts and the Neon branch rehearsal).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { account, session, user, userSettings } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { OWNER_ID, TEST_SECRET, emptyDb, recordStatements } from "./support/db";

const BASE = "http://localhost:3000";
const env = {
  BETTER_AUTH_SECRET: TEST_SECRET,
  BETTER_AUTH_URL: BASE,
  OWNER_GITHUB_ID: OWNER_ID,
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  SIGNUP_MODE: "capped",
};

interface Person {
  id: number;
  login: string;
}
/** Made-up GitHub accounts, by OAuth code. */
const people = new Map<string, Person>();

/** Fake GitHub: the code picks the account; its access token picks the profile. */
function fakeGitHub() {
  const realFetch = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://github.com/login/oauth/access_token")) {
      const body = new URLSearchParams(String(init?.body ?? ""));
      return Response.json({ access_token: `token-${body.get("code")}`, token_type: "bearer", scope: "read:user,user:email" });
    }
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    const who = people.get(auth.replace(/^Bearer token-/, ""));
    if (url === "https://api.github.com/user" && who) {
      return Response.json({ id: who.id, login: who.login, name: `Test ${who.login}`, email: `${who.login}@example.com`, avatar_url: "https://avatars.githubusercontent.com/u/0?v=4" });
    }
    if (url === "https://api.github.com/user/emails" && who) return Response.json([{ email: `${who.login}@example.com`, primary: true, verified: true }]);
    if (url.startsWith(BASE)) return realFetch(input, init);
    throw new Error(`unexpected request to ${url}`);
  });
}

const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signIn(auth: ReturnType<typeof createAuth>, who: Person) {
  const code = `code-${who.login}-${Math.random().toString(36).slice(2)}`;
  people.set(code, who);
  const start = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ provider: "github", callbackURL: "/roadmap", errorCallbackURL: "/login?next=%2Froadmap" }),
    }),
  );
  const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state");
  const res = await auth.handler(new Request(`${BASE}/api/auth/callback/github?code=${code}&state=${state}`, { headers: { cookie: cookieHeader(start) } }));
  expect(res.status).toBe(302);
  return { location: new URL(res.headers.get("location") ?? "", BASE), signedIn: res.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token=") && !c.includes("Max-Age=0")) };
}

const OWNER: Person = { id: Number(OWNER_ID), login: "owner-login" };
const person = (i: number): Person => ({ id: 910000000000 + i, login: `person-${i}` });

let db: Db;
let auth: ReturnType<typeof createAuth>;
beforeEach(async () => {
  db = await emptyDb();
  auth = createAuth({ db, env });
  people.clear();
  fakeGitHub();
});
afterEach(() => vi.restoreAllMocks());

const setCap = (cap: number) => db.execute(sql`update "app_setting" set "value" = ${String(cap)} where "key" = 'user_cap'`);
const userByLogin = async (login: string) => (await db.select().from(user).where(eq(user.githubLogin, login)))[0];
const sessionsOf = async (userId: string) => db.select().from(session).where(eq(session.userId, userId));

describe("capped sign-up", () => {
  it("a new account gets a place while there is one, and goes on to the page it wanted", async () => {
    const result = await signIn(auth, person(1));
    expect(result).toMatchObject({ signedIn: true });
    expect(result.location.pathname).toBe("/roadmap");
    const u = await userByLogin("person-1");
    expect(u).toMatchObject({ status: "active", waitlistedAt: null, activatedAt: expect.any(Date), lastActiveAt: expect.any(Date) });
  });

  it("past the cap, a new account joins the waitlist but can still sign in (the app then shows /waitlist)", async () => {
    await setCap(1);
    await signIn(auth, person(1));
    const second = await signIn(auth, person(2));
    expect(second.signedIn).toBe(true);
    expect(await userByLogin("person-2")).toMatchObject({ status: "waitlisted", waitlistedAt: expect.any(Date), activatedAt: null });
    expect(await sessionsOf((await userByLogin("person-2")).id)).toHaveLength(1);
  });

  it("the owner always gets a place, never counts toward the cap, and gets every section with Scaler", async () => {
    await setCap(0);
    expect((await signIn(auth, OWNER)).signedIn).toBe(true);
    const owner = await userByLogin("owner-login");
    expect(owner.status).toBe("active");
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, owner.id));
    expect(settings).toMatchObject({ showScaler: true, showProjects: true, showCareer: true, scalerUnlockedAt: expect.any(Date) });
    await setCap(1);
    await signIn(auth, person(1));
    expect((await userByLogin("person-1")).status).toBe("active");
  });

  it("puts the owner back to active at sign-in, whatever the stored status says", async () => {
    await signIn(auth, OWNER);
    const owner = await userByLogin("owner-login");
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, owner.id));
    expect((await signIn(auth, OWNER)).signedIn).toBe(true);
    expect((await userByLogin("owner-login")).status).toBe("active");
  });

  it("refuses a suspended account with ?error=suspended and writes no session", async () => {
    await signIn(auth, person(1));
    const u = await userByLogin("person-1");
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, u.id));
    await db.delete(session).where(eq(session.userId, u.id));
    const result = await signIn(auth, person(1));
    expect(result.signedIn).toBe(false);
    expect(result.location.pathname).toBe("/login");
    expect(result.location.searchParams.get("error")).toBe("suspended");
    expect(result.location.searchParams.get("next")).toBe("/roadmap");
    expect(await sessionsOf(u.id)).toEqual([]);
  });

  it("will not create a session for a suspended user, whatever asks", async () => {
    await signIn(auth, person(1));
    const u = await userByLogin("person-1");
    await db.update(user).set({ status: "suspended" }).where(eq(user.id, u.id));
    const ctx = await auth.$context;
    expect(await ctx.internalAdapter.createSession(u.id)).toBeNull();
  });

  it("stores the GitHub username at sign-up and refreshes it at every sign-in", async () => {
    await signIn(auth, person(1));
    const { id } = await userByLogin("person-1");
    await signIn(auth, { id: person(1).id, login: "renamed-person" });
    expect((await db.select({ login: user.githubLogin }).from(user).where(eq(user.id, id)))[0].login).toBe("renamed-person");
  });

  it("refuses everyone when OWNER_GITHUB_ID is not set (there would be no super admin)", async () => {
    auth = createAuth({ db, env: { ...env, OWNER_GITHUB_ID: "" } });
    const result = await signIn(auth, person(1));
    expect(result.signedIn).toBe(false);
    expect(result.location.searchParams.get("error")).toBe("not_owner");
    expect(await db.select().from(user)).toEqual([]);
  });

  it("a crowd signing up at the same moment never takes the places past the cap", async () => {
    await setCap(3);
    const statements = recordStatements(db);
    statements.length = 0;
    const crowd = Array.from({ length: 10 }, (_, i) => person(i + 1));
    const results = await Promise.all(crowd.map((p) => signIn(auth, p)));
    expect(results.every((r) => r.signedIn)).toBe(true);
    const statuses = await db.select({ status: user.status }).from(user).orderBy(asc(user.createdAt));
    expect(statuses.filter((s) => s.status === "active")).toHaveLength(3);
    expect(statuses.filter((s) => s.status === "waitlisted")).toHaveLength(7);
    expect(await db.select().from(account)).toHaveLength(10);
    // Each new account took the places lock before counting.
    expect(statements.filter((q) => q === "select pg_advisory_xact_lock(7243100001)")).toHaveLength(10);
  });
});

describe("owner-only mode (the default) is unchanged", () => {
  it("a new account is refused before anything is stored", async () => {
    auth = createAuth({ db, env: { ...env, SIGNUP_MODE: "" } });
    const result = await signIn(auth, person(1));
    expect(result.signedIn).toBe(false);
    expect(result.location.searchParams.get("error")).toBe("not_owner");
    expect(await db.select().from(user)).toEqual([]);
  });

  it("the owner signs in, gets their username and settings stored, and is active", async () => {
    auth = createAuth({ db, env: { ...env, SIGNUP_MODE: undefined } });
    expect((await signIn(auth, OWNER)).signedIn).toBe(true);
    const owner = await userByLogin("owner-login");
    expect(owner).toMatchObject({ status: "active", activatedAt: expect.any(Date) });
    expect(await db.select().from(userSettings)).toHaveLength(1);
  });
});
