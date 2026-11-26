// The proxy, called directly with NextRequest objects, against the in-memory test database: the
// quick sign-in check, and the status gate that decides before any page renders (made-up users).
import { createRequire } from "node:module";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The proxy's database, swappable per test (a failing one); the real in-memory one otherwise.
const gateDb = vi.hoisted(() => ({ override: null as null | (() => Promise<unknown>) }));
vi.mock("@/db/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/db/client")>();
  return { ...real, getGateDb: () => (gateDb.override ? gateDb.override() : real.getGateDb()) };
});

import type { Db } from "@/db/client";
import { session, user } from "@/db/schema";
import { config, proxy } from "@/proxy";
import { PATH_HEADER } from "@/lib/login";
import { captureOutput } from "./support/capture-output";
import { OTHER_ID, OWNER_ID, emptyDb, recordStatements, seedOwner, seedUser, setTestEnv, signedCookieValue } from "./support/db";

setTestEnv();

const BASE = "http://localhost:3000";
const FORGED = "better-auth.session_token=made-up-token.made-up-signature";

function call(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return proxy(new NextRequest(`${BASE}${path}`, { method: init.method ?? "GET", headers: init.headers }));
}

/** True when the proxy let the request through to the app. */
const passed = (res: Response) => res.headers.get("x-middleware-next") === "1" && !res.headers.has("location");
const location = (res: Response) => res.headers.get("location");

/** The request headers Next forwards to the app, as the proxy set them. */
function forwarded(res: Response): Headers {
  const names = (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);
  const headers = new Headers();
  for (const name of names) headers.set(name, res.headers.get(`x-middleware-request-${name}`) ?? "");
  return headers;
}

