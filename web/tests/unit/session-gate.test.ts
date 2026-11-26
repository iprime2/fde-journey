// The proxy's status check (lib/session-gate.ts): the cookie signature and secret, the one query,
// the time limit and the one retry, and both database drivers the proxy can run with (PGlite
// locally and in e2e; Neon over HTTP in production, here through a fake endpoint, no network).
// Made-up users only.
import type { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type Db, openDb } from "@/db/client";
import { user } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { SafeError } from "@/lib/safe-log";
import { checkSessionCookie, isNetworkError, sessionCookieSecret, verifiedSessionToken } from "@/lib/session-gate";
import { captureOutput } from "./support/capture-output";
import { OTHER_ID, OWNER_ID, TEST_SECRET, emptyDb, seedUser, setTestEnv, signedCookieValue } from "./support/db";
import { type NeonRequest, fakeNeon } from "./support/fake-neon";

const env = { BETTER_AUTH_SECRET: TEST_SECRET, OWNER_GITHUB_ID: OWNER_ID, SIGNUP_MODE: "capped" };
/** getSessionCookie hands the proxy the decoded value. */
const cookieValue = (token: string, secret = TEST_SECRET) => decodeURIComponent(signedCookieValue(token, secret));

describe("verifiedSessionToken", () => {
  const token = "made-up-session-token-0123456789ab";

  it("returns the token for Better Auth's signature with the app's secret", () => {
    expect(verifiedSessionToken(cookieValue(token), TEST_SECRET)).toBe(token);
  });

  it("refuses another secret, a changed token, a cut signature and values without one", () => {
    expect(verifiedSessionToken(cookieValue(token, "another-made-up-secret"), TEST_SECRET)).toBeNull();
    const [, signature] = cookieValue(token).split(/\.(?=[^.]*$)/);
    expect(verifiedSessionToken(`${token}x.${signature}`, TEST_SECRET)).toBeNull();
    expect(verifiedSessionToken(`${token}.${signature.slice(1)}`, TEST_SECRET)).toBeNull();
    for (const bad of ["", ".", token, `.${signature}`, `${token}.`, `${token}.${"A".repeat(43)}=`]) {
      expect(verifiedSessionToken(bad, TEST_SECRET), bad).toBeNull();
    }
  });
});

describe("sessionCookieSecret", () => {
  it("BETTER_AUTH_SECRET, or the current (first) entry of BETTER_AUTH_SECRETS when set", () => {
    expect(sessionCookieSecret({ BETTER_AUTH_SECRET: " a-secret " })).toBe("a-secret");
    expect(sessionCookieSecret({ BETTER_AUTH_SECRET: "a-secret", BETTER_AUTH_SECRETS: " 3:new-one , 2:old-one" })).toBe("new-one");
    expect(sessionCookieSecret({ BETTER_AUTH_SECRETS: "0:only:with:colons" })).toBe("only:with:colons");
    expect(sessionCookieSecret({})).toBeNull();
    expect(sessionCookieSecret({ BETTER_AUTH_SECRET: "  " })).toBeNull();
  });

  it("throws on a malformed list, as Better Auth does", () => {
    for (const bad of ["new-one", "v2:new-one", "-1:new-one", "2:", " ", ",2:new-one"]) {
      expect(() => sessionCookieSecret({ BETTER_AUTH_SECRETS: bad }), bad).toThrow("BETTER_AUTH_SECRETS is malformed.");
    }
  });
});

describe("the proxy and Better Auth agree on which cookies name a live session", () => {
  const CURRENT = "made-up-current-secret-0123456789abcdef";
  const OLDER = "made-up-older-secret-0123456789abcdefgh";
  afterEach(() => setTestEnv());

  it.each([
    ["one secret", undefined],
    ["rotated secrets", `2:${CURRENT},1:${OLDER}`],
  ])("%s", async (_label, rotation) => {
    setTestEnv();
    if (rotation) process.env.BETTER_AUTH_SECRETS = rotation;
    const db = await emptyDb();
    const { token } = await seedUser(db, { githubId: OTHER_ID, userId: "riley", email: "riley@example.com" });
    const auth = createAuth({ db, env: process.env, writeCookies: false });
    for (const secret of [TEST_SECRET, CURRENT, OLDER]) {
      const value = cookieValue(token, secret);
      const betterAuth = await auth.api.getSession({ headers: new Headers({ cookie: `better-auth.session_token=${encodeURIComponent(value)}` }), query: { disableRefresh: true } });
      const proxy = await checkSessionCookie(value, { env: { ...process.env, SIGNUP_MODE: "capped" }, db: async () => db });
      expect(proxy.standing === "active", `${rotation ?? "single"} / ${secret}`).toBe(betterAuth !== null);
    }
  });
});

