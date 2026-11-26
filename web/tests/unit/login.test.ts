import { describe, expect, it } from "vitest";
import {
  ACCESS_COPY,
  CONTINUE_PATH,
  continueHref,
  isPublicPath,
  loginHref,
  loginMessage,
  parseLoginParams,
  safeNextPath,
} from "@/lib/login";
import { signupMode } from "@/lib/signup-mode";

describe("safeNextPath (the ?next= redirect after sign-in)", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNextPath("/roadmap")).toBe("/roadmap");
    expect(safeNextPath("/roadmap?q=rag&status=done")).toBe("/roadmap?q=rag&status=done");
    expect(safeNextPath("/roadmap#item-l1-1")).toBe("/roadmap#item-l1-1");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with path", "//evil.example/roadmap"],
    ["backslash", "/\\evil.example"],
    ["backslash later on", "/roadmap\\..\\x"],
    ["tab trick", "/\t/evil.example"],
    ["newline", "/roadmap\n"],
    ["javascript scheme", "javascript:alert(1)"],
    ["no leading slash", "roadmap"],
    ["empty", ""],
    ["not a string", 42],
    ["undefined", undefined],
    ["array", ["/roadmap"]],
    ["too long", `/${"a".repeat(2100)}`],
  ])("refuses %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("never sends the owner back to /login or to an API route", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/roadmap")).toBe("/");
    expect(safeNextPath("/api/auth/sign-out")).toBe("/");
  });

  it("never nests the post-sign-in route inside itself", () => {
    expect(safeNextPath("/auth/continue")).toBe("/");
    expect(safeNextPath("/auth/continue?next=%2Froadmap")).toBe("/");
    expect(safeNextPath("/auth")).toBe("/");
    expect(safeNextPath("/authors")).toBe("/authors");
  });

  it.each(["/.//evil.example", "/a/..//evil.example", "/%2e//evil.example/roadmap", "/./%2e//evil.example", "/x/.././/evil.example?q=1"])(
    "refuses %s, which becomes //host once dot segments are removed",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
      expect(loginHref(value)).toBe("/login");
    },
  );

  it("keeps encoded slashes as a path, which stays on this site", () => {
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("loginHref", () => {
  it("adds next only when it is a real page", () => {
    expect(loginHref("/scaler?q=rag")).toBe("/login?next=%2Fscaler%3Fq%3Drag");
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("https://evil.example")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
  });
});

describe("parseLoginParams", () => {
  it("reads next and the message to show", () => {
    expect(parseLoginParams({ next: "/certs" })).toEqual({ next: "/certs", notice: null });
    expect(parseLoginParams({ next: "/certs", error: "not_owner" })).toEqual({ next: "/certs", notice: "not-owner" });
    expect(parseLoginParams({ error: "access_denied" })).toEqual({ next: "/", notice: "failed" });
    expect(parseLoginParams({ status: "signed-out" })).toEqual({ next: "/", notice: "signed-out" });
    expect(parseLoginParams({ next: ["//evil.example", "/x"] })).toEqual({ next: "/", notice: null });
  });

  // Codes Better Auth 1.7 adds as ?error= (oauth2/state, oauth2/errors, api/routes/callback and
  // error), GitHub's own (access_denied when the visitor cancels) and ours (unavailable).
  it.each([
    "state_mismatch",
    "state_not_found",
    "state_invalid",
    "internal_server_error",
    "invalid_callback_request",
    "no_code",
    "oauth_provider_not_found",
    "unable_to_get_user_info",
    "email_not_found",
    "access_denied",
    "UNKNOWN",
    "unavailable",
  ])("shows 'didn't finish' for %s", (code) => {
    expect(parseLoginParams({ next: "/roadmap", error: code, error_description: "Made-up description" })).toEqual({
      next: "/roadmap",
      notice: "failed",
    });
  });

  it("an error wins over the signed-out status, and not_owner keeps its own message", () => {
    expect(parseLoginParams({ error: "state_mismatch", status: "signed-out" }).notice).toBe("failed");
    expect(parseLoginParams({ error: ["not_owner", "state_mismatch"] }).notice).toBe("not-owner");
  });
});

describe("continueHref (the sign-in callbackURL)", () => {
  it("carries next only when it is a real page, checked like loginHref", () => {
    expect(continueHref("/scaler?q=rag")).toBe("/auth/continue?next=%2Fscaler%3Fq%3Drag");
    expect(continueHref("/")).toBe(CONTINUE_PATH);
    expect(continueHref(null)).toBe(CONTINUE_PATH);
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/auth/continue?next=/x", "/a/..//evil.example"]) {
      expect(continueHref(bad), bad).toBe(CONTINUE_PATH);
    }
  });
});

describe("isPublicPath", () => {
  it("allows only the sign-in page, the privacy page, the export endpoint (its own key) and Better Auth's endpoints", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/api/export")).toBe(true);
    expect(isPublicPath("/api/auth/callback/github")).toBe(true);
    expect(isPublicPath("/api/auth")).toBe(true);
    // The post-sign-in route checks the session itself, and only ever redirects.
    expect(isPublicPath("/auth/continue")).toBe(true);
    for (const p of ["/auth", "/auth/continue/x", "/auth/continuex", "/", "/roadmap", "/login-help", "/loginx", "/api/authx", "/api/export/x", "/api/exports", "/privacy/x", "/waitlist", "/settings", "/admin", "/career"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});

describe("access mode copy (design spec 8)", () => {
  it("is owner only unless SIGNUP_MODE says capped, with the owner-only wording", () => {
    expect(signupMode({})).toBe("owner-only");
    expect(ACCESS_COPY[signupMode({})].access).toBe("Private for now: only the owner's GitHub account can sign in.");
    expect(ACCESS_COPY[signupMode({ SIGNUP_MODE: "capped" })].access).toMatch(/^New here\? .*join the waitlist\.$/);
    expect(loginMessage("not-owner", "owner-only")).toEqual({
      tone: "error",
      text: "This GitHub account can't sign in. FDE Journey is private to its owner for now.",
    });
  });

  it("changes the access line and the not-allowed error with the mode, and nothing else", () => {
    expect(ACCESS_COPY.capped.access).toBe(
      "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist.",
    );
    expect(loginMessage("not-owner", "capped")?.text).toBe("Sign-in didn't finish. Try again.");
    expect(ACCESS_COPY.open.access).toBe("New here? Continue with GitHub to start your own tracker.");
    expect(Object.keys(ACCESS_COPY)).toEqual(["owner-only", "capped", "open"]);
    for (const mode of ["owner-only", "capped", "open"] as const) {
      expect(loginMessage("failed", mode)).toEqual({ tone: "error", text: "Sign-in didn't finish. Try again." });
      expect(loginMessage("signed-out", mode)).toEqual({ tone: "info", text: "You're signed out." });
      expect(loginMessage(null, mode)).toBeNull();
    }
  });

  it("with open sign-up, a stray not-allowed code reads as a failed sign-in", () => {
    expect(loginMessage("not-owner", "open")).toEqual({ tone: "error", text: "Sign-in didn't finish. Try again." });
  });

  it("M4b notices: suspended (error), deleted and left the waitlist (info), in every mode", () => {
    expect(parseLoginParams({ error: "suspended" }).notice).toBe("suspended");
    expect(parseLoginParams({ status: "deleted" }).notice).toBe("deleted");
    expect(parseLoginParams({ status: "left-waitlist" }).notice).toBe("left-waitlist");
    expect(parseLoginParams({ status: "toString" }).notice).toBeNull();
    expect(parseLoginParams({ status: "__proto__" }).notice).toBeNull();
    expect(loginMessage("suspended", "owner-only")).toEqual({
      tone: "error",
      text: "This account is suspended, so it can't sign in. If you think this is a mistake, open an issue on GitHub.",
    });
    expect(loginMessage("deleted", "owner-only")).toEqual({ tone: "info", text: "Your account and data are deleted." });
    expect(loginMessage("left-waitlist", "owner-only")).toEqual({ tone: "info", text: "You've left the waitlist and your account is deleted." });
  });

  it("maps the query to the right banner", () => {
    expect(loginMessage(parseLoginParams({ error: "not_owner" }).notice, "owner-only")?.tone).toBe("error");
    expect(loginMessage(parseLoginParams({ error: "unavailable" }).notice, "owner-only")?.text).toBe("Sign-in didn't finish. Try again.");
    expect(loginMessage(parseLoginParams({ status: "signed-out" }).notice, "owner-only")?.tone).toBe("info");
    expect(loginMessage(parseLoginParams({}).notice, "owner-only")).toBeNull();
  });
});
