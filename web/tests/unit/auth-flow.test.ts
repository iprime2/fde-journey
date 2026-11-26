// The whole GitHub sign-in flow through Better Auth's HTTP handler, with GitHub replaced by a fake
// `fetch`. Proves that another GitHub account never gets a user, account or session row.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { count } from "drizzle-orm";
import type { Db } from "@/db/client";
import { account, session, user } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { OTHER_ID, OWNER_ID, TEST_SECRET, emptyDb } from "./support/db";

const BASE = "http://localhost:3000";
const env = {
  BETTER_AUTH_SECRET: TEST_SECRET,
  BETTER_AUTH_URL: BASE,
  OWNER_GITHUB_ID: OWNER_ID,
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
};

/** Fake GitHub: token exchange, profile and emails for one made-up account. */
function fakeGitHub(githubId: number, login: string, email = `${login}@example.com`) {
  const realFetch = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://github.com/login/oauth/access_token")) {
      return Response.json({ access_token: "fake-access-token", token_type: "bearer", scope: "read:user,user:email" });
    }
    if (url === "https://api.github.com/user") {
      return Response.json({ id: githubId, login, name: "Test Person", email, avatar_url: "https://example.com/a.png" });
    }
    if (url === "https://api.github.com/user/emails") {
      return Response.json([{ email, primary: true, verified: true }]);
    }
    if (url.startsWith(BASE)) return realFetch(input, init);
    throw new Error(`unexpected request to ${url}`);
  });
}

/** Cookies from Set-Cookie headers, as a Cookie header value. */
const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signInWithGitHub(auth: ReturnType<typeof createAuth>) {
  const start = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ provider: "github", callbackURL: "/roadmap", errorCallbackURL: "/login?next=%2Froadmap" }),
    }),
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();
  return auth.handler(
    new Request(`${BASE}/api/auth/callback/github?code=fake-code&state=${state}`, { headers: { cookie: cookieHeader(start) } }),
  );
}

async function rowCounts(db: Db) {
  const [[u], [a], [s]] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(account),
    db.select({ n: count() }).from(session),
  ]);
  return { users: u.n, accounts: a.n, sessions: s.n };
}

let db: Db;
let auth: ReturnType<typeof createAuth>;
beforeEach(async () => {
  db = await emptyDb();
  auth = createAuth({ db, env });
});
afterEach(() => vi.restoreAllMocks());

