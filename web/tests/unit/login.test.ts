import { describe, expect, it } from "vitest";
import { isPublicPath, loginHref, parseLoginParams, safeNextPath } from "@/lib/login";

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

describe("isPublicPath", () => {
  it("allows only the sign-in page and Better Auth's endpoints", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/callback/github")).toBe(true);
    expect(isPublicPath("/api/auth")).toBe(true);
    for (const p of ["/", "/roadmap", "/login-help", "/loginx", "/api/authx", "/api/export", "/career"]) expect(isPublicPath(p), p).toBe(false);
  });
});
