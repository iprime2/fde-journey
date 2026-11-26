// The proxy's quick sign-in check, called directly with NextRequest objects.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import { PATH_HEADER } from "@/lib/login";

const BASE = "http://localhost:3000";
const COOKIE = "better-auth.session_token=made-up-token.made-up-signature";

function call(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return proxy(new NextRequest(`${BASE}${path}`, { method: init.method ?? "GET", headers: init.headers }));
}

/** True when the proxy let the request through to the app. */
const passed = (res: Response) => res.headers.get("x-middleware-next") === "1" && !res.headers.has("location");

/** The request headers Next forwards to the app, as the proxy set them. */
function forwarded(res: Response): Headers {
  const names = (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);
  const headers = new Headers();
  for (const name of names) headers.set(name, res.headers.get(`x-middleware-request-${name}`) ?? "");
  return headers;
}

describe("proxy", () => {
  it("signed out: sends a page visit to /login, keeping where it was going without Next's _rsc parameter", () => {
    const res = call("/roadmap?q=rag&_rsc=1a2b3");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/login?next=%2Froadmap%3Fq%3Drag`);
  });

  it("signed out on Home: /login without a next parameter", () => {
    expect(call("/").headers.get("location")).toBe(`${BASE}/login`);
  });

  it("lets the sign-in page and Better Auth's endpoints through without a cookie", () => {
    for (const path of ["/login", "/login?error=not_owner", "/api/auth/callback/github?code=x&state=y"]) {
      expect(passed(call(path)), path).toBe(true);
    }
  });

  it("lets a Server Action (POST with next-action) through without a cookie, so it can answer signed-out", () => {
    const res = call("/roadmap", { method: "POST", headers: { "next-action": "made-up-action-id" } });
    expect(passed(res)).toBe(true);
  });

  it("redirects a GET that carries next-action, since it is not a Server Action", () => {
    const res = call("/roadmap", { headers: { "next-action": "made-up-action-id" } });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/login?next=%2Froadmap`);
  });

  it("redirects a POST without next-action when signed out", () => {
    expect(call("/roadmap", { method: "POST" }).headers.get("location")).toBe(`${BASE}/login?next=%2Froadmap`);
  });

  it("with a cookie: passes, telling the app the requested path", () => {
    const res = call("/scaler?q=rag&_rsc=1", { headers: { cookie: COOKIE } });
    expect(passed(res)).toBe(true);
    expect(forwarded(res).get(PATH_HEADER)).toBe("/scaler?q=rag");
    expect(forwarded(res).get("cookie")).toBe(COOKIE);
  });

  it("replaces a path header sent by the browser with the real path", () => {
    const res = call("/certs", { headers: { cookie: COOKIE, [PATH_HEADER]: "/login?next=https://evil.example" } });
    expect(forwarded(res).get(PATH_HEADER)).toBe("/certs");
  });

  it("removes a path header sent by the browser on public paths and Server Actions", () => {
    const sent = { [PATH_HEADER]: "/made-up", "x-other": "kept" };
    for (const res of [
      call("/login", { headers: sent }),
      call("/api/auth/get-session", { headers: sent }),
      call("/roadmap", { method: "POST", headers: { ...sent, "next-action": "made-up-action-id" } }),
    ]) {
      expect(passed(res)).toBe(true);
      expect(forwarded(res).has(PATH_HEADER)).toBe(false);
      expect(forwarded(res).get("x-other")).toBe("kept");
    }
  });

  it("runs on pages and actions, not on Next's static files or files with an extension", () => {
    for (const url of ["/", "/roadmap", "/login", "/api/auth/get-session"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    }
    for (const url of ["/_next/static/chunks/app.js", "/_next/image?url=x", "/favicon.ico"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false);
    }
  });
});