describe("GitHub sign-in", () => {
  it("refuses another GitHub account and stores nothing for it", async () => {
    fakeGitHub(Number(OTHER_ID), "someone-else");
    const res = await signInWithGitHub(auth);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location") ?? "", BASE);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("not_owner");
    expect(location.searchParams.get("next")).toBe("/roadmap");
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token=") && !c.includes("Max-Age=0"))).toBe(false);
    expect(await rowCounts(db)).toEqual({ users: 0, accounts: 0, sessions: 0 });
  });

  it("signs the owner in, then sends them back to the page they wanted", async () => {
    fakeGitHub(Number(OWNER_ID), "owner-login");
    const res = await signInWithGitHub(auth);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/roadmap");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token="))).toBe(true);
    expect(await rowCounts(db)).toEqual({ users: 1, accounts: 1, sessions: 1 });
    const [linked] = await db.select().from(account);
    expect(linked).toMatchObject({ providerId: "github", accountId: OWNER_ID });
    // OAuth tokens are stored encrypted, not as GitHub sent them.
    expect(linked.accessToken).not.toBe("fake-access-token");

    const me = await auth.handler(new Request(`${BASE}/api/auth/get-session`, { headers: { cookie: cookieHeader(res) } }));
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe("owner-login@example.com");
  });

  it("keeps refusing other accounts after the owner exists, even one using the owner's old login", async () => {
    fakeGitHub(Number(OWNER_ID), "owner-login");
    await signInWithGitHub(auth);
    vi.restoreAllMocks();
    fakeGitHub(Number(OTHER_ID), "owner-login", "new-person@example.com");
    const res = await signInWithGitHub(auth);
    expect(new URL(res.headers.get("location") ?? "", BASE).searchParams.get("error")).toBe("not_owner");
    expect(await rowCounts(db)).toEqual({ users: 1, accounts: 1, sessions: 1 });
  });

  it("refuses another account that reports the owner's email address", async () => {
    fakeGitHub(Number(OWNER_ID), "owner-login");
    await signInWithGitHub(auth);
    vi.restoreAllMocks();
    fakeGitHub(Number(OTHER_ID), "someone-else", "owner-login@example.com");
    const res = await signInWithGitHub(auth);
    const location = new URL(res.headers.get("location") ?? "", BASE);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBeTruthy();
    expect(await rowCounts(db)).toEqual({ users: 1, accounts: 1, sessions: 1 });
  });

  it("refuses everyone when OWNER_GITHUB_ID is not set", async () => {
    auth = createAuth({ db, env: { ...env, OWNER_GITHUB_ID: "" } });
    fakeGitHub(Number(OWNER_ID), "owner-login");
    const res = await signInWithGitHub(auth);
    expect(new URL(res.headers.get("location") ?? "", BASE).searchParams.get("error")).toBe("not_owner");
    expect(await rowCounts(db)).toEqual({ users: 0, accounts: 0, sessions: 0 });
  });

  it("will not create a session for a user without the owner's GitHub account, whatever asks", async () => {
    await db.insert(user).values({ id: "u1", name: "Someone", email: "someone@example.com", createdAt: new Date(), updatedAt: new Date() });
    const ctx = await auth.$context;
    expect(await ctx.internalAdapter.createSession("u1")).toBeNull();
    expect((await rowCounts(db)).sessions).toBe(0);
  });
});

describe("sign-in errors land on /login, never on Better Auth's error page", () => {
  const locationOf = (res: Response) => {
    expect(res.status).toBe(302);
    return res.headers.get("location");
  };

  it("an unknown or forged state", async () => {
    const res = await auth.handler(new Request(`${BASE}/api/auth/callback/github?code=fake-code&state=made-up-state`));
    expect(locationOf(res)).toBe("/login?error=state_mismatch");
  });

  it("a callback without a state", async () => {
    const res = await auth.handler(new Request(`${BASE}/api/auth/callback/github?code=fake-code`));
    expect(locationOf(res)).toBe("/login?error=state_not_found");
  });

  it("an expired state returns to the flow's own sign-in address, keeping next", async () => {
    fakeGitHub(Number(OWNER_ID), "owner-login");
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ provider: "github", callbackURL: "/roadmap", errorCallbackURL: "/login?next=%2Froadmap" }),
      }),
    );
    const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state");
    // The state is valid for 10 minutes; come back after 11.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 11 * 60 * 1000 });
    try {
      const res = await auth.handler(
        new Request(`${BASE}/api/auth/callback/github?code=fake-code&state=${state}`, { headers: { cookie: cookieHeader(start) } }),
      );
      const location = new URL(locationOf(res) ?? "", BASE);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe("/roadmap");
      expect(location.searchParams.get("error")).toBe("state_mismatch");
    } finally {
      vi.useRealTimers();
    }
    expect((await rowCounts(db)).sessions).toBe(0);
  });

  it("Better Auth's error page forwards to /login with the code", async () => {
    const res = await auth.handler(new Request(`${BASE}/api/auth/error?error=access_denied`));
    expect(locationOf(res)).toBe("/login?error=access_denied");
  });
});

describe("unused endpoints", () => {
  it.each(["/update-user", "/link-social", "/sign-up/email", "/sign-in/email", "/delete-user", "/get-access-token"])("%s answers 404", async (path) => {
    const res = await auth.handler(
      new Request(`${BASE}/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: "{}" }),
    );
    expect(res.status).toBe(404);
  });

  it("requires a secret", () => {
    expect(() => createAuth({ db, env: { ...env, BETTER_AUTH_SECRET: "" } })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