describe("isNetworkError", () => {
  it("dropped connections and timeouts count; a database's own errors don't", () => {
    const wrapped = (inner: unknown) => Object.assign(new Error("Failed query"), { cause: inner });
    for (const e of [
      new TypeError("fetch failed"),
      Object.assign(new Error("x"), { code: "ECONNRESET" }),
      Object.assign(new Error("x"), { name: "AbortError" }),
      Object.assign(new Error("x"), { name: "TimeoutError" }),
      wrapped(Object.assign(new Error("Error connecting to database: x"), { name: "NeonDbError", sourceError: new TypeError("fetch failed") })),
    ]) {
      expect(isNetworkError(e)).toBe(true);
    }
    for (const e of [new Error("x"), Object.assign(new Error("x"), { code: "42P01" }), wrapped(Object.assign(new Error("x"), { name: "NeonDbError", code: "23505" })), null, "text"]) {
      expect(isNetworkError(e)).toBe(false);
    }
  });
});

describe("checkSessionCookie on Neon over HTTP (production's driver)", () => {
  let pg: PGlite;
  let local: Db;
  let neonDb: Db;
  let requests: NeonRequest[];
  /** How the next requests to the fake Neon fail: a list, one entry per request; empty = all work. */
  let plan: ("drop" | "hang" | "ok")[] = [];
  let realFetch: (url: string, init: { body: string; signal?: AbortSignal }) => Promise<Response>;
  let originalFetch: typeof neonConfig.fetchFunction;

  beforeAll(async () => {
    local = await openDb({ kind: "pglite", dataDir: null });
    pg = (local as unknown as { $client: PGlite }).$client;
    const fake = fakeNeon(pg);
    requests = fake.requests;
    realFetch = fake.fetchFunction as typeof realFetch;
    originalFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async (url: string, init: { body: string; signal?: AbortSignal }) => {
      const step = plan.shift() ?? "ok";
      if (step === "drop") throw new TypeError("fetch failed");
      if (step === "hang") {
        requests.push({ query: "(hung)", params: [], failed: true });
        // Waits until the request is aborted, like a real fetch would.
        return new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
      }
      return realFetch(url, init);
    };
    neonDb = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" });
  });
  afterAll(async () => {
    neonConfig.fetchFunction = originalFetch;
    await pg.close();
  });
  beforeEach(() => {
    plan = [];
    requests.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  let n = 0;
  const seed = async (status: "active" | "waitlisted" | "suspended", githubId = String(910000000000 + ++n)) => {
    const userId = `gate-${++n}`;
    const seeded = await seedUser(local, { githubId, userId, email: `${userId}@example.com`, status });
    requests.length = 0;
    return { ...seeded, userId, value: cookieValue(seeded.token) };
  };
  const check = (value: string | null, overrides: Record<string, string | undefined> = {}, options: { db?: () => Promise<Db>; timeoutMs?: number } = {}) =>
    checkSessionCookie(value, { env: { ...env, ...overrides }, db: async () => neonDb, ...options });

  it("reads each status in one HTTPS request", async () => {
    for (const status of ["active", "waitlisted", "suspended"] as const) {
      const { value } = await seed(status);
      expect(await check(value)).toEqual({ standing: status, clearCookie: false });
      expect(requests).toHaveLength(1);
    }
  });

  it("the owner is active whatever the status reads; owner-only mode refuses everyone else (cookie kept)", async () => {
    const owner = await seed("waitlisted", OWNER_ID);
    expect((await check(owner.value)).standing).toBe("active");
    await local.update(user).set({ status: "suspended" }).where(eq(user.id, owner.userId));
    expect((await check(owner.value)).standing).toBe("active");
    expect((await check(owner.value, { SIGNUP_MODE: undefined })).standing).toBe("active");
    const other = await seed("active", OTHER_ID);
    expect(await check(other.value, { SIGNUP_MODE: undefined })).toEqual({ standing: "signed-out", clearCookie: false });
  });

  it("no query without a cookie, with a forged one, or without OWNER_GITHUB_ID; a forged one is to be cleared", async () => {
    const { value } = await seed("active");
    expect(await check(null)).toEqual({ standing: "signed-out", clearCookie: false });
    expect(await check("made-up.value")).toEqual({ standing: "signed-out", clearCookie: true });
    expect(await check(cookieValue("made-up-token-0123456789abcdef", "another-made-up-secret"))).toEqual({ standing: "signed-out", clearCookie: true });
    expect(await check(value, { OWNER_GITHUB_ID: undefined })).toEqual({ standing: "signed-out", clearCookie: false });
    expect(requests).toEqual([]);
  });

  it("an ended session is to be cleared", async () => {
    const { value, userId } = await seed("active");
    await local.delete(user).where(eq(user.id, userId));
    expect(await check(value)).toEqual({ standing: "signed-out", clearCookie: true });
  });

  it("refuses to guess without the auth secret", async () => {
    const { value } = await seed("active");
    await expect(check(value, { BETTER_AUTH_SECRET: undefined })).rejects.toThrow("BETTER_AUTH_SECRET is not set.");
  });

  it("tries once more after a dropped connection", async () => {
    const { value } = await seed("waitlisted");
    plan = ["drop"];
    expect((await check(value)).standing).toBe("waitlisted");
    expect(requests).toHaveLength(1); // the dropped one never reached the endpoint
    expect(plan).toEqual([]);
  });

  it("each request has its own time limit: a hung one is aborted and the retry answers", async () => {
    const { value } = await seed("waitlisted");
    const timed = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" }, { timeoutMs: 50 });
    plan = ["hang"];
    const started = Date.now();
    expect((await check(value, {}, { db: async () => timed, timeoutMs: 5000 })).standing).toBe("waitlisted");
    expect(Date.now() - started).toBeLessThan(2000);
    expect(requests.map((r) => r.query)[0]).toBe("(hung)");
    expect(requests).toHaveLength(2);
  });

  it("the client for pages has no time limit (only the proxy's does)", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const previous = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async (url: string, init: { body: string; signal?: AbortSignal }) => {
      seen.push(init.signal);
      return realFetch(url, init);
    };
    try {
      const timed = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" }, { timeoutMs: 5000 });
      await neonDb.select({ id: user.id }).from(user).limit(1);
      await timed.select({ id: user.id }).from(user).limit(1);
      await timed.select({ id: user.id }).from(user).limit(1);
    } finally {
      neonConfig.fetchFunction = previous;
    }
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toBeInstanceOf(AbortSignal);
    // A fresh timer for every request, not one shared signal that expires for good.
    expect(seen[2]).toBeInstanceOf(AbortSignal);
    expect(seen[2]).not.toBe(seen[1]);
  });

  it("the time limit holds on any driver (PGlite has no network to abort)", async () => {
    const { value } = await seed("active");
    const slow = { select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => new Promise(() => {}) }) }) }) }) } as unknown as Db;
    const error = await check(value, {}, { db: async () => slow, timeoutMs: 20 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SafeError);
    expect((error as SafeError).detail).toMatch(/GateTimeoutError/);
  });

  it("after two failures: a SafeError with no session token or query text, and nothing printed", async () => {
    const output = captureOutput();
    const { value, token } = await seed("waitlisted");
    // The fake endpoint answers, but fails as a dropped connection would; twice.
    const previous = neonConfig.fetchFunction;
    neonConfig.fetchFunction = async (_url: string, init: { body: string }) => {
      requests.push({ ...(JSON.parse(init.body) as { query: string; params: unknown[] }), failed: true });
      throw Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    };
    let error: unknown;
    try {
      error = await check(value).then(
        () => null,
        (e: unknown) => e,
      );
    } finally {
      neonConfig.fetchFunction = previous;
    }
    expect(error).toBeInstanceOf(SafeError);
    const message = String((error as Error).message);
    expect(message).toMatch(/^Session status check failed \(/);
    expect(message).not.toContain(token);
    expect(message).not.toContain('"session"');
    expect(JSON.stringify(error)).not.toContain(token);
    expect(String((error as Error).stack)).not.toContain(token);
    expect((error as Error).cause).toBeUndefined();
    // Tried twice, and the token really was in the failed requests: the redaction matters.
    expect(requests).toHaveLength(2);
    expect(requests.at(-1)?.params).toContain(token);
    expect(output).toEqual([]);
  });
});
