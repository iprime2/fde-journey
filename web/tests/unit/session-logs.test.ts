// A failing session lookup never prints the session token, and a prerender interruption is handed
// back to Next instead of being logged as a failure.
//
// The database is the real Neon HTTP driver (drizzle-orm/neon-http, as in production) with its
// fetch replaced, so no network is used: the same chain as in the production logs is built
// (fetch error → NeonDbError → DrizzleQueryError, whose message quotes the token → Better Auth).
// Every token and address here is made up.
import { inspect } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
const nextHeaders = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/headers", nextHeaders);
vi.mock("next/headers.js", nextHeaders);

import { neonConfig } from "@neondatabase/serverless";
import { makeUntrackedHangingPromise } from "next/dist/server/dynamic-rendering-utils";
import { connection } from "next/server";
import { SheetAccount, SidebarAccount } from "@/components/account/Account";
import { type Db, openDb } from "@/db/client";
import { type Auth, createAuth } from "@/lib/auth";
import { SafeError } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";
import { captureOutput } from "./support/capture-output";
import { resetAuth, setTestEnv, signedCookieValue } from "./support/db";

vi.mock("@/app/actions/auth", () => ({ signOut: async () => {} }));

setTestEnv();

/** A made-up session token, distinctive enough to find in any output. */
const TOKEN = "madeUpTokenZq7Xw3Kp9Lm2Nv5Rt8Yb4Hc";
const COOKIE = `better-auth.session_token=${signedCookieValue(TOKEN)}`;
const FAKE_URL = "postgresql://someone:not-a-password@db.example.invalid/journey";

/** What the fake Neon endpoint does with each query. */
const neonFetch = vi.hoisted(() => ({ fail: (): Promise<never> => Promise.reject(new Error("unset")), calls: 0 }));

/** Next's own error for a fetch cut off when a prerender completes, made by Next's own helper. */
async function prerenderInterruption(): Promise<Error> {
  const controller = new AbortController();
  const pending = makeUntrackedHangingPromise(controller.signal, "/scaler", "fetch()");
  controller.abort();
  return pending.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: Error) => error,
  );
}

let output: string[] = [];

let db: Db;
let auth: Auth;
let originalFetch: unknown;

beforeAll(async () => {
  originalFetch = neonConfig.fetchFunction;
  neonConfig.fetchFunction = () => {
    neonFetch.calls += 1;
    return neonFetch.fail();
  };
  db = await openDb({ kind: "neon", url: FAKE_URL });
  auth = createAuth({ db, env: process.env, writeCookies: false });
});

afterAll(() => {
  neonConfig.fetchFunction = originalFetch;
  resetAuth();
});

beforeEach(() => {
  neonFetch.calls = 0;
  output = captureOutput();
  request.headers = new Headers({ cookie: COOKIE });
  // getIdentity reads through the app's memoised session reader: use the fake Neon one.
  resetAuth();
  (globalThis as { __fdeJourneySessionReader?: Promise<Auth> }).__fdeJourneySessionReader = Promise.resolve(auth);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a failing session lookup (database unreachable)", () => {
  beforeEach(() => {
    neonFetch.fail = () => Promise.reject(new TypeError("fetch failed: connect ECONNREFUSED 192.0.2.10:443"));
  });

  it("keeps the token in the raw error (so the checks below can catch a leak)", async () => {
    const error = await auth.api.getSession({ headers: request.headers }).catch((e: unknown) => e);
    expect(neonFetch.calls).toBeGreaterThan(0);
    expect(inspect(error, { depth: 10 })).toContain(TOKEN);
  });

  it("logs Better Auth's error with names and codes only, never the token or the query", async () => {
    await expect(auth.api.getSession({ headers: request.headers })).rejects.toThrow();
    const all = output.join("\n");
    expect(all).not.toContain(TOKEN);
    expect(all).not.toMatch(/params|select|not-a-password|192\.0\.2\.10/);
    expect(output).toEqual(["error: [Better Auth] error: INTERNAL_SERVER_ERROR DrizzleQueryError < NeonDbError < TypeError"]);
  });

  it("makes getIdentity throw a SafeError that carries nothing from the database error", async () => {
    const error = await getIdentity().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SafeError);
    expect((error as SafeError).message).toBe(
      "Session check failed (APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError < TypeError)",
    );
    expect((error as SafeError).cause).toBeUndefined();
    // As Next would print it if it reached the error boundary.
    expect(inspect(error, { depth: 10 })).not.toContain(TOKEN);
    expect(output.join("\n")).not.toContain(TOKEN);
  });

  it("shows the account menu's plain Sign out and logs the failure without the token", async () => {
    await SidebarAccount();
    await SheetAccount();
    const all = output.join("\n");
    expect(all).toContain("Account menu: session check failed (SafeError(APIError FAILED_TO_GET_SESSION");
    expect(all).not.toContain(TOKEN);
  });
});

describe("a prerender that completes while the session is being read", () => {
  let interruption: Error;
  beforeAll(async () => {
    interruption = await prerenderInterruption();
  });
  beforeEach(() => {
    neonFetch.fail = () => Promise.reject(interruption);
  });

  it("is Next's hanging-promise error", () => {
    expect((interruption as Error & { digest?: string }).digest).toBe("HANGING_PROMISE_REJECTION");
  });

  it("prints nothing from Better Auth", async () => {
    await expect(auth.api.getSession({ headers: request.headers })).rejects.toThrow();
    expect(neonFetch.calls).toBeGreaterThan(0);
    expect(output).toEqual([]);
  });

  it("reaches Next as Next's own error from getIdentity, not as a session failure", async () => {
    await expect(getIdentity()).rejects.toBe(interruption);
    expect(output).toEqual([]);
  });

  it("passes through the account menu without its fallback or a log", async () => {
    await expect(SidebarAccount()).rejects.toBe(interruption);
    await expect(SheetAccount()).rejects.toBe(interruption);
    expect(output).toEqual([]);
  });
});

describe("getIdentity in a prerender", () => {
  it("waits for a real request (connection) before any database work", async () => {
    neonFetch.fail = () => Promise.reject(new Error("must not be called"));
    resetAuth();
    vi.mocked(connection).mockReturnValueOnce(new Promise(() => {}));
    const settled = await Promise.race([
      getIdentity().then(() => "settled", () => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 200)),
    ]);
    expect(settled).toBe("pending");
    expect(connection).toHaveBeenCalled();
    expect(neonFetch.calls).toBe(0);
    // Not even the auth instance was created.
    expect((globalThis as { __fdeJourneySessionReader?: unknown }).__fdeJourneySessionReader).toBeUndefined();
  });

  it("answers signed-out visitors without waiting or touching the database", async () => {
    request.headers = new Headers();
    vi.mocked(connection).mockClear();
    expect(await getIdentity()).toBeNull();
    expect(connection).not.toHaveBeenCalled();
    expect(neonFetch.calls).toBe(0);
  });
});