let db: Db;
let statements: string[];
let owner: string;
beforeEach(async () => {
  setTestEnv();
  db = await emptyDb();
  owner = (await seedOwner(db)).cookie;
  statements = recordStatements(db);
  statements.length = 0;
});
afterEach(() => {
  setTestEnv();
  gateDb.override = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** The cookies the response sets to expire (Max-Age=0), by name. */
const expired = (res: Response) =>
  res.headers
    .getSetCookie()
    .filter((c) => /;\s*Max-Age=0/i.test(c))
    .map((c) => c.split("=")[0])
    .sort();
const BOTH_COOKIES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

/** A made-up user with a live session. Their seeding doesn't count toward the recorded queries. */
async function seed(userId: string, githubId: string, status: "active" | "waitlisted" | "suspended") {
  const seeded = await seedUser(db, { githubId, userId, email: `${userId}@example.com`, status });
  statements.length = 0;
  return seeded;
}

describe("proxy: signed out", () => {
  it("sends a page visit to /login, keeping where it was going without Next's _rsc parameter", async () => {
    const res = await call("/roadmap?q=rag&_rsc=1a2b3");
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap%3Fq%3Drag`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("on Home: /login without a next parameter", async () => {
    expect(location(await call("/"))).toBe(`${BASE}/login`);
  });

  it("lets the public paths through without a cookie, and without asking the database", async () => {
    for (const path of ["/login", "/login?error=not_owner", "/privacy", "/api/export", "/api/auth/callback/github?code=x&state=y", "/auth/continue?next=%2Froadmap"]) {
      expect(passed(await call(path)), path).toBe(true);
    }
    expect(statements).toEqual([]);
  });

  it("lets a Server Action (POST with next-action) through without a cookie, so it can answer signed-out", async () => {
    const res = await call("/roadmap", { method: "POST", headers: { "next-action": "made-up-action-id" } });
    expect(passed(res)).toBe(true);
  });

  it("redirects a GET that carries next-action, since it is not a Server Action", async () => {
    const res = await call("/roadmap", { headers: { "next-action": "made-up-action-id" } });
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
  });

  it("redirects a POST without next-action when signed out", async () => {
    expect(location(await call("/roadmap", { method: "POST" }))).toBe(`${BASE}/login?next=%2Froadmap`);
  });

  it("a forged cookie counts as signed out, with no database query, and is expired under both names", async () => {
    const res = await call("/roadmap", { headers: { cookie: FORGED } });
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(expired(res)).toEqual(BOTH_COOKIES);
    // Right shape, wrong secret.
    const otherSecret = `better-auth.session_token=${signedCookieValue("made-up-token-of-32-characters-xx", "another-made-up-secret")}`;
    const res2 = await call("/roadmap", { headers: { cookie: otherSecret } });
    expect(location(res2)).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(expired(res2)).toEqual(BOTH_COOKIES);
    expect(statements).toEqual([]);
  });

  it("without a cookie there is nothing to expire", async () => {
    expect(expired(await call("/roadmap"))).toEqual([]);
  });
});

describe("proxy: the owner", () => {
  it("passes, telling the app the requested path, in one query", async () => {
    const res = await call("/scaler?q=rag&_rsc=1", { headers: { cookie: owner } });
    expect(passed(res)).toBe(true);
    expect(forwarded(res).get(PATH_HEADER)).toBe("/scaler?q=rag");
    expect(forwarded(res).get("cookie")).toBe(owner);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/from "session" inner join "user"/);
  });

  it("is never gated, even when their stored status reads waitlisted or suspended", async () => {
    for (const status of ["waitlisted", "suspended"] as const) {
      await db.update(user).set({ status }).where(eq(user.id, "owner"));
      for (const path of ["/", "/roadmap", "/admin"]) expect(passed(await call(path, { headers: { cookie: owner } })), `${status} ${path}`).toBe(true);
      // And /waitlist is not for them: Home.
      expect(location(await call("/waitlist", { headers: { cookie: owner } }))).toBe(`${BASE}/`);
    }
  });

  it("replaces a path header sent by the browser with the real path", async () => {
    const res = await call("/certs", { headers: { cookie: owner, [PATH_HEADER]: "/login?next=https://evil.example" } });
    expect(forwarded(res).get(PATH_HEADER)).toBe("/certs");
  });

  it("removes a path header sent by the browser on public paths and Server Actions", async () => {
    const sent = { [PATH_HEADER]: "/made-up", "x-other": "kept" };
    for (const res of [
      await call("/login", { headers: sent }),
      await call("/api/auth/get-session", { headers: sent }),
      await call("/roadmap", { method: "POST", headers: { ...sent, "next-action": "made-up-action-id" } }),
    ]) {
      expect(passed(res)).toBe(true);
      expect(forwarded(res).has(PATH_HEADER)).toBe(false);
      expect(forwarded(res).get("x-other")).toBe("kept");
    }
  });
});

describe("proxy status gate, capped mode", () => {
  beforeEach(() => {
    process.env.SIGNUP_MODE = "capped";
  });

  it("an active user passes on app pages, and /waitlist sends them Home", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    for (const path of ["/", "/roadmap", "/settings"]) expect(passed(await call(path, { headers: { cookie } })), path).toBe(true);
    const res = await call("/waitlist", { headers: { cookie } });
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${BASE}/`);
  });

  it("a waitlisted user is sent to /waitlist from every app page, page loads and client navigations alike", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const path of ["/", "/roadmap?q=rag", "/career", "/admin/users", "/settings", "/no-such-page", "/roadmap?_rsc=abc"]) {
      const res = await call(path, { headers: { cookie, rsc: "1" } });
      expect(res.status, path).toBe(307);
      expect(location(res), path).toBe(`${BASE}/waitlist`);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(passed(await call("/waitlist", { headers: { cookie } }))).toBe(true);
    // One query per gated request, no more.
    expect(statements).toHaveLength(8);
  });

  it("a waitlisted user still reaches the public pages and the post-sign-in route, with no query", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const path of ["/privacy", "/login", "/api/auth/get-session", "/api/export", "/auth/continue"]) {
      expect(passed(await call(path, { headers: { cookie } })), path).toBe(true);
    }
    expect(statements).toEqual([]);
  });

  it("a suspended user goes to the sign-in page with the suspended notice, /waitlist included", async () => {
    const { cookie } = await seed("sid", OTHER_ID, "suspended");
    for (const path of ["/", "/roadmap", "/waitlist"]) expect(location(await call(path, { headers: { cookie } })), path).toBe(`${BASE}/login?error=suspended`);
  });

  it("is read fresh every time: a user let in passes on their next request", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    expect(location(await call("/", { headers: { cookie } }))).toBe(`${BASE}/waitlist`);
    await db.update(user).set({ status: "active" }).where(eq(user.id, "wren"));
    expect(location(await call("/waitlist", { headers: { cookie } }))).toBe(`${BASE}/`);
    expect(passed(await call("/", { headers: { cookie } }))).toBe(true);
  });

  it("an ended or expired session goes to /login, keeping where it was going, and its cookie is expired", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, "riley"));
    const res = await call("/roadmap", { headers: { cookie } });
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(expired(res)).toEqual(BOTH_COOKIES);
    await db.delete(session).where(eq(session.userId, "riley"));
    const res2 = await call("/roadmap", { headers: { cookie } });
    expect(location(res2)).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(expired(res2)).toEqual(BOTH_COOKIES);
  });

  it("judges expiry by this server's clock, as Better Auth does, not the database's", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    // Seeded sessions end in a day. Two days on by the server's clock, the database's now() still
    // says live; Better Auth would say ended, and so does the proxy.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(location(await call("/roadmap", { headers: { cookie } }))).toBe(`${BASE}/login?next=%2Froadmap`);
    vi.useRealTimers();
    expect(passed(await call("/roadmap", { headers: { cookie } }))).toBe(true);
  });

  it("a suspended or waitlisted user's live cookie is kept (the page they land on deals with it)", async () => {
    const wren = await seed("wren", OTHER_ID, "waitlisted");
    const sid = await seed("sid", "900000000003", "suspended");
    expect(expired(await call("/roadmap", { headers: { cookie: wren.cookie } }))).toEqual([]);
    expect(expired(await call("/roadmap", { headers: { cookie: sid.cookie } }))).toEqual([]);
  });

  it("wrong user: a cookie only ever speaks for its own user", async () => {
    const wren = await seed("wren", OTHER_ID, "waitlisted");
    await seed("riley", "900000000003", "active");
    expect(location(await call("/roadmap", { headers: { cookie: wren.cookie } }))).toBe(`${BASE}/waitlist`);
    expect(passed(await call("/roadmap", { headers: { cookie: owner } }))).toBe(true);
  });

  it("without OWNER_GITHUB_ID nobody gets in (as on the pages)", async () => {
    delete process.env.OWNER_GITHUB_ID;
    expect(location(await call("/roadmap", { headers: { cookie: owner } }))).toBe(`${BASE}/login?next=%2Froadmap`);
    process.env.OWNER_GITHUB_ID = OWNER_ID;
  });

  it("fails closed without the auth secret: 503, no page, and nothing secret in the log", async () => {
    const output = captureOutput();
    const { cookie, token } = await seed("wren", OTHER_ID, "waitlisted");
    delete process.env.BETTER_AUTH_SECRET;
    const res = await call("/roadmap", { headers: { cookie } });
    expect(res.status).toBe(503);
    expect(passed(res)).toBe(false);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(output.join("\n")).toMatch(/Proxy: session status check failed/);
    expect(output.join("\n")).not.toContain(token);
  });
});

