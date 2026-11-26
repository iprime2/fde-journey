// The auth route handler and the sign-in and sign-out actions: signed out, wrong user, owner.
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers, cookies: async () => ({ set: () => {}, get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { signInWithGitHub, signOut } from "@/app/actions/auth";
import type { Db } from "@/db/client";
import { session, verification } from "@/db/schema";
import { emptyDb, resetAuth, seedOtherUser, seedOwner, setTestEnv } from "./support/db";

setTestEnv();

const BASE = "http://localhost:3000";
let db: Db;
beforeEach(async () => {
  db = await emptyDb();
  request.headers = new Headers();
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
