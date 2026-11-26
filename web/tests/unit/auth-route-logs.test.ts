// The auth route (/api/auth/*) when the database fails mid-sign-in: nothing it prints holds the
// failed query's parameters (the new session token, user id, IP address, browser), and the
// browser still lands on the sign-in page.
//
// The database is the real Neon HTTP driver (as in production) talking to a fake Neon endpoint
// backed by an in-memory PGlite (support/fake-neon.ts): the GitHub sign-in runs for real until
// the chosen query fails like a network blip. GitHub is a fake `fetch`. All values are made up.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { type Db, openDb } from "@/db/client";
import { account, session, user } from "@/db/schema";
import { type Auth, createAuth } from "@/lib/auth";
import { loginMessage, parseLoginParams } from "@/lib/login";
import { captureOutput } from "./support/capture-output";
import { type NeonRequest, fakeNeon } from "./support/fake-neon";
import { OWNER_ID, TEST_SECRET, signedCookieValue } from "./support/db";

const BASE = "http://localhost:3000";
const env = {
  BETTER_AUTH_SECRET: TEST_SECRET,
  BETTER_AUTH_URL: BASE,
  OWNER_GITHUB_ID: OWNER_ID,
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
};
const IP = "198.51.100.23";
const BROWSER = "MadeUpBrowser/9.9 (repro)";

/** Which query fails next (null: none). */
let failing: RegExp | null = null;
let pg: PGlite;
let neonDb: Db;
let auth: Auth;
let requests: NeonRequest[];
let originalFetchFunction: unknown;
let output: string[];

const blip = () => new TypeError("fetch failed: connect ETIMEDOUT 192.0.2.44:443");

beforeAll(async () => {
  const local = await openDb({ kind: "pglite", dataDir: null });
  pg = (local as unknown as { $client: PGlite }).$client;
  const fake = fakeNeon(pg, (query) => (failing?.test(query) ? blip() : null));
  requests = fake.requests;
  originalFetchFunction = neonConfig.fetchFunction;
  neonConfig.fetchFunction = fake.fetchFunction;
  neonDb = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" });
  auth = createAuth({ db: neonDb, env });
});

afterAll(() => {
  neonConfig.fetchFunction = originalFetchFunction;
  delete (globalThis as { __fdeJourneyAuth?: unknown }).__fdeJourneyAuth;
});

beforeEach(async () => {
  failing = null;
  requests.length = 0;
  await neonDb.delete(session);
  await neonDb.delete(account);
  await neonDb.delete(user);
  // The route reads the app's memoised auth instance: use the fake-Neon one.
  (globalThis as { __fdeJourneyAuth?: Promise<Auth> }).__fdeJourneyAuth = Promise.resolve(auth);
  fakeGitHub(Number(OWNER_ID), "owner-login");
  output = captureOutput();
});

afterEach(() => vi.restoreAllMocks());

/** Fake GitHub: token exchange, profile and emails for one made-up account. */
function fakeGitHub(githubId: number, login: string) {
  const email = `${login}@example.com`;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://github.com/login/oauth/access_token")) {
      return Response.json({ access_token: "fake-access-token", token_type: "bearer", scope: "read:user,user:email" });
    }
    if (url === "https://api.github.com/user") return Response.json({ id: githubId, login, name: "Test Person", email });
    if (url === "https://api.github.com/user/emails") return Response.json([{ email, primary: true, verified: true }]);
    throw new Error(`unexpected request to ${url}`);
  });
}

const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

const browserHeaders = { "x-forwarded-for": IP, "user-agent": BROWSER };

/** Starts a GitHub sign-in through the route; returns the callback request GitHub would send. */
async function startSignIn(): Promise<Request> {
  const start = await POST(
    new Request(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, ...browserHeaders },
      body: JSON.stringify({ provider: "github", callbackURL: "/roadmap", errorCallbackURL: "/login?next=%2Froadmap" }),
    }),
  );
  expect(start.status).toBe(200);
  const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state");
  return new Request(`${BASE}/api/auth/callback/github?code=fake-code&state=${state}`, {
    headers: { cookie: cookieHeader(start), ...browserHeaders },
  });
}