describe("proxy status gate, owner-only mode (SIGNUP_MODE unset)", () => {
  it("the owner passes; any other account, even an active one, goes to /login", async () => {
    expect(passed(await call("/roadmap", { headers: { cookie: owner } }))).toBe(true);
    for (const status of ["active", "waitlisted", "suspended"] as const) {
      await db.delete(user).where(eq(user.id, "someone"));
      const { cookie } = await seed("someone", OTHER_ID, status);
      const res = await call("/roadmap", { headers: { cookie } });
      expect(location(res), status).toBe(`${BASE}/login?next=%2Froadmap`);
      // A live session, refused: the cookie stays so /login can revoke the session (lib/session.ts).
      expect(expired(res), status).toEqual([]);
    }
  });
});

describe("proxy: a tab left open after its session ended", () => {
  // The router's own requests (prefetches, client navigations, refreshes): fetch() calls, so
  // Sec-Fetch-Mode is not "navigate" (Next strips its own headers and _rsc before the proxy), or a
  // page payload path. With a dead or refused session they pass, as before the status gate, and
  // never expire a cookie: only page loads are redirected (and clear the cookie).
  const FETCH = { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
  const NAVIGATE = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
  const ROUTER_REQUESTS: [string, Record<string, string>][] = [
    ["/roadmap", FETCH],
    ["/certs?q=rag", { "sec-fetch-mode": "same-origin" }],
    ["/roadmap.rsc", {}],
    ["/roadmap.segments/_full.segment.rsc", {}],
    ["/index.segments/_tree.segment.rsc", FETCH],
  ];

  it("an ended session: router requests pass untouched; a page load goes to /login and clears the cookie", async () => {
    process.env.SIGNUP_MODE = "capped";
    const { cookie } = await seed("riley", OTHER_ID, "active");
    await db.delete(session).where(eq(session.userId, "riley"));
    for (const [path, fetchMetadata] of ROUTER_REQUESTS) {
      const res = await call(path, { headers: { cookie, ...fetchMetadata } });
      expect(passed(res), path).toBe(true);
      expect(res.headers.getSetCookie(), path).toEqual([]);
    }
    // A page load, with Fetch Metadata or without (the stricter default).
    for (const fetchMetadata of [NAVIGATE, {}]) {
      const page = await call("/certs", { headers: { cookie, ...fetchMetadata } });
      expect(location(page)).toBe(`${BASE}/login?next=%2Fcerts`);
      expect(expired(page)).toEqual(BOTH_COOKIES);
    }
  });

  it("a forged cookie or a refused session (owner-only mode): router requests pass too", async () => {
    expect(passed(await call("/roadmap", { headers: { cookie: FORGED, ...FETCH } }))).toBe(true);
    const { cookie } = await seed("riley", OTHER_ID, "active");
    expect(passed(await call("/roadmap", { headers: { cookie, ...FETCH } }))).toBe(true);
    expect(location(await call("/roadmap", { headers: { cookie, ...NAVIGATE } }))).toBe(`${BASE}/login?next=%2Froadmap`);
  });

  it("waitlisted and suspended users' router requests are still redirected", async () => {
    process.env.SIGNUP_MODE = "capped";
    const wren = await seed("wren", OTHER_ID, "waitlisted");
    const sid = await seed("sid", "900000000003", "suspended");
    for (const [path, fetchMetadata] of ROUTER_REQUESTS) {
      expect(location(await call(path, { headers: { cookie: wren.cookie, ...fetchMetadata } })), path).toBe(`${BASE}/waitlist`);
      expect(location(await call(path, { headers: { cookie: sid.cookie, ...fetchMetadata } })), path).toBe(`${BASE}/login?error=suspended`);
    }
  });

  it("without any cookie, router requests still go to /login (unchanged)", async () => {
    expect(location(await call("/roadmap", { headers: FETCH }))).toBe(`${BASE}/login?next=%2Froadmap`);
  });
});

describe("proxy: the production cookie name (__Secure-, over https)", () => {
  const secure = (cookie: string) => cookie.replace(/^better-auth\./, "__Secure-better-auth.");

  it("reads it like the plain one: the owner passes, a waitlisted user goes to /waitlist", async () => {
    process.env.SIGNUP_MODE = "capped";
    expect(passed(await call("/roadmap", { headers: { cookie: secure(owner) } }))).toBe(true);
    const wren = await seed("wren", OTHER_ID, "waitlisted");
    statements.length = 0;
    expect(location(await call("/roadmap", { headers: { cookie: secure(wren.cookie) } }))).toBe(`${BASE}/waitlist`);
    expect(statements).toHaveLength(1);
  });

  it("a forged or ended one is expired under both names", async () => {
    const res = await call("/roadmap", { headers: { cookie: secure(FORGED) } });
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(expired(res)).toEqual(BOTH_COOKIES);
    const secureExpiry = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-"));
    expect(secureExpiry).toMatch(/;\s*Secure/i);
    expect(secureExpiry).toMatch(/;\s*Path=\//i);
  });
});

describe("proxy: rotated secrets (BETTER_AUTH_SECRETS)", () => {
  const CURRENT = "made-up-current-secret-0123456789abcdef";
  const OLDER = "made-up-older-secret-0123456789abcdefgh";
  const signedWith = (token: string, secret: string) => `better-auth.session_token=${signedCookieValue(token, secret)}`;

  it("checks cookies with the current (first) secret only, as Better Auth does", async () => {
    process.env.SIGNUP_MODE = "capped";
    const { token } = await seed("riley", OTHER_ID, "active");
    process.env.BETTER_AUTH_SECRETS = `2:${CURRENT}, 1:${OLDER}`;
    expect(passed(await call("/roadmap", { headers: { cookie: signedWith(token, CURRENT) } }))).toBe(true);
    // Better Auth would refuse these, so the proxy does too (and is never stricter or looser).
    for (const secret of [OLDER, process.env.BETTER_AUTH_SECRET ?? ""]) {
      const res = await call("/roadmap", { headers: { cookie: signedWith(token, secret) } });
      expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
    }
  });

  it("fails closed when the list is malformed", async () => {
    captureOutput();
    for (const bad of ["no-version-here", "x:secret", "-1:secret", "1:   "]) {
      process.env.BETTER_AUTH_SECRETS = bad;
      expect((await call("/roadmap", { headers: { cookie: owner } })).status, bad).toBe(503);
    }
  });
});

describe("proxy: Next's page payload paths (.rsc, .segments)", () => {
  beforeEach(() => {
    process.env.SIGNUP_MODE = "capped";
  });

  it("are gated as their page: a waitlisted user goes to /waitlist, and /waitlist's own stay theirs", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const path of ["/roadmap.rsc", "/roadmap.segments/_full.segment.rsc", "/index.rsc", "/index.segments/_tree.segment.rsc", "/admin/users.rsc"]) {
      expect(location(await call(path, { headers: { cookie } })), path).toBe(`${BASE}/waitlist`);
    }
    for (const path of ["/waitlist.rsc", "/waitlist.segments/_full.segment.rsc", "/waitlist.segments/$c$children/__PAGE__.segment.rsc"]) {
      expect(passed(await call(path, { headers: { cookie } })), path).toBe(true);
    }
  });

  it("signed out: /login remembers the page, not the payload path", async () => {
    expect(location(await call("/roadmap.segments/_full.segment.rsc?_rsc=x"))).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(location(await call("/index.rsc"))).toBe(`${BASE}/login`);
  });

  it("the public pages' payloads stay public, with no query", async () => {
    for (const path of ["/login.rsc", "/login.segments/_full.segment.rsc", "/privacy.segments/_full.segment.rsc"]) {
      expect(passed(await call(path)), path).toBe(true);
    }
    expect(statements).toEqual([]);
  });

  it("an active user passes, and the page header names the page", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    const res = await call("/roadmap.segments/_full.segment.rsc", { headers: { cookie } });
    expect(passed(res)).toBe(true);
    expect(forwarded(res).get(PATH_HEADER)).toBe("/roadmap");
  });
});

