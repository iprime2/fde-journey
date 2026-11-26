// The end-to-end sign-in seed must be inert anywhere but a local test run.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dbConfigFromEnv } from "@/db/client";
import { checkE2eSeedEnv } from "../../scripts/lib/e2e-guard.mjs";

const WEB = "/repo/web";
const SPARES = ["a".repeat(43), "b".repeat(43)];
const good = {
  E2E_AUTH: "1",
  PGLITE_DIR: ".data/pglite-e2e",
  E2E_SESSION_TOKEN: "t".repeat(43),
  E2E_SPARE_SESSION_TOKENS: SPARES.join(","),
  OWNER_GITHUB_ID: "900000000001",
};

describe("e2e seed guard", () => {
  it("passes only for a local test run", () => {
    expect(checkE2eSeedEnv(good, WEB)).toEqual({
      ok: true,
      dataDir: path.join(WEB, ".data", "pglite-e2e"),
      token: good.E2E_SESSION_TOKEN,
      spareTokens: SPARES,
      userTokens: [],
      exportKeyHash: null,
      ownerId: good.OWNER_GITHUB_ID,
    });
  });

  it("reads the M4b users' sessions and the export key's hash", () => {
    const users = `waitlisted:${"w".repeat(43)},suspended:${"s".repeat(43)}`;
    expect(checkE2eSeedEnv({ ...good, E2E_USER_SESSION_TOKENS: users, E2E_EXPORT_KEY_HASH: "a".repeat(64) }, WEB)).toMatchObject({
      ok: true,
      userTokens: [
        { user: "waitlisted", token: "w".repeat(43) },
        { user: "suspended", token: "s".repeat(43) },
      ],
      exportKeyHash: "a".repeat(64),
    });
  });

  it("spare sessions are optional", () => {
    for (const value of [undefined, ""]) {
      expect(checkE2eSeedEnv({ ...good, E2E_SPARE_SESSION_TOKENS: value }, WEB)).toMatchObject({ ok: true, spareTokens: [] });
    }
  });

  it.each([
    ["no E2E_AUTH", { E2E_AUTH: undefined }],
    ["E2E_AUTH not exactly 1", { E2E_AUTH: "true" }],
    ["on Vercel", { VERCEL: "1" }],
    ["a database URL (production-like)", { DATABASE_URL: "postgresql://user@db.example/neondb" }],
    ["a database URL pointing at localhost", { DATABASE_URL: "postgresql://localhost/test" }],
    ["no PGLITE_DIR", { PGLITE_DIR: undefined }],
    ["the development database folder", { PGLITE_DIR: ".data/pglite" }],
    ["a folder outside .data", { PGLITE_DIR: "pglite-e2e" }],
    ["path traversal", { PGLITE_DIR: ".data/pglite-e2e/../../../etc" }],
    ["an absolute path elsewhere", { PGLITE_DIR: "/tmp/pglite-e2e" }],
    ["a nested folder", { PGLITE_DIR: ".data/x/pglite-e2e" }],
    [".data itself", { PGLITE_DIR: ".data" }],
    ["a short session token", { E2E_SESSION_TOKEN: "short" }],
    ["no session token", { E2E_SESSION_TOKEN: undefined }],
    ["no owner id", { OWNER_GITHUB_ID: undefined }],
    ["a short spare token", { E2E_SPARE_SESSION_TOKENS: `${SPARES[0]},short` }],
    ["an empty spare token", { E2E_SPARE_SESSION_TOKENS: `${SPARES[0]},,${SPARES[1]}` }],
    ["a spare token with other characters", { E2E_SPARE_SESSION_TOKENS: `${"x".repeat(40)}';--` }],
    ["a repeated spare token", { E2E_SPARE_SESSION_TOKENS: `${SPARES[0]},${SPARES[0]}` }],
    ["a spare token equal to the shared one", { E2E_SPARE_SESSION_TOKENS: "t".repeat(43) }],
    ["an unknown test user", { E2E_USER_SESSION_TOKENS: `root:${"u".repeat(43)}` }],
    ["a user token without a user", { E2E_USER_SESSION_TOKENS: "u".repeat(43) }],
    ["a short user token", { E2E_USER_SESSION_TOKENS: "admin:short" }],
    ["a user token equal to the shared one", { E2E_USER_SESSION_TOKENS: `admin:${"t".repeat(43)}` }],
    ["a user token with extra parts", { E2E_USER_SESSION_TOKENS: `admin:${"u".repeat(43)}:x` }],
    ["an export key hash that isn't one", { E2E_EXPORT_KEY_HASH: "fdej_plain-key" }],
    ["a test user with the owner's GitHub id", { OWNER_GITHUB_ID: "900000000004" }],
    ["too many spare tokens", { E2E_SPARE_SESSION_TOKENS: Array.from({ length: 65 }, (_, i) => `${i}`.padStart(43, "s")).join(",") }],
  ])("refuses with %s", (_label, change) => {
    const result = checkE2eSeedEnv({ ...good, ...change }, WEB);
    expect(result.ok).toBe(false);
  });
});

describe("the app's database choice in production-like environments", () => {
  it("never uses PGlite on Vercel", () => {
    expect(() => dbConfigFromEnv({ VERCEL: "1" })).toThrow(/DATABASE_URL is required/);
  });

  it("refuses a real database while E2E_AUTH is set", () => {
    expect(() => dbConfigFromEnv({ E2E_AUTH: "1", DATABASE_URL: "postgresql://user@db.example/neondb" })).toThrow(/E2E_AUTH/);
  });

  it("uses Neon when DATABASE_URL is set, PGlite otherwise", () => {
    expect(dbConfigFromEnv({ DATABASE_URL: "postgresql://user@db.example/neondb" })).toEqual({ kind: "neon", url: "postgresql://user@db.example/neondb" });
    expect(dbConfigFromEnv({}, WEB)).toEqual({ kind: "pglite", dataDir: path.join(WEB, ".data", "pglite") });
    expect(dbConfigFromEnv({ PGLITE_DIR: ".data/pglite-e2e" }, WEB)).toEqual({ kind: "pglite", dataDir: path.join(WEB, ".data", "pglite-e2e") });
    expect(dbConfigFromEnv({ VITEST: "true" })).toEqual({ kind: "pglite", dataDir: null });
    expect(() => dbConfigFromEnv({ DATABASE_URL: "mysql://x" })).toThrow();
  });
});

describe("no test sign-in in production code", () => {
  const roots = ["app", "components", "lib", "db", "proxy.ts"];
  const files = (p: string): string[] =>
    statSync(p).isDirectory() ? readdirSync(p).flatMap((name) => files(path.join(p, name))) : /\.(ts|tsx)$/.test(p) ? [p] : [];

  it("the app never reads the e2e session tokens, and only db/client.ts looks at E2E_AUTH (to refuse a real database)", () => {
    const all = roots.flatMap((r) => files(path.join(process.cwd(), r)));
    expect(all.length).toBeGreaterThan(20);
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("E2E_SESSION_TOKEN"), file).toBe(false);
      expect(text.includes("E2E_SPARE_SESSION_TOKENS"), file).toBe(false);
      expect(text.includes("E2E_USER_SESSION_TOKENS"), file).toBe(false);
      expect(text.includes("E2E_EXPORT_KEY_HASH"), file).toBe(false);
      if (!file.endsWith(path.join("db", "client.ts"))) expect(/E2E_AUTH/.test(text), file).toBe(false);
    }
  });
});
