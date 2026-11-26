// The proxy, called directly with NextRequest objects, against the in-memory test database: the
// quick sign-in check, and the status gate that decides before any page renders (made-up users).
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.restoreAllMocks();
});

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

  it("a forged cookie counts as signed out, with no database query", async () => {
    const res = await call("/roadmap", { headers: { cookie: FORGED } });
    expect(location(res)).toBe(`${BASE}/login?next=%2Froadmap`);
    // Right shape, wrong secret.
    const otherSecret = `better-auth.session_token=${signedCookieValue("made-up-token-of-32-characters-xx", "another-made-up-secret")}`;
    expect(location(await call("/roadmap", { headers: { cookie: otherSecret } }))).toBe(`${BASE}/login?next=%2Froadmap`);
    expect(statements).toEqual([]);
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

  it("a waitlisted user still reaches the public pages, the post-sign-in route and Server Actions (typed answers)", async () => {
    const { cookie } = await seed("wren", OTHER_ID, "waitlisted");
    for (const path of ["/privacy", "/login", "/api/auth/get-session", "/api/export", "/auth/continue"]) {
      expect(passed(await call(path, { headers: { cookie } })), path).toBe(true);
    }
    expect(passed(await call("/roadmap", { method: "POST", headers: { cookie, "next-action": "made-up-action-id" } }))).toBe(true);
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

  it("an ended or expired session goes to /login, keeping where it was going", async () => {
    const { cookie } = await seed("riley", OTHER_ID, "active");
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, "riley"));
    expect(location(await call("/roadmap", { headers: { cookie } }))).toBe(`${BASE}/login?next=%2Froadmap`);
    await db.delete(session).where(eq(session.userId, "riley"));
    expect(location(await call("/roadmap", { headers: { cookie } }))).toBe(`${BASE}/login?next=%2Froadmap`);
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

  it("fails closed when the check can't run: 503, no page, and nothing secret in the log", async () => {
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
      expect(location(await call("/roadmap", { headers: { cookie } })), status).toBe(`${BASE}/login?next=%2Froadmap`);
    }
  });
});

describe("proxy config", () => {
  it("runs on pages and actions, not on Next's static files or files with an extension", () => {
    for (const url of ["/", "/roadmap", "/login", "/api/auth/get-session", "/auth/continue"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    }
    for (const url of ["/_next/static/chunks/app.js", "/_next/image?url=x", "/favicon.ico"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false);
    }
  });
});