describe("proxy: Server Actions", () => {
  const action = (path: string, cookie?: string) =>
    call(path, { method: "POST", headers: { "next-action": "made-up-action-id", ...(cookie ? { cookie } : {}) } });
  const refused = async (res: Response) => res.status === 403 && (await res.text()) === "" && res.headers.get("cache-control") === "no-store";

  beforeEach(() => {
    process.env.SIGNUP_MODE = "capped";
  });

  it("a waitlisted user's are refused (403, no body) everywhere but /waitlist", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const path of ["/", "/roadmap", "/settings", "/admin/waitlist", "/roadmap.rsc"]) expect(await refused(await action(path, cookie)), path).toBe(true);
    // Leaving the waitlist, signing out and renewing the session all post to /waitlist.
    expect(passed(await action("/waitlist", cookie))).toBe(true);
  });

  it("a suspended user's are refused everywhere but /waitlist (whose actions refuse them themselves)", async () => {
    const { cookie } = await seed("sid", OTHER_ID, "suspended");
    for (const path of ["/", "/roadmap", "/settings"]) expect(await refused(await action(path, cookie)), path).toBe(true);
    expect(passed(await action("/waitlist", cookie))).toBe(true);
  });

  it("active users and the owner (whatever their status reads) pass", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    expect(passed(await action("/roadmap", cookie))).toBe(true);
    await db.update(user).set({ status: "waitlisted" }).where(eq(user.id, "owner"));
    expect(passed(await action("/roadmap", owner))).toBe(true);
  });

  it("signed out (no cookie, a forged one, an ended session, a refused one) keeps the typed answer", async () => {
    expect(passed(await action("/roadmap"))).toBe(true);
    expect(passed(await action("/roadmap", FORGED))).toBe(true);
    const { cookie } = await seed("riley", OTHER_ID, "active");
    delete process.env.SIGNUP_MODE; // owner-only: Riley's session is refused
    expect(passed(await action("/roadmap", cookie))).toBe(true);
    await db.delete(session).where(eq(session.userId, "riley"));
    expect(passed(await action("/roadmap", cookie))).toBe(true);
  });

  it("on public paths, pass with no query (signing in from /login)", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    expect(passed(await action("/login", cookie))).toBe(true);
    expect(statements).toEqual([]);
  });

  it("when the check fails: 503, no body", async () => {
    captureOutput();
    gateDb.override = async () => {
      throw new TypeError("fetch failed");
    };
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    const res = await action("/roadmap", cookie);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("");
  });
});