/** The values the failed queries carried that must never be printed (tokens, ids, IP, browser). */
function secretsOfFailedQueries(): string[] {
  const failed = requests.filter((r) => r.failed);
  expect(failed.length).toBeGreaterThan(0);
  return failed.flatMap((r) => r.params).filter((p): p is string => typeof p === "string" && p.length >= 8);
}

function expectNothingLeaked(secrets: string[]) {
  const all = output.join("\n");
  for (const secret of [...secrets, IP, BROWSER, "not-a-password", "192.0.2.44"]) expect(all).not.toContain(secret);
  expect(all).not.toMatch(/SERVER_ERROR:|params|insert into|select /i);
}

describe("the fake Neon endpoint", () => {
  it("runs a whole GitHub sign-in when nothing fails (so failures below are the chosen ones)", async () => {
    const res = await GET(await startSignIn());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/roadmap");
    expect(cookieHeader(res)).toContain("better-auth.session_token=");
    expect(output).toEqual([]);
  });
});

describe("a database failure while GitHub's callback creates the session", () => {
  beforeEach(() => {
    failing = /^insert into "session"/;
  });

  it("sends the browser to /login, which says sign-in didn't finish, and prints no query values", async () => {
    const res = await GET(await startSignIn());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?error=server_error");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("");
    const { notice } = parseLoginParams({ error: "server_error" });
    expect(loginMessage(notice, "owner-only")?.text).toBe("Sign-in didn't finish. Try again.");

    const secrets = secretsOfFailedQueries();
    // The session row carried the new token, the user id, the IP address and the browser.
    expect(secrets).toEqual(expect.arrayContaining([IP, BROWSER]));
    expectNothingLeaked(secrets);
    expect(output).toEqual([expect.stringMatching(/^error: Auth route failed \(\w+ < NeonDbError < TypeError\)$/)]);
  });

  it("is thrown out of auth.handler instead of being printed by Better Auth's router", async () => {
    const request = await startSignIn();
    await expect(auth.handler(request)).rejects.toThrow();
    expectNothingLeaked(secretsOfFailedQueries());
    expect(output).toEqual([]);
  });
});

describe("other failures", () => {
  it("answers a failed request elsewhere with an empty 500", async () => {
    const raw = Object.assign(new Error(`Failed query: select 1\nparams: secret-${IP}`), { params: [IP] });
    (globalThis as { __fdeJourneyAuth?: Promise<unknown> }).__fdeJourneyAuth = Promise.resolve({
      handler: async () => {
        throw raw;
      },
    });
    const res = await POST(new Request(`${BASE}/api/auth/sign-out`, { method: "POST", headers: { origin: BASE } }));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("");
    expect(output).toEqual(["error: Auth route failed (Error)"]);
    expectNothingLeaked([]);
  });

  it("answers an empty 500 when starting sign-in fails, printing no query values", async () => {
    // Storing the OAuth state fails with the database's own error, not an APIError.
    failing = /^insert into "verification"/;
    const res = await POST(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, ...browserHeaders },
        body: JSON.stringify({ provider: "github", callbackURL: "/roadmap" }),
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("");
    expectNothingLeaked(secretsOfFailedQueries());
    expect(output).toEqual(["error: Auth route failed (DrizzleQueryError < NeonDbError < TypeError)"]);
  });

  it("keeps Better Auth's own error answers (APIError) as they were", async () => {
    // The session lookup fails: Better Auth logs it (safely) and answers 500 with its JSON error.
    failing = /^select .* from "session"/;
    const token = "madeUpRouteTokenQ1w2E3r4T5y6U7i8";
    const res = await GET(
      new Request(`${BASE}/api/auth/get-session`, {
        headers: { cookie: `better-auth.session_token=${signedCookieValue(token)}`, ...browserHeaders },
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "FAILED_TO_GET_SESSION" });
    expectNothingLeaked([token, ...secretsOfFailedQueries()]);
    expect(output).toEqual(["error: [Better Auth] error: INTERNAL_SERVER_ERROR DrizzleQueryError < NeonDbError < TypeError"]);
  });

  it("keeps Better Auth's redirects: another GitHub account goes back to /login with not_owner", async () => {
    vi.mocked(globalThis.fetch).mockRestore();
    fakeGitHub(900000000777, "someone-else");
    const res = await GET(await startSignIn());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/login\?next=%2Froadmap&error=not_owner/);
  });
});
