// The proxy's status check (lib/session-gate.ts): the cookie signature, the one query, and both
// database drivers the proxy can run with (PGlite locally and in e2e; Neon over HTTP in
// production, here through a fake endpoint, no network). Made-up users only.
import type { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type Db, openDb } from "@/db/client";
import { user } from "@/db/schema";
import { SafeError } from "@/lib/safe-log";
import { standingFromCookie, verifiedSessionToken } from "@/lib/session-gate";
import { captureOutput } from "./support/capture-output";
import { OTHER_ID, OWNER_ID, TEST_SECRET, seedUser, signedCookieValue } from "./support/db";
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

describe("standingFromCookie on Neon over HTTP (production's driver)", () => {
  let pg: PGlite;
  let local: Db;
  let neonDb: Db;
  let requests: NeonRequest[];
  let failing = false;
  let originalFetch: typeof neonConfig.fetchFunction;

  beforeAll(async () => {
    local = await openDb({ kind: "pglite", dataDir: null });
    pg = (local as unknown as { $client: PGlite }).$client;
    const fake = fakeNeon(pg, (query) => (failing && query.includes('"session"') ? new Error(`connection reset while running ${query}`) : null));
    requests = fake.requests;
    originalFetch = neonConfig.fetchFunction;
    neonConfig.fetchFunction = fake.fetchFunction;
    neonDb = await openDb({ kind: "neon", url: "postgresql://someone:not-a-password@db.example.invalid/journey" });
  });
  afterAll(async () => {
    neonConfig.fetchFunction = originalFetch;
    await pg.close();
  });
  beforeEach(() => {
    failing = false;
  });
  afterEach(() => vi.restoreAllMocks());

  let n = 0;
  const seed = async (status: "active" | "waitlisted" | "suspended", githubId = String(910000000000 + ++n)) => {
    const userId = `gate-${++n}`;
    const seeded = await seedUser(local, { githubId, userId, email: `${userId}@example.com`, status });
    return { ...seeded, userId, value: cookieValue(seeded.token) };
  };
  const standing = (value: string | null, overrides: Record<string, string | undefined> = {}) => standingFromCookie(value, { ...env, ...overrides }, async () => neonDb);

  it("reads each status in one HTTPS request", async () => {
    for (const status of ["active", "waitlisted", "suspended"] as const) {
      const { value } = await seed(status);
      requests.length = 0;
      expect(await standing(value)).toBe(status);
      expect(requests).toHaveLength(1);
    }
  });

  it("the owner is active whatever the status reads; owner-only mode refuses everyone else", async () => {
    const owner = await seed("waitlisted", OWNER_ID);
    expect(await standing(owner.value)).toBe("active");
    await local.update(user).set({ status: "suspended" }).where(eq(user.id, owner.userId));
    expect(await standing(owner.value)).toBe("active");
    expect(await standing(owner.value, { SIGNUP_MODE: undefined })).toBe("active");
    const other = await seed("active", OTHER_ID);
    expect(await standing(other.value, { SIGNUP_MODE: undefined })).toBe("signed-out");
  });

  it("no query at all without a cookie, with a forged one, or without OWNER_GITHUB_ID", async () => {
    const { value } = await seed("active");
    requests.length = 0;
    expect(await standing(null)).toBe("signed-out");
    expect(await standing("made-up.value")).toBe("signed-out");
    expect(await standing(cookieValue("made-up-token-0123456789abcdef", "another-made-up-secret"))).toBe("signed-out");
    expect(await standing(value, { OWNER_GITHUB_ID: undefined })).toBe("signed-out");
    expect(requests).toEqual([]);
  });

  it("refuses to guess without the auth secret", async () => {
    const { value } = await seed("active");
    await expect(standing(value, { BETTER_AUTH_SECRET: undefined })).rejects.toThrow("BETTER_AUTH_SECRET is not set.");
  });

  it("a failed query becomes a SafeError: no session token, no query text, nothing printed", async () => {
    const output = captureOutput();
    const { value, token } = await seed("waitlisted");
    failing = true;
    const error = await standing(value).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SafeError);
    const message = String((error as Error).message);
    expect(message).toMatch(/^Session status check failed \(/);
    expect(message).not.toContain(token);
    expect(message).not.toContain('"session"');
    expect(JSON.stringify(error)).not.toContain(token);
    expect(String((error as Error).stack)).not.toContain(token);
    expect((error as Error).cause).toBeUndefined();
    // The token was really in the failed request: the redaction matters.
    expect(requests.at(-1)?.params).toContain(token);
    expect(output).toEqual([]);
  });
});
