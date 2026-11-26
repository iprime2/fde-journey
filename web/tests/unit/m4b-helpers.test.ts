// Small M4b helpers: the sign-up switch, the access-code hash, export keys, section defaults,
// permission sets and GitHub usernames. Made-up values only.
import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, OWNER_SECTIONS, withImpliedPermissions } from "@/lib/access-types";
import { hashAccessCode, normaliseAccessCode, verifyAccessCode } from "@/lib/access-code";
import { cleanGithubLogin } from "@/lib/auth";
import { bearerKey, hashExportKey, newExportKey } from "@/lib/export-token";
import { effectiveSections } from "@/lib/sections";
import { signupMode } from "@/lib/signup-mode";

describe("signupMode", () => {
  it("is owner-only unless SIGNUP_MODE is exactly capped", () => {
    expect(signupMode({})).toBe("owner-only");
    expect(signupMode({ SIGNUP_MODE: "capped" })).toBe("capped");
    expect(signupMode({ SIGNUP_MODE: " capped " })).toBe("capped");
    for (const v of ["", "open", "Capped", "true", "1"]) expect(signupMode({ SIGNUP_MODE: v })).toBe("owner-only");
  });
});

describe("the Scaler access code", () => {
  it("normalises case and spaces, and refuses non-codes", () => {
    expect(normaliseAccessCode("  made-up-1 ")).toBe("MADE-UP-1");
    for (const bad of ["short", "x".repeat(65), "line\nbreak", 123456, null, undefined, "x".repeat(300)]) expect(normaliseAccessCode(bad)).toBeNull();
  });

  it("hashes with a random salt and verifies in constant time; the hash never holds the code", async () => {
    const a = await hashAccessCode("MADE-UP-1");
    const b = await hashAccessCode("MADE-UP-1");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(a).not.toContain("MADE-UP-1");
    expect(await verifyAccessCode("MADE-UP-1", a)).toBe(true);
    expect(await verifyAccessCode("MADE-UP-2", a)).toBe(false);
    for (const broken of [null, "", "plain", "scrypt$1$1$1$x$y", a.slice(0, -4)]) expect(await verifyAccessCode("MADE-UP-1", broken)).toBe(false);
  });
});

describe("export keys", () => {
  it("are long, random, recognisable, and stored as a SHA-256 hash", () => {
    const key = newExportKey();
    expect(key).toMatch(/^fdej_[A-Za-z0-9_-]{43}$/);
    expect(newExportKey()).not.toBe(key);
    expect(hashExportKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashExportKey(key)).toBe(hashExportKey(key));
  });

  it("are read only from an Authorization: Bearer header", () => {
    const key = newExportKey();
    expect(bearerKey(`Bearer ${key}`)).toBe(key);
    expect(bearerKey(`bearer  ${key} `)).toBe(key);
    for (const bad of [null, "", key, `Basic ${key}`, `Bearer ${key} extra`, "Bearer fdej_x", `Bearer ${"x".repeat(300)}`]) expect(bearerKey(bad)).toBeNull();
  });
});

describe("effectiveSections", () => {
  it("gives new users the defaults and the owner everything", () => {
    expect(effectiveSections(null, false)).toEqual({ sections: DEFAULT_SECTIONS, scalerUnlocked: false });
    expect(effectiveSections(null, true)).toEqual({ sections: OWNER_SECTIONS, scalerUnlocked: true });
  });

  it("keeps Roadmap on and hides Scaler until it is unlocked", () => {
    const stored = { reading: false, scaler: true, certs: false, projects: true, career: true, scalerUnlockedAt: null };
    expect(effectiveSections(stored, false).sections).toEqual({ roadmap: true, reading: false, scaler: false, certs: false, projects: true, career: true });
    expect(effectiveSections({ ...stored, scalerUnlockedAt: new Date() }, false).sections.scaler).toBe(true);
    expect(effectiveSections(stored, true)).toMatchObject({ scalerUnlocked: true, sections: { scaler: true } });
  });
});

describe("permission sets", () => {
  it("add users.view to users.manage, drop duplicates, and keep the page's order", () => {
    expect(withImpliedPermissions(["users.manage"])).toEqual(["users.view", "users.manage"]);
    expect(withImpliedPermissions(["admins.manage", "metrics.view", "metrics.view"])).toEqual(["metrics.view", "admins.manage"]);
    expect(withImpliedPermissions([])).toEqual([]);
  });
});

describe("cleanGithubLogin", () => {
  it("keeps GitHub usernames and drops anything else", () => {
    expect(cleanGithubLogin("sam-example")).toBe("sam-example");
    expect(cleanGithubLogin("A1")).toBe("A1");
    for (const bad of ["", "x".repeat(40), "has space", "semi;colon", "émile", 42, null]) expect(cleanGithubLogin(bad)).toBeNull();
  });
});
