// Where a signed-in visitor may go (lib/landing.ts): the rule the proxy and the post-sign-in route
// share. Pure functions; no database.
import { describe, expect, it } from "vitest";
import { type Standing, SUSPENDED_HREF, continueTarget, gateTarget, pagePathname, standingOf } from "@/lib/landing";

const STANDINGS: Standing[] = ["signed-out", "active", "waitlisted", "suspended"];

describe("pagePathname (Next's page payload paths)", () => {
  it.each([
    ["/roadmap", "/roadmap"],
    ["/", "/"],
    ["/roadmap.rsc", "/roadmap"],
    ["/roadmap.segments/_full.segment.rsc", "/roadmap"],
    ["/admin/users.segments/$c$children/__PAGE__.segment.rsc", "/admin/users"],
    ["/index.rsc", "/"],
    ["/index.segments/_tree.segment.rsc", "/"],
    ["/waitlist.segments/_full.segment.rsc", "/waitlist"],
    ["/login.rsc", "/login"],
    // Only Next's own suffixes are removed; a page called /index stays itself.
    ["/index", "/index"],
    ["/roadmap.rscx", "/roadmap.rscx"],
  ])("%s is the page %s", (from, to) => {
    expect(pagePathname(from)).toBe(to);
  });
});

describe("standingOf", () => {
  it("no live session is signed out", () => {
    expect(standingOf(null, "capped")).toBe("signed-out");
    expect(standingOf(null, "owner-only")).toBe("signed-out");
  });

  it("capped: the stored status", () => {
    for (const status of ["active", "waitlisted", "suspended"] as const) {
      expect(standingOf({ status, isOwner: false }, "capped")).toBe(status);
    }
  });

  it("the owner is always active, whatever the status reads, in both modes", () => {
    for (const status of ["active", "waitlisted", "suspended", "", null, "made-up"]) {
      expect(standingOf({ status, isOwner: true }, "capped"), String(status)).toBe("active");
      expect(standingOf({ status, isOwner: true }, "owner-only"), String(status)).toBe("active");
    }
  });

  it("owner-only: nobody else has a usable session, even an active user", () => {
    for (const status of ["active", "waitlisted", "suspended"]) {
      expect(standingOf({ status, isOwner: false }, "owner-only")).toBe("signed-out");
    }
  });

  it("a status the app doesn't know counts as signed out (never /waitlist, which would loop)", () => {
    for (const status of ["", null, undefined, "ACTIVE", "admin", 1]) {
      expect(standingOf({ status, isOwner: false }, "capped"), String(status)).toBe("signed-out");
    }
  });
});

describe("gateTarget (the proxy's answer for a page request)", () => {
  it("active: every app page passes; /waitlist goes Home", () => {
    for (const p of ["/", "/roadmap", "/admin/users", "/settings"]) expect(gateTarget("active", p, p), p).toBeNull();
    expect(gateTarget("active", "/waitlist", "/waitlist")).toBe("/");
  });

  it("waitlisted: every app page goes to /waitlist; /waitlist passes", () => {
    for (const p of ["/", "/roadmap", "/career", "/admin", "/settings", "/no-such-page"]) expect(gateTarget("waitlisted", p, p), p).toBe("/waitlist");
    expect(gateTarget("waitlisted", "/waitlist", "/waitlist")).toBeNull();
  });

  it("suspended: the sign-in page with the suspended notice, from everywhere", () => {
    for (const p of ["/", "/roadmap", "/waitlist"]) expect(gateTarget("suspended", p, p)).toBe(SUSPENDED_HREF);
    expect(SUSPENDED_HREF).toBe("/login?error=suspended");
  });

  it("signed out: /login, remembering a safe path", () => {
    expect(gateTarget("signed-out", "/roadmap", "/roadmap?q=rag")).toBe("/login?next=%2Froadmap%3Fq%3Drag");
    expect(gateTarget("signed-out", "/", "/")).toBe("/login");
    expect(gateTarget("signed-out", "/waitlist", "/waitlist")).toBe("/login?next=%2Fwaitlist");
  });

  it("never loops: where it sends a visitor lets the same visitor stay (or is the public sign-in page)", () => {
    for (const standing of STANDINGS) {
      for (const start of ["/", "/roadmap", "/waitlist", "/admin"]) {
        const target = gateTarget(standing, start, start);
        if (!target) continue;
        const pathname = new URL(target, "https://app.invalid").pathname;
        if (pathname === "/login") continue; // public: the proxy never gates it
        expect(gateTarget(standing, pathname, target), `${standing} ${start} -> ${target}`).toBeNull();
      }
    }
  });
});

describe("continueTarget (where sign-in lands)", () => {
  it("active: the page they wanted", () => {
    expect(continueTarget("active", "/roadmap?q=rag#l1-1")).toBe("/roadmap?q=rag#l1-1");
    expect(continueTarget("active", "/")).toBe("/");
  });

  it("waitlisted, suspended, signed out: never the page they wanted", () => {
    expect(continueTarget("waitlisted", "/roadmap")).toBe("/waitlist");
    expect(continueTarget("suspended", "/roadmap")).toBe("/login?error=suspended");
    expect(continueTarget("signed-out", "/roadmap")).toBe("/login?next=%2Froadmap");
    expect(continueTarget("signed-out", "/")).toBe("/login");
  });

  it.each(["https://evil.example/phish", "//evil.example", "/\\evil.example", "/a/..//evil.example", "javascript:alert(1)", "/login", "/api/auth/sign-out", "/auth/continue?next=%2Froadmap", null])(
    "refuses an unsafe next (%s): an active user goes Home",
    (next) => {
      expect(continueTarget("active", next)).toBe("/");
      expect(continueTarget("signed-out", next)).toBe("/login");
    },
  );
});