describe("proxy: when the database doesn't answer", () => {
  /** A database whose queries fail like a dropped connection `failures` times, then work. */
  async function flaky(failures: number, error: () => Error = () => new TypeError("fetch failed")) {
    const real = db;
    let calls = 0;
    const fake = {
      select: (...args: Parameters<Db["select"]>) => {
        calls += 1;
        if (calls <= failures) throw error();
        return real.select(...args);
      },
    };
    gateDb.override = async () => fake;
    return () => calls;
  }

  it("tries once more after a network failure, and the second try counts", async () => {
    process.env.SIGNUP_MODE = "capped";
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    const calls = await flaky(1);
    expect(location(await call("/roadmap", { headers: { cookie } }))).toBe(`${BASE}/waitlist`);
    expect(calls()).toBe(2);
  });

  it("twice: a small static page (503, no-store, Retry-After) with a way to try again, never the app", async () => {
    const output = captureOutput();
    const { cookie, token } = await seed("wren", OTHER_ID, "waitlisted");
    const calls = await flaky(5);
    const res = await call("/roadmap", { headers: { cookie } });
    expect(calls()).toBe(2);
    expect(res.status).toBe(503);
    expect(passed(res)).toBe(false);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain("<title>FDE Journey</title>");
    expect(html).toMatch(/<a href="">Try again<\/a>/);
    expect(html).not.toMatch(/Sections|Skip to content|<script/);
    expect(html.length).toBeLessThan(600);
    const log = output.join("\n");
    expect(log).toMatch(/Proxy: session status check failed \(SafeError/);
    expect(log).not.toContain(token);
  });

  it("a database's own error is not retried", async () => {
    captureOutput();
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    const calls = await flaky(5, () => Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    expect((await call("/roadmap", { headers: { cookie } })).status).toBe(503);
    expect(calls()).toBe(1);
  });
});

describe("proxy config", () => {
  // Next's own matcher compiler, as the build uses it (it adds the .rsc and .segments suffixes).
  const nodeRequire = createRequire(import.meta.url);
  const compiled = () => {
    const g = globalThis as { AsyncLocalStorage?: unknown };
    g.AsyncLocalStorage ??= nodeRequire("node:async_hooks").AsyncLocalStorage;
    const { getMiddlewareMatchers } = nodeRequire("next/dist/build/analysis/get-page-static-info.js") as {
      getMiddlewareMatchers: (matcher: unknown, nextConfig: unknown) => { regexp: string }[];
    };
    const matchers = getMiddlewareMatchers(config.matcher, {});
    return (url: string) => matchers.some((m) => new RegExp(m.regexp).test(url));
  };

  /** Every file the app serves at its own address: app/ metadata files and everything in public/. */
  function staticFiles(): string[] {
    const fs = nodeRequire("node:fs") as typeof import("node:fs");
    const path = nodeRequire("node:path") as typeof import("node:path");
    const root = process.cwd();
    const fromApp = fs.readdirSync(path.join(root, "app")).filter((f) => /\.[a-z0-9]+$/i.test(f) && !/\.(tsx?|css)$/.test(f)).map((f) => `/${f}`);
    const fromPublic = (fs.readdirSync(path.join(root, "public"), { recursive: true }) as string[])
      .filter((f) => fs.statSync(path.join(root, "public", f)).isFile())
      .map((f) => `/${f.split(path.sep).join("/")}`);
    return [...fromApp, ...fromPublic];
  }

  it("runs on pages, actions and Next's page payloads", () => {
    const matches = compiled();
    for (const url of ["/", "/roadmap", "/login", "/api/auth/get-session", "/auth/continue", "/roadmap.rsc", "/roadmap.segments/_full.segment.rsc", "/index.rsc", "/index.segments/_tree.segment.rsc", "/waitlist.segments/_full.segment.rsc", "/admin/users.rsc"]) {
      expect(matches(url), url).toBe(true);
    }
    for (const url of ["/", "/roadmap", "/login", "/api/auth/get-session", "/auth/continue"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    }
  });

  it("skips Next's static files and every static file the app serves", () => {
    const matches = compiled();
    const files = staticFiles();
    expect(files).toEqual(expect.arrayContaining(["/favicon.ico", "/icon.svg", "/apple-icon.png", "/brand/logo-mark.svg"]));
    for (const url of [
      ...files,
      "/_next/static/chunks/app.js",
      "/_next/static/media/inter-latin.woff2",
      "/_next/static/css/app.css",
      "/_next/image?url=x",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/opengraph-image.png",
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });
});
